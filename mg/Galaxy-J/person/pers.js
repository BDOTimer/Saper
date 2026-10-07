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
        // --- Метрики игрока ---
        this.credits   = options.credits   ?? 1000;
        this.kills     = options.kills     ?? 0;
        this.sector    = options.sector    ?? { x: 0, y: 0 };

        // --- Навигация ---
        this.indexGalaxy = options.indexGalaxy ?? 0;
        this.indexStar   = options.indexStar   ?? 0;
        this.dataStar    = options.dataStar    ?? null;

        // --- Жизненный статус ---
        this.dead      = options.dead      ?? false;

        // Загрузка профиля (пока заглушка)
        this.load();

        console.log("🚩 Имя перса: ", this.name);
    }

    load()
    {
        // TODO: подключить profile-store.js
        // Пока ничего не делаем — используются значения из конструктора.

        // Загрузим имя игрока в программу из localStorage
        this.name = Pers.resolveName();
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

    /// Имя игрока: активный профиль → дефолт → константа
    static resolveName()
    {
        const fallback = (typeof NAME_PLAYER_DEFAULT !== "undefined")
            ? NAME_PLAYER_DEFAULT
            : "?noname";

        try {
            if (typeof ProfileStore !== "undefined") {
                const profile = ProfileStore.ensure();   // гарантирует профиль
                const n = profile && profile.name;
                if (typeof n === "string" && n.trim()) return n.trim();
            }
        } catch (e) {
            console.warn("Pers: ProfileStore недоступен:", e);
        }
        return fallback;
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Pers;
} else {
    window.Pers = Pers;
}