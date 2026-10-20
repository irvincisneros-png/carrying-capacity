import { describe, expect, it } from 'vitest';
import {
  applyAction, BUILDINGS, canPlace, canResearch, circularMods, circularYear, cloneState, counts, createGame, disposalPlans, itemAt,
  legacyPercent, LEGACY_TYPES, objectiveStatus, publishCircularMetric, RESEARCH_BY_ID, startAct2, tick, TileKind,
} from '../src/sim';
import type { CircularItem, GameState } from '../src/sim';
import { runScript } from './helpers/autoplay';
import { DIRTY_WANTS, greedyPlan } from './helpers/scripts';
import { act2Sandbox, addBuilding } from './helpers/fixtures';

const act1 = runScript(createGame('coal-coast'), greedyPlan(DIRTY_WANTS, 1.0)).state;
const base = startAct2(act1);

const unlocked = (): GameState => {
  const s = cloneState(base);
  s.budget = 5000;
  s.year = 2050;
  circularYear(s);
  return s;
};
const first = (s: GameState, type: string): CircularItem => s.circular.items.find((i) => i.type === type) as CircularItem;
const status = (s: GameState, id: string): string | undefined => objectiveStatus(s).find((o) => o.id === id)?.status;
const stories = (s: GameState): string[] => s.eventLog.filter((e) => e.story?.channel === 'circular').map((e) => e.text);

describe('legacy sites', () => {
  it('snapshots the Act 1 industrial buildings when Act 2 begins', () => {
    const legacy = act1.buildings.filter((b) => LEGACY_TYPES.includes(b.type));
    expect(legacy.length).toBeGreaterThan(20);
    expect(base.circular.items).toHaveLength(legacy.length);
    expect(base.circular.items.every((i) => i.status === 'standing')).toBe(true);
    expect(base.circular.items.some((i) => ['cottage', 'farm', 'suburb', 'road'].includes(i.type))).toBe(false);
    expect(base.circular.unlocked).toBe(false);
    expect(legacyPercent(base)).toBe(0);
  });
  it('stays closed at first: nothing to dispose, no metric, so the objective is pending', () => {
    const it0 = first(base, 'steelworks');
    const r = applyAction(base, { type: 'dispose', x: it0.x, y: it0.y, how: 'recycle' });
    expect(r.result.ok).toBe(false);
    expect(r.result.code).toBe('not-open');
    expect(base.flags['metric.act1Repurposed']).toBeUndefined();
    expect(status(base, 'repurpose')).toBe('pending');
  });
  it('turns a plain demolish into rubble to be sorted later, until the tier opens', () => {
    const it0 = first(base, 'steelworks');
    const r = applyAction(base, { type: 'demolish', x: it0.x, y: it0.y });
    expect(r.result.ok).toBe(true);
    expect(first(r.state, 'steelworks').status === 'rubble' || r.state.circular.items.find((i) => i.uid === it0.uid)?.status === 'rubble').toBe(true);
    expect(r.state.circular.items.find((i) => i.uid === it0.uid)?.status).toBe('rubble');
    expect(r.state.circular.disposalKt).toBe(0);
    expect(r.state.residents.actions['demolished.steelworks']).toBe(1);
  });
  it('counts a sewage upgrade on an outfall as repurposing that site', () => {
    const outfall = first(base, 'outfall');
    const r = applyAction(base, { type: 'place', building: 'sewagetreatment', x: outfall.x, y: outfall.y });
    expect(r.result.ok).toBe(true);
    const item = r.state.circular.items.find((i) => i.uid === outfall.uid);
    expect(item?.status).toBe('repurposed');
    expect(item?.into).toBe('sewagetreatment');
  });
  it('cannot be built directly: repurposed buildings only come from repurposing', () => {
    const s = act2Sandbox(TileKind.Land);
    for (const id of ['greensteel', 'makerspace', 'windport', 'solarlandfill', 'batteryhub', 'communityhub', 'recycler'] as const) {
      const c = canPlace(s, id, 5, 5);
      expect(c.ok, id).toBe(false);
      expect(c.code).toBe('locked');
      expect(BUILDINGS[id].repurposeOnly).toBe(true);
    }
  });
});

