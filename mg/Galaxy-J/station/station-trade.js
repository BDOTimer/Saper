// station-trade.js — экран торговли на станции. Стиль совместим с help.js.
// Все стили вынесены в station-trade.css (лежит рядом со скриптом).
//
// ★ СПИСОК 2 (правая колонка) — это грузовой отсек корабля (класс CargoA
//   из ship-cargo-a.js). Экран торговли купленные товары НЕ хранит:
//     читает   — cargo.outCargo()
//     покупает — cargo.inCargo({ name, costUp, amount })
//     продаёт  — cargo.takeOut({ name, amount })
//   Единственное место хранения товаров — CargoA#items.
//
// Поток данных:
//   стыковка    cargo.connect(TRADE)  → TRADE.connectCargo(cargo)
//   покупка     buySelected()         → cargo.inCargo(...)
//   продажа     sellSelected()        → cargo.takeOut(...)
//   отображение renderList2()         ← cargo.outCargo()
//   отстыковка  cargo.disconnect()    → TRADE.disconnectCargo(cargo)
//
// API:
//   TRADE.init()                 — подготовить DOM
//   TRADE.dock(cargo, credits)   — СТЫКОВКА: подключить отсек + открыть терминал
//   TRADE.undock()               — ОТСТЫКОВКА: закрыть терминал + отключить отсек
//   TRADE.connectCargo(cargo)    — низкоуровневое подключение (зовёт CargoA.connect)
//   TRADE.disconnectCargo(cargo) — низкоуровневое отключение (зовёт CargoA.disconnect)
//   TRADE.open(credits)          — открыть терминал (стыковку не трогает)
//   TRADE.close() / toggle()     — закрыть/переключить (стыковку НЕ трогают!)
//   TRADE.isOpen()               — открыт ли терминал
//   TRADE.getCargo()             — подключённый отсек или null
//   TRADE.setGoods([...])        — задать список товаров станции
//   TRADE.introStation(star)     — сгенерировать рынок под звезду
//
// Управление:
//   ↑ / ↓       — перемещение по активному списку
//   ENTER       — купить (список 1) / продать (список 2)
//   TAB         — переключить активный список (1 <-> 2)
//   KeyT / Esc  — закрыть терминал (отстыковки НЕ происходит)


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

  // --- Генерация ассортимента станции (без изменений с прошлого шага) ---
  function introStation(star) {
    const U = UniverseJS.utils;

    // Детерминизм: одна и та же звезда -> один и тот же рынок.
    const seedStar =
      typeof star === "number"    ? star :
      (star && star.seed != null) ? star.seed :
      GAME.pers.seedStar;
    const rng = U.mulberry32(seedStar);

    const rndF = (min, max) => min + rng() * (max - min);

    // Очистить ассортимент
    GOODS.length = 0;

    // amount — доля полного каталога (0.4 .. 0.7)
    const totalCatalog = new Set(
      [...GoodsBase, ...GoodsUp, ...GoodsAllContra].map(g => g.name)
    ).size;
    const frac   = rndF(tune.minAmount, tune.maxAmount);
    let   amount = Math.max(1, Math.round(totalCatalog * frac));

    // levelStation 0..2
    const r = rng();
    const levelStation = r < 0.45 ? 0 : r < 0.85 ? 1 : 2;

    // Пул товаров, доступных уровню станции (тип 0,1,2)
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

    amount = Math.min(amount, pool.length);

    // Фишер—Йетс
    const shuffled = pool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (const base of shuffled.slice(0, amount)) {
      const buy   = Math.max(1, Math.round(base.buy   * (1 + rndF(-tune.rangeBuy,   tune.rangeBuy))));
      const sell  = Math.max(1, Math.round(base.sell  * (1 - tune.minussell)));
      const stock = Math.max(0, Math.round(base.stock * (1 + rndF(-tune.rangeStock, tune.rangeStock))));
      GOODS.push({ name: base.name, buy, sell, stock });
    }

    // assert(amount == GOODS.length)
    if (amount !== GOODS.length) {
      console.error("[TRADE] introStation: amount =", amount, "!= GOODS.length =", GOODS.length);
    }

    // Синхронизировать копию для экрана
    state.goods      = GOODS.map(g => ({ ...g }));
    state.list1Index = 0;

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
    goods: GOODS.map(g => ({ ...g })),  // товары станции (копия базовых цен)
    cargo: null,                        // ★ подключённый CargoA или null.
                                        //   Купленные товары здесь НЕ хранятся.
    credits: 15000,
    // UI
    list1Index: 0,
    list2Index: 0,
    activeList: 1,
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

  /* ============ ★ Стыковка: CargoA <-> TradeStation ============ */
  // Имена connectCargo / disconnectCargo — ровно те, что вызывает
  // CargoA.connect() / CargoA.disconnect(), поэтому ship-cargo-a.js не меняем.

  // Товары отсека для отображения (копии записей; [] если отсека нет)
  function cargoItems() {
    return state.cargo ? state.cargo.outCargo() : [];
  }

  // Подключить отсек к станции (вызывается из cargo.connect(TRADE)).
  function connectCargo(cargo) {
    if (!cargo) return false;
    if (state.cargo === cargo) return true;      // уже подключён

    if (state.cargo) state.cargo.disconnect();   // вежливо увести прежний отсек

    state.cargo = cargo;
    state.list2Index = 0;
    if (state.activeList === 2) state.activeList = 1;
    if (state.open) renderAll();                 // список 2 перечитается из отсека
    return true;
  }

  // Отключить отсек (вызывается из cargo.disconnect()).
  function disconnectCargo(cargo) {
    if (!state.cargo) return false;
    if (cargo && state.cargo !== cargo) return false; // чужой отсек — игнорируем

    state.cargo = null;
    state.list2Index = 0;
    if (state.activeList === 2) state.activeList = 1;
    if (state.open) renderAll();
    return true;
  }

  // Стыковка-посещение: подключить отсек и открыть терминал одним вызовом.
  function dock(cargo, credits) {
    if (!cargo) return false;
    if (credits !== undefined) state.credits = credits;
    cargo.connect(TRADE);   // внутри вызовет TRADE.connectCargo(this)
    setOpen(true);
    return true;
  }

  // Отстыковка: закрыть терминал и отключить отсек (корабль улетает).
  function undock() {
    setOpen(false);
    if (state.cargo) state.cargo.disconnect(); // внутри вызовет TRADE.disconnectCargo(this)
  }

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

    // --- Список 2: грузовой отсек корабля (CargoA) ---
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

    // Делегирование для списка 1
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

    // --- Делегирование для списка 2 (грузовой отсек) ---
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
      row.dataset.index = i;
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

      el.appendChild(row);
    });

    if (el.children[state.list1Index]) {
      el.children[state.list1Index].scrollIntoView({ block: "nearest" });
    }
  }

  // ★ Список 2 полностью читается из грузового отсека (CargoA)
  function renderList2() {
    const el = state.list2El;
    el.innerHTML = "";

    // Отсек не подключён — корабль не пристыкован
    if (!state.cargo) {
      const empty = document.createElement("div");
      empty.textContent = "— грузовой отсек не подключён —";
      empty.className = "trade-empty";
      el.appendChild(empty);
      return;
    }

    const items = cargoItems();   // [{ name, costUp, amount }] — только из CargoA

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "— трюм пуст —";
      empty.className = "trade-empty";
      el.appendChild(empty);
      return;
    }

    // выделение могло остаться за пределами после продажи
    if (state.list2Index >= items.length) {
      state.list2Index = Math.max(0, items.length - 1);
    }

    items.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "trade-row";
      row.dataset.index = i;
      row.classList.toggle(
        "selected",
        i === state.list2Index && state.activeList === 2
      );

      const name = document.createElement("div");
      name.textContent = item.name;
      name.className = "trade-cell-name";

      const qty = document.createElement("div");
      qty.textContent = "×" + item.amount;                        // ★ CargoA: amount
      qty.className = "trade-cell-qty";

      const buyPrice = document.createElement("div");
      buyPrice.textContent = "куп:" + fmt(Math.round(item.costUp)); // ★ CargoA: costUp
      buyPrice.className = "trade-cell-buyprice";

      const sellPrice = document.createElement("div");
      const g = state.goods.find(x => x.name === item.name);
      const curSell = g ? g.sell : Math.round(item.costUp * 0.85);
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
    el.classList.toggle("negative", state.credits < 0);
  }

  function renderHint() {
    const el = state.hintEl;
    const activeName = state.activeList === 1 ? "ТОВАРЫ СТАНЦИИ" : "ГРУЗОВОЙ ОТСЕК";
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

  // ★ Покупка: товар уходит в грузовой отсек корабля
  function buySelected() {
    if (state.activeList !== 1) return;

    const g = state.goods[state.list1Index];
    if (!g) return;

    if (!state.cargo) {
      flashHint("ГРУЗОВОЙ ОТСЕК НЕ ПОДКЛЮЧЁН", "error");
      return;
    }
    if (g.stock <= 0) {
      flashHint("НЕТ В НАЛИЧИИ", "error");
      return;
    }
    if (state.credits < g.buy) {
      flashHint("НЕДОСТАТОЧНО КРЕДИТОВ", "error");
      return;
    }

    // Списываем кредиты и склад станции
    state.credits -= g.buy;
    g.stock -= 1;

    // Товар кладём в отсек: CargoA сам склеит партии и пересчитает
    // средневзвешенную costUp.
    state.cargo.inCargo({ name: g.name, costUp: g.buy, amount: 1 });

    fireCreditsChanged();

    flashHint("КУПЛЕНО: " + g.name, "ok");
    renderAll();
  }

  // ★ Продажа: единица забирается из отсека через takeOut()
  function sellSelected() {
    if (state.activeList !== 2) return;

    if (!state.cargo) {
      flashHint("ГРУЗОВОЙ ОТСЕК НЕ ПОДКЛЮЧЁН", "error");
      return;
    }

    const item = cargoItems()[state.list2Index];
    if (!item) return;

    const g = state.goods.find(x => x.name === item.name);
    const sellPrice = g ? g.sell : Math.round(item.costUp * 0.85);

    // Забираем единицу из отсека (данные меняет только CargoA)
    const taken = state.cargo.takeOut({ name: item.name, amount: 1 });
    if (!taken) return; // страховка: содержимое отсека изменилось извне

    // Начисляем кредиты, возвращаем единицу на склад станции
    state.credits += sellPrice;
    if (g) g.stock += 1;

    // поправить выделение, если запись исчезла
    const rest = cargoItems();
    if (state.list2Index >= rest.length) {
      state.list2Index = Math.max(0, rest.length - 1);
    }

    fireCreditsChanged();

    flashHint(
      `ПРОДАНО: ${item.name} за ${fmt(sellPrice)} cr` +
      ` (прибыль ${fmt(Math.round(sellPrice - taken.costUp))})`,
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
  function setOpen(v)
  {
    if(v) SNDS.winopen .play();
    else  SNDS.winclose.play();

    ensureDOM();
    state.open = v;
    state.root.classList.toggle("open", v);
    if (v) {
      state.activeList = 1;
      state.list1Index = Math.min(
        state.list1Index,
        Math.max(0, state.goods.length - 1)
      );
      // ★ list2Index клампится в renderList2 по фактической длине cargoItems()
      renderAll();
    }
  }

  // --- Обработка клавиш ---
  function onKeyDown(e) {
    if (!state.open) return;

    if (e.code === "KeyT") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return;
    }

    const key = e.key;

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
        // ★ длина списка 2 берётся из грузового отсека
        const n = cargoItems().length;
        if (n === 0) return;
        state.list2Index = (state.list2Index + dir + n) % n;
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
    init() {
      ensureDOM();
      if (!window.__trade_keydown_bound) {
        window.addEventListener("keydown", onKeyDown);
        window.__trade_keydown_bound = true;
      }
    },

    /* ★ Стыковка-посещение */
    dock,                 // (cargo, credits) — подключить отсек + открыть терминал
    undock,               // закрыть терминал + отключить отсек
    connectCargo,         // вызывается из CargoA.connect(station)
    disconnectCargo,      // вызывается из CargoA.disconnect()
    getCargo() { return state.cargo; },
    isCargoConnected() { return state.cargo !== null; },

    open(credits) {
      if (credits !== undefined) state.credits = credits; // ★ не затираем, если не передали
      setOpen(true);
    },
    close()  { setOpen(false); },
    toggle() { setOpen(!state.open); },
    isOpen() { return state.open; },

    getCredits() { return state.credits; },
    setCredits(v) { state.credits = v; renderCredits(); fireCreditsChanged(); },
    getGoods() { return state.goods; },
    setGoods(arr) { state.goods = arr.map(g => ({ ...g })); renderAll(); },

    // ★ getInventory()/setInventory() удалены: товары живут только в CargoA.
    //   Сохранение:  JSON.stringify(ship.cargo)
    //   Загрузка:    ship.cargo.fromJSON(JSON.parse(saved))

    introStation,
    setOnCreditsChanged,
  };
})();

window.TRADE = TRADE; // доступ из любого скрипта (как window.CargoA)