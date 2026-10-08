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
    static SAVE_FORMAT_VERSION = 1;

    constructor(options = {})
    {

        // Universe создаётся «чистым» — реальный seed/amount могут быть
        // перезаписаны в this.load(), когда подтянем save из профиля.
        this.universe = options.universe ?? new UniverseJS.Universe(
            options.seedRoot ?? 2026,
        );

        this.pers = options.pers ?? new Pers({
            ...(options.shipOptions || {}),
            universe: this.universe
        });

        this.ship = options.ship ?? new Ship(options.shipOptions);

        this.hyper = options.hyper ?? {
            active:    false,
            t:         0,
            duration:  2.2,
            targetIdx: -1,
            fuelCost:  0,
        };

        this.enemies = [];
        this.lasers  = [];
        this.planets = [];

        this.currentStarHandle    = null;
        this.currentStationHandle = null;
        this.isDock = false;

        // Заполняется снаружи — из g-start-loop.html через game.world = {...}
        this.world = null;

        // Загрузка профиля (pers + ship + universe)
        this.load();

        this._restoreCamera();
        this._setupRender  ();
    }

    // ------------------------------------------------------------
    //  SNAPSHOT — единый снимок: pers + ship + universe
    // ------------------------------------------------------------
    _snapshot()
    {
        return {
            v: Game.SAVE_FORMAT_VERSION,
            pers: {
                credits: this.pers.credits,
                kills  : this.pers.kills,
                sector : { ...this.pers.sector },
                dead   : this.pers.dead,
                isDock : this.isDock,
            },
            ship: {
                shield: this.ship.shield,
                fuel  : this.ship.fuel,
                speed : this.ship.speed,
            },

            // Навигация Перса
            nav: this.pers.toJSON(),

            // ★ Всё состояние вселенной — одной вложенной структурой
            universe: this.universe.toJSON(),
            world   : this.world ?? null,
        };
    }

    _restore(saveData)
    {
        if (!saveData || typeof saveData !== "object") return;
        if (saveData.v !== Game.SAVE_FORMAT_VERSION) return;

        const p  = saveData.pers  || {};
        const s  = saveData.ship  || {};
        const u  = saveData.universe || null;
        const n  = saveData.nav      || null;

        // --- pers ---
        if (typeof p.credits === "number") this.pers.credits = p.credits;
        if (typeof p.kills   === "number") this.pers.kills   = p.kills;
        if (p.sector && typeof p.sector === "object") {
            this.pers.sector = {
                x: Number(p.sector.x) || 0,
                y: Number(p.sector.y) || 0,
            };
        }
        if (typeof p.dead   === "boolean") this.pers.dead = p.dead;
        if (typeof p.isDock === "boolean") this.isDock    = p.isDock;

        // --- ship ---
        if (typeof s.shield === "number") this.ship.shield = s.shield;
        if (typeof s.fuel   === "number") this.ship.fuel   = s.fuel;
        if (typeof s.speed  === "number") this.ship.speed  = s.speed;

        this.ship.angVel.pitch = 0;
        this.ship.angVel.yaw   = 0;
        this.ship.angVel.roll  = 0;

        // --- universe ---
        // fromJSON сам перепроверит и не бросит наружу;
        // если снимок битый — останется текущее (дефолтное) состояние.
        if (u && typeof this.universe.fromJSON === "function") {
            this.universe.fromJSON(u);

            // После восстановления курсора синхронизируем pers.starIndex,
            // чтобы g-start-loop.html сразу знал, где игрок.
            this.universe.starIndex = this.universe.indexStar;
        }

        // --- Nav ---
        if (n)
        {   this.pers.fromJSON(n);
        }

        // --- world ---
        if (saveData.world && typeof saveData.world === "object")
        {   this.world = saveData.world;
            // if (typeof saveData.world.isDock === "boolean") {
            //     this.isDock = saveData.world.isDock;
            // }
        }
    }

    load()
    {
        if (typeof ProfileStore === "undefined") return;

        const profile = ProfileStore.current();
        if (!profile || !profile.save) return;

        this.pers.name = profile.name;

        this._restore(profile.save);
    }

    save()
    {
        if (typeof ProfileStore === "undefined")
        {   console.assert(ProfileStore === null, 
                `🔴 typeof ProfileStore === "undefined"`);
            return;
        }

        const profile = ProfileStore.current();
        if (profile && profile.id) {
            ProfileStore.saveGame(profile.id, this._snapshot());
        }
        // ★ Ушло: this.universe.save() — теперь всё через ProfileStore
    }

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

        this.isDock = false;
    }

    /// «Новая игра»: стереть save активного профиля.
    /// Сама вселенная пересоздаётся вызывающим кодом (см. ниже).
    static newGame()
    {
        if (typeof ProfileStore !== "undefined") {
            const profile = ProfileStore.current();
            if (profile) ProfileStore.resetGame(profile.id);
        }
    }

    _restoreCamera()
    {   this.camera = new THREE.PerspectiveCamera(
            75,
            innerWidth / innerHeight,
            0.1,
            20000,
        );

        // ★ Восстановление позы корабля из сохранения
        if (this.world)
        {   const p = this.world.pos;
            if (p) {
                this.camera.position.set(
                    Number(p.x) || 0,
                    Number(p.y) || 0,
                    Number(p.z) || 0,
                );
            }
            const q = this.world.quat;
            if (q)
            {   this.camera.quaternion.set(
                    Number(q.x) || 0,
                    Number(q.y) || 0,
                    Number(q.z) || 0,
                    Number(q.w) || 1,   // w по умолчанию 1 — «нет поворота»
                );
            }
        }
    }

    // ----------------------------------------------------
    //  Сборка снимка мира для сохранения
    // ----------------------------------------------------
    buildWorldSnapshot()
    {   return {
            // Поза корабля = поза камеры (камера — «мозг» игрока)
            pos: {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z,
            },
            quat: {
                x: this.camera.quaternion.x,
                y: this.camera.quaternion.y,
                z: this.camera.quaternion.z,
                w: this.camera.quaternion.w,
            },
        };
    }

    _setupRender()
    {   const r = new THREE.WebGLRenderer({
        antialias: true
        //,logarithmicDepthBuffer: true
        });

        r.setSize(innerWidth, innerHeight);
        r.setPixelRatio(Math.min(devicePixelRatio, 2));
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.1;
        document.body.appendChild(r.domElement);

        this.renderer = r;
    }
}

