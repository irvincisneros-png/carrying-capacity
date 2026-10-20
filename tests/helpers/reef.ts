/** Scripted players for Reef Island. */
import { applyAction, BUILDINGS, canPlace, createGame, startAct2, TileKind } from '../../src/sim';
import { wouldFlood } from '../../src/sim/mechanics/reefCore';
import type { BuildingId, GameState } from '../../src/sim';
import { runScript } from './autoplay';
import {
  answerPrompts, bestSpot, buildEnergy, comanageBush, consultAll, count, nearTiles, place, placeUpTo, playAct2, queuePlan, retireFossil,
  setPolicy, treatSewage, burnPatches,
} from './scen';
import type { Plan, QueueWant } from './scen';

type Want = QueueWant;

/** The tourism boom: resorts on the beach, sewage into the lagoon, diesel/coal power, a harbour. */
export const REEF_BOOM_WANTS: Want[] = [
  { id: 'farm', max: 3 },
  { id: 'resort', max: 6 },
  { id: 'coalpower', max: 2 },
  { id: 'port', max: 1 },
  { id: 'outfall', max: 2 },
  { id: 'factory', max: 2 },
  { id: 'landfill', max: 1 },
  { id: 'carpark', max: 3 },
];

export const REEF_THOUGHTFUL_WANTS: Want[] = [
  { id: 'farm', max: 3 },
  { id: 'resort', max: 5 },
  { id: 'coalpower', max: 1 },
  { id: 'port', max: 1 },
  { id: 'outfall', max: 1 },
  { id: 'landfill', max: 1 },
];

export function reefAct1Idle(): GameState {
  return runScript(createGame('reef-island'), queuePlan(REEF_BOOM_WANTS, 1.0)).state;
}

export function reefAct1Thoughtful(): GameState {
  const inner = queuePlan(REEF_THOUGHTFUL_WANTS, 1.0);
  return runScript(createGame('reef-island'), (s) => inner(answerPrompts(consultAll(s), {}, 25))).state;
}

export const REEF_BOT = { cull: 1, nurseries: 3, wetlands: 2, relocate: true, seawalls: 0, satellites: true, startDelay: 0, scale: 1 };
const sc = (n: number): number => Math.round(n * REEF_BOT.scale);

export function reefThoughtfulPlan(): Plan {
  return (state) => {
    let s = answerPrompts(state, {});
    const y0 = state.a2.startYear + REEF_BOT.startDelay;
    if (s.year < y0) return s;
    if (s.year === y0) s = setPolicy(s, 'cots.cull', REEF_BOT.cull);
    s = comanageBush(s, 2);
    s = burnPatches(s);
    s = treatSewage(s);
    s = placeUpTo(s, 'coralnursery', Math.max(0, sc(REEF_BOT.nurseries) - count(s, 'coralnursery')), nearTiles(s, [TileKind.Reef]));
    s = placeUpTo(s, 'wetland', Math.max(0, sc(REEF_BOT.wetlands) - count(s, 'wetland')), nearTiles(s, [TileKind.Estuary]));
    s = placeUpTo(s, 'nursery', Math.max(0, 3 - count(s, 'nursery')), nearTiles(s, [TileKind.Estuary]));
    s = buildEnergy(s, [['solarfarm', 3], ['battery', 3], ['windfarm', 2], ['tidal', 1, 2030], ['rooftopsolar', 4]], () => () => 0);
    s = retireFossil(s, { circularSafe: true });
    if (REEF_BOT.satellites && REEF_BOT.scale >= 0.6) s = satellites(s);
    if (REEF_BOT.relocate && REEF_BOT.scale >= 0.6) s = relocateLowHomes(s);
    return s;
  };
}

function satellites(state: GameState): GameState {
  let s = state;
  if (s.satellites.warning && !s.satellites.warning.mitigated) {
    const r = applyAction(s, { type: 'mitigate' });
    if (r.result.ok) s = r.state;
  }
  if (!s.buildings.some((b) => b.type === 'groundstation') && s.budget > 90) {
    const spot = bestSpot(s, 'groundstation', () => 0);
    const p = place(s, 'groundstation', spot);
    if (p.ok) s = p.state;
  }
  if (!s.satellites.overlays.sst && s.buildings.some((b) => b.type === 'groundstation') && s.budget > 60) {
    const r = applyAction(s, { type: 'subscribe', overlay: 'sst' });
    if (r.result.ok) s = r.state;
  }
  return s;
}

/** Managed retreat: homes that a 1.2 m surge would flood are demolished and rebuilt on higher ground. */
export function relocateLowHomes(state: GameState): GameState {
  let s = state;
  const design = 1.3;
  for (const b of s.buildings.filter((o) => BUILDINGS[o.type].housing > 0)) {
    if (!wouldFlood(s, b, design)) continue;
    if (s.budget < 40) break;
    const type = b.type;
    const g = s.grid;
    const lvl = (x: number, y: number): number => g.elevation[y * g.w + x] ?? 0;
    const spot = bestSpot(s, type as BuildingId, (x, y, w, h) => {
      let lo = 9;
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) lo = Math.min(lo, lvl(xx, yy));
      return lo >= 2 ? 10 - Math.hypot(x - b.x, y - b.y) * 0.1 : -100;
    });
    if (!spot) continue;
    const probe = canPlace({ ...s, budget: 1e9 }, type, spot.x, spot.y, spot.rotation);
    if (!probe.ok || lvl(spot.x, spot.y) < 2) continue;
    const d = applyAction(s, { type: 'demolish', x: b.x, y: b.y });
    if (!d.result.ok) continue;
    const p = place(d.state, type as BuildingId, spot);
    s = p.ok ? p.state : d.state;
  }
  return s;
}

export function reefThoughtful(): { act1: GameState; end: GameState } {
  const act1 = reefAct1Thoughtful();
  return { act1, end: playAct2(startAct2(act1), reefThoughtfulPlan()) };
}

export function reefIdle(): { act1: GameState; end: GameState } {
  const act1 = reefAct1Idle();
  return { act1, end: playAct2(startAct2(act1), null) };
}

export { applyAction, placeUpTo };
