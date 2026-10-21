import { describe, expect, it } from 'vitest';
import {
  advanceDecade, advanceYear, applyAction, createGame, deserialize, displayYear, getScenario, SCENARIO_IDS, serialize, yearInDecade,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { buildN } from './helpers/autoplay';

/** Everything except the per-call version counter (presentational: renderers use it to notice changes). */
const norm = (s: GameState): unknown => JSON.parse(serialize({ ...s, version: 0 }));

function tenYears(s: GameState): ReturnType<typeof advanceYear> {
  let cur = s;
  let rep: ReturnType<typeof advanceYear>['report'] = null;
  for (let i = 0; i < 10; i++) {
    const r = advanceYear(cur);
    cur = r.state;
    rep = r.report;
    if (i < 9) expect(rep).toBeNull();
  }
  return { state: cur, report: rep };
}

const act1Ids = SCENARIO_IDS.filter((id) => !getScenario(id).prebuilt);

describe('hybrid time: advanceYear', () => {
  it.each(act1Ids)('%s: ten advanceYear calls equal one advanceDecade (empty and built-up towns)', (id) => {
    let s = createGame(id);
    for (let d = 0; d < 4; d++) {
      const a = advanceDecade(s);
      const b = tenYears(s);
      expect(norm(b.state)).toEqual(norm(a.state));
      expect(b.report).toEqual(a.report);
      s = a.state;
      if (s.phase !== 'act1') break;
      s = buildN(s, 'cottage', 3).state;
      s = buildN(s, 'farm', 1).state;
    }
  });

  it('money arrives every year and the report only at the decade end', () => {
    let s = createGame('coal-coast');
    s = buildN(s, 'cottage', 4).state;
    s = advanceDecade(s).state;
    s = buildN(s, 'farm', 1).state;
    const b0 = s.budget;
    const r1 = advanceYear(s);
    expect(r1.report).toBeNull();
    expect(yearInDecade(r1.state)).toBe(1);
    expect(displayYear(r1.state)).toBe(s.year + 1);
    expect(r1.state.year).toBe(s.year);
    expect(r1.state.budget).toBeGreaterThan(b0);
    const r2 = advanceYear(r1.state);
    expect(r2.state.budget).toBeGreaterThan(r1.state.budget);
  });

  it('a building placed mid-decade counts from the next year, and the decade still closes cleanly', () => {
    let s = createGame('coal-coast');
    s = buildN(s, 'cottage', 4).state;
    s = advanceDecade(s).state;
    for (let i = 0; i < 4; i++) s = advanceYear(s).state;
    const before = s.budget;
    const placed = buildN(s, 'cottage', 1);
    expect(placed.built).toBe(1);
    expect(placed.state.budget).toBeLessThan(before);
    let cur = placed.state;
    let report = null as ReturnType<typeof advanceYear>['report'];
    for (let i = 0; i < 6; i++) {
      const r = advanceYear(cur);
      cur = r.state;
      report = r.report;
    }
    expect(report).not.toBeNull();
    expect(cur.year).toBe(s.year + 10);
    expect(yearInDecade(cur)).toBe(0);
    expect(Object.keys(cur.flags).some((k) => k.startsWith('dec.'))).toBe(false);
    // the extra home lifts the population the decade ends on, versus the same decade without it
    let ctl = s;
    for (let i = 0; i < 6; i++) ctl = advanceYear(ctl).state;
    expect(cur.population).toBeGreaterThanOrEqual(ctl.population);
  });

  it('advanceDecade from mid-decade finishes the remaining years', () => {
    let s = createGame('coal-coast');
    s = buildN(s, 'cottage', 4).state;
    s = advanceDecade(s).state;
    for (let i = 0; i < 3; i++) s = advanceYear(s).state;
    const r = advanceDecade(s);
    expect(r.report).not.toBeNull();
    expect(r.state.year).toBe(s.year + 10);
    expect(yearInDecade(r.state)).toBe(0);
  });

  it('saves mid-decade and loads back identical; keeps ticking to the same result', () => {
    let s = createGame('coal-coast');
    s = buildN(s, 'cottage', 4).state;
    s = advanceDecade(s).state;
    for (let i = 0; i < 5; i++) s = advanceYear(s).state;
    const back = deserialize(serialize(s));
    expect(back).not.toBeNull();
    const loaded = back as GameState;
    expect(yearInDecade(loaded)).toBe(5);
    expect(norm(loaded)).toEqual(norm(s));
    expect(norm(advanceDecade(loaded).state)).toEqual(norm(advanceDecade(s).state));
  });

  it('a state at a decade boundary has no mid-decade flags and still accepts actions', () => {
    const s = advanceDecade(createGame('coal-coast')).state;
    expect(Object.keys(s.flags).some((k) => k.startsWith('dec.'))).toBe(false);
    expect(applyAction(s, { type: 'clear', x: 0, y: 0 }).result).toBeDefined();
  });
});
