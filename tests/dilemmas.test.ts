import { describe, expect, it } from 'vitest';
import {
  ACT1_MIN_GAP, ACT2_OFFERS_PER_DECADE, applyAction, choose, cloneState, createGame, DILEMMA_SOCIETY_CAP, dilemmaSociety, dilemmasFor,
  EVIDENCE_REWARD, getDilemma, layersSeason, tick, offerAct1, offerAct2, societyShare, TileKind, wordCount,
} from '../src/sim';
import type { GameState, ScenarioId } from '../src/sim';
import { runScript } from './helpers/autoplay';
import { CAUTIOUS_WANTS, DIRTY_WANTS, greedyPlan } from './helpers/scripts';
import { act2Sandbox, addBuilding, paint } from './helpers/fixtures';

const pendingEvents = (s: GameState): string[] => s.eventLog.filter((e) => e.story?.channel === 'dilemma' && e.story.choice).map((e) => e.story?.ref ?? '');

describe('Act 1 cards', () => {
  it('offer about four to five dilemmas across the whole of Act 1, at least 20 years apart', () => {
    for (const wants of [DIRTY_WANTS, CAUTIOUS_WANTS]) {
      const s = runScript(createGame('coal-coast'), greedyPlan(wants, 1.0)).state;
      const years = Object.values(s.dilemmas.offered).sort((a, b) => a - b);
      expect(years.length).toBeGreaterThanOrEqual(4);
      expect(years.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < years.length; i++) expect((years[i] ?? 0) - (years[i - 1] ?? 0)).toBeGreaterThanOrEqual(ACT1_MIN_GAP);
      for (const id of Object.keys(s.dilemmas.offered)) expect(getDilemma('coal-coast', id)?.phase).toBe('act1');
    }
  });
  it('only offers a card whose condition holds: no strike without heavy industry', () => {
    const quiet = createGame('coal-coast');
    quiet.year = 1960;
    for (const id of ['a1-outfall', 'a1-ridge', 'a1-smoke']) quiet.dilemmas.offered[id] = 1900;
    offerAct1(quiet);
    expect(quiet.dilemmas.pending).toEqual(['a1-tip']); // the strike and the smoke need a steelworks or similar
    const works = createGame('coal-coast');
    works.year = 1960;
    addBuilding(works, 'steelworks', 5, 5);
    for (const id of ['a1-outfall', 'a1-ridge']) works.dilemmas.offered[id] = 1900;
    offerAct1(works);
    expect(['a1-smoke', 'a1-strike']).toContain(works.dilemmas.pending[0]);
  });
  it('shapes the town: the settling tank cleans the estuary, a bare pipe fouls it', () => {
    const mk = (): GameState => {
      const s = createGame('coal-coast');
      s.year = 1880;
      s.budget = 100;
      offerAct1(s);
      return s;
    };
    const pipe = applyAction(mk(), { type: 'choose', dilemmaId: 'a1-outfall', optionId: 'pipe' }).state;
    const tank = applyAction(mk(), { type: 'choose', dilemmaId: 'a1-outfall', optionId: 'tank' }).state;
    const est = (s: GameState): number => {
      let t = 0;
      for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.Estuary) t += s.grid.waterPollution[i] ?? 0;
      return t;
    };
    expect(est(pipe)).toBeGreaterThan(est(tank));
    expect(est(pipe)).toBeGreaterThan(0.25 * 3);
    expect(tank.budget).toBe(80);
    expect(pipe.budget).toBe(100);
  });
});

