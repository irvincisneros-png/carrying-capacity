/**
 * Runtime state of the "empathy and care" layers: residents, dilemmas, wildlife, Caring for Country, the circular
 * tier and satellites. Plain JSON-friendly data (no Sets / Maps / typed arrays) so it saves and clones cheaply.
 * Type-only module: nothing here imports runtime code.
 */
import type { BuildingId } from './types';

// ---------------------------------------------------------------------------------------------------------
// Story events
// ---------------------------------------------------------------------------------------------------------

export type StoryChannel =
  | 'resident'
  | 'dilemma'
  | 'wildlife'
  | 'country'
  | 'circular'
  | 'research'
  | 'satellite'
  | 'town';

export type StoryTone = 'warm' | 'concern' | 'joy' | 'loss' | 'neutral';

/** Extra payload carried by SimEvents of type 'story'. */
export interface StoryMeta {
  channel: StoryChannel;
  /** Resident id of the speaker, if a person is speaking. */
  speakerId?: string;
  speaker?: string;
  /** Portrait key for the UI (matches ResidentDef.portrait). */
  portrait?: string;
  /** The beat id / dilemma id / species id this event is about. */
  ref?: string;
  /** Present when the player is being asked something. Answer with {type:'respond'} or {type:'choose'}. */
  choice?: { prompt?: string; options: { id: string; label: string }[] };
  tone?: StoryTone;
  /** Content that must be reviewed by the local Aboriginal community before release. */
  needsConsultation?: boolean;
  /** Early-warning events: the action that reduces the harm ({type:'mitigate'}). */
  warning?: { kind: 'marine-heatwave'; arrivesSeasonIndex: number };
}

// ---------------------------------------------------------------------------------------------------------
// Residents
// ---------------------------------------------------------------------------------------------------------

export interface ResidentRuntime {
  /** 0..100. */
  mood: number;
  /** Mood change over the last update. */
  trend: number;
  /** Year the last beat fired (-1 if none yet). */
  lastBeatYear: number;
}

export interface ResidentsState {
  list: Record<string, ResidentRuntime>;
  /** beat id -> year it fired. */
  fired: Record<string, number>;
  /** beat id -> chosen option id ('ignored' when the player never answered). */
  choices: Record<string, string>;
  /** Beat ids with an unanswered choice. */
  pending: string[];
  /** Player action counters, e.g. 'built.steelworks', 'demolished.steelworks', 'consulted'. */
  actions: Record<string, number>;
  /** Light-touch Society nudge in Act 1 (-3..+3), applied by computeMeters. */
  nudge: number;
  /** The residents' share of a2.societyAdjust currently applied (so other writers are not overwritten). */
  applied: number;
  /** Highest values seen so far, e.g. 'heavyJobs'. */
  peaks: Record<string, number>;
  /** Mean mood by year (capped), for the report card. */
  history: { year: number; mean: number }[];
}

// ---------------------------------------------------------------------------------------------------------
// Dilemmas
// ---------------------------------------------------------------------------------------------------------

export interface DilemmaDecision {
  dilemmaId: string;
  optionId: string;
  year: number;
  title: string;
  optionLabel: string;
  /** Rough size of the consequences, used to rank "top decisions". */
  impact: number;
  evidenceBacked: boolean;
}

export interface DilemmasState {
  /** dilemma id -> year it was put on the table. */
  offered: Record<string, number>;
  /** Cards currently waiting for an answer. */
  pending: string[];
  decisions: DilemmaDecision[];
  /** Society adjustment accumulated from choices (bounded -10..+10 where it is applied). */
  adjust: number;
}

// ---------------------------------------------------------------------------------------------------------
// Wildlife
// ---------------------------------------------------------------------------------------------------------

export interface SpeciesRuntime {
  pop: number;
  peak: number;
  startPop: number;
  /** Habitat quality 0..1 at the last evaluation. */
  quality: number;
  /** Carrying capacity (animals) the habitat supports at the last evaluation. */
  capacity: number;
  /** Consecutive years the habitat has been suitable / unsuitable. */
  goodYears: number;
  badYears: number;
  /** Why the habitat is limited right now (plain text for tooltips). */
  limiting: string;
  /** Heat-stress accumulated this year (flying-fox). */
  heatStress: number;
  /** Turtle: summers a female came ashore to nest, and consecutive summers. */
  nests: number;
  nestStreak: number;
  lastNestYear: number;
  lostYear: number | null;
  arrivedYear: number | null;
  /** Named family id -> present. */
  families: Record<string, boolean>;
  /** Population by year (capped). */
  history: { year: number; pop: number }[];
}

export interface WildlifeState {
  species: Record<string, SpeciesRuntime>;
  initialised: boolean;
  /** Last year habitat was evaluated. */
  lastYear: number;
  /** Koalas killed on roads over the whole game. */
  roadKills: number;
}

// ---------------------------------------------------------------------------------------------------------
// Caring for Country
// ---------------------------------------------------------------------------------------------------------

export interface BurnRecord {
  year: number;
  tiles: number;
  /** Lowest tile index of the patch, to rate-limit burning each patch. */
  patch: number;
}

export interface CountryState {
  /** 0..100. Grown by respect, never purchased. */
  partnership: number;
  /** Significant-site cluster ids the community has been consulted about. */
  consulted: number[];
  /** Clusters built on without consultation. */
  disturbed: number[];
  /** Tile indices of bush returned to co-management. */
  comanaged: number[];
  burns: BurnRecord[];
  /** Regeneration boosts left by cool burns: tile indices + last season index they apply to. */
  boosts: { until: number; tiles: number[] }[];
  unlocked: { culturalBurning: boolean; fishing: boolean; dualNames: boolean };
  /** Year of the last passive "trust grows" step. */
  lastGrowthYear: number;
  log: { year: number; text: string; delta: number }[];
}

// ---------------------------------------------------------------------------------------------------------
// Circular tier
// ---------------------------------------------------------------------------------------------------------

export type DisposalStatus = 'standing' | 'rubble' | 'repurposed' | 'recycled' | 'landfilled';

export interface CircularItem {
  uid: number;
  type: BuildingId;
  x: number;
  y: number;
  w: number;
  h: number;
  status: DisposalStatus;
  year: number | null;
  /** Repurpose target (a BuildingId, or 'rehab' for returning the land to bush). */
  into: string | null;
}

export interface CircularState {
  items: CircularItem[];
  unlocked: boolean;
  unlockedYear: number | null;
  unlockReason: string | null;
  /** Completed research ids. */
  research: string[];
  /** Totals for the report card. */
  returnedBudget: number;
  disposalKt: number;
}

// ---------------------------------------------------------------------------------------------------------
// Satellites
// ---------------------------------------------------------------------------------------------------------

export type SatelliteOverlay = 'sst' | 'sealevel' | 'forest' | 'fire';

export interface MarineWarning {
  /** Season index at which the marine heatwave will arrive. */
  arrivesAt: number;
  severity: number;
  warnedYear: number;
  mitigated: boolean;
}

export interface SatelliteState {
  overlays: Record<SatelliteOverlay, boolean>;
  warning: MarineWarning | null;
  warningsGiven: number;
  mitigations: number;
  /** Coral health saved (percentage points of mean loss avoided), summed. */
  savedPct: number;
}
