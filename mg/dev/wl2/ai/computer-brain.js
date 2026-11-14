import { AiBrainHelper } from '../core/ai-brain.js';
import { STATE } from '../core/g-state.js';
import { mulberry32, hash2 } from '../core/rng.js';
import {
  productionOptions,
  productionTurns,
  setCityProduction,
} from '../core/production.js';
import { MAX_ARMIES_PER_CITY, MAX_ARMY_SIZE } from '../core/units.js';
import {
  canCreateArmy,
  canGrowArmy,
  computeGameLimits,
} from '../core/g-limits.js';
import { ruinsCooldownLeft } from '../core/ruins.js';

const CITY_VALUE = Object.freeze({
  capital: 120,
  fortress: 70,
  provincial: 50,
  backwater: 30,
});

const DEFAULT_CITY_VALUE = 50;

export const AI_PROFILES = Object.freeze({
  0: Object.freeze({
    id: 0,
    attackOdds: 0.68,
    defenseRatio: 0.90,
    threatRadius: 8,
    neutralWeight: 1.20,
    enemyCityWeight: 0.70,
    huntWeight: 0.40,
    defenseWeight: 1.30,
    risk: 0.00,
    ruinsWeight: 0.20,
    topN: 1,
    defenseCautious: true,
    seededProduction: false,
    production: {
      capital: ['HEAVY_INF', 'HEAVY_CAV', 'MAGE', 'DRAGON'],
      fortress: ['HEAVY_INF', 'CROSSBOW', 'CATAPULT', 'HEAVY_CAV'],
      provincial: ['MEDIUM_INF', 'ARCHERS', 'LIGHT_INF', 'LIGHT_CAV'],
      backwater: ['ARCHERS', 'LIGHT_INF', 'LIGHT_CAV'],
    },
  }),
  1: Object.freeze({
    id: 1,
    attackOdds: 0.52,
    defenseRatio: 0.75,
    threatRadius: 6,
    neutralWeight: 1.00,
    enemyCityWeight: 1.00,
    huntWeight: 0.80,
    defenseWeight: 0.90,
    risk: 0.25,
    ruinsWeight: 0.35,
    topN: 2,
    defenseCautious: false,
    seededProduction: true,
    production: null,
  }),
  2: Object.freeze({
    id: 2,
    attackOdds: 0.60,
    defenseRatio: 0.85,
    threatRadius: 7,
    neutralWeight: 1.10,
    enemyCityWeight: 0.90,
    huntWeight: 0.60,
    defenseWeight: 1.00,
    risk: 0.10,
    ruinsWeight: 0.25,
    topN: 1,
    defenseCautious: false,
    seededProduction: false,
    production: {
      capital: ['HEAVY_CAV', 'HEAVY_INF', 'MAGE', 'DRAGON'],
      fortress: ['HEAVY_INF', 'CROSSBOW', 'HEAVY_CAV', 'CATAPULT'],
      provincial: ['MEDIUM_INF', 'LIGHT_CAV', 'ARCHERS', 'LIGHT_INF'],
      backwater: ['LIGHT_CAV', 'ARCHERS', 'LIGHT_INF'],
    },
  }),
  3: Object.freeze({
    id: 3,
    attackOdds: 0.48,
    defenseRatio: 0.70,
    threatRadius: 5,
    neutralWeight: 0.90,
    enemyCityWeight: 1.20,
    huntWeight: 1.00,
    defenseWeight: 0.70,
    risk: 0.15,
    ruinsWeight: 0.30,
    topN: 1,
    defenseCautious: false,
    seededProduction: false,
    production: {
      capital: ['DRAGON', 'HEAVY_CAV', 'MAGE', 'HEAVY_INF'],
      fortress: ['CATAPULT', 'HEAVY_CAV', 'HEAVY_INF', 'CROSSBOW'],
      provincial: ['MEDIUM_INF', 'LIGHT_CAV', 'LIGHT_INF', 'ARCHERS'],
      backwater: ['LIGHT_CAV', 'ARCHERS', 'LIGHT_INF'],
    },
  }),
});

