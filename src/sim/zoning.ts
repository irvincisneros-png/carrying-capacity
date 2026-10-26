/**
 * Zoning (Cities: Skylines-style, hybrid). Homes, shops and offices, and light industry are zoned: the player paints a zone on
 * open land near a road and, once a year, the town grows into it by itself from demand. Big environmental decisions (farms, mines,
 * factories, power, restoration) stay as placed buildings.
 *
 * A grown building is an ordinary 1x1 PlacedBuilding of type zres1 / zres2 / zres3 / zcom / zind with `grown: true`, so the economy,
 * the grid, pollution, road access, commuting and the ledger treat it like any other building. Everything here is pure and
 * deterministic: growth order is fixed by the map, ties are broken by seasonRng(seed, year, salt), never Math.random.
 *
 * The density lesson: low-density homes need the most land per person, so a sprawling town clears more bush, needs longer streets
 * (which split habitat) and drives further to work. Compact zoning saves land but needs transit, power and, in a hot city, parks.
 */
import { BUILDINGS } from './buildings';
import { economySnapshot, computeMeters, GRID_YEAR } from './economy';
import { dilate } from './grid';
import { mechMetric } from './mechanics';
import { bumpRect } from './restoration';
import { noteAction } from './residents';
import { roadAccess, townFocus } from './roads';
import { CLEAR_KT_PER_TILE, isPlayable } from './rules';
import { getScenario } from './scenarios';
import { seasonRng } from './season';
import { cloneState } from './state';
import { latchTutorial } from './tutorial';
import { fillFn } from './zonefill';
import { TileKind } from './types';
import type { ActionFailCode, ActionResult, BuildingId, GameState, PlacedBuilding } from './types';

export const ZONE = { none: 0, rlow: 1, rmed: 2, rhigh: 3, com: 4, ind: 5 } as const;
export type ZoneKind = (typeof ZONE)[keyof typeof ZONE];
export type ZoneFamily = 'res' | 'com' | 'ind';

/** The building that grows on each zone. */
export const ZONE_BUILDING: Readonly<Record<1 | 2 | 3 | 4 | 5, BuildingId>> = { 1: 'zres1', 2: 'zres2', 3: 'zres3', 4: 'zcom', 5: 'zind' };
export const ZONE_NAME: Readonly<Record<ZoneKind, string>> = {
  0: 'No zone', 1: 'Homes (low density)', 2: 'Homes (medium density)', 3: 'Homes (high density)', 4: 'Shops and offices', 5: 'Light industry',
};
/** First year each zone can be painted (the era decides how dense homes can be). */
export const ZONE_UNLOCK: Readonly<Record<ZoneKind, number>> = { 0: 0, 1: 1850, 2: 1950, 3: 1970, 4: 1850, 5: 1850 };

/** Money ($k) to zone one tile, before the scenario's budget multiplier. Dezoning is free. */
export const ZONE_COST = 0.3;
/** Money ($k) per grown tile to raise its density (the new building replaces the old at the next growth tick). */
export const DENSITY_UPGRADE_COST = 2;
/** A zone must be within this many tiles (Chebyshev) of a road tile. Grown buildings count a connected road this close as access. */
export const ZONE_REACH = 2;
/** Soil contaminated above this cannot be zoned, and stops growth. */
export const ZONE_SOIL_MAX = 0.6;
/** Air pollution above this stops homes and shops growing (light industry does not mind). */
export const ZONE_AIR_MAX = 2;
/** Residential demand: jobs minus the homes there are, plus this many people (a town always attracts a few). */
export const RES_BASE = 20;
/** Shop and office jobs the town wants per resident. */
export const COM_SHARE = 0.1;
/** Light-industry jobs wanted per job in the export industries (factories, mines, the port, steel). */
export const IND_SHARE = 0.2;
export const EXPORT_TYPES: readonly BuildingId[] = ['factory', 'steelworks', 'port', 'coalmine', 'greensteel', 'windport', 'recycler'];
/**
 * Power units a town can use before it needs a power station (small generators and wood stoves). After the grid year, growth waits
 * for power once the town draws more than its supply plus this.
 */
