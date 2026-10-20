// Adapters from the sim's empathy layer (residents, dilemmas, wildlife, report card - being built in parallel)
// onto the UI payload shapes in ./types.ts. Every lookup is defensive so additive / in-progress sim changes never
// break the client: anything missing simply falls back to the generic text in the SimEvent.
import * as SIM from '../sim';
import { TileKind, type GameState, type SimEvent } from '../sim/types';
import type { DilemmaCard, DilemmaImpact, ReportCard, Speaker, SpeciesStatus, StoryLine } from './types';

type AnyFn = (...a: unknown[]) => unknown;
const api = SIM as unknown as Record<string, unknown>;
const fn = (name: string): AnyFn | null => (typeof api[name] === 'function' ? (api[name] as AnyFn) : null);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const ROLE_COL: Record<string, string> = { 'lena-tran': '#2f8f9d', 'mick-kowalski': '#c0583a', 'aunty-june': '#8a5a3a', 'priya-shah': '#7a5aa8', 'dot-harris': '#5f9a4e', sam: '#d9a32a', jordan: '#3d6fb0' };

export function speaker(s: GameState, id: string | undefined, name?: string): Speaker {
  if (!id) return { id: 'town', name: name ?? 'Townsfolk' };
  try {
    const def = fn('residentDef')?.(s.scenarioId, id);
    if (isObj(def)) return { id, name: String(def.name ?? name ?? id), role: typeof def.role === 'string' ? def.role : undefined, colour: ROLE_COL[id] };
  } catch { /* ignore */ }
  return { id, name: name ?? id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), colour: ROLE_COL[id] };
}

/** A tile near where a resident lives, so their speech bubble points somewhere meaningful. */
export function homeTile(s: GameState, id: string | undefined): { x: number; y: number } | undefined {
  if (!id) return undefined;
  try {
    const def = fn('residentDef')?.(s.scenarioId, id);
    const home = def ? fn('residentHome')?.(s, def) : null;
    if (isObj(home) && typeof home.x === 'number' && typeof home.y === 'number') return { x: home.x, y: home.y };
  } catch { /* fall back to the heuristic below */ }
  let near = 'town';
  try {
    const def = fn('residentDef')?.(s.scenarioId, id);
    if (isObj(def) && isObj(def.homeHint) && typeof def.homeHint.near === 'string') near = def.homeHint.near;
  } catch { /* ignore */ }
  const g = s.grid;
  const want = (i: number): boolean => {
    const k = g.kind[i];
    switch (near) {
      case 'estuary': return k === TileKind.Estuary;
      case 'beach': return k === TileKind.Beach;
      case 'river': return k === TileKind.River;
      case 'escarpment': return k === TileKind.Rock;
      case 'bush': return k === TileKind.Bush;
      case 'farmland': return s.buildings.some((b) => b.type === 'farm' && g.building[i] === b.uid);
      default: return s.buildings.some((b) => (b.type === 'cottage' || b.type === 'suburb') && g.building[i] === b.uid);
    }
  };
  // deterministic pick: hash the id
  let hsh = 0;
  for (const ch of id) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  const cands: number[] = [];
  for (let i = 0; i < g.kind.length; i++) if (want(i)) cands.push(i);
  if (!cands.length) return undefined;
  const i = cands[hsh % cands.length]!;
  return { x: i % g.w, y: Math.floor(i / g.w) };
}

interface Meta { channel?: string; speakerId?: string; speaker?: string; ref?: string; tone?: string; choice?: { prompt?: string; options?: { id: string; label: string }[] } }
const metaOf = (e: SimEvent): Meta | null => {
  const m = (e as unknown as { story?: unknown }).story;
  return isObj(m) ? (m as Meta) : null;
};

const TONE_MOOD: Record<string, StoryLine['mood']> = { warm: 'happy', joy: 'happy', concern: 'worried', loss: 'sad', neutral: 'ok' };

export function storyLine(s: GameState, e: SimEvent): StoryLine | null {
  if (e.type !== 'story') return null;
  const m = metaOf(e);
  if (m?.channel === 'dilemma') return null;
  const sp = speaker(s, m?.speakerId, m?.speaker);
  const at = e.at ?? homeTile(s, m?.speakerId);
  return { id: e.id, speaker: m?.speakerId ? sp : { id: m?.channel ?? 'town', name: channelName(m?.channel) }, text: e.text, mood: TONE_MOOD[m?.tone ?? ''] ?? 'ok', at, year: e.year };
}

function channelName(c: string | undefined): string {
  switch (c) {
    case 'wildlife': return 'Wildlife';
    case 'country': return 'Caring for Country';
    case 'circular': return 'Old sites, new lives';
    case 'research': return 'Research';
    case 'satellite': return 'Satellite warning';
    default: return 'The town';
  }
}

/** Resident beats that ask a question ({type:'respond'}). */
export function beatChoice(s: GameState, e: SimEvent): DilemmaCard | null {
  const m = metaOf(e);
  if (!m || m.channel === 'dilemma' || !m.choice?.options?.length || !m.ref) return null;
  return {
    id: m.ref,
    title: m.choice.prompt ?? 'What do you do?',
    text: e.text,
    speaker: m.speakerId ? speaker(s, m.speakerId, m.speaker) : undefined,
    options: m.choice.options.map((o) => ({ id: o.id, label: o.label, impacts: [] })),
  };
}

