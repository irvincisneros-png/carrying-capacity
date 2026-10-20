/** Shared types for the pure-TS simulation. No DOM / three.js imports allowed in src/sim. */
import type {
  CircularState, CountryState, DilemmasState, ResidentsState, SatelliteOverlay, SatelliteState, StoryMeta,
  WildlifeState,
} from './layerTypes';

export type { SatelliteOverlay } from './layerTypes';

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
  | 'outfall'
  // Act 2 catalogue: energy
  | 'gaspower'
  | 'rooftopsolar'
  | 'solarfarm'
  | 'windfarm'
  | 'offshorewind'
  | 'hydro'
  | 'pumpedhydro'
  | 'battery'
  | 'tidal'
  // Act 2 catalogue: clean-up and restoration
  | 'phytoremediation'
  | 'excavation'
  | 'wetland'
  | 'sewagetreatment'
  | 'nursery'
  // Wildlife and satellites
  | 'wildlifecrossing'
  | 'groundstation'
  // Circular tier: only created by repurposing a legacy building
  | 'greensteel'
  | 'makerspace'
  | 'windport'
  | 'solarlandfill'
  | 'batteryhub'
  | 'communityhub'
  | 'recycler';

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
  /**
   * Act 2: vegetation / coral health 0..1 per tile. Land, beach, estuary and shallow sea tiles hold
   * restoration progress; Reef tiles hold coral health. Zero under buildings.
   */
  health: Float32Array;
  /** Act 2: succession stage 0 bare, 1 pioneer, 2 shrub/heath, 3 woodland (names depend on tile kind). */
  stage: Uint8Array;
  /** Act 2: 1 where weeds have invaded a bare / pioneer tile. */
  weed: Uint8Array;
  /**
   * Act 2: one counter per 8x8 chunk (row-major, ceil(w/8) wide). Incremented whenever anything the renderer
   * draws from health / stage / weed / kind / building changes inside the chunk.
   */
  chunkVersion: Uint32Array;
  /**
   * Places of cultural significance (Caring for Country): 0 = none, otherwise the site cluster id (1..n).
   * Fixed by the terrain; consulting the community about a cluster is what makes building there respectful.
   */
  significant: Uint8Array;
}

/** Edge length (tiles) of the chunks tracked by TileGrid.chunkVersion. */
export const CHUNK_SIZE = 8;

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

export type GameStatus = 'playing' | 'act1-complete' | 'act2-complete' | 'failed';

/** Game phase. act1 -> turning-point -> act2 -> epilogue, or failed from act2. */
export type Phase = 'act1' | 'turning-point' | 'act2' | 'epilogue' | 'failed';

/** Seasons in Southern Hemisphere order within a calendar year. */
export type Season = 0 | 1 | 2 | 3;
export const SEASON_NAMES: readonly string[] = ['summer', 'autumn', 'winter', 'spring'];

export type EnergySource =
  | 'coal'
  | 'gas'
  | 'rooftop-solar'
  | 'solar-farm'
  | 'wind'
  | 'offshore-wind'
  | 'hydro'
  | 'pumped-hydro'
  | 'battery'
  | 'tidal';

export type EventType =
  | 'heatwave'
  | 'bushfire'
  | 'drought'
  | 'flood'
  | 'marine-heatwave'
  | 'fish-kill'
  | 'blackout';

/** A thing that happened. Appended to GameState.events (queue) and GameState.eventLog (history). */
export interface SimEvent {
  id: number;
  type: EventType | 'story';
  year: number;
  season: Season;
  /** Absolute season counter since the scenario's start year. */
  seasonIndex: number;
  /** 0..~1.5 relative size. */
  severity: number;
  /** Human-readable, suitable for the log and for residents' reactions. */
  text: string;
  /** Epicentre in tile coordinates, if the event has one. */
  at?: { x: number; y: number };
  /** Numeric details (tilesAffected, unmetPct, ...). */
  data?: Record<string, number>;
  /** Present on 'story' events from residents, dilemmas, wildlife, Country, the circular tier and satellites. */
  story?: StoryMeta;
}

export interface ActiveEvent {
  type: EventType;
  /** Absolute season index at which it ends (exclusive). */
  endsAt: number;
  severity: number;
}

export interface GridBlock {
  demand: number;
  supply: number;
  unmet: number;
  /** Output by source, in power units. */
  bySource: Partial<Record<EnergySource, number>>;
  charged: number;
  discharged: number;
  curtailed: number;
}

/** Result of balancing the grid for one season (two blocks: day and night). */
export interface GridReport {
  year: number;
  season: Season;
  seasonIndex: number;
  /** Average demand (power units) by sector after seasonal and block multipliers. */
  demand: { homes: number; industry: number; transport: number };
  day: GridBlock;
  night: GridBlock;
  demandTotal: number;
  /** Fraction of the season's energy demand that went unmet (0..1). */
  unmetFrac: number;
  /** Installed capacity by source (power units). */
  capacity: Partial<Record<EnergySource, number>>;
  /** Average output by source over the season. */
  generation: Partial<Record<EnergySource, number>>;
  emissionsKt: number;
  renewableShare: number;
  storageLevel: number;
  blackout: boolean;
}

