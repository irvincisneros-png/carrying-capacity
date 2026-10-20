// Procedural layout + heightfield for the 24x24-tile NSW coastal diorama.
// x: west(-12) -> east(+12), z: north(-12) -> south(+12). Water level y = 0.
import { fbm, vnoise, smoothstep, lerp, clamp, distToPolyline } from './noise';

export const TILES = 24;
export const HALF = 12;
export const RES = 4; // grid cells per tile
export const SEG = TILES * RES;
export const VERTS = SEG + 1;
export const CELL = 1 / RES;

export const Kind = { Land: 0, Sea: 1, Estuary: 2 } as const;
export type Kind = (typeof Kind)[keyof typeof Kind];

// ---- Layout constants shared by terrain colouring + prop placement ----
export const RIVER: ReadonlyArray<readonly [number, number]> = [
  [-2.2, -12.8], [-0.9, -9.2], [-2.3, -6.2], [-0.8, -3.4], [-1.15, -0.6], [-0.9, 2.6], [-0.6, 4.6],
];
export const ESTUARY = { cx: -0.5, cz: 6.8, rx: 4.2, rz: 2.9 };
export const CHANNEL: ReadonlyArray<readonly [number, number]> = [[2.4, 7.4], [4.6, 7.9], [7.0, 8.3]];
export const PAD = { x0: -11.6, x1: -4.5, z0: -11.6, z1: -4.0 };
export const COALYARD = { x0: -11.2, x1: -5.4, z0: -3.0, z1: 2.0 };
export const STOCKPILES: ReadonlyArray<{ x: number; z: number; l: number; w: number; h: number; r: number }> = [
  { x: -9.6, z: -1.7, l: 2.6, w: 0.95, h: 0.7, r: 0.08 },
  { x: -7.2, z: -0.4, l: 2.2, w: 0.85, h: 0.62, r: -0.05 },
  { x: -9.5, z: 0.9, l: 2.4, w: 0.9, h: 0.66, r: 0.04 },
];
export const REEF = { x: 8.7, z: 6.9, r: 2.7 };
export const BRIDGE = { x0: -2.35, x1: 0.15, z: -1.55 };

export const ROADS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  // main road: steelworks gate -> bridge -> town hall -> headland turbines
  [[-11.9, -3.65], [-6.2, -3.65], [-3.6, -2.2], [-2.4, -1.55]],
  [[0.2, -1.55], [1.5, -1.45], [3.2, -2.0], [4.4, -3.6], [5.6, -5.3], [7.1, -6.9], [8.4, -8.0]],
  // town streets
  [[-6.2, -3.65], [-6.3, 2.5], [-6.9, 6.2], [-7.4, 11.9]],
  [[-11.9, 2.7], [-6.3, 2.5], [-2.9, 2.7]],
  [[-11.9, 7.4], [-6.75, 7.2]],
  [[-6.75, 7.2], [-4.9, 9.9], [-3.8, 11.9]],
  // east side: town hall -> beach car park
  [[1.5, -1.45], [1.9, 1.2], [3.3, 2.2]],
];

export const TURBINES: ReadonlyArray<readonly [number, number]> = [[6.6, -8.7], [8.7, -6.4], [9.7, -10.1]];
export const TOWN_HALL = { x: 2.5, z: -0.2 };
export const LIGHTHOUSE = { x: 10.2, z: -3.6 };

function inEstuary(x: number, z: number): boolean {
  const ex = (x - ESTUARY.cx) / ESTUARY.rx;
  const ez = (z - ESTUARY.cz) / ESTUARY.rz;
  const wob = (vnoise(x * 0.8 + 3, z * 0.8) - 0.5) * 0.4;
  if (ex * ex + ez * ez + wob < 1) return true;
  if (distToPolyline(x, z, CHANNEL) < 0.95 + (vnoise(x, z) - 0.5) * 0.3) return true;
  const rw = 0.4 + 0.18 * smoothstep(-12, 4, z);
  return distToPolyline(x, z, RIVER) < rw;
}

function coastX(z: number): number {
  return 4.8 + 0.6 * Math.sin(z * 0.6 + 0.8) + (fbm(z * 0.3, 3.3, 3) - 0.5) * 0.9;
}
function cliffZ(x: number): number {
  return -2.7 + 0.45 * Math.sin(x * 0.9) + (fbm(x * 0.4, 7.1, 3) - 0.5) * 0.9;
}
function eastCliffX(z: number): number {
  return 11.0 + 0.35 * Math.sin(z * 0.8) + (fbm(z * 0.5, 1.7, 3) - 0.5) * 0.6;
}

function inSea(x: number, z: number): boolean {
  if (z > cliffZ(x) && x > coastX(z)) return true;
  if (x > eastCliffX(z)) return true;
  return false;
}

export function headlandFactor(x: number, z: number): number {
  return smoothstep(2.0, 4.8, x) * smoothstep(-1.4, -3.8, z);
}

export function rectMask(x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }, feather: number): number {
  const dx = Math.max(r.x0 - x, x - r.x1, 0);
  const dz = Math.max(r.z0 - z, z - r.z1, 0);
  return 1 - smoothstep(0, feather, Math.hypot(dx, dz));
}

