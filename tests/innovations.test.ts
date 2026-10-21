import { describe, expect, it } from 'vitest';
import {
  advanceDecade, applyAction, buildReportCard, createGame, deserialize, getDilemma, innovationsAdopted, INNOVATION_CARDS, offerInnovations,
  renderText, serialize, storyVars, TileKind, wordCount,
} from '../src/sim';
import type { GameState, ScenarioId } from '../src/sim';
import { INNOVATION_LIMITS } from '../src/content/innovations';
import { cityThoughtful } from './helpers/city';
import { coalThoughtful } from './helpers/fullplay';
import { redThoughtful } from './helpers/outback';
import { reefThoughtful } from './helpers/reef';
import { riverThoughtful } from './helpers/river';
import { WP9_POLICY } from './helpers/scen';
import { EVENT_SEEDS } from './helpers/seeds';
import { act2Sandbox } from './helpers/fixtures';

const air = (s: GameState): number => s.grid.airPollution.reduce((a, b) => a + b, 0);
const water = (s: GameState): number => s.grid.waterPollution.reduce((a, b) => a + b, 0);

describe('the innovation timeline (content)', () => {
  it('has the eight real innovations in date order, each with three options, one backed by the evidence', () => {
    expect(INNOVATION_CARDS.map((c) => c.id).sort()).toEqual([
      'inn-basix', 'inn-clean-air', 'inn-container', 'inn-outfall', 'inn-ozone', 'inn-recycling', 'inn-solar-bonus', 'inn-unleaded',
    ]);
    for (const c of INNOVATION_CARDS) {
      expect(c.phase).toBe('act1');
      expect(c.options, c.id).toHaveLength(3);
      expect(c.options.filter((o) => o.evidenceBacked), c.id).toHaveLength(1);
      // The last option is always "do nothing": it costs and changes nothing.
      expect(c.options[2]?.effects, c.id).toEqual({});
    }
  });
  it('is short, plain and sourced, with the Clean Air Act in 1961 and a success story for the ozone layer', () => {
    const vars = storyVars(createGame('river-town'));
    for (const c of INNOVATION_CARDS) {
      expect(wordCount(renderText(c.setup, vars)), `${c.id} setup`).toBeLessThanOrEqual(75);
      expect(wordCount(c.evidence), `${c.id} evidence`).toBeGreaterThanOrEqual(30);
      expect(wordCount(c.evidence), `${c.id} evidence`).toBeLessThanOrEqual(90);
      expect(wordCount(c.title)).toBeLessThanOrEqual(7);
      for (const o of c.options) {
        expect(wordCount(o.label), `${c.id}/${o.id}`).toBeLessThanOrEqual(16);
        expect(wordCount(o.outcome), `${c.id}/${o.id}`).toBeLessThanOrEqual(50);
        expect(o.preview.helps.length).toBeGreaterThanOrEqual(1);
        expect(o.preview.hurts.length).toBeGreaterThanOrEqual(1);
        expect(`${o.label} ${o.outcome}`, `${c.id}/${o.id}`).not.toMatch(/\b(color|neighbor|favorite|realize|organize)\b/i);
      }
    }
    const get = (id: string): string => INNOVATION_CARDS.find((c) => c.id === id)?.evidence ?? '';
    expect(get('inn-clean-air')).toMatch(/1961/);
    expect(get('inn-clean-air')).toMatch(/1970/);
    expect(get('inn-ozone')).toMatch(/Montreal Protocol/);
    expect(get('inn-ozone')).toMatch(/success/);
    expect(get('inn-outfall')).toMatch(/moving the problem offshore/);
    expect(get('inn-container')).toMatch(/2017/);
    expect(get('inn-basix')).toMatch(/2004/);
    expect(get('inn-solar-bonus')).toMatch(/2010/);
  });
  it('finds each card through getDilemma, so the card, the evidence button and a choice all work', () => {
    for (const c of INNOVATION_CARDS) expect(getDilemma('river-town', c.id)).toBe(c);
  });
});

