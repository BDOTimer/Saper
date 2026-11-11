/// core/g-move.js
///
/// Описание:
///  - Плавная визуализация передвижения армий по маршрутам.
///  - Использует ТОЛЬКО существующие сущности:
///      · army.route (Cell[]) / army.cellGoal — кеш маршрута,
///        строится в Player.doStep() через AiBrainHelper.find/buildRoute;
///      · Army.canMoveTo / Army.spendMoveAll  — очки движения стека;
///      · WorldMap.moveArmy                   — модельный перенос армии
///        между клетками (обновляет cell.army и army.x/y);
///      · RouteView.consumeSteps              — снять красные маркеры
///        пройденных клеток;
///      · UnitsView.placeArmyAt/updateArmyPosition — меш армии на карте.
///  - Армии ходят ПО ОЧЕРЕДИ: после завершения хода одной армии
///    в движение вступает следующая (порядок очереди = порядок addArmy).
///  - Армия идёт по маршруту, пока хватает очков движения (movePoints).
///    Когда очки кончились или маршрут исчерпан — армия остановилась,
///    и очередь передаётся следующей.

///----------------------------------------------------------------------------|
/// ArmyMover — аниматор передвижения армий.
///----------------------------------------------------------------------------:
export class ArmyMover {
  /**
   * @param {Object} [opts]
    * @param {number}  [opts.speed=2.6]       — клеток в секунду
   * @param {Function} [opts.onArmyStart]    — (army, cellsPlanned)
   * @param {Function} [opts.onArmyStep]     — (army) — модельный шаг сделан
   * @param {Function} [opts.onArmyArrive]   — (army, stepsDone)
   * @param {Function} [opts.onBattleRequest]— (army, enemies) — встречен враг;
   *   движение останавливается до конца битвы
    * @param {Function} [opts.onFriendlyRequest] — (army, friendly) — на следующей
    *   клетке стоит своя армия (не город); движение останавливается до
    *   закрытия панели обмена (mover.pauseForEncounter / resumeFromEncounter)
    * @param {Function} [opts.onRuinsVisit]   — (army, city) — армия вошла
    *   в клетку с руинами (пробуждение монстров — в core/ruins.js)
    * @param {Function} [opts.onQueueEmpty]   — все армии очереди закончили ход
    */
  constructor(opts = {}) {
    this.speed = opts.speed ?? 2.6;

    this.onArmyStart  = opts.onArmyStart  ?? (() => {});
    this.onArmyStep   = opts.onArmyStep   ?? (() => {});
    this.onArmyArrive = opts.onArmyArrive ?? (() => {});
    this.onBattleRequest = opts.onBattleRequest ?? (() => {});
    this.onFriendlyRequest = opts.onFriendlyRequest ?? (() => {});
    this.onRuinsVisit = opts.onRuinsVisit ?? (() => {});
    this.onQueueEmpty = opts.onQueueEmpty ?? (() => {});

    /** @type {Array<Army>} — ожидающие хода (порядок сохранён) */
    this.queue  = [];
    /** Текущий сегмент движения: { army, cell, from, to, k, dur, steps } */
    this.active = null;

    /** Пауза на время модальной панели обмена юнитами. */
    this.paused = false;
    this._encounterArmy = null;
    this._encounterSteps = 0;

    this._done = true;   // «пустое» событие onQueueEmpty уже отправлено
  }

  /** Двигается ли сейчас хоть одна армия / есть ли очередь. */
  get busy() { return this.paused || !!this.active || this.queue.length > 0; }

  /**
   * Поставить армии в очередь хода (порядок сохраняется).
   * @param {Army|Army[]} armies
   */
  enqueue(armies) {
    const list = Array.isArray(armies) ? armies : [armies];
    for (const a of list) if (a) this.queue.push(a);
    this._done = false;
  }

  /** Полная очистка (выход с экрана, смена хода принудительно). */
  clear() {
    this.queue.length = 0;
    this.active = null;
    this.paused = false;
    this._encounterArmy = null;
    this._encounterSteps = 0;
    this._done = true;
  }

  /**
   * Поставить движение на паузу до закрытия панели обмена.
   * Вызывается из onFriendlyRequest, если панель действительно открыта.
   * @param {Army} army — армия, остановленная перед своей армией
   */
  pauseForEncounter(army) {
    this.paused = true;
    this._encounterArmy = army ?? null;
    return true;
  }

