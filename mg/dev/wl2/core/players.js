// ./core/players.js
// class Player;       // класс 1 игрока
// class Players;      // все игроки тут
// class PanelPlayers; // определяем состав игроков тут
// class Judge;        // правила, которые применяются к игровым объектам
// class Game;         // --> экземляр игры

import { SND } from '../res/snd/--sound-lib.js';

import { STATE         } from './g-state.js';
import { AiBrainHelper } from './ai-brain.js';

// Текущая задача:
//  - сделать Панель(оверлей) PanelPlayers в которой определить
//      - играет этот игрок или нет?
//      - икрок это Человек или Компьюте?
//      - для игрока "Компьютер" определить степень разумности:
//          - Король
//          - Рыцарь
//          - Джокер
//          - Барон
//          - ...(список будет дополняться)


///----------------------------------------------------------------------------|
/// Игрок.
///----------------------------------------------------------------------------:
/**
 * Степени разумности ИИ.
 * -1 зарезервировано под человека. Индекс в массиве = «уровень».
 */
export const AI_LEVELS = [
  { id: 0, name: 'Барон',  desc: 'Осторожный, копит силы' },
  { id: 1, name: 'Джокер', desc: 'Непредсказуемый, любит риск' },
  { id: 2, name: 'Рыцарь', desc: 'Сбалансированный, по умолчанию' },
  { id: 3, name: 'Король', desc: 'Агрессивный, давит количеством' },
];

/** -1 — человек. Иначе — индекс в AI_LEVELS. */
export const HUMAN = -1;

/* =========================================================
   Player
   ========================================================= */
export class Player {

    #isTurn = false; // Игрок в процессе хода?

  constructor(index, overrides = {}) {
    this.index = index;
    this.active = overrides.active ?? (index < 2);  // первые два по умолчанию в игре
    this.aiLevel = overrides.aiLevel ?? 2;          // по умолчанию «Рыцарь»
    this.color = overrides.color ?? defaultColor(index);
    this.name  = overrides.name ?? `Игрок-${index + 1}: ${AI_LEVELS[this.aiLevel].name}`;

    this.army = [];
    this._armyMap = new Map();
  }

  /**
   * Игрок делает ход, используя AiBrainHelper.
   * Для КАЖДОЙ армии строится маршрут (army.route) до цели.
   */
  doStep()
  {
    const world = STATE.world;
    if (!world)
    {   console.warn('🔍 doStep(): STATE.world не задан — маршрут не построить');
        return;
    }

    for (const army of this.army)
    {
      if (!army?.alive) continue;

      army.resetTurn();   // новые очки движения всем юнитам стека

      const cellGoal = AiBrainHelper.find(world, army);
      if  (!cellGoal) continue;

      const route = AiBrainHelper.buildRoute(world, army, cellGoal);

      if  (!route || route.length === 0) continue;

      army.route = route;
      army.cellGoal = cellGoal;

    //console.log('🔍 RouteView build:', army.id, 'cells=', army.route?.length);
    }

    // TODO: ...
  }

  /**
   * Добавить армию.
   * Гарантирует уникальность по ID и сохраняет порядок.
   */
  addArmy(army) {
    if (!army || typeof army.id === 'undefined') {
      throw new Error('Армия должна иметь уникальный id');
    }

    // Если уже есть — можно либо игнорировать, либо обновить (выбери нужное)
    if (this._armyMap.has(army.id)) {
      // Вариант 1: просто игнорируем дубликат
      return; 
      
      // Вариант 2 (раскомментируй, если нужно заменять):
      // const existingIndex = this.army.findIndex(a => a.id === army.id);
      // if (existingIndex >= 0) this.army[existingIndex] = army;
      // else this.army.push(army);
      // this._armyMap.set(army.id, army);
      // return;
    }

    this.army.push(army);
    this._armyMap.set(army.id, army);
  }

  /**
   * Удалить армию.
   * Работает по ссылке или по ID — удобно, если объект армии изменился.
   */
  delArmy(army) {
    let id;

    if (typeof army === 'object' && typeof army.id !== 'undefined') {
      id = army.id;
    } else if (typeof army === 'string' || typeof army === 'number') {
      id = army;
    } else {
      throw new Error('delArmy ожидает армию или её id');
    }

    const existing = this._armyMap.get(id);
    if (!existing) return; // Армии нет — ничего не делаем

    // Удаляем из массива (сохраняем порядок остальных)
    const index = this.army.indexOf(existing);
    if (index >= 0) {
      this.army.splice(index, 1);
    }

    // Удаляем из карты
    this._armyMap.delete(id);
  }

