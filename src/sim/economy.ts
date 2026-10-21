import { BUILDINGS } from './buildings';
import { reefHealth } from './climate';
import { mechEnvScore, mechMetric } from './mechanics';
import { workingBuildings } from './roads';
import { estuaryHealth, hasReef, meanHealth, meanReefHealth } from './metrics';
import { getScenario } from './scenarios';
import { TileKind } from './types';
import type { GameState, Meters, PlacedBuilding } from './types';

/** First year the electricity grid matters (coal power unlocks). Before it, negative power is ignored. */
export const GRID_YEAR = 1920;
/** Money per filled job per decade. */
export const INCOME_PER_JOB = 0.5;
/** Fixed colonial / council grant each decade so the first few decades are playable. */
export const BASE_GRANT = 20;
/** Fraction of the housing gap closed each decade. */
export const POP_GROWTH = 0.5;

/** Meter tuning constants (see tests/tuning.test.ts for the scripted runs these are tuned against). */
export const TUNING = {
  /** Filled jobs that count as a fully developed economy in year Y: base + perYear * (Y - 1850). */
  jobsTargetBase: 60,
  jobsTargetPerYear: 10,
  popTargetBase: 40,
  popTargetPerYear: 8,
  /** Weights for Economy. */
  econScale: 0.62,
  econFill: 0.1,
  econBudget: 0.08,
  econPower: 0.2,
  /** Weights for Society. */
  socHoused: 0.35,
  socEmployed: 0.25,
  socAir: 0.4,
  housingAirBad: 9,
  /** Weights for Environment. */
  envBush: 0.35,
  envPollution: 0.35,
  envReef: 0.3,
  /** Mean total pollution per tile at which the pollution score hits zero. */
  pollutionBad: 1.0,
  /** Fraction of the starting bush remaining at which the bush score is zero (1 = untouched). */
  bushFloor: 0.4,
};

export interface EconomySnapshot {
  jobs: number;
  housing: number;
  population: number;
  filledJobs: number;
  unfilledJobs: number;
  unemployed: number;
  powerSupply: number;
  powerDemand: number;
  /** Zero before the grid year. */
  powerDeficit: number;
  gridActive: boolean;
}

export function totals(buildings: readonly PlacedBuilding[]): { jobs: number; housing: number; supply: number; demand: number } {
  let jobs = 0, housing = 0, supply = 0, demand = 0;
  for (const b of buildings) {
    const d = BUILDINGS[b.type];
    jobs += d.jobs;
    housing += d.housing;
    if (d.power > 0) supply += d.power;
    else demand -= d.power;
  }
  return { jobs, housing, supply, demand };
}

export function economySnapshot(state: GameState, population = state.population): EconomySnapshot {
  const t = totals(workingBuildings(state));
  const gridActive = state.year >= GRID_YEAR;
  const filled = Math.min(t.jobs, population);
  return {
    jobs: t.jobs,
    housing: t.housing,
    population,
    filledJobs: filled,
    unfilledJobs: Math.max(0, t.jobs - population),
    unemployed: Math.max(0, population - t.jobs),
    powerSupply: t.supply,
    powerDemand: t.demand,
    powerDeficit: gridActive ? Math.max(0, t.demand - t.supply) : 0,
    gridActive,
  };
}

/** Population moves 50% of the way toward housing each decade. */
export function growPopulation(pop: number, housing: number): number {
  return Math.max(0, Math.round(pop + (housing - pop) * POP_GROWTH));
}

