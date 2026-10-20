import { BUILDINGS } from './buildings';
import { climateAt } from './climate';
import { ACT2_INCOME_MULT, ACT2_POP_GROWTH, computeMeters, economySnapshot, INCOME_PER_JOB, BASE_GRANT } from './economy';
import { balanceGrid } from './energy';
import { emit, makeCtx, rollEvents } from './events';
import { estuaryHealth, meanHealth, meanReefHealth } from './metrics';
import { mechEmissionFactor, mechIncome, mechMetric } from './mechanics';
import { objectiveStatus } from './objectives';
import { recordOutlook } from './outlook';
import { applyRemediation, applyWetlands, REMEDIATION_IDLE, updatePollutionSeason } from './pollution';
import { realTemp } from './realData';
import {
  buildRestoreCtx, bumpChangedChunks, fingerprint, initRestoration, stepReef, stepSuccession,
} from './restoration';
import type { RestoreCtx } from './restoration';
import { MICRO, seasonIndexOf } from './season';
import { getScenario } from './scenarios';
import { beginAct2, layersSeason, layersYearEnd } from './layers';
import { wasteEmissionsMult } from './circular';
import { cloneState, emptyAct2, emptyEmissions } from './state';
import { EMISSION_CATEGORIES, TileKind } from './types';
import type { Season, SimEvent, GameState, Outcome, YearRecord } from './types';

/** Time constant (years) for committed warming: T relaxes towards equilibrium with this lag. */
export const WARMING_TAU_YEARS = 20;

export interface TickResult {
  state: GameState;
  /** Whole seasons processed by this call. */
  seasons: number;
  /** Events raised during this call (also appended to state.events / state.eventLog). */
  events: SimEvent[];
  /** Chunk indices (see TileGrid.chunkVersion) whose restoration layer changed. */
  dirtyChunks: number[];
}

/** Called when Act 1 completes: records the crisis card and moves to the turning point. Mutates `s`. */
export function enterTurningPoint(s: GameState): void {
  const sc = getScenario(s.scenarioId);
  const tp = sc.act2.turningPoint;
  let bush = 0;
  for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.Bush) bush++;
  s.phase = 'turning-point';
  s.turningPoint = {
    ...tp,
    stats: {
      year: s.year,
      co2: s.co2,
      tempC: s.tempC,
      realTempC: realTemp(s.year),
      cumulativeKt: s.cumulativeKt,
      estuaryHealth: estuaryHealth(s),
      bushRemaining: s.initialBushTiles > 0 ? bush / s.initialBushTiles : 1,
      meters: { ...s.meters },
    },
  };
  emit(s, { type: 'story', year: s.year, season: 0, seasonIndex: 0, severity: 1, text: `${tp.title}. ${tp.text}`, data: {} });
}

/** What happens to the Act 1 savings at the start of Act 2 (for the turning-point screen and startAct2). */
export function carryOverPlan(state: Pick<GameState, 'scenarioId' | 'budget'>): { keep: number; fund: number; drip: number; years: number; lost: number } | null {
  const a2 = getScenario(state.scenarioId).act2;
  const cap = a2.carryOverCap;
  if (cap === undefined || state.budget <= cap) return null;
  const surplus = state.budget - cap;
  const years = a2.fundYears ?? 0;
  const fund = years > 0 ? Math.round(surplus * (a2.fundShare ?? 1)) : 0;
  const drip = years > 0 ? Math.round(fund / years) : 0;
  return { keep: cap, fund: drip * years, drip, years, lost: Math.round(surplus - drip * years) };
}

function applyCarryOver(s: GameState): void {
  const p = carryOverPlan(s);
  if (!p) return;
  s.budget = p.keep;
  if (p.drip > 0) {
    s.flags['fund.left'] = p.fund;
    s.flags['fund.drip'] = p.drip;
  }
}

/** Pays this year's Transition Fund instalment (if any). Returns the amount paid. */
function payFund(s: GameState): number {
  const left = typeof s.flags['fund.left'] === 'number' ? s.flags['fund.left'] : 0;
  const drip = typeof s.flags['fund.drip'] === 'number' ? s.flags['fund.drip'] : 0;
  if (left <= 0 || drip <= 0) return 0;
  const pay = Math.min(left, drip);
  s.flags['fund.left'] = left - pay;
  s.budget += pay;
  return pay;
}

/**
 * Starts Act 2 from the turning point. Years between Act 1's end and the scenario's Act 2 start year are
 * fast-forwarded with the full economy / grid / pollution / climate model but no random events and no player actions.
 */
