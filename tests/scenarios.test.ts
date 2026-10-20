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
      expect(sc.endYear).toBeGreaterThanOrEqual(sc.startYear);
      if (!sc.prebuilt) expect(sc.endYear).toBeGreaterThan(sc.startYear);
      expect((sc.endYear - sc.startYear) % 10).toBe(0);
      expect(sc.startBudget).toBeGreaterThan(0);
      expect(sc.terrain.bushCover).toBeGreaterThan(0);
      for (const k of ['budgetMult', 'eventSeverity', 'climateSensitivityMult', 'remediationYears', 'hintLevel'] as const) {
        expect(typeof sc.modifiers[k]).toBe('number');
      }
    }
  });
  it('coal-coast is the 40x40 default; green-valley is the 20x20 tutorial; every scenario is finished', () => {
    const c = getScenario('coal-coast');
    expect([c.mapW, c.mapH, c.startYear, c.endYear, c.startBudget, c.difficulty]).toEqual([40, 40, 1850, 2020, 100, 'easy']);
    const g = getScenario('green-valley');
    expect([g.mapW, g.mapH, g.difficulty]).toEqual([20, 20, 'tutorial']);
    for (const id of SCENARIO_IDS) {
      expect(SCENARIOS[id].todo, id).toBeUndefined();
      expect(SCENARIOS[id].act2.todo, id).toBeUndefined();
    }
    expect(getScenario('net-zero-city').startYear).toBe(2025);
    expect(getScenario('net-zero-city').prebuilt).toBe('city');
    expect([getScenario('net-zero-city').mapW, getScenario('net-zero-city').mapH]).toEqual([48, 48]);
    expect(SCENARIO_IDS.map((id) => SCENARIOS[id].difficulty)).toEqual(['easy', 'tutorial', 'medium', 'hard', 'hard', 'expert']);
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
      if (sc.prebuilt) {
        // Net Zero City starts in Act 2 with a finished city.
        expect(s.phase).toBe('act2');
        expect(s.buildings.length).toBeGreaterThan(200);
        expect(s.turningPoint?.title).toBe(sc.act2.turningPoint.title);
        continue;
      }
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
  it('green-valley (20x20) supports normal play', () => {
    let s = createGame('green-valley');
    const r = buildN(s, 'cottage', 3);
    expect(r.built).toBe(3);
    s = r.state;
    expect(applyAction(s, { type: 'place', building: 'farm', x: 14, y: 14 }).result.code).not.toBe('out-of-bounds');
    expect(canPlace(s, 'cottage', 20, 0).code).toBe('out-of-bounds');
  });
});