export class ComputerBrain {
  static get() {
    return ComputerBrain._instance
      ?? (ComputerBrain._instance = new ComputerBrain());
  }

  static reset() {
    const inst = ComputerBrain._instance;
    if (inst) inst._resetState();
    ComputerBrain._instance = null;
  }

  constructor() {
    this._resetState();
  }

  _resetState() {
    this.world = null;
    this.player = null;
    this.turn = 1;
    this.profile = null;
    this.limits = null;
    this._armies = [];
    this._ctx = null;
  }

  begin(player, opts = {}) {
    const world = opts.world ?? STATE.world;
    const empty = {
      playerIndex: player?.index ?? null,
      armies: 0,
      routes: 0,
      defended: 0,
      production: [],
    };

    if (!world || !player) return empty;

    this._resetState();
    this.world = world;
    this.player = player;
    this.turn = opts.turn ?? STATE.turn ?? 1;
    this.profile = AI_PROFILES[player.aiLevel] ?? AI_PROFILES[2];
    this.limits = opts.limits
      ?? computeGameLimits(world, opts.players ?? [player]);
    player.limits = this.limits;

    this._armies = (player.army ?? []).filter((army) => this._isLiveArmy(army));

    for (const army of this._armies) {
      army.resetTurn?.();
      army.sortByStrength?.(true);
    }

    const ctx = this._collectSituation();
    this._ctx = ctx;

    for (const army of this._armies) {
      ctx.costs.set(army, AiBrainHelper.search(world, army));
    }

    const threats = this._assessThreats(ctx);
    const production = this._planProduction(ctx, threats);

    const reserved = new Set();
    const defense = this._planDefense(ctx, threats, ctx.costs, reserved);
    this._planAttack(ctx, threats, ctx.costs, reserved, defense.assigned);
    this._planFallback(ctx, threats, ctx.costs, reserved, defense.assigned);

    const routes = this._armies.filter((army) => army.route?.length > 0).length;

    return {
      playerIndex: player.index,
      armies: this._armies.length,
      routes,
      defended: defense.defended,
      production,
      limits: {
        maxArmies: this.limits.maxArmies,
        maxUnits: this.limits.maxUnits,
        maxSmallArmies: { ...this.limits.maxSmallArmies },
      },
    };
  }

  _collectSituation() {
    const world = this.world;
    const player = this.player;
    const cities = world.cities ?? world.cityList?.list ?? [];

    const ownCities = [];
    const neutralCities = [];
    const enemyCities = [];
    const ruins = [];

    for (const city of cities) {
      if (!city) continue;
      if (city.type === 'ruins') {
        ruins.push(city);
        continue;
      }

      const owner = city.ownerId ?? null;
      if (owner === player.index) ownCities.push(city);
      else if (owner == null) neutralCities.push(city);
      else enemyCities.push(city);
    }

    ownCities.sort((a, b) => this._cmpCity(a, b));
    neutralCities.sort((a, b) => this._cmpCity(a, b));
    enemyCities.sort((a, b) => this._cmpCity(a, b));
    ruins.sort((a, b) => this._cmpCity(a, b));

    const enemyByCell = new Map();
    const cells = world.cells ?? [];

    for (const cell of cells) {
      if (!cell || !Array.isArray(cell.army) || cell.army.length === 0) continue;

      let power = 0;
      const armies = [];

      for (const army of cell.army) {
        if (!this._isLiveArmy(army)) continue;
        if (army.idOwner === player.index) continue;
        power += Number(army.totalStrength) || 0;
        armies.push(army);
      }

      if (armies.length > 0) {
        enemyByCell.set(cell, { cell, armies, power });
      }
    }

    return {
      ownCities,
      neutralCities,
      enemyCities,
      ruins,
      enemyByCell,
      costs: new Map(),
    };
  }

