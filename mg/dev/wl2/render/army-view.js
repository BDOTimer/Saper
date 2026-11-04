// render/army-view.js
// ТЗ:
//  - при клике на модельке армии открывается панель
//  - фигурка армии это первая модель юнита в массиве армии.
//  - армия состоит из юнитов которые в массиве
//  - открывшая панель с армией содержит:
//      -   все модельки юнитов
//      -   юниты стоят в ряд в порядке слева на право как в массиве
//      -   отображаются общие статы армии
//      -   при клике на модели юнита, отображаются статы этого юнита.

import * as THREE from 'three';
import { skinForPlayer, disposeTree } from './r-units-view.js';

/** Шаг сетки между юнитами в панели (мировые единицы мини-сцены) */
const ROW_SPACING = 1.0;

/* =========================================================
   ArmyView — панель состава армии.
   Ловит клики по моделькам армий на карте и открывает DOM-панель:
   мини-3D-сцена с рядком моделей юнитов + статы армии и выбранного юнита.
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

    this._buildPanel(opts.container ?? document.body);
    this._bindMapClick();
  }

  /* =========================================================
     DOM панели
     ========================================================= */
  _buildPanel(container) {
    const root = document.createElement('div');
    root.style.cssText = `
      position: fixed; top: 60px; right: 12px; width: 380px;
      background: rgba(10,14,18,0.95); color: #e6edf3;
      border: 1px solid #2a3440; border-radius: 10px;
      font: 13px/1.4 system-ui, sans-serif; z-index: 60;
      box-shadow: 0 6px 24px rgba(0,0,0,0.5);
      display: none; user-select: none;
    `;
    this._root = root;

    // заголовок + кнопка закрыть
    const head = document.createElement('div');
    head.style.cssText = `
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-bottom: 1px solid #2a3440;
    `;
    const swatch = document.createElement('span');
    swatch.style.cssText = 'width:12px;height:12px;border-radius:3px;flex:0 0 auto;';
    this._ownerSwatch = swatch;

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    this._titleEl = title;

    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = `
      background:#1a222b;color:#e6edf3;border:1px solid #2a3440;border-radius:6px;
      width:24px;height:24px;cursor:pointer;font-size:12px;
    `;
    close.addEventListener('click', () => this.close());

    head.appendChild(swatch);
    head.appendChild(title);
    head.appendChild(close);
    root.appendChild(head);

    // общие статы армии
    const stats = document.createElement('div');
    stats.style.cssText = 'padding:8px 12px;border-bottom:1px solid #2a3440;';
    this._armyStatsEl = stats;
    root.appendChild(stats);

    // мини-сцена: ряд моделей юнитов
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
      display:block;width:100%;height:190px;cursor:pointer;
      background:#0d1218;border-bottom:1px solid #2a3440;
    `;
    this._canvas = canvas;
    canvas.addEventListener('pointerdown', (e) => this._onRowClick(e));
    root.appendChild(canvas);

    // статы выбранного юнита
    const us = document.createElement('div');
    us.style.cssText = 'padding:8px 12px;min-height:64px;';
    this._unitStatsEl = us;
    root.appendChild(us);

    container.appendChild(root);

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
    this.close();                       // на случай повторного клика по другой армии
    this._army   = army;
    this._open   = true;
    this._selIdx = -1;
    this._root.style.display = 'block';

    this._buildRowScene();
    this._refreshArmyStats();
    this._refreshTitle();
    this._showHint();                   // «кликните по фигурке юнита...»

    this._startLoop();
  }

  close() {
    this._open = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this._rowScene) {
      this._rowScene.traverse(o => { if (o !== this._selRing) disposeTree(o); });
      this._rowScene.clear();
      this._rowScene = null;
    }
    this._rowNodes = [];
    this._root.style.display = 'none';
  }

  destroy() {
    this.close();
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

    // цвет скина по владельцу армии
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
      // слева направо — порядок как в массиве армии
      holder.position.x = (i - (units.length - 1) / 2) * ROW_SPACING;
      holder.userData = { type: 'unit', unit: u, index: i };
      this._rowScene.add(holder);
      this._rowNodes.push(holder);
    });

    // камера панели
    this._rowCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this._rowCam.position.set(0, 0.7, 6);
    this._rowCam.lookAt(0, 0.7, 0);
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

    // кольцо под выбранной фигуркой
    this._selRing.visible = true;
    this._selRing.position.set(holder.position.x, 0.02, 0);

    this._showUnitStats(unit, index);
  }

  /* =========================================================
     Отображение статов
     ========================================================= */
  _refreshTitle() {
    const army = this._army;
    const players = this.getPlayers();
    const player  = players?.get?.(army.idOwner) ?? players?.list?.[army.idOwner];
    const color = '#' + (player?.color ?? 0x9aa4ad).toString(16).padStart(6, '0');

    this._ownerSwatch.style.background = color;
    const name = player?.name ?? `Игрок ${army.idOwner}`;
    // фигурка армии = первая модель в массиве (heads-up в заголовке)
    const head = army.units.find(u => u.alive);
    this._titleEl.textContent = `Армия #${army.id} — ${name}` + (head ? ` (${head.name})` : '');
  }

  _refreshArmyStats() {
    const army = this._army;
    const total = army.units.length;
    const alive = army.units.filter(u => u.alive).length;
    const str = army.units.filter(u => u.alive).reduce((s, u) => s + u.effectiveStrength, 0);
    const move = army.units.filter(u => u.alive).reduce((m, u) => Math.min(m, u.moveLeft), Infinity);

    this._armyStatsEl.innerHTML = `
      <div>Юнитов: <b>${alive}/${total}</b> &nbsp; Сила: <b>${str}</b></div>
      <div>Ход (осталось): <b>${Number.isFinite(move) ? move : 0}</b> &nbsp; Клетка: <b>${army.x}, ${army.y}</b></div>
    `;
  }

  _showHint() {
    this._unitStatsEl.innerHTML = `
      <div class="muted" style="color:#8a97a5;">Кликните по фигурке юнита, чтобы увидеть его статы.</div>
    `;
    this._selRing.visible = false;
  }

  _showUnitStats(unit, index) {
    const mods = [
      unit.blessed  ? 'освящён +1' : null,
      unit.encamped ? 'окопан +1'  : null,
      unit.bonus    ? `бонус +${unit.bonus}` : null,
    ].filter(Boolean).join(', ');

    this._unitStatsEl.innerHTML = `
      <div><b>#${index + 1} ${unit.name}</b>${unit.isHero ? ' <span style="color:#ffd166;">★ ГЕРОЙ</span>' : ''}</div>
      <div>Сила: <b>${unit.effectiveStrength}</b> (база ${unit.strength}${mods ? '; ' + mods : ''})</div>
      <div>HP: <b>${unit.hp}/${unit.maxHp}</b> &nbsp; Ход: <b>${unit.moveLeft}/${unit.move}</b></div>
    `;
  }
}