export const OFFGRID_POWER = 8;
/** A grown building with no road, or with this share of the town's power missing, for this many years in a row empties. */
export const DECLINE_YEARS = 3;
export const DECLINE_POWER_SHORT = 0.25;
/** Act 2: growth waits while more than this share of power went unmet last year; buildings decline above the second. */
export const ACT2_GROW_UNMET = 0.02;
export const ACT2_DECLINE_UNMET = 0.15;
/** Red Dirt: new homes wait for water while the aquifer is below this. */
export const AQUIFER_MIN = 40;

/** Why a zoned tile is not growing (zoneReasons). */
export const REASON = { none: 0, noRoad: 1, noPower: 2, noDemand: 3, noWater: 4, polluted: 5, ready: 6, empty: 7, protected: 8 } as const;
export type ReasonCode = (typeof REASON)[keyof typeof REASON];
export const ZONE_REASON_TEXT: readonly string[] = [
  '',
  'No road reaches here: build a road within 2 tiles that joins the road in',
  'Waiting for power: build more power',
  'No one needs more yet',
  'Waiting for water: the underground water is too low',
  'Too polluted for people to live or work here',
  'Ready to grow when it is needed',
  'Empty: no power or road for 3 years',
  'Bushland is protected now: nothing will grow on this zoned bush',
];

/** Plain words for one tile's reason, for the zone it holds ("No one needs more shops yet"). */
export function reasonText(code: number, zone: number): string {
  if (code === REASON.noDemand) {
    const f = familyOf(zone);
    return f === 'res' ? 'No one needs more homes yet: homes grow when there are jobs to fill'
      : f === 'com' ? 'No one needs more shops yet: shops grow as more people move in'
        : 'No one needs more workshops yet: they grow to serve factories, mines and the port';
  }
  return ZONE_REASON_TEXT[code] ?? '';
}

export function familyOf(zone: number): ZoneFamily | null {
  return zone >= 1 && zone <= 3 ? 'res' : zone === 4 ? 'com' : zone === 5 ? 'ind' : null;
}

/** The zone a grown building type belongs to (0 for anything else). */
export function zoneOfType(type: BuildingId): ZoneKind {
  switch (type) {
    case 'zres1': return 1;
    case 'zres2': return 2;
    case 'zres3': return 3;
    case 'zcom': return 4;
    case 'zind': return 5;
    default: return 0;
  }
}

/** Only dry land and bush can hold a zone: never water, river, estuary, wetland, beach, rock or pit. */
export const zonableKind = (k: number): boolean => k === TileKind.Land || k === TileKind.Bush;

const budgetMult = (s: GameState): number => getScenario(s.scenarioId).modifiers.budgetMult;
/** Money ($k) to zone one tile in this scenario. */
export const zoneTileCost = (s: GameState): number => ZONE_COST * budgetMult(s);

// ---------------------------------------------------------------------------------------------------------
// Where you can zone
// ---------------------------------------------------------------------------------------------------------

interface MaskCache { version: number; len: number; mask: Uint8Array }
const NEAR_ROAD = new WeakMap<readonly PlacedBuilding[], MaskCache>();

/** Tiles within ZONE_REACH (Chebyshev) of any road tile, joined or not. Cached by version. */
function nearRoadMask(state: GameState): Uint8Array {
  const hit = NEAR_ROAD.get(state.buildings);
  if (hit && hit.version === state.version && hit.len === state.buildings.length) return hit.mask;
  const g = state.grid;
  const roads = new Uint8Array(g.w * g.h);
  for (const b of state.buildings) {
    if (BUILDINGS[b.type].network !== 'road') continue;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) roads[y * g.w + x] = 1;
  }
  const mask = dilate(roads, g.w, g.h, ZONE_REACH);
  NEAR_ROAD.set(state.buildings, { version: state.version, len: state.buildings.length, mask });
  return mask;
}

