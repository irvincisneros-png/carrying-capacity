import { describe, expect, it } from 'vitest';
import { buildReportCard, createGame, objectiveStatus, serialize, startAct2, tick } from '../src/sim';
import type { GameState } from '../src/sim';
import { count } from './helpers/act2play';
import { runScript } from './helpers/autoplay';
import { goodPlayPlan } from './helpers/goodplay';
import { CAUTIOUS_WANTS, DIRTY_ROADS, DIRTY_WANTS, greedyPlan } from './helpers/scripts';

function playAct2(start: GameState, plan: ((s: GameState) => GameState) | null): GameState {
  let s = start;
  while (s.phase === 'act2') {
    if (plan) s = plan(s);
    s = tick(s, 1).state;
  }
  return s;
}

const dirtyAct1 = runScript(createGame('coal-coast'), greedyPlan(DIRTY_WANTS, 1.0, 30, DIRTY_ROADS)).state;
const act2Start = startAct2(dirtyAct1);
const good = playAct2(act2Start, goodPlayPlan());
const idle = playAct2(act2Start, null);
// Re-banded from a 20 year delay (round 7, bridges): from the cooler dirty start 20 years late still ends at 1.69 C, inside the 1.8 goal; 25 years late misses it (1.84 C).
const late = playAct2(act2Start, goodPlayPlan({ startDelay: 25 }));

const status = (s: GameState): Record<string, string> => Object.fromEntries(objectiveStatus(s).map((o) => [o.id, o.status]));

/**
 * Tuning record (coal-coast, "build everything dirty" Act 1, seed 1850), see the final report:
 *   Act 1 ends T 1.31 C, cumulative 7737 kt, ~175 kt/yr.
 *   Good play: 2100 T ~1.63 C, estuary ~66, Society ~74, Economy ~65, ~32 kt/yr emissions.
 *   Idle:      2100 T ~2.37 C, estuary 0, Society ~36, Economy ~82.
 *   Starting good play 20 years late: T ~1.91 C (objective missed) - committed warming makes early action matter.
 */
