// render/renderer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const TILE = 1.0;

const easeOutCubic  = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => t < 0.5
  ? 4 * t * t * t
  : 1 - Math.pow(-2 * t + 2, 3) / 2;

export class Renderer {
  constructor(container) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = this._buildSky();

    this.cameraOrbit = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    this.cameraOrbit.position.set(30, 45, 45);

    this.cameraTop = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
    this.cameraTop.position.set(0, 100, 0);
    this.cameraTop.up.set(0, 0, -1);
    this.cameraTop.lookAt(0, 0,  0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.cameraOrbit, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(15);
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(85);
    this.controls.minDistance   = 4;
    this.controls.maxDistance   = 400;
    this.controls.mouseButtons  = {
      LEFT  : THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT : THREE.MOUSE.ROTATE,
    };

    this.mode = 'orbit';

    // состояние анимации фокуса
    this._focusAnim = null;

    // временные векторы для анимации (без аллокаций каждый кадр)
    this._tmpOldTarget = new THREE.Vector3();
    this._tmpDelta     = new THREE.Vector3();

    this._buildLights();
  }

  /**
   * Полностью освободить WebGL-контекст.
   * dispose() сам по себе НЕ освобождает контекст — нужен forceContextLoss(),
   * иначе браузер копит активные контексты и пишет
   * "Too many active WebGL contexts".
   */
  dispose() {
    this._focusAnim = null;
    this.controls?.dispose?.();
    this.scene?.background?.dispose?.();
    this.scene?.clear?.();
    const gl = this.renderer;
    if (gl) {
      gl.dispose?.();
      gl.forceContextLoss?.();
      gl.domElement?.remove?.();
    }
    this.renderer = null;
    this.controls = null;
  }

