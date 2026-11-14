// core/production.js
//
// Производство юнитов в городах.
//
// Правила:
//  - У каждого типа юнита есть цена производства — число кругов
//    (зависит от суммы атаки и защиты юнита, см. productionTurns()).
//  - Город держит ОДИН слот производства: выбранный тип + счётчик кругов.
//  - Счётчик уменьшается в конце каждого полного круга. Когда он доходит
//    до нуля, юнит появляется в городе.
//  - Юнит всегда появляется В СОСТАВЕ АРМИИ. Если армии в городе ещё нет,
//    сначала создаётся армия, а затем в неё добавляется юнит.
//  - В армии не может быть больше MAX_ARMY_SIZE юнитов; если текущие
//    армии заполнены, создаётся новая армия.
//  - В городе у одного владельца не может быть больше
//    MAX_ARMIES_PER_CITY армий. Если все 4 армии заняты и полны,
//    производство ждёт (счётчик остаётся на нуле) и повторяет попытку
//    в следующем круге.

import {
  UNIT_TYPES,
  Unit,
  Army,
  MAX_ARMY_SIZE,
  MAX_ARMIES_PER_CITY,
} from './units.js';
import {
  canCreateArmy,
  canGrowArmy,
  computePlayerLimits,
  getLiveUnitCount,
  isLiveArmy,
} from './g-limits.js';

/** Максимум вариантов, которые город показывает в слоте производства. */
export const MAX_PRODUCTION_OPTIONS = 4;

/** Набор производимых юнитов зависит от типа города. */
export const CITY_PRODUCTION = {
  capital:    ['HEAVY_INF', 'HEAVY_CAV', 'MAGE', 'DRAGON'],
  fortress:   ['CROSSBOW', 'HEAVY_INF', 'CATAPULT', 'HEAVY_CAV'],
  provincial: ['LIGHT_INF', 'ARCHERS', 'MEDIUM_INF', 'LIGHT_CAV'],
  backwater:  ['LIGHT_INF', 'ARCHERS', 'LIGHT_CAV'],
};

/**
 * Доступные городу типы юнитов.
 * @param {object} city
 * @returns {string[]}
 */
export function productionOptions(city) {
  // Руины — не город и ничего не производят.
  if (!city || city.type === 'ruins') return [];
  const list = CITY_PRODUCTION[city.type] ?? CITY_PRODUCTION.provincial;
  return list.slice(0, MAX_PRODUCTION_OPTIONS);
}

/**
 * Цена производства в кругах: зависит от суммы атаки и защиты юнита.
 * @param {string} typeKey
 * @returns {number} минимум 1 круг
 */
export function productionTurns(typeKey) {
  const t = UNIT_TYPES[typeKey];
  if (!t) return 1;
  const pts = (t.damage ?? 1) + (t.defense ?? 1);
  return Math.max(1, Math.ceil(pts / 4));
}

/**
 * Привести производство города к валидному состоянию.
 *
 * - если слот пуст/невалиден — выбирается первый доступный тип;
 * - если у города сменился владелец — счётчик начинается заново;
 * - если счётчика ещё нет — он выставляется в полную цену.
 *
 * @param {object} city
 * @returns {string|null} текущий тип производства
 */
export function ensureCityProduction(city) {
  if (!city) return null;
  // Руины не производят: не назначаем им слот и не трогаем счётчики.
  if (city.type === 'ruins') {
    city.production = null;
    city.productionOwner = null;
    city.productionTurnsTotal = 0;
    city.productionTurnsLeft = 0;
    return null;
  }

  const options = productionOptions(city);
  const ownerId = city.ownerId ?? null;
  const ownerChanged = (city.productionOwner ?? null) !== ownerId;

  let key = city.production;
  if (!key || !UNIT_TYPES[key] || !options.includes(key)) {
    key = options[0] ?? null;
  }

  const total = key ? productionTurns(key) : 0;
  const counterMissing = !(city.productionTurnsTotal > 0);

  if (ownerChanged || key !== city.production || counterMissing) {
    city.production = key;
    city.productionOwner = ownerId;
    city.productionTurnsTotal = total;
    city.productionTurnsLeft = total;
  }

  return key;
}

