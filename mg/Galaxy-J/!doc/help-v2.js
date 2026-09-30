// help.js — оверлей со справкой по управлению.
// API:
//   HELP.init()      — подготовить DOM
//   HELP.toggle()    — открыть/закрыть
//   HELP.isOpen()    — открыта ли справка
//   HELP.close()     — принудительно закрыть
//
// Данные о клавишах лежат в KEYMAP ниже — правьте только её,
// вёрстка подстроится сама.
//
// Все стили изолированы селекторами #help-overlay … и живут
// в собственном <style> — файл не влияет на остальные элементы
// страницы (html/body не трогает вообще).

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
      title: "ПРОЧЕЕ",
      rows: [
        ["F1", "Эта справка"],
        ["ESC", "Закрыть справку / карту"],
      ],
    },
  ];

  // --- Изолированные стили (инжектятся один раз) ---
  const CSS = `
    #help-overlay {
      position: fixed; inset: 0;
      display: none;
      align-items: center; justify-content: center;
      background: radial-gradient(ellipse at center,
                  rgba(0, 40, 20, 0.55) 0%,
                  rgba(0, 0, 0, 0.92) 70%);
      z-index: 100;
      font-family: "Share Tech Mono", "Courier New", monospace;
      color: #33ff88;
      user-select: none;
    }

    /* «бумага» — та же стеклянная панель, что и консоли HUD */
    #help-overlay .hp-paper {
      position: relative;
      padding: 38px 56px 32px;
      min-width: min(460px, 92vw);
      max-width: min(92vw, 660px);
      max-height: 86vh;
      overflow: auto;
      overscroll-behavior: contain;
      border-radius: 10px;
      border: 1px solid rgba(72, 255, 150, 0.42);
      background:
        repeating-linear-gradient(0deg,
          rgba(0, 255, 136, 0.035) 0 1px, transparent 1px 3px),
        linear-gradient(105deg,
          transparent 40%, rgba(180, 255, 220, 0.05) 46%,
          rgba(180, 255, 220, 0.02) 60%, transparent 66%),
        linear-gradient(180deg, rgba(0, 255, 136, 0.10), transparent 46%),
        linear-gradient(180deg, rgba(5, 33, 20, 0.97), rgba(1, 11, 6, 0.98));
      box-shadow:
        0 0 0 1px rgba(0, 255, 136, 0.08),
        0 0 16px rgba(0, 255, 136, 0.16),
        0 0 44px rgba(0, 255, 136, 0.07),
        0 2px 0 rgba(0, 96, 48, 0.55),
        0 4px 0 rgba(0, 58, 29, 0.55),
        0 8px 16px rgba(0, 0, 0, 0.6),
        inset 0 1px 0 rgba(170, 255, 210, 0.22),
        inset 0 -8px 16px rgba(0, 0, 0, 0.5),
        inset 0 0 24px rgba(0, 255, 136, 0.05);
      animation: hp-in 0.3s cubic-bezier(0.18, 0.8, 0.3, 1.18);
      scrollbar-width: thin;
      scrollbar-color: rgba(51, 255, 136, 0.45) rgba(0, 20, 10, 0.6);
    }
    #help-overlay .hp-paper::-webkit-scrollbar { width: 8px; }
    #help-overlay .hp-paper::-webkit-scrollbar-track {
      background: rgba(0, 20, 10, 0.6);
    }
    #help-overlay .hp-paper::-webkit-scrollbar-thumb {
      background: rgba(51, 255, 136, 0.35);
      border-radius: 4px;
    }

    /* угловые скобки */
    #help-overlay .hp-corner {
      position: absolute;
      width: 13px; height: 13px;
      border: 2px solid rgba(125, 255, 176, 0.75);
      filter: drop-shadow(0 0 4px rgba(0, 255, 136, 0.7));
      pointer-events: none;
      z-index: 2;
    }
    #help-overlay .hp-corner.tl { top: 5px; left: 5px; border-right: 0; border-bottom: 0; border-top-left-radius: 4px; }
    #help-overlay .hp-corner.tr { top: 5px; right: 5px; border-left: 0; border-bottom: 0; border-top-right-radius: 4px; }
    #help-overlay .hp-corner.bl { bottom: 5px; left: 5px; border-right: 0; border-top: 0; border-bottom-left-radius: 4px; }
    #help-overlay .hp-corner.br { bottom: 5px; right: 5px; border-left: 0; border-top: 0; border-bottom-right-radius: 4px; }

    /* заголовок */
    #help-overlay .hp-title {
      text-align: center;
      font-family: "Orbitron", "Share Tech Mono", monospace;
      font-weight: 700;
      font-size: 19px;
      letter-spacing: 6px;
      color: #ecfff4;
      text-shadow:
        0 0 2px #b6ffd2,
        0 0 14px rgba(0, 255, 136, 0.9),
        0 0 36px rgba(0, 255, 136, 0.35),
        0 2px 0 rgba(0, 66, 33, 0.95);
      margin-bottom: 4px;
    }
    #help-overlay .hp-sub {
      text-align: center;
      font-size: 11px;
      letter-spacing: 3px;
      opacity: 0.55;
      margin-bottom: 26px;
    }

    /* группа */
    #help-overlay .hp-group {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      letter-spacing: 4px;
      color: #7dffb0;
      margin: 20px 0 8px 0;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(0, 255, 136, 0.16);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
    }
    #help-overlay .hp-group i {
      width: 6px; height: 6px; flex: none;
      border-radius: 1px;
      background: radial-gradient(circle at 35% 30%,
        #dffff0, #37ff92 45%, #0a7f42 95%);
      box-shadow: 0 0 6px rgba(0, 255, 136, 0.8);
      animation: hp-blink 2.6s ease-in-out infinite;
    }

    /* строка: клавиша-кейкап + описание */
    #help-overlay .hp-row {
      display: grid;
      grid-template-columns: 138px 1fr;
      align-items: center;
      gap: 14px;
      padding: 5px 6px;
      font-size: 13px;
      line-height: 1.5;
      border-radius: 6px;
    }
    #help-overlay .hp-row:hover {
      background: rgba(0, 255, 136, 0.06);
    }
    #help-overlay .hp-keys {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 34px;
      padding: 2px 8px;
      font-family: "Orbitron", "Share Tech Mono", monospace;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 1px;
      color: #002a14;
      background: linear-gradient(180deg, #7dffb0, #33ff88);
      border-radius: 5px;
      box-shadow:
        0 2px 0 rgba(0, 90, 45, 0.8),
        0 3px 5px rgba(0, 0, 0, 0.5),
        0 0 8px rgba(0, 255, 136, 0.8),
        inset 0 0 2px rgba(255, 255, 255, 0.6);
      text-shadow: none;
      white-space: nowrap;
    }
    #help-overlay .hp-desc {
      color: #bfffd6;
      opacity: 0.9;
    }

    /* нижняя подсказка */
    #help-overlay .hp-foot {
      text-align: center;
      font-size: 11px;
      letter-spacing: 3px;
      margin-top: 28px;
      opacity: 0.55;
    }

    @keyframes hp-in {
      from {
        opacity: 0;
        transform: translateY(14px) scale(0.94);
        filter: brightness(2.2);
      }
      to {
        opacity: 1;
        transform: none;
        filter: none;
      }
    }
    @keyframes hp-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }
  `;

  // --- Состояние ---
  const state = {
    open: false,
    root: null,
  };

  // --- DOM ---
  function ensureDOM() {
    if (state.root) return;

    // стили — инжектим один раз
    if (!document.getElementById("help-overlay-style")) {
      const style = document.createElement("style");
      style.id = "help-overlay-style";
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    const root = document.createElement("div");
    root.id = "help-overlay";

    const paper = document.createElement("div");
    paper.className = "hp-paper";

    // угловые скобки
    for (const pos of ["tl", "tr", "bl", "br"]) {
      const c = document.createElement("b");
      c.className = "hp-corner " + pos;
      paper.appendChild(c);
    }

    // заголовок
    const title = document.createElement("div");
    title.className = "hp-title";
    title.textContent = "ELITE — ПУЛЬТ УПРАВЛЕНИЯ";
    paper.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "hp-sub";
    sub.textContent = "─ справочник пилота ─";
    paper.appendChild(sub);

    // группы
    KEYMAP.forEach((group, gi) => {
      const h = document.createElement("div");
      h.className = "hp-group";

      const led = document.createElement("i");
      led.style.animationDelay = (gi * 0.35).toFixed(2) + "s";
      h.appendChild(led);

      const t = document.createElement("span");
      t.textContent = group.title;
      h.appendChild(t);
      paper.appendChild(h);

      for (const [keys, desc] of group.rows) {
        const row = document.createElement("div");
        row.className = "hp-row";

        const k = document.createElement("div");
        const kc = document.createElement("span");
        kc.className = "hp-keys";
        kc.textContent = keys;
        k.appendChild(kc);

        const d = document.createElement("div");
        d.className = "hp-desc";
        d.textContent = desc;

        row.appendChild(k);
        row.appendChild(d);
        paper.appendChild(row);
      }
    });

    const hint = document.createElement("div");
    hint.className = "hp-foot";
    hint.textContent = "F1 или ESC — закрыть";
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
  const toggle = () => setOpen(!state.open);
  const close = () => setOpen(false);
  const isOpen = () => state.open;

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