function onMineSite(state: GameState, i: number): boolean {
  const z = state.grid.zone[i] ?? 0;
  return z > 0 && z < 250 && (getScenario(state.scenarioId).mechanics ?? []).includes('outback');
}

/**
 * Why tile (x, y) cannot take this zone, or null if it can. Zone 0 (dezone) is fine wherever something is zoned. A grown home can
 * be given another home density (the building is swapped at the next growth tick); anything else built on the tile blocks it.
 */
export function zoneProblem(state: GameState, x: number, y: number, zone: number): string | null {
  const g = state.grid;
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return 'That is off the map';
  const i = y * g.w + x;
  if (zone === 0) return (g.zoning[i] ?? 0) !== 0 ? null : 'Nothing is zoned here';
  if (!Number.isInteger(zone) || zone < 1 || zone > 5) return 'Unknown zone';
  if (!isPlayable(state)) return 'This act is finished';
  const unlock = ZONE_UNLOCK[zone as ZoneKind];
  if (state.year < unlock) return `${ZONE_NAME[zone as ZoneKind]} can be zoned from ${unlock}`;
  const u = g.building[i] ?? 0;
  if (u !== 0) {
    const b = state.buildings.find((o) => o.uid === u);
    if (b?.grown) {
      if (zoneOfType(b.type) === zone) return null;
      if (familyOf(zoneOfType(b.type)) === 'res' && familyOf(zone) === 'res') return null;
      return 'Something has grown here: dezone it first to change what grows';
    }
    return BUILDINGS[b?.type ?? 'road'].network === 'road' ? 'Roads can\'t be zoned: zone the land beside them' : 'Something is already built here';
  }
  const k = g.kind[i];
  if (k === TileKind.Bush) {
    if (state.phase === 'act2') return 'This bushland is protected now: zone cleared land instead';
  } else if (k !== TileKind.Land) {
    switch (k) {
      case TileKind.Rock: return 'Zones can\'t go on the rocky escarpment';
      case TileKind.Beach: return 'Zones can\'t go on the beach';
      case TileKind.Pit: return 'Zones can\'t go in the mine pit';
      default: return 'Zones can\'t go on water or wetland';
    }
  }
  if ((g.significant[i] ?? 0) > 0) return 'A place that matters to the local community: zones can\'t go here';
  if (onMineSite(state, i)) return 'This is mine-site ground being rehabilitated: zone beside it instead';
  if ((g.soilContamination[i] ?? 0) > ZONE_SOIL_MAX) return 'The soil here is too contaminated: clean it up before anyone lives or works here';
  if (nearRoadMask(state)[i] !== 1) return `Zones must be within ${ZONE_REACH} tiles of a road`;
  return null;
}

/** What a zone action over a rectangle would do: the tiles it changes, what it costs and what grown buildings it removes. */
export interface ZonePlan {
  ok: boolean;
  code?: ActionFailCode;
  reason?: string;
  /** Tiles that change. */
  tiles: number[];
  cost: number;
  /** Grown buildings that would be demolished (dezoning). */
  demolish: number;
  /** Tiles in the rectangle that could not take the zone. */
  skipped: number;
}

const MAX_RECT = 64;

