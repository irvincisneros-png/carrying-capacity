import { describe, expect, it } from 'vitest';
import {
  applyAction, balanceGrid, dcLeaseIncome, BUILDINGS, dataCentreCount, DATACENTRE_CARDS, dcLoad, deserialize, getDilemma, mechBegin, mechMetric, mechSeason, offerDataCentre,
  dataCentreOfferYear, renderText, serialize, storyVars, tick, TileKind, wordCount,
} from '../src/sim';
import type { GameState, ScenarioId } from '../src/sim';
import { heatDeathsExpected } from '../src/sim/mechanics/heatCore';
import { act2Sandbox, addBuilding, paint } from './helpers/fixtures';

type Mode = 'none' | 'offered' | 'conditions';

/** Puts the card on the table and answers it, so the building and its flags arrive the way a player would get them. */
function answer(s: GameState, option: string): GameState {
  s.dilemmas.pending.push('dc-offer');
  s.dilemmas.offered['dc-offer'] = s.year;
  const r = applyAction(s, { type: 'choose', dilemmaId: 'dc-offer', optionId: option });
  expect(r.result.ok, r.result.reason).toBe(true);
  return r.state;
}
const OPTION: Record<Mode, string | null> = { none: null, offered: 'dc-offered', conditions: 'dc-conditions' };

/** A small clean city: homes, solar, wind, batteries and one gas plant to back them up. */
function city(mode: Mode): GameState {
  const s = act2Sandbox(TileKind.Land, { scenario: 'net-zero-city', year: 2040 });
  s.population = 4000;
  for (let n = 0; n < 20; n++) addBuilding(s, 'suburb', 1 + (n % 10) * 2, 1 + Math.floor(n / 10) * 2);
  for (let n = 0; n < 3; n++) addBuilding(s, 'solarfarm', 2 + n * 3, 30);
  for (let n = 0; n < 3; n++) addBuilding(s, 'windfarm', 2 + n * 3, 34);
  for (let n = 0; n < 2; n++) addBuilding(s, 'battery', 2 + n * 3, 38);
  addBuilding(s, 'gaspower', 30, 30);
  mechBegin(s);
  const o = OPTION[mode];
  return o ? answer(s, o) : s;
}

/** Mean over a full year of seasons of the grid report (weather is the same in each variant). */
function gridYear(s: GameState): { renewable: number; emissions: number; unmet: number; demand: number } {
  let renewable = 0, emissions = 0, unmet = 0, demand = 0;
  for (let q = 0; q < 8; q++) {
    const c = { ...s, a2: { ...s.a2, season: ((s.a2.season + q) % 4) as 0 | 1 | 2 | 3 } };
    const g = balanceGrid(c).report;
    renewable += g.renewableShare / 8; emissions += g.emissionsKt; unmet += g.unmetFrac / 8; demand += g.demandTotal / 8;
  }
  return { renewable, emissions, unmet, demand };
}

