//  panel-values.js
//  class Panel1ColumnValues — панель «одна колонка строк, в строке до 3 значений».
//  Стиль — во внешнем panel-values.css

const NBSP = "\u00A0"; // пробел

class Panel1ColumnValues {
  /**
   * @param {Object} [opts]
   * @param {string}  [opts.id="panel1col"]       — DOM id
   * @param {string}  [opts.position="top-left"]  — "top-left" | "top-right" | "bottom-left" | "bottom-right"
   * @param {number|string} [opts.top]            — переопределение
   * @param {number|string} [opts.right]
   * @param {number|string} [opts.bottom]
   * @param {number|string} [opts.left]
   * @param {number}  [opts.colGap=6]             — зазор между колонками (px)
   * @param {number}  [opts.rowGap=3]             — зазор между строками (px)
   * @param {boolean} [opts.compact=false]        — плотный режим (меньше padding/шрифт)
   * @param {string}  [opts.align="right"]        — выравнивание значений: "right" | "left"
   */
  constructor(opts = {}) {
    this.id       = opts.id       ?? "panel1col";
    this.position = opts.position ?? "top-left";
    this.top      = opts.top;
    this.right    = opts.right;
    this.bottom   = opts.bottom;
    this.left     = opts.left;
     this.width   = opts.width    ?? null;
    this.colGap   = opts.colGap   ?? 2;
    this.rowGap   = opts.rowGap   ?? 3;
    this.compact  = !!opts.compact;
    this.align    = opts.align === "left" ? "left" : "right";

    /** @type {Map<string, Object>} id → описание строки */
    this._rows = new Map();

    this._buildRoot();
  }

  // ---------- Построение ----------

  _buildRoot() {
    const root = document.createElement("div");
    root.id = this.id;
    root.className = "panel1col";

    // модификаторы
    root.classList.add(`panel1col--${this.position}`);
    if (this.compact) root.classList.add("panel1col--compact");
    if (this.align === "left") root.classList.add("panel1col--align-left");

    // CSS-переменные для зазоров
    root.style.setProperty("--panel-col-gap", this.colGap + "px");
    root.style.setProperty("--panel-row-gap", this.rowGap + "px");

    if (this.width !== null) {
      root.style.width = this.width + "px";
    }

    // Только позиционные переопределения (top/right/bottom/left) — они уникальны,
    // и их правда удобно задавать из JS, а не держать 4 класса.
    const toPx = (v) => (typeof v === "number" ? v + "px" : v);
    if (this.top    !== undefined) root.style.top    = toPx(this.top);
    if (this.right  !== undefined) root.style.right  = toPx(this.right);
    if (this.bottom !== undefined) root.style.bottom = toPx(this.bottom);
    if (this.left   !== undefined) root.style.left   = toPx(this.left);

    document.body.appendChild(root);
    this.root = root;
  }

  // ---------- Добавление/удаление строк ----------

  /**
   * Добавить строку.
   *
   * @param {Object} cfg
   * @param {string} cfg.id              — уникальный id строки
   * @param {string} [cfg.label]         — подпись (если нет — строка без label, начнётся со value)
   * @param {Array<Object>} cfg.values   — до 3 значений. Каждое:
   *        { type: "number"|"string", value: number|string,
   *          // для number:
   *          decimals?: number  (по умолчанию 0),
   *          pad?: number       (сколько знаков, дополнять нулями слева),
   *          suffix?: string    (например "%" или " шт"),
   *          // для string:
   *          // просто value: string
   *        }
   *
   * Порядок values = порядок столбцов значений.
   * Если у разных строк разное количество values — выравнивание по столбцам сохраняется:
   * пустые ячейки вставляются автоматически (невидимые).
   */
  add(cfg) {
    if (!cfg || !cfg.id) throw new Error("Panel1ColumnValues.add: cfg.id is required");
    if (this._rows.has(cfg.id)) throw new Error(`Panel1ColumnValues: id "${cfg.id}" already exists`);
    if (!Array.isArray(cfg.values) || cfg.values.length === 0 || cfg.values.length > 3) {
      throw new Error("Panel1ColumnValues.add: cfg.values must be array of 1..3 items");
    }

    // Рендерим ячейки
    const cells = [];
    if (cfg.label !== undefined && cfg.label !== null) {
      cells.push({ kind: "label", el: this._makeLabel(cfg.label) });
    } else {
      // без подписи — но столбец label существует, чтобы грид не «съехал»
      cells.push({ kind: "label", el: this._makeLabel("", true) });
    }

    // до 3 значений, пустые добиваем невидимыми
    // Рендерим ровно столько значений, сколько передали (от 1 до 3)
    for (let i = 0; i < cfg.values.length; i++) {
      const v = cfg.values[i];
      if (v) {
        cells.push({ kind: "value", el: this._makeValue(v) });
      }
    }

    for (const c of cells) this.root.appendChild(c.el);

    const row = {
      id: cfg.id,
      label: cfg.label ?? "",
      cells,
      values: cfg.values,
    };
    this._rows.set(cfg.id, row);

    this._ensureColumns();

    return this;
  }

