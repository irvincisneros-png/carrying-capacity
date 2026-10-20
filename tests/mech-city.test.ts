import { describe, expect, it } from 'vitest';
import {
  applyAction, BUILDINGS, buildCity, cityCentre, CITY_ZONE, createGame, DEFAULT_CITY_MIX, deserialize, mechBegin, mechMetric, mechSeason,
  netZeroYear, serialize, societyMin, tick, TileKind, startAct2, balanceGrid,
} from '../src/sim';
import type { GameState, SimEvent } from '../src/sim';
import { canopyShare, coolingCoverage, HEAT, heatDeathsExpected, heatDeathsUnprotected } from '../src/sim/mechanics/heatCore';
import { carEmissionFactor, transitCoverage } from '../src/sim/mechanics/cityCore';
import { act2Sandbox, addBuilding } from './helpers/fixtures';

/** A flat built-up patch of the city with some people in it. */
function patch(pop = 4000): GameState {
  const s = act2Sandbox(TileKind.Land, { scenario: 'net-zero-city', year: 2030 });
  s.population = pop;
  mechBegin(s);
  return s;
}

const heatwave = (severity: number): SimEvent => ({
  id: 1, type: 'heatwave', year: 2030, season: 0, seasonIndex: 0, severity, text: 'Heatwave', data: {},
});

describe('heat health', () => {
  it('kills fewer people the more tree canopy and the more cooling centres the town has', () => {
    const bare = patch();
    for (let i = 0; i < bare.grid.kind.length; i++) bare.grid.stage[i] = 0;
    const shaded = patch();
    for (let i = 0; i < shaded.grid.kind.length; i++) { shaded.grid.stage[i] = 3; shaded.grid.health[i] = 0.9; }
    const cool = patch();
    for (let n = 0; n < 2; n++) addBuilding(cool, 'coolingcentre', 2 + n * 3, 2);
    const base = heatDeathsExpected(bare, 1, false);
    expect(base).toBeGreaterThan(0.5);
    expect(heatDeathsExpected(shaded, 1, false)).toBeLessThan(base * 0.4);
    expect(heatDeathsExpected(cool, 1, false)).toBeLessThan(base * 0.8);
    expect(heatDeathsUnprotected(bare, 1, false)).toBeCloseTo(base, 6);
  });
  it('is worse in a blackout and in a warmer world, and scales with severity and population', () => {
    const s = patch();
    const calm = heatDeathsExpected(s, 1, false);
    expect(heatDeathsExpected(s, 1, true)).toBeCloseTo(calm * HEAT.blackoutFactor, 6);
    expect(heatDeathsExpected(s, 1.5, false)).toBeCloseTo(calm * 1.5, 6);
    const crowd = patch(8000);
    expect(heatDeathsExpected(crowd, 1, false)).toBeCloseTo(calm * 2, 6);
    s.tempC = 2.5;
    expect(heatDeathsExpected(s, 1, false)).toBeGreaterThan(calm);
  });
  it('is only modelled in scenarios that ask for it', () => {
    const coal = act2Sandbox(TileKind.Land);
    expect(heatDeathsExpected(coal, 1, false)).toBe(0);
  });
  it('counts deaths when a heatwave event happens, keeps the fractions, and counts the lives that trees and centres saved', () => {
    const s = patch(6000);
    for (let i = 0; i < s.grid.kind.length; i++) { s.grid.stage[i] = 3; s.grid.health[i] = 0.9; }
    addBuilding(s, 'coolingcentre', 2, 2);
    const unprotected = heatDeathsUnprotected(s, 1, false);
    mechSeason(s, [heatwave(1)], 0);
    expect(s.flags['h.deaths'] ?? 0).toBeLessThan(unprotected);
    expect(s.flags['h.avoided']).toBeGreaterThanOrEqual(1);
    expect(s.a2.stress).toBeGreaterThanOrEqual(0);
    // Over many heatwaves the deaths add up to roughly the expected number, not zero from rounding.
    let total = 0;
    const t = patch(6000);
    for (let n = 0; n < 40; n++) mechSeason(t, [heatwave(0.5)], n);
    total = t.flags['h.deaths'] as number;
    expect(total).toBeGreaterThan(0.8 * 40 * heatDeathsExpected(t, 0.5, false) - 2);
    expect(mechMetric(t, 'heatDeaths')).toBe(total);
  });
  it('tells the story: sad when people die, glad when trees and centres saved them', () => {
    const sad = patch(9000);
    mechSeason(sad, [heatwave(1.2)], 0);
    expect(sad.eventLog.some((e) => /died in the heatwave/.test(e.text))).toBe(true);
    const glad = patch(9000);
    for (let i = 0; i < glad.grid.kind.length; i++) { glad.grid.stage[i] = 3; glad.grid.health[i] = 0.9; }
    for (let n = 0; n < 4; n++) addBuilding(glad, 'coolingcentre', 2 + n * 3, 2);
    mechSeason(glad, [heatwave(1.2)], 0);
    expect(glad.eventLog.some((e) => /Nobody died/.test(e.text))).toBe(true);
  });
  it('measures canopy from healthy plants and street-tree parks, which shade their neighbours', () => {
    const s = patch();
    const none = canopyShare(s);
    addBuilding(s, 'parkland', 10, 10);
    expect(canopyShare(s)).toBeGreaterThan(none);
    expect(coolingCoverage(s)).toBe(0);
    addBuilding(s, 'coolingcentre', 20, 20);
    expect(coolingCoverage(s)).toBeCloseTo((HEAT.centreCapacity) / s.population, 6);
    expect(mechMetric(s, 'canopyPct')).toBe(Math.round(canopyShare(s) * 100));
  });
});

