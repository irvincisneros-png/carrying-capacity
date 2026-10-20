// Act 2 widgets: real-time clock + season dial + speed buttons, weather vs 30-year climate, hazard chips,
// energy (supply vs demand, day / night, blackouts) and objectives.
import type { Speed } from '../game/controller';
import { EVENT_NAMES } from '../content/act2';
import { eventChances } from '../sim/events';
import { objectiveStatus } from '../sim/objectives';
import { netZeroOutlook, type NetZeroOutlook } from '../sim/outlook';
import { mechMetric } from '../sim/mechanics';
import { readoutTrend } from './scenario';
import { hash32, seasonWeather } from '../sim/season';
import { getScenario } from '../sim/scenarios';
import { BONUS_SPECIES, SPECIES_BY_ID } from '../content/species';
import type { EnergySource, EventType, GameState, GridBlock, ObjectiveResult } from '../sim/types';
import { clear, degC, fmt1, h, svg } from './dom';
import { UI_ICONS } from './icons';

const SEASONS = ['Summer', 'Autumn', 'Winter', 'Spring'];

// ---------------------------------------------------------------- clock
export class Clock {
  el: HTMLElement;
  private dial: HTMLElement;
  private label: HTMLElement;
  private yearL: HTMLElement;
  private speedBtns: HTMLButtonElement[] = [];
  private wIcon: HTMLElement;
  private wText: HTMLElement;
  private spark: HTMLCanvasElement;
  readonly hazards: HTMLElement;
  private lastSeason = -1;
  private lastHaz = '';

  constructor(onSpeed: (s: Speed) => void) {
    this.dial = h('i');
    this.label = h('span', null, 'Summer');
    this.yearL = h('small', null, '2025');
    const sp = (s: Speed, icon: string, label: string): HTMLButtonElement => {
      const b = h('button', { 'aria-label': label, title: `${label}${s === 0 ? ' (Space)' : ''}`, onclick: () => onSpeed(s) }, svg(icon), s > 1 ? `${s}` : '');
      this.speedBtns.push(b);
      return b;
    };
    this.wIcon = h('span', { class: 'ic' });
    this.wText = h('small', null, 'Weather');
    this.spark = h('canvas', { width: 184, height: 68, title: 'Each dot is one year\'s weather; the line is the 30-year climate average' });
    this.hazards = h('div', { class: 'hazards' });
    this.el = h('div', { class: 'clock panel hidden' },
      h('div', { class: 'season' }, h('div', { class: 'season-dial', 'aria-hidden': 'true' }, this.dial), h('div', null, this.yearL, this.label)),
      h('div', { class: 'speeds' }, sp(0, UI_ICONS.pause, 'Pause'), sp(1, UI_ICONS.play, 'Play 1x'), sp(2, UI_ICONS.fast, 'Fast 2x'), sp(4, UI_ICONS.faster, 'Fastest 4x')),
      h('div', { class: 'weather' }, this.wIcon, h('div', null, this.wText, this.spark)),
      this.hazards);
  }

  setSpeed(s: Speed): void {
    const map: Speed[] = [0, 1, 2, 4];
    this.speedBtns.forEach((b, i) => b.classList.toggle('on', map[i] === s));
  }

