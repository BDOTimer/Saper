// render/battle-view.js
//
// ТЗ:
//  -   стурктура этого файла схожа со структурой "render/army-view.js"
//  -   окно визуализации битвы между двумя армиями на клетке.
//  -   битва(окно) запускается когда одна армия встречает другую армию.
//  -   включается фаза 'battle'
//  -   армии для разных игроков.
//  -   две армии выстраиваются в одну горизонтальную линию.
//  -   армия(юниты) игроке которого сейчас ход от середины окна влево.
//  -   армия(юниты) соперника от середины окна вправо.
//  -   каждые 2 секунды происходит бой между юнитами в середине.
//  -   побежденный юнит исчезает с анимацией.
//  -   вероятность победы расчитывается как рандом от [дамага] и [защиты] юнита
//  -   после того как юнитов у проигравшего игрока не останется сигнал "конец битвы"
//  -   появляется кнопка закрыть окно.
//  -   class BattleView создаётся 1 раз и используется повторно
//  -
//
// Визуал: тёмная модальная панель 72vw×62vh по центру экрана.
// Логика раундов живёт в core/g-battle.js (класс Battle): этот вид
// только тикает каждые ROUND_MS мс и рисует результат раунда.

import * as THREE from 'three';
import { skinForPlayer, disposeTree } from './r-units-view.js';
import { Battle, ROUND_MS, FRONT_GAP } from '../core/g-battle.js';

/** Шаг сетки между юнитами стороны (мировые единицы мини-сцены) */
const SPACING = 0.7;

/** Длительность выпада юнитов к центру, сек */
const LUNG_SEC = 0.28;

/** Длительность анимации смерти проигравшего юнита, сек */
const DEATH_SEC = 0.6;

const STYLE_ID = 'battle-view-styles';

