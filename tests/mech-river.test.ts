import { describe, expect, it } from 'vitest';
import {
  applyAction, eventChances, mechBegin, mechMetric, policyValue, tick, TileKind, EVENTS, eventApplies, makeCtx, buildRestoreCtx,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { allocation, farmDemand, RIVER, riverHealth, storageCapacity, townDemand, weirTileIdx, hasFishway } from '../src/sim/mechanics/riverCore';
import { act2Sandbox, addBuilding, paint } from './helpers/fixtures';

/** A tiny river town: a river across the middle, farmland on both sides, in 2041 (the failure count starts then). */
function town(opts: { pop?: number; farms?: number; year?: number } = {}): GameState {
  const s = act2Sandbox(TileKind.Land, { scenario: 'river-town', year: opts.year ?? 2041 });
  paint(s, 0, 14, 32, 3, TileKind.River);
  for (let i = 0; i < s.grid.kind.length; i++) s.grid.elevation[i] = s.grid.kind[i] === TileKind.River ? 0 : 2;
  for (let n = 0; n < (opts.farms ?? 4); n++) addBuilding(s, 'farm', 2 + (n % 7) * 4, 4 + Math.floor(n / 7) * 4);
  s.population = opts.pop ?? 800;
  mechBegin(s);
  return s;
}

/** Run seasons with weather forced: a drought for `seasons` seasons from now. */
function withDrought(s: GameState, seasons: number): GameState {
  const idx = (s.year - 1880) * 4 + s.a2.season;
  s.a2.active.push({ type: 'drought', endsAt: idx + seasons, severity: 1 });
  return s;
}

describe('water allocation (a policy lever)', () => {
  it('starts at the historic over-allocation: town 15%, river 20%, farms the rest', () => {
    const s = town();
    expect(allocation(s)).toEqual({ town: 0.15, env: 0.2, farms: expect.closeTo(0.65, 9) });
  });
  it('can be changed in Act 2, snaps to the step, and must leave the farms 5%', () => {
    let s = town();
    let r = applyAction(s, { type: 'policy', id: 'alloc.town', value: 0.32 });
    expect(r.result.ok).toBe(true);
    s = r.state;
    expect(policyValue(s, 'alloc.town')).toBeCloseTo(0.3, 9);
    r = applyAction(s, { type: 'policy', id: 'alloc.env', value: 0.7 });
    expect(r.result.ok).toBe(false);
    expect(r.result.reason).toMatch(/at least 5%/);
    expect(applyAction(s, { type: 'policy', id: 'alloc.env', value: 0.9 }).result.ok).toBe(false);
    expect(applyAction(s, { type: 'policy', id: 'nope', value: 1 }).result.code).toBe('invalid');
    expect(applyAction(s, { type: 'policy', id: 'alloc.town', value: Number.NaN }).result.ok).toBe(false);
  });
  it('is not available in Act 1 or in a scenario without that lever', () => {
    const a1 = { ...town(), phase: 'act1' as const };
    expect(applyAction(a1, { type: 'policy', id: 'alloc.town', value: 0.3 }).result.ok).toBe(false);
    const coal = act2Sandbox(TileKind.Land);
    expect(applyAction(coal, { type: 'policy', id: 'alloc.town', value: 0.3 }).result.code).toBe('invalid');
  });
});

describe('the town\'s water in a drought', () => {
  it('fails when the town share is too small to cover its need and the storage runs out, and only counts after 2040', () => {
    const dry = withDrought(town({ pop: 1200 }), 12);
    const out = tick(dry, 3).state;
    expect(out.flags['w.townFail']).toBeGreaterThan(0);
    expect(out.eventLog.some((e) => e.type === 'story' && /Town water restrictions/.test(e.text))).toBe(true);
    const early = withDrought(town({ pop: 1200, year: 2030 }), 12);
    const e2 = tick(early, 3).state;
    expect(e2.flags['w.townFail'] ?? 0).toBe(0);
    expect(e2.flags['w.townFailAll']).toBeGreaterThan(0);
  });
  it('is kept safe by a bigger share, by reservoirs, and by water-saving rules', () => {
    const base = (): GameState => withDrought(town({ pop: 1200 }), 12);
    const failures = (s: GameState): number => tick(s, 3).state.flags['w.townFail'] as number ?? 0;
    const bad = failures(base());
    expect(bad).toBeGreaterThan(0);
    const bigShare = applyAction(base(), { type: 'policy', id: 'alloc.town', value: 0.4 }).state;
    expect(failures(bigShare)).toBeLessThan(bad);
    const withStore = base();
    addBuilding(withStore, 'reservoir', 20, 8);
    addBuilding(withStore, 'reservoir', 24, 8);
    mechBegin(withStore);
    expect(storageCapacity(withStore)).toBeCloseTo(RIVER.baseStorage + 2 * RIVER.reservoirStorage, 9);
    expect(failures(withStore)).toBeLessThan(bad);
    const saving = base();
    saving.flags['w.saving'] = 1;
    expect(townDemand(saving, 0)).toBeLessThan(townDemand(base(), 0));
    expect(failures(saving)).toBeLessThan(bad);
  });
  it('does not fail in a normal year at the default share, for a town of a few hundred', () => {
    const s = town({ pop: 450 });
    const out = tick(s, 4).state;
    expect(out.flags['w.townFailAll'] ?? 0).toBe(0);
  });
});

describe('what is left in the river', () => {
  it('shrinks when farms take their whole share and recovers with efficient farms', () => {
    const thirsty = town({ farms: 10 });
    const efficient = town({ farms: 10 });
    for (const b of efficient.buildings.filter((o) => o.type === 'farm')) {
      const r = applyAction(efficient, { type: 'place', building: 'dripfarm', x: b.x, y: b.y });
      expect(r.result.ok).toBe(true);
      efficient.buildings = r.state.buildings;
      efficient.grid.building.set(r.state.grid.building);
      efficient.budget = r.state.budget;
    }
    withDrought(thirsty, 8);
    withDrought(efficient, 8);
    expect(farmDemand(efficient, 0)).toBeLessThan(farmDemand(thirsty, 0) * 0.7);
    const a = tick(thirsty, 3).state, b = tick(efficient, 3).state;
    expect(b.flags['w.envAvg'] as number).toBeGreaterThanOrEqual(a.flags['w.envAvg'] as number);
    // Efficient farms get more of what they need from the same share of a thin river.
    expect(b.flags['w.yield'] as number).toBeGreaterThan(a.flags['w.yield'] as number);
  });
  it('is kept for the river by a bigger environmental share', () => {
    const lo = withDrought(town({ farms: 10 }), 8);
    const hi = withDrought(applyAction(town({ farms: 10 }), { type: 'policy', id: 'alloc.env', value: 0.5 }).state, 8);
    expect(tick(hi, 2).state.flags['w.envAvg'] as number).toBeGreaterThan(tick(lo, 2).state.flags['w.envAvg'] as number);
  });
});

describe('salt on irrigated land', () => {
  const saltOf = (s: GameState): number => {
    let t = 0, n = 0;
    for (const b of s.buildings.filter((o) => o.type === 'farm' || o.type === 'dripfarm')) {
      for (let y = b.y - 2; y < b.y + b.h + 2; y++) for (let x = b.x - 2; x < b.x + b.w + 2; x++) {
        const i = y * s.grid.w + x;
        if (s.grid.building[i] === 0 && s.grid.kind[i] === TileKind.Land) { t += s.grid.soilContamination[i] ?? 0; n++; }
      }
    }
    return t / n;
  };
  it('builds up around farms over the years, and much less around efficient ones', () => {
    const a = town({ farms: 4 });
    const b = town({ farms: 0 });
    for (let n = 0; n < 4; n++) {
      addBuilding(b, 'dripfarm', 2 + n * 4, 4);
    }
    const sa = saltOf(tick(a, 6).state), sb = saltOf(tick(b, 6).state);
    expect(sa).toBeGreaterThan(0.01);
    expect(sb).toBeLessThan(sa * 0.6);
  });
  it('is flushed from land beside the river by a strong spring flow', () => {
    const s = town({ farms: 0 });
    for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.Land) s.grid.soilContamination[i] = 1;
    s.a2.season = 3;
    const out = tick(s, 0.25).state;
    const idx = 12 * out.grid.w + 5; // beside the river
    const far = 2 * out.grid.w + 5;
    expect(out.grid.soilContamination[idx] as number).toBeLessThan(out.grid.soilContamination[far] as number);
  });
});