  /**
   * Снять паузу и завершить ход остановленной армии.
   * Вызывается после закрытия панели обмена.
   * @returns {boolean}
   */
  resumeFromEncounter() {
    if (!this.paused) return false;
    const army = this._encounterArmy;
    const steps = this._encounterSteps;
    this.paused = false;
    this._encounterArmy = null;
    this._encounterSteps = 0;
    if (army) this.onArmyArrive(army, steps);
    return true;
  }

  /**
   * Кадровое обновление (зовёт Game.update каждый кадр).
   * @param {number} dt  — мс с прошлого кадра
   * @param {Object} ctx — { world, mapView, routeView, unitsView }
   */
  update(dt, ctx) {
    if (this.paused) return;
    if (!this.active && this.queue.length) this._startNext(ctx);

    if (this.active) {
      this._stepActive(dt, ctx);
      return;
    }

    if (!this._done) {
      this._done = true;
      this.onQueueEmpty();
    }
  }

  /* =========================================================
     Внутреннее
     ========================================================= */

  /** Взять следующую армию из очереди. */
  _startNext(ctx) {
    while (this.queue.length && !this.active && !this.paused) {
      const army = this.queue.shift();
      if (!army) continue;

      // мёртвая армия или без маршрута — ход «мгновенно завершён»
      if (!army.alive || !army.route?.length) {
        this.onArmyArrive(army, 0);
        continue;
      }

      const next = army.route[0];
      const cost = next?.staminaCost ?? 1;

      // очков движения не хватает даже на первую клетку.
      // Маршрут НЕ сбрасываем — армия продолжит его в следующем круге.
      if (!next || !army.canMoveTo(cost)) {
        this.onArmyArrive(army, 0);
        continue;
      }

      // На следующей клетке стоит своя армия, и это не город:
      // дальше не идём, открываем панель обмена (армия остаётся на месте).
      const friendly = this._friendlyArmyAt(next, army);
      if (friendly && !this._isCityCell(ctx.world, next)) {
        this._stopForFriendly(army, friendly, ctx, 0);
        if (this.paused) return;
        continue;
      }

      this._beginSegment(army, next, ctx);
      this.onArmyStart(army, army.route.length);
    }
  }

  /**
   * Остановить армию перед своей армией и запустить панель обмена.
   * Если панель не открылась (ИИ/ошибка), сразу завершаем ход армии.
   * @returns {boolean} всегда true — движение этой армии остановлено
   */
  _stopForFriendly(army, friendly, ctx, steps) {
    ctx.routeView?.consumeSteps?.(army, Infinity);
    army.route = [];
    army.cellGoal = null;

    this._encounterSteps = steps;
    this.onFriendlyRequest(army, friendly);

    if (!this.paused) this.onArmyArrive(army, steps);
    return true;
  }

  /** Начать анимацию одного сегмента (перемащение на одну клетку). */
  _beginSegment(army, cell, ctx, steps = 0) {
    this.active = {
      army,
      cell,
      steps,
      from: this._nodePos(ctx, army) ?? this._cellPos(ctx, army.x, army.y),
      to:   this._cellPos(ctx, cell.x, cell.y),
      k: 0,
      dur: Math.max(80, 1000 / this.speed),   // мс на одну клетку
    };
  }

