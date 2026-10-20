import { describe, expect, it } from 'vitest';
import {
  applyAction, buildRestoreCtx, burnFrom, estuaryHealth, EVENTS, FISH_KILL_THRESHOLD, GROWTH, makeCtx, mulberry32,
  remediationSeasonFactor, remediationYearsFor, stageFromHealth, stageLabel, stepReef, stepSuccession, tick, TileKind,
  weedCount, WEED_CAP,
} from '../src/sim';
import type { GameState, Season } from '../src/sim';
import { act2Sandbox, addBuilding, fillField, growTile, paint } from './helpers/fixtures';

const I = (s: GameState, x: number, y: number): number => y * s.grid.w + x;

/** Years until `pred` first holds (checked every season); Infinity if never within `max`. */
function yearsUntil(s: GameState, pred: (s: GameState) => boolean, max = 60): number {
  let cur = s;
  for (let k = 1; k <= max * 4; k++) {
    cur = tick(cur, 0.25).state;
    if (pred(cur)) return k / 4;
  }
  return Infinity;
}

describe('remediation', () => {
  function polluted(kind: 'phytoremediation' | 'excavation', scenario: 'coal-coast' | 'red-dirt' = 'coal-coast'): GameState {
    const s = act2Sandbox(TileKind.Land, { scenario });
    addBuilding(s, kind, 14, 14);
    addBuilding(s, 'gaspower', 28, 28); // keeps the lights on so the town does not collapse during long runs
    fillField(s, s.grid.soilContamination, 11, 11, 8, 8, 4);
    return s;
  }
  const centreSoil = (s: GameState): number => s.grid.soilContamination[I(s, 13, 14)] ?? 0;

  it('phytoremediation is cheap and slow: soil falls below the plant threshold in about 8 years', () => {
    const s = polluted('phytoremediation');
    expect(remediationYearsFor('phytoremediation', 20)).toBe(8);
    const t = yearsUntil(s, (x) => centreSoil(x) < 0.5);
    expect(t).toBeGreaterThanOrEqual(6);
    expect(t).toBeLessThanOrEqual(9);
  });
  it('excavation is fast and expensive: about 2 years', () => {
    const s = polluted('excavation');
    const t = yearsUntil(s, (x) => centreSoil(x) < 0.5);
    expect(t).toBeGreaterThanOrEqual(1.5);
    expect(t).toBeLessThanOrEqual(2.5);
    expect(canCost('excavation')).toBeGreaterThan(canCost('phytoremediation') * 2);
  });
  const canCost = (id: 'excavation' | 'phytoremediation'): number =>
    applyAction(act2Sandbox(), { type: 'place', building: id, x: 4, y: 4 }).result.spent ?? 0;

  it('the scenario remediationYears multiplier slows or speeds the cleanup', () => {
    const base = yearsUntil(polluted('phytoremediation'), (x) => centreSoil(x) < 0.5);
    const slow = yearsUntil(polluted('phytoremediation', 'red-dirt'), (x) => centreSoil(x) < 0.5);
    expect(remediationYearsFor('phytoremediation', 30)).toBeCloseTo(12, 9);
    expect(slow / base).toBeGreaterThan(1.3);
    expect(slow / base).toBeLessThan(1.7);
    expect(remediationSeasonFactor('excavation', 20)).toBeLessThan(remediationSeasonFactor('phytoremediation', 20));
  });
  it('only cleans soil within its radius; the rest only decays naturally', () => {
    const s = polluted('phytoremediation');
    fillField(s, s.grid.soilContamination, 1, 1, 3, 3, 4);
    const out = tick(s, 8).state;
    expect(out.grid.soilContamination[I(out, 2, 2)]).toBeGreaterThan(2.5);
    expect(out.grid.soilContamination[I(out, 13, 14)]).toBeLessThan(0.6);
  });
  it('without remediation soil contamination lingers for decades', () => {
    const s = act2Sandbox();
    fillField(s, s.grid.soilContamination, 5, 5, 4, 4, 4);
    const out = tick(s, 20).state;
    expect(out.grid.soilContamination[I(out, 6, 6)]).toBeGreaterThan(2);
  });
  it('excavation trucks emit CO2 only while it is digging', () => {
    const s = polluted('excavation');
    const first = tick(s, 1).state;
    expect(first.a2.activeRemediation.length).toBe(1);
    const e1 = first.a2.yearly.at(-1)?.emissionsKt.transport ?? 0;
    expect(e1).toBeGreaterThan(5);
    const clean = tick(first, 10).state;
    expect(clean.a2.activeRemediation).toHaveLength(0);
    expect(tick(clean, 1).state.a2.yearly.at(-1)?.emissionsKt.transport ?? 1).toBe(0);
    const phyto = tick(polluted('phytoremediation'), 1).state;
    expect(phyto.a2.yearly.at(-1)?.emissionsKt.transport ?? 1).toBe(0);
  });
});

