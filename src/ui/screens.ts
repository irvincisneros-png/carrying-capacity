// Full-screen flows: title + scenario select, intro (Acknowledgement of Country), decade report, present-day
// summary + turning point story, epilogue / failure, settings.
import { metricValue, objectiveStatus } from '../sim/objectives';
import { SCENARIOS, SCENARIO_IDS, getScenario } from '../sim/scenarios';
import { MAX_STARS, isScenarioUnlocked, loadProgress, lockedReason, starsOf, totalStars, type Progress } from '../sim/progress';

export function loadProgressSafe(): Progress {
  try { return loadProgress(localStorage); } catch { return loadProgress(null); }
}
import { EMISSION_CATEGORIES, type DecadeReport, type GameState, type ScenarioId } from '../sim/types';
import type { GameRenderer } from '../render/renderer';
import { TIER_NAMES, type Tier } from '../render/quality';
import { isMuted, setMuted, sfx, unlockAudio } from '../audio/sfx';
import { degC, fmt1, fmtInt, h, svg } from './dom';
import { CAT_COL, CAT_NAME, GraphsPanel } from './graphs';
import { bIcon, UI_ICONS } from './icons';
import { openModal, type ModalHandle } from './modal';
import { objectiveRow } from './act2';
import { portrait, reportCardView, speakerFrom } from './empathy';
import type { ReportCard, Speaker } from './types';
import { CAST } from '../content/residents';

const SCEN_ICON: Record<ScenarioId, string> = {
  'green-valley': UI_ICONS.sprout,
  'coal-coast': bIcon('steelworks'),
  'river-town': bIcon('farm'),
  'reef-island': UI_ICONS.coral,
  'red-dirt': bIcon('coalmine'),
  'net-zero-city': bIcon('suburb'),
};

export const ACK =
  'We acknowledge the Traditional Custodians of the lands and waters this game imagines, and pay our respects to Elders past and present. ' +
  'Aboriginal and Torres Strait Islander peoples have cared for Country for tens of thousands of years.';

// ---------------------------------------------------------------- title
export interface TitleHandlers {
  continueGame(): void;
  newGame(id: ScenarioId): void;
  settings(): void;
  skipTutorial(): Progress;
}

