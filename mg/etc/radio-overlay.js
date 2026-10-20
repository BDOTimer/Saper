/*!
 * ══════════════════════════════════════════════════════════════════════
 *   CASSIOPEIA RADIO — OVERLAY PLAYER  (radio-overlay.js)
 * ══════════════════════════════════════════════════════════════════════
 *   Плавающая плашка радиоплеера для ЛЮБОЙ HTML-страницы.
 *   Оформление (плашка, кнопка Play/Stop, mute, слайдер громкости,
 *   ссылка на сайт) сохранено 1:1 из исходного файла.
 *
 *   ── ПОДКЛЮЧЕНИЕ ────────────────────────────────────────────────────
 *   Добавьте ОДНУ строку в конец <body> (или в <head>) страницы:
 *
 *       <script src="radio-overlay.js"></script>
 *
 *   ── ОПЦИОНАЛЬНАЯ НАСТРОЙКА ─────────────────────────────────────────
 *   Через data-атрибуты тега <script>:
 *
 *       <script src="radio-overlay.js"
 *               data-stream="https://stream.cassiopeia-station.ru:5015/stream"
 *               data-site="https://cassiopeia-station.ru/"
 *               data-label="Радио «Cassiopeia Station»"
 *               data-position="bottom-right"
 *               data-scale="0.4"
 *               data-volume="70"
 *               data-z-index="2147483647"></script>
 *
 *       data-position : bottom-right (по умолч.) | bottom-left |
 *                       top-right | top-left | center
 *       data-scale    : масштаб плашки (в исходном дизайне — 0.4)
 *
 *   Либо через глобальную переменную ДО подключения скрипта:
 *
 *       <script>
 *         window.RadioOverlayConfig = { position: 'center', scale: 1 };
 *       </script>
 *       <script src="radio-overlay.js"></script>
 *
 *   ── МИНИ-API (window.RadioOverlay, доступно после загрузки) ────────
 *       RadioOverlay.play()            — запустить поток
 *       RadioOverlay.pause()           — остановить
 *       RadioOverlay.toggle()          — play / pause
 *       RadioOverlay.setVolume(0..100) — громкость
 *       RadioOverlay.getVolume()       — текущая громкость
 *       RadioOverlay.toggleMute()      — вкл/выкл mute
 *       RadioOverlay.getAudioElement() — доступ к <audio>
 *       RadioOverlay.destroy()         — удалить плеер со страницы
 * ══════════════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  /* Защита от повторного подключения */
  if (window.__CASSIOPEIA_RADIO_OVERLAY__) return;
  window.__CASSIOPEIA_RADIO_OVERLAY__ = true;

  /* ───────────────────────── 1. КОНФИГУРАЦИЯ ───────────────────────── */

  var DEFAULTS = {
    streamUrl: 'https://stream.cassiopeia-station.ru:5015/stream',
    siteUrl:   'https://cassiopeia-station.ru/',
    label:     'Радио «Cassiopeia Station»',
    position:  'bottom-right',   // bottom-right | bottom-left | top-right | top-left | center
    scale:     0.4,              // масштаб плашки — как в исходном дизайне
    volume:    70,               // стартовая громкость, %
    zIndex:    2147483647
  };

  var POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center'];

  /* Куда «прижимать» плашку при масштабировании (transform-origin),
     чтобы она визуально садилась точно в выбранный угол экрана */
  var ORIGINS = {
    'bottom-right': '100% 100%',
    'bottom-left':  '0% 100%',
    'top-right':    '100% 0%',
    'top-left':     '0% 0%',
    'center':       'center center'
  };

  var cfg = {};
  var key;
  for (key in DEFAULTS) cfg[key] = DEFAULTS[key];

  /* window.RadioOverlayConfig (если задан до подключения) */
  if (window.RadioOverlayConfig && typeof window.RadioOverlayConfig === 'object') {
    for (key in window.RadioOverlayConfig) cfg[key] = window.RadioOverlayConfig[key];
  }

  /* data-атрибуты тега <script> — наивысший приоритет */
  var scriptEl = document.currentScript;
  if (!scriptEl) {
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      if (/radio-overlay(\.min)?\.js/i.test(all[i].src || '')) { scriptEl = all[i]; break; }
    }
  }
  function attr(name) { return scriptEl ? scriptEl.getAttribute('data-' + name) : null; }

  if (attr('stream'))   cfg.streamUrl = attr('stream');
  if (attr('site'))     cfg.siteUrl   = attr('site');
  if (attr('label'))    cfg.label     = attr('label');
  if (attr('position')) cfg.position  = attr('position');

  var tmp;
  tmp = parseFloat(attr('scale'));    if (!isNaN(tmp) && tmp > 0) cfg.scale = tmp;
  tmp = parseInt(attr('volume'), 10); if (!isNaN(tmp))        cfg.volume = tmp;
  tmp = parseInt(attr('z-index'), 10); if (!isNaN(tmp))       cfg.zIndex = tmp;

  /* нормализация значений */
  cfg.scale = parseFloat(cfg.scale);  if (isNaN(cfg.scale) || cfg.scale <= 0) cfg.scale = DEFAULTS.scale;
  cfg.volume = parseInt(cfg.volume, 10); if (isNaN(cfg.volume)) cfg.volume = DEFAULTS.volume;
  cfg.volume = Math.max(0, Math.min(100, cfg.volume));
  if (POSITIONS.indexOf(cfg.position) === -1) cfg.position = DEFAULTS.position;

  /* ─────────────────────────── 2. СТИЛИ ───────────────────────────── */
  /* Оформление перенесено 1:1 из исходного HTML. Селекторы скоупятся   */
  /* под #radio-overlay, чтобы не конфликтовать со стилями страницы-    */
  /* хозяина. Визуальный результат полностью идентичен оригиналу.       */

  var CSS = `
    /* ── Контейнер-оверлей ── */
    #radio-overlay {
      position: fixed;
      z-index: ${cfg.zIndex};
      font-family: "Courier New", monospace;
      color: #33ff88;
      user-select: none;
      -webkit-user-select: none;
      pointer-events: none; /* кликабельна только сама плашка */
    }
    #radio-overlay.pos-bottom-right { right: 24px; bottom: 24px; }
    #radio-overlay.pos-bottom-left  { left: 24px;  bottom: 24px; }
    #radio-overlay.pos-top-right    { right: 24px; top: 24px; }
    #radio-overlay.pos-top-left     { left: 24px;  top: 24px; }
    #radio-overlay.pos-center       { left: 50%; top: 50%; transform: translate(-50%, -50%); }

    /* ===== Плашка под контролы ===== */
    #radio-overlay .panel {
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;

      padding: 26px 32px 24px;
      border-radius: 22px;

      background:
        radial-gradient(ellipse at 50% 0%,
          rgba(51,255,136,.10) 0%,
          rgba(4,26,14,.85) 55%,
          rgba(0,0,0,.92) 100%);
      border: 1px solid rgba(51,255,136,.28);

      box-shadow:
        0 0 0 1px rgba(51,255,136,.12),
        0 18px 40px -12px rgba(0,0,0,.9),
        0 0 60px -10px rgba(0,255,136,.25),
        inset 0 1px 0 rgba(168,255,208,.10),
        inset 0 -20px 40px -20px rgba(0,255,136,.15);

      transform: scale(0.4); /* фактический масштаб задаётся из конфига */
      transform-origin: center center;
    }

    /* ===== Ссылка на сайт радио (внутри плашки) ===== */
    #radio-overlay .station-link {
      display: inline-block;
      margin-top: 2px;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid rgba(51,255,136,.45);
      background:
        radial-gradient(ellipse at 50% 0%,
          rgba(51,255,136,.10) 0%,
          rgba(4,26,14,.85) 100%);
      color: #a8ffd0;
      font-family: "Courier New", monospace;
      font-size: 13px;
      letter-spacing: 1.2px;
      text-decoration: none;
      text-shadow: 0 0 6px rgba(0,255,136,.6);
      box-shadow:
        0 0 0 1px rgba(51,255,136,.12),
        0 8px 20px -8px rgba(0,0,0,.9),
        0 0 28px -6px rgba(0,255,136,.35),
        inset 0 1px 0 rgba(168,255,208,.10);
      transition: all .2s ease;
      cursor: pointer;
      text-align: center;
    }
    #radio-overlay .station-link:hover {
      color: #f4ffe8;
      border-color: rgba(51,255,136,.85);
      box-shadow:
        0 0 0 1px rgba(51,255,136,.6),
        0 8px 24px -8px rgba(0,0,0,.9),
        0 0 40px -4px rgba(0,255,136,.65),
        inset 0 1px 0 rgba(168,255,208,.18);
      transform: translateY(-1px);
    }
    #radio-overlay .station-link:active {
      transform: translateY(0) scale(.98);
    }

    /* ===== Большая зелёная кнопка ===== */
    #radio-overlay .play-btn {
      width: 180px; height: 100px;
      border-radius: 50%;
      border: 2px solid #33ff88;
      background: radial-gradient(circle at 50% 40%,
        rgba(51,255,136,.28) 0%,
        rgba(4,26,14,.95) 70%);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow:
        0 0 0 1px rgba(51,255,136,.35),
        0 0 30px rgba(0,255,136,.55),
        0 0 80px rgba(0,255,136,.25),
        inset 0 0 40px rgba(0,255,136,.18);
      transition: all .2s ease;
      padding: 0;
    }
    #radio-overlay .play-btn:hover {
      box-shadow:
        0 0 0 2px rgba(51,255,136,.7),
        0 0 46px rgba(0,255,136,.8),
        0 0 110px rgba(0,255,136,.4),
        inset 0 0 60px rgba(0,255,136,.3);
    }
    #radio-overlay .play-btn:active { transform: scale(.96); }

    #radio-overlay .play-btn::before {
      content: "";
      width: 0; height: 0;
      border-left: 56px solid #a8ffd0;
      border-top: 34px solid transparent;
      border-bottom: 34px solid transparent;
      margin-left: 14px;
      filter: drop-shadow(0 0 12px #00ff88);
      transition: all .2s ease;
    }
    #radio-overlay .play-btn.playing::before {
      width: 44px; height: 64px;
      border: none; margin-left: 0;
      background:
        linear-gradient(#a8ffd0,#a8ffd0) left/14px 100% no-repeat,
        linear-gradient(#a8ffd0,#a8ffd0) right/14px 100% no-repeat;
      filter: drop-shadow(0 0 12px #00ff88);
    }

    /* ===== Ряд громкости ===== */
    #radio-overlay .volume-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: min(220px, 84vw);
    }

    #radio-overlay .mute-btn {
      flex: 0 0 auto;
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      position: relative;
      border: 1px solid #33ff88;
      border-radius: 4px;
      background: rgba(0,0,0,.35);
      cursor: pointer;
      padding: 0;
      box-shadow:
        0 0 0 1px rgba(51,255,136,.2),
        inset 0 0 12px rgba(0,255,136,.1);
      transition: all .18s ease;
    }
    #radio-overlay .mute-btn:hover {
      background: rgba(51,255,136,.12);
      box-shadow:
        0 0 0 1px rgba(51,255,136,.6),
        0 0 18px rgba(0,255,136,.45),
        inset 0 0 16px rgba(0,255,136,.2);
    }

    #radio-overlay .mute-btn::before {
      content: "";
      width: 9px; height: 13px;
      background: #a8ffd0;
      clip-path: polygon(0 35%, 35% 35%, 75% 0, 75% 100%, 35% 65%, 0 65%);
      filter: drop-shadow(0 0 4px #00ff88);
    }
    #radio-overlay .mute-btn::after {
      content: "";
      position: absolute;
      left: 50%; top: 50%;
      width: 14px; height: 14px;
      transform: translate(-50%, -50%);
      border: 2px solid #a8ffd0;
      border-left-color: transparent;
      border-top-color: transparent;
      border-bottom-color: transparent;
      border-radius: 50%;
      opacity: .85;
      filter: drop-shadow(0 0 4px #00ff88);
    }
    #radio-overlay .mute-btn.muted::after {
      width: 0; height: 0;
      border: none;
      border-left: 15px solid transparent;
      border-right: 15px solid transparent;
      border-top: 2px solid #ff5555;
      transform: translate(-50%,-50%) rotate(-45deg);
      border-radius: 0;
      opacity: 1;
      filter: drop-shadow(0 0 4px #ff5555);
    }
    #radio-overlay .mute-btn.muted::before {
      background: #ff5555;
      filter: drop-shadow(0 0 4px #ff5555);
    }

    #radio-overlay .volume-slider {
      flex: 1 1 auto;
      -webkit-appearance: none;
      appearance: none;
      height: 3px;
      border-radius: 2px;
      background: rgba(0,0,0,.4);
      border: 1px solid rgba(51,255,136,.35);
      box-shadow: inset 0 0 8px rgba(0,255,136,.1);
      outline: none;
      cursor: pointer;
      margin: 0;
    }
    #radio-overlay .volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px; height: 16px;
      border-radius: 2px;
      background: #a8ffd0;
      box-shadow: 0 0 10px #00ff88;
      cursor: pointer;
      transition: all .15s ease;
      margin-top: -1px;
    }
    #radio-overlay .volume-slider::-webkit-slider-thumb:hover {
      background: #f4ffe8;
      box-shadow: 0 0 18px #00ff88;
    }
    #radio-overlay .volume-slider::-moz-range-thumb {
      width: 16px; height: 16px;
      border: none;
      border-radius: 2px;
      background: #a8ffd0;
      box-shadow: 0 0 10px #00ff88;
      cursor: pointer;
    }
    #radio-overlay .volume-slider::-moz-range-track {
      height: 10px;
      border-radius: 2px;
      background: rgba(0,0,0,.4);
      border: 1px solid rgba(51,255,136,.35);
    }
    #radio-overlay .volume-slider::-moz-range-progress {
      height: 10px;
      border-radius: 2px;
      background: linear-gradient(90deg, rgba(51,255,136,.35), #33ff88);
      box-shadow: 0 0 8px rgba(0,255,136,.6);
    }

    #radio-overlay .volume-value {
      flex: 0 0 auto;
      min-width: 40px;
      text-align: right;
      font-size: 13px;
      letter-spacing: 2px;
      color: #a8ffd0;
      text-shadow: 0 0 6px rgba(0,255,136,.6);
      font-variant-numeric: tabular-nums;
    }
  `;

  /* ─────────────────────── 3. СОСТОЯНИЕ / DOM ─────────────────────── */

  var state = {
    audio: null, btnPlay: null, btnMute: null,
    slider: null, overlay: null,
    lastVolume: cfg.volume / 100
  };

  function injectStyles() {
    if (document.getElementById('radio-overlay-styles')) return;
    var style = document.createElement('style');
    style.id = 'radio-overlay-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildOverlay() {
    /* <audio> — как в оригинале */
    var audio = document.createElement('audio');
    audio.id = 'radio-audio';
    audio.setAttribute('preload', 'none');
    audio.setAttribute('crossorigin', 'anonymous');
    var source = document.createElement('source');
    source.src = cfg.streamUrl;
    source.type = 'audio/mpeg';
    audio.appendChild(source);

    /* контейнер-оверлей */
    var overlay = document.createElement('div');
    overlay.id = 'radio-overlay';
    overlay.className = 'pos-' + cfg.position;

    /* плашка с контролами */
    var panel = document.createElement('div');
    panel.className = 'panel';
    panel.style.transformOrigin = ORIGINS[cfg.position] || 'center center';
    panel.style.transform = 'scale(' + cfg.scale + ')';

    /* большая зелёная кнопка */
    var btnPlay = document.createElement('button');
    btnPlay.id = 'play-toggle';
    btnPlay.className = 'play-btn';
    btnPlay.type = 'button';
    btnPlay.setAttribute('aria-label', 'Play / Stop');

    /* ряд громкости */
    var volumeRow = document.createElement('div');
    volumeRow.className = 'volume-row';

    var btnMute = document.createElement('button');
    btnMute.id = 'mute-toggle';
    btnMute.className = 'mute-btn';
    btnMute.type = 'button';
    btnMute.setAttribute('aria-label', 'Mute');

    var slider = document.createElement('input');
    slider.id = 'volume-slider';
    slider.className = 'volume-slider';
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(cfg.volume);
    slider.setAttribute('aria-label', 'Volume');

    volumeRow.appendChild(btnMute);
    volumeRow.appendChild(slider);

    /* ссылка на сайт радио */
    var link = document.createElement('a');
    link.id = 'station-link';
    link.className = 'station-link';
    link.href = cfg.siteUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = cfg.label;

    panel.appendChild(btnPlay);
    panel.appendChild(volumeRow);
    panel.appendChild(link);
    overlay.appendChild(audio);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    state.audio = audio;
    state.btnPlay = btnPlay;
    state.btnMute = btnMute;
    state.slider = slider;
    state.overlay = overlay;
  }

  /* ──────────────────────── 4. ЛОГИКА (1:1) ───────────────────────── */

  function wireEvents(audio, btnPlay, btnMute, slider) {

    /* Play / Stop */
    btnPlay.addEventListener('click', function () {
      if (audio.paused) {
        audio.play().catch(function (err) {
          console.error('[RadioOverlay] Ошибка воспроизведения:', err);
        });
      } else {
        audio.pause();
      }
    });

    audio.addEventListener('play',  function () { btnPlay.classList.add('playing'); });
    audio.addEventListener('pause', function () { btnPlay.classList.remove('playing'); });

    /* Громкость */
    audio.volume = state.lastVolume;
    slider.value = String(Math.round(state.lastVolume * 100));

    slider.addEventListener('input', function () {
      var v = Number(slider.value) / 100;
      audio.volume = v;
      if (v > 0 && audio.muted) {
        audio.muted = false;
        btnMute.classList.remove('muted');
      }
      if (v > 0) state.lastVolume = v;
    });

    /* Mute */
    btnMute.addEventListener('click', function () {
      audio.muted = !audio.muted;
      btnMute.classList.toggle('muted', audio.muted);
      if (!audio.muted && audio.volume === 0) {
        audio.volume = state.lastVolume;
        slider.value = String(Math.round(state.lastVolume * 100));
      }
    });

    /* Заливка трека слайдера пройденной частью */
    function paintTrack() {
      var pct = slider.value + '%';
      slider.style.background =
        'linear-gradient(90deg, #33ff88 0%, #33ff88 ' + pct +
        ', rgba(0,0,0,.4) ' + pct + ', rgba(0,0,0,.4) 100%)';
    }
    slider.addEventListener('input', paintTrack);
    paintTrack();
  }

  /* ─────────────────────────── 5. МИНИ-API ────────────────────────── */

  var api = {
    play: function () {
      state.audio.play().catch(function (err) {
        console.error('[RadioOverlay] Ошибка воспроизведения:', err);
      });
    },
    pause: function () { state.audio.pause(); },
    toggle: function () {
      if (state.audio.paused) { api.play(); } else { state.audio.pause(); }
    },
    setVolume: function (pct) {
      var p = Math.max(0, Math.min(100, Number(pct) || 0));
      state.slider.value = String(Math.round(p));
      state.slider.dispatchEvent(new Event('input', { bubbles: true }));
    },
    getVolume: function () { return Math.round(state.audio.volume * 100); },
    toggleMute: function () { state.btnMute.click(); },
    getAudioElement: function () { return state.audio; },
    destroy: function () {
      try { state.audio.pause(); } catch (e) { /* ignore */ }
      if (state.overlay && state.overlay.parentNode) {
        state.overlay.parentNode.removeChild(state.overlay);
      }
      var st = document.getElementById('radio-overlay-styles');
      if (st && st.parentNode) st.parentNode.removeChild(st);
      delete window.RadioOverlay;
      window.__CASSIOPEIA_RADIO_OVERLAY__ = false;
    }
  };

  /* ──────────────────────────── 6. СТАРТ ──────────────────────────── */

  function init() {
    injectStyles();
    buildOverlay();
    wireEvents(state.audio, state.btnPlay, state.btnMute, state.slider);
    window.RadioOverlay = api;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
