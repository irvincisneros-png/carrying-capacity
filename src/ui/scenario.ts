// Scenario-specific UI: policy levers (sliders with plain-English consequences), live readouts for the scenario's
// own systems (river, sea level, tourism, aquifer, mine rehab, heat, canopy, transit), and the guided tutorial overlay.
import {
  getScenario, mechMetric, policiesFor, policyCostPerYear, policyValue, tutorialStatus,
  type BuildingId, type GameState, type PolicyDef, type TutorialStatus,
} from '../sim';
import { availability } from '../sim/rules';
import { clear, h, svg } from './dom';
import { UI_ICONS } from './icons';
import { sfx } from '../audio/sfx';

// ---------------------------------------------------------------- readouts
interface Readout { key: string; label: string; icon: string; fmt: (v: number) => string; good: (v: number) => 0 | 1 | 2; tip: string }

const READOUTS: Record<string, Readout> = {
  riverHealth: { key: 'riverHealth', label: 'River', icon: UI_ICONS.wave, fmt: (v) => `${Math.round(v)}`, good: (v) => (v >= 60 ? 2 : v >= 35 ? 1 : 0), tip: 'River health (0-100): flow, salt, fish and red gums' },
  farmViability: { key: 'farmViability', label: 'Farms', icon: UI_ICONS.sprout, fmt: (v) => `${Math.round(v)}`, good: (v) => (v >= 50 ? 2 : v >= 30 ? 1 : 0), tip: 'How well the farms are doing (0-100)' },
  envFlowPct: { key: 'envFlowPct', label: 'Env. flow', icon: UI_ICONS.fish, fmt: (v) => `${Math.round(v)}%`, good: (v) => (v >= 60 ? 2 : v >= 35 ? 1 : 0), tip: 'How much of the water the river needs it is actually getting' },
  seaLevelCm: { key: 'seaLevelCm', label: 'Sea level', icon: UI_ICONS.wave, fmt: (v) => `+${Math.round(v)} cm`, good: (v) => (v < 40 ? 2 : v < 70 ? 1 : 0), tip: 'Sea-level rise since pre-industrial times' },
  homesAtRisk: { key: 'homesAtRisk', label: 'Homes at risk', icon: UI_ICONS.warn, fmt: (v) => `${Math.round(v)}`, good: (v) => (v <= 0 ? 2 : 0), tip: 'Homes on ground low enough for a 1.3 m storm surge to flood. Inspect homes by the shore; rebuild them on raised ground' },
  tourism: { key: 'tourism', label: 'Tourism', icon: UI_ICONS.coral, fmt: (v) => `${Math.round(v)}`, good: (v) => (v >= 45 ? 2 : v >= 30 ? 1 : 0), tip: 'Tourism index: visitors come for the reef and the beaches' },
  aquifer: { key: 'aquifer', label: 'Aquifer', icon: UI_ICONS.wave, fmt: (v) => `${Math.round(v)}`, good: (v) => (v >= 40 ? 2 : v >= 20 ? 1 : 0), tip: 'Groundwater left in the aquifer (0-100), with its change per year. It refills by less than 1 a year, and open-cut mines drink the most' },
  rehabPct: { key: 'rehabPct', label: 'Mine rehab', icon: UI_ICONS.sprout, fmt: (v) => `${Math.round(v)}%`, good: (v) => (v >= 100 ? 2 : v >= 40 ? 1 : 0), tip: 'Share of the mine site reshaped, topsoiled, seeded and signed off' },
  heatDeaths: { key: 'heatDeaths', label: 'Heat deaths', icon: UI_ICONS.hot, fmt: (v) => `${Math.round(v)}`, good: (v) => (v <= 5 ? 2 : v <= 20 ? 1 : 0), tip: 'People who have died in heatwaves so far' },
  canopyPct: { key: 'canopyPct', label: 'Canopy', icon: UI_ICONS.leaf, fmt: (v) => `${Math.round(v)}%`, good: (v) => (v >= 25 ? 2 : v >= 15 ? 1 : 0), tip: 'Share of the city shaded by tree canopy' },
  transitPct: { key: 'transitPct', label: 'Transit', icon: UI_ICONS.bolt, fmt: (v) => `${Math.round(v)}%`, good: (v) => (v >= 50 ? 2 : v >= 25 ? 1 : 0), tip: 'Share of homes within reach of light rail or a bus lane' },
};

const BY_MECH: Record<string, string[]> = {
  river: ['riverHealth', 'envFlowPct', 'farmViability'],
  reef: ['seaLevelCm', 'homesAtRisk', 'tourism'],
  outback: ['aquifer', 'rehabPct'],
  heat: ['heatDeaths'],
  city: ['canopyPct', 'transitPct'],
};

