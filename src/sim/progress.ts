/**
 * Scenario progress: stars earned per scenario, which scenarios are unlocked, and persistence helpers. Pure: no DOM,
 * the storage object is passed in. Unlock order (docs/GAMEPLAY.md section 4):
 * Green Valley -> Coal Coast -> (River Town | Reef Island) -> Red Dirt -> Net Zero City. Teacher mode unlocks all.
 */
import { SCENARIO_IDS } from './scenarios';
import type { ScenarioId } from './types';

export type Stars = 0 | 1 | 2 | 3;

export interface Progress {
  version: 1;
  /** Best stars earned per scenario (missing = never finished). */
  stars: Partial<Record<ScenarioId, Stars>>;
  /** The player chose to skip the tutorial, which opens Coal Coast. */
  skippedTutorial: boolean;
  /** Teacher override: everything is unlocked. */
  teacher: boolean;
}

export const PROGRESS_KEY = 'cc.progress.v1';

/**
 * What a scenario needs: every group must be satisfied, and a group is satisfied when ANY scenario in it has at
 * least one star. An empty list means always unlocked.
 */
export const UNLOCK_REQUIRES: Readonly<Record<ScenarioId, readonly (readonly ScenarioId[])[]>> = {
  'green-valley': [],
  'coal-coast': [['green-valley']],
  'river-town': [['coal-coast']],
  'reef-island': [['coal-coast']],
  'red-dirt': [['river-town', 'reef-island']],
  'net-zero-city': [['red-dirt']],
};

export function emptyProgress(): Progress {
  return { version: 1, stars: {}, skippedTutorial: false, teacher: false };
}

export function starsOf(p: Progress, id: ScenarioId): Stars {
  return p.stars[id] ?? 0;
}

export function isScenarioUnlocked(p: Progress, id: ScenarioId, teacherOverride = false): boolean {
  if (p.teacher || teacherOverride) return true;
  const groups = UNLOCK_REQUIRES[id];
  return groups.every((group) => {
    if (id === 'coal-coast' && p.skippedTutorial) return true;
    return group.some((req) => starsOf(p, req) >= 1);
  });
}

/** Scenario ids that are open to play, in menu order. */
export function unlockedScenarios(p: Progress, teacherOverride = false): ScenarioId[] {
  return SCENARIO_IDS.filter((id) => isScenarioUnlocked(p, id, teacherOverride));
}

/** Why a scenario is locked, in a sentence for the menu, or null if it is open. */
export function lockedReason(p: Progress, id: ScenarioId, names: Readonly<Record<ScenarioId, string>>, teacherOverride = false): string | null {
  if (isScenarioUnlocked(p, id, teacherOverride)) return null;
  const parts = UNLOCK_REQUIRES[id].map((group) => group.map((g) => names[g]).join(' or '));
  return `Finish ${parts.join(' and ')} to unlock this.`;
}

/** Records a finished run. Keeps the best star count. Returns a new Progress and the scenarios this run newly opened. */
export function recordResult(p: Progress, id: ScenarioId, stars: Stars): { progress: Progress; newlyUnlocked: ScenarioId[] } {
  const before = new Set(unlockedScenarios(p));
  const best = Math.max(starsOf(p, id), stars) as Stars;
  const next: Progress = { ...p, stars: { ...p.stars, [id]: best } };
  const newlyUnlocked = unlockedScenarios(next).filter((s) => !before.has(s));
  return { progress: next, newlyUnlocked };
}

export function setTeacherMode(p: Progress, on: boolean): Progress {
  return { ...p, teacher: on };
}

export function skipTutorial(p: Progress): Progress {
  return { ...p, skippedTutorial: true };
}

/** Total stars earned over all scenarios (the menu shows this). */
export function totalStars(p: Progress): number {
  return SCENARIO_IDS.reduce((n, id) => n + starsOf(p, id), 0);
}

export const MAX_STARS = SCENARIO_IDS.length * 3;

export function serializeProgress(p: Progress): string {
  return JSON.stringify(p);
}

/** Parses saved progress; anything malformed falls back to an empty record (never throws). */
export function parseProgress(text: string | null | undefined): Progress {
  if (!text) return emptyProgress();
  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null) return emptyProgress();
    const r = raw as Record<string, unknown>;
    const out = emptyProgress();
    const stars = r.stars;
    if (typeof stars === 'object' && stars !== null) {
      for (const id of SCENARIO_IDS) {
        const v = (stars as Record<string, unknown>)[id];
        if (v === 0 || v === 1 || v === 2 || v === 3) out.stars[id] = v;
      }
    }
    out.skippedTutorial = r.skippedTutorial === true;
    out.teacher = r.teacher === true;
    return out;
  } catch {
    return emptyProgress();
  }
}

export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadProgress(storage: ProgressStorage | null | undefined): Progress {
  try {
    return parseProgress(storage ? storage.getItem(PROGRESS_KEY) : null);
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(storage: ProgressStorage | null | undefined, p: Progress): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PROGRESS_KEY, serializeProgress(p));
    return true;
  } catch {
    return false;
  }
}
