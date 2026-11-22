// ============================================================
//  Шумы: Simplex 2D, Perlin 2D/3D, Voronoi 2D + fBm/ridged.
//  Всё от seed — воспроизводимо между запусками.
// ============================================================
window.Noise = (function () {
  var G3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  var G2 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function Field(seed) {
    var r = mulberry32(seed | 0);
    var p = new Uint8Array(256);
    for (var i = 0; i < 256; i++) p[i] = i;
    for (var i2 = 255; i2 > 0; i2--) {
      var j = (r() * (i2 + 1)) | 0;
      var tmp = p[i2]; p[i2] = p[j]; p[j] = tmp;
    }
    this.p = new Uint8Array(512);
    for (var k = 0; k < 512; k++) this.p[k] = p[k & 255];
  }

  Field.prototype.simplex2 = function (xin, yin) {
    var F2 = 0.36602540378443865, G2 = 0.21132486540518713;
    var n0 = 0, n1 = 0, n2 = 0;
    var s = (xin + yin) * F2;
    var i = Math.floor(xin + s), j = Math.floor(yin + s);
    var t = (i + j) * G2;
    var x0 = xin - (i - t), y0 = yin - (j - t);
    var i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    var x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    var ii = i & 255, jj = j & 255, p = this.p, g;
    var t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { t0 *= t0; g = G3[p[ii + p[jj]] % 12]; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
    var t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { t1 *= t1; g = G3[p[ii + i1 + p[jj + j1]] % 12]; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
    var t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { t2 *= t2; g = G3[p[ii + 1 + p[jj + 1]] % 12]; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * (n0 + n1 + n2);
  };

  Field.prototype.perlin2 = function (x, y) {
    var X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    var u = fade(x), v = fade(y), p = this.p;
    function g2(h, gx, gy) { h &= 7; var gr = G2[h]; return gr[0] * gx + gr[1] * gy; }
    var aa = p[p[X] + Y], ab = p[p[X] + Y + 1], ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
    var x1 = lerp(g2(aa, x, y), g2(ba, x - 1, y), u);
    var x2 = lerp(g2(ab, x, y - 1), g2(bb, x - 1, y - 1), u);
    return lerp(x1, x2, v) * 1.4;
  };

  Field.prototype.perlin3 = function (x, y, z) {
    var X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    var u = fade(x), v = fade(y), w = fade(z), p = this.p;
    function g3(h, gx, gy, gz) {
      h &= 15;
      var uu = h < 8 ? gx : gy;
      var vv = h < 4 ? gy : (h === 12 || h === 14 ? gx : gz);
      return ((h & 1) ? -uu : uu) + ((h & 2) ? -vv : vv);
    }
    var A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(
      lerp(lerp(g3(p[AA], x, y, z), g3(p[BA], x - 1, y, z), u),
           lerp(g3(p[AB], x, y - 1, z), g3(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(g3(p[AA + 1], x, y, z - 1), g3(p[BA + 1], x - 1, y, z - 1), u),
           lerp(g3(p[AB + 1], x, y - 1, z - 1), g3(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  };

  function fbm(f, x, y, oct, lac, gain) {
    var amp = 1, frq = 1, sum = 0, norm = 0;
    for (var i = 0; i < oct; i++) {
      sum += amp * f.simplex2(x * frq, y * frq);
      norm += amp;
      amp *= gain; frq *= lac;
    }
    return sum / norm;
  }
  function ridge(f, x, y, oct) {
    var sum = 0, amp = 0.5, frq = 1, prev = 1;
    for (var i = 0; i < oct; i++) {
      var n = 1 - Math.abs(f.simplex2(x * frq, y * frq));
      n *= n;
      sum += n * amp * prev;
      prev = n;
      frq *= 2.07; amp *= 0.5;
    }
    return sum;
  }
  // Voronoi: расстояния до 1-й и 2-й опорной точки + случайное значение ячейки
  function voronoi2(seed, x, y) {
    var cx = Math.floor(x), cy = Math.floor(y);
    var d1 = 8, d2 = 8, cell = 0;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var gx = cx + dx, gy = cy + dy;
      var h = window.RNG.hashCombine(seed | 0, (gx * 374761393 + gy * 668265263) | 0, 0x5BD1);
      var r = mulberry32(h >>> 0);
      var px = gx + r(), py = gy + r();
      var d = Math.hypot(x - px, y - py);
      if (d < d1) { d2 = d1; d1 = d; cell = ((h >>> 8) & 255) / 255; }
      else if (d < d2) { d2 = d; }
    }
    return { d1: d1, d2: d2, cell: cell };
  }

  return {
    create: function (seed) {
      var f = new Field(seed);
      return {
        simplex2: function (x, y) { return f.simplex2(x, y); },
        perlin2: function (x, y) { return f.perlin2(x, y); },
        perlin3: function (x, y, z) { return f.perlin3(x, y, z); },
        fbm2: function (x, y, oct, lac, gain) { return fbm(f, x, y, oct || 4, lac || 2, gain || 0.5); },
        ridge2: function (x, y, oct) { return ridge(f, x, y, oct || 3); }
      };
    },
    voronoi2: voronoi2
  };
})();