export function showTitle(hd: TitleHandlers, saved: { scenarioId: ScenarioId; year: number; phase: string } | null, teacher: boolean, progress: Progress): HTMLElement {
  const root = h('div', { class: 'title' });
  const logo = h('div', { class: 'logo' }, h('h1', null, 'Carrying Capacity'), h('p', null, 'Build a town. Watch the air. Then help the land heal.'));
  const card = h('div', { class: 'title-card panel' });
  const main = (): void => {
    card.replaceChildren(...[
      saved ? h('button', { class: 'btn primary', onclick: () => { unlockAudio(); sfx('click'); hd.continueGame(); } }, svg(UI_ICONS.play), `Continue · ${SCENARIOS[saved.scenarioId]?.name ?? ''} ${saved.year}`) : null,
      h('button', { class: `btn ${saved ? '' : 'primary'}`, onclick: () => { unlockAudio(); sfx('click'); pick(); } }, svg(UI_ICONS.sprout), 'New game'),
      h('div', { class: 'title-foot' },
        h('button', { class: 'btn small ghost', onclick: () => hd.settings() }, svg(UI_ICONS.gear), 'Settings'),
        h('span', { class: 'muted', style: 'font-size:12px;margin-left:auto;align-self:center' }, 'Year 9 Science · Environmental sustainability')),
    ].filter((x): x is HTMLButtonElement | HTMLDivElement => x !== null));
  };
  const pick = (): void => {
    const names = Object.fromEntries(SCENARIO_IDS.map((id) => [id, SCENARIOS[id].name])) as Record<ScenarioId, string>;
    const order = [...SCENARIO_IDS].sort((a, b) => (a === 'green-valley' ? -1 : b === 'green-valley' ? 1 : 0));
    const starRow = (n: number): HTMLElement => h('span', { class: 'stars-s' }, ...[0, 1, 2].map((i) => svg(i < n ? UI_ICONS.star : UI_ICONS.starOff)));
    card.replaceChildren(...[
      h('div', { class: 'panel-head' }, h('h2', { style: 'font-size:22px' }, 'Choose a place'),
        h('span', { class: 'star-total', title: 'Stars earned' }, svg(UI_ICONS.star), `${totalStars(progress)} / ${MAX_STARS}`)),
      h('div', { class: 'scen-list' }, ...order.map((id) => {
        const sc = SCENARIOS[id];
        const ok = isScenarioUnlocked(progress, id, teacher);
        const why = ok ? null : lockedReason(progress, id, names, teacher);
        const mins = sc.playMinutes ? `${sc.playMinutes[0]}–${sc.playMinutes[1]} min` : '';
        return h('button', { class: 'scen', disabled: !ok, onclick: () => { sfx('click'); hd.newGame(id); } },
          svg(ok ? SCEN_ICON[id] : UI_ICONS.lock),
          h('div', { style: 'flex:1' }, h('h3', null, sc.name, h('span', { class: `badge ${sc.difficulty}` }, sc.difficulty)),
            h('p', null, sc.blurb),
            h('div', { class: 'meta' }, mins ? h('span', null, `⏱ ${mins}`) : null, h('span', null, `${sc.mapW}×${sc.mapH} map`), starsOf(progress, id) > 0 ? starRow(starsOf(progress, id)) : null),
            why ? h('p', { style: 'font-weight:800;margin-top:4px' }, why) : null));
      })),
      !isScenarioUnlocked(progress, 'coal-coast', teacher)
        ? h('button', { class: 'btn small ghost', onclick: () => { progress = hd.skipTutorial(); pick(); } }, 'I have played before: skip the tutorial')
        : null,
      h('button', { class: 'btn ghost small', onclick: main }, '← Back'),
    ].filter((x) => x !== null) as HTMLElement[]);
  };
  main();
  root.append(logo, card);
  return root;
}

// ---------------------------------------------------------------- intro
export function showIntro(s: GameState, onGo: () => void): void {
  const sc = getScenario(s.scenarioId);
  const act2Start = s.phase === 'act2';
  const m = openModal([
    h('div', { class: 'kicker' }, `${sc.name} · ${sc.startYear}`),
    h('h2', null, act2Start ? `It's ${s.year}. The city is already here.` : `It's ${sc.startYear}.`),
    h('p', null, sc.blurb),
    act2Start
      ? h('p', null, `There is no boom to play through: ${sc.name} starts in the transition. Time runs season by season to ${sc.act2.endYear}. Cut emissions fast, keep people safe in the heat, and keep the city on side.`)
      : h('p', null, `Your job: grow this settlement into a thriving town, one decade at a time, all the way to ${sc.endYear}. People need homes, jobs and power. Every choice changes the land, the water and the air.`),
    h('p', null, h('b', null, 'Watch what happens to the air.'), ' The graphs track the CO₂ your town adds and how the world warms.'),
    goalsBox(sc, act2Start),
    h('div', { class: 'stat-grid' },
      h('div', { class: 'stat' }, h('small', null, 'Build'), h('div', { style: 'font-size:13px' }, 'Pick a building below, then click the map. ', h('kbd', null, 'R'), ' rotates.')),
      h('div', { class: 'stat' }, h('small', null, 'Look around'), h('div', { style: 'font-size:13px' }, 'Drag to pan, right-drag or ', h('kbd', null, 'Q'), h('kbd', null, 'E'), ' to turn, scroll to zoom.')),
      act2Start
        ? h('div', { class: 'stat' }, h('small', null, 'Time'), h('div', { style: 'font-size:13px' }, 'Pause with ', h('kbd', null, 'Space'), ' to plan; speed up with the clock buttons.'))
        : h('div', { class: 'stat' }, h('small', null, 'Time'), h('div', { style: 'font-size:13px' }, 'Press ', h('b', null, 'Next decade'), ' when you are ready.'))),
    h('p', { class: 'ack' }, ACK),
    h('div', { class: 'modal-actions' }, h('button', { class: 'btn primary', onclick: () => { m.close(); } }, 'Let\'s build')),
  ], { onClose: onGo });
}

