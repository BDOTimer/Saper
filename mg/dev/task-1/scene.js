/**
 * scene.js — вся 3D-часть игры на Three.js.
 *
 * Отвечает за:
 *   - инициализацию сцены, камеры, рендерера и света;
 *   - текстурированные пол, обои, полки и «мокрую» синюю стойку;
 *   - 12 кликабельных объектов ингредиентов;
 *   - очередь клиентов перед стойкой (туловище, голова, руки, ноги);
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

/** Клиенты стоят ПЕРЕД стойкой, ближе к зрителю, чем прилавок. */
const CLIENT_Z = 2.45;
const CLIENT_SLOTS_X = [-1.35, -0.45, 0.45, 1.35];

/**
 * Вся стойка сдвинута вправо: на экране она должна занимать свободную
 * часть — между левыми панелями и правым краем окна.
 */
const WORLD_OFFSET_X = 2.4;

/** Цвета одежды клиентов — чтобы очередь визуально различалась. */
const CLIENT_COLORS = [0xf06292, 0x4fc3f7, 0xffd54f, 0x81c784];

/** Цвет кожи клиентов. */
const SKIN_COLOR = 0xe8b98f;

/** Цвет брюк клиентов. */
const PANTS_COLOR = 0x2b3242;

/** Пути к текстурам (лежат в папке res проекта). */
const WALL_TEXTURE_PATH = 'res/wall-1.jpg';
const SHELF_TEXTURE_PATH = 'res/shelf-1.jpg';
const FLOOR_TEXTURE_PATH = 'res/floor-1.jpg';

/** Размер исходной картинки обоев и доля, занятая самими обоями (ниже — пол). */
const WALL_IMAGE_WIDTH = 900;
const WALL_IMAGE_HEIGHT = 720;
const WALL_WALLPAPER_PART = 0.7;

const textureLoader = new THREE.TextureLoader();

let scene = null;
let camera = null;
let renderer = null;

/**
 * Группа всей стойки (прилавок, полки, ингредиенты, клиенты, свет над ними).
 * Сдвигая одну группу, двигаем по экрану всю сцену целиком.
 */
const world = new THREE.Group();

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
 * Собирает человекоподобную фигуру клиента: ноги, туловище, руки, голова.
 * @param {number} color — цвет одежды
 * @returns {THREE.Group}
 */
function createHumanoid(color) {
  const client = new THREE.Group();

  const skinMaterial = new THREE.MeshStandardMaterial({
    color: SKIN_COLOR,
    roughness: 0.75,
    metalness: 0,
  });
  const clothMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.03,
  });
  const pantsMaterial = new THREE.MeshStandardMaterial({
    color: PANTS_COLOR,
    roughness: 0.85,
    metalness: 0,
  });

  // Ноги
  [-0.11, 0.11].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.62, 10), pantsMaterial);
    leg.position.set(x, 0.31, 0);
    client.add(leg);
  });

  // Туловище
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.42, 6, 14), clothMaterial);
  torso.position.set(0, 1.03, 0);
  client.add(torso);

  // Руки
  [-0.27, 0.27].forEach((x) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.52, 8), clothMaterial);
    arm.position.set(x, 1.05, 0);
    arm.rotation.z = x > 0 ? -0.16 : 0.16;
    client.add(arm);
  });

  // Голова
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), skinMaterial);
  head.position.set(0, 1.52, 0);
  client.add(head);

  return client;
}

/**
 * Создаёт клиента и ставит его в указанный слот очереди перед стойкой.
 * @param {number} slotIndex — 0..3
 * @returns {THREE.Group}
 */
function createClientObject(slotIndex) {
  const color = CLIENT_COLORS[clientColorCursor % CLIENT_COLORS.length];
  clientColorCursor += 1;

  // Страховка: слот всегда существует, даже если очередь окажется длиннее
  const safeSlot = Math.min(slotIndex, CLIENT_SLOTS_X.length - 1);

  const client = createHumanoid(color);
  client.position.set(CLIENT_SLOTS_X[safeSlot], 0, CLIENT_Z);
  client.userData.slotIndex = safeSlot;
  client.userData.targetX = CLIENT_SLOTS_X[safeSlot];

  world.add(client);
  return client;
}

/** Пол кафе — паркет из res/floor-1.jpg. */
function buildFloor() {
  const texture = textureLoader.load(FLOOR_TEXTURE_PATH);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  texture.center.set(0.5, 0.5);
  // Доски разворачиваем вдоль оси Z — «от зрителя в глубину»
  texture.rotation = Math.PI / 2;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({
      map: texture,
      // Текстура серая — подкрашиваем её под дерево кафе
      color: 0x9a8574,
      roughness: 0.7,
      metalness: 0.02,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);
}

/**
 * Общий фон сцены — обои из res/wall-1.jpg.
 * В картинке сверху обои, снизу деревянный пол, поэтому берём только
 * верхнюю часть текстуры, а пол в сцене свой, трёхмерный.
 */
function buildWallBackground() {
  const texture = textureLoader.load(WALL_TEXTURE_PATH);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, WALL_WALLPAPER_PART);
  texture.offset.set(0, 1 - WALL_WALLPAPER_PART);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // Плоскость единичного размера, растянутая по пропорциям обоев.
  // Ширины хватает даже на очень широкое окно.
  const wallpaperRatio = (WALL_IMAGE_HEIGHT * WALL_WALLPAPER_PART) / WALL_IMAGE_WIDTH;
  const width = 32;
  const height = width * wallpaperRatio;

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  backdrop.scale.set(width, height, 1);
  backdrop.position.set(0, height / 2, -2.15);
  scene.add(backdrop);
}

