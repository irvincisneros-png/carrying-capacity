import { BUILDINGS } from './buildings';
import type { PlacedBuilding, TileGrid } from './types';

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
