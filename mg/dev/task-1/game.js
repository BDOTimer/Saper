/**
 * game.js — игровая логика «Стойки бариста».
 *
 * Отвечает за:
 *   - состояние игры (IDLE / ORDERING / SUCCESS / FAIL_TIMEOUT / FAIL_WRONG);
 *   - очередь клиентов и переход заказа к следующему клиенту;
 *   - таймер на 12000 мс (считается через performance.now() в игровом цикле);
 *   - визуальные модели состава заказа и подписи ингредиентов по клику;
 *   - корзину: клик добавляет ингредиент, повторный — убирает;
 *   - проверку суммы и счётчики «Обслужено / Ошибок / Штраф»;
 *   - обновление HTML-оверлея.
 *
 * Экспорт: startGame, handleIngredientClick, submitOrder (плюс update и getState
 * для игрового цикла и проверок).
 */

import { INGREDIENTS, generateOrder } from './data.js';
import {
  createClient,
  getClientObjects,
  getIngredientObjects,
  highlightIngredient,
  removeClient,
  setCounterItems,
} from './scene.js';

/** Состояния игры. */
export const STATE = {
  IDLE: 'IDLE',
  ORDERING: 'ORDERING',
  SUCCESS: 'SUCCESS',
  FAIL_TIMEOUT: 'FAIL_TIMEOUT',
  FAIL_WRONG: 'FAIL_WRONG',
};

/** На заказ даётся 12 секунд. */
const ORDER_TIME_MS = 12000;

/** Пауза между заказами: клиент ушёл, следующий ещё не начал говорить. */
const PAUSE_MS = 800;

/** Горизонтальные позиции клиентов в очереди (очередь центрируется у стойки). */
const CLIENT_SPACING = 0.9;

/** Очередь переменной длины: от одного клиента до четырёх. */
const MIN_CLIENTS = 1;
const MAX_CLIENTS = 4;
const INITIAL_CLIENTS = 3;

/** Задержка перед приходом следующего клиента — не синхронно с уходом. */
const ARRIVAL_MIN_MS = 500;
const ARRIVAL_MAX_MS = 2200;

/** Новый клиент появляется чуть сбоку и «подходит» к очереди. */
const ARRIVAL_OFFSET_X = 1.6;

let state = STATE.IDLE;

/** Очередь: [{ id, mesh, order }], queue[0] — активный клиент. */
let queue = [];

/** Корзина: идентификаторы выбранных ингредиентов в порядке выбора. */
let basket = [];

/**
 * Счётчики игры. penalty — это не «сумма штрафов», а баланс:
 * штрафы минус стоимость выполненных заказов. Отрицательное значение = заработок.
 */
let counters = { served: 0, errors: 0, penalty: 0 };

/** Абсолютный дедлайн текущего заказа (мс по performance.now()). */
let deadline = 0;

/** Момент, когда можно начинать следующий заказ. */
let resumeAt = 0;

/** Момент, когда должен подойти следующий клиент (Infinity — никто не идёт). */
let arrivalAt = Infinity;

/** Текстовая подсказка в оверлее. */
let statusText = '';

/** Счётчик клиентов — чтобы у каждого был свой номер. */
let clientSeq = 0;

/** Последнее время кадра — для плавного сдвига очереди. */
let lastNow = null;

/** Итог последнего завершённого заказа (для панели и отладки). */
let lastResult = '';

/** Ссылки на элементы оверлея. */
let els = {};

/** Быстрый доступ: id ингредиента -> данные и -> 3D-объект. */
let ingredientById = new Map();
let meshById = new Map();

/** Форматирование цены. */
function formatPrice(value) {
  return `${value} ₽`;
}

/** Собирает DOM-элементы оверлея в один объект. */
function collectElements() {
  return {
    served: document.getElementById('stat-served'),
    errors: document.getElementById('stat-errors'),
    penalty: document.getElementById('stat-penalty'),
    penaltyLabel: document.getElementById('stat-penalty-label'),
    penaltyBox: document.getElementById('stat-penalty-box'),
    speech: document.getElementById('client-speech'),
    orderVisual: document.getElementById('order-visual'),
    caption: document.getElementById('ingredient-caption'),
    timerFill: document.getElementById('timer-fill'),
    timerText: document.getElementById('timer-text'),
    status: document.getElementById('status-text'),
    basketList: document.getElementById('basket-list'),
    basketEmpty: document.getElementById('basket-empty'),
    basketTotal: document.getElementById('basket-total'),
    submit: document.getElementById('submit-btn'),
  };
}

