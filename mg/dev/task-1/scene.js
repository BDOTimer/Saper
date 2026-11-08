/**
 * scene.js — вся 3D-часть игры на Three.js.
 *
 * Отвечает за:
 *   - инициализацию сцены, камеры, рендерера и света;
 *   - текстурированные пол, обои, полки и «мокрую» синюю стойку;
 *   - 12 кликабельных моделей продуктов на полках;
 *   - очередь клиентов перед стойкой и продавца за стойкой;
 *   - подсветку выбранного ингредиента.
 *
 * Экспорт: initScene, getIngredientObjects, getClientObjects, createClient,
 * removeClient, highlightIngredient.
 */

import * as THREE from 'three';
import { INGREDIENTS } from './data.js';

/**
 * Высота каждой полки. Зазоры между полками увеличены на 20 % (0.70 → 0.84),
 * нижняя полка осталась на месте, вторая и третья подняты.
 */
const SHELF_HEIGHTS = { 1: 1.74, 2: 2.58, 3: 3.42 };

/** Верхняя плоскость столешницы — сюда ставим выбранные продукты. */
const COUNTER_TOP_Y = 1.1;

/** Ряд выбранных продуктов выставляется ближе к продавцу. */
const COUNTER_ITEM_Z = 0.45;

/** Полки висят на задней стенке, чуть впереди неё. */
const SHELF_Z = -1.55;

/** Клиенты стоят ПЕРЕД стойкой, ближе к зрителю, чем прилавок. */
const CLIENT_Z = 2.45;

/** Продавец стоит за стойкой, с обратной стороны от клиентов. */
const BARISTA_Z = 0.05;

/**
 * Вся стойка сдвинута вправо: на экране она должна занимать свободную
 * часть — между левыми панелями и правым краем окна.
 */
const WORLD_OFFSET_X = 2.4;

/**
 * Точка, на которую смотрит камера. Подобрана так, чтобы ступни клиентов
 * оказались в ~25 px от нижнего края окна.
 */
const CAMERA_TARGET_Y = 2.45;

/** Камера чуть сдвинута влево и смотрит правее — продавец в центре кадра. */
const CAMERA_POSITION = { x: -0.5, y: 4, z: 8 };
const CAMERA_TARGET_X = 0.45;

/** Во сколько раз увеличены модели продуктов на полках. */
const INGREDIENT_SCALE = 2;

/** Цвета одежды клиентов — чтобы очередь визуально различалась. */
const CLIENT_COLORS = [0xf06292, 0x4fc3f7, 0xffd54f, 0x81c784];

/** Палитра людей. */
const SKIN_COLOR = 0xe8b98f;
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

/** Выбранные продукты, выставленные на стойку перед продавцом. */
const counterItems = new THREE.Group();

/** Включает отбрасывание и приём тени у всех мешей объекта. */
function enableShadows(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

/** Живые 3D-объекты ингредиентов (по одному на ингредиент). */
const ingredientObjects = [];

/** Живые 3D-объекты клиентов в порядке очереди. */
const clientObjects = [];

/** Счётчик, чтобы новые клиенты получали разные цвета. */
let clientColorCursor = 0;

/** Приглушённый/осветлённый оттенок базового цвета (amount: -1..1). */
function shadeColor(color, amount) {
  const base = new THREE.Color(color);
  const target = new THREE.Color(amount > 0 ? 0xffffff : 0x000000);
  return base.clone().lerp(target, Math.min(1, Math.abs(amount)));
}

/** Материал продукта: свой emissive, чтобы работала подсветка выбора. */
function createProductMaterial(color, roughness = 0.58) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.06,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 1,
  });
}

/**
 * Собирает модель продукта из нескольких простых примитивов.
 * Низ модели — на y = 0: так её легко поставить на полку.
 *
 * @param {object} ingredient — запись из INGREDIENTS
 * @returns {THREE.Group}
 */