export function startAct2(state: GameState): GameState {
  if (state.phase !== 'turning-point') return state;
  const sc = getScenario(state.scenarioId);
  const s = cloneState(state);
  s.phase = 'act2';
  s.status = 'playing';
  s.a2 = emptyAct2(sc.act2.startYear, s.tempC);
  s.a2.nextEventId = state.a2.nextEventId;
  applyCarryOver(s);
  initRestoration(s);
  s.meters = computeMeters(s);
  const rctx = buildRestoreCtx(s);
  let guard = 0;
  while (s.year < sc.act2.startYear && s.phase === 'act2' && guard++ < 4000) processSeason(s, rctx, true);
  beginAct2(s);
  s.meters = computeMeters(s);
  for (const c of s.grid.chunkVersion.keys()) s.grid.chunkVersion[c] = ((s.grid.chunkVersion[c] ?? 0) + 1) >>> 0;
  s.version = state.version + 1;
  return s;
}

/**
 * Advance the Act 2 clock by `dtYears`. Whole seasons are simulated deterministically (4 per year), so
 * tick(1.0), 4 x tick(0.25) and 100 x tick(0.01) give identical states. dt is rounded to 1e-6 of a season.
 */
export function tick(state: GameState, dtYears: number): TickResult {
  if (state.phase !== 'act2' || !(dtYears > 0)) return { state, seasons: 0, events: [], dirtyChunks: [] };
  const total = state.a2.clockMicro + Math.round(dtYears * 4 * MICRO);
  const n = Math.floor(total / MICRO);
  if (n === 0) {
    return { state: { ...state, a2: { ...state.a2, clockMicro: total } }, seasons: 0, events: [], dirtyChunks: [] };
  }
  const s = cloneState(state);
  s.a2.clockMicro = total - n * MICRO;
  const rctx = buildRestoreCtx(s);
  const events: SimEvent[] = [];
  const dirty = new Set<number>();
  let done = 0;
  for (let k = 0; k < n && s.phase === 'act2'; k++) {
    events.push(...processSeason(s, rctx, false, dirty));
    done++;
  }
  if (s.phase !== 'act2') s.a2.clockMicro = 0;
  return { state: s, seasons: done, events, dirtyChunks: Array.from(dirty).sort((a, b) => a - b) };
}

/** Convenience: advance exactly `seasons` whole seasons. */
export function tickSeasons(state: GameState, seasons: number): TickResult {
  return tick(state, seasons / 4);
}

/** Simulates the current season in place and advances the calendar (running the year-end step when due). */
export function processSeason(s: GameState, rctx: RestoreCtx, quiet: boolean, dirty?: Set<number>): SimEvent[] {
  const a2 = s.a2;
  const before = fingerprint(s.grid);
  const idx = seasonIndexOf(s);
  const season = a2.season;
  const emitted: SimEvent[] = [];
  const firstId = a2.nextEventId;
  a2.active = a2.active.filter((e) => e.endsAt > idx);

  if (!quiet) emitted.push(...rollEvents(makeCtx(s, idx, null, rctx), 'pre'));

  const gr = balanceGrid(s, idx);
  a2.storageLevel = gr.storageLevel;
  a2.utilisation = gr.utilisation;
  a2.lastGrid = gr.report;

  updatePollutionSeason(s.grid, s.buildings, (b) => {
    const e = BUILDINGS[b.type].energy;
    return e && (e.source === 'coal' || e.source === 'gas') ? (a2.utilisation[String(b.uid)] ?? 0) : 1;
  });
  a2.activeRemediation = applyRemediation(s, s.grid);
  applyWetlands(s, s.grid);

  // Emissions: grid output for power, static (per decade / 40) for everything else; excavation trucks only while digging.
  a2.yearEm.power += gr.report.emissionsKt;
  for (const b of s.buildings) {
    const def = BUILDINGS[b.type];
    if (def.category === 'power' || def.co2 <= 0) continue;
    if (def.remediation?.method === 'excavate' && !a2.activeRemediation.includes(b.uid)) continue;
    a2.yearEm[def.category] += (def.co2 / 40) * mechEmissionFactor(s, b);
  }

  if (!quiet) emitted.push(...rollEvents(makeCtx(s, idx, gr.report, rctx), 'post'));

  stepReef(s);
  stepSuccession(s, rctx, idx, season);
  if (!quiet) layersSeason(s, emitted, idx);

  a2.stressSum += a2.stress;
  a2.yearSeasons += 1;
  a2.yearUnmetSum += gr.report.unmetFrac;
  a2.stress *= 0.75;

  for (const c of bumpChangedChunks(s.grid, before)) dirty?.add(c);
  s.version += 1;
  if (season === 3) {
    yearEnd(s, quiet);
  } else {
    a2.season = (season + 1) as Season;
  }
  // Everything raised this season, including story events from the empathy layers.
  return a2.nextEventId > firstId ? s.eventLog.filter((e) => e.id >= firstId) : emitted;
}

