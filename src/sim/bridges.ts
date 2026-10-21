/**
 * Bridges. A bridge is a road building on a River (creek) tile: it costs more than a road, runs straight, spans at most
 * BRIDGE_SPAN_MAX tiles of water and lands on open ground at both ends. The water underneath is untouched (flow, pollution,
 * fish, wetlands are all unchanged), and the road network crosses it like any other road tile. Sea, reef and estuary
 * tiles cannot be bridged.
 */
import { TileKind } from './types';
import type { GameState } from './types';

export const BRIDGE_SPAN_MAX = 3;
/** A bridge tile costs this many road tiles. */
export const BRIDGE_COST_MULT = 6;
export const MSG_SPAN = 'Bridges can span at most 3 tiles of water';
export const MSG_STRAIGHT = 'A bridge must run straight across';
export const MSG_ENDS = 'A bridge must run straight across to open ground at both ends';
export const MSG_KIND = 'Bridges can only cross a river or creek, not the sea or the estuary';

/** 0 = horizontal (x), 1 = vertical (y). */
export type Axis = 0 | 1;
type Grid = GameState['grid'];

const isLandEnd = (k: number | undefined): boolean => k === TileKind.Land || k === TileKind.Bush;

/** Tiles of River in a straight line through tile i along an axis, and whether both ends are open ground. */
export function spanAlong(g: Grid, i: number, axis: Axis): { len: number; ends: boolean } {
  const x = i % g.w, y = Math.floor(i / g.w);
  const dx = axis === 0 ? 1 : 0, dy = axis === 1 ? 1 : 0;
  let len = 1;
  let ends = true;
  for (const s of [-1, 1]) {
    let xx = x + dx * s, yy = y + dy * s;
    for (;;) {
      if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) { ends = false; break; }
      const k = g.kind[yy * g.w + xx];
      if (k === TileKind.River) { len++; xx += dx * s; yy += dy * s; if (len > 12) { ends = false; break; } continue; }
      if (!isLandEnd(k)) ends = false;
      break;
    }
  }
  return { len, ends };
}

/** Axes along which river tile i could carry a bridge (short enough, open ground at both ends). */
export function bridgeAxes(g: Grid, i: number): Axis[] {
  const out: Axis[] = [];
  for (const a of [0, 1] as const) {
    const s = spanAlong(g, i, a);
    if (s.ends && s.len <= BRIDGE_SPAN_MAX) out.push(a);
  }
  return out;
}

/** Does a bridge (road building) stand on tile j? */
export function isBridgeTile(state: GameState, j: number): boolean {
  const g = state.grid;
  if (g.kind[j] !== TileKind.River) return false;
  const uid = g.building[j] ?? 0;
  if (uid === 0) return false;
  return state.buildings.some((b) => b.uid === uid && b.type === 'road');
}

/** Why a bridge cannot go on tile (x, y), or null when it can (terrain and shape only, not money). */
export function bridgeProblem(state: GameState, x: number, y: number): string | null {
  const g = state.grid;
  const i = y * g.w + x;
  if (g.kind[i] !== TileKind.River) return MSG_KIND;
  const axes = bridgeAxes(g, i);
  if (axes.length === 0) {
    const h = spanAlong(g, i, 0), v = spanAlong(g, i, 1);
    return Math.min(h.len, v.len) > BRIDGE_SPAN_MAX ? MSG_SPAN : MSG_ENDS;
  }
  // A bridge runs straight: a neighbouring bridge tile must share a span axis with this one, either carrying on along it or as a
  // second lane beside it. Two tiles that could only be crossed in different directions would make a bend.
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
    const j = yy * g.w + xx;
    if (!isBridgeTile(state, j)) continue;
    if (!bridgeAxes(g, j).some((t) => axes.includes(t))) return MSG_STRAIGHT;
  }
  return null;
}

/** Static (money-free, building-free) test used by route finding: could a bridge tile ever stand here, heading along `axis`? */
export function bridgeOkAlong(g: Grid, i: number, axis: Axis): boolean {
  return g.kind[i] === TileKind.River && bridgeAxes(g, i).includes(axis);
}
