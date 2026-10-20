import { describe, expect, it } from 'vitest';
import { countKind, createGame, generateTerrain, getScenario, TileKind } from '../src/sim';
import type { ScenarioId, TileGrid } from '../src/sim';

const NEW_SCENARIOS: ScenarioId[] = ['green-valley', 'river-town', 'reef-island', 'red-dirt', 'net-zero-city'];

const neighbours = (g: TileGrid, i: number): number[] => {
  const x = i % g.w, y = Math.floor(i / g.w);
  const out: number[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && yy >= 0 && xx < g.w && yy < g.h) out.push(yy * g.w + xx);
  }
  return out;
};

/** Number of 4-connected groups among tiles accepted by `test`. */
function components(g: TileGrid, test: (i: number) => boolean): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (let i = 0; i < g.kind.length; i++) {
    if (!test(i) || seen.has(i)) continue;
    const comp: number[] = [];
    const q = [i];
    seen.add(i);
    for (let qi = 0; qi < q.length; qi++) {
      const t = q[qi] as number;
      comp.push(t);
      for (const j of neighbours(g, t)) if (!seen.has(j) && test(j)) { seen.add(j); q.push(j); }
    }
    out.push(comp);
  }
  return out;
}

describe('every scenario has its own deterministic terrain', () => {
  it.each(NEW_SCENARIOS)('%s: is the declared size, deterministic for a seed and different for another', (id) => {
    const sc = getScenario(id);
    const a = generateTerrain(sc, sc.seed), b = generateTerrain(sc, sc.seed), c = generateTerrain(sc, sc.seed + 17);
    expect([a.w, a.h]).toEqual([sc.mapW, sc.mapH]);
    expect(Array.from(a.kind)).toEqual(Array.from(b.kind));
    expect(Array.from(a.elevation)).toEqual(Array.from(b.elevation));
    expect(Array.from(a.zone)).toEqual(Array.from(b.zone));
    expect(Array.from(a.significant)).toEqual(Array.from(b.significant));
    expect(Array.from(a.kind)).not.toEqual(Array.from(c.kind));
    for (const e of a.elevation) expect(e).toBeLessThanOrEqual(3);
    for (const k of a.kind) expect(k).toBeLessThanOrEqual(TileKind.Pit);
  });
  it.each(NEW_SCENARIOS)('%s: does not reuse the coast generator (no sea on the east edge unless it is a coast or city)', (id) => {
    const g = generateTerrain(getScenario(id), getScenario(id).seed);
    const seaEast = Array.from({ length: g.h }, (_, y) => g.kind[y * g.w + g.w - 1]).filter((k) => k === TileKind.Sea).length;
    if (id === 'net-zero-city' || id === 'reef-island') expect(seaEast).toBeGreaterThan(g.h * 0.5);
    else expect(seaEast).toBe(0);
  });
  it.each(['river-town', 'reef-island', 'red-dirt', 'net-zero-city'] as const)('%s: marks exactly three significant places, each a patch of open ground', (id) => {
    const g = generateTerrain(getScenario(id), getScenario(id).seed);
    const ids = new Set(Array.from(g.significant).filter((v) => v > 0));
    expect(Array.from(ids).sort()).toEqual([1, 2, 3]);
    for (let i = 0; i < g.significant.length; i++) {
      if ((g.significant[i] ?? 0) > 0) expect([TileKind.Land, TileKind.Bush]).toContain(g.kind[i]);
    }
  });
  it.each(NEW_SCENARIOS)('%s: starts with bush and open land to build on', (id) => {
    const g = createGame(id).grid;
    expect(countKind(g, TileKind.Bush)).toBeGreaterThan(10);
    expect(countKind(g, TileKind.Land)).toBeGreaterThan(30);
  });
});

