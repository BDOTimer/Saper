// core/generator.js
import { mulberry32, fbm } from './rng.js';
import { Cell, CellType }  from './cell.js';

export class WorldMapGeneratorConfig {
  constructor(overrides = {}) {
    this.height = 50;
    this.width  = 100;
    this.citiesCount = 20;
    this.riversCount = 6;
    this.water  = 0.30;
    this.forest = 0.20;
    this.plain  = 0.28;
    this.hills  = 0.12;
    this.mount  = 0.10;
    Object.assign(this, overrides);
    this._normalize();
  }
  _normalize() {
    const keys = ['water','forest','plain','hills','mount'];
    let sum = 0;
    for (const k of keys) { this[k] = Math.max(0, +this[k] || 0); sum += this[k]; }
    if (sum < 1e-9) { this.plain = 1; sum = 1; }
    this.normalized = {};
    for (const k of keys) this.normalized[k] = this[k] / sum;

    this.height      = Math.max(40, Math.min(100, this.height|0));
    this.width       = Math.max(40, Math.min(200, this.width|0));
    this.citiesCount = Math.max(3,  Math.min(50,  this.citiesCount|0));
    this.riversCount = Math.max(0,  Math.min(20,  this.riversCount|0));
  }
}

export class WorldMapGenerator {
  constructor(worldMap, config) {
    this.world = worldMap;
    this.config = config;
    this.rng = null;
    this.logs = [];
  }
  _log(s) { this.logs.push(s); console.log('[gen]', s); }

  generate(seed = -1) {
    const cfg = this.config;
    const seedVal = seed < 0 ? Math.floor(Math.random() * 1e6) : (seed | 0);
    this.world.seed = seedVal;
    this.world.cities = [];
    this.world.rivers = [];
    this.rng = mulberry32(seedVal);
    this.logs = [];
    this._log(`Seed: ${seedVal}, size ${cfg.width}x${cfg.height}`);

    this._generateElevation(seedVal);
    this._classifyTerrain();
    this._log('Шум + классификация');

    this._smoothTerrain(2);
    this._log('Сглаживание');

    this._carveRivers(cfg.riversCount, seedVal);
    this._log(`Реки: ${this.world.rivers.length}`);

    this._placeCities(cfg.citiesCount);
    this._log(`Города: ${this.world.cities.length}`);

    this._buildRoads();
    const roadCells = this.world.cells.filter(c => c.overlay === 'road').length;
    this._log(`Дороги: ${roadCells} клеток`);

    return this.world;
  }

