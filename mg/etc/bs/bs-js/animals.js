//  animals.js
//  class Duck;
//  class DuckPool;

// --------------------------------------------------------
// CLASS: Утка
// --------------------------------------------------------
class Duck {
  constructor(scene, terrain, spawnPos, targetPos) {
    this.scene     = scene;
    this.terrain   = terrain;
    this.alive     = true;
    this.falling   = false;
    this.removeMe  = false;
    this.fallSpeed = 0;
    this.fallRotSpeed = 0;
    this.life = 0;
    this.wingPhase = Math.random() * Math.PI * 2;

    this.group = new THREE.Group();
    this.buildModel();
    this.group.position.copy(spawnPos);
    this.group.position.y = Math.max(2, spawnPos.y + 2 + Math.random()*2);
    this.scene.add(this.group);

    this.velocity = new THREE.Vector3(
      (Math.random() - 0.3) * 6,
      2 + Math.random() * 3,
      (Math.random() - 0.5) * 6
    );
    this.targetPos = targetPos.clone();
    this.wanderTimer = 0;
  }

  buildModel() {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
    const headMat = new THREE.MeshLambertMaterial({ color: 0x2a5a3a });
    const beakMat = new THREE.MeshLambertMaterial({ color: 0xffaa00 });
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });

    const bodyGeo = new THREE.SphereGeometry(0.28, 10, 8);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1.5, 0.9, 1);
    this.group.add(body);

    const neckGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.25, 8);
    const neck = new THREE.Mesh(neckGeo, headMat);
    neck.position.set(0.35, 0.12, 0);
    neck.rotation.z = -0.5;
    this.group.add(neck);

    const headGeo = new THREE.SphereGeometry(0.15, 10, 8);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0.5, 0.22, 0);
    this.group.add(head);

    const beakGeo = new THREE.ConeGeometry(0.06, 0.2, 6);
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.rotation.z = -Math.PI/2;
    beak.position.set(0.68, 0.2, 0);
    this.group.add(beak);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeGeo = new THREE.SphereGeometry(0.025, 6, 6);
    const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
    eye1.position.set(0.55, 0.26, 0.08);
    this.group.add(eye1);
    const eye2 = eye1.clone();
    eye2.position.z = -0.08;
    this.group.add(eye2);

    this.wingL = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.4, 0.7),
      wingMat
    );
    this.wingL.position.set(0, 0.15, 0.35);
    this.group.add(this.wingL);

    this.wingR = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.4, 0.7),
      wingMat
    );
    this.wingR.position.set(0, 0.15, -0.35);
    this.group.add(this.wingR);

    const tailGeo = new THREE.ConeGeometry(0.15, 0.3, 6);
    const tail = new THREE.Mesh(tailGeo, bodyMat);
    tail.rotation.z = Math.PI/2;
    tail.position.set(-0.45, 0.05, 0);
    this.group.add(tail);

    this.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }

  getBoundingBox() {
    return new THREE.Box3().setFromObject(this.group);
  }

  hit() {
    if (!this.alive) return false;
    this.alive = false;
    this.falling = true;
    this.fallSpeed = 2;
    this.fallRotSpeed = (Math.random() - 0.5) * 8;
    if (window.SNDS && SNDS.death) SNDS.death.play();
    return true;
  }

  update(dt) {
    if (this.alive) {
      this.life += dt;
      
      this.wanderTimer += dt;
      if (this.wanderTimer > 1.2) {
        this.wanderTimer = 0;
        this.velocity.x += (Math.random() - 0.5) * 4;
        this.velocity.z += (Math.random() - 0.5) * 4;
        this.velocity.y += Math.random() * 1;
      }
      this.velocity.y -= dt * 1.0; 

      this.group.position.addScaledVector(this.velocity, dt);

      const horiz = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
      if (horiz.lengthSq() > 0.01) {
        this.group.rotation.y = Math.atan2(-this.velocity.z, this.velocity.x);
      }

      this.wingPhase += dt * 18;
      const flap = Math.sin(this.wingPhase) * 0.9;
      this.wingL.rotation.x = flap;
      this.wingR.rotation.x = -flap;

      if (this.group.position.y > 35 || this.group.position.length() > 150) {
        this.removeMe = true;
      }
    } else if (this.falling) {
      this.fallSpeed += dt * 25;
      this.group.position.y -= this.fallSpeed * dt;
      this.group.rotation.x += this.fallRotSpeed * dt;
      this.group.rotation.z += this.fallRotSpeed * 0.7 * dt;

      this.wingL.rotation.x = -1.5;
      this.wingR.rotation.x = 1.5;

      const groundY = this.terrain.getHeightAt(this.group.position.x, this.group.position.z) + 0.3;
      if (this.group.position.y <= groundY) {
        this.group.position.y = groundY;
        this.falling = false;
        setTimeout(() => { this.removeMe = true; }, 800);
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(o => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (o.material.dispose) o.material.dispose();
      }
    });
  }
}