export function zonePlan(state: GameState, x: number, y: number, w: number, h: number, zone: number): ZonePlan {
  const g = state.grid;
  const fail = (code: ActionFailCode, reason: string, skipped = 0): ZonePlan => ({ ok: false, code, reason, tiles: [], cost: 0, demolish: 0, skipped });
  if (!isPlayable(state)) return fail('game-over', 'This act is finished');
  if (![x, y, w, h].every(Number.isInteger) || w < 1 || h < 1 || w > MAX_RECT || h > MAX_RECT) return fail('invalid', 'Pick a rectangle on the map');
  if (!Number.isInteger(zone) || zone < 0 || zone > 5) return fail('invalid', 'Unknown zone');
  const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(g.w - 1, x + w - 1), y1 = Math.min(g.h - 1, y + h - 1);
  if (x0 > x1 || y0 > y1) return fail('out-of-bounds', 'That is off the map');
  const tiles: number[] = [];
  let cost = 0, demolish = 0, skipped = 0;
  let first: string | null = null;
  const per = zoneTileCost(state);
  const up = DENSITY_UPGRADE_COST * budgetMult(state);
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const i = yy * g.w + xx;
      const cur = g.zoning[i] ?? 0;
      const why = zoneProblem(state, xx, yy, zone);
      if (why) {
        // Dezoning skips quietly over tiles with nothing zoned.
        if (zone !== 0) { skipped++; first ??= why; }
        continue;
      }
      if (cur === zone) continue;
      const u = g.building[i] ?? 0;
      if (zone === 0) {
        if (u !== 0) demolish++;
      } else if (u !== 0) {
        const b = state.buildings.find((o) => o.uid === u);
        const was = b ? zoneOfType(b.type) : cur;
        if (zone > was) cost += up;
      } else cost += per;
      tiles.push(i);
    }
  }
  if (tiles.length === 0) {
    if (zone === 0) return fail('nothing-here', 'Nothing is zoned here');
    return first ? fail(first.includes('from 1') ? 'locked' : 'bad-siting', first, skipped) : fail('already-done', 'That is already zoned', skipped);
  }
  cost = Math.round(cost * 100) / 100;
  if (state.budget < cost) return fail('no-funds', `Not enough money: zoning this costs ${cost.toFixed(1)}`, skipped);
  return { ok: true, tiles, cost, demolish, skipped };
}

/** Paint (or remove) a zone over a rectangle. Dezoning a grown tile demolishes its building, with no refund. */
export function applyZone(state: GameState, x: number, y: number, w: number, h: number, zone: number): { state: GameState; result: ActionResult } {
  const plan = zonePlan(state, x, y, w, h, zone);
  if (!plan.ok) return { state, result: { ok: false, code: plan.code, reason: plan.reason } };
  const next = cloneState(state);
  const g = next.grid;
  const gone = new Set<number>();
  for (const i of plan.tiles) {
    if (zone === 0) {
      const u = g.building[i] ?? 0;
      if (u !== 0) {
        gone.add(u);
        g.building[i] = 0;
        bumpRect(g, i % g.w, Math.floor(i / g.w), 1, 1);
      }
    }
    g.zoning[i] = zone;
  }
  if (gone.size) next.buildings = next.buildings.filter((b) => !gone.has(b.uid));
  next.budget -= plan.cost;
  noteAction(next, zone === 0 ? 'dezoned' : `zoned.${familyOf(zone)}`);
  latchTutorial(next);
  next.meters = computeMeters(next);
  next.version = state.version + 1;
  return { state: next, result: { ok: true, spent: plan.cost, count: plan.tiles.length } };
}

// ---------------------------------------------------------------------------------------------------------
// Retrofitting homes (Act 2)
// ---------------------------------------------------------------------------------------------------------

/** Money ($k) per person housed to retrofit a home (the old Retrofitted homes building: $28k for 120 people). */
export const RETROFIT_COST_PER_PERSON = 28 / 120;
const RETROFIT_TYPES: ReadonlySet<BuildingId> = new Set<BuildingId>(['zres1', 'zres2', 'zres3', 'cottage', 'suburb']);

/** Homes in a rectangle that a retrofit would change, and what it costs. */
export function retrofitPlan(state: GameState, x: number, y: number, w: number, h: number): { ok: boolean; code?: ActionFailCode; reason?: string; uids: number[]; cost: number } {
  const fail = (code: ActionFailCode, reason: string) => ({ ok: false, code, reason, uids: [], cost: 0 });
  if (state.phase !== 'act2') return fail('locked', 'Retrofitting homes starts with the transition (Act 2)');
  if (![x, y, w, h].every(Number.isInteger) || w < 1 || h < 1 || w > MAX_RECT || h > MAX_RECT) return fail('invalid', 'Pick a rectangle on the map');
  const uids: number[] = [];
  let cost = 0;
  for (const b of state.buildings) {
    if (!RETROFIT_TYPES.has(b.type) || b.upgrades?.includes('retrofit')) continue;
    if (b.x + b.w <= x || b.x >= x + w || b.y + b.h <= y || b.y >= y + h) continue;
    uids.push(b.uid);
    cost += BUILDINGS[b.type].housing * RETROFIT_COST_PER_PERSON;
  }
  if (uids.length === 0) return fail('nothing-here', 'No homes here to retrofit (they may be done already)');
  cost = Math.round(cost * 10) / 10;
  if (state.budget < cost) return fail('no-funds', `Not enough money: retrofitting these homes costs ${cost.toFixed(1)}`);
  return { ok: true, uids, cost };
}

