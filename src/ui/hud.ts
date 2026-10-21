// Top HUD: year, budget, population, the three meters, CO2 / temperature chips and top-right buttons.
import type { GameState } from '../sim/types';
import { displayYear } from '../sim/game';
import { bump, fmt1, fmtInt, fmtMoney, h, svg, tweenNumber } from './dom';
import { DemandBars } from './demandbars';
import { UI_ICONS } from './icons';

export interface HudHandlers {
  graphs(): void;
  settings(): void;
  log(): void;
  voices(): void;
  species(): void;
}

export class Hud {
  el: HTMLElement;
  private year: HTMLElement;
  private yearSub: HTMLElement;
  private budget: HTMLElement;
  private budgetBox: HTMLElement;
  private pop: HTMLElement;
  private co2: HTMLElement;
  private temp: HTMLElement;
  private meters: Record<'environment' | 'society' | 'economy', { bar: HTMLElement; val: HTMLElement; delta: HTMLElement; root: HTMLElement }>;
  private last: GameState | null = null;
  readonly graphsBtn: HTMLButtonElement;
  readonly speciesBtn: HTMLButtonElement;
  readonly demand = new DemandBars();
  readonly voicesBtn: HTMLButtonElement;

  constructor(hd: HudHandlers) {
    this.year = h('span', null, '1850');
    this.yearSub = h('small', null, 'Act 1 · Boom');
    this.budget = h('span', null, '$0');
    this.pop = h('span', null, '0');
    this.co2 = h('span', null, '285');
    this.temp = h('span', null, '+0.0');
    const meter = (k: 'environment' | 'society' | 'economy', cls: string, label: string, icon: string): HTMLElement => {
      const bar = h('i', { style: 'width:50%' });
      const val = h('b', null, '50');
      const delta = h('span', { class: 'delta' });
      const root = h('div', { class: `meter ${cls}`, title: `${label} (0-100)` },
        h('div', { class: 'meter-top' }, svg(icon), h('span', { class: 'lbl' }, label), delta, val),
        h('div', { class: 'meter-bar', role: 'meter', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100 }, bar));
      this.meters = this.meters ?? ({} as Hud['meters']);
      this.meters[k] = { bar, val, delta, root };
      return root;
    };
    this.meters = {} as Hud['meters'];
    this.budgetBox = h('div', { class: 'hud-stat', title: 'Budget (thousands of dollars)' }, svg(UI_ICONS.coin), h('div', null, h('small', null, 'Budget'), this.budget));
    this.graphsBtn = h('button', { class: 'iconbtn', title: 'Graphs (G)', 'aria-label': 'Graphs', onclick: () => hd.graphs() }, svg(UI_ICONS.chart));
    this.voicesBtn = h('button', { class: 'iconbtn hidden', title: 'Town voices', 'aria-label': 'Town voices', onclick: () => hd.voices() }, svg(UI_ICONS.speech));
    this.speciesBtn = h('button', { class: 'iconbtn hidden', title: 'Wildlife', 'aria-label': 'Wildlife', onclick: () => hd.species() }, svg(UI_ICONS.paw));
    this.el = h('div', { class: 'hud' },
      h('div', { class: 'hud-left panel' },
        h('div', { class: 'hud-year' }, svg(UI_ICONS.calendar), h('div', null, this.yearSub, this.year)),
        this.budgetBox,
        h('div', { class: 'hud-stat', title: 'Population' }, svg(UI_ICONS.people), h('div', null, h('small', null, 'People'), this.pop))),
      h('div', { class: 'hud-center' },
        h('div', { class: 'hud-meters panel' },
          meter('environment', 'env', 'Environment', UI_ICONS.leaf),
          meter('society', 'soc', 'Society', UI_ICONS.heart),
          meter('economy', 'eco', 'Economy', UI_ICONS.gear)),
        this.demand.el),
      h('div', { class: 'hud-right' },
        h('div', { class: 'hud-climate panel' },
          h('div', { class: 'hud-stat', title: 'CO₂ in the air' }, svg(UI_ICONS.co2), h('div', null, h('small', null, 'CO₂ ppm'), this.co2)),
          h('div', { class: 'hud-stat', title: 'Warming since 1850-1900' }, svg(UI_ICONS.thermo), h('div', null, h('small', null, 'Warming'), this.temp))),
        this.voicesBtn,
        this.speciesBtn,
        h('button', { class: 'iconbtn', title: 'Event log', 'aria-label': 'Event log', onclick: () => hd.log() }, svg(UI_ICONS.log)),
        this.graphsBtn,
        h('button', { class: 'iconbtn', title: 'Settings', 'aria-label': 'Settings', onclick: () => hd.settings() }, svg(UI_ICONS.gear))));
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
      m.val.textContent = String(Math.round(v));
      m.root.querySelector('.meter-bar')?.setAttribute('aria-valuenow', String(Math.round(v)));
      if (p) {
        const d = Math.round(v - p.meters[k]);
        if (d !== 0) {
          m.delta.textContent = d > 0 ? `+${d}` : String(d);
          m.delta.className = `delta ${d > 0 ? 'up' : 'down'}`;
          bump(m.val);
          window.setTimeout(() => { m.delta.textContent = ''; }, 2500);
        }
      }
    }
    this.demand.update(s);
    this.last = s;
  }
}
