// render/army-change-view.js
//
//  ТЗ:
//  - Две и более армии не могут стоят на одной и той же клетке, если эта клетка не город.
//  - Когда армия делает ходы по маршруту и на клетке маршрута
//          всречает армию своего игрока:
//      -   открывается панель ArmyChangeView
//      -   это панель похожа на панель army-view.js
//      -   на панели ArmyChangeView отображаются две армии
//      -   армия-1 которая делает ход + армия-2 котора стоит на маршруте  армия-1
//      -   юниты армия-1 и армия-2 кликабельные
//      -   можно кликом выбрать юнита загорается кнопка ПЕРЕМЕСТИТЬ
//      -   если кликнуть по кнопке ПЕРЕМЕСТИТЬ, то юнит перемещается между армиями.
//      -   процедура перемещения работает в обе стороны(при наличии стамины)
//      -   перемещение имеет стоимость стамины юнита должна быть большее,
//          чем стамина клетки в армию которой юнит перемещается.
//      -   если стамина у юнита кончилась, то имеется индикатор, который покажет это.
//
//  Реализация:
//  -   панель модальная, переиспользуется между встречами (создаётся один раз);
//  -   show(armyMoving, armyStanding, opts) — армия-1 делает ход, армия-2 стоит;
//  -   обе армии рисуются в одной мини-сцене двумя рядами: сверху — армия-1,
//      снизу — армия-2. Клик по фигурке выбирает юнита;
//  -   кнопка ПЕРЕМЕСТИТЬ переносит выбранного юнита в соседнюю армию.
//      Стоимость перехода = Cell.staminaCost клетки принимающей армии.
//      У юнита должно быть БОЛЬШЕ стамины, чем эта стоимость (ТЗ).
//  -   над юнитом висит бейдж стамины; при 0 он пульсирует красным.

import * as THREE from 'three';
import { skinForPlayer, disposeTree } from './r-units-view.js';
import { SND } from '../res/snd/--sound-lib.js';
import { MAX_ARMY_SIZE } from '../core/units.js';

/** Шаг сетки между юнитами в ряду (мировые единицы мини-сцены). */
const ROW_SPACING = 0.8;

/** Максимальная ширина ряда: при большом стеке шаг уменьшается. */
const MAX_ROW_WIDTH = 11;

/** Базовый масштаб фигурки в ряду. */
const ROW_SCALE = 0.7;

/** Масштаб выбранной фигурки. */
const SELECTED_SCALE = ROW_SCALE * 1.45;

/** Скорость вращения выбранной фигурки, рад/с. */
const SPIN_SPEED = 1.4;

/** Длительность анимации скейла и доворота к камере, мс. */
const SELECT_ANIM_MS = 240;

/** Половина расстояния между рядами армий по Z. */
const ROW_Z = 1.45;

const STYLE_ID = 'army-change-view-styles';

