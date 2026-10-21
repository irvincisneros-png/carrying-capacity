import { describe, expect, it } from 'vitest';
import {
  buildReportCard, CAST, createGame, deserialize, getScenario, objectiveStatus, serialize, speciesFor, startAct2, tick, wordCount,
} from '../src/sim';
import type { GameState, ScenarioId } from '../src/sim';
import { CITY_BOT, cityIdle, cityThoughtful } from './helpers/city';
import { estimatePlayTime, margins } from './helpers/playtime';
import { redAct1Thoughtful, redIdle, redThoughtful } from './helpers/outback';
import { reefAct1Thoughtful, reefIdle, reefThoughtful } from './helpers/reef';
import { riverAct1Thoughtful, riverIdle, riverThoughtful } from './helpers/river';
import { followTutorial, valleyIdle } from './helpers/valley';

/**
 * Whole-game scripted runs on every scenario after Coal Coast. For each one:
 *  - "thoughtful": a careful player (answers every story question and card with the evidence, asks before building,
 *    cleans up, restores, and uses the scenario's own levers). Reaches at least the first star.
 *  - "idle": builds the dirty town and walks away. Misses the goal.
 * Numbers are for the fixed seed of each scenario. Margins and play time are reported in the final summary.
 */
const status = (s: GameState): Record<string, string> => Object.fromEntries(objectiveStatus(s).map((o) => [o.id, o.status]));
const value = (s: GameState, id: string): number => objectiveStatus(s).find((o) => o.id === id)?.current ?? NaN;
const beatsFired = (s: GameState, id: string): number =>
  (CAST[s.scenarioId]?.find((r) => r.id === id)?.beats ?? []).filter((b) => s.residents.fired[b.id] !== undefined).length;

