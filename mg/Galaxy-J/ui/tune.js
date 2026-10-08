/// tune.js
/// Модалка настроек для g-menu.html.
/// Хранит настройки ВНУТРИ АКТИВНОГО ПРОФИЛЯ через ProfileStore.
/// ---
/// Поля settings профиля:
///     - isSpawnEnemies       : boolean   "ВРАГИ"
///     - isTestDockToStation  : boolean   "ТЕСТ ДОКА К СТАНЦИИ"
///     - volume               : 0..1      "ГРОМКОСТЬ ЗВУКА"
/// ---
/// Контракт:
///     window.TuneMenu     = { open, close }
///     window.openTuneMenu = function () { ... }
/// ---
/// Хранение:
///     - НЕ трогает localStorage напрямую.
///     - читает/пишет через ProfileStore.getSettings(id) / ProfileStore.updateSettings(id, patch).
///     - id берётся из ProfileStore.ensure().id — т.е. всегда из АКТИВНОГО профиля.
/// ---
/// События:
///     - подписывается на "profile-changed": если открыто и профиль
///       переключили/переименовали — перерисовать значения.
///     - само НИЧЕГО не диспатчит: ProfileStore сам шлёт "profile-changed".
/// ---
/// Поведение:
///     - изменение чекбокса/слайдера → сразу ProfileStore.updateSettings(...).
///     - Esc / клик по фону / "ЗАКРЫТЬ" / "ОК" → close().

