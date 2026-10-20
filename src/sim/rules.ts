import { BUILDINGS, footprintFor, isBuildingId } from './buildings';
import type { BuildingDef } from './buildings';
import { getScenario } from './scenarios';
import { inBounds } from './terrain';
import { TILE_KIND_NAMES, TileKind } from './types';
import type { ActionFailCode, BuildingId, GameState, PlacedBuilding, Rotation, TileKindValue } from './types';

export const CLEAR_COST = 1;
/** kt CO2 released per bush tile cleared (one-off). */
export const CLEAR_KT_PER_TILE = 3;
export const DEMOLISH_REFUND = 0.25;

export interface Availability {
  unlock: number;
  cost: number;
  disabled: boolean;
}

/** Building availability for a scenario (applies overrides). */
export function availability(scenarioId: GameState['scenarioId'], id: BuildingId): Availability {
  const def = BUILDINGS[id];
  const o = getScenario(scenarioId).availability[id];
  return {
    unlock: o?.unlock ?? def.unlock,
    cost: o?.cost ?? def.cost,
    disabled: o?.disabled ?? false,
  };
}

export function isUnlocked(state: GameState, id: BuildingId): boolean {
  const a = availability(state.scenarioId, id);
  return !a.disabled && state.year >= a.unlock;
}

export interface PlaceCheck {
  ok: boolean;
  code?: ActionFailCode;
  reason?: string;
  cost: number;
  footprint: { x: number; y: number; w: number; h: number };
  /** Bush tiles that would be cleared. */
  bushCleared: number;
}

/** Edge-to-edge distance between two rects in tiles (Chebyshev). Touching = 1, overlap <= 0. */
export function rectDistance(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): number {
  const dx = Math.max(ax - (bx + bw - 1), bx - (ax + aw - 1));
  const dy = Math.max(ay - (by + bh - 1), by - (ay + ah - 1));
  return Math.max(dx, dy);
}

function terrainReason(def: BuildingDef, kind: TileKindValue): string {
  const plural = def.name;
  switch (kind) {
    case TileKind.Sea:
    case TileKind.Reef:
    case TileKind.River:
    case TileKind.Estuary:
      return `${plural} can't be built on water`;
    case TileKind.Rock:
      return `${plural} can't be built on the sandstone escarpment - it's too steep and hard`;
    case TileKind.Bush:
      return `${plural} need cleared land - use the Clear tool on the bushland first`;
    case TileKind.Beach:
      return `${plural} can't be built on the beach`;
    default:
      return `${plural} can't be built on ${TILE_KIND_NAMES[kind]}`;
  }
}

export function canPlace(
  state: GameState,
  buildingId: BuildingId,
  x: number,
  y: number,
  rotation: Rotation = 0,
): PlaceCheck {
  const fail = (
    code: ActionFailCode,
    reason: string,
    fp = { x, y, w: 1, h: 1 },
    cost = 0,
    bush = 0,
  ): PlaceCheck => ({ ok: false, code, reason, cost, footprint: fp, bushCleared: bush });

  if (!isBuildingId(buildingId)) return fail('unknown-building', 'Unknown building');
  const def = BUILDINGS[buildingId];
  const av = availability(state.scenarioId, buildingId);
  const { w, h } = footprintFor(def, rotation);
  const fp = { x, y, w, h };
  if (state.status !== 'playing') return fail('game-over', 'This act is finished', fp, av.cost);
  if (av.disabled) return fail('locked', `${def.name} isn't available in this scenario`, fp, av.cost);
  if (state.year < av.unlock) return fail('locked', `${def.name} unlocks in ${av.unlock}`, fp, av.cost);

  const g = state.grid;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + w > g.w || y + h > g.h) {
    return fail('out-of-bounds', "That doesn't fit on the map", fp, av.cost);
  }

  let bush = 0;
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = yy * g.w + xx;
      if ((g.building[i] ?? 0) !== 0) return fail('occupied', 'Something is already built here', fp, av.cost);
      const k = (g.kind[i] ?? 0) as TileKindValue;
      if (!def.placement.on.includes(k)) return fail('bad-terrain', terrainReason(def, k), fp, av.cost);
      if (k === TileKind.Bush) bush++;
    }
  }

  const nt = def.placement.nearTerrain;
  if (nt) {
    let found = false;
    const x0 = Math.max(0, x - nt.dist);
    const x1 = Math.min(g.w - 1, x + w - 1 + nt.dist);
    const y0 = Math.max(0, y - nt.dist);
    const y1 = Math.min(g.h - 1, y + h - 1 + nt.dist);
    for (let yy = y0; yy <= y1 && !found; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        if (nt.kinds.includes((g.kind[yy * g.w + xx] ?? 0) as TileKindValue)) {
          found = true;
          break;
        }
      }
    }
    if (!found) return fail('needs-nearby-terrain', nt.reason, fp, av.cost, bush);
  }

  const nb = def.placement.nearBuilding;
  if (nb) {
    const ok = state.buildings.some(
      (b) => b.type === nb.building && rectDistance(x, y, w, h, b.x, b.y, b.w, b.h) <= nb.dist,
    );
    if (!ok) return fail('needs-nearby-building', nb.reason, fp, av.cost, bush);
  }

  if (state.budget < av.cost) {
    return fail('no-funds', `Not enough money: ${def.name} costs ${av.cost}`, fp, av.cost, bush);
  }
  return { ok: true, cost: av.cost, footprint: fp, bushCleared: bush };
}

export function buildingAt(state: GameState, x: number, y: number): PlacedBuilding | undefined {
  if (!inBounds(state.grid, x, y)) return undefined;
  const uid = state.grid.building[y * state.grid.w + x] ?? 0;
  if (uid === 0) return undefined;
  return state.buildings.find((b) => b.uid === uid);
}
