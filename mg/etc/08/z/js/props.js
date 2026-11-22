// ============================================================
//  Модульные генераторы объектов: камни, бетонные обломки,
//  кирпичи, доски, арматура, брёвна, деревья (сухие/зелёные),
//  кусты, трава (чанки с дистанционным culling), мусор,
//  сгоревшие машины, фонари, контактные тени. GPU Instancing.
//  Размещение — через claims-сетку (без пересечений) и шумы.
// ============================================================
window.Props = (function () {

  async function build(ctx, city, prog) {
    var T = ctx.T, CFG = ctx.CFG, noise = ctx.noise, grp = ctx.props;
    var claims = ctx.claims, addCollider = ctx.addCollider;
    var heightAt = ctx.heightAt, distRoad = ctx.distRoad, veg = ctx.veg;
    var craters = ctx.craters || [];
    var LAYERS = window.GridLib.LAYERS;
    var M = window.Mat.get();
    var seed = ctx.seed;
    var half = CFG.map.size / 2;
    var SPAWN = CFG.spawn;
    var buildings = city.buildings, mounds = city.mounds, lots = city.lots;

    // ---------- утилиты ----------
    function inst(geo, mat, items, o) {
      o = o || {};
      if (!items.length) return null;
      var m = new T.InstancedMesh(geo, mat, items.length);
      var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
      var p = new T.Vector3(), s = new T.Vector3(), c = new T.Color();
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.m) { m4.copy(it.m); }
        else {
          if (it.q) q.copy(it.q);
          else { e.set(it.rx || 0, it.ry || 0, it.rz || 0); q.setFromEuler(e); }
          p.set(it.x, it.y, it.z);
          s.set(it.sx === undefined ? 1 : it.sx, it.sy === undefined ? 1 : it.sy, it.sz === undefined ? 1 : it.sz);
          m4.compose(p, q, s);
        }
        m.setMatrixAt(i, m4);
        // instanceColor задаётся ВСЕГДА (белый по умолчанию):
        // в three r149 материал, впервые отрендеренный на InstancedMesh
        // с instanceColor, даёт чёрный цвет на InstancedMesh без него
        m.setColorAt(i, c.set(it.c === undefined ? 0xffffff : it.c));
      }
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.castShadow = !!o.cast;
      m.receiveShadow = o.recv !== false;
      m.frustumCulled = false;
      m.name = o.name || 'Instanced';
      grp.add(m);
      return m;
    }
    function instVaried(geos, mat, items, o) {
      for (var v = 0; v < geos.length; v++) {
        var list = [];
        for (var i = 0; i < items.length; i++) if (items[i].v === v) list.push(items[i]);
        inst(geos[v], mat, list, o);
      }
    }
    function seamJitter(geo, amp) {
      var p = geo.attributes.position;
      function f(a, b, c2, m) { var h = Math.sin(a * 12.9898 + b * 78.233 + c2 * 37.719 + m) * 43758.5453; return h - Math.floor(h); }
      for (var i = 0; i < p.count; i++) {
        var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        p.setXYZ(i, x + (f(x, y, z, 1) - 0.5) * amp, y + (f(x, y, z, 2) - 0.5) * amp, z + (f(x, y, z, 3) - 0.5) * amp);
      }
      geo.computeVertexNormals();
      return geo;
    }
    function aabb(x0, y0, z0, x1, y1, z1) { return { x0: x0, y0: y0, z0: z0, x1: x1, y1: y1, z1: z1 }; }
    function boxCollider(x, y, z, sx, sy, sz) {
      addCollider(aabb(x - sx / 2, y, z - sz / 2, x + sx / 2, y + sy, z + sz / 2), LAYERS.PROP);
    }
    var shadowItems = [];
    function addShadow(x, z, r, y) {
      if (!CFG.props.contactShadows) return;
      shadowItems.push({ x: x, y: (y === undefined ? heightAt(x, z) + 0.15 : y + 0.02), z: z, sx: r * 2.3, sy: 1, sz: r * 2.3 });
    }

    // Универсальный скаттер: попытки > count, отсев по дороге/claims/шуму
    function scatter(count, fn, o) {
      o = o || {};
      var r = window.RNG.mulberry32(window.RNG.hashCombine(seed, o.tag ? window.RNG.hashStr(o.tag) : 17, 0x1D3A));
      var placed = 0, att = count * 5;
      while (placed < count && att-- > 0) {
        var x, z;
        if (o.near && o.near.length) {
          var b = o.near[(r() * o.near.length) | 0];
          var ang = r() * Math.PI * 2;
          var dd = (o.nearGap || 3) + r() * (o.nearSpread || 8) * Math.max(b.w || 4, b.d || 4) * 0.5;
          x = b.x + Math.cos(ang) * dd; z = b.z + Math.sin(ang) * dd;
        } else if (o.ring && o.ring.length) {
          var c = o.ring[(r() * o.ring.length) | 0];
          var ang2 = r() * Math.PI * 2;
          var dd2 = c.r * (0.95 + r() * 0.55);
          x = c.x + Math.cos(ang2) * dd2; z = c.z + Math.sin(ang2) * dd2;
        } else {
          x = window.RNG.range(r, -half + 3, half - 3);
          z = window.RNG.range(r, -half + 3, half - 3);
        }
        if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < (o.spawnGap || 5)) continue;
        var rg = (o.roadGap === undefined ? 1.0 : o.roadGap);
        if (rg >= 0 && distRoad(x, z) < rg) continue;
        if (o.vegMin !== undefined && veg(x, z) < o.vegMin) continue;
        if (claims.hits(x, z, o.claimR || 0.4, !o.big)) continue;
        if (fn(x, z, r)) {
          placed++;
          if (o.big) claims.insert(x, z, o.claimR || 1, true, o.tag || '');
          if (o.shadow) addShadow(x, z, o.shadow);
        }
      }
      return r;
    }

    // ---------- камни ----------
    var rockGeos = [];
    for (var rv = 0; rv < 3; rv++) rockGeos.push(seamJitter(new T.IcosahedronGeometry(1, 1), 0.55));
    var rockItems = [];
    scatter(Math.floor(CFG.props.rocks * 0.4), function (x, z, r) {
      var s = window.RNG.range(r, 0.9, 2.4);
      var y = heightAt(x, z);
      rockItems.push({ x: x, y: y + s * 0.3, z: z, sx: s * (0.8 + r() * 0.4), sy: s * 0.72, sz: s * (0.8 + r() * 0.4), ry: r() * 6.28, v: (r() * 3) | 0, c: new T.Color().setHSL(0.08 + r() * 0.03, 0.04 + r() * 0.1, 0.3 + r() * 0.14) });
      boxCollider(x, y, z, s * 1.5, s * 0.75, s * 1.5);
      if (s > 1.2) addShadow(x, z, s * 1.3);
      return true;
    }, { tag: 'rocksBig', claimR: 1.5, big: true, roadGap: 1.2 });
    scatter(Math.floor(CFG.props.rocks * 0.6), function (x, z, r) {
      var s = window.RNG.range(r, 0.3, 0.85);
      rockItems.push({ x: x, y: heightAt(x, z) + s * 0.28, z: z, sx: s * (0.8 + r() * 0.4), sy: s * 0.7, sz: s * (0.8 + r() * 0.4), ry: r() * 6.28, v: (r() * 3) | 0, c: new T.Color().setHSL(0.08 + r() * 0.03, 0.04 + r() * 0.1, 0.3 + r() * 0.14) });
      return true;
    }, { tag: 'rocksSmall', claimR: 0.4 });

    // ---------- бетонные обломки ----------
    var chunkGeos = [
      seamJitter(new T.BoxGeometry(1.5, 0.75, 1.05), 0.14),
      seamJitter(new T.BoxGeometry(0.9, 0.5, 0.7), 0.12)
    ];
    var chunkItems = [];
    function addChunk(x, z, r) {
      var s = window.RNG.range(r, 0.55, 2.0);
      var y = heightAt(x, z);
      chunkItems.push({ x: x, y: y + 0.36 * s, z: z, sx: s, sy: s * (0.8 + r() * 0.5), sz: s * (0.85 + r() * 0.4), ry: r() * 6.28, v: (r() * 2) | 0, c: new T.Color().setHSL(0.09, r() * 0.06, 0.42 + r() * 0.16) });
      if (s > 0.9) { boxCollider(x, y, z, 1.5 * s * 0.8, 0.75 * s * 0.85, 1.05 * s * 0.8); addShadow(x, z, s); }
      return true;
    }
    scatter(Math.floor(CFG.props.chunks * 0.6), addChunk, { tag: 'chunksNear', near: buildings, nearGap: 1.5, nearSpread: 7, claimR: 1.1, big: true, roadGap: 0.4 });
    scatter(Math.floor(CFG.props.chunks * 0.25), addChunk, { tag: 'chunksRim', ring: craters, claimR: 1.1, big: true, roadGap: -1 });
    scatter(Math.floor(CFG.props.chunks * 0.15), addChunk, { tag: 'chunksRnd', claimR: 1.0, big: true, roadGap: 0.6 });

    // ---------- кирпичи ----------
    var brickGeo = new T.BoxGeometry(0.21, 0.07, 0.1);
    var brickItems = [];
    scatter(CFG.props.bricks, function (x, z, r) {
      brickItems.push({ x: x, y: heightAt(x, z) + 0.05, z: z, ry: r() * 6.28, sx: 0.7 + r() * 0.7, sy: 0.8 + r() * 0.6, sz: 0.7 + r() * 0.7, c: new T.Color().setHSL(0.02 + r() * 0.05, 0.3 + r() * 0.3, 0.2 + r() * 0.14) });
      return true;
    }, { tag: 'bricks', near: buildings, nearGap: 1, nearSpread: 8, claimR: 0.3 });

    // ---------- доски ----------
    var plankGeo = new T.BoxGeometry(1.5, 0.055, 0.19);
    var plankItems = [];
    scatter(CFG.props.planks, function (x, z, r) {
      plankItems.push({ x: x, y: heightAt(x, z) + 0.07, z: z, ry: r() * 6.28, rz: (r() - 0.5) * 0.24, sx: 0.7 + r() * 1.1, sz: 0.8 + r() * 0.8 });
      return true;
    }, { tag: 'planks', near: buildings, nearGap: 1.5, nearSpread: 8, claimR: 0.4 });

    // ---------- арматура на грудках ----------
    var rebarGeo = new T.CylinderGeometry(0.014, 0.014, 1, 5);
    var rebarItems = [];
    var rrB = window.RNG.mulberry32(window.RNG.hashCombine(seed, 0xB0BA));
    for (var mi = 0; mi < mounds.length && rebarItems.length < CFG.props.rebar; mi++) {
      var mo = mounds[mi];
      var nb = 1 + ((rrB() * 3) | 0);
      for (var bi = 0; bi < nb && rebarItems.length < CFG.props.rebar; bi++) {
        var q = new T.Quaternion().setFromEuler(new T.Euler((rrB() - 0.5) * 1.6, rrB() * 6.28, (rrB() - 0.5) * 1.6));
        rebarItems.push({
          x: mo.x + (rrB() - 0.5) * mo.sx, y: mo.y + mo.sy * 0.55, z: mo.z + (rrB() - 0.5) * mo.sz,
          q: q, sy: 0.9 + rrB() * 1.1
        });
      }
    }

    // ---------- брёвна (упавшие стволы) ----------
    var logGeo = new T.CylinderGeometry(0.17, 0.28, 1, 7);
    var logItems = [];
    function addLog(x, z, r) {
      var len = window.RNG.range(r, 2.5, 6.5), rad = window.RNG.range(r, 0.7, 1.5);
      var yaw = r() * Math.PI;
      var y = heightAt(x, z) + 0.28 * rad + 0.1;
      logItems.push({ x: x, y: y, z: z, rz: Math.PI / 2 + (r() - 0.5) * 0.2, ry: yaw, sy: len, sx: rad, sz: rad });
      var hl = len / 2;
      addCollider(aabb(
        x - Math.abs(Math.cos(yaw)) * hl - rad * 0.3, y - rad * 0.28, z - Math.abs(Math.sin(yaw)) * hl - rad * 0.3,
        x + Math.abs(Math.cos(yaw)) * hl + rad * 0.3, y + rad * 0.3, z + Math.abs(Math.sin(yaw)) * hl + rad * 0.3), LAYERS.PROP);
      addShadow(x, z, len * 0.5);
      return true;
    }
    scatter(Math.floor(CFG.props.logs * 0.7), addLog, { tag: 'logs', claimR: 1.8, big: true, roadGap: 1.5, vegMin: 0.4 });
    scatter(Math.floor(CFG.props.logs * 0.3), addLog, { tag: 'logsRoad', claimR: 1.8, big: true, roadGap: -1 });

    // ---------- деревья ----------
    var trunkGeo = new T.CylinderGeometry(0.13, 0.32, 1, 7);
    var branchGeo = new T.CylinderGeometry(0.045, 0.1, 1, 5);
    var foliGeo = seamJitter(new T.IcosahedronGeometry(1, 1), 0.4);
    var trunkItems = [], branchItems = [], foliItems = [];
    function leafColor(r) {
      if (r() < 0.6) return new T.Color().setHSL(0.23 + r() * 0.05, 0.28 + r() * 0.18, 0.14 + r() * 0.08);
      return new T.Color().setHSL(0.09 + r() * 0.03, 0.3 + r() * 0.15, 0.18 + r() * 0.08);
    }
    function plantTree(x, z, r) {
      var h = window.RNG.range(r, 3.5, 8), rad = window.RNG.range(r, 0.8, 1.5);
      var yB = heightAt(x, z);
      trunkItems.push({ x: x, y: yB + h / 2 - 0.15, z: z, sx: rad, sy: h, sz: rad, ry: r() * 6.28, rz: (r() - 0.5) * 0.12 });
      boxCollider(x, yB, z, 0.55 * rad + 0.3, h * 0.96, 0.55 * rad + 0.3);
      addShadow(x, z, 1.7 + rad);
      var nb = 2 + ((r() * 4) | 0);
      for (var i = 0; i < nb; i++) {
        var q = new T.Quaternion().setFromEuler(new T.Euler(
          (0.5 + r() * 0.8) * (r() < 0.5 ? -1 : 1), r() * 6.28, (0.4 + r() * 0.9) * (r() < 0.5 ? -1 : 1)));
        var att = yB + h * window.RNG.range(r, 0.45, 0.95);
        var L = window.RNG.range(r, 1.2, 3.2);
        var axis = new T.Vector3(0, 1, 0).applyQuaternion(q);
        branchItems.push({ x: x + axis.x * L * 0.5, y: att + axis.y * L * 0.5, z: z + axis.z * L * 0.5, q: q, sx: 0.8, sy: L, sz: 0.8 });
        if (r() < 0.4) {
          var fr = 1.0 + r() * 1.2;
          foliItems.push({ x: x + axis.x * L, y: att + axis.y * L + 0.2, z: z + axis.z * L, sx: fr, sy: fr * 0.75, sz: fr, ry: r() * 6.28, c: leafColor(r) });
        }
      }
      if (r() < 0.35) {
        var fr2 = 1.4 + r() * 1.4;
        foliItems.push({ x: x + (r() - 0.5) * 1.2, y: yB + h * 0.92, z: z + (r() - 0.5) * 1.2, sx: fr2, sy: fr2 * 0.7, sz: fr2, ry: r() * 6.28, c: leafColor(r) });
      }
      return true;
    }
    scatter(Math.floor(CFG.props.trees * 0.65), plantTree, { tag: 'trees', claimR: 1.7, big: true, roadGap: 2.4, vegMin: 0.45 });
    for (var li = 0; li < lots.length; li++) {
      if (lots[li].type !== 'park') continue;
      var rL = window.RNG.mulberry32(window.RNG.hashCombine(seed, li * 31 + 7, 0x7EE));
      var nt = 3 + ((rL() * 5) | 0);
      for (var tt = 0; tt < nt; tt++) {
        var tx = lots[li].x + (rL() - 0.5) * 26, tz = lots[li].z + (rL() - 0.5) * 26;
        if (distRoad(tx, tz) < 2 || claims.hits(tx, tz, 1.7, false)) continue;
        if (Math.hypot(tx - SPAWN.x, tz - SPAWN.z) < 8) continue;
        plantTree(tx, tz, rL);
        claims.insert(tx, tz, 1.7, true, 'tree');
      }
    }

    // ---------- кусты ----------
    var bushItems = [];
    scatter(CFG.props.bushes, function (x, z, r) {
      var s = window.RNG.range(r, 0.5, 1.3);
      bushItems.push({ x: x, y: heightAt(x, z) + s * 0.4, z: z, sx: s, sy: s * 0.65, sz: s * (0.8 + r() * 0.4), ry: r() * 6.28, c: leafColor(r) });
      return true;
    }, { tag: 'bushes', claimR: 0.6, roadGap: 1, vegMin: 0.35 });

    prog(0.35);
    await new Promise(function (res) { requestAnimationFrame(res); });

    // ---------- трава (чанки 32м с дистанционным culling) ----------
    var tuft = (function () {
      var g = new T.BufferGeometry();
      var w = 0.55, h = 0.62;
      var verts = [-w/2,0,0,  w/2,0,0,  w/2,h,0,  -w/2,h,0,   0,0,-w/2,  0,0,w/2,  0,h,w/2,  0,h,-w/2];
      var uvs = [0,0, 1,0, 1,1, 0,1,  0,0, 1,0, 1,1, 0,1];
      var idx = [0,1,2, 0,2,3, 4,5,6, 4,6,7];
      g.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    })();
    var grassCells = [];
    var cellS = 32;
    var rG = window.RNG.mulberry32(window.RNG.hashCombine(seed, 0x625A55));
    var cellsDone = 0, cellsRow = 0;
    var rowsTotal = Math.ceil(CFG.map.size / cellS);
    for (var gx = -half + cellS / 2; gx < half; gx += cellS) {
      for (var gz = -half + cellS / 2; gz < half; gz += cellS) {
        var items = [];
        var target = cellS * cellS * CFG.props.grassPerM2;
        for (var gi = 0; gi < target; gi++) {
          var x = gx + (rG() - 0.5) * cellS, z = gz + (rG() - 0.5) * cellS;
          if (veg(x, z) < 0.42) continue;
          if (distRoad(x, z) < 0.8) continue;
          if (claims.hits(x, z, 0.25, true)) continue;
          items.push({
            x: x - gx, y: heightAt(x, z), z: z - gz,
            ry: rG() * 3.14, sx: 0.7 + rG() * 0.9, sy: 0.7 + rG() * 0.8, sz: 1,
            c: new T.Color().setHSL(0.13 + rG() * 0.05, 0.28 + rG() * 0.2, 0.28 + rG() * 0.14)
          });
        }
        cellsDone++;
        if (items.length < 4) continue;
        var mesh = inst(tuft, M.grassBlade, items, { cast: false, name: 'GrassCell' });
        mesh.position.set(gx, 0, gz);
        grassCells.push({ mesh: mesh, x: gx, z: gz });
      }
      cellsRow++;
      prog(0.35 + 0.25 * (cellsRow / rowsTotal));
      await new Promise(function (res) { requestAnimationFrame(res); });
    }

    prog(0.62);
    await new Promise(function (res) { requestAnimationFrame(res); });

    // ---------- мусор ----------
    var paperGeo = new T.PlaneGeometry(0.3, 0.4);
    paperGeo.rotateX(-Math.PI / 2);
    var paperItems = [];
    scatter(CFG.props.papers, function (x, z, r) {
      paperItems.push({ x: x, y: heightAt(x, z) + 0.16, z: z, ry: r() * 6.28, sx: 0.8 + r() * 0.6, sz: 0.8 + r() * 0.6 });
      return true;
    }, { tag: 'papers', near: buildings, nearGap: 0.5, nearSpread: 10, claimR: 0.25 });
    scatter(Math.floor(CFG.props.papers * 0.4), function (x, z, r) {
      paperItems.push({ x: x, y: heightAt(x, z) + 0.16, z: z, ry: r() * 6.28 });
      return true;
    }, { tag: 'papersRnd', claimR: 0.25 });

    var glassGeo = new T.PlaneGeometry(0.15, 0.15);
    glassGeo.rotateX(-Math.PI / 2);
    var glassItems = [];
    scatter(CFG.props.glass, function (x, z, r) {
      glassItems.push({ x: x, y: heightAt(x, z) + 0.16, z: z, ry: r() * 6.28, c: new T.Color().setHSL(0.5 + r() * 0.06, 0.2, 0.6 + r() * 0.15) });
      return true;
    }, { tag: 'glass', near: buildings, nearGap: 1, nearSpread: 7, claimR: 0.25 });

    var bottleGeo = new T.CylinderGeometry(0.035, 0.042, 0.28, 6);
    var bottleItems = [];
    scatter(CFG.props.bottles, function (x, z, r) {
      var lying = r() < 0.75;
      bottleItems.push({ x: x, y: heightAt(x, z) + (lying ? 0.06 : 0.14), z: z, rz: lying ? Math.PI / 2 : 0, ry: r() * 6.28 });
      return true;
    }, { tag: 'bottles', near: buildings, nearGap: 0.5, nearSpread: 9, claimR: 0.25 });

    var canGeo = new T.CylinderGeometry(0.033, 0.033, 0.12, 8);
    var canItems = [];
    scatter(CFG.props.cans, function (x, z, r) {
      var lying = r() < 0.7;
      canItems.push({ x: x, y: heightAt(x, z) + (lying ? 0.045 : 0.06), z: z, rz: lying ? Math.PI / 2 : 0, ry: r() * 6.28, c: new T.Color().setHSL(0.1 + r() * 0.2, 0.1 + r() * 0.25, 0.4 + r() * 0.2) });
      return true;
    }, { tag: 'cans', near: buildings, nearGap: 0.5, nearSpread: 9, claimR: 0.25 });

    var tireGeo = new T.TorusGeometry(0.34, 0.13, 8, 16);
    tireGeo.rotateX(Math.PI / 2);
    var tireItems = [];
    scatter(CFG.props.tires, function (x, z, r) {
      var flat = r() < 0.8;
      tireItems.push({ x: x, y: heightAt(x, z) + (flat ? 0.14 : 0.36), z: z, rz: flat ? 0 : Math.PI / 2, ry: r() * 6.28 });
      return true;
    }, { tag: 'tires', claimR: 0.7, roadGap: 0.3 });

    var barrelGeo = new T.CylinderGeometry(0.33, 0.33, 0.92, 12);
    var barrelItems = [];
    scatter(Math.floor(CFG.props.barrels * 0.7), function (x, z, r) {
      var y = heightAt(x, z);
      barrelItems.push({ x: x, y: y + 0.46, z: z, ry: r() * 6.28, c: new T.Color().setHSL(0.05 + r() * 0.05, 0.3 + r() * 0.2, 0.35 + r() * 0.15) });
      boxCollider(x, y, z, 0.7, 0.92, 0.7);
      addShadow(x, z, 0.8);
      return true;
    }, { tag: 'barrelsUp', claimR: 0.8, big: true, roadGap: 0.5 });
    scatter(Math.floor(CFG.props.barrels * 0.3), function (x, z, r) {
      var y = heightAt(x, z);
      var yaw = r() * Math.PI;
      barrelItems.push({ x: x, y: y + 0.34, z: z, rz: Math.PI / 2, ry: yaw, c: new T.Color().setHSL(0.05 + r() * 0.05, 0.3 + r() * 0.2, 0.35 + r() * 0.15) });
      var ax = Math.cos(yaw) * 0.46, az = Math.sin(yaw) * 0.46;
      addCollider(aabb(x - Math.abs(ax) - 0.33, y, z - Math.abs(az) - 0.33, x + Math.abs(ax) + 0.33, y + 0.66, z + Math.abs(az) + 0.33), LAYERS.PROP);
      addShadow(x, z, 0.9);
      return true;
    }, { tag: 'barrelsLay', claimR: 0.8, big: true, roadGap: 0.5 });

    prog(0.82);
    await new Promise(function (res) { requestAnimationFrame(res); });

    // ---------- сгоревшие машины ----------
    function mergeSimple(list) {
      var pos = [], nor = [];
      for (var i = 0; i < list.length; i++) {
        var g = list[i];
        var p = g.attributes.position.array, n = g.attributes.normal.array;
        for (var a = 0; a < p.length; a++) pos.push(p[a]);
        for (var b = 0; b < n.length; b++) nor.push(n[b]);
        g.dispose();
      }
      var G = new T.BufferGeometry();
      G.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      G.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      return G;
    }
    function carGeo(kind) {
      var parts = [];
      function box(w, h, d, x, y, z) { var g = new T.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); parts.push(g); }
      function wheel(x, z, r) { var g = new T.CylinderGeometry(r, r, 0.26, 10).toNonIndexed(); g.rotateX(Math.PI / 2); g.translate(x, r, z); parts.push(g); }
      if (kind === 0) { box(4.2, 0.75, 1.85, 0, 0.62, 0); box(2.1, 0.62, 1.7, -0.35, 1.28, 0); wheel(1.4, 0.82, 0.34); wheel(1.4, -0.82, 0.34); wheel(-1.4, 0.82, 0.34); wheel(-1.4, -0.82, 0.34); }
      else if (kind === 1) { box(4.6, 1.35, 1.95, 0, 0.95, 0); box(1.4, 0.3, 1.9, 2.0, 0.7, 0); wheel(1.55, 0.88, 0.36); wheel(1.55, -0.88, 0.36); wheel(-1.55, 0.88, 0.36); wheel(-1.55, -0.88, 0.36); }
      else { box(3.6, 0.7, 1.7, 0, 0.58, 0); box(1.8, 0.55, 1.6, 0.2, 1.18, 0); wheel(1.2, 0.75, 0.3); wheel(1.2, -0.75, 0.3); wheel(-1.2, 0.75, 0.3); wheel(-1.2, -0.75, 0.3); }
      return mergeSimple(parts);
    }
    var carGeos = [carGeo(0), carGeo(1), carGeo(2)];
    var carItems = [];
    var rC = window.RNG.mulberry32(window.RNG.hashCombine(seed, 0xCA12));
    var cell = CFG.map.blockSize + CFG.map.roadWidth;
    var placedCars = 0, attC = CFG.props.cars * 6;
    while (placedCars < CFG.props.cars && attC-- > 0) {
      var vertical = rC() < 0.5;
      var kLine = Math.round(window.RNG.range(rC, -(half / cell - 0.5), (half / cell - 0.5)));
      var line = (kLine + 0.5) * cell;
      var along = window.RNG.range(rC, -half + 12, half - 12);
      var lane = (rC() < 0.5 ? -1 : 1) * (CFG.map.roadWidth / 2 - 1.7);
      var x = vertical ? line + lane : along;
      var z = vertical ? along : line + lane;
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 10) continue;
      if (claims.hits(x, z, 2.6, false)) continue;
      var ry = (vertical ? 0 : Math.PI / 2) + (rC() - 0.5) * 0.5;
      var y = heightAt(x, z);
      carItems.push({ x: x, y: y + 0.02, z: z, ry: ry, rz: (rC() - 0.5) * 0.06, v: (rC() * 3) | 0, c: new T.Color().setHSL(rC() * 0.1, rC() * 0.25, 0.09 + rC() * 0.12) });
      claims.insert(x, z, 2.6, true, 'car');
      var cs = Math.abs(Math.cos(ry)), sn = Math.abs(Math.sin(ry));
      var ex = cs * 2.35 + sn * 1.05, ez = sn * 2.35 + cs * 1.05;
      addCollider(aabb(x - ex, y, z - ez, x + ex, y + 1.55, z + ez), LAYERS.PROP);
      addShadow(x, z, 2.6, y);
      placedCars++;
    }

    // ---------- фонари ----------
    var poleGeo = new T.CylinderGeometry(0.07, 0.1, 5.6, 6);
    var armGeo = new T.BoxGeometry(0.09, 0.09, 1.6); armGeo.translate(0, 0, 0.8);
    var headGeo = new T.BoxGeometry(0.55, 0.16, 0.3);
    var lampPole = [], lampArm = [], lampHead = [];
    var rL = window.RNG.mulberry32(window.RNG.hashCombine(seed, 0xDA26));
    var dummy = new T.Object3D();
    var poleObj = new T.Object3D(); poleObj.position.y = 2.8;
    var armObj = new T.Object3D(); armObj.position.y = 5.55;
    var headObj = new T.Object3D(); headObj.position.set(0, 5.5, 1.5);
    dummy.add(poleObj); dummy.add(armObj); dummy.add(headObj);
    for (var li2 = 0; li2 < CFG.props.lamps; li2++) {
      var vertical2 = rL() < 0.5;
      var kL = Math.round(window.RNG.range(rL, -(half / cell - 0.5), (half / cell - 0.5)));
      var line2 = (kL + 0.5) * cell;
      var along2 = window.RNG.range(rL, -half + 8, half - 8);
      var side = rL() < 0.5 ? -1 : 1;
      var off = CFG.map.roadWidth / 2 - 0.6;
      var x2 = vertical2 ? line2 + side * off : along2;
      var z2 = vertical2 ? along2 : line2 + side * off;
      if (Math.hypot(x2 - SPAWN.x, z2 - SPAWN.z) < 8) continue;
      if (claims.hits(x2, z2, 0.8, false)) continue;
      var yB2 = heightAt(x2, z2);
      var fallen = rL() < 0.22;
      dummy.position.set(x2, yB2, z2);
      var ry2;
      if (vertical2) ry2 = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      else ry2 = side > 0 ? Math.PI : 0;
      if (fallen) {
        dummy.rotation.set((rL() - 0.5) * 0.3, ry2, (rL() < 0.5 ? -1 : 1) * window.RNG.range(rL, 1.35, 1.55));
        dummy.position.y = yB2 + 0.32;
      } else {
        dummy.rotation.set(0, ry2, 0);
      }
      dummy.updateMatrixWorld(true);
      lampPole.push({ m: poleObj.matrixWorld.clone() });
      lampArm.push({ m: armObj.matrixWorld.clone() });
      lampHead.push({ m: headObj.matrixWorld.clone() });
      claims.insert(x2, z2, 0.7, false, 'lamp');
      if (!fallen) {
        boxCollider(x2, yB2, z2, 0.32, 5.6, 0.32);
      } else {
        var tip = new T.Vector3(0, 5.6, 0).applyMatrix4(poleObj.matrixWorld);
        addCollider(aabb(Math.min(x2, tip.x) - 0.18, yB2, Math.min(z2, tip.z) - 0.18, Math.max(x2, tip.x) + 0.18, yB2 + 0.4, Math.max(z2, tip.z) + 0.18), LAYERS.PROP);
        addShadow(x2, z2, 2.2, yB2);
      }
    }
    dummy.remove(poleObj); dummy.remove(armObj); dummy.remove(headObj);

    // ---------- сборка всех instanced-мешей ----------
    prog(0.92);
    await new Promise(function (res) { requestAnimationFrame(res); });

    instVaried(rockGeos, M.rock, rockItems, { cast: true, name: 'Rocks' });
    instVaried(chunkGeos, M.rubble, chunkItems, { cast: true, name: 'Chunks' });
    inst(brickGeo, M.brick, brickItems, { name: 'Bricks' });
    inst(plankGeo, M.wood, plankItems, { name: 'Planks' });
    inst(rebarGeo, M.rebar, rebarItems, { cast: false, name: 'Rebar' });
    inst(logGeo, M.bark, logItems, { cast: true, name: 'Logs' });
    inst(trunkGeo, M.bark, trunkItems, { cast: true, name: 'TreeTrunks' });
    inst(branchGeo, M.bark, branchItems, { cast: true, name: 'TreeBranches' });
    inst(foliGeo, M.foliage, foliItems, { cast: true, name: 'Foliage' });
    inst(foliGeo, M.foliage, bushItems, { cast: false, name: 'Bushes' });
    inst(paperGeo, M.paper, paperItems, { cast: false, name: 'Papers' });
    inst(glassGeo, M.glassShard, glassItems, { cast: false, name: 'Glass' });
    inst(bottleGeo, M.bottle, bottleItems, { cast: false, name: 'Bottles' });
    inst(canGeo, M.can, canItems, { cast: false, name: 'Cans' });
    inst(tireGeo, M.tire, tireItems, { cast: true, name: 'Tires' });
    inst(barrelGeo, M.barrel, barrelItems, { cast: true, name: 'Barrels' });
    instVaried(carGeos, M.car, carItems, { cast: true, name: 'Cars' });
    inst(poleGeo, M.pole, lampPole, { cast: true, name: 'LampPoles' });
    inst(armGeo, M.pole, lampArm, { cast: true, name: 'LampArms' });
    inst(headGeo, M.pole, lampHead, { cast: false, name: 'LampHeads' });

    // груды обломков (купола) из city — коллайдеры добавляются здесь
    var moundGeo = new T.SphereGeometry(1, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    var moundItems = [];
    for (var mi2 = 0; mi2 < mounds.length; mi2++) {
      var m2 = mounds[mi2];
      moundItems.push({ x: m2.x, y: m2.y - 0.05, z: m2.z, sx: m2.sx, sy: m2.sy, sz: m2.sz });
      addCollider(aabb(m2.x - m2.sx * 0.8, m2.y, m2.z - m2.sz * 0.8, m2.x + m2.sx * 0.8, m2.y + m2.sy * 0.72, m2.z + m2.sz * 0.8), LAYERS.PROP);
    }
    inst(moundGeo, M.rubble, moundItems, { cast: true, name: 'RubbleMounds' });

    var blobGeo = new T.PlaneGeometry(1, 1);
    blobGeo.rotateX(-Math.PI / 2);
    var blobMesh = inst(blobGeo, M.shadowBlob, shadowItems, { cast: false, recv: false, name: 'ContactShadows' });
    if (blobMesh) blobMesh.renderOrder = 2;

    prog(1);
    return { grassCells: grassCells };
  }

  return { build: build };
})();
