/**
 * How full a grown building is (sim/zoning.ts). Kept apart from zoning.ts so the economy and the road network can read it without
 * an import cycle. Placed buildings are always full.
 *
 *  - An empty (declined) building houses and employs nobody until its road or power is back.
 *  - High-density homes fill only half way (60 of 120 people) unless transit is near: a light-rail line, or a rail line, within
 *    TRANSIT_REACH tiles. Dense housing needs a way to move people that is not one car each.
 */
import type { GameState, PlacedBuilding } from './types';

export const TRANSIT_REACH = 4;
export const HIGH_NO_TRANSIT_FILL = 0.5;

const TRANSIT: ReadonlySet<string> = new Set(['transitline', 'rail']);

/** A fill function for the state's buildings: one pass to find the transit, then O(transit) per high-rise. */
export function fillFn(state: Pick<GameState, 'buildings'>): (b: PlacedBuilding) => number {
  let transit: PlacedBuilding[] | null = null;
  return (b) => {
    if (!b.grown) return 1;
    if (b.empty) return 0;
    if (b.type !== 'zres3') return 1;
    transit ??= state.buildings.filter((o) => TRANSIT.has(o.type));
    const near = transit.some((t) => {
      const dx = Math.max(t.x - (b.x + b.w - 1), b.x - (t.x + t.w - 1));
      const dy = Math.max(t.y - (b.y + b.h - 1), b.y - (t.y + t.h - 1));
      return Math.max(dx, dy) <= TRANSIT_REACH;
    });
    return near ? 1 : HIGH_NO_TRANSIT_FILL;
  };
}

export function fillOf(state: Pick<GameState, 'buildings'>, b: PlacedBuilding): number {
  return fillFn(state)(b);
}
