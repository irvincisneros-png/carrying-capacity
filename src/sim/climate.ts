import { PRE_INDUSTRIAL_CO2, realCO2 } from './realData';

/** Transient climate response, degrees C per doubling of CO2 (simplified; see teacher panel). */
export const DEGREES_PER_DOUBLING = 1.8;
export const M_MIN = 0.4;
export const M_MAX = 1.6;

/**
 * Reference "typical industrialising town": kt CO2-e emitted in the decade STARTING at each year.
 * Shape follows real history (slow coal era, post-war acceleration). Calibrated against the scripted
 * mid-way build in the tests so a typical player lands near m = 1.
 */
export const REFERENCE_DECADE_KT: readonly number[] = [
  60, 60, 70, 80, 95, 125, 160, 215, 255, 285, 330, 360, 420, 520, 680, 850, 1050,
];
const REFERENCE_FIRST_YEAR = 1850;

/** Reference cumulative emissions (kt) from 1850 up to (not including) the decade starting at `year`. */
export function referenceCumulative(year: number): number {
  const decades = (year - REFERENCE_FIRST_YEAR) / 10;
  let sum = 0;
  for (let i = 0; i < Math.floor(decades); i++) {
    sum += REFERENCE_DECADE_KT[Math.min(i, REFERENCE_DECADE_KT.length - 1)] ?? 0;
  }
  const frac = decades - Math.floor(decades);
  if (frac > 0) {
    sum += frac * (REFERENCE_DECADE_KT[Math.min(Math.floor(decades), REFERENCE_DECADE_KT.length - 1)] ?? 0);
  }
  return sum;
}

/** m = clamp(player / reference, 0.4, 1.6); when both are ~0 (1850) m = 1. */
export function emissionsMultiplier(playerCumulativeKt: number, referenceCumulativeKt: number): number {
  if (referenceCumulativeKt < 1e-9 && playerCumulativeKt < 1e-9) return 1;
  if (referenceCumulativeKt < 1e-9) return M_MAX;
  const m = playerCumulativeKt / referenceCumulativeKt;
  return Math.min(M_MAX, Math.max(M_MIN, m));
}

/** CO2(year) = 280 + (realCO2(year) - 280) * m */
export function co2For(year: number, m: number): number {
  return PRE_INDUSTRIAL_CO2 + (realCO2(year) - PRE_INDUSTRIAL_CO2) * m;
}

/** T = 1.8 * log2(CO2 / 280), optionally scaled by the scenario's sensitivity multiplier. */
export function tempFor(co2: number, sensitivityMult = 1): number {
  return DEGREES_PER_DOUBLING * sensitivityMult * Math.log2(co2 / PRE_INDUSTRIAL_CO2);
}

export interface ClimateState {
  m: number;
  co2: number;
  tempC: number;
}

export function climateAt(
  year: number,
  playerCumulativeKt: number,
  sensitivityMult = 1,
  /** Scales the reference pathway to the size of the town (a small island emits far less than the reference town). */
  referenceScale = 1,
): ClimateState {
  const m = emissionsMultiplier(playerCumulativeKt, referenceCumulative(year) * referenceScale);
  const co2 = co2For(year, m);
  return { m, co2, tempC: tempFor(co2, sensitivityMult) };
}

/** Reef health 0..1: falls with warming (bleaching) beyond what the local coral tolerates, and with local water pollution. */
export function reefHealth(tempC: number, reefWaterPollution: number, tolerance = 0): number {
  const heat = Math.max(0, tempC - tolerance) / 1.5; // ~1.5 C of warming: widespread bleaching
  const dirt = reefWaterPollution / 3;
  return Math.min(1, Math.max(0, 1 - 0.7 * heat - 0.4 * dirt));
}
