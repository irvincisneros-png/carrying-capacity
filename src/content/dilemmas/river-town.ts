/**
 * Dilemma cards for River Town: 4 in Act 1 (weir and channel, red gum clearing, salt, drought rules) and 9 in Act 2,
 * spread across 2025 to 2100. Several have no clean answer on purpose. Each option lists who it helps and hurts,
 * and every card carries an accurate "what does the evidence say?" blurb.
 *
 * Cards that involve Uncle Ray are placeholders that need consultation with the local Aboriginal community.
 */
import { t } from '../../sim/conditions';
import type { DilemmaDef, PreviewTarget } from '../../sim/dilemmas';

const KERRY = 'kerry-brennan';
const RAY = 'uncle-ray';
const SUE = 'sue-pellegrino';
const LAN = 'lan-nguyen';
const KIDS = 'ruby-eli';
const MARG = 'marg-kelly';

const R = (id: string, why: string): PreviewTarget => ({ type: 'resident', id, why });
const C = (id: string, why: string): PreviewTarget => ({ type: 'creature', id, why });
const P = (why: string): PreviewTarget => ({ type: 'planet', id: 'planet', why });
const E = (why: string): PreviewTarget => ({ type: 'economy', id: 'economy', why });
const T = (why: string): PreviewTarget => ({ type: 'town', id: 'town', why });

