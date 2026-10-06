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
///     - pers / ship — сохраняются через ProfileStore в поле save активного профиля.
/// ---
/// События:
///     - (пока нет)
/// ---
/// Поведение:
///     - load()/save() — работа с ProfileStore.
///     - reset() — рестарт сессии (игрок + корабль + гиперпрыжок).
///

const SAVE_FORMAT_VERSION = 1;   // версия формата save-поля профиля

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

        // Загрузка профиля (pers + ship)
        this.load();
    }

    // ------------------------------------------------------------
    //  SNAPSHOT — то, что уходит в ProfileStore.save
    // ------------------------------------------------------------
    /**
     * Собрать снимок сохраняемых полей.
     * Специально НЕ включает:
     *     - universe — она хранится сама (Universe.save());
     *     - hyper / enemies / lasers / planets — мгновенное состояние сессии;
     *     - currentStarHandle / currentStationHandle — THREE-объекты;
     *     - angVel — сбрасывается в 0 при загрузке.
     */
    _snapshot()
    {
        return {
            v: SAVE_FORMAT_VERSION,
            pers: {
                credits:   this.pers.credits,
                kills:     this.pers.kills,
                sector:    { ...this.pers.sector },
                starIndex: this.pers.starIndex,
                dead:      this.pers.dead,
            },
            ship: {
                shield: this.ship.shield,
                fuel:   this.ship.fuel,
                speed:  this.ship.speed,
            },
        };
    }

    /**
     * Восстановить pers / ship из снимка.
     * Не падает на частично битом сейве — просто игнорирует недостающие поля.
     */
    _restore(saveData)
    {
        if (!saveData || typeof saveData !== "object") return;
        if (saveData.v !== SAVE_FORMAT_VERSION) return;

        const p = saveData.pers || {};
        const s = saveData.ship || {};

        // --- pers ---
        if (typeof p.credits   === "number") this.pers.credits   = p.credits;
        if (typeof p.kills     === "number") this.pers.kills     = p.kills;
        if (p.sector && typeof p.sector === "object") {
            this.pers.sector = {
                x: Number(p.sector.x) || 0,
                y: Number(p.sector.y) || 0,
            };
        }
        if (typeof p.starIndex === "number") this.pers.starIndex = p.starIndex;
        if (typeof p.dead      === "boolean") this.pers.dead     = p.dead;

        // --- ship ---
        if (typeof s.shield === "number") this.ship.shield = s.shield;
        if (typeof s.fuel   === "number") this.ship.fuel   = s.fuel;
        if (typeof s.speed  === "number") this.ship.speed  = s.speed;

        // angVel после загрузки — всегда чистый, чтобы не «докручивало»
        this.ship.angVel.pitch = 0;
        this.ship.angVel.yaw   = 0;
        this.ship.angVel.roll  = 0;
    }

    // ------------------------------------------------------------
    //  LOAD / SAVE через ProfileStore
    // ------------------------------------------------------------
    load()
    {
        // ProfileStore может быть не подключён (например, юнит-тест Game).
        if (typeof ProfileStore === "undefined") return;

        const profile = ProfileStore.current();
        if (!profile || !profile.save) return;

        this._restore(profile.save);
    }

    save()
    {
        // 1. Вселенная — своим ключом (localStorage: "universe.save").
        if (this.universe && typeof this.universe.save === "function") {
            this.universe.save();
        }

        // 2. pers + ship — в активный профиль через ProfileStore.
        if (typeof ProfileStore !== "undefined") {
            const profile = ProfileStore.current();
            if (profile && profile.id) {
                ProfileStore.saveGame(profile.id, this._snapshot());
            }
        }
    }

    // ------------------------------------------------------------
    //  Полный рестарт сессии (без пересоздания объектов)
    // ------------------------------------------------------------
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