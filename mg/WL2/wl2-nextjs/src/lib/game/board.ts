/**
 * Board — сетка карты, процедурная генерация, валидация и поиск путей.
 * Логика на квадратах, визуализация свободная (плоские меши).
 */

import { Rng } from './rng';
import {
  TerrainType, Tile, Unit, City, GameState,
  TERRAIN_MOVE_COST, CITY_NAMES, NEUTRAL, UNIT_SPECS, OwnerId,
} from './types';

export const MAP_W = 15;
export const MAP_H = 15;

export interface PathNode {
  x: number;
  y: number;
  cost: number;
}

/** Результат достижения клеток для одного юнита */
export interface ReachMap {
  /** ключ "x,y" -> остаток очков движения */
  cost: Map<string, number>;
  /** ключ "x,y" -> откуда пришли (для восстановления пути) */
  from: Map<string, string>;
}

export const key = (x: number, y: number) => `${x},${y}`;
export const parseKey = (k: string): [number, number] => {
  const [a, b] = k.split(',');
  return [Number(a), Number(b)];
};

export const inBounds = (x: number, y: number, w: number, h: number): boolean =>
  x >= 0 && y >= 0 && x < w && y < h;

/** Ортогональное расстояние (ходы короля без диагоналей — как в Warlords II) */
export const manhattan = (x1: number, y1: number, x2: number, y2: number): number =>
  Math.abs(x1 - x2) + Math.abs(y1 - y2);

export const tileAt = (state: GameState, x: number, y: number): TerrainType | null =>
  inBounds(x, y, state.mapW, state.mapH) ? state.tiles[y][x] : null;

export const unitAt = (state: GameState, x: number, y: number): Unit | undefined =>
  state.units.find((u) => u.x === x && u.y === y);

export const cityAt = (state: GameState, x: number, y: number): City | undefined =>
  state.cities.find((c) => c.x === x && c.y === y);

/** Может ли юнит войти на клетку (проходимость + нет чужого юнита) */
export function canEnter(state: GameState, unit: Unit, x: number, y: number): boolean {
  const t = tileAt(state, x, y);
  if (t === null || !Number.isFinite(TERRAIN_MOVE_COST[t])) return false;
  const occ = unitAt(state, x, y);
  if (occ && occ.id !== unit.id) return false;
  return true;
}

/** Достижимые клетки с учётом стоимости местности (Дейкстра по сетке) */
export function reachable(state: GameState, unit: Unit): ReachMap {
  const res: ReachMap = { cost: new Map(), from: new Map() };
  const start = key(unit.x, unit.y);
  res.cost.set(start, unit.mpLeft);
  // Очередь с приоритетом — маленькая карта, достаточно массива
  const open: PathNode[] = [{ x: unit.x, y: unit.y, cost: unit.mpLeft }];

  while (open.length) {
    open.sort((a, b) => b.cost - a.cost);
    const cur = open.pop()!;
    const curKey = key(cur.x, cur.y);
    const curLeft = res.cost.get(curKey) ?? 0;
    if (curLeft < cur.cost) continue; // устаревшая запись

    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inBounds(nx, ny, state.mapW, state.mapH)) continue;
      const t = state.tiles[ny][nx];
      const step = TERRAIN_MOVE_COST[t];
      if (!Number.isFinite(step)) continue;
      const occ = unitAt(state, nx, ny);
      if (occ && occ.id !== unit.id) continue; // сквозь отряды не проходит
      const left = curLeft - step;
      if (left < 0) continue;
      const nk = key(nx, ny);
      const prev = res.cost.get(nk);
      if (prev === undefined || left > prev) {
        res.cost.set(nk, left);
        res.from.set(nk, curKey);
        open.push({ x: nx, y: ny, cost: left });
      }
    }
  }
  return res;
}

