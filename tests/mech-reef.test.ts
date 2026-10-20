import { describe, expect, it } from 'vitest';
import {
  applyAction, buildRestoreCtx, EVENTS, eventApplies, eventChances, evaluateHabitat, makeCtx, mechBegin, mechMetric, policyCostPerYear, reefHealth,
  SPECIES_BY_ID, tick, TileKind,
} from '../src/sim';
import type { GameState } from '../src/sim';
import {
  cotsChance, protectionM, resortCount, seaLevelCm, seaRiseM, surgeHeightM, tourismIncome, tourismIndex, wouldFlood, wouldFloodBare,
} from '../src/sim/mechanics/reefCore';
import { act2Sandbox, addBuilding, paint } from './helpers/fixtures';
import { SURGE_GRACE_YEARS } from '../src/sim/mechanics/events';

/** A strip of island: sea on the left, beach, then low land (elevation 1) and higher land (2) to the right. */
function island(year = 2040): GameState {
  const s = act2Sandbox(TileKind.Land, { scenario: 'reef-island', year });
  paint(s, 0, 0, 6, 32, TileKind.Sea);
  paint(s, 6, 0, 1, 32, TileKind.Beach);
  paint(s, 0, 10, 4, 6, TileKind.Reef);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) s.grid.elevation[y * 32 + x] = x < 7 ? 0 : x < 12 ? 1 : 2;
  s.tempC = 1.2;
  s.a2.eqTempC = 1.2;
  mechBegin(s);
  return s;
}

describe('sea level', () => {
  it('rises with warming, and the rise since Act 2 began grows as the planet heats', () => {
    const s = island();
    expect(seaRiseM(s)).toBeCloseTo(0, 6);
    const cold = seaLevelCm(s);
    s.tempC = 2.2;
    s.a2.eqTempC = 2.6;
    expect(seaLevelCm(s)).toBeGreaterThan(cold + 25);
    expect(seaRiseM(s)).toBeGreaterThan(0.25);
    expect(mechMetric(s, 'seaRiseCm')).toBe(Math.round(seaRiseM(s) * 100));
  });
  it('also reflects warming that is committed but not here yet', () => {
    const s = island();
    const now = seaLevelCm(s);
    s.a2.eqTempC = 2.4;
    expect(seaLevelCm(s)).toBeGreaterThan(now);
  });
});

