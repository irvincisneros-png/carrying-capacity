/**
 * Residents: recurring people with a mood (0-100) driven by the metrics they care about, and short story arcs
 * ("beats") that fire when their conditions are met. Beats become 'story' events; some ask the player a question.
 * Every resident ends in one of 2-3 epilogue endings chosen from how things turned out. No villains.
 */
import { CAST } from '../content/residents';
import { condMet, heavyJobs, meanMood, metric, renderText, storyVars } from './conditions';
import type { Cond, MetricKey } from './conditions';
import { applyEffects } from './effects';
import type { Effects } from './effects';
import { cloneState } from './state';
import { emitStory } from './story';
import { TileKind } from './types';
import type { EventType, ActionResult, GameState, ScenarioId, SimEvent } from './types';
import type { ResidentRuntime, ResidentsState, StoryTone } from './layerTypes';

export interface CareHook {
  metric: MetricKey;
  weight: number;
  /** Metric value giving satisfaction 0, and 1. (good < bad works for "lower is better".) */
  bad: number;
  good: number;
}

export interface BeatOption {
  id: string;
  label: string;
  effects?: Effects;
}

export interface BeatChoice {
  prompt?: string;
  options: readonly BeatOption[];
  /** Applied (with 'ignored' recorded) if the player never answers. */
  ignored?: Effects;
}

export interface StoryBeat {
  id: string;
  /** Short heading for the Town Voices feed. */
  title: string;
  when: Cond;
  /** <= 60 words once {placeholders} are filled in. */
  text: string;
  tone?: StoryTone;
  choice?: BeatChoice;
  effects?: Effects;
  /** Minimum years since this resident's last beat (default 10 in Act 1, 4 in Act 2). */
  minGapYears?: number;
  /** Fires even if the resident spoke recently. */
  urgent?: boolean;
  needsConsultation?: boolean;
}

export type EndingQuality = 'good' | 'mixed' | 'bad';

export interface EndingDef {
  id: string;
  quality: EndingQuality;
  title: string;
  /** First ending whose condition passes is chosen; the last must have none. */
  when?: Cond;
  text: string;
  needsConsultation?: boolean;
}

export interface HomeHint {
  /** Where on the map this person lives, for the speech bubble and portrait pin. */
  near: 'estuary' | 'beach' | 'river' | 'escarpment' | 'bush' | 'town' | 'farmland' | 'wetland' | 'mine';
  description: string;
}

