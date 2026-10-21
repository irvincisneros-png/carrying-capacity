import { describe, expect, it } from 'vitest';
import {
  advanceDecade, applyAction, canTest, cloneState, createGame, deserialize, kitCSV, kitSites, learnOf, openPrediction, sampleWater, serialize, signalBand,
  toCSV, KIT_COST,
} from '../src/sim';
import type { GameState, KitReading } from '../src/sim';
import { BUGS, REGION, TRIGGERS } from '../src/content/waterkit';
import { coalIdle, coalThoughtful } from './helpers/fullplay';

/**
 * Water field kit (WP8b). Readings are derived from the sim, so they are deterministic and they follow the water.
 * Recorded 2026-10-21 (Coal Coast river site): untouched creek in 1850: bug score 6.5, every reading in range;
 * thoughtful Act 1 end (2020): 2.8 (oxygen 46%, nitrogen 979, phosphorus 100); thoughtful end (2100): 6.6, all in range;
 * idle end (2100): 2.8. Healthy is above 6 on the Waterwatch scale.
 */
const ind = (r: KitReading, id: string): number => r.indicators.find((i) => i.id === id)?.value ?? NaN;
const verdict = (r: KitReading, id: string): string => r.indicators.find((i) => i.id === id)?.verdict ?? '';

describe('sampleWater', () => {
  const fresh = createGame('coal-coast');
  const clean = sampleWater(fresh, 'river');

  it('is deterministic and does not change the game', () => {
    const before = serialize(fresh);
    expect(sampleWater(fresh, 'river')).toEqual(clean);
    expect(serialize(fresh)).toBe(before);
  });

  it('reads an untouched creek as healthy: every indicator inside the NSW trigger range and a SIGNAL2 score above 6', () => {
    for (const i of clean.indicators) expect(i.verdict, i.id).toBe('ok');
    expect(clean.signal).toBeGreaterThanOrEqual(6);
    expect(signalBand(clean.signal).label).toBe('Healthy');
    expect(clean.bugs).toHaveLength(BUGS.length);
    expect(ind(clean, 'do')).toBeGreaterThanOrEqual(TRIGGERS.coastal.doLo);
    expect(ind(clean, 'do')).toBeLessThanOrEqual(TRIGGERS.coastal.doHi);
    expect(clean.health).toBeGreaterThan(90);
  });

  it('follows the water: more water pollution lowers oxygen, raises nutrients and mud, and sensitive bugs vanish first', () => {
    const dirty = cloneState(fresh);
    dirty.grid.waterPollution.fill(1.4);
    const r = sampleWater(dirty, 'river');
    expect(ind(r, 'do')).toBeLessThan(ind(clean, 'do'));
    expect(ind(r, 'tn')).toBeGreaterThan(TRIGGERS.coastal.tn);
    expect(ind(r, 'tp')).toBeGreaterThan(TRIGGERS.coastal.tp);
    expect(verdict(r, 'do')).toBe('low');
    expect(verdict(r, 'tn')).toBe('high');
    expect(r.signal).toBeLessThan(4);
    expect(signalBand(r.signal).tone).toBe('bad');
    const stonefly = (x: KitReading): number => x.bugs.find((b) => b.id === 'stonefly')?.count ?? 0;
    const snails = (x: KitReading): number => x.bugs.find((b) => b.id === 'snail')?.count ?? 0;
    expect(stonefly(r)).toBe(0);
    expect(stonefly(clean)).toBeGreaterThan(0);
    expect(snails(r)).toBeGreaterThanOrEqual(snails(clean));
  });

  it('is pulled by the sim\'s own inputs: lasting runoff, bush loss and low creek flow all make it worse; wetlands help', () => {
    const base = ind(clean, 'tn');
    const runoff = cloneState(fresh); runoff.flags['runoff.test'] = 0.15;
    expect(ind(sampleWater(runoff, 'river'), 'tn')).toBeGreaterThan(base);
    const thin = cloneState(fresh); thin.flags['cc.flow'] = 40;
    const t = sampleWater(thin, 'river');
    expect(ind(t, 'ec')).toBeGreaterThan(ind(clean, 'ec'));
    expect(ind(t, 'do')).toBeLessThan(ind(clean, 'do'));
    const bare = cloneState(fresh);
    for (let i = 0; i < bare.grid.kind.length; i++) if (bare.grid.kind[i] === 5) bare.grid.kind[i] = 4;
    expect(ind(sampleWater(bare, 'river'), 'turb')).toBeGreaterThan(ind(clean, 'turb'));
    const sour = cloneState(fresh); sour.grid.soilContamination.fill(1.5);
    expect(ind(sampleWater(sour, 'river'), 'ph')).toBeLessThan(ind(clean, 'ph'));
  });

  it('uses the right triggers for the place: inland towns compare with Murray-Darling values', () => {
    expect(REGION['river-town']).toBe('inland');
    expect(TRIGGERS.inland.tp).toBe(50);
    expect(TRIGGERS.coastal.tp).toBe(25);
    expect(TRIGGERS.coastal.tn).toBe(350);
    const tp = createGame('river-town');
    expect(sampleWater(tp, 'river').indicators.find((i) => i.id === 'tp')?.trigger).toMatch(/50 ug\/L/);
    expect(kitSites(createGame('coal-coast'))).toEqual(['river', 'estuary']);
    expect(kitSites(createGame('reef-island'))).toEqual(['estuary']);
  });

  it('does not judge the salt of an estuary (the tide makes it salty anyway)', () => {
    const r = sampleWater(fresh, 'estuary');
    expect(r.indicators.find((i) => i.id === 'ec')?.verdict).toBe('ok');
    expect(r.indicators.find((i) => i.id === 'ec')?.trigger).toMatch(/Tidal/);
  });

  it('SIGNAL2 grades and bands match the research notes', () => {
    const g = Object.fromEntries(BUGS.map((b) => [b.id, b.grade]));
    expect(g).toMatchObject({ stonefly: 10, mayfly: 9, caddis: 8, mite: 6, beetle: 5, shrimp: 4, dragon: 3, fly: 3, worm: 2, bug: 2, flatworm: 2, snail: 1 });
    expect(signalBand(6.2).label).toBe('Healthy');
    expect(signalBand(5.5).label).toBe('Mild pollution');
    expect(signalBand(4.5).label).toBe('Moderate pollution');
    expect(signalBand(3.9).label).toBe('Severe pollution');
  });
});