/** Сумма выбранных ингредиентов — главный критерий проверки заказа. */
function currentSum() {
  return basket.reduce((sum, id) => {
    const ingredient = ingredientById.get(id);
    return sum + (ingredient ? ingredient.price : 0);
  }, 0);
}

/**
 * Обновляет верхнюю панель со счётчиками.
 * Третья ячейка — баланс: штрафы минус выручка. Пока он положительный,
 * это долг и подпись «Штраф»; когда вышли в плюс (баланс отрицательный) —
 * та же ячейка показывает «Заработано».
 */
function renderCounters() {
  const balance = counters.penalty;
  const isEarned = balance < 0;

  els.served.textContent = String(counters.served);
  els.errors.textContent = String(counters.errors);
  els.penalty.textContent = formatPrice(Math.abs(balance));

  if (els.penaltyLabel) {
    els.penaltyLabel.textContent = isEarned ? 'Заработано' : 'Штраф';
  }
  if (els.penaltyBox) {
    els.penaltyBox.classList.toggle('hud__stat--earned', isEarned);
  }
}

/** Перерисовывает правую панель: список покупок, сумму и кнопку «Готово». */
function renderBasket() {
  els.basketList.textContent = '';

  if (basket.length === 0) {
    els.basketEmpty.hidden = false;
  } else {
    els.basketEmpty.hidden = true;
    basket.forEach((id) => {
      const ingredient = ingredientById.get(id);
      if (!ingredient) return;

      const item = document.createElement('li');
      item.className = 'basket__item';

      const name = document.createElement('span');
      name.className = 'basket__name';
      name.textContent = ingredient.name;

      const price = document.createElement('span');
      price.className = 'basket__price';
      price.textContent = formatPrice(ingredient.price);

      item.append(name, price);
      els.basketList.append(item);
    });
  }

  els.basketTotal.textContent = formatPrice(currentSum());
  // Кнопка «Готово» неактивна, пока корзина пуста
  els.submit.disabled = basket.length === 0 || state !== STATE.ORDERING;
}

/** Обновляет полосу и число таймера. */
function renderTimer(remainingMs) {
  const left = Math.max(0, remainingMs);
  const ratio = Math.min(1, left / ORDER_TIME_MS);

  els.timerFill.style.width = `${(ratio * 100).toFixed(1)}%`;
  els.timerFill.classList.toggle('timer__fill--danger', left <= 1000);
  els.timerText.textContent = `${(left / 1000).toFixed(1)} с`;
}

/** Обновляет строку-подсказку. */
function renderStatus() {
  els.status.textContent = statusText;
}

/** Осветляет (amount > 0) или затемняет (amount < 0) цвет вида #rrggbb. */
function shadeHex(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const k = Math.min(1, Math.abs(amount));
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) =>
    Math.round(channel + (target - channel) * k),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Рисует мини-модель ингредиента: та же форма и цвет, что и модель на полке,
 * только в виде SVG, чтобы продавец видел состав заказа без 3D-рендера.
 * @param {string} shape — 'bowl' | 'cup' | 'glass' | 'bottle' | 'loaf' | 'plate' | 'burger' | 'dessert'
 * @param {string} color — цвет ингредиента
 * @returns {string} SVG-разметка
 */