  /** Мягкий вертикальный градиент неба вместо плоской заливки. */
  _buildSky() {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#16283a');
    grad.addColorStop(0.45, '#0d1622');
    grad.addColorStop(1.0, '#05080c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 256);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildLights() {
    // Мягкий свет неба/земли — заполняет тени и добавляет объём.
    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a2a1a, 0.55);
    this.scene.add(hemi);

    // Тёплое солнце. Тень от него падает под 45° по горизонтали и
    // поднимается под 45° над горизонтом (см. setupWorldLighting).
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.03;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 500;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    // Холодный контровой свет с противоположной стороны — силуэты
    // не сливаются с фоном, но тени не отбрасывает.
    const rim = new THREE.DirectionalLight(0x88aaff, 0.35);
    rim.position.set(80, 60, 90);
    this.scene.add(rim);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.12));
  }

  /**
   * Настроить солнце и его теневую камеру под размер мира.
   * Свет ставится так, чтобы тени ложились диагонально под 45°
   * при высоте солнца 45° над горизонтом.
   * @param {number} worldW — ширина мира в клетках
   * @param {number} worldH — высота мира в клетках
   */
  setupWorldLighting(worldW, worldH) {
    const sun = this.sun;
    if (!sun) return;

    const span = Math.max(worldW || 1, worldH || 1) * TILE;
    const radius = span * 0.85 + 8;

    // 45° азимут (диагональ карты) + 45° высота над горизонтом.
    const horiz = radius * 1.5;
    const diag = Math.SQRT1_2;
    sun.position.set(-horiz * diag, horiz, -horiz * diag);
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();

    const cam = sun.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 0.5;
    cam.far = horiz * 2.5;
    cam.updateProjectionMatrix();

    // Крупные карты требуют большего разрешения теневой карты.
    const size = span > 60 ? 4096 : 2048;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  }

  setCameraMode(mode) {
    this.mode = mode;
    this.controls.enabled = mode === 'orbit';
    // прерываем активную анимацию фокуса при смене камеры
    this._focusAnim = null;
  }

  _frameOrbit(span) {
    this.controls.target.set(0, 0, 0);
    this.cameraOrbit.position.set(span * 0.55, span * 0.9, span * 0.55);
    this.controls.update();
  }

  /**
   * Подбирает позицию орбитальной камеры так, чтобы карта целиком
   * помещалась в кадр (занимала максимум экрана) и была отцентрована.
   * Возвращает target, направление и дистанцию.
   */
  _computeOrbitFit(worldW, worldH) {
    const w = worldW * TILE, h = worldH * TILE;
    const yTop = 2.5; // запас по высоте под горы/города

    const corners = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        for (const y of [0, yTop])
          corners.push(new THREE.Vector3(sx * w / 2, y, sz * h / 2));

    const target = new THREE.Vector3(0, 0, 0);
    const dir = new THREE.Vector3(0.55, 0.9, 0.55).normalize();
    const cam = this.cameraOrbit;

    const aspect = window.innerWidth / window.innerHeight;
    if (cam.aspect !== aspect) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }

    const margin = 0.92; // карта чуть отступает от краёв экрана
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    let d = Math.max(w, h) * 1.2;

    const v = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();

    // подгоняем дистанцию + сдвигаем target, чтобы карта была по центру
    for (let iter = 0; iter < 6; iter++) {
      for (let i = 0; i < 80; i++) {
        cam.position.copy(target).addScaledVector(dir, d);
        cam.lookAt(target);
        cam.updateMatrixWorld(true);

        let maxAbs = 0;
        for (const p of corners) {
          v.copy(p).project(cam);
          maxAbs = Math.max(maxAbs, Math.abs(v.x), Math.abs(v.y));
        }

        if (!isFinite(maxAbs) || maxAbs <= 0) break;
        if (Math.abs(maxAbs - margin) < 0.001) break;
        d *= maxAbs / margin;
      }

      cam.position.copy(target).addScaledVector(dir, d);
      cam.lookAt(target);
      cam.updateMatrixWorld(true);

      let xmin = Infinity, xmax = -Infinity;
      let ymin = Infinity, ymax = -Infinity;
      for (const p of corners) {
        v.copy(p).project(cam);
        xmin = Math.min(xmin, v.x); xmax = Math.max(xmax, v.x);
        ymin = Math.min(ymin, v.y); ymax = Math.max(ymax, v.y);
      }

      const cx = (xmin + xmax) / 2;
      const cy = (ymin + ymax) / 2;
      if (Math.abs(cx) < 0.005 && Math.abs(cy) < 0.005) break;

      right.setFromMatrixColumn(cam.matrixWorld, 0);
      up.setFromMatrixColumn(cam.matrixWorld, 1);
      const halfH = d * tanV;
      const halfW = halfH * aspect;
      target.addScaledVector(right, cx * halfW);
      target.addScaledVector(up, cy * halfH);
    }

    return { target, dir, distance: d };
  }

  /**
   * Вступительная анимация: камера стартует далеко от карты и плавно
   * подлетает к ней так, чтобы карта заняла весь экран.
   * @param {number} worldW — ширина мира в клетках
   * @param {number} worldH — высота мира в клетках
   * @param {object} [opts]
   * @param {number} [opts.duration=2000]  — длительность полёта, мс
   * @param {number} [opts.startScale=5]   — во сколько раз дальше стартовая дистанция
   * @param {number} [opts.delay=400]      — пауза «вдалеке» перед подлётом, мс
   */
  flyInToMap(worldW, worldH, { duration = 2000, startScale = 5, delay = 400 } = {}) {
    const fit = this._computeOrbitFit(worldW, worldH);
    const { target, dir } = fit;

    const fromDist = fit.distance * startScale;
    const from = target.clone().addScaledVector(dir, fromDist);

    // стартовая дистанция может выходить за текущий лимит OrbitControls —
    // расширяем его, иначе controls.update() обрежет «далёкий» старт.
    // Запас ×1.7 — чтобы колесом можно было отъехать ещё дальше.
    this.controls.maxDistance = Math.max(
      this.controls.maxDistance,
      fromDist * 1.7,
    );

    // и за дальнюю плоскость камеры, иначе карта на старте отсечётся.
    const farNeeded = fromDist * 1.7 + Math.max(worldW, worldH) * TILE * 2;
    if (this.cameraOrbit.far < farNeeded) {
      this.cameraOrbit.far = farNeeded;
      this.cameraOrbit.updateProjectionMatrix();
    }

    this.controls.target.copy(target);
    this.cameraOrbit.position.copy(from);
    this.cameraOrbit.lookAt(target);
    this.controls.update();

    this._focusAnim = {
      kind: 'fly',
      target: target.clone(),
      dir: dir.clone(),
      fromDist,
      toDist: fit.distance,
      zoomFactor: 1,
      t: 0, dur: duration, delay,
      ease: easeInOutCubic,
    };
  }

  _fitTopCamera(worldW, worldH) {
    const w = worldW * TILE, h = worldH * TILE;
    const aspect = window.innerWidth / window.innerHeight;
    const pad = 1.1;
    let fw = w * pad, fh = h * pad;
    if (fw / fh < aspect) fw = fh * aspect; else fh = fw / aspect;
    const cam = this.cameraTop;
    cam.left = -fw / 2; cam.right = fw / 2;
    cam.top = fh / 2; cam.bottom = -fh / 2;
    cam.near = 0.1; cam.far = 1000;
    cam.position.set(0, Math.max(w, h) * 1.2, 0);
    cam.up.set(0, 0, -1);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }

  /**
   * Плавно фокусируется на мировой точке (wx, wy, wz).
   * - В orbit-режиме сдвигает controls.target и камеру так, чтобы точка
   *   оказалась в центре; дистанция и углы сохраняются.
   * - В top-режиме центрирует ортокамеру на этой точке.
   */
  focusOnPoint(wx, wy, wz, duration = 450) {
    if (this.mode === 'orbit') {
      // панорамирование: двигаем только pivot, а камеру — на ту же дельту.
      // Дистанция и наклон при этом не фиксируются, поэтому зум колесом
      // продолжает работать во время анимации.
      this._focusAnim = {
        kind: 'pan',
        fromT: this.controls.target.clone(),
        toT: new THREE.Vector3(wx, wy, wz),
        t: 0, dur: duration,
      };
      return;
    }

    // top-камера: центрируем по (wx, wz)
    const cam = this.cameraTop;
    const from = cam.position.clone();
    const to = new THREE.Vector3(wx, cam.position.y, wz);
    this._focusAnim = {
      topFrom: from, topTo: to,
      t: 0, dur: duration,
    };
  }

  _stepFocusAnim(dtMs) {
    const a = this._focusAnim;
    if (!a) return;

    a.t += dtMs;
    const delay = a.delay ?? 0;
    const k = Math.min(1, Math.max(0, (a.t - delay) / a.dur));
    const e = (a.ease ?? easeOutCubic)(k);

    if (a.topFrom) {
      // top-камера
      const cam = this.cameraTop;
      cam.position.lerpVectors(a.topFrom, a.topTo, e);
      cam.lookAt(cam.position.x, 0, cam.position.z);
    } else if (a.kind === 'fly') {
      // подлёт: меняем дистанцию вдоль фиксированного направления.
      // zoomFactor учитывает колесо, покрученное во время полёта.
      const dist = (a.fromDist + (a.toDist - a.fromDist) * e) * (a.zoomFactor ?? 1);
      this.controls.target.copy(a.target);
      this.cameraOrbit.position.copy(a.target).addScaledVector(a.dir, dist);
      this.controls.update();
    } else {
      // панорамирование: двигаем pivot, камеру — на ту же дельту.
      // Так сохраняется текущая дистанция (в т.ч. только что изменённая зумом).
      this._tmpOldTarget.copy(this.controls.target);
      this.controls.target.lerpVectors(a.fromT, a.toT, e);
      this._tmpDelta.copy(this.controls.target).sub(this._tmpOldTarget);
      this.cameraOrbit.position.add(this._tmpDelta);
      this.controls.update();
    }

    if (k >= 1) this._focusAnim = null;
  }

  onResize(worldW, worldH) {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.cameraOrbit.aspect = w / h;
    this.cameraOrbit.updateProjectionMatrix();
    if (worldW && worldH) this._fitTopCamera(worldW, worldH);
  }

  render(dtMs = 0) {
    const cam = this.mode === 'top' ? this.cameraTop : this.cameraOrbit;
    this.renderer.render(this.scene, cam);
  }

  get domElement() { return this.renderer.domElement; }
}