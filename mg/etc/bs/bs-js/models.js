//  models.js
//  class SceneModel — универсальный держатель GLB-модели на террейне.

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class SceneModel {
  /**
   * @param {Object}  opts
   * @param {THREE.Scene}  opts.scene
   * @param {Object}       opts.terrain         — с getHeightAt(x, z)
   * @param {string}       opts.url             — путь к .glb / .gltf
   * @param {number}       opts.x               — позиция по X (мир)
   * @param {number}       opts.z               — позиция по Z (мир)
   * @param {number}       [opts.yawDeg=0]      — поворот по вертикали (градусы)
   * @param {number}       [opts.pitchDeg=0]    — наклон вперёд/назад
   * @param {number}       [opts.rollDeg=0]     — крен
   * @param {number}       [opts.scale=1]       — общий масштаб модели
   * @param {number}       [opts.yOffset=0]     — доп. смещение по Y (после посадки на землю)
   * @param {boolean}      [opts.alignToNormal=false] — наклонять модель по нормали рельефа
   * @param {boolean}      [opts.castShadow=true]
   * @param {boolean}      [opts.receiveShadow=true]
   * @param {Function}     [opts.onLoad]        — (model) => void после загрузки
   * @param {Function}     [opts.onError]       — (err) => void
   */
  constructor(opts) {
    this.scene   = opts.scene;
    this.terrain = opts.terrain;
    this.url     = opts.url;

    this.x = opts.x ?? 0;
    this.z = opts.z ?? 0;
    this.yawDeg   = opts.yawDeg   ?? 0;
    this.pitchDeg = opts.pitchDeg ?? 0;
    this.rollDeg  = opts.rollDeg  ?? 0;
    this.scale    = opts.scale    ?? 1;
    this.yOffset  = opts.yOffset  ?? 0;

    this.alignToNormal = !!opts.alignToNormal;
    this.castShadow    = opts.castShadow    ?? true;
    this.receiveShadow = opts.receiveShadow ?? true;

    this.onLoad  = opts.onLoad  || null;
    this.onError = opts.onError || null;

    // Заполняется после load()
    this.root   = null;   // THREE.Group — корень (сюда вставляется gltf.scene)
    this.model  = null;   // исходный gltf.scene (внутри root)
    this.mixer  = null;   // AnimationMixer, если есть анимации
    this.actions = {};    // имя клипа -> AnimationAction

    this._loaded   = false;
    this._visible  = true;
    this._disposed = false;

    // Общие настройки загрузчика — один на класс
    SceneModel._loader = SceneModel._loader || new GLTFLoader();
  }

  /** Загрузка + постановка на террейн. Возвращает Promise<SceneModel>. */
  load() {
    if (this._loaded) return Promise.resolve(this);

    const loader = SceneModel._loader;

    return new Promise((resolve, reject) => {
      loader.load(
        this.url,
        (gltf) => {
          try {
            this._onGltfLoaded(gltf);
            resolve(this);
          } catch (e) {
            this._handleError(e);
            reject(e);
          }
        },
        undefined,
        (err) => {
          this._handleError(err);
          reject(err);
        }
      );
    });
  }

  _handleError(err) {
    console.error("[SceneModel] load error:", this.url, err);
    if (typeof this.onError === "function") this.onError(err);
  }

  _onGltfLoaded(gltf) {
    // Внешний контейнер — сюда мы пишем позицию/поворот/масштаб.
    this.root = new THREE.Group();
    this.root.name = `SceneModel:${this.url}`;

    // Сам gltf.scene держим как есть — его локальные трансформации не трогаем.
    this.model = gltf.scene;

    // Тени
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow    = this.castShadow;
        o.receiveShadow = this.receiveShadow;
      }
    });

    this.root.add(this.model);
    this.scene.add(this.root);

    // Анимации
    if (gltf.animations && gltf.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(this.model);
      for (const clip of gltf.animations) {
        this.actions[clip.name] = this.mixer.clipAction(clip);
      }
    }

    this._loaded = true;
    this._applyTransform();
    this._visible = true;

    if (typeof this.onLoad === "function") this.onLoad(this);
  }

  // ---------- Трансформация ----------

  /** Обновить позицию/поворот из текущих полей x,z,yawDeg,pitchDeg,rollDeg. */
  _applyTransform() {
    if (!this.root) return;

    const groundY = this.terrain.getHeightAt(this.x, this.z);

    this.root.position.set(this.x, groundY + this.yOffset, this.z);
    this.root.scale.setScalar(this.scale);

    // Углы
    const yaw   = THREE.MathUtils.degToRad(this.yawDeg);
    const pitch = THREE.MathUtils.degToRad(this.pitchDeg);
    const roll  = THREE.MathUtils.degToRad(this.rollDeg);

    if (this.alignToNormal) {
      // Наклонить по нормали рельефа + повернуть по yaw
      const n = this._getTerrainNormal(this.x, this.z);
      const q = new THREE.Quaternion()
        .setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      const qYaw = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0), yaw
      );
      this.root.quaternion.copy(q.multiply(qYaw));
    } else {
      this.root.rotation.set(pitch, yaw, roll, "YXZ");
    }
  }

  /** Нормаль рельефа через конечные разности (для alignToNormal). */
  _getTerrainNormal(x, z) {
    const eps = 0.5;
    const hL = this.terrain.getHeightAt(x - eps, z);
    const hR = this.terrain.getHeightAt(x + eps, z);
    const hD = this.terrain.getHeightAt(x, z - eps);
    const hU = this.terrain.getHeightAt(x, z + eps);

    const dx = (hR - hL) / (2 * eps);
    const dz = (hU - hD) / (2 * eps);
    return new THREE.Vector3(-dx, 1, -dz).normalize();
  }

  /** Поставить в новую точку (и опционально задать новый yaw). */
  setPosition(x, z, yawDeg = this.yawDeg) {
    this.x = x;
    this.z = z;
    this.yawDeg = yawDeg;
    this._applyTransform();
  }

  /** Задать только поворот. */
  setYaw(yawDeg) {
    this.yawDeg = yawDeg;
    this._applyTransform();
  }

  setPitch(pitchDeg) {
    this.pitchDeg = pitchDeg;
    this._applyTransform();
  }

  setRoll(rollDeg) {
    this.rollDeg = rollDeg;
    this._applyTransform();
  }

  setScale(scale) {
    this.scale = scale;
    this._applyTransform();
  }

  // ---------- Видимость ----------

  /** Скрыть/показать модель. Не dispose — можно включить обратно. */
  setVisible(v) {
    this._visible = !!v;
    if (this.root) this.root.visible = this._visible;
  }

  show()    { this.setVisible(true); }
  hide()    { this.setVisible(false); }
  toggle()  { this.setVisible(!this._visible); }

  // ---------- Анимации ----------

  /** Проиграть клип по имени (если есть). */
  play(name, { loop = true, clamp = false, fade = 0.2 } = {}) {
    if (!this.mixer || !this.actions[name]) return null;
    const action = this.actions[name];
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = clamp;
    action.fadeIn(fade).play();
    return action;
  }

  /** Остановить клип по имени. */
  stop(name, fade = 0.2) {
    if (!this.mixer || !this.actions[name]) return;
    this.actions[name].fadeOut(fade);
  }

  /** Обновление — вызывать в animate(dt), чтобы работали анимации. */
  update(dt) {
    if (this.mixer) this.mixer.update(dt);
  }

  // ---------- Очистка ----------

  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    if (this.root) {
      this.scene.remove(this.root);
      // Освобождаем геометрию, материалы и текстуры
      this.root.traverse((o) => {
        if (o.isMesh) {
          if (o.geometry) o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (!m) continue;
            for (const k of Object.keys(m)) {
              const v = m[k];
              if (v && v.isTexture) v.dispose();
            }
            if (m.dispose) m.dispose();
          }
        }
      });
      this.root = null;
      this.model = null;
    }
  }
}

const MODELS = {
  SceneModel,
};

export { MODELS }; // import { MODELS } from "src/models.js";