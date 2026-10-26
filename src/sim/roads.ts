/**
 * Roads matter. A building only works when a tile beside it is a road (or, for mines and heavy industry, a rail siding)
 * that is joined by road and rail to the town's entrance: a road tile at the edge of the map. Everything here is a pure
 * function of the state and cached by `version`, so it is cheap even on a 72 x 72 map (one flood fill of the road
 * network, a handful of array passes).
 *
 * States with no entrance recorded (the unit-test sandboxes) are "not enforced": every building counts as connected.
 * createGame and old saves both get an entrance, so real games always enforce the rule.
 */
import { BUILDINGS } from './buildings';
import { bridgeAxes, bridgeOkAlong, bridgeProblem } from './bridges';
import { cityCentre } from './prebuilt';
import { getScenario } from './scenarios';
import { TileKind } from './types';
import type { BuildingId, GameState, PlacedBuilding } from './types';

/**
 * flags keys holding the tile index (y * w + x) of an entrance road: `road.entrance` for the main one, `road.entrance.2`,
 * `.3`... for any other stretch of buildable land that the sea or a river too wide to bridge cuts off from it.
 */
export const ENTRANCE_FLAG = 'road.entrance';
/** Smallest stretch of open land that gets an entrance of its own. */
export const MIN_REGION_TILES = 30;

/** Longest commute counted, in tiles of road. */
export const COMMUTE_CAP = 24;
/**
 * kt CO2 per decade for one person commuting one tile of road each way every working day. Calibrated (see
 * tests/balance-seeds.test.ts and docs/GAMEPLAY.md) so the scripted towns' cumulative emissions move by under 5 percent.
 */
export const COMMUTE_KT = 0.0004;
/** Each working light-rail line cuts commute emissions by this share, up to TRANSIT_MAX. */
export const TRANSIT_CUT = 0.12;
export const TRANSIT_MAX = 0.6;

export interface RoadAccess {
  /** False when the state has no entrance (test sandboxes): every building then counts as connected. */
  enforced: boolean;
  /** Tile index of the main entrance road, or null. */
  entrance: number | null;
  /** Tile indices of every entrance road. */
  entrances: readonly number[];
  /** Per tile: 0 not reached, 1 road-like tile reached from the entrance, 2 rail siding reached from the entrance. */
  reached: Uint8Array;
  /** uids of buildings that need a road and have one connected to the entrance. */
  connected: ReadonlySet<number>;
  /** uids of buildings that need a road and have none (these give nothing). */
  unconnected: readonly number[];
  /** uids of every building that currently works (connected, exempt, or hosted by a working home). */
  working: ReadonlySet<number>;
  /** Buildings that work, in placement order. */
  workingBuildings: readonly PlacedBuilding[];
}

interface CacheEntry { version: number; len: number; key: string; result: RoadAccess }
const CACHE = new WeakMap<readonly PlacedBuilding[], CacheEntry>();

/** Tile indices of the entrance roads, main one first. */
export function entranceList(state: Pick<GameState, 'flags'>): number[] {
  const out: number[] = [];
  const main = state.flags[ENTRANCE_FLAG];
  if (typeof main === 'number' && main >= 0) out.push(main);
  for (const k of Object.keys(state.flags).sort()) {
    const v = state.flags[k];
    if (k.startsWith(ENTRANCE_FLAG + '.') && typeof v === 'number' && v >= 0) out.push(v);
  }
  return out;
}

export function entranceIndex(state: Pick<GameState, 'flags'>): number | null {
  return entranceList(state)[0] ?? null;
}

export function isEntrance(state: Pick<GameState, 'flags' | 'grid'>, x: number, y: number): boolean {
  return entranceList(state).includes(y * state.grid.w + x);
}

/** The finished Net Zero City keeps its two entrances and its dry-ground roads; every other scenario may bridge. */
const bridgesOn = (state: Pick<GameState, 'scenarioId'>): boolean => getScenario(state.scenarioId).prebuilt !== 'city';

const needsRoad = (type: BuildingId): boolean => BUILDINGS[type].needsRoad !== false;

