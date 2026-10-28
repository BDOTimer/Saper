/**
 * Standalone UI — ванильный (без React) интерфейс поверх того же игрового ядра.
 * Используется только для автономной сборки single-file index.html.
 */

import { GameState, LogEntry, RU, UNIT_SPECS, Unit, City } from '../lib/game/types';
import { cityAt, manhattan, unitAt } from '../lib/game/board';
import { defenseBonus, expectedDamage } from '../lib/game/combat';

export const FACTION_COLORS: Record<number, string> = {
  0: '#d33f49',
  1: '#3e8e52',
  [-1]: '#b8b2a7',
};

const TERRAIN_LABEL: [string, string, string, string][] = [
  ['plain', 'Равнина', '#7a9e5f', '1'],
  ['forest', 'Лес', '#4a7345', '2'],
  ['mountain', 'Горы', '#8a8178', '3'],
  ['water', 'Вода', '#3f7d86', '∞'],
];

export interface UIHandlers {
  endTurn(): void;
  cancel(): void;
  focusCapital(): void;
  newGame(seed?: number): void;
  save(): void;
  load(): void;
  toggleSound(): void;
  toggleMusic(): void;
  toggleHelp(): void;
  hire(cityId: number): void;
  minimapClick(x: number, y: number): void;
}

function $id<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
}

export class UI {
  private handlers: UIHandlers;
  private elTurnNum = $id<HTMLElement>('turn-num');
  private elTurnOwner = $id<HTMLElement>('turn-owner');
  private elScore = $id<HTMLElement>('score');
  private elEndBtn = $id<HTMLButtonElement>('btn-end');
  private elSeedLabel = $id<HTMLElement>('seed-label');
  private elSeedInput = $id<HTMLInputElement>('seed-input');
  private elLoadBtn = $id<HTMLButtonElement>('btn-load');
  private elUnitCard = $id<HTMLElement>('unit-card');
  private elCityCard = $id<HTMLElement>('city-card');
  private elLogList = $id<HTMLElement>('log-list');
  private elMini = $id<HTMLCanvasElement>('minimap');
  private elBanner = $id<HTMLElement>('banner');
  private elEnd = $id<HTMLElement>('end-screen');
  private elEndTitle = $id<HTMLElement>('end-title');
  private elEndText = $id<HTMLElement>('end-text');
  private elEndIcon = $id<HTMLElement>('end-icon');
  private elEndLoad = $id<HTMLButtonElement>('end-load');
  private elSound = $id<HTMLButtonElement>('btn-sound');
  private elMusic = $id<HTMLButtonElement>('btn-music');
  private elHelp = $id<HTMLElement>('help');

  private logBuf: LogEntry[] = [];
  private cityId: number | null = null;
  private lastState: GameState | null = null;
  private lastBusy = false;
  private lastHasSave = false;
  hpOverlay = $id<HTMLElement>('hp-overlay');

