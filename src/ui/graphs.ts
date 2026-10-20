// Hand-drawn canvas graphs: CO2 and temperature (player vs dashed real record) and emissions by source as
// stacked decade bars. Hover crosshair + tooltip, CSV export, "The science" explainers. One axis per chart.
import { REAL_YEARS, realCO2, realTemp } from '../sim/realData';
import { getScenario } from '../sim/scenarios';
import { EMISSION_CATEGORIES, type EmissionCategory, type GameState } from '../sim/types';
import { download, h, svg } from './dom';
import { UI_ICONS } from './icons';

export const CAT_COL: Record<EmissionCategory, string> = {
  power: '#3d6fb0', industry: '#c0583a', transport: '#7a5aa8', land: '#5f9a4e', waste: '#d9a32a',
};
export const CAT_NAME: Record<EmissionCategory, string> = {
  power: 'Power', industry: 'Industry', transport: 'Transport', land: 'Land clearing & farms', waste: 'Waste',
};

const INK = '#2d241e';
const MUTED = '#8a7868';
const GRID = 'rgba(58,42,34,0.10)';
const PLAYER = '#c0583a';
const REAL = '#6a6058';

interface Pt { x: number; y: number }
interface Series { name: string; pts: Pt[]; color: string; dash?: boolean }

export interface GraphData {
  x0: number;
  x1: number;
  co2: Series[];
  temp: Series[];
  bars: { year: number; e: Record<EmissionCategory, number> }[];
}

export function graphData(s: GameState): GraphData {
  const sc = getScenario(s.scenarioId);
  const x0 = sc.startYear;
  const act2 = s.phase === 'act2' || s.phase === 'epilogue' || s.phase === 'failed';
  const x1 = act2 ? sc.act2.endYear : sc.endYear;
  const pc: Pt[] = s.history.map((r) => ({ x: r.year, y: r.co2 }));
  const pt: Pt[] = s.history.map((r) => ({ x: r.year, y: r.tempC }));
  const yearly = s.a2?.yearly ?? [];
  for (const r of yearly) {
    if (r.year <= (pc[pc.length - 1]?.x ?? 0)) continue;
    pc.push({ x: r.year, y: r.co2 });
    pt.push({ x: r.year, y: r.tempC });
  }
  const real = REAL_YEARS.filter((y) => y >= x0 && y <= Math.min(x1, 2020));
  const rc = real.map((y) => ({ x: y, y: realCO2(y) }));
  const rt = real.map((y) => ({ x: y, y: realTemp(y) }));
  const bars: GraphData['bars'] = [];
  for (const r of s.history) if (r.totalKt > 0) bars.push({ year: r.year, e: { ...r.emissionsKt } });
  // Act 2: sum years into decades so the bars stay comparable
  const dec = new Map<number, Record<EmissionCategory, number>>();
  for (const r of yearly) {
    const d = Math.ceil(r.year / 10) * 10;
    const e = dec.get(d) ?? { power: 0, industry: 0, transport: 0, land: 0, waste: 0 };
    for (const c of EMISSION_CATEGORIES) e[c] += r.emissionsKt[c];
    dec.set(d, e);
  }
  for (const [year, e] of [...dec.entries()].sort((a, b) => a[0] - b[0])) if (!bars.some((b) => b.year === year)) bars.push({ year, e });
  return {
    x0, x1,
    co2: [{ name: 'Real record', pts: rc, color: REAL, dash: true }, { name: 'Your world', pts: pc, color: PLAYER }],
    temp: [{ name: 'Real record', pts: rt, color: REAL, dash: true }, { name: 'Your world', pts: pt, color: PLAYER }],
    bars,
  };
}

function setupCanvas(c: HTMLCanvasElement): { g: CanvasRenderingContext2D; w: number; hgt: number } | null {
  const r = c.getBoundingClientRect();
  if (r.width < 10) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== Math.round(r.width * dpr)) {
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
  }
  const g = c.getContext('2d');
  if (!g) return null;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, r.width, r.height);
  return { g, w: r.width, hgt: r.height };
}

