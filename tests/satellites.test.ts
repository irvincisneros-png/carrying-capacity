import { describe, expect, it } from 'vitest';
import {
  applyAction, canPlace, cloneState, createGame, hasGroundStation, hasOverlay, meanReefHealth, MITIGATION, OVERLAY_INFO, overlayData,
  SATELLITE_OVERLAYS, startAct2, tick, TileKind,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { runScript } from './helpers/autoplay';
import { CAUTIOUS_WANTS, greedyPlan } from './helpers/scripts';

const act1 = runScript(createGame('coal-coast'), greedyPlan(CAUTIOUS_WANTS, 1.0)).state;
const base = startAct2(act1);

function withStation(): GameState {
  let s = cloneState(base);
  s.budget = 1000;
  for (let y = 0; y < s.grid.h && !hasGroundStation(s); y++) for (let x = 0; x < s.grid.w && !hasGroundStation(s); x++) {
    if (canPlace(s, 'groundstation', x, y).ok) s = applyAction(s, { type: 'place', building: 'groundstation', x, y }).state;
  }
  return s;
}

/** Runs seasons until a satellite warning (or a marine heatwave) is raised. Warm world, so it does not take long. */
function untilMarine(start: GameState, stopAt: 'warning' | 'heatwave'): GameState {
  let s = cloneState(start);
  s.tempC = 2.1;
  s.a2.eqTempC = 2.1;
  for (let i = 0; i < 400 && s.phase === 'act2'; i++) {
    const r = tick(s, 0.25);
    s = r.state;
    if (stopAt === 'warning' && s.satellites.warning) return s;
    if (stopAt === 'heatwave' && r.events.some((e) => e.type === 'marine-heatwave')) return s;
  }
  throw new Error('no marine heatwave in 100 years');
}

describe('overlays', () => {
  it('need a ground station and money, then switch on a flag', () => {
    const s = cloneState(base);
    s.budget = 500;
    expect(applyAction(s, { type: 'subscribe', overlay: 'sst' }).result.code).toBe('not-open');
    const st = withStation();
    expect(hasGroundStation(st)).toBe(true);
    const before = st.budget;
    const r = applyAction(st, { type: 'subscribe', overlay: 'sst' });
    expect(r.result.ok).toBe(true);
    expect(r.state.budget).toBe(before - OVERLAY_INFO.sst.cost);
    expect(r.state.satellites.overlays.sst).toBe(true);
    expect(r.state.flags['sat.sst']).toBe(true);
    expect(hasOverlay(r.state, 'sst')).toBe(true);
    expect(hasOverlay(r.state, 'fire')).toBe(false);
    expect(r.state.eventLog.at(-1)?.story?.channel).toBe('satellite');
    expect(applyAction(r.state, { type: 'subscribe', overlay: 'sst' }).result.code).toBe('already-done');
    expect(applyAction({ ...st, budget: 5 }, { type: 'subscribe', overlay: 'forest' }).result.code).toBe('no-funds');
    for (const o of SATELLITE_OVERLAYS) expect(OVERLAY_INFO[o].blurb.length).toBeGreaterThan(40);
  });
  it('unlocks all four overlays one by one', () => {
    let s = withStation();
    for (const o of SATELLITE_OVERLAYS) s = applyAction(s, { type: 'subscribe', overlay: o }).state;
    expect(SATELLITE_OVERLAYS.every((o) => s.flags[`sat.${o}`] === true)).toBe(true);
  });
  it('gives the renderer per-tile data: sea warmth, low-lying land, forest health and fire fuel', () => {
    const s = cloneState(base);
    const n = s.grid.kind.length;
    for (const o of SATELLITE_OVERLAYS) {
      const d = overlayData(s, o);
      expect(d).toBeInstanceOf(Float32Array);
      expect(d.length).toBe(n);
      expect(Math.min(...Array.from(d))).toBeGreaterThanOrEqual(0);
      expect(Math.max(...Array.from(d))).toBeLessThanOrEqual(1);
    }
    const sst = overlayData(s, 'sst');
    for (let i = 0; i < n; i++) {
      const sea = s.grid.kind[i] === TileKind.Sea || s.grid.kind[i] === TileKind.Reef;
      if (sea) expect(sst[i]).toBeGreaterThan(0);
      else expect(sst[i]).toBe(0);
    }
    s.tempC = 0.5;
    const cool = overlayData(s, 'sst').reduce((a, b) => a + b, 0);
    s.tempC = 2;
    expect(overlayData(s, 'sst').reduce((a, b) => a + b, 0)).toBeGreaterThan(cool);
    const forest = overlayData(s, 'forest');
    const bush = s.grid.kind.findIndex((k, i) => k === TileKind.Bush && (s.grid.health[i] ?? 0) > 0.5);
    expect(forest[bush]).toBeCloseTo(s.grid.health[bush] ?? 0, 5);
  });
});

describe('early warning of marine heatwaves', () => {
  it('without the sea-temperature overlay a marine heatwave arrives with no warning', () => {
    let s = cloneState(base);
    s.tempC = 2.1;
    s.a2.eqTempC = 2.1;
    let found = false;
    for (let i = 0; i < 400 && !found; i++) {
      const r = tick(s, 0.25);
      s = r.state;
      const e = r.events.find((x) => x.type === 'marine-heatwave');
      if (e) { found = true; expect(e.data?.warned).toBe(0); }
    }
    expect(found).toBe(true);
    expect(s.satellites.warningsGiven).toBe(0);
    expect(s.eventLog.some((e) => e.story?.channel === 'satellite')).toBe(false);
  });
  it('with the overlay, gives one season\'s warning first', () => {
    let s = withStation();
    s = applyAction(s, { type: 'subscribe', overlay: 'sst' }).state;
    const w = untilMarine(s, 'warning');
    const warn = w.satellites.warning;
    expect(warn).not.toBeNull();
    expect(w.satellites.warningsGiven).toBe(1);
    const ev = w.eventLog.filter((e) => e.story?.channel === 'satellite' && e.story.ref === 'marine-heatwave-warning').at(-1);
    expect(ev?.text).toMatch(/Satellite warning/);
    expect(ev?.story?.warning).toEqual({ kind: 'marine-heatwave', arrivesSeasonIndex: warn?.arrivesAt });
    expect(w.eventLog.some((e) => e.type === 'marine-heatwave' && e.seasonIndex >= (warn?.arrivesAt ?? 0))).toBe(false);
    // Next season it lands, and the warning is consumed.
    const r = tick(w, 0.25);
    const hit = r.events.find((e) => e.type === 'marine-heatwave');
    expect(hit).toBeDefined();
    expect(hit?.data?.warned).toBe(1);
    expect(hit?.data?.mitigated).toBe(0);
    expect(r.state.satellites.warning).toBeNull();
  });
  it('lets the player cut runoff in time: much less coral is lost', () => {
    let s = withStation();
    s.budget = 1000;
    s = applyAction(s, { type: 'subscribe', overlay: 'sst' }).state;
    const w = untilMarine(s, 'warning');
    w.budget = 500;
    const act = applyAction(w, { type: 'mitigate' });
    expect(act.result.ok).toBe(true);
    expect(act.result.spent).toBe(MITIGATION.cost);
    expect(act.state.satellites.warning?.mitigated).toBe(true);
    expect(act.state.satellites.mitigations).toBe(1);
    expect(applyAction(act.state, { type: 'mitigate' }).result.code).toBe('already-done');
    const ignored = tick(w, 0.25).state;
    const acted = tick(act.state, 0.25);
    const hit = acted.events.find((e) => e.type === 'marine-heatwave');
    expect(hit?.data?.mitigated).toBe(1);
    expect(hit?.text).toMatch(/Acting on the satellite warning saved a lot of coral/);
    expect(meanReefHealth(acted.state)).toBeGreaterThan(meanReefHealth(ignored));
    const lostIgnored = 1 - meanReefHealth(ignored) / Math.max(1e-9, meanReefHealth(w));
    const lostActed = 1 - meanReefHealth(acted.state) / Math.max(1e-9, meanReefHealth(w));
    expect(lostActed).toBeLessThan(lostIgnored * 0.7);
    expect(acted.state.satellites.savedPct).toBeGreaterThan(0);
    expect(acted.state.grid.waterPollution.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(w.grid.waterPollution.reduce((a, b) => a + b, 0));
  });
  it('has nothing to act on without a warning, and checks the money', () => {
    const s = cloneState(base);
    expect(applyAction(s, { type: 'mitigate' }).result.code).toBe('not-open');
    let st = withStation();
    st = applyAction(st, { type: 'subscribe', overlay: 'sst' }).state;
    const w = untilMarine(st, 'warning');
    w.budget = 2;
    expect(applyAction(w, { type: 'mitigate' }).result.code).toBe('no-funds');
  });
});
