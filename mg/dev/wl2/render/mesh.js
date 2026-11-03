// render/mesh.js
//
// Процедурные горы. 5 форм — разный силуэт, но все сидят на
// клетке TILE×TILE и поднимаются от уровня земли вверх.
//
//   MountainShape.SPIRE    — одиночный острый пик
//   MountainShape.RIDGE   — вытянутый гребень
//   MountainShape.DOUBLE  — два пика
//   MountainShape.MESA    — плосковершинный (столовая гора)
//   MountainShape.RUINED  — рваный, «разрушенный» пик
//
// Все функции возвращают THREE.Group. Внутри — BufferGeometry из
// LatheGeometry/ConeGeometry, окрашенные вершины через vertexColors.
//
// Ключевая функция: spawnRandomMountain(rng) → THREE.Group.

import * as THREE from 'three';

const TILE = 2.0; // совпадает с renderer.TILE по умолчанию; можно переопределить

export const MountainShape = Object.freeze({
  SPIRE:  'spire',
  RIDGE:  'ridge',
  DOUBLE: 'double',
  MESA:   'mesa',
  RUINED: 'ruined',
});

export const MOUNTAIN_SHAPES = Object.values(MountainShape);

/* =========================================================
   Палитра горы (вершина → подножие)
   ========================================================= */
const COLOR_TOP    = new THREE.Color(0xd9d9e0); // снег/светлый камень
const COLOR_MID    = new THREE.Color(0x8b8895);
const COLOR_BOTTOM = new THREE.Color(0x4d4a55);

function paintByHeight(geo, yTop) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / yTop, 0, 1);
    // 0 → bottom, 1 → top; два сегмента
    if (t < 0.5) c.copy(COLOR_BOTTOM).lerp(COLOR_MID, t * 2);
    else         c.copy(COLOR_MID).lerp(COLOR_TOP, (t - 0.5) * 2);
    colors[i * 3 + 0] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

const ROCK_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.95, metalness: 0.02, flatShading: true,
});

/* =========================================================
   Формы
   ========================================================= */

/** 1. Одиночный острый пик. */
function makeSpire(tile = TILE) {
  const h = tile * (1.2 + Math.random() * 0.6);
  const r = tile * (0.32 + Math.random() * 0.10);

  const geo = new THREE.ConeGeometry(r, h, 5, 3, false);
  geo.translate(0, h / 2, 0);
  // скол: слегка сдвинуть вершины вбок
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > h * 0.6) {
      pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * tile * 0.06);
      pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * tile * 0.06);
    }
  }
  paintByHeight(geo, h);

  const mesh = new THREE.Mesh(geo, ROCK_MAT);
  mesh.rotation.y = Math.random() * Math.PI * 2;

  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

/** 2. Вытянутый гребень. */
function makeRidge(tile = TILE) {
  const h = tile * (0.9 + Math.random() * 0.5);
  const len = tile * (0.9 + Math.random() * 0.3);
  const r0 = tile * 0.28;

  const geo = new THREE.ConeGeometry(r0, h, 4, 2, false);
  geo.translate(0, h / 2, 0);
  // растянуть по оси X — «гребень»
  geo.scale(len / r0, 1, 1);
  // слегка сжать вершины, чтобы не было острых углов
  paintByHeight(geo, h);

  const mesh = new THREE.Mesh(geo, ROCK_MAT);
  mesh.rotation.y = Math.random() * Math.PI;
  mesh.position.z = 0;

  // добавить второй, низкий «позвонок»
  const h2 = h * 0.55;
  const g2 = new THREE.ConeGeometry(tile * 0.18, h2, 4, 1, false);
  g2.translate(0, h2 / 2, 0);
  paintByHeight(g2, h2);
  const m2 = new THREE.Mesh(g2, ROCK_MAT);
  m2.position.set(tile * 0.35 * (Math.random() > 0.5 ? 1 : -1), 0, tile * 0.15);

  const g = new THREE.Group();
  g.add(mesh, m2);
  return g;
}