function createModelSvg(shape, color) {
  const frame =
    'width="38" height="38" viewBox="0 0 40 40" aria-hidden="true" focusable="false"';
  const light = shadeHex(color, 0.35);
  const dark = shadeHex(color, -0.3);

  switch (shape) {
    case 'bowl':
      return `<svg ${frame}><ellipse cx="20" cy="16" rx="14" ry="4.5" fill="${light}"></ellipse><path d="M6 16 Q20 36 34 16 Z" fill="${color}"></path><ellipse cx="20" cy="16" rx="8" ry="2.4" fill="${dark}"></ellipse></svg>`;

    case 'cup':
      return `<svg ${frame}><path d="M11 13 L29 13 L26 33 L14 33 Z" fill="${color}"></path><rect x="10" y="9" width="20" height="4.5" rx="2" fill="${light}"></rect></svg>`;

    case 'glass':
      return `<svg ${frame}><path d="M13 8 L27 8 L25 34 L15 34 Z" fill="${light}"></path><path d="M14.6 14 L25.4 14 L24.1 31 L15.9 31 Z" fill="${color}"></path></svg>`;

    case 'bottle':
      return `<svg ${frame}><rect x="14" y="16" width="12" height="18" rx="3" fill="${color}"></rect><rect x="17" y="9" width="6" height="8" fill="${light}"></rect><rect x="15.5" y="6" width="9" height="4" rx="2" fill="${light}"></rect></svg>`;

    case 'loaf':
      return `<svg ${frame}><rect x="6" y="14" width="28" height="14" rx="7" fill="${color}"></rect><path d="M13 17 L17 25 M20 16 L24 24 M27 17 L30 23" stroke="${light}" stroke-width="2" stroke-linecap="round" fill="none"></path></svg>`;

    case 'plate':
      return `<svg ${frame}><ellipse cx="20" cy="27" rx="15" ry="5" fill="${light}"></ellipse><ellipse cx="20" cy="19" rx="9" ry="5" fill="${color}"></ellipse></svg>`;

    case 'burger':
      return `<svg ${frame}><path d="M9 17 Q20 6 31 17 Z" fill="${light}"></path><rect x="9" y="17" width="22" height="5" rx="2" fill="${dark}"></rect><rect x="8.5" y="22" width="23" height="5" rx="2.5" fill="${light}"></rect></svg>`;

    case 'dessert':
      return `<svg ${frame}><path d="M13 22 L27 22 L24 12 L16 12 Z" fill="${color}"></path><circle cx="20" cy="10" r="3.2" fill="#e53935"></circle><rect x="10" y="22" width="20" height="5" rx="2.5" fill="${light}"></rect></svg>`;

    default:
      // Запасной вариант — куб в изометрии
      return `<svg ${frame}><polygon points="20,4 34,11 20,18 6,11" fill="${light}"></polygon><polygon points="6,11 20,18 20,35 6,28" fill="${color}"></polygon><polygon points="34,11 20,18 20,35 34,28" fill="${dark}"></polygon></svg>`;
  }
}

/** Показывает название ингредиента текстом под моделями заказа. */
function showIngredientName(name, modelNode) {
  if (!els.caption) return;

  els.caption.textContent = name;
  // перезапуск CSS-анимации подсветки
  els.caption.classList.remove('caption--active');
  void els.caption.offsetWidth;
  els.caption.classList.add('caption--active');

  if (els.orderVisual) {
    els.orderVisual.querySelectorAll('.model--active').forEach((node) => {
      node.classList.remove('model--active');
    });
  }
  if (modelNode) modelNode.classList.add('model--active');
}

/**
 * Выводит визуальный состав заказа: каждое блюдо из монолога показывается
 * карточкой с моделями своих ингредиентов. По клику на модель под карточками
 * появляется название ингредиента.
 */
function renderOrderPreview() {
  if (!els.orderVisual) return;

  els.orderVisual.textContent = '';

  const active = queue[0];
  if (!active) return;

  active.order.menuItems.forEach((menuItem) => {
    const card = document.createElement('div');
    card.className = 'dish';

    const title = document.createElement('p');
    title.className = 'dish__name';
    title.textContent = menuItem.displayName;

    const models = document.createElement('div');
    models.className = 'dish__models';

    menuItem.ingredientIds.forEach((ingredientId) => {
      const ingredient = ingredientById.get(ingredientId);
      if (!ingredient) return;

      const model = document.createElement('button');
      model.type = 'button';
      model.className = 'model';
      model.dataset.ingredientId = ingredient.id;
      model.setAttribute('aria-label', `Ингредиент: ${ingredient.name}`);
      model.innerHTML = createModelSvg(ingredient.shape, ingredient.color);
      model.addEventListener('click', () => {
        // звук «зинь» на клик проигрывает main.js по этому событию
        document.dispatchEvent(new CustomEvent('barista:click'));
        showIngredientName(ingredient.name, model);
      });

      models.append(model);
    });

    card.append(title, models);
    els.orderVisual.append(card);
  });

  // Сброс подписи под новым заказом
  if (els.caption) {
    els.caption.textContent = 'Нажмите на модель, чтобы увидеть название ингредиента.';
    els.caption.classList.remove('caption--active');
  }
}

/** Полная перерисовка оверлея. */
function renderAll() {
  renderCounters();
  renderBasket();
  renderStatus();
}

/** Полностью очищает корзину и снимает подсветку с ингредиентов. */
function clearBasket() {
  basket.forEach((id) => {
    const mesh = meshById.get(id);
    if (mesh) highlightIngredient(mesh, false);
  });
  basket = [];
  // стол продавца тоже освобождается
  setCounterItems([]);
}

/**
 * Позиция клиента в очереди: очередь всегда центрируется у стойки,
 * поэтому и один клиент, и четверо стоят красиво.
 * @param {number} index
 * @param {number} count
 */
