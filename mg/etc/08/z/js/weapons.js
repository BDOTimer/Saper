// ============================================================
//  ОРУЖИЕ — всё инкапсулировано в классах.
//    Weapon        — базовый класс (кулдаун, общий для всех)
//    Rifle         — винтовка игрока, 20 патронов, hitscan
//    Knife         — нож (конус удара), достаётся при пустом магазине
//    WeaponRig     — процедурные вьюмодели на камере: sway, bob,
//                    отдача, анимации смены/удара
//    EnemyWeapon   — оружие врагов: дробовик (залп), автомат
//                    (очередь по 3), пистолет (одиночные)
// ============================================================

window.Weapon = class Weapon {
  constructor(spec) {
    this.spec = spec;
    this.cd = 0; // время до следующего выстрела
  }
  update(dt) { this.cd = Math.max(0, this.cd - dt); }
  get ready() { return this.cd <= 0; }

  // Случайное отклонение луча внутри конуса (гауссоподобное:
  // сумма двух равномерных). dir мутируется и нормализуется.
  static applyCone(dir, ang) {
    if (ang <= 0) return dir;
    const ux = Math.abs(dir.y) > 0.98 ? 1 : 0;
    const uy = 0, uz = Math.abs(dir.y) > 0.98 ? 0 : 1;
    // right = normalize(cross(dir, up))
    let rx = dir.y * uz - dir.z * uy;
    let ry = dir.z * ux - dir.x * uz;
    let rz = dir.x * uy - dir.y * ux;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    // up2 = cross(right, dir)
    const ux2 = ry * dir.z - rz * dir.y;
    const uy2 = rz * dir.x - rx * dir.z;
    const uz2 = rx * dir.y - ry * dir.x;
    const r1 = (Math.random() + Math.random() - 1) * ang;
    const r2 = (Math.random() + Math.random() - 1) * ang;
    dir.x += rx * r1 + ux2 * r2;
    dir.y += ry * r1 + uy2 * r2;
    dir.z += rz * r1 + uz2 * r2;
    return dir.normalize();
  }
  static randRange(a) { return a[0] + Math.random() * (a[1] - a[0]); }
};

// ------------------------------------------------------------
//  Винтовка игрока: ограниченный магазин (20), hitscan с
//  разбросом (от бедра / при прицеливании), отдача, хитзоны.
// ------------------------------------------------------------
window.Rifle = class Rifle extends Weapon {
  constructor(spec) {
    super(spec);
    this.ammo = spec.ammo;
  }
  addAmmo(n) { this.ammo = Math.min(this.spec.ammoCap, this.ammo + n); }

  // ctx: {origin, dir, aiming, movePenalty, combat, player, rig, hud}
  tryFire(ctx) {
    if (this.cd > 0 || this.ammo <= 0) return false;
    this.cd = this.spec.cooldown;
    this.ammo--;

    const spread = ((ctx.aiming
      ? this.spec.spreadAimDeg
      : this.spec.spreadHipDeg + ctx.movePenalty) * Math.PI) / 180;
    const dir = ctx.combat._v1.copy(ctx.dir);
    Weapon.applyCone(dir, spread);

    const hit = ctx.combat.resolveShot(ctx.origin, dir, this.spec.range, 'player');
    const end = hit
      ? hit.point
      : new THREE.Vector3().copy(ctx.origin).addScaledVector(dir, this.spec.range);

    // трассер + вспышка из ствола
    const muzzle = ctx.rig.muzzleWorld(new THREE.Vector3());
    ctx.combat.tracer(muzzle, end);
    ctx.combat.flash(muzzle, 0.5);

    if (hit) {
      if (hit.kind === 'enemy') {
        hit.enemy.takeDamage(this.spec.damage * hit.mul, hit.point, dir);
        ctx.hud.hitmarker(hit.enemy.dead);
        if (hit.enemy.dead) window.AudioSys.kill();
        else window.AudioSys.hitTick();
      } else {
        ctx.combat.impact(hit);
      }
    }

    ctx.player.addRecoil();
    window.AudioSys.shot('rifle', 1);
    ctx.hud.setAmmo(this.ammo);
    return true;
  }
};

