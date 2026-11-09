// ai-brain.js
//
// AiBrainHelper — утилиты планирования для ИИ.
//
//  find(world, army)             -> Cell|null   цель по приоритетам
//  buildRoute(world, army, goal) -> Cell[]      маршрут (без стартовой клетки)
//  moveArmyAlong(world, army, path, steps)      вспомогательное: шаг по маршруту
//
// Приоритеты find():
//   1) ближайший по стамине нейтральный город
//   2) ближайший по стамине вражеский город
//   3) ближайшая по стамине вражеская армия (по клеткам)
//
// Стоимость прохода берётся из Cell.staminaCost (дорога = 1).
// Непроходимые клетки (вода/горы, которые не тянет самый медленный юнит)
// в маршрут не попадают.
//
// Маршрут минимизирует СУММУ стамины, а не число клеток:
//   дорога/город = 1, поле = 2, лес/холмы = 3, горы = 4.
// Шаг дороже минимального move юнита в армии считается непроходимым:
// даже с полным запасом хода такой юнит не сможет его оплатить.
//
// Цели ИИ (find) тоже выбираются по минимальной стоимости стамины,
// а не по манхэттенскому расстоянию.

// class Army имеет кеш маршрута this.rote = [];
// class Player имеет метод doStep() работающий с AiBrainHelper

export class AiBrainHelper {

  /* =========================================================
     Внутренние константы
     ========================================================= */

  // Жёстко непроходимые для ИИ (можно расширять по мере баланса).
  static IMPASSABLE = new Set(['water']);

  // Максимальная стоимость одной клетки при выборе (горы дорогие — не отсекаем).
  static MAX_STEP_COST = 999;

  /* =========================================================
     Публичное API
     ========================================================= */

  static debug(world, army, opts = {})
  {
    if (!world) { console.log('find: нет world'); return null; }
    if (!army)  { console.log('find: нет army');  return null; }

    const start = world.get(army.x, army.y);
    console.log('find: army', army.id, 'pos', army.x, army.y,
                'start=', !!start, 'idOwner=', army.idOwner);

    if (!start) return null;

    const cities = world.cities ?? world.cityList?.list ?? [];
    console.log('find: cities=', cities.length,
                'neutral='     , cities.filter(c => c.ownerId == null).length,
                'enemy='       , cities.filter(c => c.ownerId != null && 
                    c.ownerId !== army.idOwner).length);
  }

  /**
   * Найти цель для армии.
   *
   * @param {WorldMap} world
   * @param {object}   army        — ожидаются поля x, y, idOwner
   * @param {object}   [opts]
   * @param {boolean}  [opts.preferCities=true]  — учитывать города (иначе только враги)
   * @returns {Cell|null}
   */
  static find(world, army, opts = {}) {

  //AiBrainHelper.debug(world, army, opts);

    if (!world || !army) return null;
    const start = world.get(army.x, army.y);
    if (!start) return null;

    const preferCities = opts.preferCities !== false;

    // Одно поле минимальных стоимостей стамины от старта:
    // по нему же выбираем и достижимую цель, и её приоритет.
    const { costs } = this._search(world, army);

    // ── 1. Нейтральный город ────────────────────────────────
    if (preferCities) {
      const neutral = this._nearestCity(
        world, army, (city) => city.ownerId == null, costs);
      if (neutral) return neutral;
    }

    // ── 2. Вражеский город ──────────────────────────────────
    if (preferCities) {
      const enemyCity = this._nearestCity(
        world, army,
        (city) => city.ownerId != null && city.ownerId !== army.idOwner,
        costs,
      );
      if (enemyCity) return enemyCity;
    }

    // ── 3. Вражеская армия (клетка, где она стоит) ──────────
    const enemyArmyCell = this._nearestEnemyArmyCell(world, army, costs);
    if (enemyArmyCell) return enemyArmyCell;

    return null;
  }

