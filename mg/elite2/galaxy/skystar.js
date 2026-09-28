/* /galaxy/skystar.js
 * Классический скрипт: кладёт в глобал объект SKYSTAR.
 * Требует window.THREE (модуль three подключается раньше).
 */
(function (global) {
  "use strict";

  // ------------------------------------------------------------------
  //  Утилита: детерминированный ГПСЧ (mulberry32)
  // ------------------------------------------------------------------
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------------
  //  Создание звёздного неба (сфера из THREE.Points)
  // ------------------------------------------------------------------
  function makeStarfield(seed, options) {
    const THREE = global.THREE;
    if (!THREE) throw new Error("SKYSTAR: window.THREE не найден");

    const opts = Object.assign(
      {
        count: 4000,
        radius: 4000,
        size: 4,
        opacity: 0.9,
        hueBase: 0.55,
        hueRange: 0.15,
        saturation: 0.3,
        lightnessMin: 0.7,
        lightnessRange: 0.3,
      },
      options || {},
    );

    const rng = mulberry32(seed);
    const pos = new Float32Array(opts.count * 3);
    const col = new Float32Array(opts.count * 3);

    for (let i = 0; i < opts.count; i++) {
      const u = rng() * 2 - 1;
      const t = rng() * Math.PI * 2;
      const r = opts.radius;
      const s = Math.sqrt(1 - u * u);

      pos[i * 3 + 0] = r * s * Math.cos(t);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * s * Math.sin(t);

      const c = new THREE.Color().setHSL(
        opts.hueBase + rng() * opts.hueRange,
        opts.saturation,
        opts.lightnessMin + rng() * opts.lightnessRange,
      );
      col[i * 3 + 0] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));

    const m = new THREE.PointsMaterial({
      size: opts.size,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: opts.opacity,
      depthWrite: false,
    });

    const points = new THREE.Points(g, m);
    points.frustumCulled = false;
    return points;
  }

  // ------------------------------------------------------------------
  //  Публичный API
  // ------------------------------------------------------------------
  global.SKYSTAR = {
    makeStarfield,
    mulberry32,
  };
})(window);