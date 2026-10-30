// core/world-map.js

/** Типы городов */
export const CITY_TYPE = Object.freeze({
  PROVINCIAL: 'provincial', // по умолчанию
  CAPITAL:    'capital',
  FORTRESS:   'fortress',
  BACKWATER:  'backwater',
});

const CITY_TYPE_SET = new Set(Object.values(CITY_TYPE));

export class WorldMap {
  constructor(w, h, seed) {
    this.w = w; this.h = h; this.seed = seed;
    this.cells = new Array(w * h);
    this.cities = [];       // [{ x, y, name, type, ownerId }]
    this.rivers = [];       // [{ cells:[[x,y],...] }]
  }
  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inBounds(x, y) ? this.cells[this.idx(x, y)] : null; }
  set(x, y, cell) { if (this.inBounds(x, y)) this.cells[this.idx(x, y)] = cell; }

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
  //  ГОРОДА: тип и владелец
  // ─────────────────────────────────────────────────────────────

  /**
   * Создать город с валидацией типа.
   * @param {{ x:number, y:number, name?:string, type?:string, ownerId?:(string|number|null) }} data
   * @returns {object|null} созданный город или null, если координаты вне карты / город уже есть
   */
  addCity(data) {
    const { x, y } = data || {};
    if (!this.inBounds(x, y)) return null;
    if (this.getCityAt(x, y)) return null; // не плодим дубли на одной клетке

    const type = CITY_TYPE_SET.has(data.type) ? data.type : CITY_TYPE.PROVINCIAL;
    const city = {
      x, y,
      name: data.name ?? `City (${x},${y})`,
      type,
      ownerId: data.ownerId ?? null,
    };
    this.cities.push(city);
    return city;
  }

  /** Найти город по координатам клетки. */
  getCityAt(x, y) {
    return this.cities.find(c => c.x === x && c.y === y) || null;
  }

  /** Индекс города в массиве (или -1). */
  getCityIndex(cityOrCoord) {
    if (!cityOrCoord) return -1;
    if (typeof cityOrCoord === 'number') {
      return (cityOrCoord >= 0 && cityOrCoord < this.cities.length) ? cityOrCoord : -1;
    }
    const byRef = this.cities.indexOf(cityOrCoord);
    if (byRef >= 0) return byRef;
    return this.cities.findIndex(c => c.x === cityOrCoord.x && c.y === cityOrCoord.y);
  }

  /** Сменить тип города. Возвращает true, если изменение применилось. */
  setCityType(cityOrCoord, type) {
    const city = this._resolveCity(cityOrCoord);
    if (!city || !CITY_TYPE_SET.has(type)) return false;
    city.type = type;
    return true;
  }

  /** Назначить/снять владельца. ownerId = null — «ничей». */
  setCityOwner(cityOrCoord, ownerId) {
    return this.setCityOwnerById(cityOrCoord, ownerId, { strict: false });
  }

  /** Все города указанного типа. */
  getCitiesByType(type) {
    return this.cities.filter(c => c.type === type);
  }

  /** Все города указанного владельца. */
  getCitiesByOwner(ownerId) {
    return this.cities.filter(c => c.ownerId === ownerId);
  }

  /**
   * По умолчанию все города провинциальные — этот метод «доинициализирует»
   * старые города (если карта была создана до появления полей) и
   * проставляет дефолты там, где их нет.
   */
  normalizeCities() {
    for (const c of this.cities) {
      if (!CITY_TYPE_SET.has(c.type)) c.type = CITY_TYPE.PROVINCIAL;
      if (c.ownerId === undefined) c.ownerId = null;
    }
    return this.cities;
  }

  _resolveCity(cityOrCoord) {
    if (!cityOrCoord) return null;
    if (typeof cityOrCoord === 'number') {
      return this.cities[cityOrCoord] || null;
    }
    if (typeof cityOrCoord === 'object' && 'x' in cityOrCoord && 'y' in cityOrCoord) {
      // сам объект города? если да — вернём его же
      if (this.cities.includes(cityOrCoord)) return cityOrCoord;
      return this.getCityAt(cityOrCoord.x, cityOrCoord.y);
    }
    return null;
  }

  getCityByName(name) {
    return this.cities.find(c => c.name === name) || null;
  }

    // ─────────────────────────────────────────────────────────────
  //  ВЛАДЕЛЬЦЫ ГОРОДОВ
  // ─────────────────────────────────────────────────────────────

  /**
   * Установить владельца города.
   *
   * @param {number|object|string} cityRef
   *   - number  — индекс в this.cities
   *   - object  — ссылка на объект города или {x, y}
   *   - string  — имя города
   * @param {number|string|null} ownerId  — id игрока (Player.index) или null (нейтрал)
   * @param {object} [opts]
   * @param {boolean} [opts.makeCapital=false] — заодно поставить type = 'capital'
   * @param {boolean} [opts.strict=true]       — true: вернуть false, если город не найден;
   *                                             false: молча игнорировать
   * @returns {boolean} true, если изменение применено
   * 
   * 1. Назначить владельца по индексу города
   * world.setCityOwnerById(3, 0);                    // Player.index = 0
   * // 2. По координатам
   * world.setCityOwnerById({ x: 10, y: 12 }, 1);
   * // 3. По имени
   * world.setCityOwnerById('Стольноград', 2, { makeCapital: true });
   * 
   */
  setCityOwnerById(cityRef, ownerId, opts = {}) {
    const { makeCapital = false, strict = true } = opts;
    const city = this._resolveCityRef(cityRef);
    if (!city) return strict ? false : true;

    city.ownerId = (ownerId === undefined) ? null : ownerId;
    if (makeCapital) city.type = CITY_TYPE.CAPITAL;
    return true;
  }

  /**
   * Снять владельца (сделать нейтральным). Синоним setCityOwnerById(ref, null).
   * @returns {boolean}
   */
  clearCityOwner(cityRef) {
    return this.setCityOwnerById(cityRef, null);
  }

  /**
   * Установить владельца сразу для набора городов.
   * Полезно после distributeTerritoriesAndCapitals, если нужно
   * «присвоить» всю зону влияния игроку.
   *
   * @param {Array<number|object|string>} cityRefs
   * @param {number|string|null} ownerId
   * @param {object} [opts] — те же, что у setCityOwnerById
   * @returns {number} сколько городов реально обновлено
   */
  setCitiesOwner(cityRefs, ownerId, opts = {}) {
    if (!Array.isArray(cityRefs)) return 0;
    let changed = 0;
    for (const ref of cityRefs) {
      if (this.setCityOwnerById(ref, ownerId, opts)) changed++;
    }
    return changed;
  }

  /**
   * Все города указанного владельца.
   * (Дублирует getCitiesByOwner, но с явной нормализацией null.)
   */
  getCitiesOfOwner(ownerId) {
    const target = (ownerId === undefined) ? null : ownerId;
    return this.cities.filter(c => (c.ownerId ?? null) === target);
  }

  /**
   * Проверить, владеет ли игрок городом.
   * @returns {boolean}
   */
  cityBelongsTo(cityRef, ownerId) {
    const city = this._resolveCityRef(cityRef);
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
    for (const c of this.cities) {
      if (keepCapitals && c.type === CITY_TYPE.CAPITAL) continue;
      if (c.ownerId !== null) {
        c.ownerId = null;
        changed++;
      }
    }
    return changed;
  }

  // ─────────────────────────────────────────────────────────────
  //  Внутреннее: единый резолвер ссылки на город
  // ─────────────────────────────────────────────────────────────
  /**
   * Приводит ссылку к объекту города или null.
   * Поддерживает: number (индекс), object (ссылка или {x,y}), string (имя).
   */
  _resolveCityRef(ref) {
    if (ref == null) return null;
    if (typeof ref === 'number') {
      return this.cities[ref] || null;
    }
    if (typeof ref === 'string') {
      return this.getCityByName(ref);
    }
    if (typeof ref === 'object') {
      if (this.cities.includes(ref)) return ref;
      if ('x' in ref && 'y' in ref) return this.getCityAt(ref.x, ref.y);
    }
    return null;
  }

  update() {
    // пока пусто
  }

  /**
   * Разделить города на равные «территории» (зоны влияния) по числу
   * активных игроков и выбрать по одной столице на игрока.
   *
   * ВАЖНО: собственность НЕ раздаётся. Все города остаются нейтральными
   * (ownerId = null), кроме столиц — у каждой столицы ownerId = player.index.
   *
   * Детерминированно: результат зависит только от world.seed и набора городов.
   * Порядок городов в world.cities не важен.
   *
   * @param {import('./world.js').WorldMap} world
   * @param {import('./players.js').Players|import('./players.js').Player[]} players
   *        — объект Players или массив Player. Берутся только active === true.
   * @param {object} [opts]
   * @param {boolean} [opts.keepTypes=false] — true: не трогать тип не-столиц
   * @param {boolean} [opts.allowEmpty=false] — true: разрешить «лишним» игрокам
   *        (когда городов меньше, чем игроков) остаться без столицы.
   * @returns {{
   *   players: Array<{
   *     player: object,
   *     ownerId: number,
   *     capital: object|null,
   *     cities: object[],   // зона влияния (включая столицу)
   *   }>,
   *   capitals: object[],
   *   byOwner: Record<number, object[]>,  // зоны влияния по ownerId
   * }}
   */
  static distributeTerritoriesAndCapitals(world, players, opts = {}) {
    if (!world || !Array.isArray(world.cities) || world.cities.length === 0) {
      return { players: [], capitals: [], byOwner: {} };
    }

    // ── 0. Активные игроки ─────────────────────────────────────────
    const list = Array.isArray(players)
      ? players
      : (players?.list ?? []);
    const active = list.filter(p => p && p.active);

    if (active.length === 0) {
      throw new Error('distributeTerritoriesAndCapitals: нет активных игроков');
    }

    const cities = world.cities;
    const n = cities.length;
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
    // Все нейтральны, тип — провинциальный (если не keepTypes).
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

      // Столица — первый в детерминированном порядке.
      // Только у столицы есть владелец.
      let capital = null;
      if (playerCities.length > 0) {
        capital = playerCities[0];
        capital.type = 'capital';   // CITY_TYPE.CAPITAL
        capital.ownerId = ownerId;  // ⬅️ владелец только у столицы
        capitals.push(capital);
      }

      // Остальные города в зоне — нейтральны (ownerId уже null после шага 3).
      byOwner[ownerId] = playerCities;
      resultPlayers.push({ player, ownerId, capital, cities: playerCities });
    }

    // ── 5. Города вне зон ──────────────────────────────────────────
    // По математике cursor === n, но на всякий случай:
    if (cursor < n) {
      for (let i = cursor; i < n; i++) {
        cities[order[i]].ownerId = null;
      }
    }

    return { players: resultPlayers, capitals, byOwner };
  }
}

