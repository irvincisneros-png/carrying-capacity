import { getFactForDecade } from '../content/facts';
import { BUILDINGS, footprintFor, isBuildingId } from './buildings';
import { climateAt, referenceCumulative } from './climate';
import { computeDemand, computeMeters, decadeIncome, economySnapshot, growPopulation } from './economy';
import { enterTurningPoint } from './act2';
import { applyLayerAction, emptyLayers, layersDecadeMoods, layersDecadeStory, onDemolishedBuilding, onPlaced } from './layers';
import { updatePollution } from './pollution';
import { bumpRect } from './restoration';
import { cloneState, emptyAct2, emptyEmissions } from './state';
import { realCO2, realTemp } from './realData';
import { buildingAt, canPlace, CLEAR_COST, CLEAR_KT_PER_TILE, DEMOLISH_REFUND, availability, isPlayable } from './rules';
import { mulberry32 } from './rng';
import { getScenario, isScenarioId } from './scenarios';
import { generateTerrain, inBounds } from './terrain';
import { EMISSION_CATEGORIES, TileKind } from './types';
import type {
  Action, ActionResult, BuildingId, DecadeReport, EmissionsBySource, GameState, HistoryRecord, Meters, PlacedBuilding, Rotation,
} from './types';

/**
 * v2 adds Act 2 (phase, a2, flags, events, restoration grids). v3 adds the empathy-and-care layers (residents, dilemmas,
 * wildlife, Country, circular, satellites) and the significant-places grid. v1 and v2 saves are migrated in save.ts.
 */
export const SAVE_VERSION = 3;
export const DECADE_YEARS = 10;

export { cloneState, emptyEmissions };

/** Parse a `?seed=` style value; returns undefined if not a usable non-negative integer. */
export function parseSeed(v: string | null | undefined): number | undefined {
  if (v == null || !/^\d{1,10}$/.test(v)) return undefined;
  const n = Number(v);
  return n <= 4294967295 ? n : undefined;
}

export function createGame(scenarioId: GameState['scenarioId'], seed?: number): GameState {
  if (!isScenarioId(scenarioId)) throw new Error(`Unknown scenario: ${String(scenarioId)}`);
  const sc = getScenario(scenarioId);
  const s = (seed ?? sc.seed) >>> 0;
  const grid = generateTerrain(sc, s);
  let bush = 0;
  for (let i = 0; i < grid.kind.length; i++) if (grid.kind[i] === TileKind.Bush) bush++;
  // Scenarios that start after 1850 inherit the reference world's legacy emissions so m starts near 1.
  const legacy = sc.startYear > 1850 ? referenceCumulative(sc.startYear) : 0;
  const clim = climateAt(sc.startYear, legacy, sc.modifiers.climateSensitivityMult);
  const base: GameState = {
    saveVersion: SAVE_VERSION,
    scenarioId,
    seed: s,
    year: sc.startYear,
    status: 'playing',
    budget: Math.round(sc.startBudget * sc.modifiers.budgetMult),
    population: 0,
    lastIncome: 0,
    grid,
    buildings: [],
    nextUid: 1,
    pendingLandKt: 0,
    cumulativeKt: legacy,
    co2: clim.co2,
    tempC: clim.tempC,
    multiplier: clim.m,
    meters: { economy: 0, society: 0, environment: 0 },
    history: [],
    initialBushTiles: bush,
    version: 0,
    phase: 'act1',
    a2: emptyAct2(sc.act2.startYear, clim.tempC),
    flags: {},
    events: [],
    eventLog: [],
    turningPoint: null,
    ...emptyLayers(scenarioId),
  };
  const meters = computeMeters(base);
  base.meters = meters;
  base.history.push(record(base, emptyEmissions(), 0));
  return base;
}

function record(s: GameState, emissions: EmissionsBySource, total: number): HistoryRecord {
  return {
    year: s.year,
    co2: s.co2,
    realCo2: realCO2(s.year),
    tempC: s.tempC,
    realTempC: realTemp(s.year),
    multiplier: s.multiplier,
    emissionsKt: { ...emissions },
    totalKt: total,
    meters: { ...s.meters },
    population: s.population,
    budget: s.budget,
  };
}