describe('river health and its parts', () => {
  it('is 100 for a clean, flowing, planted river and falls with pollution, a missing fishway and an algae bloom', () => {
    const s = town({ farms: 0 });
    // The weir: raise the river tiles in one column.
    for (let y = 14; y < 17; y++) s.grid.elevation[y * s.grid.w + 16] = 1;
    for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.Land && i % s.grid.w > 0) { s.grid.stage[i] = 3; s.grid.health[i] = 0.9; }
    expect(weirTileIdx(s)).toHaveLength(3);
    const noFishway = riverHealth(s);
    expect(noFishway).toBeLessThan(94);
    addBuilding(s, 'fishway', 16, 15);
    expect(hasFishway(s)).toBe(true);
    const clean = riverHealth(s);
    expect(clean).toBeGreaterThan(noFishway + 5);
    expect(clean).toBeGreaterThan(95);
    for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.River) s.grid.waterPollution[i] = 1;
    expect(riverHealth(s)).toBeLessThan(clean - 8);
    s.flags['w.damage'] = 1;
    expect(riverHealth(s)).toBeLessThan(clean - 20);
    expect(mechMetric(s, 'riverHealth')).toBe(riverHealth(s));
  });
  it('depends on the long-run flow the river has kept', () => {
    const s = town({ farms: 0 });
    for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.Land) { s.grid.stage[i] = 3; s.grid.health[i] = 0.9; }
    s.flags['w.envAvg'] = 1;
    const full = riverHealth(s);
    s.flags['w.envAvg'] = 0.4;
    expect(riverHealth(s)).toBeLessThan(full - 15);
  });
});

