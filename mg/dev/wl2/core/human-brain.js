// human-brain.js
//
// ТЗ:
//  -   class HumanBrain отвечает за игру Человека.
//  -   существует в единственном экземпляре на протяжении всей игры.
//  -   позволяет игроку-человеку делать ходы.
//  -   для этого подключает клавиатуру и мышь для управления ходами
//          для текущего игрока, который человек.
//  -   ходы делаются для каждой армии, которая принадлежит этому игроку.
//  -   чужие армии и города не доступны для текущего игрока.
//  -   игрок-человек делает клик на карте и к этой клетке автоматически
//          прокладывается маршрут.
//  -   маршрут армии помечается маркером, пока выбрана данная армия.
//  -   клетка армии в фокусе (очередь хода/выбор) автоматически выбирается,
//      а камера плавно центрируется на ней.
//  -   далее кликается кнопка «ИДТИ ПО МАРШРУТУ».
//  -   армия проходит по маршруту, согласно своим статам.
//  -   после завершения хода армии управление передаётся следующей армии.
//  -   после того как все армии завершат свои ходы, управление передаётся
//          следующему игроку компьютеру/человеку.
//  -   игроки-боты делают свои ходы без участия людей — автоматически.
//  -   все текущие анимации оставлены на месте (их крутит ArmyMover/MapView).
//
// Взаимодействие:
//   Game._onTurnStart(player) → player.isHuman ? brain.begin(player)
//                                            : mover.enqueue(player.army)
//   Game._onTileClick(tile)   → brain.handleTileClick(tile)
//   ArmyMover.onArmyArrive    → brain.onArmyArrive(army)
//   ArmyMover.onQueueEmpty    → brain.onQueueEmpty()  (true = ход ещё наш)
//   Game._onBattleRequest     → brain.onBattleStart(army)
//   Game._onBattleEnd         → brain.onBattleEnd(winner, loser)
//
// HumanBrain НЕ импортирует Three.js и не трогает сцену напрямую —
// только routeView/unitsView через переданные зависимости.

import { AiBrainHelper } from './ai-brain.js';
import { STATE } from './g-state.js';

export class HumanBrain {
  /** Единственный экземпляр на всё время работы игры. */
  static get() {
    return HumanBrain._instance ?? (HumanBrain._instance = new HumanBrain());
  }

  static reset() {
    const inst = HumanBrain._instance;
    if (inst) inst.detach();
    HumanBrain._instance = null;
  }

  constructor() {
    /** Идёт ли сейчас ход игрока-человека. */
    this.active = false;
    /** @type {import('./players.js').Player|null} */
    this.player = null;
    /** @type {import('./units.js').Army|null} — выбранная армия. */
    this.selected = null;

    this._moving = false;      // армия сейчас идёт по маршруту
    this._inBattle = false;    // идёт бой, ход приостановлен
    this._autoArmy = null;     // армия, идущая по СОХРАНЁННОМУ маршруту
    this._acted = new Set();   // армии, уже завершившие свой ход
    this._armies = [];         // армии текущего игрока
    this._planning = false;    // все армии сходили — можно менять маршруты

    this.deps = null;          // { world, routeView, mover, requestFinish, log, ... }
    this._ui = null;           // { panel, title, sub, btnGo, btnSkip }

    this._onClickGo = null;
    this._onClickSkip = null;
    this._onKey = null;
  }

  get isActive()  { return this.active; }
  get isMoving()  { return this._moving; }
  get isInBattle(){ return this._inBattle; }
  get isPlanning(){ return this._planning; }

  /* =========================================================
     Подключение / отключение к игровому экрану
     ========================================================= */

  /**
   * @param {Object} deps
   * @param {Object}   deps.world         — WorldMap
   * @param {Object}   deps.routeView     — RouteView
   * @param {Object}   deps.mover         — ArmyMover
   * @param {Function} [deps.log]         — (msg) запись в лог игры
   * @param {Function} [deps.requestFinish] — () => void: завершить ход игрока
   * @param {Object}   [deps.ui]          — ссылки на DOM-контролы
   */
  attach(deps = {}) {
    this.detach();
    this.deps = deps;
    this._ui = deps.ui ?? null;
    this._bindUI();
  }

  detach() {
    this._endTurn();
    this._unbindUI();
    this.deps = null;
    this._ui = null;
  }

  /* =========================================================
     Ход игрока-человека
     ========================================================= */