class CameraFar
{
    constructor(camera, ship, planets)
    {
        this.camera  = camera;
        this.ship    = ship;    // объект с .position (THREE.Vector3)
        this.planets = planets; // массив объектов с .position

        this.clock = new THREE.Clock();
        this.farUpdateTimer = 0;
        this.checkInterval  = 1.0; // секунды
        this.minFar = 7000;
        this.margin = 1.2;

        this.seconds = 0;
    }

    /*
     * Вызывать один раз в кадре (из основного animate)
     */
    update(dt)
    {   
    //  const dt = this.clock.getDelta();
        this.farUpdateTimer += dt;

        if (this.farUpdateTimer >= this.checkInterval)
        {   this.farUpdateTimer -= this.checkInterval;
        //  this._recalculateFar();
            this._zoomInStar();
            this.seconds++;
        }
    }

    _recalculateFar()
    {
        const positionShip = this.ship.position;
        let maxVisible = 0;

        // 1. Считаем самую дальнюю планету
        for (const p of this.planets) {
            const d = positionShip.distanceTo(p.position);
            if (d > maxVisible) maxVisible = d;
        }

        // 2. Учитываем звезду в (0, 0, 0)
        const distToStar = positionShip.length(); // это distanceTo(new THREE.Vector3(0,0,0))
        if (distToStar > maxVisible) {
            maxVisible = distToStar;
        }

        this.camera.far = Math.max(maxVisible * this.margin, this.minFar);
        this.camera.updateProjectionMatrix();
    }

    _zoomInStar()
    {
        const positionShip = this.ship.position;

        const distToStar = positionShip.length();
        const maxOrbit   = 8000;  // радиус орбиты самой дальней планеты

        // Самый дальний объект, который может быть виден:
        // планета на противоположной от корабля стороне звезды
        const maxVisible = distToStar + maxOrbit;

        this.camera.far = Math.max(maxVisible * this.margin, this.minFar);
        this.camera.updateProjectionMatrix();
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Game;
    module.exports = CameraFar;
} else {
    window.Game    = Game;
    window.exports = CameraFar;
}

// Итоговая схема хранения:
// localStorage
//  ├── "galaxy.profiles"          ← список id профилей
//  ├── "galaxy.currentProfile"    ← активный id
//  └── "galaxy.profile.p_xxx"     ← сам профиль:
//          {
//              id, name, created, lastPlayed,
//              save: {                     ← ВСЁ в одном save
//                  v: 1,
//                  pers:     { credits, kills, sector, dead },
//                  ship:     { shield, fuel, speed },
//                  universe: { seedRoot, amount, indexGalaxy, indexStar }
//              },
//              stats: { score, rank }
//          }

// // 1. Убедимся, что чистого localStorage от Universe больше нет
// console.log(localStorage.getItem("universe.save"));  // ожидаем null

// // 2. Что видит игра
// console.log("universe.seedRoot  =", GAME.universe.seedRoot);
// console.log("universe.indexStar =", GAME.universe.indexStar);
// console.log("pers.credits       =", GAME.pers.credits);

// // 3. Поменяем состояние
// GAME.pers.credits = 5555;
// GAME.universe.goToStar(3);

// // 4. Сохраним
// GAME.save();

// // 5. Проверим, что save лёг в профиль целиком
// console.dir(ProfileStore.current().save, { depth: null });

// // 6. F5

// // 7. После перезагрузки:
// console.log("pers.credits       =", GAME.pers.credits);       // 5555
// console.log("universe.indexStar =", GAME.universe.indexStar); // 3
// console.log("pers.starIndex     =", GAME.pers.starIndex);     // 3 (синхронизирован)