import { describe, expect, it } from 'vitest';
import {
  applyAction, castFor, checkBeats, condMet, createGame, deserialize, initResidents, metric, moodTarget, reactToEvents,
  renderText, residentDef, residentHome, resolveEndings, respond, selectEnding, serialize, societyShare, stepMoods, storyVars,
  t, tick, TileKind, wordCount, advanceDecade, startAct2, consumeEvents, cloneState, computeMeters, layersYearEnd, layersSeason,
} from '../src/sim';
import type { GameState, ScenarioId } from '../src/sim';
import { act2Sandbox, addBuilding, fillField, growTile, sandbox } from './helpers/fixtures';
import { runScript } from './helpers/autoplay';
import { CAUTIOUS_WANTS, DIRTY_ROADS, DIRTY_WANTS, greedyPlan } from './helpers/scripts';

const mood = (s: GameState, id: string): number => s.residents.list[id]?.mood ?? -1;
/** Steelworks, homes beside it and dusty air: what Mick's dust beat is waiting for. */
function smoky(s: GameState): void {
  addBuilding(s, 'steelworks', 5, 5);
  addBuilding(s, 'suburb', 9, 5);
  s.grid.airPollution.fill(8);
  // Mick has already told his first story.
  s.residents.fired['mick-furnace'] = 1950;
  (s.residents.list['mick-kowalski'] as { lastBeatYear: number }).lastBeatYear = 1950;
}

describe('conditions and text', () => {
  it('reads metrics from the game state', () => {
    const s = act2Sandbox();
    s.flags['x'] = true;
    s.flags['y'] = 3;
    expect(metric(s, 'year')).toBe(2025);
    expect(metric(s, 'flag.x')).toBe(1);
    expect(metric(s, 'flag.y')).toBe(3);
    expect(metric(s, 'flag.missing')).toBe(0);
    expect(metric(s, 'mood.lena-tran')).toBe(62);
    expect(metric(s, 'count.steelworks')).toBe(0);
    addBuilding(s, 'steelworks', 5, 5);
    expect(metric(s, 'count.steelworks')).toBe(1);
    expect(metric(s, 'heavyJobs')).toBe(150);
    expect(metric(s, 'pop.koala')).toBe(0);
    expect(metric(s, 'nonsense')).toBe(0);
    expect(metric(s, 'partnership')).toBe(20);
  });
  it('evaluates phase, year range, all-of and any-of tests', () => {
    const s = act2Sandbox();
    expect(condMet(s, undefined)).toBe(true);
    expect(condMet(s, { phase: ['act2'], years: [2020, 2030] })).toBe(true);
    expect(condMet(s, { phase: ['act1'] })).toBe(false);
    expect(condMet(s, { years: [2030, 2040] })).toBe(false);
    expect(condMet(s, { all: [t('year', '>=', 2025), t('year', '<=', 2025)] })).toBe(true);
    expect(condMet(s, { all: [t('year', '>', 2025)] })).toBe(false);
    expect(condMet(s, { any: [t('year', '>', 2025), t('year', '==', 2025)] })).toBe(true);
    expect(condMet(s, { any: [t('year', '<', 2000), t('year', '>', 2100)] })).toBe(false);
  });
  it('fills {placeholders} from real state numbers and leaves unknown ones visible', () => {
    const s = act2Sandbox();
    s.tempC = 1.234;
    const v = storyVars(s);
    expect(v.temp).toBe('1.2');
    expect(renderText('It is {temp} C in {year}.', v)).toBe('It is 1.2 C in 2025.');
    expect(renderText('{nope}', v)).toBe('{nope}');
    expect(wordCount('  one two   three ')).toBe(3);
  });
});

