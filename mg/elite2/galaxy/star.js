// star.js — генератор уникального светила для Elite-подобной игры
// Зависимости: THREE должен быть доступен глобально (window.THREE)

const STAR = (() => {
  // --- RNG (mulberry32) ---
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- Хэш строки в число ---
  function strHash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // --- Параметры светила из статов звезды ---
  function computeParams(star) {
    if (!star) throw new Error("STAR.computeParams: star is required");

    const seed = ((star.id | 0) * 2654435761) ^ strHash(star.name || "");
    const rng = mulberry32(seed >>> 0);

    const baseHue = typeof star.hue === "number" ? star.hue : (star.id * 0.137) % 1;

    let klass;
    if (baseHue < 0.15) klass = "red-dwarf";
    else if (baseHue < 0.35) klass = "orange";
    else if (baseHue < 0.65) klass = "yellow";
    else if (baseHue < 0.85) klass = "white-blue";
    else klass = "blue-giant";

    const tech = Math.max(1, Math.min(15, star.tech | 0));
    const danger = typeof star.danger === "number" ? star.danger : 0;

    const radiusBase = {
      "red-dwarf": 60, orange: 90, yellow: 120, "white-blue": 140, "blue-giant": 180,
    }[klass];

    const radius = radiusBase + rng() * 40;
    const coronaScale = 1.8 + danger * 2.2 + rng() * 0.4;
    const coronaIntensity = 0.6 + danger * 1.8;

    const pulseSpeed = klass === "red-dwarf" ? 3.0 + rng() * 2.0 : 0.8 + rng() * 1.2;
    const pulseAmp = klass === "red-dwarf" ? 0.08 + rng() * 0.06 : 0.03 + rng() * 0.03;

    const coreHue = baseHue;
    const coreSat = klass === "white-blue" || klass === "blue-giant" ? 0.9 : 0.8;
    const coreLum = klass === "blue-giant" ? 0.85 : klass === "red-dwarf" ? 0.55 : 0.7;

    const coronaHue = (coreHue + 0.03) % 1;
    const coronaSat = coreSat * 0.9;
    const coronaLum = Math.min(0.95, coreLum + 0.15);

    const lightColor = new THREE.Color().setHSL(coreHue, coreSat, coreLum);
    const lightIntensity = 1.2 + tech * 0.05 + danger * 0.5;
    const lightDistance = radius * 20;

    return {
      seed, klass, radius, baseHue, coreHue, coreSat, coreLum,
      coronaHue, coronaSat, coronaLum, coronaScale, coronaIntensity,
      pulseSpeed, pulseAmp, lightColor, lightIntensity, lightDistance,
    };
  }

  // --- Шейдер светила (ИСПРАВЛЕННЫЙ) ---
  const starVert = /* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormalW;
    varying vec3 vViewDir;

    void main() {
      vPos = position;
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vViewDir = normalize(cameraPosition - worldPos.xyz);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const starFrag = /* glsl */ `
    precision highp float;

    varying vec3 vPos;
    varying vec3 vNormalW;
    varying vec3 vViewDir;

    uniform vec3  uCoreColor;
    uniform vec3  uCoronaColor;
    uniform float uTime;
    uniform float uSeed;
    uniform float uPulseAmp;
    uniform float uPulseSpeed;
    uniform float uActivity;

    // --- Простой и надежный 3D шум (Value Noise) ---
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2  C = vec2(1.0/6.0, 1.0/3.0);
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    // Фрактальный шум (FBM) для детализации
    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * snoise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v; // возвращает значение примерно от -1.0 до 1.0
    }

    void main() {
      vec3 n = normalize(vPos);

      // Анимация: смещаем координаты шума со временем для эффекта "кипения" плазмы
      float timeScaled = uTime * 0.15 * uPulseSpeed;
      vec3 noiseCoord = n * 2.5 + vec3(timeScaled, timeScaled * 0.5, 0.0) + uSeed;

      // Базовая текстура поверхности (приводим диапазон -1..1 к 0..1)
      float noiseVal = fbm(noiseCoord) * 0.5 + 0.5;

      // Добавляем мелкую детализацию (грануляцию)
      float detailNoise = snoise(n * 6.0 + vec3(timeScaled * 2.0)) * 0.5 + 0.5;
      noiseVal = mix(noiseVal, detailNoise, 0.3);

      // Пульсация общей яркости
      float pulse = 1.0 + sin(uTime * uPulseSpeed + uSeed) * uPulseAmp;

      // Эффект Френеля для свечения по краям (переход в корону)
      float fresnel = pow(1.0 - max(dot(vNormalW, vViewDir), 0.0), 3.0);

      // Формирование цвета
      vec3 darkBase = uCoreColor * 0.25;          // Темные участки (пятна)
      vec3 brightSpot = uCoronaColor * 1.8;       // Ярчайшие вспышки (почти белые)

      vec3 finalColor = mix(darkBase, uCoreColor, noiseVal);
      // Добавляем яркие вспышки только на самых высоких значениях шума
      finalColor = mix(finalColor, brightSpot, pow(noiseVal, 5.0) * uActivity);

      // Добавляем свечение по краям (корона)
      finalColor = mix(finalColor, uCoronaColor * 1.3, fresnel * (0.6 + uActivity * 0.4));

      // Применяем общую пульсацию
      finalColor *= pulse;

      // === КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Мягкое ограничение яркости ===
      // Вместо жесткого умножения, которое дает пересвет в белый цвет,
      // используем асимптотическую функцию, которая сохраняет детали.
      finalColor = finalColor / (finalColor + vec3(1.0));
      finalColor *= 1.8; // Компенсация общего затемнения для сочности цвета

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  // --- Создание меша светила ---
  function makeMesh(params) {
    const geo = new THREE.SphereGeometry(params.radius, 64, 64); // Увеличено до 64 для гладкости

    const coreColor = new THREE.Color().setHSL(params.coreHue, params.coreSat, params.coreLum);
    const coronaColor = new THREE.Color().setHSL(params.coronaHue, params.coronaSat, params.coronaLum);

    const mat = new THREE.ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      uniforms: {
        uCoreColor: { value: coreColor },
        uCoronaColor: { value: coronaColor },
        uTime: { value: 0 },
        uSeed: { value: (params.seed % 1000) * 0.01 }, // Нормализованный сид
        uPulseAmp: { value: params.pulseAmp },
        uPulseSpeed: { value: params.pulseSpeed },
        // Гарантируем минимальную активность, чтобы звезда не выглядела "мертвой"
        uActivity: { value: Math.max(0.3, Math.min(1.0, params.coronaIntensity / 2.5)) },
      },
      toneMapped: false, // Оставляем false, так как мы сами контролируем диапазон в шейдере
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.params = params;
    return mesh;
  }

  // --- Создание короны (аддитивная сфера) ---
  function makeCorona(params) {
    // Увеличено количество сегментов до 48 для идеально гладкого градиента свечения
    const geo = new THREE.SphereGeometry(params.radius * params.coronaScale, 48, 48);
    const col = new THREE.Color().setHSL(params.coronaHue, params.coronaSat, params.coronaLum);
    
    const mat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: Math.min(0.35, 0.12 * params.coronaIntensity), // Сделал мягче, чтобы не перекрывать звезду
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.BackSide,
    });
    
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isCorona = true;
    return mesh;
  }

  // --- Публичное API ---
  return {
    getParams(star) {
      return computeParams(star);
    },

    generate(star, opts = {}) {
      const params = computeParams(star);
      const mesh = makeMesh(params);
      const corona = makeCorona(params);

      const pos = opts.position || new THREE.Vector3(0, 0, 0);
      mesh.position.copy(pos);
      corona.position.copy(pos);

      const light = new THREE.PointLight(
        params.lightColor,
        params.lightIntensity,
        params.lightDistance,
        2
      );
      light.position.copy(mesh.position);

      mesh.userData.klass = params.klass;

      // Анимация пульсации
      const update = (dt, time) => {
        mesh.material.uniforms.uTime.value = time;
        const p = 1 + Math.sin(time * params.pulseSpeed) * params.pulseAmp * 0.5;
        corona.scale.setScalar(p);
        light.intensity = params.lightIntensity * (0.9 + 0.1 * p);
      };

      const getDangerLevel = (playerPosition) => {
        if (!playerPosition) return 0;
        const DangerRangeFactor = 2;
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);

        const dist = playerPosition.distanceTo(worldPos);
        const r = params.radius;
        const outer = r * DangerRangeFactor;

        if (dist <= r) return 1.0;
        if (dist >= outer) return 0.0;

        const t = (dist - r) / (outer - r);
        const s = t * t * (3 - 2 * t); // smoothstep
        return 1.0 - s;
      };

      return { mesh, corona, light, params, update, getDangerLevel };
    },

    dispose(handle) {
      if (!handle) return;
      for (const obj of [handle.mesh, handle.corona]) {
        if (!obj) continue;
        obj.geometry?.dispose?.();
        if (Array.isArray(obj.material))
          obj.material.forEach((m) => m.dispose?.());
        else obj.material?.dispose?.();
      }
    },
  };
})();