  /**
   * Построить маршрут до cellGoal.
   *
   * Возвращает массив клеток БЕЗ стартовой (первая — следующий шаг).
   * Если маршрут недостижим — пустой массив.
   * Если cellGoal совпадает со стартом — пустой массив.
   *
   * Маршрут минимизирует суммарную стоимость стамины (A*).
   *
   * @param {WorldMap} world
   * @param {object}   army
   * @param {Cell}     cellGoal
   * @param {object}   [opts]
   * @param {number}   [opts.maxCost=Infinity]   — ограничение суммарной стоимости
   * @param {boolean}  [opts.allowGoalOnWater=false] — разрешать цель на воде (для атаки)
   * @returns {Cell[]}
   */
  static buildRoute(world, army, cellGoal, opts = {}) {
    if (!world || !army || !cellGoal) return [];
    const start = world.get(army.x, army.y);
    if (!start || start === cellGoal) return [];
    return this._search(world, army, cellGoal, opts).path;
  }

  /**
   * Общий поиск по стоимости стамины.
   *
   * Если goal задан — A* до цели, иначе Dijkstra по всем достижимым клеткам
   * (нужно find() для выбора оптимальной цели).
   *
   * @param {WorldMap} world
   * @param {object}   army
   * @param {Cell|null} [goal=null]
   * @param {object}   [opts]
   * @returns {{costs: Map<Cell,{cost:number,prev:Cell|null}>, path: Cell[]}}
   */
  static _search(world, army, goal = null, opts = {}) {
    const start = world.get?.(army.x, army.y);
    if (!start) return { costs: new Map(), path: [] };

    const maxCost = opts.maxCost ?? Infinity;
    const allowGoalOnWater = opts.allowGoalOnWater === true;
    const minMove = this._armyMinMove(army);

    // Ключ — cell; value — { cost, prev }
    const costs = new Map();
    costs.set(start, { cost: 0, prev: null });

    const open = new MinHeap((a, b) => (a.f - b.f) || (a.cost - b.cost));
    const h0 = goal ? this._heuristic(start.x, start.y, goal.x, goal.y) : 0;
    open.push({ cell: start, cost: 0, f: h0 });

    while (open.size) {
      const { cell, cost } = open.pop();

      // Устаревшая запись в куче — пропускаем
      const rec = costs.get(cell);
      if (!rec || cost > rec.cost) continue;

      if (goal && cell === goal) break;      // нашли
      if (cost > maxCost) continue;

      for (const nb of world.neighbors4(cell.x, cell.y)) {
        if (!nb) continue;

        // Проходимость
        if (this._isImpassable(nb) && !(allowGoalOnWater && nb === goal)) continue;

        const step = this._stepCost(nb);

        // Самый медленный юнит армии не оплатит такой шаг даже
        // с полным запасом хода — клетка для армии непроходима.
        if (step > minMove) continue;

        const nc = cost + step;
        if (nc > maxCost) continue;

        const existing = costs.get(nb);
        if (existing && nc >= existing.cost) continue;

        costs.set(nb, { cost: nc, prev: cell });
        const f = nc + (goal
          ? this._heuristic(nb.x, nb.y, goal.x, goal.y)
          : 0);
        open.push({ cell: nb, cost: nc, f });
      }
    }

    // Восстанавливаем путь
    const path = [];
    if (goal && costs.has(goal)) {
      let cur = goal;
      while (cur && cur !== start) {
        path.push(cur);
        cur = costs.get(cur)?.prev ?? null;
      }
      path.reverse();
    }

    return { costs, path };
  }

  /**
   * Сделать N шагов по маршруту. Возвращает фактическое число шагов.
   * Полезно для пошагового движения армии.
   *
   * @param {WorldMap} world
   * @param {object}   army
   * @param {Cell[]}   path
   * @param {number}   [steps=Infinity]
   * @returns {number}
   */
  static moveArmyAlong(world, army, path, steps = Infinity) {
    if (!Array.isArray(path) || !path.length) return 0;
    let moved = 0;

    for (const next of path) {
      if (moved >= steps) break;

      const from = world.get(army.x, army.y);
      if (!from) break;

      // Уходим из старой клетки
      if (typeof from.removeArmy === 'function') {
        from.removeArmy(army);
      } else {
        const i = from.army?.indexOf(army) ?? -1;
        if (i >= 0) from.army.splice(i, 1);
      }

      // Входим в новую — Cell.addArmy обновит army.x/army.y
      next.addArmy(army);
      moved++;
    }

    return moved;
  }

  /* =========================================================
     Внутренние помощники
     ========================================================= */

