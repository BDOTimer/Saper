// TODO: ...
// model-trade-a.js
//
// Базовые тезисы:
//  -   Цена динамическая: зависит от характеристик звезды(детерминированна).
//  -   К базовой цене добавляется недетерминированная часть в %.
//  -   Влияющие факторы:
//          - тип планеты, политический строй, правительство, преступность, ...
//  -   Важный уровень товара: доступность === 4 уровня
//  -   Цена продажи(рынком) не может быть меньше, чем цена покупки!

// TODO: Итого, начать тут нужно с проработки хар-ок звезды ...


// --- Товары станции: { name, buy, sell, stock } ---
// buy   - сколько платит игрок при покупке (станция продаёт)
// sell  - сколько станция платит игроку при продаже
// stock - сколько единиц на складе станции (для покупки)
const GoodsBase = [
  // --- All (базовые, нужны везде) ---
  { name: "ВОДОРОДНОЕ ТОПЛИВО", buy: 12, sell: 8, stock: 240, category: "All",  desc: "Основное топливо для двигателей и реакторов." },
  { name: "КИСЛОРОДНЫЕ КАНИСТРЫ", buy: 45, sell: 32, stock: 180, category: "All", desc: "Сжатый кислород для систем жизнеобеспечения." },
  { name: "ФИЛЬТРЫ ДЛЯ ВОЗДУХА", buy: 38, sell: 28, stock: 200, category: "All", desc: "Критически важны для поддержания пригодной для дыхания атмосферы." },

  // --- Agricultural (продовольствие и напитки) ---
  { name: "ПИЩЕВЫЕ ПАЙКИ", buy: 22, sell: 15, stock: 120, category: "Agricultural", desc: "Стандартные рационы для длительных перелётов." },
  { name: "КОФЕ (СИНТЕТИЧЕСКИЙ)", buy: 95, sell: 70, stock: 150, category: "Agricultural", desc: "Искусственно выращенный кофе — популярен на станциях." },
  { name: "ЧАЙ (ЭЛИТНЫЙ)", buy: 180, sell: 140, stock: 80, category: "Agricultural", desc: "Редкий сорт чая с отдалённых аграрных миров." },
  { name: "ЗЕРНО (ГИДРОПОНИКА)", buy: 55, sell: 40, stock: 300, category: "Agricultural", desc: "Семена и концентраты для выращивания еды на борту." },
  { name: "МЯСО (КУЛЬТИВИРОВАННОЕ)", buy: 110, sell: 85, stock: 90, category: "Agricultural", desc: "Лабораторное мясо — альтернатива натуральным продуктам." },

  // --- Mining (сырьё и ценные материалы) ---
  { name: "РУДА (ЖЕЛЕЗО)", buy: 34, sell: 26, stock: 300, category: "Mining", desc: "Базовая руда для выплавки стали и конструкций." },
  { name: "РУДА (ТИТАН)", buy: 145, sell: 118, stock: 60, category: "Mining", desc: "Лёгкий и прочный металл, востребован в кораблестроении." },
  { name: "ДРАГОЦЕННЫЕ МЕТАЛЛЫ", buy: 890, sell: 760, stock: 12, category: "Mining", desc: "Золото, платина и редкие сплавы — универсальная валюта." },
  { name: "РЕДКОЗЕМЕЛЬНЫЕ ЭЛЕМЕНТЫ", buy: 620, sell: 510, stock: 25, category: "Mining", desc: "Ключевой компонент для высокотехнологичного производства." },
  { name: "КРИСТАЛЛЫ (ОПТИЧЕСКИЕ)", buy: 750, sell: 630, stock: 18, category: "Mining", desc: "Используются в лазерах, сенсорах и квантовых системах." },

  // --- Refinery (переработанные продукты и химия) ---
  { name: "МЕДИКАМЕНТЫ", buy: 68, sell: 52, stock: 40, category: "Refinery", desc: "Базовые препараты для лечения и поддержания здоровья экипажа." },
  { name: "ТОПЛИВНЫЕ ПРИСАДКИ", buy: 130, sell: 98, stock: 70, category: "Refinery", desc: "Повышают эффективность топлива и снижают износ двигателей." },
  { name: "ПЛАСТИКОВЫЕ КОМПОЗИТЫ", buy: 85, sell: 65, stock: 160, category: "Refinery", desc: "Универсальный материал для 3D-печати деталей и ремонта." },

  // --- High-Tech (технологии, вооружение, защита) ---
  { name: "ОРУЖИЕ (ЛАЗЕР)", buy: 1250, sell: 980, stock: 8, category: "High-Tech", desc: "Компактные лазерные установки для малых кораблей." },
  { name: "КОМПЬЮТЕРНЫЕ ЧИПЫ", buy: 320, sell: 260, stock: 45, category: "High-Tech", desc: "Микропроцессоры для бортовых компьютеров и ИИ." },
  { name: "ЩИТЫ", buy: 2100, sell: 1700, stock: 5, category: "High-Tech", desc: "Энергощиты для защиты от кинетических и энергетических атак." },
  { name: "СЕНСОРНЫЕ МАТРИЦЫ", buy: 980, sell: 790, stock: 10, category: "High-Tech", desc: "Продвинутые датчики для сканирования космоса и обнаружения целей." },

  // --- Tourism (предметы роскоши и сувениры) ---
  { name: "РОСКОШЬ (СУВЕНИРЫ)", buy: 1200, sell: 1000, stock: 5, category: "Tourism", desc: "Эксклюзивные предметы для коллекционеров и VIP-пассажиров." },
  { name: "ВИРТУАЛЬНЫЕ ТУРЫ", buy: 350, sell: 270, stock: 50, category: "Tourism", desc: "Иммерсивные записи экскурсий по достопримечательностям галактики." },

  // --- Criminal/Contraband (рискованные товары) ---
  { name: "РАБЫ? НЕТ, КОНТРАКТНИКИ", buy: 450, sell: 380, stock: 15, category: "Criminal", desc: "Спорный груз — формально наёмные рабочие, фактически принудительный труд." },
  { name: "ЗАПРЕЩЁННЫЕ ПРЕПАРАТЫ", buy: 1100, sell: 920, stock: 8, category: "Criminal", desc: "Сильнодействующие вещества — высокая прибыль, но и высокий риск." },
];