// --------------------------------------------------------
// CLASS: DuckPool — спавн, обновление, перебор уток
// --------------------------------------------------------
class DuckPool {
  /**
   * @param {THREE.Scene} scene
   * @param {Terrain}     terrain
   * @param {Object}      opts
   * @param {number}      opts.spawnInterval   — секунд между спавнами (1.6)
   * @param {number}      opts.maxAlive        — максимум живых уток (8)
   * @param {number}      opts.spawnRadiusMin  — 15
   * @param {number}      opts.spawnRadiusMax  — 35
   * @param {Array<{x:number,z:number}>} opts.spawnPoints — точки спавна (nature.spawnPoints и т.п.)
   * @param {number}      opts.waterLevel      — уровень воды (ENV.WATER_LEVEL)
   */
  constructor(scene, terrain, opts = {}) {
    this.scene         = scene;
    this.terrain       = terrain;

    this.spawnInterval  = opts.spawnInterval  ?? 1.6;
    this.maxAlive       = opts.maxAlive       ?? 8;
    this.spawnRadiusMin = opts.spawnRadiusMin ?? 15;
    this.spawnRadiusMax = opts.spawnRadiusMax ?? 35;
    this.spawnPoints    = opts.spawnPoints    ?? [];
    this.waterLevel     = opts.waterLevel     ?? -2.5;

    this.ducks = [];
    this.timeSinceSpawn = 0;
    this.onKill = null;   // колбэк: (duck) => void
  }

  /** Всего уток (живых + падающих) */
  get count() { return this.ducks.length; }

  /** Кол-во живых уток */
  get aliveCount() {
    let n = 0;
    for (let i = 0; i < this.ducks.length; i++) if (this.ducks[i].alive) n++;
    return n;
  }

  /**
   * Пробуем заспавнить одну утку рядом с camera (если есть место и прошёл интервал).
   * Вызывается каждый кадр — сама решает, спавнить или нет.
   */
  updateSpawner(dt, camera) {
    this.timeSinceSpawn += dt;
    if (this.timeSinceSpawn < this.spawnInterval) return;
    this.timeSinceSpawn = 0;

    if (this.aliveCount >= this.maxAlive) return;
    this.spawn(camera);
  }

  /** Спавн одной утки (без проверки таймера) */
  spawn(camera) {
    const { x: cx, z: cz } = camera.position;
    const rMin = this.spawnRadiusMin;
    const rMax = this.spawnRadiusMax;
    const rMinSq = rMin * rMin;
    const rMaxSq = rMax * rMax;

    const candidates = [];
    for (let i = 0; i < this.spawnPoints.length; i++) {
      const sp = this.spawnPoints[i];
      const dx = sp.x - cx;
      const dz = sp.z - cz;
      const dSq = dx * dx + dz * dz;
      if (dSq < rMinSq || dSq > rMaxSq) continue;

      // не спавним в воде
      const h = this.terrain.getHeightAt(sp.x, sp.z);
      if (h < this.waterLevel + 0.5) continue;

      candidates.push(sp);
    }

    let spawnPos;
    if (candidates.length > 0) {
      const sp = candidates[(Math.random() * candidates.length) | 0];
      spawnPos = new THREE.Vector3(
        sp.x,
        this.terrain.getHeightAt(sp.x, sp.z) + 1.5,
        sp.z
      );
    } else {
      const angle = Math.random() * Math.PI * 2;
      const dist  = rMin + Math.random() * (rMax - rMin);
      const px = cx + Math.cos(angle) * dist;
      const pz = cz + Math.sin(angle) * dist;
      spawnPos = new THREE.Vector3(
        px,
        this.terrain.getHeightAt(px, pz) + 1.5,
        pz
      );
    }

    const target = camera.position.clone();
    this.ducks.push(new Duck(this.scene, this.terrain, spawnPos, target));
  }

