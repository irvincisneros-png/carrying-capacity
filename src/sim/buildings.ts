import type { BuildingId, EmissionCategory, Rotation, TileKindValue } from './types';
import { TileKind } from './types';

export interface NearTerrainRule {
  kinds: readonly TileKindValue[];
  /** Max distance (in tiles) from any footprint edge. 1 = touching (8-neighbourhood). */
  dist: number;
  reason: string;
}
export interface NearBuildingRule {
  building: BuildingId;
  dist: number;
  reason: string;
}
export interface PlacementSpec {
  /** Every footprint tile must be one of these kinds. */
  on: readonly TileKindValue[];
  nearTerrain?: NearTerrainRule;
  nearBuilding?: NearBuildingRule;
}

export interface PollutionProfile {
  air?: number;
  water?: number;
  soil?: number;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  w: number;
  h: number;
  cost: number;
  jobs: number;
  housing: number;
  /** Positive = generates, negative = consumes (game units). */
  power: number;
  /** kt CO2-e per decade of operation. */
  co2: number;
  /** Headline local pollution (sum of the profile). */
  localPollution: number;
  pollutes: PollutionProfile;
  /** First year available. */
  unlock: number;
  category: EmissionCategory;
  placement: PlacementSpec;
  blurb: string;
}

const { Land, Bush, Beach } = TileKind;

export const BUILDING_IDS: readonly BuildingId[] = [
  'cottage',
  'farm',
  'road',
  'coalmine',
  'rail',
  'port',
  'outfall',
  'landfill',
  'factory',
  'steelworks',
  'coalpower',
  'suburb',
  'carpark',
];

