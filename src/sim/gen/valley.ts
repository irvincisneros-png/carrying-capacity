/**
 * Green Valley (16x16): a small inland valley. Hills close the north-east and south-west corners; a creek rises on the
 * west edge, fills a farm dam (wetland) in the middle and leaves through the south-east. Gentle slopes (elevation 2)
 * run along both sides of the floor, so a wind turbine has a ridge and a hydro dam has a drop.
 */
import type { ScenarioDef } from '../scenarios';
import { TileKind } from '../types';
import type { TileGrid } from '../types';
import { at, carveRiver, clampi, kit, markSite, plantBush, set } from './util';

export function generateValley(sc: ScenarioDef, seed: number): TileGrid {
  const k = kit(sc.mapW, sc.mapH, seed);
  const { w, h, grid } = k;

  // Creek centre line: west edge (row ~4) to the south-east (row ~10).
  const phase = k.rng.next() * 2;
  const creekY: number[] = [];
  for (let x = 0; x < w; x++) {
    const t = x / (w - 1);
    creekY.push(clampi(Math.round(4 + 6 * t + Math.sin(t * 5 + phase) * 1.4 + (k.n1(x / 4, 1.3) - 0.5) * 1.6), 2, h - 3));
  }
  // Floor and slopes: height grows with distance from the creek line.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.abs(y - (creekY[x] ?? y));
      const e = 1 + Math.floor((d + (k.n2(x / 3, y / 3) - 0.5) * 3.2) / 3.6);
      set(k, x, y, TileKind.Land, clampi(e, 1, 3));
    }
  }
  // Hills of bare rock where the ground is highest, so a coal seam (rock beside the workings) can be reached.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((grid.elevation[y * w + x] ?? 0) >= 3 && k.n3(x / 2.4, y / 2.4) > 0.42) set(k, x, y, TileKind.Rock, 3);
    }
  }
  // The creek, one tile wide, with a dam (two extra wetland tiles each side) in the middle.
  carveRiver(k, creekY, () => 0, TileKind.River, 0);
  const damX = Math.round(w * 0.5);
  for (let x = damX - 1; x <= damX + 1; x++) {
    const y = creekY[x] ?? 0;
    for (const yy of [y - 1, y + 1]) if (yy > 0 && yy < h - 1 && at(k, x, yy) !== TileKind.River) set(k, x, yy, TileKind.Wetland, 0);
  }
  // Banks are low, so the creek can flood a little.
  for (let x = 0; x < w; x++) {
    const y = creekY[x] ?? 0;
    for (const yy of [y - 1, y + 1]) if (yy >= 0 && yy < h && at(k, x, yy) === TileKind.Land) grid.elevation[yy * w + x] = 1;
  }
  plantBush(k, sc.terrain.bushCover, (x, y) => {
    const d = Math.abs(y - (creekY[x] ?? y));
    return k.n1(x / 3.5, y / 3.5) * 0.7 + (d > 5 ? 0.22 : 0) + (y < 4 ? 0.1 : 0);
  });
  // Open pasture on the lower floor, so the first houses have room without clearing bush.
  for (let x = 2; x < 9; x++) {
    const cy = creekY[x] ?? 0;
    for (let y = cy + 1; y <= cy + 3 && y < h - 1; y++) if (at(k, x, y) === TileKind.Bush) set(k, x, y, TileKind.Land);
  }
  markSite(k, damX + 2, (creekY[damX] ?? 8) - 3, 1);
  return grid;
}
