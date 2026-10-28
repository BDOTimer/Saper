/**
 * Game — главный контроллер: состояние партии, действия игрока/ИИ,
 * ходы, экономика городов, победа, сохранение в localStorage.
 * Чистая логика — события отдаёт наружу через колбэк onChange.
 */

import { Rng } from './rng';
import {
  GameState, FactionId, OwnerId, Unit, City, LogEntry,
  UNIT_SPECS, RU, NEUTRAL,
} from './types';
import {
  MAP_W, MAP_H, generateMap, setupStartingPosition, makeUnit,
  reachable, pathTo, canEnter, tileAt, unitAt, cityAt, manhattan, ReachMap,
} from './board';
import {
  resolveAttack, cleanupDead, canAttack, captureCheck, applyCapture, factionAlive,
} from './combat';

export const SAVE_KEY = 'warlords2-mvp-save-v1';

export interface GameCallbacks {
  onStateChange: (state: GameState) => void;
  onLog: (entry: LogEntry) => void;
  onEvent: (event: GameEvent) => void;
}

export type GameEvent =
  | { type: 'move'; unitId: number; path: { x: number; y: number }[] }
  | { type: 'attack'; result: ReturnType<typeof resolveAttack>; at: { x: number; y: number } }
  | { type: 'capture'; city: City; by: OwnerId }
  | { type: 'hire'; at: { x: number; y: number }; by: OwnerId }
  | { type: 'death'; at: { x: number; y: number } }
  | { type: 'turnStart'; player: FactionId; turn: number }
  | { type: 'gameOver'; winner: OwnerId };

export class Game {
  state!: GameState;
  private rng!: Rng;
  private cb: GameCallbacks;
  /** Доступ к колбэкам для ИИ */
  cbRef(): GameCallbacks {
    return this.cb;
  }
  /** Текущий выбор игрока */
  selectedUnitId: number | null = null;
  /** Кэш достижимости выбранного юнита */
  selectedReach: ReachMap | null = null;

  constructor(cb: GameCallbacks) {
    this.cb = cb;
  }

  // ---------- Жизненный цикл ----------

  newGame(seed?: number): void {
    const s = seed ?? Math.floor(Math.random() * 0xffffff);
    this.rng = new Rng(s);
    const { tiles, cities, nextId } = generateMap(new Rng(s));

    this.state = {
      seed: s,
      mapW: MAP_W,
      mapH: MAP_H,
      turn: 1,
      current: 0,
      tiles,
      units: [],
      cities,
      log: [],
      winner: null,
      nextEntityId: nextId,
      firstPlayer: 0,
    };

    setupStartingPosition(this.state, this.rng);

    // refresh обоих игроков на старте
    this.refreshFaction(0);
    this.refreshFaction(1);

    this.log('system', `Новая партия. Seed: ${s}. Карта ${MAP_W}×${MAP_H}, городов: ${cities.length}.`);
    this.log('system', 'Захватите все города, чтобы победить!');
    this.selectedUnitId = null;
    this.selectedReach = null;
    this.cb.onStateChange(this.state);
  }

  /** Начало хода фракции: восстановление MP, лечение в городах, найм */
  private refreshFaction(f: FactionId): void {
    for (const u of this.state.units) {
      if (u.owner !== f) continue;
      u.mpLeft = u.moveRange;
      u.attacked = false;
      const city = cityAt(this.state, u.x, u.y);
      if (city && city.owner === f) {
        u.hp = Math.min(u.maxHp, u.hp + 4); // лечение в городе
      }
    }
    for (const c of this.state.cities) {
      if (c.owner === f && c.hireCooldown > 0) c.hireCooldown--;
    }
  }

  endTurn(): void {
    if (this.state.winner !== null) return;
    const prev = this.state.current;
    const next: FactionId = prev === 0 ? 1 : 0;

    if (next === this.state.firstPlayer) {
      this.state.turn++;
    }
    this.state.current = next;
    this.selectedUnitId = null;
    this.selectedReach = null;

    this.refreshFaction(next);
    this.log('info', `Ход ${this.state.turn}: ${RU.faction[next]}.`);
    this.cb.onEvent({ type: 'turnStart', player: next, turn: this.state.turn });
    this.cb.onStateChange(this.state);
  }

  // ---------- Выбор и перемещение ----------

