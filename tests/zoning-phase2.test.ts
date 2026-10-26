import { describe, expect, it } from 'vitest';
import {
  addFreeRoad, advanceYear, applyAction, BUILDINGS, cloneState, commuteStats, createGame, economySnapshot, getScenario, retrofitPlan, SCENARIO_IDS,
  tick, TileKind, ZONE, DENSITY_UPGRADE_COST,
} from '../src/sim';
import type { GameState, ScenarioId } from '../src/sim';
import { co2Of, powerOf } from '../src/sim/upgrades';
import { highriseHeat, heatDeathsExpected, HEAT } from '../src/sim/mechanics/heatCore';
import { inspectZone, legacyHomeHidden, zoneDragInfo } from '../src/ui/zonemenu';
import { addBuilding } from './helpers/fixtures';
import { grow } from './helpers/sprawl';
import { grownOf, zoneArea } from './helpers/zoning';

/** Open flat land on the scenario's own map settings (so its budget multiplier, mechanics and seed apply), a street along row 10 and plenty of money. */
function fieldFor(id: ScenarioId, year = 1960): GameState {
  const s = cloneState(createGame(id));
  const g = s.grid;
  g.kind.fill(TileKind.Land);
  g.elevation.fill(1);
  g.building.fill(0);
  g.zoning.fill(0);
  g.zone.fill(0);
  g.significant.fill(0);
  g.airPollution.fill(0);
  g.waterPollution.fill(0);
  g.soilContamination.fill(0);
  s.buildings = [];
  s.nextUid = 1;
  for (const k of Object.keys(s.flags)) if (k.startsWith('road.entrance')) delete s.flags[k];
  s.year = year;
  s.budget = 5000;
  s.population = 0;
  for (let x = 0; x <= 19; x++) addFreeRoad(s, 10 * g.w + x);
  s.flags['road.entrance'] = 10 * g.w;
  return s;
}

const years = (s0: GameState, n: number): GameState => {
  let s = s0;
  for (let i = 0; i < n && s.phase === 'act1'; i++) s = advanceYear(s).state;
  return s;
};

const ACT1_SCENARIOS = SCENARIO_IDS.filter((id) => getScenario(id).act1 !== undefined);

describe('light industry', () => {
  it('has an Act 1 in every scenario but Net Zero City', () => {
    expect(ACT1_SCENARIOS).toHaveLength(SCENARIO_IDS.length - 1);
    expect(ACT1_SCENARIOS).not.toContain('net-zero-city');
  });

  for (const id of ACT1_SCENARIOS) {
    it(`${id}: workshops grow beside the big industries, give jobs and add a little air pollution`, () => {
      let s = fieldFor(id);
      for (const x of [4, 7, 10]) addBuilding(s, 'factory', x, 11);
      addBuilding(s, 'coalpower', 14, 11);
      s = zoneArea(s, { x: 0, y: 8, w: 12, h: 2 }, ZONE.rlow);
      s = zoneArea(s, { x: 14, y: 8, w: 6, h: 2 }, ZONE.ind);
      const jobsBefore = economySnapshot(s).jobs;
      const air0 = s.grid.airPollution.reduce((a, b) => a + b, 0);
      s = years(s, 6);
      const ind = s.buildings.filter((b) => b.type === 'zind');
      expect(ind.length, 'light industry grew').toBeGreaterThan(0);
      expect(economySnapshot(s).jobs).toBeGreaterThan(jobsBefore);
      expect(BUILDINGS.zind.pollutes.air).toBeGreaterThan(0);
      // Local air pollution: the workshops' own tiles read as polluted after the decade's pollution is worked out.
      const decade = advanceYearsToDecadeEnd(s);
      const air1 = decade.grid.airPollution.reduce((a, b) => a + b, 0);
      expect(air1).toBeGreaterThan(air0);
    });
  }

  it('does not grow with no big industry to serve', () => {
    let s = fieldFor('green-valley');
    s = zoneArea(s, { x: 0, y: 8, w: 6, h: 2 }, ZONE.ind);
    s = years(s, 5);
    expect(grownOf(s, ZONE.ind)).toBe(0);
  });
});

function advanceYearsToDecadeEnd(s0: GameState): GameState {
  let s = s0;
  const start = s.year;
  for (let i = 0; i < 12 && s.phase === 'act1' && s.year < start + 10; i++) s = advanceYear(s).state;
  return s;
}