export interface ResidentDef {
  id: string;
  name: string;
  role: string;
  family: string;
  blurb: string;
  homeHint: HomeHint;
  /** Portrait key for the UI. */
  portrait: string;
  traits: readonly string[];
  /** Starting mood. */
  start: number;
  /** What they care about, as weighted metric hooks. */
  cares: readonly CareHook[];
  /** Immediate mood change when an event of this type happens. */
  reacts?: Partial<Record<EventType, number>>;
  beats: readonly StoryBeat[];
  endings: readonly EndingDef[];
  needsConsultation?: boolean;
  /** The local Aboriginal / Torres Strait Islander Elder: Caring for Country speaks through this person. */
  elder?: boolean;
  /** The science voice: explains the player's graphs and approves evidence-backed choices. */
  science?: boolean;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function castFor(scenario: ScenarioId): readonly ResidentDef[] {
  return CAST[scenario] ?? [];
}

/** The scenario's Elder (Caring for Country), if it has one. */
export function elderOf(scenario: ScenarioId): ResidentDef | undefined {
  return castFor(scenario).find((r) => r.elder === true);
}

/** The scenario's science voice. */
export function scienceVoiceOf(scenario: ScenarioId): ResidentDef | undefined {
  return castFor(scenario).find((r) => r.science === true);
}

export function residentDef(scenario: ScenarioId, id: string): ResidentDef | undefined {
  return castFor(scenario).find((r) => r.id === id);
}

export function initResidents(scenario: ScenarioId): ResidentsState {
  const list: Record<string, ResidentRuntime> = {};
  for (const r of castFor(scenario)) list[r.id] = { mood: r.start, trend: 0, lastBeatYear: -1 };
  return {
    list, fired: {}, choices: {}, pending: [], actions: {}, nudge: 0, applied: 0, peaks: {}, history: [],
  };
}

/** Satisfaction 0..1 for one care hook. */
export function satisfaction(s: GameState, h: CareHook): number {
  const v = metric(s, h.metric);
  const span = h.good - h.bad;
  return span === 0 ? 0.5 : clamp((v - h.bad) / span, 0, 1);
}

/** What the mood is heading towards (0..100) given the current state. */
export function moodTarget(s: GameState, def: ResidentDef): number {
  let w = 0, sum = 0;
  for (const h of def.cares) {
    w += h.weight;
    sum += h.weight * satisfaction(s, h);
  }
  return w > 0 ? (100 * sum) / w : 50;
}

/** Records the highest values seen (used for "jobs relative to the peak"). */
export function updatePeaks(s: GameState): void {
  s.residents.peaks.heavyJobs = Math.max(s.residents.peaks.heavyJobs ?? 0, heavyJobs(s));
}

/**
 * Moves every mood towards its target. `rate` is the share of the gap closed (0.1 per Act 2 season, 0.5 per
 * Act 1 decade). Returns nothing; mutates `s`.
 */
export function stepMoods(s: GameState, rate: number): void {
  updatePeaks(s);
  for (const def of castFor(s.scenarioId)) {
    const rt = s.residents.list[def.id];
    if (!rt) continue;
    const next = clamp(rt.mood + (moodTarget(s, def) - rt.mood) * rate, 0, 100);
    rt.trend = Math.round((next - rt.mood) * 10) / 10 || 0; // never -0 (it does not survive a save)
    rt.mood = Math.round(next * 10) / 10;
  }
}

/** Residents react to the season's events right away (a fish kill hits the fisher hard). */
export function reactToEvents(s: GameState, events: readonly SimEvent[]): void {
  for (const e of events) {
    if (e.type === 'story') continue;
    for (const def of castFor(s.scenarioId)) {
      const d = def.reacts?.[e.type];
      const rt = s.residents.list[def.id];
      if (d && rt) rt.mood = clamp(rt.mood + d * Math.min(1.5, Math.max(0.5, e.severity)), 0, 100);
    }
  }
}

/** Mean mood -> society nudge. Act 1: +-3. Act 2: +-8. */
export function societyShare(s: GameState): number {
  const m = meanMood(s);
  const span = s.phase === 'act1' || s.phase === 'turning-point' ? 3 : 8;
  return clamp(((m - 50) / 50) * span * 1.4, -span, span);
}

/** Counts a player action for beat conditions ('built.steelworks', 'demolished.steelworks', ...). */
export function noteAction(s: GameState, key: string): void {
  s.residents.actions[key] = (s.residents.actions[key] ?? 0) + 1;
}

// ---------------------------------------------------------------------------------------------------------
// Beats
// ---------------------------------------------------------------------------------------------------------

export const CHOICE_EXPIRY_YEARS = 3;

function expireChoices(s: GameState): void {
  const cast = castFor(s.scenarioId);
  for (const id of s.residents.pending.slice()) {
    const firedYear = s.residents.fired[id];
    if (firedYear === undefined || s.year - firedYear < CHOICE_EXPIRY_YEARS) continue;
    const beat = cast.flatMap((r) => r.beats).find((b) => b.id === id);
    s.residents.pending = s.residents.pending.filter((p) => p !== id);
    s.residents.choices[id] = 'ignored';
    applyEffects(s, beat?.choice?.ignored);
  }
}

/** Fires every beat whose conditions are met (at most `cap` per call, one per resident). Mutates `s`. */
export function checkBeats(s: GameState, cap = 3): SimEvent[] {
  const out: SimEvent[] = [];
  expireChoices(s);
  const act1 = s.phase === 'act1' || s.phase === 'turning-point';
  const vars = storyVars(s);
  for (const def of castFor(s.scenarioId)) {
    if (out.length >= cap) break;
    const rt = s.residents.list[def.id];
    if (!rt) continue;
    for (const beat of def.beats) {
      if (s.residents.fired[beat.id] !== undefined) continue;
      if (!condMet(s, beat.when)) continue;
      const gap = beat.minGapYears ?? (act1 ? 10 : 4);
      if (!beat.urgent && rt.lastBeatYear >= 0 && s.year - rt.lastBeatYear < gap) continue;
      s.residents.fired[beat.id] = s.year;
      rt.lastBeatYear = s.year;
      applyEffects(s, beat.effects);
      if (beat.choice) s.residents.pending.push(beat.id);
      const needs = beat.needsConsultation === true || def.needsConsultation === true;
      out.push(emitStory(s, renderText(beat.text, vars), {
        channel: 'resident', speakerId: def.id, speaker: def.name, portrait: def.portrait, ref: beat.id,
        tone: beat.tone ?? 'neutral',
        ...(needs ? { needsConsultation: true } : {}),
        ...(beat.choice ? { choice: { ...(beat.choice.prompt ? { prompt: beat.choice.prompt } : {}), options: beat.choice.options.map((o) => ({ id: o.id, label: o.label })) } } : {}),
      }, 0.5));
      break;
    }
  }
  return out;
}

export function respond(state: GameState, beatId: string, optionId: string): { state: GameState; result: ActionResult } {
  const fail = (reason: string): { state: GameState; result: ActionResult } => ({ state, result: { ok: false, code: 'invalid', reason } });
  if (!state.residents.pending.includes(beatId)) return fail('Nobody is waiting for an answer to that');
  const beat = castFor(state.scenarioId).flatMap((r) => r.beats).find((b) => b.id === beatId);
  const opt = beat?.choice?.options.find((o) => o.id === optionId);
  if (!beat || !opt) return fail('That is not one of the choices');
  if (opt.effects?.budget && opt.effects.budget < 0 && state.budget < -opt.effects.budget) {
    return { state, result: { ok: false, code: 'no-funds', reason: `Not enough money: this costs ${-opt.effects.budget}` } };
  }
  const s = cloneState(state);
  s.residents.pending = s.residents.pending.filter((p) => p !== beatId);
  s.residents.choices[beatId] = optionId;
  applyEffects(s, opt.effects);
  noteAction(s, `chose.${beatId}.${optionId}`);
  s.version = state.version + 1;
  return { state: s, result: { ok: true, ...(opt.effects?.budget && opt.effects.budget < 0 ? { spent: -opt.effects.budget } : {}) } };
}

// ---------------------------------------------------------------------------------------------------------
// Endings and homes
// ---------------------------------------------------------------------------------------------------------

export function selectEnding(s: GameState, def: ResidentDef): EndingDef {
  for (const e of def.endings) if (condMet(s, e.when)) return e;
  return def.endings[def.endings.length - 1] as EndingDef;
}

export interface ResidentEnding {
  id: string;
  name: string;
  role: string;
  mood: number;
  endingId: string;
  quality: EndingQuality;
  title: string;
  text: string;
  needsConsultation: boolean;
}

export function resolveEndings(s: GameState): ResidentEnding[] {
  const vars = storyVars(s);
  return castFor(s.scenarioId).map((def): ResidentEnding => {
    const e = selectEnding(s, def);
    return {
      id: def.id, name: def.name, role: def.role, mood: s.residents.list[def.id]?.mood ?? def.start,
      endingId: e.id, quality: e.quality, title: e.title, text: renderText(e.text, vars),
      needsConsultation: e.needsConsultation === true || def.needsConsultation === true,
    };
  });
}

/** A tile near where a resident lives, for pins and speech bubbles. Deterministic. */
export function residentHome(s: GameState, def: ResidentDef): { x: number; y: number } {
  const g = s.grid;
  const want = (k: number): boolean => {
    switch (def.homeHint.near) {
      case 'estuary': return k === TileKind.Estuary;
      case 'beach': return k === TileKind.Beach;
      case 'river': return k === TileKind.River;
      case 'escarpment': return k === TileKind.Rock;
      case 'bush': return k === TileKind.Bush;
      case 'wetland': return k === TileKind.Wetland;
      case 'mine': return k === TileKind.Pit;
      case 'farmland':
      case 'town': return k === TileKind.Land;
    }
  };
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < g.kind.length; i++) if (want(g.kind[i] ?? 0)) { sx += i % g.w; sy += Math.floor(i / g.w); n++; }
  const cx = n > 0 ? sx / n : g.w / 2;
  const cy = n > 0 ? sy / n : g.h / 2;
  let best = { x: Math.round(cx), y: Math.round(cy) };
  let bd = Infinity;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const k = g.kind[y * g.w + x];
    if (k !== TileKind.Land && k !== TileKind.Bush) continue;
    // Bias away from the exact centre for farmland (out of town) and towards it for town.
    const bias = def.homeHint.near === 'farmland' ? -0.5 * Math.hypot(x - g.w * 0.3, y - g.h * 0.3) : 0;
    const d = Math.hypot(x - cx, y - cy) + bias;
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}
