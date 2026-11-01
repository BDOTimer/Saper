// g-state.js
// import { STATE } from '../core/g-state.js';

export class GameState {
  constructor(opts  = {}) {
    this._listeners = new Set();
    this._init(opts);
  }
  _init({ world  = null, players = null, seed = 0 } = {}) {
    this.world   = world;
    this.players = players;
    this.seed    = seed;
    this.turn    = 1;
    this.currentPlayerIndex = 0;
    this.phase   = 'idle';          // idle|map|game|gameover
    this.flags   = {};
    this.meta    = {};

    this.isTurnCircle = true; // Конец ходов круга.
  }
  get currentPlayer() {
    return this.players?.active()[this.currentPlayerIndex] ?? null;
  }
  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit() { for (const fn of this._listeners) fn(this); }
  set(key, value) { this[key] = value; this._emit(); }
  patch(obj) { Object.assign(this, obj); this._emit(); }
  setPhase(p) { this.set('phase', p); }
  nextTurn() {
    const n = this.players?.activeCount ?? 0;
    if (!n) return;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % n;
    if (this.currentPlayerIndex === 0) this.turn++;
    this._emit();
  }
  reset(opts = {}) { this._init(opts); this._emit(); }   // вместо new GameState
  toJSON() { /* снимок без _listeners */ }
  fromJSON(d) { /* Object.assign + _emit */ }


}

export const STATE = new GameState();

/**
 * Таймер для периодических событий (например, авто-завершение хода каждые 0.5 сек)
 */
export class TurnTimer {

  #isTick = false;

  constructor(intervalSeconds = 0.5) {
    this._accumulator = 0;
    this._interval = intervalSeconds;
    this._isPaused = false;
  }

  /**
   * Обновляет таймер прошедшим временем (deltaTime).
   * Возвращает true, если интервал истёк и нужно выполнить действие.
   */
  update(dt) {
    if (this._isPaused || dt <= 0) return false;

    this._accumulator += dt;

    // Проверяем, сколько полных интервалов прошло (защита от накопления ошибок)
    const ticks = Math.floor(this._accumulator / this._interval);
    
    if (ticks > 0) {
      // Вычитаем только полные прошедшие интервалы
      this._accumulator -= ticks * this._interval;
      this.#isTick = true;
    }
    this.#isTick = false;
  }

  get isTick() { return this.#isTick ; }
  clearIsTick(){ this.#isTick = false; }

  get interval() {
    return this._interval;
  }

  set interval(seconds) {
    if (seconds <= 0) {
      throw new Error('Интервал должен быть больше 0');
    }
    this._interval = seconds;
    // При смене интервала можно сбросить аккумулятор, чтобы не было резких скачков
    this._accumulator = 0;
  }

  get isPaused() {
    return this._isPaused;
  }

  set isPaused(value) {
    this._isPaused = Boolean(value);
  }

  reset() {
    this._accumulator = 0;
  }

  stop() {
    this._isPaused = true;
    this._accumulator = 0;
  }
}

export const TICK = new TurnTimer();



