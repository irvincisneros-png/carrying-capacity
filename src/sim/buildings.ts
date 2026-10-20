import type { BuildingId, EmissionCategory, EnergySource, Rotation, TileKindValue } from './types';
import { TileKind } from './types';

export interface NearTerrainRule {
  kinds: readonly TileKindValue[];
  /** Max distance (in tiles) from any footprint edge. 1 = touching (8-neighbourhood). */
  dist: number;
  reason: string;
}
export interface NearBuildingRule {
  building: BuildingId;
  /** Any of these also satisfies the rule (in addition to `building`). */
  or?: readonly BuildingId[];
  dist: number;
  reason: string;
}
/** Wind needs high ground (ridge) or a headland (a short distance from open sea). */
export interface ExposedRule {
  minElevation: number;
  seaWithin: number;
  reason: string;
}
/** Hydro needs a drop: the site must stand `minDrop` above a water tile within `dist`. */
export interface DropRule {
  kinds: readonly TileKindValue[];
  dist: number;
  minDrop: number;
  reason: string;
}
export interface PlacementSpec {
  /** Every footprint tile must be one of these kinds. */
  on: readonly TileKindValue[];
  nearTerrain?: NearTerrainRule;
  nearBuilding?: NearBuildingRule;
  /** Minimum site elevation (highest footprint tile). */
  minElevation?: { value: number; reason: string };
  exposed?: ExposedRule;
  drop?: DropRule;
  /** Rotation is irrelevant for the offshore cable rule: footprint must be within `dist` of these land kinds. */
  cableTo?: { kinds: readonly TileKindValue[]; dist: number; reason: string };
}

export interface EnergySpec {
  source: EnergySource;
  /** Nameplate capacity (power units) of one building. */
  capacity: number;
  /** For storage: round-trip efficiency (charging loses 1 - efficiency). Capacity is then the charge/discharge rate. */
  efficiency?: number;
}

export interface RemediationSpec {
  method: 'phyto' | 'excavate';
  /** Tiles around the footprint that are cleaned. */
  radius: number;
  /** Years to cut contamination by a factor of 8 at scenario remediationYears = 20. */
  baseYears: number;
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
  /** Which acts allow building it (default: both). New fossil / heavy industry is act1 only. */
  phases?: readonly ('act1' | 'act2')[];
  /** Energy role in the Act 2 grid. */
  energy?: EnergySpec;
  remediation?: RemediationSpec;
  /** Stormwater wetland: filters water pollution here and downstream. */
  wetland?: boolean;
  /** Native plant nursery: seeds + weeding crew within `radius` tiles. */
  nursery?: { radius: number };
  /** Placed on top of this building type, replacing it (anchor tile must hold it). */
  replaces?: BuildingId;
  /** Scenario feature flag needed (see Act2Def.features). */
  requiresFeature?: 'tidal';
  /** Wildlife crossing: counts as passable ground in the wildlife connectivity model. */
  crossing?: boolean;
  /** Satellite ground station: needed to subscribe to satellite overlays. */
  groundStation?: boolean;
  /** Only created by repurposing a legacy building (circular tier), never placed directly. */
  repurposeOnly?: boolean;
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
  'gaspower',
  'rooftopsolar',
  'solarfarm',
  'windfarm',
  'offshorewind',
  'hydro',
  'pumpedhydro',
  'battery',
  'tidal',
  'phytoremediation',
  'excavation',
  'wetland',
  'sewagetreatment',
  'nursery',
  'wildlifecrossing',
  'groundstation',
  'greensteel',
  'makerspace',
  'windport',
  'solarlandfill',
  'batteryhub',
  'communityhub',
  'recycler',
];

