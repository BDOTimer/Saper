//  player.js
//  class Player;
//  class Breathing;

// --------------------------------------------------------
// CLASS: Player — камера, ввод, движение, стартовая позиция
// --------------------------------------------------------
class Player {
  /**
   * @param {Object} opts
   * @param {THREE.PerspectiveCamera} opts.camera
   * @param {THREE.Group}             opts.cameraPivot
   * @param {Object}                  opts.terrain      — с getHeightAt(x,z)
   * @param {HTMLElement}             opts.domElement   — renderer.domElement (для pointer lock/touch)
   * @param {boolean}                 opts.isTouch
   * @param {Object}                  opts.joyVector    — {x,y} — live-объект джойстика
   * @param {Object}                  opts.controls     — { keys } — live-объект клавиш
   * @param {Object}                  opts.start        — { x, z, yawDeg, pitchDeg }
   * @param {number}                  opts.eyeHeight    — 1.7
   * @param {number}                  opts.mouseSensitivity — 0.0022
   * @param {number}                  opts.maxRadius    — 140
   * @param {number}                  opts.walkSpeed    — 2
   * @param {number}                  opts.runSpeed     — 4
   */
  constructor(opts) {
    this.camera      = opts.camera;
    this.cameraPivot = opts.cameraPivot;
    this.terrain     = opts.terrain;
    this.domElement  = opts.domElement;
    this.isTouch     = !!opts.isTouch;
    this.joyVector   = opts.joyVector || { x: 0, y: 0 };
    this.controls    = opts.controls  || { keys: {} };

    this.eyeHeight        = opts.eyeHeight        ?? 1.7;
    this.mouseSensitivity = opts.mouseSensitivity ?? 0.0022;
    this.touchSensitivity = opts.touchSensitivity ?? 0.005;
    this.maxRadius        = opts.maxRadius        ?? 140;
    this.walkSpeed        = opts.walkSpeed        ?? 2;
    this.runSpeed         = opts.runSpeed         ?? 4;

    const s = opts.start || {};
    this.startX      = s.x       ?? 0;
    this.startZ      = s.z       ?? 0;
    this.startYawDeg = s.yawDeg  ?? -47;
    this.startPitchDeg = s.pitchDeg ?? 0;

    // Позиция и скорость
    this.pos = new THREE.Vector3(
      this.startX,
      this.eyeHeight + this.terrain.getHeightAt(this.startX, this.startZ),
      this.startZ
    );
    this.vel = new THREE.Vector3();

    // Углы (YXZ)
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.euler.y = THREE.MathUtils.degToRad(this.startYawDeg);
    this.euler.x = THREE.MathUtils.degToRad(this.startPitchDeg);
    this.euler.z = 0;
    this.camera.quaternion.setFromEuler(this.euler);

    // Флаги
    this.enabled = true;
    this.lookEnabled = true;

    // Внутренние
    this._scratchForward = new THREE.Vector3();
    this._scratchRight   = new THREE.Vector3();
    this._scratchDir     = new THREE.Vector3();

    // Touch-look
    this._touchLookId = null;
    this._touchLookStart = { x: 0, y: 0 };

    this._bindInput();
  }