  /** Удалить строку по id. */
  remove(id) {
    const row = this._rows.get(id);
    if (!row) return false;
    for (const c of row.cells) c.el.remove();
    this._rows.delete(id);
    this._ensureColumns();
    return true;
  }

  has(id) { return this._rows.has(id); }

  // ---------- Изменение значений ----------

  /**
   * Установить значение по индексу.
   * @param {string} id
   * @param {number} index    — 0..2
   * @param {Object} v        — { type, value, decimals?, pad?, suffix? } либо просто number|string
   */
  setValue(id, index, v) {
    const row = this._rows.get(id);
    if (!row) return null;
    if (index < 0 || index > 2) return null;

    const norm = this._normalize(v);
    row.values[index] = norm;

    // ячейка значения в DOM: row.cells[1 + index]
    const cell = row.cells[1 + index];
    if (!cell || cell.kind !== "value") return null;

    if (norm) {
      // заменяем spacer на настоящую ячейку
      const newEl = this._makeValue(norm);
      cell.el.replaceWith(newEl);
      cell.el = newEl;
    } else {
      // значения нет — ставим spacer
      const spacer = this._makeValueSpacer();
      cell.el.replaceWith(spacer);
      cell.el = spacer;
    }
    return norm;
  }

  /** Установить сразу все values для строки. */
  setValues(id, values) {
    const row = this._rows.get(id);
    if (!row) return null;

    for (let i = 0; i < 3; i++) {
      this.setValue(id, i, values[i] ?? null);
    }
    return row.values;
  }

  /** Удобно: число по индексу. */
  setNumber(id, index, value, opts = {}) {
    const row = this._rows.get(id);
    if (!row) return null;
    const prev = row.values[index];
    const format = {
      decimals: opts.decimals ?? prev?.decimals ?? 0,
      pad:      opts.pad      ?? prev?.pad      ?? 0,
      suffix:   opts.suffix   ?? prev?.suffix   ?? "",
    };
    return this.setValue(id, index, { type: "number", value, ...format });
  }

  /** Удобно: строка по индексу. */
  setString(id, index, value) {
    return this.setValue(id, index, { type: "string", value });
  }

  /** Прочитать values строки. */
  get(id) {
    const row = this._rows.get(id);
    return row ? row.values.slice() : null;
  }

  // ---------- Внутреннее ----------

  _ensureColumns() {
    // Считаем максимум столбцов значений среди строк
    let maxValues = 0;
    for (const row of this._rows.values()) {
      if (row.values.length > maxValues) maxValues = row.values.length;
    }
    // label + maxValues value-колонок
    const cols = [];
    cols.push("max-content");           // label
    for (let i = 0; i < Math.max(1, maxValues); i++) cols.push("max-content");
    this.root.style.setProperty("--panel-cols", cols.join(" "));
  }

  _makeLabel(text, hidden = false) {
    const el = document.createElement("div");
    el.className = "panel1col__label";
    el.textContent = text;
    if (hidden) el.style.visibility = "hidden";
    return el;
  }

  _makeValue(v) {
    const el = document.createElement("div");
    el.className = "panel1col__value";
    el.textContent = this._formatValue(v);
    return el;
  }

  _makeValueSpacer() {
    // Пустая ячейка того же размера, чтобы грид не «съезжал»
    const el = document.createElement("div");
    el.className = "panel1col__value";
    el.style.visibility = "hidden";
    el.textContent = "0";
    return el;
  }

  _normalize(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") {
      return { type: "number", value: v, decimals: 0, pad: 0, suffix: "" };
    }
    if (typeof v === "string") {
      return { type: "string", value: v };
    }
    if (typeof v === "object") {
      if (!v.type) v = { ...v, type: typeof v.value === "number" ? "number" : "string" };
      return v;
    }
    return null;
  }

  _formatValue(v) {
      if (v.type === "string") return String(v.value ?? "");

      const decimals = v.decimals ?? 0;
      const pad      = v.pad ?? 0;
      let s = Number(v.value ?? 0).toFixed(decimals);

      if (pad > 0) {
          const neg = s.startsWith("-");
          const [int, frac] = (neg ? s.slice(1) : s).split(".");

          // Целую часть добиваем неразрывными пробелами до pad знаков:
          // ширина колонки фиксирована, ведущие нули не рисуются,
          // кейс «все нули» (value: 0) корректен автоматически.
          s = (neg ? "-" : "") + int.padStart(pad, NBSP) + (frac ? "." + frac : "");
      }

      return s + (v.suffix ?? "");
  }

  // ---------- Управление панелью ----------

  show() { this.root.classList.remove("is-hidden"); }
  hide() { this.root.classList.add   ("is-hidden"); }

  /** Полное удаление из DOM. */
  destroy() {
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
    this._rows.clear();
  }
}