  update(s: GameState, frac: number): void {
    const season = s.a2.season;
    const t = (season + frac) / 4;
    this.dial.style.transform = `rotate(${t * 360 + 180}deg)`;
    if (season === this.lastSeason) return;
    this.lastSeason = season;
    this.label.textContent = SEASONS[season] ?? '';
    this.yearL.textContent = String(s.year);
    // weather icon for this season
    const sc = getScenario(s.scenarioId);
    const idx = (s.year - sc.startYear) * 4 + season;
    const w = seasonWeather(s.seed, idx);
    const active = new Set(s.a2.active.map((a) => a.type));
    let icon: string = UI_ICONS.sun;
    let txt = 'Fine';
    if (active.has('heatwave')) { icon = UI_ICONS.hot; txt = 'Heatwave'; }
    else if (active.has('drought')) { icon = UI_ICONS.dry; txt = 'Drought'; }
    else if (w.rain > 1.15) { icon = UI_ICONS.rain; txt = 'Wet'; }
    else if (w.wind > 1.25) { icon = UI_ICONS.storm; txt = 'Windy'; }
    else if (w.cloud > 0.95) { icon = UI_ICONS.cloud; txt = 'Cloudy'; }
    else if (w.cloud > 0.88) { icon = UI_ICONS.partsun; txt = 'Mild'; }
    this.wIcon.innerHTML = icon;
    this.wText.textContent = `${txt} · weather vs climate`;
    this.drawSpark(s);
    // hazards
    const ch = eventChances(s).filter((e) => e.type !== 'blackout' && e.type !== 'fish-kill' ? e.p > 0.02 : e.p > 0.05);
    const sig = ch.map((c) => `${c.type}${Math.round(c.p * 20)}`).join();
    if (sig !== this.lastHaz) {
      this.lastHaz = sig;
      clear(this.hazards);
      for (const c of ch.sort((a, b) => b.p - a.p).slice(0, 3)) {
        const lvl = c.p > 0.25 ? 3 : c.p > 0.1 ? 2 : 1;
        this.hazards.appendChild(h('span', { class: `hz l${lvl}`, title: `${EVENT_NAMES[c.type]}: ${Math.round(c.p * 100)}% chance this season` }, svg(hazIcon(c.type)), `${Math.round(c.p * 100)}%`));
      }
    }
  }

  private drawSpark(s: GameState): void {
    const c = this.spark;
    const g = c.getContext('2d');
    if (!g) return;
    const W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    // years of temperature: Act 1 decades interpolated + Act 2 yearly
    const pts: { y: number; t: number }[] = [];
    for (const r of s.a2.yearly) pts.push({ y: r.year, t: r.tempC });
    const hist = s.history;
    if (pts.length < 30) {
      for (let y = s.year - 40; y < (pts[0]?.y ?? s.year); y++) {
        let t = s.tempC;
        for (let i = 0; i < hist.length - 1; i++) {
          const a = hist[i]!, b = hist[i + 1]!;
          if (y >= a.year && y <= b.year) t = a.tempC + ((b.tempC - a.tempC) * (y - a.year)) / (b.year - a.year);
        }
        pts.unshift({ y, t });
      }
      pts.sort((a, b) => a.y - b.y);
    }
    const recent = pts.slice(-40);
    const wx = recent.map((p) => ({ y: p.y, t: p.t + ((hash32(s.seed, p.y) % 1000) / 1000 - 0.5) * 0.7 }));
    let lo = Infinity, hi = -Infinity;
    for (const p of wx) { lo = Math.min(lo, p.t); hi = Math.max(hi, p.t); }
    lo -= 0.1; hi += 0.1;
    const X = (i: number): number => 4 + (i / Math.max(1, wx.length - 1)) * (W - 8);
    const Y = (t: number): number => H - 6 - ((t - lo) / (hi - lo)) * (H - 12);
    g.fillStyle = 'rgba(61,111,176,0.55)';
    wx.forEach((p, i) => { g.beginPath(); g.arc(X(i), Y(p.t), 2.4, 0, Math.PI * 2); g.fill(); });
    g.strokeStyle = '#c0583a';
    g.lineWidth = 3;
    g.beginPath();
    wx.forEach((_, i) => {
      const a = wx.slice(Math.max(0, i - 29), i + 1);
      const m = a.reduce((n, q) => n + q.t, 0) / a.length;
      if (i) g.lineTo(X(i), Y(m)); else g.moveTo(X(i), Y(m));
    });
    g.stroke();
  }
}