/** The scenario's win condition, up front, so the whole game has a clear goal from the first click. */
function goalsBox(sc: ReturnType<typeof getScenario>, act2Start: boolean): HTMLElement {
  const main = sc.act2.objectives.filter((o) => !o.bonus);
  const bonus = sc.act2.objectives.filter((o) => o.bonus);
  return h('div', { class: 'fact', style: 'display:block' },
    h('b', null, act2Start ? `To win, by ${sc.act2.endYear}:` : `Then the real test: from ${sc.act2.startYear} to ${sc.act2.endYear}, turn the town around. To win:`),
    h('ul', { style: 'margin:6px 0 0 18px;padding:0' }, ...main.map((o) => h('li', null, degC(o.label)))),
    bonus.length ? h('p', { class: 'muted', style: 'margin:6px 0 0;font-size:13px' }, `Bonus star: ${bonus.map((o) => degC(o.label)).join('; ')}.`) : null);
}

// ---------------------------------------------------------------- decade report
export function showDecadeReport(r: DecadeReport, onClose: () => void): ModalHandle {
  const total = r.totalKt;
  const bars = h('div', { class: 'emis-bars' }, ...EMISSION_CATEGORIES.filter((c) => r.emissionsKt[c] > 0).map((c) => h('i', { style: `width:${(r.emissionsKt[c] / Math.max(1, total)) * 100}%;background:${CAT_COL[c]}`, title: `${CAT_NAME[c]}: ${r.emissionsKt[c].toFixed(0)} kt` })));
  const md = (k: 'environment' | 'society' | 'economy', label: string): HTMLElement => {
    const d = Math.round(r.meterDeltas[k]);
    return h('div', { class: 'stat' }, h('small', null, label), h('b', null, String(Math.round(r.meters[k]))), d ? h('span', { class: `d ${d > 0 ? 'up' : 'down'}` }, d > 0 ? `+${d}` : String(d)) : null);
  };
  const m = openModal([
    h('div', { class: 'kicker' }, `${r.fromYear} – ${r.toYear}`),
    h('h2', null, r.actComplete ? 'The present day' : `Welcome to the ${r.toYear}s`),
    h('div', { class: 'stat-grid' },
      h('div', { class: 'stat' }, h('small', null, 'Emitted this decade'), h('b', null, `${fmtInt(total)} kt`)),
      h('div', { class: 'stat' }, h('small', null, 'CO₂ in the air'), h('b', null, `${r.co2Ppm.toFixed(0)}`), h('span', { class: `d ${r.deltaCo2 > 0 ? 'down' : 'up'}` }, `${r.deltaCo2 >= 0 ? '+' : ''}${r.deltaCo2.toFixed(1)} ppm`)),
      h('div', { class: 'stat' }, h('small', null, 'Warming'), h('b', null, `${r.tempC >= 0 ? '+' : ''}${fmt1(r.tempC)} °C`), h('span', { class: 'd muted' }, `real: ${fmt1(r.realTempC)}`)),
      h('div', { class: 'stat' }, h('small', null, 'Income'), h('b', null, `$${fmtInt(r.income)}k`)),
      h('div', { class: 'stat' }, h('small', null, 'People'), h('b', null, fmtInt(r.population)))),
    total > 0 ? h('div', null, h('div', { class: 'graph-title' }, 'Where the emissions came from', h('span', null, `biggest: ${CAT_NAME[r.topSource]}`)), bars,
      h('div', { class: 'legend' }, ...EMISSION_CATEGORIES.filter((c) => r.emissionsKt[c] > 0).map((c) => h('span', null, h('i', { style: `background:${CAT_COL[c]}` }), `${CAT_NAME[c]} ${r.emissionsKt[c].toFixed(0)}`)))) : null,
    h('div', { class: 'stat-grid' }, md('environment', 'Environment'), md('society', 'Society'), md('economy', 'Economy')),
    !r.actComplete && r.demand ? h('div', { class: 'stat', style: 'background:#fff1d6' }, h('small', null, 'What the town needs now'), h('div', { style: 'font-weight:700' }, r.demand)) : null,
    r.fact ? h('div', { class: 'fact' }, svg(UI_ICONS.info), h('p', null, h('b', null, `Did you know? (${r.fact.year}) `), degC(r.fact.text))) : null,
    h('div', { class: 'modal-actions' }, h('button', { class: 'btn primary', onclick: () => m.close() }, r.actComplete ? 'See where you ended up' : 'Keep building')),
  ], { onClose });
  return m;
}

