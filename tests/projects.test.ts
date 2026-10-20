import { describe, expect, it } from 'vitest';
import {
  applyAction, buildReportCard, climateAt, getScenario, PROJECTS, projectCost, projectRounds, projectsFunded, tick, TileKind,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { act2Sandbox, paint } from './helpers/fixtures';

/** Act 2 with the circular tier open: half bush, half bare weedy ground. */
function late(budget = 3000): GameState {
  const s = act2Sandbox(TileKind.Land, { budget, year: 2060 });
  paint(s, 0, 0, s.grid.w, Math.floor(s.grid.h / 2), TileKind.Bush);
  for (let i = 0; i < s.grid.kind.length; i++) {
    if (s.grid.kind[i] === TileKind.Bush) { s.grid.health[i] = 0.9; s.grid.stage[i] = 3; } else s.grid.weed[i] = 1;
  }
  s.circular.unlocked = true;
  return s;
}
const fund = (s: GameState, id: string) => applyAction(s, { type: 'project', id });

describe('community projects (a late-game place for surplus money)', () => {
  it('open only with the circular tier, in Act 2', () => {
    const s = late();
    s.circular.unlocked = false;
    expect(fund(s, 'adopt-habitat').result.code).toBe('not-open');
    expect(fund({ ...late(), phase: 'act1' }, 'adopt-habitat').result.ok).toBe(false);
    expect(fund(late(), 'nope').result.code).toBe('invalid');
  });
  it('cost more each round, run out after the last round, and need the money', () => {
    let s = late();
    const p = PROJECTS.find((x) => x.id === 'climate-aid');
    if (!p) throw new Error('missing');
    const costs: number[] = [];
    for (let k = 0; k < p.rounds; k++) {
      costs.push(projectCost(s, p.id) ?? -1);
      const r = fund(s, p.id);
      expect(r.result.ok).toBe(true);
      s = r.state;
    }
    expect(costs[1]).toBeGreaterThan(costs[0] as number);
    expect(projectRounds(s, p.id)).toBe(p.rounds);
    expect(fund(s, p.id).result.code).toBe('already-done');
    expect(fund(late(50), 'climate-aid').result.code).toBe('no-funds');
  });
  it('together can absorb well over a million dollars of late surplus', () => {
    const total = PROJECTS.reduce((t, p) => {
      let c = 0;
      for (let k = 0; k < p.rounds; k++) c += Math.round(p.cost * Math.pow(p.costGrowth, k));
      return t + c;
    }, 0);
    expect(total).toBeGreaterThanOrEqual(1500);
  });
  it('adopt a habitat plants weedy ground beside bush, and it grows', () => {
    const s0 = late();
    const r = fund(s0, 'adopt-habitat');
    const g = r.state.grid;
    let planted = 0;
    for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === TileKind.Land && g.weed[i] === 0 && (g.health[i] ?? 0) > 0.1) planted++;
    expect(planted).toBe(12);
    expect(r.state.budget).toBe(s0.budget - 120);
  });
  it('climate aid takes emissions off the world total, so warming is lower', () => {
    let s = late();
    const before = s.cumulativeKt;
    for (let k = 0; k < 3; k++) s = fund(s, 'climate-aid').state;
    expect(before - s.cumulativeKt).toBe(180 * (getScenario(s.scenarioId).modifiers.emissionScale ?? 1));
    const sc = getScenario(s.scenarioId);
    const t1 = climateAt(2100, s.cumulativeKt, sc.modifiers.climateSensitivityMult).tempC;
    const t0 = climateAt(2100, before, sc.modifiers.climateSensitivityMult).tempC;
    expect(t1).toBeLessThan(t0);
  });
  it('raise Society a little and show up in the report card', () => {
    const s0 = late();
    let s = s0;
    for (const id of ['cool-refuges', 'junior-rangers']) s = fund(s, id).state;
    s = tick(s, 1).state;
    const plain = tick(s0, 1).state;
    expect(s.meters.society).toBeGreaterThan(plain.meters.society);
    expect(projectsFunded(s)).toBe(2);
    expect(buildReportCard(s).topDecisions.some((d) => /Community projects/.test(d.title))).toBe(true);
  });
});
