// "My household" page and the printable report (WP8d). Both read the state; ticks and reflections are saved through the
// controller (the `learn` action), so they survive a reload and go on the printed page.
import { HOUSEHOLD_AREAS, HOUSEHOLD_INTRO, HOUSEHOLD_NOTE } from '../content/household';
import { capacityReport } from '../sim/capacity';
import { learnOf, signalBand } from '../sim/fieldkit';
import { getScenario } from '../sim/scenarios';
import { EMISSION_CATEGORIES } from '../sim/types';
import type { GameState } from '../sim/types';
import { CAT_NAME } from './graphs';
import { degC, fmt1, fmtInt, h, svg } from './dom';
import { LEARN_ICONS } from './learnicons';
import { openModal } from './modal';
import type { ReportCard } from './types';

export interface LearnHooks {
  tick(id: string, on: boolean): void;
  openPrint(): void;
}

/** What the town did, in numbers, for each household area (from the finished run). */
function townNumber(s: GameState, area: string): string | null {
  const last = s.history[s.history.length - 1];
  const rep = capacityReport(s);
  const line = (id: string): string | null => {
    const l = rep.lines.find((x) => x.id === id);
    return l ? `${Math.round(l.ratio * 100)}% of what the land renews` : null;
  };
  switch (area) {
    case 'transport': {
      const y = s.a2.yearly[s.a2.yearly.length - 1];
      const t = y?.emissionsKt.transport ?? last?.emissionsKt.transport;
      return t !== undefined ? `Transport added about ${fmtInt(t)} kt of CO₂ in the last ${s.a2.yearly.length ? 'year' : 'decade'} on record.` : null;
    }
    case 'food': return `Food and farmland ended at ${line('food')}, and fish and timber at ${line('harvest')}.`;
    case 'energy': {
      const share = s.a2.lastGrid?.renewableShare;
      return share !== undefined ? `At the end, ${Math.round(share * 100)}% of the town's power came from renewables.` : null;
    }
    case 'water': return `Water use ended at ${line('water')}.`;
    case 'waste': {
      const w = last?.emissionsKt.waste;
      return w !== undefined ? `Waste added about ${fmtInt(w)} kt of CO₂ in the first decade on record, and the town's rubbish is the biggest cause of methane.` : null;
    }
    default: return null;
  }
}

export function showHousehold(s: GameState, hooks: LearnHooks, onDone?: () => void): void {
  const ticked = new Set(learnOf(s).household);
  const sc = getScenario(s.scenarioId);
  const count = h('span', { class: 'hh-count', 'data-qa': 'hh-count' });
  const upd = (): void => { count.textContent = `${ticked.size} idea${ticked.size === 1 ? '' : 's'} ticked`; };
  upd();
  const m = openModal([
    h('div', { class: 'kicker' }, `${sc.name} · My household`),
    h('h2', null, 'What about my own home?'),
    h('p', null, HOUSEHOLD_INTRO[s.scenarioId]),
    ...HOUSEHOLD_AREAS.map((a) => h('div', { class: 'hh-area', 'data-area': a.id },
      h('h4', null, a.title),
      h('p', { style: 'margin:2px 0' }, a.link),
      townNumber(s, a.id) ? h('p', { class: 'hh-town' }, svg(LEARN_ICONS.chain), h('span', null, degC(townNumber(s, a.id) as string))) : null,
      h('p', { class: 'muted', style: 'margin:2px 0 4px;font-size:13px' }, a.why),
      h('div', { class: 'hh-ideas' }, ...a.ideas.map((i) => {
        const box = h('input', { type: 'checkbox', id: `hh-${i.id}`, 'data-idea': i.id }) as HTMLInputElement;
        box.checked = ticked.has(i.id);
        box.addEventListener('change', () => { if (box.checked) ticked.add(i.id); else ticked.delete(i.id); hooks.tick(i.id, box.checked); upd(); });
        return h('label', { class: 'hh-idea', for: `hh-${i.id}` }, box, h('span', null, i.text));
      })))),
    h('p', { class: 'muted', style: 'font-size:13px' }, HOUSEHOLD_NOTE),
    h('div', { class: 'modal-actions' }, count,
      h('button', { class: 'btn', onclick: () => hooks.openPrint() }, svg(LEARN_ICONS.printer), 'Print my report'),
      h('button', { class: 'btn primary', onclick: () => m.close() }, 'Done')),
  ], { wide: true, onClose: onDone });
}

// ---------------------------------------------------------------- printable report
const ymd = (): string => new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

