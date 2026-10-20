/** Deterministic seeded RNG (mulberry32) plus small helpers. No Math.random anywhere in sim. */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Current internal state (uint32) - serialisable. */
  state(): number;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    state: () => a,
  };
}

/** Smooth 2D value noise in [0,1], deterministic from the rng it is built from. */
export function makeNoise2D(rng: Rng): (x: number, y: number) => number {
  const SIZE = 64;
  const lattice = new Float64Array(SIZE * SIZE);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng.next();
  const at = (ix: number, iy: number): number =>
    lattice[(((iy % SIZE) + SIZE) % SIZE) * SIZE + (((ix % SIZE) + SIZE) % SIZE)] ?? 0;
  const fade = (t: number): number => t * t * (3 - 2 * t);
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = fade(x - ix);
    const fy = fade(y - iy);
    const a = at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx;
    const b = at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx;
    return a * (1 - fy) + b * fy;
  };
}
