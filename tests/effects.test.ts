import { describe, expect, it } from 'vitest';
import {
  applyEffects, applyTileEffect, disposalChoice, effectImpact, eventChances, fireDanger, makeCtx, startAct2, townVoices, TileKind,
  createGame, cloneState, applyAction, circularYear,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { runScript } from './helpers/autoplay';
import { DIRTY_ROADS, DIRTY_WANTS, greedyPlan } from './helpers/scripts';
import { act2Sandbox, growTile, paint } from './helpers/fixtures';
import { advanceDecade } from '../src/sim';
import { buildN } from './helpers/autoplay';

const ctxOf = (s: GameState) => makeCtx(s, 700, null, { shallow: new Uint8Array(0), nearWater: new Uint8Array(0), nursery: new Uint8Array(0) });

describe('effects', () => {
  it('applies money, society, income, stress, moods, flags, partnership and one-off emissions', () => {
    const s = act2Sandbox();
    applyEffects(s, {
      budget: -30, society: 2, incomePerYear: 3, stress: 5, mood: { 'lena-tran': 10, nobody: 5 }, flags: { a: true, b: 4 },
      partnership: 6, emissionsKt: 12,
    });
    expect(s.budget).toBe(1_000_000 - 30);
    expect(s.dilemmas.adjust).toBe(2);
    expect(s.flags['income.adj']).toBe(3);
    expect(s.a2.stress).toBe(5);
    expect(s.residents.list['lena-tran']?.mood).toBe(72);
    expect(s.flags).toMatchObject({ a: true, b: 4 });
    expect(s.country.partnership).toBe(26);
    expect(s.pendingLandKt).toBe(12);
    applyEffects(s, { incomePerYear: 2, mood: { 'lena-tran': 100 } });
    expect(s.flags['income.adj']).toBe(5);
    expect(s.residents.list['lena-tran']?.mood).toBe(100);
    applyEffects(s, undefined);
    expect(s.budget).toBe(1_000_000 - 30);
  });
  it('changes the map: pollution fields by scope, and plant health in Act 2 with chunk updates', () => {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 5, 5, 3, 3, TileKind.Estuary);
    paint(s, 0, 0, 1, 32, TileKind.River);
    s.grid.waterPollution.fill(1);
    applyTileEffect(s, { op: 'water', scope: 'estuary', mult: 0.5 });
    expect(s.grid.waterPollution[5 * 32 + 5]).toBe(0.5);
    expect(s.grid.waterPollution[0]).toBe(1);
    applyTileEffect(s, { op: 'water', scope: 'river', add: 0.25 });
    expect(s.grid.waterPollution[0]).toBe(1.25);
    applyTileEffect(s, { op: 'water', scope: 'all', mult: 0, add: 0 });
    expect(Math.max(...Array.from(s.grid.waterPollution))).toBe(0);
    s.grid.soilContamination.fill(0.2);
    s.grid.soilContamination[40] = 2;
    applyTileEffect(s, { op: 'soil', scope: 'contaminated', mult: 0.5 });
    expect(s.grid.soilContamination[40]).toBe(1);
    expect(s.grid.soilContamination[41]).toBeCloseTo(0.2, 6);
    s.grid.airPollution.fill(1);
    applyTileEffect(s, { op: 'air', scope: 'all', add: -5 });
    expect(Math.max(...Array.from(s.grid.airPollution))).toBe(0); // floored at zero
    growTile(s, 10, 10);
    const chunks = s.grid.chunkVersion.slice();
    applyTileEffect(s, { op: 'health', scope: 'bush', add: -0.5 });
    expect(s.grid.health[10 * 32 + 10]).toBeCloseTo(0.45, 5);
    expect(s.grid.stage[10 * 32 + 10]).toBe(2);
    expect(Array.from(s.grid.chunkVersion)).not.toEqual(Array.from(chunks));
    applyTileEffect(s, { op: 'health', scope: 'land', add: -5 });
    expect(s.grid.health[10 * 32 + 10]).toBe(0);
    expect(s.grid.kind[10 * 32 + 10]).toBe(TileKind.Land); // too young to be bush any more
    applyTileEffect(s, { op: 'health', scope: 'land', add: 5 });
    expect(s.grid.health[10 * 32 + 10]).toBe(1);
    expect(s.grid.kind[10 * 32 + 10]).toBe(TileKind.Bush);
  });
  it('ignores plant-health effects before Act 2, when the restoration layer is not live', () => {
    const s = createGame('coal-coast');
    applyTileEffect(s, { op: 'health', scope: 'all', add: 0.5 });
    expect(Math.max(...Array.from(s.grid.health))).toBe(0);
  });
  it('rates how big a choice was, for ranking decisions', () => {
    expect(effectImpact(undefined)).toBe(0);
    expect(effectImpact({})).toBe(0);
    expect(effectImpact({ budget: -40, society: 2 })).toBeGreaterThan(effectImpact({ budget: -10 }));
    expect(effectImpact({ flags: { a: 1 }, tiles: [{ op: 'water', scope: 'all', mult: 0.9 }] })).toBe(3);
  });
});

