// Water-quality field kit (WP8b): the "Test the creek" panel, the bug survey, predictions and their results.
import { ESTUARY_CAUTION, INDICATOR_HELP, KIT_CAUTIONS, KIT_SOURCE } from '../content/waterkit';
import { canTest, kitSites, KIT_COST, learnOf, openPrediction, signalBand, siteName } from '../sim/fieldkit';
import type { KitIndicator, KitPrediction, KitReading, KitSite, Trend } from '../sim/learnTypes';
import type { GameState } from '../sim/types';
import { h, svg } from './dom';
import { UI_ICONS } from './icons';
import { LEARN_ICONS } from './learnicons';
import { openModal } from './modal';

const TREND_LABEL: Record<Trend, string> = { better: 'Better', same: 'About the same', worse: 'Worse' };
const VERDICT_WORD = { ok: 'In range', high: 'Too high', low: 'Too low' } as const;

function indicatorRow(i: KitIndicator): HTMLElement {
  const value = i.id === 'ph' ? i.value.toFixed(1) : i.value.toLocaleString('en-AU');
  return h('tr', { class: `kit-${i.verdict}` },
    h('th', { scope: 'row', title: INDICATOR_HELP[i.id] ?? '' }, i.label),
    h('td', { class: 'kit-val' }, `${value}`, h('small', null, ` ${i.unit}`)),
    h('td', { class: 'kit-trig' }, i.trigger),
    h('td', null, h('span', { class: `kit-chip ${i.verdict}` }, VERDICT_WORD[i.verdict])));
}

export function readingView(r: KitReading, s: GameState): HTMLElement {
  const band = signalBand(r.signal);
  const total = r.bugs.reduce((n, b) => n + b.count, 0);
  const found = r.bugs.filter((b) => b.count > 0).sort((a, b) => b.grade - a.grade);
  const max = Math.max(1, ...r.bugs.map((b) => b.count));
  return h('div', { class: 'kit-reading', 'data-qa': 'kit-reading' },
    h('div', { class: 'kit-head' }, h('b', null, `${r.year}: the ${siteName(s, r.site)}`), r.auto ? h('span', { class: 'muted' }, 'free survey') : null),
    h('table', { class: 'kit-table' },
      h('thead', null, h('tr', null, h('th', null, 'Test'), h('th', null, 'Reading'), h('th', null, 'Guide value'), h('th', null, ''))),
      h('tbody', null, ...r.indicators.map(indicatorRow))),
    h('div', { class: 'kit-bugs' },
      h('div', { class: 'kit-head' }, h('b', null, 'Water bug survey'), h('span', { class: 'muted' }, `${total} bugs counted`)),
      h('div', { class: `kit-score ${band.tone}` }, h('b', null, r.signal.toFixed(1)), h('div', null, h('b', null, `SIGNAL2 score: ${band.label}`), h('div', { style: 'font-size:12.5px' }, band.text))),
      found.length === 0 ? h('p', { class: 'muted' }, 'No bugs at all in the net.') : h('div', { class: 'kit-bug-list' }, ...found.map((b) => h('div', { class: 'kit-bug', title: `Sensitivity grade ${b.grade} out of 10` },
        h('span', { class: 'kit-grade', style: `--g:${b.grade}` }, String(b.grade)), h('span', { class: 'kit-bug-name' }, b.name), h('span', { class: 'kit-bar' }, h('i', { style: `width:${Math.round((b.count / max) * 100)}%` })), h('span', { class: 'kit-n' }, String(b.count)))))));
}

/** "You said worse. The bug score went from 6.1 to 4.3." */
export function predictionResult(p: KitPrediction): HTMLElement | null {
  if (p.resolvedYear === undefined || p.actual === undefined) return null;
  const right = p.choice !== undefined && p.choice === p.actual;
  return h('div', { class: `kit-pred ${p.choice === undefined ? 'none' : right ? 'right' : 'wrong'}`, 'data-qa': 'kit-pred' },
    svg(p.choice === undefined ? UI_ICONS.info : right ? UI_ICONS.check : UI_ICONS.cross),
    h('div', null,
      h('b', null, `Your prediction (${p.year}): `), p.choice ? TREND_LABEL[p.choice].toLowerCase() : 'no pick',
      p.text ? h('span', null, ` · "${p.text}"`) : null, h('br'),
      h('b', null, `What happened (${p.resolvedYear}): `), `the water bug score went from ${p.baseSignal.toFixed(1)} to ${(p.resultSignal ?? 0).toFixed(1)}, so the creek got ${p.actual === 'same' ? 'about the same' : p.actual}.`,
      p.choice !== undefined ? h('div', { class: 'muted', style: 'font-size:12.5px' }, right ? 'Your prediction was right. What clues did you use?' : 'Not this time. What did you not expect? Predicting and checking is how scientists learn.') : null));
}

