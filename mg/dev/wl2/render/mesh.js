// render/mesh.js
//
// Процедурные горы. 5 форм — разный силуэт, но все стоят на
// клетке TILE×TILE: основание горы растянуто на всю клетку,
// никаких «подставок»/пьедесталов под горой нет.
//
//   MountainShape.SPIRE    — одиночный острый пик
//   MountainShape.RIDGE   — вытянутый гребень
//   MountainShape.DOUBLE  — два пика
//   MountainShape.MESA    — плосковершинный (столовая гора)
//   MountainShape.RUINED  — рваный, «разрушенный» пик
//
// Гора строится как органическая радиальная сетка: кольца вершин
// от подножия к вершине, смещённые шумом (сколы, рёбра, снег).
// Цвет — вершинный (vertexColors): тёмный камень внизу, светлый
// камень вверху, снежная шапка, немного мха у подножия.
//
// Ключевая функция: spawnRandomMountain(rng) → THREE.Group.

import * as THREE from 'three';

const TILE = 1.0; // совпадает с renderer.TILE

export const MountainShape = Object.freeze({
  SPIRE:  'spire',
  RIDGE:  'ridge',
  DOUBLE: 'double',
  MESA:   'mesa',
  RUINED: 'ruined',
});

export const MOUNTAIN_SHAPES = Object.values(MountainShape);

/* =========================================================
   Палитра горы
   ========================================================= */
const C_ROCK_DARK  = new THREE.Color(0x202020);
const C_ROCK_MID   = new THREE.Color(0x424c4d);
const C_ROCK_LIGHT = new THREE.Color(0xaaa4b3);
const C_SNOW       = new THREE.Color(0xa2a4aa);
const C_SNOW_SHADE = new THREE.Color(0x6b6362);
const C_MOSS       = new THREE.Color(0x5f7047);

const ROCK_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.93, metalness: 0.02, flatShading: true,
});

/* =========================================================
   Утилиты
   ========================================================= */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp  = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/** Детерминированный «горный» шум по углу и высоте. Непрерывен по кругу. */
function terrainNoise(a, t, seed) {
  return (
    Math.sin(a * 3.0 + seed * 1.7) * 0.50 +
    Math.sin(a * 5.0 - t * 4.0 + seed * 2.3) * 0.30 +
    Math.sin(a * 9.0 + t * 7.0 + seed * 3.1) * 0.20
  );
}

/** Мягкий квадрат: чуть растягивает основание к углам клетки. */
function squircleFill(a) {
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const n = 6;
  return 1 / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n);
}

function hashNoise(x, y, z, seed) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453;
  return v - Math.floor(v);
}

function rand(rng, a, b) {
  return a + rng() * (b - a);
}

/* =========================================================
   Построение органической геометрии горы
   ========================================================= */
