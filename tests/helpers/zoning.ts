/**
 * Zoning helpers for the scripted players. Homes, shops and light industry are zoned and grow by themselves from demand
 * (src/sim/zoning.ts), so a scripted player no longer places cottages or suburbs: it paints zones beside the roads it has and
 * lets the town grow into them, laying a short road spur when it runs out of zonable land.
 */
import { applyAction, BUILDINGS, roadAccess, TileKind, zoneProblem, ZONE_REACH } from '../../src/sim';
import type { GameState, ZoneKind } from '../../src/sim';
import { roadDistance } from './roads';

export interface Rect { x: number; y: number; w: number; h: number }

/** Paints one zone over a rectangle (the same action the drag tool sends). Returns the new state, or the old one if nothing was zoned. */
export function zoneArea(state: GameState, rect: Rect, kind: ZoneKind): GameState {
  const r = applyAction(state, { type: 'zone', x: rect.x, y: rect.y, w: rect.w, h: rect.h, zone: kind });
  return r.result.ok ? r.state : state;
}

const family = (k: number): number => (k >= 1 && k <= 3 ? 1 : k);

/** Zoned tiles of this family with nothing grown on them yet. */
export function emptyZoned(s: GameState, kind: ZoneKind): number {
  const g = s.grid;
  let n = 0;
  for (let i = 0; i < g.zoning.length; i++) if (family(g.zoning[i] ?? 0) === family(kind) && (g.building[i] ?? 0) === 0) n++;
  return n;
}

/** Tiles zoned in this family (grown or not). */
export function zonedTiles(s: GameState, kind: ZoneKind): number {
  let n = 0;
  for (const z of s.grid.zoning) if (family(z) === family(kind)) n++;
  return n;
}

export const grownOf = (s: GameState, kind?: ZoneKind): number =>
  s.buildings.filter((b) => b.grown && (kind === undefined || family(zoneOfType(b.type)) === family(kind))).length;

function zoneOfType(t: string): number {
  return t === 'zres1' ? 1 : t === 'zres2' ? 2 : t === 'zres3' ? 3 : t === 'zcom' ? 4 : t === 'zind' ? 5 : 0;
}

export interface ZoneOpts {
  /** Score a candidate tile (higher is better). Default: nearest the hub. */
  score?: (x: number, y: number) => number;
  /** Bush tiles are skipped unless this is set (a careful player zones cleared land first). */
  bush?: boolean;
  /** Keep this many tiles away from tiles already zoned for another family (industry sits apart from homes). */
  apart?: number;
}

/**
 * Keeps at least `want` empty tiles zoned for `kind`, zoning the best free tiles within reach of a connected road (one action per
 * run of tiles in a row, as a player dragging along a street would). Returns the new state.
 */
export function keepZoned(state: GameState, kind: ZoneKind, want: number, opts: ZoneOpts = {}): GameState {
  let s = state;
  const short = want - emptyZoned(s, kind);
  if (short <= 0) return s;
  const g = s.grid;
  const acc = roadAccess(s);
  const road = roadDistance(s);
  const score = opts.score ?? (() => 0);
  const cands: { i: number; sc: number }[] = [];
  const otherFam = new Uint8Array(g.w * g.h);
  if (opts.apart) {
    for (let i = 0; i < g.zoning.length; i++) {
      const z = g.zoning[i] ?? 0;
      if (z === 0 || family(z) === family(kind)) continue;
      const x = i % g.w, y = Math.floor(i / g.w);
      for (let dy = -opts.apart; dy <= opts.apart; dy++) for (let dx = -opts.apart; dx <= opts.apart; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < g.w && yy < g.h) otherFam[yy * g.w + xx] = 1;
      }
    }
  }
  for (let i = 0; i < g.kind.length; i++) {
    if ((g.zoning[i] ?? 0) !== 0 || (g.building[i] ?? 0) !== 0) continue;
    if (!opts.bush && g.kind[i] === TileKind.Bush) continue;
    if (otherFam[i] === 1) continue;
    // Within reach of a road that is joined to the entrance (the tile can grow, not just be zoned).
    if (acc.enforced && road && (road[i] ?? 99) > ZONE_REACH) continue;
    const x = i % g.w, y = Math.floor(i / g.w);
    if (zoneProblem(s, x, y, kind) !== null) continue;
    cands.push({ i, sc: score(x, y) });
  }
  cands.sort((a, b) => b.sc - a.sc || a.i - b.i);
  let need = short;
  for (const c of cands) {
    if (need <= 0) break;
    if ((s.grid.zoning[c.i] ?? 0) !== 0) continue;
    const x = c.i % g.w, y = Math.floor(c.i / g.w);
    // Extend along the row while the next tiles are also good candidates (one drag paints them all).
    let w = 1;
    while (w < need && x + w < g.w && zoneProblem(s, x + w, y, kind) === null && (s.grid.zoning[c.i + w] ?? 0) === 0
      && (opts.bush || g.kind[c.i + w] !== TileKind.Bush) && otherFam[c.i + w] !== 1 && (!road || (road[c.i + w] ?? 99) <= ZONE_REACH)) w++;
    const before = emptyZoned(s, kind);
    const next = zoneArea(s, { x, y, w, h: 1 }, kind);
    if (next === s) continue;
    s = next;
    need -= emptyZoned(s, kind) - before;
  }
  return s;
}

/** Population the town's homes hold right now (grown and placed). */
export const housingOf = (s: GameState): number => s.buildings.reduce((a, b) => a + BUILDINGS[b.type].housing, 0);
