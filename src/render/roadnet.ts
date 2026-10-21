// Road / rail network on the heightfield: a gentle grade along each connected run of tiles, and the centreline
// segments the terrain is graded to (MapGeo.carve). Pure geometry, no three.js objects.
import type { MapGeo, RoadSeg } from './mapgeo';

export type RoadFamily = 'road' | 'rail';

export interface RoadTile {
  tx: number;
  ty: number;
  fam: RoadFamily;
  /** connection mask: bit i = neighbour in DIRS[i] (+z, +x, -z, -x) */
  mask: number;
  dirt: boolean;
  /** A bridge: a road tile over a creek or river (the deck is graded between its two banks, not draped on the riverbed). */
  bridge?: boolean;
  /** Bit i set when the neighbour in DIRS[i] is a bridge tile (this tile's arm that way meets a bridge deck). */
  bridgeMask?: number;
}

/** Deck heights of one bridge tile (graded centre heights, no asphalt lift): at the two tile edges and the centre. */
export interface Deck {
  /** 0: runs along x (dirs 3 -> 1), 1: runs along z (dirs 2 -> 0) */
  ax: 0 | 1;
  /** height at the -axis edge, the centre, the +axis edge */
  a: number;
  c: number;
  b: number;
}

/** Hump the deck rises above the straight line between its banks, so it clears the water. */
export const BRIDGE_CAMBER = 0.07;

/** The surface of a road tile's edge in direction `dir` is fixed to world height `y` (a suburb street mouth). */
export interface RoadPin {
  tx: number;
  ty: number;
  dir: number;
  y: number;
}

export const DIRS: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
/** Asphalt / ballast sits this far above the graded terrain (the road mesh adds it; pins subtract it). */
export const ASPHALT_LIFT = 0.04;
/** Flat corridor half-width (world units) graded under each family: just wider than the kerb / ballast. */
export const HALF_WIDTH: Record<RoadFamily, number> = { road: 0.3, rail: 0.24 };

const MAX_DEV = 0.3; // never cut or fill the road more than this from the natural ground
const PASSES = 10;

export interface GradeResult {
  /** graded centre height per tile (key ty * W + tx) */
  heights: Map<number, number>;
  segs: RoadSeg[];
  /** bridge decks by tile key */
  decks: Map<number, Deck>;
}

const RIVER = 3; // TileKind.River

/** Which way a bridge tile runs: along its road connections, else along the axis that lands on open ground. */
function bridgeAxis(map: MapGeo, t: RoadTile): 0 | 1 {
  const mx = (t.mask & 0b1010) !== 0, mz = (t.mask & 0b0101) !== 0;
  if (mx && !mz) return 0;
  if (mz && !mx) return 1;
  const run = (ax: 0 | 1): number => {
    let len = 1;
    for (const sgn of [-1, 1]) {
      for (let k = 1; k < 8; k++) {
        const x = t.tx + (ax === 0 ? sgn * k : 0), y = t.ty + (ax === 1 ? sgn * k : 0);
        if (!map.inBounds(x, y)) return 99;
        const kd = map.kinds[y * map.w + x];
        if (kd !== RIVER) { if (kd !== 4 && kd !== 5) return 99; break; }
        len++;
      }
    }
    return len;
  };
  return run(0) <= run(1) ? 0 : 1;
}

/**
 * Smooth tile-centre heights along connected road tiles (so a terrace step is spread over several tiles into a
 * steady grade), keeping pinned edges exactly where the buildings they join need them, then emit the centreline
 * segments (tile to tile, and tile to pinned edge) the terrain is blended toward.
 */
