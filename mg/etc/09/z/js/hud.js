// ============================================================
//  HUD: экран загрузки с прогрессом, меню старт/пауза с полем
//  seed, прицел, debug-панель (F3), тосты.
// ============================================================
window.HUD = (function () {
  var els = {};
  var hooks = {};
  var menuVisible = true;
  var debugOn = false;
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }

  function init(h) {
    hooks = h;
    els = {
      overlay: $('overlay'),
      title: $('title'),
      progressWrap: $('progressWrap'),
      progressFill: $('progressFill'),
      progressLabel: $('progressLabel'),
      menuBody: $('menuBody'),
      seed: $('seedInput'),
      play: $('btnPlay'),
      apply: $('btnApply'),
      rnd: $('btnRandom'),
      debug: $('debug'),
      toast: $('toast'),
      cross: $('crosshair')
    };
    els.play.addEventListener('click', function () { if (hooks.onPlay) hooks.onPlay(); });
    els.apply.addEventListener('click', function () {
      var v = parseInt(els.seed.value, 10);
      if (!isNaN(v) && hooks.onSeed) hooks.onSeed(v >>> 0);
    });
    els.rnd.addEventListener('click', function () { if (hooks.onRandom) hooks.onRandom(); });
  }

  function showProgress() {
    menuVisible = true;
    els.overlay.classList.remove('hidden');
    els.progressWrap.classList.remove('hidden');
    els.menuBody.classList.add('hidden');
    els.cross.classList.add('hidden');
  }
  function progress(label, f) {
    els.progressLabel.textContent = label + '… ' + Math.round(f * 100) + '%';
    els.progressFill.style.width = (f * 100).toFixed(1) + '%';
  }
  function showMenu(mode) {
    menuVisible = true;
    els.overlay.classList.remove('hidden');
    els.progressWrap.classList.add('hidden');
    els.menuBody.classList.remove('hidden');
    els.title.textContent = mode === 'pause' ? 'ПАУЗА' : 'ПЕПЕЛЬНЫЙ ГОРОД';
    els.cross.classList.add('hidden');
  }
  function hideMenu() {
    menuVisible = false;
    els.overlay.classList.add('hidden');
    els.cross.classList.remove('hidden');
  }
  function setSeed(s) { els.seed.value = s; }
  function debug(on) {
    debugOn = on;
    els.debug.classList.toggle('hidden', !on);
  }
  function debugText(t) { if (debugOn) els.debug.textContent = t; }
  function toast(t) {
    els.toast.textContent = t;
    els.toast.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.style.opacity = '0'; }, 2800);
  }
  function isVisible() { return menuVisible; }

  return {
    init: init, showProgress: showProgress, progress: progress,
    showMenu: showMenu, hideMenu: hideMenu, setSeed: setSeed,
    debug: debug, debugText: debugText, toast: toast, isVisible: isVisible
  };
})();
