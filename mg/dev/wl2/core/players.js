// "players.js"
// class Player;       // класс 1 игрока
// class Players;      // все игроки тут
// class PanelPlayers; // определяем состав игроков тут
// class Judge;        // правила, которые применяются к игровым объектам
// class Game;         // --> экземляр игры

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
  constructor(index, overrides = {}) {
    this.index = index;
    this.name = overrides.name ?? `Игрок ${index + 1}`;
    this.active = overrides.active ?? (index < 2);  // первые два по умолчанию в игре
    this.aiLevel = overrides.aiLevel ?? 2;          // по умолчанию «Рыцарь»
    this.color = overrides.color ?? defaultColor(index);
  }

  get isHuman() { return this.aiLevel === HUMAN; }
  get isAI()    { return this.aiLevel !== HUMAN; }
  get aiMeta()  { return this.isHuman ? null : AI_LEVELS[this.aiLevel]; }

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
