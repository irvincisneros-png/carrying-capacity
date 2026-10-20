import { describe, expect, it } from 'vitest';
import {
  applyAction, balanceGrid, canPlace, EMISSION_INTENSITY, KT_PER_UNIT_SEASON, TileKind, tick,
} from '../src/sim';
import type { BuildingId, GameState, Season } from '../src/sim';
import { act2Sandbox, addBuilding, paint } from './helpers/fixtures';

/** Sandbox with `homes` suburbs (4 demand each) in a row. */
function town(homes: number, scenario: 'coal-coast' | 'net-zero-city' = 'coal-coast'): GameState {
  const s = act2Sandbox(TileKind.Land, { scenario });
  for (let i = 0; i < homes; i++) addBuilding(s, 'suburb', 1 + (i % 10) * 2, 1 + Math.floor(i / 10) * 2);
  return s;
}
const inSeason = (s: GameState, season: Season): GameState => ({ ...s, a2: { ...s.a2, season } });
const grid = (s: GameState, season: Season = 0, idx = 700 + season) => balanceGrid(inSeason(s, season), idx).report;

/** Add `n` buildings of a type along a free row (tests only). */
function add(s: GameState, type: BuildingId, n: number, y = 28): void {
  for (let i = 0; i < n; i++) addBuilding(s, type, 1 + i * 3, y);
}

describe('grid demand', () => {
  it('sums sectors from the buildings and varies by season', () => {
    const s = town(10);
    addBuilding(s, 'factory', 25, 3);
    const summer = grid(s, 0);
    const autumn = grid(s, 1);
    const winter = grid(s, 2);
    expect(summer.demand.homes).toBeGreaterThan(autumn.demand.homes); // air conditioning
    expect(winter.demand.homes).toBeGreaterThan(autumn.demand.homes); // heating
    expect(summer.demand.industry).toBeCloseTo(autumn.demand.industry, 9);
    expect(summer.demand.industry).toBeCloseTo(5, 6);
    expect(summer.demand.homes).toBeCloseTo(40 * 1.1 * (1 + 0.04 * s.tempC), 6);
  });
  it('a heatwave pushes homes demand up for that season only', () => {
    const s = town(10);
    const normal = balanceGrid(inSeason(s, 0), 700).report.demand.homes;
    s.a2.active.push({ type: 'heatwave', endsAt: 701, severity: 1 });
    expect(balanceGrid(inSeason(s, 0), 700).report.demand.homes).toBeCloseTo(normal * 1.25, 6);
    expect(balanceGrid(inSeason(s, 0), 701).report.demand.homes).toBeCloseTo(normal, 6);
  });
  it('warming adds to summer cooling demand', () => {
    const a = town(10), b = town(10);
    a.tempC = 0.2;
    b.tempC = 3;
    expect(grid(b, 0).demand.homes).toBeGreaterThan(grid(a, 0).demand.homes);
    expect(grid(b, 1).demand.homes).toBeCloseTo(grid(a, 1).demand.homes, 9);
  });
});

