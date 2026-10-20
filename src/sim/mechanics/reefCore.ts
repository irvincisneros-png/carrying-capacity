/**
 * Reef Island physical model (pure reads): sea level from warming, storm-surge flooding of low homes, the seawall vs
 * mangrove trade-off, and the tourism index that ties the economy to the health of the reef.
 */
import { reefHealth } from '../climate';
import { meanReefHealth } from '../metrics';
import { policyValue } from '../policyCore';
import { TileKind } from '../types';
import type { GameState, PlacedBuilding } from '../types';
import { clamp, clamp01, flag } from './flags';

export const REEF = {
  /** Metres above today's high-tide line for tile elevation levels 0..3. */
  tileHeightM: [0, 0.9, 1.8, 4.0] as readonly number[],
  slrScale: 24,
  slrPower: 1.15,
  /** Sea level (cm) used as the baseline when Act 2 has not recorded one. */
  defaultBaselineCm: 30,
  surgeBase: 0.3,
  surgePerSev: 0.8,
  wallProtectM: 1.0,
  wallTopM: 1.8,
  mangroveProtectM: 0.4,
  mangroveRadius: 4,
  mangroveFullTiles: 6,
  resortIncome: 7,
  cotsBase: [0.05, 0.03, 0.008, 0.04] as readonly number[],
  cullCost: [0, 5, 10] as readonly number[],
} as const;

/** Sea level above the pre-industrial mean (cm), from warming and the warming still to come. */
export function seaLevelCm(s: GameState): number {
  const eq = s.phase === 'act1' || s.phase === 'turning-point' ? s.tempC : (s.tempC + s.a2.eqTempC) / 2;
  return REEF.slrScale * Math.pow(Math.max(0, eq), REEF.slrPower);
}

/** Metres the sea has risen since Act 2 began. */
export function seaRiseM(s: GameState): number {
  const base = s.flags['r.slr0'];
  const b = typeof base === 'number' ? base : REEF.defaultBaselineCm;
  return Math.max(0, (seaLevelCm(s) - b) / 100);
}

const waterNear = (s: GameState, b: PlacedBuilding, r: number, kinds: readonly number[]): boolean => {
  const g = s.grid;
  for (let y = Math.max(0, b.y - r); y <= Math.min(g.h - 1, b.y + b.h - 1 + r); y++) {
    for (let x = Math.max(0, b.x - r); x <= Math.min(g.w - 1, b.x + b.w - 1 + r); x++) {
      if (kinds.includes(g.kind[y * g.w + x] ?? -1)) return true;
    }
  }
  return false;
};

/** Height (m) of the lowest tile under a building. */
export function homeLevelM(s: GameState, b: PlacedBuilding): number {
  const g = s.grid;
  let lo = 99;
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) lo = Math.min(lo, REEF.tileHeightM[g.elevation[y * g.w + x] ?? 0] ?? 0);
  return lo;
}

export function isCoastal(s: GameState, b: PlacedBuilding): boolean {
  return waterNear(s, b, 4, [TileKind.Sea, TileKind.Reef, TileKind.Estuary]);
}

export function seawallNear(s: GameState, b: PlacedBuilding): boolean {
  return s.buildings.some((o) => o.type === 'seawall' && Math.max(Math.abs(o.x - Math.max(b.x, Math.min(o.x, b.x + b.w - 1))), Math.abs(o.y - Math.max(b.y, Math.min(o.y, b.y + b.h - 1)))) <= 2);
}

/** 0..1: healthy mangrove (mature estuary) tiles near a building. */
export function mangroveBuffer(s: GameState, b: PlacedBuilding): number {
  const g = s.grid;
  const r = REEF.mangroveRadius;
  let n = 0;
  for (let y = Math.max(0, b.y - r); y <= Math.min(g.h - 1, b.y + b.h - 1 + r); y++) {
    for (let x = Math.max(0, b.x - r); x <= Math.min(g.w - 1, b.x + b.w - 1 + r); x++) {
      const i = y * g.w + x;
      if (g.kind[i] === TileKind.Estuary && (g.stage[i] ?? 0) >= 3) n++;
    }
  }
  return clamp01(n / REEF.mangroveFullTiles);
}

/** Metres of surge a building is shielded from. */
export function protectionM(s: GameState, b: PlacedBuilding, totalWaterM: number): number {
  let p = REEF.mangroveProtectM * mangroveBuffer(s, b);
  if (seawallNear(s, b)) p += totalWaterM > REEF.wallTopM ? REEF.wallProtectM * 0.4 : REEF.wallProtectM;
  return p;
}