describe('opening the circular tier', () => {
  it('opens in 2050 at the latest', () => {
    const r = tick(cloneState(base), 26).state;
    expect(r.year).toBe(2051);
    expect(r.circular.unlocked).toBe(true);
    expect(r.circular.unlockedYear).toBe(2050);
    expect(r.circular.unlockReason).toBe('year');
    expect(r.flags['tier.circular']).toBe(1);
    expect(stories(r).some((t) => /waste hierarchy/.test(t))).toBe(true);
    expect(r.flags['metric.act1Repurposed']).toBe(0);
    expect(status(r, 'repurpose')).toBe('at-risk');
  });
  it('opens early once the grid is clean and the estuary healthy', () => {
    const s = cloneState(base);
    s.year = 2032;
    s.a2.lastGrid = { ...(s.a2.lastGrid ?? ({} as NonNullable<typeof s.a2.lastGrid>)), renewableShare: 0.9 } as NonNullable<typeof s.a2.lastGrid>;
    s.grid.waterPollution.fill(0);
    circularYear(s);
    expect(s.circular.unlocked).toBe(true);
    expect(s.circular.unlockedYear).toBe(2032);
    expect(s.circular.unlockReason).toBe('clean');
    expect(stories(s)[0]).toMatch(/runs on clean power/);
    const dirty = cloneState(base);
    dirty.year = 2032;
    dirty.a2.lastGrid = { ...(dirty.a2.lastGrid ?? ({} as NonNullable<typeof dirty.a2.lastGrid>)), renewableShare: 0.9 } as NonNullable<typeof dirty.a2.lastGrid>;
    circularYear(dirty);
    expect(dirty.circular.unlocked).toBe(false);
  });
});

