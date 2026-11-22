// ============================================================
//  Рельеф: детерминированный heightfield (fBm-шум), воронки от
//  снарядов с валами, протоптанные дороги (рельеф выравнивается),
//  выжженные пятна. Коллизия рельефа — аналитическая heightAt(x,z).
// ============================================================
window.Terrain = (function () {

  function build(ctx) {
    var T = ctx.T, CFG = ctx.CFG, noise = ctx.noise, env = ctx.env;
    var M = window.Mat.get();
    var seed = ctx.seed;
    var size = CFG.map.size, half = size / 2;
    var cell = CFG.map.blockSize + CFG.map.roadWidth;
    var roadW = CFG.map.roadWidth;
    var smooth = window.Util.smoothstep;

    // ---------- воронки ----------
    var r = window.RNG.rngAt(seed, 77, 13, 'craters');
    var craters = [];
    for (var i = 0; i < CFG.craters.count; i++) {
      for (var a = 0; a < 30; a++) {
        var x = window.RNG.range(r, -half * 0.86, half * 0.86);
        var z = window.RNG.range(r, -half * 0.86, half * 0.86);
        var rad = window.RNG.range(r, CFG.craters.minR, CFG.craters.maxR);
        var depth = window.RNG.range(r, 0.7, CFG.craters.maxDepth);
        if (distRoad(x, z) < roadW / 2 + rad + 1.5) continue;
        if (Math.hypot(x - CFG.spawn.x, z - CFG.spawn.z) < 16) continue;
        var ok = true;
        for (var c = 0; c < craters.length; c++) {
          if (Math.hypot(x - craters[c].x, z - craters[c].z) < craters[c].r + rad + 3) { ok = false; break; }
        }
        if (!ok) continue;
        craters.push({ x: x, z: z, r: rad, depth: depth });
        break;
      }
    }
    ctx.craters = craters;

    // ---------- расстояние до края дороги ----------
    function distRoad(x, z) {
      var lx = (Math.floor(x / cell) + 0.5) * cell;
      var lz = (Math.floor(z / cell) + 0.5) * cell;
      var m = Math.min(Math.abs(x - lx), Math.abs(z - lz));
      return Math.max(0, m - roadW / 2);
    }
    ctx.distRoad = distRoad;

    // ---------- высота рельефа ----------
    function heightAt(x, z) {
      var h = 1.0 + noise.fbm2(x * 0.012, z * 0.012, 4) * 1.05 + noise.fbm2(x * 0.055 + 31.7, z * 0.055 - 12.3, 2) * 0.4;
      // дороги выровнены (асфальт)
      var lx = (Math.floor(x / cell) + 0.5) * cell;
      var lz = (Math.floor(z / cell) + 0.5) * cell;
      var m = Math.min(Math.abs(x - lx), Math.abs(z - lz));
      var mask = 1 - smooth(roadW / 2, roadW / 2 + 2.4, m);
      h *= (1 - mask);
      // воронки: чаша + вал
      for (var i = 0; i < craters.length; i++) {
        var c = craters[i];
        var d = Math.hypot(x - c.x, z - c.z) / c.r;
        if (d < 1.45) {
          if (d < 1) h -= c.depth * (1 - d * d);
          var rim = Math.exp(-((d - 1.12) * (d - 1.12)) / (0.18 * 0.18));
          h += c.depth * 0.32 * rim;
        }
      }
      return h;
    }
    ctx.heightAt = heightAt;

    // ---------- меш земли ----------
    var seg = CFG.quality.terrainSegments;
    var geo = new T.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var cA = new T.Color(0x6e5c46), cB = new T.Color(0x7f6d55), cC = new T.Color(0x5b4c3b), tmp = new T.Color();
    for (var vi = 0; vi < pos.count; vi++) {
      var vx = pos.getX(vi), vz = pos.getZ(vi);
      var vy = heightAt(vx, vz);
      pos.setY(vi, vy);
      var n1 = noise.fbm2(vx * 0.05, vz * 0.05, 3);
      var n2 = noise.fbm2(vx * 0.013 + 8.2, vz * 0.013 - 4.4, 3);
      tmp.copy(cA).lerp(n1 > 0 ? cB : cC, Math.min(1, Math.abs(n1) * 1.6));
      tmp.multiplyScalar(0.86 + 0.14 * n2);
      // закопчённость у воронок
      for (var ci = 0; ci < craters.length; ci++) {
        var cc = craters[ci];
        var dd = Math.hypot(vx - cc.x, vz - cc.z) / cc.r;
        if (dd < 1.35) tmp.multiplyScalar(0.35 + 0.65 * smooth(0.25, 1.2, dd));
      }
      colors[vi * 3] = tmp.r; colors[vi * 3 + 1] = tmp.g; colors[vi * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new T.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var mesh = new T.Mesh(geo, M.dirt);
    mesh.receiveShadow = true;
    mesh.name = 'Ground';
    env.add(mesh);

    // ---------- дороги ----------
    var rg = new T.Group(); rg.name = 'Roads'; env.add(rg);
    var nL = Math.round(half / cell - 0.5);
    for (var k = -nL; k < nL; k++) {
      var p = (k + 0.5) * cell;
      var gV = new T.PlaneGeometry(roadW, size);
      gV.rotateX(-Math.PI / 2);
      var v = new T.Mesh(gV, M.asphaltLines);
      v.position.set(p, 0.07, 0);
      v.receiveShadow = true;
      rg.add(v);
      var gH = new T.PlaneGeometry(roadW, size);
      gH.rotateX(-Math.PI / 2);
      gH.rotateY(Math.PI / 2);
      var hz = new T.Mesh(gH, M.asphaltLines);
      hz.position.set(0, 0.12, p);
      hz.receiveShadow = true;
      rg.add(hz);
    }

    // ---------- выжженные пятна вокруг воронок ----------
    if (craters.length) {
      var plane = new T.PlaneGeometry(1, 1);
      plane.rotateX(-Math.PI / 2);
      var decalItems = [];
      for (var di = 0; di < craters.length; di++) {
        var cr = craters[di];
        var fr = [1.18, 1.45];
        for (var fi = 0; fi < fr.length; fi++) {
          var rr = cr.r * fr[fi];
          var y = 0;
          for (var s4 = 0; s4 < 4; s4++) {
            var ax = cr.x + Math.cos(s4 * 1.57) * rr * 0.7;
            var az = cr.z + Math.sin(s4 * 1.57) * rr * 0.7;
            y = Math.max(y, heightAt(ax, az));
          }
          decalItems.push({ x: cr.x, y: y + 0.15, z: cr.z, sx: rr * 2, sy: 1, sz: rr * 2 });
        }
      }
      var dm = new T.InstancedMesh(plane, M.scorch, decalItems.length);
      var m4 = new T.Matrix4(), q4 = new T.Quaternion(), e4 = new T.Euler(), sV = new T.Vector3(), pV = new T.Vector3();
      for (var di2 = 0; di2 < decalItems.length; di2++) {
        var it = decalItems[di2];
        pV.set(it.x, it.y, it.z); sV.set(it.sx, 1, it.sz);
        m4.compose(pV, q4, sV);
        dm.setMatrixAt(di2, m4);
      }
      dm.renderOrder = 2;
      dm.receiveShadow = false;
      dm.castShadow = false;
      dm.frustumCulled = false;
      dm.name = 'Scorch';
      env.add(dm);
    }

    return { craters: craters, heightAt: heightAt, distRoad: distRoad };
  }

  return { build: build };
})();
