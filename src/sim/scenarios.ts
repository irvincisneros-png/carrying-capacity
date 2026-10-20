import type { ObjectiveDef } from './objectives';
import type { BuildingId, EventType, ScenarioId } from './types';

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
  { id: 'estuary', label: 'Bring the estuary back to good water health (60+)', metric: 'estuaryHealth', op: '>=', target: 60 },
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
      turningPoint: {
        crisis: 'fish-kill',
        title: 'The estuary goes quiet',
        text: 'One February morning Lena Tran finds the estuary silver with dead fish. Two hundred years of runoff, sewage and soil from the town have finally tipped it over in the heat.',
        scientistNote: 'Dr Priya Shah puts your graphs on the table: CO2 and the town\'s emissions have climbed together, and the water that used to flush the estuary clean is now carrying the town\'s waste into it. Warming will make every summer harder from here.',
        residentId: 'lena-tran',
      },
    }),
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
    act2: act2Defaults({
      startYear: 1950, endYear: 2000, warmingCap: 3,
      turningPoint: {
        crisis: 'fish-kill', title: 'Tutorial crisis', residentId: 'tutorial',
        text: 'Placeholder tutorial crisis.', scientistNote: 'Placeholder.',
      },
      todo: 'Tutorial Act 2 needs a guided script and its own timeline.',
    }),
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
    act2: act2Defaults({
      rainfall: 0.8, fireProneness: 1.2,
      turningPoint: {
        crisis: 'drought', title: 'The river runs thin', residentId: 'dot-harris',
        text: 'Placeholder: the river stops flowing past the farm.', scientistNote: 'Placeholder.',
      },
      todo: 'Needs River Town objectives (river health, water security).',
    }),
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
    act2: act2Defaults({
      warmingCap: 2.4,
      turningPoint: {
        crisis: 'marine-heatwave', title: 'The reef turns white', residentId: 'reef-guide',
        text: 'Placeholder: the reef bleaches.', scientistNote: 'Placeholder.',
      },
      todo: 'Needs Reef Island objectives (reef health, no homes lost to sea).',
    }),
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
    act2: act2Defaults({
      rainfall: 0.6, fireProneness: 1.3, weedPressure: 1.3, features: { tidal: false },
      turningPoint: {
        crisis: 'heatwave', title: 'The week the town stopped', residentId: 'mine-worker',
        text: 'Placeholder: a heatwave overloads the grid.', scientistNote: 'Placeholder.',
      },
      todo: 'Needs Red Dirt objectives (net zero 2060, mine rehab).',
    }),
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
    act2: act2Defaults({
      startYear: 2035, features: { tidal: true }, warmingCap: 2.2,
      turningPoint: {
        crisis: 'heatwave', title: 'Forty-seven degrees', residentId: 'city-resident',
        text: 'Placeholder: a heatwave hits the city.', scientistNote: 'Placeholder.',
      },
      todo: 'Needs a pre-built city start state and net-zero-by-2050 objectives.',
    }),
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
