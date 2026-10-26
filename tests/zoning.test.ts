import { describe, expect, it } from 'vitest';
import {
  addFreeRoad, advanceDecade, advanceYear, applyAction, BUILDINGS, canPlace, cloneState, createGame, deserialize, economySnapshot,
  getScenario, roadAccess, serialize, TileKind, ZONE, ZONE_COST, zoneReasons, ZONE_REASON_TEXT, zoneProblem,
} from '../src/sim';
import type { GameState, ZoneKind } from '../src/sim';
import { addBuilding } from './helpers/fixtures';
import { emptyZoned, grownOf, keepZoned, zoneArea } from './helpers/zoning';
import { grow } from './helpers/sprawl';

/**
 * A flat 32 x 32 field of open land (Green Valley's map, cleared) with an entrance at the west edge (0, 10) and a street running
 * east along row 10 to (19, 10). Nothing else is built and there is plenty of money.
 */
function field(year = 1960, street = 19): GameState {
  const s = cloneState(createGame('green-valley'));
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
  for (let x = 0; x <= street; x++) addFreeRoad(s, 10 * g.w + x);
  s.flags['road.entrance'] = 10 * g.w;
  return s;
}

/** A building put down by the test (no rule checks), beside the street so it is connected. */
function jobs(s: GameState, type: 'factory' | 'farm' | 'coalpower', x: number, y = 11): void {
  addBuilding(s, type, x, y);
}

const years = (s0: GameState, n: number): GameState => {
  let s = s0;
  for (let i = 0; i < n && s.phase === 'act1'; i++) s = advanceYear(s).state;
  return s;
};

const zone = (s: GameState, x: number, y: number, w: number, h: number, z: ZoneKind) =>
  applyAction(s, { type: 'zone', x, y, w, h, zone: z });

