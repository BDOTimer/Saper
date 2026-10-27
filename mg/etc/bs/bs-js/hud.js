//  hud.js
//  class IndicatorPanel — HUD-панель с горизонтальными индикаторами (столбиком).

class IndicatorPanel {
  /**
   * @param {Object}  [opts]
   * @param {string}  [opts.id="indicator-panel"]  — DOM id контейнера
   * @param {string}  [opts.position="top-left"]   — "top-left" | "top-right" | "bottom-left" | "bottom-right"
   * @param {number}  [opts.width=220]             — ширина панели в px
   * @param {number}  [opts.gap=6]                 — вертикальный отступ между индикаторами
   * @param {string}  [opts.fontFamily='"Courier New", monospace']
   * @param {string}  [opts.background="rgba(0,0,0,0.45)"]
   * @param {string}  [opts.borderColor="#0ff"]
   * @param {string}  [opts.textColor="#fff"]
   * @param {boolean} [opts.showValue=true]        — показывать число «N / max»
   * @param {boolean} [opts.animate=true]          — плавно анимировать ширину/цвет
   */
  constructor(opts = {}) {
    
    this.top    = opts.top;
    this.right  = opts.right;
  //this.bottom = opts.bottom;
    this.left   = opts.left;
    
    this.id            = opts.id            ?? "indicator-panel";
    this.position      = opts.position      ?? "top-left";
    this.width         = opts.width         ?? 220;
    this.gap           = opts.gap           ?? 6;
    this.fontFamily    = opts.fontFamily    ?? '"Courier New", ui-monospace, Menlo, Consolas, monospace';
    this.background    = opts.background    ?? "rgba(0,0,0,0.45)";
    this.borderColor   = opts.borderColor   ?? "#0ff";
    this.textColor     = opts.textColor     ?? "#fff";
    this.showValue     = opts.showValue     ?? true;
    this.animate       = opts.animate       ?? true;

    /** @type {Map<string, Object>} id → описание индикатора */
    this._items = new Map();

    this._buildRoot();
  }

  // ---------- Построение корня ----------

  _buildRoot() {
    const root = document.createElement("div");
    root.id = this.id;
    root.className = "indicator-panel";

    Object.assign(root.style, {
      position:         "fixed",
      zIndex:           "15",
      width:            this.width + "px",
      display:          "flex",
      flexDirection:    "column",
      gap:              this.gap + "px",
      padding:          "10px",
      background:       this.background,
      border:           `1px solid ${this.borderColor}`,
      borderRadius:     "12px",
      boxShadow:        `0 0 12px ${this.borderColor}55`,
      fontFamily:       this.fontFamily,
      fontSize:         "12px",
      color:            this.textColor,
      pointerEvents:    "none",
      userSelect:       "none",
      backdropFilter:   "blur(3px)",
      transition:       this.animate ? "opacity 0.2s ease" : "none",
    });

    // Позиционирование
    const pos = this.position;
    const off = "20px";
    if (pos === "top-left")     { root.style.top    = off; root.style.left  = off; }
    if (pos === "top-right")    { root.style.top    = off; root.style.right = off; }
    if (pos === "bottom-left")  { root.style.bottom = off; root.style.left  = off; }
    if (pos === "bottom-right") { root.style.bottom = off; root.style.right = off; }

    //if (this.top    !== undefined) this.root.style.top    = typeof this.top    === "number" ? this.top    + "px" : this.top;
    if (this.right  !== undefined) this.root.style.right  = typeof this.right  === "number" ? this.right  + "px" : this.right;
    if (this.bottom !== undefined) this.root.style.bottom = typeof this.bottom === "number" ? this.bottom + "px" : this.bottom;
    if (this.left   !== undefined) this.root.style.left   = typeof this.left   === "number" ? this.left   + "px" : this.left;

    document.body.appendChild(root);
    this.root = root;
  }

  // ---------- Добавление/удаление индикаторов ----------