/**
 * Переключить город на производство другого юнита.
 * Счётчик кругов при этом начинается заново.
 *
 * @param {object} city
 * @param {string} typeKey
 * @returns {boolean} удалось ли выбрать тип
 */
export function setCityProduction(city, typeKey) {
  if (!city || !UNIT_TYPES[typeKey]) return false;
  if (city.type === 'ruins') return false;
  if (!productionOptions(city).includes(typeKey)) return false;

  city.production = typeKey;
  city.productionOwner = city.ownerId ?? null;
  city.productionTurnsTotal = productionTurns(typeKey);
  city.productionTurnsLeft = city.productionTurnsTotal;
  return true;
}

/**
 * Найти (или создать) армию в городе и добавить в неё юнита.
 *
 * Если армии ещё нет — сначала создаётся армия, затем в неё кладётся юнит.
 * Если все 4 армии полны или исчерпан лимит игрока — возвращает null
 * (юнит пока не появляется).
 *
 * @param {import('./world.js').WorldMap} world
 * @param {import('./players.js').Player} owner
 * @param {object} city
 * @param {string} typeKey
 * @param {object|null} limits
 * @returns {{army: object, unit: object, city: object, typeKey: string, created: boolean}|null}
 */
export function spawnProducedUnit(world, owner, city, typeKey, limits = null) {
  const type = UNIT_TYPES[typeKey];
  if (!world || !owner || !city || !type) return null;
  if (city.type === 'ruins') return null;
  if (owner.index == null) return null;
  if ((city.ownerId ?? null) !== owner.index) return null;

  const cell = world.get?.(city.x, city.y);
  if (!cell) return null;

  const activeLimits = limits ?? owner.limits ?? computePlayerLimits(owner, world);
  const armies = (cell.army ?? []).filter(a =>
    a && a.idOwner === owner.index && isLiveArmy(a)
  );

  let army = armies
    .filter(a => (a.units?.length ?? 0) < MAX_ARMY_SIZE
      && canGrowArmy(owner, activeLimits, a))
    .sort((a, b) => (getLiveUnitCount(b) - getLiveUnitCount(a))
      || ((a.id ?? 0) - (b.id ?? 0)))[0] ?? null;
  let created = false;

  if (!army) {
    if (armies.length >= MAX_ARMIES_PER_CITY) return null;
    if (!canCreateArmy(owner, activeLimits)) return null;

    army = Army.spawn(owner.index, city.x, city.y);
    owner.addArmy?.(army);
    world.addArmy?.(army);
    created = true;
  }

  const unit = Unit.spawn(owner.index, typeKey);
  unit.name = type.name ?? typeKey;

  if (!army.addUnit(unit)) return null;

  return { army, unit, city, typeKey, created };
}

/**
 * Один тик производства города — вызывается в конце полного круга.
 *
 * @param {import('./world.js').WorldMap} world
 * @param {import('./players.js').Player} owner
 * @param {object} city
 * @param {object|null} limits
 * @returns {{army: object, unit: object, city: object, typeKey: string, created: boolean}|null}
 *          результат, если юнит появился; иначе null
 */
export function tickCityProduction(world, owner, city, limits = null) {
  if (!world || !owner || !city) return null;
  if (city.type === 'ruins') return null;
  if (owner.index == null) return null;
  if ((city.ownerId ?? null) !== owner.index) return null;

  const typeKey = ensureCityProduction(city);
  if (!typeKey) return null;

  // Счётчик тикает только у города с владельцем.
  if (city.productionTurnsLeft > 0) city.productionTurnsLeft--;

  if (city.productionTurnsLeft > 0) return null;

  // Счётчик дошёл до нуля: пробуем выпустить юнита.
  // Если места в армиях нет или исчерпан лимит игрока — счётчик остаётся
  // нулевым и попытка повторится в следующем круге.
  const result = spawnProducedUnit(world, owner, city, typeKey, limits);
  if (!result) return null;

  // Следующий юнит того же типа — счётчик заново.
  city.productionTurnsLeft = city.productionTurnsTotal = productionTurns(typeKey);
  return result;
}
