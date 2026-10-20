import { mechMetric } from './mechanics';
import { estuaryHealth, meanReefHealth } from './metrics';
import { getScenario } from './scenarios';
import type { GameState, ObjectiveResult } from './types';

export type MetricId =
  | 'warming'
  | 'estuaryHealth'
  | 'society'
  | 'economy'
  | 'environment'
  | 'reefHealth'
  | 'act1Repurposed'
  | 'wildlifeThriving'
  // Scenario mechanics (see sim/mechanics): River Town, Reef Island, Red Dirt, Net Zero City
  | 'riverHealth'
  | 'farmViability'
  | 'townWaterFailures'
  | 'tourism'
  | 'homesLost'
  | 'rehabPct'
  | 'aquifer'
  | 'waterFailures'
  | 'heatDeaths'
  | 'netZeroYear'
  | 'societyMin'
  | 'capitalSpent'
  | 'renewableShare'
  | 'canopyPct'
  | 'speciesBack';

/** Data-driven objective. Scenarios list these; objectiveStatus() judges them. */
export interface ObjectiveDef {
  id: string;
  label: string;
  metric: MetricId;
  op: '<=' | '>=';
  target: number;
  /** Judged at this year (default: the end of Act 2). */
  byYear?: number;
  bonus?: boolean;
  /** Needs a later tier to supply the metric (see metricValue). Reported as 'pending' until it does. */
  pendingTier?: string;
  /**
   * Judge the average of the last N Act 2 years rather than a single year's snapshot (for numbers that swing with
   * the weather, like water quality and coral cover). Supported for estuaryHealth and reefHealth.
   */
  avgYears?: number;
}

/** Mean of the last `n` yearly records of a metric that the yearly record keeps, or null when there are none. */
function averaged(state: GameState, metric: MetricId, n: number): number | null {
  const ys = state.a2.yearly.slice(-n);
  if (ys.length === 0 || state.phase === 'act1' || state.phase === 'turning-point') return null;
  const pick = (y: (typeof ys)[number]): number | null =>
    metric === 'estuaryHealth' ? y.estuaryHealth : metric === 'reefHealth' ? y.reefHealth * 100 : null;
  let t = 0;
  for (const y of ys) {
    const v = pick(y);
    if (v === null) return null;
    t += v;
  }
  return Math.round((t / ys.length) * 10) / 10;
}

/**
 * Current value of a metric, or null if nothing supplies it yet. Later tiers (circular economy, wildlife) plug in
 * by setting `state.flags['metric.<id>']` to a number, e.g. flags['metric.act1Repurposed'] = 100.
 */
export function metricValue(state: GameState, metric: MetricId): number | null {
  switch (metric) {
    case 'warming': return state.tempC;
    case 'estuaryHealth': return estuaryHealth(state);
    case 'society': return state.meters.society;
    case 'economy': return state.meters.economy;
    case 'environment': return state.meters.environment;
    case 'reefHealth': return Math.round(meanReefHealth(state) * 1000) / 10;
    case 'speciesBack': return Object.values(state.wildlife.species).filter((x) => x.pop > 0 && x.startPop === 0).length;
    case 'renewableShare': return Math.round((state.a2.lastGrid?.renewableShare ?? 0) * 1000) / 10;
    default: {
      const own = mechMetric(state, metric);
      if (own !== null) return own;
      const v = state.flags[`metric.${metric}`];
      return typeof v === 'number' ? v : null;
    }
  }
}

export function objectiveStatus(state: GameState): ObjectiveResult[] {
  const sc = getScenario(state.scenarioId);
  return sc.act2.objectives.map((o): ObjectiveResult => {
    const current = (o.avgYears ? averaged(state, o.metric, o.avgYears) : null) ?? metricValue(state, o.metric);
    const base = {
      id: o.id, label: o.label, bonus: o.bonus === true, metric: o.metric, op: o.op, target: o.target, current,
      ...(o.pendingTier ? { pendingTier: o.pendingTier } : {}),
    };
    if (current === null) return { ...base, status: 'pending' };
    const ok = o.op === '<=' ? current <= o.target : current >= o.target;
    const final = state.phase === 'epilogue' || state.phase === 'failed' || state.year >= (o.byYear ?? sc.act2.endYear);
    return { ...base, status: final ? (ok ? 'met' : 'missed') : ok ? 'on-track' : 'at-risk' };
  });
}
