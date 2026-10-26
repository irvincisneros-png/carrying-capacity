/**
 * Zoning helpers for the scripted players. Homes, shops and light industry are zoned and grow by themselves from demand
 * (src/sim/zoning.ts), so a scripted player no longer places cottages or suburbs: it paints zones beside the roads it has and
 * lets the town grow into them, laying a short road spur when it runs out of zonable land.
 */
import { applyAction, BUILDINGS, economySnapshot, OFFGRID_POWER, REASON, roadAccess, TileKind, ZONE, ZONE_AIR_MAX, zoneBlockers, zoneProblem, ZONE_REACH, ZONE_SOIL_MAX } from '../../src/sim';
import type { GameState, PlacedBuilding, ZoneKind } from '../../src/sim';
import { wouldFlood } from '../../src/sim/mechanics/reefCore';
import { connectOutcome, roadDistance } from './roads';

export interface Rect { x: number; y: number; w: number; h: number }

/** Paints one zone over a rectangle (the same action the drag tool sends). Returns the new state, or the old one if nothing was zoned. */
export function zoneArea(state: GameState, rect: Rect, kind: ZoneKind): GameState {
  const r = applyAction(state, { type: 'zone', x: rect.x, y: rect.y, w: rect.w, h: rect.h, zone: kind });
  return r.result.ok ? r.state : state;
}

const family = (k: number): number => (k >= 1 && k <= 3 ? 1 : k);

/** Zoned tiles of this family with nothing grown on them yet. */
export function emptyZoned(s: GameState, kind: ZoneKind): number {
  const g = s.grid;
  let n = 0;
  for (let i = 0; i < g.zoning.length; i++) if (family(g.zoning[i] ?? 0) === family(kind) && (g.building[i] ?? 0) === 0) n++;
  return n;
}

/** Tiles zoned in this family (grown or not). */
export function zonedTiles(s: GameState, kind: ZoneKind): number {
  let n = 0;
  for (const z of s.grid.zoning) if (family(z) === family(kind)) n++;
  return n;
}

export const grownOf = (s: GameState, kind?: ZoneKind): number =>
  s.buildings.filter((b) => b.grown && (kind === undefined || family(zoneOfType(b.type)) === family(kind))).length;

function zoneOfType(t: string): number {
  return t === 'zres1' ? 1 : t === 'zres2' ? 2 : t === 'zres3' ? 3 : t === 'zcom' ? 4 : t === 'zind' ? 5 : 0;
}

export interface ZoneOpts {
  /** Score a candidate tile (higher is better). Default: nearest the hub. */
  score?: (x: number, y: number) => number;
  /** Bush tiles are skipped unless this is set (a careful player zones cleared land first). */
  bush?: boolean;
  /** A careful player skips tiles for a reason of its own (the reef player keeps homes off ground a surge would flood). */
  tileOk?: (s: GameState, x: number, y: number) => boolean;
  /** Keep this many tiles away from tiles already zoned for another family (industry sits apart from homes). */
  apart?: number;
}

/**
 * Keeps at least `want` empty tiles zoned for `kind`, zoning the best free tiles within reach of a connected road (one action per
 * run of tiles in a row, as a player dragging along a street would). Returns the new state.
 */
