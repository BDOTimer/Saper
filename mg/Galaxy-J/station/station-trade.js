// station-trade.js — экран торговли на станции. Стиль совместим с help.js.
// Все стили вынесены в station-trade.css (лежит рядом со скриптом).
// API:
//   TRADE.init()          — подготовить DOM
//   TRADE.open()          — открыть экран торговли
//   TRADE.close()         — закрыть
//   TRADE.isOpen()        — открыт ли экран
//   TRADE.toggle()        — переключить
//   TRADE.setGoods([...]) — задать список товаров станции (опционально)
//
// Данные товаров лежат в GOODS ниже — правьте только её.
//
// Управление:
//   ↑ / ↓       — перемещение по списку 1 (товары станции)
//   ENTER       — купить выделенный товар (в инвентарь игрока)
//   TAB         — переключить активный список (1 <-> 2)
//   ↑ / ↓       — в списке 2 работает так же
//   ENTER       — продать выделенный товар (из инвентаря)
//   KeyT        — открыть/закрыть


// ---- Колбэк «кредиты изменились» ----
let onCreditsChangedCallback = null;

const TRADE = (() => {

  const tune = {
    minAmount : 0.4,
    maxAmount : 0.7,
    rangeBuy  : 0.2,
    minussell : 0.2,
    rangeStock: 0.5
  };

  // --- Товары станции: { name, buy, sell, stock } ---
  // buy  — сколько платит игрок при покупке (станция продаёт)
  // sell — сколько станция платит игроку при продаже
  // stock — сколько единиц на складе станции (для покупки)
  const GoodsBase = [
    { name: "ВОДОРОДНОЕ ТОПЛИВО", buy: 12, sell: 8, stock: 240 },
    { name: "ПИЩЕВЫЕ ПАЙКИ", buy: 22, sell: 15, stock: 120 },
    { name: "МЕДИКАМЕНТЫ", buy: 68, sell: 52, stock: 40 },
    { name: "РУДА (ЖЕЛЕЗО)", buy: 34, sell: 26, stock: 300 },
    { name: "КОФЕ (СИНТ.)", buy: 95, sell: 70, stock: 150 },
  ];

  const GoodsUp = [
    { name: "РУДА (ТИТАН)", buy: 145, sell: 118, stock: 60 },
    { name: "ДРАГОЦЕННЫЕ МЕТАЛЛЫ", buy: 890, sell: 760, stock: 12 },
    { name: "КОМПЬЮТЕРНЫЕ ЧИПЫ", buy: 320, sell: 260, stock: 45 },
    { name: "ЩИТЫ", buy: 2100, sell: 1700, stock: 5 },
    { name: "РАБЫ? НЕТ, КОНТРАКТНИКИ", buy: 450, sell: 380, stock: 15 },
    { name: "ЧАЙ (ЭЛИТНЫЙ)", buy: 180, sell: 140, stock: 80 },
  ];

  const GoodsAllContra = [
    { name: "ОРУЖИЕ (ЛАЗЕР)", buy: 1250, sell: 980, stock: 8 },
    { name: "РАБЫ? НЕТ, КОНТРАКТНИКИ", buy: 450, sell: 380, stock: 15 },
  ];

  const GOODS = [];

  // Сгенерировать общее amount товаров от tune
  // Сгенерировать levelStation
  // Сгенерировать от levelStation типы товаров: 0,1,2
  // Положить случайно выбранные товары в GOODS
  // assert(amount == GOODS.length)

  // Поправить стоимость покупки товара на  ±rangeBuy
  // Поправить стоимость продажи товара на -minussell
  // Поправить количество товара на ±rangeStock
    // --- Генерация ассортимента станции (вызывать при стыковке) ---
  function introStation(star) {
    const U = UniverseJS.utils;

    // Детерминизм: одна и та же звезда -> один и тот же рынок.
    // star может быть числом-сидом, объектом { seed } или отсутствовать.
    const seedStar =
      typeof star === "number"    ? star :
      (star && star.seed != null) ? star.seed :
      GAME.pers.seedStar;
    const rng = U.mulberry32(seedStar);

    // float в [min, max)
    const rndF = (min, max) => min + rng() * (max - min);

    // 0) Очистить ассортимент (у массива нет .clear())
    GOODS.length = 0;

    // Сгенерировать общее amount товаров от tune
    //    (доля полного каталога: 0.4 .. 0.7)
    const totalCatalog = new Set(
      [...GoodsBase, ...GoodsUp, ...GoodsAllContra].map(g => g.name)
    ).size;
    const frac   = rndF(tune.minAmount, tune.maxAmount);
    let   amount = Math.max(1, Math.round(totalCatalog * frac));

    // Сгенерировать levelStation (0..2, взвешенно: захолустий больше, чем хабов)
    //    равномерный вариант: const levelStation = Math.floor(rng() * 3);
    const r = rng();
    const levelStation = r < 0.45 ? 0 : r < 0.85 ? 1 : 2;

    // Сгенерировать от levelStation типы товаров: 0,1,2
    //    тип 0 — всегда, тип 1 — с level>=1, тип 2 — с level>=2
    const pool = [];
    const seen = new Set();
    const addToPool = (arr) => {
      for (const g of arr) {
        if (!seen.has(g.name)) { seen.add(g.name); pool.push(g); } // дедуп «КОНТРАКТНИКОВ»
      }
    };
    addToPool(GoodsBase);                             // тип 0
    if (levelStation >= 1) addToPool(GoodsUp);        // тип 1
    if (levelStation >= 2) addToPool(GoodsAllContra); // тип 2

    // Нельзя продавать больше позиций, чем есть в пуле этого уровня
    amount = Math.min(amount, pool.length);

    // Положить случайно выбранные товары в GOODS
    //    (Фишер—Йетс по копии пула)
    const shuffled = pool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (const base of shuffled.slice(0, amount)) {
      // Поправить стоимость покупки товара на  ±rangeBuy
      const buy = Math.max(1, Math.round(
        base.buy * (1 + rndF(-tune.rangeBuy, tune.rangeBuy))));
      // Поправить стоимость продажи товара на -minussell
      //    (если нужен разброс: base.sell * (1 - rng() * tune.minussell))
      const sell = Math.max(1, Math.round(base.sell * (1 - tune.minussell)));
      // Поправить количество товара на ±rangeStock
      const stock = Math.max(0, Math.round(
        base.stock * (1 + rndF(-tune.rangeStock, tune.rangeStock))));

      GOODS.push({ name: base.name, buy, sell, stock });
    }

    // assert(amount == GOODS.length)
    if (amount !== GOODS.length) {
      console.error("[TRADE] introStation: amount =", 
        amount, "!= GOODS.length =", GOODS.length);
    }

    // Синхронизировать состояние экрана (goods — копия, как и раньше)
    state.goods      = GOODS.map(g => ({ ...g }));
    state.list1Index = 0;

    // Обновить подзаголовок (уровень станции) и перерисовать, если DOM собран
    if (state.root) {
      const sub = state.root.querySelector(".trade-subtitle");
      const levelNames = ["ЗАХОЛУСТЬЕ", "ТОРГОВЫЙ УЗЕЛ", "КРУПНЫЙ ХАБ"];
      if (sub) sub.textContent = `─ станция «КОРИОЛИС» ─ ${levelNames[levelStation]} ─`;
      renderAll();
    }

    return levelStation;
  }


  // --- Состояние ---
  const state = {
    open: false,
    root: null,
    // Данные
    goods: GOODS.map(g => ({ ...g })),    // копия, чтобы не мутировать оригинал
    inventory: [],                         // [{ name, qty, buyPrice }]
    credits: 15000,                        // стартовый капитал
    // UI
    list1Index: 0,                         // выделение в списке товаров
    list2Index: 0,                         // выделение в списке инвентаря
    activeList: 1,                         // 1 = товары станции, 2 = инвентарь
    // DOM-узлы
    list1El: null,
    list2El: null,
    creditsEl: null,
    hintEl: null,
  };

  const setOnCreditsChanged = (fn) => {
    onCreditsChangedCallback = typeof fn === "function" ? fn : null;
  };

  const fireCreditsChanged = () => {
    if (onCreditsChangedCallback) onCreditsChangedCallback(state.credits);
  };

  // --- Внутренние помощники ---
  const fmt = n => n.toLocaleString("ru-RU");

  // --- Построение DOM (вся стилистика — в station-trade.css) ---
  function ensureDOM() {
    if (state.root) return;

    // Затемняющий фон
    const root = document.createElement("div");
    root.id = "trade-overlay";

    // «Бумага» — панель
    const paper = document.createElement("div");
    paper.className = "trade-paper";

    // Уголки
    const corners = document.createElement("div");
    corners.className = "trade-corners";
    paper.appendChild(corners);

    // Заголовок
    const title = document.createElement("div");
    title.textContent = "ТОРГОВЫЙ ТЕРМИНАЛ — СТАНЦИЯ";
    title.className = "trade-title";
    paper.appendChild(title);

    // Подзаголовок
    const sub = document.createElement("div");
    sub.textContent = "─ станция «КОРИОЛИС» ─ сектор 7-Б ─";
    sub.className = "trade-subtitle";
    paper.appendChild(sub);

    // Строка кредитов
    const creditsBar = document.createElement("div");
    creditsBar.className = "trade-credits-bar";
    const creditsLabel = document.createElement("div");
    creditsLabel.textContent = "КРЕДИТЫ:";
    creditsLabel.className = "trade-credits-label";
    const creditsValue = document.createElement("div");
    creditsValue.className = "trade-credits-value";
    creditsBar.appendChild(creditsLabel);
    creditsBar.appendChild(creditsValue);
    paper.appendChild(creditsBar);
    state.creditsEl = creditsValue;

    // Основная область: два списка
    const cols = document.createElement("div");
    cols.className = "trade-cols";

    // --- Список 1: товары станции ---
    const col1 = document.createElement("div");
    col1.className = "trade-col";

    const h1 = document.createElement("div");
    h1.textContent = "ТОВАРЫ СТАНЦИИ";
    h1.className = "trade-col-title";
    col1.appendChild(h1);

    const list1 = document.createElement("div");
    list1.className = "trade-list";
    col1.appendChild(list1);
    state.list1El = list1;

    // --- Список 2: инвентарь ---
    const col2 = document.createElement("div");
    col2.className = "trade-col";

    const h2 = document.createElement("div");
    h2.textContent = "ИНВЕНТАРЬ КОРАБЛЯ";
    h2.className = "trade-col-title";
    col2.appendChild(h2);

    const list2 = document.createElement("div");
    list2.className = "trade-list";
    col2.appendChild(list2);
    state.list2El = list2;

    cols.appendChild(col1);
    cols.appendChild(col2);
    paper.appendChild(cols);

    ///+
    list1.addEventListener("click", (e) => {
      const row = e.target.closest(".trade-row");
      if (!row) return;
      state.activeList = 1;
      state.list1Index = +row.dataset.index;
      renderAll();
    });
    list1.addEventListener("dblclick", (e) => {
      const row = e.target.closest(".trade-row");
      if (!row) return;
      state.activeList = 1;
      state.list1Index = +row.dataset.index;
      buySelected();
    });

    // --- Делегирование для списка 2 (инвентарь) ---
    list2.addEventListener("click", (e) => {
      const row = e.target.closest(".trade-row");
      if (!row) return;
      state.activeList = 2;
      state.list2Index = +row.dataset.index;
      renderAll();
    });
    list2.addEventListener("dblclick", (e) => {
      const row = e.target.closest(".trade-row");
      if (!row) return;
      state.activeList = 2;
      state.list2Index = +row.dataset.index;
      sellSelected();
    });

    // Нижняя подсказка
    const hint = document.createElement("div");
    hint.className = "trade-hint";
    paper.appendChild(hint);
    state.hintEl = hint;

    root.appendChild(paper);
    document.body.appendChild(root);

    state.root = root;
  }

  // --- Рендер списков ---
  function renderList1() {
    const el = state.list1El;
    el.innerHTML = "";

    state.goods.forEach((g, i) => {
      const row = document.createElement("div");
      row.className = "trade-row";
      row.dataset.index = i;   // ← ЕДИНСТВЕННОЕ добавление (вместо слушателей на строке)
      row.classList.toggle(
        "selected",
        i === state.list1Index && state.activeList === 1
      );
      row.classList.toggle("out-of-stock", g.stock <= 0);

      const name = document.createElement("div");
      name.textContent = g.name;
      name.className = "trade-cell-name";

      const buy = document.createElement("div");
      buy.textContent = "▲" + fmt(g.buy);
      buy.className = "trade-cell-buy";

      const sell = document.createElement("div");
      sell.textContent = "▼" + fmt(g.sell);
      sell.className = "trade-cell-sell";

      const stock = document.createElement("div");
      stock.textContent = "×" + g.stock;
      stock.className = "trade-cell-stock";

      row.appendChild(name);
      row.appendChild(buy);
      row.appendChild(sell);
      row.appendChild(stock);

      el.appendChild(row);     // ← append остаётся один
    });

    if (el.children[state.list1Index]) {
      el.children[state.list1Index].scrollIntoView({ block: "nearest" });
    }
  }

  function renderList2() {
    const el = state.list2El;
    el.innerHTML = "";

    if (state.inventory.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "— трюм пуст —";
      empty.className = "trade-empty";
      el.appendChild(empty);
      return;
    }

    state.inventory.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "trade-row";
      row.dataset.index = i;   // ← добавление
      row.classList.toggle(
        "selected",
        i === state.list2Index && state.activeList === 2
      );

      const name = document.createElement("div");
      name.textContent = item.name;
      name.className = "trade-cell-name";

      const qty = document.createElement("div");
      qty.textContent = "×" + item.qty;
      qty.className = "trade-cell-qty";

      const buyPrice = document.createElement("div");
      buyPrice.textContent = "куп:" + fmt(item.buyPrice);
      buyPrice.className = "trade-cell-buyprice";

      const sellPrice = document.createElement("div");
      const g = state.goods.find(x => x.name === item.name);
      const curSell = g ? g.sell : Math.round(item.buyPrice * 0.85);
      sellPrice.textContent = "▼" + fmt(curSell);
      sellPrice.className = "trade-cell-sell";

      row.appendChild(name);
      row.appendChild(qty);
      row.appendChild(buyPrice);
      row.appendChild(sellPrice);

      el.appendChild(row);
    });

    if (el.children[state.list2Index]) {
      el.children[state.list2Index].scrollIntoView({ block: "nearest" });
    }
  }

  function renderCredits() {
    const el = state.creditsEl;
    el.textContent = fmt(state.credits) + " cr";
    // Красный цвет при отрицательном балансе — класс .negative в CSS
    el.classList.toggle("negative", state.credits < 0);
  }

  function renderHint() {
    const el = state.hintEl;
    const activeName = state.activeList === 1 ? "ТОВАРЫ СТАНЦИИ" : "ИНВЕНТАРЬ";
    el.innerHTML = `
      <span class="key">↑ ↓</span> — навигация &nbsp;·&nbsp;
      <span class="key">ENTER</span> — ${
        state.activeList === 1 ? "купить" : "продать"
      } &nbsp;·&nbsp;
      <span class="key">TAB</span> — переключить список &nbsp;·&nbsp;
      <span class="key">~ (Ё)</span> — закрыть<br>
      <span class="muted">активный список: <b class="active-list">${activeName}</b></span>
    `;
  }

  function renderAll() {
    renderList1();
    renderList2();
    renderCredits();
    renderHint();
  }

  // --- Действия ---
  function buySelected() {
    if (state.activeList !== 1) return;

    const g = state.goods[state.list1Index];
    if (!g) return;

    if (g.stock <= 0) {
      flashHint("НЕТ В НАЛИЧИИ", "error");
      return;
    }
    if (state.credits < g.buy) {
      flashHint("НЕДОСТАТОЧНО КРЕДИТОВ", "error");
      return;
    }

    // Списываем кредиты и склад
    state.credits -= g.buy;
    g.stock -= 1;

    // Ищем такой товар в инвентаре
    const existing = state.inventory.find(x => x.name === g.name);
    if (existing) {
      // Пересчёт средней цены закупки
      const totalQty = existing.qty + 1;
      existing.buyPrice = Math.round(
        (existing.buyPrice * existing.qty + g.buy) / totalQty
      );
      existing.qty = totalQty;
    } else {
      state.inventory.push({ name: g.name, qty: 1, buyPrice: g.buy });
    }

    fireCreditsChanged();   // ★

    flashHint("КУПЛЕНО: " + g.name, "ok");
    renderAll();
  }

  function sellSelected() {
    if (state.activeList !== 2) return;

    const item = state.inventory[state.list2Index];
    if (!item) return;

    const g = state.goods.find(x => x.name === item.name);
    const sellPrice = g ? g.sell : Math.round(item.buyPrice * 0.85);

    // Начисляем кредиты
    state.credits += sellPrice;

    // Возвращаем на склад (если товар есть в списке станции)
    if (g) g.stock += 1;

    // Уменьшаем количество
    item.qty -= 1;
    if (item.qty <= 0) {
      state.inventory.splice(state.list2Index, 1);
      if (state.list2Index >= state.inventory.length) {
        state.list2Index = Math.max(0, state.inventory.length - 1);
      }
    }

    fireCreditsChanged();

    flashHint(
      `ПРОДАНО: ${item.name} за ${fmt(sellPrice)} cr`,
      "ok"
    );
    renderAll();
  }

  let flashTimer = null;
  // kind: "error" (красный) | "ok" (зелёный) — классы .flash-error / .flash-ok в CSS
  function flashHint(text, kind) {
    if (!state.hintEl) return;
    const cls = kind === "error" ? "flash-error" : "flash-ok";
    state.hintEl.innerHTML = `<span class="flash ${cls}">${text}</span>`;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      renderHint();
    }, 900);
  }

  // --- Открытие / закрытие ---
  function setOpen(v) {
    ensureDOM();
    state.open = v;
    state.root.classList.toggle("open", v); // display: flex/none — в CSS
    if (v) {
      // Сброс выделения при открытии
      state.activeList = 1;
      state.list1Index = Math.min(
        state.list1Index,
        Math.max(0, state.goods.length - 1)
      );
      state.list2Index = Math.min(
        state.list2Index,
        Math.max(0, state.inventory.length - 1)
      );
      renderAll();
    }
  }

  // --- Обработка клавиш ---
  function onKeyDown(e) {
    if (!state.open) return;

    // Навигация и действия — только когда экран открыт
    if (e.code === "KeyT") {
      e.preventDefault();
      e.stopPropagation(); // ← Чтобы HTML-листенер не съел событие
      setOpen(false);

    //console.log("TRADE: closed by key T");

      return;
    }

    const key = e.key; // ← фикс: раньше переменная key не была объявлена (ReferenceError)

    if (key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (key === "Tab") {
      e.preventDefault();
      state.activeList = state.activeList === 1 ? 2 : 1;
      renderAll();
      return;
    }

    if (key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault();
      const dir = key === "ArrowUp" ? -1 : 1;

      if (state.activeList === 1) {
        if (state.goods.length === 0) return;
        state.list1Index =
          (state.list1Index + dir + state.goods.length) % state.goods.length;
      } else {
        if (state.inventory.length === 0) return;
        state.list2Index =
          (state.list2Index + dir + state.inventory.length) %
          state.inventory.length;
      }
      renderAll();
      return;
    }

    if (key === "Enter") {
      e.preventDefault();
      if (state.activeList === 1) buySelected();
      else sellSelected();
      return;
    }
  }

  // --- Публичный API ---
  return {
    introStation,
    init() {
      ensureDOM();
      if (!window.__trade_keydown_bound) {
        window.addEventListener("keydown", onKeyDown);
        window.__trade_keydown_bound = true;
      }
    },
    open(credits) {
      state.credits = credits;
      setOpen(true);
    },
    close() {
      setOpen(false);
    },
    toggle() {
      setOpen(!state.open);
    },
    isOpen() {
      return state.open;
    },
    // Внешний доступ к данным (для сохранения/загрузки)
    getCredits() {
      return state.credits;
    },
    setCredits(v) {
      state.credits = v;
      renderCredits();
      fireCreditsChanged();
    },
    getGoods() {
      return state.goods;
    },
    setGoods(arr) {
      state.goods = arr.map(g => ({ ...g }));
      renderAll();
    },
    getInventory() {
      return state.inventory;
    },
    setInventory(arr) {
      state.inventory = arr.map(i => ({ ...i }));
      state.list2Index = 0;
      renderAll();
    },
    setOnCreditsChanged,   // ← новое
  };
})();

// Подключение как в help.js:
//   <script src="./station/station-trade.js"></script>
//   CSS подгрузится сам; либо подключите вручную:
//   <link rel="stylesheet" href="./station/station-trade.css">
// В игровом коде вызывайте TRADE.open() при стыковке со станцией.