/**
 * Scenario mechanics registry. A scenario lists the modules it uses (ScenarioDef.mechanics); the core engine calls the
 * dispatchers below at fixed points (Act 2 start, each season, each year end, an income calculation, a placement) and
 * never needs to know what River Town or Red Dirt are. All state lives in GameState.flags and the tile grid.
 */
import { BUILDINGS } from '../buildings';
import { availability } from '../rules';
import { getScenario } from '../scenarios';
import type { MechanicsId } from '../scenarios';
import { carEmissionFactor, transitCoverage } from './cityCore';
import { addFlag, clamp01, flag } from './flags';
import { canopyShare, heatDeathsTotal } from './heatCore';
import { heatSeason } from './heat';
import { aquifer, rehabPct } from './outbackCore';
import { outbackBegin, outbackSeason, outbackYear } from './outback';
import { reefBegin, reefIncome, reefSeason } from './reef';
import { seaLevelCm, seaRiseM, tourismIndex, wouldFlood as wouldFloodNow } from './reefCore';
import { riverBegin, riverIncome, riverSeason, riverYear } from './river';
import { farmViability, riverHealth } from './riverCore';
import type { GameState, PlacedBuilding, SimEvent } from '../types';

export { MECH_EVENTS } from './events';

const uses = (s: GameState, id: MechanicsId): boolean => (getScenario(s.scenarioId).mechanics ?? []).includes(id);

/** Metric keys the mechanics add. Content may use them in conditions (see conditions.ts) and objectives (objectives.ts). */
export const MECH_METRIC_KEYS: readonly string[] = [
  'riverHealth', 'farmViability', 'townWaterFailures', 'envFlowPct', 'tourism', 'homesLost', 'homesAtRisk', 'seaLevelCm', 'seaRiseCm',
  'rehabPct', 'aquifer', 'waterFailures', 'heatDeaths', 'canopyPct', 'transitPct', 'netZeroYear', 'societyMin', 'capitalSpent',
  'outbreaks', 'speciesBack', 'speciesAlive',
];

/** Called when Act 2 begins (and by createGame for scenarios that start there). */
export function mechBegin(s: GameState): void {
  if (uses(s, 'river')) riverBegin(s);
  if (uses(s, 'reef')) reefBegin(s);
  if (uses(s, 'outback')) outbackBegin(s);
}

/** Every simulated Act 2 season, after events, grid and succession. */
export function mechSeason(s: GameState, emitted: readonly SimEvent[], idx: number): void {
  if (uses(s, 'river')) riverSeason(s, idx);
  if (uses(s, 'reef')) reefSeason(s);
  if (uses(s, 'outback')) outbackSeason(s, idx);
  heatSeason(s, emitted);
}

/** Year end, after the calendar and climate moved on. */
export function mechYear(s: GameState): void {
  if (uses(s, 'river')) riverYear(s);
  if (uses(s, 'outback')) outbackYear(s);
}

/** Extra income (can be negative) per year from the scenario's own economy. */
export function mechIncome(s: GameState): number {
  let v = 0;
  if (uses(s, 'river')) v += riverIncome(s);
  if (uses(s, 'reef')) v += reefIncome(s);
  return v;
}

/** Multiplier on one building's static emissions (public transport trims car emissions). */
export function mechEmissionFactor(s: GameState, b: PlacedBuilding): number {
  if (uses(s, 'city') && b.type === 'carpark') return carEmissionFactor(s);
  return 1;
}

/** Called after a successful placement (spending is tracked for the "under budget" bonus). */
export function mechPlaced(s: GameState, b: PlacedBuilding): void {
  // The 25-year capital programme: spending after 2050 does not count against the budget bonus.
  if (uses(s, 'city') && s.year <= 2050) addFlag(s, 'c.spent', availability(s.scenarioId, b.type).cost);
}

