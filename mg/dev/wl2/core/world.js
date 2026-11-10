// core/world-map.js
// class City;
// class CitiesAll;
// class WorldMap;

import { STATE } from './g-state.js';
import { NAME  } from './gen-name.js';
import { NAME_STYLES, NameGenerator, hashIdx } from './gen-name.js';

//-----------------------------------------------------------------------------|
// City
//-------------------------------------------------------------------------- ⭐
/** Типы городов */
export const CITY_TYPE = Object.freeze({
  PROVINCIAL: 'provincial', // по умолчанию
  CAPITAL:    'capital',
  FORTRESS:   'fortress',
  BACKWATER:  'backwater',
  RUINS:      'ruins',      // нейтральные руины — захватить нельзя
});

const CITY_TYPE_SET = new Set(Object.values(CITY_TYPE));

/**
 * Город.
 *
 * Отвечает за собственные поля (x, y, name, type, ownerId) и их валидацию.
 * Не знает о карте — вся «картовая» логика (поиск, добавление, разрешение
 * ссылок) остаётся в CitiesAll / WorldMap.
 *
 * Конструктор совместим с прежним API: new City(w, h, seed) создаёт
 * «пустой» город-заготовку (координаты 0,0), которую потом можно
 * инициализировать через init()/fromData().
 */
export class City {
  constructor(w, h, seed) {
    // Совместимость со старым конструктором (w, h, seed).
    // Если передан объект-данные — инициализируемся из него.
    if (w && typeof w === 'object') {
      this.init(w);
      return;
    }
    this.x = 0;
    this.y = 0;
    this.name = '';
    this.type = CITY_TYPE.PROVINCIAL;
    this.ownerId = null;
    // Тип сгенерированной «точки» (fortress/backwater/ruins) или null.
    // Нужен, чтобы при повторной раздаче убрать старые точки, а не плодить дубли.
    this.site = null;
    // Производство юнитов (см. core/production.js):
    // выбранный тип, счётчик оставшихся кругов и полная цена.
    this.production = null;
    this.productionOwner = null;
    this.productionTurnsLeft = 0;
    this.productionTurnsTotal = 0;
    // w/h/seed сохранены для обратной совместимости (не используются логикой).
    this._w = w ?? 0;
    this._h = h ?? 0;
    this._seed = seed ?? 0;
  }

  /**
   * Инициализировать город из объекта данных.
   * @param {{ x:number, y:number, name?:string, type?:string, ownerId?:(string|number|null) }} data
   * @returns {City}
   */
  init(data) {
    const { x, y } = data || {};
    this.x = x;
    this.y = y;
    this.name = data.name ?? `City (${x},${y})`;
    this.type = CITY_TYPE_SET.has(data.type) ? data.type : CITY_TYPE.PROVINCIAL;
    this.ownerId = data.ownerId ?? null;
    this.site = data.site ?? null;
    this.production = data.production ?? null;
    this.productionOwner = data.productionOwner ?? this.ownerId;
    this.productionTurnsLeft = data.productionTurnsLeft ?? 0;
    this.productionTurnsTotal = data.productionTurnsTotal ?? 0;
    return this;
  }

  /** Создать City из данных (удобная фабрика). */
  static fromData(data) {
    return new City(data);
  }

  /** Валиден ли тип. */
  static isValidType(type) {
    return CITY_TYPE_SET.has(type);
  }

  /** Сменить тип с валидацией. @returns {boolean} */
  setType(type) {
    if (!CITY_TYPE_SET.has(type)) return false;
    this.type = type;
    return true;
  }

  /** Назначить/снять владельца. ownerId = null — «ничей». */
  setOwner(ownerId) {
    this.ownerId = (ownerId === undefined) ? null : ownerId;
    return true;
  }

  /** Снять владельца. */
  clearOwner() {
    this.ownerId = null;
    return true;
  }

  /** Совпадает ли владелец. */
  belongsTo(ownerId) {
    return (this.ownerId ?? null) === (ownerId ?? null);
  }