  /** Обновление всех уток + удаление «умерших» */
  update(dt) {
    for (let i = this.ducks.length - 1; i >= 0; i--) {
      const d = this.ducks[i];
      d.update(dt);
      if (d.removeMe) {
        d.dispose();
        this.ducks.splice(i, 1);
      }
    }
  }

  /**
   * Raycast: найти ближайшую живую утку, чей bounding box пересекает луч.
   * @param {THREE.Raycaster} raycaster
   * @param {number} maxDist
   * @returns {Duck|null}
   */
  raycast(raycaster, maxDist = 120) {
    let closestHit = null;
    let closestDist = Infinity;
    const origin = raycaster.ray.origin;

    for (let i = 0; i < this.ducks.length; i++) {
      const duck = this.ducks[i];
      if (!duck.alive) continue;

      const box = duck.getBoundingBox();
      const p = raycaster.ray.intersectBox(box, new THREE.Vector3());
      if (!p) continue;

      const d = p.distanceTo(origin);
      if (d < closestDist && d < maxDist) {
        closestDist = d;
        closestHit = duck;
      }
    }
    return closestHit;
  }

  /**
   * Точка попадания луча для трассера: ближайшая утка, иначе земля, иначе maxDist.
   * @param {THREE.Raycaster} raycaster
   * @param {THREE.Mesh} terrainMesh
   * @param {number} maxDist
   * @returns {THREE.Vector3}
   */
  raycastPoint(raycaster, terrainMesh, maxDist = 250) {
    let closestDist = Infinity;
    let hitPoint = null;
    const origin = raycaster.ray.origin;

    for (let i = 0; i < this.ducks.length; i++) {
      const duck = this.ducks[i];
      if (!duck.alive) continue;

      const box = duck.getBoundingBox();
      const p = raycaster.ray.intersectBox(box, new THREE.Vector3());
      if (!p) continue;

      const d = p.distanceTo(origin);
      if (d < closestDist && d < maxDist) {
        closestDist = d;
        hitPoint = p;
      }
    }

    if (!hitPoint && terrainMesh) {
      const hits = raycaster.intersectObject(terrainMesh, false);
      if (hits.length > 0 && hits[0].distance < maxDist) {
        hitPoint = hits[0].point;
      }
    }

    if (!hitPoint) {
      hitPoint = origin.clone().addScaledVector(raycaster.ray.direction, maxDist);
    }
    return hitPoint;
  }

  /** Убить утку (если она жива) — возвращает true при успехе */
  kill(duck) {
    if (!duck || !duck.hit()) return false;
    if (typeof this.onKill === 'function') this.onKill(duck);
    return true;
  }
}

// --------------------------------------------------------
// CLASS: Свинья
// --------------------------------------------------------
class Pig {
  constructor(scene, terrain, spawnPos, targetPos) {
    this.scene   = scene;
    this.terrain = terrain;

    // Состояния
    this.alive    = true;
    this.falling  = false;
    this.removeMe = false;

    // Движение
    this.mode = 'idle';                        // 'idle' | 'walk' | 'run'
    this.modeTimer = 0;
    this.modeDuration = 1 + Math.random() * 2;
    this.idlePhase = Math.random() * Math.PI * 2;

    // Скорости (м/с)
    this.walkSpeed = 1.2 + Math.random() * 0.6;
    this.runSpeed  = 5.0 + Math.random() * 2.0;

    // Физика падения
    this.fallSpeed = 0;
    this.fallRotSpeed = 0;

    // Анимация
    this.legPhase = 0;
    this.legAmplitude = 0;
    this.bodyBobPhase = Math.random() * Math.PI * 2;

    // Сборка
    this.group = new THREE.Group();
    this.buildModel();

    // Позиция: на земле под точкой спавна
    this.group.position.copy(spawnPos);
    this.group.position.y =
      this.terrain.getHeightAt(spawnPos.x, spawnPos.z) - 0.3;

    // Случайное направление «вперёд»
    this.group.rotation.y = Math.random() * Math.PI * 2;

    this.scene.add(this.group);

    // Цель для блуждания (если понадобится «иду к точке»)
    this.targetPos = targetPos ? targetPos.clone() : this.group.position.clone();

    // «Вперёд» в локальных осях — по +X (голова на +0.55)
    this.velocity = new THREE.Vector3();
    this._tmpDir = new THREE.Vector3();
    this._up     = new THREE.Vector3(0, 1, 0);
  }