describe('the innovation scheduler', () => {
  /** Plays Act 1 doing nothing but pressing Next decade, answering nothing, and returns the years each card was offered. */
  function offers(id: ScenarioId): Record<string, number> {
    let s = createGame(id);
    while (s.phase === 'act1' && s.status === 'playing') s = advanceDecade(s).state;
    return Object.fromEntries(Object.entries(s.dilemmas.offered).filter(([k]) => k.startsWith('inn-')));
  }
  it('puts each innovation on the table at a decade turn inside its real window, earliest first', () => {
    const o = offers('river-town');
    expect(Object.keys(o).length).toBe(5);
    for (const [id, y] of Object.entries(o)) {
      const c = INNOVATION_CARDS.find((x) => x.id === id);
      expect(y % 10).toBe(0);
      expect(y).toBeGreaterThanOrEqual(c?.years[0] ?? 0);
      expect(y).toBeLessThanOrEqual(c?.years[1] ?? 0);
    }
    expect(o['inn-clean-air']).toBe(1970);
    const perYear = new Map<number, number>();
    for (const y of Object.values(o)) perYear.set(y, (perYear.get(y) ?? 0) + 1);
    for (const n of perYear.values()) expect(n).toBeLessThanOrEqual(2);
  });
  it('is the same on every scenario with an Act 1 (years matched to each span), and a taste of one card in Green Valley', () => {
    for (const id of ['coal-coast', 'river-town', 'reef-island', 'red-dirt'] as const) expect(Object.keys(offers(id)).length, id).toBe(5);
    expect(offers('green-valley')).toEqual({ 'inn-ozone': 1990 });
    expect(INNOVATION_LIMITS['green-valley']?.cap).toBe(1);
  });
  it('does nothing in Net Zero City (no Act 1) and in Act 2, and lets unanswered cards lapse without a penalty', () => {
    const city = createGame('net-zero-city');
    offerInnovations(city);
    expect(city.dilemmas.pending).toEqual([]);
    let s = createGame('river-town');
    s = advanceDecade(s).state;
    while (s.year < 1970) s = advanceDecade(s).state;
    expect(s.dilemmas.pending).toContain('inn-clean-air');
    const adjust = s.dilemmas.adjust;
    s = advanceDecade(s).state;
    expect(s.dilemmas.pending).not.toContain('inn-clean-air');
    expect(s.dilemmas.decisions.filter((d) => d.dilemmaId.startsWith('inn-'))).toHaveLength(0);
    expect(s.dilemmas.adjust).toBe(adjust);
  });
  it('does not use up the regular card slots or their 20-year gap', () => {
    let s = createGame('coal-coast');
    const regular: number[] = [];
    while (s.phase === 'act1' && s.status === 'playing') {
      for (const id of s.dilemmas.pending.slice()) s = applyAction(s, { type: 'choose', dilemmaId: id, optionId: getDilemma(s.scenarioId, id)?.options[2]?.id ?? '' }).state;
      s = advanceDecade(s).state;
    }
    for (const [id, y] of Object.entries(s.dilemmas.offered)) if (!id.startsWith('inn-')) regular.push(y);
    regular.sort((a, b) => a - b);
    for (let i = 1; i < regular.length; i++) expect((regular[i] ?? 0) - (regular[i - 1] ?? 0)).toBeGreaterThanOrEqual(20);
  });
});

