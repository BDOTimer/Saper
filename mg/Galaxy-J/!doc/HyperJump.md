// ------------------------------------------------------------------
//  Гипертоннель — звёздный тоннель + streaks + вспышка
// ------------------------------------------------------------------
const TUNNEL = (() => {
  const GROUP = new THREE.Group();
  GROUP.visible = false;
  scene.add(GROUP);

  // --- 1. Цилиндр-тоннель ---
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

    // Хэш-шум
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
      // uUv.y — вдоль тоннеля, летит со временем
      float t = vUv.y * 6.0 - uTime * uSpeed;
      float n = fbm(vec2(vUv.x * 8.0, t));

      // Полосы вдоль тоннеля
      float stripes = smoothstep(0.45, 0.55, abs(fract(vUv.y * 12.0 - uTime * uSpeed) - 0.5));

      // Кольца
      float rings = smoothstep(0.0, 1.0, abs(sin(vUv.y * 40.0 - uTime * uSpeed * 2.0)));

      // Радиальный градиент: у краёв ярче, в центре прозрачно
      float radial = pow(abs(vUv.x - 0.5) * 2.0, 1.5);

      vec3 col = mix(uColorA, uColorB, n * 0.7 + stripes * 0.3);
      col += vec3(1.0) * rings * 0.15;

      float alpha = radial * (0.35 + n * 0.4 + stripes * 0.3) * uIntensity;

      gl_FragColor = vec4(col, alpha);
    }
  `;

  const tunnelGeo = new THREE.CylinderGeometry(
    300, 300, 4000, 64, 1, true,
  );
  // Открываем с обоих концов, поворачиваем вдоль -Z
  tunnelGeo.rotateX(Math.PI / 2);

  const tunnelMat = new THREE.ShaderMaterial({
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
    side: THREE.BackSide,   // смотрим изнутри
    blending: THREE.AdditiveBlending,
  });
  const tunnelMesh = new THREE.Mesh(tunnelGeo, tunnelMat);
  GROUP.add(tunnelMesh);

  // --- 2. Streaks: линии, летящие от центра ---
  const STREAK_COUNT = 900;
  const STREAK_LEN = 60;
  const STREAK_RADIUS = 800;

  const streakPositions = new Float32Array(STREAK_COUNT * 2 * 3);
  const streakMeta = [];   // {x, y, z, len}

  for (let i = 0; i < STREAK_COUNT; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = 80 + Math.random() * STREAK_RADIUS;
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r;
    const z = -Math.random() * 3000;   // от 0 до -3000
    const len = STREAK_LEN + Math.random() * 120;
    streakMeta.push({ x, y, z, len });

    const ix = i * 6;
    streakPositions[ix + 0] = x;
    streakPositions[ix + 1] = y;
    streakPositions[ix + 2] = z;
    streakPositions[ix + 3] = x;
    streakPositions[ix + 4] = y;
    streakPositions[ix + 5] = z - len;
  }

  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(streakPositions, 3),
  );
  const streakMat = new THREE.LineBasicMaterial({
    color: 0xb6ffd2,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const streakLines = new THREE.LineSegments(streakGeo, streakMat);
  GROUP.add(streakLines);

  // --- 3. Управление ---
  let active = false;
  let t = 0;
  let duration = 2.2;

  function start(dur) {
    active = true;
    t = 0;
    duration = dur;
    GROUP.visible = true;
    tunnelMat.uniforms.uIntensity.value = 0;
    tunnelMat.uniforms.uSpeed.value = 0.5;
    streakMat.opacity = 0;
    // Ресетим streak-позиции
    resetStreaks();
  }

  function stop() {
    active = false;
    GROUP.visible = false;
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

  const _pos = streakGeo.attributes.position;
  const _arr = _pos.array;

  function update(dt, time) {
    if (!active) return;
    t += dt;
    const k = Math.min(1, t / duration);

    // Кривая интенсивности: разгон → плато → спад
    // 0..0.15 — разгон, 0.15..0.85 — плато, 0.85..1 — спад
    let intensity;
    if (k < 0.15) intensity = k / 0.15;
    else if (k < 0.85) intensity = 1;
    else intensity = (1 - k) / 0.15;
    intensity = Math.max(0, Math.min(1, intensity));

    // Тоннель
    tunnelMat.uniforms.uTime.value = time;
    tunnelMat.uniforms.uSpeed.value = 2.0 + 6.0 * intensity;
    tunnelMat.uniforms.uIntensity.value = intensity;

    // Streaks: летят от камеры в -Z
    const speed = 1500 + 3500 * intensity;
    const dz = speed * dt;

    for (let i = 0; i < STREAK_COUNT; i++) {
      const m = streakMeta[i];
      m.z -= dz;
      if (m.z < -3500) {
        // Перезапускаем ближе к камере
        const ang = Math.random() * Math.PI * 2;
        const r = 80 + Math.random() * STREAK_RADIUS;
        m.x = Math.cos(ang) * r;
        m.y = Math.sin(ang) * r;
        m.z = -Math.random() * 300;
      }
      const ix = i * 6;
      // Передний конец
      _arr[ix + 0] = m.x;
      _arr[ix + 1] = m.y;
      _arr[ix + 2] = m.z;
      // Задний конец — вытягиваем по скорости
      _arr[ix + 3] = m.x;
      _arr[ix + 4] = m.y;
      _arr[ix + 5] = m.z - m.len * (0.5 + intensity * 2.5);
    }
    _pos.needsUpdate = true;
    streakMat.opacity = intensity * 0.9;
  }

  return {
    group: GROUP,
    start: start,
    stop: stop,
    update: update,
    get isActive() { return active; },
  };
})();

////////////////////////////////////////////////////////////////////////////////

Вынос анимации Гиперпрыжка в файл hyperfx.js

Отличный выбор — `galaxy.js` остаётся чистым, а весь визуал живёт отдельно. Вот готовый `galaxy/hyperfx.js`.

## `galaxy/hyperfx.js`

```js
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
```

## Что сделать в `elite2.html`

### 1. Подключить скрипт

После `galaxy.js`, `star.js`, `planet.js` и `help.js` добавь:

```html
<script src="./galaxy/galaxy.js"></script>
<script src="./galaxy/star.js"></script>
<script src="./galaxy/planet.js"></script>
<script src="./galaxy/hyperfx.js"></script>
<script src="./js/help.js"></script>
<script src="../js/sound-lib.js"></script>
```

### 2. Убедиться, что `window.THREE` выставляется ДО `HYPERFX.attach`

У тебя уже есть:

```js
import * as THREE from "three";
window.THREE = THREE;
```

Это остаётся. `HYPERFX` берёт `THREE` не из глобала, а из `opts.THREE` при `attach()` — так что порядок не так важен, но глобал всё равно пригодится, если будешь звать `HYPERFX.triggerShake()` без параметров.

### 3. Вызвать `attach` после создания `bloom`

Найди место, где создаётся `composer` и `bloom`:

```js
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.9, 0.6, 0.15,
);
composer.addPass(bloom);
```

Сразу после этого добавь:

```js
HYPERFX.attach({ THREE, scene, camera, bloom });
```

### 4. В `tryHyperJump()` — запуск эффекта

Найди блок, где включается оверлей:

```js
elHyperTarget.textContent = `${cur.name} → ${dst.name}`;
elHyperProgress.style.width = "0%";
elHyper.style.display = "flex";

