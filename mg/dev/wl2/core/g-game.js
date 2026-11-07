/// core/g-game.js
///
/// Описание:
///  -  Отобразить в цикле анимированный экран Игры.
///  -  g-judge владеет всеми игроками и применяет к ним правила игры.
///  -  world-map отображает мир.
///  -  players.js отображает всех

import { mulberry32, fbm } from './rng.js';
import { SND } from '../res/snd/--sound-lib.js';
import { MapView     } from '../render/r-map-view.js';
import { Judge       } from './g-judge.js';
import { WorldMap    } from './world.js';
import { ArmyMover   } from './g-move.js';
import { ArmyView    } from '../render/army-view.js';
import { BattleView  } from '../render/battle-view.js';

///----------------------------------------------------------------------------|
/// Созаётся когда нажимается кнопка НАЧАТЬ ИГРУ
///----------------------------------------------------------------------------:
export class Game {
  /**
   * @param {WorldMap} worldMap
   * @param {Players } playersModel  — модель с составом (после PanelPlayers.onConfirm)
   * @param {Object  }    [opts]
   * @param {HTMLElement} [opts.parent]  — куда монтировать
   * @param {Function   } [opts.onExit]  — выход в меню
   */
  constructor(worldMap, playersModel, opts = {}) {

    this.worldMap     = worldMap;
    this.playersModel = playersModel;

    this.parent = opts.parent ?? document.body;
    this.onExit = opts.onExit ?? (() => {});

    this.territories = WorldMap.distributeTerritoriesAndCapitals(
      this.worldMap,
      this.playersModel,
      { allowEmpty: true, nameCities: true, renameAll: true }
    );

    this.judge = new Judge(worldMap, playersModel);

    // Аниматор: плавное передвижение армий по маршрутам (армия за армией).
    this.mover = new ArmyMover({
      speed: 2.6,   // клеток в секунду
      onArmyStart: (army, cellsPlanned) => {
        if (cellsPlanned > 0)
          this._log(`Армия #${army.id} выступила: маршрут ${cellsPlanned} кл.`);
      },
      // Каждый шаг армии на одну клетку.
      onArmyStep: (army) => {
        SND.stepUnit.play();   // движение юнита по 1 клетке
      },
      onArmyArrive: (army, stepsDone) => {
        if (stepsDone > 0)
          this._log(`Армия #${army.id} остановилась (${army.x}, ${army.y}) — пройдено ${stepsDone} кл.`);
      },
      // Встреча с врагом: окно боя (армия текущего хода останавливается).
      onBattleRequest: (army, enemies) => this._onBattleRequest(army, enemies),
      // Все армии текущего игрока закончили ход → передаём ход следующему.
      onQueueEmpty: () => this._finishPlayerTurn(),
    });

    // Контекст для аниматора — заполнится после создания MapView.
    this._moveCtx = null;

    // DOM
    this.el = this._render();
    this.parent.appendChild(this.el);

    // карта — вся техника управления живёт в MapView
    this.mapView = new MapView(
      worldMap, this.el.querySelector('#app'), playersModel);

    this.mapView._onTileClick = (tile) => this._onTileClick(tile);
    this.mapView.lowerAllFlags(600); // Опустить все флаги...

    // Панель армии: клик по модельке армии (первый юнит массива) → открывается
    this.armyView = new ArmyView(this.mapView, {
      getPlayers: () => this.playersModel,
    });

    // Окно битвы: создаётся один раз, используется повторно при каждой встрече.
    this.battleView = new BattleView({
      getPlayers:   () => this.playersModel,
      getTurnIndex: () => this.judge.currentPlayer?.index ?? -1,
    });

    this._moveCtx = {
      world:     worldMap,
      mapView:   this.mapView,
      routeView: this.mapView.routeView,
      unitsView: this.mapView.unitsView,
    };

    // Судья сообщает игре о начале хода игрока:
    // показываем красные маркеры маршрутов и ставим армии в очередь.
    this.judge.onTurnStart = (player) => this._onTurnStart(player);

    this.selected = null;
    this._bindUI();
    this._refreshHud();
    this._log(
`Партия начата. Игроков: ${this.judge.players.length}. Ход ${this.judge.turn}.`);

    // первая камера
    this.mapView.setCameraMode('orbit');
  }

  /* ---------------- UI ---------------- */
  _render() {
    const root = document.createElement('div');
    root.className = 'game-screen';
    root.innerHTML = `
      <div id="app"></div>
      <div id="hud">

        <div id="gameSidePanel">
          <h3>Выбрано</h3>
          <div class="muted" id="selInfo">Кликни по клетке</div>
        </div>

        <div id="gameTopbar">
          <button id="btnExitGame">← В меню</button>
          <div class="turn-label" id="turnLabel">—</div>
          <button id="btnEndTurn" class="primary">Завершить ход</button>
          <button id="btnCamOrbit" class="active">Орбита</button>
          <button id="btnCamTop">Сверху</button>
        </div>

        <div id="gameLog"></div>
      </div>
    `;
    return root;
  }

