// Modal stack, toasts, floaters and tooltip primitives.
import { h, svg } from './dom';
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
let toastBox: HTMLElement | null = null;
export function toast(title: string, text: string, kind: 'info' | 'good' | 'warn' | 'bad' = 'info', icon: string = UI_ICONS.info, ms = 6500): void {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts', 'aria-live': 'polite' });
    document.body.appendChild(toastBox);
  }
  const t = h('div', { class: `toast panel ${kind}` }, svg(icon), h('div', null, h('b', null, title), text ? h('p', null, text) : null));
  toastBox.prepend(t);
  while (toastBox.children.length > 4) toastBox.lastElementChild?.remove();
  const kill = (): void => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 350);
  };
  t.addEventListener('click', kill);
  setTimeout(kill, ms);
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
