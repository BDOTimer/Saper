// planet.js — генератор уникальной планеты с процедурными биомами и атмосферой
// Зависимости: THREE должен быть доступен глобально (window.THREE).

const PLANET = (() => {
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

  // --- Параметры планеты ---
  function computeParams(star) {
    if (!star) throw new Error("PLANET.computeParams: star is required");

    const seed = ((star.id | 0) * 2246822519) ^ strHash((star.name || "") + "|" + (star.economy || ""));
    const rng = mulberry32(seed >>> 0);

    const tech = Math.max(1, Math.min(15, star.tech | 0));
    const danger = typeof star.danger === "number" ? star.danger : 0;

    let klass;
    switch (star.economy) {
      case "Industrial": klass = "rocky-dark"; break;
      case "Mining": klass = "rocky"; break;
      case "Agricultural": klass = "green"; break;
      case "Refinery": klass = "brown"; break;
      case "High-Tech": klass = "blue"; break;
      case "Tourism": klass = "vivid"; break;
      default: klass = "rocky";
    }

    const pop = Math.max(0, star.population || 0);
    const popFactor = Math.min(1, Math.log10(pop + 1) / 10);
    const radius = 180 + popFactor * 120 + rng() * 60;

    // --- Генерация палитры (Вода, Суша, Горы/Высоты) ---
    let colorWater, colorLand, colorHigh;
    
    if (klass === "green") {
      colorWater = new THREE.Color().setHSL(0.6 + rng()*0.05, 0.7, 0.2 + rng()*0.1);
      colorLand = new THREE.Color().setHSL(0.25 + rng()*0.1, 0.6 + rng()*0.2, 0.3 + rng()*0.15);
      colorHigh = new THREE.Color().setHSL(0.1 + rng()*0.05, 0.4, 0.4 + rng()*0.1);
    } else if (klass === "blue") {
      colorWater = new THREE.Color().setHSL(0.6 + rng()*0.05, 0.8, 0.15 + rng()*0.1);
      colorLand = new THREE.Color().setHSL(0.55 + rng()*0.05, 0.6, 0.4 + rng()*0.15);
      colorHigh = new THREE.Color().setHSL(0.0, 0.0, 0.8 + rng()*0.15);
    } else if (klass === "brown") {
      colorWater = new THREE.Color().setHSL(0.05 + rng()*0.05, 0.6, 0.15 + rng()*0.1);
      colorLand = new THREE.Color().setHSL(0.08 + rng()*0.05, 0.7, 0.3 + rng()*0.15);
      colorHigh = new THREE.Color().setHSL(0.12 + rng()*0.05, 0.5, 0.5 + rng()*0.15);
    } else if (klass === "vivid") {
      let h = rng();
      colorWater = new THREE.Color().setHSL(h, 0.8, 0.2 + rng()*0.1);
      colorLand = new THREE.Color().setHSL((h + 0.33) % 1, 0.8, 0.4 + rng()*0.15);
      colorHigh = new THREE.Color().setHSL((h + 0.66) % 1, 0.8, 0.6 + rng()*0.15);
    } else if (klass === "rocky-dark") {
      colorWater = new THREE.Color().setHSL(0.0, 0.8, 0.1 + rng()*0.05);
      colorLand = new THREE.Color().setHSL(0.05 + rng()*0.05, 0.3, 0.15 + rng()*0.1);
      colorHigh = new THREE.Color().setHSL(0.08 + rng()*0.05, 0.4, 0.3 + rng()*0.1);
    } else {
      colorWater = new THREE.Color().setHSL(0.6 + rng()*0.1, 0.3, 0.15 + rng()*0.1);
      colorLand = new THREE.Color().setHSL(0.08 + rng()*0.05, 0.2, 0.3 + rng()*0.15);
      colorHigh = new THREE.Color().setHSL(0.1 + rng()*0.05, 0.1, 0.5 + rng()*0.15);
    }

    // Атмосфера
    const hasAtmosphere = klass !== "rocky-dark" && rng() > 0.25;
    const atmoHue = klass === "green" ? 0.55 : klass === "blue" ? 0.58 : 0.55 + rng() * 0.1;
    const atmosphereColor = new THREE.Color().setHSL(atmoHue, 0.7, 0.6);
    const atmosphereScale = 1.04 + rng() * 0.04;
    const atmosphereIntensity = hasAtmosphere ? 0.4 + tech * 0.03 : 0;

    // Кольца
    const hasRings = rng() > 0.78 && radius > 200;
    const ringInner = radius * 1.6 + rng() * 20;
    const ringOuter = ringInner + 40 + rng() * 80;
    const ringColor = new THREE.Color().setHSL(colorLand.getHSL({h:0,s:0,l:0}).h, 0.4, 0.6);
    const ringTilt = (rng() - 0.5) * 0.6;

    const spinSpeed = 0.02 + rng() * 0.06;
    const dangerRangeFactor = 2 + rng() * 2;
    const noiseSeed = (seed >>> 0) % 10000;

    return {
      seed, klass, radius,
      colorWater, colorLand, colorHigh,
      hasAtmosphere, atmosphereColor, atmosphereScale, atmosphereIntensity,
      hasRings, ringInner, ringOuter, ringColor, ringTilt,
      spinSpeed, noiseSeed, dangerRangeFactor,
    };
  }

  // ==========================================
  // --- ШЕЙДЕРЫ ПЛАНЕТЫ ---
  // ==========================================

  const planetVert = /* glsl */ `
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec3 vLocalPos;

    void main() {
      vLocalPos = position; // Локальные координаты для "приклеенной" текстуры
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
    varying vec3 vLocalPos;
    
    uniform vec3  uColorWater;
    uniform vec3  uColorLand;
    uniform vec3  uColorHigh;
    uniform vec3  uAtmosphereColor;
    uniform float uAtmosphereIntensity;
    uniform float uSeed;
    uniform vec3  uLightDir;
    uniform vec3  uLightColor;

    // --- Simplex 3D Noise ---
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

    float fbm(vec3 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 6; i++) {
        v += a * snoise(p);
        p *= 2.0; a *= 0.5;
      }
      return v;
    }

    // Domain Warping для создания реалистичных континентов и облаков
    float warpedNoise(vec3 p) {
      vec3 q = vec3(
        fbm(p + vec3(0.0, 0.0, 0.0)),
        fbm(p + vec3(5.2, 1.3, 2.8)),
        fbm(p + vec3(0.0, 0.0, 0.0))
      );
      vec3 r = vec3(
        fbm(p + 4.0*q + vec3(1.7, 9.2, 3.4)),
        fbm(p + 4.0*q + vec3(8.3, 2.8, 7.1)),
        0.0
      );
      return fbm(p + 4.0*r);
    }

    void main() {
      vec3 p = normalize(vLocalPos); // Сферические координаты
      
      // 1. Генерация высоты (Domain Warping + детализация)
      float elev = warpedNoise(p * 2.0 + uSeed * 0.01) * 0.5 + 0.5;
      float detail = snoise(p * 15.0 + uSeed * 0.1) * 0.1;
      elev += detail;
      elev = clamp(elev, 0.0, 1.0);
      
      float lat = abs(p.y); // Широта для полярных шапок
      
      // 2. Выбор биома
      vec3 color;
      float waterLevel = 0.42;
      float beachLevel = waterLevel + 0.05;
      float mountainLevel = 0.75;
      
      if (elev < waterLevel) {
        float depth = smoothstep(0.1, waterLevel, elev);
        color = mix(uColorWater * 0.3, uColorWater, depth);
        color += vec3(0.05) * snoise(p * 30.0); // Рябь на воде
      } else if (elev < beachLevel) {
        float t = (elev - waterLevel) / (beachLevel - waterLevel);
        color = mix(uColorWater * 1.2, uColorLand, t);
      } else if (elev < mountainLevel) {
        float t = (elev - beachLevel) / (mountainLevel - beachLevel);
        color = mix(uColorLand, uColorHigh * 0.8, t);
      } else {
        float t = (elev - mountainLevel) / (1.0 - mountainLevel);
        color = mix(uColorHigh, vec3(0.9, 0.95, 1.0), t * 0.5); // Снежные вершины
      }
      
      // Полярные шапки
      float iceCap = smoothstep(0.7, 0.95, lat + elev * 0.3);
      color = mix(color, vec3(0.95, 0.98, 1.0), iceCap);
      
      // 3. Освещение (PBR-lite)
      vec3 N = normalize(vWorldNormal);
      vec3 L = normalize(uLightDir);
      vec3 V = normalize(cameraPosition - vWorldPos);
      
      float NdotL = dot(N, L);
      float diff = smoothstep(-0.1, 0.3, NdotL); // Мягкий терминатор
      
      // Specular (блик на воде)
      float spec = 0.0;
      if (elev < waterLevel) {
        vec3 H = normalize(L + V);
        spec = pow(max(dot(N, H), 0.0), 64.0) * 0.8;
      }
      
      // Rim Light (атмосферное свечение)
      float rim = 1.0 - max(dot(N, V), 0.0);
      rim = pow(rim, 3.0) * uAtmosphereIntensity;
      
      // Сборка цвета
      vec3 dayColor = color * (0.08 + diff * uLightColor) + spec * uLightColor;
      vec3 nightColor = vec3(0.01, 0.02, 0.05);
      
      float dayNightMix = smoothstep(-0.2, 0.1, NdotL);
      vec3 finalColor = mix(nightColor, dayColor, dayNightMix);
      
      // Атмосферное рассеяние на краях
      vec3 rimColor = uAtmosphereColor * rim * (0.5 + 0.5 * smoothstep(-0.2, 0.5, NdotL));
      finalColor += rimColor;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  // ==========================================
  // --- ШЕЙДЕРЫ АТМОСФЕРЫ ---
  // ==========================================
  
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
      
      // Ярче со стороны звезды
      float sunAlignment = max(dot(N, L), 0.0);
      float sunScatter = pow(sunAlignment, 2.0) * 0.5 + 0.5;
      
      float alpha = rim * uIntensity * sunScatter;
      vec3 color = uAtmosphereColor * alpha * 1.5;
      
      gl_FragColor = vec4(color, alpha * 0.8);
    }
  `;

  // ==========================================
  // --- ШЕЙДЕРЫ КОЛЕЦ ---
  // ==========================================

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
      f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                 mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
    }

    void main() {
      float r = vUv.x; // 0 = inner, 1 = outer
      
      // Процедурные полосы и щели в кольцах
      float bands = noise(vec2(r * 50.0, uSeed)) * 0.5 + 0.5;
      float gaps = smoothstep(0.3, 0.35, noise(vec2(r * 20.0, uSeed * 0.5)));
      float alpha = bands * gaps;
      
      // Плавное затухание к краям
      alpha *= smoothstep(0.0, 0.1, r) * smoothstep(1.0, 0.9, r);
      
      // Освещение колец
      vec3 N = normalize(vWorldNormal);
      vec3 L = normalize(uLightDir);
      float diff = max(dot(N, L), 0.0) * 0.8 + 0.2;
      
      vec3 color = uRingColor * diff;
      gl_FragColor = vec4(color, alpha * 0.7);
    }
  `;

  // ==========================================
  // --- СОЗДАНИЕ МЕШЕЙ ---
  // ==========================================

  function makePlanetMesh(params, lightDir, lightColor) {
    const geo = new THREE.SphereGeometry(params.radius, 64, 64);
    const mat = new THREE.ShaderMaterial({
      vertexShader: planetVert,
      fragmentShader: planetFrag,
      uniforms: {
        uColorWater: { value: params.colorWater },
        uColorLand: { value: params.colorLand },
        uColorHigh: { value: params.colorHigh },
        uAtmosphereColor: { value: params.atmosphereColor },
        uAtmosphereIntensity: { value: params.atmosphereIntensity },
        uSeed: { value: params.noiseSeed * 0.01 },
        uLightDir: { value: lightDir },
        uLightColor: { value: lightColor },
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.radius = params.radius;
    mesh.userData.klass = params.klass;
    return mesh;
  }

  function makeAtmosphere(params, lightDir) {
    if (!params.hasAtmosphere || params.atmosphereIntensity <= 0) return null;
    const geo = new THREE.SphereGeometry(params.radius * params.atmosphereScale, 48, 48);
    const mat = new THREE.ShaderMaterial({
      vertexShader: atmosVert,
      fragmentShader: atmosFrag,
      uniforms: {
        uAtmosphereColor: { value: params.atmosphereColor },
        uLightDir: { value: lightDir },
        uIntensity: { value: params.atmosphereIntensity },
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
    const geo = new THREE.RingGeometry(params.ringInner, params.ringOuter, 128, 4);
    
    // Кастомные UV для колец, чтобы vUv.x шел от 0 до 1 по радиусу
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const v3 = new THREE.Vector3();
    for(let i=0; i<pos.count; i++){
      v3.fromBufferAttribute(pos, i);
      const len = v3.length();
      uv.setXY(i, (len - params.ringInner) / (params.ringOuter - params.ringInner), 1);
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: ringVert,
      fragmentShader: ringFrag,
      uniforms: {
        uRingColor: { value: params.ringColor },
        uLightDir: { value: lightDir },
        uSeed: { value: params.noiseSeed * 0.01 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2 + params.ringTilt;
    return mesh;
  }

  // --- Публичное API ---
  return {
    getParams(star) {
      return computeParams(star);
    },

    generate(star, opts = {}) {
      const params = computeParams(star);
      
      // Вычисляем направление на звезду для освещения
      let lightDir = new THREE.Vector3(1, 0.5, 0.7).normalize();
      let lightColor = new THREE.Color(1, 1, 1);
      
      if (opts.starPosition && opts.position) {
        lightDir = new THREE.Vector3().subVectors(opts.starPosition, opts.position).normalize();
      } else if (opts.starPosition) {
        lightDir = new THREE.Vector3().subVectors(opts.starPosition, new THREE.Vector3(0,0,0)).normalize();
      }
      
      if (opts.starLightColor) {
        lightColor = opts.starLightColor;
      }

      const mesh = makePlanetMesh(params, lightDir, lightColor);
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

      return { mesh, atmosphere, rings, params, update, getDangerLevel };
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
    },
  };
})();