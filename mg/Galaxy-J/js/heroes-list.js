/* ============================================================
 * heroes-list.js
 * Таблица героев (рекордов) для GALAXY-J.
 * Оверлей поверх основного экрана, стиль проекта.
 *
 * Использование:
 *   HeroesList.show();
 *   HeroesList.hide();
 *   HeroesList.toggle();
 *   HeroesList.isOpen();
 *
 *   HeroesList.add({ name: "Пилот", score: 12345, rank: "Elite", date: "2025-01-01" });
 *   HeroesList.getAll();      // массив записей
 *   HeroesList.clear();       // очистить всё
 *
 * Хранилище: localStorage, ключ "galaxyj.heroes".
 *
 * Опционально до подключения:
 *   window.HEROES_OPTIONS = { maxEntries: 100, storageKey: "galaxyj.heroes" };
 * ============================================================ */
(function () {
  "use strict";

  if (window.HeroesList && window.HeroesList.__ready) return;

  var OPTIONS      = window.HEROES_OPTIONS || {};
  var STORAGE_KEY  = OPTIONS.storageKey || "galaxyj.heroes";
  var MAX_ENTRIES  = OPTIONS.maxEntries || 100;

  var overlay  = null;
  var panel    = null;
  var tbody    = null;
  var sortKey  = "score";   // "score" | "name" | "rank" | "date"
  var sortDir  = "desc";    // "asc" | "desc"
  var lastFocus = null;

  var STYLE_ID = "heroes-list-styles";

  /* ---------- Демо-данные (если хранилище пустое) ---------- */
  var DEMO = [
    { name: "X-01_Razor"   , score: 128400, rank: "ELITE",    date: "2025-01-12" },
    { name: "ARCTURUS"     , score: 92150,  rank: "DEADLY",   date: "2025-01-09" },
    { name: "LISSA"        , score: 67400,  rank: "DANGEROUS",date: "2025-01-07" },
    { name: "SYN-Drifter"  , score: 41200,  rank: "COMPETENT",date: "2025-01-05" },
    { name: "NAV-Error"    , score: 25800,  rank: "AVERAGE",  date: "2025-01-03" },
    { name: "G-Lock"       , score: 12400,  rank: "POOR",     date: "2024-12-28" },
    { name: "VOID_Protocol", score: 5300,   rank: "HARMLESS", date: "2024-12-22" },
  ];

  /* ============================================================
   * Хранилище
   * ============================================================ */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        save(DEMO);
        return DEMO.slice();
      }
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return DEMO.slice();
      return data;
    } catch (e) {
      return DEMO.slice();
    }
  }

  function save(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
    } catch (e) { /* storage может быть недоступен */ }
  }

  /* ============================================================
   * Стили
   * ============================================================ */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = [
      ".hl-overlay{",
      "  position:fixed; inset:0; z-index:99999;",
      "  display:none; align-items:center; justify-content:center;",
      "  padding:20px;",
      "  background:rgba(4,12,4,0.85);",
      "  backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px);",
      "  font-family:'Courier New',monospace;",
      "  animation:hl-fade .18s ease-out;",
      "}",
      ".hl-overlay.is-open{ display:flex; }",
      "@keyframes hl-fade{ from{opacity:0} to{opacity:1} }",

      ".hl-panel{",
      "  position:relative;",
      "  width:min(860px, 96vw);",
      "  max-height:88vh;",
      "  display:flex; flex-direction:column;",
      "  background:rgba(10,20,10,0.96);",
      "  border:2px solid #a8ff78;",
      "  border-radius:14px;",
      "  color:#eaffd0;",
      "  box-shadow:0 0 30px rgba(168,255,120,.45), inset 0 0 24px rgba(168,255,120,.08);",
      "  animation:hl-pop .22s ease-out;",
      "  overflow:hidden;",
      "}",
      "@keyframes hl-pop{ from{transform:translateY(12px) scale(.98); opacity:0} to{transform:none; opacity:1} }",

      ".hl-header{",
      "  display:flex; align-items:center; justify-content:space-between;",
      "  gap:14px; padding:18px 24px 12px;",
      "  border-bottom:1px solid rgba(168,255,120,.25);",
      "}",
      ".hl-title{",
      "  margin:0; color:#a8ff78;",
      "  font-size:clamp(16px,4vw,22px);",
      "  letter-spacing:3px; text-transform:uppercase;",
      "  text-shadow:0 0 10px rgba(168,255,120,.8), 0 0 26px rgba(168,255,120,.4);",
      "}",

      ".hl-close{",
      "  flex:0 0 auto;",
      "  width:38px; height:38px;",
      "  display:flex; align-items:center; justify-content:center;",
      "  background:rgba(168,255,120,.08);",
      "  border:2px solid #a8ff78;",
      "  border-radius:10px;",
      "  color:#a8ff78;",
      "  font-family:inherit; font-size:20px; line-height:1;",
      "  cursor:pointer; transition:all .18s ease;",
      "}",
      ".hl-close:hover, .hl-close:focus{",
      "  background:rgba(168,255,120,.25);",
      "  color:#f4ffe8;",
      "  box-shadow:0 0 18px rgba(168,255,120,.6);",
      "  outline:none;",
      "}",

      /* --- Область таблицы --- */
      ".hl-body{",
      "  overflow:auto; padding:0 24px 18px;",
      "  scrollbar-width:thin;",
      "  scrollbar-color:#a8ff78 rgba(168,255,120,.12);",
      "}",
      ".hl-body::-webkit-scrollbar{ width:8px; }",
      ".hl-body::-webkit-scrollbar-track{ background:rgba(168,255,120,.08); }",
      ".hl-body::-webkit-scrollbar-thumb{ background:#a8ff78; border-radius:4px; }",

      ".hl-table{",
      "  width:100%; border-collapse:collapse;",
      "  font-size:clamp(12px,3.2vw,15px);",
      "}",
      ".hl-table th, .hl-table td{",
      "  padding:10px 12px; text-align:left;",
      "  border-bottom:1px solid rgba(168,255,120,.18);",
      "  letter-spacing:.8px;",
      "}",
      ".hl-table th{",
      "  color:#c6ff9a;",
      "  font-weight:700;",
      "  letter-spacing:2px;",
      "  text-transform:uppercase;",
      "  cursor:pointer;",
      "  user-select:none; -webkit-user-select:none;",
      "  white-space:nowrap;",
      "  text-shadow:0 0 8px rgba(168,255,120,.5);",
      "}",
      ".hl-table th:hover{ color:#f4ffe8; }",
      ".hl-table th .hl-arrow{ opacity:.55; margin-left:6px; font-size:.9em; }",
      ".hl-table th.is-active .hl-arrow{ opacity:1; color:#a8ff78; }",

      ".hl-table td.hl-num{ text-align:right; font-variant-numeric:tabular-nums; }",
      ".hl-table td.hl-rank{ color:#c6ff9a; }",

      /* --- Топ-3 --- */
      ".hl-table tr.hl-top1 td{",
      "  color:#f4ffe8; font-weight:700;",
      "  text-shadow:0 0 10px rgba(168,255,120,.75);",
      "}",
      ".hl-table tr.hl-top1 .hl-pos{ color:#a8ff78; }",
      ".hl-table tr.hl-top2 .hl-pos{ color:#c6ff9a; }",
      ".hl-table tr.hl-top3 .hl-pos{ color:#a8ff78; opacity:.85; }",
      ".hl-table tr.hl-top1{ background:linear-gradient(90deg, rgba(168,255,120,.14), transparent); }",
      ".hl-table tr.hl-top2{ background:linear-gradient(90deg, rgba(168,255,120,.08), transparent); }",
      ".hl-table tr.hl-top3{ background:linear-gradient(90deg, rgba(168,255,120,.05), transparent); }",

      ".hl-empty{",
      "  padding:32px 12px; text-align:center;",
      "  color:#eaffd0; opacity:.6; letter-spacing:2px;",
      "}",

      /* --- Футер --- */
      ".hl-footer{",
      "  display:flex; justify-content:space-between; align-items:center;",
      "  gap:12px; padding:12px 24px;",
      "  border-top:1px solid rgba(168,255,120,.25);",
      "  font-size:clamp(11px,2.8vw,13px);",
      "  color:#a8ff78; opacity:.75; letter-spacing:2px;",
      "}",
      ".hl-footer .hl-count{ color:#c6ff9a; }",

      "@media (max-width:520px){",
      "  .hl-table th, .hl-table td{ padding:8px 6px; }",
      "  .hl-table th{ letter-spacing:1px; }",
      "  .hl-header, .hl-body, .hl-footer{ padding-left:14px; padding-right:14px; }",
      "}",
    ].join("\n");

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  /* ============================================================
   * Рендер
   * ============================================================ */
  function sortedList() {
    var list = load().slice();
    list.sort(function (a, b) {
      var av = a[sortKey], bv = b[sortKey];
      if (sortKey === "score") { av = +av || 0; bv = +bv || 0; }
      else { av = String(av || "").toUpperCase(); bv = String(bv || "").toUpperCase(); }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }

  function renderRows() {
    if (!tbody) return;

    var list = sortedList();
    tbody.innerHTML = "";

    if (!list.length) {
      var trEmpty = document.createElement("tr");
      var tdEmpty = document.createElement("td");
      tdEmpty.colSpan = 5;
      tdEmpty.className = "hl-empty";
      tdEmpty.textContent = "ПОКА НЕТ ЗАПИСЕЙ";
      trEmpty.appendChild(tdEmpty);
      tbody.appendChild(trEmpty);
      updateCount(0);
      return;
    }

    list.forEach(function (row, i) {
      var tr = document.createElement("tr");
      if (i === 0) tr.className = "hl-top1";
      else if (i === 1) tr.className = "hl-top2";
      else if (i === 2) tr.className = "hl-top3";

      var pos = document.createElement("td");
      pos.className = "hl-pos";
      pos.textContent = String(i + 1).padStart(2, "0");

      var name = document.createElement("td");
      name.textContent = row.name || "—";

      var score = document.createElement("td");
      score.className = "hl-num";
      score.textContent = formatScore(row.score);

      var rank = document.createElement("td");
      rank.className = "hl-rank";
      rank.textContent = row.rank || "—";

      var date = document.createElement("td");
      date.textContent = row.date || "—";

      tr.appendChild(pos);
      tr.appendChild(name);
      tr.appendChild(score);
      tr.appendChild(rank);
      tr.appendChild(date);
      tbody.appendChild(tr);
    });

    updateCount(list.length);
  }

  function formatScore(v) {
    var n = +v || 0;
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  function updateCount(n) {
    var el = overlay && overlay.querySelector(".hl-count");
    if (el) el.textContent = String(n).padStart(2, "0");
  }

  function updateSortIndicators() {
    if (!overlay) return;
    var ths = overlay.querySelectorAll(".hl-table th");
    for (var i = 0; i < ths.length; i++) {
      var th = ths[i];
      var arrow = th.querySelector(".hl-arrow");
      if (th.dataset.key === sortKey) {
        th.classList.add("is-active");
        if (arrow) arrow.textContent = sortDir === "asc" ? "▲" : "▼";
      } else {
        th.classList.remove("is-active");
        if (arrow) arrow.textContent = "↕";
      }
    }
  }

  function onSortClick(e) {
    var th = e.currentTarget;
    var key = th.dataset.key;
    if (!key) return;

    if (sortKey === key) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDir = key === "score" ? "desc" : "asc";
    }
    renderRows();
    updateSortIndicators();
  }

  /* ============================================================
   * Построение DOM
   * ============================================================ */
  function build() {
    if (overlay) return;

    injectStyles();

    overlay = document.createElement("div");
    overlay.className = "hl-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Таблица героев");

    panel = document.createElement("div");
    panel.className = "hl-panel";

    /* header */
    var header = document.createElement("div");
    header.className = "hl-header";

    var title = document.createElement("h2");
    title.className = "hl-title";
    title.textContent = "ТАБЛИЦА ГЕРОЕВ";

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "hl-close";
    closeBtn.setAttribute("aria-label", "Закрыть");
    closeBtn.innerHTML = "&#10005;";
    closeBtn.addEventListener("click", hide);

    header.appendChild(title);
    header.appendChild(closeBtn);

    /* body: таблица */
    var body = document.createElement("div");
    body.className = "hl-body";

    var table = document.createElement("table");
    table.className = "hl-table";

    var thead = document.createElement("thead");
    var trHead = document.createElement("tr");

    var columns = [
      { key: "_pos",  label: "№",       sortable: false },
      { key: "name",  label: "ПИЛОТ",   sortable: true  },
      { key: "score", label: "СЧЁТ",    sortable: true  },
      { key: "rank",  label: "ЗВАНИЕ",  sortable: true  },
      { key: "date",  label: "ДАТА",    sortable: true  },
    ];

    columns.forEach(function (col) {
      var th = document.createElement("th");
      if (col.key === "_pos") {
        th.textContent = col.label;
      } else {
        th.dataset.key = col.key;
        th.textContent = col.label;
        var arrow = document.createElement("span");
        arrow.className = "hl-arrow";
        arrow.textContent = "↕";
        th.appendChild(arrow);
        th.addEventListener("click", onSortClick);
      }
      trHead.appendChild(th);
    });

    thead.appendChild(trHead);

    tbody = document.createElement("tbody");

    table.appendChild(thead);
    table.appendChild(tbody);
    body.appendChild(table);

    /* footer */
    var footer = document.createElement("div");
    footer.className = "hl-footer";
    footer.innerHTML =
      '<span>ЗАПИСЕЙ: <span class="hl-count">00</span></span>' +
      "<span>SORT: SCORE / DESC</span>";

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);
    overlay.appendChild(panel);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) hide();
    });

    (document.body || document.documentElement).appendChild(overlay);
  }

  /* ============================================================
   * Публичное API
   * ============================================================ */
  function onKey(e) {
    if (e.key === "Escape" || e.keyCode === 27) hide();
  }

  function show() {
    build();
    if (overlay.classList.contains("is-open")) return;

    lastFocus = document.activeElement;
    overlay.classList.add("is-open");
    document.addEventListener("keydown", onKey);

    renderRows();
    updateSortIndicators();

    var closeBtn = overlay.querySelector(".hl-close");
    if (closeBtn) closeBtn.focus();
  }

  function hide() {
    if (!overlay || !overlay.classList.contains("is-open")) return;

    overlay.classList.remove("is-open");
    document.removeEventListener("keydown", onKey);

    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }

  function toggle() {
    if (overlay && overlay.classList.contains("is-open")) hide();
    else show();
  }

  function isOpen() {
    return !!(overlay && overlay.classList.contains("is-open"));
  }

  function add(entry) {
    if (!entry || typeof entry !== "object") return;
    var list = load();
    list.push({
      name: String(entry.name || "ANONYMOUS").slice(0, 24),
      score: +entry.score || 0,
      rank: String(entry.rank || "HARMLESS").slice(0, 24),
      date:
        entry.date ||
        new Date().toISOString().slice(0, 10),
    });
    list.sort(function (a, b) { return (+b.score || 0) - (+a.score || 0); });
    save(list);

    if (overlay && overlay.classList.contains("is-open")) {
      renderRows();
    }
  }

  function getAll() {
    return load();
  }

  function clear() {
    save([]);
    if (overlay && overlay.classList.contains("is-open")) renderRows();
  }

  function loadAll() {
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO));
        return Object.assign({}, DEMO);
        }
        var data = JSON.parse(raw);
        return (data && typeof data === "object") ? data : Object.assign({}, DEMO);
    } catch (e) {
        return Object.assign({}, DEMO);
    }
  }

  function saveAll(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) { /* ignore */ }
  }

    /**
   * Получить игрока по имени.
   * Всегда возвращает объект (никогда null) — это удобно для UI.
   */
  function getPlayer(name) {
    if (!name) return { name: "Вася", credits: 0, rank: "HARMLESS" };

    var map = loadAll();
    var key = String(name).trim();

    if (map[key]) {
      // возвращаем копию, чтобы вызывающий код не мутировал хранилище
      return Object.assign({}, map[key]);
    }
    // игрока нет — создаём «болванку» и сохраняем
    var fresh = { name: key, credits: 0, rank: "HARMLESS" };
    map[key] = fresh;
    saveAll(map);
    return Object.assign({}, fresh);
  }

  function setPlayer(name, patch) {
    if (!name) return null;
    var map = loadAll();
    var key = String(name).trim();
    var cur = map[key] || { name: key, credits: 0, rank: "HARMLESS" };
    map[key] = Object.assign({}, cur, patch || {}, { name: key });
    saveAll(map);
    return Object.assign({}, map[key]);
  }

