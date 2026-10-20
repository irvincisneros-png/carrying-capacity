/**
 * How much more land the scripted players have to restore on the enlarged maps. The scripts were written for the
 * original sizes (green-valley 16x16, coal-coast / river-town / red-dirt / reef-island 32x32). The town a script builds
 * is limited by money, not by space, so Act 1 and the energy build-out are unchanged; what grows with the map is the
 * restoration work (nurseries, plantings), so those counts are multiplied by the extra land the scenario gained.
 */
import type { ScenarioId } from '../../src/sim';

export const MAP_K: Record<ScenarioId, number> = {
  'green-valley': 1.5,
  'coal-coast': 1.5,
  'river-town': 1.5,
  'reef-island': 1.5,
  'red-dirt': 1.5,
  'net-zero-city': 1,
};

/** n scaled by the map factor, never below 1 for a positive n. */
export const kScale = (id: ScenarioId, n: number): number => (n > 0 ? Math.max(1, Math.round(n * MAP_K[id])) : 0);