  constructor(handlers: UIHandlers) {
    this.handlers = handlers;

    $id('btn-cancel').onclick = () => handlers.cancel();
    $id('btn-cap').onclick = () => handlers.focusCapital();
    $id('btn-help').onclick = () => handlers.toggleHelp();
    $id('btn-new').onclick = () => handlers.newGame();
    $id('btn-save').onclick = () => handlers.save();
    this.elLoadBtn.onclick = () => handlers.load();
    $id('btn-end').onclick = () => handlers.endTurn();
    this.elSound.onclick = () => handlers.toggleSound();
    this.elMusic.onclick = () => handlers.toggleMusic();
    $id('seed-go').onclick = () => {
      const v = Number(this.elSeedInput.value.replace(/[^0-9]/g, '').slice(0, 7));
      handlers.newGame(v || undefined);
    };
    $id('help-close').onclick = () => handlers.toggleHelp();
    $id('end-new').onclick = () => handlers.newGame();
    this.elEndLoad.onclick = () => handlers.load();

    this.elCityCard.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.id === 'hire-btn' && this.cityId !== null) handlers.hire(this.cityId);
    });

    this.elMini.addEventListener('click', (e) => {
      const st = this.lastState;
      if (!st) return;
      const rect = this.elMini.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * st.mapW);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * st.mapH);
      handlers.minimapClick(x, y);
    });

    // Легенда
    const legend = $id<HTMLElement>('legend');
    legend.innerHTML = TERRAIN_LABEL.map(
      ([, name, color, cost]) =>
        `<span><span class="legend-swatch" style="background:${color}"></span>${name} (${cost})</span>`,
    ).join('');
  }

  setTop(s: GameState, busy: boolean, hasSave: boolean): void {
    this.lastState = s;
    this.lastBusy = busy;
    this.lastHasSave = hasSave;
    this.elTurnNum.textContent = String(s.turn);

    const playerTurn = s.current === 0 && s.winner === null;
    this.elTurnOwner.textContent = busy ? 'Ход противника…' : playerTurn ? 'Ваш ход' : '';
    this.elTurnOwner.style.background = playerTurn ? 'rgba(211,63,73,.25)' : 'rgba(62,142,82,.25)';
    this.elTurnOwner.style.color = playerTurn ? '#ff8a92' : '#7fd096';

    const my = s.cities.filter((c) => c.owner === 0).length;
    const enemy = s.cities.filter((c) => c.owner === 1).length;
    const neutral = s.cities.filter((c) => c.owner === -1).length;
    const units = s.units.filter((u) => u.owner === 0).length;
    const ready = s.units.filter((u) => u.owner === 0 && u.mpLeft > 0 && !u.attacked && s.winner === null).length;
    this.elScore.innerHTML =
      `Города: <b style="color:${FACTION_COLORS[0]}">${my}</b>` +
      ` / <b style="color:${FACTION_COLORS[-1]}">${neutral}</b>` +
      ` / <b style="color:${FACTION_COLORS[1]}">${enemy}</b>` +
      ` &nbsp;Отряды: <b>${units}</b> &nbsp;Готовы: <b style="color:${ready ? '#6ee7b7' : 'rgba(253,230,138,.5)'}">${ready}</b>`;

    this.elEndBtn.disabled = busy || s.winner !== null || s.current !== 0;
    this.elLoadBtn.disabled = !hasSave;
    this.elSeedLabel.textContent = `Текущий seed: ${s.seed}`;
  }

  showUnit(sel: Unit | null, st: GameState): void {
    if (!sel) {
      this.elUnitCard.classList.add('hidden');
      return;
    }
    this.elUnitCard.classList.remove('hidden');
    const col = FACTION_COLORS[sel.owner];
    const pct = Math.max(0, (sel.hp / sel.maxHp) * 100);
    const defB = Math.round(defenseBonus(st, sel) * 100);
    const here = cityAt(st, sel.x, sel.y);
    const inCityOwn = !!(here && here.owner === sel.owner);
    const enemy = sel.attacked
      ? null
      : st.units.find((e) => e.owner !== sel.owner && manhattan(e.x, e.y, sel.x, sel.y) === 1);
    const dmg = enemy ? expectedDamage(st, sel, enemy) : 0;

    this.elUnitCard.innerHTML =
      `<div class="u-head"><span style="color:${col};font-weight:700">${UNIT_SPECS[sel.type].name}${sel.kills >= 2 ? ' ⭐' : ''}</span>` +
      `<span class="dim">ID ${sel.id}</span></div>` +
      `<div class="hpbar-outer"><div class="hpbar-inner" style="width:${pct}%;background:${pct > 35 ? '#69b34c' : '#d33f49'}"></div></div>` +
      `<div class="stat-line">❤ ${sel.hp}/${sel.maxHp} · ⚔ ${sel.attack} · 🛡 ${sel.defense} <span style="color:#fcd34d">(+${defB}%)</span></div>` +
      `<div class="stat-line">👣 Ход: ${sel.mpLeft}/${sel.moveRange} · Побед: ${sel.kills}</div>` +
      (inCityOwn ? '<div class="note green">В городе: лечение +4 HP/ход</div>' : '') +
      (enemy
        ? `<div class="note red">Враг рядом! Урон ≈ ${dmg} (HP врага: ${enemy.hp}). Кликните по врагу.</div>`
        : '') +
      (sel.attacked
        ? '<div class="dim" style="font-size:11px;margin-top:4px">Отряд уже действовал в этом ходу.</div>'
        : '');
  }

  showCity(city: City | null, st: GameState): void {
    if (!city) {
      this.elCityCard.classList.add('hidden');
      this.cityId = null;
      return;
    }
    this.elCityCard.classList.remove('hidden');
    this.cityId = city.id;
    const occupied = !!unitAt(st, city.x, city.y);
    let hireBtn = '';
    if (city.owner === st.current && st.winner === null) {
      if (city.hireCooldown > 0) {
        hireBtn = `<button class="btn" disabled style="width:100%;margin-top:8px">Найм через ${city.hireCooldown} х.</button>`;
      } else if (occupied) {
        hireBtn = '<button class="btn" disabled style="width:100%;margin-top:8px">Клетка занята</button>';
      } else if (!this.lastBusy) {
        hireBtn = '<button id="hire-btn" class="btn primary" style="width:100%;margin-top:8px">Нанять отряд</button>';
      }
    }
    this.elCityCard.innerHTML =
      `<div class="u-head"><span style="color:#fcd34d;font-weight:700">🏰 ${city.name}</span>` +
      `<span style="color:${FACTION_COLORS[city.owner]};font-size:12px;font-weight:600">${city.owner === -1 ? 'Нейтральный' : RU.faction[city.owner]}</span></div>` +
      '<div class="stat-line">Бонус защиты в городе: +25% · Найм: 2 хода</div>' +
      hireBtn;
  }

  appendLog(e: LogEntry): void {
    this.logBuf.push(e);
    if (this.logBuf.length > 60) this.logBuf.shift();
    this.renderLog();
  }

  setLog(entries: LogEntry[]): void {
    this.logBuf = [...entries];
    this.renderLog();
  }

  private renderLog(): void {
    this.elLogList.innerHTML = this.logBuf
      .slice(-14)
      .map(
        (e) =>
          `<div class="log-${e.kind}"><span class="log-turn">[${e.turn}]</span>${e.text}</div>`,
      )
      .join('');
    this.elLogList.scrollTop = this.elLogList.scrollHeight;
  }

  drawMinimap(st: GameState): void {
    const cv = this.elMini;
    const cell = 10;
    cv.width = st.mapW * cell;
    cv.height = st.mapH * cell;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    for (let y = 0; y < st.mapH; y++) {
      for (let x = 0; x < st.mapW; x++) {
        const t = st.tiles[y][x];
        ctx.fillStyle = TERRAIN_LABEL.find(([k]) => k === t)?.[2] ?? '#777';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    for (const c of st.cities) {
      ctx.fillStyle = FACTION_COLORS[c.owner];
      ctx.beginPath();
      ctx.arc(c.x * cell + cell / 2, c.y * cell + cell / 2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (const u of st.units) {
      ctx.fillStyle = FACTION_COLORS[u.owner];
      ctx.fillRect(u.x * cell + 2, u.y * cell + 2, cell - 4, cell - 4);
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeRect(u.x * cell + 2, u.y * cell + 2, cell - 4, cell - 4);
    }
  }

  setBanner(text: string | null): void {
    if (!text) {
      this.elBanner.classList.add('hidden');
      return;
    }
    this.elBanner.textContent = text;
    this.elBanner.classList.remove('hidden');
  }

  showEnd(st: GameState, hasSave: boolean): void {
    if (st.winner === null) {
      this.elEnd.classList.add('hidden');
      return;
    }
    this.elEnd.classList.remove('hidden');
    const win = st.winner === 0;
    this.elEndIcon.textContent = win ? '👑' : '💀';
    this.elEndTitle.textContent = win ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ';
    this.elEndTitle.className = win ? 'win-title' : 'lose-title';
    this.elEndText.textContent = win
      ? `Фракция «${RU.faction[0]}» контролирует все ${st.cities.length} городов за ${st.turn} ходов!`
      : `«${RU.faction[1]}» захватил все города. Попробуйте ещё раз!`;
    this.elEndLoad.disabled = !hasSave;
  }

  setIcons(sound: boolean, music: boolean): void {
    this.elSound.textContent = sound ? '🔊' : '🔇';
    this.elMusic.textContent = music ? '🎵' : '🚫';
  }

  toggleHelp(): void {
    this.elHelp.classList.toggle('hidden');
  }
}
