/**
 * Act 1 goals: what the boom is for. Each scenario with an Act 1 lists a few short goals (grow the town, keep people
 * working, keep the lights on) and one bonus ("grow without wrecking it"). They are shown in the start intro in place
 * of the Act 2 goals, which stay hidden until the turning point. The bonus earns a badge on the report card (stars
 * are unchanged) and the turning point acknowledges a careful Act 1.
 *
 * Goals are judged on the state when Act 1 ends. The values are written to flags ('a1.*') at that moment, so they
 * survive Act 2 changes and old saves (which have no flags) simply show no badge.
 */
import { creekHealth } from './ledger';
import { economySnapshot } from './economy';
import { getScenario } from './scenarios';
import type { GameState } from './types';

export type Act1Metric = 'population' | 'filledJobs' | 'powerCovered' | 'environment' | 'creekHealth';

export interface Act1GoalDef {
  id: string;
  label: string;
  metric: Act1Metric;
  op: '>=' | '<=';
  target: number;
  /** The "grow without wrecking it" goal. Earns a badge; not needed to move on. */
  bonus?: boolean;
}

/** Everything a scenario says about its Act 1. */
export interface Act1Def {
  /** The 1960-style opening paragraph for the intro, in place of the scenario blurb. */
  intro: string;
  goals: readonly Act1GoalDef[];
  /** Shown above the goals: why the player is building. */
  why?: string;
  /** Dilemma cards: years between offers (default 20) and how many may be offered at one decade turn (default 1). */
  cardGap?: number;
  cardsPerTurn?: number;
}

export function act1Of(s: GameState): Act1Def | undefined {
  return getScenario(s.scenarioId).act1;
}

export function act1MetricValue(s: GameState, m: Act1Metric): number {
  switch (m) {
    case 'population': return s.population;
    case 'filledJobs': return economySnapshot(s).filledJobs;
    case 'powerCovered': return economySnapshot(s).powerDeficit <= 0 ? 1 : 0;
    case 'environment': return s.meters.environment;
    case 'creekHealth': return creekHealth(s);
  }
}

export type Act1Status = 'met' | 'missed' | 'on-track' | 'at-risk';

export interface Act1GoalResult {
  id: string;
  label: string;
  bonus: boolean;
  metric: Act1Metric;
  op: '>=' | '<=';
  target: number;
  current: number;
  status: Act1Status;
}

/** True once Act 1 has been judged (its values are recorded in flags). */
export function act1Judged(s: GameState): boolean {
  return s.flags['a1.done'] === 1;
}

export function act1GoalStatus(s: GameState): Act1GoalResult[] {
  const def = act1Of(s);
  if (!def) return [];
  const judged = act1Judged(s);
  return def.goals.map((g): Act1GoalResult => {
    const rec = s.flags[`a1.${g.id}`];
    const current = judged && typeof rec === 'number' ? rec : act1MetricValue(s, g.metric);
    const ok = g.op === '>=' ? current >= g.target : current <= g.target;
    const status: Act1Status = judged ? (ok ? 'met' : 'missed') : ok ? 'on-track' : 'at-risk';
    return { id: g.id, label: g.label, bonus: g.bonus === true, metric: g.metric, op: g.op, target: g.target, current, status };
  });
}

/** Called once, when the last decade of Act 1 has been played: writes the values the goals are judged on. */
export function recordAct1(s: GameState): void {
  const def = act1Of(s);
  if (!def) return;
  for (const g of def.goals) s.flags[`a1.${g.id}`] = Math.round(act1MetricValue(s, g.metric) * 10) / 10;
  s.flags['a1.done'] = 1;
}

export interface Act1Outcome {
  judged: boolean;
  mainMet: number;
  mainTotal: number;
  /** All the main goals met. */
  grew: boolean;
  /** The bonus goal(s) met: the valley was kept in good shape. */
  careful: boolean;
  goals: Act1GoalResult[];
}

export function act1Outcome(s: GameState): Act1Outcome {
  const goals = act1GoalStatus(s);
  const main = goals.filter((g) => !g.bonus);
  const bonus = goals.filter((g) => g.bonus);
  const judged = act1Judged(s);
  const mainMet = main.filter((g) => g.status === 'met').length;
  return {
    judged,
    mainMet,
    mainTotal: main.length,
    grew: judged && main.length > 0 && mainMet === main.length,
    careful: judged && bonus.length > 0 && bonus.every((g) => g.status === 'met'),
    goals,
  };
}
