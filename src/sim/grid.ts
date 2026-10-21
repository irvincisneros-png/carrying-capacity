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

/**
 * Square (Chebyshev) dilation: out[i] = 1 where `mask` is non-zero anywhere within `r` tiles of tile i. Two sliding-window passes,
 * so it costs O(tiles) whatever `r` is (the neighbourhood loops it replaces cost O(tiles x (2r+1)^2) and dominated a season's
 * simulation on the big maps).
 */
export function dilate(mask: ArrayLike<number>, w: number, h: number, r: number): Uint8Array {
  const rows = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let count = 0;
    const base = y * w;
    for (let x = 0; x < Math.min(w, r); x++) if (mask[base + x]) count++;
    for (let x = 0; x < w; x++) {
      if (x + r < w && mask[base + x + r]) count++;
      if (x - r - 1 >= 0 && mask[base + x - r - 1]) count--;
      if (count > 0) rows[base + x] = 1;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = 0; y < Math.min(h, r); y++) if (rows[y * w + x]) count++;
    for (let y = 0; y < h; y++) {
      if (y + r < h && rows[(y + r) * w + x]) count++;
      if (y - r - 1 >= 0 && rows[(y - r - 1) * w + x]) count--;
      if (count > 0) out[y * w + x] = 1;
    }
  }
  return out;
}

export const idx = (g: { w: number }, x: number, y: number): number => y * g.w + x;
export const inBounds = (g: { w: number; h: number }, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < g.w && y < g.h;

