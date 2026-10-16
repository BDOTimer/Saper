// ============================================================================
//  "g-mus-fon.js" — машина автоматической подачи фоновой музыки
//  для космической игры про звёздные приключения (3D-космос).
// ============================================================================
//
//  ОПИСАНИЕ
//  --------
//  • Наборы mp3-ссылок сгруппированы по ТИПАМ:
//        calm   — спокойная   (мирный полёт среди звёзд)
//        tense  — тревожная   (астероидное поле, враг на радаре)
//        epic   — эпическая   (бой с боссом, грандиозная битва)
//        mystic — загадочная  (неизведанная туманность, древний артефакт)
//        ...    — любые свои типы: добавляются через addTracks()
//
//  • На window.MusFon1 из игры подаются СИГНАЛЫ:
//        window.MusFon1.signal('epic');   // «нужна эпичная музыка»
//    Текущая мелодия ПЛАВНО затухает и начинает играть mp3,
//    соответствующий типу сигнала.
//
//  • Если сигналов нет — текущая мелодия доигрывает до конца,
//    делается пауза T секунд (cfg.pauseT), затем она повторяется
//    или из списка того же типа случайно выбирается новая
//    (cfg.nextMode = 'random' | 'repeat' | 'sequence').
//
//  ПОРЯДОК РАБОТЫ:
//    сигнал ─► плавное затухание ─► PLAYING (новый тип)
//    PLAYING ─► (доиграла, сигналов нет) ─► GAP (пауза T сек) ─► PLAYING...
//    Любой сигнал во время GAP мгновенно включает музыку нужного типа.
//
//  ПРИМЕЧАНИЕ: браузеры запрещают звук до первого клика/клавиши игрока.
//  Машина сама запустит «зависшую» мелодию при первом же жесте.
// ============================================================================

'use strict';

class MusFon1
{
    constructor()
    {
        /* -------------------- НАСТРОЙКИ (можно менять на лету) -------------------- */
        this.cfg = {
            fadeOut  : 2.5,      // сек — плавное затухание текущей темы
            fadeIn   : 2.0,      // сек — плавное нарастание новой темы
            pauseT   : 4.0,      // сек — пауза T между мелодиями (без сигналов)
            crossfade: true,     // true  — темы плавно перекрещиваются;
                                 // false — сначала полное затухание, потом новая
            nextMode : 'random', // 'random' — случайная | 'repeat' — повторять
                                 // 'sequence' — по списку по кругу
            loop     : true,     // крутить музыку бесконечно, до stop()
            volume   : 0.8,      // общая громкость 0..1
            debug    : false     // служебные логи в консоль
        };

        /* --------------- ПСЕВДОНИМЫ ТИПОВ (можно сигналить по-русски) ------------- */
        this.aliases = {
            'спокойная' : 'calm',  'спокойно' : 'calm',  'мир'        : 'calm',
            'тревожная' : 'tense', 'тревога'  : 'tense', 'опасность'  : 'tense',
            'эпическая': 'epic',  'эпичная'  : 'epic',  'эпик'       : 'epic',
            'битва'     : 'epic',  'босс'     : 'epic',
            'загадочная': 'mystic', 'тайна'   : 'mystic', 'туманность': 'mystic'
        };

        /* ------------------------ БИБЛИОТЕКА: тип → [url] ------------------------- */
        this.library = {};

        /* --------------------------- СОСТОЯНИЕ МАШИНЫ ------------------------------ */
        this.state        = 'silent'; // silent | switching | playing | gap
        this.type         = null;     // звучащий сейчас тип музыки
        this.lastSignal   = 0;        // Date.now() последнего сигнала (для игры)
        this._lastUrl     = null;
        this._index       = -1;       // курсор трека (для режима sequence)
        this._act         = null;     // «громкий» канал: this._a или this._b
        this._timer       = null;     // таймер паузы T
        this._wantPlay    = null;     // отложенный старт (обход autoplay-блокировки)
        this._switchingTo = null;
        this._gestureBound= false;

        /* ------------------------------ ХУКИ-СОБЫТИЯ -------------------------------- */
        this.onTrackStart = null;     // (type, url) => {}
        this.onTrackEnd   = null;     // (type, url) => {}
        this.onGap        = null;     // (pauseSec)  => {}

        /* ---------- ДВА АУДИО-КАНАЛА (пара нужна для кроссфейда) ------------------- */
        this._a = this._mkAudio();
        this._b = this._mkAudio();

        this.init();
    }

