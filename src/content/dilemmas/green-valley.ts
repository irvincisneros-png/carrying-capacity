/**
 * Green Valley dilemma cards (the tutorial). Act 1 has one for nearly every decade, each with money on both sides and
 * a consequence you can see (the creek, the bird and fish counts, a resident's line). Act 2 has three. Plain and kind.
 */
import { t } from '../../sim/conditions';
import type { DilemmaDef } from '../../sim/dilemmas';

export const GREEN_VALLEY_DILEMMAS: readonly DilemmaDef[] = [
  {
    id: 'gv-factory-waste',
    title: 'Where does the factory waste go?',
    phase: 'act1',
    years: [1980, 2010],
    when: { all: [t('count.factory', '>=', 1)] },
    speaker: 'jo-marsh',
    priority: -1,
    setup: 'The factory makes jobs, and also muddy waste. Right now it trickles into the creek. Jo\'s orchard is downstream and she has noticed the water looks odd. A settling pit would catch the worst of it, but it costs money and space.',
    options: [
      {
        id: 'creek', label: 'Let it run into the creek for now',
        outcome: 'The factory stays cheap and busy. Downstream, the creek turns a murky brown after rain and only about {fish} schools of fish are left. Jo frowns at her irrigation pipes.',
        effects: { budget: 10, incomePerDecade: 6, mood: { 'jo-marsh': -6 }, tiles: [{ op: 'water', scope: 'river', add: 0.12 }], flags: { 'runoff.factory': 0.06 } },
        preview: {
          helps: [{ type: 'economy', id: 'economy', why: 'Cheaper to run: about $6k more income every decade' }],
          hurts: [{ type: 'resident', id: 'jo-marsh', why: 'Dirty water reaches her orchard' }, { type: 'planet', id: 'planet', why: 'Waste builds up in the creek' }],
        },
      },
      {
        id: 'pit', label: 'Dig a settling pit for the waste',
        outcome: 'Workers dig a lined pit by the factory. Heavy waste sinks to the bottom and cleaner water flows on. Jo walks the creek and gives a thumbs up. Her fruit buyers hear about it, and orders pick up a little.',
        effects: { budget: -14, society: 1, incomePerDecade: 2, mood: { 'jo-marsh': 6 }, tiles: [{ op: 'water', scope: 'river', mult: 0.85 }] },
        evidenceBacked: true,
        preview: {
          helps: [{ type: 'resident', id: 'jo-marsh', why: 'Cleaner water for her trees' }, { type: 'planet', id: 'planet', why: 'Less waste reaches the creek' }],
          hurts: [{ type: 'economy', id: 'economy', why: 'The pit costs $14k to build and money to empty' }],
        },
      },
    ],
    evidence: 'Settling ponds work because heavy particles sink when water moves slowly. They catch many solids and some metals, but not everything dissolved. The waste in the pit still has to be stored safely, because it can leak or wash out later. Cleaning waste at the source is usually cheaper than cleaning a river afterwards.',
  },
  {
    id: 'gv-hillside',
    title: 'Clear the hillside for a bigger farm?',
    phase: 'act1',
    years: [1970, 1979],
    when: { all: [t('count.farm', '>=', 1)] },
    speaker: 'jo-marsh',
    priority: 3,
    setup: 'Jo\'s neighbour wants to double his farm by clearing the bushy hillside above the creek. The red soil is rich and the bank will lend him the money. Ali, the ranger, says the bush on that slope holds the soil in place and is home to many of the valley\'s birds. Right now there are about {birds} pairs of bush birds, and {bush}% of the original bush is left.',
    options: [
      {
        id: 'clear', label: 'Clear the hillside for a bigger farm',
        outcome: 'The bulldozers go in and the new paddocks pay well. After the first big storm, red mud pours down the slope and turns the creek the colour of tomato soup. Bush birds fall to about {birds} pairs, and the creek drops to {creek}% health.',
        effects: { budget: -6, incomePerDecade: 8, clearBush: 7, mood: { 'jo-marsh': 4, 'ali-rahman': -6 }, tiles: [{ op: 'water', scope: 'river', add: 0.14 }], flags: { 'runoff.hill': 0.08 } },
        preview: {
          helps: [{ type: 'economy', id: 'economy', why: 'About $8k more income every decade' }, { type: 'resident', id: 'jo-marsh', why: 'A bigger farm next door means more work and trade' }],
          hurts: [{ type: 'planet', id: 'planet', why: 'Bush is lost and soil washes into the creek' }, { type: 'resident', id: 'ali-rahman', why: 'The birds lose their nesting trees' }],
        },
      },
      {
        id: 'terrace', label: 'Farm only the gentle slope and leave the steep part as bush',
        outcome: 'Workers build low banks across the gentle slope and leave the steep top alone. The farm is smaller, but it still pays, and the creek stays clear after the storm. Ali counts about {birds} pairs of birds on the ridge.',
        effects: { budget: -10, incomePerDecade: 4, clearBush: 2, mood: { 'jo-marsh': 1, 'ali-rahman': 5 }, flags: { 'runoff.hill': 0.02 } },
        evidenceBacked: true,
        preview: {
          helps: [{ type: 'planet', id: 'planet', why: 'Roots hold the steep soil and the creek stays clear' }, { type: 'economy', id: 'economy', why: 'About $4k more income every decade' }],
          hurts: [{ type: 'economy', id: 'economy', why: 'Less new farmland, and $10k for the banks' }],
        },
      },
      {
        id: 'leave', label: 'Leave the hillside alone',
        outcome: 'The hillside stays green. The neighbour grumbles and the bank keeps its money. Ali starts running bird walks on the ridge, and a few visitors pay to come. About {birds} pairs of birds sing there at dawn.',
        effects: { incomePerDecade: 1, mood: { 'jo-marsh': -3, 'ali-rahman': 6 } },
        preview: {
          helps: [{ type: 'planet', id: 'planet', why: 'All the bush and creek stay as they are' }, { type: 'resident', id: 'ali-rahman', why: 'The nesting trees stay' }],
          hurts: [{ type: 'economy', id: 'economy', why: 'No new farm income; only a little from visitors' }],
        },
      },
    ],
    evidence: 'Plant roots bind soil and leaves slow the rain. On bare, steep slopes heavy rain strips away topsoil, and that sediment turns creeks cloudy, smothers the gravel where fish lay eggs and carries nutrients that feed algae. Contour banks, strips of trees and keeping the steepest ground in bush all cut erosion a lot. Clearing does raise farm output in the short term, which is why it was so common, and even encouraged, in the 1960s and 1970s. Today governments pay some farmers to keep bush on steep land.',
  },
  {
    id: 'gv-fertiliser',
    title: 'The fertiliser deal',
    phase: 'act1',
    years: [1980, 1989],
    when: { all: [t('count.farm', '>=', 1)] },
    speaker: 'jo-marsh',
    priority: 2,
    setup: 'A salesman offers Jo a deal on fertiliser: spread it thick and the trees will crop heavily. It is cheap this year. Ali warns that what the trees do not use washes into the creek when it rains. The creek is at {creek}% health now, with about {fish} schools of fish.',
    options: [
      {
        id: 'heavy', label: 'Take the deal and spread it thick',
        outcome: 'The orchard has its best crop in years and the money rolls in. By summer the creek turns a murky green with algae, and the fish gasp near the surface. The creek is at {creek}% health, with about {fish} schools of fish.',
        effects: { budget: 6, incomePerDecade: 9, mood: { 'jo-marsh': 5, 'ali-rahman': -5 }, tiles: [{ op: 'water', scope: 'river', add: 0.16 }], flags: { 'runoff.fert': 0.1 } },
        preview: {
          helps: [{ type: 'economy', id: 'economy', why: 'Big crops: about $9k more income every decade' }],
          hurts: [{ type: 'planet', id: 'planet', why: 'Extra nitrogen and phosphorus feed algae in the creek' }, { type: 'resident', id: 'ali-rahman', why: 'Fish gasp as the oxygen drops' }],
        },
      },
      {
        id: 'soil-test', label: 'Test the soil and add only what the trees need',
        outcome: 'Ali helps Jo take soil samples. The trees get just the right amount at the right time of year. The crop is still good, the fertiliser bill is smaller, and the creek stays clear. About {fish} schools of fish keep swimming.',
        effects: { budget: -4, incomePerDecade: 5, mood: { 'jo-marsh': 3, 'ali-rahman': 5 }, flags: { 'runoff.fert': 0.02 } },
        evidenceBacked: true,
        preview: {
          helps: [{ type: 'planet', id: 'planet', why: 'Much less fertiliser washes into the creek' }, { type: 'economy', id: 'economy', why: 'About $5k more income every decade, with a smaller bill' }],
          hurts: [{ type: 'economy', id: 'economy', why: 'Soil tests cost $4k, and the crop is a bit smaller than with a heavy dose' }],
        },
      },
      {
        id: 'skip', label: 'Say no and farm as before',
        outcome: 'Jo shakes the salesman\'s hand and sends him on his way. The orchard carries on as it always has. Nothing changes, for better or worse.',
        effects: { mood: { 'jo-marsh': -2 } },
        preview: {
          helps: [{ type: 'planet', id: 'planet', why: 'No extra nutrients reach the creek' }],
          hurts: [{ type: 'economy', id: 'economy', why: 'No new income' }],
        },
      },
    ],
    evidence: 'Plants need nitrogen and phosphorus, but fertiliser they cannot take up washes off in the rain. In a creek those nutrients make algae grow in thick blooms. When the algae die, bacteria use up the oxygen as they break them down, and fish and other water animals suffocate. This is called eutrophication. Soil tests, spreading smaller amounts more often and leaving a strip of plants beside the creek all keep nutrients on the farm, where they pay off, and out of the water.',
  },
  {
    id: 'gv-tip',
    title: 'A cheap tip or a proper one?',
    phase: 'act1',
    years: [1990, 1999],
    speaker: 'ali-rahman',
    priority: 2,
    setup: 'The old rubbish dump is full. The council can open a new one in the hollow beside the creek: it is close, flat and cheap. A lined landfill on higher ground costs much more to build. It has a thick liner, a clay cap and pipes that collect gas. Ali asks where the water from rotting rubbish will end up.',
    options: [
      {
        id: 'creek-tip', label: 'Open the cheap tip in the hollow by the creek',
        outcome: 'Trucks start tipping the next week and the council saves a lot. After a wet autumn, a dark, smelly liquid leaches from the rubbish and seeps towards the creek. Sometimes the tip smoulders, and a stink rolls over the valley. The creek is at {creek}% health.',
        effects: { budget: -3, incomePerDecade: 2, emissionsKt: 12, mood: { 'ali-rahman': -6, 'jo-marsh': -3 }, tiles: [{ op: 'water', scope: 'river', add: 0.15 }], flags: { 'runoff.tip': 0.07 } },
        preview: {
          helps: [{ type: 'economy', id: 'economy', why: 'Only $3k to open, and tip fees bring in a little' }],
          hurts: [{ type: 'planet', id: 'planet', why: 'Leachate seeps into the creek, and rotting rubbish makes methane' }, { type: 'resident', id: 'ali-rahman', why: 'Years of clean-up later' }],
        },
      },
      {
        id: 'lined', label: 'Build a lined landfill on higher ground',
        outcome: 'It takes longer and costs a lot, but the new tip has a thick liner, a pipe to collect the leachate and another to catch the methane. Fees are higher, so it earns more. The creek stays at {creek}% health, and Ali signs off the plans.',
        effects: { budget: -20, incomePerDecade: 4, emissionsKt: 3, society: 1, mood: { 'ali-rahman': 6, 'jo-marsh': 2 } },
        evidenceBacked: true,
        preview: {
          helps: [{ type: 'planet', id: 'planet', why: 'The liner keeps leachate out of the creek and the gas is captured' }, { type: 'economy', id: 'economy', why: 'Higher fees: about $4k more income every decade' }],
          hurts: [{ type: 'economy', id: 'economy', why: '$20k to build' }],
        },
      },
    ],
    evidence: 'Rotting rubbish makes a dark liquid called leachate that carries metals and nutrients, and a gas that is about half methane. Methane is a greenhouse gas that traps much more heat than the same amount of CO2. A clay and plastic liner and a leachate pipe stop the liquid reaching groundwater and creeks, and capturing the gas lets it be burned for power or flared, which turns it into weaker CO2. Fixing a leaking tip later usually costs many times more than lining it in the first place.',
  },
  {
    id: 'gv-dry-year',
    title: 'A dry year: who gets the water?',
    phase: 'act1',
    years: [2000, 2009],
    when: { all: [t('count.farm', '>=', 1)] },
    speaker: 'jo-marsh',
    priority: 2,
    noCleanAnswer: true,
    setup: 'It has hardly rained for a year and the creek is down to a trickle. Jo and the other farmers want to run their pumps day and night so the trees do not die. Ali says the creek needs some flow to stay alive: the platypus and fish are trapped in a few pools, which are getting warm and low on oxygen. There are about {fish} schools of fish left.',
    options: [
      {
        id: 'pump', label: 'Let the farms pump the creek',
        outcome: 'The pumps run and the crop is saved, and Jo sells well while other districts have none. Downstream, the creek breaks into stagnant pools and the fish die off. The creek is at {creek}% health, with about {fish} schools of fish left.',
        effects: { budget: 14, incomePerDecade: -2, mood: { 'jo-marsh': 6, 'ali-rahman': -7 }, tiles: [{ op: 'water', scope: 'river', mult: 1.3 }] },
        preview: {
          helps: [{ type: 'resident', id: 'jo-marsh', why: 'The crop is saved and sells well' }, { type: 'economy', id: 'economy', why: '$14k from a good harvest' }],
          hurts: [{ type: 'planet', id: 'planet', why: 'Pools heat up and fish and platypus die' }, { type: 'economy', id: 'economy', why: 'Pumps wear out: about $2k less income every decade' }],
        },
      },
      {
        id: 'restrict', label: 'Water restrictions: keep a flow for the fish and platypus',
        outcome: 'Farmers can pump only part of the time, and some trees are lost. Jo is not happy. But a thread of water keeps flowing, and Ali sees a platypus in the pool at dusk. Visitors come to see it next year. About {fish} schools of fish survive.',
        effects: { budget: -12, incomePerDecade: 3, mood: { 'jo-marsh': -5, 'ali-rahman': 7 }, tiles: [{ op: 'water', scope: 'river', mult: 0.95 }] },
        preview: {
          helps: [{ type: 'planet', id: 'planet', why: 'A little flow keeps pools cool and the fish alive' }, { type: 'economy', id: 'economy', why: 'Visitors come to see the platypus: about $3k more income every decade' }],
          hurts: [{ type: 'resident', id: 'jo-marsh', why: 'Some trees die and the harvest is smaller' }, { type: 'economy', id: 'economy', why: 'About $12k of lost crop' }],
        },
      },
    ],
    evidence: 'Creeks need an environmental flow, a share of the water left in the river, to keep pools cool and full of oxygen and to let fish and platypus move between them. During the Millennium Drought (about 2001 to 2009) many rivers in south-eastern Australia shrank to pools, and some fish kills followed. Farmers who pump gain a harvest now, but a dead creek is slow and expensive to bring back. Neither choice is free: someone loses either way.',
  },
  {
    id: 'gv-solar-rebate',
    title: 'Solar panels are getting cheaper',
    phase: 'act1',
    years: [2010, 2019],
    speaker: 'ali-rahman',
    priority: 2,
    setup: 'Solar panels have dropped a lot in price, and the government has offered a rebate for the first houses to fit them. Panels cost money now and save money on power bills later. Ali points out that the valley\'s coal power station is the biggest source of its CO2. Others say prices will fall further if the valley waits.',
    options: [
      {
        id: 'rebate', label: 'Join the rebate: panels on valley roofs',
        outcome: 'Panels go up on cottage roofs and the school. Power bills shrink, and on sunny afternoons the coal station barely has to run. The valley\'s CO2 for the decade is a little lower.',
        effects: { budget: -18, incomePerDecade: 7, emissionsKt: -20, society: 1, mood: { 'ali-rahman': 6, 'jo-marsh': 2 } },
        evidenceBacked: true,
        preview: {
          helps: [{ type: 'economy', id: 'economy', why: 'Bills fall: about $7k more income every decade' }, { type: 'planet', id: 'planet', why: 'Less coal burned, less CO2' }],
          hurts: [{ type: 'economy', id: 'economy', why: '$18k now, and prices keep falling' }],
        },
      },
      {
        id: 'hall', label: 'Put panels on the school and hall only',
        outcome: 'A smaller job, a smaller bill. The school and hall now run on sunshine in the day, and the principal turns it into a science lesson.',
        effects: { budget: -8, incomePerDecade: 3, emissionsKt: -8, mood: { 'ali-rahman': 2 } },
        preview: {
          helps: [{ type: 'town', id: 'town', why: 'The school and hall save on bills' }, { type: 'planet', id: 'planet', why: 'A small cut in CO2' }],
          hurts: [{ type: 'economy', id: 'economy', why: '$8k now for a smaller saving' }],
        },
      },
      {
        id: 'wait', label: 'Wait: panels will be cheaper in a few years',
        outcome: 'The valley keeps its money. Panels do get cheaper, but every year of waiting is another year of coal-fired power, and the early rebate goes to another district.',
        effects: { mood: { 'ali-rahman': -3 } },
        preview: {
          helps: [{ type: 'economy', id: 'economy', why: 'No money spent now' }],
          hurts: [{ type: 'planet', id: 'planet', why: 'The coal power station keeps running at full tilt' }],
        },
      },
    ],
    evidence: 'The price of solar panels fell by around 80 to 90 per cent between 2010 and 2020, so waiting really does save money on the panels themselves. But a rooftop system usually pays itself back in power savings in about four to eight years, and every year without it means more coal burned. Early buyers also helped create the market that pushed prices down. Which is worth more depends on how you weigh money now against emissions cut sooner.',
  },
  {
    id: 'gv-solar-site',
    title: 'Where do the solar panels go?',
    phase: 'act2',
    years: [2025, 2035],
    speaker: 'ali-rahman',
    setup: 'The valley needs more solar power. Jo has offered her top paddock, which is flat and sunny. Ali points to ground that is already disturbed instead, like an old tip or mine edge: it is already cleared, and nobody can grow food there. Rooftops are a third choice, though small.',
    options: [
      {
        id: 'paddock', label: 'Put the panels on Jo\'s top paddock',
        outcome: 'The paddock is fast to build on, and the power flows. Jo loses her spring grazing, and the sheep look rather confused.',
        effects: { budget: -10, incomePerYear: 1, mood: { 'jo-marsh': -3, 'ali-rahman': -2 } },
        preview: {
          helps: [{ type: 'planet', id: 'planet', why: 'Fast, cheap clean power' }],
          hurts: [{ type: 'resident', id: 'jo-marsh', why: 'She loses good farm land' }],
        },
      },
      {
        id: 'landfill', label: 'Put the panels on already-disturbed ground',
        outcome: 'Worn-out ground gets a second life. Engineers check it is stable and capped, and panels go on top while the farmland stays green. It takes a bit more care to build.',
        effects: { budget: -16, society: 1, mood: { 'jo-marsh': 4, 'ali-rahman': 5 }, flags: { 'circular.landfillSolar': 1 } },
        evidenceBacked: true,
        preview: {
          helps: [{ type: 'resident', id: 'jo-marsh', why: 'Her paddock stays for the farm' }, { type: 'planet', id: 'planet', why: 'Clean power without clearing new ground' }],
          hurts: [{ type: 'economy', id: 'economy', why: 'Building on a capped landfill costs more' }],
        },
      },
      {
        id: 'roofs', label: 'Only use rooftops for now',
        outcome: 'Cottage roofs fill with panels, one by one. Nobody loses any land, but the valley is still waiting on its big share of clean power.',
        effects: { budget: -6, mood: { 'ali-rahman': -1 } },
        preview: {
          helps: [{ type: 'town', id: 'town', why: 'Households save on power bills' }],
          hurts: [{ type: 'planet', id: 'planet', why: 'Slower cut in coal power' }],
        },
      },
    ],
    evidence: 'Compare roofs and already-disturbed land before clearing habitat. A capped landfill may suit solar if engineers check settlement, drainage, gas systems and the cap. Rooftop solar helps but is usually too small to meet all demand.',
  },
  {
    id: 'gv-dam-or-wetland',
    title: 'A farm dam or a frog wetland?',
    phase: 'act2',
    years: [2030, 2040],
    speaker: 'ali-rahman',
    setup: 'There is a low, boggy patch beside the creek. Jo wants a deep dam to store water for the dry months. Ali wants a shallow wetland, which cleans the runoff and could bring the green and golden bell frog home. Money is limited.',
    options: [
      {
        id: 'dam', label: 'Build a deep farm dam',
        outcome: 'The dam fills with the next rain and Jo breathes out. The edges are steep and bare, though, and the frogs have nowhere shallow to lay their eggs.',
        effects: { budget: -14, mood: { 'jo-marsh': 6, 'ali-rahman': -3 } },
        preview: {
          helps: [{ type: 'resident', id: 'jo-marsh', why: 'Stored water for the dry months' }],
          hurts: [{ type: 'creature', id: 'frogs', why: 'No shallow, sunny pools to breed in' }],
        },
      },
      {
        id: 'wetland', label: 'Plan a shallow stormwater wetland',
        outcome: 'Ali gets the go-ahead and cleans up the boggy patch. Now place Stormwater wetlands beside the creek (Restore menu): shallow, slow water that cleans runoff, and a home frogs may find. Jo still wants a little extra water for the trees.',
        effects: { budget: -12, society: 1, mood: { 'ali-rahman': 7, 'jo-marsh': -2 }, tiles: [{ op: 'water', scope: 'river', mult: 0.9 }] },
        evidenceBacked: true,
        preview: {
          helps: [{ type: 'creature', id: 'frogs', why: 'Shallow, sunny ponds to breed in' }, { type: 'planet', id: 'planet', why: 'Reeds filter dirt from runoff' }],
          hurts: [{ type: 'resident', id: 'jo-marsh', why: 'Less stored water for the farm' }],
        },
      },
    ],
    evidence: 'Constructed wetlands slow runoff so sediment settles, and reeds take up nutrients such as nitrogen. The green and golden bell frog breeds in shallow, still, sunny water and has been lost from much of its old range, partly through wetland drainage and a fungal disease. A wetland helps, but cannot promise frogs will arrive.',
  },
];
