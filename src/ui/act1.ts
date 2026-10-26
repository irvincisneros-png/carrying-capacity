// Act 1 widgets (Round 6): the boom's goals, building upgrades in the Inspect panel, and the decade "what it cost" ledger.
import { act1GoalStatus, act1Of, act1Outcome } from '../sim/act1goals';
import type { Act1GoalResult } from '../sim/act1goals';
import { getScenario } from '../sim/scenarios';
import { upgradeOptions } from '../sim/upgrades';
import type { UpgradeOption } from '../sim/upgrades';
import type { DecadeReport, GameState, PlacedBuilding } from '../sim/types';
import type { ChainKey } from '../content/causes';
import { clear, fmtInt, h, svg } from './dom';
import { UI_ICONS } from './icons';
import { LEARN_ICONS } from './learnicons';

function goalValue(g: Act1GoalResult): string {
  if (g.metric === 'powerCovered') return g.current >= 1 ? 'Power covers everything' : 'Some buildings are short of power';
  return `Now ${Math.round(g.current)} · target ${g.op === '<=' ? '≤' : '≥'} ${g.target}`;
}

function goalRow(g: Act1GoalResult): HTMLElement {
  const icon = g.status === 'met' || g.status === 'on-track' ? UI_ICONS.check : g.status === 'missed' ? UI_ICONS.cross : UI_ICONS.warn;
  const pct = g.metric === 'powerCovered' ? (g.current >= 1 ? 1 : 0) : Math.max(0, Math.min(1, g.current / Math.max(1e-6, g.target)));
  return h('div', { class: `obj ${g.status}` }, svg(icon),
    h('div', { style: 'flex:1' }, h('div', { class: 'lab' }, g.label, g.bonus ? h('span', { class: 'muted' }, ' (bonus)') : null),
      h('div', { class: 'val' }, goalValue(g)),
      g.status === 'on-track' || g.status === 'at-risk' ? h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(pct * 100)}%` })) : null));
}

/** The boom's goals, kept on screen during Act 1 (Act 2's goals stay hidden until the turning point). */
export class Act1GoalsPanel {
  el: HTMLElement;
  private list: HTMLElement;
  private titleEl = h('span', null, 'Goals for the boom');
  private sig = '';

  constructor() {
    this.list = h('div');
    this.el = h('div', { class: 'side objectives act1goals panel hidden' },
      h('div', { class: 'panel-head' }, h('h3', null, svg(UI_ICONS.target), this.titleEl), h('button', { class: 'linkbtn', onclick: () => this.el.classList.toggle('collapsed') }, 'hide')),
      this.list);
  }

  update(s: GameState): void {
    const def = act1Of(s);
    const show = s.phase === 'act1' && !!def;
    this.el.classList.toggle('hidden', !show);
    if (!show) return;
    const goals = act1GoalStatus(s);
    const sig = `${s.year}|${s.version}|` + goals.map((g) => `${g.id}:${g.status}:${Math.round(g.current)}`).join('|');
    if (sig === this.sig) return;
    this.sig = sig;
    this.titleEl.textContent = `Goals for ${getScenario(s.scenarioId).endYear}`;
    clear(this.list);
    for (const g of goals) this.list.appendChild(goalRow(g));
    this.list.appendChild(h('p', { class: 'muted', style: 'font-size:12px;margin:8px 0 0' }, 'The bonus is a badge on your report card. It does not change your stars.'));
  }
}

/** The intro's goal list for a scenario that starts in Act 1. Act 2's goals are not shown yet. */
export function act1IntroBox(s: GameState): HTMLElement | null {
  const def = act1Of(s);
  if (!def) return null;
  const main = def.goals.filter((g) => !g.bonus);
  const bonus = def.goals.filter((g) => g.bonus);
  const end = getScenario(s.scenarioId).endYear;
  return h('div', { class: 'fact', style: 'display:block', 'data-qa': 'act1-goals' },
    h('b', null, def.why ?? `Your goals, to ${end}:`),
    h('ul', { style: 'margin:6px 0 0 18px;padding:0' }, ...main.map((g) => h('li', null, g.label))),
    bonus.length ? h('p', { style: 'margin:6px 0 0;font-size:13px' }, h('b', null, 'Bonus: '), bonus.map((g) => g.label).join('; '), '. It earns a badge on your report card.') : null,
    h('p', { class: 'muted', style: 'margin:6px 0 0;font-size:13px' }, `The real test comes later, once you reach ${end}. Look after the place on the way and it will be easier.`),
    h('p', { class: 'muted', style: 'margin:6px 0 0;font-size:13px' }, h('b', null, 'Tip: '), 'click a building you have built to inspect it. From 1970 you can pay to fit cleaner parts to some of them, like a smoke scrubber on a factory.'));
}

// ---------------------------------------------------------------- upgrades (Inspect panel)
function upgradeRow(o: UpgradeOption, onFit: () => void): HTMLElement {
  const d = o.def;
  if (o.state === 'fitted') return h('div', { class: 'upg done' }, svg(UI_ICONS.check), h('div', null, h('b', null, `${d.name} fitted`), h('div', { class: 'muted', style: 'font-size:12px' }, d.effect)));
  const btn = h('button', {
    class: `btn small ${o.state === 'available' ? 'green' : ''}`, disabled: o.state !== 'available', title: o.reason ?? '', onclick: onFit,
  }, o.state === 'locked' ? `From ${d.unlock}` : `Fit it ($${d.cost}k)`);
  return h('div', { class: 'upg' }, svg(UI_ICONS.sprout),
    h('div', { style: 'flex:1' }, h('b', null, d.name), h('div', { style: 'font-size:12px;margin:2px 0' }, d.effect),
      h('details', { class: 'upg-teach' }, h('summary', null, 'Why it works'), h('p', { style: 'font-size:12px;margin:4px 0 0' }, d.teach)),
      h('div', { style: 'margin-top:4px' }, btn, o.state === 'no-funds' ? h('span', { class: 'muted', style: 'font-size:12px;margin-left:6px' }, 'Not enough money yet') : null)));
}

/** The upgrades for the building under the cursor, or null where there are none for it (or none are open in this phase). */
export function upgradeBlock(s: GameState, b: PlacedBuilding, onFit: (id: string) => void): HTMLElement | null {
  const opts = upgradeOptions(s, b);
  if (opts.length === 0) return null;
  if (s.phase !== 'act1' && !opts.some((o) => o.state === 'fitted')) return null;
  return h('div', { class: 'upgrades', 'data-qa': 'upgrades', style: 'margin-top:8px' },
    h('h4', { style: 'margin:0 0 4px;font-size:14px' }, 'Upgrades'),
    ...opts.map((o) => upgradeRow(o, () => onFit(o.def.id))));
}

// ---------------------------------------------------------------- decade ledger
type Dir = 'good-up' | 'good-down';
function trade(label: string, before: number, after: number, unit: string, dir: Dir, note?: string): HTMLElement {
  const diff = after - before;
  const better = dir === 'good-up' ? diff > 0 : diff < 0;
  const cls = diff === 0 ? 'same' : better ? 'better' : 'worse';
  return h('div', { class: `ledger-row ${cls}` }, h('span', null, label),
    h('b', null, `${fmtInt(before)}${unit} → ${fmtInt(after)}${unit}`), note ? h('em', null, note) : null);
}

/** "What it cost" beside "what it earned": the decade's money and the change to the land that came with it. */
export function ledgerView(r: DecadeReport, onWhy?: (key: ChainKey, what: string) => void): HTMLElement | null {
  const c = r.cost;
  if (!c) return null;
  const whys: { key: ChainKey; label: string; what: string }[] = [];
  if (c.creekAfter < c.creekBefore) whys.push(c.bushLost > 0 ? { key: 'erosion', label: 'Why did the creek get muddier?', what: `Creek health fell from ${c.creekBefore}% to ${c.creekAfter}%.` } : { key: 'algal-bloom', label: 'Why did the creek get dirtier?', what: `Creek health fell from ${c.creekBefore}% to ${c.creekAfter}%.` });
  if (c.airAfter < c.airBefore || c.airAfter < 70) whys.push({ key: 'smog', label: 'Why is the air worse?', what: `Air quality around homes is ${c.airAfter}% clean.` });
  if (c.birdsAfter < c.birdsBefore) whys.push({ key: 'species-loss', label: 'Why are the birds going?', what: `Bush birds fell from about ${c.birdsBefore} to ${c.birdsAfter} pairs.` });
  if (c.fishAfter < c.fishBefore) whys.push({ key: 'fish-kill', label: 'Why are there fewer fish?', what: `Creek fish fell from about ${c.fishBefore} to ${c.fishAfter} schools.` });
  return h('div', { class: 'ledger', 'data-qa': 'ledger' },
    h('div', { class: 'graph-title' }, 'What the decade earned, and what it cost', h('span', null, '')),
    h('div', { class: 'ledger-cols' },
      h('div', { class: 'ledger-earn' }, h('small', null, 'Earned'), h('b', null, `$${fmtInt(r.income)}k`), h('span', { class: 'muted' }, `${fmtInt(r.population)} people`)),
      h('div', { class: 'ledger-cost' },
        h('small', null, 'Cost to the land'),
        h('div', { class: `ledger-row ${c.bushLost > 0 ? 'worse' : 'same'}` }, h('span', null, 'Bush lost'), h('b', null, c.bushLost > 0 ? `${fmtInt(c.bushLost)} tiles` : 'none'), h('em', null, `${fmtInt(c.bushLeft)} tiles left`)),
        trade('Creek health', c.creekBefore, c.creekAfter, '%', 'good-up'),
        trade('Air quality', c.airBefore, c.airAfter, '%', 'good-up'),
        c.clearedM2After !== undefined ? trade('Cleared land per person', c.clearedM2Before ?? c.clearedM2After, c.clearedM2After, ' m²', 'good-down', 'less land for each person is gentler') : null,
        c.roadMAfter !== undefined ? trade('Road per person', c.roadMBefore ?? c.roadMAfter, c.roadMAfter, ' m', 'good-down', 'spread-out towns need more street') : null,
        h('div', { class: 'ledger-row' }, h('span', null, 'CO₂ added'), h('b', null, `${fmtInt(c.co2Kt)} kt`), h('em', null, `${r.deltaCo2 >= 0 ? '+' : ''}${r.deltaCo2.toFixed(1)} ppm in the air`)),
        trade('Bush birds', c.birdsBefore, c.birdsAfter, ' pairs', 'good-up', 'a rough guide'),
        trade('Creek fish', c.fishBefore, c.fishAfter, ' schools', 'good-up', 'a rough guide'))),
    onWhy && whys.length ? h('div', { class: 'why-links', 'data-qa': 'why-links' }, ...whys.map((w) => h('button', { class: 'btn small why-btn', type: 'button', onclick: () => onWhy(w.key, w.what) }, svg(LEARN_ICONS.chain), w.label))) : null);
}

// ---------------------------------------------------------------- turning point and report card
const PLACE: Record<string, string> = {
  'green-valley': 'valley', 'coal-coast': 'coast', 'river-town': 'river country', 'reef-island': 'island', 'red-dirt': 'country around the town',
};

/** The turning point's acknowledgement of how Act 1 went, or null for a game that has no Act 1 goals (or an old save). */
export function act1TurningNote(s: GameState): HTMLElement | null {
  const o = act1Outcome(s);
  if (!o.judged || o.goals.length === 0) return null;
  const place = PLACE[s.scenarioId] ?? 'place';
  const env = o.goals.find((g) => g.bonus);
  const lines: string[] = [`Boom goals: you met ${o.mainMet} of ${o.mainTotal}.`];
  if (o.careful) lines.push(`You kept the ${place} in good shape${env ? ` (Environment ${Math.round(env.current)})` : ''}, so healing it is easier.`);
  else if (env) lines.push(`Environment ended at ${Math.round(env.current)}, so there is more to heal. That is where the next chapter starts.`);
  return h('div', { class: 'fact', 'data-qa': 'act1-note' }, svg(o.careful ? UI_ICONS.leaf : UI_ICONS.info), h('p', null, lines.join(' ')));
}

/** The report card's badge for a careful Act 1 (stars are unchanged). */
export function act1Badge(s: GameState): HTMLElement | null {
  const o = act1Outcome(s);
  if (!o.careful) return null;
  const env = o.goals.find((g) => g.bonus);
  return h('div', { class: 'badge-careful', 'data-qa': 'badge-careful', title: 'Earned for the boom, before the transition' },
    svg(UI_ICONS.leaf), h('div', null, h('b', null, 'Careful builder'),
      h('div', { style: 'font-size:13px' }, `You grew the town without wrecking it${env ? `: Environment ${Math.round(env.current)} at the end of the boom` : ''}.`)));
}
