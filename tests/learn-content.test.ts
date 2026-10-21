import { describe, expect, it } from 'vitest';
import { CAUSE_CHAINS, chainKeyFor, cloneState, createGame, DILEMMAS, ownCauses, RESEARCH_BY_ID, wordCount } from '../src/sim';
import type { ChainKey, EventType, SimEvent } from '../src/sim';
import { LOSS_WORDS } from '../src/content/causes';
import { GLOSSARY } from '../src/content/glossary';
import { HIDDEN_COSTS } from '../src/content/hiddencosts';
import { HOUSEHOLD_AREAS, HOUSEHOLD_INTRO } from '../src/content/household';
import { deriveWinLose, WIN_LOSE_AUTHORED, winLoseFor } from '../src/content/winlose';
import { GREEN_VALLEY_DILEMMAS } from '../src/content/dilemmas/green-valley';
import { assumeRoads } from '../src/sim/roads';
import { addBuilding } from './helpers/fixtures';

/** Content for the learning layer (WP8c to WP8e): cause chains, glossary, household page, who wins and loses, hidden costs. */
const AMERICAN = /\b(color|colors|fertilizer|neighbor|neighbors|center|centers|gray|organization|realize|recognize|analyze|meter\b(?! )|program\b)/i;
const text = (xs: readonly string[]): string => xs.join(' ');

describe('cause chains (WP8c)', () => {
  const required: ChainKey[] = ['fish-kill', 'algal-bloom', 'smog', 'species-loss', 'heat-deaths', 'coral-bleaching', 'flood', 'drought', 'erosion'];

  it('has one chain for each event type asked for, of three to five short boxes, with a fix', () => {
    for (const k of required) expect(CAUSE_CHAINS[k], k).toBeDefined();
    for (const c of Object.values(CAUSE_CHAINS)) {
      expect(c.boxes.length, c.key).toBeGreaterThanOrEqual(3);
      expect(c.boxes.length, c.key).toBeLessThanOrEqual(5);
      for (const b of c.boxes) expect(wordCount(b), `${c.key}: ${b}`).toBeLessThanOrEqual(22);
      expect(c.fix.length).toBeGreaterThan(30);
      expect(c.title).toMatch(/\?$/);
      expect(text([...c.boxes, c.fix, c.fact ?? ''])).not.toMatch(AMERICAN);
    }
  });

  it('opens the right chain for every kind of event, and for a lost species', () => {
    const ev = (type: EventType | 'story', extra: Partial<SimEvent> = {}): Pick<SimEvent, 'type' | 'text' | 'story'> => ({ type, text: 'x', ...extra });
    const want: Record<EventType, ChainKey> = {
      heatwave: 'heat-deaths', bushfire: 'bushfire', drought: 'drought', flood: 'flood', 'marine-heatwave': 'coral-bleaching', 'fish-kill': 'fish-kill',
      blackout: 'blackout', 'algal-bloom': 'algal-bloom', 'crown-of-thorns': 'crown-of-thorns', 'storm-surge': 'storm-surge',
    };
    for (const [type, key] of Object.entries(want)) expect(chainKeyFor(ev(type as EventType)), type).toBe(key);
    expect(chainKeyFor(ev('story', { story: { channel: 'wildlife', tone: 'loss' } }))).toBe('species-loss');
    expect(chainKeyFor({ type: 'story', text: 'The last koala is gone from the valley.', story: { channel: 'wildlife' } })).toBe('species-loss');
    expect(chainKeyFor(ev('story', { story: { channel: 'resident' } }))).toBeNull();
    expect(LOSS_WORDS.test('The platypus have disappeared')).toBe(true);
  });

  it('gives per-box lines about the player\'s own town, the same length as the chain, and points at their farms and outfalls', () => {
    for (const k of Object.keys(CAUSE_CHAINS) as ChainKey[]) expect(ownCauses(createGame('coal-coast'), k)).toHaveLength(CAUSE_CHAINS[k].boxes.length);
    // Roads matter: a building with no road does nothing, so mark the test town as joined up.
    const s = assumeRoads(cloneState(createGame('coal-coast')));
    addBuilding(s, 'farm', 20, 20);
    addBuilding(s, 'farm', 24, 20);
    addBuilding(s, 'outfall', 28, 20);
    const own = ownCauses(s, 'fish-kill');
    expect(own[0]).toMatch(/2 farms/);
    expect(own[0]).toMatch(/1 sewage outfall with no treatment plant/);
    const all = ownCauses(createGame('coal-coast'), 'erosion').concat(ownCauses(createGame('coal-coast'), 'smog'));
    expect(all.some((x) => x?.includes('percent'))).toBe(true);
  });
});