describe('the innovations change the town a little, deterministically', () => {
  function adopt(id: string, option: string, year: number): { before: GameState; after: GameState } {
    const s = createGame('river-town');
    s.year = year;
    s.budget = 500;
    // Some pollution to clean.
    s.grid.airPollution.fill(0.5);
    s.grid.waterPollution.fill(0.5);
    s.dilemmas.pending.push(id);
    s.dilemmas.offered[id] = year;
    const r = applyAction(s, { type: 'choose', dilemmaId: id, optionId: option });
    expect(r.result.ok, r.result.reason).toBe(true);
    return { before: s, after: r.state };
  }
  it('clean air laws cost money and cut air and river pollution; the minimum cuts less', () => {
    const full = adopt('inn-clean-air', 'follow', 1970), min = adopt('inn-clean-air', 'minimum', 1970), none = adopt('inn-clean-air', 'wait', 1970);
    expect(full.after.budget).toBeLessThan(full.before.budget);
    expect(air(full.after)).toBeLessThan(air(min.after));
    expect(air(min.after)).toBeLessThan(air(none.after));
    expect(none.after.budget).toBe(none.before.budget);
    expect(water(full.after)).toBeLessThan(water(none.after));
  });
  it('the CFC phase-out cuts CO2 (CFCs are greenhouse gases) and sets up the ozone note', () => {
    const a = adopt('inn-ozone', 'phase-out', 1990);
    expect(a.after.flags['innov.ozone']).toBe(1);
    expect(a.after.pendingLandKt).toBe(Math.max(0, a.before.pendingLandKt - 6));
    expect(a.after.dilemmas.decisions[0]?.evidenceBacked).toBe(true);
    expect(innovationsAdopted(a.after)).toEqual(['inn-ozone']);
    const none = adopt('inn-ozone', 'delay', 1990);
    expect(innovationsAdopted(none.after)).toEqual([]);
  });
  it('shows an ozone good-news note one decade after the CFC phase-out was chosen', () => {
    let s = createGame('river-town');
    while (s.year < 1990) s = advanceDecade(s).state;
    expect(s.dilemmas.pending).toContain('inn-ozone');
    s = applyAction(s, { type: 'choose', dilemmaId: 'inn-ozone', optionId: 'phase-out' }).state;
    s = advanceDecade(s).state;
    const note = s.eventLog.find((e) => /Ozone news/.test(e.text));
    expect(note).toBeDefined();
    expect(note?.story?.tone).toBe('joy');
    expect(s.flags['innov.ozoneNote']).toBe(1);
  });
  it('the sewage plant beats the outfall for the creek, and the outfall mostly helps the beach (the critique)', () => {
    const plant = adopt('inn-outfall', 'treat', 1990), pipe = adopt('inn-outfall', 'outfall', 1990);
    expect(water(plant.after)).toBeLessThan(water(pipe.after));
    expect(plant.after.budget).toBeLessThan(pipe.after.budget);
    expect(getDilemma('river-town', 'inn-outfall')?.evidence).toMatch(/moving the problem offshore/);
  });
  it('the generous solar payment cuts more CO2 and costs more than the modest one', () => {
    const g = adopt('inn-solar-bonus', 'generous', 2010), m = adopt('inn-solar-bonus', 'modest', 2010);
    expect(g.after.budget).toBeLessThan(m.after.budget);
    expect(g.after.pendingLandKt).toBeLessThanOrEqual(m.after.pendingLandKt);
    expect(m.after.dilemmas.decisions[0]?.evidenceBacked).toBe(true);
  });
  it('keeps old saves loading (no innovation state needed) and survives a save mid-timeline', () => {
    let s = createGame('river-town');
    while (s.year < 1990) s = advanceDecade(s).state;
    const back = deserialize(serialize(s));
    expect(back).not.toBeNull();
    expect((back as GameState).dilemmas.pending).toEqual(s.dilemmas.pending);
    expect(getDilemma('river-town', (back as GameState).dilemmas.pending[0] ?? '')).toBeDefined();
    const sb = act2Sandbox(TileKind.Land, { scenario: 'river-town' });
    expect(innovationsAdopted(sb)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Balance: the thoughtful scripted towns adopt every innovation offered (the ones that cost money) and still win, and the
// ones that accept the data centre "with conditions" do too.
// ---------------------------------------------------------------------------------------------------------------------
describe('thoughtful players who adopt every innovation still win', () => {
  WP9_POLICY.innovations = 'adopt';
  WP9_POLICY.datacentre = 'conditions';
  const won = (s: GameState): boolean => buildReportCard(s).goalMet;
  it('River Town, on every event seed, with the data centre accepted on conditions', () => {
    for (const seed of EVENT_SEEDS) {
      const r = riverThoughtful(seed);
      expect(innovationsAdopted(r.act1).length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      expect(won(r.end), `river seed ${seed}`).toBe(true);
    }
  });
  it('Coal Coast, on every event seed', () => {
    for (const seed of EVENT_SEEDS) expect(won(coalThoughtful(seed).end), `coal seed ${seed}`).toBe(true);
  });
  it('Reef Island, on every event seed', () => {
    for (const seed of EVENT_SEEDS) expect(won(reefThoughtful(seed).end), `reef seed ${seed}`).toBe(true);
  });
  it('Red Dirt and Net Zero City, accepting the data centre on conditions', () => {
    const red = redThoughtful();
    expect(innovationsAdopted(red.act1).length).toBeGreaterThanOrEqual(3);
    expect(won(red.end)).toBe(true);
    expect(red.end.buildings.some((b) => b.type === 'datacentre')).toBe(true);
    const city = cityThoughtful();
    expect(won(city)).toBe(true);
    expect(city.buildings.some((b) => b.type === 'datacentre')).toBe(true);
  });
});
