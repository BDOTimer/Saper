// main.js

import { MenuScreen            } from './ui/menu.js';
import { AboutOverlay          } from './ui/about.js';
import { MapEditorScreen       } from './core/world-editor.js';
import { PanelPlayers, Players } from './core/players.js';
import { Game                  } from './core/g-game.js';
import { gameLoop              } from './core/g-loop.js';

// Музыка опциональна: если res/snd/--mus-fon.js отсутствует —
// игра всё равно стартует (динамический импорт с перехватом ошибки).
let musFon = null;
try {
  ({ musFon } = await import('./res/snd/--mus-fon.js'));
} catch (e) {
  console.warn('musFon недоступен (res/snd/--mus-fon.js не найден) — играем без музыки');
}

class App {
  constructor(root) {
    this.root    = root;
    this.screen  = null;
    this.about   = null;
    this.players = new Players(8);

    // последняя сгенерированная карта (из редактора)
    this.world   = null;

    this._showMenu();
  }

  _clearScreen() {
    gameLoop.setScreen(null);
    this.screen = null;
    this.root.replaceChildren();
  }

  _showMenu() {
    this._clearScreen();
    this.screen = new MenuScreen({
      parent: this.root,
      onSelect: (id) => this._onMenuSelect(id),
    });
  }

  _showMapEditor() {
    this._clearScreen();
    this.screen = new MapEditorScreen({
      parent: this.root,
      onExit: (reason) => {
        if (reason === 'play') this._showGame();
        else this._showMenu();
      },
      onWorldGenerated: (world) => { this.world = world; },
    });
    gameLoop.setScreen(this.screen);
    gameLoop.start();
  }

  _showGame() {
    if (!this.world) { this._showMapEditor(); return; }

    this._clearScreen();
    this.screen = new Game(this.world, this.players, {
      parent: this.root,
      onExit: () => this._showMenu(),
    });
    gameLoop.setScreen(this.screen);
    gameLoop.start();
  }

  _onMenuSelect(id) {
    switch (id) {
      case 'new-game': {
        // запускаем игру: если карты ещё нет — идём в редактор
        if (!this.world)
        {    this._playMusic();
             this._showMapEditor();
        }
        else this._showGame();
        break;
      }
      case 'map':
        this._playMusic();
        this._showMapEditor();
        break;
      case 'players':
        this._showPlayers();
        break;
      case 'settings':
        Stub.open({ title: "Настройки", text: "Настройки в разработке." });
        break;
      case 'about':
        this._playMusic();
        this._showAbout();
        break;
    }
  }

  _showAbout() {
    if (this.about) return;
    this.about = new AboutOverlay({
      parent: document.body,
      onClose: () => { this.about?.destroy(); this.about = null; },
    });
  }

  _showPlayers() {
    if (this.playersPanel) return;
    this.playersPanel = new PanelPlayers({
      players: this.players,
      parent: document.body,
      onConfirm: (players) => {
        this.playersPanel?.destroy();
        this.playersPanel = null;
        console.log('Игроки:', players.list.map(p => p.snapshot()));
      },
      onCancel: () => {
        this.playersPanel?.destroy();
        this.playersPanel = null;
      },
    });
  }

  _playMusic()
  {
    //
    musFon?.start('calm');
  }
}

// Модуль с top-level await — асинхронный: DOMContentLoaded мог уже
// произойти, поэтому boot() не вешаем только на событие.
const boot = () => {
  window.__app = new App(document.getElementById('root'));
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}