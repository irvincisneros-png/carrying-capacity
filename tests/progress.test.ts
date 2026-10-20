import { describe, expect, it } from 'vitest';
import {
  emptyProgress, isScenarioUnlocked, loadProgress, lockedReason, MAX_STARS, parseProgress, PROGRESS_KEY, recordResult, SCENARIO_IDS,
  saveProgress, serializeProgress, setTeacherMode, skipTutorial, starsOf, totalStars, UNLOCK_REQUIRES, unlockedScenarios,
} from '../src/sim';
import type { Progress, ScenarioId, Stars } from '../src/sim';

const NAMES: Record<ScenarioId, string> = {
  'coal-coast': 'Coal Coast', 'green-valley': 'Green Valley', 'river-town': 'River Town', 'reef-island': 'Reef Island',
  'red-dirt': 'Red Dirt', 'net-zero-city': 'Net Zero City',
};
const earn = (p: Progress, id: ScenarioId, stars: Stars): Progress => recordResult(p, id, stars).progress;
const memory = (): { getItem(k: string): string | null; setItem(k: string, v: string): void; data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

describe('which scenarios are open', () => {
  it('starts with only the tutorial', () => {
    expect(unlockedScenarios(emptyProgress())).toEqual(['green-valley']);
    expect(isScenarioUnlocked(emptyProgress(), 'coal-coast')).toBe(false);
  });
  it('follows the order: tutorial, Coal Coast, then River Town and Reef Island, then Red Dirt, then Net Zero City', () => {
    let p = emptyProgress();
    p = earn(p, 'green-valley', 1);
    expect(unlockedScenarios(p)).toEqual(['coal-coast', 'green-valley']);
    p = earn(p, 'coal-coast', 1);
    expect(unlockedScenarios(p)).toEqual(['coal-coast', 'green-valley', 'river-town', 'reef-island']);
    expect(isScenarioUnlocked(p, 'red-dirt')).toBe(false);
    p = earn(p, 'reef-island', 1);
    expect(isScenarioUnlocked(p, 'red-dirt')).toBe(true);
    expect(isScenarioUnlocked(p, 'net-zero-city')).toBe(false);
    p = earn(p, 'red-dirt', 2);
    expect(unlockedScenarios(p)).toEqual([...SCENARIO_IDS]);
  });
  it('opens Red Dirt after either branch, not both', () => {
    const viaRiver = earn(earn(earn(emptyProgress(), 'green-valley', 1), 'coal-coast', 1), 'river-town', 1);
    expect(isScenarioUnlocked(viaRiver, 'red-dirt')).toBe(true);
    expect(isScenarioUnlocked(viaRiver, 'reef-island')).toBe(true);
  });
  it('needs a star to count: a finished run with no stars does not unlock the next scenario', () => {
    const p = earn(emptyProgress(), 'green-valley', 0);
    expect(isScenarioUnlocked(p, 'coal-coast')).toBe(false);
  });
  it('lets a player skip the tutorial for Coal Coast only', () => {
    const p = skipTutorial(emptyProgress());
    expect(isScenarioUnlocked(p, 'coal-coast')).toBe(true);
    expect(isScenarioUnlocked(p, 'river-town')).toBe(false);
  });
  it('is fully open in teacher mode, however it is switched on', () => {
    expect(unlockedScenarios(setTeacherMode(emptyProgress(), true))).toEqual([...SCENARIO_IDS]);
    expect(unlockedScenarios(emptyProgress(), true)).toEqual([...SCENARIO_IDS]);
    expect(unlockedScenarios(setTeacherMode(setTeacherMode(emptyProgress(), true), false))).toEqual(['green-valley']);
  });
  it('every rule refers to real scenarios and the graph has no cycles', () => {
    for (const id of SCENARIO_IDS) for (const group of UNLOCK_REQUIRES[id]) for (const req of group) expect(SCENARIO_IDS).toContain(req);
    const open = new Set<ScenarioId>();
    let guard = 0;
    while (open.size < SCENARIO_IDS.length && guard++ < 10) {
      for (const id of SCENARIO_IDS) if (UNLOCK_REQUIRES[id].every((g) => g.some((r) => open.has(r)))) open.add(id);
    }
    expect(open.size).toBe(SCENARIO_IDS.length);
  });
  it('explains why a scenario is locked', () => {
    expect(lockedReason(emptyProgress(), 'coal-coast', NAMES)).toBe('Finish Green Valley to unlock this.');
    expect(lockedReason(emptyProgress(), 'red-dirt', NAMES)).toBe('Finish River Town or Reef Island to unlock this.');
    expect(lockedReason(emptyProgress(), 'green-valley', NAMES)).toBeNull();
    expect(lockedReason(setTeacherMode(emptyProgress(), true), 'net-zero-city', NAMES)).toBeNull();
  });
});

describe('recording results', () => {
  it('keeps the best stars, never lowers them, and reports what a run newly opened', () => {
    let r = recordResult(emptyProgress(), 'green-valley', 1);
    expect(r.newlyUnlocked).toEqual(['coal-coast']);
    r = recordResult(r.progress, 'green-valley', 2);
    expect(starsOf(r.progress, 'green-valley')).toBe(2);
    expect(r.newlyUnlocked).toEqual([]);
    r = recordResult(r.progress, 'green-valley', 0);
    expect(starsOf(r.progress, 'green-valley')).toBe(2);
    const coal = recordResult(r.progress, 'coal-coast', 3);
    expect(coal.newlyUnlocked).toEqual(['river-town', 'reef-island']);
  });
  it('does not change the progress it was given', () => {
    const p = emptyProgress();
    recordResult(p, 'green-valley', 3);
    expect(p).toEqual(emptyProgress());
  });
  it('adds up stars out of a maximum of three per scenario', () => {
    let p = emptyProgress();
    for (const id of SCENARIO_IDS) p = earn(p, id, 3);
    expect(totalStars(p)).toBe(18);
    expect(MAX_STARS).toBe(18);
  });
});

describe('saving and loading', () => {
  it('round-trips through storage', () => {
    const store = memory();
    let p = earn(earn(emptyProgress(), 'green-valley', 2), 'coal-coast', 3);
    p = skipTutorial(setTeacherMode(p, true));
    expect(saveProgress(store, p)).toBe(true);
    expect(Object.keys(store.data)).toEqual([PROGRESS_KEY]);
    expect(loadProgress(store)).toEqual(p);
  });
  it('falls back to an empty record for anything missing, corrupt or odd, and never throws', () => {
    expect(loadProgress(null)).toEqual(emptyProgress());
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress('not json')).toEqual(emptyProgress());
    expect(parseProgress('[]')).toEqual(emptyProgress());
    expect(parseProgress('{"stars":{"coal-coast":7,"nope":3,"green-valley":2}}').stars).toEqual({ 'green-valley': 2 });
    expect(parseProgress('{"stars":null,"teacher":"yes"}')).toEqual(emptyProgress());
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
    expect(loadProgress(broken)).toEqual(emptyProgress());
    expect(saveProgress(broken, emptyProgress())).toBe(false);
    expect(saveProgress(null, emptyProgress())).toBe(false);
  });
  it('serialises plainly', () => {
    expect(JSON.parse(serializeProgress(earn(emptyProgress(), 'green-valley', 1)))).toEqual({
      version: 1, stars: { 'green-valley': 1 }, skippedTutorial: false, teacher: false,
    });
  });
});
