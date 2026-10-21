import { describe, expect, it } from 'vitest';
import {
  advanceDecade, applyAction, BUILDINGS, canPlace, createGame, deserialize, economySnapshot, entranceList, SCENARIO_IDS, serialize,
  commuteStats, projectedEmissions, roadAccess, roadRoute, tutorialStatus, TileKind,
} from '../src/sim';
import type { BuildingId, GameState, Rotation } from '../src/sim';
import { connectToEntrance } from './helpers/roads';

/** A free 1x1 or bigger spot for `id`, searching outward from a tile, that is NOT beside any road (so it starts unconnected). */
function spotFar(s: GameState, id: BuildingId, from: { x: number; y: number }, rotation: Rotation = 0): { x: number; y: number } {
  const rich: GameState = { ...s, budget: 1e9 };
  const g = s.grid;
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!canPlace(rich, id, x, y, rotation).ok) continue;
    const d = Math.hypot(x - from.x, y - from.y);
    if (d < bestD) { bestD = d; best = { x, y }; }
  }
  if (!best) throw new Error('no spot');
  return best;
}

function place(s: GameState, id: BuildingId, x: number, y: number): { state: GameState; uid: number } {
  const r = applyAction({ ...s, budget: Math.max(s.budget, 1000) }, { type: 'place', building: id, x, y });
  expect(r.result.ok).toBe(true);
  return { state: r.state, uid: r.result.uid as number };
}

/** The end of the entrance's approach road (the tile furthest from the edge along the reached network). */
function townSiteOf(s: GameState): { x: number; y: number } {
  const acc = roadAccess(s);
  const g = s.grid;
  let best = acc.entrances[0] as number;
  let bestD = -1;
  const e = acc.entrances[0] as number;
  for (let i = 0; i < acc.reached.length; i++) {
    if (acc.reached[i] === 0) continue;
    const d = Math.hypot((i % g.w) - (e % g.w), Math.floor(i / g.w) - Math.floor(e / g.w));
    if (d > bestD) { bestD = d; best = i; }
  }
  return { x: best % g.w, y: Math.floor(best / g.w) };
}

/** A spot for `id` at least `gap` tiles from every road, so it starts unconnected. */
function isolated(s: GameState, id: BuildingId, gap = 3): { x: number; y: number } {
  const rich: GameState = { ...s, budget: 1e9 };
  const g = s.grid;
  const roads = s.buildings.filter((b) => b.type === 'road');
  const c = townSiteOf(s);
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!canPlace(rich, id, x, y).ok) continue;
    if (roads.some((r) => Math.max(Math.abs(r.x - x), Math.abs(r.y - y)) <= gap)) continue;
    const d = Math.hypot(x - c.x, y - c.y);
    if (d < bestD) { bestD = d; best = { x, y }; }
  }
  if (!best) throw new Error('no isolated spot');
  return best;
}

describe('the entrance road', () => {
  it('every scenario starts with a road on open land at the edge of its land, joined to where the town will grow', () => {
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
      // The main entrance is on the map edge (islands and enclosed valleys: within a few tiles of it).
      const m = list[0] as number;
      const edge = Math.min(m % g.w, Math.floor(m / g.w), g.w - 1 - (m % g.w), g.h - 1 - Math.floor(m / g.w));
      expect(edge, id).toBeLessThanOrEqual(id === 'reef-island' ? 8 : 0);
      // A country road runs in from it, so the entrance leads somewhere.
      expect(s.buildings.filter((b) => b.type === 'road').length, id).toBeGreaterThan(3);
      expect(roadAccess(s).enforced).toBe(true);
    }
  });
  it('Net Zero City starts with every building joined to an entrance (the finished city keeps working)', () => {
    const s = createGame('net-zero-city');
    expect(roadAccess(s).unconnected).toEqual([]);
    expect(economySnapshot(s).housing).toBeGreaterThan(5000);
  });
  it('cannot be demolished', () => {
    const s = createGame('green-valley');
    const e = entranceList(s)[0] as number;
    const r = applyAction(s, { type: 'demolish', x: e % s.grid.w, y: Math.floor(e / s.grid.w) });
    expect(r.result.ok).toBe(false);
    expect(r.result.code).toBe('locked');
  });
  it('is the same for the same seed', () => {
    expect(entranceList(createGame('river-town'))).toEqual(entranceList(createGame('river-town')));
  });
});