  buildModel() {
    const bodyMat  = new THREE.MeshLambertMaterial({ color: 0xc98f80 });
    const snoutMat = new THREE.MeshLambertMaterial({ color: 0xe8b4a0 });
    const hoofMat  = new THREE.MeshLambertMaterial({ color: 0x3a2a20 });
    const eyeMat   = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const earMat   = new THREE.MeshLambertMaterial({ color: 0xb87a6a });

    // --- Тело ---
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), bodyMat);
    body.scale.set(1.4, 0.9, 1.0);
    body.position.set(0, 0.5, 0);
    this.group.add(body);
    this.body = body;

    // --- Голова ---
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), bodyMat);
    head.scale.set(1.1, 1.0, 0.95);
    head.position.set(0.55, 0.55, 0);
    this.group.add(head);
    this.head = head;

    // --- Пятачок ---
    const snout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.1, 12),
      snoutMat
    );
    snout.rotation.z = Math.PI / 2;
    snout.position.set(0.83, 0.52, 0);
    this.group.add(snout);

    // --- Уши ---
    for (const dz of [-0.15, 0.15]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 6), earMat);
      ear.position.set(0.48, 0.8, dz);
      ear.rotation.x = dz > 0 ? -0.25 : 0.25;
      ear.rotation.z = -0.2;
      this.group.add(ear);
    }

    // --- Глаза ---
    for (const dz of [-0.12, 0.12]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeMat);
      eye.position.set(0.68, 0.63, dz);
      this.group.add(eye);
    }

    // --- 4 ноги ---
    this.legs = [];
    const legGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.42, 6);
    legGeo.translate(0, -0.21, 0);   // вращение вокруг верхней точки

    const legPositions = [
      [ 0.35, 0.45,  0.28],   // передняя правая
      [ 0.35, 0.45, -0.28],   // передняя левая
      [-0.35, 0.45,  0.28],   // задняя правая
      [-0.35, 0.45, -0.28],   // задняя левая
    ];

    for (let i = 0; i < 4; i++) {
      const [lx, ly, lz] = legPositions[i];
      const leg = new THREE.Group();
      leg.position.set(lx, ly, lz);

      const shin = new THREE.Mesh(legGeo, bodyMat);
      leg.add(shin);

      const hoof = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.06, 0.06, 6),
        hoofMat
      );
      hoof.position.y = -0.42;
      leg.add(hoof);

      this.group.add(leg);
      this.legs.push({
        group: leg,
        phase: i < 2 ? 0 : Math.PI,   // передние и задние в противофазе
      });
    }

    this.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    // _baseGroupY больше НЕ нужен — высота считается от земли каждый кадр
  }

  getBoundingBox() {
    return new THREE.Box3().setFromObject(this.group);
  }

  hit() {
    if (!this.alive) return false;
    this.alive = false;
    this.falling = true;
    this.fallSpeed = 2;
    this.fallRotSpeed = (Math.random() - 0.5) * 6;
    if (window.SNDS && window.SNDS.death) window.SNDS.deathPig.play();
    return true;
  }

  // ---- Смена режима ----
  _pickMode() {
    const r = Math.random();
    if (r < 0.45) {
      this.mode = 'idle';
      this.modeDuration = 1.5 + Math.random() * 2.5;
    } else if (r < 0.85) {
      this.mode = 'walk';
      this.modeDuration = 2.0 + Math.random() * 3.0;
      this._turnRandom();
    } else {
      this.mode = 'run';
      this.modeDuration = 0.8 + Math.random() * 1.2;
      this._turnRandom();
    }
  }

  _turnRandom() {
    this.group.rotation.y += (Math.random() - 0.5) * Math.PI;
  }

  update(dt) {
    if (this.alive) {
      this._updateAlive(dt);
    } else if (this.falling) {
      this._updateFalling(dt);
    }
  }

  _updateAlive(dt) {
    // --- Таймер режима ---
    this.modeTimer += dt;
    if (this.modeTimer >= this.modeDuration) {
      this.modeTimer = 0;
      this._pickMode();
    }

    // --- Движение по X/Z ---
    const speed =
      this.mode === 'run'  ? this.runSpeed  :
      this.mode === 'walk' ? this.walkSpeed : 0;

    if (speed > 0) {
      // «Вперёд» в мировых координатах: локальный +X, повёрнутый на rotation.y
      this._tmpDir.set(1, 0, 0).applyAxisAngle(this._up, this.group.rotation.y);
      this.group.position.addScaledVector(this._tmpDir, speed * dt);
    }

    // --- Анимация ног ---
    const targetAmp =
      this.mode === 'run'  ? 0.9 :
      this.mode === 'walk' ? 0.5 : 0.0;

    this.legAmplitude += (targetAmp - this.legAmplitude) * Math.min(1, dt * 6);

    const stepSpeed =
      this.mode === 'run'  ? 16 :
      this.mode === 'walk' ? 8  : 2;

    this.legPhase += dt * stepSpeed;

    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      const angle = Math.sin(this.legPhase + leg.phase) * this.legAmplitude;
      leg.group.rotation.z = angle;
    }

    // --- Покачивание тела + подъём по рельефу (ВСЕГДА, не только при движении) ---
    this.bodyBobPhase += dt * (this.mode === 'run' ? 14 : this.mode === 'walk' ? 7 : 1.5);

    const bobAmp =
      this.mode === 'run'  ? 0.04 :
      this.mode === 'walk' ? 0.025 :
      0.008;

    const groundYNow =
      this.terrain.getHeightAt(this.group.position.x, this.group.position.z) + 0.01;
    const bob = Math.sin(this.bodyBobPhase) * bobAmp;

    this.group.position.y +=
      ((groundYNow + bob) - this.group.position.y) * Math.min(1, dt * 10);

    // --- Idle: шевеление головой/ушами ---
    if (this.mode === 'idle') {
      this.idlePhase += dt * 1.5;
      this.head.rotation.y = Math.sin(this.idlePhase) * 0.25;
      this.head.rotation.z = Math.sin(this.idlePhase * 0.7) * 0.1;
    } else {
      this.head.rotation.y += (0 - this.head.rotation.y) * Math.min(1, dt * 5);
      this.head.rotation.z += (0 - this.head.rotation.z) * Math.min(1, dt * 5);
    }

    // --- Удаление за пределами карты ---
    if (this.group.position.length() > 150) {
      this.removeMe = true;
    }
  }

  _updateFalling(dt) {
    this.fallSpeed += dt * 25;
    this.group.position.y -= this.fallSpeed * dt;
    this.group.rotation.x += this.fallRotSpeed * dt;
    this.group.rotation.z += this.fallRotSpeed * 0.7 * dt;

    const groundY =
      this.terrain.getHeightAt(this.group.position.x, this.group.position.z) + 0.15;

    if (this.group.position.y <= groundY) {
      this.group.position.y = groundY;
      this.falling = false;
      setTimeout(() => { this.removeMe = true; }, 1200);
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(o => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (o.material && o.material.dispose) o.material.dispose();
      }
    });
  }
}

