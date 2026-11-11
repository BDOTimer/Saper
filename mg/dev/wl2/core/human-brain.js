// human-brain.js
//
// Ход человека в новом режиме:
//  - в начале круга армии человека САМИ проходят по сохранённым маршрутам;
//  - после завершения круга (зелёная кнопка) игрок планирует маршруты
//    на следующий круг: клик по своей армии — фокус и панель
//    «ПЛАНИРОВАНИЕ МАРШРУТА», клик по клетке — новая цель;
//  - Ctrl / кнопка «Армия» — просмотр состава, Shift / кнопка «Город» —
//    просмотр города (обрабатывает Game);
//  - чужие армии и города для планирования недоступны.
//
// HumanBrain НЕ импортирует Three.js и не трогает сцену напрямую —
// только routeView/unitsView через переданные зависимости.

import { AiBrainHelper } from './ai-brain.js';
import { STATE } from './g-state.js';

export class HumanBrain {
  static get() {
    return HumanBrain._instance ?? (HumanBrain._instance = new HumanBrain());
  }

  static reset() {
    const inst = HumanBrain._instance;
    if (inst) inst.detach();
    HumanBrain._instance = null;
  }

  constructor() {
    this.active = false;
    this.player = null;
    this.selected = null;

    this._moving = false;
    this._inBattle = false;
    this._inEncounter = false;
    this._planning = false;
    this._armies = [];

    this.deps = null;
    this._ui = null;

    this._onClickClear = null;
    this._onClickDeselect = null;
  }

  get isActive() { return this.active; }
  get isMoving() { return this._moving; }
  get isInBattle() { return this._inBattle; }
  get isInEncounter() { return this._inEncounter; }
  get isPlanning() { return this._planning; }

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

  /* ---------------- ход и планирование ---------------- */

  begin(player) {
    this._reset();
    this.active = true;
    this.player = player ?? null;
    this._armies = (player?.army ?? []).filter(a => a?.alive);

    const movable = this._armies.filter(
      a => a?.alive && a.route?.length && a.movePoints > 0);

    if (!this._armies.length) {
      this._log(`Ход человека: у ${player?.name ?? 'игрока'} нет армий — ход пропущен.`);
      this._refreshUI();
      this._finish();
      return;
    }

    if (!movable.length) {
      this._refreshUI();
      this._log('Армии человека: маршруты не заданы — ход завершён.');
      this._finish();
      return;
    }

    this._moving = true;
    this._refreshUI();
    this.deps?.refreshHud?.();
    this._log(`Армии человека выступают по маршрутам: ${movable.length}.`, true);
    this.deps?.mover?.enqueue?.(movable);
  }

  beginPlanning(player) {
    this._reset();
    this.active = true;
    this._planning = true;
    this.player = player ?? null;
    this._armies = (player?.army ?? []).filter(a => a?.alive);

    this._refreshUI();
    this.deps?.refreshHud?.();
    this._log(
      'ПЛАНИРОВАНИЕ МАРШРУТА: клик по своей армии и клетке назначения. ' +
      'Ctrl — просмотр армии, Shift — просмотр города.', true);
  }

  endPlanning() {
    if (!this._planning) return false;
    this._endTurn();
    return true;
  }

  endTurn() {
    if (!this.active) return false;
    this._endTurn();
    return true;
  }

  finishTurn() {
    return false;
  }

  /* ---------------- ввод ---------------- */

  handleTileClick(tile) {
    if (!this.active || !tile) return false;
    if (!this._planning) return true;
    if (this._inBattle || this._inEncounter) return true;

    const own = this._findOwnArmyAt(tile);
    if (own) {
      if (this.selected !== own) this._select(own);
      return true;
    }

    if (!this.selected) return false;
    if (!this.selected.alive) {
      this.clearSelection();
      return false;
    }

    if (tile.x === this.selected.x && tile.y === this.selected.y) {
      this._log(`Армия #${this.selected.id}: выберите другую клетку назначения.`);
      return true;
    }

    const world = this.deps?.world ?? STATE.world;
    if (!world) return false;

    const route = AiBrainHelper.buildRoute(world, this.selected, tile);
    if (!route?.length) {
      this._log(`Армия #${this.selected.id}: маршрут до ` +
                `(${tile.x}, ${tile.y}) недоступен.`);
      return true;
    }

    this._setRoute(this.selected, route, tile);
    this._log(`Армия #${this.selected.id}: маршрут на круг ` +
              `${route.length} кл. → (${tile.x}, ${tile.y}).`);
    return true;
  }

  go() {
    return false;
  }

  skip() {
    return false;
  }

  clearRoute() {
    if (!this._planning || !this.selected) return false;

    const army = this.selected;
    if (!army.route?.length) return false;

    this._setRoute(army, [], null);
    this._log(`Армия #${army.id}: маршрут очищен.`);
    return true;
  }

  clearSelection() {
    if (!this.selected) return false;

    this.selected = null;
    this.deps?.routeView?.setArmyFilter?.(null);
    this.deps?.unitsView?.setSelected?.(null);
    this._refreshUI();
    this.deps?.refreshHud?.();
    return true;
  }

  /* ---------------- сигналы ArmyMover / Game ---------------- */

  onArmyArrive(army) {
    if (!this.active || this._inBattle) return;
    if (this._inEncounter) this._inEncounter = false;
    this._refreshUI();
  }

  onQueueEmpty() {
    if (!this.active) return false;
    if (this._inBattle || this._inEncounter) return true;
    if (this._planning) return true;

    this._moving = false;
    this._finish();
    return true;
  }

