// star.js — генератор уникального светила для Elite-подобной игры
// Зависимости: THREE должен быть доступен глобально (window.THREE),
// либо этот скрипт вызывается ПОСЛЕ подключения three через importmap
// в модульном скрипте. См. пояснение в конце.
//
// Публичное API:
//   STAR.generate(star, opts) -> {
//     mesh,           // THREE.Mesh — само светило
//     corona,         // THREE.Mesh — сфера-корона (additive)
//     light,          // THREE.PointLight / DirectionalLight
//     params          // все вычисленные параметры (для HUD/логов)
//   }
//   STAR.getParams(star) -> params   // без создания мешей
//   STAR.dispose(handle)              // освободить ресурсы

const STAR = (() =>  {
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
  // star: { id, name, color, hue, tech, danger, dangerLabel, techLabel,
  //         economy, population, government, r, x, y, links }
  function computeParams(star) {
    if (!star) throw new Error("STAR.computeParams: star is required");

    // Детерминированный сид: id + хэш имени, чтобы имена тоже влияли
    const seed = ((star.id | 0) * 2654435761) ^ strHash(star.name || "");
    const rng = mulberry32(seed >>> 0);

    // hue уже есть в star (0..1). Если нет — вытащим из id
    const baseHue =
      typeof star.hue === "number" ? star.hue : (star.id * 0.137) % 1;

    // Класс светила зависит от hue и tech:
    //   hue < 0.15  -> красный карлик
    //   hue < 0.35  -> оранжевый/жёлтый
    //   hue < 0.65  -> жёлто-белый (как Солнце)
    //   hue < 0.85  -> бело-голубой
    //   иначе       -> голубой гигант
    let klass;
    if (baseHue < 0.15) klass = "red-dwarf";
    else if (baseHue < 0.35) klass = "orange";
    else if (baseHue < 0.65) klass = "yellow";
    else if (baseHue < 0.85) klass = "white-blue";
    else klass = "blue-giant";

    // tech и danger влияют на "активность" и размер короны
    const tech = Math.max(1, Math.min(15, star.tech | 0));
    const danger = typeof star.danger === "number" ? star.danger : 0;

    // Радиус светила (условные единицы; подбирается под сцену)
    const radiusBase = {
      "red-dwarf": 60,
      orange: 90,
      yellow: 120,
      "white-blue": 140,
      "blue-giant": 180,
    }[klass];

    const radius = radiusBase + rng() * 40;

    // Корона: чем выше danger, тем больше и ярче
    const coronaScale = 1.8 + danger * 2.2 + rng() * 0.4;
    const coronaIntensity = 0.6 + danger * 1.8;

    // Пульсация: у красных карликов чаще и заметнее
    const pulseSpeed =
      klass === "red-dwarf" ? 3.0 + rng() * 2.0 : 0.8 + rng() * 1.2;
    const pulseAmp =
      klass === "red-dwarf" ? 0.08 + rng() * 0.06 : 0.03 + rng() * 0.03;

    // Цвет ядра и короны — из hue, но подкрученный под класс
    const coreHue = baseHue;
    const coreSat =
      klass === "white-blue" || klass === "blue-giant" ? 0.9 : 0.8;
    const coreLum =
      klass === "blue-giant" ? 0.85 : klass === "red-dwarf" ? 0.55 : 0.7;

    const coronaHue = (coreHue + 0.03) % 1;
    const coronaSat = coreSat * 0.9;
    const coronaLum = Math.min(0.95, coreLum + 0.15);

    // Свет: температура от класса
    const lightColor = new THREE.Color().setHSL(coreHue, coreSat, coreLum);
    const lightIntensity = 1.2 + tech * 0.05 + danger * 0.5;
    const lightDistance = radius * 20;

    return {
      seed,
      klass,
      radius,
      baseHue,
      coreHue,
      coreSat,
      coreLum,
      coronaHue,
      coronaSat,
      coronaLum,
      coronaScale,
      coronaIntensity,
      pulseSpeed,
      pulseAmp,
      lightColor,
      lightIntensity,
      lightDistance,
    };
  }

  // --- Шейдер светила (простой, без внешних зависимостей) ---
  const starVert = /* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    void main() {
      vPos = position;
      vNormal = normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const starFrag = /* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    uniform vec3  uCoreColor;
    uniform vec3  uCoronaColor;
    uniform float uTime;
    uniform float uSeed;
    uniform float uPulseAmp;
    uniform float uPulseSpeed;
    uniform float uActivity;   // 0..1, из danger

    // Простой шум
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
      for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
      return v;
    }

    void main() {
      vec3 n = normalize(vPos + uSeed * 0.01);

      // Пульсация радиуса
      float pulse = 1.0 + sin(uTime * uPulseSpeed + uSeed) * uPulseAmp;

      // Грануляция поверхности + активность от danger
      float g1 = fbm(n * 4.0 + uTime * 0.15);
      float g2 = fbm(n * 9.0 - uTime * 0.25);
      float gran = mix(g1, g2, uActivity);

      // Френель по нормали — «кипящая» кромка
      float fres = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);

      // Ядро
      vec3 core = mix(uCoreColor, vec3(1.0), gran * 0.35 + fres * 0.25);
      core *= pulse;

      // Корона по краю
      vec3 col = mix(core, uCoronaColor, fres * 0.7);

      // «Кипение» — яркие всполохи при высокой активности
      float flare = smoothstep(0.75, 0.95, gran) * uActivity;
      col += uCoronaColor * flare * 0.8;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // --- Создание меша светила ---
  function makeMesh(params) {
    const geo = new THREE.SphereGeometry(params.radius, 48, 48);

    const coreColor = new THREE.Color().setHSL(
      params.coreHue,
      params.coreSat,
      params.coreLum,
    );
    const coronaColor = new THREE.Color().setHSL(
      params.coronaHue,
      params.coronaSat,
      params.coronaLum,
    );

    const mat = new THREE.ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      uniforms: {
        uCoreColor: { value: coreColor },
        uCoronaColor: { value: coronaColor },
        uTime: { value: 0 },
        uSeed: { value: params.seed % 1000 },
        uPulseAmp: { value: params.pulseAmp },
        uPulseSpeed: { value: params.pulseSpeed },
        uActivity: { value: Math.min(1, params.coronaIntensity / 2.5) },
      },
      toneMapped: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.params = params;
    return mesh;
  }

  // --- Создание короны (аддитивная сфера) ---
  function makeCorona(params) {
    const geo = new THREE.SphereGeometry(
      params.radius * params.coronaScale,
      32,
      32,
    );
    const col = new THREE.Color().setHSL(
      params.coronaHue,
      params.coronaSat,
      params.coronaLum,
    );
    const mat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.18 * params.coronaIntensity,
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
    // Вычислить параметры без создания мешей
    getParams(star) {
      return computeParams(star);
    },

    // Создать полный набор: светило + корона + свет
    generate(star, opts = {}) {
      const params = computeParams(star);
      const mesh = makeMesh(params);
      const corona = makeCorona(params);
      corona.position.copy(mesh.position);

      const light = new THREE.PointLight(
        params.lightColor,
        params.lightIntensity,
        params.lightDistance,
        2,
      );
      light.position.copy(mesh.position);

      // Немного данных для внешнего кода
      mesh.userData.klass = params.klass;

      // Анимация пульсации — вызывающий код должен дергать это в update(dt)
      const update = (dt, time) => {
        mesh.material.uniforms.uTime.value = time;
        const p =
          1 + Math.sin(time * params.pulseSpeed) * params.pulseAmp * 0.5;
        corona.scale.setScalar(p);
        light.intensity = params.lightIntensity * (0.9 + 0.1 * p);
      };

      // Уровень опасности от 0.0 до 1.0 в зависимости от расстояния
      // от игрока до центра Звезды.
      //   dist <= radius       -> 1.0
      //   dist >= radius * 2   -> 0.0
      //   между ними — линейная интерполяция.
      const getDangerLevel = (playerPosition) => {
        if (!playerPosition) return 0;

        const DangerRangeFactor = 2;

        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos); // ← заполняем реальной мировой позицией планеты

        const dx = playerPosition.x - worldPos.x;
        const dy = playerPosition.y - worldPos.y;
        const dz = playerPosition.z - worldPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const r = params.radius;
        const outer = r * DangerRangeFactor;

        if (dist <= r) return 1.0;
        if (dist >= outer) return 0.0;

        // 1.0 у поверхности -> 0.0 на границе зоны
        //return 1.0 - (dist - r) / (outer - r);

        const t = (dist - r) / (outer - r); // 0..1
        const s = t * t * (3 - 2 * t); // smoothstep
        return 1.0 - s;
      };

      return { mesh, corona, light, params, update, getDangerLevel };
    },

    // Освободить ресурсы
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

//export default STAR;