    init()
    {   this.
        addTracks('calm', [
            'snd/fon/calm/c01.mp3',   // мирный дрейф среди звёзд
            'snd/fon/calm/c02.mp3',
            'snd/fon/calm/c03.mp3',
            'snd/fon/calm/c04.mp3'
        ])
        .addTracks('dock', [
            'snd/fon/dock/d01.mp3',
            'snd/fon/dock/d02.mp3',
            'snd/fon/dock/d03.mp3',
        ])
        .addTracks('tense', [
            'snd/fon/tense/d01.mp3',  // астероидное поле
            'snd/fon/tense/t02.mp3',  // враг на радаре
            'snd/fon/tense/t03.mp3',
        ])
        .addTracks('epic', [
            'snd/fon/epic/e01.mp3',   // бой с боссом
            'snd/fon/epic/e02.mp3',
            'snd/fon/epic/e03.mp3',
            'snd/fon/epic/e04.mp3',
        ])
        .addTracks('mystic', [
            'music/nebula.mp3'        // загадочная туманность
        ]);
        //.start('calm');
    }

    /* ══════════════════════════════════════════════════════════════════════
       ПУБЛИЧНОЕ API — СИГНАЛЫ ИЗ ИГРЫ
       ══════════════════════════════════════════════════════════════════════ */

    /**
     * ГЛАВНЫЙ СИГНАЛ: «сейчас нужна музыка типа type».
     * Текущая тема плавно гаснет, включается тема нового типа.
     * Повторный сигнал того же типа поглощается (можно звать каждый кадр).
     */
    signal(type)
    {
        type = this._alias(type);
        this.lastSignal = Date.now();

        const list = this.library[type];
        if (!list || !list.length)
        {
            this._log('сигнал "' + type + '" отклонён: для типа нет треков');
            return this;
        }

        // Нужное уже играет (или уже переключаемся на него) — сигнал поглощается
        if ((this.type === type && this.state === 'playing') ||
             this._switchingTo === type)
        {
            return this;
        }

        this._log('>>> СИГНАЛ: ' + type + '   (было: ' + this.type + ')');
        this._switchTo(type);
        return this;
    }

    /** Запустить музыку (синоним signal — удобно для старта игры). */
    start(type) { return this.signal(type); }

    /** Псевдоним signal: «подать сигнал на машину». */
    push(type)  { return this.signal(type); }

    /** Плавно остановить всю музыку. */
    stop(fadeSec)
    {
        this._stopGap();
        this._wantPlay    = null;
        this._switchingTo = null;

        const el = this._act;
        if (el && !el.paused)
        {
            const t = (fadeSec === undefined) ? this.cfg.fadeOut : fadeSec;
            this._fade(el, this._gain(el), 0, t, () => el.pause());
        }

        this.state = 'silent';
        this.type  = null;
        return this;
    }

    /** Полная остановка и освобождение ресурсов. */
    destroy()
    {
        this.stop(0);
        for (const el of [this._a, this._b])
        {
            this._stopFade(el);
            el.pause();
            el.removeAttribute('src');
            el.load();
        }
    }

    /* ----------------------------- РЕЕСТР ТРЕКОВ ------------------------------ */

    /** Добавить треки к типу: addTracks('epic', [url1, url2]). */
    addTracks(type, urls)
    {
        type = this._alias(type);
        const add = Array.isArray(urls) ? urls.slice() : [urls];
        this.library[type] = (this.library[type] || []).concat(add);
        this._log('+"' + type + '": ' + add.length + ' трек(ов)');
        return this;
    }

    /** Полностью заменить список треков типа. */
    setTracks(type, urls)
    {
        type = this._alias(type);
        this.library[type] = Array.isArray(urls) ? urls.slice() : [urls];
        return this;
    }

    /* -------------------------------- ПРОЧЕЕ ----------------------------------- */

    /** Общая громкость 0..1 (идущие фейды при этом не сбиваются). */
    setVolume(v)
    {
        this.cfg.volume = Math.max(0, Math.min(1, v));
        for (const el of [this._a, this._b])
            el.volume = (el._gain || 0) * this.cfg.volume;
        return this;
    }

    /** Мгновенная пауза (например, игрок открыл меню). */
    pause() { if (this._act) this._act.pause(); return this; }

    /** Снять мгновенную паузу. */
    resume()
    {
        if (this._act && this.state === 'playing')
        {
            const p = this._act.play();
            if (p && p.catch) p.catch(() => {});
        }
        return this;
    }

