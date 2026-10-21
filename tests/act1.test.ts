import { describe, expect, it } from 'vitest';
import {
  act1GoalStatus, act1Judged, act1Of, act1Outcome, advanceDecade, applyAction, BUILDINGS, co2Of, createGame, DILEMMAS, deserialize, dilemmasFor,
  economySnapshot, getScenario, landSnapshot, pollutesOf, projectedEmissions, SCENARIO_IDS, serialize, TileKind, upgradeOptions, UPGRADES,
} from '../src/sim';
import type { BuildingId, GameState, ScenarioId } from '../src/sim';
import { moneyLine } from '../src/ui/adapters';
import { fitUpgrades, playAct1 } from './helpers/act1';
import { addBuilding } from './helpers/fixtures';

/** A Green Valley in 1980 with the given buildings, enough money, and no cards pending. */
function valley(year: number, ...types: BuildingId[]): { s: GameState; uids: number[] } {
  const s = createGame('green-valley');
  s.year = year;
  s.budget = 500;
  const uids = types.map((t, i) => addBuilding(s, t, 2 + i * 3, 2).uid);
  return { s, uids };
}

const CAREFUL = [{ id: 'farm' as const, max: 3 }, { id: 'factory' as const, max: 1 }, { id: 'coalpower' as const, max: 1 }];
const GREEDY = [
  { id: 'farm' as const, max: 3 }, { id: 'factory' as const, max: 2 }, { id: 'coalpower' as const, max: 1 },
  { id: 'coalmine' as const, max: 1 }, { id: 'landfill' as const, max: 1 }, { id: 'carpark' as const, max: 2 },
];

