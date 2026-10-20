import { describe, expect, it } from 'vitest';
import {
  applyAction, advanceDecade, BASE_GRANT, cloneState, computeDemand, computeMeters, decadeIncome, economySnapshot,
  GRID_YEAR, growPopulation, INCOME_PER_JOB, TileKind,
} from '../src/sim';
import type { BuildingId, GameState } from '../src/sim';
import { paint, sandbox } from './helpers/fixtures';

function build(s: GameState, id: BuildingId, x: number, y: number): GameState {
  const r = applyAction(s, { type: 'place', building: id, x, y });
  if (!r.result.ok) throw new Error(r.result.reason);
  return r.state;
}

describe('population', () => {
  it('moves 50% of the way toward housing each decade', () => {
    expect(growPopulation(0, 100)).toBe(50);
    expect(growPopulation(50, 100)).toBe(75);
    expect(growPopulation(100, 100)).toBe(100);
    expect(growPopulation(100, 0)).toBe(50); // shrinks if homes are demolished
  });
  it('advancing a decade grows population from housing', () => {
    let s = sandbox(TileKind.Land, { year: 1850 });
    s = build(s, 'cottage', 1, 1);
    s = build(s, 'cottage', 3, 1);
    const { state } = advanceDecade(s);
    expect(state.population).toBe(20); // housing 40 -> +50% of the gap
  });
});

describe('jobs and income', () => {
  it('filled jobs = min(jobs, population)', () => {
    let s = sandbox(TileKind.Land, { year: 1850 });
    s = build(s, 'farm', 1, 1); // 10 jobs
    s = build(s, 'farm', 4, 1); // 20 jobs
    expect(economySnapshot({ ...s, population: 5 }).filledJobs).toBe(5);
    expect(economySnapshot({ ...s, population: 500 }).filledJobs).toBe(20);
    expect(economySnapshot({ ...s, population: 5 }).unfilledJobs).toBe(15);
    expect(economySnapshot({ ...s, population: 500 }).unemployed).toBe(480);
  });
  it('income = filled jobs x 0.5 (+ grant), scaled by budgetMult', () => {
    let s = sandbox(TileKind.Land, { year: 1850 });
    s = build(s, 'farm', 1, 1);
    const snap = economySnapshot({ ...s, population: 100 });
    expect(decadeIncome(snap, 1)).toBe(Math.round(10 * INCOME_PER_JOB + BASE_GRANT));
    expect(decadeIncome(snap, 2)).toBe(Math.round((10 * INCOME_PER_JOB + BASE_GRANT) * 2));
  });
  it('advanceDecade pays income into the budget', () => {
    let s = sandbox(TileKind.Land, { year: 1850, budget: 1000 });
    s = build(s, 'cottage', 1, 1);
    s = build(s, 'cottage', 3, 1);
    s = build(s, 'farm', 6, 1);
    const before = s.budget;
    const { state, report } = advanceDecade(s);
    expect(report?.income).toBe(state.lastIncome);
    expect(state.budget).toBe(before + state.lastIncome);
    expect(state.lastIncome).toBeGreaterThan(BASE_GRANT);
  });
});

describe('power', () => {
  const coalMineAt = (year: number): GameState => {
    let s = sandbox(TileKind.Land, { year: 1850 });
    paint(s, 10, 1, 1, 2, TileKind.Rock);
    s = build(s, 'coalmine', 8, 1); // -2 power
    s = build(s, 'cottage', 1, 1); // -1 power
    return { ...s, year };
  };
  it('negative power is ignored before 1920', () => {
    const snap = economySnapshot(coalMineAt(1910));
    expect(snap.powerDemand).toBe(3);
    expect(snap.gridActive).toBe(false);
    expect(snap.powerDeficit).toBe(0);
  });
  it('a deficit appears from 1920 and cuts income', () => {
    expect(GRID_YEAR).toBe(1920);
    const s = coalMineAt(1920);
    const snap = economySnapshot({ ...s, population: 100 });
    expect(snap.gridActive).toBe(true);
    expect(snap.powerDeficit).toBe(3);
    const noDeficit = decadeIncome({ ...snap, powerDeficit: 0 }, 1);
    expect(decadeIncome(snap, 1)).toBeLessThan(noDeficit);
  });
  it('a coal power station removes the deficit', () => {
    let s = coalMineAt(1920);
    paint(s, 20, 10, 1, 4, TileKind.River);
    s = build(s, 'coalpower', 18, 10);
    const snap = economySnapshot(s);
    expect(snap.powerSupply).toBe(40);
    expect(snap.powerDeficit).toBe(0);
  });
  it('demand text mentions power after 1920 when short, and homes when jobs are unfilled', () => {
    const s = coalMineAt(1930);
    const d = computeDemand(s);
    expect(d.text).toMatch(/power/);
    expect(d.text).toMatch(/homes/);
    const early = computeDemand({ ...coalMineAt(1860) });
    expect(early.text).not.toMatch(/units short/);
  });
  it('demand text has a fallback when nothing is short', () => {
    const s = sandbox(TileKind.Land, { year: 1850 });
    expect(computeDemand(s).items).toHaveLength(1);
  });
});

