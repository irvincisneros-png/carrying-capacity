/**
 * Types for the learning layer (WP8): the water-quality field kit, predictions, the player's own words (reflections,
 * the letter), the "My household" ticks and the field guide terms already met. Plain JSON data, kept in the optional
 * `GameState.learn` so older saves load unchanged. Type-only module.
 */

export type KitSite = 'river' | 'estuary';
export type Verdict = 'ok' | 'high' | 'low';

/** One measured indicator, next to the trigger value it is compared with. */
export interface KitIndicator {
  id: 'do' | 'tn' | 'tp' | 'turb' | 'ph' | 'ec';
  label: string;
  value: number;
  unit: string;
  /** Plain description of the NSW / ANZECC default trigger range, e.g. "85 to 110% saturation". */
  trigger: string;
  /** Lowest and highest value counted as inside the trigger range (null = no limit that side). */
  lo: number | null;
  hi: number | null;
  verdict: Verdict;
}

export interface KitBug {
  id: string;
  name: string;
  /** SIGNAL2 sensitivity grade 1 (tolerant) to 10 (sensitive). */
  grade: number;
  count: number;
}

export interface KitReading {
  /** Calendar year of the sample (the decade start in Act 1 as the clock reads it). */
  year: number;
  act: 1 | 2;
  site: KitSite;
  /** True for the free survey that closes a prediction when the player did not test (no money spent). */
  auto?: boolean;
  indicators: KitIndicator[];
  bugs: KitBug[];
  /** SIGNAL2-style score: abundance-weighted mean grade of the bugs found. */
  signal: number;
  /** 0..100 summary used to judge better / same / worse. */
  health: number;
  tiles: number;
}

export type Trend = 'better' | 'same' | 'worse';

export interface KitPrediction {
  /** Calendar year when it was made and the bug score and health then. */
  year: number;
  baseSignal: number;
  baseHealth: number;
  choice?: Trend;
  text?: string;
  /** Filled in when the prediction closes. */
  resolvedYear?: number;
  resultSignal?: number;
  resultHealth?: number;
  actual?: Trend;
}

export interface LearnState {
  kit: KitReading[];
  predictions: KitPrediction[];
  /** The period (decade start in Act 1, year in Act 2) of the last paid test, or -1. */
  lastTest: number;
  /** Reflection answers by prompt text, and the letter. */
  reflections: Record<string, string>;
  letter: string;
  /** "Things I could try" ticked on the My household page. */
  household: string[];
  /** Field guide terms the player has met (underlined and explained the first time). */
  terms: string[];
}

export const emptyLearn = (): LearnState => ({ kit: [], predictions: [], lastTest: -1, reflections: {}, letter: '', household: [], terms: [] });

export type LearnAction =
  | { type: 'learn'; op: 'test'; site?: KitSite }
  | { type: 'learn'; op: 'predict'; choice?: Trend; text?: string }
  | { type: 'learn'; op: 'reflect'; key: string; text: string }
  | { type: 'learn'; op: 'letter'; text: string }
  | { type: 'learn'; op: 'household'; id: string; on: boolean }
  | { type: 'learn'; op: 'term'; id: string };
