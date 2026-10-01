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
///     - при фокусе на ВВОД ИМЯ в окне ВВОДа должно подсвечиваться ярече.
///     - при потери фокуса ИМЯ в окне ВВОДа должно восстонавливаться 
///       текущим именем. 
///     - текущее ИМЯ должно подсвечиваться ярче чем ИМЯ в окне ВВОДа.
///     - текущее ИМЯ должно иметь анимированную пульсирующую ауру.
///     - при клике на ПРИМЕНИТЬ должен вызваться коллбэк из  g-menu.html
///     - в коллбек передаётся новое ИМЯ ИГРОКА.
///     - UIInputName инициализируется коллбэком в конструкторе.

class UIInputName
{
    // ---------- Ключи localStorage ----------
    static KEY_CURRENT = "galaxy.player.name";

    // ---------- Значение по умолчанию ----------
    namePlayer = "Анонимус-1917";

    // ---------- Коллбэк, приходящий снаружи ----------
    _onApply = null;

    // ---------- DOM-ссылки ----------
    _root     = null;
    _titleEl  = null;
    _inputEl  = null;
    _buttonEl = null;

    // ---------- id анимации ауры (для destroy) ----------
    _auraStyleEl = null;

    // =========================================================
    //  КОНСТРУКТОР
    //  options = {
    //      parent, offsetTop, offsetRight,
    //      onApply: function(newName) { ... }   // <-- новый параметр
    //  }
    // =========================================================
    constructor(options = {})
    {
        this._parent      = options.parent      || document.body;
        this._offsetTop   = options.offsetTop   ?? 12;
        this._offsetRight = options.offsetRight ?? 12;

        // --- сохранить коллбэк, если он передан ---
        if (typeof options.onApply === "function") {
            this._onApply = options.onApply;
        }

        // --- прочитать сохранённое имя ---
        this._loadFromStorage();

        // --- один раз внедряем keyframes для ауры ---
        this._injectAuraStyles();

        // --- построить интерфейс ---
        this._buildUI();

        // --- навесить события ---
        this._bindEvents();
    }

    // =========================================================
    //  ПУБЛИЧНОЕ API
    // =========================================================

    /** Вернуть текущее имя игрока. */
    getName()
    {
        return this.namePlayer;
    }

    /** Установить имя программно (без записи в историю). */
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

    /** Установить коллбэк «на лету». */
    setOnApply(fn)
    {
        this._onApply = (typeof fn === "function") ? fn : null;
    }

    /** Полностью удалить UI со страницы. */
    destroy()
    {
        if (this._root && this._root.parentNode) {
            this._root.parentNode.removeChild(this._root);
        }
        if (this._auraStyleEl && this._auraStyleEl.parentNode) {
            this._auraStyleEl.parentNode.removeChild(this._auraStyleEl);
        }
        this._root = null;
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
        } catch (e) { /* ignore */ }
    }

    _saveCurrent()
    {
        try {
            localStorage.setItem(UIInputName.KEY_CURRENT, this.namePlayer);
        } catch (e) { /* ignore */ }
    }

    /** Старое имя уходит в историю, не удаляя текущее. */
    // _pushHistory(name)
    // {
    //     if (!name || !name.trim()) return;
    //     try {
    //         const raw = localStorage.getItem(UIInputName.KEY_HISTORY);
    //         const arr = raw ? JSON.parse(raw) : [];
    //         arr.push({
    //             name: name.trim(),
    //             date: new Date().toISOString()
    //         });
    //         while (arr.length > 100) arr.shift();
    //         localStorage.setItem(UIInputName.KEY_HISTORY, JSON.stringify(arr));
    //     } catch (e) { /* ignore */ }
    // }

    // =========================================================
    //  ВНУТРЕННЕЕ — стили
    // =========================================================

    /** Один раз добавляет @keyframes для пульсирующей ауры заголовка. */
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
                    text-shadow:
                        0 0 6px  #d8ffd8,
                        0 0 12px #a8ff78,
                        0 0 22px rgba(168, 255, 120, 0.75),
                        0 0 38px rgba(168, 255, 120, 0.45);
                }
                50% {
                    text-shadow:
                        0 0 10px #ffffff,
                        0 0 20px #d8ffd8,
                        0 0 34px rgba(168, 255, 120, 0.95),
                        0 0 60px rgba(168, 255, 120, 0.60);
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
        //   Ярче, чем поле ввода. Пульсирующая аура.
        const title = document.createElement("div");
        title.className = "ui-input-name__title";
        Object.assign(title.style, {
            color:           "#f4ffe8",              // ярче, чем #eaffd0
            fontSize:        "clamp(11px, 2.6vw, 13px)",
            fontWeight:      "bold",
            textAlign:       "left",
            padding:         "0 4px",
            whiteSpace:      "nowrap",
            overflow:        "hidden",
            textOverflow:    "ellipsis",
            // пульсирующая аура
            animation:       "ui-input-name-aura 2.2s ease-in-out infinite"
        });

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
            background:      "rgba(168, 255, 120, 0.08)",  // базовый фон — ТУСКЛЕЕ
            border:          "2px solid #7fbf5f",          // базовый бордер — ТУСКЛЕЕ
            borderRadius:    "10px",
            color:           "#cfe6b8",                    // текст — ТУСКЛЕЕ текущего имени
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

        this._root     = root;
        this._titleEl  = title;
        this._inputEl  = input;
        this._buttonEl = button;

        // ---------- Базовое состояние input (без фокуса) ----------
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
        input.style.color       = "#777777"; // <-- ВНЕ ФОКУСА
        input.style.boxShadow   = "0 0 6px rgba(168,255,120,0.18) inset";
    }

    /** Обновляет заголовок «текущее имя». */
    _render()
    {
        if (this._titleEl) {
            this._titleEl.textContent = "ПИЛОТ: " + this.namePlayer;
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
        // --- фокус на поле ввода ---
        this._inputEl.addEventListener("focus", () => {
            this._setInputFocused();
        });

        // --- потеря фокуса: вернуть текущее имя и потушить стиль ---
        this._inputEl.addEventListener("blur", () => {
            this._inputEl.value = this.namePlayer;  // откат
            this._setInputBlurred();
        });

        // --- не даём input потерять фокус при mousedown на кнопке ---
        this._buttonEl.addEventListener("mousedown", (e) => {
            e.preventDefault();
        });

        // --- кнопка "ПРИМЕНИТЬ" ---
        this._buttonEl.addEventListener("click", (e) => {
            e.preventDefault();
            this._applyFromInput();
        });

        // --- клавиатура ---
        this._inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this._applyFromInput();
                this._inputEl.blur();       // спровоцирует откат и потухание
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
            // Пустое имя — не принимаем, откатываемся
            this._inputEl.value = this.namePlayer;
            return;
        }

        // Ничего не изменилось — просто перерисуем
        if (next === this.namePlayer) {
            this._render();
            return;
        } 

        // Новое имя в current
        this.namePlayer = next;
        this._saveCurrent();
        this._render();

        // --- коллбэк снаружи, если он есть ---
        if (typeof this._onApply === "function") {
            try {
                this._onApply(this.namePlayer);
            } catch (e) {
                console.error("UIInputName.onApply error:", e);
            }
        }

        // --- и всё равно оповестим через событие, для совместимости ---
        try {
            window.dispatchEvent(new CustomEvent("player-name-changed", {
                detail: { name: this.namePlayer }
            }));
        } catch (e)
        { 
            /* ignore */ 
        }
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