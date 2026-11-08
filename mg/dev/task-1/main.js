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

  const hits = raycaster.intersectObjects(getIngredientObjects(), false);
  return hits.length > 0 ? hits[0].object : null;
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
  const point = mesh.position.clone();
  point.y += 0.42;
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

  showIngredientLabel(hit);
  handleIngredientClick(hit.userData.ingredientId);
});

// Кнопка «Готово»
document.getElementById('submit-btn').addEventListener('click', () => {
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
