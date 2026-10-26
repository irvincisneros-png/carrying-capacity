import { describe, expect, it } from 'vitest';
import {
  advanceDecade, applyAction, ZONE, buildReportCard, canPlace, createGame, isKnownMetric, objectiveStatus, startAct2, suggestTile, tick, TUTORIAL_STEPS,
  tutorialStatus, tutorialStepsFor, wordCount,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { connectAll } from './helpers/roads';
import { followTutorial } from './helpers/valley';
import { keepZoned } from './helpers/zoning';

const steps = tutorialStepsFor('green-valley');
const HIGHLIGHT = /^(build:[a-z]+|tool:(demolish|clear|inspect|dispose|comanage|burn|zonehomes|zoneshops)|button:[a-z-]+|panel:[a-z-]+|tile:\d+,\d+|tile:@[a-z]+)$/;

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
  it('starts at the first step, pointing at the Homes zone tool', () => {
    const t = tutorialStatus(createGame('green-valley'));
    expect(t.active).toBe(true);
    expect(t.index).toBe(0);
    expect(t.current?.id).toBe('homes');
    expect(t.highlight).toBe('tool:zonehomes');
    expect(t.doneCount).toBe(0);
    expect(t.completed).toBe(false);
    expect(t.steps.filter((s) => s.current)).toHaveLength(1);
  });
  it('moves on when the player zones homes, and stays done after the zone is cleared', () => {
    let s = createGame('green-valley');
    s = keepZoned(s, ZONE.rlow, 6);
    const t = tutorialStatus(s);
    expect(t.current?.id).toBe('shops');
    expect(t.highlight).toBe('tool:zoneshops');
    expect(t.doneCount).toBe(1);
    // Dezoning does not undo "zoned some homes".
    const cleared = applyAction(s, { type: 'zone', x: 0, y: 0, w: s.grid.w, h: s.grid.h, zone: 0 }).state;
    expect(tutorialStatus(cleared).steps[0]?.done).toBe(true);
    expect(cleared.flags['tut.done.homes']).toBe(true);
  });
  it('asks for shops, a farm, roads and a little clearing, then waits for the player to let the town grow', () => {
    let s = createGame('green-valley');
    s.budget = 500;
    s = keepZoned(s, ZONE.rlow, 6);
    s = keepZoned(s, ZONE.com, 3);
    expect(tutorialStatus(s).current?.id).toBe('farm');
    const spot = suggestTile(s, 'farm');
    s = applyAction(s, { type: 'place', building: 'farm', x: spot?.x ?? 0, y: spot?.y ?? 0, rotation: spot?.rotation ?? 0 }).state;
    // A farm with no road to it does not count as connected: the step waits until a road joins it to the edge.
    expect(tutorialStatus(s).current?.id).toBe('roads');
    expect(tutorialStatus(s).highlight).toBe('build:road');
    s = connectAll(s);
    expect(tutorialStatus(s).current?.id).toBe('clear');
    expect(tutorialStatus(s).highlight).toBe('tool:clear');
    const bush = Array.from(s.grid.kind).findIndex((k) => k === 5);
    s = applyAction(s, { type: 'clear', x: bush % s.grid.w, y: Math.floor(bush / s.grid.w) }).state;
    expect(tutorialStatus(s).current?.id).toBe('watch');
    expect(tutorialStatus(s).highlight).toBe('button:next-decade');
    s = advanceDecade(s).state;
    expect(s.buildings.some((b) => b.grown)).toBe(true);
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
  for (const id of ['farm', 'factory', 'coalpower', 'coalmine'] as const) {
    const spot = suggestTile(s, id);
    s = connectAll(applyAction(s, { type: 'place', building: id, x: spot?.x ?? 0, y: spot?.y ?? 0, rotation: spot?.rotation ?? 0 }).state);
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
    // Re-banded from 45: every road tile laid to join the homes, farm and works to the road in counts as a build (about a dozen
    // tiles for a tutorial town), so the same town now logs more builds.
    expect(built).toBeLessThan(65);
  });
  it('lets a second wetland earn the bonus star (frogs thriving)', () => {
    let s = startAct2(runToTurningPoint());
    s.budget = 3000;
    for (let n = 0; n < 2; n++) {
      // Frogs keep away from traffic (road kills), so the ponds go beside the creek but a few tiles from any road.
      const roads = s.buildings.filter((b) => b.type === 'road');
      let best: { x: number; y: number; d: number } | null = null;
      const near = suggestTile(s, 'wetland') ?? { x: 0, y: 0 };
      for (let y = 0; y < s.grid.h; y++) for (let x = 0; x < s.grid.w; x++) {
        if (!canPlace(s, 'wetland', x, y).ok) continue;
        if (roads.some((r) => Math.max(Math.abs(r.x - x), Math.abs(r.y - y)) <= 4)) continue;
        const d = Math.hypot(x - near.x, y - near.y);
        if (!best || d < best.d) best = { x, y, d };
      }
      expect(best).not.toBeNull();
      s = applyAction(s, { type: 'place', building: 'wetland', x: best?.x ?? 0, y: best?.y ?? 0 }).state;
    }
    for (let y = 0; y < 12; y++) s = tick(s, 1).state;
    expect(s.wildlife.species.frogs?.pop).toBeGreaterThanOrEqual(40);
    expect(s.flags['metric.wildlifeThriving']).toBe(1);
  });
});

describe('tutorial steps latch', () => {
  it('the road step stays done after a connected farm is demolished', async () => {
    const { buildN } = await import('./helpers/autoplay');
    let s = createGame('green-valley');
    s = buildN(s, 'farm', 1).state;
    const road = (st: GameState) => tutorialStatus(st).steps.find((x) => x.id === 'roads')!.done;
    expect(road(s)).toBe(true);
    const farm = s.buildings.find((b) => b.type === 'farm')!;
    const r = applyAction(s, { type: 'demolish', x: farm.x, y: farm.y });
    expect(r.result.ok).toBe(true);
    expect(road(r.state)).toBe(true);
    expect(r.state.flags['tut.done.roads']).toBe(true);
  });
});
