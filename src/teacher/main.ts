// Teacher guide (teacher.html): the static guide plus the parts that must match the game's own data — each
// scenario's goals, difficulty and play time, the reflection prompts and the "Simplified!" notes.
import './teacher.css';
import { REFLECTIONS, LETTER_PROMPT } from '../content/report';
import { SIMPLIFIED } from '../content/simplified';
import { getScenario, SCENARIO_IDS } from '../sim/scenarios';
import type { ScenarioId } from '../sim/types';

interface ScenarioNotes {
  setting: string;
  science: string[];
  dotPoints: string;
  discussion: string[];
  reflect: string;
}

/** Authored per-scenario notes (the goals themselves come from the scenario data). */
const NOTES: Record<ScenarioId, ScenarioNotes> = {
  'green-valley': {
    setting: 'A small inland valley, 1960–2040. A guide walks students through building, power, pollution, restoring land and recycling an old site, one step at a time. In the boom (1960–2020) the goals are to grow to 200 people with 120 jobs and power for every building, with a bonus badge for keeping Environment at 60 or more. Six decision cards (clearing a hillside, fertiliser, a tip, a dry year, solar panels and the factory waste) each put money on both sides, and from 1970 students can pay to upgrade buildings (smoke scrubber, creek buffer, filters, landfill liner, dust suppression). The Act 2 goals stay hidden until the turning point.',
    science: ['Sustainability means the environment, society and economy together', 'Local pollution (smoke, dust, runoff) is a different problem from greenhouse gas: a smoke scrubber cleans the air but does not cut CO₂', 'Trade-offs have a price on both sides: clearing land or heavy fertiliser pays now and costs the creek later', 'Clean power can replace coal, but needs the right site', 'Polluted soil and water recover slowly once the source stops', 'Animals return when habitat and clean water return'],
    dotPoints: '4.1.1, 4.2.5, 4.4.1, 4.4.3',
    discussion: ['Which card paid you the most money, and what did it cost the creek, the bush or the birds?', 'Your factory had a smoke scrubber. Did your CO₂ fall? Why not?', 'Which meter was hardest to keep up, and why?', 'Why did the land take years to heal after the pollution stopped?', 'What did you need before the animal came back?'],
    reflect: 'What is one thing you would do differently in the next town?',
  },
  'coal-coast': {
    setting: 'An Illawarra-style steel and coal town, 1850–2100. The turning point is a fish kill in the estuary in the heat ("The estuary goes quiet").',
    science: ['Industrialisation and rising temperature (the student draws the curve)', 'Enhanced greenhouse effect and committed warming', 'Runoff, sewage and heat cause fish kills', 'Repurposing and recycling old industry (waste hierarchy, green steel)', 'Cultural burning and co-management (draft content)', 'Koalas need connected woodland; turtles need dark, clean beaches'],
    dotPoints: '4.2.4, 4.2.5, 4.2.6, 4.4.1, 4.4.2, 4.4.3–4.4.5',
    discussion: ['The cheapest buildings were the dirtiest. Was that fair to the people of 1900? To the people of 2025?', 'Your emissions fell quickly in Act 2 but warming kept rising for years. Why?', 'Mick the steelworker and Lena the fisher wanted different things. How did you decide?'],
    reflect: 'Which decision are you proudest of? Who did it help, and who did it cost?',
  },
  'river-town': {
    setting: 'A Murray–Darling irrigation town, 1880–2100. The turning point is the river stopping in a drought ("The river stops").',
    science: ['Droughts and warming reduce river flow (the water cycle)', 'Sharing water between the town, the farms and the environment', 'Irrigation brings salt to the surface; nutrients feed blue-green algae', 'Environmental flows, fishways and riverbank plants', 'Drought planning: bank water in wet years, restrict use in dry ones', 'Platypus need clean, flowing water and vegetated banks'],
    dotPoints: '4.2.1, 4.3.3, 4.4.1, 4.1.2',
    discussion: ['Who should get the last of the water in a drought: the town, the farms or the river? Does your answer change if you are a farmer?', 'Why does the drought plan work better if it is switched on before the drought?', 'Why is the river goal judged on a ten-year average instead of one year?'],
    reflect: 'What did you learn from listening to people whose view of the river was different from yours?',
  },
  'reef-island': {
    setting: 'A tropical island town beside a coral reef, 1900–2100. The turning point is a mass bleaching event ("The reef turns white").',
    science: ['Marine heatwaves bleach coral; clean water helps coral cope', 'Sea-level rise makes storm surges reach further', 'Mangroves soften waves; seawalls can shrink beaches', 'Satellites warn of marine heatwaves before they arrive', 'Crown-of-thorns starfish outbreaks and nutrient runoff', 'Turtle hatchlings are lost to artificial light'],
    dotPoints: '4.3.1, 4.3.2, 4.3.4, 4.4.1',
    discussion: ['The island cannot stop global warming by itself. So why does local action matter for the reef?', 'Seawall, mangroves or moving homes: which is fairest to the families on the low belt?', 'How did the satellite warnings change what you did?'],
    reflect: 'What would you tell the island\'s children about the reef they will grow up with?',
  },
  'red-dirt': {
    setting: 'An outback mining town, 1890–2100. The turning point is a nine-day heatwave that trips the grid ("The week the town stopped").',
    science: ['Solar power and storage in a sunny, remote place', 'Groundwater (aquifers) refill very slowly', 'Heatwaves, health and remote communities', 'Mine rehabilitation: reshape, topsoil, seed, monitor', 'Working with Traditional Owners on an agreed plan (draft content)', 'Net zero by 2060 (a simplified line)'],
    dotPoints: '4.2.5, 4.3.3, 4.4.1, 4.4.2',
    discussion: ['The mine gave the town its jobs and took its water. How do you close a mine fairly?', 'Why does the rehabilitation plan need the Traditional Owners, not just engineers?', 'Is a 100% renewable grid worth the extra cost here? Why or why not?'],
    reflect: 'Which warning signs did you see first, and what would have helped the most, and when?',
  },
  'net-zero-city': {
    setting: 'A large coastal city that starts in 2025 (no Act 1). Net zero by 2050 on a tight budget, with heatwaves that hurt the most vulnerable people first ("Forty-seven degrees").',
    science: ['Emissions by sector: power, industry, transport, homes', 'Order of operations: clean power first, then the slow jobs early', 'Cost-effectiveness: dollars per tonne of CO₂ cut', 'Urban heat islands, street trees, cooling centres and heat equity', 'Public transport and home retrofits', 'Net zero as a target held every year'],
    dotPoints: '4.2.4, 4.2.5, 4.3.2, 4.1.2',
    discussion: ['Why does the city need clean power before batteries help?', 'Retrofitting homes is slow and cheap; offshore wind is fast and expensive. How did you choose?', 'Who was most at risk in heatwaves, and what did the city owe them?'],
    reflect: 'Some choices had no clean answer. Which was hardest, and what made you pick the way you did?',
  },
};

