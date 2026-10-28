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

export class Cell {
  constructor(x, y, type = CellType.PLAIN) {
    this.x = x; this.y = y;
    this.type = type;
    this.overlay = null;
    this.city = -1;
    this.meshId = -1;
    this.texId = 0;
    this.elevation = 0;
  }
  get meta() { return TYPE_META[this.type]; }
  get staminaCost() { return this.overlay === 'road' ? 1 : this.meta.stamina; }
  // сохранили как алиас, теперь всегда true — для обратной совместимости с UI
  get walkable() { return true; }
}