kit.sounds.hjump.play();
GALAXY.setOpen(false);
```

Добавь после `kit.sounds.hjump.play();`:

```js
HYPERFX.start(state.hyper.duration);
```

### 5. В `completeHyperJump()` — остановка эффекта

В конце, перед `elHyper.style.display = "none";`:

```js
HYPERFX.stop();
```

### 6. В `animate()` — обновление каждый кадр

Сразу после `GALAXY.update(dt); updateHyper(dt);`:

```js
HYPERFX.update(dt, clock.elapsedTime);
```

## Что убрать из html

Ты пока ничего не вставлял из прошлого варианта — так что чистить нечего. Всё, что касается тоннеля, вспышки, тряски — теперь **только в `hyperfx.js`**. Элемент `#hyper-flash` создаётся скриптом автоматически, стили прописаны инлайном — `<style>` править не надо.

Если у тебя в `<style>` уже есть `#hyper-flash { ... }` из моих прошлых подсказок — можешь оставить, не помешает, но он будет перезаписан инлайновыми стилями из скрипта.

## Порядок вызовов — сводка

```
1. Скрипты подключены в <head>/<body>:
   galaxy.js → star.js → planet.js → hyperfx.js → help.js → sound-lib.js
2. В модуле: import THREE, window.THREE = THREE
3. Создаётся composer, bloom
4. HYPERFX.attach({ THREE, scene, camera, bloom })
5. J / Enter на карте → HYPERFX.start(duration)
6. Каждый кадр → HYPERFX.update(dt, clock.elapsedTime)
7. Прибытие → HYPERFX.stop()
```

