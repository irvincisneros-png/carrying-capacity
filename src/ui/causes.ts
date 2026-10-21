// "Why did that happen?" (WP8c): a small chain diagram, three to five boxes with arrows, from content/causes.ts, with the
// player's own causes (from sim/causes.ts) under the boxes where the sim knows them.
import { CAUSE_CHAINS } from '../content/causes';
import type { ChainKey } from '../content/causes';
import { chainKeyFor, ownCauses } from '../sim/causes';
import type { GameState, SimEvent } from '../sim/types';
import { degC, h, svg } from './dom';
import { LEARN_ICONS } from './learnicons';
import { openModal } from './modal';

export { chainKeyFor };

/** The chain diagram for an event kind, as an element (also used in the printable report). */
export function chainView(s: GameState, key: ChainKey, about?: string): HTMLElement {
  const chain = CAUSE_CHAINS[key];
  const own = ownCauses(s, key, about);
  const boxes: HTMLElement[] = [];
  chain.boxes.forEach((text, i) => {
    boxes.push(h('div', { class: `chain-box ${i === chain.boxes.length - 1 ? 'last' : i === 0 ? 'first' : ''}`, 'data-step': i + 1 },
      h('span', { class: 'chain-n' }, String(i + 1)), h('div', null, text),
      own[i] ? h('div', { class: 'chain-own', 'data-qa': 'chain-own' }, svg(LEARN_ICONS.house), h('span', null, degC(own[i] as string))) : null));
    if (i < chain.boxes.length - 1) boxes.push(h('div', { class: 'chain-arrow', 'aria-hidden': 'true' }, '→'));
  });
  return h('div', { class: 'chain', 'data-chain': key, role: 'list', 'aria-label': chain.title }, ...boxes);
}

export function openCauseChain(s: GameState, key: ChainKey, what?: string): void {
  const chain = CAUSE_CHAINS[key];
  const m = openModal([
    h('div', { class: 'kicker' }, 'Why did that happen?'),
    h('h2', null, chain.title),
    what ? h('p', { class: 'muted', style: 'font-size:13px;margin:2px 0 8px' }, degC(what)) : null,
    chainView(s, key, what),
    h('p', { class: 'chain-hint' }, svg(LEARN_ICONS.house), ' Boxes with this mark show where your own town comes in.'),
    h('div', { class: 'fact', style: 'display:block' }, h('b', null, 'What could help: '), chain.fix),
    chain.fact ? h('p', { class: 'muted', style: 'font-size:12.5px' }, chain.fact) : null,
    h('div', { class: 'modal-actions' }, h('button', { class: 'btn primary', onclick: () => m.close() }, 'Got it')),
  ], { wide: true });
}

/** A click handler for an event, or null when there is no chain for it. */
export function chainOpener(s: () => GameState, e: Pick<SimEvent, 'type' | 'text' | 'story'>): (() => void) | null {
  const key = chainKeyFor(e);
  return key ? () => openCauseChain(s(), key, e.text) : null;
}
