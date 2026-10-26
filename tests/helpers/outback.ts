/** Scripted players for Red Dirt. */
import { applyAction, BUILDINGS, createGame, startAct2, TileKind } from '../../src/sim';
import { CAREFUL_ROADS } from './scripts';
import type { BuildingId, GameState } from '../../src/sim';
import { fieldSum } from './act2play';
import {
  answerPrompts, bestSpot, buildEnergy, comanageBush, consultAll, count, demolishAll, nearTiles, place, placeUpTo, playAct2, queuePlan,
  retireFossil, setPolicy, disposeLegacy, capBudget,
} from './scen';
import type { Plan, QueueWant } from './scen';

export const RED_BOOM_QUEUE: QueueWant[] = [
  { id: 'farm', max: 2 },
  { id: 'bore', max: 2 },
  { id: 'coalmine', max: 2 },
  { id: 'coalpower', max: 1 },
  { id: 'factory', max: 2 },
  { id: 'rail', max: 3 },
  { id: 'landfill', max: 1 },
  { id: 'coalmine', max: 4 },
  { id: 'coalpower', max: 2 },
  { id: 'factory', max: 5 },
  { id: 'carpark', max: 5 },
  { id: 'farm', max: 4 },
];

export const RED_THOUGHTFUL_QUEUE: QueueWant[] = [
  { id: 'farm', max: 2 },
  { id: 'bore', max: 2 },
  { id: 'coalmine', max: 2 },
  { id: 'coalpower', max: 1 },
  { id: 'factory', max: 2 },
  { id: 'rail', max: 3 },
  { id: 'landfill', max: 1 },
  { id: 'coalmine', max: 3 },
  { id: 'coalpower', max: 2 },
  { id: 'factory', max: 4 },
  { id: 'carpark', max: 3 },
  { id: 'farm', max: 3 },
];

export function redAct1Idle(): GameState {
  return queueRun(RED_BOOM_QUEUE, false);
}

export function redAct1Thoughtful(): GameState {
  return queueRun(RED_THOUGHTFUL_QUEUE, true);
}

import { advanceDecade } from '../../src/sim';
function queueRun(queue: QueueWant[], respectful: boolean): GameState {
  const plan = queuePlan(queue, 1.0, 30, respectful ? CAREFUL_ROADS : undefined);
  let s = createGame('red-dirt');
  while (s.status === 'playing') {
    if (respectful) s = answerPrompts(consultAll(s), {}, 25);
    s = plan(s);
    s = advanceDecade(s).state;
  }
  return capBudget(s, 350);
}

export const RED_BOT = {
  startDelay: 0, scale: 1, closeMineYear: 2038, solar: 8, batteries: 5, wind: 1, bores: 2, reservoirs: 2, nurseries: 3, parks: 6, centres: 1, restrict: 1, reserve: 120,
};

/** Connected parts of the mine site (any tile with a zone value, 4-connected). */
function siteComponents(s: GameState): number[][] {
  const g = s.grid;
  const seen = new Set<number>();
  const out: number[][] = [];
  for (let i = 0; i < g.zone.length; i++) {
    if ((g.zone[i] ?? 0) === 0 || seen.has(i)) continue;
    const comp: number[] = [];
    const q = [i];
    seen.add(i);
    for (let qi = 0; qi < q.length; qi++) {
      const t = q[qi] as number;
      comp.push(t);
      const x = t % g.w, y = Math.floor(t / g.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
        const j = yy * g.w + xx;
        if (seen.has(j) || (g.zone[j] ?? 0) === 0) continue;
        seen.add(j);
        q.push(j);
      }
    }
    out.push(comp);
  }
  return out;
}

function pitTiles(s: GameState): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.Pit && s.grid.zone[i] === 1) out.push(i);
  return out;
}

/** Take the next rehabilitation step on every patch that can take one. */
function rehabilitate(state: GameState): GameState {
  let s = state;
  for (let guard = 0; guard < 12; guard++) {
    let did = false;
    for (const i of pitTiles(s)) {
      const r = applyAction(s, { type: 'rehab', x: i % s.grid.w, y: Math.floor(i / s.grid.w) });
      if (r.result.ok) { s = r.state; did = true; break; }
    }
    if (!did) break;
  }
  return s;
}

/** Build only while enough money is left in reserve for the jobs that matter more (the pit, the lights). */
function buildKeeping(s: GameState, id: BuildingId, target: number, reserve: number, score: (x: number, y: number, w: number, h: number) => number = () => 0): GameState {
  let st = s;
  while (count(st, id) < target && st.budget >= BUILDINGS[id].cost + reserve) {
    const p = place(st, id, bestSpot(st, id, score));
    if (!p.ok) break;
    st = p.state;
  }
  return st;
}