  /**
   * Добавить индикатор.
   *
   * @param {Object} cfg
   * @param {string} cfg.id        — уникальный идентификатор
   * @param {string} [cfg.label]   — подпись (по умолчанию = id)
   * @param {number} [cfg.min=0]
   * @param {number} [cfg.max=100]
   * @param {number} [cfg.value=0]
   * @param {Array<{t:number, color:string}>} [cfg.stops] — цветовые пороги (t — доля 0..1, color — CSS-цвет)
   *        Пример: [{ t: 0.0, color:"#ff3b30" }, { t: 0.5, color:"#ffcc00" }, { t: 1.0, color:"#34c759" }]
   * @param {string} [cfg.trackColor="rgba(255,255,255,0.12)"] — фон полоски
   */
  add(cfg) {
    if (!cfg || !cfg.id) throw new Error("IndicatorPanel.add: cfg.id is required");
    if (this._items.has(cfg.id)) throw new Error(`IndicatorPanel: id "${cfg.id}" already exists`);

    const min   = cfg.min   ?? 0;
    const max   = cfg.max   ?? 100;
    const value = this._clamp(cfg.value ?? 0, min, max);
    const label = cfg.label ?? cfg.id;

    const stops = cfg.stops ?? [
      { t: 0.0, color: "#ff3b30" },
      { t: 0.5, color: "#ffcc00" },
      { t: 1.0, color: "#34c759" },
    ];

    // --- строка индикатора ---
    const row = document.createElement("div");
    Object.assign(row.style, {
      display:       "flex",
      flexDirection: "column",
      gap:           "2px",
    });

    // заголовок: подпись + текущее значение
    const head = document.createElement("div");
    Object.assign(head.style, {
      display:        "flex",
      justifyContent: "space-between",
      alignItems:     "center",
      fontSize:       "11px",
      letterSpacing:  "0.5px",
      opacity:        "0.9",
    });

    const labelEl = document.createElement("span");
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.textContent = `${this._fmt(value, min, max)}`;
    if (!this.showValue) valueEl.style.display = "none";

    head.appendChild(labelEl);
    head.appendChild(valueEl);

    // трек (фон) + заполнение
    const track = document.createElement("div");
    Object.assign(track.style, {
      position:     "relative",
      width:        "100%",
      height:       "8px",
      borderRadius: "4px",
      background:   cfg.trackColor ?? "rgba(255,255,255,0.12)",
      overflow:     "hidden",
    });

    const fill = document.createElement("div");
    Object.assign(fill.style, {
      position:     "absolute",
      left:         "0",
      top:          "0",
      bottom:       "0",
      width:        "0%",
      borderRadius: "4px",
      background:   stops[0].color,
      transition:   this.animate ? "width 0.15s ease, background-color 0.2s ease" : "none",
    });

    track.appendChild(fill);
    row.appendChild(head);
    row.appendChild(track);
    this.root.appendChild(row);

    // сохранить всё
    const item = {
      id: cfg.id,
      label,
      min, max,
      value,
      stops,
      labelEl,
      valueEl,
      fill,
      row,
    };
    this._items.set(cfg.id, item);

    this._refresh(item);

    return this;   // chainable
  }

  /** Удалить индикатор по id. */
  remove(id) {
    const it = this._items.get(id);
    if (!it) return false;
    it.row.remove();
    this._items.delete(id);
    return true;
  }

  /** Есть ли такой индикатор. */
  has(id) {
    return this._items.has(id);
  }

  // ---------- Изменение значений ----------

  /**
   * Прибавить delta к значению индикатора (с зажимом в [min, max]).
   * Возвращает новое значение (или null, если id не найден).
   *
   * @param {string} id
   * @param {number} delta
   * @returns {number|null}
   */
  change(id, delta) {
    const it = this._items.get(id);
    if (!it) return null;

    it.value = this._clamp(it.value + delta, it.min, it.max);
    this._refresh(it);
    return it.value;
  }

  /** Установить значение (с зажимом). */
  set(id, value) {
    const it = this._items.get(id);
    if (!it) return null;

    it.value = this._clamp(value, it.min, it.max);
    this._refresh(it);
    return it.value;
  }

  /** Установить min/max «на лету». */
  setRange(id, min, max) {
    const it = this._items.get(id);
    if (!it) return null;

    it.min = min;
    it.max = max;
    it.value = this._clamp(it.value, min, max);
    this._refresh(it);
    return it.value;
  }

  /** Получить текущее значение. */
  get(id) {
    const it = this._items.get(id);
    return it ? it.value : null;
  }

  /** Сбросить значение в 0 (или в указанное). */
  reset(id, value = 0) {
    return this.set(id, value);
  }

  // ---------- Внутреннее ----------

