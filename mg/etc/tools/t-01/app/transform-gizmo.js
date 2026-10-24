// transform-gizmo.js
import * as THREE from "three";

/**
 * TransformGizmo — маленький маркер-трипод в локальном (0,0,0) выбранной ноды.
 * Красная — X, зелёная — Y, синяя — Z.
 *
 * Использование:
 *   const gizmo = new TransformGizmo(scene, { size: 0.25 });
 *   gizmo.attach(obj);      // показать у ноды
 *   gizmo.detach();         // спрятать
 *   gizmo.dispose();        // снять со сцены и освободить ресурсы
 */
export class TransformGizmo {
  constructor(scene, opts = {}) {
    this.scene = scene;

    this.opts = Object.assign({
      size: 0.22,           // длина осей (мировые единицы, до масштабирования)
      axisRadius : 0.6,   // толщина стержня
      arrowRadius: 0.01,    // радиус основания конуса
      arrowLength: 0.03,    // длина конуса
      colors: { x: 0xff3030, y: 0x30ff30, z: 0x3080ff },
      depthTest: false,     // рисовать поверх модели (чтобы не тонуло)
      renderOrder: 20,
    }, opts);

    this.group = new THREE.Group();
    this.group.name = "__gizmo__";
    this.group.visible = false;
    // у гизмо нет своего масштаба — он «визуальный маркер», а не часть модели
    this.group.matrixAutoUpdate = true;

    // отключаем raycast для гизмо (не мешает обводке / кликам)
    this.group.userData.isHelper = true;

    this._build();
    scene.add(this.group);

    /** @type {THREE.Object3D|null} */
    this.target = null;
  }

  _build() {
    const o = this.opts;
    const { x, y, z } = o.colors;

    const mkMat = (color) => new THREE.MeshBasicMaterial({
      color,
      depthTest: o.depthTest,
      depthWrite: false,
      transparent: true,
      opacity: 1.0,
    });

    const mkAxis = (color, dir) => {
      const axisGroup = new THREE.Group();

      // стержень: цилиндр вдоль +Y, затем поворот под нужную ось
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(o.axisRadius, o.axisRadius, o.size, 6, 1),
        mkMat(color)
      );
      shaft.position.y = o.size / 2;
      shaft.renderOrder = o.renderOrder;
      axisGroup.add(shaft);

      // конус-стрелка
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(o.arrowRadius, o.arrowLength, 8),
        mkMat(color)
      );
      arrow.position.y = o.size;
      arrow.renderOrder = o.renderOrder;
      axisGroup.add(arrow);

      // ориентируем весь axisGroup под нужное направление
      if (dir.x !== 0) {
        axisGroup.rotation.z = -Math.PI / 2 * Math.sign(dir.x);
      } else if (dir.z !== 0) {
        axisGroup.rotation.x = Math.PI / 2 * Math.sign(dir.z);
      }
      // для +Y ничего не нужно

      return axisGroup;
    };

    this.group.add(mkAxis(x, new THREE.Vector3( 1, 0, 0))); // X
    this.group.add(mkAxis(y, new THREE.Vector3( 0, 1, 0))); // Y
    this.group.add(mkAxis(z, new THREE.Vector3( 0, 0, 1))); // Z
  }

  /** Прикрепить гизмо к ноде (показывает в её локальном 0,0,0). */
  /** Прикрепить гизмо к ноде (показывает в её локальном 0,0,0). */
  attach(obj) {
    this.target = obj || null;
    if (!this.target) {
      this.group.visible = false;
      if (this.group.parent) this.group.parent.remove(this.group);
      return;
    }

    // всегда сцена — не ребёнок obj, чтобы OutlinePass не нашёл его в traverse
    if (this.group.parent !== this.scene) {
      if (this.group.parent) this.group.parent.remove(this.group);
      this.scene.add(this.group);
    }

    this.group.visible = true;
    this._syncPosition();
  }

  /** Спрятать и открепить. */
  detach() {
    this.target = null;
    this.group.visible = false;
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  /** Обновлять каждый кадр из animate(). */
  update() {
    if (!this.target || !this.group.visible) return;
    this._syncPosition();
  }

  /** Синхронизация мировой позиции с локальным нулём target. */
  _syncPosition() {
    if (!this.target) return;
    const localZero = new THREE.Vector3(0, 0, 0);
    this.target.localToWorld(localZero);
    this.group.position.copy(localZero);

    // мировые оси. Если хочешь локальные — раскомментируй:
    // this.target.getWorldQuaternion(this.group.quaternion);
    this.group.quaternion.identity();

    this.group.scale.set(1, 1, 1);
  } ///+


  dispose() {
    this.detach();
    if (this.group.parent) this.group.parent.remove(this.group);
    this.group.traverse(o => {
      if (o.isMesh) {
        o.geometry?.dispose();
        if (o.material?.dispose) o.material.dispose();
      }
    });
  }

    /** Синхронизация мировой позиции с локальным нулём target. */
  _syncPosition() {
    if (!this.target) return;
    const localZero = new THREE.Vector3(0, 0, 0);
    this.target.localToWorld(localZero);
    this.group.position.copy(localZero);

    // мировые оси. Если хочешь локальные — раскомментируй:
    // this.target.getWorldQuaternion(this.group.quaternion);
    this.group.quaternion.identity();

    this.group.scale.set(1, 1, 1);
  }
}