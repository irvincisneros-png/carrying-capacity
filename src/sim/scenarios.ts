import { GREEN_VALLEY } from '../content/scenarios/green-valley';
import { NET_ZERO_CITY } from '../content/scenarios/net-zero-city';
import { RED_DIRT } from '../content/scenarios/red-dirt';
import { REEF_ISLAND } from '../content/scenarios/reef-island';
import { RIVER_TOWN } from '../content/scenarios/river-town';
import type { ObjectiveDef } from './objectives';
import type { BuildingId, EventType, ScenarioId, TileKindValue } from './types';

export type Difficulty = 'tutorial' | 'easy' | 'medium' | 'hard' | 'expert';
export type TerrainKind = 'coast' | 'valley' | 'river' | 'island' | 'outback' | 'city';

/** Look of the place, so the renderer can pick a palette (the sim never reads it). */
export type Biome = 'temperate' | 'valley' | 'inland-river' | 'tropical' | 'arid' | 'urban';

/** Scenario mechanics modules (see sim/mechanics). Data-driven: a scenario lists the ones it uses. */
export type MechanicsId = 'tutorial' | 'river' | 'reef' | 'outback' | 'city' | 'heat';

/** A player-adjustable lever (water allocation, reef culling, ...). Set with { type: 'policy', id, value }. */
export interface PolicyDef {
  id: string;
  label: string;
  blurb: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** Shown beside the control, e.g. '%' or 'level'. */
  unit?: string;
  /** Money per year at a given value (negative income). */
  costPerYear?: readonly number[] | number;
}

export interface TerrainParams {
  kind: TerrainKind;
  /** Fraction of the map width that is sea (east edge). */
  seaFrac: number;
  /** Fraction of width taken by the sandstone escarpment (west edge). */
  escarpmentFrac: number;
  /** Fraction of non-rock land tiles that start as bush. */
  bushCover: number;
  /** Row (as fraction of height) where the river enters on the west edge. */
  riverRowFrac: number;
  /** Radius of the offshore reef patch in tiles. */
  reefRadius: number;
  /** Amplitude of coastline wobble as a fraction of width. */
  coastWobble: number;
}

export interface BuildingOverride {
  unlock?: number;
  cost?: number;
  disabled?: boolean;
  /** Scenario wording for the build menu (e.g. Red Dirt calls the coal mine an open-cut mine). */
  name?: string;
  blurb?: string;
  /** Extra terrain kinds that satisfy the building's "must be near" rule here (an island's power station can use seawater). */
  nearTerrainAdd?: readonly TileKindValue[];
}

export interface ScenarioModifiers {
  /** Multiplies starting budget and per-decade income. */
  budgetMult: number;
  /** Event frequency/severity (used from Act 2). */
  eventSeverity: number;
  /** Multiplies the degrees-per-doubling of CO2 (1 = real-world transient response). */
  climateSensitivityMult: number;
  /** Years for remediation to complete (used from Act 2). */
  remediationYears: number;
  /** 0 = none, 3 = lots of hints. */
  hintLevel: number;
  /**
   * Scales the reference emissions pathway to the size of the place (default 1 = the Coal Coast town). A small island
   * would never move the climate against the full reference, so its reference is smaller: the same share of effort
   * gives the same share of warming.
   */
  emissionScale?: number;
  /**
   * How strongly the place's Act 1 emissions move the world's climate path (default 1). A small island's boom nudges
   * warming rather than deciding it: only this share of the gap between its emissions and the reference counts.
   */
  climateInfluence?: number;
}

/** Pure data describing the crisis that opens Act 2 (rendered by the UI, spoken by the scientist). */
export interface TurningPointDef {
  crisis: EventType;
  title: string;
  text: string;
  scientistNote: string;
  residentId: string;
}

/** Everything the Act 2 simulation needs to know about a scenario. */
export interface Act2Def {
  /** Calendar year Act 2 hands control to the player (years between Act 1's end and this are fast-forwarded). */
  startYear: number;
  endYear: number;
  /** Warming (C above pre-industrial) beyond which the town fails. */
  warmingCap: number;
  /** Consecutive years a meter may sit at 0 before the town fails. */
  meterFailYears: number;
  features: { tidal: boolean };
  /** 0 none .. 2 heavy: how fast weeds invade untended bare / pioneer edges. */
  weedPressure: number;
  /** Multiplier on bushfire ignition chance. */
  fireProneness: number;
  /** Multiplier on seasonal rainfall (< 1 drier). */
  rainfall: number;
  turningPoint: TurningPointDef;
  objectives: readonly ObjectiveDef[];
  /** Per-event-type multiplier on the chance of that event (on top of modifiers.eventSeverity). */
  eventMult?: Partial<Record<EventType, number>>;
  /** Multiplier on the runoff pulse a flood sends down the river (default 1; a big inland river dilutes it). */
  floodRunoff?: number;
  /** Multiplier on solar output (Red Dirt gets the strongest sun in the game). */
  solarCf?: number;
  /** Multiplier on wind output. */
  windCf?: number;
  /** Reef Island: how much warming the local coral tolerates before it bleaches, and how much a coral nursery helps. */
  reef?: {
    tolerance: number;
    nurseryBoost: number;
    /** How many nurseries' boost can stack on one reef tile (default 2). */
    nurseryStack?: number;
    /**
     * Extra warming (C) coral in clean water can take before it bleaches: reefs without nutrient and sediment stress
     * bleach later and recover faster. Scaled down as the water over the tile gets dirtier.
     */
    cleanWaterTolerance?: number;
  };
  /** Heat health: deaths per 1000 people per unit of heatwave severity, with no shade, cooling centres or power cuts. */
  heat?: { deathsPer1000: number };
  /** Year the circular economy tier opens (default 2050, or earlier once the town runs on clean power). */
  circularYear?: number;
  /** Yearly emissions (kt) at or below which the scenario counts as net zero. */
  netZeroKt?: number;
  /**
   * Most of the money the town can carry into Act 2 (thousands). The boom's profits mostly left with the companies;
   * without a cap Act 1 savings make every Act 2 choice free.
   */
  carryOverCap?: number;
  /** Shown on the turning point when the cap applies. */
  carryOverNote?: string;
  /**
   * Money above the cap is not simply lost: this share of it becomes a ring-fenced Transition Fund paid out in equal
   * yearly instalments over `fundYears` (0 or unset: no fund, the surplus is gone).
   */
  fundShare?: number;
  fundYears?: number;
  todo?: string;
}