    /** Что играет прямо сейчас. */
    info() { return { state: this.state, type: this.type, url: this._lastUrl }; }

    /* ══════════════════════════════════════════════════════════════════════
       ВНУТРЕННЯЯ КУХНЯ
       ══════════════════════════════════════════════════════════════════════ */

    _mkAudio()
    {
        const a = new Audio();
        a.preload = 'auto';
        a.addEventListener('ended', () => this._onEnded(a));
        a.addEventListener('error', () => this._log('ошибка загрузки: ' + (a.src || '?')));
        return a;
    }

    /** Свободный (негромкий) канал. */
    _free() { return (this._act === this._a) ? this._b : this._a; }

    /** Переключение на нужный тип с плавным переходом. */
    _switchTo(type)
    {
        this._stopGap();

        const url = this._pickTrack(type);
        if (!url) return;

        this._switchingTo = type;
        this.state = 'switching';

        const old     = this._act;
        const oldLoud = !!(old && !old.paused);

        if (oldLoud)
        {
            // Плавно гасим текущую тему
            this._fade(old, this._gain(old), 0, this.cfg.fadeOut, () =>
            {
                old.pause();
                // Строгий режим (crossfade=false): новую тему заводим ПОСЛЕ затухания
                if (!this.cfg.crossfade && this._switchingTo === type)
                    this._startTrack(url, type);
            });
        }

        // Кроссфейд: новая тема нарастает, пока старая ещё «догорает»
        if (this.cfg.crossfade || !oldLoud)
            this._startTrack(url, type);
    }

    /** Запустить мелодию на свободном канале с плавным нарастанием. */
    _startTrack(url, type)
    {
        this._switchingTo = null;
        this._wantPlay    = null;

        const el = this._free();
        this._act = el;

        this._stopFade(el);           // снять зависший фейд канала, если был

        this.type     = type;
        this._lastUrl = url;
        this.state    = 'playing';

        el._gain  = 0;
        el.volume = 0;
        el.src    = url;

        const fade = () => this._fade(el, 0, 1, this.cfg.fadeIn);

        const p = el.play();
        if (p && p.then)
        {
            p.then(fade).catch(() =>
            {
                // Браузер запретил автозвук — включим при первом же жесте игрока
                this._wantPlay = { el: el };
                this._bindGesture();
            });
        }
        else fade();

        this._log('♫ играет [' + type + '] ' + url);
        if (this.onTrackStart) this.onTrackStart(type, url);
    }

    /** Мелодия сама доиграла до конца (сигналов на смену не было). */
    _onEnded(el)
    {
        if (el !== this._act) return;         // закончился затухающий канал — не важно
        if (this.state !== 'playing') return; // идёт переключение/стоп — не важно

        const type = this.type, url = this._lastUrl;
        if (this.onTrackEnd) this.onTrackEnd(type, url);

        if (!this.cfg.loop)
        {
            this.state = 'silent';
            this.type  = null;
            return;
        }

        // Нет сигналов: пауза T секунд → повтор или новая мелодия того же типа
        this.state = 'gap';
        if (this.onGap) this.onGap(this.cfg.pauseT);

        this._stopGap();
        this._timer = setTimeout(() => this._next(),
                                 Math.max(0, this.cfg.pauseT) * 1000);
    }

    /** Продолжение после паузы T. */
    _next()
    {
        this._timer = null;
        if (this.state !== 'gap') return;

        const url = this._pickTrack(this.type);
        if (!url) { this.state = 'silent'; this.type = null; return; }

        this._startTrack(url, this.type);
    }

    /** Выбрать мелодию согласно cfg.nextMode. */
    _pickTrack(type)
    {
        const list = this.library[type] || [];
        if (!list.length) return null;

        const same = (type === this.type && !!this._lastUrl &&
                      list.indexOf(this._lastUrl) !== -1);

        switch (this.cfg.nextMode)
        {
            case 'repeat':    // повторять одну и ту же мелодию
                return same ? this._lastUrl
                            : list[(Math.random() * list.length) | 0];

            case 'sequence':  // идти по списку по кругу
                this._index = same ? (this._index + 1) % list.length : 0;
                return list[this._index];

            case 'random':    // случайная, стараясь не повторять подряд
            default:
                if (list.length < 2) return list[0];
                let i = 0, guard = 0;
                do { i = (Math.random() * list.length) | 0; }
                while (same && list[i] === this._lastUrl && ++guard < 16);
                this._index = i;
                return list[i];
        }
    }