/** Материал полок — деревянная доска из res/shelf-1.jpg. */
function createShelfMaterial() {
  const texture = textureLoader.load(SHELF_TEXTURE_PATH);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0x8f7663,
    roughness: 0.72,
    metalness: 0.04,
  });
}

/**
 * Материал стойки: тёмно-синий PBR с clearcoat («мокрый» блеск).
 * В вершинный/фрагментный шейдер добавлен вертикальный градиент:
 * низ стола заметно темнее верха.
 *
 * @param {object} options
 * @param {number} options.topColor — цвет верхней кромки
 * @param {number} options.bottomColor — цвет низа
 * @param {number} options.height — высота геометрии (для нормировки градиента)
 * @param {number} options.roughness
 * @param {number} options.clearcoatRoughness
 * @returns {THREE.MeshPhysicalMaterial}
 */
function createCounterMaterial({ topColor, bottomColor, height, roughness, clearcoatRoughness }) {
  const material = new THREE.MeshPhysicalMaterial({
    // Запасной цвет: если шейдер почему-то не применится, стол останется синим
    color: new THREE.Color(topColor),
    roughness,
    metalness: 0.28,
    clearcoat: 1,
    clearcoatRoughness,
  });

  const halfHeight = height / 2;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTopColor = { value: new THREE.Color(topColor) };
    shader.uniforms.uBottomColor = { value: new THREE.Color(bottomColor) };
    shader.uniforms.uHalfHeight = { value: halfHeight };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        ['#include <common>', 'uniform float uHalfHeight;', 'varying float vHeightRatio;'].join('\n'),
      )
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'vHeightRatio = clamp((position.y + uHalfHeight) / (2.0 * uHalfHeight), 0.0, 1.0);',
        ].join('\n'),
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        [
          '#include <common>',
          'uniform vec3 uTopColor;',
          'uniform vec3 uBottomColor;',
          'varying float vHeightRatio;',
        ].join('\n'),
      )
      .replace(
        '#include <color_fragment>',
        [
          '#include <color_fragment>',
          'diffuseColor.rgb = mix(uBottomColor, uTopColor, vHeightRatio);',
        ].join('\n'),
      );
  };

  // Код градиента одинаковый — скомпилированную программу можно делить
  material.customProgramCacheKey = () => 'counter-wet-gradient';

  return material;
}

/** Строит стойку с полками и общим фоном. */
function buildCounterAndShelves() {
  // Пол кафе
  buildFloor();

  // Обои на общем фоне
  buildWallBackground();

  // Стойка-прилавок: тёмно-синяя, низ темнее верха (шейдер), сверху «мокрый» блеск
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(8, 1, 1.6),
    createCounterMaterial({
      topColor: 0x16386b,
      bottomColor: 0x050b18,
      height: 1,
      roughness: 0.22,
      clearcoatRoughness: 0.08,
    }),
  );
  counter.position.set(0, 0.5, 1);
  world.add(counter);

  // Глянцевая столешница — тот же синий, но с более резким блеском
  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.1, 1.7),
    createCounterMaterial({
      topColor: 0x1c4785,
      bottomColor: 0x0a1730,
      height: 0.1,
      roughness: 0.08,
      clearcoatRoughness: 0.03,
    }),
  );
  counterTop.position.set(0, 1.05, 1);
  world.add(counterTop);

  // Боковые стойки полок
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: 0x3f2e21,
    roughness: 0.85,
    metalness: 0,
  });
  [-3.3, 3.3].forEach((x) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.9), sideMaterial);
    side.position.set(x, 2.15, -1.6);
    world.add(side);
  });

  // Три полки с деревянной текстурой
  const shelfMaterial = createShelfMaterial();

  Object.values(SHELF_HEIGHTS).forEach((shelfY) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.12, 0.7), shelfMaterial);
    shelf.position.set(0, shelfY, SHELF_Z);
    world.add(shelf);
  });
}

/** Раскладывает 12 ингредиентов по полкам. */
function buildIngredients() {
  INGREDIENTS.forEach((ingredient) => {
    const shelfY = SHELF_HEIGHTS[ingredient.shelfIndex];
    if (shelfY === undefined) return;

    // Полка — бокс толщиной 0.12, её верхняя плоскость выше центра на 0.06.
    const mesh = createIngredientObject(ingredient, shelfY + 0.06);
    world.add(mesh);
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

  // Вся стойка живёт в отдельной группе и сдвинута вправо
  world.position.set(WORLD_OFFSET_X, 0, 0);
  scene.add(world);

  // Точечный свет над прилавком — яркое пятно на «мокрой» столешнице
  const counterGlow = new THREE.PointLight(0xcfe4ff, 14, 16, 2);
  counterGlow.position.set(0, 3.6, 1.5);
  world.add(counterGlow);

  // Тёплый точечный свет у очереди — подсвечивает клиентов
  const warmGlow = new THREE.PointLight(0xffb066, 7, 12, 2);
  warmGlow.position.set(-0.4, 2.6, 4.1);
  world.add(warmGlow);

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

/** @returns {THREE.Group[]} живые 3D-объекты клиентов в порядке очереди */
export function getClientObjects() {
  return clientObjects;
}

/**
 * Убирает ушедшего клиента со сцены и создаёт нового в конце очереди.
 * Возвращает 3D-объект нового клиента, чтобы вызвавший код поставил его в слот.
 * @param {THREE.Group} clientObject
 * @returns {THREE.Group|null}
 */
export function removeClient(clientObject) {
  if (!clientObject) return null;

  const index = clientObjects.indexOf(clientObject);
  if (index !== -1) {
    clientObjects.splice(index, 1);
  }

  world.remove(clientObject);

  // У каждого клиента свои материалы и геометрии — освобождаем всё
  clientObject.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry.dispose();
    child.material.dispose();
  });

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