function createIngredientObject(ingredient) {
  const group = new THREE.Group();

  const mainMaterial = createProductMaterial(new THREE.Color(ingredient.color));
  const accentMaterial = createProductMaterial(shadeColor(ingredient.color, 0.35), 0.5);

  const part = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  switch (ingredient.shape) {
    // Салат или суп: чаша + «горка» содержимого
    case 'bowl': {
      part(new THREE.CylinderGeometry(0.22, 0.15, 0.13, 18), mainMaterial, 0, 0.065, 0);
      const filling = part(new THREE.SphereGeometry(0.17, 18, 12), accentMaterial, 0, 0.145, 0);
      filling.scale.set(1, 0.5, 1);
      break;
    }

    // Чашка кофе: конусное тело + ободок
    case 'cup': {
      part(new THREE.CylinderGeometry(0.12, 0.09, 0.24, 16), mainMaterial, 0, 0.12, 0);
      part(new THREE.CylinderGeometry(0.126, 0.126, 0.03, 16), accentMaterial, 0, 0.252, 0);
      break;
    }

    // Стакан сока: прозрачное стекло + жидкость
    case 'glass': {
      part(new THREE.CylinderGeometry(0.1, 0.078, 0.27, 16), accentMaterial, 0, 0.135, 0);
      part(new THREE.CylinderGeometry(0.088, 0.072, 0.18, 16), mainMaterial, 0, 0.115, 0);
      break;
    }

    // Соус: бутылочка с горлышком и крышкой
    case 'bottle': {
      part(new THREE.CylinderGeometry(0.085, 0.085, 0.18, 14), mainMaterial, 0, 0.09, 0);
      part(new THREE.CylinderGeometry(0.04, 0.055, 0.07, 12), accentMaterial, 0, 0.215, 0);
      part(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 12), accentMaterial, 0, 0.2625, 0);
      break;
    }

    // Хлеб: лежащий батон
    case 'loaf': {
      const loaf = part(new THREE.CapsuleGeometry(0.1, 0.2, 4, 12), mainMaterial, 0, 0.1, 0);
      loaf.rotation.z = Math.PI / 2;
      break;
    }

    // Паста: тарелка + горка
    case 'plate': {
      part(new THREE.CylinderGeometry(0.24, 0.2, 0.035, 20), accentMaterial, 0, 0.018, 0);
      const heap = part(new THREE.SphereGeometry(0.15, 18, 12), mainMaterial, 0, 0.11, 0);
      heap.scale.set(1, 0.5, 1);
      break;
    }

    // Бургер: нижняя булка, котлета, верхняя булка
    case 'burger': {
      part(new THREE.CylinderGeometry(0.17, 0.15, 0.07, 18), accentMaterial, 0, 0.035, 0);
      part(new THREE.CylinderGeometry(0.165, 0.165, 0.05, 18), mainMaterial, 0, 0.095, 0);
      const top = part(new THREE.SphereGeometry(0.17, 18, 12), accentMaterial, 0, 0.185, 0);
      top.scale.set(1, 0.5, 1);
      break;
    }

    // Десерт: корзинка, крем, вишенка
    case 'dessert': {
      part(new THREE.CylinderGeometry(0.13, 0.15, 0.09, 16), accentMaterial, 0, 0.045, 0);
      const cream = part(new THREE.SphereGeometry(0.11, 16, 12), mainMaterial, 0, 0.135, 0);
      cream.scale.set(1, 0.7, 1);
      part(new THREE.SphereGeometry(0.05, 12, 10), createProductMaterial(new THREE.Color(0xe53935)), 0, 0.21, 0);
      break;
    }

    // Запасной вариант — простой куб
    default: {
      part(new THREE.BoxGeometry(0.38, 0.38, 0.38), mainMaterial, 0, 0.19, 0);
    }
  }

  enableShadows(group);
  return group;
}

/**
 * Собирает человекоподобную фигуру: ноги, туловище, руки, голова.
 * @param {object} options
 * @param {number} options.clothColor — цвет одежды
 * @param {number} [options.skinColor]
 * @param {number} [options.pantsColor]
 * @param {number|null} [options.hairColor] — если задан, добавляются волосы
 * @param {boolean} [options.longHair] — длинные волосы до плеч
 * @returns {THREE.Group}
 */
