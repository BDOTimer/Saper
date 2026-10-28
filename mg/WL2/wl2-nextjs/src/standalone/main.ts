/**
 * Standalone entry — точка входа автономной сборки (single-file index.html).
 * Связывает Game + Renderer + AI + AudioManager с ванильным UI.
 */

import { Game, GameEvent } from '../lib/game/game';
import { Renderer } from '../lib/game/renderer';
import { AudioManager } from '../lib/game/audio';
import { AI } from '../lib/game/ai';
import { cityAt, manhattan, unitAt } from '../lib/game/board';
import { GameState, OwnerId, Unit, City } from '../lib/game/types';
import { UI } from './ui';

function boot(): void {
  const sceneEl = document.getElementById('scene') as HTMLDivElement;

  const audio = new AudioManager();
  let busy = false;
  let soundOn = true;
  let musicOn = true;
  let hasSave = false;
  let selectedCity: City | null = null;
  let bannerTimer = 0;

  const renderer = new Renderer(sceneEl);

  const ui = new UI({
    endTurn: () => doEndTurn(),
    cancel: () => {
      game.clearSelection();
      selectedCity = null;
      syncUI(game.state);
    },
    focusCapital: () => {
      const cap = game.state.cities.find((c) => c.owner === game.state.current);
      if (cap) renderer.focusOn(cap.x, cap.y);
    },
    newGame: (seed) => doNewGame(seed),
    save: () => {
      if (game.save()) {
        hasSave = true;
        syncUI(game.state);
      }
    },
    load: () => doLoad(),
    toggleSound: () => {
      audio.unlock();
      soundOn = !soundOn;
      audio.setEnabled(soundOn);
      ui.setIcons(soundOn, musicOn);
    },
    toggleMusic: () => {
      audio.unlock();
      musicOn = !musicOn;
      audio.setMusic(musicOn);
      ui.setIcons(soundOn, musicOn);
    },
    toggleHelp: () => ui.toggleHelp(),
    hire: (cityId) => {
      game.hire(cityId);
      selectedCity = null;
      syncUI(game.state);
    },
    minimapClick: (x, y) => renderer.focusOn(x, y),
  });

  const game = new Game({
    onStateChange: (s) => syncUI(s),
    onLog: (e) => ui.appendLog(e),
    onEvent: (ev) => handleEvent(ev),
  });
  const ai = new AI(game, 424242);

  // Dev-экспорт для отладки и тестов
  (window as unknown as { __warlords?: Game }).__warlords = game;

  // ---------- Синхронизация UI с состоянием ----------

  function syncUI(s: GameState): void {
    renderer.sync(s);
    const sel: Unit | null = s.units.find((u) => u.id === game.selectedUnitId) ?? null;

    if (sel && game.selectedReach && !sel.attacked) {
      const attackable = s.units.filter(
        (e) => e.owner !== s.current && manhattan(e.x, e.y, sel.x, sel.y) === 1,
      );
      renderer.showReach(s, game.selectedReach, sel.id, attackable);
    } else {
      renderer.showReach(s, null, null, []);
    }
    renderer.setSelected(sel);

    ui.setTop(s, busy, hasSave);
    ui.showUnit(sel, s);
    ui.showCity(selectedCity && s.winner === null ? selectedCity : null, s);
    ui.drawMinimap(s);
    ui.showEnd(s, hasSave);
  }

  function handleEvent(ev: GameEvent): void {
    switch (ev.type) {
      case 'move':
        renderer.playMovePath(ev.unitId, ev.path);
        break;
      case 'attack':
        renderer.playHit(ev.at.x, ev.at.y);
        audio.play(ev.result.hit ? 'hit' : 'miss');
        if (ev.result.defenderDied || ev.result.attackerDied) audio.play('death');
        break;
      case 'capture':
        renderer.playCapture(ev.city.x, ev.city.y);
        audio.play('capture');
        showBanner(ev.by === 0 ? `⚔ ${ev.city.name} захвачен!` : `✖ ${ev.city.name} потерян!`);
        break;
      case 'hire':
        audio.play('hire');
        break;
      case 'death':
        renderer.playDeath(ev.at.x, ev.at.y);
        break;
      case 'turnStart':
        audio.play('turn');
        if (ev.player === 1) {
          const cap = game.state.cities.find((c) => c.owner === 1);
          if (cap) renderer.focusOn(cap.x, cap.y);
        }
        break;
      case 'gameOver':
        audio.play(ev.winner === 0 ? 'victory' : 'defeat');
        break;
    }
  }

  function showBanner(text: string): void {
    ui.setBanner(text);
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => ui.setBanner(null), 2200);
  }

  // ---------- Действия ----------

  function focusPlayerCapital(): void {
    const cap = game.state.cities.find((c) => c.owner === 0);
    if (cap) renderer.focusOn(cap.x, cap.y);
  }

  function doNewGame(seed?: number): void {
    ai.stop();
    busy = false;
    selectedCity = null;
    ui.setBanner(null);
    game.newGame(seed);
    hasSave = game.hasSave();
    syncUI(game.state);
    focusPlayerCapital();
  }

  function doEndTurn(): void {
    if (busy || game.state.winner !== null || game.state.current !== 0) return;
    game.clearSelection();
    selectedCity = null;
    game.endTurn(); // ход переходит к ИИ
    busy = true;
    syncUI(game.state);

    ai.tryHire();
    ai.playTurn(() => {
      if (game.state.winner === null) {
        game.endTurn(); // обратно к игроку
        game.save();
        hasSave = true;
      }
      busy = false;
      syncUI(game.state);
    });
  }

  function doLoad(): void {
    ai.stop();
    busy = false;
    if (game.load()) {
      ui.setLog([...game.state.log.slice(-12)]);
      selectedCity = null;
      hasSave = true;
      syncUI(game.state);
      focusPlayerCapital();
      if (game.state.current === 1 && game.state.winner === null) {
        busy = true;
        syncUI(game.state);
        ai.tryHire();
        ai.playTurn(() => {
          if (game.state.winner === null) game.endTurn();
          busy = false;
          syncUI(game.state);
        });
      }
    }
  }

  // ---------- Клик по карте ----------

  renderer.onClickTile = (x, y) => {
    audio.unlock();
    const st = game.state;
    if (!st || busy) return;
    const city = cityAt(st, x, y);
    const unit = unitAt(st, x, y);

    if (unit && unit.owner === st.current) {
      game.selectUnitAt(x, y);
      selectedCity = null;
      audio.play('select');
      return;
    }
    if (unit && unit.owner !== st.current && game.selectedUnit) {
      game.clickTile(x, y); // атака
      return;
    }
    if (game.selectedUnit) {
      game.clickTile(x, y); // перемещение / сброс
      return;
    }
    if (city) {
      selectedCity = { ...city };
      game.clearSelection();
    } else {
      selectedCity = null;
      game.clearSelection();
    }
  };
  renderer.onStepSound = () => audio.play('step');

  // ---------- Клавиатура ----------

  window.addEventListener('keydown', (e) => {
    const step = 60;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'ц') renderer.panBy(0, -step);
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S' || e.key === 'ы') renderer.panBy(0, step);
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ф') renderer.panBy(-step, 0);
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'в') renderer.panBy(step, 0);
    else if (e.key === 'Escape') {
      game.clearSelection();
      selectedCity = null;
      syncUI(game.state);
    } else if (e.key === ' ') {
      e.preventDefault();
      doEndTurn();
    }
  });

  // Аудио разблокируется первым жестом
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  // ---------- HP-бары (обновление только при изменениях) ----------

  let lastHtml = '';
  let frame = 0;
  const drawHp = () => {
    requestAnimationFrame(drawHp);
    const st = game.state;
    if (!st) return;
    frame++;
    if (frame % 3 !== 0) return;
    const items: string[] = [];
    for (const u of st.units) {
      const p = renderer.projectTile(u.x, u.y, 1.15);
      if (!p.visible) continue;
      const col = u.owner === 0 ? '#d33f49' : u.owner === 1 ? '#3e8e52' : '#b8b2a7';
      const w = 34;
      const hpf = Math.max(0, u.hp / u.maxHp);
      items.push(
        `<div style="position:absolute;left:${p.left - w / 2}px;top:${p.top}px;width:${w}px;pointer-events:none;">` +
          '<div style="height:4px;background:rgba(0,0,0,.65);border-radius:2px;overflow:hidden;">' +
            `<div style="height:100%;width:${hpf * 100}%;background:${hpf > 0.5 ? '#69b34c' : hpf > 0.25 ? '#e0a800' : '#d33f49'};"></div>` +
          '</div>' +
          `<div style="text-align:center;font-size:9px;color:${col};text-shadow:0 1px 2px #000;font-weight:700;">${u.hp}</div>` +
        '</div>',
      );
    }
    const html = items.join('');
    if (html !== lastHtml) {
      ui.hpOverlay.innerHTML = html;
      lastHtml = html;
    }
  };
  requestAnimationFrame(drawHp);

  // ---------- Старт ----------

  ui.setIcons(soundOn, musicOn);
  game.newGame();
  hasSave = game.hasSave();
  syncUI(game.state);
  focusPlayerCapital();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export {};
