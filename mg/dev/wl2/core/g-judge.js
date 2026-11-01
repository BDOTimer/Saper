
/// core/g-judge.js
import { mulberry32, fbm } from './rng.js';
import { Players         } from './players.js';
import { WorldMap        } from './world.js';
import { STATE, TICK     } from './g-state.js';
import { NAME            } from './gen-name.js';
import { UNIT_TYPES, Unit, Army } from './units.js';

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

    this._citiesStart();
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
  playerGo     (i) { playerByIndex(i).isTurn = true; };

  update(dt) {
    
    const player = currentPlayer();

    if (player.isTurn)
    {   const nextId = this.endTurn();
        this.playerGo(nextId);
    }

    if (STATE.isTurnCircle) _doCities();

    /// ...

    STATE.isTurnCircle = false;
  }

  _doCities()
  {
    const cities = this.world.cities;
    const player = currentPlayer();
  }

  // В столицах спавнить героев...
  _citiesStart()
  {
    const cities = this.world.cities;

    for (const city of cities) {
      if (city.type !== 'capital') continue;
      if (city.ownerId == null)    continue;

      const owner = this.playerByIndex(city.ownerId);
      if ( !owner ) continue;
      
      const army = this._createHero(city, owner);

      owner.addArmy(army);
      this.world.addArmy(army);
    }
  }

  _createHero(city, owner)
  {   const hero  = Unit.spawn(owner.index, 'HERO');
      const army  = Army.spawn(owner.index, city.x, city.y, [hero]);
      console.log(`🔍 id:${owner.index} - ${city.name}: Была создана армия расы ` +
                  `${NAME.race(owner.index)} с героем ${hero.name}`);
      return army;
  }
}