export function keepZoned(state: GameState, kind: ZoneKind, want: number, opts: ZoneOpts = {}): GameState {
  let s = state;
  const short = want - emptyZoned(s, kind);
  if (short <= 0) return s;
  const g = s.grid;
  const acc = roadAccess(s);
  const road = roadDistance(s);
  const score = opts.score ?? (() => 0);
  const cands: { i: number; sc: number }[] = [];
  const otherFam = new Uint8Array(g.w * g.h);
  if (opts.apart) {
    for (let i = 0; i < g.zoning.length; i++) {
      const z = g.zoning[i] ?? 0;
      if (z === 0 || family(z) === family(kind)) continue;
      const x = i % g.w, y = Math.floor(i / g.w);
      for (let dy = -opts.apart; dy <= opts.apart; dy++) for (let dx = -opts.apart; dx <= opts.apart; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < g.w && yy < g.h) otherFam[yy * g.w + xx] = 1;
      }
    }
  }
  for (let i = 0; i < g.kind.length; i++) {
    if ((g.zoning[i] ?? 0) !== 0 || (g.building[i] ?? 0) !== 0) continue;
    if (!opts.bush && g.kind[i] === TileKind.Bush) continue;
    if (otherFam[i] === 1) continue;
    // A player reads the hatching: no point zoning homes or shops where the air or soil is too bad for anything to grow.
    if (family(kind) !== 5 && (g.airPollution[i] ?? 0) > ZONE_AIR_MAX * 0.7) continue;
    if ((g.soilContamination[i] ?? 0) > ZONE_SOIL_MAX * 0.8) continue;
    // Within reach of a road that is joined to the entrance (the tile can grow, not just be zoned).
    if (acc.enforced && road && (road[i] ?? 99) > ZONE_REACH) continue;
    const x = i % g.w, y = Math.floor(i / g.w);
    if (zoneProblem(s, x, y, kind) !== null) continue;
    if (opts.tileOk && !opts.tileOk(s, x, y)) continue;
    cands.push({ i, sc: score(x, y) });
  }
  cands.sort((a, b) => b.sc - a.sc || a.i - b.i);
  let need = short;
  for (const c of cands) {
    if (need <= 0) break;
    if ((s.grid.zoning[c.i] ?? 0) !== 0) continue;
    const x = c.i % g.w, y = Math.floor(c.i / g.w);
    // Extend along the row while the next tiles are also good candidates (one drag paints them all).
    let w = 1;
    while (w < need && x + w < g.w && zoneProblem(s, x + w, y, kind) === null && (!opts.tileOk || opts.tileOk(s, x + w, y)) && (s.grid.zoning[c.i + w] ?? 0) === 0
      && (opts.bush || g.kind[c.i + w] !== TileKind.Bush) && otherFam[c.i + w] !== 1 && (!road || (road[c.i + w] ?? 99) <= ZONE_REACH)) w++;
    const before = emptyZoned(s, kind);
    const next = zoneArea(s, { x, y, w, h: 1 }, kind);
    if (next === s) continue;
    s = next;
    need -= emptyZoned(s, kind) - before;
  }
  return s;
}

/** Population the town's homes hold right now (grown and placed). */
export const housingOf = (s: GameState): number => s.buildings.reduce((a, b) => a + BUILDINGS[b.type].housing, 0);

/** People the zoned-but-empty home tiles will house once they grow (a scripted player counts them as homes on the way). */
export function pendingHousing(s: GameState): number {
  const g = s.grid;
  let n = 0;
  for (let i = 0; i < g.zoning.length; i++) {
    const z = g.zoning[i] ?? 0;
    if (z >= 1 && z <= 3 && (g.building[i] ?? 0) === 0) n += z === 3 ? BUILDINGS.zres3.housing * 0.5 : BUILDINGS[z === 1 ? 'zres1' : 'zres2'].housing;
  }
  return n;
}

/** The density a scripted player zones: big blocks until medium density opens in 1950, then townhouses; a compact player goes to flats from 1970. */
export const homeKind = (s: GameState, compact = false): ZoneKind => (compact && s.year >= 1970 ? ZONE.rhigh : s.year >= 1950 ? ZONE.rmed : ZONE.rlow) as ZoneKind;

/** What a scripted player's home zoning can be told. */
export type HomeOpts = Pick<ZoneOpts, 'tileOk'> & {
  /** Also zone shops and offices as the town grows (they give jobs, and the jobs give homes a reason to grow). */
  shops?: boolean;
  /** Zone flats (high density) from 1970 instead of townhouses: the most people on the least land. */
  compact?: boolean;
};

/**
 * Zones enough homes (beside the roads, nearest the hub first) to house `wantPeople`, counting homes already grown and the zoned
 * tiles still waiting to grow. When there is no zonable land left within reach of the roads it lays a short spur of road (paid for
 * like any road) onto open land near the hub and zones along it. Returns the same state when nothing more can be done.
 */