/* Пример использования
import { WorldMap, CITY_TYPE } from './core/world-map.js';

const world = new WorldMap(50, 50, 12345);
// ... генерация клеток ...

world.addCity({ x: 10, y: 12, name: 'Aldermere' });                        // provincial по умолчанию
world.addCity({ x: 25, y: 25, name: 'Kingsport', type: CITY_TYPE.CAPITAL, ownerId: 'red' });
world.addCity({ x: 5,  y: 40, name: 'Ironhold', type: CITY_TYPE.FORTRESS, ownerId: 'red' });
world.addCity({ x: 48, y: 2,  name: 'Nowhere',  type: CITY_TYPE.BACKWATER });

world.getCitiesByType(CITY_TYPE.FORTRESS); // [Ironhold]
world.getCitiesByOwner('red');             // [Kingsport, Ironhold]

world.setCityType({ x: 10, y: 12 }, CITY_TYPE.CAPITAL);
world.setCityOwner('Ironhold', 'blue');    // можно по имени? — нет, только по ref/координатам.
                                           // для «по имени» используй find:
// world.setCityOwner(world.cities.find(c => c.name === 'Ironhold'), 'blue');
*/

/* Использование Выбора Столиц для игроков
import { WorldMap } from './core/world-map.js';
import { Players } from './players.js';

const world = new WorldMap(50, 50, 12345);
// ... генерация клеток и добавление городов ...

const players = new Players(8);
players.setActive(0, true);
players.setActive(1, true);
players.setActive(3, true);
// players.activeCount === 3

const result = WorldMap.distributeTerritoriesAndCapitals(world, players);

console.log(result.players);
// [
//   { player: Player(0), ownerId: 0, capital: {...}, cities: [c0, c1, c2] },
//   { player: Player(1), ownerId: 1, capital: {...}, cities: [c3, c4, c5] },
//   { player: Player(3), ownerId: 3, capital: {...}, cities: [c6, c7, c8] },
// ]

// Столицы:
result.capitals.forEach(c => {
  console.log(`Игрок ${c.ownerId}: столица ${c.name} (${c.x},${c.y})`);
});

// Города по владельцу:
result.byOwner[0]; // города игрока 0
result.byOwner[3]; // города игрока 3
*/