  _assessThreats(ctx) {
    const result = new Map();
    const radius = this.profile.threatRadius;
    const player = this.player;

    for (const city of ctx.ownCities) {
      const cell = this.world.get(city.x, city.y);
      if (!cell) {
        result.set(city, {
          city,
          cell: null,
          garrisonPower: 0,
          threatPower: 0,
          threatened: false,
          value: this._cityValue(city),
        });
        continue;
      }

      let garrisonPower = 0;
      for (const army of cell.army ?? []) {
        if (!this._isLiveArmy(army)) continue;
        if (army.idOwner !== player.index) continue;
        garrisonPower += Number(army.totalStrength) || 0;
      }

      let threatPower = 0;
      for (const rec of ctx.enemyByCell.values()) {
        const distance = Math.abs(rec.cell.x - city.x)
          + Math.abs(rec.cell.y - city.y);
        if (distance > radius) continue;
        if (rec.power > threatPower) threatPower = rec.power;
      }

      const threatened = threatPower > 0
        && garrisonPower < threatPower * this.profile.defenseRatio;

      result.set(city, {
        city,
        cell,
        garrisonPower,
        threatPower,
        threatened,
        value: this._cityValue(city),
      });
    }

    return result;
  }

  _planProduction(ctx, threats) {
    const production = [];

    for (const city of ctx.ownCities) {
      const options = productionOptions(city);
      if (options.length === 0) continue;
      if (!this._canChangeProduction(city, options)) continue;
      if (!this._canProduceInCity(city)) continue;

      const desired = this._desiredProduction(city, options, threats.get(city));
      if (!desired || desired === city.production) continue;
      if (!setCityProduction(city, desired)) continue;

      production.push({
        city: city.name,
        x: city.x,
        y: city.y,
        type: desired,
      });
    }

    return production;
  }

  _canProduceInCity(city) {
    if (!this.limits) return true;

    const cell = this.world.get(city.x, city.y);
    if (!cell) return false;

    const armies = this._ownArmiesAt(cell);
    const canGrow = armies.some(army =>
      (army.units?.length ?? 0) < MAX_ARMY_SIZE
      && canGrowArmy(this.player, this.limits, army)
    );

    if (canGrow) return true;
    if (armies.length >= MAX_ARMIES_PER_CITY) return false;

    return canCreateArmy(this.player, this.limits);
  }

  _canChangeProduction(city, options) {
    if (city.production == null) return true;
    if ((city.productionOwner ?? null) !== this.player.index) return true;
    if (!options.includes(city.production)) return true;
    return city.productionTurnsLeft === city.productionTurnsTotal;
  }

  _desiredProduction(city, options, threatInfo) {
    const ownerMismatch = (city.productionOwner ?? null) !== this.player.index;
    const slotIdle = !city.production
      || ownerMismatch
      || !options.includes(city.production)
      || city.productionTurnsLeft === city.productionTurnsTotal;

    if (threatInfo?.threatened && slotIdle) {
      return this._fastestOption(options);
    }

    if (this.profile.seededProduction) {
      return this._seededOption(city, options);
    }

    const order = this.profile.production?.[city.type] ?? [];
    for (const key of order) {
      if (options.includes(key)) return key;
    }

    return options[0];
  }

  _fastestOption(options) {
    let best = options[0];
    let bestTurns = productionTurns(best);

    for (let i = 1; i < options.length; i++) {
      const turns = productionTurns(options[i]);
      if (turns < bestTurns) {
        best = options[i];
        bestTurns = turns;
      }
    }

    return best;
  }

  _seededOption(city, options) {
    const prepared = options.map((key, index) => ({
      key,
      index,
      turns: productionTurns(key),
    }));

    prepared.sort((a, b) => (a.turns - b.turns) || (a.index - b.index));
    const pool = prepared.slice(0, Math.min(2, prepared.length));
    const rng = mulberry32(this._seedForCity(city, 0x50524f44));
    const pick = pool[Math.floor(rng() * pool.length)] ?? prepared[0];

    return pick?.key ?? options[0];
  }

