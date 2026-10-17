class EnemyA
{
    static list   = [];
    static scene  = null;
    static camera = null;

    static RATE      = 0.005; // шанс спавна за вызов
    static amount    = 0;     // осталось заспавнить, -1 = ∞
    static MAX_ALIVE = 5;
    static MAXBASE   = 50;

    static _assets = null;    // общие геометрия/материалы
    static _v      = null;    // переиспользуемый вектор

    static init(scene, camera) {
        EnemyA.scene  = scene;
        EnemyA.camera = camera;
    }

    static spawn(camera)
    {
        if (EnemyA.amount === 0)                return null;
        if (!Settings.isSpawnEnemies)           return null;
        if (this.list.length >= this.MAX_ALIVE) return null; // одновременно
        if (Math.random() >  this.RATE)         return null;
        if (EnemyA.amount > 0) EnemyA.amount--;  // ← после проверок, ∞ не трогаем

        const p    = camera ? camera.position : { x: 0, y: 0, z: 0 };
        const ang  = Math.random() * Math.PI * 2;
        const dist = Math.random() * 600  +  400;

        const e = new EnemyA(new THREE.Vector3(
            p.x +  Math.cos(ang) * dist,
            p.y + (Math.random() - 0.5) * 200,
            p.z +  Math.sin(ang) * dist,
        ));
        this.list.push(e);
        return e;
    }

    static updateAll(dt, playerPos)
    {
        dt = Math.min(dt, 0.1);                       // защита от скачка dt
        for (let i = this.list.length - 1; i >= 0; i--) {
            const e = this.list[i];
            if (!e.alive) { this.remove(e); continue; } // подчищаем убитых
            e.update(dt, playerPos);
        }
    }

    static remove(enemy)
    {
        const i = this.list.indexOf(enemy);
        if (i >= 0) this.list.splice(i, 1);
        enemy.dispose();
    }

    static clear()
    {
        for (const e of this.list) e.dispose();
        this.list.length = 0;
        if (window.GAME && GAME.enemies) GAME.enemies.length = 0;
    }

    static get count() { return this.list.length; }
    get rotation() { return this.mesh.rotation; }

    constructor(position)
    {
        if (!EnemyA.scene) throw new Error('EnemyA.init(scene, camera) не вызван');

        this.mesh = EnemyA.buildMesh();
        this.mesh.position.copy(position);

        this.mesh.userData.enemy = true;
        this.mesh.userData.owner = this;
        this.mesh.userData.hp    = 3;
        this.mesh.userData.speed = 20 + Math.random() * 20;

        this.alive = true;
        EnemyA.scene.add(this.mesh);
    }

    get hp      ( )  { return this.mesh.userData.hp; }
    set hp      (v)  { this.mesh.userData.hp = v; }
    get speed   ( )  { return this.mesh.userData.speed; }
    set speed   (v)  { this.mesh.userData.speed = v; }
    get position( )  { return this.mesh.position; }

    static buildMesh()
    {
        if (!EnemyA._assets) {          // создаём один раз на всех
             EnemyA._assets = {
                geoBody: new THREE.OctahedronGeometry(8, 0),
                geoRing: new THREE.TorusGeometry(10, 1, 8, 24),
                matBody: new THREE.MeshStandardMaterial({ color: 0xaa3333, metalness: 0.7, roughness: 0.5 }),
                matRing: new THREE.MeshBasicMaterial({ color: 0xff4444, toneMapped: false }),
            };
        }
        const a = EnemyA._assets;
        const g = new THREE.Group();
        g.add(new THREE.Mesh(a.geoBody, a.matBody));
        const ring = new THREE.Mesh(a.geoRing, a.matRing);
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
        return g;
    }

    update(dt, playerPos)
    {   const v = EnemyA._v ??= new THREE.Vector3();
        v.subVectors(playerPos, this.mesh.position);
        if (v.lengthSq() > 1) {
            v.normalize();
            this.mesh.position.addScaledVector(v, this.speed * dt);
            this.mesh.lookAt(playerPos);
        }
    }

    /// true — уничтожен (труп подберёт updateAll)
    hit(dmg = 1)
    {   if (!this.alive) return false;
        this.hp -= dmg;
        if (this.hp <= 0) { this.alive = false; this.hp = 0; return true; }
        return false;
    }

    removeFromScene() { EnemyA.scene.remove(this.mesh); }

    dispose()   // общие ассеты НЕ диспоузим
    {   this.removeFromScene();
        this.mesh.userData.owner = null;
    }

    // EnemyA.amount =  0; // врагов нет
    // EnemyA.amount = -1; // врагов ꝏ
    static doAmount(min, max)
    {   EnemyA.amount = Math.floor(Math.random() * (max - min)) + min;
    }

    static start(star)
    {      EnemyA.clear();
           EnemyA.amount = Math.round(EnemyA.MAXBASE * star.danger);

           console.log("💀 EnemyA.amount: ", EnemyA.amount);
    }


    static description = [
    ["Дрон‑разведчик «Глаз»", "Маленький автономный дрон без экипажа, сканирует корабль игрока, помечает уязвимые модули и передаёт координаты союзникам. Сам почти не наносит урона, но опасен как «маяк»."],
    ["Контрабандистский транспорт «Груз‑X»", "Изначально не враждебен, но при попытке задержания открывает огонь из импровизированных турелей. Может перевозить ценные модули или контрабанду."],
    ["Пиратский рейдер «Клык»", "Лёгкий и быстрый пиратский корабль, специализируется на внезапных атаках из‑за астероидов и попытках сбить щиты залпом импульсных пушек. Подходит для ранних секторов."],
    ["Наёмный истребитель «Тень»", "Манёвренный корабль с системой частичного затемнения, любит заходить в тыл и бить по двигателям. Типичный противник в контрактах на сопровождение."],
    ["Корабль‑засада «Паук»", "Прячется в дрейфе (почти нулевой тепловой след), активируется при пролёте игрока. Использует гравитационные ловушки и короткие импульсы EMP."],
    ["Сканер‑глушитель «Тишина»", "Корабль, который не столько атакует, сколько подавляет сенсоры, сбивает наведение ракет и создаёт помехи радару. Делает бой хаотичным и непредсказуемым."],
    ["Тяжёлый корвет «Стальной страж»", "Патрульный корабль корпорации, хорошо бронирован, держит дистанцию и использует ракетные залпы. Часто встречается у торговых маршрутов и станций."],
    ["Рейдер‑перехватчик «Клинок бури»", "Агрессивный корабль, который намеренно сближается и использует кинетические тараны или абордажные модули. Опасен на ближней дистанции."],
    ["Биокорабль «Хищник»", "Органический корабль инопланетной фракции: регенерирует броню за счёт биомассы, выпускает стаи малых дронов‑«личинок», которые перегружают системы защиты."],
    ["Автономный фрегат «Часовой»", "Старый военный корабль без экипажа, действует по жёстким протоколам безопасности. Стреляет по любому, кто нарушает периметр охраняемой зоны."],
    ["Охотник за головами «Призрак»", "Элитный одиночный корабль с продвинутой маскировкой и приоритетом на уничтожение конкретных целей. Часто появляется в ответ на репутацию игрока или выполнение определённых контрактов."],
    ["Эскадренный эсминец «Молот»", "Крупный корабль с тяжёлыми орудиями и поддержкой дронов‑ремонта. Обычно появляется как «мини‑босс» в сюжетных миссиях."]
    ];
}