// ------------------------------------------------------------
//  Нож: конусный удар ближнего боя. Бесконечный.
// ------------------------------------------------------------
window.Knife = class Knife extends Weapon {
  constructor(spec) {
    super(spec);
  }

  // ctx: {origin, dir, combat, player, rig, hud, enemies}
  tryFire(ctx) {
    if (this.cd > 0) return false;
    this.cd = this.spec.cooldown;
    window.AudioSys.knife();
    ctx.rig.swing();

    const origin = ctx.origin, dir = ctx.dir;
    const arcCos = Math.cos((this.spec.arcDeg * Math.PI) / 180);
    const r2max = (this.spec.range + 0.6) * (this.spec.range + 0.6);
    let best = null;
    const list = ctx.enemies.list;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;
      const ex = e.root.position.x - origin.x;
      const ey = e.root.position.y + 1.1 * e.scaleF - origin.y;
      const ez = e.root.position.z - origin.z;
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 > r2max) continue;
      const dist = Math.sqrt(d2) || 0.001;
      const dot = (ex * dir.x + ey * dir.y + ez * dir.z) / dist;
      if (dot < arcCos) continue;
      if (!best || dist < best.dist) best = { e: e, dist: dist };
    }
    if (best) {
      const toE = new THREE.Vector3(
        best.e.root.position.x - origin.x,
        best.e.root.position.y + 1.1 * best.e.scaleF - origin.y,
        best.e.root.position.z - origin.z).normalize();
      const blocked = ctx.combat.raycastWorld(origin, toE, best.dist - 0.3);
      if (!blocked) {
        const point = new THREE.Vector3().copy(origin).addScaledVector(toE, best.dist);
        best.e.takeDamage(this.spec.damage, point, toE);
        ctx.hud.hitmarker(best.e.dead);
        window.AudioSys.knifeHit();
        if (best.e.dead) window.AudioSys.kill();
      }
    }
    return true;
  }
};

