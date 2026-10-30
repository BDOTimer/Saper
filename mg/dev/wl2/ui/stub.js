/* ui/stub.js
 * Самодостаточная заглушка для нерабочих кнопок.
 * Использование:
 *   Stub.bind(document.querySelector("#btnShop"));         // навесить на кнопку
 *   Stub.bind(el, { title: "МАГАЗИН", text: "Скоро..." }); // с кастомным текстом
 *   Stub.open({ title: "…", text: "…" });                  // открыть вручную
 *   Stub.close();                                           // закрыть
 *   Stub.isOpen();                                          // bool
 */
(() => {
  // ---------- одноразовая инъекция стилей ----------
  const STYLE_ID = "stub-styles";
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
      .stub-overlay{
        position:fixed;inset:0;z-index:2000;
        display:flex;align-items:center;justify-content:center;padding:24px;
        background:radial-gradient(ellipse at 50% 0%,rgba(232,195,122,.08),transparent 55%),rgba(6,10,14,.62);
        -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
        opacity:0;visibility:hidden;pointer-events:none;
        transition:opacity .22s ease,visibility 0s linear .22s;
        font-family:'Gothic1','Share Tech Mono','Courier New',monospace;
      }
      .stub-overlay.open{
        opacity:1;visibility:visible;pointer-events:auto;
        transition:opacity .22s ease,visibility 0s linear 0s;
      }
      .stub-card{
        position:relative;isolation:isolate;box-sizing:border-box;
        width:100%;max-width:480px;max-height:90vh;overflow-y:auto;
        padding:28px 30px 22px;
        border:1px solid transparent;border-radius:16px;
        background:
          linear-gradient(180deg,#18222e 0%,#2a394b 46%,#1e2a38 54%,#10171f 100%) padding-box,
          linear-gradient(110deg,#39465a,#8a652c,#fff0c6,#b98b3e,#39465a,#8a652c,#39465a) border-box;
        background-size:100% 100%,300% 100%;
        animation:stubRim 12s linear infinite;
        box-shadow:0 30px 90px rgba(0,0,0,.7),
          inset 0 1px 0 rgba(255,255,255,.16),
          inset 0 -2px 0 rgba(0,0,0,.6),
          inset 0 0 70px rgba(0,0,0,.35);
        transform:translateY(12px) scale(.98);opacity:0;
        transition:transform .22s ease,opacity .22s ease;
      }
      .stub-overlay.open .stub-card{transform:none;opacity:1;}
      .stub-card::before{
        content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
        border-radius:inherit;
        background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.07) 48%,rgba(232,195,122,.10) 52%,transparent 65%);
        background-size:300% 100%;
        animation:stubSweep 8s ease-in-out infinite;
      }
      .stub-card>*{position:relative;z-index:1;}
      @keyframes stubRim{from{background-position:0 0,0% 0;}to{background-position:0 0,-300% 0;}}
      @keyframes stubSweep{0%,15%{background-position:150% 0;}60%,100%{background-position:-150% 0;}}
      .stub-title{
        margin:0 0 4px;text-align:center;font-size:30px;font-weight:800;
        letter-spacing:.06em;line-height:1.1;
        background:linear-gradient(180deg,#fff6dc 0%,#f3d795 38%,#b8862f 50%,#ffe9b4 62%,#a9762a 100%);
        -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;
        filter:drop-shadow(0 0 6px rgba(255,224,130,.65)) drop-shadow(0 0 22px rgba(255,180,60,.45)) drop-shadow(0 0 48px rgba(255,140,40,.25));
        animation:stubGlow 3.2s ease-in-out infinite alternate;
      }
      @keyframes stubGlow{
        from{filter:drop-shadow(0 0 5px rgba(255,224,130,.55)) drop-shadow(0 0 18px rgba(255,180,60,.38)) drop-shadow(0 0 40px rgba(255,140,40,.20));}
        to{filter:drop-shadow(0 0 9px rgba(255,235,170,.90)) drop-shadow(0 0 30px rgba(255,190,80,.65)) drop-shadow(0 0 64px rgba(255,150,50,.40));}
      }
      .stub-sub{
        margin:0 0 20px;text-align:center;font-size:14px;letter-spacing:.22em;
        text-transform:uppercase;color:#c9ab72;opacity:.9;
      }
      .stub-sub::after{
        content:"";display:block;height:1px;margin:16px auto 0;
        background:linear-gradient(to right,transparent,#8a652c 20%,#e8c37a 50%,#8a652c 80%,transparent);
      }
      .stub-body{font-size:16px;line-height:1.55;color:#c8d2dc;text-align:center;}
      .stub-body p{margin:0 0 10px;}
      .stub-body p:last-child{margin:0;}
      .stub-foot{
        display:flex;justify-content:center;margin-top:20px;padding-top:18px;
        background:linear-gradient(to right,transparent,#8a652c 20%,#e8c37a 50%,#8a652c 80%,transparent) top/100% 1px no-repeat;
      }
      .stub-btn{
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
      .stub-btn:hover{transform:translateY(-2px);filter:brightness(1.14);
        box-shadow:0 10px 28px rgba(232,195,122,.28),0 4px 10px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.35);}
      .stub-btn:active{transform:translateY(1px) scale(.985);}
      .stub-card::-webkit-scrollbar{width:10px;height:10px;}
      .stub-card::-webkit-scrollbar-track{background:#0b0f14;border-radius:8px;}
      .stub-card::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#3a4658,#1b222b);border:2px solid #0b0f14;border-radius:8px;}
      .stub-card{scrollbar-color:#2a3441 #0b0f14;scrollbar-width:thin;}
      @media (prefers-reduced-motion:reduce){
        .stub-card,.stub-card::before,.stub-title{animation:none;}
      }
    `;
    document.head.appendChild(st);
  }

  // ---------- DOM ----------
  const root = document.createElement("div");
  root.className = "stub-overlay";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="stub-card" role="dialog" aria-modal="true" aria-labelledby="stubTitle">
      <h2 class="stub-title" id="stubTitle">ПАНЕЛЬ</h2>
      <div class="stub-sub">В РАЗРАБОТКЕ</div>
      <div class="stub-body"></div>
      <div class="stub-foot">
        <button type="button" class="stub-btn" data-stub-close>ЗАКРЫТЬ</button>
      </div>
    </div>
  `;
  // вешаем в конец body, чтобы был поверх всего
  const mount = () => document.body.appendChild(root);
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });

  const elTitle = root.querySelector("#stubTitle");
  const elSub   = root.querySelector(".stub-sub");
  const elBody  = root.querySelector(".stub-body");
  const elClose = root.querySelector("[data-stub-close]");

  // ---------- состояние ----------
  let isOpen = false;
  let lastFocus = null;

  // ---------- обработчики ----------
  function onKeydown(e) {
    if (!isOpen) return;
    if (e.code === "Escape" || e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }
  function onOverlayClick(e) {
    if (e.target === root) close();
  }

  // ---------- API ----------
  function open(opts = {}) {
    if (isOpen) return;

    const title = opts.title ?? "ПАНЕЛЬ";
    const sub   = opts.sub   ?? "В РАЗРАБОТКЕ";
    const text  = opts.text  ?? "Этот раздел ещё не готов.";
    const btn   = opts.button ?? "ЗАКРЫТЬ";

    elTitle.textContent = title;
    elSub.textContent   = sub;
    elBody.innerHTML    = "";
    (Array.isArray(text) ? text : [text]).forEach(t => {
      const p = document.createElement("p");
      p.textContent = t;
      elBody.appendChild(p);
    });
    elClose.textContent = btn;

    lastFocus = document.activeElement;
    isOpen = true;

    root.classList.add("open");
    root.setAttribute("aria-hidden", "false");

    document.addEventListener("keydown", onKeydown, true);
    root.addEventListener("click", onOverlayClick);
    elClose.addEventListener("click", close);

    requestAnimationFrame(() => elClose.focus());
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    root.classList.remove("open");
    root.setAttribute("aria-hidden", "true");

    document.removeEventListener("keydown", onKeydown, true);
    root.removeEventListener("click", onOverlayClick);
    elClose.removeEventListener("click", close);

    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
    lastFocus = null;
  }

  function toggle(opts) { isOpen ? close() : open(opts); }

  /**
   * Навесить заглушку на кнопку/элемент.
   * @param {Element} el
   * @param {object}  [opts]
   * @param {string}  [opts.title]   — заголовок
   * @param {string}  [opts.sub]     — подзаголовок (капсом)
   * @param {string|string[]} [opts.text] — тело
   * @param {string}  [opts.button]  — текст кнопки
   * @param {"click"|"pointerdown"} [opts.event="click"]
   */
  function bind(el, opts = {}) {
    if (!el) return () => {};
    const evt = opts.event || "click";
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      open(opts);
    };
    el.addEventListener(evt, handler);
    // вернём функцию для снятия
    return () => el.removeEventListener(evt, handler);
  }

  // ---------- экспорт ----------
  window.Stub = { open, close, toggle, isOpen: () => isOpen, bind };
})();