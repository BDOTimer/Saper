/**
 * Детерминированный генератор случайных чисел (seed-based) + простой value noise.
 * Используется для процедурной генерации карты — один seed => одна и та же карта.
 */

/** mulberry32 — быстрый и качественный 32-битный PRNG */
export class Rng {
  private s: number;

  constructor(seed: number) {
    // Нормализуем seed в 32-битное беззнаковое
    this.s = seed >>> 0;
    if (this.s === 0) this.s = 0x9e3779b9;
  }

  /** [0, 1) */
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Целое в [min, max] включительно */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** true с вероятностью p */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Плавный шум [0,1) по решётке — билинейная интерполяция value noise */
  noise2D(x: number, y: number, cell: number, salt = 0): number {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    const fx = (x / cell) - gx;
    const fy = (y / cell) - gy;

    const h = (ix: number, iy: number): number => {
      let t = (this.s ^ Math.imul(ix + 1013, 0x27d4eb2d) ^
        Math.imul(iy + 7919, 0x165667b1) ^ Math.imul(salt + 17, 0x9e3779b1)) >>> 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const v00 = h(gx, gy);
    const v10 = h(gx + 1, gy);
    const v01 = h(gx, gy + 1);
    const v11 = h(gx + 1, gy + 1);

    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    return (
      v00 * (1 - sx) * (1 - sy) +
      v10 * sx * (1 - sy) +
      v01 * (1 - sx) * sy +
      v11 * sx * sy
    );
  }
}