function buildMountainGeometry({
  height,
  baseR,
  sides,
  levels,
  profile,
  topMode = 'peak',   // 'peak' | 'flat'
  roughness = 0.14,
  seed = 0,
  squashX = 1,
  squashZ = 1,
  lean = 0,
  twist = 0,
  jag = 0,
}) {
  const positions = [];
  const indices = [];
  const rings = [];

  for (let i = 0; i <= levels; i++) {
    const t = i / levels;
    const prof = profile(t);

    // Остроконечная вершина — единая точка.
    if (topMode === 'peak' && i === levels) {
      positions.push(lean * height, height, 0);
      rings.push([positions.length / 3 - 1]);
      break;
    }

    const ring = [];
    const sx = lerp(1, squashX, t);
    const sz = lerp(1, squashZ, t);
    const baseFillW = clamp(1 - t * 3, 0, 1);
    const jagW = jag * (0.35 + 0.65 * t);

    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2 + twist * t;
      const nA = terrainNoise(a, t, seed);
      const fill = 1 + (squircleFill(a) - 1) * baseFillW;
      const rough = 1 + nA * roughness * clamp(t * 2.2, 0, 1) + nA * jagW;

      const r = baseR * prof * fill * rough;
      let x = Math.cos(a) * r * sx;
      let z = Math.sin(a) * r * sz;
      x += lean * height * t;

      let y = height * t;
      if (t > 0 && t < 1) {
        y += terrainNoise(a, t * 2.0, seed + 9.0) * height * (0.012 + jagW * 0.08);
      }
      if (topMode === 'flat' && i === levels) {
        y += terrainNoise(a, 1.0, seed + 4.0) * height * (0.02 + jagW * 0.10);
      }

      ring.push(positions.length / 3);
      positions.push(x, y, z);
    }
    rings.push(ring);
  }

  // Боковые грани между кольцами.
  for (let i = 0; i < rings.length - 1; i++) {
    const lower = rings[i];
    const upper = rings[i + 1];
    if (upper.length === 1) {
      const ap = upper[0];
      for (let j = 0; j < sides; j++) {
        const j2 = (j + 1) % sides;
        indices.push(lower[j], ap, lower[j2]);
      }
    } else {
      for (let j = 0; j < sides; j++) {
        const j2 = (j + 1) % sides;
        indices.push(lower[j], upper[j], upper[j2]);
        indices.push(lower[j], upper[j2], lower[j2]);
      }
    }
  }

  // Дно — закрывает гору снизу.
  const bottom = rings[0];
  const bc = positions.length / 3;
  positions.push(0, 0, 0);
  for (let j = 0; j < sides; j++) {
    const j2 = (j + 1) % sides;
    indices.push(bc, bottom[j], bottom[j2]);
  }

  // Плоская вершина (меса / рваный пик) — крышка сверху.
  if (topMode === 'flat') {
    const top = rings[rings.length - 1];
    let cx = 0, cy = 0, cz = 0;
    for (const idx of top) {
      cx += positions[idx * 3];
      cy += positions[idx * 3 + 1];
      cz += positions[idx * 3 + 2];
    }
    cx /= top.length;
    cy /= top.length;
    cz /= top.length;

    const tc = positions.length / 3;
    positions.push(cx, cy, cz);
    for (let j = 0; j < sides; j++) {
      const j2 = (j + 1) % sides;
      indices.push(tc, top[j2], top[j]);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/* =========================================================
   Окрашивание по высоте + шум
   ========================================================= */
function paintMountain(geo, height, opts = {}) {
  const {
    snowLine = 0.6,
    seed = 0,
    moss = 0.16,
    snowAmount = 1,
  } = opts;

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const sc = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const t = clamp(y / Math.max(height, 1e-4), 0, 1);
    const a = Math.atan2(z, x);
    const n = terrainNoise(a, t, seed);

    // Камень: тёмный низ → светлый верх.
    const k = smooth(clamp(t * 1.08, 0, 1));
    if (k < 0.5) c.copy(C_ROCK_DARK).lerp(C_ROCK_MID, k * 2);
    else         c.copy(C_ROCK_MID).lerp(C_ROCK_LIGHT, (k - 0.5) * 2);

    // Расщелины/тени граней.
    const crev = clamp(-n, 0, 1);
    c.lerp(C_ROCK_DARK, crev * 0.22);

    // Мох у подножия.
    if (moss > 0 && t < moss) {
      const m = (1 - t / moss) * (0.5 + 0.5 * n);
      c.lerp(C_MOSS, clamp(m * 0.55, 0, 0.55));
    }

    // Снежная шапка с рваной кромкой.
    const sl = snowLine + n * 0.07;
    if (t > sl) {
      const m = clamp((t - sl) / 0.10, 0, 1) * snowAmount;
      sc.copy(C_SNOW).lerp(C_SNOW_SHADE, clamp(-n, 0, 1) * 0.55);
      c.lerp(sc, clamp(m, 0, 1));
    }

    // Лёгкая зернистость камня.
    const v = 0.94 + hashNoise(x, y, z, seed) * 0.12;
    c.multiplyScalar(v);

    colors[i * 3 + 0] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/* =========================================================
   Формы
   ========================================================= */

/** 1. Одиночный острый пик. */
function makeSpire(tile, rng) {
  const height = tile * rand(rng, 0.2, 2.5);

  const geo = buildMountainGeometry({
    height,
    baseR: tile * 0.5,
    sides: 11 + Math.floor(rng() * 5),
    levels: 16,
    profile: (t) => Math.pow(1 - t, 0.82),
    topMode: 'peak',
    roughness: 0.15,
    seed: rng() * 100,
    lean: rand(rng, -0.07, 0.07),
    twist: rand(rng, -0.22, 0.22),
  });

  paintMountain(geo, height, {
    snowLine: rand(rng, 0.50, 0.62),
    seed: rng() * 100,
    moss: rand(rng, 0.10, 0.18),
  });

  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, ROCK_MAT));
  return g;
}

/** 2. Вытянутый гребень. */
function makeRidge(tile, rng) {
  const height = tile * rand(rng, 0.2, 1.1);

  const geo = buildMountainGeometry({
    height,
    baseR: tile * 0.5,
    sides: 14 + Math.floor(rng() * 4),
    levels: 14,
    profile: (t) => Math.pow(1 - t, 0.68),
    topMode: 'peak',
    roughness: 0.16,
    seed: rng() * 100,
    squashX: rand(rng, 1.25, 1.55),
    squashZ: rand(rng, 0.55, 0.72),
    lean: rand(rng, -0.04, 0.04),
    twist: rand(rng, -0.15, 0.15),
  });

  paintMountain(geo, height, {
    snowLine: rand(rng, 0.55, 0.68),
    seed: rng() * 100,
    moss: rand(rng, 0.08, 0.15),
  });

  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, ROCK_MAT));
  return g;
}

