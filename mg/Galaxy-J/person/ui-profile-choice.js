/// ui-profile-choice.js
/// Заглушка для теста кнопки "ПРОФИЛИ" в ui-input-name.js.
/// Реальная логика будет позже — сейчас просто показывает модалку
/// в стиле g-menu.html и логирует действия.
/// ---
/// Контракт (см. ui-input-name.js → _openProfilesChoice):
///     window.openUiProfileChoice = function () { ... }
/// ---
/// Хранение:
///     - ничего не трогает localStorage напрямую.
///     - если есть ProfileStore — читает список профилей только для отображения.
/// ---

(function () {
    "use strict";

    // ---------------------------------------------------------
    //  Стили (инжектируем один раз)
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
                width: min(420px, 86vw);
                max-height: 78vh;
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
                gap: 10px;
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
                justify-content: flex-end;
                gap: 8px;
            }

            .ui-profile-choice__btn {
                width: 40%;
                box-sizing: border-box;
                background: rgba(168, 255, 120, 0.15);
                border: 2px solid #a8ff78;
                color: #a8ff78;
                border-radius: 10px;
                font-family: inherit;
                font-weight: bold;
                letter-spacing: 2px;
                cursor: pointer;
                padding: 7px 12px;
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
    //  Модалка
    // ---------------------------------------------------------
    let _overlay = null;

    function close() {
        if (!_overlay) return;
        const el = _overlay;
        _overlay = null;
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

    function readProfiles() {
        // Мягкое чтение — если ProfileStore есть, покажем его данные.
        try {
            if (typeof ProfileStore !== "undefined") {
                if (typeof ProfileStore.list === "function") {
                    return ProfileStore.list() || [];
                }
                if (typeof ProfileStore.getAll === "function") {
                    return ProfileStore.getAll() || [];
                }
                const active = ProfileStore.ensure && ProfileStore.ensure();
                if (active) return [active];
            }
        } catch (e) {
            console.warn("ui-profile-choice: не удалось прочитать ProfileStore:", e);
        }
        return [];
    }

    function open() {
        injectStyles();

        if (_overlay) {
            // уже открыта — просто мигнём
            _overlay.style.opacity = "0.7";
            setTimeout(() => { if (_overlay) _overlay.style.opacity = "1"; }, 60);
            return;
        }

        const overlay = document.createElement("div");
        overlay.className = "ui-profile-choice__overlay";

        const panel = document.createElement("div");
        panel.className = "ui-profile-choice__panel";

        // --- заголовок ---
        const title = document.createElement("div");
        title.className = "ui-profile-choice__title";
        title.innerHTML = `<span>ПРОФИЛИ (заглушка)</span>`;

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "ui-profile-choice__close";
        closeBtn.textContent = "ЗАКРЫТЬ";
        closeBtn.addEventListener("click", close);
        title.appendChild(closeBtn);

        // --- список ---
        const list = document.createElement("ul");
        list.className = "ui-profile-choice__list";

        const profiles = readProfiles();
        let activeId = null;
        try {
            if (typeof ProfileStore !== "undefined" && ProfileStore.ensure) {
                const a = ProfileStore.ensure();
                if (a) activeId = a.id;
            }
        } catch (_) { /* ignore */ }

        if (!profiles.length) {
            const empty = document.createElement("div");
            empty.className = "ui-profile-choice__empty";
            empty.textContent = "ПРОФИЛЕЙ НЕТ (или ProfileStore не подключён)";
            panel.appendChild(title);
            panel.appendChild(empty);
        } else {
            profiles.forEach((p, i) => {
                const li = document.createElement("li");
                li.className = "ui-profile-choice__item";
                if (p && p.id === activeId) li.dataset.active = "true";

                const nameEl = document.createElement("span");
                nameEl.className = "ui-profile-choice__name";
                nameEl.textContent = (p && p.name) ? p.name : `профиль #${i + 1}`;

                li.appendChild(nameEl);

                if (p && p.id === activeId) {
                    const badge = document.createElement("span");
                    badge.className = "ui-profile-choice__badge";
                    badge.textContent = "АКТИВНЫЙ";
                    li.appendChild(badge);
                }

                li.addEventListener("click", () => {
                    console.log("[ui-profile-choice] выбран профиль:", p);
                    // TODO: реальное переключение профиля — позже.
                    // Сейчас просто шлём событие-заглушку.
                    try {
                        window.dispatchEvent(new CustomEvent("profile-choice-selected", {
                            detail: { profile: p }
                        }));
                    } catch (_) { /* ignore */ }
                    close();
                });

                list.appendChild(li);
            });

            panel.appendChild(title);
            panel.appendChild(list);
        }

        // --- футер ---
        const footer = document.createElement("div");
        footer.className = "ui-profile-choice__footer";

        const btnNew = document.createElement("button");
        btnNew.type = "button";
        btnNew.className = "ui-profile-choice__btn";
        btnNew.textContent = "НОВЫЙ";
        btnNew.addEventListener("click", () => {
            console.log("[ui-profile-choice] НОВЫЙ профиль (заглушка)");
        });

        const btnOk = document.createElement("button");
        btnOk.type = "button";
        btnOk.className = "ui-profile-choice__btn";
        btnOk.textContent = "ОК";
        btnOk.addEventListener("click", close);

        footer.appendChild(btnNew);
        footer.appendChild(btnOk);
        panel.appendChild(footer);

        overlay.appendChild(panel);

        // клик по фону — закрыть
        overlay.addEventListener("mousedown", (e) => {
            if (e.target === overlay) close();
        });

        document.body.appendChild(overlay);
        _overlay = overlay;

        document.addEventListener("keydown", onKeyDown, true);

        console.log("[ui-profile-choice] открыто (заглушка). Профилей:", profiles.length);
    }

    // ---------------------------------------------------------
    //  Экспорт точки входа (контракт с ui-input-name.js)
    // ---------------------------------------------------------
    window.openUiProfileChoice = open;
    window.UiProfileChoice = {
        open,
        close,
    };

    console.log("[ui-profile-choice] заглушка загружена. window.openUiProfileChoice готов.");
})();