  _clamp(v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  _fmt(v, min, max) {
    // Если дробное — один знак после запятой, если целое — без
    const rounded = Math.round(v * 10) / 10;
    const text = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(0);
    return `${text} / ${max}`;
  }

  _colorFor(t, stops) {
    // stops отсортированы по t; берём кусочек между соседними и линейно интерполируем
    if (t <= stops[0].t) return stops[0].color;
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1];
      const b = stops[i];
      if (t <= b.t) {
        const k = (t - a.t) / (b.t - a.t || 1);
        return this._lerpColor(a.color, b.color, k);
      }
    }
    return stops[stops.length - 1].color;
  }

  _lerpColor(c1, c2, k) {
    const a = this._parseColor(c1);
    const b = this._parseColor(c2);
    if (!a || !b) return c1;
    const r = Math.round(a.r + (b.r - a.r) * k);
    const g = Math.round(a.g + (b.g - a.g) * k);
    const bl = Math.round(a.b + (b.b - a.b) * k);
    return `rgb(${r},${g},${bl})`;
  }

  _parseColor(c) {
    // #rgb, #rrggbb, rgb(r,g,b) — минимально достаточно
    if (typeof c !== "string") return null;
    c = c.trim();
    if (c.startsWith("#")) {
      let h = c.slice(1);
      if (h.length === 3) h = h.split("").map(x => x + x).join("");
      const n = parseInt(h, 16);
      if (isNaN(n)) return null;
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(",").map(s => parseInt(s, 10));
      if (p.length >= 3) return { r: p[0], g: p[1], b: p[2] };
    }
    return null;
  }

  _refresh(it) {
    const t = (it.value - it.min) / (it.max - it.min || 1);
    const pct = Math.max(0, Math.min(1, t)) * 100;

    it.fill.style.width = pct + "%";
    it.fill.style.backgroundColor = this._colorFor(t, it.stops);
    it.valueEl.textContent = this._fmt(it.value, it.min, it.max);
  }

  // ---------- Управление панелью ----------

  show() { this.root.style.display = "flex"; }
  hide() { this.root.style.display = "none"; }

  /** Полное удаление из DOM. */
  destroy() {
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
    this._items.clear();
  }
}

function setup()
{
    // ===== HUD: панель индикаторов =====
    const hud = new IndicatorPanel({
        id: "hud-main",
        position: "top-right",  // или "bottom-left" и т.д.
        top  : 80,              // ← отступ сверху — под кнопкой
        width: 220,
        gap  : 8,
        showValue: true,
        animate: true,
    });

    // сдвинуть вручную
    hud.root.style.top   = "80px";
    hud.root.style.right = "20px";

    // Здоровье — от 0 до 100, цвет: красный → жёлтый → зелёный
    hud.add({
        id: "hp",
        label: "Здоровье",
        min: 0,
        max: 100,
        value: 100,
        stops: [
            { t: 0.0, color: "#ff3b30" },
            { t: 0.5, color: "#ffcc00" },
            { t: 1.0, color: "#219b3f" },
        ],
    });

    // Выносливость — от 0 до 100, цвет: синий → синий → синий
    hud.add({
        id: "st",
        label: "Выносливость",
        min: 0,
        max: 100,
        value: 100,
        stops: [
            { t: 0.0, color: "#15a2e9c0" },
            { t: 0.5, color: "#015afef8" },
            { t: 1.0, color: "rgba(11, 66, 170, 0.94)" },
        ],
    });

    // Голод — наоборот: красный когда голоден (max), зелёный — сыт (min)
    hud.add({
        id: "hunger",
        label: "Голод",
        min: 0,
        max: 100,
        value: 0,
        stops: [
            { t: 0.0, color: "#34c759" },
            { t: 0.6, color: "#ffcc00" },
            { t: 1.0, color: "#ff3b30" },
        ],
    });

    // Патроны — от 0 до 20, синий → фиолетовый
    hud.add({
        id: "ammo",
        label: "Патроны",
        min: 0,
        max: 20,
        value: 20,
        stops: [
            { t: 0.0, color: "#888888" },
            { t: 0.3, color: "#0af" },
            { t: 1.0, color: "#a0f" },
        ],
    });

    // Прогресс миссии — 0..5
    hud.add({
        id: "ducks",
        label: "Миссия: утки",
        min: 0,
        max: 5,
        value: 0,
        stops: [
            { t: 0.0, color: "#555" },
            { t: 1.0, color: "#0ff" },
        ],
    });

    return hud;
}

const HUD =
{   setup,
    IndicatorPanel,
};

export { HUD }; // import { HUD } from "src/hud.js";