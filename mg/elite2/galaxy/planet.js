// planet.js — генератор уникальной планеты с процедурной картой высот (CanvasTexture 512x512)
// Зависимости: THREE должен быть доступен глобально (window.THREE).

const PLANET = (() => {
  // ---------------------------------------------------------------
  //  RNG
  // ---------------------------------------------------------------
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function strHash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // ---------------------------------------------------------------
  //  Параметры планеты
  // ---------------------------------------------------------------
function computeParams(star, opts = {}) {
    if (!star) throw new Error("PLANET.computeParams: star is required");

    // Базовый сид от звезды
    const starSeed =
      ((star.id | 0) * 2246822519) ^
      strHash((star.name || "") + "|" + (star.economy || ""));

    // Индекс планеты в системе (или явный seed из opts) — чтобы текстуры
    // у разных планет одной звезды не совпадали
    const planetIndex = (opts.planetIndex | 0) || 0;
    const extraSeed   = (opts.seed | 0) || 0;

    const seed = (starSeed ^ Math.imul(planetIndex + 1, 0x9e3779b1) ^ Math.imul(extraSeed + 1, 0x85ebca6b)) >>> 0;
    const rng = mulberry32(seed >>> 0);

    const tech = Math.max(1, Math.min(15, star.tech | 0));
    const danger = typeof star.danger === "number" ? star.danger : 0;

    let klass;
    switch (star.economy) {
      case "Industrial": klass = "rocky-dark"; break;
      case "Mining":     klass = "rocky";      break;
      case "Agricultural": klass = "green";    break;
      case "Refinery":   klass = "brown";      break;
      case "High-Tech":  klass = "blue";       break;
      case "Tourism":    klass = "vivid";      break;
      default:           klass = "rocky";
    }

    const pop = Math.max(0, star.population || 0);
    const popFactor = Math.min(1, Math.log10(pop + 1) / 10);
    const radius = 180 + popFactor * 120 + rng() * 60;

    // --- Палитра (Вода, Суша, Горы/Высоты) ---
    let colorWater, colorLand, colorHigh;

    if (klass === "green") {
      colorWater = new THREE.Color().setHSL(0.6 + rng() * 0.05, 0.7, 0.2 + rng() * 0.1);
      colorLand  = new THREE.Color().setHSL(0.25 + rng() * 0.1, 0.6 + rng() * 0.2, 0.3 + rng() * 0.15);
      colorHigh  = new THREE.Color().setHSL(0.1 + rng() * 0.05, 0.4, 0.4 + rng() * 0.1);
    } else if (klass === "blue") {
      colorWater = new THREE.Color().setHSL(0.6 + rng() * 0.05, 0.8, 0.15 + rng() * 0.1);
      colorLand  = new THREE.Color().setHSL(0.55 + rng() * 0.05, 0.6, 0.4 + rng() * 0.15);
      colorHigh  = new THREE.Color().setHSL(0.0, 0.0, 0.8 + rng() * 0.15);
    } else if (klass === "brown") {
      colorWater = new THREE.Color().setHSL(0.05 + rng() * 0.05, 0.6, 0.15 + rng() * 0.1);
      colorLand  = new THREE.Color().setHSL(0.08 + rng() * 0.05, 0.7, 0.3 + rng() * 0.15);
      colorHigh  = new THREE.Color().setHSL(0.12 + rng() * 0.05, 0.5, 0.5 + rng() * 0.15);
    } else if (klass === "vivid") {
      const h = rng();
      colorWater = new THREE.Color().setHSL(h, 0.8, 0.2 + rng() * 0.1);
      colorLand  = new THREE.Color().setHSL((h + 0.33) % 1, 0.8, 0.4 + rng() * 0.15);
      colorHigh  = new THREE.Color().setHSL((h + 0.66) % 1, 0.8, 0.6 + rng() * 0.15);
    } else if (klass === "rocky-dark") {
      colorWater = new THREE.Color().setHSL(0.0, 0.8, 0.1 + rng() * 0.05);
      colorLand  = new THREE.Color().setHSL(0.05 + rng() * 0.05, 0.3, 0.15 + rng() * 0.1);
      colorHigh  = new THREE.Color().setHSL(0.08 + rng() * 0.05, 0.4, 0.3 + rng() * 0.1);
    } else {
      colorWater = new THREE.Color().setHSL(0.6 + rng() * 0.1, 0.3, 0.15 + rng() * 0.1);
      colorLand  = new THREE.Color().setHSL(0.08 + rng() * 0.05, 0.2, 0.3 + rng() * 0.15);
      colorHigh  = new THREE.Color().setHSL(0.1 + rng() * 0.05, 0.1, 0.5 + rng() * 0.15);
    }

    // --- Атмосфера ---
    const hasAtmosphere = klass !== "rocky-dark" && rng() > 0.25;
    const atmoHue =
      klass === "green" ? 0.55 :
      klass === "blue"  ? 0.58 :
      0.55 + rng() * 0.1;
    const atmosphereColor = new THREE.Color().setHSL(atmoHue, 0.7, 0.6);
    const atmosphereScale = 1.04 + rng() * 0.04;
    const atmosphereIntensity = hasAtmosphere ? 0.4 + tech * 0.03 : 0;

    // --- Кольца ---
    const hasRings = rng() > 0.78 && radius > 200;
    const ringInner = radius * 1.6 + rng() * 20;
    const ringOuter = ringInner + 40 + rng() * 80;
    const ringColor = new THREE.Color().setHSL(
      colorLand.getHSL({ h: 0, s: 0, l: 0 }).h,
      0.4,
      0.6,
    );
    const ringTilt = (rng() - 0.5) * 0.6;

    const spinSpeed = 0.02 + rng() * 0.06;
    const dangerRangeFactor = 2 + rng() * 2;
    const noiseSeed = (seed >>> 0) % 10000;

    // ★ Уникальный сид для текстуры
    //   Смешиваем seed с индексом планеты, чтобы у каждой планеты
    //   в системе была своя карта высот.
    //   Формула — тот же трюк "xorshift + golden ratio", что и выше.
    const texSeed = (
      (seed ^ Math.imul(planetIndex + 1, 0x27d4eb2d)) >>> 0
    ) % 1_000_000;

    // Размер текстуры: 512 по умолчанию, но можно переопределить через opts
    const textureSize = Math.max(64, Math.min(2048, (opts.textureSize | 0) || 512));

    return {
      seed, klass, radius,
      colorWater, colorLand, colorHigh,
      hasAtmosphere, atmosphereColor, atmosphereScale, atmosphereIntensity,
      hasRings, ringInner, ringOuter, ringColor, ringTilt,
      spinSpeed, noiseSeed, texSeed, textureSize, dangerRangeFactor,
    };
  }

  // ===============================================================
  //  Одноразовая генерация карты высот 512x512 (CanvasTexture)
  // ===============================================================
  function makePlanetTexture(params) {
    const SIZE = params.textureSize || 512;

    // Быстрый детерминированный value-noise
    const hash2 = (x, y, s) => {
      let h = x * 374761393 + y * 668265263 + s * 1442695040;
      h = (h ^ (h >>> 13)) * 1274126177;
      h = h ^ (h >>> 16);
      return (h >>> 0) / 4294967296;
    };

    const smooth = (t) => t * t * (3 - 2 * t);

    const valueNoise = (x, y, s) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const a = hash2(xi,     yi,     s);
      const b = hash2(xi + 1, yi,     s);
      const c = hash2(xi,     yi + 1, s);
      const d = hash2(xi + 1, yi + 1, s);
      const u = smooth(xf), v = smooth(yf);
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    };

    const fbm2 = (x, y, s, octaves = 5) => {
      let v = 0, amp = 0.5, freq = 1;
      for (let i = 0; i < octaves; i++) {
        v += amp * valueNoise(x * freq, y * freq, s + i * 17);
        freq *= 2;
        amp *= 0.5;
      }
      return v;
    };

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(SIZE, SIZE);

    const s = params.texSeed | 0;

    for (let y = 0; y < SIZE; y++) {
      const v = y / (SIZE - 1);
      const theta = v * Math.PI;

      for (let x = 0; x < SIZE; x++) {
        const u = x / (SIZE - 1);
        const phi = u * Math.PI * 2;

        // Сферические координаты — шум без шва и полюсных артефактов
        const nx = Math.sin(theta) * Math.cos(phi);
        const ny = Math.cos(theta);
        const nz = Math.sin(theta) * Math.sin(phi);

        const continents = fbm2(nx * 2.0 + s, ny * 2.0 + s, s, 4);
        const detail     = fbm2(nx * 8.0 + s, nz * 8.0 + s, s + 99, 3);
        let elev = continents * 0.75 + detail * 0.25;
        elev = Math.max(0, Math.min(1, elev));

        const e = Math.round(elev * 255);
        const idx = (y * SIZE + x) * 4;
        img.data[idx + 0] = e;
        img.data[idx + 1] = e;
        img.data[idx + 2] = e;
        img.data[idx + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  // ===============================================================
  //  Шейдеры планеты
  // ===============================================================
  const planetVert = /* glsl */ `
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const planetFrag = /* glsl */ `
    precision highp float;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec2 vUv;

    uniform sampler2D uElevTex;
    uniform vec3  uColorWater;
    uniform vec3  uColorLand;
    uniform vec3  uColorHigh;
    uniform vec3  uAtmosphereColor;
    uniform float uAtmosphereIntensity;
    uniform vec3  uLightDir;
    uniform vec3  uLightColor;

    void main() {
      // Карта высот: красный канал
      float elev = texture2D(uElevTex, vUv).r;

      // Широта для полярных шапок (vUv.y: 0 = полюс, 1 = полюс)
      float lat = abs(cos(vUv.y * 3.14159265));

      // Выбор биома по высоте
      vec3 color;
      float waterLevel    = 0.42;
      float beachLevel    = waterLevel + 0.05;
      float mountainLevel = 0.75;

      if (elev < waterLevel) {
        float depth = smoothstep(0.1, waterLevel, elev);
        color = mix(uColorWater * 0.3, uColorWater, depth);
      } else if (elev < beachLevel) {
        float t = (elev - waterLevel) / (beachLevel - waterLevel);
        color = mix(uColorWater * 1.2, uColorLand, t);
      } else if (elev < mountainLevel) {
        float t = (elev - beachLevel) / (mountainLevel - beachLevel);
        color = mix(uColorLand, uColorHigh * 0.8, t);
      } else {
        float t = (elev - mountainLevel) / (1.0 - mountainLevel);
        color = mix(uColorHigh, vec3(0.9, 0.95, 1.0), t * 0.5);
      }

      // Полярные шапки
      float iceCap = smoothstep(0.7, 0.95, lat + elev * 0.3);
      color = mix(color, vec3(0.95, 0.98, 1.0), iceCap);

      // Освещение (PBR-lite)
      vec3 N = normalize(vWorldNormal);
      vec3 L = normalize(uLightDir);
      vec3 V = normalize(cameraPosition - vWorldPos);

      float NdotL = dot(N, L);
      float diff = smoothstep(-0.1, 0.3, NdotL);

      float spec = 0.0;
      if (elev < waterLevel) {
        vec3 H = normalize(L + V);
        spec = pow(max(dot(N, H), 0.0), 64.0) * 0.8;
      }

      float rim = 1.0 - max(dot(N, V), 0.0);
      rim = pow(rim, 3.0) * uAtmosphereIntensity;

      //vec3 nightColor = vec3(0.01, 0.02, 0.05);
      //vec3 dayColor = color * (0.08 + diff * uLightColor) + spec * uLightColor;

      ///-----------------|
      /// ...             |
      ///-----------------:
      vec3 dayColor = color * 0.05;
      vec3 nightColor = dayColor;
      
      float dayNightMix = smoothstep(-0.2, 0.1, NdotL);
      vec3 finalColor = mix(nightColor, dayColor, dayNightMix);

      vec3 rimColor = uAtmosphereColor * rim * (0.5 + 0.5 * smoothstep(-0.2, 0.5, NdotL));
      finalColor += rimColor;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  // ===============================================================
  //  Шейдеры атмосферы
  // ===============================================================
  const atmosVert = /* glsl */ `
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const atmosFrag = /* glsl */ `
    precision highp float;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    uniform vec3 uAtmosphereColor;
    uniform vec3 uLightDir;
    uniform float uIntensity;

    void main() {
      vec3 N = normalize(vWorldNormal);
      vec3 V = normalize(cameraPosition - vWorldPos);
      vec3 L = normalize(uLightDir);

      float rim = 1.0 - max(dot(N, V), 0.0);
      rim = pow(rim, 2.5);

      float sunAlignment = max(dot(N, L), 0.0);
      float sunScatter = pow(sunAlignment, 2.0) * 0.5 + 0.5;

      float alpha = rim * uIntensity * sunScatter;
      vec3 color = uAtmosphereColor * alpha * 1.5;

      gl_FragColor = vec4(color, alpha * 0.8);
    }
  `;

  // ===============================================================
  //  Шейдеры колец
  // ===============================================================
  const ringVert = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldNormal;
    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const ringFrag = /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    varying vec3 vWorldNormal;
    uniform vec3 uRingColor;
    uniform vec3 uLightDir;
    uniform float uSeed;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }

    void main() {
      float r = vUv.x;

      float bands = noise(vec2(r * 50.0, uSeed)) * 0.5 + 0.5;
      float gaps  = smoothstep(0.3, 0.35, noise(vec2(r * 20.0, uSeed * 0.5)));
      float alpha = bands * gaps;

      alpha *= smoothstep(0.0, 0.1, r) * smoothstep(1.0, 0.9, r);

      vec3 N = normalize(vWorldNormal);
      vec3 L = normalize(uLightDir);
      float diff = max(dot(N, L), 0.0) * 0.8 + 0.2;

      vec3 color = uRingColor * diff;
      gl_FragColor = vec4(color, alpha * 0.7);
    }
  `;

  // ===============================================================
  //  Создание мешей
  // ===============================================================
  function makePlanetMesh(params, lightDir, lightColor, elevTex) {
    const geo = new THREE.SphereGeometry(params.radius, 64, 64);
    const mat = new THREE.ShaderMaterial({
      vertexShader: planetVert,
      fragmentShader: planetFrag,
      uniforms: {
        uElevTex:            { value: elevTex },
        uColorWater:         { value: params.colorWater },
        uColorLand:          { value: params.colorLand },
        uColorHigh:          { value: params.colorHigh },
        uAtmosphereColor:    { value: params.atmosphereColor },
        uAtmosphereIntensity:{ value: params.atmosphereIntensity },
        uLightDir:           { value: lightDir },
        uLightColor:         { value: lightColor },
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.radius = params.radius;
    mesh.userData.klass = params.klass;
    return mesh;
  }

  function makeAtmosphere(params, lightDir) {
    if (!params.hasAtmosphere || params.atmosphereIntensity <= 0) return null;
    const geo = new THREE.SphereGeometry(
      params.radius * params.atmosphereScale,
      48,
      48,
    );
    const mat = new THREE.ShaderMaterial({
      vertexShader: atmosVert,
      fragmentShader: atmosFrag,
      uniforms: {
        uAtmosphereColor: { value: params.atmosphereColor },
        uLightDir:        { value: lightDir },
        uIntensity:       { value: params.atmosphereIntensity },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isAtmosphere = true;
    return mesh;
  }

  function makeRings(params, lightDir) {
    if (!params.hasRings) return null;
    const geo = new THREE.RingGeometry(
      params.ringInner,
      params.ringOuter,
      128,
      4,
    );

    // UV.x = 0 (внутренний край) → 1 (внешний край)
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const v3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v3.fromBufferAttribute(pos, i);
      const len = v3.length();
      uv.setXY(
        i,
        (len - params.ringInner) / (params.ringOuter - params.ringInner),
        1,
      );
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: ringVert,
      fragmentShader: ringFrag,
      uniforms: {
        uRingColor: { value: params.ringColor },
        uLightDir:  { value: lightDir },
        uSeed:      { value: params.noiseSeed * 0.01 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2 + params.ringTilt;
    return mesh;
  }

  // ===============================================================
  //  Публичное API
  // ===============================================================
  return {
    getParams(star) {
      return computeParams(star);
    },

    generate(star, opts = {}) {
      const params = computeParams(star, opts);

      // Направление на звезду для освещения
      let lightDir = new THREE.Vector3(1, 0.5, 0.7).normalize();
      let lightColor = new THREE.Color(1, 1, 1);

      if (opts.starPosition && opts.position) {
        lightDir = new THREE.Vector3()
          .subVectors(opts.starPosition, opts.position)
          .normalize();
      } else if (opts.starPosition) {
        lightDir = new THREE.Vector3()
          .subVectors(opts.starPosition, new THREE.Vector3(0, 0, 0))
          .normalize();
      }

      if (opts.starLightColor) {
        lightColor = opts.starLightColor;
      }

      // ★ Один раз генерируем текстуру 512x512
      const elevTex = makePlanetTexture(params);

      const mesh = makePlanetMesh(params, lightDir, lightColor, elevTex);
      const atmosphere = makeAtmosphere(params, lightDir);
      if (atmosphere) mesh.add(atmosphere);

      const rings = makeRings(params, lightDir);
      if (rings) mesh.add(rings);

      const update = (dt) => {
        mesh.rotation.y += params.spinSpeed * dt;
      };

      const getDangerLevel = (playerPosition) => {
        if (!playerPosition) return 0;
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);

        const dist = playerPosition.distanceTo(worldPos);
        const r = params.radius;
        const outer = r * params.dangerRangeFactor;

        if (dist <= r) return 1.0;
        if (dist >= outer) return 0.0;

        const t = (dist - r) / (outer - r);
        const s = t * t * (3 - 2 * t);
        return 1.0 - s;
      };

      return {
        mesh,
        atmosphere,
        rings,
        params,
        update,
        getDangerLevel,
        elevTex, // ★ чтобы можно было dispose-нуть
      };
    },

    dispose(handle) {
      if (!handle) return;
      const objs = [handle.mesh, handle.atmosphere, handle.rings];
      for (const obj of objs) {
        if (!obj) continue;
        obj.geometry?.dispose?.();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
        else obj.material?.dispose?.();
      }
      handle.elevTex?.dispose?.();
    },
  };
})();