export function hazIcon(t: EventType | 'story' | string): string {
  switch (t) {
    case 'heatwave': return UI_ICONS.hot;
    case 'bushfire': return UI_ICONS.fire;
    case 'drought': return UI_ICONS.dry;
    case 'flood': return UI_ICONS.wave;
    case 'marine-heatwave': return UI_ICONS.coral;
    case 'fish-kill': return UI_ICONS.fish;
    case 'blackout': return UI_ICONS.bolt;
    case 'story': return UI_ICONS.speech;
    default: return UI_ICONS.info;
  }
}

// ---------------------------------------------------------------- energy
const SRC_COL: Record<EnergySource, string> = {
  coal: '#4a4442', gas: '#9a8a7a', 'rooftop-solar': '#f2c230', 'solar-farm': '#e0a52a', wind: '#5fb8c8', 'offshore-wind': '#2f8f9d',
  hydro: '#3d6fb0', 'pumped-hydro': '#5a7ac0', battery: '#5f9a4e', tidal: '#7a5aa8',
};
const SRC_NAME: Record<EnergySource, string> = {
  coal: 'Coal', gas: 'Gas', 'rooftop-solar': 'Rooftop solar', 'solar-farm': 'Solar farm', wind: 'Wind', 'offshore-wind': 'Offshore wind',
  hydro: 'Hydro', 'pumped-hydro': 'Pumped hydro', battery: 'Battery', tidal: 'Tidal',
};
const ORDER: EnergySource[] = ['coal', 'gas', 'hydro', 'wind', 'offshore-wind', 'tidal', 'solar-farm', 'rooftop-solar', 'pumped-hydro', 'battery'];

export class EnergyPanel {
  el: HTMLElement;
  private body: HTMLElement;
  private lastIdx = -1;

  constructor() {
    this.body = h('div');
    this.el = h('div', { class: 'side energy panel hidden' }, h('div', { class: 'panel-head' }, h('h3', null, svg(UI_ICONS.bolt), 'Power grid'), h('button', { class: 'linkbtn', onclick: (e: Event) => collapse(this.el, e) }, 'hide')), this.body);
  }

  update(s: GameState): void {
    const gr = s.a2.lastGrid;
    if (!gr) {
      this.body.innerHTML = '<p class="muted" style="font-size:13px;margin:6px 0">The grid report appears after the first season.</p>';
      return;
    }
    if (gr.seasonIndex === this.lastIdx) return;
    this.lastIdx = gr.seasonIndex;
    clear(this.body);
    const max = Math.max(gr.day.demand, gr.night.demand, gr.day.supply + gr.day.unmet, gr.night.supply, 1) * 1.08;
    const row = (label: string, icon: string, b: GridBlock): HTMLElement => {
      const bar = h('div', { class: 'en-bar', title: `${label}: supply ${fmt1(b.supply)} vs demand ${fmt1(b.demand)}` });
      for (const src of ORDER) {
        const v = b.bySource[src] ?? 0;
        if (v <= 0.01) continue;
        bar.appendChild(h('i', { style: `width:${(v / max) * 100}%;background:${SRC_COL[src]}`, title: `${SRC_NAME[src]} ${fmt1(v)}` }));
      }
      if (b.unmet > 0.01) bar.appendChild(h('i', { style: `width:${(b.unmet / max) * 100}%;background:repeating-linear-gradient(45deg,#c0483a 0 4px,#f2c4b6 4px 8px)`, title: `Unmet ${fmt1(b.unmet)}` }));
      bar.appendChild(h('span', { class: 'dem', style: `left:${(b.demand / max) * 100}%`, title: 'Demand' }));
      return h('div', { class: 'en-row' }, h('span', { class: 'lbl' }, svg(icon), label), bar);
    };
    this.body.appendChild(row('Day', UI_ICONS.sun, gr.day));
    this.body.appendChild(row('Night', UI_ICONS.moon, gr.night));
    const used = ORDER.filter((k) => (gr.generation[k] ?? 0) > 0.01 || (gr.capacity[k] ?? 0) > 0);
    this.body.appendChild(h('div', { class: 'legend', style: 'margin-top:8px' }, ...used.map((k) => h('span', null, h('i', { style: `background:${SRC_COL[k]}` }), SRC_NAME[k])),
      h('span', null, h('i', { style: 'background:#2d241e;width:3px' }), 'Demand')));
    this.body.appendChild(h('div', { class: 'en-foot' },
      h('span', null, `${Math.round(gr.renewableShare * 100)}% renewable`),
      gr.blackout ? h('span', { class: 'blackout' }, `Blackout ${Math.round(gr.unmetFrac * 100)}%`) : h('span', null, `Storage ${fmt1(gr.storageLevel)}`)));
  }
}