// ------------------------------------------------------------
//  WeaponRig — вьюмодели от первого лица. Процедурные мешы из
//  примитивов, привязаны к камере. Смена оружия — с анимацией
//  «приседания», у винтовки есть мушка и точка дула.
// ------------------------------------------------------------
window.WeaponRig = class WeaponRig {
  constructor(camera) {
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.name = 'WeaponRig';
    camera.add(this.root);

    this.mMetal = new THREE.MeshStandardMaterial({ color: 0x2a2b28, roughness: 0.5, metalness: 0.6 });
    this.mWood = new THREE.MeshStandardMaterial({ color: 0x5a432c, roughness: 0.75, metalness: 0.05 });
    this.mSteel = new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.32, metalness: 0.85 });
    this.mDark = new THREE.MeshStandardMaterial({ color: 0x171819, roughness: 0.6, metalness: 0.4 });

    this.rifleG = this._buildRifle();
    this.knifeG = this._buildKnife();
    this.root.add(this.rifleG);
    this.root.add(this.knifeG);

    this.mode = 'rifle';
    this.rifleG.visible = true;
    this.knifeG.visible = false;

    // анимационное состояние
    this.bobT = 0;
    this.kick = 0;
    this.swayX = 0; this.swayY = 0;
    this.swingT = 1;
    this.switchT = 1;
    this.aim01 = 0;
    this._rx = 0; this._ry = 0; this._rz = 0;

    this.RIFLE_HIP = { x: 0.27, y: -0.26, z: -0.5, ry: 0.05 };
    this.RIFLE_AIM = { x: 0.0, y: -0.238, z: -0.42, ry: 0.0 };
    this.KNIFE_BASE = { x: 0.31, y: -0.31, z: -0.44, ry: -0.2 };
  }

  _box(w, h, d, mat, x, y, z, rx) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    return m;
  }

  _buildRifle() {
    const g = new THREE.Group();
    g.add(this._box(0.055, 0.085, 0.44, this.mMetal, 0, 0, -0.12));       // ствольная коробка
    g.add(this._box(0.045, 0.105, 0.22, this.mWood, 0, -0.015, 0.13));    // приклад
    g.add(this._box(0.05, 0.062, 0.26, this.mWood, 0, -0.004, -0.42));    // цевьё
    g.add(this._box(0.012, 0.034, 0.05, this.mDark, 0, 0.062, -0.28));    // мушка
    g.add(this._box(0.038, 0.11, 0.065, this.mDark, 0, -0.095, -0.1, 0.22)); // магазин
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.36, 8), this.mSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.008, -0.62);
    g.add(barrel);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.008, -0.82);
    g.add(muzzle);
    this.rifleMuzzle = muzzle;
    return g;
  }

  _buildKnife() {
    const g = new THREE.Group();
    g.add(this._box(0.032, 0.04, 0.15, this.mDark, 0, 0, 0.06));          // рукоять
    g.add(this._box(0.055, 0.014, 0.02, this.mSteel, 0, 0, -0.03));       // гарда
    const blade = this._box(0.014, 0.052, 0.30, this.mSteel, 0, 0.006, -0.19);
    g.add(blade);
    const tip = this._box(0.014, 0.032, 0.06, this.mSteel, 0, 0.016, -0.35);
    tip.rotation.x = 0.18;
    g.add(tip);
    return g;
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.switchT = 0;
    this.rifleG.visible = mode === 'rifle';
    this.knifeG.visible = mode === 'knife';
  }

  swing() { if (this.swingT >= 1) this.swingT = 0; }
  kickAdd(k) { this.kick = Math.min(1.6, this.kick + k); }

  muzzleWorld(out) { return this.rifleMuzzle.getWorldPosition(out); }

  // o: {move01, aiming, mdx, mdy}
  update(dt, o) {
    const k = 1 - Math.exp(-10 * dt);

    // инерция мыши (sway)
    this.swayX += (Math.max(-0.06, Math.min(0.06, -o.mdx * 0.0016)) - this.swayX) * k;
    this.swayY += (Math.max(-0.05, Math.min(0.05, o.mdy * 0.0013)) - this.swayY) * k;

    // шаг / дыхание
    this.bobT += dt * (4 + 9 * o.move01);
    const bobX = Math.cos(this.bobT) * 0.009 * o.move01;
    const bobY = Math.sin(this.bobT * 2) * 0.011 * o.move01 + Math.sin(this.bobT * 0.6) * 0.0035;

    // отдача
    this.kick = Math.max(0, this.kick - dt * 6.5);

    // прицеливание
    this.aim01 += ((o.aiming ? 1 : 0) - this.aim01) * (1 - Math.exp(-12 * dt));

    // смена оружия — «приседание»
    if (this.switchT < 1) this.switchT = Math.min(1, this.switchT + dt / 0.22);
    const dip = Math.sin(Math.min(1, this.switchT) * Math.PI) * 0.3;

    // винтовка
    const B = this.RIFLE_HIP, A = this.RIFLE_AIM, t = this.aim01;
    this.rifleG.position.set(
      B.x + (A.x - B.x) * t + bobX * (1 - t * 0.8) + this.swayX,
      B.y + (A.y - B.y) * t + bobY * (1 - t * 0.8) + this.swayY - dip,
      B.z + (A.z - B.z) * t + this.kick * 0.075);
    this.rifleG.rotation.set(this.kick * 0.11 + this.swayY * 0.9, B.ry * (1 - t), this.swayX * 1.4);

    // нож: замах при ударе
    if (this.swingT < 1) this.swingT = Math.min(1, this.swingT + dt / 0.26);
    const s = Math.sin(Math.min(1, this.swingT) * Math.PI);
    const KB = this.KNIFE_BASE;
    this.knifeG.position.set(
      KB.x + bobX + this.swayX - s * 0.16,
      KB.y + bobY + this.swayY - dip + s * 0.05,
      KB.z - s * 0.26 + this.kick * 0.04);
    this.knifeG.rotation.set(-0.25 - s * 1.15 + this.kick * 0.05, KB.ry + s * 0.4, s * 0.55);
  }
};