/** Dilemma cards ({type:'choose'}) with the per-option "who is helped / hurt" preview from the dilemma catalogue. */
export function dilemmaCard(s: GameState, e: SimEvent): DilemmaCard | null {
  const m = metaOf(e);
  if (!m || m.channel !== 'dilemma' || !m.ref) return null;
  let def: Record<string, unknown> | null = null;
  try {
    const d = fn('getDilemma')?.(s.scenarioId, m.ref);
    if (isObj(d)) def = d;
  } catch { /* ignore */ }
  const nameOf = (t: Record<string, unknown>): string => {
    const id = String(t.id ?? '');
    if (t.type === 'resident') return speaker(s, id).name;
    if (t.type === 'creature') {
      const byId = api.SPECIES_BY_ID as Record<string, { name?: string }> | undefined;
      return byId?.[id]?.name ?? id;
    }
    return id ? id.charAt(0).toUpperCase() + id.slice(1) : String(t.type ?? '');
  };
  const opts: Record<string, unknown>[] = def && Array.isArray(def.options) ? (def.options as Record<string, unknown>[]) : (m.choice?.options ?? []).map((o) => ({ ...o }));
  return {
    id: m.ref,
    title: String(def?.title ?? m.choice?.prompt ?? 'A decision for the town'),
    text: String(def?.setup ?? e.text),
    speaker: m.speakerId ? speaker(s, m.speakerId, m.speaker) : def?.speaker ? speaker(s, String(def.speaker)) : undefined,
    evidence: typeof def?.evidence === 'string' ? def.evidence : undefined,
    options: opts.map((o) => {
      const pv = isObj(o.preview) ? o.preview : null;
      const impacts: DilemmaImpact[] = [];
      for (const t of (pv && Array.isArray(pv.helps) ? pv.helps : []) as Record<string, unknown>[]) impacts.push({ who: nameOf(t), effect: 1, note: String(t.why ?? '') });
      for (const t of (pv && Array.isArray(pv.hurts) ? pv.hurts : []) as Record<string, unknown>[]) impacts.push({ who: nameOf(t), effect: -1, note: String(t.why ?? '') });
      return { id: String(o.id), label: String(o.label), impacts };
    }),
  };
}

export function speciesList(s: GameState): SpeciesStatus[] {
  try {
    const c = fn('census')?.(s);
    if (!Array.isArray(c)) return [];
    return (c as Record<string, unknown>[]).map((x) => {
      const pop = Number(x.pop ?? 0);
      const start = Number(x.start ?? 0);
      const st = String(x.status ?? 'present');
      const status: SpeciesStatus['status'] = st === 'thriving' ? 'thriving' : st === 'struggling' ? 'struggling' : st === 'gone' ? 'gone' : pop > start ? 'returning' : 'stable';
      const fam = Array.isArray(x.families) ? (x.families as string[]) : [];
      return {
        id: String(x.id), name: String(x.name), family: fam.join(', ') || undefined, population: pop,
        trend: pop > start ? 1 : pop < start ? -1 : 0, status, needs: typeof x.limiting === 'string' && x.limiting ? x.limiting : undefined,
      };
    });
  } catch {
    return [];
  }
}

export function reportCard(s: GameState): ReportCard | undefined {
  try {
    const rc = fn('buildReportCard')?.(s);
    if (!isObj(rc)) return undefined;
    const objs = Array.isArray(rc.objectives) ? (rc.objectives as Record<string, unknown>[]) : [];
    const items = objs.map((o) => ({
      label: String(o.label).replace(/(\d)\s?C\b/g, '$1 °C'),
      grade: o.status === 'met' ? 'A' : o.status === 'missed' ? 'D' : o.status === 'pending' ? '–' : 'C',
      ok: o.status === 'met',
      detail: o.current === null || o.current === undefined ? undefined : `Ended at ${typeof o.current === 'number' ? Math.round(o.current * 10) / 10 : o.current}`,
    }));
    const census = Array.isArray(rc.census) ? (rc.census as Record<string, unknown>[]) : [];
    for (const c of census) items.push({ label: `${c.name}`, grade: c.status === 'thriving' ? 'A' : c.status === 'gone' ? 'D' : 'B', ok: c.status !== 'gone', detail: `${c.pop} animals (started with ${c.start})` });
    const residents = Array.isArray(rc.residents) ? (rc.residents as Record<string, unknown>[]) : [];
    return {
      title: `${rc.scenarioName ?? ''} · 2100 Report Card`,
      stars: (Number(rc.stars) || 0) as 0 | 1 | 2 | 3,
      items,
      epilogues: residents.map((r) => ({ speaker: speaker(s, String(r.id), String(r.name)), text: `${r.title}. ${r.text}` })),
      reflection: [...(Array.isArray(rc.reflections) ? (rc.reflections as string[]) : []), ...(typeof rc.letterPrompt === 'string' ? [rc.letterPrompt] : [])],
    };
  } catch {
    return undefined;
  }
}