// ---------------------------------------------------------------- present day + turning point
export function showTurningPoint(s: GameState, onBegin: () => void, storyOnly = false): void {
  const tp = s.turningPoint;
  const last = s.history[s.history.length - 1];
  const sources = last ? [...EMISSION_CATEGORIES].map((c) => ({ c, v: s.history.reduce((n, r) => n + r.emissionsKt[c], 0) })).sort((a, b) => b.v - a.v).slice(0, 3) : [];
  const prompts = [
    'Which buildings caused most of your emissions?',
    'How does your temperature curve compare with the real one?',
    'What would you change if you did it again?',
  ];
  const step1 = (): void => {
    const m = openModal([
      h('div', { class: 'kicker' }, `Present day · ${s.year}`),
      h('h2', null, 'Look what you built'),
      h('p', null, `From a handful of cottages in ${getScenario(s.scenarioId).startYear} to a town of ${fmtInt(s.population)} people. Here are the graphs your town drew, beside the real-world record.`),
      GraphsPanel.staticGraphs(s),
      h('div', { class: 'stat-grid' },
        h('div', { class: 'stat' }, h('small', null, 'Environment'), h('b', null, String(Math.round(s.meters.environment)))),
        h('div', { class: 'stat' }, h('small', null, 'Society'), h('b', null, String(Math.round(s.meters.society)))),
        h('div', { class: 'stat' }, h('small', null, 'Economy'), h('b', null, String(Math.round(s.meters.economy)))),
        h('div', { class: 'stat' }, h('small', null, 'Top 3 sources'), h('div', { style: 'font-size:13px;font-weight:800' }, sources.map((x) => `${CAT_NAME[x.c]} ${fmtInt(x.v)} kt`).join(' · ')))),
      h('h3', { style: 'margin-top:8px' }, 'Think about it'),
      ...prompts.map((p) => h('div', { style: 'margin-top:8px' }, h('b', { style: 'font-size:14px' }, p), h('textarea', { class: 'reflect', rows: 2, placeholder: 'Your thoughts (copy these into your workbook)' }))),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn primary', onclick: () => { m.close(); step2(); } }, 'Continue')),
    ], { wide: true, closable: false });
  };
  const step2 = (): void => {
    if (!tp) { onBegin(); return; }
    const res = castSpeaker(s.scenarioId, tp.residentId);
    const sci = castSpeaker(s.scenarioId, SCIENCE_VOICE[s.scenarioId]);
    // The stat that matters most here (estuary health is meaningless on a map with no estuary).
    const mv = (m: Parameters<typeof metricValue>[1]): number => { try { return metricValue(s, m) ?? 0; } catch { return 0; } };
    const [waterLabel, waterVal] = s.scenarioId === 'river-town' ? ['River health', mv('riverHealth')]
      : s.scenarioId === 'red-dirt' ? ['Aquifer', mv('aquifer')]
        : s.scenarioId === 'coal-coast' ? ['Estuary health', tp.stats.estuaryHealth]
          : ['Environment', s.meters.environment];
    sfx('event');
    const m = openModal([
      h('div', { class: 'kicker' }, 'Turning point'),
      h('h2', null, tp.title),
      h('div', { style: 'display:flex;gap:12px;align-items:flex-start;margin:10px 0' }, portrait(res, 52), h('p', { style: 'margin:0' }, degC(tp.text))),
      h('div', { class: 'stat-grid' },
        h('div', { class: 'stat' }, h('small', null, waterLabel), h('b', null, `${Math.round(waterVal)}`), h('span', { class: 'd muted' }, '/100')),
        h('div', { class: 'stat' }, h('small', null, 'Bush remaining'), h('b', null, `${Math.round(tp.stats.bushRemaining * 100)}%`)),
        h('div', { class: 'stat' }, h('small', null, 'Warming'), h('b', null, `+${fmt1(tp.stats.tempC)} °C`))),
      h('div', { class: 'fact' }, portrait(sci, 40), h('p', null, h('b', null, sci.name), sci.role ? h('span', { class: 'muted' }, ` · ${sci.role}`) : null, h('br'), degC(tp.scientistNote))),
      h('p', null, h('b', null, 'Act 2: Transition. '), `Time now runs by itself, season by season, to ${getScenario(s.scenarioId).act2.endYear}. Clean up the power, heal the land and water, and keep people with you.`),
      (() => { const a2 = getScenario(s.scenarioId).act2; return a2.carryOverCap !== undefined && s.budget > a2.carryOverCap && a2.carryOverNote ? h('p', { class: 'muted' }, a2.carryOverNote) : null; })(),
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn green', 'data-tut': 'start-transition', onclick: () => { m.close(); onBegin(); } }, svg(UI_ICONS.sprout), storyOnly ? 'Get to work' : 'Begin the transition')),
    ], { closable: false });
  };
  if (storyOnly || s.history.length <= 1) step2();
  else step1();
}

