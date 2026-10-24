// ============================================================
// VIRTUAL COMPILE OUTPUT — процедурное ружьё
// Сгенерировано редактором: 2026-10-24T16:08:17.145Z
// ============================================================

export const GUN_PARAMS = {
  barrelLen: 1.55, // Длина ствола [0.5 .. 3]
  barrelRadius: 0.032, // Радиус ствола [0.01 .. 0.08]
  barrelSpread: 0.045, // Разнос стволов [0 .. 0.15]
  ribThick: 0.012, // Толщина планки [0.002 .. 0.04]
  receiverW: 0.13, // Ширина ств.коробки [0.06 .. 0.3]
  receiverH: 0.09, // Высота ств.коробки [0.04 .. 0.2]
  receiverL: 0.32, // Длина ств.коробки [0.1 .. 0.6]
  stockNeckW: 0.075, // Ширина шейки [0.03 .. 0.15]
  stockNeckL: 0.18, // Длина шейки [0.05 .. 0.4]
  forendW: 0.128, // Ширина цевья [0.05 .. 0.25]
  forendH: 0.07, // Высота цевья [0.03 .. 0.15]
  forendL: 0.35, // Длина цевья [0.1 .. 0.7]
  sightSize: 0.012, // Размер мушки [0.004 .. 0.03]
};