function compute(state: GameState): RoadAccess {
  const g = state.grid;
  const n = g.w * g.h;
  const entrances = entranceList(state);
  const entrance = entrances[0] ?? null;
  const reached = new Uint8Array(n);
  if (entrance === null) {
    const all = new Set(state.buildings.map((b) => b.uid));
    return {
      enforced: false, entrance: null, entrances, reached, connected: all, unconnected: [], working: all, workingBuildings: state.buildings,
    };
  }
  // Which network each tile carries: 1 road-like, 2 rail.
  const net = new Uint8Array(n);
  for (const b of state.buildings) {
    const nw = BUILDINGS[b.type].network;
    if (!nw) continue;
    const v = nw === 'road' ? 1 : 2;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) net[y * g.w + x] = v;
  }
  {
    const queue = new Int32Array(n);
    let qh = 0, qt = 0;
    for (const e of entrances) {
      if ((net[e] ?? 0) === 0 || reached[e] !== 0) continue;
      reached[e] = net[e] ?? 1;
      queue[qt++] = e;
    }
    while (qh < qt) {
      const i = queue[qh++] as number;
      const x = i % g.w;
      const nb = [x > 0 ? i - 1 : -1, x < g.w - 1 ? i + 1 : -1, i - g.w, i + g.w];
      for (const j of nb) {
        if (j < 0 || j >= n || reached[j] !== 0 || (net[j] ?? 0) === 0) continue;
        reached[j] = net[j] as number;
        queue[qt++] = j;
      }
    }
  }
  const connected = new Set<number>();
  const unconnected: number[] = [];
  const working = new Set<number>();
  for (const b of state.buildings) {
    const d = BUILDINGS[b.type];
    if (d.needsRoad === false) continue;
    let ok = false;
    const touch = (xx: number, yy: number): void => {
      if (ok || xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) return;
      const r = reached[yy * g.w + xx] ?? 0;
      if (r === 1 || (r === 2 && d.railServed === true)) ok = true;
    };
    for (let k = 0; k < b.w && !ok; k++) { touch(b.x + k, b.y - 1); touch(b.x + k, b.y + b.h); }
    for (let k = 0; k < b.h && !ok; k++) { touch(b.x - 1, b.y + k); touch(b.x + b.w, b.y + k); }
    // Grown homes and shops are reached by a lane or driveway: a connected road within `roadReach` tiles will do.
    const reach = d.roadReach ?? 1;
    if (!ok && reach > 1) {
      for (let yy = b.y - reach; yy < b.y + b.h + reach && !ok; yy++) for (let xx = b.x - reach; xx < b.x + b.w + reach && !ok; xx++) touch(xx, yy);
    }
    if (ok) { connected.add(b.uid); working.add(b.uid); } else unconnected.push(b.uid);
  }
  // Exempt buildings work, except ones that sit on a home (rooftop solar): those need a working home beside them.
  const homes = state.buildings.filter((b) => BUILDINGS[b.type].housing > 0 && working.has(b.uid));
  for (const b of state.buildings) {
    const d = BUILDINGS[b.type];
    if (d.needsRoad !== false) continue;
    const host = d.placement.nearBuilding;
    if (host && d.hostedOnHomes === true) {
      const ok = homes.some((h) => {
        const dx = Math.max(b.x - (h.x + h.w - 1), h.x - (b.x + b.w - 1));
        const dy = Math.max(b.y - (h.y + h.h - 1), h.y - (b.y + b.h - 1));
        return Math.max(dx, dy) <= host.dist;
      });
      if (ok) working.add(b.uid);
    } else working.add(b.uid);
  }
  return {
    enforced: true, entrance, entrances, reached, connected, unconnected, working,
    workingBuildings: state.buildings.filter((b) => working.has(b.uid)),
  };
}

/** Road access for the whole town, cached by version. */
export function roadAccess(state: GameState): RoadAccess {
  const key = entranceList(state).join(',');
  const hit = CACHE.get(state.buildings);
  if (hit && hit.version === state.version && hit.len === state.buildings.length && hit.key === key) return hit.result;
  const result = compute(state);
  CACHE.set(state.buildings, { version: state.version, len: state.buildings.length, key, result });
  return result;
}

/**
 * A copy of the state in which the road rule is off (every building counts as connected). For what-if sums, such as the cost
 * of one more building, where the new building has not been given a place or a road yet.
 */
export function assumeRoads<T extends Pick<GameState, 'flags'>>(state: T): T {
  const flags: GameState['flags'] = {};
  for (const k of Object.keys(state.flags)) if (!k.startsWith(ENTRANCE_FLAG)) flags[k] = state.flags[k] as boolean | number;
  return { ...state, flags };
}

const REACH_CACHE = new WeakMap<Uint8Array, { version: number; key: string; mask: Uint8Array }>();