describe('zoning rules', () => {
  it('costs about $0.3k a tile, scaled by the scenario budget multiplier, and dezoning is free', () => {
    const s = field();
    const mult = getScenario(s.scenarioId).modifiers.budgetMult;
    const r = zone(s, 2, 8, 5, 2, ZONE.rlow);
    expect(r.result.ok, r.result.reason).toBe(true);
    expect(r.result.spent).toBeCloseTo(10 * ZONE_COST * mult, 6);
    expect(r.state.budget).toBeCloseTo(s.budget - 10 * ZONE_COST * mult, 6);
    expect(r.result.count).toBe(10);
    // Painting the same zone again costs nothing; dezoning is free.
    const again = zone(r.state, 2, 8, 5, 2, ZONE.rlow);
    expect(again.result.spent ?? 0).toBe(0);
    const off = zone(r.state, 2, 8, 5, 2, ZONE.none);
    expect(off.result.ok).toBe(true);
    expect(off.state.budget).toBeCloseTo(r.state.budget, 6);
    expect(emptyZoned(off.state, ZONE.rlow)).toBe(0);
  });

  it('only zones land within 2 tiles of a road (Chebyshev distance)', () => {
    const s = field();
    // Row 10 is the street: rows 8 and 12 are two tiles away, rows 7 and 13 three.
    expect(zoneProblem(s, 5, 8, ZONE.rlow)).toBeNull();
    expect(zoneProblem(s, 5, 12, ZONE.rlow)).toBeNull();
    expect(zoneProblem(s, 21, 12, ZONE.rlow)).toBeNull(); // diagonal: 2 across and 2 down from the street's end at (19, 10)
    expect(zoneProblem(s, 5, 7, ZONE.rlow)).toMatch(/road/i);
    expect(zoneProblem(s, 5, 13, ZONE.rlow)).toMatch(/road/i);
    expect(zoneProblem(s, 22, 10, ZONE.rlow)).toMatch(/road/i);
    // A rectangle that reaches beyond the road zones only the tiles within reach.
    const r = zone(s, 3, 6, 2, 9, ZONE.com);
    expect(r.result.ok).toBe(true);
    expect(r.result.count).toBe(2 * 4); // rows 8, 9, 11 and 12 (row 10 is the road)
  });

  it('refuses water, rock, sacred places, contaminated soil, mine ground, buildings and roads', () => {
    const s = field();
    const g = s.grid;
    const at = (x: number, y: number): number => y * g.w + x;
    g.kind[at(3, 9)] = TileKind.River;
    g.kind[at(4, 9)] = TileKind.Wetland;
    g.kind[at(5, 9)] = TileKind.Rock;
    g.significant[at(6, 9)] = 1;
    g.soilContamination[at(7, 9)] = 0.7;
    g.soilContamination[at(8, 9)] = 0.5; // under the limit: fine
    jobs(s, 'farm', 10, 8);
    for (const [x, y] of [[3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [10, 9], [5, 10]] as [number, number][]) {
      expect(zoneProblem(s, x, y, ZONE.rlow), `${x},${y}`).not.toBeNull();
    }
    expect(zoneProblem(s, 8, 9, ZONE.rlow)).toBeNull();
    expect(zoneProblem(s, 7, 9, ZONE.rlow)).toMatch(/contaminated/i);
    // A rectangle of nothing but bad tiles fails with a reason.
    const bad = zone(s, 3, 9, 3, 1, ZONE.rlow);
    expect(bad.result.ok).toBe(false);
    expect(bad.result.reason).toBeTruthy();
  });

  it('allows zoning bush in Act 1 (cleared only when something grows) but not in Act 2', () => {
    const s = field();
    s.grid.kind[9 * s.grid.w + 4] = TileKind.Bush;
    expect(zoneProblem(s, 4, 9, ZONE.rlow)).toBeNull();
    const a2 = { ...s, phase: 'act2' as const };
    expect(zoneProblem(a2, 4, 9, ZONE.rlow)).toMatch(/bush/i);
  });

  it('density follows the era: medium homes from 1950, high-rise from 1970', () => {
    expect(zoneProblem(field(1900), 4, 9, ZONE.rmed)).toMatch(/1950/);
    expect(zoneProblem(field(1960), 4, 9, ZONE.rhigh)).toMatch(/1970/);
    expect(zoneProblem(field(1960), 4, 9, ZONE.rmed)).toBeNull();
    expect(zoneProblem(field(1970), 4, 9, ZONE.rhigh)).toBeNull();
  });

  it('cannot be built by hand: grown buildings come only from zones', () => {
    const s = field();
    for (const id of ['zres1', 'zres2', 'zres3', 'zcom', 'zind'] as const) {
      expect(canPlace(s, id, 4, 9).ok, id).toBe(false);
    }
  });

  it('dezoning a grown tile demolishes what grew there (no refund)', () => {
    let s = field();
    jobs(s, 'factory', 6);
    s = zoneArea(s, { x: 2, y: 8, w: 2, h: 2 }, ZONE.rlow);
    s = years(s, 2);
    const grown = s.buildings.filter((b) => b.grown);
    expect(grown.length).toBeGreaterThan(0);
    const b = grown[0]!;
    const before = s.budget;
    const r = zone(s, b.x, b.y, 1, 1, ZONE.none);
    expect(r.result.ok).toBe(true);
    expect(r.state.buildings.some((o) => o.uid === b.uid)).toBe(false);
    expect(r.state.grid.building[b.y * s.grid.w + b.x]).toBe(0);
    expect(r.state.grid.zoning[b.y * s.grid.w + b.x]).toBe(0);
    expect(r.state.budget).toBe(before);
  });
});

describe('growth', () => {
  it('grows homes where jobs are waiting, beside the road, as normal 1x1 buildings', () => {
    let s = field();
    jobs(s, 'factory', 6); // 60 jobs
    s = zoneArea(s, { x: 0, y: 8, w: 6, h: 2 }, ZONE.rlow);
    const s1 = years(s, 1);
    const grown = s1.buildings.filter((b) => b.grown);
    expect(grown.length).toBeGreaterThan(0);
    for (const b of grown) {
      expect(b.type).toBe('zres1');
      expect(b.w).toBe(1);
      expect(b.h).toBe(1);
      expect(s1.grid.building[b.y * s1.grid.w + b.x]).toBe(b.uid);
    }
    // They count as homes and are joined to the road (two tiles off the street is close enough).
    expect(economySnapshot(s1).housing).toBe(grown.length * BUILDINGS.zres1.housing);
    const acc = roadAccess(s1);
    for (const b of grown) expect(acc.connected.has(b.uid)).toBe(true);
    // Demand is about the 60 jobs plus a little: 3 or 4 low-density tiles, not the whole zone.
    const s5 = years(s1, 4);
    const homes = s5.buildings.filter((b) => b.type === 'zres1').length;
    expect(homes).toBeGreaterThanOrEqual(3);
    expect(homes).toBeLessThanOrEqual(5);
    expect(emptyZoned(s5, ZONE.rlow)).toBeGreaterThan(0);
  });

  it('grows shops from the people who live here', () => {
    let s = field();
    jobs(s, 'coalpower', 2);
    jobs(s, 'factory', 6);
    jobs(s, 'factory', 10);
    s = zoneArea(s, { x: 0, y: 8, w: 8, h: 2 }, ZONE.rmed);
    s = zoneArea(s, { x: 12, y: 8, w: 4, h: 2 }, ZONE.com);
    s = years(s, 8);
    expect(s.buildings.some((b) => b.type === 'zres2')).toBe(true);
    expect(s.buildings.some((b) => b.type === 'zcom')).toBe(true);
  });

  it('clears bush only when a building grows on it, through the clearing path (CO2 and Environment)', () => {
    let s = field();
    const g = s.grid;
    for (let x = 0; x < 6; x++) for (const y of [8, 9]) g.kind[y * g.w + x] = TileKind.Bush;
    jobs(s, 'factory', 8);
    s = zoneArea(s, { x: 0, y: 8, w: 6, h: 2 }, ZONE.rlow);
    // Zoning alone clears nothing.
    let bush = 0;
    for (const k of s.grid.kind) if (k === TileKind.Bush) bush++;
    expect(bush).toBe(12);
    const pend = s.pendingLandKt;
    s = years(s, 1);
    const grownOnBush = s.buildings.filter((b) => b.grown).length;
    expect(grownOnBush).toBeGreaterThan(0);
    let after = 0;
    for (const k of s.grid.kind) if (k === TileKind.Bush) after++;
    expect(after).toBe(12 - grownOnBush);
    expect(s.pendingLandKt).toBeGreaterThan(pend);
  });

  it('records why a zoned tile is not growing: no road, no power, no demand', () => {
    let s = field();
    // A stub of road nobody can reach: tiles beside it can be zoned but never grow.
    addFreeRoad(s, 25 * s.grid.w + 25);
    s = zoneArea(s, { x: 24, y: 24, w: 3, h: 1 }, ZONE.rlow);
    s = zoneArea(s, { x: 2, y: 8, w: 4, h: 1 }, ZONE.rlow);
    let r = zoneReasons(s);
    const at = (x: number, y: number): number => r[y * s.grid.w + x] ?? 0;
    expect(ZONE_REASON_TEXT[at(24, 24)]).toMatch(/road/i);
    // No jobs yet, but with no homes at all there is a small base demand: the tile is ready to grow.
    expect(ZONE_REASON_TEXT[at(2, 8)]).toMatch(/grow/i);
    // Fill the base demand: then the rest waits for jobs.
    s = years(s, 3);
    r = zoneReasons(s);
    const waiting = [2, 3, 4, 5].map((x) => r[8 * s.grid.w + x] ?? 0).filter((v, k) => (s.grid.building[8 * s.grid.w + 2 + k] ?? 0) === 0);
    expect(waiting.length).toBeGreaterThan(0);
    for (const v of waiting) expect(ZONE_REASON_TEXT[v]).toMatch(/no one needs|nobody needs|jobs/i);
    // Power: a big factory with no power station after the grid year. Homes wait for power once the off-grid allowance is used.
    let p = field(1960);
    for (const x of [6, 9, 12, 15]) jobs(p, 'factory', x);
    p = zoneArea(p, { x: 0, y: 8, w: 18, h: 2 }, ZONE.rlow);
    p = years(p, 3);
    const rp = zoneReasons(p);
    let noPower = 0;
    for (let i = 0; i < rp.length; i++) if ((rp[i] ?? 0) !== 0 && /power/i.test(ZONE_REASON_TEXT[rp[i] ?? 0] ?? '')) noPower++;
    expect(noPower).toBeGreaterThan(0);
    // Before the grid year nothing needs power.
    let early = field(1900);
    for (const x of [6, 9, 12, 15]) jobs(early, 'factory', x);
    early = zoneArea(early, { x: 0, y: 8, w: 18, h: 2 }, ZONE.rlow);
    early = years(early, 3);
    expect(grownOf(early)).toBeGreaterThan(grownOf(p));
  });

  it('a power station lets the waiting homes grow', () => {
    let s = field(1960);
    for (const x of [6, 9, 12, 15]) jobs(s, 'factory', x);
    s = zoneArea(s, { x: 0, y: 8, w: 18, h: 2 }, ZONE.rlow);
    const without = years(s, 4);
    const lit = cloneState(s);
    jobs(lit, 'coalpower', 2, 11);
    const withPower = years(lit, 4);
    expect(grownOf(withPower)).toBeGreaterThan(grownOf(without));
  });
});

describe('growth is deterministic', () => {
  const town = (): GameState => {
    let s = createGame('green-valley');
    s = keepZoned(s, ZONE.rlow, 12);
    s = keepZoned(s, ZONE.com, 3);
    return s;
  };
  it('the same seed and actions give an identical state', () => {
    const a = years(town(), 25);
    const b = years(town(), 25);
    expect(serialize(a)).toBe(serialize(b));
  });
  it('ten advanceYear calls equal one advanceDecade', () => {
    const s = town();
    const byYear = years(s, 10);
    const byDecade = advanceDecade(s).state;
    expect(serialize({ ...byYear, version: 0 })).toBe(serialize({ ...byDecade, version: 0 }));
  });
});

describe('decline', () => {
  it('a grown tile empties after 3 years without power, and recovers when power returns', () => {
    let s = field(1960);
    jobs(s, 'coalpower', 2, 11);
    for (const x of [6, 9, 12, 15]) jobs(s, 'factory', x);
    s = zoneArea(s, { x: 0, y: 8, w: 18, h: 2 }, ZONE.rlow);
    s = years(s, 5);
    const homes = s.buildings.filter((b) => b.grown).length;
    expect(homes).toBeGreaterThan(3);
    const housed = economySnapshot(s).housing;
    expect(housed).toBe(homes * 20);
    // The power station goes.
    const plant = s.buildings.find((b) => b.type === 'coalpower')!;
    s = applyAction(s, { type: 'demolish', x: plant.x, y: plant.y }).state;
    const y2 = years(s, 2);
    expect(y2.buildings.filter((b) => b.grown && b.empty).length).toBe(0);
    const y3 = years(s, 3);
    expect(y3.buildings.filter((b) => b.grown && b.empty).length).toBe(homes);
    expect(economySnapshot(y3).housing).toBe(0);
    // Power is back: the homes fill again at the next growth tick.
    const back = cloneState(y3);
    jobs(back, 'coalpower', 2, 11);
    const y4 = years(back, 1);
    expect(y4.buildings.filter((b) => b.grown && b.empty).length).toBe(0);
    expect(economySnapshot(y4).housing).toBeGreaterThanOrEqual(housed);
  });
});

describe('saves', () => {
  it('old saves (no zoning array, legacy cottages) load and play', () => {
    let s = createGame('green-valley');
    s = keepZoned(s, ZONE.rlow, 4);
    const raw = JSON.parse(serialize(s)) as Record<string, unknown> & { grid: Record<string, unknown>; flags: Record<string, unknown> };
    delete raw.grid.zoning;
    delete raw.flags.zoning;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded).not.toBeNull();
    expect(loaded!.grid.zoning.length).toBe(s.grid.w * s.grid.h);
    expect(loaded!.grid.zoning.every((z) => z === 0)).toBe(true);
    // Legacy homes still place in an old game and the decade still plays.
    const g = loaded!.grid;
    let placed = false;
    for (let i = 0; i < g.kind.length && !placed; i++) {
      const r = applyAction(loaded!, { type: 'place', building: 'cottage', x: i % g.w, y: Math.floor(i / g.w) });
      if (r.result.ok) placed = true;
    }
    expect(placed).toBe(true);
    expect(advanceDecade(loaded!).report).not.toBeNull();
  });
  it('new saves round-trip their zones and grown buildings', () => {
    let s = createGame('green-valley');
    s = keepZoned(s, ZONE.rlow, 8);
    s = keepZoned(s, ZONE.com, 2);
    s = years(s, 6);
    expect(grownOf(s)).toBeGreaterThan(0);
    const back = deserialize(serialize(s));
    expect(back).not.toBeNull();
    expect(Array.from(back!.grid.zoning)).toEqual(Array.from(s.grid.zoning));
    expect(back!.buildings.filter((b) => b.grown).length).toBe(grownOf(s));
    expect(serialize(back!)).toBe(serialize(s));
  });
  it('a new game marks itself as a zoning game (cottages and suburbs leave the build menu)', () => {
    expect(createGame('coal-coast').flags.zoning).toBe(1);
  });
});

describe('the sprawl lesson (Green Valley)', () => {
  /**
   * Two towns with the same jobs and power on the same bushland, with a street running in from the west edge: one zones nothing but
   * low-density homes along a long street, the other zones medium and high density with shops along a short one. Compared per
   * resident (the same jobs give close to the same population, but the shops add a few more people to the compact town).
   */
  it('an all low-density town clears at least 30% more bush per person and makes more commuting CO2 per person', () => {
    const sprawl = grow(false);
    const compact = grow(true);
    const transport = (s: GameState): number => s.history.slice(1).reduce((a, h) => a + h.emissionsKt.transport, 0);
    expect(sprawl.s.population).toBeGreaterThan(150);
    expect(compact.s.population).toBeGreaterThan(150);
    const perA = sprawl.bushLost / sprawl.s.population;
    const perB = compact.bushLost / compact.s.population;
    expect(perA).toBeGreaterThanOrEqual(1.3 * perB);
    expect(transport(sprawl.s) / sprawl.s.population).toBeGreaterThan(transport(compact.s) / compact.s.population);
  });
});
