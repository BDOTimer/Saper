// click-sound.js
(() => {
  const BASE = new URL('.', document.currentScript.src); // папка, где лежит сам click-sound.js
  const CLICK_SRC = new URL('dzin-1.mp3', BASE).href;

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

  // Делегирование: реагируем на клики по любым .menu-btn
  document.addEventListener('pointerdown', e =>
  {
           if (e.target.closest('.menu-btn')) playClick();
      else if (e.target.closest('.back-btn')) playClick();

      else playClick();
  }, { passive: true });
})();