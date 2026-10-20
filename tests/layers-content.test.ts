import { describe, expect, it } from 'vitest';
import {
  BUILDINGS, CAST, COUNTRY, DILEMMAS, isKnownMetric, LEGACY_TYPES, RESEARCH, RESEARCH_BY_ID, renderText, REPURPOSE, SPECIES,
  SPECIES_BY_ID, storyVars, wordCount,
} from '../src/sim';
import type { Cond, MetricTest } from '../src/sim';
import { SPECIES as SPECIES_DATA } from '../src/content/species';
import { EPILOGUE, LETTER_PROMPT, REFLECTIONS } from '../src/content/report';
import { act2Sandbox } from './helpers/fixtures';

const cast = CAST['coal-coast'] ?? [];
const cards = DILEMMAS['coal-coast'] ?? [];
const vars = storyVars(act2Sandbox());

const testsOf = (c: Cond | undefined): MetricTest[] => [...(c?.all ?? []), ...(c?.any ?? [])];
const FORBIDDEN = /dot[- ]?(painting|art)|sacred|ceremon|dreaming|dreamtime|songline|corroboree|totem/i;

describe('Coal Coast cast (content integrity)', () => {
  it('has the six residents from the design doc, with unique ids', () => {
    expect(cast.map((r) => r.id)).toEqual(['mick-kowalski', 'lena-tran', 'aunty-june', 'priya-shah', 'sam-jordan', 'dot-harris']);
    expect(new Set(cast.map((r) => r.id)).size).toBe(cast.length);
    expect(cast.map((r) => r.role)).toEqual(['Steelworker', 'Fisher', 'Elder', 'Climate scientist', 'Schoolkids (twins)', 'Dairy farmer']);
  });
  it('gives every resident a portrait, home hint, traits and weighted cares', () => {
    for (const r of cast) {
      expect(r.portrait.length).toBeGreaterThan(2);
      expect(r.homeHint.description.length).toBeGreaterThan(10);
      expect(r.traits.length).toBeGreaterThanOrEqual(3);
      expect(r.cares.length).toBeGreaterThanOrEqual(4);
      expect(r.start).toBeGreaterThan(0);
      expect(r.start).toBeLessThanOrEqual(100);
      for (const c of r.cares) {
        expect(c.weight).toBeGreaterThan(0);
        expect(c.good).not.toBe(c.bad);
        expect(isKnownMetric(c.metric), `${r.id} cares about unknown metric ${c.metric}`).toBe(true);
      }
    }
  });
  it('has 3 to 6 beats and 2 to 3 endings each, ending with a fallback that has no condition', () => {
    for (const r of cast) {
      expect(r.beats.length, r.id).toBeGreaterThanOrEqual(3);
      expect(r.beats.length, r.id).toBeLessThanOrEqual(8);
      expect(r.endings.length, r.id).toBeGreaterThanOrEqual(2);
      expect(r.endings.length, r.id).toBeLessThanOrEqual(3);
      expect(r.endings[r.endings.length - 1]?.when, r.id).toBeUndefined();
      expect(r.endings.some((e) => e.quality === 'good'), r.id).toBe(true);
      expect(r.endings.some((e) => e.quality === 'bad'), r.id).toBe(true);
    }
    const ids = cast.flatMap((r) => [...r.beats.map((b) => b.id), ...r.endings.map((e) => e.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('only uses metrics the engine understands in beat and ending conditions', () => {
    for (const r of cast) {
      for (const b of r.beats) for (const x of testsOf(b.when)) expect(isKnownMetric(x.m), `${b.id}: ${x.m}`).toBe(true);
      for (const e of r.endings) for (const x of testsOf(e.when)) expect(isKnownMetric(x.m), `${e.id}: ${x.m}`).toBe(true);
    }
  });
  it('keeps every beat and ending to 60 words or fewer once placeholders are filled, with none left over', () => {
    for (const r of cast) {
      for (const b of r.beats) {
        const text = renderText(b.text, vars);
        expect(text, b.id).not.toMatch(/[{}]/);
        expect(wordCount(text), `${b.id} (${wordCount(text)} words)`).toBeLessThanOrEqual(60);
        expect(wordCount(text), b.id).toBeGreaterThanOrEqual(25);
        for (const o of b.choice?.options ?? []) expect(wordCount(o.label), `${b.id}/${o.id}`).toBeLessThanOrEqual(16);
      }
      for (const e of r.endings) {
        const text = renderText(e.text, vars);
        expect(text, e.id).not.toMatch(/[{}]/);
        expect(wordCount(text), `${e.id} (${wordCount(text)} words)`).toBeLessThanOrEqual(60);
      }
    }
  });
  it('marks every line of Aunty June\'s content needsConsultation and keeps it general and respectful', () => {
    const june = cast.find((r) => r.id === 'aunty-june');
    expect(june?.needsConsultation).toBe(true);
    for (const b of june?.beats ?? []) {
      expect(b.needsConsultation, b.id).toBe(true);
      expect(b.text, b.id).not.toMatch(FORBIDDEN);
    }
    for (const e of june?.endings ?? []) {
      expect(e.needsConsultation, e.id).toBe(true);
      expect(e.text, e.id).not.toMatch(FORBIDDEN);
    }
    // And nobody else's text drifts into sacred specifics either.
    for (const r of cast) for (const b of r.beats) expect(b.text).not.toMatch(FORBIDDEN);
  });
  it('flags every Country line needsConsultation and avoids sacred specifics and art references', () => {
    const lines: { text: string; needsConsultation: boolean }[] = [];
    for (const site of Object.values(COUNTRY.sites)) lines.push(site.name, site.consulted, site.disturbed, site.ignored);
    for (const [k, v] of Object.entries(COUNTRY.lines)) lines.push(typeof v === 'function' ? v(7) : v, ...(k ? [] : []));
    for (const p of COUNTRY.places) lines.push(p.original);
    expect(lines.length).toBeGreaterThan(15);
    for (const l of lines) {
      expect(l.needsConsultation).toBe(true);
      expect(l.text).not.toMatch(FORBIDDEN);
    }
  });
  it('does not invent place names: dual-name originals are placeholders for the community', () => {
    for (const p of COUNTRY.places) expect(p.original.text).toMatch(/to be supplied by the community/);
  });
  it('speaks in Australian English and at a readable level (short sentences)', () => {
    for (const r of cast) {
      for (const b of r.beats) {
        const sentences = renderText(b.text, vars).split(/[.!?]+\s/).filter(Boolean);
        const longest = Math.max(...sentences.map(wordCount));
        expect(longest, `${b.id}: longest sentence ${longest} words`).toBeLessThanOrEqual(38);
        expect(b.text, b.id).not.toMatch(/\b(color|neighbor|favorite|realize|organize)\b/i);
      }
    }
  });
  it('names a distinct speaker for every dilemma and uses real resident ids', () => {
    const ids = new Set(cast.map((r) => r.id));
    for (const d of cards) if (d.speaker) expect(ids.has(d.speaker), d.id).toBe(true);
  });
});

describe('dilemma cards (content integrity)', () => {
  const ids = new Set(cast.map((r) => r.id));
  const creatures = new Set(SPECIES.map((s) => s.id));
  it('has 12+ cards: about five in Act 1 and two dozen in Act 2', () => {
    expect(cards.length).toBeGreaterThanOrEqual(12);
    expect(cards.filter((c) => c.phase === 'act1').length).toBeGreaterThanOrEqual(4);
    expect(cards.filter((c) => c.phase === 'act2').length).toBeGreaterThanOrEqual(21);
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });
  it('offers two or three options per card, each with a preview of who is helped and hurt', () => {
    for (const c of cards) {
      expect(c.options.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.options.length, c.id).toBeLessThanOrEqual(3);
      expect(new Set(c.options.map((o) => o.id)).size, c.id).toBe(c.options.length);
      for (const o of c.options) {
        expect(o.preview.helps.length + o.preview.hurts.length, `${c.id}/${o.id}`).toBeGreaterThanOrEqual(2);
        expect(o.preview.helps.length, `${c.id}/${o.id} helps`).toBeGreaterThanOrEqual(1);
        expect(o.preview.hurts.length, `${c.id}/${o.id} hurts`).toBeGreaterThanOrEqual(1);
        for (const t of [...o.preview.helps, ...o.preview.hurts]) {
          expect(t.why.length).toBeGreaterThanOrEqual(5);
          if (t.type === 'resident') expect(ids.has(t.id), `${c.id}/${o.id}: ${t.id}`).toBe(true);
          if (t.type === 'creature') expect(creatures.has(t.id), `${c.id}/${o.id}: ${t.id}`).toBe(true);
        }
        for (const m of Object.keys(o.effects.mood ?? {})) expect(ids.has(m), `${c.id}/${o.id}: mood ${m}`).toBe(true);
        expect(o.outcome.length).toBeGreaterThan(15);
      }
    }
  });
  it('keeps text short and readable, with an evidence blurb on every card', () => {
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
  it('has several cards with no clean answer (no option is backed by the evidence)', () => {
    const open = cards.filter((c) => c.noCleanAnswer);
    expect(open.length).toBeGreaterThanOrEqual(5);
    for (const c of open) expect(c.options.some((o) => o.evidenceBacked), c.id).toBe(false);
    // Cards with a clearer answer reward it.
    const clearer = cards.filter((c) => !c.noCleanAnswer);
    expect(clearer.filter((c) => c.options.some((o) => o.evidenceBacked)).length).toBeGreaterThanOrEqual(15);
  });
  it('marks consultation-dependent cards and keeps them free of sacred specifics', () => {
    const need = cards.filter((c) => c.needsConsultation);
    expect(need.length).toBeGreaterThanOrEqual(3);
    for (const c of need) {
      expect(c.speaker === 'aunty-june' || c.id === 'd2-tourism', c.id).toBe(true);
      const all = [c.setup, c.evidence, ...c.options.flatMap((o) => [o.outcome, o.label])].join(' ');
      expect(all, c.id).not.toMatch(FORBIDDEN);
      for (const o of c.options.filter((x) => (x.effects.partnership ?? 0) !== 0 || x.preview.helps.concat(x.preview.hurts).some((t) => t.id === 'aunty-june'))) {
        expect(o.needsConsultation === true || c.needsConsultation === true, `${c.id}/${o.id}`).toBe(true);
      }
    }
  });
  it('is not a lecture: no card mentions its own learning goals', () => {
    for (const c of cards) expect(c.setup + c.options.map((o) => o.outcome).join(' ')).not.toMatch(/syllabus|curriculum|learning outcome|you should learn/i);
  });
});

describe('species, research and repurposing (content integrity)', () => {
  it('has the seven Coal Coast species with habitat specs, named families and an evidence blurb', () => {
    expect(SPECIES.map((s) => s.id)).toEqual(['koala', 'black-cockatoo', 'green-turtle', 'platypus', 'frogs', 'flying-fox', 'shorebirds']);
    for (const s of SPECIES_DATA) {
      expect(s.families.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < s.families.length; i++) expect(s.families[i]?.minPop).toBeGreaterThan(s.families[i - 1]?.minPop ?? 0);
      expect(wordCount(s.evidence)).toBeGreaterThanOrEqual(35);
      expect(s.text.needs.length).toBeGreaterThanOrEqual(2);
      expect(renderText(s.text.arrive, { n: '3' })).not.toMatch(/[{}]/);
      expect(SPECIES_BY_ID[s.id]).toBe(s);
    }
    expect(SPECIES_BY_ID.koala?.families[0]?.name).toBe('Marri family');
    expect(SPECIES_BY_ID['green-turtle']?.families[0]?.name).toBe('Old Shelly');
    expect(SPECIES_BY_ID['flying-fox']?.heatSensitive).toBe(true);
  });
  it('has a recycling research tree with costs, effects, accurate blurbs and a critical plastic-to-fuel card', () => {
    expect(RESEARCH.length).toBeGreaterThanOrEqual(6);
    for (const r of RESEARCH) {
      expect(r.cost).toBeGreaterThan(0);
      expect(wordCount(r.blurb)).toBeGreaterThanOrEqual(15);
      expect(wordCount(r.evidence)).toBeGreaterThanOrEqual(30);
      for (const q of r.requires ?? []) expect(RESEARCH_BY_ID[q]).toBeDefined();
    }
    for (const id of ['ewaste', 'tyre-road', 'green-steel', 'biogas', 'construction-reuse', 'plastic-to-fuel']) expect(RESEARCH_BY_ID[id]).toBeDefined();
    const ptf = RESEARCH_BY_ID['plastic-to-fuel'];
    expect(ptf?.kind).toBe('critique');
    expect(ptf?.evidence).toMatch(/energy/);
    expect(ptf?.evidence).toMatch(/CO2/);
    expect(RESEARCH_BY_ID['green-steel']?.evidence).toMatch(/hydrogen/);
  });
  it('maps every legacy building type to repurpose options that fit inside its footprint', () => {
    for (const [type, opts] of Object.entries(REPURPOSE)) {
      expect(LEGACY_TYPES).toContain(type);
      const old = BUILDINGS[type as keyof typeof BUILDINGS];
      for (const o of opts ?? []) {
        expect(o.story.length).toBeGreaterThan(40);
        if (o.requires) expect(RESEARCH_BY_ID[o.requires]).toBeDefined();
        if (o.into !== 'rehab') {
          const nb = BUILDINGS[o.into];
          expect(nb.repurposeOnly, o.id).toBe(true);
          expect(nb.w <= old.w && nb.h <= old.h, `${o.id}: ${nb.w}x${nb.h} inside ${old.w}x${old.h}`).toBe(true);
        }
      }
    }
    for (const t of ['steelworks', 'port', 'landfill', 'coalpower', 'factory', 'coalmine']) expect(REPURPOSE[t as keyof typeof REPURPOSE]?.length, t).toBeGreaterThan(0);
  });
  it('has reflection prompts for each kind of ending and a letter prompt for Sam and Jordan', () => {
    expect(REFLECTIONS.length).toBeGreaterThanOrEqual(8);
    for (const w of ['any', 'success', 'struggle', 'failed'] as const) expect(REFLECTIONS.some((r) => r.when === w)).toBe(true);
    expect(LETTER_PROMPT).toMatch(/Sam and Jordan/);
    expect(EPILOGUE.three(2100)).toContain('2100');
  });
});
