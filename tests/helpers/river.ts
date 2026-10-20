/** Scripted players for River Town. */
import { applyAction, canPlace, objectiveStatus, startAct2, TileKind } from '../../src/sim';
import { seededGame } from './seeds';
import type { BuildingId, GameState } from '../../src/sim';
import { runScript } from './autoplay';
import { fieldSum } from './act2play';
import { greedyPlan } from './scripts';
import {
  answerPrompts, bestSpot, buildEnergy, comanageBush, consultAll, count, nearTiles, place, placeUpTo, playAct2, retireFossil, setPolicy,
  treatSewage, burnPatches,
} from './scen';
import type { Plan } from './scen';

type Want = { id: BuildingId; max: number; prefer?: 'near' | 'far' };

/** The irrigation boom: lots of farms, some industry, sewage straight into the river. */
export const RIVER_BOOM_WANTS: Want[] = [
  { id: 'farm', max: 9 },
  { id: 'coalmine', max: 1 },
  { id: 'factory', max: 3 },
  { id: 'outfall', max: 2 },
  { id: 'coalpower', max: 2 },
  { id: 'landfill', max: 1 },
  { id: 'carpark', max: 3 },
];

/** A little more thoughtful: one fewer farm and a smaller dump, asks Uncle Ray before clearing. */
export const RIVER_THOUGHTFUL_WANTS: Want[] = [
  { id: 'farm', max: 8 },
  { id: 'coalmine', max: 1 },
  { id: 'factory', max: 3 },
  { id: 'outfall', max: 1 },
  { id: 'coalpower', max: 1 },
  { id: 'landfill', max: 1 },
];

export function riverAct1Idle(seed: number | null = null): GameState {
  return runScript(seededGame('river-town', seed), greedyPlan(RIVER_BOOM_WANTS, 1.0)).state;
}

export function riverAct1Thoughtful(seed: number | null = null): GameState {
  const inner = greedyPlan(RIVER_THOUGHTFUL_WANTS, 1.0);
  return runScript(seededGame('river-town', seed), (s) => inner(answerPrompts(consultAll(s), {}, 25))).state;
}

const BEAT_PICKS: Record<string, string> = {};


function farmsToDrip(s0: GameState, max: number): GameState {
  let s = s0;
  let n = 0;
  for (const b of s.buildings.filter((o) => o.type === 'farm')) {
    if (n >= max || s.budget < 60) break;
    const r = applyAction(s, { type: 'place', building: 'dripfarm', x: b.x, y: b.y, rotation: b.rotation });
    if (r.result.ok) { s = r.state; n++; }
  }
  return s;
}

function fishway(s0: GameState): GameState {
  let s = s0;
  if (s.buildings.some((b) => b.type === 'fishway') || s.budget < 40) return s;
  const g = s.grid;
  for (let i = 0; i < g.kind.length; i++) {
    if (g.kind[i] !== TileKind.River || (g.elevation[i] ?? 0) === 0) continue;
    const r = applyAction(s, { type: 'place', building: 'fishway', x: i % g.w, y: Math.floor(i / g.w) });
    if (r.result.ok) { s = r.state; break; }
  }
  return s;
}

function riparianNurseries(s0: GameState, total: number): GameState {
  let s = s0;
  const near = nearTiles(s, [TileKind.River, TileKind.Wetland]);
  const have = s.buildings.filter((b) => b.type === 'nursery');
  const far = (x: number, y: number): boolean => have.every((b) => Math.hypot(b.x - x, b.y - y) >= 7);
  for (let n = have.length; n < total && s.budget >= 60; n++) {
    const spot = bestSpot(s, 'nursery', (x, y) => (far(x, y) ? 100 : 0) + near(x, y));
    const p = place(s, 'nursery', spot);
    if (!p.ok) break;
    s = p.state;
    have.push(s.buildings[s.buildings.length - 1] as (typeof have)[number]);
  }
  return s;
}