/** Act 1 buildings that may still be built during the transition (everything else dirty is act1 only). */
const ACT1: readonly ('act1' | 'act2')[] = ['act1'];
const ACT2: readonly ('act1' | 'act2')[] = ['act2'];

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
    id: 'coalmine', phases: ACT1, name: 'Coal mine', w: 2, h: 2, cost: 40, jobs: 40, housing: 0, power: -2,
    co2: 20, localPollution: 2, pollutes: { air: 1, soil: 1 }, unlock: 1850, category: 'industry',
    placement: {
      on: [Land, Bush],
      nearTerrain: { kinds: [TileKind.Rock], dist: 1, reason: 'Coal mines must be built next to the sandstone escarpment' },
    },
    blurb: 'Digs coal from the sandstone seam. Lots of jobs, lots of dust.',
  },
  rail: {
    id: 'rail', phases: ACT1, name: 'Rail siding', w: 1, h: 1, cost: 5, jobs: 2, housing: 0, power: 0,
    co2: 1, localPollution: 0, pollutes: {}, unlock: 1860, category: 'transport',
    placement: { on: [Land, Bush] },
    blurb: 'Moves coal and goods by steam locomotive.',
  },
  port: {
    id: 'port', phases: ACT1, name: 'Port & coal loader', w: 2, h: 2, cost: 60, jobs: 30, housing: 0, power: -2,
    co2: 10, localPollution: 2, pollutes: { air: 1, water: 1 }, unlock: 1870, category: 'transport',
    placement: {
      on: [Land, Beach, Bush],
      nearTerrain: { kinds: [TileKind.Sea, TileKind.Reef], dist: 1, reason: 'Ports must touch the sea' },
    },
    blurb: 'Ships coal around the world.',
  },
  outfall: {
    id: 'outfall', phases: ACT1, name: 'Sewage outfall', w: 1, h: 1, cost: 5, jobs: 0, housing: 0, power: 0,
    co2: 0, localPollution: 3, pollutes: { water: 3 }, unlock: 1880, category: 'waste',
    placement: {
      on: [Land, Beach, Bush],
      nearTerrain: { kinds: [TileKind.Sea, TileKind.Reef, TileKind.Estuary], dist: 1, reason: 'Sewage outfalls must touch the sea or estuary' },
    },
    blurb: 'Cheap way to get rid of sewage. Out of sight, not out of the ecosystem.',
  },
  landfill: {
    id: 'landfill', phases: ACT1, name: 'Landfill', w: 2, h: 2, cost: 10, jobs: 5, housing: 0, power: 0,
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
    id: 'steelworks', phases: ACT1, name: 'Steelworks', w: 3, h: 3, cost: 120, jobs: 150, housing: 0, power: -10,
    co2: 120, localPollution: 5, pollutes: { air: 3, soil: 2 }, unlock: 1910, category: 'industry',
    placement: {
      on: [Land, Bush],
      nearBuilding: { building: 'port', dist: 6, reason: 'Steelworks must be within 6 tiles of a port (build a Port & coal loader first)' },
    },
    blurb: 'Coal and iron ore become steel. Huge employer, huge emitter.',
  },
  coalpower: {
    id: 'coalpower', phases: ACT1, energy: { source: 'coal', capacity: 40 }, name: 'Coal power station', w: 2, h: 2, cost: 100, jobs: 40, housing: 0, power: 40,
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
    id: 'carpark', phases: ACT1, name: 'Highway & cars', w: 1, h: 3, cost: 25, jobs: 5, housing: 0, power: 0,
    co2: 30, localPollution: 2, pollutes: { air: 2 }, unlock: 1950, category: 'transport',
    placement: { on: [Land, Bush] },
    blurb: 'A highway and car park. Rotate with R.',
  },

  // ---- Act 2: energy ----
  gaspower: {
    id: 'gaspower', name: 'Gas power station', w: 2, h: 2, cost: 80, jobs: 15, housing: 0, power: 30,
    co2: 0, localPollution: 1.5, pollutes: { air: 1.5 }, unlock: 2025, category: 'power', phases: ACT2,
    energy: { source: 'gas', capacity: 30 },
    placement: { on: [Land] },
    blurb: 'Flexible: ramps up and down quickly, with about half the CO2 of coal per unit of electricity. Still a fossil fuel.',
  },
  rooftopsolar: {
    id: 'rooftopsolar', name: 'Rooftop solar', w: 1, h: 1, cost: 12, jobs: 1, housing: 0, power: 5,
    co2: 0, localPollution: 0, pollutes: {}, unlock: 2025, category: 'power', phases: ACT2,
    energy: { source: 'rooftop-solar', capacity: 5 },
    placement: {
      on: [Land],
      nearBuilding: { building: 'cottage', or: ['suburb'], dist: 1, reason: 'Rooftop solar goes next to homes (a cottage or brick suburb)' },
    },
    blurb: 'Panels on the homes. Cheap, but only in daylight.',
  },
  solarfarm: {
    id: 'solarfarm', name: 'Solar farm', w: 2, h: 2, cost: 70, jobs: 4, housing: 0, power: 24,
    co2: 0, localPollution: 0, pollutes: {}, unlock: 2025, category: 'power', phases: ACT2,
    energy: { source: 'solar-farm', capacity: 24 },
    placement: { on: [Land] },
    blurb: 'Acres of panels. Strong in summer, weaker in winter, nothing at night - pair it with batteries.',
  },
  windfarm: {
    id: 'windfarm', name: 'Wind turbines', w: 1, h: 2, cost: 60, jobs: 3, housing: 0, power: 16,
    co2: 0, localPollution: 0, pollutes: {}, unlock: 2025, category: 'power', phases: ACT2,
    energy: { source: 'wind', capacity: 16 },
    placement: {
      on: [Land, Beach],
      exposed: { minElevation: 2, seaWithin: 3, reason: 'Wind turbines need a windy site: a ridge (high ground) or a headland close to the open sea' },
    },
    blurb: 'Turbines on a ridge or headland. Works day and night, but the wind comes and goes.',
  },
  offshorewind: {
    id: 'offshorewind', name: 'Offshore wind', w: 2, h: 2, cost: 150, jobs: 6, housing: 0, power: 40,
    co2: 0, localPollution: 0, pollutes: {}, unlock: 2040, category: 'power', phases: ACT2,
    energy: { source: 'offshore-wind', capacity: 40 },
    placement: {
      on: [TileKind.Sea],
      cableTo: { kinds: [Beach, Land], dist: 8, reason: 'Offshore wind farms must be within 8 tiles of the shore so the cable can reach land' },
    },
    blurb: 'Big turbines at sea, where the wind is steadier. Expensive, and arrives after the technology matures.',
  },
  hydro: {
    id: 'hydro', name: 'Hydro dam', w: 2, h: 2, cost: 130, jobs: 6, housing: 0, power: 18,
    co2: 0, localPollution: 0, pollutes: {}, unlock: 2025, category: 'power', phases: ACT2,
    energy: { source: 'hydro', capacity: 18 },
    placement: {
      on: [Land],
      nearTerrain: { kinds: [TileKind.River], dist: 1, reason: 'A hydro dam must sit right beside the river' },
      drop: { kinds: [TileKind.River], dist: 2, minDrop: 2, reason: 'Hydro needs an elevation drop: build on high ground (2+) above the river' },
    },
    blurb: 'Water falling from height turns turbines. Reliable day and night, but a drought cuts the flow.',
  },
  pumpedhydro: {
    id: 'pumpedhydro', name: 'Pumped hydro', w: 3, h: 2, cost: 170, jobs: 6, housing: 0, power: 25,
    co2: 0, localPollution: 0, pollutes: {}, unlock: 2030, category: 'power', phases: ACT2,
    energy: { source: 'pumped-hydro', capacity: 25, efficiency: 0.75 },
    placement: {
      on: [Land],
      drop: { kinds: [TileKind.River, TileKind.Estuary, TileKind.Sea], dist: 4, minDrop: 2, reason: 'Pumped hydro needs two reservoirs with a height difference: build on high ground (2+) within 4 tiles of the river or sea' },
    },
    blurb: 'Pumps water uphill when power is plentiful and lets it fall when it is not. A giant battery.',
  },
  battery: {
    id: 'battery', name: 'Grid battery', w: 1, h: 2, cost: 50, jobs: 1, housing: 0, power: 8,
    co2: 0, localPollution: 0, pollutes: {}, unlock: 2025, category: 'power', phases: ACT2,
    energy: { source: 'battery', capacity: 8, efficiency: 0.9 },
    placement: { on: [Land] },
    blurb: 'Stores spare solar and wind power for the evening peak.',
  },
  tidal: {
    id: 'tidal', name: 'Tidal turbines', w: 2, h: 2, cost: 140, jobs: 4, housing: 0, power: 14,
    co2: 0, localPollution: 0, pollutes: {}, unlock: 2030, category: 'power', phases: ACT2, requiresFeature: 'tidal',
    energy: { source: 'tidal', capacity: 14 },
    placement: {
      on: [TileKind.Sea],
      nearTerrain: { kinds: [TileKind.Estuary, Beach], dist: 3, reason: 'Tidal turbines need a tidal channel: build in the sea near an estuary mouth or the shore' },
    },
    blurb: 'Predictable power from the tide. Only where there is a strong tidal range.',
  },

  // ---- Act 2: clean-up and restoration ----
  phytoremediation: {
    id: 'phytoremediation', name: 'Phytoremediation garden', w: 2, h: 2, cost: 25, jobs: 1, housing: 0, power: 0,
    co2: 0, localPollution: 0, pollutes: {}, unlock: 2025, category: 'land', phases: ACT2,
    remediation: { method: 'phyto', radius: 3, baseYears: 8 },
    placement: { on: [Land] },
    blurb: 'Plants that pull metals and toxins out of the soil. Cheap and clean, but slow.',
  },
  excavation: {
    id: 'excavation', name: 'Soil excavation site', w: 2, h: 2, cost: 90, jobs: 6, housing: 0, power: -1,
    co2: 80, localPollution: 0, pollutes: {}, unlock: 2025, category: 'transport', phases: ACT2,
    remediation: { method: 'excavate', radius: 3, baseYears: 2 },
    placement: { on: [Land] },
    blurb: 'Dig out the contaminated soil and truck it away. Fast, but expensive and the trucks burn diesel.',
  },
  wetland: {
    id: 'wetland', name: 'Stormwater wetland', w: 2, h: 2, cost: 40, jobs: 1, housing: 0, power: 0,
    co2: 0, localPollution: 0, pollutes: {}, unlock: 2025, category: 'land', phases: ACT2, wetland: true,
    placement: {
      on: [Land],
      nearTerrain: { kinds: [TileKind.River, TileKind.Estuary], dist: 2, reason: 'A stormwater wetland must be beside the river or estuary so it can catch the runoff' },
    },
    blurb: 'Reeds and ponds that filter runoff before it reaches the estuary.',
  },
  sewagetreatment: {
    id: 'sewagetreatment', name: 'Sewage treatment plant', w: 1, h: 1, cost: 45, jobs: 3, housing: 0, power: -1,
    co2: 5, localPollution: 0.6, pollutes: { water: 0.6 }, unlock: 2025, category: 'waste', phases: ACT2, replaces: 'outfall',
    placement: { on: [Land, Beach, Bush] },
    blurb: 'Build it on an existing sewage outfall to upgrade it. Treated water is far cleaner than raw sewage.',
  },
  nursery: {
    id: 'nursery', name: 'Native plant nursery', w: 2, h: 2, cost: 30, jobs: 4, housing: 0, power: 0,
    co2: 0, localPollution: 0, pollutes: {}, unlock: 2025, category: 'land', phases: ACT2, nursery: { radius: 5 },
    placement: { on: [Land] },
    blurb: 'Grows local seedlings and sends out bush regenerators to weed. Restoration spreads from here.',
  },

  // ---- Act 2: wildlife and satellites ----
  wildlifecrossing: {
    id: 'wildlifecrossing', name: 'Wildlife crossing', w: 1, h: 1, cost: 30, jobs: 0, housing: 0, power: 0,
    co2: 1, localPollution: 0, pollutes: {}, unlock: 2025, category: 'land', phases: ACT2, replaces: 'road', crossing: true,
    placement: { on: [Land, Bush] },
    blurb: 'An underpass or rope bridge built where a road cuts through bush, with fences that guide animals to it. Build it on an existing road.',
  },
  groundstation: {
    id: 'groundstation', name: 'Satellite ground station', w: 2, h: 2, cost: 40, jobs: 5, housing: 0, power: -2,
    co2: 2, localPollution: 0, pollutes: {}, unlock: 2025, category: 'land', phases: ACT2, groundStation: true,
    placement: { on: [Land] },
    blurb: 'Receives satellite data about sea temperature, sea level, forests and fires. Needed before you can subscribe to overlays.',
  },

  // ---- Circular tier: created by repurposing a legacy building ----
  greensteel: {
    id: 'greensteel', name: 'Green steel plant', w: 3, h: 3, cost: 0, jobs: 90, housing: 0, power: -8,
    co2: 12, localPollution: 0.5, pollutes: { air: 0.3 }, unlock: 2025, category: 'industry', phases: ACT2, repurposeOnly: true,
    placement: { on: [Land] },
    blurb: 'Makes steel with hydrogen from renewable power instead of coal. Water is the main by-product.',
  },
  makerspace: {
    id: 'makerspace', name: 'Steelworks museum and makerspace', w: 2, h: 2, cost: 0, jobs: 14, housing: 0, power: -1,
    co2: 1, localPollution: 0, pollutes: {}, unlock: 2025, category: 'land', phases: ACT2, repurposeOnly: true,
    placement: { on: [Land] },
    blurb: 'The old works become a museum of the town\'s story and a workshop where people learn to repair, weld and build.',
  },
  windport: {
    id: 'windport', name: 'Wind-turbine port', w: 2, h: 2, cost: 0, jobs: 30, housing: 0, power: -2,
    co2: 4, localPollution: 0, pollutes: {}, unlock: 2025, category: 'transport', phases: ACT2, repurposeOnly: true,
    placement: { on: [Land] },
    blurb: 'The coal loader\'s deep berth now ships turbine blades and towers for offshore wind farms.',
  },
  solarlandfill: {
    id: 'solarlandfill', name: 'Solar farm on a capped landfill', w: 2, h: 2, cost: 0, jobs: 2, housing: 0, power: 20,
    co2: 3, localPollution: 0.3, pollutes: { soil: 0.3 }, unlock: 2025, category: 'power', phases: ACT2, repurposeOnly: true,
    energy: { source: 'solar-farm', capacity: 20 },
    placement: { on: [Land] },
    blurb: 'Panels on weighted frames sit on the capped rubbish, so no digging disturbs it. Land that could not be used for anything else makes power.',
  },
  batteryhub: {
    id: 'batteryhub', name: 'Battery site at the old power station', w: 2, h: 2, cost: 0, jobs: 3, housing: 0, power: 16,
    co2: 0, localPollution: 0, pollutes: {}, unlock: 2025, category: 'power', phases: ACT2, repurposeOnly: true,
    energy: { source: 'battery', capacity: 16, efficiency: 0.9 },
    placement: { on: [Land] },
    blurb: 'The power station already has a grid connection, cooling-water access and skilled staff. Batteries use the same connection.',
  },
  communityhub: {
    id: 'communityhub', name: 'Community hub', w: 2, h: 2, cost: 0, jobs: 8, housing: 0, power: -2,
    co2: 1, localPollution: 0, pollutes: {}, unlock: 2025, category: 'land', phases: ACT2, repurposeOnly: true,
    placement: { on: [Land] },
    blurb: 'A library, meeting rooms and a cool place in a heatwave, built inside the old power station\'s walls.',
  },
  recycler: {
    id: 'recycler', name: 'Recycling and remanufacturing plant', w: 2, h: 2, cost: 0, jobs: 40, housing: 0, power: -3,
    co2: 6, localPollution: 0.3, pollutes: { air: 0.2 }, unlock: 2025, category: 'waste', phases: ACT2, repurposeOnly: true,
    placement: { on: [Land] },
    blurb: 'Sorts and processes the town\'s glass, metals and plastics so they become new products instead of rubbish.',
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