/** Land and bush tiles joined (ignoring buildings) to some entrance: the only ground a road in from the edge can ever cover. */
function entranceLand(state: GameState): Uint8Array | null {
  const entrances = entranceList(state);
  if (entrances.length === 0) return null;
  const g = state.grid;
  const key = entrances.join(',');
  const hit = REACH_CACHE.get(g.kind);
  if (hit && hit.version === state.version && hit.key === key) return hit.mask;
  const n = g.w * g.h;
  const mask = new Uint8Array(n);
  // Short stretches of river can be bridged, so land across one still counts as reachable.
  const bridges = bridgesOn(state);
  const isLand = (i: number): boolean => g.kind[i] === TileKind.Land || g.kind[i] === TileKind.Bush || (bridges && g.kind[i] === TileKind.River && bridgeAxes(g, i).length > 0);
  const queue: number[] = [];
  for (const e of entrances) if (e >= 0 && e < n && mask[e] === 0) { mask[e] = 1; queue.push(e); }
  for (let qh = 0; qh < queue.length; qh++) {
    for (const j of neighbours(queue[qh] as number, g.w, g.h)) if (mask[j] === 0 && isLand(j)) { mask[j] = 1; queue.push(j); }
  }
  REACH_CACHE.set(g.kind, { version: state.version, key, mask });
  return mask;
}

/**
 * True when a building that needs a road could never be joined to the entrance if put on this footprint: no tile beside it
 * belongs to a stretch of land that has an entrance (a small island of land cut off by water, say). False when roads are not enforced.
 */
export function roadUnreachable(state: GameState, type: BuildingId, x: number, y: number, w: number, h: number): boolean {
  if (!needsRoad(type)) return false;
  const mask = entranceLand(state);
  if (!mask) return false;
  const g = state.grid;
  for (let yy = y - 1; yy <= y + h; yy++) {
    for (let xx = x - 1; xx <= x + w; xx++) {
      const corner = (xx < x || xx >= x + w) && (yy < y || yy >= y + h);
      if (corner || xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
      if (xx >= x && xx < x + w && yy >= y && yy < y + h) continue;
      if (mask[yy * g.w + xx] === 1) return false;
    }
  }
  return true;
}

/** Buildings that currently work (connected to the entrance, or exempt from needing a road). */
export function workingBuildings(state: GameState): readonly PlacedBuilding[] {
  return roadAccess(state).workingBuildings;
}

export function isWorking(state: GameState, uid: number): boolean {
  return roadAccess(state).working.has(uid);
}

// ---------------------------------------------------------------------------------------------------------
// Placing the entrance and finding road routes
// ---------------------------------------------------------------------------------------------------------

/** Can a road tile go here? (Mirrors canPlace for the road: open Land or Bush, but not mine-site ground being rehabilitated in Act 2.) */
export function roadTileOk(state: GameState, i: number): boolean {
  return roadTileCost(state, i) > 0;
}

/** What laying a road on a tile costs in routing terms: 0 not allowed, 1 open ground, BUSH_STEP for bush (the bush is lost). */
export const BUSH_STEP = 3;
export function roadTileCost(state: GameState, i: number): number {
  const g = state.grid;
  if ((g.building[i] ?? 0) !== 0) return 0;
  const k = g.kind[i];
  // Routes go round places of cultural significance if they can (building on one without asking is a harm, see country.ts).
  let care = (g.significant?.[i] ?? 0) > 0 ? SIGNIFICANT_STEP : 0;
  // Red Dirt's mine site must stay free of roads, or it could never be fully rehabilitated.
  const z = g.zone?.[i] ?? 0;
  if (z > 0 && z < 250 && (getScenario(state.scenarioId).mechanics ?? []).includes('outback')) {
    if (state.phase === 'act2') return 0;
    care += SIGNIFICANT_STEP;
  }
  if (k === TileKind.Land) return 1 + care;
  return k === TileKind.Bush ? BUSH_STEP + care : 0;
}

/** Extra routing cost of a road tile on a significant place. */
export const SIGNIFICANT_STEP = 25;

const neighbours = (i: number, w: number, h: number): number[] => {
  const x = i % w, y = Math.floor(i / w);
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < w - 1) out.push(i + 1);
  if (y > 0) out.push(i - w);
  if (y < h - 1) out.push(i + w);
  return out;
};

