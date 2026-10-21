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
}

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
  const nb: number[][] = [];
  const pinned: number[][] = []; // pinned edge heights per tile
  for (let i = 0; i < n; i++) {
    const t = tiles[i]!;
    h0[i] = Math.max(0.06, map.baseHeightAt(map.cx(t.tx), map.cz(t.ty)));
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
  const segs: RoadSeg[] = [];
  for (let i = 0; i < n; i++) {
    const t = tiles[i]!;
    const k = key(t.tx, t.ty);
    heights.set(k, h[i]!);
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
  return { heights, segs };
}
