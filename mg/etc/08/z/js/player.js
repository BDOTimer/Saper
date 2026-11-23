// ============================================================
//  FPS-контроллер + состояние игрока. WASD + мышь (pointer lock),
//  Shift — бег, Space — прыжок, гравитация. Коллизии — AABB против
//  spatial grid + аналитический heightfield. Автошаг на низкие
//  препятствия, вставание на коробки/груды, head-bob и FOV при беге.
//
//  Боевая часть: здоровье (100), урон от врагов = 20% за попадание,
//  оружие через WeaponRig — винтовка (20 патронов) и нож
//  (автоматически достаётся, когда патроны кончились). ЛКМ — огонь,
//  ПКМ — прицеливание, 1/2 — смена оружия.
// ============================================================
window.Player = (function () {

  function Player(o) {
    this.cfg = o.CFG;
    this.camera = o.camera;
    this.dom = o.dom;
    this.getWorld = o.getWorld;
    var c = this.cfg.player;
    this.pos = new THREE.Vector3();      // pos.y — НОГИ игрока
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.keys = {};
    this.grounded = false;
    this.coyote = 0;
    this.bobT = 0;
    this.stepAcc = 0;
    this.locked = false;
    this._q = [];
    this._qb = { x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0 };

    // ---------- боевое состояние ----------
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.alive = true;
    this.kills = 0;
    this.rifle = new window.Rifle(this.cfg.combat.rifle);
    this.knifeW = new window.Knife(this.cfg.combat.knife);
    this.weapon = this.rifle;
    this.rig = new window.WeaponRig(this.camera);
    this.fireHeld = false;
    this.aimHeld = false;
    this.aiming = false;
    this._mdx = 0; this._mdy = 0;
    this._autoKnifeT = -1;
    this._eyeV = new THREE.Vector3();
    this._dirV = new THREE.Vector3();
    this._originV = new THREE.Vector3();
    this.combat = null;
    this.enemies = null;

    var self = this;
    document.addEventListener('keydown', function (e) {
      self.keys[e.code] = true;
      if (e.code === 'Space' && self.locked) e.preventDefault();
      if (!self.locked || !self.alive) return;
      if (e.code === 'Digit1') self.switchWeapon('rifle');
      if (e.code === 'Digit2') self.switchWeapon('knife');
    });
    document.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
    document.addEventListener('mousemove', function (e) {
      if (!self.locked) return;
      self.yaw -= e.movementX * c.mouseSens;
      self.pitch -= e.movementY * c.mouseSens;
      self.pitch = window.Util.clamp(self.pitch, -1.53, 1.53);
      self._mdx += e.movementX;
      self._mdy += e.movementY;
    });
    document.addEventListener('mousedown', function (e) {
      if (!self.locked || !self.alive) return;
      if (e.button === 0) self.fireHeld = true;
      if (e.button === 2) self.aimHeld = true;
    });
    document.addEventListener('mouseup', function (e) {
      if (e.button === 0) self.fireHeld = false;
      if (e.button === 2) self.aimHeld = false;
    });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('wheel', function (e) {
      if (!self.locked || !self.alive) return;
      var now = performance.now();
      if (now - (self._wheelT || 0) < 300) return;
      self._wheelT = now;
      self.switchWeapon(self.weapon === self.rifle ? 'knife' : 'rifle');
    });
    document.addEventListener('pointerlockchange', function () {
      self.locked = document.pointerLockElement === self.dom;
      if (!self.locked) { self.fireHeld = false; self.aimHeld = false; }
    });
  }

  // связи с боевыми системами (заполняется после генерации мира)
  Player.prototype.bind = function (deps) {
    this.combat = deps.combat;
    this.enemies = deps.enemies;
  };

  Player.prototype.reset = function () {
    var w = this.getWorld();
    var c = this.cfg.player;
    this.pos.set(this.cfg.spawn.x, w.heightAt(this.cfg.spawn.x, this.cfg.spawn.z + 2), this.cfg.spawn.z + 2);
    this.vel.set(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.camera.position.set(this.pos.x, this.pos.y + c.eyeHeight, this.pos.z);
    // полное боевое восстановление
    this.health = this.maxHealth;
    this.alive = true;
    this.kills = 0;
    this.rifle.ammo = this.cfg.combat.rifle.ammo;
    this.switchWeapon('rifle', true);
    window.HUD.setHealth(this.health, this.maxHealth);
    window.HUD.setAmmo(this.rifle.ammo);
    window.HUD.setWeapon(this.rifle.spec.name);
    window.HUD.setStats(this.kills, this.enemies ? this.enemies.aliveCount() : 0);
  };

  // возрождение после смерти: полное восстановление, счёт убийств сохраняется
  Player.prototype.respawn = function () {
    var w = this.getWorld();
    var c = this.cfg.player;
    this.pos.set(this.cfg.spawn.x, w.heightAt(this.cfg.spawn.x, this.cfg.spawn.z + 2), this.cfg.spawn.z + 2);
    this.vel.set(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.health = this.maxHealth;
    this.alive = true;
    this.rifle.ammo = this.cfg.combat.rifle.ammo;
    this._autoKnifeT = -1;
    this.switchWeapon('rifle', true);
    this.camera.position.set(this.pos.x, this.pos.y + c.eyeHeight, this.pos.z);
    window.HUD.setHealth(this.health, this.maxHealth);
    window.HUD.setAmmo(this.rifle.ammo);
    window.HUD.setWeapon(this.rifle.spec.name);
    window.HUD.setStats(this.kills, this.enemies ? this.enemies.aliveCount() : 0);
  };

  Player.prototype.box = function () {
    var c = this.cfg.player;
    return {
      x0: this.pos.x - c.radius, x1: this.pos.x + c.radius,
      y0: this.pos.y, y1: this.pos.y + c.height,
      z0: this.pos.z - c.radius, z1: this.pos.z + c.radius
    };
  };

  Player.prototype.moveAxis = function (axisIdx, d) {
    if (!d) return;
    var w = this.getWorld();
    var c = this.cfg.player;
    if (axisIdx === 0) this.pos.x += d; else this.pos.z += d;
    var b = this.box();
    this._q.length = 0;
    var out = w.grid.query(b, this._q);
    var feet = this.pos.y, head = this.pos.y + c.height;
    for (var i = 0; i < out.length; i++) {
      var bb = out[i].box;
      if (!window.GridLib.overlap(b, bb)) continue;
      // ступени/низкие препятствия игнорируем, сверху висящие — тоже
      if (bb.y1 <= feet + c.stepHeight + 0.02) continue;
      if (bb.y0 >= head - 0.02) continue;
      if (axisIdx === 0) {
        if (d > 0) this.pos.x = bb.x0 - c.radius - 0.001;
        else this.pos.x = bb.x1 + c.radius + 0.001;
        this.vel.x = 0;
      } else {
        if (d > 0) this.pos.z = bb.z0 - c.radius - 0.001;
        else this.pos.z = bb.z1 + c.radius + 0.001;
        this.vel.z = 0;
      }
      b.x0 = this.pos.x - c.radius; b.x1 = this.pos.x + c.radius;
      b.z0 = this.pos.z - c.radius; b.z1 = this.pos.z + c.radius;
    }
  };

  Player.prototype.moveY = function (dy, dt) {
    var w = this.getWorld();
    var c = this.cfg.player;
    var prevFeet = this.pos.y;
    this.pos.y += dy;

    // земля: рельеф + верхушки коробок в пределах шага
    var ground = w.heightAt(this.pos.x, this.pos.z);
    var qb = this._qb;
    qb.x0 = this.pos.x - c.radius - 0.1; qb.x1 = this.pos.x + c.radius + 0.1;
    qb.z0 = this.pos.z - c.radius - 0.1; qb.z1 = this.pos.z + c.radius + 0.1;
    qb.y0 = this.pos.y - 1.2; qb.y1 = prevFeet + c.stepHeight + 0.05;
    this._q.length = 0;
    var out = w.grid.query(qb, this._q);
    for (var i = 0; i < out.length; i++) {
      var bb = out[i].box;
      if (!window.GridLib.overlapXZ(qb, bb)) continue;
      if (bb.y1 <= prevFeet + c.stepHeight + 0.02 && bb.y1 > ground) ground = bb.y1;
    }

    if (this.pos.y <= ground + 0.001) {
      if (this.vel.y < 0) this.vel.y = 0;
      if (!this.grounded && dy < -4 && window.AudioSys) window.AudioSys.land();
      this.pos.y = ground;
      this.grounded = true;
      this.coyote = 0.12;
    } else {
      this.grounded = false;
      this.coyote = Math.max(0, this.coyote - dt);
    }

    // потолок
    if (this.vel.y > 0) {
      var head = this.pos.y + c.height;
      for (var k = 0; k < out.length; k++) {
        var b2 = out[k].box;
        if (!window.GridLib.overlapXZ(qb, b2)) continue;
        if (b2.y0 >= prevFeet + c.height - 0.05 && b2.y0 <= head) {
          this.pos.y = b2.y0 - c.height - 0.001;
          this.vel.y = 0;
          break;
        }
      }
    }
  };

  // ---------------- оружие ----------------

  Player.prototype.switchWeapon = function (mode, silent) {
    if (mode === 'rifle' && this.rifle.ammo <= 0 && !silent) {
      window.HUD.toast('Патроны закончились');
      return;
    }
    var name;
    if (mode === 'rifle') { this.weapon = this.rifle; name = this.rifle.spec.name; }
    else { this.weapon = this.knifeW; name = this.knifeW.spec.name; }
    this.rig.setMode(mode);
    window.HUD.setWeapon(name);
    window.HUD.setAmmo(mode === 'rifle' ? this.rifle.ammo : null);
    if (!silent) window.AudioSys.swap();
  };

  Player.prototype.addRecoil = function () {
    this.pitch += 0.012;
    this.pitch = window.Util.clamp(this.pitch, -1.53, 1.53);
    this.rig.kickAdd(0.55);
  };

  Player.prototype.onAmmoEmpty = function () {
    window.HUD.toast('Магазин пуст — нож!');
    this._autoKnifeT = 0.35;
  };

  Player.prototype.eyePoint = function (out) {
    return out.set(this.pos.x, this.pos.y + this.cfg.player.eyeHeight, this.pos.z);
  };

  // ---------------- здоровье ----------------

  Player.prototype.takeDamage = function (percent, fromPos) {
    if (!this.alive) return;
    this.health -= this.maxHealth * (percent / 100);
    window.AudioSys.hurt();
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.fireHeld = false;
      this.aimHeld = false;
      window.HUD.setHealth(0, this.maxHealth);
      window.HUD.showDeath(this);
      if (document.exitPointerLock) document.exitPointerLock();
      window.AudioSys.playerDown();
    } else {
      window.HUD.setHealth(this.health, this.maxHealth);
      if (fromPos) {
        // направление на стрелка для индикатора урона
        var ang = Math.atan2(fromPos.x - this.pos.x, fromPos.z - this.pos.z);
        window.HUD.damageFlash((ang - this.yaw) * 180 / Math.PI);
      }
    }
  };

  Player.prototype.heal = function (n) {
    if (!this.alive) return;
    this.health = Math.min(this.maxHealth, this.health + n);
    window.HUD.setHealth(this.health, this.maxHealth);
  };

  // ---------------- главный апдейт ----------------

  Player.prototype.update = function (dt) {
    var w = this.getWorld();
    if (!w) return;
    var c = this.cfg.player;
    var k = this.keys;

    // ---------- движение (только живой и в pointer lock) ----------
    var f = 0, s = 0;
    if (this.locked && this.alive) {
      if (k.KeyW) f += 1;
      if (k.KeyS) f -= 1;
      if (k.KeyD) s += 1;
      if (k.KeyA) s -= 1;
    }
    var run = this.locked && this.alive && (k.ShiftLeft || k.ShiftRight) && f > 0;
    var spd = run ? c.runSpeed : c.walkSpeed;

    var sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    var vx = (-sin) * f + cos * s;
    var vz = (-cos) * f + (-sin) * s;
    var len = Math.hypot(vx, vz);
    if (len > 1) { vx /= len; vz /= len; }

    var ak = this.grounded ? 12 : 2.2;
    var a = 1 - Math.exp(-ak * dt);
    this.vel.x += (vx * spd - this.vel.x) * a;
    this.vel.z += (vz * spd - this.vel.z) * a;

    if (this.locked && this.alive && k.Space && (this.grounded || this.coyote > 0)) {
      this.vel.y = c.jumpVel;
      this.grounded = false;
      this.coyote = 0;
    }
    this.vel.y -= c.gravity * dt;
    if (this.vel.y < -30) this.vel.y = -30;

    this.moveAxis(0, this.vel.x * dt);
    this.moveAxis(2, this.vel.z * dt);
    this.moveY(this.vel.y * dt, dt);

    // ---------- head-bob + шаги ----------
    var hs = Math.hypot(this.vel.x, this.vel.z);
    var bob = 0;
    if (this.grounded && hs > 0.5) {
      this.stepAcc += hs * dt;
      if (this.stepAcc > 2.3) { this.stepAcc = 0; if (window.AudioSys) window.AudioSys.step(run); }
      this.bobT += dt * (6 + hs * 1.6);
      bob = Math.sin(this.bobT * 2.2) * 0.032 * Math.min(1, hs / c.runSpeed);
    } else {
      this.bobT += dt * 1.4;
      bob = Math.sin(this.bobT * 2.2) * 0.004;
    }

    this.camera.position.set(this.pos.x, this.pos.y + c.eyeHeight + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // ---------- боевой блок ----------
    this.aiming = this.aimHeld && this.alive && this.weapon === this.rifle && this.rifle.ammo > 0;
    var fovT = this.aiming ? 56 : (run ? c.runFov : c.fov);
    this.camera.fov += (fovT - this.camera.fov) * Math.min(1, dt * 6);
    this.camera.updateProjectionMatrix();

    if (this.alive && this.combat) {
      // матрицы камеры актуальны для вьюмодели и дула
      this.camera.updateMatrixWorld(true);
      this.rig.update(dt, {
        move01: Math.min(1, hs / c.runSpeed),
        aiming: this.aiming,
        mdx: this._mdx, mdy: this._mdy
      });
      this._mdx = 0; this._mdy = 0;

      this.rifle.update(dt);
      this.knifeW.update(dt);

      // авто-переключение на нож после пустого магазина
      if (this._autoKnifeT > 0) {
        this._autoKnifeT -= dt;
        if (this._autoKnifeT <= 0) this.switchWeapon('knife');
      }

      // стрельба
      if (this.fireHeld && this.locked) {
        if (this.weapon === this.rifle) {
          if (this.rifle.ammo <= 0) {
            this.rifle.cd = 0.3;
            this.onAmmoEmpty();
            this.fireHeld = false;
          } else {
            this._dirV.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
            this._originV.setFromMatrixPosition(this.camera.matrixWorld);
            this.rifle.tryFire({
              origin: this._originV, dir: this._dirV,
              aiming: this.aiming,
              movePenalty: Math.min(2.4, hs / c.walkSpeed * this.cfg.combat.rifle.moveSpreadDeg),
              combat: this.combat, player: this,
              rig: this.rig, hud: window.HUD
            });
          }
        } else {
          this._dirV.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
          this._originV.setFromMatrixPosition(this.camera.matrixWorld);
          this.knifeW.tryFire({
            origin: this._originV, dir: this._dirV,
            combat: this.combat, player: this,
            rig: this.rig, hud: window.HUD,
            enemies: this.enemies
          });
        }
      }
    }
  };

  return Player;
})();
