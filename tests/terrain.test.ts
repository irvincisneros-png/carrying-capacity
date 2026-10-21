import { describe, expect, it } from 'vitest';
import { countKind, createGame, generateTerrain, getScenario, SCENARIO_IDS, TileKind } from '../src/sim';

const scenario = getScenario('coal-coast');

describe('terrain generation', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = generateTerrain(scenario, 1850), b = generateTerrain(scenario, 1850), c = generateTerrain(scenario, 99);
    expect(Array.from(a.kind)).toEqual(Array.from(b.kind));
    expect(Array.from(a.elevation)).toEqual(Array.from(b.elevation));
    expect(Array.from(a.kind)).not.toEqual(Array.from(c.kind));
  });
  it('is 64x64 with typed-array storage', () => {
    const g = generateTerrain(scenario, 1850);
    expect(g.w).toBe(64);
    expect(g.h).toBe(64);
    expect(g.kind).toBeInstanceOf(Uint8Array);
    expect(g.elevation).toBeInstanceOf(Uint8Array);
    expect(g.building).toBeInstanceOf(Uint16Array);
    expect(g.airPollution).toBeInstanceOf(Float32Array);
    expect(g.kind).toHaveLength(4096);
  });
  it.each([1850, 1, 2, 3, 123456])('has every required feature for seed %i', (seed) => {
    const g = generateTerrain(scenario, seed);
    for (const k of [TileKind.Sea, TileKind.Beach, TileKind.Estuary, TileKind.River, TileKind.Land, TileKind.Bush, TileKind.Rock, TileKind.Reef]) {
      expect(countKind(g, k), `kind ${k}`).toBeGreaterThan(0);
    }
    // Sea on the east edge, escarpment on the west edge.
    let seaEast = 0, rockWest = 0;
    for (let y = 0; y < g.h; y++) {
      const e = g.kind[y * g.w + g.w - 1];
      if (e === TileKind.Sea || e === TileKind.Reef) seaEast++;
      if (g.kind[y * g.w] === TileKind.Rock || g.kind[y * g.w] === TileKind.River) rockWest++;
    }
    expect(seaEast).toBe(g.h);
    expect(rockWest).toBe(g.h);
    // Elevation stays 0..3.
    for (const e of g.elevation) expect(e).toBeLessThanOrEqual(3);
  });
  it('bush covers about 60% of the open land', () => {
    const g = generateTerrain(scenario, 1850);
    const bush = countKind(g, TileKind.Bush), land = countKind(g, TileKind.Land);
    expect(bush / (bush + land)).toBeCloseTo(0.6, 1);
  });
  it('the river runs from the west edge to an estuary beside the sea', () => {
    const g = generateTerrain(scenario, 1850);
    const water = (x: number, y: number): boolean => {
      const k = g.kind[y * g.w + x];
      return k === TileKind.River || k === TileKind.Estuary;
    };
    // Flood-fill from the west-edge river tiles through river/estuary tiles.
    const seen = new Set<number>();
    const stack: number[] = [];
    for (let y = 0; y < g.h; y++) if (water(0, y)) stack.push(y * g.w);
    expect(stack.length).toBeGreaterThan(0);
    while (stack.length) {
      const i = stack.pop() as number;
      if (seen.has(i)) continue;
      seen.add(i);
      const x = i % g.w, y = Math.floor(i / g.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < g.w && ny < g.h && water(nx, ny)) stack.push(ny * g.w + nx);
      }
    }
    const estuaryReached = [...seen].some((i) => g.kind[i] === TileKind.Estuary);
    expect(estuaryReached).toBe(true);
    const touchesSea = [...seen].some((i) => {
      const x = i % g.w, y = Math.floor(i / g.w);
      const east = g.kind[y * g.w + x + 1];
      return g.kind[i] === TileKind.Estuary && (east === TileKind.Sea || east === TileKind.Reef);
    });
    expect(touchesSea).toBe(true);
  });
  it('every scenario generates a map of its declared size', () => {
    for (const id of SCENARIO_IDS) {
      const sc = getScenario(id);
      const s = createGame(id);
      expect(s.grid.w).toBe(sc.mapW);
      expect(s.grid.h).toBe(sc.mapH);
      expect(s.initialBushTiles).toBeGreaterThan(0);
    }
  });
});