function slotX(index, count) {
  const offset = ((count - 1) * CLIENT_SPACING) / 2;
  return -offset + index * CLIENT_SPACING;
}

/**
 * Создаёт запись очереди для 3D-объекта клиента.
 * Заказ генерируется сразу — клиент «знает», что хочет заказать.
 * @param {THREE.Group} mesh
 */
function createQueueEntry(mesh) {
  clientSeq += 1;
  return {
    id: clientSeq,
    mesh,
    order: generateOrder(),
  };
}

/**
 * Подводит к стойке нового клиента. Появляется чуть сбоку
 * и «подходит» к своему месту в очереди.
 */
function spawnClient() {
  if (queue.length >= MAX_CLIENTS) return;

  const mesh = createClient();
  const entry = createQueueEntry(mesh);

  // Стартовая точка — сбоку от будущего места, чтобы был виден подход
  mesh.position.x = slotX(queue.length, queue.length + 1) + ARRIVAL_OFFSET_X;
  queue.push(entry);
}

/**
 * Решает, подойдёт ли следующий клиент и через сколько.
 * Вызывается заново после каждого изменения очереди — поэтому
 * приход и уход рассинхронизированы.
 * @param {number} now
 */
function scheduleArrival(now) {
  if (queue.length >= MAX_CLIENTS) {
    arrivalAt = Infinity;
    return;
  }

  const willArrive = Math.random() < 0.55;
  arrivalAt = willArrive
    ? now + ARRIVAL_MIN_MS + Math.random() * (ARRIVAL_MAX_MS - ARRIVAL_MIN_MS)
    : Infinity;
}

/** Плавно сдвигает клиентов к их позициям в очереди (лерп по кадрам). */
function updateClients(dt) {
  const factor = 1 - Math.exp(-9 * dt);
  const count = queue.length;

  queue.forEach((entry, index) => {
    const targetX = slotX(index, count);
    entry.mesh.userData.targetX = targetX;
    entry.mesh.position.x += (targetX - entry.mesh.position.x) * factor;
  });
}

/** Начинает заказ для активного клиента: монолог + новый отсчёт 12 секунд. */
function beginOrder(now) {
  const active = queue[0];
  if (!active) {
    state = STATE.IDLE;
    return;
  }

  state = STATE.ORDERING;
  els.speech.textContent = active.order.monolog;

  // Визуальные модели того, что заказал клиент
  renderOrderPreview();

  // Таймер стартует от текущего момента игрового цикла
  deadline = now + ORDER_TIME_MS;
  renderTimer(ORDER_TIME_MS);

  statusText = 'Соберите заказ и нажмите «Готово».';
  renderAll();
}

/**
 * Завершает текущий заказ: считает счётчики, убирает клиента,
 * сдвигает очередь и снимает корзину.
 *
 * @param {string} result — STATE.SUCCESS | STATE.FAIL_TIMEOUT | STATE.FAIL_WRONG
 * @param {number} now — текущее время игрового цикла
 * @param {number} [wrongSum] — набранная сумма для сообщения о промахе
 */
function finishOrder(result, now, wrongSum) {
  const active = queue[0];
  if (!active) return;

  const targetPrice = active.order.targetPrice;

  if (result === STATE.SUCCESS) {
    counters.served += 1;
    // Успешный заказ списывает свою стоимость из таба штрафа:
    // баланс может уйти в минус, и тогда он превращается в заработок
    counters.penalty -= targetPrice;
    statusText = `Заказ собран: +${formatPrice(targetPrice)}. Спасибо!`;
  } else if (result === STATE.FAIL_TIMEOUT) {
    counters.errors += 1;
    counters.penalty += targetPrice;
    statusText = `Время вышло! Нужно было ${formatPrice(targetPrice)}, штраф ${formatPrice(targetPrice)}.`;
  } else {
    counters.errors += 1;
    counters.penalty += targetPrice;
    statusText = `Не та сумма: ${formatPrice(wrongSum || 0)} вместо ${formatPrice(targetPrice)}. Штраф ${formatPrice(targetPrice)}.`;
  }

  state = result;

  // Клиент реагирует на итог: радость или разочарование
  document.dispatchEvent(
    new CustomEvent(result === STATE.SUCCESS ? 'barista:success' : 'barista:fail'),
  );

  // Корзина очищается при любом исходе
  clearBasket();

  // Активный клиент уходит; следующий подойдёт отдельно, со своей задержкой
  const departed = queue.shift();
  removeClient(departed.mesh);

  // В кафе всегда должен оставаться хотя бы один посетитель
  if (queue.length < MIN_CLIENTS) {
    spawnClient();
  }

  // Приход следующего никак не привязан к уходу текущего
  scheduleArrival(now);

  // Короткая пауза перед следующим заказом — состояние остаётся терминальным
  resumeAt = now + PAUSE_MS;
  lastResult = result;

  renderTimer(0);
  renderAll();
}

