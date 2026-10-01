/// ui-input-name.js
/// Отвечает за ввод пользователем его имени.
/// Используется в модуле g-menu.html
/// Объект хранит текущее имя игрока внутри localStorage.
/// После ввода нового имени старое остаётся в localStorage (в истории).
/// ---
/// Графика:
///     - рисуется окно ввода.
///     - над окном вывода выводится текущее действительное имя.
///     - рядом внизу с окном ввода рисуется кнопочка "применить".
///     - ширина кнопки и окна ввода совпадают.
///     - данный ввод находится справа вверху окна g-menu.html
///     - стиль соответствует стилю g-menu.html

class UIInputName
{
    // ---------- Ключи localStorage ----------
    static KEY_CURRENT = "galaxy.player.name";
    static KEY_HISTORY = "galaxy.player.name.history";

    // ---------- Значение по умолчанию ----------
    namePlayer = "Анонимус-1917";

    // ---------- DOM-ссылки ----------
    _root      = null;
    _titleEl   = null;
    _inputEl   = null;
    _buttonEl  = null;

    // =========================================================
    //  КОНСТРУКТОР
    // =========================================================
    constructor(options = {})
    {
        // --- родитель (по умолчанию — body) ---
        this._parent = options.parent || document.body;

        // --- позиция (правый верхний угол) ---
        this._offsetTop   = options.offsetTop   ?? 12;   // px
        this._offsetRight = options.offsetRight ?? 12;   // px

        // --- прочитать сохранённое имя ---
        this._loadFromStorage();

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

    /** Полностью удалить UI со страницы. */
    destroy()
    {
        if (this._root && this._root.parentNode) {
            this._root.parentNode.removeChild(this._root);
        }
        this._root = null;
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
        } catch (e) {
            /* приватный режим / отключено — оставляем дефолт */
        }
    }

    _saveCurrent()
    {
        try {
            localStorage.setItem(UIInputName.KEY_CURRENT, this.namePlayer);
        } catch (e) { /* ignore */ }
    }

    /** Старое имя уходит в историю, не удаляя текущее. */
    _pushHistory(name)
    {
        if (!name || !name.trim()) return;
        try {
            const raw = localStorage.getItem(UIInputName.KEY_HISTORY);
            const arr = raw ? JSON.parse(raw) : [];
            arr.push({
                name: name.trim(),
                date: new Date().toISOString()
            });
            // ограничим историю 100 записями
            while (arr.length > 100) arr.shift();
            localStorage.setItem(UIInputName.KEY_HISTORY, JSON.stringify(arr));
        } catch (e) { /* ignore */ }
    }

    // =========================================================
    //  ВНУТРЕННЕЕ — UI
    // =========================================================
    _buildUI()
    {
        // --- корневой контейнер ---
        const root = document.createElement("div");
        root.className = "ui-input-name";
        root.style.position   = "fixed";
        root.style.top        = this._offsetTop + "px";
        root.style.right      = this._offsetRight + "px";
        root.style.zIndex     = "30";
        root.style.width      = "min(260px, 68vw)";
        root.style.display    = "flex";
        root.style.flexDirection = "column";
        root.style.gap        = "6px";
        root.style.fontFamily = '"Courier New", monospace';
        root.style.letterSpacing = "1.5px";
        root.style.userSelect = "none";

        // ---------- Заголовок (текущее имя) ----------
        const title = document.createElement("div");
        title.className = "ui-input-name__title";
        title.style.color        = "#eaffd0";
        title.style.opacity      = "0.75";
        title.style.fontSize     = "clamp(10px, 2.4vw, 12px)";
        title.style.textAlign    = "left";
        title.style.padding      = "0 4px";
        title.style.textShadow   = "0 0 6px rgba(168,255,120,0.4)";
        title.style.whiteSpace   = "nowrap";
        title.style.overflow     = "hidden";
        title.style.textOverflow = "ellipsis";

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
            background:      "rgba(168, 255, 120, 0.10)",
            border:          "2px solid #a8ff78",
            borderRadius:    "10px",
            color:           "#eaffd0",
            fontFamily:      '"Courier New", monospace',
            fontSize:        "clamp(12px, 3vw, 15px)",
            fontWeight:      "bold",
            letterSpacing:   "2px",
            padding:         "8px 12px",
            outline:         "none",
            boxShadow:       "0 0 10px rgba(168,255,120,0.35) inset, 0 0 10px rgba(168,255,120,0.25)",
            transition:      "box-shadow 0.2s ease, background 0.2s ease"
        });

        // ---------- Кнопка "применить" ----------
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ui-input-name__btn";
        button.textContent = "ПРИМЕНИТЬ";
        button.style.width = "100%";
        button.style.boxSizing = "border-box";
        button.style.background = "rgba(168, 255, 120, 0.15)";
        button.style.border = "2px solid #a8ff78";
        button.style.color = "#a8ff78";
        button.style.borderRadius = "10px";
        button.style.fontFamily = '"Courier New", monospace';
        button.style.fontWeight = "bold";
        button.style.letterSpacing = "2px";
        button.style.cursor = "pointer";
        button.style.padding = "7px 12px";
        button.style.fontSize = "clamp(11px, 2.6vw, 13px)";
        button.style.transition = "all 0.2s ease";
        button.style.boxShadow = "0 0 12px rgba(168,255,120,0.4)";

        // hover / active — через отдельные обработчики,
        // чтобы не тянуть внешние стили.
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

        input.addEventListener("focus", () => {
            input.style.boxShadow =
                "0 0 12px rgba(168,255,120,0.55) inset, 0 0 20px rgba(168,255,120,0.6)";
            input.style.background = "rgba(168,255,120,0.18)";
        });
        input.addEventListener("blur", () => {
            input.style.boxShadow =
                "0 0 10px rgba(168,255,120,0.35) inset, 0 0 10px rgba(168,255,120,0.25)";
            input.style.background = "rgba(168,255,120,0.10)";
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

        this._render();
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
        // --- клик по кнопке "ПРИМЕНИТЬ" ---
        this._buttonEl.addEventListener("click", (e) => {
            e.preventDefault();
            this._applyFromInput();
        });

        // --- Enter в поле ввода = применить ---
        this._inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this._applyFromInput();
                this._inputEl.blur();
            } else if (e.key === "Escape") {
                // откат значения в поле к текущему имени
                this._inputEl.value = this.namePlayer;
                this._inputEl.blur();
            }
        });
    }

    /** Прочитать значение из input и применить. */
    _applyFromInput()
    {
        if (!this._inputEl) return;

        const next = (this._inputEl.value || "").trim();
        if (!next) {
            // Пустое имя — не принимаем, откатываемся
            this._inputEl.value = this.namePlayer;
            return;
        }

        if (next === this.namePlayer) {
            // Ничего не изменилось — просто перерисуем
            this._render();
            return;
        }

        // Старое имя — в историю, новое — в current
        this._pushHistory(this.namePlayer);

        this.namePlayer = next;
        this._saveCurrent();
        this._render();

        // --- оповестим подписчиков (другие модули игры) ---
        try {
            window.dispatchEvent(new CustomEvent("player-name-changed", {
                detail: { name: this.namePlayer }
            }));
        } catch (e) { /* ignore */ }
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