export function buildPrintSheet(s: GameState, rc: ReportCard | undefined): HTMLElement {
  const sc = getScenario(s.scenarioId);
  const L = learnOf(s);
  const last = s.a2.yearly[s.a2.yearly.length - 1];
  const rep = capacityReport(s);
  const failed = s.phase === 'failed';
  const asked = (rc?.reflection?.length ? rc.reflection : ['What would you tell Sam and Jordan about the world you left them?']);
  const kit = L.kit.filter((r) => !r.auto).slice(-6);
  const decisions = s.dilemmas.decisions.filter((d) => d.optionId !== 'ignored').slice(-12);
  const sheet = h('div', { class: 'print-sheet', 'data-qa': 'print-sheet' },
    h('h1', null, 'Carrying Capacity'),
    h('h2', null, `${sc.name}: my report`),
    h('p', { class: 'print-meta' }, `${ymd()} · ${failed ? `The town could not hold on in ${s.year}` : `Ended ${s.year}`} · ${rc ? `${rc.stars} of 3 stars` : ''}`),
    rc ? h('div', null, h('h3', null, rc.title),
      h('table', { class: 'print-table' }, h('tbody', null, ...rc.items.map((it) => h('tr', null, h('th', null, it.grade), h('td', null, h('b', null, it.label), it.detail ? h('div', null, it.detail) : null)))))) : null,
    h('h3', null, 'The numbers'),
    h('table', { class: 'print-table' }, h('tbody', null,
      h('tr', null, h('th', null, 'Warming'), h('td', null, `+${fmt1(s.tempC)} °C (CO₂ ${s.co2.toFixed(0)} ppm)`)),
      h('tr', null, h('th', null, 'Meters'), h('td', null, `Environment ${Math.round(s.meters.environment)} · Society ${Math.round(s.meters.society)} · Economy ${Math.round(s.meters.economy)}`)),
      h('tr', null, h('th', null, 'People'), h('td', null, fmtInt(s.population))),
      last ? h('tr', null, h('th', null, 'Emissions, last year'), h('td', null, EMISSION_CATEGORIES.map((c) => `${CAT_NAME[c]} ${fmtInt(last.emissionsKt[c])} kt`).join(' · '))) : null,
      h('tr', null, h('th', null, 'Land limits'), h('td', null, rep.lines.filter((l) => !l.external).map((l) => `${l.label} ${Math.round(l.ratio * 100)}%`).join(' · '))))),
    kit.length ? h('div', null, h('h3', null, 'My water tests'),
      h('table', { class: 'print-table small' }, h('thead', null, h('tr', null, ...['Year', 'Oxygen %', 'Nitrogen', 'Phosphorus', 'Mud (NTU)', 'pH', 'Salt', 'Bug score'].map((x) => h('th', null, x)))),
        h('tbody', null, ...kit.map((r) => { const v = (id: string): string => String(r.indicators.find((i) => i.id === id)?.value ?? ''); return h('tr', null, h('td', null, String(r.year)), h('td', null, v('do')), h('td', null, v('tn')), h('td', null, v('tp')), h('td', null, v('turb')), h('td', null, v('ph')), h('td', null, v('ec')), h('td', null, `${r.signal.toFixed(1)} (${signalBand(r.signal).label})`)); }))),
      ...L.predictions.filter((p) => p.resolvedYear !== undefined).slice(-4).map((p) => h('p', null, `Prediction ${p.year}: ${p.choice ?? 'no pick'}${p.text ? ` ("${p.text}")` : ''}. Result: ${p.actual}, bug score ${p.baseSignal.toFixed(1)} to ${(p.resultSignal ?? 0).toFixed(1)}.`))) : null,
    decisions.length ? h('div', null, h('h3', null, 'Big decisions I made'), h('ul', null, ...decisions.map((d) => h('li', null, `${d.year}: ${d.title} — ${d.optionLabel}${d.evidenceBacked ? ' (followed the evidence)' : ''}`)))) : null,
    h('h3', null, 'My thinking'),
    ...asked.map((q) => h('div', { class: 'print-q' }, h('b', null, q), h('p', { class: 'print-a' }, L.reflections[q] || (/letter/i.test(q) ? L.letter : '') || '(not answered)'))),
    L.letter && !asked.some((q) => /letter/i.test(q)) ? h('div', { class: 'print-q' }, h('b', null, 'My letter'), h('p', { class: 'print-a' }, L.letter)) : null,
    h('h3', null, 'My household'),
    HOUSEHOLD_AREAS.flatMap((a) => a.ideas).filter((i) => L.household.includes(i.id)).length
      ? h('ul', null, ...HOUSEHOLD_AREAS.flatMap((a) => a.ideas).filter((i) => L.household.includes(i.id)).map((i) => h('li', null, i.text)))
      : h('p', { class: 'print-a' }, '(none ticked yet)'),
    h('p', { class: 'print-foot' }, 'Carrying Capacity is a game. Its numbers are a simple model of a real town, made for learning. Water guide values: ANZECC/ARMCANZ (2000) defaults, as quoted by NSW Environment and Heritage. Land limits are the game\'s own estimates.'));
  return sheet;
}

/** Shows the printable report on screen with Print and Close buttons; the print stylesheet prints only the sheet. */
export function openPrintReport(s: GameState, rc: ReportCard | undefined): void {
  const sheet = buildPrintSheet(s, rc);
  const wrap = h('div', { class: 'print-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Printable report' },
    h('div', { class: 'print-bar' },
      h('b', null, 'Printable report'),
      h('button', { class: 'btn primary', 'data-qa': 'print-go', onclick: () => window.print() }, svg(LEARN_ICONS.printer), 'Print or save as PDF'),
      h('button', { class: 'btn', onclick: () => { wrap.remove(); document.body.classList.remove('printing'); } }, 'Close')),
    sheet);
  document.body.classList.add('printing');
  document.body.appendChild(wrap);
  window.addEventListener('afterprint', () => { /* keep the sheet open so it can be printed again */ }, { once: true });
}
