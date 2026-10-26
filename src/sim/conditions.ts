/**
 * Shared vocabulary for the story layers: a catalogue of numeric "metrics" read from the game state, simple
 * threshold tests on them (Cond), and {placeholder} text rendering so characters can quote the player's own numbers.
 */
import { BUILDINGS } from './buildings';
import { estuaryHealth, meanHealth, meanReefHealth } from './metrics';
import { measureTiles, economySnapshot } from './economy';
import { MECH_METRIC_KEYS, mechMetric } from './mechanics';
import { realCO2, realTemp } from './realData';
import { landSnapshot } from './ledger';
import { co2Of } from './upgrades';
import { roadAccess, workingBuildings } from './roads';
import { seasonIndexOf } from './season';
import { TileKind } from './types';
import type { BuildingId, GameState, Phase } from './types';

export type CompareOp = '>=' | '<=' | '>' | '<' | '==';

/** `pop.<species>`, `mood.<resident>`, `flag.<key>`, `count.<building>`, `connected.<building>` (joined to the road in), `acts.<key>`, `recent.<eventType>`, ... */
export type MetricKey = string;

export interface MetricTest {
  m: MetricKey;
  op: CompareOp;
  v: number;
}

/** A condition. Empty fields are ignored; every given field must pass. */
export interface Cond {
  phase?: readonly Phase[];
  /** Inclusive calendar-year range. */
  years?: readonly [number, number];
  /** Every test must hold. */
  all?: readonly MetricTest[];
  /** At least one test must hold (when given). */
  any?: readonly MetricTest[];
}

/** Shorthand constructor used by content files. */
export const t = (m: MetricKey, op: CompareOp, v: number): MetricTest => ({ m, op, v });

/** Building types whose jobs count as the steel / heavy-industry sector (old and repurposed). */
export const HEAVY_TYPES: readonly BuildingId[] = [
  'steelworks', 'greensteel', 'makerspace', 'port', 'windport', 'factory', 'recycler', 'coalmine',
];

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function countBuildings(state: GameState, type: BuildingId): number {
  let n = 0;
  for (const b of state.buildings) if (b.type === type) n++;
  return n;
}

export function heavyJobs(state: GameState): number {
  let n = 0;
  for (const b of state.buildings) if (HEAVY_TYPES.includes(b.type)) n += BUILDINGS[b.type].jobs;
  return n;
}

/** Jobs in buildings that only exist in the clean economy (Act 2 only buildings). */
export function cleanJobs(state: GameState): number {
  let n = 0;
  for (const b of state.buildings) {
    const ph = BUILDINGS[b.type].phases;
    if (ph && ph.length === 1 && ph[0] === 'act2') n += BUILDINGS[b.type].jobs;
  }
  return n;
}

/** Events of one type in the last `years` calendar years. */
export function recentEvents(state: GameState, type: string, years: number): number {
  let n = 0;
  for (const e of state.eventLog) if (e.type === type && e.year >= state.year - years) n++;
  return n;
}

function isActive(state: GameState, type: string): boolean {
  if (state.phase !== 'act2') return false;
  const idx = seasonIndexOf(state);
  return state.a2.active.some((e) => e.type === type && e.endsAt > idx);
}

/** Emissions this year (kt): the last full year in Act 2, otherwise a decade projection spread over ten years. */
export function currentEmissionsKt(state: GameState): number {
  const y = state.a2.yearly;
  if (state.phase !== 'act1' && state.phase !== 'turning-point' && y.length > 0) return y[y.length - 1]?.totalKt ?? 0;
  let kt = 0;
  for (const b of workingBuildings(state)) kt += co2Of(b);
  return kt / 10;
}

export function peakEmissionsKt(state: GameState): number {
  let m = currentEmissionsKt(state);
  for (const r of state.a2.yearly) m = Math.max(m, r.totalKt);
  for (let i = 1; i < state.history.length; i++) m = Math.max(m, (state.history[i]?.totalKt ?? 0) / 10);
  return m;
}

