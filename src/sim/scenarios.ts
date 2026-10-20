import type { BuildingId, ScenarioId } from './types';

export type Difficulty = 'tutorial' | 'easy' | 'medium' | 'hard' | 'expert';
export type TerrainKind = 'coast' | 'valley' | 'river' | 'island' | 'outback' | 'city';

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
  /** Set when the data is a placeholder awaiting its own terrain generator / balance pass. */
  todo?: string;
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
    mapW: 32,
    mapH: 32,
    seed: 1850,
    terrain: COAST,
    startYear: 1850,
    endYear: 2020,
    startBudget: 100,
    availability: {},
    modifiers: { ...DEFAULT_MODS },
  },
  'green-valley': {
    id: 'green-valley',
    name: 'Green Valley',
    difficulty: 'tutorial',
    blurb: 'A small valley to learn the ropes: guided build, then clean, then restore.',
    mapW: 16,
    mapH: 16,
    seed: 7,
    terrain: { ...COAST, kind: 'valley', seaFrac: 0.2, bushCover: 0.7, reefRadius: 1 },
    startYear: 1850,
    endYear: 1950,
    startBudget: 150,
    availability: { steelworks: { disabled: true }, coalpower: { unlock: 1920 } },
    modifiers: { ...DEFAULT_MODS, budgetMult: 1.5, hintLevel: 3, eventSeverity: 0 },
    todo: 'Needs its own valley terrain generator and guided-step script (reuses coast generator for now).',
  },
  'river-town': {
    id: 'river-town',
    name: 'River Town',
    difficulty: 'medium',
    blurb: 'A Murray-Darling inland town: water, drought, irrigation and salinity.',
    mapW: 32,
    mapH: 32,
    seed: 1901,
    terrain: { ...COAST, kind: 'river', seaFrac: 0.08, bushCover: 0.5, reefRadius: 0 },
    startYear: 1850,
    endYear: 2020,
    startBudget: 90,
    availability: { port: { disabled: true }, outfall: { unlock: 1900 } },
    modifiers: { ...DEFAULT_MODS, eventSeverity: 1.3, hintLevel: 1 },
    todo: 'Needs inland river terrain (no sea), water-cycle mechanics and salinity.',
  },
  'reef-island': {
    id: 'reef-island',
    name: 'Reef Island',
    difficulty: 'hard',
    blurb: 'A tropical island beside a reef: sea-level rise, bleaching and a tourism economy.',
    mapW: 32,
    mapH: 32,
    seed: 2007,
    terrain: { ...COAST, kind: 'island', seaFrac: 0.4, escarpmentFrac: 0.05, reefRadius: 5 },
    startYear: 1850,
    endYear: 2020,
    startBudget: 80,
    availability: { coalmine: { disabled: true } },
    modifiers: { ...DEFAULT_MODS, eventSeverity: 1.5, climateSensitivityMult: 1.15, hintLevel: 0 },
    todo: 'Needs island terrain (sea on all sides), tourism economy and sea-level model.',
  },
  'red-dirt': {
    id: 'red-dirt',
    name: 'Red Dirt',
    difficulty: 'hard',
    blurb: 'An outback mining town: solar and storage, scarce water, heatwaves, mine rehab.',
    mapW: 32,
    mapH: 32,
    seed: 1893,
    terrain: { ...COAST, kind: 'outback', seaFrac: 0.02, bushCover: 0.25, escarpmentFrac: 0.2, reefRadius: 0 },
    startYear: 1850,
    endYear: 2020,
    startBudget: 80,
    availability: { port: { disabled: true }, outfall: { disabled: true } },
    modifiers: { ...DEFAULT_MODS, eventSeverity: 1.5, climateSensitivityMult: 1.1, remediationYears: 30, hintLevel: 0 },
    todo: 'Needs arid inland terrain generator, scarce water and heatwave events.',
  },
  'net-zero-city': {
    id: 'net-zero-city',
    name: 'Net Zero City',
    difficulty: 'expert',
    blurb: 'A big coastal city starting in 2025 with a tight budget and a short runway to net zero.',
    mapW: 48,
    mapH: 48,
    seed: 2025,
    terrain: { ...COAST, kind: 'city', bushCover: 0.2 },
    startYear: 2025,
    endYear: 2035,
    startBudget: 60,
    availability: {},
    modifiers: { ...DEFAULT_MODS, budgetMult: 0.7, eventSeverity: 2, climateSensitivityMult: 1.2, remediationYears: 10, hintLevel: 0 },
    todo: 'Needs a pre-built city start state, Act 2 building set and 2025-2100 timeline.',
  },
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