export function gradeRoads(map: MapGeo, tiles: RoadTile[], pins: RoadPin[]): GradeResult {
  const W = map.w;
  const key = (tx: number, ty: number): number => ty * W + tx;
  const idx = new Map<number, number>();
  tiles.forEach((t, i) => idx.set(key(t.tx, t.ty), i));
  const n = tiles.length;
  const h0 = new Float32Array(n);
  const axes: (0 | 1)[] = [];
  const nb: number[][] = [];
  const pinned: number[][] = []; // pinned edge heights per tile
  for (let i = 0; i < n; i++) {
    const t = tiles[i]!;
    h0[i] = Math.max(0.06, map.baseHeightAt(map.cx(t.tx), map.cz(t.ty)));
    axes.push(0);
    if (t.bridge) {
      // The deck is level with the banks it joins: straight between the ground at each end, with a small hump to clear the water.
      const ax = bridgeAxis(map, t);
      axes[i] = ax;
      const ends: { d: number; h: number }[] = [];
      for (const sgn of [-1, 1]) {
        for (let k = 1; k < 10; k++) {
          const x = t.tx + (ax === 0 ? sgn * k : 0), y = t.ty + (ax === 1 ? sgn * k : 0);
          if (!map.inBounds(x, y)) break;
          if (map.kinds[y * map.w + x] === RIVER) continue;
          ends.push({ d: k, h: Math.max(0.06, map.baseHeightAt(map.cx(x), map.cz(y))) });
          break;
        }
      }
      const e0 = ends[0], e1 = ends[1];
      h0[i] = (e0 && e1 ? (e0.h * e1.d + e1.h * e0.d) / (e0.d + e1.d) : e0 ? e0.h : e1 ? e1.h : 0.2) + BRIDGE_CAMBER;
    }
    const list: number[] = [];
    for (let d = 0; d < 4; d++) {
      if (!(t.mask & (1 << d))) continue;
      const j = idx.get(key(t.tx + DIRS[d]![0], t.ty + DIRS[d]![1]));
      if (j !== undefined && tiles[j]!.fam === t.fam) list.push(j);
    }
    nb.push(list);
    pinned.push([]);
  }
  for (const p of pins) {
    const i = idx.get(key(p.tx, p.ty));
    if (i !== undefined) pinned[i]!.push(p.y);
  }
  let h = Float32Array.from(h0);
  let nx = new Float32Array(n);
  for (let pass = 0; pass < PASSES; pass++) {
    for (let i = 0; i < n; i++) {
      let sum = h[i]!;
      let cnt = 1;
      for (const j of nb[i]!) { sum += h[j]!; cnt++; }
      for (const y of pinned[i]!) { sum += y; cnt++; }
      const v = sum / cnt;
      nx[i] = Math.max(h0[i]! - MAX_DEV, Math.min(h0[i]! + MAX_DEV, v));
    }
    [h, nx] = [nx, h];
  }
  const heights = new Map<number, number>();
  const decks = new Map<number, Deck>();
  const segs: RoadSeg[] = [];
  for (let i = 0; i < n; i++) {
    const t = tiles[i]!;
    const k = key(t.tx, t.ty);
    heights.set(k, h[i]!);
    if (t.bridge) {
      const ax = axes[i]!;
      const lo = ax === 0 ? DIRS[3]! : DIRS[2]!;
      const hi = ax === 0 ? DIRS[1]! : DIRS[0]!;
      const edge = (d: readonly [number, number]): number => {
        const j = idx.get(key(t.tx + d[0], t.ty + d[1]));
        const hn = j !== undefined ? h[j]! : Math.max(0.06, map.baseHeightAt(map.cx(t.tx + d[0]), map.cz(t.ty + d[1])));
        return (h[i]! + hn) / 2;
      };
      decks.set(k, { ax, a: edge(lo), c: h[i]!, b: edge(hi) });
    }
    const hw = HALF_WIDTH[t.fam];
    const cx = map.cx(t.tx);
    const cz = map.cz(t.ty);
    if (!nb[i]!.length && !pinned[i]!.length) segs.push({ x0: cx, z0: cz, y0: h[i]!, x1: cx, z1: cz, y1: h[i]!, hw });
    for (const j of nb[i]!) {
      if (j < i) continue; // each tile pair once
      const u = tiles[j]!;
      segs.push({ x0: cx, z0: cz, y0: h[i]!, x1: map.cx(u.tx), z1: map.cz(u.ty), y1: h[j]!, hw });
    }
  }
  for (const p of pins) {
    const i = idx.get(key(p.tx, p.ty));
    if (i === undefined) continue;
    const t = tiles[i]!;
    const d = DIRS[p.dir]!;
    const cx = map.cx(t.tx);
    const cz = map.cz(t.ty);
    segs.push({ x0: cx, z0: cz, y0: h[i]!, x1: cx + d[0] * 0.5, z1: cz + d[1] * 0.5, y1: p.y, hw: HALF_WIDTH[t.fam] });
  }
  return { heights, segs, decks };
}
