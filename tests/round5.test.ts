import { describe, expect, it } from 'vitest';
import {
  advanceDecade, applyAction, BUILDINGS, createGame, rehabPlan, rehabWatch, startAct2, stopgapPlan, tick, TileKind,
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
    expect(stopgapPlan({ buildings: [...g.buildings, { ...g.buildings[0]!, type: 'coalpower' }] })).toBeNull();
  });
});
