/**
 * The data-centre offer (Round 6 WP9, Act 2): a tech company wants to build a large data centre. One card per scenario, built
 * from the same parts. Net Zero City, River Town and Red Dirt place a real building (sim/datacentre.ts) whose electricity,
 * cooling water and waste heat hit the grid, the river or aquifer, and the heat model. Coal Coast and Reef Island get a
 * lighter card with money, a one-off emissions cost and stress, and no building. Facts: docs/research/wp8-wp9-facts.md
 * (AEMO 2026 ESOO, Amazon Australia 2026, NSW Data Centre Policy Framework 2026, Microsoft 2025, Oxford Economics 2025).
 */
import type { DilemmaDef, DilemmaOption, PreviewTarget } from '../../sim/dilemmas';
import type { ScenarioId } from '../../sim/types';

const R = (id: string, why: string): PreviewTarget => ({ type: 'resident', id, why });
const P = (why: string): PreviewTarget => ({ type: 'planet', id: 'planet', why });
const E = (why: string): PreviewTarget => ({ type: 'economy', id: 'economy', why });
const T = (why: string): PreviewTarget => ({ type: 'town', id: 'town', why });

/** The honest core of the evidence: real benefits, real costs, and the NSW conditions. */
const CORE = 'Data centres used about 3% of grid electricity in 2025-26. AEMO expects about 13% by 2035-36, with two-thirds of it in NSW. They power cloud services, banking, health records and climate models, but employ few people once built. NSW\'s 2026 rules ask for new renewable power and recycled water.';

const evidence = (extra: string): string => `${CORE} ${extra}`;

const WATER_NOTE = 'Cooling by evaporating water can use about 1.8 litres per kilowatt-hour. Amazon reports about 0.1 in Sydney by using outside air.';

interface Spec {
  id: ScenarioId;
  speaker: string;
  setup: string;
  extra: string;
  /** True where the building is placed and its impacts are modelled. */
  build: boolean;
  /** dc.cool for the conditions option: 1 recycled water, 2 air cooling. */
  cool: 1 | 2;
  heat: boolean;
  /** Scales the money to the scenario's budget (Net Zero City = 1). */
  scale: number;
  declineWho: PreviewTarget;
  offeredHurts: PreviewTarget[];
  condHelps: PreviewTarget[];
  moods?: { offered?: Record<string, number>; cond?: Record<string, number> };
}

function card(sp: Spec): DilemmaDef {
  const m = sp.moods ?? {};
  // Money scales with the scenario's budget. Where a building is placed, the yearly lease is paid only while that building
  // stands (flag dc.lease, read by sim/datacentre.ts); where it is built elsewhere, it is a plain yearly income.
  const k = (n: number): number => Math.max(1, Math.round(n * sp.scale));
  const upOffered = k(150), yrOffered = k(25), upCond = k(40), yrCond = k(12);
  const flagsOffered = { 'dc.cool': 0, 'dc.ppa': 0, 'dc.heat': 0, 'dc.accepted': 1, 'dc.lease': yrOffered };
  const flagsCond = { 'dc.cool': sp.cool, 'dc.ppa': 1, 'dc.heat': sp.heat ? 1 : 0, 'dc.accepted': 2, 'dc.lease': yrCond };
  const decline: DilemmaOption = {
    id: 'dc-decline', label: 'Decline: they can build somewhere else',
    outcome: 'The company thanks the council and looks at another site. Some people are disappointed about the lost jobs and income. The town\'s power and water stay as they were.',
    effects: { flags: { 'dc.accepted': 0 } },
    preview: { helps: [P('No new demand for power or water'), sp.declineWho], hurts: [E('No lease or rates income'), T('Some jobs and services go elsewhere')] },
  };
  const offered: DilemmaOption = {
    id: 'dc-offered', label: 'Accept the offer as it stands',
    outcome: sp.build
      ? 'The sheds go up on the edge of town. The lease money is welcome. The meters start to turn and keep turning, night and day.'
      : 'The company builds somewhere in the region and signs a big lease. The money is welcome. The power it draws is felt across the grid for years.',
    effects: {
      budget: upOffered, society: -1, stress: 2, ...(sp.build ? { build: 'datacentre' as const, flags: flagsOffered } : { incomePerYear: yrOffered, emissionsKt: 14 }),
      ...(m.offered ? { mood: m.offered } : {}),
    },
    preview: { helps: [E('A big lease and rates bill, paid up front and every year while it operates'), T('A few skilled jobs')], hurts: [P('Large power demand day and night'), ...sp.offeredHurts] },
  };
  const cond: DilemmaOption = {
    id: 'dc-conditions', label: `Accept if it funds new clean power and ${sp.cool === 2 ? 'air-cools' : 'uses recycled water'}${sp.heat ? ', and shares its heat' : ''}`,
    evidenceBacked: true,
    outcome: sp.build
      ? 'The company grumbles, then signs. New panels, turbines and batteries are built for it, so about half its power is new. The town pays for the connections. The lease is smaller once the connections are paid for, and the town has a plan.'
      : 'The company grumbles, then signs. New renewable power is built for it and its cooling uses recycled water. The town pays for the connections. The lease is smaller, and the grid copes.',
    effects: {
      budget: upCond, society: 1, ...(sp.build ? { build: 'datacentre' as const, flags: flagsCond } : { incomePerYear: yrCond, emissionsKt: 4 }),
      ...(m.cond ? { mood: m.cond } : {}),
    },
    preview: { helps: [P('Cuts the demand on the grid and on water'), ...sp.condHelps], hurts: [E('The lease is smaller, and the town pays for the connections'), T('The company may walk away')] },
  };
  return {
    id: 'dc-offer', title: 'A tech company wants a data centre', phase: 'act2', years: [2035, 2070], speaker: sp.speaker, priority: 3, noCleanAnswer: false,
    setup: sp.setup, evidence: evidence(sp.extra), options: [decline, offered, cond],
  };
}

