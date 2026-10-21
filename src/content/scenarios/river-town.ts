import type { ScenarioDef } from '../../sim/scenarios';
import { RIVER_TOWN_TURNING } from '../turning/river-town';

/** River Town (medium): a Murray-Darling irrigation town sharing a river between taps, farms and the river itself. */
export const RIVER_TOWN: ScenarioDef = {
  id: 'river-town',
  name: 'River Town',
  difficulty: 'medium',
  blurb: 'A Murray-Darling inland town: share the river between the taps, the farms and the fish, through droughts, salt and algae.',
  biome: 'inland-river',
  mechanics: ['river'],
  playMinutes: [80, 110],
  mapW: 64,
  mapH: 64,
  pollutionRefTiles: 1024,
  landReachTiles: 1600,
  seed: 1901,
  terrain: { kind: 'river', seaFrac: 0, escarpmentFrac: 0.1, bushCover: 0.5, riverRowFrac: 0.4, reefRadius: 0, coastWobble: 0 },
  startYear: 1880,
  endYear: 2020,
  startBudget: 90,
  availability: {
    port: { disabled: true },
    steelworks: { disabled: true },
    outfall: { unlock: 1900 },
    excavation: { disabled: true },
    reservoir: { unlock: 1900 },
    resort: { disabled: true },
    seawall: { disabled: true },
  },
  modifiers: { budgetMult: 1, eventSeverity: 1.5, climateSensitivityMult: 1.1, remediationYears: 25, hintLevel: 1 },
  policies: [
    {
      id: 'alloc.town', label: 'Town water share', min: 0.05, max: 0.6, step: 0.05, default: 0.15, unit: 'of the river',
      blurb: 'The maximum share of river flow the town may take. A larger share keeps the taps running in a drought but leaves less for farms and the river.',
    },
    {
      id: 'alloc.env', label: 'Share left for the river', min: 0.05, max: 0.7, step: 0.05, default: 0.2, unit: 'of the river',
      blurb: 'The share set aside for fish, red gums and billabongs. The farms get whatever is left over.',
    },
    {
      id: 'drought.plan', label: 'Drought plan', min: 0, max: 1, step: 1, default: 0, unit: 'level', costPerYear: [0, 4],
      blurb: 'In normal seasons, half of any water flowing past above the river\'s own share is banked in storage for the farms. When a drought is declared, town water restrictions start (20% less), farmers irrigate only their best paddocks (30% less), and the banked water carries the farms through. Switch it on before the dry years: the bank only fills in wet ones.',
    },
  ],
  act1: {
    intro: 'An inland river town in 1880: farms, a weir and the great river that all of it depends on. Over the next 140 years you will build the town and its farms. The river will show you what each choice costs.',
    why: 'Your goals for the boom:',
    goals: [
      { id: 'people', label: 'Grow to 350 people by 2020', metric: 'population', op: '>=', target: 350 },
      { id: 'jobs', label: 'Give 300 of them jobs', metric: 'filledJobs', op: '>=', target: 300 },
      { id: 'power', label: 'Keep the lights on: power for every building', metric: 'powerCovered', op: '>=', target: 1 },
      { id: 'careful', label: 'Grow without wrecking it: keep Environment at 55 or more', metric: 'environment', op: '>=', target: 55, bonus: true },
    ],
  },
  act2: {
    carryOverCap: 500,
    fundShare: 0.5,
    fundYears: 25,
    carryOverNote: 'Most of the boom\'s profits went to the irrigation companies and the banks.',
    startYear: 2025,
    endYear: 2100,
    warmingCap: 2.7,
    meterFailYears: 3,
    features: { tidal: false },
    weedPressure: 1,
    fireProneness: 1.2,
    rainfall: 0.75,
    floodRunoff: 0.35,
    eventMult: { drought: 2.5, heatwave: 1.2 },
    turningPoint: RIVER_TOWN_TURNING,
    objectives: [
      { id: 'river', label: 'Bring the river back to good health (60 or more, average of the last 10 years)', metric: 'riverHealth', op: '>=', target: 60, avgYears: 10 },
      { id: 'taps', label: 'No town water failures after 2040', metric: 'townWaterFailures', op: '<=', target: 0 },
      { id: 'farms', label: 'Keep the farms viable (50 or more)', metric: 'farmViability', op: '>=', target: 50 },
      { id: 'platypus', label: 'The platypus returns', metric: 'wildlifeThriving', op: '>=', target: 1, bonus: true, pendingTier: 'wildlife' },
    ],
  },
};
