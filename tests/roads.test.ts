import { describe, expect, it } from 'vitest';
import {
  addFreeRoad, advanceDecade, applyAction, assumeRoads, BUILDINGS, canPlace, cloneState, COMMUTE_CAP, commuteStats, createGame, deserialize,
  economySnapshot, entranceList, projectedEmissions, roadAccess, roadRoute, SCENARIO_IDS, serialize, TileKind, tutorialStatus,
} from '../src/sim';
import { ZONE } from '../src/sim';
import type { BuildingId, GameState } from '../src/sim';
import { connectAll, connectToEntrance } from './helpers/roads';
import { keepZoned } from './helpers/zoning';

/**
 * A flat 20 x 20 field of open land with one entrance road at the west edge (0, 10) and a country road running in to (5, 10).
 * 1960, plenty of money. Nothing else is built, so every test starts from known ground.
 */
function field(opts: { act2?: boolean } = {}): GameState {
  const s = cloneState(createGame('green-valley'));
  const g = s.grid;
  g.kind.fill(TileKind.Land);
  g.elevation.fill(1);
  g.building.fill(0);
  s.buildings = [];
  s.nextUid = 1;
  for (const k of Object.keys(s.flags)) if (k.startsWith('road.entrance')) delete s.flags[k];
  s.year = opts.act2 ? 2030 : 1960;
  if (opts.act2) s.phase = 'act2';
  s.budget = 5000;
  for (let x = 0; x <= 5; x++) addFreeRoad(s, 10 * g.w + x);
  s.flags['road.entrance'] = 10 * g.w;
  return s;
}

function put(s: GameState, id: BuildingId, x: number, y: number): { state: GameState; uid: number } {
  const r = applyAction(s, { type: 'place', building: id, x, y });
  expect(r.result.ok, `${id} at ${x},${y}: ${r.result.reason ?? ''}`).toBe(true);
  return { state: r.state, uid: r.result.uid as number };
}

const roadUids = (s: GameState): Set<number> => new Set(s.buildings.filter((b) => b.type === 'road').map((b) => b.uid));

describe('the entrance road', () => {
  it('every scenario starts with a road on open land at the edge of its land, with a country road running in', () => {
    for (const id of SCENARIO_IDS) {
      const s = createGame(id);
      const list = entranceList(s);
      expect(list.length, id).toBeGreaterThanOrEqual(1);
      const g = s.grid;
      for (const i of list) {
        const b = s.buildings.find((o) => o.x === i % g.w && o.y === Math.floor(i / g.w));
        expect(b?.type, id).toBe('road');
        expect(g.kind[i], id).toBe(TileKind.Land);
      }
      // The main entrance is on the map edge (the island's is on its own shore, which on the 64x64 map is up to 16 tiles in from the edge of the sea).
      const m = list[0] as number;
      const edge = Math.min(m % g.w, Math.floor(m / g.w), g.w - 1 - (m % g.w), g.h - 1 - Math.floor(m / g.w));
      expect(edge, id).toBeLessThanOrEqual(id === 'reef-island' ? 16 : 0);
      expect(s.buildings.filter((b) => b.type === 'road').length, id).toBeGreaterThan(3);
      expect(roadAccess(s).enforced).toBe(true);
    }
  });
  it('is the same for the same seed', () => {
    expect(entranceList(createGame('river-town'))).toEqual(entranceList(createGame('river-town')));
  });
  it('Net Zero City starts with every building joined to an entrance, so the finished city keeps working', () => {
    const s = createGame('net-zero-city');
    expect(roadAccess(s).unconnected).toEqual([]);
    expect(economySnapshot(s).housing).toBeGreaterThan(3000);
  });
  it('cannot be demolished', () => {
    const s = createGame('green-valley');
    const e = entranceList(s)[0] as number;
    const r = applyAction(s, { type: 'demolish', x: e % s.grid.w, y: Math.floor(e / s.grid.w) });
    expect(r.result.ok).toBe(false);
    expect(r.result.code).toBe('locked');
  });
});