export const DATACENTRE_CARDS: Readonly<Partial<Record<ScenarioId, DilemmaDef>>> = {
  'net-zero-city': card({
    id: 'net-zero-city', scale: 1, speaker: 'aisha-rahman', build: true, cool: 2, heat: true,
    setup: 'A tech company wants to build a large data centre on the edge of the city. It would pay a big lease and rates, but create only a handful of jobs. It would draw power day and night, and give off a lot of heat. The council can say no, say yes, or say yes with conditions.',
    extra: `${WATER_NOTE} Waste heat can warm a pool or homes through heat pumps (Finland, company claims).`,
    declineWho: R('aisha-rahman', 'Emissions stay on track'),
    offeredHurts: [R('dolores-fitzgerald', 'More waste heat in a heatwave'), P('Gas must fill the gaps')],
    condHelps: [R('dolores-fitzgerald', 'Waste heat is put to use'), R('zoe-lin', 'New clean power gets built')],
    moods: { offered: { 'aisha-rahman': -8, 'zoe-lin': -6 }, cond: { 'aisha-rahman': 6, 'zoe-lin': 4 } },
  }),
  'river-town': card({
    id: 'river-town', scale: 0.5, speaker: 'sue-pellegrino', build: true, cool: 1, heat: false,
    setup: 'A tech company wants to build a large data centre by the river. It would pay a big lease and rates, but create only a handful of jobs. It needs a lot of electricity, and water to keep the computers cool. In a dry year that water would come from the same river as the farms.',
    extra: `${WATER_NOTE} Every litre it drinks in a dry year is one the farms and river do not get.`,
    declineWho: R('kerry-brennan', 'The farms keep their water'),
    offeredHurts: [R('kerry-brennan', 'Farms share water with the data centre'), R('lan-nguyen', 'Less water for the river itself')],
    condHelps: [R('kerry-brennan', 'No drinking water or river water used'), R('lan-nguyen', 'The river keeps its share')],
    moods: { offered: { 'kerry-brennan': -8, 'lan-nguyen': -8 }, cond: { 'kerry-brennan': 3, 'lan-nguyen': 3 } },
  }),
  'red-dirt': card({
    id: 'red-dirt', scale: 0.65, speaker: 'rohan-mehta', build: true, cool: 2, heat: false,
    setup: 'A tech company wants to build a large data centre in the desert, where land is cheap and the sun is strong. It would pay a big lease and rates, but create only a handful of jobs. It needs a lot of electricity and, if it cools with water, it would pump it from the same aquifer the town drinks from.',
    extra: `${WATER_NOTE} The aquifer refills slowly. Air cooling uses no water but more power.`,
    declineWho: R('rohan-mehta', 'The aquifer stays healthy'),
    offeredHurts: [R('rohan-mehta', 'The aquifer is drawn down'), R('pete-hanrahan', 'Less water for the station')],
    condHelps: [R('rohan-mehta', 'Air cooling uses almost no water'), P('New solar and batteries get built')],
    moods: { offered: { 'rohan-mehta': -8, 'pete-hanrahan': -5 }, cond: { 'rohan-mehta': 3 } },
  }),
  'coal-coast': card({
    id: 'coal-coast', scale: 0.6, speaker: 'priya-shah', build: false, cool: 1, heat: false,
    setup: 'A tech company wants to build a large data centre in the region and has asked the town to host its connection. It would pay a big lease and rates, but create only a handful of jobs. It would draw a great deal of electricity day and night, and water to keep its computers cool.',
    extra: `${WATER_NOTE} Every big new user makes the clean-power build-out harder.`,
    declineWho: R('priya-shah', 'The grid keeps more clean power'),
    offeredHurts: [R('priya-shah', 'More gas power is needed'), T('Cooling water is drawn from local supply')],
    condHelps: [R('priya-shah', 'New clean power is built for it')],
    moods: { offered: { 'priya-shah': -6 }, cond: { 'priya-shah': 3 } },
  }),
  'reef-island': card({
    id: 'reef-island', scale: 0.8, speaker: 'hana-yamamoto', build: false, cool: 1, heat: false,
    setup: 'A tech company wants to build a data centre on the mainland and run a cable across the island. It would pay a big lease for the cable route and a connection fee, but create only a handful of jobs. The island\'s fragile grid would have to carry more load, and its water is scarce.',
    extra: `${WATER_NOTE} An island has a small grid and little spare water.`,
    declineWho: R('hana-yamamoto', 'The reef is not burdened by more emissions'),
    offeredHurts: [R('hana-yamamoto', 'More emissions and a warmer sea'), T('A small grid carries a big load')],
    condHelps: [R('hana-yamamoto', 'New clean power, recycled water')],
    moods: { offered: { 'hana-yamamoto': -6 }, cond: { 'hana-yamamoto': 3 } },
  }),
};