/**
 * Игровой цикл: вызывается из requestAnimationFrame в main.js.
 * Здесь же идёт отсчёт таймера — через performance.now(), без setInterval.
 * @param {number} now — performance.now() текущего кадра
 */
export function update(now) {
  const dt = lastNow === null ? 0 : Math.min((now - lastNow) / 1000, 0.1);
  lastNow = now;

  updateClients(dt);

  // Приход нового клиента — по своему таймеру, независимо от уходов.
  // Пустая очередь недопустима: кто-то должен стоять у стойки всегда.
  if (now >= arrivalAt || queue.length === 0) {
    spawnClient();
    scheduleArrival(now);
  }

  if (state === STATE.ORDERING) {
    const remaining = deadline - now;

    if (remaining <= 0) {
      // 12 секунд истекли: время вышло
      renderTimer(0);
      finishOrder(STATE.FAIL_TIMEOUT, now);
      return;
    }

    renderTimer(remaining);
    return;
  }

  const isTerminal =
    state === STATE.SUCCESS || state === STATE.FAIL_TIMEOUT || state === STATE.FAIL_WRONG;

  if (isTerminal && now >= resumeAt) {
    beginOrder(now);
  }
}

/**
 * Стартует игру: сбрасывает счётчики, наполняет очередь и запускает первый заказ.
 */
export function startGame() {
  els = collectElements();

  ingredientById = new Map(INGREDIENTS.map((ingredient) => [ingredient.id, ingredient]));
  meshById = new Map(
    getIngredientObjects().map((mesh) => [mesh.userData.ingredientId, mesh]),
  );

  state = STATE.IDLE;
  queue = [];
  // снимаем подсветку с прошлой игры, затем очищаем корзину
  clearBasket();
  basket = [];
  counters = { served: 0, errors: 0, penalty: 0 };
  statusText = '';
  lastNow = null;
  resumeAt = 0;
  deadline = 0;
  lastResult = '';

  // Убираем клиентов прошлой партии, если игра перезапускается
  getClientObjects().slice().forEach((mesh) => removeClient(mesh));

  // Стартовая очередь: несколько клиентов уже стоят у стойки
  for (let i = 0; i < INITIAL_CLIENTS; i += 1) {
    spawnClient();
  }
  queue.forEach((entry, index) => {
    entry.mesh.position.x = slotX(index, queue.length);
  });
  arrivalAt = Infinity;

  beginOrder(performance.now());
}

/**
 * Клик по ингредиенту в 3D-сцене.
 * Работает только в состоянии ORDERING; повторный клик убирает ингредиент.
 * @param {string} ingredientId
 */
export function handleIngredientClick(ingredientId) {
  if (state !== STATE.ORDERING) return;

  const ingredient = ingredientById.get(ingredientId);
  const mesh = meshById.get(ingredientId);
  if (!ingredient || !mesh) return;

  const index = basket.indexOf(ingredientId);

  if (index === -1) {
    basket.push(ingredientId);
    highlightIngredient(mesh, true);
  } else {
    basket.splice(index, 1);
    highlightIngredient(mesh, false);
  }

  // Выбранные продукты выставляем на синий стол продавца
  setCounterItems(basket);
  renderBasket();
}

/**
 * Кнопка «Готово»: сверяет набранную сумму с ценой заказа клиента.
 * Игра не проверяет состав набора — только итоговую стоимость.
 */
export function submitOrder() {
  if (state !== STATE.ORDERING) return;
  if (basket.length === 0) return;

  const now = performance.now();
  const sum = currentSum();
  const targetPrice = queue[0] ? queue[0].order.targetPrice : 0;

  if (sum === targetPrice) {
    finishOrder(STATE.SUCCESS, now);
  } else {
    finishOrder(STATE.FAIL_WRONG, now, sum);
  }
}

/**
 * Снимок состояния — используется для отладки и автотестов.
 * @returns {object}
 */
export function getState() {
  const active = queue[0];
  return {
    state,
    lastResult,
    counters: { ...counters },
    basket: basket.slice(),
    total: currentSum(),
    targetPrice: active ? active.order.targetPrice : 0,
    monolog: active ? active.order.monolog : '',
    clientCount: queue.length,
    timeLeft: state === STATE.ORDERING ? Math.max(0, deadline - performance.now()) : 0,
  };
}