describe('meters', () => {
  it('are always within 0..100, even for extreme states', () => {
    const states: GameState[] = [];
    let s = sandbox(TileKind.Land, { year: 2020 });
    states.push(s);
    s = cloneState(s);
    s.tempC = 50;
    s.population = 1e6;
    s.grid.airPollution.fill(1e4);
    s.grid.waterPollution.fill(1e4);
    s.grid.soilContamination.fill(1e4);
    states.push(s);
    const t = cloneState(sandbox(TileKind.Bush, { year: 1850 }));
    t.tempC = -5;
    states.push(t);
    for (const st of states) {
      const m = computeMeters(st);
      for (const v of [m.economy, m.society, m.environment]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
  it('a pristine map scores 100 on Environment', () => {
    const s = sandbox(TileKind.Bush, { year: 1850 });
    s.initialBushTiles = s.grid.w * s.grid.h;
    s.tempC = 0;
    expect(computeMeters(s).environment).toBe(100);
  });
  it('clearing bush lowers Environment; pollution lowers it further', () => {
    const base = sandbox(TileKind.Bush, { year: 1900 });
    base.initialBushTiles = 1024;
    const full = computeMeters(base).environment;
    const cleared = cloneState(base);
    cleared.grid.kind.fill(TileKind.Land);
    const mCleared = computeMeters(cleared).environment;
    expect(mCleared).toBeLessThan(full);
    cleared.grid.airPollution.fill(2);
    expect(computeMeters(cleared).environment).toBeLessThan(mCleared);
  });
  it('warming and water pollution reduce reef health and so Environment', () => {
    const s = sandbox(TileKind.Reef, { year: 1900 });
    s.initialBushTiles = 0;
    const cool = computeMeters({ ...s, tempC: 0 }).environment;
    const hot = computeMeters({ ...s, tempC: 1.5 }).environment;
    expect(hot).toBeLessThan(cool);
    const dirty = cloneState({ ...s, tempC: 0 });
    dirty.grid.waterPollution.fill(3);
    expect(computeMeters(dirty).environment).toBeLessThan(cool);
  });
  it('pollution near housing lowers Society', () => {
    let s = sandbox(TileKind.Land, { year: 1900 });
    s = build(s, 'cottage', 10, 10);
    s = { ...s, population: 20 };
    const clean = computeMeters(s).society;
    const dirty = cloneState(s);
    dirty.grid.airPollution.fill(5);
    expect(computeMeters(dirty).society).toBeLessThan(clean);
  });
  it('a power deficit lowers the Economy meter (same year, same jobs)', () => {
    let s = sandbox(TileKind.Land, { year: 1920 });
    s = build(s, 'factory', 5, 5);
    s = { ...s, population: 100 };
    const deficit = computeMeters(s).economy;
    // Same state but the factory's power draw is met by an (unrealistic) free supply: model by pre-1920 grid-off.
    const gridOffYearEquivalent = computeMeters({ ...s, year: 1919 }).economy;
    expect(economySnapshot(s).powerDeficit).toBe(5);
    expect(economySnapshot({ ...s, year: 1919 }).powerDeficit).toBe(0);
    expect(deficit).toBeLessThan(gridOffYearEquivalent);
  });
});