// ---------------------------------------------------------------- objectives
export class ObjectivesPanel {
  el: HTMLElement;
  private list: HTMLElement;
  private sig = '';
  private titleEl = h('span', null, 'Goals for 2100');

  constructor() {
    this.list = h('div');
    this.el = h('div', { class: 'side objectives panel hidden' }, h('div', { class: 'panel-head' }, h('h3', null, svg(UI_ICONS.target), this.titleEl), h('button', { class: 'linkbtn', onclick: (e: Event) => collapse(this.el, e) }, 'hide')), this.list);
  }

  update(s: GameState): void {
    let objs: ObjectiveResult[];
    try {
      objs = objectiveStatus(s);
    } catch {
      objs = [];
    }
    const end = getScenario(s.scenarioId).act2.endYear;
    let risk = 0;
    try { risk = mechMetric(s, 'homesAtRisk') ?? 0; } catch { risk = 0; }
    // The net-zero outlook moves with every build, so it is part of the signature (cached per state version / season).
    const nzKey = `${s.version}|${s.year}|${s.a2?.season}`;
    if (nzKey !== this.nzKey) {
      this.nzKey = nzKey;
      try { this.nz = s.phase === 'act2' ? netZeroOutlook(s) : null; } catch { this.nz = null; }
    }
    const nz = this.nz;
    const nzSig = nz ? `${Math.round(nz.nowKt)}|${nz.projected}|${nz.pace}|${nz.rows.map((r) => `${r.key}${Math.round(r.kt)}${r.waitsFor ? 'w' : ''}`).join()}|${nz.order.map((o) => (o.done ? 1 : 0)).join('')}` : '';
    const sig = `${end}|${s.year}|${risk}|${s.phase}|${s.circular?.unlocked}|${nzSig}|` + objs.map((o) => `${o.id}:${o.status}:${o.current === null ? 'n' : Math.round(o.current * 10)}`).join('|');
    if (sig === this.sig) return;
    this.titleEl.textContent = `Goals for ${end}`;
    this.sig = sig;
    clear(this.list);
    for (const o of objs) {
      const showNz = o.metric === 'netZeroYear' && nz !== null && o.status !== 'met' && o.status !== 'missed';
      this.list.appendChild(objectiveRow(o, s, showNz));
      if (showNz && nz) this.list.appendChild(outlookView(nz, s));
    }
  }

  private nzKey = '';
  private nz: NetZeroOutlook | null = null;
}

