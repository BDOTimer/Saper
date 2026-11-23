// ============================================================
//  ВРАГИ — три типа, всё процедурно, всё в классах.
//
//    Enemy        — процедурное тело из примитивов (у каждого
//                   врага свой рост, оттенки формы, снаряжение),
//                   хитзоны (голова/тело/ноги), ИИ-автомат:
//                   Укрытие → Выглянул → Прицел → Огонь →
//                   Отход / Перебежка. Физика: AABB-выталкивание
//                   + heightfield, автошаг на низкие препятствия.
//    EnemyManager — сбор точек укрытий из коллайдеров мира,
//                   детерминированный спавн «за укрытиями»,
//                   счёт убийств, трофеи, разделение врагов.
//    Pickup       — трофейный ящик патронов / аптечка.
//
//  Типы (см. CFG.combat.enemies.types):
//    shotgun «Штурмовик»  — дробовик, залп в упор
//    rifle   «Автоматчик» — очереди по 3, средняя дистанция
//    pistol  «Пистолетчик»— одиночные выстрелы, многочисленный
// ============================================================

window.Enemy = class Enemy {

  static PALETTES = {
    shotgun: { jacket: 0x6e3f2e, pants: 0x3d3a35, helm: 0x4a453e },  // кожаная куртка
    rifle:   { jacket: 0x57603e, pants: 0x3c4034, helm: 0x47513a },  // олива
    pistol:  { jacket: 0x49536a, pants: 0x33363c, helm: 0x3f4450 }   // серо-синий
  };

  constructor(mgr, type, x, z, rng, cover) {
    this.mgr = mgr;
    this.type = type;
    this.spec = window.CFG.combat.enemies.types[type];
    this.health = this.spec.health;
    this.dead = false;

    // процедурная вариативность: рост и поза у каждого свои
    this.scaleF = 0.94 + rng() * 0.14;
    this.cover = cover || { x: x, z: z, dx: 1, dz: 0 };
    this.side = rng() < 0.5 ? 1 : -1;

    // состояние ИИ
    this.state = 'hold';
    this.stateT = 0;
    this.aimT = 0;
    this.aimTime = Weapon.randRange(this.spec.aimTime);
    this.losT = rng() * 0.2;
    this.hasLOS = false;
    this.repositionT = 4 + rng() * 6;
    this.peekX = 0; this.peekZ = 0;

    // анимация
    this.walkPhase = rng() * 6.28;
    this._moving01 = 0;
    this._stuckT = 0;

    // попадания
    this._flashT = 0;
    this._flashOn = false;
    this.mats = [];

    // тело
    this.root = new THREE.Group();
    this.root.name = 'Enemy_' + type;
    this.pos = this.root.position; // pos.y — НОГИ
    this.pos.set(x, mgr.world.heightAt(x, z), z);
    this.root.rotation.y = rng() * Math.PI * 2;
    this.root.scale.setScalar(this.scaleF);
    this._buildBody(rng);
    mgr.group.add(this.root);

    this.weapon = new EnemyWeapon(type, this.spec, this);
    this._v2 = new THREE.Vector3();
    this._v3 = new THREE.Vector3();
    this._qa = [];
  }

  // ---------------- процедурное тело ----------------

  _tint(hex, rng) {
    const c = new THREE.Color(hex);
    c.offsetHSL((rng() - 0.5) * 0.02, (rng() - 0.5) * 0.12, (rng() - 0.5) * 0.09);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0.05, flatShading: true });
  }

  _box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  _buildBody(rng) {
    const pal = Enemy.PALETTES[this.type];
    const mJacket = this._tint(pal.jacket, rng);
    const mPants = this._tint(pal.pants, rng);
    const mHelm = this._tint(pal.helm, rng);
    const mMask = new THREE.MeshStandardMaterial({ color: 0x24211c, roughness: 0.95 });
    const mGun = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.55, metalness: 0.65 });
    const mWood = new THREE.MeshStandardMaterial({ color: 0x4e3a26, roughness: 0.8 });
    this.mats = [mJacket, mPants, mHelm, mMask, mGun, mWood];

    const root = this.root;
    this._box(0.36, 0.2, 0.26, mPants, 0, 0.96, 0, root);            // таз
    const torso = this._box(0.46, 0.56, 0.3, mJacket, 0, 1.3, 0, root);
    this._box(0.48, 0.16, 0.32, mHelm, 0, 1.17, 0, root);            // бронежилет
    this._box(0.24, 0.26, 0.24, mMask, 0, 1.66, 0, root);            // голова (балаклава)
    this._box(0.27, 0.1, 0.27, mHelm, 0, 1.78, 0, root);             // каска
    if (rng() < 0.6) this._box(0.36, 0.42, 0.18, mHelm, 0, 1.34, -0.24, root);  // рюкзак
    if (rng() < 0.5) {                                                // наплечники
      this._box(0.17, 0.09, 0.22, mHelm, -0.29, 1.54, 0, root);
      this._box(0.17, 0.09, 0.22, mHelm, 0.29, 1.54, 0, root);
    }

    // ноги (пивот у бедра — для шага)
    const legGeo = new THREE.BoxGeometry(0.16, 0.94, 0.18);
    legGeo.translate(0, -0.47, 0);
    this.parts = {};
    this.parts.legL = new THREE.Group();
    this.parts.legL.position.set(-0.12, 0.94, 0);
    const lm = new THREE.Mesh(legGeo, mPants);
    lm.castShadow = true;
    this.parts.legL.add(lm);
    root.add(this.parts.legL);
    const legGeo2 = legGeo.clone();
    this.parts.legR = new THREE.Group();
    this.parts.legR.position.set(0.12, 0.94, 0);
    this.parts.legR.add(new THREE.Mesh(legGeo2, mPants));
    root.add(this.parts.legR);

    // руки (держат оружие впереди)
    const armGeo = new THREE.BoxGeometry(0.12, 0.5, 0.13);
    armGeo.translate(0, -0.22, 0);
    this.parts.armR = new THREE.Group();
    this.parts.armR.position.set(0.29, 1.47, 0.02);
    this.parts.armR.rotation.x = -0.35;
    this.parts.armR.add(new THREE.Mesh(armGeo.clone(), mJacket));
    root.add(this.parts.armR);
    this.parts.armL = new THREE.Group();
    this.parts.armL.position.set(-0.29, 1.47, 0.02);
    this.parts.armL.rotation.x = -0.3;
    this.parts.armL.add(new THREE.Mesh(armGeo.clone(), mJacket));
    root.add(this.parts.armL);

    // оружие конкретного типа
    this.parts.gun = new THREE.Group();
    this.parts.gun.position.set(0.1, 1.33, 0.32);
    root.add(this.parts.gun);
    this._buildGun(mGun, mWood);
  }

  _buildGun(mGun, mWood) {
    const g = this.parts.gun;
    const cyl = (r, len, x, y, z) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mGun);
      m.rotation.x = Math.PI / 2;
      m.position.set(x, y, z);
      g.add(m);
    };
    const bx = (w, h, d, mat, x, y, z, rx) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      g.add(m);
    };
    let muzzleZ = 0.5;
    if (this.type === 'shotgun') {
      cyl(0.03, 0.85, 0, 0.02, 0.28);
      bx(0.05, 0.05, 0.16, mGun, 0, -0.05, 0.3);              // цевьё-помпа
      bx(0.055, 0.09, 0.22, mGun, 0, 0, -0.05);               // ствольная коробка
      bx(0.05, 0.09, 0.24, mWood, 0, -0.02, -0.26, 0.12);     // приклад
      muzzleZ = 0.74;
    } else if (this.type === 'rifle') {
      bx(0.05, 0.09, 0.4, mGun, 0, 0, 0.05);                  // ствольная коробка
      cyl(0.015, 0.3, 0, 0.015, 0.4);                         // ствол
      bx(0.04, 0.14, 0.08, mGun, 0, -0.1, 0.12, 0.3);         // магазин
      bx(0.045, 0.08, 0.22, mWood, 0, -0.01, -0.22);          // приклад
      muzzleZ = 0.58;
    } else { // pistol
      bx(0.045, 0.06, 0.22, mGun, 0, 0.02, 0.06);             // затвор
      bx(0.04, 0.12, 0.06, mGun, 0, -0.06, -0.03, 0.25);      // рукоять
      muzzleZ = 0.19;
    }
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.02, muzzleZ);
    g.add(this.muzzle);
  }

  getMuzzle(out) { return this.muzzle.getWorldPosition(out); }

  _eye(out) { return out.set(this.pos.x, this.pos.y + 1.55 * this.scaleF, this.pos.z); }

  // ---------------- укрытия и перемещение ----------------

  _pointFree(x, z) {
    const gy = this.mgr.world.heightAt(x, z);
    const tb = { x0: x - 0.45, x1: x + 0.45, z0: z - 0.45, z1: z + 0.45, y0: gy, y1: gy + 1.7 };
    const arr = this.mgr.world.grid.query(tb, this._qa);
    let blocked = false;
    for (let i = 0; i < arr.length; i++) {
      if (window.GridLib.overlap(tb, arr[i].box)) { blocked = true; break; }
    }
    this._qa.length = 0;
    return !blocked;
  }

  // Боковой выход из-за укрытия (влево/вправо от нормали)
  _calcPeek() {
    const c = this.cover;
    for (let attempt = 0; attempt < 2; attempt++) {
      const perpX = c.dz * this.side, perpZ = -c.dx * this.side;
      const px = c.x + perpX * 1.2 + c.dx * 0.4;
      const pz = c.z + perpZ * 1.2 + c.dz * 0.4;
      if (this._pointFree(px, pz)) {
        this.peekX = px; this.peekZ = pz;
        return true;
      }
      this.side *= -1;
    }
    return false;
  }

  _tryReposition() {
    const pts = this.mgr.coverPoints;
    const p = this.mgr.player;
    let best = null, bestScore = Infinity;
    for (let i = 0; i < 14; i++) {
      const c = pts[(Math.random() * pts.length) | 0];
      if (!c) break;
      const dHere = Math.hypot(c.x - this.pos.x, c.z - this.pos.z);
      if (dHere < 4 || dHere > 24) continue;
      const dP = Math.hypot(c.x - p.pos.x, c.z - p.pos.z);
      const score = dP + Math.random() * 8 - dHere * 0.3;
      if (score < bestScore && this._pointFree(c.x, c.z)) { bestScore = score; best = c; }
    }
    if (best) { this.cover = best; this.state = 'move'; this.stateT = 0; }
    else { this.state = 'cover'; this.stateT = 0; }
  }

  _faceToward(tx, tz, dt, rate) {
    const target = Math.atan2(tx - this.pos.x, tz - this.pos.z);
    let d = target - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, rate * dt);
  }

  _moveToward(tx, tz, speed, dt) {
    const pos = this.pos;
    const dx = tx - pos.x, dz = tz - pos.z;
    const d = Math.hypot(dx, dz);
    this._moving01 = 1;
    if (d < 0.3) { this._moving01 = 0; return true; }
    const px0 = pos.x, pz0 = pos.z;
    const step = Math.min(speed * dt, d);
    pos.x += dx / d * step;
    pos.z += dz / d * step;
    this._faceToward(tx, tz, dt, 4.5);
    // застревание на углах — сдвиг вбок
    const moved = Math.hypot(pos.x - px0, pos.z - pz0);
    if (moved < step * 0.35) {
      this._stuckT += dt;
      if (this._stuckT > 0.5) {
        this._stuckT = 0;
        const s = Math.random() < 0.5 ? 1 : -1;
        pos.x += -dz / d * s * 0.5;
        pos.z += dx / d * s * 0.5;
      }
    } else this._stuckT = 0;
    return d - step < 0.3;
  }

  // Физика: выталкивание из AABB + земля (рельеф/ящики)
  _resolvePhysics() {
    const w = this.mgr.world;
    const pos = this.pos;
    const r = 0.38 * this.scaleF;
    const h = 1.75 * this.scaleF;
    for (let iter = 0; iter < 3; iter++) {
      const qb = { x0: pos.x - r, x1: pos.x + r, z0: pos.z - r, z1: pos.z + r, y0: pos.y, y1: pos.y + h };
      const arr = w.grid.query(qb, this._qa);
      let pushed = false;
      for (let i = 0; i < arr.length; i++) {
        const bb = arr[i].box;
        if (!window.GridLib.overlap(qb, bb)) continue;
        if (bb.y1 <= pos.y + 0.55 || bb.y0 >= pos.y + h) continue; // автошаг / над головой
        const px = Math.min(qb.x1 - bb.x0, bb.x1 - qb.x0);
        const pz = Math.min(qb.z1 - bb.z0, bb.z1 - qb.z0);
        if (px < pz) pos.x += (pos.x < (bb.x0 + bb.x1) * 0.5 ? -px : px);
        else pos.z += (pos.z < (bb.z0 + bb.z1) * 0.5 ? -pz : pz);
        qb.x0 = pos.x - r; qb.x1 = pos.x + r;
        qb.z0 = pos.z - r; qb.z1 = pos.z + r;
        pushed = true;
      }
      this._qa.length = 0;
      if (!pushed) break;
    }
    // земля
    let ground = w.heightAt(pos.x, pos.z);
    const qb2 = { x0: pos.x - r, x1: pos.x + r, z0: pos.z - r, z1: pos.z + r, y0: pos.y - 1.0, y1: pos.y + 0.6 };
    const arr2 = w.grid.query(qb2, this._qa);
    for (let i = 0; i < arr2.length; i++) {
      const bb = arr2[i].box;
      if (!window.GridLib.overlapXZ(qb2, bb)) continue;
      if (bb.y1 <= pos.y + 0.55 && bb.y1 > ground) ground = bb.y1;
    }
    this._qa.length = 0;
    pos.y = ground;
  }

  // Мягкое разделение с другими врагами и игроком
  _separate() {
    const pos = this.pos;
    const list = this.mgr.list;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === this || o.dead) continue;
      const dx = pos.x - o.pos.x, dz = pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.81 && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (0.9 - d) * 0.5;
        pos.x += dx / d * push;
        pos.z += dz / d * push;
      }
    }
    const p = this.mgr.player;
    const pdx = pos.x - p.pos.x, pdz = pos.z - p.pos.z;
    const pd2 = pdx * pdx + pdz * pdz;
    if (pd2 < 0.81 && pd2 > 1e-6) {
      const pd = Math.sqrt(pd2);
      pos.x += pdx / pd * (0.9 - pd);
      pos.z += pdz / pd * (0.9 - pd);
    }
  }

  // ---------------- ИИ ----------------

  update(dt) {
    const mgr = this.mgr;
    const p = mgr.player;
    const spec = this.spec;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    // линия видимости — с интервалом (экономия лучей)
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.16 + Math.random() * 0.12;
      this.hasLOS = p.alive && !mgr.combat.losBlocked(this._eye(this._v2), p.eyePoint(this._v3));
    }

    this.stateT += dt;
    switch (this.state) {
      case 'hold': { // ждёт за укрытием, оружие опущено
        this._faceToward(p.pos.x, p.pos.z, dt, 2.0);
        if (p.alive && this.hasLOS && dist < spec.range) {
          if (this._calcPeek()) { this.state = 'peek'; this.stateT = 0; }
        } else if (p.alive && this.hasLOS && dist >= spec.range) {
          this.repositionT -= dt;
          if (this.repositionT <= 0) {
            this.repositionT = 5 + Math.random() * 6;
            this._tryReposition(); // сближается перебежками
          }
        }
        break;
      }
      case 'peek': { // вышел из-за укрытия
        const arrived = this._moveToward(this.peekX, this.peekZ, mgr.moveSpeed, dt);
        if (arrived || this.stateT > 2.2) {
          this.state = 'aim'; this.stateT = 0; this.aimT = 0;
          this.aimTime = Weapon.randRange(spec.aimTime);
        }
        break;
      }
      case 'aim': { // поднял оружие, целится
        this._faceToward(p.pos.x, p.pos.z, dt, mgr.aimFaceRate);
        this.aimT += dt;
        if (!p.alive || (!this.hasLOS && this.stateT > 1.2) || (dist > spec.range * 1.2 && this.stateT > 1.5)) {
          this.state = 'cover'; this.stateT = 0;
          break;
        }
        if (this.aimT >= this.aimTime && this.hasLOS) {
          this.weapon.cd = 0;
          this.state = 'fire'; this.stateT = 0;
        }
        break;
      }
      case 'fire': { // стрельба (залп / очередь / одиночный)
        this._faceToward(p.pos.x, p.pos.z, dt, mgr.aimFaceRate);
        if (!p.alive || !this.hasLOS) { this._afterFire(); break; }
        if (this.weapon.cd <= 0) this.weapon.tryFire(mgr.ctx);
        if (this.weapon.burstLeft === 0 && this.weapon.cd > 0.5) this._afterFire();
        else if (this.stateT > 3.4) this._afterFire();
        break;
      }
      case 'cover': { // вернулся за укрытие
        const arrived = this._moveToward(this.cover.x, this.cover.z, mgr.moveSpeed, dt);
        if (arrived || this.stateT > 2.6) { this.state = 'hold'; this.stateT = 0; }
        break;
      }
      case 'move': { // перебежка к новой позиции
        const arrived = this._moveToward(this.cover.x, this.cover.z, mgr.moveSpeed * 1.15, dt);
        if (arrived || this.stateT > 5.5) { this.state = 'hold'; this.stateT = 0; }
        break;
      }
    }

    this.weapon.update(dt);
    this._resolvePhysics();
    this._separate();
    this._animate(dt);
    this._flashUpdate(dt);
  }

  _afterFire() {
    if (Math.random() < 0.35) this._tryReposition();
    else { this.state = 'cover'; this.stateT = 0; }
  }

  // ---------------- анимация ----------------

  _animate(dt) {
    const moving = this._moving01;
    this.walkPhase += dt * (3.5 + 7 * moving);
    const sw = Math.sin(this.walkPhase) * 0.5 * moving;
    this.parts.legL.rotation.x = sw;
    this.parts.legR.rotation.x = -sw;

    const combatPose = this.state === 'aim' || this.state === 'fire';
    const k2 = 1 - Math.exp(-9 * dt);
    const tR = combatPose ? -1.3 : -0.32;
    const tL = combatPose ? -1.05 : -0.28;
    this.parts.armR.rotation.x += (tR - this.parts.armR.rotation.x) * k2;
    this.parts.armL.rotation.x += (tL - this.parts.armL.rotation.x) * k2;

    // наклон ствола на игрока
    let pitch = 0.14;
    if (combatPose) {
      const p = this.mgr.player;
      const dh = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) || 0.001;
      pitch = -Math.atan2((p.pos.y + 1.3) - (this.pos.y + 1.33 * this.scaleF), dh);
      pitch = Math.max(-0.6, Math.min(0.6, pitch));
    }
    this.parts.gun.rotation.x += (pitch - this.parts.gun.rotation.x) * k2;
    this._moving01 = 0;
  }

  _flashUpdate(dt) {
    if (this._flashT <= 0) {
      if (this._flashOn) {
        this._flashOn = false;
        for (let i = 0; i < this.mats.length; i++) this.mats[i].emissive.setHex(0x000000);
      }
      return;
    }
    this._flashT -= dt;
    if (this._flashT <= 0 && this._flashOn) {
      this._flashOn = false;
      for (let i = 0; i < this.mats.length; i++) this.mats[i].emissive.setHex(0x000000);
    } else if (!this._flashOn) {
      this._flashOn = true;
      for (let i = 0; i < this.mats.length; i++) this.mats[i].emissive.setHex(0x8a1a10);
    }
  }

  // ---------------- урон и смерть ----------------

  takeDamage(amount, point, dir) {
    if (this.dead) return;
    this.health -= amount;
    if (point) this.mgr.combat.blood(point);
    this._flashT = 0.1;
    if (this.health <= 0) this.die(dir);
  }

  die(dir) {
    this.dead = true;
    this.state = 'dead';
    this.deadT = 0;
    this.fallSign = dir ? (dir.x >= 0 ? 1 : -1) : 1;
    for (let i = 0; i < this.mats.length; i++) this.mats[i].transparent = true;
    window.AudioSys.enemyDown();
    this.mgr.onEnemyKilled(this);

    // трофеи
    const P = window.CFG.combat.pickups;
    const r = Math.random();
    if (r < P.ammoChance) this.mgr.spawnPickup('ammo', this.pos.x, this.pos.z);
    else if (r < P.ammoChance + P.medkitChance) this.mgr.spawnPickup('medkit', this.pos.x, this.pos.z);
  }

  _deathUpdate(dt) {
    this.deadT += dt;
    const t = Math.min(1, this.deadT / 0.55);
    const ease = 1 - (1 - t) * (1 - t);
    this.root.rotation.z = this.fallSign * 1.5 * ease;
    this.root.position.y = this.mgr.world.heightAt(this.pos.x, this.pos.z) - 0.06 * ease;
    if (this.deadT > 3.2) {
      const o = Math.max(0, 1 - (this.deadT - 3.2) / 1.0);
      for (let i = 0; i < this.mats.length; i++) this.mats[i].opacity = o;
      if (o <= 0) this.mgr.removeEnemy(this);
    }
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (let i = 0; i < this.mats.length; i++) this.mats[i].dispose();
    this.mats.length = 0;
  }
};