/** The person who reads the graphs with the player in each place. */
const SCIENCE_VOICE: Record<ScenarioId, string> = {
  'coal-coast': 'priya-shah', 'green-valley': 'ali-rahman', 'river-town': 'lan-nguyen',
  'reef-island': 'hana-yamamoto', 'red-dirt': 'rohan-mehta', 'net-zero-city': 'aisha-rahman',
};

function castSpeaker(id: ScenarioId, residentId: string): Speaker {
  const r = CAST[id]?.find((c) => c.id === residentId);
  return r ? { id: r.id, name: r.name, role: r.role } : speakerFrom(residentId);
}

// ---------------------------------------------------------------- epilogue / failure
export function showEnding(s: GameState, onTitle: () => void, card?: ReportCard, next?: { label: string; go: () => void } | null, unlockedNote?: string): void {
  const failed = s.phase === 'failed';
  let objs: ReturnType<typeof objectiveStatus> = [];
  try { objs = objectiveStatus(s); } catch { objs = s.a2.outcome?.objectives ?? []; }
  const met = objs.filter((o) => !o.bonus && o.status === 'met').length;
  const req = objs.filter((o) => !o.bonus).length;
  const rc: ReportCard = card ?? {
    title: `${getScenario(s.scenarioId).act2.endYear} Report Card`,
    stars: failed ? 0 : s.a2.outcome?.success ? (objs.some((o) => o.bonus && o.status === 'met') ? 2 : 1) : 0,
    items: objs.map((o) => ({ label: degC(o.label), grade: o.status === 'met' ? 'A' : o.status === 'pending' ? '–' : o.status === 'missed' ? 'D' : 'C', ok: o.status === 'met' || o.status === 'pending', detail: o.current === null ? 'Measured in a later update' : `Ended at ${o.metric === 'warming' ? fmt1(o.current) + ' °C' : Math.round(o.current)}` })),
  };
  openModal([
    h('div', { class: 'kicker' }, failed ? `The town couldn't hold on · ${s.year}` : `Epilogue · ${s.year}`),
    h('h2', null, failed ? 'The end of the line' : rc.title),
    failed && s.a2.failure ? h('p', null, degC(s.a2.failure.text)) : h('p', null, `You met ${met} of ${req} goals.`),
    reportCardView(rc),
    GraphsPanel.staticGraphs(s),
    h('h3', null, 'Think about it'),
    ...(rc.reflection?.length ? rc.reflection : ['What would you tell Sam and Jordan about the world you left them?']).map((q) =>
      h('div', { style: 'margin-top:8px' }, h('b', { style: 'font-size:14px' }, q), h('textarea', { class: 'reflect', rows: 2, placeholder: 'Your thoughts' }))),
    unlockedNote ? h('div', { class: 'fact', style: 'background:#fff1c8' }, svg(UI_ICONS.star), h('p', null, h('b', null, 'Unlocked: '), unlockedNote)) : null,
    h('div', { class: 'modal-actions' },
      h('button', { class: `btn ${next ? '' : 'primary'}`, onclick: onTitle }, 'Back to title'),
      next ? h('button', { class: 'btn primary', onclick: next.go }, svg(UI_ICONS.play), next.label) : null),
  ], { wide: true, closable: true });
  void objectiveRow;
}