  _bindUI() {
    this.el.querySelector('#btnExitGame').addEventListener('click', () => {
      SND.clickBtn.play();   // клик по кнопкам в игре
      this.onExit();
    });
    this.el.querySelector('#btnEndTurn').addEventListener('click', () => {
      SND.clickBtn.play();   // клик по кнопкам в игре
      this._onNextCircle();   // зелёная кнопка: запустить следующий круг
    });

    const btnOrbit = this.el.querySelector('#btnCamOrbit');
    const btnTop   = this.el.querySelector('#btnCamTop');
    btnOrbit.addEventListener('click', () => {
      SND.clickBtn.play();   // клик по кнопкам в игре
      btnOrbit.classList.add('active'); btnTop.classList.remove('active');
      this.mapView.setCameraMode('orbit');
    });
    btnTop.addEventListener('click', () => {
      SND.clickBtn.play();   // клик по кнопкам в игре
      btnTop.classList.add('active'); btnOrbit.classList.remove('active');
      this.mapView.setCameraMode('top');
    });

    // горячие клавиши
    this._onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); this._onNextCircle(); }
      if (e.code === 'Escape') { this._clearSelection(); }
    };
    window.addEventListener('keydown', this._onKey);
  }

  _refreshHud() {
    const j = this.judge;
    const p = j.currentPlayer;
    if (!p) return;

    const label = this.el.querySelector('#turnLabel');
    const btn   = this.el.querySelector('#btnEndTurn');

    if (j.isAwaitingNextCircle) {
      // Круг завершён — ждём зелёную кнопку.
      label.innerHTML =
        `⭕ Круг ${j.turn - 1} завершён — нажмите зелёную кнопку,` +
        ` чтобы начать круг ${j.turn}`;
      btn.disabled    = false;
      btn.textContent = '▶ Следующий круг';
      btn.classList.add('ready');
      return;
    }

    btn.classList.remove('ready');
    btn.textContent = 'Завершить ход';
    btn.disabled    = true;   // ходы идут автоматически (по анимациям)

    const role = p.isHuman ? 'Человек' : `ИИ (${p.aiMeta?.name ?? '—'})`;
    label.innerHTML =
      `${this._playerDot(p, 10)} Ход: <b>${p.name}</b> · ${role} · круг ${j.turn}`;
  }

  _log(msg, hl = false) {
    const box = this.el.querySelector('#gameLog');
    const d = document.createElement('div');
    if (hl) d.className = 'hl';
    d.textContent = msg;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    while (box.children.length > 40) box.removeChild(box.firstChild);
  }

  /* ---------------- игровое действие по клику ---------------- */
  _onTileClick(tile) {
    this.selected = tile;

    const info = this.el.querySelector('#selInfo');
    const meta = tile.meta;
    const owner = tile.ownerIndex != null
      ? this.judge.playerByIndex(tile.ownerIndex)
      : null;

    const city = this.worldMap.getCityAt(tile.x, tile.y);

    if (city) SND.clickTown.play();   // клик по клетке с городом
    else      SND.clickCell.play();   // клик по клетке без города

    const cityTypeLabel = city
      ? ({
          provincial: 'провинциальный',
          capital:    'столица',
          fortress:   'крепость',
          backwater:  'захолустье',
        }[city.type] ?? city.type)
      : '';

    const cityOwner = city && city.ownerId != null
      ? this.judge.playerByIndex(city.ownerId)
      : null;

    // ── шапка с именем города (если есть) ────────────────────────
    // Кружочек владельца города — прямо в шапке рядом с названием.
    const cityBlock = city
      ? `<div class="city-name"
              style="font-size:16px;font-weight:700;margin:6px 0 2px;">
          🏙 ${city.name}
          ${cityOwner ? this._playerDot(cityOwner, 12) : ''}
        </div>
        <div class="muted" style="margin-bottom:6px;">${cityTypeLabel}</div>`
      : '';

    // ── строка «владелец города» с кружочком ─────────────────────
    const cityOwnerLine = cityOwner
      ? `<div>${this._playerDot(cityOwner)}Владелец города: <b>${cityOwner.name}</b></div>`
      : '';

    // ── строка «владелец клетки» с кружочком ─────────────────────
    const cellOwnerLine = owner
      ? `<div>${this._playerDot(owner)}Владелец клетки: <b>${owner.name}</b></div>`
      : '';

    info.innerHTML = `
      ${cityBlock}
      <div>Клетка (${tile.x}, ${tile.y})</div>
      <div>${meta.name} · stamina ${tile.staminaCost}</div>
      <div>${tile.hasRoad ? 'Дорога ' : ''}${tile.hasRiver ? 'Река' : ''}</div>
      ${cellOwnerLine}
      ${cityOwnerLine}
    `;
  }

  _clearSelection() {
    this.selected = null;
    this.el.querySelector('#selInfo').textContent = 'Кликни по клетке';
    if (this.mapView.selRing) this.mapView.selRing.visible = false;
  }

  /* ---------------- ход: автоматика + зелёная кнопка ---------------- */

  /** Начало хода игрока (зовёт Judge через onTurnStart). */
  _onTurnStart(player) {
    const role = player.isHuman ? 'человек' : `ИИ ${player.aiMeta?.name ?? ''}`;
    this._log(`— Ход: ${player.name} (${role}) —`, true);
    this._refreshHud();

    // Красные маркеры маршрутов на карте (маршруты уже построены
    // в Player.doStep через AiBrainHelper).
    this.mapView.routeView.rebuild();

    // Армии текущего игрока идут по маршрутам ПО ОЧЕРЕДИ.
    this.mover.enqueue(player.army.slice());
  }

  /** Все армии игрока закончили движение → передаём ход. */
  _finishPlayerTurn() {
    const res = this.judge.finishCurrentTurn();
    if (!res) return;

    this._log(`Ход завершён: ${res.prev.name} → ${res.next.name}`);
    this._refreshHud();
    this._clearSelection();

    if (this.judge.isAwaitingNextCircle) {
      this._log(
        `⭕ Круг завершён. Нажмите зелёную кнопку — начать круг ${this.judge.turn}.`,
        true);
    }
  }

  /* ---------------- битвы армий ---------------- */

  /**
   * Встреча с врагом (зовёт ArmyMover через onBattleRequest):
   * движение остановлено, очередь ждёт конца битвы.
   * @param {Army}   attacker — армия текущего хода (в окне слева)
   * @param {Army[]} enemies  — вражеские армии в клетке
   */
  _onBattleRequest(attacker, enemies) {
    const defender = enemies[0];
    if (!defender) return;

    const dp = this.judge.playerByIndex(defender.idOwner);
    this._log(
      `⚔ Армия #${attacker.id} встретила армию #${defender.id}` +
      (dp ? ` (${dp.name})` : '') + ` — бой!`, true);

    this.battleView.runBattle(attacker, defender, {
      onEnd: (winner, loser) => this._onBattleEnd(winner, loser),
    });
  }

  /**
   * Сигнал «конец битвы» (зовёт BattleView): снять проигравшего с карты.
   * Мертвецы и удаление армии из мира/игрока уже сделал core/g-battle.js.
   */
  _onBattleEnd(winner, loser) {
    if (loser) {
      // меш исчезающей армии — снятие с карты (модель чистится в Battle)
      this.mapView.unitsView.removeArmy?.(loser);
      const lp = this.judge.playerByIndex(loser.idOwner);
      this._log(
        `☠ Армия #${loser.id} уничтожена; победила армия #${winner.id}` +
        (lp ? ` (${lp.name})` : ''), true);
    }

    this.mapView.unitsView.updateArmy?.(winner);
    this.mapView.routeView.rebuild();
  }

  /** Зелёная кнопка HUD (и пробел): запустить следующий круг. */
  _onNextCircle() {
    if (!this.judge.isAwaitingNextCircle) return;  // активно только между кругами
    this.judge.startNextCircle();
    this._log(`▶ Круг ${this.judge.turn} начат.`, true);
    this._refreshHud();
  }

  _playerColorHex(player) {
    if (!player || player.color == null) return '#9aa4ad';
    const c = player.color;
    if (typeof c === 'string') return c;                       // уже '#rrggbb'
    if (typeof c === 'number') return '#' + (c >>> 0).toString(16).padStart(6, '0');
    return '#9aa4ad';
  }

  _playerDot(player, size = 12) {
    const color = this._playerColorHex(player);
    return `<span class="player-dot"
                  style="display:inline-block;width:${size}px;height:${size}px;
                        border-radius:50%;background:${color};
                        border:1px solid rgba(0,0,0,.35);
                        vertical-align:middle;margin-right:6px;"></span>`;
  }

  //---------------------------|
  // Обновление Логики.        |
  //---------------------------:
  update(dt) {

    // Судья: старт хода игрока / передача хода (после всех анимаций).
    this.judge.update(dt);

    // Аниматор: плавное передвижение армий по маршрутам — каждый кадр.
    if (this._moveCtx) this.mover.update(dt, this._moveCtx);
  }

  //---------------------------|
  // Визуализация.             |
  //---------------------------:
  render(dt) {
    // пусто — сюда придёт:
    //  - this.mapView.update(dt)
    //  - this.mapView.render(dt)
    // (пока MapView крутит свой rAF — оставь пусто, см. ниже)
    this.mapView.update(dt);
    this.mapView.render(dt);
  }

  /* ---------------- API ---------------- */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    window.removeEventListener('keydown', this._onKey);
    this.mover?.clear();
    this.judge.onTurnStart = null;
    this.armyView?.destroy?.();
    this.battleView?.destroy?.();
    this.mapView?.destroy?.();
    this.el.remove();
  }

}