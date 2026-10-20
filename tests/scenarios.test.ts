import { describe, expect, it } from 'vitest';
import {
  advanceDecade, applyAction, canPlace, createGame, getScenario, isScenarioId, SCENARIO_IDS, SCENARIOS,
} from '../src/sim';
import { buildN } from './helpers/autoplay';

describe('scenario definitions', () => {
  it('defines all six scenarios with the required fields', () => {
    expect(SCENARIO_IDS).toEqual(['coal-coast', 'green-valley', 'river-town', 'reef-island', 'red-dirt', 'net-zero-city']);
    for (const id of SCENARIO_IDS) {
      const sc = getScenario(id);
      expect(sc.id).toBe(id);
      expect(sc.name.length).toBeGreaterThan(2);
      expect(sc.mapW).toBeGreaterThanOrEqual(16);
      expect(sc.endYear).toBeGreaterThan(sc.startYear);
      expect((sc.endYear - sc.startYear) % 10).toBe(0);
      expect(sc.startBudget).toBeGreaterThan(0);
      expect(sc.terrain.bushCover).toBeGreaterThan(0);
      for (const k of ['budgetMult', 'eventSeverity', 'climateSensitivityMult', 'remediationYears', 'hintLevel'] as const) {
        expect(typeof sc.modifiers[k]).toBe('number');
      }
    }
  });
  it('coal-coast is the full 32x32 default; green-valley is the 16x16 tutorial; others are flagged TODO', () => {
    const c = getScenario('coal-coast');
    expect([c.mapW, c.mapH, c.startYear, c.endYear, c.startBudget, c.difficulty]).toEqual([32, 32, 1850, 2020, 100, 'easy']);
    expect(c.todo).toBeUndefined();
    const g = getScenario('green-valley');
    expect([g.mapW, g.mapH, g.difficulty]).toEqual([16, 16, 'tutorial']);
    for (const id of ['green-valley', 'river-town', 'reef-island', 'red-dirt', 'net-zero-city'] as const) {
      expect(SCENARIOS[id].todo).toBeTruthy();
    }
    expect(getScenario('net-zero-city').startYear).toBe(2025);
  });
  it('isScenarioId guards', () => {
    expect(isScenarioId('coal-coast')).toBe(true);
    expect(isScenarioId('toString')).toBe(false);
  });
  it('every scenario can be created and advanced to its end year', () => {
    for (const id of SCENARIO_IDS) {
      let s = createGame(id);
      const sc = getScenario(id);
      expect(s.year).toBe(sc.startYear);
      expect(s.budget).toBe(Math.round(sc.startBudget * sc.modifiers.budgetMult));
      let guard = 0;
      while (s.status === 'playing' && guard++ < 40) s = advanceDecade(s).state;
      expect(s.year).toBe(sc.endYear);
      expect(s.status).toBe('act1-complete');
      expect(s.history).toHaveLength((sc.endYear - sc.startYear) / 10 + 1);
    }
  });
  it('late-start scenarios inherit legacy emissions so the climate starts near the real record', () => {
    const s = createGame('net-zero-city');
    expect(s.multiplier).toBeCloseTo(1, 6);
    expect(s.co2).toBeGreaterThan(410);
  });
  it('modifiers apply: budgetMult scales the start; climate sensitivity scales warming', () => {
    const v = createGame('green-valley');
    expect(v.budget).toBe(225);
    const base = createGame('coal-coast');
    const hot = createGame('reef-island');
    expect(hot.tempC / hot.co2).not.toBe(base.tempC / base.co2);
  });
  it('availability overrides disable or delay buildings per scenario', () => {
    const s = { ...createGame('reef-island'), year: 2020, budget: 1e6 };
    const c = canPlace(s, 'coalmine', 5, 5);
    expect(c.code).toBe('locked');
    const rt = { ...createGame('river-town'), year: 2020, budget: 1e6 };
    expect(canPlace(rt, 'port', 5, 5).code).toBe('locked');
  });
  it('green-valley (16x16) supports normal play', () => {
    let s = createGame('green-valley');
    const r = buildN(s, 'cottage', 3);
    expect(r.built).toBe(3);
    s = r.state;
    expect(applyAction(s, { type: 'place', building: 'farm', x: 14, y: 14 }).result.code).not.toBe('out-of-bounds');
    expect(canPlace(s, 'cottage', 16, 0).code).toBe('out-of-bounds');
  });
});
