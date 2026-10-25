// gun-viewer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * GunViewer — модуль для просмотра Three.js-моделей оружия.
 *
 * Использование:
 *   const viewer = new GunViewer({ canvas, dropZone, statusEl, defaultModelUrl });
 *   await viewer.loadFromUrl('./gun-model.js');
 *   await viewer.loadFromText(text);
 */
export class GunViewer {
  static SIZE = 10;
  static STEP = 0.5;

  /**
   * @param {Object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {HTMLElement} [opts.dropZone]
   * @param {HTMLElement} [opts.statusEl]
   * @param {HTMLElement} [opts.resetBtn]
   * @param {HTMLElement} [opts.themeToggle]
   * @param {string} [opts.defaultModelUrl] — URL модели, которая грузится автоматически
   * @param {boolean} [opts.autoLoad=true] — грузить ли defaultModelUrl при старте
   */
  constructor(opts = {}) {
    if (!opts.canvas) throw new Error('GunViewer: canvas обязателен');

    this.canvas = opts.canvas;
    this.dropZone = opts.dropZone || null;
    this.statusEl = opts.statusEl || null;
    this.resetBtn = opts.resetBtn || null;
    this.themeToggle = opts.themeToggle || null;
    this.defaultModelUrl = opts.defaultModelUrl || null;

    /// +
    this.canvas    = opts.canvas;
    this.container = opts.container || this.canvas.parentElement;
    this.dropZone  = opts.dropZone || null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.gunGroup = null;
    this.gridHelper = null;
    this.axesGroup = null;

    this.isLightTheme = false;

    this.module = null;
    this.moduleBlobUrl = null;
    this.applyParams = null;

    this._init();
    if (this.dropZone) this._setupDrop();
    if (this.themeToggle) this._setupThemeToggle();
    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => {
        if (this.gunGroup) this._fitToScene();
      });
    }

    // Автозагрузка модели по умолчанию
    if (opts.autoLoad !== false && this.defaultModelUrl) {
      this.loadFromUrl(this.defaultModelUrl).catch(e => {
        console.error('Автозагрузка модели не удалась:', e);
      });
    }
  }

  _init() {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(0x0a0a18, 6, 30);

    const w = window.innerWidth;
    const h = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 200);
    this.camera.position.set(2, 2, 4);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x000000, 0);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.zoomSpeed = 0.6;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    this.scene.add(new THREE.HemisphereLight(0x00ffff, 0x440044, 0.8));

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(4, 8, 6);
    this.scene.add(dirLight);

    const neonLight = new THREE.PointLight(0x00ffff, 2, 12);
    neonLight.position.set(-3, 2, -2);
    this.scene.add(neonLight);

    this.gridHelper = new THREE.GridHelper(
      GunViewer.SIZE,
      GunViewer.SIZE / GunViewer.STEP,
      0x003333, 0x003333
    );
    this.gridHelper.position.y = -0.001;
    this.scene.add(this.gridHelper);

    this.axesGroup = new THREE.Group();
    this.axesGroup.name = 'mainAxes';
    this.scene.add(this.axesGroup);
    this._buildMainAxes();

    // ...
    this._checkBrowserZoom();
    
    // Также полезно проверять при изменении размера окна
    window.addEventListener('resize', () => {
      this._onResize();
      this._checkBrowserZoom();
    });

    this._animate();
  }

    _onResize() {
    if (this._isInlineViewport) {
        this._syncRendererToViewport();
        return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.camera.aspect === w / h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);

    this._updateZoomSensitivity();
    }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  _setupThemeToggle() {
    this.themeToggle.addEventListener('click', () => {
      this.isLightTheme = !this.isLightTheme;
      document.body.classList.toggle('light-theme', this.isLightTheme);
      this.themeToggle.textContent = this.isLightTheme ? '☀️' : '🌙';
      this._updateSceneTheme();
    });
  }

  _updateSceneTheme() {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      if (Array.isArray(this.gridHelper.material)) {
        this.gridHelper.material.forEach(m => m.dispose());
      } else {
        this.gridHelper.material.dispose();
      }
      this.gridHelper = null;
    }

    if (this.isLightTheme) {
      this.scene.fog.color.setHex(0xe8dcc0);
      this.gridHelper = new THREE.GridHelper(
        GunViewer.SIZE, GunViewer.SIZE / GunViewer.STEP, 0xa67c52, 0xa67c52);
    } else {
      this.scene.fog.color.setHex(0x0a0a18);
      this.gridHelper = new THREE.GridHelper(
        GunViewer.SIZE, GunViewer.SIZE / GunViewer.STEP, 0x003333, 0x003333);
    }
    this.gridHelper.position.y = -0.001;
    this.gridHelper.material.fog = false;
    this.scene.add(this.gridHelper);

    this._buildMainAxes();
  }

  // ============================================================
  // Загрузка по URL
  // ============================================================
  async loadFromUrl(url) {
    this._setStatus('ЗАГРУЗКА МОДЕЛИ...', '');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} при загрузке ${url}`);
      const text = await res.text();
      await this.loadFromText(text, url);
    } catch (e) {
      console.error(e);
      this._setStatus('ОШИБКА: ' + e.message, 'error');
      throw e;
    }
  }

  // ============================================================
  // Загрузка из строки (Blob ES-модуль)
  // ============================================================
  async loadFromText(text, sourceLabel = '') {
    try {
      if (this.gunGroup) {
        this.scene.remove(this.gunGroup);
        this._disposeGun(this.gunGroup);
        this.gunGroup = null;
      }
      if (this.moduleBlobUrl) {
        URL.revokeObjectURL(this.moduleBlobUrl);
        this.moduleBlobUrl = null;
      }
      this.module = null;
      this.applyParams = null;

      const blob = new Blob([text], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      this.moduleBlobUrl = url;

      const mod = await import(/* @vite-ignore */ url);
      this.module = mod;

      console.log('Модуль загружен. Экспорты:', Object.keys(mod));
      console.log('GUN_PARAMS:', this._formatParams(mod.GUN_PARAMS));

      if (typeof mod.buildGun !== 'function') {
        throw new Error('В файле не найден экспорт buildGun');
      }

      const root = mod.buildGun(null);
      if (!root || !root.isObject3D) {
        throw new Error('buildGun вернула не Object3D');
      }

      const gun = root.isGroup ? root : (() => {
        const g = new THREE.Group();
        g.add(root);
        return g;
      })();

      let meshCount = 0;
      gun.traverse(o => { if (o.isMesh) meshCount++; });
      if (meshCount === 0) throw new Error('Группа не содержит мешей');

      this.gunGroup = gun;
      this.scene.add(gun);

      if (typeof mod.applyParams === 'function') {
        this.applyParams = mod.applyParams;
      }

      requestAnimationFrame(() => this._fitToScene());

      const src = sourceLabel ? ` // ${sourceLabel}` : '';
      this._setStatus(`МОДЕЛЬ ЗАГРУЖЕНА // МЕШЕЙ: ${meshCount}${src}`, 'success');

      if (this.applyParams && mod.GUN_PARAMS) {
        try {
          this.applyParams(gun, mod.GUN_PARAMS);
          console.log('applyParams применён при загрузке');
        } catch (e) {
          console.warn('applyParams при загрузке упал:', e);
        }
      }
    } catch (e) {
      console.error(e);
      this._setStatus('ОШИБКА: ' + e.message, 'error');
      throw e;
    }
  }

  _formatParams(params) {
    if (!params) return null;
    const out = {};
    for (const k in params) {
      const v = params[k];
      out[k] = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
    }
    return out;
  }

  _disposeGun(group) {
    if (this.module && typeof this.module.dispose === 'function') {
      try {
        this.module.dispose(group);
        return;
      } catch (e) {
        console.warn('module.dispose упал, используем fallback:', e);
      }
    }
    this._disposeGroup(group);
  }

  _disposeGroup(group) {
    group.traverse(o => {
      if (o.isMesh) {
        if (Array.isArray(o.material)) {
          o.material.forEach(m => m.dispose && m.dispose());
        } else if (o.material && o.material.dispose) {
          o.material.dispose();
        }
        if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      }
    });
  }

      _fitToScene() {
        if (!this.gunGroup) return;

        const box = new THREE.Box3().setFromObject(this.gunGroup);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim === 0) return;

        const fov = this.camera.fov * (Math.PI / 180);
        const fitHeightDistance = maxDim / (2 * Math.tan(fov / 2));
        const fitWidthDistance = fitHeightDistance / this.camera.aspect;
        const distance = 1.6 * Math.max(fitHeightDistance, fitWidthDistance, maxDim);

        const dir = new THREE.Vector3(0.3, 0.5, 1).normalize();
        this.camera.position.copy(center).addScaledVector(dir, distance);

        this.camera.near = Math.max(distance / 1000, 0.01);
        this.camera.far = distance * 50;
        this.camera.updateProjectionMatrix();
        this.camera.lookAt(center);

        this.controls.target.copy(center);
        this.controls.update();

        this.scene.fog.near = distance * 0.8;
        this.scene.fog.far  = distance * 4;
      }

  _setStatus(msg, type = '') {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.className = '';
    if (type) this.statusEl.classList.add(type);
  }

  _setupDrop() {
    const dropZone = this.dropZone;
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(name => {
      dropZone.addEventListener(name, e => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });

    dropZone.addEventListener('dragenter', () => dropZone.classList.add('dragover'));
    dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      dropZone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files && files.length > 0) this._readFile(files[0]);
    });

    dropZone.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.js';
      input.onchange = e => {
        const files = e.target.files;
        if (files.length > 0) this._readFile(files[0]);
      };
      input.click();
    });
  }

  _readFile(file) {
    this._setStatus('ЧТЕНИЕ ФАЙЛА...', '');
    const reader = new FileReader();
    reader.onload = evt => this.loadFromText(evt.target.result, file.name);
    reader.onerror = () => this._setStatus('ОШИБКА ЧТЕНИЯ ФАЙЛА', 'error');
    reader.readAsText(file);
  }

  _buildMainAxes() {
    if (!this.axesGroup) {
      this.axesGroup = new THREE.Group();
      this.axesGroup.name = 'mainAxes';
      this.scene.add(this.axesGroup);
    }

    while (this.axesGroup.children.length > 0) {
      const child = this.axesGroup.children.pop();
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }

    const isLight = this.isLightTheme;
    const xColor = isLight ? 0xd84315 : 0xff3b30;
    const zColor = isLight ? 0x1565c0 : 0x00aaff;

    const len = GunViewer.SIZE;
    const thickness = 0.003;
    const arrowLen = 0.35;
    const arrowRadius = 0.06;

    const createMat = color => new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.8,
      metalness: 0.3, roughness: 0.4,
    });

    // X
    const xMat = createMat(xColor);
    const xGroup = new THREE.Group();
    const xCyl = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness, len, 6), xMat);
    xCyl.rotation.z = -Math.PI / 2;
    xGroup.add(xCyl);
    const xCone = new THREE.Mesh(new THREE.ConeGeometry(arrowRadius, arrowLen, 8), xMat);
    xCone.rotation.z = -Math.PI / 2;
    xCone.position.x = len / 2;
    xGroup.add(xCone);
    xGroup.position.set(0, 0.002, 0);
    this.axesGroup.add(xGroup);

    // Z
    const zMat = createMat(zColor);
    const zGroup = new THREE.Group();
    const zCyl = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness, len, 6), zMat);
    zCyl.rotation.x = Math.PI / 2;
    zGroup.add(zCyl);
    const zCone = new THREE.Mesh(new THREE.ConeGeometry(arrowRadius, arrowLen, 8), zMat);
    zCone.rotation.x = Math.PI / 2;
    zCone.position.z = len / 2;
    zGroup.add(zCone);
    zGroup.position.set(0, 0.002, 0);
    this.axesGroup.add(zGroup);
  }

  _checkBrowserZoom() {
    // Сравниваем физическое разрешение и CSS-разрешение
    const isZoomed = window.devicePixelRatio !== 1 || 
                     Math.abs(window.innerWidth / document.documentElement.clientWidth - 1) > 0.01;
    
    if (isZoomed && this.statusEl) {
      this._setStatus('⚠️ Для корректной работы 3D установите масштаб браузера на 100% (Ctrl + 0)', 'warning');
      
      // Автоматически скрываем сообщение через 5 секунд
      setTimeout(() => {
        if (this.statusEl && this.statusEl.textContent.includes('100%')) {
          this.statusEl.textContent = '';
        }
      }, 5000);
    }
  }

  _updateZoomSensitivity() {
    // Базовая скорость (например, 0.5), деленная на текущий масштаб браузера
    // Если масштаб 150% (dPR = 1.5), скорость станет 0.33, что компенсирует рывок
    const baseSpeed = 0.5; 
    this.controls.zoomSpeed = baseSpeed / window.devicePixelRatio;
  }

    /**
     * Превращает вьюер в «плашку» заданного размера относительно окна.
     * @param {number} widthVw  — ширина в vw (например, 60 = 60% видимой части)
     * @param {number} heightVh — высота в vh
     */
    setViewport(widthVw = 60, heightVh = 60) {
    if (!this.container) return;

    // Запоминаем исходные классы/стили, чтобы вернуть обратно
    if (!this._savedStyle) {
        this._savedStyle = {
        container: this.container.getAttribute('style') || '',
        canvas: this.canvas.getAttribute('style') || '',
        };
    }

    // Плашка
    Object.assign(this.container.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: widthVw + 'vw',
        height: heightVh + 'vh',
        borderRadius: '16px',
        border: '2px solid var(--neon-color)',
        boxShadow: '0 0 40px var(--neon-glow)',
        overflow: 'hidden',
        zIndex: '1000',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
    });
    Object.assign(this.canvas.style, {
        width: '100%',
        height: '100%',
        display: 'block',
    });

    // Затемнение фона — отдельный оверлей, чтобы не ломать разметку
    if (!this._backdrop) {
        this._backdrop = document.createElement('div');
        Object.assign(this._backdrop.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0, 0, 0, 0.55)',
        zIndex: '999',
        transition: 'opacity 0.2s ease',
        });
        // Клик по фону — вернуть полноэкранный режим
        this._backdrop.addEventListener('click', () => this.resetViewport());
        document.body.appendChild(this._backdrop);
    }
    this._backdrop.style.opacity = '1';
    this._backdrop.style.pointerEvents = 'auto';

    // Прячем кнопки, чтобы не наезжали на плашку
    if (this.resetBtn) this.resetBtn.style.display = 'none';
    if (this.themeToggle) this.themeToggle.style.display = 'none';
    if (this.dropZone) this.dropZone.style.display = 'none';
    if (this.statusEl) this.statusEl.style.display = 'none';

    // Пересчитать рендерер под новый размер
    this._syncRendererToViewport();
    this._isInlineViewport = true;
    }

    /** Возвращает полноэкранный режим. */
    resetViewport() {
    if (!this.container) return;

    if (this._backdrop) {
        this._backdrop.remove();
        this._backdrop = null;
    }

    if (this._savedStyle) {
        if (this._savedStyle.container)
            this.container.setAttribute('style', this._savedStyle.container);

        else this.container.removeAttribute('style');

        if ( this._savedStyle.canvas)
             this.canvas.setAttribute('style', this._savedStyle.canvas);

        else this.canvas.removeAttribute('style');

        this._savedStyle = null;
    }

    if (this.resetBtn) this.resetBtn.style.display = '';
    if (this.themeToggle) this.themeToggle.style.display = '';
    if (this.dropZone) this.dropZone.style.display = '';
    if (this.statusEl) this.statusEl.style.display = '';

    this._isInlineViewport = false;

    this._syncRendererToViewport();
    }

    /** Синхронизирует размеры рендерера с текущим размером контейнера. */
    _syncRendererToViewport() {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));

    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    if (this.gunGroup) this._fitToScene();
    }
}