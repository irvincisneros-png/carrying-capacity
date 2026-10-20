/**
 * Dilemma cards: a short scenario, 2-3 options with trade-offs across people, creatures and the planet, a
 * perspective-taking preview of who is helped and hurt, and a "what does the evidence say?" blurb. Some have no
 * clean answer on purpose. Act 1 gets about four cards in total; Act 2 gets two or three per in-game decade.
 */
import { DILEMMAS } from '../content/dilemmas';
import { condMet, renderText, storyVars } from './conditions';
import type { Cond } from './conditions';
import { applyEffects, effectImpact } from './effects';
import type { Effects } from './effects';
import { noteAction } from './residents';
import { hash32 } from './season';
import { getScenario } from './scenarios';
import { cloneState } from './state';
import { emitStory } from './story';
import type { ActionResult, GameState, ScenarioId } from './types';
import type { DilemmasState } from './layerTypes';

export interface PreviewTarget {
  /** 'resident' and 'creature' ids must exist in the cast / species lists; 'planet', 'economy', 'town' are general. */
  type: 'resident' | 'creature' | 'planet' | 'economy' | 'town';
  id: string;
  why: string;
}

export interface DilemmaPreview {
  helps: readonly PreviewTarget[];
  hurts: readonly PreviewTarget[];
}

export interface DilemmaOption {
  id: string;
  label: string;
  /** What happens next, told as a short story beat. */
  outcome: string;
  effects: Effects;
  preview: DilemmaPreview;
  /** True where the best available evidence points to this choice. Rewarded a little. */
  evidenceBacked?: boolean;
  needsConsultation?: boolean;
}

export interface DilemmaDef {
  id: string;
  title: string;
  phase: 'act1' | 'act2';
  /** Inclusive calendar years the card can appear. */
  years: readonly [number, number];
  when?: Cond;
  /** Resident id who brings the problem to you. */
  speaker?: string;
  setup: string;
  options: readonly DilemmaOption[];
  /** "What does the evidence say?" */
  evidence: string;
  /** Deliberately has no clean answer: every option costs someone or something. */
  noCleanAnswer?: boolean;
  /** Higher cards are offered first when several are eligible. */
  priority?: number;
  /** May come round again this many years after it was last offered (for recurring problems). */
  repeat?: number;
  needsConsultation?: boolean;
}

export const ACT2_OFFERS_PER_DECADE = 3;
export const ACT1_MIN_GAP = 20;
export const PENDING_EXPIRY_YEARS = 5;
/** Society nudge from all dilemma choices stays within this. */
export const DILEMMA_SOCIETY_CAP = 10;
export const EVIDENCE_REWARD = { society: 1.5, mood: 3 };

export function emptyDilemmas(): DilemmasState {
  return { offered: {}, pending: [], decisions: [], adjust: 0 };
}

export function dilemmasFor(scenario: ScenarioId): readonly DilemmaDef[] {
  return DILEMMAS[scenario] ?? [];
}

export function getDilemma(scenario: ScenarioId, id: string): DilemmaDef | undefined {
  return dilemmasFor(scenario).find((d) => d.id === id);
}

function fire(s: GameState, d: DilemmaDef): void {
  s.dilemmas.offered[d.id] = s.year;
  s.dilemmas.pending.push(d.id);
  emitStory(s, renderText(d.setup, storyVars(s)), {
    channel: 'dilemma', ref: d.id,
    ...(d.speaker ? { speakerId: d.speaker } : {}),
    choice: { prompt: d.title, options: d.options.map((o) => ({ id: o.id, label: o.label })) },
    tone: 'concern',
    ...(d.needsConsultation ? { needsConsultation: true } : {}),
  }, 0.6);
}

function canOffer(s: GameState, d: DilemmaDef): boolean {
  const last = s.dilemmas.offered[d.id];
  if (last === undefined) return true;
  return d.repeat !== undefined && s.year - last >= d.repeat && !s.dilemmas.pending.includes(d.id);
}

function eligible(s: GameState, phase: 'act1' | 'act2'): DilemmaDef[] {
  return dilemmasFor(s.scenarioId)
    .filter((d) => d.phase === phase && canOffer(s, d) && s.year >= d.years[0] && s.year <= d.years[1] && condMet(s, d.when))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || hash32(s.seed, s.year, a.id.length * 131 + a.id.charCodeAt(a.id.length - 1)) - hash32(s.seed, s.year, b.id.length * 131 + b.id.charCodeAt(b.id.length - 1)));
}

