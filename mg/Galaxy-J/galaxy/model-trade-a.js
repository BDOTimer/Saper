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

const isConsole = true;

const Spec         =-2;
const All          =-1;
const Industrial   = 0;
const Agricultural = 1;
const Mining       = 2;
const Refinery     = 3;
const HighTech     = 4;
const Tourism      = 5;

const Anarchy     = Galaxy.idGOVERNMENTS.Anarchy;
const Feudal      = Galaxy.idGOVERNMENTS.Feudal;
const MultiGov    = Galaxy.idGOVERNMENTS.MultiGov;
const Dictatorship= Galaxy.idGOVERNMENTS.Dictatorship;
const Confederacy = Galaxy.idGOVERNMENTS.Confederacy;
const Democracy   = Galaxy.idGOVERNMENTS.Democracy;
const Corporate   = Galaxy.idGOVERNMENTS.Corporate;
const Communist   = Galaxy.idGOVERNMENTS.Communist;


// --- Товары станции: { name, buy, sell, stock } ---
// buy   - сколько платит игрок при покупке (станция продаёт)
// sell  - сколько станция платит игроку при продаже
// stock - сколько единиц на складе станции (для покупки)
const GoodsBase = [
  // --- All (базовые, нужны везде) ---
  { id:  0, name: "ВОДОРОДНОЕ ТОПЛИВО", buy: 12, sell: 8, stock: 240, economy: [All],  desc: "Основное топливо для двигателей и реакторов." },
  { id:  1, name: "КИСЛОРОДНЫЕ КАНИСТРЫ", buy: 45, sell: 32, stock: 180, economy: [All], desc: "Сжатый кислород для систем жизнеобеспечения." },
  { id:  2, name: "ФИЛЬТРЫ ДЛЯ ВОЗДУХА", buy: 38, sell: 28, stock: 200, economy: [All], desc: "Критически важны для поддержания пригодной для дыхания атмосферы." },

  // --- Agricultural (продовольствие и напитки) ---
  { id:  3, name: "ПИЩЕВЫЕ ПАЙКИ", buy: 22, sell: 15, stock: 120, economy: [Agricultural], desc: "Стандартные рационы для длительных перелётов." },
  { id:  4, name: "КОФЕ (СИНТЕТИЧЕСКИЙ)", buy: 95, sell: 70, stock: 150, economy: [Agricultural], desc: "Искусственно выращенный кофе — популярен на станциях." },
  { id:  5, name: "ЧАЙ (ЭЛИТНЫЙ)", buy: 180, sell: 140, stock: 80, economy: [Agricultural], desc: "Редкий сорт чая с отдалённых аграрных миров." },
  { id:  6, name: "ЗЕРНО (ГИДРОПОНИКА)", buy: 55, sell: 40, stock: 300, economy: [Agricultural], desc: "Семена и концентраты для выращивания еды на борту." },
  { id:  7, name: "МЯСО (КУЛЬТИВИРОВАННОЕ)", buy: 110, sell: 85, stock: 90, economy: [Agricultural], desc: "Лабораторное мясо — альтернатива натуральным продуктам." },

  // --- Mining (сырьё и ценные материалы) ---
  { id:  8, name: "РУДА (ЖЕЛЕЗО)", buy: 34, sell: 26, stock: 300, economy: [Mining], desc: "Базовая руда для выплавки стали и конструкций." },
  { id:  9, name: "РУДА (ТИТАН)", buy: 145, sell: 118, stock: 60, economy: [Mining], desc: "Лёгкий и прочный металл, востребован в кораблестроении." },
  { id: 10, name: "ДРАГОЦЕННЫЕ МЕТАЛЛЫ", buy: 890, sell: 760, stock: 12, economy: [Mining], desc: "Золото, платина и редкие сплавы — универсальная валюта." },
  { id: 11, name: "РЕДКОЗЕМЕЛЬНЫЕ ЭЛЕМЕНТЫ", buy: 620, sell: 510, stock: 25, economy: [Mining], desc: "Ключевой компонент для высокотехнологичного производства." },
  { id: 12, name: "КРИСТАЛЛЫ (ОПТИЧЕСКИЕ)", buy: 750, sell: 630, stock: 18, economy: [Mining], desc: "Используются в лазерах, сенсорах и квантовых системах." },

  // --- Refinery (переработанные продукты и химия) ---
  { id: 13, name: "МЕДИКАМЕНТЫ", buy: 68, sell: 52, stock: 40, economy: [Refinery], desc: "Базовые препараты для лечения и поддержания здоровья экипажа." },
  { id: 14, name: "ТОПЛИВНЫЕ ПРИСАДКИ", buy: 130, sell: 98, stock: 70, economy: [Refinery, Industrial], desc: "Повышают эффективность топлива и снижают износ двигателей." },
  { id: 15, name: "ПЛАСТИКОВЫЕ КОМПОЗИТЫ", buy: 85, sell: 65, stock: 160, economy: [Refinery], desc: "Универсальный материал для 3D-печати деталей и ремонта." },

  // --- High-Tech (технологии, вооружение, защита) ---
  { id: 16, name: "ОРУЖИЕ (ЛАЗЕР)", buy: 1250, sell: 980, stock: 8, economy: [HighTech], desc: "Компактные лазерные установки для малых кораблей." },
  { id: 17, name: "КОМПЬЮТЕРНЫЕ ЧИПЫ", buy: 320, sell: 260, stock: 45, economy: [HighTech], desc: "Микропроцессоры для бортовых компьютеров и ИИ." },
  { id: 18, name: "ЩИТЫ", buy: 2100, sell: 1700, stock: 5, economy: [HighTech, Industrial], desc: "Энергощиты для защиты от кинетических и энергетических атак." },
  { id: 19, name: "СЕНСОРНЫЕ МАТРИЦЫ", buy: 980, sell: 790, stock: 10, economy: [HighTech], desc: "Продвинутые датчики для сканирования космоса и обнаружения целей." },

  // --- Tourism (предметы роскоши и сувениры) ---
  { id: 20, name: "РОСКОШЬ (СУВЕНИРЫ)", buy: 1200, sell: 1000, stock: 5, economy: [Tourism], desc: "Эксклюзивные предметы для коллекционеров и VIP-пассажиров." },
  { id: 21, name: "ВИРТУАЛЬНЫЕ ТУРЫ", buy: 350, sell: 270, stock: 50, economy: [Tourism], desc: "Иммерсивные записи экскурсий по достопримечательностям галактики." },

  // --- Criminal/Contraband (рискованные товары) ---
  { id: 22, name: "РАБЫ? НЕТ, КОНТРАКТНИКИ", buy: 450, sell: 380, stock: 15, economy: [Spec], desc: "Спорный груз — формально наёмные рабочие, фактически принудительный труд." },
  { id: 23, name: "ЗАПРЕЩЁННЫЕ ПРЕПАРАТЫ", buy: 1100, sell: 920, stock: 8, economy: [Spec], desc: "Сильнодействующие вещества — высокая прибыль, но и высокий риск." },
];

