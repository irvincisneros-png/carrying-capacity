/**
 * Scripted Act 1 players that use the Round 6 tools: dilemma cards (evidence-backed or greedy) and building upgrades.
 * Kept apart from the older scripted players so they stay as they were.
 */
import { advanceDecade, applyAction, getDilemma, upgradeOptions } from '../../src/sim';
import type { GameState } from '../../src/sim';
import { answerPrompts, queuePlan } from './scen';
import type { Plan, QueueWant } from './scen';

/** Fits every upgrade that is on the market and affordable, keeping `reserve` in the bank. Cheapest first. */
export function fitUpgrades(state: GameState, opts: { reserve?: number; only?: readonly string[] } = {}): GameState {
  let s = state;
  const reserve = opts.reserve ?? 0;
  for (let guard = 0; guard < 60; guard++) {
    const open = s.buildings
      .flatMap((b) => upgradeOptions(s, b).filter((o) => o.state === 'available' && (!opts.only || opts.only.includes(o.def.id))).map((o) => ({ uid: b.uid, def: o.def })))
      .filter((o) => s.budget - o.def.cost >= reserve)
      .sort((a, b) => a.def.cost - b.def.cost || a.uid - b.uid);
    const next = open[0];
    if (!next) break;
    const r = applyAction(s, { type: 'upgrade', uid: next.uid, id: next.def.id });
    if (!r.result.ok) break;
    s = r.state;
  }
  return s;
}

export interface Act1Style {
  queue: readonly QueueWant[];
  housingRatio?: number;
  /** Fit upgrades as soon as they are on the market. */
  upgrades?: boolean;
  /** Answer cards with the evidence-backed option (default) or the cash-first option. */
  cards?: 'evidence' | 'cash';
  reserve?: number;
  /** How strongly the builder prefers sites beside existing roads (fewer new roads, less bush paved over). */
  roadWeight?: number;
}

/** A whole Act 1 under a style: each decade answers the cards, fits upgrades, builds, then presses Next decade. */
export function playAct1(start: GameState, style: Act1Style): GameState {
  const build: Plan = queuePlan(style.queue, style.housingRatio ?? 1.0, 30, style.roadWeight);
  let s = start;
  while (s.phase === 'act1' && s.status === 'playing') {
    const picks: Record<string, string> = {};
    if (style.cards === 'cash') {
      for (const id of s.dilemmas.pending) {
        const d = getDilemma(s.scenarioId, id);
        const best = d?.options.slice().sort((a, b) => ((b.effects.incomePerDecade ?? 0) + (b.effects.budget ?? 0) / 4) - ((a.effects.incomePerDecade ?? 0) + (a.effects.budget ?? 0) / 4))[0];
        if (best) picks[id] = best.id;
      }
    }
    s = answerPrompts(s, { dilemmas: picks });
    if (style.upgrades) s = fitUpgrades(s, { reserve: style.reserve ?? 0 });
    s = build(s);
    s = advanceDecade(s).state;
  }
  return s;
}
