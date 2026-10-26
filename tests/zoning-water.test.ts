import { describe, expect, it } from 'vitest';
import { advanceYear, cloneState, createGame, SCENARIO_IDS, TileKind, zoneProblem, ZONE } from '../src/sim';
import { zonableKind } from '../src/sim/zoning';
import { zoneOverlayCodes } from '../src/ui/zonemenu';

/** Water, river, estuary, wetland, beach, rock and pit can never be zoned, and the overlay never draws on them. */
describe('zoning never touches water', () => {
  it('zoneProblem refuses every non-land tile in every scenario, for every zone', () => {
    for (const id of SCENARIO_IDS) {
      const s = cloneState(createGame(id));
      s.year = 2020;
      const g = s.grid;
      for (let i = 0; i < g.kind.length; i++) {
        const k = g.kind[i]!;
        if (zonableKind(k)) continue;
        for (const z of [ZONE.rlow, ZONE.com, ZONE.ind]) expect(zoneProblem(s, i % g.w, Math.floor(i / g.w), z), `${id} tile kind ${k}`).not.toBeNull();
      }
    }
  });

  it('the overlay draws nothing on a water tile even if a zone is stuck there (flooded after zoning, odd save)', () => {
    const s = cloneState(createGame('green-valley'));
    const g = s.grid;
    const water: number[] = [];
    for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === TileKind.River || g.kind[i] === TileKind.Sea || g.kind[i] === TileKind.Estuary) water.push(i);
    expect(water.length).toBeGreaterThan(0);
    for (const i of water) g.zoning[i] = ZONE.rlow;
    const codes = zoneOverlayCodes(s);
    for (const i of water) expect(codes[i]).toBe(0);
  });

  it('growth never builds on a water tile with a stuck zone', () => {
    const s = cloneState(createGame('green-valley'));
    s.budget = 5000;
    const g = s.grid;
    const water: number[] = [];
    for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === TileKind.River && g.building[i] === 0) water.push(i);
    for (const i of water) g.zoning[i] = ZONE.rlow;
    const after = advanceYear(s).state;
    for (const i of water) expect(after.grid.building[i]).toBe(0);
  });
});