describe('density upgrades', () => {
  function town(year: number): { s: GameState; b: { uid: number; x: number; y: number } } {
    let s = fieldFor('green-valley', year);
    addBuilding(s, 'factory', 4, 11);
    addBuilding(s, 'factory', 8, 11);
    addBuilding(s, 'coalpower', 12, 11);
    s = zoneArea(s, { x: 0, y: 8, w: 6, h: 2 }, ZONE.rlow);
    s = years(s, 1);
    const b = s.buildings.find((o) => o.type === 'zres1');
    expect(b).toBeDefined();
    return { s, b: b as { uid: number; x: number; y: number } };
  }

  it('Inspect offers the next density up, with its cost, on a grown home', () => {
    const { s, b } = town(1960);
    const info = inspectZone(s, s.buildings.find((o) => o.uid === b.uid)!);
    expect(info).not.toBeNull();
    expect(info!.upgrade?.zone).toBe(2);
    expect(info!.upgrade?.why).toBe('');
    expect(info!.upgrade?.cost).toBeCloseTo(DENSITY_UPGRADE_COST * getScenario(s.scenarioId).modifiers.budgetMult, 6);
    expect(info!.rows.some((r) => r.k === 'Zone' && /low density/i.test(r.v))).toBe(true);
  });

  it('is gated by the era: no medium density before 1950, no high before 1970', () => {
    const early = town(1900);
    const e = inspectZone(early.s, early.s.buildings.find((o) => o.uid === early.b.uid)!);
    expect(e!.upgrade?.why).toMatch(/1950/);
    const r = applyAction(early.s, { type: 'zone', x: early.b.x, y: early.b.y, w: 1, h: 1, zone: ZONE.rmed });
    expect(r.result.ok).toBe(false);
    const mid = town(1960);
    const med = applyAction(mid.s, { type: 'zone', x: mid.b.x, y: mid.b.y, w: 1, h: 1, zone: ZONE.rmed });
    expect(med.result.ok, med.result.reason).toBe(true);
    // The grown tile is now medium; the next step up (high) is not open until 1970.
    const m2 = inspectZone(med.state, med.state.buildings.find((o) => o.uid === mid.b.uid)!);
    expect(m2!.pending).toMatch(/next growth tick/);
    const hi = applyAction(mid.s, { type: 'zone', x: mid.b.x, y: mid.b.y, w: 1, h: 1, zone: ZONE.rhigh });
    expect(hi.result.ok).toBe(false);
  });

  it('costs money now and swaps the building on the next growth tick', () => {
    const { s, b } = town(1960);
    const r = applyAction(s, { type: 'zone', x: b.x, y: b.y, w: 1, h: 1, zone: ZONE.rmed });
    expect(r.result.ok, r.result.reason).toBe(true);
    expect(r.state.budget).toBeCloseTo(s.budget - DENSITY_UPGRADE_COST * getScenario(s.scenarioId).modifiers.budgetMult, 6);
    // Nothing changes at once.
    expect(r.state.buildings.find((o) => o.uid === b.uid)?.type).toBe('zres1');
    const next = advanceYear(r.state).state;
    const swapped = next.buildings.find((o) => o.uid === b.uid);
    expect(swapped?.type).toBe('zres2');
    expect(swapped?.grown).toBe(true);
    expect(next.grid.building[b.y * next.grid.w + b.x]).toBe(b.uid);
  });
});

describe('Act 2 retrofit is an area action on grown homes', () => {
  function act2Town(): GameState {
    let s = fieldFor('green-valley', 2025);
    s.phase = 'act2';
    s.status = 'playing';
    s.budget = 1000;
    for (let x = 0; x < 5; x++) {
      const b = addBuilding(s, 'zres1', x, 9);
      b.grown = true;
    }
    addBuilding(s, 'zcom', 8, 9).grown = true;
    s = cloneState(s);
    return s;
  }

  it('retrofits only the homes inside the box, for the old Retrofitted homes price per person', () => {
    const s = act2Town();
    const plan = retrofitPlan(s, 0, 8, 3, 3);
    expect(plan.ok).toBe(true);
    expect(plan.uids).toHaveLength(3);
    expect(plan.cost).toBeCloseTo(Math.round(3 * 20 * (28 / 120) * 10) / 10, 6);
    const r = applyAction(s, { type: 'retrofit', x: 0, y: 8, w: 3, h: 3 });
    expect(r.result.ok, r.result.reason).toBe(true);
    const done = r.state.buildings.filter((b) => b.upgrades?.includes('retrofit'));
    expect(done).toHaveLength(3);
    expect(r.state.budget).toBeCloseTo(s.budget - plan.cost, 6);
    // Half the electricity, a quarter of the CO2.
    expect(powerOf(done[0]!)).toBeCloseTo(BUILDINGS.zres1.power * 0.5, 6);
    expect(co2Of(done[0]!)).toBeCloseTo(BUILDINGS.zres1.co2 * 0.25, 6);
    // Doing it twice does nothing; shops are not homes.
    expect(retrofitPlan(r.state, 0, 8, 3, 3).ok).toBe(false);
    expect(retrofitPlan(r.state, 8, 8, 1, 3).ok).toBe(false);
  });

  it('is an Act 2 action only', () => {
    const s = act2Town();
    s.phase = 'act1';
    expect(retrofitPlan(s, 0, 8, 5, 3).ok).toBe(false);
  });

  it('shows the cost while dragging, and the placeable Retrofitted homes leave a new game', () => {
    const s = act2Town();
    const info = zoneDragInfo(s, { x: 0, y: 8, w: 5, h: 3 }, -1);
    expect(info.ok).toBe(true);
    expect(info.html).toMatch(/Retrofit 5 homes/);
    expect(legacyHomeHidden(s, 'greensuburb')).toBe(true);
    const old = cloneState(s);
    old.flags = { ...old.flags };
    delete old.flags.zoning;
    expect(legacyHomeHidden(old, 'greensuburb')).toBe(false);
    const withOne = cloneState(s);
    addBuilding(withOne, 'greensuburb', 12, 4);
    expect(legacyHomeHidden(withOne, 'greensuburb')).toBe(false);
  });
});