class ModelTradeA
{
    #star;

    constructor()
    {
       this.goods = [];
    }

    go2CurrentStar() {
        this.#star = GALAXY.getCurrentStar();
    }

    calcGoods()
    {   if(this.#star === null) return;

        this.goods = [];

        const count = 8; // сколько товаров показать на станции
        const N     = GoodsBase.length;

        for (let i = 0, j = 0; i < N && j < count; i++)
        {
            const baseItem = GoodsBase[i]; // тут ссылка

            if(baseItem.category != this.#star.economy)
            {
                continue;
            }

            // Копируем объект, чтобы не менять оригинал в GoodsBase
            const item = { ...baseItem };

            // // Пересчитываем цены с учётом звезды/правительства/преступности и т.д.
            // item.buy = this.calcPrice(baseItem.buy, this.#star, 'buy');
            // item.sell = this.calcPrice(baseItem.sell, this.#star, 'sell');

            // // Важно: цена продажи не может быть меньше цены покупки
            // if (item.sell > item.buy) {
            //     item.sell = item.buy;
            // }

            console.log("🔍 item.name", item.name);
            // console.log("🔍 this.#star.economy: ", this.#star.economy);
            // console.log("🔍 baseItem.category : ", baseItem.category );

            this.goods.push(item);
            ++j;
        }
    }
}

window.ModelTradeA = ModelTradeA;

class Helper
{
    static Filter(name)
    {
        
    }
}
