//  render/town-mesh.js
//
//  Процедурные модели городов и руин.
//
//  Фабрика createTownMesh(type, opts) → THREE.Group:
//    TOWN_MODEL.PROVINCIAL — обнесённый стеной городок с донжоном (базовая модель)
//    TOWN_MODEL.CAPITAL    — крупная столица: дворец, шесть башен, золотые шпили
//    TOWN_MODEL.FORTRESS   — приземистая крепость: толстые стены, зубцы, донжон
//    TOWN_MODEL.BACKWATER  — бедная деревушка: хижины, частокол, колодец
//    TOWN_MODEL.RUINS      — руины: обломки стен, рухнувшая башня, щебень
//
//  Модели строятся в «панельных» единицах (как прежняя buildCityMesh),
//  на карте они масштабируются через TOWN_MAP_SCALE.
//
//  Опции:
//    colorHex — цвет владельца (крыши/флаги), по умолчанию песочный;
//    withFlag — рисовать полотнище флага (на карте флаг анимируется отдельно).
//
//  Ключевая функция: createTownMesh(type, opts) → THREE.Group.
//
//  Типы городов - core/world.js (CITY_TYPE). RUINS — не город, а руины.

import * as THREE from 'three';

/** Типы моделей: 4 города + руины. */
export const TOWN_MODEL = Object.freeze({
  PROVINCIAL: 'provincial',
  CAPITAL:    'capital',
  FORTRESS:   'fortress',
  BACKWATER:  'backwater',
  RUINS:      'ruins',
});

export const TOWN_MODEL_TYPES = Object.values(TOWN_MODEL);

/** Масштаб моделей на карте относительно панельного вида. */
export const TOWN_MAP_SCALE = 0.5;

/* =========================================================
   Палитра
   ========================================================= */
function makePalette(colorHex) {
  const accent = new THREE.Color(colorHex ?? 0xd9c9a3);

  const mats = {
    stone:     new THREE.MeshStandardMaterial({ color: 0xd9cfb6, roughness: 0.90 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: 0x9a8f77, roughness: 0.95 }),
    stoneWarm: new THREE.MeshStandardMaterial({ color: 0xc8b89a, roughness: 0.92 }),
    stoneCool: new THREE.MeshStandardMaterial({ color: 0xb7bcc4, roughness: 0.94 }),
    wood:      new THREE.MeshStandardMaterial({ color: 0x6d4a2f, roughness: 0.90 }),
    woodDark:  new THREE.MeshStandardMaterial({ color: 0x4e3420, roughness: 0.95 }),
    thatch:    new THREE.MeshStandardMaterial({ color: 0xb08b4f, roughness: 0.95 }),
    dirt:      new THREE.MeshStandardMaterial({ color: 0x7a6a4f, roughness: 1.00 }),
    moss:      new THREE.MeshStandardMaterial({ color: 0x5f7047, roughness: 1.00 }),
    rubble:    new THREE.MeshStandardMaterial({ color: 0x857f74, roughness: 1.00 }),
    roof:      new THREE.MeshStandardMaterial({ color: accent.clone(), roughness: 0.60 }),
    flag:      new THREE.MeshBasicMaterial({ color: accent.clone(), side: THREE.DoubleSide }),
    gold:      new THREE.MeshStandardMaterial({
      color: 0xffd166, metalness: 0.55, roughness: 0.35,
      emissive: 0x3a2a10, emissiveIntensity: 0.35,
    }),
    win:       new THREE.MeshStandardMaterial({
      color: 0xffd166, emissive: 0xffa02a, emissiveIntensity: 0.60, roughness: 0.40,
    }),
  };

  const setAccent = (hex) => {
    const c = new THREE.Color(hex ?? 0xd9c9a3);
    mats.roof.color.copy(c);
    mats.flag.color.copy(c);
    mats.roof.needsUpdate = true;
    mats.flag.needsUpdate = true;
  };

  return { mats, setAccent };
}

/* =========================================================
   Утилиты
   ========================================================= */
function add(g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  g.add(mesh);
  return mesh;
}

/**
 * Склеить все меши группы по материалам: вместо десятков мелких
 * мешей остаётся по одному на материал. Модель статична, поэтому
 * это не меняет вид, но резко снижает число draw calls на карте.
 */