// --------------------------------------------------------
// CLASS: PigPool — спавн, обновление, перебор свиней
// --------------------------------------------------------
class PigPool {
  constructor(scene, terrain, opts = {}) {
    this.scene   = scene;
    this.terrain = terrain;

    this.spawnInterval  = opts.spawnInterval  ?? 3.5;
    this.maxAlive       = opts.maxAlive       ?? 4;
    this.spawnRadiusMin = opts.spawnRadiusMin ?? 25;
    this.spawnRadiusMax = opts.spawnRadiusMax ?? 60;
    this.spawnPoints    = opts.spawnPoints    ?? [];
    this.waterLevel     = opts.waterLevel     ?? -2.5;

    this.pigs = [];
    this.timeSinceSpawn = 0;
    this.onKill = null;
  }

  get count() { return this.pigs.length; }

  get aliveCount() {
    let n = 0;
    for (let i = 0; i < this.pigs.length; i++) if (this.pigs[i].alive) n++;
    return n;
  }

  updateSpawner(dt, camera) {
    this.timeSinceSpawn += dt;
    if (this.timeSinceSpawn < this.spawnInterval) return;
    this.timeSinceSpawn = 0;

    if (this.aliveCount >= this.maxAlive) return;
    this.spawn(camera);
  }

  spawn(camera) {
    const { x: cx, z: cz } = camera.position;
    const rMin = this.spawnRadiusMin;
    const rMax = this.spawnRadiusMax;
    const rMinSq = rMin * rMin;
    const rMaxSq = rMax * rMax;

    const candidates = [];
    for (let i = 0; i < this.spawnPoints.length; i++) {
      const sp = this.spawnPoints[i];
      const dx = sp.x - cx;
      const dz = sp.z - cz;
      const dSq = dx * dx + dz * dz;
      if (dSq < rMinSq || dSq > rMaxSq) continue;

      const h = this.terrain.getHeightAt(sp.x, sp.z);
      if (h < this.waterLevel + 0.5) continue;

      candidates.push(sp);
    }

    let spawnPos;
    if (candidates.length > 0) {
      const sp = candidates[(Math.random() * candidates.length) | 0];
      spawnPos = new THREE.Vector3(
        sp.x,
        this.terrain.getHeightAt(sp.x, sp.z),
        sp.z
      );
    } else {
      const angle = Math.random() * Math.PI * 2;
      const dist  = rMin + Math.random() * (rMax - rMin);
      const px = cx + Math.cos(angle) * dist;
      const pz = cz + Math.sin(angle) * dist;
      spawnPos = new THREE.Vector3(
        px,
        this.terrain.getHeightAt(px, pz),
        pz
      );
    }

    const target = camera.position.clone();
    this.pigs.push(new Pig(this.scene, this.terrain, spawnPos, target));
  }