describe('resident moods', () => {
  it('start at each resident\'s start value and move towards a target driven by what they care about', () => {
    const s = act2Sandbox(TileKind.Land);
    expect(Object.keys(s.residents.list)).toHaveLength(6);
    expect(mood(s, 'lena-tran')).toBe(62);
    // A clean estuary pleases Lena; a filthy one does not.
    for (let i = 0; i < s.grid.kind.length; i++) if (i % 5 === 0) s.grid.kind[i] = TileKind.Estuary;
    const lena = residentDef('coal-coast', 'lena-tran');
    expect(lena).toBeDefined();
    const def = lena as NonNullable<typeof lena>;
    s.grid.waterPollution.fill(0);
    const happy = moodTarget(s, def);
    s.grid.waterPollution.fill(3);
    const sad = moodTarget(s, def);
    expect(happy).toBeGreaterThan(sad + 25);
    for (let k = 0; k < 40; k++) stepMoods(s, 0.1);
    expect(mood(s, 'lena-tran')).toBeLessThan(40);
    s.grid.waterPollution.fill(0);
    for (let k = 0; k < 60; k++) stepMoods(s, 0.1);
    expect(mood(s, 'lena-tran')).toBeGreaterThan(60);
  });
  it('closing the steelworks abruptly hurts Mick; a funded transition lifts him', () => {
    const base = act2Sandbox();
    addBuilding(base, 'steelworks', 5, 5);
    addBuilding(base, 'steelworks', 10, 5);
    stepMoods(base, 0.1); // records the jobs peak
    const mick = residentDef('coal-coast', 'mick-kowalski') as NonNullable<ReturnType<typeof residentDef>>;
    const open = moodTarget(base, mick);
    const closed = cloneState(base);
    closed.buildings = [];
    closed.grid.building.fill(0);
    const abrupt = moodTarget(closed, mick);
    const funded = cloneState(closed);
    funded.flags['transition.funded'] = 1;
    expect(abrupt).toBeLessThan(open - 5);
    expect(moodTarget(funded, mick)).toBeGreaterThan(abrupt + 15);
  });
  it('keeps moods inside 0..100 and the Society share bounded (+-8 in Act 2, +-3 in Act 1)', () => {
    const s = act2Sandbox();
    for (const id of Object.keys(s.residents.list)) (s.residents.list[id] as { mood: number }).mood = 0;
    expect(societyShare(s)).toBe(-8);
    for (const id of Object.keys(s.residents.list)) (s.residents.list[id] as { mood: number }).mood = 100;
    expect(societyShare(s)).toBe(8);
    const a1 = createGame('coal-coast');
    for (const id of Object.keys(a1.residents.list)) (a1.residents.list[id] as { mood: number }).mood = 0;
    expect(societyShare(a1)).toBe(-3);
    for (let k = 0; k < 50; k++) stepMoods(s, 0.5);
    for (const r of Object.values(s.residents.list)) {
      expect(r.mood).toBeGreaterThanOrEqual(0);
      expect(r.mood).toBeLessThanOrEqual(100);
    }
  });
  it('feeds Society through societyAdjust without overwriting other writers, and only up to the bound', () => {
    const s = act2Sandbox();
    s.a2.societyAdjust = -5;
    for (const id of Object.keys(s.residents.list)) (s.residents.list[id] as { mood: number }).mood = 0;
    layersSeason(s, [], 0);
    expect(s.a2.societyAdjust).toBeCloseTo(-5 - 8, 5);
    expect(s.residents.applied).toBeCloseTo(-8, 5);
    layersSeason(s, [], 1);
    expect(s.a2.societyAdjust).toBeCloseTo(-13, 3); // no double counting
    const low = computeMeters(s).society;
    for (const id of Object.keys(s.residents.list)) (s.residents.list[id] as { mood: number }).mood = 100;
    layersSeason(s, [], 2);
    expect(computeMeters(s).society).toBeGreaterThan(low + 10);
  });
  it('lightly nudges Society in Act 1 and keeps the existing tuning targets', () => {
    const dirty = runScript(createGame('coal-coast'), greedyPlan(DIRTY_WANTS, 1.0, 30, DIRTY_ROADS)).state;
    const cautious = runScript(createGame('coal-coast'), greedyPlan(CAUTIOUS_WANTS, 1.0)).state;
    for (const s of [dirty, cautious]) {
      expect(Math.abs(s.residents.nudge)).toBeLessThanOrEqual(6);
      expect(Math.abs(societyShare(s))).toBeLessThanOrEqual(3);
    }
    expect(dirty.meters.society).toBeGreaterThanOrEqual(45);
    expect(dirty.meters.society).toBeLessThanOrEqual(70); // re-banded from 65, see tests/tuning.test.ts
  });
  it('events shock the people they hurt: a fish kill hits the fisher hardest', () => {
    const s = act2Sandbox();
    const before = { lena: mood(s, 'lena-tran'), priya: mood(s, 'priya-shah') };
    reactToEvents(s, [{ id: 1, type: 'fish-kill', year: 2025, season: 0, seasonIndex: 0, severity: 1, text: 'Fish kill: test event.' }]);
    expect(mood(s, 'lena-tran')).toBeLessThan(before.lena - 12);
    expect(mood(s, 'priya-shah')).toBe(before.priya);
    reactToEvents(s, [{ id: 2, type: 'story', year: 2025, season: 0, seasonIndex: 0, severity: 1, text: 'Just a story, no shock.' }]);
    expect(mood(s, 'lena-tran')).toBeLessThan(before.lena - 12);
  });
});