  /** Убрать все армии игрока (сброс перед новой партией). */
  clearArmies() {
    this.army.length = 0;
    this._armyMap.clear();
    this.isTurn = false;
  }

  set isTurn (b){        this.#isTurn = b; }
  get isTurn () { return this.#isTurn; }
  get isHuman() { return this.aiLevel === HUMAN; }
  get isAI   () { return this.aiLevel !== HUMAN; }
  get aiMeta () { return this.isHuman ? null : AI_LEVELS[this.aiLevel]; }

  /** Публичный снимок для Judge */
  snapshot() {
    return {
      index: this.index,
      name: this.name,
      active: this.active,
      aiLevel: this.aiLevel,
      isHuman: this.isHuman,
      color: this.color,
    };
  }
}

function defaultColor(i) {
  const palette = [
    0x2e8bff, 0xd64545, 0x5bbf6a, 0xf0c040,
    0xa46bff, 0x22b8cf, 0xff8c42, 0xb0b8c0,
  ];
  return palette[i % palette.length];
}

///----------------------------------------------------------------------------|
/// Игроки - контейнер.
///----------------------------------------------------------------------------:
export class Players {
  constructor(count = 8) {
    this.list = Array.from({ length: count }, (_, i) => new Player(i));
  }
  get(i)        { return this.list[i]; }
  active()      { return this.list.filter(p => p.active); }
  setActive(i, v) { if (this.list[i]) this.list[i].active = v; }
  setAILevel(i, lvl) { if (this.list[i]) this.list[i].aiLevel = lvl; }
  setName(i, n) { if (this.list[i]) this.list[i].name = n; }
  get count()   { return this.list.length; }
  get activeCount() { return this.list.filter(p => p.active).length; }

  /** Сбросить армии всех игроков (перед новой партией). */
  resetArmies() {
    for (const p of this.list) p.clearArmies();
  }
}

///----------------------------------------------------------------------------|
/// Панель конфигурирования игроков - UI-оверлей.
///----------------------------------------------------------------------------:
export class PanelPlayers {
  /**
   * @param {Object} [opts]
   * @param {Players} [opts.players]   — модель (по умолчанию новая на 8)
   * @param {HTMLElement} [opts.parent] — куда монтировать
   * @param {Function} [opts.onConfirm] — (players) при нажатии «Готово»
   * @param {Function} [opts.onCancel]  — при отмене/закрытии
   */
  constructor(opts = {}) {
    this.players = opts.players ?? new Players(8);
    this.parent  = opts.parent  ?? document.body;
    this.onConfirm = opts.onConfirm ?? (() => {});
    this.onCancel  = opts.onCancel  ?? (() => {});

    this.el = this._render();
    this.parent.appendChild(this.el);

    this._onKey = (e) => {
      if (e.key === 'Escape') this._cancel();
    };
    document.addEventListener('keydown', this._onKey);

    requestAnimationFrame(() => this.el.classList.add('open'));
  }

  //--- Разметка ---------------------------------------------------------|
  _render() {
    const root = document.createElement('div');
    root.className = 'players-overlay';

    const card = document.createElement('div');
    card.className = 'players-card';

    // Заголовок
    const h = document.createElement('h1');
    h.className = 'players-title';
    h.textContent = 'Игроки';
    card.appendChild(h);

    const sub = document.createElement('p');
    sub.className = 'players-subtitle';
    sub.textContent = 'Кто играет, кем и насколько умён противник';
    card.appendChild(sub);

    // Таблица-список слотов
    const list = document.createElement('div');
    list.className = 'players-list';
    this._rowRefs = [];
    for (let i = 0; i < this.players.count; i++) {
      const row = this._renderRow(this.players.get(i));
      this._rowRefs.push(row);
      list.appendChild(row.el);
    }
    card.appendChild(list);

    // Футер
    const footer = document.createElement('div');
    footer.className = 'players-footer';

    this.countEl = document.createElement('span');
    this.countEl.className = 'players-count';
    footer.appendChild(this.countEl);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'players-btn';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.addEventListener('click', () => this._cancel());
    footer.appendChild(cancelBtn);

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'players-btn primary';
    okBtn.textContent = 'Готово';
    okBtn.addEventListener('click', () => this._confirm());
    footer.appendChild(okBtn);

    card.appendChild(footer);
    root.appendChild(card);

    // клик по backdrop — отмена
    root.addEventListener('click', (e) => {
      if (e.target === root) this._cancel();
    });

    this._refreshCount();
    return root;
  }

  _renderRow(player) {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.dataset.index = player.index;

    // Индикатор цвета
    const swatch = document.createElement('span');
    swatch.className = 'player-swatch';
    swatch.style.background = '#' + player.color.toString(16).padStart(6, '0');
    row.appendChild(swatch);

    // Тумблер «в игре»
    const activeWrap = document.createElement('label');
    activeWrap.className = 'player-toggle';
    const activeInput = document.createElement('input');
    activeInput.type = 'checkbox';
    activeInput.checked = player.active;
    activeInput.addEventListener('change', () => {
      player.active = activeInput.checked;
      this._syncRow(player, { activeInput, typeInput, levelInput, nameInput });
      this._refreshCount();
    });
    const activeLabel = document.createElement('span');
    activeLabel.textContent = 'В игре';
    activeWrap.append(activeInput, activeLabel);
    row.appendChild(activeWrap);

    // Поле имени
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'player-name';
    nameInput.value = player.name;
    nameInput.maxLength = 24;
    nameInput.addEventListener('input', () => { player.name = nameInput.value; });
    row.appendChild(nameInput);

    // Селектор типа
    const typeInput = document.createElement('select');
    typeInput.className = 'player-type';
    [
      { v: String(HUMAN), label: 'Человек' },
      { v: '0',           label: 'Компьютер' },
    ].forEach(({ v, label }) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      typeInput.appendChild(o);
    });
    typeInput.value = String(player.isHuman ? HUMAN : 0);
    typeInput.addEventListener('change', () => {
      const v = parseInt(typeInput.value, 10);
      if (v === HUMAN) {
        player.aiLevel = HUMAN;
      } else {
        // при переключении на «Компьютер» ставим текущий уровень, либо дефолт
        if (player.isHuman) player.aiLevel = 2;
      }
      this._syncRow(player, { activeInput, typeInput, levelInput, nameInput });
    });
    row.appendChild(typeInput);

    // Селектор разумности (только для ИИ)
    const levelInput = document.createElement('select');
    levelInput.className = 'player-level';
    AI_LEVELS.forEach(lvl => {
      const o = document.createElement('option');
      o.value = String(lvl.id);
      o.textContent = `${lvl.name} · ${lvl.desc}`;
      levelInput.appendChild(o);
    });
    levelInput.value = String(player.isAI ? player.aiLevel : 2);
    levelInput.addEventListener('change', () => {
      player.aiLevel = parseInt(levelInput.value, 10);
    });
    row.appendChild(levelInput);

    // Синхронизация disabled-состояний
    this._syncRow(player, { activeInput, typeInput, levelInput, nameInput });

    return { el: row, activeInput, typeInput, levelInput, nameInput };
  }

  /** Приводит доступность контролов к текущему состоянию игрока */
  _syncRow(player, refs) {
    const { activeInput, typeInput, levelInput, nameInput } = refs;
    activeInput.checked = player.active;
    nameInput.disabled = !player.active;
    typeInput.disabled = !player.active;
    levelInput.disabled = !player.active || player.isHuman;
    if (player.isHuman) {
      levelInput.value = '2'; // визуально показываем что-то нейтральное
    } else {
      levelInput.value = String(player.aiLevel);
    }
    typeInput.value = String(player.isHuman ? HUMAN : 0);
  }

  _refreshCount() {
    const n = this.players.activeCount;
    this.countEl.textContent = `Активно: ${n} из ${this.players.count}`;
  }

  //--- Действия ---------------------------------------------------------|
  _confirm() {
    if (this.players.activeCount === 0) {
      this.countEl.textContent = 'Нужен хотя бы один игрок';
      this.countEl.classList.add('warn');
      return;
    }
    this._close(() => this.onConfirm(this.players));
  }

  _cancel() {
    this._close(() => this.onCancel(this.players));
  }

  _close(cb) {
    if (this._closed) return;
    this._closed = true;
    SND.winClose.play();   // звук закрыть окно
    this.el.classList.remove('open');
    document.removeEventListener('keydown', this._onKey);
    setTimeout(() => {
      cb?.();
    }, 180);
  }

  //--- API --------------------------------------------------------------|
  destroy() {
    document.removeEventListener('keydown', this._onKey);
    this.el.remove();
  }
}
