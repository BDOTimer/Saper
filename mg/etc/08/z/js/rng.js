// ============================================================
//  Детерминированный ГПСЧ + утилиты.
//  Одинаковый seed => одинаковые объекты в одинаковом порядке.
//  rngAt(seed,x,z,tag) — ГПСЧ, привязанный к позиции: порядок
//  генерации не влияет на результат (асинхронность безопасна).
// ============================================================
window.RNG = (function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function hashCombine() {
    var h = 0x9E3779B9 >>> 0;
    for (var i = 0; i < arguments.length; i++) {
      h = Math.imul(h ^ (arguments[i] | 0), 0x85EBCA6B);
      h ^= h >>> 13;
    }
    h = Math.imul(h ^ (h >>> 16), 0xC2B2AE35);
    return h >>> 0;
  }
  // Позиционный ГПСЧ: объекты «живут» в координатах, а не в очереди
  function rngAt(seed, x, z, tag) {
    var h = hashCombine(seed | 0, hashStr(String(tag)), Math.round(x * 8) | 0, Math.round(z * 8) | 0);
    return mulberry32(h);
  }
  function range(r, a, b) { return a + (b - a) * r(); }
  function pick(r, arr) { return arr[(r() * arr.length) | 0]; }
  function chance(r, p) { return r() < p; }
  function randomSeed() { return (Math.random() * 0x7fffffff) | 0; }
  return { mulberry32: mulberry32, hashStr: hashStr, hashCombine: hashCombine,
           rngAt: rngAt, range: range, pick: pick, chance: chance, randomSeed: randomSeed };
})();

window.Util = (function () {
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  return { clamp: clamp, lerp: lerp, smoothstep: smoothstep };
})();