  _planDefense(ctx, threats, costsByArmy, reserved) {
    const assigned = new Set();
    let defended = 0;

    const threatenedCities = ctx.ownCities
      .filter((city) => threats.get(city)?.threatened)
      .sort((a, b) => {
        const diff = (threats.get(b)?.value ?? 0) - (threats.get(a)?.value ?? 0);
        return diff || this._cmpCity(a, b);
      });

    for (const city of threatenedCities) {
      const info = threats.get(city);
      const goal = info?.cell;
      if (!goal) continue;

      const threshold = info.threatPower * this.profile.defenseRatio;
      const candidates = [];

      for (const army of this._armies) {
        if (assigned.has(army)) continue;
        if (army.x === city.x && army.y === city.y) continue;
        if (!this._canReleaseFromCity(army, threats, city)) continue;

        const costRec = costsByArmy.get(army);
        const cost = costRec?.costs.get(goal)?.cost;
        if (!Number.isFinite(cost)) continue;

        const power = Number(army.totalStrength) || 0;
        candidates.push({
          army,
          power,
          turns: this._turns(cost, army),
          sufficient: power >= threshold,
        });
      }

      if (candidates.length === 0) continue;
      if (this.profile.defenseCautious
        && !candidates.some((candidate) => candidate.sufficient)) {
        continue;
      }

      candidates.sort((a, b) => {
        if (a.sufficient !== b.sufficient) return a.sufficient ? -1 : 1;
        if (a.sufficient) {
          return (a.turns - b.turns)
            || (b.power - a.power)
            || ((a.army.id ?? 0) - (b.army.id ?? 0));
        }
        return (b.power - a.power)
          || (a.turns - b.turns)
          || ((a.army.id ?? 0) - (b.army.id ?? 0));
      });

      let chosen = null;

      for (const candidate of candidates) {
        const path = this._routeToGoal(
          ctx,
          candidate.army,
          goal,
          reserved,
          costsByArmy.get(candidate.army),
        );

        if (path.length === 0) continue;
        chosen = { ...candidate, path };
        break;
      }

      if (!chosen) continue;

      chosen.army.route = chosen.path;
      chosen.army.cellGoal = goal;
      assigned.add(chosen.army);
      reserved.add(this._key(goal));
      defended++;
    }

    return { assigned, defended };
  }

  _planAttack(ctx, threats, costsByArmy, reserved, defenseAssigned) {
    const available = this._armies
      .filter((army) => !defenseAssigned.has(army))
      .sort((a, b) => {
        const diff = (b.totalStrength ?? 0) - (a.totalStrength ?? 0);
        return diff || ((a.id ?? 0) - (b.id ?? 0));
      });

    for (const army of available) {
      if (!this._canReleaseFromCity(army, threats, null)) {
        army.route = [];
        army.cellGoal = null;
        continue;
      }

      if (this._validSavedRoute(army, threats, reserved)) {
        reserved.add(this._key(army.cellGoal));
        continue;
      }

      army.route = [];
      army.cellGoal = null;

      const costRec = costsByArmy.get(army);
      if (!costRec?.start) continue;

      const scored = this._scoreTargets(army, ctx, threats, costRec, reserved);
      if (scored.length === 0) continue;

      const ordered = this._orderCandidates(scored, army);

      for (const candidate of ordered) {
        const path = this._routeToGoal(
          ctx,
          army,
          candidate.cell,
          reserved,
          costRec,
        );

        if (path.length === 0) continue;

        army.route = path;
        army.cellGoal = candidate.cell;
        reserved.add(this._key(candidate.cell));
        break;
      }
    }
  }

