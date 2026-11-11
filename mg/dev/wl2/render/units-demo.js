//  render/units-demo.js
//
//  ТЗ:
//  -   Панель показывающая модели юнитов крупным планом в редакторе карт.
//  -   данная панель отрывается кнопкой "ЮНИТЫ" в верхней части hud редактора карт.
//  -   функция увеличение/уменьшения визулаьного отображения модели.
//  -   на панели можно выбрать отображаемого юнита из списка юнитов.
//  -   также панель содержит всю инфу о статах выбранного юнита.
//  -   ...
//
//  Реализация:
//  -   панель самодостаточна: свой мини-рендерер, сцена, камера и свет;
//  -   WebGL-контекст создаётся лениво при первом открытии;
//  -   список юнитов строится из UNIT_TYPES (сортировка по id);
//  -   модель строится через UNIT_SKINS.default.build(typeKey, colorHex);
//  -   зум — колесо мыши или кнопки −/+ (камера, 30%..450%);
//  -   вращение — зажать ЛКМ и вести; без вращения модель крутится сама;
//  -   idle-анимация призрака/волшебника повторяет UnitsView.update();
//  -   при destroy() освобождаются geometry/material/texture и WebGL-контекст.

import * as THREE from 'three';
import { UNIT_TYPES } from '../core/units.js';
import { UNIT_SKINS, disposeTree } from './r-units-view.js';
import { SND } from '../res/snd/--sound-lib.js';

const STYLE_ID = 'units-demo-styles';

const ZOOM_MIN = 0.30;
const ZOOM_MAX = 4.50;
const ZOOM_WHEEL_STEP = 0.0015;
const ZOOM_BUTTON_STEP = 1.25;
const SPIN_SPEED = 0.45;          // рад/сек, автовращение модели
const PITCH_DEFAULT = 0.24;
const PITCH_MIN = 0.02;
const PITCH_MAX = 1.12;

/** Юниты-монстры — в списке помечаются 👻. */
const MONSTER_KEYS = new Set(['GHOST', 'WIZARD', 'DRAGON']);

