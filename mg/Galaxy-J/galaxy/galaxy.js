// galaxy.js — карта галактики для Elite-подобной игры.
// Экспортирует класс Galaxy (singleton-инстанс создаётся в HTML).
//
// Использование:
//   const galaxy = new Galaxy("NGC-4889-Command");   // или число
//   galaxy.init();
//   galaxy.toggle();
//   galaxy.update(dt);
//   galaxy.setPlayerStar(0);
//   galaxy.getCurrentStar();

class Galaxy
{
    // ------------------------------------------------------------------
    //  Приватные поля
    // ------------------------------------------------------------------
    #seed;
    #rng;
    #rngName;
    #stars      = [];
    #links      = [];
    #state      = {
        open:       false,
        playerStar: 0,
        selected:   0,
        jumpCb:     null,
        canvas:     null,
        ctx:        null,
        wrap:       null,
        time:       0,
    };

    get seed() { return this.#seed; }

    // ------------------------------------------------------------------
    //  Константы
    // ------------------------------------------------------------------
    static STAR_COUNT = 64;
    static GALAXY_R   = 1.0;

    // ширина правой панели информации (в пикселях canvas)
    static PANEL_W    = 300;

    static ECONOMIES = [
        "Industrial",
        "Agricultural",
        "Mining",
        "Refinery",
        "High-Tech",
        "Tourism",
    ];

    static GOVERNMENTS = [
        "Anarchy",
        "Feudal",
        "Multi-Gov",
        "Dictatorship",
        "Communist",
        "Confederacy",
        "Democracy",
        "Corporate",
    ];

    static NAME_A = [
        "Al","Be","Ce","Dra","Eri","Fo","Ga","Hy","Ix","Ju",
        "Ko","Lu","My","Ny","Or","Pi","Qu","Ry","Sy","Ty",
        "Ur","Ve","Wo","Xa","Ye","Zo",
    ];

    static NAME_B = [
        "a","e","i","o","u","ar","ir","on","ax","es","ix","or","un","yl",
    ];

    static NAME_C = [
        ""," I"," II"," III"," IV"," V"," Prime"," Major"," Minor"," Alpha"," Beta",
    ];

    static SIGNS = 
    [   '🔆', '🌓', '💧', '👽', '🌳', '💻',
        '🐞', '💀', '🐸', '❄️', '🌀', '🪐'
    ];

    #rndSign(){ return Galaxy.SIGNS[Galaxy.rnd(0, Galaxy.SIGNS.length)] }

    static rnd(min, max)
    {   return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // --------------------------------------------------------------
    //  Конструктор
    // --------------------------------------------------------------
    /**
     * @param {number|string} seed  - Сид галактики.
     * @param {object}        opts  - { starCount, galaxyR }
     */
    constructor(seed, opts = {})
    {
        this.#seed = seed;

        this.starCount = opts.starCount ?? Galaxy.STAR_COUNT;
        this.galaxyR   = opts.galaxyR   ?? Galaxy.GALAXY_R;

        this.#generateStars();
        this.#buildLinks();
    }

    // --------------------------------------------------------------
    //  Приватные утилиты
    // --------------------------------------------------------------
    // только из #generateStars()!
    #makeName() {
        const A = Galaxy.NAME_A;
        const B = Galaxy.NAME_B;
        const C = Galaxy.NAME_C;
        const a = A[Math.floor(this.#rngName() * A.length)];
        const b = B[Math.floor(this.#rngName() * B.length)];
        const c = C[Math.floor(this.#rngName() * C.length)];
        return `${a}${b}${c}`;
    }

    // форматирование населения
    #fmtPop(n) {
        if (n >= 1e9) return (n / 1e9).toFixed(2) + " млрд";
        if (n >= 1e6) return (n / 1e6).toFixed(2) + " млн";
        if (n >= 1e3) return (n / 1e3).toFixed(1) + " тыс.";
        return String(n);
    }

    // форматирование расстояния (галактические единицы -> «св. лет»)
    #fmtDist(d) {
        return (d * 100).toFixed(1); // условные световые годы
    }

    // цвет для уровня LOW/MED/HIGH
    #lvlColor(label) {
        if (label === "LOW")  return "#66ff99";
        if (label === "MID")  return "#ffdd55";
        return "#ff6666";
    }

    // --------------------------------------------------------------
    //  Генерация звёзд
    // --------------------------------------------------------------
    #generateStars()
    {
        this.#stars.length = 0;
        const N = this.starCount;
        const R = this.galaxyR;

        const G = GAME.universe;
        const U = UniverseJS.utils;

        for (let i = 0; i < N; i++) {
            
            const seedStar = G.getStarSeedSG(GAME.pers.seedGalaxy, i);
            this.#rng      = U.mulberry32(seedStar);
            this.#rngName  = U.mulberry32(U.hashCombine(seedStar, 'name'));
            
            const arm   = i % 3;
            const t     = this.#rng();
            const r     = Math.pow(t, 0.6) * R;
            const baseA = (arm / 3) * Math.PI * 2;
            const a     = baseA + r * 4.0 + (this.#rng() - 0.5) * 0.6;

            const x = Math.cos(a) * r + (this.#rng() - 0.5) * 0.05;
            const y = Math.sin(a) * r + (this.#rng() - 0.5) * 0.05;

            const hue    = 0.55 + (this.#rng() - 0.5) * 0.25;
            const color  = `hsl(${(hue * 360) | 0}, 80%, ${65 + this.#rng() * 20}%)`;
            const tech   = 1 + Math.floor(this.#rng() * 15);
            const danger = this.#rng();

            this.#stars.push({
                id:   i,
                seed: seedStar,
                name: Galaxy.SIGNS[0] + this.#makeName(),
                x, y, r, color,
                tech,
                danger,
                hue,
                dangerLabel: danger < 0.33 ? "LOW" : danger < 0.66 ? "MED" : "HIGH",
                techLabel:   tech <= 5 ? "LOW" : tech <= 10 ? "MID" : "HIGH",
                economy:     Galaxy.ECONOMIES[Math.floor(this.#rng() * Galaxy.ECONOMIES.length)],
                population:  Math.floor(1e3 + this.#rng() * 9e9),
                government:  Galaxy.GOVERNMENTS[Math.floor(this.#rng() * Galaxy.GOVERNMENTS.length)],
                links:       [],
            });
        }
    }

    // --------------------------------------------------------------
    //  Связи между близкими звёздами
    // --------------------------------------------------------------
    #buildLinks()
    {
        this.#links.length = 0;

        for (let i = 0; i < this.#stars.length; i++) {
            let best  = null;
            let bestD = Infinity;
            for (let j = 0; j < this.#stars.length; j++) {
                if (i === j) continue;
                const d =
                    (this.#stars[i].x - this.#stars[j].x) ** 2 +
                    (this.#stars[i].y - this.#stars[j].y) ** 2;
                if (d < bestD) { bestD = d; best = j; }
            }
            if (best !== null && bestD < 0.08 * 0.08) {
                this.#links.push([i, best]);
            }
        }

        for (const [a, b] of this.#links) {
            this.#stars[a].links.push(b);
            this.#stars[b].links.push(a);
        }
    }

    // --------------------------------------------------------------
    //  DOM
    // --------------------------------------------------------------
    #ensureDOM()
    {
        if (this.#state.canvas) return;

        // ★ опциональная отладка сида
        if (window.Universe && window.Universe.getSeed) {
            console.log("🔍 Universe.getSeed(99):", window.Universe.getSeed(99));
        }

        const wrap = document.createElement("div");
        wrap.id = "galaxy-map";
        wrap.style.cssText = `
            position: fixed; inset: 0;
            display: none; align-items: stretch; justify-content: stretch;
            background: radial-gradient(ellipse at center, rgba(0,20,10,0.85), rgba(0,0,0,0.95));
            z-index: 50; pointer-events: none;
            font-family: "Courier New", monospace;
            color: #33ff88;
            overflow: hidden;
        `;

        const canvas = document.createElement("canvas");
        canvas.style.cssText = `
            display: block;
            width: 100%;
            height: 100%;
            filter: drop-shadow(0 0 12px #00ff88);
        `;

        const hint = document.createElement("div");
        hint.textContent = "Стрелки — выбор | ENTER — прыжок | M — закрыть";
        hint.style.cssText = `
            position: absolute; bottom: 24px; left: 40%; transform: translateX(-50%);
            font-size: 13px; letter-spacing: 2px; opacity: 0.7;
            text-shadow: 0 0 6px #00ff88;
            pointer-events: none;
        `;

        wrap.appendChild(canvas);
        wrap.appendChild(hint);
        document.body.appendChild(wrap);

        this.#state.wrap   = wrap;
        this.#state.canvas = canvas;
        this.#state.ctx    = canvas.getContext("2d");

        // подгоняем буфер canvas под физический размер окна
        this.#resizeCanvas();
        window.addEventListener("resize", () => this.#resizeCanvas());
    }

    // --------------------------------------------------------------
    //  Подгонка размеров canvas под окно (с учётом DPR)
    // --------------------------------------------------------------
    #resizeCanvas()
    {
        const canvas = this.#state.canvas;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const w   = window.innerWidth;
        const h   = window.innerHeight;

        canvas.width  = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);

        // css-размер оставляем на 100% / 100%
        canvas.style.width  = w + "px";
        canvas.style.height = h + "px";

        // сбрасываем трансформацию и учитываем DPR
        const ctx = this.#state.ctx;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // --------------------------------------------------------------
    //  Публичное API — открытие / закрытие
    // --------------------------------------------------------------
    init() {
        this.#ensureDOM();
    }

    setOpen(v) {
        
        if(v) SNDS.winclose2.play();
        else  SNDS.winclose2.play();
        
        this.#ensureDOM();
        this.#state.open = v;
        this.#state.wrap.style.display = v ? "flex" : "none";
        if (v) this.#state.selected = this.#state.playerStar;
    }

    toggle() { this.setOpen(!this.#state.open); }
    isOpen() { return this.#state.open; }

    // --------------------------------------------------------------
    //  Управление
    // --------------------------------------------------------------
    moveSelection(dx, dy)
    {
        const cur = this.#stars[this.#state.selected];
        let best  = null;
        let bestScore = Infinity;

        for (const s of this.#stars) {
            if (s.id === this.#state.selected) continue;
            const vx = s.x - cur.x;
            const vy = s.y - cur.y;
            const along = vx * dx + vy * dy;
            if (along <= 0) continue;
            const perp = Math.abs(vx * dy - vy * dx);
            const score = perp * 10 - along;
            if (score < bestScore) { bestScore = score; best = s; }
        }

        if (best) this.#state.selected = best.id;
    }

    confirmJump()
    {   if (this.#state.selected === this.#state.playerStar) return;
        if (this.#state.jumpCb) {
            this.#state.jumpCb(
                this.#state.selected,
                this.#stars[this.#state.selected],
            );
        }
    }

    onJumpRequest(cb) { this.#state.jumpCb = cb; }

    // --------------------------------------------------------------
    //  Отрисовка — правая панель информации
    // --------------------------------------------------------------
    #drawInfoPanel(W, H, PANEL_W)
    {
        const ctx = this.#state.ctx;
        const sel = this.#stars[this.#state.selected];
        const ps  = this.#stars[this.#state.playerStar];

        const MARGIN = 10;                        // отступ от краёв экрана
        const pad    = 18;                        // внутренний padding

        // координаты панели с учётом отступа
        const x0 = W - PANEL_W + MARGIN;          // левый край панели
        const y0 = MARGIN;                        // верхний край
        const pw = PANEL_W - MARGIN * 2;          // ширина панели (минус отступы слева/справа)
        const ph = H - MARGIN * 2;                // высота панели (минус отступы сверху/снизу)

        // --- фон панели (скруглённый прямоугольник) ---
        const radius = 8;
        ctx.beginPath();
        ctx.moveTo(x0 + radius, y0);
        ctx.lineTo(x0 + pw - radius, y0);
        ctx.quadraticCurveTo(x0 + pw, y0, x0 + pw, y0 + radius);
        ctx.lineTo(x0 + pw, y0 + ph - radius);
        ctx.quadraticCurveTo(x0 + pw, y0 + ph, x0 + pw - radius, y0 + ph);
        ctx.lineTo(x0 + radius, y0 + ph);
        ctx.quadraticCurveTo(x0, y0 + ph, x0, y0 + ph - radius);
        ctx.lineTo(x0, y0 + radius);
        ctx.quadraticCurveTo(x0, y0, x0 + radius, y0);
        ctx.closePath();

        ctx.fillStyle = "rgba(0,0,15,0.72)";
        ctx.fill();

        // --- рамка панели ---
        ctx.strokeStyle = "rgba(51,255,136,0.55)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // внутренние координаты для контента
        const cx0 = x0 + pad;
        const cx1 = x0 + pw - pad;
        const cyTop = y0 + 40;
        const cyBot = y0 + ph - 20;

        let y = cyTop;
        const lineH = 20;

        // заголовок
        ctx.fillStyle = "#aaffcc";
        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.fillText("STAR INFO", cx0, y);
        y += 8;

        // разделитель
        ctx.strokeStyle = "rgba(51,255,136,0.35)";
        ctx.beginPath();
        ctx.moveTo(cx0, y);
        ctx.lineTo(cx1, y);
        ctx.stroke();
        y += 26;

        // имя
        ctx.fillStyle = "#eaffea";
        ctx.font = 'bold 16px "Courier New", monospace';
        ctx.fillText(sel.name, cx0, y);
        y += lineH + 4;

        // «ВЫ ЗДЕСЬ»
        if (sel.id === this.#state.playerStar) {
            ctx.fillStyle = "#ffff66";
            ctx.font = 'bold 12px "Courier New", monospace';
            ctx.fillText("★ ВЫ ЗДЕСЬ", cx0, y);
            y += lineH;
        }

        y += 6;

        // строки с данными
        const row = (label, value, color) => {
            ctx.fillStyle = "rgba(51,255,136,0.75)";
            ctx.font = '12px "Courier New", monospace';
            ctx.fillText(label, cx0, y);

            ctx.fillStyle = color || "#eaffea";
            ctx.font = 'bold 13px "Courier New", monospace';
            ctx.fillText(String(value), cx0 + 110, y);
            y += lineH;
        };

        row("ЭКОНОМИКА:",  sel.economy);
        row("ПРАВИТЕЛЬСТВО:", sel.government, "#cfe");
        row("НАСЕЛЕНИЕ:",  this.#fmtPop(sel.population));

        row("ТЕХНОЛОГИИ:",
            `${sel.tech} (${sel.techLabel})`,
            this.#lvlColor(sel.techLabel));

        row("ОПАСНОСТЬ:",
            `${(sel.danger * 100) | 0}% (${sel.dangerLabel})`,
            this.#lvlColor(sel.dangerLabel));

        y += 6;

        row("КООРД. X:", sel.x.toFixed(3));
        row("КООРД. Y:", sel.y.toFixed(3));

        const dx = sel.x - ps.x;
        const dy = sel.y - ps.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        row("ДО ВАС:", `${this.#fmtDist(dist)} св. лет`);

        y += 10;

        // секция «соседи»
        ctx.fillStyle = "rgba(51,255,136,0.75)";
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.fillText("СОСЕДИ:", cx0, y);
        y += lineH;

        if (!sel.links || sel.links.length === 0) {
            ctx.fillStyle = "rgba(234,255,234,0.5)";
            ctx.font = '12px "Courier New", monospace';
            ctx.fillText("— нет связей —", cx0 + 8, y);
            y += lineH;
        } else {
            ctx.font = '12px "Courier New", monospace';
            for (const nid of sel.links) {
                if (y > cyBot - 40) break;
                const nb = this.#stars[nid];
                const ndx = nb.x - sel.x;
                const ndy = nb.y - sel.y;
                const nd  = Math.sqrt(ndx * ndx + ndy * ndy);
                ctx.fillStyle = "rgba(234,255,234,0.85)";
                ctx.fillText(`• ${nb.name}`, cx0 + 8, y);
                ctx.fillStyle = "rgba(51,255,136,0.6)";
                ctx.fillText(`${this.#fmtDist(nd)} св.л.`, cx1 - 70, y);
                y += lineH;
            }
        }

        // подсказка внизу панели
        ctx.fillStyle = "rgba(51,255,136,0.4)";
        ctx.font = '10px "Courier New", monospace';
        ctx.fillText("Выбор: стрелки", cx0, cyBot - 14);
        ctx.fillText("Прыжок: ENTER", cx0, cyBot);
    }

    // --------------------------------------------------------------
    //  Отрисовка
    // --------------------------------------------------------------
    #draw()
    {
        const ctx    = this.#state.ctx;
        const canvas = this.#state.canvas;
        const dpr    = window.devicePixelRatio || 1;

        const W = canvas.width  / dpr;
        const H = canvas.height / dpr;

        const PANEL_W = Math.max(220, Math.min(320, W * 0.28));

        const mapW = W - PANEL_W;
        const cx   = mapW / 2;
        const cy   = H / 2;

        // ★ раздельные масштабы по осям → круг превращается в эллипс
        const scaleX = mapW * 0.42;              // ← растяжение по горизонтали
        const scaleY = Math.min(mapW, H) * 0.42; // ← как было по вертикали

        ctx.clearRect(0, 0, W, H);

        // сетка
        ctx.strokeStyle = "rgba(51,255,136,0.10)";
        ctx.lineWidth = 1;
        for (let g = -10; g <= 10; g++) {
            const px = (g / 10) * scaleX;
            const py = (g / 10) * scaleY;
            ctx.beginPath();
            ctx.moveTo(cx + px, cy - scaleY);
            ctx.lineTo(cx + px, cy + scaleY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - scaleX, cy + py);
            ctx.lineTo(cx + scaleX, cy + py);
            ctx.stroke();
        }

        // граница — эллипс
        ctx.strokeStyle = "rgba(51,255,136,0.35)";
        ctx.beginPath();
        ctx.ellipse(cx, cy, scaleX, scaleY, 0, 0, Math.PI * 2);
        ctx.stroke();

        // связи
        ctx.strokeStyle = "rgba(51,255,136,0.18)";
        ctx.lineWidth = 1;
        for (const [a, b] of this.#links) {
            const A = this.#stars[a];
            const B = this.#stars[b];
            ctx.beginPath();
            ctx.moveTo(cx + A.x * scaleX, cy - A.y * scaleY);
            ctx.lineTo(cx + B.x * scaleX, cy - B.y * scaleY);
            ctx.stroke();
        }

        // звёзды
        for (const s of this.#stars)
        {
            const px = cx + s.x * scaleX;   // ← было scale
            const py = cy - s.y * scaleY;   // ← было scale

            const grad = ctx.createRadialGradient(px, py, 0, px, py, 10);
            grad.addColorStop(0, s.color);
            grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(px, py, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();

            if (s.id === this.#state.selected) {
                ctx.fillStyle = "#eaffea";
                ctx.font = '12px "Courier New", monospace';
                ctx.fillText(`${s.name}`, px + 10, py - 6);
                ctx.fillStyle = "rgba(234,255,234,0.7)";
                ctx.fillText(
                    `TECH ${s.tech}  DNG ${(s.danger * 100) | 0}%`,
                    px + 10, py + 8,
                );
            }
        }

        // маркер игрока
        const ps  = this.#stars[this.#state.playerStar];
        const ppx = cx + ps.x * scaleX;
        const ppy = cy - ps.y * scaleY;
        const pulse = 8 + Math.sin(this.#state.time * 4) * 2;

        ctx.strokeStyle = "#ffff66";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ppx, ppy, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#ffff66";
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.fillText("YOU", ppx - 12, ppy - 14);

        // перекрестие
        const sel = this.#stars[this.#state.selected];
        const sx  = cx + sel.x * scaleX;
        const sy  = cy - sel.y * scaleY;
        const k   = 7;

        ctx.strokeStyle = "#33ff88";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx - k, sy - k);     ctx.lineTo(sx - k, sy - k / 2);
        ctx.moveTo(sx - k, sy - k);     ctx.lineTo(sx - k / 2, sy - k);
        ctx.moveTo(sx + k, sy + k);     ctx.lineTo(sx + k, sy + k / 2);
        ctx.moveTo(sx + k, sy + k);     ctx.lineTo(sx + k / 2, sy + k);
        ctx.moveTo(sx - k, sy + k);     ctx.lineTo(sx - k, sy + k / 2);
        ctx.moveTo(sx - k, sy + k);     ctx.lineTo(sx - k / 2, sy + k);
        ctx.moveTo(sx + k, sy - k);     ctx.lineTo(sx + k, sy - k / 2);
        ctx.moveTo(sx + k, sy - k);     ctx.lineTo(sx + k / 2, sy - k);
        ctx.stroke();

        // правая панель
        this.#drawInfoPanel(W, H, PANEL_W);
    }

    // --------------------------------------------------------------
    //  Геттеры
    // --------------------------------------------------------------
    get stars()         { return this.#stars; }
    get currentIndex()  { return this.#state.playerStar; }
    get selectedIndex() { return this.#state.selected; }
    get seed()          { return this.#seed; }

    getCurrentStar()  { return this.#stars[this.#state.playerStar] || null; }
    getSelectedStar() { return this.#stars[this.#state.selected]   || null; }
    getStar(i)        {return this.#stars[i] || null; }

    setPlayerStar(i) {
        this.#state.playerStar = i;
        this.#state.selected   = i;
    }

    // --------------------------------------------------------------
    //  Update — вызывать каждый кадр
    // --------------------------------------------------------------
    update(dt) {
        this.#state.time += dt;
        if (this.#state.open) this.#draw();
    }
}

// -----------------------------------------|
//  Экспорт для Node.js и браузеров
// -----------------------------------------:
if (typeof module !== "undefined" && module.exports) {
    module.exports = Galaxy;
} else {
    window.Galaxy = Galaxy;
}