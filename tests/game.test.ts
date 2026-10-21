import { describe, expect, it } from 'vitest';
import {
  advanceDecade, applyAction, buildingAt, createGame, EMISSION_CATEGORIES, FACTS, getFactForDecade, parseSeed,
  projectedEmissions, realCO2, realTemp, TileKind, toCSV,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { buildN, runScript } from './helpers/autoplay';
import { sandbox } from './helpers/fixtures';
import { DIRTY_WANTS, greedyPlan } from './helpers/scripts';

describe('createGame', () => {
  it('starts coal-coast in 1850 with budget 100 and 285 ppm', () => {
    const s = createGame('coal-coast');
    expect(s.year).toBe(1850);
    expect(s.budget).toBe(100);
    expect(s.status).toBe('playing');
    expect(s.population).toBe(0);
    expect(s.co2).toBeCloseTo(285, 6);
    expect(s.history).toHaveLength(1);
    expect(s.history[0]?.year).toBe(1850);
    expect(s.version).toBe(0);
  });
  it('is deterministic for scenario+seed and responds to seed override', () => {
    const a = createGame('coal-coast'), b = createGame('coal-coast'), c = createGame('coal-coast', 77);
    expect(JSON.stringify(Array.from(a.grid.kind))).toBe(JSON.stringify(Array.from(b.grid.kind)));
    expect(Array.from(a.grid.kind)).not.toEqual(Array.from(c.grid.kind));
    expect(c.seed).toBe(77);
  });
  it('throws on unknown scenarios', () => {
    expect(() => createGame('nope' as never)).toThrow();
  });
  it('parseSeed accepts integers only', () => {
    expect(parseSeed('42')).toBe(42);
    expect(parseSeed('abc')).toBeUndefined();
    expect(parseSeed('-3')).toBeUndefined();
    expect(parseSeed(null)).toBeUndefined();
    expect(parseSeed('99999999999')).toBeUndefined();
  });
});

describe('place / demolish / clear', () => {
  it('placing deducts cost, marks tiles, bumps version and does not mutate the old state', () => {
    const s0 = createGame('coal-coast');
    const spot = (() => {
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const k = s0.grid.kind[y * 32 + x];
        if (k === TileKind.Land) return { x, y };
      }
      throw new Error('no land');
    })();
    const beforeKinds = Array.from(s0.grid.kind);
    const nBefore = s0.buildings.length; // the entrance road and the country road that runs in from it
    const { state: s1, result } = applyAction(s0, { type: 'place', building: 'cottage', x: spot.x, y: spot.y });
    expect(result.ok).toBe(true);
    expect(result.spent).toBe(10);
    expect(s1.budget).toBe(90);
    expect(s1.version).toBe(s0.version + 1);
    expect(s1.buildings).toHaveLength(nBefore + 1);
    expect(buildingAt(s1, spot.x, spot.y)?.type).toBe('cottage');
    expect(s0.buildings).toHaveLength(nBefore);
    expect(s0.budget).toBe(100);
    expect(Array.from(s0.grid.kind)).toEqual(beforeKinds);
    expect(s0.grid.building.filter((v) => v !== 0)).toHaveLength(nBefore);
    expect(s1.grid.building).not.toBe(s0.grid.building);
  });
  it('failed actions return the same state object and a human-readable reason', () => {
    const s = createGame('coal-coast');
    const r = applyAction(s, { type: 'place', building: 'steelworks', x: 0, y: 0 });
    expect(r.result.ok).toBe(false);
    expect(r.result.reason).toMatch(/unlocks in 1910/);
    expect(r.state).toBe(s);
  });
  it('demolish refunds 25% (rounded down), frees all tiles and removes the building', () => {
    let s = sandbox(TileKind.Land, { year: 1900, budget: 500 });
    s = applyAction(s, { type: 'place', building: 'factory', x: 4, y: 4 }).state; // cost 50
    expect(s.budget).toBe(450);
    const r = applyAction(s, { type: 'demolish', x: 5, y: 5 }); // any tile of the footprint
    expect(r.result.ok).toBe(true);
    expect(r.result.refund).toBe(12);
    expect(r.state.budget).toBe(462);
    expect(r.state.buildings).toHaveLength(0);
    expect(r.state.grid.building.every((v) => v === 0)).toBe(true);
    expect(applyAction(r.state, { type: 'demolish', x: 5, y: 5 }).result.code).toBe('nothing-here');
  });
  it('building on bush clears it (becomes land) and queues land-clearing emissions', () => {
    let s = sandbox(TileKind.Bush, { year: 1850 });
    s = applyAction(s, { type: 'place', building: 'farm', x: 2, y: 2 }).state;
    expect(s.grid.kind[2 * 32 + 2]).toBe(TileKind.Land);
    expect(s.grid.kind[3 * 32 + 3]).toBe(TileKind.Land);
    expect(s.grid.kind[4 * 32 + 4]).toBe(TileKind.Bush);
    expect(s.pendingLandKt).toBeGreaterThan(0);
    const { report } = advanceDecade(s);
    // 4 cleared tiles x 3 kt + farm's own 4 kt, all in the land category.
    expect(report?.emissionsKt.land).toBe(4 * 3 + 4);
  });
  it('the Clear tool converts a bush tile to land for a small cost, once', () => {
    let s = sandbox(TileKind.Bush, { year: 1850, budget: 50 });
    const r = applyAction(s, { type: 'clear', x: 3, y: 3 });
    expect(r.result.ok).toBe(true);
    s = r.state;
    expect(s.budget).toBe(49);
    expect(s.grid.kind[3 * 32 + 3]).toBe(TileKind.Land);
    expect(applyAction(s, { type: 'clear', x: 3, y: 3 }).result.code).toBe('not-bush');
    expect(applyAction(s, { type: 'clear', x: -1, y: 3 }).result.code).toBe('out-of-bounds');
  });
  it('uids stay unique across demolish and rebuild', () => {
    let s = sandbox(TileKind.Land, { year: 1850 });
    for (let i = 0; i < 5; i++) s = applyAction(s, { type: 'place', building: 'road', x: i, y: 0 }).state;
    s = applyAction(s, { type: 'demolish', x: 2, y: 0 }).state;
    s = applyAction(s, { type: 'place', building: 'road', x: 2, y: 0 }).state;
    const uids = s.buildings.map((b) => b.uid);
    expect(new Set(uids).size).toBe(uids.length);
  });
});

