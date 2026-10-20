/**
 * Net Zero City (48x48): a coastal city on a harbour. Open ocean (with beaches) on the east, a deep harbour inlet in
 * the middle of the shore, a river that crosses the north of the city and meets the harbour through an estuary,
 * ranges along the west edge and a rocky headland either side of the harbour. Parks and remnant bush follow the river
 * corridor and the foothills. The city itself is placed by sim/prebuilt.ts.
 */
import type { ScenarioDef } from '../scenarios';
import { TileKind } from '../types';
import type { TileGrid } from '../types';
import { at, blob, carveRiver, clampi, distanceField, kit, line4, markSite, meander, plantBush, set } from './util';

export function generateCity(sc: ScenarioDef, seed: number): TileGrid {
  const k = kit(sc.mapW, sc.mapH, seed);
  const { w, h, grid } = k;

  // Shore: open coast on the east edge at x ~ 41, wobbling; harbour inlet near the middle.
  const shore: number[] = [];
  for (let y = 0; y < h; y++) shore.push(clampi(Math.round(w * 0.84 + (k.n1(0.5, y / 8) - 0.5) * 6), 36, w - 3));
  const harbourY = Math.round(h * 0.5);
  for (let y = 0; y < h; y++) {
    const inlet = Math.max(0, 7.5 - Math.abs(y - harbourY) * 1.15);
    shore[y] = Math.round((shore[y] ?? 0) - inlet * 2.2 - (k.n3(y / 3, 0.2) - 0.5) * 1.2 * (inlet > 0 ? 1 : 0));
  }
  for (let y = 0; y < h; y++) {
    const sx = shore[y] ?? w;
    for (let x = 0; x < w; x++) {
      if (x >= sx) set(k, x, y, TileKind.Sea, 0);
      else if (x === sx - 1) set(k, x, y, TileKind.Beach, 0);
      else {
        const west = Math.max(0, 7 - x);
        const e = 1 + (x < 10 ? 1 : 0) + (k.n2(x / 6, y / 6) > 0.62 ? 1 : 0) + (west > 3 ? 1 : 0);
        set(k, x, y, TileKind.Land, clampi(e, 1, 3));
      }
    }
  }
  // Ranges on the west edge and a northern ridge.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (grid.kind[i] !== TileKind.Land) continue;
      const v = 5.5 - x * 0.8 + (k.n3(x / 3, y / 3) - 0.5) * 3 + Math.max(0, 5 - y) * 0.5;
      if (v > 1.2) { grid.kind[i] = TileKind.Rock; grid.elevation[i] = 3; }
    }
  }
  // Rocky headlands either side of the harbour mouth.
  for (const hy of [harbourY - 11, harbourY + 11]) {
    for (let dy = -1; dy <= 1; dy++) for (let x = (shore[hy + dy] ?? w) - 4; x < (shore[hy + dy] ?? w); x++) {
      if (at(k, x, hy + dy) === TileKind.Land || at(k, x, hy + dy) === TileKind.Beach) set(k, x, hy + dy, TileKind.Rock, 2);
    }
  }
  // River: west edge, across the north half, into the harbour head.
  const harbourHead = (shore[harbourY] ?? 30) - 2;
  const ry = meander(k, h * 0.24, harbourY - 1, 3.2, 1.2, 1.0).map((v) => clampi(Math.round(v), 3, h - 4));
  const rx = harbourHead - 1;
  const riverYs = ry.slice(0, rx + 1);
  while (riverYs.length < w) riverYs.push(riverYs[riverYs.length - 1] ?? harbourY);
  const cut = riverYs.map((v) => v);
  for (let x = 0; x <= rx; x++) {
    const y = cut[x] ?? harbourY;
    const prev = x > 0 ? cut[x - 1] ?? y : y;
    const a = Math.min(prev, y), b = Math.max(prev, y);
    for (let yy = a; yy <= b; yy++) set(k, x, yy, x > rx - 5 ? TileKind.Estuary : TileKind.River, 0);
    if (x > rx - 5) { set(k, x, a - 1, TileKind.Estuary, 0); set(k, x, b + 1, TileKind.Estuary, 0); }
  }
  // Estuary meets the harbour.
  line4(k, rx, cut[rx] ?? harbourY, harbourHead + 1, harbourY, TileKind.Estuary, 0);
  void carveRiver;
  // Floodplain beside the river is low.
  const dRiver = distanceField(k, (kind) => kind === TileKind.River || kind === TileKind.Estuary);
  for (let i = 0; i < w * h; i++) {
    if (grid.kind[i] === TileKind.Land && (dRiver[i] ?? 9) <= 2.5) grid.elevation[i] = 1;
  }
  // Parks and remnant bush: along the river corridor, the foothills and the headlands.
  plantBush(k, sc.terrain.bushCover, (x, y) => {
    const i = y * w + x;
    return ((dRiver[i] ?? 9) < 4 ? 0.5 : 0) + (x < 10 ? 0.35 : 0) + k.n2(x / 5, y / 5) * 0.55;
  });
  // A couple of larger wetlands for the estuary edge (saltmarsh flats) north and south of the river mouth.
  blob(k, harbourHead - 3, (cut[rx] ?? harbourY) - 4, 2.2, 1.4, TileKind.Estuary, 0, (kind) => kind === TileKind.Land || kind === TileKind.Bush);

  markSite(k, harbourHead - 8, (cut[Math.max(0, rx - 8)] ?? 20) - 4, 1);
  markSite(k, 12, h * 0.6, 2);
  markSite(k, harbourHead - 4, harbourY + 10, 3);
  return grid;
}
