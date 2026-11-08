/**
 * scene.js — вся 3D-часть игры на Three.js.
 *
 * Отвечает за:
 *   - инициализацию сцены, камеры, рендерера и света;
 *   - стойку, три полки и заднюю стенку;
 *   - 12 кликабельных объектов ингредиентов;
 *   - очередь клиентов за стойкой;
 *   - подсветку выбранного ингредиента.
 *
 * Экспорт: initScene, getIngredientObjects, getClientObjects, removeClient,
 * highlightIngredient.
 */

import * as THREE from 'three';
import { INGREDIENTS } from './data.js';

/** Высота каждой полки (по требованию задания). */
const SHELF_HEIGHTS = { 1: 1.5, 2: 2.2, 3: 2.9 };

/** Полки висят на задней стенке, чуть впереди неё. */
const SHELF_Z = -1.55;

/** Клиенты стоят в линию за стойкой. */
const CLIENT_Z = -1;
const CLIENT_SLOTS_X = [-2, -0.7, 0.7, 2];

/** Цвета клиентов — чтобы очередь визуально различалась. */
const CLIENT_COLORS = [0xf06292, 0x4fc3f7, 0xffd54f, 0x81c784];

let scene = null;
let camera = null;
let renderer = null;

/** Живые 3D-объекты ингредиентов (по одному на ингредиент). */
const ingredientObjects = [];

/** Живые 3D-объекты клиентов в порядке очереди. */
const clientObjects = [];

/** Счётчик, чтобы новые клиенты получали разные цвета. */
let clientColorCursor = 0;

/**
 * Создаёт 3D-объект ингредиента нужной формы и ставит его на полку.
 * @param {object} ingredient — запись из INGREDIENTS
 * @param {number} shelfTop — мировая высота верхней плоскости полки
 * @returns {THREE.Mesh}
 */
function createIngredientObject(ingredient, shelfTop) {
  let geometry;
  switch (ingredient.shape) {
    case 'cylinder':
      geometry = new THREE.CylinderGeometry(0.21, 0.21, 0.42, 20);
      break;
    case 'sphere':
      geometry = new THREE.SphereGeometry(0.23, 22, 16);
      break;
    default:
      geometry = new THREE.BoxGeometry(0.38, 0.38, 0.38);
  }

  // Материал создаётся отдельно для каждого ингредиента,
  // иначе подсветка одного объекта «зажгла» бы все остальные.
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(ingredient.color),
    roughness: 0.55,
    metalness: 0.08,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 1,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Ставим объект так, чтобы он лежал на полке ровно.
  geometry.computeBoundingBox();
  const height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;

  const x = -2.7 + ingredient.slot * 1.8;
  const y = shelfTop + height / 2;

  mesh.position.set(x, y, SHELF_Z);
  mesh.rotation.y = ingredient.slot * 0.35; // лёгкий поворот — так виднее форму

  // Связь 3D-объекта с данными: по нему Raycaster находит ингредиент.
  mesh.userData.ingredientId = ingredient.id;
  mesh.userData.baseY = y;
  mesh.userData.ingredientName = ingredient.name;

  return mesh;
}

/**
 * Создаёт клиента-капсулу и ставит его в указанный слот очереди.
 * @param {number} slotIndex — 0..3
 * @returns {THREE.Mesh}
 */
function createClientObject(slotIndex) {
  const color = CLIENT_COLORS[clientColorCursor % CLIENT_COLORS.length];
  clientColorCursor += 1;

  // Страховка: слот всегда существует, даже если очередь окажется длиннее
  const safeSlot = Math.min(slotIndex, CLIENT_SLOTS_X.length - 1);

  const geometry = new THREE.CapsuleGeometry(0.32, 0.55, 6, 16);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.05,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(CLIENT_SLOTS_X[safeSlot], 0.6, CLIENT_Z);
  mesh.userData.slotIndex = safeSlot;
  mesh.userData.targetX = CLIENT_SLOTS_X[safeSlot];

  scene.add(mesh);
  return mesh;
}