class ModelTradeA
{
    #star;

    constructor()
    {
       this.goods    = [];
       this.Criminal = [22, 23];
    }

    go2CurrentStar() {
        this.#star = GALAXY.getCurrentStar();
        this.#calcGoods();
    }

    #calcGoods()
    {   if(this.#star === null) return;

        this.goods = [];

        const count = 8; // сколько товаров показать на станции
        const N     = GoodsBase.length;

        const cntItemMany = 3;
        const cntItemFew  = 3;

        console.log("🔥 this.#star.idEconomy", this.#star.idEconomy);

        for (let i = 0, cnt = 0, m = 0, f = 0; i < N && cnt < count; i++)
        {
            const baseItem = GoodsBase[i]; // тут ссылка

            // console.log("🧿:", i,". baseItem.economy: ", baseItem.economy);
            // console.log("🔍 baseItem.id", baseItem.id);
            // console.log("🔍 baseItem.economy[0]", baseItem.economy[0]);
            // console.log("🔍 All", All);

            if(baseItem.economy[0] === All)
            {
                /// Хаотичный спрос ---> Нужно смотерь ...
                if(Math.random() < 0.3) continue;

                console.log("\n🟩 All:");

                // Копируем объект
                const item = { ...baseItem };

                const factor = Math.random() <  0.5 ?  -1  :   1;
                const chance = Math.random() * (0.7 - 0.2) + 0.2;

                const diff = this.#getDiff(item, chance);

                item.stock += diff.stock * factor;
                item.buy   -= diff.buy   * factor;
                item.sell   = diff.buy;

                this.#push(item);
                ++cnt;
            }
            else if (m < cntItemMany && 
                this.#containsId(baseItem, this.#star.idEconomy))
            {
                /// Товара много! ---> Игроку выгодно покупать

                //console.log(i,". baseItem.economy: ", baseItem.economy);

                if(Math.random() < 0.2) continue;

                console.log("\n🟩 Много:");

                // Копируем объект
                const item = { ...baseItem };
                const diff = this.#getDiff(item, 0.5);

                item.stock += diff.stock;
                item.buy   -= diff.buy;
                item.sell   = item.buy;

                this.#push(item);
                ++cnt; ++m;
            }
            else if(f < cntItemFew)
            {
                /// Товара мало! ---> Игроку выгодно продавать

                if(Math.random() < 0.5) continue;

                console.log("\n🟩 Мало:");

                // Копируем объект
                const item = { ...baseItem };
                const diff = this.#getDiff(item, 0.5);

                item.stock -= diff.stock;
                item.buy   += diff.buy;
                item.sell   = diff.buy;

                this.#push(item);
                ++cnt; ++f;
            }
        }
        this.#specDanger();
        this.goods.sort((a, b) => a.id - b.id);

        console.log("⭐⭐⭐ Всего товаров: ", this.goods.length);
    }

    #push(item)
    {   // Цена продажи не может быть меньше цены покупки
        if (item.buy < item.sell) {
            console.error("⛔ item.sell > item.buy");
        }

        if(isConsole)
        {   console.table([{ 
                name: item.name, 
                buy:  item.buy, sell: item.sell, stock: item.stock 
            }]);      
        }

        this.goods.push(item);
    }

    // Добавляем криминальные товары в зависимости от star.danger
    #specDanger()
    {
        const trueGovern = [Anarchy, Democracy, MultiGov, MultiGov];
        const isDone = trueGovern.includes(this.#star.idGovernment);

        console.log("🔥 isDone", isDone);
        console.log("🔥 this.#star.danger", this.#star.danger);

        if(isDone && this.#star.danger > 0.4)
        {
            for(let i = 0; i < this.Criminal.length; ++i)
            {   const baseItem = GoodsBase[this.Criminal[i]];

                // Копируем объект
                const item = { ...baseItem };

                const factor = Math.random() <  0.5 ?  -1  :   1;
                const chance = this.#star.danger - 0.1;
                const diff   = this.#getDiff(item, chance);

                item.stock += diff.stock * factor;
                item.buy   -= diff.buy   * factor;
                item.sell   = diff.sell;

                this.#push(item);
            }
        }
    }
    
    // #specIndustrial  (){}
    // #specAgricultural(){}
    // #specMining      (){}
    // #specRefinery    (){}
    // #specHighTech    (){}
    // #specTourism     (){}

    #containsId(item, n) {
        return item.economy.includes(n);
    }

    #getDiff(item, chance)
    {   return {
            stock : Math.ceil(item.stock * chance),
            buy   : Math.ceil(item.buy   * chance),
            sell  : Math.ceil(item.buy   * 0.95),
        };
    }

    #debugArrEconomy(arr)
    {
        // console.log("arr[i]". arr[i]);
    }
}

window.ModelTradeA = ModelTradeA;

class Helper
{
    static Filter(name)
    {
        
    }
}