//------------------------|
// Реализация.            |
//------------------------:
function setup_1()
{
    const panel = new Panel1ColumnValues({
        id      : "scores",
        position: "top-left",
        top   : 20,
        left  : 20,
      //colGap:  0,
      //rowGap:  0,
    });

    // ┌────────────┬───────────┐
    // │ Утки       │   000     │
    // ├────────────┼───────────┤
    // │ Кабаны     │   000     │
    // └────────────┴───────────┘

    panel.add({
        id: "ducks",
        label: "Утки",
        values: [
            { type: "number", value: 0, decimals: 0, pad: 3, suffix: "" },
        ],
    });

    panel.add({
        id: "pigs",
        label: "Кабаны",
        values: [
            { type: "number", value: 0, decimals: 0, pad: 3, suffix: "" },
        ],
    });

    /*
    //------|
    // HTML.|
    //------:
    duckPool.onKill = () => {
    score++;
    scoresPanel.setNumber("ducks", 0, score);
    };

    pigPool.onKill = () => {
    scorePig++;
    scoresPanel.setNumber("pigs", 0, scorePig);
    };
    */

    return panel;
}

/**
//------|
// Doc. |
//------:
//------------------------|
// Строки с 3 значениями. |
//------------------------:
┌─────────────────┬────────┬────┬────────┐
│ Выносливость    │  095   │ /  │  100   │
├─────────────────┼────────┼────┼────────┤
│ Утки            │  000   │    │        │
├─────────────────┼────────┼────┼────────┤
│ Кабаны          │  000   │    │        │
└─────────────────┴────────┴────┴────────┘
 panel.add({
  id: "stamina",
  label: "Выносливость",
  values: [
    { type: "number", value: 95,  decimals: 0, pad: 3 },     // 095
    { type: "string", value: "/" },                          // разделитель
    { type: "number", value: 100, decimals: 0, pad: 3 },     // 100
  ],
});

//------------------------|
// Изменение значения.    |
//------------------------:
// Числовое
panel.setNumber("ducks", 0, score);

// Строковое
panel.setString("stamina", 1, "/");

// Через универсальный setValue
panel.setValue("pigs", 0, { type: "number", value: scorePig, decimals: 0, pad: 3 });

// Сразу все три
panel.setValues("stamina", [
  { type: "number", value: player.stamina, decimals: 0, pad: 3 },
  { type: "string", value: "/" },
  { type: "number", value: player.staminaMax, decimals: 0, pad: 3 },
]);

//------------------------|
// Подключение в HTML.    |
//------------------------:
<link rel="stylesheet" href="bs-js/ui/panel-values.css" />
*/

// --------------------------------------------------------
// CLASS: Panel1ColumnValuesBtn — расширение с кнопками
// --------------------------------------------------------
class Panel1ColumnValuesBtn extends Panel1ColumnValues {
  /**
   * Добавить строку с кнопками-действиями.
   * 
   * @param {Object} cfg
   * @param {string} cfg.id              — id строки
   * @param {string} [cfg.label]         — подпись слева
   * @param {Array<Object>} cfg.values   — значения (числа/строки), как в базовом классе
   * @param {Array<Object>} [cfg.actions] — массив кнопок. Каждая:
   *        {
   *          id: "btn_use",         // id кнопки (для поиска)
   *          text: "ИСПОЛЬЗОВАТЬ",  // текст на кнопке
   *          onClick: () => { ... } // колбэк при клике
   *        }
   * 
   * Кнопки будут добавлены в конец строки (справа).
   * Вы можете комбинировать values и actions.
   */

  constructor(opts = {}) {
    super(opts);
    // Добавляем тот же неоновый стиль, что и у базовой панели
    this.root.style.setProperty("--panel-cols", "minmax(0, 1fr)");
  //this.root.classList.add("panel1col-btn");
  }

