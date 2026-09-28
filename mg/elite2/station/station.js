// station.js — космическая станция для Elite-подобной игры
// Зависимости: THREE должен быть доступен глобально (window.THREE).
//
// Публичное API:
//   STATION.generate(star, opts) -> {
//     group,           // THREE.Group — вся станция
//     params,          // вычисленные параметры
//     update(dt, time),
//     getDangerLevel(playerPosition),   // 0..1 — для столкновений (как у планет)
//     getLandingStatus(playerPos, playerQuat) // 0 / 1 / 2
//   }
//   STATION.getParams(star) -> params
//   STATION.dispose(handle)
//
//   Коды GetLandingStatus:
//     0 — ничего (далеко или не в створе)
//     1 — успешная посадка
//     2 — авария (врезался в шлюз под неправильным углом)
//
//   Успех зависит от:
//     - расстояния до центра шлюза
//     - совпадения направления «носа» корабля с осью шлюза (внутрь)
//     - совпадения «верха» корабля с «верхом» шлюза (крен)

const STATION = (() => {
  // ---------------------------------------------------------------
  //  RNG
  // ---------------------------------------------------------------
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function strHash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // ---------------------------------------------------------------
  //  Параметры станции из статов звезды
  // ---------------------------------------------------------------
  function computeParams(star) {
    if (!star) throw new Error("STATION.computeParams: star is required");

    const seed =
      ((star.id | 0) * 1103515245) ^
      strHash((star.name || "") + "|station");

    const rng = mulberry32(seed >>> 0);

    const tech = Math.max(1, Math.min(15, star.tech | 0));

    // Общий размер станции (условные единицы, под размер планеты)
    const radius = 120 + tech * 4 + rng() * 60; // ~124..280

    // Корпус — «тор» + «ядро» + «спицы» вокруг оси шлюза
    const coreRadius = radius * 0.35;
    const ringRadius = radius * 0.9;
    const ringTube   = radius * 0.15;

    // Шлюз — цилиндр-тоннель, смотрящий вдоль +Z локальной оси станции.
    // Игрок должен влетать «носом» вдоль -Z (в сторону станции).
    const gateRadius = radius * 0.28;         // радиус входного отверстия
    const gateLength = radius * 0.9;          // глубина тоннеля
    const gateOffsetZ = -ringRadius;          // шлюз торчит «наружу» вдоль -Z

    // Зона, в которой станция вообще реагирует на корабль
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

    const spinSpeed = 0.15 + rng() * 0.2; // вращение кольца вокруг оси Z

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
  //  Геометрия станции
  // ---------------------------------------------------------------
  function makeStationGroup(params) {
    const group = new THREE.Group();

    const PI2 = Math.PI / 2;

    // ---- Корпус-ядро (сфера) ----
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

    // ---- Внешнее кольцо (тор), вращается вокруг оси Z ----
    const ringMat = new THREE.MeshStandardMaterial({
      color: params.hullColor.clone().offsetHSL(0, 0, 0.1),
      metalness: 0.9,
      roughness: 0.3,
    });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(params.ringRadius, params.ringTube, 12, 48),
      ringMat,
    );
    ring.rotation.x = PI2; // тор в плоскости XY
    group.add(ring);

    // ---- Спицы, соединяющие ядро и кольцо ----
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

      const a  = i * PI2;
      spoke.rotation.z = a + PI2;

      spoke.position.set(
        Math.cos(a) * (params.coreRadius + (params.ringRadius - params.coreRadius) / 2),
        Math.sin(a) * (params.coreRadius + (params.ringRadius - params.coreRadius) / 2),
        0,
      );
      spokes.add(spoke);
    }
    group.add(spokes);

    // ---- Шлюз: цилиндр-тоннель вдоль оси Z, наружу в -Z ----
    const gateGroup = new THREE.Group();
    gateGroup.position.set(0, 0, params.gateOffsetZ);

    const gateMat = new THREE.MeshStandardMaterial({
      color: params.hullColor.clone().offsetHSL(0, 0, 0.08),
      metalness: 0.85,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });
    // Тоннель как «труба» (открытый цилиндр), чтобы было видно сквозь
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
    tunnel.rotation.x = PI2; // ось цилиндра вдоль Z
    gateGroup.add(tunnel);

    // Светящееся кольцо-обод на входе шлюза (маркер «сюда»)
    const gateRing = new THREE.Mesh(
      new THREE.TorusGeometry(params.gateRadius, params.gateRadius * 0.08, 8, 32),
      new THREE.MeshBasicMaterial({
        color: params.gateColor,
        toneMapped: false,
      }),
    );
    gateRing.position.z = -params.gateLength / 2;
    gateGroup.add(gateRing);

    // Внутренний световой диск (подсветка тоннеля)
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
    
    // Лампочка над шлюзом
    const topMarker = new THREE.Mesh(
      new THREE.CircleGeometry(params.gateRadius * 0.18, 24),
      new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    );
        
    topMarker.position.set(0, params.gateRadius * 1.05, -params.gateLength / 2);
    gateGroup.add(topMarker);
    
    // Сохраняем ссылки для анимации/проверок
    group.userData.ring = ring;
    group.userData.spokes = spokes;
    group.userData.gateGroup = gateGroup;
    group.userData.gateRing = gateRing;
    group.userData.topMarker = topMarker;

    return group;
  }

  // ---------------------------------------------------------------
  //  Публичное API
  // ---------------------------------------------------------------
  return {
    getParams(star) {
      return computeParams(star);
    },

    generate(star, opts = {}) {
      const params = computeParams(star);
      const group = makeStationGroup(params);

      // ---- Анимация ----
      const update = (dt, time) => {
        // Кольцо вращается вокруг оси Z (локальной) — станция «живая»
        group.userData.ring.rotation.z += params.spinSpeed * dt;
        group.userData.spokes.rotation.z += params.spinSpeed * dt * 0.5;

        // Пульсация обода шлюза
        const pulse = 0.85 + 0.15 * Math.sin(time * 3);
        group.userData.gateRing.scale.setScalar(pulse);
        
        // Мигание лампочки над шлюзом
        const blink = 0.4 + 0.4 * Math.sin(time * 4);
        group.userData.topMarker.material.opacity = blink;
        group.userData.topMarker.material.transparent = true;
      };

      // ---- Опасность (как у планет): 1.0 в шаре радиуса radius ----
      const getDangerLevel = (playerPosition) => {
        if (!playerPosition) return 0;

        const worldPos = new THREE.Vector3();
        group.getWorldPosition(worldPos);

        const dx = playerPosition.x - worldPos.x;
        const dy = playerPosition.y - worldPos.y;
        const dz = playerPosition.z - worldPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const r = params.radius;
        const outer = r * params.dangerRangeFactor;

        if (dist <= r) return 1.0;
        if (dist >= outer) return 0.0;

        const t = (dist - r) / (outer - r);
        const s = t * t * (3 - 2 * t);
        return 1.0 - s;
      };

      // ---- Посадка ----
      // Возвращает:
      //   0 — ничего (далеко или не в створе)
      //   1 — успешная посадка
      //   2 — авария
      //
      // playerPos  — мировая позиция корабля (THREE.Vector3)
      // playerQuat — мировая ориентация корабля (THREE.Quaternion)
      //
      // Логика:
      //   - находим мировую позицию и ориентацию шлюза
      //   - проверяем, что корабль в цилиндре перед шлюзом (радиус gateRadius, длина gateLength)
      //   - сверяем направление «носа» корабля (-Z локальный) с осью шлюза (внутрь станции, +Z локальный шлюза → но корабль летит в -Z мира шлюза)
      //   - сверяем «верх» корабля (+Y локальный) с «верхом» шлюза (+Y локальный)
      //   - если всё в допусках — успех; если в створе, но углы плохие — авария
      const getLandingStatus = (playerPos, playerQuat) => {
        if (!playerPos || !playerQuat) return 0;

        // Мировые поза/ориентация станции
        const stationPos = new THREE.Vector3();
        const stationQuat = new THREE.Quaternion();
        group.getWorldPosition(stationPos);
        group.getWorldQuaternion(stationQuat);

        // Позиция входа шлюза в мире:
        //   локально шлюз сидит на (0, 0, gateOffsetZ), а его «вход» — на -gateLength/2 от центра шлюза
        const gateLocal = new THREE.Vector3(
          0,
          0,
          params.gateOffsetZ - params.gateLength / 2,
        );
        const gateWorld = gateLocal
          .clone()
          .applyQuaternion(stationQuat)
          .add(stationPos);

        // Ось шлюза в мире: наружу из станции — это локальный -Z станции,
        // повёрнутый в мир. Корабль должен лететь ВДОЛЬ этой оси в сторону станции,
        // т.е. его «нос» (локальный -Z корабля) должен совпасть с +Z оси станции (внутрь).
        const gateAxisOut = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(stationQuat)
          .normalize(); // наружу из станции
        const gateAxisIn = gateAxisOut.clone().negate(); // внутрь станции

        // Вектор от входа шлюза до корабля
        const toShip = playerPos.clone().sub(gateWorld);

        // Проекция на ось шлюза: должна быть отрицательной (корабль перед входом, снаружи)
        // и по модулю — не больше gateLength.
        const along = toShip.dot(gateAxisOut); // >0 — корабль снаружи перед входом
        // Радиальное смещение от оси шлюза
        const radialVec = toShip.clone().addScaledVector(gateAxisOut, -along);
        const radial = radialVec.length();

        // Корабль не в цилиндре перед шлюзом — «ничего»
        if (along < 0 || along > params.gateLength) return 0;
        if (radial > params.gateRadius) return 0;

        // Ориентация корабля
        // «Нос» корабля — локальный -Z, «верх» — локальный +Y
        const shipNose = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(playerQuat)
          .normalize();
        const shipUp = new THREE.Vector3(0, 1, 0)
          .applyQuaternion(playerQuat)
          .normalize();

        // «Верх» шлюза в мире
        const gateUp = new THREE.Vector3(0, 1, 0)
          .applyQuaternion(stationQuat)
          .normalize();

        // Нос должен смотреть внутрь станции: dot(shipNose, gateAxisIn) ~ 1
        const noseDot = shipNose.dot(gateAxisIn);
        // Верх корабля должен совпасть с верхом шлюза: dot(shipUp, gateUp) ~ 1
        const upDot = shipUp.dot(gateUp);

        // Допуски
        const NOSE_GOOD = 0.92;  // ~23°
        const NOSE_OK   = 0.6;   // ~53°
        const UP_GOOD   = 0.85;  // ~32°
        const UP_OK     = 0.5;   // ~60°

        // Всё хорошо — успешная посадка
        if (noseDot >= NOSE_GOOD && upDot >= UP_GOOD)
        {
            // ★ Если стыковка запрещена — не разрешаем успешную посадку.
            //   Возвращаем 0 (ничего), чтобы игрок не умирал, а просто не мог сесть.
            if (!dockingEnabled) {
                // Но если он всё равно в створе — считаем это аварией (врезался в закрытый шлюз)
                // Если хочешь мягкий вариант — оставь только `return 0;`
                return 0;
            }
            return 1;
        }

        // Влетел в шлюз, но криво — авария
        if (noseDot >= NOSE_OK && upDot >= UP_OK) return 2;

        // В створе, но совсем не туда — считаем аварией (врезался в стенку)
        return 2;
      };
      
        // ---- Разрешение/запрет входа ----
        let dockingEnabled = true;

        const COLORS = {
          enabled:  { marker: 0x00ff00, ring: 0x00ff88 }, // зелёный
          disabled: { marker: 0xff2222, ring: 0xff3333 }, // красный
        };

        function applyDockingColors() {
          const c = dockingEnabled ? COLORS.enabled : COLORS.disabled;
          group.userData.topMarker.material.color.setHex(c.marker);
          group.userData.gateRing.material.color.setHex(c.ring);
        }
        applyDockingColors(); // применяем сразу при создании

        const setDockingEnabled = (enabled) => {
          dockingEnabled = !!enabled;
          applyDockingColors();
        };

        const isDockingEnabled = () => dockingEnabled;

        return {
            group, params, update, getDangerLevel, getLandingStatus,
            setDockingEnabled,   // ← новое
            isDockingEnabled,    // ← новое
        };
    },

    dispose(handle) {
      if (!handle || !handle.group) return;
      handle.group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose?.());
        } else if (obj.material) {
          obj.material.dispose?.();
        }
      });
    },
  };
})();

//export default STATION;