/** "Your emissions by source": the readout that teaches the order of operations for a net-zero goal. */
export function outlookView(nz: NetZeroOutlook, s: GameState): HTMLElement {
  const kt = (v: number): string => `${v >= 10 ? Math.round(v) : fmt1(v)} kt`;
  const max = Math.max(nz.line, ...nz.rows.map((r) => r.kt), 1);
  const ok = nz.projected !== null && nz.projected <= nz.byYear;
  const head = nz.atLine
    ? h('div', { class: 'nz-head ok' }, svg(UI_ICONS.check), h('span', null, `At the line now (${kt(nz.nowKt)} a year). Hold it every year, and spread one-off demolition work out.`))
    : nz.projected !== null
      ? h('div', { class: `nz-head ${ok ? 'ok' : 'late'}` }, svg(ok ? UI_ICONS.check : UI_ICONS.warn),
        h('span', null, 'On current plan: net zero about ', h('b', null, String(nz.projected)), ok ? ` (target ${nz.byYear})` : `, ${nz.projected - nz.byYear} years late (target ${nz.byYear})`))
      : h('div', { class: 'nz-head late' }, svg(UI_ICONS.warn), h('span', null,
        s.a2.yearly.length < 2 ? `To reach the line by ${nz.byYear}, cut about ${kt(nz.need)} a year, every year, from now.` : `Emissions are not falling yet: cut about ${kt(nz.need)} a year to make ${nz.byYear}.`));
  const sub = h('div', { class: 'nz-sub' }, `This year at today's buildings: ${kt(nz.nowKt)} · line ${kt(nz.line)}`,
    nz.pace !== null && !nz.atLine ? ` · cutting ${kt(Math.max(0, nz.pace))} a year (need ${kt(nz.need)})` : '');
  // The four biggest sources get a bar; the small ones fold into one line.
  const shown = nz.rows.filter((r) => r.kt >= 0.5);
  const top = shown.slice(0, 4);
  const rest = shown.slice(4);
  const restKt = rest.reduce((a, r) => a + r.kt, 0);
  const bars = h('div', { class: 'nz-bars' }, ...top.map((r) => {
    const isLever = nz.lever?.key === r.key;
    return h('div', { class: `nz-row${isLever ? ' lever' : ''}${r.waitsFor ? ' waits' : ''}`, title: `${r.label}: ${r.lever}${r.waitsFor ? ` (${r.waitsFor})` : ''}` },
      h('span', { class: 'nz-lbl' }, r.short),
      h('span', { class: 'nz-bar' }, h('i', { style: `width:${(r.kt / max) * 100}%` }), h('em', { style: `left:${(nz.line / max) * 100}%`, title: 'The net-zero line is for the whole town' })),
      h('span', { class: 'nz-kt' }, kt(r.kt)));
  }));
  if (rest.length) bars.appendChild(h('div', { class: 'nz-sub', style: 'margin-top:0' }, `+ ${rest.length} smaller source${rest.length > 1 ? 's' : ''}: ${kt(restKt)}`));
  // The lever's how-to and the suggested order fold away (closed by default) so the panel leaves the map visible;
  // the panel is rebuilt as numbers change, so remember what the player opened.
  const fold = (key: string, summary: HTMLElement | string, body: HTMLElement, cls: string): HTMLElement => {
    const d = h('details', { class: `nz-fold ${cls}` }, h('summary', null, summary), body) as HTMLDetailsElement;
    d.open = FOLD_OPEN.has(key);
    d.addEventListener('toggle', () => { if (d.open) FOLD_OPEN.add(key); else FOLD_OPEN.delete(key); });
    return d;
  };
  const lever = nz.lever && !nz.atLine
    ? fold('lever', h('span', null, h('b', null, 'Biggest lever now: '), nz.lever.short), h('div', null, nz.lever.lever), 'nz-lever')
    : null;
  const waiting = nz.rows.find((r) => r.waitsFor && r.kt >= 5);
  const done = nz.order.filter((o) => o.done).length;
  const order = nz.atLine ? null : fold('order', `Suggested order (${done} of ${nz.order.length} done)`,
    h('ol', { class: 'nz-order' }, ...nz.order.map((o) => h('li', { class: o.done ? 'done' : '' }, o.done ? '✓ ' : '', o.text))), 'nz-orderfold');
  return h('div', { class: 'nz', 'data-qa': 'nz-outlook' },
    h('div', { class: 'nz-title' }, 'Your emissions by source'),
    head, sub, bars, lever,
    waiting && !nz.atLine ? h('div', { class: 'nz-sub' }, `${waiting.short}: ${waiting.waitsFor}. Save up for it.`) : null,
    order);
}

/** Which folded sections of the Goals panel the player has opened (kept across re-renders). */
const FOLD_OPEN = new Set<string>();

