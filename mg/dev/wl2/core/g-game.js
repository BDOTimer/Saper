/// core/g-game.js
///
/// Описание:
///  -  Отобразить в цикле анимированный экран Игры.
///  -  g-judge владеет всеми игроками и применяет к ним правила игры.
///  -  world-map отображает мир.
///  -  players.js отображает всех

import { mulberry32, fbm } from './rng.js';
import { MapView  } from '../render/r-map-view.js';
import { Judge    } from './g-judge.js';
import { WorldMap } from './world.js';

///----------------------------------------------------------------------------|
/// Созаётся когда нажимается кнопка НАЧАТЬ ИГРУ
///----------------------------------------------------------------------------:
export class Game {
  /**
   * @param {WorldMap} worldMap
   * @param {Players}  playersModel  — модель с составом (после PanelPlayers.onConfirm)
   * @param {Object}   [opts]
   * @param {HTMLElement} [opts.parent]  — куда монтировать
   * @param {Function}    [opts.onExit]  — выход в меню
   */
  constructor(worldMap, playersModel, opts = {}) {
    this.worldMap = worldMap;
    this.playersModel = playersModel;
    this.parent = opts.parent ?? document.body;
    this.onExit = opts.onExit ?? (() => {});

    this.judge = new Judge(worldMap, playersModel);

    this.territories = WorldMap.distributeTerritoriesAndCapitals(
      this.worldMap,
      this.playersModel,
      { allowEmpty: true }
    );

    // DOM
    this.el = this._render();
    this.parent.appendChild(this.el);

    // карта — вся техника управления живёт в MapView
    this.mapView = new MapView(
      worldMap, this.el.querySelector('#app'), playersModel);
      
    this.mapView._onTileClick = (tile) => this._onTileClick(tile);
    this.mapView.lowerAllFlags(600); // Опустить все флаги...

    this.selected = null;
    this._bindUI();
    this._refreshHud();
    this._log(`Партия начата. Игроков: ${this.judge.players.length}. Ход ${this.judge.turn}.`);

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
        <div id="gameTopbar">
          <button id="btnExitGame">← В меню</button>
          <div class="turn-label" id="turnLabel">—</div>
          <button id="btnEndTurn" class="primary">Завершить ход</button>
          <button id="btnCamOrbit" class="active">Орбита</button>
          <button id="btnCamTop">Сверху</button>
        </div>

        <div id="gameSidePanel">
          <h3>Выбрано</h3>
          <div class="muted" id="selInfo">Кликни по клетке</div>
        </div>

        <div id="gameLog"></div>
      </div>
    `;
    return root;
  }

  _bindUI() {
    this.el.querySelector('#btnExitGame').addEventListener('click', () => {
      this.onExit();
    });
    this.el.querySelector('#btnEndTurn').addEventListener('click', () => {
      this._endTurn();
    });

    const btnOrbit = this.el.querySelector('#btnCamOrbit');
    const btnTop   = this.el.querySelector('#btnCamTop');
    btnOrbit.addEventListener('click', () => {
      btnOrbit.classList.add('active'); btnTop.classList.remove('active');
      this.mapView.setCameraMode('orbit');
    });
    btnTop.addEventListener('click', () => {
      btnTop.classList.add('active'); btnOrbit.classList.remove('active');
      this.mapView.setCameraMode('top');
    });

    // горячие клавиши
    this._onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); this._endTurn(); }
      if (e.code === 'Escape') { this._clearSelection(); }
    };
    window.addEventListener('keydown', this._onKey);
  }

  _refreshHud() {
    const j = this.judge;
    const p = j.currentPlayer;
    if (!p) return;
    const role = p.isHuman ? 'Человек' : `ИИ (${p.aiMeta?.name ?? '—'})`;
    const color = '#' + p.color.toString(16).padStart(6, '0');

    this.el.querySelector('#turnLabel').innerHTML =
      `<span class="dot" style="background:${color}"></span>
       Ход: <b>${p.name}</b> · ${role} · круг ${j.turn}`;

    // кнопка «Завершить ход» активна только на ходу человека
    const btn = this.el.querySelector('#btnEndTurn');
    btn.disabled = !p.isHuman;
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

    // ⬅️ город на этой клетке (через WorldMap)
    const city = this.worldMap.getCityAt(tile.x, tile.y);

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

    // ⬅️ ИМЯ ГОРОДА — отдельным блоком сверху, если город есть
    const cityBlock = city
      ? `<div class="city-name" style="font-size:16px;font-weight:700;margin:6px 0 2px;">
           🏙 ${city.name}
         </div>
         <div class="muted" style="margin-bottom:6px;">${cityTypeLabel}</div>`
      : '';

    info.innerHTML = `
      ${cityBlock}
      <div>Клетка (${tile.x}, ${tile.y})</div>
      <div>${meta.name} · stamina ${tile.staminaCost}</div>
      <div>${tile.hasRoad ? 'Дорога ' : ''}${tile.hasRiver ? 'Река' : ''}</div>
      ${owner ? `<div>Владелец клетки: <b>${owner.name}</b></div>` : ''}
      ${cityOwner ? `<div>Владелец города: <b>${cityOwner.name}</b></div>` : ''}
    `;
  }

  _clearSelection() {
    this.selected = null;
    this.el.querySelector('#selInfo').textContent = 'Кликни по клетке';
    if (this.mapView.selRing) this.mapView.selRing.visible = false;
  }

  /* ---------------- ход ---------------- */
  _endTurn() {
    const j = this.judge;
    if (!j.isHumanTurn) return;   // ИИ не даём завершать вручную

    const prev = j.currentPlayer;
    const next = j.endTurn();
    this._log(`Ход завершён: ${prev.name} → ${next.name}`);
    this._refreshHud();
    this._clearSelection();

    // если следующий — ИИ, через паузу запускаем его «мозг»
    if (next.isAI) this._runAiTurn(next);
  }

  _runAiTurn(aiPlayer) {
    this._log(`ИИ (${aiPlayer.name}) думает...`);
    setTimeout(() => {
      // TODO: реальный ИИ. Пока просто мгновенный пас.
      this._log(`ИИ (${aiPlayer.name}) завершил ход`);
      const prev = aiPlayer;
      const next = this.judge.endTurn();
      this._log(`Ход завершён: ${prev.name} → ${next.name}`);
      this._refreshHud();
      if (next.isAI) this._runAiTurn(next);
    }, 600);
  }

  /* ---------------- API ---------------- */
  destroy() {
    window.removeEventListener('keydown', this._onKey);
    this.mapView?.destroy?.();
    this.el.remove();
  }
}