/**
 * Retrofit the homes in a rectangle: insulation, heat pumps, rooftop panels and cool roofs (half the electricity, a quarter of
 * the CO2). Grown homes and old cottages get the retrofit upgrade; an old brick suburb becomes Retrofitted homes as before.
 */
export function applyRetrofit(state: GameState, x: number, y: number, w: number, h: number): { state: GameState; result: ActionResult } {
  const plan = retrofitPlan(state, x, y, w, h);
  if (!plan.ok) return { state, result: { ok: false, code: plan.code, reason: plan.reason } };
  const next = cloneState(state);
  const set = new Set(plan.uids);
  next.buildings = next.buildings.map((b) => {
    if (!set.has(b.uid)) return b;
    if (b.type === 'suburb') return { ...b, type: 'greensuburb' as BuildingId, builtYear: state.year };
    return { ...b, upgrades: [...(b.upgrades ?? []), 'retrofit'] };
  });
  next.budget -= plan.cost;
  noteAction(next, 'retrofitted');
  for (const u of plan.uids) {
    const b = state.buildings.find((o) => o.uid === u);
    if (b) noteAction(next, `built.${b.type === 'suburb' ? 'greensuburb' : 'retrofit'}`);
  }
  latchTutorial(next);
  next.meters = computeMeters(next);
  next.version = state.version + 1;
  return { state: next, result: { ok: true, spent: plan.cost, count: plan.uids.length } };
}

// ---------------------------------------------------------------------------------------------------------
// Demand and growth
// ---------------------------------------------------------------------------------------------------------

export interface ZoneDemand {
  /** People who want a home (jobs minus homes plus a small base). */
  res: number;
  /** Shop and office jobs wanted. */
  com: number;
  /** Light-industry jobs wanted. */
  ind: number;
}

/** What the town wants zoned: positive means more of it would grow. */
export function zoneDemand(state: GameState): ZoneDemand {
  const snap = economySnapshot(state);
  const fill = fillFn(state);
  let com = 0, ind = 0, exp = 0;
  for (const b of roadAccess(state).workingBuildings) {
    if (b.type === 'zcom') com += BUILDINGS.zcom.jobs * fill(b);
    else if (b.type === 'zind') ind += BUILDINGS.zind.jobs * fill(b);
    else if (EXPORT_TYPES.includes(b.type)) exp += BUILDINGS[b.type].jobs;
  }
  return {
    res: Math.round(snap.jobs + RES_BASE - snap.housing),
    com: Math.round(COM_SHARE * state.population - com),
    ind: Math.round(IND_SHARE * exp - ind),
  };
}

/** Tiles a zone type may grow in one year: about 8 on a 64x64 map early on, more as the town grows. */
export function growthCap(state: GameState, grown: number): number {
  const g = state.grid;
  return Math.max(2, Math.round(8 * Math.sqrt((g.w * g.h) / 4096))) + Math.floor(grown / 12);
}

/** Power the town can still give new buildings (Infinity when power does not limit growth yet). */
function sparePower(state: GameState): number {
  if (state.phase === 'act2' || state.phase === 'epilogue' || state.phase === 'failed') {
    return state.a2.lastUnmetFrac > ACT2_GROW_UNMET ? -1 : Infinity;
  }
  const snap = economySnapshot(state);
  if (!snap.gridActive) return Infinity;
  return snap.powerSupply + OFFGRID_POWER - snap.powerDemand;
}

