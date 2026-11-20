//  render/army-view-devide.js
//  
//  class ArmyViewDevide - панель предназначен для разделения армии на 2 армии.
//  -   взять базовый код для этого модуля из army-change-view.js
//  -   изначально если открыть армию, армия выглядит как панель army-view.js
//  -   но с кнопкой 'СОЗДАТЬ АРМИЮ', которая активируется при выбранном юните.
//  -   если рядом с армией есть клетка действующего маршрута, то
//      открывается панель class ArmyViewDevide
//  -   если рядом с армией нет клетки действующего для этой армии маршрута,
//      то открввается панель из render/army-view.js
//  -   при выборе юнита активируется кнопка на панели "ПЕРЕМЕСТИТЬ", 
//      если армия была уже созданна.
//  -   если это 1 перемещаемый юнит, то создаётся Армия и туда уходит юнит
//  -   дале все остальные выбранные юниты перемещаются в эту армию.
//  -   также работает обратное перемещение.

import * as THREE from 'three';
import { skinForPlayer, disposeTree } from './r-units-view.js';
import { SND } from '../res/snd/--sound-lib.js';
import { Army, MAX_ARMY_SIZE, MAX_ARMIES_PER_CITY } from '../core/units.js';

const ROW_SPACING = 0.8;
const MAX_ROW_WIDTH = 11;
const ROW_SCALE = 0.7;
const SELECTED_SCALE = ROW_SCALE * 1.45;
const SPIN_SPEED = 1.4;
const SELECT_ANIM_MS = 240;
const ROW_Z = 1.45;

const STYLE_ID = 'army-view-devide-styles';