/** Share (0..1) of the Environment meter's water term that comes from the scenario's own water, or null for the default. */
export function mechEnvScore(s: GameState): number | null {
  if (uses(s, 'river')) return clamp01(riverHealth(s) / 100);
  if (uses(s, 'outback')) return clamp01(0.5 * (aquifer(s) / 100) + 0.5 * (rehabPct(s) / 100));
  return null;
}

/** First calendar year from which yearly emissions have stayed at or below the net-zero line, or 9999. */
export function netZeroYear(s: GameState): number {
  const limit = getScenario(s.scenarioId).act2.netZeroKt;
  const ys = s.a2.yearly;
  if (limit === undefined || ys.length === 0) return 9999;
  let first = 9999;
  for (let i = ys.length - 1; i >= 0; i--) {
    const y = ys[i];
    if (!y || y.totalKt > limit) break;
    first = y.year;
  }
  return first;
}

/** Lowest Society in any recorded year (the current value if no year has been recorded). */
export function societyMin(s: GameState): number {
  let m = s.meters.society;
  for (const y of s.a2.yearly) m = Math.min(m, y.meters.society);
  return Math.round(m * 10) / 10;
}

/** A storm surge of this height (metres above the tide) is the planning benchmark for 'homes at risk'. */
export const DESIGN_SURGE_M = 1.3;

/** Homes (any housing) that a design storm surge would flood today, after seawalls and mangroves. */
export function homesAtRisk(s: GameState): number {
  if (!(getScenario(s.scenarioId).mechanics ?? []).includes('reef')) return 0;
  let n = 0;
  for (const b of s.buildings) if (BUILDINGS[b.type].housing > 0 && wouldFloodNow(s, b, DESIGN_SURGE_M)) n++;
  return n;
}

/** Live value of a mechanics metric, or null if the key is not one of theirs. */
export function mechMetric(s: GameState, key: string): number | null {
  switch (key) {
    case 'riverHealth': return riverHealth(s);
    case 'farmViability': return farmViability(s);
    case 'townWaterFailures': return flag(s, 'w.townFail');
    case 'envFlowPct': return Math.round(clamp01(flag(s, 'w.envAvg', 0.9)) * 100);
    case 'tourism': return tourismIndex(s);
    case 'homesLost': return flag(s, 'r.homesLost');
    case 'homesAtRisk': return homesAtRisk(s);
    case 'seaLevelCm': return Math.round(seaLevelCm(s));
    case 'seaRiseCm': return Math.round(seaRiseM(s) * 100);
    case 'rehabPct': return rehabPct(s);
    case 'aquifer': return aquifer(s);
    case 'waterFailures': return flag(s, 'o.waterFail');
    case 'heatDeaths': return heatDeathsTotal(s);
    case 'canopyPct': return Math.round(canopyShare(s) * 100);
    case 'transitPct': return Math.round(transitCoverage(s) * 100);
    case 'netZeroYear': return netZeroYear(s);
    case 'societyMin': return societyMin(s);
    case 'capitalSpent': return Math.round(flag(s, 'c.spent'));
    case 'outbreaks': return flag(s, 'r.outbreaks');
    case 'speciesBack': return Object.values(s.wildlife.species).filter((x) => x.pop > 0 && x.startPop === 0).length;
    case 'speciesAlive': return Object.values(s.wildlife.species).filter((x) => x.pop > 0).length;
    default: return null;
  }
}

// Read-only views the UI can draw (river health bar, sea level, tourism, mine site progress, heat risk).
export { allocation, farmCount, farmViability, hasFishway, riverHealth, weirTileIdx, RIVER } from './riverCore';
export type { Allocation } from './riverCore';
export { homeLevelM, resortCount, seaLevelCm, seaRiseM, surgeHeightM, tourismIncome, tourismIndex, wouldFlood } from './reefCore';
export { aquifer, boreCount, minesOpen, OUTBACK, rehabPct, siteTiles } from './outbackCore';
export { canopyShare, coolingCoverage, heatDeathsExpected, HEAT } from './heatCore';
export { transitCoverage } from './cityCore';