describe('road access', () => {
  it('buildings with no road give nothing; connecting them restores them', () => {
    let s = field();
    const a = put(s, 'cottage', 10, 3); s = a.state;
    const f = put(s, 'farm', 14, 3); s = f.state;
    expect(roadAccess(s).unconnected).toEqual(expect.arrayContaining([a.uid, f.uid]));
    expect(economySnapshot(s).housing).toBe(0);
    expect(economySnapshot(s).jobs).toBe(0);
    expect(economySnapshot(s, 100).filledJobs).toBe(0);
    s = connectToEntrance(s, a.uid);
    expect(roadAccess(s).connected.has(a.uid)).toBe(true);
    expect(economySnapshot(s).housing).toBe(BUILDINGS.cottage.housing);
    expect(economySnapshot(s).jobs).toBe(0);
    s = connectToEntrance(s, f.uid);
    expect(economySnapshot(s).jobs).toBe(BUILDINGS.farm.jobs);
    expect(roadAccess(s).unconnected).toEqual([]);
  });
  it('a building beside the road works at once', () => {
    const s = put(field(), 'cottage', 3, 8).state; // its lower edge touches the country road at (3, 10)? no: (3, 9) is the row above it
    expect(roadAccess(s).connected.size + roadAccess(s).unconnected.length).toBe(1);
    const t = put(field(), 'cottage', 3, 9).state; // directly above the road tile (3, 10)
    expect(roadAccess(t).unconnected).toEqual([]);
    expect(economySnapshot(t).housing).toBe(BUILDINGS.cottage.housing);
  });
  it('a dormant building adds no emissions or pollution; a working one does', () => {
    let s = field();
    const f = put(s, 'factory', 12, 3); s = f.state;
    expect(projectedEmissions(s).industry).toBe(0);
    expect(Math.max(...advanceDecade(s).state.grid.airPollution)).toBe(0);
    s = connectToEntrance(s, f.uid);
    expect(projectedEmissions(s).industry).toBe(BUILDINGS.factory.co2);
    expect(Math.max(...advanceDecade(s).state.grid.airPollution)).toBeGreaterThan(0);
  });
  it('a power station with no road supplies nothing', () => {
    let s = field();
    for (let x = 8; x < 16; x++) s.grid.kind[0 * s.grid.w + x] = TileKind.River; // cooling water along the north edge
    const c = put(s, 'coalpower', 10, 2); s = c.state;
    expect(economySnapshot(s).powerSupply).toBe(0);
    const joined = connectToEntrance(s, c.uid);
    expect(economySnapshot(joined).powerSupply).toBe(BUILDINGS.coalpower.power);
  });
  it('connectivity breaks when a road in the chain is demolished, and comes back when it is laid again', () => {
    let s = field();
    const c = put(s, 'cottage', 12, 3); s = c.state;
    const before = roadUids(s);
    s = connectToEntrance(s, c.uid);
    expect(roadAccess(s).connected.has(c.uid)).toBe(true);
    const home = s.buildings.find((b) => b.uid === c.uid)!;
    const laid = s.buildings.filter((b) => b.type === 'road' && !before.has(b.uid));
    expect(laid.length).toBeGreaterThan(3);
    const nearest = [...laid].sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y))[0] as (typeof laid)[number];
    const middle = laid[Math.floor(laid.length / 2)] as (typeof laid)[number];
    for (const victim of [nearest, middle]) {
      const broken = applyAction(s, { type: 'demolish', x: victim.x, y: victim.y });
      expect(broken.result.ok).toBe(true);
      expect(roadAccess(broken.state).connected.has(c.uid), `cut at ${victim.x},${victim.y}`).toBe(false);
      expect(economySnapshot(broken.state).housing).toBe(0);
      expect(roadRoute(broken.state, c.uid)).not.toBeNull();
      const fixed = connectToEntrance(broken.state, c.uid);
      expect(roadAccess(fixed).connected.has(c.uid)).toBe(true);
      expect(economySnapshot(fixed).housing).toBe(BUILDINGS.cottage.housing);
    }
  });
  it('a loop gives a second way round: cutting one side of it does not disconnect', () => {
    let s = field();
    // A square ring of road off the end of the country road, with a cottage beside its far side.
    const ring = [[6, 10], [7, 10], [8, 10], [8, 11], [8, 12], [7, 12], [6, 12], [6, 11]];
    for (const [x, y] of ring) s = put(s, 'road', x as number, y as number).state;
    const c = put(s, 'cottage', 5, 12); s = c.state; // beside (6, 12)
    expect(roadAccess(s).connected.has(c.uid)).toBe(true);
    const cut = applyAction(s, { type: 'demolish', x: 6, y: 11 });
    expect(roadAccess(cut.state).connected.has(c.uid)).toBe(true); // still joined the long way round
  });
  it('rail sidings serve factories but not homes', () => {
    let s = field();
    for (const x of [6, 7, 8]) s = put(s, 'rail', x, 10).state; // a siding running on from the end of the country road
    expect(roadAccess(s).reached[10 * s.grid.w + 7]).toBe(2);
    const f = put(s, 'factory', 7, 8); s = f.state; // touches only the rail, at (7, 10)
    const h = put(s, 'cottage', 9, 9); s = h.state; // touches only the rail's end at (8, 10)? no: (9, 10) is empty grass
    expect(roadAccess(s).connected.has(f.uid)).toBe(true);
    const t = put(field(), 'rail', 6, 10).state;
    const home = put(t, 'cottage', 6, 9); // sits right above the siding tile (6, 10), and no road
    expect(roadAccess(home.state).connected.has(home.uid)).toBe(false);
    expect(BUILDINGS.coalmine.railServed).toBe(true);
    expect(BUILDINGS.cottage.railServed).toBeUndefined();
  });
  it('exempt buildings work with no road, and the exemption lives on the building def', () => {
    const exempt = (Object.keys(BUILDINGS) as BuildingId[]).filter((id) => BUILDINGS[id].needsRoad === false);
    for (const id of ['road', 'rail', 'carpark', 'wildlifecrossing', 'transitline', 'rooftopsolar', 'parkland', 'phytoremediation',
      'wetland', 'nursery', 'coralnursery', 'offshorewind', 'tidal', 'fishway', 'seawall', 'outfall', 'sewagetreatment', 'bore'] as const) {
      expect(exempt, id).toContain(id);
    }
    for (const id of ['cottage', 'suburb', 'farm', 'factory', 'steelworks', 'coalmine', 'coalpower', 'solarfarm', 'windfarm', 'battery', 'excavation'] as const) {
      expect(exempt, id).not.toContain(id);
    }
    const n = put(field({ act2: true }), 'nursery', 12, 3);
    expect(roadAccess(n.state).working.has(n.uid)).toBe(true);
    expect(roadAccess(n.state).unconnected).not.toContain(n.uid);
    const p = put(field({ act2: true }), 'phytoremediation', 12, 3);
    expect(roadAccess(p.state).unconnected).toEqual([]);
  });
  it('rooftop solar works only beside a working home', () => {
    let s = field({ act2: true });
    const c = put(s, 'cottage', 12, 3); s = c.state;
    const sol = put(s, 'rooftopsolar', 13, 3); s = sol.state;
    expect(roadAccess(s).working.has(sol.uid)).toBe(false);
    expect(economySnapshot(s).powerSupply).toBe(0);
    s = connectToEntrance(s, c.uid);
    expect(roadAccess(s).working.has(sol.uid)).toBe(true);
    expect(economySnapshot(s).powerSupply).toBe(BUILDINGS.rooftopsolar.power);
  });
  it('is cached for a state and recomputed when buildings change', () => {
    const s = field();
    expect(roadAccess(s)).toBe(roadAccess(s));
    const c = put(s, 'cottage', 12, 3);
    expect(roadAccess(c.state)).not.toBe(roadAccess(s));
  });
  it('is cheap enough for a 72 x 72 map (one flood fill per state)', () => {
    const s = createGame('net-zero-city');
    const t0 = Date.now();
    for (let k = 0; k < 200; k++) roadAccess({ ...s, buildings: s.buildings.slice(), version: s.version + k + 1 });
    // 2304 tiles x 200 = 460k tile visits; a 72 x 72 map is 2.25x that, still well under a second or two.
    expect(Date.now() - t0).toBeLessThan(3000);
  });
  it('routes around obstacles and refuses an enclosed building', () => {
    let s = field();
    const c = put(s, 'cottage', 12, 3); s = c.state;
    expect(roadRoute(s, c.uid)).not.toBeNull();
    // Wall the cottage in with sea on every side that is open (a creek could be bridged, the sea cannot): a 1x1 home in a pond has no road.
    const pond = cloneState(s);
    for (const [x, y] of [[11, 3], [13, 3], [12, 2], [12, 4]]) pond.grid.kind[(y as number) * pond.grid.w + (x as number)] = TileKind.Sea;
    expect(roadRoute(pond, c.uid)).toBeNull();
  });
});