export function renewablePct(state: GameState): number {
  return Math.round((state.a2.lastGrid?.renewableShare ?? 0) * 100);
}

export function airQuality(state: GameState): number {
  return Math.round((1 - clamp(measureTiles(state).housingAir / 9, 0, 1)) * 100);
}

export function speciesAlive(state: GameState): number {
  let n = 0;
  for (const k of Object.keys(state.wildlife.species)) if ((state.wildlife.species[k]?.pop ?? 0) > 0) n++;
  return n;
}

export function meanMood(state: GameState): number {
  const ids = Object.keys(state.residents.list);
  if (ids.length === 0) return 50;
  let s = 0;
  for (const id of ids) s += state.residents.list[id]?.mood ?? 50;
  return s / ids.length;
}

function legacyPct(state: GameState): number {
  const v = state.flags['metric.act1Repurposed'];
  return typeof v === 'number' ? v : 0;
}

/** Metric keys that stand alone; the rest are `prefix.<name>` (see METRIC_PREFIXES). */
export const STATIC_METRICS: readonly string[] = [
  'year', 'tempC', 'co2', 'realCo2', 'realTempC', 'estuary', 'society', 'economy', 'environment', 'population', 'bushPct',
  'healthPct', 'reefPct', 'employment', 'unmetPct', 'renewablePct', 'emissionsKt', 'peakKt', 'emissionsPct', 'airQuality',
  'partnership', 'wildlifeAlive', 'legacyPct', 'drought', 'heatwave', 'heavyJobs', 'heavyJobsPct', 'cleanJobs', 'meanMood',
  'research', 'evidence', 'decisions', 'cumulativeKt', 'noRoad', ...MECH_METRIC_KEYS,
];
export const METRIC_PREFIXES: readonly string[] = [
  'pop', 'streak', 'mood', 'flag', 'count', 'connected', 'acts', 'recent', 'beat', 'chose', 'asked', 'research', 'zoned', 'grown',
];

/** True for a key that metric() understands (used by the content tests to catch typos). */
export function isKnownMetric(key: MetricKey): boolean {
  const dot = key.indexOf('.');
  return dot > 0 ? METRIC_PREFIXES.includes(key.slice(0, dot)) : STATIC_METRICS.includes(key);
}