  /**
   * Начать ход человека. Очки движения сброшены в Player.doStep(),
   * а сохранённые маршруты армий остаются — армии пройдут по ним
   * автоматически, затем управление получает игрок.
   * @param {object} player
   */
  begin(player) {
    this._endTurn(); // на всякий случай — не тащим состояние прошлого хода

    this.active = true;
    this.player = player ?? null;
    this.selected = null;
    this._moving = false;
    this._inBattle = false;
    this._autoArmy = null;
    this._acted.clear();
    this._armies = (player?.army ?? []).filter(a => a && a.alive);

    this._refreshUI();
    this.deps?.refreshHud?.();

    if (!this._armies.length) {
      this._log(`Ход человека: у ${player?.name ?? 'игрока'} нет армий — ход пропущен.`);
      this._finish();
      return;
    }

    // Армии обрабатываются по порядку: если у армии сохранён маршрут —
    // она идёт по нему автоматически, иначе управление получает игрок.
    this._advance();
  }

  /** Завершить ход человека (вызывается из Game при передаче хода). */
  endTurn() {
    if (!this.active) return false;
    this._endTurn();
    return true;
  }

  /**
   * Игрок нажал «Завершить ход» в HUD (фаза планирования).
   * Завершает ход и передаёт управление следующему игроку.
   */
  finishTurn() {
    if (!this.active || !this._planning) return false;
    this._finish();
    return true;
  }

  /* =========================================================
     Ввод
     ========================================================= */

  /**
   * Клик по клетке карты.
   * @returns {boolean} true — клик обработан (карта больше ничего не делает)
   */
  handleTileClick(tile) {
    if (!this.active || !tile) return false;
    if (this._moving || this._inBattle) return true; // во время анимации/боя ждём

    const own = this._findOwnArmyAt(tile);

    // Клик по своей армии — выбрать её (чужие армии не выбираются).
    // В фазе планирования можно выбрать и уже сходившую армию,
    // чтобы перестроить её маршрут на следующий круг.
    if (own) {
      if (own !== this.selected && (this._planning || !this._acted.has(own))) {
        this._select(own);
      }
      return true;
    }

    if (!this.selected) return false;

    const world = this.deps?.world ?? STATE.world;
    if (!world) return false;

    // Клик по клетке, где армия уже стоит → снять маршрут.
    if (tile.x === this.selected.x && tile.y === this.selected.y) {
      this._setRoute(this.selected, [], null);
      this._log(`Армия #${this.selected.id}: маршрут очищен.`);
      return true;
    }

    const route = AiBrainHelper.buildRoute(world, this.selected, tile);
    const goal  = route?.length ? tile : null;

    this._setRoute(this.selected, route ?? [], goal);

    if (!route?.length) {
      this._log(`Армия #${this.selected.id}: маршрут до ` +
                `(${tile.x}, ${tile.y}) недоступен.`);
    }
    return true;
  }

  /** «Идти по маршруту» — отправить выбранную армию в путь. */
  go() {
    if (!this.active || this._moving || this._inBattle || this._planning || !this.selected) return false;

    const army = this.selected;
    if (!army.alive) { this._complete(army); return false; }

    if (!army.route?.length) {
      this._log(`Армия #${army.id}: маршрут не задан.`);
      return false;
    }

    this._moving = true;
    this._refreshUI();

    // Армии идут по одной: после прибытия onArmyArrive/onQueueEmpty
    // завершит ход этой армии и выберет следующую.
    this.deps?.mover?.enqueue?.([army]);
    this._log(`Армия #${army.id} выступила: маршрут ${army.route.length} кл.`);
    return true;
  }

  /** Пропустить выбранную армию (маршрут сбрасывается). */
  skip() {
    if (!this.active || this._moving || this._inBattle || this._planning || !this.selected) return false;

    const army = this.selected;
    this._setRoute(army, [], null);
    this._log(`Армия #${army.id}: ход пропущен.`);
    this._complete(army);
    return true;
  }

  /* =========================================================
     Сигналы от ArmyMover / Game
     ========================================================= */

  /** Армия закончила движение. */
  onArmyArrive(army) {
    if (!this.active || this._inBattle) return;

    // Автоматический проход по сохранённому маршруту завершён.
    if (this._autoArmy === army) {
      this._finishAutoArmy(army);
      return;
    }

    if (!this._moving || army !== this.selected) return;

    this._moving = false;
    this._complete(army);
  }

