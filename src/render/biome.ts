// Per-biome looks: ground colours, water tint, what "polluted ground" looks like (salt crust inland), sky warmth
// and which vegetation grows where. The sim names the biome (ScenarioDef.biome); everything here is presentation.
import type { Biome } from '../sim/scenarios';

export interface GroundSet {
  grass: number; grass2: number; dry: number;
  bare: number; bare2: number; dirt: number;
  sand: number; sandWet: number;
  rock: number; rock2: number;
  seaBed: number; deepBed: number; reefBed: number;
  estMud: number; estMud2: number; riverBed: number;
  /** Dry creek bed (arid River tiles carry no water). */
  creekBed: number;
  wetlandBed: number;
  pit: number; pit2: number; pitReshaped: number; topsoil: number;
}

export interface BiomeLook {
  id: Biome;
  ground: GroundSet;
  /** Soil-contamination stain colours (ochre / rust / slate on the coast; salt crust inland). */
  poll: [number, number, number];
  water: { shallowR: number; deepR: number; shallowP: number; deepP: number; clarity: number };
  /** River tiles are dry creek beds (no water surface). */
  dryCreeks: boolean;
  /** Sky horizon / top tint. */
  sky: { top: number; horizon: number; bottom: number };
  sunColor: number;
  /** Vegetation mix. */
  trees: 'eucalypt' | 'redgum' | 'tropical' | 'arid' | 'urban';
  /** Tree density multiplier on woodland tiles. */
  treeDensity: number;
}

const TEMPERATE: GroundSet = {
  grass: 0x7d9a52, grass2: 0x678a44, dry: 0xb9a45a,
  bare: 0xa88f5a, bare2: 0x9a7d50, dirt: 0x8f6c46,
  sand: 0xead6a4, sandWet: 0xd9c08a,
  rock: 0xd9c28e, rock2: 0xc99a62,
  seaBed: 0xdccf9f, deepBed: 0x8fa894, reefBed: 0xd6c08a,
  estMud: 0x9d8a62, estMud2: 0x7f7350, riverBed: 0xa59670,
  creekBed: 0xd8c39a, wetlandBed: 0x6f7a4a,
  pit: 0x8a5a3e, pit2: 0x6f4a36, pitReshaped: 0xa8825a, topsoil: 0x6a4a32,
};