function allocUid(s: GameState): number {
  const used = new Set(s.buildings.map((b) => b.uid));
  let uid = s.nextUid;
  for (let n = 0; n < 65535; n++) {
    if (uid > 65535) uid = 1;
    if (!used.has(uid)) {
      s.nextUid = uid + 1;
      return uid;
    }
    uid++;
  }
  throw new Error('Too many buildings');
}

export function applyAction(state: GameState, action: Action): { state: GameState; result: ActionResult } {
  const fail = (code: NonNullable<ActionResult['code']>, reason: string) => ({
    state,
    result: { ok: false, code, reason } as ActionResult,
  });
  const storyAction = action.type === 'respond' || action.type === 'choose';
  if (!isPlayable(state) && !(storyAction && state.phase === 'turning-point')) return fail('game-over', 'This act is finished');

  switch (action.type) {
    case 'place': {
      if (!isBuildingId(action.building)) return fail('unknown-building', 'Unknown building');
      const rot: Rotation = action.rotation ?? 0;
      const chk = canPlace(state, action.building, action.x, action.y, rot);
      if (!chk.ok) return fail(chk.code ?? 'bad-terrain', chk.reason ?? 'Cannot build here');
      const next = cloneState(state);
      const def = BUILDINGS[action.building];
      const { w, h } = footprintFor(def, rot);
      const g = next.grid;
      let replacedOld: PlacedBuilding | undefined;
      if (def.replaces) {
        const old = buildingAt(next, action.x, action.y);
        if (old) {
          replacedOld = old;
          for (let yy: number = old.y; yy < old.y + old.h; yy++) {
            for (let xx: number = old.x; xx < old.x + old.w; xx++) g.building[yy * g.w + xx] = 0;
          }
          next.buildings = next.buildings.filter((o) => o.uid !== old.uid);
        }
      }
      const uid = allocUid(next);
      const placed: PlacedBuilding = { uid, type: action.building, x: action.x, y: action.y, rotation: rot, w, h, builtYear: state.year };
      next.buildings.push(placed);
      for (let yy: number = action.y; yy < action.y + h; yy++) {
        for (let xx: number = action.x; xx < action.x + w; xx++) {
          const i = yy * g.w + xx;
          g.building[i] = uid;
          g.health[i] = 0;
          g.stage[i] = 0;
          g.weed[i] = 0;
          if (g.kind[i] === TileKind.Bush) g.kind[i] = TileKind.Land;
        }
      }
      bumpRect(g, action.x, action.y, w, h);
      next.pendingLandKt += chk.bushCleared * CLEAR_KT_PER_TILE;
      next.budget -= chk.cost;
      onPlaced(next, placed, replacedOld);
      next.meters = computeMeters(next);
      next.version = state.version + 1;
      return { state: next, result: { ok: true, spent: chk.cost, uid } };
    }
    case 'demolish': {
      const b = buildingAt(state, action.x, action.y);
      if (!b) return fail('nothing-here', 'There is nothing to demolish here');
      const next = cloneState(state);
      const g = next.grid;
      for (let yy: number = b.y; yy < b.y + b.h; yy++) {
        for (let xx: number = b.x; xx < b.x + b.w; xx++) g.building[yy * g.w + xx] = 0;
      }
      bumpRect(g, b.x, b.y, b.w, b.h);
      next.buildings = next.buildings.filter((o) => o.uid !== b.uid);
      const refund = Math.floor(availability(state.scenarioId, b.type).cost * DEMOLISH_REFUND);
      next.budget += refund;
      onDemolishedBuilding(next, b);
      next.meters = computeMeters(next);
      next.version = state.version + 1;
      return { state: next, result: { ok: true, refund } };
    }
    case 'clear': {
      if (state.phase === 'act2') return fail('locked', 'Bushland is protected now - restore it, do not clear it');
      if (!inBounds(state.grid, action.x, action.y)) return fail('out-of-bounds', "That isn't on the map");
      const i = action.y * state.grid.w + action.x;
      if (state.grid.kind[i] !== TileKind.Bush) return fail('not-bush', 'Only bushland can be cleared');
      if (state.budget < CLEAR_COST) return fail('no-funds', `Not enough money: clearing costs ${CLEAR_COST}`);
      const next = cloneState(state);
      next.grid.kind[i] = TileKind.Land;
      next.pendingLandKt += CLEAR_KT_PER_TILE;
      next.budget -= CLEAR_COST;
      next.meters = computeMeters(next);
      next.version = state.version + 1;
      return { state: next, result: { ok: true, spent: CLEAR_COST } };
    }
    default:
      return applyLayerAction(state, action);
  }
}

