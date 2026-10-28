// render/renderer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const TILE = 1.0;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export class Renderer {
  constructor(container) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0f14);

    this.cameraOrbit = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    this.cameraOrbit.position.set(30, 45, 45);

    this.cameraTop = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
    this.cameraTop.position.set(0, 100, 0);
    this.cameraTop.up.set(0, 0, -1);
    this.cameraTop.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.cameraOrbit, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(15);
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(85);
    this.controls.minDistance = 4;
    this.controls.maxDistance = 400;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    this.mode = 'orbit';

    // состояние анимации фокуса
    this._focusAnim = null;

    this._buildLights();
  }

  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(60, 100, 40);
    this.scene.add(dir);
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
      const targetFrom = this.controls.target.clone();
      const camFrom = this.cameraOrbit.position.clone();
      const targetTo = new THREE.Vector3(wx, wy, wz);
      const delta = targetTo.clone().sub(targetFrom);
      const camTo = camFrom.clone().add(delta);

      this._focusAnim = {
        fromT: targetFrom, toT: targetTo,
        fromC: camFrom,    toC: camTo,
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
    const k = Math.min(1, a.t / a.dur);
    const e = easeOutCubic(k);

    if (a.topFrom) {
      // top-камера
      const cam = this.cameraTop;
      cam.position.lerpVectors(a.topFrom, a.topTo, e);
      cam.lookAt(cam.position.x, 0, cam.position.z);
    } else {
      // orbit-камера
      this.controls.target.lerpVectors(a.fromT, a.toT, e);
      this.cameraOrbit.position.lerpVectors(a.fromC, a.toC, e);
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
    this._stepFocusAnim(dtMs);
    const cam = this.mode === 'top' ? this.cameraTop : this.cameraOrbit;
    this.renderer.render(this.scene, cam);
  }

  get domElement() { return this.renderer.domElement; }
}