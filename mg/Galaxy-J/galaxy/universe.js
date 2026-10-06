//-----------------------------------------------------------------------------
// universe.js - детерминированная Вселенная: seedRoot → N галактик → M звёзд
// Вся Вселенная начинается от сюда!
// Особенности:
//      - universe.js без зависимостей!
// Описание работы:
//      - Есть 1 главный рутовый сид всей Вселенной seedRoot
//      - Сид Галактики(seedGalaxy) из seedRoot и индекса от 0 ... N
//      - Сид Звезды(seedStar) из  seedGalaxy и индекса от 0 ... M
//      - N(количество Галактик) рандомно от seedRoot
//      - M(количество звёзд) рандомно от seedGalaxy
//      - Т.е. каждая Звезда(Star) иемеет уникальный ДЕТЕРМИНИРОВАННЫЙ сид!
//      - new Universe(seed) сам подхватывает сейв, если он есть:
//        сейв есть   → восстановлены seedRoot/amount/позиция,
//        сейва нет   → новая вселенная от seed, курсор (0, 0)
//      - в localStorage храним только те данные, которые нельзя сгенерировать!
//-----------------------------------------------------------------------------|

const SEED_ROOT_DEFAULT     = 2026;
const AMOUNT_GALAXY_DEFAULT =  100;
const STARS_MIN = 50, STARS_MAX =  250;

const SAVE_KEY_DEFAULT    = 'universe.save';
//const SAVE_FORMAT_VERSION = 1;

//----------------------------------------------------------------------------|
// Чистые утилиты (без состояния — основа детерминизма)
//----------------------------------------------------------------------------|

/** number | string → uint32. Строки — djb2. */
function toUint32(value)
{   if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError('seed: ожидалось конечное число');
        return value >>> 0;
    }
    if (typeof value === 'string') {
        let h = 5381;
        for (let i = 0; i < value.length; i++)
            h = (Math.imul(h, 33) ^ value.charCodeAt(i)) >>> 0;
        return h;
    }
    throw new TypeError('seed: number | string ожидалось, пришёл ' + typeof value);
}

/** hash-combine (boost-style): порядок аргументов влияет на результат. */
function hashCombine(seed, value)
{   const s = toUint32(seed), v = toUint32(value);
    return (s ^ (v + 0x9e3779b9 + (s << 6) + (s >>> 2))) >>> 0;
}

/** splitmix32-финализатор: лавинное смешивание производных сидов. */
function mix32(a)
{   a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
}

