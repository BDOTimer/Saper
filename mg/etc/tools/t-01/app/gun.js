// gun.js
import * as THREE from "three";

export class Gun {
  constructor(camera, envMap) {
    this.camera = camera;
    this.envMap = envMap;
    this.model = new THREE.Group();
    this.recoil = 0;

    // ==== ПАРАМЕТРЫ ДЕТАЛЕЙ (всё, что редактируется) ====
    this.params = {
      barrelLen:    { value: 1.55,  min: 0.5,  max: 3.0,  step: 0.01, label: "Длина ствола" },
      barrelRadius: { value: 0.032, min: 0.01, max: 0.08, step: 0.001,label: "Радиус ствола" },
      barrelSpread: { value: 0.045, min: 0.0,  max: 0.15, step: 0.001,label: "Разнос стволов" },
      ribThick:     { value: 0.012, min: 0.002,max: 0.04, step: 0.001,label: "Толщина планки" },
      receiverW:    { value: 0.13,  min: 0.06, max: 0.30, step: 0.005,label: "Ширина ств.коробки" },
      receiverH:    { value: 0.09,  min: 0.04, max: 0.20, step: 0.005,label: "Высота ств.коробки" },
      receiverL:    { value: 0.32,  min: 0.10, max: 0.60, step: 0.005,label: "Длина ств.коробки" },
      stockNeckW:   { value: 0.075, min: 0.03, max: 0.15, step: 0.005,label: "Ширина шейки" },
      stockNeckL:   { value: 0.18,  min: 0.05, max: 0.40, step: 0.005,label: "Длина шейки" },
      forendW:      { value: 0.128, min: 0.05, max: 0.25, step: 0.005,label: "Ширина цевья" },
      forendH:      { value: 0.07,  min: 0.03, max: 0.15, step: 0.005,label: "Высота цевья" },
      forendL:      { value: 0.35,  min: 0.10, max: 0.70, step: 0.005,label: "Длина цевья" },
      sightSize:    { value: 0.012, min: 0.004,max: 0.03, step: 0.001,label: "Размер мушки" },
    };
    
    /** @type {Map<string, {p:THREE.Vector3, r:THREE.Euler, s:THREE.Vector3}>} */
    this._transformOverrides = new Map();

    this.buildModel();
    camera.add(this.model);
  }

  buildModel() {
    // очистка
    while (this.model.children.length) {
      const c = this.model.children[0];
      this.model.remove(c);
      c.traverse?.(o => {
        if (o.isMesh) { o.geometry?.dispose(); }
      });
    }

    const envMap = this.envMap;
    const P = this.params;

    const bluedSteelMat = new THREE.MeshStandardMaterial({
      color: 0x141822, metalness: 0.9, roughness: 0.25, envMap, envMapIntensity: 0.5
    });
    const metalDarkMat = new THREE.MeshStandardMaterial({
      color: 0x0f0f12, metalness: 0.95, roughness: 0.25
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e26, metalness: 0.85, roughness: 0.35, envMap, envMapIntensity: 0.6
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5a2f12, metalness: 0.05, roughness: 0.75
    });
    const woodLightMat = new THREE.MeshStandardMaterial({
      color: 0x7a421c, metalness: 0.05, roughness: 0.65
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xc9a227, metalness: 1.0, roughness: 0.3
    });
    const sightRedMat = new THREE.MeshBasicMaterial({ color: 0xafa2a0 });

    const barrelLen    = P.barrelLen.value;
    const barrelRadius = P.barrelRadius.value;
    const spread       = P.barrelSpread.value;

    // === ДЕТАЛЬ: ствол (левый/правый) ===
    const barrelGroup = new THREE.Group();
    barrelGroup.name = "barrels";

    const barrelL = new THREE.Mesh(
      new THREE.CylinderGeometry(barrelRadius, barrelRadius * 1.05, barrelLen, 16),
      bluedSteelMat
    );
    barrelL.name = "barrelL";
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-spread, 0, -0.95);
    barrelGroup.add(barrelL);

    const barrelR = barrelL.clone();
    barrelR.name = "barrelR";
    barrelR.position.x = spread;
    barrelGroup.add(barrelR);

