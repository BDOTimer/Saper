/* ============================================================
 * m-note-1.js
 * Краткая справка по игре GALAXY-J.
 * Оверлей поверх основного экрана.
 *
 * Использование:
 *   MNote.show();     // показать
 *   MNote.hide();     // скрыть
 *   MNote.toggle();   // переключить
 *   MNote.isOpen();   // true/false
 *
 * Опционально до подключения:
 *   window.MNOTE_OPTIONS = { title: "…", text: "…" };
 * ============================================================ */
(function () {
  "use strict";

  if (window.MNote && window.MNote.__ready) return;

  var OPTIONS = window.MNOTE_OPTIONS || {};

  var DEFAULT_TITLE = OPTIONS.title || "GALAXY-J — КРАТКО ОБ ИГРЕ";

  var DEFAULT_TEXT =
    OPTIONS.text ||
    [
      "GALAXY-J — космическая игра в жанре открытого мира.",
      "",
      "Вы — пилот корабля «Кобра Mk III» в галактике из 8 секторов.",
      "",
      "• ПУТЕШЕСТВИЯ — гиперпрыжки между звёздными системами. Расход топлива,",
      "  дальность прыжка, дозаправка у станций и в полёте (сбор водорода).",
      "",
      "• ТОРГОВЛЯ — покупка и продажа товаров на станциях: продовольствие,",
      "  текстиль, радиоактивы, оружие, наркотики, рабы и др. Цена зависит от",
      "  системы: где-то дефицит, где-то избыток. На этом и строится доход.",
      "",
      "• БОИ — пираты, полиция и другие корабли. Лазеры, ракеты, энергощит.",
      "  Можно отбиваться, убегать или стать пиратом самому (растёт розыск).",
      "",
      "• РЕПУТАЦИЯ — ваш статус в галактике: законопослушный, нарушитель,",
      "  беглец. От него зависит, кто вас атакует и пустят ли на станцию.",
      "",
      "• РЕКОРДЫ — рост вашего звания по числу побед в бою.",
      "",
      "Цель — выжить, разбогатеть, прокачать корабль и достичь высшего звания.",
    ].join("\n");

  var overlay   = null;
  var panel     = null;
  var titleEl   = null;
  var textEl    = null;
  var lastFocus = null;

  var STYLE_ID = "mnote-1-styles";

  /* Иконки-маркеры для подсвеченных разделов */
  var SECTION_ICONS = {
    "ПУТЕШЕСТВИЯ": "✦",
    "ТОРГОВЛЯ":    "◆",
    "БОИ":         "✧",
    "РЕПУТАЦИЯ":   "◈",
    "РЕКОРДЫ":     "★",
    "ЦЕЛЬ":        "➤",
  };

  var SECTION_RE = /^[•\s]*([A-ZА-ЯЁ]{3,})(\s+—\s+[\s\S]*)$/;
  var GOAL_RE    = /^Цель\s+—\s+[\s\S]*$/i;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = [
      ".mnote-overlay{",
      "  position:fixed; inset:0; z-index:99999;",
      "  display:none; align-items:center; justify-content:center;",
      "  padding:20px;",
      "  background:rgba(4,12,4,0.82);",
      "  backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px);",
      "  font-family:'Courier New',monospace;",
      "  animation:mnote-fade .18s ease-out;",
      "}",
      ".mnote-overlay.is-open{ display:flex; }",
      "@keyframes mnote-fade{ from{opacity:0} to{opacity:1} }",

      ".mnote-panel{",
      "  position:relative;",
      "  width:min(800px, 94vw);",
      "  max-height:88vh;",
      "  overflow:auto;",
      "  padding:clamp(18px,3vh,30px) clamp(18px,4vw,36px);",
      "  background:rgba(10,20,10,0.96);",
      "  border:2px solid #a8ff78;",
      "  border-radius:14px;",
      "  color:#eaffd0;",
      "  box-shadow:0 0 30px rgba(168,255,120,.45), inset 0 0 24px rgba(168,255,120,.08);",
      "  animation:mnote-pop .22s ease-out;",
      "  scrollbar-width:thin;",
      "  scrollbar-color:#a8ff78 rgba(168,255,120,.12);",
      "}",
      ".mnote-panel::-webkit-scrollbar{ width:8px; }",
      ".mnote-panel::-webkit-scrollbar-track{ background:rgba(168,255,120,.08); }",
      ".mnote-panel::-webkit-scrollbar-thumb{ background:#a8ff78; border-radius:4px; }",
      "@keyframes mnote-pop{ from{transform:translateY(12px) scale(.98); opacity:0} to{transform:none; opacity:1} }",

      ".mnote-title{",
      "  margin:0 0 14px; padding-right:44px;",
      "  color:#a8ff78;",
      "  font-size:clamp(18px,4.5vw,26px);",
      "  letter-spacing:3px;",
      "  text-shadow:0 0 10px rgba(168,255,120,.8), 0 0 26px rgba(168,255,120,.4);",
      "  text-transform:uppercase;",
      "}",

      /* --- Базовый текст --- */
      ".mnote-text{",
      "  margin:0;",
      "  font-size:clamp(13px,3.4vw,16px);",
      "  line-height:1.55;",
      "  letter-spacing:.6px;",
      "  color:#eaffd0;",
      "}",
      ".mnote-line{ display:block; }",
      ".mnote-line:empty{ height:.6em; }",

      /* --- Подсвеченный заголовок раздела --- */
      ".mnote-section{",
      "  display:flex; align-items:baseline; gap:10px;",
      "  margin:14px 0 4px;",
      "}",
      ".mnote-section .mnote-icon{",
      "  flex:0 0 auto;",
      "  color:#a8ff78;",
      "  font-size:1.05em;",
      "  text-shadow:0 0 8px rgba(168,255,120,.9), 0 0 20px rgba(168,255,120,.55);",
      "}",
      ".mnote-section .mnote-label{",
      "  color:#c6ff9a;",
      "  font-weight:700;",
      "  letter-spacing:3px;",
      "  text-shadow:0 0 8px rgba(168,255,120,.9), 0 0 22px rgba(168,255,120,.5);",
      "  border-bottom:1px solid rgba(168,255,120,.35);",
      "  padding-bottom:2px;",
      "}",
      ".mnote-section .mnote-body{ color:#eaffd0; }",

      /* --- Блок цели --- */
      ".mnote-goal{",
      "  display:flex; align-items:baseline; gap:10px;",
      "  margin:18px 0 0;",
      "  padding:10px 14px;",
      "  border-left:3px solid #a8ff78;",
      "  border-radius:8px;",
      "  background:linear-gradient(90deg, rgba(168,255,120,.12), rgba(168,255,120,0));",
      "  color:#f4ffe8;",
      "  font-weight:700;",
      "  letter-spacing:.8px;",
      "  box-shadow:0 0 18px rgba(168,255,120,.25);",
      "}",
      ".mnote-goal .mnote-icon{",
      "  color:#a8ff78;",
      "  text-shadow:0 0 10px rgba(168,255,120,.9), 0 0 24px rgba(168,255,120,.55);",
      "}",
      ".mnote-goal .mnote-body{ color:#f4ffe8; }",

      ".mnote-close{",
      "  position:absolute; top:10px; right:10px;",
      "  width:38px; height:38px;",
      "  display:flex; align-items:center; justify-content:center;",
      "  background:rgba(168,255,120,.08);",
      "  border:2px solid #a8ff78;",
      "  border-radius:10px;",
      "  color:#a8ff78;",
      "  font-family:inherit; font-size:20px; line-height:1;",
      "  cursor:pointer;",
      "  transition:all .18s ease;",
      "}",
      ".mnote-close:hover, .mnote-close:focus{",
      "  background:rgba(168,255,120,.25);",
      "  color:#f4ffe8;",
      "  box-shadow:0 0 18px rgba(168,255,120,.6);",
      "  outline:none;",
      "}",
      "@media (max-width:480px){",
      "  .mnote-title{ letter-spacing:2px; }",
      "  .mnote-section .mnote-label{ letter-spacing:2px; }",
      "}",
    ].join("\n");

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  /* Собирает текстовый блок с подсветкой. Возвращает DocumentFragment. */
  function renderRichText(raw) {
    var frag = document.createDocumentFragment();
    var lines = String(raw).split("\n");

    lines.forEach(function (line) {
      var goalMatch = GOAL_RE.test(line.trim());
      var sectionMatch = line.match(SECTION_RE);

      if (goalMatch) {
        var gLabel = "Цель";
        var gBody = line.trim().replace(/^Цель\s+—\s+/i, "");
        frag.appendChild(makeAccentLine("mnote-goal", "➤", gLabel, gBody));
        return;
      }

      if (sectionMatch) {
        var name = sectionMatch[1];
        var body = sectionMatch[2].replace(/^\s+—\s+/, "").trim();
        var icon = SECTION_ICONS[name] || "•";
        frag.appendChild(makeAccentLine("mnote-section", icon, name, body));
        return;
      }

      var span = document.createElement("span");
      span.className = "mnote-line";
      span.textContent = line;
      frag.appendChild(span);
    });

    return frag;
  }

  function makeAccentLine(cls, icon, label, body) {
    var wrap = document.createElement("span");
    wrap.className = cls;

    var iconEl = document.createElement("span");
    iconEl.className = "mnote-icon";
    iconEl.textContent = icon;

    var labelEl = document.createElement("span");
    labelEl.className = "mnote-label";
    labelEl.textContent = label;

    var bodyEl = document.createElement("span");
    bodyEl.className = "mnote-body";
    bodyEl.textContent = body ? " — " + body : "";

    wrap.appendChild(iconEl);
    wrap.appendChild(labelEl);
    if (bodyEl.textContent) wrap.appendChild(bodyEl);

    return wrap;
  }

  function build() {
    if (overlay) return;

    injectStyles();

    overlay = document.createElement("div");
    overlay.className = "mnote-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", DEFAULT_TITLE);

    panel = document.createElement("div");
    panel.className = "mnote-panel";

    titleEl = document.createElement("h2");
    titleEl.className = "mnote-title";
    titleEl.textContent = DEFAULT_TITLE;

    textEl = document.createElement("p");
    textEl.className = "mnote-text";
    textEl.appendChild(renderRichText(DEFAULT_TEXT));

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "mnote-close";
    closeBtn.setAttribute("aria-label", "Закрыть");
    closeBtn.innerHTML = "&#10005;";

    closeBtn.addEventListener("click", hide);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) hide();

      playClick();
    });

    panel.appendChild(closeBtn);
    panel.appendChild(titleEl);
    panel.appendChild(textEl);
    overlay.appendChild(panel);

    (document.body || document.documentElement).appendChild(overlay);
  }

  function onKey(e) {
    if (e.key === "Escape" || e.keyCode === 27) {
      hide();
    }
  }

  function show() {
    build();
    if (overlay.classList.contains("is-open")) return;

    lastFocus = document.activeElement;
    overlay.classList.add("is-open");
    document.addEventListener("keydown", onKey);

    var closeBtn = overlay.querySelector(".mnote-close");
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

  /* Обновление содержимого на лету */
  function setContent(title, text) {
    build();
    if (typeof title === "string") {
      titleEl.textContent = title;
      overlay.setAttribute("aria-label", title);
    }
    if (typeof text === "string") {
      textEl.textContent = "";
      textEl.appendChild(renderRichText(text));
    }
  }

  window.MNote = {
    __ready: true,
    show: show,
    hide: hide,
    toggle: toggle,
    isOpen: isOpen,
    setContent: setContent,
    get element() {
      build();
      return overlay;
    },
  };
})();