describe('field guide (WP8d)', () => {
  it('lists the terms the owner asked for, each with a short definition', () => {
    const ids = new Set(GLOSSARY.map((t) => t.id));
    for (const id of ['eutrophication', 'bioaccumulation', 'carbon-sink', 'succession', 'overshoot', 'renewable', 'biodiversity', 'salinity', 'leachate', 'carrying-capacity']) expect(ids.has(id), id).toBe(true);
    expect(ids.size).toBe(GLOSSARY.length);
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(25);
    for (const t of GLOSSARY) {
      expect(wordCount(t.def), t.id).toBeLessThanOrEqual(42);
      expect(() => new RegExp(`\\b(?:${t.match})\\b`, 'i')).not.toThrow();
      expect(new RegExp(`\\b(?:${t.match})\\b`, 'i').test(t.term.replace(/ \(.*\)/, '').replace('Macroinvertebrates', 'macroinvertebrates')), `${t.id} should match its own name`).toBe(true);
      expect(t.def).not.toMatch(AMERICAN);
    }
  });
});

describe('My household (WP8d)', () => {
  it('has the five areas, each with three things to try and a link back to the town', () => {
    expect(HOUSEHOLD_AREAS.map((a) => a.id)).toEqual(['transport', 'food', 'energy', 'water', 'waste']);
    const ids: string[] = [];
    for (const a of HOUSEHOLD_AREAS) {
      expect(a.ideas.length).toBeGreaterThanOrEqual(3);
      expect(a.ideas.length).toBeLessThanOrEqual(5);
      expect(a.link.length).toBeGreaterThan(40);
      ids.push(...a.ideas.map((i) => i.id));
      expect(text([a.link, a.why, ...a.ideas.map((i) => i.text)])).not.toMatch(AMERICAN);
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(HOUSEHOLD_INTRO)).toHaveLength(6);
  });
});

describe('who wins, who loses (WP8d)', () => {
  const all = (Object.entries(DILEMMAS) as [string, readonly (typeof GREEN_VALLEY_DILEMMAS)[number][]][]).flatMap(([, cards]) => cards);
  const name = (id: string): string => id.replace(/-/g, ' ');

  it('writes the Green Valley cards by hand, one entry for every option', () => {
    for (const c of GREEN_VALLEY_DILEMMAS) for (const o of c.options) expect(WIN_LOSE_AUTHORED[`${c.id}/${o.id}`], `${c.id}/${o.id}`).toBeDefined();
  });

  it('gives every option on every card a line for residents, animals and future generations, in plain words', () => {
    expect(all.length).toBeGreaterThan(80);
    for (const c of all) {
      for (const o of c.options) {
        const wl = winLoseFor(c.id, o, name);
        for (const [k, v] of Object.entries(wl)) {
          expect(v.length, `${c.id}/${o.id} ${k}`).toBeGreaterThan(15);
          expect(wordCount(v), `${c.id}/${o.id} ${k}: ${v}`).toBeLessThanOrEqual(70);
          expect(v).not.toMatch(AMERICAN);
        }
      }
    }
  });

  it('derives the lines from the option itself: a dirty-creek choice loses for animals, a clean-up wins', () => {
    const dirty = GREEN_VALLEY_DILEMMAS[0]!.options.find((o) => o.id === 'creek')!;
    const d = deriveWinLose(dirty, name);
    expect(d.animals).toMatch(/Loses/);
    expect(d.residents).toMatch(/Loses/);
    const pit = deriveWinLose(GREEN_VALLEY_DILEMMAS[0]!.options.find((o) => o.id === 'pit')!, name);
    expect(pit.animals).toMatch(/Wins/);
  });
});

describe('hidden costs of clean tech (WP8e)', () => {
  it('puts a balanced line on the solar, wind and battery cards, with sources and cautious wording', () => {
    for (const id of ['solarfarm', 'rooftopsolar', 'windfarm', 'offshorewind', 'battery'] as const) {
      const h = HIDDEN_COSTS[id];
      expect(h, id).toBeDefined();
      expect(wordCount(h!.short), id).toBeLessThanOrEqual(45);
      expect(h!.balance.length).toBeGreaterThan(30);
    }
    expect(HIDDEN_COSTS.solarfarm?.long).toMatch(/100,000 tonnes/);
    expect(HIDDEN_COSTS.solarfarm?.long).toMatch(/UNSW/);
    expect(HIDDEN_COSTS.battery?.long).toMatch(/2%/);
    expect(HIDDEN_COSTS.battery?.long).toMatch(/541 hectares/);
    expect(HIDDEN_COSTS.battery?.long).toMatch(/figures vary/);
    expect(HIDDEN_COSTS.windfarm?.long).toMatch(/rare earth/);
    expect(HIDDEN_COSTS.windfarm?.long).toMatch(/study/);
  });

  it('adds the hidden costs to the circular-economy research, as a critique that is not anti-renewable', () => {
    const r = RESEARCH_BY_ID['clean-tech-costs'];
    expect(r?.kind).toBe('critique');
    expect(r?.evidence).toMatch(/541 hectares/);
    expect(r?.evidence).toMatch(/100,000 tonnes/);
    expect(r?.evidence).toMatch(/2%/);
    expect(r?.evidence).toMatch(/not to avoid renewables/);
    expect(RESEARCH_BY_ID['battery-recycling']?.evidence).toMatch(/2% of lithium-ion battery waste/);
  });
});