/** Where the town will likely grow: the free open tile nearest the water hub (estuary, wetland, river) or the map middle. */
function townSite(state: GameState): { x: number; y: number } {
  const g = state.grid;
  let cx = g.w / 2, cy = g.h / 2;
  if (state.buildings.length === 0 && getScenario(state.scenarioId).prebuilt === 'city') {
    const c = cityCentre(state);
    cx = c.x; cy = c.y;
  } else if (state.buildings.length > 0) {
    cx = 0; cy = 0;
    for (const b of state.buildings) { cx += b.x + b.w / 2; cy += b.y + b.h / 2; }
    cx /= state.buildings.length; cy /= state.buildings.length;
  } else {
    for (const k of state.scenarioId === 'river-town' ? [TileKind.River] : [TileKind.Estuary, TileKind.Wetland, TileKind.River]) {
      let sx = 0, sy = 0, c = 0;
      for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === k) { sx += i % g.w; sy += Math.floor(i / g.w); c++; }
      if (c > 0) { cx = sx / c; cy = sy / c; break; }
    }
  }
  return { x: cx, y: cy };
}

/**
 * Where the town is (or will be), for framing the camera: the Net Zero City centre, the centre of the buildings other than roads,
 * or the water hub / middle of the map on a fresh game.
 */
export function townFocus(state: GameState): { x: number; y: number } {
  return townSite({ ...state, buildings: state.buildings.filter((b) => b.type !== 'road') });
}

/**
 * Stretches of buildable land (Land and Bush, ignoring buildings) that are big enough to build a town on, found by flood
 * fill. Land on either side of a creek or river that a bridge could cross counts as one stretch (the bridge tiles are part of
 * the region but are not land). The one nearest the town site comes first.
 */
function landRegions(state: GameState): number[][] {
  const g = state.grid;
  const seen = new Uint8Array(g.kind.length);
  const regions: number[][] = [];
  const site = townSite(state);
  const bridges = bridgesOn(state);
  for (let s0 = 0; s0 < g.kind.length; s0++) {
    const k0 = g.kind[s0];
    if (seen[s0] === 1 || (k0 !== TileKind.Land && k0 !== TileKind.Bush)) continue;
    const tiles = [s0];
    seen[s0] = 1;
    let landCount = 0;
    for (let qh = 0; qh < tiles.length; qh++) {
      const t = tiles[qh] as number;
      if (g.kind[t] !== TileKind.River) landCount++;
      for (const j of neighbours(t, g.w, g.h)) {
        const k = g.kind[j];
        if (seen[j] === 0 && (k === TileKind.Land || k === TileKind.Bush || (bridges && k === TileKind.River && bridgeAxes(g, j).length > 0))) { seen[j] = 1; tiles.push(j); }
      }
    }
    if (landCount >= MIN_REGION_TILES) regions.push(tiles);
  }
  const nearest = (r: number[]): number => Math.min(...r.map((i) => Math.hypot((i % g.w) - site.x, Math.floor(i / g.w) - site.y)));
  return regions.sort((a, b) => nearest(a) - nearest(b));
}

/**
 * The tile for a region's entrance: a free tile on the map edge if it has one (otherwise the free tile nearest the edge),
 * nearest to `toward` first.
 */
function entranceFor(state: GameState, region: number[], toward: { x: number; y: number }, ok: (i: number) => boolean, side?: 'n' | 's' | 'e' | 'w'): number | null {
  const g = state.grid;
  let best: number | null = null, bestKey = Infinity;
  for (const i of region) {
    if (!ok(i)) continue;
    const x = i % g.w, y = Math.floor(i / g.w);
    if (side && !(side === 'n' ? y === 0 : side === 's' ? y === g.h - 1 : side === 'w' ? x === 0 : x === g.w - 1)) continue;
    const edge = Math.min(x, y, g.w - 1 - x, g.h - 1 - y);
    const key = edge * 1000 + Math.hypot(x - toward.x, y - toward.y);
    if (key < bestKey) { bestKey = key; best = i; }
  }
  return best;
}

/** Routing weight of one bridge tile: a bridge is only worth it when the way round is more than this many tiles longer. */
export const BRIDGE_STEP = 8;
/** The entrance road crosses a creek only when the land beyond it is more than this many tiles nearer the town site. */
export const BRIDGE_PREFERENCE = 3;
/** The entrance road ends at least this many tiles from water (less if there is no such tile). */
export const ENTRANCE_CLEARANCE = 2;

