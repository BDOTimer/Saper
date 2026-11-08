// core/cell.js

import { STATE, TICK } from './g-state.js';

export const CellType = Object.freeze({
  PLAIN: 'plain' ,
  FOREST:'forest',
  HILLS: 'hills' ,
  MOUNT: 'mount' ,
  WATER: 'water' ,
  // overlay-типы
  ROAD:  'road'  ,
  RIVER: 'river' ,
});

export const TYPE_META = {
  plain : { name: 'Поле' , color: 0x6d8f4e, stamina: 2, isWater: false, isMountain: false },
  forest: { name: 'Лес'  , color: 0x2f5a35, stamina: 3, isWater: false, isMountain: false },
  hills : { name: 'Холмы', color: 0x8a7b52, stamina: 3, isWater: false, isMountain: false },
  mount : { name: 'Горы' , color: 0x7d757e, stamina: 4, isWater: false, isMountain: true  },
  water : { name: 'Вода' , color: 0x2a5a8c, stamina: 6, isWater: true , isMountain: false },
};

export const OVERLAY = Object.freeze({
  NONE:  0,
  ROAD:  1 << 0,   // 1
  RIVER: 1 << 1,   // 2
});

export class Cell {
  constructor(x, y, type = CellType.PLAIN) {
    this.x = x; this.y = y;
    this.type      = type;
    this.overlay   = OVERLAY.NONE; // ← число, не строка
    this.city      = -1;
    this.meshId    = -1;
    this.texId     =  0;
    this.elevation =  0;
    this.army      = []; // Каждая клетка имеет массив для армий.
  }
  get meta() { return TYPE_META[this.type]; }

  get hasRoad()  { return (this.overlay & OVERLAY.ROAD)  !== 0; }
  get hasRiver() { return (this.overlay & OVERLAY.RIVER) !== 0; }

  addOverlay(flag)   { this.overlay |= flag; }
  removeOverlay(flag){ this.overlay &= ~flag; }

  // Город на клетке проходится как дорога (+1 стамины),
  // независимо от рельефа (холмы, лес и т.п.).
  get staminaCost() { return (this.city >= 0 || this.hasRoad) ? 1 : this.meta.stamina; }

  // для UI / отладки
  get overlayName() {
    if (!this.overlay) return '—';
    const parts = [];
    if (this.hasRoad)  parts.push('road');
    if (this.hasRiver) parts.push('river');
    return parts.join('+');
  }

  /**
   * Положить армию в клетку.
   *
   * @param {object} army — объект армии (ожидаются поля x, y; при наличии — cell).
   * @returns {boolean} true, если армия добавлена в клетку.
   */
  addArmy(army) {
    if (!army || typeof army !== 'object') return false;
    if (this.army.includes(army)) return false; // не дублируем одну и ту же армию

    this.army.push(army);

    // обратная ссылка: армия знает свою клетку и координаты
    army.x = this.x;
    army.y = this.y;

    // console.log("army.x: ", army.x);
    // console.log("army.y: ", army.y);

    return true;
  }

  removeArmy(army) {
    const i = this.army.indexOf(army);
    if (i >= 0) { this.army.splice(i, 1); return true; }
    return false;
  }

  /**
   * Событие «армия вошла в клетку».
   *
   * Вызывать после того, как армия уже добавлена в клетку
   * (Cell.addArmy / WorldMap.moveArmy), т.е. army.x/army.y === this.x/this.y.
   *
   *  - Нейтральный город          → захват (ownerId = army.idOwner).
   *  - Вражеский город:
   *      · если в клетке есть вражеские юниты (не наши) → зарезервировать бой;
   *      · иначе (город без гарнизона)                  → захват.
   *  - Нейтрального/своего города нет → ничего.
   *
   * @param {object} army — объект армии (нужны поля idOwner, units?[])
   * @returns {boolean} true, если город был захвачен
   */
  onArmyArrive(army) {
    if (!army || army.idOwner == null) return false;

    const world = STATE.world;

    // army.debug();
    // this.debug();

    const city = world.getCityAt?.(this.x, this.y)
              ?? world.cityList?.getAt?.(this.x, this.y)
              ?? null;
    if (!city) return false;

    const owner = city.ownerId ?? null;

    // ── 1. Нейтральный город → просто захват ─────────────────────
    if (owner == null) {
      city.ownerId = army.idOwner;
      return true;
    }

    // ── 2. Свой город → ничего ───────────────────────────────────
    if (owner === army.idOwner) return false;

    // ── 3. Вражеский город ───────────────────────────────────────
    // Ищем в клетке вражеские армии с живыми юнитами (не наша армия).
    const enemies = (this.army ?? []).filter(a =>
      a &&
      a !== army &&
      a.idOwner !== army.idOwner &&
      (a.alive !== false) &&
      Array.isArray(a.units) &&
      a.units.some(u => u && u.alive !== false)
    );

    if (enemies.length > 0) {
      // Гарнизон есть → бой. Пока только резервируем вызов.
      this._reserveBattle(army, enemies, city);
      return false;
    }

    // Гарнизона нет → захват.
    city.ownerId = army.idOwner;
    return true;
  }

  /**
   * Зарезервированный метод сражения.
   * Пока пустой: сюда придёт разрешение боя (Warlords II — 1-на-1 по порядку
   * стека, слабые впереди, сильные сзади).
   *
   * @param {object} attacker — армия, вошедшая в клетку
   * @param {object[]} defenders — вражеские армии в клетке
   * @param {object} city — город на клетке (может быть null)
   */
  _reserveBattle(attacker, defenders, city) {
    // TODO: бой.
    // ...
  }

  /**
   * Короткий отладочный дамп клетки.
   * @param {string} [tag='Cell']
   * @returns {object} снимок
   */
  debug(tag = 'Cell') {
    const world   = STATE.world;
    const players = STATE.players;   // Players (контейнер)

    const ownerName = (id) => {
      if (id == null) return '—';
      const p = players?.get?.(id);
      return p?.name ?? `P${id}`;
    };

    const city = world?.getCityAt?.(this.x, this.y)
              ?? world?.cityList?.getAt?.(this.x, this.y)
              ?? null;

    const armies = (this.army ?? []).map(a => ({
      id:      a?.id,
      idOwner: a?.idOwner,
      owner:   ownerName(a?.idOwner),
      units:   a?.units?.filter(u => u && u.alive !== false).length ?? 0,
    }));

    const snap = {
      x: this.x, y: this.y,
      type: this.type,
      overlay: this.overlayName,
      staminaCost: this.staminaCost,
      city: city
        ? { name: city.name, type: city.type, owner: ownerName(city.ownerId) }
        : null,
      armies,
    };

    console.log(`🟩: [${tag}] (${this.x}, ${this.y})`, snap);
    return snap;
  }
}