function yearEnd(s: GameState, quiet: boolean): void {
  const sc = getScenario(s.scenarioId);
  const a2 = s.a2;
  const em = a2.yearEm;
  em.land += s.pendingLandKt;
  s.pendingLandKt = 0;
  em.waste *= wasteEmissionsMult(s);
  const total = EMISSION_CATEGORIES.reduce((n, c) => n + em[c], 0);
  const unmet = a2.yearSeasons > 0 ? a2.yearUnmetSum / a2.yearSeasons : 0;
  a2.lastUnmetFrac = unmet;

  // Economy: population drifts to housing, income from filled jobs (cut by blackouts).
  const housing = economySnapshot(s).housing;
  s.population = Math.max(0, Math.round(s.population + (housing - s.population) * ACT2_POP_GROWTH));
  const snap = economySnapshot(s);
  const income = ((snap.filledJobs * INCOME_PER_JOB + BASE_GRANT) * sc.modifiers.budgetMult / 10) * ACT2_INCOME_MULT * (1 - 0.8 * unmet);
  const incomeAdj = typeof s.flags['income.adj'] === 'number' ? s.flags['income.adj'] : 0;
  s.lastIncome = Math.round(income + incomeAdj + mechIncome(s));
  s.budget += s.lastIncome;
  payFund(s);

  // Climate: emissions -> CO2 -> equilibrium temperature; actual temperature lags (committed warming).
  s.cumulativeKt += total;
  s.year += 1;
  a2.season = 0;
  const clim = climateAt(s.year, s.cumulativeKt, sc.modifiers.climateSensitivityMult, sc.modifiers.emissionScale ?? 1);
  s.multiplier = clim.m;
  s.co2 = clim.co2;
  a2.eqTempC = clim.tempC;
  s.tempC += (clim.tempC - s.tempC) * (1 - Math.exp(-1 / WARMING_TAU_YEARS));
  if (!quiet) layersYearEnd(s);

  s.meters = computeMeters(s);
  for (const k of ['economy', 'society', 'environment'] as const) {
    a2.zeroYears[k] = s.meters[k] <= 0 ? a2.zeroYears[k] + 1 : 0;
  }
  const rec: YearRecord = {
    year: s.year, co2: s.co2, tempC: s.tempC, eqTempC: a2.eqTempC,
    emissionsKt: { ...em }, totalKt: total, meters: { ...s.meters }, budget: s.budget, population: s.population,
    unmetFrac: unmet, renewableShare: a2.lastGrid?.renewableShare ?? 0,
    estuaryHealth: estuaryHealth(s), meanHealth: meanHealth(s), reefHealth: meanReefHealth(s),
  };
  if (sc.mechanics?.includes('river')) rec.riverHealth = mechMetric(s, 'riverHealth') ?? undefined;
  a2.yearly.push(rec);
  recordOutlook(s);
  a2.yearEm = emptyEmissions();
  a2.stressSum = 0;
  a2.yearSeasons = 0;
  a2.yearUnmetSum = 0;

  // Fail / finish.
  {
    if (s.tempC > sc.act2.warmingCap) {
      s.phase = 'failed';
      s.status = 'failed';
      a2.failure = {
        reason: 'warming-cap', year: s.year,
        text: `Warming reached ${s.tempC.toFixed(1)} C, past the ${sc.act2.warmingCap.toFixed(1)} C the town could adapt to.`,
      };
      return;
    }
    for (const k of ['economy', 'society', 'environment'] as const) {
      if (a2.zeroYears[k] >= sc.act2.meterFailYears) {
        s.phase = 'failed';
        s.status = 'failed';
        a2.failure = {
          reason: 'meter-collapse', year: s.year,
          text: `${k[0]?.toUpperCase()}${k.slice(1)} stayed at zero for ${a2.zeroYears[k]} years. The town could not hold on.`,
        };
        return;
      }
    }
  }
  if (s.year >= sc.act2.endYear) {
    s.phase = 'epilogue';
    s.status = 'act2-complete';
    const objectives = objectiveStatus(s);
    const required = objectives.filter((o) => !o.bonus);
    const outcome: Outcome = {
      year: s.year,
      success: required.every((o) => o.status === 'met' || o.status === 'pending'),
      objectives,
      pendingRequired: required.filter((o) => o.status === 'pending').map((o) => o.id),
    };
    a2.outcome = outcome;
  }
}

/** Is excavation currently trucking? (idle sites emit nothing) */
export function isRemediationActive(state: GameState, uid: number): boolean {
  return state.a2.activeRemediation.includes(uid);
}

export { REMEDIATION_IDLE };