describe('repurpose, recycle or landfill', () => {
  it('repurposes the steelworks into a museum and makerspace in place', () => {
    const s = unlocked();
    const it0 = first(s, 'steelworks');
    const old = s.buildings.find((b) => b.uid === it0.uid);
    const plans = disposalPlans(s, it0);
    expect(plans.map((p) => p.how)).toEqual(['repurpose', 'repurpose', 'repurpose', 'recycle', 'landfill']);
    const mk = plans.find((p) => p.id === 'museum');
    expect(mk?.cost).toBe(25);
    const r = applyAction(s, { type: 'dispose', x: it0.x, y: it0.y, how: 'repurpose', into: 'museum' });
    expect(r.result.ok).toBe(true);
    expect(r.result.spent).toBe(25);
    const next = r.state;
    expect(next.buildings.find((b) => b.uid === it0.uid)).toBeUndefined();
    const nb = next.buildings.find((b) => b.type === 'makerspace' && b.x === it0.x && b.y === it0.y);
    expect(nb).toBeDefined();
    expect(next.grid.building[it0.y * next.grid.w + it0.x]).toBe(nb?.uid);
    expect(old && next.grid.building[(old.y + old.h - 1) * next.grid.w + old.x + old.w - 1]).toBe(0); // the rest of the 3x3 is freed
    expect(next.circular.items.find((i) => i.uid === it0.uid)).toMatchObject({ status: 'repurposed', into: 'makerspace' });
    expect(next.budget).toBe(s.budget - 25);
    expect(stories(next).at(-1)).toMatch(/museum of the town/);
    expect(next.residents.actions['repurposed.steelworks']).toBe(1);
    expect(next.flags['metric.act1Repurposed']).toBe(Math.round((1 / s.circular.items.length) * 100));
    expect(s.circular.items.find((i) => i.uid === it0.uid)?.status).toBe('standing'); // input unchanged
  });
  it('needs the green-steel research before a green steel plant can replace the steelworks', () => {
    const s = unlocked();
    const it0 = first(s, 'steelworks');
    const blocked = applyAction(s, { type: 'dispose', x: it0.x, y: it0.y, how: 'repurpose', into: 'green-steel' });
    expect(blocked.result.ok).toBe(false);
    expect(blocked.result.reason).toMatch(/Needs the research "Green steel/);
    const rs = applyAction(s, { type: 'research', id: 'green-steel' });
    expect(rs.result.ok).toBe(true);
    const r = applyAction(rs.state, { type: 'dispose', x: it0.x, y: it0.y, how: 'repurpose', into: 'green-steel' });
    expect(r.result.ok).toBe(true);
    expect(r.state.buildings.some((b) => b.type === 'greensteel')).toBe(true);
    const jobsBefore = s.buildings.reduce((n, b) => n + BUILDINGS[b.type].jobs, 0);
    const jobsAfter = r.state.buildings.reduce((n, b) => n + BUILDINGS[b.type].jobs, 0);
    expect(jobsAfter).toBe(jobsBefore - BUILDINGS.steelworks.jobs + BUILDINGS.greensteel.jobs);
    expect(r.state.residents.actions['repurposed.green-steel']).toBe(1);
  });
  it('repurposes each kind of site into its own new use', () => {
    const s = unlocked();
    const cases: [string, string, string][] = [
      ['port', 'wind-port', 'windport'],
      ['landfill', 'solar-landfill', 'solarlandfill'],
      ['coalpower', 'battery-site', 'batteryhub'],
      ['coalpower', 'community-hub', 'communityhub'],
      ['factory', 'recycler', 'recycler'],
    ];
    for (const [type, opt, into] of cases) {
      const it0 = first(s, type);
      const r = applyAction(s, { type: 'dispose', x: it0.x, y: it0.y, how: 'repurpose', into: opt });
      expect(r.result.ok, `${type} -> ${opt}`).toBe(true);
      expect(r.state.buildings.some((b) => b.type === into && b.x === it0.x && b.y === it0.y)).toBe(true);
    }
    // The solar farm on the landfill makes power; the battery site stores it.
    const lf = first(s, 'landfill');
    const solar = applyAction(s, { type: 'dispose', x: lf.x, y: lf.y, how: 'repurpose', into: 'solar-landfill' }).state;
    expect(solar.buildings.find((b) => b.type === 'solarlandfill')).toBeDefined();
    expect(BUILDINGS.solarlandfill.energy?.source).toBe('solar-farm');
    expect(BUILDINGS.batteryhub.energy?.source).toBe('battery');
  });
  it('returns the land to bush after remediation, but not while the soil is still contaminated', () => {
    const s = unlocked();
    const mine = first(s, 'coalmine');
    for (let y = mine.y - 1; y <= mine.y + mine.h; y++) for (let x = mine.x - 1; x <= mine.x + mine.w; x++) s.grid.soilContamination[y * s.grid.w + x] = 3;
    const blocked = applyAction(s, { type: 'dispose', x: mine.x, y: mine.y, how: 'repurpose', into: 'rehab' });
    expect(blocked.result.ok).toBe(false);
    expect(blocked.result.reason).toMatch(/soil here is still too contaminated/);
    s.grid.soilContamination.fill(0);
    const r = applyAction(s, { type: 'dispose', x: mine.x, y: mine.y, how: 'repurpose', into: 'rehab' });
    expect(r.result.ok).toBe(true);
    const i = mine.y * s.grid.w + mine.x;
    expect(r.state.grid.building[i]).toBe(0);
    expect(r.state.grid.kind[i]).toBe(TileKind.Land);
    expect(r.state.grid.health[i]).toBeCloseTo(0.03, 5);
    expect(r.state.circular.items.find((x) => x.uid === mine.uid)?.into).toBe('rehab');
    expect(stories(r.state).at(-1)).toMatch(/Bushland is returning/);
  });
  it('deconstructs and recycles for money back and a little emissions; research makes it pay more', () => {
    const s = unlocked();
    const it0 = first(s, 'steelworks');
    const plan = disposalPlans(s, it0).find((p) => p.how === 'recycle');
    const orig = BUILDINGS.steelworks.cost;
    expect(plan?.cost).toBe(-Math.round(orig * 0.5));
    const r = applyAction(s, { type: 'dispose', x: it0.x, y: it0.y, how: 'recycle' });
    expect(r.result.ok).toBe(true);
    expect(r.result.refund).toBe(Math.round(orig * 0.5));
    expect(r.state.budget).toBe(s.budget + Math.round(orig * 0.5));
    expect(r.state.circular.returnedBudget).toBe(Math.round(orig * 0.5));
    expect(r.state.pendingLandKt).toBeCloseTo(s.pendingLandKt + 9 * 1.5, 5);
    expect(r.state.circular.items.find((i) => i.uid === it0.uid)?.status).toBe('recycled');
    expect(r.state.buildings.some((b) => b.uid === it0.uid)).toBe(false);
    // Research: e-waste recovery raises the refund by a quarter.
    const smart = applyAction(s, { type: 'research', id: 'ewaste' }).state;
    expect(circularMods(smart).refund).toBeCloseTo(1.25, 5);
    const plan2 = disposalPlans(smart, it0).find((p) => p.how === 'recycle');
    expect(plan2?.cost).toBe(-Math.round(orig * 0.5 * 1.25));
    const tyre = applyAction(smart, { type: 'research', id: 'tyre-road' }).state;
    expect(circularMods(tyre).emissions).toBeCloseTo(0.85, 5);
    expect(disposalPlans(tyre, it0).find((p) => p.how === 'recycle')?.emissionsKt).toBeLessThan(plan2?.emissionsKt ?? 0);
  });
  it('sends a site to landfill if you simply demolish it once the tier is open: cheap, dirty, penalised', () => {
    const s = unlocked();
    const it0 = first(s, 'steelworks');
    const adjust = s.dilemmas.adjust;
    const r = applyAction(s, { type: 'demolish', x: it0.x, y: it0.y });
    expect(r.result.ok).toBe(true);
    const next = r.state;
    expect(next.circular.items.find((i) => i.uid === it0.uid)?.status).toBe('landfilled');
    expect(next.pendingLandKt).toBeGreaterThan(s.pendingLandKt + 60);
    expect(next.circular.disposalKt).toBeGreaterThan(60);
    expect(next.dilemmas.adjust).toBe(adjust - 1.5);
    const site = it0.y * s.grid.w + it0.x;
    expect(next.grid.soilContamination[site]).toBeCloseTo((s.grid.soilContamination[site] ?? 0) + 1.2, 4);
    expect(stories(next).at(-1)).toMatch(/trucked to landfill/);
    // And it can never be put right: the objective can no longer reach 100%.
    expect(legacyPercent(next)).toBeLessThan(100);
    const d = disposalPlans(s, it0).find((p) => p.how === 'landfill');
    const rc = disposalPlans(s, it0).find((p) => p.how === 'recycle');
    expect(d?.emissionsKt).toBeGreaterThan((rc?.emissionsKt ?? 0) * 5);
    expect(applyAction(next, { type: 'dispose', x: it0.x, y: it0.y, how: 'recycle' }).result.code).toBe('nothing-here');
  });
  it('sorts rubble left by an early demolition once the tier opens', () => {
    let s = cloneState(base);
    s.budget = 5000;
    const it0 = first(s, 'steelworks');
    s = applyAction(s, { type: 'demolish', x: it0.x, y: it0.y }).state;
    s.year = 2050;
    circularYear(s);
    expect(itemAt(s, it0.x, it0.y)?.status).toBe('rubble');
    const r = applyAction(s, { type: 'dispose', x: it0.x + 1, y: it0.y + 1, how: 'repurpose', into: 'museum' });
    expect(r.result.ok).toBe(true);
    expect(r.state.buildings.some((b) => b.type === 'makerspace')).toBe(true);
  });
  it('checks funds, unknown options and sites with nothing to deal with', () => {
    const s = unlocked();
    const it0 = first(s, 'steelworks');
    expect(applyAction({ ...s, budget: 3 }, { type: 'dispose', x: it0.x, y: it0.y, how: 'repurpose', into: 'museum' }).result.code).toBe('no-funds');
    expect(applyAction(s, { type: 'dispose', x: it0.x, y: it0.y, how: 'repurpose', into: 'nonsense' }).result.code).toBe('invalid');
    expect(applyAction(s, { type: 'dispose', x: 0, y: 0, how: 'recycle' }).result.code).toBe('nothing-here');
    const port = first(s, 'port');
    expect(disposalPlans(s, port).filter((p) => p.how === 'repurpose')).toHaveLength(1);
  });
  it('tracks the percentage of legacy sites repurposed or recycled, feeding the repurpose objective', () => {
    let s = unlocked();
    expect(status(s, 'repurpose')).toBe('at-risk');
    const n = s.circular.items.length;
    for (const it0 of s.circular.items.slice()) {
      const r = applyAction(s, { type: 'dispose', x: it0.x, y: it0.y, how: 'recycle' });
      if (r.result.ok) s = r.state;
    }
    expect(counts(s).recycled).toBe(n);
    expect(legacyPercent(s)).toBe(100);
    expect(s.flags['metric.act1Repurposed']).toBe(100);
    expect(status(s, 'repurpose')).toBe('on-track');
    const end = cloneState(s);
    end.phase = 'epilogue';
    expect(status(end, 'repurpose')).toBe('met');
    publishCircularMetric(end);
    expect(end.flags['metric.act1Repurposed']).toBe(100);
  });
  it('counts a game with no legacy sites as already done', () => {
    const cautious = startAct2(createGame('coal-coast') && { ...act1, buildings: [], grid: { ...act1.grid, building: new Uint16Array(act1.grid.building.length) } });
    expect(cautious.circular.items).toHaveLength(0);
    expect(legacyPercent(cautious)).toBe(100);
  });
});

describe('recycling research', () => {
  it('opens with the tier, costs money and records what you bought', () => {
    const s = cloneState(base);
    s.budget = 500;
    expect(canResearch(s, 'ewaste').ok).toBe(false);
    expect(applyAction(s, { type: 'research', id: 'ewaste' }).result.code).toBe('not-open');
    const o = unlocked();
    o.budget = 100;
    const r = applyAction(o, { type: 'research', id: 'ewaste' });
    expect(r.result.ok).toBe(true);
    expect(r.state.budget).toBe(75);
    expect(r.state.circular.research).toEqual(['ewaste']);
    expect(stories(r.state).at(-1) ?? r.state.eventLog.at(-1)?.text).toBeDefined();
    expect(r.state.eventLog.at(-1)?.story?.channel).toBe('research');
    expect(applyAction(r.state, { type: 'research', id: 'ewaste' }).result.ok).toBe(false);
    expect(applyAction(o, { type: 'research', id: 'nonsense' }).result.ok).toBe(false);
    o.budget = 10;
    expect(applyAction(o, { type: 'research', id: 'green-steel' }).result.code).toBe('no-funds');
  });
  it('lets food-waste biogas cut the waste sector\'s emissions', () => {
    const mk = (): GameState => {
      const s = act2Sandbox(TileKind.Land);
      addBuilding(s, 'landfill', 5, 5);
      s.circular.unlocked = true;
      return s;
    };
    const plain = tick(mk(), 1).state;
    const withBiogas = mk();
    withBiogas.circular.research.push('biogas');
    const better = tick(withBiogas, 1).state;
    const w = (s: GameState): number => s.a2.yearly[0]?.emissionsKt.waste ?? 0;
    expect(w(plain)).toBeGreaterThan(0.3);
    expect(w(better)).toBeCloseTo(w(plain) * 0.7, 5);
  });
  it('treats plastic-to-fuel as a critical review that teaches its limits instead of unlocking a plant', () => {
    const o = unlocked();
    const r = applyAction(o, { type: 'research', id: 'plastic-to-fuel' });
    expect(r.result.ok).toBe(true);
    expect(r.state.flags['knows.plasticToFuel']).toBe(1);
    expect(RESEARCH_BY_ID['plastic-to-fuel']?.unlocks).toBeUndefined();
    expect(r.state.eventLog.at(-1)?.text).toMatch(/independent look/);
  });
  it('gives construction reuse cheaper repurposing', () => {
    const o = unlocked();
    const it0 = first(o, 'steelworks');
    const before = disposalPlans(o, it0).find((p) => p.id === 'museum')?.cost ?? 0;
    const r = applyAction(o, { type: 'research', id: 'construction-reuse' }).state;
    expect(disposalPlans(r, it0).find((p) => p.id === 'museum')?.cost).toBe(Math.round(25 * 0.8));
    expect(before).toBe(25);
  });
});
