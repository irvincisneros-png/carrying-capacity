// Modal stack, toasts, floaters and tooltip primitives.
import { h, svg } from './dom';
import { glossify } from './glossary';
import { UI_ICONS } from './icons';
import { sfx } from '../audio/sfx';

let stack: { wrap: HTMLElement; onClose?: () => void; closable: boolean }[] = [];

export function modalOpen(): boolean {
  return stack.length > 0;
}

export interface ModalHandle {
  close(): void;
  el: HTMLElement;
}

export function openModal(content: (HTMLElement | null)[], opts: { wide?: boolean; closable?: boolean; onClose?: () => void; cls?: string } = {}): ModalHandle {
  const closable = opts.closable ?? true;
  const card = h('div', { class: `modal panel ${opts.wide ? 'wide' : ''} ${opts.cls ?? ''}`, role: 'dialog', 'aria-modal': 'true' });
  const wrap = h('div', { class: 'modal-wrap' }, card);
  const entry = { wrap, onClose: opts.onClose, closable };
  const close = (): void => {
    if (!wrap.isConnected) return;
    wrap.remove();
    stack = stack.filter((s) => s !== entry);
    entry.onClose?.();
  };
  if (closable) {
    const x = h('button', { class: 'x', 'aria-label': 'Close', onclick: () => { sfx('click'); close(); } }, svg(UI_ICONS.close));
    card.appendChild(x);
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
  }
  for (const c of content) if (c) card.appendChild(c);
  glossify(card);
  document.body.appendChild(wrap);
  stack.push(entry);
  sfx('open');
  // focus first button for keyboard users
  setTimeout(() => (card.querySelector('.modal-actions .btn, .btn.primary, button') as HTMLElement | null)?.focus(), 50);
  return { close, el: card };
}

export function closeTopModal(): boolean {
  const top = stack[stack.length - 1];
  if (!top || !top.closable) return false;
  top.wrap.remove();
  stack.pop();
  top.onClose?.();
  return true;
}

// ---------------------------------------------------------------- toasts
// Calm by design: at most two at once, bottom-left above the build toolbar (never over the clock or the cards), each one
// dismisses itself. Low-priority news (a resident's remark, a decade note) goes to Town voices / the Event log instead.
let toastBox: HTMLElement | null = null;
const MAX_TOASTS = 2;
/** Longest a toast stays: calm, not sticky (bad news keeps a little longer so it is read). */
const TOAST_MAX_MS = { info: 5500, good: 5000, warn: 6500, bad: 7500 } as const;
/** `onOpen` makes the toast clickable: it runs the handler (for example the cause chain) instead of just dismissing. */
export function toast(title: string, text: string, kind: 'info' | 'good' | 'warn' | 'bad' = 'info', icon: string = UI_ICONS.info, ms = 6500, onOpen?: () => void): void {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts', 'aria-live': 'polite' });
    document.body.appendChild(toastBox);
  }
  // The same message twice in a row only keeps the newer one.
  for (const old of Array.from(toastBox.children)) if (old.getAttribute('data-key') === `${title}|${text}`) old.remove();
  const t = h('div', { class: `toast panel ${kind}${onOpen ? ' why' : ''}`, 'data-key': `${title}|${text}`, ...(onOpen ? { role: 'button', tabindex: 0, 'data-why': '1' } : {}) }, svg(icon), h('div', null, h('b', null, title), text ? h('p', null, text) : null, onOpen ? h('small', { class: 'why-hint' }, 'Why did that happen? Click to see') : null));
  glossify(t);
  toastBox.append(t);
  while (toastBox.children.length > MAX_TOASTS) toastBox.firstElementChild?.remove();
  let gone = false;
  const kill = (): void => {
    if (gone) return;
    gone = true;
    t.classList.add('out');
    setTimeout(() => t.remove(), 350);
  };
  t.addEventListener('click', () => { kill(); onOpen?.(); });
  setTimeout(kill, Math.min(ms, TOAST_MAX_MS[kind]));
}

// ---------------------------------------------------------------- floaters
export function floater(x: number, y: number, text: string, kind: 'cost' | 'good' | 'bad' | '' = ''): void {
  const f = h('div', { class: `floater ${kind}`, style: `left:${x}px;top:${y}px` }, text);
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1400);
}

// ---------------------------------------------------------------- tooltip
export class Tip {
  el = h('div', { class: 'tip hidden', role: 'tooltip' });
  constructor() {
    document.body.appendChild(this.el);
  }
  show(x: number, y: number, html: string, kind: '' | 'bad' | 'ok' = ''): void {
    this.el.className = `tip ${kind}`;
    this.el.innerHTML = html;
    const w = this.el.offsetWidth;
    const cx = Math.max(w / 2 + 8, Math.min(window.innerWidth - w / 2 - 8, x));
    this.el.style.left = `${cx}px`;
    this.el.style.top = `${Math.max(this.el.offsetHeight + 20, y)}px`;
  }
  hide(): void {
    this.el.classList.add('hidden');
  }
}

/** Debug / tests: drop every open modal (without running close callbacks). */
export function closeAllModals(): void {
  for (const m of stack) m.wrap.remove();
  stack = [];
}