  _generateElevation(seed) {
    const w = this.world.w, h = this.world.h;
    const noiseScale = 0.10;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const edgeDist = Math.min(x, y, w - 1 - x, h - 1 - y);
        const edgeFalloff = Math.min(1, edgeDist / 6);
        const n = fbm(x * noiseScale, y * noiseScale, seed, 4, 2, 0.55);
        const elev = n * 0.85 + edgeFalloff * 0.15;
        const cell = new Cell(x, y, CellType.PLAIN);
        cell.elevation = elev;
        this.world.set(x, y, cell);
      }
    }
  }

  _classifyTerrain() {
    const cfg = this.config;
    const elevs = this.world.cells.map(c => c.elevation).slice().sort((a,b)=>a-b);
    const n = elevs.length;
    const q = (p) => elevs[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))];

    const wWater = cfg.normalized.water;
    const wForest = cfg.normalized.forest;
    const wPlain = cfg.normalized.plain;
    const wHills = cfg.normalized.hills;
    const wMount = cfg.normalized.mount;

    const tWater = q(wWater);
    const tMount = q(1 - wMount);
    const tHills = q(1 - wMount - wHills);

    for (const cell of this.world.cells) {
      const e = cell.elevation;
      let type = CellType.PLAIN;
      if (e <= tWater) type = CellType.WATER;
      else if (e >= tMount) type = CellType.MOUNT;
      else if (e >= tHills) type = CellType.HILLS;
      else {
        const mid = tWater + (tHills - tWater) * (wPlain / Math.max(1e-6, wPlain + wForest));
        type = e >= mid ? CellType.FOREST : CellType.PLAIN;
      }
      cell.type = type;
    }
  }

  _smoothTerrain(iterations = 1) {
    const w = this.world.w, h = this.world.h;
    for (let it = 0; it < iterations; it++) {
      const snap = this.world.cells.map(c => c.type);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const cell = this.world.get(x, y);
          if (!cell) continue;
          const counts = {};
          for (const nb of this.world.neighbors8(x, y)) {
            const t = snap[this.world.idx(nb.x, nb.y)];
            counts[t] = (counts[t] || 0) + 1;
          }
          let bestType = cell.type, bestCount = counts[cell.type] || 0;
          for (const [t, c] of Object.entries(counts)) {
            const stickiness = (cell.type === 'water' || cell.type === 'mount') ? 1 : 0;
            if (c + stickiness > bestCount) { bestCount = c + stickiness; bestType = t; }
          }
          if (bestType !== cell.type && bestCount >= 5) cell.type = bestType;
        }
      }
    }
  }

  _carveRivers(count, seed) {
    const world = this.world;
    const rng = mulberry32(seed ^ 0x9E3779B9);
    const sources = world.cells.filter(c => c.type === 'mount' || c.type === 'hills');
    if (!sources.length) return;

    for (let r = 0; r < count; r++) {
      const src = sources[Math.floor(rng() * sources.length)];
      let x = src.x, y = src.y;
      const path = [];
      const seen = new Set();
      for (let step = 0; step < 300; step++) {
        const key = x + ',' + y;
        if (seen.has(key)) break;
        seen.add(key);
        const here = world.get(x, y);
        if (!here) break;
        if (here.type === 'water') { path.push([x, y]); break; }
        path.push([x, y]);
        if (here.overlay !== 'road') here.overlay = here.overlay || 'river';

        let best = null, bestE = here.elevation;
        for (const nb of world.neighbors4(x, y)) {
          if (nb.elevation < bestE) { bestE = nb.elevation; best = nb; }
        }
        if (!best) {
          const opts = world.neighbors4(x, y);
          if (!opts.length) break;
          best = opts[Math.floor(rng() * opts.length)];
        }
        x = best.x; y = best.y;
      }
      if (path.length > 2) world.rivers.push({ cells: path });
    }
  }

  _placeCities(count) {
    const world = this.world;
    const rng = mulberry32(world.seed ^ 0xA5A5A5A5);
    const minDist = Math.max(3, Math.floor(Math.sqrt(world.w * world.h) / Math.max(4, count * 0.8)));

    const candidates = world.cells.filter(c =>
      (c.type === 'plain' || c.type === 'hills' || c.type === 'forest')
    );
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const placed = [];
    for (const c of candidates) {
      if (placed.length >= count) break;
      let ok = true;
      for (const p of placed) {
        const d = Math.abs(p.x - c.x) + Math.abs(p.y - c.y);
        if (d < minDist) { ok = false; break; }
      }
      if (!ok) continue;
      if (c.type === 'water' || c.type === 'mount') continue;
      const idx = world.cities.length;
      c.city = idx;
      world.cities.push({ x: c.x, y: c.y, name: `Город ${idx + 1}` });
      placed.push(c);
    }
  }

  _buildRoads() {
    const cities = this.world.cities;
    if (cities.length < 2) return;

    const n = cities.length;
    const inTree = new Array(n).fill(false);
    inTree[0] = true;
    const edges = [];
    const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

    for (let k = 1; k < n; k++) {
      let bi = -1, bj = -1, best = Infinity;
      for (let i = 0; i < n; i++) {
        if (!inTree[i]) continue;
        for (let j = 0; j < n; j++) {
          if (inTree[j]) continue;
          const d = dist(cities[i], cities[j]);
          if (d < best) { best = d; bi = i; bj = j; }
        }
      }
      if (bj < 0) break;
      inTree[bj] = true;
      edges.push([bi, bj]);
    }

    for (const [i, j] of edges) {
      const a = cities[i], b = cities[j];
      const path = this._aStar(a, b);
      if (!path) continue;
      for (const [x, y] of path) {
        const c = this.world.get(x, y);
        if (!c) continue;
        if (c.city >= 0) continue;
        if (c.overlay === 'river') continue;
        c.overlay = 'road';
      }
    }
  }

  _aStar(start, goal) {
    const world = this.world;
    const key = (x, y) => x + ',' + y;
    const open = [{ x: start.x, y: start.y, g: 0, f: 0, prev: null }];
    const best = new Map([[key(start.x, start.y), 0]]);
    const visited = new Set();
    const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);

    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      const k = key(cur.x, cur.y);
      if (visited.has(k)) continue;
      visited.add(k);
      if (cur.x === goal.x && cur.y === goal.y) {
        const path = [];
        let node = cur;
        while (node.prev) { path.unshift([node.x, node.y]); node = node.prev; }
        return path;
      }
      for (const nb of world.neighbors4(cur.x, cur.y)) {
        const nk = key(nb.x, nb.y);
        if (visited.has(nk)) continue;
        if (nb.type === 'water' || nb.type === 'mount') continue;
        const cost = nb.staminaCost;
        const ng = cur.g + cost;
        if (!best.has(nk) || ng < best.get(nk)) {
          best.set(nk, ng);
          open.push({ x: nb.x, y: nb.y, g: ng, f: ng + h(nb.x, nb.y), prev: cur });
        }
      }
    }
    return null;
  }
}