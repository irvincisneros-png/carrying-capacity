import { mulberry32 } from './rng';
import type { Rng } from './rng';
import type { GameState, Season } from './types';
import { getScenario } from './scenarios';

/** Micro-seasons per season: dtYears is converted to this integer fixed-point so tick() splits identically. */
export const MICRO = 1_000_000;
export const SEASONS_PER_YEAR = 4;

/** Absolute season counter since the scenario's start year (summer = first season of each year). */
export function seasonIndexOf(state: GameState): number {
  return (state.year - getScenario(state.scenarioId).startYear) * SEASONS_PER_YEAR + state.a2.season;
}

/** Fractional calendar year, for display (e.g. 2031.5 = midway through). */
export function yearFraction(state: GameState): number {
  return state.year + (state.a2.season + state.a2.clockMicro / MICRO) / SEASONS_PER_YEAR;
}

/** 32-bit mix of integers; stable across platforms (Math.imul only). */
export function hash32(...parts: number[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    h = Math.imul(h ^ (p | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}

/**
 * Independent deterministic stream for (seed, season, salt). Everything random in Act 2 draws from one of these,
 * so results depend only on the seed and the season number - never on frame rate or call order.
 */
export function seasonRng(seed: number, seasonIndex: number, salt: number): Rng {
  return mulberry32(hash32(seed, seasonIndex, salt));
}

/** Seasonal weather multipliers for a season: mean about 1, deterministic. */
export interface Weather {
  wind: number;
  cloud: number;
  /** Rain relative to normal for the season (before drought). */
  rain: number;
}

export function seasonWeather(seed: number, seasonIndex: number): Weather {
  const r = seasonRng(seed, seasonIndex, 9001);
  return {
    wind: 0.6 + r.next() * 0.8,
    cloud: 0.82 + r.next() * 0.18,
    rain: 0.7 + r.next() * 0.6,
  };
}

export const asSeason = (n: number): Season => (((n % 4) + 4) % 4) as Season;
