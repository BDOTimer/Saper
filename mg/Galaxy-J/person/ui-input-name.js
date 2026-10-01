/// ui-input-name.js
/// Отвечает за ввод пользователем его имени.
/// Используется в модуле g-menu.html
/// Объект хранит текущее имя игрока внутри localStorage.
/// После ввода нового имени старое остаётся в localStorage (в HeroesList).
/// ---
/// Графика:
///     - рисуется окно ввода.
///     - над окном вывода выводится текущее действительное имя.
///     - рядом внизу с окном ввода рисуется кнопочка "применить".
///     - ширина кнопки и окна ввода совпадают.
///     - данный ввод находится справа вверху окна g-menu.html.
///     - стиль соответствует стилю g-menu.html.
/// ---
/// Поведение:
///     - наличие фокуса ВВОДа.
///     - при фокусе на ВВОД ИМЯ в окне ВВОДа должно подсвечиваться ярче.
///     - при потере фокуса ИМЯ в окне ВВОДа должно восстанавливаться
///       текущим именем.
///     - текущее ИМЯ должно подсвечиваться ярче чем ИМЯ в окне ВВОДа.
///     - текущее ИМЯ должно иметь анимированную пульсирующую ауру.
///     - при клике на ПРИМЕНИТЬ генерируется событие "player-name-changed"
///       на window, в detail.name передаётся новое имя игрока.
///     - всегда гарантируется, что в localStorage существует текущее имя!

class UIInputName
{
    // ---------- Ключи localStorage ----------
    static KEY_CURRENT = "galaxy.player.name";

    // ---------- Значение по умолчанию ----------
    namePlayer = "Анонимус-1917";

    // ---------- DOM-ссылки ----------
    _root        = null;
    _titleEl     = null;
    _titleTextEl = null;   // <-- FIX: внутренний span (ellipsis), текст живёт здесь
    _inputEl     = null;
    _buttonEl    = null;

    // ---------- id стиля анимации ауры (для destroy) ----------
    _auraStyleEl = null;

    // =========================================================
    //  КОНСТРУКТОР
    // =========================================================
    constructor(options = {})
    {
        this._parent      = options.parent      || document.body;
        this._offsetTop   = options.offsetTop   ?? 12;
        this._offsetRight = options.offsetRight ?? 12;

        this._loadFromStorage();
        this._injectAuraStyles();
        this._buildUI();
        this._bindEvents();
    }

    // =========================================================
    //  ПУБЛИЧНОЕ API
    // =========================================================

    getName()
    {
        return this.namePlayer;
    }

    setName(name, { silent = false } = {})
    {
        if (typeof name !== "string") return;
        const trimmed = name.trim();
        if (!trimmed) return;

        this.namePlayer = trimmed;
        this._saveCurrent();

        if (this._inputEl) this._inputEl.value = trimmed;
        if (!silent) this._render();
    }

    destroy()
    {
        if (this._root && this._root.parentNode) {
            this._root.parentNode.removeChild(this._root);
        }
        if (this._auraStyleEl && this._auraStyleEl.parentNode) {
            this._auraStyleEl.parentNode.removeChild(this._auraStyleEl);
        }
        this._root        = null;
        this._titleTextEl = null;   // <-- FIX
        this._auraStyleEl = null;
    }

    // =========================================================
    //  ВНУТРЕННЕЕ — localStorage
    // =========================================================
    _loadFromStorage()
    {
        try {
            const saved = localStorage.getItem(UIInputName.KEY_CURRENT);
            if (saved && saved.trim()) {
                this.namePlayer = saved;
            }
            else
            {   // первый запуск — зафиксируем дефолт в хранилище
                this._saveCurrent();
            }
        } catch (e) { /* ignore */ }
    }

    _saveCurrent()
    {
        try {
            localStorage.setItem(UIInputName.KEY_CURRENT, this.namePlayer);
        } catch (e) { /* ignore */ }
    }

    // =========================================================
    //  ВНУТРЕННЕЕ — стили
    // =========================================================

