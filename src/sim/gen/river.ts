/**
 * River Town (64x64): a wide, meandering inland river crossing the map from the north-west to the south-east. A broad
 * floodplain (elevation 1) of river red gum woodland lines both banks, with billabongs (wetland) in old oxbows. Open
 * plains (elevation 2) beyond the floodplain are the farmland. Low ranges close the north-east and south-west corners.
 * A weir (River tiles raised to elevation 1) crosses the river upstream of the town reach.
 */
import type { ScenarioDef } from '../scenarios';
import { TileKind } from '../types';
import type { TileGrid } from '../types';
import { at, blob, carveRiver, clampi, distanceField, kit, markSite, meander, plantBush, set } from './util';

export function generateRiver(sc: ScenarioDef, seed: number): TileGrid {
  const k = kit(sc.mapW, sc.mapH, seed);
  const { w, h, grid } = k;
  /** Linear scale against the original 32x32 map: reaches, floodplain, ranges and billabongs grow with it. */
  const s = Math.min(w, h) / 32;

  const cy = meander(k, h * 0.26, h * 0.7, h * 0.15, 2.2, 1.2 * s).map((v) => clampi(Math.round(v), 5, h - 6));
  for (let i = 0; i < w * h; i++) grid.kind[i] = TileKind.Land;
  carveRiver(k, cy, (x) => (x > 3 && x < w - 3 ? 1 : 1), TileKind.River, 0);

  const d = distanceField(k, (kind) => kind === TileKind.River);
  // Floodplain width varies along the river; the narrow reaches are cut banks with the plain right at the water.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (grid.kind[i] !== TileKind.Land) continue;
      const fp = (1.8 + 4.4 * k.n1(x / (7 * s), y / (7 * s) + 2)) * s;
      grid.elevation[i] = (d[i] ?? 9) <= fp ? 1 : 2;
    }
  }
  // Ranges: north-east and south-west corners.
  const range = (cx: number, cyy: number, rx: number, ry: number): void => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (grid.kind[i] === TileKind.River) continue;
        const dd = Math.hypot((x - cx) / rx, (y - cyy) / ry) + (k.n3(x / 3, y / 3) - 0.5) * 0.5;
        if (dd < 0.55) { grid.kind[i] = TileKind.Rock; grid.elevation[i] = 3; }
        else if (dd < 1.0 && grid.kind[i] === TileKind.Land) grid.elevation[i] = (d[i] ?? 9) <= 1.5 ? 1 : 3;
      }
    }
  };
  range(w - 1, 1, 9 * s, 7 * s);
  range(0, h - 1, 6 * s, 6 * s);

  // Weir across the river upstream of the middle of the map.
  const wx = Math.round(w * 0.58);
  for (let y = 0; y < h; y++) if (at(k, wx, y) === TileKind.River) grid.elevation[y * w + wx] = 1;

  // Red gum woodland on the floodplain, mallee and open plains beyond: bush score falls off with distance.
  plantBush(k, sc.terrain.bushCover, (x, y) => {
    const i = y * w + x;
    const near = (d[i] ?? 9) <= 6 * s ? 0.55 : 0;
    return near + k.n2(x / 5.5, y / 5.5) * 0.55 + (grid.elevation[i] === 3 ? 0.2 : 0);
  });

  // Billabongs: small separate waterbodies in old oxbows on the floodplain, plus one larger swamp.
  const sites: { x: number; y: number; big: boolean }[] = [];
  const want = Math.round(6 * s * s);
  for (let tries = 0; sites.length < want && tries < 400; tries++) {
    const x = k.rng.int(3, w - 4), y = k.rng.int(3, h - 4);
    const i = y * w + x;
    const dd = d[i] ?? 9;
    if (dd < 3 * s || dd > 6.5 * s || grid.elevation[i] !== 1 || grid.kind[i] === TileKind.Rock || grid.kind[i] === TileKind.River) continue;
    if (sites.some((q) => Math.hypot(q.x - x, q.y - y) < 6 * s)) continue;
    sites.push({ x, y, big: sites.length === 0 });
  }
  for (const b of sites) {
    const tiles = b.big ? blob(k, b.x, b.y, 2.6 * s, 1.6 * s, TileKind.Wetland, 0, (kind) => kind !== TileKind.River && kind !== TileKind.Rock)
      : blob(k, b.x, b.y, 1.6 * s, 1.0 * s, TileKind.Wetland, 0, (kind) => kind !== TileKind.River && kind !== TileKind.Rock);
    void tiles;
  }

  // Significant places: beside the big billabong, a red gum bend on the west reach, a rise on the plain by the hills.
  const big = sites[0];
  if (big) markSite(k, big.x, big.y - 3, 1);
  markSite(k, w * 0.2, (cy[Math.round(w * 0.2)] ?? 10) + Math.round(4 * s), 2);
  markSite(k, w * 0.78, h * 0.42, 3, (x, y) => (grid.elevation[y * w + x] ?? 0) >= 2);
  return grid;
}
