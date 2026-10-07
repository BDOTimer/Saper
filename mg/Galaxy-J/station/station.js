// station.js — космическая станция для Elite-подобной игры
// Зависимости: THREE должен быть доступен глобально (window.THREE).
//
// Публичное API:
//   const handle = new Station(star, opts);
//   handle.group                     // THREE.Group — вся станция
//   handle.params                    // вычисленные параметры
//   handle.update(dt, time)
//   handle.getDangerLevel(playerPos) // 0..1 — для столкновений
//   handle.getLandingStatus(pos, quat) // 0 / 1 / 2
//   handle.setDockingEnabled(bool)
//   handle.isDockingEnabled()
//   handle.setOnDock(fn)
//   handle.setOnUndock(fn)
//   handle.setRotation({ rotation|quaternion|euler })
//   handle.dispose()
//
//   Коды getLandingStatus:
//     0 — ничего (далеко или не в створе)
//     1 — успешная посадка
//     2 — авария
//
//   Хранение статических хелперов:
//     Station.mulberry32(seed)
//     Station.strHash(str)
//     Station.getParams(star)
//     Station.dispose(handle) // для обратной совместимости с STATION.dispose
//
// ---
// Инкапсулирует состояние одной космической станции.
// Используется в модуле g-start-loop.html.
// ---

//const UniverseJS = require("../galaxy/universe");

class Station
{
    // ---------------------------------------------------------------
    //  Статические хелперы (не зависят от экземпляра)
    // ---------------------------------------------------------------

    static mulberry32(seed)
    {
        return function ()
        {
            seed |= 0;
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    static strHash(s)
    {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++)
        {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    /// Вычисление параметров станции из статов звезды.
    /// Возвращает чистый объект — можно использовать и без создания Station.
    static getParams(star)
    {
        if (!star) throw new Error("Station.getParams: star is required");

        const seed =
            ((star.id | 0) * 1103515245) ^
            Station.strHash((star.name || "") + "|station");

        const rng = Station.mulberry32(seed >>> 0);

        const tech = Math.max(1, Math.min(15, star.tech | 0));

        // Общий размер станции
        const radius = 120 + tech * 4 + rng() * 60;

        // Корпус
        const coreRadius = radius * 0.35;
        const ringRadius = radius * 0.9;
        const ringTube   = radius * 0.15;

        // Шлюз
        const gateRadius = radius * 0.28;
        const gateLength = radius * 0.9;
        const gateOffsetZ = -ringRadius;

        const dangerRangeFactor = 1.6;

        // Цвета
        const hullHue = 0.55 + (rng() - 0.5) * 0.15;
        const hullColor = new THREE.Color().setHSL(hullHue, 0.25, 0.35);
        const accentColor = new THREE.Color().setHSL(
            (hullHue + 0.5) % 1,
            0.9,
            0.55,
        );
        const gateColor = new THREE.Color().setHSL(
            (hullHue + 0.05) % 1,
            0.8,
            0.6,
        );

        const spinSpeed = 0.15 + rng() * 0.2;

        return {
            seed,
            radius,
            coreRadius,
            ringRadius,
            ringTube,
            gateRadius,
            gateLength,
            gateOffsetZ,
            dangerRangeFactor,
            hullColor,
            accentColor,
            gateColor,
            spinSpeed,
        };
    }

    // ---------------------------------------------------------------
    //  Экземпляр
    // ---------------------------------------------------------------
    constructor(star, options = {})
    {
        // --- Параметры / геометрия ---
        this.params = Station.getParams(star);
        this.group  = this._buildGroup(this.params);

        // --- Состояние стыковки ---
        this._dockingEnabled   = options.dockingEnabled ?? true;

        // --- Колбэки ---
        this._onDockCallback   = null;
        this._onUndockCallback = null;

        // --- Применяем начальную ориентацию из options (если задана) ---
        if (options.rotation || options.quaternion || options.euler)
        {
            this.setRotation(options);
        }
        else
        {   if(DEBUG.isDockTest)
            {
                this.setRotation({
                    rotation: { x: 0, y: Math.PI, z: 0 }
                });

                this.group.position.set(0, 0, -600);
            }
            else
            {
                const rot = UniverseJS.utils.RandVec3Rot(GAME.pers.seedStar);
                this.setRotation({ rotation: rot });
                this.group.position.set(0, 0, -600);
            //  console.log(rot);
            }
        }

        this.statusLast = 1;

        // --- Применяем цвета входа/выхода ---
        this._applyDockingColors();

        console.log("🚩 Station --> Имя перса: ", GAME.pers.name);
    }

    // ---------------------------------------------------------------
    //  Геометрия
    // ---------------------------------------------------------------
    _buildGroup(params)
    {
        const group = new THREE.Group();
        const PI2 = Math.PI / 2;

        // ---- Ядро ----
        const coreMat = new THREE.MeshStandardMaterial({
            color: params.hullColor,
            metalness: 0.85,
            roughness: 0.35,
        });
        const core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(params.coreRadius, 1),
            coreMat,
        );
        group.add(core);

        // ---- Внешнее кольцо ----
        const ringMat = new THREE.MeshStandardMaterial({
            color: params.hullColor.clone().offsetHSL(0, 0, 0.1),
            metalness: 0.9,
            roughness: 0.3,
        });
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(params.ringRadius, params.ringTube, 12, 48),
            ringMat,
        );
        ring.rotation.x = PI2;
        group.add(ring);

        // ---- Спицы ----
        const spokeMat = new THREE.MeshStandardMaterial({
            color: params.accentColor,
            metalness: 0.7,
            roughness: 0.4,
            emissive: params.accentColor.clone().multiplyScalar(0.25),
        });
        const spokes = new THREE.Group();
        for (let i = 0; i < 4; i++)
        {
            const spoke = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    params.ringTube * 0.4,
                    params.ringTube * 0.4,
                    params.ringRadius - params.coreRadius,
                    8,
                ),
                spokeMat,
            );

            const a = i * PI2;
            spoke.rotation.z = a + PI2;
            spoke.position.set(
                Math.cos(a) * (params.coreRadius + (params.ringRadius - params.coreRadius) / 2),
                Math.sin(a) * (params.coreRadius + (params.ringRadius - params.coreRadius) / 2),
                0,
            );
            spokes.add(spoke);
        }
        group.add(spokes);

