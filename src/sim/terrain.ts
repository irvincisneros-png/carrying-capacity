import { makeNoise2D, mulberry32 } from './rng';
import type { ScenarioDef } from './scenarios';
import { CHUNK_SIZE, TileKind } from './types';
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
  };
}

export const idx = (g: { w: number }, x: number, y: number): number => y * g.w + x;
export const inBounds = (g: { w: number; h: number }, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < g.w && y < g.h;

/**
 * Seeded terrain generation. Deterministic for (scenario params, seed).
 * TODO: valley / river / island / outback / city kinds currently reuse the coast generator.
 */
export function generateTerrain(scenario: ScenarioDef, seed: number): TileGrid {
  const { mapW: w, mapH: h, terrain: p } = scenario;
  const rng = mulberry32(seed);
  const nCoast = makeNoise2D(rng);
  const nEsc = makeNoise2D(rng);
  const nElev = makeNoise2D(rng);
  const nBush = makeNoise2D(rng);
  const grid = createGrid(w, h);
  const { kind, elevation } = grid;

  const seaCols = Math.max(1, Math.round(w * p.seaFrac));
  const coastX: number[] = [];
  const escW: number[] = [];
  for (let y = 0; y < h; y++) {
    const wob = (nCoast(0.5, y / (h / 5)) - 0.5) * 2 * w * p.coastWobble;
    coastX.push(Math.max(4, Math.min(w - 1, Math.round(w - seaCols + wob))));
    const ew = (nEsc(3.5, y / (h / 6)) - 0.5) * w * 0.08;
    escW.push(Math.max(2, Math.round(w * p.escarpmentFrac + ew)));
  }

  // Base land / sea / beach / escarpment.
  for (let y = 0; y < h; y++) {
    const cx = coastX[y] ?? w - 1;
    const ew = escW[y] ?? 2;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x >= cx) {
        kind[i] = TileKind.Sea;
        elevation[i] = 0;
      } else if (x === cx - 1) {
        kind[i] = TileKind.Beach;
        elevation[i] = 0;
      } else if (x < ew) {
        kind[i] = TileKind.Rock;
        elevation[i] = 3;
      } else {
        kind[i] = TileKind.Land;
        const t = (cx - 1 - x) / Math.max(1, cx - 1 - ew);
        const e = Math.round(t * 2.4 + (nElev(x / 5, y / 5) - 0.5) * 1.6);
        elevation[i] = Math.max(1, Math.min(2, e));
      }
    }
  }

  // Sandstone headland jutting into the sea (north of the river).
  const riverRow = Math.max(2, Math.min(h - 3, Math.round(h * p.riverRowFrac)));
  const headRow = Math.max(1, Math.min(h - 3, Math.round(h * 0.2 + rng.int(0, Math.max(1, Math.round(h * 0.08))))));
  for (let y = headRow; y < Math.min(h, headRow + Math.max(2, Math.round(h / 12))); y++) {
    const cx = coastX[y] ?? w - 1;
    for (let x = cx - 3; x < cx; x++) {
      if (x < 0) continue;
      const i = y * w + x;
      kind[i] = TileKind.Rock;
      elevation[i] = 2;
    }
  }

  // River meandering west -> estuary.
  let ry = riverRow;
  for (let x = 0; x < w; x++) {
    const cx = coastX[ry] ?? w - 1;
    if (x >= cx) break;
    const nearMouth = x >= cx - 2;
    const set = (yy: number): void => {
      const i = yy * w + x;
      kind[i] = nearMouth ? TileKind.Estuary : TileKind.River;
      elevation[i] = 0;
    };
    set(ry);
    if (nearMouth) {
      // Widen the estuary slightly.
      if (ry > 0) set(ry - 1);
      if (ry < h - 1) set(ry + 1);
    } else {
      const r = rng.next();
      const dy = r < 0.3 ? -1 : r < 0.6 ? 1 : 0;
      const ny = Math.max(2, Math.min(h - 3, ry + dy));
      if (ny !== ry) {
        ry = ny;
        set(ry);
      }
    }
  }

  // Bushland: noise-ranked so clearings are contiguous and cover is exact.
  const candidates: { i: number; v: number }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (kind[i] === TileKind.Land) candidates.push({ i, v: nBush(x / 4.5, y / 4.5) + (rng.next() - 0.5) * 0.05 });
    }
  }
  candidates.sort((a, b) => b.v - a.v || a.i - b.i);
  const bushCount = Math.round(candidates.length * p.bushCover);
  for (let k = 0; k < bushCount; k++) {
    const c = candidates[k];
    if (c) kind[c.i] = TileKind.Bush;
  }

  // Offshore reef patch.
  if (p.reefRadius > 0) {
    const reefRow = Math.max(1, Math.min(h - 2, riverRow + Math.round(h * 0.2)));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (kind[i] !== TileKind.Sea) continue;
        const cx = coastX[reefRow] ?? w - 1;
        const reefX = Math.min(w - 2, cx + Math.max(2, Math.round(seaCols * 0.5)));
        const d = Math.hypot((x - reefX) * 0.9, y - reefRow);
        if (d <= p.reefRadius + (nElev(x / 2, y / 2) - 0.5)) kind[i] = TileKind.Reef;
      }
    }
  }
  return grid;
}

export function countKind(g: TileGrid, k: number): number {
  let n = 0;
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === k) n++;
  return n;
}