  // ---------- Ввод ----------
  _bindInput() {
    const dom = this.domElement;

    // Мышь (pointer lock)
    this._onMouseMove = (e) => {
      if (this.isTouch) return;
      if (document.pointerLockElement !== dom) return;
      this._applyLook(e.movementX, e.movementY, this.touchSensitivity);
    };
    document.addEventListener('mousemove', this._onMouseMove);

    // Touch-look (правая половина экрана)
    this._onTouchStart = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX > window.innerWidth * 0.35 && this._touchLookId === null) {
          this._touchLookId = t.identifier;
          this._touchLookStart.x = t.clientX;
          this._touchLookStart.y = t.clientY;
        }
      }
    };
    this._onTouchMove = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== this._touchLookId) continue;
        const dx = t.clientX - this._touchLookStart.x;
        const dy = t.clientY - this._touchLookStart.y;
        this._applyLook(dx * 2.3, dy * 2.3);   // 0.005 ≈ sensitivity*~2.3
        this._touchLookStart.x = t.clientX;
        this._touchLookStart.y = t.clientY;
      }
    };
    this._onTouchEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this._touchLookId) {
          this._touchLookId = null;
        }
      }
    };
    dom.addEventListener('touchstart', this._onTouchStart, { passive: true });
    dom.addEventListener('touchmove',  this._onTouchMove,  { passive: true });
    dom.addEventListener('touchend',   this._onTouchEnd,   { passive: true });
  }

  _applyLook(dx, dy, sens = this.mouseSensitivity) {
    if (!this.lookEnabled) return;
    this.euler.y -= dx * sens;
    this.euler.x -= dy * sens;
    const lim = Math.PI / 2 - 0.05;
    this.euler.x = Math.max(-lim, Math.min(lim, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  // ---------- Управление чувствительностью/локом ----------
  setLookEnabled(on) { this.lookEnabled = !!on; }

  // ---------- Обновление ----------
  update(dt, breathing) {
    if (!this.enabled) return;

    // 1) Движение — по WASD/джойстику (yaw-плоскость)
    const keys = this.controls.keys;
    const speed = keys['ShiftLeft'] ? this.runSpeed : this.walkSpeed;

    const forward = this._scratchForward.set(0, 0, -1)
      .applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();
    const right = this._scratchRight.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    const dir = this._scratchDir.set(0, 0, 0);

    if (keys['KeyW']) dir.add(forward);
    if (keys['KeyS']) dir.sub(forward);
    if (keys['KeyD']) dir.add(right);
    if (keys['KeyA']) dir.sub(right);

    if (this.isTouch && (this.joyVector.x !== 0 || this.joyVector.y !== 0)) {
      dir.add(forward.clone().multiplyScalar(-this.joyVector.y));
      dir.add(right.clone().multiplyScalar(this.joyVector.x));
    }

    if (dir.lengthSq() > 0) dir.normalize().multiplyScalar(speed);
    else dir.set(0, 0, 0);

    // Плавное сглаживание
    this.vel.lerp(dir, Math.min(1, dt * 12));
    this.pos.addScaledVector(this.vel, dt);

    // Ограничение по радиусу
    const distSq = this.pos.x * this.pos.x + this.pos.z * this.pos.z;
    if (distSq > this.maxRadius * this.maxRadius) {
      const k = this.maxRadius / Math.sqrt(distSq);
      this.pos.x *= k;
      this.pos.z *= k;
    }

    // Высота над рельефом
    const groundY = this.terrain.getHeightAt(this.pos.x, this.pos.z);
    this.pos.y = groundY + this.eyeHeight;

    // 2) Применяем позицию + дыхание к cameraPivot
    const bobY = breathing ? breathing.cameraBobY : 0;
    const roll = breathing ? breathing.cameraRoll : 0;

    this.cameraPivot.position.set(this.pos.x, this.pos.y + bobY, this.pos.z);
    this.cameraPivot.rotation.z = roll;
    // cameraPivot.rotation.x/y всегда 0 — ими управляет мышь через camera.quaternion
    this.cameraPivot.rotation.x = 0;
    this.cameraPivot.rotation.y = 0;
  }

  isMoving() {
    return this.vel.lengthSq() > 0.5;
  }

  // ---------- Отладка ----------
  getDebugInfo() {
    const eul = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    return {
      x: this.pos.x,
      y: this.pos.y,
      z: this.pos.z,
      yawDeg:   THREE.MathUtils.radToDeg(eul.y),
      pitchDeg: THREE.MathUtils.radToDeg(eul.x),
      rollDeg:  THREE.MathUtils.radToDeg(eul.z),
    };
  }
}

// --------------------------------------------------------
// CLASS: Дыхание охотника (покачивание + пар изо рта)
// --------------------------------------------------------
class Breathing {
  constructor(scene, camera, gun) {
    this.scene = scene;
    this.camera = camera;
    this.gun = gun;

    this.time = 0;
    this.breathPhase = 0;

    // Параметры дыхания
    this.breathSpeed = 1.4;       // «частота» дыхания (рад/сек)
    this.breathAmp = 0.015;       // амплитуда покачивания ружья (рад)

    // Параметры пара
    this.steamInterval = 3.0;     // раз в 3 сек — облачко пара
    this.steamTimer = 0;

    // Пул частиц пара
    this.steamPool = [];
    this.steamActive = false;
    for (let i = 0; i < 6; i++) {
      this.steamPool.push(this.createSteamParticle());
    }

    // Лёгкое покачивание при ходьбе
    this.walkBob = 0;
    this.lastPos = new THREE.Vector3().copy(camera.position);

        // Покачивание камеры (для применения в animate)
    this.cameraBobY = 0;
    this.cameraRoll = 0;
    this.cameraYaw = 0;
    this.cameraPitch = 0;

    // Параметры дыхания камеры
    this.camBreathAmp = 0.012;
    this.camBreathBobAmp = 0.015;
    this.camBreathPhase = Math.PI / 2;
  }

  createSteamParticle() {
    const geo = new THREE.SphereGeometry(0.04, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.renderOrder = 100;
    // Крепим к камере, чтобы пар всегда был перед лицом
    this.camera.add(mesh);
    return {
      mesh: mesh,
      life: 0,
      maxLife: 1.2,
      velocity: new THREE.Vector3(),
      active: false
    };
  }

  // Выпустить пар изо рта (один выдох)
  emitSteam() {
    // Найти свободную частицу
    let free = null;
    for (let i = 0; i < this.steamPool.length; i++) {
      if (!this.steamPool[i].active) {
        free = this.steamPool[i];
        break;
      }
    }
    if (!free) return;

    free.active = true;
    free.life = 0;
    // Позиция перед камерой (немного вниз и вперёд — как изо рта)
    free.mesh.position.set(
      (Math.random() - 0.5) * 0.05,
      -0.12 + Math.random() * 0.03,
      -0.35
    );
    free.mesh.scale.setScalar(1);
    free.mesh.visible = true;
    free.mesh.material.opacity = 0;
    // Скорость: медленно вперёд и вниз
    free.velocity.set(
      (Math.random() - 0.5) * 0.1,
      -0.05 - Math.random() * 0.05,
      -0.15 - Math.random() * 0.1
    );
  }

  update(dt, isMoving) {
    this.time += dt;

    // ==========================================
    // 1. Покачивание ружья (дыхание + ходьба)
    // ==========================================
    this.breathPhase += dt * this.breathSpeed;

    // Базовое покачивание от дыхания
    let breathY = Math.sin(this.breathPhase) * this.breathAmp;
    let breathX = Math.sin(this.breathPhase * 0.5) * this.breathAmp * 0.4;

    // Дополнительное покачивание при ходьбе
    if (isMoving) {
      this.walkBob += dt * 10;
      breathY += Math.sin(this.walkBob) * 0.01;
      breathX += Math.cos(this.walkBob * 0.5) * 0.015;
    } else {
      // Плавно затухает
      this.walkBob *= 0.95;
    }

    // Применяем только к модели ружья (не к камере, чтобы прицел не дёргался)
    if (this.gun && this.gun.model) {
      // Сохраняем базовую позицию ружья (из buildModel)
      const baseY = -0.22;
      const baseX = 0.24;

      const recoilY = this.gun.recoil * 0.05;  // ← отдача тоже добавляет вверх
      const recoilX = 0;
      
      // Небольшое смещение от дыхания
      this.gun.model.position.y = baseY + breathY;
      this.gun.model.position.x = baseX + breathX;
      
      // Лёгкий наклон от дыхания
      this.gun.model.rotation.z = 0.02 + breathX * 2;
    }

    // ==========================================
    // 1b. Покачивание КАМЕРЫ от дыхания
    // ==========================================
    this.camBreathPhase += dt * this.breathSpeed;

    const camRoll  = Math.sin(this.camBreathPhase) * this.camBreathAmp;
    const camBobY  = Math.sin(this.camBreathPhase * 0.8) * this.camBreathBobAmp;
    const camYaw   = Math.sin(this.camBreathPhase * 0.5) * this.camBreathAmp * 0.6;
    const camPitch = Math.sin(this.camBreathPhase * 0.7) * this.camBreathAmp * 0.4;

    let walkRoll = 0, walkBobY = 0, walkPitch = 0;
    if (isMoving) {
      walkRoll  = Math.sin(this.walkBob * 1.0) * 0.004;
      walkBobY  = Math.abs(Math.sin(this.walkBob)) * 0.008;
      walkPitch = Math.sin(this.walkBob * 2) * 0.003;  // ← добавить
    }

    // Сохраняем для применения в animate()
    this.cameraBobY  = camBobY + walkBobY;
    this.cameraRoll  = camRoll + walkRoll;
    this.cameraYaw   = camYaw;
    this.cameraPitch = camPitch + walkPitch;

    // ==========================================
    // 2. Пар изо рта — раз в N секунд
    // ==========================================
    this.steamTimer += dt;
    if (this.steamTimer > this.steamInterval) {
      this.steamTimer = 0;
      //this.emitSteam();
    }

    // Обновляем частицы пара
    for (let i = 0; i < this.steamPool.length; i++) {
      const p = this.steamPool[i];
      if (!p.active) continue;

      p.life += dt;
      
      // Движение
      p.mesh.position.addScaledVector(p.velocity, dt);
      
      // Затухание и рост
      const t = p.life / p.maxLife;
      p.mesh.material.opacity = Math.sin(t * Math.PI) * 0.5; // плавное появление/исчезновение
      p.mesh.scale.setScalar(1 + t * 3);
      
      // Немного «колыхания»
      p.mesh.position.x += Math.sin(p.life * 4) * dt * 0.05;
      
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }
}

const PLAYER =
{   Player,
    Breathing,
};

export { PLAYER };
