/// pers.js
/// Инкапсулирует все состояния игрока (профиль/метрики).
/// Используется в модуле g-start-loop.html.
/// ---
/// Хранение:
///     - Перс находиться в {indexGalaxy, indexStar} 🔔
///     - Загрузка важных данных в/из профиля [profile-store.js] — позже.
///     - Пока: значения по умолчанию в конструкторе.
/// ---
/// События:
///     - (пока нет)
/// ---
/// Поведение:
///     - load()/save() — заглушки для будущей интеграции с profile-store.
///     - Доступ из любой точки игры = GAME.pers.indexGalaxy / GAME.pers.indexStar (через get).

const RANKS = [
  "HARMLESS",
  "MOSTLY_HARMLESS",
  "POOR",
  "AVERAGE",
  "COMPETENT",
  "DANGEROUS",
  "DEADLY",
  "ELITE",
];

class Pers
{
    // Приватные поля
    #indexGalaxy;
    #indexStar;
    #seedGalaxy;
    #seedStar;

    constructor(options = {})
    {
        this.name = "?name";

        const u = options.universe ?? null; this.universe = u;

        console.assert(u != null);

        // --- Метрики игрока ---
        this.credits   = options.credits   ?? 1000;
        this.kills     = options.kills     ?? 0;
        this.sector    = options.sector    ?? { x: 0, y: 0 };

        // --- Навигация (приватные) ---
        this.#indexGalaxy = options.indexGalaxy ?? 0;
        this.#indexStar   = options.indexStar   ?? 0;
        this.#seedGalaxy  = u.getGalaxySeed(this.#indexGalaxy);
        this.#seedStar    = u.getStarSeed  (this.#indexGalaxy, this.#indexStar);

        this.dataStar    = options.dataStar ?? null;

        // --- Жизненный статус ---
        this.dead = options.dead ?? false;
    }

    // --- Геттеры для приватных полей ---
    get indexGalaxy() { return this.#indexGalaxy; }
    get indexStar()   { return this.#indexStar; }
    get seedGalaxy()  { return this.#seedGalaxy; }
    get seedStar()    { return this.#seedStar; }

    getScore()
    {
        return this.kills;
    }

    /**
     * Определяет название ранга по количеству очков.
     * Индекс в массиве RANKS растёт вместе со счётом.
     *
     * @param {number} score - очки игрока (может быть отрицательным / NaN)
     * @returns {string} название ранга из RANKS
     */
    static getRankName(score)
    {
        // пороги очков для каждого ранга (по возрастанию)
        const THRESHOLDS = [0, 1000, 5000, 15000, 40000, 90000, 200000, 500000];

        const s = Number(score) || 0;

        // идём с конца: как только дошли до подходящего порога — вернули ранг
        for (let i = RANKS.length - 1; i >= 0; i--) {
            if (s >= THRESHOLDS[i]) return RANKS[i];
        }
        return RANKS[0];
    }

    // --- Сеттеры индексов (сиды пересчитываются автоматически) ---

    /// Установка индекса галактики. Пересчитывает seedGalaxy и seedStar.
    set indexGalaxy(i)
    {
        if (!Number.isInteger(i) || i < 0)
            throw new RangeError('indexGalaxy must be a non-negative integer');

        this.#indexGalaxy = i;
        this.#seedGalaxy  = this.universe.getGalaxySeed(i);
        this.#seedStar    = this.universe.getStarSeed(i, this.#indexStar);

        this.universe.go2Galaxy(i);
    }

    /// Установка индекса звезды. Пересчитывает seedStar.
    set indexStar(i)
    {
        if (!Number.isInteger(i) || i < 0)
            throw new RangeError('indexStar must be a non-negative integer');

        this.#indexStar = i;
        this.#seedStar  = this.universe.getStarSeed(this.#indexGalaxy, i);

        this.universe.go2Star(i);
    }

    /// Сброс метрик игрока после смерти / рестарта
    reset()
    {
        // this.kills  = 0;
        this.dead   = false;
        // credits сохраняем — это накопление игрока
    }

    toJSON()
    {
        return {
            indexGalaxy: this.#indexGalaxy,
            indexStar  : this.#indexStar,
            seedGalaxy : this.#seedGalaxy,
            seedStar   : this.#seedStar,
        };
    }

    fromJSON(data)
    {
        if (!data || typeof data !== 'object') return false;

        const ig = data.indexGalaxy;
        const is = data.indexStar;
        const sg = data.seedGalaxy;
        const ss = data.seedStar;

        if (!Number.isInteger(ig) || ig < 0 ||
            !Number.isInteger(is) || is < 0
        )   throw new RangeError('Storage error');

        this.#indexGalaxy = ig;
        this.#indexStar   = is;
        this.#seedGalaxy  = sg;
        this.#seedStar    = ss;

        return true;
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Pers;
} else {
    window.Pers = Pers;
}