describe('commuting', () => {
  /** A factory right at the end of the country road, and a suburb `gap` tiles further along the same road. */
  function town(gap: number): GameState {
    let s = field();
    s = put(s, 'factory', 4, 8).state; // touches the road at (4, 10)/(5, 10)
    // Extend the road east and put homes along it.
    for (let x = 6; x <= 6 + gap + 2; x++) s = put(s, 'road', x, 10).state;
    s = put(s, 'suburb', 6 + gap, 8).state;
    return { ...s, population: 100 };
  }
  it('is zero with no homes or jobs, and positive for a town with both', () => {
    expect(commuteStats(createGame('green-valley')).ktPerDecade).toBe(0);
    const t = town(0);
    expect(roadAccess(t).unconnected).toEqual([]);
    expect(commuteStats(t).meanDist).toBeGreaterThan(0);
    expect(commuteStats(t).ktPerDecade).toBeGreaterThan(0);
    expect(commuteStats(t).ktPerDecade).toBeLessThan(10);
  });
  it('a longer road between homes and jobs means more commute emissions', () => {
    const near = commuteStats(town(0)), far = commuteStats(town(10));
    expect(far.meanDist).toBeGreaterThan(near.meanDist + 5);
    expect(far.ktPerDecade).toBeGreaterThan(near.ktPerDecade * 2);
  });
  it('is capped, so a very long commute does not run away', () => {
    expect(commuteStats(town(10)).meanDist).toBeLessThanOrEqual(COMMUTE_CAP);
  });
  it('shows up as its own number in the decade report, inside the transport total', () => {
    const t = town(6);
    const { report } = advanceDecade({ ...t, population: 100 });
    expect(report?.commuteKt).toBeGreaterThan(0);
    expect(report?.emissionsKt.transport).toBeGreaterThanOrEqual(report?.commuteKt ?? Infinity);
    expect(report?.commuteTiles).toBeGreaterThan(0);
  });
  it('light rail cuts it', () => {
    const t = town(8);
    const base = commuteStats(t).ktPerDecade;
    const act2 = { ...t, phase: 'act2' as const, year: 2030, scenarioId: 'coal-coast' as const };
    const withRail = put(act2, 'transitline', 12, 1).state;
    const cs = commuteStats(withRail);
    expect(cs.transitCut).toBeGreaterThan(0);
    expect(cs.ktPerDecade).toBeLessThan(base);
  });
  it('what-if sums can ignore roads without touching the real state', () => {
    const t = town(4);
    expect(roadAccess(assumeRoads(t)).enforced).toBe(false);
    expect(roadAccess(t).enforced).toBe(true);
  });
});

