
/// core/g-judge.js
import { mulberry32, fbm } from './rng.js';
import { Players         } from './players.js';
import { WorldMap        } from './world.js';
import { STATE, TICK     } from './g-state.js';
import { NAME            } from './gen-name.js';
import { UNIT_TYPES, Unit, Army } from './units.js';
import { tickCityProduction } from './production.js';

///----------------------------------------------------------------------------|
/// Судья знающий правила игры...
///----------------------------------------------------------------------------:
export class Judge {
  /**
   * @param {WorldMap} worldMap
   * @param {Players} playersModel
   * @param {object|null} territories — результат distributeTerritoriesAndCapitals
   */
  constructor(worldMap, playersModel, territories = null) {
    this.world  = worldMap;
    this.territories = territories;

    // Мир доступен всем, кто работает через глобальное состояние
    // (Player.doStep() берёт его отсюда: STATE.world).
    STATE.world = worldMap;

    // только «в игре»
    this.players = playersModel.active();          // Player[]
    this.currentIndex = 0;

    // быстрый доступ: владелец клетки → Player
    this._byIndex = new Map(this.players.map(p => [p.index, p]));

    // Номер круга храним в глобальном состоянии — единый источник истины.
    STATE.turn = 1;

    // Ожидание зелёной кнопки HUD между кругами:
    // true — круг завершился, следующий запускает игрок кнопкой.
    this.awaitNextCircle = false;

    // Колбэк Game: (player) => void — игрок вступил в ход
    // (маршруты построены, можно показывать их и запускать армии).
    this.onTurnStart = null;

    // Колбэк Game: (result) => void — в городе выпущен юнит.
    // result = { army, unit, city, typeKey, created } (см. core/production.js).
    this.onCityProduced = null;

    // Счётчик кругов производства не должен тикать до первого круга.
    STATE.isTurnCircle = false;

    this._citiesStart();
  }

  get currentPlayer() { return this.players[this.currentIndex] ?? null; }
  get turn()          { return STATE.turn; }
  get isHumanTurn()   { return this.currentPlayer?.isHuman ?? false; }
  get isAwaitingNextCircle() { return this.awaitNextCircle; }

  /** Завершить ход текущего игрока и передать следующему */
  endTurn() {
    this.currentIndex = (this.currentIndex + 1) % this.players.length;
    if (this.currentIndex === 0) STATE.turn++;
    return this.currentPlayer;
  }

  /** Найти Player по индексу */
  playerByIndex(i) { return this._byIndex.get(i) ?? null; }

  ///----------------------------------------------------------
  /// Игрок вступает в ход: маршруты строятся для КАЖДОЙ его армии
  /// (Player.doStep → AiBrainHelper.find/buildRoute → army.route).
  ///----------------------------------------------------------:
  playerGo()
  {   const player = this.currentPlayer;
      player.isTurn = true; /// Игрок в процессе хода

      player.doStep();

      // Сообщаем экрану игры: можно рисовать красные маркеры маршрутов
      // и запускать плавное передвижение армий.
      this.onTurnStart?.(player);

      // Передать ход другому игроку можно ТОЛЬКО после всех анимаций —
      // это делает Game через judge.finishCurrentTurn().
  }

  ///----------------------------------------------------------
  /// Завершить ход текущего игрока.
  /// Зовёт Game, когда ВСЕ армии игрока закончили движение.
  ///----------------------------------------------------------:
  finishCurrentTurn()
  {   if (this.awaitNextCircle) return null;      // уже ждём кнопку
      const prev = this.currentPlayer;
      if (!prev || !prev.isTurn) return null;     // ход не активен

      prev.isTurn = false;   // анимации завершены — ход можно передать
      const next = this.endTurn();

      // Круг замкнулся — ждём зелёную кнопку HUD.
      if (this.currentIndex === 0)
      {   STATE.isTurnCircle = true;
          this.awaitNextCircle = true;
      }
      return { prev, next };
  }

  ///----------------------------------------------------------
  /// Зелёная кнопка HUD: запустить следующий круг.
  ///----------------------------------------------------------:
  startNextCircle()
  {   this.awaitNextCircle = false;
  }

  update(dt) {

    // Конец круга: производство в городах (счётчики кругов и выпуск юнитов).
    if (STATE.isTurnCircle)
    {   this._doCities();
    }
    STATE.isTurnCircle = false;

    // Между кругами ходы не стартуем — ждём зелёную кнопку.
    if (this.awaitNextCircle) return;

    // Если текущий игрок ещё не в ходу — он вступает в ход.
    const player = this.currentPlayer;
    if (player && !player.isTurn)
    {   this.playerGo();

        //console.log("🔍: Signal-1");
    }
  }

  _doCities()
  {
    const cities = this.world?.cities ?? [];

    for (const city of cities)
    {
      // Руины не производят и не имеют владельца.
      if (city.type === 'ruins') continue; // !!
      // Нейтральные города не производят.
      if ((city.ownerId ?? null) === null) continue;

      const owner = this.playerByIndex(city.ownerId);
      if (!owner) continue;

      // В конце полного круга: счётчик -1; на нуле — выпуск юнита в армию
      // (армия создаётся автоматически, если её ещё нет).
      const produced = tickCityProduction(this.world, owner, city);
      if (produced) this.onCityProduced?.(produced);
    }
  }

  // В столицах спавнить героев...
  _citiesStart()
  {
    const records = this.territories?.players ?? [];

    if (records.length > 0) {
      for (const rec of records) {
        const city  = rec?.capital;
        const owner = rec?.player ?? this.playerByIndex(rec?.ownerId);
        if (!city || !owner) continue;

        const army = this._createHero(city, owner);
        if (!army) continue;

        city.ownerId = owner.index;
        owner.addArmy(army);
        this.world.addArmy(army);
      }
      return;
    }

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
      // console.log(`🔍 id:${owner.index} - ${city.name}: Была создана армия расы ` +
      //             `${NAME.race(owner.index)} с героем ${hero.name}`);

      this._addUnits2ArmyHero(army, owner);

      return army;
  }

  _addUnits2ArmyHero(army, owner)
  {
    if (!army || !owner) return;

    for (const typeKey of Object.keys(UNIT_TYPES))
    {
      if (typeKey === 'HERO') continue;       // герой уже в армии

      const unit = Unit.spawn(owner.index, typeKey);
      if (!army.addUnit(unit)) break;         // армия заполнена
    }
  }
}
