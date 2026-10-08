/// settings.js
/// Единый объект настроек в памяти. Источник правды для игрового кода.
/// Синхронизируется с текущим профилем ProfileStore.

(function () {
    "use strict";

    const DEFAULTS = {
        isSpawnEnemies:      true,
        isTestDockToStation: false,
        volume:              0.5        // 0..1
    };

    // Текущее состояние в памяти
    const state = Object.assign({}, DEFAULTS);

    // Флаг: идёт ли наша собственная запись (чтобы не ловить свой же profile-changed)
    let _saving = false;

    // --- загрузка из активного профиля (1 раз при старте + при смене профиля) ---
    function loadFromProfile() {
        if (typeof ProfileStore === "undefined" || !ProfileStore.getSettings) {
            console.warn("[settings] ProfileStore недоступен, работаем на дефолтах");
            return;
        }
        const p = ProfileStore.ensure();
        const s = ProfileStore.getSettings(p.id);

        Object.assign(state, DEFAULTS, s);
        console.log("[settings] загружено из профиля:", state);
    }

    // --- сохранение в активный профиль ---
    function save() {
        if (typeof ProfileStore === "undefined" || !ProfileStore.updateSettings) return;
        const p = ProfileStore.ensure();
        _saving = true;
        try {
            ProfileStore.updateSettings(p.id, { ...state });
        } finally {
            _saving = false;
        }
    }

    // --- хелпер ---
    function clampVolume(v) {
        v = Number(v);                          // НЕ parseInt — иначе 0.7 → 0
        if (isNaN(v)) return 0;
        return Math.max(0, Math.min(1, v));     // 0..1
    }

    // --- публичный API ---
    window.Settings = {
        get isSpawnEnemies()       { return state.isSpawnEnemies; },
        set isSpawnEnemies(v)      { state.isSpawnEnemies = !!v; save(); },

        get isTestDockToStation()  { return state.isTestDockToStation; },
        set isTestDockToStation(v) { state.isTestDockToStation = !!v; save(); },

        get volume()               { return state.volume; },
        set volume(v)              { state.volume = clampVolume(v); save(); },

        // служебное
        loadFromProfile,
        save,
        _state: state
    };

    // --- реакция на смену профиля (игнорируем нашу собственную запись) ---
    function onProfileChanged() {
        if (_saving) return;
        loadFromProfile();
    }

    // --- начальная загрузка при старте страницы ---
    loadFromProfile();

    window.addEventListener("profile-changed", onProfileChanged);

//  console.log("[settings] window.Settings готов");
})();