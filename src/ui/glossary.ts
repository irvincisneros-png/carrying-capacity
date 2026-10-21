// Field guide (WP8d): the first time a key term shows up in the game's text it is underlined with a tooltip, and the
// Field guide panel lists every term. `glossify(root)` is called on modals, toasts and panels as they are built.
import { GLOSSARY } from '../content/glossary';
import type { GlossTerm } from '../content/glossary';
import { h } from './dom';
import { LEARN_ICONS } from './learnicons';
import { svg } from './dom';

const seen = new Set<string>();
const queued: string[] = [];
let flushTimer = 0;
/** Called (batched, off the current call stack) with each term the first time it is underlined, so the save can remember it. */
let onNew: ((id: string) => void) | null = null;
let tipEl: HTMLElement | null = null;

const RES: { t: GlossTerm; re: RegExp }[] = GLOSSARY.map((t) => ({ t, re: new RegExp(`\\b(?:${t.match})\\b`, 'i') }));
const SKIP = 'button, textarea, input, select, script, style, kbd, .gloss, .x, .portrait, svg, canvas, [data-nogloss]';

export function setGlossarySeen(ids: readonly string[]): void {
  seen.clear();
  for (const id of ids) seen.add(id);
}
export function onGlossaryNew(fn: (id: string) => void): void {
  onNew = fn;
}
export function glossarySeen(): ReadonlySet<string> {
  return seen;
}

function tip(): HTMLElement {
  if (!tipEl) {
    tipEl = h('div', { class: 'gloss-tip hidden', role: 'tooltip' });
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function showTip(el: HTMLElement, t: GlossTerm): void {
  const box = tip();
  box.replaceChildren(h('b', null, t.term), h('p', null, t.def));
  box.classList.remove('hidden');
  const r = el.getBoundingClientRect();
  const w = box.offsetWidth, hgt = box.offsetHeight;
  const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  const y = r.top - hgt - 8 < 8 ? r.bottom + 8 : r.top - hgt - 8;
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
}
function hideTip(): void {
  tip().classList.add('hidden');
}

function mark(t: GlossTerm, text: string): HTMLElement {
  const el = h('span', { class: 'gloss', tabindex: 0, 'data-term': t.id, role: 'button', 'aria-label': `${t.term}: ${t.def}` }, text);
  el.addEventListener('pointerenter', () => showTip(el, t));
  el.addEventListener('pointerleave', hideTip);
  el.addEventListener('focus', () => showTip(el, t));
  el.addEventListener('blur', hideTip);
  el.addEventListener('click', (e) => { e.stopPropagation(); showTip(el, t); });
  return el;
}

function flush(): void {
  flushTimer = 0;
  const ids = queued.splice(0);
  for (const id of ids) onNew?.(id);
}

/** Underline the first appearance of each term not yet met, inside `root`. Cheap once every term is seen. */
export function glossify(root: HTMLElement): void {
  if (seen.size >= GLOSSARY.length) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && !n.parentElement.closest(SKIP) && (n.nodeValue ?? '').length > 3 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  for (const node of nodes) {
    let cur: Text | null = node;
    while (cur) {
      const text: string = cur.nodeValue ?? '';
      let best: { t: GlossTerm; at: number; len: number } | null = null;
      for (const { t, re } of RES) {
        if (seen.has(t.id)) continue;
        const m = re.exec(text);
        if (m && (best === null || m.index < best.at)) best = { t, at: m.index, len: m[0].length };
      }
      if (!best) break;
      const after: Text = cur.splitText(best.at);
      const rest: Text | null = after.length > best.len ? after.splitText(best.len) : null;
      const el = mark(best.t, after.nodeValue ?? '');
      after.replaceWith(el);
      seen.add(best.t.id);
      queued.push(best.t.id);
      if (!flushTimer) flushTimer = window.setTimeout(flush, 0);
      cur = rest;
    }
  }
}

/** The Field guide drawer: every term, A to Z, the ones you have met first. */
export class FieldGuide {
  el: HTMLElement;
  private list: HTMLElement;

  constructor() {
    this.list = h('div', { class: 'guide-list', 'data-nogloss': '' });
    this.el = h('div', { class: 'drawer panel guide', 'aria-label': 'Field guide' },
      h('div', { class: 'panel-head' }, h('h3', null, svg(LEARN_ICONS.book), 'Field guide'), h('button', { class: 'btn small', onclick: () => this.el.classList.remove('open') }, 'Close')),
      h('p', { class: 'muted', style: 'font-size:12.5px;margin:6px 0' }, 'Words from the game, in plain English. Terms are underlined the first time they appear, and the ones you have met are marked.'),
      this.list);
    document.body.appendChild(this.el);
  }

  open(): void {
    this.render();
    this.el.classList.add('open');
  }

  render(): void {
    const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
    this.list.replaceChildren(...sorted.map((t) => h('details', { class: `guide-term ${seen.has(t.id) ? 'met' : ''}` },
      h('summary', null, t.term, seen.has(t.id) ? h('span', { class: 'met-dot', title: 'You have met this word' }, '●') : null),
      h('p', null, t.def))));
  }
}