## Настройки «под вкус»

Всё внутри `hyperfx.js`, если захочешь покрутить:

| Параметр | Где | Что делает |
|---|---|---|
| `STREAK_COUNT` | константа | плотность линий (900) |
| `STREAK_RADIUS` | константа | разлёт линий от центра |
| `STREAK_LEN` | константа | базовая длина линии |
| `speed = 1500 + 3500 * intensity` | `update` | скорость полёта |
| `uColorA / uColorB` | `buildTunnel` | цвета тоннеля |
| `bloom.strength = 1.6` | `start` | пик свечения |
| `flashLevel - dt * 2.5` | `update` | скорость гашения вспышки |

## Если что-то не видно

- **Тоннель не появляется** → проверь, что `HYPERFX.attach` вызван **до** первого `HYPERFX.start`. Иначе `group` не создан, и `start` ругнётся в консоль.
- **Streaks не видны** → они появляются по мере роста `intensity`. В первые 0.3 сек прозрачны — это нормально.
- **Тряска не ощущается** → увеличь `0.02` в строке `const amp = shakeLevel * 0.02;` до `0.04`.
- **Ошибка `THREE is not defined`** → ты забыл `window.THREE = THREE;` в модуле, или подключил `hyperfx.js` **после** основного модуля. Должно быть **до**.

## Итого

- `galaxy.js` — не тронут, чистый.
- `galaxy/hyperfx.js` — весь визуал гиперпрыжка в одном файле.
- HTML — четыре строки правок: подключение скрипта, `attach`, `start`/`stop`, `update`.
- Всё в стиле остальных модулей: IIFE, `window.HYPERFX`, никаких ESM-импортов, работает из `file://` (если three подключён).

Скажи, если хочется ещё эффект **radial blur** или **хроматическую аберрацию** постобработкой — можно добавить в `hyperfx.js` как `ShaderPass` в `composer`.


////////////////////////////////////////////////////////////////////////////////


- эффект radial blur
- хроматическая аберрация постобработкой 


Отлично! Добавляю хроматическую аберрацию через `ShaderPass`. Всё в `hyperfx.js`, включается флагом в `attach()`.

## Правки в `hyperfx.js`

### 1. Добавь `ShaderPass` и шейдер аберрации

Импортировать `ShaderPass` в классическом скрипте нельзя — он из ESM-модуля three. Поэтому **тот, кто вызывает `attach()`, должен передать `ShaderPass`** из своего модульного импорта. Либо мы делаем свой минимальный `ShaderPass` прямо в `hyperfx.js` — это 10 строк и без зависимостей. Иду вторым путём: **самописный пасс**, не требующий импортов.

