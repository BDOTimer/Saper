Cтатический class SpaceGameData:

- 12 типов врагов (с характеристиками под E‑стиль);
- логику радара (проекция позиций на плоскость радара, фильтрация по дальности, нормализация координат);
- утилиту для получения врага по ID и генерации экземпляра (чтобы можно было создавать объекты в сцене Three.js).

```js
class SpaceGameData {
  // Типы врагов: статическая конфигурация (баланс, модель, поведение)
  static ENEMY_TYPES = {
    'raider-fang': {
      id: 'raider-fang',
      name: 'Пиратский рейдер «Клык»',
      role: 'early_aggressor',
      tier: 1,
      hp: 800,
      armor: 200,
      speed: 180,
      turnRate: 3.5,
      weapon: { type: 'pulse_cannon', damage: 45, fireRate: 6, range: 1200 },
      tactics: ['ambush_asteroid', 'shield_burst'],
      color: 0xff3333, // красный
      model: 'raider_light',
      description: 'Лёгкий и быстрый пиратский корабль, специализируется на внезапных атаках и сбивании щитов.'
    },
    'corvette-iron': {
      id: 'corvette-iron',
      name: 'Тяжёлый корвет «Стальной страж»',
      role: 'patrol_heavy',
      tier: 2,
      hp: 2200,
      armor: 900,
      speed: 110,
      turnRate: 1.8,
      weapon: { type: 'rocket_volley', damage: 120, fireRate: 0.8, range: 1600 },
      tactics: ['hold_distance', 'volley_fire'],
      color: 0x8888ff, // сине-стальной
      model: 'corvette_medium',
      description: 'Патрульный корабль корпорации, хорошо бронирован, держит дистанцию и использует ракетные залпы.'
    },
    'drone-eye': {
      id: 'drone-eye',
      name: 'Дрон-разведчик «Глаз»',
      role: 'support_scanner',
      tier: 1,
      hp: 350,
      armor: 100,
      speed: 240,
      turnRate: 5.0,
      weapon: { type: 'none', damage: 0, fireRate: 0, range: 0 },
      tactics: ['scan_and_mark', 'evade_hard'],
      color: 0xffff44, // жёлтый
      model: 'drone_small',
      description: 'Маленький автономный дрон, сканирует корабль игрока и помечает уязвимые модули.'
    },
    'fighter-shadow': {
      id: 'fighter-shadow',
      name: 'Наёмный истребитель «Тень»',
      role: 'flanker',
      tier: 2,
      hp: 950,
      armor: 300,
      speed: 210,
      turnRate: 4.2,
      weapon: { type: 'rail_shot', damage: 65, fireRate: 4, range: 1400 },
      tactics: ['approach_rear', 'engine_targeting'],
      color: 0x333333, // тёмно-серый
      model: 'fighter_light',
      description: 'Манёвренный корабль с частичным затемнением, любит заходить в тыл и бить по двигателям.'
    },
    'ambush-spider': {
      id: 'ambush-spider',
      name: 'Корабль-засада «Паук»',
      role: 'trap_ambush',
      tier: 2,
      hp: 1300,
      armor: 400,
      speed: 90,
      turnRate: 1.2,
      weapon: { type: 'emp_pulse', damage: 80, fireRate: 0.5, range: 800 },
      tactics: ['drift_stealth', 'grav_trap'],
      color: 0xaa33aa, // пурпурный
      model: 'stealth_medium',
      description: 'Прячется в дрейфе, активируется при пролёте игрока. Использует гравитационные ловушки и EMP.'
    },
    'smuggler-cargo': {
      id: 'smuggler-cargo',
      name: 'Контрабандистский транспорт «Груз-X»',
      role: 'cargo_defender',
      tier: 2,
      hp: 1800,
      armor: 700,
      speed: 100,
      turnRate: 1.5,
      weapon: { type: 'improvised_turret', damage: 50, fireRate: 3, range: 1100 },
      tactics: ['panic_fire', 'evade_to_safezone'],
      color: 0xffaa00, // оранжево-жёлтый
      model: 'transport_medium',
      description: 'Изначально не враждебен, но при попытке задержания открывает огонь из импровизированных турелей.'
    },
    'sentinel-guard': {
      id: 'sentinel-guard',
      name: 'Автономный фрегат «Часовой»',
      role: 'zone_defender',
      tier: 3,
      hp: 3200,
      armor: 1400,
      speed: 85,
      turnRate: 1.0,
      weapon: { type: 'auto_cannon_cluster', damage: 35, fireRate: 10, range: 1300 },
      tactics: ['strict_perimeter', 'overwatch'],
      color: 0x4488ff, // голубой
      model: 'frigate_heavy',
      description: 'Старый военный корабль без экипажа, действует по жёстким протоколам безопасности.'
    },
    'bio-predator': {
      id: 'bio-predator',
      name: 'Биокорабль «Хищник»',
      role: 'swarm_bio',
      tier: 3,
      hp: 2600,
      armor: 600,
      speed: 130,
      turnRate: 2.2,
      weapon: { type: 'bio_swarm', damage: 25, fireRate: 8, range: 900 },
      tactics: ['regen_biomass', 'spawn_drones'],
      color: 0x00ff44, // ярко-зелёный
      model: 'organic_medium',
      description: 'Органический корабль инопланетной фракции: регенерирует броню и выпускает стаи малых дронов.'
    },
    'interceptor-blade': {
      id: 'interceptor-blade',
      name: 'Рейдер-перехватчик «Клинок бури»',
      role: 'ram_aggressor',
      tier: 3,
      hp: 1500,
      armor: 500,
      speed: 190,
      turnRate: 3.8,
      weapon: { type: 'kinetic_ram', damage: 0, fireRate: 0, range: 0 }, // урон через столкновение
      tactics: ['close_range_rush', 'boarding_attempt'],
      color: 0xff4444, // алый
      model: 'rammer_light',
      description: 'Агрессивный корабль, намеренно сближается и использует кинетические тараны или абордажные модули.'
    },
    'destroyer-hammer': {
      id: 'destroyer-hammer',
      name: 'Эскадренный эсминец «Молот»',
      role: 'mini_boss',
      tier: 4,
      hp: 6500,
      armor: 2800,
      speed: 75,
      turnRate: 0.9,
      weapon: { type: 'heavy_cannon', damage: 200, fireRate: 1.2, range: 2000 },
      tactics: ['area_suppression', 'repair_drones'],
      color: 0x555555, // стальной серый
      model: 'destroyer_heavy',
      description: 'Крупный корабль с тяжёлыми орудиями и поддержкой дронов-ремонта. Мини-босс.'
    },
    'jammer-silence': {
      id: 'jammer-silence',
      name: 'Сканер-глушитель «Тишина»',
      role: 'cc_support',
      tier: 3,
      hp: 1100,
      armor: 350,
      speed: 140,
      turnRate: 2.5,
      weapon: { type: 'ecm_pulse', damage: 0, fireRate: 1.5, range: 1200 },
      tactics: ['sensor_suppression', 'hide_in_noise'],
      color: 0x8844aa, // фиолетово-серый
      model: 'electronic_medium',
      description: 'Подавляет сенсоры, сбивает наведение ракет и создаёт помехи радару.'
    },
    'bounty-ghost': {
      id: 'bounty-ghost',
      name: 'Охотник за головами «Призрак»',
      role: 'elite_pursuer',
      tier: 4,
      hp: 2100,
      armor: 800,
      speed: 170,
      turnRate: 3.0,
      weapon: { type: 'precision_rail', damage: 110, fireRate: 2.5, range: 1800 },
      tactics: ['track_target', 'cloak_reposition'],
      color: 0xffffff, // белый/серебро
      model: 'stealth_elite',
      description: 'Элитный одиночный корабль с продвинутой маскировкой и приоритетом на уничтожение конкретных целей.'
    }
  };

  /**
   * Получить определение врага по ID
   */
  static getEnemyType(id) {
    return this.ENEMY_TYPES[id] || null;
  }

  /**
   * Создать экземпляр врага (для сцены Three.js)
   * Возвращает объект с данными + позицией, скоростью, состоянием
   */
  static createEnemyInstance(id, position = new THREE.Vector3(0, 0, 0)) {
    const type = this.getEnemyType(id);
    if (!type) {
      throw new Error(`Неизвестный тип врага: ${id}`);
    }
    return {
      ...type,
      instanceId: crypto.randomUUID(),
      position: position.clone(),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      state: 'idle', // idle, patrol, chase, retreat, dead
      health: type.hp,
      shield: type.armor,
      lastUpdateTime: performance.now()
    };
  }

  /**
   * Проекция мировой позиции на плоскость радара.
   *
   * @param {THREE.Vector3} worldPos - позиция врага в мире
   * @param {THREE.Vector3} radarCenter - позиция радара (корабля)
   * @param {THREE.Vector3} forward - направление вперёд корабля
   * @param {THREE.Vector3} right - направление вправо
   * @param {THREE.Vector3} up - направление вверх
   * @param {number} maxRange - максимальная дальность радара
   * @returns {{x: number, y: number, dist: number, visible: boolean}} нормализованные координаты на радаре (-1..1) и дистанция
   */
  static projectToRadar(worldPos, radarCenter, forward, right, up, maxRange) {
    const dir = worldPos.clone().sub(radarCenter);
    const dist = dir.length();

    if (dist > maxRange || dist < 0.1) {
      return { x: 0, y: 0, dist, visible: false };
    }

    // Проекция на локальные оси радара
    const x = dir.dot(right) / maxRange; // лево-право
    const y = dir.dot(up) / maxRange;    // верх-низ

    return { x, y, dist, visible: true };
  }

  /**
   * Отфильтровать и спроецировать список врагов на радар.
   * Подходит для подготовки данных для отрисовки точек/спрайтов.
   */
  static prepareRadarData(enemies, radarCenter, forward, right, up, maxRange) {
    return enemies
      .filter(e => e.state !== 'dead')
      .map(e => {
        const proj = this.projectToRadar(e.position, radarCenter, forward, right, up, maxRange);
        return {
          enemy: e,
          x: proj.x,
          y: proj.y,
          dist: proj.dist,
          visible: proj.visible,
          color: e.color
        };
      })
      .filter(item => item.visible);
  }

  /**
   * Утилита: получить направление стрелки для врага вне экрана радара.
   * Возвращает угол в радианах (0 — вперёд, по часовой) и дистанцию.
   */
  static getEdgeIndicator(worldPos, radarCenter, forward, right, up) {
    const dir = worldPos.clone().sub(radarCenter).normalize();
    // Азимут в горизонтальной плоскости
    const azimuth = Math.atan2(dir.dot(right), dir.dot(forward));
    // Дистанция
    const dist = worldPos.distanceTo(radarCenter);
    return { angle: azimuth, dist };
  }
}
```