/** Восстановление пути от старта к клетке */
export function pathTo(state: GameState, unit: Unit, reach: ReachMap, tx: number, ty: number): { x: number; y: number }[] {
  const target = key(tx, ty);
  if (!reach.cost.has(target)) return [];
  const path: { x: number; y: number }[] = [];
  let cur = target;
  const start = key(unit.x, unit.y);
  while (cur !== start) {
    const [cx, cy] = parseKey(cur);
    path.unshift({ x: cx, y: cy });
    const prev = reach.from.get(cur);
    if (!prev) break;
    cur = prev;
  }
  return path;
}

/** Связность карты: все ключевые точки достижимы из стартовой (BFS по проходимым клеткам) */
function isConnected(tiles: TerrainType[][], from: { x: number; y: number }, targets: { x: number; y: number }[]): boolean {
  const h = tiles.length;
  const w = tiles[0].length;
  const seen = new Set<string>([key(from.x, from.y)]);
  const q: { x: number; y: number }[] = [from];
  while (q.length) {
    const c = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (!inBounds(nx, ny, w, h)) continue;
      if (!Number.isFinite(TERRAIN_MOVE_COST[tiles[ny][nx]])) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ x: nx, y: ny });
    }
  }
  return targets.every((t) => seen.has(key(t.x, t.y)));
}

/** Процедурная генерация карты с seed: террейн, города, нейтральные гарнизоны */
export function generateMap(rng: Rng): { tiles: TerrainType[][]; cities: City[]; nextId: number } {
  const tiles: TerrainType[][] = [];
  // 1) Базовый террейн через value noise: высота => гора/равнина/вода, влажность => лес
  for (let y = 0; y < MAP_H; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < MAP_W; x++) {
      const h = rng.noise2D(x, y, 4.5, 1) * 0.65 + rng.noise2D(x, y, 2.2, 7) * 0.35;
      const m = rng.noise2D(x, y, 3.3, 13);
      let t: TerrainType = 'plain';
      if (h < 0.22) t = 'water';
      else if (h > 0.78) t = 'mountain';
      else if (m > 0.62) t = 'forest';
      row.push(t);
    }
    tiles.push(row);
  }

  // 2) Города: 6 штук, не ближе 3 клеток друг к другу, только на равнине/лесу
  const cities: City[] = [];
  let nextId = 1;
  let attempts = 0;
  while (cities.length < 6 && attempts < 800) {
    attempts++;
    const x = rng.int(1, MAP_W - 2);
    const y = rng.int(1, MAP_H - 2);
    const t = tiles[y][x];
    if (t !== 'plain' && t !== 'forest') continue;
    if (cities.some((c) => manhattan(c.x, c.y, x, y) < 3)) continue;
    // Город выравнивает под себя равнину
    tiles[y][x] = 'plain';
    const nameIdx = cities.length;
    cities.push({
      id: nextId++,
      name: CITY_NAMES[nameIdx % CITY_NAMES.length],
      x, y,
      owner: NEUTRAL,
      hireProgress: 0,
      hireCooldown: 0,
    });
  }

  // 3) Связность: если городов не все достижимы — расчищаем воду/горы по прямой между парами
  const ensureConnectivity = () => {
    const passable = (x: number, y: number) =>
      Number.isFinite(TERRAIN_MOVE_COST[tiles[y][x]]);
    let guard = 0;
    while (cities.length > 1 && guard++ < 50) {
      const start = cities[0];
      const seen = new Set<string>([key(start.x, start.y)]);
      const q: { x: number; y: number }[] = [start];
      const prev = new Map<string, string>();
      let reached: City | null = null;
      while (q.length && !reached) {
        const c = q.shift()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = c.x + dx;
          const ny = c.y + dy;
          if (!inBounds(nx, ny, MAP_W, MAP_H) || !passable(nx, ny)) continue;
          const k = key(nx, ny);
          if (seen.has(k)) continue;
          seen.add(k);
          prev.set(k, key(c.x, c.y));
          q.push({ x: nx, y: ny });
          const cc = cities.find((ci) => ci.x === nx && ci.y === ny);
          if (cc && cc.id !== start.id) { reached = cc; break; }
        }
      }
      if (!reached) {
        // Прокладываем «тракт» к самому дальнему городу
        const far = cities.reduce((a, b) =>
          manhattan(a.x, a.y, start.x, start.y) >= manhattan(b.x, b.y, start.x, start.y) ? a : b);
        let cx = far.x, cy = far.y;
        while (cx !== start.x || cy !== start.y) {
          if (tiles[cy][cx] === 'water' || tiles[cy][cx] === 'mountain') tiles[cy][cx] = 'plain';
          if (cx !== start.x) cx += Math.sign(start.x - cx);
          else cy += Math.sign(start.y - cy);
        }
        if (tiles[cy][cx] === 'water' || tiles[cy][cx] === 'mountain') tiles[cy][cx] = 'plain';
      } else break;
    }
  };
  ensureConnectivity();

  // Финальная проверка на всякий случай: если что-то не так — принудительно расчищаем
  const targets = cities.map((c) => ({ x: c.x, y: c.y }));
  if (!isConnected(tiles, cities[0], targets)) {
    for (let i = 1; i < cities.length; i++) {
      let cx = cities[i].x, cy = cities[i].y;
      while (cx !== cities[0].x || cy !== cities[0].y) {
        if (Number.isFinite(TERRAIN_MOVE_COST[tiles[cy][cx]]) === false) tiles[cy][cx] = 'plain';
        if (cx !== cities[0].x) cx += Math.sign(cities[0].x - cx);
        else cy += Math.sign(cities[0].y - cy);
      }
    }
  }

  return { tiles, cities, nextId };
}

