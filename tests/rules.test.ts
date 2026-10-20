import { describe, expect, it } from 'vitest';
import { applyAction, canPlace, rectDistance, TileKind } from '../src/sim';
import type { BuildingId } from '../src/sim';
import { paint, sandbox } from './helpers/fixtures';

describe('placement: general constraints', () => {
  it('rejects out-of-bounds, including partially off the map', () => {
    const s = sandbox();
    expect(canPlace(s, 'cottage', -1, 0).code).toBe('out-of-bounds');
    expect(canPlace(s, 'cottage', 32, 0).code).toBe('out-of-bounds');
    expect(canPlace(s, 'cottage', 0, 32).code).toBe('out-of-bounds');
    expect(canPlace(s, 'farm', 31, 0).code).toBe('out-of-bounds');
    expect(canPlace(s, 'farm', 0, 31).code).toBe('out-of-bounds');
    expect(canPlace(s, 'cottage', 31, 31).ok).toBe(true);
    expect(canPlace(s, 'farm', 30, 30).ok).toBe(true);
  });
  it('rejects overlap with any footprint tile', () => {
    let s = sandbox();
    s = applyAction(s, { type: 'place', building: 'farm', x: 5, y: 5 }).state;
    for (const [x, y] of [[5, 5], [6, 6], [4, 4], [6, 5]] as const) {
      const c = canPlace(s, 'farm', x, y);
      expect(c.ok).toBe(false);
      expect(c.code).toBe('occupied');
    }
    expect(canPlace(s, 'farm', 7, 5).ok).toBe(true);
    expect(canPlace(s, 'farm', 3, 5).ok).toBe(true);
  });
  it('rejects building on water, beach and rock for land buildings, with readable reasons', () => {
    const s = sandbox();
    paint(s, 0, 0, 1, 1, TileKind.Sea);
    paint(s, 2, 0, 1, 1, TileKind.River);
    paint(s, 4, 0, 1, 1, TileKind.Estuary);
    paint(s, 6, 0, 1, 1, TileKind.Rock);
    paint(s, 8, 0, 1, 1, TileKind.Beach);
    paint(s, 10, 0, 1, 1, TileKind.Reef);
    for (const x of [0, 2, 4, 10]) expect(canPlace(s, 'cottage', x, 0).reason).toMatch(/water/);
    expect(canPlace(s, 'cottage', 6, 0).reason).toMatch(/sandstone/);
    expect(canPlace(s, 'cottage', 8, 0).reason).toMatch(/beach/);
  });
  it('rejects a footprint that is only partly on valid terrain', () => {
    const s = sandbox();
    paint(s, 6, 6, 1, 1, TileKind.Sea);
    expect(canPlace(s, 'farm', 5, 5).ok).toBe(false);
  });
  it('cannot afford', () => {
    const s = sandbox(TileKind.Land, { budget: 9 });
    const c = canPlace(s, 'cottage', 3, 3);
    expect(c.code).toBe('no-funds');
    expect(c.reason).toMatch(/Not enough money/);
    expect(canPlace({ ...s, budget: 10 }, 'cottage', 3, 3).ok).toBe(true);
  });
  it('building on bush is allowed and reports how many bush tiles it clears', () => {
    const s = sandbox(TileKind.Bush);
    const c = canPlace(s, 'farm', 3, 3);
    expect(c.ok).toBe(true);
    expect(c.bushCleared).toBe(4);
  });
  it('unknown building ids fail gracefully', () => {
    const s = sandbox();
    expect(canPlace(s, 'nope' as BuildingId, 1, 1).code).toBe('unknown-building');
  });
  it('rectDistance: touching = 1, gap of n tiles = n+1, overlap <= 0', () => {
    expect(rectDistance(0, 0, 2, 2, 2, 0, 2, 2)).toBe(1);
    expect(rectDistance(0, 0, 2, 2, 5, 0, 2, 2)).toBe(4);
    expect(rectDistance(0, 0, 2, 2, 1, 1, 2, 2)).toBeLessThanOrEqual(0);
  });
});

