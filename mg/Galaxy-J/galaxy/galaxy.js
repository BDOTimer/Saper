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
            display: none; align-items: center; justify-content: center;
            background: radial-gradient(ellipse at center, rgba(0,20,10,0.85), rgba(0,0,0,0.95));
            z-index: 50; pointer-events: none;
            font-family: "Courier New", monospace;
            color: #33ff88;
        `;

        const canvas = document.createElement("canvas");
        canvas.width  = 900;
        canvas.height = 900;
        canvas.style.cssText = `
            max-width: 92vmin; max-height: 92vmin;
            width: 92vmin; height: 92vmin;
            filter: drop-shadow(0 0 12px #00ff88);
        `;

        const hint = document.createElement("div");
        hint.textContent = "Стрелки — выбор | ENTER — прыжок | M — закрыть";
        hint.style.cssText = `
            position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
            font-size: 13px; letter-spacing: 2px; opacity: 0.7;
            text-shadow: 0 0 6px #00ff88;
        `;

        wrap.appendChild(canvas);
        wrap.appendChild(hint);
        document.body.appendChild(wrap);

        this.#state.wrap   = wrap;
        this.#state.canvas = canvas;
        this.#state.ctx    = canvas.getContext("2d");
    }

    // --------------------------------------------------------------
    //  Публичное API — открытие / закрытие
    // --------------------------------------------------------------
    init() {
        this.#ensureDOM();
    }

    setOpen(v) {
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
    //  Отрисовка
    // --------------------------------------------------------------
    #draw()
    {
        const ctx   = this.#state.ctx;
        const W     = this.#state.canvas.width;
        const H     = this.#state.canvas.height;
        const cx    = W / 2;
        const cy    = H / 2;
        const scale = Math.min(W, H) * 0.42;

        ctx.clearRect(0, 0, W, H);

        // сетка
        ctx.strokeStyle = "rgba(51,255,136,0.10)";
        ctx.lineWidth = 1;
        for (let g = -10; g <= 10; g++) {
            const p = (g / 10) * scale;
            ctx.beginPath();
            ctx.moveTo(cx + p, cy - scale);
            ctx.lineTo(cx + p, cy + scale);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - scale, cy + p);
            ctx.lineTo(cx + scale, cy + p);
            ctx.stroke();
        }

        // граница
        ctx.strokeStyle = "rgba(51,255,136,0.35)";
        ctx.beginPath();
        ctx.arc(cx, cy, scale, 0, Math.PI * 2);
        ctx.stroke();

        // связи
        ctx.strokeStyle = "rgba(51,255,136,0.18)";
        ctx.lineWidth = 1;
        for (const [a, b] of this.#links) {
            const A = this.#stars[a];
            const B = this.#stars[b];
            ctx.beginPath();
            ctx.moveTo(cx + A.x * scale, cy - A.y * scale);
            ctx.lineTo(cx + B.x * scale, cy - B.y * scale);
            ctx.stroke();
        }

        // звёзды
        for (const s of this.#stars)
        {   const px = cx + s.x * scale;
            const py = cy - s.y * scale;

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
        const ppx = cx + ps.x * scale;
        const ppy = cy - ps.y * scale;
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
        const sx  = cx + sel.x * scale;
        const sy  = cy - sel.y * scale;
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
    getStar(i)        { return this.#stars[i] || null; }

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