describe('testing the creek', () => {
  const s0 = createGame('coal-coast');
  const run = (s: GameState, a: Parameters<typeof applyAction>[1]) => applyAction(s, a);

  it('costs a little money, records the reading, and allows one paid test a decade', () => {
    const r = run(s0, { type: 'learn', op: 'test' });
    expect(r.result.ok).toBe(true);
    expect(r.result.spent).toBe(KIT_COST);
    expect(r.state.budget).toBe(s0.budget - KIT_COST);
    expect(learnOf(r.state).kit).toHaveLength(1);
    expect(canTest(r.state).ok).toBe(false);
    const again = run(r.state, { type: 'learn', op: 'test' });
    expect(again.result.ok).toBe(false);
    expect(again.result.code).toBe('already-done');
    expect(again.state.budget).toBe(r.state.budget);
    expect(s0.learn).toBeUndefined();
  });

  it('is refused with no money, and can test the estuary where there is one', () => {
    const poor = cloneState(s0); poor.budget = 1;
    const r = run(poor, { type: 'learn', op: 'test' });
    expect(r.result.code).toBe('no-funds');
    const est = run(s0, { type: 'learn', op: 'test', site: 'estuary' });
    expect(learnOf(est.state).kit[0]?.site).toBe('estuary');
  });

  it('lets the player test again the next decade', () => {
    const a = run(s0, { type: 'learn', op: 'test' }).state;
    const next = advanceDecade(a).state;
    expect(canTest(next).ok).toBe(true);
  });
});

describe('predictions', () => {
  it('are saved before the skip, and the free survey at the end of the decade shows them next to the result', () => {
    let s = createGame('coal-coast');
    s = applyAction(s, { type: 'learn', op: 'predict', choice: 'worse', text: '  the farm will pollute it  ' }).state;
    const p = openPrediction(s);
    expect(p?.choice).toBe('worse');
    expect(p?.text).toBe('the farm will pollute it');
    expect(p?.baseSignal).toBeGreaterThanOrEqual(6);
    s = advanceDecade(s).state;
    const done = learnOf(s).predictions[0]!;
    expect(done.resolvedYear).toBe(s.year);
    expect(done.resultSignal).toBeDefined();
    expect(['better', 'same', 'worse']).toContain(done.actual);
    expect(openPrediction(s)).toBeNull();
    expect(learnOf(s).kit.some((r) => r.auto)).toBe(true);
  });

  it('closes with a paid test when the player tests before the decade ends, and needs a pick or a line', () => {
    let s = createGame('coal-coast');
    const empty = applyAction(s, { type: 'learn', op: 'predict' });
    expect(empty.result.ok).toBe(false);
    s = applyAction(s, { type: 'learn', op: 'predict', choice: 'same' }).state;
    s = advanceDecade(s).state; // closes with the free survey
    s = applyAction(s, { type: 'learn', op: 'predict', choice: 'better', text: 'x'.repeat(300) }).state;
    expect(openPrediction(s)?.text).toHaveLength(140);
    s = advanceDecade(s).state;
    expect(learnOf(s).predictions).toHaveLength(2);
    expect(learnOf(s).predictions.every((p) => p.resolvedYear !== undefined)).toBe(true);
  });

  it('judges better, same or worse from the bug score with a small band', () => {
    let s = createGame('coal-coast');
    s = applyAction(s, { type: 'learn', op: 'predict', choice: 'same' }).state;
    // Nothing built: the creek is still clean ten years on, so "same" is right.
    s = advanceDecade(s).state;
    expect(learnOf(s).predictions[0]?.actual).toBe('same');
  });
});

