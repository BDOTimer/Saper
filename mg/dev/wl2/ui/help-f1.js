//  ui/help-f1.js

const STYLE_ID = 'help-f1-styles';

const GAME_KEY_CODES = new Set([
  'Space', 'Enter', 'NumpadEnter',
  'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
]);

const HELP_SECTIONS = [
  {
    title: 'Карта и камера',
    rows: [
      ['ЛКМ по клетке', 'Выбрать клетку и показать её сведения. В планировании — выбрать свою армию или задать маршрут.'],
      ['Колесо мыши', 'Приблизить или отдалить карту, когда курсор находится над картой.'],
      ['W A S D', 'Двигать камеру в режиме «Сверху»; клавиши можно удерживать.'],
      ['ЛКМ в «Орбите»', 'Панорама камеры. Короткий клик по клетке выбирает её.'],
      ['ПКМ в «Орбите»', 'Вращать камеру вокруг карты.'],
      ['СКМ', 'Приближение и отдаление камеры.'],
      ['Кнопки «Орбита» / «Сверху»', 'Переключить режим камеры.'],
      ['Клик по армии или городу', 'Вне фазы планирования открыть панель армии или города.'],
    ],
  },
  {
    title: 'Ход и маршруты',
    rows: [
      ['Клик по своей армии', 'Выбрать армию в фазе планирования и показать её маршрут.'],
      ['Клик по клетке', 'Назначить выбранной армии маршрут на следующий круг.'],
      ['Кнопка «Очистить маршрут»', 'Убрать маршрут у выбранной армии.'],
      ['Кнопка «Снять выбор»', 'Сбросить выбранную армию и клетку.'],
      ['Esc', 'Снять выбор, если не открыта модальная панель.'],
      ['Зелёная кнопка «▶ Следующий круг»', 'Начать новый круг, когда текущий круг завершён.'],
      ['Space', 'Начать следующий круг, когда кнопка доступна.'],
      ['Enter / Numpad Enter', 'Начать следующий круг, когда кнопка доступна.'],
      ['Ctrl', 'Открыть панель армии в фокусе во время планирования.'],
      ['Shift', 'Открыть панель города на выбранной клетке во время планирования.'],
    ],
  },
  {
    title: 'Армии, города и бой',
    rows: [
      ['Кнопки «Армия» / «Город»', 'Дублируют Ctrl и Shift для выбранной армии или города.'],
      ['Клик по юниту в панели армии', 'Показать характеристики юнита.'],
      ['Клик по модели в городе', 'Выбрать тип юнита для производства.'],
      ['Встреча своих армий', 'Открывается обмен: кликните по юниту, затем нажмите «ПЕРЕМЕСТИТЬ».'],
      ['Бой', 'Идёт автоматически. После завершения закройте окно кнопкой «ЗАКРЫТЬ».'],
      ['Руины', 'Окно открывается при входе в руины; закройте его, чтобы забрать монстров.'],
      ['Esc', 'Закрыть открытую панель: армию, город, бой, обмен или руины.'],
      ['Клик по фону', 'Закрыть модальную панель, если она поддерживает закрытие по фону.'],
      ['← В меню', 'Выйти из партии в главное меню.'],
      ['F1', 'Открыть или закрыть эту справку.'],
    ],
  },
];

const HELP_HTML = `
  <section class="help-f1-panel" role="dialog" aria-modal="true"
           aria-labelledby="helpF1Title" tabindex="-1">
    <header class="help-f1-head">
      <div class="help-f1-head-text">
        <div class="help-f1-kicker">СПРАВКА</div>
        <h2 class="help-f1-title" id="helpF1Title">УПРАВЛЕНИЕ ИГРОЙ</h2>
        <p class="help-f1-sub">Карта, маршруты, армии и бой — коротко о главном.</p>
      </div>
      <button type="button" class="help-f1-close" aria-label="Закрыть справку">ЗАКРЫТЬ</button>
    </header>
    <div class="help-f1-body">
      ${HELP_SECTIONS.map(({ title, rows }) => `
        <section class="help-f1-section">
          <h3>${title}</h3>
          ${rows.map(([key, desc]) => `
            <div class="help-f1-row">
              <span class="help-f1-key">${key}</span>
              <span class="help-f1-desc">${desc}</span>
            </div>
          `).join('')}
        </section>
      `).join('')}
    </div>
    <footer class="help-f1-foot">
      <span><b>F1</b> — открыть или закрыть справку</span>
      <span><b>Esc</b> — закрыть окно</span>
    </footer>
  </section>
`;