/** Is power short enough that grown buildings start to decline? */
function powerSevere(state: GameState): boolean {
  if (state.phase === 'act2' || state.phase === 'epilogue' || state.phase === 'failed') return state.a2.lastUnmetFrac > ACT2_DECLINE_UNMET;
  const snap = economySnapshot(state);
  if (!snap.gridActive || snap.powerDemand <= 0) return false;
  return snap.powerDemand - snap.powerSupply - OFFGRID_POWER > DECLINE_POWER_SHORT * snap.powerDemand;
}

interface Gates {
  reach: Uint8Array;
  aquiferLow: boolean;
}

function gates(state: GameState): Gates {
  const g = state.grid;
  const acc = roadAccess(state);
  const roads = new Uint8Array(g.w * g.h);
  if (acc.enforced) { for (let i = 0; i < roads.length; i++) if (acc.reached[i] === 1) roads[i] = 1; } else roads.fill(1);
  const aq = (getScenario(state.scenarioId).mechanics ?? []).includes('outback') ? mechMetric(state, 'aquifer') : null;
  return { reach: dilate(roads, g.w, g.h, ZONE_REACH), aquiferLow: aq !== null && aq < AQUIFER_MIN };
}

/** The reason an empty zoned tile cannot grow regardless of demand and power, or 0. */
function tileGate(state: GameState, gt: Gates, i: number, zone: number): ReasonCode {
  const g = state.grid;
  if (gt.reach[i] !== 1) return REASON.noRoad;
  const fam = familyOf(zone);
  if ((g.soilContamination[i] ?? 0) > ZONE_SOIL_MAX || (fam !== 'ind' && (g.airPollution[i] ?? 0) > ZONE_AIR_MAX)) return REASON.polluted;
  if (fam === 'res' && gt.aquiferLow) return REASON.noWater;
  // Bush zoned in Act 1 that has not grown by Act 2 stays bush: it is protected now.
  if (g.kind[i] === TileKind.Bush && state.phase !== 'act1') return REASON.protected;
  return REASON.none;
}

const FAMILIES: readonly ZoneFamily[] = ['res', 'com', 'ind'];

/** Where the town is: the mean of its connected buildings (not roads), or its focus on a fresh map. */
function townCentre(state: GameState): { x: number; y: number } {
  const acc = roadAccess(state);
  let sx = 0, sy = 0, n = 0;
  for (const b of state.buildings) {
    if (!acc.connected.has(b.uid)) continue;
    sx += b.x + b.w / 2 - 0.5;
    sy += b.y + b.h / 2 - 0.5;
    n++;
  }
  return n > 0 ? { x: sx / n, y: sy / n } : townFocus(state);
}

interface Cand { i: number; zone: number; key: number; r: number }

function candidates(state: GameState, gt: Gates, year: number): Record<ZoneFamily, Cand[]> {
  const g = state.grid;
  const c = townCentre(state);
  const rng = seasonRng(state.seed, year, 0x7a0e);
  const out: Record<ZoneFamily, Cand[]> = { res: [], com: [], ind: [] };
  for (let i = 0; i < g.zoning.length; i++) {
    const z = g.zoning[i] ?? 0;
    if (z === 0 || (g.building[i] ?? 0) !== 0 || !zonableKind(g.kind[i] ?? 0)) continue;
    const fam = familyOf(z);
    if (!fam || tileGate(state, gt, i, z) !== REASON.none) continue;
    const d = Math.hypot((i % g.w) - c.x, Math.floor(i / g.w) - c.y);
    out[fam].push({ i, zone: z, key: Math.round(d * 2), r: rng.next() });
  }
  for (const f of FAMILIES) out[f].sort((a, b) => a.key - b.key || a.r - b.r || a.i - b.i);
  return out;
}

/** What one growth tick did (kept in flags for the UI's growth line: zg.res, zg.com, zg.ind, zg.year). */
export interface GrowthReport {
  grown: Record<ZoneFamily, number>;
  emptied: number;
  refilled: number;
}

