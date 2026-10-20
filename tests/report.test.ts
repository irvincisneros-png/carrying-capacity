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

describe('report card', () => {
  it('says the story is still going before the epilogue, and awards nothing yet', () => {
    const rc = buildReportCard(createGame('coal-coast'));
    expect(rc.verdict).toBe('in-progress');
    expect(rc.stars).toBe(0);
    expect(rc.epilogue).toMatch(/not over yet/);
    expect(rc.scenarioName).toBe('Coal Coast');
    expect(rc.objectives).toHaveLength(5);
    expect(rc.residents).toHaveLength(6);
  });
  it('covers a failed town with what went wrong and a reflection on it', () => {
    const f = startAct2(act1);
    f.cumulativeKt = 1e7;
    f.tempC = 2.9;
    const failed = tick(f, 1).state;
    expect(failed.phase).toBe('failed');
    const rc = buildReportCard(failed);
    expect(rc.verdict).toBe('failed');
    expect(rc.stars).toBe(0);
    expect(rc.epilogue).toMatch(/failure threshold/);
    expect(rc.epilogue).toContain(failed.a2.failure?.text ?? '??');
    expect(rc.reflections.length).toBe(2);
    expect(rc.reflections.some((r) => /failure threshold|warning signs/.test(r))).toBe(true);
  });
  it('awards one star for the goal, two with the wildlife bonus, three when every arc ended well', () => {
    const goal = perfect();
    goal.flags['metric.wildlifeThriving'] = 0;
    for (const r of Object.values(goal.residents.list)) r.mood = 5; // nobody is happy
    const one = buildReportCard(goal);
    expect(one.goalMet).toBe(true);
    expect(one.bonusMet).toBe(false);
    expect(one.stars).toBe(1);
    expect(one.starNotes.join(' ')).toMatch(/wildlife bonus was not reached/);

    const bonus = perfect();
    for (const r of Object.values(bonus.residents.list)) r.mood = 5;
    const two = buildReportCard(bonus);
    expect(two.bonusMet).toBe(true);
    expect(two.residentsGood).toBe(false);
    expect(two.stars).toBe(2);
    expect(two.starNotes.join(' ')).toMatch(/Not every story ended well/);

    const three = buildReportCard(perfect());
    expect(three.residents.map((r) => r.quality)).toEqual(['good', 'good', 'good', 'good', 'good', 'good']);
    expect(three.residentsGood).toBe(true);
    expect(three.stars).toBe(3);
    expect(three.epilogue).toMatch(/learned to look after itself/);
    expect(three.starNotes).toHaveLength(3);
  });
  it('awards nothing if the main goal is missed, however well the bonus went', () => {
    const s = perfect();
    s.tempC = 2.4;
    const rc = buildReportCard(s);
    expect(rc.goalMet).toBe(false);
    expect(rc.bonusMet).toBe(false);
    expect(rc.stars).toBe(0);
    expect(rc.epilogue).toMatch(/goals you set were not reached/);
  });
  it('takes a star away for sending legacy sites to landfill', () => {
    const s = perfect();
    s.circular.items.push({ uid: 99, type: 'steelworks', x: 1, y: 1, w: 3, h: 3, status: 'landfilled', year: 2060, into: null });
    // The repurpose goal is judged on its metric, which landfilling can no longer reach in a real game; here we keep it
    // at 100 to isolate the penalty itself.
    const rc = buildReportCard(s);
    expect(rc.landfillPenalty).toBe(1);
    expect(rc.stars).toBe(2);
    expect(rc.starNotes.join(' ')).toMatch(/cost a star/);
    expect(rc.circular.landfilled).toBe(1);
  });
  it('summarises emissions, the census, climate, circular work, Country and satellites', () => {
    const rc = buildReportCard(perfect());
    expect(rc.emissions.timeline.length).toBeGreaterThan(70);
    expect(rc.emissions.timeline[0]?.year).toBeLessThan(2025);
    for (let i = 1; i < rc.emissions.timeline.length; i++) expect(rc.emissions.timeline[i]?.year).toBeGreaterThan(rc.emissions.timeline[i - 1]?.year ?? 0);
    expect(rc.emissions.peakKt).toBeGreaterThan(0);
    expect(rc.emissions.finalKt).toBeLessThanOrEqual(rc.emissions.peakKt);
    expect(rc.emissions.reductionPct).toBe(Math.round(((rc.emissions.peakKt - rc.emissions.finalKt) / rc.emissions.peakKt) * 100));
    expect(Object.keys(rc.emissions.bySector).sort()).toEqual(['industry', 'land', 'power', 'transport', 'waste']);
    expect(rc.census).toHaveLength(7);
    expect(rc.census.find((c) => c.id === 'koala')?.status).toBe('thriving');
    expect(rc.climate.tempC).toBe(1.2);
    expect(rc.climate.realTempC).toBeGreaterThan(1);
    expect(rc.circular.pct).toBe(0); // this hand-built state never touched its legacy sites
    expect(rc.country.partnership).toBe(100);
    expect(rc.satellites.overlays).toEqual([]);
    expect(rc.moodByYear.length).toBeGreaterThan(50);
  });
  it('ranks the decisions that mattered and notes what you did for Country, the circular tier and satellites', () => {
    const s = perfect();
    s.dilemmas.decisions.push(
      { dilemmaId: 'a', optionId: 'x', year: 2030, title: 'Small', optionLabel: 'A small thing', impact: 2, evidenceBacked: false },
      { dilemmaId: 'b', optionId: 'y', year: 2040, title: 'Big', optionLabel: 'A big thing', impact: 30, evidenceBacked: true },
      { dilemmaId: 'c', optionId: 'z', year: 2050, title: 'Medium', optionLabel: 'A medium thing', impact: 12, evidenceBacked: true },
    );
    s.country.consulted = [1, 2];
    s.satellites.mitigations = 1;
    s.residents.actions['repurposed.steelworks'] = 2;
    s.circular.unlockedYear = 2050;
    const rc = buildReportCard(s);
    expect(rc.topDecisions.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < rc.topDecisions.length; i++) expect(rc.topDecisions[i - 1]?.impact).toBeGreaterThanOrEqual(rc.topDecisions[i]?.impact ?? 0);
    expect(rc.topDecisions[0]?.title).toBe('Big');
    const titles = rc.topDecisions.map((d) => d.title);
    expect(titles).toContain('Giving old sites new lives');
    expect(titles).toContain('Medium');
    expect(titles.includes('Asking before building') || titles.includes('Acting on a satellite warning')).toBe(true);
  });
  it('closes with reflection prompts, a letter to the next generation, and is fully deterministic and read-only', () => {
    const s = perfect();
    const before = serialize(s);
    const a = buildReportCard(s);
    const b = buildReportCard(s);
    expect(serialize(s)).toBe(before);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.reflections).toHaveLength(2);
    expect(new Set(a.reflections).size).toBe(2);
    expect(a.letterPrompt).toMatch(/letter to the next generation/);
    const struggle = buildReportCard(ended);
    expect(struggle.reflections).toHaveLength(2);
  });
});