const CSS = `
#hud #gameTopbar #btnHelpF1,
.help-f1-btn {
  flex: 0 0 auto;
  box-sizing: border-box;
  min-width: 44px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background:
    linear-gradient(180deg, #405b73 0%, #223447 46%, #172431 54%, #0d1722 100%) padding-box,
    linear-gradient(180deg, #f0d796, #8a652c) border-box;
  color: #ffe8b5;
  font: inherit;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: .08em;
  cursor: pointer;
  text-shadow: 0 1px 2px rgba(0, 0, 0, .75);
  box-shadow:
    0 3px 9px rgba(0, 0, 0, .45),
    inset 0 1px 0 rgba(255, 255, 255, .25),
    inset 0 -2px 0 rgba(0, 0, 0, .45);
  transition: filter .18s ease, transform .18s ease, box-shadow .18s ease;
}

#hud #gameTopbar #btnHelpF1:hover,
.help-f1-btn:hover {
  filter: brightness(1.18);
  box-shadow:
    0 5px 14px rgba(232, 195, 122, .24),
    0 3px 9px rgba(0, 0, 0, .45),
    inset 0 1px 0 rgba(255, 255, 255, .32),
    inset 0 -2px 0 rgba(0, 0, 0, .45);
}

#hud #gameTopbar #btnHelpF1:active,
.help-f1-btn:active {
  transform: translateY(1px) scale(.98);
  box-shadow:
    inset 0 3px 8px rgba(0, 0, 0, .55),
    inset 0 -1px 0 rgba(255, 255, 255, .08);
}

#hud #gameTopbar #btnHelpF1:focus-visible,
.help-f1-btn:focus-visible {
  outline: none;
  border-color: #f0d796;
  box-shadow:
    0 0 0 3px rgba(240, 215, 150, .22),
    inset 0 1px 0 rgba(255, 255, 255, .25);
}

#hud #gameTopbar #btnHelpF1.is-open,
.help-f1-btn.is-open {
  filter: brightness(1.22);
  border-color: #ffe8b5;
}

#btnHelpF1.help-f1-btn--floating {
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 4001;
}

.help-f1-overlay {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 12px;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(88, 155, 206, .14), transparent 56%),
    radial-gradient(ellipse at 50% 100%, rgba(232, 195, 122, .06), transparent 55%),
    rgba(4, 9, 15, .72);
  -webkit-backdrop-filter: blur(9px) saturate(.9);
  backdrop-filter: blur(9px) saturate(.9);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity .24s ease, visibility 0s linear .24s;
  font-family: inherit;
  color: #e6edf3;
}

.help-f1-overlay.open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition: opacity .24s ease, visibility 0s linear 0s;
}

.help-f1-panel {
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 60vw;
  height: 95vh;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 22px;
  background:
    radial-gradient(ellipse at 50% -12%, rgba(93, 166, 220, .24), transparent 52%) padding-box,
    linear-gradient(158deg, #1d2d3e 0%, #101a25 48%, #192938 100%) padding-box,
    linear-gradient(120deg, #6e89a4 0%, #a98445 18%, #f1dfae 40%, #8c6b35 60%, #4b6c88 82%, #9cb4c8 100%) border-box;
  background-size: 100% 100%, 100% 100%, 250% 100%;
  box-shadow:
    0 40px 110px rgba(0, 0, 0, .78),
    0 12px 34px rgba(0, 0, 0, .55),
    0 0 0 1px rgba(255, 255, 255, .035),
    inset 0 1px 0 rgba(255, 255, 255, .24),
    inset 0 -4px 14px rgba(0, 0, 0, .70),
    inset 0 0 90px rgba(55, 131, 184, .10);
  transform: translateY(14px) scale(.985);
  opacity: 0;
  animation: helpF1Rim 14s linear infinite;
  transition: transform .26s cubic-bezier(.2, .8, .2, 1), opacity .22s ease;
}

.help-f1-overlay.open .help-f1-panel {
  transform: none;
  opacity: 1;
}

.help-f1-panel::before {
  content: "";
  position: absolute;
  inset: 6px;
  z-index: 0;
  pointer-events: none;
  border: 1px solid rgba(217, 236, 255, .12);
  border-radius: 17px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .16),
    inset 0 -2px 0 rgba(0, 0, 0, .55),
    inset 0 0 44px rgba(59, 126, 178, .10);
}

.help-f1-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 18% 0%, rgba(255, 241, 200, .08), transparent 38%),
    linear-gradient(115deg, transparent 34%, rgba(255, 255, 255, .05) 49%, rgba(232, 195, 122, .045) 53%, transparent 66%);
  background-size: 100% 100%, 300% 100%;
  animation: helpF1Sweep 9s ease-in-out infinite;
}

.help-f1-head,
.help-f1-body,
.help-f1-foot {
  position: relative;
  z-index: 1;
}

.help-f1-head {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  gap: 24px;
  padding: 26px 30px 18px;
  border-bottom: 1px solid rgba(183, 207, 229, .18);
  background:
    linear-gradient(180deg, rgba(63, 95, 124, .38), rgba(12, 21, 30, .16));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .10),
    inset 0 -1px 0 rgba(0, 0, 0, .35);
}

.help-f1-head-text {
  min-width: 0;
}

.help-f1-kicker {
  margin-bottom: 5px;
  color: #c9ab72;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: .28em;
  text-transform: uppercase;
}

.help-f1-title {
  margin: 0;
  font-size: clamp(22px, 2.2vw, 34px);
  font-weight: 800;
  letter-spacing: .045em;
  line-height: 1.08;
  background: linear-gradient(180deg, #fff6dc 0%, #f3d795 38%, #b8862f 50%, #ffe9b4 62%, #a9762a 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  filter:
    drop-shadow(0 0 6px rgba(255, 224, 130, .42))
    drop-shadow(0 0 20px rgba(255, 180, 60, .22));
}

.help-f1-sub {
  margin: 8px 0 0;
  color: #9fb2c4;
  font-size: 18px;
  line-height: 1.4;
}

.help-f1-close {
  flex: 0 0 auto;
  margin-left: auto;
  padding: 9px 17px;
  border: 1px solid transparent;
  border-radius: 8px;
  background:
    linear-gradient(180deg, #1a2530 0%, #3c5169 46%, #4a637e 50%, #243445 55%, #121b24 100%) padding-box,
    linear-gradient(180deg, #fff0c6, #8a652c) border-box;
  color: #f6e7c4;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: .11em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow:
    0 6px 18px rgba(0, 0, 0, .45),
    inset 0 1px 0 rgba(255, 255, 255, .28),
    inset 0 -2px 0 rgba(0, 0, 0, .50);
  transition: transform .18s ease, filter .2s ease, box-shadow .2s ease;
}

.help-f1-close:hover {
  transform: translateY(-1px);
  filter: brightness(1.14);
  box-shadow:
    0 9px 24px rgba(232, 195, 122, .22),
    0 4px 10px rgba(0, 0, 0, .45),
    inset 0 1px 0 rgba(255, 255, 255, .35);
}

.help-f1-close:active {
  transform: translateY(1px) scale(.985);
  box-shadow:
    inset 0 3px 8px rgba(0, 0, 0, .55),
    inset 0 -1px 0 rgba(255, 255, 255, .08);
}

.help-f1-close:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px rgba(240, 215, 150, .22),
    inset 0 1px 0 rgba(255, 255, 255, .28);
}

.help-f1-body {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  align-content: start;
  gap: 14px;
  padding: 20px 24px 24px;
  overflow-y: auto;
  scrollbar-color: #2a3441 #0b0f14;
  scrollbar-width: thin;
}

.help-f1-section {
  box-sizing: border-box;
  padding: 15px 17px 13px;
  border: 1px solid rgba(150, 183, 211, .20);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(45, 70, 94, .48) 0%, rgba(9, 18, 27, .56) 100%);
  box-shadow:
    0 8px 20px rgba(0, 0, 0, .24),
    inset 0 1px 0 rgba(255, 255, 255, .10),
    inset 0 -2px 0 rgba(0, 0, 0, .35);
}

.help-f1-section h3 {
  margin: 0 0 8px;
  padding-bottom: 9px;
  border-bottom: 1px solid rgba(232, 195, 122, .20);
  color: #e8c37a;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: .035em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, .5);
}

.help-f1-section h3::before {
  content: "";
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 8px;
  vertical-align: 2px;
  background: #e8c37a;
  transform: rotate(45deg);
  box-shadow: 0 0 8px rgba(232, 195, 122, .55);
}

.help-f1-row {
  display: grid;
  grid-template-columns: minmax(112px, .38fr) 1fr;
  gap: 10px;
  align-items: start;
  padding: 7px 0;
}

.help-f1-row + .help-f1-row {
  border-top: 1px solid rgba(150, 183, 211, .10);
}

.help-f1-key {
  justify-self: start;
  padding: 2px 7px;
  border: 1px solid rgba(227, 194, 126, .42);
  border-radius: 6px;
  background:
    linear-gradient(180deg, rgba(61, 84, 108, .92), rgba(17, 29, 41, .92));
  color: #ffe9b8;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.35;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .16),
    inset 0 -1px 0 rgba(0, 0, 0, .35),
    0 1px 3px rgba(0, 0, 0, .25);
}

.help-f1-desc {
  color: #c3d0dc;
  font-size: 18px;
  line-height: 1.45;
}

.help-f1-foot {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px 24px;
  padding: 12px 26px 14px;
  border-top: 1px solid rgba(183, 207, 229, .16);
  background: linear-gradient(180deg, rgba(9, 18, 27, .38), rgba(6, 12, 19, .58));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .06);
  color: #8ea3b8;
  font-size: 16px;
  letter-spacing: .02em;
}

.help-f1-foot b {
  color: #ffe2a2;
}

.help-f1-body::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.help-f1-body::-webkit-scrollbar-track {
  background: #0b0f14;
  border-radius: 8px;
}

.help-f1-body::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #3a4658, #1b222b);
  border: 2px solid #0b0f14;
  border-radius: 8px;
}

.help-f1-body::-webkit-scrollbar-thumb:hover {
  background: #46536a;
}

@keyframes helpF1Rim {
  from { background-position: 0 0, 0 0, 0% 0; }
  to   { background-position: 0 0, 0 0, -220% 0; }
}

@keyframes helpF1Sweep {
  0%, 15%   { background-position: 0 0, 150% 0; }
  60%, 100% { background-position: 0 0, -150% 0; }
}

@media (max-width: 900px) {
  .help-f1-head {
    padding: 20px 20px 15px;
  }

  .help-f1-body {
    grid-template-columns: 1fr;
    padding: 16px;
  }

  .help-f1-foot {
    padding: 10px 18px 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .help-f1-panel,
  .help-f1-panel::after {
    animation: none;
  }
}
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export class HelpF1 {
  constructor(opts = {}) {
    this._opts = opts;
    this._mounted = false;
    this._open = false;
    this._el = null;
    this._button = null;
    this._closeBtn = null;
    this._lastFocus = null;

    this._onKey = (e) => this._handleKey(e);
    this._onButtonClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    };
    this._onBackdropClick = (e) => {
      if (e.target === this._el) this.close();
    };
    this._onCloseClick = () => this.close();

    if (opts.autoMount !== false) this.mount(opts);
  }

  get isOpen() {
    return this._open;
  }

  mount(opts = {}) {
    if (this._mounted || typeof document === 'undefined') return this;

    const parent = opts.parent ?? document.body;
    const buttonParent = opts.buttonParent ?? null;
    const buttonBefore = opts.buttonBefore ?? null;

    ensureStyles();

    this._el = document.createElement('div');
    this._el.className = 'help-f1-overlay';
    this._el.setAttribute('aria-hidden', 'true');
    this._el.innerHTML = HELP_HTML;
    parent.appendChild(this._el);

    this._closeBtn = this._el.querySelector('.help-f1-close');
    this._closeBtn?.addEventListener('click', this._onCloseClick);
    this._el.addEventListener('click', this._onBackdropClick);

    this._button = document.createElement('button');
    this._button.type = 'button';
    this._button.id = 'btnHelpF1';
    this._button.className = 'help-f1-btn';
    this._button.textContent = 'F1';
    this._button.title = 'Управление игрой (F1)';
    this._button.setAttribute('aria-label', 'Открыть справку по управлению');
    this._button.setAttribute('aria-expanded', 'false');
    this._button.addEventListener('click', this._onButtonClick);

    if (buttonParent) {
      if (buttonBefore && buttonBefore.parentNode === buttonParent) {
        buttonParent.insertBefore(this._button, buttonBefore);
      } else {
        buttonParent.appendChild(this._button);
      }
    } else {
      this._button.classList.add('help-f1-btn--floating');
      document.body.appendChild(this._button);
    }

    document.addEventListener('keydown', this._onKey, true);
    this._mounted = true;
    return this;
  }

  open() {
    if (!this._mounted) this.mount(this._opts);
    if (!this._mounted || this._open) return;
    if (typeof document === 'undefined') return;

    this._lastFocus = document.activeElement;
    this._open = true;
    this._el.classList.add('open');
    this._el.setAttribute('aria-hidden', 'false');
    this._button?.classList.add('is-open');
    this._button?.setAttribute('aria-expanded', 'true');
    this._opts.onOpen?.();
    this._closeBtn?.focus?.({ preventScroll: true });
  }

  close() {
    if (!this._mounted || !this._open) return;

    this._open = false;
    this._el.classList.remove('open');
    this._el.setAttribute('aria-hidden', 'true');
    this._button?.classList.remove('is-open');
    this._button?.setAttribute('aria-expanded', 'false');
    this._opts.onClose?.();

    if (this._lastFocus?.isConnected && typeof this._lastFocus.focus === 'function') {
      this._lastFocus.focus({ preventScroll: true });
    }
    this._lastFocus = null;
  }

  toggle() {
    if (this._open) this.close();
    else this.open();
  }

  destroy() {
    if (!this._mounted) return;

    this._open = false;
    document.removeEventListener('keydown', this._onKey, true);
    this._el?.removeEventListener('click', this._onBackdropClick);
    this._closeBtn?.removeEventListener('click', this._onCloseClick);
    this._button?.removeEventListener('click', this._onButtonClick);
    this._el?.remove();
    this._button?.remove();
    this._el = null;
    this._button = null;
    this._closeBtn = null;
    this._lastFocus = null;
    this._mounted = false;
  }

  _handleKey(e) {
    if (e.code === 'F1' || e.key === 'F1') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) this.toggle();
      return;
    }

    if (!this._open) return;

    if (e.code === 'Escape' || e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.close();
      return;
    }

    if (e.key === 'Tab') return;

    if (e.target === this._closeBtn &&
        (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.close();
      return;
    }

    if (GAME_KEY_CODES.has(e.code)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
}

export const helpF1 = new HelpF1({ autoMount: false });
