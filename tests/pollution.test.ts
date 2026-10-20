import { describe, expect, it } from 'vitest';
import { advanceDecade, applyAction, POLLUTION_PERSISTENCE, TileKind } from '../src/sim';
import { paint, sandbox } from './helpers/fixtures';

const at = (g: { w: number }, x: number, y: number): number => y * g.w + x;

describe('local pollution fields', () => {
  it('start at zero and are Float32Arrays of the map size', () => {
    const s = sandbox();
    expect(s.grid.airPollution).toBeInstanceOf(Float32Array);
    expect(s.grid.waterPollution).toHaveLength(1024);
    expect(s.grid.soilContamination.every((v) => v === 0)).toBe(true);
  });
  it('a source adds to nearby tiles with falloff, nothing far away', () => {
    let s = sandbox(TileKind.Land, { year: 1920 });
    paint(s, 19, 0, 1, 32, TileKind.River);
    s = applyAction(s, { type: 'place', building: 'coalpower', x: 15, y: 15 }).state;
    expect(s.buildings).toHaveLength(1);
    const g0 = s.grid;
    expect(g0.airPollution[at(g0, 15, 15)]).toBe(0); // fields only update on advance
    s = advanceDecade(s).state;
    const g = s.grid;
    const inside = g.airPollution[at(g, 15, 15)] ?? 0;
    const near = g.airPollution[at(g, 17, 15)] ?? 0;
    const mid = g.airPollution[at(g, 18, 14)] ?? 0;
    const far = g.airPollution[at(g, 28, 15)] ?? 0;
    expect(inside).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(0);
    expect(far).toBe(0);
    // Coal power only emits to the air.
    expect(g.waterPollution[at(g, 15, 15)]).toBe(0);
    expect(g.soilContamination[at(g, 15, 15)]).toBe(0);
  });
  it('different buildings feed different fields', () => {
    let s = sandbox(TileKind.Land, { year: 1900 });
    paint(s, 20, 5, 1, 1, TileKind.Sea);
    s = applyAction(s, { type: 'place', building: 'farm', x: 3, y: 3 }).state;
    s = applyAction(s, { type: 'place', building: 'landfill', x: 10, y: 10 }).state;
    s = advanceDecade(s).state;
    expect(s.grid.waterPollution[at(s.grid, 3, 3)]).toBeGreaterThan(0); // farm runoff
    expect(s.grid.soilContamination[at(s.grid, 10, 10)]).toBeGreaterThan(0); // landfill
    expect(s.grid.waterPollution[at(s.grid, 10, 10)]).toBeGreaterThan(0);
  });
  it('decays each decade once the source is gone', () => {
    let s = sandbox(TileKind.Land, { year: 1900 });
    s = applyAction(s, { type: 'place', building: 'factory', x: 10, y: 10 }).state;
    s = advanceDecade(s).state;
    const v1 = s.grid.airPollution[at(s.grid, 10, 10)] ?? 0;
    s = applyAction(s, { type: 'demolish', x: 10, y: 10 }).state;
    s = advanceDecade(s).state;
    const v2 = s.grid.airPollution[at(s.grid, 10, 10)] ?? 0;
    expect(v2).toBeCloseTo(v1 * POLLUTION_PERSISTENCE, 4);
    s = advanceDecade(s).state;
    expect(s.grid.airPollution[at(s.grid, 10, 10)] ?? 0).toBeCloseTo(v1 * POLLUTION_PERSISTENCE ** 2, 4);
  });
  it('reaches a steady state under a constant source', () => {
    let s = sandbox(TileKind.Land, { year: 1850 });
    s = applyAction(s, { type: 'place', building: 'cottage', x: 1, y: 1 }).state; // no pollution
    paint(s, 0, 20, 1, 1, TileKind.Rock);
    s = applyAction({ ...s, year: 1900 }, { type: 'place', building: 'factory', x: 10, y: 10 }).state;
    const vals: number[] = [];
    for (let i = 0; i < 8; i++) {
      s = advanceDecade({ ...s, status: 'playing', year: 1900 }).state;
      vals.push(s.grid.airPollution[at(s.grid, 10, 10)] ?? 0);
    }
    const last = vals[7] ?? 0, prev = vals[6] ?? 0;
    expect(Math.abs(last - prev)).toBeLessThan(0.05);
  });
  it('does not mutate the previous state when advancing', () => {
    let s = sandbox(TileKind.Land, { year: 1900 });
    s = applyAction(s, { type: 'place', building: 'factory', x: 10, y: 10 }).state;
    const snap = Array.from(s.grid.airPollution);
    advanceDecade(s);
    expect(Array.from(s.grid.airPollution)).toEqual(snap);
  });
});
