import { describe, expect, it } from 'vitest';
import { createGame, objectiveStatus, serialize, startAct2, tick } from '../src/sim';
import type { GameState } from '../src/sim';
import { count } from './helpers/act2play';
import { runScript } from './helpers/autoplay';
import { goodPlayPlan } from './helpers/goodplay';
import { CAUTIOUS_WANTS, DIRTY_WANTS, greedyPlan } from './helpers/scripts';

function playAct2(start: GameState, plan: ((s: GameState) => GameState) | null): GameState {
  let s = start;
  while (s.phase === 'act2') {
    if (plan) s = plan(s);
    s = tick(s, 1).state;
  }
  return s;
}

const dirtyAct1 = runScript(createGame('coal-coast'), greedyPlan(DIRTY_WANTS, 1.0)).state;
const act2Start = startAct2(dirtyAct1);
const good = playAct2(act2Start, goodPlayPlan());
const idle = playAct2(act2Start, null);
const late = playAct2(act2Start, goodPlayPlan({ startDelay: 20 }));

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
    expect(dirtyAct1.tempC).toBeGreaterThan(1.25);
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
    expect(st.repurpose).toBe('pending'); // waits for the circular tier
    expect(st.wildlife).toBe('pending');
    expect(good.a2.outcome?.success).toBe(true);
    expect(good.a2.outcome?.pendingRequired).toEqual(['repurpose']);
  });
  it('good play shuts coal, runs a clean grid and keeps the lights on', () => {
    expect(count(good, 'coalpower')).toBe(0);
    expect(count(good, 'steelworks')).toBe(0);
    const years = good.a2.yearly;
    const final = years.at(-1);
    expect(final?.renewableShare).toBeGreaterThan(0.8);
    expect(final?.totalKt ?? 1e9).toBeLessThan(60);
    const blackoutYears = years.filter((y) => y.year > 2025 && y.unmetFrac > 0.02).length;
    expect(blackoutYears).toBeLessThanOrEqual(3);
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
    expect(idle.a2.yearly.some((y) => y.year > 2025 && y.unmetFrac > 0.02)).toBe(true); // summer blackouts as heat rises
    expect(idle.meters.society).toBeLessThan(good.meters.society - 20);
  });
  it('good play beats doing nothing on climate, water and the land', () => {
    expect(good.tempC).toBeLessThan(idle.tempC - 0.5);
    expect(good.cumulativeKt).toBeLessThan(idle.cumulativeKt * 0.6);
    expect(good.a2.yearly.at(-1)?.meanHealth ?? 0).toBeGreaterThan(idle.a2.yearly.at(-1)?.meanHealth ?? 1);
  });
  it('acting 20 years late misses the warming goal: early action matters (committed warming)', () => {
    expect(late.phase).toBe('epilogue');
    expect(late.tempC).toBeGreaterThan(good.tempC + 0.15);
    expect(status(late).warming).toBe('missed');
    expect(late.tempC).toBeLessThan(idle.tempC);
  });
  it('a play-through is fully deterministic', () => {
    const again = playAct2(act2Start, goodPlayPlan());
    expect(serialize(again) === serialize(good)).toBe(true);
  });
  it('good play also works from a cautious Act 1', () => {
    const cautious = runScript(createGame('coal-coast'), greedyPlan(CAUTIOUS_WANTS, 1.0)).state;
    const end = playAct2(startAct2(cautious), goodPlayPlan());
    expect(end.phase).toBe('epilogue');
    expect(end.tempC).toBeLessThan(1.2);
    expect(end.a2.outcome?.success).toBe(true);
  });
});