describe('storm surge and the homes on the low belt', () => {
  it('floods a low home with a big enough surge, and not a high one', () => {
    const s = island();
    const low = addBuilding(s, 'cottage', 8, 5);
    const high = addBuilding(s, 'cottage', 20, 5);
    const lowBig = addBuilding(s, 'suburb', 9, 20);
    expect(wouldFlood(s, low, surgeHeightM(0.4))).toBe(false);
    expect(wouldFlood(s, low, surgeHeightM(1.2))).toBe(true);
    expect(wouldFlood(s, high, surgeHeightM(1.5))).toBe(false); // inland, high, and far from the water
    expect(wouldFlood(s, lowBig, surgeHeightM(1.2))).toBe(true);
  });
  it('floods more as the sea rises', () => {
    const s = island();
    const home = addBuilding(s, 'cottage', 8, 5);
    const surge = surgeHeightM(0.6);
    expect(wouldFlood(s, home, surge)).toBe(false);
    s.tempC = 2.4;
    s.a2.eqTempC = 2.8;
    expect(wouldFlood(s, home, surge)).toBe(true);
  });
  it('is held back by a seawall, until a big surge goes over the top', () => {
    const s = island();
    const home = addBuilding(s, 'cottage', 8, 5);
    const bare = wouldFloodBare(s, home, surgeHeightM(1.0));
    expect(bare).toBe(true);
    addBuilding(s, 'seawall', 7, 5);
    expect(wouldFlood(s, home, surgeHeightM(1.0))).toBe(false);
    expect(protectionM(s, home, 1.0)).toBeCloseTo(1.0, 5);
    // A very big surge tops the wall: only partial protection.
    expect(protectionM(s, home, 2.4)).toBeLessThan(0.6);
    expect(wouldFlood(s, home, 2.4)).toBe(true);
  });
  it('is softened by healthy mangroves near the home, more with more of them', () => {
    const s = island();
    const home = addBuilding(s, 'cottage', 8, 5);
    const none = protectionM(s, home, 1);
    paint(s, 5, 5, 1, 4, TileKind.Estuary);
    for (let y = 5; y < 9; y++) { s.grid.stage[y * 32 + 5] = 3; s.grid.health[y * 32 + 5] = 0.9; }
    const some = protectionM(s, home, 1);
    paint(s, 5, 9, 1, 4, TileKind.Estuary);
    for (let y = 9; y < 13; y++) { s.grid.stage[y * 32 + 5] = 3; s.grid.health[y * 32 + 5] = 0.9; }
    const lots = protectionM(s, home, 1);
    expect(some).toBeGreaterThan(none);
    expect(lots).toBeGreaterThanOrEqual(some);
    expect(lots).toBeLessThanOrEqual(0.4 + 1e-9);
    // Dead mangroves protect nothing.
    for (let y = 5; y < 13; y++) { s.grid.stage[y * 32 + 5] = 1; s.grid.health[y * 32 + 5] = 0.2; }
    expect(protectionM(s, home, 1)).toBe(none);
  });
  it('in the first years of Act 2 a surge floods low homes but they can be repaired (a warning, not a loss)', () => {
    const s = island();
    s.year = s.a2.startYear;
    addBuilding(s, 'cottage', 8, 5);
    const def = EVENTS.find((e) => e.type === 'storm-surge');
    const fired = def?.fire(makeCtx(s, 0, null, buildRestoreCtx(s)), { next: () => 0.9, int: () => 1, state: () => 0 });
    expect(fired?.text).toMatch(/move people to higher ground/);
    expect(s.flags['r.homesLost'] ?? 0).toBe(0);
    expect(s.buildings.filter((b) => b.type === 'cottage')).toHaveLength(1);
  });
  it('destroys unprotected low homes when a storm-surge event fires, counts them, and costs money', () => {
    const s = island();
    s.year = s.a2.startYear + SURGE_GRACE_YEARS;
    s.budget = 200;
    addBuilding(s, 'cottage', 8, 5);
    addBuilding(s, 'cottage', 8, 8);
    addBuilding(s, 'cottage', 20, 5);
    const def = EVENTS.find((e) => e.type === 'storm-surge');
    const fired = def?.fire(makeCtx(s, 0, null, buildRestoreCtx(s)), { next: () => 0.9, int: () => 1, state: () => 0 });
    expect(fired?.text).toMatch(/Storm surge/);
    expect(s.flags['r.homesLost']).toBe(2);
    expect(s.buildings.filter((b) => b.type === 'cottage')).toHaveLength(1);
    expect(s.budget).toBeLessThan(200);
    expect(mechMetric(s, 'homesLost')).toBe(2);
  });
  it('does not destroy homes that a seawall protects, and says so', () => {
    const s = island();
    addBuilding(s, 'cottage', 8, 5);
    addBuilding(s, 'seawall', 7, 5);
    const def = EVENTS.find((e) => e.type === 'storm-surge');
    const fired = def?.fire(makeCtx(s, 0, null, buildRestoreCtx(s)), { next: () => 0.3, int: () => 1, state: () => 0 });
    expect(s.flags['r.homesLost'] ?? 0).toBe(0);
    expect(fired?.text).toMatch(/kept 1 home dry/);
  });
  it('replaces the general flood event on Reef Island, and is only there', () => {
    const flood = EVENTS.find((e) => e.type === 'flood');
    const surge = EVENTS.find((e) => e.type === 'storm-surge');
    expect(eventApplies(flood as (typeof EVENTS)[number], 'reef-island')).toBe(false);
    expect(eventApplies(flood as (typeof EVENTS)[number], 'coal-coast')).toBe(true);
    expect(eventApplies(surge as (typeof EVENTS)[number], 'reef-island')).toBe(true);
    expect(eventApplies(surge as (typeof EVENTS)[number], 'river-town')).toBe(false);
    const ch = eventChances(island());
    expect(ch.some((e) => e.type === 'flood')).toBe(false);
    expect(ch.find((e) => e.type === 'storm-surge')?.p).toBeGreaterThan(0);
  });
});

describe('tourism', () => {
  const withReef = (health: number, resorts: number): GameState => {
    const s = island();
    for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.Reef) s.grid.health[i] = health;
    for (let n = 0; n < resorts; n++) addBuilding(s, 'resort', 10, 2 + n * 3);
    return s;
  };
  it('follows the health of the reef', () => {
    expect(tourismIndex(withReef(0.9, 2))).toBeGreaterThan(tourismIndex(withReef(0.5, 2)) + 10);
    expect(tourismIndex(withReef(0.5, 2))).toBeGreaterThan(tourismIndex(withReef(0.05, 2)) + 10);
  });
  it('needs at least two resorts to count as an industry, and pays each resort in proportion to the index', () => {
    expect(resortCount(withReef(0.9, 1))).toBe(1);
    expect(tourismIndex(withReef(0.9, 1))).toBeCloseTo(tourismIndex(withReef(0.9, 2)) / 2, 0);
    expect(tourismIncome(withReef(0.9, 4))).toBeGreaterThan(tourismIncome(withReef(0.9, 2)) * 1.8);
    expect(tourismIncome(withReef(0.1, 4))).toBeLessThan(tourismIncome(withReef(0.9, 4)) * 0.8);
  });
  it('is lowered by a seawall along the beach, and the income reaches the budget at year end', () => {
    const a = withReef(0.9, 2);
    const b = withReef(0.9, 2);
    for (let y = 0; y < 16; y++) addBuilding(b, 'seawall', 6, y * 2);
    expect(tourismIndex(b)).toBeLessThan(tourismIndex(a) - 3);
    const rich = tick(withReef(0.9, 4), 1).state, poor = tick(withReef(0.05, 4), 1).state;
    expect(rich.lastIncome).toBeGreaterThan(poor.lastIncome + 5);
  });
});