Добавь в начало IIFE (после объявления переменных):

```js
  // --- Хроматическая аберрация ---
  let chromaticPass = null;
  let chromaticEnabled = false;
  let chromaticIntensity = 0;    // 0..1, анимируется во время прыжка
  let chromaticTargetIntensity = 0;

  // Конфиг — можно переопределить через attach({ chromatic: {...} })
  const CHROMATIC_DEFAULTS = {
    enabled: false,             // по умолчанию выключено
    maxOffset: 0.012,           // максимальное смещение R/B каналов (доля экрана)
    vignette: 0.6,              // затемнение к краям
    baseIntensity: 0.35,        // базовая интенсивность (даже вне прыжка, если enabled)
    boostDuringJump: 1.0,       // добавка во время гиперпрыжка
  };
  let chromaticCfg = { ...CHROMATIC_DEFAULTS };
```

### 2. Самописный `ShaderPass`

Добавь **внутри** `hyperfx.js` функцию-конструктор:

```js
  // ------------------------------------------------------------------
  //  Минимальный ShaderPass — чтобы не тянуть ESM-модуль three
  // ------------------------------------------------------------------
  function makeShaderPass(shader, uniforms) {
    const pass = {
      enabled: true,
      uniforms: uniforms,
      material: null,
      fsQuad: null,
      _scene: null,
      _camera: null,
      _geometry: null,
    };

    // Полноэкранный треугольник
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
        3,
      ),
    );
    geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2),
    );

    const material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: shader,
      depthTest: false,
      depthWrite: false,
    });

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    pass.material = material;
    pass.fsQuad = mesh;
    pass._scene = scene;
    pass._camera = camera;
    pass._geometry = geometry;

    pass.render = function (renderer, writeBuffer, readBuffer) {
      if (!pass.enabled) return false;

      pass.material.uniforms.tDiffuse.value = readBuffer.texture;

      renderer.setRenderTarget(writeBuffer);
      renderer.clear();
      renderer.render(pass._scene, pass._camera);

      return true;
    };

    return pass;
  }
```

### 3. Собираем сам шейдер аберрации

Помести константу рядом с другими шейдерами (после `tunnelFrag`):

```js
  // ------------------------------------------------------------------
  //  Шейдер хроматической аберрации
  // ------------------------------------------------------------------
  const chromaticFrag = /* glsl */ `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uIntensity;    // 0..1
    uniform float uMaxOffset;    // доля экрана
    uniform float uVignette;

    void main() {
      vec2 uv = vUv;
      vec2 center = vec2(0.5, 0.5);
      vec2 dir = uv - center;
      float dist = length(dir);

      // Радиальное смещение растёт к краям
      vec2 offset = dir * uMaxOffset * uIntensity;

      // R — наружу, B — внутрь, G — без смещения
      float r = texture2D(tDiffuse, uv + offset).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - offset).b;
      vec3 col = vec3(r, g, b);

      // Виньетка
      float vig = smoothstep(0.9, 0.25, dist * (1.0 + uVignette));
      col *= mix(1.0, vig, uIntensity * uVignette);

      // Лёгкое усиление насыщенности
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, 1.0 + uIntensity * 0.25);

      gl_FragColor = vec4(col, 1.0);
    }
  `;
```

### 4. Создание пасса при `attach()`

Внутри `attach()` после `buildTunnel()` добавь:

```js
    // --- Хроматическая аберрация ---
    if (chromaticCfg.enabled) {
      initChromatic();
    }
```

И сама функция:

```js
  function initChromatic() {
    if (chromaticPass) return;
    if (!window.EffectComposer || !window.__composer) {
      console.warn(
        "HYPERFX: для хроматической аберрации передай composer в attach({ composer })",
      );
      return;
    }

    const uniforms = {
      tDiffuse: { value: null },
      uIntensity: { value: chromaticIntensity },
      uMaxOffset: { value: chromaticCfg.maxOffset },
      uVignette: { value: chromaticCfg.vignette },
    };

    chromaticPass = makeShaderPass(chromaticFrag, uniforms);
    chromaticPass.enabled = chromaticCfg.enabled;

    // Вставляем пасс ПЕРЕД bloom — чтобы аберрация шла до свечения
    const composer = window.__composer;
    composer.addPass(chromaticPass);
  }
```

### 5. Передача `composer` в `attach`

Придётся принимать `composer` — иначе некуда вставлять пасс:

```js
  function attach(opts) {
    THREE = opts.THREE;
    scene = opts.scene;
    camera = opts.camera;
    bloom = opts.bloom || null;

    // ★ composer — нужен для постобработки
    if (opts.composer) {
      window.__composer = opts.composer;
    }

    // ★ настройки хроматики
    if (opts.chromatic) {
      Object.assign(chromaticCfg, opts.chromatic);
    }

    if (!THREE || !scene || !camera) {
      console.warn("HYPERFX.attach: THREE, scene, camera обязательны");
      return;
    }

    ensureFlashEl();
    buildTunnel();

    if (chromaticCfg.enabled) {
      initChromatic();
    }
  }
```

### 6. Публичные методы управления хроматикой

Добавь в возвращаемый объект:

```js
  function setChromatic(enabled) {
    chromaticCfg.enabled = !!enabled;
    if (chromaticPass) {
      chromaticPass.enabled = chromaticCfg.enabled;
    } else if (chromaticCfg.enabled) {
      initChromatic();
    }
  }

  function setChromaticIntensity(v) {
    chromaticIntensity = Math.max(0, Math.min(1, v));
    if (chromaticPass) {
      chromaticPass.uniforms.uIntensity.value = chromaticIntensity;
    }
  }

  function setChromaticConfig(cfg) {
    Object.assign(chromaticCfg, cfg || {});
    if (chromaticPass) {
      chromaticPass.uniforms.uMaxOffset.value = chromaticCfg.maxOffset;
      chromaticPass.uniforms.uVignette.value = chromaticCfg.vignette;
    }
  }

  function isChromaticEnabled() {
    return chromaticCfg.enabled;
  }
```

### 7. Анимация интенсивности в `start` / `stop` / `update`

**В `start()`** — заряжаем цель на boost:

```js
    chromaticTargetIntensity = chromaticCfg.baseIntensity + chromaticCfg.boostDuringJump;
    chromaticTargetIntensity = Math.min(1, chromaticTargetIntensity);
```

**В `stop()`** — опускаем к базовой:

```js
    chromaticTargetIntensity = chromaticCfg.enabled ? chromaticCfg.baseIntensity : 0;
```

**В `update()`** — плавно гоним `chromaticIntensity` к цели:

```js
    // Хроматическая аберрация: плавно тянем к цели
    if (chromaticCfg.enabled && chromaticPass) {
      const target = chromaticTargetIntensity;
      const speed = 3.0;
      chromaticIntensity += (target - chromaticIntensity) * Math.min(1, dt * speed);
      chromaticPass.uniforms.uIntensity.value = chromaticIntensity;
    }
```

И в самом начале `update()`, до `if (!active || !group) return;`, — чтобы даже вне прыжка аберрация гасилась к базовой:

```js
    // Если хроматика выключена — глушим
    if (!chromaticCfg.enabled && chromaticPass) {
      chromaticIntensity = Math.max(0, chromaticIntensity - dt * 4);
      chromaticPass.uniforms.uIntensity.value = chromaticIntensity;
      if (chromaticIntensity === 0) chromaticPass.enabled = false;
    }
```

### 8. Возвращаемый объект — финальный

```js
  return {
    attach,
    start,
    stop,
    update,
    triggerFlash,
    triggerShake,
    get isActive() { return active; },

    // Хроматическая аберрация
    setChromatic,
    setChromaticIntensity,
    setChromaticConfig,
    isChromaticEnabled,
  };
```