describe('public transport', () => {
  it('cuts the emissions of the highways in proportion to how many people the lines serve', () => {
    const none = patch();
    addBuilding(none, 'carpark', 5, 5, 1);
    const lines = patch();
    addBuilding(lines, 'carpark', 5, 5, 1);
    for (let n = 0; n < 4; n++) addBuilding(lines, 'transitline', 10 + n * 2, 2);
    expect(transitCoverage(none)).toBe(0);
    expect(transitCoverage(lines)).toBeCloseTo(4 * 900 / 4000, 6);
    expect(carEmissionFactor(lines)).toBeCloseTo(1 - 0.7 * transitCoverage(lines), 6);
    const a = tick(none, 1).state, b = tick(lines, 1).state;
    const transport = (s: GameState): number => s.a2.yearly[0]?.emissionsKt.transport ?? 0;
    expect(transport(b)).toBeLessThan(transport(a) * 0.8 + BUILDINGS.transitline.co2 * 4 / 10);
    expect(mechMetric(lines, 'transitPct')).toBe(90);
  });
  it('cannot cover more than everyone', () => {
    const s = patch(900);
    for (let n = 0; n < 5; n++) addBuilding(s, 'transitline', 2 + n * 2, 2);
    expect(transitCoverage(s)).toBe(1);
    expect(carEmissionFactor(s)).toBeCloseTo(0.3, 6);
  });
});

describe('retrofitted homes', () => {
  it('replace a brick suburb, keep the housing and halve its energy use and emissions', () => {
    const s = patch();
    s.budget = 1000;
    const sub = addBuilding(s, 'suburb', 4, 4);
    const before = s.population;
    const r = applyAction(s, { type: 'place', building: 'greensuburb', x: sub.x, y: sub.y });
    expect(r.result.ok).toBe(true);
    expect(r.state.buildings.filter((b) => b.type === 'suburb')).toHaveLength(0);
    expect(r.state.buildings.filter((b) => b.type === 'greensuburb')).toHaveLength(1);
    expect(BUILDINGS.greensuburb.housing).toBe(BUILDINGS.suburb.housing);
    expect(BUILDINGS.greensuburb.power).toBeGreaterThan(BUILDINGS.suburb.power / 2 - 1);
    expect(BUILDINGS.greensuburb.co2).toBeLessThan(BUILDINGS.suburb.co2 / 3);
    expect(r.state.population).toBe(before);
    // A greensuburb can only be built on a suburb.
    expect(applyAction(s, { type: 'place', building: 'greensuburb', x: 20, y: 20 }).result.ok).toBe(false);
  });
});

