/* ui/game-title.js */

export class GameTitle {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.name]        — основное название (по умолчанию «Грань Империи»)
   * @param {string} [opts.accentWord]  — слово, которое подсветить акцентом (например, «Империи»)
   * @param {string} [opts.subtitle]    — подзаголовок (по умолчанию «Remake of Warlords II»)
   * @param {string} [opts.version]     — версия/билд (необязательно)
   * @param {HTMLElement} [opts.parent] — куда монтировать (по умолчанию document.body)
   */
  constructor(opts = {}) {
    this.name = opts.name ?? 'Грань Империи';
    this.accentWord = opts.accentWord ?? 'Империи';
    this.subtitle = opts.subtitle ?? 'Remake of Warlords II';
    this.version = opts.version ?? '';
    this.parent = opts.parent ?? document.body;

    this.el = this.#render();
    this.parent.appendChild(this.el);
  }

  #render() {
    const root = document.createElement('div');
    root.className = 'game-title';

    const h = document.createElement('h1');
    h.className = 'game-title__name';
    h.appendChild(this.#renderName());
    root.appendChild(h);

    const sub = document.createElement('p');
    sub.className = 'game-title__subtitle';
    sub.textContent = this.subtitle;
    root.appendChild(sub);

    if (this.version) {
      const ver = document.createElement('p');
      ver.className = 'game-title__version';
      ver.textContent = this.version;
      root.appendChild(ver);
    }

    return root;
  }

  #renderName() {
    const frag = document.createDocumentFragment();
    const idx = this.name.indexOf(this.accentWord);

    if (idx === -1 || !this.accentWord) {
      frag.appendChild(document.createTextNode(this.name));
      return frag;
    }

    const before = this.name.slice(0, idx);
    const after = this.name.slice(idx + this.accentWord.length);

    if (before) frag.appendChild(document.createTextNode(before));

    const span = document.createElement('span');
    span.className = 'accent';
    span.textContent = this.accentWord;
    frag.appendChild(span);

    if (after) frag.appendChild(document.createTextNode(after));

    return frag;
  }

  /** Показать/скрыть панель */
  setVisible(visible) {
    this.el.style.display = visible ? '' : 'none';
  }

  /** Обновить версию на лету */
  setVersion(version) {
    this.version = version;
    let verEl = this.el.querySelector('.game-title__version');
    if (!version) {
      if (verEl) verEl.remove();
      return;
    }
    if (!verEl) {
      verEl = document.createElement('p');
      verEl.className = 'game-title__version';
      this.el.appendChild(verEl);
    }
    verEl.textContent = version;
  }

  /** Удалить панель из DOM */
  destroy() {
    this.el.remove();
  }
}

/* Использование
import { GameTitle } from './ui/game-title.js';

const title = new GameTitle({
  name: 'Грань Империи',
  accentWord: 'Империи',       // подсветится зелёным
  subtitle: 'Remake of Warlords II',
  version: 'v0.1.0-dev',
  parent: document.getElementById('hud'),
});
*/