const CSS = `

.bv-backdrop {
  position: fixed; inset: 0;
  background: rgba(8, 10, 16, .72);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1100;
  opacity: 0; pointer-events: none;
  transition: opacity .18s ease;
}
.bv-backdrop.open { opacity: 1; pointer-events: auto; }

.bv-panel {
  width: 72vw; height: 62vh;
  min-width: 520px; min-height: 360px;
  background:
    linear-gradient(160deg, rgba(27,20,32,.55) 0%, rgba(20,25,37,.72) 100%),
    url("./res/img/bg1.jpg") center / cover no-repeat;
  color: #e8ecf3;
  border: 1px solid rgba(200,120,90,.35);
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.02) inset;
  display: flex; flex-direction: column;
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  transform: translateY(6px) scale(.98);
  transition: transform .2s ease;
  overflow: hidden;
}
.bv-backdrop.open .bv-panel { transform: translateY(0) scale(1); }

.bv-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(200,120,90,.25);
  background: rgba(255,255,255,.02);
}
.bv-swatch {
  width: 14px; height: 14px; border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(0,0,0,.35) inset, 0 0 12px currentColor;
  flex: 0 0 auto;
}
.bv-title  { font-size: 16px; font-weight: 700; letter-spacing: .2px; }
.bv-vs     { color: #f0a060; font-weight: 700; padding: 0 2px; }
.bv-close {
  margin-left: auto;
  height: 32px; padding: 0 14px; border-radius: 8px;
  border: 1px solid rgba(120,150,200,.3);
  background: rgba(255,255,255,.03);
  color: #cfd7e3; cursor: pointer; font-size: 13px; font-weight: 600;
  display: grid; place-items: center;
  transition: background .15s, color .15s, transform .1s;
}
.bv-close:hover  { background: rgba(220,80,80,.15); color: #ff9a9a; }
.bv-close:active { transform: scale(.95); }
.bv-close.hidden { display: none; }

.bv-stage {
  position: relative;
  flex: 1 1 auto; min-height: 0;
  background:
    linear-gradient(rgba(13,18,24,.35), rgba(13,18,24,.55)),
    url("./res/img/bg2.jpg") center / cover no-repeat;
}
.bv-stage-canvas { display: block; width: 100%; height: 100%; }

/* Баннер «Победа …» — поверх сцены, появляется в конце боя */
.bv-banner {
  position: absolute; left: 50%; top: 42%;
  transform: translate(-50%, -50%) scale(.9);
  padding: 14px 28px;
  border-radius: 12px;
  background: rgba(12,14,20,.85);
  border: 1px solid rgba(255,255,255,.18);
  box-shadow: 0 12px 48px rgba(0,0,0,.55);
  font-size: 20px; font-weight: 700; letter-spacing: .4px;
  opacity: 0; pointer-events: none;
  transition: opacity .35s ease, transform .35s ease;
  white-space: nowrap;
}
.bv-banner.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }

.bv-footer {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 18px;
  border-top: 1px solid rgba(200,120,90,.2);
  background: rgba(255,255,255,.02);
  font-size: 13px; color: #aab5c6;
  min-height: 40px;
}
.bv-footer .bv-death { color: #ff8a8a; }
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* =========================================================
   BattleView — окно визуализации битвы двух армий.
   ========================================================= */
export class BattleView {
  /**
   * Создаётся ОДИН раз (например, в Game) и используется повторно.
   *
   * @param {Object} [opts]
   * @param {Function} [opts.getPlayers]   — () => Players (цвет/имя владельца)
   * @param {Function} [opts.getTurnIndex] — () => индекс игрока текущего хода
   * @param {HTMLElement} [opts.container] — куда вставить окно (по умолчанию body)
   */
  constructor(opts = {}) {
    this.getPlayers   = opts.getPlayers   ?? (() => null);
    this.getTurnIndex = opts.getTurnIndex ?? (() => -1);

    this._open     = false;
    this._finished = false;   // окно можно закрыть только после конца боя
    this._battle   = null;    // core/g-battle.js Battle
    this._onEnd    = null;    // сигнал «конец битвы» наружу
    this._raf      = null;
    this._roundAt  = 0;       // аккумулятор мс до следующего раунда
    this._fx       = null;    // текущая анимация раунда

    ensureStyles();
    this._buildPanel(opts.container ?? document.body);
  }

  /* =========================================================
     DOM окна
     ========================================================= */
  _buildPanel(container) {
    const back = document.createElement('div');
    back.className = 'bv-backdrop';
    this._backdrop = back;

    const panel = document.createElement('div');
    panel.className = 'bv-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    back.appendChild(panel);

    // header
    const head = document.createElement('div');
    head.className = 'bv-header';

    const swA = document.createElement('span');
    swA.className = 'bv-swatch';
    this._swA = swA;

    const title = document.createElement('div');
    title.className = 'bv-title';
    title.textContent = 'Бой';
    this._titleEl = title;

    const vs = document.createElement('span');
    vs.className = 'bv-vs';
    vs.textContent = '⚔ VS ⚔';

    const swB = document.createElement('span');
    swB.className = 'bv-swatch';
    this._swB = swB;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'bv-close hidden';   // появится только после конца боя
    close.title = 'Закрыть (Esc)';
    close.textContent = 'ЗАКРЫТЬ';
    close.addEventListener('click', () => this.close());
    this._closeBtn = close;

    head.appendChild(swA);
    head.appendChild(title);
    head.appendChild(vs);
    head.appendChild(swB);
    head.appendChild(close);
    panel.appendChild(head);

    // сцена с юнитами
    const stage = document.createElement('div');
    stage.className = 'bv-stage';
    panel.appendChild(stage);

    const canvas = document.createElement('canvas');
    canvas.className = 'bv-stage-canvas';
    this._canvas = canvas;
    stage.appendChild(canvas);

    // баннер результата
    const banner = document.createElement('div');
    banner.className = 'bv-banner';
    this._bannerEl = banner;
    stage.appendChild(banner);

    // строка статуса
    const footer = document.createElement('div');
    footer.className = 'bv-footer';
    this._statusEl = footer;
    panel.appendChild(footer);

    // закрытие по клику на backdrop: до конца боя close() сам заблокирует
    back.addEventListener('click', (e) => {
      if (e.target === back) this.close();
    });
    this._onEsc = (e) => {
      if (e.key === 'Escape' && this._open) this.close();
    };
    document.addEventListener('keydown', this._onEsc);

    container.appendChild(back);
    this._root = back;

    // приватный рендерер окна боя (создаётся один раз, переиспользуется)
    this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setClearColor(0x000000, 0);
  }

  /* =========================================================
     Запуск боя
     ========================================================= */
  /**
   * @param {Army}        armyA — армия игрока текущего хода
   * @param {Army}        armyB — армия соперника
   * @param {Object}  [opts]
   * @param {Function} [opts.onEnd] — сигнал конца битвы: (winner, loser) => void
   */
  runBattle(armyA, armyB, opts = {}) {
    if (!armyA || !armyB || !armyA.alive || !armyB.alive) return;

    this.close(true);   // на случай повторного запуска (переиспользование)

    // ТЗ: армия игрока текущего хода — слева, соперник — справа.
    const turnIdx = this.getTurnIndex();
    const left  = (armyA.idOwner === turnIdx || armyB.idOwner !== turnIdx)
      ? armyA : armyB;
    const right = left === armyA ? armyB : armyA;

    this._left     = left;
    this._right    = right;
    this._battle   = new Battle(left, right);
    this._onEnd    = opts.onEnd ?? null;
    this._finished = false;

    this._buildScene();
    this._refreshHeader();
    this._refreshStatus('Бой начался…');

    this._open    = true;
    this._roundAt = 0;                       // первый раунд — через ROUND_MS
    this._root.classList.add('open');
    this._bannerEl.classList.remove('show');
    this._closeBtn.classList.add('hidden');

    this._startLoop();
  }

  /* =========================================================
     Закрытие окна — только после конца боя
     ========================================================= */
  /** @param {boolean} [force] — аварийное закрытие (destroy), без ограничений */
  close(force = false) {
    if (this._open && !this._finished && !force) return;

    this._open = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }

    if (this._scene) {
      // материалы создаются на каждый skin.build() — их можно смело диспоузить
      this._scene.traverse((o) => {
        if (o.isMesh) {
          o.geometry?.dispose?.();
          if (Array.isArray(o.material)) o.material.forEach(m => m?.dispose?.());
          else o.material?.dispose?.();
        }
      });
      this._scene.clear();
      this._scene = null;
    }

    this._nodesL = [];
    this._nodesR = [];
    this._fx     = null;
    this._battle = null;
    this._left   = null;
    this._right  = null;

    this._root.classList.remove('open');
  }

  destroy() {
    this.close(true);
    document.removeEventListener('keydown', this._onEsc);
    this._renderer?.dispose?.();
    this._root?.remove?.();
  }

  /* =========================================================
     Мини-сцена: две армии в одну горизонтальную линию
     ========================================================= */
  _buildScene() {
    const scene = new THREE.Scene();
    this._scene = scene;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(3, 5, 4);
    scene.add(dir);

    // земля (тёмная площадка под армиями)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a2130, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    this._nodesL = this._buildSide(this._left, -1);
    this._nodesR = this._buildSide(this._right, +1);

    this._cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this._cam.position.set(0, 2.8, 5.2);
    this._cam.lookAt(0, 0.45, 0);
  }

  /** Построить ряд юнитов одной стороны. dir: -1 — влево, +1 — вправо */
  _buildSide(army, dir) {
    const players = this.getPlayers();
    const player  = players?.get?.(army.idOwner) ?? null;
    const colorHex = player?.color ?? 0x9aa4ad;
    const skin = skinForPlayer(army.idOwner);

    const units = army.units.filter(u => u.alive);
    const nodes = [];

    units.forEach((u, i) => {
      const mesh = skin.build(u.typeKey, colorHex);
      const holder = new THREE.Group();
      holder.add(mesh);
      holder.scale.setScalar(0.8);
      // i=0 — фронтовый (ближний к центру) юнит: он первым идёт в бой
      holder.position.x = dir * (FRONT_GAP + i * SPACING);
      holder.userData = { unit: u, side: dir, index: i };
      this._scene.add(holder);
      nodes.push(holder);
    });

    return nodes;
  }

  /** подгон фрустума мини-камеры под ширину боя и размер канваса */
  _fitCamera() {
    const w = this._canvas.clientWidth, h = this._canvas.clientHeight;
    if (!w || !h) return;
    const size = this._renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) this._renderer.setSize(w, h, false);

    const aspect = w / h;
    const halfH  = 1.35;
    const maxIdx = Math.max(this._nodesL.length, this._nodesR.length) - 1;
    const halfRow = FRONT_GAP + Math.max(1, maxIdx + 1) * SPACING;
    const halfW  = Math.max(halfRow, halfH * aspect);

    this._cam.left = -halfW; this._cam.right = halfW;
    this._cam.top  =  halfH; this._cam.bottom = -halfH;
    this._cam.updateProjectionMatrix();
  }

  _startLoop() {
    const loop = (t) => {
      if (!this._open) return;

      const now = typeof t === 'number' ? t : performance.now();
      if (this._lastT == null) this._lastT = now;
      const dt = Math.min(100, now - this._lastT);   // мс, защита от таба
      this._lastT = now;

      if (!this._finished) {
        this._tickRound(dt);
      }
      this._updateFx(dt);   // анимация последнего удара должна доиграться

      this._fitCamera();
      this._renderer.render(this._scene, this._cam);
      this._raf = requestAnimationFrame(loop);
    };
    this._lastT = null;
    this._raf = requestAnimationFrame(loop);
  }

  /* =========================================================
     Раунды боя: каждые ROUND_MS мс — шаг логики + анимация
     ========================================================= */
  _tickRound(dt) {
    this._roundAt += dt;
    if (this._roundAt < ROUND_MS) return;
    this._roundAt = 0;

    if (this._fx) this._endFx();     // предыдущая анимация не успела — сминаем

    const res = this._battle.step();
    if (!res) return;

    const dSec = dt / 1000;
    this._fx = {
      t: 0,
      nodesFighter: [],   // кого анимируем выпадом
      loser: null,        // узел гибнущего юнита
    };

    const nodeOf = (side, unit) =>
      (side === -1 ? this._nodesL : this._nodesR).find(n => n.userData.unit === unit) ?? null;

    const nA = nodeOf(-1, res.attackerUnit);
    const nB = nodeOf(+1, res.defenderUnit);
    if (nA) this._fx.nodesFighter.push({ n: nA, dir: -1 });
    if (nB) this._fx.nodesFighter.push({ n: nB, dir: +1 });

    const loserNode = nodeOf(res.loserArmy === this._left ? -1 : +1, res.loserUnit);
    if (loserNode) this._fx.loser = loserNode;

    if (res.finished) {
      this._onBattleEnd(res);
      return;
    }

    this._refreshStatus(this._roundText(res));
  }

  _roundText(res) {
    const u = res.loserUnit;
    const players = this.getPlayers();
    const owner = players?.get?.(u.idOwner);
    const name = owner?.name ?? `Игрок ${u.idOwner}`;
    return `Раунд ${res.round} · <span class="bv-death">💀 ${escapeHtml(
      u.name ?? u.typeKey ?? '—')} (${escapeHtml(name)}) пал</span>` +
      ` · счёт ${this._left.count} : ${this._right.count}`;
  }

  /* =========================================================
     Анимации раунда: выпад к центру → удар → гибель проигравшего
     ========================================================= */
  _updateFx(dt) {
    const fx = this._fx;
    if (!fx) return;

    fx.t += dt / 1000;

    // выпад к центру: смещение к центру и обратно
    for (const { n, dir } of fx.nodesFighter) {
      const base = dir * FRONT_GAP;
      const lunge = Math.sin(Math.min(1, fx.t / LUNG_SEC) * Math.PI) * 0.35;
      n.position.x = base - dir * lunge;
    }

    // гибель проигравшего: после удара исчезает (масштаб+провал+fade)
    if (fx.loser && fx.t >= LUNG_SEC) {
      const sideDir = fx.loser.userData.side ?? 0;
      const baseX = sideDir * FRONT_GAP;
      const k = Math.min(1, (fx.t - LUNG_SEC) / DEATH_SEC);
      fx.loser.scale.setScalar(Math.max(0.001, 0.8 * (1 - k)));
      fx.loser.position.y = -0.5 * k;

      if (k >= 1) this._endFx();
    }
  }

  _endFx() {
    const fx = this._fx;
    this._fx = null;
    if (!fx) return;

    // вернуть выпады в исходные позиции
    for (const { n, dir } of fx.nodesFighter) {
      n.position.x = dir * FRONT_GAP;
      n.position.y = 0;
      n.scale.setScalar(0.8);
    }

    // убрать мёртвого юнита из сцены и списков стороны
    if (fx.loser) {
      const side = fx.loser.userData.side === -1 ? this._nodesL : this._nodesR;
      const i = side.indexOf(fx.loser);
      if (i >= 0) side.splice(i, 1);
      disposeTree(fx.loser);
      this._scene.remove(fx.loser);
    }
  }

  /* =========================================================
     Конец битвы: баннер + кнопка ЗАКРЫТЬ + сигнал наружу
     ========================================================= */
  _onBattleEnd(res) {
    this._finished = true;

    const winner = res.winnerArmy, loser = res.loserArmy;
    const players = this.getPlayers();
    const wp = players?.get?.(winner.idOwner);
    const name = wp?.name ?? `Игрок ${winner.idOwner}`;
    const color = typeof wp?.color === 'number'
      ? '#' + (wp.color >>> 0).toString(16).padStart(6, '0')
      : (wp?.color ?? '#9aa4ad');

    this._refreshStatus(`Конец битвы · победа <b style="color:${color}">${escapeHtml(name)}</b>`);
    this._bannerEl.innerHTML = `ПОБЕДА: <span style="color:${color}">${escapeHtml(name)}</span>`;
    this._bannerEl.classList.add('show');
    this._closeBtn.classList.remove('hidden');

    // сигнал «конец битвы» — наружу (Game снимет армию проигравшего с карты)
    this._onEnd?.(winner, loser);
  }

  /* =========================================================
     Заголовок и статус
     ========================================================= */
  _refreshHeader() {
    const players = this.getPlayers();
    const pA = players?.get?.(this._left.idOwner);
    const pB = players?.get?.(this._right.idOwner);

    const hex = (p) => {
      const c = p?.color ?? 0x9aa4ad;
      return typeof c === 'number'
        ? '#' + (c >>> 0).toString(16).padStart(6, '0')
        : (c ?? '#9aa4ad');
    };

    this._swA.style.background = hex(pA);
    this._swA.style.color      = hex(pA);
    this._swB.style.background = hex(pB);
    this._swB.style.color      = hex(pB);

    this._titleEl.innerHTML =
      `⚔ ${escapeHtml(pA?.name ?? 'Армия A')} (${this._left.count})` +
      ` — ${escapeHtml(pB?.name ?? 'Армия B')} (${this._right.count})`;
  }

  _refreshStatus(html) {
    this._statusEl.innerHTML = html;
  }
}

/* =========================================================
   Вспомогательное — экранирование текста в innerHTML
   ========================================================= */
function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