function mergeByMaterial(group) {
  const buckets = new Map();

  for (const child of [...group.children]) {
    if (!child.isMesh) continue;

    child.updateMatrix();
    const geo = child.geometry.clone().applyMatrix4(child.matrix);

    let list = buckets.get(child.material);
    if (!list) {
      list = [];
      buckets.set(child.material, list);
    }
    list.push(geo);

    child.geometry.dispose();
    group.remove(child);
  }

  for (const [mat, geos] of buckets) {
    if (geos.length === 1) {
      group.add(new THREE.Mesh(geos[0], mat));
      continue;
    }

    const merged = mergeBasic(geos);
    if (merged) group.add(new THREE.Mesh(merged, mat));
  }
}

/** Слить несколько BufferGeometry в одну (без внешних зависимостей). */
function mergeBasic(geos) {
  if (geos.length === 0) return null;

  const list = geos.map(g => (g.index ? g.toNonIndexed() : g));
  const first = list[0];
  const names = Object.keys(first.attributes).filter(name =>
    list.every(g => g.attributes[name] &&
      g.attributes[name].itemSize === first.attributes[name].itemSize)
  );

  if (names.length === 0) {
    list.forEach(g => g.dispose());
    geos.forEach(g => g.dispose());
    return null;
  }

  const out = new THREE.BufferGeometry();

  for (const name of names) {
    const itemSize = first.attributes[name].itemSize;

    let total = 0;
    for (const g of list) total += g.attributes[name].count;

    const arr = new Float32Array(total * itemSize);
    let offset = 0;
    for (const g of list) {
      const src = g.attributes[name].array;
      arr.set(src, offset);
      offset += src.length;
    }

    out.setAttribute(name, new THREE.BufferAttribute(arr, itemSize));
  }

  out.computeBoundingSphere();
  out.computeBoundingBox();

  list.forEach(g => g.dispose());
  geos.forEach(g => g.dispose());

  return out;
}

/* =========================================================
   1. Провинциальный город — базовая модель.
   ========================================================= */
function buildProvincial(g, m, withFlag) {
  add(g, new THREE.CylinderGeometry(1.05, 1.15, 0.16, 28), m.stoneDark, 0, 0.08, 0);

  const seg = 14, r = 0.92;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    add(g, new THREE.BoxGeometry(0.34, 0.18, 0.16), m.stone,
      Math.cos(a) * r, 0.25, Math.sin(a) * r, 0, -a, 0);
    add(g, new THREE.BoxGeometry(0.16, 0.10, 0.16), m.stoneDark,
      Math.cos(a) * r, 0.39, Math.sin(a) * r, 0, -a, 0);
  }

  const towers = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  for (const a of towers) {
    const x = Math.cos(a) * 0.70;
    const z = Math.sin(a) * 0.70;
    add(g, new THREE.CylinderGeometry(0.17, 0.20, 0.55, 10), m.stone, x, 0.38, z);
    add(g, new THREE.ConeGeometry(0.22, 0.28, 4), m.roof, x, 0.78, z, 0, Math.PI / 4, 0);
  }

  add(g, new THREE.BoxGeometry(0.70, 0.72, 0.70), m.stone, 0, 0.52, 0);
  add(g, new THREE.BoxGeometry(0.78, 0.08, 0.78), m.stoneDark, 0, 0.90, 0);
  add(g, new THREE.ConeGeometry(0.56, 0.50, 4), m.roof, 0, 1.18, 0, 0, Math.PI / 4, 0);
  add(g, new THREE.BoxGeometry(0.20, 0.34, 0.05), m.wood, 0, 0.35, 0.36);

  add(g, new THREE.BoxGeometry(0.07, 0.12, 0.03), m.win, -0.18, 0.62, 0.36);
  add(g, new THREE.BoxGeometry(0.07, 0.12, 0.03), m.win,  0.18, 0.62, 0.36);
  add(g, new THREE.BoxGeometry(0.03, 0.12, 0.07), m.win, -0.36, 0.62, 0);
  add(g, new THREE.BoxGeometry(0.03, 0.12, 0.07), m.win,  0.36, 0.62, 0);

  add(g, new THREE.CylinderGeometry(0.015, 0.015, 0.55, 6), m.gold, 0, 1.65, 0);
  if (withFlag) {
    add(g, new THREE.PlaneGeometry(0.30, 0.18), m.flag, 0.16, 1.80, 0);
  }

  return { height: 1.45, anchor: { x: 0.16, y: 1.80, z: 0 } };
}

/* =========================================================
   2. Столица — дворец, шесть башен, золото.
   ========================================================= */