describe('advanceDecade', () => {
  it('runs 1850 -> 2020 in 17 steps then completes the act', () => {
    let s = createGame('coal-coast');
    const years: number[] = [];
    let last = null as ReturnType<typeof advanceDecade>['report'];
    for (let i = 0; i < 17; i++) {
      const r = advanceDecade(s);
      expect(r.report).not.toBeNull();
      s = r.state;
      last = r.report;
      years.push(s.year);
      expect(r.report?.actComplete).toBe(i === 16);
    }
    expect(years[0]).toBe(1860);
    expect(s.year).toBe(2020);
    expect(s.status).toBe('act1-complete');
    expect(last?.toYear).toBe(2020);
    expect(s.history).toHaveLength(18);
    // Further advancing / actions do nothing.
    const again = advanceDecade(s);
    expect(again.state).toBe(s);
    expect(again.report).toBeNull();
    expect(applyAction(s, { type: 'clear', x: 1, y: 1 }).result.code).toBe('game-over');
  });
  it('an empty town emits nothing and sits at the 0.4 floor of the model', () => {
    let s = createGame('coal-coast');
    for (let i = 0; i < 5; i++) s = advanceDecade(s).state;
    expect(s.cumulativeKt).toBe(0);
    expect(s.multiplier).toBe(0.4);
    expect(s.co2).toBeCloseTo(280 + (realCO2(1900) - 280) * 0.4, 6);
  });
  it('report: emissions by category, ppm, degrees, meters, demand and a fact', () => {
    let s = sandbox(TileKind.Land, { year: 1900 });
    s = buildN(s, 'factory', 1).state;
    s = buildN(s, 'landfill', 1).state;
    s = buildN(s, 'cottage', 4).state;
    s = buildN(s, 'road', 2).state;
    const { report, state } = advanceDecade(s);
    expect(report).not.toBeNull();
    const r = report as NonNullable<typeof report>;
    expect(r.fromYear).toBe(1900);
    expect(r.toYear).toBe(1910);
    expect(r.emissionsKt.industry).toBe(25);
    expect(r.emissionsKt.waste).toBe(15);
    expect(r.emissionsKt.land).toBe(4);
    expect(r.emissionsKt.power).toBe(0);
    expect(r.totalKt).toBe(44);
    expect(r.topSource).toBe('industry');
    expect(r.co2Ppm).toBe(state.co2);
    expect(r.realCo2Ppm).toBe(realCO2(1910));
    expect(r.realTempC).toBe(realTemp(1910));
    expect(r.tempC).toBe(state.tempC);
    expect(r.deltaCo2).toBeCloseTo(state.co2 - s.co2, 9);
    expect(r.meters).toEqual(state.meters);
    expect(r.demand).toMatch(/^Your town needs:/);
    expect(r.fact?.decade).toBe(1900);
    expect(r.fact?.text.length).toBeGreaterThan(20);
    expect(state.history.at(-1)?.totalKt).toBe(44);
  });
  it('projectedEmissions matches the catalogue', () => {
    let s = sandbox(TileKind.Land, { year: 1900 });
    s = buildN(s, 'factory', 2).state;
    expect(projectedEmissions(s).industry).toBe(50);
  });
  it('is deterministic: same actions give identical histories', () => {
    const plan = (st: GameState): GameState => buildN(st, 'cottage', 3).state;
    const a = runScript(createGame('coal-coast'), plan).state;
    const b = runScript(createGame('coal-coast'), plan).state;
    expect(JSON.stringify(a.history)).toBe(JSON.stringify(b.history));
    expect(a.version).toBe(b.version);
  });
  it('more building means more emissions, CO2 and temperature', () => {
    const none = runScript(createGame('coal-coast'), (s) => s).state;
    const light = runScript(createGame('coal-coast'), (s) => buildN(s, 'cottage', 1).state).state;
    const heavy = runScript(createGame('coal-coast'), greedyPlan(DIRTY_WANTS, 1)).state;
    expect(light.cumulativeKt).toBeGreaterThan(none.cumulativeKt);
    expect(heavy.cumulativeKt).toBeGreaterThan(light.cumulativeKt);
    expect(heavy.co2).toBeGreaterThan(none.co2);
    expect(heavy.tempC).toBeGreaterThan(none.tempC);
  });
  it('version increments on every successful change', () => {
    let s = createGame('coal-coast');
    const v0 = s.version;
    s = advanceDecade(s).state;
    expect(s.version).toBe(v0 + 1);
  });
});

