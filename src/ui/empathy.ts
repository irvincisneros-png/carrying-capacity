// Empathy-layer UI: speech bubbles on the map + Town Voices feed, dilemma cards with a "who is helped / hurt"
// preview, the wildlife panel and the 2100 report card. Generic: driven by the payload types in ./types.ts.
// adaptEvent() maps whatever the sim emits (now or after it grows) onto those shapes defensively.
import type { SimEvent } from '../sim/types';
import { clear, h, svg } from './dom';
import { UI_ICONS } from './icons';
import { openModal } from './modal';
import type { DilemmaCard, ReportCard, Speaker, SpeciesStatus, StoryLine } from './types';
import { sfx } from '../audio/sfx';

const PORTRAIT_COLS = ['#c0583a', '#3d6fb0', '#5f9a4e', '#7a5aa8', '#d9a32a', '#2f8f9d', '#a3482f'];

export function portrait(sp: Speaker, size = 38): HTMLElement {
  if (sp.portrait) return h('img', { class: 'portrait', src: sp.portrait, alt: '', style: `width:${size}px;height:${size}px;object-fit:cover` });
  let hsh = 0;
  for (const ch of sp.id) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  const col = sp.colour ?? PORTRAIT_COLS[hsh % PORTRAIT_COLS.length]!;
  const init = sp.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return h('span', { class: 'portrait', style: `background:${col};width:${size}px;height:${size}px` }, init);
}

// ---------------------------------------------------------------- adapters
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Known resident ids from the design doc, for nicer names until the sim provides speakers. */
const KNOWN: Record<string, Speaker> = {
  'lena-tran': { id: 'lena-tran', name: 'Lena Tran', role: 'Fisher' },
  'mick-kowalski': { id: 'mick-kowalski', name: 'Mick Kowalski', role: 'Steelworker' },
  'priya-shah': { id: 'priya-shah', name: 'Dr Priya Shah', role: 'Climate scientist' },
  'dot-harris': { id: 'dot-harris', name: 'Dot Harris', role: 'Dairy farmer' },
  'aunty-june': { id: 'aunty-june', name: 'Aunty June', role: 'Elder' },
};

export function speakerFrom(v: unknown, fallbackId = 'town'): Speaker {
  if (isObj(v) && typeof v.name === 'string') {
    return { id: String(v.id ?? v.name), name: v.name, role: typeof v.role === 'string' ? v.role : undefined, portrait: typeof v.portrait === 'string' ? v.portrait : undefined, colour: typeof v.colour === 'string' ? v.colour : undefined };
  }
  if (typeof v === 'string') return KNOWN[v] ?? { id: v, name: v.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) };
  return KNOWN[fallbackId] ?? { id: fallbackId, name: 'Townsfolk' };
}

/** A sim event that should become a speech line (type 'story' or anything carrying speaker info). */
export function storyFromEvent(e: SimEvent): StoryLine | null {
  const ex = e as unknown as Record<string, unknown>;
  if (e.type !== 'story' && !ex.speaker && !ex.residentId) return null;
  const sp = speakerFrom(ex.speaker ?? ex.resident ?? ex.residentId, 'town');
  const mood = typeof ex.mood === 'string' ? (ex.mood as StoryLine['mood']) : undefined;
  return { id: e.id, speaker: sp, text: String(ex.line ?? ex.quote ?? e.text), mood, at: e.at, year: e.year };
}

/** A sim event carrying a dilemma card (shape is tolerant: card / dilemma / options at top level). */
export function dilemmaFromEvent(e: SimEvent): DilemmaCard | null {
  const ex = e as unknown as Record<string, unknown>;
  const raw = (isObj(ex.card) ? ex.card : isObj(ex.dilemma) ? ex.dilemma : (ex.type as string) === 'dilemma' ? ex : null) as Record<string, unknown> | null;
  if (!raw || !Array.isArray(raw.options)) return null;
  const options = (raw.options as unknown[]).filter(isObj).map((o, i) => ({
    id: String(o.id ?? i),
    label: String(o.label ?? o.title ?? `Option ${i + 1}`),
    detail: typeof o.detail === 'string' ? o.detail : typeof o.text === 'string' ? o.text : undefined,
    cost: typeof o.cost === 'number' ? o.cost : undefined,
    impacts: (Array.isArray(o.impacts) ? o.impacts : []).filter(isObj).map((im) => ({
      who: String(im.who ?? im.name ?? '?'), effect: Number(im.effect ?? im.delta ?? 0), note: typeof im.note === 'string' ? im.note : undefined, mixed: im.mixed === true,
    })),
  }));
  return {
    id: String(raw.id ?? e.id),
    title: String(raw.title ?? 'A decision'),
    text: String(raw.text ?? e.text),
    speaker: raw.speaker ? speakerFrom(raw.speaker) : undefined,
    options,
    evidence: typeof raw.evidence === 'string' ? raw.evidence : undefined,
  };
}