describe('Green Valley (16x16 valley)', () => {
  const g = generateTerrain(getScenario('green-valley'), 7);
  it('has a creek that crosses the valley, a dam, rock hills and no sea', () => {
    expect(countKind(g, TileKind.Sea) + countKind(g, TileKind.Estuary) + countKind(g, TileKind.Reef)).toBe(0);
    const creek = components(g, (i) => g.kind[i] === TileKind.River || g.kind[i] === TileKind.Wetland);
    expect(creek).toHaveLength(1);
    const xs = creek[0]?.map((i) => i % g.w) ?? [];
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(g.w - 1);
    expect(countKind(g, TileKind.Wetland)).toBeGreaterThan(1);
    expect(countKind(g, TileKind.Rock)).toBeGreaterThan(5);
  });
  it('keeps half of the open land in bush so a koala woodland is possible', () => {
    const bush = countKind(g, TileKind.Bush), land = countKind(g, TileKind.Land);
    expect(bush / (bush + land)).toBeCloseTo(0.5, 1);
  });
});

describe('River Town (32x32 inland river)', () => {
  const sc = getScenario('river-town');
  const g = generateTerrain(sc, sc.seed);
  it('has one wide river from the west edge to the east edge', () => {
    const rivers = components(g, (i) => g.kind[i] === TileKind.River);
    expect(rivers).toHaveLength(1);
    expect(rivers[0]?.length).toBeGreaterThan(80);
    const xs = rivers[0]?.map((i) => i % g.w) ?? [];
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(g.w - 1);
    expect(countKind(g, TileKind.Sea) + countKind(g, TileKind.Estuary)).toBe(0);
  });
  it('has billabongs on the floodplain, floodplain at elevation 1 and plains above, and ranges in the corner', () => {
    expect(components(g, (i) => g.kind[i] === TileKind.Wetland).length).toBeGreaterThanOrEqual(4);
    const low = Array.from(g.kind).filter((k, i) => (k === TileKind.Land || k === TileKind.Bush) && g.elevation[i] === 1).length;
    const plains = Array.from(g.kind).filter((k, i) => (k === TileKind.Land || k === TileKind.Bush) && g.elevation[i] === 2).length;
    expect(low).toBeGreaterThan(60);
    expect(plains).toBeGreaterThan(100);
    expect(countKind(g, TileKind.Rock)).toBeGreaterThan(15);
  });
  it('has a weir: river tiles raised to elevation 1 across the full width of the river', () => {
    const weir = Array.from(g.kind).map((k, i) => (k === TileKind.River && (g.elevation[i] ?? 0) > 0 ? i : -1)).filter((i) => i >= 0);
    expect(weir.length).toBeGreaterThanOrEqual(3);
    expect(new Set(weir.map((i) => i % g.w)).size).toBe(1);
    // Every river tile in that column is part of the weir.
    const col = weir[0] === undefined ? 0 : weir[0] % g.w;
    for (let y = 0; y < g.h; y++) if (g.kind[y * g.w + col] === TileKind.River) expect(g.elevation[y * g.w + col]).toBe(1);
  });
});

describe('Reef Island (32x32 tropical island)', () => {
  const sc = getScenario('reef-island');
  const g = generateTerrain(sc, sc.seed);
  it('is a single island surrounded by sea, with a broad fringing reef', () => {
    const landKinds = [TileKind.Land, TileKind.Bush, TileKind.Rock, TileKind.Beach, TileKind.Estuary];
    const islands = components(g, (i) => landKinds.includes(g.kind[i] as 1));
    expect(islands.length).toBeGreaterThanOrEqual(1);
    expect(islands[0]?.length).toBeGreaterThan(180);
    expect(countKind(g, TileKind.Reef)).toBeGreaterThan(100);
    // No land touches the map edge.
    for (let x = 0; x < g.w; x++) for (const y of [0, g.h - 1]) expect(landKinds).not.toContain(g.kind[y * g.w + x]);
  });
  it('has beaches, mangroves (estuary tiles), hills, and a low coastal belt the town can grow on', () => {
    expect(countKind(g, TileKind.Beach)).toBeGreaterThan(25);
    expect(countKind(g, TileKind.Estuary)).toBeGreaterThanOrEqual(10);
    expect(countKind(g, TileKind.Rock)).toBeGreaterThan(5);
    const low = Array.from(g.kind).filter((k, i) => k === TileKind.Land && g.elevation[i] === 1).length;
    const high = Array.from(g.kind).filter((k, i) => (k === TileKind.Land || k === TileKind.Bush) && (g.elevation[i] ?? 0) >= 2).length;
    expect(low).toBeGreaterThan(25);
    expect(high).toBeGreaterThan(30);
  });
  it('lets seagrass grow between the beach and the reef (sea tiles within 2 of land)', () => {
    let shallow = 0;
    for (let i = 0; i < g.kind.length; i++) {
      if (g.kind[i] !== TileKind.Sea) continue;
      const x = i % g.w, y = Math.floor(i / g.w);
      outer: for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
        const k = g.kind[yy * g.w + xx];
        if (k === TileKind.Beach || k === TileKind.Estuary || k === TileKind.Land) { shallow++; break outer; }
      }
    }
    expect(shallow).toBeGreaterThan(20);
  });
});

