/**
 * Field kit content: default trigger values and SIGNAL2-style bug grades.
 * Sources (docs/research/wp8-wp9-facts.md section 3):
 *  - Trigger values: NSW Environment and Heritage, Indicators of Environmental Outcomes, quoting the ANZECC/ARMCANZ (2000)
 *    default trigger values for lowland rivers in south-east Australia, which NSW still uses with the ANZG (2018).
 *    The guidelines say site-specific values are better and the old defaults are guides, not pass/fail lines.
 *  - Bug grades: SIGNAL2 (Chessman 2003, CSIRO Marine and Freshwater Research), order-level grades as used in Waterwatch
 *    guides. Score bands are the Victorian Waterwatch ones and suit "normal" streams.
 */
import type { ScenarioId } from '../sim/types';

export type KitRegion = 'coastal' | 'inland';

export interface Triggers {
  doLo: number;
  doHi: number;
  tp: number;
  tn: number;
  turbLo: number;
  turbHi: number;
  phLo: number;
  phHi: number;
  ecLo: number;
  ecHi: number;
}

export const TRIGGERS: Record<KitRegion, Triggers> = {
  // Lowland rivers draining to the coast of south-east Australia.
  coastal: { doLo: 85, doHi: 110, tp: 25, tn: 350, turbLo: 6, turbHi: 50, phLo: 6.5, phHi: 8.5, ecLo: 125, ecHi: 2200 },
  // Murray-Darling lowland rivers (River Town and Red Dirt stand in for inland Australia).
  inland: { doLo: 85, doHi: 110, tp: 50, tn: 500, turbLo: 6, turbHi: 50, phLo: 6.5, phHi: 8.5, ecLo: 125, ecHi: 2200 },
};

export const REGION: Record<ScenarioId, KitRegion> = {
  'green-valley': 'coastal',
  'coal-coast': 'coastal',
  'reef-island': 'coastal',
  'net-zero-city': 'coastal',
  'river-town': 'inland',
  'red-dirt': 'inland',
};

export interface BugGroup {
  id: string;
  name: string;
  grade: number;
  /** Typical count in a clean 20-dip sample. */
  base: number;
  blurb: string;
}

/** Order-level SIGNAL2 grades from the research file (10 = most sensitive to pollution). */
export const BUGS: readonly BugGroup[] = [
  { id: 'stonefly', name: 'Stonefly nymphs', grade: 10, base: 10, blurb: 'Need cool, clear, well-oxygenated water.' },
  { id: 'mayfly', name: 'Mayfly nymphs', grade: 9, base: 16, blurb: 'Graze algae on stones. Fade out when the water clouds or loses oxygen.' },
  { id: 'caddis', name: 'Caddisfly larvae', grade: 8, base: 14, blurb: 'Build little cases of sand and twigs.' },
  { id: 'mite', name: 'Water mites', grade: 6, base: 4, blurb: 'Tiny red spiders of the creek.' },
  { id: 'beetle', name: 'Water beetles', grade: 5, base: 6, blurb: 'Middle of the road: some pollution is fine.' },
  { id: 'shrimp', name: 'Shrimps and yabbies', grade: 4, base: 5, blurb: 'Hardy, but they still need clean gravel.' },
  { id: 'dragon', name: 'Dragonfly and damselfly nymphs', grade: 3, base: 3, blurb: 'Predators that cope with a fair bit.' },
  { id: 'fly', name: 'True-fly larvae', grade: 3, base: 3, blurb: 'Include biting midge and mosquito larvae.' },
  { id: 'midge', name: 'Midge larvae (bloodworms)', grade: 3, base: 3, blurb: 'Red worms that boom when the water is rich in nutrients.' },
  { id: 'worm', name: 'Segmented worms', grade: 2, base: 2, blurb: 'Live in muddy, low-oxygen bottoms.' },
  { id: 'bug', name: 'True bugs (water boatmen)', grade: 2, base: 3, blurb: 'Breathe air from the surface, so they cope with low oxygen.' },
  { id: 'flatworm', name: 'Flatworms', grade: 2, base: 1, blurb: 'Soft and flat; common in poor water.' },
  { id: 'snail', name: 'Pouch snails', grade: 1, base: 2, blurb: 'The most tolerant: they thrive where little else can.' },
];

export const SIGNAL_BANDS: readonly { min: number; label: string; tone: 'good' | 'mild' | 'poor' | 'bad'; text: string }[] = [
  { min: 6, label: 'Healthy', tone: 'good', text: 'Many sensitive bugs. The stream is in good shape.' },
  { min: 5, label: 'Mild pollution', tone: 'mild', text: 'Some sensitive bugs are missing. Something is stressing the stream.' },
  { min: 4, label: 'Moderate pollution', tone: 'poor', text: 'Mostly tolerant bugs. The stream is clearly stressed.' },
  { min: 0, label: 'Severe pollution', tone: 'bad', text: 'Only the toughest bugs are left.' },
];

export const KIT_SOURCE =
  'Trigger values are the ANZECC/ARMCANZ (2000) defaults for lowland rivers, quoted by NSW Environment and Heritage and still used with the 2018 Australian and New Zealand Guidelines. ' +
  'They are guides, not pass/fail lines: the guidelines prefer values set for each stream. Bug grades come from SIGNAL2 (CSIRO, Chessman 2003); the bands are from Waterwatch guides and suit normal streams.';

export const KIT_CAUTIONS: Partial<Record<ScenarioId, string>> = {
  'reef-island': 'Reef Island is tropical, where the guideline values differ. The game uses the south-east Australian ones as a rough guide.',
  'red-dirt': 'Inland and outback streams can be naturally salty and muddy. Compare your readings with the first test, not only with the guide.',
};

export const ESTUARY_CAUTION =
  'The guideline values for estuaries are not the same as for rivers. The game uses the river values as a rough guide, and does not judge the salt, because the tide makes estuaries salty anyway.';

/** What each indicator tells you, for the kit's "what is this?" lines. */
export const INDICATOR_HELP: Record<string, string> = {
  do: 'Dissolved oxygen is the oxygen in the water that fish and bugs breathe. It drops when algae die and rot, or when the water is warm.',
  tn: 'Total nitrogen comes from fertiliser, sewage and animal waste. Too much feeds algae.',
  tp: 'Total phosphorus comes from fertiliser, sewage and soil washed off bare ground. Too much feeds algae.',
  turb: 'Turbidity is how cloudy the water is. Mud smothers fish eggs and blocks sunlight.',
  ph: 'pH tells you how acidic or alkaline the water is. Mines and industry can push it away from the middle.',
  ec: 'Conductivity shows how salty the water is. Irrigation, low flow and bores raise it.',
};

export const GLOW_UP = {
  better: 'Better: the bug score goes up.',
  same: 'About the same.',
  worse: 'Worse: the bug score goes down.',
} as const;