describe('saves from before roads mattered', () => {
  it('load with an entrance added; the old town then waits for roads and can be joined up', () => {
    let s = createGame('green-valley');
    s = { ...s, budget: 1000 };
    // Two buildings in opposite corners of the valley.
    const g = s.grid;
    const spots: Array<[BuildingId, number, number]> = [];
    for (const id of ['cottage', 'farm'] as const) {
      let best: [number, number] | null = null;
      let bestD = -1;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        if (!canPlace(s, id, x, y).ok) continue;
        const d = id === 'cottage' ? -(x + y) : x + y; // one low corner, one high corner
        if (best === null || d > bestD) { best = [x, y]; bestD = d; }
      }
      expect(best).not.toBeNull();
      spots.push([id, (best as [number, number])[0], (best as [number, number])[1]]);
    }
    for (const [id, x, y] of spots) s = put(s, id, x, y).state;
    // Make it look like an old save: no entrance flag, no entrance or country road.
    const old = cloneState(s);
    for (const k of Object.keys(old.flags)) if (k.startsWith('road.entrance')) delete old.flags[k];
    for (const b of old.buildings.filter((o) => o.type === 'road')) old.grid.building[b.y * old.grid.w + b.x] = 0;
    old.buildings = old.buildings.filter((o) => o.type !== 'road');
    const text = serialize(old);
    expect(JSON.parse(text).flags['road.entrance']).toBeUndefined();
    const l = deserialize(text) as GameState;
    expect(l).not.toBeNull();
    expect(entranceList(l).length).toBeGreaterThanOrEqual(1);
    expect(roadAccess(l).enforced).toBe(true);
    expect(l.buildings.filter((b) => b.type !== 'road')).toHaveLength(2);
    // Everything that was built can be joined to the new entrance, and then works.
    for (const b of l.buildings.filter((o) => o.type !== 'road')) expect(roadRoute(l, b.uid), b.type).not.toBeNull();
    const fixed = connectAll({ ...l, budget: 1000 });
    expect(roadAccess(fixed).unconnected).toEqual([]);
    expect(economySnapshot(fixed).housing).toBeGreaterThan(0);
  });
  it('a modern save keeps its entrances through a round trip', () => {
    const s = createGame('river-town');
    const back = deserialize(serialize(s)) as GameState;
    expect(entranceList(back)).toEqual(entranceList(s));
    expect(back.buildings.length).toBe(s.buildings.length);
  });
});

