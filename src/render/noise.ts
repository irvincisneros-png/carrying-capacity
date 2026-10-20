// Small deterministic CPU noise helpers shared by world + prop generation.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0,1]. */
export function vnoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Fractal value noise in ~[0,1]. */
export function fbm(x: number, y: number, octaves = 4): number {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(fx, fy);
    norm += amp;
    fx = fx * 2.03 + 17.1;
    fy = fy * 2.03 + 9.7;
    amp *= 0.5;
  }
  return sum / norm;
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Distance from point to polyline. */
export function distToPolyline(px: number, pz: number, pts: ReadonlyArray<readonly [number, number]>): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
    const qx = ax + dx * t - px;
    const qz = az + dz * t - pz;
    const d = Math.sqrt(qx * qx + qz * qz);
    if (d < best) best = d;
  }
  return best;
}

/** Closest point on polyline (returns [x, z, segmentDirX, segmentDirZ]). */
export function closestOnPolyline(px: number, pz: number, pts: ReadonlyArray<readonly [number, number]>): [number, number, number, number, number] {
  let best = Infinity;
  let out: [number, number, number, number, number] = [0, 0, 1, 0, Infinity];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
    const qx = ax + dx * t;
    const qz = az + dz * t;
    const d = Math.hypot(qx - px, qz - pz);
    if (d < best) {
      best = d;
      const l = Math.sqrt(l2) || 1;
      out = [qx, qz, dx / l, dz / l, d];
    }
  }
  return out;
}
