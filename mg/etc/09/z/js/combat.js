// ============================================================
//  БОЕВОЙ МОДУЛЬ — класс Combat.
//  Вся боевая математика инкапсулирована здесь:
//    • аналитические лучи: AABB-коллайдеры (DDA по spatial grid),
//      рельеф (heightfield), сферы (головы), вертикальные цилиндры
//      (капсулы тел);
//    • хитзоны персонажей: голова x2, тело x1, ноги x0.75;
//    • пулы VFX: трассеры, вспышки выстрелов, частицы (искры
//      бетона, пыль, кровь). Всё переиспользуется — без аллокаций
//      в горячем цикле.
// ============================================================
window.Combat = class Combat {

  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.grid = world.grid;
    this.LAYERS = window.GridLib.LAYERS;
    // пули останавливаются стенами, пропсами и обломками
    this.bulletMask = this.LAYERS.BUILDING | this.LAYERS.PROP | this.LAYERS.DEBRIS;
    this.playerRef = null;
    this.enemiesRef = null;

    this._items = [];
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._v3 = new THREE.Vector3();

    this._initTracers();
    this._initFlashes();
    this._initParticles();
  }

  setWorld(world) { this.world = world; this.grid = world.grid; }
  bind(player, enemies) { this.playerRef = player; this.enemiesRef = enemies; }

  dispose() {
    const all = [];
    for (const t of this.tracers) all.push(t.m);
    for (const f of this.flashes) all.push(f.s);
    for (const b of this.bursts) all.push(b.pts);
    for (const m of all) this.scene.remove(m);
    this.tracers.length = 0; this.flashes.length = 0; this.bursts.length = 0;
  }

  // ---------------- примитивы пересечения лучей ----------------

  // Луч против AABB (метод встречных плоскостей). Луч, начавшийся
  // внутри бокса, игнорируется (стрельба «изнутри» обломков).
  static rayAABB(o, d, b, maxDist) {
    let tmin = 0, tmax = maxDist, axis = -1, sign = 1;
    if (Math.abs(d.x) < 1e-9) { if (o.x < b.x0 || o.x > b.x1) return null; }
    else {
      let t1 = (b.x0 - o.x) / d.x, t2 = (b.x1 - o.x) / d.x, s = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = 0; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (Math.abs(d.y) < 1e-9) { if (o.y < b.y0 || o.y > b.y1) return null; }
    else {
      let t1 = (b.y0 - o.y) / d.y, t2 = (b.y1 - o.y) / d.y, s = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = 1; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (Math.abs(d.z) < 1e-9) { if (o.z < b.z0 || o.z > b.z1) return null; }
    else {
      let t1 = (b.z0 - o.z) / d.z, t2 = (b.z1 - o.z) / d.z, s = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = 2; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (axis === -1) return null; // начало внутри бокса
    return { dist: tmin, axis: axis, sign: sign };
  }

  static axisNormal(d, axis, sign, out) {
    out = out || { x: 0, y: 0, z: 0 };
    out.x = 0; out.y = 0; out.z = 0;
    if (axis === 0) out.x = sign; else if (axis === 1) out.y = sign; else out.z = sign;
    return out;
  }

  // Луч против сферы; возвращает дистанцию или null
  static raySphere(o, d, cx, cy, cz, r, maxDist) {
    const mx = o.x - cx, my = o.y - cy, mz = o.z - cz;
    const b = mx * d.x + my * d.y + mz * d.z;
    const c = mx * mx + my * my + mz * mz - r * r;
    if (c > 0 && b > 0) return null;
    const disc = b * b - c;
    if (disc < 0) return null;
    let t = -b - Math.sqrt(disc);
    if (t < 0) t = 0;
    if (t > maxDist) return null;
    return t;
  }

  // Луч против вертикального ограниченного цилиндра (боковая
  // поверхность + торцы). Капсула персонажа/игрока.
  static rayCylinder(o, d, cx, cz, y0, y1, r, maxDist) {
    let best = null;
    const mx = o.x - cx, mz = o.z - cz;
    const a = d.x * d.x + d.z * d.z;
    if (a > 1e-9) {
      const bq = mx * d.x + mz * d.z;
      const c = mx * mx + mz * mz - r * r;
      const disc = bq * bq - a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        const t1 = (-bq - sq) / a, t2 = (-bq + sq) / a;
        for (let i = 0; i < 2; i++) {
          const t = i === 0 ? t1 : t2;
          if (t < 0 || t > maxDist) continue;
          const y = o.y + d.y * t;
          if (y >= y0 && y <= y1) { best = t; break; }
        }
      }
    }
    if (Math.abs(d.y) > 1e-9) {
      const caps = y0 < y1 ? [y0, y1] : [y1, y0];
      for (let i = 0; i < 2; i++) {
        const t = (caps[i] - o.y) / d.y;
        if (t < 0 || t > maxDist) continue;
        const x = o.x + d.x * t - cx, z = o.z + d.z * t - cz;
        if (x * x + z * z <= r * r && (best === null || t < best)) best = t;
      }
    }
    return best;
  }

  // Луч против рельефа: марш по heightfield + бисекция.
  rayTerrain(o, d, maxDist) {
    const hAt = this.world.heightAt;
    const step = Math.max(1.0, maxDist / 110);
    if (o.y - hAt(o.x, o.z) <= 0) {
      return { dist: 0.02, point: new THREE.Vector3(o.x, o.y, o.z), normal: { x: 0, y: 1, z: 0 } };
    }
    for (let t = step; t <= maxDist; t += step) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y - hAt(x, z) <= 0) {
        let a = t - step, b2 = t;
        for (let i = 0; i < 7; i++) {
          const m = (a + b2) * 0.5;
          const my = o.y + d.y * m - hAt(o.x + d.x * m, o.z + d.z * m);
          if (my <= 0) b2 = m; else a = m;
        }
        const tt = (a + b2) * 0.5;
        const px = o.x + d.x * tt, py = o.y + d.y * tt, pz = o.z + d.z * tt;
        const e = 0.4;
        const nx = hAt(px - e, pz) - hAt(px + e, pz);
        const nz = hAt(px, pz - e) - hAt(px, pz + e);
        const L = Math.hypot(nx, 2 * e, nz) || 1;
        return { dist: tt, point: new THREE.Vector3(px, py, pz), normal: { x: nx / L, y: (2 * e) / L, z: nz / L } };
      }
    }
    return null;
  }

  // Ближайшее попадание луча в мир (стены/пропсы/рельеф)
  raycastWorld(o, d, maxDist) {
    const items = this.grid.rayQuery(o.x, o.z, d.x, d.z, maxDist, this._items);
    let best = null, bestDist = maxDist, bestAxis = 1, bestSign = 1;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if ((it.layer & this.bulletMask) === 0) continue;
      const hit = Combat.rayAABB(o, d, it.box, bestDist);
      if (hit && hit.dist < bestDist) {
        bestDist = hit.dist;
        bestAxis = hit.axis; bestSign = hit.sign;
        best = { dist: hit.dist, point: null, normal: null, item: it, kind: 'world' };
      }
    }
    this._items.length = 0;
    const tHit = this.rayTerrain(o, d, bestDist);
    if (tHit && tHit.dist < bestDist) {
      bestDist = tHit.dist;
      best = { dist: tHit.dist, point: tHit.point, normal: tHit.normal, item: null, kind: 'terrain' };
    }
    if (best) {
      if (!best.point) best.point = new THREE.Vector3(o.x + d.x * best.dist, o.y + d.y * best.dist, o.z + d.z * best.dist);
      if (!best.normal) best.normal = Combat.axisNormal(d, bestAxis, bestSign);
    }
    return best;
  }

  // Хитзоны врага: голова-сфера + тело-цилиндр (ноги ниже 0.85 м)
  raycastEnemy(o, d, e, maxDist) {
    const s = e.scaleF, p = e.root.position;
    let best = null;
    const tH = Combat.raySphere(o, d, p.x, p.y + 1.68 * s, p.z, 0.21 * s, maxDist);
    if (tH !== null) best = { dist: tH, part: 'head', mul: 2 };
    const tB = Combat.rayCylinder(o, d, p.x, p.z, p.y + 0.12, p.y + 1.5 * s, 0.38 * s, best ? Math.min(best.dist, maxDist) : maxDist);
    if (tB !== null) {
      const y = o.y + d.y * tB;
      const part = y < p.y + 0.85 * s ? 'legs' : 'body';
      const mul = part === 'legs' ? 0.75 : 1;
      if (!best || tB < best.dist) best = { dist: tB, part: part, mul: mul };
    }
    if (best) best.point = new THREE.Vector3(o.x + d.x * best.dist, o.y + d.y * best.dist, o.z + d.z * best.dist);
    return best;
  }

  // Полный выстрел: мир + персонажи, возвращает ближайшее попадание.
  // shooter: 'player' | Enemy
  resolveShot(o, d, maxDist, shooter) {
    let best = this.raycastWorld(o, d, maxDist);
    if (shooter === 'player') {
      if (this.enemiesRef) {
        const list = this.enemiesRef.list;
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (e.dead) continue;
          const dx = e.root.position.x - o.x, dz = e.root.position.z - o.z;
          if (dx * dx + dz * dz > (maxDist + 2) * (maxDist + 2)) continue;
          const h = this.raycastEnemy(o, d, e, best ? Math.min(best.dist, maxDist) : maxDist);
          if (h && (!best || h.dist < best.dist)) { h.kind = 'enemy'; h.enemy = e; best = h; }
        }
      }
    } else {
      const p = this.playerRef;
      if (p && p.alive) {
        const t = Combat.rayCylinder(o, d, p.pos.x, p.pos.z, p.pos.y + 0.1, p.pos.y + 1.72, 0.4,
          best ? Math.min(best.dist, maxDist) : maxDist);
        if (t !== null && (!best || t < best.dist)) {
          best = { dist: t, kind: 'player', point: new THREE.Vector3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t) };
        }
      }
    }
    return best;
  }

  // Линия видимости между двумя точками (для ИИ)
  losBlocked(from, to) {
    this._v1.subVectors(to, from);
    const dist = this._v1.length();
    if (dist < 0.001) return false;
    this._v1.multiplyScalar(1 / dist);
    const hit = this.raycastWorld(from, this._v1, dist - 0.35);
    return !!hit;
  }

  // ---------------- эффекты ----------------

  _initTracers() {
    const geo = new THREE.BoxGeometry(0.035, 0.035, 1);
    geo.translate(0, 0, 0.5);
    this.tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffd9a0, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    this.tracers = [];
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(geo, this.tracerMat);
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = 7;
      this.scene.add(m);
      this.tracers.push({ m: m, t: 0 });
    }
    this.tracerIdx = 0;
  }

  tracer(a, b) {
    const it = this.tracers[this.tracerIdx++ % this.tracers.length];
    const len = a.distanceTo(b);
    if (len < 0.3) return;
    it.m.position.copy(a);
    it.m.lookAt(b);
    it.m.scale.set(1, 1, len);
    it.m.visible = true;
    it.t = 0.06;
  }

  _initFlashes() {
    const tex = window.Mat.get().glow;
    this.flashes = [];
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, color: 0xffe0b0, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      s.renderOrder = 8;
      this.scene.add(s);
      this.flashes.push({ s: s, t: 0 });
    }
    this.flashIdx = 0;
  }

  flash(pos, scale) {
    const it = this.flashes[this.flashIdx++ % this.flashes.length];
    it.s.position.copy(pos);
    it.s.material.rotation = Math.random() * Math.PI * 2;
    const k = (scale || 0.55) * (0.75 + Math.random() * 0.5);
    it.s.scale.set(k, k, 1);
    it.s.visible = true;
    it.t = 0.05;
  }

  _initParticles() {
    this.bursts = [];
    for (let i = 0; i < 16; i++) {
      const n = 14;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 1, depthWrite: false });
      const pts = new THREE.Points(geo, mat);
      pts.visible = false;
      pts.frustumCulled = false;
      this.scene.add(pts);
      this.bursts.push({ pts: pts, vel: new Float32Array(n * 3), t: 0, n: n });
    }
    this.burstIdx = 0;
  }

  burst(pos, normal, color, speed, size) {
    const it = this.bursts[this.burstIdx++ % this.bursts.length];
    const arr = it.pts.geometry.attributes.position.array;
    for (let i = 0; i < it.n; i++) {
      arr[i * 3] = pos.x; arr[i * 3 + 1] = pos.y; arr[i * 3 + 2] = pos.z;
      const rx = Math.random() * 2 - 1, ry = Math.random() * 2 - 1, rz = Math.random() * 2 - 1;
      const sp = (speed || 4) * (0.4 + Math.random() * 0.9);
      it.vel[i * 3] = (normal ? normal.x * 0.7 : 0) * sp + rx * sp * 0.55;
      it.vel[i * 3 + 1] = (normal ? normal.y * 0.7 + 0.5 : 0.7) * sp + ry * sp * 0.4;
      it.vel[i * 3 + 2] = (normal ? normal.z * 0.7 : 0) * sp + rz * sp * 0.55;
    }
    it.pts.geometry.attributes.position.needsUpdate = true;
    it.pts.material.color.set(color);
    it.pts.material.size = size || 0.08;
    it.pts.material.opacity = 1;
    it.t = 0.5;
    it.pts.visible = true;
  }

  // Пыль/осколки при попадании в мир
  impact(hit) {
    const isGround = hit.kind === 'terrain';
    this.burst(hit.point, hit.normal,
      isGround ? 0x8a7454 : 0xc9c2b8, isGround ? 3 : 4.5, isGround ? 0.1 : 0.07);
  }

  blood(point) {
    this.burst(point, { x: 0, y: 0.6, z: 0 }, 0x8a1f16, 2.6, 0.06);
  }

  // ---------------- покадровое обновление ----------------

  update(dt) {
    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (t.t > 0) { t.t -= dt; if (t.t <= 0) t.m.visible = false; }
    }
    for (let i = 0; i < this.flashes.length; i++) {
      const f = this.flashes[i];
      if (f.t > 0) { f.t -= dt; if (f.t <= 0) f.s.visible = false; }
    }
    for (let i = 0; i < this.bursts.length; i++) {
      const b = this.bursts[i];
      if (b.t > 0) {
        b.t -= dt;
        const arr = b.pts.geometry.attributes.position.array;
        for (let k = 0; k < b.n; k++) {
          arr[k * 3] += b.vel[k * 3] * dt;
          arr[k * 3 + 1] += b.vel[k * 3 + 1] * dt;
          arr[k * 3 + 2] += b.vel[k * 3 + 2] * dt;
          b.vel[k * 3 + 1] -= 9.5 * dt;
          b.vel[k * 3] *= 0.96; b.vel[k * 3 + 1] *= 0.985; b.vel[k * 3 + 2] *= 0.96;
        }
        b.pts.geometry.attributes.position.needsUpdate = true;
        b.pts.material.opacity = Math.max(0, b.t / 0.5);
        if (b.t <= 0) b.pts.visible = false;
      }
    }
  }
};
