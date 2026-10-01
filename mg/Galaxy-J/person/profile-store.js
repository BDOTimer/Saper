/// profile-store.js
/// Хранилище профилей игрока поверх localStorage.
/// ---
/// Идея:
///     - каждый профиль — отдельный ключ localStorage: "galaxy.profile.<id>"
///     - список id профилей — в "galaxy.profiles"
///     - активный id — в "galaxy.currentProfile"
///     - черновик имени (когда профиля ещё нет) — в "galaxy.player.name"
/// ---
/// Идентификатор профиля:
///     - формируется как "p_<base36 времени>_<случайный суффикс>"
///     - НЕ совпадает с именем игрока
///     - не меняется при переименовании
/// ---
/// Публичные методы:
///     list()                  — массив id профилей
///     hasAny()                — есть ли хоть один профиль
///     load(id)                — объект профиля или null
///     current()               — объект активного профиля или null
///     currentId()             — id активного профиля или null
///     setCurrent(id)          — сделать активным
///     create(name)            — создать профиль, вернуть объект
///     rename(id, name)        — переименовать профиль
///     saveGame(id, saveData)  — записать save-поле профиля
///     remove(id)              — удалить профиль
///     getNameForUI()          — имя для UI (профиль или черновик)
///     setDraftName(name)      — записать имя в черновик
/// ---
/// События (window):
///     - "profile-changed" — общий сигнал: создан/удалён/переключён/переименован.
///       detail = { id, profile }   (profile может быть null при удалении)
///
///     Ловится так:
///     window.addEventListener("profile-changed", (e) => {
///         console.log("profile-changed:", e.detail);
///     });

class ProfileStore
{
    // ---------- Ключи localStorage ----------
    static KEY_LIST    = "galaxy.profiles";
    static KEY_CURRENT = "galaxy.currentProfile";
    static KEY_DRAFT   = "galaxy.player.name";

    // ---------- Идентификатор ключа профиля ----------
    static keyProfile(id)
    {
        // "000" → для читаемости коротких id, но не ломает произвольные строки
        return "galaxy.profile." + String(id);
    }

    // =========================================================
    //  ИДЕНТИФИКАТОРЫ
    // =========================================================

    /** Сгенерировать новый id профиля. */
    static _newId()
    {
        const ts = Date.now().toString(36);
        const rnd = Math.random().toString(36).slice(2, 6);
        return "p_" + ts + "_" + rnd;
    }

    // =========================================================
    //  ЧТЕНИЕ
    // =========================================================