/** The prediction results from the last closed prediction, for the decade report. */
export function latestPredictionView(s: GameState): HTMLElement | null {
  const ps = learnOf(s).predictions;
  const last = ps[ps.length - 1];
  return last ? predictionResult(last) : null;
}

export class FieldKitPanel {
  el: HTMLElement;
  private body: HTMLElement;
  private site: KitSite = 'river';
  private choice: Trend | null = null;
  private text = '';
  /** Wired by the app: spend $2k and test, make a prediction. */
  onTest: ((site: KitSite) => void) | null = null;
  onPredict: ((choice: Trend | undefined, text: string) => void) | null = null;
  private last: GameState | null = null;

  constructor() {
    this.body = h('div');
    this.el = h('div', { class: 'drawer panel kit', 'aria-label': 'Water field kit' },
      h('div', { class: 'panel-head' }, h('h3', null, svg(LEARN_ICONS.flask), 'Water field kit'), h('button', { class: 'btn small', onclick: () => this.el.classList.remove('open') }, 'Close')),
      this.body);
    document.body.appendChild(this.el);
  }

  get isOpen(): boolean {
    return this.el.classList.contains('open');
  }

  open(s: GameState): void {
    this.render(s);
    this.el.classList.add('open');
  }

  render(s: GameState): void {
    this.last = s;
    const sites = kitSites(s);
    if (!sites.includes(this.site)) this.site = sites[0] ?? 'river';
    const L = learnOf(s);
    const can = canTest(s);
    const name = siteName(s, this.site);
    const reading = [...L.kit].reverse().find((r) => !r.auto) ?? L.kit[L.kit.length - 1];
    const open = openPrediction(s);
    const closed = [...L.predictions].filter((p) => p.resolvedYear !== undefined).reverse();
    const caution = KIT_CAUTIONS[s.scenarioId];

    const siteSeg = sites.length > 1
      ? h('div', { class: 'seg', role: 'group', 'aria-label': 'Where to test' }, ...sites.map((x) => h('button', { class: this.site === x ? 'on' : '', onclick: () => { this.site = x; this.render(s); } }, x === 'river' ? siteName(s, 'river') : 'estuary')))
      : null;

    const predBlock = (): HTMLElement => {
      if (open) {
        return h('div', { class: 'kit-pred-open' },
          h('b', null, `Your prediction for ${open.year}s onward: `), open.choice ? TREND_LABEL[open.choice].toLowerCase() : 'no pick', open.text ? ` · "${open.text}"` : '',
          h('p', { class: 'muted', style: 'font-size:12.5px;margin:4px 0 0' }, `The bug score is ${open.baseSignal.toFixed(1)} now. We will compare it when ${open.year >= 0 && s.phase === 'act1' ? 'the decade ends' : '10 years have passed'}.`));
      }
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Your prediction' }, ...(['better', 'same', 'worse'] as Trend[]).map((t) => h('button', { class: this.choice === t ? 'on' : '', 'data-pred': t, onclick: () => { this.choice = this.choice === t ? null : t; this.render(s); } }, TREND_LABEL[t])));
      const input = h('input', { type: 'text', class: 'kit-input', maxlength: 140, placeholder: 'One line: why do you think so? (optional)', value: this.text, 'aria-label': 'Your prediction in one line' }) as HTMLInputElement;
      input.addEventListener('input', () => { this.text = input.value; });
      return h('div', null,
        h('p', { style: 'margin:0 0 6px;font-size:13px' }, 'Where will the creek be in ten years? Predict first, then see.'),
        seg, input,
        h('div', { style: 'margin-top:6px' }, h('button', { class: 'btn small teal', 'data-qa': 'kit-predict', disabled: !this.choice && !this.text.trim(), onclick: () => { this.onPredict?.(this.choice ?? undefined, this.text); this.choice = null; this.text = ''; } }, 'Save my prediction')));
    };

    this.body.replaceChildren(...[
      h('p', { class: 'muted', style: 'font-size:13px;margin:6px 0' }, `Test the ${name} like a Waterwatch volunteer: oxygen, nutrients, mud, acidity, salt and a net full of water bugs. ${s.phase === 'act1' ? 'One test a decade.' : 'One test a year.'}`),
      h('div', { class: 'kit-actions' }, siteSeg,
        h('button', { class: 'btn teal', 'data-qa': 'kit-test', disabled: !can.ok, title: can.reason ?? '', onclick: () => this.onTest?.(this.site) }, svg(LEARN_ICONS.water), `Test the ${name} ($${KIT_COST}k)`)),
      !can.ok ? h('p', { class: 'muted', style: 'font-size:12.5px;margin:4px 0 0' }, can.reason ?? '') : null,
      reading ? readingView(reading, s) : h('p', { class: 'kit-empty' }, 'No tests yet. Press the button to take your first reading.'),
      h('h4', { style: 'margin:12px 0 4px' }, 'Make a prediction'),
      predBlock(),
      closed.length ? h('div', { class: 'kit-closed' }, h('h4', { style: 'margin:12px 0 4px' }, 'Your predictions and what happened'), ...closed.slice(0, 5).map((p) => predictionResult(p))) : null,
      L.kit.length > 1 ? h('div', null, h('h4', { style: 'margin:12px 0 4px' }, 'Your readings so far'),
        h('table', { class: 'kit-table small' }, h('thead', null, h('tr', null, h('th', null, 'Year'), h('th', null, 'Oxygen'), h('th', null, 'N'), h('th', null, 'P'), h('th', null, 'Bug score'))),
          h('tbody', null, ...L.kit.slice(-8).map((r) => h('tr', null, h('td', null, `${r.year}${r.auto ? '*' : ''}`), h('td', null, `${r.indicators.find((i) => i.id === 'do')?.value ?? ''}%`), h('td', null, String(r.indicators.find((i) => i.id === 'tn')?.value ?? '')), h('td', null, String(r.indicators.find((i) => i.id === 'tp')?.value ?? '')), h('td', null, r.signal.toFixed(1)))))),
        h('p', { class: 'muted', style: 'font-size:11.5px;margin:2px 0 0' }, '* a free survey that closed a prediction. Your readings are in the Graphs CSV export.')) : null,
      this.site === 'estuary' ? h('p', { class: 'muted', style: 'font-size:12px' }, ESTUARY_CAUTION) : null,
      caution ? h('p', { class: 'muted', style: 'font-size:12px' }, caution) : null,
      h('p', { class: 'muted', style: 'font-size:11.5px' }, KIT_SOURCE, ' The readings in the game are a model, not real measurements.'),
    ].filter((x): x is HTMLElement => x !== null));
  }

