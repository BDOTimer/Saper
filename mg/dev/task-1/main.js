/**
 * main.js — точка входа игры.
 *
 * Инициализирует 3D-сцену, запускает игру, переводит клики мыши в попадания
 * Raycaster'а и крутит requestAnimationFrame-цикл.
 */

import * as THREE from 'three';
import { getClientObjects, getIngredientObjects, initScene, updateCharacters } from './scene.js';
import {
  handleClientClick,
  handleIngredientClick,
  pauseGame,
  resumeGame,
  startGame,
  submitOrder,
  update,
} from './game.js';

const canvas = document.getElementById('scene-canvas');
const ingredientLabel = document.getElementById('ingredient-label');

// Сцена, камера и рендерер создаются один раз
const { scene, camera, renderer } = initScene(canvas);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

/** AudioContext создаём лениво: браузер разрешает звук только после клика. */
let audioContext = null;

function getAudioContext() {
  if (audioContext) return audioContext;

  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;

  audioContext = new AudioCtor();
  return audioContext;
}

/**
 * Короткий «зинь» на клик мыши: две синусоиды с быстрым затуханием.
 * Никаких звуковых файлов — только Web Audio API.
 */
function playClickSound() {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    context.resume();
  }

  const now = context.currentTime;

  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.28, now + 0.006);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  master.connect(context.destination);

  // Основной тон и октава выше — вместе звучит звонко
  const partials = [
    { frequency: 1567.98, level: 1, decay: 0.42 },
    { frequency: 2093.0, level: 0.45, decay: 0.3 },
  ];

  partials.forEach(({ frequency, level, decay }) => {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(level, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(now);
    oscillator.stop(now + decay + 0.02);
  });
}

/**
 * Первый клик в окне разблокирует звук: создаём и запускаем AudioContext.
 * Браузер разрешает старт звука только внутри пользовательского жеста.
 */
function unlockAudio() {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    context.resume();
  }

  // Дальше контекст уже живёт — обработчики больше не нужны
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
}

window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

/**
 * Одна нота с огибающей — основа для всех звуков игры.
 */
function playTone(context, { frequency, start, duration, type = 'sine', level = 0.2, endFrequency = null }) {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  }

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(level, start + Math.min(0.03, duration / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

/** Слабый тик часов — короткий щелчок раз в секунду. */
function playTickSound() {
  // До первого клика пользователя звук браузером запрещён
  if (!audioContext || audioContext.state !== 'running') return;

  const context = audioContext;
  const start = context.currentTime;

  const oscillator = context.createOscillator();
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(1900, start);
  oscillator.frequency.exponentialRampToValueAtTime(900, start + 0.03);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.045, start + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.045);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.06);
}

/** Клиент получил заказ: короткое восходящее арпеджио. */
function playJoySound() {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === 'suspended') context.resume();

  const start = context.currentTime + 0.01;
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    playTone(context, {
      frequency,
      start: start + index * 0.085,
      duration: 0.32,
      level: 0.16,
    });
  });
}

/** Клиент не получил заказ: две нисходящие ноты. */
function playFailSound() {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === 'suspended') context.resume();

  const start = context.currentTime + 0.01;
  playTone(context, {
    frequency: 349.23,
    start,
    duration: 0.3,
    type: 'triangle',
    level: 0.18,
    endFrequency: 261.63,
  });
  playTone(context, {
    frequency: 261.63,
    start: start + 0.24,
    duration: 0.55,
    type: 'triangle',
    level: 0.18,
    endFrequency: 174.61,
  });
}

// Клики по моделям в панели заказа тоже должны «звенеть»
document.addEventListener('barista:click', playClickSound);

// Реакция клиента на итог заказа
document.addEventListener('barista:success', playJoySound);
document.addEventListener('barista:fail', playFailSound);

/**
 * Переводит координаты события в нормализованные координаты сцены (-1..1).
 * Считается по фактическому размеру canvas, поэтому корректно работает
 * при любом размере окна.
 * @param {PointerEvent|MouseEvent} event
 */
function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

/**
 * Ищет ингредиент под курсором.
 * @param {PointerEvent|MouseEvent} event
 * @returns {THREE.Mesh|null}
 */
