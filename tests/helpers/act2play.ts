import { applyAction, BUILDINGS, canPlace, TileKind, tick } from '../../src/sim';
import type { BuildingId, GameState, Rotation } from '../../src/sim';

export interface Placed {
  state: GameState;
  ok: boolean;
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
): { x: number; y: number; rotation: Rotation } | null {
  const rich: GameState = { ...state, budget: 1e9 };
  let best: { x: number; y: number; rotation: Rotation } | null = null;
  let bestScore = -Infinity;
  for (let y = 0; y < state.grid.h; y++) {
    for (let x = 0; x < state.grid.w; x++) {
      for (const rotation of rotations) {
        const c = canPlace(rich, id, x, y, rotation);
        if (!c.ok) continue;
        // These careful players keep wetlands on open ground and never dig one into standing bush.
        if (id === 'wetland' && bushIn(state, c.footprint) > 0) continue;
        const sc = score(x, y, c.footprint.w, c.footprint.h);
        if (sc > bestScore) { bestScore = sc; best = { x, y, rotation }; }
      }
    }
  }
  return best;
}

export function place(state: GameState, id: BuildingId, spot: { x: number; y: number; rotation: Rotation } | null): Placed {
  if (!spot) return { state, ok: false };
  const r = applyAction(state, { type: 'place', building: id, x: spot.x, y: spot.y, rotation: spot.rotation });
  return r.result.ok ? { state: r.state, ok: true } : { state, ok: false };
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
  return s;
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
