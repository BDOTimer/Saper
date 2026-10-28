/**
 * AudioManager — процедурная фоновая музыка и SFX через Web Audio API.
 * Никаких внешних файлов: всё синтезируется на лету.
 * — Музыка: генеративный фэнтезийный эмбиент (пэд + арпеджио на пентатонике)
 * — SFX: шаги, удары, промах, захват города, найм, победа/поражение
 */

type SfxName =
  | 'step' | 'hit' | 'miss' | 'death' | 'capture'
  | 'hire' | 'turn' | 'victory' | 'defeat' | 'select' | 'error';

const PENTA = [0, 3, 5, 7, 10]; // минорная пентатоника
const BASE = 220; // A3

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;
  private _enabled = true;
  private _musicOn = true;

  get enabled() { return this._enabled; }
  get musicOn() { return this._musicOn; }

  /** Ленивая инициализация — по первому пользовательскому жесту */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._enabled ? 0.9 : 0;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this._musicOn ? 0.16 : 0;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.master);

      this.startMusic();
    } catch {
      // аудио недоступно — игра работает без звука
    }
  }

  setEnabled(on: boolean): void {
    this._enabled = on;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
    }
  }

  setMusic(on: boolean): void {
    this._musicOn = on;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.3);
    }
  }

  // ---------- Музыка ----------

  private startMusic(): void {
    if (!this.ctx || this.musicTimer) return;
    // Нота каждые 700мс: редкое арпеджио + длинный пэд
    const tick = () => {
      if (!this.ctx || !this.musicGain) return;
      const t = this.ctx.currentTime;
      const step = this.musicStep++;

      // Арпеджио — пентатоника, октавы 1-2
      if (step % 2 === 0) {
        const deg = PENTA[Math.floor(Math.random() * PENTA.length)];
        const oct = Math.random() < 0.5 ? 1 : 2;
        const freq = BASE * oct * Math.pow(2, deg / 12);
        this.pluck(freq, t + 0.02, 0.9);
      }
      // Бас каждые 8 шагов
      if (step % 8 === 0) {
        const deg = PENTA[Math.floor(step / 8) % PENTA.length];
        this.pad(BASE * 0.5 * Math.pow(2, deg / 12), t, 4.5);
      }
    };
    tick();
    this.musicTimer = setInterval(tick, 700);
  }

  private pluck(freq: number, t: number, dur: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filter).connect(g).connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.1);
  }

  private pad(freq: number, t: number, dur: number): void {
    if (!this.ctx || !this.musicGain) return;
    for (const det of [-4, 0, 5]) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq * Math.pow(2, det / 1200);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + dur * 0.4);
      g.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(filter).connect(g).connect(this.musicGain);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    }
  }

  // ---------- SFX ----------

  private noiseBuffer(dur: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private playNoise(t: number, dur: number, freq: number, vol: number, type: BiquadFilterType = 'bandpass'): void {
    if (!this.ctx || !this.sfxGain) return;
    const buf = this.noiseBuffer(dur);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur);
  }

  private playTone(t: number, freq: number, dur: number, vol: number, type: OscillatorType = 'square', slideTo?: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  play(name: SfxName): void {
    if (!this.ctx || !this._enabled) return;
    const t = this.ctx.currentTime + 0.01;
    switch (name) {
      case 'step':
        this.playNoise(t, 0.07, 700 + Math.random() * 300, 0.25, 'lowpass');
        break;
      case 'select':
        this.playTone(t, 660, 0.07, 0.15, 'sine');
        break;
      case 'hit':
        this.playNoise(t, 0.15, 250, 0.6, 'lowpass');
        this.playTone(t, 180, 0.12, 0.4, 'square', 60);
        break;
      case 'miss':
        this.playNoise(t, 0.12, 2400, 0.2, 'highpass');
        break;
      case 'death':
        this.playTone(t, 320, 0.4, 0.35, 'sawtooth', 40);
        this.playNoise(t + 0.05, 0.3, 400, 0.35, 'lowpass');
        break;
      case 'capture':
        // Торжественный аккорд
        for (const [i, f] of [261.6, 329.6, 392, 523.3].entries()) {
          this.playTone(t + i * 0.06, f, 0.5, 0.18, 'triangle');
        }
        break;
      case 'hire':
        this.playTone(t, 440, 0.1, 0.2, 'triangle');
        this.playTone(t + 0.09, 587, 0.12, 0.2, 'triangle');
        break;
      case 'turn':
        this.playTone(t, 330, 0.12, 0.18, 'sine');
        this.playTone(t + 0.1, 440, 0.15, 0.18, 'sine');
        break;
      case 'error':
        this.playTone(t, 160, 0.15, 0.25, 'square', 110);
        break;
      case 'victory':
        [523.3, 659.3, 784, 1046.5, 784, 1046.5].forEach((f, i) => {
          this.playTone(t + i * 0.14, f, 0.3, 0.22, 'triangle');
        });
        break;
      case 'defeat':
        [392, 349.2, 311.1, 261.6].forEach((f, i) => {
          this.playTone(t + i * 0.25, f, 0.4, 0.2, 'sawtooth');
        });
        break;
    }
  }

  dispose(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    void this.ctx?.close();
    this.ctx = null;
  }
}
