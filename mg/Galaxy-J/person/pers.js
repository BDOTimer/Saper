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

class Pers
{
    constructor(options = {})
    {
        this.name = "?name";

        // --- Метрики игрока ---
        this.credits   = options.credits   ?? 1000;
        this.kills     = options.kills     ?? 0;
        this.sector    = options.sector    ?? { x: 0, y: 0 };

        // --- Навигация ---
        this.indexGalaxy = options.indexGalaxy ?? 0;
        this.indexStar   = options.indexStar   ?? 0;
        this.seedGalaxy  = -1;
        this.seedStar    = -1;

        this.dataStar    = options.dataStar    ?? null;

        // --- Жизненный статус ---
        this.dead      = options.dead      ?? false;

        // Загрузка профиля (пока заглушка)
        this.load();
    }

    load()
    {
        // TODO: подключить profile-store.js
        // Пока ничего не делаем — используются значения из конструктора.
    }

    save()
    {
        // TODO: подключить profile-store.js
    }

    /// Сброс метрик игрока после смерти / рестарта
    reset()
    {
        this.kills  = 0;
        this.dead   = false;
        // credits сохраняем — это накопление игрока
    }

    toJSON()
    {   return {
            indexGalaxy: this.indexGalaxy,
            indexStar  : this.indexStar,
            seedGalaxy : this.seedGalaxy,
            seedStar   : this.seedStar,
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

        this.indexGalaxy = ig;
        this.indexStar   = is;
        this.seedGalaxy  = sg;
        this.seedStar    = ss;

        return true;
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Pers;
} else {
    window.Pers = Pers;
}