describe('water: wetlands, sewage treatment, fish kills', () => {
  function river(): GameState {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 0, 15, 30, 1, TileKind.River);
    paint(s, 30, 14, 2, 3, TileKind.Estuary);
    fillField(s, s.grid.waterPollution, 0, 15, 30, 1, 2);
    return s;
  }
  it('a stormwater wetland filters water downstream along the river', () => {
    const control = river();
    const wet = river();
    addBuilding(wet, 'wetland', 4, 16);
    const a = tick(control, 3).state;
    const b = tick(wet, 3).state;
    const at = (s: GameState, x: number): number => s.grid.waterPollution[I(s, x, 15)] ?? 0;
    expect(at(b, 6)).toBeLessThan(at(a, 6) * 0.9);
    expect(at(b, 12)).toBeLessThan(at(a, 12) * 0.97); // still filtered further downstream
    expect(at(b, 12)).toBeGreaterThan(at(b, 5) * 0.99 - 1); // taper, not a wall
    expect(at(b, 25)).toBeGreaterThanOrEqual(at(a, 25) * 0.999 - 1e-6); // far reaches untouched (+/- rounding)
    expect(estuaryHealth(b)).toBeGreaterThanOrEqual(estuaryHealth(a));
  });
  it('more wetlands filter more', () => {
    const one = river();
    addBuilding(one, 'wetland', 4, 16);
    const two = river();
    addBuilding(two, 'wetland', 4, 16);
    addBuilding(two, 'wetland', 10, 16);
    const at = (s: GameState): number => tick(s, 6).state.grid.waterPollution[I(s, 14, 15)] ?? 0;
    expect(at(two)).toBeLessThan(at(one));
  });
  it('a sewage treatment plant keeps the estuary far cleaner than an outfall', () => {
    const build = (kind: 'outfall' | 'sewagetreatment'): GameState => {
      const s = act2Sandbox(TileKind.Land);
      paint(s, 14, 0, 18, 32, TileKind.Sea);
      paint(s, 12, 10, 2, 4, TileKind.Estuary);
      addBuilding(s, kind, 11, 11);
      return s;
    };
    const out = tick(build('outfall'), 12).state;
    const treated = tick(build('sewagetreatment'), 12).state;
    const mean = (s: GameState): number => {
      let t = 0, n = 0;
      for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.Estuary) { t += s.grid.waterPollution[i] ?? 0; n++; }
      return t / n;
    };
    expect(mean(out)).toBeGreaterThan(mean(treated) * 3);
    expect(estuaryHealth(treated)).toBeGreaterThan(estuaryHealth(out));
  });
  it('estuary fish kill when water pollution and summer heat cross the threshold', () => {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 10, 10, 4, 4, TileKind.Estuary);
    fillField(s, s.grid.waterPollution, 10, 10, 4, 4, 3);
    s.tempC = 1.6;
    // keep it polluted
    addBuilding(s, 'outfall', 9, 10);
    const dirty = tick(s, 6);
    const kills = dirty.state.eventLog.filter((e) => e.type === 'fish-kill');
    expect(kills.length).toBeGreaterThan(0);
    expect(kills[0]?.text).toMatch(/Fish kill/);
    expect(kills[0]?.season).toBeDefined();
    // cool + clean: never
    const clean = act2Sandbox(TileKind.Land);
    paint(clean, 10, 10, 4, 4, TileKind.Estuary);
    clean.tempC = 1.6;
    expect(tick(clean, 40).state.eventLog.filter((e) => e.type === 'fish-kill')).toHaveLength(0);
    expect(FISH_KILL_THRESHOLD).toBeGreaterThan(0.5);
  });
  it('fish kills have a cooldown and favour summer', () => {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 10, 10, 4, 4, TileKind.Estuary);
    addBuilding(s, 'outfall', 9, 10);
    fillField(s, s.grid.waterPollution, 10, 10, 4, 4, 6);
    s.tempC = 1.5;
    const out = tick(s, 20).state;
    const kills = out.eventLog.filter((e) => e.type === 'fish-kill');
    for (let i = 1; i < kills.length; i++) expect((kills[i]?.seasonIndex ?? 0) - (kills[i - 1]?.seasonIndex ?? 0)).toBeGreaterThanOrEqual(4);
    expect(kills.filter((k) => k.season === 0).length).toBeGreaterThanOrEqual(kills.filter((k) => k.season === 2).length);
  });
});

