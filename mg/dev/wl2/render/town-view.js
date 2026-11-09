// render/town-view.js
//
// ТЗ:
//  -   панель просмотра города
//  -   модель города(верху)
//  -   статы города
//  -   внизу модели юнитов(до 4 моделей) которые город может производить
//  -   модель юнита, который сейчас в производстве
//  -   у каждого юнита должна быть стоимость производства
//  -   стоимость производства юнита зависит от статов дамага+защита
//  -   игрок кликом может выбрать юнита из набора в текущее производство
//  -   у выбранного юнита включается счётчик кругов; когда он дошёл до нуля,
//      юнит появляется В СОСТАВЕ АРМИИ в клетке города
//  -   если армии ещё нет — сначала создаётся армия, затем в неё кладётся юнит
//  -   в армии не больше MAX_ARMY_SIZE юнитов, в городе — до 4 армий
//      (визуально по углам квадрата ячейки, см. UnitsView)
//  -   окно по ширине 0.7 по высоте 0.9
//  -   объект class TownView существует в 1 экземпляре релоцируется 1 раз
//  -   стиль аналогичный с render/army-view.js внутри town-view.js
//  -   ...

import * as THREE from 'three';
import {
  UNIT_TYPES,
  MAX_ARMIES_PER_CITY,
  MAX_ARMY_SIZE,
} from '../core/units.js';
import {
  productionOptions,
  productionTurns,
  ensureCityProduction,
  setCityProduction,
} from '../core/production.js';
import { skinForPlayer, disposeTree } from './r-units-view.js';
import { SND } from '../res/snd/--sound-lib.js';

/** Шаг между слотами в мини-сцене юнитов. */
const SLOT_SPACING = 1.30;

/** Дополнительный отступ между «текущим» и набором доступных. */
const CURRENT_GAP = 0.45;

const STYLE_ID = 'town-view-styles';

const CITY_TYPE_LABEL = {
  provincial: 'Провинциальный',
  capital:    'Столица',
  fortress:   'Крепость',
  backwater:  'Захолустье',
};

/** Набор производимых юнитов зависит от типа города — см. core/production.js. */