function niceStep(range: number, n: number): number {
  const raw = range / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

const PAD = { l: 38, r: 10, t: 10, b: 20 };

function axes(g: CanvasRenderingContext2D, w: number, hgt: number, x0: number, x1: number, y0: number, y1: number, fmtY: (v: number) => string): { X: (v: number) => number; Y: (v: number) => number } {
  const X = (v: number): number => PAD.l + ((v - x0) / (x1 - x0)) * (w - PAD.l - PAD.r);
  const Y = (v: number): number => hgt - PAD.b - ((v - y0) / (y1 - y0)) * (hgt - PAD.t - PAD.b);
  g.font = '700 10px Nunito, system-ui, sans-serif';
  g.fillStyle = MUTED;
  g.strokeStyle = GRID;
  g.lineWidth = 1;
  const ys = niceStep(y1 - y0, 4);
  for (let v = Math.ceil(y0 / ys) * ys; v <= y1 + 1e-9; v += ys) {
    const y = Math.round(Y(v)) + 0.5;
    g.beginPath(); g.moveTo(PAD.l, y); g.lineTo(w - PAD.r, y); g.stroke();
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillText(fmtY(v), PAD.l - 5, y);
  }
  const xs = x1 - x0 > 150 ? 50 : x1 - x0 > 60 ? 25 : 10;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  for (let v = Math.ceil(x0 / xs) * xs; v <= x1; v += xs) g.fillText(String(v), X(v), hgt - PAD.b + 5);
  return { X, Y };
}

function drawLines(c: HTMLCanvasElement, d: GraphData, which: 'co2' | 'temp', hoverX: number | null): void {
  const s = setupCanvas(c);
  if (!s) return;
  const { g, w, hgt } = s;
  const series = d[which];
  let lo = Infinity, hi = -Infinity;
  for (const se of series) for (const p of se.pts) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  if (which === 'co2') { lo = Math.min(lo, 280); hi = Math.max(hi, 320); }
  else { lo = Math.min(lo, -0.2); hi = Math.max(hi, 1.0); }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const { X, Y } = axes(g, w, hgt, d.x0, d.x1, lo, hi, which === 'co2' ? (v) => v.toFixed(0) : (v) => v.toFixed(1));
  if (which === 'temp' && lo < 0 && hi > 0) {
    g.strokeStyle = 'rgba(58,42,34,0.25)';
    g.beginPath(); g.moveTo(PAD.l, Y(0)); g.lineTo(w - PAD.r, Y(0)); g.stroke();
  }
  for (const se of series) {
    if (!se.pts.length) continue;
    g.strokeStyle = se.color;
    g.lineWidth = 2;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.setLineDash(se.dash ? [5, 4] : []);
    g.beginPath();
    se.pts.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))));
    g.stroke();
    g.setLineDash([]);
    if (!se.dash) {
      const last = se.pts[se.pts.length - 1]!;
      g.fillStyle = se.color;
      g.beginPath(); g.arc(X(last.x), Y(last.y), 4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fffaf0'; g.lineWidth = 2; g.stroke();
    }
  }
  if (hoverX !== null) {
    const yr = d.x0 + ((hoverX - PAD.l) / (w - PAD.l - PAD.r)) * (d.x1 - d.x0);
    const vals: { name: string; v: number; col: string; x: number }[] = [];
    for (const se of series) {
      let best: Pt | null = null;
      for (const p of se.pts) if (!best || Math.abs(p.x - yr) < Math.abs(best.x - yr)) best = p;
      if (best && Math.abs(best.x - yr) <= 6) vals.push({ name: se.name, v: best.y, col: se.color, x: best.x });
    }
    if (vals.length) {
      const xx = X(vals[vals.length - 1]!.x);
      g.strokeStyle = 'rgba(45,36,30,0.35)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(xx, PAD.t); g.lineTo(xx, hgt - PAD.b); g.stroke();
      const lines = [`${vals[vals.length - 1]!.x}`, ...vals.map((v) => `${v.name}: ${which === 'co2' ? v.v.toFixed(0) + ' ppm' : (v.v >= 0 ? '+' : '') + v.v.toFixed(2) + ' °C'}`)];
      g.font = '800 11px Nunito, system-ui, sans-serif';
      const tw = Math.max(...lines.map((l) => g.measureText(l).width)) + 16;
      const tx = Math.min(w - tw - 4, Math.max(4, xx + 8));
      g.fillStyle = 'rgba(45,36,30,0.92)';
      roundRect(g, tx, PAD.t, tw, 14 * lines.length + 8, 6);
      g.fill();
      g.textAlign = 'left';
      g.textBaseline = 'top';
      lines.forEach((l, i) => {
        g.fillStyle = i === 0 ? '#ffe08a' : '#fbf3e4';
        g.fillText(l, tx + 8, PAD.t + 5 + i * 14);
      });
    }
  }
}

