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
const SHELF_HEIGHTS = { 1: 1.74, 2: 2.75, 3: 3.76 };

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

/**
 * Случайный тёмный цвет одежды клиента: приглушённый оттенок,
 * без ярких кислотных тонов.
 * @returns {THREE.Color}
 */
function randomDarkColor() {
  const hue = Math.random();
  const saturation = 0.25 + Math.random() * 0.35;
  const lightness = 0.15 + Math.random() * 0.15;
  return new THREE.Color().setHSL(hue, saturation, lightness);
}

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

/** Продавец — нужен для анимаций (ходьба вдоль стойки, поворот головы). */
let baristaRef = null;

/** К какому клиенту продавец поворачивает голову. */
let baristaLookTargetX = 0;

/** Текущий угол поворота головы продавца. */
let baristaHeadYaw = 0;

/** Уходящие клиенты: [{ client, startAt }] — «сдуваются» и затем удаляются. */
const leavingClients = [];

/** Сколько миллисекунд клиент сдувается перед исчезновением. */
const CLIENT_LEAVE_MS = 620;

/** Стрелки и маятник часов — для покадровой анимации. */
let clockParts = null;

/** Мини-игра «пробегающая мышь». */
let mouse = null;
const mouseRun = { active: false, start: 0, duration: 0, curve: null };

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
 * Добавляет клиенту несколько одиночных волосков на макушке.
 * Волосок — тонкая дуга по поверхности головы: он лежит на черепе,
 * а не торчит наружу.
 * @param {THREE.Group} headGroup
 * @param {number} count — сколько волосков (1..5)
 */
function addStrayHairs(headGroup, count) {
  const headRadius = 0.163;

  for (let i = 0; i < count; i += 1) {
    const isRed = Math.random() < 0.5;
    const material = new THREE.MeshStandardMaterial({
      color: isRed ? 0xb5521f : 0x14100e,
      roughness: 0.9,
      metalness: 0,
    });

    // Точка на макушке: полярный угол от темени и случайный азимут
    const theta = Math.random() * Math.PI * 0.55;
    const phi = Math.random() * Math.PI * 2;

    const normal = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.sin(phi),
    ).normalize();

    // Случайное касательное направление — вдоль него волосок и уложен
    const helper = Math.abs(normal.y) > 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);

    const tangent = new THREE.Vector3().crossVectors(normal, helper).normalize();
    tangent.applyAxisAngle(normal, Math.random() * Math.PI * 2);

    // Дуга по сфере: поворачиваем радиус-вектор вокруг оси normal × tangent
    const axis = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    const arcLength = 0.1 + Math.random() * 0.1;
    const points = [];

    for (let step = 0; step <= 3; step += 1) {
      const angle = ((arcLength * step) / 3) / headRadius;
      const point = normal.clone().applyAxisAngle(axis, angle).multiplyScalar(headRadius);
      point.addScaledVector(normal, 0.001);
      points.push(point);
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const hair = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.004, 5, false), material);

    headGroup.add(hair);
  }
}

/**
 * Слегка разный оттенок кожи у клиентов: базовый тон с небольшим
 * случайным сдвигом светлоты и тепла.
 * @returns {THREE.Color}
 */