/** Year-on-year change of each readout (UI memory only), so a slow slide is visible before it is too late. */
const TREND = new Map<string, { year: number; v: number; prevYear: number; prev: number }>();
/** Change per year between the starts of the last two years seen (null until two year-starts are known). */
export function readoutTrend(key: string): number | null {
  const t = TREND.get(key);
  if (!t || t.prevYear < 0 || t.year <= t.prevYear) return null;
  return (t.v - t.prev) / (t.year - t.prevYear);
}
function noteTrend(key: string, year: number, v: number): void {
  const t = TREND.get(key);
  // Keep the first value seen in each year: the difference between year-starts is the yearly change.
  if (!t || year < t.year) { TREND.set(key, { year, v, prevYear: -1, prev: v }); return; }
  if (year === t.year) return;
  TREND.set(key, { year, v, prevYear: t.year, prev: t.v });
}

export class Readouts {
  el = h('div', { class: 'readouts panel hidden' });
  private items: { r: Readout; val: HTMLElement; box: HTMLElement }[] = [];
  private scen = '';

  update(s: GameState): void {
    const sc = getScenario(s.scenarioId);
    if (sc.id !== this.scen) {
      this.scen = sc.id;
      TREND.clear();
      clear(this.el);
      this.items = [];
      const keys: string[] = [];
      for (const m of sc.mechanics ?? []) for (const k of BY_MECH[m] ?? []) if (!keys.includes(k)) keys.push(k);
      for (const k of keys) {
        const r = READOUTS[k];
        if (!r) continue;
        const val = h('b', null, '–');
        const box = h('div', { class: 'readout', title: r.tip }, svg(r.icon), h('div', null, h('small', null, r.label), val));
        this.el.appendChild(box);
        this.items.push({ r, val, box });
      }
    }
    this.el.classList.toggle('hidden', this.items.length === 0);
    for (const it of this.items) {
      let v: number | null = null;
      try { v = mechMetric(s, it.r.key); } catch { v = null; }
      let arrow = '';
      if (v !== null && s.phase === 'act2') {
        noteTrend(it.r.key, s.year, v);
        const d = readoutTrend(it.r.key);
        if (d !== null && Math.abs(d) >= 0.5) arrow = d > 0 ? ` ▲${Math.round(d)}` : ` ▼${Math.round(-d)}`;
      }
      it.val.textContent = v === null ? '–' : it.r.fmt(v) + arrow;
      const g = v === null ? 1 : it.r.good(v);
      it.box.className = `readout g${g}`;
    }
  }
}

// ---------------------------------------------------------------- policies
/** Plain-English consequence of a lever position. */
function consequence(p: PolicyDef, v: number): string {
  switch (p.id) {
    case 'alloc.town': return v >= 0.35 ? 'Taps stay on in most droughts, but there is less for farms and the river.' : v <= 0.1 ? 'Cheap for farms and the river, but the town may run dry in a drought.' : 'A middle path: the town is safe in normal years.';
    case 'alloc.env': return v >= 0.4 ? 'Fish, red gums and billabongs recover. Farms get less water.' : v <= 0.1 ? 'Farms get more water, but the river slowly dies: salt builds up and fish disappear.' : 'Enough to keep the river alive, not enough to bring it back fully.';
    case 'cots.cull': return v >= 2 ? 'Divers patrol the whole reef. Starfish outbreaks are stopped early. Costs the most.' : v >= 1 ? 'The main dive sites are protected; outbreaks elsewhere still eat coral.' : 'No control: a starfish outbreak can strip big areas of coral.';
    case 'turtle.lights': return v >= 2 ? 'Beachfront lights are amber and go dark on nesting nights: only something built on the sand itself still glows.' : v >= 1 ? 'Shielded amber lights: only buildings right beside the sand still light it.' : 'Ordinary lights: homes, resorts and anything using power within 2 tiles of the sand light the beach.';
    case 'water.restrict': return v >= 2 ? 'Big water savings, but people grow frustrated (Society falls).' : v >= 1 ? 'Sprinkler bans save water with a little grumbling.' : 'No restrictions: the aquifer drains fastest.';
    default: return p.blurb;
  }
}

export class PolicyPanel {
  el: HTMLElement;
  private body: HTMLElement;
  private sig = '';
  onChange: ((id: string, v: number) => void) | null = null;

