/// ui-input-name.js
/// Отвечает за ввод пользователем его имени.
/// Используется в модуле g-menu.html.
/// ---
/// Хранение:
///     - имя живёт в активном профиле ProfileStore.
///     - ProfileStore.ensure() гарантирует, что профиль есть всегда.
///     - UIInputName не трогает localStorage напрямую.
///     - ProfileStore — единственный источник правды для имени.
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
///     - при фокусе ИМЯ в окне ВВОДа подсвечивается ярче.
///     - при потере фокуса ИМЯ в окне ВВОДа восстанавливается
///       текущим именем.
///     - текущее ИМЯ подсвечивается ярче, чем ИМЯ в окне ВВОДа.
///     - текущее ИМЯ имеет анимированную пульсирующую ауру.
///     - при клике на ПРИМЕНИТЬ генерируется событие "player-name-changed"
///       на window, в detail.name передаётся новое имя игрока.
///     - UIInputName больше не знает ключей localStorage.
///     - Чтение: constructor → _loadFromStorage → ProfileStore.ensure() → profile.name.
///     - Запись: _applyFromInput → _saveCurrent → ProfileStore.rename(profile.id, newName).
///     - Первый запуск: ProfileStore.ensure() 
///       создаёт дефолтный профиль с NAME_PLAYER_DEFAULT, 
///       UIInputName читает его и показывает.
///     - Событие player-name-changed шлётся только при реальной смене имени.


class UIInputName
{
    // ---------- Значение по умолчанию ----------
    namePlayer = (typeof NAME_PLAYER_DEFAULT !== "undefined")
        ? NAME_PLAYER_DEFAULT
        : "ERROR: profile-store.js";

    // ---------- DOM-ссылки ----------
    _root        = null;
    _titleEl     = null;
    _titleTextEl = null;   // <-- внутренний span (ellipsis)
    _inputEl     = null;
    _buttonEl    = null;

    _buttonProfilesEl = null;

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

        window.addEventListener("profile-changed", () => {
            this._loadFromStorage();
            this._render();
        });
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
        this._titleEl     = null;
        this._titleTextEl = null;
        this._inputEl     = null;
        this._buttonEl    = null;
        this._auraStyleEl = null;