    /**
     * FIX: анимируем filter: drop-shadow(...), а НЕ text-shadow.
     * text-shadow обрезается собственным overflow:hidden заголовка,
     * drop-shadow накладывается на уже отрисованный результат и не обрезается.
     */
    _injectAuraStyles()
    {
        const STYLE_ID = "ui-input-name-aura-styles";
        if (document.getElementById(STYLE_ID)) {
            this._auraStyleEl = document.getElementById(STYLE_ID);
            return;
        }

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            @keyframes ui-input-name-aura {
                0%, 100% {
                    filter:
                        drop-shadow(0 0 1px  rgba(0,255,216,0.60))
                        drop-shadow(0 0 4px  rgba(9,255,120,0.40))
                        drop-shadow(0 0 10px rgba(0,255,0,0.20));
                    transform: scale(1);
                }
                50% {
                    filter:
                        drop-shadow(0 0 3px  rgba(255,9,9,1))
                        drop-shadow(0 0 10px rgba(216,9,9,1))
                        drop-shadow(0 0 24px rgba(200,9,9,0.85));
                    transform: scale(1.01);
                }
            }
        `;
        document.head.appendChild(style);
        this._auraStyleEl = style;
    }

    // =========================================================
    //  ВНУТРЕННЕЕ — UI
    // =========================================================
    _buildUI()
    {
        // --- корневой контейнер ---
        const root = document.createElement("div");
        root.className = "ui-input-name";
        Object.assign(root.style, {
            position:        "fixed",
            top:             this._offsetTop + "px",
            right:           this._offsetRight + "px",
            zIndex:          "30",
            width:           "min(260px, 68vw)",
            display:         "flex",
            flexDirection:   "column",
            gap:             "6px",
            fontFamily:      '"Courier New", monospace',
            letterSpacing:   "1.5px",
            userSelect:      "none"
        });

        // ---------- Заголовок «текущее имя» ----------
        // FIX: обёртка несёт ауру (filter). ЗДЕСЬ НЕТ overflow:hidden —
        // иначе он срезал бы свечение.
        const title = document.createElement("div");
        title.className = "ui-input-name__title";
        Object.assign(title.style, {
            color:        "#f4ffe8",
            fontSize:     "clamp(11px, 2.6vw, 13px)",
            fontWeight:   "bold",
            textAlign:    "left",
            padding:      "2px 4px",

            // статичная аура (пока анимация не стартовала / fallback)
            filter:       "drop-shadow(0 0 2px rgba(216,255,216,0.9)) " +
                          "drop-shadow(0 0 6px rgba(168,255,120,0.8)) " +
                          "drop-shadow(0 0 14px rgba(168,255,120,0.45))",
            willChange:   "filter",

            // пульсирующая аура
            animation:    "ui-input-name-aura 2.2s ease-in-out infinite"
        });

        // FIX: внутренний span обрезает ТОЛЬКО текст (ellipsis).
        // filter не наследуется, поэтому свечение живёт на обёртке
        // и не попадает под clipping span'а.
        const titleText = document.createElement("span");
        titleText.className = "ui-input-name__title-text";
        Object.assign(titleText.style, {
            display:      "block",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            whiteSpace:   "nowrap"
        });
        title.appendChild(titleText);

        // ---------- Поле ввода ----------
        const input = document.createElement("input");
        input.className = "ui-input-name__field";
        input.type = "text";
        input.maxLength = 24;
        input.spellcheck = false;
        input.autocomplete = "off";
        input.value = this.namePlayer;

        Object.assign(input.style, {
            width:           "100%",
            boxSizing:       "border-box",
            background:      "rgba(168, 255, 120, 0.08)",
            border:          "2px solid #7fbf5f",
            borderRadius:    "10px",
            color:           "#cfe6b8",
            fontFamily:      '"Courier New", monospace',
            fontSize:        "clamp(12px, 3vw, 15px)",
            fontWeight:      "bold",
            letterSpacing:   "2px",
            padding:         "8px 12px",
            outline:         "none",
            boxShadow:       "0 0 6px rgba(168,255,120,0.18) inset",
            transition:      "box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease, color 0.2s ease"
        });

        // ---------- Кнопка "применить" ----------
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ui-input-name__btn";
        button.textContent = "ПРИМЕНИТЬ";
        Object.assign(button.style, {
            width:           "100%",
            boxSizing:       "border-box",
            background:      "rgba(168, 255, 120, 0.15)",
            border:          "2px solid #a8ff78",
            color:           "#a8ff78",
            borderRadius:    "10px",
            fontFamily:      '"Courier New", monospace',
            fontWeight:      "bold",
            letterSpacing:   "2px",
            cursor:          "pointer",
            padding:         "7px 12px",
            fontSize:        "clamp(11px, 2.6vw, 13px)",
            transition:      "all 0.2s ease",
            boxShadow:       "0 0 12px rgba(168,255,120,0.4)"
        });

        button.addEventListener("mouseenter", () => {
            button.style.background = "rgba(168,255,120,0.28)";
            button.style.color = "#f4ffe8";
            button.style.boxShadow = "0 0 20px rgba(168,255,120,0.7)";
        });
        button.addEventListener("mouseleave", () => {
            button.style.background = "rgba(168,255,120,0.15)";
            button.style.color = "#a8ff78";
            button.style.boxShadow = "0 0 12px rgba(168,255,120,0.4)";
        });
        button.addEventListener("mousedown", () => {
            button.style.background = "rgba(168,255,120,0.55)";
            button.style.color = "#0a140a";
            button.style.boxShadow = "0 0 26px rgba(168,255,120,0.9)";
        });
        button.addEventListener("mouseup", () => {
            button.style.background = "rgba(168,255,120,0.28)";
            button.style.color = "#f4ffe8";
            button.style.boxShadow = "0 0 20px rgba(168,255,120,0.7)";
        });

        // ---------- Собираем ----------
        root.appendChild(title);
        root.appendChild(input);
        root.appendChild(button);
        this._parent.appendChild(root);

        this._root        = root;
        this._titleEl     = title;
        this._titleTextEl = titleText;   // <-- FIX
        this._inputEl     = input;
        this._buttonEl    = button;

        this._setInputBlurred();
        this._render();
    }

    // ---------- Стиль поля ввода В ФОКУСЕ ----------
    _setInputFocused()
    {
        const input = this._inputEl;
        if (!input) return;

        input.style.background  = "rgba(200, 255, 160, 0.22)";
        input.style.borderColor = "#eaffd0";
        input.style.color       = "#ffffff";
        input.style.boxShadow   =
            "0 0 14px rgba(200,255,160,0.85) inset, " +
            "0 0 22px rgba(168,255,120,0.9), " +
            "0 0 40px rgba(168,255,120,0.5)";
    }

    // ---------- Стиль поля ввода БЕЗ ФОКУСА ----------
    _setInputBlurred()
    {
        const input = this._inputEl;
        if (!input) return;

        input.style.background  = "rgba(168, 255, 120, 0.08)";
        input.style.borderColor = "#7fbf5f";
        input.style.color       = "#506040";
        input.style.boxShadow   = "0 0 6px rgba(168,255,120,0.18) inset";
    }

    /** Обновляет заголовок «текущее имя». */
    _render()
    {
        // FIX: пишем текст в span, а не в обёртку
        // (textContent на обёртке уничтожил бы span с ellipsis)
        if (this._titleTextEl) {
            this._titleTextEl.textContent = "ПИЛОТ: " + this.namePlayer;
        }
        if (this._titleEl) {
            this._titleEl.title = this.namePlayer;
        }
        if (this._inputEl && document.activeElement !== this._inputEl) {
            this._inputEl.value = this.namePlayer;
        }
    }

    // =========================================================
    //  ВНУТРЕННЕЕ — события
    // =========================================================
    _bindEvents()
    {
        this._inputEl.addEventListener("focus", () => {
            this._setInputFocused();
        });

        this._inputEl.addEventListener("blur", () => {
            this._inputEl.value = this.namePlayer;
            this._setInputBlurred();
        });

        this._buttonEl.addEventListener("mousedown", (e) => {
            e.preventDefault();
        });

        this._buttonEl.addEventListener("click", (e) => {
            e.preventDefault();
            this._applyFromInput();
            this._inputEl.blur(); // <-- снять фокус после применения
        });

        this._inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this._applyFromInput();
                this._inputEl.blur();
            } else if (e.key === "Escape") {
                this._inputEl.value = this.namePlayer;
                this._inputEl.blur();
            }
        });
    }

    /** Прочитать значение из input, применить и вызвать коллбэк. */
    _applyFromInput()
    {
        if (!this._inputEl) return;

        const next = (this._inputEl.value || "").trim();
        if (!next) {
            this._inputEl.value = this.namePlayer;
            return;
        }

        if (next === this.namePlayer) {
            this._render();
            return;
        }

        this.namePlayer = next;
        this._saveCurrent();
        this._render();

        // --- оповещаем подписчиков о новом имени игрока ---
        try {
            window.dispatchEvent(new CustomEvent("player-name-changed", {
                detail: { name: this.namePlayer }
            }));
        } catch (e){ /* ignore */ }
    }
}

// -----------------------------------------|
//  Экспорт ...
// -----------------------------------------:
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = UIInputName;
} else {
    window.UIInputName = UIInputName;
}