// ------------------------------------------------------------
//  EnemyManager — спавн, учёт, пикапы
// ------------------------------------------------------------
window.EnemyManager = class EnemyManager {
  constructor(world, combat, player, scene) {
    this.world = world;
    this.combat = combat;
    this.player = player;
    this.scene = scene;
    this.list = [];
    this.pickups = [];
    this.kills = 0;
    this.coverPoints = [];
    this.moveSpeed = window.CFG.combat.enemies.moveSpeed;
    this.aimFaceRate = window.CFG.combat.enemies.aimFaceRate;
    this.ctx = { combat: combat, player: player, enemies: this, hud: window.HUD };
    this.group = new THREE.Group();
    this.group.name = 'Enemies';
    scene.add(this.group);
    this._qa = [];
    this.statT = 0;
  }

  // Сбор точек укрытий: обходим статические коллайдеры (стены,
  // груды, камни, машины) и берём свободные места рядом с ними.
  // Порядок grid.items детерминирован — точки воспроизводимы.
  gatherCoverPoints() {
    const L = window.GridLib.LAYERS;
    const half = window.CFG.map.size / 2 - 2.5;
    const used = new Set();
    const pts = [];
    const items = this.world.grid.items;
    for (let i = 0; i < items.length && pts.length < 460; i++) {
      const it = items[i];
      if (!(it.layer & (L.BUILDING | L.PROP))) continue;
      const b = it.box;
      const sy = b.y1 - b.y0;
      if (sy < 1.0) continue;
      const sx = b.x1 - b.x0, sz = b.z1 - b.z0;
      if (Math.max(sx, sz) < 0.5) continue;
      const cx = (b.x0 + b.x1) * 0.5, cz = (b.z0 + b.z1) * 0.5;
      const rad = Math.max(sx, sz) * 0.5;
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + 0.39;
        const dx = Math.cos(a), dz = Math.sin(a);
        const px = cx + dx * (rad + 0.9), pz = cz + dz * (rad + 0.9);
        if (Math.abs(px) > half || Math.abs(pz) > half) continue;
        const key = Math.round(px / 3) * 4096 + Math.round(pz / 3);
        if (used.has(key)) continue;
        const gy = this.world.heightAt(px, pz);
        const tb = { x0: px - 0.45, x1: px + 0.45, z0: pz - 0.45, z1: pz + 0.45, y0: gy, y1: gy + 1.7 };
        if (this._boxBlocked(tb)) continue;
        used.add(key);
        pts.push({ x: px, z: pz, dx: dx, dz: dz });
        if (pts.length >= 460) break;
      }
    }
    this.coverPoints = pts;
    return pts.length;
  }

  _boxBlocked(tb) {
    const arr = this.world.grid.query(tb, this._qa);
    let blocked = false;
    for (let i = 0; i < arr.length; i++) {
      if (window.GridLib.overlap(tb, arr[i].box)) { blocked = true; break; }
    }
    this._qa.length = 0;
    return blocked;
  }

  // Спавн «за укрытиями»: seeded-шафл → один seed даёт тот же
  // расклад врагов. Укрытие выбирается так, чтобы стоять между
  // врагом и точкой появления игрока.
  async spawnAll(onProgress) {
    this.gatherCoverPoints();
    const rng = window.RNG.mulberry32(window.RNG.hashCombine(this.world.seed, 0xE1A7, 7));
    const pts = this.coverPoints.slice();
    for (let i = pts.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      const t = pts[i]; pts[i] = pts[j]; pts[j] = t;
    }
    const CFGc = window.CFG.combat;
    const S = window.CFG.spawn;
    const types = ['shotgun', 'rifle', 'pistol'];
    const weights = [
      CFGc.enemies.types.shotgun.weight,
      CFGc.enemies.types.rifle.weight,
      CFGc.enemies.types.pistol.weight
    ];
    const chosen = [];
    for (let i = 0; i < pts.length && this.list.length < CFGc.enemies.count; i++) {
      const c = pts[i];
      const dSpawn = Math.hypot(c.x - S.x, c.z - S.z);
      if (dSpawn < CFGc.enemies.spawnMinDist) continue;
      const inv = 1 / (dSpawn || 1);
      if (c.dx * (S.x - c.x) * inv + c.dz * (S.z - c.z) * inv > 0.25) continue;
      let tooClose = false;
      for (let k = 0; k < chosen.length; k++) {
        if (Math.hypot(c.x - chosen[k].x, c.z - chosen[k].z) < 6) { tooClose = true; break; }
      }
      if (tooClose) continue;
      const roll = rng();
      let acc = 0, type = types[2];
      for (let ti = 0; ti < types.length; ti++) {
        acc += weights[ti];
        if (roll < acc) { type = types[ti]; break; }
      }
      const e = new Enemy(this, type, c.x, c.z, rng, c);
      this.list.push(e);
      chosen.push(c);
      if (this.list.length % 4 === 0 && onProgress) {
        onProgress(this.list.length / CFGc.enemies.count);
        await new Promise((r2) => requestAnimationFrame(r2));
      }
    }
    window.HUD.setStats(this.kills, this.aliveCount());
    return this.list.length;
  }

  aliveCount() {
    let n = 0;
    for (let i = 0; i < this.list.length; i++) if (!this.list[i].dead) n++;
    return n;
  }

  update(dt, aiActive) {
    const act = window.CFG.combat.enemies.activationDist;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.dead) { e._deathUpdate(dt); continue; }
      if (!aiActive) continue;
      const dx = e.pos.x - this.player.pos.x, dz = e.pos.z - this.player.pos.z;
      if (dx * dx + dz * dz > act * act) continue;
      e.update(dt);
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      if (this.pickups[i].update(dt, this.player)) {
        this.group.remove(this.pickups[i].mesh);
        this.pickups.splice(i, 1);
      }
    }
    this.statT -= dt;
    if (this.statT <= 0) {
      this.statT = 0.4;
      window.HUD.setStats(this.kills, this.aliveCount());
    }
  }

  onEnemyKilled(e) {
    this.kills++;
    if (this.player) this.player.kills++;
    window.HUD.killFeed(e.spec.label + ' уничтожен');
  }

  spawnPickup(kind, x, z) {
    const p = new Pickup(kind, x, z, this.world);
    this.group.add(p.mesh);
    this.pickups.push(p);
  }

  removeEnemy(e) {
    this.group.remove(e.root);
    e.dispose();
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
  }

  dispose() {
    for (let i = 0; i < this.list.length; i++) this.list[i].dispose();
    for (let i = 0; i < this.pickups.length; i++) this.pickups[i].dispose();
    this.scene.remove(this.group);
    this.list.length = 0;
    this.pickups.length = 0;
    this.coverPoints.length = 0;
  }
};

