/**
 * data.js — статические данные игры «Стойка бариста».
 *
 * Здесь описаны:
 *   INGREDIENTS — 12 ингредиентов, разложенных по трём полкам;
 *   MENU        — 9 готовых позиций, из которых собираются заказы клиентов.
 *
 * Заказ генерируется из меню: клиент называет 2–3 блюда, а эталонная
 * стоимость заказа — сумма цен этих блюд.
 */

/** Количество полок над стойкой. */
export const SHELF_COUNT = 3;

/**
 * 12 ингредиентов.
 *   id         — строковый идентификатор (связывает 3D-объект и данные);
 *   name       — название для интерфейса;
 *   category   — 'salad' | 'drink' | 'main' | 'extra';
 *   price      — цена в рублях;
 *   color      — цвет 3D-объекта;
 *   shelfIndex — номер полки (1..3);
 *   slot       — позиция на полке слева направо (0..3);
 *   shape      — форма модели: 'bowl' | 'cup' | 'glass' | 'bottle' | 'loaf' | 'plate' | 'burger' | 'dessert'.
 *
 * Раскладка: полка 1 — салаты + хлеб, полка 2 — напитки + соус,
 * полка 3 — основные блюда + десерт.
 */
export const INGREDIENTS = [
  // --- Полка 1: салаты + хлеб ---
  {
    id: 'salad_caesar',
    name: 'Цезарь',
    category: 'salad',
    price: 120,
    color: '#8bc34a',
    shelfIndex: 1,
    slot: 0,
    shape: 'bowl',
  },
  {
    id: 'salad_greek',
    name: 'Греческий',
    category: 'salad',
    price: 100,
    color: '#26c6da',
    shelfIndex: 1,
    slot: 1,
    shape: 'bowl',
  },
  {
    id: 'salad_vegan',
    name: 'Веганский',
    category: 'salad',
    price: 90,
    color: '#689f38',
    shelfIndex: 1,
    slot: 2,
    shape: 'bowl',
  },
  {
    id: 'extra_bread',
    name: 'Хлеб',
    category: 'extra',
    price: 20,
    color: '#d7a86e',
    shelfIndex: 1,
    slot: 3,
    shape: 'loaf',
  },

  // --- Полка 2: напитки + соус ---
  {
    id: 'drink_espresso',
    name: 'Эспрессо',
    category: 'drink',
    price: 60,
    color: '#4e342e',
    shelfIndex: 2,
    slot: 0,
    shape: 'cup',
  },
  {
    id: 'drink_latte',
    name: 'Латте',
    category: 'drink',
    price: 80,
    color: '#e8dcc8',
    shelfIndex: 2,
    slot: 1,
    shape: 'cup',
  },
  {
    id: 'drink_orange',
    name: 'Апельсиновый сок',
    category: 'drink',
    price: 70,
    color: '#ffa726',
    shelfIndex: 2,
    slot: 2,
    shape: 'glass',
  },
  {
    id: 'extra_sauce',
    name: 'Соус',
    category: 'extra',
    price: 15,
    color: '#e53935',
    shelfIndex: 2,
    slot: 3,
    shape: 'bottle',
  },

  // --- Полка 3: основные блюда + десерт ---
  {
    id: 'main_pasta',
    name: 'Паста карбонара',
    category: 'main',
    price: 150,
    color: '#fdd835',
    shelfIndex: 3,
    slot: 0,
    shape: 'plate',
  },
  {
    id: 'main_burger',
    name: 'Бургер',
    category: 'main',
    price: 130,
    color: '#a1887f',
    shelfIndex: 3,
    slot: 1,
    shape: 'burger',
  },
  {
    id: 'main_soup',
    name: 'Суп дня',
    category: 'main',
    price: 110,
    color: '#ff7043',
    shelfIndex: 3,
    slot: 2,
    shape: 'bowl',
  },
  {
    id: 'extra_dessert',
    name: 'Десерт',
    category: 'extra',
    price: 50,
    color: '#ec407a',
    shelfIndex: 3,
    slot: 3,
    shape: 'dessert',
  },
];

/**
 * Меню кафе — это не список для игрока, а эталонная база для генерации
 * заказов. Клиент называет готовые блюда, каждое блюдо «состоит»
 * из одного или двух ингредиентов с полок.
 *
 * totalPrice — сумма цен ингредиентов этой позиции.
 */
