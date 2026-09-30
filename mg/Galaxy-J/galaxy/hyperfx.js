// hyperfx.js — визуальные эффекты гиперпрыжка для Elite-подобной игры
// Тоннель, streaks, вспышка, тряска камеры, усиление bloom.
//
// Подключение:
//   <script src="./galaxy/hyperfx.js"></script>  (после three и до основного модуля)
//
// Публичное API (window.HYPERFX):
//   attach({ THREE, scene, camera, bloom })  — один раз после создания сцены
//   start(duration)                          — запустить эффект
//   stop()                                   — остановить
//   update(dt, time)                         — каждый кадр
//   triggerFlash(power)                      — ручная вспышка (0..1)
//   triggerShake(power)                      — ручная тряска (0..1)
//   isActive                                 — идёт ли прыжок
//
// Зависимости: THREE через window.THREE (устанавливается в основном модуле),
// DOM — создаёт сам (элемент #hyper-flash).

const HYPERFX = (() => {
  let THREE = null;
  let scene = null;
  let camera = null;
  let bloom = null;

  // --- DOM ---
  let flashEl = null;
  let flashLevel = 0;

  // --- Тряска ---
  let shakeLevel = 0;

  // --- Тоннель ---
  let group = null;
  let tunnelMesh = null;
  let tunnelMat = null;

  // --- Streaks ---
  let streakLines = null;
  let streakMat = null;
  let streakGeo = null;
  let streakArr = null;
  let streakMeta = [];

  const STREAK_COUNT = 900;
  const STREAK_LEN = 60;
  const STREAK_RADIUS = 800;

  // --- Состояние ---
  let active = false;
  let elapsed = 0;
  let duration = 2.2;

  // ------------------------------------------------------------------
  //  Шейдеры тоннеля
  // ------------------------------------------------------------------
  const tunnelVert = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vPos;
    void main() {
      vUv = uv;
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const tunnelFrag = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vPos;
    uniform float uTime;
    uniform float uSpeed;
    uniform vec3  uColorA;
    uniform vec3  uColorB;
    uniform float uIntensity;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
      return v;
    }

    void main() {
      // vUv.y — вдоль тоннеля, летит со временем
      float t = vUv.y * 6.0 - uTime * uSpeed;
      float n = fbm(vec2(vUv.x * 8.0, t));

      // Продольные полосы
      float stripes = smoothstep(
        0.45, 0.55,
        abs(fract(vUv.y * 12.0 - uTime * uSpeed) - 0.5)
      );

      // Кольца
      float rings = smoothstep(
        0.0, 1.0,
        abs(sin(vUv.y * 40.0 - uTime * uSpeed * 2.0))
      );

      // Радиальный градиент: у краёв ярче, в центре прозрачно
      float radial = pow(abs(vUv.x - 0.5) * 2.0, 1.5);

      vec3 col = mix(uColorA, uColorB, n * 0.7 + stripes * 0.3);
      col += vec3(1.0) * rings * 0.15;

      float alpha = radial * (0.35 + n * 0.4 + stripes * 0.3) * uIntensity;

      gl_FragColor = vec4(col, alpha);
    }
  `;

  // ------------------------------------------------------------------
  //  DOM: элемент вспышки
  // ------------------------------------------------------------------
  function ensureFlashEl() {
    if (flashEl) return;
    flashEl = document.createElement("div");
    flashEl.id = "hyper-flash";
    flashEl.style.cssText = `
      position: fixed; inset: 0; pointer-events: none;
      background: radial-gradient(
        ellipse at center,
        rgba(180,255,220,0.95),
        rgba(0,255,136,0.6) 40%,
        transparent 70%
      );
      opacity: 0; z-index: 60;
      mix-blend-mode: screen;
      transition: opacity 0.05s linear;
    `;
    document.body.appendChild(flashEl);
  }

  // ------------------------------------------------------------------
  //  Сборка тоннеля и streaks
  // ------------------------------------------------------------------
  function buildTunnel() {
    if (group) return;

    group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    // --- Тоннель: цилиндр, смотрим изнутри ---
    const geo = new THREE.CylinderGeometry(300, 300, 4000, 64, 1, true);
    geo.rotateX(Math.PI / 2); // вытянуть вдоль -Z

    tunnelMat = new THREE.ShaderMaterial({
      vertexShader: tunnelVert,
      fragmentShader: tunnelFrag,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 1.0 },
        uColorA: { value: new THREE.Color(0x00ff88) },
        uColorB: { value: new THREE.Color(0x22aaff) },
        uIntensity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    tunnelMesh = new THREE.Mesh(geo, tunnelMat);
    group.add(tunnelMesh);

    // --- Streaks: линии, летящие от центра ---
    const pos = new Float32Array(STREAK_COUNT * 2 * 3);
    streakMeta = [];

    for (let i = 0; i < STREAK_COUNT; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 80 + Math.random() * STREAK_RADIUS;
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      const z = -Math.random() * 3000;
      const len = STREAK_LEN + Math.random() * 120;
      streakMeta.push({ x, y, z, len });

      const ix = i * 6;
      pos[ix + 0] = x;
      pos[ix + 1] = y;
      pos[ix + 2] = z;
      pos[ix + 3] = x;
      pos[ix + 4] = y;
      pos[ix + 5] = z - len;
    }

    streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

    streakMat = new THREE.LineBasicMaterial({
      color: 0xb6ffd2,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    streakLines = new THREE.LineSegments(streakGeo, streakMat);
    group.add(streakLines);

    streakArr = streakGeo.attributes.position.array;
  }

  function resetStreaks() {
    for (let i = 0; i < STREAK_COUNT; i++) {
      const m = streakMeta[i];
      const ang = Math.random() * Math.PI * 2;
      const r = 80 + Math.random() * STREAK_RADIUS;
      m.x = Math.cos(ang) * r;
      m.y = Math.sin(ang) * r;
      m.z = -Math.random() * 3000;
      m.len = STREAK_LEN + Math.random() * 120;
    }
  }

  // ------------------------------------------------------------------
  //  Вспышка и тряска
  // ------------------------------------------------------------------
  function triggerFlash(power) {
    flashLevel = Math.min(1, power);
    if (flashEl) flashEl.style.opacity = String(flashLevel);
  }

  function triggerShake(power) {
    shakeLevel = Math.max(shakeLevel, power);
  }

  // ------------------------------------------------------------------
  //  Публичные методы
  // ------------------------------------------------------------------
  function attach(opts) {
    THREE = opts.THREE;
    scene = opts.scene;
    camera = opts.camera;
    bloom = opts.bloom || null;

    if (!THREE || !scene || !camera) {
      console.warn("HYPERFX.attach: THREE, scene, camera обязательны");
      return;
    }

    ensureFlashEl();
    buildTunnel();
  }

  function start(dur) {
    if (!group) {
      console.warn("HYPERFX.start: сначала вызови attach()");
      return;
    }
    active = true;
    elapsed = 0;
    duration = dur || 2.2;

    group.visible = true;
    tunnelMat.uniforms.uIntensity.value = 0;
    tunnelMat.uniforms.uSpeed.value = 0.5;
    streakMat.opacity = 0;

    resetStreaks();
    triggerFlash(1.0);
    triggerShake(1.0);
    if (bloom) bloom.strength = 1.6;
  }

  function stop() {
    if (!group) return;
    active = false;
    group.visible = false;
    if (bloom) bloom.strength = 0.9;

    triggerFlash(0.8);
    triggerShake(0.6);
  }

  function update(dt, time) {
    // Вспышка гаснет всегда
    if (flashLevel > 0) {
      flashLevel = Math.max(0, flashLevel - dt * 2.5);
      if (flashEl) flashEl.style.opacity = String(flashLevel);
    }

    // Тряска камеры
    if (shakeLevel > 0 && camera) {
      shakeLevel = Math.max(0, shakeLevel - dt * 3.0);
      const amp = shakeLevel * 0.02;
      camera.rotation.x += (Math.random() - 0.5) * amp;
      camera.rotation.y += (Math.random() - 0.5) * amp;
      camera.rotation.z += (Math.random() - 0.5) * amp;
    }

    if (!active || !group) return;

    elapsed += dt;
    const k = Math.min(1, elapsed / duration);

    // Кривая интенсивности: разгон → плато → спад
    let intensity;
    if (k < 0.15) intensity = k / 0.15;
    else if (k < 0.85) intensity = 1;
    else intensity = (1 - k) / 0.15;
    intensity = Math.max(0, Math.min(1, intensity));

    // Тоннель
    tunnelMat.uniforms.uTime.value = time;
    tunnelMat.uniforms.uSpeed.value = 2.0 + 6.0 * intensity;
    tunnelMat.uniforms.uIntensity.value = intensity;

    // Streaks
    const speed = 1500 + 3500 * intensity;
    const dz = speed * dt;

    for (let i = 0; i < STREAK_COUNT; i++) {
      const m = streakMeta[i];
      m.z -= dz;
      if (m.z < -3500) {
        const ang = Math.random() * Math.PI * 2;
        const r = 80 + Math.random() * STREAK_RADIUS;
        m.x = Math.cos(ang) * r;
        m.y = Math.sin(ang) * r;
        m.z = -Math.random() * 300;
      }
      const ix = i * 6;
      streakArr[ix + 0] = m.x;
      streakArr[ix + 1] = m.y;
      streakArr[ix + 2] = m.z;
      streakArr[ix + 3] = m.x;
      streakArr[ix + 4] = m.y;
      streakArr[ix + 5] = m.z - m.len * (0.5 + intensity * 2.5);
    }
    streakGeo.attributes.position.needsUpdate = true;
    streakMat.opacity = intensity * 0.9;
  }

  return {
    attach,
    start,
    stop,
    update,
    triggerFlash,
    triggerShake,
    get isActive() { return active; },
  };
})();

//export default HYPERFX;