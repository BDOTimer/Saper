// ============================================================
//  Кварталы и руины зданий. Сетка кварталов/дорог параметрична.
//  Здания собираются из обломков стен (jagged skyline), плит
//  перекрытий и груд обломков; у каждого фрагмента — статический
//  AABB-коллайдер. Геометрия здания сливается в один меш
//  (2 материала: фасад + бетон) — 1 draw call на здание.
//  Распределение застройки задаёт шум (urban fbm) + seed.
// ============================================================
window.City = (function () {

  function faceGroups() {
    // порядок граней BoxGeometry: +x,-x,+y,-y,+z,-z ; крыша/пол — материал 1
    return [[0, 6, 0], [6, 6, 0], [12, 6, 1], [18, 6, 1], [24, 6, 0], [30, 6, 0]];
  }

  function mergeGeoms(T, list) {
    var pos = [], nor = [], uv = [], groups = [], vc = 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i], g = it.g;
      var p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv.array;
      for (var a = 0; a < p.length; a++) pos.push(p[a]);
      for (var b = 0; b < n.length; b++) nor.push(n[b]);
      for (var c = 0; c < u.length; c++) uv.push(u[c]);
      var cnt = p.length / 3;
      groups.push([vc, cnt, it.matIndex || 0]);
      vc += cnt;
      g.dispose();
    }
    var G = new T.BufferGeometry();
    G.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    G.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    G.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    // слить смежные группы с одинаковым материалом (меньше draw calls)
    if (groups.length) {
      var mg = [groups[0]];
      for (var gi = 1; gi < groups.length; gi++) {
        var L2 = mg[mg.length - 1], gr2 = groups[gi];
        if (L2[2] === gr2[2] && L2[0] + L2[1] === gr2[0]) L2[1] += gr2[1];
        else mg.push(gr2);
      }
      for (var gi2 = 0; gi2 < mg.length; gi2++) G.addGroup(mg[gi2][0], mg[gi2][1], mg[gi2][2]);
    }
    return G;
  }

  // Разрезает non-indexed BoxGeometry (36 вершин) на две геометрии:
  // боковые грани (+x,-x,+z,-z — фасад) и капсулы (+y,-y — бетон)
  function splitBoxFaces(T, g) {
    function part(v0, v1) {
      var G = new T.BufferGeometry();
      var cnt = v1 - v0;
      G.setAttribute('position', new T.Float32BufferAttribute(g.attributes.position.array.slice(v0 * 3, v1 * 3), 3));
      G.setAttribute('normal', new T.Float32BufferAttribute(g.attributes.normal.array.slice(v0 * 3, v1 * 3), 3));
      G.setAttribute('uv', new T.Float32BufferAttribute(g.attributes.uv.array.slice(v0 * 2, v1 * 2), 2));
      return G;
    }
    var side = new T.BufferGeometry();
    // 24 вершины: [0..12) + [24..36)
    var sp = [], sn = [], su = [];
    for (var i = 0; i < 12; i++) {
      sp.push(g.attributes.position.array[i*3], g.attributes.position.array[i*3+1], g.attributes.position.array[i*3+2]);
      sn.push(g.attributes.normal.array[i*3], g.attributes.normal.array[i*3+1], g.attributes.normal.array[i*3+2]);
      su.push(g.attributes.uv.array[i*2], g.attributes.uv.array[i*2+1]);
    }
    for (var j = 24; j < 36; j++) {
      sp.push(g.attributes.position.array[j*3], g.attributes.position.array[j*3+1], g.attributes.position.array[j*3+2]);
      sn.push(g.attributes.normal.array[j*3], g.attributes.normal.array[j*3+1], g.attributes.normal.array[j*3+2]);
      su.push(g.attributes.uv.array[j*2], g.attributes.uv.array[j*2+1]);
    }
    side.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    side.setAttribute('normal', new T.Float32BufferAttribute(sn, 3));
    side.setAttribute('uv', new T.Float32BufferAttribute(su, 2));
    var cap = part(12, 24);
    g.dispose();
    return { side: side, cap: cap };
  }

  // Привязка UV фасада: плитка фасада tw x th метров, крыша — roofTile
  function scaleBoxUV(g, w, h, d, tw, th, roofTile) {
    var nor = g.attributes.normal, uv = g.attributes.uv;
    for (var i = 0; i < nor.count; i++) {
      var nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
      var su, sv;
      if (ny > 0.5) { su = w / roofTile; sv = d / roofTile; }
      else if (nx > 0.5) { su = d / tw; sv = h / th; }
      else { su = w / tw; sv = h / th; }
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
  }

  async function build(ctx, prog) {
    var T = ctx.T, CFG = ctx.CFG, noise = ctx.noise, grp = ctx.props;
    var claims = ctx.claims, addCollider = ctx.addCollider, heightAt = ctx.heightAt;
    var LAYERS = window.GridLib.LAYERS;
    var M = window.Mat.get();
    var seed = ctx.seed;
    var cell = CFG.map.blockSize + CFG.map.roadWidth;
    var roadW = CFG.map.roadWidth;
    var half = CFG.map.size / 2;
    var buildings = [], mounds = [], lots = [];
    var SPAWN = CFG.spawn;

    function makeBuilding(px, pz, w, d, floors, dmg, rr) {
      var fh = 3, t = CFG.city.wallThickness;
      var yB = heightAt(px, pz) - 0.06;
      var facadeGeoms = [], roofGeoms = [];
      var hw = w / 2, hd = d / 2;
      var walls = [
        { ax: 'x', line: pz - hd, a0: px - hw, L: w },
        { ax: 'x', line: pz + hd, a0: px - hw, L: w },
        { ax: 'z', line: px - hw, a0: pz - hd, L: d },
        { ax: 'z', line: px + hw, a0: pz - hd, L: d }
      ];
      for (var wi = 0; wi < walls.length; wi++) {
        var wl = walls[wi];
        var n = Math.max(1, Math.round(wl.L / window.RNG.range(rr, 3.4, 5.8)));
        var segL = wl.L / n;
        for (var c = 0; c < n; c++) {
          var mid = wl.a0 + segL * (c + 0.5);
          var roll = rr();
          var h = floors * fh;
          if (roll < dmg * 0.9) h *= Math.max(0.1, 1 - dmg * window.RNG.range(rr, 0.35, 1.0));
          if (roll < dmg * 0.32) h *= 0.15;
          if (h < 0.4) {
            if (rr() < 0.75) {
              var sy = window.RNG.range(rr, 0.5, 1.25);
              var mx = wl.ax === 'x' ? mid : wl.line;
              var mz = wl.ax === 'x' ? wl.line : mid;
              var along = segL * 0.8, cross = 1.9;
              mounds.push({
                x: mx, z: mz, y: yB,
                sx: wl.ax === 'x' ? along : cross,
                sz: wl.ax === 'x' ? cross : along,
                sy: sy
              });
            }
            continue;
          }
          var g, parts;
          if (wl.ax === 'x') {
            g = new T.BoxGeometry(segL + 0.02, h, t).toNonIndexed();
            scaleBoxUV(g, segL, h, t, 8, 6, 4);
            g.translate(mid, yB + h / 2, wl.line);
            addCollider({ x0: mid - segL / 2 - 0.01, y0: yB, z0: wl.line - t / 2, x1: mid + segL / 2 + 0.01, y1: yB + h, z1: wl.line + t / 2 }, LAYERS.BUILDING);
          } else {
            g = new T.BoxGeometry(t, h, segL + 0.02).toNonIndexed();
            scaleBoxUV(g, segL, h, t, 8, 6, 4);
            g.translate(wl.line, yB + h / 2, mid);
            addCollider({ x0: wl.line - t / 2, y0: yB, z0: mid - segL / 2 - 0.01, x1: wl.line + t / 2, y1: yB + h, z1: mid + segL / 2 + 0.01 }, LAYERS.BUILDING);
          }
          parts = splitBoxFaces(T, g);
          facadeGeoms.push({ g: parts.side, matIndex: 0 });
          roofGeoms.push({ g: parts.cap, matIndex: 0 });
        }
      }
      // плиты перекрытий (обнажённые этажи)
      var nSlabs = Math.min(2, Math.floor(dmg * 3 * rr()) + (rr() < 0.25 ? 1 : 0));
      for (var s = 0; s < nSlabs; s++) {
        var f = 1 + Math.floor(rr() * Math.max(1, floors - 1));
        var sw = w * 1.04, sd = d * 1.04;
        var sg = new T.BoxGeometry(sw, 0.26, sd).toNonIndexed();
        scaleBoxUV(sg, sw, 0.26, sd, 4, 4, 4);
        sg.translate(px, yB + f * fh, pz);
        roofGeoms.push({ g: sg, matIndex: 0 });
        addCollider({ x0: px - sw / 2, y0: yB + f * fh - 0.13, z0: pz - sd / 2, x1: px + sw / 2, y1: yB + f * fh + 0.13, z1: pz + sd / 2 }, LAYERS.BUILDING);
      }
      // большая груда у основания
      if (dmg > 0.5) {
        var sy2 = window.RNG.range(rr, 1.0, 1.4 + dmg * 1.3);
        mounds.push({
          x: px + window.RNG.range(rr, -w * 0.1, w * 0.1),
          z: pz + window.RNG.range(rr, -d * 0.1, d * 0.1),
          y: yB, sx: w * 0.62, sz: d * 0.62, sy: sy2
        });
      }
      claims.insert(px, pz, Math.hypot(w, d) / 2 + 1.4, true, 'building');
      buildings.push({ x: px, z: pz, w: w, d: d, dmg: dmg, y: yB, floors: floors });

      if (facadeGeoms.length) {
        var vIdx = Math.min(5, (dmg * 5.9) | 0);
        var meshF = new T.Mesh(mergeGeoms(T, facadeGeoms), M.facades[vIdx]);
        meshF.castShadow = true;
        meshF.receiveShadow = true;
        meshF.matrixAutoUpdate = false;
        meshF.name = 'Building';
        grp.add(meshF);
      }
      if (roofGeoms.length) {
        var meshR = new T.Mesh(mergeGeoms(T, roofGeoms), M.roof);
        meshR.castShadow = true;
        meshR.receiveShadow = true;
        meshR.matrixAutoUpdate = false;
        meshR.name = 'BuildingRoof';
        grp.add(meshR);
      }
    }

    // ---------- сетка кварталов ----------
    var nB = Math.round(half / cell); // 2 => центры 0,±47,±94
    var tasks = [];
    for (var bx = -nB; bx <= nB; bx++) for (var bz = -nB; bz <= nB; bz++) tasks.push([bx, bz]);
    var done = 0;
    var inner = CFG.map.blockSize / 2 - 2;

    for (var ti = 0; ti < tasks.length; ti++) {
      var bxv = tasks[ti][0], bzv = tasks[ti][1];
      var cx = bxv * cell, cz = bzv * cell;
      var rr = window.RNG.rngAt(seed, bxv * 61 + 17, bzv * 59 - 23, 'block');
      var urban = noise.fbm2(cx * 0.006 + 100, cz * 0.006 - 50, 3) * 0.5 + 0.5;
      var p = CFG.city.buildingDensity * (0.4 + 0.9 * urban);
      var placedHere = 0;

      if (window.RNG.chance(rr, Math.min(0.94, p))) {
        var nHere = (window.RNG.chance(rr, 0.42) && inner > 15) ? 2 : 1;
        for (var ib = 0; ib < nHere; ib++) {
          var w = window.RNG.range(rr, 10, 18);
          var d = window.RNG.range(rr, 10, 18);
          var floors = 2 + Math.floor(window.RNG.range(rr, 0, 1) * (CFG.city.maxFloors - 1) * (0.35 + 0.85 * urban));
          var px = 0, pz = 0, ok = false;
          for (var att = 0; att < 12; att++) {
            px = cx + window.RNG.range(rr, -(inner - w / 2), inner - w / 2);
            pz = cz + window.RNG.range(rr, -(inner - d / 2), inner - d / 2);
            var lx = (Math.floor(px / cell) + 0.5) * cell;
            var lz = (Math.floor(pz / cell) + 0.5) * cell;
            var mx = Math.abs(px - lx), mz = Math.abs(pz - lz);
            if (mx < roadW / 2 + w / 2 + 0.9) continue;
            if (mz < roadW / 2 + d / 2 + 0.9) continue;
            if (Math.hypot(px - SPAWN.x, pz - SPAWN.z) < 13) continue;
            if (claims.hits(px, pz, Math.hypot(w, d) / 2 + 1.6, false)) continue;
            ok = true; break;
          }
          if (!ok) continue;
          var dmg = Math.min(0.96, Math.max(0.06,
            CFG.destruction * (0.35 + 1.3 * (noise.fbm2(px * 0.02 - 7, pz * 0.02 + 9, 3) * 0.5 + 0.5)) +
            window.RNG.range(rr, -0.12, 0.12)));
          makeBuilding(px, pz, w, d, floors, dmg, rr);
          placedHere++;
        }
      }
      if (!placedHere && window.RNG.chance(rr, CFG.city.parkChance + (1 - p) * 0.5)) {
        lots.push({ x: cx, z: cz, type: window.RNG.chance(rr, 0.55) ? 'park' : 'rubble' });
      }
      done++;
      if (done % 4 === 0) {
        prog(done / tasks.length);
        await new Promise(function (res) { requestAnimationFrame(res); });
      }
    }

    return { buildings: buildings, mounds: mounds, lots: lots };
  }

  return { build: build };
})();