// core/name-generator.js

/**
 * Детерминированный генератор РУССКИХ имён.
 *
 * Один и тот же idx + seed → всегда одно и то же имя.
 * Никакого Math.random, никакого состояния.
 *
 * Стили:
 *   'city'      — города (Белозёрск, Красногорск, Светлояр…)
 *   'fortress'  — крепости (Каменогорск, Твердыня, Железнобор…)
 *   'backwater' — захолустье (Гнилодворье, Мутновка, Захолустье…)
 *   'capital'   — столицы (Стольноград, Великоград, Златоград…)
 *   'person'    — люди (Святослав, Ярополк, Мирослава…)
 */

const STYLES = {
  // ───────────────────────────── города ─────────────────────────────
  city: {
    pre: [
      'Бел', 'Красн', 'Светл', 'Темн', 'Черн', 'Злат', 'Серебр', 'Желез',
      'Камен', 'Син', 'Зелен', 'Крив', 'Остр', 'Велик', 'Мал', 'Добр',
      'Гор', 'Лес', 'Реч', 'Озёр', 'Снеж', 'Ветр', 'Тих', 'Ясн', 'Люб',
      'Рат', 'Слав', 'Мир', 'Вол', 'Дуб', 'Сосн', 'Берёз',
    ],
    mid: ['', '', '', 'о', 'е', 'а'],
    suf: [
      'град', 'город', 'горск', 'поль', 'речье', 'бор', 'озёрск',
      'славль', 'мир', 'дол', 'лог', 'яр', 'ово', 'ино', 'ье',
      'ец', 'ск', 'ов', 'ин', 'ка', 'овка', 'евка',
    ],
    // для городов предпочтителен «мужской» род: Белозёрск, Красногорск
    gender: 'm',
  },

  // ──────────────────────────── крепости ────────────────────────────
  fortress: {
    pre: [
      'Камен', 'Желез', 'Стальн', 'Черн', 'Красн', 'Грозн', 'Тверд',
      'Крем', 'Брон', 'Гром', 'Мороз', 'Ледян', 'Огн', 'Волч', 'Медвеж',
      'Сокол', 'Орл', 'Зме', 'Дубов', 'Кост',
    ],
    mid: ['', '', 'о', 'е'],
    suf: [
      'град', 'город', 'бор', 'тын', 'вал', 'стен', 'крепость',
      'твердыня', 'острог', 'застава', 'рубеж', 'оплот', 'щит',
    ],
    gender: 'm',
  },

  // ─────────────────────────── захолустье ───────────────────────────
  backwater: {
    pre: [
      'Гнил', 'Мутн', 'Тхн', 'Болот', 'Кочк', 'Дурн', 'Крив', 'Хром',
      'Пьян', 'Грязн', 'Вшив', 'Рван', 'Кос', 'Дер', 'Сопл', 'Слеп',
      'Плеш', 'Ржав', 'Чахл', 'Кисл',
    ],
    mid: ['', '', 'о', 'е'],
    suf: [
      'дворье', 'полье', 'холмье', 'яма', 'дыра', 'лужа', 'топь',
      'гниль', 'село', 'деревня', 'слобода', 'выселки', 'заимка',
      'брод', 'ово', 'ино', 'ка', 'овка',
    ],
    gender: 'n', // «дворье», «полье», «село»
  },

  // ──────────────────────────── столицы ─────────────────────────────
  capital: {
    pre: [
      'Стольн', 'Велик', 'Злат', 'Свет', 'Славн', 'Цар', 'Княж', 'Держав',
      'Перв', 'Главн', 'Выш', 'Красн', 'Бел', 'Ясн', 'Дивн', 'Красив',
    ],
    mid: ['', '', 'о', 'е', 'а'],
    suf: [
      'град', 'город', 'стольн', 'двор', 'чертог', 'престол',
      'венец', 'скипетр', 'корона',
    ],
    // иногда столица — «Великий Новгород»-стиль: титул + город
    titles: ['Велик', 'Славн', 'Злат', 'Царствен', 'Державн'],
    titleChance: 0.35,
    gender: 'm',
  },

  // ──────────────────────────── люди ────────────────────────────────
  person: {
    pre: [
      'Свят', 'Яр', 'Миро', 'Влад', 'Добр', 'Рат', 'Слав', 'Люб', 'Рости',
      'Изясл', 'Всевол', 'Бряч', 'Горем', 'Добро', 'Тверд', 'Велим',
      'Ярополк', 'Мстисл', 'Святосл', 'Владисл',
    ],
    mid: ['', 'о', 'а', 'и'],
    suf: [
      'слав', 'полк', 'мир', 'свет', 'дан', 'бор', 'гост', 'рад',
      'слав', 'мир', 'дан',
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────
//  Детерминированный хеш индекса (murmur3-подобный)
// ─────────────────────────────────────────────────────────────────────
function hashIdx(idx, salt = 0) {
  let h = (idx | 0) ^ 0x9e3779b9 ^ (salt | 0);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export class NameGenerator {
  /**
   * @param {object} [opts]
   * @param {number} [opts.seed=0]
   * @param {string} [opts.style='city']
   * @param {object} [opts.custom] — кастомные стили (мержатся поверх STYLES)
   */
  constructor(opts = {}) {
    this.seed = (opts.seed ?? 0) | 0;
    this.defaultStyle = opts.style ?? 'city';
    this.styles = { ...STYLES, ...(opts.custom || {}) };
  }

  /** Имя по индексу. */
  name(idx, style = this.defaultStyle) {
    const st = this.styles[style] || this.styles.city;
    return this._buildName(idx | 0, st);
  }

  /** N уникальных имён подряд (детерминированно). */
  many(count, style = this.defaultStyle, startIdx = 0) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(this.name(startIdx + i, style));
    return out;
  }

  /** { name, idx, style } — удобно для UI-списков. */
  at(idx, style = this.defaultStyle) {
    return { name: this.name(idx, style), idx: idx | 0, style };
  }

  // ───────────────────────── внутреннее ──────────────────────────────

  _buildName(idx, st) {
    const base = hashIdx(idx, this.seed);

    // столица — иногда «титул + город»
    if (st.titles && st.titleChance) {
      const tRoll = (hashIdx(idx, this.seed ^ 0xa53) % 1000) / 1000;
      if (tRoll < st.titleChance) {
        const title = st.titles[hashIdx(idx, this.seed ^ 0x1f3) % st.titles.length];
        const pre = st.pre[hashIdx(idx, this.seed ^ 0x2c7) % st.pre.length];
        const suf = st.suf[hashIdx(idx, this.seed ^ 0x4b1) % st.suf.length];
        return this._smooth(title + pre.toLowerCase() + suf);
      }
    }

    const p = st.pre[base % st.pre.length];
    const m = st.mid[(base >>> 8) % st.mid.length];
    const s = st.suf[(base >>> 16) % st.suf.length];

    return this._smooth(p + m + s);
  }

  // Русское сглаживание стыков
  _smooth(s) {
    // тройные одинаковые буквы → двойные (Каменнн → Каменн)
    s = s.replace(/([а-яё])\1\1/gi, '$1$1');
    // «ъ»/«ь» перед гласной убираем (не бывает «Белъозёрск»)
    s = s.replace(/[ъь](?=[аеёиоуыэюя])/gi, '');
    // двойная гласная на стыке → одна (Белоозёрск → Белозёрск)
    s = s.replace(/([аеёиоуыэюя])\1/gi, '$1');
    // «й» перед согласной → «и» (Крайск → Краиск — редко, но)
    // (оставляем как есть, чтобы не ломать «Край»)
    // первая буква заглавная
    if (s) s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    return s;
  }
}

export { STYLES as NAME_STYLES, hashIdx as nameHash };

/* Использование с городами
import { WorldMap, CITY_TYPE } from './core/world-map.js';
import { NameGenerator } from './core/name-generator.js';

const world = new WorldMap(50, 50, 12345);
const names = new NameGenerator({ seed: world.seed });

// город №0 — провинциальный
world.addCity({ x: 10, y: 12, name: names.name(0, 'city') });
// город №1 — столица
world.addCity({ x: 25, y: 25, name: names.name(1, 'capital'), type: CITY_TYPE.CAPITAL, ownerId: 'red' });
// город №2 — крепость
world.addCity({ x: 5,  y: 40, name: names.name(2, 'fortress'), type: CITY_TYPE.FORTRESS, ownerId: 'red' });
// город №3 — захолустье
world.addCity({ x: 48, y: 2,  name: names.name(3, 'backwater'), type: CITY_TYPE.BACKWATER });

// или пакетно — по индексам 0..N-1
const cities = names.many(10, 'city').map((name, i) => ({
  x: i * 4 + 2, y: i * 3 + 2, name,
}));
*/

