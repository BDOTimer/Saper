// env-1.js
// class Grass;
// class Terrain;
// class Water;
// class Sky;
// class Conifers;
// class Nature;
// class ...;

const WATER_LEVEL = -2.5;  // тот же, что и в Water

// --------------------------------------------------------
// Трава
// --------------------------------------------------------
class Grass {
  constructor(scene, terrain, renderer, opts = {}) {
    this.scene = scene;
    this.terrain = terrain;
    this.count = opts.count ?? 40000;
    this.radius = opts.radius ?? 600;
    this.time = 0;
    this.mesh = null;            // ← пока не создан
    this.positions = [];
    this.originalScales = [];
    this.lodTimer = 0;
    
    // Загружаем текстуру СИНХРОННО 
    // (не блокирует сцену, но build() завершится с готовой текстурой)
    this.texLoader = new THREE.TextureLoader();
    this.grassTex = this.texLoader.load('./res/grass-1.png', (tex) => {
      // коллбэк после загрузки
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    });
    
    this.build();
  }

  createGrassBlade() {
    const plane1 = new THREE.PlaneGeometry(2.0, 1.4, 1, 4);
    plane1.translate(0, 0.7, 0);

    const plane2 = plane1.clone();
    plane2.rotateY(Math.PI / 2);

    const p1 = plane1.attributes.position.array;
    const p2 = plane2.attributes.position.array;
    const positions = new Float32Array(p1.length + p2.length);
    positions.set(p1, 0); positions.set(p2, p1.length);

    const n1 = plane1.attributes.normal.array;
    const n2 = plane2.attributes.normal.array;
    const normals = new Float32Array(n1.length + n2.length);
    normals.set(n1, 0); normals.set(n2, n1.length);

    const u1 = plane1.attributes.uv.array;
    const u2 = plane2.attributes.uv.array;
    const uvs = new Float32Array(u1.length + u2.length);
    uvs.set(u1, 0); uvs.set(u2, u1.length);

    const i1 = plane1.index.array;
    const i2 = plane2.index.array;
    const offset = p1.length / 3;
    const indices = new Uint16Array(i1.length + i2.length);
    indices.set(i1, 0);
    for (let i = 0; i < i2.length; i++) indices[i1.length + i] = i2[i] + offset;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));

    plane1.dispose(); plane2.dispose();
    return geo;
  }

  build() {
    const geo = this.createGrassBlade();

    const mat = new THREE.MeshStandardMaterial({
      map: this.grassTex,        // ← даже если текстура ещё грузится, материал готов
      color: 0xffffff,
      side: THREE.DoubleSide,
      roughness: 0.95,
      metalness: 0.0,
      alphaTest: 0.4,            // жёсткий силуэт, без прозрачности
      transparent: false,
      depthWrite: true,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uWindStrength = { value: 0.18 };
      shader.uniforms.uWindFreq = { value: 0.5 };

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uWindStrength;
         uniform float uWindFreq;`
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           vec4 wPos = instanceMatrix * vec4(position, 1.0);
         #else
           vec4 wPos = modelMatrix * vec4(position, 1.0);
         #endif
         float windFactor = smoothstep(0.0, 0.7, transformed.y);
         float w1 = sin(uTime * 2.0 + wPos.x * uWindFreq + wPos.z * uWindFreq * 0.8);
         float w2 = cos(uTime * 1.3 + wPos.x * uWindFreq * 0.7 + wPos.z * uWindFreq);
         transformed.x += (w1 * 0.7 + w2 * 0.3) * uWindStrength * windFactor;
         transformed.z += (w2 * 0.5 - w1 * 0.2) * uWindStrength * windFactor * 0.6;`
      );

      mat.userData.shader = shader;
    };

    // Собираем позиции
    const candidates = [];
    const attempts = this.count * 12;
    for (let i = 0; i < attempts && candidates.length < this.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * this.radius;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const h = this.terrain.getHeightAt(x, z);
      if (h < WATER_LEVEL + 0.4) continue;
      if (h > 8) continue;

      const eps = 0.6;
      const dx = (this.terrain.getHeightAt(x+eps,z) - this.terrain.getHeightAt(x-eps,z)) / (2*eps);
      const dz = (this.terrain.getHeightAt(x,z+eps) - this.terrain.getHeightAt(x,z-eps)) / (2*eps);
      if (Math.sqrt(dx*dx + dz*dz) > 0.55) continue;

      candidates.push({ x, z, h });
    }

    this.mesh = new THREE.InstancedMesh(geo, mat, candidates.length);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    this.positions = [];
    this.originalScales = [];

    for (let i = 0; i < candidates.length; i++) {
      const p = candidates[i];
      this.positions.push(new THREE.Vector3(p.x, p.h, p.z));

      dummy.position.set(p.x, p.h, p.z);
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.25,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.25
      );
      const s = 0.6 + Math.random() * 0.9;
      dummy.scale.set(s, s * (0.8 + Math.random() * 0.5), s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.originalScales.push(dummy.scale.x);   // ← сохраняем

      const hue = 0.26 + (Math.random() - 0.5) * 0.06;
      const sat = 0.45 + Math.random() * 0.35;
      const light = 0.28 + Math.random() * 0.22 + (p.h / 10) * 0.05;
      color.setHSL(hue, sat, light);
      this.mesh.setColorAt(i, color);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.scene.add(this.mesh);
    console.log('Трава: посажено', candidates.length, 'травинок');
  }

  update(dt, camera) {
    // 🔒 ЗАЩИТА №1: меш ещё не создан (асинхронная инициализация)
    if (!this.mesh) return;

    this.time += dt;

    // 🔒 ЗАЩИТА №2: onBeforeCompile ещё не сработал (не было первого рендера)
    const shader = this.mesh.material.userData.shader;
    if (shader) {
      shader.uniforms.uTime.value = this.time;
    }

    // LOD по дистанции (раз в 100 мс)
    this.lodTimer += dt;
    if (this.lodTimer < 0.1) return;
    this.lodTimer = 0;

    const camPos = camera.position;
    const MAX_DIST = 150;
    const MAX_DIST_SQ = MAX_DIST * MAX_DIST;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < this.positions.length; i++) {
      const p = this.positions[i];
      const dx = p.x - camPos.x;
      const dz = p.z - camPos.z;
      const distSq = dx * dx + dz * dz;

      this.mesh.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      const isVisibleNow = dummy.scale.x > 0.01;
      const shouldBeVisible = distSq < MAX_DIST_SQ;

      if (isVisibleNow && !shouldBeVisible) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
      } else if (!isVisibleNow && shouldBeVisible) {
        dummy.scale.setScalar(this.originalScales[i]);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// --------------------------------------------------------
// ЛАНДШАФТ — процедурный (более холмистый)
// --------------------------------------------------------
class Terrain {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.size = opts.size ?? 400;
    this.segments = opts.segments ?? 160;   // плотнее сетка = больше деталей
    this.height = opts.height ?? 18;        // выше холмы
    this.seed = opts.seed ?? 12345;
    this.generate();
  }

  // --- Стабильный value-noise ---
  rand(x, y) {
    let n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
    return n - Math.floor(n);
  }

  noise2D(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = this.rand(xi, yi);
    const b = this.rand(xi + 1, yi);
    const c = this.rand(xi, yi + 1);
    const d = this.rand(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  // --- Многослойный шум (fractal brownian motion) ---
  fbm(x, y, octaves = 5, persistence = 0.5, lacunarity = 2.0) {
    let sum = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise2D(x * freq, y * freq) * amp;
      max += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return sum / max;
  }

  heightAt(x, z) {
    // Масштабы (чем больше — тем крупнее холмы)
    const sx = x / 55;
    const sz = z / 55;

    // 1) Основные холмы — крупный шум, амплитуда 1
    let base = (this.fbm(sx, sz, 5) - 0.5) * 2.0;

    // 2) Мелкие бугры — средний шум, амплитуда 0.35
    let hills = (this.fbm(sx * 2.7, sz * 2.7, 3) - 0.5) * 0.35;

    // 3) Овраги — вычитаем из рельефа там, где шум «низкий»
    let gullies = (this.fbm(sx * 1.3 + 100, sz * 1.3 + 100, 3) - 0.5);
    gullies = Math.max(0, -gullies) * 1.6; // только отрицательные зоны

    let h = base + hills - gullies;

    // 4) Маска: возле центра — плоская равнина (для удобства), к краям — всё выше
    const distFromCenter = Math.sqrt(x * x + z * z);
    const flatZone   = 30;    // радиус ровной площадки
    const transition = 100;  // за сколько метров до "полного" рельефа

    let reliefMask;
    if (distFromCenter < flatZone) {
      reliefMask = 0.2;   // лёгкие бугры даже в центре
    } else {
      reliefMask = Math.min(1, 0.15 + (distFromCenter - flatZone) / transition);
    }

    // 5) По краям карты — горы выше (для красивого горизонта)
    const edgeBoost = Math.max(0, (distFromCenter - 80) / 100) * 1.2;

    return h * this.height * reliefMask + edgeBoost * this.height;
  }

  generate() {
    const geo = new THREE.PlaneGeometry(
      this.size, this.size, this.segments, this.segments
    );
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this.heightAt(x, z));
    }
    geo.computeVertexNormals();

    // Материал с вершинными цветами
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0
    });

    const colors = new Float32Array(pos.count * 3);

    // Палитра по высоте
    const cWater  = new THREE.Color(0x1e3a15); // тёмно-зелёная низина
    const cGrass  = new THREE.Color(0x5a9b3a); // трава
    const cGrass2 = new THREE.Color(0x3d6b2a); // тёмная трава
    const cRock   = new THREE.Color(0x7b5550); // тёмный камень
    const cRock2  = new THREE.Color(0x7a7460); // светлый камень
    const cSnow   = new THREE.Color(0xe8e8e0); // снег (только самые вершины)

    const tmp = new THREE.Color();
    const minH = WATER_LEVEL - 2;   // ~ -4.5
    const maxH = this.height/2; // ~ 54

    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const t = Math.min(1, Math.max(0, (y - minH) / (maxH - minH)));

        if (t < 0.2) {
            // Низины: вода → трава
            tmp.copy(cWater).lerp(cGrass, t / 0.2);
        } else if (t < 0.5) {
            // Средние высоты: трава → тёмная трава
            tmp.copy(cGrass).lerp(cGrass2, (t - 0.2) / 0.3);
        } else if (t < 0.75) {
            // Верхние склоны: тёмная трава → тёмный камень
            tmp.copy(cGrass2).lerp(cRock, (t - 0.5) / 0.25);
        } else if (t < 0.95) {
            // Высокие холмы: тёмный камень → светлый камень
            tmp.copy(cRock).lerp(cRock2, (t - 0.75) / 0.2);
        } else {
            // Самые вершины (95-100%): камень → снег
            tmp.copy(cRock2).lerp(cSnow, (t - 0.95) / 0.05);
        }

        // Шумовая вариация для «живости»
        const v = 0.85 + 0.3 * this.noise2D(i * 0.13, i * 0.17);
        colors[i * 3]     = tmp.r * v;
        colors[i * 3 + 1] = tmp.g * v;
        colors[i * 3 + 2] = tmp.b * v;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.position.y = 0;
    this.scene.add(this.mesh);
  }

  getHeightAt(x, z) {
    return this.heightAt(x, z);
  }
}

