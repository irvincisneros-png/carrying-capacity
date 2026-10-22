// Rail badges: which sidebar buttons get a dot / count, and which pulse. Pure (no DOM), so tests can pin the rules.
// The app gathers a BadgeInput from the game state and the unread counters, and the Rail draws what comes back.

export type RailId =
  | 'goals' | 'needs' | 'power' | 'voices' | 'species' | 'policies' | 'research' | 'sats' | 'country'
  | 'kit' | 'guide' | 'graphs' | 'log' | 'household' | 'frame' | 'settings';

export interface RailBadge {
  /** Number to show; 0 means a plain dot. */
  n: number;
  /** Gentle pulse: something that needs doing soon. */
  urgent: boolean;
}

export interface BadgeInput {
  phase: 'act1' | 'turning-point' | 'act2' | 'epilogue' | 'failed' | string;
  year: number;
  endYear: number;
  /** The town's needs bars (Homes, Jobs, Power, Water). */
  needs: { urgent: boolean; inactive?: boolean }[];
  /** Buildings with no connected road. */
  noRoad: number;
  /** Status of each goal currently listed (Act 1 or Act 2). */
  goals: ('met' | 'on-track' | 'at-risk' | 'missed' | 'pending' | string)[];
  /** Land-limits row: 'over' means the town uses more than the land renews. */
  capacity?: 'ok' | 'tight' | 'over' | string;
  /** Act 2 power grid is short of demand (blackout risk). */
  powerShort?: boolean;
  /** A drought is declared and the drought plan is off (River Town). */
  droughtOpen?: boolean;
  /** A satellite warning is waiting for the player. */
  satWarning?: boolean;
  /** Savings are piling up and no community project has been funded. */
  projectsIdle?: boolean;
  /** Unread counters, reset when the matching drawer is opened. */
  unreadVoices: number;
  unreadTerms: number;
  unreadLog: number;
}

/** Act 1 goals are "at risk" from the first year (nothing is built yet), so only count them in the last two decades. */
export function goalsNeedAttention(input: Pick<BadgeInput, 'phase' | 'year' | 'endYear' | 'goals'>): number {
  const late = input.phase !== 'act1' || input.year >= input.endYear - 20;
  let n = 0;
  for (const g of input.goals) if (g === 'missed' || (late && g === 'at-risk')) n++;
  return n;
}

export function computeRailBadges(input: BadgeInput): Partial<Record<RailId, RailBadge>> {
  const out: Partial<Record<RailId, RailBadge>> = {};
  const live = input.phase === 'act1' || input.phase === 'act2';

  const goals = goalsNeedAttention(input);
  if (live && goals > 0) out.goals = { n: goals, urgent: false };

  if (live) {
    const urgent = input.needs.some((b) => b.urgent && !b.inactive);
    const count = input.noRoad + (input.capacity === 'over' ? 1 : 0);
    if (urgent || count > 0) out.needs = { n: urgent && count === 0 ? 0 : count, urgent };
  }

  if (input.phase === 'act2' && input.powerShort) out.power = { n: 0, urgent: true };
  if (input.unreadVoices > 0) out.voices = { n: input.unreadVoices, urgent: false };
  if (input.unreadTerms > 0) out.guide = { n: input.unreadTerms, urgent: false };
  if (input.unreadLog > 0) out.log = { n: 0, urgent: false };
  if (input.droughtOpen) out.policies = { n: 0, urgent: true };
  if (input.satWarning) out.sats = { n: 0, urgent: true };
  if (input.projectsIdle) out.research = { n: 0, urgent: false };
  return out;
}

/** True when any badge is showing (the phone "More" button borrows this for its own dot). */
export function anyBadge(b: Partial<Record<RailId, RailBadge>>): { any: boolean; urgent: boolean } {
  const list = Object.values(b);
  return { any: list.length > 0, urgent: list.some((x) => x?.urgent) };
}

/** The one-line nudge chip near the Skip button: only when a need is urgent (or buildings have no road). */
export function urgentChipText(input: Pick<BadgeInput, 'phase' | 'noRoad'> & { urgentLabels: string[] }): string {
  if (input.phase !== 'act1') return '';
  if (input.urgentLabels.length) return `The town needs ${input.urgentLabels.join(' and ').toLowerCase()} now`;
  if (input.noRoad > 0) return `${input.noRoad} building${input.noRoad === 1 ? ' has' : 's have'} no road`;
  return '';
}