    const muzzleGeo = new THREE.TorusGeometry(barrelRadius * 0.95, 0.006, 8, 16);
    const muzzleL = new THREE.Mesh(muzzleGeo, metalDarkMat);
    muzzleL.name = "muzzleL";
    muzzleL.position.set(-spread, 0, -0.95 - barrelLen / 2);
    barrelGroup.add(muzzleL);
    const muzzleR = muzzleL.clone();
    muzzleR.name = "muzzleR";
    muzzleR.position.x = spread;
    barrelGroup.add(muzzleR);

    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, P.ribThick.value, barrelLen),
      metalDarkMat
    );
    rib.name = "rib";
    rib.position.set(0, barrelRadius * 0.95, -0.95);
    barrelGroup.add(rib);

    this.model.add(barrelGroup);

    // === ДЕТАЛЬ: прицельные ===
    const sightGroup = new THREE.Group();
    sightGroup.name = "sights";

    const frontSightBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.025, 0.03),
      metalDarkMat
    );
    frontSightBase.position.set(0, barrelRadius + 0.018, -0.95 - barrelLen / 2 + 0.04);
    sightGroup.add(frontSightBase);

    const frontSightDot = new THREE.Mesh(
      new THREE.SphereGeometry(P.sightSize.value, 10, 10),
      sightRedMat
    );
    frontSightDot.name = "frontSightDot";
    frontSightDot.position.set(0, barrelRadius + P.sightSize.value * 3, -0.95 - barrelLen / 2 + 0.04);
    sightGroup.add(frontSightDot);

    const rearSightBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.015, 0.04),
      metalDarkMat
    );
    rearSightBase.position.set(0, barrelRadius + 0.015, -0.95 + barrelLen / 2 - 0.12);
    sightGroup.add(rearSightBase);

    const hornGeo = new THREE.BoxGeometry(0.012, 0.03, 0.03);
    const hornL = new THREE.Mesh(hornGeo, metalDarkMat);
    hornL.position.set(-0.02, barrelRadius + 0.035, -0.95 + barrelLen / 2 - 0.12);
    sightGroup.add(hornL);
    const hornR = hornL.clone();
    hornR.position.x = 0.02;
    sightGroup.add(hornR);

    this.model.add(sightGroup);

    // === ДЕТАЛЬ: ствольная коробка ===
    const receiverGroup = new THREE.Group();
    receiverGroup.name = "receiver";

    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(P.receiverW.value, P.receiverH.value, P.receiverL.value),
      metalMat
    );
    receiver.name = "receiverBody";
    receiver.position.set(0, -0.01, -0.02);
    receiverGroup.add(receiver);

    const engraveMat = new THREE.MeshStandardMaterial({
      color: 0x555555, metalness: 0.8, roughness: 0.4
    });
    for (let i = 0; i < 3; i++) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.001, 0.05, 0.02),
        engraveMat
      );
      line.position.set(P.receiverW.value * 0.5 + 0.001, -0.005, -0.08 + i * 0.06);
      receiverGroup.add(line);
    }
    this.model.add(receiverGroup);

    // === ДЕТАЛЬ: приклад (шейка) ===
    const stockGroup = new THREE.Group();
    stockGroup.name = "stock";
    const stockNeck = new THREE.Mesh(
      new THREE.BoxGeometry(P.stockNeckW.value, P.stockNeckW.value, P.stockNeckL.value),
      woodMat
    );
    stockNeck.name = "stockNeck";
    stockNeck.position.set(0, -0.05, 0.12);
    stockGroup.add(stockNeck);
    this.model.add(stockGroup);

    // === ДЕТАЛЬ: цевьё ===
    const forendGroup = new THREE.Group();
    forendGroup.name = "forend";
    const forend = new THREE.Mesh(
      new THREE.BoxGeometry(P.forendW.value, P.forendH.value, P.forendL.value),
      woodLightMat
    );
    forend.name = "forendBody";
    forend.position.set(0, -0.055, -0.25);
    forendGroup.add(forend);

    for (let i = 0; i < 5; i++) {
      const notch = new THREE.Mesh(
        new THREE.BoxGeometry(P.forendW.value * 1.01, 0.002, 0.008),
        metalDarkMat
      );
      notch.position.set(0, -0.02, -0.78 + i * 0.06);
      forendGroup.add(notch);
    }
    this.model.add(forendGroup);

    // === ДЕТАЛЬ: УСМ (спуск/курок/предохранитель) ===
    const triggerGroup = new THREE.Group();
    triggerGroup.name = "trigger";

    const triggerGuard = new THREE.Mesh(
      new THREE.TorusGeometry(0.035, 0.006, 8, 16, Math.PI),
      metalDarkMat
    );
    triggerGuard.rotation.x = Math.PI;
    triggerGuard.rotation.z = Math.PI / 2;
    triggerGuard.position.set(0, -0.075, 0.05);
    triggerGroup.add(triggerGuard);

    const trigger = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.045, 8),
      metalDarkMat
    );
    trigger.rotation.z = 0.25;
    trigger.position.set(0, -0.07, 0.045);
    triggerGroup.add(trigger);

    const hammerGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8);
    const hammerL = new THREE.Mesh(hammerGeo, metalDarkMat);
    hammerL.position.set(-0.045, 0.04, 0.06);
    hammerL.rotation.x = -0.5;
    triggerGroup.add(hammerL);
    const hammerR = hammerL.clone();
    hammerR.position.x = 0.045;
    triggerGroup.add(hammerR);

    const safety = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.015, 0.05),
      brassMat
    );
    safety.position.set(0.05, 0.03, 0.1);
    triggerGroup.add(safety);

    this.model.add(triggerGroup);

    this.model.traverse(o => this._applyOverride(o));
    this.model.traverse(o => { if (o.isMesh) o.castShadow = false; });
  }

  // применить изменения параметров и пересобрать модель
  applyParams() {
    this.buildModel();
  }

  fire() {
    this.recoil = 1.0;
    if (window.SNDS && SNDS.shoot) SNDS.shoot.play();
  }

  update(dt) {
    if (this.recoil > 0) {
      this.recoil -= dt * 6;
      if (this.recoil < 0) this.recoil = 0;
    }
    const r = this.recoil;
    this.model.position.z = -0.30 + r * 0.14;
    this.model.rotation.x = r * 0.22;
  }

  /*
   * Вызывается из редактора при изменении трансформаций ноды.
   * Запоминает override по имени группы/меша — чтобы applyParams()
   * не сбрасывал пользовательские правки.
   */
  setOverride(name, transform) {
    if (!name) return;
    this._transformOverrides.set(name, transform);
  }

  getOverride(name) {
    return this._transformOverrides.get(name);
  }

  _applyOverride(obj) {
    if (!obj.name) return;
    const t = this._transformOverrides.get(obj.name);
    if (!t) return;
    if (t.p) obj.position.copy(t.p);
    if (t.r) obj.rotation.copy(t.r);
    if (t.s) obj.scale.copy(t.s);
  }
}