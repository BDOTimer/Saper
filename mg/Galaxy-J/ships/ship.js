/// ship.js
/// Инкапсулирует все состояния корабля (корпус, физика, ресурсы).
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
///     - reset() — сброс ресурсов и физики (без тюнинга).

class Ship
{
    constructor(options = {})
    {
        // --- Пределы ---
        this.SHIELDMAX = options.SHIELDMAX ?? 100;

        // --- Ресурсы ---
        this.shield = options.shield ?? this.SHIELDMAX;
        this.fuel   = options.fuel   ?? 100;

        // --- Движение ---
        this.speed    = options.speed    ?? 0;
        this.maxSpeed = options.maxSpeed ?? 120;
        this.minSpeed = options.minSpeed ?? -20;

        // --- Угловые скорости (рад/сек) ---
        this.angVel = options.angVel ?? { pitch: 0, yaw: 0, roll: 0 };

        // --- Тюнинг «педали тяги» ---
        this.THR = options.THR ?? {
            accel: 6,    // ед/с²  — разгон при удержании клавиши
            brake: 0.3,  // 1/с    — торможение при отпущенной клавише
            drag:  0.1,  // 1/с    — лёгкое сопротивление при активной тяге
        };

        // --- Тюнинг вращения ---
        this.ROT = options.ROT ?? {
            accel:    3.2,  // рад/с²
            damping:  2.6,  // 1/с
            maxPitch: 1.2,  // рад/с
            maxYaw:   1.1,  // рад/с
            maxRoll:  1.6,  // рад/с
        };

        // --- Тюнинг расхода топлива ---
        this.TUNING = options.TUNING ?? {
            fuel_rate:      0,     // топливо/сек на единицу скорости
            fuel_hyper:     0,     // топлива на 1.0 расстояния между звёздами
            fuel_hyper_min: 5,     // минимум, чтобы стартовать гиперпрыжок
        };

        // Загрузка профиля (пока заглушка)
        this.load();
    }

    load()
    {
        // TODO: подключить profile-store.js
    }

    save()
    {
        // TODO: подключить profile-store.js
    }

    /// Сброс ресурсов и физики (тюнинг не трогаем)
    reset()
    {
        this.speed  = 0;
        this.shield = this.SHIELDMAX;
        this.fuel   = 100;

        this.angVel.pitch = 0;
        this.angVel.yaw   = 0;
        this.angVel.roll  = 0;
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Ship;
} else {
    window.Ship = Ship;
}