describe('blue-green algae blooms', () => {
  const bloomP = (s: GameState): number => eventChances(s).find((e) => e.type === 'algal-bloom')?.p ?? 0;
  it('are likelier in hot summers over a polluted, slow river than over a clean, flowing one', () => {
    const clean = town({ farms: 0 });
    clean.tempC = 1.5;
    clean.flags['w.envRatio'] = 1.3;
    const dirty = town({ farms: 0 });
    dirty.tempC = 1.5;
    dirty.flags['w.envRatio'] = 0.2;
    for (let i = 0; i < dirty.grid.kind.length; i++) if (dirty.grid.kind[i] === TileKind.River) dirty.grid.waterPollution[i] = 1.2;
    expect(bloomP(dirty)).toBeGreaterThan(bloomP(clean) * 3);
    const winter = { ...dirty, a2: { ...dirty.a2, season: 2 as const } };
    expect(bloomP(winter)).toBe(0);
  });
  it('only happen in River Town', () => {
    const def = EVENTS.find((e) => e.type === 'algal-bloom');
    expect(def).toBeDefined();
    expect(eventApplies(def as (typeof EVENTS)[number], 'river-town')).toBe(true);
    expect(eventApplies(def as (typeof EVENTS)[number], 'coal-coast')).toBe(false);
    const coal = act2Sandbox(TileKind.Land);
    expect(eventChances(coal).some((e) => e.type === 'algal-bloom')).toBe(false);
  });
  it('damage the river, cost the town money and stress it when they fire', () => {
    const s = town({ farms: 0 });
    s.budget = 100;
    const def = EVENTS.find((e) => e.type === 'algal-bloom');
    const ctx = makeCtx(s, 0, null, buildRestoreCtx(s));
    const fired = def?.fire(ctx, { next: () => 0.5, int: () => 1, state: () => 0 });
    expect(fired?.text).toMatch(/algae/i);
    expect(s.flags['w.damage'] as number).toBeGreaterThan(0.25);
    expect(s.budget).toBeLessThan(100);
    expect(s.a2.stress).toBeGreaterThan(3);
  });
});

describe('billabongs and the frogs', () => {
  it('fill in a generous spring and dry out in summer', () => {
    const s = town({ farms: 0 });
    s.flags['w.wet'] = 0.2;
    s.a2.season = 3;
    const spring = tick(s, 0.25).state;
    expect(spring.flags['w.wet'] as number).toBeGreaterThan(0.5);
    const summer = tick({ ...spring, a2: { ...spring.a2, season: 0 as const } }, 0.25).state;
    expect(summer.flags['w.wet'] as number).toBeLessThan(spring.flags['w.wet'] as number);
  });
});

describe('the drought plan (a policy lever)', () => {
  const plan = (s: GameState): GameState => applyAction(s, { type: 'policy', id: 'drought.plan', value: 1 }).state;
  it('banks wet-season water only from flow above the river\'s own share, up to the cap', () => {
    const s = plan(town({ farms: 2 }));
    const out = tick(s, 2).state;
    expect(out.flags['w.bank']).toBeGreaterThan(0);
    expect(out.flags['w.bank']).toBeLessThanOrEqual(RIVER.bankCap);
    expect(tick(town({ farms: 2 }), 2).state.flags['w.bank'] ?? 0).toBe(0);
  });
  it('in a drought, restricts town and farm demand and lets the banked water reach the farms', () => {
    const s = plan(town());
    expect(townDemand(withDrought(s, 4), 0, true)).toBeCloseTo(townDemand(s, 0) * RIVER.droughtTown, 6);
    expect(farmDemand(s, 0, true)).toBeCloseTo(farmDemand(s, 0) * RIVER.droughtFarm, 6);
    expect(farmDemand(town(), 0, true)).toBeCloseTo(farmDemand(town(), 0), 6);
    s.flags['w.bank'] = RIVER.bankCap;
    const dry = withDrought(s, 8);
    const out = tick(dry, 1).state;
    expect(out.flags['w.bank']).toBeLessThan(RIVER.bankCap);
    // The plan's yield beats the same drought without it.
    const off = tick(withDrought(town(), 8), 1).state;
    expect(out.flags['w.yield']).toBeGreaterThan(off.flags['w.yield'] as number);
  });
  it('costs money every year it is on', () => {
    const s = plan(town());
    const before = s.budget;
    const out = tick(s, 1).state;
    const offOut = tick(town(), 1).state;
    expect(before - out.budget).toBeGreaterThan(before - offOut.budget);
  });
});
