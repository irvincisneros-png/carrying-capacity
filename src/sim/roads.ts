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
import { cityCentre } from './prebuilt';
import { getScenario } from './scenarios';
import { TileKind } from './types';
import type { BuildingId, GameState, PlacedBuilding } from './types';

/**
 * flags keys holding the tile index (y * w + x) of an entrance road: `road.entrance` for the main one, `road.entrance.2`,
 * `.3`... for any other stretch of buildable land that a river or the sea cuts off from it (there are no bridges).
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
export const COMMUTE_KT = 0.0012;
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
  const care = (g.significant?.[i] ?? 0) > 0 ? SIGNIFICANT_STEP : 0;
  if (k === TileKind.Land) {
    if (state.phase === 'act2') {
      const z = g.zone?.[i] ?? 0;
      if (z > 0 && z < 250 && (getScenario(state.scenarioId).mechanics ?? []).includes('outback')) return 0;
    }
    return 1 + care;
  }
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
 * Stretches of buildable land (Land and Bush, ignoring buildings) that are big enough to build a town on, found by flood
 * fill. The one nearest the town site comes first.
 */
function landRegions(state: GameState): number[][] {
  const g = state.grid;
  const seen = new Uint8Array(g.kind.length);
  const regions: number[][] = [];
  const site = townSite(state);
  for (let s0 = 0; s0 < g.kind.length; s0++) {
    const k0 = g.kind[s0];
    if (seen[s0] === 1 || (k0 !== TileKind.Land && k0 !== TileKind.Bush)) continue;
    const tiles = [s0];
    seen[s0] = 1;
    for (let qh = 0; qh < tiles.length; qh++) {
      for (const j of neighbours(tiles[qh] as number, g.w, g.h)) {
        const k = g.kind[j];
        if (seen[j] === 0 && (k === TileKind.Land || k === TileKind.Bush)) { seen[j] = 1; tiles.push(j); }
      }
    }
    if (tiles.length >= MIN_REGION_TILES) regions.push(tiles);
  }
  const nearest = (r: number[]): number => Math.min(...r.map((i) => Math.hypot((i % g.w) - site.x, Math.floor(i / g.w) - site.y)));
  return regions.sort((a, b) => nearest(a) - nearest(b));
}

/**
 * The tile for a region's entrance: a free tile on the map edge if it has one (otherwise the free tile nearest the edge),
 * nearest to `toward` first.
 */
function entranceFor(state: GameState, region: number[], toward: { x: number; y: number }, ok: (i: number) => boolean): number | null {
  const g = state.grid;
  let best: number | null = null, bestKey = Infinity;
  for (const i of region) {
    if (!ok(i)) continue;
    const x = i % g.w, y = Math.floor(i / g.w);
    const edge = Math.min(x, y, g.w - 1 - x, g.h - 1 - y);
    const key = edge * 1000 + Math.hypot(x - toward.x, y - toward.y);
    if (key < bestKey) { bestKey = key; best = i; }
  }
  return best;
}

/**
 * Lays free road tiles along the shortest open-ground path from tile `from` to tile `to` (both included). Setup only.
 * Returns the number of tiles laid (0 if there is no path).
 */
function layApproach(state: GameState, from: number, to: number, ok: (i: number) => boolean): number {
  const g = state.grid;
  const prev = new Int32Array(g.kind.length).fill(-2);
  prev[from] = -1;
  const queue = [from];
  for (let qh = 0; qh < queue.length && prev[to] === -2; qh++) {
    for (const j of neighbours(queue[qh] as number, g.w, g.h)) {
      if (prev[j] === -2 && ok(j)) { prev[j] = queue[qh] as number; queue.push(j); }
    }
  }
  if (prev[to] === -2) return 0;
  const path: number[] = [];
  for (let i = to; i !== -1; i = prev[i] as number) path.push(i);
  let n = 0;
  for (const i of path.reverse()) if ((g.building[i] ?? 0) === 0) { addFreeRoad(state, i); n++; }
  return n;
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
    const toward = n === 0 ? site : centroid;
    // First choice keeps the road away from the shore (street lights on the sand keep turtles off the beach); if no such
    // road can be laid, any open ground will do.
    let entrance: number | null = null;
    for (const ok of [inland, plain, anywhere]) {
      const i = entranceFor(state, region, toward, ok);
      if (i === null) continue;
      // The tile the road runs in to: open ground nearest where the town will grow.
      let target = -1, bestD = Infinity;
      for (const t of region) {
        if (t === i || !ok(t)) continue;
        const d = Math.hypot((t % g.w) - toward.x, Math.floor(t / g.w) - toward.y);
        if (d < bestD) { bestD = d; target = t; }
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
export function roadRoute(state: GameState, uid: number): number[] | null {
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
  const dist = new Int32Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const settled = new Uint8Array(n);
  const buckets: number[][] = [[]];
  for (let i = 0; i < n; i++) if ((acc.reached[i] ?? 0) !== 0) { dist[i] = 0; (buckets[0] as number[]).push(i); }
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
      const route = roadRoute(state, uid);
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
