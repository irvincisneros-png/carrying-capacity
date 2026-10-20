/** Shared helpers for the terrain generators. All deterministic from the seed. */
import { createGrid } from '../grid';
import { makeNoise2D, mulberry32 } from '../rng';
import type { Rng } from '../rng';
import { TileKind } from '../types';
import type { TileGrid } from '../types';

export interface GenKit {
  w: number;
  h: number;
  rng: Rng;
  grid: TileGrid;
  /** Independent smooth noise fields in [0,1]. */
  n1: (x: number, y: number) => number;
  n2: (x: number, y: number) => number;
  n3: (x: number, y: number) => number;
}

export function kit(w: number, h: number, seed: number): GenKit {
  const rng = mulberry32(seed);
  const n1 = makeNoise2D(rng);
  const n2 = makeNoise2D(rng);
  const n3 = makeNoise2D(rng);
  return { w, h, rng, grid: createGrid(w, h), n1, n2, n3 };
}

export const clampi = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function at(k: GenKit, x: number, y: number): number {
  return k.grid.kind[y * k.w + x] ?? 0;
}

export function inb(k: GenKit, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < k.w && y < k.h;
}

export function set(k: GenKit, x: number, y: number, kind: number, elev?: number): void {
  if (!inb(k, x, y)) return;
  const i = y * k.w + x;
  k.grid.kind[i] = kind;
  if (elev !== undefined) k.grid.elevation[i] = elev;
}

/** Tiles of a given kind as flat indices. */
export function tilesOf(k: GenKit, kind: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < k.grid.kind.length; i++) if (k.grid.kind[i] === kind) out.push(i);
  return out;
}

/** Distance (Euclidean, tiles) from every tile to the nearest tile accepted by `test`. */
export function distanceField(k: GenKit, test: (kind: number, i: number) => boolean): Float32Array {
  const { w, h } = k;
  const src: number[] = [];
  for (let i = 0; i < w * h; i++) if (test(k.grid.kind[i] ?? 0, i)) src.push(i);
  const out = new Float32Array(w * h).fill(999);
  if (src.length === 0) return out;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = 999;
      for (const s of src) {
        const sx = s % w, sy = Math.floor(s / w);
        const d = Math.hypot(x - sx, y - sy);
        if (d < best) best = d;
      }
      out[y * w + x] = best;
    }
  }
  return out;
}

/**
 * Turns the land tiles with the highest `score` into Bush until `cover` of the Land tiles are Bush. Exact count,
 * ties broken by index, so cover is stable.
 */
export function plantBush(k: GenKit, cover: number, score: (x: number, y: number) => number): void {
  const cand: { i: number; v: number }[] = [];
  for (let y = 0; y < k.h; y++) {
    for (let x = 0; x < k.w; x++) {
      const i = y * k.w + x;
      if (k.grid.kind[i] === TileKind.Land) cand.push({ i, v: score(x, y) + (k.rng.next() - 0.5) * 0.04 });
    }
  }
  cand.sort((a, b) => b.v - a.v || a.i - b.i);
  const n = Math.round(cand.length * cover);
  for (let c = 0; c < n; c++) {
    const e = cand[c];
    if (e) k.grid.kind[e.i] = TileKind.Bush;
  }
}

/**
 * Marks a 3x3 patch of open ground (Land or Bush) around the open tile nearest to (tx, ty) as significant site `id`.
 * Prefers a tile whose 4 neighbours are open too so the patch is a proper square.
 */
export function markSite(k: GenKit, tx: number, ty: number, id: number, extra?: (x: number, y: number) => boolean): void {
  const { w, h } = k;
  const open = (x: number, y: number): boolean => {
    if (!inb(k, x, y)) return false;
    const kk = at(k, x, y);
    return (kk === TileKind.Land || kk === TileKind.Bush) && (k.grid.significant[y * w + x] ?? 0) === 0;
  };
  let best: [number, number] | null = null;
  let bd = Infinity;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!open(x, y) || !open(x - 1, y) || !open(x + 1, y) || !open(x, y - 1) || !open(x, y + 1)) continue;
      if (extra && !extra(x, y)) continue;
      const d = Math.hypot(x - tx, y - ty);
      if (d < bd) { bd = d; best = [x, y]; }
    }
  }
  if (!best) return;
  for (let y = best[1] - 1; y <= best[1] + 1; y++) {
    for (let x = best[0] - 1; x <= best[0] + 1; x++) {
      if (open(x, y)) k.grid.significant[y * w + x] = id;
    }
  }
}

/** Points of a meandering centre line from the left edge to the right edge. y(x) = base + sinusoids + noise. */
export function meander(k: GenKit, y0: number, y1: number, amp: number, waves: number, noiseAmp: number): number[] {
  const out: number[] = [];
  const phase = k.rng.next() * Math.PI * 2;
  for (let x = 0; x < k.w; x++) {
    const t = x / (k.w - 1);
    const base = y0 + (y1 - y0) * (t * t * (3 - 2 * t));
    const wave = Math.sin(t * waves * Math.PI * 2 + phase) * amp * (0.6 + 0.4 * Math.sin(t * Math.PI));
    const jitter = (k.n1(x / 6, 3.7) - 0.5) * 2 * noiseAmp;
    out.push(base + wave + jitter);
  }
  return out;
}

/** Draws a 4-connected line (no diagonal gaps) from (x0,y0) to (x1,y1). */
export function line4(k: GenKit, x0: number, y0: number, x1: number, y1: number, kind: number, elev?: number): void {
  let x = Math.round(x0), y = Math.round(y0);
  const tx = Math.round(x1), ty = Math.round(y1);
  set(k, x, y, kind, elev);
  while (x !== tx || y !== ty) {
    const dx = tx - x, dy = ty - y;
    if (Math.abs(dx) >= Math.abs(dy)) x += Math.sign(dx);
    else y += Math.sign(dy);
    set(k, x, y, kind, elev);
  }
}

/** Draws a water body along a centre line `ys[x]` (one value per column) of the given half-width at each column. */
export function carveRiver(k: GenKit, ys: readonly number[], half: (x: number) => number, kind: number, elev = 0): void {
  for (let x = 0; x < k.w; x++) {
    const y = Math.round(ys[x] ?? 0);
    const prev = x > 0 ? Math.round(ys[x - 1] ?? y) : y;
    const a = Math.min(prev, y), b = Math.max(prev, y);
    const hw = Math.round(half(x));
    for (let yy = a - hw; yy <= b + hw; yy++) set(k, x, yy, kind, elev);
  }
}

/** Fills a noisy blob (ellipse warped by noise) of the given kind. Returns the tiles painted. */
export function blob(k: GenKit, cx: number, cy: number, rx: number, ry: number, kind: number, elev: number | undefined, only?: (kind: number) => boolean): number[] {
  const out: number[] = [];
  for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
    for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      if (!inb(k, x, y)) continue;
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      const wob = (k.n2(x / 2.3 + cx, y / 2.3 + cy) - 0.5) * 0.7;
      if (d + wob <= 1 && (!only || only(at(k, x, y)))) {
        set(k, x, y, kind, elev);
        out.push(y * k.w + x);
      }
    }
  }
  return out;
}
