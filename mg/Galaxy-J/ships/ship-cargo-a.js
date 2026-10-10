// ship-cargo-a.js - Грузовой отсек корабля.
// В нём хранятся купленные товары.
//
// Описание:
//      - Товар: { name, costUp, amount }
//      - <costUp> - по какой цене был куплен (средняя, если покупали партиями)
//      - 1 экземпляр создаётся в объекте класса Ship
//      - При стыковке с доком #items подключаются к TradeStation
//      - При отстыковке от дока #items отключаются от TradeStation
//      - Данные о купленных товарах хранятся только в этом месте и больше нигде.
//      - CargoA ничего не знает о том, какие товары вообще существуют в мире.


class CargoA
{
    #items;   // [{ name, costUp, amount }, ...] - единственное место хранения
    #station; // подключённая TradeStation или null
    #isView;


    constructor()
    {
        this.#items   = [];
        this.#station = null;
        this.#isView  = false;
    }


    /* ==================== Стыковка ==================== */

    // Подключить груз к станции (вызывается при стыковке).
    // Станция запоминает ссылку на отсек и дальше работает
    // только через его методы: outCargo() / inCargo() / takeOut().
    connect(station)
    {
        if (!station)
        {
            return false;
        }

        this.#station = station;
        station.connectCargo(this); // названия методов TradeStation подстрой под свой код
        return true;
    }

