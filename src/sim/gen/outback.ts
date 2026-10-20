/**
 * Red Dirt (32x32): red plains under a low range along the north, a dry creek that runs after rain, a permanent
 * waterhole on its middle bend, scattered mulga, and two old open-cut pits at the foot of the range. Pit tiles are
 * marked zone 1 (the mine site) and ringed by rock spoil, so a mine can be worked beside them.
 */
import type { ScenarioDef } from '../scenarios';
import { TileKind } from '../types';
import type { TileGrid } from '../types';
import { at, blob, carveRiver, clampi, distanceField, kit, markSite, meander, plantBush, set } from './util';

export function generateOutback(sc: ScenarioDef, seed: number): TileGrid {
  const k = kit(sc.mapW, sc.mapH, seed);
  const { w, h, grid } = k;
  for (let i = 0; i < w * h; i++) { grid.kind[i] = TileKind.Land; grid.elevation[i] = 1; }

  // The range: a rocky band along the north, rising to the north-west, and a low rise in the south-west.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const ridge = 3.4 + (k.n1(x / 6, 0.5) - 0.5) * 4.2 - x * 0.05;
      const north = ridge - y;
      const sw = 4.6 - Math.hypot((x - 1) * 0.9, y - (h - 2));
      const v = Math.max(north, sw) + (k.n2(x / 2.4, y / 2.4) - 0.5) * 1.3;
      if (v > 1.7) { grid.kind[i] = TileKind.Rock; grid.elevation[i] = 3; }
      else if (v > 0) grid.elevation[i] = 2;
      else if (k.n3(x / 5, y / 5) > 0.68) grid.elevation[i] = 2;
    }
  }
  // Dry creek from the range to the east edge.
  const cy = meander(k, 7, 21, 3.5, 1.3, 1.0).map((v, x) => clampi(Math.round(v), 4, h - 4) + (x < 3 ? 1 : 0));
  carveRiver(k, cy, () => 0, TileKind.River, 0);
  // Waterhole: a permanent pool on the middle bend.
  const hx = Math.round(w * 0.46);
  const hy = (cy[hx] ?? 14) + 2;
  blob(k, hx, hy, 2.2, 1.4, TileKind.Wetland, 0, (kind) => kind !== TileKind.Rock);

  // Pits: the main open cut near the foot of the range (north-east), and a smaller old one (south).
  const pit = (px: number, py: number, rx: number, ry: number): void => {
    const tiles = blob(k, px, py, rx, ry, TileKind.Pit, 0, (kind) => kind !== TileKind.River && kind !== TileKind.Wetland);
    for (const i of tiles) { grid.zone[i] = 1; grid.stage[i] = 0; }
    // Rock spoil ring around the rim.
    for (const i of tiles) {
      const x = i % w, y = Math.floor(i / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (grid.kind[j] === TileKind.Land && k.n3(xx * 0.9, yy * 0.9) > 0.42) { grid.kind[j] = TileKind.Rock; grid.elevation[j] = 2; }
      }
    }
  };
  pit(w * 0.76, h * 0.3, 4.6, 3.2);
  pit(w * 0.3, h * 0.72, 2.3, 1.6);

  // Mulga and spinifex: clustered along the creek and the foothills.
  const dWater = distanceField(k, (kind) => kind === TileKind.River || kind === TileKind.Wetland);
  plantBush(k, sc.terrain.bushCover, (x, y) => {
    const i = y * w + x;
    return ((dWater[i] ?? 9) < 4 ? 0.5 : 0) + k.n2(x / 4, y / 4) * 0.5 + (grid.elevation[i] === 2 ? 0.2 : 0);
  });
  // Keep a belt of open ground beside the waterhole for the town.
  for (let y = hy - 4; y <= hy + 5; y++) for (let x = hx - 6; x <= hx + 6; x++) if (x >= 0 && y >= 0 && x < w && y < h && at(k, x, y) === TileKind.Bush && Math.hypot(x - hx, y - hy) < 6) set(k, x, y, TileKind.Land);

  markSite(k, hx - 3, hy + 2, 1);
  markSite(k, w * 0.35, 7, 2, (x, y) => (grid.elevation[y * w + x] ?? 0) >= 2);
  markSite(k, w * 0.86, (cy[Math.round(w * 0.86)] ?? 18) + 3, 3);
  return grid;
}