const CSS = `
.tv-backdrop * {
  scrollbar-width: thin;
  scrollbar-color: #2a3440 #141925;
}
.tv-backdrop *::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.tv-backdrop *::-webkit-scrollbar-track {
  background: #141925;
  border-radius: 6px;
}
.tv-backdrop *::-webkit-scrollbar-thumb {
  background: #2a3440;
  border-radius: 6px;
  border: 2px solid #141925;
}
.tv-backdrop *::-webkit-scrollbar-thumb:hover {
  background: #3a4755;
}
.tv-backdrop *::-webkit-scrollbar-corner {
  background: #141925;
}

.tv-backdrop {
  position: fixed; inset: 0;
  background: rgba(8, 10, 16, .55);
  backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1050;
  opacity: 0; pointer-events: none;
  transition: opacity .18s ease;
}
.tv-backdrop.open { opacity: 1; pointer-events: auto; }

.tv-panel {
  width: 70vw; height: 90vh;
  min-width: 560px; min-height: 420px;
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
.tv-backdrop.open .tv-panel { transform: translateY(0) scale(1); }

.tv-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(120,150,200,.18);
  background: rgba(255,255,255,.02);
}
.tv-swatch {
  width: 14px; height: 14px; border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(0,0,0,.35) inset, 0 0 12px currentColor;
  flex: 0 0 auto;
}
.tv-title  { font-size: 16px; font-weight: 700; letter-spacing: .2px; }
.tv-sub    { font-size: 12px; color: #97a3b6; }

.tv-close {
  margin-left: auto;
  height: 32px; padding: 0 14px; border-radius: 8px;
  border: 1px solid rgba(120,150,200,.3);
  background: rgba(255,255,255,.03);
  color: #cfd7e3; cursor: pointer; font-size: 13px; font-weight: 600;
  display: grid; place-items: center;
  transition: background .15s, color .15s, transform .1s;
}
.tv-close:hover  { background: rgba(220,80,80,.15); color: #ff9a9a; }
.tv-close:active { transform: scale(.95); }

.tv-body {
  flex: 1 1 auto; min-height: 0;
  display: flex; flex-direction: column; gap: 12px;
  padding: 14px 16px;
}

.tv-top {
  flex: 1 1 46%; min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(230px, .8fr);
  gap: 12px;
}
@media (max-width: 780px) {
  .tv-top { grid-template-columns: 1fr; grid-template-rows: 1fr auto; }
}

.tv-hero {
  position: relative; min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(120,150,200,.18);
  border-radius: 12px;
  background:
    linear-gradient(rgba(13,18,24,.25), rgba(13,18,24,.55)),
    url("./res/img/bg2.jpg") center / cover no-repeat;
}
.tv-city-canvas { display: block; width: 100%; height: 100%; }
.tv-hero-tag {
  position: absolute; left: 12px; bottom: 10px;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(10,14,18,.72);
  border: 1px solid rgba(120,150,200,.28);
  font-size: 12px; color: #cfd7e3;
  pointer-events: none;
}

.tv-stats {
  overflow: auto;
  padding: 12px 14px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(120,150,200,.18);
  border-radius: 12px;
}

.tv-section h4 {
  margin: 14px 0 8px;
  font-size: 11px; text-transform: uppercase; letter-spacing: .12em;
  color: #7f8da3; font-weight: 600;
}
.tv-section h4:first-child { margin-top: 0; }

.tv-row {
  display: flex; justify-content: space-between; gap: 10px;
  padding: 5px 0;
  border-bottom: 1px dashed rgba(120,150,200,.12);
  font-size: 13px;
}
.tv-row .k { color: #8d9bb1; }
.tv-row .v { color: #e8ecf3; font-variant-numeric: tabular-nums; text-align: right; }
.tv-row .v.good { color: #7ee0a0; }
.tv-row .v.warn { color: #f0b070; }

.tv-dot {
  display: inline-block; width: 9px; height: 9px;
  border-radius: 50%; margin-right: 6px;
  border: 1px solid rgba(0,0,0,.35);
  vertical-align: middle;
}

.tv-bottom {
  flex: 1 1 54%; min-height: 0;
  display: flex; flex-direction: column; gap: 8px;
}
.tv-section-head {
  display: flex; align-items: baseline; gap: 10px;
}
.tv-section-head h4 {
  margin: 0;
  font-size: 11px; text-transform: uppercase; letter-spacing: .12em;
  color: #7f8da3; font-weight: 600;
}
.tv-hint { font-size: 12px; color: #7f8da3; }

.tv-units-wrap {
  position: relative;
  flex: 1 1 auto; min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(120,150,200,.18);
  border-radius: 12px;
  background:
    linear-gradient(rgba(13,18,24,.35), rgba(13,18,24,.55)),
    url("./res/img/bg3.jpg") center / cover no-repeat;
}
.tv-units-canvas {
  display: block; width: 100%; height: 100%;
  cursor: pointer;
}

.tv-prod-bar {
  min-height: 38px;
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px 14px;
  padding: 8px 12px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(120,150,200,.18);
  border-radius: 10px;
  font-size: 13px;
  color: #aab5c6;
}
.tv-prod-bar b { color: #f0c866; }
.tv-prod-bar .cost { color: #7ee0a0; font-variant-numeric: tabular-nums; }
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* =========================================================
   Производство: цена в кругах, выбор слота и счётчик живут
   в core/production.js (общие правила для панели и Judge).
   ========================================================= */

/* =========================================================
   Модель города для верхней части панели.
   ========================================================= */
function buildCityMesh(colorHex, type = 'provincial') {
  const g = new THREE.Group();

  const accent   = new THREE.Color(colorHex);
  const stone    = new THREE.MeshStandardMaterial({ color: 0xd9cfb6, roughness: 0.9 });
  const stoneDark= new THREE.MeshStandardMaterial({ color: 0x9a8f77, roughness: 0.95 });
  const roof     = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6 });
  const wood     = new THREE.MeshStandardMaterial({ color: 0x6d4a2f, roughness: 0.9 });
  const gold     = new THREE.MeshStandardMaterial({
    color: 0xffd166, metalness: 0.55, roughness: 0.35,
    emissive: 0x3a2a10, emissiveIntensity: 0.35,
  });
  const flagMat  = new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide });
  const winMat   = new THREE.MeshStandardMaterial({
    color: 0xffd166, emissive: 0xffa02a, emissiveIntensity: 0.6, roughness: 0.4,
  });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };

  add(new THREE.CylinderGeometry(1.05, 1.15, 0.16, 28), stoneDark, 0, 0.08, 0);

  const seg = 14, r = 0.92;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    add(
      new THREE.BoxGeometry(0.34, 0.18, 0.16), stone,
      Math.cos(a) * r, 0.25, Math.sin(a) * r,
      0, -a, 0,
    );
    add(
      new THREE.BoxGeometry(0.16, 0.10, 0.16), stoneDark,
      Math.cos(a) * r, 0.39, Math.sin(a) * r,
      0, -a, 0,
    );
  }

  const towers = [
    Math.PI * 0.25, Math.PI * 0.75,
    Math.PI * 1.25, Math.PI * 1.75,
  ];
  for (const a of towers) {
    const x = Math.cos(a) * 0.70;
    const z = Math.sin(a) * 0.70;
    add(new THREE.CylinderGeometry(0.17, 0.20, 0.55, 10), stone, x, 0.38, z);
    add(new THREE.ConeGeometry(0.22, 0.28, 4), roof, x, 0.78, z, 0, Math.PI / 4, 0);
  }

  add(new THREE.BoxGeometry(0.70, 0.72, 0.70), stone, 0, 0.52, 0);
  add(new THREE.BoxGeometry(0.78, 0.08, 0.78), stoneDark, 0, 0.90, 0);
  add(new THREE.ConeGeometry(0.56, 0.50, 4), roof, 0, 1.18, 0, 0, Math.PI / 4, 0);
  add(new THREE.BoxGeometry(0.20, 0.34, 0.05), wood, 0, 0.35, 0.36);

  add(new THREE.BoxGeometry(0.07, 0.12, 0.03), winMat, -0.18, 0.62, 0.36);
  add(new THREE.BoxGeometry(0.07, 0.12, 0.03), winMat,  0.18, 0.62, 0.36);
  add(new THREE.BoxGeometry(0.03, 0.12, 0.07), winMat, -0.36, 0.62, 0);
  add(new THREE.BoxGeometry(0.03, 0.12, 0.07), winMat,  0.36, 0.62, 0);

  add(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 6), gold, 0, 1.65, 0);
  add(new THREE.PlaneGeometry(0.30, 0.18), flagMat, 0.16, 1.80, 0);

  const scale =
    type === 'capital'   ? 1.12 :
    type === 'fortress'  ? 1.06 :
    type === 'backwater' ? 0.90 : 1.0;
  g.scale.setScalar(scale);

  return g;
}

/* =========================================================
   Подложка текущего производства:
   тонированный чёрный фон в выпуклой рамке.
   ========================================================= */
function makeProductionBackdrop() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const ctx = c.getContext('2d');

  const frame = ctx.createLinearGradient(0, 0, 256, 320);
  frame.addColorStop(0, '#565d68');
  frame.addColorStop(0.5, '#2c3138');
  frame.addColorStop(1, '#0d0f12');
  ctx.fillStyle = frame;
  roundRect(ctx, 4, 4, 248, 312, 22);
  ctx.fill();

  const inner = ctx.createLinearGradient(0, 16, 0, 304);
  inner.addColorStop(0, 'rgba(26,29,35,.97)');
  inner.addColorStop(0.55, 'rgba(11,13,17,.98)');
  inner.addColorStop(1, 'rgba(4,5,7,1)');
  ctx.fillStyle = inner;
  roundRect(ctx, 16, 16, 224, 288, 16);
  ctx.fill();

  const glow = ctx.createRadialGradient(128, 150, 8, 128, 150, 130);
  glow.addColorStop(0, 'rgba(255,209,102,.10)');
  glow.addColorStop(1, 'rgba(255,209,102,0)');
  ctx.fillStyle = glow;
  roundRect(ctx, 18, 18, 220, 284, 15);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 2;
  roundRect(ctx, 17, 17, 222, 286, 15);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, 15, 15, 226, 290, 17);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(1.52, 2.14, 1);
  return spr;
}

/* =========================================================
   Подпись над моделью юнита: название + стоимость.
   ========================================================= */
function makeUnitLabel(name, cost) {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 120;
  const ctx = c.getContext('2d');

  ctx.fillStyle = 'rgba(10,14,18,.82)';
  roundRect(ctx, 4, 4, 312, 112, 16);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,209,102,.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, 4, 4, 312, 112, 16);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#e8ecf3';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(name, 160, 40, 292);

  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(cost, 160, 82);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(1.15, 0.43, 1);
  return spr;
}

/* =========================================================
   TownView — панель просмотра города.
   Единственный экземпляр; при смене MapView перепривязывается.
   ========================================================= */
export class TownView {
  static _instance = null;

  static get instance() { return TownView._instance; }

  /**
   * Получить единственный экземпляр (создать при необходимости).
   * @param {MapView} mapView
   * @param {Object}  [opts]
   * @returns {TownView}
   */
  static get(mapView, opts = {}) {
    if (!TownView._instance) return new TownView(mapView, opts);
    const inst = TownView._instance;
    if (mapView && inst.mapView !== mapView) inst.relocate(mapView, opts);
    return inst;
  }

  /**
   * @param {MapView} mapView
   * @param {Object} [opts]
   * @param {Function} [opts.getPlayers]   — () => Players
   * @param {HTMLElement} [opts.container] — куда вставить панель (по умолчанию body)
   */
  constructor(mapView, opts = {}) {
    if (TownView._instance) {
      const inst = TownView._instance;
      if (mapView && inst.mapView !== mapView) inst.relocate(mapView, opts);
      return inst;
    }
    TownView._instance = this;

    this._opts = opts;
    this.mapView = mapView;
    this.getPlayers = opts.getPlayers ?? (() => mapView?.players ?? null);
    // Во время хода человека клики по городам уходят в HumanBrain
    // (построение маршрута), а не в модальную панель города.
    this._getMapClickEnabled = opts.getMapClickEnabled ?? (() => true);

    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();

    this._open = false;
    this._city = null;
    this._raf = null;
    this._unitNodes = [];
    this._cityRoot = null;
    this._boundDom = null;
    this._onDomDown = null;
    this._selType = null;
    // Кеш состояния производства для лёгкого обновления панели в цикле.
    this._prodKey = null;
    this._lastProdRefresh = 0;

    ensureStyles();
    this._buildPanel(opts.container ?? document.body);
    this._initScenes();
    this._bindMapClick();
  }

  /* =========================================================
     DOM панели
     ========================================================= */
  _buildPanel(container) {
    const back = document.createElement('div');
    back.className = 'tv-backdrop';
    this._root = back;

    const panel = document.createElement('div');
    panel.className = 'tv-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    back.appendChild(panel);

    const head = document.createElement('div');
    head.className = 'tv-header';

    const swatch = document.createElement('span');
    swatch.className = 'tv-swatch';
    this._ownerSwatch = swatch;

    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'tv-title';
    title.textContent = '—';
    this._titleEl = title;

    const sub = document.createElement('div');
    sub.className = 'tv-sub';
    sub.textContent = '—';
    this._subEl = sub;

    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tv-close';
    close.title = 'Закрыть (Esc)';
    close.textContent = 'ЗАКРЫТЬ';
    close.addEventListener('click', () => this.close());

    head.appendChild(swatch);
    head.appendChild(titleWrap);
    head.appendChild(close);
    panel.appendChild(head);

    const body = document.createElement('div');
    body.className = 'tv-body';
    panel.appendChild(body);

    const top = document.createElement('div');
    top.className = 'tv-top';
    body.appendChild(top);

    const hero = document.createElement('div');
    hero.className = 'tv-hero';
    top.appendChild(hero);

    const cityCanvas = document.createElement('canvas');
    cityCanvas.className = 'tv-city-canvas';
    this._cityCanvas = cityCanvas;
    hero.appendChild(cityCanvas);

    const heroTag = document.createElement('div');
    heroTag.className = 'tv-hero-tag';
    this._heroTagEl = heroTag;
    hero.appendChild(heroTag);

    const stats = document.createElement('aside');
    stats.className = 'tv-stats';
    this._statsEl = stats;
    top.appendChild(stats);

    const bottom = document.createElement('div');
    bottom.className = 'tv-bottom';
    body.appendChild(bottom);

    const bottomHead = document.createElement('div');
    bottomHead.className = 'tv-section-head';
    const bottomTitle = document.createElement('h4');
    bottomTitle.textContent = 'Производство';
    const hint = document.createElement('span');
    hint.className = 'tv-hint';
    hint.textContent = 'Кликните по модели юнита, чтобы выбрать его в производство';
    bottomHead.appendChild(bottomTitle);
    bottomHead.appendChild(hint);
    bottom.appendChild(bottomHead);

    const unitsWrap = document.createElement('div');
    unitsWrap.className = 'tv-units-wrap';
    bottom.appendChild(unitsWrap);

    const unitsCanvas = document.createElement('canvas');
    unitsCanvas.className = 'tv-units-canvas';
    unitsCanvas.addEventListener('pointerdown', (e) => this._onUnitsClick(e));
    this._unitsCanvas = unitsCanvas;
    unitsWrap.appendChild(unitsCanvas);

    const prodBar = document.createElement('div');
    prodBar.className = 'tv-prod-bar';
    this._prodBarEl = prodBar;
    bottom.appendChild(prodBar);

    back.addEventListener('click', (e) => {
      if (e.target === back) this.close();
    });
    this._onEsc = (e) => {
      if (e.key === 'Escape' && this._open) this.close();
    };
    document.addEventListener('keydown', this._onEsc);

    container.appendChild(back);

    this._cityRenderer = new THREE.WebGLRenderer({ canvas: cityCanvas, antialias: true, alpha: true });
    this._cityRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._cityRenderer.setClearColor(0x000000, 0);

    this._unitsRenderer = new THREE.WebGLRenderer({ canvas: unitsCanvas, antialias: true, alpha: true });
    this._unitsRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._unitsRenderer.setClearColor(0x000000, 0);
  }

  /* =========================================================
     Сцены и камеры (создаются один раз)
     ========================================================= */
  _initScenes() {
    this._cityScene = new THREE.Scene();
    this._cityScene.add(new THREE.AmbientLight(0xffffff, 0.80));
    const cityKey = new THREE.DirectionalLight(0xffffff, 1.0);
    cityKey.position.set(3, 5, 4);
    this._cityScene.add(cityKey);
    const cityFill = new THREE.DirectionalLight(0x88aaff, 0.35);
    cityFill.position.set(-4, 2, -3);
    this._cityScene.add(cityFill);

    this._cityCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this._cityCam.position.set(3.0, 2.6, 3.9);
    this._cityCam.lookAt(0, 0.90, 0);

    this._unitsScene = new THREE.Scene();
    this._unitsScene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const unitKey = new THREE.DirectionalLight(0xffffff, 0.9);
    unitKey.position.set(3, 5, 4);
    this._unitsScene.add(unitKey);

    this._unitsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this._unitsCam.position.set(0, 2.6, 5.0);
    this._unitsCam.lookAt(0, 0.60, 0);

    this._unitsRoot = new THREE.Group();
    this._unitsScene.add(this._unitsRoot);
  }

  /* =========================================================
     Привязка к клику по городу на карте
     ========================================================= */
  _bindMapClick() {
    this._unbindMapClick();
    const dom = this.mapView?.renderer?.domElement;
    if (!dom) return;

    this._onDomDown = (e) => {
      if (e.button !== 0) return;
      if (!this._getMapClickEnabled()) return;
      const city = this._pickCity(e);
      if (!city) return;
      SND.clickTown.play();
      this.show(city);
    };
    dom.addEventListener('pointerdown', this._onDomDown);
    this._boundDom = dom;
  }

  _unbindMapClick() {
    if (this._boundDom && this._onDomDown) {
      this._boundDom.removeEventListener('pointerdown', this._onDomDown);
    }
    this._boundDom = null;
    this._onDomDown = null;
  }

  _pickCity(e) {
    const cityGroup = this.mapView?.cityGroup;
    if (!cityGroup) return null;

    const r = this.mapView.renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this._mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;

    const cam = this.mapView.renderer.mode === 'top'
      ? this.mapView.renderer.cameraTop
      : this.mapView.renderer.cameraOrbit;
    this._raycaster.setFromCamera(this._mouse, cam);

    const hits = this._raycaster.intersectObject(cityGroup, true);
    for (const hit of hits) {
      let o = hit.object;
      while (o && o !== cityGroup) {
        if (o.userData?.type === 'city') return o.userData.city;
        o = o.parent;
      }
    }
    return null;
  }

  /* =========================================================
     Перепривязка к новой карте (единственный экземпляр)
     ========================================================= */
  relocate(mapView, opts = this._opts) {
    if (!mapView) return this;
    if (this.mapView === mapView) return this;

    this.close();
    this._opts = opts ?? this._opts;
    this.mapView = mapView;
    this.getPlayers = this._opts?.getPlayers ?? (() => mapView.players ?? null);
    this._getMapClickEnabled = this._opts?.getMapClickEnabled ?? (() => true);
    this._bindMapClick();
    return this;
  }

  /* =========================================================
     Открытие / закрытие
     ========================================================= */
  show(city) {
    if (!city) return;
    this.close();
    this._city = city;
    this._selType = null;
    this._prodKey = null;
    this._open = true;
    this._root.classList.add('open');

    this._refreshHeader();
    this._refreshStats();
    this._buildCityModel();
    this._buildUnitsRow();
    this._startLoop();
  }

  close() {
    if (this._open) {
      SND.winClose.play();
      this._open = false;
    }
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    this._root.classList.remove('open');
    this._clearModels();
  }

  destroy() {
    this.close();
    document.removeEventListener('keydown', this._onEsc);
    this._unbindMapClick();
    this._cityRenderer?.forceContextLoss?.();
    this._cityRenderer?.dispose?.();
    this._cityRenderer = null;
    this._unitsRenderer?.forceContextLoss?.();
    this._unitsRenderer?.dispose?.();
    this._unitsRenderer = null;
    this._root?.remove?.();
    if (TownView._instance === this) TownView._instance = null;
  }

  /* =========================================================
     Заголовок и статы
     ========================================================= */
  _owner() {
    const players = this.getPlayers?.();
    const id = this._city?.ownerId;
    if (id == null) return null;
    return players?.get?.(id) ?? players?.list?.[id] ?? null;
  }

  _ownerColor() {
    const owner = this._owner();
    if (owner && typeof owner.color === 'number') return owner.color;
    return 0x8a8f96;   // нейтральный город — средне-серый
  }

  _ownerColorCss() {
    return '#' + (this._ownerColor() >>> 0).toString(16).padStart(6, '0');
  }

  _refreshHeader() {
    const city = this._city;
    const color = this._ownerColorCss();

    this._ownerSwatch.style.background = color;
    this._ownerSwatch.style.color = color;

    const typeLabel = CITY_TYPE_LABEL[city.type] ?? city.type;
    this._titleEl.textContent = city.name ?? 'Город';
    this._subEl.textContent = `${typeLabel} · (${city.x}, ${city.y})`;
    this._heroTagEl.textContent = typeLabel;
  }

  _refreshStats() {
    const city = this._city;
    const owner = this._owner();
    const color = this._ownerColorCss();
    const ownerName = owner?.name
      ?? (city.ownerId == null ? 'Нейтральный' : `Игрок ${city.ownerId}`);

    const options = productionOptions(city);
    const current = ensureCityProduction(city);
    const curType = UNIT_TYPES[current];
    const price = current ? productionTurns(current) : 0;
    const left = current ? Math.max(0, city.productionTurnsLeft ?? 0) : 0;
    const garrison = this._cityArmyStats();

    const available = options
      .map(k => UNIT_TYPES[k]?.name)
      .filter(Boolean)
      .join(', ');

    // Состояние счётчика кругов: у нейтрального города производство стоит.
    let progressClass = 'good';
    let progressText;
    if (!current) {
      progressClass = 'warn';
      progressText = '—';
    } else if (city.ownerId == null) {
      progressClass = 'warn';
      progressText = 'нейтральный город';
    } else if (garrison.armies >= MAX_ARMIES_PER_CITY && garrison.freeSlots === 0) {
      progressClass = 'warn';
      progressText = 'ждёт места в армии';
    } else if (left === 0) {
      progressText = 'готов к выходу';
    } else {
      progressClass = 'warn';
      progressText = `${left} из ${price} кр.`;
    }

    this._statsEl.innerHTML = `
      <div class="tv-section">
        <h4>Город</h4>
        <div class="tv-row">
          <span class="k">Название</span>
          <span class="v">${escapeHtml(city.name ?? '—')}</span>
        </div>
        <div class="tv-row">
          <span class="k">Тип</span>
          <span class="v">${escapeHtml(CITY_TYPE_LABEL[city.type] ?? city.type ?? '—')}</span>
        </div>
        <div class="tv-row">
          <span class="k">Владелец</span>
          <span class="v">
            <span class="tv-dot" style="background:${color}"></span>
            ${escapeHtml(ownerName)}
          </span>
        </div>
        <div class="tv-row">
          <span class="k">Координаты</span>
          <span class="v">(${city.x}, ${city.y})</span>
        </div>
      </div>

      <div class="tv-section">
        <h4>Производство</h4>
        <div class="tv-row">
          <span class="k">Сейчас</span>
          <span class="v">${escapeHtml(curType?.name ?? '—')}</span>
        </div>
        <div class="tv-row">
          <span class="k">Цена</span>
          <span class="v">${price} кр.</span>
        </div>
        <div class="tv-row">
          <span class="k">Счётчик</span>
          <span class="v ${progressClass}">${progressText}</span>
        </div>
        <div class="tv-row">
          <span class="k">Доступно</span>
          <span class="v">${escapeHtml(available || '—')}</span>
        </div>
      </div>

      <div class="tv-section">
        <h4>Гарнизон</h4>
        <div class="tv-row">
          <span class="k">Армий в городе</span>
          <span class="v">${garrison.armies} / ${MAX_ARMIES_PER_CITY}</span>
        </div>
        <div class="tv-row">
          <span class="k">Юнитов в армиях</span>
          <span class="v">${garrison.units}</span>
        </div>
        <div class="tv-row">
          <span class="k">Лимит армии</span>
          <span class="v">${MAX_ARMY_SIZE} юнитов</span>
        </div>
      </div>
    `;
  }

  /** Армии и юниты владельца, стоящие в клетке города. */
  _cityArmyStats() {
    const city = this._city;
    const cell = this.mapView?.world?.get?.(city.x, city.y);
    const ownerId = city.ownerId ?? null;

    const armies = (cell?.army ?? []).filter(a =>
      a && a.idOwner === ownerId && a.alive !== false
    );

    const units = armies.reduce((n, a) =>
      n + (a.units?.filter(u => u?.alive !== false).length ?? 0), 0);
    const freeSlots = armies.reduce((n, a) =>
      n + Math.max(0, MAX_ARMY_SIZE - (a.units?.length ?? 0)), 0);

    return { armies: armies.length, units, freeSlots };
  }

  _refreshProductionBar() {
    const city = this._city;
    const current = ensureCityProduction(city);
    const type = UNIT_TYPES[current];
    if (!type) {
      this._prodBarEl.textContent = 'Нет доступных юнитов';
      return;
    }

    const price = productionTurns(current);
    const left = Math.max(0, city.productionTurnsLeft ?? 0);
    const garrison = this._cityArmyStats();

    let progress;
    if (city.ownerId == null) {
      progress = 'город нейтрален — производство стоит';
    } else if (left === 0
        && garrison.armies >= MAX_ARMIES_PER_CITY
        && garrison.freeSlots === 0) {
      progress = 'ждёт места в армии (4 армии полны)';
    } else if (left === 0) {
      progress = 'готов — появится в конце круга';
    } else {
      progress = `осталось <span class="cost">${left}</span> из ` +
                 `<span class="cost">${price}</span> кр.`;
    }

    this._prodBarEl.innerHTML = `
      <span>В производстве: <b>${escapeHtml(type.name)}</b></span>
      <span>цена: <span class="cost">${price}</span> кр.</span>
      <span>${progress}</span>
      <span>армий: <span class="cost">${garrison.armies}</span> / ${MAX_ARMIES_PER_CITY}</span>
    `;
  }

  /* =========================================================
     Модель города (верхняя часть)
     ========================================================= */
  _buildCityModel() {
    if (this._cityRoot) {
      this._cityScene.remove(this._cityRoot);
      disposeTree(this._cityRoot);
      this._cityRoot.clear();
    }

    this._cityRoot = new THREE.Group();
    this._cityRoot.add(buildCityMesh(this._ownerColor(), this._city.type));
    this._cityRoot.rotation.y = -0.5;
    this._cityScene.add(this._cityRoot);
  }

  /* =========================================================
     Ряд моделей производства (внизу)
     ========================================================= */
  _buildUnitsRow() {
    if (this._unitsRoot.children.length) {
      disposeTree(this._unitsRoot);
      this._unitsRoot.clear();
    }
    this._unitNodes = [];

    const city = this._city;
    const options = productionOptions(city);
    const current = ensureCityProduction(city);
    const colorHex = this._ownerColor();
    const skin = skinForPlayer(city.ownerId);

    const xs = [0];
    const firstOptionX = SLOT_SPACING + CURRENT_GAP;
    for (let i = 0; i < options.length; i++) {
      xs.push(firstOptionX + i * SLOT_SPACING);
    }

    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const centered = xs.map(x => x - mean);

    const currentX = centered[0];
    const holderCurrent = new THREE.Group();
    const currentMesh = skin.build(current, colorHex);
    holderCurrent.add(currentMesh);
    holderCurrent.position.x = currentX;
    holderCurrent.scale.setScalar(1.0);
    holderCurrent.userData = { type: 'unit-current', typeKey: current };
    this._unitsRoot.add(holderCurrent);
    this._unitNodes.push({ holder: holderCurrent, typeKey: current, isCurrent: true });

    const backdrop = makeProductionBackdrop();
    backdrop.position.set(currentX, 0.56, -0.5);
    this._unitsRoot.add(backdrop);

    if (current) {
      const label = makeUnitLabel(
        UNIT_TYPES[current]?.name ?? current,
        `${productionTurns(current)} кр.`
      );
      label.position.set(currentX, 1.62, 0);
      this._unitsRoot.add(label);
    }

    options.forEach((typeKey, i) => {
      const holder = new THREE.Group();
      const mesh = skin.build(typeKey, colorHex);
      holder.add(mesh);
      holder.position.x = centered[i + 1];
      holder.scale.setScalar(0.80);
      holder.userData = { type: 'unit-option', typeKey, index: i };
      this._unitsRoot.add(holder);
      this._unitNodes.push({ holder, typeKey, isCurrent: false });

      const label = makeUnitLabel(
        UNIT_TYPES[typeKey]?.name ?? typeKey,
        `${productionTurns(typeKey)} кр.`
      );
      label.position.set(holder.position.x, 1.52, 0);
      this._unitsRoot.add(label);
    });

    // Кольцо выбора — на юните, по которому кликнул игрок
    // (по умолчанию — на юните текущего производства).
    const ringKey = (this._selType && options.includes(this._selType))
      ? this._selType
      : current;
    const ringIdx = options.indexOf(ringKey);
    if (ringIdx >= 0) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.38, 28),
        new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.95 })
      );
      ring.geometry.rotateX(-Math.PI / 2);
      ring.position.set(centered[ringIdx + 1], 0.04, 0);
      this._unitsRoot.add(ring);
    }

    this._refreshProductionBar();
  }

  _clearModels() {
    if (this._cityRoot) {
      this._cityScene.remove(this._cityRoot);
      disposeTree(this._cityRoot);
      this._cityRoot.clear();
      this._cityRoot = null;
    }
    if (this._unitsRoot && this._unitsRoot.children.length) {
      disposeTree(this._unitsRoot);
      this._unitsRoot.clear();
    }
    this._unitNodes = [];
  }

  /* =========================================================
     Клик по модели юнита в наборе → в текущее производство
     ========================================================= */
  _onUnitsClick(e) {
    if (!this._unitsRoot || !this._unitsCam) return;

    const r = this._unitsCanvas.getBoundingClientRect();
    this._mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this._mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this._unitsCam);
    const hits = this._raycaster.intersectObject(this._unitsRoot, true);

    let typeKey = null;
    for (const hit of hits) {
      let o = hit.object;
      while (o && o !== this._unitsRoot) {
        if (o.userData?.type === 'unit-option') {
          typeKey = o.userData.typeKey;
          break;
        }
        o = o.parent;
      }
      if (typeKey) break;
    }
    if (!typeKey) return;

    this._selectProduction(typeKey);
  }

  _selectProduction(typeKey) {
    if (!this._city || !UNIT_TYPES[typeKey]) return;

    this._selType = typeKey;

    // Новый тип в слоте — счётчик кругов начинается заново.
    if (this._city.production !== typeKey) {
      if (!setCityProduction(this._city, typeKey)) return;
      SND.clickUnit.play();
    }

    this._buildUnitsRow();
    this._refreshStats();
  }

  /* =========================================================
     Подгонка камер и цикл рендера
     ========================================================= */
  _fitCityCamera() {
    const w = this._cityCanvas.clientWidth;
    const h = this._cityCanvas.clientHeight;
    if (!w || !h) return;

    const size = this._cityRenderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) this._cityRenderer.setSize(w, h, false);

    const aspect = w / h;
    let halfH = 1.50;
    let halfW = halfH * aspect;
    if (halfW < 1.50) {
      halfW = 1.50;
      halfH = halfW / aspect;
    }

    this._cityCam.left = -halfW;
    this._cityCam.right = halfW;
    this._cityCam.top = halfH;
    this._cityCam.bottom = -halfH;
    this._cityCam.updateProjectionMatrix();
  }

  _fitUnitsCamera() {
    const w = this._unitsCanvas.clientWidth;
    const h = this._unitsCanvas.clientHeight;
    if (!w || !h) return;

    const size = this._unitsRenderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) this._unitsRenderer.setSize(w, h, false);

    const aspect = w / h;
    const maxAbsX = this._unitNodes.reduce(
      (m, n) => Math.max(m, Math.abs(n.holder.position.x)),
      0,
    );
    const halfRow = maxAbsX + 0.90;

    let halfH = 1.45;
    let halfW = halfH * aspect;
    if (halfW < halfRow) {
      halfW = halfRow;
      halfH = halfW / aspect;
    }

    this._unitsCam.left = -halfW;
    this._unitsCam.right = halfW;
    this._unitsCam.top = halfH;
    this._unitsCam.bottom = -halfH;
    this._unitsCam.updateProjectionMatrix();
  }

  /**
   * Пока панель открыта, счётчик кругов может измениться (например,
   * игрок завершил ход клавишей). Обновляем статы только при изменении,
   * чтобы не дёргать DOM каждый кадр.
   */
  _maybeRefreshProduction(now) {
    if (!this._city) return;
    if (now - this._lastProdRefresh < 400) return;
    this._lastProdRefresh = now;

    const city = this._city;
    const garrison = this._cityArmyStats();
    const key = [
      city.production,
      city.productionTurnsLeft,
      city.productionTurnsTotal,
      city.ownerId,
      garrison.armies,
      garrison.units,
    ].join('|');

    if (key === this._prodKey) return;
    this._prodKey = key;

    this._refreshStats();
    this._refreshProductionBar();
  }

  _startLoop() {
    const loop = () => {
      if (!this._open) return;

      this._fitCityCamera();
      this._fitUnitsCamera();

      if (this._cityRoot) this._cityRoot.rotation.y += 0.004;

      this._cityRenderer.render(this._cityScene, this._cityCam);
      this._unitsRenderer.render(this._unitsScene, this._unitsCam);

      this._maybeRefreshProduction(performance.now());

      this._raf = requestAnimationFrame(loop);
    };
    loop();
  }
}

/* =========================================================
   Утилиты
   ========================================================= */
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

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