describe('facts', () => {
  it('has a fact for each of the 18 decades 1850..2020', () => {
    for (let d = 1850; d <= 2020; d += 10) {
      const f = getFactForDecade(d);
      expect(f, String(d)).not.toBeNull();
      expect(f?.text.length).toBeGreaterThan(30);
    }
    expect(FACTS).toHaveLength(18);
    expect(getFactForDecade(1855)?.decade).toBe(1850);
  });
  it('includes the named milestones', () => {
    const all = FACTS.map((f) => f.text).join(' ');
    expect(all).toMatch(/Arrhenius/);
    expect(all).toMatch(/Keeling/);
    expect(all).toMatch(/IPCC/);
  });
});

describe('CSV export', () => {
  it('has a header and one row per history record, with matching sums', () => {
    let s = createGame('coal-coast');
    s = buildN(s, 'farm', 2).state;
    s = advanceDecade(s).state;
    s = advanceDecade(s).state;
    const csv = toCSV(s);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('year,your_co2_ppm,real_co2_ppm,your_temp_c,real_temp_c,power_kt,industry_kt,transport_kt,land_kt,waste_kt,total_kt');
    expect(lines).toHaveLength(1 + s.history.length);
    const row = (lines[2] ?? '').split(',').map(Number);
    expect(row[0]).toBe(1860);
    expect(row[2]).toBeCloseTo(realCO2(1860), 2);
    const total = row.slice(5, 10).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(row[10] ?? -1, 1);
    expect(csv.endsWith('\n')).toBe(true);
    expect(EMISSION_CATEGORIES).toHaveLength(5);
  });
});