/** Emissions the current set of buildings will produce over one decade (excludes one-off clearing). */
export function projectedEmissions(state: GameState): EmissionsBySource {
  const e = emptyEmissions();
  for (const b of state.buildings) e[BUILDINGS[b.type].category] += BUILDINGS[b.type].co2;
  return e;
}

export function advanceDecade(state: GameState): { state: GameState; report: DecadeReport | null } {
  if (state.phase !== 'act1' || state.status !== 'playing') return { state, report: null };
  const sc = getScenario(state.scenarioId);
  const next = cloneState(state);
  const prevMeters: Meters = { ...state.meters };

  // 1. Emissions over the decade just played.
  const em = projectedEmissions(state);
  em.land += state.pendingLandKt;
  next.pendingLandKt = 0;
  const total = EMISSION_CATEGORIES.reduce((n, c) => n + em[c], 0);

  // 2. Local pollution spreads / decays.
  updatePollution(next.grid, next.buildings);

  // 3. Economy: population then income.
  next.population = growPopulation(state.population, economySnapshot(state).housing);
  const snap = economySnapshot(next);
  next.lastIncome = decadeIncome(snap, sc.modifiers.budgetMult);
  next.budget += next.lastIncome;

  // 4. Climate for the new year.
  next.year = state.year + DECADE_YEARS;
  next.cumulativeKt = state.cumulativeKt + total;
  const clim = climateAt(next.year, next.cumulativeKt, sc.modifiers.climateSensitivityMult);
  next.multiplier = clim.m;
  next.co2 = clim.co2;
  next.tempC = clim.tempC;

  // 5. Meters, residents' moods (a light nudge to Society), history.
  next.meters = computeMeters(next);
  layersDecadeMoods(next);
  next.meters = computeMeters(next);
  next.history.push(record(next, em, total));
  if (next.year >= sc.endYear) {
    next.status = 'act1-complete';
    enterTurningPoint(next);
  }
  layersDecadeStory(next);
  next.version = state.version + 1;

  const demand = computeDemand(next);
  let top = EMISSION_CATEGORIES[0] ?? 'power';
  for (const c of EMISSION_CATEGORIES) if (em[c] > em[top]) top = c;
  const report: DecadeReport = {
    fromYear: state.year,
    toYear: next.year,
    emissionsKt: { ...em },
    totalKt: total,
    topSource: top,
    co2Ppm: next.co2,
    realCo2Ppm: realCO2(next.year),
    tempC: next.tempC,
    realTempC: realTemp(next.year),
    deltaCo2: next.co2 - state.co2,
    deltaTempC: next.tempC - state.tempC,
    meters: { ...next.meters },
    meterDeltas: {
      economy: next.meters.economy - prevMeters.economy,
      society: next.meters.society - prevMeters.society,
      environment: next.meters.environment - prevMeters.environment,
    },
    population: next.population,
    income: next.lastIncome,
    demand: demand.text,
    demandItems: demand.items,
    fact: getFactForDecade(state.year),
    actComplete: next.status === 'act1-complete',
  };
  return { state: next, report };
}

export function getMeters(state: GameState): Meters {
  return state.meters;
}

export function currentDemand(state: GameState): { text: string; items: string[] } {
  return computeDemand(state);
}

/** CSV export for 4.2.2 data-analysis tasks. Emission columns are for the decade that ended at that year. */
export function toCSV(state: GameState): string {
  const head = [
    'year', 'your_co2_ppm', 'real_co2_ppm', 'your_temp_c', 'real_temp_c',
    'power_kt', 'industry_kt', 'transport_kt', 'land_kt', 'waste_kt', 'total_kt',
  ];
  const f = (n: number, d = 2): string => n.toFixed(d);
  const rows = state.history.map((r) =>
    [
      String(r.year), f(r.co2), f(r.realCo2), f(r.tempC), f(r.realTempC),
      ...EMISSION_CATEGORIES.map((c) => f(r.emissionsKt[c], 1)), f(r.totalKt, 1),
    ].join(','),
  );
  return [head.join(','), ...rows].join('\n') + '\n';
}

/** Helper used by tests/tools; keeps mulberry in the public surface for deterministic scripting. */
export const makeRng = mulberry32;

export type { BuildingId };
