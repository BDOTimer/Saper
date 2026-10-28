// ui/about.js
import { GameTitle } from './game-title.js';

const ABOUT_TEXT = `
  <p><b>«Грань Империи»</b> — пошаговая стратегия в фэнтезийном мире и по совместительству
     ремейк классической <i>Warlords II</i> (Strategic Studies Group, 1993/1995).
     Дух оригинала на месте: захват городов, армии, герои и борьба за власть.
     Всё остальное — интерфейс, баланс, графика — приведено в состояние, пригодное
     для XXI века.</p>

  <h3>Что происходит</h3>
  <p>До восьми игроков — люди, ИИ или гремучая смесь — делят один фэнтезийный мир.
     Побеждает тот, кто захватит все города или убедит противников, что мир
     с вами выгоднее войны. Стартуете с одним городом, дальше — как пойдёт:
     нейтральные крепости, чужие владения, наём войск и герои, которые лезут
     по руинам и подземельям в надежде на артефакт получше.</p>

  <h3>Чем берёт</h3>
  <ul>
    <li><b>Стратегия с примесью RPG.</b> Кроме армий и городов есть герои:
        качают уровни, собирают артефакты и по пути приручают монстров,
        подвернувшихся под руку.</li>

    <li><b>Карты на любой вкус.</b> Готовые сценарии плюс генератор случайных карт
        с настройкой рельефа, числа городов и плотности ресурсов. Каждая партия —
        новый мир, в котором можно заблудиться по-новому.</li>

    <li><b>Туман войны.</b> Неизведанное скрыто, пока рядом нет своих.
        Уже открытая клетка не темнеет — разведка по-прежнему решает,
        но хотя бы не приходится запоминать всё наизусть.</li>

    <li><b>Дипломатия.</b> Мир, нейтралитет, война, союзы — и всё это можно
        использовать как рычаг давления. Или как способ потянуть время.</li>

    <li><b>Юниты и города.</b> Пехота, кавалерия, магия, осадные машины —
        ассортимент приличный. Город можно переоборудовать под нужный отряд
        за золото, а обученные войска — автоматически отправить в другой город,
        чтобы не кликать мышью до мозолей.</li>

    <li><b>Современные удобства.</b> Обновлённая графика, переработанный интерфейс,
        поумневший ИИ, современные разрешения и сетевая игра. Отдельная гордость —
        редактор сценариев: карты, армии и кампании на совести сообщества.</li>
  </ul>

  <h3>Наследие</h3>
  <p>«Грань Империи» — дань уважения Warlords II, одной из классик жанра 4X/TBS,
     и попытка вернуть ощущение большой пошаговой стратегии, в которую хочется
     переигрывать. Проект самостоятельный и с Strategic Studies Group не связан:
     оригинал упоминается исключительно как источник вдохновения.</p>
`;

export class AboutOverlay {
  constructor({ parent = document.body, onClose = () => {} } = {}) {
    this.onClose = onClose;
    this.el = this._render();
    parent.appendChild(this.el);

    // клик по backdrop (не по карточке) — закрыть
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this._close();
    });
    // Escape
    this._onKey = (e) => { if (e.key === 'Escape') this._close(); };
    document.addEventListener('keydown', this._onKey);

    // анимация появления
    requestAnimationFrame(() => this.el.classList.add('open'));
  }

  _render() {
    const root = document.createElement('div');
    root.className = 'about-overlay';

    // ── Заголовок: по центру сверху, с аурой ──
    const header = document.createElement('div');
    header.className = 'about-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'about-title-wrap';

    this.title = new GameTitle({
      name: 'Грань Империи',
      accentWord: 'Империи',
      subtitle: 'Remake of Warlords II',
      parent: titleWrap,
    });

    header.appendChild(titleWrap);
    root.appendChild(header);

    // ── Карточка с описанием ──
    const card = document.createElement('div');
    card.className = 'about-card';

    const body = document.createElement('div');
    body.className = 'about-body';
    body.innerHTML = ABOUT_TEXT;
    card.appendChild(body);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'about-close';
    closeBtn.textContent = 'Закрыть';
    closeBtn.addEventListener('click', () => this._close());
    card.appendChild(closeBtn);

    root.appendChild(card);
    return root;
  }

  _close() {
    if (this._closed) return;
    this._closed = true;
    this.el.classList.remove('open');
    document.removeEventListener('keydown', this._onKey);
    // дать анимации закрытия доиграть
    setTimeout(() => this.onClose(), 180);
  }

  destroy() {
    document.removeEventListener('keydown', this._onKey);
    this.title?.destroy();
    this.el.remove();
  }
}