describe('the Green Valley tutorial road step', () => {
  it('asks the player to connect the farm to the road from the edge, and checks roadAccess', () => {
    let s = createGame('green-valley');
    s = { ...s, budget: 1000 };
    const g = s.grid;
    const roads = s.buildings.filter((b) => b.type === 'road');
    const free = (id: BuildingId, n: number): Array<[number, number]> => {
      const out: Array<[number, number]> = [];
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        if (out.length >= n) return out;
        if (!canPlace(s, id, x, y).ok) continue;
        if (roads.some((r) => Math.max(Math.abs(r.x - x), Math.abs(r.y - y)) <= 3)) continue;
        if (out.some(([ox, oy]) => Math.max(Math.abs(ox - x), Math.abs(oy - y)) <= 3)) continue;
        out.push([x, y]);
      }
      return out;
    };
    s = keepZoned(s, ZONE.rlow, 6);
    s = keepZoned(s, ZONE.com, 3);
    for (const [x, y] of free('farm', 1)) s = put(s, 'farm', x, y).state;
    const st = tutorialStatus(s);
    expect(st.current?.id).toBe('roads');
    expect(st.current?.instruction).toMatch(/Connect your farm to the road from the edge of the valley/);
    s = connectAll(s);
    expect(tutorialStatus(s).current?.id).not.toBe('roads');
    expect(tutorialStatus(s).steps.find((x) => x.id === 'roads')?.done).toBe(true);
  });
});

describe('placement rejects ground no road can reach', () => {
  it('Green Valley (default seed): the cut-off pocket at (4,30) (the south-west corner of the 32x32 valley; it was (10,17) on 20x20) says "No road can reach here"', async () => {
    const { createGame, canPlace } = await import('../src/sim');
    const s = createGame('green-valley');
    const c = canPlace(s, 'cottage', 4, 30);
    expect(c.ok).toBe(false);
    expect(c.reason).toBe('No road can reach here');
  });
});
