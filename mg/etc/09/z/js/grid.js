// ============================================================
//  Spatial grid: статические AABB-коллайдеры и «захваты» места.
//  Слои физики (Layers): TERRAIN | BUILDING | PROP | DEBRIS | PLAYER
//  Матрица коллизий: игрок проверяется против BUILDING/PROP/DEBRIS,
//  статические объекты между собой не сталкиваются.
//  Рельеф коллидируется аналитически (heightfield).
// ============================================================
window.GridLib = (function () {
  var LAYERS = { TERRAIN: 1, BUILDING: 2, PROP: 4, DEBRIS: 8, PLAYER: 16 };

  function overlap(a, b) {
    return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;
  }
  function overlapXZ(a, b) {
    return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
  }

  // Сетка статических AABB-коллайдеров
  function SpatialGrid(cell) {
    this.cell = cell;
    this.cells = new Map();
    this.items = [];
    this._seen = new Set();
  }
  SpatialGrid.prototype._key = function (cx, cz) { return (cx + 512) * 4096 + (cz + 512); };
  SpatialGrid.prototype.insert = function (item, box) {
    var idx = this.items.length;
    item.box = box;
    this.items.push(item);
    var c = this.cell;
    var x0 = Math.floor(box.x0 / c), x1 = Math.floor(box.x1 / c);
    var z0 = Math.floor(box.z0 / c), z1 = Math.floor(box.z1 / c);
    for (var cx = x0; cx <= x1; cx++) for (var cz = z0; cz <= z1; cz++) {
      var k = this._key(cx, cz);
      var arr = this.cells.get(k);
      if (!arr) { arr = []; this.cells.set(k, arr); }
      arr.push(idx);
    }
    return item;
  };
  SpatialGrid.prototype.query = function (box, out) {
    out = out || [];
    var seen = this._seen; seen.clear();
    var c = this.cell;
    var x0 = Math.floor(box.x0 / c), x1 = Math.floor(box.x1 / c);
    var z0 = Math.floor(box.z0 / c), z1 = Math.floor(box.z1 / c);
    for (var cx = x0; cx <= x1; cx++) for (var cz = z0; cz <= z1; cz++) {
      var arr = this.cells.get(this._key(cx, cz));
      if (!arr) continue;
      for (var i = 0; i < arr.length; i++) {
        var idx = arr[i];
        if (seen.has(idx)) continue;
        seen.add(idx);
        out.push(this.items[idx]);
      }
    }
    return out;
  };
  SpatialGrid.prototype.clear = function () { this.cells.clear(); this.items.length = 0; };

  // Обход ячеек вдоль луча (2D DDA по XZ). Используется пулями и
  // проверкой линии видимости: собирает все коллайдеры, через
  // которые проходит луч, без пропуска тонких стен.
  SpatialGrid.prototype.rayQuery = function (ox, oz, dx, dz, maxDist, out) {
    out = out || [];
    var seen = this._seen; seen.clear();
    var c = this.cell;
    var cx = Math.floor(ox / c), cz = Math.floor(oz / c);
    var stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
    var stepZ = dz > 0 ? 1 : (dz < 0 ? -1 : 0);
    var invX = dx !== 0 ? Math.abs(dx) : Infinity;
    var invZ = dz !== 0 ? Math.abs(dz) : Infinity;
    var tMaxX = stepX !== 0 ? ((stepX > 0 ? (cx + 1) * c - ox : ox - cx * c) / invX) : Infinity;
    var tMaxZ = stepZ !== 0 ? ((stepZ > 0 ? (cz + 1) * c - oz : oz - cz * c) / invZ) : Infinity;
    var tDX = stepX !== 0 ? c / invX : Infinity;
    var tDZ = stepZ !== 0 ? c / invZ : Infinity;
    var guard = 0;
    while (guard++ < 800) {
      var arr = this.cells.get(this._key(cx, cz));
      if (arr) {
        for (var i = 0; i < arr.length; i++) {
          var idx = arr[i];
          if (seen.has(idx)) continue;
          seen.add(idx);
          out.push(this.items[idx]);
        }
      }
      if (tMaxX < tMaxZ) {
        if (tMaxX > maxDist) break;
        cx += stepX; tMaxX += tDX;
      } else {
        if (tMaxZ > maxDist) break;
        cz += stepZ; tMaxZ += tDZ;
      }
    }
    return out;
  };

  // Сетка «захвата» территории: чтобы сгенерированные объекты не пересекались.
  // big=true — крупные объекты (здания, камни, деревья); мелкий мусор
  // блокируется только крупными объектами, между собой допустимо.
  function ClaimGrid(cell) {
    this.cell = cell;
    this.cells = new Map();
    this.count = 0;
  }
  ClaimGrid.prototype._key = function (cx, cz) { return (cx + 512) * 4096 + (cz + 512); };
  ClaimGrid.prototype.insert = function (x, z, r, big, tag) {
    var it = { x: x, z: z, r: r, big: !!big, tag: tag || '' };
    this.count++;
    var c = this.cell;
    var x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    var z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (var cx = x0; cx <= x1; cx++) for (var cz = z0; cz <= z1; cz++) {
      var k = this._key(cx, cz);
      var arr = this.cells.get(k);
      if (!arr) { arr = []; this.cells.set(k, arr); }
      arr.push(it);
    }
    return it;
  };
  ClaimGrid.prototype.hits = function (x, z, r, bigOnly) {
    var c = this.cell;
    var x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    var z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (var cx = x0; cx <= x1; cx++) for (var cz = z0; cz <= z1; cz++) {
      var arr = this.cells.get(this._key(cx, cz));
      if (!arr) continue;
      for (var i = 0; i < arr.length; i++) {
        var it = arr[i];
        if (bigOnly && !it.big) continue;
        var dx = x - it.x, dz = z - it.z;
        var rr = r + it.r;
        if (dx * dx + dz * dz < rr * rr) return it;
      }
    }
    return null;
  };
  ClaimGrid.prototype.clear = function () { this.cells.clear(); this.count = 0; };

  return { LAYERS: LAYERS, overlap: overlap, overlapXZ: overlapXZ, SpatialGrid: SpatialGrid, ClaimGrid: ClaimGrid };
})();