export function decadeIncome(snap: EconomySnapshot, budgetMult: number): number {
  let income = (snap.filledJobs * INCOME_PER_JOB + BASE_GRANT) * budgetMult;
  if (snap.powerDeficit > 0) {
    // A power deficit cuts the economy proportionally to the share of demand unmet.
    income *= Math.max(0.3, 1 - snap.powerDeficit / Math.max(1, snap.powerDemand));
  }
  return Math.round(income);
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export interface MeterInputs {
  bushTiles: number;
  meanPollution: number;
  housingAir: number;
  reefWater: number;
}

export function measureTiles(state: GameState): MeterInputs {
  const g = state.grid;
  let bush = 0, reefN = 0, reefW = 0, total = 0;
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i];
    if (k === TileKind.Bush) bush++;
    if (k === TileKind.Reef) {
      reefN++;
      reefW += g.waterPollution[i] ?? 0;
    }
    total += (g.airPollution[i] ?? 0) + (g.waterPollution[i] ?? 0) + (g.soilContamination[i] ?? 0);
  }
  let hAir = 0, hN = 0;
  for (const b of workingBuildings(state)) {
    if (BUILDINGS[b.type].housing <= 0) continue;
    // Sample the air within 3 tiles of the housing, not just on it.
    const x0 = Math.max(0, b.x - 3), x1 = Math.min(g.w - 1, b.x + b.w + 2);
    const y0 = Math.max(0, b.y - 3), y1 = Math.min(g.h - 1, b.y + b.h + 2);
    let s = 0, n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { s += g.airPollution[y * g.w + x] ?? 0; n++; }
    const weight = BUILDINGS[b.type].housing;
    hAir += (s / Math.max(1, n)) * weight;
    hN += weight;
  }
  return {
    bushTiles: bush,
    meanPollution: total / Math.max(1, getScenario(state.scenarioId).pollutionRefTiles ?? g.kind.length),
    housingAir: hN > 0 ? hAir / hN : 0,
    reefWater: reefN > 0 ? reefW / reefN : 0,
  };
}

/** Act 2 multiplier on yearly income (relative to one tenth of an Act 1 decade's income). */
export const ACT2_INCOME_MULT = 1.5;
/** Yearly share of the housing gap that Act 2 population closes (matches 50% per decade). */
export const ACT2_POP_GROWTH = 1 - Math.pow(1 - POP_GROWTH, 1 / 10);

const ACT2_PHASES: readonly string[] = ['act2', 'epilogue', 'failed'];

/** Act 2 Economy / Society / Environment, see GAMEPLAY.md. Economy and Society reuse the Act 1 shape. */
function computeMetersAct2(state: GameState): Meters {
  const T = TUNING;
  const sc = getScenario(state.scenarioId);
  const dy = sc.endYear - sc.startYear;
  const snap = economySnapshot(state);
  const m = measureTiles(state);
  const jobsTarget = T.jobsTargetBase + T.jobsTargetPerYear * dy;
  const popTarget = T.popTargetBase + T.popTargetPerYear * dy;
  const scale = clamp01(snap.filledJobs / jobsTarget);
  const fill = snap.jobs > 0 ? snap.filledJobs / snap.jobs : 0;
  // lastIncome is per year in Act 2; Act 1's trend term was per decade.
  const budgetTrend = clamp01(0.5 + (state.lastIncome * 10 / ACT2_INCOME_MULT - 20) / 200);
  const power = 1 - clamp01(state.a2.lastUnmetFrac);
  const economy = 100 * (T.econScale * scale + T.econFill * fill + T.econBudget * budgetTrend + T.econPower * power);

  const housed = clamp01(snap.population / popTarget);
  const employed = snap.population > 0 ? clamp01(snap.filledJobs / (snap.population * 0.5)) : 0;
  const clean = 1 - clamp01(m.housingAir / T.housingAirBad);
  const society =
    100 * (T.socHoused * housed + T.socEmployed * employed + T.socAir * clean) -
    state.a2.stressSum / Math.max(1, state.a2.yearSeasons) * ACT2_STRESS_WEIGHT * (sc.modifiers.stressWeight ?? 1) +
    Math.max(-60, Math.min(20, state.a2.societyAdjust));

  const landScore = clamp01(meanHealth(state) / 0.6);
  const pollutionScore = 1 - clamp01(m.meanPollution / T.pollutionBad);
  const own = mechEnvScore(state);
  const marine = own !== null
    ? own
    : hasReef(state)
      ? 0.5 * estuaryHealth(state) / 100 + 0.5 * meanReefHealth(state)
      : estuaryHealth(state) / 100;
  const environment = 100 * (0.35 * landScore + 0.3 * pollutionScore + 0.35 * marine);
  const r = (v: number): number => Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;
  return { economy: r(economy), society: r(society), environment: r(environment) };
}

/** How strongly the year's average stress (events, blackouts) drags Society. */
export const ACT2_STRESS_WEIGHT = 1;

