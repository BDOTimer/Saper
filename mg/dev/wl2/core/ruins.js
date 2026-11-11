// core/ruins.js
//
// Руины — древнее строение на карте. Это НЕ город:
//  - у руин нет владельца и они не производят юнитов;
//  - при посещении армией (не чаще одного раза за RUINS_VISIT_COOLDOWN
//    полных кругов) руины «пробуждают» 1–3 монстров ОДНОГО типа;
//  - выбор типа и количества детерминирован (seeded PRNG), чтобы
//    одинаковая карта + одинаковый ход давали одинаковый результат;
//  - сгенерированные монстры хранятся в состоянии руин как encounter
//    (не выставляются на клетку отдельной армией, чтобы не запускать
//    обычный бой при входе).

import { UNIT_TYPES, Unit } from './units.js';
import { mulberry32 } from './rng.js';

/** Ключ типа строения в CITY_TYPE. */
export const RUINS_TYPE = 'ruins';

/** Сколько полных кругов руины «спят» между пробуждениями. */
export const RUINS_VISIT_COOLDOWN = 10;

/** Типы монстров, которых могут пробудить руины (один тип на визит). */
export const RUINS_MONSTER_TYPES = Object.freeze(['DRAGON', 'GHOST', 'WIZARD']);

/** Границы количества монстров за одно пробуждение. */
export const RUINS_MIN_MONSTERS = 1;
export const RUINS_MAX_MONSTERS = 3;

/** Это руины? */
export function isRuins(city) {
  return !!city && city.type === RUINS_TYPE;
}

/**
 * Лениво создать/нормализовать состояние руин на объекте города.
 * @param {object} city
 * @returns {{lastVisitTurn: number|null, visitSeq: number, lastTypeKey: string|null, lastMonsters: object[]}|null}
 */
export function ensureRuinsState(city) {
  if (!isRuins(city)) return null;

  if (!city.ruins || typeof city.ruins !== 'object') {
    city.ruins = {
      lastVisitTurn: null,
      visitSeq: 0,
      lastTypeKey: null,
      lastMonsters: [],
    };
  }
  const st = city.ruins;
  if (st.lastVisitTurn === undefined) st.lastVisitTurn = null;
  if (!Number.isFinite(st.visitSeq)) st.visitSeq = 0;
  if (st.lastTypeKey === undefined) st.lastTypeKey = null;
  if (!Array.isArray(st.lastMonsters)) st.lastMonsters = [];

  return st;
}

/**
 * Сколько кругов осталось до следующего пробуждения.
 * @param {object} city
 * @param {number} turn — номер текущего полного круга
 * @returns {number} 0, если руины готовы
 */
export function ruinsCooldownLeft(city, turn) {
  const st = ensureRuinsState(city);
  if (!st || st.lastVisitTurn == null) return 0;

  const t = turn | 0;
  return Math.max(0, RUINS_VISIT_COOLDOWN - (t - st.lastVisitTurn));
}

/**
 * Детерминированный seed для конкретного визита.
 * Не использует Math.random: только данные мира, координаты и ход.
 */
function visitSeed(world, city, turn, seq) {
  const worldSeed = (world?.seed ?? 0) | 0;
  return (
    worldSeed ^
    Math.imul((city.x | 0) + 1, 0x27d4eb2d) ^
    Math.imul((city.y | 0) + 1, 0x165667b1) ^
    Math.imul((turn | 0) + 1, 0x9e3779b1) ^
    Math.imul((seq | 0) + 1, 0x85ebca6b)
  ) >>> 0;
}

/**
 * Посетить руины армией.
 *
 * @param {import('./world.js').WorldMap} world
 * @param {import('./units.js').Army} army
 * @param {object} city
 * @param {number} turn — текущий полный круг (STATE.turn)
 * @returns {{
 *   visited: boolean,
 *   reason: 'spawned'|'cooldown'|'not-ruins'|'no-army',
 *   typeKey: string|null,
 *   count: number,
 *   monsters: object[],
 *   cooldownLeft: number,
 * }}
 */
export function visitRuins(world, army, city, turn) {
  const empty = {
    visited: false,
    reason: 'not-ruins',
    typeKey: null,
    count: 0,
    monsters: [],
    cooldownLeft: 0,
  };

  if (!isRuins(city)) return empty;
  if (!army) return { ...empty, reason: 'no-army' };

  const t = turn | 0;
  const st = ensureRuinsState(city);
  const cooldownLeft = ruinsCooldownLeft(city, t);

  if (cooldownLeft > 0) {
    return {
      ...empty,
      reason: 'cooldown',
      typeKey: st.lastTypeKey,
      cooldownLeft,
    };
  }

  const rng = mulberry32(visitSeed(world, city, t, st.visitSeq));

  const typeKeys = RUINS_MONSTER_TYPES;
  const typeKey = typeKeys[Math.floor(rng() * typeKeys.length)] ?? 'DRAGON';
  const span = RUINS_MAX_MONSTERS - RUINS_MIN_MONSTERS + 1;
  const count = RUINS_MIN_MONSTERS + Math.floor(rng() * span);

  const monsters = [];
  for (let i = 0; i < count; i++) {
    const unit = Unit.spawn(null, typeKey);
    unit.idOwner = null;
    unit.name = UNIT_TYPES[typeKey]?.name ?? typeKey;
    monsters.push(unit);
  }

  st.lastVisitTurn = t;
  st.visitSeq++;
  st.lastTypeKey = typeKey;
  st.lastMonsters = monsters;

  return {
    visited: true,
    reason: 'spawned',
    typeKey,
    count,
    monsters,
    cooldownLeft: RUINS_VISIT_COOLDOWN,
  };
}