function commonChecks(id: ScenarioId, t: GameState, idle: GameState): void {
  const sc = getScenario(id);
  describe(`${sc.name}: both runs reach their ending`, () => {
    it('plays through to the end of Act 2 (thoughtful) or ends in a failed town or an epilogue (idle)', () => {
      expect(t.phase).toBe('epilogue');
      expect(t.year).toBe(sc.act2.endYear);
      expect(t.a2.outcome?.pendingRequired).toEqual([]);
      expect(['epilogue', 'failed']).toContain(idle.phase);
    });
    it('gives every resident 3 to 6 beats along a thoughtful run, in short readable lines', () => {
      for (const r of CAST[id] ?? []) {
        const n = beatsFired(t, r.id);
        expect(n, `${r.id}: ${n} beats`).toBeGreaterThanOrEqual(3);
        expect(n, `${r.id}: ${n} beats`).toBeLessThanOrEqual(6);
      }
      for (const e of t.eventLog.filter((x) => x.story?.channel === 'resident')) expect(wordCount(e.text), e.story?.ref).toBeLessThanOrEqual(60);
      for (const e of t.eventLog.filter((x) => x.story?.channel === 'country')) expect(e.story?.needsConsultation).toBe(true);
    });
    it('answers every dilemma card that is offered, sees them across the whole of Act 2, and the idle player lets them lapse', () => {
      expect(t.dilemmas.decisions.filter((d) => d.optionId === 'ignored')).toHaveLength(0);
      expect(t.dilemmas.decisions.filter((d) => d.evidenceBacked).length).toBeGreaterThanOrEqual(id === 'green-valley' ? 2 : 5);
      expect(idle.dilemmas.decisions.filter((d) => d.optionId !== 'ignored')).toHaveLength(0);
      if (id !== 'green-valley') {
        const start = sc.act2.startYear;
        const decades = new Set(t.dilemmas.decisions.filter((d) => d.year >= start).map((d) => Math.floor((d.year - start) / 10)));
        for (let w = 0; w < 7; w++) expect(decades.has(w), `a card in the decade from ${start + w * 10}`).toBe(true);
      }
    });
    it('survives a save and load of the finished game, the report card included', () => {
      const back = deserialize(serialize(t));
      expect(back).not.toBeNull();
      expect(serialize(back as GameState)).toBe(serialize(t));
      expect(buildReportCard(back as GameState).stars).toBe(buildReportCard(t).stars);
    });
    it('estimates a main-scenario game at roughly an hour to two hours of real play', () => {
      const pt = estimatePlayTime(t);
      const [lo, hi] = sc.playMinutes ?? [0, 0];
      expect(pt.minutes, `${Math.round(pt.minutes)} minutes`).toBeGreaterThanOrEqual(Math.max(60, lo - 8));
      expect(pt.minutes, `${Math.round(pt.minutes)} minutes`).toBeLessThanOrEqual(Math.min(120, hi + 8));
      expect(pt.decisions).toBeGreaterThanOrEqual(15);
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// River Town
// ---------------------------------------------------------------------------------------------------------------------
const river = riverThoughtful().end;
const riverBad = riverIdle().end;

describe('River Town: a thoughtful run shares the river', () => {
  const rc = buildReportCard(river);
  it('meets every goal: a healthy river, no failed taps after 2040, farms that still pay', () => {
    expect(status(river)).toMatchObject({ river: 'met', taps: 'met', farms: 'met' });
    expect(value(river, 'river')).toBeGreaterThanOrEqual(60);
    // Re-banded from 80: the thoughtful player now adds a third stormwater wetland (the road network leaves it less room to spread out,
    // and the weak seed 47 needs it to win), which lifts the 10-year river mean from about 78 to 80.
    expect(value(river, 'river')).toBeLessThan(85);
    expect(value(river, 'taps')).toBe(0);
    expect(value(river, 'farms')).toBeGreaterThanOrEqual(50);
    expect(river.a2.outcome?.success).toBe(true);
    expect(rc.goalMet).toBe(true);
  });
  it('earns the platypus bonus star as well', () => {
    expect(status(river).platypus).toBe('met');
    expect(river.wildlife.species.platypus?.pop).toBeGreaterThanOrEqual(5);
    expect(rc.stars).toBeGreaterThanOrEqual(2);
  });
  it('brings back the cod, the parrots and the frogs, with the weir passable', () => {
    expect(river.wildlife.species['murray-cod']?.pop ?? 0).toBeGreaterThanOrEqual(1);
    expect(river.wildlife.species['superb-parrot']?.pop ?? 0).toBeGreaterThan(20);
    expect(river.wildlife.species['southern-bell-frog']?.pop ?? 0).toBeGreaterThan(20);
    expect(river.buildings.some((b) => b.type === 'fishway')).toBe(true);
    expect(river.flags['w.townFail'] ?? 0).toBe(0);
  });
  it('lifts most of the cast: Kerry\'s farm survives, Uncle Ray is listened to, Marg\'s cod are back', () => {
    const good = rc.residents.filter((r) => r.quality === 'good').map((r) => r.id);
    expect(good.length).toBeGreaterThanOrEqual(4);
    expect(good).toEqual(expect.arrayContaining(['uncle-ray', 'lan-nguyen']));
    expect(river.country.partnership).toBeGreaterThan(40);
  });
});
describe('River Town: doing nothing', () => {
  const rc = buildReportCard(riverBad);
  it('misses the goal on all three counts and earns no stars', () => {
    expect(rc.stars).toBe(0);
    expect(status(riverBad)).toMatchObject({ river: 'missed', taps: 'missed', farms: 'missed', platypus: 'missed' });
    expect(value(riverBad, 'river')).toBeLessThan(45);
    expect(value(riverBad, 'taps')).toBeGreaterThan(10);
    // Re-banded from 40 (round 6, 64x64 map): the idle farms sit on a river with more room, so the yield and salt are a little kinder.
    expect(value(riverBad, 'farms')).toBeLessThan(45);
  });
  it('leaves the river sick and the people unhappy, with the animals gone', () => {
    expect(value(riverBad, 'river')).toBeLessThan(value(river, 'river') - 25);
    // Re-banded from 5 (round 6): Kerry's orchard (farm viability 35 or more) and Ray (partnership 20 or more) end 'mixed' as before.
    expect(rc.residents.filter((r) => r.quality === 'bad').length).toBeGreaterThanOrEqual(4);
    expect(riverBad.wildlife.species.platypus?.pop ?? 0).toBe(0);
    expect(riverBad.wildlife.species['murray-cod']?.pop ?? 0).toBe(0);
    expect(riverBad.flags['w.blooms'] as number).toBeGreaterThan(1.3 * (river.flags['w.blooms'] as number));
    expect(riverBad.meters.society).toBeLessThan(river.meters.society - 25);
  });
});
commonChecks('river-town', river, riverBad);

// ---------------------------------------------------------------------------------------------------------------------
// Reef Island
// ---------------------------------------------------------------------------------------------------------------------
const reef = reefThoughtful().end;
const reefBad = reefIdle().end;

describe('Reef Island: a thoughtful run keeps the reef, the homes and the visitors', () => {
  const rc = buildReportCard(reef);
  it('meets every goal by 2100', () => {
    expect(status(reef)).toMatchObject({ reef: 'met', homes: 'met', tourism: 'met' });
    expect(value(reef, 'reef')).toBeGreaterThanOrEqual(50);
    expect(value(reef, 'reef')).toBeLessThan(70);
    expect(value(reef, 'homes')).toBe(0);
    expect(value(reef, 'tourism')).toBeGreaterThanOrEqual(55);
    expect(reef.a2.outcome?.success).toBe(true);
  });
  it('earns the bonus star with Big Tilly nesting every summer for years', () => {
    expect(status(reef).turtles).toBe('met');
    expect(reef.wildlife.species['reef-turtle']?.nestStreak).toBeGreaterThanOrEqual(6);
    expect(rc.stars).toBeGreaterThanOrEqual(2);
  });
  it('lives through a sea that has risen and storms that came: surges happened, nobody lost a home', () => {
    expect(reef.eventLog.filter((e) => e.type === 'storm-surge').length).toBeGreaterThan(5);
    expect(reef.eventLog.filter((e) => e.type === 'marine-heatwave').length).toBeGreaterThan(5);
    expect(reef.flags['r.homesLost'] ?? 0).toBe(0);
    expect(reef.wildlife.species.dugong?.pop ?? 0).toBeGreaterThan(5);
  });
  it('uses the tools: the cull lever, coral nurseries, a seawall-free shore and a satellite warning', () => {
    expect(reef.flags['pol.cots.cull']).toBeGreaterThanOrEqual(1);
    expect(reef.buildings.filter((b) => b.type === 'coralnursery').length).toBeGreaterThanOrEqual(2);
    expect(reef.buildings.some((b) => b.type === 'seawall')).toBe(false);
    expect(reef.satellites.overlays.sst).toBe(true);
  });
});
describe('Reef Island: doing nothing', () => {
  const rc = buildReportCard(reefBad);
  it('loses the reef, the homes and the visitors, and the planet warms past what the island can take', () => {
    expect(rc.stars).toBe(0);
    expect(status(reefBad)).toMatchObject({ reef: 'missed', homes: 'missed', tourism: 'missed', turtles: 'missed' });
    expect(value(reefBad, 'reef')).toBeLessThan(20);
    expect(value(reefBad, 'homes')).toBeGreaterThanOrEqual(1);
    expect(reefBad.tempC).toBeGreaterThan(reef.tempC + 0.7);
    expect(reefBad.phase === 'failed' ? reefBad.a2.failure?.reason : 'warming-cap').toBe('warming-cap');
    expect(rc.residents.filter((r) => r.quality === 'bad').length).toBeGreaterThanOrEqual(5);
  });
});
commonChecks('reef-island', reef, reefBad);

// ---------------------------------------------------------------------------------------------------------------------
// Red Dirt
// ---------------------------------------------------------------------------------------------------------------------
const red = redThoughtful().end;
const redBad = redIdle().end;

describe('Red Dirt: a thoughtful run goes solar, saves the water and gives the pit back', () => {
  const rc = buildReportCard(red);
  it('meets every goal: net zero by 2060, the mine site signed off, the aquifer and the taps safe', () => {
    expect(status(red)).toMatchObject({ netzero: 'met', rehab: 'met', water: 'met', taps: 'met' });
    expect(value(red, 'netzero')).toBeLessThanOrEqual(2060);
    expect(value(red, 'netzero')).toBeGreaterThan(2030);
    expect(value(red, 'rehab')).toBe(100);
    expect(value(red, 'water')).toBeGreaterThanOrEqual(40);
    expect(value(red, 'taps')).toBe(0);
    expect(red.a2.outcome?.success).toBe(true);
  });
  it('earns the bonus star with a 100% renewable grid', () => {
    expect(status(red).renewable).toBe('met');
    expect(red.a2.lastGrid?.renewableShare ?? 0).toBeGreaterThan(0.995);
    expect(rc.stars).toBeGreaterThanOrEqual(2);
  });
  it('rehabilitates with the Traditional Owners: trust built first, all three stages taken, everything signed off', () => {
    expect(red.country.partnership).toBeGreaterThanOrEqual(45);
    expect(red.residents.actions['rehab.0']).toBeGreaterThanOrEqual(2);
    expect(red.residents.actions['rehab.2']).toBeGreaterThanOrEqual(2);
    expect(Array.from(red.grid.zone).filter((z) => z === 250).length).toBeGreaterThanOrEqual(50);
    expect(red.buildings.filter((b) => b.type === 'coalmine')).toHaveLength(0);
    expect(red.flags['o.bond']).toBeGreaterThan(100);
  });
  it('brings back bilbies and keeps the lights on through hard summers', () => {
    expect(red.wildlife.species.bilby?.pop ?? 0).toBeGreaterThan(5);
    expect(red.eventLog.filter((e) => e.type === 'heatwave').length).toBeGreaterThan(15);
    expect(red.flags['h.deaths'] ?? 0).toBeLessThan(5);
    // Re-banded from 3 (round 6, 64x64 map): the panels and batteries must stand well clear of the bigger mine site, further from the town.
    expect(red.a2.yearly.filter((y) => y.year > 2030 && y.unmetFrac > 0.03).length).toBeLessThanOrEqual(4);
  });
});
describe('Red Dirt: doing nothing', () => {
  const rc = buildReportCard(redBad);
  it('misses everything: emissions stay high, the pit stays open, the bores run dry, the taps fail', () => {
    expect(rc.stars).toBe(0);
    expect(status(redBad)).toMatchObject({ netzero: 'missed', rehab: 'missed', water: 'missed', taps: 'missed', renewable: 'missed' });
    expect(value(redBad, 'netzero')).toBe(9999);
    expect(value(redBad, 'rehab')).toBe(0);
    expect(value(redBad, 'water')).toBeLessThan(10);
    expect(value(redBad, 'taps')).toBeGreaterThan(100);
    expect(redBad.a2.yearly.at(-1)?.totalKt ?? 0).toBeGreaterThan(40);
    expect(redBad.wildlife.species.bilby?.pop ?? 0).toBe(0);
    // Re-banded from 5 (round 6): one more resident's story ends 'mixed' on the roomier map.
    expect(rc.residents.filter((r) => r.quality === 'bad').length).toBeGreaterThanOrEqual(4);
  });
});
commonChecks('red-dirt', red, redBad);

// ---------------------------------------------------------------------------------------------------------------------
// Net Zero City
// ---------------------------------------------------------------------------------------------------------------------
const city = cityThoughtful();
const cityBad = cityIdle();

describe('Net Zero City: a thoughtful run gets to net zero by 2050 without leaving anyone behind', () => {
  const rc = buildReportCard(city);
  it('meets every goal: net zero by 2050, Society 60 every single year, few heat deaths', () => {
    expect(status(city)).toMatchObject({ netzero: 'met', society: 'met', heat: 'met' });
    expect(value(city, 'netzero')).toBeLessThanOrEqual(2050);
    expect(value(city, 'netzero')).toBeGreaterThanOrEqual(2040);
    expect(value(city, 'society')).toBeGreaterThanOrEqual(60);
    expect(Math.min(...city.a2.yearly.map((y) => y.meters.society))).toBeGreaterThanOrEqual(60);
    expect(value(city, 'heat')).toBeLessThanOrEqual(20);
    expect(city.a2.outcome?.success).toBe(true);
    expect(rc.stars).toBeGreaterThanOrEqual(1);
  });
  it('gets there by closing coal, repurposing the factories and shading the streets, never by landfill', () => {
    expect(city.buildings.filter((b) => b.type === 'coalpower')).toHaveLength(0);
    expect(city.buildings.filter((b) => b.type === 'factory')).toHaveLength(0);
    expect(city.buildings.filter((b) => b.type === 'recycler').length).toBeGreaterThan(8);
    expect(city.circular.items.filter((i) => i.status === 'landfilled')).toHaveLength(0);
    expect((city.a2.lastGrid?.renewableShare ?? 0)).toBeGreaterThan(0.8);
    expect(city.residents.actions['built.parkland']).toBeGreaterThanOrEqual(8);
    expect(city.flags['h.avoided'] as number).toBeGreaterThan(city.flags['h.deaths'] as number);
  });
  it('can also earn the under-budget bonus by being frugal (a different, leaner plan)', () => {
    Object.assign(CITY_BOT, { parks: 12, batteries: 10, rooftops: 110, transit: 4, retrofitPerYear: 2 });
    try {
      const lean = cityThoughtful();
      const lc = buildReportCard(lean);
      expect(status(lean).budget).toBe('met');
      expect(lc.goalMet && lc.bonusMet).toBe(true);
      expect(lc.stars).toBeGreaterThanOrEqual(2);
      expect(lean.flags['c.spent'] as number).toBeLessThanOrEqual(2500);
      expect(city.flags['c.spent'] as number).toBeGreaterThan(lean.flags['c.spent'] as number);
    } finally {
      Object.assign(CITY_BOT, { parks: 24, batteries: 16, rooftops: 130, transit: 6, retrofitPerYear: 3 });
    }
  });
});
describe('Net Zero City: doing nothing', () => {
  const rc = buildReportCard(cityBad);
  it('stays on coal, loses people to heat, and misses every goal', () => {
    expect(rc.stars).toBe(0);
    expect(status(cityBad)).toMatchObject({ netzero: 'missed', society: 'missed', heat: 'missed' });
    expect(cityBad.a2.yearly.at(-1)?.totalKt ?? 0).toBeGreaterThan(150);
    expect(value(cityBad, 'heat')).toBeGreaterThan(20);
    expect(value(cityBad, 'society')).toBeLessThan(55);
    expect(cityBad.tempC).toBeGreaterThan(city.tempC + 0.3);
    expect(rc.residents.filter((r) => r.quality === 'bad').length).toBeGreaterThanOrEqual(3);
  });
});
commonChecks('net-zero-city', city, cityBad);

// ---------------------------------------------------------------------------------------------------------------------
// Green Valley (tutorial)
// ---------------------------------------------------------------------------------------------------------------------
const valley = followTutorial().end;
const valleyBad = valleyIdle();

describe('Green Valley: the tutorial is a short, friendly game', () => {
  const rc = buildReportCard(valley);
  it('is a 1960 to 2020 Act 1 and a 2025 to 2040 Act 2', () => {
    const sc = getScenario('green-valley');
    expect([sc.startYear, sc.endYear, sc.act2.startYear, sc.act2.endYear]).toEqual([1960, 2020, 2025, 2040]);
    expect(valley.year).toBe(2040);
    expect(valley.history).toHaveLength(7);
  });
  it('earns a star by following the steps, and walking away earns nothing', () => {
    expect(rc.goalMet).toBe(true);
    expect(rc.stars).toBeGreaterThanOrEqual(1);
    expect(buildReportCard(valleyBad).stars).toBe(0);
    expect(status(valleyBad)).toMatchObject({ energy: 'missed', return: 'missed', recycle: 'missed' });
  });
  it('has two residents, eight cards (six in the boom), and two species', () => {
    expect((CAST['green-valley'] ?? []).map((r) => r.id)).toEqual(['jo-marsh', 'ali-rahman']);
    expect(valley.dilemmas.decisions.filter((d) => d.optionId !== 'ignored')).toHaveLength(8);
    expect(speciesFor('green-valley').map((x) => x.id)).toEqual(['koala', 'frogs']);
    for (const r of CAST['green-valley'] ?? []) expect(beatsFired(valley, r.id)).toBeGreaterThanOrEqual(3);
  });
  it('takes about half an hour', () => {
    const pt = estimatePlayTime(valley);
    // Re-banded 22-36 -> 24-38 (Round 6 WP5): Act 1 now has six cards instead of one, about five more minutes at 55 s a card,
    // so the card on the scenario-select screen says 28-38 minutes.
    expect(pt.minutes).toBeGreaterThanOrEqual(24);
    expect(pt.minutes).toBeLessThanOrEqual(38);
  });
  it('has no random hazards (only the scripted fire at the turning point)', () => {
    expect(valley.eventLog.filter((e) => e.type !== 'story')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Margins and the order of difficulty
// ---------------------------------------------------------------------------------------------------------------------
describe('margins of the thoughtful runs (the harder the scenario, the tighter the win)', () => {
  const m = (s: GameState, ids: string[]): number => Math.min(...margins(s).filter((x) => ids.includes(x.id)).map((x) => x.margin));
  const riverM = m(river, ['river', 'farms']);
  const reefM = m(reef, ['reef', 'tourism']);
  const redM = m(red, ['water', 'netzero']);
  const cityM = m(city, ['netzero', 'society']);
  it('every thoughtful win is a real win (positive margin) but never a landslide on the main goal', () => {
    for (const x of [riverM, reefM, redM, cityM]) { expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(0.45); }
  });
  it('the expert city is the tightest of all', () => {
    expect(cityM).toBeLessThan(0.1);
    expect(cityM).toBeLessThanOrEqual(Math.min(riverM, reefM, redM) + 0.01);
  });
  it('the hard scenarios have a tight goal too (Reef Island\'s band across seeds is in balance-seeds.test.ts)', () => {
    // Re-banded from 0.35: with a smaller, cheaper-to-reach Act 1 town the world ends 0.25 C cooler than before (1.4 C), so the reef
    // mean sits at about 68 against the goal of 50 (seed 11, the tight one, is still 51; see tests/balance-seeds.test.ts).
    expect(reefM).toBeLessThan(0.4);
    expect(margins(red).find((x) => x.id === 'water')?.margin).toBeLessThan(0.45);
  });
  it('Society, the one number that must not slip, is within reach in the city only by a few points', () => {
    // Round 3: storms and heatwaves drag city Society 10% less (stressWeight 0.9) so a UI player's storm years keep
    // a few points of slack; the scripted run's worst year rose from about 68 to 70.
    expect(value(city, 'society')).toBeLessThan(72);
  });
});

describe('a mid-run save and load changes nothing', () => {
  const starts: Record<string, () => GameState> = {
    'river-town': () => startAct2(riverAct1Thoughtful()),
    'reef-island': () => startAct2(reefAct1Thoughtful()),
    'red-dirt': () => startAct2(redAct1Thoughtful()),
    'net-zero-city': () => createGame('net-zero-city'),
  };
  it.each(Object.keys(starts))('%s', (id) => {
    const start = (starts[id] as () => GameState)();
    const a = tick(tick(start, 3).state, 4).state;
    const mid = deserialize(serialize(tick(start, 3).state));
    expect(mid).not.toBeNull();
    const b = tick(mid as GameState, 4).state;
    expect(serialize(b)).toBe(serialize(a));
  });
});