function pickIngredient(event) {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);

  // Модель продукта — это группа из нескольких мешей, поэтому проверяем
  // вложенные объекты и поднимаемся до группы с ingredientId
  const hits = raycaster.intersectObjects(getIngredientObjects(), true);
  if (hits.length === 0) return null;

  let node = hits[0].object;
  while (node && node.userData.ingredientId === undefined) {
    node = node.parent;
  }

  return node && node.userData.ingredientId !== undefined ? node : null;
}

/**
 * Ищет клиента под курсором.
 * @param {PointerEvent|MouseEvent} event
 * @returns {THREE.Group|null}
 */
function pickClient(event) {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(getClientObjects(), true);
  if (hits.length === 0) return null;

  let node = hits[0].object;
  while (node && node.userData.isClient !== true) {
    node = node.parent;
  }

  return node && node.userData.isClient === true ? node : null;
}

// Курсор-указатель при наведении на ингредиент
canvas.addEventListener('pointermove', (event) => {
  const hit = pickIngredient(event) || pickClient(event);
  canvas.style.cursor = hit ? 'pointer' : 'default';
});

/**
 * Показывает название ингредиента подписью над моделью на полке.
 * @param {THREE.Mesh} mesh — ингредиент, по которому кликнули
 */
function showIngredientLabel(mesh) {
  if (!ingredientLabel) return;

  const rect = canvas.getBoundingClientRect();
  // Ингредиенты лежат внутри сдвинутой группы, поэтому берём мировые координаты
  const point = new THREE.Vector3();
  mesh.getWorldPosition(point);
  // Продукты на полках вдвое крупнее, подпись поднимаем выше макушки модели
  point.y += 0.78;
  point.project(camera);

  ingredientLabel.textContent = mesh.userData.ingredientName;
  ingredientLabel.style.left = `${rect.left + (point.x * 0.5 + 0.5) * rect.width}px`;
  ingredientLabel.style.top = `${rect.top + (-point.y * 0.5 + 0.5) * rect.height}px`;
  ingredientLabel.hidden = false;

  // перезапуск CSS-анимации появления
  ingredientLabel.classList.remove('is-visible');
  void ingredientLabel.offsetWidth;
  ingredientLabel.classList.add('is-visible');
}

// Клик по модели на полке: показываем название ингредиента текстом,
// а добавление/удаление из корзины делает game.js
canvas.addEventListener('click', (event) => {
  const ingredient = pickIngredient(event);
  if (ingredient) {
    playClickSound();
    showIngredientLabel(ingredient);
    handleIngredientClick(ingredient.userData.ingredientId);
    return;
  }

  // Клик по первому клиенту — он забирает заказ (альтернатива кнопке «Готово»)
  const client = pickClient(event);
  if (client) {
    playClickSound();
    handleClientClick(client);
  }
});

// Кнопка «Готово»
document.getElementById('submit-btn').addEventListener('click', () => {
  playClickSound();
  submitOrder();
});

// Правила игры: пока панель открыта, заказы не сгорают
const rulesModal = document.getElementById('rules-modal');

document.getElementById('help-btn').addEventListener('click', () => {
  rulesModal.hidden = false;
  pauseGame();
});

document.getElementById('resume-btn').addEventListener('click', () => {
  rulesModal.hidden = true;
  resumeGame();
});

document.getElementById('new-game-btn').addEventListener('click', () => {
  rulesModal.hidden = true;
  resumeGame();
  startGame();
});

startGame();

let previousFrame = performance.now();
let lastTickSecond = Math.floor(previousFrame / 1000);

/**
 * Игровой цикл. Время берём из performance.now() — таймер заказа
 * не «плывёт» даже при потере фокуса вкладки.
 */
function frame() {
  const now = performance.now();
  const dt = Math.min((now - previousFrame) / 1000, 0.1);
  previousFrame = now;

  // Тик часов — ровно раз в секунду, синхронно с маятником
  const currentSecond = Math.floor(now / 1000);
  if (currentSecond !== lastTickSecond) {
    lastTickSecond = currentSecond;
    playTickSound();
  }

  update(now);
  updateCharacters(now, dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