/**
 * One year of growth (Act 1 advanceYear and the Act 2 year end). Mutates `s`, which must already be a fresh copy. Order:
 *  1. decline: a grown building with no connected road, or with power badly short, counts a year; three in a row and it empties.
 *     It fills again as soon as the cause is fixed.
 *  2. density swaps the player paid for (a grown home rezoned to another density becomes that building).
 *  3. growth: per zone family, the tiles that can grow, nearest the town centre first (ties by the year's seasonRng, then tile
 *     index), until that family's demand is met, the year's cap is reached or the power runs out.
 */
export function growZones(s: GameState, year: number): GrowthReport {
  const rep: GrowthReport = { grown: { res: 0, com: 0, ind: 0 }, emptied: 0, refilled: 0 };
  const g = s.grid;
  let anyZone = false;
  for (let i = 0; i < g.zoning.length; i++) if ((g.zoning[i] ?? 0) !== 0) { anyZone = true; break; }
  if (!anyZone && !s.buildings.some((b) => b.grown)) return rep;

  // 1 + 2: decline and density swaps (a new buildings array, so cached road access never serves stale records).
  const acc = roadAccess(s);
  const severe = powerSevere(s);
  let changed = false;
  const nextList = s.buildings.map((b) => {
    if (!b.grown) return b;
    let out = b;
    const z = g.zoning[b.y * g.w + b.x] ?? 0;
    const want = z >= 1 && z <= 3 && familyOf(zoneOfType(b.type)) === 'res' ? ZONE_BUILDING[z as 1 | 2 | 3] : b.type;
    if (want !== b.type && year >= BUILDINGS[want].unlock) out = { ...out, type: want, builtYear: year, blocked: 0, empty: false };
    const blocked = !acc.connected.has(b.uid) || severe;
    const count = blocked ? (out.blocked ?? 0) + 1 : 0;
    const empty = count >= DECLINE_YEARS;
    if ((out.blocked ?? 0) !== count || (out.empty === true) !== empty) {
      if (empty && !out.empty) rep.emptied++;
      if (!empty && out.empty) rep.refilled++;
      out = { ...out, blocked: count, empty };
      if (!empty) delete out.empty;
      if (count === 0) delete out.blocked;
    }
    if (out !== b) changed = true;
    return out;
  });
  if (changed) s.buildings = nextList;

  // 3: growth.
  const demand = zoneDemand(s);
  const need: Record<ZoneFamily, number> = { res: demand.res, com: demand.com, ind: demand.ind };
  let spare = sparePower(s);
  const gt = gates(s);
  const cands = candidates(s, gt, year);
  const grownNow = s.buildings.filter((b) => b.grown).length;
  const cap = growthCap(s, grownNow);
  const used = new Set(s.buildings.map((b) => b.uid));
  let uid = s.nextUid;
  const alloc = (): number => {
    for (let n = 0; n < 65535; n++) {
      if (uid > 65535 || uid < 1) uid = 1;
      if (!used.has(uid)) { used.add(uid); const u = uid; uid++; return u; }
      uid++;
    }
    throw new Error('Too many buildings');
  };
  const fill = fillFn(s);
  const added: PlacedBuilding[] = [];
  for (const fam of FAMILIES) {
    let n = 0;
    for (const c of cands[fam]) {
      if (need[fam] <= 0 || n >= cap) break;
      const type = ZONE_BUILDING[c.zone as 1 | 2 | 3 | 4 | 5];
      const def = BUILDINGS[type];
      if (spare < -def.power) break;
      const x = c.i % g.w, y = Math.floor(c.i / g.w);
      const b: PlacedBuilding = { uid: alloc(), type, x, y, rotation: 0, w: 1, h: 1, builtYear: year, grown: true };
      added.push(b);
      g.building[c.i] = b.uid;
      g.health[c.i] = 0;
      g.stage[c.i] = 0;
      g.weed[c.i] = 0;
      // Zoned bush is only cleared when something actually grows on it: the sprawl cost, through the usual clearing path.
      if (g.kind[c.i] === TileKind.Bush) {
        g.kind[c.i] = TileKind.Land;
        s.pendingLandKt += CLEAR_KT_PER_TILE;
      }
      bumpRect(g, x, y, 1, 1);
      spare -= -def.power;
      need[fam] -= fam === 'res' ? def.housing * (type === 'zres3' ? fill({ ...b, grown: true }) : 1) : def.jobs;
      n++;
    }
    rep.grown[fam] = n;
  }
  if (added.length) {
    s.buildings = [...s.buildings, ...added];
    s.nextUid = uid;
  }
  s.flags['zg.year'] = year;
  s.flags['zg.res'] = rep.grown.res;
  s.flags['zg.com'] = rep.grown.com;
  s.flags['zg.ind'] = rep.grown.ind;
  if (rep.emptied) s.flags['zg.emptied'] = rep.emptied; else delete s.flags['zg.emptied'];
  for (const f of FAMILIES) if (rep.grown[f] > 0) noteAction(s, `grew.${f}`);
  return rep;
}

