// selection-outline.js
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass }     from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass }    from "three/addons/postprocessing/OutlinePass.js";
import { OutputPass }     from "three/addons/postprocessing/OutputPass.js";

export class SelectionOutline {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene}         scene
   * @param {THREE.Camera}        camera
   * @param {HTMLElement}         container  — DOM-элемент вьюпорта (для size)
   * @param {Object}              [opts]
   * @param {number}              [opts.color=0xff2a2a]     — цвет обводки
   * @param {number}              [opts.edgeStrength=6]     — сила (толщина) краёв
   * @param {number}              [opts.edgeGlow=0.0]
   * @param {number}              [opts.edgeThickness=1.5]
   * @param {number}              [opts.pulsePeriod=0]      — 0 = без пульсации
   */
  constructor(renderer, scene, camera, container, opts = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.container = container;

    this.opts = Object.assign({
      color: 0xff2a2a,
      edgeStrength: 6,
      edgeGlow: 0.0,
      edgeThickness: 1.5,
      pulsePeriod: 0,
    }, opts);

    // --- composer ---
    const renderTarget = new THREE.WebGLRenderTarget(
      this._w(),
      this._h(),
      {
        type: THREE.HalfFloatType,     // сохраняет HDR при tone-mapping
        samples: 4,                     // MSAA 4x (можно 8 — дороже)
      }
    );
    this.composer = new EffectComposer(renderer, renderTarget);
    this._msaaTarget = renderTarget;

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.outlinePass = new OutlinePass(
      new THREE.Vector2(this._w(), this._h()),
      scene,
      camera
    );
    this.composer.addPass(this.outlinePass);

    // OutputPass — финальный tone-mapping / colorspace (в r160 это нужно
    // для совместимости с renderer.toneMapping и ACES)
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.applyOptions();

    // храним подписанные меши, чтобы уметь снимать подсветку
    this._current = null;   // Object3D
    this._meshes = [];      // массив подсвеченных мешей

    // --- resize ---
    this._onResize = this._onResize.bind(this);
    window.addEventListener("resize", this._onResize);
    if (container) new ResizeObserver(this._onResize).observe(container);
  }

  applyOptions() {
    const o = this.opts;
    this.outlinePass.visibleEdgeColor.setHex(o.color);
    this.outlinePass.hiddenEdgeColor.setHex(o.color);
    this.outlinePass.edgeStrength = o.edgeStrength;
    this.outlinePass.edgeGlow = o.edgeGlow;
    this.outlinePass.edgeThickness = o.edgeThickness;
    this.outlinePass.pulsePeriod = o.pulsePeriod;
  }

  /**
   * Подсветить объект. Если это группа — подсветятся все её меши.
   * Передайте null/undefined, чтобы просто снять предыдущую подсветку.
   */
  select(object3D) {
    if (!object3D) {
      this.clear();
      return;
    }

    const meshes = [];
    object3D.traverse?.(o => {
      if (!o.isMesh || !o.visible) return;
      if (this._isHelper(o)) return;
      meshes.push(o);
    });

    if (meshes.length === 0) {
      this.clear();
      return;
    }

    this._current = object3D;
    this._meshes = meshes;
    this.outlinePass.selectedObjects = meshes;
  }

  /** Снять подсветку */
  clear() {
    this._current = null;
    this._meshes = [];
    this.outlinePass.selectedObjects = [];
  }

  /**
   * Возвращает текущий подсвеченный Object3D (или null).
   */
  getSelected() {
    return this._current;
  }

  /**
   * Вызвать в цикле рендера ВМЕСТО renderer.render(scene, camera).
   * Внутри — обновление OutlinePass (кэш материалов при пересборке).
   */
  render() {
    this.composer.render();
  }

  /**
   * Если модель пересобрана (модели «сброшены», selectedObjects стали stale) —
   * переустановить подсветку по Object3D-ссылке не получится (её уже нет).
   * Вызываем этот метод, передав новый эквивалентный объект (по имени группы).
   */
  reselect(newEquivalent) {
    if (!this._current) return;
    if (newEquivalent) this.select(newEquivalent);
    else this.clear();
  }

  dispose() {
    window.removeEventListener("resize", this._onResize);
    this.outlinePass.selectedObjects = [];
    this.outlinePass.dispose?.();
    this.composer.dispose?.();
  }

  _w() { return this.container?.clientWidth  || window.innerWidth;  }
  _h() { return this.container?.clientHeight || window.innerHeight; }

  _onResize() {
    const w = this._w(), h = this._h();
    this.composer.setSize(w, h);
    this.outlinePass.resolution.set(w, h);

    // обновляем и MSAA render target, если он хранится у нас
    if (this._msaaTarget) this._msaaTarget.setSize(w, h);
  }

    /**
   * Проверяет, помечен ли объект (или любой его предок) как helper.
   * Гизмо, оси, сетка — все помечаются userData.isHelper = true
   * и исключаются из обводки.
   */
  _isHelper(obj) {
    let cur = obj;
    while (cur) {
      if (cur.userData && cur.userData.isHelper) return true;
      cur = cur.parent;
    }
    return false;
  }
}