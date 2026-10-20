/** Net Zero City (pure reads): public transport coverage and how it trims car emissions. */
import { clamp01 } from './flags';
import type { GameState } from '../types';

export const CITY = {
  /** People one transit line serves. */
  lineCapacity: 900,
  maxCarCut: 0.7,
} as const;

export function transitCoverage(s: GameState): number {
  let n = 0;
  for (const b of s.buildings) if (b.type === 'transitline') n++;
  return clamp01((n * CITY.lineCapacity) / Math.max(1, s.population));
}

/** Multiplier on a car-related building's emissions. */
export function carEmissionFactor(s: GameState): number {
  return 1 - CITY.maxCarCut * transitCoverage(s);
}