/**
 * Cheapest path (tile indices, first source to goal) from any of `sources` to a tile where `goal` holds. `cost(j)` is what
 * entering tile j costs (-1 blocked, 0 free). A River tile with a positive cost is a bridge tile: it must be entered along an
 * axis the bridge rules allow, and the path may not turn while it is on water. Direction is part of the search state.
 */
function routeWithBridges(state: GameState, sources: readonly number[], goal: (i: number) => boolean, cost: (j: number) => number): { path: number[]; cost: number } | null {
  const g = state.grid;
  const n = g.w * g.h;
  const DX = [-1, 1, 0, 0], DY = [0, 0, -1, 1];
  const dist = new Int32Array(n * 5).fill(-1);
  const prev = new Int32Array(n * 5).fill(-1);
  const settled = new Uint8Array(n * 5);
  const buckets: number[][] = [[]];
  for (const i of sources) { dist[i * 5 + 4] = 0; (buckets[0] as number[]).push(i * 5 + 4); }
  let found = -1;
  for (let d = 0; d < buckets.length && found < 0; d++) {
    const cur = buckets[d] as number[];
    while (cur.length > 0) {
      const st = cur.pop() as number;
      if (settled[st] === 1 || dist[st] !== d) continue;
      settled[st] = 1;
      const i = Math.floor(st / 5), dir = st % 5;
      if (goal(i)) { found = st; break; }
      const x = i % g.w, y = Math.floor(i / g.w);
      for (let nd = 0; nd < 4; nd++) {
        const xx = x + (DX[nd] as number), yy = y + (DY[nd] as number);
        if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
        const j = yy * g.w + xx;
        const c = cost(j);
        if (c < 0) continue;
        // no turning on a bridge still to be built (turning on an existing bridge's lane is fine: it is joined already)
        if (g.kind[i] === TileKind.River && dir !== 4 && dir !== nd && cost(i) > 0) continue;
        if (c > 0 && g.kind[j] === TileKind.River && (!bridgeOkAlong(g, j, ((nd >> 1) as 0 | 1)) || bridgeProblem(state, xx, yy) !== null)) continue;
        const sj = j * 5 + nd;
        if (settled[sj] === 1) continue;
        const ndist = d + c;
        if (dist[sj] === -1 || ndist < (dist[sj] as number)) {
          dist[sj] = ndist;
          prev[sj] = st;
          while (buckets.length <= ndist) buckets.push([]);
          (buckets[ndist] as number[]).push(sj);
        }
      }
    }
  }
  if (found < 0) return null;
  const path: number[] = [];
  for (let st = found; st >= 0; st = prev[st] as number) path.push(Math.floor(st / 5));
  return { path: path.reverse(), cost: dist[found] as number };
}

/**
 * Lays free road tiles (and free bridge tiles over a creek the road has to cross) along the shortest path from tile `from`
 * to tile `to` (both included). Setup only. Returns the number of tiles laid (0 if there is no path).
 */
function layApproach(state: GameState, from: number, to: number, ok: (i: number) => boolean): number {
  const g = state.grid;
  // Shortest path over open ground (breadth first). Only when the open ground does not join them does the road take a bridge.
  const prev = new Int32Array(g.kind.length).fill(-2);
  prev[from] = -1;
  const queue = [from];
  for (let qh = 0; qh < queue.length && prev[to] === -2; qh++) {
    for (const j of neighbours(queue[qh] as number, g.w, g.h)) {
      if (prev[j] === -2 && ok(j)) { prev[j] = queue[qh] as number; queue.push(j); }
    }
  }
  let path: number[] | null = null;
  if (prev[to] !== -2) {
    path = [];
    for (let i = to; i !== -1; i = prev[i] as number) path.push(i);
    path.reverse();
  } else {
    path = routeWithBridges(state, [from], (i) => i === to, (j) => {
      if ((g.building[j] ?? 0) !== 0) return -1;
      if (ok(j)) return 1;
      return g.kind[j] === TileKind.River ? BRIDGE_STEP : -1;
    })?.path ?? null;
  }
  if (!path) return 0;
  let n = 0;
  for (const i of path) if ((g.building[i] ?? 0) === 0) { addFreeRoad(state, i); n++; }
  return n;
}

const WATERISH: ReadonlySet<number> = new Set([TileKind.Sea, TileKind.Reef, TileKind.Estuary, TileKind.River, TileKind.Wetland, TileKind.Beach, TileKind.Pit]);

