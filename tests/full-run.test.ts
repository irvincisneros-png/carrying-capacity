import { describe, expect, it } from 'vitest';
import {
  buildReportCard, CAST, census, createGame, getScenario, objectiveStatus, serialize, startAct2, wordCount,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { runScript } from './helpers/autoplay';
import { act1Respectful, fullPlayPlan, playAct2, RESPECTFUL_WANTS } from './helpers/fullplay';
import { CAREFUL_ROADS, DIRTY_ROADS, DIRTY_WANTS, greedyPlan } from './helpers/scripts';

/**
 * Whole-game scripted runs on Coal Coast (seed 1850):
 *  - "thoughtful": consults the community before building, answers every story prompt and dilemma card with the
 *    evidence-backed option, closes the steelworks only after funding a transition, cleans up, restores, works with
 *    Aunty June, watches the sea from space and deals with every legacy site by the waste hierarchy. Reaches 3 stars.
 *  - "idle": builds the dirty town and then does nothing. Every arc ends badly.
 */
const thoughtfulAct1 = runScript(createGame('coal-coast'), act1Respectful(greedyPlan(RESPECTFUL_WANTS, 1.0, 30, CAREFUL_ROADS))).state;
const thoughtful = playAct2(startAct2(thoughtfulAct1), fullPlayPlan());
const idleAct1 = runScript(createGame('coal-coast'), greedyPlan(DIRTY_WANTS, 1.0, 30, DIRTY_ROADS)).state;
const idle = playAct2(startAct2(idleAct1), null);

const cast = CAST['coal-coast'] ?? [];
const firedBy = (s: GameState, id: string): string[] =>
  (cast.find((r) => r.id === id)?.beats ?? []).filter((b) => s.residents.fired[b.id] !== undefined).map((b) => b.id);
const status = (s: GameState): Record<string, string> => Object.fromEntries(objectiveStatus(s).map((o) => [o.id, o.status]));

describe('a thoughtful run reaches three stars', () => {
  const rc = buildReportCard(thoughtful);
  it('reaches 2100 with every required objective met', () => {
    expect(thoughtful.phase).toBe('epilogue');
    expect(thoughtful.year).toBe(2100);
    expect(status(thoughtful)).toEqual({ warming: 'met', estuary: 'met', society: 'met', repurpose: 'met', wildlife: 'met' });
    expect(thoughtful.a2.outcome?.success).toBe(true);
    expect(thoughtful.a2.outcome?.pendingRequired).toEqual([]);
    expect(thoughtful.tempC).toBeLessThanOrEqual(1.8);
    // Re-banded from 3 (round 6, 64x64 map): turbines and batteries sit further from the town and their roads cost more, so a few more
    // summers are short of power in the 2030s and 2040s.
    expect(thoughtful.a2.yearly.filter((y) => y.year > 2025 && y.unmetFrac > 0.02).length).toBeLessThanOrEqual(5);
  });
  it('earns the bonus star: koalas and turtles thriving', () => {
    const c = census(thoughtful);
    expect(c.find((x) => x.id === 'koala')?.status).toBe('thriving');
    expect(c.find((x) => x.id === 'green-turtle')?.status).toBe('thriving');
    expect(thoughtful.wildlife.species['green-turtle']?.nestStreak).toBeGreaterThanOrEqual(3);
    expect(thoughtful.flags['metric.wildlifeThriving']).toBe(1);
    expect(c.filter((x) => x.pop > 0).length).toBeGreaterThanOrEqual(6);
    expect(c.find((x) => x.id === 'koala')?.families.length).toBeGreaterThanOrEqual(2);
    expect(c.find((x) => x.id === 'koala')?.families).toContain('Marri woodland koalas');
    expect(c.find((x) => x.id === 'green-turtle')?.families).toContain('Old Shelly');
  });
  it('earns the third star: every resident\'s arc ends well', () => {
    expect(rc.stars).toBe(3);
    expect(rc.goalMet && rc.bonusMet && rc.residentsGood).toBe(true);
    expect(rc.residents.map((r) => `${r.id}:${r.quality}`)).toEqual([
      'mick-kowalski:good', 'lena-tran:good', 'aunty-june:good', 'priya-shah:good', 'sam-jordan:good', 'dot-harris:good',
    ]);
    expect(rc.landfillPenalty).toBe(0);
    expect(rc.verdict).toBe('complete');
    expect(rc.epilogue).toMatch(/learned to look after itself/);
  });
  it('deals with every legacy site by repurposing or recycling, never landfill', () => {
    expect(rc.circular.landfilled).toBe(0);
    expect(rc.circular.remaining).toBe(0);
    expect(rc.circular.pct).toBe(100);
    expect(rc.circular.repurposed).toBeGreaterThan(5);
    expect(rc.circular.recycled).toBeGreaterThan(5);
    expect(thoughtful.circular.unlockedYear).toBeLessThanOrEqual(2050);
    expect(thoughtful.buildings.filter((b) => b.type === 'steelworks')).toHaveLength(0);
  });
  it('works with Country: asks first, co-manages bush, cool-burns, and unlocks everything', () => {
    expect(thoughtful.country.consulted).toEqual([1, 2, 3]);
    expect(thoughtful.country.disturbed).toEqual([]);
    expect(thoughtful.country.comanaged.length).toBeGreaterThan(5);
    expect(thoughtful.country.burns.length).toBeGreaterThan(2);
    expect(thoughtful.country.unlocked).toEqual({ culturalBurning: true, fishing: true, dualNames: true });
    expect(rc.country.partnership).toBeGreaterThanOrEqual(58);
    expect(rc.country.unlocks).toHaveLength(3);
  });
  it('closes the steelworks only after a transition program, and Mick is part of the plan', () => {
    expect(thoughtful.flags['transition.funded']).toBe(1);
    expect(thoughtful.dilemmas.decisions.find((d) => d.dilemmaId === 'd2-closure')?.optionId).toBe('transition');
    expect(thoughtful.residents.fired['mick-closure-gentle']).toBeDefined();
    expect(thoughtful.residents.fired['mick-closure-abrupt']).toBeUndefined();
  });
  it('gives every resident 3 to 5 beats along the way, with no more than five', () => {
    for (const r of cast) {
      const n = firedBy(thoughtful, r.id).length;
      expect(n, r.id).toBeGreaterThanOrEqual(3);
      expect(n, r.id).toBeLessThanOrEqual(5);
    }
    expect(firedBy(thoughtful, 'priya-shah')).toEqual(expect.arrayContaining(['priya-graphs', 'priya-lag', 'priya-letter-good']));
  });
  it('keeps every spoken line to 60 words or fewer', () => {
    const lines = thoughtful.eventLog.filter((e) => e.story?.channel === 'resident');
    expect(lines.length).toBeGreaterThan(15);
    for (const e of lines) expect(wordCount(e.text), e.story?.ref).toBeLessThanOrEqual(60);
    for (const e of thoughtful.eventLog.filter((x) => x.story?.channel === 'country')) expect(e.story?.needsConsultation).toBe(true);
  });
  it('sees two or three dilemma cards in each in-game decade of Act 2', () => {
    const start = getScenario('coal-coast').act2.startYear;
    const per = new Array<number>(8).fill(0);
    // Every card is answered in the year it arrives, so the decisions log is the full list of offers (cards can recur).
    for (const d of thoughtful.dilemmas.decisions) if (d.year >= start && d.dilemmaId !== 'dc-offer') per[Math.floor((d.year - start) / 10)] = (per[Math.floor((d.year - start) / 10)] ?? 0) + 1;
    for (let w = 0; w < 7; w++) {
      expect(per[w], `decade ${start + w * 10}s`).toBeGreaterThanOrEqual(2);
      expect(per[w], `decade ${start + w * 10}s`).toBeLessThanOrEqual(3);
    }
    expect(per[7]).toBeGreaterThanOrEqual(1);
    const act1Cards = Object.entries(thoughtful.dilemmas.offered).filter(([id, y]) => y < start && !id.startsWith('inn-')).length;
    expect(act1Cards).toBeGreaterThanOrEqual(4);
    // Up to six: the zoning cards (sprawl, flats) can use a free Act 1 slot.
    expect(act1Cards).toBeLessThanOrEqual(6);
    expect(thoughtful.dilemmas.decisions.filter((d) => d.optionId === 'ignored')).toHaveLength(0);
    expect(thoughtful.dilemmas.decisions.filter((d) => d.evidenceBacked).length).toBeGreaterThan(8);
  });
  it('uses the satellites: a ground station, the sea overlay, and research into recycling', () => {
    expect(thoughtful.buildings.some((b) => b.type === 'groundstation')).toBe(true);
    expect(thoughtful.satellites.overlays.sst).toBe(true);
    expect(thoughtful.circular.research.length).toBeGreaterThanOrEqual(1);
    expect(thoughtful.circular.research).toContain('green-steel');
  });
  it('is deterministic', () => {
    const again = playAct2(startAct2(thoughtfulAct1), fullPlayPlan());
    expect(serialize(again) === serialize(thoughtful)).toBe(true);
  });
  it('builds a report card that reads well', () => {
    expect(rc.reflections).toHaveLength(2);
    expect(rc.topDecisions.length).toBeGreaterThanOrEqual(3);
    expect(rc.emissions.reductionPct).toBeGreaterThan(70);
    expect(rc.emissions.finalKt).toBeLessThan(60);
    expect(rc.speciesBack).toBeGreaterThanOrEqual(1);
    expect(rc.speciesLost).toBe(0);
    expect(rc.residents.every((r) => r.text.length > 40 && !/[{}]/.test(r.text))).toBe(true);
    expect(rc.residents.find((r) => r.id === 'aunty-june')?.needsConsultation).toBe(true);
  });
});

describe('doing nothing leaves every arc unresolved or bad', () => {
  const rc = buildReportCard(idle);
  it('misses the goals and earns no stars', () => {
    expect(idle.phase).toBe('epilogue');
    expect(rc.stars).toBe(0);
    expect(rc.goalMet).toBe(false);
    expect(status(idle).warming).toBe('missed');
    expect(status(idle).estuary).toBe('missed');
    expect(status(idle).repurpose).toBe('missed');
    expect(status(idle).wildlife).toBe('missed');
    expect(rc.epilogue).toMatch(/goals you set were not reached/);
  });
  it('ends every resident\'s story badly', () => {
    // Re-banded: with roads to pay for, the dirty town keeps more of its power and jobs than it used to (the idle grid short-changed
    // fewer homes), so the two residents whose lives depend on the town staying employed, Mick and Dot, can end 'mixed'. The four whose
    // stories depend on the estuary, the Country and the climate still end badly, and nobody ends well.
    const q = Object.fromEntries(rc.residents.map((r) => [r.id, r.quality]));
    // Round 6 (64x64 map): the dirty town is a little smaller against the bigger map, so the idle world ends at about 2.1 C and Priya's
    // reading (2.2 C or less) can read 'mixed'. Sam and Jordan's beach and bush have more room to survive on the bigger map. The two whose stories depend on the estuary and the Country still end badly.
    expect(['lena-tran', 'aunty-june'].map((id) => q[id])).toEqual(['bad', 'bad']);
    expect(['priya-shah', 'sam-jordan'].every((id) => q[id] === 'bad' || q[id] === 'mixed')).toBe(true);
    expect(['mick-kowalski', 'dot-harris'].every((id) => q[id] === 'bad' || q[id] === 'mixed')).toBe(true);
    expect(rc.residentsGood).toBe(false);
    // Re-banded from 50 (zoning phase 2): the capped dirty town keeps a little more of its people and jobs (Society 54, not 41).
    for (const r of rc.residents) expect(r.mood).toBeLessThan(58);
    expect(rc.residents.find((r) => r.id === 'aunty-june')?.needsConsultation).toBe(true);
  });
  it('tells the sad versions of the stories, in their own words', () => {
    const f = (id: string): boolean => idle.residents.fired[id] !== undefined;
    expect(f('mick-later-stuck')).toBe(true);
    expect(f('lena-linh-bad')).toBe(true);
    expect(f('dot-later-bad')).toBe(true);
    expect(f('june-neglect')).toBe(true);
    // Re-banded (zoning phase 2): the idle town's peak is now the 1980 boom (1287 kt a year, with its land clearing), and the Act 2 town runs at
    // 77% of it (was 88%), so Priya's "still close to the peak" line (over 80%) does not fire; her warming and letter lines do.
    expect(f('priya-lag')).toBe(true);
    expect(f('priya-letter-bad')).toBe(true);
    expect(f('mick-later-good')).toBe(false);
    expect(f('lena-linh-good')).toBe(false);
    for (const r of cast) {
      const n = firedBy(idle, r.id).length;
      expect(n, r.id).toBeGreaterThanOrEqual(3);
      expect(n, r.id).toBeLessThanOrEqual(5);
    }
  });
  it('loses most of the animals and lets the problems pile up unanswered', () => {
    const gone = census(idle).filter((c) => c.status === 'gone').length;
    // Re-banded from 4 (round 6): on the 64x64 map there is more bush and river left than the idle town can foul, so one more animal holds on.
    expect(gone).toBeGreaterThanOrEqual(3);
    expect(idle.wildlife.species['green-turtle']?.pop).toBe(0);
    expect(idle.dilemmas.decisions.length).toBeGreaterThan(10);
    expect(idle.dilemmas.decisions.every((d) => d.optionId === 'ignored' || d.dilemmaId.startsWith('a1-') === false)).toBe(true);
    expect(idle.dilemmas.decisions.filter((d) => d.optionId === 'ignored').length).toBeGreaterThan(10);
    expect(idle.country.partnership).toBeLessThan(10);
    expect(rc.residents.length).toBe(6);
    expect(idle.meters.society).toBeLessThan(thoughtful.meters.society - 40);
  });
});
