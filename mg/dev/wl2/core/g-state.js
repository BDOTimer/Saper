// g-state.js
// import { state } from '../core/g-state.js';

export class GameState {
  constructor(opts = {}) {
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

export const state = new GameState();