// ---------------------------------------------------------------- bubbles + Town Voices
export class Voices {
  feed: StoryLine[] = [];
  drawer: HTMLElement;
  private list: HTMLElement;
  private bubbles: { el: HTMLElement; line: StoryLine; until: number }[] = [];
  /** Project tile -> screen; set by the app. */
  project: ((tx: number, ty: number) => { x: number; y: number; visible: boolean }) | null = null;
  onNew: (() => void) | null = null;

  constructor() {
    this.list = h('div');
    this.drawer = h('div', { class: 'drawer panel', 'aria-label': 'Town voices' },
      h('div', { class: 'panel-head' }, h('h3', null, svg(UI_ICONS.speech), 'Town voices'), h('button', { class: 'btn small', onclick: () => this.drawer.classList.remove('open') }, 'Close')),
      this.list);
    document.body.appendChild(this.drawer);
  }

  say(line: StoryLine, bubbleMs = 7000): void {
    this.feed.unshift(line);
    if (this.feed.length > 80) this.feed.pop();
    this.renderFeed();
    this.onNew?.();
    if (line.at && this.project && this.bubbles.length < 2) {
      const el = h('div', { class: 'bubble' }, h('b', null, line.speaker.name), line.text);
      document.body.appendChild(el);
      this.bubbles.push({ el, line, until: performance.now() + bubbleMs });
      sfx('tick');
    }
  }

  private renderFeed(): void {
    clear(this.list);
    if (!this.feed.length) {
      this.list.appendChild(h('p', { class: 'muted' }, 'Residents will share what they think as the town changes.'));
      return;
    }
    for (const l of this.feed) {
      this.list.appendChild(h('div', { class: 'voice' }, portrait(l.speaker),
        h('div', null, h('small', null, `${l.speaker.name}${l.speaker.role ? ' · ' + l.speaker.role : ''}${l.year ? ' · ' + l.year : ''}`), h('p', null, l.text))));
    }
  }

  open(): void {
    this.renderFeed();
    this.drawer.classList.add('open');
  }

  /** Per frame: keep bubbles pinned to their tiles. */
  update(): void {
    const now = performance.now();
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]!;
      if (now > b.until || !this.project || !b.line.at) {
        b.el.remove();
        this.bubbles.splice(i, 1);
        continue;
      }
      const p = this.project(b.line.at.x, b.line.at.y);
      b.el.style.left = `${p.x}px`;
      b.el.style.top = `${p.y}px`;
      b.el.style.opacity = p.visible ? String(Math.min(1, (b.until - now) / 600)) : '0';
    }
    this.unstack();
  }

  /** Two residents speaking from nearby homes: lift the newer bubble above the older one instead of covering it. */
  private unstack(): void {
    if (!this.bubbles.length) return;
    const placed: { l: number; r: number; t: number; b: number }[] = [];
    // Never lift a bubble over the top HUD bar: beside the other bubble instead.
    const hud = document.querySelector('.hud');
    const minTop = hud ? hud.getBoundingClientRect().bottom + 6 : 80;
    for (const b of this.bubbles) {
      const x = parseFloat(b.el.style.left) || 0;
      const y = parseFloat(b.el.style.top) || 0;
      const w = b.el.offsetWidth, hgt = b.el.offsetHeight;
      let top = y - 12 - hgt;
      let l = x - w / 2, r = x + w / 2;
      let lift = 0, shift = 0;
      for (let guard = 0; guard < 4; guard++) {
        const hit = placed.find((q) => l < q.r + 6 && r > q.l - 6 && top < q.b + 6 && top + hgt > q.t - 6);
        if (!hit) break;
        const d = top + hgt - (hit.t - 8);
        if (top - d >= minTop) {
          top -= d;
          lift += d;
        } else {
          // Side by side: to the right of the other bubble, or to its left if that runs off screen.
          const right = hit.r + 8 - l;
          const left = hit.l - 8 - r;
          const dx = r + right <= window.innerWidth - 8 ? right : left;
          l += dx; r += dx; shift += dx;
        }
      }
      b.el.style.marginTop = lift > 0 ? `${-lift}px` : '';
      b.el.style.marginLeft = shift !== 0 ? `${shift}px` : '';
      b.el.classList.toggle('lifted', lift > 0 || shift !== 0);
      placed.push({ l, r, t: top, b: top + hgt });
    }
  }
}