  selectUnitAt(x: number, y: number): boolean {
    const u = unitAt(this.state, x, y);
    if (!u || u.owner !== this.state.current || this.state.winner !== null) {
      this.selectedUnitId = null;
      this.selectedReach = null;
      this.cb.onStateChange(this.state);
      return false;
    }
    this.selectedUnitId = u.id;
    this.selectedReach = reachable(this.state, u);
    this.cb.onStateChange(this.state);
    return true;
  }

  clearSelection(): void {
    this.selectedUnitId = null;
    this.selectedReach = null;
    this.cb.onStateChange(this.state);
  }

  get selectedUnit(): Unit | null {
    if (this.selectedUnitId === null) return null;
    return this.state.units.find((u) => u.id === this.selectedUnitId) ?? null;
  }

  /** Клик игрока по клетке: перемещение или атака выбранного юнита */
  clickTile(x: number, y: number): void {
    if (this.state.winner !== null || this.state.current !== 0) return;
    const sel = this.selectedUnit;
    if (!sel) {
      this.selectUnitAt(x, y);
      return;
    }

    const targetUnit = unitAt(this.state, x, y);
    if (targetUnit && targetUnit.id !== sel.id) {
      if (targetUnit.owner === this.state.current) {
        this.selectUnitAt(x, y); // перевыбор на своего
        return;
      }
      this.tryAttack(sel, targetUnit);
      return;
    }

    if (targetUnit && targetUnit.id === sel.id) {
      // клик по себе — ожидание: сброс подсветки
      return;
    }

    const reach = this.selectedReach;
    if (reach && reach.cost.has(`${x},${y}`)) {
      this.moveSelected(x, y);
      return;
    }
    // ничего — снятие выделения
    this.clearSelection();
  }

  moveSelected(tx: number, ty: number): boolean {
    const sel = this.selectedUnit;
    if (!sel || !this.selectedReach) return false;
    return this.moveUnit(sel, tx, ty, this.selectedReach);
  }

  private moveUnit(unit: Unit, tx: number, ty: number, reach: ReachMap): boolean {
    if (!canEnter(this.state, unit, tx, ty)) return false;
    if (!reach.cost.has(`${tx},${ty}`)) return false;
    const path = pathTo(this.state, unit, reach, tx, ty);
    if (!path.length) return false;

    // reach.cost хранит ОСТАТОК очков — он и становится новым mpLeft
    unit.x = tx;
    unit.y = ty;
    unit.mpLeft = Math.max(0, reach.cost.get(`${tx},${ty}`) ?? 0);
    this.cb.onEvent({ type: 'move', unitId: unit.id, path });
    this.log('info', `Отряд движется к (${tx}, ${ty}).`);

    // Захват города
    const cap = captureCheck(this.state, unit);
    if (cap) {
      applyCapture(this.state, cap, unit);
      this.cb.onEvent({ type: 'capture', city: cap, by: unit.owner });
      this.log('city', `${RU.faction[unit.owner]} захватывает ${cap.name}!`);
      this.checkVictory();
    }

    // Обновляем достижимость
    this.selectedReach = reachable(this.state, unit);
    this.cb.onStateChange(this.state);
    return true;
  }

  tryAttack(attacker: Unit, defender: Unit): void {
    if (!canAttack(this.state, attacker, defender)) {
      this.log('info', 'Цель вне досягаемости — подойдите вплотную.');
      return;
    }
    const res = resolveAttack(this.state, this.rng, attacker, defender);
    attacker.attacked = true;
    attacker.mpLeft = 0;
    const dead = cleanupDead(this.state);

    this.cb.onEvent({ type: 'attack', result: res, at: { x: defender.x, y: defender.y } });
    if (res.hit) {
      this.log('combat', `Бой! Урон: ${res.damageDealt}.` + (res.defenderDied ? ' Враг уничтожен!' : ''));
    } else {
      this.log('combat', 'Промах!');
    }
    if (res.counter && res.counterDamage > 0) {
      this.log('combat', `Контратака! Урон: ${res.counterDamage}.` + (res.attackerDied ? ' Наш отряд пал...' : ''));
    } else if (res.counter) {
      this.log('combat', 'Контратака отражена.');
    }
    for (const d of dead) {
      this.cb.onEvent({ type: 'death', at: { x: d.x, y: d.y } });
    }

    if (dead.some((d) => d.id === attacker.id)) {
      this.clearSelection();
    } else {
      this.selectedReach = reachable(this.state, attacker);
    }
    this.checkVictory();
    this.cb.onStateChange(this.state);
  }