describe('net zero, the society floor and the spending bonus', () => {
  it('finds the first year from which yearly emissions have stayed at or below the line (9999 if never)', () => {
    const s = patch();
    const rec = (year: number, kt: number, soc: number) => ({
      year, co2: 400, tempC: 1.3, eqTempC: 1.4, emissionsKt: { power: kt, industry: 0, transport: 0, land: 0, waste: 0 }, totalKt: kt,
      meters: { economy: 50, society: soc, environment: 50 }, budget: 0, population: 0, unmetFrac: 0, renewableShare: 0, estuaryHealth: 100, meanHealth: 0, reefHealth: 1,
    });
    expect(netZeroYear(s)).toBe(9999);
    s.a2.yearly = [rec(2031, 120, 80), rec(2032, 60, 75), rec(2033, 40, 55), rec(2034, 30, 70), rec(2035, 20, 90)];
    expect(netZeroYear(s)).toBe(2033);
    s.a2.yearly.push(rec(2036, 200, 90)); // a relapse resets the clock
    expect(netZeroYear(s)).toBe(9999);
    s.a2.yearly.push(rec(2037, 10, 90));
    expect(netZeroYear(s)).toBe(2037);
    // ...but a single small one-off spike between two years under the line (an old plant taken apart) does not
    s.a2.yearly.push(rec(2038, 70, 90), rec(2039, 10, 90));
    expect(netZeroYear(s)).toBe(2037);
    expect(societyMin(s)).toBe(55);
    expect(mechMetric(s, 'societyMin')).toBe(55);
    expect(mechMetric(s, 'netZeroYear')).toBe(2037);
  });
  it('counts what the town builds until 2050 against the "under budget" bonus, and no more', () => {
    const s = patch();
    s.budget = 1000;
    let r = applyAction(s, { type: 'place', building: 'rooftopsolar', x: 4, y: 4 });
    expect(r.result.ok).toBe(false); // no homes beside it
    const home = addBuilding(s, 'cottage', 4, 4);
    void home;
    r = applyAction(s, { type: 'place', building: 'rooftopsolar', x: 5, y: 4 });
    expect(r.result.ok).toBe(true);
    expect(mechMetric(r.state, 'capitalSpent')).toBe(8);
    const late = { ...r.state, year: 2060 };
    const r2 = applyAction(late, { type: 'place', building: 'rooftopsolar', x: 5, y: 5 });
    expect(mechMetric(r2.state, 'capitalSpent')).toBe(8);
  });
});

