//-----------------------------------------------------------------------------
// universe.js - детерминированная Вселенная: seedRoot → N галактик → M звёзд
// Вся Вселенная начинается от сюда!
// Особенности:
//      - universe.js без зависимостей!
//      - НЕ работает с localStorage — только чистые данные + генерация.
//      - Сохранение/восстановление — через toJSON() / fromJSON().
//        Их вызывает Game (а Game — уже через ProfileStore).
//-----------------------------------------------------------------------------|

const SEED_ROOT_DEFAULT     = 2026;
const AMOUNT_GALAXY_DEFAULT =  100;
const STARS_MIN = 50, STARS_MAX = 250;

//----------------------------------------------------------------------------|
// Чистые утилиты (без состояния — основа детерминизма)
//----------------------------------------------------------------------------|

/** number | string → uint32. Строки — djb2. */
function toUint32(value)
{
    if (typeof value === 'number') {
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
{
    const s = toUint32(seed), v = toUint32(value);
    return (s ^ (v + 0x9e3779b9 + (s << 6) + (s >>> 2))) >>> 0;
}

/** splitmix32-финализатор: лавинное смешивание производных сидов. */
function mix32(a)
{
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
}

/** Mulberry32 — быстрый детерминированный PRNG, [0, 1). */
function mulberry32(seed)
{
    let a = toUint32(seed);
    return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/// Случайные углы Эйлера (радианы), каждый в диапазоне [-π, π].
function RandVec3Rot(seed)
{
    const TWO_PI = Math.PI * 2;
    const s0 = toUint32(seed);
    const s1 = mix32(hashCombine(s0, 'x'));
    const s2 = mix32(hashCombine(s0, 'y'));
    const s3 = mix32(hashCombine(s0, 'z'));
    return {
        x: (s1 / 4294967296) * TWO_PI - Math.PI,
        y: (s2 / 4294967296) * TWO_PI - Math.PI,
        z: (s3 / 4294967296) * TWO_PI - Math.PI,
    };
}

//----------------------------------------------------------------------------|
// class RNG — обёртка над PRNG
//----------------------------------------------------------------------------|
class RNG
{
    constructor(seed) { this._rand = mulberry32(seed); }

    next()          { return this._rand(); }
    range(min, max) { return min + (max - min) * this._rand(); }
    int(min, max)   { return Math.floor(this.range(min, max + 1)); }
    chance(p)       { return this._rand() < p; }

    choice(array) {
        if (!Array.isArray(array) || array.length === 0)
            throw new Error('RNG.choice(): пустой массив');
        return array[Math.floor(this._rand() * array.length)];
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this._rand() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

//----------------------------------------------------------------------------|
// class Universe — навигация + детерминированная деривация сидов
// Состояние — чистые данные. Сохранение — через toJSON()/fromJSON().
//----------------------------------------------------------------------------|
class Universe
{
    #seedRoot;
    #amountGalaxy;
    #indexGalaxy;
    #indexStar;

    constructor(seed = SEED_ROOT_DEFAULT, amount = AMOUNT_GALAXY_DEFAULT)
    {
        this.load(seed, amount);
    }

    get seedRoot()     { return this.#seedRoot; }
    get amountGalaxy() { return this.#amountGalaxy; }
    get indexGalaxy()  { return this.#indexGalaxy; }
    get indexStar()    { return this.#indexStar; }

    load(seed, amount = AMOUNT_GALAXY_DEFAULT)
    {
        if (!Number.isInteger(amount) || amount <= 0)
            throw new RangeError('amount: требуется целое > 0');
        this.#seedRoot     = seed;
        this.#amountGalaxy = amount;
        this.#indexGalaxy  = 0;
        this.#indexStar    = 0;
    }

    go2Galaxy(i)
    {
        this.#checkGalaxy(i);
        this.#indexGalaxy = i;
        this.#indexStar   = 0;
    }

    go2Star(i)
    {   this.#checkStar(i);
        this.#indexStar = i;
    }

    getGalaxySeed(i)
    {   this.#checkGalaxy(i);
        return mix32(hashCombine(this.#seedRoot, i));
    }

    getGalaxyRng(i) { return new RNG(this.getGalaxySeed(i)); }

    getStarCount(i)
    {   return new RNG(mix32(hashCombine(this.getGalaxySeed(i), 'count')))
            .int(STARS_MIN, STARS_MAX);
    }

    getStarSeed(gi, si)
    {   this.#checkStarIn(gi, si);
        return mix32(hashCombine(this.getGalaxySeed(gi), si));
    }

    getStarRng(gi, si) { return new RNG(this.getStarSeed(gi, si)); }

    //--- приватные проверки --------------------------------------------------

    #checkGalaxy(i) {
        if (!Number.isInteger(i) || i < 0 || i >= this.#amountGalaxy)
            throw new RangeError(`galaxyIndex ${i} вне [0, ${this.#amountGalaxy})`);
    }

    #checkStarIn(gi, si) {
        this.#checkGalaxy(gi);
        const m = this.getStarCount(gi);
        if (!Number.isInteger(si) || si < 0 || si >= m)
            throw new RangeError(`starIndex ${si} вне [0, ${m})`);
    }

    #checkStar(i) { this.#checkStarIn(this.#indexGalaxy, i); }

    //--------------------------------------------------------------------------
    //  СЕРИАЛИЗАЦИЯ — для ProfileStore (через Game)
    //--------------------------------------------------------------------------

    /**
     * Снимок «того, что нельзя сгенерировать»:
     *   - seedRoot       (пользовательский сид)
     *   - amountGalaxy   (кол-во галактик)
     *   - indexGalaxy    (курсор)
     *   - indexStar      (курсор)
     * @return {object}
     */
    toJSON()
    {   return {
            seedRoot:    this.#seedRoot,
            amount:      this.#amountGalaxy,
        };
    }

    /**
     * Восстановить состояние из снимка.
     * НЕ бросает наружу: битый снимок → остаёмся с дефолтным состоянием,
     * выставленным в конструкторе или предыдущим load().
     * @param  {object|null} data
     */
    fromJSON(data)
    {
        if (!data || typeof data !== 'object') return false;

        // 1) Проверим seedRoot/amount — они должны пройти load()
        try {
            this.load(data.seedRoot, data.amount);
        } catch (e) {
            return false;
        }

        // // 2) Проверим курсоры через штатные переходы
        // try {
        //     this.goToGalaxy(data.indexGalaxy);
        //     this.goToStar(data.indexStar);
        // } catch (e) {
        //     // Битые индексы → откат к дефолтному состоянию конструктора
        //     this.load(data.seedRoot, data.amount);
        //     return false;
        // }

        return true;
    }
}

//----------------------------------------------------------------------------|
// Экспорт: один неймспейс, ничего не перезаписывается
//----------------------------------------------------------------------------|
const UniverseJS = {
    Universe,
    RNG,
    utils: { toUint32, hashCombine, mix32, mulberry32, RandVec3Rot },
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UniverseJS;
} else if (typeof window !== 'undefined') {
    window.UniverseJS = UniverseJS;
}

//----------------------------------------------------------------------------|
// Как пользоваться:
//
//     const U = new UniverseJS.Universe(seed);   // чистая вселенная, без localStorage
//     U.goToGalaxy(3); U.goToStar(42);
//
//     // Сохранение — через Game/ProfileStore:
//     const snap = U.toJSON();
//     ProfileStore.saveGame(profileId, { v: 1, universe: snap, pers: {...}, ship: {...} });
//
//     // Восстановление:
//     const save = ProfileStore.load(profileId).save;
//     const U2 = new UniverseJS.Universe(save.universe.seedRoot, save.universe.amount);
//     U2.fromJSON(save.universe);
//----------------------------------------------------------------------------|