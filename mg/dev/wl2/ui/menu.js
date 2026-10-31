/// menu.js
///----------------------------------------------------------------------------|
/// Экран "Главное меню."
///----------------------------------------------------------------------------:

const VERSION = 'v-0.0.3.2+';

// MenuScreen (главное меню)
//    ├── "В игру"  →   disabled
//    ├── "Карта"   →   MapEditorScreen
//    ├── "Описание"→   AboutOverlay (поверх меню)
//    ├── "Игроки"    — disabled
//    └── "Настройки" — disabled

// MapEditorScreen
//    └── "← В меню" →  MenuScreen

const GAME_NAME   = 'Грань Империи';
const GAME_ACCENT = 'Империи';

const MENU_ITEMS = [
  { id: 'new-game',  label: 'В игру',    hint: 'Скоро',      enabled: true  },
  { id: 'players',   label: 'Игроки',    hint: 'Кто в игре?',enabled: true  },
  { id: 'map',       label: 'Карта',     hint: 'Выбор мира', enabled: true  },
  { id: 'settings',  label: 'Настройки', hint: 'Скоро',      enabled: true  },
  { id: 'about',     label: 'Описание',  hint: 'Об игре',    enabled: true  },
];

/**
 * Экран главного меню.
 *
 * @param {Object}   [opts]
 * @param {Function} [opts.onSelect]   — колбэк (id, label) при выборе пункта
 * @param {string}   [opts.version]    — версия для подписи внизу
 * @param {HTMLElement} [opts.parent]  — куда монтировать (по умолчанию document.body)
 */
export class MenuScreen {
  constructor(opts = {}) {
    this.onSelect = opts.onSelect ?? (() => {});
    this.version = opts.version ?? VERSION;
    this.parent = opts.parent ?? document.body;

    this.el = this.#render();
    this.parent.appendChild(this.el);

    this.#bindKeys();
  }

  //--- Разметка ---------------------------------------------------------|
  #render() {
    const screen = document.createElement('div');
    screen.className = 'menu-screen';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-label', 'Главное меню');

    const card = document.createElement('div');
    card.className = 'menu-card';

    // Логотип
    const logo = document.createElement('h1');
    logo.className = 'menu-logo';
    logo.appendChild(this.#renderLogoText());
    card.appendChild(logo);

    const tag = document.createElement('p');
    tag.className = 'menu-tagline';
    tag.textContent = 'Remake of Warlords II';
    card.appendChild(tag);

    const divider = document.createElement('div');
    divider.className = 'menu-divider';
    card.appendChild(divider);

    // Кнопки
    const nav = document.createElement('nav');
    nav.className = 'menu-nav';
    this.buttons = [];

    for (const item of MENU_ITEMS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-btn';
      btn.dataset.id = item.id;
      btn.disabled = !item.enabled;
      if (!item.enabled) btn.setAttribute('aria-disabled', 'true');

      const label = document.createElement('span');
      label.className = 'menu-btn__label';
      label.textContent = item.label;

      const hint = document.createElement('span');
      hint.className = 'menu-btn__hint';
      hint.textContent = item.hint;

      btn.append(label, hint);
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        this.onSelect(item.id, item.label);
      });

      this.buttons.push(btn);
      nav.appendChild(btn);
    }

    card.appendChild(nav);

    // Подпись
    const footer = document.createElement('p');
    footer.className = 'menu-footer';
    footer.innerHTML =
      `<span class="accent">${GAME_NAME}</span> · ${this.version}`;
    card.appendChild(footer);

    screen.appendChild(card);
    return screen;
  }

  #renderLogoText() {
    const frag = document.createDocumentFragment();
    const idx = GAME_NAME.indexOf(GAME_ACCENT);
    if (idx === -1) {
      frag.appendChild(document.createTextNode(GAME_NAME));
      return frag;
    }
    const before = GAME_NAME.slice(0, idx);
    const after = GAME_NAME.slice(idx + GAME_ACCENT.length);

    if (before) frag.appendChild(document.createTextNode(before));

    const span = document.createElement('span');
    span.className = 'accent';
    span.textContent = GAME_ACCENT;
    frag.appendChild(span);

    if (after) frag.appendChild(document.createTextNode(after));
    return frag;
  }

  //--- Клавиатура -------------------------------------------------------|
  #bindKeys() {
    this._onKey = (e) => {
      const active = document.activeElement;
      if (!this.el.contains(active)) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

      e.preventDefault();
      const list = this.buttons.filter(b => !b.disabled);
      if (!list.length) return;

      const idx = list.indexOf(active);
      const next = e.key === 'ArrowDown'
        ? list[(idx + 1) % list.length]
        : list[(idx - 1 + list.length) % list.length];
      next.focus();
    };
    document.addEventListener('keydown', this._onKey);

    // Автофокус на первой доступной кнопке
    requestAnimationFrame(() => {
      const first = this.buttons.find(b => !b.disabled);
      if (first) first.focus();
    });
  }

  //--- Публичный API ----------------------------------------------------|
  setVisible(visible) {
    this.el.style.display = visible ? '' : 'none';
    if (visible) {
      const first = this.buttons.find(b => !b.disabled);
      if (first) first.focus();
    }
  }

  destroy() {
    document.removeEventListener('keydown', this._onKey);
    this.el.remove();
  }
}

// // Как подключить
// import { MenuScreen } from './menu.js';

// const menu = new MenuScreen({
//   version: 'v0.1.0',
//   onSelect: (id, label) => {
//     if (id === 'new-game') { /* запуск партии */ }
//     if (id === 'map')      { /* экран выбора карты */ }
//     if (id === 'about')    { /* экран описания */ }
//   },
// });

// // Позже, когда меню нужно убрать:
// // menu.setVisible(false);  // скрыть
// // menu.destroy();          // удалить из DOM
