// ============================================================
//  Процедурный звук (WebAudio, без файлов): ветер (зацикленный
//  фильтрованный шум), шаги, приземление, редкие далёкие гулы.
//  Инициализируется после первого клика (autoplay policy).
// ============================================================
window.AudioSys = (function () {
  var ctx = null, master = null, started = false;

  function init() {
    if (started) return;
    try {
      started = true;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);

      // ветер: коричневый шум через lowpass
      var len = ctx.sampleRate * 2;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      var v = 0;
      for (var i = 0; i < len; i++) {
        v = v * 0.98 + (Math.random() * 2 - 1) * 0.02;
        d[i] = v * 8;
      }
      var src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 420;
      var wg = ctx.createGain(); wg.gain.value = 0.16;
      src.connect(f); f.connect(wg); wg.connect(master);
      src.start();
      var lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      var lg = ctx.createGain(); lg.gain.value = 0.06;
      lfo.connect(lg); lg.connect(wg.gain);
      lfo.start();
    } catch (e) { ctx = null; }
  }

  function noiseBurst(dur, freq, q, gain) {
    if (!ctx) return;
    var n = (ctx.sampleRate * dur) | 0;
    var b = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var s = ctx.createBufferSource();
    s.buffer = b;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq * (0.85 + Math.random() * 0.3);
    f.Q.value = q;
    var g = ctx.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(master);
    s.start();
  }

  function step(run) { noiseBurst(0.09, run ? 520 : 380, 1.2, run ? 0.22 : 0.14); }
  function land() { noiseBurst(0.16, 240, 1, 0.3); }
  function rumble() {
    if (!ctx) return;
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(52, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 2.4);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.6);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + 2.7);
  }
  function update(dt) {
    if (ctx && Math.random() < dt / 28) rumble();
  }

  return { init: init, step: step, land: land, rumble: rumble, update: update };
})();
