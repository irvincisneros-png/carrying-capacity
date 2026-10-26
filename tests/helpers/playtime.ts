/**
 * Margins and play-time estimates for the scripted runs.
 *
 * Margin: how far the thoughtful run's outcome beat the target, as a share of the target (years for "by year" goals, as a
 * share of the time left). Binary goals (a count that must stay at zero) have no margin and are skipped.
 *
 * Play time (minutes) for a human, from what the run made them do:
 *   - Act 1: 1.6 minutes per decade (read the report, place buildings, press next);
 *   - turning point: 3, epilogue and report card: 5;
 *   - Act 2: one year is 15 seconds at 1x and a typical player runs it at 2x with pauses, so 7.5 seconds a year;
 *   - each sitting of placing buildings (one type in one year) is about 15 seconds, and each extra building in it 3 more;
 *   - every other action (a lever, a consultation, a repurposing, a rehab step, one drag of retrofits) is about 15 seconds, the fourth to eighth of the same kind 5;
 *   - every dilemma card or story question answered is about 55 seconds (reading, the evidence button, deciding);
 *   - every story line read in Town Voices is about 5 seconds, a wildlife line 2; the lines that only report an action already
 *     counted (Caring for Country, the circular economy) or sit inside a card's 55 seconds are not counted again;
 *   - a map bigger than the original 1024 tiles takes longer to read and to pan round before each round of placing: half a minute
 *     per Act 2 decade for every extra 1024 tiles (the 64x64 maps are 4x the original area and the 72x72 city 5x, so about 11 and 15
 *     minutes; the brush tools save clicks the estimator does not count, so this stays as an allowance for panning and reading).
 */
import { getScenario, objectiveStatus } from '../../src/sim';
import type { GameState } from '../../src/sim';

export interface Margin {
  id: string;
  value: number;
  target: number;
  /** Relative slack, 0 = just met. */
  margin: number;
}

export function margins(s: GameState): Margin[] {
  const sc = getScenario(s.scenarioId);
  const out: Margin[] = [];
  for (const o of objectiveStatus(s)) {
    if (o.bonus || o.current === null) continue;
    if (o.target === 0) continue;
    if (o.metric === 'netZeroYear') {
      const left = o.target - sc.act2.startYear;
      out.push({ id: o.id, value: o.current, target: o.target, margin: (o.target - o.current) / left });
    } else if (o.op === '>=') {
      out.push({ id: o.id, value: o.current, target: o.target, margin: (o.current - o.target) / Math.abs(o.target) });
    } else {
      out.push({ id: o.id, value: o.current, target: o.target, margin: (o.target - o.current) / Math.abs(o.target) });
    }
  }
  return out;
}

export function minMargin(s: GameState): number {
  return Math.min(...margins(s).map((m) => m.margin));
}

/**
 * Repeated identical actions (the tenth cool burn, the sixth recycled rail siding) are routine: the first three of a kind take the
 * full time, later ones a third of it (the same tool, the same menu, a different tile), and a kind counts at most 8 times.
 */
const sumActs = (s: GameState, prefixes: readonly string[]): number => {
  // Recycling and repurposing are one menu with a different building each time (a Coal Coast game does two dozen of them): all the
  // kinds of one menu share the first-three-in-full rule, so the dozenth repurposing is the routine click it is, not a new decision.
  const grouped = new Map<string, number>();
  for (const [k, v] of Object.entries(s.residents.actions)) {
    if (!prefixes.some((p) => k.startsWith(p))) continue;
    const key = /^(recycled|repurposed)\./.test(k) ? k.split('.')[0]! : k;
    grouped.set(key, (grouped.get(key) ?? 0) + v);
  }
  return [...grouped.values()].reduce((a, v) => a + Math.min(3, v) + Math.max(0, Math.min(8, v) - 3) / 3, 0);
};

export interface PlayTime {
  act1: number;
  act2: number;
  decisions: number;
  /** Act 2 placements, and how many separate sittings of placing (a type in a year) they came to. */
  placements: number;
  sittings: number;
  otherActions: number;
  minutes: number;
}

export function estimatePlayTime(s: GameState): PlayTime {
  const sc = getScenario(s.scenarioId);
  const decades = (sc.endYear - sc.startYear) / 10;
  const placed = s.buildings.filter((b) => b.builtYear > sc.endYear);
  const sittings = new Set(placed.map((b) => `${b.type}:${b.builtYear}`)).size;
  const otherActions = sumActs(s, ['policy.', 'consulted', 'comanaged', 'burned', 'researched.', 'subscribed.', 'rehab.', 'repurposed.', 'recycled.', 'retrofitted']);
  const decisions = s.dilemmas.decisions.filter((d) => d.optionId !== 'ignored').length + Object.values(s.residents.choices).filter((c) => c !== 'ignored').length;
  // Story lines worth reading. Country and circular lines are the feedback for actions already counted, a dilemma's offer and outcome
  // are inside its 55 seconds, and wildlife lines (returns, heat deaths, nests) are skimmed in 2 seconds.
  const lines = (ch: string): number => s.eventLog.filter((e) => e.type === 'story' && e.story?.channel === ch).length;
  // The yearly growth line is a calm Log entry nobody stops to read.
  const skipped = ['research', 'country', 'circular', 'dilemma', 'wildlife', 'growth'];
  const stories = s.eventLog.filter((e) => e.type === 'story' && !skipped.includes(e.story?.channel ?? '')).length + (lines('wildlife') * 2) / 5;
  const years = sc.act2.endYear - sc.act2.startYear;
  const extraMap = Math.max(0, s.grid.w * s.grid.h / 1024 - 1) * (years / 10) * 0.5;
  const act1 = decades * 1.6 + (decades > 0 ? 3 : 0);
  const act2 = years * (7.5 / 60) + (sittings * 15) / 60 + ((placed.length - sittings) * 3) / 60 + (otherActions * 15) / 60
    + (decisions * 55) / 60 + (stories * 5) / 60 + extraMap + 3 + 5;
  return { act1, act2, decisions, placements: placed.length, sittings, otherActions, minutes: act1 + act2 };
}