  // ---------- Найм ----------

  canHire(city: City, who: OwnerId): boolean {
    return (
      this.state.winner === null &&
      city.owner === who &&
      city.hireCooldown <= 0 &&
      !unitAt(this.state, city.x, city.y) &&
      tileAt(this.state, city.x, city.y) !== null
    );
  }

  hire(cityId: number): boolean {
    const city = this.state.cities.find((c) => c.id === cityId);
    if (!city) return false;
    if (!this.canHire(city, this.state.current)) return false;
    const u = makeUnit(this.state, this.state.current, city.x, city.y);
    this.state.units.push(u);
    city.hireCooldown = UNIT_SPECS.infantry.hireCostTurns;
    city.hireProgress = 0;
    this.cb.onEvent({ type: 'hire', at: { x: city.x, y: city.y }, by: this.state.current });
    this.log('city', `${RU.faction[this.state.current]} нанимает отряд в ${city.name}.`);

    if (this.selectedUnit?.owner === this.state.current) {
      this.selectedReach = reachable(this.state, this.selectedUnit);
    }
    this.cb.onStateChange(this.state);
    return true;
  }

  /** Города текущего игрока со свободным наймом */
  hireActionsAvailable(): City[] {
    if (this.state.winner !== null) return [];
    return this.state.cities.filter((c) => this.canHire(c, this.state.current));
  }

  // ---------- Победа ----------

  checkVictory(): void {
    if (this.state.winner !== null) return;
    if (!this.state.cities.length) return;

    // Победа: все города принадлежат одной фракции
    const owner = this.state.cities[0].owner;
    if (owner !== NEUTRAL && this.state.cities.every((c) => c.owner === owner)) {
      this.state.winner = owner;
      this.log('system', `ПОБЕДА! ${RU.faction[owner]} контролирует все города!`);
      this.cb.onEvent({ type: 'gameOver', winner: owner });
      return;
    }
    // Дополнительно: фракция без городов и юнитов — проиграла (её города уже у врага)
    if (!factionAlive(this.state, 0)) {
      this.state.winner = 1;
      this.cb.onEvent({ type: 'gameOver', winner: 1 });
    } else if (!factionAlive(this.state, 1)) {
      this.state.winner = 0;
      this.cb.onEvent({ type: 'gameOver', winner: 0 });
    }
  }

  log(kind: LogEntry['kind'], text: string): void {
    const entry: LogEntry = { turn: this.state.turn, text, kind };
    this.state.log.push(entry);
    if (this.state.log.length > 60) this.state.log.shift();
    this.cb.onLog(entry);
  }

  // ---------- Сохранение ----------

  save(): boolean {
    try {
      const data = JSON.stringify({
        v: 1,
        state: this.state,
        savedAt: Date.now(),
      });
      localStorage.setItem(SAVE_KEY, data);
      this.log('system', 'Партия сохранена.');
      return true;
    } catch {
      this.log('system', 'Ошибка сохранения.');
      return false;
    }
  }

  hasSave(): boolean {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { v: number; state: GameState };
      if (parsed.v !== 1 || !parsed.state?.tiles) return false;
      this.state = parsed.state;
      this.rng = new Rng(this.state.seed ^ 0x5f5f5f);
      this.selectedUnitId = null;
      this.selectedReach = null;
      this.log('system', 'Партия загружена.');
      this.cb.onStateChange(this.state);
      return true;
    } catch {
      return false;
    }
  }

  // ---------- Вспомогательное ----------

  /** Юниты текущей фракции, которые ещё могут действовать */
  actionableUnits(): Unit[] {
    return this.state.units.filter(
      (u) => u.owner === this.state.current && (u.mpLeft > 0 || !u.attacked),
    );
  }

  /** Расстояние до ближайшего города, не принадлежащего owner */
  nearestEnemyCity(unit: Unit): City | null {
    let best: City | null = null;
    let bd = Infinity;
    for (const c of this.state.cities) {
      if (c.owner === unit.owner) continue;
      const d = manhattan(unit.x, unit.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
}