describe('story beats', () => {
  it('fire when their conditions are met, as queued story events with a speaker and portrait', () => {
    const s = sandbox(TileKind.Land, { year: 1950 });
    addBuilding(s, 'steelworks', 5, 5);
    const fired = checkBeats(s);
    const ev = fired.find((e) => e.story?.ref === 'mick-furnace');
    expect(ev).toBeDefined();
    expect(ev?.type).toBe('story');
    expect(ev?.story?.channel).toBe('resident');
    expect(ev?.story?.speakerId).toBe('mick-kowalski');
    expect(ev?.story?.speaker).toBe('Mick Kowalski');
    expect(ev?.story?.portrait).toBe('mick-kowalski');
    expect(ev?.text).toMatch(/one suitcase/);
    expect(s.events).toContain(ev);
    expect(s.eventLog).toContain(ev);
    expect(s.residents.fired['mick-furnace']).toBe(1950);
    expect(checkBeats(s).some((e) => e.story?.ref === 'mick-furnace')).toBe(false); // once only
  });
  it('do not fire before their time, and respect the gap between one person\'s beats', () => {
    const s = sandbox(TileKind.Land, { year: 1940 });
    addBuilding(s, 'steelworks', 5, 5);
    expect(checkBeats(s).some((e) => e.story?.ref === 'mick-furnace')).toBe(false);
    s.year = 1950;
    checkBeats(s);
    s.year = 1955;
    addBuilding(s, 'suburb', 9, 5);
    s.grid.airPollution.fill(8);
    // mick-dust is eligible (smoky air) but Mick spoke 5 years ago and Act 1 beats are 10 years apart.
    expect(checkBeats(s).some((e) => e.story?.ref === 'mick-dust')).toBe(false);
    s.year = 1960;
    expect(checkBeats(s).some((e) => e.story?.ref === 'mick-dust')).toBe(true);
  });
  it('asks the player a question when a beat has a choice, and applies the answer\'s effects', () => {
    const s = sandbox(TileKind.Land, { year: 1980 });
    s.initialBushTiles = 100;
    smoky(s);
    const ev = checkBeats(s).find((e) => e.story?.ref === 'mick-dust');
    expect(ev?.story?.choice?.options.map((o) => o.id)).toEqual(['filters', 'later']);
    expect(s.residents.pending).toContain('mick-dust');
    const before = s.budget;
    const r = applyAction(s, { type: 'respond', beatId: 'mick-dust', optionId: 'filters' });
    expect(r.result.ok).toBe(true);
    expect(r.result.spent).toBe(20);
    expect(r.state.budget).toBe(before - 20);
    expect(r.state.residents.pending).not.toContain('mick-dust');
    expect(r.state.residents.choices['mick-dust']).toBe('filters');
    expect(r.state.flags['steel.filters']).toBe(1);
    expect(mood(r.state, 'mick-kowalski')).toBeGreaterThan(mood(s, 'mick-kowalski'));
    expect(Math.max(...Array.from(r.state.grid.airPollution))).toBeCloseTo(8 * 0.85, 4);
    expect(s.residents.pending).toContain('mick-dust'); // the original state was not mutated
  });
  it('rejects answers to questions nobody asked, unknown options and unaffordable ones', () => {
    const s = sandbox(TileKind.Land, { year: 1980, budget: 5 });
    smoky(s);
    checkBeats(s);
    expect(respond(s, 'lena-slick', 'sewage').result.ok).toBe(false);
    expect(respond(s, 'mick-dust', 'nope').result.ok).toBe(false);
    const poor = respond(s, 'mick-dust', 'filters');
    expect(poor.result.ok).toBe(false);
    expect(poor.result.code).toBe('no-funds');
    expect(respond(s, 'mick-dust', 'later').result.ok).toBe(true);
  });
  it('lets an unanswered question lapse after three years, with its own small consequence', () => {
    const s = sandbox(TileKind.Land, { year: 1980 });
    smoky(s);
    checkBeats(s);
    const m = mood(s, 'mick-kowalski');
    s.year = 1983;
    checkBeats(s);
    expect(s.residents.pending).not.toContain('mick-dust');
    expect(s.residents.choices['mick-dust']).toBe('ignored');
    expect(mood(s, 'mick-kowalski')).toBeLessThan(m);
  });
  it('lets story choices be answered at the turning point, between the acts', () => {
    const cautious = runScript(createGame('coal-coast'), greedyPlan(CAUTIOUS_WANTS, 1.0)).state;
    expect(cautious.phase).toBe('turning-point');
    const pending = cautious.residents.pending;
    for (const id of pending) {
      const beat = castFor('coal-coast').flatMap((r) => r.beats).find((b) => b.id === id);
      const r = applyAction(cautious, { type: 'respond', beatId: id, optionId: beat?.choice?.options[0]?.id ?? '' });
      expect(['ok', 'no-funds']).toContain(r.result.ok ? 'ok' : r.result.code);
    }
  });
  it('lets the scientist explain the player\'s own graphs with the real numbers', () => {
    const act1 = runScript(createGame('coal-coast'), greedyPlan(DIRTY_WANTS, 1.0, 30, DIRTY_ROADS)).state;
    const ev = act1.eventLog.find((e) => e.story?.ref === 'priya-graphs');
    expect(ev).toBeDefined();
    expect(ev?.text).toContain(`${Math.round(act1.co2)} ppm`);
    expect(ev?.text).toContain(`${act1.tempC.toFixed(1)} C`);
    expect(ev?.text).toContain(`${Math.round(metric(act1, 'estuary'))} out of 100`);
    expect(wordCount(ev?.text ?? '')).toBeLessThanOrEqual(60);
    // Later she quotes the player's emissions, and the temperature still on its way up.
    const a2 = startAct2(act1);
    let s = a2;
    while (s.year < 2052) s = tick(s, 1).state;
    const lag = s.eventLog.find((e) => e.story?.ref === 'priya-lag');
    expect(lag).toBeDefined();
    expect(lag?.text).toMatch(/\d+ kilotonnes/);
    expect(lag?.text).toMatch(/still moving towards \d\.\d C/);
    // The line quotes the equilibrium temperature as it stood when she said it (it keeps moving with later emissions).
    const at = s.a2.yearly.filter((y) => y.year === (lag?.year ?? 0) || y.year === (lag?.year ?? 0) + 1).map((y) => `${y.eqTempC.toFixed(1)} C`);
    expect(at.some((t) => (lag?.text ?? '').includes(t))).toBe(true);
  });
  it('describes the dirty Act 1 with Lena\'s fish kill at the turning point', () => {
    const act1 = runScript(createGame('coal-coast'), greedyPlan(DIRTY_WANTS, 1.0, 30, DIRTY_ROADS)).state;
    const refs = act1.eventLog.filter((e) => e.type === 'story' && e.story?.channel === 'resident').map((e) => e.story?.ref);
    expect(refs).toContain('lena-kill');
    expect(refs).toContain('mick-rumours');
    expect(refs).toContain('priya-graphs');
    for (const e of act1.eventLog) if (e.type === 'story' && e.story?.channel === 'resident') expect(wordCount(e.text)).toBeLessThanOrEqual(60);
  });
});

