// ============================================================
// PROCEDURAL GUN — полный снимок модели
// Сгенерировано: 2026-10-25T05:01:46.296Z
// ============================================================

import * as THREE from "three";

// ============================================================
// ПАРАМЕТРЫ (используются для UI-редактирования)
// ============================================================
export const GUN_PARAMS = {
  barrelLen: { value: 1.55, min: 0.5, max: 3, step: 0.01, label: "Длина ствола" },
  barrelRadius: { value: 0.032, min: 0.01, max: 0.08, step: 0.001, label: "Радиус ствола" },
  barrelSpread: { value: 0.045, min: 0, max: 0.15, step: 0.001, label: "Разнос стволов" },
  ribThick: { value: 0.012, min: 0.002, max: 0.04, step: 0.001, label: "Толщина планки" },
  receiverW: { value: 0.13, min: 0.06, max: 0.3, step: 0.005, label: "Ширина ств.коробки" },
  receiverH: { value: 0.09, min: 0.04, max: 0.2, step: 0.005, label: "Высота ств.коробки" },
  receiverL: { value: 0.32, min: 0.1, max: 0.6, step: 0.005, label: "Длина ств.коробки" },
  stockNeckW: { value: 0.075, min: 0.03, max: 0.15, step: 0.005, label: "Ширина шейки" },
  stockNeckL: { value: 0.18, min: 0.05, max: 0.4, step: 0.005, label: "Длина шейки" },
  forendW: { value: 0.128, min: 0.05, max: 0.25, step: 0.005, label: "Ширина цевья" },
  forendH: { value: 0.07, min: 0.03, max: 0.15, step: 0.005, label: "Высота цевья" },
  forendL: { value: 0.35, min: 0.1, max: 0.7, step: 0.005, label: "Длина цевья" },
  sightSize: { value: 0.012, min: 0.004, max: 0.03, step: 0.001, label: "Размер мушки" },
};

// ============================================================
// МАТЕРИАЛЫ (создаются один раз на уровне модуля)
// ============================================================
const mat_0 = new THREE.MeshStandardMaterial({
  color: 0x141822,
  emissive: 0x000000,
  metalness: 0.9,
  roughness: 0.25,
  opacity: 1,
  envMapIntensity: 0.5,
  transparent: false,
  depthWrite: true,
  depthTest: true,
  side: 0,
  flatShading: false,
});

const mat_1 = new THREE.MeshStandardMaterial({
  color: 0x0f0f12,
  emissive: 0x000000,
  metalness: 0.95,
  roughness: 0.25,
  opacity: 1,
  envMapIntensity: 1,
  transparent: false,
  depthWrite: true,
  depthTest: true,
  side: 0,
  flatShading: false,
});

const mat_2 = new THREE.MeshBasicMaterial({
  color: 0xafa2a0,
  opacity: 1,
  transparent: false,
  depthWrite: true,
  depthTest: true,
  side: 0,
});

const mat_3 = new THREE.MeshStandardMaterial({
  color: 0x1a1e26,
  emissive: 0x000000,
  metalness: 0.85,
  roughness: 0.35,
  opacity: 1,
  envMapIntensity: 0.6,
  transparent: false,
  depthWrite: true,
  depthTest: true,
  side: 0,
  flatShading: false,
});

const mat_4 = new THREE.MeshStandardMaterial({
  color: 0x555555,
  emissive: 0x000000,
  metalness: 0.8,
  roughness: 0.4,
  opacity: 1,
  envMapIntensity: 1,
  transparent: false,
  depthWrite: true,
  depthTest: true,
  side: 0,
  flatShading: false,
});

const mat_5 = new THREE.MeshStandardMaterial({
  color: 0x5a2f12,
  emissive: 0x000000,
  metalness: 0.05,
  roughness: 0.75,
  opacity: 1,
  envMapIntensity: 1,
  transparent: false,
  depthWrite: true,
  depthTest: true,
  side: 0,
  flatShading: false,
});

const mat_6 = new THREE.MeshStandardMaterial({
  color: 0x7a421c,
  emissive: 0x000000,
  metalness: 0.05,
  roughness: 0.65,
  opacity: 1,
  envMapIntensity: 1,
  transparent: false,
  depthWrite: true,
  depthTest: true,
  side: 0,
  flatShading: false,
});