describe('coral and crown-of-thorns starfish', () => {
  const cots = (s: GameState): number => eventChances(s).find((e) => e.type === 'crown-of-thorns')?.p ?? 0;
  it('are likelier when runoff feeds them, and less likely with divers culling', () => {
    const clean = island();
    clean.a2.season = 0;
    const dirty = island();
    dirty.a2.season = 0;
    for (let i = 0; i < dirty.grid.kind.length; i++) if (dirty.grid.kind[i] === TileKind.Reef) dirty.grid.waterPollution[i] = 1;
    expect(cots(dirty)).toBeGreaterThan(cots(clean) * 2);
    const culled = applyAction(dirty, { type: 'policy', id: 'cots.cull', value: 2 }).state;
    expect(cotsChance(culled, 0)).toBeLessThan(cotsChance(dirty, 0) * 0.45);
  });
  it('culling costs money every year, level by level', () => {
    const s = island();
    expect(policyCostPerYear(s)).toBe(0);
    const l1 = applyAction(s, { type: 'policy', id: 'cots.cull', value: 1 }).state;
    const l2 = applyAction(s, { type: 'policy', id: 'cots.cull', value: 2 }).state;
    expect(policyCostPerYear(l1)).toBe(5);
    expect(policyCostPerYear(l2)).toBe(10);
    const a = tick(s, 1).state, b = tick(l2, 1).state;
    expect(a.budget - b.budget).toBeGreaterThanOrEqual(9);
  });
  it('an outbreak keeps eating coral for a few seasons, less so with divers', () => {
    const run = (cull: number): number => {
      let s = island();
      for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.Reef) s.grid.health[i] = 0.8;
      s.flags['r.cots'] = 3;
      if (cull > 0) s = applyAction(s, { type: 'policy', id: 'cots.cull', value: cull }).state;
      s.tempC = 0;
      s.a2.eqTempC = 0;
      const out = tick(s, 0.75).state;
      let t = 0, n = 0;
      for (let i = 0; i < out.grid.kind.length; i++) if (out.grid.kind[i] === TileKind.Reef) { t += out.grid.health[i] ?? 0; n++; }
      return t / n;
    };
    expect(run(0)).toBeLessThan(0.8);
    expect(run(2)).toBeGreaterThan(run(0));
  });
  it('recovers better beside a coral nursery and tolerates some warming', () => {
    expect(reefHealth(1.2, 0, 0.45)).toBeGreaterThan(reefHealth(1.2, 0, 0));
    const a = island(), b = island();
    addBuilding(b, 'coralnursery', 4, 8);
    for (const s of [a, b]) {
      for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.Reef) s.grid.health[i] = 0.2;
      s.tempC = 1.6;
      s.a2.eqTempC = 1.6;
    }
    const meanReef = (s: GameState): number => {
      let t = 0, n = 0;
      for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.Reef) { t += s.grid.health[i] ?? 0; n++; }
      return t / n;
    };
    expect(meanReef(tick(b, 6).state)).toBeGreaterThan(meanReef(tick(a, 6).state) + 0.03);
  });
});

describe('turtles and the seawall', () => {
  it('treats a seawall as a light on the beach: it shrinks the dark part the turtle needs', () => {
    const spec = SPECIES_BY_ID['reef-turtle'];
    const a = island(), b = island();
    for (const s of [a, b]) {
      paint(s, 0, 0, 6, 32, TileKind.Sea);
      for (let y = 0; y < 32; y++) for (let x = 0; x < 6; x++) s.grid.health[y * 32 + x] = 0.9;
    }
    for (let y = 0; y < 30; y += 2) addBuilding(b, 'seawall', 6, y);
    const da = evaluateHabitat(a, spec as NonNullable<typeof spec>).extra.darkFrac ?? 0;
    const db = evaluateHabitat(b, spec as NonNullable<typeof spec>).extra.darkFrac ?? 0;
    expect(da).toBeGreaterThan(0.9);
    expect(db).toBeLessThan(da * 0.5);
  });
});
