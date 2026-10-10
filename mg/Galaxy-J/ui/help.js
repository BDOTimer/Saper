// help.js — оверлей со справкой по управлению.
// API:
//   HELP.init()      — подготовить DOM
//   HELP.toggle()    — открыть/закрыть
//   HELP.isOpen()    — открыта ли справка
//   HELP.close()     — принудительно закрыть
//
// Данные о клавишах лежат в KEYMAP ниже — правьте только её,
// вёрстка подстроится сама.

const HELP = (() => {
  // --- Содержимое справки ---
  // Каждая группа: { title, rows: [[keys, description], ...] }
  const KEYMAP = [
    {
      title: "НАВИГАЦИЯ",
      rows: [
        ["W / S", "Тангаж — нос вверх / вниз"],
        ["A / D", "Крен — влево / вправо"],
        ["⬅️➡️", "Рыскание — поворот влево / вправо"],
        ["⬆️", "Тяга — разгон вперёд"],
        ["⬇️", "Тормоз — сброс скорости"],
        ["J", "Гипер-Прыжок в кротовую нору"],
      ],
    },
    {
      title: "БОЙ",
      rows: [
        ["SPACE", "Огонь из лазеров"],
        ["ENTER", "Подтверждение / рестарт после смерти"],
      ],
    },
    {
      title: "КАРТА ГАЛАКТИКИ",
      rows: [
        ["M", "Открыть / закрыть карту"],
        ["↑ ↓ ← →", "Двигать выбор звезды"],
        ["ENTER", "Прыжок к выбранной звезде"],
      ],
    },
    {
      title: "СТАНЦИЯ",
      rows: [
        ["T", "Териминал::Торговля(в доке)"],
        ["O", "Отстыковаться от станции"],
      ],
    },
    {
      title: "ПРОЧЕЕ",
      rows: [
        ["G", "Посмотреть Грузовой Отсек(вне дока)"],
        ["F1", "Эта справка"],
        ["ESC", "Закрыть справку / карту"],
      ],
    },
  ];

  // --- Состояние ---
  const state = {
    open: false,
    root: null,
  };

  // --- DOM ---
  function ensureDOM() {
    if (state.root) return;

    // затемняющий фон + центрирование
    const root = document.createElement("div");
    root.id = "help-overlay";
    root.style.cssText = `
      position: fixed; inset: 0;
      display: none;
      align-items: center; justify-content: center;
      background: radial-gradient(ellipse at center,
                  rgba(0, 40, 20, 0.55) 0%,
                  rgba(0, 0, 0, 0.92) 70%);
      z-index: 100;
      font-family: "Courier New", monospace;
      color: #33ff88;
      user-select: none;
    `;

    // «бумага» — панель со справкой
    const paper = document.createElement("div");
    paper.style.cssText = `
      position: relative;
      padding: 44px 64px 40px 64px;
      min-width: 480px;
      max-width: 92vmin;
      max-height: 88vmin;
      overflow: auto;

      background:
        linear-gradient(180deg,
          rgba(4, 26, 14, 0.96) 0%,
          rgba(2, 12, 8, 0.98) 100%);
      border: 1px solid #33ff88;
      box-shadow:
        0 0 0 1px rgba(51, 255, 136, 0.25),
        0 0 28px rgba(0, 255, 136, 0.35),
        inset 0 0 60px rgba(0, 255, 136, 0.08);
      border-radius: 4px;
    `;

    // внутренние «уголки» — как в терминалах
    const corners = document.createElement("div");
    corners.style.cssText = `
      position: absolute; inset: 8px; pointer-events: none;
      border: 1px solid rgba(51, 255, 136, 0.18);
      border-radius: 2px;
    `;
    paper.appendChild(corners);

    // заголовок
    const title = document.createElement("div");
    title.textContent = "GALAXY-J: ПУЛЬТ УПРАВЛЕНИЯ";
    title.style.cssText = `
      text-align: center;
      font-size: 20px;
      letter-spacing: 6px;
      margin-bottom: 4px;
      color: #a8ffd0;
      text-shadow: 0 0 10px #00ff88, 0 0 3px #00ff88;
    `;
    paper.appendChild(title);

    // подзаголовок
    const sub = document.createElement("div");
    sub.textContent = "─ справочник пилота ─";
    sub.style.cssText = `
      text-align: center;
      font-size: 11px;
      letter-spacing: 3px;
      opacity: 0.55;
      margin-bottom: 28px;
    `;
    paper.appendChild(sub);

    // контент — группы
    for (const group of KEYMAP) {
      const h = document.createElement("div");
      h.textContent = group.title;
      h.style.cssText = `
        font-size: 12px;
        letter-spacing: 4px;
        color: #7dffb0;
        margin: 18px 0 8px 0;
        padding-bottom: 4px;
        border-bottom: 1px dashed rgba(51, 255, 136, 0.35);
      `;
      paper.appendChild(h);

      for (const [keys, desc] of group.rows) {
        const row = document.createElement("div");
        row.style.cssText = `
          display: grid;
          grid-template-columns: 120px 1fr;
          align-items: baseline;
          gap: 14px;
          padding: 4px 0;
          font-size: 13px;
          line-height: 1.5;
        `;

        const k = document.createElement("div");
        k.textContent = keys;
        k.style.cssText = `
          color: #ffff88;
          letter-spacing: 2px;
          text-shadow: 0 0 8px #ffcc33;
          font-weight: bold;
          white-space: nowrap;
        `;

        const d = document.createElement("div");
        d.textContent = desc;
        d.style.cssText = `
          color: #bfffd6;
          opacity: 0.9;
        `;

        row.appendChild(k);
        row.appendChild(d);
        paper.appendChild(row);
      }
    }

    // нижняя подсказка
    const hint = document.createElement("div");
    hint.textContent = "F1 или ESC — закрыть";
    hint.style.cssText = `
      text-align: center;
      font-size: 11px;
      letter-spacing: 3px;
      margin-top: 30px;
      opacity: 0.55;
    `;
    paper.appendChild(hint);

    root.appendChild(paper);
    document.body.appendChild(root);

    state.root = root;
  }

  // --- Переключение ---
  function setOpen(v) {
    ensureDOM();
    state.open = v;
    state.root.style.display = v ? "flex" : "none";
  }
  const toggle = () =>   setOpen(!state.open);
  const close  = () => { setOpen(false); }
  const isOpen = () =>   state.open;

  return {
    init() {
      ensureDOM();
    },
    toggle,
    close,
    isOpen,
  };
})();

//export default HELP;