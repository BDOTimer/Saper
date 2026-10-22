/**
 * Создаёт карточку профиля:
 *  - неоновая плашка с тонированным фоном
 *  - квадратный аватар с закруглёнными углами
 *  - имя (опционально)
 *  - кнопка-ссылка на HTML
 *
 * @param {Object} options
 * @param {string} options.avatar  - URL картинки-аватара
 * @param {string} options.name    - подпись под аватаром (необязательно)
 * @param {string} options.href    - ссылка на html-файл
 * @param {string} options.label   - текст на кнопке (по умолчанию "Перейти")
 * @param {string} options.target  - target для ссылки (по умолчанию "_self")
 * @param {HTMLElement} [options.container] - куда вставить (по умолчанию #profile-stage)
 * @returns {HTMLElement|null} созданная карточка
 */
function createProfileCard(options) {
  const {
    avatar,
    name = '',
    hrefAvatar,
    targetAvatar,
    href,
    label = 'Перейти',
    target = '_self',
    container = document.getElementById('profile-stage'),
  } = options;

  if (!container) {
    console.error('Не найден контейнер для плашки профиля');
    return null;
  }

  // --- Плашка ---
  const card = document.createElement('div');
  card.className = 'profile-card';

  // --- Аватар (со ссылкой или без) ---
  if (avatar) {
    let avatarEl;

    if (hrefAvatar) {
      avatarEl = document.createElement('a');
      avatarEl.href = hrefAvatar;
      avatarEl.target = targetAvatar;
      if (targetAvatar === '_blank') {
        avatarEl.rel = 'noopener noreferrer';
      }
      avatarEl.className = 'avatar-link';
    } else {
      avatarEl = document.createElement('div');
      avatarEl.className = 'avatar-link';
    }

    const img = document.createElement('img');
    img.className = 'profile-avatar';
    img.src = avatar;
    img.alt = name || 'Аватар';
    img.loading = 'lazy';
    img.draggable = false;

    avatarEl.appendChild(img);
    card.appendChild(avatarEl);
  }

  // --- Имя ---
  if (name) {
    const title = document.createElement('h2');
    title.className = 'profile-name';
    title.textContent = name;
    card.appendChild(title);
  }

  // --- Кнопка-ссылка ---
  if (href) {
    const link = document.createElement('a');
    link.className = 'profile-link';
    link.href = href;
    link.target = target;
    if (target === '_blank') {
      link.rel = 'noopener noreferrer';
    }

    const text = document.createElement('span');
    text.textContent = label;

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '🏃‍➡️';

    link.appendChild(text);
    link.appendChild(arrow);
    card.appendChild(link);
  }

  container.appendChild(card);
  return card;
}

/**
 * Массово создаёт карточки в контейнере.
 * @param {Array<Object>} items - массив опций для createProfileCard
 * @param {HTMLElement} [container] - общий контейнер
 */
function createProfileList(items, container) {
  if (!container) {
    console.error('Не найден контейнер для списка профилей');
    return;
  }
  items.forEach((item) => createProfileCard({ ...item, container }));
}

/* ============================================================
   НЕОНОВЫЕ СТИЛИ КАРТОЧЕК (в духе neon-bs.css)
   ============================================================ */
