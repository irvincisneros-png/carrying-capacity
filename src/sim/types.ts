/** Shared types for the pure-TS simulation. No DOM / three.js imports allowed in src/sim. */

export const TileKind = {
  Sea: 0,
  Beach: 1,
  Estuary: 2,
  River: 3,
  Land: 4,
  Bush: 5,
  Rock: 6,
  /** Sea tile with coral reef (counts as sea for placement). */
  Reef: 7,
} as const;
export type TileKindValue = (typeof TileKind)[keyof typeof TileKind];

export const TILE_KIND_NAMES: Record<TileKindValue, string> = {
  0: 'sea',
  1: 'beach',
  2: 'estuary',
  3: 'river',
  4: 'land',
  5: 'bush',
  6: 'rock',
  7: 'reef',
};

export type BuildingId =
  | 'cottage'
  | 'farm'
  | 'road'
  | 'coalmine'
  | 'rail'
  | 'port'
  | 'steelworks'
  | 'coalpower'
  | 'factory'
  | 'suburb'
  | 'carpark'
  | 'landfill'
  | 'outfall';

export type EmissionCategory = 'power' | 'industry' | 'transport' | 'land' | 'waste';
export const EMISSION_CATEGORIES: readonly EmissionCategory[] = [
  'power',
  'industry',
  'transport',
  'land',
  'waste',
];
export type EmissionsBySource = Record<EmissionCategory, number>;

export type Rotation = 0 | 1 | 2 | 3;

export type ScenarioId =
  | 'coal-coast'
  | 'green-valley'
  | 'river-town'
  | 'reef-island'
  | 'red-dirt'
  | 'net-zero-city';

export interface Meters {
  economy: number;
  society: number;
  environment: number;
}

/** Per-tile storage. All typed arrays, row-major: index = y * w + x. */
export interface TileGrid {
  w: number;
  h: number;
  kind: Uint8Array;
  elevation: Uint8Array;
  /** 0 = empty, otherwise PlacedBuilding.uid (uint16, so up to 65535 buildings). */
  building: Uint16Array;
  /** Act 2 groundwork: local pollution / health fields. Decay each decade, driven by buildings. */
  airPollution: Float32Array;
  waterPollution: Float32Array;
  soilContamination: Float32Array;
}

export interface PlacedBuilding {
  uid: number;
  type: BuildingId;
  /** Top-left tile of the (rotated) footprint. */
  x: number;
  y: number;
  rotation: Rotation;
  /** Rotated footprint size. */
  w: number;
  h: number;
  builtYear: number;
}

export interface HistoryRecord {
  year: number;
  co2: number;
  realCo2: number;
  tempC: number;
  realTempC: number;
  /** Player-vs-reference emissions ratio used for this record. */
  multiplier: number;
  /** Emissions (kt CO2-e) over the decade that ENDED at this year. Zero for the first record. */
  emissionsKt: EmissionsBySource;
  totalKt: number;
  meters: Meters;
  population: number;
  budget: number;
}

export type GameStatus = 'playing' | 'act1-complete';

export interface GameState {
  saveVersion: number;
  scenarioId: ScenarioId;
  seed: number;
  year: number;
  status: GameStatus;
  budget: number;
  population: number;
  lastIncome: number;
  grid: TileGrid;
  buildings: PlacedBuilding[];
  nextUid: number;
  /** One-off land-clearing emissions waiting to be counted in the next decade. */
  pendingLandKt: number;
  cumulativeKt: number;
  co2: number;
  tempC: number;
  multiplier: number;
  meters: Meters;
  history: HistoryRecord[];
  /** Bush tiles at game start (for the Environment meter). */
  initialBushTiles: number;
  /** Increments on every state change; renderers compare it to detect dirtiness. */
  version: number;
}

export type Action =
  | { type: 'place'; building: BuildingId; x: number; y: number; rotation?: Rotation }
  | { type: 'demolish'; x: number; y: number }
  | { type: 'clear'; x: number; y: number };

export type ActionFailCode =
  | 'game-over'
  | 'unknown-building'
  | 'locked'
  | 'out-of-bounds'
  | 'bad-terrain'
  | 'occupied'
  | 'needs-nearby-terrain'
  | 'needs-nearby-building'
  | 'no-funds'
  | 'nothing-here'
  | 'not-bush';

export interface ActionResult {
  ok: boolean;
  code?: ActionFailCode;
  /** Human-readable reason, suitable for a tooltip. */
  reason?: string;
  /** Money spent (positive) on success. */
  spent?: number;
  /** Money refunded on demolish. */
  refund?: number;
  /** uid of the newly placed building. */
  uid?: number;
}

export interface Fact {
  decade: number;
  year: number;
  text: string;
}

export interface DecadeReport {
  fromYear: number;
  toYear: number;
  emissionsKt: EmissionsBySource;
  totalKt: number;
  topSource: EmissionCategory;
  co2Ppm: number;
  realCo2Ppm: number;
  tempC: number;
  realTempC: number;
  deltaCo2: number;
  deltaTempC: number;
  meters: Meters;
  meterDeltas: Meters;
  population: number;
  income: number;
  /** What the town needs in the decade that is starting. */
  demand: string;
  demandItems: string[];
  fact: Fact | null;
  actComplete: boolean;
}
