/**
 * Red Dirt (pure reads): scarce water from the waterhole and the aquifer, and the staged rehabilitation of the mine
 * site on Country. Mine-site tiles are marked in grid.zone: 1 = awaiting work, 100..249 = seeded in year 2000 + (v - 100)
 * and being monitored, 250 = signed off by the Traditional Owners. While a tile is a Pit, grid.stage is its rehab stage:
 * 0 open void, 1 reshaped, 2 topsoiled.
 */
import { BUILDINGS } from '../buildings';
import { GROWTH, SEED_HEALTH } from '../restoration';
import { TileKind } from '../types';
import type { GameState } from '../types';
import { clamp, clamp01, flag } from './flags';

export const OUTBACK = {
  startAquifer: 80,
  /** Aquifer points gained per season at rainfall 1 and average weather. */
  recharge: 0.2,
  droughtRecharge: 0.3,
  /** Water the waterhole supplies per season when full. */
  waterholeSupply: 0.9,
  townPerPop: 0.0005,
  townSeason: [1.35, 0.9, 0.75, 1.1] as readonly number[],
  mineUse: 0.8,
  rehabUse: 0.012,
  boreSupply: 0.7,
  /** Aquifer points drawn per unit of water pumped. */
  drawPerUnit: 0.8,
  baseStorage: 0.8,
  reservoirStorage: 2.4,
  failBelow: 0.9,
  failFromYear: 2041,
  restrictCut: [0, 0.12, 0.25] as readonly number[],
  stageCost: [2.4, 1.6, 1] as readonly number[],
  reshapeKt: 1.2,
  seedPartnership: 30,
  signoffPartnership: 45,
  monitorYears: 5,
  /** Vegetation health a monitored tile needs to be signed off (shrubland of the right kind, not yet mature woodland). */
  signoffHealth: 0.25,
  signedZone: 250,
  /** Money the closed mine's rehabilitation bond releases to the town, per tile of mine site. */
  bondPerTile: 6,
} as const;

export function seedZone(year: number): number {
  return clamp(100 + (year - 2000), 100, 249);
}

export function siteTiles(s: GameState): { total: number; signed: number; seeded: number; pit: number } {
  const z = s.grid.zone;
  let total = 0, signed = 0, seeded = 0, pit = 0;
  for (let i = 0; i < z.length; i++) {
    const v = z[i] ?? 0;
    if (v === 0) continue;
    total++;
    if (v === OUTBACK.signedZone) signed++;
    else if (v >= 100) seeded++;
    if (s.grid.kind[i] === TileKind.Pit) pit++;
  }
  return { total, signed, seeded, pit };
}

export function minesOpen(s: GameState): number {
  let n = 0;
  for (const b of s.buildings) if (b.type === 'coalmine') n++;
  return n;
}

/** 0..100: share of the mine site signed off. Capped below 100 while a mine is still operating. */
export function rehabPct(s: GameState): number {
  const t = siteTiles(s);
  if (t.total === 0) return 100;
  const pct = (100 * t.signed) / t.total;
  return Math.round((minesOpen(s) > 0 ? Math.min(pct, 99) : pct) * 10) / 10;
}

export function aquifer(s: GameState): number {
  return Math.round(clamp(flag(s, 'o.aq', OUTBACK.startAquifer), 0, 100) * 10) / 10;
}

export function storageCapacity(s: GameState): number {
  let n = 0;
  for (const b of s.buildings) if (b.type === 'reservoir') n++;
  return OUTBACK.baseStorage + OUTBACK.reservoirStorage * n;
}

export function boreCount(s: GameState): number {
  let n = 0;
  for (const b of s.buildings) if (b.type === 'bore') n++;
  return n;
}

export function townWaterDemand(s: GameState, season: number, restrictLevel: number): number {
  const cut = OUTBACK.restrictCut[clamp(Math.round(restrictLevel), 0, 2)] ?? 0;
  const saving = 1 - 0.2 * clamp01(flag(s, 'o.saving'));
  const rehab = siteTiles(s).seeded * OUTBACK.rehabUse;
  return (s.population * OUTBACK.townPerPop * (OUTBACK.townSeason[season] ?? 1) + minesOpen(s) * OUTBACK.mineUse + rehab) * (1 - cut) * saving;
}

/** How far (in tiles) a native plant nursery's seed and weeding crew reach. */
export const NURSERY_REACH = BUILDINGS.nursery.nursery?.radius ?? 5;

/** 1 for every tile a nursery's crew reaches (same shape the succession step uses). */
export function nurseryCover(s: GameState): Uint8Array {
  const g = s.grid;
  const out = new Uint8Array(g.w * g.h);
  for (const b of s.buildings) {
    const r = BUILDINGS[b.type].nursery?.radius;
    if (r === undefined) continue;
    for (let y = Math.max(0, b.y - r); y <= Math.min(g.h - 1, b.y + b.h - 1 + r); y++) {
      const dy = Math.max(b.y - y, y - (b.y + b.h - 1), 0);
      for (let x = Math.max(0, b.x - r); x <= Math.min(g.w - 1, b.x + b.w - 1 + r); x++) {
        const dx = Math.max(b.x - x, x - (b.x + b.w - 1), 0);
        if (Math.hypot(dx, dy) <= r) out[y * g.w + x] = 1;
      }
    }
  }
  return out;
}

export interface RehabWatch {
  /** Seeded, unsigned tiles that cannot grow: bare, outside every nursery's reach and with no healthy neighbour to shed seed. */
  stuck: number[];
  /** The stuck tiles grouped into touching patches (one entry per patch: a tile in it, and its size), biggest first. */
  patches: { x: number; y: number; n: number }[];
  /** Mine-site tiles still waiting for reshaping, topsoil or seeding. */
  pit: number[];
  reach: number;
}

/** Where the Red Dirt rehabilitation is stuck: seeded patches too far from a nursery to ever grow. */
export function rehabWatch(s: GameState): RehabWatch {
  const g = s.grid;
  const cover = nurseryCover(s);
  const stuck: number[] = [];
  const pit: number[] = [];
  const isStuck = new Uint8Array(g.w * g.h);
  for (let i = 0; i < g.zone.length; i++) {
    const z = g.zone[i] ?? 0;
    if (z === 0 || z === OUTBACK.signedZone) continue;
    if (g.kind[i] === TileKind.Pit) { pit.push(i); continue; }
    if (z < 100 || (g.health[i] ?? 0) >= SEED_HEALTH || cover[i] === 1) continue;
    const x = i % g.w, y = Math.floor(i / g.w);
    let seeded = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
      const j = yy * g.w + xx;
      if ((g.building[j] ?? 0) === 0 && (g.health[j] ?? 0) >= GROWTH.seedHealth) { seeded = true; break; }
    }
    if (seeded) continue;
    stuck.push(i);
    isStuck[i] = 1;
  }
  const seen = new Set<number>();
  const patches: RehabWatch['patches'] = [];
  for (const i0 of stuck) {
    if (seen.has(i0)) continue;
    seen.add(i0);
    const q = [i0];
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi] as number;
      const x = i % g.w, y = Math.floor(i / g.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
        const j = yy * g.w + xx;
        if (isStuck[j] === 1 && !seen.has(j)) { seen.add(j); q.push(j); }
      }
    }
    const mid = q[Math.floor(q.length / 2)] as number;
    patches.push({ x: mid % g.w, y: Math.floor(mid / g.w), n: q.length });
  }
  patches.sort((a, b) => b.n - a.n);
  return { stuck, patches, pit, reach: NURSERY_REACH };
}