function expire(s: GameState): void {
  for (const id of s.dilemmas.pending.slice()) {
    const y = s.dilemmas.offered[id];
    if (y === undefined || s.year - y < PENDING_EXPIRY_YEARS) continue;
    const d = getDilemma(s.scenarioId, id);
    s.dilemmas.pending = s.dilemmas.pending.filter((p) => p !== id);
    s.dilemmas.decisions.push({
      dilemmaId: id, optionId: 'ignored', year: s.year, title: d?.title ?? id, optionLabel: 'Put off until it was too late',
      impact: 1, evidenceBacked: false,
    });
    s.dilemmas.adjust -= 1;
  }
}

/** Act 1: called once per decade turn. Offers at most one card, at least ACT1_MIN_GAP years apart. */
export function offerAct1(s: GameState): void {
  expire(s);
  const last = Math.max(-1e9, ...Object.values(s.dilemmas.offered).map((y) => y));
  if (s.dilemmas.pending.length > 0 || s.year - last < ACT1_MIN_GAP) return;
  const pick = eligible(s, 'act1')[0];
  if (pick) fire(s, pick);
}

/** Act 2: called at each year end. Up to three cards per decade, spread through it, at most two waiting at once. */
export function offerAct2(s: GameState): void {
  expire(s);
  const start = getScenario(s.scenarioId).act2.startYear;
  const off = s.year - start;
  if (off < 1) return;
  const window = Math.floor(off / 10);
  const inWindow = Object.values(s.dilemmas.offered).filter((y) => Math.floor((y - start) / 10) === window).length;
  if (inWindow >= ACT2_OFFERS_PER_DECADE || s.dilemmas.pending.length >= 2) return;
  const within = off % 10;
  // Cards arrive in years 1, 4 and 7 of the decade; a missed slot is retried the next year.
  const slots = [1, 4, 7];
  const due = slots.filter((x) => x <= within).length;
  if (inWindow >= due) return;
  const pick = eligible(s, 'act2')[0];
  if (pick) fire(s, pick);
}

/** Society nudge in force from dilemma choices, bounded. */
export function dilemmaSociety(s: GameState): number {
  return Math.max(-DILEMMA_SOCIETY_CAP, Math.min(DILEMMA_SOCIETY_CAP, s.dilemmas.adjust));
}

export function choose(state: GameState, dilemmaId: string, optionId: string): { state: GameState; result: ActionResult } {
  const fail = (reason: string, code: 'invalid' | 'no-funds' = 'invalid'): { state: GameState; result: ActionResult } => ({
    state, result: { ok: false, code, reason },
  });
  if (!state.dilemmas.pending.includes(dilemmaId)) return fail('That card is not on the table');
  const d = getDilemma(state.scenarioId, dilemmaId);
  const o = d?.options.find((x) => x.id === optionId);
  if (!d || !o) return fail('That is not one of the options');
  const cost = o.effects.budget ?? 0;
  if (cost < 0 && state.budget < -cost) return fail(`Not enough money: this costs ${-cost}`, 'no-funds');
  const s = cloneState(state);
  s.dilemmas.pending = s.dilemmas.pending.filter((p) => p !== dilemmaId);
  applyEffects(s, o.effects);
  if (o.evidenceBacked) {
    s.dilemmas.adjust += EVIDENCE_REWARD.society;
    const priya = s.residents.list['priya-shah'];
    if (priya) priya.mood = Math.min(100, priya.mood + EVIDENCE_REWARD.mood);
  }
  s.dilemmas.decisions.push({
    dilemmaId, optionId, year: s.year, title: d.title, optionLabel: o.label,
    impact: effectImpact(o.effects) + (o.evidenceBacked ? 1 : 0), evidenceBacked: o.evidenceBacked === true,
  });
  noteAction(s, `chose.${dilemmaId}.${optionId}`);
  emitStory(s, renderText(o.outcome, storyVars(s)), {
    channel: 'dilemma', ref: dilemmaId, tone: 'neutral', ...(o.needsConsultation || d.needsConsultation ? { needsConsultation: true } : {}),
  }, 0.4);
  s.version = state.version + 1;
  return { state: s, result: { ok: true, ...(cost < 0 ? { spent: -cost } : {}) } };
}
