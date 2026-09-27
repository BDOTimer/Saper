// galaxy.js — карта галактики для Elite-подобной игры
// Экспортирует singleton GALAXY с методами:
//   init()            — подготовить данные (генерирует звёзды, если нужно)
//   toggle()          — открыть/закрыть карту
//   isOpen()          — открыта ли карта
//   setOpen(v)        — задать состояние открытости
//   update(dt)        — вызывать каждый кадр из animate()
//   setPlayerStar(i)  — задать индекс звезды, где сейчас игрок
//   onJumpRequest(cb) — колбэк, вызывается при подтверждении прыжка (Enter)
//   getCurrentStar()  — полные данные о текущей звезде игрока
//   getSelectedStar() — полные данные о выбранной (под прицелом) звезде
//   getStar(i)        — полные данные о звезде по индексу

const GALAXY = (() => {
  // --- Параметры галактики ---
  const STAR_COUNT = 64; // сколько звёзд
  const GALAXY_R = 1.0; // нормированный радиус диска (0..1)
  const SEED = 1338;

  // --- RNG (mulberry32) ---
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- Данные звёзд ---
  // Каждая: { id, name, x, y, r, color, tech, danger,
  //           hue, dangerLabel, techLabel, economy, population, government, links }
  const stars = [];
  const rng = mulberry32(SEED);

  function makeName() {
    const A = [
      "Al",
      "Be",
      "Ce",
      "Dra",
      "Eri",
      "Fo",
      "Ga",
      "Hy",
      "Ix",
      "Ju",
      "Ko",
      "Lu",
      "My",
      "Ny",
      "Or",
      "Pi",
      "Qu",
      "Ry",
      "Sy",
      "Ty",
      "Ur",
      "Ve",
      "Wo",
      "Xa",
      "Ye",
      "Zo",
    ];
    const B = [
      "a",
      "e",
      "i",
      "o",
      "u",
      "ar",
      "ir",
      "on",
      "ax",
      "es",
      "ix",
      "or",
      "un",
      "yl",
    ];
    const C = [
      "",
      " I",
      " II",
      " III",
      " IV",
      " V",
      " Prime",
      " Major",
      " Minor",
      " Alpha",
      " Beta",
    ];
    const a = A[Math.floor(rng() * A.length)];
    const b = B[Math.floor(rng() * B.length)];
    const c = C[Math.floor(rng() * C.length)];
    return `${a}${b}${c}`;
  }

  const ECONOMIES = [
    "Industrial",
    "Agricultural",
    "Mining",
    "Refinery",
    "High-Tech",
    "Tourism",
  ];
  const GOVERNMENTS = [
    "Anarchy",
    "Feudal",
    "Multi-Gov",
    "Dictatorship",
    "Communist",
    "Confederacy",
    "Democracy",
    "Corporate",
  ];

  for (let i = 0; i < STAR_COUNT; i++) {
    // спиральное распределение по диску
    const arm = i % 3;
    const t = rng();
    const r = Math.pow(t, 0.6) * GALAXY_R;
    const baseA = (arm / 3) * Math.PI * 2;
    const a = baseA + r * 4.0 + (rng() - 0.5) * 0.6;
    const x = Math.cos(a) * r + (rng() - 0.5) * 0.05;
    const y = Math.sin(a) * r + (rng() - 0.5) * 0.05;

    const hue = 0.55 + (rng() - 0.5) * 0.25; // синий..красный
    const color = `hsl(${(hue * 360) | 0}, 80%, ${65 + rng() * 20}%)`;
    const tech = 1 + Math.floor(rng() * 15);
    const danger = rng();

    stars.push({
      id: i,
      name: makeName(),
      x,
      y,
      r,
      color,
      tech,
      danger,
      // ★ дополнительные поля
      hue,
      dangerLabel: danger < 0.33 ? "LOW" : danger < 0.66 ? "MED" : "HIGH",
      techLabel: tech <= 5 ? "LOW" : tech <= 10 ? "MID" : "HIGH",
      economy: ECONOMIES[Math.floor(rng() * ECONOMIES.length)],
      population: Math.floor(1e3 + rng() * 9e9),
      government: GOVERNMENTS[Math.floor(rng() * GOVERNMENTS.length)],
      links: [], // заполним ниже
    });
  }

  // Связи между близкими звёздами (для линий «торговых путей»)
  const links = [];
  for (let i = 0; i < stars.length; i++) {
    let best = null;
    let bestD = Infinity;
    for (let j = 0; j < stars.length; j++) {
      if (i === j) continue;
      const d = (stars[i].x - stars[j].x) ** 2 + (stars[i].y - stars[j].y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best !== null && bestD < 0.08 * 0.08) links.push([i, best]);
  }

  // ★ прописываем связи в сами звёзды
  for (const [a, b] of links) {
    stars[a].links.push(b);
    stars[b].links.push(a);
  }

  // --- Состояние ---
  const state = {
    open: false,
    playerStar: 0, // индекс текущей звезды
    selected: 0, // индекс выбранной звезды на карте
    jumpCb: null,
    canvas: null,
    ctx: null,
    time: 0,
  };

  // --- Создание DOM ---
  function ensureDOM() {
    if (state.canvas) return;

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
    canvas.width = 900;
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

    state.canvas = canvas;
    state.ctx = canvas.getContext("2d");
    state.wrap = wrap;
  }

  // --- Переключение ---
  function setOpen(v) {
    ensureDOM();
    state.open = v;
    state.wrap.style.display = v ? "flex" : "none";
    if (v) {
      state.selected = state.playerStar;
    }
  }

  function toggle() {
    setOpen(!state.open);
  }
  function isOpen() {
    return state.open;
  }

  // --- Управление ---
  function moveSelection(dx, dy) {
    const cur = stars[state.selected];
    let best = null;
    let bestScore = Infinity;
    for (const s of stars) {
      if (s.id === state.selected) continue;
      const vx = s.x - cur.x;
      const vy = s.y - cur.y;
      const along = vx * dx + vy * dy;
      if (along <= 0) continue;
      const perp = Math.abs(vx * dy - vy * dx);
      const score = perp * 10 - along;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (best) state.selected = best.id;
  }

  function confirmJump() {
    if (state.selected === state.playerStar) return;
    if (state.jumpCb) state.jumpCb(state.selected, stars[state.selected]);
  }

  // --- Отрисовка ---
  function draw() {
    const ctx = state.ctx;
    const W = state.canvas.width;
    const H = state.canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const scale = Math.min(W, H) * 0.42;

    ctx.clearRect(0, 0, W, H);

    // сетка координат
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

    // круг-граница
    ctx.strokeStyle = "rgba(51,255,136,0.35)";
    ctx.beginPath();
    ctx.arc(cx, cy, scale, 0, Math.PI * 2);
    ctx.stroke();

    // связи
    ctx.strokeStyle = "rgba(51,255,136,0.18)";
    ctx.lineWidth = 1;
    for (const [a, b] of links) {
      const A = stars[a];
      const B = stars[b];
      ctx.beginPath();
      ctx.moveTo(cx + A.x * scale, cy - A.y * scale);
      ctx.lineTo(cx + B.x * scale, cy - B.y * scale);
      ctx.stroke();
    }

    // звёзды
    for (const s of stars) {
      const px = cx + s.x * scale;
      const py = cy - s.y * scale;

      // ореол
      const grad = ctx.createRadialGradient(px, py, 0, px, py, 10);
      grad.addColorStop(0, s.color);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fill();

      // ядро
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // подпись для выбранной
      if (s.id === state.selected) {
        ctx.fillStyle = "#eaffea";
        ctx.font = '12px "Courier New", monospace';
        ctx.fillText(`${s.name}`, px + 10, py - 6);
        ctx.fillStyle = "rgba(234,255,234,0.7)";
        ctx.fillText(
          `TECH ${s.tech}  DNG ${(s.danger * 100) | 0}%`,
          px + 10,
          py + 8,
        );
      }
    }

    // маркер игрока — мигающее кольцо вокруг текущей звезды
    const ps = stars[state.playerStar];
    const ppx = cx + ps.x * scale;
    const ppy = cy - ps.y * scale;
    const pulse = 8 + Math.sin(state.time * 4) * 2;
    ctx.strokeStyle = "#ffff66";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ppx, ppy, pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#ffff66";
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText("YOU", ppx - 12, ppy - 14);

    // перекрестие выбора
    const sel = stars[state.selected];
    const sx = cx + sel.x * scale;
    const sy = cy - sel.y * scale;
    ctx.strokeStyle = "#33ff88";
    ctx.lineWidth = 1.5;
    const k = 7;
    ctx.beginPath();
    ctx.moveTo(sx - k, sy - k);
    ctx.lineTo(sx - k, sy - k / 2);
    ctx.moveTo(sx - k, sy - k);
    ctx.lineTo(sx - k / 2, sy - k);
    ctx.moveTo(sx + k, sy + k);
    ctx.lineTo(sx + k, sy + k / 2);
    ctx.moveTo(sx + k, sy + k);
    ctx.lineTo(sx + k / 2, sy + k);
    ctx.moveTo(sx - k, sy + k);
    ctx.lineTo(sx - k, sy + k / 2);
    ctx.moveTo(sx - k, sy + k);
    ctx.lineTo(sx - k / 2, sy + k);
    ctx.moveTo(sx + k, sy - k);
    ctx.lineTo(sx + k, sy - k / 2);
    ctx.moveTo(sx + k, sy - k);
    ctx.lineTo(sx + k / 2, sy - k);
    ctx.stroke();
  }

  // --- Публичное API ---
  return {
    init() {
      ensureDOM();
    },
    toggle,
    isOpen,
    setOpen,

    get stars() {
      return stars;
    },
    get currentIndex() {
      return state.playerStar;
    },
    get selectedIndex() {
      return state.selected;
    },

    // ★ полные данные о текущей звезде игрока
    getCurrentStar() {
      return stars[state.playerStar] || null;
    },
    // ★ полные данные о выбранной (под прицелом) звезде
    getSelectedStar() {
      return stars[state.selected] || null;
    },
    // ★ звезда по индексу
    getStar(i) {
      return stars[i] || null;
    },

    setPlayerStar(i) {
      state.playerStar = i;
      state.selected = i;
    },
    moveSelection,
    confirmJump,
    onJumpRequest(cb) {
      state.jumpCb = cb;
    },
    update(dt) {
      state.time += dt;
      if (state.open) draw();
    },
  };
})();

//export default GALAXY;
