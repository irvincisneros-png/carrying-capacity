import { describe, expect, it } from 'vitest';
import {
  advanceDecade, applyAction, consumeEvents, createGame, deserialize, objectiveStatus, SAVE_VERSION, serialize, startAct2,
  balanceGrid, tick, tickSeasons, yearFraction, climateAt, tempFor, referenceCumulative, eventChances, TileKind,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { runScript } from './helpers/autoplay';
import { act2Sandbox, addBuilding } from './helpers/fixtures';
import { CAUTIOUS_WANTS, DIRTY_WANTS, greedyPlan } from './helpers/scripts';

const cautiousEnd = runScript(createGame('coal-coast'), greedyPlan(CAUTIOUS_WANTS, 1.0)).state;
const dirtyEnd = runScript(createGame('coal-coast'), greedyPlan(DIRTY_WANTS, 1.0)).state;

describe('phase machine', () => {
  it('starts in act1 and finishes act1 at the turning point', () => {
    const g = createGame('coal-coast');
    expect(g.phase).toBe('act1');
    expect(g.turningPoint).toBeNull();
    expect(cautiousEnd.phase).toBe('turning-point');
    expect(cautiousEnd.status).toBe('act1-complete');
    expect(cautiousEnd.year).toBe(2020);
  });
  it('the turning point is pure data from the scenario, with the player\'s stats', () => {
    const tp = dirtyEnd.turningPoint;
    expect(tp?.crisis).toBe('fish-kill');
    expect(tp?.title.length).toBeGreaterThan(3);
    expect(tp?.stats.year).toBe(2020);
    expect(tp?.stats.tempC).toBeCloseTo(dirtyEnd.tempC, 9);
    expect(tp?.stats.estuaryHealth).toBeLessThan(20);
    expect(dirtyEnd.events.some((e) => e.type === 'story')).toBe(true);
  });
  it('nothing can be built at the turning point and advanceDecade is inert', () => {
    const r = applyAction(dirtyEnd, { type: 'place', building: 'cottage', x: 12, y: 12 });
    expect(r.result.ok).toBe(false);
    expect(r.result.code).toBe('game-over');
    expect(advanceDecade(dirtyEnd).report).toBeNull();
    expect(tick(dirtyEnd, 1).seasons).toBe(0);
  });
  it('startAct2 hands over at the scenario Act 2 start year with a bridged world', () => {
    const s = startAct2(dirtyEnd);
    expect(s.phase).toBe('act2');
    expect(s.status).toBe('playing');
    expect(s.year).toBe(2025);
    expect(s.a2.season).toBe(0);
    expect(s.a2.yearly.map((y) => y.year)).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(s.budget).toBeGreaterThan(dirtyEnd.budget);
    expect(s.grid.stage.some((v) => v === 3)).toBe(true);
  });
  it('startAct2 only works from the turning point', () => {
    const g = createGame('coal-coast');
    expect(startAct2(g)).toBe(g);
    const s = startAct2(cautiousEnd);
    expect(startAct2(s)).toBe(s);
  });
  it('place and demolish work in act2 using the Act 2 catalogue', () => {
    const s = startAct2(cautiousEnd);
    const wanted = s.buildings.find((b) => b.type === 'cottage');
    expect(wanted).toBeDefined();
    const d = applyAction(s, { type: 'demolish', x: wanted?.x ?? 0, y: wanted?.y ?? 0 });
    expect(d.result.ok).toBe(true);
    expect(d.state.buildings.length).toBe(s.buildings.length - 1);
    expect(d.state.version).toBe(s.version + 1);
    // demolished ground is bare
    const i = (wanted?.y ?? 0) * s.grid.w + (wanted?.x ?? 0);
    expect(d.state.grid.stage[i]).toBe(0);
  });
  it('bushland cannot be cleared in act2', () => {
    const s = act2Sandbox(TileKind.Bush);
    const r = applyAction(s, { type: 'clear', x: 3, y: 3 });
    expect(r.result.ok).toBe(false);
    expect(r.result.code).toBe('locked');
  });
});

describe('season clock', () => {
  const start = startAct2(cautiousEnd);
  const ser = (s: GameState): string => serialize(s);

  it('tick(1) = 4 x tick(0.25) = 100 x tick(0.01) exactly', () => {
    const a = tick(start, 1).state;
    let b = start;
    for (let i = 0; i < 4; i++) b = tick(b, 0.25).state;
    let c = start;
    for (let i = 0; i < 100; i++) c = tick(c, 0.01).state;
    expect(a.year).toBe(2026);
    expect(a.a2.clockMicro).toBe(0);
    expect(ser(b) === ser(a)).toBe(true);
    expect(ser(c) === ser(a)).toBe(true);
  });
  it('is frame-rate independent over decades, including events', () => {
    const a = tick(start, 20).state;
    let b = start;
    for (let i = 0; i < 80; i++) b = tick(b, 0.25).state;
    let c = start;
    for (let i = 0; i < 200; i++) c = tick(c, 0.1).state;
    expect(a.eventLog.length).toBeGreaterThan(0);
    expect(ser(b) === ser(a)).toBe(true);
    expect(ser(c) === ser(a)).toBe(true);
  });
  it('uneven frame times give the same result', () => {
    const a = tick(start, 2).state;
    let b = start;
    for (const dt of [0.3, 0.7, 0.05, 0.45, 0.5]) b = tick(b, dt).state;
    expect(ser(b) === ser(a)).toBe(true);
  });
  it('processes whole seasons only; partial time just accumulates', () => {
    const r1 = tick(start, 0.1);
    expect(r1.seasons).toBe(0);
    expect(r1.state.version).toBe(start.version);
    expect(r1.state.a2.clockMicro).toBeGreaterThan(0);
    expect(yearFraction(r1.state)).toBeCloseTo(2025.1, 6);
    const r2 = tick(r1.state, 0.2);
    expect(r2.seasons).toBe(1);
    expect(r2.state.a2.season).toBe(1);
    expect(r2.state.version).toBe(start.version + 1);
    expect(tickSeasons(start, 4).state.year).toBe(2026);
  });
  it('ignores non-positive dt and does not mutate the input', () => {
    const before = ser(start);
    expect(tick(start, 0).state).toBe(start);
    expect(tick(start, -1).state).toBe(start);
    tick(start, 3);
    expect(ser(start)).toBe(before);
  });
  it('seasons change demand: summer and winter homes demand exceed autumn and spring', () => {
    const s = act2Sandbox();
    addBuilding(s, 'suburb', 3, 3);
    const d = (season: 0 | 1 | 2 | 3): number => balanceGrid({ ...s, a2: { ...s.a2, season } }, 700).report.demand.homes;
    expect(d(0)).toBeGreaterThan(d(1));
    expect(d(2)).toBeGreaterThan(d(3));
  });
});

describe('climate: committed warming and continuity with Act 1', () => {
  it('Act 2 temperature continues from where Act 1 ended', () => {
    const s = startAct2(dirtyEnd);
    expect(Math.abs(s.tempC - dirtyEnd.tempC)).toBeLessThan(0.1);
    expect(s.a2.yearly[0] && Math.abs(s.a2.yearly[0].tempC - dirtyEnd.tempC)).toBeLessThan(0.05);
    expect(s.co2).toBeGreaterThan(dirtyEnd.co2);
  });
  it('temperature relaxes towards equilibrium by 1 - e^(-1/20) per year', () => {
    const s = act2Sandbox();
    s.cumulativeKt = referenceCumulative(2025) * 1.6; // far hotter equilibrium than T now
    s.tempC = 1.0;
    const t0 = s.tempC;
    const next = tick(s, 1).state;
    const eq = next.a2.eqTempC;
    expect(eq).toBeGreaterThan(t0 + 0.3);
    expect(next.tempC).toBeCloseTo(t0 + (eq - t0) * (1 - Math.exp(-1 / 20)), 9);
    expect(next.tempC).toBeLessThan(eq);
  });
  it('warming keeps rising for decades after emissions stop (committed warming)', () => {
    const s = act2Sandbox();
    s.cumulativeKt = referenceCumulative(2025) * 1.3;
    s.tempC = 1.0;
    let cur = s;
    let last = cur.tempC;
    for (let y = 0; y < 15; y++) {
      cur = tick(cur, 1).state; // no buildings: zero emissions
      expect(cur.tempC).toBeGreaterThan(last);
      last = cur.tempC;
    }
    // still short of equilibrium
    expect(cur.tempC).toBeLessThan(cur.a2.eqTempC);
  });
  it('climateAt/tempFor are unchanged for Act 1 years', () => {
    expect(tempFor(280)).toBeCloseTo(0.0, 9);
    expect(climateAt(2020, referenceCumulative(2020)).m).toBeCloseTo(1, 9);
  });
});

describe('event probabilities scale with warming and scenario severity', () => {
  const p = (s: GameState, t: string): number => eventChances(s).find((e) => e.type === t)?.p ?? -1;
  it('warmer worlds have more heatwaves, fires, floods and bleaching', () => {
    const cool = act2Sandbox(TileKind.Land, { year: 2025 });
    const hot = act2Sandbox(TileKind.Land, { year: 2025 });
    for (let i = 0; i < 64; i++) hot.grid.stage[i] = 3, hot.grid.health[i] = 0.9, cool.grid.stage[i] = 3, cool.grid.health[i] = 0.9;
    cool.tempC = 0.5;
    hot.tempC = 2.5;
    for (const t of ['heatwave', 'bushfire', 'drought', 'flood']) {
      expect(p(hot, t)).toBeGreaterThan(p(cool, t) * 1.5);
    }
  });
  it('scales linearly with the scenario eventSeverity and is zero for the tutorial', () => {
    const a = act2Sandbox(TileKind.Land, { scenario: 'coal-coast' });
    const b = act2Sandbox(TileKind.Land, { scenario: 'reef-island' });
    const z = act2Sandbox(TileKind.Land, { scenario: 'green-valley' });
    for (const s of [a, b, z]) s.tempC = 1.5;
    expect(p(b, 'heatwave') / p(a, 'heatwave')).toBeCloseTo(1.5, 6);
    expect(p(z, 'heatwave')).toBe(0);
    expect(p(z, 'drought')).toBe(0);
  });
  it('heatwaves happen mostly in summer', () => {
    const s = act2Sandbox();
    s.tempC = 1.5;
    const by = [0, 1, 2, 3].map((season) => p({ ...s, a2: { ...s.a2, season: season as 0 | 1 | 2 | 3 } }, 'heatwave'));
    expect(by[0]).toBeGreaterThan(by[1] ?? 0);
    expect(by[0]).toBeGreaterThan(by[2] ?? 0);
    expect(by[0]).toBeGreaterThan(by[3] ?? 0);
  });
});

describe('event system', () => {
  it('is deterministic for the same seed and differs between seeds', () => {
    const run = (seed: number): string => {
      const g = runScript(createGame('coal-coast', seed), greedyPlan(DIRTY_WANTS, 1.0)).state;
      return JSON.stringify(tick(startAct2(g), 40).state.eventLog);
    };
    expect(run(1850)).toBe(run(1850));
    expect(run(1850)).not.toBe(run(99));
    expect(run(1850).length).toBeGreaterThan(200);
  });
  it('events come with human-readable text and are queued until consumed', () => {
    const s = tick(startAct2(dirtyEnd), 10).state;
    expect(s.events.length).toBeGreaterThan(0);
    for (const e of s.eventLog) {
      expect(e.text.length).toBeGreaterThan(15);
      // Story events from Act 1 (residents, dilemma cards) are older; the hazards are all Act 2.
      if (e.type !== 'story') expect(e.year).toBeGreaterThanOrEqual(2020);
    }
    const c = consumeEvents(s);
    expect(c.events.length).toBe(s.events.length);
    expect(c.state.events).toHaveLength(0);
    expect(c.state.eventLog.length).toBe(s.eventLog.length);
  });
  it('tick reports the events it raised', () => {
    const r = tick(startAct2(dirtyEnd), 10);
    expect(r.events.length).toBeGreaterThan(0);
    expect(r.state.eventLog).toEqual(expect.arrayContaining(r.events));
  });
  it('a scenario with eventSeverity 0 has no random hazards', () => {
    const s = act2Sandbox(TileKind.Land, { scenario: 'green-valley' });
    for (let i = 0; i < 30; i++) s.grid.stage[i] = 3, s.grid.health[i] = 0.9;
    s.tempC = 3;
    const out = tick(s, 50).state;
    expect(out.eventLog).toHaveLength(0);
  });
});

describe('fail states', () => {
  it('any meter at 0 for 3 consecutive years fails the town', () => {
    const s = act2Sandbox(); // empty town: Society = 40 baseline
    s.a2.societyAdjust = -60;
    let cur = s;
    cur = tick(cur, 1).state;
    expect(cur.meters.society).toBe(0);
    expect(cur.phase).toBe('act2');
    expect(cur.a2.zeroYears.society).toBe(1);
    cur = tick(cur, 1).state;
    expect(cur.phase).toBe('act2');
    cur = tick(cur, 1).state;
    expect(cur.phase).toBe('failed');
    expect(cur.status).toBe('failed');
    expect(cur.a2.failure?.reason).toBe('meter-collapse');
    expect(cur.a2.failure?.text).toMatch(/Society/);
    // inert once failed
    expect(tick(cur, 5).seasons).toBe(0);
    expect(applyAction(cur, { type: 'place', building: 'nursery', x: 3, y: 3 }).result.code).toBe('game-over');
  });
  it('recovering before 3 years resets the count', () => {
    const s = act2Sandbox();
    s.a2.societyAdjust = -60;
    let cur = tick(tick(s, 1).state, 1).state;
    expect(cur.a2.zeroYears.society).toBe(2);
    cur.a2.societyAdjust = 0;
    cur = tick(cur, 1).state;
    expect(cur.a2.zeroYears.society).toBe(0);
    expect(cur.phase).toBe('act2');
  });
  it('exceeding the warming cap fails the town', () => {
    const s = act2Sandbox();
    s.cumulativeKt = 1e7;
    s.tempC = 2.9;
    const out = tick(s, 1).state;
    expect(out.phase).toBe('failed');
    expect(out.a2.failure?.reason).toBe('warming-cap');
    expect(out.a2.failure?.text).toMatch(/Warming/);
  });
  it('reaching the end year moves to the epilogue with an outcome', () => {
    const s = act2Sandbox(TileKind.Land, { year: 2099 });
    const out = tick(s, 1).state;
    expect(out.phase).toBe('epilogue');
    expect(out.status).toBe('act2-complete');
    expect(out.year).toBe(2100);
    expect(out.a2.outcome).not.toBeNull();
    expect(out.a2.outcome?.objectives.length).toBe(5);
  });
});

describe('objectives', () => {
  it('coal-coast objectives are data: warming, estuary, society, and a pending repurpose goal', () => {
    const s = act2Sandbox();
    const o = objectiveStatus(s);
    expect(o.map((x) => x.id)).toEqual(['warming', 'estuary', 'society', 'repurpose', 'wildlife']);
    const byId = Object.fromEntries(o.map((x) => [x.id, x]));
    expect(byId.warming?.target).toBe(1.8);
    expect(byId.warming?.op).toBe('<=');
    expect(byId.repurpose?.status).toBe('pending');
    expect(byId.repurpose?.pendingTier).toBe('circular');
    expect(byId.wildlife?.bonus).toBe(true);
    expect(byId.wildlife?.status).toBe('pending');
  });
  it('is provisional before 2100 and final at the end', () => {
    const s = act2Sandbox(TileKind.Land, { year: 2060 });
    s.tempC = 1.5;
    const mid = Object.fromEntries(objectiveStatus(s).map((x) => [x.id, x.status]));
    expect(mid.warming).toBe('on-track');
    s.tempC = 2.0;
    expect(objectiveStatus(s).find((x) => x.id === 'warming')?.status).toBe('at-risk');
    s.year = 2100;
    expect(objectiveStatus(s).find((x) => x.id === 'warming')?.status).toBe('missed');
    s.tempC = 1.7;
    expect(objectiveStatus(s).find((x) => x.id === 'warming')?.status).toBe('met');
  });
  it('later tiers plug in by setting flags[metric.<id>]', () => {
    const s = act2Sandbox(TileKind.Land, { year: 2100 });
    s.flags['metric.act1Repurposed'] = 100;
    s.flags['metric.wildlifeThriving'] = 1;
    const o = Object.fromEntries(objectiveStatus(s).map((x) => [x.id, x.status]));
    expect(o.repurpose).toBe('met');
    expect(o.wildlife).toBe('met');
  });
  it('estuary health objective follows water pollution', () => {
    const s = act2Sandbox(TileKind.Land, { year: 2100 });
    for (let i = 0; i < 10; i++) s.grid.kind[i] = TileKind.Estuary;
    const status = (): string | undefined => objectiveStatus(s).find((x) => x.id === 'estuary')?.status;
    expect(status()).toBe('met');
    for (let i = 0; i < 10; i++) s.grid.waterPollution[i] = 3;
    expect(status()).toBe('missed');
  });
});

describe('save / load for Act 2', () => {
  it('has bumped the save version to 3 (empathy layers)', () => {
    expect(SAVE_VERSION).toBe(3);
  });
  it('round-trips an Act 2 game exactly, including typed arrays, events and the clock', () => {
    let s = startAct2(dirtyEnd);
    s = tick(s, 12.4).state; // mid-season clock, events, active events
    const text = serialize(s);
    const back = deserialize(text);
    expect(back).not.toBeNull();
    expect(serialize(back as GameState)).toBe(text);
    expect(back?.grid.health).toBeInstanceOf(Float32Array);
    expect(back?.grid.stage).toBeInstanceOf(Uint8Array);
    expect(back?.grid.weed).toBeInstanceOf(Uint8Array);
    expect(back?.grid.chunkVersion).toBeInstanceOf(Uint32Array);
    expect(Array.from(back?.grid.health ?? [])).toEqual(Array.from(s.grid.health));
    expect(back?.phase).toBe('act2');
    expect(back?.a2.clockMicro).toBe(s.a2.clockMicro);
    expect(back?.eventLog.length).toBe(s.eventLog.length);
  });
  it('a loaded Act 2 game keeps simulating identically', () => {
    const s = tick(startAct2(dirtyEnd), 7.3).state;
    const back = deserialize(serialize(s)) as GameState;
    expect(serialize(tick(back, 9).state)).toBe(serialize(tick(s, 9).state));
  });
  it('round-trips the turning point and the epilogue and a failed game', () => {
    const finished = tick(startAct2(dirtyEnd), 80).state;
    expect(finished.phase).toBe('epilogue');
    for (const s of [dirtyEnd, finished]) {
      const back = deserialize(serialize(s));
      expect(back?.phase).toBe(s.phase);
      expect(serialize(back as GameState) === serialize(s)).toBe(true);
    }
    expect(deserialize(serialize(finished))?.a2.outcome?.objectives.length).toBe(5);
    const failed = startAct2(dirtyEnd);
    failed.cumulativeKt = 1e7;
    failed.tempC = 2.9;
    const f = tick(failed, 1).state;
    expect(deserialize(serialize(f))?.a2.failure?.reason).toBe('warming-cap');
  });
  const asV1 = (s: GameState): string => {
    const o = JSON.parse(serialize(s)) as Record<string, unknown> & { grid: Record<string, unknown> };
    for (const k of ['phase', 'a2', 'flags', 'events', 'eventLog', 'turningPoint']) delete o[k];
    for (const k of ['health', 'stage', 'weed', 'chunkVersion']) delete o.grid[k];
    o.saveVersion = 1;
    return JSON.stringify(o);
  };
  it('migrates version 1 saves: mid Act 1 stays Act 1 with empty Act 2 layers', () => {
    let s = createGame('coal-coast');
    s = advanceDecade(s).state;
    s = advanceDecade(s).state;
    const back = deserialize(asV1(s));
    expect(back).not.toBeNull();
    expect(back?.saveVersion).toBe(SAVE_VERSION);
    expect(back?.phase).toBe('act1');
    expect(back?.year).toBe(1870);
    expect(back?.grid.health.length).toBe(s.grid.kind.length);
    expect(advanceDecade(back as GameState).state.year).toBe(1880);
  });
  it('migrates a finished version 1 Act 1 to the turning point and Act 2 can start', () => {
    const back = deserialize(asV1(cautiousEnd));
    expect(back?.phase).toBe('turning-point');
    expect(back?.turningPoint?.crisis).toBe('fish-kill');
    expect(startAct2(back as GameState).phase).toBe('act2');
  });
  it('rejects corrupted version 2 saves', () => {
    const o = JSON.parse(serialize(startAct2(cautiousEnd))) as Record<string, unknown> & { a2: Record<string, unknown>; grid: { health: number[] } };
    const bad = (mut: (x: typeof o) => void): string | null => {
      const c = JSON.parse(JSON.stringify(o)) as typeof o;
      mut(c);
      return JSON.stringify(c);
    };
    expect(deserialize(bad((c) => { c.a2.season = 7; }))).toBeNull();
    expect(deserialize(bad((c) => { delete c.a2.yearEm; }))).toBeNull();
    expect(deserialize(bad((c) => { c.grid.health.pop(); }))).toBeNull();
    expect(deserialize(bad((c) => { c.phase = 'nirvana'; }))).toBeNull();
    expect(deserialize(bad((c) => { c.turningPoint = null; }))).toBeNull();
    expect(deserialize(bad((c) => { c.year = 2500; }))).toBeNull();
  });
});
