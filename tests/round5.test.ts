import { describe, expect, it } from 'vitest';
import {
  advanceDecade, applyAction, assumeRoads, BUILDINGS, createGame, bestValue, netZeroOutlook, rehabPlan, rehabWatch, retirePlan, startAct2, stopgapPlan, tick, TileKind,
} from '../src/sim';
import type { BuildingId, GameState } from '../src/sim';
import { act2Sandbox, addBuilding, paint } from './helpers/fixtures';
import { bestSpot, place } from './helpers/act2play';
import { answerPrompts, capBudget, consultAll, queuePlan } from './helpers/scen';

describe('Red Dirt rehab guidance: seeded patches no nursery reaches are named', () => {
  function pit(): GameState {
    const s = act2Sandbox(TileKind.Land, { scenario: 'red-dirt', year: 2050 });
    s.grid.zone.fill(0);
    paint(s, 12, 12, 8, 4, TileKind.Pit);
    for (let y = 12; y < 16; y++) for (let x = 12; x < 20; x++) { s.grid.zone[y * 32 + x] = 1; s.grid.stage[y * 32 + x] = 2; }
    s.budget = 5000;
    s.country.partnership = 60;
    return s;
  }
  it('warns at the seeding step how much of the patch a nursery reaches, and flags the rest once seeded', () => {
    let s = pit();
    expect(rehabPlan(s, 13, 13)?.nurseryTiles).toBe(0);
    addBuilding(s, 'nursery', 8, 12);
    const plan = rehabPlan(s, 13, 13);
    expect(plan?.reach).toBe(5);
    expect(plan?.nurseryTiles).toBeGreaterThan(0);
    expect(plan?.nurseryTiles).toBeLessThan(plan?.tiles ?? 0);
    expect(rehabWatch(s).pit.length).toBe(32);
    s = applyAction(s, { type: 'rehab', x: 13, y: 13 }).state;
    const w = rehabWatch(s);
    expect(w.pit).toHaveLength(0);
    expect(w.stuck.length).toBe((plan?.tiles ?? 0) - (plan?.nurseryTiles ?? 0));
    expect(w.patches).toHaveLength(1);
    expect(w.patches[0]?.n).toBe(w.stuck.length);
    // A nursery beside the far end clears the warning.
    addBuilding(s, 'nursery', 20, 12);
    addBuilding(s, 'nursery', 14, 16);
    expect(rehabWatch(s).stuck).toHaveLength(0);
  });
});

describe('Red Dirt with no power station in Act 1', () => {
  function noPower(): GameState {
    const queue = [
      { id: 'farm', max: 2 }, { id: 'bore', max: 2 }, { id: 'coalmine', max: 2 }, { id: 'factory', max: 2 }, { id: 'rail', max: 3 },
      { id: 'landfill', max: 1 }, { id: 'coalmine', max: 3 }, { id: 'factory', max: 4 }, { id: 'carpark', max: 3 }, { id: 'farm', max: 3 },
    ] as const;
    const plan = queuePlan(queue as never, 1.0);
    let s = createGame('red-dirt');
    while (s.status === 'playing') { s = answerPrompts(consultAll(s), {}, 25); s = plan(s); s = advanceDecade(s).state; }
    return capBudget(s, 350);
  }
  const s0 = noPower();
  it('is detected before Act 2 and the opening budget covers the gas stations that keep the lights on', () => {
    const sg = stopgapPlan(s0);
    expect(sg).not.toBeNull();
    expect(sg?.stations).toBeGreaterThanOrEqual(1);
    const a = startAct2(s0);
    expect(a.flags['a2.stopgap']).toBe(sg?.stations);
    expect(a.budget).toBeGreaterThanOrEqual(BUILDINGS.gaspower.cost * (sg?.stations ?? 1));
  });
  it('a player who builds the stations first keeps Society up through year one (no blackout)', () => {
    let a = startAct2(s0);
    const n = a.flags['a2.stopgap'] as number;
    for (let i = 0; i < n; i++) {
      const p = place(a, 'gaspower' as BuildingId, bestSpot(a, 'gaspower' as BuildingId, () => 0));
      expect(p.ok).toBe(true);
      if (p.ok) a = p.state;
    }
    for (let y = 0; y < 3; y++) a = tick(a, 1).state;
    expect(a.phase).toBe('act2');
    expect(a.meters.society).toBeGreaterThan(30);
    expect(a.a2.lastGrid?.unmetFrac ?? 1).toBeLessThan(0.02);
  });
  it('does not fire for a town that built a power station', () => {
    const g = createGame('red-dirt');
    expect(stopgapPlan(assumeRoads({ ...g, buildings: [...g.buildings, { ...g.buildings[0]!, uid: 999, type: 'coalpower' }] }))).toBeNull();
  });
});

describe('Net Zero City: the retire-a-plant guidance names a recipe that works', () => {
  const start = tick(createGame('net-zero-city'), 0.25).state;
  it('is not safe at the start, and says roughly what to build first', () => {
    const t0 = Date.now();
    const rp = retirePlan(start);
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(rp?.type).toBe('coalpower');
    expect(rp?.safe).toBe(false);
    expect(rp?.open).toBe(false);
    expect((rp?.roof ?? 0) + (rp?.battery ?? 0)).toBeGreaterThan(0);
    expect(rp?.cost).toBeGreaterThan(0);
    expect(netZeroOutlook(start)?.retire?.uid).toBe(rp?.uid);
  });
  it('after building what it says (solar first, batteries when asked), the grid holds and the plant is safe to retire', () => {
    let s = { ...start, budget: 5000 };
    for (let round = 0; round < 6; round++) {
      const rp = retirePlan(s);
      if (!rp || rp.safe) break;
      for (let i = 0; i < rp.roof; i++) { const p = place(s, 'rooftopsolar', bestSpot(s, 'rooftopsolar', () => 0)); if (p.ok) s = p.state; }
      for (let i = 0; i < rp.battery; i++) { const p = place(s, 'battery', bestSpot(s, 'battery', () => 0)); if (p.ok) s = p.state; }
    }
    expect(retirePlan(s)?.safe).toBe(true);
  });
  it('has nothing to say once there is no fossil plant left', () => {
    const s = { ...start, buildings: start.buildings.filter((b) => b.type !== 'coalpower' && b.type !== 'gaspower') };
    expect(retirePlan(s)).toBeNull();
  });
});

describe('Net Zero City: the Goals panel names the best value per kt', () => {
  const start = tick(createGame('net-zero-city'), 0.25).state;
  it('lists the cheapest cuts first, with the cost per kt the build cards show', () => {
    const v = bestValue(start);
    expect(v.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < v.length; i++) expect(v[i - 1]!.perKt).toBeLessThanOrEqual(v[i]!.perKt);
    expect(v.every((r) => r.kt > 0 && r.cost > 0)).toBe(true);
    expect(netZeroOutlook(start)?.value).toEqual(v);
  });
  it('offers turning a factory into a recycling plant once Old sites is open', () => {
    const open = { ...start, circular: { ...start.circular, unlocked: true } };
    const v = bestValue(open, 8);
    expect(v.some((r) => /recycling plant/.test(r.label))).toBe(true);
  });
});