  /** Минимальный move среди живых юнитов — скорость всего стека. */
  static _armyMinMove(army) {
    let min = Infinity;
    for (const u of army?.units ?? []) {
      if (!u || u.alive === false) continue;
      if (typeof u.move === 'number') min = Math.min(min, u.move);
    }
    return Number.isFinite(min) ? min : this.MAX_STEP_COST;
  }

  /** Непроходимая ли клетка для ИИ. */
  static _isImpassable(cell) {
    if (!cell || !cell.meta) return true;
    if (cell.meta.isWater) return !cell.hasRoad;   // воду по дороге можно
    return this.IMPASSABLE.has(cell.type);
  }

  /** Стоимость входа в клетку в единицах стамины. Дорога/город всегда 1. */
  static _stepCost(cell) {
    if (!cell) return this.MAX_STEP_COST;

    // Дорога и город всегда стоят 1 стамину, независимо от рельефа.
    if (cell.hasRoad || (cell.city ?? -1) >= 0) return 1;

    const s = cell.staminaCost;
    return Number.isFinite(s) ? s : this.MAX_STEP_COST;
  }

  /**
   * Ближайший город, удовлетворяющий предикату.
   *
   * @param {Map<Cell,{cost:number}>} [costs] — поле стоимостей из _search().
   *        Без него используется манхэттенская эвристика (запасной путь).
   */
  static _nearestCity(world, army, predicate, costs = null) {
    const cities = world.cities ?? world.cityList?.list ?? [];
    let best = null;
    let bestD = Infinity;

    for (const city of cities) {
      if (!city || !predicate(city)) continue;

      // Город, на клетке которого армия УЖЕ стоит, целью не является —
      // иначе buildRoute() вернёт пустой маршрут и армия «застынет».
      if (city.x === army.x && city.y === army.y) continue;

      const cell = world.get(city.x, city.y);
      if (!cell) continue;

      const d = costs
        ? (costs.get(cell)?.cost ?? Infinity)
        : this._heuristic(army.x, army.y, city.x, city.y);

      if (!Number.isFinite(d)) continue;
      if (d < bestD) {
        bestD = d;
        best = city;
      }
    }
    if (!best) return null;

    // Возвращаем КЛЕТКУ, а не объект City (унифицированный тип цели).
    return world.get(best.x, best.y);
  }

  /** Ближайшая по стоимости стамины клетка с вражеской армией. */
  static _nearestEnemyArmyCell(world, army, costs = null) {
    // Проходим по всем клеткам. Для больших карт это дорого —
    // но find() вызывается раз на армию в ход, а не на кадр.
    let best = null;
    let bestD = Infinity;

    for (const cell of world.cells) {
      if (!cell || !cell.army?.length) continue;

      for (const enemy of cell.army) {
        if (!enemy || enemy === army) continue;
        if (enemy.idOwner === army.idOwner) continue;
        if (enemy.alive === false) continue;

        const d = costs
          ? (costs.get(cell)?.cost ?? Infinity)
          : this._heuristic(army.x, army.y, cell.x, cell.y);

        if (!Number.isFinite(d)) continue;
        if (d < bestD) {
          bestD = d;
          best = cell;
        }
      }
    }
    return best;
  }

  /** Манхэттен; каждый шаг стоит >= 1, поэтому эвристика допустима для A*. */
  static _heuristic(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
}

/* =========================================================
   MinHeap — минимальная бинарная куча
   ========================================================= */
class MinHeap {
  constructor(cmp = (a, b) => a - b) {
    this._a = [];
    this._cmp = cmp;
  }
  get size() { return this._a.length; }

  push(x) {
    this._a.push(x);
    this._up(this._a.length - 1);
  }

  pop() {
    const a = this._a;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length && last !== undefined) {
      a[0] = last;
      this._down(0);
    }
    return top;
  }

  _up(i) {
    const a = this._a, c = this._cmp;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (c(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  _down(i) {
    const a = this._a, c = this._cmp, n = a.length;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < n && c(a[l], a[m]) < 0) m = l;
      if (r < n && c(a[r], a[m]) < 0) m = r;
      if (m === i) break;
      [a[i], a[m]] = [a[m], a[i]];
      i = m;
    }
  }
}