const CSS = `

.avd-backdrop * {
  scrollbar-width: thin;
  scrollbar-color: #2a3440 #141925;
}
.avd-backdrop *::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.avd-backdrop *::-webkit-scrollbar-track {
  background: #141925;
  border-radius: 6px;
}
.avd-backdrop *::-webkit-scrollbar-thumb {
  background: #2a3440;
  border-radius: 6px;
  border: 2px solid #141925;
}
.avd-backdrop *::-webkit-scrollbar-thumb:hover {
  background: #3a4755;
}
.avd-backdrop *::-webkit-scrollbar-corner {
  background: #141925;
}

.avd-backdrop {
  position: fixed; inset: 0;
  background: rgba(8, 10, 16, .6);
  backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1040;
  opacity: 0; pointer-events: none;
  transition: opacity .18s ease;
}
.avd-backdrop.open { opacity: 1; pointer-events: auto; }

.avd-panel {
  width: 84vw; height: 74vh;
  min-width: 640px; min-height: 400px;
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
.avd-backdrop.open .avd-panel { transform: translateY(0) scale(1); }

.avd-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(120,150,200,.18);
  background: rgba(255,255,255,.02);
}
.avd-swatch {
  width: 14px; height: 14px; border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(0,0,0,.35) inset, 0 0 12px currentColor;
  flex: 0 0 auto;
}
.avd-title  { font-size: 16px; font-weight: 700; letter-spacing: .2px; }
.avd-sub    { font-size: 12px; color: #97a3b6; }

.avd-close {
  margin-left: auto;
  height: 32px; padding: 0 14px; border-radius: 8px;
  border: 1px solid rgba(120,150,200,.3);
  background: rgba(255,255,255,.03);
  color: #cfd7e3; cursor: pointer; font-size: 12px; font-weight: 700;
  letter-spacing: .04em;
  display: grid; place-items: center;
  transition: background .15s, color .15s, transform .1s;
}
.avd-close:hover  { background: rgba(220,80,80,.15); color: #ff9a9a; }
.avd-close:active { transform: scale(.95); }

.avd-body {
  flex: 1 1 auto; min-height: 0;
  display: grid;
  grid-template-columns: 232px 1fr;
}
.avd-body.two {
  grid-template-columns: 232px 1fr 232px;
}
@media (max-width: 900px) {
  .avd-body, .avd-body.two {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  .avd-side--a { border-right: none; border-bottom: 1px solid rgba(120,150,200,.15); }
  .avd-side--b { border-left: none; border-top: 1px solid rgba(120,150,200,.15); }
}

.avd-side {
  padding: 14px;
  overflow: auto;
  background: rgba(255,255,255,.015);
  min-height: 0;
}
.avd-side--a { border-right: 1px solid rgba(120,150,200,.15); }
.avd-side--b { border-left: 1px solid rgba(120,150,200,.15); }

.avd-main {
  padding: 12px;
  min-height: 0;
  display: flex; flex-direction: column; gap: 10px;
}
.avd-canvas-wrap {
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
.avd-canvas {
  display: block; width: 100%; height: 100%;
  cursor: pointer;
}
.avd-canvas-divider {
  position: absolute; left: 6%; right: 6%; top: 50%;
  height: 1px; pointer-events: none;
  background: linear-gradient(90deg,
    transparent, rgba(120,150,200,.28), transparent);
}

.avd-army-head {
  display: flex; align-items: flex-start; gap: 9px;
  margin-bottom: 12px;
}
.avd-dot {
  width: 12px; height: 12px; border-radius: 50%;
  margin-top: 3px;
  box-shadow: 0 0 0 2px rgba(0,0,0,.35) inset, 0 0 12px currentColor;
  flex: 0 0 auto;
}
.avd-army-head-text { min-width: 0; }
.avd-army-title { font-size: 14px; font-weight: 700; }
.avd-army-sub { font-size: 11px; color: #97a3b6; margin-top: 3px; }

.avd-tag {
  display: inline-block;
  padding: 1px 7px; border-radius: 999px;
  font-size: 10px; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase;
}
.avd-tag.main {
  background: rgba(46,139,255,.18);
  border: 1px solid rgba(46,139,255,.4);
  color: #8fc1ff;
}
.avd-tag.split {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(120,150,200,.25);
  color: #aab5c6;
}
.avd-tag.new {
  background: rgba(126,224,160,.14);
  border: 1px solid rgba(126,224,160,.4);
  color: #9fe0b8;
}

.avd-section h4 {
  margin: 14px 0 8px;
  font-size: 11px; text-transform: uppercase; letter-spacing: .12em;
  color: #7f8da3; font-weight: 600;
}
.avd-section:first-of-type h4 { margin-top: 0; }

.avd-row {
  display: flex; justify-content: space-between; gap: 10px;
  padding: 4px 0;
  border-bottom: 1px dashed rgba(120,150,200,.12);
  font-size: 12.5px;
}
.avd-row .k { color: #8d9bb1; }
.avd-row .v { color: #e8ecf3; font-variant-numeric: tabular-nums; text-align: right; }
.avd-row .v.good { color: #7ee0a0; }
.avd-row .v.warn { color: #f0b070; }
.avd-row .v.bad  { color: #ff8a8a; }

.avd-placeholder {
  padding: 18px 10px;
  border: 1px dashed rgba(120,150,200,.22);
  border-radius: 8px;
  color: #7f8da3;
  font-size: 12px;
  text-align: center;
}

.avd-unit-stats {
  padding: 9px 10px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(120,150,200,.18);
  border-radius: 8px;
  min-height: 76px;
  font-size: 12.5px;
  line-height: 1.5;
}
.avd-unit-name { font-weight: 700; margin-bottom: 5px; }
.avd-muted { color: #8a97a5; font-style: italic; }
.avd-star { color: #ffd166; font-weight: 700; margin-left: 4px; }
.avd-badge-bad {
  display: inline-block;
  padding: 0 6px; border-radius: 999px;
  background: rgba(220,60,60,.18);
  border: 1px solid rgba(255,100,100,.45);
  color: #ff8a8a;
  font-size: 10px; font-weight: 700; letter-spacing: .05em;
  vertical-align: middle;
}

.avd-footer {
  display: flex; align-items: center; gap: 14px;
  padding: 10px 18px;
  border-top: 1px solid rgba(120,150,200,.18);
  background: rgba(255,255,255,.02);
  min-height: 52px;
}
.avd-status {
  flex: 1 1 auto;
  font-size: 12.5px; color: #aab5c6;
  line-height: 1.35;
}
.avd-status.good { color: #9fe0b8; }
.avd-status.bad  { color: #ff9a9a; }

.avd-btn {
  height: 40px; padding: 0 26px;
  border-radius: 9px;
  border: 1px solid rgba(120,150,200,.3);
  background: rgba(255,255,255,.04);
  color: #7f8da3;
  font-size: 13px; font-weight: 800; letter-spacing: .08em;
  cursor: not-allowed;
  transition: background .15s, color .15s, box-shadow .15s, transform .1s;
}
.avd-btn.ready {
  cursor: pointer;
  color: #1a1408;
  border-color: rgba(255,209,102,.85);
  background: linear-gradient(180deg, #ffe08a, #f0c040);
  box-shadow: 0 0 18px rgba(255,209,102,.45), 0 2px 10px rgba(0,0,0,.35);
}
.avd-btn.ready:hover  { filter: brightness(1.08); }
.avd-btn.ready:active { transform: scale(.97); }
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

export class ArmyViewDevide {
  constructor(mapViewOrOpts = null, maybeOpts = {}) {
    const looksLikeMapView = !!(mapViewOrOpts &&
      (mapViewOrOpts.renderer || mapViewOrOpts.world || mapViewOrOpts.unitsView));
    const opts = looksLikeMapView ? (maybeOpts ?? {}) : (mapViewOrOpts ?? {});

    this.mapView    = looksLikeMapView ? mapViewOrOpts : (opts.mapView ?? null);
    this.getPlayers = opts.getPlayers ?? (() => this.mapView?.players ?? null);

    this._defaultOpts = {
      world:        opts.world        ?? null,
      getCellCost:  opts.getCellCost  ?? null,
      canCreateArmy: opts.canCreateArmy ?? null,
      onArmyCreated: opts.onArmyCreated ?? null,
      onTransfer:   opts.onTransfer   ?? null,
      onArmyEmpty:  opts.onArmyEmpty  ?? null,
      onClose:      opts.onClose      ?? null,
    };
    this._opts = { ...this._defaultOpts };

    this._raycaster = new THREE.Raycaster();
    this._mouse     = new THREE.Vector2();

    this._open       = false;
    this._armyA      = null;
    this._armyB      = null;
    this._createdArmy = null;
    this._selected   = null;
    this._nodesA     = [];
    this._nodesB     = [];
    this._allNodes   = [];
    this._selRing    = null;
    this._raf        = null;
    this._changed    = false;
    this._spacing    = ROW_SPACING;

    this._defaultHint =
      'Кликните по юниту — загорится кнопка. Первый юнит создаёт новую армию ' +
      'на соседней клетке маршрута, остальные переносятся кнопкой ПЕРЕМЕСТИТЬ.';

    ensureStyles();
    this._buildPanel(opts.container ?? document.body);
  }

  get isOpen() { return this._open; }

  static hasRouteCellNear(army) {
    if (!army || !Array.isArray(army.route) || !army.route.length) return false;
    return army.route.some(c => this._isAdjacent(army, c));
  }

  static shouldOpen(world, army) {
    return this.hasRouteCellNear(army);
  }

  static findPlacementCell(world, army) {
    if (!army || !Array.isArray(army.route)) return null;
    for (const cell of army.route) {
      if (!this._isAdjacent(army, cell)) continue;
      const real = world?.get?.(cell.x, cell.y) ?? cell;
      if (this._canPlaceArmy(world, real, army.idOwner)) return real;
    }
    return null;
  }

  static _isAdjacent(army, cell) {
    if (!cell) return false;
    return Math.abs(cell.x - army.x) + Math.abs(cell.y - army.y) === 1;
  }

  static _canPlaceArmy(world, cell, idOwner) {
    if (!cell) return false;
    const armies = (cell.army ?? []).filter(a => a && a.alive !== false);
    const city = world?.getCityAt?.(cell.x, cell.y)
      ?? world?.cityList?.getAt?.(cell.x, cell.y)
      ?? null;

    if (!city) return armies.length === 0;
    if ((city.ownerId ?? null) !== idOwner) return false;

    return armies.every(a => a.idOwner === idOwner)
      && armies.length < MAX_ARMIES_PER_CITY;
  }

  _buildPanel(container) {
    const back = document.createElement('div');
    back.className = 'avd-backdrop';
    this._root = back;

    const panel = document.createElement('div');
    panel.className = 'avd-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    back.appendChild(panel);

    const head = document.createElement('div');
    head.className = 'avd-header';

    const sw = document.createElement('span');
    sw.className = 'avd-swatch';
    this._swatch = sw;

    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'avd-title';
    title.textContent = '—';
    this._titleEl = title;

    const sub = document.createElement('div');
    sub.className = 'avd-sub';
    sub.textContent = '—';
    this._subEl = sub;

    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'avd-close';
    close.title = 'Закрыть (Esc)';
    close.textContent = 'ЗАКРЫТЬ';
    close.addEventListener('click', () => this.close());

    head.appendChild(sw);
    head.appendChild(titleWrap);
    head.appendChild(close);
    panel.appendChild(head);

    const body = document.createElement('div');
    body.className = 'avd-body';
    this._body = body;
    panel.appendChild(body);

    this._sideA = this._buildSide('A');
    body.appendChild(this._sideA.el);

    const main = document.createElement('main');
    main.className = 'avd-main';
    body.appendChild(main);

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'avd-canvas-wrap';
    main.appendChild(canvasWrap);

    const canvas = document.createElement('canvas');
    canvas.className = 'avd-canvas';
    canvas.addEventListener('pointerdown', (e) => this._onCanvasClick(e));
    this._canvas = canvas;
    canvasWrap.appendChild(canvas);

    const divider = document.createElement('div');
    divider.className = 'avd-canvas-divider';
    divider.hidden = true;
    this._divider = divider;
    canvasWrap.appendChild(divider);

    const unitStats = document.createElement('div');
    unitStats.className = 'avd-unit-stats';
    this._unitStatsEl = unitStats;
    main.appendChild(unitStats);

    this._sideB = this._buildSide('B');
    this._sideB.el.hidden = true;
    body.appendChild(this._sideB.el);

    const footer = document.createElement('div');
    footer.className = 'avd-footer';
    panel.appendChild(footer);

    const status = document.createElement('div');
    status.className = 'avd-status';
    this._statusEl = status;
    footer.appendChild(status);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avd-btn';
    btn.textContent = 'СОЗДАТЬ АРМИЮ';
    btn.disabled = true;
    btn.addEventListener('click', () => this._onAction());
    this._btnAction = btn;
    footer.appendChild(btn);

    back.addEventListener('click', (e) => {
      if (e.target === back) this.close();
    });
    this._onEsc = (e) => {
      if (e.key === 'Escape' && this._open) this.close();
    };
    document.addEventListener('keydown', this._onEsc);

    container.appendChild(back);

    this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setClearColor(0x000000, 0);
  }

  _buildSide(side) {
    const el = document.createElement('aside');
    el.className = `avd-side avd-side--${side.toLowerCase()}`;

    const headEl = document.createElement('div');
    headEl.className = 'avd-army-head';

    const dot = document.createElement('span');
    dot.className = 'avd-dot';

    const headText = document.createElement('div');
    headText.className = 'avd-army-head-text';

    const title = document.createElement('div');
    title.className = 'avd-army-title';
    title.textContent = '—';

    const sub = document.createElement('div');
    sub.className = 'avd-army-sub';
    sub.textContent = '—';

    headText.appendChild(title);
    headText.appendChild(sub);
    headEl.appendChild(dot);
    headEl.appendChild(headText);
    el.appendChild(headEl);

    const section = document.createElement('div');
    section.className = 'avd-section';

    const h4 = document.createElement('h4');
    h4.textContent = side === 'A' ? 'Армия' : 'Новая армия';

    const stats = document.createElement('div');
    stats.className = 'avd-army-stats';

    section.appendChild(h4);
    section.appendChild(stats);
    el.appendChild(section);

    return { el, dot, title, sub, stats };
  }

  show(army, opts = {}) {
    if (!this._root) return false;
    if (!army || !army.units?.length) return false;

    if (this._open) this.close(true);

    this._armyA = army;
    this._armyB = null;

    const prev = this._createdArmy;
    if (prev && prev !== army && prev.alive && prev.idOwner === army.idOwner) {
      if (ArmyViewDevide._isAdjacent(army, prev)) {
        this._armyB = prev;
      } else {
        this._createdArmy = null;
      }
    } else if (prev && (!prev.alive || prev.idOwner !== army.idOwner)) {
      this._createdArmy = null;
    }

    this._opts = { ...this._defaultOpts, ...opts };
    this._changed = false;
    this._selected = null;
    this._open = true;

    this._buildScene();
    this._refreshHeader();
    this._refreshArmyCards();
    this._refreshSelectedInfo();
    this._refreshActionState();

    this._root.classList.add('open');
    this._startLoop();
    return true;
  }

  open(army, opts = {}) {
    return this.show(army, opts);
  }

  close(force = false) {
    const wasOpen = this._open;
    if (!wasOpen && !force) return;

    if (wasOpen && !force) SND.winClose.play();

    this._open = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }

    this._selected = null;
    this._selRing = null;

    this._disposeScene();

    this._nodesA.length = 0;
    this._nodesB.length = 0;
    this._allNodes.length = 0;

    this._root?.classList.remove('open');

    const res = {
      armyA:   this._armyA,
      armyB:   this._armyB,
      created: !!this._armyB,
      changed: this._changed,
    };
    const opts = this._opts;

    this._armyA = null;
    this._armyB = null;
    this._changed = false;
    this._opts = { ...this._defaultOpts };

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

    const hasB = !!this._armyB;
    const countA = this._armyA.units.filter(u => u.alive).length;
    const countB = hasB ? this._armyB.units.filter(u => u.alive).length : 0;
    const maxCount = Math.max(countA, countB, 1);

    this._spacing = Math.min(ROW_SPACING, MAX_ROW_WIDTH / maxCount);
    const plateW = Math.max(2.4, maxCount * this._spacing + 1.2);

    const zA = hasB ? -ROW_Z : 0;
    scene.add(this._makePlate(this._playerColor(this._armyA), zA, plateW));
    if (hasB) {
      scene.add(this._makePlate(this._playerColor(this._armyB), ROW_Z, plateW));
    }

    const ringGeo = new THREE.RingGeometry(0.34, 0.40, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this._selRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 })
    );
    this._selRing.visible = false;
    scene.add(this._selRing);

    this._nodesA = this._buildArmyRow(this._armyA, 'A', zA);
    this._nodesB = hasB ? this._buildArmyRow(this._armyB, 'B', ROW_Z) : [];
    this._allNodes = [...this._nodesA, ...this._nodesB];

    this._divider.hidden = !hasB;
    this._sideB.el.hidden = !hasB;
    this._body.classList.toggle('two', hasB);

    this._rowCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    if (hasB) {
      this._rowCam.position.set(0, 4.0, 4.6);
      this._rowCam.lookAt(0, 0.5, 0);
    } else {
      this._rowCam.position.set(0, 2.6, 5.0);
      this._rowCam.lookAt(0, 0.55, 0);
    }

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

    let halfH = this._armyB ? 1.95 : 1.0;
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

  _updateBadges(now) {
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now * 0.006));

    for (const holder of this._allNodes) {
      const ud = holder.userData;
      if (!ud?.badge) continue;

      const exhausted = (ud.unit.moveLeft ?? 0) <= 0;
      ud.badge.material.opacity = exhausted ? pulse : 1;
    }
  }

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

    this._selectUnit(o);
  }

  _selectUnit(holder) {
    if (!holder) return;

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

    this._refreshSelectedInfo();
    this._refreshActionState();
  }

  _clearSelection() {
    const sel = this._selected;
    this._selected = null;

    if (sel) this._releaseHolder(sel.holder);
    if (this._selRing) this._selRing.visible = false;

    this._refreshSelectedInfo();
    this._refreshActionState();
  }

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

  _onAction() {
    if (!this._armyB) this._createArmy();
    else this._transferSelected();
  }

  _createArmy() {
    const sel = this._selected;
    if (!sel) return;

    const ev = this._evaluateCreate(sel);
    if (!ev.ok) {
      this._setStatus(escapeHtml(ev.reason), sel ? 'bad' : '');
      return;
    }

    const from = this._armyA;
    const placement = ev.placement;
    const owner = this._player(from);
    const world = this._world();
    if (!owner || !world) {
      this._setStatus('Не удалось создать армию: нет владельца или мира.', 'bad');
      return;
    }

    const unit = sel.unit;
    const armyB = Army.spawn(from.idOwner, placement.x, placement.y);
    if (!armyB.addUnit(unit)) {
      this._setStatus('Не удалось поместить юнита в новую армию.', 'bad');
      return;
    }

    owner.addArmy?.(armyB);
    world.addArmy?.(armyB);
    from.removeUnit(unit.id);

    this._armyB = armyB;
    this._createdArmy = armyB;
    this._changed = true;

    this._opts?.onArmyCreated?.({ army: armyB, unit, from, cell: placement });
    SND.clickBtn.play();

    const name = unitName(unit);
    this._afterChange(
      `Создана Армия #${armyB.id} (${placement.x}, ${placement.y}). ` +
      `«${escapeHtml(name)}» перешёл в неё.`, 'good');
  }

  _evaluateCreate(sel = this._selected) {
    if (this._armyB) {
      return { ok: false, reason: 'Армия уже создана.', placement: null };
    }
    if (!sel) {
      return { ok: false, reason: 'Выберите юнита в армии.', placement: null };
    }
    if (sel.side !== 'A') {
      return { ok: false, reason: 'Выберите юнита в основной армии.', placement: null };
    }
    if (this._aliveCount(this._armyA) <= 1) {
      return {
        ok: false,
        reason: 'В армии должен остаться хотя бы один юнит.',
        placement: null,
      };
    }

    const placement = this._findPlacement();
    if (!placement) {
      return {
        ok: false,
        reason: 'Рядом нет свободной клетки маршрута.',
        placement: null,
      };
    }
    if (!this._canCreateArmy()) {
      return { ok: false, reason: 'Лимит армий игрока исчерпан.', placement };
    }

    return { ok: true, reason: '', placement };
  }

  _transferSelected() {
    const sel = this._selected;
    if (!sel) return;

    const from = sel.army;
    const to = this._otherArmy(sel.side);
    const ev = this._evaluateTransfer(sel.unit, from, to);

    if (!ev.ok) {
      this._setStatus(
        `«${escapeHtml(unitName(sel.unit))}» нельзя переместить: ` +
        `${escapeHtml(ev.reason)}`, 'bad');
      return;
    }

    const unit = sel.unit;

    if (!to.addUnit(unit)) {
      this._setStatus(`В Армии #${to.id} нет свободного места.`, 'bad');
      return;
    }
    from.removeUnit(unit.id);

    unit.spendMove(ev.cost);

    this._changed = true;
    this._opts?.onTransfer?.({ unit, from, to, cost: ev.cost });
    SND.clickBtn.play();

    const name = unitName(unit);
    const emptied = !from.alive;

    if (emptied && from === this._armyB) {
      this._disbandB();
      this._afterChange(
        `«${escapeHtml(name)}» перемещён в Армию #${to.id} ` +
        `(−${ev.cost} стамины). Новая армия расформирована.`, 'good');
      return;
    }

    this._afterChange(
      `«${escapeHtml(name)}» перемещён в Армию #${to.id} ` +
      `(−${ev.cost} стамины).`, 'good');
  }

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
    if (from === this._armyA && this._aliveCount(from) <= 1) {
      return {
        ok: false, cost, stamina,
        reason: 'В исходной армии должен остаться хотя бы один юнит.',
      };
    }
    if (stamina <= 0) {
      return { ok: false, cost, stamina, reason: 'У юнита не осталось стамины.' };
    }
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

  _findPlacement() {
    return ArmyViewDevide.findPlacementCell(this._world(), this._armyA);
  }

  _canCreateArmy() {
    if (!this._opts?.canCreateArmy) return true;
    try {
      return this._opts.canCreateArmy(this._armyA) !== false;
    } catch {
      return false;
    }
  }

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
    const world = this._world();
    return world?.get?.(army.x, army.y) ?? null;
  }

  _world() {
    return this.mapView?.world ?? this._opts?.world ?? null;
  }

  _aliveCount(army) {
    return army?.units?.filter(u => u.alive).length ?? 0;
  }

  _refreshHeader() {
    const army = this._armyA;
    const p = this._player(army);
    const color = this._colorHex(p);

    this._swatch.style.background = color;
    this._swatch.style.color = color;

    this._titleEl.textContent = `Армия #${army.id}`;

    const b = this._armyB;
    this._subEl.textContent = b
      ? `${p?.name ?? `Игрок ${army.idOwner}`} · Армия #${army.id} ⇄ Армия #${b.id}`
      : `${p?.name ?? `Игрок ${army.idOwner}`} · разделение армии`;
  }

  _refreshArmyCards() {
    this._refreshArmyCard('A');

    const hasB = !!this._armyB;
    this._sideB.el.hidden = !hasB;
    this._body.classList.toggle('two', hasB);
    this._divider.hidden = !hasB;

    if (hasB) this._refreshArmyCard('B');
    else {
      const refs = this._sideB;
      refs.dot.style.background = '#5b6675';
      refs.dot.style.color = '#5b6675';
      refs.title.textContent = 'Армия не создана';
      refs.sub.innerHTML = '<span class="avd-tag new">СОЗДАТЬ АРМИЮ</span>';
      refs.stats.innerHTML =
        '<div class="avd-placeholder">Выберите юнита и нажмите «СОЗДАТЬ АРМИЮ». ' +
        'Новая армия встанет на соседнюю клетку маршрута.</div>';
    }
  }

  _refreshArmyCard(side) {
    const army = side === 'A' ? this._armyA : this._armyB;
    const refs = side === 'A' ? this._sideA : this._sideB;
    if (!army || !refs) return;

    const p = this._player(army);
    const color = this._colorHex(p);
    refs.dot.style.background = color;
    refs.dot.style.color = color;

    refs.title.textContent = `Армия #${army.id}`;

    const tagClass = side === 'A' ? 'main' : 'new';
    const tagText = side === 'A' ? 'основная' : 'новая';
    refs.sub.innerHTML =
      `<span class="avd-tag ${tagClass}">${tagText}</span> · (${army.x}, ${army.y})`;

    const alive = army.units.filter(u => u.alive);
    const str = alive.reduce(
      (s, u) => s + (u.effectiveStrength ?? u.strength ?? 0), 0);
    const mp = army.movePoints;
    const mpClass = mp <= 0 ? 'bad' : (mp < 3 ? 'warn' : 'good');

    const cell = this._cell(army);
    const cellName = cell?.meta?.name ?? '—';
    const cellCost = this._cellCost(army);

    const route = army.route ?? [];
    const next = route[0] ?? null;
    const routeText = route.length
      ? `${route.length} · (${next?.x}, ${next?.y})`
      : '—';

    refs.stats.innerHTML = `
      <div class="avd-row"><span class="k">Владелец</span>
        <span class="v">${escapeHtml(p?.name ?? `Игрок ${army.idOwner}`)}</span></div>
      <div class="avd-row"><span class="k">Позиция</span>
        <span class="v">(${army.x}, ${army.y})</span></div>
      <div class="avd-row"><span class="k">Клетка</span>
        <span class="v">${escapeHtml(cellName)} · стамина ${cellCost}</span></div>
      <div class="avd-row"><span class="k">Юнитов</span>
        <span class="v">${alive.length} / ${army.units.length}</span></div>
      <div class="avd-row"><span class="k">Сила</span>
        <span class="v good">${str}</span></div>
      <div class="avd-row"><span class="k">Очки хода</span>
        <span class="v ${mpClass}">${mp}</span></div>
      <div class="avd-row"><span class="k">Маршрут</span>
        <span class="v">${escapeHtml(routeText)}</span></div>
    `;
  }

  _refreshSelectedInfo() {
    const el = this._unitStatsEl;
    if (!el) return;

    const sel = this._selected;
    if (!sel) {
      el.innerHTML = `<div class="avd-muted">${escapeHtml(this._defaultHint)}</div>`;
      return;
    }

    const u = sel.unit;
    const stamina = u.moveLeft ?? 0;
    const staminaClass = stamina <= 0 ? 'bad' : (stamina <= 2 ? 'warn' : 'good');
    const exhausted = stamina <= 0
      ? ' <span class="avd-badge-bad">ИСТОЩЁН</span>'
      : '';

    let transferLine;
    if (!this._armyB) {
      const ev = this._evaluateCreate(sel);
      transferLine = ev.ok
        ? '<span class="v good">создаст новую армию</span>'
        : `<span class="v bad">${escapeHtml(ev.reason)}</span>`;
    } else {
      const other = this._otherArmy(sel.side);
      const ev = this._evaluateTransfer(u, sel.army, other);
      transferLine = ev.ok
        ? `<span class="v good">доступен · −${ev.cost} стамины</span>`
        : `<span class="v bad">${escapeHtml(ev.reason)}</span>`;
    }

    el.innerHTML = `
      <div class="avd-unit-name">#${sel.index + 1} ${escapeHtml(unitName(u))}
        ${u.isHero ? '<span class="avd-star">★ ГЕРОЙ</span>' : ''}</div>
      <div class="avd-row"><span class="k">Сила</span>
        <span class="v">${u.effectiveStrength ?? u.strength ?? 0}</span></div>
      <div class="avd-row"><span class="k">Атака / Защита</span>
        <span class="v">${u.damage ?? 1} / ${u.defense ?? 1}</span></div>
      <div class="avd-row"><span class="k">HP</span>
        <span class="v">${u.hp}/${u.maxHp}</span></div>
      <div class="avd-row"><span class="k">Стамина</span>
        <span class="v ${staminaClass}">${stamina} / ${u.move ?? '—'}${exhausted}</span></div>
      <div class="avd-row"><span class="k">Переход</span>${transferLine}</div>
    `;
  }

  _refreshActionState() {
    const btn = this._btnAction;
    if (!btn) return;

    const sel = this._selected;

    if (!this._armyB) {
      btn.textContent = 'СОЗДАТЬ АРМИЮ';

      if (!sel) {
        btn.disabled = true;
        btn.classList.remove('ready');
        this._setStatus(this._defaultHint);
        return;
      }

      const ev = this._evaluateCreate(sel);

      btn.disabled = !ev.ok;
      btn.classList.toggle('ready', ev.ok);

      if (ev.ok) {
        this._setStatus(
          `«${escapeHtml(unitName(sel.unit))}» уйдёт в новую армию на клетке ` +
          `(${ev.placement.x}, ${ev.placement.y}).`, 'good');
      } else {
        this._setStatus(escapeHtml(ev.reason), 'bad');
      }
      return;
    }

    btn.textContent = 'ПЕРЕМЕСТИТЬ';

    if (!sel) {
      btn.disabled = true;
      btn.classList.remove('ready');
      this._setStatus(this._defaultHint);
      return;
    }

    const from = sel.army;
    const to = this._otherArmy(sel.side);
    const ev = this._evaluateTransfer(sel.unit, from, to);

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

  _afterChange(statusText, cls = 'good') {
    this._selected = null;
    if (this._selRing) this._selRing.visible = false;

    this._buildScene();
    this._refreshHeader();
    this._refreshArmyCards();
    this._refreshSelectedInfo();
    this._refreshActionState();
    this._refreshMapArmies();
    this._setStatus(statusText, cls);
  }

  _disbandB() {
    const army = this._armyB;
    if (!army) return;

    army.route = [];
    army.cellGoal = null;

    const world = this._world();
    world?.get?.(army.x, army.y)?.removeArmy?.(army);
    this._player(army)?.delArmy?.(army);
    this.mapView?.unitsView?.removeArmy?.(army);
    this.mapView?.unitsView?.relayoutCell?.(army.x, army.y);
    this.mapView?.routeView?.updateArmy?.(army);

    this._armyB = null;
    this._createdArmy = null;
    this._opts?.onArmyEmpty?.(army);
  }

  _refreshMapArmies() {
    const uv = this.mapView?.unitsView;
    if (!uv) return;

    const list = [this._armyA, this._armyB].filter(a => a && a.alive);

    for (const a of list) uv.updateArmy?.(a);
    for (const a of list) uv.relayoutCell?.(a.x, a.y);
    for (const a of list) this.mapView?.routeView?.updateArmy?.(a);
  }

  _setStatus(html, cls = '') {
    if (!this._statusEl) return;
    this._statusEl.className = `avd-status ${cls}`.trim();
    this._statusEl.innerHTML = html;
  }

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

  _disposeScene() {
    if (!this._scene) return;
    disposeTree(this._scene);
    this._scene.clear();
    this._scene = null;
  }
}

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