describe('grid supply and balance', () => {
  it('coal covers demand when capacity is enough, with no blackout', () => {
    const s = town(10);
    add(s, 'coalpower', 2);
    const r = grid(s, 0);
    expect(r.capacity.coal).toBe(80);
    expect(r.unmetFrac).toBe(0);
    expect(r.blackout).toBe(false);
    expect(r.day.unmet + r.night.unmet).toBe(0);
    expect(r.generation.coal).toBeCloseTo(r.demandTotal, 6);
  });
  it('emissions: coal is about twice gas per unit of electricity, and renewables are tiny', () => {
    const coal = town(10);
    add(coal, 'coalpower', 2);
    const gas = town(10);
    add(gas, 'gaspower', 2);
    const wind = town(10);
    paint(wind, 0, 0, 32, 32, TileKind.Land);
    add(wind, 'windfarm', 20);
    const rc = grid(coal, 1), rg = grid(gas, 1);
    expect(EMISSION_INTENSITY.coal / EMISSION_INTENSITY.gas).toBeCloseTo(2, 9);
    expect(rc.generation.coal).toBeCloseTo(rg.generation.gas ?? 0, 6);
    expect(rc.emissionsKt / rg.emissionsKt).toBeCloseTo(2, 6);
    expect(rc.emissionsKt).toBeCloseTo((rc.generation.coal ?? 0) * 0.9 * KT_PER_UNIT_SEASON, 9);
    const rw = grid(wind, 1);
    expect(rw.emissionsKt).toBeLessThan(rc.emissionsKt * 0.05);
  });
  it('a coal station at full output emits about 15 kt a year, matching Act 1\'s 150 kt per decade', () => {
    const s = act2Sandbox(TileKind.Land);
    addBuilding(s, 'coalpower', 28, 28);
    for (let i = 0; i < 6; i++) addBuilding(s, 'steelworks', 1 + (i % 3) * 4, 1 + Math.floor(i / 3) * 4);
    const out = tick(s, 1).state;
    const power = out.a2.yearly.at(-1)?.emissionsKt.power ?? 0;
    expect(power).toBeGreaterThan(13);
    expect(power).toBeLessThan(15.01);
    expect(out.a2.lastGrid?.unmetFrac).toBeGreaterThan(0); // demand 60 > 38 available
  });
  it('blackout when supply cannot meet the peak: shortfall is reported, an event is raised, Society takes a hit', () => {
    const s = town(10);
    add(s, 'coalpower', 1); // 38 available vs about 44 summer demand
    const r = grid(s, 0);
    expect(r.blackout).toBe(true);
    expect(r.unmetFrac).toBeGreaterThan(0.05);
    const out = tick(s, 1).state;
    const ev = out.eventLog.filter((e) => e.type === 'blackout');
    expect(ev.length).toBeGreaterThan(0);
    expect(ev[0]?.text).toMatch(/Blackout/);
    expect(ev[0]?.data?.unmetPct).toBeGreaterThan(0);
    expect(out.a2.lastUnmetFrac).toBeGreaterThan(0);
    const ok = town(10);
    add(ok, 'coalpower', 2);
    const fine = tick(ok, 1).state;
    expect(fine.eventLog.filter((e) => e.type === 'blackout')).toHaveLength(0);
    expect(out.meters.society).toBeLessThan(fine.meters.society - 3);
    expect(out.lastIncome).toBeLessThan(fine.lastIncome);
  });
  it('solar only works in the day: night demand needs dispatchable, storage, wind or hydro', () => {
    const s = town(10);
    add(s, 'solarfarm', 8);
    const r = grid(s, 0);
    expect(r.day.unmet).toBe(0);
    expect(r.night.unmet).toBeGreaterThan(0);
    expect(r.night.bySource['solar-farm']).toBe(0);
    expect(r.day.curtailed).toBeGreaterThan(0);
    // night met by gas
    const withGas = town(10);
    add(withGas, 'solarfarm', 8);
    add(withGas, 'gaspower', 2, 24);
    const g = grid(withGas, 0);
    expect(g.night.unmet).toBe(0);
    expect(g.night.bySource.gas).toBeGreaterThan(0);
    expect(g.day.bySource.gas ?? 0).toBeLessThan(g.night.bySource.gas ?? 0);
  });
  it('batteries shift surplus solar into the night, with losses', () => {
    const s = town(10);
    add(s, 'solarfarm', 8);
    add(s, 'battery', 5, 24);
    const before = balanceGrid(inSeason(town(10), 0), 700);
    const withSolar = town(10);
    add(withSolar, 'solarfarm', 8);
    const noBat = balanceGrid(inSeason(withSolar, 0), 700).report;
    const r = balanceGrid(inSeason(s, 0), 700);
    expect(before.report.night.unmet).toBeGreaterThan(0);
    expect(r.report.night.discharged).toBeGreaterThan(0);
    expect(r.report.night.unmet).toBeLessThan(noBat.night.unmet);
    expect(r.report.day.charged * 0.9).toBeGreaterThanOrEqual(r.report.night.discharged - 1e-9);
    expect(r.report.day.charged).toBeLessThanOrEqual(40 + 1e-9); // 5 batteries x 8
    expect(r.storageLevel).toBeGreaterThanOrEqual(0);
  });
  it('storage carries over between seasons and never exceeds its rating', () => {
    const s = town(10);
    add(s, 'solarfarm', 12);
    add(s, 'battery', 2, 24);
    let cur = s;
    for (let k = 0; k < 8; k++) {
      cur = tick(cur, 0.25).state;
      expect(cur.a2.storageLevel).toBeLessThanOrEqual(16 + 1e-9);
      expect(cur.a2.storageLevel).toBeGreaterThanOrEqual(0);
    }
  });
  it('solar is stronger in summer than winter; wind is stronger in winter than summer', () => {
    const s = act2Sandbox(TileKind.Land);
    for (let i = 0; i < 10; i++) addBuilding(s, 'steelworks', 1 + (i % 5) * 4, 1 + Math.floor(i / 5) * 4); // lots of demand
    for (let i = 0; i < 2; i++) addBuilding(s, 'solarfarm', 1 + i * 3, 12);
    for (let i = 0; i < 6; i++) addBuilding(s, 'windfarm', 1 + i * 2, 16);
    const day = (season: Season, src: 'solar-farm' | 'wind'): number => balanceGrid(inSeason(s, season), 800).report.day.bySource[src] ?? 0;
    expect(day(0, 'solar-farm')).toBeGreaterThan(day(2, 'solar-farm') * 1.4);
    expect(day(2, 'wind')).toBeGreaterThan(day(0, 'wind') * 1.2);
  });
  it('hydro falls in a drought', () => {
    const s = town(20);
    add(s, 'hydro', 3);
    const dry = town(20);
    add(dry, 'hydro', 3);
    dry.a2.active.push({ type: 'drought', endsAt: 99999, severity: 1 });
    const a = grid(s, 0).generation.hydro ?? 0;
    const b = grid(dry, 0).generation.hydro ?? 0;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeLessThan(a * 0.7);
  });
  it('merit order: variable renewables first, then coal, then gas', () => {
    const s = town(10);
    add(s, 'windfarm', 2);
    add(s, 'coalpower', 1, 24);
    add(s, 'gaspower', 2, 20);
    const r = grid(s, 1);
    expect(r.generation.wind).toBeGreaterThan(0);
    expect(r.generation.coal).toBeGreaterThan(0);
    // coal is maxed before gas starts
    expect(r.generation.coal).toBeLessThanOrEqual(38 + 1e-9);
    if ((r.generation.gas ?? 0) > 0) expect(r.generation.coal).toBeCloseTo(38, 6);
  });
  it('power stations pollute the air in proportion to how hard they run', () => {
    const idle = town(1);
    addBuilding(idle, 'coalpower', 20, 20);
    const busy = town(10);
    addBuilding(busy, 'coalpower', 20, 20);
    const air = (s: GameState): number => tick(s, 0.5).state.grid.airPollution.reduce((a, b) => a + b, 0);
    expect(air(busy)).toBeGreaterThan(air(idle) * 3);
  });
});

