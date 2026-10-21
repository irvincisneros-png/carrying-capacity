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

/** Actions are accepted while Act 1 is being played or during Act 2. */
export function isPlayable(state: GameState): boolean {
  return (state.phase === 'act1' && state.status === 'playing') || state.phase === 'act2';
}

export interface Availability {
  unlock: number;
  cost: number;
  disabled: boolean;
  /** Scenario wording for the build menu (falls back to the building's own name and blurb). */
  name: string;
  blurb: string;
}

/** Building availability for a scenario (applies overrides). */
/**
 * Buildings made for one scenario's mechanics only appear in the places that use them (an island resort makes no
 * sense in Green Valley, and a cooling centre does nothing where there is no heat-health model).
 */
const HOME_SCENARIOS: Partial<Record<BuildingId, readonly GameState['scenarioId'][]>> = {
  resort: ['reef-island'],
  coralnursery: ['reef-island'],
  fishway: ['river-town'],
  dripfarm: ['river-town', 'red-dirt'],
  bore: ['river-town', 'red-dirt'],
  coolingcentre: ['red-dirt', 'net-zero-city'],
  seawall: ['coal-coast', 'reef-island'],
  transitline: ['coal-coast', 'net-zero-city'],
  greensuburb: ['coal-coast', 'net-zero-city'],
  parkland: ['coal-coast', 'red-dirt', 'net-zero-city'],
};

export function availability(scenarioId: GameState['scenarioId'], id: BuildingId): Availability {
  const def = BUILDINGS[id];
  const o = getScenario(scenarioId).availability[id];
  const home = HOME_SCENARIOS[id];
  return {
    unlock: o?.unlock ?? def.unlock,
    cost: o?.cost ?? def.cost,
    disabled: o?.disabled ?? (home ? !home.includes(scenarioId) : false),
    name: o?.name ?? def.name,
    blurb: o?.blurb ?? def.blurb,
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

function onMineSite(state: GameState, i: number): boolean {
  const z = state.grid.zone?.[i] ?? 0;
  return z > 0 && z < 250 && (getScenario(state.scenarioId).mechanics ?? []).includes('outback');
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
  if (!isPlayable(state)) return fail('game-over', 'This act is finished', fp, av.cost);
  const phase = state.phase === 'act2' ? 'act2' : 'act1';
  if (def.phases && !def.phases.includes(phase)) {
    return fail(
      'locked',
      phase === 'act2'
        ? `${def.name} is part of the old industrial economy - the town is moving on from it`
        : `${def.name} isn't available until the transition begins`,
      fp, av.cost,
    );
  }
  if (def.repurposeOnly) {
    return fail('locked', `${def.name} can only be made by repurposing an old industrial site`, fp, av.cost);
  }
  if (def.requiresFeature && !getScenario(state.scenarioId).act2.features[def.requiresFeature]) {
    return fail('locked', `${def.name} needs a strong ${def.requiresFeature} resource, which this place doesn't have`, fp, av.cost);
  }
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
      const k = (g.kind[i] ?? 0) as TileKindValue;
      if ((g.building[i] ?? 0) !== 0) {
        const existing = def.replaces ? buildingAt(state, xx, yy) : undefined;
        if (!(existing && existing.type === def.replaces && existing.x === x && existing.y === y && existing.w === w && existing.h === h)) {
          return fail(
            def.replaces ? 'needs-nearby-building' : 'occupied',
            def.replaces ? `${def.name} must be built on top of an existing ${BUILDINGS[def.replaces].name}`
              : buildingId === 'parkland' ? 'Street trees need an empty tile: pick open ground beside the streets and homes you want to shade (they cool everything within a tile)'
                : 'Something is already built here',
            fp, av.cost,
          );
        }
        continue;
      }
      if (def.replaces) {
        return fail('needs-nearby-building', `${def.name} must be built on top of an existing ${BUILDINGS[def.replaces].name}`, fp, av.cost);
      }
      // Red Dirt: the mine site being rehabilitated can't be built over, or it could never be signed off.
      if (phase === 'act2' && onMineSite(state, i)) {
        return fail('bad-terrain', 'This is mine-site ground being rehabilitated. Leave it to grow and build beside it instead', fp, av.cost);
      }
      // A stormwater wetland may go into bush in Act 2: it adds habitat rather than clearing it.
      const wetlandInBush = k === TileKind.Bush && phase === 'act2' && def.wetland === true;
      if (wetlandInBush) continue;
      if (!def.placement.on.includes(k)) {
        if (k === TileKind.Bush && phase === 'act2') return fail('bad-terrain', 'This bushland is protected now - build on cleared land (open ground without trees) instead', fp, av.cost);
        return fail('bad-terrain', terrainReason(def, k), fp, av.cost);
      }
      if (k === TileKind.Bush) {
        // A road may still cut through regrown bush in Act 2 (otherwise a cleared site beyond the bush could never be joined to
        // the town): that bush tile is lost, which is the trade-off.
        if (phase === 'act2' && buildingId !== 'road') {
          return fail('bad-terrain', 'This bushland has grown back - protect it and build on cleared land instead', fp, av.cost);
        }
        bush++;
      }
    }
  }

  const nt = def.placement.nearTerrain
    ? { ...def.placement.nearTerrain, kinds: [...def.placement.nearTerrain.kinds, ...(getScenario(state.scenarioId).availability[buildingId]?.nearTerrainAdd ?? [])] }
    : undefined;
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

  const siting = checkSiting(state, def, x, y, w, h);
  if (siting) return fail('bad-siting', siting, fp, av.cost, bush);

  const nb = def.placement.nearBuilding;
  if (nb) {
    const ok = state.buildings.some(
      (b) => (b.type === nb.building || nb.or?.includes(b.type) === true) && rectDistance(x, y, w, h, b.x, b.y, b.w, b.h) <= nb.dist,
    );
    if (!ok) return fail('needs-nearby-building', nb.reason, fp, av.cost, bush);
  }

  if (state.budget < av.cost) {
    return fail('no-funds', `Not enough money: ${def.name} costs ${av.cost}`, fp, av.cost, bush);
  }
  return { ok: true, cost: av.cost, footprint: fp, bushCleared: bush };
}

