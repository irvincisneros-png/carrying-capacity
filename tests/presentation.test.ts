import { describe, expect, it } from 'vitest';
import { buildReportCard, cloneState, createGame, serialize, startAct2, tick } from '../src/sim';
import type { GameState } from '../src/sim';
import { runScript } from './helpers/autoplay';
import { CAUTIOUS_WANTS, greedyPlan } from './helpers/scripts';

const act1 = runScript(createGame('coal-coast'), greedyPlan(CAUTIOUS_WANTS, 1.0)).state;
const ended = tick(startAct2(act1), 80).state;

/** An epilogue state where everything went well, built by hand so each star can be tested on its own. */
function perfect(): GameState {
  const s = cloneState(ended);
  s.tempC = 1.2;
  s.grid.waterPollution.fill(0);
  for (const y of s.a2.yearly) y.estuaryHealth = 100;
  s.meters.society = 80;
  s.flags['metric.act1Repurposed'] = 100;
  s.flags['metric.wildlifeThriving'] = 1;
  s.flags['transition.funded'] = 1;
  s.flags['farm.riparian'] = 1;
  s.country.partnership = 100;
  for (const r of Object.values(s.residents.list)) r.mood = 90;
  for (const id of ['koala', 'black-cockatoo', 'green-turtle', 'frogs', 'platypus']) {
    const rt = s.wildlife.species[id];
    if (rt) { rt.pop = 20; rt.peak = 20; }
  }
  const turtle = s.wildlife.species['green-turtle'];
  if (turtle) turtle.nestStreak = 4;
  return s;
}

import { presentReportCard } from '../src/sim/presentation';

describe('presentReportCard (draft Aboriginal content hidden)', () => {
  it('hidden Elder arcs are neutral: a bad Elder ending no longer costs the third star', () => {
    const s = perfect();
    s.country.partnership = 0;
    for (const id of Object.keys(s.residents.list)) if (id === 'aunty-june') s.residents.list[id]!.mood = 0;
    const shown = presentReportCard(s, false);
    expect(shown.stars).toBe(2);
    expect(shown.residents.some((r) => r.needsConsultation)).toBe(true);
    const hidden = presentReportCard(s, true);
    expect(hidden.residents.some((r) => r.needsConsultation)).toBe(false);
    expect(hidden.stars).toBe(3);
    expect(hidden.residentsGood).toBe(true);
  });
  it('is identical to the plain report card when the draft is shown', () => {
    const s = perfect();
    expect(presentReportCard(s, false)).toEqual(buildReportCard(s));
  });
});
