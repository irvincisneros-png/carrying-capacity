/** River Town hooks: the seasonal water budget, salt on irrigated land, billabongs, and farm income. */
import { getScenario } from '../scenarios';
import { seasonWeather } from '../season';
import { emitStory } from '../story';
import { TileKind } from '../types';
import type { GameState } from '../types';
import { addFlag, clamp, clamp01, eventActive, flag, setFlag } from './flags';
import {
  allocation, droughtPlanOn, farmCount, farmDemand, meanSaltNear, naturalFlow, RIVER, storageCapacity, townDemand,
} from './riverCore';

export function riverBegin(s: GameState): void {
  setFlag(s, 'w.store', storageCapacity(s));
  setFlag(s, 'w.envAvg', 0.9);
  setFlag(s, 'w.yield', 0.9);
  setFlag(s, 'w.wet', 0.7);
  setFlag(s, 'w.damage', 0);
}

export function riverSeason(s: GameState, idx: number): void {
  const season = s.a2.season;
  const sc = getScenario(s.scenarioId);
  const w = seasonWeather(s.seed, idx);
  const drought = eventActive(s, 'drought', idx);
  const flow = naturalFlow(s, season, sc.act2.rainfall, {
    rain: w.rain, drought, heatwave: eventActive(s, 'heatwave', idx),
  });
  const alloc = allocation(s);
  const tDem = townDemand(s, season, drought);
  const fDem = farmDemand(s, season, drought);
  const tCap = alloc.town * flow;
  const fCap = alloc.farms * flow;

  // Town water: take what is needed (and top up storage) within the allocation; storage covers the rest.
  const cap = storageCapacity(s);
  let store = Math.min(cap, flag(s, 'w.store', cap)) * (1 - RIVER.evaporation);
  const fillRoom = Math.max(0, cap - store);
  const townTake = Math.min(tCap, tDem + fillRoom);
  const fromRiver = Math.min(townTake, tDem);
  store += townTake - fromRiver;
  let shortfall = tDem - fromRiver;
  const fromStore = Math.min(shortfall, store);
  store -= fromStore;
  shortfall -= fromStore;
  setFlag(s, 'w.store', clamp(store, 0, cap));
  const fail = tDem > 0 && tDem - shortfall < tDem * RIVER.townFailBelow;
  if (fail) {
    if (s.year >= RIVER.townFailFromYear) addFlag(s, 'w.townFail', 1);
    addFlag(s, 'w.townFailAll', 1);
    s.a2.stress += 6;
    if (flag(s, 'w.lastFailSeason', -9) < idx - 2) {
      emitStory(s, `Town water restrictions: the river is too low and the town's share has run short. Taps run weak, gardens are banned from watering, and the pool is closed. The mayor says it is the worst the town has seen.`, {
        channel: 'town', tone: 'concern',
      }, 0.7);
    }
    setFlag(s, 'w.lastFailSeason', idx);
  }

  // Farms take what they need within their allocation; with a drought plan, banked water covers a dry season's gap.
  // The plan's environmental-flow buffer: in a drought the farms leave the river at least its own share.
  const envFloor = RIVER.envNeed * flow;
  const plan = droughtPlanOn(s);
  const fRiver = Math.min(fDem, drought && plan ? Math.min(fCap, Math.max(0, flow - townTake - envFloor)) : fCap);
  let bank = flag(s, 'w.bank');
  const fBank = drought && plan ? Math.min(bank, fDem - fRiver) : 0;
  bank -= fBank;
  const fDel = fRiver + fBank;
  setFlag(s, 'w.yd', flag(s, 'w.yd') + fDel);
  setFlag(s, 'w.yq', flag(s, 'w.yq') + fDem);

  // What is left stays in the river.
  let extraction = townTake + fRiver;
  const envNeed = envFloor;
  // Drought plan in a normal season: bank half of what flows past above the river's own share (never the river's share).
  if (!drought && plan) {
    const spare = Math.max(0, flow - extraction - envNeed * 1.1);
    const put = Math.min(RIVER.bankCap - bank, spare * RIVER.bankShare);
    if (put > 0) { bank += put; extraction += put; }
  }
  setFlag(s, 'w.bank', clamp(bank, 0, RIVER.bankCap));
  const envRatio = flow > 0 && envNeed > 0 ? clamp((flow - extraction) / envNeed, 0, 1.5) : 0;
  setFlag(s, 'w.flow', flow);
  setFlag(s, 'w.envRatio', envRatio);
  setFlag(s, 'w.envAvg', flag(s, 'w.envAvg', 0.9) * 0.85 + 0.15 * Math.min(1, envRatio));

  // Billabongs fill in a good spring and dry out in summer.
  let wet = flag(s, 'w.wet', 0.7);
  if (season === 3 && envRatio >= 0.9) wet = Math.min(1, wet + 0.5);
  if (season === 0) wet -= 0.14;
  wet -= 0.03;
  setFlag(s, 'w.wet', clamp01(wet));

  // Salt: irrigation brings it up, and water that actually reaches the farm matters, not water that is wanted.
  const g = s.grid;
  const f = fDem > 0 ? fDel / fDem : 1;
  const irr = RIVER.irrigation[season] ?? 1;
  const warmK = 1 + 0.3 * Math.max(0, s.tempC - 1);
  for (const b of s.buildings) {
    if (b.type !== 'farm' && b.type !== 'dripfarm') continue;
    const inc = RIVER.saltPerFarm * f * irr * warmK * (b.type === 'dripfarm' ? RIVER.dripSalt : 1);
    if (inc <= 0) continue;
    for (let y = Math.max(0, b.y - 2); y <= Math.min(g.h - 1, b.y + b.h + 1); y++) {
      for (let x = Math.max(0, b.x - 2); x <= Math.min(g.w - 1, b.x + b.w + 1); x++) {
        const i = y * g.w + x;
        const k = g.kind[i];
        if ((g.building[i] ?? 0) !== 0 || (k !== TileKind.Land && k !== TileKind.Bush)) continue;
        const dx = Math.max(b.x - x, x - (b.x + b.w - 1), 0);
        const dy = Math.max(b.y - y, y - (b.y + b.h - 1), 0);
        g.soilContamination[i] = (g.soilContamination[i] ?? 0) + inc * (1 - Math.hypot(dx, dy) / 3.2);
      }
    }
  }
  if (season === 3 && envRatio >= 1) {
    for (let i = 0; i < g.kind.length; i++) {
      if (g.kind[i] !== TileKind.River) continue;
      const x0 = i % g.w, y0 = Math.floor(i / g.w);
      for (let y = Math.max(0, y0 - 3); y <= Math.min(g.h - 1, y0 + 3); y++) {
        for (let x = Math.max(0, x0 - 3); x <= Math.min(g.w - 1, x0 + 3); x++) {
          const j = y * g.w + x;
          if (g.kind[j] === TileKind.Land || g.kind[j] === TileKind.Bush) g.soilContamination[j] = (g.soilContamination[j] ?? 0) * (1 - RIVER.flush / 8);
        }
      }
    }
  }
  setFlag(s, 'w.damage', flag(s, 'w.damage') * 0.93);
}

export function riverYear(s: GameState): void {
  const yq = flag(s, 'w.yq');
  const yearYield = yq > 0 ? flag(s, 'w.yd') / yq : 1;
  setFlag(s, 'w.yield', flag(s, 'w.yield', 0.9) * 0.5 + yearYield * 0.5);
  setFlag(s, 'w.yd', 0);
  setFlag(s, 'w.yq', 0);
}

/** Yearly farm income: each working farm earns when it gets its water and its soil is not salty. */
export function riverIncome(s: GameState): number {
  const { farms, drip } = farmCount(s);
  if (farms + drip === 0) return 0;
  const salt = clamp01(meanSaltNear(s, 2, ['farm', 'dripfarm']) / 1.5);
  const q = clamp01(flag(s, 'w.yield', 0.9)) * (1 - 0.6 * salt);
  return Math.round(((farms * 1 + drip * 1.2) * (q - 0.55) * 5) * 10) / 10;
}
