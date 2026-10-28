// core/map-editor.js
import { WorldMap }                from '../core/world-map.js';
import { Cell, CellType }          from '../core/cell.js';
import { WorldMapGeneratorConfig, WorldMapGenerator } from '../core/generator.js';
import { MapView }                 from '../render/map-view.js';
import { GeneratorPanel }          from '../ui/generator-panel.js';
import { UI }                      from '../ui/ui.js';

export class MapEditorScreen {
  constructor({ parent, onExit = () => {} }) {
    this.parent = parent;
    this.onExit = onExit;

    this.el = this._render();
    parent.appendChild(this.el);

    // конфиг и мир
    this.config = new WorldMapGeneratorConfig();
    let world = new WorldMap(this.config.width, this.config.height, 1337);
    for (let y = 0; y < this.config.height; y++)
      for (let x = 0; x < this.config.width; x++)
        world.set(x, y, new Cell(x, y, CellType.PLAIN));
    this.world = world;

    this.ui = new UI();

    // three.js монтируется в #app
    this.mapView = new MapView(world, this.el.querySelector('#app'));
    this.mapView._onTileClick = (tile) => this.ui.showCell(tile);

    this.panel = new GeneratorPanel(this.config, {
      onGenerate: (seed) => this._generate(seed),
    });

    // кнопки
    this.el.querySelector('#btnExit').addEventListener('click', () => {
      this.onExit();
    });

    const btnOrbit = this.el.querySelector('#btnCamOrbit');
    const btnTop   = this.el.querySelector('#btnCamTop');
    btnOrbit.addEventListener('click', () => {
      btnOrbit.classList.add('active'); btnTop.classList.remove('active');
      this.mapView.setCameraMode('orbit');
    });
    btnTop.addEventListener('click', () => {
      btnTop.classList.add('active'); btnOrbit.classList.remove('active');
      this.mapView.setCameraMode('top');
    });

    // первая генерация
    this.el.querySelector('#btnGen').click();

    // отладка
    window.__world    = this.world;
    window.__config   = this.config;
    window.__mapView  = this.mapView;
    window.__ui       = this.ui;
  }

  _generate(seed) {
    const ui = this.ui;
    ui.setStatus('Генерация...');
    this.el.querySelector('#genBusy').style.display = 'flex';
    setTimeout(() => {
      const t0 = performance.now();
      this.world = new WorldMap(this.config.width, this.config.height, seed);
      const gen = new WorldMapGenerator(this.world, this.config);
      gen.generate(seed);
      const dt = performance.now() - t0;

      this.mapView.world = this.world;
      this.mapView.rebuild(this.world);

      this.el.querySelector('#seedInput').value = this.world.seed;
      ui.setStatus(`Seed ${this.world.seed} · ${this.config.width}×${this.config.height} · ${dt.toFixed(0)} мс`);
      ui.log(`Сгенерировано: ${this.world.cells.length} клеток, ${this.world.cities.length} городов, ${this.world.rivers.length} рек (${dt.toFixed(0)} мс)`, true);
      for (const m of gen.logs) ui.log(m);

      this.el.querySelector('#genBusy').style.display = 'none';

      window.__world = this.world;
      window.__mapView = this.mapView;
    }, 30);
  }

  _render() {
    const root = document.createElement('div');
    root.className = 'map-editor';
    root.innerHTML = `
      <div id="app"></div>
      <div id="hud">
        <div id="topbar">
          <button id="btnExit">← В меню</button>
          <button id="btnGen" class="primary">Сгенерировать</button>
          <div class="status" id="statusLabel">—</div>
          <button id="btnCamOrbit" class="active">Орбита</button>
          <button id="btnCamTop">Сверху</button>
        </div>

        <div id="genPanel">
          <h3>Генератор карты</h3>
          <h4>Размер</h4>
          <div id="sizeSliders"></div>
          <h4>Города / реки</h4>
          <div id="countSliders"></div>
          <h4>Веса типов (0..1)</h4>
          <div id="typeSliders"></div>
          <h4>Seed</h4>
          <div class="seed-row">
            <input type="number" id="seedInput" value="1337" min="0" step="1" />
            <button id="btnRandomSeed">🎲</button>
          </div>
        </div>

        <div id="legend">
          <div style="color:#9ab8d6; margin-bottom:4px;">Легенда</div>
          <div id="legendItems"></div>
        </div>

        <div id="panel">
          <h3>Карта</h3>
          <div class="muted">Кликни по карте для выбора клетки</div>
        </div>

        <div id="log"></div>
        <div id="genBusy">Генерация...</div>
      </div>
    `;
    return root;
  }

  destroy() {
    this.panel?.destroy?.();
    this.mapView?.destroy?.();
    this.ui?.destroy?.();
    this.el.remove();
    delete window.__world;
    delete window.__config;
    delete window.__mapView;
    delete window.__ui;
  }
}