export function zoneHomesFor(state: GameState, wantPeople: number, hub: { x: number; y: number }, homes: HomeOpts = {}): GameState {
  let s = state;
  const kind = homeKind(s, homes.compact === true);
  // Flats fill only half way without a rail line nearby (sim/zonefill.ts), so a player counts 60 people a tile, not 120.
  const per = kind === ZONE.rhigh ? BUILDINGS.zres3.housing * 0.5 : BUILDINGS[kind === ZONE.rmed ? 'zres2' : 'zres1'].housing;
  const need = wantPeople - housingOf(s) - pendingHousing(s);
  if (need <= 0) return s;
  const want = emptyZoned(s, ZONE.rlow) + Math.ceil(need / per);
  const score = (x: number, y: number): number => -Math.hypot(x - hub.x, y - hub.y);
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = emptyZoned(s, ZONE.rlow);
    s = keepZoned(s, kind, want, { score, ...(homes.tileOk ? { tileOk: homes.tileOk } : {}) });
    const now = emptyZoned(s, ZONE.rlow);
    if (now >= want || (now === before && attempt > 0)) break;
    const spur = layHomeSpur(s, hub, homes);
    if (spur === s) break;
    s = spur;
  }
  return s;
}

/** Keeps enough shop and office tiles zoned for the jobs the town's people want (a tenth of the population), nearest the hub. */
export function zoneShopsFor(state: GameState, hub: { x: number; y: number }, homes: HomeOpts = {}): GameState {
  const want = Math.ceil((0.1 * Math.max(state.population, 20)) / BUILDINGS.zcom.jobs) + 1;
  const have = state.buildings.filter((b) => b.type === 'zcom').length + emptyZoned(state, ZONE.com);
  if (have >= want) return state;
  return keepZoned(state, ZONE.com, emptyZoned(state, ZONE.com) + (want - have), { score: (x, y) => -Math.hypot(x - hub.x, y - hub.y), ...(homes.tileOk ? { tileOk: homes.tileOk } : {}) });
}

/** A short road onto open land near the hub (joined to the entrance), so there is somewhere to zone. */
function layHomeSpur(s: GameState, hub: { x: number; y: number }, homes: Pick<ZoneOpts, 'tileOk'>): GameState {
  const g = s.grid;
  const cands: { i: number; d: number }[] = [];
  for (let y = 2; y < g.h - 2; y++) {
    for (let x = 2; x < g.w - 2; x++) {
      const i = y * g.w + x;
      if ((g.building[i] ?? 0) !== 0 || (g.zoning[i] ?? 0) !== 0) continue;
      if (g.kind[i] !== TileKind.Land && g.kind[i] !== TileKind.Bush) continue;
      if (homes.tileOk && !homes.tileOk(s, x, y)) continue;
      // Open ground around it: enough zonable tiles within reach to be worth a road.
      let free = 0;
      for (let dy = -ZONE_REACH; dy <= ZONE_REACH; dy++) {
        for (let dx = -ZONE_REACH; dx <= ZONE_REACH; dx++) {
          const j = (y + dy) * g.w + x + dx;
          if ((g.building[j] ?? 0) === 0 && (g.zoning[j] ?? 0) === 0 && (g.kind[j] === TileKind.Land || g.kind[j] === TileKind.Bush) && (g.significant[j] ?? 0) === 0) free++;
        }
      }
      if (free < 14) continue;
      cands.push({ i, d: Math.hypot(x - hub.x, y - hub.y) });
    }
  }
  cands.sort((a, b) => a.d - b.d || a.i - b.i);
  for (const c of cands.slice(0, 12)) {
    const r = applyAction(s, { type: 'place', building: 'road', x: c.i % g.w, y: Math.floor(c.i / g.w) });
    if (!r.result.ok) continue;
    const joined = connectOutcome(r.state, r.result.uid);
    if (joined.state) return joined.state;
  }
  return s;
}

/** Would a home on this tile be flooded by a surge of `surgeM` metres (Reef Island's mechanic)? */
export function homeFloods(s: GameState, x: number, y: number, surgeM: number): boolean {
  const b: PlacedBuilding = { uid: 0, type: 'zres1', x, y, w: 1, h: 1, rotation: 0, builtYear: s.year };
  return wouldFlood(s, b, surgeM);
}

/**
 * Is the town short of power? Zoned homes and shops wait for power (and empty out after three years without it) once the town draws
 * more than its stations supply plus the few units small generators give. A scripted player reads the same signs a student does:
 * "Waiting for power" on the zone overlay, boarded-up homes, and the Town needs line.
 */
export function waitingForPower(s: GameState): boolean {
  const snap = economySnapshot(s);
  if (!snap.gridActive || snap.powerDemand <= snap.powerSupply + OFFGRID_POWER) return false;
  return s.buildings.some((b) => b.grown) || zoneBlockers(s).some((b) => b.code === REASON.noPower) || s.grid.zoning.some((z) => z !== 0);
}