describe('Net Zero City', () => {
  it('keeps its prebuilt city and grows new zones around it', () => {
    let s = createGame('net-zero-city');
    expect(s.phase).toBe('act2');
    const placed = s.buildings.filter((b) => !b.grown).length;
    expect(placed).toBeGreaterThan(50);
    const g = s.grid;
    // Zone open land beside the city's streets.
    s.budget = 500;
    let zoned = 0;
    for (let y = 2; y < g.h - 3 && zoned < 12; y++) for (let x = 2; x < g.w - 3 && zoned < 12; x++) {
      if ((g.zoning[y * g.w + x] ?? 0) !== 0) continue;
      const r = applyAction(s, { type: 'zone', x, y, w: 1, h: 1, zone: zoned % 2 ? ZONE.com : ZONE.rmed });
      if (r.result.ok) { s = r.state; zoned++; }
    }
    expect(zoned).toBeGreaterThan(5);
    for (let i = 0; i < 12; i++) s = tick(s, 1).state;
    expect(s.buildings.filter((b) => !b.grown).length).toBeGreaterThanOrEqual(placed - 5);
    expect(grownOf(s)).toBeGreaterThan(0);
  });

  it('adds a little heat for high-rise homes, and parks win it back', () => {
    const base = createGame('net-zero-city');
    const none = cloneState(base);
    const tall = cloneState(base);
    for (let i = 0; i < 20; i++) addBuilding(tall, 'zres3', 2 + (i % 10), 2 + Math.floor(i / 10) * 2).grown = true;
    expect(highriseHeat(none)).toBe(1);
    const hot = highriseHeat(tall);
    expect(hot).toBeGreaterThan(1);
    expect(hot).toBeLessThan(1 + HEAT.highriseMax + 1e-9);
    expect(heatDeathsExpected(tall, 1, false)).toBeGreaterThan(heatDeathsExpected(none, 1, false) * 1.05);
    // Parks and shade: a canopy-covered city cancels it.
    const shaded = cloneState(tall);
    for (let i = 0; i < shaded.grid.kind.length; i++) if ((shaded.grid.building[i] ?? 0) === 0) { shaded.grid.stage[i] = 3; shaded.grid.health[i] = 0.9; }
    for (let i = 0; i < shaded.grid.kind.length; i++) if (shaded.grid.kind[i] === TileKind.Land) shaded.grid.kind[i] = TileKind.Bush;
    expect(highriseHeat(shaded)).toBeLessThan(hot);
  });
});

describe('the density lesson in numbers (Green Valley)', () => {
  it('a town of all low-density homes has 15 to 25 percent more transport CO2 per person than a compact, mixed one', () => {
    const sprawl = grow(false);
    const compact = grow(true);
    const per = (s: GameState): number => commuteStats(s).ktPerDecade / s.population;
    const ratio = per(sprawl.s) / per(compact.s);
    expect(ratio).toBeGreaterThanOrEqual(1.15);
    expect(ratio).toBeLessThanOrEqual(1.25);
    // ...and clears at least 30 percent more bush per person.
    expect(sprawl.bushLost / sprawl.s.population).toBeGreaterThanOrEqual(1.3 * (compact.bushLost / compact.s.population));
  });
});