// --- Сборка по текущей модели (все группы и меши) ---
export function buildGun(THREE) {
  const root = new THREE.Group();
  root.name = "gun";
  const root_0 = new THREE.Group();
  root_0.name = "barrels";
  const mat_0 = new THREE.MeshStandardMaterial({
    color: 0x141822,
    metalness: 0.9,
    roughness: 0.25,
    opacity: 1,
    transparent: false,
    emissive: 0x000000,
  });
  const root_0_0 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.033600000000000005, 1.55, 16, 1), mat_0);
  root_0_0.name = "barrelL";
  root_0_0.position.set(-0.0450, 0.0000, -0.9500);
  root_0_0.rotation.set(1.5708, 0.0000, 0.0000);
  root_0_0.scale.set(1.0000, 1.0000, 1.0000);
  root_0.add(root_0_0);
  const root_0_1 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.033600000000000005, 1.55, 16, 1), mat_0);
  root_0_1.name = "barrelR";
  root_0_1.position.set(0.0450, 0.0000, -0.9500);
  root_0_1.rotation.set(1.5708, 0.0000, 0.0000);
  root_0_1.scale.set(1.0000, 1.0000, 1.0000);
  root_0.add(root_0_1);
  const mat_1 = new THREE.MeshStandardMaterial({
    color: 0x0f0f12,
    metalness: 0.95,
    roughness: 0.25,
    opacity: 1,
    transparent: false,
    emissive: 0x000000,
  });
  const root_0_2 = new THREE.Mesh(new THREE.TorusGeometry(0.0304, 0.006, 8, 16, 6.283185307179586), mat_1);
  root_0_2.name = "muzzleL";
  root_0_2.position.set(-0.0450, 0.0000, -1.7250);
  root_0_2.rotation.set(0.0000, 0.0000, 0.0000);
  root_0_2.scale.set(1.0000, 1.0000, 1.0000);
  root_0.add(root_0_2);
  const root_0_3 = new THREE.Mesh(new THREE.TorusGeometry(0.0304, 0.006, 8, 16, 6.283185307179586), mat_1);
  root_0_3.name = "muzzleR";
  root_0_3.position.set(0.0450, 0.0000, -1.7250);
  root_0_3.rotation.set(0.0000, 0.0000, 0.0000);
  root_0_3.scale.set(1.0000, 1.0000, 1.0000);
  root_0.add(root_0_3);
  const root_0_4 = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.012, 1.55), mat_1);
  root_0_4.name = "rib";
  root_0_4.position.set(0.0000, 0.0304, -0.9500);
  root_0_4.rotation.set(0.0000, 0.0000, 0.0000);
  root_0_4.scale.set(1.0000, 1.0000, 1.0000);
  root_0.add(root_0_4);
  root.add(root_0);
  const root_1 = new THREE.Group();
  root_1.name = "sights";
  const root_1_0 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.03), mat_1);
  root_1_0.name = "";
  root_1_0.position.set(0.0000, 0.0500, -1.6850);
  root_1_0.rotation.set(0.0000, 0.0000, 0.0000);
  root_1_0.scale.set(1.0000, 1.0000, 1.0000);
  root_1.add(root_1_0);
  const mat_2 = new THREE.MeshStandardMaterial({
    color: 0xafa2a0,
    opacity: 1,
    transparent: false,
  });
  const root_1_1 = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 10), mat_2);
  root_1_1.name = "frontSightDot";
  root_1_1.position.set(0.0000, 0.0680, -1.6850);
  root_1_1.rotation.set(0.0000, 0.0000, 0.0000);
  root_1_1.scale.set(1.0000, 1.0000, 1.0000);
  root_1.add(root_1_1);
  const root_1_2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.04), mat_1);
  root_1_2.name = "";
  root_1_2.position.set(0.0000, 0.0470, -0.2950);
  root_1_2.rotation.set(0.0000, 0.0000, 0.0000);
  root_1_2.scale.set(1.0000, 1.0000, 1.0000);
  root_1.add(root_1_2);
  const root_1_3 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.03), mat_1);
  root_1_3.name = "";
  root_1_3.position.set(-0.0200, 0.0670, -0.2950);
  root_1_3.rotation.set(0.0000, 0.0000, 0.0000);
  root_1_3.scale.set(1.0000, 1.0000, 1.0000);
  root_1.add(root_1_3);
  const root_1_4 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.03), mat_1);
  root_1_4.name = "";
  root_1_4.position.set(0.0200, 0.0670, -0.2950);
  root_1_4.rotation.set(0.0000, 0.0000, 0.0000);
  root_1_4.scale.set(1.0000, 1.0000, 1.0000);
  root_1.add(root_1_4);
  root.add(root_1);
  const root_2 = new THREE.Group();
  root_2.name = "receiver";
  const mat_3 = new THREE.MeshStandardMaterial({
    color: 0x1a1e26,
    metalness: 0.85,
    roughness: 0.35,
    opacity: 1,
    transparent: false,
    emissive: 0x000000,
  });
  const root_2_0 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.32), mat_3);
  root_2_0.name = "receiverBody";
  root_2_0.position.set(0.0000, -0.0100, -0.0200);
  root_2_0.rotation.set(0.0000, 0.0000, 0.0000);
  root_2_0.scale.set(1.0000, 1.0000, 1.0000);
  root_2.add(root_2_0);
  const mat_4 = new THREE.MeshStandardMaterial({
    color: 0x555555,
    metalness: 0.8,
    roughness: 0.4,
    opacity: 1,
    transparent: false,
    emissive: 0x000000,
  });
  const root_2_1 = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.05, 0.02), mat_4);
  root_2_1.name = "";
  root_2_1.position.set(0.0660, -0.0050, -0.0800);
  root_2_1.rotation.set(0.0000, 0.0000, 0.0000);
  root_2_1.scale.set(1.0000, 1.0000, 1.0000);
  root_2.add(root_2_1);
  const root_2_2 = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.05, 0.02), mat_4);
  root_2_2.name = "";
  root_2_2.position.set(0.0660, -0.0050, -0.0200);
  root_2_2.rotation.set(0.0000, 0.0000, 0.0000);
  root_2_2.scale.set(1.0000, 1.0000, 1.0000);
  root_2.add(root_2_2);
  const root_2_3 = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.05, 0.02), mat_4);
  root_2_3.name = "";
  root_2_3.position.set(0.0660, -0.0050, 0.0400);
  root_2_3.rotation.set(0.0000, 0.0000, 0.0000);
  root_2_3.scale.set(1.0000, 1.0000, 1.0000);
  root_2.add(root_2_3);
  root.add(root_2);
  const root_3 = new THREE.Group();
  root_3.name = "stock";
  const mat_5 = new THREE.MeshStandardMaterial({
    color: 0x5a2f12,
    metalness: 0.05,
    roughness: 0.75,
    opacity: 1,
    transparent: false,
    emissive: 0x000000,
  });
  const root_3_0 = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.18), mat_5);
  root_3_0.name = "stockNeck";
  root_3_0.position.set(0.0000, -0.0500, 0.1200);
  root_3_0.rotation.set(0.0000, 0.0000, 0.0000);
  root_3_0.scale.set(1.0000, 1.0000, 1.0000);
  root_3.add(root_3_0);
  root.add(root_3);
  const root_4 = new THREE.Group();
  root_4.name = "forend";
  const mat_6 = new THREE.MeshStandardMaterial({
    color: 0x7a421c,
    metalness: 0.05,
    roughness: 0.65,
    opacity: 1,
    transparent: false,
    emissive: 0x000000,
  });
  const root_4_0 = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.07, 0.35), mat_6);
  root_4_0.name = "forendBody";
  root_4_0.position.set(0.0000, -0.0550, -0.2500);
  root_4_0.rotation.set(0.0000, 0.0000, 0.0000);
  root_4_0.scale.set(1.0000, 1.0000, 1.0000);
  root_4.add(root_4_0);
  const root_4_1 = new THREE.Mesh(new THREE.BoxGeometry(0.12928, 0.002, 0.008), mat_1);
  root_4_1.name = "";
  root_4_1.position.set(0.0000, -0.0200, -0.7800);
  root_4_1.rotation.set(0.0000, 0.0000, 0.0000);
  root_4_1.scale.set(1.0000, 1.0000, 1.0000);
  root_4.add(root_4_1);
  const root_4_2 = new THREE.Mesh(new THREE.BoxGeometry(0.12928, 0.002, 0.008), mat_1);
  root_4_2.name = "";
  root_4_2.position.set(0.0000, -0.0200, -0.7200);
  root_4_2.rotation.set(0.0000, 0.0000, 0.0000);
  root_4_2.scale.set(1.0000, 1.0000, 1.0000);
  root_4.add(root_4_2);
  const root_4_3 = new THREE.Mesh(new THREE.BoxGeometry(0.12928, 0.002, 0.008), mat_1);
  root_4_3.name = "";
  root_4_3.position.set(0.0000, -0.0200, -0.6600);
  root_4_3.rotation.set(0.0000, 0.0000, 0.0000);
  root_4_3.scale.set(1.0000, 1.0000, 1.0000);
  root_4.add(root_4_3);
  const root_4_4 = new THREE.Mesh(new THREE.BoxGeometry(0.12928, 0.002, 0.008), mat_1);
  root_4_4.name = "";
  root_4_4.position.set(0.0000, -0.0200, -0.6000);
  root_4_4.rotation.set(0.0000, 0.0000, 0.0000);
  root_4_4.scale.set(1.0000, 1.0000, 1.0000);
  root_4.add(root_4_4);
  const root_4_5 = new THREE.Mesh(new THREE.BoxGeometry(0.12928, 0.002, 0.008), mat_1);
  root_4_5.name = "";
  root_4_5.position.set(0.0000, -0.0200, -0.5400);
  root_4_5.rotation.set(0.0000, 0.0000, 0.0000);
  root_4_5.scale.set(1.0000, 1.0000, 1.0000);
  root_4.add(root_4_5);
  root.add(root_4);
  const root_5 = new THREE.Group();
  root_5.name = "trigger";
  const root_5_0 = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 8, 16, 3.141592653589793), mat_1);
  root_5_0.name = "";
  root_5_0.position.set(0.0000, -0.0750, 0.0500);
  root_5_0.rotation.set(2.0944, 1.5708, 1.5708);
  root_5_0.scale.set(1.0000, 1.0000, 1.0000);
  root_5.add(root_5_0);
  const root_5_1 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.045, 8, 1), mat_1);
  root_5_1.name = "";
  root_5_1.position.set(0.0000, -0.0700, 0.0500);
  root_5_1.rotation.set(0.3491, 0.0000, 0.0000);
  root_5_1.scale.set(1.0000, 1.0000, 1.0000);
  root_5.add(root_5_1);
  const root_5_2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8, 1), mat_1);
  root_5_2.name = "";
  root_5_2.position.set(-0.0450, 0.0400, 0.0600);
  root_5_2.rotation.set(-0.5000, 0.0000, 0.0000);
  root_5_2.scale.set(1.0000, 1.0000, 1.0000);
  root_5.add(root_5_2);
  const root_5_3 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8, 1), mat_1);
  root_5_3.name = "";
  root_5_3.position.set(0.0450, 0.0400, 0.0600);
  root_5_3.rotation.set(-0.5000, 0.0000, 0.0000);
  root_5_3.scale.set(1.0000, 1.0000, 1.0000);
  root_5.add(root_5_3);
  const mat_7 = new THREE.MeshStandardMaterial({
    color: 0xc9a227,
    metalness: 1,
    roughness: 0.3,
    opacity: 1,
    transparent: false,
    emissive: 0x000000,
  });
  const root_5_4 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.05), mat_7);
  root_5_4.name = "";
  root_5_4.position.set(0.0300, 0.0200, -0.0300);
  root_5_4.rotation.set(0.0000, 0.0000, 0.0000);
  root_5_4.scale.set(1.2500, 1.0000, 1.6000);
  root_5.add(root_5_4);
  root.add(root_5);

  return root;
}

// Конец сгенерированного файла.