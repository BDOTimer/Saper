// g-click-sound.js
(() => {
  const BASE = new URL('.', document.currentScript.src); // папка, где лежит сам click-sound.js
  const CLICK_SRC = new URL('../snd/dzin-2.mp3', BASE).href;

  const pool = Array.from({ length: 3 }, () => {
    const a = new Audio(CLICK_SRC);
    a.preload = 'auto';
    a.volume = 0.35;
    a.addEventListener('error', () =>
      console.error('Файл ' + CLICK_SRC + ' не загрузился — проверьте путь и имя файла'));
    return a;
  });
  let idx = 0;

  function playClick() {
    const a = pool[idx];
    idx = (idx + 1) % pool.length;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p) p.catch(err => console.warn('play() отклонён:', err.name));
    } catch (e) {
      console.warn(e);
    }
  }

  // ЭКСПОРТ наружу:
  window.playClick = playClick;

  // Делегирование: реагируем на клики по любым .menu-btn
  document.addEventListener('pointerdown', e =>
  {
           if (e.target.closest('.menu-btn')) playClick();
      else if (e.target.closest('.back-btn')) playClick();

    //else playClick();
  }, { passive: true });
})();

class AudioManager
{
    constructor(url)
    {   this.audio = new Audio(url);
        this.audio.loop = true;
        this.audio.volume = 0.1;

        this._initialized = true;
        this._isPlaying   = false;
    }

    init()
    {   // Разрешить воспроизведение только после взаимодействия
        const allow = () => {
            this.audio.play().catch(() => {});
            this.audio.volume = 0.1;
      //    document.removeEventListener('click', allow);
        };
        document.addEventListener('click', allow, { once: true });
      //document.addEventListener('click', () => this.toggle(), { passive: true });
    }

    toggle()
    {   if (!this._initialized)
        {   // Если ещё не было разрешения на автовоспроизведение, первый клик его даёт,
            // но не должен сразу переключать состояние — иначе может быть рассинхрон.
            return;
        }

        if (this._isPlaying) this.pause();
        else                 this.play ();
    }

    play()
    {   this.audio.play().catch(() => {});
        this._isPlaying = true;
    }
    pause     () { this.audio.pause(); this._isPlaying = false;}
    setVolume(v) { this.audio.volume = Math.max(0, Math.min(1, v)); }
    setVolumeL() { this.audio.volume = 0.1; }
    setVolumeM() { this.audio.volume = 0.2; }

    /**
     * Меняет мелодию на лету.
     * @param {string} url - URL нового MP3/AAC файла
     */
    setTrack(url)
    {
        if (this.audio.src === url) return; // Не меняем, если тот же трек

        const wasPlaying = this._isPlaying;
        
        // Ставит текущий трек на паузу и начинает загрузку нового
        this.audio.src = url;
        
        // Сбрасываем состояние, пока не загрузится новый трек
        this._isPlaying = false;

        // Когда новый трек готов, можно сразу запустить, если раньше играл
        this.audio.oncanplaythrough = () => {
            if (wasPlaying) {
              this.play();
            }
        };

        // Если файл не загрузился (ошибка)
        this.audio.onerror = (e) => {
            console.warn('Не удалось загрузить аудио:', e, url);
            this._isPlaying = false;
        };
    }
}

window.AudioManager = AudioManager;

// Использование
// const music = new AudioManager('https://example.com/space-theme.mp3');
// const music = new AudioManager('./snd/m-1/bass-1.mp3');
// music.init(); // ждёт первого клика


