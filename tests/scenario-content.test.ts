import { describe, expect, it } from 'vitest';
import {
  CAST, countryFor, DILEMMAS, getScenario, isKnownMetric, renderText, speciesFor, storyVars, wordCount,
} from '../src/sim';
import type { Cond, MetricTest, ScenarioId } from '../src/sim';
import { act2Sandbox } from './helpers/fixtures';

/**
 * Content integrity for the scenarios built after Coal Coast (the same rules the Coal Coast tests apply, run per
 * scenario): short Year 9 text, real metrics and ids, a warm cast with no villains, Elder content flagged for
 * consultation, dilemma cards with previews and evidence blurbs.
 */
const SCENARIOS: { id: ScenarioId; residents: [number, number]; cards: [number, number]; act1Cards: [number, number] }[] = [
  // Re-banded for zoning: every town with an Act 1 also has the two zoning cards (sprawl and flats), so +2 cards.
  { id: 'green-valley', residents: [2, 2], cards: [10, 10], act1Cards: [8, 8] },
  { id: 'river-town', residents: [5, 6], cards: [8, 17], act1Cards: [2, 6] },
  { id: 'reef-island', residents: [5, 6], cards: [8, 17], act1Cards: [2, 6] },
  { id: 'red-dirt', residents: [5, 6], cards: [8, 17], act1Cards: [2, 6] },
  { id: 'net-zero-city', residents: [5, 6], cards: [8, 15], act1Cards: [0, 0] },
];

const FORBIDDEN = /dot[- ]?(painting|art)|sacred|ceremon|dreaming|dreamtime|songline|corroboree|totem/i;
const testsOf = (c: Cond | undefined): MetricTest[] => [...(c?.all ?? []), ...(c?.any ?? [])];