    /** Все id профилей. */
    static list()
    {
        try {
            const raw = localStorage.getItem(this.KEY_LIST);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    /** Есть ли хоть один профиль. */
    static hasAny()
    {
        return this.list().length > 0;
    }

    /** Прочитать профиль по id. Возвращает объект или null. */
    static load(id)
    {
        if (!id) return null;
        try {
            const raw = localStorage.getItem(this.keyProfile(id));
            if (!raw) return null;
            const obj = JSON.parse(raw);
            return (obj && typeof obj === "object") ? obj : null;
        } catch (e) {
            return null;
        }
    }

    /** Текущий активный профиль (или null). */
    static current()
    {
        const id = this.currentId();
        return id ? this.load(id) : null;
    }

    /** id текущего активного профиля (или null). */
    static currentId()
    {
        try {
            const id = localStorage.getItem(this.KEY_CURRENT);
            return id || null;
        } catch (e) {
            return null;
        }
    }

    // =========================================================
    //  ЗАПИСЬ — служебное
    // =========================================================

    static _saveList(ids)
    {
        try {
            localStorage.setItem(this.KEY_LIST, JSON.stringify(ids));
            return true;
        } catch (e) {
            return false;
        }
    }

    static _writeProfile(profile)
    {
        try {
            localStorage.setItem(this.keyProfile(profile.id), JSON.stringify(profile));
            return true;
        } catch (e) {
            return false;
        }
    }

    /** Служебное: сообщить окну об изменении. */
    static _emit(id, profile)
    {
        try {
            window.dispatchEvent(new CustomEvent("profile-changed", {
                detail: { id: id || null, profile: profile || null }
            }));
        } catch (e) { /* ignore */ }
    }

    // =========================================================
    //  ПУБЛИЧНОЕ API
    // =========================================================

    /** Сделать профиль активным. */
    static setCurrent(id)
    {
        if (!id) return false;
        const p = this.load(id);
        if (!p) return false;

        try {
            localStorage.setItem(this.KEY_CURRENT, id);
        } catch (e) {
            return false;
        }

        this._emit(id, p);
        return true;
    }

    /**
     * Создать новый профиль.
     * @param  {string} name — имя игрока (может быть пустым).
     * @return {object|null} — объект профиля или null при ошибке.
     */
    static create(name)
    {
        const cleanName = (typeof name === "string" && name.trim())
            ? name.trim()
            : (this.getDraftName() || "Анонимус-1917");

        const now = new Date().toISOString();

        const profile = {
            id:         this._newId(),
            name:       cleanName,
            created:    now,
            lastPlayed: now,
            save:       null,
            stats: {
                score: 0,
                rank:  "HARMLESS"
            }
        };

        // 1. сам профиль
        if (!this._writeProfile(profile)) {
            return null;
        }

        // 2. индекс
        const ids = this.list();
        ids.push(profile.id);
        if (!this._saveList(ids)) {
            // откат: убрать "осиротевший" профиль
            try { localStorage.removeItem(this.keyProfile(profile.id)); } catch (e) {}
            return null;
        }

        // 3. сделать активным
        try {
            localStorage.setItem(this.KEY_CURRENT, profile.id);
        } catch (e) {
            /* не критично: профиль создан, просто не стал активным */
        }

        this._emit(profile.id, profile);
        return profile;
    }

    /** Переименовать профиль по id. */
    static rename(id, name)
    {
        const cleanName = (typeof name === "string" && name.trim()) ? name.trim() : "";
        if (!id || !cleanName) return false;

        const p = this.load(id);
        if (!p) return false;

        p.name = cleanName;
        if (!this._writeProfile(p)) return false;

        this._emit(id, p);
        return true;
    }

    /** Сохранить поле save у профиля. */
    static saveGame(id, saveData)
    {
        const p = this.load(id);
        if (!p) return false;

        p.save = saveData || null;
        p.lastPlayed = new Date().toISOString();

        if (!this._writeProfile(p)) return false;

        this._emit(id, p);
        return true;
    }

    /** Удалить профиль по id. */
    static remove(id)
    {
        if (!id) return false;

        const ids = this.list();
        const idx = ids.indexOf(id);
        if (idx === -1) return false;

        // 1. убрать из индекса
        ids.splice(idx, 1);
        this._saveList(ids);

        // 2. удалить сам профиль
        try { localStorage.removeItem(this.keyProfile(id)); } catch (e) {}

        // 3. если удалили активный — сбросить или переключить на первый
        if (this.currentId() === id) {
            try {
                if (ids.length > 0) {
                    localStorage.setItem(this.KEY_CURRENT, ids[0]);
                } else {
                    localStorage.removeItem(this.KEY_CURRENT);
                }
            } catch (e) { /* ignore */ }
        }

        this._emit(id, null);
        return true;
    }

    // =========================================================
    //  ЧЕРНОВИК ИМЕНИ (когда профиля ещё нет)
    // =========================================================

    /** Имя для UI: из активного профиля, иначе — из черновика. */
    static getNameForUI()
    {
        const p = this.current();
        if (p && p.name) return p.name;

        const draft = this.getDraftName();
        if (draft) return draft;

        return "Анонимус-1917";
    }

    /** Прочитать черновик имени. */
    static getDraftName()
    {
        try {
            const v = localStorage.getItem(this.KEY_DRAFT);
            return (v && v.trim()) ? v : "";
        } catch (e) {
            return "";
        }
    }

    /** Записать имя в черновик. */
    static setDraftName(name)
    {
        const cleanName = (typeof name === "string" && name.trim()) ? name.trim() : "";
        if (!cleanName) return false;
        try {
            localStorage.setItem(this.KEY_DRAFT, cleanName);
            return true;
        } catch (e) {
            return false;
        }
    }

    // =========================================================
    //  ОТЛАДКА
    // =========================================================

    /** Диагностика — что видно в DevTools. */
    static debugDump()
    {
        const ids = this.list();
        const cur = this.currentId();

        const rows = ids.map(id => {
            const p = this.load(id);
            if (!p) {
                return { id, name: "<битый>", lastPlayed: "", score: "", current: id === cur };
            }
            return {
                id,
                name:       p.name || "",
                lastPlayed: p.lastPlayed || "",
                score:      (p.stats && p.stats.score) || 0,
                current:    id === cur
            };
        });

        // eslint-disable-next-line no-console
        console.table(rows);
        return rows;
    }

    /** Полная очистка хранилища профилей (для тестов). */
    static _wipe()
    {
        const ids = this.list();
        for (const id of ids) {
            try { localStorage.removeItem(this.keyProfile(id)); } catch (e) {}
        }
        try {
            localStorage.removeItem(this.KEY_LIST);
            localStorage.removeItem(this.KEY_CURRENT);
            localStorage.removeItem(this.KEY_DRAFT);
        } catch (e) {}
    }

    // =========================================================
    //  ТЕСТ
    // =========================================================

    static _test()
    {
        // eslint-disable-next-line no-console
        console.group("ProfileStore._test");

        this._wipe();

        console.log("hasAny (после wipe) =", this.hasAny());              // false
        console.log("list    (после wipe) =", this.list());                // []

        const a = this.create("Анонимус-1917");
        console.log("create A =", a);                                       // { id, name, ... }
        console.log("hasAny =", this.hasAny());                             // true
        console.log("current =", this.current()?.name);                     // "Анонимус-1917"

        const b = this.create("Сокол");
        console.log("create B =", b);

        console.log("list =", this.list());                                 // [A.id, B.id]
        console.log("current =", this.current()?.name);                     // "Сокол"

        this.setCurrent(a.id);
        console.log("после setCurrent(A) =", this.current()?.name);         // "Анонимус-1917"

        this.rename(a.id, "Соколиный Глаз");
        console.log("после rename(A) =", this.current()?.name);             // "Соколиный Глаз"

        this.saveGame(a.id, { ship: "Cobra", credits: 100, sector: 7 });
        console.log("после saveGame(A) =", this.load(a.id)?.save);

        this.remove(b.id);
        console.log("после remove(B), list =", this.list());                // [A.id]
        console.log("current =", this.current()?.name);                     // "Соколиный Глаз"

        this.debugDump();

        console.groupEnd();
    }
}

// -----------------------------------------|
//  Экспорт ...
// -----------------------------------------:
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = ProfileStore;
} else {
    window.ProfileStore = ProfileStore;
}