  onBattleStart(army) {
    if (!this.active || this._planning) return;
    this._inBattle = true;
    this.deps?.mover?.pauseForEncounter?.(army);
    this._refreshUI();
  }

  onEncounterStart(army) {
    if (!this.active || this._planning) return false;
    this._inEncounter = true;
    if (army) this.selected = army;
    this._refreshUI();
    return true;
  }

  onBattleEnd() {
    if (!this.active) return;

    const wasBattle = this._inBattle;
    this._inBattle = false;
    this._inEncounter = false;

    if (!wasBattle) {
      this._refreshUI();
      return;
    }

    const mover = this.deps?.mover;
    if (mover?.paused) mover.resumeFromEncounter();

    // Очередь могла опустеть во время боя — даём mover'у штатно
    // сообщить onQueueEmpty на следующем кадре (без двойного финиша).
    if (mover && !mover.busy) mover.enqueue?.([]);

    this._refreshUI();
  }

  /* ---------------- внутреннее ---------------- */

  _reset() {
    this.active = false;
    this.player = null;
    this.selected = null;
    this._moving = false;
    this._inBattle = false;
    this._inEncounter = false;
    this._planning = false;
    this._armies = [];

    this.deps?.routeView?.setArmyFilter?.(null);
    this.deps?.unitsView?.setSelected?.(null);
  }

  _endTurn() {
    this._reset();
    this._refreshUI();
    this.deps?.refreshHud?.();
  }

  _finish() {
    if (!this.active) return;
    const finish = this.deps?.requestFinish;
    this._endTurn();
    finish?.();
  }

  _select(army) {
    this.selected = army;
    this.deps?.routeView?.setArmyFilter?.(army);
    this.deps?.focusArmy?.(army);
    this._refreshUI();
    this.deps?.refreshHud?.();
  }

  _setRoute(army, route, goal) {
    army.route = Array.isArray(route) ? route : [];
    army.cellGoal = goal ?? null;
    this.deps?.routeView?.updateArmy?.(army);
    this._refreshUI();
    this.deps?.refreshHud?.();
  }

  _findOwnArmyAt(tile) {
    if (!this.player || !Array.isArray(tile.army)) return null;
    return tile.army.find(a =>
      a && a.idOwner === this.player.index && a.alive !== false
    ) ?? null;
  }

  _log(msg, hl = false) {
    this.deps?.log?.(msg, hl);
  }

  /* ---------------- UI ---------------- */

  _bindUI() {
    const ui = this._ui;
    if (!ui) return;

    this._onClickClear = () => this.clearRoute();
    this._onClickDeselect = () => {
      if (this.deps?.clearFocus) this.deps.clearFocus();
      else this.clearSelection();
    };

    ui.btnClearRoute?.addEventListener('click', this._onClickClear);
    ui.btnDeselect?.addEventListener('click', this._onClickDeselect);
  }

  _unbindUI() {
    const ui = this._ui;
    if (ui) {
      if (this._onClickClear) {
        ui.btnClearRoute?.removeEventListener('click', this._onClickClear);
      }
      if (this._onClickDeselect) {
        ui.btnDeselect?.removeEventListener('click', this._onClickDeselect);
      }
      if (ui.panel) ui.panel.style.display = 'none';
    }
    this._onClickClear = null;
    this._onClickDeselect = null;
  }

  _refreshUI() {
    const ui = this._ui;
    if (!ui) return;

    if (ui.panel) ui.panel.style.display = this.active ? '' : 'none';
    if (!this.active) return;

    const a = this.selected;

    if (ui.title) {
      ui.title.textContent = this._planning
        ? 'ПЛАНИРОВАНИЕ МАРШРУТА'
        : this._inBattle
          ? 'Идёт бой'
          : this._inEncounter
            ? 'Обмен юнитами'
            : 'Армии идут по маршрутам';
    }

    if (ui.sub) {
      if (this._inEncounter) {
        ui.sub.textContent = 'Идёт обмен юнитами…';
      } else if (this._inBattle) {
        ui.sub.textContent = 'Идёт бой…';
      } else if (this._planning) {
        if (a) {
          const steps = a.route?.length ?? 0;
          const goal = a.cellGoal
            ? `(${a.cellGoal.x}, ${a.cellGoal.y})`
            : '—';
          ui.sub.textContent =
            `Армия #${a.id} · маршрут ${steps} кл. · цель ${goal} · ` +
            `очки хода ${a.movePoints}. Клик по клетке задаёт маршрут ` +
            `на следующий круг. Ctrl — армия, Shift — город.`;
        } else if (!this._armies.length) {
          ui.sub.textContent = 'Армий на карте нет — планировать нечего.';
        } else {
          ui.sub.textContent =
            'Кликните по своей армии, затем по клетке назначения. ' +
            'Маршрут выполнится в начале следующего круга.';
        }
      } else if (this._moving) {
        ui.sub.textContent = 'Армии проходят свои маршруты автоматически.';
      } else if (!this._armies.length) {
        ui.sub.textContent = 'Нет доступных армий';
      } else {
        ui.sub.textContent = `Армий: ${this._armies.length}`;
      }
    }

    if (ui.btnClearRoute) {
      ui.btnClearRoute.disabled =
        !this._planning || !a || !(a.route?.length > 0);
    }

    if (ui.btnDeselect) {
      ui.btnDeselect.disabled = !this._planning || !a;
    }
  }
}