(function () {
    "use strict";

    const DEFAULTS = {
        isSpawnEnemies:      true,
        isTestDockToStation: false,
        volume:              0.5    // 0..1
    };

    // ---------------------------------------------------------
    //  Стили
    // ---------------------------------------------------------
    const STYLE_ID = "tune-menu-styles";

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .tune-menu__overlay {
                position: fixed;
                inset: 0;
                z-index: 100;
                background: rgba(0, 12, 0, 0.72);
                backdrop-filter: blur(2px);
                -webkit-backdrop-filter: blur(2px);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: "Courier New", monospace;
                letter-spacing: 1.5px;
                user-select: none;
                animation: tune-menu-fade 0.18s ease-out;
            }
            @keyframes tune-menu-fade {
                from { opacity: 0; }
                to   { opacity: 1; }
            }

            .tune-menu__panel {
                width: min(520px, 88vw);
                max-height: 82vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                background: rgba(6, 20, 6, 0.94);
                border: 2px solid #a8ff78;
                border-radius: 12px;
                box-shadow:
                    0 0 14px rgba(168, 255, 120, 0.55),
                    0 0 40px rgba(168, 255, 120, 0.25),
                    0 0 6px rgba(168, 255, 120, 0.35) inset;
                color: #cfe6b8;
            }

            .tune-menu__title {
                padding: 12px 16px;
                font-size: clamp(12px, 3vw, 15px);
                font-weight: bold;
                color: #f4ffe8;
                border-bottom: 2px solid rgba(168, 255, 120, 0.35);
                text-shadow:
                    0 0 4px  rgba(0, 255, 216, 0.6),
                    0 0 12px rgba(9, 255, 120, 0.4);
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
            }

            .tune-menu__close {
                background: transparent;
                border: 2px solid #a8ff78;
                border-radius: 8px;
                color: #a8ff78;
                font-family: inherit;
                font-weight: bold;
                letter-spacing: 2px;
                font-size: clamp(10px, 2.4vw, 12px);
                padding: 3px 10px;
                cursor: pointer;
                transition: all 0.18s ease;
            }
            .tune-menu__close:hover {
                background: rgba(168, 255, 120, 0.28);
                color: #f4ffe8;
                box-shadow: 0 0 14px rgba(168, 255, 120, 0.8);
            }

            .tune-menu__list {
                list-style: none;
                margin: 0;
                padding: 10px 12px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .tune-menu__row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                padding: 10px 12px;
                border: 2px solid rgba(168, 255, 120, 0.35);
                border-radius: 10px;
                background: rgba(168, 255, 120, 0.06);
                font-size: clamp(11px, 2.8vw, 13px);
                transition: all 0.18s ease;
            }
            .tune-menu__row:hover {
                background: rgba(168, 255, 120, 0.12);
                border-color: #a8ff78;
                color: #f4ffe8;
                box-shadow: 0 0 14px rgba(168, 255, 120, 0.4);
            }

            .tune-menu__label {
                flex: 1 1 auto;
                min-width: 0;
                font-weight: bold;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* ---------- чекбокс ---------- */
            .tune-menu__check {
                appearance: none;
                -webkit-appearance: none;
                width: 22px;
                height: 22px;
                flex: 0 0 auto;
                border: 2px solid #a8ff78;
                border-radius: 6px;
                background: rgba(168, 255, 120, 0.08);
                cursor: pointer;
                position: relative;
                transition: all 0.18s ease;
                box-shadow: 0 0 10px rgba(168, 255, 120, 0.35);
                outline: none;
            }
            .tune-menu__check:hover {
                background: rgba(168, 255, 120, 0.22);
                box-shadow: 0 0 16px rgba(168, 255, 120, 0.7);
            }
            .tune-menu__check:checked {
                background: #a8ff78;
                box-shadow: 0 0 18px rgba(168, 255, 120, 0.9);
            }
            .tune-menu__check:checked::after {
                content: "";
                position: absolute;
                left: 5px;
                top: 1px;
                width: 7px;
                height: 12px;
                border: solid #0a140a;
                border-width: 0 3px 3px 0;
                transform: rotate(45deg);
            }

            /* ---------- слайдер громкости ---------- */
            .tune-menu__range-wrap {
                flex: 0 0 auto;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .tune-menu__range {
                appearance: none;
                -webkit-appearance: none;
                width: clamp(120px, 30vw, 180px);
                height: 8px;
                border-radius: 6px;
                background: rgba(168, 255, 120, 0.15);
                border: 2px solid #a8ff78;
                box-shadow: 0 0 10px rgba(168, 255, 120, 0.35);
                outline: none;
                cursor: pointer;
            }
            .tune-menu__range::-webkit-slider-thumb {
                appearance: none;
                -webkit-appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #a8ff78;
                box-shadow: 0 0 12px rgba(168, 255, 120, 0.9);
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .tune-menu__range::-webkit-slider-thumb:hover {
                background: #f4ffe8;
                box-shadow: 0 0 18px rgba(168, 255, 120, 1);
            }
            .tune-menu__range::-moz-range-thumb {
                width: 16px;
                height: 16px;
                border: none;
                border-radius: 50%;
                background: #a8ff78;
                box-shadow: 0 0 12px rgba(168, 255, 120, 0.9);
                cursor: pointer;
            }

            .tune-menu__val {
                flex: 0 0 auto;
                min-width: 34px;
                text-align: right;
                font-weight: bold;
                color: #f4ffe8;
                text-shadow: 0 0 6px rgba(168, 255, 120, 0.6);
            }

            .tune-menu__footer {
                padding: 10px 12px;
                border-top: 2px solid rgba(168, 255, 120, 0.35);
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }

            .tune-menu__btn {
                box-sizing: border-box;
                background: rgba(168, 255, 120, 0.15);
                border: 2px solid #a8ff78;
                color: #a8ff78;
                border-radius: 10px;
                font-family: inherit;
                font-weight: bold;
                letter-spacing: 2px;
                cursor: pointer;
                padding: 7px 14px;
                font-size: clamp(11px, 2.6vw, 13px);
                transition: all 0.2s ease;
                box-shadow: 0 0 12px rgba(168, 255, 120, 0.4);
            }
            .tune-menu__btn:hover {
                background: rgba(168, 255, 120, 0.28);
                color: #f4ffe8;
                box-shadow: 0 0 20px rgba(168, 255, 120, 0.7);
            }
            .tune-menu__btn:active {
                background: rgba(168, 255, 120, 0.55);
                color: #0a140a;
                box-shadow: 0 0 26px rgba(168, 255, 120, 0.9);
            }
            .tune-menu__title-name {
                font-size: 1.15em;  /* чуть больше заголовка */
                color: #fff3a8;   /* слегка желтоватый */
                text-shadow:
                    0 0 4px  rgba(255, 240, 150, 0.85),
                    0 0 12px rgba(255, 220, 80, 0.55);
                margin-left: 6px;
                letter-spacing: 1.5px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                max-width: 55%;
                vertical-align: baseline;
            }
        `;
        document.head.appendChild(style);
    }

    // ---------------------------------------------------------
    //  Состояние
    // ---------------------------------------------------------
    let _overlay    = null;
    let _listEl     = null;
    let _volumeIn   = null;
    let _volumeVal  = null;
    let _onChanged  = null;

    // ---------------------------------------------------------
    //  Мостик к ProfileStore
    // ---------------------------------------------------------
    function hasStore() {
        return typeof ProfileStore !== "undefined"
            && ProfileStore
            && typeof ProfileStore.ensure === "function"
            && typeof ProfileStore.getSettings === "function"
            && typeof ProfileStore.updateSettings === "function";
    }

    function getPlayerName() {
        // 1) активный профиль из ProfileStore
        if (hasStore()) {
            try {
                const p = ProfileStore.ensure();
                if (p && p.name) return p.name;
            } catch (_) { /* ignore */ }
        }
        // 2) запасной вариант — глобальная переменная, если есть
        if (typeof window.NAME_PLAYER !== "undefined" && window.NAME_PLAYER) {
            return String(window.NAME_PLAYER);
        }
        // 3) совсем запасной
        return "ИГРОК";
    }

    function currentProfileId() {
        if (!hasStore()) return null;
        try {
            const p = ProfileStore.ensure();
            return p ? p.id : null;
        } catch (e) {
            return null;
        }
    }

    function readSettings() {
        if (!hasStore()) return { ...DEFAULTS };
        const s = ProfileStore.getSettings(currentProfileId()) || {};
        return Object.assign({}, DEFAULTS, s);
    }

    function writeSettings(patch) {
        if (!hasStore()) return false;
        return ProfileStore.updateSettings(currentProfileId(), patch);
    }

    // ---------------------------------------------------------
    //  Закрытие / открытие
    // ---------------------------------------------------------
    function close() {
        if (!_overlay) return;
        const el = _overlay;
        _overlay   = null;
        _listEl    = null;
        _volumeIn  = null;
        _volumeVal = null;

        if (_onChanged) {
            window.removeEventListener("profile-changed", _onChanged);
            _onChanged = null;
        }

        el.style.opacity = "0";
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 160);

        document.removeEventListener("keydown", onKeyDown, true);
    }

    function onKeyDown(e) {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
        }
    }

    // ---------------------------------------------------------
    //  Озвучка
    // ---------------------------------------------------------
    function playClick() {
        if (typeof window.playClick === "function") {
            try { window.playClick(); } catch (_) { /* ignore */ }
        }
    }

    // ---------------------------------------------------------
    //  Хелперы значений
    // ---------------------------------------------------------
    function clampVolume(v) {
        v = Number(v);
        if (isNaN(v)) return 0;
        return Math.max(0, Math.min(1, v));
    }

    // хранилище 0..1  →  UI 0..100  (целое)
    function toUi(v) {
        v = Number(v);
        if (isNaN(v)) v = 0;
        v = Math.max(0, Math.min(1, v));
        return Math.round(v * 100);
    }

    // UI 0..100 (или строка из input.value)  →  хранилище 0..1
    function toStore(v) {
        v = parseInt(v, 10);
        if (isNaN(v)) v = 0;
        v = Math.max(0, Math.min(100, v));
        return v / 100;
    }

    // ---------------------------------------------------------
    //  Строки
    // ---------------------------------------------------------
    function buildCheckRow(label, field) {
        const row = document.createElement("li");
        row.className = "tune-menu__row";

        const text = document.createElement("span");
        text.className = "tune-menu__label";
        text.textContent = label;
        row.appendChild(text);

        const check = document.createElement("input");
        check.type = "checkbox";
        check.className = "tune-menu__check";
        check.dataset.field = field;
        check.checked = !!readSettings()[field];

        check.addEventListener("change", () => {
            const patch = {};
            patch[field] = !!check.checked;
            writeSettings(patch);
            playClick();
        });

        row.appendChild(check);
        return row;
    }

    function buildVolumeRow() {
        const row = document.createElement("li");
        row.className = "tune-menu__row";

        const text = document.createElement("span");
        text.className = "tune-menu__label";
        text.textContent = "ГРОМКОСТЬ ЗВУКА";
        row.appendChild(text);

        const wrap = document.createElement("div");
        wrap.className = "tune-menu__range-wrap";

        const range = document.createElement("input");
        range.type = "range";
        range.className = "tune-menu__range";
        range.min = "0";
        range.max = "100";
        range.step = "1";
        range.value = String(toUi(readSettings().volume));

        const val = document.createElement("span");
        val.className = "tune-menu__val";
        val.textContent = range.value;

        // мгновенно в UI, но в хранилище — не на каждый пиксель
        range.addEventListener("input", () => {
            val.textContent = String(range.value);
        });
        range.addEventListener("change", () => {
            // в UI 0..100 → в хранилище 0..1
            writeSettings({ volume: toStore(range.value) });
            playClick();
        });

        wrap.appendChild(range);
        wrap.appendChild(val);
        row.appendChild(wrap);

        _volumeIn  = range;
        _volumeVal = val;
        return row;
    }

    // ---------------------------------------------------------
    //  Синхронизация с профилем (при profile-changed)
    // ---------------------------------------------------------
    function syncFromProfile()
    {
        const nameEl = _overlay && _overlay.querySelector(".tune-menu__title-name");
        if (nameEl) nameEl.textContent = getPlayerName();
        
        if (!_overlay || !_listEl) return;
        const s = readSettings();

        // чекбоксы
        _listEl.querySelectorAll(".tune-menu__check").forEach((el) => {
            const field = el.dataset.field;
            if (!field) return;
            el.checked = !!s[field];
        });

        // слайдер
        if (_volumeIn && _volumeVal) {
            const v = toUi(s.volume);   // 0..1 → 0..100
            _volumeIn.value  = String(v);
            _volumeVal.textContent = String(v);
        }
    }

    // ---------------------------------------------------------
    //  Открытие
    // ---------------------------------------------------------
    function open() {
        injectStyles();

        if (_overlay) {
            _overlay.style.opacity = "0.7";
            setTimeout(() => { if (_overlay) _overlay.style.opacity = "1"; }, 60);
            syncFromProfile();
            return;
        }

        if (!hasStore()) {
            console.warn("[tune] ProfileStore.getSettings/updateSettings не найдены — " +
                         "добавь их в profile-store.js.");
        }

        const overlay = document.createElement("div");
        overlay.className = "tune-menu__overlay";

        const panel = document.createElement("div");
        panel.className = "tune-menu__panel";

        // --- заголовок ---
        const title = document.createElement("div");
        title.className = "tune-menu__title";

            const titleText = document.createElement("span");
            titleText.textContent = "НАСТРОЙКИ:";
            title.appendChild(titleText);

            const titleName = document.createElement("span");
            titleName.className = "tune-menu__title-name";
            titleName.textContent = getPlayerName();
            title.appendChild(titleName);

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "tune-menu__close";
        closeBtn.textContent = "ЗАКРЫТЬ";
        closeBtn.addEventListener("click", () => { playClick(); close(); });
        title.appendChild(closeBtn);

        // --- список ---
        const list = document.createElement("ul");
        list.className = "tune-menu__list";

        list.appendChild(buildCheckRow("ВРАГИ",                 "isSpawnEnemies"));
        list.appendChild(buildCheckRow("ТЕСТ ДОКА К СТАНЦИИ",   "isTestDockToStation"));
        list.appendChild(buildVolumeRow());

        // --- футер ---
        const footer = document.createElement("div");
        footer.className = "tune-menu__footer";

        const btnOk = document.createElement("button");
        btnOk.type = "button";
        btnOk.className = "tune-menu__btn";
        btnOk.textContent = "ОК";
        btnOk.addEventListener("click", () => { playClick(); close(); });
        footer.appendChild(btnOk);

        panel.appendChild(title);
        panel.appendChild(list);
        panel.appendChild(footer);
        overlay.appendChild(panel);

        // клик по фону — закрыть
        overlay.addEventListener("mousedown", (e) => {
            if (e.target === overlay) close();
        });

        // делегирование озвучки для всех кнопок
        // overlay.addEventListener("click", (e) => {
        //     const btn = e.target.closest("button");
        //     if (!btn) return;
        //     playClick();
        // });

        document.body.appendChild(overlay);
        _overlay = overlay;
        _listEl  = list;

        // реакция на смену профиля, пока окно открыто
        _onChanged = () => syncFromProfile();
        window.addEventListener("profile-changed", _onChanged);

        document.addEventListener("keydown", onKeyDown, true);
    }

    // ---------------------------------------------------------
    //  Экспорт
    // ---------------------------------------------------------
    window.TuneMenu     = { open, close };
    window.openTuneMenu = open;

//  console.log("[tune] window.TuneMenu готов (хранит настройки в текущем профиле).");
})();