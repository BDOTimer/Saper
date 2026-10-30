
/// core/g-judge.js
import { mulberry32, fbm } from './rng.js';
import { Players         } from './players.js';
import { WorldMap        } from './world-map.js';

///----------------------------------------------------------------------------|
/// Судья знающий правила игры...
///----------------------------------------------------------------------------:
export class Judge {
  /**
   * @param {WorldMap} worldMap
   * @param {Players} playersModel
   */
  constructor(worldMap, playersModel) {
    this.world  = worldMap;
    // только «в игре»
    this.players = playersModel.active();          // Player[]
    this.currentIndex = 0;

    // быстрый доступ: владелец клетки → Player
    this._byIndex = new Map(this.players.map(p => [p.index, p]));

    this.turn = 1;
  }

  get currentPlayer() { return this.players[this.currentIndex] ?? null; }
  get isHumanTurn()   { return this.currentPlayer?.isHuman ?? false; }

  /** Завершить ход текущего игрока и передать следующему */
  endTurn() {
    this.currentIndex = (this.currentIndex + 1) % this.players.length;
    if (this.currentIndex === 0) this.turn++;
    return this.currentPlayer;
  }

  /** Найти Player по индексу */
  playerByIndex(i) { return this._byIndex.get(i) ?? null; }
}