/// ui-profile-choice.js
/// Модалка выбора профиля игрока.
/// Работает поверх ProfileStore (profile-store.js) — единственного источника правды.
/// ---
/// Контракт (см. ui-input-name.js → _openProfilesChoice):
///     window.openUiProfileChoice = function () { ... }
///     window.UiProfileChoice     = { open, close }
/// ---
/// Хранение:
///     - напрямую localStorage НЕ трогает.
///     - чтение: ProfileStore.list() + ProfileStore.load(id) + ProfileStore.currentId().
///     - активный профиль: ProfileStore.setCurrent(id).
///     - создать:          ProfileStore.create(name).
///     - переименовать:    ProfileStore.rename(id, name).
///     - удалить:          ProfileStore.remove(id).
/// ---
/// События:
///     - подписывается на "profile-changed" и перерисовывает список,
///       пока модалка открыта.
///     - НИЧЕГО не диспатчит само — источник правды ProfileStore
///       сам шлёт "profile-changed".
/// ---
/// Поведение:
///     - клик по строке профиля → ProfileStore.setCurrent(id) → модалка закрывается.
///     - кнопка "НОВЫЙ"         → ProfileStore.create() (сгенерит дефолт) → остаёмся открыты.
///     - кнопка "ПЕРЕИМЕНОВАТЬ" → inline-инпут в строке активного профиля → ProfileStore.rename().
///     - кнопка "УДАЛИТЬ"       → confirm() → ProfileStore.remove(id).
///     - Esc / клик по фону / "ЗАКРЫТЬ" → close().

