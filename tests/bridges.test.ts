import { describe, expect, it } from 'vitest';
import {
  addFreeRoad, applyAction, BRIDGE_COST_MULT, BRIDGE_SPAN_MAX, BUILDINGS, canPlace, cloneState, commuteStats, createGame, deserialize, entranceList,
  MSG_ENDS, MSG_KIND, MSG_SPAN, MSG_STRAIGHT, roadAccess, roadExposure, roadRoute, SCENARIO_IDS, serialize, TileKind,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { connectToEntrance } from './helpers/roads';

const K = TileKind;

/**
 * A 32 x 32 field of open land cut top to bottom by a creek `width` tiles wide at x = 10 .. 10 + width - 1, with the entrance
 * road at the west edge (0, 10) running in to (9, 10). 1960, plenty of money.
 */
function creek(width: number, kind: number = K.River): GameState {
  const s = cloneState(createGame('green-valley'));
  const g = s.grid;
  g.kind.fill(K.Land);
  g.elevation.fill(1);
  g.building.fill(0);
  s.buildings = [];
  s.nextUid = 1;
  for (const k of Object.keys(s.flags)) if (k.startsWith('road.entrance')) delete s.flags[k];
  s.year = 1960;
  s.budget = 5000;
  for (let y = 0; y < g.h; y++) for (let x = 10; x < 10 + width; x++) g.kind[y * g.w + x] = kind;
  for (let x = 0; x <= 9; x++) addFreeRoad(s, 10 * g.w + x);
  s.flags['road.entrance'] = 10 * g.w;
  return s;
}

const road = (s: GameState, x: number, y: number) => applyAction(s, { type: 'place', building: 'road', x, y });

describe('bridge placement rules', () => {
  it('a road can be laid over 1, 2 or 3 tiles of creek, and pays the bridge price for each water tile', () => {
    for (const w of [1, 2, 3]) {
      let s = creek(w);
      const before = s.budget;
      const roadCost = BUILDINGS.road.cost;
      for (let x = 10; x < 10 + w; x++) {
        const chk = canPlace(s, 'road', x, 12);
        expect(chk.ok, `w${w} x${x}: ${chk.reason ?? ''}`).toBe(true);
        expect(chk.cost).toBe(roadCost * BRIDGE_COST_MULT);
        const r = road(s, x, 12);
        expect(r.result.ok).toBe(true);
        s = r.state;
      }
      expect(before - s.budget).toBe(roadCost * BRIDGE_COST_MULT * w);
      // ordinary road tiles still cost the road price
      expect(canPlace(s, 'road', 5, 12).cost).toBe(roadCost);
    }
    expect(BRIDGE_SPAN_MAX).toBe(3);
  });
  it('a creek wider than 3 tiles cannot be bridged, with a clear reason', () => {
    const s = creek(4);
    for (let x = 10; x < 14; x++) {
      const chk = canPlace(s, 'road', x, 12);
      expect(chk.ok).toBe(false);
      expect(chk.reason).toBe(MSG_SPAN);
    }
    expect(MSG_SPAN).toBe('Bridges can span at most 3 tiles of water');
  });
  it('only a river or creek can be bridged: not the sea, the reef, the estuary or a wetland', () => {
    for (const kind of [K.Sea, K.Reef, K.Estuary, K.Wetland]) {
      const s = creek(1, kind);
      const chk = canPlace(s, 'road', 10, 12);
      expect(chk.ok, `kind ${kind}`).toBe(false);
      if (kind !== K.Wetland) expect(chk.reason).toBe(MSG_KIND);
    }
  });
  it('a bridge runs straight across: a corner of the creek has no straight way over, and a bend is refused', () => {
    // a long creek that only a bend could cross: the corner tile has no straight way over
    const t = creek(1);
    const g = t.grid;
    for (let x = 10; x < 20; x++) g.kind[11 * g.w + x] = K.River; // a second creek along y = 11 makes (10, 11) a corner
    const corner = canPlace(t, 'road', 10, 11);
    expect(corner.ok).toBe(false);
    expect(corner.reason).toBe(MSG_SPAN);
    // a creek bounded by a wetland has no open ground to land on at one end
    const u = creek(1);
    u.grid.kind[12 * u.grid.w + 9] = K.Wetland;
    u.grid.kind[11 * u.grid.w + 9] = K.Wetland;
    u.grid.kind[13 * u.grid.w + 9] = K.Wetland;
    const wet = canPlace(u, 'road', 10, 12);
    expect(wet.ok).toBe(false);
    expect(wet.reason).toBe(MSG_ENDS);
    expect(MSG_ENDS.startsWith(MSG_STRAIGHT)).toBe(true);
    expect(MSG_STRAIGHT).toBe('A bridge must run straight across');
    // two tiles that could only be crossed in different directions make a bend: refused
    const v = creek(1);
    const gv = v.grid;
    // (10, 12) crosses west-east. Make (10, 13) crossable only north-south by closing its west and east sides with a long water run.
    for (let x = 4; x < 20; x++) gv.kind[13 * gv.w + x] = K.River;
    gv.kind[14 * gv.w + 10] = K.Land;
    gv.kind[12 * gv.w + 10] = K.River;
    const first = applyAction(v, { type: 'place', building: 'road', x: 10, y: 12 });
    expect(first.result.ok).toBe(true);
    const bend = canPlace(first.state, 'road', 10, 13);
    expect(bend.ok).toBe(false);
    expect([MSG_STRAIGHT, MSG_SPAN, MSG_ENDS]).toContain(bend.reason);
  });
  it('a second lane may run beside a bridge, and the next tile along the span carries on', () => {
    let s = creek(2);
    s = road(s, 10, 12).state;
    expect(canPlace(s, 'road', 11, 12).ok).toBe(true);
    expect(canPlace(s, 'road', 10, 13).ok).toBe(true);
  });
  it('works in Act 2 as well, and costs money like anything else', () => {
    const s = creek(2);
    s.phase = 'act2';
    s.year = 2030;
    expect(canPlace(s, 'road', 10, 12).ok).toBe(true);
    s.budget = BUILDINGS.road.cost * BRIDGE_COST_MULT - 1;
    expect(canPlace(s, 'road', 10, 12).ok).toBe(false);
  });
});

describe('connectivity across a bridge', () => {
  it('a home across the creek only works once the bridge joins it to the entrance, and the route plans the bridge', () => {
    let s = creek(2);
    const r = applyAction(s, { type: 'place', building: 'cottage', x: 16, y: 11 });
    expect(r.result.ok).toBe(true);
    s = r.state;
    const uid = r.result.uid as number;
    expect(roadAccess(s).connected.has(uid)).toBe(false);
    const route = roadRoute(s, uid);
    expect(route).not.toBeNull();
    const g = s.grid;
    // the planned route crosses the water straight, and the scripted helper lays it
    expect((route as number[]).filter((i) => g.kind[i] === K.River).length).toBeGreaterThanOrEqual(2);
    const fixed = connectToEntrance(s, uid);
    expect(roadAccess(fixed).connected.has(uid)).toBe(true);
    expect(fixed.grid.kind[10 * g.w + 10]).toBe(K.River); // the water underneath is untouched
    const bridges = fixed.buildings.filter((b) => b.type === 'road' && fixed.grid.kind[b.y * g.w + b.x] === K.River);
    expect(bridges.length).toBe(2);
  });
  it('commuting counts the road distance over the bridge', () => {
    let s = creek(1);
    s = applyAction(s, { type: 'place', building: 'cottage', x: 3, y: 11 }).state;
    s = applyAction(s, { type: 'place', building: 'farm', x: 14, y: 11 }).state;
    s = { ...s, population: 100 };
    const before = commuteStats(s).meanDist;
    for (const b of [...s.buildings]) if (b.type !== 'road') s = connectToEntrance(s, b.uid);
    expect(roadAccess(s).unconnected).toEqual([]);
    expect(commuteStats(s).meanDist).toBeGreaterThan(0);
    expect(before).toBe(0);
  });
  it('a long span is refused by the router (it finds no route) rather than building a bridge that breaks the rules', () => {
    let s = creek(5);
    const r = applyAction(s, { type: 'place', building: 'cottage', x: 20, y: 11 });
    s = r.state;
    expect(roadRoute(s, r.result.uid as number)).toBeNull();
  });
  it('demolishing a bridge cuts off what was joined across it, and refunds a share of its price', () => {
    let s = creek(1);
    s = road(s, 10, 12).state; // not joined to anything yet
    s = connectToEntrance(applyAction(s, { type: 'place', building: 'cottage', x: 14, y: 10 }).state, s.nextUid);
    const uid = s.buildings.find((b) => b.type === 'cottage')?.uid as number;
    s = connectToEntrance(s, uid);
    expect(roadAccess(s).connected.has(uid)).toBe(true);
    const bridge = s.buildings.find((b) => b.type === 'road' && s.grid.kind[b.y * s.grid.w + b.x] === K.River && b.y === 10) ?? s.buildings.find((b) => b.type === 'road' && s.grid.kind[b.y * s.grid.w + b.x] === K.River);
    expect(bridge).toBeDefined();
    const before = s.budget;
    const d = applyAction(s, { type: 'demolish', x: (bridge as { x: number }).x, y: (bridge as { y: number }).y });
    expect(d.result.ok).toBe(true);
    expect(d.state.budget).toBeGreaterThan(before);
    expect(d.state.grid.kind[(bridge as { y: number }).y * s.grid.w + (bridge as { x: number }).x]).toBe(K.River);
    expect(roadAccess(d.state).connected.has(uid)).toBe(false);
  });
});

describe('bridges and the rest of the game', () => {
  it('survive a save and load, and old saves still load', () => {
    let s = creek(2);
    s = road(s, 10, 12).state;
    s = road(s, 11, 12).state;
    const back = deserialize(serialize(s)) as GameState;
    expect(back).not.toBeNull();
    const g = back.grid;
    const bridges = back.buildings.filter((b) => b.type === 'road' && g.kind[b.y * g.w + b.x] === K.River);
    expect(bridges.length).toBe(2);
    expect(g.building[12 * g.w + 10]).not.toBe(0);
    // a save from before bridges (no river roads) loads with its entrance intact
    const old = createGame('green-valley');
    const l = deserialize(serialize(old)) as GameState;
    expect(entranceList(l)).toEqual(entranceList(old));
  });
  it('a bridge over water does not split land habitat; a road on land does', () => {
    const s = creek(1);
    const g = s.grid;
    const tiles = [12 * g.w + 9, 12 * g.w + 11]; // habitat tiles on both banks
    const bridged = road(s, 10, 12).state;
    expect(roadExposure(bridged, [12 * g.w + 7])).toBe(0);
    expect(roadExposure(bridged, tiles)).toBe(0);
    const onLand = road(s, 9, 12).state;
    expect(roadExposure(onLand, tiles)).toBeGreaterThan(0);
  });
  it('the water under a bridge keeps its tile kind and its pollution', () => {
    let s = creek(1);
    const g = s.grid;
    g.waterPollution[12 * g.w + 10] = 0.7;
    s = road(s, 10, 12).state;
    expect(s.grid.kind[12 * g.w + 10]).toBe(K.River);
    expect(s.grid.waterPollution[12 * g.w + 10]).toBeCloseTo(0.7, 5);
  });
});

describe('entrance roads never stop dead at the water', () => {
  /** Follow the country road in from an entrance until it forks or ends; returns the tile it stops at. */
  function roadEnd(s: GameState, entrance: number): { end: number; dead: boolean } {
    const g = s.grid;
    const isRoad = (i: number): boolean => i >= 0 && i < g.w * g.h && (g.building[i] ?? 0) !== 0 && s.buildings.find((b) => b.uid === g.building[i])?.type === 'road';
    const nb = (i: number): number[] => {
      const x = i % g.w;
      return [x > 0 ? i - 1 : -1, x < g.w - 1 ? i + 1 : -1, i - g.w, i + g.w].filter(isRoad);
    };
    const seen = new Set<number>([entrance]);
    let cur = entrance;
    for (let guard = 0; guard < 5000; guard++) {
      const next = nb(cur).filter((j) => !seen.has(j));
      if (next.length === 0) return { end: cur, dead: true };
      if (next.length > 1) return { end: cur, dead: false };
      seen.add(next[0] as number);
      cur = next[0] as number;
    }
    return { end: cur, dead: true };
  }
  const waterNear = (s: GameState, i: number): boolean => {
    const g = s.grid;
    const x = i % g.w, y = Math.floor(i / g.w);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
      const k = g.kind[yy * g.w + xx];
      if (k === K.Sea || k === K.Reef || k === K.Estuary || k === K.River || k === K.Wetland) return true;
    }
    return false;
  };
  for (const id of SCENARIO_IDS) {
    it(`${id}: every entrance road ends in the open, not at the water's edge, and its bridges (if any) stand on creek tiles`, () => {
      const s = createGame(id);
      for (const e of entranceList(s)) {
        const { end, dead } = roadEnd(s, e);
        if (dead) expect(waterNear(s, end), `dead end at ${end % s.grid.w},${Math.floor(end / s.grid.w)}`).toBe(false);
      }
      const g = s.grid;
      for (const b of s.buildings) {
        if (b.type !== 'road') continue;
        const k = g.kind[b.y * g.w + b.x];
        expect([K.Land, K.River, K.Beach, K.Bush], `${b.x},${b.y}`).toContain(k);
      }
    });
  }
  it('Green Valley has one entrance, and its road reaches the open ground on both sides of the creek or stays on one side with room to grow', () => {
    const s = createGame('green-valley');
    expect(entranceList(s).length).toBe(1);
    expect(roadAccess(s).enforced).toBe(true);
  });
});
