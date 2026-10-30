// ./core/units.js
//
// Описание юнитов в игре «Грань Империи» (ремейк Warlords II)
//  -   название
//  -   id (число) используется для выбора меша
//  -   idOwner - владелец юнита
//  -   кол-во ресурсов(ходов) на постройку юнита
//  юниты появляются в городах и получают idOwner владельца города.
//  ...
// Army содержит до 20 юнитов
//  -   имеет свою позицию в Мире(2d поле клеток)
//  -   может передвигаться по Миру
//  -   порядок в массиве ...

/* =========================================================
   ТИПЫ ЮНИТОВ
   ========================================================= */
/**
 * Базовые типы юнитов. В Warlords II сила юнита — главный параметр
 * в бою; слабые юниты идут первыми как «пушечное мясо», сильные —
 * в конце стека [citation:1][citation:14].
 *
 * id      — для выбора меша/иконки в рендере
 * name    — читаемое название
 * strength— базовая боевая сила (1..9 в оригинале, здесь 1..10)
 * move    — очков движения за ход
 * cost    — стоимость найма в золоте
 * build   — кол-во ходов производства в городе
 * isHero  — герой (особый юнит, качается, ищет руины)
 */
export const UNIT_TYPES = {
  // Пехота
  LIGHT_INF:   { id: 1,  name: 'Лёгкая пехота', strength: 1, move: 4, cost: 10, build: 1, isHero: false },
  MEDIUM_INF:  { id: 2,  name: 'Средняя пехота', strength: 3, move: 4, cost: 25, build: 2, isHero: false },
  HEAVY_INF:   { id: 3,  name: 'Тяжёлая пехота', strength: 5, move: 3, cost: 50, build: 3, isHero: false },
  // Кавалерия
  LIGHT_CAV:   { id: 4,  name: 'Лёгкая кавалерия', strength: 3, move: 6, cost: 30, build: 2, isHero: false },
  HEAVY_CAV:   { id: 5,  name: 'Тяжёлая кавалерия', strength: 6, move: 5, cost: 70, build: 4, isHero: false },
  // Стрелки
  ARCHERS:     { id: 6,  name: 'Лучники', strength: 2, move: 4, cost: 20, build: 2, isHero: false },
  CROSSBOW:    { id: 7,  name: 'Арбалетчики', strength: 4, move: 4, cost: 40, build: 3, isHero: false },
  // Осадные
  CATAPULT:    { id: 8,  name: 'Катапульта', strength: 4, move: 2, cost: 60, build: 4, isHero: false },
  // Магия
  MAGE:        { id: 9,  name: 'Маг', strength: 3, move: 4, cost: 80, build: 5, isHero: false },
  // Особые
  DRAGON:      { id: 10, name: 'Дракон', strength: 9, move: 7, cost: 200, build: 8, isHero: false },
  // Герои (создаются отдельно, не производятся как обычные юниты)
  HERO:        { id: 11, name: 'Герой', strength: 3, move: 5, cost: 100, build: 0, isHero: true },
};

/* =========================================================
   ЮНИТ
   ========================================================= */
export class Unit {
  /**
   * @param {Object} opts
   * @param {number} opts.id          — уникальный id экземпляра
   * @param {number} opts.idOwner     — индекс игрока-владельца (из Players)
   * @param {string} [opts.typeKey]   — ключ из UNIT_TYPES (по умолчанию LIGHT_INF)
   * @param {Object} [opts.overrides] — переопределение полей типа
   */
  constructor({ id, idOwner, typeKey = 'LIGHT_INF', overrides = {} }) {
    this.id = id;
    this.idOwner = idOwner;

    const base = UNIT_TYPES[typeKey] ?? UNIT_TYPES.LIGHT_INF;
    this.typeKey  = typeKey;
    this.name     = overrides.name     ?? base.name;
    this.strength = overrides.strength ?? base.strength;
    this.move     = overrides.move     ?? base.move;
    this.cost     = overrides.cost     ?? base.cost;
    this.build    = overrides.build    ?? base.build;
    this.isHero   = overrides.isHero   ?? base.isHero;

    // боевые модификаторы
    this.hp       = overrides.hp       ?? 1;      // 1 удар = смерть в Warlords II (упрощённо)
    this.maxHp    = this.hp;
    this.bonus    = overrides.bonus    ?? 0;      // стек-бонус (герой, дракон)
    this.blessed  = false;                        // +1 от храма
    this.encamped = false;                        // +1 от «защиты»

    // движение в этом ходу
    this.moveLeft = this.move;
  }

  get alive() { return this.hp > 0; }

  /** Итоговая сила с учётом бонусов и состояния */
  get effectiveStrength() {
    let s = this.strength;
    if (this.blessed)  s += 1;
    if (this.encamped) s += 1;
    s += this.bonus;
    return Math.max(1, s);
  }

