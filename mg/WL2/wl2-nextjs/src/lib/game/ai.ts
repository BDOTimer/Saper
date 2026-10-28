/**
 * AI — конечный автомат для фракции ИИ.
 * Состояния юнита: RETREAT (hp < 30%) -> DEFEND / ATTACK / SEIZE (город) / ADVANCE.
 * Ходы выполняются с задержкой, чтобы игрок видел последовательность действий.
 */

import { Game } from './game';
import {
  Unit, City, FactionId, UNIT_SPECS, OwnerId, GameState,
} from './types';
import {
  reachable, pathTo, unitAt, cityAt, manhattan, canEnter, tileAt, ReachMap,
} from './board';
import { canAttack, expectedDamage, defenseBonus, resolveAttack, cleanupDead } from './combat';
import { Rng } from './rng';

type UnitStateName = 'retreat' | 'attack' | 'seize' | 'advance' | 'idle';

interface DecidedAction {
  unit: Unit;
  state: UnitStateName;
  kind: 'move' | 'attack' | 'wait';
  target?: { x: number; y: number };
  targetUnitId?: number;
  reason?: string;
}

export class AI {
  private game: Game;
  private rng: Rng;
  private faction: FactionId = 1;
  private timers: ReturnType<typeof setTimeout>[] = [];
  running = false;
  /** Последние состояния юнитов (для отладки/подсветки) */
  lastStates: Map<number, UnitStateName> = new Map();

  constructor(game: Game, seed = 12345) {
    this.game = game;
    this.rng = new Rng(seed);
  }

  dispose(): void {
    this.stop();
  }