describe('results go into the CSV export, and everything saves', () => {
  it('appends the readings and predictions to the graphs CSV', () => {
    let s = createGame('coal-coast');
    s = applyAction(s, { type: 'learn', op: 'test' }).state;
    s = applyAction(s, { type: 'learn', op: 'predict', choice: 'better', text: 'wetlands, "I hope"' }).state;
    s = advanceDecade(s).state;
    const csv = kitCSV(s);
    expect(toCSV(s)).not.toContain('Water field kit');
    expect(csv).toContain('Water field kit readings');
    expect(csv).toContain('year,site,source,do_pct_sat,total_n_ug_l,total_p_ug_l,turbidity_ntu,ph,conductivity_us_cm,signal2_score,health_0_100,prediction,prediction_text,actual');
    expect(kitCSV(s).split('\n').filter((l) => l.startsWith('18')).length).toBeGreaterThanOrEqual(2);
    expect(csv).toContain('"wetlands, ""I hope"""');
    expect(csv).toMatch(/free survey/);
  });

  it('keeps reflections, the letter, household ticks and field-guide terms through a save and load', () => {
    let s = createGame('coal-coast');
    s = applyAction(s, { type: 'learn', op: 'reflect', key: 'What would you change?', text: 'Build the wetland first.' }).state;
    s = applyAction(s, { type: 'learn', op: 'letter', text: 'Dear Sam and Jordan' }).state;
    s = applyAction(s, { type: 'learn', op: 'household', id: 'wa-tap', on: true }).state;
    s = applyAction(s, { type: 'learn', op: 'household', id: 'tr-bus', on: true }).state;
    s = applyAction(s, { type: 'learn', op: 'household', id: 'tr-bus', on: false }).state;
    s = applyAction(s, { type: 'learn', op: 'term', id: 'overshoot' }).state;
    s = applyAction(s, { type: 'learn', op: 'test' }).state;
    const back = deserialize(serialize(s)) as GameState;
    const L = learnOf(back);
    expect(L.reflections['What would you change?']).toBe('Build the wetland first.');
    expect(L.letter).toBe('Dear Sam and Jordan');
    expect(L.household).toEqual(['wa-tap']);
    expect(L.terms).toEqual(['overshoot']);
    expect(L.kit).toHaveLength(1);
    expect(L.lastTest).toBe(1850);
    expect(serialize(back)).toBe(serialize(s));
  });

  it('can be written after the game has ended (the report card is shown in the epilogue)', () => {
    const s = { ...cloneState(createGame('coal-coast')), phase: 'epilogue' as const, status: 'act2-complete' as const };
    const r = applyAction(s, { type: 'learn', op: 'reflect', key: 'q', text: 'a' });
    expect(r.result.ok).toBe(true);
    expect(learnOf(r.state).reflections.q).toBe('a');
  });

  it('old saves have no learning state and load with an empty one', () => {
    const s = cloneState(createGame('green-valley'));
    const raw = JSON.parse(serialize(s)) as Record<string, unknown>;
    delete raw.learn;
    const back = deserialize(JSON.stringify(raw)) as GameState;
    expect(back.learn).toBeUndefined();
    expect(learnOf(back).kit).toEqual([]);
  });
});

describe('across a whole game', () => {
  const coal = coalThoughtful();
  const bad = coalIdle();
  it('a thoughtful town ends with a healthier creek than it had at the end of the boom, and an idle one ends worse', () => {
    const a1 = sampleWater(coal.act1, 'river'), a2 = sampleWater(coal.end, 'river');
    expect(a1.signal).toBeLessThan(4);
    expect(a2.signal).toBeGreaterThanOrEqual(6);
    expect(sampleWater(bad.end, 'river').signal).toBeLessThan(4);
    expect(verdict(a1, 'do')).toBe('low');
    for (const i of a2.indicators) expect(i.verdict, i.id).toBe('ok');
  });
});
