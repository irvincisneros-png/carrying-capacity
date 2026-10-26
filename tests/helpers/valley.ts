/** Scripted players for Green Valley: one that follows the tutorial's steps, one that builds the town and then walks away. */
import { advanceDecade, applyAction, BUILDINGS, canPlace, createGame, startAct2, tick, tutorialStatus, TileKind, ZONE } from '../../src/sim';
import type { BuildingId, GameState } from '../../src/sim';
import { fieldSum } from './act2play';
import { gridHoldsWithout } from './goodplay';
import { connectAll } from './roads';
import { emptyZoned, housingOf, keepZoned, zonedTiles } from './zoning';
import { answerPrompts, bestSpot, disposeLegacy, greenGridStep, nearTiles, place, queuePlan } from './scen';
import type { QueueWant } from './scen';

const VALLEY_IDLE_QUEUE: QueueWant[] = [
  { id: 'farm', max: 3 },
  { id: 'factory', max: 2 },
  { id: 'coalpower', max: 1 },
  { id: 'coalmine', max: 1 },
  { id: 'landfill', max: 1 },
  { id: 'carpark', max: 2 },
];

export function valleyAct1Idle(): GameState {
  const plan = queuePlan(VALLEY_IDLE_QUEUE, 1.0);
  let s = createGame('green-valley');
  while (s.status === 'playing') s = advanceDecade(plan(s)).state;
  return s;
}

function placeBest(
  s: GameState, id: BuildingId, score: (x: number, y: number, w: number, h: number) => number = () => 0, connect = true,
): GameState | null {
  if (!connect) {
    // Exactly what the step says and no more: a building with no road to it yet (the road step comes next).
    // ...placed a little back from the road that runs in from the edge, so the next step has something to do.
    const g = s.grid;
    const nearRoad = (x: number, y: number, w: number, h: number): number => {
      for (let yy = Math.max(0, y - 1); yy <= Math.min(g.h - 1, y + h); yy++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(g.w - 1, x + w); xx++) {
          const u = g.building[yy * g.w + xx] ?? 0;
          if (u !== 0 && s.buildings.find((b) => b.uid === u)?.type === 'road') return 1000;
        }
      }
      return 0;
    };
    const spot = bestSpot(s, id, (x, y, w, h) => score(x, y, w, h) - nearRoad(x, y, w, h));
    if (!spot) return null;
    const r = applyAction(s, { type: 'place', building: id, x: spot.x, y: spot.y, rotation: spot.rotation });
    return r.result.ok ? r.state : null;
  }
  const p = place(s, id, bestSpot(s, id, score));
  return p.ok ? p.state : null;
}

