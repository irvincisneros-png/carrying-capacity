/**
 * How much more land the scripted players have to restore on the enlarged maps. The scripts were written for the
 * original sizes (green-valley 16x16, coal-coast / river-town / red-dirt / reef-island 32x32); the maps are now 32x32 and 64x64
 * (net-zero-city 72x72). The town a script builds is limited by money, not by space, so Act 1 and the energy build-out are
 * unchanged. What grows with the map is the restoration work, but on Coal Coast it barely matters how many nurseries go in
 * (natural spread from the bush covers the land: 10 to 40 nurseries end at the same mean health), so these counts stay at the
 * round 5 factor instead of tracking the area. Red Dirt's script already places as many nurseries as its pit needs
 * (tests/helpers/outback.ts); River Town (3 bank nurseries) and Reef Island (6 coral nurseries) keep fixed counts and still win,
 * because the river's bank clearing is measured against the original map's river length and the reef's nursery boost was raised
 * for the larger reef (HANDOVER.md, "Map sizes").
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
