// ============================================================
//  ПЕПЕЛЬНЫЙ ГОРОД — конфигурация процедурной генерации
//  Один и тот же seed всегда создаёт один и тот же мир.
//  Все параметры генерации собраны здесь и настраиваются вручную.
// ============================================================
window.CFG = {
  seed: 1337,                 // стартовый seed (перегружается через ?seed=... или меню паузы)

  map: {
    size: 256,                // размер карты, м (квадрат)
    blockSize: 38,            // сторона квартала, м
    roadWidth: 9              // ширина дороги, м
  },

  city: {
    buildingDensity: 0.9,     // 0..1 — общая вероятность застройки квартала
    parkChance: 0.16,         // доля кварталов-пустырей (парк / свалка обломков)
    maxFloors: 7,             // максимальная высотность
    wallThickness: 0.45       // толщина стен, м
  },

  destruction: 0.62,          // 0..1 — общая степень разрушения города

  craters: {
    count: 12,                // количество воронок от снарядов
    minR: 3.5, maxR: 9.5,     // радиусы воронок, м
    maxDepth: 1.9             // максимальная глубина, м
  },

  props: {
    // плотность (штук на всю карту)
    rocks: 240, chunks: 420, bricks: 1300, planks: 240, rebar: 300,
    logs: 55, trees: 90, bushes: 220,
    grassPerM2: 0.5,          // плотность травы
    grassDist: 80,            // дальность отрисовки травы, м (LOD/culling)
    papers: 300, bottles: 200, cans: 200, tires: 44, barrels: 32, glass: 260,
    cars: 22, lamps: 34,
    contactShadows: true      // «контактные» тени-пятна под крупными объектами
  },

  light: {
    sunAzimuthDeg: 148,       // азимут солнца
    sunElevationDeg: 13,      // высота солнца (низкое закатное)
    sunColor: 0xffb372,       // тёплый золотой свет
    sunIntensity: 1.3,
    hemiSky: 0x8fa0c0,        // холодный купол неба
    hemiGround: 0x5b4d3f,     // тёплая пыльная земля
    hemiIntensity: 0.66,
    fogColor: 0xbfa98c,       // цвет пыльной дымки
    fogDensity: 0.011,
    exposure: 1.05,
    godRays: 9,               // количество «объёмных» лучей
    dustCount: 1400           // частицы пыли в воздухе
  },

  // Каскады теней: ближняя — резкая, дальняя — покрывает всю сцену
  cascades: [
    { range: 70,  mapSize: 2048, split: 0.55, normalBias: 0.4 },
    { range: 260, mapSize: 4096, split: 0.75, normalBias: 1.1 }
  ],

  player: {
    walkSpeed: 4.2,           // м/с шаг
    runSpeed: 7.2,            // м/с бег (Shift)
    jumpVel: 7.4,             // импульс прыжка
    gravity: 21,              // гравитация, м/с²
    eyeHeight: 1.7,           // высота камеры, м
    radius: 0.36,             // радиус капсулы игрока
    height: 1.78,             // высота игрока, м
    stepHeight: 0.55,         // высота автошага (преодолеваемый выступ)
    mouseSens: 0.0022,
    fov: 74, runFov: 81
  },

  quality: {
    pixelRatioCap: 2,
    terrainSegments: 160,     // сегментация меша рельефа
    shadows: true
  }
};

// Точка спавна — перекрёсток дорог (дороги идут по линиям (k+0.5)*cell)
(function () {
  var cell = CFG.map.blockSize + CFG.map.roadWidth;
  CFG.spawn = { x: cell / 2, z: cell / 2 };
})();
