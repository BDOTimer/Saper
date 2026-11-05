// g-state.js
// import { STATE } from '../core/g-state.js';

const Config =
{
  test: 
  {
    seed  : 1337,
    map   : { minW: 10, maxW: 200, W: 20, minH: 10, maxH: 100, H: 20 },
    cities: { min: 8, max: 20, val: 8 }
  },

  game:
  { seed  : 1337,
    map   : { minW: 40, maxW: 200, W: 20, minH: 40, maxH: 100, H: 20 },
    cities: { min: 30, max: 50, val: 40 }
  }
};

export class GameState {
  constructor(opts  = {}) {
    this._listeners = new Set();
    this._init(opts);

    this.config = Config.test;
  }
  _init({ world  = null, players = null, seed = 0 } = {})
  {
    this.world   = world;         // Мир
    this.players = players;       // Игроки
    this.seed    = seed;          // Сид карты
    this.turn    = 1;             // Номер круга
    this.currentPlayerIndex = 0;  // Индекс игрока, делающего ход
    this.phase   = 'idle';        // idle|map|game|gameover
    this.flags   = {};            // Флаги городов(?)
    this.meta    = {};            // ...

    this.isTurnCircle = true;     // Конец ходов круга.
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

  #isTick = true;

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



