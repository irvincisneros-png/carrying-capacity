// Payload shapes for the empathy-layer UI components. The sim (being extended in parallel) will emit events of
// type 'story' / 'dilemma' / wildlife etc.; adapters in ./adapters.ts map whatever arrives onto these shapes, so the
// components stay stable while the sim API grows.

export type Mood = 'happy' | 'ok' | 'worried' | 'sad' | 'angry' | 'hopeful';

export interface Speaker {
  id: string;
  name: string;
  /** Short role line, e.g. "Fisher, estuary" */
  role?: string;
  /** Emoji-free portrait: initials + colour are generated when no image is given. */
  portrait?: string;
  colour?: string;
}

/** One line of resident dialogue: speech bubble on the map + an entry in the Town Voices feed. */
export interface StoryLine {
  id: string | number;
  speaker: Speaker;
  text: string;
  mood?: Mood;
  /** Tile the bubble points at (resident's home etc.). */
  at?: { x: number; y: number };
  year?: number;
}

export interface DilemmaImpact {
  /** Who / what: a resident name, "Koalas", "Budget", "Estuary" ... */
  who: string;
  /** -2 .. +2 (hurt a lot .. helped a lot) */
  effect: number;
  note?: string;
}

export interface DilemmaOption {
  id: string;
  label: string;
  detail?: string;
  cost?: number;
  impacts: DilemmaImpact[];
}

export interface DilemmaCard {
  id: string | number;
  title: string;
  text: string;
  speaker?: Speaker;
  options: DilemmaOption[];
  /** "What does the evidence say?" */
  evidence?: string;
}

export interface SpeciesStatus {
  id: string;
  name: string;
  /** Named family / individual, e.g. "the Marri family" */
  family?: string;
  population: number;
  /** 0..1 habitat quality */
  habitat?: number;
  trend: -1 | 0 | 1;
  status: 'thriving' | 'stable' | 'struggling' | 'gone' | 'returning';
  needs?: string;
}

export interface ReportCardItem {
  label: string;
  grade: string;
  detail?: string;
  ok: boolean;
}

export interface ReportCard {
  title: string;
  stars: 0 | 1 | 2 | 3;
  items: ReportCardItem[];
  epilogues?: { speaker: Speaker; text: string }[];
  reflection?: string[];
}
