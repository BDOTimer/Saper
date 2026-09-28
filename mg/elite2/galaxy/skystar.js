/* /galaxy/skystar.js
 * Классический скрипт: кладёт в глобал объект SKYSTAR.
 * Требует window.THREE (модуль three подключается раньше).
 *
 * Возможности:
 *  - индивидуальный размер каждой звезды (1px … N px)
 *  - 5 форм: disc, glow, star, diamond, sparkle
 *  - варьируемый цвет по HSL
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

  // ==================================================================
  //  НАСТРОЙКИ ЗВЁЗДНОГО НЕБА
  //  Меняй только здесь.
  // ==================================================================
  const STARFIELD_DEFAULTS = {
    // ---- Геометрия сферы ----
    count: 4000,            // сколько всего звёзд
    radius: 4000,           // радиус сферы

    // ---- Размер (в пикселях, т.к. sizeAttenuation: false) ----
    sizeMin: 1.0,           // самая маленькая звезда, px
    sizeMax: 6.0,           // самая большая, px
    sizePow: 2.6,           // 1..N: >1 = больше мелких звёзд (реалистично)

    // ---- Формы ----
    // Вероятности (сумма приводится к 1 автоматически).
    shapeWeights: {
      disc:    60,   //  мягкий круглый диск
      glow:    20,   //  диск с ореолом
      star:    10,   //  N-лучевая звезда
      diamond:  6,   //  ромб
      sparkle:  4,   //  четыре луча-искры
    },
    starPoints: 4,          // лучей у формы "star"
    starSharpness: 0.55,    // резкость лучей (0..1)

    // ---- Цвет (HSL) ----
    hueBase: 0.55,          // базовый оттенок (0..1): 0.55 ≈ голубой
    hueRange: 0.55,         // разброс оттенка
    saturation: 0.45,       // насыщенность 0..1
    saturationJitter: 0.25, // добавочный разброс насыщенности
    lightnessMin: 0.65,     // минимальная яркость
    lightnessRange: 0.35,   // добавочная яркость

    // ---- Общее ----
    opacity: 0.95,          // общая прозрачность
    twinkle: true,          // лёгкое мерцание больших звёзд
    twinkleAmount: 0.25,    // амплитуда мерцания (0..1)
    twinkleSpeed: 1.5,      // скорость мерцания
  };

  // ------------------------------------------------------------------
  //  Vertex shader: индивидуальный размер + мерцание
  // ------------------------------------------------------------------
  const VERT = /* glsl */ `
    attribute float aSize;
    attribute float aShape;
    attribute float aPhase;

    uniform float uPixelRatio;
    uniform float uTime;
    uniform float uTwinkle;
    uniform float uTwinkleAmount;
    uniform float uTwinkleSpeed;

    varying vec3  vColor;
    varying float vShape;
    varying float vSize;

    void main() {
      vColor = color;
      vShape = aShape;
      vSize  = aSize;

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Мерцание: у больших звёзд амплитуда больше
      float tw = 1.0;
      if (uTwinkle > 0.5) {
        float phase = uTime * uTwinkleSpeed + aPhase * 6.2831853;
        float amp = uTwinkleAmount * smoothstep(1.5, 6.0, aSize);
        tw = 1.0 + sin(phase) * amp;
      }

      gl_PointSize = aSize * uPixelRatio * tw;
    }
  `;

  // ------------------------------------------------------------------
  //  Fragment shader: формы через gl_PointCoord
  // ------------------------------------------------------------------
  const FRAG = /* glsl */ `
    precision highp float;

    uniform float uOpacity;
    uniform float uStarPoints;
    uniform float uStarSharpness;

    varying vec3  vColor;
    varying float vShape;
    varying float vSize;

    // 1 = disc, 2 = glow, 3 = star, 4 = diamond, 5 = sparkle
    const float S_DISC    = 1.0;
    const float S_GLOW    = 2.0;
    const float S_STAR    = 3.0;
    const float S_DIAMOND = 4.0;
    const float S_SPARKLE = 5.0;

    float discMask(vec2 p, float soft) {
      float d = length(p);
      return 1.0 - smoothstep(0.5 - soft, 0.5, d);
    }

    float glowMask(vec2 p) {
      float d = length(p);
      // плотное ядро + мягкий ореол
      float core = 1.0 - smoothstep(0.0, 0.30, d);
      float halo = 1.0 - smoothstep(0.0, 0.50, d);
      return core * 0.9 + halo * 0.35;
    }

    float starMask(vec2 p, float points, float sharp) {
      float d = length(p);
      float a = atan(p.y, p.x);
      // n-лучевая роза
      float k = abs(cos(a * points * 0.5));
      k = pow(k, mix(6.0, 1.2, sharp));   // чем меньше sharp — тем тоньше лучи
      float core = 1.0 - smoothstep(0.0, 0.22, d);
      float rays = k * (1.0 - smoothstep(0.0, 0.5, d));
      return clamp(core + rays * 0.9, 0.0, 1.0);
    }

    float diamondMask(vec2 p) {
      float d = abs(p.x) + abs(p.y);      // L1-метрика = ромб
      return 1.0 - smoothstep(0.30, 0.50, d);
    }

    float sparkleMask(vec2 p) {
      // два тонких луча по осям + плотное ядро
      float ax = 1.0 - smoothstep(0.0, 0.05, abs(p.x));
      float ay = 1.0 - smoothstep(0.0, 0.05, abs(p.y));
      float lenX = 1.0 - smoothstep(0.0, 0.5, abs(p.x));
      float lenY = 1.0 - smoothstep(0.0, 0.5, abs(p.y));
      float core = 1.0 - smoothstep(0.0, 0.18, length(p));
      float rays = max(ax * lenY, ay * lenX);
      return clamp(core + rays * 0.85, 0.0, 1.0);
    }

    void main() {
      // p: [-0.5 .. 0.5], центр точки в 0
      vec2 p = gl_PointCoord - vec2(0.5);

      // Мягкость диска зависит от размера: мелкие — пиксельно-резкие, крупные — мягче
      float soft = mix(0.02, 0.18, smoothstep(1.0, 6.0, vSize));

      float m = 0.0;
      if      (vShape < 1.5) m = discMask(p, soft);
      else if (vShape < 2.5) m = glowMask(p);
      else if (vShape < 3.5) m = starMask(p, uStarPoints, uStarSharpness);
      else if (vShape < 4.5) m = diamondMask(p);
      else                   m = sparkleMask(p);

      if (m <= 0.001) discard;

      // Небольшой подъём яркости в центре, чтобы ядро «светилось»
      float coreBoost = 1.0 + (1.0 - smoothstep(0.0, 0.25, length(p))) * 0.6;

      gl_FragColor = vec4(vColor * coreBoost, m * uOpacity);
    }
  `;

  // ------------------------------------------------------------------
  //  Внутренние утилиты
  // ------------------------------------------------------------------
  function pickWeighted(weights, r) {
    // weights: { name: number }, сумма нормализуется
    const entries = Object.entries(weights);
    let total = 0;
    for (const [, w] of entries) total += w;
    let acc = 0;
    const target = r * total;
    for (let i = 0; i < entries.length; i++) {
      acc += entries[i][1];
      if (target <= acc) return entries[i][0];
    }
    return entries[entries.length - 1][0];
  }

  const SHAPE_INDEX = {
    disc: 1,
    glow: 2,
    star: 3,
    diamond: 4,
    sparkle: 5,
  };

  // ------------------------------------------------------------------
  //  Создание звёздного неба
  // ------------------------------------------------------------------
  function makeStarfield(seed, options) {
    const THREE = global.THREE;
    if (!THREE) throw new Error("SKYSTAR: window.THREE не найден");

    const opts = Object.assign({}, STARFIELD_DEFAULTS, options || {});
    const rng = mulberry32(seed);

    const n = opts.count;
    const pos   = new Float32Array(n * 3);
    const col   = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const shape = new Float32Array(n);
    const phase = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      // --- позиция на сфере ---
      const u = rng() * 2 - 1;
      const t = rng() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3 + 0] = opts.radius * s * Math.cos(t);
      pos[i * 3 + 1] = opts.radius * u;
      pos[i * 3 + 2] = opts.radius * s * Math.sin(t);

      // --- размер: bias к маленьким (sizePow > 1) ---
      const rr = Math.pow(rng(), opts.sizePow);
      sizes[i] = opts.sizeMin + rr * (opts.sizeMax - opts.sizeMin);

      // --- форма ---
      const shapeName = pickWeighted(opts.shapeWeights, rng());
      shape[i] = SHAPE_INDEX[shapeName] || 1;

      // --- фаза мерцания ---
      phase[i] = rng();

      // --- цвет (HSL -> RGB) ---
      const h = (opts.hueBase + (rng() - 0.5) * opts.hueRange + 1.0) % 1.0;
      const s2 = Math.min(
        1,
        Math.max(0, opts.saturation + (rng() - 0.5) * opts.saturationJitter),
      );
      const l = Math.min(
        1,
        opts.lightnessMin + rng() * opts.lightnessRange,
      );
      const c = new THREE.Color().setHSL(h, s2, l);
      col[i * 3 + 0] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color",    new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSize",    new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aShape",   new THREE.BufferAttribute(shape, 1));
    g.setAttribute("aPhase",   new THREE.BufferAttribute(phase, 1));

    const m = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uPixelRatio:     { value: Math.min(global.devicePixelRatio || 1, 2) },
        uTime:           { value: 0 },
        uOpacity:        { value: opts.opacity },
        uTwinkle:        { value: opts.twinkle ? 1 : 0 },
        uTwinkleAmount:  { value: opts.twinkleAmount },
        uTwinkleSpeed:   { value: opts.twinkleSpeed },
        uStarPoints:     { value: opts.starPoints },
        uStarSharpness:  { value: opts.starSharpness },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    const points = new THREE.Points(g, m);
    points.frustumCulled = false;

    // Обновление времени (для мерцания) — вызывается из animate()
    points.userData.update = function (dt, time) {
      m.uniforms.uTime.value = time;
    };

    // Пересчёт pixel ratio при resize
    points.userData.setPixelRatio = function (pr) {
      m.uniforms.uPixelRatio.value = Math.min(pr, 2);
    };

    return points;
  }

  // ------------------------------------------------------------------
  //  Публичный API
  // ------------------------------------------------------------------
  global.SKYSTAR = {
    makeStarfield,
    mulberry32,
    STARFIELD_DEFAULTS,
  };
})(window);