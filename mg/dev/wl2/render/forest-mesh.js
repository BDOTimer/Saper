import * as THREE from 'three';
import { TILE } from './renderer.js';
import { mulberry32 } from '../core/rng.js';

const TREE_COUNT_MIN = 1;
const TREE_COUNT_MAX = 4;
const TREE_HEIGHT_MIN = 0.3;
const TREE_HEIGHT_MAX = 0.6;
const CORNER_INSET_MIN = 0.1;
const CORNER_INSET_MAX = 0.3;
const TREE_BASE_LIFT = 0.002;

const CORNERS = [
  { x: -1, z: -1 },
  { x:  1, z: -1 },
  { x: -1, z:  1 },
  { x:  1, z:  1 },
];

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function makePart(geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion(),
    new THREE.Vector3(sx, sy, sz)
  );
  return { geometry, material, matrix };
}

function createTreeTypes() {
  const geometries = [];
  const materials = [];

  const addGeometry = (g) => { geometries.push(g); return g; };
  const addMaterial = (m) => { materials.push(m); return m; };

  const trunk = addMaterial(new THREE.MeshStandardMaterial({
    color: 0x5b3f2a, roughness: 1, metalness: 0, flatShading: true,
  }));

  const spruceLow = addMaterial(new THREE.MeshStandardMaterial({
    color: 0x244b2b, roughness: 1, metalness: 0, flatShading: true,
  }));
  const spruceMid = addMaterial(new THREE.MeshStandardMaterial({
    color: 0x2f5f33, roughness: 1, metalness: 0, flatShading: true,
  }));
  const spruceTop = addMaterial(new THREE.MeshStandardMaterial({
    color: 0x3a703c, roughness: 1, metalness: 0, flatShading: true,
  }));

  const oakDark = addMaterial(new THREE.MeshStandardMaterial({
    color: 0x3b6630, roughness: 1, metalness: 0, flatShading: true,
  }));
  const oakMid = addMaterial(new THREE.MeshStandardMaterial({
    color: 0x477a39, roughness: 1, metalness: 0, flatShading: true,
  }));
  const oakLight = addMaterial(new THREE.MeshStandardMaterial({
    color: 0x568a43, roughness: 1, metalness: 0, flatShading: true,
  }));

  const spruce = [
    makePart(addGeometry(new THREE.CylinderGeometry(0.035, 0.055, 0.55, 6)), trunk, 0, 0.275, 0),
    makePart(addGeometry(new THREE.ConeGeometry(0.28, 0.44, 7)), spruceLow, 0, 0.48, 0),
    makePart(addGeometry(new THREE.ConeGeometry(0.22, 0.38, 7)), spruceMid, 0, 0.66, 0),
    makePart(addGeometry(new THREE.ConeGeometry(0.15, 0.32, 7)), spruceTop, 0, 0.84, 0),
  ];

  const oak = [
    makePart(addGeometry(new THREE.CylinderGeometry(0.045, 0.065, 0.55, 6)), trunk, 0, 0.275, 0),
    makePart(addGeometry(new THREE.SphereGeometry(0.24, 7, 5)), oakMid, 0, 0.68, 0, 1, 0.9, 1),
    makePart(addGeometry(new THREE.SphereGeometry(0.16, 7, 5)), oakDark, -0.12, 0.60, 0.02),
    makePart(addGeometry(new THREE.SphereGeometry(0.15, 7, 5)), oakLight, 0.12, 0.64, -0.03),
    makePart(addGeometry(new THREE.SphereGeometry(0.14, 7, 5)), oakMid, 0, 0.86, 0),
  ];

  return { types: [spruce, oak], geometries, materials };
}

export class ForestView {
  constructor(mapView) {
    this.mapView = mapView;
    this.scene = mapView.scene;
    this.group = null;
    this._meshes = [];
    this._geometries = [];
    this._materials = [];
  }

  rebuild() {
    this.destroy();

    const world = this.mapView.world;
    if (!world?.cells?.length) return;

    const trees = [[], []];

    for (const cell of world.cells) {
      if (!cell || cell.type !== 'forest') continue;

      const rng = mulberry32(
        (world.seed ^ 0xF0E5) + cell.x * 73856093 + cell.y * 19349663
      );

      const count = TREE_COUNT_MIN +
        Math.floor(rng() * (TREE_COUNT_MAX - TREE_COUNT_MIN + 1));

      const cornerOrder = [0, 1, 2, 3];
      for (let i = cornerOrder.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = cornerOrder[i];
        cornerOrder[i] = cornerOrder[j];
        cornerOrder[j] = t;
      }

      const baseX = this.mapView._worldX(cell.x);
      const baseY = this.mapView._worldY(cell) + 0.15 + TREE_BASE_LIFT;
      const baseZ = this.mapView._worldZ(cell.y);

      for (let i = 0; i < count; i++) {
        const corner = CORNERS[cornerOrder[i]];
        const type = rng() < 0.5 ? 0 : 1;
        const height = TREE_HEIGHT_MIN +
          rng() * (TREE_HEIGHT_MAX - TREE_HEIGHT_MIN);
        const inset = CORNER_INSET_MIN +
          rng() * (CORNER_INSET_MAX - CORNER_INSET_MIN);
        const edge = TILE * 0.5 - inset * TILE;

        trees[type].push({
          x: baseX + corner.x * edge,
          y: baseY,
          z: baseZ + corner.z * edge,
          rotation: rng() * Math.PI * 2,
          scale: height,
        });
      }
    }

    if (!trees[0].length && !trees[1].length) return;

    const { types, geometries, materials } = createTreeTypes();
    this._geometries = geometries;
    this._materials = materials;

    this.group = new THREE.Group();
    this.group.name = 'ForestLayer';
    this.scene.add(this.group);

    const baseMatrix = new THREE.Matrix4();
    const worldMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let typeIndex = 0; typeIndex < types.length; typeIndex++) {
      const list = trees[typeIndex];
      if (!list.length) continue;

      for (let partIndex = 0; partIndex < types[typeIndex].length; partIndex++) {
        const part = types[typeIndex][partIndex];
        const mesh = new THREE.InstancedMesh(
          part.geometry, part.material, list.length
        );
        mesh.name = `Forest_${typeIndex}_${partIndex}`;
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.castShadow = true;

        for (let i = 0; i < list.length; i++) {
          const tree = list[i];
          position.set(tree.x, tree.y, tree.z);
          rotation.setFromAxisAngle(Y_AXIS, tree.rotation);
          scale.setScalar(tree.scale);
          baseMatrix.compose(position, rotation, scale);
          worldMatrix.multiplyMatrices(baseMatrix, part.matrix);
          mesh.setMatrixAt(i, worldMatrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        this.group.add(mesh);
        this._meshes.push(mesh);
      }
    }
  }

  destroy() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.clear();
      this.group = null;
    }

    for (const mesh of this._meshes) mesh.dispose?.();
    this._meshes.length = 0;

    for (const geometry of this._geometries) geometry.dispose?.();
    this._geometries.length = 0;

    for (const material of this._materials) material.dispose?.();
    this._materials.length = 0;
  }
}