export function computeMeters(state: GameState): Meters {
  if (ACT2_PHASES.includes(state.phase)) return computeMetersAct2(state);
  const T = TUNING;
  const dy = Math.max(0, state.year - getScenario(state.scenarioId).startYear);
  const snap = economySnapshot(state);
  const m = measureTiles(state);

  const jobsTarget = T.jobsTargetBase + T.jobsTargetPerYear * dy;
  const popTarget = T.popTargetBase + T.popTargetPerYear * dy;
  const scale = clamp01(snap.filledJobs / jobsTarget);
  const fill = snap.jobs > 0 ? snap.filledJobs / snap.jobs : 0;
  const budgetTrend = clamp01(0.5 + (state.lastIncome - 20) / 200);
  const power = snap.powerDemand > 0 && snap.gridActive ? clamp01(1 - snap.powerDeficit / snap.powerDemand) : 1;
  const economy = 100 * (T.econScale * scale + T.econFill * fill + T.econBudget * budgetTrend + T.econPower * power);

  const housed = clamp01(snap.population / popTarget);
  const employed = snap.population > 0 ? clamp01(snap.filledJobs / (snap.population * 0.5)) : 0;
  const clean = 1 - clamp01(m.housingAir / T.housingAirBad);
  const society = 100 * (T.socHoused * housed + T.socEmployed * employed + T.socAir * clean) + state.residents.nudge;

  const bushFrac = state.initialBushTiles > 0 ? m.bushTiles / state.initialBushTiles : 1;
  const pollutionScore = 1 - clamp01(m.meanPollution / T.pollutionBad);
  const reef = reefHealth(state.tempC, m.reefWater);
  const bushScore = clamp01((bushFrac - T.bushFloor) / (1 - T.bushFloor));
  const environment = 100 * (T.envBush * bushScore + T.envPollution * pollutionScore + T.envReef * reef);

  const r = (v: number): number => Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;
  return { economy: r(economy), society: r(society), environment: r(environment) };
}

export interface Demand {
  text: string;
  items: string[];
}

/** Shortfall-driven demand banner for the decade that is starting. */
export function computeDemand(state: GameState): Demand {
  const s = economySnapshot(state);
  const items: string[] = [];
  const homesNeeded = Math.max(0, s.jobs - s.housing);
  if (s.unfilledJobs > 0 && s.housing < s.jobs) {
    items.push(`${Math.ceil(homesNeeded / 10) * 10} new workers' homes (${s.unfilledJobs} jobs are unfilled)`);
  }
  if (s.gridActive && s.powerDeficit > 0) {
    items.push(`power for the factories and homes (${s.powerDeficit} units short)`);
  } else if (state.year >= GRID_YEAR - 10 && !s.gridActive && s.powerDemand > 0) {
    items.push('plan for electricity - the grid starts in 1920');
  }
  if (s.unemployed > 20) items.push(`work for ${s.unemployed} people without jobs`);
  const text = items.length ? `Your town needs: ${items.join('; ')}.` : 'Your town needs: nothing urgent right now. What will you build next?';
  return { text, items };
}

// ---------------------------------------------------------------- demand bars (HUD block)

export type DemandBarId = 'homes' | 'jobs' | 'power' | 'water';

export interface DemandBar {
  id: DemandBarId;
  label: string;
  /** -1 (far too many / plenty) .. 0 (balanced) .. +1 (badly needs more). */
  need: number;
  level: 'short' | 'ok' | 'plenty';
  /** A shortage bad enough to pulse. */
  urgent: boolean;
  /** True when the thing does not matter yet (no electricity grid before 1920). */
  inactive: boolean;
  /** One line, plain English, for the tooltip. */
  tip: string;
}

/** A bar this far from balanced counts as short / plenty. */
export const DEMAND_OK_BAND = 0.1;
/** A shortage this big pulses. */
export const DEMAND_URGENT = 0.35;

const cl = (v: number, a = -1, b = 1): number => Math.max(a, Math.min(b, v));
const r2 = (v: number): number => Math.round(v * 100) / 100;

function mkBar(id: DemandBarId, label: string, needRaw: number, tipShort: string, tipOk: string, tipPlenty: string, forceUrgent = false, inactive = false): DemandBar {
  const need = r2(cl(needRaw));
  const level = inactive ? 'ok' : need >= DEMAND_OK_BAND ? 'short' : need <= -DEMAND_OK_BAND ? 'plenty' : 'ok';
  return {
    id, label, need: inactive ? 0 : need, level, inactive,
    urgent: !inactive && (forceUrgent || need >= DEMAND_URGENT),
    tip: level === 'short' ? tipShort : level === 'plenty' ? tipPlenty : tipOk,
  };
}

