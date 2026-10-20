/**
 * Guided steps for the Green Valley tutorial. A step is data: an instruction, a UI highlight key and a completion
 * condition evaluated on the game state (player action counters and metrics, never "is the thing still standing", so
 * a step stays done once done). tutorialStatus(state) tells the UI which step is current and what to highlight.
 */
import { TUTORIAL_STEPS } from '../content/tutorial';
import { condMet } from './conditions';
import type { Cond } from './conditions';
import { BUILDINGS } from './buildings';
import { canPlace } from './rules';
import type { BuildingId, GameState, Phase, Rotation } from './types';

export interface TutorialStep {
  id: string;
  title: string;
  /** Plain-language instruction, 1 to 3 short sentences. */
  instruction: string;
  /**
   * What the UI should draw attention to:
   * 'build:<buildingId>' (a build button), 'tool:<demolish|clear|inspect|dispose|comanage>', 'button:<name>'
   * (next-decade, start-transition, play, speed, objectives, animals), 'panel:<name>' (graphs, grid, voices),
   * 'tile:x,y' (a map tile) or 'tile:@<buildingId>' (the engine picks a good tile for that building and
   * tutorialStatus() resolves it to 'tile:x,y').
   */
  highlight: string;
  /** The step can only be current in these phases. */
  phase: readonly ('act1' | 'turning-point' | 'act2')[];
  /** The step is complete when this holds. */
  done: Cond;
  /** Shown if the player seems stuck. */
  hint?: string;
}

export interface TutorialStepStatus {
  id: string;
  title: string;
  instruction: string;
  highlight: string;
  done: boolean;
  current: boolean;
}

export interface TutorialStatus {
  /** False for every scenario except the tutorial. */
  active: boolean;
  steps: TutorialStepStatus[];
  /** Index of the current step, or -1 when finished or not active. */
  index: number;
  current: TutorialStep | null;
  /** The current step's highlight with any 'tile:@building' resolved. */
  highlight: string | null;
  /** Steps done / total. */
  doneCount: number;
  total: number;
  completed: boolean;
}

const PHASE_ORDER: Record<'act1' | 'turning-point' | 'act2', number> = { act1: 0, 'turning-point': 1, act2: 2 };
const phaseKey = (p: Phase): 'act1' | 'turning-point' | 'act2' => (p === 'epilogue' || p === 'failed' ? 'act2' : p);

export function tutorialStepsFor(scenario: GameState['scenarioId']): readonly TutorialStep[] {
  return TUTORIAL_STEPS[scenario] ?? [];
}

/** A good open tile for a building (nearest to the map's water when the building likes water), or null. Deterministic. */
export function suggestTile(state: GameState, building: BuildingId): { x: number; y: number; rotation: Rotation } | null {
  const def = BUILDINGS[building];
  const g = state.grid;
  const rich: GameState = { ...state, budget: 1e9 };
  const water: { x: number; y: number }[] = [];
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i];
    if (k === 3 || k === 2 || k === 8) water.push({ x: i % g.w, y: Math.floor(i / g.w) });
  }
  const wants = def.placement.nearTerrain !== undefined || building === 'wetland' || building === 'coalpower';
  let best: { x: number; y: number; rotation: Rotation; d: number } | null = null;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      for (const rotation of [0, 1] as const) {
        const c = canPlace(rich, building, x, y, rotation);
        if (!c.ok) continue;
        let d = 0;
        if (wants && water.length > 0) d = Math.min(...water.map((p) => Math.hypot(p.x - x, p.y - y)));
        else d = Math.hypot(x - g.w / 2, y - g.h / 2);
        // Prefer ground that is already cleared (no bush to remove).
        d += c.bushCleared * 0.5;
        if (!best || d < best.d - 1e-9) best = { x, y, rotation, d };
      }
    }
  }
  return best ? { x: best.x, y: best.y, rotation: best.rotation } : null;
}

export function tutorialStatus(state: GameState): TutorialStatus {
  const steps = tutorialStepsFor(state.scenarioId);
  if (steps.length === 0) {
    return { active: false, steps: [], index: -1, current: null, highlight: null, doneCount: 0, total: 0, completed: false };
  }
  // Steps are sequential: the current one is the first not done and available in this phase. A step from an earlier
  // phase that was never finished is skipped over; a step from a later phase is not reachable yet.
  const done = steps.map((s) => condMet(state, s.done));
  const now = PHASE_ORDER[phaseKey(state.phase)];
  let index = -1;
  for (let i = 0; i < steps.length; i++) {
    if (done[i] === true) continue;
    const st = steps[i] as TutorialStep;
    const orders = st.phase.map((p) => PHASE_ORDER[p]);
    if (Math.max(...orders) < now) continue;
    if (Math.min(...orders) > now) break;
    index = i;
    break;
  }
  const current = index >= 0 ? (steps[index] as TutorialStep) : null;
  let highlight: string | null = current ? current.highlight : null;
  if (current && highlight && highlight.startsWith('tile:@')) {
    const t = suggestTile(state, highlight.slice(6) as BuildingId);
    highlight = t ? `tile:${t.x},${t.y}` : `build:${highlight.slice(6)}`;
  }
  const doneCount = done.filter(Boolean).length;
  return {
    active: true,
    steps: steps.map((s, i): TutorialStepStatus => ({
      id: s.id, title: s.title, instruction: s.instruction, highlight: s.highlight, done: done[i] ?? false, current: i === index,
    })),
    index,
    current,
    highlight,
    doneCount,
    total: steps.length,
    completed: doneCount === steps.length,
  };
}