describe('siting rules with reasons', () => {
  const place = (s: GameState, id: BuildingId, x: number, y: number) => canPlace(s, id, x, y, 0);

  it('wind turbines need a ridge or a headland', () => {
    const s = act2Sandbox(TileKind.Land);
    const flat = place(s, 'windfarm', 10, 10);
    expect(flat.ok).toBe(false);
    expect(flat.code).toBe('bad-siting');
    expect(flat.reason).toMatch(/ridge|headland/);
    s.grid.elevation[10 * 32 + 10] = 2;
    expect(place(s, 'windfarm', 10, 10).ok).toBe(true);
    // headland: close to the sea
    paint(s, 25, 0, 7, 32, TileKind.Sea);
    expect(place(s, 'windfarm', 22, 5).ok).toBe(true); // within 3 of the sea
    expect(place(s, 'windfarm', 15, 5).ok).toBe(false);
  });
  it('hydro needs a river right beside it and a 2-step drop', () => {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 0, 8, 32, 1, TileKind.River);
    for (let x = 0; x < 32; x++) s.grid.elevation[8 * 32 + x] = 0;
    const low = place(s, 'hydro', 10, 9); // elevation 1
    expect(low.ok).toBe(false);
    expect(low.reason).toMatch(/drop|high ground/);
    for (let x = 0; x < 32; x++) for (let y = 9; y < 11; y++) s.grid.elevation[y * 32 + x] = 2;
    expect(place(s, 'hydro', 10, 9).ok).toBe(true);
    const far = place(s, 'hydro', 10, 14);
    expect(far.ok).toBe(false);
    expect(far.reason).toMatch(/river/);
    expect(place(s, 'hydro', 10, 9).cost).toBe(130);
  });
  it('pumped hydro needs high ground with water nearby', () => {
    const s = act2Sandbox(TileKind.Land, { year: 2030 });
    expect(place(s, 'pumpedhydro', 10, 10).ok).toBe(false);
    paint(s, 0, 12, 32, 1, TileKind.River);
    s.grid.elevation.fill(2);
    for (let x = 0; x < 32; x++) s.grid.elevation[12 * 32 + x] = 0;
    expect(place(s, 'pumpedhydro', 10, 10).ok).toBe(true);
    expect(place(s, 'pumpedhydro', 10, 3).ok).toBe(false);
  });
  it('offshore wind goes on sea tiles, not too far from shore, and unlocks in 2040', () => {
    const s = act2Sandbox(TileKind.Sea, { year: 2040 });
    paint(s, 0, 0, 5, 32, TileKind.Beach);
    expect(place(s, 'offshorewind', 6, 5).ok).toBe(true);
    const far = place(s, 'offshorewind', 20, 5);
    expect(far.ok).toBe(false);
    expect(far.reason).toMatch(/shore/);
    s.grid.kind[5 * 32 + 6] = TileKind.Land;
    expect(place(s, 'offshorewind', 6, 5).ok).toBe(false);
    const early = act2Sandbox(TileKind.Sea, { year: 2030 });
    paint(early, 0, 0, 5, 32, TileKind.Beach);
    const e = place(early, 'offshorewind', 6, 5);
    expect(e.ok).toBe(false);
    expect(e.code).toBe('locked');
    expect(e.reason).toMatch(/2040/);
  });
  it('rooftop solar must be next to homes', () => {
    const s = act2Sandbox(TileKind.Land);
    const none = place(s, 'rooftopsolar', 10, 10);
    expect(none.ok).toBe(false);
    expect(none.code).toBe('needs-nearby-building');
    expect(none.reason).toMatch(/homes/);
    addBuilding(s, 'suburb', 10, 11);
    expect(place(s, 'rooftopsolar', 10, 10).ok).toBe(true);
    addBuilding(s, 'cottage', 20, 20);
    expect(place(s, 'rooftopsolar', 21, 20).ok).toBe(true);
  });
  it('tidal turbines need the scenario to have a tidal resource', () => {
    const coast = act2Sandbox(TileKind.Sea, { year: 2040 });
    paint(coast, 0, 0, 6, 32, TileKind.Beach);
    const no = place(coast, 'tidal', 8, 5);
    expect(no.ok).toBe(false);
    expect(no.code).toBe('locked');
    expect(no.reason).toMatch(/tidal/);
    const city = act2Sandbox(TileKind.Sea, { year: 2040, scenario: 'net-zero-city' });
    paint(city, 0, 0, 6, 48, TileKind.Beach);
    expect(place(city, 'tidal', 8, 5).ok).toBe(true);
    expect(place(city, 'tidal', 30, 5).ok).toBe(false);
  });
  it('a sewage treatment plant can only be built on an existing outfall, and replaces it', () => {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 10, 0, 6, 32, TileKind.Sea);
    const bare = place(s, 'sewagetreatment', 9, 5);
    expect(bare.ok).toBe(false);
    expect(bare.reason).toMatch(/Sewage outfall/);
    const outfall = addBuilding(s, 'outfall', 9, 5);
    const r = applyAction(s, { type: 'place', building: 'sewagetreatment', x: 9, y: 5 });
    expect(r.result.ok).toBe(true);
    expect(r.state.buildings.some((b) => b.uid === outfall.uid)).toBe(false);
    expect(r.state.buildings.filter((b) => b.type === 'sewagetreatment')).toHaveLength(1);
    expect(r.state.buildings.filter((b) => b.type === 'outfall')).toHaveLength(0);
    expect(r.state.grid.building[5 * 32 + 9]).toBe(r.result.uid);
  });
  it('wetlands must be beside the river or estuary', () => {
    const s = act2Sandbox(TileKind.Land);
    expect(place(s, 'wetland', 10, 10).ok).toBe(false);
    paint(s, 0, 12, 32, 1, TileKind.River);
    expect(place(s, 'wetland', 10, 10).ok).toBe(true);
  });
  it('old industry is closed to new building during the transition', () => {
    const s = act2Sandbox(TileKind.Land);
    for (const id of ['coalpower', 'coalmine', 'steelworks', 'landfill', 'outfall', 'carpark', 'port', 'rail'] as const) {
      const c = place(s, id, 10, 10);
      expect(c.ok, id).toBe(false);
      expect(c.code, id).toBe('locked');
    }
    expect(place(s, 'cottage', 10, 10).ok).toBe(true);
    expect(place(s, 'factory', 10, 12).ok).toBe(true);
  });
  it('act2 buildings are not available during act1', () => {
    const a1 = act2Sandbox(TileKind.Land);
    a1.phase = 'act1';
    a1.year = 2020;
    const c = place(a1, 'solarfarm', 5, 5);
    expect(c.ok).toBe(false);
    expect(c.code).toBe('locked');
  });
  it('mature bushland is protected in act2', () => {
    const s = act2Sandbox(TileKind.Bush);
    const c = place(s, 'cottage', 5, 5);
    expect(c.ok).toBe(false);
    expect(c.reason).toMatch(/bushland/);
  });
  it('building over a restored tile resets it and bumps its chunk version', () => {
    const s = act2Sandbox(TileKind.Land);
    const i = 5 * 32 + 5;
    s.grid.health[i] = 0.5;
    s.grid.stage[i] = 2;
    const chunk = s.grid.chunkVersion[0] ?? 0;
    const r = applyAction(s, { type: 'place', building: 'nursery', x: 5, y: 5 });
    expect(r.result.ok).toBe(true);
    expect(r.state.grid.health[i]).toBe(0);
    expect(r.state.grid.stage[i]).toBe(0);
    const c = Math.floor(5 / 8) * 4 + Math.floor(5 / 8);
    expect(r.state.grid.chunkVersion[c]).toBe((s.grid.chunkVersion[c] ?? 0) + 1);
    expect(chunk).toBeGreaterThanOrEqual(0);
  });
});