  stop(): void {
    this.running = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  /** Запустить ход ИИ (вызывается при переходе хода к фракции 1) */
  playTurn(onDone: () => void): void {
    if (this.game.state.winner !== null || this.game.state.current !== this.faction) {
      onDone();
      return;
    }
    this.running = true;
    const plan = this.planTurn();
    let i = 0;

    const step = () => {
      if (!this.running || this.game.state.winner !== null) {
        this.finish(onDone);
        return;
      }
      if (i >= plan.length) {
        this.finish(onDone);
        return;
      }
      const act = plan[i++];
      try {
        this.execute(act);
      } catch (e) {
        console.warn('AI step error', e);
      }
      this.timers.push(setTimeout(step, 420));
    };
    this.timers.push(setTimeout(step, 500));
  }

  private finish(onDone: () => void): void {
    this.running = false;
    this.timers.push(setTimeout(onDone, 250));
  }

  /** Построение плана на ход: сортируем юниты — атакующие первыми */
  private planTurn(): DecidedAction[] {
    const st = this.game.state;
    const myUnits = st.units.filter((u) => u.owner === this.faction);
    const plan: DecidedAction[] = [];

    for (const u of myUnits) {
      const act = this.decide(u);
      if (act) plan.push(act);
    }
    plan.sort((a, b) => {
      const rank = (s: UnitStateName) => (s === 'attack' ? 0 : s === 'seize' ? 1 : s === 'advance' ? 2 : 3);
      return rank(a.state) - rank(b.state);
    });
    return plan;
  }

  /** Решение для одного юнита (FSM) */
  private decide(u: Unit): DecidedAction | null {
    const st = this.game.state;
    const reach = reachable(st, u);
    const hpRatio = u.hp / u.maxHp;

    // --- RETREAT: слабое здоровье — к ближайшему своему городу ---
    if (hpRatio < 0.3) {
      const home = st.cities
        .filter((c) => c.owner === this.faction)
        .sort((a, b) => manhattan(u.x, u.y, a.x, a.y) - manhattan(u.x, u.y, b.x, b.y))[0];
      if (home) {
        if (u.x === home.x && u.y === home.y) {
          return { unit: u, state: 'retreat', kind: 'wait', reason: 'лечится в городе' };
        }
        const step = this.stepToward(u, reach, home.x, home.y);
        if (step) return { unit: u, state: 'retreat', kind: 'move', target: step };
      }
      return { unit: u, state: 'retreat', kind: 'wait' };
    }

    // --- ATTACK: враг рядом и шансы неплохие ---
    const enemies = st.units.filter((e) => e.owner !== this.faction);
    const reachableAttack = enemies
      .filter((e) => this.adjacentCells(u, reach).some((c) => c.x === e.x && c.y === e.y))
      .map((e) => {
        const dmg = expectedDamage(st, u, e);
        const ehp = e.hp;
        return { e, score: dmg >= ehp ? 1000 : dmg * 2 - e.attack + (canAttack(st, u, e) ? 5 : 0) };
      })
      .filter((v) => v.score > 0)
      .sort((a, b) => b.score - a.score);

    if (reachableAttack.length && (hpRatio >= 0.3 || reachableAttack[0].score >= 1000)) {
      const pick = reachableAttack[0].e;
      // Уже рядом — атакуем немедленно
      if (canAttack(st, u, pick)) {
        return { unit: u, state: 'attack', kind: 'attack', targetUnitId: pick.id, target: { x: pick.x, y: pick.y } };
      }
      // Подойти вплотную на клетку рядом с целью (свободную)
      const spots = this.freeAdjacent(st, pick).filter((c) => reach.cost.has(`${c.x},${c.y}`));
      if (spots.length) {
        const best = spots.sort((a, b) => reach.cost.get(`${a.x},${a.y}`)! - reach.cost.get(`${b.x},${b.y}`)!)[0];
        return { unit: u, state: 'attack', kind: 'move', target: best, targetUnitId: pick.id };
      }
    }

    // --- SEIZE: город без вражеских отрядов рядом ---
    const openCities = st.cities.filter((c) => {
      if (c.owner === this.faction) return false;
      // не идём в город, если там гарнизон сильнее
      const garrison = st.units.filter((g) => g.owner !== this.faction && g.x === c.x && g.y === c.y);
      if (garrison.length && garrison[0].hp / garrison[0].maxHp > hpRatio + 0.3) return false;
      return true;
    });

    if (openCities.length) {
      const target = openCities.sort((a, b) => manhattan(u.x, u.y, a.x, a.y) - manhattan(u.x, u.y, b.x, b.y))[0];
      if (reach.cost.has(`${target.x},${target.y}`)) {
        return { unit: u, state: 'seize', kind: 'move', target: { x: target.x, y: target.y } };
      }
      const step = this.stepToward(u, reach, target.x, target.y);
      if (step) return { unit: u, state: 'seize', kind: 'move', target: step };
    }

    // --- ADVANCE: просто к ближайшему нейтральному/вражескому городу ---
    const anyCity = st.cities
      .filter((c) => c.owner !== this.faction)
      .sort((a, b) => manhattan(u.x, u.y, a.x, a.y) - manhattan(u.x, u.y, b.x, b.y))[0];
    if (anyCity) {
      const step = this.stepToward(u, reach, anyCity.x, anyCity.y);
      if (step) return { unit: u, state: 'advance', kind: 'move', target: step };
    }

    return { unit: u, state: 'idle', kind: 'wait' };
  }

  /** Шаг к цели: соседняя клетка, минимизирующая расстояние, из достижимых */
  private stepToward(u: Unit, reach: ReachMap, tx: number, ty: number): { x: number; y: number } | null {
    const st = this.game.state;
    let best: { x: number; y: number } | null = null;
    let bestD = manhattan(u.x, u.y, tx, ty);
    let bestLeft = -1;
    for (const k of reach.cost.keys()) {
      const [cx, cy] = k.split(',').map(Number);
      const d = manhattan(cx, cy, tx, ty);
      const left = reach.cost.get(k)!;
      // предпочитаем максимальное продвижение: меньшая дистанция, при равной — больший остаток MP
      if (d < bestD || (d === bestD && left > bestLeft)) {
        // не топчемся в клетке, где стоит чужой юнит (canEnter уже учтён в reachable)
        if (cx === u.x && cy === u.y) continue;
        best = { x: cx, y: cy };
        bestD = d;
        bestLeft = left;
      }
    }
    return best;
  }

  /** Соседние клетки, где юнит может оказаться (для оценки атаки) */
  private adjacentCells(u: Unit, reach: ReachMap): { x: number; y: number }[] {
    const res: { x: number; y: number }[] = [];
    for (const k of reach.cost.keys()) {
      const [cx, cy] = k.split(',').map(Number);
      if (Math.abs(cx - u.x) + Math.abs(cy - u.y) <= u.moveRange + 1) res.push({ x: cx, y: cy });
    }
    return res;
  }

  private freeAdjacent(st: GameState, target: Unit): { x: number; y: number }[] {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const res: { x: number; y: number }[] = [];
    for (const [dx, dy] of dirs) {
      const x = target.x + dx;
      const y = target.y + dy;
      if (x < 0 || y < 0 || x >= st.mapW || y >= st.mapH) continue;
      if (!Number.isFinite(1) || st.tiles[y][x] === 'water' || st.tiles[y][x] === 'mountain') continue;
      if (st.units.some((u) => u.x === x && u.y === y)) continue;
      res.push({ x, y });
    }
    return res;
  }

  /** Исполнение одного действия */
  private execute(act: DecidedAction): void {
    const g = this.game;
    const st = g.state;
    const u = st.units.find((x) => x.id === act.unit.id);
    if (!u || u.owner !== this.faction) return;

    this.lastStates.set(u.id, act.state);

    if (act.kind === 'wait') return;

    if (act.kind === 'attack' && act.targetUnitId !== undefined) {
      const target = st.units.find((x) => x.id === act.targetUnitId);
      if (target) {
        const res = resolveAttack(st, this.rng, u, target);
        u.attacked = true;
        u.mpLeft = 0;
        cleanupDead(st);
        g.checkVictory();
        g.log('combat', `ИИ атакует! Урон: ${res.damageDealt}` + (res.defenderDied ? ' — отряд уничтожен!' : '') + (res.counter ? `, контратака: ${res.counterDamage}` : ''));
        g.cbRef()?.onEvent({ type: 'attack', result: res, at: { x: target.x, y: target.y } });
        for (const d of [res.defenderDied ? act.target : null, res.attackerDied ? u : null]) {
          if (d) g.cbRef()?.onEvent({ type: 'death', at: { x: d.x, y: d.y } });
        }
        g.cbRef()?.onStateChange(st);
      }
      return;
    }

    if (act.kind === 'move' && act.target) {
      const reach = reachable(st, u);
      if (!reach.cost.has(`${act.target.x},${act.target.y}`)) return;
      // Захват по прибытии
      const path = pathTo(st, u, reach, act.target.x, act.target.y);
      u.x = act.target.x;
      u.y = act.target.y;
      u.mpLeft = Math.max(0, reach.cost.get(`${act.target.x},${act.target.y}`) ?? 0);
      g.cbRef()?.onEvent({ type: 'move', unitId: u.id, path });

      const city = cityAt(st, u.x, u.y);
      if (city && city.owner !== this.faction) {
        const defenders = st.units.filter((d) => d.id !== u.id && d.x === u.x && d.y === u.y && d.owner !== this.faction);
        if (!defenders.length) {
          city.owner = this.faction;
          city.hireCooldown = 1;
          g.log('city', `ИИ захватывает ${city.name}!`);
          g.cbRef()?.onEvent({ type: 'capture', city, by: this.faction });
          g.checkVictory();
        }
      }
      g.cbRef()?.onStateChange(st);
    }
  }

  /** Найм в начале хода ИИ: во всех свободных городах */
  tryHire(): void {
    const g = this.game;
    const st = g.state;
    for (const c of st.cities) {
      if (c.owner !== this.faction) continue;
      if (c.hireCooldown > 0) continue;
      if (unitAt(st, c.x, c.y)) continue;
      const u = makeUnitFor(st, this.faction, c.x, c.y);
      st.units.push(u);
      c.hireCooldown = UNIT_SPECS.infantry.hireCostTurns;
      g.log('city', `ИИ нанимает отряд в ${c.name}.`);
      g.cbRef()?.onEvent({ type: 'hire', at: { x: c.x, y: c.y }, by: this.faction });
    }
    g.cbRef()?.onStateChange(st);
  }
}

/** makeUnit — обёртка, чтобы не тянуть Game в импорты board.ts */
import { makeUnit as makeUnitBase } from './board';
function makeUnitFor(st: Parameters<typeof makeUnitBase>[0], owner: OwnerId, x: number, y: number) {
  return makeUnitBase(st, owner, x, y);
}
