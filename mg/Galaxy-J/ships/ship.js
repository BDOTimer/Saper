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

// Тяжёлый грузовик — долгий разгон, долгое торможение
// const ROT = { accel: 1.6, damping: 0.9, maxPitch: 0.7, maxYaw: 0.6, maxRoll: 0.9 };

// Истребитель — быстро реагирует, быстро гаснет
// const ROT = { accel: 6.0, damping: 5.0, maxPitch: 1.8, maxYaw: 1.6, maxRoll: 2.4 };

// Текущий «средний» вариант
// const ROT = { accel: 3.2, damping: 2.6, maxPitch: 1.2, maxYaw: 1.1, maxRoll: 1.6 };


// Тяжёлый корабль — долгий разгон, длинный выбег
// const THR = { accel: 90,  brake: 0.8, drag: 0.3 };

// Аркадный истребитель — быстрый отклик, короткий выбег
// const THR = { accel: 320, brake: 4.0, drag: 0.6 };

// Средний
// const THR = { accel: 180, brake: 1.8, drag: 0.4 };

class Ship
{
    constructor(options = {})
    {
        // --- Пределы ---
        this.SHIELDMAX = options.SHIELDMAX ?? 100;

        // --- Трюм ---
        this.cargo = new CargoA();

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
            fuel_rate:  0.001,  // топливо/сек на единицу скорости
            fuel_hyper:    10,  // топлива на 1.0 расстояния между звёздами
            fuel_hyper_min: 5,  // минимум, чтобы стартовать гиперпрыжок
        };

        if(!Settings.isSpawnEnemies)
        {   this.TUNING.fuel_rate  = 0;
            this.TUNING.fuel_hyper = 0;
        }

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

    // ----------------------------------------------------
    //  Корабль игрока
    // ----------------------------------------------------
    makePlayerShip()
    {   const group = new THREE.Group();
        const body  = new THREE.Mesh(
          new THREE.ConeGeometry(6, 22, 8),
          new THREE.MeshStandardMaterial({
            color: 0x337744,
            metalness: 0.7,
            roughness: 0.4,
          }),
        );
        body.rotation.x = Math.PI / 2;
        body.position.z = -8;
        group.add(body);

        const wing = new THREE.Mesh(
          new THREE.BoxGeometry(20, 1, 6),
          new THREE.MeshStandardMaterial({
            color: 0x446633,
            metalness: 0.8,
            roughness: 0.5,
          }),
        );
        wing.position.z = 2;
        group.add(wing);

        const cockpit = new THREE.Mesh(
          new THREE.SphereGeometry(3, 12, 8),
          new THREE.MeshStandardMaterial({
            color: 0x227711, /// 🍈
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0x223311, /// 🍈
            emissiveIntensity: 0.6,
          }),
        );
        cockpit.position.set(0, 2, -4);
        cockpit.scale.set(1, 0.7, 1.6);
        group.add(cockpit);

        const engMat = new THREE.MeshBasicMaterial({
          color: 0x666666,
          toneMapped: false,
        });
        const eng1 = new THREE.Mesh(
          new THREE.CylinderGeometry(2, 2.5, 3, 12),
          engMat,
        );
        eng1.rotation.x = Math.PI / 2;
        eng1.position.set(-5, 0, 8);
        group.add(eng1);
        const eng2 = eng1.clone();
        eng2.position.x = 5;
        group.add(eng2);

        const muzzleMat = new THREE.MeshBasicMaterial({
          color: 0x666666,
          toneMapped: false,
          transparent: true,
          opacity: 0,
        });
        const muzzle1 = new THREE.Mesh(
          new THREE.SphereGeometry(1.6, 8, 8),
          muzzleMat.clone(),
        );
        muzzle1.position.set(-8, 0, 0);
        group.add(muzzle1);
        const muzzle2 = muzzle1.clone();
        muzzle2.position.x = 8;
        group.add(muzzle2);

        group.userData.engines = [eng1, eng2];
        group.userData.muzzles = [muzzle1, muzzle2];
        return group;
    }

    // ship.cargo.connect(TRADE);   // == TRADE.connectCargo(ship.cargo)
    // ship.cargo.disconnect();     // == TRADE.disconnectCargo(ship.cargo)
    // Подключаемся к Trade
    tradeOn(star, credits)
    {
      TRADE.introStation(star);             // рынок под звезду (можно один раз при генерации системы)
      TRADE.dock(this.cargo, credits); // подключить отсек + открыть терминал
    }

    // Отключаемся к Trade
    tradeOut()
    {
      this.credits = TRADE.getCredits();    // или через TRADE.setOnCreditsChanged(fn)
      TRADE.undock();                       // закрыть терминал + отключить отсек 
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Ship;
} else {
    window.Ship = Ship;
}