function randomSkinTone() {
  const color = new THREE.Color(SKIN_COLOR);

  // ±12 % по светлоте и лёгкий сдвиг оттенка
  color.multiplyScalar(0.88 + Math.random() * 0.24);
  color.offsetHSL((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.06, 0);

  return color;
}

/**
 * Собирает человекоподобную фигуру: ноги, туловище, руки, голова.
 * @param {object} options
 * @param {number} options.clothColor — цвет одежды
 * @param {number} [options.skinColor]
 * @param {number} [options.pantsColor]
 * @param {number|null} [options.hairColor] — если задан, добавляются волосы
 * @param {boolean} [options.longHair] — длинные волосы до плеч
 * @param {boolean} [options.face] — глаза и алые губы
 * @param {number} [options.strayHairs] — сколько одиночных волосков добавить
 * @returns {THREE.Group}
 */
function createHumanoid({
  clothColor,
  skinColor = SKIN_COLOR,
  pantsColor = PANTS_COLOR,
  hairColor = null,
  longHair = false,
  face = false,
  strayHairs = 0,
}) {
  const person = new THREE.Group();

  const skinMaterial = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.75, metalness: 0 });
  const clothMaterial = new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.7, metalness: 0.03 });
  const pantsMaterial = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85, metalness: 0 });

  // Руки чуть темнее туловища — та же ткань, но в тени
  const armMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(clothColor).lerp(new THREE.Color(0x000000), 0.22),
    roughness: 0.7,
    metalness: 0.03,
  });

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

  // Руки — ссылки сохраняем для лёгкого покачивания
  const arms = [];
  const armBase = [];
  [-0.27, 0.27].forEach((x) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.52, 8), armMaterial);
    arm.position.set(x, 1.05, 0);
    const base = x > 0 ? -0.16 : 0.16;
    arm.rotation.z = base;
    person.add(arm);
    arms.push(arm);
    armBase.push(base);
  });

  // Голова — отдельная группа, чтобы продавец мог поворачивать её к клиентам
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.52, 0);
  person.add(headGroup);
  person.userData.head = headGroup;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), skinMaterial);
  headGroup.add(head);

  // Глаза и алые губы
  if (face) {
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.35, metalness: 0 });

    [-0.055, 0.055].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), eyeMaterial);
      eye.position.set(x, 0.028, 0.141);
      headGroup.add(eye);
    });

    const lipMaterial = new THREE.MeshStandardMaterial({
      color: 0xd81b3a,
      roughness: 0.3,
      metalness: 0.06,
    });
    const lips = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), lipMaterial);
    lips.position.set(0, -0.052, 0.146);
    lips.scale.set(1, 0.4, 0.45);
    headGroup.add(lips);
  }

  if (hairColor !== null) {
    const hairMaterial = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.85, metalness: 0 });

    // Шапка волос: открывает лицо, поэтому «натянута» только до 75°
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.168, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      hairMaterial,
    );
    cap.position.set(0, 0.012, -0.015);
    headGroup.add(cap);

    if (longHair) {
      // Длинные волосы сзади, до плеч (поворачиваются вместе с головой)
      const locks = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.46, 6, 12), hairMaterial);
      locks.position.set(0, -0.28, -0.11);
      locks.scale.set(1, 1, 0.6);
      headGroup.add(locks);
    }
  }

  // Одиночные торчащие волоски — только у клиентов
  if (strayHairs > 0) {
    addStrayHairs(headGroup, strayHairs);
  }

  // Данные для лёгких анимаций: постоянное дыхание и плавное покачивание рук
  person.userData.arms = arms;
  person.userData.armBase = armBase;
  person.userData.torso = torso;
  person.userData.mood = {
    phase: Math.random() * Math.PI * 2,
    breathPhase: Math.random() * Math.PI * 2,
    nextSwayAt: performance.now() + 1200 + Math.random() * 5000,
    swayUntil: 0,
    swayDuration: 1,
    turnTarget: 0,
    nextTurnAt: performance.now() + 2500 + Math.random() * 6000,
  };

  enableShadows(person);
  return person;
}

/** Создаёт нового клиента в очереди (позицию выставляет game.js). */
export function createClient() {
  const client = createHumanoid({
    clothColor: randomDarkColor(),
    skinColor: randomSkinTone(),
    // от 1 до 5 одиночных волосков на макушке
    strayHairs: 1 + Math.floor(Math.random() * 5),
  });
  client.position.set(0, 0, CLIENT_Z);
  client.userData.targetX = 0;
  // Метка для Raycaster: по ней game.js понимает, что кликнули по клиенту
  client.userData.isClient = true;

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
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.6, 0.9), sideMaterial);
    side.position.set(x, 2.55, -1.6);
    world.add(side);
  });

  // Три полки с деревянной текстурой
  const shelfMaterial = createShelfMaterial();

  Object.values(SHELF_HEIGHTS).forEach((shelfY) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.12, 0.7), shelfMaterial);
    shelf.position.set(0, shelfY, SHELF_Z);
    world.add(shelf);
  });

  // Задняя стенка полок — та же доска, но заметно темнее
  const backTexture = textureLoader.load(SHELF_TEXTURE_PATH);
  backTexture.colorSpace = THREE.SRGBColorSpace;
  backTexture.wrapS = THREE.RepeatWrapping;
  backTexture.wrapT = THREE.RepeatWrapping;
  backTexture.repeat.set(4, 3);
  backTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const backPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(7.3, 4.5),
    new THREE.MeshStandardMaterial({
      map: backTexture,
      color: 0x4a3a2c, // темнее самих полок
      roughness: 0.9,
      metalness: 0,
    }),
  );
  backPanel.position.set(0, 2.25, -1.94);
  backPanel.receiveShadow = true;
  world.add(backPanel);

  // Продавец за стойкой: девушка с длинными волосами, лицом к клиентам
  const barista = createHumanoid({
    clothColor: 0xe9dcc8,
    skinColor: 0xf0c4a0,
    hairColor: 0xf2d67a,
    longHair: true,
    face: true,
  });
  barista.position.set(0, 0, BARISTA_Z);
  world.add(barista);

  baristaRef = barista;
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
  buildClock();
  buildMouse();

  // Стойка, полки и продукты тоже отбрасывают тени
  enableShadows(world);

  // Корректная работа Raycaster при изменении размера окна
  window.addEventListener('resize', handleResize);

  return { scene, camera, renderer };
}