/** 3. Два пика. */
function makeDouble(tile = TILE) {
  const g = new THREE.Group();

  const hA = tile * (1.0 + Math.random() * 0.4);
  const hB = tile * (0.8 + Math.random() * 0.4);
  const rA = tile * (0.22 + Math.random() * 0.08);
  const rB = tile * (0.20 + Math.random() * 0.08);

  const geoA = new THREE.ConeGeometry(rA, hA, 5, 2, false);
  geoA.translate(0, hA / 2, 0);
  paintByHeight(geoA, hA);
  const mA = new THREE.Mesh(geoA, ROCK_MAT);
  mA.position.set(-tile * 0.10, 0, 0);

  const geoB = new THREE.ConeGeometry(rB, hB, 5, 2, false);
  geoB.translate(0, hB / 2, 0);
  paintByHeight(geoB, hB);
  const mB = new THREE.Mesh(geoB, ROCK_MAT);
  mB.position.set(tile * 0.15, 0, -tile * 0.05);

  g.add(mA, mB);
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

/** 4. Плосковершинная («столовая») гора. */
function makeMesa(tile = TILE) {
  const h = tile * (0.7 + Math.random() * 0.3);
  const rBot = tile * (0.36 + Math.random() * 0.08);
  const rTop = rBot * (0.55 + Math.random() * 0.15);

  const geo = new THREE.CylinderGeometry(rTop, rBot, h, 6, 2, false);
  geo.translate(0, h / 2, 0);
  paintByHeight(geo, h);

  const mesh = new THREE.Mesh(geo, ROCK_MAT);
  mesh.rotation.y = Math.random() * Math.PI;

  // «шапка» — плоский верх чуть светлее
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop * 1.02, rTop, tile * 0.06, 6, 1, false),
    new THREE.MeshStandardMaterial({ color: 0xdad6e0, roughness: 0.9, flatShading: true }),
  );
  cap.position.y = h + tile * 0.01;

  const g = new THREE.Group();
  g.add(mesh, cap);
  return g;
}

/** 5. Рваный / «разрушенный» пик. */
function makeRuined(tile = TILE) {
  const h = tile * (0.8 + Math.random() * 0.5);
  const r = tile * (0.30 + Math.random() * 0.08);

  const geo = new THREE.ConeGeometry(r, h, 6, 3, false);
  geo.translate(0, h / 2, 0);

  // «покусать» вершины: случайно обнулить часть сегментов верхней половины
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > h * 0.35 && Math.random() < 0.25) {
      pos.setY(i, y * (0.35 + Math.random() * 0.3)); // срезать к высоте трети
    }
  }
  paintByHeight(geo, h);

  const mesh = new THREE.Mesh(geo, ROCK_MAT);
  mesh.rotation.y = Math.random() * Math.PI * 2;

  // осколки у подножия
  const g = new THREE.Group();
  g.add(mesh);
  for (let k = 0; k < 3; k++) {
    const rh = tile * (0.08 + Math.random() * 0.10);
    const rr = tile * (0.10 + Math.random() * 0.06);
    const rg = new THREE.ConeGeometry(rr, rh, 4, 1, false);
    rg.translate(0, rh / 2, 0);
    paintByHeight(rg, rh);
    const rm = new THREE.Mesh(rg, ROCK_MAT);
    const ang = Math.random() * Math.PI * 2;
    const rad = tile * (0.30 + Math.random() * 0.10);
    rm.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
    rm.rotation.y = Math.random() * Math.PI;
    g.add(rm);
  }
  return g;
}

/* =========================================================
   Реестр форм
   ========================================================= */
const BUILDERS = {
  [MountainShape.SPIRE]:  makeSpire,
  [MountainShape.RIDGE]:  makeRidge,
  [MountainShape.DOUBLE]: makeDouble,
  [MountainShape.MESA]:   makeMesa,
  [MountainShape.RUINED]: makeRuined,
};

/* =========================================================
   Публичный API
   ========================================================= */

/**
 * Построить гору заданной формы.
 * @param {string} shape — одна из MountainShape.*
 * @param {number} [tile=TILE] — размер клетки в мировых единицах
 * @returns {THREE.Group}
 */
export function createMountain(shape = MountainShape.SPIRE, tile = TILE) {
  const make = BUILDERS[shape] ?? makeSpire;
  const g = make(tile);
  g.userData.kind = 'mountain';
  g.userData.shape = shape;
  return g;
}

/**
 * Случайная гора. Форма выбирается равновероятно, если не передано иначе.
 *
 * @param {() => number} [rng=Math.random] — генератор случайных чисел [0,1)
 * @param {object} [opts]
 * @param {string[]} [opts.shapes=MOUNTAIN_SHAPES] — из каких форм выбирать
 * @param {number}   [opts.tile=TILE]
 * @returns {THREE.Group}
 */
export function spawnRandomMountain(rng = Math.random, opts = {}) {
  const shapes = opts.shapes ?? MOUNTAIN_SHAPES;
  const tile   = opts.tile   ?? TILE;
  const shape  = shapes[Math.floor(rng() * shapes.length)] ?? MountainShape.SPIRE;
  return createMountain(shape, tile);
}