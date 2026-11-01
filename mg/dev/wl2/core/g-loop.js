/// core/g-loop.js
///
/// Описание:
///  - Единственный владелец requestAnimationFrame на всё приложение.
///  - Считает dt между кадрами, клампит его (защита от свёрнутой вкладки).
///  - Зовёт update(dt) и render(dt) у активного экрана.
///  - Не знает ничего про Game, MapView, Judge — только про контракт экрана.
///
/// Контракт экрана (screen):
///  - update?(dt)  — логика/таймеры (может отсутствовать)
///  - render?(dt)  — визуал (может отсутствовать)
///  - destroy?()   — освобождение ресурсов при смене экрана
///
/// Использование:
///   import { gameLoop } from './core/g-loop.js';
///   gameLoop.start();
///   gameLoop.setScreen(game);   // при старте партии
///   gameLoop.setScreen(null);   // при выходе в меню

import { TICK } from './g-state.js';

const MAX_DT = 100; // мс — потолок, чтобы не прыгать после сворачивания вкладки

export class GameLoop {
  constructor() {
    this._rafId    = null;
    this._lastT    = 0;
    this._screen   = null;
    this._running  = false;
    this._paused   = false;

    // привязка, чтобы removeEventListener/cancelAnimationFrame работали стабильно
    this._tick = this._tick.bind(this);
  }

  /** Текущий активный экран (Game, Menu, Generator — что угодно с контрактом). */
  get screen() { return this._screen; }
  get running() { return this._running; }
  get paused()  { return this._paused;  }

  /**
   * Установить активный экран.
   * Предыдущий экран получает destroy(), если он есть.
   * @param {{update?:Function, render?:Function, destroy?:Function}|null} screen
   */
  setScreen(screen) {
    if (this._screen === screen) return;
    const prev = this._screen;
    this._screen = screen ?? null;
    if (prev?.destroy) {
      try { prev.destroy(); }
      catch (e) { console.error('[GameLoop] destroy() предыдущего экрана:', e); }
    }
  }

  /** Запустить цикл. Идемпотентно. */
  start() {
    if (this._running) return;
    this._running = true;
    this._lastT   = performance.now();
    this._rafId   = requestAnimationFrame(this._tick);
  }

  /** Остановить цикл полностью (rAF отменяется). */
  stop() {
    if (!this._running) return;
    this._running = false;
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Пауза: rAF продолжает крутиться (чтобы можно было возобновить одним кликом),
   * но update() не зовётся. render() тоже не зовётся — по желанию можно оставить,
   * но для пошаговой игры логично останавливать всё.
   */
  pause () { this._paused = true;  this._lastT = performance.now(); }
  resume() { this._paused = false; this._lastT = performance.now(); }

  /** Главный тик. */
  _tick(t) {
    if (!this._running) return;

    TICK.update(t);

    // планируем следующий кадр сразу — чтобы ошибка в update/render не убила цикл
    this._rafId = requestAnimationFrame(this._tick);

    // dt с защитой от «прыжка» (свёрнутая вкладка, долгий GC, дебаггер)
    let dt = t - this._lastT;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    if (dt > MAX_DT) dt = MAX_DT;
    this._lastT = t;

    if (this._paused) return;

    const s = this._screen;
    if (!s) return;

    if (typeof s.update === 'function') {
      try { s.update(dt); }
      catch (e) { console.error('[GameLoop] update():', e); }
    }

    if (typeof s.render === 'function') {
      try { s.render(dt); }
      catch (e) { console.error('[GameLoop] render():', e); }
    }

    TICK.clearIsTick();
  }
}

/** Синглтон — удобно импортировать в main.js и Game. */
export const gameLoop = new GameLoop();