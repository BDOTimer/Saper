# Карта Галактики — отдельный модуль + вызов по `M`

Ниже — рабочий вариант. Логика такая:

- `galaxy.js` — отдельный ES-модуль с данными звёзд и функциями отрисовки/переключения.
- Карта — **2D-canvas поверх игры**, отдельный слой, не мешает Three.js.
- Точка «где сейчас игрок» — это индекс текущей звезды в массиве `stars`.
- Переключение — по `M`, пауза игрового цикла, пока карта открыта.
- Дополнительно: перемещение по карте стрелками и выбор звезды (курсором), вход в гиперпрыжок — задел на будущее.

---

## 1. Файл `galaxy.js`

```js
// galaxy.js — карта галактики для Elite-подобной игры
// Экспортирует singleton-galaxyMap с методами:
//   init(scene?)   — подготовить данные (генерирует звёзды, если нужно)
//   toggle()       — открыть/закрыть карту
//   isOpen()       — открыта ли карта
//   update(dt)     — вызывать каждый кадр из animate()
//   setPlayerStar(i) — задать индекс звезды, где сейчас игрок
//   onJumpRequest(cb) — колбэк, вызывается при подтверждении прыжка (Enter)

const GALAXY = (() => {
  // --- Параметры галактики ---
  const STAR_COUNT   = 64;      // сколько звёзд
  const GALAXY_R     = 1.0;     // нормированный радиус диска (0..1)
  const SEED         = 1337;

  // --- RNG (mulberry32) ---
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- Данные звёзд ---
  // Каждая: { id, name, x, y, r, color, tech, danger }
  const stars = [];
  const rng = mulberry32(SEED);

  function makeName(i) {
    const A = ['Al','Be','Ce','Dra','Eri','Fo','Ga','Hy','Ix','Ju','Ko','Lu','My','Ny','Or','Pi','Qu','Ry','Sy','Ty','Ur','Ve','Wo','Xa','Ye','Zo'];
    const B = ['a','e','i','o','u','ar','ir','on','ax','es','ix','or','un','yl'];
    const C = ['',' I',' II',' III',' IV',' V',' Prime',' Major',' Minor',' Alpha',' Beta'];
    const a = A[Math.floor(rng() * A.length)];
    const b = B[Math.floor(rng() * B.length)];
    const c = C[Math.floor(rng() * C.length)];
    return `${a}${b}${c}`;
  }

  for (let i = 0; i < STAR_COUNT; i++) {
    // спиральное распределение по диску
    const arm   = i % 3;
    const t     = rng();
    const r     = Math.pow(t, 0.6) * GALAXY_R;
    const baseA = (arm / 3) * Math.PI * 2;
    const a     = baseA + r * 4.0 + (rng() - 0.5) * 0.6;
    const x     = Math.cos(a) * r + (rng() - 0.5) * 0.05;
    const y     = Math.sin(a) * r + (rng() - 0.5) * 0.05;

    const hue   = 0.55 + (rng() - 0.5) * 0.25;         // синий..красный
    const color = `hsl(${(hue * 360) | 0}, 80%, ${65 + rng() * 20}%)`;
    const tech  = 1 + Math.floor(rng() * 15);
    const danger= rng();

    stars.push({ id: i, name: makeName(i), x, y, r, color, tech, danger });
  }

  // Связи между близкими звёздами (для линий «торговых путей»)
  const links = [];
  for (let i = 0; i < stars.length; i++) {
    let best = null, bestD = Infinity;
    for (let j = 0; j < stars.length; j++) {
      if (i === j) continue;
      const d = (stars[i].x - stars[j].x) ** 2 + (stars[i].y - stars[j].y) ** 2;
      if (d < bestD) { bestD = d; best = j; }
    }
    if (best !== null && bestD < 0.08 * 0.08) links.push([i, best]);
  }

  // --- Состояние ---
  const state = {
    open: false,
    playerStar: 0,       // индекс текущей звезды
    selected: 0,         // индекс выбранной звезды на карте
    jumpCb: null,
    canvas: null,
    ctx: null,
    time: 0,
    // анимация «прицела» вокруг выбранной звезды
  };

  // --- Создание DOM ---
  function ensureDOM() {
    if (state.canvas) return;

    const wrap = document.createElement('div');
    wrap.id = 'galaxy-map';
    wrap.style.cssText = `
      position: fixed; inset: 0;
      display: none; align-items: center; justify-content: center;
      background: radial-gradient(ellipse at center, rgba(0,20,10,0.85), rgba(0,0,0,0.95));
      z-index: 50; pointer-events: none;
      font-family: "Courier New", monospace;
      color: #33ff88;
    `;

    const canvas = document.createElement('canvas');
    canvas.width  = 900;
    canvas.height = 900;
    canvas.style.cssText = `
      max-width: 92vmin; max-height: 92vmin;
      width: 92vmin; height: 92vmin;
      filter: drop-shadow(0 0 12px #00ff88);
    `;

    const hint = document.createElement('div');
    hint.textContent = 'Стрелки — выбор | ENTER — прыжок | M — закрыть';
    hint.style.cssText = `
      position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
      font-size: 13px; letter-spacing: 2px; opacity: 0.7;
      text-shadow: 0 0 6px #00ff88;
    `;

    wrap.appendChild(canvas);
    wrap.appendChild(hint);
    document.body.appendChild(wrap);

    state.canvas = canvas;
    state.ctx    = canvas.getContext('2d');
    state.wrap   = wrap;
  }

  // --- Переключение ---
  function setOpen(v) {
    ensureDOM();
    state.open = v;
    state.wrap.style.display = v ? 'flex' : 'none';
    if (v) {
      state.selected = state.playerStar;
    }
  }

  function toggle() { setOpen(!state.open); }
  function isOpen() { return state.open; }

  // --- Управление ---
  function moveSelection(dx, dy) {
    const cur = stars[state.selected];
    let best = null, bestScore = Infinity;
    for (const s of stars) {
      if (s.id === state.selected) continue;
      const vx = s.x - cur.x, vy = s.y - cur.y;
      // проекция на направление
      const along = vx * dx + vy * dy;
      if (along <= 0) continue;
      const perp = Math.abs(vx * dy - vy * dx);
      const score = perp * 10 - along;    // ближе по направлению и ближе по расстоянию
      if (score < bestScore) { bestScore = score; best = s; }
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
    const W = state.canvas.width, H = state.canvas.height;
    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) * 0.42;

    ctx.clearRect(0, 0, W, H);

    // сетка координат
    ctx.strokeStyle = 'rgba(51,255,136,0.10)';
    ctx.lineWidth = 1;
    for (let g = -10; g <= 10; g++) {
      const p = g / 10 * scale;
      ctx.beginPath(); ctx.moveTo(cx + p, cy - scale); ctx.lineTo(cx + p, cy + scale); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - scale, cy + p); ctx.lineTo(cx + scale, cy + p); ctx.stroke();
    }

    // круг-граница
    ctx.strokeStyle = 'rgba(51,255,136,0.35)';
    ctx.beginPath(); ctx.arc(cx, cy, scale, 0, Math.PI * 2); ctx.stroke();

    // связи
    ctx.strokeStyle = 'rgba(51,255,136,0.18)';
    ctx.lineWidth = 1;
    for (const [a, b] of links) {
      const A = stars[a], B = stars[b];
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
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();

      // ядро
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();

      // подпись для выбранной
      if (s.id === state.selected) {
        ctx.fillStyle = '#eaffea';
        ctx.font = '12px "Courier New", monospace';
        ctx.fillText(`${s.name}`, px + 10, py - 6);
        ctx.fillStyle = 'rgba(234,255,234,0.7)';
        ctx.fillText(`TECH ${s.tech}  DNG ${(s.danger * 100) | 0}%`, px + 10, py + 8);
      }
    }

    // маркер игрока — мигающее кольцо вокруг текущей звезды
    const ps = stars[state.playerStar];
    const ppx = cx + ps.x * scale;
    const ppy = cy - ps.y * scale;
    const pulse = 8 + Math.sin(state.time * 4) * 2;
    ctx.strokeStyle = '#ffff66';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ppx, ppy, pulse, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = '#ffff66';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText('YOU', ppx - 12, ppy - 14);

    // перекрестие выбора
    const sel = stars[state.selected];
    const sx = cx + sel.x * scale;
    const sy = cy - sel.y * scale;
    ctx.strokeStyle = '#33ff88';
    ctx.lineWidth = 1.5;
    const k = 7;
    ctx.beginPath();
    ctx.moveTo(sx - k, sy - k); ctx.lineTo(sx - k, sy - k / 2);
    ctx.moveTo(sx - k, sy - k); ctx.lineTo(sx - k / 2, sy - k);
    ctx.moveTo(sx + k, sy + k); ctx.lineTo(sx + k, sy + k / 2);
    ctx.moveTo(sx + k, sy + k); ctx.lineTo(sx + k / 2, sy + k);
    ctx.moveTo(sx - k, sy + k); ctx.lineTo(sx - k, sy + k / 2);
    ctx.moveTo(sx - k, sy + k); ctx.lineTo(sx - k / 2, sy + k);
    ctx.moveTo(sx + k, sy - k); ctx.lineTo(sx + k, sy - k / 2);
    ctx.moveTo(sx + k, sy - k); ctx.lineTo(sx + k / 2, sy - k);
    ctx.stroke();
  }

  // --- Публичное API ---
  return {
    init() { ensureDOM(); },
    toggle, isOpen, setOpen,
    get stars() { return stars; },
    get currentIndex() { return state.playerStar; },
    setPlayerStar(i) { state.playerStar = i; state.selected = i; },
    moveSelection,
    confirmJump,
    onJumpRequest(cb) { state.jumpCb = cb; },
    update(dt) {
      state.time += dt;
      if (state.open) draw();
    }
  };
})();

export default GALAXY;
```

---

## 2. Подключение в основном `index.html`

Рядом с другими импортами:

```js
import GALAXY from './galaxy.js';
```

В `state` добавьте текущую звезду:

```js
const state = {
  // ...
  starIndex: 0,        // где мы сейчас
  // ...
};
```

Инициализация карты после создания сцены:

```js
GALAXY.init();
GALAXY.setPlayerStar(state.starIndex);

GALAXY.onJumpRequest((idx, star) => {
  // Пока просто переставляем игрока на выбранную звезду.
  // Позже тут будет гиперпрыжок с топливом, временем и т.п.
  state.starIndex = idx;
  GALAXY.setPlayerStar(idx);
  GALAXY.setOpen(false);

  // пример: телепорт камеры + сброс врагов, чтобы «начать» на новой звезде
  camera.position.set(0, 0, 0);
  camera.quaternion.set(0, 0, 0, 1);
  state.speed = 0;

  for (const e of enemies) scene.remove(e);
  enemies.length = 0;
  for (const l of lasers) scene.remove(l);
  lasers.length = 0;
  reseedDustAndMeteors();
});
```

Обработчик клавиш — рядом с существующим `keydown`:

```js
addEventListener('keydown', e => {
  // M — карта
  if (e.code === 'KeyM') {
    GALAXY.toggle();
    e.preventDefault();
    return;
  }

  if (GALAXY.isOpen()) {
    if (e.code === 'ArrowLeft')  GALAXY.moveSelection(-1,  0);
    if (e.code === 'ArrowRight') GALAXY.moveSelection( 1,  0);
    if (e.code === 'ArrowUp')    GALAXY.moveSelection( 0,  1);
    if (e.code === 'ArrowDown')  GALAXY.moveSelection( 0, -1);
    if (e.code === 'Enter')      GALAXY.confirmJump();
    e.preventDefault();
    return;
  }

  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
  if (e.code === 'Enter' && state.dead) resetGame();
});
```

И в `animate()` — **пауза**, когда карта открыта, плюс апдейт самой карты:

```js
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  GALAXY.update(dt);

  if (GALAXY.isOpen()) {
    // мир заморожен, рендерим только карту (HUD всё равно сверху)
    composer.render();
    requestAnimationFrame(animate);
    return;
  }

  // ... весь остальной код как был
}
```

---

## 3. Что получилось

- **`galaxy.js`** — самодостаточный модуль: данные, генерация, отрисовка, состояние.
- **Карта** рисуется на отдельном `<canvas>` поверх игры; Three.js-сцена не трогается.
- **`M`** — открыть/закрыть. Пока открыта — игровой цикл фактически на паузе.
- **Стрелки** — двигают выбор на ближайшую звезду в нужную сторону.
- **`ENTER`** — подтверждение. Вызывается колбэк, зарегистрированный через `onJumpRequest`, и вы сами решаете, что делать (телепорт, трата топлива, генерация новой системы).
- **Игрок на карте** — жёлтое пульсирующее кольцо с надписью `YOU` вокруг текущей звезды `state.starIndex`; индекс передаётся через `GALAXY.setPlayerStar()`.

---

## 4. Куда это расширять

- **Сектор как часть модели.** Если позже захочется «9 галактик × 256 секторов», храните не индекс звезды, а `{galaxy, sector, star}` — карта просто отрисует нужный срез.
- **Стоимость прыжка.** В колбэке проверяйте `state.fuel` и расстояние до звезды, отнимайте топливо, при нехватке — мигайте подсказкой.
- **Разные карты.** `GALAXY` умеет перегенерировать `stars` по новому сиду — вынесите `STAR_COUNT / SEED` в аргумент `init({seed, count})`, и получите локальную и галактическую карты.
- **Подсветка опасных звёзд** — уже есть `s.danger`, можно красить ядро или рисовать красный ореол, если `danger > 0.7`.