export const BIOMES: Record<Biome, BiomeLook> = {
  temperate: {
    id: 'temperate', ground: TEMPERATE, poll: [0xa8854f, 0x8f5a36, 0x6f6862],
    water: { shallowR: 0x6fe3d0, deepR: 0x1689b0, shallowP: 0x7a6a46, deepP: 0x4a3d2a, clarity: 0.95 },
    dryCreeks: false, sky: { top: 0x6ea3df, horizon: 0xffd9b4, bottom: 0x8fb4de }, sunColor: 0xffd8a4, trees: 'eucalypt', treeDensity: 1,
  },
  valley: {
    id: 'valley', ground: { ...TEMPERATE, grass: 0x86a456, grass2: 0x6f9248 }, poll: [0xa8854f, 0x8f5a36, 0x6f6862],
    water: { shallowR: 0x74e0c8, deepR: 0x2690a8, shallowP: 0x7a6a46, deepP: 0x4a3d2a, clarity: 0.95 },
    dryCreeks: false, sky: { top: 0x6ea3df, horizon: 0xffe0bc, bottom: 0x8fb4de }, sunColor: 0xffdcae, trees: 'eucalypt', treeDensity: 1.1,
  },
  'inland-river': {
    id: 'inland-river',
    ground: {
      ...TEMPERATE, grass: 0xa6a35e, grass2: 0x8f9450, dry: 0xc9b06a, bare: 0xc2a26a, bare2: 0xb08d58, dirt: 0x9a7448,
      riverBed: 0x8a7650, estMud: 0x8a7650, estMud2: 0x6f5f40, wetlandBed: 0x6a6a3e, sand: 0xe0c896, rock: 0xc49a66, rock2: 0xb07e4e,
    },
    // salt scald: white crust with grey edges
    poll: [0xf2efe6, 0xdcd8cc, 0xbab4a6],
    water: { shallowR: 0x8fbf9a, deepR: 0x4f7a64, shallowP: 0x8a7a50, deepP: 0x5a4a30, clarity: 0.55 },
    dryCreeks: false, sky: { top: 0x7aa8d8, horizon: 0xffd8a8, bottom: 0x9ab4cc }, sunColor: 0xffd096, trees: 'redgum', treeDensity: 0.8,
  },
  tropical: {
    id: 'tropical',
    ground: {
      ...TEMPERATE, grass: 0x5f9a48, grass2: 0x4a8a3c, dry: 0x9ab25a, bare: 0xa8905e, sand: 0xf6ead0, sandWet: 0xe4d4b0,
      rock: 0x6f7a5e, rock2: 0x5a644e, seaBed: 0xf0e6c8, deepBed: 0x7ec0b8, reefBed: 0xe8dcb4, estMud: 0x6f6a48, estMud2: 0x5a5638,
    },
    poll: [0xa8854f, 0x8f6a46, 0x6f6862],
    water: { shallowR: 0x6ff6e4, deepR: 0x0aa2c8, shallowP: 0x7a8a5a, deepP: 0x3a5a4a, clarity: 1 },
    dryCreeks: false, sky: { top: 0x58a6e8, horizon: 0xfff0cc, bottom: 0x7ec8e8 }, sunColor: 0xfff0c8, trees: 'tropical', treeDensity: 1,
  },
  arid: {
    id: 'arid',
    ground: {
      ...TEMPERATE, grass: 0xb98a52, grass2: 0xa87a48, dry: 0xc8a062, bare: 0xb0603a, bare2: 0x9e5434, dirt: 0x8a4630,
      sand: 0xe6b47a, sandWet: 0xc8955e, rock: 0x9a4a32, rock2: 0x7a3a2c, riverBed: 0xe2c49a, creekBed: 0xe8cfa2,
      wetlandBed: 0x5e6a3e, estMud: 0x8a6a48, estMud2: 0x6f5038,
      pit: 0x9a4a30, pit2: 0x6e3424, pitReshaped: 0xc07a4a, topsoil: 0x5a3424,
    },
    poll: [0x7a4a3a, 0x5a3a30, 0x4a4442],
    water: { shallowR: 0x7ec8b8, deepR: 0x2a7a8a, shallowP: 0x8a6a46, deepP: 0x4a3a2a, clarity: 0.7 },
    dryCreeks: true, sky: { top: 0x5a9ad8, horizon: 0xffd2a0, bottom: 0x8aaed0 }, sunColor: 0xffcf90, trees: 'arid', treeDensity: 0.55,
  },
  urban: {
    id: 'urban',
    ground: { ...TEMPERATE, grass: 0x7fa058, grass2: 0x6a904c, dry: 0xa8a468, bare: 0x9a9384, bare2: 0x8a8476, dirt: 0x7a7468 },
    poll: [0x8a8070, 0x6f6658, 0x5a5650],
    water: { shallowR: 0x6fd0c8, deepR: 0x1a7aa0, shallowP: 0x6f6a52, deepP: 0x3f3a2e, clarity: 0.8 },
    dryCreeks: false, sky: { top: 0x6ea3df, horizon: 0xf6dcc0, bottom: 0x8fb4de }, sunColor: 0xffdcae, trees: 'urban', treeDensity: 0.7,
  },
};

export function biomeLook(b: Biome | undefined): BiomeLook {
  return BIOMES[b ?? 'temperate'] ?? BIOMES.temperate;
}

/** City zone ground tints (net-zero-city grid.zone): 1 CBD, 2 suburb, 3 industry, 4 port. */
export const ZONE_GROUND: Record<number, number> = { 1: 0xa29d94, 2: 0x86a05c, 3: 0x948c7c, 4: 0x8c8880 };