/**
 * Перемешивает продукты по полкам: после каждого заказа раскладка меняется,
 * поэтому нужный ингредиент приходится искать заново.
 */
export function shuffleIngredients() {
  // Все ячейки: 3 полки × 4 места
  const cells = [];
  for (let shelfIndex = 1; shelfIndex <= 3; shelfIndex += 1) {
    for (let slot = 0; slot < 4; slot += 1) {
      cells.push({ shelfIndex, slot });
    }
  }

  // Перемешивание Фишера — Йетса
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = cells[i];
    cells[i] = cells[j];
    cells[j] = swap;
  }

  ingredientObjects.forEach((model, index) => {
    const cell = cells[index % cells.length];
    if (!cell) return;

    const shelfTop = SHELF_HEIGHTS[cell.shelfIndex] + 0.06;
    const x = -2.7 + cell.slot * 1.8;

    model.position.set(x, shelfTop, SHELF_Z);
    model.rotation.y = cell.slot * 0.35;
    model.scale.setScalar(model.userData.baseScale || 1);

    // Подсветка ориентируется на новую высоту
    model.userData.baseY = shelfTop;
  });
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

/**
 * Двигает продавца вдоль стойки (локальная координата внутри группы мира).
 * @param {number} x
 */
export function setBaristaX(x) {
  if (baristaRef) baristaRef.position.x = x;
}

/**
 * Задаёт, к какому клиенту продавец повернёт голову.
 * @param {number} x — локальная X клиента
 */
export function setBaristaLookTarget(x) {
  baristaLookTargetX = x;
}

/**
 * Запускает анимацию ухода: клиент «сдувается» и затем удаляется со сцены.
 * @param {THREE.Group} clientObject
 */
export function startClientLeave(clientObject) {
  if (!clientObject) return;
  if (leavingClients.some((item) => item.client === clientObject)) return;
  leavingClients.push({ client: clientObject, startAt: performance.now() });
}

/**
 * Строит стенные часы с маятником справа от полок.
 * Стрелки показывают системное время, маятник качается с тактом раз в секунду.
 */
function buildClock() {
  const clockGroup = new THREE.Group();

  const x = 5.7;
  const y = 3.9;
  const z = -2.0;

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.8, metalness: 0.1 });
  const faceMaterial = new THREE.MeshStandardMaterial({ color: 0xf1e8d4, roughness: 0.7, metalness: 0 });
  const handMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.6, metalness: 0.25 });
  const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.65 });

  // Корпус и циферблат
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 32), bodyMaterial);
  body.rotation.x = Math.PI / 2;
  body.position.set(x, y, z);
  clockGroup.add(body);

  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.04, 32), faceMaterial);
  face.rotation.x = Math.PI / 2;
  face.position.set(x, y, z + 0.07);
  clockGroup.add(face);

  // Метки на 12, 3, 6 и 9 часов
  for (let i = 0; i < 12; i += 3) {
    const angle = (i / 12) * Math.PI * 2;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.1, 0.02), goldMaterial);
    mark.position.set(x + Math.sin(angle) * 0.42, y + Math.cos(angle) * 0.42, z + 0.1);
    mark.rotation.z = -angle;
    clockGroup.add(mark);
  }

  // Стрелки: ось вращения в центре циферблата, сама стрелка смещена вверх
  const createHand = (length, width, material) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z + 0.11);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(width, length, 0.02), material);
    hand.position.y = length / 2;
    pivot.add(hand);
    clockGroup.add(pivot);

    return pivot;
  };

  const hourHand = createHand(0.26, 0.05, handMaterial);
  const minuteHand = createHand(0.38, 0.032, handMaterial);
  const secondHand = createHand(0.42, 0.014, goldMaterial);

  // Маятник: ось сверху, стержень и груз вниз
  const pendulum = new THREE.Group();
  pendulum.position.set(x, y - 0.62, z + 0.02);

  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.72, 0.03), goldMaterial);
  rod.position.y = -0.36;
  pendulum.add(rod);

  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), goldMaterial);
  bob.position.y = -0.76;
  pendulum.add(bob);

  clockGroup.add(pendulum);

  enableShadows(clockGroup);
  world.add(clockGroup);

  clockParts = { hourHand, minuteHand, secondHand, pendulum };
}