/** How thorough the thoughtful player is (the numbers a sensible, careful person would do; scratch scripts may tweak them). */
export const RIVER_BOT = { adapt: true, town: 0.25, env: 0.3, reservoirs: 1, wetlands: 2, drip: 4, nurseries: 3, phyto: 2, fishway: true, startDelay: 0, scale: 1, droughtPlan: true };
const sc = (n: number): number => Math.round(n * RIVER_BOT.scale);

export function riverThoughtfulPlan(): Plan {
  return (state) => {
    let s = answerPrompts(state, BEAT_PICKS);
    const y0 = state.a2.startYear + RIVER_BOT.startDelay;
    if (s.year < y0) return s;
    if (s.year === y0) {
      s = setPolicy(s, 'alloc.town', RIVER_BOT.town);
      s = setPolicy(s, 'alloc.env', RIVER_BOT.env);
    }
    // The drought warning's action: switch the drought plan on when the first drought is declared (or straight away).
    if (RIVER_BOT.droughtPlan && s.flags['pol.drought.plan'] !== 1 && s.a2.active.some((e) => e.type === 'drought')) s = setPolicy(s, 'drought.plan', 1);
    s = comanageBush(s, 2);
    s = burnPatches(s);
    s = treatSewage(s);
    // Follow the goal row: when the river slips under the target, leave it more water (while the farms can spare it).
    if (RIVER_BOT.adapt && s.year > y0 + 3) {
      const st = objectiveStatus(s);
      const river = st.find((o) => o.id === 'river')?.current ?? 100;
      const farms = st.find((o) => o.id === 'farms')?.current ?? 100;
      const env = typeof s.flags['pol.alloc.env'] === 'number' ? (s.flags['pol.alloc.env'] as number) : RIVER_BOT.env;
      if (river < 63 && farms > 56 && env < 0.45) s = setPolicy(s, 'alloc.env', Math.round((env + 0.05) * 100) / 100);
      else if (farms < 52 && river > 66 && env > RIVER_BOT.env) s = setPolicy(s, 'alloc.env', Math.round((env - 0.05) * 100) / 100);
    }
    const near = nearTiles(s, [TileKind.River]);
    s = placeUpTo(s, 'reservoir', Math.max(0, sc(RIVER_BOT.reservoirs) - count(s, 'reservoir')), near);
    if (RIVER_BOT.fishway && RIVER_BOT.scale >= 0.6) s = fishway(s);
    s = placeUpTo(s, 'wetland', Math.max(0, sc(RIVER_BOT.wetlands) - count(s, 'wetland')), near);
    s = farmsToDrip(s, sc(RIVER_BOT.drip));
    s = riparianNurseries(s, sc(RIVER_BOT.nurseries));
    const soilNearFarms = (x: number, y: number, w: number, h: number): number => {
      let t = 0;
      for (const b of s.buildings) if (b.type === 'farm' || b.type === 'dripfarm') t += Math.max(0, 6 - Math.hypot(b.x - x, b.y - y)) * 0.1;
      return t + fieldSum(s, s.grid.soilContamination, x, y, w, h, 2);
    };
    s = placeUpTo(s, 'phytoremediation', Math.max(0, sc(RIVER_BOT.phyto) - count(s, 'phytoremediation')), soilNearFarms);
    s = buildEnergy(s, [['windfarm', 3], ['solarfarm', 2], ['battery', 2], ['rooftopsolar', 3]], () => () => 0);
    s = retireFossil(s, { circularSafe: true });
    return s;
  };
}

export function riverThoughtful(seed: number | null = null): { act1: GameState; end: GameState } {
  const act1 = riverAct1Thoughtful(seed);
  return { act1, end: playAct2(startAct2(act1), riverThoughtfulPlan()) };
}

export function riverIdle(seed: number | null = null): { act1: GameState; end: GameState } {
  const act1 = riverAct1Idle(seed);
  return { act1, end: playAct2(startAct2(act1), null) };
}

export { canPlace };