function drawBars(c: HTMLCanvasElement, d: GraphData, hoverX: number | null): void {
  const s = setupCanvas(c);
  if (!s) return;
  const { g, w, hgt } = s;
  let hi = 10;
  for (const b of d.bars) hi = Math.max(hi, EMISSION_CATEGORIES.reduce((n, k) => n + b.e[k], 0));
  hi *= 1.1;
  const { X, Y } = axes(g, w, hgt, d.x0, d.x1 + 5, 0, hi, (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)));
  const bw = Math.max(3, ((w - PAD.l - PAD.r) / ((d.x1 - d.x0) / 10 + 1)) * 0.62);
  let hovered: (typeof d.bars)[number] | null = null;
  for (const b of d.bars) {
    const cx = X(b.year - 5);
    let acc = 0;
    for (const k of EMISSION_CATEGORIES) {
      const v = b.e[k];
      if (v <= 0) continue;
      const y0 = Y(acc);
      const y1 = Y(acc + v);
      g.fillStyle = CAT_COL[k];
      const hh = Math.max(1, y0 - y1 - 2);
      roundRect(g, cx - bw / 2, y1, bw, hh, Math.min(3, hh / 2));
      g.fill();
      acc += v;
    }
    if (hoverX !== null && Math.abs(hoverX - cx) < bw / 2 + 3) hovered = b;
  }
  if (hovered) {
    const total = EMISSION_CATEGORIES.reduce((n, k) => n + hovered!.e[k], 0);
    const lines = [`${hovered.year - 10}–${hovered.year}: ${total.toFixed(0)} kt`, ...EMISSION_CATEGORIES.filter((k) => hovered!.e[k] > 0).map((k) => `${CAT_NAME[k]}: ${hovered!.e[k].toFixed(0)}`)];
    g.font = '800 11px Nunito, system-ui, sans-serif';
    const tw = Math.max(...lines.map((l) => g.measureText(l).width)) + 16;
    const tx = Math.min(w - tw - 4, Math.max(4, (hoverX ?? 0) + 8));
    g.fillStyle = 'rgba(45,36,30,0.92)';
    roundRect(g, tx, PAD.t, tw, 14 * lines.length + 8, 6);
    g.fill();
    g.textAlign = 'left';
    g.textBaseline = 'top';
    lines.forEach((l, i) => {
      g.fillStyle = i === 0 ? '#ffe08a' : '#fbf3e4';
      g.fillText(l, tx + 8, PAD.t + 5 + i * 14);
    });
  }
  if (!d.bars.length) {
    g.fillStyle = MUTED;
    g.textAlign = 'center';
    g.font = '700 12px Nunito, system-ui, sans-serif';
    g.fillText('Advance a decade to see your emissions', w / 2, hgt / 2);
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + hh, r);
  g.arcTo(x + w, y + hh, x, y + hh, r);
  g.arcTo(x, y + hh, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const SCIENCE = {
  co2: [
    'Burning coal, oil and gas releases carbon dioxide (CO₂) that stays in the air for centuries, so every decade of emissions adds to the total.',
    'The dashed line is the real record: Antarctic ice cores (Law Dome) before 1958, then direct measurements at Mauna Loa. Your line is the real curve scaled by how much your town emitted compared with a typical industrialising town.',
  ],
  temp: [
    'Extra CO₂ traps more of the heat the Earth radiates (the enhanced greenhouse effect), so average temperature rises.',
    'This model uses about 1.8 °C of warming for each doubling of CO₂ (the transient climate response). In Act 2 warming also lags behind CO₂ by a couple of decades, which is why cutting emissions early matters. Real climate has natural ups and downs (volcanoes, El Niño) that this simple model leaves out.',
  ],
  bars: [
    'Each bar is one decade of your town\'s emissions in kilotonnes of CO₂-equivalent, split by source. Methane from landfill counts as CO₂-equivalent because it traps much more heat per tonne.',
    'Compare the shape with the CO₂ graph: emissions are the flow, CO₂ in the air is the stock that keeps rising while emissions stay above zero.',
  ],
};

export class GraphsPanel {
  el: HTMLElement;
  private canvases: Record<'co2' | 'temp' | 'bars', HTMLCanvasElement>;
  private state: GameState | null = null;
  private data: GraphData | null = null;
  private hover: { which: string; x: number } | null = null;
  private lastVersion = -1;
  onClose: (() => void) | null = null;

  constructor() {
    const mk = (which: 'co2' | 'temp' | 'bars'): HTMLCanvasElement => {
      const c = h('canvas', { 'aria-label': which === 'co2' ? 'CO2 graph' : which === 'temp' ? 'Temperature graph' : 'Emissions by source graph' });
      const move = (e: PointerEvent): void => {
        const r = c.getBoundingClientRect();
        this.hover = { which, x: e.clientX - r.left };
        this.draw();
      };
      c.addEventListener('pointermove', move);
      c.addEventListener('pointerdown', move);
      c.addEventListener('pointerleave', () => { this.hover = null; this.draw(); });
      return c;
    };
    this.canvases = { co2: mk('co2'), temp: mk('temp'), bars: mk('bars') };
    const sci = (k: keyof typeof SCIENCE): HTMLElement => {
      const box = h('div', { class: 'science hidden' }, ...SCIENCE[k].map((t) => h('p', null, t)));
      const btn = h('button', { class: 'linkbtn', onclick: () => { box.classList.toggle('hidden'); btn.textContent = box.classList.contains('hidden') ? 'The science ▸' : 'The science ▾'; } }, 'The science ▸');
      return h('div', null, btn, box);
    };
    const legendLines = h('div', { class: 'legend' },
      h('span', null, h('i', { style: `background:${PLAYER}` }), 'Your world'),
      h('span', null, h('i', { style: `background:${REAL};height:2px;width:14px;border-radius:0` }), 'Real record (dashed)'));
    const legendBars = h('div', { class: 'legend' }, ...EMISSION_CATEGORIES.map((k) => h('span', null, h('i', { style: `background:${CAT_COL[k]}` }), CAT_NAME[k])));
    this.el = h('div', { class: 'side graphs panel hidden' },
      h('div', { class: 'panel-head' },
        h('h3', null, svg(UI_ICONS.chart), 'Your climate data'),
        h('div', { class: 'toprow-btns' },
          h('button', { class: 'btn small', onclick: () => this.csv(), title: 'Download the data as a spreadsheet (CSV)' }, 'CSV'),
          h('button', { class: 'iconbtn', style: 'width:32px;height:32px', 'aria-label': 'Close graphs', onclick: () => { this.toggle(false); this.onClose?.(); } }, svg(UI_ICONS.close)))),
      legendLines,
      h('div', { class: 'graph' }, h('div', { class: 'graph-title' }, 'Carbon dioxide in the air', h('span', null, 'ppm (parts per million)')), this.canvases.co2, sci('co2')),
      h('div', { class: 'graph' }, h('div', { class: 'graph-title' }, 'Global temperature change', h('span', null, '°C above 1850–1900')), this.canvases.temp, sci('temp')),
      h('div', { class: 'graph' }, h('div', { class: 'graph-title' }, 'Your town\'s emissions per decade', h('span', null, 'kt CO₂-e')), legendBars, this.canvases.bars, sci('bars')),
    );
    window.addEventListener('resize', () => this.draw());
  }

  get open(): boolean {
    return !this.el.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    this.el.classList.toggle('hidden', !show);
    if (show) requestAnimationFrame(() => this.draw());
  }

  update(s: GameState): void {
    this.state = s;
    if (s.version === this.lastVersion) return;
    this.lastVersion = s.version;
    this.data = graphData(s);
    if (this.open) this.draw();
  }

  draw(): void {
    if (!this.data || !this.open) return;
    const hx = (w: string): number | null => (this.hover && this.hover.which === w ? this.hover.x : null);
    drawLines(this.canvases.co2, this.data, 'co2', hx('co2'));
    drawLines(this.canvases.temp, this.data, 'temp', hx('temp'));
    drawBars(this.canvases.bars, this.data, hx('bars'));
  }

  /** Render the three graphs into a container (for the summary / epilogue). */
  static staticGraphs(s: GameState): HTMLElement {
    const d = graphData(s);
    const c1 = h('canvas'), c2 = h('canvas'), c3 = h('canvas');
    const legend = h('div', { class: 'legend', style: 'grid-column:1/-1' },
      h('span', null, h('i', { style: `background:${PLAYER}` }), 'Your world'),
      h('span', null, h('i', { style: `background:${REAL};height:2px;width:14px;border-radius:0` }), 'Real record (dashed)'),
      ...EMISSION_CATEGORIES.map((k) => h('span', null, h('i', { style: `background:${CAT_COL[k]}` }), CAT_NAME[k])));
    const wrap = h('div', { class: 'stat-grid', style: 'grid-template-columns:repeat(auto-fit,minmax(240px,1fr))' }, legend,
      h('div', { class: 'graph' }, h('div', { class: 'graph-title' }, 'CO₂', h('span', null, 'ppm')), c1),
      h('div', { class: 'graph' }, h('div', { class: 'graph-title' }, 'Temperature', h('span', null, '°C')), c2),
      h('div', { class: 'graph' }, h('div', { class: 'graph-title' }, 'Emissions', h('span', null, 'kt per decade')), c3));
    requestAnimationFrame(() => {
      drawLines(c1, d, 'co2', null);
      drawLines(c2, d, 'temp', null);
      drawBars(c3, d, null);
    });
    return wrap;
  }

  csv(): void {
    const s = this.state;
    if (!s) return;
    const rows = ['year,your_co2_ppm,real_co2_ppm,your_temp_c,real_temp_c,power_kt,industry_kt,transport_kt,land_kt,waste_kt,total_kt,period'];
    const f = (n: number, dd = 2): string => n.toFixed(dd);
    for (const r of s.history) {
      rows.push([r.year, f(r.co2), f(r.realCo2), f(r.tempC), f(r.realTempC), ...EMISSION_CATEGORIES.map((c) => f(r.emissionsKt[c], 1)), f(r.totalKt, 1), 'decade'].join(','));
    }
    for (const r of s.a2?.yearly ?? []) {
      rows.push([r.year, f(r.co2), r.year <= 2020 ? f(realCO2(r.year)) : '', f(r.tempC), r.year <= 2020 ? f(realTemp(r.year)) : '', ...EMISSION_CATEGORIES.map((c) => f(r.emissionsKt[c], 1)), f(r.totalKt, 1), 'year'].join(','));
    }
    download(`carrying-capacity-${s.scenarioId}-${s.year}.csv`, rows.join('\n') + '\n');
  }
}