  update(dt) {
    for (let i = this.pigs.length - 1; i >= 0; i--) {
      const p = this.pigs[i];
      p.update(dt);
      if (p.removeMe) {
        p.dispose();
        this.pigs.splice(i, 1);
      }
    }
  }

  raycast(raycaster, maxDist = 150) {
    let closestHit = null;
    let closestDist = Infinity;
    const origin = raycaster.ray.origin;

    for (let i = 0; i < this.pigs.length; i++) {
      const pig = this.pigs[i];
      if (!pig.alive) continue;

      const box = pig.getBoundingBox();
      const p = raycaster.ray.intersectBox(box, new THREE.Vector3());
      if (!p) continue;

      const d = p.distanceTo(origin);
      if (d < closestDist && d < maxDist) {
        closestDist = d;
        closestHit = pig;
      }
    }
    return closestHit;
  }

  raycastPoint(raycaster, terrainMesh, maxDist = 250) {
    let closestDist = Infinity;
    let hitPoint = null;
    const origin = raycaster.ray.origin;

    for (let i = 0; i < this.pigs.length; i++) {
      const pig = this.pigs[i];
      if (!pig.alive) continue;

      const box = pig.getBoundingBox();
      const p = raycaster.ray.intersectBox(box, new THREE.Vector3());
      if (!p) continue;

      const d = p.distanceTo(origin);
      if (d < closestDist && d < maxDist) {
        closestDist = d;
        hitPoint = p;
      }
    }

    if (!hitPoint && terrainMesh) {
      const hits = raycaster.intersectObject(terrainMesh, false);
      if (hits.length > 0 && hits[0].distance < maxDist) {
        hitPoint = hits[0].point;
      }
    }

    if (!hitPoint) {
      hitPoint = origin.clone().addScaledVector(raycaster.ray.direction, maxDist);
    }
    return hitPoint;
  }

  kill(pig) {
    if (!pig || !pig.hit()) return false;
    if (typeof this.onKill === 'function') this.onKill(pig);
    return true;
  }
}

const ANIMALS = {
  Duck,
  DuckPool,
  Pig,
  PigPool,
};

export { ANIMALS };