## Что поменять в `elite2.html`

### 1. Передать `composer` в `attach`

Найди:

```js
HYPERFX.attach({ THREE, scene, camera, bloom });
```

Замени на:

```js
HYPERFX.attach({
  THREE, scene, camera, bloom,
  composer,               // ★ нужен для постобработки
  chromatic: {
    enabled: true,        // ★ вкл/выкл хроматику
    maxOffset: 0.012,     // сила смещения
    vignette: 0.6,        // затемнение краёв
    baseIntensity: 0.15,  // сколько аберрации в обычном полёте
    boostDuringJump: 0.85,// добавка во время прыжка
  },
});
```

### 2. Хоткей для вкл/выкл

В `keydown`, рядом с F1:

```js
// F3: хроматическая аберрация on/off
if (e.code === "F3") {
  const on = !HYPERFX.isChromaticEnabled();
  HYPERFX.setChromatic(on);
  console.log("Chromatic aberration:", on);
  e.preventDefault();
  return;
}
```

Теперь:

- **F3** — вкл/выкл аберрацию.
- В обычном полёте она слабая (`baseIntensity: 0.15`).
- Во время гиперпрыжка вспыхивает до `1.0` (0.15 + 0.85), потом плавно возвращается к базовой.

### 3. Из консоли

```js
HYPERFX.setChromatic(true);              // включить
HYPERFX.setChromatic(false);             // выключить
HYPERFX.setChromaticConfig({ maxOffset: 0.03 }); // сильнее смещение
HYPERFX.setChromaticIntensity(0.8);      // ручная интенсивность
```

## Если хочется вообще без хроматики по умолчанию

Оставь `enabled: false` в `attach` — пасс даже не будет создан, никакого оверхеда. Включишь F3, если понадобится.

## Порядок пассов в `composer`

Сейчас у тебя:

```
RenderPass → UnrealBloomPass
```

`hyperfx` вставляет `chromaticPass` **после** bloom. Это тоже работает, но красивее — **до** bloom, чтобы аберрация «подсвечивалась» блумом:

```js
// В initChromatic(), если хочешь вставить перед bloom:
composer.insertPass(chromaticPass, 1);   // после RenderPass, до bloom
```

`EffectComposer` в three 0.160 имеет метод `insertPass(pass, index)`. Поставь `1` — и аберрация окажется между `RenderPass` и `UnrealBloomPass`.

Если не хочешь зависеть от `insertPass`, оставь `addPass` — тоже смотрится нормально.

## Тонкая настройка «под вкус»

| Параметр | Где | Что делает |
|---|---|---|
| `enabled` | attach | вкл/выкл вообще |
| `maxOffset` | attach | сила смещения R/B каналов (0.005 — еле заметно, 0.03 — агрессивно) |
| `vignette` | attach | затемнение по краям (0 — нет, 1 — сильно) |
| `baseIntensity` | attach | фоновая аберрация в обычном полёте |
| `boostDuringJump` | attach | добавка на время прыжка |
| `speed = 3.0` | `update` | плавность перехода |

## Итого

- В `hyperfx.js` добавлен **самописный `ShaderPass`** — без ESM-импортов.
- Шейдер хроматики с радиальным смещением R/B, виньеткой и лёгким бустом насыщенности.
- `attach({ ..., composer, chromatic: { enabled: true, ... } })` — включает и настраивает.
- Хроматика **слабая в полёте** (`baseIntensity`) и **вспыхивает во время прыжка** (`boostDuringJump`).
- Управление: `HYPERFX.setChromatic(true/false)`, `setChromaticConfig({...})`, `setChromaticIntensity(v)`, `isChromaticEnabled()`.
- **F3** — хоткей вкл/выкл.

Скажи, если хочешь ещё **radial blur** во время прыжка (размытие от центра) — добавлю таким же пассом.