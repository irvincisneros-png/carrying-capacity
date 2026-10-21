/**
 * River Town water model (pure reads). Allocation is a cap: each season the town and the farms may take up to their
 * share of the river's flow, but only what they actually need. What is left stays in the river for fish, red gums and
 * billabongs. Flow follows the weather, drought and warming; the player's levers are the allocation policies, storage,
 * efficient irrigation, a fishway at the weir and plantings along the banks.
 */
import { getScenario } from '../scenarios';
import { policyValue } from '../policyCore';
import { TileKind } from '../types';
import type { GameState } from '../types';
import { clamp, clamp01, flag } from './flags';

export const RIVER = {
  /** Mean natural flow per season (flow units) at rainfall 1 and no drought. */
  baseFlow: 12,
  /** Seasonal shape: summer, autumn, winter, spring. Mean 1. */
  shape: [0.8, 0.6, 1.0, 1.6] as readonly number[],
  droughtFlow: 0.35,
  /** Share of flow lost per degree of warming above 0.5. */
  warmDry: 0.07,
  townPerPop: 0.0012,
  townSeason: [1.3, 0.9, 0.8, 1.0] as readonly number[],
  farmPerFarm: 0.6,
  irrigation: [1.5, 0.7, 0.15, 1.0] as readonly number[],
  dripSaving: 0.4,
  baseStorage: 1.2,
  reservoirStorage: 3,
  evaporation: 0.05,
  /** The river keeps this share of its flow for the environment to count as healthy. */
  envNeed: 0.4,
  /** Salt added per season per unit of irrigation delivered, on tiles within 2 of a farm. */
  saltPerFarm: 0.0016,
  dripSalt: 0.35,
  /** Extra salt decay near the river when it runs high (flushing). */
  flush: 0.03,
  /** Scales the chance of a blue-green algae bloom. */
  bloomK: 2.5,
  townFailBelow: 0.9,
  townFailFromYear: 2041,
  /** Drought plan: wet-season water banked for the farms (only flow above the river's own share), and its cap. */
  bankCap: 8,
  bankShare: 0.5,
  /** Drought plan, while a drought is on: town restrictions and farm deficit irrigation (share of normal demand). */
  droughtTown: 0.8,
  droughtFarm: 0.7,
} as const;

/** Is the council's drought plan switched on? */
export function droughtPlanOn(s: GameState): boolean {
  return policyValue(s, 'drought.plan') >= 1;
}

export interface Allocation {
  town: number;
  farms: number;
  env: number;
}

export function allocation(s: GameState): Allocation {
  const town = policyValue(s, 'alloc.town');
  const env = policyValue(s, 'alloc.env');
  return { town, env, farms: Math.max(0.05, 1 - town - env) };
}

export function riverTileIdx(s: GameState): number[] {
  const out: number[] = [];
  const g = s.grid;
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === TileKind.River) out.push(i);
  return out;
}

/** The weir is a run of River tiles raised to elevation 1. */
export function weirTileIdx(s: GameState): number[] {
  const out: number[] = [];
  const g = s.grid;
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === TileKind.River && (g.elevation[i] ?? 0) > 0) out.push(i);
  return out;
}

export function hasFishway(s: GameState): boolean {
  const g = s.grid;
  return s.buildings.some((b) => b.type === 'fishway' && (g.elevation[b.y * g.w + b.x] ?? 0) > 0);
}

export function farmCount(s: GameState): { farms: number; drip: number } {
  let farms = 0, drip = 0;
  for (const b of s.buildings) {
    if (b.type === 'farm') farms++;
    else if (b.type === 'dripfarm') drip++;
  }
  return { farms, drip };
}

export function storageCapacity(s: GameState): number {
  let n = 0;
  for (const b of s.buildings) if (b.type === 'reservoir') n++;
  return RIVER.baseStorage + RIVER.reservoirStorage * n;
}

export function townDemand(s: GameState, season: number, drought = false): number {
  const saving = 1 - 0.22 * clamp01(flag(s, 'w.saving'));
  const restrict = drought && droughtPlanOn(s) ? RIVER.droughtTown : 1;
  return s.population * RIVER.townPerPop * (RIVER.townSeason[season] ?? 1) * saving * restrict;
}

export function farmDemand(s: GameState, season: number, drought = false): number {
  const { farms, drip } = farmCount(s);
  const eff = 1 - 0.18 * clamp01(flag(s, 'w.farmEff'));
  const deficit = drought && droughtPlanOn(s) ? RIVER.droughtFarm : 1;
  return (farms + drip * (1 - RIVER.dripSaving)) * RIVER.farmPerFarm * (RIVER.irrigation[season] ?? 1) * eff * deficit;
}

export interface FlowInputs {
  rain: number;
  drought: boolean;
  heatwave: boolean;
}

export function naturalFlow(s: GameState, season: number, rainfall: number, w: FlowInputs): number {
  const dry = 1 - RIVER.warmDry * Math.max(0, s.tempC - 0.5);
  return RIVER.baseFlow * (RIVER.shape[season] ?? 1) * w.rain * rainfall * Math.max(0.5, dry) * (w.drought ? RIVER.droughtFlow : 1) * (w.heatwave ? 0.95 : 1);
}

