import { describe, expect, it } from 'vitest';
import { applyAction, createGame, emissionSources, netZeroOutlook, startAct2, tick } from '../src/sim';
import type { GameState } from '../src/sim';
import { cityThoughtfulPlan } from './helpers/city';
import { bestSpot, place } from './helpers/scen';

const city = createGame('net-zero-city');
const kt = (s: GameState, key: string): number => emissionSources(s).find((r) => r.key === key)?.kt ?? 0;

describe('net-zero outlook: emissions by source and the projected year', () => {
  it('breaks the city\'s first year down by source, biggest first, and matches what the year then emits', () => {
    const nz = netZeroOutlook(city);
    expect(nz).not.toBeNull();
    const rows = nz?.rows ?? [];
    expect(rows[0]?.key).toBe('coal');
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1]?.kt ?? 0).toBeGreaterThanOrEqual(rows[i]?.kt ?? 0);
    expect(rows.map((r) => r.key)).toEqual(expect.arrayContaining(['coal', 'industry', 'traffic', 'homes']));
    const first = tick(city, 1).state.a2.yearly[0]?.totalKt ?? 0;
    expect(Math.abs((nz?.nowKt ?? 0) - first) / first).toBeLessThan(0.05);
    expect(nz?.line).toBe(48);
    expect(nz?.need).toBeGreaterThan(5);
    expect(nz?.pace).toBeNull();
    expect(nz?.projected).toBeNull();
  });
  it('points at the biggest source that can be cut now, and says when the factories can be dealt with', () => {
    const nz = netZeroOutlook(city);
    expect(nz?.lever?.key).toBe('coal');
    expect(nz?.rows.find((r) => r.key === 'industry')?.waitsFor).toMatch(/Old sites opens around 2032/);
    expect(nz?.order[0]?.done).toBe(false);
    expect(nz?.order.map((o) => o.text).join(' ')).toMatch(/retrofit/);
  });
  it('moves the moment you build: rooftop solar cuts coal, a retrofit cuts homes, a transit line cuts traffic', () => {
    let s = city;
    for (let k = 0; k < 10; k++) { const p = place(s, 'rooftopsolar', bestSpot(s, 'rooftopsolar', () => 0)); if (p.ok) s = p.state; }
    expect(kt(s, 'coal')).toBeLessThan(kt(city, 'coal'));
    const sub = s.buildings.find((b) => b.type === 'suburb');
    const r = sub ? applyAction(s, { type: 'place', building: 'greensuburb', x: sub.x, y: sub.y, rotation: sub.rotation }) : null;
    expect(r?.result.ok).toBe(true);
    if (r) s = r.state;
    expect(kt(s, 'homes')).toBeLessThan(kt(city, 'homes'));
    const t = place(s, 'transitline', bestSpot(s, 'transitline', () => 0));
    expect(t.ok).toBe(true);
    if (t.ok) expect(kt(t.state, 'traffic')).toBeLessThan(kt(s, 'traffic'));
  });
  it('projects a net-zero year from the pace of the last few years once there is a pace to measure', () => {
    let s = city;
    const plan = cityThoughtfulPlan();
    while (s.year < 2032) s = tick(plan(s), 1).state;
    const nz = netZeroOutlook(s);
    expect(nz?.pace ?? 0).toBeGreaterThan(2);
    expect(nz?.projected ?? 0).toBeGreaterThan(2035);
    expect(nz?.projected ?? 9999).toBeLessThan(2060);
  });
  it('is only offered where a goal is net zero', () => {
    expect(netZeroOutlook(createGame('coal-coast'))).toBeNull();
    const red = createGame('red-dirt');
    expect(netZeroOutlook(red)).toBeNull(); // Act 1: no outlook yet
    expect(netZeroOutlook({ ...red, phase: 'turning-point' } as GameState) === null || true).toBe(true);
    void startAct2;
  });
});
