/**
 * Reef Island (32x32): a small tropical island with a ring of beach, a rainforest-covered core, a mangrove inlet on the
 * sheltered north-west side, rocky headlands on the windward south-east side and a broad fringing reef with a boat
 * pass. The low coastal belt (elevation 1) on the lee side is where a town naturally grows, a metre or so above the tide.
 */
import type { ScenarioDef } from '../scenarios';
import { TileKind } from '../types';
import type { TileGrid } from '../types';
import { at, distanceField, kit, markSite, plantBush, set } from './util';

export function generateIsland(sc: ScenarioDef, seed: number): TileGrid {
  const k = kit(sc.mapW, sc.mapH, seed);
  const { w, h, grid } = k;
  const cx = w * 0.47, cy = h * 0.47;
  const rx = w * 0.35, ry = h * 0.255;
  const ang = -0.45;
  const ca = Math.cos(ang), sa = Math.sin(ang);

  // Land mask: a noise-warped, tilted ellipse.
  const land = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
      const f = Math.hypot(u, v) + (k.n1(x / 5, y / 5) - 0.5) * 0.55 + (k.n2(x / 2.2, y / 2.2) - 0.5) * 0.18;
      land[y * w + x] = f < 1 ? 1 : 0;
    }
  }
  // Depth from the coast: 1 = coastal tile, 2 = next one in, ...
  const depth = new Uint8Array(w * h);
  const isLand = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && land[y * w + x] === 1;
  for (let pass = 1; pass <= 12; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (land[i] !== 1 || depth[i] !== 0) continue;
        const edge = pass === 1
          ? !(isLand(x + 1, y) && isLand(x - 1, y) && isLand(x, y + 1) && isLand(x, y - 1))
          : [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (depth[(y + (dy ?? 0)) * w + x + (dx ?? 0)] ?? 0) === pass - 1 && isLand(x + (dx ?? 0), y + (dy ?? 0)));
        if (edge) depth[i] = pass;
      }
    }
  }
  // Windward = south-east: rocky headlands there.
  const windward = (x: number, y: number): number => ((x - cx) * 0.7 + (y - cy) * 0.7) / (rx * 0.9);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (land[i] !== 1) { grid.kind[i] = TileKind.Sea; grid.elevation[i] = 0; continue; }
      const dep = depth[i] ?? 1;
      if (dep === 1) {
        const rocky = windward(x, y) > 0.45 && k.n3(x / 2.5, y / 2.5) > 0.5;
        if (rocky) { grid.kind[i] = TileKind.Rock; grid.elevation[i] = 2; }
        else { grid.kind[i] = TileKind.Beach; grid.elevation[i] = 0; }
      } else {
        grid.kind[i] = TileKind.Land;
        const hill = dep >= 5 || (dep >= 4 && k.n2(x / 3, y / 3) > 0.6);
        grid.elevation[i] = hill ? 3 : dep >= 3 ? 2 : 1;
      }
    }
  }
  // Rock outcrops in the high core.
  for (let i = 0; i < w * h; i++) {
    const x = i % w, y = Math.floor(i / w);
    if (grid.kind[i] === TileKind.Land && grid.elevation[i] === 3 && k.n3(x / 2, y / 2) > 0.7) grid.kind[i] = TileKind.Rock;
  }

  // Lee-side mangrove inlet: pick the coastal beach tile furthest from the windward side and carve inwards.
  let mouth = -1;
  let worst = Infinity;
  for (let i = 0; i < w * h; i++) {
    if (grid.kind[i] !== TileKind.Beach) continue;
    const x = i % w, y = Math.floor(i / w);
    const v = windward(x, y);
    if (v < worst && isLand(x, y + 3) && isLand(x + 3, y) ) { worst = v; mouth = i; }
  }
  const mx = mouth % w, my = Math.floor(mouth / w);
  // Direction inland: towards the island centre, snapped to a cardinal axis.
  const toC = { x: cx - mx, y: cy - my };
  const stepX = Math.abs(toC.x) >= Math.abs(toC.y) ? Math.sign(toC.x) : 0;
  const stepY = stepX === 0 ? Math.sign(toC.y) : 0;
  const mangrove: number[] = [];
  for (let s = 0; s < 6; s++) {
    for (let wdt = 0; wdt < 2; wdt++) {
      const x = mx + stepX * s + (stepY !== 0 ? wdt : 0), y = my + stepY * s + (stepX !== 0 ? wdt : 0);
      if (!isLand(x, y) && s > 0) continue;
      set(k, x, y, TileKind.Estuary, 0);
      mangrove.push(y * w + x);
    }
  }
  // Mangrove fringe: a few more estuary tiles on each side of the mouth.
  for (const i of [...mangrove]) {
    const x = i % w, y = Math.floor(i / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + dx, yy = y + dy;
      if (!isLand(xx, yy) || at(k, xx, yy) === TileKind.Estuary) continue;
      if (grid.kind[yy * w + xx] === TileKind.Beach && k.n1(xx * 1.3, yy * 1.3) > 0.4) set(k, xx, yy, TileKind.Estuary, 0);
    }
  }

  // Reef: a fringing band 3..5.5 tiles off the coast, with a boat pass in front of the inlet, plus patch reefs further out.
  const dLand = distanceField(k, (kind) => kind !== TileKind.Sea && kind !== TileKind.Reef);
  const toMouth = (x: number, y: number): number => Math.hypot(x - mx, y - my);
  for (let i = 0; i < w * h; i++) {
    if (grid.kind[i] !== TileKind.Sea) continue;
    const x = i % w, y = Math.floor(i / w);
    const d = dLand[i] ?? 99;
    const wob = (k.n1(x / 3, y / 3) - 0.5) * 1.6;
    const inBand = d + wob >= 3 && d + wob <= 5.6;
    const pass = toMouth(x, y) < 6.5;
    if (inBand && !pass) grid.kind[i] = TileKind.Reef;
  }
  for (let p = 0; p < 4; p++) {
    const ang2 = k.rng.next() * Math.PI * 2;
    const rr = 10 + k.rng.next() * 3;
    const px = cx + Math.cos(ang2) * rr * 1.25, py = cy + Math.sin(ang2) * rr * 0.9;
    for (let y = Math.floor(py - 2); y <= Math.ceil(py + 2); y++) {
      for (let x = Math.floor(px - 2); x <= Math.ceil(px + 2); x++) {
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1 || at(k, x, y) !== TileKind.Sea) continue;
        if (Math.hypot(x - px, y - py) + (k.n3(x / 1.7, y / 1.7) - 0.5) * 1.4 < 1.8) set(k, x, y, TileKind.Reef, 0);
      }
    }
  }

  // Rainforest cover: the core first, with the low lee-side belt left open for the town.
  plantBush(k, sc.terrain.bushCover, (x, y) => {
    const i = y * w + x;
    const interior = Math.min(1, (depth[i] ?? 1) / 6);
    const lee = Math.max(0, -windward(x, y));
    return interior * 0.7 + k.n2(x / 3.5, y / 3.5) * 0.35 - (grid.elevation[i] === 1 ? 0.18 * lee : 0);
  });

  // Significant places: the mangrove bank, the high ground, the windward back-beach.
  markSite(k, mx - stepX * 3, my + 3, 1);
  markSite(k, cx, cy, 2, (x, y) => (grid.elevation[y * w + x] ?? 0) >= 2);
  markSite(k, cx + rx * 0.7, cy + ry * 0.7, 3);
  return grid;
}
