// core/world-map.js

export class WorldMap {
  constructor(w, h, seed) {
    this.w = w; this.h = h; this.seed = seed;
    this.cells = new Array(w * h);
    this.cities = [];       // [{x,y,name}]
    this.rivers = [];       // [{cells:[[x,y],...]}]
  }
  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inBounds(x, y) ? this.cells[this.idx(x, y)] : null; }
  set(x, y, cell) { if (this.inBounds(x, y)) this.cells[this.idx(x, y)] = cell; }

  neighbors8(x, y) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const c = this.get(x + dx, y + dy);
        if (c) out.push(c);
      }
    return out;
  }
  neighbors4(x, y) {
    return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]
      .map(([nx,ny]) => this.get(nx,ny)).filter(Boolean);
  }
  get cellsFlat() { return this.cells; }

  // удобный 2D-доступ (для геймплея)
  get cells2D() {
    const m = [];
    for (let y = 0; y < this.h; y++) {
      const row = [];
      for (let x = 0; x < this.w; x++) row.push(this.cells[y * this.w + x]);
      m.push(row);
    }
    return m;
  }

  update()
  {
  }
}