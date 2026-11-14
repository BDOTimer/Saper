import { MAX_ARMY_SIZE } from './units.js';

export const LIMIT_POLICY = Object.freeze({
  minArmies: 8,
  maxArmies: 40,
  minUnits: 80,
  maxUnits: 320,
  unitsPerCity: 8,
  armyMapSpanDivisor: 12,
  unitMapSpanFactor: 2,
  smallArmyShares: Object.freeze({ 1: 0.40, 2: 0.25, 3: 0.15 }),
  smallArmyCaps: Object.freeze({ 1: 16, 2: 10, 3: 6 }),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function limitNumber(value, fallback = Infinity) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizePlayers(players) {
  if (!players) return [];
  if (typeof players.active === 'function') return players.active().filter(Boolean);
  if (Array.isArray(players)) return players.filter(player => player && player.active !== false);
  if (Array.isArray(players.list)) return players.list.filter(player => player && player.active !== false);
  if (players.index != null) return [players];
  return [];
}

function mapSize(world) {
  const width = Number(world?.w ?? world?.width ?? 0) || 0;
  const height = Number(world?.h ?? world?.height ?? 0) || 0;
  const cells = Array.isArray(world?.cells) ? world.cells.length : 0;
  const area = Math.max(1, width * height || cells || 1);
  return { width, height, area };
}

function cityList(world) {
  return world?.cities ?? world?.cityList?.list ?? [];
}

export function getLiveUnitCount(army) {
  if (!Array.isArray(army?.units)) return 0;
  let count = 0;
  for (const unit of army.units) {
    if (unit && unit.alive !== false) count++;
  }
  return count;
}

export function isLiveArmy(army) {
  return !!army
    && army.alive !== false
    && getLiveUnitCount(army) > 0;
}

export function getLiveArmies(player) {
  const list = Array.isArray(player?.army)
    ? player.army
    : Array.isArray(player?.army?.armies) ? player.army.armies : [];
  return list.filter(isLiveArmy);
}

export function countPlayerUnits(player) {
  let count = 0;
  for (const army of getLiveArmies(player)) {
    count += getLiveUnitCount(army);
  }
  return count;
}

export function countPlayerArmiesBySize(player) {
  const counts = { size1: 0, size2: 0, size3: 0, size4plus: 0, total: 0 };

  for (const army of getLiveArmies(player)) {
    const size = getLiveUnitCount(army);
    if (size < 1) continue;

    counts.total++;
    if (size <= 3) counts[`size${size}`]++;
    else counts.size4plus++;
  }

  return counts;
}

export function computeGameLimits(world, players = null) {
  const playerList = normalizePlayers(players);
  const playerCount = Math.max(1, playerList.length);
  const size = mapSize(world);
  const totalCities = cityList(world).filter(city => city && city.type !== 'ruins').length;
  const citiesPerPlayer = Math.max(1, Math.ceil(totalCities / playerCount));
  const mapSpan = Math.sqrt(size.area);
  const mapArmies = Math.ceil(mapSpan / LIMIT_POLICY.armyMapSpanDivisor);

  const maxArmies = clamp(
    citiesPerPlayer + mapArmies,
    LIMIT_POLICY.minArmies,
    LIMIT_POLICY.maxArmies,
  );

  const mapUnits = Math.ceil(mapSpan * LIMIT_POLICY.unitMapSpanFactor);
  const maxUnits = clamp(
    citiesPerPlayer * LIMIT_POLICY.unitsPerCity + mapUnits,
    LIMIT_POLICY.minUnits,
    LIMIT_POLICY.maxUnits,
  );

  const maxSmallArmies = {};

  for (const armySize of [1, 2, 3]) {
    maxSmallArmies[armySize] = clamp(
      Math.ceil(maxArmies * LIMIT_POLICY.smallArmyShares[armySize]),
      1,
      LIMIT_POLICY.smallArmyCaps[armySize],
    );
  }

  return {
    mapWidth: size.width,
    mapHeight: size.height,
    mapArea: size.area,
    totalCities,
    playerCount,
    citiesPerPlayer,
    maxArmies,
    maxUnits,
    maxSmallArmies,
  };
}

export function computePlayerLimits(player, world, players = null) {
  const playerList = players ?? (player ? [player] : null);
  return {
    ...computeGameLimits(world, playerList),
    playerIndex: player?.index ?? null,
  };
}

export class GameLimits {
  constructor(world, players = null) {
    this.world = world ?? null;
    this.players = players ?? null;
    this.base = computeGameLimits(this.world, this.players);
    this.byPlayerIndex = new Map();
    this._indexPlayers();
  }

  refresh() {
    this.base = computeGameLimits(this.world, this.players);
    this._indexPlayers();
    return this.base;
  }

  _indexPlayers() {
    this.byPlayerIndex.clear();

    for (const player of normalizePlayers(this.players)) {
      if (player?.index == null) continue;
      this.byPlayerIndex.set(player.index, {
        ...this.base,
        playerIndex: player.index,
      });
    }
  }

  forPlayer(player) {
    if (!player) return this.base;
    return this.byPlayerIndex.get(player.index)
      ?? { ...this.base, playerIndex: player?.index ?? null };
  }
}

export function canCreateArmy(player, limits) {
  if (!player || !limits) return false;

  const counts = countPlayerArmiesBySize(player);
  const maxArmies = limitNumber(limits.maxArmies);
  if (counts.total >= maxArmies) return false;

  const maxUnits = limitNumber(limits.maxUnits);
  if (countPlayerUnits(player) >= maxUnits) return false;

  const capSize1 = limitNumber(limits.maxSmallArmies?.[1]);
  return counts.size1 < capSize1;
}

export function canGrowArmy(player, limits, army) {
  if (!player || !limits || !army) return false;

  const unitsLength = Array.isArray(army.units) ? army.units.length : 0;
  if (unitsLength >= MAX_ARMY_SIZE) return false;

  const maxUnits = limitNumber(limits.maxUnits);
  if (countPlayerUnits(player) >= maxUnits) return false;

  const live = isLiveArmy(army);
  const counts = countPlayerArmiesBySize(player);

  if (!live) {
    const maxArmies = limitNumber(limits.maxArmies);
    if (counts.total >= maxArmies) return false;
  }

  const nextSize = getLiveUnitCount(army) + 1;

  if (nextSize <= 3) {
    const cap = limitNumber(limits.maxSmallArmies?.[nextSize]);
    if (counts[`size${nextSize}`] >= cap) return false;
  }

  return true;
}