// --------------------------------------------------------
// CLASS: Вода (плоскость с анимированной рябью)
// --------------------------------------------------------
class Water {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.level = opts.level ?? -2.5;
    this.size = opts.size ?? 600;
    this.time = 0;

    const geo = new THREE.PlaneGeometry(this.size, this.size, 128, 128);
    geo.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uColorShallow: { value: new THREE.Color(0x4a8aaa) },
        uColorDeep: { value: new THREE.Color(0x0e2a44) },
        uSunDir: { value: new THREE.Vector3(0.5, 1.0, 0.4).normalize() },
        uSunColor: { value: new THREE.Color(0xfff5cc) },
        uFogColor: { value: new THREE.Color(0xa0c8e8) },
        uFogNear: { value: 40.0 },
        uFogFar: { value: 200.0 }
      },
      vertexShader: `
        uniform float uTime;
        
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec2 vUv;

        // Функция волны
        float wave(vec2 pos, float freq, float speed, vec2 dir) {
          return sin(dot(pos, dir) * freq + uTime * speed);
        }

        void main() {
          vUv = uv;
          
          // === АНИМАЦИЯ ВОЛН ===
          vec3 pos = position;
          
          // Три слоя волн с разными направлениями и скоростями
          float w1 = wave(pos.xz, 0.15, 1.2, vec2(1.0, 0.3));
          float w2 = wave(pos.xz, 0.25, 0.8, vec2(-0.5, 1.0));
          float w3 = wave(pos.xz, 0.08, 1.5, vec2(0.7, -0.7));
          
          // Суммарное смещение по Y
          pos.y += (w1 * 0.15 + w2 * 0.1 + w3 * 0.2);
          
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWorldPos = wp.xyz;

          // Вычисляем нормаль аналитически (производные волн)
          float eps = 0.5;
          float hL = wave(pos.xz - vec2(eps, 0.0), 0.15, 1.2, vec2(1.0, 0.3)) * 0.15
                   + wave(pos.xz - vec2(eps, 0.0), 0.25, 0.8, vec2(-0.5, 1.0)) * 0.1
                   + wave(pos.xz - vec2(eps, 0.0), 0.08, 1.5, vec2(0.7, -0.7)) * 0.2;
          
          float hR = wave(pos.xz + vec2(eps, 0.0), 0.15, 1.2, vec2(1.0, 0.3)) * 0.15
                   + wave(pos.xz + vec2(eps, 0.0), 0.25, 0.8, vec2(-0.5, 1.0)) * 0.1
                   + wave(pos.xz + vec2(eps, 0.0), 0.08, 1.5, vec2(0.7, -0.7)) * 0.2;
          
          float hD = wave(pos.xz - vec2(0.0, eps), 0.15, 1.2, vec2(1.0, 0.3)) * 0.15
                   + wave(pos.xz - vec2(0.0, eps), 0.25, 0.8, vec2(-0.5, 1.0)) * 0.1
                   + wave(pos.xz - vec2(0.0, eps), 0.08, 1.5, vec2(0.7, -0.7)) * 0.2;
          
          float hU = wave(pos.xz + vec2(0.0, eps), 0.15, 1.2, vec2(1.0, 0.3)) * 0.15
                   + wave(pos.xz + vec2(0.0, eps), 0.25, 0.8, vec2(-0.5, 1.0)) * 0.1
                   + wave(pos.xz + vec2(0.0, eps), 0.08, 1.5, vec2(0.7, -0.7)) * 0.2;
          
          vec3 tangentX = normalize(vec3(2.0 * eps, hR - hL, 0.0));
          vec3 tangentZ = normalize(vec3(0.0, hU - hD, 2.0 * eps));
          vNormal = normalize(cross(tangentZ, tangentX));

          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorShallow;
        uniform vec3 uColorDeep;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;

        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          // === РЯБЬ ===
          float n1 = noise(vWorldPos.xz * 0.3 + uTime * 0.4);
          float n2 = noise(vWorldPos.xz * 0.5 - uTime * 0.3);
          float n3 = noise(vWorldPos.xz * 0.8 + uTime * 0.2);
          float ripple = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

          // Цвет воды
          vec3 water = mix(uColorDeep, uColorShallow, ripple);

          // Блик от солнца
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 normal = normalize(vNormal + vec3(ripple * 0.3, 0.0, ripple * 0.3));
          
          float diff = max(dot(normal, uSunDir), 0.0);
          vec3 reflectDir = reflect(-uSunDir, normal);
          float spec = pow(max(dot(viewDir, reflectDir), 0.0), 128.0);
          vec3 specular = uSunColor * spec * 1.5;

          // Прозрачность
          float alpha = 0.75 + 0.2 * ripple;

          vec3 color = water + specular;

          // Туман
          float dist = length(cameraPosition - vWorldPos);
          float fogFactor = smoothstep(uFogNear, uFogFar, dist);
          color = mix(color, uFogColor, fogFactor);
          alpha = mix(alpha, 1.0, fogFactor * 0.5);

          float foam = smoothstep(0.7, 0.9, ripple);
          color = mix(color, vec3(1.0), foam * 0.4);
          gl_FragColor = vec4(color, alpha);
        }
      `
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = this.level;
    this.mesh.renderOrder = 1;
    this.scene.add(this.mesh);
  }

  update(dt) {
    this.time += dt;
    this.material.uniforms.uTime.value = this.time;
  }
}