/** Reads one metric. Unknown keys return 0 so content typos fail tests (see the content validation tests), not the game. */
export function metric(state: GameState, key: MetricKey): number {
  const dot = key.indexOf('.');
  if (dot > 0) {
    const head = key.slice(0, dot);
    const rest = key.slice(dot + 1);
    switch (head) {
      case 'pop': return state.wildlife.species[rest]?.pop ?? 0;
      case 'streak': return state.wildlife.species[rest]?.nestStreak ?? 0;
      case 'mood': return state.residents.list[rest]?.mood ?? 50;
      case 'flag': {
        const v = state.flags[rest];
        return typeof v === 'number' ? v : v === true ? 1 : 0;
      }
      case 'count': return countBuildings(state, rest as BuildingId);
      case 'connected': {
        const acc = roadAccess(state);
        return state.buildings.filter((b) => b.type === rest && acc.connected.has(b.uid)).length;
      }
      case 'acts': return state.residents.actions[rest] ?? 0;
      case 'recent': return recentEvents(state, rest, 6);
      case 'beat': return state.residents.fired[rest] !== undefined ? 1 : 0;
      case 'chose': {
        const [d, o] = rest.split('.');
        return state.dilemmas.decisions.some((x) => x.dilemmaId === d && x.optionId === o) ? 1 : 0;
      }
      case 'asked': return state.dilemmas.offered[rest] !== undefined ? 1 : 0;
      case 'research': return state.circular.research.includes(rest) ? 1 : 0;
      // Zoning: tiles zoned for homes / shops / industry (grown or not), and buildings grown in each.
      case 'zoned': {
        const want = rest === 'res' ? [1, 2, 3] : rest === 'com' ? [4] : rest === 'ind' ? [5] : [];
        let n = 0;
        for (const z of state.grid.zoning ?? []) if (want.includes(z)) n++;
        return n;
      }
      case 'grown': {
        const want: readonly string[] = rest === 'res' ? ['zres1', 'zres2', 'zres3'] : rest === 'com' ? ['zcom'] : rest === 'ind' ? ['zind'] : [];
        return state.buildings.filter((b) => b.grown && want.includes(b.type)).length;
      }
      default: return 0;
    }
  }
  switch (key) {
    case 'year': return state.year;
    case 'tempC': return state.tempC;
    case 'co2': return state.co2;
    case 'realCo2': return realCO2(state.year);
    case 'realTempC': return realTemp(state.year);
    case 'estuary': return estuaryHealth(state);
    case 'society': return state.meters.society;
    case 'economy': return state.meters.economy;
    case 'environment': return state.meters.environment;
    case 'population': return state.population;
    case 'bushPct': {
      const bush = state.grid.kind.reduce((n, k) => n + (k === TileKind.Bush ? 1 : 0), 0);
      return state.initialBushTiles > 0 ? Math.round((bush / state.initialBushTiles) * 100) : 100;
    }
    case 'healthPct': return Math.round(meanHealth(state) * 100);
    case 'reefPct': return Math.round(meanReefHealth(state) * 100);
    case 'employment': {
      const e = economySnapshot(state);
      return e.population > 0 ? Math.round((e.filledJobs / e.population) * 100) : 0;
    }
    case 'unmetPct': return Math.round(state.a2.lastUnmetFrac * 100);
    case 'renewablePct': return renewablePct(state);
    case 'emissionsKt': return currentEmissionsKt(state);
    case 'peakKt': return peakEmissionsKt(state);
    case 'emissionsPct': return Math.round((currentEmissionsKt(state) / Math.max(1, peakEmissionsKt(state))) * 100);
    case 'airQuality': return airQuality(state);
    case 'partnership': return state.country.partnership;
    case 'wildlifeAlive': return speciesAlive(state);
    case 'legacyPct': return legacyPct(state);
    case 'drought': return isActive(state, 'drought') ? 1 : 0;
    case 'heatwave': return isActive(state, 'heatwave') ? 1 : 0;
    case 'heavyJobs': return heavyJobs(state);
    case 'heavyJobsPct': {
      const peak = Math.max(1, state.residents.peaks.heavyJobs ?? 0, heavyJobs(state));
      return Math.round((heavyJobs(state) / peak) * 100);
    }
    case 'cleanJobs': return cleanJobs(state);
    case 'meanMood': return meanMood(state);
    case 'research': return state.circular.research.length;
    case 'evidence': return state.dilemmas.decisions.filter((d) => d.evidenceBacked).length;
    case 'decisions': return state.dilemmas.decisions.length;
    case 'cumulativeKt': return state.cumulativeKt;
    case 'noRoad': return roadAccess(state).unconnected.length;
    default: return mechMetric(state, key) ?? 0;
  }
}

export function testMetric(state: GameState, c: MetricTest): boolean {
  const x = metric(state, c.m);
  switch (c.op) {
    case '>=': return x >= c.v;
    case '<=': return x <= c.v;
    case '>': return x > c.v;
    case '<': return x < c.v;
    case '==': return Math.abs(x - c.v) < 1e-9;
  }
}

export function condMet(state: GameState, c: Cond | undefined): boolean {
  if (!c) return true;
  if (c.phase && !c.phase.includes(state.phase)) return false;
  if (c.years && (state.year < c.years[0] || state.year > c.years[1])) return false;
  if (c.all && !c.all.every((x) => testMetric(state, x))) return false;
  if (c.any && c.any.length > 0 && !c.any.some((x) => testMetric(state, x))) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------------------
// Text rendering
// ---------------------------------------------------------------------------------------------------------

const f1 = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);
const i0 = (n: number): string => String(Math.round(n));