/**
 * Persistent HUD demand bars (Homes, Jobs, Power, and Water where the scenario has a water metric). Pure and cheap.
 * `need` is positive when the town wants more of the thing and negative when it has more than it can use.
 */
export function demandBars(state: GameState): DemandBar[] {
  const s = economySnapshot(state);
  const bars: DemandBar[] = [];

  // Homes: people the town wants (workers for the jobs, or people already here) against the room to house them.
  const wanted = Math.max(s.jobs, s.population);
  bars.push(mkBar('homes', 'Homes',
    (wanted - s.housing) / Math.max(wanted, s.housing, 1),
    s.population > s.housing
      ? `Not enough homes: ${s.population} people but room for ${s.housing}. Build more homes.`
      : `Not enough homes: ${s.jobs} jobs but room for only ${s.housing} people. Build homes so the jobs get filled.`,
    'Homes and jobs are about even. Nice.',
    `Plenty of homes: room for ${s.housing} people and only ${wanted} wanted. Some will sit empty until you add jobs.`));

  // Jobs: people without work against jobs nobody is here to do.
  bars.push(mkBar('jobs', 'Jobs',
    (s.unemployed - s.unfilledJobs) / Math.max(s.jobs, s.population, 1),
    `Not enough jobs: ${s.unemployed} people have no work. Build farms, shops or factories.`,
    'Jobs and workers are about even. Nice.',
    `Too many jobs: ${s.unfilledJobs} jobs have nobody to do them. Build homes so more people move in.`));

  // Power: Act 2 reads the last season's grid (worst of day and night); Act 1 reads building supply and demand.
  const gr = state.phase === 'act2' ? state.a2.lastGrid : null;
  if (gr) {
    const worst = (b: { demand: number; supply: number; unmet: number }): number =>
      b.unmet > 0.01 ? b.unmet / Math.max(b.demand, 1) : (b.demand - b.supply) / Math.max(b.demand, b.supply, 1);
    const need = Math.max(worst(gr.day), worst(gr.night));
    const blackout = gr.blackout || gr.unmetFrac > 0.02;
    bars.push(mkBar('power', 'Power', need,
      blackout
        ? `Blackout: ${Math.round(gr.unmetFrac * 100)}% of the power people wanted was missing. Build more generation or storage.`
        : 'Power is tight at the busiest time. Add more generation or a battery.',
      'Power supply matches demand.',
      'Power to spare, even at the busiest time.', blackout));
  } else {
    const early = !s.gridActive;
    const inactive = early && !(state.year >= GRID_YEAR - 10 && s.powerDemand > 0);
    bars.push(mkBar('power', 'Power',
      early ? 0 : (s.powerDemand - s.powerSupply) / Math.max(s.powerDemand, s.powerSupply, 1),
      `Power is short by ${s.powerDeficit} units. Build a power station.`,
      early ? 'The electricity grid starts in 1920.' : 'Power supply matches demand.',
      `Power to spare: ${s.powerSupply} units made, ${s.powerDemand} used.`,
      s.powerDeficit > 0 && s.powerDeficit >= 0.25 * Math.max(1, s.powerDemand), inactive));
  }

  // Water, only where a scenario tracks it (River Town: environmental flow; Red Dirt: the aquifer).
  if (state.phase === 'act2' || state.phase === 'turning-point') {
    const mech = getScenario(state.scenarioId).mechanics ?? [];
    const flow = mech.includes('river') ? mechMetric(state, 'envFlowPct') : null;
    const aq = mech.includes('outback') ? mechMetric(state, 'aquifer') : null;
    if (flow !== null) {
      bars.push(mkBar('water', 'Water', (90 - flow) / 45,
        `The river is running low: only ${flow}% of its flow is staying in it. Cut back on what the farms and town take.`,
        'The river has enough water for the town, farms and fish.',
        'The river is healthy and flowing well.', flow <= 65));
    } else if (aq !== null) {
      bars.push(mkBar('water', 'Water', (75 - aq) / 40,
        `The underground water is running low (${Math.round(aq)}% left). Save water and use fewer bores.`,
        'The underground water is holding up.',
        'The underground water is healthy.', aq <= 61));
    }
  }
  return bars;
}
