/// game.js
/// Инкапсулирует игровую сессию (мир).
/// Держит внутри себя вселенную (UniverseJS.Universe),
/// игрока (Pers) и корабль (Ship), а также:
///     - гиперпрыжок,
///     - коллекции врагов / лазеров / планет,
///     - текущее светило системы.
/// Используется в модуле g-start-loop.html.
/// ---
/// Хранение:
///     - Вселенная хранит себя сама через Universe.save() (localStorage).
///     - pers / ship — заглушки load()/save() под будущий profile-store.js.
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

        // --- Вселенная ---
        // Если universe не передан — создаём сами от seedRoot.
        // Universe сам подхватит сейв из localStorage, если он есть.
        this.universe = options.universe ?? new UniverseJS.Universe(
            options.seedRoot ?? 2026,
        );

        // --- Гиперпрыжок ---
        this.hyper = options.hyper ?? {
            active:    false,
            t:         0,
            duration:  2.2,
            targetIdx: -1,
            fuelCost:  0,
        };

        // --- Мир / сцена (логические коллекции, без THREE) ---
        this.enemies = [];
        this.lasers  = [];
        this.planets = [];

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
        //   this.pers.load();
        //   this.ship.load();
        // Universe уже сам восстановился в конструкторе (this.universe.restored).
    }

    save()
    {
        // TODO: подключить profile-store.js
        //   this.pers.save();
        //   this.ship.save();
        this.universe.save();   // вселенная сохраняется всегда
    }

    /// Полный рестарт сессии (без пересоздания объектов)
    reset()
    {
        this.pers.reset();
        this.ship.reset();

        this.hyper.active    = false;
        this.hyper.t         =  0;
        this.hyper.targetIdx = -1;
        this.hyper.fuelCost  =  0;

        this.enemies.length = 0;
        this.lasers.length  = 0;

        this.isDocked = false;

        // Вселенную НЕ трогаем — игрок просто респавнится в текущей системе.
        // Для «Новой игры» вызывающий код должен явно сделать:
        //   UniverseJS.Universe.removeSave();
        //   game.universe = new UniverseJS.Universe(newSeed);
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Game;
} else {
    window.Game = Game;
}