  constructor() {
    this.body = h('div');
    this.el = h('div', { class: 'drawer panel', 'aria-label': 'Policies' },
      h('div', { class: 'panel-head' }, h('h3', null, svg(UI_ICONS.gear), 'Town policies'), h('button', { class: 'btn small', onclick: () => this.el.classList.remove('open') }, 'Close')),
      this.body);
    document.body.appendChild(this.el);
  }

  has(s: GameState): boolean {
    return policiesFor(s.scenarioId).length > 0;
  }

  open(s: GameState): void {
    this.sig = '';
    this.render(s);
    this.el.classList.add('open');
  }

  render(s: GameState): void {
    const pols = policiesFor(s.scenarioId);
    const sig = pols.map((p) => policyValue(s, p.id)).join(',');
    if (sig === this.sig) return;
    this.sig = sig;
    clear(this.body);
    this.body.appendChild(h('p', { style: 'font-size:13px' }, 'Rules the council sets. There is no perfect setting: each one helps someone and costs someone else.'));
    for (const p of pols) {
      const v = policyValue(s, p.id);
      const pct = (x: number): string => (p.unit && p.unit.startsWith('of') ? `${Math.round(x * 100)}%` : p.unit === 'level' ? ['Off', 'Level 1', 'Level 2', 'Level 3'][Math.round(x)] ?? String(x) : String(x));
      const out = h('b', null, pct(v));
      const cons = h('p', { class: 'muted', style: 'font-size:13px;margin:6px 0 0' }, consequence(p, v));
      const input = h('input', { type: 'range', min: p.min, max: p.max, step: p.step, value: v, 'aria-label': p.label, style: 'width:100%' }) as HTMLInputElement;
      input.addEventListener('input', () => {
        const nv = Number(input.value);
        out.textContent = pct(nv);
        cons.textContent = consequence(p, nv);
      });
      input.addEventListener('change', () => { sfx('click'); this.onChange?.(p.id, Number(input.value)); });
      const cost = p.costPerYear !== undefined ? h('div', { class: 'muted', style: 'font-size:12px' }, `Costs ${typeof p.costPerYear === 'number' ? `${p.costPerYear} per unit` : p.costPerYear.map((c, i) => `${pct(p.min + i * p.step)} $${c}k`).join(' · ')} a year`) : null;
      this.body.appendChild(h('div', { class: 'dil-opt', style: 'margin-top:10px' },
        h('h4', null, h('span', null, p.label), out), h('p', { style: 'margin:0 0 6px;font-size:13px' }, p.blurb), input, cons, cost));
    }
    const yearly = policyCostPerYear(s);
    if (yearly) this.body.appendChild(h('p', { style: 'font-weight:800' }, `Policies cost $${Math.round(yearly)}k a year.`));
  }
}

// ---------------------------------------------------------------- tutorial
export interface TutorialHooks {
  /** Resolve a highlight key to a DOM element to pulse (or null). */
  find(key: string): HTMLElement | null;
  /** Show / hide a ring on a map tile. */
  tile(x: number, y: number): void;
  clearTile(): void;
  onComplete(): void;
}

export class TutorialOverlay {
  el: HTMLElement;
  private title = h('h3');
  private text = h('p');
  private hint = h('p', { class: 'muted hidden', style: 'font-size:12px' });
  private blocker = h('p', { class: 'hidden', style: 'font-size:13px;font-weight:800;color:#b5651d' });
  blockedNext = false;
  private dots = h('div', { class: 'tut-dots' });
  private lastIdx = -2;
  private stepSince = 0;
  private pulsed: HTMLElement | null = null;
  private doneShown = false;
  private hidden = false;
  status: TutorialStatus | null = null;

  constructor(private hooks: TutorialHooks) {
    const toggle = h('button', { class: 'linkbtn', onclick: () => { this.hidden = !this.hidden; this.el.classList.toggle('mini', this.hidden); toggle.textContent = this.hidden ? 'show' : 'hide'; } }, 'hide');
    this.el = h('div', { class: 'tutorial panel hidden', role: 'status', 'aria-live': 'polite' },
      h('div', { class: 'panel-head' }, h('span', { class: 'kicker', style: 'margin:0' }, 'Guide'), toggle),
      this.title, this.text, this.blocker, this.hint, this.dots);
  }

