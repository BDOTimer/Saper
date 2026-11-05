/// core/g-battle.js
///
/// Описание:
///  -  Чистая игровая логика битвы двух армий (без DOM/рендера).
///  -  Бой идёт раундами: раз в раунд фронтовые юниты сталкиваются,
///     один из них гибнет. Визуализирует раунды BattleView (звонок step().
///  -  Порядок юнитов в стеке: слабые впереди («пушечное мясо»), как
///     в Warlords II — перед боем army.sortByStrength().

import { STATE } from './g-state.js';

/** Длина одного раунда боя (мс) — визуал тикает с этим же шагом */
export const ROUND_MS = 2000;

/** Отступ центра: расстояние от середины окна до фронтовых юнитов (мировые ед.) */
export const FRONT_GAP = 0.6;

/**
 * Вероятность победы атакующего юнита в раунде:
 *   p = damage / (damage + defense защитника)
 * ТЗ: «рандом от [дамага] и [защиты] юнита».
 * @param {Unit} attacker
 * @param {Unit} defender
 * @returns {number} 0..1
 */
export function winChance(attacker, defender)
{
  const d = Math.max(0, attacker.damage    ?? attacker.strength    ?? 1);
  const s = Math.max(0, defender.defense   ?? defender.strength    ?? 1);
  return d + s > 0 ? d / (d + s) : 0.5;
}

///-----------------------------------------------------------------:
/// Battle — битва армий attacker (игрок текущего хода) и defender.
///-----------------------------------------------------------------:
export class Battle {
  /**
   * @param {Army} attacker — армия игрока текущего хода (в окне слева)
   * @param {Army} defender — армия соперника (в окне справа)
   */
  constructor(attacker, defender) {
    this.attacker = attacker;
    this.defender = defender;

    this.round    = 0;     // номер сыгранного раунда
    this.finished = false;
    this.winner   = null;  // Army|null — установлен при завершении
    this.loser    = null;  // Army|null

    // Бой 1-на-1: слабые юниты впереди стека (фронт = units[0])
    attacker.sortByStrength();
    defender.sortByStrength();
  }

  /** Живой фронтовый юнит армии (units[0] — самый «передний») */
  _front(army) { return army.units.find(u => u.alive) ?? null; }

  /**
   * Один раунд боя. Побеждённый юнит гибнет (hp=0) и удаляется из армии.
   * Когда у проигравшего не останется юнитов — битва завершена,
   * вызывается сигнал конца битвы (cleanup армии из мира).
   *
   * @returns {Object|null} результат раунда для визуализации:
   *   { round, attacker, defender, attackerUnit, defenderUnit,
   *     loserUnit, loserArmy, winnerArmy, finished }
   *   или null, если битва уже закончена.
   */
  step() {
    if (this.finished) return null;

    const ua = this._front(this.attacker);
    const ub = this._front(this.defender);

    // Одна из сторон пуста (странное состояние) — завершаем.
    if (!ua || !ub) return this._settle(ua, ub);

    this.round++;

    const p            = winChance(ua, ub);
    const attackerWins = Math.random() < p;

    const loserUnit  = attackerWins ? ub : ua;
    const loserArmy  = attackerWins ? this.defender : this.attacker;
    const winnerArmy = attackerWins ? this.attacker : this.defender;

    loserUnit.hp = 0;                       // юнит погиб
    loserArmy.removeUnit(loserUnit.id);

    const res = {
      round:        this.round,
      attacker:     this.attacker,
      defender:     this.defender,
      attackerUnit: ua,
      defenderUnit: ub,
      loserUnit,
      loserArmy,
      winnerArmy,
      finished: false,
    };

    // У проигравшего не осталось юнитов — сигнал «конец битвы».
    if (!loserArmy.alive || loserArmy.count === 0) {
      this.finished = true;
      this.winner   = winnerArmy;
      this.loser    = loserArmy;
      res.finished  = true;
      this._removeArmyFromWorld(loserArmy);
    }

    return res;
  }

  /** Завершение «на всякий случай»: одна сторона без фронтового юнита */
  _settle(ua, ub) {
    this.finished = true;
    if (ua)      { this.winner = this.attacker; this.loser = this.defender; }
    else         { this.winner = this.defender; this.loser = this.attacker; }

    if (this.loser) this._removeArmyFromWorld(this.loser);

    return {
      round: this.round, finished: true,
      winnerArmy: this.winner, loserArmy: this.loser,
    };
  }

  /** Убрать погибшую армию из мира и из армии владельца */
  _removeArmyFromWorld(army) {
    if (!army) return;

    const world = STATE.world;
    const cell  = world?.get?.(army.x, army.y);
    cell?.removeArmy?.(army);

    const owner = STATE.players?.get?.(army.idOwner);
    owner?.delArmy?.(army);
  }
}