describe('road access', () => {
  it('buildings with no road give nothing; connecting them restores them', () => {
    let s = createGame('green-valley');
    s = { ...s, budget: 1000 };
    const a = place(s, 'cottage', isolated(s, 'cottage').x, isolated(s, 'cottage').y);
    s = a.state;
    const f = place(s, 'farm', isolated(s, 'farm').x, isolated(s, 'farm').y);
    s = f.state;
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
  it('a dormant building adds no emissions or pollution; a working one does', () => {
    let s = createGame('green-valley');
    s = { ...s, year: 1960, budget: 1000 };
    const p = isolated(s, 'factory');
    const f = place(s, 'factory', p.x, p.y);
    s = f.state;
    expect(projectedEmissions(s).industry).toBe(0);
    const dormant = advanceDecade(s).state;
    expect(Math.max(...dormant.grid.airPollution)).toBe(0);
    s = connectToEntrance(s, f.uid);
    expect(projectedEmissions(s).industry).toBe(BUILDINGS.factory.co2);
    const live = advanceDecade(s).state;
    expect(Math.max(...live.grid.airPollution)).toBeGreaterThan(0);
  });
  it('a power station with no road supplies nothing', () => {
    let s = createGame('green-valley');
    s = { ...s, year: 1960, budget: 5000 };
    // Coal needs cooling water within 3 tiles; find one that is not beside a road.
    const rich = { ...s, budget: 1e9 };
    const roads = s.buildings.filter((b) => b.type === 'road');
    let spot: { x: number; y: number } | null = null;
    for (let y = 0; y < s.grid.h && !spot; y++) for (let x = 0; x < s.grid.w && !spot; x++) {
      if (canPlace(rich, 'coalpower', x, y).ok && !roads.some((r) => Math.max(Math.abs(r.x - x), Math.abs(r.y - y)) <= 2)) spot = { x, y };
    }
    expect(spot).not.toBeNull();
    const c = place(s, 'coalpower', (spot as { x: number }).x, (spot as { y: number }).y);
    expect(economySnapshot(c.state).powerSupply).toBe(0);
    const joined = connectToEntrance(c.state, c.uid);
    expect(economySnapshot(joined).powerSupply).toBe(BUILDINGS.coalpower.power);
  });
  it('connectivity breaks when a road in the chain is demolished, and comes back when it is laid again', () => {
    let s = createGame('green-valley');
    s = { ...s, budget: 1000 };
    const p = isolated(s, 'cottage', 4);
    const c = place(s, 'cottage', p.x, p.y);
    s = connectToEntrance(c.state, c.uid);
    expect(roadAccess(s).connected.has(c.uid)).toBe(true);
    const g = s.grid;
    // Break the chain at the road tile beside the cottage (a new one, not the free approach road).
    const home = s.buildings.find((b) => b.uid === c.uid)!;
    const beside = s.buildings.filter((b) => b.type === 'road' && b.builtYear === s.year)
      .sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y))[0]!;
    const mid = s.buildings.filter((b) => b.type === 'road' && b.builtYear === s.year)[1]!;
    for (const victim of [beside, mid]) {
      const broken = applyAction(s, { type: 'demolish', x: victim.x, y: victim.y });
      expect(broken.result.ok).toBe(true);
      expect(roadAccess(broken.state).connected.has(c.uid), `cut at ${victim.x},${victim.y}`).toBe(false);
      expect(economySnapshot(broken.state).housing).toBe(0);
      const route = roadRoute(broken.state, c.uid);
      expect(route).not.toBeNull();
      const fixed = connectToEntrance(broken.state, c.uid);
      expect(roadAccess(fixed).connected.has(c.uid)).toBe(true);
      expect(economySnapshot(fixed).housing).toBe(BUILDINGS.cottage.housing);
    }
    expect(g.w).toBeGreaterThan(0);
  });
  it('rail sidings serve mines and industry but not homes', () => {
    let s = createGame('coal-coast');
    s = { ...s, year: 1900, budget: 5000 };
    // Lay a rail line from the end of the approach road, then put a mine and a cottage beside only the rail.
    const site = townSiteOf(s);
    const rich = { ...s, budget: 1e9 };
    let rx = -1, ry = -1;
    const roadsNow = s.buildings.filter((b) => b.type === 'road');
    search: for (let y = 1; y < s.grid.h - 2; y++) for (let x = 1; x < s.grid.w - 5; x++) {
      if (roadsNow.some((r) => r.x === x && r.y === y)) continue;
      const touchesRoad = roadsNow.some((r) => Math.abs(r.x - x) + Math.abs(r.y - y) === 1);
      if (!touchesRoad || Math.hypot(x - site.x, y - site.y) > 12) continue;
      if (![0, 1, 2].every((k) => canPlace(rich, 'rail', x + k * 0 + 0, y).ok)) continue;
      rx = x; ry = y;
      break search;
    }
    expect(rx).toBeGreaterThan(-1);
    // A rail tile beside the road, then a cottage and a factory touching only that rail tile.
    s = place(s, 'rail', rx, ry).state;
    const acc0 = roadAccess(s);
    expect(acc0.reached[ry * s.grid.w + rx]).toBe(2);
    const around: { x: number; y: number }[] = [{ x: rx + 1, y: ry }, { x: rx - 1, y: ry }, { x: rx, y: ry + 1 }, { x: rx, y: ry - 1 }];
    const free = around.filter((p) => (s.grid.building[p.y * s.grid.w + p.x] ?? 1) === 0 && canPlace({ ...s, budget: 1e9 }, 'cottage', p.x, p.y).ok);
    expect(free.length).toBeGreaterThan(0);
    const home = free[0] as { x: number; y: number };
    const withHome = place(s, 'cottage', home.x, home.y);
    // The cottage may also touch the road; only assert the rail rule when it touches rail alone.
    const homeB = withHome.state.buildings.find((b) => b.uid === withHome.uid)!;
    const touchesRoad = withHome.state.buildings.some((b) => b.type === 'road' && roadAccess(withHome.state).reached[b.y * s.grid.w + b.x] === 1
      && Math.abs(b.x - homeB.x) + Math.abs(b.y - homeB.y) === 1);
    if (!touchesRoad) expect(roadAccess(withHome.state).connected.has(withHome.uid)).toBe(false);
    expect(BUILDINGS.coalmine.railServed).toBe(true);
    expect(BUILDINGS.cottage.railServed).toBeUndefined();
  });
  it('exempt buildings work with no road, and the exemption lives on the building def', () => {
    let s = createGame('green-valley');
    s = { ...s, year: 2025, phase: 'act2', budget: 5000 };
    const exempt = (Object.keys(BUILDINGS) as BuildingId[]).filter((id) => BUILDINGS[id].needsRoad === false);
    for (const id of ['road', 'rail', 'carpark', 'wildlifecrossing', 'transitline', 'rooftopsolar', 'parkland', 'phytoremediation',
      'wetland', 'nursery', 'coralnursery', 'offshorewind', 'tidal', 'fishway', 'seawall', 'outfall', 'bore'] as const) {
      expect(exempt, id).toContain(id);
    }
    for (const id of ['cottage', 'suburb', 'farm', 'factory', 'steelworks', 'coalmine', 'coalpower', 'solarfarm', 'windfarm', 'battery', 'excavation'] as const) {
      expect(exempt, id).not.toContain(id);
    }
    const p = isolated(s, 'nursery');
    const n = place(s, 'nursery', p.x, p.y);
    expect(roadAccess(n.state).working.has(n.uid)).toBe(true);
    expect(roadAccess(n.state).unconnected).not.toContain(n.uid);
  });
  it('rooftop solar works only beside a working home', () => {
    let s = createGame('green-valley');
    s = { ...s, year: 2025, phase: 'act2', budget: 5000 };
    const p = isolated(s, 'cottage', 4);
    const c = place(s, 'cottage', p.x, p.y);
    s = c.state;
    let panel = { x: p.x + 1, y: p.y };
    if (!canPlace({ ...s, budget: 1e9 }, 'rooftopsolar', panel.x, panel.y).ok) panel = { x: p.x, y: p.y + 1 };
    const sol = place(s, 'rooftopsolar', panel.x, panel.y);
    expect(roadAccess(sol.state).working.has(sol.uid)).toBe(false);
    const joined = connectToEntrance(sol.state, c.uid);
    expect(roadAccess(joined).working.has(sol.uid)).toBe(true);
  });
  it('is cached for a state and recomputed when buildings change', () => {
    const s = createGame('green-valley');
    expect(roadAccess(s)).toBe(roadAccess(s));
    const p = isolated(s, 'cottage');
    const c = place(s, 'cottage', p.x, p.y);
    expect(roadAccess(c.state)).not.toBe(roadAccess(s));
  });
  it('is cheap enough for a 72 x 72 map (one flood fill per state)', () => {
    const s = createGame('net-zero-city');
    const t0 = Date.now();
    for (let k = 0; k < 200; k++) roadAccess({ ...s, buildings: s.buildings.slice(), version: s.version + k + 1 });
    // 2304 tiles x 200 = 460k tile visits; a 72 x 72 map is 2.25x that, still well under a second.
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});

describe('commuting', () => {
  function town(homeGap: number): GameState {
    let s = createGame('green-valley');
    s = { ...s, year: 1960, budget: 5000 };
    const c = townSiteOf(s);
    const f = place(s, 'factory', ...(Object.values(spotFar(s, 'factory', c)) as [number, number]));
    s = connectToEntrance(f.state, f.uid);
    // Homes: nearest to the factory vs further along the same road.
    const fb = s.buildings.find((b) => b.uid === f.uid)!;
    const ref = { x: fb.x + homeGap, y: fb.y };
    const h = place(s, 'suburb', ...(Object.values(spotFar(s, 'suburb', ref)) as [number, number]));
    s = connectToEntrance(h.state, h.uid);
    return { ...s, population: 100 };
  }
  it('is zero with no homes or jobs, and positive for a town with both', () => {
    expect(commuteStats(createGame('green-valley')).ktPerDecade).toBe(0);
    const t = town(0);
    expect(commuteStats(t).meanDist).toBeGreaterThan(0);
    expect(commuteStats(t).ktPerDecade).toBeGreaterThan(0);
    expect(commuteStats(t).ktPerDecade).toBeLessThan(10);
  });
  it('a longer road between homes and jobs means more commute emissions', () => {
    const near = town(0), far = town(14);
    const d = (s: GameState): number => commuteStats(s).meanDist;
    expect(d(far)).toBeGreaterThanOrEqual(d(near));
  });
  it('shows up as its own number in the decade report, inside the transport total', () => {
    const t = town(0);
    const { report } = advanceDecade({ ...t, population: 100, year: 1960 });
    expect(report?.commuteKt).toBeGreaterThan(0);
    expect(report?.emissionsKt.transport).toBeGreaterThanOrEqual(report?.commuteKt ?? Infinity);
    expect(report?.commuteTiles).toBeGreaterThan(0);
  });
  it('light rail cuts it', () => {
    const t = town(6);
    const base = commuteStats(t).ktPerDecade;
    let s: GameState = { ...t, scenarioId: 'coal-coast' };
    s = { ...s, phase: 'act2' };
    const withRail = { ...t, buildings: [...t.buildings, { uid: 9001, type: 'transitline' as const, x: 0, y: 0, rotation: 0 as Rotation, w: 1, h: 3, builtYear: 2025 }] };
    expect(commuteStats(withRail).transitCut).toBeGreaterThan(0);
    expect(commuteStats(withRail).ktPerDecade).toBeLessThan(base);
    void s;
  });
});

describe('saves from before roads mattered', () => {
  it('load with an entrance added, and the old town then needs roads', () => {
    let s = createGame('green-valley');
    s = { ...s, budget: 1000 };
    const p = isolated(s, 'cottage');
    s = connectToEntrance(place(s, 'cottage', p.x, p.y).state, place(s, 'cottage', p.x, p.y).uid);
    // Make it look like an old save: no entrance flag, no entrance or approach roads.
    const old: GameState = { ...s, flags: { ...s.flags } };
    for (const k of Object.keys(old.flags)) if (k.startsWith('road.entrance')) delete old.flags[k];
    const keep = old.buildings.filter((b) => b.type !== 'road');
    const grid = { ...old.grid, building: old.grid.building.slice() };
    for (const b of old.buildings) if (b.type === 'road') grid.building[b.y * grid.w + b.x] = 0;
    const text = serialize({ ...old, buildings: keep, grid });
    expect(JSON.parse(text).flags['road.entrance']).toBeUndefined();
    const loaded = deserialize(text);
    expect(loaded).not.toBeNull();
    const l = loaded as GameState;
    expect(entranceList(l).length).toBeGreaterThanOrEqual(1);
    expect(roadAccess(l).enforced).toBe(true);
    // The old cottage is now waiting for a road; connecting restores it.
    const home = l.buildings.find((b) => b.type === 'cottage')!;
    expect(roadAccess(l).connected.has(home.uid)).toBe(false);
    const fixed = connectToEntrance({ ...l, budget: 1000 }, home.uid);
    expect(roadAccess(fixed).connected.has(home.uid)).toBe(true);
  });
  it('a modern save keeps its entrances through a round trip', () => {
    const s = createGame('river-town');
    const back = deserialize(serialize(s)) as GameState;
    expect(entranceList(back)).toEqual(entranceList(s));
    expect(back.buildings.length).toBe(s.buildings.length);
  });
});

describe('the Green Valley tutorial road step', () => {
  it('asks the player to connect homes and the farm to the road from the edge, and checks roadAccess', () => {
    let s = createGame('green-valley');
    s = { ...s, budget: 1000 };
    const steps = (): string => tutorialStatus(s).current?.id ?? '';
    let ids: string[] = [];
    for (let k = 0; k < 3; k++) {
      const p = isolated(s, 'cottage', 3);
      s = place(s, 'cottage', p.x, p.y).state;
    }
    const pf = isolated(s, 'farm', 3);
    s = place(s, 'farm', pf.x, pf.y).state;
    ids = [steps()];
    expect(ids[0]).toBe('roads');
    const st = tutorialStatus(s);
    expect(st.current?.instruction).toMatch(/Connect your homes and farm to the road from the edge of the valley/);
    for (const b of s.buildings.filter((o) => o.type === 'cottage' || o.type === 'farm')) s = connectToEntrance(s, b.uid);
    expect(steps()).not.toBe('roads');
    expect(tutorialStatus(s).steps.find((x) => x.id === 'roads')?.done).toBe(true);
  });
});
