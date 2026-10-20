import { describe, expect, it } from 'vitest';
import {
  advanceDecade, applyAction, createGame, deserialize, mechBegin, mechMetric, mechYear, rehabPlan, seasonIndexOf, serialize, startAct2, tick, TileKind,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { OUTBACK, aquifer, minesOpen, rehabPct, siteTiles, townWaterDemand } from '../src/sim/mechanics/outbackCore';
import { act2Sandbox, addBuilding, paint } from './helpers/fixtures';

/** Red plains with a waterhole and a 6x6 pit marked as the mine site. */
function outback(opts: { year?: number; pop?: number; mines?: number; bores?: number; waterhole?: number } = {}): GameState {
  const s = act2Sandbox(TileKind.Land, { scenario: 'red-dirt', year: opts.year ?? 2041 });
  paint(s, 2, 2, 3, 3, TileKind.Wetland);
  s.grid.zone.fill(0);
  paint(s, 12, 12, 6, 6, TileKind.Pit);
  for (let y = 12; y < 18; y++) for (let x = 12; x < 18; x++) { s.grid.zone[y * 32 + x] = 1; s.grid.stage[y * 32 + x] = 0; }
  for (let n = 0; n < (opts.mines ?? 0); n++) addBuilding(s, 'coalmine', 20 + n * 3, 4);
  for (let n = 0; n < (opts.bores ?? 0); n++) addBuilding(s, 'bore', 5 + n, 8);
  s.population = opts.pop ?? 500;
  mechBegin(s);
  s.flags['o.wh'] = opts.waterhole ?? 0.6;
  return s;
}

const drought = (s: GameState, seasons = 400): GameState => {
  s.a2.active.push({ type: 'drought', endsAt: seasonIndexOf(s) + seasons, severity: 1 });
  return s;
};

describe('water in the outback', () => {
  it('is fed by a waterhole that shrinks in drought, and runs short with no bores in a dry spell', () => {
    const s = drought(outback({ waterhole: 0.05 }));
    s.flags['o.store'] = 0;
    const out = tick(s, 3).state;
    expect(out.flags['o.waterFail']).toBeGreaterThan(0);
    expect(out.eventLog.some((e) => /Water emergency/.test(e.text))).toBe(true);
    expect(mechMetric(out, 'waterFailures')).toBe(out.flags['o.waterFail']);
  });
  it('only counts failures after 2040 against the objective', () => {
    const early = drought(outback({ year: 2030, waterhole: 0.05 }));
    early.flags['o.store'] = 0;
    const out = tick(early, 3).state;
    expect(out.flags['o.waterFail'] ?? 0).toBe(0);
    expect(out.flags['o.waterFailAll']).toBeGreaterThan(0);
  });
  it('is rescued by bores, which draw down the aquifer instead', () => {
    const s = drought(outback({ waterhole: 0.05, bores: 3 }));
    s.flags['o.store'] = 0;
    const out = tick(s, 3).state;
    expect(out.flags['o.waterFail'] ?? 0).toBe(0);
    const noBores = drought(outback({ waterhole: 0.05 }));
    noBores.flags['o.store'] = 0;
    expect(aquifer(out)).toBeLessThan(aquifer(tick(noBores, 3).state) - 0.5);
  });
  it('is used up fastest by a working mine, and recovers once the mine is closed', () => {
    const mining = outback({ mines: 3, bores: 4, waterhole: 0.2 });
    const quiet = outback({ mines: 0, bores: 4, waterhole: 0.2 });
    expect(townWaterDemand(mining, 0, 0)).toBeGreaterThan(townWaterDemand(quiet, 0, 0) * 2);
    const a = tick(mining, 5).state, b = tick(quiet, 5).state;
    expect(aquifer(a)).toBeLessThan(aquifer(b));
    expect(aquifer(a)).toBeLessThan(OUTBACK.startAquifer - 5);
  });
  it('is stretched by restrictions and water-saving, which cost patience', () => {
    const base = outback();
    const restricted = applyAction(base, { type: 'policy', id: 'water.restrict', value: 2 }).state;
    expect(townWaterDemand(restricted, 0, 2)).toBeCloseTo(townWaterDemand(base, 0, 0) * 0.75, 6);
    const saving = outback();
    saving.flags['o.saving'] = 1;
    expect(townWaterDemand(saving, 0, 0)).toBeCloseTo(townWaterDemand(base, 0, 0) * 0.8, 6);
    const a = tick(base, 0.75).state, b = tick(restricted, 0.75).state;
    expect(b.a2.stressSum).toBeGreaterThan(a.a2.stressSum);
  });
  it('is buffered by a water store that fills from spare waterhole', () => {
    const s = outback({ waterhole: 1 });
    addBuilding(s, 'reservoir', 8, 8);
    s.flags['o.store'] = 0;
    const out = tick(s, 2).state;
    expect(out.flags['o.store'] as number).toBeGreaterThan(0.3);
  });
});

describe('rehabilitating the mine site (a staged job)', () => {
  it('lists the next step, its cost and why it cannot start yet', () => {
    const s = outback({ mines: 1 });
    const plan = rehabPlan(s, 14, 14);
    expect(plan?.name).toBe('Reshape the pit');
    expect(plan?.tiles).toBe(36);
    expect(plan?.cost).toBe(Math.round(36 * OUTBACK.stageCost[0]));
    expect(plan?.reason).toMatch(/Close the mine/);
    expect(rehabPlan(s, 0, 0)).toBeNull();
  });
  it('refuses to start while a mine is working, and when the town cannot pay', () => {
    const s = outback({ mines: 1 });
    expect(applyAction(s, { type: 'rehab', x: 14, y: 14 }).result.code).toBe('not-open');
    const closed = outback();
    closed.budget = 5;
    expect(applyAction(closed, { type: 'rehab', x: 14, y: 14 }).result.code).toBe('no-funds');
    const act1 = { ...outback(), phase: 'act1' as const };
    expect(applyAction(act1, { type: 'rehab', x: 14, y: 14 }).result.ok).toBe(false);
    const coal = act2Sandbox(TileKind.Land);
    expect(applyAction(coal, { type: 'rehab', x: 14, y: 14 }).result.code).toBe('not-open');
  });
  it('goes reshape, topsoil, seed, one patch at a time, spending money and (for reshaping) emitting carbon', () => {
    let s = outback();
    s.budget = 1000;
    s.grid.soilContamination.fill(2);
    s.country.partnership = 50;
    const kt0 = s.pendingLandKt;
    let r = applyAction(s, { type: 'rehab', x: 14, y: 14 });
    expect(r.result.ok).toBe(true);
    s = r.state;
    expect(s.grid.stage[14 * 32 + 14]).toBe(1);
    expect(s.grid.kind[14 * 32 + 14]).toBe(TileKind.Pit);
    expect(s.pendingLandKt).toBeGreaterThan(kt0 + 30);
    expect(s.budget).toBeLessThan(1000 - 80);
    // The step after is topsoil, which cleans the ground.
    expect(rehabPlan(s, 14, 14)?.name).toBe('Spread topsoil');
    r = applyAction(s, { type: 'rehab', x: 14, y: 14 });
    s = r.state;
    expect(s.grid.stage[14 * 32 + 14]).toBe(2);
    expect(s.grid.soilContamination[14 * 32 + 14] as number).toBeLessThan(1);
    // Seeding turns the pit into land with seedlings, marked with the year.
    expect(rehabPlan(s, 14, 14)?.name).toBe('Seed with local plants');
    r = applyAction(s, { type: 'rehab', x: 14, y: 14 });
    s = r.state;
    const i = 14 * 32 + 14;
    expect(s.grid.kind[i]).toBe(TileKind.Land);
    expect(s.grid.health[i]).toBeGreaterThan(0.05);
    expect(s.grid.zone[i]).toBe(100 + (s.year - 2000));
    expect(s.residents.actions['rehab.0']).toBe(1);
    expect(siteTiles(s).seeded).toBe(36);
  });
  it('waits for the Traditional Owners before seeding: trust has to be built first', () => {
    let s = outback();
    s.budget = 1000;
    s.country.partnership = 10;
    s = applyAction(s, { type: 'rehab', x: 14, y: 14 }).state;
    s = applyAction(s, { type: 'rehab', x: 14, y: 14 }).state;
    const plan = rehabPlan(s, 14, 14);
    expect(plan?.reason).toMatch(/Traditional Owners/);
    expect(applyAction(s, { type: 'rehab', x: 14, y: 14 }).result.code).toBe('not-open');
    s.country.partnership = OUTBACK.seedPartnership;
    expect(applyAction(s, { type: 'rehab', x: 14, y: 14 }).result.ok).toBe(true);
  });
  it('is signed off after five years of good growth, with the Traditional Owners\' agreement', () => {
    const s = outback({ year: 2050 });
    const z = 100 + (2050 - 2000) - 6; // seeded six years ago
    for (let y = 12; y < 18; y++) for (let x = 12; x < 18; x++) {
      const i = y * 32 + x;
      s.grid.kind[i] = TileKind.Land;
      s.grid.zone[i] = z;
      s.grid.health[i] = 0.6;
      s.grid.stage[i] = 2;
    }
    s.country.partnership = 30; // not enough to sign off
    const out = s;
    mechYear(out);
    expect(rehabPct(out)).toBe(0);
    out.country.partnership = OUTBACK.signoffPartnership;
    mechYear(out);
    expect(rehabPct(out)).toBe(100);
    expect(out.eventLog.some((e) => /signed .* off/.test(e.text) && e.story?.needsConsultation)).toBe(true);
    // Signed-off ground stays signed off.
    expect(siteTiles(out).signed).toBe(36);
  });
  it('is not signed off while the ground is bare, weedy, poisoned or too young', () => {
    const base = (): GameState => {
      const s = outback({ year: 2050 });
      for (let y = 12; y < 18; y++) for (let x = 12; x < 18; x++) {
        const i = y * 32 + x;
        s.grid.kind[i] = TileKind.Land;
        s.grid.zone[i] = 100 + (2050 - 2000) - 6;
        s.grid.health[i] = 0.6;
        s.grid.stage[i] = 2;
      }
      s.country.partnership = 100;
      return s;
    };
    const young = base();
    for (let i = 0; i < young.grid.zone.length; i++) if (young.grid.zone[i] !== 0) young.grid.zone[i] = 100 + (2050 - 2000) - 1;
    mechYear(young);
    expect(rehabPct(young)).toBe(0);
    const bare = base();
    for (let i = 0; i < bare.grid.health.length; i++) if (bare.grid.zone[i] !== 0) { bare.grid.health[i] = 0.05; bare.grid.stage[i] = 0; }
    mechYear(bare);
    expect(rehabPct(bare)).toBeLessThan(100);
    const weedy = base();
    for (let i = 0; i < weedy.grid.weed.length; i++) if (weedy.grid.zone[i] !== 0) weedy.grid.weed[i] = 1;
    mechYear(weedy);
    expect(rehabPct(weedy)).toBeLessThan(100);
  });
  it('is capped below 100 while a mine is still working, and the closed mine\'s bond reaches the town', () => {
    const s = outback({ year: 2050, mines: 1 });
    for (let i = 0; i < s.grid.zone.length; i++) if (s.grid.zone[i] === 1) s.grid.zone[i] = OUTBACK.signedZone;
    expect(minesOpen(s)).toBe(1);
    expect(rehabPct(s)).toBe(99);
    const closed = outback({ year: 2050 });
    closed.budget = 100;
    mechYear(closed);
    expect(closed.flags['o.bond']).toBe(Math.round(36 * OUTBACK.bondPerTile));
    expect(closed.budget).toBe(100 + Math.round(36 * OUTBACK.bondPerTile));
    // Paid once only.
    mechYear(closed);
    expect(closed.budget).toBe(100 + Math.round(36 * OUTBACK.bondPerTile));
  });
  it('survives a save and load, including the mine site layer', () => {
    let g = createGame('red-dirt');
    while (g.status === 'playing') g = advanceDecade(g).state;
    let t = startAct2(g);
    const pit = Array.from(t.grid.kind).findIndex((k, i) => k === TileKind.Pit && t.grid.zone[i] === 1);
    expect(pit).toBeGreaterThanOrEqual(0);
    const px = pit % t.grid.w, py = Math.floor(pit / t.grid.w);
    t.budget = 2000;
    t.country.partnership = 50;
    for (let n = 0; n < 3; n++) {
      const r = applyAction(t, { type: 'rehab', x: px, y: py });
      expect(r.result.ok).toBe(true);
      t = r.state;
    }
    const back = deserialize(serialize(t));
    expect(back).not.toBeNull();
    expect(Array.from(back?.grid.zone ?? [])).toEqual(Array.from(t.grid.zone));
    expect(back?.grid.kind[pit]).toBe(TileKind.Land);
    expect(back?.grid.zone[pit]).toBeGreaterThan(100);
  });
});
