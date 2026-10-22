// Rail badges: which sidebar buttons get a dot / count, and which pulse. Pure (no DOM), so tests can pin the rules.
// The app gathers a BadgeInput from the game state and the unread counters, and the Rail draws what comes back.

export type RailId =
  | 'goals' | 'needs' | 'power' | 'voices' | 'species' | 'policies' | 'research' | 'sats' | 'country'
  | 'kit' | 'guide' | 'graphs' | 'log' | 'household' | 'frame' | 'settings';

export interface RailBadge {
  /** Number to show; 0 means a plain dot. */
  n: number;
  /** What needs attention, for the hover text and screen readers ("2 buildings have no road"). */
  note: string;
  /** Gentle pulse: something that needs doing soon. */
  urgent: boolean;
}

export interface BadgeInput {
  phase: 'act1' | 'turning-point' | 'act2' | 'epilogue' | 'failed' | string;
  year: number;
  endYear: number;
  /** The town's needs bars (Homes, Jobs, Power, Water). */
  needs: { urgent: boolean; inactive?: boolean; label?: string }[];
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

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export function computeRailBadges(input: BadgeInput): Partial<Record<RailId, RailBadge>> {
  const out: Partial<Record<RailId, RailBadge>> = {};
  const live = input.phase === 'act1' || input.phase === 'act2';

  const goals = goalsNeedAttention(input);
  if (live && goals > 0) out.goals = { n: goals, urgent: false, note: `${plural(goals, 'goal needs', 'goals need')} attention` };

  if (live) {
    const urgentBars = input.needs.filter((b) => b.urgent && !b.inactive);
    const over = input.capacity === 'over';
    const count = input.noRoad + (over ? 1 : 0);
    if (urgentBars.length || count > 0) {
      const notes: string[] = [];
      if (urgentBars.length) notes.push(`urgent: ${urgentBars.map((b) => (b.label ?? 'need').toLowerCase()).join(', ')}`);
      if (input.noRoad > 0) notes.push(`${plural(input.noRoad, 'building has', 'buildings have')} no road`);
      if (over) notes.push('the town uses more than the land renews');
      out.needs = { n: urgentBars.length && count === 0 ? 0 : count, urgent: urgentBars.length > 0, note: notes.join('; ') };
    }
  }

  if (input.phase === 'act2' && input.powerShort) out.power = { n: 0, urgent: true, note: 'Blackout: power is short' };
  if (input.unreadVoices > 0) out.voices = { n: input.unreadVoices, urgent: false, note: `${plural(input.unreadVoices, 'new voice', 'new voices')}` };
  if (input.unreadTerms > 0) out.guide = { n: input.unreadTerms, urgent: false, note: `${plural(input.unreadTerms, 'new term', 'new terms')}` };
  if (input.unreadLog > 0) out.log = { n: 0, urgent: false, note: 'New events' };
  if (input.droughtOpen) out.policies = { n: 0, urgent: true, note: 'A drought is declared and the drought plan is off' };
  if (input.satWarning) out.sats = { n: 0, urgent: true, note: 'Satellite warning waiting' };
  if (input.projectsIdle) out.research = { n: 0, urgent: false, note: 'Savings could fund a community project' };
  return out;
}

/** True when any badge is showing (the phone "More" button borrows this for its own dot). */
export function anyBadge(b: Partial<Record<RailId, RailBadge>>): { any: boolean; urgent: boolean } {
  const list = Object.values(b);
  return { any: list.length > 0, urgent: list.some((x) => x?.urgent) };
}

export interface UrgentNeed { id: string; label: string; tip: string }

/** The one-line warning beside the clock: what is short, in the sim's own words ("Not enough jobs: 647 people have no work"). Act 1 only. */
export function urgentChipText(input: { phase: string; noRoad: number; urgent: UrgentNeed[] }): string {
  if (input.phase !== 'act1') return '';
  const first = input.urgent[0];
  if (first) {
    const sentence = first.tip.split(/\.\s/)[0]?.replace(/\.$/, '') ?? first.tip;
    return input.urgent.length > 1 ? `${sentence} (+${input.urgent.length - 1} more)` : sentence;
  }
  if (input.noRoad > 0) return `${plural(input.noRoad, 'building has', 'buildings have')} no road`;
  return '';
}

/** Which build tab "Show me" opens for an urgent need. */
export const NEED_TAB: Record<string, string> = { homes: 'homes', jobs: 'work', power: 'energy', water: 'waste' };

export interface GoalLite { label: string; status: string; bonus?: boolean; pct: number }

/** The goal worth a one-line chip: the first unmet goal, missed or at risk before merely on track, bonus goals last. */
export function pickGoalChip(goals: GoalLite[]): GoalLite | null {
  const open = goals.filter((g) => g.status !== 'met');
  const rank = (g: GoalLite): number => (g.bonus ? 10 : 0) + (g.status === 'missed' ? 0 : g.status === 'at-risk' ? 1 : g.status === 'on-track' ? 2 : 3);
  return open.slice().sort((a, b) => rank(a) - rank(b))[0] ?? null;
}