  /** Привести поля к дефолтам (для старых/частично заполненных городов). */
  normalize() {
    if (!CITY_TYPE_SET.has(this.type)) this.type = CITY_TYPE.PROVINCIAL;
    if (this.ownerId === undefined) this.ownerId = null;
    if (this.site === undefined) this.site = null;
    if (this.production === undefined) this.production = null;
    if (this.productionOwner === undefined) this.productionOwner = this.ownerId ?? null;
    if (!Number.isFinite(this.productionTurnsLeft)) this.productionTurnsLeft = 0;
    if (!Number.isFinite(this.productionTurnsTotal)) this.productionTurnsTotal = 0;
    return this;
  }

  /** Сериализация в plain-object (для сохранений/сети). */
  toJSON() {
    return {
      x: this.x,
      y: this.y,
      name: this.name,
      type: this.type,
      ownerId: this.ownerId,
      site: this.site,
      production: this.production,
      productionOwner: this.productionOwner,
      productionTurnsLeft: this.productionTurnsLeft,
      productionTurnsTotal: this.productionTurnsTotal,
    };
  }
}

//-----------------------------------------------------------------------------|
// CitiesAll
//-------------------------------------------------------------------------- ⭐
/**
 * Контейнер всех городов карты.
 *
 * Держит массив городов и предоставляет все операции над ними:
 * добавление, поиск, смену типа/владельца, нормализацию, резолв ссылок.
 *
 * WorldMap создаёт экземпляр этого класса и делегирует ему вызовы,
 * сохраняя прежний публичный API.
 */
export class CitiesAll {
  /**
   * @param {WorldMap} [world] — ссылка на карту (для inBounds / getCityAt).
   *                             Не обязательна, если добавлять города с уже
   *                             проверенными координатами.
   */
  constructor(world = null) {
    this.world = world;
    this.list = [];        // City[]
    // Псевдоним для обратной совместимости: world.cities === world.cityList.list
    // (см. геттер в WorldMap)
  }

  /** Количество городов. */
  get length() { return this.list.length; }

  /** Массив городов (совместимость с прежним world.cities). */
  get cities() { return this.list; }

  // ─────────────────────────────────────────────────────────────
  //  Добавление / поиск
  // ─────────────────────────────────────────────────────────────

  /**
   * Создать город с валидацией типа.
   * @param {{ x:number, y:number, name?:string, type?:string, ownerId?:(string|number|null) }} data
   * @returns {City|null} созданный город или null, если координаты вне карты / город уже есть
   */
  add(data) {
    const { x, y } = data || {};
    if (this.world && !this.world.inBounds(x, y)) return null;
    if (this.getAt(x, y)) return null; // не плодим дубли на одной клетке

    const city = new City().init(data);
    this.list.push(city);

    // Помечаем клетку городом: цена входа = 1 (как дорога).
    const cell = this.world?.get?.(x, y);
    if (cell) cell.city = this.list.length - 1;

    return city;
  }

  /** Найти город по координатам клетки. */
  getAt(x, y) {
    return this.list.find(c => c.x === x && c.y === y) || null;
  }

  /** Индекс города в массиве (или -1). */
  getIndex(cityOrCoord) {
    if (!cityOrCoord) return -1;
    if (typeof cityOrCoord === 'number') {
      return (cityOrCoord >= 0 && cityOrCoord < this.list.length) ? cityOrCoord : -1;
    }
    const byRef = this.list.indexOf(cityOrCoord);
    if (byRef >= 0) return byRef;
    return this.list.findIndex(c => c.x === cityOrCoord.x && c.y === cityOrCoord.y);
  }

  /** Все города указанного типа. */
  getByType(type) {
    return this.list.filter(c => c.type === type);
  }

  /** Все города указанного владельца. */
  getByOwner(ownerId) {
    return this.list.filter(c => c.ownerId === ownerId);
  }

  /** Все города указанного владельца (с нормализацией null). */
  getOfOwner(ownerId) {
    const target = (ownerId === undefined) ? null : ownerId;
    return this.list.filter(c => (c.ownerId ?? null) === target);
  }

