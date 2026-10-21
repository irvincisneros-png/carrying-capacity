// Persistent "what the town needs" bars (SimCity RCI style): Homes, Jobs, Power and, where a scenario has one, Water.
// The numbers come from the pure sim function demandBars(); this file only draws them.
import { demandBars } from '../sim/economy';
import type { DemandBar, DemandBarId } from '../sim/economy';
import type { GameState } from '../sim/types';
import { bIcon, UI_ICONS } from './icons';
import { h, svg } from './dom';

const ICON: Record<DemandBarId, string> = {
  homes: bIcon('cottage'),
  jobs: bIcon('factory'),
  power: UI_ICONS.bolt,
  water: UI_ICONS.rain,
};

interface Row {
  root: HTMLElement;
  fill: HTMLElement;
}

export class DemandBars {
  el: HTMLElement;
  /**
   * OPTIONAL SLOT (not wired yet): a later change can put a "N buildings have no road" warning with a Locate button here.
   * Call `setSlot(element)` with the warning, or `setSlot(null)` to clear it. The slot stays hidden while it is empty.
   * The sim side (`roadAccess(state)`) is being added separately; nothing in this file knows about roads.
   */
  readonly slot: HTMLElement;
  private rows = new Map<DemandBarId, Row>();
  private bars: HTMLElement;
  private tip: HTMLElement;
  private tipFor: DemandBarId | null = null;
  private latest: DemandBar[] = [];

  constructor() {
    this.bars = h('div', { class: 'dbars-row' });
    this.tip = h('div', { class: 'dbars-tip hidden', role: 'status' });
    this.slot = h('div', { class: 'dbars-slot hidden', 'data-slot': 'no-road' });
    this.el = h('div', { class: 'dbars panel hidden', 'aria-label': 'What the town needs' }, this.bars, this.slot, this.tip);
  }

  setSlot(content: HTMLElement | null): void {
    this.slot.replaceChildren(...(content ? [content] : []));
    this.slot.classList.toggle('hidden', !content);
  }

  private row(b: DemandBar): Row {
    let r = this.rows.get(b.id);
    if (r) return r;
    const fill = h('i');
    const root = h('button', { class: `dbar ${b.id}`, type: 'button', onclick: () => this.toggleTip(b.id) },
      svg(ICON[b.id]),
      h('span', { class: 'dlbl' }, b.label),
      h('span', { class: 'dtrack', role: 'meter', 'aria-valuemin': -100, 'aria-valuemax': 100 }, fill, h('u')));
    r = { root, fill };
    this.rows.set(b.id, r);
    this.bars.appendChild(root);
    return r;
  }

  private toggleTip(id: DemandBarId): void {
    this.tipFor = this.tipFor === id ? null : id;
    this.showTip();
  }

  private showTip(): void {
    const b = this.latest.find((x) => x.id === this.tipFor);
    this.tip.classList.toggle('hidden', !b);
    if (b) this.tip.textContent = b.tip;
    for (const [id, r] of this.rows) r.root.classList.toggle('sel', id === this.tipFor);
  }

  update(s: GameState): void {
    const live = s.phase === 'act1' || s.phase === 'act2';
    this.el.classList.toggle('hidden', !live);
    if (!live) return;
    const bars = demandBars(s);
    this.latest = bars;
    const present = new Set(bars.map((b) => b.id));
    for (const [id, r] of this.rows) r.root.classList.toggle('hidden', !present.has(id));
    for (const b of bars) {
      const r = this.row(b);
      // The fill grows from the middle: right (warm) = needs more, left (cool) = plenty / too many.
      const pct = Math.round(Math.abs(b.need) * 50);
      r.fill.style.width = `${pct}%`;
      r.fill.style.left = b.need >= 0 ? '50%' : `${50 - pct}%`;
      r.root.classList.toggle('short', b.level === 'short');
      r.root.classList.toggle('plenty', b.level === 'plenty');
      r.root.classList.toggle('urgent', b.urgent);
      r.root.classList.toggle('inactive', b.inactive);
      r.root.title = b.tip;
      r.root.setAttribute('aria-label', `${b.label}: ${b.tip}`);
      r.root.querySelector('.dtrack')?.setAttribute('aria-valuenow', String(Math.round(b.need * 100)));
    }
    if (this.tipFor && !present.has(this.tipFor)) this.tipFor = null;
    this.showTip();
  }
}