/**
 * Часы: стрелки по системному времени, маятник — такт раз в секунду.
 * @param {number} now — performance.now() текущего кадра
 */
function updateClock(now) {
  if (!clockParts) return;

  const date = new Date();
  const seconds = date.getSeconds() + date.getMilliseconds() / 1000;
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;

  clockParts.secondHand.rotation.z = -(seconds / 60) * Math.PI * 2;
  clockParts.minuteHand.rotation.z = -(minutes / 60) * Math.PI * 2;
  clockParts.hourHand.rotation.z = -(hours / 12) * Math.PI * 2;

  // Период 2 секунды: маятник проходит центр ровно раз в секунду
  clockParts.pendulum.rotation.z = Math.sin((now / 1000) * Math.PI) * 0.28;
}

/**
 * Строит мышь для мини-игры: сидит на полу перед стойкой, изначально спрятана.
 */
function buildMouse() {
  const group = new THREE.Group();

  const furMaterial = new THREE.MeshStandardMaterial({ color: 0x8d8d8d, roughness: 0.85, metalness: 0 });
  const pinkMaterial = new THREE.MeshStandardMaterial({ color: 0xe58fa5, roughness: 0.8, metalness: 0 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5, metalness: 0 });

  // Туловище
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), furMaterial);
  body.scale.set(1, 0.85, 1.9);
  body.position.set(0, 0.1, 0);
  group.add(body);

  // Голова
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), furMaterial);
  head.position.set(0, 0.1, 0.2);
  group.add(head);

  // Уши
  [-0.05, 0.05].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), pinkMaterial);
    ear.position.set(x, 0.17, 0.18);
    group.add(ear);
  });

  // Нос и глаза
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), pinkMaterial);
  nose.position.set(0, 0.09, 0.27);
  group.add(nose);

  [-0.03, 0.03].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), darkMaterial);
    eye.position.set(x, 0.13, 0.25);
    group.add(eye);
  });

  // Хвост
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.3, 6), pinkMaterial);
  tail.position.set(0, 0.12, -0.28);
  tail.rotation.x = -0.35;
  group.add(tail);

  group.scale.setScalar(1.2);
  group.visible = false;
  group.userData.isMouse = true;

  enableShadows(group);
  world.add(group);

  mouse = group;
}

/**
 * Запускает пробежку: мышь бежит по кривой перед стойкой слева направо
 * или справа налево.
 * @param {number} now
 */
export function startMouseRun(now) {
  if (!mouse || mouseRun.active) return;

  const direction = Math.random() < 0.5 ? 1 : -1;
  const zStart = 1.95 + Math.random() * 0.25;
  const zEnd = 1.95 + Math.random() * 0.25;
  const zBow = 2.3 + Math.random() * 0.25;

  mouseRun.curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-9.5 * direction, 0.02, zStart),
    new THREE.Vector3(0, 0.02, zBow),
    new THREE.Vector3(9.5 * direction, 0.02, zEnd),
  );
  mouseRun.start = now;
  // Скорость вдвое ниже: пробежка занимает 6–8 секунд
  mouseRun.duration = 6000 + Math.random() * 2000;
  mouseRun.active = true;

  mouse.visible = true;
}

/** Убирает мышь с пола (поймали или убежала). */
export function stopMouseRun() {
  mouseRun.active = false;
  if (mouse) mouse.visible = false;
}

/** @returns {boolean} бежит ли мышь сейчас */
export function isMouseRunning() {
  return mouseRun.active;
}

/** @returns {THREE.Group|null} объект мыши для Raycaster */
export function getMouseObject() {
  return mouse;
}