export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  difficulty: Difficulty;
  blurb: string;
  mapW: number;
  mapH: number;
  seed: number;
  terrain: TerrainParams;
  startYear: number;
  /** Act 1 ends when the year reaches this value. */
  endYear: number;
  startBudget: number;
  availability: Partial<Record<BuildingId, BuildingOverride>>;
  modifiers: ScenarioModifiers;
  act2: Act2Def;
  /** Set when the data is a placeholder awaiting its own terrain generator / balance pass. */
  todo?: string;
  biome?: Biome;
  /** Mechanics modules this scenario uses. */
  mechanics?: readonly MechanicsId[];
  /** Player levers. */
  policies?: readonly PolicyDef[];
  /** 'city': createGame places a finished city and starts directly in Act 2 (no Act 1). */
  prebuilt?: 'city';
  /** Estimated minutes of real play, for the scenario-select card. */
  playMinutes?: readonly [number, number];
}

const COAST: TerrainParams = {
  kind: 'coast',
  seaFrac: 0.25,
  escarpmentFrac: 0.1,
  bushCover: 0.6,
  riverRowFrac: 0.55,
  reefRadius: 3,
  coastWobble: 0.16,
};

const COAL_COAST_OBJECTIVES: readonly ObjectiveDef[] = [
  { id: 'warming', label: 'Hold warming to 1.8 C or less by 2100', metric: 'warming', op: '<=', target: 1.8 },
  { id: 'estuary', label: 'Bring the estuary back to good water health (60+, average of the last 10 years)', metric: 'estuaryHealth', op: '>=', target: 60, avgYears: 10 },
  { id: 'society', label: 'Keep the town together: Society 50 or more', metric: 'society', op: '>=', target: 50 },
  {
    id: 'repurpose', label: 'Repurpose or recycle every Act 1 building', metric: 'act1Repurposed', op: '>=', target: 100,
    pendingTier: 'circular',
  },
  { id: 'wildlife', label: 'Koalas and turtles thriving', metric: 'wildlifeThriving', op: '>=', target: 1, bonus: true, pendingTier: 'wildlife' },
];

const act2Defaults = (over: Partial<Act2Def> & Pick<Act2Def, 'turningPoint'>): Act2Def => ({
  startYear: 2025,
  endYear: 2100,
  warmingCap: 2.6,
  meterFailYears: 3,
  features: { tidal: false },
  weedPressure: 1,
  fireProneness: 1,
  rainfall: 1,
  objectives: COAL_COAST_OBJECTIVES,
  ...over,
});

const DEFAULT_MODS: ScenarioModifiers = {
  budgetMult: 1,
  eventSeverity: 1,
  climateSensitivityMult: 1,
  remediationYears: 20,
  hintLevel: 1,
};

export const SCENARIOS: Readonly<Record<ScenarioId, ScenarioDef>> = {
  'coal-coast': {
    id: 'coal-coast',
    name: 'Coal Coast',
    difficulty: 'easy',
    blurb: 'Grow an Illawarra-style coastal town from 1850 to the present day.',
    playMinutes: [70, 100],
    mapW: 32,
    mapH: 32,
    seed: 1850,
    terrain: COAST,
    startYear: 1850,
    endYear: 2020,
    startBudget: 100,
    availability: {},
    modifiers: { ...DEFAULT_MODS },
    act2: act2Defaults({
      carryOverCap: 900,
      fundShare: 0.6,
      fundYears: 20,
      carryOverNote: 'Most of the boom\'s profits went to the steel and coal companies.',
      turningPoint: {
        crisis: 'fish-kill',
        title: 'The estuary goes quiet',
        text: 'One February morning Lena Tran finds the estuary silver with dead fish. Two hundred years of runoff, sewage and soil from the town have finally tipped it over in the heat.',
        scientistNote: 'Dr Priya Shah puts your graphs on the table: CO2 and the town\'s emissions have climbed together, and the water that used to flush the estuary clean is now carrying the town\'s waste into it. Warming will make every summer harder from here.',
        residentId: 'lena-tran',
      },
    }),
  },
  'green-valley': GREEN_VALLEY,
  'river-town': RIVER_TOWN,
  'reef-island': REEF_ISLAND,
  'red-dirt': RED_DIRT,
  'net-zero-city': NET_ZERO_CITY,
};

export const SCENARIO_IDS: readonly ScenarioId[] = [
  'coal-coast',
  'green-valley',
  'river-town',
  'reef-island',
  'red-dirt',
  'net-zero-city',
];

export function isScenarioId(s: string): s is ScenarioId {
  return Object.prototype.hasOwnProperty.call(SCENARIOS, s);
}

export function getScenario(id: ScenarioId): ScenarioDef {
  return SCENARIOS[id];
}
