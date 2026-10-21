import { advanceDecade, applyAction, BUILDINGS, canPlace, TileKind } from '../../src/sim';
import type { BuildingId, DecadeReport, GameState, Rotation } from '../../src/sim';
import { connectionCost, connectOutcome, roadDistance } from './roads';

export interface Spot {
  x: number;
  y: number;
  rotation: Rotation;
}

/** Hub = middle of the estuary, where the town grows from. */
export function hubOf(state: GameState): { x: number; y: number } {
  const g = state.grid;
  const centroid = (kind: number): { x: number; y: number } | null => {
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        if (g.kind[y * g.w + x] === kind) { sx += x; sy += y; n++; }
      }
    }
    return n > 0 ? { x: sx / n, y: sy / n } : null;
  };
  // The town grows from the estuary, the river (River Town), the waterhole (Red Dirt) or the middle of the map.
  const order = state.scenarioId === 'river-town' ? [TileKind.River] : [TileKind.Estuary, TileKind.Wetland, TileKind.River];
  for (const k of order) {
    const c = centroid(k);
    if (c) return c;
  }
  return { x: g.w / 2, y: g.h / 2 };
}

/** How many tiles of hub distance one tile of new road is worth to the scripted players when they choose a site. */
const ROAD_WEIGHT = 1;
/** Road weights at or above this belong to the careful players, who also keep power-using buildings back from the beach. */
const CAREFUL_WEIGHT = 3;
const BEACH_PENALTY = 6;

/** First valid spot ordered by distance to the hub ('near') or farthest from it ('far'). Ignores funds. */
export function findSpot(
  state: GameState,
  id: BuildingId,
  prefer: 'near' | 'far' = 'near',
  rotations: Rotation[] = [0, 1],
  roadWeight = ROAD_WEIGHT,
): Spot | null {
  const hub = hubOf(state);
  const cands: { spot: Spot; score: number }[] = [];
  const rich: GameState = { ...state, budget: 1e9 };
  const road = roadDistance(state);
  // A careful player keeps lit buildings back from a nesting beach (street lights confuse hatchlings).
  const g0 = state.grid;
  const beachZone = new Uint8Array(g0.w * g0.h);
  if (roadWeight >= CAREFUL_WEIGHT) {
    for (let i = 0; i < g0.kind.length; i++) {
      if (g0.kind[i] !== TileKind.Beach) continue;
      const bx = i % g0.w, by = Math.floor(i / g0.w);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = bx + dx, yy = by + dy;
        if (xx >= 0 && yy >= 0 && xx < g0.w && yy < g0.h) beachZone[yy * g0.w + xx] = 1;
      }
    }
  }
  for (let y = 0; y < state.grid.h; y++) {
    for (let x = 0; x < state.grid.w; x++) {
      for (const rotation of rotations) {
        if (!canPlace(rich, id, x, y, rotation).ok) continue;
        // A sensible player builds along existing roads instead of paying for a long new one.
        const d = Math.hypot(x - hub.x, y - hub.y);
        const toRoad = road ? roadWeight * Math.max(0, (road[y * state.grid.w + x] ?? 0) - 1) : 0;
        const lit = beachZone[y * g0.w + x] === 1 && BUILDINGS[id].power < 0 ? BEACH_PENALTY : 0;
        cands.push({ spot: { x, y, rotation }, score: (prefer === 'near' ? d : -d) + toRoad + lit });
      }
    }
  }
  // Lowest score first (scan order breaks ties); then the first spot a road can actually reach.
  const order = cands.map((c, i) => ({ c, i })).sort((a, b) => a.c.score - b.c.score || a.i - b.i);
  const checkRoad = road !== null && BUILDINGS[id].needsRoad !== false;
  for (const { c } of order) {
    if (checkRoad) {
      const r = applyAction(rich, { type: 'place', building: id, x: c.spot.x, y: c.spot.y, rotation: c.spot.rotation });
      if (!r.result.ok || connectionCost(r.state, r.result.uid as number) === Infinity) continue;
    }
    return c.spot;
  }
  return null;
}

/** Try to build `count` of a building; returns how many were placed (stops at funds / no spot). */
export function buildN(
  state: GameState,
  id: BuildingId,
  count: number,
  prefer: 'near' | 'far' = 'near',
  roadWeight = ROAD_WEIGHT,
): { state: GameState; built: number; needsFunds?: boolean } {
  let s = state;
  let built = 0;
  for (let i = 0; i < count; i++) {
    const spot = findSpot(s, id, prefer, [0, 1], roadWeight);
    if (!spot) break;
    const r = applyAction(s, { type: 'place', building: id, x: spot.x, y: spot.y, rotation: spot.rotation });
    if (!r.result.ok) break;
    const joined = connectOutcome(r.state, r.result.uid);
    if (!joined.state) return { state: s, built, needsFunds: joined.why === 'funds' };
    s = joined.state;
    built++;
  }
  return { state: s, built };
}

export type Plan = (state: GameState) => GameState;

export interface RunResult {
  state: GameState;
  reports: DecadeReport[];
}

/** Runs plan -> advance until the act completes. */
export function runScript(start: GameState, plan: Plan): RunResult {
  let s = start;
  const reports: DecadeReport[] = [];
  let guard = 0;
  while (s.status === 'playing' && guard++ < 50) {
    s = plan(s);
    const r = advanceDecade(s);
    s = r.state;
    if (r.report) reports.push(r.report);
  }
  return { state: s, reports };
}

export function countOf(state: GameState, id: BuildingId): number {
  return state.buildings.filter((b) => b.type === id).length;
}

/** Build up to `target` of `id` in total (counting existing), capped per call by `max`. */
export function topUp(
  state: GameState,
  id: BuildingId,
  target: number,
  prefer: 'near' | 'far' = 'near',
): GameState {
  const need = target - countOf(state, id);
  return need > 0 ? buildN(state, id, need, prefer).state : state;
}
