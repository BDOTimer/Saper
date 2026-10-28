// ui/generator-panel.js

export class GeneratorPanel {
  constructor(config, { onGenerate }) {
    this.config = config;
    this.onGenerate = onGenerate;

    this._buildSizeSliders();
    this._buildCountSliders();
    this._buildTypeSliders();

    document.getElementById('btnRandomSeed').addEventListener('click', () => {
      document.getElementById('seedInput').value = Math.floor(Math.random() * 1e6);
      this._doGenerate();
    });
    document.getElementById('btnGen').addEventListener('click', () => this._doGenerate());
  }

  _doGenerate() {
    const seed = parseInt(document.getElementById('seedInput').value, 10);
    this.config._normalize();
    this.onGenerate(Number.isFinite(seed) ? seed : -1);
  }

  _slider(container, { label, value, min, max, step, integer, onChange }) {
    const row = document.createElement('div');
    row.className = 'slider-row';
    const lab = document.createElement('div');
    lab.className = 'label';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = label;
    const valSpan = document.createElement('span');
    valSpan.className = 'val';
    lab.appendChild(nameSpan); lab.appendChild(valSpan);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step; input.value = value;

    const update = () => {
      const v = integer ? parseInt(input.value, 10) : parseFloat(input.value);
      valSpan.textContent = integer ? v : v.toFixed(2);
      onChange(v);
    };
    input.addEventListener('input', update);
    update();

    row.appendChild(lab);
    row.appendChild(input);
    container.appendChild(row);
    return input;
  }

  _buildSizeSliders() {
    const c = document.getElementById('sizeSliders');
    this._slider(c, {
      label: 'Высота', value: this.config.height, min: 40, max: 100, step: 1, integer: true,
      onChange: v => this.config.height = v,
    });
    this._slider(c, {
      label: 'Ширина', value: this.config.width, min: 40, max: 200, step: 1, integer: true,
      onChange: v => this.config.width = v,
    });
  }

  _buildCountSliders() {
    const c = document.getElementById('countSliders');
    this._slider(c, {
      label: 'Городов', value: this.config.citiesCount, min: 30, max: 60, step: 1, integer: true,
      onChange: v => this.config.citiesCount = v,
    });
    this._slider(c, {
      label: 'Рек', value: this.config.riversCount, min: 0, max: 20, step: 1, integer: true,
      onChange: v => this.config.riversCount = v,
    });
  }

  _buildTypeSliders() {
    const c = document.getElementById('typeSliders');
    const keys = [
      ['water',  'Вода'],
      ['forest', 'Лес'],
      ['plain',  'Поле'],
      ['hills',  'Холмы'],
      ['mount',  'Горы'],
    ];
    const normRow = document.createElement('div');
    normRow.className = 'norm-row';
    c.parentElement.insertBefore(normRow, c.nextSibling);

    const refreshNorm = () => {
      const n = this.config.normalized;
      normRow.textContent = 'Норм: ' + keys.map(([k]) =>
        `${k}: ${(n[k] * 100).toFixed(0)}%`).join(' · ');
    };

    for (const [key, label] of keys) {
      this._slider(c, {
        label, value: this.config[key], min: 0, max: 1, step: 0.01, integer: false,
        onChange: v => { this.config[key] = v; this.config._normalize(); refreshNorm(); },
      });
    }
    refreshNorm();
  }

  destroy() { /* listeners на кнопках умрут вместе с DOM */ }
}