(function () {
    "use strict";

    // ---------------------------------------------------------
    //  Стили
    // ---------------------------------------------------------
    const STYLE_ID = "ui-profile-choice-styles";

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .ui-profile-choice__overlay {
                position: fixed;
                inset: 0;
                z-index: 100;
                background: rgba(0, 12, 0, 0.72);
                backdrop-filter: blur(2px);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: "Courier New", monospace;
                letter-spacing: 1.5px;
                user-select: none;
                animation: ui-profile-choice-fade 0.18s ease-out;
            }
            @keyframes ui-profile-choice-fade {
                from { opacity: 0; }
                to   { opacity: 1; }
            }

            .ui-profile-choice__panel {
                width: min(460px, 88vw);
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

            .ui-profile-choice__title {
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

            .ui-profile-choice__close {
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
            .ui-profile-choice__close:hover {
                background: rgba(168, 255, 120, 0.28);
                color: #f4ffe8;
                box-shadow: 0 0 14px rgba(168, 255, 120, 0.8);
            }

            .ui-profile-choice__list {
                list-style: none;
                margin: 0;
                padding: 8px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .ui-profile-choice__item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                padding: 9px 12px;
                border: 2px solid rgba(168, 255, 120, 0.35);
                border-radius: 10px;
                background: rgba(168, 255, 120, 0.06);
                font-size: clamp(11px, 2.8vw, 13px);
                cursor: pointer;
                transition: all 0.18s ease;
            }
            .ui-profile-choice__item:hover {
                background: rgba(168, 255, 120, 0.16);
                border-color: #a8ff78;
                box-shadow: 0 0 16px rgba(168, 255, 120, 0.5);
                color: #f4ffe8;
            }
            .ui-profile-choice__item[data-active="true"] {
                border-color: #f4ffe8;
                background: rgba(168, 255, 120, 0.22);
                color: #f4ffe8;
                box-shadow: 0 0 18px rgba(168, 255, 120, 0.7);
            }

            .ui-profile-choice__name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-weight: bold;
                flex: 1 1 auto;
                min-width: 0;
            }

            .ui-profile-choice__meta {
                font-size: 10px;
                color: #7fbf5f;
                letter-spacing: 1px;
                flex: 0 0 auto;
            }

            .ui-profile-choice__badge {
                font-size: 10px;
                color: #0a140a;
                background: #a8ff78;
                border-radius: 6px;
                padding: 1px 7px;
                font-weight: bold;
                letter-spacing: 1px;
                box-shadow: 0 0 10px rgba(168, 255, 120, 0.7);
                flex: 0 0 auto;
            }

            .ui-profile-choice__actions {
                display: flex;
                gap: 4px;
                flex: 0 0 auto;
            }

            .ui-profile-choice__icon {
                background: transparent;
                border: 2px solid rgba(168, 255, 120, 0.6);
                border-radius: 8px;
                color: #a8ff78;
                font-family: inherit;
                font-weight: bold;
                font-size: 11px;
                letter-spacing: 1px;
                padding: 2px 8px;
                cursor: pointer;
                transition: all 0.18s ease;
            }
            .ui-profile-choice__icon:hover {
                background: rgba(168, 255, 120, 0.28);
                color: #f4ffe8;
                box-shadow: 0 0 10px rgba(168, 255, 120, 0.7);
            }
            .ui-profile-choice__icon[data-danger="true"]:hover {
                background: rgba(255, 80, 80, 0.28);
                border-color: #ff5050;
                color: #ffd0d0;
                box-shadow: 0 0 12px rgba(255, 80, 80, 0.7);
            }

            .ui-profile-choice__rename {
                flex: 1 1 auto;
                min-width: 0;
                background: rgba(200, 255, 160, 0.12);
                border: 2px solid #eaffd0;
                border-radius: 8px;
                color: #ffffff;
                font-family: inherit;
                font-weight: bold;
                font-size: inherit;
                letter-spacing: inherit;
                padding: 4px 8px;
                outline: none;
                box-shadow: 0 0 12px rgba(200, 255, 160, 0.6) inset;
            }

            .ui-profile-choice__empty {
                padding: 18px 16px;
                text-align: center;
                color: #7fbf5f;
                font-size: clamp(11px, 2.8vw, 13px);
            }

            .ui-profile-choice__footer {
                padding: 10px 12px;
                border-top: 2px solid rgba(168, 255, 120, 0.35);
                display: flex;
                justify-content: space-between;
                gap: 8px;
            }

            .ui-profile-choice__btn {
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
            .ui-profile-choice__btn:hover {
                background: rgba(168, 255, 120, 0.28);
                color: #f4ffe8;
                box-shadow: 0 0 20px rgba(168, 255, 120, 0.7);
            }
            .ui-profile-choice__btn:active {
                background: rgba(168, 255, 120, 0.55);
                color: #0a140a;
                box-shadow: 0 0 26px rgba(168, 255, 120, 0.9);
            }
        `;
        document.head.appendChild(style);
    }

    // ---------------------------------------------------------
    //  Состояние
    // ---------------------------------------------------------
    let _overlay   = null;
    let _listEl    = null;
    let _onChanged = null;

    function hasStore() {
        return typeof ProfileStore !== "undefined"
            && ProfileStore
            && typeof ProfileStore.ensure === "function";
    }

    // ---------------------------------------------------------
    //  Закрытие
    // ---------------------------------------------------------
    function close() {
        if (!_overlay) return;
        const el = _overlay;
        _overlay = null;
        _listEl  = null;

        if (_onChanged) {
            window.removeEventListener("profile-changed", _onChanged);
            _onChanged = null;
        }

        el.style.opacity = "0";
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 160);

        document.removeEventListener("keydown", onKeyDown, true);

        music.play();
    }

    function onKeyDown(e) {
        if (e.key === "Escape") {
            // если сейчас открыт инпут переименования — не закрываем всё окно
            const t = e.target;
            if (t && t.tagName === "INPUT") return;
            e.preventDefault();
            e.stopPropagation();
            close();
        }
    }

    // ---------------------------------------------------------
    //  Утилиты
    // ---------------------------------------------------------
    function fmtDate(iso) {
        if (!iso) return "";
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return "";
            const pad = (n) => String(n).padStart(2, "0");
            return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
        } catch (_) {
            return "";
        }
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    // ---------------------------------------------------------
    //  Список
    // ---------------------------------------------------------
    function renderList() {
        if (!_listEl) return;
        _listEl.innerHTML = "";

        if (!hasStore()) {
            const empty = document.createElement("div");
            empty.className = "ui-profile-choice__empty";
            empty.textContent = "ProfileStore НЕ ПОДКЛЮЧЁН";
            _listEl.appendChild(empty);
            return;
        }

        const ids = ProfileStore.list() || [];
        const currentId = ProfileStore.currentId();

        if (!ids.length) {
            const empty = document.createElement("div");
            empty.className = "ui-profile-choice__empty";
            empty.textContent = "ПРОФИЛЕЙ НЕТ";
            _listEl.appendChild(empty);
            return;
        }

        ids.forEach((id) => {
            const p = ProfileStore.load(id);
            if (!p) return;

            const isActive = (id === currentId);

            const li = document.createElement("li");
            li.className = "ui-profile-choice__item";
            li.dataset.id = id;
            if (isActive) li.dataset.active = "true";

            // --- имя ---
            const nameEl = document.createElement("span");
            nameEl.className = "ui-profile-choice__name";
            nameEl.textContent = p.name || "(без имени)";
            nameEl.title = p.name || "";
            li.appendChild(nameEl);

            // --- дата последней игры ---
            if (p.lastPlayed) {
                const meta = document.createElement("span");
                meta.className = "ui-profile-choice__meta";
                meta.textContent = fmtDate(p.lastPlayed);
                li.appendChild(meta);
            }

            // --- бейдж "активный" ---
            if (isActive) {
                const badge = document.createElement("span");
                badge.className = "ui-profile-choice__badge";
                badge.textContent = "АКТИВНЫЙ";
                li.appendChild(badge);
            }

            // --- действия ---
            const actions = document.createElement("div");
            actions.className = "ui-profile-choice__actions";

            const btnRename = document.createElement("button");
            btnRename.type = "button";
            btnRename.className = "ui-profile-choice__icon";
            btnRename.textContent = "ИМЯ";
            btnRename.title = "Переименовать";
            btnRename.addEventListener("click", (e) => {
                e.stopPropagation();
                startRename(li, p);
            });
            actions.appendChild(btnRename);

            const btnDel = document.createElement("button");
            btnDel.type = "button";
            btnDel.className = "ui-profile-choice__icon";
            btnDel.dataset.danger = "true";
            btnDel.textContent = "X";
            btnDel.title = "Удалить профиль";
            btnDel.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteProfile(p);
            });
            actions.appendChild(btnDel);

            li.appendChild(actions);

            // --- клик по строке = активировать ---
            li.addEventListener("click", () => {
                if (li.querySelector("input")) return; // идёт переименование
                playClick();
                activateProfile(id);
            });

            _listEl.appendChild(li);
        });
    }

    // ---------------------------------------------------------
    //  Действия
    // ---------------------------------------------------------
    function activateProfile(id) {
        if (!hasStore()) return;
        if (ProfileStore.currentId() === id) {
            close();
            return;
        }
        const ok = ProfileStore.setCurrent(id);
        if (ok) {
            // profile-changed сам перерисует; закроем окно
            close();
        }
    }

    function startRename(li, profile) {
        // уже переименовываем?
        if (li.querySelector("input")) return;

        const nameEl = li.querySelector(".ui-profile-choice__name");
        const oldName = profile.name || "";

        const input = document.createElement("input");
        input.type = "text";
        input.className = "ui-profile-choice__rename";
        input.value = oldName;
        input.maxLength = 24;
        input.spellcheck = false;
        input.autocomplete = "off";

        // прячем имя, ставим инпут
        nameEl.style.display = "none";
        li.insertBefore(input, nameEl);
        input.focus();
        input.select();

        let done = false;

        const finish = (apply) => {
            if (done) return;
            done = true;

            if (apply) {
                const next = (input.value || "").trim();
                if (next && next !== oldName) {
                    ProfileStore.rename(profile.id, next);
                    // profile-changed → renderList() сам перерисует
                } else {
                    // без изменений — вернуть как было
                    input.parentNode && input.parentNode.removeChild(input);
                    nameEl.style.display = "";
                }
            } else {
                input.parentNode && input.parentNode.removeChild(input);
                nameEl.style.display = "";
            }
        };

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                finish(true);
            } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                finish(false);
            }
        });
        input.addEventListener("blur", () => finish(true));
        input.addEventListener("click", (e) => e.stopPropagation());
    }

    function deleteProfile(profile) {
        if (!hasStore()) return;
        const name = profile.name || "(без имени)";
        const ok = window.confirm(`Удалить профиль "${name}"?\nДействие необратимо.`);
        if (!ok) return;
        ProfileStore.remove(profile.id);
        // profile-changed → renderList()
    }

    function createNewProfile() {
        if (!hasStore()) return;
        // ProfileStore.create() сам применит NAME_PLAYER_DEFAULT,
        // сделает профиль активным и шлёт profile-changed.
        const p = ProfileStore.create(null);
        if (!p) {
            console.warn("[ui-profile-choice] не удалось создать профиль");
        }
        // Остаёмся открытыми — пользователь сразу увидит новый профиль.
        renderList();
    }

    // ---------------------------------------------------------
    //  Открытие
    // ---------------------------------------------------------
    function open() {
        injectStyles();

        if (_overlay) {
            _overlay.style.opacity = "0.7";
            setTimeout(() => { if (_overlay) _overlay.style.opacity = "1"; }, 60);
            renderList();
            return;
        }

        // На случай, если ProfileStore ещё не поднят — поднимем.
        if (hasStore()) {
            try { ProfileStore.ensure(); } catch (_) { /* ignore */ }
        }

        const overlay = document.createElement("div");
        overlay.className = "ui-profile-choice__overlay";

        const panel = document.createElement("div");
        panel.className = "ui-profile-choice__panel";

        // --- заголовок ---
        const title = document.createElement("div");
        title.className = "ui-profile-choice__title";

        const titleText = document.createElement("span");
        titleText.textContent = "ПРОФИЛИ";
        title.appendChild(titleText);

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "ui-profile-choice__close";
        closeBtn.textContent = "ЗАКРЫТЬ";
        closeBtn.addEventListener("click", close);
        title.appendChild(closeBtn);

        // --- список ---
        const list = document.createElement("ul");
        list.className = "ui-profile-choice__list";

        // --- футер ---
        const footer = document.createElement("div");
        footer.className = "ui-profile-choice__footer";

        const btnNew = document.createElement("button");
        btnNew.type = "button";
        btnNew.className = "ui-profile-choice__btn";
        btnNew.textContent = "НОВЫЙ";
        btnNew.addEventListener("click", createNewProfile);

        const btnOk = document.createElement("button");
        btnOk.type = "button";
        btnOk.className = "ui-profile-choice__btn";
        btnOk.textContent = "ОК";
        btnOk.addEventListener("click", close);

        footer.appendChild(btnNew);
        footer.appendChild(btnOk);

        panel.appendChild(title);
        panel.appendChild(list);
        panel.appendChild(footer);
        overlay.appendChild(panel);

        // клик по фону — закрыть
        overlay.addEventListener("mousedown", (e) => {
            if (e.target === overlay) close();
        });

        document.body.appendChild(overlay);
        _overlay = overlay;
        _listEl  = list;

        // --- ОЗВУЧКА КНОПОК (один вызов на все кнопки сразу) ---
        overlay.addEventListener("click", (e) => {
            const btn = e.target.closest("button");
            if (!btn) return;
            // один вызов озвучки для любой кнопки внутри оверлея
            playClick(); // <-- ваша функция озвучки
        });

        // --- реакция на изменения профилей ---
        _onChanged = () => renderList();
        window.addEventListener("profile-changed", _onChanged);

        document.addEventListener("keydown", onKeyDown, true);

        renderList();

        music.pause();
    }

    // ---------------------------------------------------------
    //  Экспорт точки входа
    // ---------------------------------------------------------
    window.openUiProfileChoice = open;
    window.UiProfileChoice = { open, close };

    console.log("[ui-profile-choice] подключён к ProfileStore. window.openUiProfileChoice готов.");
})();