/** Создать юнита указанной фракции */
export function makeUnit(state: GameState, owner: OwnerId, x: number, y: number, spec = UNIT_SPECS.infantry): Unit {
  return {
    id: state.nextEntityId++,
    owner,
    x, y,
    type: 'infantry',
    hp: spec.hp,
    maxHp: spec.hp,
    attack: spec.attack,
    defense: spec.defense,
    moveRange: spec.moveRange,
    mpLeft: spec.moveRange,
    attacked: false,
    kills: 0,
  };
}

/** Стартовая расстановка: столицы двух фракций, их отряды, нейтральные гарнизоны */
export function setupStartingPosition(state: GameState, rng: Rng): void {
  const { cities } = state;
  // Выбираем два максимально удалённых города как столицы
  let bestPair: [City, City] = [cities[0], cities[1]];
  let bestDist = -1;
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      const d = manhattan(cities[i].x, cities[i].y, cities[j].x, cities[j].y);
      if (d > bestDist) { bestDist = d; bestPair = [cities[i], cities[j]]; }
    }
  }
  const [cap0, cap1] = bestPair;
  cap0.owner = 0;
  cap1.owner = 1;

  // Стартовые отряды в столицах
  state.units.push(makeUnit(state, 0, cap0.x, cap0.y));
  state.units.push(makeUnit(state, 0, cap0.x, Math.max(0, cap0.y - 1)));
  state.units.push(makeUnit(state, 1, cap1.x, cap1.y));
  state.units.push(makeUnit(state, 1, cap1.x, Math.min(state.mapH - 1, cap1.y + 1)));

  // Нейтральные гарнизоны: в части городов, начиная с самого дальнего
  const neutralCities = cities
    .filter((c) => c.owner === NEUTRAL)
    .sort((a, b) =>
      Math.min(manhattan(a.x, a.y, cap0.x, cap0.y), manhattan(a.x, a.y, cap1.x, cap1.y)) -
      Math.min(manhattan(b.x, b.y, cap0.x, cap0.y), manhattan(b.x, b.y, cap1.x, cap1.y)));
  const garrisonCount = Math.min(3, neutralCities.length);
  for (let i = 0; i < garrisonCount; i++) {
    const c = neutralCities[i];
    state.units.push(makeUnit(state, NEUTRAL, c.x, c.y));
  }
}
