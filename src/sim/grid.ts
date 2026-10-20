import { CHUNK_SIZE } from './types';
import type { TileGrid } from './types';

export function createGrid(w: number, h: number): TileGrid {
  const n = w * h;
  return {
    w,
    h,
    kind: new Uint8Array(n),
    elevation: new Uint8Array(n),
    building: new Uint16Array(n),
    airPollution: new Float32Array(n),
    waterPollution: new Float32Array(n),
    soilContamination: new Float32Array(n),
    health: new Float32Array(n),
    stage: new Uint8Array(n),
    weed: new Uint8Array(n),
    chunkVersion: new Uint32Array(chunkCount(w, h)),
    significant: new Uint8Array(n),
    zone: new Uint8Array(n),
  };
}

/** Number of chunks wide / tall / total for a map. */
export const chunksWide = (w: number): number => Math.ceil(w / CHUNK_SIZE);
export const chunkCount = (w: number, h: number): number => chunksWide(w) * Math.ceil(h / CHUNK_SIZE);
export const chunkOf = (g: { w: number }, x: number, y: number): number =>
  Math.floor(y / CHUNK_SIZE) * chunksWide(g.w) + Math.floor(x / CHUNK_SIZE);

export function cloneGrid(g: TileGrid): TileGrid {
  return {
    w: g.w,
    h: g.h,
    kind: g.kind.slice(),
    elevation: g.elevation.slice(),
    building: g.building.slice(),
    airPollution: g.airPollution.slice(),
    waterPollution: g.waterPollution.slice(),
    soilContamination: g.soilContamination.slice(),
    health: g.health.slice(),
    stage: g.stage.slice(),
    weed: g.weed.slice(),
    chunkVersion: g.chunkVersion.slice(),
    significant: g.significant.slice(),
    zone: g.zone.slice(),
  };
}

export const idx = (g: { w: number }, x: number, y: number): number => y * g.w + x;
export const inBounds = (g: { w: number; h: number }, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < g.w && y < g.h;

