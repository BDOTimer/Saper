// core/cell.js

export const CellType = Object.freeze({
  PLAIN: 'plain',
  FOREST:'forest',
  HILLS: 'hills',
  MOUNT: 'mount',
  WATER: 'water',
  // overlay-типы
  ROAD:  'road',
  RIVER: 'river',
});

export const TYPE_META = {
  plain:  { name: 'Поле',  color: 0x6d8f4e, stamina: 1, isWater: false, isMountain: false },
  forest: { name: 'Лес',   color: 0x2f5a35, stamina: 2, isWater: false, isMountain: false },
  hills:  { name: 'Холмы', color: 0x8a7b52, stamina: 2, isWater: false, isMountain: false },
  mount:  { name: 'Горы',  color: 0x7d757e, stamina: 4, isWater: false, isMountain: true  },
  water:  { name: 'Вода',  color: 0x2a5a8c, stamina: 6, isWater: true,  isMountain: false },
};

export const OVERLAY = Object.freeze({
  NONE:  0,
  ROAD:  1 << 0,   // 1
  RIVER: 1 << 1,   // 2
});

export class Cell {
  constructor(x, y, type = CellType.PLAIN) {
    this.x = x; this.y = y;
    this.type = type;
    this.overlay = OVERLAY.NONE;   // ← число, не строка
    this.city = -1;
    this.meshId = -1;
    this.texId = 0;
    this.elevation = 0;
  }
  get meta() { return TYPE_META[this.type]; }

  get hasRoad()  { return (this.overlay & OVERLAY.ROAD)  !== 0; }
  get hasRiver() { return (this.overlay & OVERLAY.RIVER) !== 0; }

  addOverlay(flag)   { this.overlay |= flag; }
  removeOverlay(flag){ this.overlay &= ~flag; }

  get staminaCost() { return this.hasRoad ? 1 : this.meta.stamina; }

  // для UI / отладки
  get overlayName() {
    if (!this.overlay) return '—';
    const parts = [];
    if (this.hasRoad)  parts.push('road');
    if (this.hasRiver) parts.push('river');
    return parts.join('+');
  }
}