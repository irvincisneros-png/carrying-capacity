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
 *   - every other action (a lever, a consultation, a repurposing, a rehab step) is about 15 seconds;
 *   - every dilemma card or story question answered is about 55 seconds (reading, the evidence button, deciding);
 *   - every story event read in Town Voices is about 5 seconds;
 *   - a map bigger than the original 1024 tiles takes longer to read and to pan round before each round of placing: half a minute
 *     per Act 2 decade for every extra 1024 tiles (the enlarged maps are 1.6x to 1.9x the old area, so about 2 to 3 minutes).
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

/** Repeated identical actions (the tenth cool burn, the fortieth rooftop panel) are routine, so each kind counts at most 8 times. */
const sumActs = (s: GameState, prefixes: readonly string[]): number =>
  Object.entries(s.residents.actions).filter(([k]) => prefixes.some((p) => k.startsWith(p))).reduce((a, [, v]) => a + Math.min(8, v), 0);

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
  const otherActions = sumActs(s, ['policy.', 'consulted', 'comanaged', 'burned', 'researched.', 'subscribed.', 'rehab.', 'repurposed.', 'recycled.']);
  const decisions = s.dilemmas.decisions.filter((d) => d.optionId !== 'ignored').length + Object.values(s.residents.choices).filter((c) => c !== 'ignored').length;
  const stories = s.eventLog.filter((e) => e.type === 'story' && e.story?.channel !== 'research').length;
  const years = sc.act2.endYear - sc.act2.startYear;
  const extraMap = Math.max(0, s.grid.w * s.grid.h / 1024 - 1) * (years / 10) * 0.5;
  const act1 = decades * 1.6 + (decades > 0 ? 3 : 0);
  const act2 = years * (7.5 / 60) + (sittings * 15) / 60 + ((placed.length - sittings) * 3) / 60 + (otherActions * 15) / 60
    + (decisions * 55) / 60 + (stories * 5) / 60 + extraMap + 3 + 5;
  return { act1, act2, decisions, placements: placed.length, sittings, otherActions, minutes: act1 + act2 };
}