/** 3. Два пика (общее основание на всю клетку). */
function makeDouble(tile, rng) {
  const hA = tile * rand(rng, 0.1, 1.0);
  const hB = hA * rand(rng, 0.3, 0.8);
  const off = tile * rand(rng, 0.13, 0.18);

  const geoA = buildMountainGeometry({
    height: hA,
    baseR: tile * rand(rng, 0.44, 0.48),
    sides: 10 + Math.floor(rng() * 4),
    levels: 14,
    profile: (t) => Math.pow(1 - t, 0.84),
    topMode: 'peak',
    roughness: 0.15,
    seed: rng() * 100,
    lean: rand(rng, -0.05, 0.05),
    twist: rand(rng, -0.18, 0.18),
  });
  paintMountain(geoA, hA, {
    snowLine: rand(rng, 0.52, 0.64),
    seed: rng() * 100,
    moss: rand(rng, 0.08, 0.15),
  });

  const geoB = buildMountainGeometry({
    height: hB,
    baseR: tile * rand(rng, 0.34, 0.40),
    sides: 10 + Math.floor(rng() * 4),
    levels: 14,
    profile: (t) => Math.pow(1 - t, 0.9),
    topMode: 'peak',
    roughness: 0.16,
    seed: rng() * 100,
    lean: rand(rng, -0.05, 0.05),
    twist: rand(rng, -0.2, 0.2),
  });
  paintMountain(geoB, hB, {
    snowLine: rand(rng, 0.6, 0.72),
    seed: rng() * 100,
    moss: rand(rng, 0.08, 0.15),
  });

  const mA = new THREE.Mesh(geoA, ROCK_MAT);
  mA.position.set(-off, 0, tile * rand(rng, -0.04, 0.04));

  const mB = new THREE.Mesh(geoB, ROCK_MAT);
  mB.position.set(off, 0, tile * rand(rng, -0.05, 0.05));

  const g = new THREE.Group();
  g.add(mA, mB);
  return g;
}

/** 4. Плосковершинная («столовая») гора. */
function makeMesa(tile, rng) {
  const height = tile * rand(rng, 0.1, 1.0);
  const topFrac = rand(rng, 0.42, 0.55);

  const geo = buildMountainGeometry({
    height,
    baseR: tile * 0.5,
    sides: 8 + Math.floor(rng() * 3),
    levels: 14,
    profile: (t) => {
      const shoulder = smooth(clamp((t - 0.60) / 0.32, 0, 1));
      return lerp(1, topFrac, shoulder);
    },
    topMode: 'flat',
    roughness: 0.10,
    seed: rng() * 100,
    squashX: rand(rng, 0.95, 1.15),
    squashZ: rand(rng, 0.95, 1.15),
    twist: rand(rng, -0.08, 0.08),
  });

  paintMountain(geo, height, {
    snowLine: 0.78,
    seed: rng() * 100,
    moss: rand(rng, 0.10, 0.16),
    snowAmount: 0.7,
  });

  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, ROCK_MAT));
  return g;
}

/** 5. Рваный / «разрушенный» пик. */
function makeRuined(tile, rng) {
  const height = tile * rand(rng, 0.1, 1.0);
  const jag = rand(rng, 0.06, 0.12);

  const geo = buildMountainGeometry({
    height,
    baseR: tile * 0.5,
    sides: 12 + Math.floor(rng() * 4),
    levels: 18,
    profile: (t) => lerp(0.12, 1, Math.pow(1 - t, 0.7)),
    topMode: 'flat',
    roughness: 0.17,
    seed: rng() * 100,
    squashX: rand(rng, 0.95, 1.2),
    squashZ: rand(rng, 0.95, 1.2),
    lean: rand(rng, -0.05, 0.05),
    twist: rand(rng, -0.25, 0.25),
    jag,
  });

  paintMountain(geo, height, {
    snowLine: rand(rng, 0.62, 0.74),
    seed: rng() * 100,
    moss: rand(rng, 0.08, 0.15),
    snowAmount: 0.85,
  });

  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, ROCK_MAT));
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
 * @param {object} [opts]
 * @param {() => number} [opts.rng=Math.random]
 * @returns {THREE.Group}
 */
export function createMountain(shape = MountainShape.SPIRE, tile = TILE, opts = {}) {
  const rng = opts.rng ?? Math.random;
  const make = BUILDERS[shape] ?? makeSpire;
  const g = make(tile, rng);
  g.userData.kind = 'mountain';
  g.userData.shape = shape;
  return g;
}

/**
 * Случайная гора. Форма выбирается равновероятно, если не передано иначе.
 *
 * @param {() => number} [rng=Math.random] — генератор случайных чисел [0,1)
 * @param {object}   [opts]
 * @param {string[]} [opts.shapes=MOUNTAIN_SHAPES] — из каких форм выбирать
 * @param {number}   [opts.tile=TILE]
 * @returns {THREE.Group}
 */
export function spawnRandomMountain(rng = Math.random, opts = {}) {
  const shapes = opts.shapes ?? MOUNTAIN_SHAPES;
  const tile   = opts.tile   ?? TILE;
  const shape  = shapes[Math.floor(rng() * shapes.length)] ?? MountainShape.SPIRE;
  return createMountain(shape, tile, { rng });
}