function buildCapital(g, m, withFlag) {
  add(g, new THREE.CylinderGeometry(1.16, 1.30, 0.18, 30), m.stoneDark, 0, 0.09, 0);

  const seg = 18, r = 1.02;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    add(g, new THREE.BoxGeometry(0.36, 0.22, 0.16), m.stone,
      Math.cos(a) * r, 0.29, Math.sin(a) * r, 0, -a, 0);
    add(g, new THREE.BoxGeometry(0.18, 0.12, 0.16), m.stoneDark,
      Math.cos(a) * r, 0.46, Math.sin(a) * r, 0, -a, 0);
  }

  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const x = Math.cos(a) * 0.84;
    const z = Math.sin(a) * 0.84;
    add(g, new THREE.CylinderGeometry(0.16, 0.20, 0.66, 10), m.stone, x, 0.45, z);
    add(g, new THREE.ConeGeometry(0.24, 0.34, 4), m.roof, x, 0.95, z, 0, Math.PI / 4, 0);
    add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), m.gold, x, 1.23, z);
    if (withFlag) {
      add(g, new THREE.PlaneGeometry(0.14, 0.09), m.flag, x + 0.08, 1.30, z);
    }
  }

  add(g, new THREE.BoxGeometry(0.86, 0.90, 0.86), m.stone, 0, 0.60, 0);
  add(g, new THREE.BoxGeometry(0.94, 0.10, 0.94), m.stoneDark, 0, 1.10, 0);
  add(g, new THREE.BoxGeometry(0.58, 0.44, 0.58), m.stoneWarm, 0, 1.37, 0);
  add(g, new THREE.BoxGeometry(0.64, 0.08, 0.64), m.gold, 0, 1.63, 0);
  add(g, new THREE.ConeGeometry(0.42, 0.38, 4), m.roof, 0, 1.86, 0, 0, Math.PI / 4, 0);
  add(g, new THREE.SphereGeometry(0.07, 10, 8), m.gold, 0, 2.08, 0);
  add(g, new THREE.CylinderGeometry(0.013, 0.013, 0.26, 6), m.gold, 0, 2.24, 0);
  if (withFlag) {
    add(g, new THREE.PlaneGeometry(0.26, 0.15), m.flag, 0.13, 2.18, 0);
  }

  for (const sx of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.40, 0.52, 0.64), m.stoneWarm, sx * 0.63, 0.40, 0);
    add(g, new THREE.ConeGeometry(0.34, 0.40, 4), m.roof, sx * 0.63, 0.86, 0, 0, Math.PI / 4, 0);
    add(g, new THREE.BoxGeometry(0.05, 0.10, 0.05), m.win, sx * 0.63, 0.42, 0.33);
  }

  add(g, new THREE.BoxGeometry(0.34, 0.42, 0.12), m.stoneDark, 0, 0.31, 0.47);
  add(g, new THREE.BoxGeometry(0.18, 0.28, 0.05), m.wood, 0, 0.25, 0.55);
  add(g, new THREE.BoxGeometry(0.22, 0.06, 0.12), m.gold, 0, 0.55, 0.47);

  for (const x of [-0.24, 0, 0.24]) {
    add(g, new THREE.BoxGeometry(0.06, 0.11, 0.03), m.win, x, 0.72, 0.43);
    add(g, new THREE.BoxGeometry(0.06, 0.11, 0.03), m.win, x, 0.96, 0.43);
  }

  return { height: 2.16, anchor: { x: 0.13, y: 2.18, z: 0 } };
}

/* =========================================================
   3. Крепость — приземистая, каменная, с зубцами.
   ========================================================= */