  /**
   * Очередь аниматора опустела.
   * @returns {boolean} true — сигнал «съеден» ходом человека,
   *                    false — можно передавать ход следующему игроку.
   */
  onQueueEmpty() {
    if (!this.active) return false;
    if (this._inBattle) return true;         // ждём окончания боя

    if (this._moving && this.selected) {     // страховка, если onArmyArrive не пришёл
      if (this._autoArmy === this.selected) this._finishAutoArmy(this.selected);
      else {
        this._moving = false;
        this._complete(this.selected);
      }
    }
    return true;
  }

  /** Начался бой с участием армии текущего хода. */
  onBattleStart(army) {
    if (!this.active) return;
    this._inBattle = true;
    this._moving = false;
    this._autoArmy = null;
    this._refreshUI();
  }

  /** Бой завершён. Армия текущего хода своё действие закончила. */
  onBattleEnd(winner, loser) {
    if (!this.active) return;
    const wasBattle = this._inBattle;
    this._inBattle = false;
    this._autoArmy = null;

    if (!wasBattle) { this._refreshUI(); return; }

    const army = this.selected;
    if (army) this._complete(army);
    else this._advance();
  }

  /* =========================================================
     Внутреннее
     ========================================================= */

  /** Завершить действие армии и передать управление следующей. */
  _complete(army) {
    if (army) this._acted.add(army);
    this._moving = false;
    this._inBattle = false;
    this._autoArmy = null;
    this._advance();
  }

  /**
   * Перейти к следующей армии, которая ещё не ходила.
   * Если у армии сохранён маршрут — она идёт по нему автоматически.
   * Иначе управление получает игрок (меню «Идти по маршруту»).
   */
  _advance() {
    const next = this._armies.find(a => a?.alive && !this._acted.has(a));
    if (!next) {
      // Живых армий не осталось — ход завершается сам.
      if (!this._armies.some(a => a?.alive)) { this._finish(); return; }
      this._enterPlanning();
      return;
    }

    this._planning = false;
    this._select(next);

    if (this._canAutoMove(next)) {
      this._startAutoMove(next);
    } else {
      this._autoArmy = null;
      this._moving = false;
      this._log(`Армия #${next.id}: кликните по карте, чтобы задать маршрут.`);
    }
  }

  /**
   * Все армии сделали ход. Не завершаем ход сразу: игрок может
   * ПЕРЕСТРОИТЬ маршруты любой своей армии на следующий круг,
   * после чего нажимает «Завершить ход» в HUD.
   */
  _enterPlanning() {
    this._planning = true;
    this._moving = false;
    this._inBattle = false;
    this._autoArmy = null;
    this.selected = null;
    this.deps?.routeView?.setArmyFilter?.(null);
    this._refreshUI();
    this.deps?.refreshHud?.();
    this._log('Все армии сделали ход. Можно изменить маршруты и завершить ход.', true);
  }

  /** Есть ли сохранённый маршрут и очки хода, чтобы по нему идти. */
  _canAutoMove(army) {
    return !!army?.route?.length && army.movePoints > 0;
  }

  /** Автоматический проход армии по сохранённому маршруту. */
  _startAutoMove(army) {
    this._autoArmy = army;
    this._moving = true;
    this._refreshUI();
    this._log(`Армия #${army.id}: автоматический ход по маршруту ` +
              `(${army.route.length} кл.).`);
    this.deps?.mover?.enqueue?.([army]);
  }

  /**
   * Автопроход завершён. Если у армии остались очки хода — показываем
   * меню «Идти по маршруту», где игрок может задать/перестроить маршрут.
   * Если ходов не осталось — передаём управление следующей армии.
   */
  _finishAutoArmy(army) {
    this._autoArmy = null;
    this._moving = false;

    if (army?.alive && army.movePoints > 0) {
      this._select(army);
      this._log(`Армия #${army.id}: автопроход завершён, осталось ` +
                `${army.movePoints} оч. хода — можно задать новый маршрут.`);
      this._refreshUI();
      return;
    }

    if (army) this._complete(army);
    else this._advance();
  }

  _select(army) {
    this.selected = army;

    // Показываем маркеры маршрута только выбранной армии
    // («маршрут армии помечается маркером, пока выбрана данная армия»).
    this.deps?.routeView?.setArmyFilter?.(army);

    // Клетка армии в фокусе выбирается автоматически:
    // кольцо выбора + плавный перелёт камеры + панель «Выбрано».
    this.deps?.focusArmy?.(army);

    this._refreshUI();
  }