  _scoreTargets(army, ctx, threats, costRec, reserved) {
    const targets = [];
    const used = new Set();
    const player = this.player;

    const add = (type, cell, city = null) => {
      if (!cell) return;
      if (cell.x === army.x && cell.y === army.y) return;

      const key = this._key(cell);
      if (reserved.has(key) || used.has(key)) return;

      used.add(key);
      targets.push({ type, cell, city });
    };

    for (const city of ctx.neutralCities) {
      add('neutral-city', this.world.get(city.x, city.y), city);
    }

    for (const city of ctx.enemyCities) {
      add('enemy-city', this.world.get(city.x, city.y), city);
    }

    for (const rec of ctx.enemyByCell.values()) {
      const city = this._cityAtCell(rec.cell);
      if (city && (city.ownerId ?? null) !== player.index) continue;
      add('enemy-army', rec.cell, city);
    }

    for (const city of ctx.ruins) {
      if (army.isFull) continue;
      if (ruinsCooldownLeft(city, this.turn) !== 0) continue;

      const cell = this.world.get(city.x, city.y);
      if (!cell) continue;
      if (this._enemyPowerAt(cell) > 0) continue;

      add('ruins', cell, city);
    }

    const scored = [];

    for (const target of targets) {
      const cost = costRec.costs.get(target.cell)?.cost;
      if (!Number.isFinite(cost)) continue;

      const turns = this._turns(cost, army);
      const enemyPower = this._enemyPowerAt(target.cell);
      const myPower = Number(army.totalStrength) || 0;
      const odds = enemyPower > 0
        ? myPower / (myPower + enemyPower)
        : 1;

      if (target.type !== 'ruins'
        && enemyPower > 0
        && odds < this.profile.attackOdds) {
        continue;
      }

      let score = 0;

      if (target.type === 'neutral-city') {
        score = this._cityValue(target.city)
          * this.profile.neutralWeight
          / (1 + turns);
      } else if (target.type === 'enemy-city') {
        const oddsFactor = enemyPower > 0 ? 0.5 + odds : 1.5;
        score = this._cityValue(target.city)
          * this.profile.enemyCityWeight
          * oddsFactor
          / (1 + turns);
      } else if (target.type === 'enemy-army') {
        score = (15 + enemyPower * 1.5)
          * this.profile.huntWeight
          / (1 + turns);
      } else if (target.type === 'ruins') {
        score = 25 * this.profile.ruinsWeight / (1 + turns);
      }

      if (this.profile.risk > 0) {
        const seed = this._seedForArmy(army, 0x4a495454);
        const jitter = hash2(target.cell.x, target.cell.y, seed);
        score *= 1 + this.profile.risk * jitter;
      }

      scored.push({
        ...target,
        score,
        turns,
        odds,
        enemyPower,
      });
    }

    return scored;
  }