/** 8-neighbour chamfer distance transform (in world units) to nearest `src` vertex. */
function chamfer(src: Uint8Array): Float32Array {
  const n = VERTS;
  const d = new Float32Array(n * n);
  const INF = 1e9;
  for (let i = 0; i < n * n; i++) d[i] = src[i] ? 0 : INF;
  const D1 = CELL;
  const D2 = CELL * Math.SQRT2;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      let v = d[k];
      if (i > 0) v = Math.min(v, d[k - 1] + D1);
      if (j > 0) {
        v = Math.min(v, d[k - n] + D1);
        if (i > 0) v = Math.min(v, d[k - n - 1] + D2);
        if (i < n - 1) v = Math.min(v, d[k - n + 1] + D2);
      }
      d[k] = v;
    }
  }
  for (let j = n - 1; j >= 0; j--) {
    for (let i = n - 1; i >= 0; i--) {
      const k = j * n + i;
      let v = d[k];
      if (i < n - 1) v = Math.min(v, d[k + 1] + D1);
      if (j < n - 1) {
        v = Math.min(v, d[k + n] + D1);
        if (i < n - 1) v = Math.min(v, d[k + n + 1] + D2);
        if (i > 0) v = Math.min(v, d[k + n - 1] + D2);
      }
      d[k] = v;
    }
  }
  return d;
}

export interface World {
  heights: Float32Array;
  kind: Uint8Array;
  dSea: Float32Array;
  dEst: Float32Array;
  dLand: Float32Array;
  heightAt(x: number, z: number): number;
  kindAt(x: number, z: number): Kind;
  field(arr: Float32Array, x: number, z: number): number;
  roadDist(x: number, z: number): number;
}

export function buildWorld(): World {
  const n = VERTS;
  const kind = new Uint8Array(n * n);
  const seaSrc = new Uint8Array(n * n);
  const estSrc = new Uint8Array(n * n);
  const landSrc = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -HALF + i * CELL;
      const z = -HALF + j * CELL;
      const k = j * n + i;
      let kd: Kind = Kind.Land;
      if (inSea(x, z)) kd = Kind.Sea;
      else if (inEstuary(x, z)) kd = Kind.Estuary;
      kind[k] = kd;
      seaSrc[k] = kd === Kind.Sea ? 1 : 0;
      estSrc[k] = kd === Kind.Estuary ? 1 : 0;
      landSrc[k] = kd === Kind.Land ? 1 : 0;
    }
  }
  const dSea = chamfer(seaSrc);
  const dEst = chamfer(estSrc);
  const dLand = chamfer(landSrc);

  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -HALF + i * CELL;
      const z = -HALF + j * CELL;
      const k = j * n + i;
      const kd = kind[k];
      let h: number;
      if (kd === Kind.Land) {
        const back = smoothstep(-5, -12, z);
        const base = 0.34 + 0.34 * fbm(x * 0.12 + 5, z * 0.12 + 5) + 1.0 * back * fbm(x * 0.22 + 2, z * 0.22, 3);
        const plateau = 2.25 + 0.5 * fbm(x * 0.33 + 1, z * 0.33 + 2) + 0.25 * smoothstep(4, 10, x);
        const hl = headlandFactor(x, z);
        const land = lerp(base, plateau, hl);
        const ds = dSea[k];
        const beach = lerp(0.07, land, smoothstep(0.15, 2.4, ds));
        const cliff = lerp(0.1, land, smoothstep(0.0, 0.42, ds));
        h = lerp(beach, cliff, smoothstep(0.25, 0.6, hl));
        h = lerp(0.07, h, smoothstep(0.02, 1.1, dEst[k]));
        // flattened building pads (only where far from water)
        const pad = rectMask(x, z, PAD, 0.9);
        h = lerp(h, 0.62, pad * 0.92);
        const yard = rectMask(x, z, COALYARD, 0.8) * smoothstep(0.3, 1.2, dEst[k]);
        h = lerp(h, 0.44, yard * 0.85);
        const town = smoothstep(-2.4, -3.6, x) * smoothstep(-4.2, -3.2, z) * smoothstep(0.3, 1.2, dEst[k]);
        h = lerp(h, 0.36 + 0.12 * fbm(x * 0.3, z * 0.3), town * 0.6);
        h = Math.max(h, 0.05);
      } else {
        const dl = dLand[k];
        if (kd === Kind.Sea) {
          h = -0.2 - 1.35 * smoothstep(0.0, 3.2, dl);
          const rr = Math.hypot(x - REEF.x, z - REEF.z) + (fbm(x * 0.6, z * 0.6) - 0.5) * 1.6;
          const reef = smoothstep(REEF.r + 0.6, REEF.r - 0.6, rr);
          h = lerp(h, -0.4 + (fbm(x * 1.6, z * 1.6) - 0.5) * 0.22, reef);
        } else {
          h = -0.16 - 0.42 * smoothstep(0.0, 1.4, dl);
        }
        h += (vnoise(x * 2.5, z * 2.5) - 0.5) * 0.05;
      }
      heights[k] = h;
    }
  }

  const field = (arr: Float32Array, x: number, z: number): number => {
    const fx = clamp((x + HALF) / CELL, 0, SEG - 1e-4);
    const fz = clamp((z + HALF) / CELL, 0, SEG - 1e-4);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const k = j * n + i;
    const a = arr[k];
    const b = arr[k + 1];
    const c = arr[k + n];
    const d = arr[k + n + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  };
  const heightAt = (x: number, z: number) => field(heights, x, z);
  const kindAt = (x: number, z: number): Kind => {
    const i = clamp(Math.round((x + HALF) / CELL), 0, SEG);
    const j = clamp(Math.round((z + HALF) / CELL), 0, SEG);
    return kind[j * n + i] as Kind;
  };
  const roadDist = (x: number, z: number) => {
    let d = Infinity;
    for (const r of ROADS) d = Math.min(d, distToPolyline(x, z, r));
    return d;
  };
  return { heights, kind, dSea, dEst, dLand, heightAt, kindAt, field, roadDist };
}
