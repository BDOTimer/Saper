//-----------------------------------------------------------------------------
// universe.js — детерминированная Вселенная: seedRoot → N галактик → M звёзд
//-----------------------------------------------------------------------------

const SEED_ROOT_DEFAULT         = 2026;
const AMOUNT_GALAXY_DEFAULT     =  100;
const STARS_MIN = 50, STARS_MAX =  250;

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

    shuffle(array) {                       // Fisher–Yates
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

    constructor(sseed = SEED_ROOT_DEFAULT, amount = AMOUNT_GALAXY_DEFAULT) {
        this.indexGalaxy = 0;
        this.indexStar   = 0;
        this.load(sseed, amount);
    }

    get seedRoot()     { return this.#seedRoot; }
    get amountGalaxy() { return this.#amountGalaxy; }

    load(sseed, amount = AMOUNT_GALAXY_DEFAULT) {
        if (!Number.isInteger(amount) || amount <= 0)
            throw new RangeError('amount: требуется целое > 0');
        this.#seedRoot     = sseed;
        this.#amountGalaxy = amount;
        this.indexGalaxy   = 0;
        this.indexStar     = 0;
    }

    goToGalaxy(i) {
        this._checkGalaxy(i);
        this.indexGalaxy = i;
        this.indexStar   = 0;   // смена галактики сбрасывает курсор звёзд
    }

    /** Детерминированный сид галактики (uint32). */
    getGalaxySeed(i) {
        this._checkGalaxy(i);
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
        this._checkGalaxy(gi);
        const m = this.getStarCount(gi);
        if (!Number.isInteger(si) || si < 0 || si >= m)
            throw new RangeError(`starIndex ${si} вне [0, ${m})`);
        return mix32(hashCombine(this.getGalaxySeed(gi), si));
    }

    getStarRng(gi, si) { return new RNG(this.getStarSeed(gi, si)); }

    _checkGalaxy(i) {
        if (!Number.isInteger(i) || i < 0 || i >= this.#amountGalaxy)
            throw new RangeError(`galaxyIndex ${i} вне [0, ${this.#amountGalaxy})`);
    }

    /** В localStorage — только то, что нельзя сгенерировать. */
    save(key = 'universe.save') {
        const data = {
            v: 1,                        // версия формата — на будущее
            seedRoot: this.#seedRoot,    // если сид вводится игроком
            amount: this.#amountGalaxy,  // если фиксирован — можно не хранить
            indexGalaxy: this.indexGalaxy,
            indexStar:   this.indexStar,
        };
        try { localStorage.setItem(key, JSON.stringify(data)); }
        catch (e) { console.warn('Universe.save():', e); } // приватный режим / квота
    }

    static fromSave(key = 'universe.save') {
        try {
            const d = JSON.parse(localStorage.getItem(key) || 'null');
            if (!d || d.v !== 1) return null;
            const u = new Universe(d.seedRoot, d.amount);
            u.indexGalaxy = d.indexGalaxy;
            u.indexStar   = d.indexStar;
            return u;
        } catch { return null; }
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