// ------------------------------------------------------------
//  EnemyWeapon — оружие врагов. Стрельба по игроку с разбросом,
//  который растёт с дистанцией и движением игрока.
//  shotgun: залп из N дробин (попадание любой = одно событие урона)
//  rifle:   очередь из 3 выстрелов
//  pistol:  одиночные выстрелы
// ------------------------------------------------------------
window.EnemyWeapon = class EnemyWeapon {
  constructor(type, spec, enemy) {
    this.type = type;
    this.spec = spec;
    this.enemy = enemy;
    this.cd = 0;
    this.burstLeft = 0;
    this._mz = new THREE.Vector3();
    this._tg = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._end = new THREE.Vector3();
  }
  update(dt) { this.cd = Math.max(0, this.cd - dt); }

  // Возвращает true, если выстрел(ы) произошли
  tryFire(ctx) {
    if (this.cd > 0) return false;
    if (this.type === 'shotgun') {
      this._volley(ctx, this.spec.pellets);
      this.cd = Weapon.randRange(this.spec.cooldown);
    } else if (this.type === 'pistol') {
      this._singleShot(ctx);
      this.cd = Weapon.randRange(this.spec.cooldown);
    } else { // автомат — очередь
      if (this.burstLeft <= 0) this.burstLeft = this.spec.burst;
      this._singleShot(ctx);
      this.burstLeft--;
      this.cd = this.burstLeft > 0 ? this.spec.burstInterval : Weapon.randRange(this.spec.cooldown);
    }
    return true;
  }

  _gain(ctx, muzzle) {
    const cam = ctx.player.camera.position;
    const d = cam.distanceTo(muzzle);
    return Math.max(0.12, Math.min(1, 1 - d / 150));
  }

  // Направление на игрока с учётом разброса; возвращает позицию дула
  _aim(ctx, spreadDeg, out) {
    const enemy = this.enemy;
    const muzzle = enemy.getMuzzle(this._mz);
    this._tg.set(ctx.player.pos.x, ctx.player.pos.y + 1.3, ctx.player.pos.z);
    out.subVectors(this._tg, muzzle).normalize();
    const dist = muzzle.distanceTo(this._tg);
    const v = ctx.player.vel;
    const movePen = v ? Math.min(1.7, Math.hypot(v.x, v.z) * 0.15) : 0;
    const err = (spreadDeg * Math.PI / 180) * (1 + movePen) * (0.55 + dist / (this.spec.range * 1.5));
    Weapon.applyCone(out, err);
    return muzzle;
  }

  _finishShot(ctx, muzzle, hit, maxRange) {
    const end = hit ? hit.point : this._end.copy(muzzle).addScaledVector(this._dir, maxRange);
    ctx.combat.tracer(muzzle, end);
    if (hit && hit.kind !== 'player') ctx.combat.impact(hit);
    if (hit && hit.kind === 'player') {
      ctx.player.takeDamage(window.CFG.combat.playerDamagePercent, muzzle);
    }
    return hit;
  }

  _singleShot(ctx) {
    const muzzle = this._aim(ctx, this.spec.spreadDeg, this._dir);
    ctx.combat.flash(muzzle, 0.45);
    window.AudioSys.shot(this.type, this._gain(ctx, muzzle));
    const hit = ctx.combat.resolveShot(muzzle, this._dir, this.spec.range, this.enemy);
    this._finishShot(ctx, muzzle, hit, this.spec.range);
  }

  _volley(ctx, pellets) {
    const muzzle = this._aim(ctx, this.spec.spreadDeg, this._dir);
    const base = new THREE.Vector3().copy(this._dir);
    ctx.combat.flash(muzzle, 0.6);
    window.AudioSys.shot('shotgun', this._gain(ctx, muzzle));
    let playerHit = false, fx = 0;
    for (let i = 0; i < pellets; i++) {
      // каждая дробина — свой малый конус вокруг общего направления
      const dir = new THREE.Vector3().copy(base);
      Weapon.applyCone(dir, 0.013);
      const hit = ctx.combat.resolveShot(muzzle, dir, this.spec.range, this.enemy);
      if (hit && hit.kind === 'player') playerHit = true;
      else if (hit && fx < 3) { ctx.combat.impact(hit); fx++; }
      const end = hit ? hit.point : this._end.copy(muzzle).addScaledVector(dir, this.spec.range);
      if (i < 4) ctx.combat.tracer(muzzle, end.clone());
    }
    if (playerHit) ctx.player.takeDamage(window.CFG.combat.playerDamagePercent, muzzle);
  }
};