// ---------------------------------------------------------------------------------------------------------
// Reasons for the UI
// ---------------------------------------------------------------------------------------------------------

interface ReasonCache { version: number; len: number; year: number; codes: Uint8Array }
const REASONS = new WeakMap<readonly PlacedBuilding[], ReasonCache>();

/**
 * Per tile, why a zoned tile is not growing (REASON codes; 0 for tiles with no zone or with a building that is fine). Cached by
 * version. Demand and power are judged as the next growth tick would see them, without growing anything.
 */
export function zoneReasons(state: GameState): Uint8Array {
  const hit = REASONS.get(state.buildings);
  if (hit && hit.version === state.version && hit.len === state.buildings.length && hit.year === state.year) return hit.codes;
  const g = state.grid;
  const codes = new Uint8Array(g.w * g.h);
  let any = false;
  for (let i = 0; i < g.zoning.length; i++) if ((g.zoning[i] ?? 0) !== 0) { any = true; break; }
  if (any) {
    const gt = gates(state);
    const demand = zoneDemand(state);
    const spare = sparePower(state);
    const byUid = new Map(state.buildings.map((b) => [b.uid, b] as const));
    for (let i = 0; i < g.zoning.length; i++) {
      const z = g.zoning[i] ?? 0;
      if (z === 0 || !zonableKind(g.kind[i] ?? 0)) continue;
      const u = g.building[i] ?? 0;
      if (u !== 0) {
        if (byUid.get(u)?.empty) codes[i] = REASON.empty;
        continue;
      }
      const gate = tileGate(state, gt, i, z);
      if (gate !== REASON.none) { codes[i] = gate; continue; }
      const fam = familyOf(z) as ZoneFamily;
      const def = BUILDINGS[ZONE_BUILDING[z as 1 | 2 | 3 | 4 | 5]];
      codes[i] = demand[fam] <= 0 ? REASON.noDemand : spare < -def.power ? REASON.noPower : REASON.ready;
    }
  }
  REASONS.set(state.buildings, { version: state.version, len: state.buildings.length, year: state.year, codes });
  return codes;
}

/** Counts of zoned tiles waiting for each reason (for the Town needs drawer), with one example tile each. */
export function zoneBlockers(state: GameState): { code: ReasonCode; zone: number; count: number; tiles: number[] }[] {
  const codes = zoneReasons(state);
  const g = state.grid;
  const out = new Map<string, { code: ReasonCode; zone: number; count: number; tiles: number[] }>();
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i] ?? 0;
    if (c === 0 || c === REASON.ready) continue;
    const fam = familyOf(g.zoning[i] ?? 0);
    // One line per reason (and per family for "no one needs more").
    const key = c === REASON.noDemand ? `${c}:${fam}` : String(c);
    let e = out.get(key);
    if (!e) { e = { code: c as ReasonCode, zone: g.zoning[i] ?? 0, count: 0, tiles: [] }; out.set(key, e); }
    e.count++;
    if (e.tiles.length < 64) e.tiles.push(i);
  }
  return [...out.values()].sort((a, b) => a.code - b.code || a.zone - b.zone);
}

export { GRID_YEAR };
