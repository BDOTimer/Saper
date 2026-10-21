/**
 * Создаёт карточку профиля:
 *  - плашка
 *  - аватар
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

  // --- Аватар ---
  if (avatar) {
    const img = document.createElement('img');
    img.className = 'profile-avatar';
    img.src = avatar;
    img.alt = name || 'Аватар';
    img.loading = 'lazy';
    img.draggable = false;
    card.appendChild(img);
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

// Экспорт (если понадобится в сборке)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createProfileCard, createProfileList };
}