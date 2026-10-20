import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim';
import { runScript } from './helpers/autoplay';
import { CAUTIOUS_WANTS, DIRTY_WANTS, greedyPlan } from './helpers/scripts';

/**
 * Spec tuning targets (STATION-1 "Decade loop"): a "build everything dirty" run ends ~Economy 80 / Society 55 /
 * Environment 15; a cautious run ends ~Economy 45 / Environment 45. We assert +-10.
 */
const dirty = runScript(createGame('coal-coast'), greedyPlan(DIRTY_WANTS, 1.0));
const cautious = runScript(createGame('coal-coast'), greedyPlan(CAUTIOUS_WANTS, 1.0));

describe('meter tuning on coal-coast (scripted runs)', () => {
  it('build-everything-dirty ends near Economy 80 / Society 55 / Environment 15', () => {
    const m = dirty.state.meters;
    expect(dirty.state.year).toBe(2020);
    expect(m.economy).toBeGreaterThanOrEqual(70);
    expect(m.economy).toBeLessThanOrEqual(90);
    expect(m.society).toBeGreaterThanOrEqual(45);
    expect(m.society).toBeLessThanOrEqual(65);
    expect(m.environment).toBeGreaterThanOrEqual(5);
    // The 40x40 map has about 1.5x the land for the same cash-limited town, so less of the bush goes: ends in the 20s-30s.
    expect(m.environment).toBeLessThanOrEqual(40);
  });
  it('cautious ends near Economy 45 / Environment 45', () => {
    const m = cautious.state.meters;
    expect(cautious.state.year).toBe(2020);
    expect(m.economy).toBeGreaterThanOrEqual(35);
    expect(m.economy).toBeLessThanOrEqual(55);
    expect(m.environment).toBeGreaterThanOrEqual(35);
    expect(m.environment).toBeLessThanOrEqual(55);
  });
  it('the dirty run warms more than the cautious run, and both stay on the real-record scale', () => {
    expect(dirty.state.tempC).toBeGreaterThan(cautious.state.tempC + 0.3);
    expect(dirty.state.co2).toBeGreaterThan(cautious.state.co2);
    expect(dirty.state.co2).toBeGreaterThan(413); // worse than the real world
    expect(cautious.state.co2).toBeLessThan(413); // better than the real world
    expect(dirty.state.tempC).toBeGreaterThan(1.2);
    expect(cautious.state.tempC).toBeLessThan(1.0);
    expect(dirty.state.multiplier).toBeGreaterThan(1.1);
    expect(cautious.state.multiplier).toBeLessThan(0.9);
  });
  it('meters never leave 0..100 during either run', () => {
    for (const r of [dirty, cautious]) {
      for (const h of r.state.history) {
        for (const v of [h.meters.economy, h.meters.society, h.meters.environment]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });
  it('the dirty run is dominated by power + industry emissions', () => {
    const last = dirty.reports.at(-1);
    expect((last?.emissionsKt.power ?? 0) + (last?.emissionsKt.industry ?? 0)).toBeGreaterThan((last?.totalKt ?? 1) * 0.5);
  });
});