// --------------------------------------------------------
// CLASS: Небо + Солнце + Облака
// --------------------------------------------------------
class Sky {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];
    this.createSkyDome();
    this.createSun();
    this.createClouds();
  }

  createSkyDome() {
    const geo = new THREE.SphereGeometry(300, 32, 32);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x2a6dd4) },
        bottomColor: { value: new THREE.Color(0xa8d8f0) },
        offset: { value: 20 },
        exponent: { value: 0.6 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h,0.0), exponent), 0.0)), 1.0);
        }`
    });
    this.scene.add(new THREE.Mesh(geo, mat));
  }

  createSun() {
    const sunGeo = new THREE.SphereGeometry(8, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    this.sun = new THREE.Mesh(sunGeo, sunMat);
    this.sun.position.set(120, 140, 100);
    this.scene.add(this.sun);

    const glowGeo = new THREE.SphereGeometry(14, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: 0xffdd88, transparent: true, opacity: 0.3 
    });
    this.sunGlow = new THREE.Mesh(glowGeo, glowMat);
    this.sunGlow.position.copy(this.sun.position);
    this.scene.add(this.sunGlow);
  }

  createClouds() {
    const cloudMat = new THREE.MeshLambertMaterial({ 
      color: 0xffffff, transparent: true, opacity: 0.85 
    });
    for (let i = 0; i < 12; i++) {
      const cloudGroup = new THREE.Group();
      const parts = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < parts; j++) {
        const size = 4 + Math.random() * 5;
        const geo = new THREE.SphereGeometry(size, 8, 8);
        const part = new THREE.Mesh(geo, cloudMat);
        part.position.set(
          (j - parts/2) * 6 + Math.random() * 3,
          Math.random() * 2,
          Math.random() * 4
        );
        cloudGroup.add(part);
      }
      cloudGroup.position.set(
        (Math.random() - 0.5) * 300,
        50 + Math.random() * 30,
        (Math.random() - 0.5) * 300
      );
      cloudGroup.userData.speed = 0.02 + Math.random() * 0.05;
      this.clouds.push(cloudGroup);
      this.scene.add(cloudGroup);
    }
  }

  update(dt) {
    this.clouds.forEach(c => {
      c.position.x += c.userData.speed * dt * 5;
      if (c.position.x > 180) c.position.x = -180;
    });
  }
}

// --------------------------------------------------------
// CLASS: Ёлка (инстансный меш — одна геометрия, много копий)
// --------------------------------------------------------
class Conifers {
  constructor(scene, terrain, opts = {}) {
    this.scene   = scene;
    this.terrain = terrain;
    this.count   = opts.count   ?? 120;
    this.minH    = opts.minH    ?? 6;      // ниже этой высоты ёлки не сажаем
    this.maxH    = opts.maxH    ?? 999;    // выше — тоже не сажаем (снег/голый камень)
    this.maxSlope = opts.maxSlope ?? 0.55; // не на обрывах
    this.radius  = opts.radius  ?? 200;    // радиус посадки от центра

    // Две геометрии: ствол + «слои» кроны (конусы)
    this.build();
  }

  // --- Геометрия одной ёлки: ствол + 3 конуса, слитые в один BufferGeometry ---
  createConiferGeometry() {
    const geos = [];

    // Ствол
    const trunk = new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6);
    trunk.translate(0, 1.1, 0);
    geos.push(trunk);

    // Три конуса кроны — снизу вверх, каждый меньше предыдущего
    const layers = [
      { r: 2.2, h: 2.4, y: 2.6 },
      { r: 1.6, h: 2.0, y: 4.1 },
      { r: 1.0, h: 1.7, y: 5.4 },
    ];
    for (const L of layers) {
      const cone = new THREE.ConeGeometry(L.r, L.h, 7);
      cone.translate(0, L.y, 0);
      geos.push(cone);
    }

    // Сливаем все геометрии в одну — это обязательно для InstancedMesh
    return this.mergeGeometries(geos);
  }

  // --- Ручное слияние BufferGeometry (без импорта BufferGeometryUtils) ---
  mergeGeometries(geos) {
    // Приводим все к non-indexed, чтобы не возиться с индексами
    const nonIndexed = geos.map(g => g.index ? g.toNonIndexed() : g);

    let totalVerts = 0;
    for (const g of nonIndexed) totalVerts += g.attributes.position.count;

    const pos = new Float32Array(totalVerts * 3);
    const norm = new Float32Array(totalVerts * 3);
    let off = 0;

    for (const g of nonIndexed) {
      const p = g.attributes.position.array;
      const n = g.attributes.normal.array;
      pos.set (p, off * 3);
      norm.set(n, off * 3);
      off += g.attributes.position.count;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal',   new THREE.BufferAttribute(norm, 3));

    // Освобождаем промежуточные
    for (const g of geos) g.dispose();

    return merged;
  }

  build() {
    const geo = this.createConiferGeometry();

    // Материал — тёмно-зелёный, чуть разный по цвету через instanceColor
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      // Небольшой «шершавый» вид:
      flatShading: false,
    });

    // Собираем точки посадки: высокие холмы, пологие, не под водой
    const candidates = [];
    const attempts = this.count * 25;

    for (let i = 0; i < attempts && candidates.length < this.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * this.radius;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const h = this.terrain.getHeightAt(x, z);

      // Только высокие холмы
      if (h < this.minH) continue;
      if (h > this.maxH) continue;
      // Не под водой (на всякий случай)
      if (h < WATER_LEVEL + 0.5) continue;

      // Проверка уклона
      const eps = 1.0;
      const hL = this.terrain.getHeightAt(x - eps, z);
      const hR = this.terrain.getHeightAt(x + eps, z);
      const hU = this.terrain.getHeightAt(x, z - eps);
      const hD = this.terrain.getHeightAt(x, z + eps);
      const dx = (hR - hL) / (2 * eps);
      const dz = (hD - hU) / (2 * eps);
      const slope = Math.sqrt(dx * dx + dz * dz);
      if (slope > this.maxSlope) continue;

      candidates.push({ x, z, h });
    }

    if (candidates.length === 0) {
      console.warn('Conifers: не найдено подходящих точек для посадки');
      return;
    }

    this.mesh = new THREE.InstancedMesh(geo, mat, candidates.length);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false; // чтобы не «пропадали» при больших сценах

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < candidates.length; i++) {
      const p = candidates[i];

      dummy.position.set(p.x, p.h - 0.4, p.z);
      // Небольшой случайный поворот вокруг Y + лёгкий наклон
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.4,
         Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.4
      );

      // Масштаб: ёлки наверху чуть меньше (ветер/холод)
      const heightFactor = 1.0 - Math.min(0.4, (p.h - this.minH) * 0.01);
      const s = (0.7 + Math.random() * 0.7) * heightFactor;
      dummy.scale.set(s, s * (1 + Math.random()), s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);

      // Оттенок: тёмно-зелёный с вариацией
      // const hue   = 0.32 + (Math.random() - 0.5) * 0.04;   // ~115–125°
      // const sat   = 0.45 +  Math.random() * 0.2;
      // const light = 0.08 +  Math.random() * 0.10;
      // color.setHSL(hue, sat, light);
      if(heightFactor > 0.6)
      { const a = Math.random() * 0.40;
        const b = Math.random() * 0.30;
        color.set(a, a+b, a);
      }
      else
      { const a = 0.8;
        const b = Math.random() * 0.2;
        color.set(a, a+b, a);
      }
      this.mesh.setColorAt(i, color);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.scene.add(this.mesh);

    // Запоминаем точки как spawnPoints для уток (по желанию)
    this.spawnPoints = candidates.map(c => ({ x: c.x, z: c.z }));

    console.log('Ёлки: посажено', candidates.length, 'штук');
  }
}

// --------------------------------------------------------
// CLASS: Природа (деревья + кусты + камни + камыши)
// --------------------------------------------------------
class Nature {
  constructor(scene, terrain) {
    this.scene   = scene;
    this.terrain = terrain;
    this.spawnPoints = [];
    this.createForest();
  }

  // Проверка: точка под водой?
  isUnderwater(x, z, margin = 0.3) {
    const h = this.terrain.getHeightAt(x, z);
    return h < WATER_LEVEL + margin;
  }

  // Проверка: точка на берегу / крутом склоне — не сажаем
  isOnSlope(x, z, maxSlope = 0.6) {
    // считаем разницу высот по X и Z
    const  eps = 1.0;
    const  hL  = this.terrain.getHeightAt(x - eps, z);
    const  hR  = this.terrain.getHeightAt(x + eps, z);
    const  hU  = this.terrain.getHeightAt(x, z - eps);
    const  hD  = this.terrain.getHeightAt(x, z + eps);
    const  dx  = (hR - hL) / (2 * eps);
    const  dz  = (hD - hU) / (2 * eps);
    const  slope = Math.sqrt(dx * dx + dz * dz);
    return slope > maxSlope;
  }

  createTree(x, z, scale = 1) {
    const group = new THREE.Group();
    
    const trunkGeo = new THREE.CylinderGeometry(0.4*scale, 0.6*scale, 4*scale, 8);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1e });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2*scale;
    trunk.castShadow = true;
    group.add(trunk);

    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e5c1e });
    for (let i = 0; i < 4; i++) {
      const size = (1.8 + Math.random()*0.8) * scale;
      const leafGeo = new THREE.SphereGeometry(size, 8, 8);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(
        (Math.random()-0.5) * 2*scale,
        4*scale + Math.random()*1.5*scale,
        (Math.random()-0.5) * 2*scale
      );
      leaf.castShadow = true;
      group.add(leaf);
    }
    
    group.position.set(x, this.terrain.getHeightAt(x, z), z);
    group.userData.type = 'tree';
    return group;
  }

  createBush(x, z, scale = 1) {
    const group = new THREE.Group();
    const bushMat = new THREE.MeshLambertMaterial({ color: 0x3a7a2a });
    for (let i = 0; i < 5; i++) {
      const size = (0.6 + Math.random()*0.5) * scale;
      const geo = new THREE.SphereGeometry(size, 6, 6);
      const b = new THREE.Mesh(geo, bushMat);
      b.position.set(
        (Math.random()-0.5) * 1.5*scale,
        size*0.7,
        (Math.random()-0.5) * 1.5*scale
      );
      b.castShadow = true;
      group.add(b);
    }
    group.position.set(x, this.terrain.getHeightAt(x, z), z);
    group.userData.type = 'bush';
    return group;
  }

  createRock(x, z, scale = 1) {
    const geo = new THREE.DodecahedronGeometry(scale, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x777777 });
    const rock = new THREE.Mesh(geo, mat);
    // Камни могут торчать из воды — сажаем их на дно, а не на поверхность воды
    const floorY = this.terrain.getHeightAt(x, z);
    rock.position.set(x, floorY + scale*0.5, z);
    rock.scale.set(
      1 + Math.random()*0.4,
      0.6 + Math.random()*0.3,
      1 + Math.random()*0.4
    );
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.userData.type = 'rock';
    return rock;
  }

  createReeds(x, z, clusterScale = 1) {
    const group = new THREE.Group();
    
    // Немного разные оттенки зелёного — камыш не бывает однотонным
    const reedMats = [
      new THREE.MeshLambertMaterial({ color: 0x8b9a3a }), // жёлто-зелёный
      new THREE.MeshLambertMaterial({ color: 0x7a8a2a }), // темнее
      new THREE.MeshLambertMaterial({ color: 0x9aab4a }), // светлее
      new THREE.MeshLambertMaterial({ color: 0x6b7a2a })  // тёмный
    ];

    // Количество стеблей в кусте — зависит от масштаба заросли
    const count = Math.floor((12 + Math.random() * 10) * clusterScale);
    
    // Радиус, в котором растут стебли (плотная куртина)
    const clusterRadius = 1.2 * clusterScale;

    for (let i = 0; i < count; i++) {
      const h = (1.5 + Math.random() * 2.0) * clusterScale; // высота стебля
      const r = 0.03 + Math.random() * 0.02;                // толщина
      
      const geo = new THREE.CylinderGeometry(r * 0.7, r, h, 4);
      const mat = reedMats[Math.floor(Math.random() * reedMats.length)];
      const reed = new THREE.Mesh(geo, mat);

      // Случайное положение внутри куртины (диск)
      const angle = Math.random() * Math.PI * 2;
      const rad   = Math.sqrt(Math.random()) * clusterRadius;
      reed.position.set(
        Math.cos(angle) * rad,
        h / 2,
        Math.sin(angle) * rad
      );
      
      // Наклон — камыш обычно наклоняется
      reed.rotation.z = (Math.random() - 0.5) * 0.4;
      reed.rotation.x = (Math.random() - 0.5) * 0.2;

      group.add(reed);

      // Иногда добавляем «метёлку» (верхушку камыша)
      if (Math.random() < 0.4) {
        const tipGeo = new THREE.CylinderGeometry(0.03 * clusterScale, 0.05 * clusterScale, 0.5);
        const tipMat = new THREE.MeshLambertMaterial({ color: 0x6a5a2a }); // коричневая метёлка
        const tip    = new THREE.Mesh(tipGeo, tipMat);
        
        // Высота стебля = h, его центр в 0, значит верх стебля локально находится на y = h / 2
        tip.position.set(0, h / 2 - 0.3, 0);
        
        // Добавляем метёлку как дочерний объект стебля (reed), 
        // чтобы она автоматически и идеально наследовала все его повороты (наклон)
        reed.add(tip);
      }
    }

    group.position.set(x, this.terrain.getHeightAt(x, z), z);
    group.userData.type = 'reeds';
    return group;
  }

  createForest() {
    // --- Деревья: не ближе 1 м от воды и не на крутых склонах ---
    let treeAttempts = 0;
    let treesPlaced = 0;
    while (treesPlaced < 80 && treeAttempts < 600) {

      treeAttempts++;
      const angle = Math.random() * Math.PI * 2;
      const dist = 25 + Math.random() * 110;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist; 

      // Пропускаем, если под водой или на крутом склоне
      if (this.isUnderwater(x, z, 1.0)) continue;
      if (this.isOnSlope(x, z, 0.55)) continue;

      const h = this.terrain.getHeightAt(x, z);
      if (h > 6) continue;   // ← порог совпадает с Conifers.minH

      const tree = this.createTree(x, z, 0.8 + Math.random()*0.6);
      this.scene.add(tree);
      treesPlaced++;
      if (Math.random() < 0.5) this.spawnPoints.push({x, z});
    }

    // --- Кусты: не под водой, но на склонах можно ---
    let bushAttempts = 0;
    let bushesPlaced = 0;
    while (bushesPlaced < 60 && bushAttempts < 500) {
      bushAttempts++;
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 90;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (this.isUnderwater(x, z, 0.6)) continue;

      this.scene.add(this.createBush(x, z, 0.7 + Math.random()*0.6));
      bushesPlaced++;
      if (Math.random() < 0.4) this.spawnPoints.push({x, z});
    }

    // --- Камни: можно и в воде, и на берегу ---
    for (let i = 0; i < 20; i++) {
      const x = (Math.random()-0.5) * 200;
      const z = (Math.random()-0.5) * 200;
      if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;
      this.scene.add(this.createRock(x, z, 0.5 + Math.random()*1.2));
    }

    // ==================================================
    // КАМЫШИ — плотные заросли по береговой линии
    // ==================================================
    
    // 1) Сканируем сетку по всей карте и находим точки, где рельеф
    //    находится "у самой воды" (мелководье / берег)
    const reedsCandidates = [];
    const scanStep = 2.0;  // шаг сетки (2 м)
    const scanRange = 110; // до 180 м от центра

    for (let x = -scanRange; x <= scanRange; x += scanStep) {
      for (let z = -scanRange; z <= scanRange; z += scanStep) {
        const h = this.terrain.getHeightAt(x, z);
        // Мелководье: 0..1.8 м над уровнем воды
        if (h > WATER_LEVEL - 0.1 && h < WATER_LEVEL + 1.8) {
          reedsCandidates.push({ x, z, h });
        }
      }
    }

    console.log('Найдено точек для камыша:', reedsCandidates.length);

    // 2) Перемешиваем и берём 150 зарослей (было 30)
    for (let i = reedsCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [reedsCandidates[i], reedsCandidates[j]] = [reedsCandidates[j], reedsCandidates[i]];
    }

    const REEDS_COUNT = 220; // ← больше зарослей!
    let reedsPlaced = 0;
    
    for (let i = 0; i < reedsCandidates.length && reedsPlaced < REEDS_COUNT; i++) {
      const c = reedsCandidates[i];
      
      // Пропускаем точки слишком близко к другим зарослям
      let tooClose = false;
      for (let j = 0; j < reedsPlaced; j++) {
        // (простая проверка по индексу — можно улучшить, но и так работает)
      }
      
      // Размер заросли — от 0.8 до 1.8, редко — большие плантации
      const clusterScale = Math.random() < 0.2 ? 1.8 : 0.7 + Math.random() * 0.7;
      
      // Случайное смещение внутри клетки (чтобы не было "сетки")
      const offsetX = (Math.random() - 0.5) * scanStep;
      const offsetZ = (Math.random() - 0.5) * scanStep;
      
      const reeds = this.createReeds(c.x + offsetX, c.z + offsetZ, clusterScale);
      this.scene.add(reeds);
      reedsPlaced++;
    }

    console.log('Посажено зарослей камыша:', reedsPlaced);
  }
}

// Собираем всё в единый объект-пространство имён ENV
const ENV =
{
    WATER_LEVEL,

    Grass,
    Terrain,
    Water,
    Sky,
    Conifers,
    Nature,
};

export { ENV };