export const BUILDINGS: Readonly<Record<BuildingId, BuildingDef>> = {
  cottage: {
    id: 'cottage', name: 'Weatherboard cottages', w: 1, h: 1, cost: 10, jobs: 0, housing: 20, power: -1,
    co2: 1, localPollution: 0, pollutes: {}, unlock: 1850, category: 'land',
    placement: { on: [Land, Bush] },
    blurb: 'Simple homes for workers and their families.',
  },
  farm: {
    id: 'farm', name: 'Farm', w: 2, h: 2, cost: 15, jobs: 10, housing: 0, power: 0,
    co2: 4, localPollution: 1, pollutes: { water: 1 }, unlock: 1850, category: 'land',
    placement: { on: [Land, Bush] },
    blurb: 'Grows food. Fertiliser and soil run off into the river.',
  },
  road: {
    id: 'road', name: 'Road', w: 1, h: 1, cost: 2, jobs: 0, housing: 0, power: 0,
    co2: 0, localPollution: 0, pollutes: {}, unlock: 1850, category: 'transport',
    placement: { on: [Land, Bush] },
    blurb: 'Connects the town.',
  },
  coalmine: {
    id: 'coalmine', name: 'Coal mine', w: 2, h: 2, cost: 40, jobs: 40, housing: 0, power: -2,
    co2: 20, localPollution: 2, pollutes: { air: 1, soil: 1 }, unlock: 1850, category: 'industry',
    placement: {
      on: [Land, Bush],
      nearTerrain: { kinds: [TileKind.Rock], dist: 1, reason: 'Coal mines must be built next to the sandstone escarpment' },
    },
    blurb: 'Digs coal from the sandstone seam. Lots of jobs, lots of dust.',
  },
  rail: {
    id: 'rail', name: 'Rail siding', w: 1, h: 1, cost: 5, jobs: 2, housing: 0, power: 0,
    co2: 1, localPollution: 0, pollutes: {}, unlock: 1860, category: 'transport',
    placement: { on: [Land, Bush] },
    blurb: 'Moves coal and goods by steam locomotive.',
  },
  port: {
    id: 'port', name: 'Port & coal loader', w: 2, h: 2, cost: 60, jobs: 30, housing: 0, power: -2,
    co2: 10, localPollution: 2, pollutes: { air: 1, water: 1 }, unlock: 1870, category: 'transport',
    placement: {
      on: [Land, Beach, Bush],
      nearTerrain: { kinds: [TileKind.Sea, TileKind.Reef], dist: 1, reason: 'Ports must touch the sea' },
    },
    blurb: 'Ships coal around the world.',
  },
  outfall: {
    id: 'outfall', name: 'Sewage outfall', w: 1, h: 1, cost: 5, jobs: 0, housing: 0, power: 0,
    co2: 0, localPollution: 3, pollutes: { water: 3 }, unlock: 1880, category: 'waste',
    placement: {
      on: [Land, Beach, Bush],
      nearTerrain: { kinds: [TileKind.Sea, TileKind.Reef, TileKind.Estuary], dist: 1, reason: 'Sewage outfalls must touch the sea or estuary' },
    },
    blurb: 'Cheap way to get rid of sewage. Out of sight, not out of the ecosystem.',
  },
  landfill: {
    id: 'landfill', name: 'Landfill', w: 2, h: 2, cost: 10, jobs: 5, housing: 0, power: 0,
    co2: 15, localPollution: 3, pollutes: { soil: 1.5, water: 1, air: 0.5 }, unlock: 1900, category: 'waste',
    placement: { on: [Land, Bush] },
    blurb: 'Rotting rubbish releases methane, a potent greenhouse gas (CO2-equivalent counted here).',
  },
  factory: {
    id: 'factory', name: 'Factory', w: 2, h: 2, cost: 50, jobs: 60, housing: 0, power: -5,
    co2: 25, localPollution: 3, pollutes: { air: 2, soil: 1 }, unlock: 1900, category: 'industry',
    placement: { on: [Land, Bush] },
    blurb: 'Makes goods with sawtooth roofs and tall chimneys.',
  },
  steelworks: {
    id: 'steelworks', name: 'Steelworks', w: 3, h: 3, cost: 120, jobs: 150, housing: 0, power: -10,
    co2: 120, localPollution: 5, pollutes: { air: 3, soil: 2 }, unlock: 1910, category: 'industry',
    placement: {
      on: [Land, Bush],
      nearBuilding: { building: 'port', dist: 6, reason: 'Steelworks must be within 6 tiles of a port (build a Port & coal loader first)' },
    },
    blurb: 'Coal and iron ore become steel. Huge employer, huge emitter.',
  },
  coalpower: {
    id: 'coalpower', name: 'Coal power station', w: 2, h: 2, cost: 100, jobs: 40, housing: 0, power: 40,
    co2: 150, localPollution: 4, pollutes: { air: 4 }, unlock: 1920, category: 'power',
    placement: {
      on: [Land, Bush],
      nearTerrain: { kinds: [TileKind.River, TileKind.Estuary], dist: 3, reason: 'Power stations need cooling water within 3 tiles' },
    },
    blurb: 'Burns coal to make electricity for the whole town.',
  },
  suburb: {
    id: 'suburb', name: 'Brick suburb', w: 2, h: 2, cost: 30, jobs: 0, housing: 120, power: -4,
    co2: 6, localPollution: 0, pollutes: {}, unlock: 1950, category: 'land',
    placement: { on: [Land, Bush] },
    blurb: 'Rows of brick homes with backyards.',
  },
  carpark: {
    id: 'carpark', name: 'Highway & cars', w: 1, h: 3, cost: 25, jobs: 5, housing: 0, power: 0,
    co2: 30, localPollution: 2, pollutes: { air: 2 }, unlock: 1950, category: 'transport',
    placement: { on: [Land, Bush] },
    blurb: 'A highway and car park. Rotate with R.',
  },
};

export function getBuildingDef(id: BuildingId): BuildingDef {
  return BUILDINGS[id];
}

export function isBuildingId(s: string): s is BuildingId {
  return Object.prototype.hasOwnProperty.call(BUILDINGS, s);
}

/** Footprint size after rotation (0..3 quarter turns). Anchor (x, y) is always the top-left tile. */
export function footprintFor(def: BuildingDef, rotation: Rotation): { w: number; h: number } {
  return rotation % 2 === 0 ? { w: def.w, h: def.h } : { w: def.h, h: def.w };
}
