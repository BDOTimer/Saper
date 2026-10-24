// ============================================================
// VIRTUAL COMPILE OUTPUT — процедурное ружьё (полный снимок)
// Сгенерировано редактором: 2026-10-24T16:36:42.777Z
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

// --- Материалы ---

// --- Сборка ---
export function buildGun(THREE, materials = {}) {
  const root = new THREE.Group();
  root.name = "gun";
  const root_0 = new THREE.Group();
  root_0.name = "barrels";
  root_0.position.set(0.00000, 0.00000, 0.00000);
  root_0.rotation.set(0.00000, 0.00000, 0.00000);
  root_0.scale.set(1.00000, 1.00000, 1.00000);
  const root_0_0 = new THREE.Mesh(new THREE.CylinderGeometry(0.03200, 0.03360, 1.55000, 16, 1), mat_0);
  root_0_0.name = "barrelL";
  root_0_0.position.set(-0.04500, 0.00000, -0.95000);
  root_0_0.rotation.set(1.57080, 0.00000, 0.00000);
  root_0_0.scale.set(1.00000, 1.00000, 1.00000);
  root_0.add(root_0_0);
  const root_0_1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03200, 0.03360, 1.55000, 16, 1), mat_0);
  root_0_1.name = "barrelR";
  root_0_1.position.set(0.04500, 0.00000, -0.95000);
  root_0_1.rotation.set(1.57080, 0.00000, 0.00000);
  root_0_1.scale.set(1.00000, 1.00000, 1.00000);
  root_0.add(root_0_1);
  const root_0_2 = new THREE.Mesh(new THREE.TorusGeometry(0.03040, 0.00600, 8, 16, 6.28319), mat_1);
  root_0_2.name = "muzzleL";
  root_0_2.position.set(-0.04500, 0.00000, -1.72500);
  root_0_2.rotation.set(0.00000, 0.00000, 0.00000);
  root_0_2.scale.set(1.00000, 1.00000, 1.00000);
  root_0.add(root_0_2);
  const root_0_3 = new THREE.Mesh(new THREE.TorusGeometry(0.03040, 0.00600, 8, 16, 6.28319), mat_1);
  root_0_3.name = "muzzleR";
  root_0_3.position.set(0.04500, 0.00000, -1.72500);
  root_0_3.rotation.set(0.00000, 0.00000, 0.00000);
  root_0_3.scale.set(1.00000, 1.00000, 1.00000);
  root_0.add(root_0_3);
  const root_0_4 = new THREE.Mesh(new THREE.BoxGeometry(0.02800, 0.01200, 1.55000), mat_1);
  root_0_4.name = "rib";
  root_0_4.position.set(0.00000, 0.03040, -0.95000);
  root_0_4.rotation.set(0.00000, 0.00000, 0.00000);
  root_0_4.scale.set(1.00000, 1.00000, 1.00000);
  root_0.add(root_0_4);
  root.add(root_0);
  const root_1 = new THREE.Group();
  root_1.name = "sights";
  root_1.position.set(0.00000, 0.00000, 0.00000);
  root_1.rotation.set(0.00000, 0.00000, 0.00000);
  root_1.scale.set(1.00000, 1.00000, 1.00000);
  const root_1_0 = new THREE.Mesh(new THREE.BoxGeometry(0.02000, 0.02500, 0.03000), mat_1);
  root_1_0.position.set(0.00000, 0.05000, -1.68500);
  root_1_0.rotation.set(0.00000, 0.00000, 0.00000);
  root_1_0.scale.set(1.00000, 1.00000, 1.00000);
  root_1.add(root_1_0);
  const root_1_1 = new THREE.Mesh(new THREE.SphereGeometry(0.01200, 10, 10), mat_2);
  root_1_1.name = "frontSightDot";
  root_1_1.position.set(0.00000, 0.06800, -1.68500);
  root_1_1.rotation.set(0.00000, 0.00000, 0.00000);
  root_1_1.scale.set(1.00000, 1.00000, 1.00000);
  root_1.add(root_1_1);
  const root_1_2 = new THREE.Mesh(new THREE.BoxGeometry(0.06000, 0.01500, 0.04000), mat_1);
  root_1_2.position.set(0.00000, 0.04700, -0.29500);
  root_1_2.rotation.set(0.00000, 0.00000, 0.00000);
  root_1_2.scale.set(1.00000, 1.00000, 1.00000);
  root_1.add(root_1_2);
  const root_1_3 = new THREE.Mesh(new THREE.BoxGeometry(0.01200, 0.03000, 0.03000), mat_1);
  root_1_3.position.set(-0.02000, 0.06700, -0.29500);
  root_1_3.rotation.set(0.00000, 0.00000, 0.00000);
  root_1_3.scale.set(1.00000, 1.00000, 1.00000);
  root_1.add(root_1_3);
  const root_1_4 = new THREE.Mesh(new THREE.BoxGeometry(0.01200, 0.03000, 0.03000), mat_1);
  root_1_4.position.set(0.02000, 0.06700, -0.29500);
  root_1_4.rotation.set(0.00000, 0.00000, 0.00000);
  root_1_4.scale.set(1.00000, 1.00000, 1.00000);
  root_1.add(root_1_4);
  root.add(root_1);
  const root_2 = new THREE.Group();
  root_2.name = "receiver";
  root_2.position.set(0.00000, 0.00000, 0.00000);
  root_2.rotation.set(0.00000, 0.00000, 0.00000);
  root_2.scale.set(1.00000, 1.00000, 1.00000);
  const root_2_0 = new THREE.Mesh(new THREE.BoxGeometry(0.13000, 0.09000, 0.32000), mat_3);
  root_2_0.name = "receiverBody";
  root_2_0.position.set(0.00000, -0.01000, -0.02000);
  root_2_0.rotation.set(0.00000, 0.00000, 0.00000);
  root_2_0.scale.set(1.00000, 1.00000, 1.00000);
  root_2.add(root_2_0);
  const root_2_1 = new THREE.Mesh(new THREE.BoxGeometry(0.00100, 0.05000, 0.02000), mat_4);
  root_2_1.position.set(0.06600, -0.00500, -0.08000);
  root_2_1.rotation.set(0.00000, 0.00000, 0.00000);
  root_2_1.scale.set(1.00000, 1.00000, 1.00000);
  root_2.add(root_2_1);
  const root_2_2 = new THREE.Mesh(new THREE.BoxGeometry(0.00100, 0.05000, 0.02000), mat_4);
  root_2_2.position.set(0.06600, -0.00500, -0.02000);
  root_2_2.rotation.set(0.00000, 0.00000, 0.00000);
  root_2_2.scale.set(1.00000, 1.00000, 1.00000);
  root_2.add(root_2_2);
  const root_2_3 = new THREE.Mesh(new THREE.BoxGeometry(0.00100, 0.05000, 0.02000), mat_4);
  root_2_3.position.set(0.06600, -0.00500, 0.04000);
  root_2_3.rotation.set(0.00000, 0.00000, 0.00000);
  root_2_3.scale.set(1.00000, 1.00000, 1.00000);
  root_2.add(root_2_3);
  root.add(root_2);
  const root_3 = new THREE.Group();
  root_3.name = "stock";
  root_3.position.set(0.00000, 0.00000, 0.00000);
  root_3.rotation.set(0.00000, 0.00000, 0.00000);
  root_3.scale.set(1.00000, 1.00000, 1.00000);
  const root_3_0 = new THREE.Mesh(new THREE.BoxGeometry(0.07500, 0.07500, 0.18000), mat_5);
  root_3_0.name = "stockNeck";
  root_3_0.position.set(0.00000, -0.05000, 0.12000);
  root_3_0.rotation.set(0.00000, 0.00000, 0.00000);
  root_3_0.scale.set(1.00000, 1.00000, 1.00000);
  root_3.add(root_3_0);
  root.add(root_3);
  const root_4 = new THREE.Group();
  root_4.name = "forend";
  root_4.position.set(0.00000, 0.00000, 0.00000);
  root_4.rotation.set(0.00000, 0.00000, 0.00000);
  root_4.scale.set(1.00000, 1.00000, 1.00000);
  const root_4_0 = new THREE.Mesh(new THREE.BoxGeometry(0.12800, 0.07000, 0.35000), mat_6);
  root_4_0.name = "forendBody";
  root_4_0.position.set(0.00000, -0.05500, -0.25000);
  root_4_0.rotation.set(0.00000, 0.00000, 0.00000);
  root_4_0.scale.set(1.00000, 1.00000, 1.00000);
  root_4.add(root_4_0);
  const root_4_1 = new THREE.Mesh(new THREE.BoxGeometry(0.12928, 0.00200, 0.00800), mat_1);
  root_4_1.position.set(0.00000, -0.02000, -0.78000);
  root_4_1.rotation.set(0.00000, 0.00000, 0.00000);
  root_4_1.scale.set(1.00000, 1.00000, 1.00000);
  root_4.add(root_4_1);
  const root_4_2 = new THREE.Mesh(new THREE.BoxGeometry(0.12928, 0.00200, 0.00800), mat_1);
  root_4_2.position.set(0.00000, -0.02000, -0.72000);
  root_4_2.rotation.set(0.00000, 0.00000, 0.00000);
  root_4_2.scale.set(1.00000, 1.00000, 1.00000);
  root_4.add(root_4_2);
  const root_4_3 = new THREE.Mesh(new THREE.BoxGeometry(0.12928, 0.00200, 0.00800), mat_1);
  root_4_3.position.set(0.00000, -0.02000, -0.66000);
  root_4_3.rotation.set(0.00000, 0.00000, 0.00000);
  root_4_3.scale.set(1.00000, 1.00000, 1.00000);
  root_4.add(root_4_3);
  const root_4_4 = new THREE.Mesh(new THREE.BoxGeometry(0.12928, 0.00200, 0.00800), mat_1);
  root_4_4.position.set(0.00000, -0.02000, -0.60000);
  root_4_4.rotation.set(0.00000, 0.00000, 0.00000);
  root_4_4.scale.set(1.00000, 1.00000, 1.00000);
  root_4.add(root_4_4);
  const root_4_5 = new THREE.Mesh(new THREE.BoxGeometry(0.12928, 0.00200, 0.00800), mat_1);
  root_4_5.position.set(0.00000, -0.02000, -0.54000);
  root_4_5.rotation.set(0.00000, 0.00000, 0.00000);
  root_4_5.scale.set(1.00000, 1.00000, 1.00000);
  root_4.add(root_4_5);
  root.add(root_4);
  const root_5 = new THREE.Group();
  root_5.name = "trigger";
  root_5.position.set(0.00000, 0.00000, 0.00000);
  root_5.rotation.set(0.00000, 0.00000, 0.00000);
  root_5.scale.set(1.00000, 1.00000, 1.00000);
  const root_5_0 = new THREE.Mesh(new THREE.TorusGeometry(0.03500, 0.00600, 8, 16, 3.14159), mat_1);
  root_5_0.position.set(0.00000, -0.07500, 0.05000);
  root_5_0.rotation.set(3.14159, 0.00000, 1.57080);
  root_5_0.scale.set(1.00000, 1.00000, 1.00000);
  root_5.add(root_5_0);
  const root_5_1 = new THREE.Mesh(new THREE.CylinderGeometry(0.00500, 0.00500, 0.04500, 8, 1), mat_1);
  root_5_1.position.set(0.00000, -0.07000, 0.04500);
  root_5_1.rotation.set(0.00000, 0.00000, 0.25000);
  root_5_1.scale.set(1.00000, 1.00000, 1.00000);
  root_5.add(root_5_1);
  const root_5_2 = new THREE.Mesh(new THREE.CylinderGeometry(0.00800, 0.00800, 0.04000, 8, 1), mat_1);
  root_5_2.position.set(-0.04500, 0.04000, 0.06000);
  root_5_2.rotation.set(-0.50000, 0.00000, 0.00000);
  root_5_2.scale.set(1.00000, 1.00000, 1.00000);
  root_5.add(root_5_2);
  const root_5_3 = new THREE.Mesh(new THREE.CylinderGeometry(0.00800, 0.00800, 0.04000, 8, 1), mat_1);
  root_5_3.position.set(0.04500, 0.04000, 0.06000);
  root_5_3.rotation.set(-0.50000, 0.00000, 0.00000);
  root_5_3.scale.set(1.00000, 1.00000, 1.00000);
  root_5.add(root_5_3);
  const root_5_4 = new THREE.Mesh(new THREE.BoxGeometry(0.02000, 0.01500, 0.05000), mat_7);
  root_5_4.position.set(0.05000, 0.03000, 0.10000);
  root_5_4.rotation.set(0.00000, 0.00000, 0.00000);
  root_5_4.scale.set(1.00000, 1.00000, 1.00000);
  root_5.add(root_5_4);
  root.add(root_5);
  return root;
}

// Конец сгенерированного файла.