/** One line on how to move each goal, shown under a goal that is not yet on track. */
const HOW_TO: Partial<Record<string, string>> = {
  renewableShare: 'Build solar, wind and batteries, then retire the coal and gas plants with the Old sites tool.',
  environment: 'Plant nurseries and wetlands, clean dirty soil (phyto gardens), and retire polluting sites.',
  society: 'People need homes, jobs, clean air and reliable power. Blackouts and disasters hurt most.',
  speciesBack: 'Give animals habitat and time: wetlands, clean water and joined-up bush.',
  act1Repurposed: 'Use the Old sites tool on each old Act 1 building: repurpose or recycle, not landfill.',
  warming: 'Cut emissions early: clean power first, then industry and transport. Warming lags behind CO₂.',
  estuaryHealth: 'Treat sewage, add stormwater wetlands, and keep farms and industry away from the water.',
  riverHealth: 'Leave more water in the river (Town policies), switch on the drought plan before the dry years, build wetlands and a fishway, and treat runoff.',
  townWaterFailures: 'Store water before droughts (town water storage) and set water sharing in Town policies.',
  farmViability: 'Farms need water: efficient irrigation farms use less, the water policy decides their share, and the drought plan (Town policies) banks wet-year water to carry them through droughts.',
  reefHealth: 'Cut runoff and sewage, grow coral nurseries, use the starfish cull lever, and cut emissions.',
  homesLost: 'Watch "Homes at risk" (top right): inspect homes by the shore and rebuild them on raised ground before a big cyclone. Mangroves soften surges.',
  tourism: 'Visitors come for a healthy reef and beaches. Resorts earn more when the reef is well.',
  netZeroYear: 'Emissions must fall to the net-zero line and stay there: clean power first, then close or clean up the biggest emitters (mines, factories, cars). The Graphs (G) show where emissions come from.',
  rehabPct: 'Close the mine, then use Rehab mine on the pit: reshape, topsoil, then seed the pit. Seeded ground grows from a native plant nursery right beside it (its crews also pull weeds); each patch is signed off after 5 years of good growth.',
  aquifer: 'Open-cut mines drink the most groundwater: close them as early as you can. Water restrictions (Town policies) trim town use, and a town water storage catches the wet.',
  waterFailures: 'Keep the town supplied in dry years: bores, storage and water policies.',
  heatDeaths: 'Cooling centres, street trees, retrofitted homes and a reliable grid protect people in heatwaves.',
  'net-zero-city:netZeroYear': 'Clean power first (rooftop solar, batteries, then offshore wind from 2040), then the rest: retrofit every brick suburb, turn the factories into recycling plants (Old sites) and move people onto transit. The Graphs (G) show which sector is left.',
  'red-dirt:netZeroYear': 'Clean power first (the sun is strong here: solar farms and batteries), then close the open-cut mines and retire the coal plant. The Graphs (G) show which sector is left.',
  societyMin: 'Keep Society up every single year: avoid blackouts, protect people in heatwaves, keep jobs.',
  capitalSpent: 'Choose the best value first: each build card shows "$ per kt" (lower is better). Light rail and retrofits cut the most per dollar; batteries only help once there is spare daytime solar. Avoid building twice.',
};

const PENDING_TEXT: Record<string, string> = {
  circular: 'Opens with the circular economy (the Old sites tool)',
  wildlife: 'Counted once animals start coming back',
};