/** Values characters can quote. Every key listed here is safe to use as {key} in content text. */
export function storyVars(state: GameState): Record<string, string> {
  const sp = (id: string): string => i0(state.wildlife.species[id]?.pop ?? 0);
  const tp = state.turningPoint?.stats;
  let land: ReturnType<typeof landSnapshot> | null = null;
  const lazy = (): ReturnType<typeof landSnapshot> => (land ??= landSnapshot(state));
  return {
    // Act 1 land guide (see sim/ledger.ts): creek health 0..100, bush birds (pairs) and creek fish (schools). Read lazily.
    get creek() { return i0(lazy().creek); },
    get birds() { return i0(lazy().birds); },
    get fish() { return i0(lazy().fish); },
    year: i0(state.year),
    temp: f1(state.tempC),
    co2: i0(state.co2),
    realCo2: i0(realCO2(state.year)),
    realTemp: f1(realTemp(state.year)),
    eqTemp: f1(state.a2.eqTempC),
    tpTemp: f1(tp?.tempC ?? state.tempC),
    tpCo2: i0(tp?.co2 ?? state.co2),
    tpYear: i0(tp?.year ?? state.year),
    est: i0(estuaryHealth(state)),
    kt: i0(currentEmissionsKt(state)),
    peakKt: i0(peakEmissionsKt(state)),
    cumKt: i0(state.cumulativeKt),
    ren: i0(renewablePct(state)),
    unmet: i0(state.a2.lastUnmetFrac * 100),
    bush: i0(metric(state, 'bushPct')),
    health: i0(meanHealth(state) * 100),
    soc: i0(state.meters.society),
    eco: i0(state.meters.economy),
    env: i0(state.meters.environment),
    pop: i0(state.population),
    koalas: sp('koala'),
    cockatoos: sp('black-cockatoo'),
    turtles: sp('green-turtle'),
    platypus: sp('platypus'),
    frogs: sp('frogs'),
    foxes: sp('flying-fox'),
    shorebirds: sp('shorebirds'),
    cod: sp('murray-cod'),
    parrots: sp('superb-parrot'),
    bellfrogs: sp('southern-bell-frog'),
    reefTurtles: sp('reef-turtle'),
    dugongs: sp('dugong'),
    reefFish: sp('reef-fish'),
    kingfishers: sp('mangrove-kingfisher'),
    bilbies: sp('bilby'),
    wallabies: sp('rock-wallaby'),
    budgies: sp('budgerigar'),
    owls: sp('powerful-owl'),
    species: i0(speciesAlive(state)),
    partner: i0(state.country.partnership),
    river: i0(mechMetric(state, 'riverHealth') ?? 0),
    farm: i0(mechMetric(state, 'farmViability') ?? 0),
    tourism: i0(mechMetric(state, 'tourism') ?? 0),
    slr: i0(mechMetric(state, 'seaRiseCm') ?? 0),
    homesLost: i0(mechMetric(state, 'homesLost') ?? 0),
    aquifer: i0(mechMetric(state, 'aquifer') ?? 0),
    rehab: i0(mechMetric(state, 'rehabPct') ?? 0),
    deaths: i0(mechMetric(state, 'heatDeaths') ?? 0),
    canopy: i0(mechMetric(state, 'canopyPct') ?? 0),
    transit: i0(mechMetric(state, 'transitPct') ?? 0),
    heavyJobs: i0(heavyJobs(state)),
    cleanJobs: i0(cleanJobs(state)),
    legacy: i0(legacyPct(state)),
    // Tenths of a degree above the real record, signed.
    tempGap: `${state.tempC - realTemp(state.year) >= 0 ? '+' : '-'}${f1(Math.abs(state.tempC - realTemp(state.year)))}`,
  };
}

/** Replaces {key} placeholders. Unknown keys are left in place (content tests catch them). */
export function renderText(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
