import { describe, expect, it } from 'vitest';
import {
  advanceDecade, applyAction, buildReportCard, createGame, isKnownMetric, objectiveStatus, startAct2, suggestTile, tick, TUTORIAL_STEPS,
  tutorialStatus, tutorialStepsFor, wordCount,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { followTutorial } from './helpers/valley';

const steps = tutorialStepsFor('green-valley');
const HIGHLIGHT = /^(build:[a-z]+|tool:(demolish|clear|inspect|dispose|comanage|burn)|button:[a-z-]+|panel:[a-z-]+|tile:\d+,\d+|tile:@[a-z]+)$/;

describe('tutorial data', () => {
  it('has guided steps only for Green Valley, each with a title, a short instruction, a highlight key and a condition', () => {
    expect(Object.keys(TUTORIAL_STEPS)).toEqual(['green-valley']);
    expect(tutorialStepsFor('coal-coast')).toHaveLength(0);
    expect(steps.length).toBeGreaterThanOrEqual(15);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    for (const s of steps) {
      expect(s.title.length, s.id).toBeGreaterThan(3);
      expect(wordCount(s.instruction), s.id).toBeLessThanOrEqual(60);
      expect(wordCount(s.instruction), s.id).toBeGreaterThanOrEqual(12);
      expect(s.highlight, s.id).toMatch(HIGHLIGHT);
      for (const t of [...(s.done.all ?? []), ...(s.done.any ?? [])]) expect(isKnownMetric(t.m), `${s.id}: ${t.m}`).toBe(true);
    }
  });
  it('covers build, energy swap, remediation, planting, a wildlife return and a recycle step, in that order of act', () => {
    const ids = steps.map((s) => s.id);
    for (const need of ['homes', 'farm', 'power', 'solar', 'wind', 'battery', 'swap', 'clean', 'plant', 'wetland', 'return', 'recycle']) {
      expect(ids, need).toContain(need);
    }
    const order = { act1: 0, 'turning-point': 1, act2: 2 } as const;
    const phases = steps.map((s) => Math.min(...s.phase.map((p) => order[p])));
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
    expect(steps.filter((s) => s.phase.includes('act1')).length).toBeGreaterThanOrEqual(8);
    expect(steps.filter((s) => s.phase.includes('act2')).length).toBeGreaterThanOrEqual(9);
  });
});

describe('tutorialStatus', () => {
  it('is inactive in every other scenario', () => {
    const t = tutorialStatus(createGame('coal-coast'));
    expect(t).toEqual({ active: false, steps: [], index: -1, current: null, highlight: null, doneCount: 0, total: 0, completed: false });
  });
  it('starts at the first step, pointing at the cottage button', () => {
    const t = tutorialStatus(createGame('green-valley'));
    expect(t.active).toBe(true);
    expect(t.index).toBe(0);
    expect(t.current?.id).toBe('homes');
    expect(t.highlight).toBe('build:cottage');
    expect(t.doneCount).toBe(0);
    expect(t.completed).toBe(false);
    expect(t.steps.filter((s) => s.current)).toHaveLength(1);
  });
  it('moves on when the condition is met by the player\'s actions, and stays done after the building is gone', () => {
    let s = createGame('green-valley');
    for (let n = 0; n < 3; n++) {
      const spot = suggestTile(s, 'cottage');
      expect(spot).not.toBeNull();
      const r = applyAction(s, { type: 'place', building: 'cottage', x: spot?.x ?? 0, y: spot?.y ?? 0 });
      expect(r.result.ok).toBe(true);
      s = r.state;
    }
    const t = tutorialStatus(s);
    expect(t.current?.id).toBe('farm');
    expect(t.doneCount).toBe(1);
    // Demolishing does not undo "built three homes".
    const b = s.buildings[0];
    const demolished = applyAction(s, { type: 'demolish', x: b?.x ?? 0, y: b?.y ?? 0 }).state;
    expect(tutorialStatus(demolished).steps[0]?.done).toBe(true);
  });
  it('waits for the player to press next decade, and notices the clearing tool', () => {
    let s = createGame('green-valley');
    s.budget = 500;
    // Get through the first steps by hand.
    for (const id of ['cottage', 'cottage', 'cottage', 'farm', 'road', 'road'] as const) {
      const spot = suggestTile(s, id);
      s = applyAction(s, { type: 'place', building: id, x: spot?.x ?? 0, y: spot?.y ?? 0, rotation: spot?.rotation ?? 0 }).state;
    }
    expect(tutorialStatus(s).current?.id).toBe('clear');
    expect(tutorialStatus(s).highlight).toBe('tool:clear');
    const bush = Array.from(s.grid.kind).findIndex((k) => k === 5);
    s = applyAction(s, { type: 'clear', x: bush % s.grid.w, y: Math.floor(bush / s.grid.w) }).state;
    expect(tutorialStatus(s).current?.id).toBe('decade');
    expect(tutorialStatus(s).highlight).toBe('button:next-decade');
    s = advanceDecade(s).state;
    expect(tutorialStatus(s).current?.id).toBe('factory');
  });
  it('resolves a "tile:@building" highlight to a real tile where that building can go', () => {
    const s = startAct2(runToTurningPoint());
    const wetlandStep = steps.find((x) => x.highlight === 'tile:@wetland');
    expect(wetlandStep).toBeDefined();
    const spot = suggestTile(s, 'wetland');
    expect(spot).not.toBeNull();
    const ok = applyAction({ ...s, budget: 1000 }, { type: 'place', building: 'wetland', x: spot?.x ?? 0, y: spot?.y ?? 0, rotation: spot?.rotation ?? 0 });
    expect(ok.result.ok).toBe(true);
    expect(suggestTile(createGame('green-valley'), 'wetland')).toBeNull(); // wetlands are an Act 2 building
  });
  it('shows the turning point step while the crisis card is up, then Act 2 steps', () => {
    const s = runToTurningPoint();
    expect(s.phase).toBe('turning-point');
    expect(tutorialStatus(s).current?.id).toBe('crisis');
    expect(tutorialStatus(s).highlight).toBe('button:start-transition');
    const a2 = startAct2(s);
    expect(tutorialStatus(a2).current?.id).toBe('solar');
  });
});

function runToTurningPoint(): GameState {
  let s = createGame('green-valley');
  s.budget = 5000;
  for (const id of ['cottage', 'cottage', 'cottage', 'farm', 'factory', 'coalpower', 'coalmine'] as const) {
    const spot = suggestTile(s, id);
    s = applyAction(s, { type: 'place', building: id, x: spot?.x ?? 0, y: spot?.y ?? 0, rotation: spot?.rotation ?? 0 }).state;
  }
  while (s.status === 'playing') s = advanceDecade(s).state;
  return s;
}

describe('following the tutorial from start to finish', () => {
  const run = followTutorial();
  it('completes every step and finishes the game', () => {
    expect(run.end.phase).toBe('epilogue');
    expect(run.end.year).toBe(2040);
    const t = tutorialStatus(run.end);
    expect(t.completed).toBe(true);
    expect(t.doneCount).toBe(t.total);
    expect(run.log).toEqual(steps.map((s) => s.id));
  });
  it('earns the star: clean power, a healed valley, an animal back and the old sites repurposed', () => {
    const rc = buildReportCard(run.end);
    expect(rc.goalMet).toBe(true);
    expect(rc.stars).toBeGreaterThanOrEqual(1);
    const st = Object.fromEntries(objectiveStatus(run.end).map((o) => [o.id, o.status]));
    expect(st).toMatchObject({ energy: 'met', healing: 'met', return: 'met', recycle: 'met' });
    expect(run.end.circular.items.filter((i) => i.status === 'landfilled')).toHaveLength(0);
  });
  it('takes about two dozen actions and under 3000 engine steps: a tutorial, not a marathon', () => {
    expect(run.steps).toBeLessThan(200);
    const built = Object.entries(run.end.residents.actions).filter(([k]) => k.startsWith('built.')).reduce((a, [, v]) => a + v, 0);
    expect(built).toBeGreaterThan(12);
    expect(built).toBeLessThan(45);
  });
  it('lets a second wetland earn the bonus star (frogs thriving)', () => {
    let s = startAct2(runToTurningPoint());
    s.budget = 3000;
    for (let n = 0; n < 2; n++) {
      const spot = suggestTile(s, 'wetland');
      s = applyAction(s, { type: 'place', building: 'wetland', x: spot?.x ?? 0, y: spot?.y ?? 0, rotation: spot?.rotation ?? 0 }).state;
    }
    for (let y = 0; y < 12; y++) s = tick(s, 1).state;
    expect(s.wildlife.species.frogs?.pop).toBeGreaterThanOrEqual(40);
    expect(s.flags['metric.wildlifeThriving']).toBe(1);
  });
});