const CSS = `
.ud-backdrop {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(8, 10, 16, .62);
  backdrop-filter: blur(3px);
  z-index: 1040;
  opacity: 0; pointer-events: none;
  transition: opacity .18s ease;
}
.ud-backdrop.open { opacity: 1; pointer-events: auto; }

.ud-panel {
  width: 88vw; height: 95vh;
  min-width: 720px; min-height: 440px;
  display: flex; flex-direction: column;
  overflow: hidden;
  color: #e8ecf3;
  border: 1px solid rgba(120,150,200,.25);
  border-radius: 14px;
  background:
    linear-gradient(160deg, rgba(27,33,48,.55) 0%, rgba(20,25,37,.78) 100%),
    url("./res/img/bg1.jpg") center / cover no-repeat;
  box-shadow: 0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.02) inset;
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  transform: translateY(8px) scale(.985);
  transition: transform .2s ease;
}
.ud-backdrop.open .ud-panel { transform: translateY(0) scale(1); }

.ud-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(120,150,200,.18);
  background: rgba(255,255,255,.02);
}
.ud-title { font-size: 16px; font-weight: 700; letter-spacing: .3px; }
.ud-sub   { font-size: 12px; color: #97a3b6; }

.ud-close {
  margin-left: auto;
  height: 32px; padding: 0 14px; border-radius: 8px;
  border: 1px solid rgba(120,150,200,.3);
  background: rgba(255,255,255,.03);
  color: #cfd7e3; cursor: pointer; font-size: 12px; font-weight: 700;
  letter-spacing: .04em;
  transition: background .15s, color .15s, transform .1s;
}
.ud-close:hover  { background: rgba(220,80,80,.15); color: #ff9a9a; }
.ud-close:active { transform: scale(.95); }

.ud-body {
  flex: 1 1 auto; min-height: 0;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr) 280px;
}

.ud-list {
  overflow-y: auto;
  padding: 10px;
  border-right: 1px solid rgba(120,150,200,.16);
  background: rgba(8,12,18,.28);
}
.ud-list-title {
  padding: 2px 8px 8px;
  font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
  color: #7f8da3;
}
.ud-item {
  display: flex; flex-direction: column; gap: 2px;
  width: 100%; margin: 0 0 4px; padding: 7px 10px;
  text-align: left; cursor: pointer; font: inherit; color: #cfd7e3;
  background: rgba(255,255,255,.025);
  border: 1px solid transparent; border-radius: 8px;
  transition: background .15s, border-color .15s;
}
.ud-item:hover { background: rgba(120,160,220,.12); }
.ud-item.selected {
  background: rgba(46,139,255,.16);
  border-color: #4aa3ff;
}
.ud-item-name { font-size: 13px; font-weight: 600; }
.ud-item-meta { font-size: 11px; color: #8fa0b6; }
.ud-item.selected .ud-item-meta { color: #a9c8ee; }

.ud-stage {
  position: relative; min-width: 0; overflow: hidden;
  background: radial-gradient(circle at 50% 42%, rgba(74,163,255,.12), rgba(6,9,14,.15) 62%);
}
.ud-canvas {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  display: block; cursor: grab; touch-action: none;
}
.ud-canvas:active { cursor: grabbing; }

.ud-hint {
  position: absolute; top: 12px; left: 14px;
  font-size: 11px; color: #7f8da3; pointer-events: none;
}

.ud-zoombar {
  position: absolute; right: 14px; bottom: 14px;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(8,12,18,.72);
  border: 1px solid rgba(120,150,200,.25);
  backdrop-filter: blur(6px);
}
.ud-zbtn {
  height: 28px; min-width: 30px; padding: 0 8px;
  border-radius: 6px; cursor: pointer;
  border: 1px solid rgba(120,150,200,.3);
  background: rgba(255,255,255,.04);
  color: #cfd7e3; font: inherit; font-weight: 700; font-size: 14px;
  transition: background .15s;
}
.ud-zbtn:hover { background: rgba(120,160,220,.18); }
.ud-zval {
  min-width: 54px; text-align: center;
  color: #ffd166; font-weight: 700; font-variant-numeric: tabular-nums;
}

.ud-stats {
  overflow-y: auto;
  padding: 14px 16px;
  border-left: 1px solid rgba(120,150,200,.16);
  background: rgba(8,12,18,.32);
}
.ud-unitname { font-size: 18px; font-weight: 700; color: #ffd166; }
.ud-unitsub  { margin: 2px 0 12px; font-size: 12px; color: #8fa0b6; }
.ud-stat {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  padding: 6px 0;
  border-bottom: 1px dashed rgba(120,150,200,.14);
  font-size: 13px; color: #aebbd0;
}
.ud-stat b { color: #e8ecf3; font-variant-numeric: tabular-nums; }
.ud-stat.is-hero b { color: #ffd166; }

.ud-list, .ud-stats {
  scrollbar-width: thin;
  scrollbar-color: #2a3440 #141925;
}
.ud-list::-webkit-scrollbar, .ud-stats::-webkit-scrollbar { width: 10px; }
.ud-list::-webkit-scrollbar-track, .ud-stats::-webkit-scrollbar-track {
  background: #141925; border-radius: 6px;
}
.ud-list::-webkit-scrollbar-thumb, .ud-stats::-webkit-scrollbar-thumb {
  background: #2a3440; border-radius: 6px; border: 2px solid #141925;
}
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* =========================================================
   UnitsDemo — панель-витрина моделей юнитов для редактора карт.
   ========================================================= */
export class UnitsDemo {
  /**
   * @param {Object} [opts]
   * @param {HTMLElement} [opts.parent=document.body] — куда монтировать панель
   * @param {number} [opts.colorHex]        — цвет юнита (по умолчанию стальной)
   * @param {Function} [opts.onOpenChange]  — (isOpen) => void, для кнопки в HUD
   */
  constructor({ parent = document.body, colorHex = 0x9aa4ad, onOpenChange = null } = {}) {
    this._parent = parent;
    this._colorHex = colorHex;
    this._onOpenChange = onOpenChange;

    this._open = false;
    this._currentKey = null;
    this._keys = Object.keys(UNIT_TYPES)
      .filter(k => UNIT_TYPES[k])
      .sort((a, b) => (UNIT_TYPES[a].id ?? 0) - (UNIT_TYPES[b].id ?? 0));

    this._zoom = 1;
    this._pitch = PITCH_DEFAULT;
    this._cameraYaw = 0.55;
    this._modelYaw = 0;
    this._target = new THREE.Vector3(0, 0.5, 0);
    this._baseDist = 3;
    this._time = 0;
    this._drag = null;
    this._raf = null;
    this._lastNow = 0;

    this._model = null;
    this._modelInner = null;
    this._renderer = null;
    this._size = new THREE.Vector2();
    this._sphere = new THREE.Sphere();

    ensureStyles();
    this._buildPanel(parent);
    this._buildScene();
    this._bindEvents();
    this._refreshZoomLabel();
  }

  get isOpen() { return this._open; }

  /* ---------- публичный API ---------- */
  open(typeKey = null) {
    if (!this._root) return;
    if (this._open) {
      if (typeKey) this._select(typeKey);
      return;
    }

    this._ensureRenderer();

    if (!this._currentKey) {
      const key = (typeKey && UNIT_TYPES[typeKey]) ? typeKey : (this._keys[0] ?? 'LIGHT_INF');
      this._select(key, { silent: true });
    } else if (typeKey) {
      this._select(typeKey);
    }

    this._open = true;
    this._root.classList.add('open');
    this._onOpenChange?.(true);

    this._resize();
    this._startLoop();
  }

  toggle(typeKey = null) {
    if (this._open) this.close();
    else this.open(typeKey);
  }

  close(force = false) {
    if (!this._open) return;
    if (!force) SND.winClose.play();

    this._open = false;
    this._root.classList.remove('open');
    this._drag = null;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }

    this._onOpenChange?.(false);
  }

  destroy() {
    this.close(true);

    document.removeEventListener('keydown', this._onEsc);

    if (this._model) {
      this._scene.remove(this._model);
      disposeTree(this._model);
      this._model = null;
      this._modelInner = null;
    }

    if (this._scene) {
      disposeTree(this._scene);
      this._scene.clear();
      this._scene = null;
    }

    this._renderer?.forceContextLoss?.();
    this._renderer?.dispose?.();
    this._renderer = null;

    this._root?.remove?.();
    this._root = null;
  }

  /* =========================================================
     DOM
     ========================================================= */
  _buildPanel(parent) {
    const back = document.createElement('div');
    back.className = 'ud-backdrop';
    this._root = back;

    const panel = document.createElement('div');
    panel.className = 'ud-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    back.appendChild(panel);

    const header = document.createElement('div');
    header.className = 'ud-header';

    const title = document.createElement('div');
    title.className = 'ud-title';
    title.textContent = 'Юниты';

    const sub = document.createElement('div');
    sub.className = 'ud-sub';
    sub.textContent = 'Модели юнитов крупным планом';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ud-close';
    close.title = 'Закрыть (Esc)';
    close.textContent = 'ЗАКРЫТЬ';
    close.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(sub);
    header.appendChild(close);
    panel.appendChild(header);

    const body = document.createElement('div');
    body.className = 'ud-body';
    panel.appendChild(body);

    /* ---------- список юнитов ---------- */
    const list = document.createElement('aside');
    list.className = 'ud-list';

    const listTitle = document.createElement('div');
    listTitle.className = 'ud-list-title';
    listTitle.textContent = 'Типы юнитов';
    list.appendChild(listTitle);

    this._listEl = list;
    this._itemEls = new Map();

    for (const key of this._keys) {
      const type = UNIT_TYPES[key];
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ud-item';
      item.dataset.key = key;
      const monster = MONSTER_KEYS.has(key) ? ' 🔖' : '';
      item.innerHTML =
        `<span class="ud-item-name">${escapeHtml(type.name)}${monster}</span>` +
        `<span class="ud-item-meta">сила ${type.strength} · ход ${type.move}</span>`;
      item.addEventListener('click', () => this._select(key));
      list.appendChild(item);
      this._itemEls.set(key, item);
    }
    body.appendChild(list);

    /* ---------- сцена ---------- */
    const stage = document.createElement('main');
    stage.className = 'ud-stage';
    body.appendChild(stage);

    const canvas = document.createElement('canvas');
    canvas.className = 'ud-canvas';
    this._canvas = canvas;
    stage.appendChild(canvas);

    const hint = document.createElement('div');
    hint.className = 'ud-hint';
    hint.textContent = 'Колесо — зум · ЛКМ + движение — вращение';
    stage.appendChild(hint);

    const zoombar = document.createElement('div');
    zoombar.className = 'ud-zoombar';

    const btnOut = document.createElement('button');
    btnOut.type = 'button';
    btnOut.className = 'ud-zbtn';
    btnOut.title = 'Уменьшить';
    btnOut.textContent = '−';
    btnOut.addEventListener('click', () => this._setZoom(this._zoom / ZOOM_BUTTON_STEP));

    const val = document.createElement('span');
    val.className = 'ud-zval';
    val.textContent = '100%';
    this._zoomValEl = val;

    const btnIn = document.createElement('button');
    btnIn.type = 'button';
    btnIn.className = 'ud-zbtn';
    btnIn.title = 'Увеличить';
    btnIn.textContent = '+';
    btnIn.addEventListener('click', () => this._setZoom(this._zoom * ZOOM_BUTTON_STEP));

    const btnReset = document.createElement('button');
    btnReset.type = 'button';
    btnReset.className = 'ud-zbtn';
    btnReset.title = 'Сбросить вид';
    btnReset.textContent = 'СБРОС';
    btnReset.addEventListener('click', () => this._resetView());

    zoombar.appendChild(btnOut);
    zoombar.appendChild(val);
    zoombar.appendChild(btnIn);
    zoombar.appendChild(btnReset);
    stage.appendChild(zoombar);

    /* ---------- статы ---------- */
    const stats = document.createElement('aside');
    stats.className = 'ud-stats';

    const unitName = document.createElement('div');
    unitName.className = 'ud-unitname';
    unitName.textContent = '—';

    const unitSub = document.createElement('div');
    unitSub.className = 'ud-unitsub';
    unitSub.textContent = '—';

    const statList = document.createElement('div');
    statList.className = 'ud-statlist';

    stats.appendChild(unitName);
    stats.appendChild(unitSub);
    stats.appendChild(statList);
    body.appendChild(stats);

    this._nameEl = unitName;
    this._subEl = unitSub;
    this._statListEl = statList;

    parent.appendChild(back);
  }

  /* =========================================================
     Мини-сцена
     ========================================================= */
  _buildScene() {
    const scene = new THREE.Scene();
    this._scene = scene;

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    scene.add(new THREE.HemisphereLight(0xcfe2ff, 0x2a2218, 0.6));

    const key = new THREE.DirectionalLight(0xfff2d6, 2.2);
    key.position.set(2.4, 4.2, 2.8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 14;
    key.shadow.camera.left = -2.6;
    key.shadow.camera.right = 2.6;
    key.shadow.camera.top = 2.6;
    key.shadow.camera.bottom = -2.6;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    scene.add(key.target);

    const rim = new THREE.DirectionalLight(0x88aaff, 0.7);
    rim.position.set(-3, 2.4, -2.6);
    scene.add(rim);

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x121a24, roughness: 0.95, metalness: 0.05,
    });
    const floorGeo = new THREE.CircleGeometry(3.2, 64);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x3b638f, transparent: true, opacity: 0.55, depthWrite: false,
    });
    const ringGeo = new THREE.RingGeometry(1.55, 1.62, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.006;
    scene.add(ring);

    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(2.25, 2.29, 64),
      new THREE.MeshBasicMaterial({
        color: 0x2b4a6b, transparent: true, opacity: 0.35, depthWrite: false,
      })
    );
    ring2.geometry.rotateX(-Math.PI / 2);
    ring2.position.y = 0.006;
    scene.add(ring2);

    this._camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
    this._updateCamera();
  }

  _ensureRenderer() {
    if (this._renderer) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: this._canvas, antialias: true, alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer = renderer;
  }

  _resize() {
    if (!this._renderer) return;

    const w = Math.max(1, Math.round(this._canvas.clientWidth));
    const h = Math.max(1, Math.round(this._canvas.clientHeight));

    const size = this._renderer.getSize(this._size);
    if (size.x !== w || size.y !== h) this._renderer.setSize(w, h, false);

    const aspect = w / h;
    if (Math.abs(this._camera.aspect - aspect) > 0.001) {
      this._camera.aspect = aspect;
      this._camera.updateProjectionMatrix();
    }
  }

  /* =========================================================
     Модель и статы
     ========================================================= */
  _select(typeKey, { silent = false } = {}) {
    if (!UNIT_TYPES[typeKey]) return false;
    if (typeKey === this._currentKey) return true;

    this._currentKey = typeKey;
    if (!silent) SND.clickUnit.play();

    this._refreshList();
    this._refreshStats();
    this._rebuildModel();
    return true;
  }

  _refreshList() {
    for (const [key, el] of this._itemEls) {
      el.classList.toggle('selected', key === this._currentKey);
    }
  }

  _refreshStats() {
    const type = UNIT_TYPES[this._currentKey];
    if (!type) return;

    this._nameEl.textContent = type.name;
    this._subEl.textContent = `${this._currentKey} · id ${type.id}`;

    const rows = [
      ['Сила',       type.strength],
      ['Атака',      type.damage],
      ['Защита',     type.defense],
      ['Движение',   type.move],
      ['Стоимость',  type.cost],
      ['Постройка',  type.build ? `${type.build} ход.` : '—'],
      ['Герой',      type.isHero ? 'Да' : 'Нет'],
      ['ID',         type.id],
      ['Тип',        this._currentKey],
    ];

    this._statListEl.innerHTML = rows.map(([label, value]) => {
      const hero = label === 'Герой' && type.isHero ? ' is-hero' : '';
      return `<div class="ud-stat${hero}"><span>${escapeHtml(label)}</span>` +
             `<b>${escapeHtml(value)}</b></div>`;
    }).join('');
  }

  _rebuildModel() {
    if (!this._scene) return;

    if (this._model) {
      this._scene.remove(this._model);
      disposeTree(this._model);
      this._model = null;
      this._modelInner = null;
    }

    const skin = UNIT_SKINS.default;
    const mesh = skin.build(this._currentKey, this._colorHex);
    mesh.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });

    const holder = new THREE.Group();
    holder.rotation.y = this._modelYaw;
    holder.add(mesh);
    this._scene.add(holder);

    this._model = holder;
    this._modelInner = mesh;

    const box = new THREE.Box3().setFromObject(mesh);
    const sphere = box.getBoundingSphere(this._sphere);
    const radius = Math.max(0.28, sphere.radius);

    this._target.copy(sphere.center);
    this._baseDist = radius / Math.sin(THREE.MathUtils.degToRad(this._camera.fov * 0.5)) * 1.12;
    this._updateCamera();
  }

  /* =========================================================
     Управление видом
     ========================================================= */
  _bindEvents() {
    const canvas = this._canvas;

    this._onWheel = (e) => {
      if (!this._open) return;
      e.preventDefault();

      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= 100;

      this._setZoom(this._zoom * Math.exp(-dy * ZOOM_WHEEL_STEP));
    };

    this._onPointerDown = (e) => {
      if (!this._open || e.button !== 0) return;
      this._drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      canvas.setPointerCapture?.(e.pointerId);
    };

    this._onPointerMove = (e) => {
      if (!this._drag) return;
      const dx = e.clientX - this._drag.x;
      const dy = e.clientY - this._drag.y;
      this._drag.x = e.clientX;
      this._drag.y = e.clientY;

      this._modelYaw += dx * 0.01;
      this._pitch = THREE.MathUtils.clamp(this._pitch - dy * 0.005, PITCH_MIN, PITCH_MAX);
    };

    this._onPointerUp = (e) => {
      if (!this._drag) return;
      if (canvas.hasPointerCapture?.(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      this._drag = null;
    };

    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('pointercancel', this._onPointerUp);

    this._onEsc = (e) => {
      if (e.key === 'Escape' && this._open) this.close();
    };
    document.addEventListener('keydown', this._onEsc);
  }

  _setZoom(z) {
    this._zoom = THREE.MathUtils.clamp(z, ZOOM_MIN, ZOOM_MAX);
    this._refreshZoomLabel();
  }

  _refreshZoomLabel() {
    if (this._zoomValEl) {
      this._zoomValEl.textContent = `${Math.round(this._zoom * 100)}%`;
    }
  }

  _resetView() {
    this._setZoom(1);
    this._pitch = PITCH_DEFAULT;
    this._modelYaw = 0;
    if (this._model) this._model.rotation.y = 0;
    this._updateCamera();
  }

  _updateCamera() {
    if (!this._camera) return;

    const dist = this._baseDist / this._zoom;
    const cp = Math.cos(this._pitch);
    const sp = Math.sin(this._pitch);

    const x = Math.sin(this._cameraYaw) * cp * dist;
    const y = sp * dist;
    const z = Math.cos(this._cameraYaw) * cp * dist;

    this._camera.position.set(
      this._target.x + x,
      this._target.y + y,
      this._target.z + z,
    );
    this._camera.lookAt(this._target);
  }

  /* =========================================================
     Цикл рендера
     ========================================================= */
  _startLoop() {
    if (this._raf) return;
    this._lastNow = performance.now();

    const loop = (now = performance.now()) => {
      if (!this._open) { this._raf = null; return; }

      const dt = Math.min(50, Math.max(0, now - this._lastNow));
      this._lastNow = now;

      this._update(dt);
      this._resize();
      this._renderer.render(this._scene, this._camera);

      this._raf = requestAnimationFrame(loop);
    };

    this._raf = requestAnimationFrame(loop);
  }

  _update(dtMs) {
    const dt = dtMs / 1000;
    this._time += dt;

    if (this._model) {
      if (!this._drag) this._modelYaw += SPIN_SPEED * dt;
      this._modelYaw %= Math.PI * 2;
      this._model.rotation.y = this._modelYaw;
    }

    this._animateIdle(this._time);
    this._updateCamera();
  }

  /** Idle-анимация призрака/волшебника — та же, что в UnitsView.update(). */
  _animateIdle(t) {
    const ud = this._modelInner?.userData;
    if (!ud) return;

    const g = ud.ghostFx;
    if (g) {
      const bob = Math.sin(t * 1.6 + g.phase);
      if (g.body) {
        g.body.position.y = 0.02 + bob * 0.05;
        g.body.rotation.z = Math.sin(t * 0.8 + g.phase) * 0.035;
      }
      if (g.eyeMaterial) {
        g.eyeMaterial.emissiveIntensity = 1.9 + Math.sin(t * 3.0 + g.phase) * 0.8;
      }
      if (g.aura) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.1 + g.phase);
        g.aura.material.opacity = 0.10 + pulse * 0.14;
        g.aura.scale.setScalar(1 + pulse * 0.10);
      }
    }

    const w = ud.wizardFx;
    if (w) {
      if (w.runeGroup) w.runeGroup.rotation.y = t * 1.4 + w.phase;
      if (w.orbMaterial) {
        w.orbMaterial.emissiveIntensity = 2.0 + Math.sin(t * 2.6 + w.phase) * 0.8;
      }
      if (w.eyeMaterial) {
        w.eyeMaterial.emissiveIntensity = 1.8 + Math.sin(t * 2.2 + w.phase + 1.7) * 0.6;
      }
      if (w.circle) {
        const glow = 0.5 + 0.5 * Math.sin(t * 1.8 + w.phase);
        w.circle.material.opacity = 0.08 + glow * 0.10;
        w.circle.scale.setScalar(1 + glow * 0.06);
      }
    }
  }
}