// Carrying capacity meter (WP8a): the HUD gauge (a row in the demand-bar block) and the click-open panel.
import { CAPACITY_WORDS, capProfile } from '../content/capacity';
import { capacityReport } from '../sim/capacity';
import type { CapId, CapLine, CapacityReport } from '../sim/capacity';
import type { GameState } from '../sim/types';
import { h, svg } from './dom';
import { bIcon, UI_ICONS } from './icons';
import { LEARN_ICONS } from './learnicons';
import { openModal } from './modal';

const ICON: Record<CapId, string> = {
  water: UI_ICONS.rain,
  food: bIcon('farm'),
  harvest: UI_ICONS.fish,
  energy: UI_ICONS.bolt,
  carbon: UI_ICONS.co2,
};

const SHORT: Record<CapId, string> = { water: 'Water', food: 'Food', harvest: 'Fish and timber', energy: 'Energy', carbon: 'CO₂ and waste' };

const pct = (r: number): number => Math.round(r * 100);
const STATUS_WORD = { ok: 'Within limits', tight: 'Close to the limit', over: 'Over the limit' } as const;

export function capTooltip(rep: CapacityReport): string {
  const bits = rep.lines.filter((l) => !l.external).map((l) => `${SHORT[l.id]} ${pct(l.ratio)}%`).join(' · ');
  const head = rep.over > 0
    ? `Overshoot: the town is using more than the land renews (${rep.lines.filter((l) => l.status === 'over' && !l.external).map((l) => SHORT[l.id]).join(', ')}). Stocks are running down.`
    : rep.status === 'tight' ? 'Close to the limit: the town uses almost as much as the land renews.' : 'Within the land\'s limits: the town uses less than the land renews.';
  return `${head} ${bits}. Click for details.`;
}

/** The gauge row: five pips (water, food, fish and timber, energy, CO₂ and waste) and a one-line reading. */
export class CapGauge {
  el: HTMLElement;
  private pips = new Map<CapId, HTMLElement>();
  private text: HTMLElement;
  private sig = '';

  constructor(onClick: () => void) {
    this.text = h('span', { class: 'cap-text' });
    const pipBox = h('span', { class: 'cap-pips' });
    for (const id of Object.keys(ICON) as CapId[]) {
      const p = h('i', { class: 'cap-pip ok', 'data-cap': id }, svg(ICON[id]));
      this.pips.set(id, p);
      pipBox.appendChild(p);
    }
    this.el = h('button', { class: 'capbar ok', type: 'button', 'data-qa': 'capbar', onclick: onClick, 'aria-label': 'Carrying capacity: what the town uses compared with what the land renews' },
      svg(LEARN_ICONS.scale), h('span', { class: 'cap-lbl' }, 'Land limits'), pipBox, this.text);
  }

  update(s: GameState): void {
    const live = s.phase === 'act1' || s.phase === 'act2';
    this.el.classList.toggle('hidden', !live);
    if (!live) return;
    const sig = `${s.version}|${s.year}|${s.a2?.season}`;
    if (sig === this.sig) return;
    this.sig = sig;
    const rep = capacityReport(s);
    for (const l of rep.lines) {
      const p = this.pips.get(l.id);
      if (!p) continue;
      p.className = `cap-pip ${l.external ? 'ext' : l.status}`;
      p.title = `${l.label}: using ${pct(l.ratio)}% of what the land renews`;
    }
    this.el.className = `capbar ${rep.status}`;
    this.el.title = capTooltip(rep);
    const over = rep.lines.filter((l) => l.status === 'over' && !l.external).sort((a, b) => b.ratio - a.ratio);
    this.text.textContent = over.length > 0
      ? `Overshoot: ${over.slice(0, 2).map((l) => SHORT[l.id]).join(', ')}${over.length > 2 ? ` +${over.length - 2}` : ''}`
      : rep.status === 'tight' ? 'Close to the limit' : 'Within limits';
  }
}

function lineRow(l: CapLine): HTMLElement {
  const ratio = l.ratio;
  // The bar runs to 150% of renewal; the line marks 100%.
  const w = Math.min(100, (ratio / 1.5) * 100);
  return h('div', { class: `cap-row ${l.external ? 'ext' : l.status}`, 'data-cap': l.id },
    svg(ICON[l.id]),
    h('div', { style: 'flex:1;min-width:0' },
      h('div', { class: 'cap-row-top' }, h('b', null, l.label), h('span', { class: 'cap-state' }, l.external ? 'From outside the map' : STATUS_WORD[l.status]), h('span', { class: 'cap-pct' }, `${pct(l.ratio)}%`)),
      h('div', { class: 'cap-track', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 150, 'aria-valuenow': pct(l.ratio), 'aria-label': `${l.label} use as a share of what the land renews` }, h('i', { style: `width:${w}%` }), h('u', { title: 'What the land renews' })),
      h('p', { class: 'cap-note' }, l.note),
      h('small', { class: 'muted' }, l.parts)));
}

export function openCapacityPanel(s: GameState): void {
  const rep = capacityReport(s);
  const stock = (label: string, v: number, text: string): HTMLElement =>
    h('div', { class: 'cap-stock' }, h('div', { class: 'cap-row-top' }, h('b', null, label), h('span', { class: 'cap-pct' }, `${Math.round(v)}%`)),
      h('div', { class: `cap-track stock ${v < 70 ? 'low' : v < 95 ? 'mid' : ''}` }, h('i', { style: `width:${v}%` })), h('small', { class: 'muted' }, text));
  const place = capProfile(s.scenarioId).note;
  const m = openModal([
    h('div', { class: 'kicker' }, 'Land limits'),
    h('h2', null, 'Is the town living within its land?'),
    h('div', { class: 'fact', style: 'display:block' },
      h('p', { style: 'margin:0 0 6px' }, h('b', null, 'Carrying capacity. '), CAPACITY_WORDS.carryingCapacity.replace(/^Carrying capacity is /, 'It is ')),
      h('p', { style: 'margin:0' }, h('b', null, 'Overshoot. '), CAPACITY_WORDS.overshoot.replace(/^Overshoot is /, 'It is '))),
    h('p', { class: 'muted', style: 'font-size:13px' }, CAPACITY_WORDS.howToRead),
    place ? h('p', { class: 'fact', style: 'display:block' }, place) : null,
    h('div', { class: 'cap-rows' }, ...rep.lines.map(lineRow)),
    h('h3', { style: 'margin-top:10px' }, 'What is running down'),
    h('div', { class: 'cap-stocks' },
      stock('Creek flow', rep.stocks.flow, CAPACITY_WORDS.stocks.flow),
      stock('Fish', rep.stocks.fish, CAPACITY_WORDS.stocks.fish),
      stock('Soil fertility', rep.stocks.soil, CAPACITY_WORDS.stocks.soil)),
    h('p', { class: 'muted', style: 'font-size:13px' }, CAPACITY_WORDS.recover),
    h('details', { class: 'cap-facts' }, h('summary', null, 'The bigger picture: the ecological footprint'),
      h('p', { style: 'margin:6px 0' }, CAPACITY_WORDS.footprint),
      ...CAPACITY_WORDS.facts.map((f) => h('p', { style: 'margin:4px 0;font-size:13px' }, f))),
    h('div', { class: 'modal-actions' }, h('button', { class: 'btn primary', onclick: () => m.close() }, 'Got it')),
  ], { wide: true });
}