/** A home would be flooded by a surge of `surgeM` metres right now. */
export function wouldFlood(s: GameState, b: PlacedBuilding, surgeM: number): boolean {
  if (!isCoastal(s, b)) return false;
  const water = seaRiseM(s) + surgeM;
  return homeLevelM(s, b) < water - protectionM(s, b, water);
}

/** Would the building flood with no seawall and no mangroves? (to count what the defences saved) */
export function wouldFloodBare(s: GameState, b: PlacedBuilding, surgeM: number): boolean {
  return isCoastal(s, b) && homeLevelM(s, b) < seaRiseM(s) + surgeM;
}

export function surgeHeightM(severity: number): number {
  return REEF.surgeBase + REEF.surgePerSev * severity;
}

export function resortCount(s: GameState): number {
  let n = 0;
  for (const b of s.buildings) if (b.type === 'resort') n++;
  return n;
}

const nearBeach = (s: GameState): { beach: number; walled: number; water: number } => {
  const g = s.grid;
  let beach = 0, walled = 0, wsum = 0, wn = 0;
  const walls = s.buildings.filter((b) => b.type === 'seawall');
  for (let i = 0; i < g.kind.length; i++) {
    if (g.kind[i] !== TileKind.Beach) continue;
    beach++;
    const x = i % g.w, y = Math.floor(i / g.w);
    if (walls.some((w) => Math.abs(w.x - x) <= 1 && Math.abs(w.y - y) <= 1)) walled++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
      const k = g.kind[yy * g.w + xx];
      if (k === TileKind.Sea || k === TileKind.Reef) { wsum += g.waterPollution[yy * g.w + xx] ?? 0; wn++; }
    }
  }
  return { beach, walled, water: wn > 0 ? wsum / wn : 0 };
};

/** Mean coral quality 0..1: the grid in Act 2, a warming formula before that. */
export function reefQuality(s: GameState): number {
  if (s.phase === 'act1' || s.phase === 'turning-point') {
    const g = s.grid;
    let t = 0, n = 0;
    for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === TileKind.Reef) { t += g.waterPollution[i] ?? 0; n++; }
    return reefHealth(s.tempC, n > 0 ? t / n : 0);
  }
  return meanReefHealth(s);
}

/** Tourism index 0..100 (reef, beach, wildlife, safety), scaled by how many resorts there are to welcome guests. */
export function tourismIndex(s: GameState): number {
  const R = Math.pow(clamp01(reefQuality(s)), 0.8);
  const nb = nearBeach(s);
  const B = nb.beach > 0 ? clamp01((1 - 0.8 * (nb.walled / nb.beach)) * (1 - 0.5 * clamp01(nb.water / 1.5))) : 0.5;
  const wild = s.wildlife.species;
  const hasWild = Object.keys(wild).length > 0;
  const W = hasWild ? clamp01(((wild['reef-turtle']?.pop ?? 0) > 0 ? 0.5 : 0) + ((wild['dugong']?.pop ?? 0) > 0 ? 0.5 : 0)) : 0.5;
  let recent = 0;
  for (const e of s.eventLog) if ((e.type === 'storm-surge' || e.type === 'crown-of-thorns') && e.year >= s.year - 6) recent++;
  const S = 1 - 0.5 * clamp01(recent / 4);
  const raw = 100 * (0.55 * R + 0.15 * B + 0.15 * W + 0.15 * S);
  const capacity = Math.min(1, resortCount(s) / 2);
  return Math.round(clamp(raw * capacity, 0, 100) * 10) / 10;
}

/** Yearly tourism income. */
export function tourismIncome(s: GameState): number {
  return Math.round(resortCount(s) * REEF.resortIncome * (tourismIndex(s) / 100) * 10) / 10;
}

export function cullLevel(s: GameState): number {
  return clamp(Math.round(policyValue(s, 'cots.cull')), 0, 2);
}

/** Chance of a crown-of-thorns outbreak in a season. */
export function cotsChance(s: GameState, season: number): number {
  const g = s.grid;
  let t = 0, n = 0;
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === TileKind.Reef) { t += g.waterPollution[i] ?? 0; n++; }
  const nutrient = n > 0 ? t / n : 0;
  return (REEF.cotsBase[season] ?? 0) * (1 + 2 * clamp01(nutrient / 1.0)) * (1 - 0.7 * (cullLevel(s) / 2)) * (s.tempC > 0.3 ? 1 : 0.5) * (flag(s, 'r.cots') > 0 ? 0 : 1);
}
