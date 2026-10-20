/**
 * Heat health (pure reads): tree canopy, cooling centres and power cuts decide how many people a heatwave hurts.
 * Used by Red Dirt and Net Zero City (any scenario with `act2.heat`).
 */
import { getScenario } from '../scenarios';
import { TileKind } from '../types';
import type { GameState } from '../types';
import { clamp01, flag } from './flags';

export const HEAT = {
  /** Canopy share at which the tree benefit saturates. */
  canopyFull: 0.35,
  /** Largest share of deaths trees can prevent. */
  canopyBenefit: 0.7,
  coolingBenefit: 0.4,
  /** People one cooling centre can shelter on a hot day. */
  centreCapacity: 2500,
  blackoutFactor: 1.5,
  warmFactor: 0.2,
} as const;

/** Tree canopy as a share (0..1) of the open ground and street space that could hold trees. */
export function canopyShare(s: GameState): number {
  const g = s.grid;
  const covered = new Uint8Array(g.kind.length);
  for (const b of s.buildings) {
    if (b.type !== 'parkland') continue;
    for (let y = Math.max(0, b.y - 1); y <= Math.min(g.h - 1, b.y + b.h); y++) {
      for (let x = Math.max(0, b.x - 1); x <= Math.min(g.w - 1, b.x + b.w); x++) covered[y * g.w + x] = 1;
    }
  }
  let n = 0, c = 0;
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i];
    if (k !== TileKind.Land && k !== TileKind.Bush) continue;
    n++;
    if (covered[i] === 1) { c++; continue; }
    if ((g.building[i] ?? 0) === 0 && (k === TileKind.Bush || ((g.stage[i] ?? 0) >= 2 && (g.health[i] ?? 0) > 0))) c++;
  }
  return n > 0 ? c / n : 0;
}

export function coolingCoverage(s: GameState): number {
  let n = 0;
  for (const b of s.buildings) if (b.type === 'coolingcentre' || b.type === 'communityhub') n++;
  return clamp01((n * HEAT.centreCapacity) / Math.max(1, s.population));
}

/** Expected heat deaths for a heatwave of this severity, before rounding. */
export function heatDeathsExpected(s: GameState, severity: number, blackout: boolean): number {
  const spec = getScenario(s.scenarioId).act2.heat;
  if (!spec) return 0;
  const trees = 1 - HEAT.canopyBenefit * clamp01(canopyShare(s) / HEAT.canopyFull);
  const centres = 1 - HEAT.coolingBenefit * coolingCoverage(s);
  const power = blackout ? HEAT.blackoutFactor : 1;
  const warm = 1 + HEAT.warmFactor * Math.max(0, s.tempC - 1);
  return (s.population / 1000) * spec.deathsPer1000 * severity * trees * centres * power * warm;
}

/** The same heatwave with no trees and no cooling centres. */
export function heatDeathsUnprotected(s: GameState, severity: number, blackout: boolean): number {
  const spec = getScenario(s.scenarioId).act2.heat;
  if (!spec) return 0;
  const power = blackout ? HEAT.blackoutFactor : 1;
  const warm = 1 + HEAT.warmFactor * Math.max(0, s.tempC - 1);
  return (s.population / 1000) * spec.deathsPer1000 * severity * power * warm;
}

export function heatDeathsTotal(s: GameState): number {
  return flag(s, 'h.deaths');
}