  refresh(s: GameState): void {
    if (this.isOpen && (!this.last || this.last.version !== s.version)) this.render(s);
  }
}

/** Before an Act 1 skip: a one-line prediction (or skip without one). Calls `go` when the player moves on. */
export function promptPrediction(s: GameState, onPredict: (choice: Trend | undefined, text: string) => void, go: () => void): boolean {
  if (kitSites(s).length === 0 || openPrediction(s)) return false;
  let choice: Trend | undefined;
  const input = h('input', { type: 'text', class: 'kit-input', maxlength: 140, placeholder: 'One line: why? (optional)', 'aria-label': 'Your prediction in one line' }) as HTMLInputElement;
  const seg = h('div', { class: 'seg' }, ...(['better', 'same', 'worse'] as Trend[]).map((t) => h('button', {
    'data-pred': t, onclick: () => { choice = choice === t ? undefined : t; seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.pred === choice)); },
  }, TREND_LABEL[t])));
  const m = openModal([
    h('div', { class: 'kicker' }, 'Before the decade'),
    h('h2', null, `Where will the ${siteName(s, kitSites(s)[0] ?? 'river')} be by the end of the decade?`),
    h('p', null, 'Scientists predict first and check afterwards. Will the water bugs, which show how healthy the water is, do better, the same or worse?'),
    seg, input,
    h('div', { class: 'modal-actions' },
      h('button', { class: 'btn', onclick: () => { m.close(); go(); } }, 'Skip without predicting'),
      h('button', { class: 'btn primary', 'data-qa': 'pred-go', onclick: () => { if (choice || input.value.trim()) onPredict(choice, input.value); m.close(); go(); } }, 'Save and skip ahead')),
  ], { closable: false });
  return true;
}
