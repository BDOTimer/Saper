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
import { visitRuins  } from './ruins.js';
import { HumanBrain  } from './human-brain.js';
import { ArmyView    } from '../render/army-view.js';
import { TownView    } from '../render/town-view.js';
import { BattleView  } from '../render/battle-view.js';
import { ArmyChangeView } from '../render/army-change-view.js';

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

    this.judge = new Judge(worldMap, playersModel, this.territories);

    // Аниматор: плавное передвижение армий по маршрутам (армия за армией).
    this.mover = new ArmyMover({
      speed: 2.6,   // клеток в секунду
      onArmyStart: (army, cellsPlanned) => {
        if (cellsPlanned > 0)
          this._log(`Армия #${army.id} выступила: маршрут ${cellsPlanned} кл.`);
        // Армия, которая делает ход, автоматически попадает в фокус.
        this._focusArmy(army);
      },
      // Каждый шаг армии на одну клетку.
      onArmyStep: (army) => {
        // Армия вошла в город — отдельный звук.
        if (this.worldMap?.getCityAt?.(army.x, army.y)) SND.clickTownArmy.play();
        SND.stepUnit.play();   // движение юнита по 1 клетке
      },
      onArmyArrive: (army, stepsDone) => {
        if (stepsDone > 0)
          this._log(`Армия #${army.id} остановилась (${army.x}, ${army.y}) — пройдено ${stepsDone} кл.`);
        // Ход человека: армия закончила — передаём управление следующей.
        this.humanBrain?.onArmyArrive?.(army, stepsDone);
      },
      // Встреча с врагом: окно боя (армия текущего хода останавливается).
      onBattleRequest: (army, enemies) => this._onBattleRequest(army, enemies),
      // Встреча со своей армией на не-городской клетке: панель обмена.
      onFriendlyRequest: (army, friendly) => this._onFriendlyRequest(army, friendly),
      // Армия вошла в клетку с руинами: пробуждение монстров.
      onRuinsVisit: (army, city) => this._onRuinsVisit(army, city),
      // Очередь анимаций опустела. Ход человека сам решает, что делать;
      // у ИИ — это сигнал «передать ход следующему игроку».
      onQueueEmpty: () => {
        if (this.humanBrain?.onQueueEmpty?.()) return;
        this._finishPlayerTurn();
      },
    });

    // Контекст для аниматора — заполнится после создания MapView.
    this._moveCtx = null;

    // Текущая встреча своих армий (панель обмена открыта).
    this._pendingEncounter = null;

    // Армия, на которой сейчас стоит фокус (для Ctrl / кнопки «Армия»).
    this._focusedArmy = null;

    // DOM
    this.el = this._render();
    this.parent.appendChild(this.el);

    // карта — вся техника управления живёт в MapView
    this.mapView = new MapView(
      worldMap, this.el.querySelector('#app'), playersModel);
    this.mapView.setWaterEnabled(opts.waterShader !== false);

    this.mapView._onTileClick = (tile) => this._onTileClick(tile);

    // Единственный на всю игру «мозг» игрока-человека.
    this.humanBrain = HumanBrain.get();

    // Панель армии: клик по модельке армии (первый юнит массива) → открывается.
    // Во время хода человека клики по армиям обрабатывает HumanBrain.
    this.armyView = new ArmyView(this.mapView, {
      getPlayers: () => this.playersModel,
      getMapClickEnabled: () => !this.humanBrain?.isActive,
    });

    // Панель города: клик по модельке города на карте → открывается.
    // TownView — singleton, при смене карты сам перепривязывается.
    this.townView = TownView.get(this.mapView, {
      getPlayers: () => this.playersModel,
      getMapClickEnabled: () => !this.humanBrain?.isActive,
      getTurn: () => this.judge?.turn ?? 1,
    });

    // Окно битвы: создаётся один раз, используется повторно при каждой встрече.
    this.battleView = new BattleView({
      getPlayers:   () => this.playersModel,
      getTurnIndex: () => this.judge.currentPlayer?.index ?? -1,
    });

    // Панель обмена юнитами между своими армиями при встрече на маршруте.
    this.armyChangeView = new ArmyChangeView({
      mapView:    this.mapView,
      getPlayers: () => this.playersModel,
      onTransfer: ({ unit, from, to, cost }) => {
        this._log(
          `Обмен: «${unit.name}» перешёл из Армии #${from.id} ` +
          `в Армию #${to.id} (−${cost} стамины).`);
      },
      onArmyEmpty: (army) => {
        this._log(`Армия #${army.id} опустела и расформирована.`);
      },
      onClose: (res) => this._onArmyChangeClosed(res),
    });

    // Город выпустил юнита (см. Judge._doCities): обновляем модель армии
    // на карте (новая армия или изменившийся состав) и пишем в лог.
    this.judge.onCityProduced = (res) => {
      this.mapView?.unitsView?.updateArmy?.(res.army);
      this.mapView?.unitsView?.relayoutCell?.(res.army.x, res.army.y);
      this._log(
        `🏰 ${res.city.name}: произведён «${res.unit.name}»` +
        (res.created ? ' — создана новая армия' : ''), true);
    };

    this._moveCtx = {
      world:     worldMap,
      mapView:   this.mapView,
      routeView: this.mapView.routeView,
      unitsView: this.mapView.unitsView,
    };

    // Подключаем HumanBrain к этому игровому экрану (единственный экземпляр).
    this.humanBrain.attach({
      world:     worldMap,
      mapView:   this.mapView,
      routeView: this.mapView.routeView,
      unitsView: this.mapView.unitsView,
      mover:     this.mover,
      log:       (msg, hl) => this._log(msg, hl),
      requestFinish: () => this._finishPlayerTurn(),
      refreshHud:    () => this._refreshHud(),
      clearFocus:    () => this._clearSelection(),
      // Программный выбор клетки армии, которая сейчас в фокусе.
      focusArmy:     (army) => this._focusArmy(army),
      ui: {
        panel:         this.el.querySelector('#humanTurnPanel'),
        title:         this.el.querySelector('#htpTitle'),
        sub:           this.el.querySelector('#htpSub'),
        btnClearRoute: this.el.querySelector('#btnClearRoute'),
        btnDeselect:   this.el.querySelector('#btnDeselect'),
      },
    });

    // Судья сообщает игре о начале хода игрока:
    // показываем красные маркеры маршрутов и ставим армии в очередь.
    this.judge.onTurnStart = (player) => this._onTurnStart(player);

    this.selected = null;
    this._bindUI();
    this._refreshHud();
    this._log(
`Партия начата. Игроков: ${this.judge.players.length}. Ход ${this.judge.turn}.`);

    // первая камера: старт издалека и подлёт к карте на весь экран
    this.mapView.playIntroCamera();
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

        <div id="humanTurnPanel" style="display:none">
          <div class="htp-head">
            <span class="htp-title" id="htpTitle">—</span>
            <span class="htp-sub" id="htpSub">—</span>
          </div>
          <div class="htp-actions">
            <button id="btnArmyView" disabled title="Ctrl">Армия</button>
            <button id="btnCityView" disabled title="Shift">Город</button>
            <button id="btnClearRoute" disabled>Очистить маршрут</button>
            <button id="btnDeselect" disabled>Снять выбор</button>
          </div>
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
      this._onEndTurnAction();
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

    this.el.querySelector('#btnArmyView').addEventListener('click', () => {
      SND.clickBtn.play();
      this._openArmyView();
    });
    this.el.querySelector('#btnCityView').addEventListener('click', () => {
      SND.clickBtn.play();
      this._openCityView();
    });

    // горячие клавиши
    this._onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Модальные окна перехватывают горячие клавиши игры.
      if (this.armyView?.isOpen || this.townView?.isOpen ||
          this.battleView?.isOpen || this.armyChangeView?.isOpen) return;

      if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && !e.repeat) {
        if (this.humanBrain?.isPlanning) {
          e.preventDefault();
          this._openArmyView();
        }
        return;
      }

      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
        if (this.humanBrain?.isPlanning) {
          e.preventDefault();
          this._openCityView();
        }
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        this._onEndTurnAction();
      }
      // Enter дублирует зелёную кнопку «Следующий круг».
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (this.judge.isAwaitingNextCircle) {
          e.preventDefault();
          this._onEndTurnAction();
        }
      }
      if (e.code === 'Escape') { this._clearSelection(); }
    };
    window.addEventListener('keydown', this._onKey);
  }

  /** Действие кнопки «Следующий круг» (клик, Enter, Space). */
  _onEndTurnAction() {
    if (this.judge.isAwaitingNextCircle) {
      this._onNextCircle();
      return;
    }
    if (this.humanBrain?.isPlanning) {
      this._log('Дождитесь зелёной кнопки «Следующий круг».');
    }
  }

  _refreshHud() {
    const j = this.judge;
    const p = j.currentPlayer;
    const label = this.el.querySelector('#turnLabel');
    const btn   = this.el.querySelector('#btnEndTurn');

    if (j.isAwaitingNextCircle) {
      // Круг завершён — ждём зелёную кнопку, игрок планирует маршруты.
      label.innerHTML =
        `⭕ Круг ${j.turn - 1} завершён · <b>планирование маршрутов</b> — ` +
        `нажмите зелёную кнопку, чтобы начать круг ${j.turn}`;
      btn.disabled    = false;
      btn.textContent = '▶ Следующий круг';
      btn.classList.add('ready');
      this._refreshContextButtons();
      return;
    }

    btn.classList.remove('ready');
    btn.textContent = '▶ Следующий круг';
    btn.disabled    = true;

    if (!p) return;

    const humanMoving = p.isHuman && this.humanBrain?.isActive;
    const role = p.isHuman ? 'Человек' : `ИИ (${p.aiMeta?.name ?? '—'})`;
    label.innerHTML =
      `${this._playerDot(p, 10)} Ход: <b>${p.name}</b> · ${role} · круг ${j.turn}` +
      (humanMoving ? ' · <b>армии идут по маршрутам</b>' : '');

    this._refreshContextButtons();
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

  /** Очистить панель лога (новый круг начинается с чистого листа). */
  _clearLog() {
    const box = this.el.querySelector('#gameLog');
    if (box) box.replaceChildren();
  }

  /* ---------------- игровое действие по клику ---------------- */
  _onTileClick(tile) {
    // Ход человека: клик выбирает свою армию или строит ей маршрут.
    this.humanBrain?.handleTileClick?.(tile);

    this._showTileInfo(tile, { sound: true });
  }

  /**
   * Обновить панель «Выбрано» и запомнить выбранную клетку.
   * @param {Cell} tile
   * @param {Object} [opts]
   * @param {boolean} [opts.sound=false] — проигрывать звук клика по клетке
   */
  _showTileInfo(tile, { sound = false } = {}) {
    if (!tile) return;

    this.selected = tile;

    const info = this.el.querySelector('#selInfo');
    if (!info) return;

    const meta = tile.meta;
    const owner = tile.ownerIndex != null
      ? this.judge.playerByIndex(tile.ownerIndex)
      : null;

    const city = this.worldMap.getCityAt(tile.x, tile.y);

    const ownArmy = this.humanBrain?.selected ?? null;
    const player  = this.humanBrain?.player ?? null;
    const armies  = (tile.army ?? []).filter(a => a && a.alive !== false);
    const cellArmy = armies.find(a => a === ownArmy)
      ?? armies.find(a => a.idOwner === player?.index)
      ?? armies[0]
      ?? null;
    this._focusedArmy = cellArmy ?? ownArmy ?? null;

    if (sound) {
      if (city) SND.clickTown.play();   // клик по клетке с городом
      else      SND.clickCell.play();   // клик по клетке без города
    }

    const cityTypeLabel = city
      ? ({
          provincial: 'провинциальный',
          capital:    'столица',
          fortress:   'крепость',
          backwater:  'захолустье',
          ruins:      'руины',
        }[city.type] ?? city.type)
      : '';

    const cityOwner = city && city.ownerId != null
      ? this.judge.playerByIndex(city.ownerId)
      : null;

    // ── шапка с именем города (если есть) ────────────────────────
    // Кружочек владельца города — прямо в шапке рядом с названием.
    // Руины — не город: у них нет владельца и свой значок.
    const isRuins = city?.type === 'ruins';
    const cityBlock = city
      ? `<div class="city-name"
              style="font-size:16px;font-weight:700;margin:6px 0 2px;">
          ${isRuins ? '🏚' : '🏙'} ${city.name}
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

    this._refreshContextButtons();
  }

  /** Доступность кнопок «Армия» (Ctrl) и «Город» (Shift) в фазе планирования. */
  _refreshContextButtons() {
    const planning = this.humanBrain?.isPlanning === true;
    const btnArmy = this.el?.querySelector('#btnArmyView');
    const btnCity = this.el?.querySelector('#btnCityView');

    if (btnArmy) {
      const hasArmy = !!this._focusedArmy && this._focusedArmy.alive !== false;
      btnArmy.disabled = !(planning && hasArmy);
    }
    if (btnCity) {
      const city = this.selected
        ? this.worldMap?.getCityAt?.(this.selected.x, this.selected.y)
        : null;
      btnCity.disabled = !(planning && city);
    }
  }

  /** Ctrl / кнопка «Армия»: панель просмотра состава армии в фокусе. */
  _openArmyView() {
    const army = this._focusedArmy ?? this.humanBrain?.selected ?? null;
    if (!army || army.alive === false || !army.units?.length) return;
    SND.clickUnit.play();
    this.armyView?.show?.(army);
  }

  /** Shift / кнопка «Город»: панель просмотра выбранной клетки с городом. */
  _openCityView() {
    const city = this.selected
      ? this.worldMap?.getCityAt?.(this.selected.x, this.selected.y)
      : null;
    if (!city) return;
    SND.clickTown.play();
    this.townView?.show?.(city);
  }

  /**
   * Программно выбрать клетку армии, которая сейчас в фокусе
   * (очередь хода / выбор игрока / старт хода бота):
   * кольцо выбора, плавный перелёт камеры и панель «Выбрано».
   * @param {Army} army
   */
  _focusArmy(army) {
    if (!army) return;
    const cell = this.worldMap?.get?.(army.x, army.y);
    if (!cell) return;

    this._focusedArmy = army;
    this._showTileInfo(cell);
    this.mapView?.selectTile?.(cell, { notify: false, soft: true });
    this.mapView?.unitsView?.setSelected?.(army);
  }

  _clearSelection() {
    this.selected = null;
    this._focusedArmy = null;
    this.el.querySelector('#selInfo').textContent = 'Кликни по клетке';
    if (this.mapView.selRing) this.mapView.selRing.visible = false;
    this.mapView?.unitsView?.setSelected?.(null);
    this.humanBrain?.clearSelection?.();
    this._refreshContextButtons();
  }

  /* ---------------- ход: автоматика + зелёная кнопка ---------------- */

  /** Начало хода игрока (зовёт Judge через onTurnStart). */
  _onTurnStart(player) {
    const role = player.isHuman ? 'человек' : `ИИ ${player.aiMeta?.name ?? ''}`;
    this._log(`— Ход: ${player.name} (${role}) —`, true);
    this._refreshHud();

    // Красные маркеры маршрутов на карте.
    // У ИИ маршруты уже построены в Player.doStep через AiBrainHelper.
    this.mapView.routeView.rebuild();

    if (player.isHuman) {
      // Человек: армии сразу идут по маршрутам, построенным в фазе
      // планирования; после круга игрок планирует следующие маршруты.
      this.humanBrain.begin(player);
      return;
    }

    // Армии компьютера идут по маршрутам ПО ОЧЕРЕДИ автоматически.
    this.mover.enqueue(player.army.slice());
  }

  /** Все армии игрока закончили движение → передаём ход. */
  _finishPlayerTurn() {
    // Ход человека (если был) уже завершён; на всякий случай гасим состояние.
    this.humanBrain?.endTurn?.();

    const res = this.judge.finishCurrentTurn();
    if (!res) return;

    this._log(`Ход завершён: ${res.prev.name} → ${res.next.name}`);

    // Круг замкнулся: зелёная кнопка + планирование маршрутов человеком.
    if (this.judge.isAwaitingNextCircle) {
      const human = this.judge.players.find(p => p.isHuman) ?? null;
      if (human) this.humanBrain?.beginPlanning?.(human);
      this._log(
        `⭕ Круг завершён. Можно планировать маршруты и нажать ` +
        `зелёную кнопку — начать круг ${this.judge.turn}.`,
        true);
    }

    this._refreshHud();
    this._clearSelection();
  }

  /* ---------------- встречи своих армий ---------------- */

  /**
   * Идущая армия встретила свою армию на не-городской клетке
   * (зовёт ArmyMover через onFriendlyRequest).
   * Панель открывается только игроку-человеку; ИИ просто останавливается.
   * @param {Army} army     — армия, которая делает ход
   * @param {Army} friendly — своя армия, стоящая на следующей клетке
   */
  _onFriendlyRequest(army, friendly) {
    const p = this.judge.playerByIndex(army.idOwner);
    const human = p?.isHuman === true;

    this._log(
      `🤝 Армия #${army.id} встретила свою армию #${friendly.id}` +
      (p ? ` (${p.name})` : '') +
      (human ? ' — обмен юнитами.' : ' — армия остановлена.'), true);

    if (!human) return;

    const opened = this.armyChangeView.show(army, friendly);
    if (!opened) {
      this._log(`Армия #${army.id}: панель обмена не открылась — армия остановлена.`);
      return;
    }

    this.mover.pauseForEncounter(army);
    this.humanBrain?.onEncounterStart?.(army);
    this._pendingEncounter = { army, friendly };
  }

  /** Панель обмена закрыта: снять паузу и завершить ход армии. */
  _onArmyChangeClosed(res) {
    const pending = this._pendingEncounter;
    this._pendingEncounter = null;
    if (!pending) return;

    this._log(
      res?.changed
        ? `Обмен завершён: Армия #${pending.army.id} ⇄ Армия #${pending.friendly.id}.`
        : `Обмен отменён: Армия #${pending.army.id} ⇄ Армия #${pending.friendly.id}.`,
      res?.changed);

    this.mover.resumeFromEncounter();
  }

  /* ---------------- руины ---------------- */

  /**
   * Армия вошла в клетку с руинами (зовёт ArmyMover через onRuinsVisit).
   * Генерация монстров детерминирована и живёт в core/ruins.js.
   * Панель руин открывается только игроку-человеку.
   * @param {Army}  army
   * @param {object} city — руины
   */
  _onRuinsVisit(army, city) {
    const res = visitRuins(this.worldMap, army, city, this.judge?.turn ?? 1);
    if (!res) return;

    const p = this.judge.playerByIndex(army.idOwner);
    const human = p?.isHuman === true;

    if (res.visited) {
      const monsterName = res.monsters?.[0]?.name ?? res.typeKey ?? 'монстры';
      this._log(
        `🏚 Руины «${city.name}»: пробуждены монстры — ` +
        `${monsterName} ×${res.count}.`, human);
    } else if (res.reason === 'cooldown') {
      this._log(
        `🏚 Руины «${city.name}»: ещё спят ${res.cooldownLeft} кр.`, false);
    }

    if (!human) return;
    this.townView?.show?.(city, {
      visit: res,
      // Монстры присоединяются к армии только после закрытия окна руин.
      onClose: (res.visited && res.monsters?.length)
        ? () => this._claimRuinsMonsters(army, city, res)
        : null,
    });
  }

  /**
   * Закрыть окно руин: все найденные монстры переходят в армию.
   * @param {Army}   army — армия, посетившая руины
   * @param {object} city — руины
   * @param {object} res  — результат core/ruins.visitRuins()
   */
  _claimRuinsMonsters(army, city, res) {
    if (!res || res.claimed) return;
    res.claimed = true;

    const monsters = res.monsters ?? [];
    if (monsters.length === 0) return;

    if (!army || army.alive === false) {
      this._log(`🏚 Руины «${city.name}»: армия не дождалась монстров.`, false);
      return;
    }

    const joined = [];
    for (const unit of monsters) {
      if (army.addUnit(unit)) joined.push(unit);
    }

    if (joined.length === monsters.length && city.ruins) {
      city.ruins.lastMonsters = [];
    }

    if (joined.length > 0) {
      this.mapView?.unitsView?.updateArmy?.(army);
      SND.clickUnit.play();
      this._log(
        `🏚 Армия #${army.id} забрала из руин: ` +
        `${joined[0].name ?? res.typeKey ?? 'монстры'} ×${joined.length}.`, true);
    }

    if (joined.length < monsters.length) {
      this._log(
        `⚠ В армии #${army.id} не хватило места: ` +
        `${monsters.length - joined.length} монстров остались в руинах.`, false);
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

    // Если ход человека — приостанавливаем передачу управления армиям.
    this.humanBrain?.onBattleStart?.(attacker);

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
      // Остальные армии в клетке сдвигаются на свободные углы.
      this.mapView.unitsView.relayoutCell?.(loser.x, loser.y);
      const lp = this.judge.playerByIndex(loser.idOwner);
      this._log(
        `☠ Армия #${loser.id} уничтожена; победила армия #${winner.id}` +
        (lp ? ` (${lp.name})` : ''), true);
    }

    // Ход человека: бой завершён — армия закончила действие.
    this.humanBrain?.onBattleEnd?.(winner, loser);

    // Гарнизон города уничтожен — победитель занимает город.
    // Повторный onArmyArrive теперь не видит вражеских армий и выполняет
    // захват; визуально поднимаем флаг цвета победителя.
    if (winner) {
      const cell = this.worldMap?.get?.(winner.x, winner.y);
      const captured = cell?.onArmyArrive?.(winner);
      if (captured) {
        const city = this.worldMap.getCityAt(winner.x, winner.y);
        if (city) this.mapView?.setCityOwner?.(city, winner.idOwner, { raised: true });
      }
    }

    this.mapView.unitsView.updateArmy?.(winner);
    this.mapView.routeView.rebuild();
  }

  /** Зелёная кнопка HUD (и пробел): запустить следующий круг. */
  _onNextCircle() {
    if (!this.judge.isAwaitingNextCircle) return;  // активно только между кругами
    this.humanBrain?.endPlanning?.();              // закрыть режим планирования
    this._clearSelection();                        // снять фокус планирования
    this._clearLog();                              // новый круг — чистая панель лога
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

  setWaterEnabled(enabled) {
    this.mapView?.setWaterEnabled?.(enabled);
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
    this.humanBrain?.detach?.();
    this.armyView?.destroy?.();
    this.townView?.destroy?.();
    this.battleView?.destroy?.();
    this.armyChangeView?.destroy?.();
    this._pendingEncounter = null;
    this.mapView?.destroy?.();
    this.el.remove();
  }

}