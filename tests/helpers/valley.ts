/** Scripted players for Green Valley: one that follows the tutorial's steps, one that builds the town and then walks away. */
import { advanceDecade, applyAction, BUILDINGS, canPlace, createGame, startAct2, tick, tutorialStatus, TileKind } from '../../src/sim';
import type { BuildingId, GameState } from '../../src/sim';
import { fieldSum } from './act2play';
import { gridHoldsWithout } from './goodplay';
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

function placeBest(s: GameState, id: BuildingId, score: (x: number, y: number, w: number, h: number) => number = () => 0): GameState | null {
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
  if (hl.startsWith('build:') || hl.startsWith('tile:@')) {
    const id = (hl.startsWith('build:') ? hl.slice(6) : hl.slice(6)) as BuildingId;
    const score = id === 'road' ? hub : id === 'coalpower' || id === 'wetland' ? hub : id === 'nursery' ? (x: number, y: number) => -Math.hypot(x - g.w / 2, y - g.h / 2) : hub;
    if (id === 'phytoremediation') {
      const soil = (x: number, y: number, w: number, h: number): number => fieldSum(state, state.grid.soilContamination, x, y, w, h, 3);
      return placeBest(state, id, soil);
    }
    return placeBest(state, id, id === 'cottage' || id === 'farm' || id === 'road' ? back : score);
  }
  if (hl === 'tool:clear') {
    for (let i = 0; i < g.kind.length; i++) {
      if (g.kind[i] !== TileKind.Bush) continue;
      const r = applyAction(state, { type: 'clear', x: i % g.w, y: Math.floor(i / g.w) });
      if (r.result.ok) return r.state;
    }
    return null;
  }
  if (hl === 'tool:demolish') {
    const b = state.buildings.find((o) => o.type === 'coalpower');
    if (!b) return null;
    // The graph has to show clean power covering the town first: add panels and batteries until it does.
    if (!gridHoldsWithout(state, b.uid)) {
      const more = greenGridStep(state, { gen: 'solarfarm', storage: 'battery', maxBuys: 1, reserve: 0 });
      return more === state ? null : more;
    }
    return applyAction(state, { type: 'demolish', x: b.x, y: b.y }).state;
  }
  if (hl === 'tool:dispose') {
    const s2 = disposeLegacy(state, { reserve: 5 });
    return s2 === state ? null : s2;
  }
  if (hl === 'button:next-decade') return state.phase === 'act1' ? advanceDecade(state).state : null;
  return null;
}

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
      // Housing keeps pace with jobs between steps.
      const housing = s.buildings.reduce((a, b) => a + BUILDINGS[b.type].housing, 0);
      const jobs = s.buildings.reduce((a, b) => a + BUILDINGS[b.type].jobs, 0);
      if (housing < jobs && s.budget >= BUILDINGS.cottage.cost) {
        const hubNear = nearTiles(s, [TileKind.River]);
        const next = placeBest(s, 'cottage', (x, y) => -Math.abs(-hubNear(x, y) - 5));
        if (next) { s = next; continue; }
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