/** Fraction of vegetated (red gum, shrub, reed) tiles on the banks: all land within 2 tiles of the river or a billabong. */
export function ripFraction(s: GameState): number {
  const g = s.grid;
  let n = 0, veg = 0;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      const k = g.kind[i];
      if (k !== TileKind.Land && k !== TileKind.Bush) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
          const kk = g.kind[yy * g.w + xx];
          if (kk === TileKind.River || kk === TileKind.Wetland) { near = true; break; }
        }
      }
      if (!near) continue;
      n++;
      if ((g.building[i] ?? 0) === 0 && (k === TileKind.Bush || ((g.stage[i] ?? 0) >= 2 && (g.health[i] ?? 0) > 0))) veg++;
    }
  }
  return n > 0 ? veg / n : 1;
}

/** Reference river length (tiles) the town's pollution and bank clearing are measured against (the original map had about 100; calibrated at 140 for the 64x64 river). */
export const RIVER_REF_TILES = 140;

function riverTiles(s: GameState): number {
  let n = 0;
  for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.River) n++;
  return n;
}

export function meanRiverWaterPollution(s: GameState): number {
  const g = s.grid;
  let t = 0, n = 0;
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === TileKind.River) { t += g.waterPollution[i] ?? 0; n++; }
  // A longer river dilutes what the town puts into it, so the total is measured against the length of river the original map
  // had (the mean scaled by the river's growth): "polluted river" then means what it did on the original map, however big the
  // map is. (Scaling by map area instead overstates it: the river grows more slowly than the area.)
  return n > 0 ? (t / n) * (n / RIVER_REF_TILES) : 0;
}

/** Mean salt (soil contamination) on unbuilt land within `r` tiles of a building of the given types, or of water if none given. */
export function meanSaltNear(s: GameState, r: number, types: readonly string[]): number {
  const g = s.grid;
  let t = 0, n = 0;
  const near = new Uint8Array(g.kind.length);
  if (types.length > 0) {
    for (const b of s.buildings) {
      if (!types.includes(b.type)) continue;
      for (let y = Math.max(0, b.y - r); y <= Math.min(g.h - 1, b.y + b.h - 1 + r); y++) {
        for (let x = Math.max(0, b.x - r); x <= Math.min(g.w - 1, b.x + b.w - 1 + r); x++) near[y * g.w + x] = 1;
      }
    }
  } else {
    for (let i = 0; i < g.kind.length; i++) {
      if (g.kind[i] !== TileKind.River) continue;
      const x0 = i % g.w, y0 = Math.floor(i / g.w);
      for (let y = Math.max(0, y0 - r); y <= Math.min(g.h - 1, y0 + r); y++) {
        for (let x = Math.max(0, x0 - r); x <= Math.min(g.w - 1, x0 + r); x++) near[y * g.w + x] = 1;
      }
    }
  }
  for (let i = 0; i < near.length; i++) {
    if (near[i] !== 1 || (g.building[i] ?? 0) !== 0) continue;
    const k = g.kind[i];
    if (k !== TileKind.Land && k !== TileKind.Bush) continue;
    t += g.soilContamination[i] ?? 0;
    n++;
  }
  return n > 0 ? t / n : 0;
}

/** River health 0..100. */
export function riverHealth(s: GameState): number {
  const flowScore = clamp01(flag(s, 'w.envAvg', 0.9));
  const quality = 1 - clamp01(meanRiverWaterPollution(s) / 1.5);
  const salt = 1 - clamp01(meanSaltNear(s, 3, []) / 1.5);
  // Like the pollution above, the bank cleared by the town's farms is a smaller share of a longer river's banks: measure the
  // cleared share against the original map's river length so the same clearing costs the river the same on any map.
  const cleared = (1 - ripFraction(s)) * Math.max(1, riverTiles(s) / RIVER_REF_TILES);
  const rip = clamp01((1 - cleared) / 0.7);
  const weir = weirTileIdx(s).length > 0;
  const passage = weir ? (hasFishway(s) ? 1 : 0.45) : 1;
  const damage = clamp01(flag(s, 'w.damage'));
  const h = 100 * (0.35 * flowScore + 0.2 * quality + 0.1 * salt + 0.2 * rip + 0.15 * passage) * (1 - 0.5 * damage);
  return Math.round(clamp(h, 0, 100) * 10) / 10;
}

/** Farm viability 0..100: how well the irrigated farms are doing (water delivered, salt, and enough of them to matter). */
export function farmViability(s: GameState): number {
  const { farms, drip } = farmCount(s);
  const n = farms + drip;
  if (n === 0) return 0;
  const salt = clamp01(meanSaltNear(s, 2, ['farm', 'dripfarm']) / 1.5);
  const yieldEma = clamp01(flag(s, 'w.yield', 0.9));
  const v = 100 * yieldEma * (1 - 0.6 * salt) * Math.min(1, n / 4);
  return Math.round(clamp(v, 0, 100) * 10) / 10;
}