        this._buttonProfilesEl = null;
    }

    // =========================================================
    //  ВНУТРЕННЕЕ — localStorage
    // =========================================================
    _loadFromStorage()
    {
        if (typeof ProfileStore === "undefined") {
            console.warn("UIInputName: ProfileStore не подключён, работаем на дефолте.");
            return;
        }

        const profile = ProfileStore.ensure();
        if (profile && profile.name) {
            this.namePlayer = profile.name;
        }
    }

    _saveCurrent()
    {
        if (typeof ProfileStore === "undefined") {
            console.warn("UIInputName: ProfileStore не подключён, имя не сохранено.");
            return;
        }

        const profile = ProfileStore.ensure();
        if (profile) {
            ProfileStore.rename(profile.id, this.namePlayer);
        }
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

        // ---------- Кнопка "ПРОФИЛИ" ----------
        const buttonProfiles = document.createElement("button");
        buttonProfiles.type = "button";
        buttonProfiles.className = "ui-input-name__btn ui-input-name__btn--profiles";
        buttonProfiles.textContent = "ПРОФИЛИ";
        Object.assign(buttonProfiles.style, {
            width:           "40%",
            minWidth:        "88px",          // <-- гарантия, что текст влезет
            boxSizing:       "border-box",
            alignSelf:       "flex-end",
            whiteSpace:      "nowrap",        // <-- текст не переносится
            background:      "rgba(168, 255, 120, 0.15)",
            border:          "2px solid #185f08",
            color:           "#a8ff78",
            borderRadius:    "10px",
            fontFamily:      '"Courier New", monospace',
            fontWeight:      "bold",
            letterSpacing:   "1px",           // <-- было 2px, чуть ужимаем
            cursor:          "pointer",
            padding:         "7px 10px",      // <-- было 12px
            fontSize:        "clamp(6px, 2.4vw, 8px)",  // <-- чуть мельче
            transition:      "all 0.2s ease",
            boxShadow:       "0 0 12px rgba(168,255,120,0.4)"
        });

        buttonProfiles.addEventListener("mouseenter", () => {
            buttonProfiles.style.background = "rgba(168,255,120,0.28)";
            buttonProfiles.style.color = "#f4ffe8";
            buttonProfiles.style.boxShadow = "0 0 20px rgba(168,255,120,0.7)";
        });
        buttonProfiles.addEventListener("mouseleave", () => {
            buttonProfiles.style.background = "rgba(168,255,120,0.15)";
            buttonProfiles.style.color = "#a8ff78";
            buttonProfiles.style.boxShadow = "0 0 12px rgba(168,255,120,0.4)";
        });
        buttonProfiles.addEventListener("mousedown", () => {
            buttonProfiles.style.background = "rgba(168,255,120,0.55)";
            buttonProfiles.style.color = "#0a140a";
            buttonProfiles.style.boxShadow = "0 0 26px rgba(168,255,120,0.9)";
        });
        buttonProfiles.addEventListener("mouseup", () => {
            buttonProfiles.style.background = "rgba(168,255,120,0.28)";
            buttonProfiles.style.color = "#f4ffe8";
            buttonProfiles.style.boxShadow = "0 0 20px rgba(168,255,120,0.7)";
        });

        buttonProfiles.addEventListener("mousedown", (e) => {
            e.preventDefault();
        });
        buttonProfiles.addEventListener("click", (e) => {
            e.preventDefault();
            this._openProfilesChoice();
        });

        // ---------- Собираем ----------
        root.appendChild(title);
        root.appendChild(input);
        root.appendChild(button);
        root.appendChild(buttonProfiles);   // <-- добавить

        this._parent.appendChild(root);

        this._root            = root;
        this._titleEl         = title;
        this._titleTextEl     = titleText;
        this._inputEl         = input;
        this._buttonEl        = button;
        this._buttonProfilesEl = buttonProfiles;   // <-- добавить

        // ---------- Озвучка ВСЕХ кнопок этого виджета ----------
        root.addEventListener("click", (e) => {
            const btn = e.target.closest("button");
            if (!btn || !root.contains(btn)) return;
            playClick();
        });

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

    /** Прочитать значение из input, применить и оповестить через событие. */
    _applyFromInput()
    {
        if (!this._inputEl) return;

        const next = (this._inputEl.value || "").trim();
        if (!next) {
            this._inputEl.value = this.namePlayer;
            return;
        }

        // имя не изменилось — событие не шлём
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

    /**
     * ПРОФИЛИ.
     * Подгружает ui-profile-choice.js (один раз) и вызывает его точку входа.
     * Ожидаемый контракт скрипта:
     *   window.UiProfileChoice = { open(options) }   // либо функция-конструктор
     */
    _openProfilesChoice()
    {
        const invoke = () => {
            try {
                if (typeof window.openUiProfileChoice === "function") {
                    window.openUiProfileChoice();
                    return;
                }
                if (window.UiProfileChoice) {
                    if (typeof window.UiProfileChoice.open === "function") {
                        window.UiProfileChoice.open();
                        return;
                    }
                    if (typeof window.UiProfileChoice === "function") {
                        new window.UiProfileChoice();
                        return;
                    }
                }
                console.warn("UIInputName: ui-profile-choice.js загружен, но точка входа не найдена.");
            } catch (e) {
                console.error("UIInputName: ошибка вызова ui-profile-choice.js:", e);
            }
        };

        // Уже загружен — просто вызвать
        if (window.__uiProfileChoiceLoaded) { invoke(); return; }
        if (document.getElementById("ui-profile-choice-script")) {
            // скрипт уже в DOM, но, возможно, ещё грузится — подождём load
            const s = document.getElementById("ui-profile-choice-script");
            s.addEventListener("load", () => { window.__uiProfileChoiceLoaded = true; invoke(); }, { once: true });
            return;
        }

        const script = document.createElement("script");
        script.id  = "ui-profile-choice-script";
        script.src = "person/ui-profile-choice.js";
        script.defer = true;
        script.addEventListener("load", () => {
            window.__uiProfileChoiceLoaded = true;
            invoke();
        }, { once: true });
        script.addEventListener("error", () => {
            console.error("UIInputName: не удалось загрузить ui-profile-choice.js");
        }, { once: true });
        document.head.appendChild(script);
    }

    /**
     * Строгая проверка имени.
     * @returns {{ ok: boolean, errors: string[] }}
     */
    static validateName(name, {
        min = 3,
        max = 16,
        cyrillic = true,
        spaces   = true,
        doubleSpaces = false,
        forbidden = [],
    } = {}) {
        const errors = [];

        // 0. Тип
        if (typeof name !== 'string') {
            return { ok: false, errors: ['имя должно быть строкой'] };
        }

        // 1. NFC-нормализация
        const normalized = name.normalize('NFC');

        // 2. Пустая строка — ранний выход
        if (!normalized.trim()) {
            return { ok: false, errors: ['имя не может быть пустым'] };
        }

        // 3. Длина по code points
        const charCount = [...normalized].length;
        if (charCount < min) errors.push(`минимум ${min} символов`);
        if (charCount > max) errors.push(`максимум ${max} символов`);

        // 4. Пробелы по краям
        if (normalized !== normalized.trim()) {
            errors.push('нельзя начинать или заканчивать пробелом');
        }

        // 5. Пробелы запрещены явно
        if (!spaces && / /.test(normalized)) {
            errors.push('пробелы не разрешены');
        }

        // 6. Двойные пробелы (только если пробелы разрешены)
        if (spaces && !doubleSpaces && / {2,}/.test(normalized)) {
            errors.push('двойные пробелы запрещены');
        }

        // 7. Белый список
        let cls = 'a-zA-Z0-9_\\-';
        if (cyrillic) cls += 'а-яёА-ЯЁ';
        if (spaces)   cls += ' ';
        const reAllowed = new RegExp(`^[${cls}]+$`, 'u');
        if (!reAllowed.test(normalized)) {
            errors.push(
            'допустимы только: латиница' + (cyrillic ? ', кириллица' : '') +
            ', цифры, "_" и "-"' + (spaces ? ', пробел' : '')
            );
            // дальше проверять нет смысла
            return { ok: false, errors };
        }

        // 8. Первый символ — буква
        let letters = 'a-zA-Z';
        if (cyrillic) letters += 'а-яёА-ЯЁ';
        if (!new RegExp(`^[${letters}]`, 'u').test(normalized)) {
            errors.push('имя должно начинаться с буквы');
        }

        // 9. Зарезервированные имена
        const lower = normalized.toLowerCase();
        if (forbidden.some(f => String(f).trim().toLowerCase() === lower)) {
            errors.push('это имя зарезервировано');
        }

        return { ok: errors.length === 0, errors };
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