describe('the pre-built city', () => {
  const city = createGame('net-zero-city');
  it('starts in 2025 in Act 2, with the heatwave card ready and a finished, dense city', () => {
    expect(city.phase).toBe('act2');
    expect(city.year).toBe(2025);
    expect(city.turningPoint?.crisis).toBe('heatwave');
    expect(city.eventLog.some((e) => e.type === 'story' && /Forty-seven/.test(e.text))).toBe(true);
    const c: Record<string, number> = {};
    for (const b of city.buildings) c[b.type] = (c[b.type] ?? 0) + 1;
    expect(c.suburb).toBeGreaterThan(25);
    expect(c.road).toBeGreaterThan(150);
    expect(c.coalpower).toBe(DEFAULT_CITY_MIX.coal);
    expect(c.gaspower).toBe(DEFAULT_CITY_MIX.gas);
    expect(c.factory).toBe(DEFAULT_CITY_MIX.factories);
    expect(c.port).toBe(DEFAULT_CITY_MIX.ports);
    expect(c.steelworks).toBe(1);
    expect(c.carpark).toBeGreaterThanOrEqual(5);
    expect(city.population).toBeGreaterThan(3000);
  });
  it('is deterministic, and a different seed gives a different terrain', () => {
    const again = createGame('net-zero-city');
    expect(again.buildings.map((b) => `${b.type}@${b.x},${b.y}`)).toEqual(city.buildings.map((b) => `${b.type}@${b.x},${b.y}`));
    expect(serialize(again)).toBe(serialize(city));
    expect(Array.from(createGame('net-zero-city', 99).grid.kind)).not.toEqual(Array.from(city.grid.kind));
  });
  it('has legal buildings only: nothing on water, nothing overlapping, every uid on the grid', () => {
    const seen = new Set<number>();
    for (const b of city.buildings) {
      expect(seen.has(b.uid)).toBe(false);
      seen.add(b.uid);
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
        const k = city.grid.kind[y * city.grid.w + x];
        expect([TileKind.Land, TileKind.Bush, TileKind.Beach, TileKind.Rock, TileKind.Sea, TileKind.Estuary, TileKind.River]).toContain(k);
        expect(city.grid.building[y * city.grid.w + x]).toBe(b.uid);
      }
    }
    for (const u of city.grid.building) if (u !== 0) expect(seen.has(u)).toBe(true);
    for (const b of city.buildings) {
      if (['coalpower', 'gaspower', 'suburb', 'cottage', 'factory', 'steelworks', 'road', 'carpark', 'rail', 'landfill', 'farm'].includes(b.type)) {
        for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) expect([TileKind.Land, TileKind.Bush]).toContain(city.grid.kind[y * city.grid.w + x]);
      }
    }
  });
  it('puts the ports on the harbour, power stations by the water, and fills the zone layer', () => {
    for (const b of city.buildings.filter((o) => o.type === 'port')) {
      let sea = false;
      for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) {
        const k = city.grid.kind[y * city.grid.w + x];
        if (k === TileKind.Sea || k === TileKind.Reef) sea = true;
      }
      expect(sea).toBe(true);
    }
    const zones = new Set(Array.from(city.grid.zone));
    for (const z of [CITY_ZONE.cbd, CITY_ZONE.suburb, CITY_ZONE.industry, CITY_ZONE.port]) expect(zones.has(z)).toBe(true);
    const c = cityCentre(city);
    expect(c.x).toBeGreaterThan(10);
    expect(city.grid.zone[c.y * city.grid.w + c.x]).toBeGreaterThan(0);
  });
  it('starts with polluted air and soil around the industry, a grid that just holds, and a fossil-fuelled emissions profile', () => {
    let air = 0;
    for (const v of city.grid.airPollution) air = Math.max(air, v);
    expect(air).toBeGreaterThan(1);
    expect(city.meters.society).toBeGreaterThan(65);
    const season = balanceGrid(city, 0).report;
    expect(season.unmetFrac).toBeLessThan(0.02);
    const out = tick(city, 1).state;
    const y = out.a2.yearly[0];
    expect(y?.totalKt).toBeGreaterThan(150);
    expect(y?.totalKt).toBeLessThan(230);
    expect(y?.emissionsKt.power).toBeGreaterThan(60);
    expect(y?.renewableShare).toBeLessThan(0.15);
  });
  it('round-trips through a save and load', () => {
    const mid = tick(city, 3).state;
    const back = deserialize(serialize(mid));
    expect(back).not.toBeNull();
    expect(back?.buildings.length).toBe(mid.buildings.length);
    expect(Array.from(back?.grid.zone ?? [])).toEqual(Array.from(mid.grid.zone));
    expect(serialize(tick(back as GameState, 1).state)).toBe(serialize(tick(mid, 1).state));
  });
  it('can be rebuilt on a bare map (the generator is a pure function of the grid and seed)', () => {
    const fresh = createGame('net-zero-city');
    fresh.buildings = [];
    fresh.grid.building.fill(0);
    fresh.grid.zone.fill(0);
    fresh.nextUid = 1;
    buildCity(fresh);
    expect(fresh.buildings.length).toBeGreaterThan(200);
    void startAct2;
  });
});
