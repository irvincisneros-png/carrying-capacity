/**
 * Red Dirt (pure reads): scarce water from the waterhole and the aquifer, and the staged rehabilitation of the mine
 * site on Country. Mine-site tiles are marked in grid.zone: 1 = awaiting work, 100..249 = seeded in year 2000 + (v - 100)
 * and being monitored, 250 = signed off by the Traditional Owners. While a tile is a Pit, grid.stage is its rehab stage:
 * 0 open void, 1 reshaped, 2 topsoiled.
 */
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