describe('choice flags that change the world', () => {
  it('fire preparedness and buy-backs lower fire danger', () => {
    const s = act2Sandbox(TileKind.Land);
    for (let i = 0; i < 30; i++) growTile(s, 5 + (i % 6), 5 + Math.floor(i / 6));
    s.a2.season = 0;
    const base = fireDanger(ctxOf(s));
    expect(base).toBeGreaterThan(0.01);
    s.flags['fire.prep'] = 1;
    expect(fireDanger(ctxOf(s))).toBeCloseTo(base * 0.8, 6);
    s.flags['fire.buyback'] = 1;
    expect(fireDanger(ctxOf(s))).toBeCloseTo(base * 0.7, 6);
  });
  it('seasonal fishing protocols cut the chance of a fish kill', () => {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 5, 5, 3, 3, TileKind.Estuary);
    s.grid.waterPollution.fill(3);
    const p = (): number => eventChances(s, null).find((c) => c.type === 'fish-kill')?.p ?? 0;
    const before = p();
    s.flags.fishingProtocol = 1;
    expect(p()).toBeCloseTo(before * 0.6, 6);
  });
});

describe('helpers for the interface', () => {
  const act1 = runScript(createGame('coal-coast'), greedyPlan(DIRTY_WANTS, 1.0, 30, DIRTY_ROADS)).state;
  it('offers a disposal choice for old sites once the circular tier is open', () => {
    const s = startAct2(act1);
    const mine = s.circular.items.find((i) => i.type === 'steelworks');
    expect(mine).toBeDefined();
    expect(disposalChoice(s, mine?.x ?? 0, mine?.y ?? 0)).toBeNull(); // not open yet
    const open = cloneState(s);
    open.year = 2050;
    circularYear(open);
    const choice = disposalChoice(open, mine?.x ?? 0, mine?.y ?? 0);
    expect(choice?.item.type).toBe('steelworks');
    expect(choice?.plans.map((p) => p.how)).toEqual(['repurpose', 'repurpose', 'repurpose', 'recycle', 'landfill']);
    expect(disposalChoice(open, 0, 0)).toBeNull();
    const r = applyAction(open, { type: 'dispose', x: mine?.x ?? 0, y: mine?.y ?? 0, how: 'recycle' });
    expect(disposalChoice(r.state, mine?.x ?? 0, mine?.y ?? 0)).toBeNull(); // dealt with
  });
  it('lists the Town Voices: newest first, stories only', () => {
    const voices = townVoices(act1, 6);
    expect(voices).toHaveLength(6);
    for (const v of voices) expect(v.type).toBe('story');
    for (let i = 1; i < voices.length; i++) expect(voices[i - 1]?.id).toBeGreaterThan(voices[i]?.id ?? 0);
    expect(townVoices(act1, 1000).length).toBeGreaterThan(15);
    expect(townVoices(createGame('coal-coast'))).toEqual([]);
  });
});

describe('negative emission effects (innovation savings)', () => {
  const base = () => buildN(buildN(createGame('coal-coast'), 'cottage', 4).state, 'coalmine', 1).state;
  const run = (kt: number) => {
    const s = cloneState(base());
    applyEffects(s, { emissionsKt: kt });
    return advanceDecade(s).state;
  };
  it('a saving comes off the decade\'s real emissions in full', () => {
    const plain = run(0).history.at(-1)!.totalKt;
    expect(plain).toBeGreaterThan(10);
    expect(run(-6).history.at(-1)!.totalKt).toBeCloseTo(plain - 6, 6);
  });
  it('a saving bigger than the decade\'s emissions carries into the next', () => {
    const s0 = cloneState(createGame('coal-coast'));
    applyEffects(s0, { emissionsKt: -50 });
    const d1 = advanceDecade(s0).state;
    expect(d1.history.at(-1)!.totalKt).toBeGreaterThanOrEqual(0);
    expect(d1.pendingLandKt).toBeLessThan(0);
  });
});