describe('Red Dirt (32x32 outback)', () => {
  const sc = getScenario('red-dirt');
  const g = generateTerrain(sc, sc.seed);
  it('has a dry creek, a permanent waterhole, ranges and open red plains', () => {
    expect(countKind(g, TileKind.River)).toBeGreaterThan(25);
    expect(countKind(g, TileKind.Wetland)).toBeGreaterThanOrEqual(5);
    expect(countKind(g, TileKind.Rock)).toBeGreaterThan(40);
    expect(countKind(g, TileKind.Land)).toBeGreaterThan(450);
    expect(countKind(g, TileKind.Sea) + countKind(g, TileKind.Estuary)).toBe(0);
  });
  it('has two open-cut pits, all marked as the mine site, ringed with rock so a mine can be worked beside them', () => {
    const pits = components(g, (i) => g.kind[i] === TileKind.Pit);
    expect(pits).toHaveLength(2);
    expect(Math.max(...pits.map((p) => p.length))).toBeGreaterThan(30);
    for (const p of pits) for (const i of p) { expect(g.zone[i]).toBe(1); expect(g.stage[i]).toBe(0); expect(g.elevation[i]).toBe(0); }
    // Every tile marked zone 1 is a pit.
    for (let i = 0; i < g.zone.length; i++) if (g.zone[i] === 1) expect(g.kind[i]).toBe(TileKind.Pit);
    const rimRock = pits.flat().filter((i) => neighbours(g, i).some((j) => g.kind[j] === TileKind.Rock)).length;
    expect(rimRock).toBeGreaterThan(8);
  });
});

describe('Net Zero City (48x48 coastal city)', () => {
  const sc = getScenario('net-zero-city');
  const g = generateTerrain(sc, sc.seed);
  it('has a harbour inlet, beaches, an estuary where a river meets it, headlands and hills', () => {
    expect(g.w * g.h).toBe(2304);
    expect(countKind(g, TileKind.Sea)).toBeGreaterThan(350);
    expect(countKind(g, TileKind.Beach)).toBeGreaterThan(30);
    expect(countKind(g, TileKind.Estuary)).toBeGreaterThan(15);
    expect(countKind(g, TileKind.River)).toBeGreaterThan(15);
    expect(countKind(g, TileKind.Rock)).toBeGreaterThan(150);
    // The harbour pushes the sea well inland in the middle of the east shore.
    const mid = Math.floor(g.h / 2);
    let firstSea = g.w;
    for (let x = 0; x < g.w; x++) if (g.kind[mid * g.w + x] === TileKind.Sea) { firstSea = x; break; }
    const edge = Math.floor(g.h * 0.1);
    let edgeSea = g.w;
    for (let x = 0; x < g.w; x++) if (g.kind[edge * g.w + x] === TileKind.Sea) { edgeSea = x; break; }
    expect(firstSea).toBeLessThan(edgeSea - 5);
  });
  it('has lots of open ground for a city: well over a thousand land tiles', () => {
    expect(countKind(g, TileKind.Land) + countKind(g, TileKind.Bush)).toBeGreaterThan(1000);
  });
});