const mat_7 = new THREE.MeshStandardMaterial({
  color: 0xc9a227,
  emissive: 0x000000,
  metalness: 1,
  roughness: 0.3,
  opacity: 1,
  envMapIntensity: 1,
  transparent: false,
  depthWrite: true,
  depthTest: true,
  side: 0,
  flatShading: false,
});

export const MATERIALS = {
  mat_0,
  mat_1,
  mat_2,
  mat_3,
  mat_4,
  mat_5,
  mat_6,
  mat_7,
};

// ============================================================
// СБОРКА — возвращает THREE.Group с текущим состоянием
// ============================================================
export function buildGun(envMap = null) {
  const root = new THREE.Group();
  root.name = "gun";

    const root_0 = new THREE.Group();
    root_0.name = "barrels";
    root_0.position.set(0.000000, 0.000000, 0.000000);
    root_0.rotation.set(0.000000, 0.000000, 0.000000);
    root_0.scale.set(1.000000, 1.000000, 1.000000);
    const root_0_0 = new THREE.Mesh(new THREE.CylinderGeometry(0.032000, 0.033600, 1.550000, 16, 1), mat_0);
    root_0_0.name = "barrelL";
    root_0_0.position.set(-0.045000, 0.000000, -0.950000);
    root_0_0.rotation.set(1.570796, 0.000000, 0.000000);
    root_0_0.scale.set(1.000000, 1.000000, 1.000000);
    root_0.add(root_0_0);
    const root_0_1 = new THREE.Mesh(new THREE.CylinderGeometry(0.032000, 0.033600, 1.550000, 16, 1), mat_0);
    root_0_1.name = "barrelR";
    root_0_1.position.set(0.045000, 0.000000, -0.950000);
    root_0_1.rotation.set(1.570796, 0.000000, 0.000000);
    root_0_1.scale.set(1.000000, 1.000000, 1.000000);
    root_0.add(root_0_1);
    const root_0_2 = new THREE.Mesh(new THREE.TorusGeometry(0.030400, 0.006000, 8, 16, 6.283185), mat_1);
    root_0_2.name = "muzzleL";
    root_0_2.position.set(-0.045000, 0.000000, -1.725000);
    root_0_2.rotation.set(0.000000, 0.000000, 0.000000);
    root_0_2.scale.set(1.000000, 1.000000, 1.000000);
    root_0.add(root_0_2);
    const root_0_3 = new THREE.Mesh(new THREE.TorusGeometry(0.030400, 0.006000, 8, 16, 6.283185), mat_1);
    root_0_3.name = "muzzleR";
    root_0_3.position.set(0.045000, 0.000000, -1.725000);
    root_0_3.rotation.set(0.000000, 0.000000, 0.000000);
    root_0_3.scale.set(1.000000, 1.000000, 1.000000);
    root_0.add(root_0_3);
    const root_0_4 = new THREE.Mesh(new THREE.BoxGeometry(0.028000, 0.012000, 1.550000), mat_1);
    root_0_4.name = "rib";
    root_0_4.position.set(0.000000, 0.030400, -0.950000);
    root_0_4.rotation.set(0.000000, 0.000000, 0.000000);
    root_0_4.scale.set(1.000000, 1.000000, 1.000000);
    root_0.add(root_0_4);
    root.add(root_0);
    const root_1 = new THREE.Group();
    root_1.name = "sights";
    root_1.position.set(0.000000, 0.000000, 0.000000);
    root_1.rotation.set(0.000000, 0.000000, 0.000000);
    root_1.scale.set(1.000000, 1.000000, 1.000000);
    const root_1_0 = new THREE.Mesh(new THREE.BoxGeometry(0.020000, 0.025000, 0.030000), mat_1);
    root_1_0.position.set(0.000000, 0.050000, -1.685000);
    root_1_0.rotation.set(0.000000, 0.000000, 0.000000);
    root_1_0.scale.set(1.000000, 1.000000, 1.000000);
    root_1.add(root_1_0);
    const root_1_1 = new THREE.Mesh(new THREE.SphereGeometry(0.012000, 10, 10), mat_2);
    root_1_1.name = "frontSightDot";
    root_1_1.position.set(0.000000, 0.068000, -1.685000);
    root_1_1.rotation.set(0.000000, 0.000000, 0.000000);
    root_1_1.scale.set(1.000000, 1.000000, 1.000000);
    root_1.add(root_1_1);
    const root_1_2 = new THREE.Mesh(new THREE.BoxGeometry(0.060000, 0.015000, 0.040000), mat_1);
    root_1_2.position.set(0.000000, 0.047000, -0.295000);
    root_1_2.rotation.set(0.000000, 0.000000, 0.000000);
    root_1_2.scale.set(1.000000, 1.000000, 1.000000);
    root_1.add(root_1_2);
    const root_1_3 = new THREE.Mesh(new THREE.BoxGeometry(0.012000, 0.030000, 0.030000), mat_1);
    root_1_3.position.set(-0.020000, 0.067000, -0.295000);
    root_1_3.rotation.set(0.000000, 0.000000, 0.000000);
    root_1_3.scale.set(1.000000, 1.000000, 1.000000);
    root_1.add(root_1_3);
    const root_1_4 = new THREE.Mesh(new THREE.BoxGeometry(0.012000, 0.030000, 0.030000), mat_1);
    root_1_4.position.set(0.020000, 0.067000, -0.295000);
    root_1_4.rotation.set(0.000000, 0.000000, 0.000000);
    root_1_4.scale.set(1.000000, 1.000000, 1.000000);
    root_1.add(root_1_4);
    root.add(root_1);
    const root_2 = new THREE.Group();
    root_2.name = "receiver";
    root_2.position.set(0.000000, 0.000000, 0.000000);
    root_2.rotation.set(0.000000, 0.000000, 0.000000);
    root_2.scale.set(1.000000, 1.000000, 1.000000);
    const root_2_0 = new THREE.Mesh(new THREE.BoxGeometry(0.130000, 0.090000, 0.320000), mat_3);
    root_2_0.name = "receiverBody";
    root_2_0.position.set(0.000000, -0.010000, -0.020000);
    root_2_0.rotation.set(0.000000, 0.000000, 0.000000);
    root_2_0.scale.set(1.000000, 1.000000, 1.000000);
    root_2.add(root_2_0);
    const root_2_1 = new THREE.Mesh(new THREE.BoxGeometry(0.001000, 0.050000, 0.020000), mat_4);
    root_2_1.position.set(0.066000, -0.005000, -0.080000);
    root_2_1.rotation.set(0.000000, 0.000000, 0.000000);
    root_2_1.scale.set(1.000000, 1.000000, 1.000000);
    root_2.add(root_2_1);
    const root_2_2 = new THREE.Mesh(new THREE.BoxGeometry(0.001000, 0.050000, 0.020000), mat_4);
    root_2_2.position.set(0.066000, -0.005000, -0.020000);
    root_2_2.rotation.set(0.000000, 0.000000, 0.000000);
    root_2_2.scale.set(1.000000, 1.000000, 1.000000);
    root_2.add(root_2_2);
    const root_2_3 = new THREE.Mesh(new THREE.BoxGeometry(0.001000, 0.050000, 0.020000), mat_4);
    root_2_3.position.set(0.066000, -0.005000, 0.040000);
    root_2_3.rotation.set(0.000000, 0.000000, 0.000000);
    root_2_3.scale.set(1.000000, 1.000000, 1.000000);
    root_2.add(root_2_3);
    root.add(root_2);
    const root_3 = new THREE.Group();
    root_3.name = "stock";
    root_3.position.set(0.000000, 0.000000, 0.000000);
    root_3.rotation.set(0.000000, 0.000000, 0.000000);
    root_3.scale.set(1.000000, 1.000000, 1.000000);
    const root_3_0 = new THREE.Mesh(new THREE.BoxGeometry(0.075000, 0.075000, 0.180000), mat_5);
    root_3_0.name = "stockNeck";
    root_3_0.position.set(0.000000, -0.050000, 0.120000);
    root_3_0.rotation.set(0.000000, 0.000000, 0.000000);
    root_3_0.scale.set(1.000000, 1.000000, 1.000000);
    root_3.add(root_3_0);
    root.add(root_3);
    const root_4 = new THREE.Group();
    root_4.name = "forend";
    root_4.position.set(0.000000, 0.000000, 0.000000);
    root_4.rotation.set(0.000000, 0.000000, 0.000000);
    root_4.scale.set(1.000000, 1.000000, 1.000000);
    const root_4_0 = new THREE.Mesh(new THREE.BoxGeometry(0.128000, 0.070000, 0.350000), mat_6);
    root_4_0.name = "forendBody";
    root_4_0.position.set(0.000000, -0.055000, -0.250000);
    root_4_0.rotation.set(0.000000, 0.000000, 0.000000);
    root_4_0.scale.set(1.000000, 1.000000, 1.000000);
    root_4.add(root_4_0);
    const root_4_1 = new THREE.Mesh(new THREE.BoxGeometry(0.129280, 0.002000, 0.008000), mat_1);
    root_4_1.position.set(0.000000, -0.020000, -0.780000);
    root_4_1.rotation.set(0.000000, 0.000000, 0.000000);
    root_4_1.scale.set(1.000000, 1.000000, 1.000000);
    root_4.add(root_4_1);
    const root_4_2 = new THREE.Mesh(new THREE.BoxGeometry(0.129280, 0.002000, 0.008000), mat_1);
    root_4_2.position.set(0.000000, -0.020000, -0.720000);
    root_4_2.rotation.set(0.000000, 0.000000, 0.000000);
    root_4_2.scale.set(1.000000, 1.000000, 1.000000);
    root_4.add(root_4_2);
    const root_4_3 = new THREE.Mesh(new THREE.BoxGeometry(0.129280, 0.002000, 0.008000), mat_1);
    root_4_3.position.set(0.000000, -0.020000, -0.660000);
    root_4_3.rotation.set(0.000000, 0.000000, 0.000000);
    root_4_3.scale.set(1.000000, 1.000000, 1.000000);
    root_4.add(root_4_3);
    const root_4_4 = new THREE.Mesh(new THREE.BoxGeometry(0.129280, 0.002000, 0.008000), mat_1);
    root_4_4.position.set(0.000000, -0.020000, -0.600000);
    root_4_4.rotation.set(0.000000, 0.000000, 0.000000);
    root_4_4.scale.set(1.000000, 1.000000, 1.000000);
    root_4.add(root_4_4);
    const root_4_5 = new THREE.Mesh(new THREE.BoxGeometry(0.129280, 0.002000, 0.008000), mat_1);
    root_4_5.position.set(0.000000, -0.020000, -0.540000);
    root_4_5.rotation.set(0.000000, 0.000000, 0.000000);
    root_4_5.scale.set(1.000000, 1.000000, 1.000000);
    root_4.add(root_4_5);
    root.add(root_4);
    const root_5 = new THREE.Group();
    root_5.name = "trigger";
    root_5.position.set(0.000000, 0.000000, 0.000000);
    root_5.rotation.set(0.000000, 0.000000, 0.000000);
    root_5.scale.set(1.000000, 1.000000, 1.000000);
    const root_5_0 = new THREE.Mesh(new THREE.TorusGeometry(0.035000, 0.006000, 8, 16, 3.141593), mat_1);
    root_5_0.position.set(0.000000, -0.075000, 0.050000);
    root_5_0.rotation.set(3.141593, 0.000000, 1.570796);
    root_5_0.scale.set(1.000000, 1.000000, 1.000000);
    root_5.add(root_5_0);
    const root_5_1 = new THREE.Mesh(new THREE.CylinderGeometry(0.005000, 0.005000, 0.045000, 8, 1), mat_1);
    root_5_1.position.set(0.000000, -0.070000, 0.045000);
    root_5_1.rotation.set(0.000000, 0.000000, 0.250000);
    root_5_1.scale.set(1.000000, 1.000000, 1.000000);
    root_5.add(root_5_1);
    const root_5_2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008000, 0.008000, 0.040000, 8, 1), mat_1);
    root_5_2.position.set(-0.045000, 0.040000, 0.060000);
    root_5_2.rotation.set(-0.500000, 0.000000, 0.000000);
    root_5_2.scale.set(1.000000, 1.000000, 1.000000);
    root_5.add(root_5_2);
    const root_5_3 = new THREE.Mesh(new THREE.CylinderGeometry(0.008000, 0.008000, 0.040000, 8, 1), mat_1);
    root_5_3.position.set(0.045000, 0.040000, 0.060000);
    root_5_3.rotation.set(-0.500000, 0.000000, 0.000000);
    root_5_3.scale.set(1.000000, 1.000000, 1.000000);
    root_5.add(root_5_3);
    const root_5_4 = new THREE.Mesh(new THREE.BoxGeometry(0.020000, 0.015000, 0.050000), mat_7);
    root_5_4.position.set(0.050000, 0.030000, 0.100000);
    root_5_4.rotation.set(0.000000, 0.000000, 0.000000);
    root_5_4.scale.set(1.000000, 1.000000, 1.000000);
    root_5.add(root_5_4);
    root.add(root_5);

  // опциональная подстановка envMap
  if (envMap) {
    root.traverse(o => {
      if (o.isMesh && o.material) {
        o.material.envMap = envMap;
        o.material.needsUpdate = true;
      }
    });
  }
  return root;
}

