/**
 * Community projects (Act 2): a late-game place for surplus money that is tied to the theme. Rounds are counted in
 * flags ('proj.<id>'), so old saves need no migration.
 */
import { PROJECTS, PROJECTS_BY_ID } from '../content/projects';
import type { ProjectDef } from '../content/projects';
import { bumpRect, SEED_HEALTH, STAGE_PIONEER, stageFromHealth } from './restoration';
import { getScenario } from './scenarios';
import { cloneState } from './state';
import { emitStory } from './story';
import { noteAction } from './residents';
import { TileKind } from './types';
import type { ActionFailCode, ActionResult, GameState } from './types';

export { PROJECTS, PROJECTS_BY_ID };
export type { ProjectDef };

const fail = (state: GameState, code: ActionFailCode, reason: string): { state: GameState; result: ActionResult } => ({
  state, result: { ok: false, code, reason },
});

/** Rounds of a project funded so far. */
export function projectRounds(s: GameState, id: string): number {
  const v = s.flags[`proj.${id}`];
  return typeof v === 'number' ? v : 0;
}

/** Cost of the next round ($k), or null when every round is done. */
export function projectCost(s: GameState, id: string): number | null {
  const p = PROJECTS_BY_ID[id];
  if (!p) return null;
  const n = projectRounds(s, id);
  if (n >= p.rounds) return null;
  return Math.round(p.cost * Math.pow(p.costGrowth, n));
}

/** Projects open once the circular tier opens (the town's own transition is under way). */
export function projectsOpen(s: GameState): boolean {
  return s.phase === 'act2' && s.circular.unlocked;
}

export function canFundProject(s: GameState, id: string): { ok: boolean; reason?: string } {
  const p = PROJECTS_BY_ID[id];
  if (!p) return { ok: false, reason: 'Unknown project' };
  if (!projectsOpen(s)) return { ok: false, reason: 'Opens with the circular economy (clean power and a healthy estuary, or 2050)' };
  const cost = projectCost(s, id);
  if (cost === null) return { ok: false, reason: 'Every round of this project is funded' };
  if (s.budget < cost) return { ok: false, reason: `Not enough money: the next round costs $${cost}k` };
  return { ok: true };
}

/** Land tiles a habitat crew can plant: unbuilt, bare/pioneer or weedy, beside living bush. Best (most bush around) first. */
function plantable(s: GameState, n: number): number[] {
  const g = s.grid;
  const cands: { i: number; score: number }[] = [];
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      if (g.kind[i] !== TileKind.Land || (g.building[i] ?? 0) !== 0) continue;
      if ((g.stage[i] ?? 0) > STAGE_PIONEER && (g.weed[i] ?? 0) === 0) continue;
      if ((g.soilContamination[i] ?? 0) > 0.6) continue;
      let bush = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if ((dx || dy) && xx >= 0 && yy >= 0 && xx < g.w && yy < g.h && (g.kind[yy * g.w + xx] === TileKind.Bush || (g.stage[yy * g.w + xx] ?? 0) >= 2)) bush++;
      }
      if (bush > 0) cands.push({ i, score: bush * 10 - (g.health[i] ?? 0) });
    }
  }
  cands.sort((a, b) => b.score - a.score || a.i - b.i);
  return cands.slice(0, n).map((c) => c.i);
}

export function fundProject(state: GameState, id: string): { state: GameState; result: ActionResult } {
  const chk = canFundProject(state, id);
  const p = PROJECTS_BY_ID[id];
  const cost = projectCost(state, id);
  if (!chk.ok || !p || cost === null) {
    const code: ActionFailCode = !p ? 'invalid' : !projectsOpen(state) ? 'not-open' : cost === null ? 'already-done' : 'no-funds';
    return fail(state, code, chk.reason ?? 'Cannot fund that');
  }
  const s = cloneState(state);
  const g = s.grid;
  s.budget -= cost;
  s.flags[`proj.${id}`] = projectRounds(state, id) + 1;
  s.flags['proj.spent'] = (typeof s.flags['proj.spent'] === 'number' ? s.flags['proj.spent'] : 0) + cost;
  const fx = p.effects;
  if (fx.society) s.dilemmas.adjust += fx.society;
  if (fx.mood) for (const r of Object.values(s.residents.list)) r.mood = Math.max(0, Math.min(100, r.mood + fx.mood));
  if (fx.avoidedKt) {
    const kt = Math.round(fx.avoidedKt * (getScenario(s.scenarioId).modifiers.emissionScale ?? 1));
    s.cumulativeKt = Math.max(0, s.cumulativeKt - kt);
    s.flags['proj.avoidedKt'] = (typeof s.flags['proj.avoidedKt'] === 'number' ? s.flags['proj.avoidedKt'] : 0) + kt;
  }
  let planted = 0;
  if (fx.plantTiles) {
    for (const i of plantable(s, fx.plantTiles)) {
      g.weed[i] = 0;
      g.health[i] = Math.max(g.health[i] ?? 0, SEED_HEALTH + 0.08);
      g.stage[i] = stageFromHealth(g.health[i] ?? 0);
      bumpRect(g, i % g.w, Math.floor(i / g.w), 1, 1);
      planted++;
    }
  }
  let cleared = 0;
  if (fx.clearWeeds) {
    for (let i = 0; i < g.kind.length && cleared < fx.clearWeeds; i++) {
      if ((g.weed[i] ?? 0) !== 1) continue;
      g.weed[i] = 0;
      bumpRect(g, i % g.w, Math.floor(i / g.w), 1, 1);
      cleared++;
    }
  }
  const extra = planted ? ` Crews planted ${planted} patches beside the bush.` : cleared ? ` Volunteers cleared weeds from ${cleared} patches.` : '';
  emitStory(s, `${p.name}: funded.${extra}`, { channel: 'town', ref: id, tone: 'joy' }, 0.4);
  noteAction(s, `project.${id}`);
  s.version = state.version + 1;
  return { state: s, result: { ok: true, spent: cost } };
}

/** Total funded rounds across all projects. */
export function projectsFunded(s: GameState): number {
  return PROJECTS.reduce((n, p) => n + projectRounds(s, p.id), 0);
}