describe('the data-centre card places a building and sets its terms', () => {
  it('is offered in every scenario except the tutorial, and each option is spelled out', () => {
    const ids = Object.keys(DATACENTRE_CARDS).sort();
    expect(ids).toEqual(['coal-coast', 'net-zero-city', 'red-dirt', 'reef-island', 'river-town']);
    for (const [id, d] of Object.entries(DATACENTRE_CARDS)) {
      expect(d?.options.map((o) => o.id)).toEqual(['dc-decline', 'dc-offered', 'dc-conditions']);
      expect(d?.options.filter((o) => o.evidenceBacked).map((o) => o.id)).toEqual(['dc-conditions']);
      expect(getDilemma(id as ScenarioId, 'dc-offer')).toBe(d);
    }
  });
  it('builds nothing when declined, one 3x3 shed on open land when accepted, and none in the lighter scenarios', () => {
    expect(dataCentreCount(city('none'))).toBe(0);
    for (const m of ['offered', 'conditions'] as const) {
      const s = city(m);
      expect(dataCentreCount(s)).toBe(1);
      const b = s.buildings.find((x) => x.type === 'datacentre');
      expect([b?.w, b?.h]).toEqual([3, 3]);
      for (let y = b?.y ?? 0; y < (b?.y ?? 0) + 3; y++) for (let x = b?.x ?? 0; x < (b?.x ?? 0) + 3; x++) expect(s.grid.building[y * s.grid.w + x]).toBe(b?.uid);
    }
    const declined = answer(act2Sandbox(TileKind.Land, { scenario: 'net-zero-city', year: 2040 }), 'dc-decline');
    expect(dataCentreCount(declined)).toBe(0);
    expect(declined.flags['dc.accepted']).toBe(0);
    for (const id of ['coal-coast', 'reef-island'] as const) {
      const s = act2Sandbox(TileKind.Land, { scenario: id, year: 2040 });
      s.dilemmas.pending.push('dc-offer');
      const r = applyAction(s, { type: 'choose', dilemmaId: 'dc-offer', optionId: 'dc-offered' });
      expect(r.result.ok).toBe(true);
      expect(dataCentreCount(r.state)).toBe(0);
      expect(Number(r.state.flags['income.adj'])).toBeGreaterThanOrEqual(10);
    }
  });
  it('is not in the build menu: players only get one by saying yes to the company', () => {
    expect(BUILDINGS.datacentre.cost).toBe(0);
    const s = act2Sandbox(TileKind.Land, { scenario: 'net-zero-city', year: 2040 });
    expect(applyAction(s, { type: 'place', building: 'datacentre', x: 5, y: 5 }).result.ok).toBe(false);
  });
  it('pays more up front and in rent when accepted as offered than on conditions, and both are worth tempting', () => {
    const o = city('offered'), c = city('conditions'), n = city('none');
    expect(o.budget - n.budget).toBeGreaterThanOrEqual(150);
    expect(c.budget - n.budget).toBeGreaterThan(0);
    expect(o.budget).toBeGreaterThan(c.budget);
    expect(dcLeaseIncome(o)).toBeGreaterThan(dcLeaseIncome(c));
    expect(dcLeaseIncome(o)).toBeGreaterThanOrEqual(25);
    expect(dcLeaseIncome(c)).toBeGreaterThan(0);
    expect(o.flags['income.adj']).toBeUndefined();
  });
  it('the lease stops when the data centre is demolished', () => {
    const o = city('offered');
    const dc = o.buildings.find((x) => x.type === 'datacentre')!;
    expect(dcLeaseIncome(o)).toBeGreaterThan(0);
    const after = applyAction(o, { type: 'demolish', x: dc.x, y: dc.y });
    expect(after.result.ok, after.result.reason).toBe(true);
    expect(dcLeaseIncome(after.state)).toBe(0);
    expect(after.state.flags['income.adj']).toBeUndefined();
  });
});

describe('the grid feels a data centre (Net Zero City)', () => {
  const n = gridYear(city('none')), o = gridYear(city('offered')), c = gridYear(city('conditions'));
  it('adds a steady load that does not follow the working day, and conditions cut it', () => {
    expect(dcLoad(city('none'))).toBe(0);
    expect(dcLoad(city('offered'))).toBeCloseTo(9.5, 6);
    expect(dcLoad(city('conditions'))).toBeCloseTo(5.5, 6);
    expect(o.demand).toBeGreaterThan(n.demand);
    expect(c.demand).toBeLessThan(o.demand);
  });
  it('pulls the renewable share down and the emissions up when accepted as offered', () => {
    expect(o.renewable).toBeLessThan(n.renewable - 0.02);
    expect(o.emissions).toBeGreaterThan(n.emissions * 1.05);
  });
  it('accepting with conditions leaves the grid closer to where it was', () => {
    expect(c.renewable).toBeGreaterThan(o.renewable);
    expect(c.emissions).toBeLessThan(o.emissions);
  });
  it('can leave the lights flickering if the grid cannot cover it', () => {
    const s = city('offered');
    for (const b of s.buildings.filter((x) => x.type === 'gaspower')) s.buildings.splice(s.buildings.indexOf(b), 1);
    const t = gridYear(s);
    expect(t.unmet).toBeGreaterThanOrEqual(n.unmet);
  });
  it('adds heat risk in a hot city unless the waste heat is put to use', () => {
    const base = heatDeathsExpected(city('none'), 1, false);
    const offered = heatDeathsExpected(city('offered'), 1, false);
    const cond = heatDeathsExpected(city('conditions'), 1, false);
    expect(offered).toBeGreaterThan(base * 1.05);
    expect(cond).toBeGreaterThan(base);
    expect(cond).toBeLessThan(offered);
  });
});

