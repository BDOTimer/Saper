// station-trade.js — экран торговли на станции. Стиль совместим с help.js.
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
//   ESC         — закрыть

const TRADE = (() => {
  // --- Товары станции: { name, buy, sell, stock } ---
  // buy  — сколько платит игрок при покупке (станция продаёт)
  // sell — сколько станция платит игроку при продаже
  // stock — сколько единиц на складе станции (для покупки)
  const GOODS = [
    { name: "ВОДОРОДНОЕ ТОПЛИВО", buy: 12, sell: 8, stock: 240 },
    { name: "ПИЩЕВЫЕ ПАЙКИ", buy: 22, sell: 15, stock: 120 },
    { name: "МЕДИКАМЕНТЫ", buy: 68, sell: 52, stock: 40 },
    { name: "РУДА (ЖЕЛЕЗО)", buy: 34, sell: 26, stock: 300 },
    { name: "РУДА (ТИТАН)", buy: 145, sell: 118, stock: 60 },
    { name: "ДРАГОЦЕННЫЕ МЕТАЛЛЫ", buy: 890, sell: 760, stock: 12 },
    { name: "КОМПЬЮТЕРНЫЕ ЧИПЫ", buy: 320, sell: 260, stock: 45 },
    { name: "ОРУЖИЕ (ЛАЗЕР)", buy: 1250, sell: 980, stock: 8 },
    { name: "ЩИТЫ", buy: 2100, sell: 1700, stock: 5 },
    { name: "РАБЫ? НЕТ, КОНТРАКТНИКИ", buy: 450, sell: 380, stock: 15 },
    { name: "ЧАЙ (ЭЛИТНЫЙ)", buy: 180, sell: 140, stock: 80 },
    { name: "КОФЕ (СИНТ.)", buy: 95, sell: 70, stock: 150 },
  ];

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

  // --- Внутренние помощники ---
  const fmt = n => n.toLocaleString("ru-RU");

  function creditsColor(v) {
    if (v < 0) return "#ff5555";
    return "#ffff88";
  }

  // --- Построение DOM ---
  function ensureDOM() {
    if (state.root) return;

    // Затемняющий фон
    const root = document.createElement("div");
    root.id = "trade-overlay";
    root.style.cssText = `
      position: fixed; inset: 0;
      display: none;
      align-items: center; justify-content: center;
      background: radial-gradient(ellipse at center,
                  rgba(0, 40, 20, 0.55) 0%,
                  rgba(0, 0, 0, 0.92) 70%);
      z-index: 100;
      font-family: "Courier New", monospace;
      color: #33ff88;
      user-select: none;
    `;

    // «Бумага» — панель
    const paper = document.createElement("div");
    paper.style.cssText = `
      position: relative;
      padding: 36px 44px 32px 44px;
      min-width: 720px;
      max-width: 96vmin;
      max-height: 92vmin;
      overflow: hidden;
      display: flex;
      flex-direction: column;

      background:
        linear-gradient(180deg,
          rgba(4, 26, 14, 0.96) 0%,
          rgba(2, 12, 8, 0.98) 100%);
      border: 1px solid #33ff88;
      box-shadow:
        0 0 0 1px rgba(51, 255, 136, 0.25),
        0 0 28px rgba(0, 255, 136, 0.35),
        inset 0 0 60px rgba(0, 255, 136, 0.08);
      border-radius: 4px;
    `;

    // Уголки
    const corners = document.createElement("div");
    corners.style.cssText = `
      position: absolute; inset: 8px; pointer-events: none;
      border: 1px solid rgba(51, 255, 136, 0.18);
      border-radius: 2px;
    `;
    paper.appendChild(corners);

    // Заголовок
    const title = document.createElement("div");
    title.textContent = "ТОРГОВЫЙ ТЕРМИНАЛ — СТАНЦИЯ";
    title.style.cssText = `
      text-align: center;
      font-size: 20px;
      letter-spacing: 6px;
      margin-bottom: 4px;
      color: #a8ffd0;
      text-shadow: 0 0 10px #00ff88, 0 0 3px #00ff88;
    `;
    paper.appendChild(title);

    // Подзаголовок
    const sub = document.createElement("div");
    sub.textContent = "─ станция «КОРИОЛИС» ─ сектор 7-Б ─";
    sub.style.cssText = `
      text-align: center;
      font-size: 11px;
      letter-spacing: 3px;
      opacity: 0.55;
      margin-bottom: 18px;
    `;
    paper.appendChild(sub);

    // Строка кредитов
    const creditsBar = document.createElement("div");
    creditsBar.style.cssText = `
      display: flex; justify-content: space-between;
      font-size: 13px;
      letter-spacing: 3px;
      padding: 6px 4px;
      margin-bottom: 12px;
      border-top: 1px dashed rgba(51, 255, 136, 0.25);
      border-bottom: 1px dashed rgba(51, 255, 136, 0.25);
    `;
    const creditsLabel = document.createElement("div");
    creditsLabel.textContent = "КРЕДИТЫ:";
    creditsLabel.style.cssText = `color: #7dffb0; opacity: 0.8;`;
    const creditsValue = document.createElement("div");
    creditsValue.style.cssText = `font-weight: bold; letter-spacing: 2px;`;
    creditsBar.appendChild(creditsLabel);
    creditsBar.appendChild(creditsValue);
    paper.appendChild(creditsBar);
    state.creditsEl = creditsValue;

    // Основная область: два списка
    const cols = document.createElement("div");
    cols.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      flex: 1;
      min-height: 0;
    `;

    // --- Список 1: товары станции ---
    const col1 = document.createElement("div");
    col1.style.cssText = `display: flex; flex-direction: column; min-height: 0;`;

    const h1 = document.createElement("div");
    h1.textContent = "ТОВАРЫ СТАНЦИИ";
    h1.style.cssText = `
      font-size: 12px; letter-spacing: 4px; color: #7dffb0;
      margin: 0 0 6px 0; padding-bottom: 4px;
      border-bottom: 1px dashed rgba(51, 255, 136, 0.35);
    `;
    col1.appendChild(h1);

    const list1 = document.createElement("div");
    list1.style.cssText = `
      flex: 1; overflow-y: auto;
      border: 1px solid rgba(51, 255, 136, 0.25);
      padding: 4px;
      background: rgba(0, 0, 0, 0.25);
      min-height: 220px;
    `;
    col1.appendChild(list1);
    state.list1El = list1;

    // --- Список 2: инвентарь ---
    const col2 = document.createElement("div");
    col2.style.cssText = `display: flex; flex-direction: column; min-height: 0;`;

    const h2 = document.createElement("div");
    h2.textContent = "ИНВЕНТАРЬ КОРАБЛЯ";
    h2.style.cssText = `
      font-size: 12px; letter-spacing: 4px; color: #7dffb0;
      margin: 0 0 6px 0; padding-bottom: 4px;
      border-bottom: 1px dashed rgba(51, 255, 136, 0.35);
    `;
    col2.appendChild(h2);

    const list2 = document.createElement("div");
    list2.style.cssText = `
      flex: 1; overflow-y: auto;
      border: 1px solid rgba(51, 255, 136, 0.25);
      padding: 4px;
      background: rgba(0, 0, 0, 0.25);
      min-height: 220px;
    `;
    col2.appendChild(list2);
    state.list2El = list2;

    cols.appendChild(col1);
    cols.appendChild(col2);
    paper.appendChild(cols);

    // Нижняя подсказка
    const hint = document.createElement("div");
    hint.style.cssText = `
      text-align: center;
      font-size: 11px;
      letter-spacing: 2px;
      margin-top: 16px;
      opacity: 0.7;
      line-height: 1.6;
    `;
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
      const isSelected = i === state.list1Index && state.activeList === 1;

      row.style.cssText = `
        display: grid;
        grid-template-columns: 1fr auto auto auto;
        gap: 10px;
        padding: 4px 8px;
        font-size: 12px;
        line-height: 1.4;
        cursor: pointer;
        ${
          isSelected
            ? "background: rgba(51,255,136,0.18); outline: 1px solid rgba(51,255,136,0.5);"
            : ""
        }
        ${g.stock <= 0 ? "opacity: 0.35;" : ""}
      `;

      const name = document.createElement("div");
      name.textContent = g.name;
      name.style.cssText = `
        color: ${isSelected ? "#ffff88" : "#bfffd6"};
        letter-spacing: 1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;

      const buy = document.createElement("div");
      buy.textContent = "▲" + fmt(g.buy);
      buy.style.cssText = `color: #ff8888; letter-spacing: 1px;`;

      const sell = document.createElement("div");
      sell.textContent = "▼" + fmt(g.sell);
      sell.style.cssText = `color: #88ff88; letter-spacing: 1px;`;

      const stock = document.createElement("div");
      stock.textContent = "×" + g.stock;
      stock.style.cssText = `color: #7dffb0; opacity: 0.7; letter-spacing: 1px;`;

      row.appendChild(name);
      row.appendChild(buy);
      row.appendChild(sell);
      row.appendChild(stock);

      // Клик мышью — тоже работает
      row.addEventListener("click", () => {
        state.activeList = 1;
        state.list1Index = i;
        renderAll();
      });
      row.addEventListener("dblclick", () => {
        state.activeList = 1;
        state.list1Index = i;
        buySelected();
      });

      el.appendChild(row);
    });

    // Прокрутка к выделенному
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
      empty.style.cssText = `
        text-align: center; opacity: 0.4; padding: 24px;
        font-size: 12px; letter-spacing: 3px;
      `;
      el.appendChild(empty);
      return;
    }

    state.inventory.forEach((item, i) => {
      const row = document.createElement("div");
      const isSelected = i === state.list2Index && state.activeList === 2;

      row.style.cssText = `
        display: grid;
        grid-template-columns: 1fr auto auto auto;
        gap: 10px;
        padding: 4px 8px;
        font-size: 12px;
        line-height: 1.4;
        cursor: pointer;
        ${
          isSelected
            ? "background: rgba(51,255,136,0.18); outline: 1px solid rgba(51,255,136,0.5);"
            : ""
        }
      `;

      const name = document.createElement("div");
      name.textContent = item.name;
      name.style.cssText = `
        color: ${isSelected ? "#ffff88" : "#bfffd6"};
        letter-spacing: 1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;

      const qty = document.createElement("div");
      qty.textContent = "×" + item.qty;
      qty.style.cssText = `color: #7dffb0; letter-spacing: 1px;`;

      const buyPrice = document.createElement("div");
      buyPrice.textContent = "куп:" + fmt(item.buyPrice);
      buyPrice.style.cssText = `color: #ff8888; opacity: 0.75; letter-spacing: 1px; font-size: 11px;`;

      const sellPrice = document.createElement("div");
      // Узнаём текущую цену продажи на станции
      const g = state.goods.find(x => x.name === item.name);
      const curSell = g ? g.sell : Math.round(item.buyPrice * 0.85);
      sellPrice.textContent = "▼" + fmt(curSell);
      sellPrice.style.cssText = `color: #88ff88; letter-spacing: 1px;`;

      row.appendChild(name);
      row.appendChild(qty);
      row.appendChild(buyPrice);
      row.appendChild(sellPrice);

      row.addEventListener("click", () => {
        state.activeList = 2;
        state.list2Index = i;
        renderAll();
      });
      row.addEventListener("dblclick", () => {
        state.activeList = 2;
        state.list2Index = i;
        sellSelected();
      });

      el.appendChild(row);
    });

    if (el.children[state.list2Index]) {
      el.children[state.list2Index].scrollIntoView({ block: "nearest" });
    }
  }

  function renderCredits() {
    const el = state.creditsEl;
    el.textContent = fmt(state.credits) + " cr";
    el.style.color = creditsColor(state.credits);
  }

  function renderHint() {
    const el = state.hintEl;
    const activeName = state.activeList === 1 ? "ТОВАРЫ СТАНЦИИ" : "ИНВЕНТАРЬ";
    el.innerHTML = `
      <span style="color:#ffff88;">↑ ↓</span> — навигация &nbsp;·&nbsp;
      <span style="color:#ffff88;">ENTER</span> — ${
        state.activeList === 1 ? "купить" : "продать"
      } &nbsp;·&nbsp;
      <span style="color:#ffff88;">TAB</span> — переключить список &nbsp;·&nbsp;
      <span style="color:#ffff88;">~ (Ё)</span> — закрыть<br>
      <span style="opacity:0.6;">активный список: <b style="color:#a8ffd0;">${activeName}</b></span>
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
      flashHint("НЕТ В НАЛИЧИИ", "#ff5555");
      return;
    }
    if (state.credits < g.buy) {
      flashHint("НЕДОСТАТОЧНО КРЕДИТОВ", "#ff5555");
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

    flashHint("КУПЛЕНО: " + g.name, "#88ff88");
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

    flashHint(
      `ПРОДАНО: ${item.name} за ${fmt(sellPrice)} cr`,
      "#88ff88"
    );
    renderAll();
  }

  let flashTimer = null;
  function flashHint(text, color) {
    if (!state.hintEl) return;
    const original = state.hintEl.innerHTML;
    state.hintEl.innerHTML = `<span style="color:${color}; letter-spacing:3px; font-weight:bold;">${text}</span>`;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      renderHint();
    }, 900);
  }

  // --- Открытие / закрытие ---
  function setOpen(v) {
    ensureDOM();
    state.open = v;
    state.root.style.display = v ? "flex" : "none";
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

    const key = e.key;

    // Навигация и действия — только когда экран открыт
    if (key === KEY_EXIT || key === "Escape" || e.code === "Escape") {
    //if (key === "1" || e.code === "Digit1" || e.code === "Numpad1") {
      e.preventDefault();
      e.stopPropagation(); // ← Чтобы HTML-листенер не съел событие
      setOpen(false);

      console.log('key === KEY_EXIT');

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
    init() {
      ensureDOM();
      if (!window.__trade_keydown_bound) {
        window.addEventListener("keydown", onKeyDown);
        window.__trade_keydown_bound = true;
      }
    },
    open() {
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
  };
})();

// Подключение как в help.js:
// <script src="./station/station-trade.js"></script>
// В игровом коде вызывайте TRADE.open() при стыковке со станцией.