/** True when no water, beach or pit lies within `r` tiles of tile i. */
function clearOfWater(state: GameState, i: number, r: number): boolean {
  const g = state.grid;
  const x = i % g.w, y = Math.floor(i / g.w);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && yy >= 0 && xx < g.w && yy < g.h && WATERISH.has(g.kind[yy * g.w + xx] ?? 0)) return false;
  }
  return true;
}

/**
 * Makes sure the state has entrance roads on the map edge: one for the stretch of land the town will grow on (a country
 * road runs in from it to where the town will grow), and one for each other big stretch a river or the sea cuts off from it. Mutates `state` (setup and load only). Does nothing if
 * an entrance is already recorded. Returns true if any were added.
 */
export function ensureEntrance(state: GameState): boolean {
  if (entranceIndex(state) !== null) return false;
  const g = state.grid;
  const site = townSite(state);
  // Tiles within 2 of the sea or a beach.
  const shore = new Uint8Array(g.kind.length);
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i];
    if (k !== TileKind.Sea && k !== TileKind.Beach && k !== TileKind.Reef) continue;
    const x = i % g.w, y = Math.floor(i / g.w);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < g.w && yy < g.h) shore[yy * g.w + xx] = 1;
    }
  }
  const plain = (i: number): boolean => roadTileOk(state, i) && (g.significant?.[i] ?? 0) === 0;
  const anywhere = (i: number): boolean => roadTileOk(state, i);
  const inland = (i: number): boolean => shore[i] === 0 && plain(i);
  let n = 0;
  for (const region of landRegions(state)) {
    const centroid = { x: 0, y: 0 };
    for (const i of region) { centroid.x += i % g.w; centroid.y += Math.floor(i / g.w); }
    centroid.x /= region.length; centroid.y /= region.length;
    const hint = n === 0 ? getScenario(state.scenarioId).entranceHint : undefined;
    const toward = n === 0 ? hint?.site ?? site : centroid;
    // First choice keeps the road away from the shore (street lights on the sand keep turtles off the beach); if no such
    // road can be laid, any open ground will do.
    let entrance: number | null = null;
    for (const ok of [inland, plain, anywhere]) {
      const i = entranceFor(state, region, toward, ok, hint?.edge) ?? (hint?.edge ? entranceFor(state, region, toward, ok) : null);
      if (i === null) continue;
      // The tile the road runs in to: open ground nearest where the town will grow, kept off the water's edge (a road that stops at
      // the water looks broken): never on a tile beside water if any other will do.
      let target = -1;
      // Tiles the road can reach from the entrance without crossing water.
      const dry = new Uint8Array(g.kind.length);
      { const q = [i]; dry[i] = 1; for (let qh = 0; qh < q.length; qh++) for (const j of neighbours(q[qh] as number, g.w, g.h)) if (dry[j] === 0 && ok(j)) { dry[j] = 1; q.push(j); } }
      for (let clear = ENTRANCE_CLEARANCE; clear >= 0; clear--) {
        let bestAny = Infinity, any = -1, bestDry = Infinity, dryT = -1;
        for (const t of region) {
          if (t === i || !ok(t) || (clear > 0 && !clearOfWater(state, t, clear))) continue;
          const d = Math.hypot((t % g.w) - toward.x, Math.floor(t / g.w) - toward.y);
          if (d < bestAny) { bestAny = d; any = t; }
          if (dry[t] === 1 && d < bestDry) { bestDry = d; dryT = t; }
        }
        // Stay on the entrance's own side of a creek unless the town site is clearly beyond it (then the road is bridged).
        target = dryT >= 0 && bestDry - bestAny <= BRIDGE_PREFERENCE ? dryT : any;
        if (target >= 0) break;
      }
      if (target < 0) { if (ok === anywhere) { addFreeRoad(state, i); entrance = i; } continue; }
      if (layApproach(state, i, target, ok) > 0) { entrance = i; break; }
      if (ok === anywhere) { addFreeRoad(state, i); entrance = i; }
    }
    if (entrance === null) continue;
    const i = entrance;
    state.flags[n === 0 ? ENTRANCE_FLAG : `${ENTRANCE_FLAG}.${n + 1}`] = i;
    n++;
  }
  return n > 0;
}