---

## Как это использовать с Three.js и радаром

1. **Создать врагов:**
   ```js
   const enemies = [
     SpaceGameData.createEnemyInstance('raider-fang', new THREE.Vector3(500, 0, 300)),
     SpaceGameData.createEnemyInstance('drone-eye', new THREE.Vector3(-200, 50, -400)),
     // ...
   ];
   ```
2. **Каждый кадр обновлять их позиции/скорости** (логика движения — отдельно, это только данные).
3. **Подготовить данные для радара:**
   ```js
   const radarData = SpaceGameData.prepareRadarData(
     enemies,
     playerShip.position,
     playerShip.forward,
     playerShip.right,
     playerShip.up,
     2000 // maxRange
   );
   ```
4. **Отрисовать точки на радаре:** использовать `radarData.x` и `radarData.y` как координаты спрайтов/точек внутри плоскости радара; цвет брать из `enemy.color`.
5. **Для врагов вне экрана** — использовать `SpaceGameData.getEdgeIndicator`, чтобы показать стрелку по краю радара и дистанцию.

---

Если скажешь, какой именно вариант радара из прошлых идей хочешь реализовать (круговой голографический, секторный с векторами или сетка), могу дать пример отрисовки именно под этот стиль — с кодом для `BufferGeometry`/`Points` или `Sprite` и анимациями.