  /** Сброс на начало хода владельца */
  resetTurn() {
    this.moveLeft = this.move;
    // encamped снимается, если юнит двигался (в оригинале — по логике стека)
  }

  /** Потратить очки движения. Возвращает false, если не хватает. */
  spendMove(cost) {
    if (cost > this.moveLeft) return false;
    this.moveLeft -= cost;
    this.encamped = false;   // движение снимает «стан»
    return true;
  }

  snapshot() {
    return {
      id: this.id, idOwner: this.idOwner, typeKey: this.typeKey,
      name: this.name, strength: this.effectiveStrength, hp: this.hp,
      move: this.move, moveLeft: this.moveLeft, isHero: this.isHero,
      bonus: this.bonus, blessed: this.blessed, encamped: this.encamped,
    };
  }
}

/* =========================================================
   АРМИЯ (СТЕК)
   ========================================================= */
export const MAX_ARMY_SIZE = 20;

export class Army {
  /**
   * @param {Object} opts
   * @param {number} opts.id          — уникальный id армии
   * @param {number} opts.idOwner     — владелец (должен совпадать с юнитами)
   * @param {number} opts.x           — клетка мира X
   * @param {number} opts.y           — клетка мира Y
   * @param {Array<Unit>} [opts.units]— стартовые юниты
   */
  constructor({ id, idOwner, x, y, units = [] }) {
    this.id = id;
    this.idOwner = idOwner;
    this.x = x;
    this.y = y;

    // максимум 20 юнитов в стеке
    this.units = units.slice(0, MAX_ARMY_SIZE);
    // выставляем владельца всем юнитам
    for (const u of this.units) u.idOwner = idOwner;
  }

  /* ---------- состояние ---------- */
  get alive()   { return this.units.some(u => u.alive); }
  get count()   { return this.units.filter(u => u.alive).length; }
  get isFull()  { return this.units.length >= MAX_ARMY_SIZE; }

  /** Сила стека для боя: сумма с учётом порядка? В Warlords II бой 1-на-1
   *  по порядку, но для ИИ удобно знать «суммарную мощь». */
  get totalStrength() {
    return this.units.filter(u => u.alive).reduce((s, u) => s + u.effectiveStrength, 0);
  }

  /** Лучший юнит стека (для подсветки/иконки) */
  get strongest() {
    let best = null;
    for (const u of this.units) {
      if (!u.alive) continue;
      if (!best || u.effectiveStrength > best.effectiveStrength) best = u;
    }
    return best;
  }

  /* ---------- состав ---------- */
  addUnit(unit) {
    if (this.isFull) return false;
    unit.idOwner = this.idOwner;
    this.units.push(unit);
    return true;
  }

  removeUnit(unitId) {
    const i = this.units.findIndex(u => u.id === unitId);
    if (i < 0) return null;
    return this.units.splice(i, 1)[0];
  }

  removeDead() {
    this.units = this.units.filter(u => u.alive);
  }

  /** Сортировка: слабые впереди, сильные сзади (дефолт Warlords II) */
  sortByStrength(ascending = true) {
    this.units.sort((a, b) =>
      ascending
        ? a.effectiveStrength - b.effectiveStrength
        : b.effectiveStrength - a.effectiveStrength
    );
  }

  /* ---------- движение ---------- */
  /**
   * Очки движения стека = минимум по живым юнитам (как в Warlords II:
   * группа движется со скоростью самого медленного [citation:4]).
   */
  get movePoints() {
    let min = Infinity;
    for (const u of this.units) {
      if (!u.alive) continue;
      min = Math.min(min, u.moveLeft);
    }
    return Number.isFinite(min) ? min : 0;
  }

  /** Сброс хода всем юнитам */
  resetTurn() {
    for (const u of this.units) u.resetTurn();
  }

  /** Может ли стек войти в клетку со стоимостью cost */
  canMoveTo(cost) {
    return this.movePoints >= cost;
  }

  /** Потратить cost у всех живых юнитов (стек двигается целиком) */
  spendMoveAll(cost) {
    if (!this.canMoveTo(cost)) return false;
    for (const u of this.units) {
      if (u.alive) u.spendMove(cost);
    }
    return true;
  }

  moveTo(x, y, cost) {
    if (!this.spendMoveAll(cost)) return false;
    this.x = x;
    this.y = y;
    return true;
  }

  snapshot() {
    return {
      id: this.id, idOwner: this.idOwner, x: this.x, y: this.y,
      units: this.units.map(u => u.snapshot()),
      totalStrength: this.totalStrength,
      movePoints: this.movePoints,
    };
  }
}