function createHumanoid({
  clothColor,
  skinColor = SKIN_COLOR,
  pantsColor = PANTS_COLOR,
  hairColor = null,
  longHair = false,
}) {
  const person = new THREE.Group();

  const skinMaterial = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.75, metalness: 0 });
  const clothMaterial = new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.7, metalness: 0.03 });
  const pantsMaterial = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85, metalness: 0 });

  // Ноги
  [-0.11, 0.11].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.62, 10), pantsMaterial);
    leg.position.set(x, 0.31, 0);
    person.add(leg);
  });

  // Туловище
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.42, 6, 14), clothMaterial);
  torso.position.set(0, 1.03, 0);
  person.add(torso);

  // Руки
  [-0.27, 0.27].forEach((x) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.52, 8), clothMaterial);
    arm.position.set(x, 1.05, 0);
    arm.rotation.z = x > 0 ? -0.16 : 0.16;
    person.add(arm);
  });

  // Голова
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), skinMaterial);
  head.position.set(0, 1.52, 0);
  person.add(head);

  if (hairColor !== null) {
    const hairMaterial = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.85, metalness: 0 });

    // Шапка волос на макушке
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.168, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
      hairMaterial,
    );
    cap.position.set(0, 1.53, -0.01);
    person.add(cap);

    if (longHair) {
      // Длинные волосы сзади, до плеч
      const locks = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.46, 6, 12), hairMaterial);
      locks.position.set(0, 1.24, -0.11);
      locks.scale.set(1, 1, 0.6);
      person.add(locks);
    }
  }

  enableShadows(person);
  return person;
}

/** Создаёт нового клиента в очереди (позицию выставляет game.js). */
export function createClient() {
  const color = CLIENT_COLORS[clientColorCursor % CLIENT_COLORS.length];
  clientColorCursor += 1;

  const client = createHumanoid({ clothColor: color });
  client.position.set(0, 0, CLIENT_Z);
  client.userData.targetX = 0;

  world.add(client);
  clientObjects.push(client);
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
  floor.receiveShadow = true; // сюда падают тени клиентов
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
 * В шейдер добавлен вертикальный градиент: низ стола заметно темнее верха.
 */
function createCounterMaterial({ topColor, bottomColor, height, roughness, clearcoatRoughness }) {
  const material = new THREE.MeshPhysicalMaterial({
    // Запасной цвет: если шейдер не применится, стол останется синим
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
        ['#include <color_fragment>', 'diffuseColor.rgb = mix(uBottomColor, uTopColor, vHeightRatio);'].join('\n'),
      );
  };

  material.customProgramCacheKey = () => 'counter-wet-gradient';

  return material;
}

/** Строит стойку, полки, фон и продавца. */
function buildCounterAndShelves() {
  buildFloor();
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
    side.position.set(x, 2.33, -1.6);
    world.add(side);
  });

  // Три полки с деревянной текстурой
  const shelfMaterial = createShelfMaterial();

  Object.values(SHELF_HEIGHTS).forEach((shelfY) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.12, 0.7), shelfMaterial);
    shelf.position.set(0, shelfY, SHELF_Z);
    world.add(shelf);
  });

  // Продавец за стойкой: девушка с длинными волосами, лицом к клиентам
  const barista = createHumanoid({
    clothColor: 0xe9dcc8,
    skinColor: 0xf0c4a0,
    hairColor: 0xf2d67a,
    longHair: true,
  });
  barista.position.set(0, 0, BARISTA_Z);
  world.add(barista);
}

