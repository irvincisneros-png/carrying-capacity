// Top HUD: year, budget, people and a slim strip of the three meters. The rest of the old HUD is in the sidebar rail's drawers.
import type { GameState } from '../sim/types';
import { displayYear } from '../sim/game';
import { bump, fmt1, fmtInt, fmtMoney, h, svg, tweenNumber } from './dom';
import { CapGauge } from './capacity';
import { DemandBars } from './demandbars';
import { UI_ICONS } from './icons';

export interface HudHandlers {
  capacity(): void;
}

/**
 * The always-on top bar: year, budget and people (left) and a slim strip of the three meters (centre). Everything else that
 * used to sit up here (CO2 and warming, the demand bars, the panel buttons) now lives in the sidebar rail's drawers: the demand
 * block and the climate chips are built here (they need the game state) and re-hosted by the app.
 */
export class Hud {
  el: HTMLElement;
  private year: HTMLElement;
  private yearSub: HTMLElement;
  private budget: HTMLElement;
  private budgetBox: HTMLElement;
  private pop: HTMLElement;
  private co2: HTMLElement;
  private temp: HTMLElement;
  private meters: Record<'environment' | 'society' | 'economy', { bar: HTMLElement; val: HTMLElement; root: HTMLElement; label: string; peek: number }>;
  private last: GameState | null = null;
  readonly demand = new DemandBars();
  readonly cap: CapGauge;
  /** CO2 and warming chips: the app puts them at the top of the Graphs drawer. */
  readonly climate: HTMLElement;

  constructor(hd: HudHandlers) {
    this.year = h('span', null, '1850');
    this.yearSub = h('small', null, 'Act 1 · Boom');
    this.budget = h('span', null, '$0');
    this.pop = h('span', null, '0');
    this.co2 = h('span', null, '285');
    this.temp = h('span', null, '+0.0');
    this.meters = {} as Hud['meters'];
    const meter = (k: 'environment' | 'society' | 'economy', cls: string, label: string, icon: string): HTMLElement => {
      const bar = h('i', { style: 'width:50%' });
      const val = h('b', { class: 'mtip', 'aria-hidden': 'true' }, `${label} 50`);
      const root = h('div', { class: `meter ${cls}`, tabindex: 0, role: 'group' }, svg(icon),
        h('div', { class: 'meter-bar', role: 'meter', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100 }, bar), val);
      const m = { bar, val, root, label, peek: 0 };
      // Touch: tap a meter to read its number for a moment (mouse and keyboard use hover and focus).
      root.addEventListener('click', () => this.peek(m, 2600));
      this.meters[k] = m;
      return root;
    };
    this.budgetBox = h('div', { class: 'hud-stat', title: 'Budget (thousands of dollars)' }, svg(UI_ICONS.coin), h('div', null, h('small', null, 'Budget'), this.budget));
    this.cap = new CapGauge(() => hd.capacity());
    this.demand.el.insertBefore(this.cap.el, this.demand.slot);
    this.climate = h('div', { class: 'hud-climate' },
      h('div', { class: 'hud-stat', title: 'CO₂ in the air' }, svg(UI_ICONS.co2), h('div', null, h('small', null, 'CO₂ ppm'), this.co2)),
      h('div', { class: 'hud-stat', title: 'Warming since 1850-1900' }, svg(UI_ICONS.thermo), h('div', null, h('small', null, 'Warming'), this.temp)));
    this.el = h('div', { class: 'hud' },
      h('div', { class: 'hud-left panel' },
        h('div', { class: 'hud-year' }, svg(UI_ICONS.calendar), h('div', null, this.yearSub, this.year)),
        this.budgetBox,
        h('div', { class: 'hud-stat', title: 'Population' }, svg(UI_ICONS.people), h('div', null, h('small', null, 'People'), this.pop))),
      h('div', { class: 'hud-center' },
        h('div', { class: 'hud-meters panel', 'aria-label': 'Environment, Society and Economy' },
          meter('environment', 'env', 'Environment', UI_ICONS.leaf),
          meter('society', 'soc', 'Society', UI_ICONS.heart),
          meter('economy', 'eco', 'Economy', UI_ICONS.gear))));
  }

  /** Show a meter's number under it for `ms` (it is otherwise only shown on hover or focus). */
  private peek(m: { root: HTMLElement; peek: number }, ms: number): void {
    m.root.classList.add('peek');
    window.clearTimeout(m.peek);
    m.peek = window.setTimeout(() => m.root.classList.remove('peek'), ms);
  }

  update(s: GameState): void {
    const p = this.last;
    if (p && p.version === s.version && p.year === s.year && displayYear(p) === displayYear(s) && p.a2?.season === s.a2?.season) return;
    const act = s.phase === 'act1' ? 'Act 1 · Boom' : s.phase === 'turning-point' ? 'Turning point' : s.phase === 'act2' ? `Act 2 · ${['Summer', 'Autumn', 'Winter', 'Spring'][s.a2.season] ?? ''}` : s.phase === 'epilogue' ? 'Epilogue' : 'The end';
    this.yearSub.textContent = act;
    if (!p || displayYear(p) !== displayYear(s)) {
      this.year.textContent = String(displayYear(s));
      if (p) bump(this.year);
    }
    if (!p || Math.round(p.budget) !== Math.round(s.budget)) {
      if (p) {
        tweenNumber(this.budget, p.budget, s.budget, fmtMoney, 500);
        bump(this.budget);
      } else this.budget.textContent = fmtMoney(s.budget);
      this.budgetBox.classList.toggle('neg', s.budget < 0);
    }
    if (!p || p.lastIncome !== s.lastIncome || p.flags['fund.left'] !== s.flags['fund.left']) {
      const left = typeof s.flags['fund.left'] === 'number' ? s.flags['fund.left'] : 0;
      const drip = typeof s.flags['fund.drip'] === 'number' ? s.flags['fund.drip'] : 0;
      const per = s.phase === 'act1' ? 'a decade' : 'a year';
      this.budgetBox.title = `Budget (thousands of dollars). Income last ${s.phase === 'act1' ? 'decade' : 'year'}: ${fmtMoney(s.lastIncome)}`
        + (left > 0 ? `. Transition Fund: ${fmtMoney(left)} left, paying ${fmtMoney(Math.min(left, drip))} ${per}.` : '.');
    }
    if (!p || p.population !== s.population) {
      if (p) tweenNumber(this.pop, p.population, s.population, fmtInt, 700);
      else this.pop.textContent = fmtInt(s.population);
    }
    this.co2.textContent = s.co2.toFixed(0);
    this.temp.textContent = `${s.tempC >= 0 ? '+' : ''}${fmt1(s.tempC)}°`;
    for (const k of ['environment', 'society', 'economy'] as const) {
      const m = this.meters[k];
      const v = Math.max(0, Math.min(100, s.meters[k]));
      m.bar.style.width = `${v}%`;
      const d = p ? Math.round(v - p.meters[k]) : 0;
      m.val.textContent = `${m.label} ${Math.round(v)}${d !== 0 ? ` (${d > 0 ? '+' : ''}${d})` : ''}`;
      m.root.querySelector('.meter-bar')?.setAttribute('aria-valuenow', String(Math.round(v)));
      m.root.setAttribute('aria-label', `${m.label} ${Math.round(v)} out of 100`);
      m.root.classList.toggle('low', v < 30);
      // A meter that moved by 2 or more shows its new number for a moment.
      if (Math.abs(d) >= 2) this.peek(m, 2400);
    }
    this.demand.update(s);
    this.cap.update(s);
    this.last = s;
  }
}