describe('placement: unlock years and scenario overrides', () => {
  const unlocks: [BuildingId, number][] = [
    ['cottage', 1850], ['farm', 1850], ['road', 1850], ['coalmine', 1850], ['rail', 1860], ['port', 1870],
    ['outfall', 1880], ['landfill', 1900], ['factory', 1900], ['steelworks', 1910], ['coalpower', 1920],
    ['suburb', 1950], ['carpark', 1950],
  ];
  it.each(unlocks)('%s unlocks in %i', (id, year) => {
    // All-land sandbox with rock/sea/river/port set up so only the year can block it.
    const mk = (y: number) => {
      const s = sandbox(TileKind.Land, { year: y });
      paint(s, 8, 4, 1, 3, TileKind.Rock);
      paint(s, 14, 4, 1, 3, TileKind.Sea);
      paint(s, 14, 8, 1, 6, TileKind.River);
      return s;
    };
    const place = (y: number) => {
      let s = mk(y);
      if (id === 'steelworks') {
        s = { ...s, year: 2020 };
        s = applyAction(s, { type: 'place', building: 'port', x: 12, y: 4 }).state;
        s = { ...s, year: y };
      }
      const pos: Partial<Record<BuildingId, [number, number]>> = {
        steelworks: [9, 8], coalmine: [6, 4], coalpower: [11, 9], outfall: [13, 4], port: [12, 4],
      };
      const [px, py] = pos[id] ?? [2, 20];
      return canPlace(s, id, px, py);
    };
    expect(place(year - 10).code).toBe('locked');
    expect(place(year - 10).reason).toMatch(String(year));
    expect(place(year).ok, place(year).reason).toBe(true);
  });
  it('scenario overrides can disable or delay buildings', () => {
    const s = sandbox(TileKind.Land, { scenario: 'green-valley', year: 1850 });
    const c = canPlace({ ...s, year: 2020 }, 'steelworks', 3, 3);
    expect(c.code).toBe('locked');
    expect(c.reason).toMatch(/isn't available/);
  });
});

describe('placement: building-specific rules', () => {
  it('coal mine must be adjacent to rock', () => {
    const s = sandbox(TileKind.Land, { year: 1850 });
    const far = canPlace(s, 'coalmine', 10, 10);
    expect(far.code).toBe('needs-nearby-terrain');
    expect(far.reason).toBe('Coal mines must be built next to the sandstone escarpment');
    paint(s, 12, 10, 1, 1, TileKind.Rock); // adjacent to the 2x2 at (10,10)
    expect(canPlace(s, 'coalmine', 10, 10).ok).toBe(true);
    paint(s, 20, 20, 1, 1, TileKind.Rock); // diagonal-adjacent counts
    expect(canPlace(s, 'coalmine', 18, 18).ok).toBe(true);
    expect(canPlace(s, 'coalmine', 17, 17).ok).toBe(false);
  });
  it('port must touch the sea', () => {
    const s = sandbox(TileKind.Land, { year: 1870 });
    paint(s, 20, 0, 12, 32, TileKind.Sea);
    expect(canPlace(s, 'port', 10, 10).reason).toBe('Ports must touch the sea');
    expect(canPlace(s, 'port', 18, 10).ok).toBe(true);
    expect(canPlace(s, 'port', 17, 10).ok).toBe(false);
  });
  it('port can touch a reef tile too (reef is sea)', () => {
    const s = sandbox(TileKind.Land, { year: 1870 });
    paint(s, 20, 10, 1, 2, TileKind.Reef);
    expect(canPlace(s, 'port', 18, 10).ok).toBe(true);
  });
  it('sewage outfall must touch the sea, an estuary or a river', () => {
    const s = sandbox(TileKind.Land, { year: 1880 });
    expect(canPlace(s, 'outfall', 5, 5).reason).toBe('Sewage outfalls must touch the sea, an estuary or a river');
    paint(s, 6, 5, 1, 1, TileKind.Estuary);
    expect(canPlace(s, 'outfall', 5, 5).ok).toBe(true);
    paint(s, 15, 15, 1, 1, TileKind.Sea);
    expect(canPlace(s, 'outfall', 14, 15).ok).toBe(true);
    paint(s, 25, 25, 1, 1, TileKind.River);
    expect(canPlace(s, 'outfall', 24, 25).ok).toBe(true); // an inland town's sewage goes to the river
    paint(s, 20, 3, 1, 1, TileKind.Wetland);
    expect(canPlace(s, 'outfall', 19, 3).ok).toBe(false); // a billabong is not a place to put an outfall
  });
  it('steelworks needs a port first', () => {
    const s = sandbox(TileKind.Land, { year: 1910 });
    const noPort = canPlace(s, 'steelworks', 10, 10);
    expect(noPort.code).toBe('needs-nearby-building');
    expect(noPort.reason).toBe('Steelworks must be within 6 tiles of a port (build a Port & coal loader first)');
  });
  it('steelworks distance boundary is exactly 6 tiles edge to edge', () => {
    let s = sandbox(TileKind.Land, { year: 1910 });
    paint(s, 29, 0, 3, 32, TileKind.Sea);
    s = applyAction(s, { type: 'place', building: 'port', x: 27, y: 10 }).state;
    // Steelworks spanning x..x+2; distance = 27 - (x+2) .
    expect(canPlace(s, 'steelworks', 19, 10).ok).toBe(true); // 27-21 = 6
    expect(canPlace(s, 'steelworks', 18, 10).ok).toBe(false); // 27-20 = 7
    expect(canPlace(s, 'steelworks', 19, 17).ok).toBe(true); // 17 - 11 = 6 vertically
    expect(canPlace(s, 'steelworks', 19, 18).ok).toBe(false); // 7
  });
  it('coal power station needs cooling water within 3 tiles', () => {
    const s = sandbox(TileKind.Land, { year: 1920 });
    const bad = canPlace(s, 'coalpower', 10, 10);
    expect(bad.code).toBe('needs-nearby-terrain');
    expect(bad.reason).toBe('Power stations need cooling water within 3 tiles');
    paint(s, 15, 10, 1, 4, TileKind.River); // 2x2 at (10,10) spans x 10-11; distance 15-11 = 4
    expect(canPlace(s, 'coalpower', 10, 10).ok).toBe(false);
    expect(canPlace(s, 'coalpower', 11, 10).ok).toBe(true); // distance 3
    paint(s, 25, 25, 1, 1, TileKind.Estuary);
    expect(canPlace(s, 'coalpower', 22, 25).ok).toBe(true); // estuary also counts (distance 2? 25-23)
  });
  it('highway/car park is 1x3 and rotates to 3x1', () => {
    const s = sandbox(TileKind.Land, { year: 1950 });
    const a = canPlace(s, 'carpark', 3, 3, 0);
    expect(a.footprint).toEqual({ x: 3, y: 3, w: 1, h: 3 });
    const b = canPlace(s, 'carpark', 3, 3, 1);
    expect(b.footprint).toEqual({ x: 3, y: 3, w: 3, h: 1 });
    expect(canPlace(s, 'carpark', 3, 3, 2).footprint.h).toBe(3);
    expect(canPlace(s, 'carpark', 3, 3, 3).footprint.w).toBe(3);
    // Bounds depend on rotation.
    expect(canPlace(s, 'carpark', 30, 0, 1).ok).toBe(false);
    expect(canPlace(s, 'carpark', 29, 0, 1).ok).toBe(true);
    expect(canPlace(s, 'carpark', 0, 30, 0).ok).toBe(false);
    expect(canPlace(s, 'carpark', 0, 29, 0).ok).toBe(true);
    // Rotated placement occupies the rotated tiles only.
    const placed = applyAction(s, { type: 'place', building: 'carpark', x: 3, y: 3, rotation: 1 }).state;
    expect(placed.grid.building[3 * 32 + 5]).not.toBe(0);
    expect(placed.grid.building[4 * 32 + 3]).toBe(0);
  });
});