for (const sc of SCENARIOS) {
  const def = getScenario(sc.id);
  const cast = CAST[sc.id] ?? [];
  const cards = DILEMMAS[sc.id] ?? [];
  const vars = storyVars(act2Sandbox(undefined, { scenario: sc.id }));
  const speciesIds = new Set(speciesFor(sc.id).map((s) => s.id));
  const residentIds = new Set(cast.map((r) => r.id));

  describe(`${def.name}: cast`, () => {
    it('has the right number of residents with unique ids, a science voice and (except the tutorial) an Elder', () => {
      expect(cast.length).toBeGreaterThanOrEqual(sc.residents[0]);
      expect(cast.length).toBeLessThanOrEqual(sc.residents[1]);
      expect(residentIds.size).toBe(cast.length);
      expect(cast.filter((r) => r.science).length).toBe(1);
      expect(cast.filter((r) => r.elder).length).toBe(sc.id === 'green-valley' ? 0 : 1);
      expect(residentIds.has(def.act2.turningPoint.residentId)).toBe(true);
    });
    it('gives every resident a portrait, home hint, traits, weighted cares on real metrics, beats and endings', () => {
      for (const r of cast) {
        expect(r.portrait.length).toBeGreaterThan(2);
        expect(r.homeHint.description.length).toBeGreaterThan(10);
        expect(r.traits.length).toBeGreaterThanOrEqual(3);
        expect(r.cares.length).toBeGreaterThanOrEqual(3);
        expect(r.start).toBeGreaterThan(0);
        expect(r.start).toBeLessThanOrEqual(100);
        for (const c of r.cares) {
          expect(c.weight).toBeGreaterThan(0);
          expect(c.good).not.toBe(c.bad);
          expect(isKnownMetric(c.metric), `${r.id} cares about unknown metric ${c.metric}`).toBe(true);
        }
        expect(r.beats.length, r.id).toBeGreaterThanOrEqual(sc.id === 'green-valley' ? 3 : 4);
        expect(r.beats.length, r.id).toBeLessThanOrEqual(9);
        expect(r.endings.length, r.id).toBeGreaterThanOrEqual(2);
        expect(r.endings.length, r.id).toBeLessThanOrEqual(3);
        expect(r.endings[r.endings.length - 1]?.when, r.id).toBeUndefined();
        expect(r.endings.some((e) => e.quality === 'good'), r.id).toBe(true);
        expect(r.endings.some((e) => e.quality === 'bad'), r.id).toBe(true);
      }
      const ids = cast.flatMap((r) => [...r.beats.map((b) => b.id), ...r.endings.map((e) => e.id)]);
      expect(new Set(ids).size).toBe(ids.length);
    });
    it('only uses metrics the engine understands in conditions', () => {
      for (const r of cast) {
        for (const b of r.beats) for (const x of testsOf(b.when)) expect(isKnownMetric(x.m), `${b.id}: ${x.m}`).toBe(true);
        for (const e of r.endings) for (const x of testsOf(e.when)) expect(isKnownMetric(x.m), `${e.id}: ${x.m}`).toBe(true);
      }
    });
    it('keeps beats and endings to 60 words or fewer with every placeholder filled, in short sentences', () => {
      for (const r of cast) {
        for (const b of r.beats) {
          const text = renderText(b.text, vars);
          expect(text, b.id).not.toMatch(/[{}]/);
          expect(wordCount(text), `${b.id} (${wordCount(text)} words)`).toBeLessThanOrEqual(60);
          expect(wordCount(text), b.id).toBeGreaterThanOrEqual(20);
          const longest = Math.max(...text.split(/[.!?]+\s/).filter(Boolean).map(wordCount));
          expect(longest, `${b.id}: longest sentence ${longest} words`).toBeLessThanOrEqual(38);
          expect(b.text, b.id).not.toMatch(/\b(color|neighbor|favorite|realize|organize)\b/i);
          for (const o of b.choice?.options ?? []) expect(wordCount(o.label), `${b.id}/${o.id}`).toBeLessThanOrEqual(16);
        }
        for (const e of r.endings) {
          const text = renderText(e.text, vars);
          expect(text, e.id).not.toMatch(/[{}]/);
          expect(wordCount(text), `${e.id} (${wordCount(text)} words)`).toBeLessThanOrEqual(60);
        }
      }
    });
    it('flags every Elder line for consultation and keeps the cast general, respectful and free of sacred specifics', () => {
      for (const r of cast.filter((x) => x.elder)) {
        expect(r.needsConsultation).toBe(true);
        for (const b of r.beats) { expect(b.needsConsultation, b.id).toBe(true); expect(b.text, b.id).not.toMatch(FORBIDDEN); }
        for (const e of r.endings) { expect(e.needsConsultation, e.id).toBe(true); expect(e.text, e.id).not.toMatch(FORBIDDEN); }
      }
      for (const r of cast) for (const b of r.beats) expect(b.text).not.toMatch(FORBIDDEN);
    });
  });

  describe(`${def.name}: dilemma cards`, () => {
    it('has the right number of cards, in the right acts, with unique ids', () => {
      expect(cards.length).toBeGreaterThanOrEqual(sc.cards[0]);
      expect(cards.length).toBeLessThanOrEqual(sc.cards[1]);
      const a1 = cards.filter((c) => c.phase === 'act1').length;
      expect(a1).toBeGreaterThanOrEqual(sc.act1Cards[0]);
      expect(a1).toBeLessThanOrEqual(sc.act1Cards[1]);
      expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
      for (const c of cards) {
        if (c.phase === 'act1') expect(c.years[0]).toBeGreaterThanOrEqual(def.startYear);
        if (c.phase === 'act1') expect(c.years[1]).toBeLessThanOrEqual(def.endYear);
        if (c.phase === 'act2') expect(c.years[1]).toBeLessThanOrEqual(def.act2.endYear);
      }
    });
    it('offers two or three options per card, each with a preview of who is helped and hurt', () => {
      for (const c of cards) {
        expect(c.options.length, c.id).toBeGreaterThanOrEqual(2);
        expect(c.options.length, c.id).toBeLessThanOrEqual(3);
        expect(new Set(c.options.map((o) => o.id)).size, c.id).toBe(c.options.length);
        if (c.speaker) expect(residentIds.has(c.speaker), `${c.id}: speaker ${c.speaker}`).toBe(true);
        for (const o of c.options) {
          expect(o.preview.helps.length, `${c.id}/${o.id} helps`).toBeGreaterThanOrEqual(1);
          expect(o.preview.hurts.length, `${c.id}/${o.id} hurts`).toBeGreaterThanOrEqual(1);
          for (const t of [...o.preview.helps, ...o.preview.hurts]) {
            expect(t.why.length).toBeGreaterThanOrEqual(5);
            if (t.type === 'resident') expect(residentIds.has(t.id), `${c.id}/${o.id}: ${t.id}`).toBe(true);
            if (t.type === 'creature') expect(speciesIds.has(t.id), `${c.id}/${o.id}: ${t.id}`).toBe(true);
          }
          for (const m of Object.keys(o.effects.mood ?? {})) expect(residentIds.has(m), `${c.id}/${o.id}: mood ${m}`).toBe(true);
          expect(o.outcome.length).toBeGreaterThan(15);
        }
      }
    });
    it('keeps text short and readable, with an evidence blurb on every card and real metrics in conditions', () => {
      for (const c of cards) {
        const setup = renderText(c.setup, vars);
        expect(setup, c.id).not.toMatch(/[{}]/);
        expect(wordCount(setup), `${c.id} setup`).toBeLessThanOrEqual(75);
        expect(wordCount(c.evidence), `${c.id} evidence`).toBeGreaterThanOrEqual(30);
        expect(wordCount(c.evidence), `${c.id} evidence`).toBeLessThanOrEqual(90);
        expect(wordCount(c.title)).toBeLessThanOrEqual(7);
        for (const o of c.options) {
          expect(wordCount(o.label), `${c.id}/${o.id} label`).toBeLessThanOrEqual(16);
          expect(wordCount(renderText(o.outcome, vars)), `${c.id}/${o.id} outcome`).toBeLessThanOrEqual(50);
        }
        for (const x of testsOf(c.when)) expect(isKnownMetric(x.m), `${c.id}: ${x.m}`).toBe(true);
      }
    });
    it('has cards with no clean answer, and rewards the evidence where there is one', () => {
      const open = cards.filter((c) => c.noCleanAnswer);
      expect(open.length).toBeGreaterThanOrEqual(sc.id === 'green-valley' ? 0 : 2);
      for (const c of open) expect(c.options.some((o) => o.evidenceBacked), c.id).toBe(false);
      const clearer = cards.filter((c) => !c.noCleanAnswer);
      expect(clearer.filter((c) => c.options.some((o) => o.evidenceBacked)).length).toBeGreaterThanOrEqual(clearer.length - 1);
    });
    it('marks consultation-dependent cards and keeps them free of sacred specifics', () => {
      const elder = cast.find((r) => r.elder);
      for (const c of cards.filter((x) => x.needsConsultation || (elder && x.speaker === elder.id))) {
        expect(c.needsConsultation, c.id).toBe(true);
        const all = [c.setup, c.evidence, ...c.options.flatMap((o) => [o.outcome, o.label])].join(' ');
        expect(all, c.id).not.toMatch(FORBIDDEN);
      }
      for (const c of cards) expect(c.setup + c.options.map((o) => o.outcome).join(' ')).not.toMatch(/syllabus|curriculum|learning outcome|you should learn/i);
    });
  });

  describe(`${def.name}: species and Country`, () => {
    it('has species with evidence blurbs and ordered families', () => {
      expect(speciesFor(sc.id).length).toBe(sc.id === 'green-valley' ? 2 : sc.id === 'net-zero-city' ? 3 : sc.id === 'red-dirt' ? 3 : 4);
      for (const s of speciesFor(sc.id)) {
        for (let i = 1; i < s.families.length; i++) expect(s.families[i]?.minPop).toBeGreaterThan(s.families[i - 1]?.minPop ?? 0);
        expect(wordCount(s.evidence)).toBeGreaterThanOrEqual(35);
      }
    });
    it('flags every Country line needsConsultation, with placeholder place names and no invented specifics', () => {
      if (sc.id === 'green-valley') return;
      const c = countryFor(sc.id);
      const lines: { text: string; needsConsultation: boolean }[] = [];
      for (const site of Object.values(c.sites)) lines.push(site.name, site.consulted, site.disturbed, site.ignored);
      for (const v of Object.values(c.lines)) lines.push(typeof v === 'function' ? v(7) : v);
      for (const p of c.places) lines.push(p.original);
      for (const l of lines) {
        expect(l.needsConsultation).toBe(true);
        expect(l.text).not.toMatch(FORBIDDEN);
      }
      for (const p of c.places) expect(p.original.text).toMatch(/to be supplied by the community/);
      expect(Object.keys(c.sites).sort()).toEqual(['1', '2', '3']);
    });
  });
}
