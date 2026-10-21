// Heightfield + tile <-> world mapping built from the simulation grid.
// World: 1 unit = 1 tile, map centred on the origin. Tile (tx, ty) covers x in [tx - W/2, tx - W/2 + 1],
// z in [ty - H/2, ty - H/2 + 1]; grid row y grows toward +z (south). Water level is y = 0.
import { TileKind, type TileGrid } from '../sim/types';
import { fbm, hash2, smoothstep } from './noise';
import type { BiomeLook } from './biome';

/** Terrain vertices per tile edge (fewer on big maps to keep the triangle budget). */
export const resFor = (w: number, h: number): number => (Math.max(w, h) > 40 ? 3 : 4);

const K = TileKind;

export function isWaterKind(k: number): boolean {
  return k === K.Sea || k === K.Reef || k === K.Estuary || k === K.River || k === K.Wetland;
}

/** Per-tile target top height (before smoothing). */
function tileHeight(k: number, elev: number, seaDist: number, x: number, y: number, dryCreeks: boolean, stage: number): number {
  switch (k) {
    case K.Wetland: return -0.17;
    case K.Pit: return stage <= 0 ? 0.04 + (hash2(x, y + 3) - 0.5) * 0.05 : stage === 1 ? 0.2 : 0.24;
    case K.Sea: return -0.32 - 1.15 * smoothstep(0, 4.5, seaDist) + (hash2(x, y) - 0.5) * 0.06;
    case K.Reef: return -0.28 + (hash2(x + 7, y) - 0.5) * 0.08;
    case K.Estuary: return -0.34;
    case K.River: return dryCreeks ? 0.13 : elev >= 1 ? -0.06 : -0.3;
    case K.Beach: return 0.07;
    case K.Rock: return elev >= 3 ? 1.55 + (fbm(x * 0.4, y * 0.4, 2) - 0.5) * 0.3 : 1.05;
    default: return elev <= 0 ? 0.18 : elev === 1 ? 0.34 : elev === 2 ? 0.7 : 1.05;
  }
}

/** One graded road centreline segment: target heights at both ends, flat corridor half-width `hw`. */
export interface RoadSeg { x0: number; z0: number; y0: number; x1: number; z1: number; y1: number; hw: number }

export class MapGeo {
  readonly w: number;
  readonly h: number;
  readonly res: number;
  readonly segX: number;
  readonly segZ: number;
  readonly vx: number;
  readonly vz: number;
  /** Vertex height grid (vx * vz). */
  readonly heights: Float32Array;
  /** Height at each tile centre (what buildings sit on). */
  readonly tileTop: Float32Array;
  /** Tile kind of the tile nearest each vertex after warping (for colours). */
  readonly seaDist: Float32Array;
  readonly kinds: Uint8Array;
  readonly stages: Uint8Array;
  readonly zones: Uint8Array;
  private th: Float32Array;
  /** Terrain heights before any road grading; `heights` = base with the graded road corridors blended in. */
  private base: Float32Array;
  private segs: RoadSeg[] = [];

