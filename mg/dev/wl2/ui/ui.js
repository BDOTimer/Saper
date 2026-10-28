// ui/ui.js
import { TYPE_META } from '../core/cell.js';

export class UI {
  constructor() {
    this.logBox = document.getElementById('log');
    this.statusLabel = document.getElementById('statusLabel');
    this.panel = document.getElementById('panel');
    this._addLog('Инициализация...');
    this._buildLegend();
  }

  _buildLegend() {
    const box = document.getElementById('legendItems');
    for (const [id, meta] of Object.entries(TYPE_META)) {
      const row = document.createElement('div');
      row.className = 'item';
      const sw = document.createElement('span');
      sw.className = 'sw';
      sw.style.background = '#' + meta.color.toString(16).padStart(6, '0');
      const nm = document.createElement('span');
      nm.textContent = meta.name;
      row.appendChild(sw); row.appendChild(nm);
      box.appendChild(row);
    }
    const extra = [
      ['Дорога', '#c8a86b'],
      ['Река',   '#2f7fbf'],
      ['Город',  '#d64545'],
    ];
    for (const [name, color] of extra) {
      const row = document.createElement('div');
      row.className = 'item';
      const sw = document.createElement('span');
      sw.className = 'sw';
      sw.style.background = color;
      const nm = document.createElement('span');
      nm.textContent = name;
      row.appendChild(sw); row.appendChild(nm);
      box.appendChild(row);
    }
  }

  log(msg, hl = false) {
    const d = document.createElement('div');
    if (hl) d.className = 'hl';
    d.textContent = msg;
    this.logBox.appendChild(d);
    this.logBox.scrollTop = this.logBox.scrollHeight;
    while (this.logBox.children.length > 40) this.logBox.removeChild(this.logBox.firstChild);
  }
  _addLog(msg, hl) { this.log(msg, hl); }

  setStatus(s) { this.statusLabel.textContent = s; }

  showCell(cell) {
    if (!cell) {
      this.panel.innerHTML = `<h3>Клетка</h3><div class="muted">—</div>`;
      return;
    }
    const meta = cell.meta;
    const city = cell.city >= 0 ? `да (#${cell.city + 1})` : 'нет';
    this.panel.innerHTML =
      `<h3>Клетка (${cell.x}, ${cell.y})</h3>
       <div><span class="swatch" style="background:#${meta.color.toString(16).padStart(6,'0')}"></span>${meta.name}</div>
       <div>Проходима: <b>${meta.walkable ? 'да' : 'нет'}</b></div>
       <div>Stamina: <b>${cell.staminaCost}</b></div>
       <div>Высота: ${(cell.elevation * 100).toFixed(0)}%</div>
       <div>Оверлей: <b>${cell.overlay || '—'}</b></div>
       <div>Город: <b>${city}</b></div>`;
  }
}