describe('scripted Act 2 playthroughs on coal-coast (dirty Act 1 start)', () => {
  it('the Act 1 start is the dirty worst case', () => {
    // Re-banded from 1.25 (round 7, bridges): the entrance road moved off the water, the town built is a little cooler (1.17 C).
    expect(dirtyAct1.tempC).toBeGreaterThan(1.15);
    expect(count(dirtyAct1, 'coalpower')).toBe(4);
    expect(act2Start.year).toBe(2025);
  });

  it('good play reaches 2100 and achieves the main objectives', () => {
    expect(good.phase).toBe('epilogue');
    expect(good.year).toBe(2100);
    expect(good.tempC).toBeLessThanOrEqual(1.8);
    expect(good.tempC).toBeGreaterThan(1.3); // some warming is already committed
    const st = status(good);
    expect(st.warming).toBe('met');
    expect(st.estuary).toBe('met');
    expect(st.society).toBe('met');
    // The circular tier and wildlife now supply their metrics. This script never repurposes anything, so it misses
    // the circular objective (the full-marks run is in tests/full-run.test.ts).
    expect(st.repurpose).toBe('missed');
    // (Zoning phase 2: the dirty start now clears less bush for its homes, so the koalas hold on in this run too; wildlife is a bonus goal,
    // so it is not asserted here. tests/full-run.test.ts is the run that earns it on purpose.)
    expect(good.a2.outcome?.success).toBe(false);
    expect(good.a2.outcome?.pendingRequired).toEqual([]);
    expect(good.a2.outcome?.objectives.filter((o) => !o.bonus && o.status !== 'met').map((o) => o.id)).toEqual(['repurpose']);
  });
  it('good play shuts coal, runs a clean grid and keeps the lights on', () => {
    expect(count(good, 'coalpower')).toBe(0);
    expect(count(good, 'steelworks')).toBe(0);
    const years = good.a2.yearly;
    const final = years.at(-1);
    expect(final?.renewableShare).toBeGreaterThan(0.8);
    expect(final?.totalKt ?? 1e9).toBeLessThan(60);
    const blackoutYears = years.filter((y) => y.year > 2025 && y.unmetFrac > 0.02).length;
    // Re-banded from 3 (round 6, 64x64 map): the ridge turbines and batteries sit further from the town, so their roads cost more and the
    // clean capacity arrives a few years later; the 2035-2055 years with a short summer evening are 5, not 3.
    expect(blackoutYears).toBeLessThanOrEqual(5);
  });
  it('good play restores land and cleans the estuary', () => {
    expect(good.a2.yearly.at(-1)?.meanHealth ?? 0).toBeGreaterThan(0.25);
    expect(good.meters.environment).toBeGreaterThan(idle.meters.environment + 15);
    expect(good.a2.yearly.at(-1)?.estuaryHealth ?? 0).toBeGreaterThanOrEqual(60);
  });

  it('doing nothing misses the objectives (but the town limps on)', () => {
    expect(idle.phase).toBe('epilogue');
    const st = status(idle);
    expect(st.warming).toBe('missed');
    expect(st.estuary).toBe('missed');
    expect(idle.a2.outcome?.success).toBe(false);
    expect(idle.tempC).toBeGreaterThan(2.0);
    expect(idle.a2.yearly.at(-1)?.estuaryHealth).toBeLessThan(20);
    expect(count(idle, 'coalpower')).toBe(4);
    // Re-banded from 0.02 (round 7, bridges): the cooler dirty start makes the idle summers a little less short of power (worst year 1%).
    // Zoning phase 2: the dirty start is capped at the old worst-case industry (see DIRTY_WANTS), a smaller town on four coal stations, and its
    // idle summers never run short of power (worst year 0%, was 1%), so this is no longer asserted; the idle town still limps on to a worse Society.

    expect(idle.meters.society).toBeLessThan(good.meters.society - 20);
  });
  it('good play beats doing nothing on climate, water and the land', () => {
    // Re-banded from 0.5 C and 0.6 (zoning phase 2): the dirty start is hotter at the turning point (1.47 C, was 1.17 C: zoned homes let the
    // same script build out decades sooner), and that committed warming is shared by both runs, so good play beats idle by 0.39 C (was 0.65)
    // and emits 69% as much (was 54%).
    expect(good.tempC).toBeLessThan(idle.tempC - 0.35);
    expect(good.cumulativeKt).toBeLessThan(idle.cumulativeKt * 0.75);
    expect(good.a2.yearly.at(-1)?.meanHealth ?? 0).toBeGreaterThan(idle.a2.yearly.at(-1)?.meanHealth ?? 1);
  });
  it('acting 25 years late misses the warming goal: early action matters (committed warming)', () => {
    expect(late.phase).toBe('epilogue');
    expect(late.tempC).toBeGreaterThan(good.tempC + 0.15);
    expect(status(late).warming).toBe('missed');
    expect(late.tempC).toBeLessThan(idle.tempC);
  });
  it('doing nothing leaves every resident\'s story ending badly (more in tests/full-run.test.ts)', () => {
    const rc = buildReportCard(idle);
    expect(rc.stars).toBe(0);
    // Re-banded (see tests/full-run.test.ts; round 6 to three of the six on the 64x64 map, where the idle town is a little smaller
    // and Priya's warming reading stays under 2.2 C): at least three of the six end badly and none ends well.
    // Re-banded again to two of the six (zoning phase 2): the idle town is the capped dirty worst case and its Society holds a little better (49.7, was 41.9).
    expect(rc.residents.filter((r) => r.quality === 'bad').length).toBeGreaterThanOrEqual(2);
    expect(rc.residents.some((r) => r.quality === 'good')).toBe(false);
    // Good play of the engine only (no listening, no waste hierarchy) is better, but cannot reach the stars either.
    const goodCard = buildReportCard(good);
    expect(goodCard.stars).toBe(0);
    expect(goodCard.residents.filter((r) => r.quality === 'good').length).toBeGreaterThan(rc.residents.filter((r) => r.quality === 'good').length);
  });
  it('a play-through is fully deterministic', () => {
    const again = playAct2(act2Start, goodPlayPlan());
    expect(serialize(again) === serialize(good)).toBe(true);
  });
  it('good play also works from a cautious Act 1', { timeout: 180000 }, () => {
    const cautious = runScript(createGame('coal-coast'), greedyPlan(CAUTIOUS_WANTS, 1.0)).state;
    const end = playAct2(startAct2(cautious), goodPlayPlan());
    expect(end.phase).toBe('epilogue');
    expect(end.tempC).toBeLessThan(1.2);
    expect(status(end).warming).toBe('met');
    expect(status(end).estuary).toBe('met');
    expect(status(end).society).toBe('met');
  });
});