/** Elevation, exposure, drop and cable rules. Returns a human-readable reason, or null if the site is fine. */
function checkSiting(state: GameState, def: BuildingDef, x: number, y: number, w: number, h: number): string | null {
  const p = def.placement;
  const g = state.grid;
  let maxElev = 0;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) maxElev = Math.max(maxElev, g.elevation[yy * g.w + xx] ?? 0);
  const scan = (dist: number, test: (kind: number, elev: number) => boolean): boolean => {
    for (let yy = Math.max(0, y - dist); yy <= Math.min(g.h - 1, y + h - 1 + dist); yy++) {
      for (let xx = Math.max(0, x - dist); xx <= Math.min(g.w - 1, x + w - 1 + dist); xx++) {
        const i = yy * g.w + xx;
        if (test(g.kind[i] ?? 0, g.elevation[i] ?? 0)) return true;
      }
    }
    return false;
  };
  if (p.minElevation && maxElev < p.minElevation.value) return p.minElevation.reason;
  if (p.exposed) {
    const ridge = maxElev >= p.exposed.minElevation;
    const headland = scan(p.exposed.seaWithin, (k) => k === TileKind.Sea || k === TileKind.Reef);
    if (!ridge && !headland) return p.exposed.reason;
  }
  if (p.drop) {
    const d = p.drop;
    if (!scan(d.dist, (k, e) => d.kinds.includes(k as TileKindValue) && maxElev - e >= d.minDrop)) return d.reason;
  }
  if (p.cableTo) {
    const c = p.cableTo;
    if (!scan(c.dist, (k) => c.kinds.includes(k as TileKindValue))) return c.reason;
  }
  return null;
}

export function buildingAt(state: GameState, x: number, y: number): PlacedBuilding | undefined {
  if (!inBounds(state.grid, x, y)) return undefined;
  const uid = state.grid.building[y * state.grid.w + x] ?? 0;
  if (uid === 0) return undefined;
  return state.buildings.find((b) => b.uid === uid);
}
