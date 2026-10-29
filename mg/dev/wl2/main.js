// main.js

import { MenuScreen            } from './ui/menu.js';
import { AboutOverlay          } from './ui/about.js';
import { MapEditorScreen       } from './core/map-editor.js';
import { PanelPlayers, Players } from './core/players.js';

class App {
  constructor(root) {
    this.root    = root;
    this.screen  = null;  // текущий активный экран (menu | map-editor)
    this.about   = null;  // оверлей описания (живёт поверх)
    this.players = new Players(8);

    this._showMenu();
  }

  _clearScreen() {
    if (this.screen?.destroy) this.screen.destroy();
    this.screen = null;
    this.root.replaceChildren();
  }

  _showMenu() {
    this._clearScreen();
    this.screen = new MenuScreen({
      version: 'v0.0.2',
      parent: this.root,
      onSelect: (id) => this._onMenuSelect(id),
    });
  }

  _showMapEditor() {
    this._clearScreen();
    this.screen = new MapEditorScreen({
      parent: this.root,
      onExit: () => this._showMenu(),
    });
  }

  _onMenuSelect(id) {
    switch (id) {
      case 'new-game':
        // пока ведём в генератор — потом сюда придёт запуск партии
        this._showMapEditor();
        break;
      case 'map':
        this._showMapEditor();
        break;
      case 'about':
        this._showAbout();
        break;
      case 'players':
        this._showPlayers();
        break;
      // players/settings — disabled, сюда не долетает
    }
  }

  _showAbout() {
    if (this.about) return; // уже открыт
    this.about = new AboutOverlay({
      parent: document.body,
      onClose: () => {
        this.about?.destroy();
        this.about = null;
      },
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
        // дальше можно передать players в Judge / Game
        console.log('Игроки:', players.list.map(p => p.snapshot()));
      },
      onCancel: () => {
        this.playersPanel?.destroy();
        this.playersPanel = null;
      },
    });
  }
}

  window.addEventListener('DOMContentLoaded', () => {
  window.__app = new App(document.getElementById('root'));
});