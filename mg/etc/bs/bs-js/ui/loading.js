//  loading.js
//  Простой менеджер оверлея загрузки.

class LoadingScreen {
  constructor() {
    this.overlay  = document.getElementById("loading-overlay");
    this.fill     = document.getElementById("loading-bar-fill");
    this.statusEl = document.getElementById("loading-status");
    this.percentEl = document.getElementById("loading-percent");

    this._value = 0;
    this._done  = false;
  }

  /**
   * Установить прогресс (0..100) и подпись.
   * @param {number} value
   * @param {string} [status]
   */
  set(value, status) {
    if (this._done) return;
    this._value = Math.max(0, Math.min(100, value));
    if (this.fill) this.fill.style.width = this._value + "%";
    if (this.percentEl) this.percentEl.textContent = Math.round(this._value) + "%";
    if (status && this.statusEl) this.statusEl.textContent = status;
  }

  /** Прибавить к прогрессу. */
  add(delta, status) {
    this.set(this._value + delta, status);
  }

  /** Показать ошибку. */
  error(message) {
    if (this.statusEl) {
      this.statusEl.textContent = "ОШИБКА: " + message;
      this.statusEl.style.color = "#ff3b30";
      this.statusEl.style.textShadow = "0 0 6px #ff3b30";
    }
    if (this.fill) {
      this.fill.style.background = "linear-gradient(90deg, #ff3b30, #a00)";
      this.fill.style.boxShadow = "0 0 12px #ff3b30";
    }
  }

  /** Плавно скрыть оверлей. */
  finish() {
    if (this._done) return;
    this._done = true;
    this.set(100, "ГОТОВО");
    if (this.overlay) {
      this.overlay.classList.add("is-done");
      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
        }
      }, 700);
    }
  }
}

export const LOADING = new LoadingScreen();