// ---------------------------------------------------------------- settings
export function showSettings(r: GameRenderer, onReset: (() => void) | null): void {
  const tiers = h('div', { class: 'seg' });
  const draw = (): void => {
    tiers.replaceChildren(
      h('button', { class: r.pref.mode === 'auto' ? 'on' : '', onclick: () => { r.setAuto(); draw(); } }, `Auto${r.pref.mode === 'auto' ? ` (${TIER_NAMES[r.tier]})` : ''}`),
      ...TIER_NAMES.map((n, i) => h('button', { class: r.pref.mode === 'manual' && r.tier === i ? 'on' : '', onclick: () => { r.applyTier(i as Tier); draw(); } }, n)));
  };
  draw();
  const snd = h('div', { class: 'seg' });
  const drawSnd = (): void => {
    snd.replaceChildren(
      h('button', { class: !isMuted() ? 'on' : '', onclick: () => { setMuted(false); unlockAudio(); sfx('click'); drawSnd(); } }, 'On'),
      h('button', { class: isMuted() ? 'on' : '', onclick: () => { setMuted(true); drawSnd(); } }, 'Off'));
  };
  drawSnd();
  const m = openModal([
    h('h2', null, 'Settings'),
    h('div', { class: 'settings-row' }, h('div', null, h('b', null, 'Graphics'), h('div', { class: 'muted', style: 'font-size:12px' }, 'Auto picks the best level your computer can run smoothly.')), tiers),
    h('div', { class: 'settings-row' }, h('b', null, 'Sound'), snd),
    h('div', { class: 'settings-row' }, h('div', null, h('b', null, 'Controls'), h('div', { class: 'muted', style: 'font-size:12px;line-height:1.6' },
      'Drag: pan · Right-drag / two fingers: turn · Scroll / pinch: zoom', h('br'), h('kbd', null, 'Q'), ' ', h('kbd', null, 'E'), ' turn 90° · ', h('kbd', null, 'R'), ' rotate building · ', h('kbd', null, 'X'), ' demolish · ', h('kbd', null, 'Esc'), ' cancel · ', h('kbd', null, 'G'), ' graphs · ', h('kbd', null, 'Ctrl Z'), ' undo · ', h('kbd', null, 'Space'), ' pause (Act 2)'))),
    onReset ? h('div', { class: 'settings-row' }, h('div', null, h('b', null, 'Start over'), h('div', { class: 'muted', style: 'font-size:12px' }, 'Deletes your saved game.')), h('button', { class: 'btn small', style: 'background:#f6d2c8;color:#7a1a10', onclick: () => { if (confirm('Delete your saved game and return to the title screen?')) { m.close(); onReset(); } } }, 'Reset game')) : null,
  ]);
}