(function injectProfileStyles() {
  if (document.getElementById('profile-card-styles')) return;

  const style = document.createElement('style');
  style.id = 'profile-card-styles';
  style.textContent = `
#profile-stage {
  display: flex;
  flex-wrap: wrap;
  gap: 214px;
  justify-content: center;
  align-items: flex-start;
  padding: 32px 20px 120px;   /* запас снизу под увеличение */
  position: relative;
  overflow: visible;
}

.profile-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px; /* было 14px → 7px */
  width: 200px;
  height: auto;
  padding: 11px 14px 11px;   /* было 22px 18px → 11px 14px */
  border-radius: 13px;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 255, 255, 0.10), transparent 55%),
    radial-gradient(circle at 100% 100%, rgba(255, 45, 149, 0.10), transparent 55%),
    rgba(10, 15, 30, 0.85);
  border: 2px solid rgba(0, 255, 255, 0.3);
  box-shadow:
    0 0 30px rgba(0, 255, 255, 0.15),
    inset 0 0 30px rgba(0, 255, 255, 0.05);
  backdrop-filter: blur(4px);
  overflow: visible;
  transform-origin: top center;   /* растёт вниз от верхнего центра */
  will-change: transform;
  transition: box-shadow 0.25s ease, border-color 0.25s ease;
}

.profile-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 255, 255, 0.08) 0%, transparent 45%);
  pointer-events: none;
  border-radius: inherit;
}

.profile-card:hover {
  border-color: rgba(0, 255, 255, 0.6);
  box-shadow:
    0 0 40px rgba(0, 255, 255, 0.35),
    0 0 20px rgba(255, 45, 149, 0.2),
    inset 0 0 30px rgba(0, 255, 255, 0.08);
}

/* Аватар в процентах от ширины карточки — растёт вместе с ней */
.avatar-link {
  display: flex;             /* вместо block */
  justify-content: center;   /* центрируем аватар по горизонтали */
  width: 100%;               /* обёртка на всю ширину карточки */
  border-radius: 14px;
  line-height: 0;
  z-index: 1;
  transition: box-shadow 0.25s ease;
  box-shadow:
    0 0 12px rgba(0, 255, 255, 0.45),
    0 0 24px rgba(0, 229, 255, 0.25);
}

.avatar-link:hover {
  box-shadow:
    0 0 18px rgba(0, 255, 255, 0.7),
    0 0 36px rgba(0, 229, 255, 0.4);
}

/* Аватар — в 2 раза меньше по высоте */
.profile-avatar {
  display: block;
  width: 40%;
  height: auto;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 10px;                          /* было 14px */
  border: 2px solid rgba(0, 255, 255, 0.45);
  background: #0a0f1e;
  box-shadow:
    inset 0 0 12px rgba(0, 255, 255, 0.15),
    0 0 10px rgba(0, 255, 255, 0.35);
}

.profile-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  color: #0ff;
  text-align: center;
  letter-spacing: 1px;
  text-shadow:
    0 0 8px rgba(0, 255, 255, 0.8),
    0 0 20px rgba(0, 255, 255, 0.4);
  z-index: 1;
}

.profile-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 40px;
  padding: 10px 14px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 1px;
  line-height: 1.2;
  color: #ff6ec4;
  text-decoration: none;
  background: rgba(255, 45, 149, 0.08);
  border: 2px solid #ff2d95;
  box-shadow: 0 0 15px rgba(255, 45, 149, 0.3);
  transition: all 0.2s ease;
  z-index: 1;
  flex-shrink: 0;
}

.profile-link:hover,
.profile-link:active {
  color: #fff;
  background: rgba(255, 45, 149, 0.25);
  box-shadow:
    0 0 25px rgba(255, 45, 149, 0.7),
    inset 0 0 20px rgba(255, 45, 149, 0.2);
  transform: translateY(-2px);
}

.profile-link .arrow {
  transition: transform 0.2s ease;
}

.profile-link:hover .arrow {
  transform: translateX(3px);
}
  `;
  document.head.appendChild(style);
})();

// Экспорт (если понадобится в сборке)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createProfileCard, createProfileList };
}


/* ============================================================
   МАСШТАБИРОВАНИЕ через zoom — контент реально подстраивается
   ============================================================ */
(function enableProfileZoom() {
  const stage = document.getElementById('profile-stage');
  if (!stage || stage.dataset.zoomEnabled === '1') return;
  stage.dataset.zoomEnabled = '1';

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 2.5;
  const STEP = 0.1;
  const SMOOTH = 0.15;

  let scale = 1;
  let targetScale = 1;
  let rafId = null;

  // zoom меняет реальный размер — контент подстраивается
  function applyScale() {
    stage.style.zoom = String(scale);
  }

  function animate() {
    const diff = targetScale - scale;
    if (Math.abs(diff) < 0.001) {
      scale = targetScale;
      applyScale();
      rafId = null;
      return;
    }
    scale += diff * SMOOTH;
    applyScale();
    rafId = requestAnimationFrame(animate);
  }

  function scheduleAnimate() {
    if (rafId == null) rafId = requestAnimationFrame(animate);
  }

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    targetScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale + delta * STEP));
    scheduleAnimate();
  }, { passive: false });

  stage.addEventListener('dblclick', () => {
    targetScale = 1;
    scheduleAnimate();
  });
})();