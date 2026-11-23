// ============================================================
//  HUD: экран загрузки с прогрессом, меню старт/пауза с полем
//  seed, прицел, debug-панель (F3), тосты + БОЕВОЙ HUD:
//  здоровье, оружие/патроны, счёт убийств, хитмаркер, виньетка
//  урона с направлением на стрелка, лента убийств, экран смерти.
// ============================================================
window.HUD = (function () {
  var els = {};
  var hooks = {};
  var menuVisible = true;
  var debugOn = false;
  var toastTimer = null;
  var hmTimer = null;
  var dmgTimer = null;

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
      deathBody: $('deathBody'),
      deathKills: $('deathKills'),
      deathSeed: $('deathSeed'),
      seed: $('seedInput'),
      play: $('btnPlay'),
      apply: $('btnApply'),
      rnd: $('btnRandom'),
      respawn: $('btnRespawn'),
      newWorld: $('btnNewWorld'),
      debug: $('debug'),
      toast: $('toast'),
      cross: $('crosshair'),
      combatHud: $('combatHud'),
      hpFill: $('hpFill'),
      hpNum: $('hpNum'),
      weaponName: $('weaponName'),
      ammoNum: $('ammoNum'),
      stKills: $('stKills'),
      stEnemies: $('stEnemies'),
      hitmarker: $('hitmarker'),
      dmgVignette: $('dmgVignette'),
      dmgDir: $('dmgDir'),
      killfeed: $('killfeed')
    };
    els.play.addEventListener('click', function () { if (hooks.onPlay) hooks.onPlay(); });
    els.apply.addEventListener('click', function () {
      var v = parseInt(els.seed.value, 10);
      if (!isNaN(v) && hooks.onSeed) hooks.onSeed(v >>> 0);
    });
    els.rnd.addEventListener('click', function () { if (hooks.onRandom) hooks.onRandom(); });
    els.respawn.addEventListener('click', function () { if (hooks.onRespawn) hooks.onRespawn(); });
    els.newWorld.addEventListener('click', function () { if (hooks.onNewWorld) hooks.onNewWorld(); });
  }

  function showProgress() {
    menuVisible = true;
    els.overlay.classList.remove('hidden');
    els.progressWrap.classList.remove('hidden');
    els.menuBody.classList.add('hidden');
    els.deathBody.classList.add('hidden');
    els.combatHud.classList.add('hidden');
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
    els.deathBody.classList.add('hidden');
    els.menuBody.classList.remove('hidden');
    els.title.textContent = mode === 'pause' ? 'ПАУЗА' : 'ПЕПЕЛЬНЫЙ ГОРОД';
    els.combatHud.classList.add('hidden');
    els.cross.classList.add('hidden');
  }
  function showDeath(player) {
    menuVisible = true;
    els.overlay.classList.remove('hidden');
    els.progressWrap.classList.add('hidden');
    els.menuBody.classList.add('hidden');
    els.deathBody.classList.remove('hidden');
    els.title.textContent = 'ВЫ ПОГИБЛИ';
    els.deathKills.textContent = player ? player.kills : 0;
    els.deathSeed.textContent = els.seed.value;
    els.combatHud.classList.add('hidden');
    els.cross.classList.add('hidden');
  }
  function hideMenu() {
    menuVisible = false;
    els.overlay.classList.add('hidden');
    els.combatHud.classList.remove('hidden');
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

  // ---------------- боевой HUD ----------------

  function setHealth(cur, max) {
    var pct = Math.max(0, Math.min(100, (cur / max) * 100));
    els.hpFill.style.width = pct + '%';
    els.hpNum.textContent = Math.ceil(cur);
    els.hpFill.classList.toggle('low', pct <= 25);
    els.hpFill.classList.toggle('mid', pct > 25 && pct <= 55);
  }
  function setAmmo(n) {
    els.ammoNum.textContent = (n === null || n === undefined) ? '—' : n;
    els.ammoNum.classList.toggle('empty', n === 0);
  }
  function setWeapon(name) { els.weaponName.textContent = name.toUpperCase(); }
  function setStats(kills, alive) {
    els.stKills.textContent = 'Убито: ' + kills;
    els.stEnemies.textContent = 'Врагов: ' + alive;
  }
  function hitmarker(kill) {
    els.hitmarker.classList.remove('show', 'kill');
    void els.hitmarker.offsetWidth; // reflow для рестарта анимации
    els.hitmarker.classList.add('show');
    if (kill) els.hitmarker.classList.add('kill');
    if (hmTimer) clearTimeout(hmTimer);
    hmTimer = setTimeout(function () { els.hitmarker.classList.remove('show', 'kill'); }, 220);
  }
  function damageFlash(relDeg) {
    els.dmgVignette.classList.add('show');
    els.dmgDir.style.transform = 'translate(-50%,-50%) rotate(' + relDeg + 'deg)';
    els.dmgDir.classList.add('show');
    if (dmgTimer) clearTimeout(dmgTimer);
    dmgTimer = setTimeout(function () {
      els.dmgVignette.classList.remove('show');
      els.dmgDir.classList.remove('show');
    }, 700);
  }
  function killFeed(text) {
    var item = document.createElement('div');
    item.className = 'kfItem';
    item.textContent = text;
    els.killfeed.appendChild(item);
    while (els.killfeed.children.length > 4) els.killfeed.removeChild(els.killfeed.firstChild);
    setTimeout(function () {
      if (item.parentNode) item.parentNode.removeChild(item);
    }, 3600);
  }

  return {
    init: init, showProgress: showProgress, progress: progress,
    showMenu: showMenu, showDeath: showDeath, hideMenu: hideMenu, setSeed: setSeed,
    debug: debug, debugText: debugText, toast: toast, isVisible: isVisible,
    setHealth: setHealth, setAmmo: setAmmo, setWeapon: setWeapon,
    setStats: setStats, hitmarker: hitmarker, damageFlash: damageFlash,
    killFeed: killFeed
  };
})();