  _orderCandidates(scored, army) {
    const sorted = scored.slice().sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.turns !== b.turns) return a.turns - b.turns;
      if (a.cell.y !== b.cell.y) return a.cell.y - b.cell.y;
      if (a.cell.x !== b.cell.x) return a.cell.x - b.cell.x;
      return a.type < b.type ? -1 : a.type > b.type ? 1 : 0;
    });

    const topN = this.profile.topN ?? 1;
    if (topN <= 1 || sorted.length <= 1) return sorted;

    const count = Math.min(topN, sorted.length);
    const rng = mulberry32(this._seedForArmy(army, 0x544f504e));
    const index = Math.floor(rng() * count);

    return [
      sorted[index],
      ...sorted.slice(0, index),
      ...sorted.slice(index + 1),
    ];
  }

  _planFallback(ctx, threats, costsByArmy, reserved, defenseAssigned) {
    const candidates = this._armies
      .filter((army) => !defenseAssigned.has(army) && !(army.route?.length > 0))
      .sort((a, b) => ((a.id ?? 0) - (b.id ?? 0)));

    let moved = 0;
    const freedCities = new Set();

    for (const army of candidates) {
      const cell = this.world.get(army.x, army.y);
      if (!cell) continue;

      const city = this._cityAtCell(cell);
      if (!city) continue;
      if ((city.ownerId ?? null) !== this.player.index) continue;

      const sourceKey = this._key(cell);
      if (freedCities.has(sourceKey)) continue;

      const info = threats.get(city);
      if (!info || info.threatened) continue;
      if (this._enemyPowerAt(cell) > 0) continue;

      const ownArmies = this._ownArmiesAt(cell);
      if (ownArmies.length < MAX_ARMIES_PER_CITY) continue;
      if (!ownArmies.every((item) => item.isFull)) continue;

      const costRec = costsByArmy.get(army);
      if (!costRec?.start) continue;

      const targets = [];

      for (const target of [...ctx.ownCities, ...ctx.neutralCities]) {
        if (target === city) continue;

        const goal = this.world.get(target.x, target.y);
        if (!goal) continue;
        if (reserved.has(this._key(goal))) continue;
        if (this._enemyPowerAt(goal) > 0) continue;

        const cost = costRec.costs.get(goal)?.cost;
        if (!Number.isFinite(cost)) continue;

        targets.push({
          city: target,
          goal,
          cost,
          turns: this._turns(cost, army),
        });
      }

      targets.sort((a, b) => (a.cost - b.cost)
        || (a.turns - b.turns)
        || this._cmpCity(a.city, b.city));

      let chosen = null;

      for (const target of targets) {
        const path = this._routeToGoal(
          ctx, army, target.goal, reserved, costRec);
        if (path.length === 0) continue;
        chosen = { ...target, path };
        break;
      }

      if (!chosen) continue;

      army.route = chosen.path;
      army.cellGoal = chosen.goal;
      reserved.add(this._key(chosen.goal));
      freedCities.add(sourceKey);
      moved++;
    }

    return moved;
  }

  _validSavedRoute(army, threats, reserved) {
    const route = army.route;
    const goal = army.cellGoal;

    if (!Array.isArray(route) || route.length === 0 || !goal) return false;
    if (route[route.length - 1] !== goal) return false;
    if (!this._goalStillValid(goal, army, threats)) return false;

    const start = this.world.get(army.x, army.y);
    if (!start) return false;

    let previous = start;

    for (let i = 0; i < route.length; i++) {
      const cell = route[i];
      if (!cell) return false;

      const actual = this.world.get(cell.x, cell.y);
      if (!actual || actual !== cell) return false;

      const distance = Math.abs(cell.x - previous.x)
        + Math.abs(cell.y - previous.y);
      if (distance !== 1) return false;

      if (this._isReserved(cell, reserved)) return false;

      if (i === 0 && this._stepCost(cell) > army.movePoints) return false;

      const isGoal = i === route.length - 1;
      if (!isGoal) {
        if (this._armyBlockAt(cell, army)) return false;
        if (this._enemyPowerAt(cell) > 0) return false;
      }

      previous = cell;
    }

    return route[route.length - 1] === goal;
  }

  _goalStillValid(goal, army, threats) {
    const city = this._cityAtCell(goal);

    if (city) {
      if (city.type === 'ruins') {
        return !army.isFull
          && ruinsCooldownLeft(city, this.turn) === 0
          && this._enemyPowerAt(goal) === 0;
      }

      const owner = city.ownerId ?? null;
      if (owner === this.player.index) {
        return threats.get(city)?.threatened === true
          || this._enemyPowerAt(goal) > 0;
      }
      if (owner == null) return true;
      return owner !== this.player.index;
    }

    return this._enemyPowerAt(goal) > 0;
  }

  _routeToGoal(ctx, army, goal, reserved, costRec) {
    const blocked = this._blockCells(ctx, army, goal, reserved);

    if (costRec?.start && costRec?.costs) {
      const path = AiBrainHelper.pathFrom(costRec.costs, costRec.start, goal);
      const clean = path.length > 0
        && !path.some((cell) => cell !== goal && blocked.has(cell));
      if (clean) return path;
    }

    return AiBrainHelper.buildRoute(this.world, army, goal, {
      blockCells: blocked,
    });
  }

  _blockCells(ctx, army, goal, reserved) {
    const blocked = new Set();

    for (const own of this._armies) {
      if (own === army) continue;
      if (!this._isLiveArmy(own)) continue;

      const cell = this.world.get(own.x, own.y);
      if (!cell) continue;
      if (this._isCityCell(cell)) continue;

      blocked.add(cell);
    }

    for (const rec of ctx.enemyByCell.values()) {
      if (rec.cell === goal) continue;
      blocked.add(rec.cell);
    }

    for (const key of reserved) {
      const cell = this._cellFromKey(key);
      if (cell && cell !== goal) blocked.add(cell);
    }

    return blocked;
  }

  _canReleaseFromCity(army, threats, targetCity) {
    const cell = this.world.get(army.x, army.y);
    const city = this._cityAtCell(cell);

    if (!city) return true;
    if ((city.ownerId ?? null) !== this.player.index) return true;
    if (city === targetCity) return false;

    const info = threats.get(city);
    if (!info?.threatened && this._enemyPowerAt(cell) === 0) return true;

    return this._ownArmiesAt(cell).length >= 2;
  }

  _ownArmiesAt(cell) {
    if (!cell?.army?.length) return [];

    return cell.army.filter(
      (army) => army
        && army.idOwner === this.player.index
        && this._isLiveArmy(army),
    );
  }

  _enemyPowerAt(cell) {
    if (!cell?.army?.length) return 0;

    const known = this._ctx?.enemyByCell?.get(cell);
    if (known) return known.power;

    let power = 0;
    for (const army of cell.army) {
      if (!this._isLiveArmy(army)) continue;
      if (army.idOwner === this.player.index) continue;
      power += Number(army.totalStrength) || 0;
    }

    return power;
  }

  _armyBlockAt(cell, army) {
    if (!cell?.army?.length) return false;

    const cityCell = this._isCityCell(cell);

    for (const other of cell.army) {
      if (!this._isLiveArmy(other)) continue;
      if (other === army) continue;
      if (other.idOwner !== this.player.index) continue;
      if (!cityCell) return true;
    }

    return false;
  }

  _isLiveArmy(army) {
    return !!army
      && army.alive !== false
      && Array.isArray(army.units)
      && army.units.some((unit) => unit && unit.alive !== false);
  }

  _cityAtCell(cell) {
    if (!cell) return null;

    const list = this.world?.cities ?? this.world?.cityList?.list ?? [];
    if (Number.isInteger(cell.city) && cell.city >= 0) {
      const city = list[cell.city];
      if (city) return city;
    }

    return this.world?.getCityAt?.(cell.x, cell.y) ?? null;
  }

  _isCityCell(cell) {
    if (!cell) return false;
    if ((cell.city ?? -1) >= 0) return true;
    return !!this.world?.getCityAt?.(cell.x, cell.y);
  }

  _cityValue(city) {
    if (!city) return DEFAULT_CITY_VALUE;
    return CITY_VALUE[city.type] ?? DEFAULT_CITY_VALUE;
  }

  _turns(cost, army) {
    return Math.max(1, Math.ceil(cost / Math.max(1, army.movePoints)));
  }

  _stepCost(cell) {
    if (!cell) return Infinity;
    if (cell.hasRoad || (cell.city ?? -1) >= 0) return 1;
    const cost = cell.staminaCost;
    return Number.isFinite(cost) ? cost : Infinity;
  }

  _cmpCity(a, b) {
    if (!a || !b) return 0;
    return (a.x - b.x)
      || (a.y - b.y)
      || String(a.name ?? '').localeCompare(String(b.name ?? ''));
  }

  _key(cell) {
    return `${cell.x},${cell.y}`;
  }

  _cellFromKey(key) {
    const [x, y] = String(key).split(',');
    return this.world?.get?.(Number(x), Number(y)) ?? null;
  }

  _isReserved(cell, reserved) {
    return reserved.has(this._key(cell));
  }

  _seedForBase(salt = 0) {
    const worldSeed = (this.world?.seed ?? 0) | 0;
    const turn = (this.turn ?? 1) | 0;
    const playerIndex = (this.player?.index ?? 0) | 0;

    return (
      worldSeed
      ^ Math.imul(turn + 1, 0x9e3779b1)
      ^ Math.imul(playerIndex + 1, 0x85ebca6b)
      ^ Math.imul(salt | 0, 0xc2b2ae35)
    ) >>> 0;
  }

  _seedForArmy(army, salt = 0) {
    return (
      this._seedForBase(salt)
      ^ Math.imul(((army?.id ?? 0) | 0) + 1, 0x27d4eb2d)
    ) >>> 0;
  }

  _seedForCity(city, salt = 0) {
    return (
      this._seedForBase(salt)
      ^ Math.imul(((city?.x ?? 0) | 0) + 1, 0x27d4eb2d)
      ^ Math.imul(((city?.y ?? 0) | 0) + 1, 0x165667b1)
    ) >>> 0;
  }
}