/**
 * Дыхание и покачивание рук для одного персонажа.
 * @param {THREE.Group} person
 * @param {number} now
 * @param {number} dt — секунды с прошлого кадра
 * @param {boolean} allowTurn — разрешены ли повороты вокруг Y (±15°)
 */
function animatePerson(person, now, dt, allowTurn = false) {
  const data = person.userData;
  if (!data || !data.torso || !data.mood) return;

  // Постоянное глубокое дыхание — заметные ±5 %
  const breath = Math.sin(now * 0.0014 + data.mood.breathPhase) * 0.05;
  data.torso.scale.set(1 + breath * 0.6, 1 + breath, 1 + breath * 0.6);

  // Редкие плавные повороты вокруг Y: ±15°, без рывков
  if (allowTurn) {
    if (now >= data.mood.nextTurnAt) {
      data.mood.turnTarget = (Math.random() * 2 - 1) * 0.262;
      data.mood.nextTurnAt = now + 5000 + Math.random() * 9000;
    }
    const turnFactor = Math.min(1, 1 - Math.exp(-1.2 * dt));
    person.rotation.y += (data.mood.turnTarget - person.rotation.y) * turnFactor;
  }

  if (!data.arms) return;

  if (now >= data.mood.nextSwayAt) {
    data.mood.swayDuration = 2200 + Math.random() * 1400;
    data.mood.swayUntil = now + data.mood.swayDuration;
    data.mood.nextSwayAt = now + 6000 + Math.random() * 8000;
  }

  // Плавная огибающая: плавно нарастает и гаснет — никаких рывков
  let sway = 0;
  if (now < data.mood.swayUntil) {
    const progress = 1 - (data.mood.swayUntil - now) / data.mood.swayDuration;
    const envelope = Math.sin(Math.PI * Math.min(1, Math.max(0, progress)));
    sway = Math.sin(now * 0.0032 + data.mood.phase) * 0.09 * envelope;
  }

  data.arms.forEach((arm, index) => {
    arm.rotation.z = data.armBase[index] + sway;
  });
}

/**
 * Покадровая анимация персонажей: дыхание и покачивание рук, поворот головы
 * продавца и сдувание уходящих клиентов.
 * @param {number} now — performance.now() текущего кадра
 * @param {number} dt — секунды с прошлого кадра
 */
export function updateCharacters(now, dt) {
  updateClock(now);

  // Пробегающая мышь: движется по кривой и подпрыгивает на бегу
  if (mouseRun.active && mouse) {
    const t = Math.min(1, (now - mouseRun.start) / mouseRun.duration);
    const point = mouseRun.curve.getPoint(t);
    const bob = Math.abs(Math.sin(now * 0.018)) * 0.03;

    mouse.position.set(point.x, point.y + bob, point.z);

    const ahead = mouseRun.curve.getPoint(Math.min(1, t + 0.02));
    const dx = ahead.x - point.x;
    const dz = ahead.z - point.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.0001) {
      // нос смотрит по направлению бега
      mouse.rotation.y = Math.atan2(dx, dz);
    }

    if (t >= 1) stopMouseRun();
  }

  clientObjects.forEach((client) => animatePerson(client, now, dt, true));
  if (baristaRef) animatePerson(baristaRef, now, dt, false);

  // Уходящие клиенты сдуваются и исчезают
  for (let i = leavingClients.length - 1; i >= 0; i -= 1) {
    const item = leavingClients[i];
    const t = Math.min(1, (now - item.startAt) / CLIENT_LEAVE_MS);

    item.client.scale.setScalar(Math.max(0.02, 1 - t));
    item.client.position.y = -0.25 * t;

    if (t >= 1) {
      leavingClients.splice(i, 1);
      removeClient(item.client);
    }
  }

  // Продавец поворачивает голову к активному клиенту
  if (baristaRef && baristaRef.userData.head) {
    const dx = baristaLookTargetX - baristaRef.position.x;
    const dz = CLIENT_Z - BARISTA_Z;
    const targetYaw = Math.max(-0.7, Math.min(0.7, Math.atan2(dx, dz)));

    baristaHeadYaw += (targetYaw - baristaHeadYaw) * Math.min(1, 1 - Math.exp(-2.5 * dt));
    baristaRef.userData.head.rotation.y = baristaHeadYaw;
  }
}