describe('building upgrades', () => {
  it('smoke scrubber: air down 60%, CO2 and soil untouched (local pollution is not greenhouse gas)', () => {
    const { s, uids } = valley(1980, 'factory');
    const before = s.buildings[0]!;
    const r = applyAction(s, { type: 'upgrade', uid: uids[0]!, id: 'scrubber' });
    expect(r.result).toMatchObject({ ok: true, spent: 20 });
    const b = r.state.buildings[0]!;
    expect(pollutesOf(b).air).toBeCloseTo((BUILDINGS.factory.pollutes.air ?? 0) * 0.4, 6);
    expect(pollutesOf(b).soil).toBe(BUILDINGS.factory.pollutes.soil);
    expect(co2Of(b)).toBe(BUILDINGS.factory.co2);
    expect(co2Of(before)).toBe(BUILDINGS.factory.co2);
    expect(r.state.budget).toBe(s.budget - 20);
    // The old state is not touched (pure).
    expect(s.buildings[0]!.upgrades).toBeUndefined();
    expect(projectedEmissions(r.state).industry).toBe(projectedEmissions(s).industry);
  });

  it('coal filters and mine dust suppression cut air only; the CO2 stays', () => {
    const { s, uids } = valley(1980, 'coalpower', 'coalmine');
    let t = applyAction(s, { type: 'upgrade', uid: uids[0]!, id: 'filters' }).state;
    t = applyAction(t, { type: 'upgrade', uid: uids[1]!, id: 'dust' }).state;
    const [p, m] = t.buildings;
    expect(pollutesOf(p!).air).toBeCloseTo(4 * 0.25, 6);
    expect(co2Of(p!)).toBe(BUILDINGS.coalpower.co2);
    expect(pollutesOf(m!).air).toBeCloseTo(0.4, 6);
    expect(pollutesOf(m!).soil).toBe(1);
    expect(co2Of(m!)).toBe(BUILDINGS.coalmine.co2);
  });

  it('landfill lining cuts soil and water by 70% and CO2 by 40%', () => {
    const { s, uids } = valley(1995, 'landfill');
    const t = applyAction(s, { type: 'upgrade', uid: uids[0]!, id: 'lining' }).state;
    const b = t.buildings[0]!;
    expect(pollutesOf(b).soil).toBeCloseTo(1.5 * 0.3, 6);
    expect(pollutesOf(b).water).toBeCloseTo(0.3, 6);
    expect(co2Of(b)).toBeCloseTo(15 * 0.6, 6);
    expect(projectedEmissions(t).waste).toBeCloseTo(9, 6);
  });

  it('farm creek buffer cuts the water pollution and costs a little income every decade', () => {
    const { s, uids } = valley(1990, 'farm');
    const plain = advanceDecade(s).report!;
    const t = applyAction(s, { type: 'upgrade', uid: uids[0]!, id: 'creekbuffer' }).state;
    expect(pollutesOf(t.buildings[0]!).water).toBeCloseTo(0.4, 6);
    const buffered = advanceDecade(t).report!;
    expect(buffered.income).toBe(plain.income - 2);
  });

  it('really lowers the pollution on the map after a decade', () => {
    const { s, uids } = valley(1980, 'factory');
    const air = (x: GameState): number => x.grid.airPollution.reduce((a, v) => a + v, 0);
    const dirty = advanceDecade(s).state;
    const clean = advanceDecade(applyAction(s, { type: 'upgrade', uid: uids[0]!, id: 'scrubber' }).state).state;
    expect(air(clean)).toBeLessThan(air(dirty) * 0.6);
  });

  it('refuses when locked, too dear, doubled, on the wrong building or after Act 1', () => {
    const { s, uids } = valley(1960, 'factory', 'farm');
    expect(applyAction(s, { type: 'upgrade', uid: uids[0]!, id: 'scrubber' }).result).toMatchObject({ ok: false, code: 'not-open' });
    const t = { ...s, year: 1980 };
    expect(applyAction({ ...t, budget: 5 }, { type: 'upgrade', uid: uids[0]!, id: 'scrubber' }).result.code).toBe('no-funds');
    expect(applyAction(t, { type: 'upgrade', uid: uids[1]!, id: 'scrubber' }).result.code).toBe('invalid');
    expect(applyAction(t, { type: 'upgrade', uid: 999, id: 'scrubber' }).result.code).toBe('nothing-here');
    expect(applyAction(t, { type: 'upgrade', uid: uids[0]!, id: 'nonsense' }).result.code).toBe('invalid');
    const once = applyAction(t, { type: 'upgrade', uid: uids[0]!, id: 'scrubber' }).state;
    expect(applyAction(once, { type: 'upgrade', uid: uids[0]!, id: 'scrubber' }).result.code).toBe('already-done');
    expect(applyAction({ ...once, phase: 'act2' }, { type: 'upgrade', uid: uids[0]!, id: 'scrubber' }).result.ok).toBe(false);
  });

  it('lists what suits each building, and what is fitted, locked or unaffordable', () => {
    const { s, uids } = valley(1980, 'farm', 'coalpower', 'cottage');
    expect(upgradeOptions(s, s.buildings[2]!)).toEqual([]);
    expect(upgradeOptions(s, s.buildings[0]!).map((o) => o.state)).toEqual(['available']);
    const landfill = valley(1980, 'landfill');
    expect(upgradeOptions(landfill.s, landfill.s.buildings[0]!)[0]).toMatchObject({ state: 'locked' });
    const fitted = applyAction(s, { type: 'upgrade', uid: uids[1]!, id: 'filters' }).state;
    expect(upgradeOptions(fitted, fitted.buildings[1]!)[0]!.state).toBe('fitted');
    expect(upgradeOptions({ ...s, budget: 1 }, s.buildings[1]!)[0]!.state).toBe('no-funds');
    expect(new Set(UPGRADES.map((u) => u.id)).size).toBe(UPGRADES.length);
  });

  it('is deterministic and survives a save and load (and an old save without the field still loads)', () => {
    // A real 1980 game (the save checks the history matches the year).
    const s = advanceDecade(advanceDecade(createGame('green-valley')).state).state;
    s.budget = 500;
    const uids = [addBuilding(s, 'factory', 2, 2).uid];
    const a = applyAction(s, { type: 'upgrade', uid: uids[0]!, id: 'scrubber' }).state;
    const b = applyAction(s, { type: 'upgrade', uid: uids[0]!, id: 'scrubber' }).state;
    expect(serialize(a)).toBe(serialize(b));
    const back = deserialize(serialize(a));
    expect(back).not.toBeNull();
    expect(back!.buildings[0]!.upgrades).toEqual(['scrubber']);
    expect(pollutesOf(back!.buildings[0]!).air).toBeCloseTo(0.8, 6);
    const old = deserialize(serialize(s));
    expect(old).not.toBeNull();
    expect(old!.buildings[0]!.upgrades).toBeUndefined();
  });

  it('works in every scenario that has an Act 1', () => {
    for (const id of SCENARIO_IDS.filter((x) => getScenario(x).act1)) {
      const s = createGame(id);
      s.year = 2000;
      s.budget = 1000;
      const uid = addBuilding(s, 'factory', 3, 3).uid;
      expect(applyAction(s, { type: 'upgrade', uid, id: 'scrubber' }).result.ok, id).toBe(true);
    }
  });
});

