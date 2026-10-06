/// pers.js
/// Инкапсулирует все состояния игрока (профиль/метрики).
/// Используется в модуле g-start-loop.html.
/// ---
/// Хранение:
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
        this.starIndex = options.starIndex ?? 0;
        this.dataStar  = options.dataStar  ?? null;

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
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Pers;
} else {
    window.Pers = Pers;
}