/** Mulberry32 — быстрый детерминированный PRNG, [0, 1). */
function mulberry32(seed)
{   let a = toUint32(seed);
    return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

//----------------------------------------------------------------------------|
// class RNG — обёртка над PRNG
//----------------------------------------------------------------------------|
class RNG
{
    constructor(seed) { this._rand = mulberry32(seed); }

    next()          { return this._rand(); }                          // [0, 1)
    range(min, max) { return min + (max - min) * this._rand(); }      // [min, max)
    int(min, max)   { return Math.floor(this.range(min, max + 1)); }  // [min, max] целое
    chance(p)       { return this._rand() < p; }

    choice(array) {
        if (!Array.isArray(array) || array.length === 0)
            throw new Error('RNG.choice(): пустой массив');
        return array[Math.floor(this._rand() * array.length)];
    }

    shuffle(array) {                       // Fisher–Yates (мутирует array!)
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this._rand() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

//----------------------------------------------------------------------------|
// class Universe — навигация + детерминированная деривация сидов
//----------------------------------------------------------------------------|
class Universe
{
    #seedRoot;
    #amountGalaxy;
    #indexGalaxy;
    #indexStar;
    #restored;

    constructor(sseed = SEED_ROOT_DEFAULT, amount = AMOUNT_GALAXY_DEFAULT) {
        this.load(sseed, amount);       // 1) дефолт: вселенная от seed, курсор (0, 0)
        this.#restore(sseed, amount);   // 2) есть валидный сейв → он перекрывает дефолт
    }

    get seedRoot()     { return this.#seedRoot; }
    get amountGalaxy() { return this.#amountGalaxy; }

    /** Позиция курсора — только для чтения. Навигация: goToGalaxy() / goToStar(). */
    get indexGalaxy() { return this.#indexGalaxy; }
    get indexStar()   { return this.#indexStar; }

    /** true — состояние взято из сейва; false — сгенерировано с нуля. */
    get restored()     { return this.#restored; }

    load(sseed, amount = AMOUNT_GALAXY_DEFAULT) {
        if (!Number.isInteger(amount) || amount <= 0)
            throw new RangeError('amount: требуется целое > 0');
        this.#seedRoot     = sseed;
        this.#amountGalaxy = amount;
        this.#indexGalaxy  = 0;
        this.#indexStar    = 0;
        this.#restored     = false;
    }

    goToGalaxy(i) {
        this.#checkGalaxy(i);
        this.#indexGalaxy = i;
        this.#indexStar   = 0;   // смена галактики сбрасывает курсор звёзд
    }

    /** Навигация внутри ТЕКУЩЕЙ галактики: i проверяется по M этой галактики. */
    goToStar(i) {
        this.#checkStar(i);
        this.#indexStar = i;
    }

    /** Детерминированный сид галактики (uint32). */
    getGalaxySeed(i) {
        this.#checkGalaxy(i);
        return mix32(hashCombine(this.#seedRoot, i));
    }

    getGalaxyRng(i) { return new RNG(this.getGalaxySeed(i)); }

    /** M — число звёзд, детерминированно из сида галактики (отдельный подпоток). */
    getStarCount(i) {
        return new RNG(mix32(hashCombine(this.getGalaxySeed(i), 'count')))
            .int(STARS_MIN, STARS_MAX);
    }

    /** Детерминированный сид звезды: seedGalaxy + индекс звезды. */
    getStarSeed(gi, si) {
        this.#checkStarIn(gi, si);
        return mix32(hashCombine(this.getGalaxySeed(gi), si));
    }

    getStarRng(gi, si) { return new RNG(this.getStarSeed(gi, si)); }

    //--- приватные проверки --------------------------------------------------

    #checkGalaxy(i) {
        if (!Number.isInteger(i) || i < 0 || i >= this.#amountGalaxy)
            throw new RangeError(`galaxyIndex ${i} вне [0, ${this.#amountGalaxy})`);
    }

    /** Проверка звезды в произвольной галактике (общая для getStarSeed/goToStar). */
    #checkStarIn(gi, si) {
        this.#checkGalaxy(gi);
        const m = this.getStarCount(gi);
        if (!Number.isInteger(si) || si < 0 || si >= m)
            throw new RangeError(`starIndex ${si} вне [0, ${m})`);
    }

    /** Проверка звезды относительно текущего положения курсора. */
    #checkStar(i) { this.#checkStarIn(this.#indexGalaxy, i); }

    //--------------------------------------------------------------------------

    /**
     * Пытается подхватить сейв. НАРУЖУ НЕ БРОСАЕТ НИКОГДА:
     *   - localStorage нет (Node) / приватный режим / битый JSON → дефолт;
     *   - сейв не прошёл валидацию → дефолт (fallbackSeed/fallbackAmount).
     * Валидный сейв перекрывает и seed, и amount, и позицию курсора.
     */
    #restore(fallbackSeed, fallbackAmount) {
        let d = null;
        try {
            if (typeof localStorage !== 'undefined')    // в Node/тестах — просто дефолт
                d = JSON.parse(localStorage.getItem(SAVE_KEY_DEFAULT) || 'null');
        } catch { d = null; }                           // квота / приватный режим / битый JSON

        if (!d || d.v !== SAVE_FORMAT_VERSION) return;  // сейва нет → дефолт

        try {
            this.load(d.seedRoot, d.amount);            // проверит amount
            this.goToGalaxy(d.indexGalaxy);             // проверит индекс галактики
            this.goToStar(d.indexStar);                 // проверит индекс звезды (по M сохранённой галактики)
            this.#restored = true;
        } catch {
            this.load(fallbackSeed, fallbackAmount);    // битый сейв → дефолт конструктора
        }
    }

    /** В localStorage — только то, что нельзя сгенерировать. */
    save(key = SAVE_KEY_DEFAULT) {
        const data = {
            v: SAVE_FORMAT_VERSION,      // версия формата — на будущее
            seedRoot: this.#seedRoot,    // если сид вводится игроком
            amount: this.#amountGalaxy,  // если фиксирован — можно не хранить
            indexGalaxy: this.#indexGalaxy,
            indexStar:   this.#indexStar,
        };
        try { localStorage.setItem(key, JSON.stringify(data)); }
        catch (e) { console.warn('Universe.save():', e); } // приватный режим / квота
    }

    /** «Новая игра»: стереть сейв ПЕРЕД new Universe(seed). */
    static removeSave(key = SAVE_KEY_DEFAULT) {
        try {
            if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
        } catch (e) { console.warn('Universe.removeSave():', e); }
    }
}

//----------------------------------------------------------------------------|
// Экспорт: один неймспейс, ничего не перезаписывается
//----------------------------------------------------------------------------|
const UniverseJS = { Universe, RNG, utils: { toUint32, hashCombine, mix32, mulberry32 } };

if (typeof module !== 'undefined' && module.exports)
{   module.exports = UniverseJS;
} else if (typeof window !== 'undefined')
{   window.UniverseJS = UniverseJS; // const U = new UniverseJS.Universe(seed);
}


// Как пользоваться:

// const U = new UniverseJS.Universe(seed);
// // сейва нет  → вселенная от seed, курсор (0, 0)
// // сейв есть  → та же вселенная и та же позиция, что в сейве

// if (U.restored) { /* показать «Продолжить игру» */ }

// U.goToGalaxy(3); U.goToStar(42);
// U.save();   // сохранение по-прежнему явное

// // Кнопка «Новая игра»:
// UniverseJS.Universe.removeSave();
// const U2 = new UniverseJS.Universe(newSeed);