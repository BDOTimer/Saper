/**
 * main.js — точка входа игры.
 *
 * Инициализирует 3D-сцену, запускает игру, переводит клики мыши в попадания
 * Raycaster'а и крутит requestAnimationFrame-цикл.
 */

import * as THREE from 'three';
import { getIngredientObjects, initScene } from './scene.js';
import { handleIngredientClick, startGame, submitOrder, update } from './game.js';

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

// Клики по моделям в панели заказа тоже должны «звенеть»
document.addEventListener('barista:click', playClickSound);

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

// Курсор-указатель при наведении на ингредиент
canvas.addEventListener('pointermove', (event) => {
  const hit = pickIngredient(event);
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
  const hit = pickIngredient(event);
  if (!hit) return;

  playClickSound();
  showIngredientLabel(hit);
  handleIngredientClick(hit.userData.ingredientId);
});

// Кнопка «Готово»
document.getElementById('submit-btn').addEventListener('click', () => {
  playClickSound();
  submitOrder();
});

startGame();

/**
 * Игровой цикл. Время берём из performance.now() — таймер заказа
 * не «плывёт» даже при потере фокуса вкладки.
 */
function frame() {
  const now = performance.now();
  update(now);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