const sc = (n: number): number => Math.max(n > 0 ? 1 : 0, Math.round(n * RED_BOT.scale));

export function redThoughtfulPlan(): Plan {
  return (state) => {
    let s = answerPrompts(state, {});
    const res = RED_BOT.reserve;
    const y0 = state.a2.startYear + RED_BOT.startDelay;
    if (s.year < y0) return s;
    if (s.year === y0) s = setPolicy(s, 'water.restrict', RED_BOT.restrict);
    s = comanageBush(s, 1);
    const wet = nearTiles(s, [TileKind.Wetland]);
    // Water first (the waterhole fails in a drought), then the sun, then shade.
    s = buildKeeping(s, 'bore', sc(RED_BOT.bores), res, wet);
    s = buildKeeping(s, 'reservoir', sc(RED_BOT.reservoirs), res, wet);
    const yearsIn = s.year - y0;
    // Panels and turbines go at least a few tiles from the mine site, which has to stay clear for the nurseries that heal it.
    const siteTiles = siteComponents(s).flat();
    const g0 = s.grid;
    const farFromSite = (x: number, y: number): number => {
      let d = 6;
      for (const i of siteTiles) d = Math.min(d, Math.hypot((i % g0.w) - x, Math.floor(i / g0.w) - y));
      return d;
    };
    s = buildKeeping(s, 'solarfarm', Math.min(sc(RED_BOT.solar), 3 + Math.floor(yearsIn / 3)), res, farFromSite);
    s = buildKeeping(s, 'battery', Math.min(sc(RED_BOT.batteries), 1 + Math.floor(yearsIn / 3)), res, farFromSite);
    s = buildKeeping(s, 'windfarm', RED_BOT.wind, res, farFromSite);
    s = retireFossil(s, { circularSafe: true });
    s = buildKeeping(s, 'coolingcentre', sc(RED_BOT.centres), res, wet);
    s = buildKeeping(s, 'parkland', sc(RED_BOT.parks), res, wet);
    // The mine closes, the bond arrives, and the pit is put right step by step with a nursery beside it.
    // Before the circular tier opens a plain demolish is fine; after it, closing a site goes through the waste hierarchy.
    const closing = s.year >= RED_BOT.closeMineYear + RED_BOT.startDelay;
    if (closing && count(s, 'coalmine') > 0 && !s.circular.unlocked) s = demolishAll(s, 'coalmine');
    if (count(s, 'coalmine') === 0) {
      // Nurseries beside the mine site, enough that every tile of it is within a few tiles of a seed source.
      for (const comp of siteComponents(s)) {
        for (let guard = 0; guard < 4; guard++) {
          const nurseries = s.buildings.filter((b) => b.type === 'nursery');
          const uncovered = comp.filter((i) => !nurseries.some((b) => Math.hypot(b.x + 1 - (i % s.grid.w), b.y + 1 - Math.floor(i / s.grid.w)) <= 4.5));
          if (uncovered.length === 0) break;
          const cx = uncovered.reduce((a, i) => a + (i % s.grid.w), 0) / uncovered.length;
          const cy = uncovered.reduce((a, i) => a + Math.floor(i / s.grid.w), 0) / uncovered.length;
          const before = count(s, 'nursery');
          // A nursery that cannot go near the uncovered ground (the middle of a pit that is still being reshaped) is not worth buying:
          // wait for the next rehab step instead of planting seed sources far from the site.
          const spot = bestSpot(s, 'nursery', (x, y) => -Math.hypot(x - cx, y - cy));
          if (!spot || Math.hypot(spot.x - cx, spot.y - cy) > 7) break;
          s = buildKeeping(s, 'nursery', before + 1, 0, (x, y) => -Math.hypot(x - cx, y - cy));
          if (count(s, 'nursery') === before) break;
        }
      }
      const soil = (x: number, y: number, w: number, h: number): number => fieldSum(s, s.grid.soilContamination, x, y, w, h, 3);
      s = buildKeeping(s, 'phytoremediation', 2, 0, soil);
    }
    s = rehabilitate(s);
    s = disposeLegacy(s, { reserve: 60, skip: closing ? [] : ['coalmine'] });
    return s;
  };
}

export function redThoughtful(): { act1: GameState; end: GameState } {
  const act1 = redAct1Thoughtful();
  return { act1, end: playAct2(startAct2(act1), redThoughtfulPlan()) };
}

export function redIdle(): { act1: GameState; end: GameState } {
  const act1 = redAct1Idle();
  return { act1, end: playAct2(startAct2(act1), null) };
}

export { BUILDINGS, bestSpot, place };