// ---------------------------------------------------------------- dilemma
export function showDilemma(card: DilemmaCard, onChoose: (optionId: string) => void): void {
  let chosen = false;
  const evidence = card.evidence ? h('div', { class: 'science hidden' }, h('p', null, card.evidence)) : null;
  const m = openModal([
    h('div', { class: 'kicker' }, 'A decision for the town'),
    h('h2', null, card.title),
    card.speaker ? h('div', { style: 'display:flex;gap:10px;align-items:center;margin:8px 0' }, portrait(card.speaker, 44), h('div', null, h('b', null, card.speaker.name), h('div', { class: 'muted' }, card.speaker.role ?? ''))) : null,
    h('p', null, card.text),
    evidence ? h('button', { class: 'btn small teal', onclick: () => evidence.classList.toggle('hidden') }, 'What does the evidence say?') : null,
    evidence,
    h('div', { class: 'dil-opts' }, ...card.options.map((o) => h('button', {
      class: 'dil-opt',
      onclick: () => { chosen = true; sfx('click'); m.close(); onChoose(o.id); },
    },
    h('h4', null, h('span', null, o.label), o.cost ? h('span', { class: 'muted' }, `$${o.cost}k`) : null),
    o.detail ? h('p', { style: 'margin:0 0 8px;font-size:13px' }, o.detail) : null,
    o.winLose ? h('div', { class: 'winlose', 'data-qa': 'winlose' }, h('b', null, 'Who wins, who loses'),
      h('p', null, h('span', null, 'Residents'), o.winLose.residents), h('p', null, h('span', null, 'Animals'), o.winLose.animals), h('p', null, h('span', null, 'Future generations'), o.winLose.future)) : null,
    h('div', { class: 'impacts' }, ...o.impacts.map((im) => {
      const cls = im.effect >= 2 ? 'p2' : im.effect >= 1 ? 'p1' : im.effect <= -2 ? 'n2' : im.effect <= -1 ? 'n1' : 'z';
      const arrow = im.mixed ? '▲▼' : im.effect > 0 ? '▲'.repeat(Math.min(2, im.effect)) : im.effect < 0 ? '▼'.repeat(Math.min(2, -im.effect)) : '•';
      return h('span', { class: `impact ${cls}${im.mixed ? ' mixed' : ''}`, title: im.note ?? '' }, `${arrow} ${im.who}${im.mixed ? ': mixed' : ''}`);
    }))))),
  ], { closable: false, onClose: () => { if (!chosen) onChoose(card.options[0]?.id ?? ''); } });
}

// ---------------------------------------------------------------- species
export class SpeciesPanel {
  drawer: HTMLElement;
  private list: HTMLElement;
  species: SpeciesStatus[] = [];
  /** Show / hide a species' habitat on the map (null = hide). */
  onHabitat: ((id: string | null) => void) | null = null;
  private shown: string | null = null;

  constructor() {
    this.list = h('div');
    this.drawer = h('div', { class: 'drawer panel', 'aria-label': 'Wildlife' },
      h('div', { class: 'panel-head' }, h('h3', null, svg(UI_ICONS.paw), 'Wildlife'), h('button', { class: 'btn small', onclick: () => this.drawer.classList.remove('open') }, 'Close')),
      this.list);
    document.body.appendChild(this.drawer);
  }

  set(list: SpeciesStatus[]): void {
    this.species = list;
    clear(this.list);
    if (!list.length) {
      this.list.appendChild(h('p', { class: 'muted' }, 'As habitat returns, animals will come back. Their stories appear here.'));
      return;
    }
    for (const s of list) {
      this.list.appendChild(h('div', { class: 'species-card' },
        h('span', { class: 'portrait', style: 'background:#8a6a4a' }, svg(UI_ICONS.paw)),
        h('div', null, h('b', null, s.name), h('div', { class: 'muted', style: 'font-size:12px' }, `${s.family ? s.family + ' · ' : ''}${s.population} ${s.trend > 0 ? '▲' : s.trend < 0 ? '▼' : '•'}${s.needs ? ' · needs ' + s.needs : ''}`)),
        h('div', { style: 'display:flex;flex-direction:column;gap:4px;align-items:flex-end;margin-left:auto' },
          h('span', { class: `st ${s.status.replace(/ /g, '-')}`, style: 'margin-left:0' }, s.status),
          h('button', { class: 'linkbtn', onclick: () => { this.shown = this.shown === s.id ? null : s.id; this.onHabitat?.(this.shown); this.set(this.species); } }, this.shown === s.id ? 'hide habitat' : 'show habitat'))));
    }
  }

  open(): void {
    if (!this.species.length) this.set([]);
    this.drawer.classList.add('open');
  }
}

// ---------------------------------------------------------------- report card
export function reportCardView(rc: ReportCard): HTMLElement {
  const starEls = [0, 1, 2].map((i) => {
    const s = svg(i < rc.stars ? UI_ICONS.star : UI_ICONS.starOff);
    s.style.animationDelay = `${0.3 + i * 0.25}s`;
    return s;
  });
  return h('div', null,
    h('div', { class: 'stars' }, ...starEls),
    ...rc.items.map((it) => h('div', { class: 'grade-row' }, h('span', { class: 'grade', style: `color:${it.ok ? '#4f8a3e' : '#c0483a'}` }, it.grade),
      h('div', null, h('b', null, it.label), it.detail ? h('div', { class: 'muted', style: 'font-size:13px' }, it.detail) : null))),
    ...(rc.epilogues ?? []).map((e) => h('div', { class: 'voice' }, portrait(e.speaker), h('div', null, h('small', null, e.speaker.name), h('p', null, e.text)))));
}
