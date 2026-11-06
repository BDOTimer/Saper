/* ui/tune.js
 * Панель настроек (TUNE) с флажками true/false.
 * Подключение (ES-module):
 *   import { TUNE, TunePanel } from './ui/tune.js';
 *   TunePanel.open();                             // готовая панель "НАСТРОЙКИ"
 *   TunePanel.open({ title, sub, text, checks }); // с кастомными опциями
 *   TunePanel.close();  TunePanel.toggle();  TunePanel.isOpen();
 *
 * Внешние флажки панели — объекты { label, key, onChange? }:
 *   key — имя поля в TUNE, значение пишется туда при каждом переключении.
 *
 * Доступ к значениям из любого модуля:
 *   import { TUNE } from './ui/tune.js';
 *   TUNE.isTestButtle;           // true|false
 *   TUNE.isTestButtle = false;   // "Тест битвы"
 */

// ---------- состояние настроек ----------
export let TUNE = {
  isTestButtle: true, // Тест битвы
};

// ---------- панель ----------
export const TunePanel = (() => {
  // одноразовая инъекция стилей
  const STYLE_ID = "tune-styles";
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
      .tune-overlay{
        position:fixed;inset:0;z-index:2000;
        display:flex;align-items:center;justify-content:center;padding:24px;
        background:radial-gradient(ellipse at 50% 0%,rgba(232,195,122,.08),transparent 55%),rgba(6,10,14,.62);
        -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
        opacity:0;visibility:hidden;pointer-events:none;
        transition:opacity .22s ease,visibility 0s linear .22s;
        font-family:'Gothic1','Share Tech Mono','Courier New',monospace;
      }
      .tune-overlay.open{
        opacity:1;visibility:visible;pointer-events:auto;
        transition:opacity .22s ease,visibility 0s linear 0s;
      }
      .tune-card{
        position:relative;isolation:isolate;box-sizing:border-box;
        width:100%;max-width:480px;max-height:90vh;overflow-y:auto;
        padding:28px 30px 22px;
        border:1px solid transparent;border-radius:16px;
        background:
          linear-gradient(180deg,#18222e 0%,#2a394b 46%,#1e2a38 54%,#10171f 100%) padding-box,
          linear-gradient(110deg,#39465a,#8a652c,#fff0c6,#b98b3e,#39465a,#8a652c,#39465a) border-box;
        background-size:100% 100%,300% 100%;
        animation:tuneRim 12s linear infinite;
        box-shadow:0 30px 90px rgba(0,0,0,.7),
          inset 0 1px 0 rgba(255,255,255,.16),
          inset 0 -2px 0 rgba(0,0,0,.6),
          inset 0 0 70px rgba(0,0,0,.35);
        transform:translateY(12px) scale(.98);opacity:0;
        transition:transform .22s ease,opacity .22s ease;
      }
      .tune-overlay.open .tune-card{transform:none;opacity:1;}
      .tune-card::before{
        content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
        border-radius:inherit;
        background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.07) 48%,rgba(232,195,122,.10) 52%,transparent 65%);
        background-size:300% 100%;
        animation:tuneSweep 8s ease-in-out infinite;
      }
      .tune-card>*{position:relative;z-index:1;}
      @keyframes tuneRim{from{background-position:0 0,0% 0;}to{background-position:0 0,-300% 0;}}
      @keyframes tuneSweep{0%,15%{background-position:150% 0;}60%,100%{background-position:-150% 0;}}
      .tune-title{
        margin:0 0 4px;text-align:center;font-size:30px;font-weight:800;
        letter-spacing:.06em;line-height:1.1;
        background:linear-gradient(180deg,#fff6dc 0%,#f3d795 38%,#b8862f 50%,#ffe9b4 62%,#a9762a 100%);
        -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;
        filter:drop-shadow(0 0 6px rgba(255,224,130,.65)) drop-shadow(0 0 22px rgba(255,180,60,.45)) drop-shadow(0 0 48px rgba(255,140,40,.25));
      }
      .tune-sub{
        margin:0 0 20px;text-align:center;font-size:14px;letter-spacing:.22em;
        text-transform:uppercase;color:#c9ab72;opacity:.9;
      }
      .tune-sub::after{
        content:"";display:block;height:1px;margin:16px auto 0;
        background:linear-gradient(to right,transparent,#8a652c 20%,#e8c37a 50%,#8a652c 80%,transparent);
      }
      .tune-body{font-size:16px;line-height:1.55;color:#c8d2dc;text-align:center;}
      .tune-body p{margin:0 0 10px;}
      .tune-check{
        display:flex;align-items:center;justify-content:center;gap:10px;
        margin:0;padding:10px 14px;margin-bottom:10px;cursor:pointer;user-select:none;
        border:1px solid rgba(138,101,44,.55);border-radius:10px;
        background:linear-gradient(180deg,rgba(26,37,48,.65),rgba(36,52,69,.65));
        box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 2px 8px rgba(0,0,0,.35);
        font:inherit;font-size:16px;font-weight:700;letter-spacing:.08em;
        text-transform:uppercase;color:#f6e7c4;
        transition:filter .2s ease,box-shadow .2s ease;
      }
      .tune-check:hover{filter:brightness(1.15);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 4px 14px rgba(232,195,122,.22);}
      .tune-check input{width:20px;height:20px;margin:0;cursor:pointer;accent-color:#e8c37a;}
      .tune-check .tune-check-val{
        display:inline-flex;justify-content:center;min-width:46px;
        font-size:13px;font-weight:700;color:#c9ab72;
      }
      .tune-foot{
        display:flex;justify-content:center;margin-top:20px;padding-top:18px;
        background:linear-gradient(to right,transparent,#8a652c 20%,#e8c37a 50%,#8a652c 80%,transparent) top/100% 1px no-repeat;
      }
      .tune-btn{
        position:relative;overflow:hidden;padding:11px 22px;
        border:1px solid transparent;border-radius:10px;
        background:
          linear-gradient(180deg,#1a2530 0%,#3c5169 46%,#4a637e 50%,#243445 55%,#121b24 100%) padding-box,
          linear-gradient(180deg,#fff0c6,#8a652c) border-box;
        color:#f6e7c4;font:inherit;font-size:16px;font-weight:700;letter-spacing:.10em;
        text-transform:uppercase;cursor:pointer;
        box-shadow:0 6px 18px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.28),inset 0 -2px 0 rgba(0,0,0,.5);
        transition:transform .18s ease,filter .25s ease,box-shadow .25s ease;
      }
      .tune-btn:hover{transform:translateY(-2px);filter:brightness(1.14);
        box-shadow:0 10px 28px rgba(232,195,122,.28),0 4px 10px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.35);}
      .tune-btn:active{transform:translateY(1px) scale(.985);}
      .tune-card::-webkit-scrollbar{width:10px;height:10px;}
      .tune-card::-webkit-scrollbar-track{background:#0b0f14;border-radius:8px;}
      .tune-card::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#3a4658,#1b222b);border:2px solid #0b0f14;border-radius:8px;}
      .tune-card{scrollbar-color:#2a3441 #0b0f14;scrollbar-width:thin;}
      @media (prefers-reduced-motion:reduce){
        .tune-card,.tune-card::before{animation:none;}
      }
    `;
    document.head.appendChild(st);
  }

  // DOM
  const root = document.createElement("div");
  root.className = "tune-overlay";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="tune-card" role="dialog" aria-modal="true" aria-labelledby="tuneTitle">
      <h2 class="tune-title" id="tuneTitle">НАСТРОЙКИ</h2>
      <div class="tune-sub">TUNE</div>
      <div class="tune-body"></div>
      <div class="tune-foot">
        <button type="button" class="tune-btn" data-tune-close>ЗАКРЫТЬ</button>
      </div>
    </div>
  `;
  // монтируем в конец body
  const mount = () => document.body.appendChild(root);
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });

  const elTitle = root.querySelector("#tuneTitle");
  const elSub   = root.querySelector(".tune-sub");
  const elBody  = root.querySelector(".tune-body");
  const elClose = root.querySelector("[data-tune-close]");

  // ---------- состояние ----------
  let isOpen = false;
  let lastFocus = null;

  // нужно для снятия обработчика close при открытии с разными опциями
  const onCloseClick = () => close();

  // ---------- обработчики ----------
  function onKeydown(e) {
    if (!isOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }
  function onOverlayClick(e) {
    if (e.target === root) close();
  }

  // ---------- флажки ----------
  function renderChecks(checks) {
    checks.forEach(c => {
      const label = document.createElement("label");
      label.className = "tune-check";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!TUNE[c.key];

      const name = document.createElement("span");
      name.textContent = c.label;

      const val = document.createElement("span");
      val.className = "tune-check-val";
      const syncVal = () => { val.textContent = TUNE[c.key] ? "true" : "false"; };
      syncVal();

      cb.addEventListener("change", () => {
        TUNE[c.key] = cb.checked;
        syncVal();
        if (typeof c.onChange === "function") c.onChange(cb.checked);
      });

      label.append(cb, name, val);
      elBody.appendChild(label);
    });
  }

  // ---------- API ----------
  function open(opts = {}) {
    if (isOpen) return;

    const title  = opts.title  ?? "НАСТРОЙКИ";
    const sub    = opts.sub    ?? "TUNE";
    const text   = opts.text   ?? "";
    // флажок по умолчанию — «Тест битвы», пишущий TUNE.isTestButtle
    const checks = opts.checks ?? [{ label: "Тест битвы", key: "isTestButtle" }];

    elTitle.textContent = title;
    elSub.textContent   = sub;
    elBody.innerHTML    = "";
    (Array.isArray(text) ? text : [text]).forEach(t => {
      const p = document.createElement("p");
      p.textContent = t;
      elBody.appendChild(p);
    });
    renderChecks(Array.isArray(checks) ? checks : []);

    lastFocus = document.activeElement;
    isOpen = true;

    root.classList.add("open");
    root.setAttribute("aria-hidden", "false");

    document.addEventListener("keydown", onKeydown, true);
    root.addEventListener("click", onOverlayClick);
    elClose.addEventListener("click", onCloseClick);

    requestAnimationFrame(() => elClose.focus());
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    root.classList.remove("open");
    root.setAttribute("aria-hidden", "true");

    document.removeEventListener("keydown", onKeydown, true);
    root.removeEventListener("click", onOverlayClick);
    elClose.removeEventListener("click", onCloseClick);

    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
    lastFocus = null;
  }

  function toggle(opts) { isOpen ? close() : open(opts); }

  return { open, close, toggle, isOpen: () => isOpen };
})();