const CSS = `

/* скроллбары под общий тёмный стиль панели */
.acv-backdrop * {
  scrollbar-width: thin;
  scrollbar-color: #2a3440 #141925;
}
.acv-backdrop *::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.acv-backdrop *::-webkit-scrollbar-track {
  background: #141925;
  border-radius: 6px;
}
.acv-backdrop *::-webkit-scrollbar-thumb {
  background: #2a3440;
  border-radius: 6px;
  border: 2px solid #141925;
}
.acv-backdrop *::-webkit-scrollbar-thumb:hover {
  background: #3a4755;
}
.acv-backdrop *::-webkit-scrollbar-corner {
  background: #141925;
}

.acv-backdrop {
  position: fixed; inset: 0;
  background: rgba(8, 10, 16, .6);
  backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1050;
  opacity: 0; pointer-events: none;
  transition: opacity .18s ease;
}
.acv-backdrop.open { opacity: 1; pointer-events: auto; }

.acv-panel {
  width: 84vw; height: 74vh;
  min-width: 680px; min-height: 400px;
  background:
    linear-gradient(160deg, rgba(27,33,48,.55) 0%, rgba(20,25,37,.72) 100%),
    url("./res/img/bg1.jpg") center / cover no-repeat;
  color: #e8ecf3;
  border: 1px solid rgba(120,150,200,.25);
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.02) inset;
  display: flex; flex-direction: column;
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  transform: translateY(6px) scale(.98);
  transition: transform .2s ease;
  overflow: hidden;
}
.acv-backdrop.open .acv-panel { transform: translateY(0) scale(1); }

.acv-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(120,150,200,.18);
  background: rgba(255,255,255,.02);
}
.acv-swatch {
  width: 14px; height: 14px; border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(0,0,0,.35) inset, 0 0 12px currentColor;
  flex: 0 0 auto;
}
.acv-title  { font-size: 16px; font-weight: 700; letter-spacing: .2px; }
.acv-sub    { font-size: 12px; color: #97a3b6; }
.acv-vs     { color: #ffd166; font-size: 18px; font-weight: 700; padding: 0 2px; }

.acv-close {
  margin-left: auto;
  height: 32px; padding: 0 14px; border-radius: 8px;
  border: 1px solid rgba(120,150,200,.3);
  background: rgba(255,255,255,.03);
  color: #cfd7e3; cursor: pointer; font-size: 12px; font-weight: 700;
  letter-spacing: .04em;
  display: grid; place-items: center;
  transition: background .15s, color .15s, transform .1s;
}
.acv-close:hover  { background: rgba(220,80,80,.15); color: #ff9a9a; }
.acv-close:active { transform: scale(.95); }

.acv-body {
  flex: 1 1 auto; min-height: 0;
  display: grid;
  grid-template-columns: 232px 1fr 232px;
}
@media (max-width: 900px) {
  .acv-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  .acv-side--a { border-right: none; border-bottom: 1px solid rgba(120,150,200,.15); }
  .acv-side--b { border-left: none; border-top: 1px solid rgba(120,150,200,.15); }
}

.acv-side {
  padding: 14px;
  overflow: auto;
  background: rgba(255,255,255,.015);
  min-height: 0;
}
.acv-side--a { border-right: 1px solid rgba(120,150,200,.15); }
.acv-side--b { border-left: 1px solid rgba(120,150,200,.15); }

.acv-main {
  padding: 12px;
  min-height: 0;
  display: flex;
}
.acv-canvas-wrap {
  position: relative;
  flex: 1 1 auto;
  min-height: 180px;
  background:
    linear-gradient(rgba(13,18,24,.35), rgba(13,18,24,.55)),
    url("./res/img/bg2.jpg") center / cover no-repeat;
  border: 1px solid rgba(120,150,200,.18);
  border-radius: 10px;
  overflow: hidden;
}
.acv-canvas {
  display: block; width: 100%; height: 100%;
  cursor: pointer;
}
.acv-canvas-divider {
  position: absolute; left: 6%; right: 6%; top: 50%;
  height: 1px; pointer-events: none;
  background: linear-gradient(90deg,
    transparent, rgba(120,150,200,.28), transparent);
}

.acv-army-head {
  display: flex; align-items: flex-start; gap: 9px;
  margin-bottom: 12px;
}
.acv-dot {
  width: 12px; height: 12px; border-radius: 50%;
  margin-top: 3px;
  box-shadow: 0 0 0 2px rgba(0,0,0,.35) inset, 0 0 12px currentColor;
  flex: 0 0 auto;
}
.acv-army-head-text { min-width: 0; }
.acv-army-title { font-size: 14px; font-weight: 700; }
.acv-army-sub { font-size: 11px; color: #97a3b6; margin-top: 3px; }

.acv-tag {
  display: inline-block;
  padding: 1px 7px; border-radius: 999px;
  font-size: 10px; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase;
}
.acv-tag.move {
  background: rgba(46,139,255,.18);
  border: 1px solid rgba(46,139,255,.4);
  color: #8fc1ff;
}
.acv-tag.stand {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(120,150,200,.25);
  color: #aab5c6;
}

.acv-section h4 {
  margin: 14px 0 8px;
  font-size: 11px; text-transform: uppercase; letter-spacing: .12em;
  color: #7f8da3; font-weight: 600;
}
.acv-section:first-of-type h4 { margin-top: 0; }

.acv-row {
  display: flex; justify-content: space-between; gap: 10px;
  padding: 4px 0;
  border-bottom: 1px dashed rgba(120,150,200,.12);
  font-size: 12.5px;
}
.acv-row .k { color: #8d9bb1; }
.acv-row .v { color: #e8ecf3; font-variant-numeric: tabular-nums; text-align: right; }
.acv-row .v.good { color: #7ee0a0; }
.acv-row .v.warn { color: #f0b070; }
.acv-row .v.bad  { color: #ff8a8a; }

.acv-unit-stats {
  padding: 9px 10px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(120,150,200,.18);
  border-radius: 8px;
  min-height: 76px;
  font-size: 12.5px;
  line-height: 1.5;
}
.acv-unit-name { font-weight: 700; margin-bottom: 5px; }
.acv-muted { color: #8a97a5; font-style: italic; }
.acv-star { color: #ffd166; font-weight: 700; margin-left: 4px; }
.acv-badge-bad {
  display: inline-block;
  padding: 0 6px; border-radius: 999px;
  background: rgba(220,60,60,.18);
  border: 1px solid rgba(255,100,100,.45);
  color: #ff8a8a;
  font-size: 10px; font-weight: 700; letter-spacing: .05em;
  vertical-align: middle;
}

.acv-footer {
  display: flex; align-items: center; gap: 14px;
  padding: 10px 18px;
  border-top: 1px solid rgba(120,150,200,.18);
  background: rgba(255,255,255,.02);
  min-height: 52px;
}
.acv-status {
  flex: 1 1 auto;
  font-size: 12.5px; color: #aab5c6;
  line-height: 1.35;
}
.acv-status.good { color: #9fe0b8; }
.acv-status.bad  { color: #ff9a9a; }

.acv-btn-transfer {
  height: 40px; padding: 0 26px;
  border-radius: 9px;
  border: 1px solid rgba(120,150,200,.3);
  background: rgba(255,255,255,.04);
  color: #7f8da3;
  font-size: 13px; font-weight: 800; letter-spacing: .08em;
  cursor: not-allowed;
  transition: background .15s, color .15s, box-shadow .15s, transform .1s;
}
.acv-btn-transfer.ready {
  cursor: pointer;
  color: #1a1408;
  border-color: rgba(255,209,102,.85);
  background: linear-gradient(180deg, #ffe08a, #f0c040);
  box-shadow: 0 0 18px rgba(255,209,102,.45), 0 2px 10px rgba(0,0,0,.35);
}
.acv-btn-transfer.ready:hover  { filter: brightness(1.08); }
.acv-btn-transfer.ready:active { transform: scale(.97); }
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* =========================================================
   ArmyChangeView — панель обмена юнитами между двумя армиями.
   ========================================================= */
export class ArmyChangeView {
  /**
   * Создаётся один раз и используется повторно при каждой встрече.
   *
   * Допустимы оба варианта вызова:
   *   new ArmyChangeView({ mapView, getPlayers, ... })
   *   new ArmyChangeView(mapView, { getPlayers, ... })
   *
   * @param {Object|MapView} [mapViewOrOpts]
   * @param {Object} [maybeOpts]
   */
  constructor(mapViewOrOpts = null, maybeOpts = {}) {
    const looksLikeMapView = !!(mapViewOrOpts &&
      (mapViewOrOpts.renderer || mapViewOrOpts.world || mapViewOrOpts.unitsView));
    const opts = looksLikeMapView ? (maybeOpts ?? {}) : (mapViewOrOpts ?? {});

    this.mapView    = looksLikeMapView ? mapViewOrOpts : (opts.mapView ?? null);
    this.getPlayers = opts.getPlayers ?? (() => this.mapView?.players ?? null);

    this._defaultOpts = {
      world:       opts.world       ?? null,
      getCellCost: opts.getCellCost ?? null,
      onClose:     opts.onClose     ?? null,
      onTransfer:  opts.onTransfer  ?? null,
      onArmyEmpty: opts.onArmyEmpty ?? null,
    };
    this._opts = { ...this._defaultOpts };

    this._raycaster = new THREE.Raycaster();
    this._mouse     = new THREE.Vector2();

    this._open      = false;
    this._armyA     = null;   // армия, которая делает ход
    this._armyB     = null;   // армия, которая стоит на маршруте
    this._selected  = null;   // { holder, unit, army, side, index }
    this._nodesA    = [];
    this._nodesB    = [];
    this._allNodes  = [];
    this._selRing   = null;
    this._raf       = null;
    this._changed   = false;
    this._emptied   = [];
    this._spacing   = ROW_SPACING;

    this._defaultHint =
      'Кликните по юниту любой армии — загорится кнопка ПЕРЕМЕСТИТЬ. ' +
      'Стоимость перехода — стамина клетки принимающей армии.';

    ensureStyles();
    this._buildPanel(opts.container ?? document.body);
  }

  get isOpen() { return this._open; }

  /**
   * Нужно ли открывать панель при встрече армий.
   * Панель нужна только для армий одного игрока на клетке БЕЗ города
   * (в городе несколько армий могут стоять одновременно).
   *
   * @param {Object} world
   * @param {Army} armyMoving
   * @param {Army} armyStanding
   * @returns {boolean}
   */
  static shouldOpen(world, armyMoving, armyStanding) {
    if (!armyMoving || !armyStanding || armyMoving === armyStanding) return false;
    if (armyMoving.idOwner !== armyStanding.idOwner) return false;

    const cell = world?.get?.(armyStanding.x, armyStanding.y);
    if (!cell) return false;

    const city = world?.getCityAt?.(armyStanding.x, armyStanding.y);
    return !(city || (cell.city ?? -1) >= 0);
  }

  /* =========================================================
     DOM панели
     ========================================================= */
  _buildPanel(container) {
    const back = document.createElement('div');
    back.className = 'acv-backdrop';
    this._root = back;

    const panel = document.createElement('div');
    panel.className = 'acv-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    back.appendChild(panel);

    /* ---------- header ---------- */
    const head = document.createElement('div');
    head.className = 'acv-header';

    const swA = document.createElement('span');
    swA.className = 'acv-swatch';
    this._swA = swA;

    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'acv-title';
    title.textContent = 'Обмен юнитами';
    this._titleEl = title;

    const sub = document.createElement('div');
    sub.className = 'acv-sub';
    sub.textContent = '—';
    this._subEl = sub;

    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);

    const vs = document.createElement('span');
    vs.className = 'acv-vs';
    vs.textContent = '⇄';

    const swB = document.createElement('span');
    swB.className = 'acv-swatch';
    this._swB = swB;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'acv-close';
    close.title = 'Закрыть (Esc)';
    close.textContent = 'ЗАКРЫТЬ';
    close.addEventListener('click', () => this.close());

    head.appendChild(swA);
    head.appendChild(titleWrap);
    head.appendChild(vs);
    head.appendChild(swB);
    head.appendChild(close);
    panel.appendChild(head);

    /* ---------- body ---------- */
    const body = document.createElement('div');
    body.className = 'acv-body';
    panel.appendChild(body);

    this._sideA = this._buildSide('A');
    body.appendChild(this._sideA.el);

    const main = document.createElement('main');
    main.className = 'acv-main';
    body.appendChild(main);

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'acv-canvas-wrap';
    main.appendChild(canvasWrap);

    const canvas = document.createElement('canvas');
    canvas.className = 'acv-canvas';
    canvas.addEventListener('pointerdown', (e) => this._onCanvasClick(e));
    this._canvas = canvas;
    canvasWrap.appendChild(canvas);

    const divider = document.createElement('div');
    divider.className = 'acv-canvas-divider';
    canvasWrap.appendChild(divider);

    this._sideB = this._buildSide('B');
    body.appendChild(this._sideB.el);

    /* ---------- footer ---------- */
    const footer = document.createElement('div');
    footer.className = 'acv-footer';
    panel.appendChild(footer);

    const status = document.createElement('div');
    status.className = 'acv-status';
    this._statusEl = status;
    footer.appendChild(status);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'acv-btn-transfer';
    btn.textContent = 'ПЕРЕМЕСТИТЬ';
    btn.disabled = true;
    btn.addEventListener('click', () => this._transferSelected());
    this._btnTransfer = btn;
    footer.appendChild(btn);

    /* ---------- закрытие ---------- */
    back.addEventListener('click', (e) => {
      if (e.target === back) this.close();
    });
    this._onEsc = (e) => {
      if (e.key === 'Escape' && this._open) this.close();
    };
    document.addEventListener('keydown', this._onEsc);

    container.appendChild(back);

    /* ---------- мини-рендерер ---------- */
    this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setClearColor(0x000000, 0);
  }

  /** Боковая карточка армии. */
  _buildSide(side) {
    const el = document.createElement('aside');
    el.className = `acv-side acv-side--${side.toLowerCase()}`;
    el.innerHTML = `
      <div class="acv-army-head">
        <span class="acv-dot"></span>
        <div class="acv-army-head-text">
          <div class="acv-army-title">—</div>
          <div class="acv-army-sub">—</div>
        </div>
      </div>
      <div class="acv-section">
        <h4>Армия</h4>
        <div class="acv-army-stats"></div>
      </div>
      <div class="acv-section">
        <h4>Юнит</h4>
        <div class="acv-unit-stats">
          <div class="acv-muted">Кликните по юниту в центре.</div>
        </div>
      </div>
    `;

    return {
      el,
      dot:       el.querySelector('.acv-dot'),
      title:     el.querySelector('.acv-army-title'),
      sub:       el.querySelector('.acv-army-sub'),
      stats:     el.querySelector('.acv-army-stats'),
      unitStats: el.querySelector('.acv-unit-stats'),
    };
  }

  /* =========================================================
     Открытие / закрытие
     ========================================================= */
  /**
   * Показать панель обмена.
   *
   * @param {Army} armyMoving   — армия-1, которая делает ход
   * @param {Army} armyStanding — армия-2, которая стоит на маршруте
   * @param {Object} [opts]     — onClose/onTransfer/onArmyEmpty на один показ
   * @returns {boolean}
   */
  show(armyMoving, armyStanding, opts = {}) {
    if (!this._root) return false;
    if (!armyMoving || !armyStanding) return false;
    if (armyMoving === armyStanding) return false;
    if (!armyMoving.alive || !armyStanding.alive) return false;

    if (this._open) this.close(true);

    this._armyA   = armyMoving;
    this._armyB   = armyStanding;
    this._opts    = { ...this._defaultOpts, ...opts };
    this._changed = false;
    this._emptied = [];
    this._selected = null;
    this._open    = true;

    this._buildScene();
    this._refreshHeader();
    this._refreshArmyCards();
    this._refreshSelectedStats();
    this._refreshTransferState();

    this._root.classList.add('open');
    this._startLoop();
    return true;
  }

  /** Псевдоним show() — удобно, если вызывающий код говорит «открыть». */
  open(armyMoving, armyStanding, opts = {}) {
    return this.show(armyMoving, armyStanding, opts);
  }

  /**
   * Закрыть панель.
   * @param {boolean} [force=false] — без звука и без onClose (переиспользование/destroy)
   */
  close(force = false) {
    const wasOpen = this._open;
    if (!wasOpen && !force) return;

    if (wasOpen && !force) SND.winClose.play();

    this._open = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }

    this._selected = null;
    this._selRing  = null;

    this._cleanupEmptyArmies();
    this._disposeScene();

    this._nodesA.length   = 0;
    this._nodesB.length   = 0;
    this._allNodes.length = 0;

    this._root?.classList.remove('open');

    const res = {
      armyA:   this._armyA,
      armyB:   this._armyB,
      changed: this._changed,
      emptied: this._emptied.slice(),
    };
    const opts = this._opts;

    this._armyA   = null;
    this._armyB   = null;
    this._changed = false;
    this._emptied = [];
    this._opts    = { ...this._defaultOpts };

    if (wasOpen && !force) opts?.onClose?.(res);
  }

  destroy() {
    this.close(true);
    document.removeEventListener('keydown', this._onEsc);
    this._renderer?.forceContextLoss?.();
    this._renderer?.dispose?.();
    this._renderer = null;
    this._root?.remove?.();
    this._root = null;
  }

  /* =========================================================
     Мини-сцена: два ряда юнитов
     ========================================================= */
  _buildScene() {
    this._disposeScene();

    const scene = new THREE.Scene();
    this._scene = scene;

    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const dir = new THREE.DirectionalLight(0xffffff, 0.95);
    dir.position.set(3, 6, 4);
    scene.add(dir);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.22);
    backLight.position.set(-4, 3, -3);
    scene.add(backLight);

    const countA = this._armyA.units.filter(u => u.alive).length;
    const countB = this._armyB.units.filter(u => u.alive).length;
    const maxCount = Math.max(countA, countB, 1);

    // При большом стеке ряд сужается, чтобы обе армии влезли в кадр.
    this._spacing = Math.min(ROW_SPACING, MAX_ROW_WIDTH / maxCount);
    const plateW = Math.max(2.4, maxCount * this._spacing + 1.2);

    scene.add(this._makePlate(this._playerColor(this._armyA), -ROW_Z, plateW));
    scene.add(this._makePlate(this._playerColor(this._armyB),  ROW_Z, plateW));

    // кольцо выбора юнита
    const ringGeo = new THREE.RingGeometry(0.34, 0.40, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this._selRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 })
    );
    this._selRing.visible = false;
    scene.add(this._selRing);

    this._nodesA = this._buildArmyRow(this._armyA, 'A', -ROW_Z);
    this._nodesB = this._buildArmyRow(this._armyB, 'B',  ROW_Z);
    this._allNodes = [...this._nodesA, ...this._nodesB];

    this._rowCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this._rowCam.position.set(0, 4.0, 4.6);
    this._rowCam.lookAt(0, 0.5, 0);

    this._fitCamera();
    this._rowCam.updateMatrixWorld(true);
  }

  _buildArmyRow(army, side, rowZ) {
    const colorHex = this._playerColor(army);
    const skin = skinForPlayer(army.idOwner);
    const units = army.units.filter(u => u.alive);
    const n = units.length;
    const nodes = [];

    units.forEach((u, slot) => {
      const holder = new THREE.Group();

      const mesh = skin.build(u.typeKey, colorHex);
      holder.add(mesh);

      const badge = this._makeStaminaBadge(u);
      holder.add(badge);

      holder.scale.setScalar(ROW_SCALE);
      holder.position.set((slot - (n - 1) / 2) * this._spacing, 0, rowZ);

      holder.userData = {
        type: 'unit',
        unit: u,
        army,
        side,
        slot,
        index: army.units.indexOf(u),
        spin: false,
        scaleAnim: null,
        rotAnim: null,
        badge,
      };

      this._scene.add(holder);
      nodes.push(holder);
    });

    return nodes;
  }

  _makePlate(colorHex, z, width) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(width, 1.8);
    const plate = new THREE.Mesh(geo, mat);
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(0, 0.005, z);
    return plate;
  }

  /**
   * Бейдж стамины над юнитом. При 0 — красный и пульсирует (см. _updateBadges).
   */
  _makeStaminaBadge(unit) {
    const stamina = unit.moveLeft ?? 0;
    const exhausted = stamina <= 0;
    const low = !exhausted && stamina <= 2;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 56;
    const ctx = canvas.getContext('2d');

    const bg = exhausted ? 'rgba(120,20,20,.92)' : 'rgba(10,14,18,.85)';
    const border = exhausted ? '#ff6b6b' : (low ? '#f0b070' : '#7ee0a0');
    const textColor = exhausted ? '#ffb0b0' : (low ? '#f0c080' : '#a8f0c0');

    ctx.fillStyle = bg;
    roundRect(ctx, 2, 2, 124, 52, 12);
    ctx.fill();

    ctx.strokeStyle = border;
    ctx.lineWidth = 2.5;
    roundRect(ctx, 2, 2, 124, 52, 12);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`⚡${stamina}`, 64, 29);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(0.95, 0.42, 1);
    spr.position.set(0, 1.24, 0);
    spr.userData = { type: 'stamina-badge', unit };
    return spr;
  }

  /** Подгон фрустума мини-камеры под ширину рядов и размер канваса. */
  _fitCamera() {
    if (!this._rowCam || !this._canvas) return;

    const w = this._canvas.clientWidth;
    const h = this._canvas.clientHeight;
    if (!w || !h) return;

    const size = this._renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) this._renderer.setSize(w, h, false);

    const aspect = w / h;
    const maxCount = Math.max(this._nodesA.length, this._nodesB.length, 1);
    const halfRow = (maxCount * this._spacing) / 2 + 0.7;

    let halfH = 1.95;
    let halfW = halfH * aspect;
    if (halfW < halfRow) {
      halfW = halfRow;
      halfH = halfW / aspect;
    }

    this._rowCam.left = -halfW; this._rowCam.right = halfW;
    this._rowCam.top  =  halfH; this._rowCam.bottom = -halfH;
    this._rowCam.updateProjectionMatrix();
  }

  _startLoop() {
    let last = performance.now();

    const loop = (now = performance.now()) => {
      if (!this._open) return;

      const dt = Math.min(50, Math.max(0, now - last));
      last = now;

      this._updateSelectionAnim(now, dt);
      this._updateBadges(now);
      this._fitCamera();
      this._renderer.render(this._scene, this._rowCam);
      this._raf = requestAnimationFrame(loop);
    };
    loop();
  }

  _updateSelectionAnim(now, dt) {
    for (const holder of this._allNodes) {
      const ud = holder.userData;
      if (!ud) continue;

      const sa = ud.scaleAnim;
      if (sa) {
        const k = Math.min(1, (now - sa.t0) / sa.dur);
        const e = 1 - Math.pow(1 - k, 3);
        holder.scale.setScalar(sa.from + (sa.to - sa.from) * e);
        if (k >= 1) {
          holder.scale.setScalar(sa.to);
          ud.scaleAnim = null;
        }
      }

      const ra = ud.rotAnim;
      if (ra) {
        const k = Math.min(1, (now - ra.t0) / ra.dur);
        const e = 1 - Math.pow(1 - k, 3);
        holder.rotation.y = ra.from + (ra.to - ra.from) * e;
        if (k >= 1) {
          holder.rotation.y = ra.to;
          ud.rotAnim = null;
        }
      } else if (ud.spin) {
        holder.rotation.y += (dt / 1000) * SPIN_SPEED;
      }
    }
  }

  /** Пульсация красных бейджей у юнитов без стамины. */
  _updateBadges(now) {
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now * 0.006));

    for (const holder of this._allNodes) {
      const ud = holder.userData;
      if (!ud?.badge) continue;

      const exhausted = (ud.unit.moveLeft ?? 0) <= 0;
      ud.badge.material.opacity = exhausted ? pulse : 1;
    }
  }

  /* =========================================================
     Клики по юнитам
     ========================================================= */
  _onCanvasClick(e) {
    if (!this._open || e.button !== 0) return;

    const r = this._canvas.getBoundingClientRect();
    this._mouse.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
    this._mouse.y = -((e.clientY - r.top)  / r.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this._rowCam);

    const hits = this._raycaster.intersectObject(this._scene, true);
    if (!hits.length) { this._clearSelection(); return; }

    let o = hits[0].object;
    while (o && o.userData?.type !== 'unit') o = o.parent;
    if (!o) { this._clearSelection(); return; }

    this._onUnitClicked(o);
  }

  _onUnitClicked(holder) {
    if (!holder) return;
    this._selectUnit(holder);
  }

  _selectUnit(holder) {
    if (!holder) return;

    // Повторный клик по выбранной фигурке — снять выбор.
    if (this._selected?.holder === holder) {
      this._clearSelection();
      return;
    }

    if (this._selected) this._releaseHolder(this._selected.holder);

    const ud = holder.userData;
    this._selected = {
      holder,
      unit:  ud.unit,
      army:  ud.army,
      side:  ud.side,
      index: ud.index,
    };

    SND.clickUnit.play();

    ud.spin = true;
    ud.rotAnim = null;
    ud.scaleAnim = {
      from: holder.scale.x,
      to: SELECTED_SCALE,
      t0: performance.now(),
      dur: SELECT_ANIM_MS,
    };

    if (this._selRing) {
      this._selRing.visible = true;
      this._selRing.position.set(holder.position.x, 0.03, holder.position.z);
    }

    this._refreshSelectedStats();
    this._refreshTransferState();
  }

  _clearSelection() {
    const sel = this._selected;
    this._selected = null;

    if (sel) this._releaseHolder(sel.holder);
    if (this._selRing) this._selRing.visible = false;

    this._refreshSelectedStats();
    this._refreshTransferState();
  }

  /**
   * Вернуть фигурку к базовому масштабу и довернуть лицом к камере.
   */
  _releaseHolder(holder) {
    const ud = holder?.userData;
    if (!ud) return;

    ud.spin = false;

    const now = performance.now();
    ud.scaleAnim = {
      from: holder.scale.x,
      to: ROW_SCALE,
      t0: now,
      dur: SELECT_ANIM_MS,
    };

    const turn = Math.PI * 2;
    const from = holder.rotation.y;
    const to = Math.round(from / turn) * turn;
    ud.rotAnim = { from, to, t0: now, dur: SELECT_ANIM_MS };
  }

  /* =========================================================
     Перемещение юнита между армиями
     ========================================================= */
  _transferSelected() {
    const sel = this._selected;
    if (!sel) return;

    const from = sel.army;
    const to   = this._otherArmy(sel.side);
    const ev   = this._evaluateTransfer(sel.unit, from, to);

    if (!ev.ok) {
      this._setStatus(
        `«${escapeHtml(unitName(sel.unit))}» нельзя переместить: ` +
        `${escapeHtml(ev.reason)}`, 'bad');
      return;
    }

    const unit = sel.unit;

    // Сначала кладём в принимающую армию, потом убираем из исходной.
    if (!to.addUnit(unit)) {
      this._setStatus(`В Армии #${to.id} нет свободного места.`, 'bad');
      return;
    }
    from.removeUnit(unit.id);

    // Стоимость перехода списывается со стамины юнита.
    unit.spendMove(ev.cost);

    this._changed = true;
    this._opts?.onTransfer?.({ unit, from, to, cost: ev.cost });
    SND.clickBtn.play();

    const name = unitName(unit);
    this._clearSelection();
    this._buildScene();
    this._refreshArmyCards();
    this._refreshSelectedStats();

    if (from.alive) {
      this._refreshMapArmy(from);
    } else {
      this.mapView?.unitsView?.removeArmy?.(from);
      this.mapView?.unitsView?.relayoutCell?.(from.x, from.y);
    }
    this._refreshMapArmy(to);

    this._setStatus(
      `«${escapeHtml(name)}» перемещён в Армию #${to.id} ` +
      `(−${ev.cost} стамины).`, 'good');
  }

  /**
   * Проверка перехода.
   * @returns {{ok:boolean, cost:number, stamina:number, reason:string}}
   */
  _evaluateTransfer(unit, from, to) {
    const cost = this._cellCost(to);
    const stamina = unit?.moveLeft ?? 0;

    if (!unit || !unit.alive) {
      return { ok: false, cost, stamina, reason: 'Юнит погиб.' };
    }
    if (!from || !to) {
      return { ok: false, cost, stamina, reason: 'Армия недоступна.' };
    }
    if (!from.units?.includes(unit)) {
      return { ok: false, cost, stamina, reason: 'Юнит не найден в армии.' };
    }
    if (from.idOwner !== to.idOwner) {
      return { ok: false, cost, stamina, reason: 'Армии принадлежат разным игрокам.' };
    }
    if (to.units.length >= MAX_ARMY_SIZE) {
      return { ok: false, cost, stamina, reason: `В Армии #${to.id} нет свободного места.` };
    }
    if (stamina <= 0) {
      return { ok: false, cost, stamina, reason: 'У юнита не осталось стамины.' };
    }
    // ТЗ: стамины юнита должно быть БОЛЬШЕ, чем стамина клетки-получателя.
    if (stamina <= cost) {
      return {
        ok: false, cost, stamina,
        reason: `Не хватает стамины: нужно больше ${cost}, у юнита ${stamina}.`,
      };
    }

    return { ok: true, cost, stamina, reason: '' };
  }

  _otherArmy(side) {
    return side === 'A' ? this._armyB : this._armyA;
  }

  /** Стоимость клетки, на которой стоит армия. */
  _cellCost(army) {
    if (!army) return 1;

    if (this._opts?.getCellCost) {
      const v = this._opts.getCellCost(army);
      if (Number.isFinite(v)) return v;
    }

    const cell = this._cell(army);
    const cost = cell?.staminaCost;
    return Number.isFinite(cost) ? cost : 1;
  }

  _cell(army) {
    const world = this.mapView?.world ?? this._opts?.world;
    return world?.get?.(army.x, army.y) ?? null;
  }

  /* =========================================================
     Отображение статов
     ========================================================= */
  _refreshHeader() {
    const pA = this._player(this._armyA);
    const pB = this._player(this._armyB);
    const cA = this._colorHex(pA);
    const cB = this._colorHex(pB);

    this._swA.style.background = cA;
    this._swA.style.color      = cA;
    this._swB.style.background = cB;
    this._swB.style.color      = cB;

    this._titleEl.textContent = 'Обмен юнитами';
    this._subEl.textContent =
      `Армия #${this._armyA.id} (делает ход) ⇄ ` +
      `Армия #${this._armyB.id} (стоит на маршруте)`;
  }

  _refreshArmyCards() {
    for (const side of ['A', 'B']) {
      const army = side === 'A' ? this._armyA : this._armyB;
      const refs = side === 'A' ? this._sideA : this._sideB;
      if (!army || !refs) continue;

      const p = this._player(army);
      const color = this._colorHex(p);
      refs.dot.style.background = color;
      refs.dot.style.color      = color;

      refs.title.textContent = `Армия #${army.id}`;

      const role = side === 'A' ? 'делает ход' : 'стоит на маршруте';
      const tagClass = side === 'A' ? 'move' : 'stand';
      refs.sub.innerHTML =
        `<span class="acv-tag ${tagClass}">${role}</span> · (${army.x}, ${army.y})`;

      const alive = army.units.filter(u => u.alive);
      const str = alive.reduce(
        (s, u) => s + (u.effectiveStrength ?? u.strength ?? 0), 0);
      const mp = army.movePoints;
      const mpClass = mp <= 0 ? 'bad' : (mp < 3 ? 'warn' : 'good');

      const cell = this._cell(army);
      const cellName = cell?.meta?.name ?? '—';
      const cellCost = this._cellCost(army);

      refs.stats.innerHTML = `
        <div class="acv-row"><span class="k">Владелец</span>
          <span class="v">${escapeHtml(p?.name ?? `Игрок ${army.idOwner}`)}</span></div>
        <div class="acv-row"><span class="k">Позиция</span>
          <span class="v">(${army.x}, ${army.y})</span></div>
        <div class="acv-row"><span class="k">Клетка</span>
          <span class="v">${escapeHtml(cellName)} · стамина ${cellCost}</span></div>
        <div class="acv-row"><span class="k">Юнитов</span>
          <span class="v">${alive.length} / ${army.units.length}</span></div>
        <div class="acv-row"><span class="k">Сила</span>
          <span class="v good">${str}</span></div>
        <div class="acv-row"><span class="k">Очки хода</span>
          <span class="v ${mpClass}">${mp}</span></div>
      `;
    }

    this._refreshSelectedStats();
  }

  _refreshSelectedStats() {
    const sel = this._selected;

    for (const side of ['A', 'B']) {
      const army = side === 'A' ? this._armyA : this._armyB;
      const refs = side === 'A' ? this._sideA : this._sideB;
      if (!army || !refs) continue;

      if (!sel || sel.army !== army) {
        refs.unitStats.innerHTML = sel
          ? '<div class="acv-muted">Юнит выбран в другой армии.</div>'
          : '<div class="acv-muted">Кликните по юниту, чтобы выбрать его.</div>';
        continue;
      }

      const u = sel.unit;
      const other = this._otherArmy(side);
      const ev = this._evaluateTransfer(u, army, other);
      const stamina = u.moveLeft ?? 0;

      const staminaClass = stamina <= 0
        ? 'bad'
        : (stamina <= ev.cost ? 'warn' : 'good');
      const exhausted = stamina <= 0
        ? ' <span class="acv-badge-bad">ИСТОЩЁН</span>'
        : '';

      const transferLine = ev.ok
        ? `<span class="v good">доступен · −${ev.cost} стамины</span>`
        : `<span class="v bad">${escapeHtml(ev.reason)}</span>`;

      refs.unitStats.innerHTML = `
        <div class="acv-unit-name">#${sel.index + 1} ${escapeHtml(unitName(u))}
          ${u.isHero ? '<span class="acv-star">★ ГЕРОЙ</span>' : ''}</div>
        <div class="acv-row"><span class="k">Сила</span>
          <span class="v">${u.effectiveStrength ?? u.strength ?? 0}</span></div>
        <div class="acv-row"><span class="k">Атака / Защита</span>
          <span class="v">${u.damage ?? 1} / ${u.defense ?? 1}</span></div>
        <div class="acv-row"><span class="k">HP</span>
          <span class="v">${u.hp}/${u.maxHp}</span></div>
        <div class="acv-row"><span class="k">Стамина</span>
          <span class="v ${staminaClass}">${stamina} / ${u.move ?? '—'}${exhausted}</span></div>
        <div class="acv-row"><span class="k">Переход</span>${transferLine}</div>
      `;
    }
  }

  /** Состояние кнопки ПЕРЕМЕСТИТЬ и подсказка в футере. */
  _refreshTransferState() {
    const btn = this._btnTransfer;
    if (!btn) return;

    const sel = this._selected;
    if (!sel) {
      btn.disabled = true;
      btn.classList.remove('ready');
      this._setStatus(this._defaultHint);
      return;
    }

    const from = sel.army;
    const to   = this._otherArmy(sel.side);
    const ev   = this._evaluateTransfer(sel.unit, from, to);

    btn.disabled = !ev.ok;
    btn.classList.toggle('ready', ev.ok);

    const name = escapeHtml(unitName(sel.unit));

    if (ev.ok) {
      this._setStatus(
        `Выбран «${name}» из Армии #${from.id}. Переход в Армию #${to.id} ` +
        `стоит <b>${ev.cost}</b> стамины — останется ` +
        `<b>${ev.stamina - ev.cost}</b>.`, 'good');
    } else {
      this._setStatus(
        `«${name}» нельзя переместить: ${escapeHtml(ev.reason)}`, 'bad');
    }
  }

  _setStatus(html, cls = '') {
    if (!this._statusEl) return;
    this._statusEl.className = `acv-status ${cls}`.trim();
    this._statusEl.innerHTML = html;
  }

  /* =========================================================
     Владельцы / цвета
     ========================================================= */
  _player(army) {
    const players = this.getPlayers?.();
    return players?.get?.(army?.idOwner) ?? players?.list?.[army?.idOwner] ?? null;
  }

  _playerColor(army) {
    return this._player(army)?.color ?? 0x9aa4ad;
  }

  _colorHex(player) {
    const c = player?.color ?? 0x9aa4ad;
    return typeof c === 'number'
      ? '#' + (c >>> 0).toString(16).padStart(6, '0')
      : (c ?? '#9aa4ad');
  }

  /* =========================================================
     Очистка / обновление карты
     ========================================================= */
  /**
   * Опустевшие армии удаляем только при закрытии панели:
   * так игрок может перемещать юнитов в обе стороны, пока окно открыто.
   */
  _cleanupEmptyArmies() {
    for (const army of [this._armyA, this._armyB]) {
      if (!army || army.alive) continue;
      if (this._emptied.includes(army)) continue;

      army.route = [];
      army.cellGoal = null;

      const world = this.mapView?.world ?? this._opts?.world;
      const cell = world?.get?.(army.x, army.y);
      cell?.removeArmy?.(army);

      const owner = this._player(army);
      owner?.delArmy?.(army);

      this.mapView?.unitsView?.removeArmy?.(army);
      this.mapView?.unitsView?.relayoutCell?.(army.x, army.y);
      this.mapView?.routeView?.updateArmy?.(army);

      this._emptied.push(army);
      this._opts?.onArmyEmpty?.(army);
    }
  }

  /** Обновить модель армии на карте после смены состава. */
  _refreshMapArmy(army) {
    const uv = this.mapView?.unitsView;
    if (!uv || !army) return;
    uv.updateArmy?.(army);
    uv.relayoutCell?.(army.x, army.y);
  }

  _disposeScene() {
    if (!this._scene) return;
    disposeTree(this._scene);
    this._scene.clear();
    this._scene = null;
  }
}

/* =========================================================
   Вспомогательное
   ========================================================= */
function unitName(unit) {
  return unit?.name ?? unit?.typeKey ?? '—';
}

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