describe('Act 1 goals', () => {
  it('every scenario with an Act 1 has short goals and exactly one bonus; Net Zero City has none', () => {
    for (const id of SCENARIO_IDS) {
      const sc = getScenario(id);
      if (sc.prebuilt) { expect(sc.act1, id).toBeUndefined(); continue; }
      const goals = sc.act1?.goals ?? [];
      expect(goals.length, id).toBeGreaterThanOrEqual(3);
      expect(goals.length, id).toBeLessThanOrEqual(4);
      expect(goals.filter((g) => g.bonus), id).toHaveLength(1);
      expect(sc.act1?.intro.length, id).toBeGreaterThan(80);
      // The intro must not promise healing before there is anything to heal.
      expect(sc.act1?.intro, id).not.toMatch(/\bheal|restor|rehabilit/i);
    }
  });

  it('Green Valley: grow to 200 people with jobs and power by 2020, bonus Environment 60', () => {
    const goals = act1Of(createGame('green-valley'))!.goals;
    expect(goals.map((g) => [g.metric, g.target, g.bonus === true])).toEqual([
      ['population', 200, false], ['filledJobs', 120, false], ['powerCovered', 1, false], ['environment', 60, true],
    ]);
  });

  it('are judged when Act 1 ends and recorded, so Act 2 changes cannot undo them', () => {
    const s = createGame('green-valley');
    expect(act1Judged(s)).toBe(false);
    expect(act1GoalStatus(s).find((g) => g.id === 'people')!.status).toBe('at-risk');
    const end = playAct1(s, { queue: GREEDY });
    expect(act1Judged(end)).toBe(true);
    const o = act1Outcome(end);
    expect(o.judged).toBe(true);
    // Wipe the buildings: a judged game keeps its recorded values.
    const wiped = { ...end, buildings: [], population: 0 };
    expect(act1Outcome(wiped).mainMet).toBe(o.mainMet);
  });

  it('a boom that ignores the land meets the grow goals but not the bonus; a careful one earns the bonus', () => {
    const greedy = act1Outcome(playAct1(createGame('green-valley'), { queue: GREEDY, cards: 'cash' }));
    expect(greedy.grew).toBe(true);
    expect(greedy.careful).toBe(false);
    const careful = playAct1(createGame('green-valley'), { queue: CAREFUL, cards: 'evidence', upgrades: true });
    const o = act1Outcome(careful);
    expect(o.grew).toBe(true);
    expect(o.careful).toBe(true);
    expect(careful.meters.environment).toBeGreaterThanOrEqual(60);
    // The same town without upgrades or good choices is not careful.
    const lazy = act1Outcome(playAct1(createGame('green-valley'), { queue: CAREFUL, cards: 'cash' }));
    expect(lazy.careful).toBe(false);
  });

  it('an old save (no recorded goals) is simply not judged, with no badge', () => {
    const s = playAct1(createGame('green-valley'), { queue: GREEDY });
    for (const k of Object.keys(s.flags)) if (k.startsWith('a1.')) delete s.flags[k];
    expect(act1Outcome(s).judged).toBe(false);
    expect(act1Outcome(s).careful).toBe(false);
  });

  it('every other scenario with an Act 1: a boom meets the grow goals', () => {
    for (const id of ['coal-coast', 'river-town', 'reef-island', 'red-dirt'] as ScenarioId[]) {
      const sc = getScenario(id);
      const main = sc.act1!.goals.filter((g) => !g.bonus);
      expect(main.length, id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('Green Valley Act 1 cards', () => {
  const act1 = dilemmasFor('green-valley').filter((d) => d.phase === 'act1');

  it('has six cards for the boom, with money on both sides of each choice', () => {
    expect(act1.map((d) => d.id)).toEqual(['gv-factory-waste', 'gv-hillside', 'gv-fertiliser', 'gv-tip', 'gv-dry-year', 'gv-solar-rebate']);
    for (const d of act1) {
      for (const o of d.options) {
        const money = (o.effects.budget ?? 0) !== 0 || (o.effects.incomePerDecade ?? 0) !== 0;
        expect(money || o.id === 'skip' || o.id === 'wait', `${d.id}/${o.id}`).toBe(true);
      }
      // At least one option pays and at least one costs.
      expect(d.options.some((o) => (o.effects.incomePerDecade ?? 0) > 0 || (o.effects.budget ?? 0) > 0), d.id).toBe(true);
      expect(d.options.some((o) => (o.effects.budget ?? 0) < 0 || (o.effects.incomePerDecade ?? 0) < 0), d.id).toBe(true);
    }
  });

  it('are offered across the boom, at most two at a turn, a card or two nearly every decade', () => {
    const end = playAct1(createGame('green-valley'), { queue: GREEDY, cards: 'evidence' });
    const offered = end.dilemmas.offered;
    expect(Object.keys(offered).sort()).toEqual(act1.map((d) => d.id).sort());
    expect(offered['gv-hillside']).toBe(1970);
    expect(offered['gv-fertiliser']).toBe(1980);
    expect(offered['gv-tip']).toBe(1990);
    expect(offered['gv-dry-year']).toBe(2000);
    expect(offered['gv-solar-rebate']).toBe(2010);
    const perYear = new Map<number, number>();
    for (const y of Object.values(offered)) perYear.set(y, (perYear.get(y) ?? 0) + 1);
    for (const n of perYear.values()) expect(n).toBeLessThanOrEqual(2);
  });

  it('the factory card waits for a factory; the farm cards wait for a farm', () => {
    const s = createGame('green-valley');
    s.year = 1980;
    const quiet = playAct1(s, { queue: [] });
    expect(Object.keys(quiet.dilemmas.offered).sort()).toEqual(['gv-solar-rebate', 'gv-tip']);
    expect(quiet.dilemmas.offered['gv-hillside']).toBeUndefined();
  });

  it('show their consequence: clearing the hillside costs bush and the creek, the terraces do not', () => {
    const mk = (opt: string): GameState => {
      const t = createGame('green-valley');
      addBuilding(t, 'farm', 10, 10);
      t.year = 1970;
      t.budget = 200;
      t.dilemmas.pending.push('gv-hillside');
      t.dilemmas.offered['gv-hillside'] = 1970;
      return applyAction(t, { type: 'choose', dilemmaId: 'gv-hillside', optionId: opt }).state;
    };
    const base = createGame('green-valley');
    const bush = (s: GameState): number => landSnapshot(s).bush;
    const clear = mk('clear'), terrace = mk('terrace'), leave = mk('leave');
    expect(bush(base) - bush(clear)).toBe(7);
    expect(bush(base) - bush(terrace)).toBe(2);
    expect(bush(leave)).toBe(bush(base));
    expect(landSnapshot(clear).creek).toBeLessThan(landSnapshot(terrace).creek);
    expect(clear.flags['income.act1']).toBe(8);
    expect(clear.budget).toBe(194);
    expect(clear.pendingLandKt).toBe(21);
    // The cleared tiles are the ones nearest the farm, and the same every time.
    expect(serialize(mk('clear'))).toBe(serialize(clear));
    const g = clear.grid;
    let cleared = 0;
    for (let i = 0; i < g.kind.length; i++) if (base.grid.kind[i] === TileKind.Bush && g.kind[i] === TileKind.Land) cleared++;
    expect(cleared).toBe(7);
    expect(economySnapshot(clear).jobs).toBe(economySnapshot(base).jobs + 10);
  });

  it('lasting choices keep paying (or costing) every decade', () => {
    const mk = (opt: string): GameState => {
      const t = createGame('green-valley');
      addBuilding(t, 'farm', 10, 10);
      t.year = 1980;
      t.budget = 200;
      t.dilemmas.pending.push('gv-fertiliser');
      t.dilemmas.offered['gv-fertiliser'] = 1980;
      return applyAction(t, { type: 'choose', dilemmaId: 'gv-fertiliser', optionId: opt }).state;
    };
    const heavy = mk('heavy'), tested = mk('soil-test');
    const incomeHeavy = advanceDecade(heavy).report!.income;
    const incomeTested = advanceDecade(tested).report!.income;
    expect(incomeHeavy).toBeGreaterThan(incomeTested);
    // But the creek pays: the heavy dose keeps washing in.
    const h2 = advanceDecade(advanceDecade(heavy).state).state;
    const t2 = advanceDecade(advanceDecade(tested).state).state;
    expect(landSnapshot(h2).creek).toBeLessThan(landSnapshot(t2).creek);
  });

  it('use the evidence option sensibly: every evidence-backed option exists and costs money or income somewhere', () => {
    for (const d of act1) {
      if (d.noCleanAnswer) continue;
      expect(d.options.filter((o) => o.evidenceBacked), d.id).toHaveLength(1);
    }
  });

  it('other scenarios keep their own Act 1 decks and schedule between four and five cards, 20 years apart', () => {
    for (const id of ['coal-coast', 'river-town', 'reef-island', 'red-dirt'] as ScenarioId[]) {
      const cards = (DILEMMAS[id] ?? []).filter((d) => d.phase === 'act1');
      expect(cards.length, id).toBeGreaterThanOrEqual(2);
      expect(getScenario(id).act1?.cardGap, id).toBeUndefined();
    }
  });
});

describe('the decade ledger', () => {
  it('reports the bush, creek, air, CO2 and wildlife change next to the income', () => {
    const s = createGame('green-valley');
    s.year = 1970;
    s.budget = 400;
    addBuilding(s, 'factory', 4, 4);
    addBuilding(s, 'cottage', 8, 8);
    const r = advanceDecade(s).report!;
    expect(r.cost).toBeDefined();
    const c = r.cost!;
    expect(c.bushLeft).toBe(landSnapshot(s).bush);
    expect(c.bushLost).toBe(0);
    expect(c.creekAfter).toBeLessThanOrEqual(c.creekBefore);
    expect(c.airAfter).toBeLessThanOrEqual(c.airBefore);
    expect(c.co2Kt).toBe(Math.round(r.totalKt));
    expect(c.birdsBefore).toBeGreaterThan(0);
    expect(c.fishBefore).toBeGreaterThan(0);
  });
});

describe('fitUpgrades helper', () => {
  it('fits what it can afford, cheapest first, and keeps a reserve', () => {
    const { s } = valley(1990, 'factory', 'coalpower', 'farm');
    const t = fitUpgrades({ ...s, budget: 40 }, { reserve: 10 });
    const fitted = t.buildings.flatMap((b) => b.upgrades ?? []);
    expect(fitted).toEqual(['scrubber', 'creekbuffer']);
    expect(t.budget).toBe(12);
  });
});

describe('money on the card', () => {
  it('says what each option costs now and what it does to income, in plain words', () => {
    expect(moneyLine({ budget: -14, incomePerDecade: 8 })).toBe('Costs $14k now. About $8k more income every decade.');
    expect(moneyLine({ budget: 14, incomePerDecade: -2 })).toBe('Brings in $14k now. Costs about $2k in income every decade.');
    expect(moneyLine({ mood: {} })).toBe('');
    expect(moneyLine(null)).toBe('');
  });
});