/** Does what the current tutorial step asks, once. Returns the new state, or null if the step wants the clock to run. */
export function doStep(state: GameState): GameState | null {
  const st = tutorialStatus(state);
  const hl = st.current?.highlight;
  if (!st.current || !hl) return null;
  const g = state.grid;
  const hub = nearTiles(state, [TileKind.River]);
  // Homes and farms go a few tiles back from the creek, leaving its banks for the power station and the wetland.
  const back = (x: number, y: number): number => -Math.abs(-hub(x, y) - 5);
  // The road step: join the homes and the farm to the road from the edge of the valley.
  // Homes and shops are zoned beside the road, as the guide says; the town grows into them (the watch step lets the clock run).
  if (st.current.id === 'homes') {
    const next = keepZoned(state, ZONE.rlow, 6, { score: (x, y) => -hub(x, y) });
    return next === state ? null : next;
  }
  if (st.current.id === 'shops') {
    const next = keepZoned(state, ZONE.com, 3, { score: (x, y) => -hub(x, y) });
    return next === state ? null : next;
  }
  if (st.current.id === 'roads') {
    const next = connectAll(state);
    return next === state ? null : next;
  }
  if (hl.startsWith('build:') || hl.startsWith('tile:@')) {
    const id = (hl.startsWith('build:') ? hl.slice(6) : hl.slice(6)) as BuildingId;
    const score = id === 'road' ? hub : id === 'coalpower' || id === 'wetland' ? hub : id === 'nursery' ? (x: number, y: number) => -Math.hypot(x - g.w / 2, y - g.h / 2) : hub;
    if (id === 'phytoremediation') {
      const soil = (x: number, y: number, w: number, h: number): number => fieldSum(state, state.grid.soilContamination, x, y, w, h, 3);
      return placeBest(state, id, soil);
    }
    // While the steps are only asking for homes and a farm, they go down as the step says; the roads step joins them up.
    const early = st.current.id === 'farm';
    return placeBest(state, id, id === 'farm' || id === 'road' ? back : score, !early);
  }
  if (hl === 'tool:clear') {
    for (let i = 0; i < g.kind.length; i++) {
      if (g.kind[i] !== TileKind.Bush) continue;
      const r = applyAction(state, { type: 'clear', x: i % g.w, y: Math.floor(i / g.w) });
      if (r.result.ok) return r.state;
    }
    return null;
  }
  if (hl === 'tool:demolish' || st.current.id === 'swap') {
    const b = state.buildings.find((o) => o.type === 'coalpower');
    if (!b) return null;
    // The graph has to show clean power covering the town first: add panels and batteries until it does.
    if (!gridHoldsWithout(state, b.uid)) {
      const more = greenGridStep(state, { gen: 'solarfarm', storage: 'battery', maxBuys: 1, reserve: 0 });
      return more === state ? null : more;
    }
    // Retire it the way the guide says: through the Old sites tool (recycle), once the circular tier is open.
    if (!state.circular.unlocked) return null;
    const r = applyAction(state, { type: 'dispose', x: b.x, y: b.y, how: 'recycle' });
    return r.result.ok ? r.state : null;
  }
  if (hl === 'tool:dispose') {
    const s2 = disposeLegacy(state, { reserve: 5 });
    return s2 === state ? null : s2;
  }
  if (hl === 'button:next-decade') return state.phase === 'act1' ? advanceDecade(state).state : null;
  return null;
}

const VALLEY_HOME_TILES = 8;

/** A player who does exactly what the tutorial says, and lets the clock run when it says to watch. Returns the finished game. */
export function followTutorial(maxSteps = 4000): { end: GameState; steps: number; log: string[] } {
  let s = createGame('green-valley');
  const log: string[] = [];
  let steps = 0;
  while (s.phase !== 'epilogue' && s.phase !== 'failed' && steps++ < maxSteps) {
    s = answerPrompts(s, {});
    const st = tutorialStatus(s);
    if (st.current && log[log.length - 1] !== st.current.id) log.push(st.current.id);
    if (s.phase === 'turning-point') { s = startAct2(s); continue; }
    if (s.phase === 'act1') {
      // Housing keeps pace with jobs between steps: the player zones a little more land for homes, and for shops as the town grows.
      const jobs = s.buildings.reduce((a, b) => a + BUILDINGS[b.type].jobs, 0);
      const hub = nearTiles(s, [TileKind.River]);
      // A small town: eight home tiles at most (it is a valley, and every tile of homes needs road, power and bush cleared for it).
      const wantHomes = Math.min(Math.ceil(Math.max(0, jobs - housingOf(s)) / BUILDINGS.zres1.housing), VALLEY_HOME_TILES - zonedTiles(s, ZONE.rlow) + emptyZoned(s, ZONE.rlow));
      if (wantHomes > emptyZoned(s, ZONE.rlow)) {
        const next = keepZoned(s, ZONE.rlow, wantHomes, { score: (x, y) => -hub(x, y) });
        if (next !== s) { s = next; continue; }
      }
      const wantShops = 3;
      if (tutorialStatus(s).steps.find((x) => x.id === 'shops')?.done && wantShops > emptyZoned(s, ZONE.com)) {
        const next = keepZoned(s, ZONE.com, wantShops, { score: (x, y) => -hub(x, y) });
        if (next !== s) { s = next; continue; }
      }
      const next = doStep(s);
      if (next) { s = next; continue; }
      s = advanceDecade(s).state;
      continue;
    }
    if (s.phase === 'act2') {
      const next = doStep(s);
      if (next && next !== s) { s = next; continue; }
      s = tick(s, 0.5).state;
      continue;
    }
    break;
  }
  return { end: s, steps, log };
}

export function valleyIdle(): GameState {
  let s = startAct2(valleyAct1Idle());
  while (s.phase === 'act2') s = tick(s, 1).state;
  return s;
}

export { canPlace };