export const MENU = [
  {
    id: 'menu_caesar',
    displayName: 'Цезарь',
    ingredientIds: ['salad_caesar', 'extra_bread'],
    totalPrice: 140, // 120 + 20
  },
  {
    id: 'menu_greek',
    displayName: 'Греческий',
    ingredientIds: ['salad_greek', 'extra_sauce'],
    totalPrice: 115, // 100 + 15
  },
  {
    id: 'menu_vegan',
    displayName: 'Веганский',
    ingredientIds: ['salad_vegan'],
    totalPrice: 90,
  },
  {
    id: 'menu_espresso',
    displayName: 'Эспрессо',
    ingredientIds: ['drink_espresso'],
    totalPrice: 60,
  },
  {
    id: 'menu_latte',
    displayName: 'Латте',
    ingredientIds: ['drink_latte'],
    totalPrice: 80,
  },
  {
    id: 'menu_orange',
    displayName: 'Апельсиновый сок',
    ingredientIds: ['drink_orange'],
    totalPrice: 70,
  },
  {
    id: 'menu_pasta',
    displayName: 'Паста карбонара',
    ingredientIds: ['main_pasta', 'extra_sauce'],
    totalPrice: 165, // 150 + 15
  },
  {
    id: 'menu_burger',
    displayName: 'Бургер',
    ingredientIds: ['main_burger', 'extra_bread'],
    totalPrice: 150, // 130 + 20
  },
  {
    id: 'menu_soup',
    displayName: 'Суп дня',
    ingredientIds: ['main_soup', 'extra_dessert'],
    totalPrice: 160, // 110 + 50
  },
];

/** Вступление монолога клиента. */
const MONOLOG_OPENERS = [
  'Здравствуйте! Мне, пожалуйста,',
  'Добрый день! Мне, пожалуйста,',
  'Привет! Можно мне, пожалуйста,',
];

/** «Живая» концовка монолога — она не влияет на стоимость заказа. */
const MONOLOG_CODAS = [
  'И побыстрее, у меня поезд через десять минут.',
  'Я очень спешу, так что давайте без задержек.',
  'Только, пожалуйста, соберите всё отдельно.',
  'Спасибо, я буквально на минутку забежал.',
];

/**
 * Возвращает ингредиент по его id.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getIngredientById(id) {
  return INGREDIENTS.find((ingredient) => ingredient.id === id);
}

/**
 * Возвращает ингредиенты указанной полки, отсортированные слева направо.
 * @param {number} shelfIndex
 * @returns {object[]}
 */
export function getIngredientsByShelf(shelfIndex) {
  return INGREDIENTS.filter((ingredient) => ingredient.shelfIndex === shelfIndex).sort(
    (a, b) => a.slot - b.slot,
  );
}

/**
 * Склеивает названия в естественное перечисление: «Цезарь, Латте и Бургер».
 * @param {string[]} names
 * @returns {string}
 */
function joinNames(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`;
}

/**
 * Собирает монолог клиента из выбранных позиций меню.
 * @param {object[]} menuItems
 * @param {() => number} random
 * @returns {string}
 */
function buildMonolog(menuItems, random) {
  const opener = MONOLOG_OPENERS[Math.floor(random() * MONOLOG_OPENERS.length)];
  const coda = MONOLOG_CODAS[Math.floor(random() * MONOLOG_CODAS.length)];
  const names = menuItems.map((item) => item.displayName);
  return `${opener} ${joinNames(names)}. ${coda}`;
}

/**
 * Генерация заказа: выбираем 2–3 позиции меню без повторов,
 * складываем их стоимость — это эталонная цена заказа (targetPrice).
 *
 * Игра не проверяет «правильность» набора ингредиентов: важно только,
 * чтобы сумма выбранного совпала с targetPrice.
 *
 * @param {() => number} random — источник случайности (подменяется в тестах)
 * @returns {{ menuItems: object[], targetPrice: number, monolog: string }}
 */
export function generateOrder(random = Math.random) {
  // 2 или 3 позиции в заказе
  const positionsCount = 2 + Math.floor(random() * 2);

  // Выбираем без повторов: берём из копии меню и вырезаем выбранное
  const pool = MENU.slice();
  const picked = [];
  for (let i = 0; i < positionsCount; i += 1) {
    const index = Math.floor(random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }

  const targetPrice = picked.reduce((sum, item) => sum + item.totalPrice, 0);

  return {
    menuItems: picked,
    targetPrice,
    monolog: buildMonolog(picked, random),
  };
}