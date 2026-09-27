// planet.js — генератор уникальной планеты для Elite-подобной игры
// Зависимости: THREE должен быть доступен глобально (window.THREE).
//
// Публичное API:
//   PLANET.generate(star, opts) -> {
//     mesh,         // THREE.Mesh — планета
//     atmosphere,   // THREE.Mesh — атмосфера (additive)
//     rings,        // THREE.Mesh | null — кольца
//     params,       // все вычисленные параметры
//     update(dt, time)
//   }
//   PLANET.getParams(star) -> params
//   PLANET.dispose(handle)

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

  // --- Параметры планеты из статов звезды ---
  function computeParams(star) {
    if (!star) throw new Error("PLANET.computeParams: star is required");

    // Сид: id звезды + хэш имени + tech + economy
    const seed =
      ((star.id | 0) * 2246822519) ^
      strHash((star.name || "") + "|" + (star.economy || ""));

    const rng = mulberry32(seed >>> 0);

    const tech = Math.max(1, Math.min(15, star.tech | 0));
    const danger = typeof star.danger === "number" ? star.danger : 0;
    const baseHue = typeof star.hue === "number" ? star.hue : (star.id * 0.137) % 1;

    // Класс планеты зависит от экономики и tech:
    //   Industrial / Mining      -> скалистая, тёмная
    //   Agricultural             -> зелёная
    //   Refinery                 -> коричнево-оранжевая
    //   High-Tech                -> голубая, «окультуренная»
    //   Tourism                  -> яркая, пёстрая
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

    // Радиус планеты: чем больше населения — тем крупнее (но в разумных пределах)
    const pop = Math.max(0, star.population || 0);
    const popFactor = Math.min(1, Math.log10(pop + 1) / 10);
    const radius = 180 + popFactor * 120 + rng() * 60;

    // Палитра — три цвета поверхности
    let hueA, hueB, hueC;
    if (klass === "green") {
      hueA = 0.30 + rng() * 0.05;
      hueB = 0.25 + rng() * 0.05;
      hueC = 0.55 + rng() * 0.05;
    } else if (klass === "blue") {
      hueA = 0.55 + rng() * 0.05;
      hueB = 0.60 + rng() * 0.05;
      hueC = 0.15 + rng() * 0.05; // континенты
    } else if (klass === "brown") {
      hueA = 0.08 + rng() * 0.05;
      hueB = 0.05 + rng() * 0.05;
      hueC = 0.12 + rng() * 0.05;
    } else if (klass === "vivid") {
      hueA = rng();
      hueB = (hueA + 0.3 + rng() * 0.2) % 1;
      hueC = (hueA + 0.6) % 1;
    } else if (klass === "rocky-dark") {
      hueA = 0.08 + rng() * 0.05;
      hueB = 0.06 + rng() * 0.03;
      hueC = 0.02 + rng() * 0.03;
    } else {
      // rocky
      hueA = 0.07 + rng() * 0.05;
      hueB = 0.05 + rng() * 0.05;
      hueC = 0.55 + rng() * 0.05;
    }

    const colorA = new THREE.Color().setHSL(hueA, 0.5 + rng() * 0.4, 0.20 + rng() * 0.15);
    const colorB = new THREE.Color().setHSL(hueB, 0.55 + rng() * 0.3, 0.35 + rng() * 0.2);
    const colorC = new THREE.Color().setHSL(hueC, 0.6 + rng() * 0.3, 0.55 + rng() * 0.2);

    // Атмосфера: чем выше tech, тем плотнее и голубее
    const hasAtmosphere = klass !== "rocky-dark" && rng() > 0.25;
    const atmoHue = klass === "green" ? 0.55 : klass === "blue" ? 0.58 : 0.55 + rng() * 0.1;
    const atmosphereColor = new THREE.Color().setHSL(atmoHue, 0.7, 0.6);
    const atmosphereScale = 1.06 + rng() * 0.06;
    const atmosphereOpacity = hasAtmosphere ? 0.25 + tech * 0.02 : 0;

    // Кольца: редки, зависят от размера и rng
    const hasRings = rng() > 0.78 && radius > 200;
    const ringInner = radius * 1.6 + rng() * 20;
    const ringOuter = ringInner + 40 + rng() * 80;
    const ringColor = new THREE.Color().setHSL(hueA, 0.4, 0.6);
    const ringTilt = (rng() - 0.5) * 0.6;

    // Вращение
    const spinSpeed = 0.02 + rng() * 0.06;

    // Шум-сид для шейдера
    const noiseSeed = (seed >>> 0) % 10000;

    return {
      seed,
      klass,
      radius,
      colorA,
      colorB,
      colorC,
      hasAtmosphere,
      atmosphereColor,
      atmosphereScale,
      atmosphereOpacity,
      hasRings,
      ringInner,
      ringOuter,
      ringColor,
      ringTilt,
      spinSpeed,
      noiseSeed,
    };
  }

  // --- Шейдер поверхности (взят из html, но параметризован) ---
  const planetVert = /* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    void main() {
      vPos = position;
      vNormal = normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const planetFrag = /* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    uniform vec3  uColorA, uColorB, uColorC;
    uniform float uSeed;

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 x) {
      vec3 i = floor(x), f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                     mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                     mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    float fbm(vec3 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
      return v;
    }
    void main() {
      vec3 n = normalize(vPos + uSeed);
      float n1 = fbm(n * 3.0);
      float n2 = fbm(n * 6.0 + 10.0);
      float m = smoothstep(0.35, 0.65, n1 + n2 * 0.3);
      vec3 col = mix(uColorA, uColorB, m);
      col = mix(col, uColorC, smoothstep(0.7, 0.95, n2));
      vec3 L = normalize(vec3(1.0, 0.5, 0.7));
      float d = max(dot(normalize(vNormal), L), 0.0);
      gl_FragColor = vec4(col * (0.15 + 0.85 * d), 1.0);
    }
  `;

  function makePlanetMesh(params) {
    const geo = new THREE.SphereGeometry(params.radius, 64, 64);
    const mat = new THREE.ShaderMaterial({
      vertexShader: planetVert,
      fragmentShader: planetFrag,
      uniforms: {
        uColorA: { value: params.colorA.clone() },
        uColorB: { value: params.colorB.clone() },
        uColorC: { value: params.colorC.clone() },
        uSeed: { value: params.noiseSeed },
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.radius = params.radius;
    mesh.userData.klass = params.klass;
    return mesh;
  }

  function makeAtmosphere(params) {
    if (!params.hasAtmosphere || params.atmosphereOpacity <= 0) return null;
    const geo = new THREE.SphereGeometry(
      params.radius * params.atmosphereScale,
      48,
      48,
    );
    const mat = new THREE.MeshBasicMaterial({
      color: params.atmosphereColor,
      transparent: true,
      opacity: params.atmosphereOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isAtmosphere = true;
    return mesh;
  }

  function makeRings(params) {
    if (!params.hasRings) return null;
    const geo = new THREE.RingGeometry(
      params.ringInner,
      params.ringOuter,
      96,
    );
    const mat = new THREE.MeshBasicMaterial({
      color: params.ringColor,
      transparent: true,
      opacity: 0.55,
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
      const mesh = makePlanetMesh(params);
      const atmosphere = makeAtmosphere(params);
      if (atmosphere) mesh.add(atmosphere);
      const rings = makeRings(params);
      if (rings) mesh.add(rings);

      const update = (dt) => {
        mesh.rotation.y += params.spinSpeed * dt;
      };

      return { mesh, atmosphere, rings, params, update };
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

//export default PLANET;