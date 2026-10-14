/*!
 * g-sound-lib.js — пул звуков для игр/UI
 * Без зависимостей. Подключается через 
 * <script src="./snd/sound-lib.js"></script>
 * Публичный API: window.SND
 */
(function (global) {
  "use strict";

  function createSoundKit(definitions) {
    var audioUnlocked = { value: false };
    var muted = { value: false };

    function createSound(cfg) {
      var src = cfg.src;
      var volume = cfg.volume != null ? cfg.volume : 0.5;
      var poolSize = cfg.pool != null ? cfg.pool : 2;

      var pool = [];
      for (var i = 0; i < poolSize; i++) {
        var a = new Audio(src);
        a.preload = "auto";
        a.volume = volume;
        pool.push(a);
      }
      var idx = 0;

      var player = {
        name: null,
        _pool: pool,

        play: function () {
          if (!audioUnlocked.value || muted.value) return;
          var a = pool[idx];
          idx = (idx + 1) % poolSize;
          try {
            a.currentTime = 0;
            var p = a.play();
            if (p && p.catch) p.catch(function () {});
          } catch (_) {}
        },

        stop: function () {
          // останавливаем только последний игравший
          var last = (idx - 1 + poolSize) % poolSize;
          try {
            pool[last].pause();
            pool[last].currentTime = 0;
          } catch (_) {}
        },

        warmup: function () {
          if (!pool.length) return;
          var a = pool[0];
          var prev = a.volume;
          a.volume = 0;
          var p = a.play();
          if (p && p.catch) p.catch(function () {});
          setTimeout(function () {
            try {
              a.pause();
              a.currentTime = 0;
            } catch (_) {}
            a.volume = prev;
          }, 60);
        },

        setVolume: function (v) {
          v = Math.max(0, Math.min(1, v));
          volume = v;
          if (muted.value) return;
          for (var i = 0; i < pool.length; i++) pool[i].volume = v;
        },

        getVolume: function () {
          return volume;
        },

        dispose: function () {
          for (var i = 0; i < pool.length; i++) {
            try {
              pool[i].pause();
              pool[i].src = "";
            } catch (_) {}
          }
          pool.length = 0;
        },
      };

      return player;
    }

    var sounds = {};
    Object.keys(definitions).forEach(function (name) {
      var p = createSound(definitions[name]);
      p.name = name;
      sounds[name] = p;
    });

    function unlockAudio() {
      if (audioUnlocked.value) return;
      audioUnlocked.value = true;
      Object.keys(sounds).forEach(function (n) {
        sounds[n].warmup();
      });
    }

    function autoUnlock(events) {
      events = events || ["mousemove", "pointerdown", "touchstart", "keydown"];
      events.forEach(function (evt) {
        document.addEventListener(evt, unlockAudio, { passive: true });
      });
    }

    function isUnlocked() {
      return audioUnlocked.value;
    }

    function setVolume(name, v) {
      if (sounds[name]) sounds[name].setVolume(v);
    }

    function setMuted(flag) {
      muted.value = !!flag;
      Object.keys(sounds).forEach(function (n) {
        var p = sounds[n];
        var pool = p._pool;
        for (var i = 0; i < pool.length; i++) {
          pool[i].volume = muted.value ? 0 : p.getVolume();
        }
      });
    }

    function isMuted() {
      return muted.value;
    }

    function dispose() {
      Object.keys(sounds).forEach(function (n) {
        sounds[n].dispose();
      });
    }

    return {
      sounds: sounds,
      unlockAudio: unlockAudio,
      autoUnlock: autoUnlock,
      isUnlocked: isUnlocked,
      setVolume: setVolume,
      setMuted: setMuted,
      isMuted: isMuted,
      dispose: dispose,
    };
  }

  global.SND = {
    createSoundKit: createSoundKit,
  };
})(window);

// ============================================================
//  Звук
// ============================================================
const Vol = Settings.volume;
const kit = SND.createSoundKit({
    laser   : { src: "snd/laser-1.mp3"     , volume: Vol, pool: 4 },
    death   : { src: "snd/ship-death-1.mp3", volume: Vol, pool: 1 },
    damag   : { src: "snd/damag-1.mp3"     , volume: Vol, pool: 4 },
    hjump   : { src: "snd/ship-HJ-1.mp3"   , volume: Vol, pool: 1 },
    docking : { src: "snd/good-dock-1.mp3" , volume: Vol, pool: 1 },
    dockout : { src: "snd/fly-start-1.mp3" , volume: Vol, pool: 1 },

    winopen  : { src: "snd/winopen-1.mp3"  , volume: Vol, pool: 1 },
    winclose : { src: "snd/winclose-1.mp3" , volume: Vol, pool: 1 },
    winopen2 : { src: "snd/winopen-2.mp3"  , volume: Vol, pool: 1 },
    winclose2: { src: "snd/winclose-3.mp3" , volume: Vol, pool: 1 },

    bassDrop1: { src: "snd/bass_drop_01.mp3", volume: Vol, pool: 1 },
    startG   : { src: "snd/mus/start-g-1.mp3",volume: Vol, pool: 1 },
    death2   : { src: "snd/ship-death-1.mp3", volume: Vol, pool: 1 },

    fail1    : { src: "snd/fail-3.mp3"     ,  volume: Vol, pool: 1 },
    fail2    : { src: "snd/fail-4.mp3"     ,  volume: Vol, pool: 1 },
});

// SNDS.fail1.play();

kit.autoUnlock();
window.SNDS = kit.sounds;

function playMusOnStart()
{   window.removeEventListener("click", playMusOnStart);
    if(Date.now() % 7 < 1)
        SNDS.startG.play();
}

//window.addEventListener("click", playMusOnStart);