describe('cooling water: the river (River Town) and the aquifer (Red Dirt)', () => {
  function riverTown(mode: Mode): GameState {
    const s = act2Sandbox(TileKind.Land, { scenario: 'river-town', year: 2041 });
    paint(s, 0, 14, 32, 3, TileKind.River);
    for (let i = 0; i < s.grid.kind.length; i++) s.grid.elevation[i] = s.grid.kind[i] === TileKind.River ? 0 : 2;
    for (let n = 0; n < 5; n++) addBuilding(s, 'farm', 2 + n * 5, 4);
    s.population = 800;
    mechBegin(s);
    const o = OPTION[mode];
    return o ? answer(s, o) : s;
  }
  const after = (mode: Mode): GameState => {
    let s = riverTown(mode);
    for (let i = 0; i < 6; i++) s = tick(s, 1).state;
    return s;
  };
  it('takes water out of the farms and out of the river when it cools with water', () => {
    const none = after('none'), offered = after('offered'), cond = after('conditions');
    const flow = (s: GameState): number => Number(s.flags['w.envAvg']);
    expect(flow(offered)).toBeLessThan(flow(none) - 0.01);
    expect(Number(offered.flags['w.yield'])).toBeLessThan(Number(none.flags['w.yield']) - 0.01);
    // Recycled water draws far less, so the river and the farms are close to where they were.
    expect(flow(cond)).toBeGreaterThan(flow(offered));
    expect(Number(cond.flags['w.yield'])).toBeGreaterThan(Number(offered.flags['w.yield']));
  });
  it('draws down the aquifer in Red Dirt when it cools with bore water, and hardly at all with air cooling', () => {
    const red = (mode: Mode): GameState => {
      const s = act2Sandbox(TileKind.Land, { scenario: 'red-dirt', year: 2030 });
      s.population = 600;
      mechBegin(s);
      const o = OPTION[mode];
      const t = o ? answer(s, o) : s;
      for (let i = 0; i < 40; i++) mechSeason(t, [], i);
      return t;
    };
    const none = red('none'), offered = red('offered'), cond = red('conditions');
    const aq = (s: GameState): number => mechMetric(s, 'aquifer') ?? 0;
    expect(aq(offered)).toBeLessThan(aq(none) - 5);
    expect(aq(cond)).toBeGreaterThan(aq(offered) + 4);
    expect(aq(none) - aq(cond)).toBeLessThan(1.5);
  });
});

describe('when it is offered', () => {
  it('arrives once, between 2035 and 2042, outside the regular cards, and lapses quietly after five years', () => {
    const s = act2Sandbox(TileKind.Land, { scenario: 'river-town', year: 2030 });
    const at = dataCentreOfferYear(s);
    expect(at).toBeGreaterThanOrEqual(2035);
    expect(at).toBeLessThanOrEqual(2042);
    for (s.year = 2030; s.year < at; s.year++) { offerDataCentre(s); expect(s.dilemmas.pending).toEqual([]); }
    offerDataCentre(s);
    expect(s.dilemmas.pending).toEqual(['dc-offer']);
    offerDataCentre(s);
    expect(s.dilemmas.pending).toEqual(['dc-offer']);
    s.year += 5;
    offerDataCentre(s);
    expect(s.dilemmas.pending).toEqual([]);
    expect(s.dilemmas.decisions).toHaveLength(0);
    expect(s.dilemmas.adjust).toBe(0);
    offerDataCentre(s);
    expect(s.dilemmas.pending).toEqual([]);
  });
  it('does not come to the tutorial or in Act 1', () => {
    const g = act2Sandbox(TileKind.Land, { scenario: 'green-valley', year: 2036 });
    offerDataCentre(g);
    expect(g.dilemmas.pending).toEqual([]);
    const a1 = act2Sandbox(TileKind.Land, { scenario: 'river-town', year: 2040 });
    a1.phase = 'act1';
    offerDataCentre(a1);
    expect(a1.dilemmas.pending).toEqual([]);
  });
  it('survives a save and load with the building and its terms', () => {
    const s = city('conditions');
    const back = deserialize(serialize(s));
    expect(back).not.toBeNull();
    expect(dataCentreCount(back as GameState)).toBe(1);
    expect(dcLoad(back as GameState)).toBeCloseTo(dcLoad(s), 9);
    expect((back as GameState).flags['dc.ppa']).toBe(1);
    expect((back as GameState).buildings.find((b) => b.type === 'datacentre')).toEqual(s.buildings.find((b) => b.type === 'datacentre'));
  });
});

describe('the card text (content integrity)', () => {
  it('is short and plain, cites its sources by name, and frames the benefits as real', () => {
    const vars = storyVars(act2Sandbox());
    for (const [id, d] of Object.entries(DATACENTRE_CARDS)) {
      if (!d) continue;
      expect(wordCount(renderText(d.setup, vars)), `${id} setup`).toBeLessThanOrEqual(75);
      expect(wordCount(d.evidence), `${id} evidence`).toBeGreaterThanOrEqual(30);
      expect(wordCount(d.evidence), `${id} evidence`).toBeLessThanOrEqual(90);
      expect(d.evidence).toMatch(/AEMO/);
      expect(d.evidence).toMatch(/cloud/);
      for (const o of d.options) {
        expect(wordCount(o.label), `${id}/${o.id}`).toBeLessThanOrEqual(16);
        expect(wordCount(o.outcome), `${id}/${o.id}`).toBeLessThanOrEqual(50);
        expect(o.preview.helps.length).toBeGreaterThanOrEqual(1);
        expect(o.preview.hurts.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