  addAction(cfg) {
    if (!cfg || !cfg.id) throw new Error("cfg.id required");

    const cells = [];

    // 1. Метка — только если реально передана (без скрытого спайсера!)
    if (cfg.label !== undefined && cfg.label !== null) {
      cells.push({ kind: "label", el: this._makeLabel(cfg.label) });
    }

    // 2. Значения (если есть)
    if (Array.isArray(cfg.values)) {
      for (let i = 0; i < cfg.values.length; i++) {
        cells.push({ kind: "value", el: this._makeValue(this._normalize(cfg.values[i])) });
      }
    }

    // 3. Кнопки
    if (cfg.actions && cfg.actions.length > 0) {
      const actionCell = document.createElement("div");
      actionCell.className = "panel1col__actions";

      for (let i = 0; i < cfg.actions.length; i++) {
        const act = cfg.actions[i];
        const btn = document.createElement("button");
        btn.className = "panel1col__btn " + (act.className || "");
        btn.textContent = act.text || "OK";
        btn.type = "button";
        if (typeof act.onClick === "function") {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            act.onClick(e);
          });
        }
        actionCell.appendChild(btn);
      }
      cells.push({ kind: "action", el: actionCell });
    }

    // 4. В DOM
    for (const c of cells) this.root.appendChild(c.el);

    // 5. Сохраняем
    const row = {
      id: cfg.id,
      label: cfg.label ?? "",
      cells,
      values: cfg.values || [],
    };
    this._rows.set(cfg.id, row);

    // 6. Одна колонка на всю ширину панели (если нет label/values)
    const hasOnlyActions = cells.length === 1 && cells[0].kind === "action";
    if (hasOnlyActions) {
      this.root.style.setProperty("--panel-cols", "1fr");
    } else {
      this._ensureColumns();
    }

    return this;
  }

  /**
   * Создать неоновую плашку справки по горячим клавишам.
   * @param {Array<{key: string, desc: string}>} rows
   * @returns {{overlay: HTMLElement, open: Function, close: Function, toggle: Function}}
   */
  createHelpOverlay(rows) {
    const overlay = document.createElement("div");
    overlay.className = "help-overlay";
    overlay.hidden = true;

    const panel = document.createElement("div");
    panel.className = "help-panel";

    const title = document.createElement("h2");
    title.textContent = "Горячие клавиши";
    panel.appendChild(title);

    const list = document.createElement("div");
    list.className = "help-panel__row";
    for (const r of rows) {
      const k = document.createElement("span");
      k.className = "help-panel__key";
      k.textContent = r.key;
      const d = document.createElement("span");
      d.className = "help-panel__desc";
      d.textContent = r.desc;
      list.appendChild(k);
      list.appendChild(d);
    }
    panel.appendChild(list);

    const closeBtn = document.createElement("button");
    closeBtn.className = "help-panel__close";
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Закрыть");
    panel.appendChild(closeBtn);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const open  = () => { overlay.hidden = false; };
    const close = () => { overlay.hidden = true;  };
    const toggle = () => { overlay.hidden = !overlay.hidden; };

    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    return { overlay, open, close, toggle };
  }
}

//------------------------|
// Реализация.            |
//------------------------:
function setup_2() {
  const topBarPanel = new PANELVALUES.Panel1ColumnValuesBtn({
    id: "top-menu",
    position: "top-right",
    top: 16,
    right: 20,
    width: 220,
    colGap: 8,
  });

  // Плашка справки (создаём заранее, чтобы кнопка могла её дёргать)
  const help = topBarPanel.createHelpOverlay([
    { key: "W A S D",  desc: "Движение" },
    { key: "Shift",    desc: "Бег" },
    { key: "ЛКМ",      desc: "Выстрел" },
    { key: "Ctrl",     desc: "Показать/скрыть курсор" },
    { key: "F1",       desc: "Справка (эта плашка)" },
    { key: "F4",       desc: "Отладка: позиция и поворот" },
    { key: "Esc",      desc: "Закрыть панель ружья" },
  ]);

  topBarPanel.addAction({
    id: "menu-row",
    actions: [
      {
        id: "f1-btn",
        text: "F1",
        className: "btn-f1",
        onClick: () => help.toggle(),
      },
      {
        id: "gun-btn",
        text: "💥 РУЖЬЁ",
        className: "btn-gun",
        onClick: () => {
          if (window.openGunPanel) window.openGunPanel();
        },
      },
      {
        id: "exit-btn",
        text: "🪜",
        className: "btn-exit",
        onClick: () => {
          window.location.href = "./i-bs.html";
        },
      },
    ],
  });
  

  // Клавиша F1 тоже открывает/закрывает справку
  window.addEventListener("keydown", (e) => {
    if (e.code === "F1") {
      e.preventDefault();
      help.toggle();
    }
    else
    if (e.code === "Escape" && !help.overlay.hidden) {
      help.close();
    }
  });

  return topBarPanel;
}

//------------------------|
// Вся реализация.        |
//------------------------:
function      setup  ()
{   const r = setup_1();
              setup_2();
  return  r;
}

//------------------------|
// Экспорт.               |
//------------------------:
const PANELVALUES =
{   setup,
    Panel1ColumnValues,
    Panel1ColumnValuesBtn,
};
export { PANELVALUES }; // import { PANELVALUES } from "src/ui/panel-values.js";
