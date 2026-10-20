import { advanceDecade, applyAction, canPlace, TileKind } from '../../src/sim';
import type { BuildingId, DecadeReport, GameState, Rotation } from '../../src/sim';

export interface Spot {
  x: number;
  y: number;
  rotation: Rotation;
}

/** Hub = middle of the estuary, where the town grows from. */
export function hubOf(state: GameState): { x: number; y: number } {
  const g = state.grid;
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.kind[y * g.w + x] === TileKind.Estuary) { sx += x; sy += y; n++; }
    }
  }
  return n > 0 ? { x: sx / n, y: sy / n } : { x: g.w / 2, y: g.h / 2 };
}

/** First valid spot ordered by distance to the hub ('near') or farthest from it ('far'). Ignores funds. */
export function findSpot(
  state: GameState,
  id: BuildingId,
  prefer: 'near' | 'far' = 'near',
  rotations: Rotation[] = [0, 1],
): Spot | null {
  const hub = hubOf(state);
  let best: Spot | null = null;
  let bestScore = Infinity;
  const rich: GameState = { ...state, budget: 1e9 };
  for (let y = 0; y < state.grid.h; y++) {
    for (let x = 0; x < state.grid.w; x++) {
      for (const rotation of rotations) {
        if (!canPlace(rich, id, x, y, rotation).ok) continue;
        const d = Math.hypot(x - hub.x, y - hub.y);
        const score = prefer === 'near' ? d : -d;
        if (score < bestScore) { bestScore = score; best = { x, y, rotation }; }
      }
    }
  }
  return best;
}

/** Try to build `count` of a building; returns how many were placed (stops at funds / no spot). */
export function buildN(
  state: GameState,
  id: BuildingId,
  count: number,
  prefer: 'near' | 'far' = 'near',
): { state: GameState; built: number } {
  let s = state;
  let built = 0;
  for (let i = 0; i < count; i++) {
    const spot = findSpot(s, id, prefer);
    if (!spot) break;
    const r = applyAction(s, { type: 'place', building: id, x: spot.x, y: spot.y, rotation: spot.rotation });
    if (!r.result.ok) break;
    s = r.state;
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