// ------------------------------------------------------------
//  Pickup — трофей: ящик патронов или аптечка
// ------------------------------------------------------------
window.Pickup = class Pickup {
  constructor(kind, x, z, world) {
    this.kind = kind;
    this.baseY = world.heightAt(x, z) + 0.12;
    this.mesh = new THREE.Group();
    this.mesh.name = 'Pickup_' + kind;
    this.mesh.position.set(x, this.baseY, z);
    this.t = Math.random() * 6.28;

    if (kind === 'ammo') {
      const mBox = new THREE.MeshStandardMaterial({ color: 0x3f4c38, roughness: 0.7, metalness: 0.15 });
      const mBrass = new THREE.MeshStandardMaterial({ color: 0xb9974f, roughness: 0.3, metalness: 0.9 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.22), mBox);
      this.mesh.add(box);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.24), mBox);
      lid.position.y = 0.095;
      this.mesh.add(lid);
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 6), mBrass);
        b.position.set(-0.08 + i * 0.08, 0.15, 0);
        this.mesh.add(b);
      }
    } else {
      const mWhite = new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.65 });
      const mRed = new THREE.MeshStandardMaterial({ color: 0xa32c22, roughness: 0.6 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.26), mWhite);
      this.mesh.add(box);
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.06), mRed);
      c1.position.y = 0.085;
      this.mesh.add(c1);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.2), mRed);
      c2.position.y = 0.085;
      this.mesh.add(c2);
    }
  }

  // true — подобран
  update(dt, player) {
    this.t += dt;
    this.mesh.rotation.y = this.t * 1.3;
    this.mesh.position.y = this.baseY + 0.08 + Math.sin(this.t * 2.4) * 0.05;
    const P = window.CFG.combat.pickups;
    const dx = player.pos.x - this.mesh.position.x;
    const dz = player.pos.z - this.mesh.position.z;
    if (player.alive && dx * dx + dz * dz < P.pickupRadius * P.pickupRadius) {
      if (this.kind === 'ammo') {
        player.rifle.addAmmo(P.ammoAmount);
        window.HUD.setAmmo(player.rifle.ammo);
        window.HUD.toast('+' + P.ammoAmount + ' патронов');
      } else {
        player.heal(P.medkitAmount);
        window.HUD.toast('+' + P.medkitAmount + ' здоровья');
      }
      window.AudioSys.pickup();
      this.dispose();
      return true;
    }
    return false;
  }

  dispose() {
    this.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
};
