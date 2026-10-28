/**
 * Combat — упрощённая боевая механика Warlords II:
 * урон = атака * свежесть * рандом(0.8..1.2) − защита * (1 + бонусы местности)
 * Результат мгновенный, без анимации.
 */

import { GameState, Unit, TERRAIN_DEFENSE_BONUS, CITY_DEFENSE_BONUS, NEUTRAL, City, OwnerId } from './types';
import { cityAt, unitAt, tileAt } from './board';
import { Rng } from './rng';

export interface CombatResult {
  attackerId: number;
  defenderId: number;
  damageDealt: number;
  defenderDied: boolean;
  counterDamage: number;
  attackerDied: boolean;
  hit: boolean;
  counter: boolean;
}

/** Суммарный бонус защиты (местность + город) */
export function defenseBonus(state: GameState, unit: Unit): number {
  let bonus = TERRAIN_DEFENSE_BONUS[tileAt(state, unit.x, unit.y) ?? 'plain'];
  const city = cityAt(state, unit.x, unit.y);
  if (city) bonus += CITY_DEFENSE_BONUS;
  return Math.min(bonus, 0.75);
}

/** Шанс попадания: базово 85%, штраф если цель в укреплениях */
export function hitChance(state: GameState, target: Unit): number {
  return Math.max(0.55, 0.85 - defenseBonus(state, target) * 0.3);
}

export function resolveAttack(state: GameState, rng: Rng, attacker: Unit, defender: Unit): CombatResult {
  const res: CombatResult = {
    attackerId: attacker.id,
    defenderId: defender.id,
    damageDealt: 0,
    defenderDied: false,
    counterDamage: 0,
    attackerDied: false,
    hit: false,
    counter: false,
  };

  const hc = hitChance(state, defender);
  if (!rng.chance(hc)) {
    // Промах — атака всё равно тратится
    attacker.attacked = true;
    attacker.mpLeft = 0;
    return res;
  }

  res.hit = true;
  const freshness = attacker.hp / attacker.maxHp; // 0.4..1
  const raw = attacker.attack * (0.5 + 0.5 * freshness) * (0.8 + rng.next() * 0.4);
  const dmg = Math.max(1, Math.round(raw - defender.defense * defenseBonus(state, defender) * 1.5));
  res.damageDealt = dmg;
  defender.hp -= dmg;

  if (defender.hp <= 0) {
    res.defenderDied = true;
    attacker.kills += 1;
    return res;
  }

  // Контратака: цель жива, рядом (melee), не нейтральный гарнизон в городе? — контратакуют все
  const dist = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
  if (dist <= 1) {
    res.counter = true;
    const chc = hitChance(state, attacker);
    if (rng.chance(chc * 0.8)) {
      const cFresh = defender.hp / defender.maxHp;
      const cRaw = defender.attack * 0.6 * (0.5 + 0.5 * cFresh) * (0.8 + rng.next() * 0.4);
      const cdmg = Math.max(1, Math.round(cRaw - attacker.defense * defenseBonus(state, attacker) * 1.5));
      res.counterDamage = cdmg;
      attacker.hp -= cdmg;
      if (attacker.hp <= 0) {
        res.attackerDied = true;
        defender.kills += 1;
      }
    }
  }
  return res;
}

/** Убрать погибших юнитов */
export function cleanupDead(state: GameState): Unit[] {
  const dead = state.units.filter((u) => u.hp <= 0);
  state.units = state.units.filter((u) => u.hp > 0);
  return dead;
}

/** Может ли юнит атаковать цель (соседство, чужой, наличие хода) */
export function canAttack(state: GameState, attacker: Unit, defender: Unit): boolean {
  if (attacker.attacked) return false;
  if (attacker.owner === defender.owner) return false;
  const dist = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
  return dist === 1;
}

/** Ожидаемый урон по цели (для UI и ИИ) — средняя оценка */
export function expectedDamage(state: GameState, attacker: Unit, defender: Unit): number {
  const freshness = attacker.hp / attacker.maxHp;
  const raw = attacker.attack * (0.5 + 0.5 * freshness);
  return Math.max(1, Math.round(raw - defender.defense * defenseBonus(state, defender) * 1.5));
}

/** Захват города: юнит стоит в городе, в городе нет вражеских отрядов */
export function captureCheck(state: GameState, unit: Unit): City | null {
  const city = cityAt(state, unit.x, unit.y);
  if (!city) return null;
  if (city.owner === unit.owner) return null;
  const defenders = state.units.filter(
    (u) => u.id !== unit.id && u.x === city.x && u.y === city.y && u.owner !== unit.owner,
  );
  if (defenders.length > 0) return null;
  return city;
}

export function applyCapture(state: GameState, city: NonNullable<ReturnType<typeof captureCheck>>, unit: Unit): void {
  city.owner = unit.owner;
  city.hireProgress = 0;
  city.hireCooldown = 1;
}

/** Есть ли у фракции юниты/города */
export function factionAlive(state: GameState, owner: OwnerId): boolean {
  return state.cities.some((c) => c.owner === owner) || state.units.some((u) => u.owner === owner);
}
