import { BUILDINGS } from './buildings';
import { getScenario } from './scenarios';
import { TileKind } from './types';
import type { GameState, PlacedBuilding, TileGrid } from './types';

/** Fraction of each pollution field that persists into the next decade. (Act 2 remediation will change this.) */
export const POLLUTION_PERSISTENCE = 0.5;
export const MAX_POLLUTION_RADIUS = 6;

/**
 * Decays the fields in place then adds every building's sources: each source adds
 * intensity * (1 - d / (R + 1)) to tiles within radius R of its footprint (d = euclidean edge distance),
 * R = min(6, 1 + ceil(intensity)).
 */
export function updatePollution(grid: TileGrid, buildings: readonly PlacedBuilding[]): void {
  const { w, h } = grid;
  const fields = [grid.airPollution, grid.waterPollution, grid.soilContamination] as const;
  for (const f of fields) for (let i = 0; i < f.length; i++) f[i] = (f[i] ?? 0) * POLLUTION_PERSISTENCE;
  for (const b of buildings) {
    const prof = BUILDINGS[b.type].pollutes;
    const channels: [Float32Array, number][] = [
      [grid.airPollution, prof.air ?? 0],
      [grid.waterPollution, prof.water ?? 0],
      [grid.soilContamination, prof.soil ?? 0],
    ];
    for (const [field, intensity] of channels) {
      if (intensity <= 0) continue;
      const r = Math.min(MAX_POLLUTION_RADIUS, 1 + Math.ceil(intensity));
      const x0 = Math.max(0, b.x - r);
      const x1 = Math.min(w - 1, b.x + b.w - 1 + r);
      const y0 = Math.max(0, b.y - r);
      const y1 = Math.min(h - 1, b.y + b.h - 1 + r);
      for (let y = y0; y <= y1; y++) {
        const dy = Math.max(b.y - y, y - (b.y + b.h - 1), 0);
        for (let x = x0; x <= x1; x++) {
          const dx = Math.max(b.x - x, x - (b.x + b.w - 1), 0);
          const d = Math.hypot(dx, dy);
          if (d > r) continue;
          const i = y * w + x;
          field[i] = (field[i] ?? 0) + intensity * (1 - d / (r + 1));
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// Act 2: seasonal pollution, remediation and wetlands
// ---------------------------------------------------------------------------------------------------------


/** Fraction of air / water pollution persisting after one decade (matches Act 1). */
export const AIR_WATER_PERSIST_DECADE = 0.5;
/** Soil contamination lingers: only 20% decays per decade without remediation (half-life about 31 years). */
export const SOIL_PERSIST_DECADE = 0.8;
const SEASONS_PER_DECADE = 40;

const decaySeason = (decade: number): number => Math.pow(decade, 1 / SEASONS_PER_DECADE);
export const AIR_WATER_DECAY_SEASON = decaySeason(AIR_WATER_PERSIST_DECADE);
/**
 * Act 2 air pollution clears within a few years of its source closing: smoke and fine particles wash out of the air in
 * days, and the haze map here stands for the soot and dust they leave on streets and roofs, which rain and street
 * cleaning remove over a couple of years (half-life about a year). Steady state with the source running is unchanged.
 */
export const AIR_HALF_LIFE_YEARS = 1;
export const AIR_DECAY_SEASON = Math.pow(0.5, 1 / (4 * AIR_HALF_LIFE_YEARS));
export const SOIL_DECAY_SEASON = decaySeason(SOIL_PERSIST_DECADE);

/** Soil contamination below which plants can establish. */
export const SOIL_OK = 0.5;
/** Soil contamination above which existing plants die back. */
export const SOIL_TOXIC = 1.5;
/** Water pollution thresholds for estuary / seagrass vegetation. */
export const WATER_OK = 0.6;
export const WATER_TOXIC = 1.8;

/** Contamination is cut by this factor over a remediation site's nominal time. */
const REMEDIATION_FACTOR = 8;
/** Soil below this stops a remediation site working (and an excavation site trucking). */
export const REMEDIATION_IDLE = 0.3;

/**
 * One season of pollution: fields decay (fast for air and water, slow for soil), then every building adds its
 * sources scaled to a steady state identical to Act 1. `scale(b)` lets power stations pollute only while running.
 */
export function updatePollutionSeason(
  grid: TileGrid,
  buildings: readonly PlacedBuilding[],
  scale: (b: PlacedBuilding) => number,
): void {
  const { w, h } = grid;
  // Per-season add = intensity * (1 - decay) / (1 - persist^(1/40)) ... normalised so steady state = Act 1's 2x.
  const addAW = (1 - AIR_WATER_DECAY_SEASON) / (1 - AIR_WATER_PERSIST_DECADE);
  const addAir = (1 - AIR_DECAY_SEASON) / (1 - AIR_WATER_PERSIST_DECADE);
  const addSoil = (1 - SOIL_DECAY_SEASON) / (1 - SOIL_PERSIST_DECADE);
  for (let i = 0; i < grid.airPollution.length; i++) {
    grid.airPollution[i] = (grid.airPollution[i] ?? 0) * AIR_DECAY_SEASON;
    grid.waterPollution[i] = (grid.waterPollution[i] ?? 0) * AIR_WATER_DECAY_SEASON;
    grid.soilContamination[i] = (grid.soilContamination[i] ?? 0) * SOIL_DECAY_SEASON;
  }
  for (const b of buildings) {
    const k = scale(b);
    if (k <= 0) continue;
    const prof = BUILDINGS[b.type].pollutes;
    const channels: [Float32Array, number, number][] = [
      [grid.airPollution, prof.air ?? 0, addAir],
      [grid.waterPollution, prof.water ?? 0, addAW],
      [grid.soilContamination, prof.soil ?? 0, addSoil],
    ];
    for (const [field, base, add] of channels) {
      const intensity = base * k;
      if (base <= 0 || intensity <= 0) continue;
      // Radius depends on the building's full strength so it doesn't flicker with utilisation.
      const r = Math.min(MAX_POLLUTION_RADIUS, 1 + Math.ceil(base));
      const x0 = Math.max(0, b.x - r);
      const x1 = Math.min(w - 1, b.x + b.w - 1 + r);
      const y0 = Math.max(0, b.y - r);
      const y1 = Math.min(h - 1, b.y + b.h - 1 + r);
      for (let y = y0; y <= y1; y++) {
        const dy = Math.max(b.y - y, y - (b.y + b.h - 1), 0);
        for (let x = x0; x <= x1; x++) {
          const dx = Math.max(b.x - x, x - (b.x + b.w - 1), 0);
          const d = Math.hypot(dx, dy);
          if (d > r) continue;
          const i = y * w + x;
          field[i] = (field[i] ?? 0) + intensity * add * (1 - d / (r + 1));
        }
      }
    }
  }
}

/** Per-season multiplier on soil contamination for a remediation building in this scenario. */
export function remediationSeasonFactor(buildingType: keyof typeof BUILDINGS, remediationYears: number): number {
  const spec = BUILDINGS[buildingType].remediation;
  if (!spec) return 1;
  const years = spec.baseYears * (remediationYears / 20);
  return Math.exp(-Math.log(REMEDIATION_FACTOR) / (years * 4));
}

/** Nominal years for a remediation site type to cut contamination 8-fold in this scenario. */
export function remediationYearsFor(buildingType: keyof typeof BUILDINGS, remediationYears: number): number {
  const spec = BUILDINGS[buildingType].remediation;
  return spec ? spec.baseYears * (remediationYears / 20) : 0;
}

/**
 * Remediation sites cut soil contamination in range. Returns uids of sites that did work
 * (they are the ones that emit trucking CO2 if they are excavations).
 */
export function applyRemediation(state: GameState, grid: TileGrid): number[] {
  const sc = getScenario(state.scenarioId);
  const active: number[] = [];
  const { w, h } = grid;
  for (const b of state.buildings) {
    const spec = BUILDINGS[b.type].remediation;
    if (!spec) continue;
    const f = remediationSeasonFactor(b.type, sc.modifiers.remediationYears);
    const r = spec.radius;
    let worked = false;
    for (let y = Math.max(0, b.y - r); y <= Math.min(h - 1, b.y + b.h - 1 + r); y++) {
      const dy = Math.max(b.y - y, y - (b.y + b.h - 1), 0);
      for (let x = Math.max(0, b.x - r); x <= Math.min(w - 1, b.x + b.w - 1 + r); x++) {
        const dx = Math.max(b.x - x, x - (b.x + b.w - 1), 0);
        if (Math.hypot(dx, dy) > r) continue;
        const i = y * w + x;
        const v = grid.soilContamination[i] ?? 0;
        if (v <= 0.005) continue;
        if (v > REMEDIATION_IDLE) worked = true;
        grid.soilContamination[i] = v * f;
      }
    }
    if (worked) active.push(b.uid);
  }
  return active;
}

/** Tiles of river / estuary within `steps` downstream (east, towards the sea) of a seed tile, with distance. */
function downstreamWater(grid: TileGrid, startX: number, startY: number, steps: number): Map<number, number> {
  const out = new Map<number, number>();
  const isWater = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) return false;
    const k = grid.kind[y * grid.w + x];
    return k === TileKind.River || k === TileKind.Estuary;
  };
  const queue: [number, number, number][] = [[startX, startY, 0]];
  out.set(startY * grid.w + startX, 0);
  for (let qi = 0; qi < queue.length; qi++) {
    const [x, y, d] = queue[qi] as [number, number, number];
    if (d >= steps) continue;
    for (const [dx, dy] of [[1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (!isWater(nx, ny)) continue;
      const ni = ny * grid.w + nx;
      if (out.has(ni)) continue;
      out.set(ni, d + 1);
      queue.push([nx, ny, d + 1]);
    }
  }
  return out;
}

/** Stormwater wetlands: strongest at the wetland, tapering over its surroundings and 12 tiles downstream. */
export const WETLAND_KEEP_SEASON = 0.955;
export const WETLAND_DOWNSTREAM_STEPS = 12;

export function applyWetlands(state: GameState, grid: TileGrid): void {
  const { w, h } = grid;
  for (const b of state.buildings) {
    if (!BUILDINGS[b.type].wetland) continue;
    const touched = new Map<number, number>(); // tile index -> filter strength 0..1
    const r = 3;
    for (let y = Math.max(0, b.y - r); y <= Math.min(h - 1, b.y + b.h - 1 + r); y++) {
      const dy = Math.max(b.y - y, y - (b.y + b.h - 1), 0);
      for (let x = Math.max(0, b.x - r); x <= Math.min(w - 1, b.x + b.w - 1 + r); x++) {
        const dx = Math.max(b.x - x, x - (b.x + b.w - 1), 0);
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        touched.set(y * w + x, 1 - d / (r + 1));
      }
    }
    // Water tiles right next to the wetland feed the downstream reach.
    for (const [i, s] of Array.from(touched.entries())) {
      const k = grid.kind[i];
      if (k !== TileKind.River && k !== TileKind.Estuary) continue;
      const sx = i % w, sy = Math.floor(i / w);
      for (const [j, d] of downstreamWater(grid, sx, sy, WETLAND_DOWNSTREAM_STEPS)) {
        const strength = s * (1 - d / (WETLAND_DOWNSTREAM_STEPS + 1));
        if (strength > (touched.get(j) ?? 0)) touched.set(j, strength);
      }
    }
    for (const [i, s] of touched) {
      const v = grid.waterPollution[i] ?? 0;
      grid.waterPollution[i] = v * (1 - (1 - WETLAND_KEEP_SEASON) * s);
    }
  }
}
