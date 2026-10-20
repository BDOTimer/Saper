/* ============================================================
   Cassiopeia Radio — переиспользуемый оверлей (без ES-модулей)
   Подключение:
     <script src="radio-overlay.js"></script>
     <script>initRadioOverlay();</script>
   ============================================================ */

(function () {
  const DEFAULT_STREAM = "https://stream.cassiopeia-station.ru:5015/stream";
  const DEFAULT_STATION_URL = "https://cassiopeia-station.ru/";
  const DEFAULT_STATION_NAME = 'Радио «Cassiopeia Station»';
  const STYLE_ID = "cassiopeia-radio-overlay-style";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;

style.textContent = `
  .cro-ui{
    position:fixed;inset:0;z-index:2147483000;
    display:flex;flex-direction:column;
    align-items:center;
    justify-content:flex-start;
    gap:24px;
    padding-top:32px;
    font-family:"Courier New",monospace;
    color:#33ff88;
    user-select:none;
    pointer-events:none;
  }
  .cro-ui > *{pointer-events:auto;}

  /* ===== Большая зелёная кнопка ===== */
  .cro-play-btn{
    width:180px;height:180px;
    border-radius:50%;
    border:2px solid #33ff88;
    background:radial-gradient(circle at 50% 40%,
      rgba(51,255,136,.28) 0%,
      rgba(4,26,14,.95) 70%);
    cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    box-shadow:
      0 0 0 1px rgba(51,255,136,.35),
      0 0 30px rgba(0,255,136,.55),
      0 0 80px rgba(0,255,136,.25),
      inset 0 0 40px rgba(0,255,136,.18);
    transition:all .2s ease;
    padding:0;
  }
  .cro-play-btn:hover{
    box-shadow:
      0 0 0 2px rgba(51,255,136,.7),
      0 0 46px rgba(0,255,136,.8),
      0 0 110px rgba(0,255,136,.4),
      inset 0 0 60px rgba(0,255,136,.3);
  }
  .cro-play-btn:active{transform:scale(.96);}

  .cro-play-btn::before{
    content:"";
    width:0;height:0;
    border-left:56px solid #a8ffd0;
    border-top:34px solid transparent;
    border-bottom:34px solid transparent;
    margin-left:14px;
    filter:drop-shadow(0 0 12px #00ff88);
    transition:all .2s ease;
  }
  .cro-play-btn.cro-playing::before{
    width:44px;height:64px;
    border:none;margin-left:0;
    background:
      linear-gradient(#a8ffd0,#a8ffd0) left/14px 100% no-repeat,
      linear-gradient(#a8ffd0,#a8ffd0) right/14px 100% no-repeat;
    filter:drop-shadow(0 0 12px #00ff88);
  }

  /* ===== Ряд громкости ===== */
  .cro-volume-row{
    display:flex;align-items:center;gap:14px;
    width:min(270px,84vw);
  }

  .cro-mute-btn{
    flex:0 0 auto;
    width:40px;height:40px;
    display:flex;align-items:center;justify-content:center;
    position:relative;
    border:1px solid #33ff88;
    border-radius:4px;
    background:rgba(0,0,0,.35);
    cursor:pointer;padding:0;
    box-shadow:
      0 0 0 1px rgba(51,255,136,.2),
      inset 0 0 12px rgba(0,255,136,.1);
    transition:all .18s ease;
  }
  .cro-mute-btn:hover{
    background:rgba(51,255,136,.12);
    box-shadow:
      0 0 0 1px rgba(51,255,136,.6),
      0 0 18px rgba(0,255,136,.45),
      inset 0 0 16px rgba(0,255,136,.2);
  }
  .cro-mute-btn::before{
    content:"";
    width:9px;height:13px;
    background:#a8ffd0;
    clip-path:polygon(0 35%,35% 35%,75% 0,75% 100%,35% 65%,0 65%);
    filter:drop-shadow(0 0 4px #00ff88);
  }
  .cro-mute-btn::after{
    content:"";
    position:absolute;left:50%;top:50%;
    width:14px;height:14px;
    transform:translate(-50%,-50%);
    border:2px solid #a8ffd0;
    border-left-color:transparent;
    border-top-color:transparent;
    border-bottom-color:transparent;
    border-radius:50%;
    opacity:.85;
    filter:drop-shadow(0 0 4px #00ff88);
  }
  .cro-mute-btn.cro-muted::after{
    width:0;height:0;border:none;
    border-left:15px solid transparent;
    border-right:15px solid transparent;
    border-top:2px solid #ff5555;
    transform:translate(-50%,-50%) rotate(-45deg);
    border-radius:0;opacity:1;
    filter:drop-shadow(0 0 4px #ff5555);
  }
  .cro-mute-btn.cro-muted::before{
    background:#ff5555;
    filter:drop-shadow(0 0 4px #ff5555);
  }

  .cro-volume-slider{
    flex:1 1 auto;
    -webkit-appearance:none;appearance:none;
    height:10px;border-radius:2px;
    background:rgba(0,0,0,.4);
    border:1px solid rgba(51,255,136,.35);
    box-shadow:inset 0 0 8px rgba(0,255,136,.1);
    outline:none;cursor:pointer;margin:0;
  }
  .cro-volume-slider::-webkit-slider-thumb{
    -webkit-appearance:none;appearance:none;
    width:16px;height:16px;border-radius:2px;
    background:#a8ffd0;
    box-shadow:0 0 10px #00ff88;
    cursor:pointer;transition:all .15s ease;
    margin-top:-1px;
  }
  .cro-volume-slider::-webkit-slider-thumb:hover{
    background:#f4ffe8;box-shadow:0 0 18px #00ff88;
  }
  .cro-volume-slider::-moz-range-thumb{
    width:16px;height:16px;border:none;border-radius:2px;
    background:#a8ffd0;box-shadow:0 0 10px #00ff88;cursor:pointer;
  }
  .cro-volume-slider::-moz-range-track{
    height:10px;border-radius:2px;
    background:rgba(0,0,0,.4);
    border:1px solid rgba(51,255,136,.35);
  }
  .cro-volume-slider::-moz-range-progress{
    height:10px;border-radius:2px;
    background:linear-gradient(90deg,rgba(51,255,136,.35),#33ff88);
    box-shadow:0 0 8px rgba(0,255,136,.6);
  }

  .cro-volume-value{
    flex:0 0 auto;min-width:40px;text-align:right;
    font-size:13px;letter-spacing:2px;color:#a8ffd0;
    text-shadow:0 0 6px rgba(0,255,136,.6);
    font-variant-numeric:tabular-nums;
  }

  /* ===== Тонкая кнопка-ссылка на сайт радио ===== */
  .cro-station-link{
    display:inline-block;
    padding:6px 16px;
    font-family:"Courier New",monospace;
    font-size:12px;
    letter-spacing:2px;
    text-transform:uppercase;
    color:#a8ffd0;
    text-decoration:none;
    border:1px solid rgba(51,255,136,.5);
    border-radius:4px;
    background:rgba(0,0,0,.35);
    box-shadow:
      0 0 0 1px rgba(51,255,136,.15),
      inset 0 0 10px rgba(0,255,136,.08);
    text-shadow:0 0 6px rgba(0,255,136,.6);
    transition:all .18s ease;
    white-space:nowrap;
  }
  .cro-station-link:hover{
    color:#eafff2;
    background:rgba(51,255,136,.12);
    border-color:#33ff88;
    box-shadow:
      0 0 0 1px rgba(51,255,136,.6),
      0 0 18px rgba(0,255,136,.45),
      inset 0 0 14px rgba(0,255,136,.2);
  }
  .cro-station-link:active{
    transform:scale(.97);
  }
  `;

    document.head.appendChild(style);
  }

  function initRadioOverlay(opts = {}) {
    const {
      streamUrl = DEFAULT_STREAM,
      stationUrl = DEFAULT_STATION_URL,
      stationName = DEFAULT_STATION_NAME,
      initialVolume = 0.7,
      container = document.body,
    } = opts;

    injectStyles();

    const root = document.createElement("div");
    root.className = "cro-ui";

    const audio = document.createElement("audio");
    audio.preload = "none";
    audio.crossOrigin = "anonymous";
    const source = document.createElement("source");
    source.src = streamUrl;
    source.type = "audio/mpeg";
    audio.appendChild(source);

    const btnPlay = document.createElement("button");
    btnPlay.className = "cro-play-btn";
    btnPlay.setAttribute("aria-label", "Play / Stop");

    const volumeRow = document.createElement("div");
    volumeRow.className = "cro-volume-row";

    const btnMute = document.createElement("button");
    btnMute.className = "cro-mute-btn";
    btnMute.setAttribute("aria-label", "Mute");

    const slider = document.createElement("input");
    slider.className = "cro-volume-slider";
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.setAttribute("aria-label", "Volume");

    const valEl = document.createElement("span");
    valEl.className = "cro-volume-value";

    volumeRow.append(btnMute, slider, valEl);

    const link = document.createElement("a");
    link.className = "cro-station-link";
    link.href = stationUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = stationName;

    root.append(audio, btnPlay, volumeRow, link);
    container.appendChild(root);

    let lastVolume = Math.max(0, Math.min(1, initialVolume));
    audio.volume = lastVolume;
    slider.value = String(Math.round(lastVolume * 100));
    valEl.textContent = slider.value + "%";

    function paintTrack() {
      const pct = slider.value + "%";
      slider.style.background =
        `linear-gradient(90deg, #33ff88 0%, #33ff88 ${pct}, rgba(0,0,0,.4) ${pct}, rgba(0,0,0,.4) 100%)`;
    }
    paintTrack();

    const onPlayClick = () => {
      if (audio.paused) {
        audio.play().catch((err) => console.error("Ошибка воспроизведения:", err));
      } else {
        audio.pause();
      }
    };
    btnPlay.addEventListener("click", onPlayClick);

    const onAudioPlay = () => btnPlay.classList.add("cro-playing");
    const onAudioPause = () => btnPlay.classList.remove("cro-playing");
    audio.addEventListener("play", onAudioPlay);
    audio.addEventListener("pause", onAudioPause);

    const onSliderInput = () => {
      const v = Number(slider.value) / 100;
      audio.volume = v;
      valEl.textContent = slider.value + "%";
      if (v > 0 && audio.muted) {
        audio.muted = false;
        btnMute.classList.remove("cro-muted");
      }
      if (v > 0) lastVolume = v;
      paintTrack();
    };
    slider.addEventListener("input", onSliderInput);

    const onMuteClick = () => {
      audio.muted = !audio.muted;
      btnMute.classList.toggle("cro-muted", audio.muted);
      if (!audio.muted && audio.volume === 0) {
        audio.volume = lastVolume;
        slider.value = String(Math.round(lastVolume * 100));
        valEl.textContent = slider.value + "%";
        paintTrack();
      }
    };
    btnMute.addEventListener("click", onMuteClick);

    function destroy() {
      audio.pause();
      btnPlay.removeEventListener("click", onPlayClick);
      audio.removeEventListener("play", onAudioPlay);
      audio.removeEventListener("pause", onAudioPause);
      slider.removeEventListener("input", onSliderInput);
      btnMute.removeEventListener("click", onMuteClick);
      root.remove();
    }

    return { audio, el: root, destroy };
  }

  // Экспорт в глобальную область
  window.initRadioOverlay = initRadioOverlay;
})();