function buildFortress(g, m, withFlag) {
  add(g, new THREE.CylinderGeometry(1.00, 1.10, 0.16, 26), m.stoneDark, 0, 0.08, 0);

  const seg = 16, r = 0.88;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    add(g, new THREE.BoxGeometry(0.38, 0.36, 0.20), m.stoneCool,
      Math.cos(a) * r, 0.34, Math.sin(a) * r, 0, -a, 0);
    add(g, new THREE.BoxGeometry(0.20, 0.12, 0.20), m.stoneDark,
      Math.cos(a) * r, 0.58, Math.sin(a) * r, 0, -a, 0);
  }

  for (const [x, z] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) {
    add(g, new THREE.BoxGeometry(0.36, 0.68, 0.36), m.stoneCool, x, 0.42, z);
    add(g, new THREE.BoxGeometry(0.44, 0.08, 0.44), m.stoneDark, x, 0.80, z);
    for (const [dx, dz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) {
      add(g, new THREE.BoxGeometry(0.10, 0.12, 0.10), m.stoneCool, x + dx, 0.90, z + dz);
    }
  }

  add(g, new THREE.BoxGeometry(0.62, 0.76, 0.62), m.stone, 0, 0.54, 0);
  add(g, new THREE.BoxGeometry(0.70, 0.08, 0.70), m.stoneDark, 0, 0.96, 0);
  for (const [dx, dz] of [
    [-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26],
    [0, -0.30], [0, 0.30], [-0.30, 0], [0.30, 0],
  ]) {
    add(g, new THREE.BoxGeometry(0.12, 0.12, 0.12), m.stone, dx, 1.06, dz);
  }

  add(g, new THREE.BoxGeometry(0.42, 0.52, 0.20), m.stoneDark, 0, 0.36, 0.52);
  add(g, new THREE.BoxGeometry(0.24, 0.34, 0.06), m.woodDark, 0, 0.30, 0.63);
  add(g, new THREE.BoxGeometry(0.46, 0.08, 0.24), m.stoneCool, 0, 0.66, 0.52);

  add(g, new THREE.BoxGeometry(0.04, 0.14, 0.03), m.win, -0.16, 0.62, 0.32);
  add(g, new THREE.BoxGeometry(0.04, 0.14, 0.03), m.win,  0.16, 0.62, 0.32);

  add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5), m.gold, 0.62, 1.02, -0.62);
  if (withFlag) {
    add(g, new THREE.PlaneGeometry(0.22, 0.13), m.flag, 0.74, 1.14, -0.62);
  }

  return { height: 1.22, anchor: { x: 0.74, y: 1.14, z: -0.62 } };
}

/* =========================================================
   4. Захолустье — деревушка с хижинами и частоколом.
   ========================================================= */
function buildBackwater(g, m, withFlag) {
  add(g, new THREE.CylinderGeometry(1.00, 1.08, 0.10, 24), m.dirt, 0, 0.05, 0);

  const posts = 18;
  for (let i = 0; i < posts; i++) {
    if (i === 3 || i === 4) continue;
    const a = (i / posts) * Math.PI * 2;
    const x = Math.cos(a) * 0.94;
    const z = Math.sin(a) * 0.94;
    add(g, new THREE.CylinderGeometry(0.035, 0.045, 0.42, 5), m.wood, x, 0.27, z);
    add(g, new THREE.ConeGeometry(0.05, 0.08, 4), m.woodDark, x, 0.52, z);
  }

  const hut = (x, z, s, ry) => {
    const h = 0.24 * s;
    add(g, new THREE.BoxGeometry(0.32 * s, h, 0.32 * s), m.wood, x, 0.10 + h / 2, z, 0, ry, 0);
    add(g, new THREE.ConeGeometry(0.28 * s, 0.20 * s, 4), m.thatch,
      x, 0.10 + h + 0.10 * s, z, 0, ry + Math.PI / 4, 0);
    const dx = Math.sin(ry) * 0.17 * s;
    const dz = Math.cos(ry) * 0.17 * s;
    add(g, new THREE.BoxGeometry(0.08 * s, 0.12 * s, 0.03), m.woodDark,
      x + dx, 0.10 + h * 0.5, z + dz, 0, ry, 0);
  };

  hut(-0.40, -0.18, 0.95,  0.20);
  hut( 0.30, -0.36, 0.80, -0.40);
  hut( 0.48,  0.12, 1.05,  0.50);
  hut(-0.18,  0.42, 0.85, -0.20);
  hut(-0.55,  0.26, 0.75,  0.80);
  hut( 0.02,  0.00, 1.10,  0.10);

  add(g, new THREE.CylinderGeometry(0.13, 0.15, 0.16, 10), m.stone, 0.02, 0.18, -0.62);
  add(g, new THREE.BoxGeometry(0.04, 0.26, 0.04), m.woodDark, -0.08, 0.38, -0.62);
  add(g, new THREE.BoxGeometry(0.04, 0.26, 0.04), m.woodDark,  0.12, 0.38, -0.62);
  add(g, new THREE.ConeGeometry(0.17, 0.12, 4), m.thatch, 0.02, 0.56, -0.62, 0, Math.PI / 4, 0);

  add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.44, 5), m.woodDark, 0.60, 0.32, 0.45);
  if (withFlag) {
    add(g, new THREE.PlaneGeometry(0.18, 0.11), m.flag, 0.69, 0.50, 0.45);
  }

  return { height: 0.62, anchor: { x: 0.69, y: 0.50, z: 0.45 } };
}

/* =========================================================
   5. Руины — обломки стен, рухнувшая башня, щебень.
   ========================================================= */