  update(s: GameState, playing: boolean): void {
    let st: TutorialStatus;
    try { st = tutorialStatus(s); } catch { st = { active: false } as TutorialStatus; }
    this.status = st;
    if (!st.active || !playing) {
      this.el.classList.add('hidden');
      this.unpulse();
      this.hooks.clearTile();
      return;
    }
    this.el.classList.remove('hidden');
    if (st.completed) {
      this.unpulse();
      this.hooks.clearTile();
      this.title.textContent = 'Tutorial complete!';
      this.text.textContent = 'You have built a town, faced its consequences and helped the valley heal. Coal Coast is waiting.';
      if (!this.doneShown) {
        this.doneShown = true;
        this.hooks.onComplete();
      }
    } else if (st.index !== this.lastIdx) {
      if (this.lastIdx >= 0) sfx('good');
      this.lastIdx = st.index;
      this.stepSince = performance.now();
      const cur = st.current;
      this.title.textContent = cur ? `${st.index + 1}. ${cur.title}` : 'Keep going';
      this.text.textContent = cur ? cur.instruction.replace(/CO2/g, 'CO₂') : 'Keep playing - the next step opens soon.';
      this.hint.textContent = cur?.hint ? `Tip: ${cur.hint}` : '';
      this.hint.classList.add('hidden');
      clear(this.dots);
      st.steps.forEach((x) => this.dots.appendChild(h('i', { class: x.done ? 'done' : x.current ? 'cur' : '', title: x.title })));
    }
    if (!st.completed && performance.now() - this.stepSince > 40000 && this.hint.textContent) this.hint.classList.remove('hidden');
    // a first-timer can get stuck when the next building is too dear or not invented yet: say what to do
    const hl = st.highlight ?? '';
    let blocker = '';
    if (hl.startsWith('build:') && s.phase === 'act1') {
      const id = hl.slice(6) as BuildingId;
      try {
        const av = availability(s.scenarioId, id);
        if (s.year < av.unlock) blocker = `It unlocks in ${av.unlock}: press Next decade until then.`;
        else if (s.budget < av.cost) blocker = `You need $${av.cost}k and have $${Math.round(s.budget)}k: press Next decade to earn more.`;
      } catch { blocker = ''; }
    }
    if (hl.startsWith('build:') && s.phase === 'act2') {
      const id = hl.slice(6) as BuildingId;
      try {
        const av = availability(s.scenarioId, id);
        if (s.budget < av.cost) blocker = `You need $${av.cost}k and have $${Math.round(s.budget)}k: let time run (press play) to earn more.`;
      } catch { blocker = ''; }
    }
    let wait = '';
    if (st.current?.id === 'swap' && s.phase === 'act2') {
      // Retiring the coal before clean power covers the nights means blackouts: say so plainly.
      const g = s.a2?.lastGrid;
      const fossil = (b: { bySource: Partial<Record<string, number>> }): number => (b.bySource.coal ?? 0) + (b.bySource.gas ?? 0);
      if (g) {
        const cover = Math.min(...[g.day, g.night].map((b) => (b.demand > 0 ? (b.supply - fossil(b)) / b.demand : 1)));
        if (cover < 0.99) wait = `Not yet: clean power covers only ${Math.round(Math.max(0, cover) * 100)}% of demand ${(g.night.supply - fossil(g.night)) / Math.max(1e-6, g.night.demand) <= (g.day.supply - fossil(g.day)) / Math.max(1e-6, g.day.demand) ? 'at night' : 'by day'}. Add wind turbines or another battery first, or the lights go out.`;
        else wait = 'Clean power now covers day and night. Time to retire the coal.';
      }
    }
    if (wait && !blocker) blocker = wait;
    this.blocker.textContent = blocker;
    this.blocker.classList.toggle('hidden', !blocker);
    this.blockedNext = !!blocker && s.phase === 'act1';
    this.applyHighlight(st);
  }

  private unpulse(): void {
    this.pulsed?.classList.remove('tut-pulse');
    this.pulsed = null;
  }

  private applyHighlight(st: TutorialStatus): void {
    const key = st.highlight;
    if (!key) { this.unpulse(); this.hooks.clearTile(); return; }
    let target: HTMLElement | null = null;
    if (this.blockedNext) {
      this.hooks.clearTile();
      target = this.hooks.find('button:next-decade');
    } else if (key.startsWith('tile:')) {
      const m = /^tile:(\d+),(\d+)$/.exec(key);
      if (m) this.hooks.tile(Number(m[1]), Number(m[2]));
      // the original key may name the building to use (tile:@wetland): pulse its button too
      const orig = st.current?.highlight ?? '';
      if (orig.startsWith('tile:@')) target = this.hooks.find(`build:${orig.slice(6)}`);
    } else {
      this.hooks.clearTile();
      target = this.hooks.find(key);
    }
    if (target !== this.pulsed) {
      this.unpulse();
      if (target) {
        target.classList.add('tut-pulse');
        this.pulsed = target;
      }
    }
  }
}