describe('restoration and succession', () => {
  it('stage thresholds and names by tile kind', () => {
    expect([0, 0.11, 0.12, 0.37, 0.38, 0.65, 0.66, 1].map(stageFromHealth)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(stageLabel(TileKind.Land, 3)).toBe('woodland');
    expect(stageLabel(TileKind.Estuary, 3)).toBe('mangrove forest');
    expect(stageLabel(TileKind.Estuary, 2)).toBe('saltmarsh');
    expect(stageLabel(TileKind.Sea, 2)).toBe('seagrass meadow');
    expect(stageLabel(TileKind.Beach, 1)).toBe('dune grasses');
  });
  it('bare land with no seed source stays bare; a nursery restores its radius through all four stages', () => {
    const s = act2Sandbox(TileKind.Land);
    const none = tick(s, 30).state;
    expect(none.grid.health.every((h) => h === 0)).toBe(true);

    addBuilding(s, 'nursery', 14, 14);
    const near = I(s, 14, 18); // distance 4 from the nursery edge
    const far = I(s, 14, 26); // beyond radius 5
    const seen: number[] = [];
    let cur = s;
    for (let q = 0; q < 4 * 40; q++) {
      cur = tick(cur, 0.25).state;
      const st = cur.grid.stage[near] ?? 0;
      if (seen[seen.length - 1] !== st) seen.push(st);
    }
    expect(seen).toEqual([0, 1, 2, 3]);
    expect(cur.grid.health[near]).toBeGreaterThan(0.66);
    expect(cur.grid.kind[near]).toBe(TileKind.Bush); // woodland counts as bush again
    expect(cur.grid.health[far]).toBe(0);
  });
  it('time to woodland is a couple of decades in good conditions', () => {
    const s = act2Sandbox(TileKind.Land);
    addBuilding(s, 'nursery', 14, 14);
    const t = yearsUntil(s, (x) => (x.grid.stage[I(x, 14, 17)] ?? 0) === 3, 60);
    expect(t).toBeGreaterThan(8);
    expect(t).toBeLessThan(35);
  });
  it('natural spread: healthy neighbours seed the next tile, so the front advances without a nursery - slowly', () => {
    const s = act2Sandbox(TileKind.Land);
    for (let y = 0; y < 32; y++) growTile(s, 0, y);
    const t5 = tick(s, 5).state;
    const t30 = tick(s, 30).state;
    const t60 = tick(s, 60).state;
    expect(t5.grid.health[I(t5, 1, 10)]).toBeGreaterThan(0);
    expect(t5.grid.health[I(t5, 4, 10)]).toBe(0);
    expect(t30.grid.health[I(t30, 3, 10)]).toBeGreaterThan(0.1);
    const front = (st: GameState): number => {
      let x = 0;
      while (x < 31 && (st.grid.health[I(st, x + 1, 10)] ?? 0) > 0.12) x++;
      return x;
    };
    expect(front(t60)).toBeGreaterThan(front(t30));
    expect(front(t30)).toBeGreaterThanOrEqual(2);
    expect(front(t60)).toBeLessThan(31);
  });
  it('contaminated soil blocks growth; cleaning it lets restoration start', () => {
    const s = act2Sandbox(TileKind.Land);
    addBuilding(s, 'nursery', 14, 14);
    fillField(s, s.grid.soilContamination, 10, 10, 10, 10, 1.0);
    const stuck = tick(s, 5).state;
    expect(stuck.grid.health[I(stuck, 14, 17)]).toBe(0);
    const cleaned = { ...stuck, grid: { ...stuck.grid, soilContamination: new Float32Array(stuck.grid.soilContamination.length) } };
    const grew = tick(cleaned, 5).state;
    expect(grew.grid.health[I(grew, 14, 17)]).toBeGreaterThan(0.2);
  });
  it('toxic soil kills existing plants', () => {
    const s = act2Sandbox(TileKind.Land);
    growTile(s, 5, 5);
    s.grid.soilContamination[I(s, 5, 5)] = 4;
    const out = tick(s, 5).state;
    expect(out.grid.health[I(out, 5, 5)]).toBeLessThan(0.5);
    expect(out.grid.kind[I(out, 5, 5)]).not.toBe(TileKind.Bush);
  });
  it('drought slows growth and rain-poor scenarios grow slower', () => {
    const mk = (): GameState => {
      const s = act2Sandbox(TileKind.Land);
      addBuilding(s, 'nursery', 14, 14);
      return s;
    };
    const wet = tick(mk(), 6).state;
    const dry = mk();
    dry.a2.active.push({ type: 'drought', endsAt: 1e9, severity: 1 });
    const d = tick(dry, 6).state;
    const arid = tick(
      (() => {
        const s = act2Sandbox(TileKind.Land, { scenario: 'red-dirt' });
        addBuilding(s, 'nursery', 14, 14);
        return s;
      })(),
      6,
    ).state;
    const at = (s: GameState): number => s.grid.health[I(s, 14, 17)] ?? 0;
    expect(at(d)).toBeLessThan(at(wet) * 0.75);
    expect(at(arid)).toBeLessThan(at(wet));
    expect(GROWTH.droughtRain).toBeLessThan(1);
  });
  it('Society above 60 brings bush-regeneration volunteers that speed growth', () => {
    const mk = (society: number): GameState => {
      const s = act2Sandbox(TileKind.Land);
      addBuilding(s, 'nursery', 14, 14);
      s.meters.society = society;
      return s;
    };
    const run = (society: number): number => {
      const s = mk(society);
      const ctx = buildRestoreCtx(s);
      let cur = s;
      for (let k = 0; k < 24; k++) stepSuccession(cur, ctx, 400 + k, (k % 4) as Season);
      cur = s;
      return cur.grid.health[I(cur, 14, 17)] ?? 0;
    };
    const low = run(40), mid = run(60), high = run(100);
    expect(mid).toBeCloseTo(low, 9);
    expect(high).toBeGreaterThan(low * 1.1);
  });
  it('weeds invade untended bare edges beside buildings and cap growth; a nursery crew clears them', () => {
    const mk = (nursery: boolean): GameState => {
      const s = act2Sandbox(TileKind.Land);
      addBuilding(s, 'gaspower', 28, 28);
      for (let i = 0; i < 8; i++) addBuilding(s, 'cottage', 4 + i, 12);
      if (nursery) addBuilding(s, 'nursery', 7, 15);
      return s;
    };
    const inReach = (st: GameState): number => {
      let n = 0;
      for (let y = 8; y <= 20; y++) for (let x = 2; x <= 13; x++) n += st.grid.weed[I(st, x, y)] ?? 0;
      return n;
    };
    const untended = tick(mk(false), 25).state;
    expect(weedCount(untended)).toBeGreaterThan(5);
    const w = untended.grid.weed.findIndex((v) => v === 1);
    expect(untended.grid.stage[w]).toBeLessThanOrEqual(1);
    const tended = tick(mk(true), 25).state;
    expect(inReach(tended)).toBeLessThan(inReach(untended) / 2);
    // weeds cap health
    const capped = mk(true);
    capped.grid.weed[I(capped, 5, 11)] = 1;
    capped.grid.health[I(capped, 5, 11)] = 0.5;
    const ctx = buildRestoreCtx(capped);
    stepSuccession(capped, ctx, 123, 1);
    expect(capped.grid.health[I(capped, 5, 11)]).toBeLessThanOrEqual(WEED_CAP + 1e-6);
  });
  it('a hot fire resets stage to bare; a cool fire only knocks plants back', () => {
    const mk = (): GameState => {
      const s = act2Sandbox(TileKind.Land);
      for (let y = 8; y < 14; y++) for (let x = 8; x < 14; x++) growTile(s, x, y);
      return s;
    };
    const hot = mk();
    const origin = I(hot, 10, 10);
    const rng = mulberry32(5);
    const burnt = burnFrom(hot, origin, 40, true, () => rng.next());
    expect(burnt.length).toBeGreaterThan(3);
    for (const i of burnt) {
      expect(hot.grid.stage[i]).toBe(0);
      expect(hot.grid.health[i]).toBeLessThan(0.1);
      expect(hot.grid.kind[i]).toBe(TileKind.Land);
    }
    const cool = mk();
    const rng2 = mulberry32(5);
    const burnt2 = burnFrom(cool, origin, 40, false, () => rng2.next());
    for (const i of burnt2) {
      expect(cool.grid.health[i]).toBeCloseTo(0.65, 6);
      expect(cool.grid.stage[i]).toBe(2);
    }
  });
  it('the bushfire event burns real vegetation, raises a log entry and spares built tiles', () => {
    const s = act2Sandbox(TileKind.Land);
    for (let y = 4; y < 20; y++) for (let x = 4; x < 20; x++) growTile(s, x, y);
    addBuilding(s, 'cottage', 12, 12);
    s.a2.active.push({ type: 'drought', endsAt: 1e9, severity: 1 });
    const def = EVENTS.find((e) => e.type === 'bushfire');
    const ctx = makeCtx(s, 700, null, buildRestoreCtx(s));
    const fired = def?.fire(ctx, mulberry32(3));
    expect(fired?.text).toMatch(/Bushfire/);
    expect(fired?.data?.tilesBurnt).toBeGreaterThan(2);
    expect(fired?.data?.hot).toBe(1);
    expect(s.grid.building[I(s, 12, 12)]).toBeGreaterThan(0);
    expect(fired?.data?.homesThreatened).toBeGreaterThanOrEqual(0);
    expect(def?.chance(ctx)).toBeGreaterThan(0);
  });
  it('cultural burning (a flag) cuts bushfire danger and fire heat', () => {
    const s = act2Sandbox(TileKind.Land);
    for (let y = 4; y < 20; y++) for (let x = 4; x < 20; x++) growTile(s, x, y);
    s.tempC = 2;
    const def = EVENTS.find((e) => e.type === 'bushfire');
    const p0 = def?.chance(makeCtx(s, 700, null, buildRestoreCtx(s))) ?? 0;
    s.flags.culturalBurning = 1;
    const p1 = def?.chance(makeCtx(s, 700, null, buildRestoreCtx(s))) ?? 0;
    expect(p1).toBeLessThan(p0 * 0.5);
  });
  it('coastal variants: estuary saltmarsh to mangrove and shallow-sea seagrass recover when clean', () => {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 20, 0, 12, 32, TileKind.Sea);
    paint(s, 17, 10, 3, 6, TileKind.Estuary);
    addBuilding(s, 'nursery', 16, 4);
    s.grid.health.fill(0);
    s.grid.stage.fill(0);
    const nursery2 = addBuilding(s, 'nursery', 18, 18);
    expect(nursery2.uid).toBeGreaterThan(0);
    const out = tick(s, 40).state;
    const est = I(out, 17, 12);
    expect(out.grid.stage[est]).toBeGreaterThanOrEqual(2);
    expect(stageLabel(out.grid.kind[est] ?? 0, out.grid.stage[est] ?? 0)).toMatch(/saltmarsh|mangrove/);
    const seagrass = I(out, 21, 19); // shallow sea next to the nursery's reach
    expect(out.grid.health[seagrass]).toBeGreaterThan(0);
    expect(out.grid.kind[seagrass]).toBe(TileKind.Sea);
    // polluted estuary does not recover
    const dirty = act2Sandbox(TileKind.Land);
    paint(dirty, 17, 10, 3, 6, TileKind.Estuary);
    addBuilding(dirty, 'nursery', 14, 12);
    dirty.grid.health.fill(0);
    fillField(dirty, dirty.grid.waterPollution, 17, 10, 3, 6, 4);
    addBuilding(dirty, 'outfall', 16, 10);
    expect(tick(dirty, 20).state.grid.health[I(dirty, 18, 12)]).toBe(0);
  });
  it('reef health falls with warming and pollution and recovers when conditions ease', () => {
    const mk = (tempC: number, wp: number): GameState => {
      const s = act2Sandbox(TileKind.Sea);
      paint(s, 4, 4, 6, 6, TileKind.Reef);
      s.tempC = tempC;
      fillField(s, s.grid.waterPollution, 4, 4, 6, 6, wp);
      for (let y = 4; y < 10; y++) for (let x = 4; x < 10; x++) { s.grid.health[I(s, x, y)] = 0.9; s.grid.stage[I(s, x, y)] = 3; }
      return s;
    };
    const reef = (s: GameState): number => s.grid.health[I(s, 6, 6)] ?? 0;
    const cool = mk(0.3, 0);
    const warm = mk(1.6, 0);
    const warmDirty = mk(1.6, 3);
    const a = cool; const b = warm; const c = warmDirty;
    for (const s of [a, b, c]) for (let k = 0; k < 90; k++) stepReef(s);
    expect(reef(a)).toBeGreaterThan(reef(b) + 0.2);
    expect(reef(b)).toBeGreaterThan(reef(c));
    // recovery
    b.tempC = 0.3;
    for (let k = 0; k < 80; k++) stepReef(b);
    expect(reef(b)).toBeGreaterThan(0.6);
  });
  it('marine heatwaves bleach reefs, and more in a warmer world', () => {
    const mk = (tempC: number): GameState => {
      const s = act2Sandbox(TileKind.Sea);
      paint(s, 4, 4, 6, 6, TileKind.Reef);
      for (let y = 4; y < 10; y++) for (let x = 4; x < 10; x++) { s.grid.health[I(s, x, y)] = 0.8; s.grid.stage[I(s, x, y)] = 3; }
      s.tempC = tempC;
      return s;
    };
    const def = EVENTS.find((e) => e.type === 'marine-heatwave');
    const hit = (t: number): number => {
      const s = mk(t);
      const f = def?.fire(makeCtx(s, 700, null, buildRestoreCtx(s)), mulberry32(11));
      return f?.data?.healthLostPct ?? 0;
    };
    expect(hit(1.0)).toBeGreaterThan(5);
    expect(hit(2.0)).toBeGreaterThan(hit(1.0));
    expect(def?.chance(makeCtx(act2Sandbox(TileKind.Land), 700, null, buildRestoreCtx(act2Sandbox(TileKind.Land))))).toBe(0); // no reef, no bleaching
  });
  it('floods and storm surges cost money, wash pollution into the river and can destroy low-lying homes', () => {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 20, 0, 12, 32, TileKind.Sea);
    paint(s, 18, 10, 2, 6, TileKind.Estuary);
    for (let i = 0; i < 10; i++) addBuilding(s, 'cottage', 16, 2 + i);
    s.grid.elevation.fill(0);
    const def = EVENTS.find((e) => e.type === 'flood');
    let lost = 0, money = 0;
    for (let seed = 1; seed < 40; seed++) {
      const st = act2Sandbox(TileKind.Land);
      paint(st, 20, 0, 12, 32, TileKind.Sea);
      paint(st, 18, 10, 2, 6, TileKind.Estuary);
      for (let i = 0; i < 10; i++) addBuilding(st, 'cottage', 17, 2 + i);
      st.grid.elevation.fill(0);
      const before = st.budget;
      const f = def?.fire(makeCtx(st, 700, null, buildRestoreCtx(st)), mulberry32(seed));
      lost += f?.data?.homesLost ?? 0;
      money += before - st.budget;
      expect(st.grid.waterPollution[I(st, 18, 12)]).toBeGreaterThan(0);
    }
    expect(money).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(0);
    expect(lost).toBeLessThan(39);
    expect(s.buildings).toHaveLength(10);
  });
  it('tick reports dirty chunks and bumps chunk versions where restoration changes', () => {
    const s = act2Sandbox(TileKind.Land);
    addBuilding(s, 'nursery', 14, 14);
    const r = tick(s, 2);
    expect(r.dirtyChunks.length).toBeGreaterThan(0);
    const c = Math.floor(14 / 8) * 4 + Math.floor(14 / 8);
    expect(r.dirtyChunks).toContain(c);
    expect(r.state.grid.chunkVersion[c]).toBeGreaterThan(s.grid.chunkVersion[c] ?? 0);
    // chunks nowhere near the nursery's reach are not dirtied
    expect(r.dirtyChunks).not.toContain(3);
    const quiet = act2Sandbox(TileKind.Land);
    expect(tick(quiet, 1).dirtyChunks).toHaveLength(0);
  });
});