window.EnemyA = EnemyA;

class ExplosionEffect
{
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.lights = [];
  }

  /**
   * Создать взрыв в точке position (THREE.Vector3)
   */
  spawn(position) {
    SNDS?.boom1?.play?.();
    
    // --- Вспышка света ---
    const light = new THREE.PointLight(0xffaa33, 50, 100);
    light.position.copy(position);
    this.scene.add(light);
    this.lights.push({ light, life: 0, ttl: 1.5 });

    // Постепенно уменьшаем интенсивность и удаляем свет
    setTimeout(() => {
      const fadeOut = setInterval(() => {
        light.intensity *= 0.9;
        if (light.intensity < 0.1) {
          this.scene.remove(light);
          clearInterval(fadeOut);
        }
      }, 30);
    }, 10);

    // --- Осколки (частицы) ---
    const count = 80; // количество осколков
    for (let i = 0; i < count; i++) {
      // Цвет: от жёлтого до оранжевого
      const hue = THREE.MathUtils.randFloat(0.08, 0.13); // HSL hue
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(hue, 1, 0.7),
        transparent: true,
        opacity: 1,
      });

      const size = THREE.MathUtils.randFloat(0.5, 1.6);
      const geometry = new THREE.SphereGeometry(size, 6, 6); // низкополигональная сфера

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);

      // Направление разлёта
      const dir = new THREE.Vector3(
        THREE.MathUtils.randFloat(-1, 1),
        THREE.MathUtils.randFloat(-1, 1),
        THREE.MathUtils.randFloat(-1, 1)
      ).normalize();

      // Скорость: разные осколки летят с разной скоростью
      const speed = THREE.MathUtils.randFloat(5, 30);
      const velocity = dir.multiplyScalar(speed);

      // Вращение
      const spin = new THREE.Vector3(
        THREE.MathUtils.randFloat(-3, 3),
        THREE.MathUtils.randFloat(-3, 3),
        THREE.MathUtils.randFloat(-3, 3)
      );

      // Время жизни
      const lifetime = THREE.MathUtils.randFloat(1200, 2200); // мс
      const startTime = performance.now();

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        spin,
        lifetime,
        startTime,
      });
    }
  }

  /**
   * Вызывать каждый кадр (в цикле анимации)
   */
  update(delta) {
    // --- свет ---
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      l.life += delta;
      l.light.intensity = 50 * Math.max(0, 1 - l.life / l.ttl);
      if (l.life >= l.ttl) {
        this.scene.remove(l.light);
        this.lights.splice(i, 1);          // ← утечка закрыта
      }
    }

    // --- частицы ---
    const now = performance.now();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const t = (now - p.startTime) / p.lifetime;

      if (t >= 1) {                        // ← сначала проверка смерти
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      p.mesh.position.addScaledVector(p.velocity, delta);
      p.velocity.y -= 0.4 * delta;
      p.velocity.multiplyScalar(Math.pow(0.97, delta * 60)); // ← FPS-независимо
      p.mesh.rotation.x += p.spin.x * delta;
      p.mesh.rotation.y += p.spin.y * delta;
      p.mesh.rotation.z += p.spin.z * delta;
      p.mesh.material.opacity = 1 - t;
    }
  }

  /**
   * Полная очистка (вызывать при уничтожении класса или перезагрузке сцены)
   */
  dispose() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    this.particles = [];

    for (const light of this.lights) {
      this.scene.remove(light);
    }
    this.lights = [];
  }
}

window.ExplosionEffect = ExplosionEffect;