  constructor(grid: TileGrid, readonly look: BiomeLook, res = 0) {
    this.w = grid.w;
    this.h = grid.h;
    this.res = res > 0 ? res : resFor(grid.w, grid.h);
    this.segX = grid.w * this.res;
    this.segZ = grid.h * this.res;
    this.vx = this.segX + 1;
    this.vz = this.segZ + 1;
    this.kinds = Uint8Array.from(grid.kind);
    this.stages = Uint8Array.from(grid.stage);
    this.zones = grid.zone ? Uint8Array.from(grid.zone) : new Uint8Array(grid.w * grid.h);
    const n = grid.w * grid.h;
    // distance (tiles, chamfer) from each sea tile to the nearest non-sea tile
    const sd = new Float32Array(n);
    const INF = 1e6;
    for (let i = 0; i < n; i++) sd[i] = grid.kind[i] === K.Sea || grid.kind[i] === K.Reef ? INF : 0;
    const W = grid.w;
    const H = grid.h;
    for (let pass = 0; pass < 2; pass++) {
      for (let yy = 0; yy < H; yy++) {
        const y = pass === 0 ? yy : H - 1 - yy;
        for (let xx = 0; xx < W; xx++) {
          const x = pass === 0 ? xx : W - 1 - xx;
          const i = y * W + x;
          let v = sd[i]!;
          if (v === 0) continue;
          const dy = pass === 0 ? -1 : 1;
          const dx = pass === 0 ? -1 : 1;
          if (x + dx >= 0 && x + dx < W) v = Math.min(v, sd[i + dx]! + 1);
          if (y + dy >= 0 && y + dy < H) {
            v = Math.min(v, sd[i + dy * W]! + 1);
            if (x + 1 < W) v = Math.min(v, sd[i + dy * W + 1]! + 1.414);
            if (x - 1 >= 0) v = Math.min(v, sd[i + dy * W - 1]! + 1.414);
          }
          sd[i] = v;
        }
      }
    }
    for (let i = 0; i < n; i++) if (sd[i]! >= INF) sd[i] = 8; // whole map sea
    this.seaDist = sd;
    this.th = new Float32Array(n);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        this.th[i] = tileHeight(grid.kind[i] ?? 0, grid.elevation[i] ?? 0, sd[i]!, x, y, look.dryCreeks, grid.stage[i] ?? 0);
      }
    }
    this.tileTop = Float32Array.from(this.th);
    this.heights = new Float32Array(this.vx * this.vz);
    for (let j = 0; j < this.vz; j++) {
      for (let i = 0; i < this.vx; i++) {
        const x = -W / 2 + i / this.res;
        const z = -H / 2 + j / this.res;
        this.heights[j * this.vx + i] = this.sampleTiles(x, z);
      }
    }
    this.base = Float32Array.from(this.heights);
  }

  /** Recompute everything from a changed grid (same size), in place so layers holding this map stay valid. */
  update(grid: TileGrid): void {
    const fresh = new MapGeo(grid, this.look, this.res);
    this.kinds.set(fresh.kinds);
    this.stages.set(fresh.stages);
    this.zones.set(fresh.zones);
    this.seaDist.set(fresh.seaDist);
    this.th.set(fresh.th);
    this.tileTop.set(fresh.tileTop);
    this.base.set(fresh.base);
    this.heights.set(fresh.base);
    this.carve(this.segs);
  }

  /** Bilinear height of the ungraded terrain (what roads are graded from). */
  baseHeightAt(x: number, z: number): number {
    const fx = Math.max(0, Math.min(this.segX - 1e-4, (x + this.w / 2) * this.res));
    const fz = Math.max(0, Math.min(this.segZ - 1e-4, (z + this.h / 2) * this.res));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const k = j * this.vx + i;
    const hs = this.base;
    return (hs[k]! + (hs[k + 1]! - hs[k]!) * tx) * (1 - tz) + (hs[k + this.vx]! + (hs[k + this.vx + 1]! - hs[k + this.vx]!) * tx) * tz;
  }

  /**
   * Grade the terrain under roads: every vertex near a road centreline segment is pulled toward the segment's
   * (linearly interpolated) target height, fully inside `hw` and fading to the surrounding terrain over `blend`.
   * Water edges and the map's outer ring (the slab wall) are left alone. Returns true when any height changed.
   */
  carve(segs: RoadSeg[], blend = 0.5): boolean {
    this.segs = segs;
    const hs = this.heights;
    const before = segs.length || this.carved ? Float32Array.from(hs) : null;
    hs.set(this.base);
    this.carved = segs.length > 0;
    if (segs.length) {
      const n = hs.length;
      const best = new Float32Array(n);
      const tgt = new Float32Array(n);
      const res = this.res;
      for (const sg of segs) {
        const R = sg.hw + blend;
        const i0 = Math.max(1, Math.floor((Math.min(sg.x0, sg.x1) - R + this.w / 2) * res));
        const i1 = Math.min(this.segX - 1, Math.ceil((Math.max(sg.x0, sg.x1) + R + this.w / 2) * res));
        const j0 = Math.max(1, Math.floor((Math.min(sg.z0, sg.z1) - R + this.h / 2) * res));
        const j1 = Math.min(this.segZ - 1, Math.ceil((Math.max(sg.z0, sg.z1) + R + this.h / 2) * res));
        const dx = sg.x1 - sg.x0;
        const dz = sg.z1 - sg.z0;
        const l2 = dx * dx + dz * dz;
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const px = -this.w / 2 + i / res;
            const pz = -this.h / 2 + j / res;
            const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - sg.x0) * dx + (pz - sg.z0) * dz) / l2)) : 0;
            const d = Math.hypot(px - (sg.x0 + dx * t), pz - (sg.z0 + dz * t));
            if (d >= R) continue;
            const wgt = 1 - smoothstep(sg.hw, R, d);
            const k = j * this.vx + i;
            if (wgt > best[k]!) {
              best[k] = wgt;
              tgt[k] = sg.y0 + (sg.y1 - sg.y0) * t;
            }
          }
        }
      }
      for (let k = 0; k < n; k++) {
        const wgt = best[k]!;
        if (wgt <= 0) continue;
        const h0 = this.base[k]!;
        if (h0 < 0.05) continue; // shoreline and water: never dig a road into the sea
        hs[k] = h0 + (Math.max(0.06, tgt[k]!) - h0) * wgt;
      }
    }
    if (!before) return false;
    for (let k = 0; k < hs.length; k++) if (Math.abs(hs[k]! - before[k]!) > 1e-5) return true;
    return false;
  }

  private carved = false;

  /** Domain warp so coastlines and river banks are organic rather than square. */
  warp(x: number, z: number, out: { x: number; z: number }): void {
    const a = 0.34;
    out.x = x + (fbm(x * 0.42 + 11.3, z * 0.42 + 2.1, 2) - 0.5) * 2 * a;
    out.z = z + (fbm(x * 0.42 - 5.7, z * 0.42 + 9.9, 2) - 0.5) * 2 * a;
  }

  private _w = { x: 0, z: 0 };

  /** Tile-space plateau interpolation of tile heights at a world point (flat tile centres, smooth ramps). */
  private sampleTiles(x: number, z: number): number {
    const W = this.w;
    const H = this.h;
    // keep the outer rim unwarped so the slab edge stays straight
    const edge = Math.min(x + W / 2, W / 2 - x, z + H / 2, H / 2 - z);
    this.warp(x, z, this._w);
    const t = smoothstep(0.0, 0.8, edge);
    const wx = x + (this._w.x - x) * t;
    const wz = z + (this._w.z - z) * t;
    const u = Math.max(0, Math.min(W - 1, wx + W / 2 - 0.5));
    const v = Math.max(0, Math.min(H - 1, wz + H / 2 - 0.5));
    const i0 = Math.min(W - 2, Math.floor(u));
    const j0 = Math.min(H - 2, Math.floor(v));
    const fu = plateau(u - i0);
    const fv = plateau(v - j0);
    const a = this.th[j0 * W + i0]!;
    const b = this.th[j0 * W + i0 + 1]!;
    const c = this.th[(j0 + 1) * W + i0]!;
    const d = this.th[(j0 + 1) * W + i0 + 1]!;
    let hgt = (a + (b - a) * fu) * (1 - fv) + (c + (d - c) * fu) * fv;
    if (hgt > 0.12) hgt += (fbm(x * 0.7 + 3, z * 0.7 - 1, 3) - 0.5) * (this.look.id === 'urban' ? 0.025 : 0.07);
    return hgt;
  }

  /** Bilinear height of the terrain mesh at a world point. */
  heightAt(x: number, z: number): number {
    const fx = Math.max(0, Math.min(this.segX - 1e-4, (x + this.w / 2) * this.res));
    const fz = Math.max(0, Math.min(this.segZ - 1e-4, (z + this.h / 2) * this.res));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const k = j * this.vx + i;
    const hs = this.heights;
    const a = hs[k]!;
    const b = hs[k + 1]!;
    const c = hs[k + this.vx]!;
    const d = hs[k + this.vx + 1]!;
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  }

  /** World x of a tile's centre. */
  cx(tx: number): number { return tx - this.w / 2 + 0.5; }
  cz(ty: number): number { return ty - this.h / 2 + 0.5; }
  /** Tile coordinate containing a world point (may be out of range). */
  tileX(x: number): number { return Math.floor(x + this.w / 2); }
  tileY(z: number): number { return Math.floor(z + this.h / 2); }
  inBounds(tx: number, ty: number): boolean { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }

  /** Height a building with this footprint stands on (mean of tile centres, never below water). */
  padHeight(x: number, y: number, w: number, h: number, onWater: boolean): number {
    if (onWater) return 0;
    let s = 0;
    let n = 0;
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (!this.inBounds(xx, yy)) continue;
        s += this.heightAt(this.cx(xx), this.cz(yy));
        n++;
      }
    }
    return Math.max(0.04, n ? s / n : 0.3);
  }
}

function plateau(f: number): number {
  return smoothstep(0.2, 0.8, f);
}

/** Signature of everything that shapes the terrain mesh (kinds except bush/land, pit stages, zones). */
export function terrainSignature(grid: TileGrid): number {
  let h = 2166136261;
  const n = grid.kind.length;
  for (let i = 0; i < n; i++) {
    let k = grid.kind[i] ?? 0;
    if (k === K.Bush) k = K.Land;
    const st = k === K.Pit ? (grid.stage[i] ?? 0) : 0;
    const z = grid.zone ? (grid.zone[i] ?? 0) : 0;
    h = Math.imul(h ^ (k | (st << 4) | (z << 8)), 16777619);
  }
  return h >>> 0;
}