    /** Плавно изменить громкость канала: g0 → g1 за sec секунд. */
    _fade(el, g0, g1, sec, done)
    {
        this._stopFade(el);

        g0  = Math.max(0, Math.min(1, g0));
        g1  = Math.max(0, Math.min(1, g1));
        sec = Math.max(0, sec);

        if (sec === 0 || g0 === g1)
        {
            el._gain  = g1;
            el.volume = g1 * this.cfg.volume;
            if (done) done();
            return;
        }

        const dt    = 50;                               // шаг обновления, мс
        const steps = Math.max(1, Math.round(sec * 1000 / dt));
        const dg    = (g1 - g0) / steps;
        let   g     = g0, n = 0;

        el._fadeId = setInterval(() =>
        {
            n++; g += dg;
            if (n >= steps || (dg > 0 ? g >= g1 : g <= g1)) g = g1;

            el._gain  = g;
            el.volume = g * this.cfg.volume;

            if (g === g1)
            {
                this._stopFade(el);
                if (done) done();
            }
        }, dt);
    }

    _stopFade(el)
    {
        if (el && el._fadeId)
        {
            clearInterval(el._fadeId);
            el._fadeId = null;
        }
    }

    _gain(el) { return (el && el._gain) || 0; }

    _stopGap()
    {
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    }

    /** Русские/заглавные псевдонимы типа → канонический ключ. */
    _alias(type)
    {
        if (typeof type !== 'string') return type;
        const t = type.trim().toLowerCase();
        return this.aliases[t] || t;
    }

    /** Обход autoplay-блокировки: ждём первый жест игрока. */
    _bindGesture()
    {
        if (this._gestureBound) return;
        this._gestureBound = true;

        const unlock = () =>
        {
            this._gestureBound = false;
            ['pointerdown', 'keydown', 'touchstart']
                .forEach(e => window.removeEventListener(e, unlock));

            const w = this._wantPlay;
            if (w)
            {
                this._wantPlay = null;
                const p = w.el.play();
                if (p && p.then)
                    p.then(() => this._fade(w.el, this._gain(w.el), 1, this.cfg.fadeIn))
                     .catch(() => {});
            }
        };

        ['pointerdown', 'keydown', 'touchstart']
            .forEach(e => window.addEventListener(e, unlock, { passive: true }));
    }

    _log(msg)
    {
        if (this.cfg.debug) console.log('%c[MusFon1] ' + msg, 'color:#7fd4ff');
    }
}

/* ============================================================================
   ГЛОБАЛЬНЫЙ ЭКЗЕМПЛЯР — ПРИЁМНИК СИГНАЛОВ ИЗ ИГРЫ
   (из кода игры обращаемся именно через window.MusFon1)
   ========================================================================== */
window.MusFon1 = new MusFon1();


/* ============================================================================
   ПРИМЕР ИНИЦИАЛИЗАЦИИ ДЛЯ КОСМИЧЕСКОЙ ИГРЫ «ЗВЁЗДНЫЕ ПРИКЛЮЧЕНИЯ»
   (раскомментируйте и подставьте свои mp3)

window.MusFon1
    .addTracks('calm', [
        'music/space_calm_1.mp3',    // мирный дрейф среди звёзд
        'music/space_calm_2.mp3',
        'music/space_calm_3.mp3'
    ])
    .addTracks('tense', [
        'music/asteroid_field.mp3', // астероидное поле
        'music/enemy_close.mp3'      // враг на радаре
    ])
    .addTracks('epic', [
        'music/boss_battle.mp3',    // бой с боссом
        'music/final_battle.mp3'
    ])
    .addTracks('mystic', [
        'music/nebula.mp3'          // загадочная туманность
    ])
    .start('calm');

// Тонкая настройка:
window.MusFon1.cfg.pauseT   = 6;        // пауза T = 6 секунд
window.MusFon1.cfg.nextMode = 'repeat'; // повторять одну и ту же мелодию
window.MusFon1.setVolume(0.5);

// Быстрый тест без своих файлов (демо-треки SoundHelix):
window.MusFon1.setTracks('calm',  ['https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3']);
window.MusFon1.setTracks('tense', ['https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3']);
window.MusFon1.setTracks('epic',  ['https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3']);
window.MusFon1.cfg.debug = true;
window.MusFon1.start('calm');
============================================================================ */