/** Строит стойку с полками и задней стенкой. */
function buildCounterAndShelves() {
  // Пол кафе
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x2f2318, roughness: 0.95, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  // Задняя стенка, чтобы полки не висели в пустоте
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(10, 5, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x4b382a, roughness: 0.9, metalness: 0 }),
  );
  wall.position.set(0, 2.5, -2.05);
  scene.add(wall);

  // Стойка-прилавок
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(8, 1, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x5c4331, roughness: 0.8, metalness: 0.05 }),
  );
  counter.position.set(0, 0.5, 1);
  scene.add(counter);

  // Светлая столешница
  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.1, 1.7),
    new THREE.MeshStandardMaterial({ color: 0x7a5a3e, roughness: 0.6, metalness: 0.1 }),
  );
  counterTop.position.set(0, 1.05, 1);
  scene.add(counterTop);

  // Боковые стойки полок
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: 0x3f2e21,
    roughness: 0.85,
    metalness: 0,
  });
  [-3.3, 3.3].forEach((x) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.9), sideMaterial);
    side.position.set(x, 2.15, -1.6);
    scene.add(side);
  });

  // Три полки
  const shelfMaterial = new THREE.MeshStandardMaterial({
    color: 0x6e5039,
    roughness: 0.75,
    metalness: 0.05,
  });

  Object.values(SHELF_HEIGHTS).forEach((shelfY) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.12, 0.7), shelfMaterial);
    shelf.position.set(0, shelfY, SHELF_Z);
    scene.add(shelf);
  });
}

/** Раскладывает 12 ингредиентов по полкам. */
function buildIngredients() {
  INGREDIENTS.forEach((ingredient) => {
    const shelfY = SHELF_HEIGHTS[ingredient.shelfIndex];
    if (shelfY === undefined) return;

    // Полка — бокс толщиной 0.12, её верхняя плоскость выше центра на 0.06.
    const mesh = createIngredientObject(ingredient, shelfY + 0.06);
    scene.add(mesh);
    ingredientObjects.push(mesh);
  });
}

/** Создаёт стартовую очередь из четырёх клиентов. */
function buildClients() {
  CLIENT_SLOTS_X.forEach((_, slotIndex) => {
    const mesh = createClientObject(slotIndex);
    clientObjects.push(mesh);
  });
}

/** Подгоняет камеру и рендерер под текущий размер окна. */
function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
}

/**
 * Инициализирует 3D-сцену.
 * @param {HTMLCanvasElement} canvas — canvas, в который рисует рендерер
 * @returns {{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer }}
 */
export function initScene(canvas) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x17100b);

  // Фиксированный ракурс: видим стойку, три полки за ней и очередь клиентов
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 4, 8);
  camera.lookAt(0, 1, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Мягкий заполняющий свет
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  // Направленный свет сверху-сбоку (тени выключены — приоритет производительности)
  const keyLight = new THREE.DirectionalLight(0xffffff, 1);
  keyLight.position.set(5, 8, 6);
  scene.add(keyLight);

  buildCounterAndShelves();
  buildIngredients();
  buildClients();

  // Корректная работа Raycaster при изменении размера окна
  window.addEventListener('resize', handleResize);

  return { scene, camera, renderer };
}

/** @returns {THREE.Mesh[]} живые 3D-объекты ингредиентов */
export function getIngredientObjects() {
  return ingredientObjects;
}

/** @returns {THREE.Mesh[]} живые 3D-объекты клиентов в порядке очереди */
export function getClientObjects() {
  return clientObjects;
}

/**
 * Убирает ушедшего клиента со сцены и создаёт нового в конце очереди.
 * Возвращает 3D-объект нового клиента, чтобы вызвавший код поставил его в слот.
 * @param {THREE.Mesh} clientObject
 * @returns {THREE.Mesh|null}
 */
export function removeClient(clientObject) {
  if (!clientObject) return null;

  const index = clientObjects.indexOf(clientObject);
  if (index !== -1) {
    clientObjects.splice(index, 1);
  }

  scene.remove(clientObject);
  clientObject.geometry.dispose();
  clientObject.material.dispose();

  // Новый клиент подходит с конца очереди
  const freshClient = createClientObject(clientObjects.length);
  clientObjects.push(freshClient);

  return freshClient;
}

/**
 * Подсвечивает выбранный ингредиент: поднимает, увеличивает и включает emissive.
 * @param {THREE.Mesh} mesh
 * @param {boolean} isSelected
 */
export function highlightIngredient(mesh, isSelected) {
  if (!mesh) return;

  if (isSelected) {
    mesh.scale.setScalar(1.15);
    mesh.position.y = mesh.userData.baseY + 0.12;
    mesh.material.emissive.setHex(0xffc14d);
    mesh.material.emissiveIntensity = 0.85;
  } else {
    mesh.scale.setScalar(1);
    mesh.position.y = mesh.userData.baseY;
    mesh.material.emissive.setHex(0x000000);
    mesh.material.emissiveIntensity = 1;
  }
}
