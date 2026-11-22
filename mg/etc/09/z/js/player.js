// ============================================================
//  FPS-контроллер: WASD + мышь (pointer lock), Shift — бег,
//  Space — прыжок, гравитация. Коллизии — AABB против spatial
//  grid + аналитический heightfield. Автошаг на низкие препятствия,
//  вставание на коробки/груды, лёгкий head-bob и FOV при беге.
//  Слои физики: игрок маскируется против BUILDING|PROP|DEBRIS.
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

    var self = this;
    document.addEventListener('keydown', function (e) {
      self.keys[e.code] = true;
      if (e.code === 'Space' && self.locked) e.preventDefault();
    });
    document.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
    document.addEventListener('mousemove', function (e) {
      if (!self.locked) return;
      self.yaw -= e.movementX * c.mouseSens;
      self.pitch -= e.movementY * c.mouseSens;
      self.pitch = window.Util.clamp(self.pitch, -1.53, 1.53);
    });
    document.addEventListener('pointerlockchange', function () {
      self.locked = document.pointerLockElement === self.dom;
    });
  }

  Player.prototype.reset = function () {
    var w = this.getWorld();
    var c = this.cfg.player;
    this.pos.set(this.cfg.spawn.x, w.heightAt(this.cfg.spawn.x, this.cfg.spawn.z + 2), this.cfg.spawn.z + 2);
    this.vel.set(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.camera.position.set(this.pos.x, this.pos.y + c.eyeHeight, this.pos.z);
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

  Player.prototype.update = function (dt) {
    var w = this.getWorld();
    if (!w) return;
    var c = this.cfg.player;
    var k = this.keys;

    var f = 0, s = 0;
    if (this.locked) {
      if (k.KeyW) f += 1;
      if (k.KeyS) f -= 1;
      if (k.KeyD) s += 1;
      if (k.KeyA) s -= 1;
    }
    var run = this.locked && (k.ShiftLeft || k.ShiftRight) && f > 0;
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

    if (this.locked && k.Space && (this.grounded || this.coyote > 0)) {
      this.vel.y = c.jumpVel;
      this.grounded = false;
      this.coyote = 0;
    }
    this.vel.y -= c.gravity * dt;
    if (this.vel.y < -30) this.vel.y = -30;

    this.moveAxis(0, this.vel.x * dt);
    this.moveAxis(2, this.vel.z * dt);
    this.moveY(this.vel.y * dt, dt);

    // head-bob + шаги
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
    var fovT = run ? c.runFov : c.fov;
    this.camera.fov += (fovT - this.camera.fov) * Math.min(1, dt * 6);
    this.camera.updateProjectionMatrix();
  };

  return Player;
})();
