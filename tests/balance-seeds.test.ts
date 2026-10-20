import { describe, expect, it } from 'vitest';
import { buildReportCard, carryOverPlan, getScenario, objectiveStatus } from '../src/sim';
import type { GameState, ScenarioId } from '../src/sim';
import { coalIdle, coalThoughtful } from './helpers/fullplay';
import { REEF_BOT, reefIdle, reefThoughtful } from './helpers/reef';
import { RIVER_BOT, riverIdle, riverThoughtful } from './helpers/river';
import { EVENT_SEEDS } from './helpers/seeds';

/**
 * Multi-seed balance bands for the scenarios with an Act 1. Each scripted player runs on the real map with four
 * different weather / event seeds, so a goal that only passes on one lucky sequence of floods, heatwaves and
 * outbreaks shows up here. Recorded results (2026-10, after the maps were enlarged to 40x40 / 40x40 / 44x44):
 *   Coal Coast  thoughtful 4/4 three stars, estuary (10-year mean) 91-96; idle 0/4.
 *   River Town  thoughtful (switches the drought plan on at the first drought warning) 4/4 wins, river (10-year
 *               mean) 62-95, farms 61-73; the same player ignoring the warning loses seed 47 (farms 48);
 *               idle 0/4.
 *   Reef Island thoughtful 4/4 wins, coral (5-year mean) 52-67 (seed 11 is the tight one); the same plan without the
 *               local reef work (no starfish control, nurseries, wetlands, satellites or turtle lighting) loses on
 *               most seeds; idle 0/4.
 */
type Run = { act1: GameState; end: GameState };
const won = (s: GameState): boolean => buildReportCard(s).goalMet;
const value = (s: GameState, id: string): number => objectiveStatus(s).find((o) => o.id === id)?.current ?? NaN;
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const act2Low = (s: GameState): number => Math.min(...s.a2.yearly.filter((y) => y.year > getScenario(s.scenarioId).act2.startYear && y.year <= 2070).map((y) => y.budget));

const runs = (f: (seed: number | null) => Run): Run[] => EVENT_SEEDS.map((seed) => f(seed));
const coal = runs(coalThoughtful);
const coalBad = runs(coalIdle);
const river = runs(riverThoughtful);
const riverBad = runs(riverIdle);
const riverNoPlan47 = (() => {
  const keep = RIVER_BOT.droughtPlan;
  RIVER_BOT.droughtPlan = false;
  try { return riverThoughtful(47); } finally { RIVER_BOT.droughtPlan = keep; }
})();
const reef = runs(reefThoughtful);
const reefBad = runs(reefIdle);
const reefNoLocal = (() => {
  const keep = { ...REEF_BOT };
  Object.assign(REEF_BOT, { cull: 0, nurseries: 0, wetlands: 0, satellites: false, lights: 0 });
  try { return runs(reefThoughtful); } finally { Object.assign(REEF_BOT, keep); }
})();

function moneyChecks(id: ScenarioId, t: Run[]): void {
  const cap = getScenario(id).act2.carryOverCap ?? Infinity;
  it('carries at most the cap into Act 2; the rest becomes a Transition Fund paid out over the years', () => {
    for (const r of t) {
      const plan = carryOverPlan(r.act1);
      expect(plan, 'the boom saves more than the cap').not.toBeNull();
      expect(plan?.keep).toBe(cap);
      expect(plan?.drip ?? 0).toBeGreaterThan(0);
      expect(r.end.flags['fund.left']).toBe(0);
    }
  });
  it('makes Act 2 money a real constraint: a thoughtful player runs the bank down to under $200k at some point', () => {
    for (const r of t) expect(act2Low(r.end)).toBeLessThan(200);
  });
}

describe('Coal Coast across four event seeds', () => {
  it('the thoughtful run wins on every seed, with the estuary clearly healthy and three stars', () => {
    for (const r of coal) {
      expect(won(r.end)).toBe(true);
      expect(value(r.end, 'estuary')).toBeGreaterThanOrEqual(65);
      expect(buildReportCard(r.end).stars).toBeGreaterThanOrEqual(2);
    }
    expect(coal.filter((r) => buildReportCard(r.end).stars === 3).length).toBeGreaterThanOrEqual(3);
  });
  it('the idle run never wins', () => {
    for (const r of coalBad) expect(buildReportCard(r.end).stars).toBe(0);
  });
  moneyChecks('coal-coast', coal);
});

describe('River Town across four event seeds', () => {
  it('the thoughtful run (acting on the drought warning) wins on every seed', () => {
    for (const r of river) expect(won(r.end), `river ${value(r.end, 'river')} farms ${value(r.end, 'farms')}`).toBe(true);
    expect(mean(river.map((r) => value(r.end, 'river')))).toBeGreaterThanOrEqual(65);
  });
  it('ignoring the drought warning loses the long-drought seed (47): the plan is what carries farms and river through', () => {
    expect(won(riverNoPlan47.end)).toBe(false);
    const withPlan = river[3]?.end as GameState;
    expect(value(withPlan, 'farms') - value(riverNoPlan47.end, 'farms')).toBeGreaterThanOrEqual(10);
  });
  it('the idle run never wins', () => {
    for (const r of riverBad) {
      expect(won(r.end)).toBe(false);
      expect(value(r.end, 'river')).toBeLessThan(40);
    }
  });
  moneyChecks('river-town', river);
});

describe('Reef Island across four event seeds: local action decides the reef', () => {
  const coral = reef.map((r) => value(r.end, 'reef'));
  const coralNoLocal = reefNoLocal.map((r) => value(r.end, 'reef'));
  it('the thoughtful run keeps the reef on every seed, without a landslide', () => {
    for (const r of reef) expect(won(r.end), `coral ${value(r.end, 'reef')}`).toBe(true);
    expect(Math.min(...coral)).toBeGreaterThanOrEqual(50);
    expect(mean(coral)).toBeLessThan(70);
  });
  it('the same clean-energy plan without the local reef work loses the reef on most seeds', () => {
    expect(reefNoLocal.filter((r) => won(r.end)).length).toBeLessThanOrEqual(1);
    expect(mean(coral) - mean(coralNoLocal)).toBeGreaterThanOrEqual(10);
    // Same emissions path, so this gap is the local work, not the warming.
    for (let k = 0; k < reef.length; k++) expect(Math.abs((reef[k]?.end.tempC ?? 0) - (reefNoLocal[k]?.end.tempC ?? 0))).toBeLessThan(0.1);
  });
  it('the idle run loses the reef on every seed', () => {
    for (const r of reefBad) {
      expect(buildReportCard(r.end).stars).toBe(0);
      expect(value(r.end, 'reef')).toBeLessThan(15);
    }
  });
  moneyChecks('reef-island', reef);
});