  _setRoute(army, route, goal) {
    army.route = Array.isArray(route) ? route : [];
    army.cellGoal = goal ?? null;
    this.deps?.routeView?.updateArmy?.(army);
    this._refreshUI();
  }

  _findOwnArmyAt(tile) {
    if (!this.player || !Array.isArray(tile.army)) return null;
    return tile.army.find(a =>
      a && a.idOwner === this.player.index && a.alive !== false
    ) ?? null;
  }

  _finish() {
    if (!this.active) return;
    const finish = this.deps?.requestFinish;
    this._endTurn();
    finish?.();
  }

  /** Сброс внутреннего состояния без вызова requestFinish. */
  _endTurn() {
    const wasActive = this.active;
    this.active = false;
    this.player = null;
    this.selected = null;
    this._moving = false;
    this._inBattle = false;
    this._autoArmy = null;
    this._planning = false;
    this._acted.clear();
    this._armies = [];

    this.deps?.routeView?.setArmyFilter?.(null);
    this._refreshUI();
    this.deps?.refreshHud?.();
    return wasActive;
  }

  _log(msg, hl = false) {
    this.deps?.log?.(msg, hl);
  }

  /* =========================================================
     UI
     ========================================================= */

  _bindUI() {
    const ui = this._ui;
    if (!ui) return;

    this._onClickGo   = () => this.go();
    this._onClickSkip = () => this.skip();

    ui.btnGo?.addEventListener('click', this._onClickGo);
    ui.btnSkip?.addEventListener('click', this._onClickSkip);

    // Клавиатура: Enter — идти по маршруту, Esc — снять маршрут.
    this._onKey = (e) => {
      if (!this.active) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        this.go();
      } else if (e.code === 'Escape' && this.selected?.route?.length) {
        this._setRoute(this.selected, [], null);
        this._log(`Армия #${this.selected.id}: маршрут очищен.`);
      }
    };
    window.addEventListener('keydown', this._onKey);
  }

  _unbindUI() {
    const ui = this._ui;
    if (ui) {
      if (this._onClickGo)   ui.btnGo?.removeEventListener('click', this._onClickGo);
      if (this._onClickSkip) ui.btnSkip?.removeEventListener('click', this._onClickSkip);
      if (ui.panel) ui.panel.style.display = 'none';
    }
    if (this._onKey) window.removeEventListener('keydown', this._onKey);
    this._onClickGo = null;
    this._onClickSkip = null;
    this._onKey = null;
  }

  _refreshUI() {
    const ui = this._ui;
    if (!ui) return;

    if (ui.panel) ui.panel.style.display = this.active ? '' : 'none';
    if (!this.active) return;

    const a = this.selected;

    if (ui.title) {
      ui.title.textContent = this._planning
        ? 'Планирование маршрутов'
        : (a ? `Армия #${a.id} · (${a.x}, ${a.y})` : 'Выберите армию');
    }

    if (ui.sub) {
      if (this._inBattle) {
        ui.sub.textContent = 'Идёт бой…';
      } else if (this._planning) {
        if (a) {
          const steps = a.route?.length ?? 0;
          const goal  = a.cellGoal ? `(${a.cellGoal.x}, ${a.cellGoal.y})` : '—';
          ui.sub.textContent =
            `Армия #${a.id}: маршрут ${steps} кл. · цель ${goal}. ` +
            `Задайте новый маршрут на следующий круг.`;
        } else {
          ui.sub.textContent = 'Все армии сходили — выберите армию и перестройте маршрут.';
        }
      } else if (!a) {
        ui.sub.textContent = 'Нет доступных армий';
      } else {
        const mv    = a.movePoints;
        const steps = a.route?.length ?? 0;
        const goal  = a.cellGoal ? `(${a.cellGoal.x}, ${a.cellGoal.y})` : '—';
        ui.sub.textContent =
          `Очки хода: ${mv} · Маршрут: ${steps} кл. · Цель: ${goal}`;
      }
    }

    if (ui.btnGo) {
      const canGo = !!a && !this._moving && !this._inBattle && !this._planning &&
                    (a.route?.length > 0);
      ui.btnGo.disabled = !canGo;
      ui.btnGo.textContent = this._moving ? 'Идёт…' : 'Идти по маршруту';
    }

    if (ui.btnSkip) {
      ui.btnSkip.disabled = !a || this._moving || this._inBattle || this._planning;
    }
  }
}