// ============================================================
// ПРИМЕНЕНИЕ ПАРАМЕТРОВ — мутирует существующие меши
// (нужно для редактора: слайдеры двигают ПАРАМЕТРЫ, а не пересобирают всё)
// ============================================================
export function applyParams(root, params = GUN_PARAMS) {
  const P = params;
  const get = (k) => P[k]?.value ?? GUN_PARAMS[k]?.value;
  const r = (name) => root.getObjectByName(name);

  // стволы
  const barrelL = r("barrelL"), barrelR = r("barrelR");
  const rib = r("rib");
  const muzzleL = r("muzzleL"), muzzleR = r("muzzleR");
  const barrelLen = get("barrelLen");
  const barrelRadius = get("barrelRadius");
  const spread = get("barrelSpread");
  if (barrelL) {
    barrelL.geometry.dispose();
    barrelL.geometry = new THREE.CylinderGeometry(barrelRadius, barrelRadius * 1.05, barrelLen, 16);
    barrelL.position.x = -spread;
  }
  if (barrelR) {
    barrelR.geometry.dispose();
    barrelR.geometry = new THREE.CylinderGeometry(barrelRadius, barrelRadius * 1.05, barrelLen, 16);
    barrelR.position.x = spread;
  }
  if (rib) {
    rib.geometry.dispose();
    rib.geometry = new THREE.BoxGeometry(0.028, get("ribThick"), barrelLen);
    rib.position.set(0, barrelRadius * 0.95, -0.95);
  }
  const zMuzzle = -0.95 - barrelLen / 2;
  if (muzzleL) { muzzleL.geometry.dispose(); muzzleL.geometry = new THREE.TorusGeometry(barrelRadius * 0.95, 0.006, 8, 16); muzzleL.position.set(-spread, 0, zMuzzle); }
  if (muzzleR) { muzzleR.geometry.dispose(); muzzleR.geometry = new THREE.TorusGeometry(barrelRadius * 0.95, 0.006, 8, 16); muzzleR.position.set(spread, 0, zMuzzle); }

  // мушка
  const dot = r("frontSightDot");
  if (dot) {
    dot.geometry.dispose();
    dot.geometry = new THREE.SphereGeometry(get("sightSize"), 10, 10);
    dot.position.set(0, barrelRadius + get("sightSize") * 3, -0.95 - barrelLen / 2 + 0.04);
  }

  // ствольная коробка
  const receiver = r("receiverBody");
  if (receiver) {
    receiver.geometry.dispose();
    receiver.geometry = new THREE.BoxGeometry(get("receiverW"), get("receiverH"), get("receiverL"));
  }

  // приклад
  const stock = r("stockNeck");
  if (stock) {
    stock.geometry.dispose();
    stock.geometry = new THREE.BoxGeometry(get("stockNeckW"), get("stockNeckW"), get("stockNeckL"));
  }

  // цевьё
  const forend = r("forendBody");
  if (forend) {
    forend.geometry.dispose();
    forend.geometry = new THREE.BoxGeometry(get("forendW"), get("forendH"), get("forendL"));
  }
}

// ============================================================
// УБОРКА (только геометрия — материалы общие на модуль)
// ============================================================
export function dispose(root) {
  root.traverse(o => {
    if (o.isMesh) o.geometry?.dispose();
  });
}

// Конец файла.