  /** Найти по имени. */
  getByName(name) {
    return this.list.find(c => c.name === name) || null;
  }

  // ─────────────────────────────────────────────────────────────
  //  Тип
  // ─────────────────────────────────────────────────────────────

  /** Сменить тип города. Возвращает true, если изменение применилось. */
  setType(cityOrCoord, type) {
    const city = this._resolve(cityOrCoord);
    if (!city || !CITY_TYPE_SET.has(type)) return false;
    city.type = type;
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  //  Владельцы
  // ─────────────────────────────────────────────────────────────

  /** Назначить/снять владельца. ownerId = null — «ничей». */
  setOwner(cityOrCoord, ownerId) {
    return this.setOwnerById(cityOrCoord, ownerId, { strict: false });
  }

  /**
   * Установить владельца города.
   *
   * @param {number|object|string} cityRef
   *   - number  — индекс в this.list
   *   - object  — ссылка на объект города или {x, y}
   *   - string  — имя города
   * @param {number|string|null} ownerId  — id игрока (Player.index) или null (нейтрал)
   * @param {object} [opts]
   * @param {boolean} [opts.makeCapital=false] — заодно поставить type = 'capital'
   * @param {boolean} [opts.strict=true]       — true: вернуть false, если город не найден;
   *                                             false: молча игнорировать
   * @returns {boolean} true, если изменение применено
   */
  setOwnerById(cityRef, ownerId, opts = {}) {
    const { makeCapital = false, strict = true } = opts;
    const city = this._resolveRef(cityRef);
    if (!city) return strict ? false : true;

    city.ownerId = (ownerId === undefined) ? null : ownerId;
    if (makeCapital) city.type = CITY_TYPE.CAPITAL;
    return true;
  }

  /** Снять владельца. Синоним setOwnerById(ref, null). */
  clearOwner(cityRef) {
    return this.setOwnerById(cityRef, null);
  }

  /**
   * Установить владельца сразу для набора городов.
   * @returns {number} сколько городов реально обновлено
   */
  setOwners(cityRefs, ownerId, opts = {}) {
    if (!Array.isArray(cityRefs)) return 0;
    let changed = 0;
    for (const ref of cityRefs) {
      if (this.setOwnerById(ref, ownerId, opts)) changed++;
    }
    return changed;
  }

  /** Проверить, владеет ли игрок городом. */
  belongsTo(cityRef, ownerId) {
    const city = this._resolveRef(cityRef);
    if (!city) return false;
    return (city.ownerId ?? null) === (ownerId ?? null);
  }

  /**
   * Снять владельцев у всех городов (все нейтральны).
   * @param {object} [opts]
   * @param {boolean} [opts.keepCapitals=false] — true: не трогать города с type === 'capital'
   * @returns {number} сколько городов изменено
   */
  clearAllOwners(opts = {}) {
    const { keepCapitals = false } = opts;
    let changed = 0;
    for (const c of this.list) {
      if (keepCapitals && c.type === CITY_TYPE.CAPITAL) continue;
      if (c.ownerId !== null) {
        c.ownerId = null;
        changed++;
      }
    }
    return changed;
  }

  // ─────────────────────────────────────────────────────────────
  //  Нормализация
  // ─────────────────────────────────────────────────────────────

  /**
   * «Доинициализирует» старые города (если карта была создана до появления
   * полей) и проставляет дефолты там, где их нет.
   */
  normalize() {
    for (const c of this.list) {
      if (typeof c.normalize === 'function') {
        c.normalize();
      } else {
        // на случай plain-объектов (например, из старого сейва)
        if (!CITY_TYPE_SET.has(c.type)) c.type = CITY_TYPE.PROVINCIAL;
        if (c.ownerId === undefined) c.ownerId = null;
      }
    }
    return this.list;
  }

  // ─────────────────────────────────────────────────────────────
  //  Резолверы ссылок
  // ─────────────────────────────────────────────────────────────

  /** Приводит ссылку к объекту города (по индексу/координатам). */
  _resolve(cityOrCoord) {
    if (!cityOrCoord) return null;
    if (typeof cityOrCoord === 'number') {
      return this.list[cityOrCoord] || null;
    }
    if (typeof cityOrCoord === 'object' && 'x' in cityOrCoord && 'y' in cityOrCoord) {
      if (this.list.includes(cityOrCoord)) return cityOrCoord;
      return this.getAt(cityOrCoord.x, cityOrCoord.y);
    }
    return null;
  }

  /**
   * Приводит ссылку к объекту города или null.
   * Поддерживает: number (индекс), object (ссылка или {x,y}), string (имя).
   */
  _resolveRef(ref) {
    if (ref == null) return null;
    if (typeof ref === 'number') {
      return this.list[ref] || null;
    }
    if (typeof ref === 'string') {
      return this.getByName(ref);
    }
    if (typeof ref === 'object') {
      if (this.list.includes(ref)) return ref;
      if ('x' in ref && 'y' in ref) return this.getAt(ref.x, ref.y);
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  //  Детерминированное распределение территорий и столиц
  // ─────────────────────────────────────────────────────────────

  /**
   * Разделить города на равные «территории» (зоны влияния) по числу
   * активных игроков и выбрать по одной столице на игрока.
   *
   * ВАЖНО: собственность НЕ раздаётся. Все города остаются нейтральными
   * (ownerId = null), кроме столиц — у каждой столицы ownerId = player.index.
   *
   * @param {WorldMap} world
   * @param {object|Array} players — объект Players или массив Player.
   *                                Берутся только active === true.
   * @param {object} [opts]
   * @param {boolean} [opts.keepTypes=false]
   * @param {boolean} [opts.allowEmpty=false]
   * @returns {{
   *   players: Array<{ player: object, ownerId: number, capital: object|null, cities: object[] }>,
   *   capitals: object[],
   *   byOwner: Record<number, object[]>,
   * }}
   */
  static distributeTerritoriesAndCapitals(world, players, opts = {}) {
    // Делегируем в WorldMap, чтобы сохранить прежнюю точку входа.
    return WorldMap.distributeTerritoriesAndCapitals(world, players, opts);
  }
}

//-----------------------------------------------------------------------------|
// WorldMap
//-------------------------------------------------------------------------- ⭐
export class WorldMap {
  constructor(w, h, seed) {
    this.w = w; this.h = h; this.seed = seed;
    this.cells = new Array(w * h);
    this.cityList = new CitiesAll(this); // ⬅️ держатель городов
    this.rivers = [];                    // [{ cells:[[x,y],...] }]

    STATE.world = this;
  }
  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inBounds(x, y) ? this.cells[this.idx(x, y)] : null; }
  set(x, y, cell) { if (this.inBounds(x, y)) this.cells[this.idx(x, y)] = cell; }

  /**
   * Совместимость: world.cities — это массив городов (cityList.list).
   * Старый код, который делал world.cities.push/ filter/ find, продолжит
   * работать, т.к. возвращается тот же массив по ссылке.
   */
  get cities() { return this.cityList.list; }
  set cities(arr) { this.cityList.list = arr; }

  neighbors8(x, y) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const c = this.get(x + dx, y + dy);
        if (c) out.push(c);
      }
    return out;
  }
  neighbors4(x, y) {
    return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]
      .map(([nx,ny]) => this.get(nx,ny)).filter(Boolean);
  }
  get cellsFlat() { return this.cells; }

  get cells2D() {
    const m = [];
    for (let y = 0; y < this.h; y++) {
      const row = [];
      for (let x = 0; x < this.w; x++) row.push(this.cells[y * this.w + x]);
      m.push(row);
    }
    return m;
  }

  // ─────────────────────────────────────────────────────────────
  //  ГОРОДА: тонкие делегаты в CitiesAll
  // ─────────────────────────────────────────────────────────────

  /** Создать город. @returns {City|null} */
  addCity(data) {
    return this.cityList.add(data);
  }

  /** Найти город по координатам клетки. */
  getCityAt(x, y) {
    return this.cityList.getAt(x, y);
  }

  /** Индекс города (или -1). */
  getCityIndex(cityOrCoord) {
    return this.cityList.getIndex(cityOrCoord);
  }

  /** Сменить тип города. */
  setCityType(cityOrCoord, type) {
    return this.cityList.setType(cityOrCoord, type);
  }

  /** Назначить/снять владельца. */
  setCityOwner(cityOrCoord, ownerId) {
    return this.cityList.setOwner(cityOrCoord, ownerId);
  }

  /** Все города указанного типа. */
  getCitiesByType(type) {
    return this.cityList.getByType(type);
  }

  /** Все города указанного владельца. */
  getCitiesByOwner(ownerId) {
    return this.cityList.getByOwner(ownerId);
  }

  /** Нормализация городов. */
  normalizeCities() {
    return this.cityList.normalize();
  }

  /**
   * Убрать города-«точки», добавленные distributeTerritoriesAndCapitals
   * (крепости/захолустья/руины). Нужно для идемпотентного повторного запуска.
   * @returns {number} сколько удалено
   */
  removeGeneratedSites() {
    const list = this.cityList.list;
    if (!Array.isArray(list) || !list.some(c => c && c.site)) return 0;

    const keep = [];
    for (const city of list) {
      if (city && city.site) {
        const cell = this.get(city.x, city.y);
        if (cell && cell.city >= 0) cell.city = -1;
      } else {
        keep.push(city);
      }
    }

    this.cities = keep;

    // Индексы в клетках должны снова совпадать с позициями в массиве.
    this.cities.forEach((city, idx) => {
      const cell = this.get(city.x, city.y);
      if (cell) cell.city = idx;
    });

    return list.length - keep.length;
  }

  _resolveCity(cityOrCoord) {
    return this.cityList._resolve(cityOrCoord);
  }

  getCityByName(name) {
    return this.cityList.getByName(name);
  }

  addArmy(army)
  { const cell = this.get(army.x, army.y);
    cell.addArmy(army);
  }

  /** Убрать все армии со всех клеток карты. */
  clearArmies() {
    for (const cell of this.cells) {
      if (cell && Array.isArray(cell.army)) cell.army.length = 0;
    }
  }

  /** Сброс городов: снять владельцев (флаги становятся нейтральными). */
  resetCities() {
    return this.clearAllOwners();
  }

  // ─────────────────────────────────────────────────────────────
  //  ВЛАДЕЛЬЦЫ ГОРОДОВ (делегаты)
  // ─────────────────────────────────────────────────────────────

  /**
   * Установить владельца города.
   * @param {number|object|string} cityRef
   * @param {number|string|null} ownerId
   * @param {object} [opts]
   * @param {boolean} [opts.makeCapital=false]
   * @param {boolean} [opts.strict=true]
   * @returns {boolean}
   */
  setCityOwnerById(cityRef, ownerId, opts = {}) {
    return this.cityList.setOwnerById(cityRef, ownerId, opts);
  }

  /** Снять владельца. */
  clearCityOwner(cityRef) {
    return this.cityList.clearOwner(cityRef);
  }

  /** Установить владельца сразу для набора городов. @returns {number} */
  setCitiesOwner(cityRefs, ownerId, opts = {}) {
    return this.cityList.setOwners(cityRefs, ownerId, opts);
  }

  /** Все города указанного владельца (с нормализацией null). */
  getCitiesOfOwner(ownerId) {
    return this.cityList.getOfOwner(ownerId);
  }

  /** Проверить, владеет ли игрок городом. */
  cityBelongsTo(cityRef, ownerId) {
    return this.cityList.belongsTo(cityRef, ownerId);
  }

  /** Снять владельцев у всех городов. @returns {number} */
  clearAllOwners(opts = {}) {
    return this.cityList.clearAllOwners(opts);
  }

  _resolveCityRef(ref) {
    return this.cityList._resolveRef(ref);
  }

  moveArmy(army, nx, ny) {
    const from = this.get(army.x, army.y);
    const to   = this.get(nx, ny);
    if (!to) return false;
    from?.removeArmy?.(army);
    to.addArmy(army);            // внутри обновит army.x/army.y
    return true;
  }

  update(dt) {
    // пока пусто
  }

  /**
   * Дистанция в шагах от каждой клетки до ближайшей дороги.
   * @returns {Int32Array} -1, если дорог на карте нет
   */
  static _roadDistanceMap(world) {
    const w = world.w | 0;
    const h = world.h | 0;
    const dist = new Int32Array(w * h).fill(-1);
    const queue = [];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = world.get(x, y);
        if (cell && cell.hasRoad) {
          dist[y * w + x] = 0;
          queue.push(x, y);
        }
      }
    }

    const dirs = [1, 0, -1, 0, 0, 1, 0, -1];
    for (let head = 0; head < queue.length; head += 2) {
      const x = queue[head];
      const y = queue[head + 1];
      const d = dist[y * w + x];

      for (let k = 0; k < 8; k += 2) {
        const nx = x + dirs[k];
        const ny = y + dirs[k + 1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;

        const idx = ny * w + nx;
        if (dist[idx] !== -1) continue;

        dist[idx] = d + 1;
        queue.push(nx, ny);
      }
    }

    return dist;
  }

  /**
   * Добавить каждому игроку по одной крепости, захолустью и руинам.
   * Крепость и захолустье принадлежат игроку; руины нейтральны и стоят
   * на холмах/горах вдали от дорог.
   *
   * @returns {{ owned: Map<number, object[]>, ruins: object[] }}
   */
  static _addPlayerSites(world, records, opts = {}, nameGen = null) {
    const owned = new Map();
    const ruins = [];
    if (!Array.isArray(records) || records.length === 0) {
      return { owned, ruins };
    }

    const w = world.w | 0;
    const h = world.h | 0;
    const seed = world.seed | 0;
    const roadDist = WorldMap._roadDistanceMap(world);
    const center = { x: w >> 1, y: h >> 1 };

    const LAND = new Set(['plain', 'forest', 'hills']);
    const isLand = (cell) => LAND.has(cell.type);
    const isHillOrMount = (cell) =>
      cell.type === 'hills' || cell.type === 'mount';

    const occupied = new Set();
    const siteCells = [];
    for (const city of world.cities) {
      if (city) occupied.add(`${city.x},${city.y}`);
    }

    const key = (x, y) => `${x},${y}`;
    const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

    const isFree = (cell) => {
      if (!cell) return false;
      if (cell.city >= 0) return false;
      if (occupied.has(key(cell.x, cell.y))) return false;
      return true;
    };

    const farEnough = (cell, minDist) =>
      siteCells.every(s => manhattan(cell, s) >= minDist);

    const pick = (scoreFn) => {
      let best = null;
      let bestScore = Infinity;
      let bestHash = Infinity;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const cell = world.get(x, y);
          if (!isFree(cell)) continue;

          const score = scoreFn(cell);
          if (score == null || !Number.isFinite(score)) continue;

          const hash = hashIdx(x + y * w, seed);
          if (score < bestScore || (score === bestScore && hash < bestHash)) {
            best = cell;
            bestScore = score;
            bestHash = hash;
          }
        }
      }

      return best;
    };

    const place = (cell, type, ownerId, name) => {
      const city = world.addCity({
        x: cell.x,
        y: cell.y,
        type,
        ownerId,
        name,
        site: type,
      });
      if (!city) return null;

      city.site = type;
      occupied.add(key(cell.x, cell.y));
      siteCells.push({ x: cell.x, y: cell.y });
      return city;
    };

    let nameIdx = (opts.nameStartIdx | 0) + world.cities.length;
    const makeName = (type) => {
      const idx = nameIdx++;
      if (!nameGen) {
        const base = type === 'fortress'   ? 'Крепость'
          : type === 'backwater' ? 'Захолустье'
          : 'Руины';
        return `${base} ${idx + 1}`;
      }
      if (type === 'ruins') return `Руины: ${nameGen.name(idx, 'city')}`;
      return nameGen.name(idx, type);
    };

    const anchorOf = (rec) => rec?.capital ?? rec?.cities?.[0] ?? center;

    // Крепость: недалеко от столицы, желательно на холме.
    for (const rec of records) {
      const anchor = anchorOf(rec);
      let cell = null;

      for (const [lo, hi] of [[2, 9], [1, 14], [1, 999]]) {
        cell = pick(c => {
          if (!isLand(c) || !farEnough(c, 2)) return null;
          const d = manhattan(c, anchor);
          if (d < lo || d > hi) return null;

          const road = roadDist[c.y * w + c.x];
          return (c.type === 'hills' ? 0 : 1.5)
            + Math.abs(d - 4) * 0.5
            + (road >= 0 ? road * 0.02 : 0);
        });
        if (cell) break;
      }

      if (!cell) continue;
      const city = place(cell, 'fortress', rec.ownerId, makeName('fortress'));
      if (city) {
        if (!owned.has(rec.ownerId)) owned.set(rec.ownerId, []);
        owned.get(rec.ownerId).push(city);
      }
    }

    // Захолустье: вдали от дорог, но в окрестностях столицы.
    for (const rec of records) {
      const anchor = anchorOf(rec);
      let cell = null;

      for (const [lo, hi] of [[4, 12], [2, 16], [1, 999]]) {
        cell = pick(c => {
          if (!isLand(c) || !farEnough(c, 2)) return null;
          const d = manhattan(c, anchor);
          if (d < lo || d > hi) return null;

          const road = roadDist[c.y * w + c.x];
          const remote = road < 0 ? 30 : road;
          return -remote * 2 + Math.abs(d - 7) * 0.5;
        });
        if (cell) break;
      }

      if (!cell) continue;
      const city = place(cell, 'backwater', rec.ownerId, makeName('backwater'));
      if (city) {
        if (!owned.has(rec.ownerId)) owned.set(rec.ownerId, []);
        owned.get(rec.ownerId).push(city);
      }
    }

    // Руины: нейтральны, только холмы/горы и как можно дальше от дорог.
    for (const rec of records) {
      const anchor = anchorOf(rec);
      let cell = null;

      for (const minRoad of [5, 4, 3, 2, 0]) {
        cell = pick(c => {
          if (!isHillOrMount(c) || !farEnough(c, 3)) return null;
          if (manhattan(c, anchor) < 2) return null;

          const road = roadDist[c.y * w + c.x];
          const rd = road < 0 ? 99 : road;
          if (rd < minRoad) return null;

          return (c.type === 'mount' ? 0 : 1) - rd;
        });
        if (cell) break;
      }

      if (!cell) continue;
      const city = place(cell, 'ruins', null, makeName('ruins'));
      if (city) ruins.push(city);
    }

    return { owned, ruins };
  }

  /**
   * Разделить города на равные «территории» (зоны влияния) по числу
   * активных игроков и выбрать по одной столице на игрока.
   *
   * (Реализация остаётся в WorldMap, чтобы сохранить точку входа
   *  WorldMap.distributeTerritoriesAndCapitals — как раньше.)
   *
   * @param {WorldMap} world
   * @param {object|Array} players
   * @param {object} [opts]
   * @param {boolean} [opts.keepTypes=false]
   * @param {boolean} [opts.allowEmpty=false]
   * @param {boolean} [opts.nameCities=false]  — раздать имена
   * @param {boolean} [opts.renameAll=false]   — перезаписывать уже существующие имена
   * @param {NameGenerator} [opts.nameGen]     — свой генератор (иначе создаётся по seed)
   * @param {number} [opts.nameStartIdx=0]     — с какого индекса начинать имена
   * @returns {{
   *   players: Array<{ player: object, ownerId: number, capital: object|null, cities: object[] }>,
   *   capitals: object[],
   *   byOwner: Record<number, object[]>,
   * }}
   */

  static distributeTerritoriesAndCapitals(world, players, opts = {}) {
    if (!world || !Array.isArray(world.cities) || world.cities.length === 0) {
      return { players: [], capitals: [], byOwner: {} };
    }

    // Повторный запуск на той же карте не должен плодить дубли точек.
    if (typeof world.removeGeneratedSites === 'function') {
      world.removeGeneratedSites();
    }

    // ── 0. Активные игроки ─────────────────────────────────────────
    const list = Array.isArray(players)
      ? players
      : (players?.list ?? []);
    const active = list.filter(p => p && p.active);

    if (active.length === 0) {
      throw new Error('distributeTerritoriesAndCapitals: нет активных игроков');
    }

    const cities      = world.cities;
    const n           = cities.length;
    const playerCount = active.length;

    if (n < playerCount && !opts.allowEmpty) {
      throw new Error(
        `distributeTerritoriesAndCapitals: городов (${n}) меньше, чем ` +
        `активных игроков (${playerCount}). Добавь opts.allowEmpty = true, ` +
        `если это допустимо.`
      );
    }

    // ── 1. Детерминированный порядок городов ───────────────────────
    const seed = (world.seed | 0);
    const order = cities.map((c, i) => i);
    order.sort((a, b) => {
      const ha = hashIdx(a, seed);
      const hb = hashIdx(b, seed);
      if (ha !== hb) return ha - hb;
      return a - b;
    });

    // ── 2. Равные части ────────────────────────────────────────────
    const base = Math.floor(n / playerCount);
    const rem  = n % playerCount;

    // ── 3. Сброс собственности и типов ─────────────────────────────
    for (const c of cities) {
      c.ownerId = null;
      if (!opts.keepTypes) c.type = 'provincial';
    }

    // ── 4. Столицы и зоны влияния ──────────────────────────────────
    const resultPlayers = [];
    const capitals = [];
    const byOwner = {};

    let cursor = 0;
    for (let i = 0; i < playerCount; i++) {
      const player = active[i];
      const ownerId = player.index;
      const size = base + (i < rem ? 1 : 0);
      const idxs = order.slice(cursor, cursor + size);
      cursor += size;

      const playerCities = idxs.map(idx => cities[idx]);

      let capital = null;
      if (playerCities.length > 0) {
        capital = playerCities[0];
        capital.type = 'capital';
        capital.ownerId = ownerId;
        capitals.push(capital);
      }

      byOwner[ownerId] = playerCities;
      resultPlayers.push({ player, ownerId, capital, cities: playerCities });
    }

    // ── 4.5. Имена городам (опционально) ───────────────────────────
    // Если явно попросили — раздаём детерминированные имена.
    const nameGen = opts.nameCities
      ? (opts.nameGen instanceof NameGenerator
          ? opts.nameGen
          : new NameGenerator({ seed: world.seed }))
      : null;

    if (nameGen) {
      const startIdx = opts.nameStartIdx | 0;

      for (let k = 0; k < n; k++) {
        const city = cities[order[k]];
        if (city.name && !opts.renameAll) continue;

        const style =
          city.type === 'capital'   ? 'capital'   :
          city.type === 'fortress'  ? 'fortress'  :
          city.type === 'backwater' ? 'backwater' :
                                      'city';
        city.name = nameGen.name(startIdx + k, style);
      }
    }

    // ── 4.6. По одной крепости, захолустью и руинам на игрока ──────
    if (opts.addPlayerSites !== false) {
      const sites = WorldMap._addPlayerSites(world, resultPlayers, opts, nameGen);
      for (const rec of resultPlayers) {
        const extra = sites.owned.get(rec.ownerId) ?? [];
        if (extra.length === 0) continue;
        rec.cities.push(...extra);
        byOwner[rec.ownerId] = (byOwner[rec.ownerId] ?? []).concat(extra);
      }
    }

    // ── 5. Города вне зон ──────────────────────────────────────────
    if (cursor < n) {
      for (let i = cursor; i < n; i++) {
        cities[order[i]].ownerId = null;
      }
    }

    return { players: resultPlayers, capitals, byOwner };
  }
}