describe('epilogue endings', () => {
  it('chooses the first ending whose conditions hold, falling back to the last', () => {
    const s = act2Sandbox();
    const mick = residentDef('coal-coast', 'mick-kowalski') as NonNullable<ReturnType<typeof residentDef>>;
    expect(selectEnding(s, mick).quality).toBe('mixed'); // start mood 60 but no transition
    (s.residents.list['mick-kowalski'] as { mood: number }).mood = 10;
    expect(selectEnding(s, mick).quality).toBe('bad');
    (s.residents.list['mick-kowalski'] as { mood: number }).mood = 70;
    s.flags['transition.funded'] = 1;
    expect(selectEnding(s, mick).quality).toBe('good');
  });
  it('picks endings from outcomes for every resident and renders the numbers', () => {
    const s = act2Sandbox();
    const ends = resolveEndings(s);
    expect(ends).toHaveLength(6);
    for (const e of ends) {
      expect(['good', 'mixed', 'bad']).toContain(e.quality);
      expect(e.text).not.toMatch(/[{}]/);
      expect(e.title.length).toBeGreaterThan(3);
    }
    expect(ends.find((e) => e.id === 'aunty-june')?.needsConsultation).toBe(true);
    expect(ends.find((e) => e.id === 'mick-kowalski')?.needsConsultation).toBe(false);
    // Priya's ending follows the warming outcome.
    s.tempC = 1.5;
    expect(resolveEndings(s).find((e) => e.id === 'priya-shah')?.quality).toBe('good');
    s.tempC = 2.1;
    expect(resolveEndings(s).find((e) => e.id === 'priya-shah')?.quality).toBe('mixed');
    s.tempC = 2.6;
    expect(resolveEndings(s).find((e) => e.id === 'priya-shah')?.quality).toBe('bad');
  });
  it('places each resident near where they live', () => {
    const s = createGame('coal-coast');
    for (const def of castFor('coal-coast')) {
      const h = residentHome(s, def);
      const k = s.grid.kind[h.y * s.grid.w + h.x];
      expect([TileKind.Land, TileKind.Bush]).toContain(k);
    }
    const lena = residentHome(s, castFor('coal-coast')[1] as NonNullable<ReturnType<typeof residentDef>>);
    const kids = residentHome(s, castFor('coal-coast')[4] as NonNullable<ReturnType<typeof residentDef>>);
    expect(Math.abs(lena.x - kids.x) + Math.abs(lena.y - kids.y)).toBeGreaterThan(0);
  });
  it('is inert for a scenario with no cast', () => {
    expect(castFor('no-such-scenario' as ScenarioId)).toHaveLength(0);
    expect(initResidents('no-such-scenario' as ScenarioId).list).toEqual({});
    const g = createGame('river-town');
    expect(Object.keys(g.residents.list)).toHaveLength(6);
    const bare = { ...g, scenarioId: 'no-such-scenario' as ScenarioId, residents: initResidents('no-such-scenario' as ScenarioId) };
    expect(checkBeats(bare as GameState)).toEqual([]);
  });
  it('survives a save and load with its moods, fired beats and history', () => {
    const s = runScript(createGame('coal-coast'), greedyPlan(DIRTY_WANTS, 1.0, 30, DIRTY_ROADS)).state;
    expect(Object.keys(s.residents.fired).length).toBeGreaterThan(5);
    const back = deserialize(serialize(s));
    expect(back).not.toBeNull();
    expect(back?.residents).toEqual(s.residents);
    expect(back?.eventLog.filter((e) => e.type === 'story').map((e) => e.story?.ref)).toEqual(
      s.eventLog.filter((e) => e.type === 'story').map((e) => e.story?.ref),
    );
  });
});

void consumeEvents;
void fillField;
void growTile;
void layersYearEnd;