/** Puts a road building on a tile without charging for it (setup only). Mutates `state`. */
export function addFreeRoad(state: GameState, i: number, builtYear = state.year): PlacedBuilding {
  const g = state.grid;
  let uid = state.nextUid;
  const used = new Set(state.buildings.map((b) => b.uid));
  while (used.has(uid) || uid > 65535 || uid < 1) uid = uid > 65535 ? 1 : uid + 1;
  state.nextUid = uid + 1;
  const b: PlacedBuilding = { uid, type: 'road', x: i % g.w, y: Math.floor(i / g.w), rotation: 0, w: 1, h: 1, builtYear };
  state.buildings.push(b);
  g.building[i] = uid;
  g.health[i] = 0;
  g.stage[i] = 0;
  g.weed[i] = 0;
  if (g.kind[i] === TileKind.Bush) g.kind[i] = TileKind.Land;
  return b;
}

/**
 * Shortest set of new road tiles that would join building `uid` to the entrance's network, in the order to lay them
 * (starting beside the network). Existing roads cost nothing to cross. Empty array when it is already connected, or
 * null when no route exists (or the state does not enforce roads).
 */
export function roadRoute(state: GameState, uid: number, bridges = bridgesOn(state)): number[] | null {
  const acc = roadAccess(state);
  if (!acc.enforced || acc.entrances.length === 0) return null;
  const target = state.buildings.find((b) => b.uid === uid);
  if (!target) return null;
  if (!needsRoad(target.type) || acc.connected.has(uid)) return [];
  const g = state.grid;
  const n = g.w * g.h;
  // Tiles carrying a road-like network piece (any component): crossing them is free.
  const byUid = new Map(state.buildings.map((b) => [b.uid, b] as const));
  const roadLike = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const u = g.building[i] ?? 0;
    if (u !== 0 && BUILDINGS[byUid.get(u)?.type ?? 'cottage'].network === 'road') roadLike[i] = 1;
  }
  const adjacent = new Uint8Array(n);
  const mark = (xx: number, yy: number): void => {
    if (xx >= 0 && yy >= 0 && xx < g.w && yy < g.h) adjacent[yy * g.w + xx] = 1;
  };
  for (let k = 0; k < target.w; k++) { mark(target.x + k, target.y - 1); mark(target.x + k, target.y + target.h); }
  for (let k = 0; k < target.h; k++) { mark(target.x - 1, target.y + k); mark(target.x + target.w, target.y + k); }
  // Dijkstra from the reached network outward over bucketed costs: existing roads cost 0, open ground 1, bush BUSH_STEP.
  const sources: number[] = [];
  // Road-like tiles joined to the entrance; a rail siding only starts a route for a building that a siding can serve.
  const railOk = BUILDINGS[target.type].railServed === true;
  for (let i = 0; i < n; i++) { const r = acc.reached[i] ?? 0; if (r === 1 || (r === 2 && railOk)) sources.push(i); }
  // Over dry ground only (this alone decides the route unless a bridge is cheaper, so towns without a creek in the way are unchanged)...
  const dist = new Int32Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const settled = new Uint8Array(n);
  const buckets: number[][] = [[]];
  for (const i of sources) { dist[i] = 0; (buckets[0] as number[]).push(i); }
  let found = -1;
  for (let d = 0; d < buckets.length && found < 0; d++) {
    const cur = buckets[d] as number[];
    while (cur.length > 0 && found < 0) {
      const i = cur.pop() as number;
      if (settled[i] === 1 || dist[i] !== d) continue;
      settled[i] = 1;
      if (adjacent[i] === 1) { found = i; break; }
      for (const j of neighbours(i, g.w, g.h)) {
        if (settled[j] === 1) continue;
        const step = roadLike[j] === 1 ? 0 : roadTileCost(state, j);
        if (step === 0 && roadLike[j] !== 1) continue;
        const nd = d + step;
        if (dist[j] === -1 || nd < (dist[j] as number)) {
          dist[j] = nd;
          prev[j] = i;
          while (buckets.length <= nd) buckets.push([]);
          (buckets[nd] as number[]).push(j);
        }
      }
    }
  }
  const landCost = found >= 0 ? (dist[found] as number) : Infinity;
  // ...or with bridges over short stretches of creek, taken only when they make the road cheaper (or possible at all).
  const bridged = !bridges || landCost <= BRIDGE_STEP ? null : routeWithBridges(state, sources, (i) => adjacent[i] === 1, (j) => {
    if (roadLike[j] === 1) return 0;
    if ((g.building[j] ?? 0) !== 0) return -1;
    if (g.kind[j] === TileKind.River) return BRIDGE_STEP;
    const c = roadTileCost(state, j);
    return c > 0 ? c : -1;
  });
  if (bridged !== null && bridged.cost < landCost) return bridged.path.filter((i) => (g.building[i] ?? 0) === 0);
  if (found < 0) return null;
  const path: number[] = [];
  for (let i = found; i >= 0; i = prev[i] as number) if ((g.building[i] ?? 0) === 0) path.push(i);
  return path.reverse();
}

