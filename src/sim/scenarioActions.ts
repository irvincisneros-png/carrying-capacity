/** Actions that belong to scenario mechanics: policy levers and Red Dirt's staged mine rehabilitation. */
import { OUTBACK, minesOpen, nurseryCover, NURSERY_REACH, seedZone } from './mechanics/outbackCore';
import { bumpChangedChunks, fingerprint, stageFromHealth } from './restoration';
import { noteAction } from './residents';
import { policyCostPerYear, policyDef, POLICY_FLAG } from './policyCore';
import { getScenario } from './scenarios';
import { cloneState } from './state';
import { emitStory } from './story';
import { TileKind } from './types';
import type { ActionFailCode, ActionResult, GameState } from './types';

export { policyCostPerYear };

type R = { state: GameState; result: ActionResult };
const fail = (state: GameState, code: ActionFailCode, reason: string): R => ({ state, result: { ok: false, code, reason } });

export function applyPolicy(state: GameState, id: string, value: number): R {
  const def = policyDef(state.scenarioId, id);
  if (!def) return fail(state, 'invalid', 'That is not a lever in this scenario');
  if (state.phase !== 'act2') return fail(state, 'not-open', 'Policies can be changed during the transition');
  if (!Number.isFinite(value) || value < def.min - 1e-9 || value > def.max + 1e-9) {
    return fail(state, 'invalid', `Choose a value from ${def.min} to ${def.max}`);
  }
  const snapped = Math.round((value - def.min) / def.step) * def.step + def.min;
  const v = Math.round(snapped * 1e6) / 1e6;
  if (id === 'alloc.town' || id === 'alloc.env') {
    const other = id === 'alloc.town' ? 'alloc.env' : 'alloc.town';
    const oDef = policyDef(state.scenarioId, other);
    const ov = typeof state.flags[POLICY_FLAG + other] === 'number' ? (state.flags[POLICY_FLAG + other] as number) : (oDef?.default ?? 0);
    if (v + ov > 0.95 + 1e-9) return fail(state, 'invalid', 'The town, the environment and the farms must share the river: farms need at least 5%');
  }
  const s = cloneState(state);
  s.flags[POLICY_FLAG + id] = v;
  noteAction(s, `policy.${id}`);
  s.version = state.version + 1;
  return { state: s, result: { ok: true } };
}

const N4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Connected mine-site tiles that are still Pit and at the same rehab stage as tile `start`. */
function pitPatch(s: GameState, start: number): number[] {
  const g = s.grid;
  const stage = g.stage[start] ?? 0;
  const ok = (i: number): boolean => g.kind[i] === TileKind.Pit && g.zone[i] === 1 && (g.stage[i] ?? 0) === stage;
  if (!ok(start)) return [];
  const seen = new Set<number>([start]);
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi] as number;
    const x = i % g.w, y = Math.floor(i / g.w);
    for (const [dx, dy] of N4) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
      const j = yy * g.w + xx;
      if (seen.has(j) || !ok(j)) continue;
      seen.add(j);
      q.push(j);
    }
  }
  return Array.from(seen).sort((a, b) => a - b);
}

export const REHAB_STEP_NAMES = ['Reshape the pit', 'Spread topsoil', 'Seed with local plants'] as const;

/** What the next rehab step on the patch at (x, y) would be and cost, or null if there is none. */
export function rehabPlan(s: GameState, x: number, y: number): { stage: number; name: string; tiles: number; cost: number; reason?: string; nurseryTiles?: number; reach?: number } | null {
  const g = s.grid;
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return null;
  const i = y * g.w + x;
  const patch = pitPatch(s, i);
  if (patch.length === 0) return null;
  const stage = g.stage[i] ?? 0;
  const cost = Math.round(patch.length * (OUTBACK.stageCost[stage] ?? 0));
  let reason: string | undefined;
  if (minesOpen(s) > 0) reason = 'Close the mine before the pit is reshaped: a working mine cannot be rehabilitated';
  else if (stage === 2 && s.country.partnership < OUTBACK.seedPartnership) {
    reason = `Seeding is planned with the Traditional Owners. Build the partnership first (it needs ${OUTBACK.seedPartnership}, it is ${Math.round(s.country.partnership)})`;
  }
  let nurseryTiles: number | undefined;
  if (stage === 2) { const cover = nurseryCover(s); nurseryTiles = patch.filter((j) => cover[j] === 1).length; }
  return { stage, name: REHAB_STEP_NAMES[stage] ?? 'Rehabilitate', tiles: patch.length, cost, ...(reason ? { reason } : {}), ...(nurseryTiles !== undefined ? { nurseryTiles, reach: NURSERY_REACH } : {}) };
}

export function rehabStep(state: GameState, x: number, y: number): R {
  if (!(getScenario(state.scenarioId).mechanics ?? []).includes('outback')) return fail(state, 'not-open', 'There is no mine to rehabilitate here');
  if (state.phase !== 'act2') return fail(state, 'not-open', 'Rehabilitation is part of the transition');
  const plan = rehabPlan(state, x, y);
  if (!plan) return fail(state, 'nothing-here', 'There is no open mine ground here to rehabilitate');
  if (plan.reason) return fail(state, 'not-open', plan.reason);
  if (state.budget < plan.cost) return fail(state, 'no-funds', `Not enough money: this step costs ${plan.cost}`);
  const s = cloneState(state);
  const g = s.grid;
  const patch = pitPatch(s, y * g.w + x);
  const before = fingerprint(g);
  s.budget -= plan.cost;
  let text: string;
  if (plan.stage === 0) {
    for (const i of patch) g.stage[i] = 1;
    s.pendingLandKt += patch.length * OUTBACK.reshapeKt;
    text = `Machines reshaped ${patch.length} tiles of the pit into gentle slopes that shed water safely. It is noisy, dusty work, and it burns a lot of diesel. Nothing can grow here yet.`;
  } else if (plan.stage === 1) {
    for (const i of patch) { g.stage[i] = 2; g.soilContamination[i] = (g.soilContamination[i] ?? 0) * 0.25; }
    text = `Topsoil that was stockpiled years ago went back over ${patch.length} tiles. It carries seeds, fungi and soil life that bare rock does not have.`;
  } else {
    const z = seedZone(s.year);
    for (const i of patch) {
      g.kind[i] = TileKind.Land;
      g.health[i] = 0.08;
      g.stage[i] = stageFromHealth(0.08);
      g.weed[i] = 0;
      g.zone[i] = z;
      g.soilContamination[i] = (g.soilContamination[i] ?? 0) * 0.5;
    }
    text = `With the Traditional Owners, the crew seeded ${patch.length} tiles with local grasses and shrubs. Now comes the waiting: ${OUTBACK.monitorYears} years of monitoring before the ground can be signed off.`;
  }
  noteAction(s, `rehab.${plan.stage}`);
  emitStory(s, text, { channel: 'circular', ref: `rehab.${plan.stage}`, tone: 'warm', ...(plan.stage === 2 ? { needsConsultation: true } : {}) }, 0.5);
  bumpChangedChunks(g, before);
  s.version = state.version + 1;
  return { state: s, result: { ok: true, spent: plan.cost } };
}
