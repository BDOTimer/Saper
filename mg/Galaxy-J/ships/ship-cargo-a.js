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


    constructor()
    {
        this.#items = [];
        this.#station = null;
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
}


window.CargoA = CargoA;