function buildRuins(g, m) {
  add(g, new THREE.CylinderGeometry(1.00, 1.08, 0.10, 20), m.stoneDark, 0, 0.05, 0);

  const heights = [0.42, 0.18, 0.30, 0, 0.52, 0.22, 0, 0.36, 0.16, 0.28, 0, 0.44, 0.20, 0.34, 0, 0.26];
  const seg = heights.length, r = 0.88;
  for (let i = 0; i < seg; i++) {
    const h = heights[i];
    if (h <= 0) continue;
    const a = (i / seg) * Math.PI * 2;
    add(g, new THREE.BoxGeometry(0.34, h, 0.18), m.rubble,
      Math.cos(a) * r, 0.10 + h / 2, Math.sin(a) * r,
      0.06 * Math.sin(i * 2.1), -a, 0);
  }

  add(g, new THREE.CylinderGeometry(0.22, 0.26, 0.56, 9), m.stoneDark,
    0.44, 0.36, -0.30, 0.12, 0.20, 0);
  add(g, new THREE.BoxGeometry(0.30, 0.10, 0.24), m.rubble, 0.48, 0.64, -0.30, 0.30, 0.10, 0.05);

  add(g, new THREE.CylinderGeometry(0.09, 0.10, 0.72, 8), m.stoneDark,
    -0.20, 0.16, 0.46, 0, 0, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(0.11, 0.11, 0.08, 8), m.rubble, -0.58, 0.16, 0.46);

  const rubble = [
    [-0.35, 0.22, 0.90], [0.15, 0.30, 0.80], [0.55, 0.18, 0.70],
    [-0.10, 0.26, 1.10], [0.30, 0.14, 0.90], [-0.62, 0.17, 0.60],
    [0.05, 0.36, 0.50], [0.68, 0.22, 0.50],
  ];
  for (const [x, s, z] of rubble) {
    add(g, new THREE.BoxGeometry(0.14 * s, 0.10 * s, 0.14 * s), m.rubble,
      x, 0.10 + 0.05 * s, z, 0.20, 0.40, 0.10);
  }

  for (const [x, z] of [[-0.50, 0.10], [0.20, -0.50], [0.50, 0.40], [-0.15, 0.60]]) {
    add(g, new THREE.BoxGeometry(0.22, 0.02, 0.22), m.moss, x, 0.105, z);
  }

  return { height: 0.92, anchor: null };
}

/* =========================================================
   Реестр моделей
   ========================================================= */
const BUILDERS = {
  [TOWN_MODEL.PROVINCIAL]: buildProvincial,
  [TOWN_MODEL.CAPITAL]:    buildCapital,
  [TOWN_MODEL.FORTRESS]:   buildFortress,
  [TOWN_MODEL.BACKWATER]:  buildBackwater,
  [TOWN_MODEL.RUINS]:      buildRuins,
};

/* =========================================================
   Публичный API
   ========================================================= */

/**
 * Построить модель города/руин по типу.
 *
 * @param {string} [type=TOWN_MODEL.PROVINCIAL] — тип модели
 * @param {object} [opts]
 * @param {number} [opts.colorHex]   — цвет владельца (крыши/флаги)
 * @param {boolean} [opts.withFlag=true] — рисовать полотнище флага
 * @returns {THREE.Group} группа с userData:
 *   { kind:'town', cityType, height, flagAnchor, setAccent(hex) }
 */
export function createTownMesh(type = TOWN_MODEL.PROVINCIAL, opts = {}) {
  const kind = BUILDERS[type] ? type : TOWN_MODEL.PROVINCIAL;
  const withFlag = opts.withFlag !== false;
  const colorHex = opts.colorHex ?? 0xd9c9a3;

  const g = new THREE.Group();
  const { mats, setAccent } = makePalette(colorHex);
  const res = BUILDERS[kind](g, mats, withFlag);
  mergeByMaterial(g);

  // Материалы, которые этому типу не понадобились, сразу освобождаем.
  const used = new Set();
  g.traverse(o => { if (o.isMesh) used.add(o.material); });
  for (const mat of Object.values(mats)) {
    if (!used.has(mat)) mat.dispose();
  }

  g.userData = {
    kind: 'town',
    cityType: kind,
    height: res.height,
    flagAnchor: res.anchor,
    setAccent,
  };

  return g;
}

/** Модель руин (не город). */
export function createRuinsMesh(opts = {}) {
  return createTownMesh(TOWN_MODEL.RUINS, opts);
}
