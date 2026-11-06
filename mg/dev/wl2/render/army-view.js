// render/army-view.js
//
// ТЗ:
//  - при клике на модельке армии открывается панель
//  - фигурка армии это первая модель юнита в массиве армии.
//  - армия состоит из юнитов которые в массиве
//  - открывшая панель с армией содержит:
//      -   все модельки юнитов (ряд слева направо как в массиве)
//      -   общие статы армии
//      -   при клике на модель юнита, отображаются статы этого юнита.
//
// Визуал: тёмная модальная панель 80vw×70vh по центру экрана,
// кнопка ✕ и Esc закрывают. Стили инжектятся один раз в <head>.

import * as THREE from 'three';
import { skinForPlayer, disposeTree } from './r-units-view.js';

/** Шаг сетки между юнитами в панели (мировые единицы мини-сцены) */
const ROW_SPACING = 1.0;

const STYLE_ID = 'army-view-styles';

const CSS = `

/* скроллбары под общий тёмный стиль панели */
.av-backdrop * {
  scrollbar-width: thin;
  scrollbar-color: #2a3440 #141925;
}
.av-backdrop *::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.av-backdrop *::-webkit-scrollbar-track {
  background: #141925;
  border-radius: 6px;
}
.av-backdrop *::-webkit-scrollbar-thumb {
  background: #2a3440;
  border-radius: 6px;
  border: 2px solid #141925;
}
.av-backdrop *::-webkit-scrollbar-thumb:hover {
  background: #3a4755;
}
.av-backdrop *::-webkit-scrollbar-corner {
  background: #141925;
}

.av-backdrop {
  position: fixed; inset: 0;
  background: rgba(8, 10, 16, .55);
  backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  opacity: 0; pointer-events: none;
  transition: opacity .18s ease;
}
.av-backdrop.open { opacity: 1; pointer-events: auto; }

.av-panel {
  width: 80vw; height: 70vh;
  min-width: 480px; min-height: 320px;
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
.av-backdrop.open .av-panel { transform: translateY(0) scale(1); }

.av-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(120,150,200,.18);
  background: rgba(255,255,255,.02);
}
.av-swatch {
  width: 14px; height: 14px; border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(0,0,0,.35) inset, 0 0 12px currentColor;
  flex: 0 0 auto;
}
.av-title  { font-size: 16px; font-weight: 700; letter-spacing: .2px; }
.av-sub    { font-size: 12px; color: #97a3b6; }

.av-close {
  margin-left: auto;
  height: 32px; border-radius: 8px;
  border: 1px solid rgba(120,150,200,.3);
  background: rgba(255,255,255,.03);
  color: #cfd7e3; cursor: pointer; font-size: 18px; line-height: 1;
  display: grid; place-items: center;
  transition: background .15s, color .15s, transform .1s;
}
.av-close:hover  { background: rgba(220,80,80,.15); color: #ff9a9a; }
.av-close:active { transform: scale(.95); }

.av-body {
  flex: 1 1 auto; min-height: 0;
  display: grid;
  grid-template-columns: minmax(260px, 320px) 1fr;
  gap: 0;
}
@media (max-width: 720px) {
  .av-body { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
}

.av-side {
  padding: 16px;
  border-right: 1px solid rgba(120,150,200,.15);
  overflow: auto;
  background: rgba(255,255,255,.015);
}
.av-main {
  padding: 16px 18px; overflow: auto;
  display: flex; flex-direction: column; gap: 12px;
  min-height: 0;
}

.av-section h4 {
  margin: 14px 0 8px;
  font-size: 11px; text-transform: uppercase; letter-spacing: .12em;
  color: #7f8da3; font-weight: 600;
}
.av-section h4:first-child { margin-top: 0; }

.av-row {
  display: flex; justify-content: space-between; gap: 10px;
  padding: 5px 0;
  border-bottom: 1px dashed rgba(120,150,200,.12);
  font-size: 13px;
}
.av-row .k { color: #8d9bb1; }
.av-row .v { color: #e8ecf3; font-variant-numeric: tabular-nums; }
.av-row .v.good { color: #7ee0a0; }
.av-row .v.warn { color: #f0b070; }
.av-row .v.bad  { color: #ff8a8a; }

.av-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.av-chip {
  padding: 2px 8px; border-radius: 999px;
  background: rgba(120,150,200,.14);
  border: 1px solid rgba(120,150,200,.25);
  font-size: 12px; color: #cfd7e3;
}
.av-chip.hero { background: rgba(220,180,80,.16); border-color: rgba(220,180,80,.4); color: #f0c866; }

/* Сцена с моделями юнитов */
.av-row-canvas {
  display: block; width: 100%;
  flex: 1 1 auto; min-height: 180px;
  background:
    linear-gradient(rgba(13,18,24,.35), rgba(13,18,24,.55)),
    url("./res/img/bg2.jpg") center / cover no-repeat;
  border: 1px solid rgba(120,150,200,.18);
  border-radius: 10px;
  cursor: pointer;
}

.av-unit-stats {
  padding: 10px 12px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(120,150,200,.18);
  border-radius: 10px;
  min-height: 64px;
  font-size: 13px;
  line-height: 1.55;
}
.av-unit-stats .muted { color: #8a97a5; font-style: italic; }
.av-unit-stats b { color: #f0c866; }
.av-unit-stats .star { color: #ffd166; font-weight: 700; }

.av-empty {
  padding: 24px; text-align: center; color: #7f8da3; font-style: italic;
}
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* =========================================================
   ArmyView — панель состава армии.
   ========================================================= */
export class ArmyView {
  /**
   * @param {MapView} mapView
   * @param {Object} [opts]
   * @param {Function} [opts.getPlayers]  — () => Players (для цвета/имени владельца)
   * @param {HTMLElement} [opts.container] — куда вставить панель (по умолчанию body)
   */
  constructor(mapView, opts = {}) {
    this.mapView   = mapView;
    this.getPlayers = opts.getPlayers ?? (() => mapView.players ?? null);

    this._raycaster = new THREE.Raycaster();
    this._mouse     = new THREE.Vector2();

    /** открыто ли сейчас */
    this._open   = false;
    this._army   = null;
    this._raf    = null;
    this._selIdx = -1;

    ensureStyles();
    this._buildPanel(opts.container ?? document.body);
    this._bindMapClick();
  }

  /* =========================================================
     DOM панели — новая визуализация
     ========================================================= */
  _buildPanel(container) {
    // backdrop
    const back = document.createElement('div');
    back.className = 'av-backdrop';
    this._backdrop = back;

    // panel
    const panel = document.createElement('div');
    panel.className = 'av-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    back.appendChild(panel);

    // header
    const head = document.createElement('div');
    head.className = 'av-header';

    const swatch = document.createElement('span');
    swatch.className = 'av-swatch';
    this._ownerSwatch = swatch;

    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'av-title';
    title.textContent = '—';
    this._titleEl = title;

    const sub = document.createElement('div');
    sub.className = 'av-sub';
    sub.textContent = '—';
    this._subEl = sub;

    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'av-close';
    close.title = 'Закрыть (Esc)';
    close.textContent = 'ЗАКРЫТЬ';
    close.addEventListener('click', () => this.close());

    head.appendChild(swatch);
    head.appendChild(titleWrap);
    head.appendChild(close);
    panel.appendChild(head);

    // body: left side (сводка) + main (ряд + статы)
    const body = document.createElement('div');
    body.className = 'av-body';
    panel.appendChild(body);

    const side = document.createElement('aside');
    side.className = 'av-side';
    this._armyStatsEl = side;
    body.appendChild(side);

    const main = document.createElement('main');
    main.className = 'av-main';
    body.appendChild(main);

    // canvas с моделями
    const canvas = document.createElement('canvas');
    canvas.className = 'av-row-canvas';
    canvas.addEventListener('pointerdown', (e) => this._onRowClick(e));
    this._canvas = canvas;
    main.appendChild(canvas);

    // статы выбранного юнита
    const unitStats = document.createElement('div');
    unitStats.className = 'av-unit-stats';
    this._unitStatsEl = unitStats;
    main.appendChild(unitStats);

    // закрытие по клику на backdrop и по Esc
    back.addEventListener('click', (e) => {
      if (e.target === back) this.close();
    });
    this._onEsc = (e) => { if (e.key === 'Escape' && this._open) this.close(); };
    document.addEventListener('keydown', this._onEsc);

    container.appendChild(back);
    this._root = back;

    // мини-рендерер для панели (создаётся один раз, переиспользуется)
    this._rowRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this._rowRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._rowRenderer.setClearColor(0x000000, 0);

    // кольцо выбора юнита в панели
    const ringGeo = new THREE.RingGeometry(0.34, 0.40, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this._selRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 })
    );
    this._selRing.visible = false;
  }

  /* =========================================================
     Клик по модельке армии на карте
     ========================================================= */
  _bindMapClick() {
    const dom = this.mapView.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const army = this._pickArmy(e);
      if (army) this.show(army);
    });
  }

  /** Raycast по слою армий (UnitsView), подъём до узла с userData.type='army' */
  _pickArmy(e) {
    const unitsView = this.mapView.unitsView;
    if (!unitsView) return null;

    const r = this.mapView.renderer.domElement.getBoundingClientRect();
    this._mouse.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
    this._mouse.y = -((e.clientY - r.top)  / r.height) * 2 + 1;

    const cam = this.mapView.renderer.mode === 'top'
      ? this.mapView.renderer.cameraTop
      : this.mapView.renderer.cameraOrbit;
    this._raycaster.setFromCamera(this._mouse, cam);

    const hits = this._raycaster.intersectObject(unitsView.group, true);
    if (!hits.length) return null;

    let o = hits[0].object;
    while (o && o.userData?.type !== 'army') o = o.parent;
    const army = o?.userData?.army;
    return army?.alive ? army : null;
  }

  /* =========================================================
     Открытие / закрытие панели
     ========================================================= */
  show(army) {
    if (!army || !army.units?.length) return;
    this.close();
    this._army   = army;
    this._open   = true;
    this._selIdx = -1;
    this._root.classList.add('open');

    this._buildRowScene();
    this._refreshArmyStats();
    this._refreshTitle();
    this._showHint();

    this._startLoop();
  }

  close() {
    this._open = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this._rowScene) {
      // диспоузим только прямых детей сцены, _selRing не трогаем —
      // он переиспользуется между открытиями панели
      this._rowScene.children.forEach(o => { if (o !== this._selRing) disposeTree(o); });
      this._rowScene.clear();
      this._rowScene = null;
    }
    this._rowNodes = [];
    this._root.classList.remove('open');
  }

  destroy() {
    this.close();
    document.removeEventListener('keydown', this._onEsc);
    this._rowRenderer?.dispose?.();
    this._root?.remove?.();
  }

  /* =========================================================
     Мини-сцена: ряд моделей юнитов слева направо как в массиве
     ========================================================= */
  _buildRowScene() {
    const army = this._army;

    this._rowScene = new THREE.Scene();
    this._rowScene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(3, 5, 4);
    this._rowScene.add(dir);
    this._rowScene.add(this._selRing);
    this._selRing.visible = false;

    const players = this.getPlayers();
    const player  = players?.get?.(army.idOwner) ?? players?.list?.[army.idOwner];
    const colorHex = player?.color ?? 0x9aa4ad;
    const skin = skinForPlayer(army.idOwner);

    const units = army.units.filter(u => u.alive);
    this._rowNodes = [];

    units.forEach((u, i) => {
      const mesh = skin.build(u.typeKey, colorHex);
      const holder = new THREE.Group();
      holder.add(mesh);
       holder.scale.setScalar(0.7); 
      holder.position.x = (i - (units.length - 1) / 2) * ROW_SPACING;
      holder.userData = { type: 'unit', unit: u, index: i };
      this._rowScene.add(holder);
      this._rowNodes.push(holder);
    });

    this._rowCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    // лёгкий наклон сверху: иначе горизонтальное кольцо видно «в ребро»
    this._rowCam.position.set(0, 2.6, 5.0);
    this._rowCam.lookAt(0, 0.55, 0);
  }

  /** подгон фрустума мини-камеры под ширину ряда и размер канваса */
  _fitRowCamera() {
    const w = this._canvas.clientWidth, h = this._canvas.clientHeight;
    if (!w || !h) return;
    const size = this._rowRenderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) this._rowRenderer.setSize(w, h, false);

    const aspect  = w / h;
    const halfH   = 0.95;
    const halfRow = (this._rowNodes.length * ROW_SPACING) / 2 + 0.15;
    const halfW   = Math.max(halfRow, halfH * aspect);

    this._rowCam.left = -halfW; this._rowCam.right = halfW;
    this._rowCam.top  =  halfH; this._rowCam.bottom = -halfH;
    this._rowCam.updateProjectionMatrix();
  }

  _startLoop() {
    const loop = () => {
      if (!this._open) return;
      this._fitRowCamera();
      this._rowRenderer.render(this._rowScene, this._rowCam);
      this._raf = requestAnimationFrame(loop);
    };
    loop();
  }

  /* =========================================================
     Клик по модельке юнита в панели
     ========================================================= */
  _onRowClick(e) {
    const r = this._canvas.getBoundingClientRect();
    this._mouse.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
    this._mouse.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
    this._raycaster.setFromCamera(this._mouse, this._rowCam);

    const hits = this._raycaster.intersectObject(this._rowScene, true);
    if (!hits.length) return;

    let o = hits[0].object;
    while (o && o.userData?.type !== 'unit') o = o.parent;
    if (!o) return;

    this._selectUnit(o);
  }

  _selectUnit(holder) {
    const { unit, index } = holder.userData;
    this._selIdx = index;

    this._selRing.visible = true;
    this._selRing.position.set(holder.position.x, 0.05, 0);

    this._showUnitStats(unit, index);
  }

  /* =========================================================
     Отображение статов
     ========================================================= */
  _refreshTitle() {
    const army = this._army;
    const players = this.getPlayers();
    const player  = players?.get?.(army.idOwner) ?? players?.list?.[army.idOwner];
    const colorNum = player?.color ?? 0x9aa4ad;
    const color = '#' + (colorNum >>> 0).toString(16).padStart(6, '0');

    this._ownerSwatch.style.background = color;
    this._ownerSwatch.style.color      = color; // для glow

    const name = player?.name ?? `Игрок ${army.idOwner}`;
    const head = army.units.find(u => u.alive);

    this._titleEl.textContent = `Армия #${army.id}`;
    this._subEl.textContent   = head
      ? `${name} · ${head.name}`
      : name;
  }

  _refreshArmyStats() {
    const army = this._army;
    const total = army.units.length;
    const aliveUnits = army.units.filter(u => u.alive);
    const alive = aliveUnits.length;
    const str = aliveUnits.reduce((s, u) => s + u.effectiveStrength, 0);
    const move = aliveUnits.reduce((m, u) => Math.min(m, u.moveLeft), Infinity);
    const mp = Number.isFinite(move) ? move : 0;
    const mpClass = mp <= 0 ? 'bad' : (mp < 3 ? 'warn' : 'good');

    const route = army.route ?? [];
    const goal  = army.cellGoal
      ? `(${army.cellGoal.x}, ${army.cellGoal.y})`
      : (route.length ? `(${route[route.length - 1].x}, ${route[route.length - 1].y})` : '—');

    const heroes = aliveUnits.filter(u => u.isHero);
    const heroChips = heroes.map(u =>
      `<span class="av-chip hero">${escapeHtml(u.name ?? 'Герой')}</span>`).join('');

    this._armyStatsEl.innerHTML = `
      <div class="av-section">
        <h4>Общее</h4>
        <div class="av-row"><span class="k">Позиция</span><span class="v">(${army.x}, ${army.y})</span></div>
        <div class="av-row"><span class="k">Сила стека</span><span class="v good">${str}</span></div>
        <div class="av-row"><span class="k">Юнитов</span><span class="v">${alive} / ${total}</span></div>
        <div class="av-row"><span class="k">Очки хода</span><span class="v ${mpClass}">${mp}</span></div>
      </div>

      <div class="av-section">
        <h4>Маршрут</h4>
        <div class="av-row"><span class="k">Шагов</span><span class="v">${route.length}</span></div>
        <div class="av-row"><span class="k">Цель</span><span class="v">${escapeHtml(goal)}</span></div>
      </div>

      ${heroes.length ? `
      <div class="av-section">
        <h4>Герои</h4>
        <div class="av-chips">${heroChips}</div>
      </div>` : ''}
    `;
  }

  _showHint() {
    this._unitStatsEl.innerHTML =
      `<div class="muted">Кликните по фигурке юнита, чтобы увидеть его статы.</div>`;
    this._selRing.visible = false;
  }

  _showUnitStats(unit, index) {
    const mods = [
      unit.blessed  ? 'освящён +1' : null,
      unit.encamped ? 'окопан +1'  : null,
      unit.bonus    ? `бонус +${unit.bonus}` : null,
    ].filter(Boolean).join(', ');

    this._unitStatsEl.innerHTML = `
      <div><b>#${index + 1} ${escapeHtml(unit.name ?? unit.typeKey ?? '—')}</b>
        ${unit.isHero ? '<span class="star">★ ГЕРОЙ</span>' : ''}</div>
      <div>Сила: <b>${unit.effectiveStrength}</b> (база ${unit.strength}${mods ? '; ' + escapeHtml(mods) : ''})</div>
      <div>Атака: <b>${unit.damage ?? 1}</b> &nbsp; Защита: <b>${unit.defense ?? 1}</b></div>
      <div>HP: <b>${unit.hp}/${unit.maxHp}</b> &nbsp; Ход: <b>${unit.moveLeft}/${unit.move}</b></div>
    `;
  }
}

/* =========================================================
   Вспомогательное — экранирование текста в innerHTML
   ========================================================= */
function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}