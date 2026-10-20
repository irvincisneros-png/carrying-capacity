/** Scripted players for Net Zero City. */
import { applyAction, BUILDINGS, createGame, TileKind } from '../../src/sim';
import type { BuildingId, GameState } from '../../src/sim';
import {
  answerPrompts, bestSpot, burnPatches, comanageBush, consultAll, count, disposeLegacy, greenGridStep, nearTiles, place, playAct2, retireFossil,
  treatSewage,
} from './scen';
import type { Plan } from './scen';

export const CITY_BOT = {
  parks: 24, parksPerYear: 3, rooftops: 130, batteries: 16, wind: 2, solar: 3, transit: 6, centres: 3, retrofitPerYear: 3, nurseries: 2,
  reserve: 10, saveFor: 0, startDelay: 0, scale: 1, disposeAfterRenewable: 0.5,
};

function buildKeeping(s: GameState, id: BuildingId, target: number, reserve: number, score: (x: number, y: number, w: number, h: number) => number = () => 0): GameState {
  let st = s;
  while (count(st, id) < target && st.budget >= BUILDINGS[id].cost + reserve) {
    const p = place(st, id, bestSpot(st, id, score));
    if (!p.ok) break;
    st = p.state;
  }
  return st;
}

/** Score for a street-tree spot: how many land tiles in the 3x3 are not yet shaded. */
function parkScore(s: GameState): (x: number, y: number) => number {
  const g = s.grid;
  const shaded = new Uint8Array(g.kind.length);
  for (const b of s.buildings) {
    if (b.type !== 'parkland') continue;
    for (let y = Math.max(0, b.y - 1); y <= Math.min(g.h - 1, b.y + 1); y++) for (let x = Math.max(0, b.x - 1); x <= Math.min(g.w - 1, b.x + 1); x++) shaded[y * g.w + x] = 1;
  }
  return (x, y) => {
    let n = 0;
    for (let yy = Math.max(0, y - 1); yy <= Math.min(g.h - 1, y + 1); yy++) {
      for (let xx = Math.max(0, x - 1); xx <= Math.min(g.w - 1, x + 1); xx++) {
        const i = yy * g.w + xx;
        const k = g.kind[i];
        if ((k === TileKind.Land || k === TileKind.Bush) && shaded[i] === 0 && (g.building[i] ?? 0) !== 0) n++;
      }
    }
    return n;
  };
}

function retrofit(s0: GameState, max: number, reserve: number): GameState {
  let s = s0;
  let n = 0;
  for (const b of s.buildings.filter((o) => o.type === 'suburb')) {
    if (n >= max || s.budget < BUILDINGS.greensuburb.cost + reserve) break;
    const r = applyAction(s, { type: 'place', building: 'greensuburb', x: b.x, y: b.y, rotation: b.rotation });
    if (r.result.ok) { s = r.state; n++; }
  }
  return s;
}

const sc = (n: number): number => Math.max(n > 0 ? 1 : 0, Math.round(n * CITY_BOT.scale));

export function cityThoughtfulPlan(): Plan {
  return (state) => {
    let s = answerPrompts(state, {});
    const yearsIn = s.year - state.a2.startYear;
    if (yearsIn < CITY_BOT.startDelay) return s;
    const res = CITY_BOT.reserve;
    if (yearsIn === CITY_BOT.startDelay) s = consultAll(s);
    s = comanageBush(s, 1);
    s = burnPatches(s);
    // 1. Keep the lights on and get the coal out: rooftop solar and batteries until the grid holds without fossil fuel.
    s = greenGridStep(s, { gen: 'rooftopsolar', storage: 'battery', maxBuys: 12, reserve: res, maxGen: sc(CITY_BOT.rooftops), maxStorage: sc(CITY_BOT.batteries) });
    s = retireFossil(s, { circularSafe: true });
    // 2. Shade and cooling for the hottest days.
    s = buildKeeping(s, 'coolingcentre', Math.min(sc(CITY_BOT.centres), 1 + Math.floor(yearsIn / 3)), res);
    s = buildKeeping(s, 'parkland', Math.min(sc(CITY_BOT.parks), (yearsIn + 1) * CITY_BOT.parksPerYear), res + CITY_BOT.saveFor, (x, y) => parkScore(s)(x, y));
    s = treatSewage(s);
    // 3. When the circular tier opens, the old factories become recycling plants (the biggest remaining source), then transit and retrofits.
    if ((s.a2.lastGrid?.renewableShare ?? 0) >= CITY_BOT.disposeAfterRenewable) {
      s = disposeLegacy(s, { reserve: res + 20, research: ['green-steel'], skip: ['coalpower', 'gaspower'], wait: true });
    }
    s = buildKeeping(s, 'transitline', Math.min(sc(CITY_BOT.transit), 1 + Math.floor(yearsIn / 2)), res + CITY_BOT.saveFor);
    s = retrofit(s, sc(CITY_BOT.retrofitPerYear), res + CITY_BOT.saveFor);
    s = buildKeeping(s, 'nursery', CITY_BOT.nurseries, res + CITY_BOT.saveFor, nearTiles(s, [TileKind.River]));
    return s;
  };
}

export function cityThoughtful(): GameState {
  return playAct2(createGame('net-zero-city'), cityThoughtfulPlan());
}

export function cityIdle(): GameState {
  return playAct2(createGame('net-zero-city'), null);
}