    // Отключить груз от станции (вызывается при отстыковке).
    disconnect()
    {
        if (!this.#station)
        {
            return;
        }

        this.#station.disconnectCargo(this);
        this.#station = null;
    }

    isDocked()
    {
        return this.#station !== null;
    }


    /* ==================== Товары ==================== */

    // Положить товар в отсек (покупка).
    // options = { name, costUp, amount }
    // Если товар уже лежит в отсеке - количество суммируется,
    // а costUp пересчитывается как средневзвешенная цена покупки.
    // Возвращает копию записи или null, если данные некорректны.
    inCargo(options = {})
    {
        const name   = typeof options.name === 'string' ? options.name.trim() : '';
        const costUp = Number(options.costUp);
        const amount = Math.floor(Number(options.amount));

        if (name === ''
            || !Number.isFinite(costUp) || costUp < 0
            || !Number.isFinite(amount) || amount <= 0)
        {
            return null;
        }

        const existing = this.#items.find(item => item.name === name);

        if (existing)
        {
            const total = existing.amount + amount;

            // средневзвешенная цена: (стоимость старой партии + новой) / общее количество
            // если цены в игре целые - оберни в Math.round()
            existing.costUp = (existing.costUp * existing.amount + costUp * amount) / total;
            existing.amount = total;

            return { ...existing };
        }

        const item = { name, costUp, amount };
        this.#items.push(item);

        return { ...item };
    }

    // Забрать товар из отсека (продажа станции).
    // options = { name, amount? } - если amount не указан, забирается всё.
    // Возвращает { name, costUp, amount } забранного (costUp нужен станции
    // для расчёта прибыли: (цена_продажи - costUp) * amount)
    // или null, если товара нет / количества не хватает.
    takeOut(options = {})
    {
        const name  = typeof options.name === 'string' ? options.name.trim() : '';
        const index = this.#items.findIndex(item => item.name === name);

        if (index === -1)
        {
            return null;
        }

        const item = this.#items[index];

        const amount = (options.amount === undefined)
            ? item.amount
            : Math.floor(Number(options.amount));

        if (!Number.isFinite(amount) || amount <= 0 || amount > item.amount)
        {
            return null;
        }

        const result = { name: item.name, costUp: item.costUp, amount };

        item.amount -= amount;
        if (item.amount === 0)
        {
            this.#items.splice(index, 1); // товар кончился - убираем запись
        }

        return result;
    }

    // Список товаров (для отображения в TradeStation).
    // Отдаём копии записей, а не сам #items: данные меняются
    // только через методы этого класса.
    outCargo()
    {
        return this.#items.map(item => ({ ...item }));
    }

    isEmpty()
    {
        return this.#items.length === 0;
    }


    /* ==================== localStorage ==================== */

    // Для localStorage: JSON.stringify(cargo) вызовет этот метод сам.
    toJSON()
    {
        return {
            items: this.#items.map(item => ({ ...item })),
        };
    }

    // Из localStorage: cargo.fromJSON(JSON.parse(saved))
    fromJSON(data)
    {
        this.#items = [];

        if (!data || !Array.isArray(data.items))
        {
            return;
        }

        // прогоняем через inCargo: валидация и склейка дубликатов бесплатно
        for (const raw of data.items)
        {
            this.inCargo(raw);
        }
    }

    /* ==================== Осмотр трюма ==================== */

    // view()      — переключить показ
    // view(true)  — показать
    // view(false) — скрыть
    view(force)
    {
        const isView = (force === undefined) ? !this.#isView : Boolean(force);
        this.#isView = isView;

        if(isView) SNDS.winopen .play();
        else       SNDS.winclose.play();

        const OVERLAY_ID = 'cargo-overlay';
        let overlay = document.getElementById(OVERLAY_ID);

        if (!overlay)
        {
            if (!isView)
            {
                return;
            }

            overlay = document.createElement('div');
            overlay.id = OVERLAY_ID;
            overlay.className = 'trade-overlay'; // см. правку css выше

            overlay.innerHTML = `
                <div class="trade-paper">
                    <div class="trade-corners"></div>
                    <div class="trade-title">ТРЮМ</div>
                    <div class="trade-subtitle" data-role="owner"></div>
                    <div class="trade-credits-bar">
                        <span class="trade-credits-label">ЗАНЯТО ПОЗИЦИЙ</span>
                        <span class="trade-credits-value" data-role="count">0</span>
                    </div>
                    <div class="trade-col">
                        <div class="trade-col-title">СОДЕРЖИМОЕ</div>
                        <div class="trade-row" style="cursor:default; opacity:0.6;">
                            <span class="trade-cell-name">ТОВАР</span>
                            <span class="trade-cell-buyprice">ЦЕНА ПОКУПКИ</span>
                            <span class="trade-cell-qty">КОЛ-ВО</span>
                        </div>
                        <div class="trade-list" data-role="list"></div>
                    </div>
                    <div class="trade-hint">
                        <span class="key">ESC</span> / <span class="key">Gjnm</span> — закрыть
                    </div>
                </div>
            `;

            overlay.addEventListener('click', (e) =>
            {
                if (e.target === overlay)
                {
                    this.view(false);
                }
            });

            // Обработчик создаём один раз, а вешаем/снимаем на показ/скрытие
            overlay._cargoKeyHandler = (e) =>
            {
                if (e.key === 'Escape' || e.key === 'i' || e.key === 'I' || e.key === 'ш' || e.key === 'Ш')
                {
                    e.preventDefault();
                    e.stopPropagation(); // чтобы ESC не закрыл заодно терминал TRADE
                    this.view(false);
                }
            };

            document.body.appendChild(overlay);
        }

        // Скрыть
        if (!isView)
        {
            overlay.classList.remove('open');
            // ★ раньше слушатель висел на document вечно и ловил ESC/I
            // даже когда оверлей скрыт — снимаем
            document.removeEventListener('keydown', overlay._cargoKeyHandler);
            return;
        }

        // Показать
        this.#renderCargoView(overlay);
        overlay.classList.add('open');
        document.addEventListener('keydown', overlay._cargoKeyHandler);

        // Одноразовая диагностика: стили не применились — подскажем в консоль
        if (!overlay._styleWarned)
        {
            overlay._styleWarned = true;
            if (getComputedStyle(overlay).position !== 'fixed')
            {
                console.warn('[CargoA] стили station-trade.css не применились к #cargo-overlay — в css оверлей описан по id #trade-overlay, добавьте .trade-overlay в селекторы');
            }
        }
    }

    #renderCargoView(overlay)
    {
        const ownerEl = overlay.querySelector('[data-role="owner"]');
        const countEl = overlay.querySelector('[data-role="count"]');
        const listEl  = overlay.querySelector('[data-role="list"]');

        // ★ защита: краш здесь обрывал view() ДО classList.add('open')
        const pers = (typeof GAME !== 'undefined') ? GAME.pers : null;
        const playerName = (pers && pers.name) ? pers.name : 'НЕИЗВЕСТНЫЙ ПИЛОТ';

        ownerEl.textContent = `ПИЛОТ: ${playerName}`;
        countEl.textContent = String(this.#items.length);

        listEl.innerHTML = '';

        if (this.#items.length === 0)
        {
            const empty = document.createElement('div');
            empty.className = 'trade-empty';
            empty.textContent = 'ТРЮМ ПУСТ';
            listEl.appendChild(empty);
            return;
        }

        for (const item of this.#items)
        {
            const row = document.createElement('div');
            row.className = 'trade-row';
            row.style.cursor = 'default';

            const name = document.createElement('span');
            name.className = 'trade-cell-name';
            name.textContent = item.name;
            name.title = item.name;

            const price = document.createElement('span');
            price.className = 'trade-cell-buyprice';
            price.textContent = this.#formatPrice(item.costUp);

            const qty = document.createElement('span');
            qty.className = 'trade-cell-qty';
            qty.textContent = `x${item.amount}`;

            row.append(name, price, qty);
            listEl.appendChild(row);
        }
    }

    // Аккуратное форматирование цены: целые без дробной части,
    // дробные — с двумя знаками.
    #formatPrice(value)
    {
        const num = Number(value);
        if (!Number.isFinite(num))
        {
            return '—';
        }
        return Number.isInteger(num)
            ? String(num)
            : num.toFixed(2);
    }
}


window.CargoA = CargoA;