        // ---- Шлюз ----
        const gateGroup = new THREE.Group();
        gateGroup.position.set(0, 0, params.gateOffsetZ);

        const gateMat = new THREE.MeshStandardMaterial({
            color: params.hullColor.clone().offsetHSL(0, 0, 0.08),
            metalness: 0.85,
            roughness: 0.4,
            side: THREE.DoubleSide,
        });
        const tunnel = new THREE.Mesh(
            new THREE.CylinderGeometry(
                params.gateRadius,
                params.gateRadius,
                params.gateLength,
                24,
                1,
                true,
            ),
            gateMat,
        );
        tunnel.rotation.x = PI2;
        gateGroup.add(tunnel);

        // Светящееся кольцо-обод
        const gateRing = new THREE.Mesh(
            new THREE.TorusGeometry(params.gateRadius, params.gateRadius * 0.08, 8, 32),
            new THREE.MeshBasicMaterial({
                color: params.gateColor,
                toneMapped: false,
            }),
        );
        gateRing.position.z = -params.gateLength / 2;
        gateGroup.add(gateRing);

        // Внутренний диск
        const gateDisk = new THREE.Mesh(
            new THREE.CircleGeometry(params.gateRadius * 0.95, 24),
            new THREE.MeshBasicMaterial({
                color: params.gateColor,
                transparent: true,
                opacity: 0.25,
                side: THREE.DoubleSide,
                depthWrite: false,
                toneMapped: false,
            }),
        );
        gateDisk.position.z = -params.gateLength / 2 + 0.1;
        gateGroup.add(gateDisk);

        group.add(gateGroup);

