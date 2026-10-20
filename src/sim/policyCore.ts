/** Policy levers: player-set numbers a scenario exposes (water allocation, coral culling, water restrictions). */
import { getScenario } from './scenarios';
import type { PolicyDef } from './scenarios';
import type { GameState, ScenarioId } from './types';

export const POLICY_FLAG = 'pol.';

export function policiesFor(id: ScenarioId): readonly PolicyDef[] {
  return getScenario(id).policies ?? [];
}

export function policyDef(id: ScenarioId, policyId: string): PolicyDef | undefined {
  return policiesFor(id).find((p) => p.id === policyId);
}

/** Current value of a policy (its default until the player changes it). 0 for unknown ids. */
export function policyValue(s: GameState, policyId: string): number {
  const def = policyDef(s.scenarioId, policyId);
  const v = s.flags[POLICY_FLAG + policyId];
  if (typeof v === 'number') return v;
  return def?.default ?? 0;
}

/** Money per year the current policy settings cost. */
export function policyCostPerYear(s: GameState): number {
  let total = 0;
  for (const p of policiesFor(s.scenarioId)) {
    if (p.costPerYear === undefined) continue;
    const v = policyValue(s, p.id);
    if (typeof p.costPerYear === 'number') total += p.costPerYear * v;
    else total += p.costPerYear[Math.max(0, Math.min(p.costPerYear.length - 1, Math.round((v - p.min) / p.step)))] ?? 0;
  }
  return total;
}