  /** Продвижение текущего сегмента. */
  _stepActive(dt, ctx) {
    const a = this.active;

    a.k = Math.min(1, a.k + dt / a.dur);
    const e = easeInOut(a.k);

    // плавная интерполяция позиции меша армии между клетками
    const x = a.from.x + (a.to.x - a.from.x) * e;
    const y = a.from.y + (a.to.y - a.from.y) * e;
    const z = a.from.z + (a.to.z - a.from.z) * e;
    ctx.unitsView.placeArmyAt(a.army, x, y, z);

    if (a.k < 1) return;

    // ── сегмент завершён → модельный шаг ──────────────────
    const army = a.army;
    const cost = a.cell.staminaCost ?? 1;
    this.active = null;
    let done = a.steps + 1;                // шагов сделано с учётом этого

    if (army.canMoveTo(cost)) {
      army.spendMoveAll(cost);                       // тратим очки стека
      const fromX = army.x, fromY = army.y;          // откуда уходит армия
      ctx.world.moveArmy(army, a.cell.x, a.cell.y);  // перенос в модели
      ctx.routeView.consumeSteps(army, 1);           // снять красный маркер

      //------------------------------------|
      // Проверяем что или кто на клетке.   |
      // Нейтральный город захватываем.     |
      //------------------------------------:
      const cell = ctx.world.get(army.x, army.y);
      const captured = cell.onArmyArrive(army);

      // Город захвачен → поднять флаг цвета игрока-победителя.
      if (captured) {
        const city = ctx.world.getCityAt(army.x, army.y);
        if (city) {
          ctx.mapView.setCityOwner(city, army.idOwner, { raised: true });
        }
      }

      ctx.unitsView.updateArmyPosition(army);        // точная посадка в клетку
      // Переставляем армии по углам: из старой клетки армия ушла,
      // в новой — могла занять следующий свободный угол.
      ctx.unitsView.relayoutCell?.(fromX, fromY);
      ctx.unitsView.relayoutCell?.(army.x, army.y);
      this.onArmyStep(army);

      // ── встреча с врагом: бой (и город-гарнизон, и пустая клетка) ──
      // `onArmyArrive` выше уже не позволил захватить город с гарнизоном
      // (_reserveBattle). Здесь единая точка запуска битвы: очередь
      // оставшихся армий и остаток хода ждут результата (onBattleRequest).
      const enemies = this._enemyArmiesAt(cell, army);
      if (enemies.length) {
        ctx.routeView.consumeSteps(army, Infinity);  // снять остаток маркеров
        army.route     = [];                         // маршрут обрывается на клетке боя
        army.cellGoal  = null;
        this.onBattleRequest(army, enemies);         // бой запускает Game
        return;
      }

      // ── руины: посещение (не чаще раза в 10 полных кругов) ──
      // Генерацию монстров выполняет Game через core/ruins.js:
      // аниматор лишь сообщает, что армия вошла в клетку с руинами.
      const ruinsCity = ctx.world.getCityAt?.(army.x, army.y) ?? null;
      if (ruinsCity?.type === 'ruins') {
        this.onRuinsVisit(army, ruinsCity);
      }
    } else {
      done--;                                        // шаг не состоялся
    }

    // ── продолжать маршрут той же армией? ─────────────────
    const next = army.route?.[0];
    if (next && army.canMoveTo(next.staminaCost ?? 1)) {
      const friendly = this._friendlyArmyAt(next, army);
      if (friendly && !this._isCityCell(ctx.world, next)) {
        this._stopForFriendly(army, friendly, ctx, done);
        return;
      }
      this._beginSegment(army, next, ctx, done);
      return;
    }

    // очки кончились — армия остановилась, но маршрут СОХРАНЯЕТСЯ,
    // чтобы она продолжила его в следующем круге.
    this.onArmyArrive(army, done);
  }

  /* ---------- координаты ---------- */

  /**
   * Вражеские армии, стоящие в клетке cell (с живыми юнитами).
   * @param {Cell} cell — клетка, куда шагнула армия
   * @param {Army} army — эта армия (исключаем из проверки)
   * @returns {Army[]}
   */
  _enemyArmiesAt(cell, army) {
    if (!cell?.army?.length) return [];
    return cell.army.filter(a =>
      a && a !== army &&
      a.idOwner !== army.idOwner &&
      a.alive !== false &&
      Array.isArray(a.units) &&
      a.units.some(u => u && u.alive !== false)
    );
  }

  /**
   * Своя армия, стоящая в клетке cell (с живыми юнитами).
   * @param {Cell} cell — следующая клетка маршрута
   * @param {Army} army — идущая армия (исключаем из проверки)
   * @returns {Army|null}
   */
  _friendlyArmyAt(cell, army) {
    if (!cell?.army?.length) return null;
    return cell.army.find(a =>
      a && a !== army &&
      a.idOwner === army.idOwner &&
      a.alive !== false &&
      Array.isArray(a.units) &&
      a.units.some(u => u && u.alive !== false)
    ) ?? null;
  }

  /** Городская ли клетка (в городе несколько армий могут стоять вместе). */
  _isCityCell(world, cell) {
    if (!cell) return false;
    if ((cell.city ?? -1) >= 0) return true;
    return !!world?.getCityAt?.(cell.x, cell.y);
  }

  /** Мировая позиция клетки на сцене (верх плитки). */
  _cellPos(ctx, x, y) {
    const mv = ctx.mapView;
    const cell = ctx.world.get(x, y);
    return {
      x: mv._worldX(x),
      // _worldY — центр плитки (высота 0.3); армия идёт по её верхней грани.
      y: cell ? mv._worldY(cell) + 0.15 : 0.15,
      z: mv._worldZ(y),
    };
  }

  /** Текущая позиция узла армии на сцене (для старта из любой точки). */
  _nodePos(ctx, army) {
    const node = ctx.unitsView.getArmyNode?.(army);
    if (!node) return null;
    const p = node.root.position;
    return { x: p.x, y: p.y, z: p.z };
  }
}

/* плавность: разгон — торможение */
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