        // ---- Лампочка над шлюзом ----
        const topMarker = new THREE.Mesh(
            new THREE.CircleGeometry(params.gateRadius * 0.18, 24),
            new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                toneMapped: false,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 1.0,
            }),
        );
        const markerUp  = params.gateRadius * 1.35;
        const markerFwd = params.gateRadius * 0.05;
        topMarker.position.set(0, markerUp, -params.gateLength / 2 + markerFwd);
        gateGroup.add(topMarker);

        // Ссылки для анимации/проверок
        group.userData.ring      = ring;
        group.userData.spokes    = spokes;
        group.userData.gateGroup = gateGroup;
        group.userData.gateRing  = gateRing;
        group.userData.topMarker = topMarker;

        return group;
    }

    // ---------------------------------------------------------------
    //  Ориентация
    // ---------------------------------------------------------------
    setRotation(rots = {})
    {
        if (rots.quaternion instanceof THREE.Quaternion)
        {
            this.group.quaternion.copy(rots.quaternion);
        }
        else if (rots.rotation)
        {
            this.group.rotation.set(
                rots.rotation.x || 0,
                rots.rotation.y || 0,
                rots.rotation.z || 0,
            );
        }
        else if (rots.euler instanceof THREE.Euler)
        {
            this.group.quaternion.setFromEuler(rots.euler);
        }
    }

    // ---------------------------------------------------------------
    //  Анимация
    // ---------------------------------------------------------------
    update(dt, time)
    {
        const g = this.group.userData;

        g.ring.rotation.z   += this.params.spinSpeed * dt;
        g.spokes.rotation.z += this.params.spinSpeed * dt * 0.5;

        // Пульсация обода шлюза
        const pulse = 0.85 + 0.15 * Math.sin(time * 3);
        g.gateRing.scale.setScalar(pulse);

        // Мигание лампочки
        const blink = 0.4 + 0.4 * Math.sin(time * 4);
        g.topMarker.material.opacity = blink;
        g.topMarker.material.transparent = true;
    }

    // ---------------------------------------------------------------
    //  Опасность
    // ---------------------------------------------------------------
    getDangerLevel(playerPosition)
    {
        if (!playerPosition) return 0;

        const worldPos = new THREE.Vector3();
        this.group.getWorldPosition(worldPos);

        const dx = playerPosition.x - worldPos.x;
        const dy = playerPosition.y - worldPos.y;
        const dz = playerPosition.z - worldPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const r = this.params.radius;
        const outer = r * this.params.dangerRangeFactor;

        if (dist <= r) return 1.0;
        if (dist >= outer) return 0.0;

        const t = (dist - r) / (outer - r);
        const s = t * t * (3 - 2 * t);
        return 1.0 - s;
    }

    // ---------------------------------------------------------------
    //  Посадка
    // ---------------------------------------------------------------
    _computeStatus(playerPos, playerQuat)
    {
        if (!playerPos || !playerQuat) return 0;

        const p = this.params;

        // Мировые поза/ориентация станции
        const stationPos  = new THREE.Vector3();
        const stationQuat = new THREE.Quaternion();
        this.group.getWorldPosition(stationPos);
        this.group.getWorldQuaternion(stationQuat);

        // Вход шлюза в мире
        const gateLocal = new THREE.Vector3(
            0,
            0,
            p.gateOffsetZ - p.gateLength / 2,
        );
        const gateWorld = gateLocal
            .clone()
            .applyQuaternion(stationQuat)
            .add(stationPos);

        // Оси шлюза
        const gateAxisOut = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(stationQuat)
            .normalize();
        const gateAxisIn = gateAxisOut.clone().negate();

        // Вектор от входа шлюза до корабля
        const toShip = playerPos.clone().sub(gateWorld);

        const along = toShip.dot(gateAxisOut);
        const radialVec = toShip.clone().addScaledVector(gateAxisOut, -along);
        const radial = radialVec.length();

        // Не в цилиндре перед шлюзом
        if (along < 0 || along > p.gateLength) return 0;
        if (radial > p.gateRadius) return 0;

        // Ориентация корабля
        const shipNose = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(playerQuat)
            .normalize();
        const shipUp = new THREE.Vector3(0, 1, 0)
            .applyQuaternion(playerQuat)
            .normalize();

        const gateUp = new THREE.Vector3(0, 1, 0)
            .applyQuaternion(stationQuat)
            .normalize();

        const noseDot = shipNose.dot(gateAxisIn);
        const upDot   = shipUp.dot(gateUp);

        // Допуски
        const NOSE_GOOD = 0.92;
        const NOSE_OK   = 0.6;
        const UP_GOOD   = 0.85;
        const UP_OK     = 0.5;

        if (noseDot >= NOSE_GOOD && upDot >= UP_GOOD)
        {
            if (!this._dockingEnabled) return 0;
            return 1;
        }

        if (noseDot >= NOSE_OK && upDot >= UP_OK) return 2;

        return 2;
    }

    getLandingStatus(playerPos, playerQuat)
    {
        if(GAME.isDock) return 0;

        console.assert(playerPos );
        console.assert(playerQuat);

        const status = this._computeStatus(playerPos, playerQuat);

        if(status === 2) return 2;
        if(status === 1 && this.statusLast !== 1)
        {
        //  setOnDock();
            this.statusLast = 1;
            //console.log("🟢 status: ", status);
            return status;
        }

        //console.log("🔴 status: ", 0);
        this.statusLast = status;

        return 0;
    }

    // ---------------------------------------------------------------
    //  Колбэки и цвета
    // ---------------------------------------------------------------
    setOnDock()
    {   /// включение флага в g-start-loop.html
    }

    setOnUndock()
    {  /// отключение флага в g-start-loop.html
    }

    _applyDockingColors()
    {   const COLORS =
        {   enabled:  { marker: 0x00ff00, ring: 0x00ff88 },
            disabled: { marker: 0xff2222, ring: 0xff3333 },
        };
        const c = this._dockingEnabled ? COLORS.enabled : COLORS.disabled;
        const g = this.group.userData;
        g.topMarker.material.color.setHex(c.marker);
        g.gateRing.material.color.setHex(c.ring);
    }

    setDockingEnabled(enabled)
    {   this._dockingEnabled = !!enabled;
        this._applyDockingColors();
    }

    isDockingEnabled()
    {
        return this._dockingEnabled;
    }

    // ---------------------------------------------------------------
    //  Освобождение ресурсов
    // ---------------------------------------------------------------
    dispose()
    {
        if (!this.group) return;
        this.group.traverse((obj) =>
        {
            if (obj.geometry) obj.geometry.dispose?.();
            if (Array.isArray(obj.material))
            {
                obj.material.forEach((m) => m.dispose?.());
            }
            else if (obj.material)
            {
                obj.material.dispose?.();
            }
        });
    }
}

// Экспорт
if (typeof module !== "undefined" && typeof module.exports !== "undefined")
{
    module.exports = Station;
}
else
{
    window.Station = Station;
}