export const RIVER_TOWN_DILEMMAS: readonly DilemmaDef[] = [
  // ------------------------------------------------------------------------------------------------ Act 1
  {
    id: 'a1-weir', title: 'A weir across the river', phase: 'act1', years: [1890, 1950], speaker: SUE,
    setup: 'The river rises and falls with the seasons, and the first orchardists want water all summer. The council can dam the river with a weir and dig channels to the flats. A weir fills the pool, but fish cannot swim past it, and a fish ladder costs extra.',
    evidence: 'A weir stores water and lifts the river so channels can run by gravity. It also blocks fish that migrate along the river, including Murray cod and golden perch, and changes flows and water temperature downstream. Fishways let many fish pass, but how well they work depends on the design and the species.',
    options: [
      {
        id: 'weir-plain', label: 'Build a plain weir and dig the channels',
        outcome: 'The pool fills and the paddocks turn green by Christmas. The big fish stack up below the wall every spring, and then they stop coming.',
        effects: { budget: -14, flags: { 'weir.built': 1 }, tiles: [{ op: 'water', scope: 'river', add: 0.05 }] },
        preview: { helps: [E('Reliable irrigation water'), R(KERRY, 'Water for her family\'s trees')], hurts: [C('murray-cod', 'Cannot swim past the wall'), R(MARG, 'Fewer cod to guide for')] },
      },
      {
        id: 'weir-ladder', label: 'Build the weir with a fish ladder', evidenceBacked: true,
        outcome: 'It costs more, and the first ladder is clumsy. But fish do turn up above the wall, and the old people say the cod are still moving.',
        effects: { budget: -26, flags: { 'weir.built': 1, 'weir.ladder': 1 } },
        preview: { helps: [C('murray-cod', 'A way past the weir'), R(MARG, 'Fish keep moving')], hurts: [E('A higher bill for the town')] },
      },
      {
        id: 'weir-pumps', label: 'Skip the weir. Pump water from the river instead.',
        outcome: 'The pumps work, but only the farms nearest the river get a reliable supply. The channel plan goes quiet, and some families give up.',
        effects: { budget: -8, society: -1 },
        preview: { helps: [P('River stays free-flowing')], hurts: [E('Fewer farms can irrigate'), T('A smaller town')] },
      },
    ],
  },
  {
    id: 'a1-redgum', title: 'Red gums on the floodplain', phase: 'act1', years: [1920, 1990], speaker: RAY, needsConsultation: true,
    setup: 'The floodplain is the flattest, richest ground around, and it is covered in old red gums. Clearing it would give the town twenty more orchards. Uncle Ray asks to talk first. He says the trees and the billabongs are linked to the river\'s floods.',
    evidence: 'River red gums grow on floodplains and depend on regular floods. Old trees hold hollows used by parrots, possums and bats, and take a hundred years or more to form. Clearing them removes habitat and raises the water table, which brings salt to the surface. Consulting local communities before clearing is standard practice now.',
    options: [
      {
        id: 'clear-all', label: 'Clear the floodplain for orchards', needsConsultation: true,
        outcome: 'The crops go in fast and the first harvests are huge. The billabong silts up, and nobody asked Uncle Ray what he thought.',
        effects: { budget: 14, partnership: -6, mood: { [RAY]: -10 }, tiles: [{ op: 'soil', scope: 'land', add: 0.06 }] },
        preview: { helps: [E('More orchards, more jobs')], hurts: [R(RAY, 'Not asked first'), C('superb-parrot', 'Hollow trees cleared'), C('southern-bell-frog', 'Billabongs silt up')] },
      },
      {
        id: 'clear-some', label: 'Talk with Uncle Ray, then clear only the edges', evidenceBacked: true, needsConsultation: true,
        outcome: 'It takes a few long cuppas. The best old trees and the main billabong stay, and the edges are cleared. Uncle Ray says it is a start.',
        effects: { budget: 4, partnership: 7, mood: { [RAY]: 10 } },
        preview: { helps: [R(RAY, 'Asked and listened to'), C('superb-parrot', 'Old hollows stay standing')], hurts: [E('Fewer orchards than planned'), R(KERRY, 'Less good land to go round')] },
      },
      {
        id: 'clear-none', label: 'Leave the floodplain as it is',
        outcome: 'The red gums stay and the town grows more slowly. A few families move on to better land elsewhere.',
        effects: { budget: -4, society: -1 },
        preview: { helps: [P('Floodplain forest stays'), C('southern-bell-frog', 'Billabongs stay wet')], hurts: [E('Slower growth'), T('Fewer farms for newcomers')] },
      },
    ],
  },
  {
    id: 'a1-salt', title: 'White crust on the paddocks', phase: 'act1', years: [1950, 2010], speaker: KERRY,
    setup: 'There is a white crust on the low paddocks. Some trees are yellowing and the crops are patchy. Irrigation water is soaking down and lifting salt from deep in the ground. Fixing it means draining, planting deep-rooted trees, or just carrying on and hoping.',
    evidence: 'Salt has built up in Basin soils and groundwater over millions of years, from rainfall, weathered rocks and ancient sediments. Clearing and too much irrigation can raise the water table and bring salt into the root zone. Salt stops many plants from taking up water. Drains, deep-rooted trees and less water applied can lower the water table, but disposing of salty drain water is a new problem.',
    options: [
      {
        id: 'carry-on', label: 'Carry on. It is only the low paddocks.',
        outcome: 'The crust spreads each summer. A few paddocks go bare and a couple of farmers walk off the land.',
        effects: { tiles: [{ op: 'soil', scope: 'land', add: 0.15 }], mood: { [KERRY]: -4 }, society: -1 },
        preview: { helps: [E('No extra cost today')], hurts: [R(KERRY, 'Her low paddocks turn white'), P('Salt spreads across the plains')] },
      },
      {
        id: 'drain', label: 'Dig drains and plant deep-rooted trees', evidenceBacked: true,
        outcome: 'The drains lower the water table over a few seasons, and the tree rows hum with insects. The salty drainage water needs somewhere to go, and the town has to argue about where.',
        effects: { budget: -22, tiles: [{ op: 'soil', scope: 'land', mult: 0.8 }], mood: { [KERRY]: 5 } },
        preview: { helps: [R(KERRY, 'Paddocks recover'), P('Salt comes down')], hurts: [E('A large bill'), T('Salty drain water to dispose of')] },
      },
      {
        id: 'less-water', label: 'Water less, and move the thirstiest crops',
        outcome: 'Yields drop for a season, then steady. The crust fades slowly on the paddocks that get less water.',
        effects: { budget: -10, incomePerYear: -1, tiles: [{ op: 'soil', scope: 'land', mult: 0.9 }] },
        preview: { helps: [P('Less water lifts less salt')], hurts: [R(KERRY, 'Lower yields for a while'), E('Smaller harvests')] },
      },
    ],
  },
  {
    id: 'a1-drought-rules', title: 'Dry years and water rules', phase: 'act1', years: [1980, 2020], speaker: SUE,
    setup: 'A third dry summer is coming, and the weir pool is down to mud. Sue can bring in water rules for everyone, build a bigger town reservoir, or tell people to use less and hope they do.',
    evidence: 'During Australia\'s Millennium Drought, many cities brought in restrictions and rebates, and household use dropped sharply. Much of that reduction lasted after the drought ended. Storage helps with short dry spells but evaporation losses are large in hot inland climates, and a reservoir cannot fill if the river does not flow.',
    options: [
      {
        id: 'rules', label: 'Bring in water rules for the whole town', evidenceBacked: true,
        outcome: 'Hoses are banned for the summer and the oval goes brown. The town grumbles and then adapts. By March the reservoir is still half full.',
        effects: { budget: -4, society: -1, flags: { 'w.saving': 0.3 }, mood: { [SUE]: 4 } },
        preview: { helps: [T('Taps keep running'), P('More water stays in the river')], hurts: [R(KIDS, 'The pool and sprinklers are off')] },
      },
      {
        id: 'reservoir', label: 'Build a bigger town reservoir',
        outcome: 'The reservoir takes two years and a lot of the budget. It helps in short dry spells and loses water to the sun each summer.',
        effects: { budget: -28, mood: { [SUE]: 3 } },
        preview: { helps: [T('A buffer for dry spells')], hurts: [E('Big upfront cost'), P('Water lost to evaporation')] },
      },
      {
        id: 'hope', label: 'Ask people to use less and hope',
        outcome: 'Most people try, a few do not, and the weir pool hits mud in February. The taps run weak for a week.',
        effects: { society: -2, mood: { [SUE]: -5, [KIDS]: -3 } },
        preview: { helps: [E('No cost')], hurts: [T('Weak taps in the heat'), R(SUE, 'She wears the blame')] },
      },
    ],
  },
  // ------------------------------------------------------------------------------------------------ Act 2
  {
    id: 'a2-drought-share', title: 'Who gets the water?', phase: 'act2', years: [2026, 2100], repeat: 15, speaker: SUE, noCleanAnswer: true,
    when: { all: [t('recent.drought', '>=', 1)] },
    setup: 'The river is low. The town wants a bigger share so the taps never fail. The farmers say crops and jobs depend on water. The river itself is going quiet, with fish in shrinking pools. Sue puts three sums on the table. None of them adds up to enough.',
    evidence: 'In a dry year, cutting any one share hurts someone. Farm cuts reduce harvests and income. A town cut risks taps failing, which hits households and health. Cutting the river\'s share harms fish, trees and wetlands, and harm to those can last for years. Planners usually protect drinking water first, then weigh the rest case by case.',
    options: [
      {
        id: 'town-first', label: 'Raise the town share, trim the river',
        outcome: 'The taps hold through summer. Down at the weir, the pools get warmer and the cod move deep. Lan says the river is paying for it.',
        effects: { flags: { 'pol.alloc.town': 0.3, 'pol.alloc.env': 0.15 }, mood: { [SUE]: 6, [LAN]: -5, [MARG]: -4 } },
        preview: { helps: [R(SUE, 'Taps keep running'), T('Households stay supplied')], hurts: [C('murray-cod', 'Less flow in the pools'), R(LAN, 'River gets less water')] },
      },
      {
        id: 'river-first', label: 'Protect the river, farms take the cut',
        outcome: 'The river keeps flowing, thin but alive. Kerry\'s trees lose half their water, and some of the younger ones do not make it.',
        effects: { flags: { 'pol.alloc.env': 0.4 }, mood: { [KERRY]: -9, [LAN]: 5, [MARG]: 4 }, society: -1 },
        preview: { helps: [C('murray-cod', 'Flow and cool pools'), R(LAN, 'More water for the river')], hurts: [R(KERRY, 'Trees die without water'), E('Smaller harvests')] },
      },
      {
        id: 'share-pain', label: 'Everyone takes an equal cut',
        outcome: 'Nobody is happy and nobody is wrecked. The taps hold, the trees survive, and the river runs a little lower than it would have.',
        effects: { flags: { 'pol.alloc.town': 0.2, 'pol.alloc.env': 0.25 }, mood: { [SUE]: 2 }, society: 1 },
        preview: { helps: [T('A shared sacrifice')], hurts: [R(KERRY, 'Trimmed water for her trees'), C('murray-cod', 'Less flow than the river needs')] },
      },
    ],
  },
  {
    id: 'a2-buyback', title: 'Buy water back or fund efficiency?', phase: 'act2', years: [2026, 2090], repeat: 30, speaker: KERRY,
    setup: 'To leave more water in the river, the town has two main tools. It can buy water entitlements from farmers who want to sell, or help farmers pay for efficient irrigation. Kerry says buybacks hollow out the district. Lan says efficiency alone can leave the river with less than the papers promise.',
    evidence: 'Buybacks transfer water entitlements from willing sellers to environmental managers, who decide when and where to deliver the water. Available water varies with allocations. Sellers may keep farming, change crops or leave farming. Efficiency upgrades can keep farms producing, but some of the "saved" water used to seep back into the river or aquifer, so real savings can be smaller than planned. Mixing both, with willing sellers, is common practice.',
    options: [
      {
        id: 'buyback', label: 'Buy back entitlements from willing sellers',
        outcome: 'Several farmers sell their water and some leave. The river gets more water, which Lan can see on the gauge. The district loses families and a school bus route.',
        effects: { budget: -24, flags: { 'pol.alloc.env': 0.35 }, mood: { [KERRY]: -6, [LAN]: 6 }, society: -1 },
        preview: { helps: [P('More water stays in the river'), R(LAN, 'River gets its water')], hurts: [R(KERRY, 'Neighbours leave the district'), E('Fewer farm jobs')] },
      },
      {
        id: 'efficiency', label: 'Pay for drip lines and better channels',
        outcome: 'Farms keep working and use less water. Kerry\'s trees thrive. The river gets less of the saved water than the plan said it would.',
        effects: { budget: -22, flags: { 'w.farmEff': 0.6 }, mood: { [KERRY]: 7, [LAN]: -2 } },
        preview: { helps: [R(KERRY, 'Farms stay going'), E('Farm jobs stay')], hurts: [P('Less return flow than hoped')] },
      },
      {
        id: 'mix', label: 'Do both: willing sellers plus drip lines', evidenceBacked: true,
        outcome: 'It costs more, but it spreads the pain. Some farms sell, some upgrade, and the river picks up a steady share that holds up in a dry year.',
        effects: { budget: -30, flags: { 'pol.alloc.env': 0.3, 'w.farmEff': 0.4 }, mood: { [KERRY]: 2, [LAN]: 5 } },
        preview: { helps: [R(LAN, 'A real gain for the river'), R(KERRY, 'Farms still get support')], hurts: [E('The biggest bill of the three')] },
      },
    ],
  },
  {
    id: 'a2-fishway', title: 'A fishway at the weir', phase: 'act2', years: [2025, 2060], speaker: MARG,
    when: { all: [t('count.fishway', '<=', 0)] },
    setup: 'Marg takes you down to the weir and points at the wall. Cod, perch and bony bream stack up below it every spring and cannot get through. A fishway would let them swim upstream. It would cost a bit of money and a bit of weir height.',
    evidence: 'Fishways are channels or ramps that let fish swim past a weir. Several have been built along the Murray and its tributaries, and many native fish use them. Success depends on the design, the flow and the species. Fish also need good water quality and habitat upstream to benefit.',
    options: [
      {
        id: 'fishway', label: 'Fund a fishway on the weir', evidenceBacked: true,
        outcome: 'The engineers want a spot on the raised weir tiles. Marg waits by the new channel, rod down. The first week, small silver fish pour through it.',
        effects: { budget: -18, tiles: [{ op: 'water', scope: 'river', mult: 0.97 }], mood: { [MARG]: 8, [LAN]: 5 } },
        preview: { helps: [C('murray-cod', 'A way upstream'), R(MARG, 'More cod to guide for')], hurts: [E('Costs money to build')] },
      },
      {
        id: 'gates', label: 'Open the weir gates for a week each spring',
        outcome: 'Fish get through during the open week, and the irrigators lose a little storage. Some years the timing is wrong and the fish miss it.',
        effects: { budget: -6, mood: { [MARG]: 3, [KERRY]: -3 } },
        preview: { helps: [C('murray-cod', 'A short window upstream')], hurts: [R(KERRY, 'Less stored water for farms')] },
      },
      {
        id: 'skip', label: 'Not now. Money is tight.',
        outcome: 'The weir stays as it is. The cod keep stacking up below the wall, and Marg says nothing for a while.',
        effects: { mood: { [MARG]: -7, [LAN]: -3 } },
        preview: { helps: [E('Money saved for other things')], hurts: [C('murray-cod', 'Stuck below the wall'), R(MARG, 'Her business depends on cod')] },
      },
    ],
  },
  {
    id: 'a2-bloom', title: 'Green water at the weir', phase: 'act2', years: [2028, 2100], repeat: 20, speaker: LAN,
    when: { all: [t('recent.algal-bloom', '>=', 1)] },
    setup: 'Blue-green algae has turned the weir pool to pea soup. The kids want to swim. Marg\'s tours are off. Some blooms make toxins that can harm people, dogs and fish. Lan asks what the town should add to its immediate warnings and water-safety response.',
    evidence: 'Blue-green algae (cyanobacteria) bloom in warm, slow, nutrient-rich water. Some produce toxins that harm people and animals. Warning signs and closing the water protect people now. Treating water at the intake helps supply. Reducing nutrients, shading banks and improving suitable flows can lower future bloom risk.',
    options: [
      {
        id: 'warn', label: 'Close the river to swimming and put up warnings',
        outcome: 'Signs go up and the pool empties of swimmers. Nobody gets sick. The bloom runs its course, and the next one is just as likely.',
        effects: { budget: -3, mood: { [KIDS]: -4, [MARG]: -3, [SUE]: 2 } },
        preview: { helps: [T('Nobody gets sick'), R(SUE, 'She can show the town acted')], hurts: [R(KIDS, 'No swimming this summer'), R(MARG, 'Tours cancelled')] },
      },
      {
        id: 'treat', label: 'Upgrade water treatment at the town intake',
        outcome: 'The plant is upgraded. The taps run clean, and the river is still green. It is a fix for the town, not for the river.',
        effects: { budget: -20, mood: { [SUE]: 5, [LAN]: -2 } },
        preview: { helps: [T('Clean drinking water in a bloom'), R(SUE, 'Taps stay safe')], hurts: [E('Costly, and the river is unchanged')] },
      },
      {
        id: 'catchment', label: 'Cut nutrient runoff and plant the banks', evidenceBacked: true,
        outcome: 'Farmers fence stock out and plant native shrubs on the banks. It takes years, but next summer\'s water is a little cooler and clearer.',
        effects: { budget: -16, tiles: [{ op: 'water', scope: 'river', mult: 0.85 }], mood: { [LAN]: 7, [KERRY]: -2, [MARG]: 3 } },
        preview: { helps: [P('Fewer nutrients, shadier banks'), C('murray-cod', 'Cooler, clearer water')], hurts: [R(KERRY, 'Lost grazing and some fertiliser use')] },
      },
    ],
  },
  {
    id: 'a2-flood', title: 'A flood on purpose', phase: 'act2', years: [2030, 2090], repeat: 20, speaker: RAY, needsConsultation: true, noCleanAnswer: true,
    setup: 'Floods used to cover the floodplain most springs. Now the river is held back. Uncle Ray asks for a managed flood: release extra water so it spills onto the red gums and fills the billabongs. A low paddock of Kerry\'s will be under water for a week.',
    evidence: 'River red gums and billabong frogs depend on floodplain water every few years. Managed environmental flows, released from storages in spring, have helped trees, wetland birds and frogs in the Basin. But floodwater also crosses farmland, and landholders need warning and fair arrangements. How much is enough is still debated.',
    options: [
      {
        id: 'full-flood', label: 'Release a full managed flood', needsConsultation: true,
        outcome: 'The water spills over the bank and spreads out among the red gums. Frogs begin calling that night. Kerry\'s low paddock is soaked and she loses a crop.',
        effects: {
          budget: -10, flags: { 'pol.alloc.env': 0.45, 'water.cultural': 1 }, partnership: 6,
          tiles: [{ op: 'health', scope: 'wetland', add: 0.1 }, { op: 'soil', scope: 'land', mult: 0.9 }],
          mood: { [RAY]: 10, [KERRY]: -8, [KIDS]: 5 },
        },
        preview: { helps: [R(RAY, 'Asked, and the floodplain drinks'), C('southern-bell-frog', 'Billabongs fill'), C('superb-parrot', 'Red gums are soaked')], hurts: [R(KERRY, 'A paddock of crop goes under')] },
      },
      {
        id: 'small-flood', label: 'Release a smaller flood, keep the paddocks dry', needsConsultation: true,
        outcome: 'The flood reaches the nearest billabong and the front row of gums. It is a start. Uncle Ray says the back of the floodplain is still thirsty.',
        effects: {
          budget: -5, flags: { 'pol.alloc.env': 0.3, 'water.cultural': 1 }, partnership: 2,
          tiles: [{ op: 'health', scope: 'wetland', add: 0.04 }],
          mood: { [RAY]: 2, [KERRY]: -1 },
        },
        preview: { helps: [R(RAY, 'Some water gets there'), R(KERRY, 'Her paddock stays dry')], hurts: [C('southern-bell-frog', 'Not every billabong fills'), C('superb-parrot', 'Back trees stay dry')] },
      },
      {
        id: 'no-flood', label: 'No flood this year. Keep the water for farms.',
        outcome: 'The farms have a good season. The floodplain stays dry, and Uncle Ray does not say much.',
        effects: { society: -1, mood: { [RAY]: -9, [KERRY]: 5 }, partnership: -4 },
        needsConsultation: true,
        preview: { helps: [R(KERRY, 'Crops and water as planned'), E('Farm income holds')], hurts: [R(RAY, 'Asked, and then ignored'), C('southern-bell-frog', 'Billabongs stay dry')] },
      },
    ],
  },
  {
    id: 'a2-almonds', title: 'Almonds in a drier climate', phase: 'act2', years: [2040, 2100], repeat: 30, speaker: KERRY, noCleanAnswer: true,
    setup: 'Almonds and citrus take water every year, wet or dry, because the trees cannot be left fallow. Kerry has an offer to plant more, and a bank that likes the plan. A drier river could leave those trees thirsty in a bad year. Dryland crops are cheaper and cope with droughts better.',
    evidence: 'Orchards still need enough water to keep trees alive in drought, even when growers reduce or sacrifice that season\'s crop, and that locks in demand. Annual crops and dryland grazing can be scaled back in dry years. But tree crops can earn more per hectare and per megalitre. Which approach holds up depends on how dry the climate gets, and that is uncertain.',
    options: [
      {
        id: 'more-almonds', label: 'Keep planting almonds, with drip lines',
        outcome: 'The new rows go in with drip lines. Income is up and water use per tree is down. In a bad year the trees will still need every drop.',
        effects: { budget: -14, incomePerYear: 2, flags: { 'w.farmEff': 0.5 }, mood: { [KERRY]: 6, [LAN]: -3 } },
        preview: { helps: [R(KERRY, 'More income per hectare'), E('Farm earnings up')], hurts: [P('Water demand locked in for decades')] },
      },
      {
        id: 'dryland', label: 'Move to dryland farming and grazing',
        outcome: 'The pumps go quiet. Income is lower, but so are the debts. In dry years the paddocks go yellow and the river keeps its water.',
        effects: { incomePerYear: -2, flags: { 'pol.alloc.env': 0.4 }, mood: { [KERRY]: -5, [LAN]: 5 } },
        preview: { helps: [P('More water for the river'), R(LAN, 'River health improves')], hurts: [R(KERRY, 'Lower and patchier income'), E('Fewer jobs on the flat')] },
      },
      {
        id: 'flexible', label: 'Switch to annual crops she can pause in a drought',
        outcome: 'Vegetables and grain give her choices. In a wet year she plants more, and in a dry year she lets paddocks rest. Profits wobble year to year.',
        effects: { budget: -8, incomePerYear: -1, flags: { 'w.farmEff': 0.3 }, mood: { [KERRY]: 1 } },
        preview: { helps: [P('Water demand can shrink in a drought'), R(KERRY, 'More choices each year')], hurts: [E('Less reliable profits')] },
      },
    ],
  },
  {
    id: 'a2-estate', title: 'A new estate and the taps', phase: 'act2', years: [2045, 2100], repeat: 30, speaker: SUE,
    setup: 'A developer wants to build a hundred new homes on the edge of town. The town needs families, and the school needs kids. A hundred more homes also means more water use. Sue can make water-saving rules permanent, or approve the estate and rely on the dam.',
    evidence: 'After the Millennium Drought, many Australian cities found that per-person water use stayed well below pre-drought levels, helped by efficient appliances and habits. Permanent water-saving rules cost little and cut demand in good years and bad. New housing adds demand even with savings, so planning and storage still matter.',
    options: [
      {
        id: 'rules-estate', label: 'Approve a smaller estate with permanent saving rules', evidenceBacked: true,
        outcome: 'The estate goes up with tanks, efficient taps and native gardens. Per-home use is low, and the town gains families without a big extra draw on the river.',
        effects: { budget: -10, society: 1, flags: { 'w.saving': 0.6 }, mood: { [SUE]: 5 } },
        preview: { helps: [T('New families and a fuller school'), R(SUE, 'Growth and water security')], hurts: [R(KIDS, 'Fewer sprinkler summers')] },
      },
      {
        id: 'big-estate', label: 'Approve the full estate, no new rules',
        outcome: 'The estate sells out fast and the school fills. The next dry summer, the town is asking the river for more than it can give.',
        effects: { budget: 10, society: 1, flags: { 'pol.alloc.town': 0.3 }, mood: { [SUE]: -2, [LAN]: -4 } },
        preview: { helps: [T('A growing town'), E('Rates and spending go up')], hurts: [P('Higher demand on the river'), R(LAN, 'Another draw on a sick river')] },
      },
      {
        id: 'no-estate', label: 'Say no. Keep the town as it is.',
        outcome: 'The developer shrugs and moves on to the next town. The school loses a teacher the following year. The river keeps its water.',
        effects: { society: -1, mood: { [SUE]: -4 } },
        preview: { helps: [P('No extra water demand')], hurts: [T('The town stays small'), E('Fewer new customers')] },
      },
    ],
  },
  {
    id: 'a2-carp', title: 'Carp in the billabong', phase: 'act2', years: [2050, 2100], repeat: 30, speaker: LAN,
    setup: 'European carp have taken over the billabongs. They churn up the mud, muddy the water and eat the plants that frogs and cod need. Lan lists three options. Trapping is slow, a virus is still being studied, and doing nothing is free.',
    evidence: 'Common carp make up most of the fish by weight in many Murray-Darling waters. They stir up sediment, damage plants and breed fast. Trapping at fishways and in billabongs, and netting where they gather, can cut numbers over time. A carp virus has been investigated as a possible control. Any release would need further assessment, government decisions and plans for dead fish and water quality.',
    options: [
      {
        id: 'trap', label: 'Trap and net carp where they gather', evidenceBacked: true,
        outcome: 'The traps by the fishway fill with carp every spring. It is slow, boring work, and it works. The billabong water clears a shade each year.',
        effects: { budget: -14, tiles: [{ op: 'water', scope: 'wetland', mult: 0.85 }], mood: { [LAN]: 6, [KIDS]: 4, [MARG]: 4 } },
        preview: { helps: [C('southern-bell-frog', 'Clearer billabongs'), C('murray-cod', 'Fewer carp in the cod\'s water')], hurts: [E('Regular trapping costs money')] },
      },
      {
        id: 'virus', label: 'Back a carp virus trial',
        outcome: 'A trial is considered, with conditions. Lan keeps the paperwork on her desk and her fingers crossed. A big die-off could foul the water for a few weeks.',
        effects: { budget: -24, tiles: [{ op: 'water', scope: 'river', add: 0.06 }], mood: { [LAN]: -2, [SUE]: -2 } },
        preview: { helps: [C('southern-bell-frog', 'Fewer carp, if it works')], hurts: [T('Dead fish to clear up'), P('A big die-off could foul the water')] },
      },
      {
        id: 'ignore', label: 'Leave the carp for now',
        outcome: 'The carp keep breeding. The billabongs stay murky and the frogs struggle to find plants. Ruby\'s diary has fewer entries each year.',
        effects: { society: -1, mood: { [LAN]: -5, [KIDS]: -5 } },
        preview: { helps: [E('No cost')], hurts: [C('southern-bell-frog', 'Murky water, fewer plants'), R(KIDS, 'Fewer frogs to write about')] },
      },
    ],
  },
  {
    id: 'a2-solar', title: 'Solar on the salty paddocks', phase: 'act2', years: [2055, 2100], repeat: 30, speaker: KERRY,
    setup: 'Some of Kerry\'s low paddocks are too salty for anything but weeds. A company will lease the land for solar panels. Lan suggests saltbush and deep-rooted trees to cover the ground and help manage the groundwater. Either way, the paddocks stop being a loss.',
    evidence: 'Land too salty for crops can still host solar panels, which need no irrigation and can bring a steady lease income. Salt-tolerant plants may provide cover and grazing. Deeper-rooted vegetation can help manage groundwater in suitable places, but salt may remain and recovery is uncertain. Both are used in Australia, and the right choice depends on how bad the salt is and what the owner wants.',
    options: [
      {
        id: 'solar', label: 'Lease the salty paddocks for solar panels', evidenceBacked: true,
        outcome: 'Rows of panels go up where the white crust used to be. The lease cheque arrives every quarter. The land is not farmed, but it earns.',
        effects: { budget: 8, incomePerYear: 2, mood: { [KERRY]: 7 } },
        preview: { helps: [R(KERRY, 'Steady income from poor land'), P('Clean power, no irrigation')], hurts: [R(LAN, 'No attempt to restore the land')] },
      },
      {
        id: 'saltbush', label: 'Plant saltbush and trees to reclaim the soil',
        outcome: 'Hardy saltbush and deep-rooted trees take hold. The crust may fade slowly. In time the ground might carry some grazing, though not crops, and some salt will stay.',
        effects: { budget: -12, tiles: [{ op: 'soil', scope: 'land', mult: 0.85 }], mood: { [LAN]: 5, [KERRY]: 1 } },
        preview: { helps: [P('Salt may ease'), R(LAN, 'A chance the land recovers')], hurts: [E('Paying for years before it earns')] },
      },
      {
        id: 'leave-bare', label: 'Leave the paddocks as they are',
        outcome: 'The salt stays where it is. The white patches spread a little each summer, and the weeds take what they can.',
        effects: { tiles: [{ op: 'soil', scope: 'land', add: 0.05 }], mood: { [KERRY]: -4 } },
        preview: { helps: [E('No cost')], hurts: [R(KERRY, 'Land that earns nothing'), P('Salt keeps spreading')] },
      },
    ],
  },
];