describe('Act 2 scheduling', () => {
  it('puts cards on the table in years 1, 4 and 7 of each decade, never more than three, never more than two waiting', () => {
    const s = act2Sandbox(TileKind.Land);
    const waiting: number[] = [];
    const seen: number[] = [];
    for (let y = 2025; y < 2036; y++) {
      s.year = y;
      offerAct2(s);
      waiting.push(s.dilemmas.pending.length);
      seen.push(Object.keys(s.dilemmas.offered).length);
    }
    // Years 2025 (off 0) none; 2026 first; 2029 second; 2032 third; capped at three in the decade.
    expect(seen.slice(0, 2)).toEqual([0, 1]);
    expect(Math.max(...waiting)).toBeLessThanOrEqual(2);
    expect(seen[seen.length - 1]).toBeLessThanOrEqual(ACT2_OFFERS_PER_DECADE);
    expect(seen[seen.length - 1]).toBe(3); // the first lapsed (5 years) so the third could come
    const first = s.eventLog.find((e) => e.story?.channel === 'dilemma');
    expect(first?.story?.choice?.options.length).toBeGreaterThanOrEqual(2);
    expect(first?.story?.choice?.prompt).toBe(getDilemma('coal-coast', first?.story?.ref ?? '')?.title);
    expect(wordCount(first?.text ?? '')).toBeLessThanOrEqual(75);
  });
  it('offers three in a decade when the player keeps up', () => {
    const s = act2Sandbox(TileKind.Land);
    for (let y = 2025; y < 2035; y++) {
      s.year = y;
      offerAct2(s);
      for (const id of s.dilemmas.pending.slice()) {
        const d = getDilemma('coal-coast', id);
        const r = applyAction(s, { type: 'choose', dilemmaId: id, optionId: d?.options[d.options.length - 1]?.id ?? '' });
        if (r.result.ok) Object.assign(s, { dilemmas: r.state.dilemmas, budget: r.state.budget });
      }
    }
    const offered = Object.entries(s.dilemmas.offered);
    expect(offered).toHaveLength(3);
    expect(offered.map(([, y]) => y)).toEqual([2026, 2029, 2032]);
  });
  it('picks eligible cards by priority, and holds back cards whose conditions are not met', () => {
    const s = act2Sandbox(TileKind.Land);
    s.year = 2026;
    offerAct2(s);
    expect(s.dilemmas.pending).not.toContain('d2-closure'); // no steelworks yet
    const c = act2Sandbox(TileKind.Land);
    addBuilding(c, 'steelworks', 5, 5);
    addBuilding(c, 'coalpower', 9, 5);
    c.year = 2026;
    offerAct2(c);
    expect(c.dilemmas.pending).toEqual(['d2-closure']); // priority 10 beats the coal question
    c.year = 2029;
    offerAct2(c);
    expect(c.dilemmas.pending).toEqual(['d2-closure', 'd2-coalphase']);
    expect(pendingEvents(c)).toEqual(['d2-closure', 'd2-coalphase']);
  });
  it('lets recurring problems come back, a quarter-century later', () => {
    const s = act2Sandbox(TileKind.Land);
    s.eventLog.push({ id: 900, type: 'heatwave', year: 2029, season: 0, seasonIndex: 0, severity: 1, text: 'Heatwave: a long run of days near 40 C.' });
    s.year = 2030;
    s.dilemmas.offered['d2-heat'] = 2030;
    expect(dilemmasFor('coal-coast').find((d) => d.id === 'd2-heat')?.repeat).toBe(25);
    s.year = 2058;
    s.eventLog.push({ id: 901, type: 'heatwave', year: 2057, season: 0, seasonIndex: 0, severity: 1, text: 'Heatwave: a long run of days near 40 C.' });
    for (const d of dilemmasFor('coal-coast')) if (d.phase === 'act2' && d.id !== 'd2-heat') s.dilemmas.offered[d.id] = 2040;
    offerAct2(s);
    expect(s.dilemmas.pending).toEqual(['d2-heat']);
  });
  it('has no cards for an unknown scenario, and every real scenario has its own deck', () => {
    expect(dilemmasFor('no-such-scenario' as ScenarioId)).toHaveLength(0);
    for (const id of ['green-valley', 'river-town', 'reef-island', 'red-dirt', 'net-zero-city'] as const) {
      expect(dilemmasFor(id).length, id).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('choosing', () => {
  const offerOne = (id: string, tweak: (s: GameState) => void = () => undefined): GameState => {
    const s = act2Sandbox(TileKind.Land);
    tweak(s);
    s.dilemmas.offered[id] = s.year;
    s.dilemmas.pending.push(id);
    return s;
  };
  it('applies money, flags, income, resident moods and tile changes, and records the decision', () => {
    const s = offerOne('d2-farmrunoff', (x) => { paint(x, 2, 2, 4, 1, TileKind.River); x.grid.waterPollution.fill(1); });
    const lena0 = s.residents.list['lena-tran']?.mood ?? 0;
    const r = applyAction(s, { type: 'choose', dilemmaId: 'd2-farmrunoff', optionId: 'pay-fence' });
    expect(r.result.ok).toBe(true);
    expect(r.result.spent).toBe(22);
    const n = r.state;
    expect(n.budget).toBe(s.budget - 22);
    expect(n.flags['farm.riparian']).toBe(1);
    expect(n.residents.list['lena-tran']?.mood).toBe(lena0 + 5);
    expect(n.residents.list['dot-harris']?.mood).toBe((s.residents.list['dot-harris']?.mood ?? 0) + 4);
    expect(n.grid.waterPollution[2 * 32 + 2]).toBeCloseTo(0.88, 5);
    expect(n.grid.waterPollution[10 * 32 + 10]).toBe(1);
    expect(n.dilemmas.pending).toEqual([]);
    expect(n.dilemmas.decisions).toHaveLength(1);
    expect(n.dilemmas.decisions[0]).toMatchObject({ dilemmaId: 'd2-farmrunoff', optionId: 'pay-fence', evidenceBacked: true });
    expect(n.dilemmas.decisions[0]?.impact).toBeGreaterThan(5);
    expect(n.residents.actions['chose.d2-farmrunoff.pay-fence']).toBe(1);
    expect(n.eventLog.at(-1)?.story).toMatchObject({ channel: 'dilemma', ref: 'd2-farmrunoff' });
    expect(s.dilemmas.pending).toEqual(['d2-farmrunoff']); // input unchanged
  });
  it('rewards the option the evidence backs, a little, with Society and the scientist\'s approval', () => {
    const s = offerOne('d2-coalphase');
    const evidence = applyAction(s, { type: 'choose', dilemmaId: 'd2-coalphase', optionId: 'renewables-first' }).state;
    const other = applyAction(s, { type: 'choose', dilemmaId: 'd2-coalphase', optionId: 'keep-coal' }).state;
    expect(evidence.dilemmas.adjust).toBe(EVIDENCE_REWARD.society);
    expect(other.dilemmas.adjust).toBe(-1); // keep-coal costs Society a point and earns no reward
    expect(evidence.residents.list['priya-shah']?.mood).toBe((s.residents.list['priya-shah']?.mood ?? 0) + 6 + EVIDENCE_REWARD.mood);
    expect(other.residents.list['priya-shah']?.mood).toBe((s.residents.list['priya-shah']?.mood ?? 0) - 8);
  });
  it('can change the yearly income, which then flows into the budget', () => {
    const s = offerOne('d2-hydrogen');
    const r = applyAction(s, { type: 'choose', dilemmaId: 'd2-hydrogen', optionId: 'hydrogen' }).state;
    expect(r.flags['income.adj']).toBe(4);
    // Same state, one year on, with and without the running income.
    const plain = tick(Object.assign(cloneState(r), { flags: {} }), 1).state;
    const boosted = tick(cloneState(r), 1).state;
    expect(boosted.lastIncome).toBe(plain.lastIncome + 4);
    expect(boosted.budget - plain.budget).toBe(4);
  });
  it('refuses cards not on the table, unknown options and options the budget cannot cover', () => {
    const s = offerOne('d2-coalphase');
    expect(applyAction(s, { type: 'choose', dilemmaId: 'd2-heat', optionId: 'trees' }).result.ok).toBe(false);
    expect(applyAction(s, { type: 'choose', dilemmaId: 'd2-coalphase', optionId: 'nope' }).result.ok).toBe(false);
    const poor = { ...s, budget: 10 };
    const r = applyAction(poor, { type: 'choose', dilemmaId: 'd2-coalphase', optionId: 'renewables-first' });
    expect(r.result.code).toBe('no-funds');
    expect(poor.dilemmas.pending).toEqual(['d2-coalphase']);
    expect(choose(poor, 'd2-coalphase', 'keep-coal').result.ok).toBe(true); // a money-making option is still on offer
  });
  it('lets an ignored card lapse after five years, with a small cost', () => {
    const s = act2Sandbox(TileKind.Land);
    s.year = 2026;
    offerAct2(s);
    const id = s.dilemmas.pending[0] ?? '';
    expect(id).not.toBe('');
    s.year = 2030;
    offerAct2(s);
    expect(s.dilemmas.pending).toContain(id);
    s.year = 2031;
    offerAct2(s);
    expect(s.dilemmas.pending).not.toContain(id);
    const d = s.dilemmas.decisions.find((x) => x.dilemmaId === id);
    expect(d?.optionId).toBe('ignored');
    expect(d?.optionLabel).toMatch(/Put off/);
    expect(s.dilemmas.adjust).toBe(-1);
  });
  it('keeps the Society nudge from choices within +-10 and folds it into Society each season', () => {
    const s = act2Sandbox(TileKind.Land);
    s.dilemmas.adjust = 50;
    expect(dilemmaSociety(s)).toBe(DILEMMA_SOCIETY_CAP);
    s.dilemmas.adjust = -50;
    expect(dilemmaSociety(s)).toBe(-DILEMMA_SOCIETY_CAP);
    const t = act2Sandbox(TileKind.Land);
    for (const id of Object.keys(t.residents.list)) (t.residents.list[id] as { mood: number }).mood = 50;
    t.dilemmas.adjust = 6;
    layersSeason(t, [], 700);
    expect(t.a2.societyAdjust).toBeCloseTo(6 + societyShare(t), 3);
    expect(t.a2.societyAdjust).toBeGreaterThan(5);
    t.dilemmas.adjust = 60;
    layersSeason(t, [], 701);
    expect(t.a2.societyAdjust).toBeCloseTo(10 + societyShare(t), 3);
  });
  it('has Act 1 choices answerable in the turning point too, and saves them', () => {
    const s = createGame('coal-coast');
    s.year = 1900;
    offerAct1(s);
    expect(s.dilemmas.pending).toEqual(['a1-outfall']);
    const r = applyAction(s, { type: 'choose', dilemmaId: 'a1-outfall', optionId: 'tank' });
    expect(r.result.ok).toBe(true);
    expect(r.state.phase).toBe('act1');
    const tp = { ...s, phase: 'turning-point' as const, status: 'act1-complete' as const };
    expect(applyAction(tp, { type: 'choose', dilemmaId: 'a1-outfall', optionId: 'tank' }).result.ok).toBe(true);
    const over = { ...s, phase: 'epilogue' as const };
    expect(applyAction(over, { type: 'choose', dilemmaId: 'a1-outfall', optionId: 'tank' }).result.code).toBe('game-over');
  });
});