export function objectiveRow(o: ObjectiveResult, s?: GameState, noHow = false): HTMLElement {
  const icon = o.status === 'met' || o.status === 'on-track' ? UI_ICONS.check : o.status === 'missed' ? UI_ICONS.cross : o.status === 'at-risk' ? UI_ICONS.warn : UI_ICONS.clock;
  let pct = 0;
  if (o.current !== null) {
    if (o.op === '>=') pct = Math.max(0, Math.min(1, o.current / Math.max(1e-6, o.target)));
    else pct = o.current <= o.target ? 1 : Math.max(0, 1 - (o.current - o.target) / Math.max(0.5, o.target));
  }
  const unit = o.metric === 'warming' ? ' °C' : '';
  const val = o.metric === 'netZeroYear' && o.current !== null && o.current >= 9000 ? `Not reached yet · target by ${o.target}` : o.current === null ? (o.pendingTier ? PENDING_TEXT[o.pendingTier] ?? 'Opens later in the game' : 'Not measured yet') : `Now ${o.metric === 'warming' ? fmt1(o.current) : Math.round(o.current)}${unit} · target ${o.op === '<=' ? '≤' : '≥'} ${o.target}${unit}`;
  const label = { 'on-track': 'On track', 'at-risk': 'At risk', met: 'Met', missed: 'Missed', pending: 'Later' }[o.status];
  let detail = val;
  if (s && o.metric === 'wildlifeThriving') {
    // Say which animals the bonus needs and how close each one is, not a bare 0 / 1.
    try {
      const parts = (BONUS_SPECIES[s.scenarioId] ?? []).map((id) => {
        const d = SPECIES_BY_ID[id];
        const rt = s.wildlife?.species?.[id];
        if (!d) return '';
        const nest = d.thrive.nestStreak !== undefined ? `, nesting ${rt?.nestStreak ?? 0} summer${rt?.nestStreak === 1 ? '' : 's'} in a row (needs ${d.thrive.nestStreak})` : '';
        return `${d.name}: ${rt?.pop ?? 0} (needs ${d.thrive.pop})${nest}`;
      }).filter(Boolean);
      if (parts.length && o.status !== 'pending') detail = parts.join(' · ');
    } catch { /* keep the plain value */ }
  }
  let atRiskHomes = 0;
  try { atRiskHomes = s && o.metric === 'homesLost' ? mechMetric(s, 'homesAtRisk') ?? 0 : 0; } catch { atRiskHomes = 0; }
  if (atRiskHomes > 0 && o.status === 'on-track') detail = `${detail} · ${atRiskHomes} home${atRiskHomes > 1 ? 's' : ''} on low ground`;
  // A goal that is fine now but sliding fast (the aquifer) gets its hint early, with the trend.
  let sliding = false;
  if (s && o.metric === 'aquifer' && o.current !== null) {
    const d = readoutTrend('aquifer');
    if (d !== null && d <= -1) {
      sliding = true;
      const yrs = Math.max(0, (o.current - o.target) / -d);
      detail = `${detail} · falling ${Math.round(-d)} a year${o.current > o.target ? `, below ${o.target} in about ${Math.round(yrs)} years` : ''}`;
    }
  }
  const how = s && !noHow && (o.status === 'at-risk' || o.status === 'missed' || atRiskHomes > 0 || sliding) && s.phase === 'act2' ? HOW_TO[`${s.scenarioId}:${o.metric}`] ?? HOW_TO[o.metric] : undefined;
  // Goals that are fine for now are drawn compact (no progress bar) so the ones that need attention stand out.
  const compact = !how && (o.status === 'on-track' || o.status === 'met' || o.status === 'pending');
  return h('div', { class: `obj ${o.status} ${o.bonus ? 'bonus' : ''}${compact ? ' compact' : ''}` }, svg(icon),
    h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'lab' }, degC(o.label)), h('div', { class: 'val' }, `${label} · ${detail}`), h('div', { class: 'bar' }, h('i', { style: `width:${pct * 100}%` })), how ? h('div', { class: 'how' }, degC(how)) : null));
}

/** Mobile: close the bottom sheet. Desktop: fold the panel down to its title. */
function collapse(el: HTMLElement, e: Event): void {
  if (el.classList.contains('open')) {
    el.classList.remove('open');
    return;
  }
  const folded = el.classList.toggle('folded');
  const btn = e.currentTarget as HTMLElement;
  btn.textContent = folded ? 'show' : 'hide';
}