/** Раскладывает 12 моделей продуктов по полкам. */
function buildIngredients() {
  INGREDIENTS.forEach((ingredient) => {
    const shelfY = SHELF_HEIGHTS[ingredient.shelfIndex];
    if (shelfY === undefined) return;

    // Полка — бокс толщиной 0.12, её верхняя плоскость выше центра на 0.06.
    const shelfTop = shelfY + 0.06;
    const model = createIngredientObject(ingredient);

    model.position.set(-2.7 + ingredient.slot * 1.8, shelfTop, SHELF_Z);
    model.rotation.y = ingredient.slot * 0.35;
    // Продукты вдвое крупнее задуманного размера примитивов
    model.scale.setScalar(INGREDIENT_SCALE);

    // Связь 3D-объекта с данными: по нему Raycaster находит ингредиент
    model.userData.ingredientId = ingredient.id;
    model.userData.ingredientName = ingredient.name;
    model.userData.baseY = shelfTop;
    model.userData.baseScale = INGREDIENT_SCALE;

    world.add(model);
    ingredientObjects.push(model);
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

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
  camera.lookAt(CAMERA_TARGET_X, CAMERA_TARGET_Y, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Тени клиентов и предметов на полу
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Мягкий заполняющий свет
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  // Направленный свет сверху-сбоку — он же отбрасывает тени
  const keyLight = new THREE.DirectionalLight(0xffffff, 1);
  keyLight.position.set(5, 8, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -12;
  keyLight.shadow.camera.right = 12;
  keyLight.shadow.camera.top = 12;
  keyLight.shadow.camera.bottom = -12;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 40;
  keyLight.shadow.bias = -0.0008;
  keyLight.shadow.normalBias = 0.02;
  keyLight.shadow.camera.updateProjectionMatrix();
  scene.add(keyLight);

  // Вся стойка живёт в отдельной группе и сдвинута вправо
  world.position.set(WORLD_OFFSET_X, 0, 0);
  scene.add(world);
  world.add(counterItems);

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

  // Стойка, полки и продукты тоже отбрасывают тени
  enableShadows(world);

  // Корректная работа Raycaster при изменении размера окна
  window.addEventListener('resize', handleResize);

  return { scene, camera, renderer };
}

/** @returns {THREE.Group[]} живые 3D-объекты ингредиентов */
export function getIngredientObjects() {
  return ingredientObjects;
}

/** @returns {THREE.Group[]} живые 3D-объекты клиентов в порядке очереди */
export function getClientObjects() {
  return clientObjects;
}

/**
 * Убирает клиента со сцены (нового создаёт game.js в нужный момент).
 * @param {THREE.Group} clientObject
 */
export function removeClient(clientObject) {
  if (!clientObject) return;

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
}

/**
 * Выставляет выбранные продукты на стойку перед продавцом.
 * Вызывается из game.js при каждом изменении корзины.
 * @param {string[]} ingredientIds
 */
export function setCounterItems(ingredientIds) {
  // Убираем прежний ряд
  counterItems.children.slice().forEach((child) => {
    counterItems.remove(child);
    child.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      node.material.dispose();
    });
  });

  const count = ingredientIds.length;
  if (count === 0) return;

  // Ряд центрируется на столе; при большом заказе продукты стоят плотнее
  const spacing = Math.min(0.62, 4.2 / count);
  const startX = -((count - 1) * spacing) / 2;

  ingredientIds.forEach((ingredientId, index) => {
    const ingredient = INGREDIENTS.find((item) => item.id === ingredientId);
    if (!ingredient) return;

    const model = createIngredientObject(ingredient);
    model.position.set(startX + index * spacing, COUNTER_TOP_Y, COUNTER_ITEM_Z);
    model.rotation.y = (index % 2 === 0 ? 1 : -1) * 0.18;
    counterItems.add(model);
  });
}

/**
 * Подсвечивает выбранный продукт: поднимает, увеличивает и включает emissive.
 * @param {THREE.Group} model
 * @param {boolean} isSelected
 */
export function highlightIngredient(model, isSelected) {
  if (!model) return;

  const emissive = isSelected ? 0xffc14d : 0x000000;
  const intensity = isSelected ? 0.85 : 1;

  model.traverse((child) => {
    if (!child.isMesh) return;
    child.material.emissive.setHex(emissive);
    child.material.emissiveIntensity = intensity;
  });

  const baseScale = model.userData.baseScale || 1;

  if (isSelected) {
    model.scale.setScalar(baseScale * 1.15);
    model.position.y = model.userData.baseY + 0.12;
  } else {
    model.scale.setScalar(baseScale);
    model.position.y = model.userData.baseY;
  }
}
