'use client';

/**
 * WarlordsGame — корневой компонент: связывает Game (логика),
 * Renderer (Three.js), AudioManager (звук) и AI в единый игровой цикл.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Game, GameEvent } from '@/lib/game/game';
import { Renderer } from '@/lib/game/renderer';
import { AudioManager } from '@/lib/game/audio';
import { AI } from '@/lib/game/ai';
import {
  GameState, Unit, City, LogEntry, RU, UNIT_SPECS,
  TERRAIN_DEFENSE_BONUS, OwnerId,
} from '@/lib/game/types';
import { cityAt, unitAt, manhattan } from '@/lib/game/board';
import { defenseBonus, canAttack, expectedDamage } from '@/lib/game/combat';

const FACTION_COLORS: Record<number, string> = {
  0: '#d33f49',
  1: '#3e8e52',
  [-1]: '#b8b2a7',
};

const TERRAIN_LABEL: Record<string, { name: string; color: string; def: string; cost: string }> = {
  plain: { name: 'Равнина', color: '#7a9e5f', def: '0%', cost: '1' },
  forest: { name: 'Лес', color: '#4a7345', def: '+25%', cost: '2' },
  mountain: { name: 'Горы', color: '#8a8178', def: '+50%', cost: '3' },
  water: { name: 'Вода', color: '#3f7d86', def: '—', cost: '∞' },
};

export default function WarlordsGame() {
  const mountRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const gameRef = useRef<Game | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const aiRef = useRef<AI | null>(null);
  const busyRef = useRef(false);
  const eventHandlerRef = useRef<(ev: GameEvent) => void>(() => {});

  const [uiState, setUiState] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<Unit | null>(null);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [logTail, setLogTail] = useState<LogEntry[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [seedInput, setSeedInput] = useState('');
  const [hasSave, setHasSave] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // ---------- Инициализация ----------
  useEffect(() => {
    if (!mountRef.current) return;

    const audio = new AudioManager();
    audioRef.current = audio;

    const renderer = new Renderer(mountRef.current);
    rendererRef.current = renderer;
    renderer.camera.position.set(0, 12, 12);
    (renderer as unknown as { updateCameraPosition(): void }).updateCameraPosition?.();

    const game = new Game({
      onStateChange: (s) => {
        setUiState({ ...s, units: [...s.units], cities: s.cities.map((c) => ({ ...c })) });
        renderer.sync(s);
        const sel = s.units.find((u) => u.id === game.selectedUnitId) ?? null;
        setSelected(sel ? { ...sel } : null);
        if (sel && game.selectedReach && !sel.attacked) {
          const attackable = s.units.filter(
            (e) => e.owner !== s.current && manhattan(e.x, e.y, sel.x, sel.y) === 1,
          );
          renderer.showReach(s, game.selectedReach, sel.id, attackable);
        } else {
          renderer.showReach(s, null, null, []);
        }
        renderer.setSelected(sel);
      },
      onLog: (entry) => {
        setLogTail((prev) => [...prev.slice(-40), entry]);
      },
      onEvent: (ev) => eventHandlerRef.current(ev),
    });
    gameRef.current = game;

    const ai = new AI(game, 424242);
    aiRef.current = ai;

    renderer.onClickTile = (x, y) => {
      audio.unlock();
      const st = game.state;
      if (!st || busyRef.current) return;
      const city = cityAt(st, x, y);
      const unit = unitAt(st, x, y);

      if (unit && unit.owner === st.current) {
        game.selectUnitAt(x, y);
        setSelectedCity(null);
        audio.play('select');
        return;
      }
      if (unit && unit.owner !== st.current && game.selectedUnit) {
        game.clickTile(x, y);
        return;
      }
      if (game.selectedUnit) {
        game.clickTile(x, y);
        return;
      }
      if (city) {
        setSelectedCity({ ...city });
        game.clearSelection();
      } else {
        setSelectedCity(null);
        game.clearSelection();
      }
    };
    renderer.onStepSound = () => audio.play('step');

    // Стартовая партия
    game.newGame();
    setHasSave(game.hasSave());

    // Dev-экспорт для отладки и тестирования (не влияет на игру)
    (window as unknown as { __warlords?: Game }).__warlords = game;

    // Клавиатура: WASD/стрелки — камера, Esc — снять выделение, Space — конец хода
    const onKey = (e: KeyboardEvent) => {
      const step = 60;
      if (e.key === 'ArrowUp' || e.key === 'w') renderer.panBy(0, -step);
      else if (e.key === 'ArrowDown' || e.key === 's') renderer.panBy(0, step);
      else if (e.key === 'ArrowLeft' || e.key === 'a') renderer.panBy(-step, 0);
      else if (e.key === 'ArrowRight' || e.key === 'd') renderer.panBy(step, 0);
      else if (e.key === 'Escape') { game.clearSelection(); setSelectedCity(null); }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      ai.dispose();
      renderer.dispose();
      audio.dispose();
    };
  }, []);

  // фокус камеры на столице фракции при начале хода ИИ
  const centerOfFaction = useCallback((f: OwnerId): [number, number] => {
    const g = gameRef.current;
    if (!g) return [7, 7];
    const cap = g.state.cities.find((c) => c.owner === f);
    return cap ? [cap.x, cap.y] : [7, 7];
  }, []);

  // ---------- Обработка игровых событий ----------
  const handleGameEvent = useCallback((ev: GameEvent) => {
    const r = rendererRef.current;
    const a = audioRef.current;
    if (!r || !a) return;
    switch (ev.type) {
      case 'move':
        r.playMovePath(ev.unitId, ev.path);
        break;
      case 'attack':
        r.playHit(ev.at.x, ev.at.y);
        a.play(ev.result.hit ? 'hit' : 'miss');
        if (ev.result.defenderDied || ev.result.attackerDied) a.play('death');
        break;
      case 'capture':
        r.playCapture(ev.city.x, ev.city.y);
        a.play('capture');
        setBanner(ev.by === 0 ? `⚔ ${ev.city.name} захвачен!` : `✖ ${ev.city.name} потерян!`);
        window.setTimeout(() => setBanner(null), 2200);
        break;
      case 'hire':
        a.play('hire');
        break;
      case 'death':
        r.playDeath(ev.at.x, ev.at.y);
        break;
      case 'turnStart':
        a.play('turn');
        if (ev.player === 1) {
          r.focusOn(...centerOfFaction(ev.player === 1 ? 1 : 0));
        }
        break;
      case 'gameOver':
        a.play(ev.winner === 0 ? 'victory' : 'defeat');
        break;
    }
  }, []);

  // Связываем ref с актуальным обработчиком (в эффекте, не во время рендера)
  useEffect(() => {
    eventHandlerRef.current = handleGameEvent;
  }, [handleGameEvent]);

  // ---------- Мини-карта ----------
  useEffect(() => {
    if (!uiState || !miniRef.current) return;
    const cv = miniRef.current;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const cell = 10;
    cv.width = uiState.mapW * cell;
    cv.height = uiState.mapH * cell;
    for (let y = 0; y < uiState.mapH; y++) {
      for (let x = 0; x < uiState.mapW; x++) {
        ctx.fillStyle = TERRAIN_LABEL[uiState.tiles[y][x]].color;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    for (const c of uiState.cities) {
      ctx.fillStyle = FACTION_COLORS[c.owner];
      ctx.beginPath();
      ctx.arc(c.x * cell + cell / 2, c.y * cell + cell / 2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (const u of uiState.units) {
      ctx.fillStyle = FACTION_COLORS[u.owner];
      ctx.fillRect(u.x * cell + 2, u.y * cell + 2, cell - 4, cell - 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeRect(u.x * cell + 2, u.y * cell + 2, cell - 4, cell - 4);
    }
  }, [uiState]);

  // ---------- HP-бары над юнитами (обновление только при изменениях) ----------
  useEffect(() => {
    let raf = 0;
    const overlay = overlayRef.current;
    const r = rendererRef.current;
    const g = gameRef.current;
    if (!overlay || !r || !g) return;

    let lastHtml = '';
    let frame = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const st = g.state;
      if (!st) return;
      frame++;
      // Пересчёт HTML максимум 20 раз/сек и только если камера/состояние изменились
      if (frame % 3 !== 0) return;
      const items: string[] = [];
      for (const u of st.units) {
        const p = r.projectTile(u.x, u.y, 1.15);
        if (!p.visible) continue;
        const col = FACTION_COLORS[u.owner];
        const w = 34;
        const hpf = Math.max(0, u.hp / u.maxHp);
        items.push(
          `<div style="position:absolute;left:${p.left - w / 2}px;top:${p.top}px;width:${w}px;pointer-events:none;">` +
            `<div style="height:4px;background:rgba(0,0,0,.65);border-radius:2px;overflow:hidden;">` +
              `<div style="height:100%;width:${hpf * 100}%;background:${hpf > 0.5 ? '#69b34c' : hpf > 0.25 ? '#e0a800' : '#d33f49'};"></div>` +
            `</div>` +
            `<div style="text-align:center;font-size:9px;color:${col};text-shadow:0 1px 2px #000;font-weight:700;">${u.hp}</div>` +
          `</div>`,
        );
      }
      const html = items.join('');
      if (html !== lastHtml) {
        overlay.innerHTML = html;
        lastHtml = html;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [uiState !== null]);

  // ---------- Действия ----------

  const endTurn = useCallback(() => {
    const g = gameRef.current;
    const ai = aiRef.current;
    const a = audioRef.current;
    if (!g || !ai || busyRef.current || g.state.winner !== null) return;
    if (g.state.current !== 0) return;

    g.clearSelection();
    setSelectedCity(null);
    g.endTurn(); // переход к ИИ
    busyRef.current = true;
    setAiBusy(true);

    ai.tryHire();
    ai.playTurn(() => {
      // ИИ закончил — обратно игроку
      const gg = gameRef.current;
      if (gg && gg.state.winner === null) {
        gg.endTurn();
        gg.save();
        setHasSave(true);
      }
      busyRef.current = false;
      setAiBusy(false);
    });
  }, []);

  const newGame = useCallback((seed?: number) => {
    const g = gameRef.current;
    const ai = aiRef.current;
    if (!g || !ai) return;
    ai.stop();
    busyRef.current = false;
    setAiBusy(false);
    setLogTail([]);
    setSelectedCity(null);
    g.newGame(seed);
  }, []);

  const doSave = () => {
    gameRef.current?.save();
    setHasSave(true);
  };

  const doLoad = () => {
    const g = gameRef.current;
    const ai = aiRef.current;
    if (!g || !ai) return;
    ai.stop();
    busyRef.current = false;
    setAiBusy(false);
    if (g.load()) {
      setLogTail([...g.state.log.slice(-12)]);
      setSelectedCity(null);
      setHasSave(true);
      if (g.state.current === 1 && g.state.winner === null) {
        busyRef.current = true;
        setAiBusy(true);
        ai.tryHire();
        ai.playTurn(() => {
          if (g.state.winner === null) g.endTurn();
          busyRef.current = false;
          setAiBusy(false);
        });
      }
    }
  };

  const toggleSound = () => {
    const a = audioRef.current;
    if (!a) return;
    a.unlock();
    a.setEnabled(!soundOn);
    setSoundOn(!soundOn);
  };

  const toggleMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    a.unlock();
    a.setMusic(!musicOn);
    setMusicOn(!musicOn);
  };

  const focusCapital = () => {
    const g = gameRef.current;
    const r = rendererRef.current;
    if (!g || !r) return;
    const cap = g.state.cities.find((c) => c.owner === g.state.current);
    if (cap) r.focusOn(cap.x, cap.y);
  };

  const clickMini = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    const r = rendererRef.current;
    if (!g || !r) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / rect.width * g.state.mapW);
    const y = Math.floor((e.clientY - rect.top) / rect.height * g.state.mapH);
    r.focusOn(x, y);
  };

  // ---------- Производные значения ----------
  const st = uiState;
  const isPlayerTurn = st?.current === 0 && st?.winner === null;
  const myCities = st?.cities.filter((c) => c.owner === 0) ?? [];
  const enemyCities = st?.cities.filter((c) => c.owner === 1) ?? [];
  const neutralCities = st?.cities.filter((c) => c.owner === -1) ?? [];
  const myUnits = st?.units.filter((u) => u.owner === 0) ?? [];
  const idleUnits = st?.units.filter(
    (u) => u.owner === 0 && u.mpLeft > 0 && !u.attacked && st.winner === null,
  ) ?? [];

  const canAttackNow = selected && st && !selected.attacked &&
    st.units.some((e) => e.owner !== selected.owner && manhattan(e.x, e.y, selected.x, selected.y) === 1);

  const estDamage = (u: Unit, target: Unit) => expectedDamage(st!, u, target);

  const nextTarget = selected && st
    ? st.units.find((e) => e.owner !== selected.owner && manhattan(e.x, e.y, selected.x, selected.y) === 1) ?? null
    : null;

  const cityHere = selected ? cityAt(st!, selected.x, selected.y) : null;
  const defB = selected ? Math.round(defenseBonus(st!, selected) * 100) : 0;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#191410] text-amber-50 select-none">
      {/* 3D-сцена */}
      <div ref={mountRef} className="absolute inset-0" />
      {/* HP-бары */}
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />

      {/* Баннер событий */}
      {banner && (
        <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-lg border border-amber-500/40 bg-black/80 px-6 py-2 text-lg font-bold text-amber-300 shadow-xl backdrop-blur">
          {banner}
        </div>
      )}

      {/* ---------- Верхняя панель ---------- */}
      <header className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-2 border-b border-amber-900/50 bg-gradient-to-b from-black/85 to-black/60 px-3 py-2 backdrop-blur-sm">
        <div className="mr-2 flex items-baseline gap-2">
          <span className="text-lg font-black tracking-wide text-amber-400">⚔ WARLORDS II</span>
          <span className="text-xs text-amber-200/60">MVP</span>
        </div>

        <div className="flex items-center gap-1.5 rounded-md bg-black/50 px-2.5 py-1 text-sm">
          <span className="text-amber-200/70">Ход</span>
          <span className="font-bold text-amber-100">{st?.turn ?? '-'}</span>
        </div>

        <div
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold"
          style={{
            background: isPlayerTurn ? 'rgba(211,63,73,.25)' : 'rgba(62,142,82,.25)',
            color: isPlayerTurn ? '#ff8a92' : '#7fd096',
          }}
        >
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: FACTION_COLORS[st?.current ?? 0] }} />
          {aiBusy ? 'Ход противника…' : isPlayerTurn ? 'Ваш ход' : ''}
        </div>

        {st?.winner === null && (
          <div className="hidden items-center gap-1.5 text-xs text-amber-200/70 sm:flex">
            <span>Города:</span>
            <span style={{ color: FACTION_COLORS[0] }}>{myCities.length}</span>
            <span className="text-amber-200/40">/</span>
            <span style={{ color: FACTION_COLORS[-1] }}>{neutralCities.length}</span>
            <span className="text-amber-200/40">/</span>
            <span style={{ color: FACTION_COLORS[1] }}>{enemyCities.length}</span>
            <span className="ml-2">Отряды: <b className="text-amber-100">{myUnits.length}</b></span>
            <span className="ml-2">Готовы: <b className={idleUnits.length ? 'text-emerald-300' : 'text-amber-200/50'}>{idleUnits.length}</b></span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            disabled={!isPlayerTurn || !!st?.winner}
            onClick={endTurn}
            className="bg-amber-600 font-bold text-black hover:bg-amber-500 disabled:opacity-40"
          >
            Завершить ход
          </Button>
          <Button size="sm" variant="outline" onClick={() => { gameRef.current?.clearSelection(); setSelectedCity(null); }} className="border-amber-800 bg-black/40 text-amber-100 hover:bg-black/60">
            Отменить
          </Button>
          <Button size="sm" variant="outline" onClick={focusCapital} className="border-amber-800 bg-black/40 text-amber-100 hover:bg-black/60" title="К столице">
            🏰
          </Button>
          <Button size="sm" variant="outline" onClick={toggleSound} className="border-amber-800 bg-black/40 text-amber-100 hover:bg-black/60" title="Звук">
            {soundOn ? '🔊' : '🔇'}
          </Button>
          <Button size="sm" variant="outline" onClick={toggleMusic} className="border-amber-800 bg-black/40 text-amber-100 hover:bg-black/60" title="Музыка">
            {musicOn ? '🎵' : '🚫'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowHelp((v) => !v)} className="border-amber-800 bg-black/40 text-amber-100 hover:bg-black/60">
            ?
          </Button>
        </div>
      </header>

      {/* ---------- Меню (новая игра / сейв) ---------- */}
      <div className="absolute left-3 top-16 z-20 w-40 space-y-1.5 rounded-lg border border-amber-900/50 bg-black/70 p-2 backdrop-blur-sm sm:w-52">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-400">Партия</div>
        <div className="flex gap-1.5">
          <Button size="sm" className="h-7 flex-1 bg-amber-700 text-xs hover:bg-amber-600" onClick={() => newGame()}>Новая</Button>
          <Button size="sm" variant="outline" className="h-7 flex-1 border-amber-800 bg-black/40 text-xs text-amber-100" onClick={doSave}>Сохр.</Button>
          <Button size="sm" variant="outline" disabled={!hasSave} className="h-7 flex-1 border-amber-800 bg-black/40 text-xs text-amber-100 disabled:opacity-30" onClick={doLoad}>Загр.</Button>
        </div>
        <div className="flex gap-1.5">
          <input
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
            placeholder="Seed карты"
            className="h-7 w-full rounded border border-amber-900/60 bg-black/60 px-2 text-xs text-amber-100 outline-none placeholder:text-amber-200/30"
          />
          <Button size="sm" variant="outline" className="h-7 border-amber-800 bg-black/40 px-2 text-xs text-amber-100" onClick={() => newGame(Number(seedInput) || undefined)}>
            ▶
          </Button>
        </div>
        {st && <div className="text-[10px] text-amber-200/50">Текущий seed: {st.seed}</div>}
      </div>

      {/* ---------- Правая панель: юнит / город + лог ---------- */}
      <aside className="absolute right-3 top-16 z-20 flex w-48 flex-col gap-2 sm:w-64">
        {selected && (
          <div className="rounded-lg border border-amber-900/50 bg-black/75 p-2.5 backdrop-blur-sm sm:p-3">
            <div className="flex items-center justify-between">
              <div className="font-bold" style={{ color: FACTION_COLORS[selected.owner] }}>
                {UNIT_SPECS[selected.type].name}{selected.kills >= 2 ? ' ⭐' : ''}
              </div>
              <div className="text-xs text-amber-200/60">ID {selected.id}</div>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded bg-black/60">
              <div
                className="h-full rounded transition-all"
                style={{ width: `${(selected.hp / selected.maxHp) * 100}%`, background: selected.hp / selected.maxHp > 0.35 ? '#69b34c' : '#d33f49' }}
              />
            </div>
            <div className="mt-1 text-xs text-amber-100/80">
              ❤ {selected.hp}/{selected.maxHp} · ⚔ {selected.attack} · 🛡 {selected.defense} <span className="text-amber-300">(+{defB}%)</span>
            </div>
            <div className="mt-0.5 text-xs text-amber-100/80">
              👣 Ход: {selected.mpLeft}/{selected.moveRange} · Побед: {selected.kills}
            </div>
            {cityHere && cityHere.owner === selected.owner && (
              <div className="mt-1 rounded bg-emerald-900/40 px-2 py-1 text-[11px] text-emerald-300">
                В городе: лечение +4 HP/ход
              </div>
            )}
            {nextTarget && canAttackNow && (
              <div className="mt-1.5 rounded bg-red-900/40 px-2 py-1 text-[11px] text-red-200">
                Враг рядом! Урон ≈ {estDamage(selected, nextTarget)} (HP врага: {nextTarget.hp}). Кликните по врагу.
              </div>
            )}
            {selected.attacked && (
              <div className="mt-1 text-[11px] text-amber-200/50">Отряд уже действовал в этом ходу.</div>
            )}
          </div>
        )}

        {selectedCity && (
          <div className="rounded-lg border border-amber-900/50 bg-black/75 p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="font-bold text-amber-200">🏰 {selectedCity.name}</div>
              <div className="text-xs font-semibold" style={{ color: FACTION_COLORS[selectedCity.owner] }}>
                {selectedCity.owner === -1 ? 'Нейтральный' : RU.faction[selectedCity.owner]}
              </div>
            </div>
            <div className="mt-1 text-xs text-amber-100/70">
              Бонус защиты в городе: +25% · Найм: {UNIT_SPECS.infantry.hireCostTurns} хода
            </div>
            {selectedCity.owner === st?.current && st?.winner === null && (
              <Button
                size="sm"
                disabled={
                  selectedCity.hireCooldown > 0 ||
                  !!unitAt(st, selectedCity.x, selectedCity.y) ||
                  aiBusy
                }
                onClick={() => {
                  gameRef.current?.hire(selectedCity.id);
                  setSelectedCity(null);
                }}
                className="mt-2 h-7 w-full bg-amber-600 text-xs font-bold text-black hover:bg-amber-500 disabled:opacity-40"
              >
                {selectedCity.hireCooldown > 0
                  ? `Найм через ${selectedCity.hireCooldown} х.`
                  : unitAt(st, selectedCity.x, selectedCity.y)
                    ? 'Клетка занята'
                    : 'Нанять отряд'}
              </Button>
            )}
          </div>
        )}

        <div className="hidden rounded-lg border border-amber-900/50 bg-black/75 p-2 backdrop-blur-sm md:block">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-400">Журнал</div>
          <div className="max-h-44 space-y-0.5 overflow-y-auto pr-1 text-[11px] leading-snug [scrollbar-color:#5a4a2a_transparent] [scrollbar-width:thin]">
            {logTail.slice(-14).map((e, i) => (
              <div
                key={i}
                className={
                  e.kind === 'combat' ? 'text-red-300' :
                  e.kind === 'city' ? 'text-amber-300' :
                  e.kind === 'system' ? 'text-emerald-300' : 'text-amber-100/70'
                }
              >
                <span className="text-amber-200/40">[{e.turn}]</span> {e.text}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ---------- Мини-карта ---------- */}
      <div className="absolute bottom-3 left-3 z-20 hidden rounded-lg border border-amber-900/50 bg-black/75 p-2 backdrop-blur-sm sm:block">
        <canvas
          ref={miniRef}
          onClick={clickMini}
          className="cursor-pointer rounded border border-amber-900/40"
          style={{ imageRendering: 'pixelated' }}
        />
        <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-amber-100/70">
          {Object.entries(TERRAIN_LABEL).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: v.color }} />
              {v.name} <span className="text-amber-200/40">({v.cost})</span>
            </span>
          ))}
        </div>
      </div>

      {/* ---------- Управление ---------- */}
      <div className="absolute bottom-3 right-3 z-20 hidden max-w-[230px] rounded-lg border border-amber-900/50 bg-black/60 p-2 text-[10px] leading-relaxed text-amber-100/60 backdrop-blur-sm sm:block">
        <b className="text-amber-300">Управление:</b> ЛКМ — выбрать/идти/атаковать · ПКМ или WASD — камера · колесо — зум · Esc — отмена · пробел — конец хода
      </div>

      {/* ---------- Экран победы ---------- */}
      {st?.winner !== null && st?.winner !== undefined && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="max-w-md rounded-2xl border-2 border-amber-600/60 bg-gradient-to-b from-[#2a2015] to-[#191410] p-8 text-center shadow-2xl">
            <div className="text-5xl">{st.winner === 0 ? '👑' : '💀'}</div>
            <h2 className={`mt-3 text-3xl font-black ${st.winner === 0 ? 'text-amber-400' : 'text-red-400'}`}>
              {st.winner === 0 ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'}
            </h2>
            <p className="mt-2 text-sm text-amber-100/80">
              {st.winner === 0
                ? `Фракция «${RU.faction[0]}» контролирует все ${st.cities.length} городов за ${st.turn} ходов!`
                : `«${RU.faction[1]}» захватил все города. Попробуйте ещё раз!`}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button className="bg-amber-600 font-bold text-black hover:bg-amber-500" onClick={() => newGame()}>
                Новая партия
              </Button>
              {hasSave && (
                <Button variant="outline" className="border-amber-800 bg-black/40 text-amber-100" onClick={doLoad}>
                  Загрузить сейв
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Подсказка ---------- */}
      {showHelp && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70" onClick={() => setShowHelp(false)}>
          <div className="max-w-lg rounded-xl border border-amber-700/50 bg-[#1f1810] p-6 text-sm text-amber-100/90 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-amber-400">Как играть</h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Цель — захватить <b>все города</b> на карте.</li>
              <li>ЛКМ по отряду — выбор; зелёные клетки — куда можно дойти (лес 2 очка, горы 3, равнина 1).</li>
              <li>ЛКМ по врагу рядом — атака. После атаки ход отряда заканчивается. Враг может контратаковать.</li>
              <li>ЛКМ по своему городу — панель найма. Город лечит свои отряды (+4 HP/ход) и даёт +25% защиты.</li>
              <li>Захват: войдите отрядом в город без защитников.</li>
              <li>Местность даёт защиту: лес +25%, горы +50%. Слабые отряды (HP&lt;30%) лучше отводить в города.</li>
              <li>Завершите ход — ход сделает противник. Партия автосохраняется каждый раунд.</li>
            </ul>
            <Button size="sm" className="mt-4 bg-amber-700 hover:bg-amber-600" onClick={() => setShowHelp(false)}>Понятно</Button>
          </div>
        </div>
      )}
    </div>
  );
}
