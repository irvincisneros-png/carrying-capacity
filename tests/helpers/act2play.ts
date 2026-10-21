import { applyAction, BUILDINGS, canPlace, TileKind, tick } from '../../src/sim';
import type { BuildingId, GameState, Rotation } from '../../src/sim';
import { connectAll, connectOutcome, roadDistance } from './roads';

/** Value, in the callers' score units, of one tile of new road when two sites are otherwise alike. */
const ACT2_ROAD_WEIGHT = 0.05;
/** In Act 1 the builders score sites by distance in tiles, so a tile of new road is worth a tile of walking. */
const ACT1_ROAD_WEIGHT = 1;
import { roadAccess, roadRoute } from '../../src/sim';

export interface Placed {
  state: GameState;
  ok: boolean;
  /** The building could be placed but the road to it is not affordable yet. */
  needsFunds?: boolean;
}

/** Highest-scoring valid spot for a building (ignores funds). `score` higher = better; ties break by scan order. */
function bushIn(s: GameState, f: { x: number; y: number; w: number; h: number }): number {
  let n = 0;
  for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (s.grid.kind[y * s.grid.w + x] === 5) n++;
  return n;
}

export function bestSpot(
  state: GameState,
  id: BuildingId,
  score: (x: number, y: number, w: number, h: number) => number,
  rotations: Rotation[] = [0, 1],
  roadWeight?: number,
): { x: number; y: number; rotation: Rotation } | null {
  const rich: GameState = { ...state, budget: 1e9 };
  const cands: { x: number; y: number; rotation: Rotation; sc: number }[] = [];
  const road = roadDistance(state);
  for (let y = 0; y < state.grid.h; y++) {
    for (let x = 0; x < state.grid.w; x++) {
      for (const rotation of rotations) {
        const c = canPlace(rich, id, x, y, rotation);
        if (!c.ok) continue;
        // These careful players keep wetlands on open ground and never dig one into standing bush.
        if (id === 'wetland' && bushIn(state, c.footprint) > 0) continue;
        // Scores are in the callers' own units; a tile of new road is a small tie-breaker, so equal sites go to the one a road already reaches.
        const toRoad = road && BUILDINGS[id].needsRoad !== false ? (roadWeight ?? (state.phase === 'act1' ? ACT1_ROAD_WEIGHT : ACT2_ROAD_WEIGHT)) * Math.max(0, (road[y * state.grid.w + x] ?? 0) - 1) : 0;
        cands.push({ x, y, rotation, sc: score(x, y, c.footprint.w, c.footprint.h) - toRoad });
      }
    }
  }
  // Best score first (scan order breaks ties, as before); then the first spot a road can actually reach.
  const order = cands.map((c, i) => ({ c, i })).sort((a, b) => b.c.sc - a.c.sc || a.i - b.i);
  const checkRoad = roadAccess(state).enforced && BUILDINGS[id].needsRoad !== false;
  // In Act 2 a road through regrown bush costs bush (and a one-off CO2 release), so a careful player first looks for a site whose
  // road crosses none; only if there is no such site does it accept one that does.
  const passes = checkRoad && state.phase === 'act2' ? [false, true] : [true];
  for (const allowBush of passes) {
    for (const { c } of order) {
      if (checkRoad) {
        const r = applyAction(rich, { type: 'place', building: id, x: c.x, y: c.y, rotation: c.rotation });
        if (!r.result.ok) continue;
        const route = roadRoute(r.state, r.result.uid as number);
        if (route === null) continue;
        if (!allowBush && route.some((i) => r.state.grid.kind[i] === TileKind.Bush)) continue;
      }
      return { x: c.x, y: c.y, rotation: c.rotation };
    }
  }
  return null;
}

export function place(state: GameState, id: BuildingId, spot: { x: number; y: number; rotation: Rotation } | null): Placed {
  if (!spot) return { state, ok: false };
  const r = applyAction(state, { type: 'place', building: id, x: spot.x, y: spot.y, rotation: spot.rotation });
  if (!r.result.ok) return { state, ok: false };
  const joined = connectOutcome(r.state, r.result.uid);
  return joined.state ? { state: joined.state, ok: true } : { state, ok: false, needsFunds: joined.why === 'funds' };
}

/** Sum of a field over a rect grown by `r` tiles. */
export function fieldSum(state: GameState, field: Float32Array, x: number, y: number, w: number, h: number, r: number): number {
  const g = state.grid;
  let s = 0;
  for (let yy = Math.max(0, y - r); yy <= Math.min(g.h - 1, y + h - 1 + r); yy++) {
    for (let xx = Math.max(0, x - r); xx <= Math.min(g.w - 1, x + w - 1 + r); xx++) s += field[yy * g.w + xx] ?? 0;
  }
  return s;
}

export const count = (s: GameState, id: BuildingId): number => s.buildings.filter((b) => b.type === id).length;

export function demolishAll(state: GameState, id: BuildingId, max = 999): GameState {
  let s = state;
  let n = 0;
  for (const b of state.buildings.filter((o) => o.type === id)) {
    if (n++ >= max) break;
    const r = applyAction(s, { type: 'demolish', x: b.x, y: b.y });
    if (r.result.ok) s = r.state;
  }
  // Pulling out a rail siding or a highway can leave a neighbour without a road: a careful player re-connects what still stands.
  return connectAll(s);
}

/** Place up to n of a building at the best-scoring spots, as funds allow. */
export function placeUpTo(
  state: GameState, id: BuildingId, n: number,
  score: (x: number, y: number, w: number, h: number) => number = () => 0,
): GameState {
  let s = state;
  for (let i = 0; i < n; i++) {
    if (s.budget < BUILDINGS[id].cost) break;
    const p = place(s, id, bestSpot(s, id, score));
    if (!p.ok) break;
    s = p.state;
  }
  return s;
}

export const runYears = (s: GameState, years: number): GameState => {
  let st = s;
  for (let i = 0; i < years && st.phase === 'act2'; i++) st = tick(st, 1).state;
  return st;
};

export { TileKind };
