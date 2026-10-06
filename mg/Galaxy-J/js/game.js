/// game.js
/// Инкапсулирует игровую сессию (мир).
/// Держит внутри себя игрока (Pers) и корабль (Ship),
/// а также то, что не принадлежит ни одному из них:
///     - гиперпрыжок,
///     - коллекции врагов / лазеров / планет,
///     - текущее светило системы.
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
///     - reset() — рестарт сессии (игрок + корабль + гиперпрыжок).

class Game
{
    constructor(options = {})
    {
        // --- Игрок ---
        this.pers = options.pers ?? new Pers(options.persOptions);

        // --- Корабль ---
        this.ship = options.ship ?? new Ship(options.shipOptions);

        // --- Гиперпрыжок ---
        this.hyper = options.hyper ?? {
            active:  false,
            t:           0,  // прошло секунд
            duration:    6,  // длительность анимации
            targetIdx:  -1,  // куда прыгаем
            fuelCost:    0,  // сколько топлива спишет
        };

        // --- Мир / сцена (логические коллекции, без THREE) ---
        this.enemies = [];      // враги
        this.lasers  = [];      // лазеры
        this.planets = [];      // планеты текущей системы

        // --- Текущее светило системы ---
        this.currentStarHandle    = null;
        this.currentStationHandle = null;

        // --- Флаги сессии ---
        this.isDocked = false;

        // Загрузка профиля (пока заглушка)
        this.load();
    }

    load()
    {
        // TODO: подключить profile-store.js
        // Пример будущего:
        this.pers.load();
        this.ship.load();
        //   this.hyper = saved.hyper ?? this.hyper;
    }

    save()
    {
        // TODO: подключить profile-store.js
        // Пример будущего:
        this.pers.save();
        this.ship.save();
    }

    /// Полный рестарт сессии (без пересоздания объектов)
    reset()
    {
        this.pers.reset();
        this.ship.reset();

        this.hyper.active    = false;
        this.hyper.t         = 0;
        this.hyper.targetIdx = -1;
        this.hyper.fuelCost  = 0;

        this.enemies.length = 0;
        this.lasers.length  = 0;
        // planets / currentStarHandle / currentStationHandle
        // сбрасываются отдельно, через clearSystem() в g-start-loop.html

        this.isDocked = false;
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Game;
} else {
    window.Game = Game;
}