/**
 * Setup helper (mutates `state`, free): lays the road tiles that join every building to the entrance, nearest first.
 * Used for the prebuilt Net Zero City, which is built as a finished town.
 */
export function connectAllFree(state: GameState): void {
  for (let guard = 0; guard < 2000; guard++) {
    const acc = roadAccess(state);
    let progressed = false;
    for (const uid of acc.unconnected) {
      const route = roadRoute(state, uid, false); // the finished city's own roads keep to dry ground
      if (route === null || route.length === 0) continue;
      for (const i of route) addFreeRoad(state, i);
      progressed = true;
      break;
    }
    if (!progressed) return;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Commuting
// ---------------------------------------------------------------------------------------------------------

export interface CommuteStats {
  /** Mean road distance (tiles, capped) from a working home to the nearest working workplace, weighted by housing. */
  meanDist: number;
  /** Share by which light rail cuts it, 0..TRANSIT_MAX. */
  transitCut: number;
  /** kt CO2 per decade. */
  ktPerDecade: number;
}

/** Commuting from homes to jobs along the connected road network. Zero with no homes, jobs or entrance. */
export function commuteStats(state: GameState, population = state.population): CommuteStats {
  const none: CommuteStats = { meanDist: 0, transitCut: 0, ktPerDecade: 0 };
  const acc = roadAccess(state);
  if (!acc.enforced || population <= 0) return none;
  const g = state.grid;
  const n = g.w * g.h;
  const dist = new Int16Array(n).fill(-1);
  const queue = new Int32Array(n);
  let qt = 0;
  const around = (b: PlacedBuilding, visit: (i: number) => void): void => {
    const t = (xx: number, yy: number): void => {
      if (xx >= 0 && yy >= 0 && xx < g.w && yy < g.h && acc.reached[yy * g.w + xx] === 1) visit(yy * g.w + xx);
    };
    for (let k = 0; k < b.w; k++) { t(b.x + k, b.y - 1); t(b.x + k, b.y + b.h); }
    for (let k = 0; k < b.h; k++) { t(b.x - 1, b.y + k); t(b.x + b.w, b.y + k); }
    const reach = BUILDINGS[b.type].roadReach ?? 1;
    if (reach > 1) for (let yy = b.y - reach; yy < b.y + b.h + reach; yy++) for (let xx = b.x - reach; xx < b.x + b.w + reach; xx++) t(xx, yy);
  };
  let jobSites = 0;
  for (const b of acc.workingBuildings) {
    const d = BUILDINGS[b.type];
    if (d.jobs < 3 || d.housing > 0) continue;
    jobSites++;
    around(b, (i) => { if (dist[i] === -1) { dist[i] = 0; queue[qt++] = i; } });
  }
  if (jobSites === 0) return none;
  for (let qh = 0; qh < qt; qh++) {
    const i = queue[qh] as number;
    if ((dist[i] as number) >= COMMUTE_CAP) continue;
    for (const j of neighbours(i, g.w, g.h)) {
      if (acc.reached[j] === 1 && dist[j] === -1) { dist[j] = (dist[i] as number) + 1; queue[qt++] = j; }
    }
  }
  let sum = 0, weight = 0;
  for (const b of acc.workingBuildings) {
    const d = BUILDINGS[b.type];
    if (d.housing <= 0) continue;
    let best = COMMUTE_CAP;
    around(b, (i) => { const v = dist[i] ?? -1; if (v >= 0 && v + 1 < best) best = v + 1; });
    sum += best * d.housing;
    weight += d.housing;
  }
  if (weight <= 0) return none;
  const meanDist = sum / weight;
  let lines = 0;
  for (const b of acc.workingBuildings) if (b.type === 'transitline') lines++;
  const transitCut = Math.min(TRANSIT_MAX, lines * TRANSIT_CUT);
  return { meanDist, transitCut, ktPerDecade: population * meanDist * COMMUTE_KT * (1 - transitCut) };
}