const DIFF_LABEL: Record<string, string> = { tutorial: 'Tutorial', easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string | null, ...kids: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k !== null) e.append(k);
  return e;
}

function list(items: readonly string[]): HTMLUListElement {
  return el('ul', null, ...items.map((t) => el('li', null, t)));
}

function scenarioCards(): void {
  const host = document.getElementById('scenario-cards');
  if (!host) return;
  const order = [...SCENARIO_IDS].sort((a, b) => (a === 'green-valley' ? -1 : b === 'green-valley' ? 1 : 0));
  for (const id of order) {
    const sc = getScenario(id);
    const n = NOTES[id];
    const mins = sc.playMinutes ? `${sc.playMinutes[0]}–${sc.playMinutes[1]} min` : '';
    const span = sc.prebuilt ? `${sc.act2.startYear}–${sc.act2.endYear}` : `${sc.startYear}–${sc.act2.endYear}`;
    const goals = sc.act2.objectives.filter((o) => !o.bonus).map((o) => o.label.replace(/(\d) C\b/g, '$1 °C'));
    const bonus = sc.act2.objectives.filter((o) => o.bonus).map((o) => o.label);
    host.append(el('article', 'card scen',
      el('header', 'scen-head', el('h3', null, sc.name), el('span', `badge ${sc.difficulty}`, DIFF_LABEL[sc.difficulty] ?? sc.difficulty),
        el('span', 'meta', `${span} · about ${mins} · ${sc.mapW}×${sc.mapH} map`)),
      el('p', null, n.setting),
      el('div', 'cols',
        el('div', null, el('h4', null, `Goals to win (by ${sc.act2.endYear})`), list(goals), bonus.length ? el('p', 'small', el('b', null, 'Bonus star: '), bonus.join('; ')) : null,
          el('p', 'small', 'Stars: one for the goals, two with the bonus, three when every resident\'s story also ends well.')),
        el('div', null, el('h4', null, 'Key science'), list(n.science), el('p', 'small', el('b', null, 'Dot points: '), n.dotPoints))),
      el('div', 'cols',
        el('div', null, el('h4', null, 'Discussion questions'), el('ol', null, ...n.discussion.map((q) => el('li', null, q)))),
        el('div', null, el('h4', null, 'Reflection prompt'), el('p', null, n.reflect)))));
  }
}

function reflections(): void {
  const host = document.getElementById('reflections');
  if (!host) return;
  for (const r of REFLECTIONS) host.append(el('li', null, r.text));
  host.append(el('li', null, el('b', null, 'Letter: '), LETTER_PROMPT));
}

function simplified(): void {
  const host = document.getElementById('simplified');
  if (!host) return;
  for (const n of SIMPLIFIED) {
    host.append(el('div', 'card simp',
      el('h3', null, n.title, n.dotPoints?.length ? el('span', 'dp', n.dotPoints.join(', ')) : null),
      el('p', null, el('b', null, 'In the game: '), n.game),
      el('p', null, el('b', null, 'In reality: '), n.reality)));
    (host.lastElementChild as HTMLElement).id = `simplified-${n.id}`;
  }
}

scenarioCards();
reflections();
simplified();