// Герой обновляется, а не дублируется!
function upHero(entry) {
  if (!entry || typeof entry !== "object") return;
  var name = String(entry.name || "ANONYMOUS").slice(0, 24);

  var list = load();
  var idx = -1;
  for (var i = 0; i < list.length; i++) {
    if (list[i].name === name) { idx = i; break; }
  }

  var rec = {
    name:  name,
    score: +entry.score || 0,
    rank:  String(entry.rank || "HARMLESS").slice(0, 24),
    date:  entry.date || new Date().toISOString().slice(0, 10),
  };

  if (idx >= 0) list[idx] = rec;
  else          list.push(rec);

  list.sort(function (a, b) { return (+b.score || 0) - (+a.score || 0); });
  save(list);

  if (overlay && overlay.classList.contains("is-open")) renderRows();
}

/* ============================================================
 * Удаление дубликатов по имени.
 * Оставляет запись с максимальным score.
 * Если score равны — оставляет более позднюю по дате.
 * ============================================================ */
function dedupe() {
  var list = load();

  var map = new Map(); // name -> row
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    var rawName = r.name;
    var name = (rawName == null || String(rawName).trim() === "")
      ? "ANONYMOUS"
      : String(rawName).trim().toUpperCase();

    var row = {
      name:  name,
      score: Number(r.score) || 0,
      rank:  String(r.rank || "HARMLESS").slice(0, 24),
      date:  String(r.date || "")
    };

    var cur = map.get(name);
    if (!cur) { map.set(name, row); continue; }
    if (row.score > cur.score) { map.set(name, row); continue; }
    // при равенстве score — свежее по дате
    if (row.score === cur.score && row.date > cur.date) {
      map.set(name, row);
    }
  }

  var result = Array.from(map.values());
  result.sort(function (a, b) { return b.score - a.score; });

  var removed = list.length - result.length;
  save(result);

  if (overlay && overlay.classList.contains("is-open")) renderRows();

  return { removed: removed, total: result.length, data: result };
}

window.HeroesList = {
    __ready: true,
    show: show,
    hide: hide,
    toggle: toggle,
    isOpen: isOpen,
    add: add,
    getAll: getAll,
    clear: clear,
    get element() {
        build();
        return overlay;
    },

    getPlayer: getPlayer,
    setPlayer: setPlayer,
    upHero   : upHero,
    dedupe   : dedupe,
    _all: loadAll,   // для отладки
};

})();