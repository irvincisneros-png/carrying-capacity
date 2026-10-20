import { makeNoise2D, mulberry32 } from './rng';
import type { ScenarioDef } from './scenarios';
import { TileKind } from './types';
import type { TileGrid } from './types';
import { createGrid } from './grid';
import { generateCity } from './gen/city';
import { generateIsland } from './gen/island';
import { generateOutback } from './gen/outback';
import { generateRiver } from './gen/river';
import { generateValley } from './gen/valley';

export { createGrid, chunksWide, chunkCount, chunkOf, cloneGrid, idx, inBounds } from './grid';

/**
 * Seeded terrain generation. Deterministic for (scenario params, seed). The terrain kind picks the generator:
 * coast (Coal Coast), valley (Green Valley), river (River Town), island (Reef Island), outback (Red Dirt), city (Net Zero City).
 */
export function generateTerrain(scenario: ScenarioDef, seed: number): TileGrid {
  switch (scenario.terrain.kind) {
    case 'valley': return generateValley(scenario, seed);
    case 'river': return generateRiver(scenario, seed);
    case 'island': return generateIsland(scenario, seed);
    case 'outback': return generateOutback(scenario, seed);
    case 'city': return generateCity(scenario, seed);
    default: return generateCoast(scenario, seed);
  }
}

function generateCoast(scenario: ScenarioDef, seed: number): TileGrid {
  const { mapW: w, mapH: h, terrain: p } = scenario;
  // Linear scale of the map against the original 32x32 coast: sizes in tiles (headland, reef, river mouth) follow it.
  const f = Math.min(w, h) / 32;
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
    for (let x = cx - Math.round(3 * f); x < cx; x++) {
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
    const nearMouth = x >= cx - Math.round(2 * f);
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
        if (d <= p.reefRadius * f + (nElev(x / 2, y / 2) - 0.5)) kind[i] = TileKind.Reef;
      }
    }
  }
  markSignificant(grid);
  return grid;
}

/** Number of significant-site clusters markSignificant() lays down. */
export const SIGNIFICANT_CLUSTERS = 3;

/**
 * Marks a few places of cultural significance (cluster ids 1..3) from the terrain alone, so older saves can be
 * migrated by recomputing it. 1: the bank upstream of the estuary; 2: the foot of the escarpment; 3: the flat
 * behind the beach south of the river. Each is a 3x3 patch of buildable ground.
 */
export function markSignificant(grid: TileGrid): void {
  const { w, h, kind } = grid;
  const f = Math.min(w, h) / 32;
  grid.significant.fill(0);
  const open = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const k = kind[y * w + x];
    return k === TileKind.Land || k === TileKind.Bush;
  };
  const nearest = (tx: number, ty: number, accept: (x: number, y: number) => boolean): [number, number] | null => {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (!accept(x, y)) continue;
        const d = Math.hypot(x - tx, y - ty);
        if (d < bd) { bd = d; best = [x, y]; }
      }
    }
    return best;
  };
  const kindAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? -1 : kind[y * w + x] ?? -1);
  const mark = (c: [number, number] | null, id: number): void => {
    if (!c) return;
    for (let y = c[1] - 1; y <= c[1] + 1; y++) {
      for (let x = c[0] - 1; x <= c[0] + 1; x++) {
        if (open(x, y) && grid.significant[y * w + x] === 0) grid.significant[y * w + x] = id;
      }
    }
  };
  // 1. Upstream bank: land two tiles north of the westmost estuary tile.
  let ex = w, ey = Math.floor(h / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (kind[y * w + x] === TileKind.Estuary && x < ex) { ex = x; ey = y; }
  mark(nearest(ex - 2, ey - 3, (x, y) => open(x, y) && open(x - 1, y) && open(x + 1, y) && open(x, y - 1) && open(x, y + 1)), 1);
  // 2. Foot of the escarpment, north of the river.
  mark(nearest(Math.round(4 * f), h * 0.3, (x, y) => open(x, y) && open(x, y - 1) && open(x, y + 1) && open(x + 1, y) && kindAt(x - 1, y) === TileKind.Rock), 2);
  // 3. Flat behind the beach, south of the river.
  mark(nearest(w - Math.round(8 * f), h * 0.8, (x, y) => open(x, y) && open(x - 1, y) && open(x, y - 1) && open(x, y + 1) && kindAt(x + 2, y) === TileKind.Beach), 3);
}

export function countKind(g: TileGrid, k: number): number {
  let n = 0;
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === k) n++;
  return n;
}
