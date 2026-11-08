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
  getClientObjects,
  getIngredientObjects,
  highlightIngredient,
  removeClient,
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

/** Горизонтальные позиции клиентов в очереди слева направо. */
const CLIENT_SLOTS_X = [-2, -0.7, 0.7, 2];

/** Сколько клиентов одновременно стоит в очереди. */
const QUEUE_SIZE = 4;

let state = STATE.IDLE;

/** Очередь: [{ id, mesh, order }], queue[0] — активный клиент. */
let queue = [];

/** Корзина: идентификаторы выбранных ингредиентов в порядке выбора. */
let basket = [];

/** Счётчики игры. */
let counters = { served: 0, errors: 0, penalty: 0 };

/** Абсолютный дедлайн текущего заказа (мс по performance.now()). */
let deadline = 0;

/** Момент, когда можно начинать следующий заказ. */
let resumeAt = 0;

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

/** Обновляет верхнюю панель со счётчиками. */
function renderCounters() {
  els.served.textContent = String(counters.served);
  els.errors.textContent = String(counters.errors);
  els.penalty.textContent = formatPrice(counters.penalty);
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

/**
 * Рисует мини-модель ингредиента: та же форма и цвет, что и объект на полке,
 * только в виде SVG, чтобы продавец видел состав заказа без 3D-рендера.
 * @param {string} shape — 'box' | 'cylinder' | 'sphere'
 * @param {string} color — цвет ингредиента
 * @returns {string} SVG-разметка
 */
function createModelSvg(shape, color) {
  const frame =
    'width="38" height="38" viewBox="0 0 40 40" aria-hidden="true" focusable="false"';

  if (shape === 'cylinder') {
    return (
      `<svg ${frame}>` +
      `<rect x="10" y="9" width="20" height="22" fill="${color}"></rect>` +
      `<ellipse cx="20" cy="31" rx="10" ry="4" fill="${color}"></ellipse>` +
      `<ellipse cx="20" cy="9" rx="10" ry="4" fill="${color}"></ellipse>` +
      `<ellipse cx="20" cy="9" rx="10" ry="4" fill="#ffffff" opacity="0.25"></ellipse>` +
      '</svg>'
    );
  }

  if (shape === 'sphere') {
    return (
      `<svg ${frame}>` +
      `<circle cx="20" cy="21" r="13" fill="${color}"></circle>` +
      `<circle cx="15" cy="16" r="4.5" fill="#ffffff" opacity="0.3"></circle>` +
      '</svg>'
    );
  }

  // Куб в изометрии: три грани разной яркости
  return (
    `<svg ${frame}>` +
    `<polygon points="20,4 34,11 20,18 6,11" fill="${color}" opacity="0.95"></polygon>` +
    `<polygon points="6,11 20,18 20,35 6,28" fill="${color}" opacity="0.66"></polygon>` +
    `<polygon points="34,11 20,18 20,35 34,28" fill="${color}" opacity="0.45"></polygon>` +
    '</svg>'
  );
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
      model.addEventListener('click', () => showIngredientName(ingredient.name, model));

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
}

/**
 * Создаёт запись очереди для 3D-объекта клиента.
 * Заказ генерируется сразу — клиент «знает», что хочет заказать.
 * @param {THREE.Mesh} mesh
 */
function createQueueEntry(mesh) {
  clientSeq += 1;
  return {
    id: clientSeq,
    mesh,
    order: generateOrder(),
  };
}

/** Плавно сдвигает клиентов к их позициям в очереди (лерп по кадрам). */
function updateClients(dt) {
  const factor = 1 - Math.exp(-9 * dt);

  queue.forEach((entry, index) => {
    const targetX = CLIENT_SLOTS_X[Math.min(index, CLIENT_SLOTS_X.length - 1)];
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
    statusText = `Заказ собран: ${formatPrice(targetPrice)}. Спасибо!`;
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

  // Корзина очищается при любом исходе
  clearBasket();

  // Активный клиент уходит, очередь сдвигается,
  // в конец встаёт новый клиент (removeClient создаёт его сам).
  const departed = queue.shift();
  const freshClient = removeClient(departed.mesh);
  if (freshClient) {
    queue.push(createQueueEntry(freshClient));
  }

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

  // Стартовая очередь: четыре клиента, уже стоящие за стойкой
  const clients = getClientObjects().slice(0, QUEUE_SIZE);
  clients.forEach((mesh, index) => {
    mesh.position.x = CLIENT_SLOTS_X[index];
    queue.push(createQueueEntry(mesh));
  });

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
