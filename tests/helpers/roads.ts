/**
 * Road helpers for the scripted players. Since roads matter (WP3), a building only works once a road joins it to the
 * town's entrance, so every scripted player connects what it builds with `connectToEntrance`: the shortest road path,
 * paid for at the road's price like any player would.
 */
import { applyAction, availability, BRIDGE_COST_MULT, roadAccess, roadRoute, TileKind } from '../../src/sim';
import type { GameState } from '../../src/sim';

/** Money the shortest road to the entrance would cost (0 if already connected, Infinity if there is no route). */
export function connectionCost(state: GameState, uid: number): number {
  if (!roadAccess(state).enforced) return 0;
  const route = roadRoute(state, uid);
  if (route === null) return Infinity;
  const one = availability(state.scenarioId, 'road').cost;
  // a road tile over a creek is a bridge, which costs BRIDGE_COST_MULT times as much
  return route.reduce((sum, i) => sum + one * (state.grid.kind[i] === TileKind.River ? BRIDGE_COST_MULT : 1), 0);
}

/**
 * Lays the shortest road path from the entrance's network to building `uid`, paying the road cost. Stops quietly
 * when the money runs out (the building then stays unconnected), so callers that must not leave a building dead
 * should check `connectionCost` first (placeConnected does).
 */
export function connectToEntrance(state: GameState, uid: number): GameState {
  const route = roadRoute(state, uid);
  if (!route) return state;
  const g = state.grid;
  let s = state;
  for (const i of route) {
    const r = applyAction(s, { type: 'place', building: 'road', x: i % g.w, y: Math.floor(i / g.w) });
    if (!r.result.ok) break;
    s = r.state;
  }
  return s;
}

/** Connects every building that still has no road (cheapest first is not needed: routes share tiles). */
export function connectAll(state: GameState): GameState {
  let s = state;
  for (let guard = 0; guard < 500; guard++) {
    const acc = roadAccess(s);
    let moved = false;
    for (const uid of acc.unconnected) {
      const next = connectToEntrance(s, uid);
      if (next !== s) { s = next; moved = true; break; }
    }
    if (!moved) return s;
  }
  return s;
}

/**
 * For a placement that was just made (state `after`, building `uid`): joins it to the entrance. Fails with 'funds' when the
 * road is more than the money left (the caller should wait, not give up on the building) or 'route' when no road can reach
 * it (the caller should treat the spot as unusable).
 */
export function connectOutcome(after: GameState, uid: number | undefined): { state: GameState | null; why?: 'funds' | 'route' } {
  if (uid === undefined) return { state: after };
  const cost = connectionCost(after, uid);
  if (cost === Infinity) return { state: null, why: 'route' };
  if (after.budget < cost) return { state: null, why: 'funds' };
  return { state: connectToEntrance(after, uid) };
}

export function connectedOrNull(after: GameState, uid: number | undefined): GameState | null {
  return connectOutcome(after, uid).state;
}

/**
 * Distance in tiles (straight lines, ignoring terrain) from every tile to the nearest road joined to an entrance. Scripted
 * players use it to prefer building along roads, as a sensible player would, instead of paying for a long new road.
 * Returns null when roads are not enforced (unit-test sandboxes).
 */
export function roadDistance(state: GameState): Int16Array | null {
  const acc = roadAccess(state);
  if (!acc.enforced) return null;
  const g = state.grid;
  const dist = new Int16Array(g.w * g.h).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < dist.length; i++) if ((acc.reached[i] ?? 0) !== 0) { dist[i] = 0; queue.push(i); }
  for (let qh = 0; qh < queue.length; qh++) {
    const i = queue[qh] as number;
    const x = i % g.w, y = Math.floor(i / g.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
      const j = ny * g.w + nx;
      if (dist[j] === -1) { dist[j] = (dist[i] as number) + 1; queue.push(j); }
    }
  }
  return dist;
}