export interface TurningPoint {
  crisis: EventType;
  title: string;
  text: string;
  /** Short note the scientist character reads out over the player's graphs. */
  scientistNote: string;
  /** Which resident is personally affected (matches the empathy-layer resident id; placeholder until residents exist). */
  residentId: string;
  /** Snapshot of the player's Act 1 outcome, for the graphs on the card. */
  stats: { year: number; co2: number; tempC: number; realTempC: number; cumulativeKt: number; estuaryHealth: number; bushRemaining: number; meters: Meters };
}

export type FailReason = 'meter-collapse' | 'warming-cap';

export interface YearRecord {
  year: number;
  co2: number;
  tempC: number;
  eqTempC: number;
  emissionsKt: EmissionsBySource;
  totalKt: number;
  meters: Meters;
  budget: number;
  population: number;
  unmetFrac: number;
  renewableShare: number;
  estuaryHealth: number;
  meanHealth: number;
  reefHealth: number;
}

export interface ObjectiveResult {
  id: string;
  label: string;
  bonus: boolean;
  metric: string;
  op: '<=' | '>=';
  target: number;
  current: number | null;
  /** met / missed are final (year reached); on-track / at-risk are provisional; pending depends on a later tier. */
  status: 'met' | 'missed' | 'on-track' | 'at-risk' | 'pending';
  pendingTier?: string;
}

export interface Outcome {
  year: number;
  success: boolean;
  objectives: ObjectiveResult[];
  /** Required objectives that could not be judged yet (later tiers). */
  pendingRequired: string[];
}

export interface Act2State {
  startYear: number;
  /** Next season to simulate within `year`. */
  season: Season;
  /** Progress (micro-seasons, 0..999999) towards the next season; keeps tick() frame-rate independent. */
  clockMicro: number;
  /** Equilibrium temperature for current CO2; tempC relaxes towards it. */
  eqTempC: number;
  /** Energy held in storage (power units x one block). */
  storageLevel: number;
  /** Transient Society penalty from events and blackouts (decays each season). */
  stress: number;
  stressSum: number;
  yearEm: EmissionsBySource;
  yearUnmetSum: number;
  yearSeasons: number;
  lastUnmetFrac: number;
  /** Consecutive years each meter has been at 0. */
  zeroYears: Meters;
  /** Added to Society (residents / dilemmas can nudge it). Clamped to -60..+20. */
  societyAdjust: number;
  active: ActiveEvent[];
  lastEventIdx: Partial<Record<EventType, number>>;
  nextEventId: number;
  lastGrid: GridReport | null;
  /** building uid -> utilisation 0..1 of dispatchable plants last season. */
  utilisation: Record<string, number>;
  /** Excavation / remediation sites that did work last season (uids). */
  activeRemediation: number[];
  yearly: YearRecord[];
  outcome: Outcome | null;
  failure: { reason: FailReason; text: string; year: number } | null;
}

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
  phase: Phase;
  /** Act 2 simulation state (inert defaults before Act 2). */
  a2: Act2State;
  /** Open-ended flags other systems (residents, Country, satellites, circular) can set / read. */
  flags: Record<string, boolean | number>;
  /** Unconsumed events, oldest first. Consumers call consumeEvents(). Capped. */
  events: SimEvent[];
  /** Permanent human-readable log, oldest first. Capped. */
  eventLog: SimEvent[];
  turningPoint: TurningPoint | null;
  /** Residents, their moods and story arcs. */
  residents: ResidentsState;
  /** Dilemma cards offered and decided. */
  dilemmas: DilemmasState;
  /** Species populations (Act 2). */
  wildlife: WildlifeState;
  /** Partnership with the local Aboriginal community. */
  country: CountryState;
  /** Waste-hierarchy tier: legacy buildings, disposal choices and recycling research. */
  circular: CircularState;
  /** Satellite overlays and the marine heatwave early warning. */
  satellites: SatelliteState;
}

export type DisposalHow = 'repurpose' | 'recycle' | 'landfill';

export type Action =
  | { type: 'place'; building: BuildingId; x: number; y: number; rotation?: Rotation }
  | { type: 'demolish'; x: number; y: number }
  | { type: 'clear'; x: number; y: number }
  /** Answer a story beat that asked the player something. */
  | { type: 'respond'; beatId: string; optionId: string }
  /** Decide a dilemma card. */
  | { type: 'choose'; dilemmaId: string; optionId: string }
  /** Ask the community about a significant place before building (any tile of the site). */
  | { type: 'consult'; x: number; y: number }
  /** Return a patch of bushland to Traditional Owner co-management (any tile of the patch). */
  | { type: 'comanage'; x: number; y: number }
  /** Cool mosaic burn on a co-managed bush patch (cool season only). */
  | { type: 'burn'; x: number; y: number }
  /** Deal with a legacy Act 1 site once the circular tier is open. `into` picks the repurpose target. */
  | { type: 'dispose'; x: number; y: number; how: DisposalHow; into?: string }
  /** Buy a recycling innovation. */
  | { type: 'research'; id: string }
  /** Buy a satellite overlay (needs a ground station). */
  | { type: 'subscribe'; overlay: SatelliteOverlay }
  /** Act on a satellite early warning (cut runoff before the marine heatwave arrives). */
  | { type: 'mitigate' };

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
  | 'not-bush'
  | 'bad-siting'
  | 'invalid'
  | 'not-open'
  | 'wrong-season'
  | 'already-done';

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
