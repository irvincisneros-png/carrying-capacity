/**
 * Dilemma cards for Red Dirt: 4 in Act 1 (about one every 20 years) and 10 in Act 2, spread across 2025 to 2100.
 * Four have no clean answer on purpose. Cards that touch the Traditional Owners are flagged needsConsultation, and
 * stay general: no named places, stories, language or practices.
 */
import { t } from '../../sim/conditions';
import type { DilemmaDef, PreviewTarget } from '../../sim/dilemmas';

const WALLY = 'uncle-wally';
const SHAZ = 'shaz-dimitriou';
const BEV = 'bev-gallagher';
const ROHAN = 'rohan-mehta';
const PETE = 'pete-hanrahan';
const KIDS = 'tia-ben';

const R = (id: string, why: string): PreviewTarget => ({ type: 'resident', id, why });
const C = (id: string, why: string): PreviewTarget => ({ type: 'creature', id, why });
const P = (why: string): PreviewTarget => ({ type: 'planet', id: 'planet', why });
const E = (why: string): PreviewTarget => ({ type: 'economy', id: 'economy', why });
const T = (why: string): PreviewTarget => ({ type: 'town', id: 'town', why });

export const RED_DIRT_DILEMMAS: readonly DilemmaDef[] = [
  // ------------------------------------------------------------------------------------------------ Act 1
  {
    id: 'a1-camp', title: 'Where to make camp', phase: 'act1', years: [1890, 1930], speaker: WALLY, needsConsultation: true,
    setup: 'The first settlers have arrived with wagons and cattle. The permanent waterhole is the obvious place to camp. Uncle Wally has come to talk before the first tent goes up. He says the water has been shared for a very long time, and that the bank is easily damaged.',
    evidence: 'Permanent waterholes are rare in arid Australia, so every animal for a long way depends on them. Stock and campers at the edge trample the bank and foul the water with manure. Traditional Owners hold knowledge of which waters last through droughts, which is why asking first saves mistakes.',
    options: [
      {
        id: 'bank', label: 'Camp right on the bank of the waterhole', needsConsultation: true,
        outcome: 'It is quick and handy. By summer the bank is churned to mud and the birds drink further along. Uncle Wally says nothing, which is worse than if he had.',
        effects: { partnership: -6, tiles: [{ op: 'water', scope: 'wetland', add: 0.15 }], mood: { [WALLY]: -9 } },
        preview: { helps: [E('Water on the doorstep')], hurts: [R(WALLY, 'Nobody asked before the camp went up'), C('budgerigar', 'The edge trampled and fouled')] },
      },
      {
        id: 'yarn', label: 'Yarn with Uncle Wally first, then camp back from the bank', evidenceBacked: true, needsConsultation: true,
        outcome: 'It takes a week of talking and a hot walk with buckets. The camp goes on the rise, and the waterhole edge stays clear for animals. Uncle Wally brings a billy to the first meeting.',
        effects: { budget: -6, partnership: 7, mood: { [WALLY]: 9 } },
        preview: { helps: [R(WALLY, 'Asked first and listened to'), C('budgerigar', 'A clean waterhole edge'), P('Water stays clean')], hurts: [E('A week\'s delay and a longer carry')] },
      },
      {
        id: 'rise', label: 'Camp on the rise and carry water by bucket', needsConsultation: true,
        outcome: 'The waterhole stays clean, but carrying water is hard work for everyone, and nobody has talked to Uncle Wally. He raises an eyebrow and keeps on watching.',
        effects: { budget: -10, partnership: 1, mood: { [WALLY]: 1 } },
        preview: { helps: [C('budgerigar', 'A clean waterhole edge')], hurts: [T('Hard, slow work every day'), R(WALLY, 'Still not asked')] },
      },
    ],
  },
  {
    id: 'a1-bore', title: 'Bore or tanks?', phase: 'act1', years: [1930, 1975], speaker: PETE,
    setup: 'The waterhole cannot water a growing town and a station as well. Pete says the answer is a bore into the aquifer. The council points out that rainwater tanks cost nothing to run, but rain out here comes in rare big falls and then not at all.',
    evidence: 'Groundwater is reliable in a drought, but an aquifer that refills slowly can be drained if more is pumped than flows back in. Rain tanks capture water free of pumping, but only when it rains and only as much as they can store. Using both gives a buffer, and bores are usually metered and monitored.',
    options: [
      {
        id: 'bore', label: 'Sink a bore and pump as needed',
        outcome: 'Cheap and steady. The town grows without a thought for the water. Pete\'s trough fills in a drought, and nobody checks how far the level has dropped.',
        effects: { budget: -8, flags: { 'o.bore1': 1 }, mood: { [PETE]: 4 } },
        preview: { helps: [E('Reliable water at low cost'), R(PETE, 'Water for his cattle')], hurts: [P('The aquifer refills very slowly'), C('budgerigar', 'Less to top the waterhole up')] },
      },
      {
        id: 'both', label: 'A bore for a base supply plus tanks for rain, and watch the level', evidenceBacked: true,
        outcome: 'It costs more, but the town has a reserve when the rain fails. The bore level is written on a board outside the council chambers, and by-laws keep the pumping modest.',
        effects: { budget: -18, flags: { 'o.bore1': 1, 'o.tanks': 1 }, mood: { [PETE]: 2 } },
        preview: { helps: [P('A slower draw on the aquifer'), T('Water in dry spells')], hurts: [E('The highest cost of the three')] },
      },
      {
        id: 'tanks', label: 'Rainwater tanks on every roof, no bore',
        outcome: 'In a wet year the tanks overflow. In a dry year they run empty by February and the water cart runs from the waterhole. Pete is not impressed.',
        effects: { budget: -12, tiles: [{ op: 'water', scope: 'wetland', add: 0.08 }], mood: { [PETE]: -5 } },
        preview: { helps: [P('No pumping from the aquifer')], hurts: [T('Tanks empty in a long dry'), R(PETE, 'Cattle without water in a drought')] },
      },
    ],
  },
  {
    id: 'a1-dust', title: 'Dust on the washing', phase: 'act1', years: [1955, 2005], speaker: BEV,
    when: { all: [t('count.coalmine', '>=', 1)] },
    setup: 'Haul trucks and blasting lift fine red dust that settles on everything, including lungs. Bev has noticed more coughs at the bar and more kids with puffers. The mine could water the haul roads, cover loads, or leave things as they are.',
    evidence: 'Fine dust particles can be breathed deep into the lungs. Spraying haul roads with water and covering loads keeps a lot of dust out of the air, and these are standard controls on mine sites. They use water, which is scarce here, so the benefit has to be weighed against that cost.',
    options: [
      {
        id: 'spray', label: 'Water the haul roads and cover the loads', evidenceBacked: true,
        outcome: 'The air clears on still days, and Bev counts fewer coughs. The water cart uses a lot of water, and Pete mutters about it at the bar.',
        effects: { budget: -12, tiles: [{ op: 'air', scope: 'all', mult: 0.75 }], mood: { [BEV]: 5, [PETE]: -2 } },
        preview: { helps: [T('Fewer coughs and puffers'), R(BEV, 'Healthier regulars')], hurts: [E('Running costs'), R(PETE, 'The mine drinks more water')] },
      },
      {
        id: 'ignore', label: 'Leave it, jobs matter more',
        outcome: 'The dust stays. Everyone in town learns to wipe the sills daily and to shut the windows. Nothing in the pay packet changes.',
        effects: { budget: 4, society: -1, mood: { [BEV]: -3 } },
        preview: { helps: [E('No extra cost')], hurts: [T('Lungs of kids and workers'), R(BEV, 'More coughs at the bar')] },
      },
      {
        id: 'houses', label: 'Move the new houses upwind of the pit',
        outcome: 'The new houses go up on the windward side and the dust blows past. The old streets still get a dose, and the move adds to the cost of building.',
        effects: { budget: -18, tiles: [{ op: 'air', scope: 'all', mult: 0.9 }] },
        preview: { helps: [T('Newer homes breathe easier')], hurts: [E('Costly to build'), T('Older streets still get the dust')] },
      },
    ],
  },
  {
    id: 'a1-housing', title: 'Camp or homes?', phase: 'act1', years: [1990, 2020], speaker: SHAZ, noCleanAnswer: true,
    when: { all: [t('count.coalmine', '>=', 1)] },
    setup: 'The mine wants to grow, and needs workers. It could build a fly-in-fly-out camp, where crews live for two weeks and fly home. Or the town could build homes for families. Shaz would love the school full and the pub busy. Others like the camp for its cost.',
    evidence: 'A fly-in-fly-out camp can be built fast and avoids building a whole town for a mine that will close one day. But towns with families support schools, clinics and shops all year round. Research on fly-in-fly-out work shows mixed results for wellbeing: some workers like the roster, others find the time away hard.',
    options: [
      {
        id: 'fifo', label: 'Build a fly-in-fly-out camp',
        outcome: 'The camp goes up fast, the mine staffs up, and the runway gets busier. The pub gets a rush on payday and goes quiet between rosters. The school roll stays small.',
        effects: { budget: -10, incomePerYear: 1, society: -1, mood: { [SHAZ]: -4, [BEV]: -2 } },
        preview: { helps: [E('Cheaper and faster to start')], hurts: [R(SHAZ, 'No new families on her street'), T('Fewer kids in the school')] },
      },
      {
        id: 'homes', label: 'Build homes for families to live in town',
        outcome: 'It takes longer and costs more. The school gains two new classes, the clinic gets a second nurse, and Bev adds a kids\' menu. A closure would hurt more here.',
        effects: { budget: -25, society: 2, mood: { [SHAZ]: 7, [BEV]: 5 } },
        preview: { helps: [T('A school, a clinic and a town that lasts'), R(SHAZ, 'Her neighbours and her kids\' classmates')], hurts: [E('Higher cost'), T('More people when the mine closes')] },
      },
      {
        id: 'mix', label: 'A small camp for peak times, homes for the permanent crew',
        outcome: 'It is a compromise. The mine can ramp up, and the town keeps a core of families. Nobody gets quite what they asked for, and the camp and the town do not always mix.',
        effects: { budget: -18, society: 0.5, mood: { [SHAZ]: 2 } },
        preview: { helps: [T('A steadier town and a flexible workforce')], hurts: [E('Two lots of building'), T('Some tension between camp and town')] },
      },
    ],
  },

  // ------------------------------------------------------------------------------------------------ Act 2
  {
    id: 'a2-rangers', title: 'A ranger program', phase: 'act2', years: [2025, 2100], repeat: 30, speaker: WALLY, needsConsultation: true,
    setup: 'Uncle Wally ran a ranger crew on a shoestring for years. They know the plants, the water and the animals. He asks the town to fund a proper program, with wages, vehicles and training. Councillors worry about the cost, and about whether it will last.',
    evidence: 'Indigenous ranger programs across Australia do work such as fire management, weed and feral animal control, and monitoring wildlife. Studies of them report benefits for the land, for jobs and for community wellbeing, often well beyond the cost. Secure, long-term funding and Traditional Owner leadership are what make them work.',
    options: [
      {
        id: 'full', label: 'Fund a full-time ranger crew with wages and training', evidenceBacked: true, needsConsultation: true,
        outcome: 'Six rangers start in the new green shirts. Within a year they are running the bilby surveys and the water monitoring. Uncle Wally calls it the best meeting he ever had.',
        effects: { budget: -25, incomePerYear: -1, partnership: 8, flags: { 'rangers.funded': 1 }, mood: { [WALLY]: 10, [KIDS]: 3 } },
        preview: { helps: [R(WALLY, 'Real jobs and a real say'), C('bilby', 'More people watching and caring for the ground'), T('Local jobs')], hurts: [E('A yearly cost')] },
      },
      {
        id: 'seasonal', label: 'Fund a few seasonal jobs each year', needsConsultation: true,
        outcome: 'Three or four people get work over summer, and it is a start. When the money runs out in autumn, the crew drifts back to other jobs, and the knowledge goes with them.',
        effects: { budget: -8, partnership: 3, mood: { [WALLY]: 3 } },
        preview: { helps: [R(WALLY, 'Some work, some recognition')], hurts: [R(WALLY, 'Not enough to keep a team together'), E('Little long-term return')] },
      },
      {
        id: 'later', label: 'Not this year',
        outcome: 'The budget is tight. Uncle Wally nods and says he will keep the crew going on weekends. The truck he lends them is held together with fencing wire.',
        effects: { partnership: -2, mood: { [WALLY]: -6 } },
        preview: { helps: [E('Saves money now')], hurts: [R(WALLY, 'Still waiting to be backed'), P('Land care slips')] },
      },
    ],
  },
  {
    id: 'a2-closure', title: 'When should the mine close?', phase: 'act2', years: [2025, 2050], speaker: SHAZ, noCleanAnswer: true,
    when: { all: [t('count.coalmine', '>=', 1)] },
    setup: 'The ore will last another twenty years, maybe more. Closing early cuts emissions and starts the repair sooner, and a transition fund could soften the blow. Running to the end keeps wages and the town alive for longer. Shaz is on both sides of this at once.',
    evidence: 'A mine that closes early cuts its emissions, diesel use and water use sooner. A planned closure with retraining and a transition fund usually does better for workers than a sudden one. Running to the end of the ore means more years of jobs, but a larger town left facing the end. Neither avoids a hard day.',
    options: [
      {
        id: 'early', label: 'Plan an early close with a transition fund',
        outcome: 'The town agrees on a date and a fund for retraining and the rehabilitation crew. Shaz is pleased and scared. Emissions will drop, and the wages stop sooner.',
        effects: { budget: -30, incomePerYear: -2, emissionsKt: -8, flags: { 'mine.retrain': 1, 'mine.earlyClose': 1 }, mood: { [SHAZ]: 4 } },
        preview: { helps: [P('Emissions and water use fall sooner'), R(SHAZ, 'A plan with her name on it')], hurts: [E('Less income for the town'), T('Some jobs end sooner than workers hoped')] },
      },
      {
        id: 'run', label: 'Run the mine to the end of the ore',
        outcome: 'The trucks keep rolling, and the pay stays good for twenty more years. When the end comes, there are more people to find work for, and a bigger pit to fix. Rohan frowns at his graphs.',
        effects: { incomePerYear: 2, emissionsKt: 12, mood: { [SHAZ]: 6, [ROHAN]: -5 } },
        preview: { helps: [R(SHAZ, 'Wages and a steady town'), E('Income for years')], hurts: [P('More emissions and water use'), R(ROHAN, 'A deeper pit and a later start')] },
      },
    ],
  },
  {
    id: 'a2-pit', title: 'What to do with the pit', phase: 'act2', years: [2028, 2060], speaker: ROHAN, needsConsultation: true, noCleanAnswer: true,
    setup: 'Rohan lays out three options for the open-cut pit. Fill it back in. Reshape the walls, spread topsoil and revegetate. Or let it fill with water and become a lake. Uncle Wally and the Traditional Owners want to be asked about each one.',
    evidence: 'Filling a pit completely takes a huge amount of material and diesel. Reshaping the walls and revegetating is the usual approach, but it leaves a hollow. Pit lakes can be saline or acidic and can lose a lot of water to evaporation, though some become habitat. All of them need long monitoring.',
    options: [
      {
        id: 'backfill', label: 'Backfill the pit as far as the spoil goes', needsConsultation: true,
        outcome: 'It takes years and a lot of diesel, but the ground is level and the old hole is gone. The spoil heaps that remain are sculpted too. The bill is the biggest of the three.',
        effects: { budget: -30, emissionsKt: 10, flags: { 'rehab.plan': 1 }, partnership: 2, mood: { [WALLY]: 3, [ROHAN]: 1 } },
        preview: { helps: [P('No deep void left'), R(WALLY, 'Country restored more fully')], hurts: [E('Very expensive'), P('Diesel and emissions during works')] },
      },
      {
        id: 'reshape', label: 'Reshape the walls, spread topsoil and plant local species', needsConsultation: true,
        outcome: 'The slopes are softened and the topsoil is spread. A seed crew with Uncle Wally collects from the surrounding country. In five years a green skin is on the red. A hollow remains.',
        effects: { budget: -18, flags: { 'rehab.plan': 2 }, partnership: 5, mood: { [WALLY]: 7, [ROHAN]: 5 } },
        preview: { helps: [C('bilby', 'Shrubland to dig in'), R(WALLY, 'Asked and involved'), R(ROHAN, 'The standard, tested approach')], hurts: [E('Several years of work and monitoring')] },
      },
      {
        id: 'lake', label: 'Let the pit fill and become a lake', needsConsultation: true,
        outcome: 'It costs less. The lake turns a surprising colour, birds come, and the water is too salty to drink. Evaporation takes metres off the top every summer. Some are pleased and some are not.',
        effects: { budget: -6, flags: { 'rehab.plan': 3 }, partnership: -1, mood: { [WALLY]: -2, [PETE]: -2 } },
        preview: { helps: [E('The cheapest option'), C('budgerigar', 'Another water for birds')], hurts: [P('Salty water and heavy evaporation'), R(WALLY, 'Not the ground he wanted back')] },
      },
    ],
  },
  {
    id: 'a2-solar', title: 'Where to put the solar farm', phase: 'act2', years: [2025, 2060], speaker: ROHAN, needsConsultation: true,
    setup: 'The sun is the town\'s greatest asset and the farm needs a big flat site. Rohan has three. The open plains by the road, the old spoil heaps by the pit, or the flat by the creek crossing, which has the best access. Uncle Wally says that flat matters to his family.',
    evidence: 'Solar farms use a lot of land. Building them on land that is already disturbed, such as mine spoil, avoids clearing habitat. Clearing healthy shrubland costs wildlife its home and releases stored carbon. Talking with Traditional Owners before choosing a site is now standard practice and avoids damaging places that cannot be replaced.',
    options: [
      {
        id: 'plains', label: 'The open plains by the road',
        outcome: 'It is flat, cheap and close to the line. A good stretch of mulga and spinifex is cleared, and the dust blows. Bilby diggings near the fence line stop turning up.',
        effects: { budget: -4, tiles: [{ op: 'health', scope: 'land', mult: 0.92 }], flags: { 'solar.site': 1 }, mood: { [WALLY]: -2 } },
        preview: { helps: [E('Cheapest to build')], hurts: [C('bilby', 'Shrubland cleared'), P('Habitat and soil carbon lost')] },
      },
      {
        id: 'spoil', label: 'The old spoil heaps by the pit', evidenceBacked: true,
        outcome: 'It is already disturbed and nobody lives on it. The panels sit on tidy terraces, and the heaps stop shedding dust. It takes extra earthworks and the cable run is longer.',
        effects: { budget: -14, flags: { 'solar.site': 2 }, mood: { [ROHAN]: 5, [WALLY]: 4 }, partnership: 2 },
        preview: { helps: [C('bilby', 'Healthy shrubland stays standing'), P('Clean power without new clearing')], hurts: [E('Extra earthworks and cable')] },
      },
      {
        id: 'creek', label: 'The flat by the creek crossing', needsConsultation: true,
        outcome: 'It has the best access and the best sun. Nobody asked Uncle Wally first, and he comes to see it with his arms folded. The farm hums. The conversation gets a lot harder.',
        effects: { budget: 4, partnership: -8, flags: { 'solar.site': 3 }, mood: { [WALLY]: -12 } },
        preview: { helps: [E('The easiest and cheapest build')], hurts: [R(WALLY, 'A place that matters built on without asking'), T('Trust takes a hit')] },
      },
    ],
  },
  {
    id: 'a2-heat', title: 'A place to cool off', phase: 'act2', years: [2026, 2100], speaker: BEV, repeat: 25,
    setup: 'The last heatwave left Bev with a bar full of old blokes and no ice. The town can set up a proper cool room. At the pub it would be easy to reach. At the school it would be quiet and safe. Or it can plant shade trees, which take years to grow.',
    evidence: 'Heat kills people, especially older people, babies and those living alone. Cool rooms save lives during extreme heat, if they are close, trusted and have power that does not fail. Shade trees lower the temperature near buildings by several degrees, but take years to grow, and need water.',
    options: [
      {
        id: 'pub', label: 'A cool room at the pub, with backup power', evidenceBacked: true,
        outcome: 'Bev gets a bigger air conditioner and a battery. On the next hot day the pub fills with people who already trust it. A taxi driver delivers ice. Bev says it is the best money the town ever spent.',
        effects: { budget: -14, flags: { 'heat.refuge': 1 }, mood: { [BEV]: 8 }, society: 0.5 },
        preview: { helps: [R(BEV, 'A town cool room that works'), T('Fewer heat deaths')], hurts: [E('Power and upkeep every year')] },
      },
      {
        id: 'school', label: 'A cool room at the school',
        outcome: 'The school hall gets a new air conditioner. Children and teachers are cool and the school becomes a refuge on weekends. Older people have a longer, hotter walk.',
        effects: { budget: -12, flags: { 'heat.refuge': 2 }, mood: { [KIDS]: 4, [BEV]: -2 } },
        preview: { helps: [R(KIDS, 'A cool place at school'), T('A safe and quiet space')], hurts: [R(BEV, 'Elderly regulars further from help')] },
      },
      {
        id: 'trees', label: 'Plant shade trees and shelters along the main street',
        outcome: 'Shade shelters go up and trees go in with tree guards and a drip line. In five years the street feels different. Meanwhile the next heatwave arrives with the saplings still thin.',
        effects: { budget: -10, flags: { 'heat.refuge': 3 }, tiles: [{ op: 'health', scope: 'land', add: 0.05 }] },
        preview: { helps: [P('More shade and some cooling'), C('rock-wallaby', 'Cooler ground and cover')], hurts: [T('Not enough relief for the first few summers')] },
      },
    ],
  },
  {
    id: 'a2-water', title: 'The water is running low', phase: 'act2', years: [2030, 2100], speaker: PETE, repeat: 25,
    when: { any: [t('aquifer', '<=', 62), t('unmetPct', '>=', 5)] },
    setup: 'The bore levels are dropping, and the waterhole shrinks every dry season. Pete says the town has to use less. The council can ban sprinklers and washing down, run a water-saving program, or truck in water at great expense. Everyone is already irritable.',
    evidence: 'Reducing demand is the cheapest way to protect a slow-refilling aquifer. Fixing leaks, using rain tanks and efficient taps can cut town use by a fifth. Restrictions work fast but wear on patience if they last. Trucking in water is costly, uses diesel and does not fix the shortage underneath.',
    options: [
      {
        id: 'restrict', label: 'Level 1 water restrictions: no sprinklers or washing down',
        outcome: 'The sprinklers stop and the lawns brown, and a few neighbours squabble about whose hose is whose. Water use falls straight away. Patience is the cost.',
        effects: { flags: { 'pol.water.restrict': 1 }, stress: 3, mood: { [PETE]: 3, [BEV]: -3 } },
        preview: { helps: [P('Less drawn from the aquifer'), R(PETE, 'The bores last longer')], hurts: [T('Short tempers and brown lawns'), R(BEV, 'Fewer pub garden days')] },
      },
      {
        id: 'saving', label: 'Fund a water-saving program: fix leaks, tanks and taps', evidenceBacked: true,
        outcome: 'Plumbers fix leaks, every house gets efficient taps and a rain tank rebate. Use falls by about a fifth without anyone going without. It takes a year to show up in the bore readings.',
        effects: { budget: -12, flags: { 'o.saving': 1 }, mood: { [PETE]: 5, [ROHAN]: 4 }, society: 0.5 },
        preview: { helps: [P('Lasting cuts in water use'), T('No daily rules')], hurts: [E('Up-front cost'), T('Slower than restrictions')] },
      },
      {
        id: 'tanker', label: 'Truck in tanker water for the dry months',
        outcome: 'A tanker rolls in from the coast three days a week. Taps run, but the bill is steep and the trucks run on diesel. The bores are not helped one bit.',
        effects: { budget: -22, emissionsKt: 4, mood: { [ROHAN]: -3 } },
        preview: { helps: [T('Water now, no rules')], hurts: [E('Very expensive'), P('Diesel emissions'), R(ROHAN, 'Nothing fixes the shortage underneath')] },
      },
    ],
  },
  {
    id: 'a2-ferals', title: 'Cats, foxes and bilbies', phase: 'act2', years: [2040, 2100], repeat: 30, speaker: KIDS, needsConsultation: true, noCleanAnswer: true,
    setup: 'Tia and Ben found a cat track beside the bilby burrow. Feral cats and foxes are the biggest threat to bilbies and rock-wallabies. A fenced reserve is safe but costly. Baiting covers far more ground but is blunter. A bigger ranger crew can do both slowly.',
    evidence: 'Feral cats and foxes are the main reasons many small desert mammals have disappeared. Predator-proof fences protect animals inside, but they are expensive to build and keep up. Baiting works over big areas but can affect other animals and needs care. Rangers can track, trap and monitor with Country knowledge, though the area is huge.',
    options: [
      {
        id: 'fence', label: 'Build a predator-proof fenced reserve',
        outcome: 'A tall fence with a floppy top goes up around the best shrubland. Bilbies inside do very well. The fence cost a fortune, and outside it nothing has changed. A wallaby gets caught on the wire.',
        effects: { budget: -30, flags: { 'ferals.fence': 1 }, tiles: [{ op: 'health', scope: 'land', add: 0.03 }], mood: { [KIDS]: 8, [WALLY]: -2 } },
        preview: { helps: [C('bilby', 'Safe inside the fence'), R(KIDS, 'A place the bilbies are safe')], hurts: [E('Costly to build and maintain'), C('rock-wallaby', 'Nothing changes outside the fence')] },
      },
      {
        id: 'bait', label: 'Aerial baiting over the shrubland and the range',
        outcome: 'Planes drop baits across thousands of hectares. Fox and cat numbers fall. A few goannas and other animals are caught too, and Uncle Wally is worried. The baiting must be repeated yearly.',
        effects: { budget: -14, flags: { 'ferals.bait': 1 }, mood: { [KIDS]: 2, [WALLY]: -4 } },
        preview: { helps: [C('bilby', 'Fewer predators over a big area'), C('rock-wallaby', 'Fewer foxes on the range')], hurts: [P('Other animals may be harmed'), R(WALLY, 'Not asked how it should be done')] },
      },
      {
        id: 'crew', label: 'Double the ranger crew to track and trap', needsConsultation: true,
        outcome: 'Rangers walk the country for tracks, set cage traps and check cameras. Fewer cats get caught than from baiting, but the right ones. Uncle Wally teaches the new recruits to read the dirt.',
        effects: { budget: -20, incomePerYear: -1, partnership: 5, flags: { 'ferals.rangers': 1 }, mood: { [WALLY]: 7, [KIDS]: 5 } },
        preview: { helps: [R(WALLY, 'Rangers leading on Country'), C('bilby', 'Targeted predator control')], hurts: [E('A running wage bill'), P('Slow work over a huge area')] },
      },
    ],
  },
  {
    id: 'a2-hydrogen', title: 'A hydrogen proposal', phase: 'act2', years: [2045, 2100], repeat: 30, speaker: SHAZ, noCleanAnswer: true,
    setup: 'A company wants to build a green hydrogen plant next to the new solar farm. It would bring hundreds of jobs and good money. It would also need a great deal of water, which is the one thing the town cannot spare. Shaz can see both sides, and so can Pete.',
    evidence: 'Making green hydrogen by electrolysis needs about nine litres of water for each kilogram of hydrogen, plus more for cooling. In a dry region that competes with towns, stock and wildlife. Plants can use treated or desalinated water, or recycle water, but those add cost and energy. The jobs and clean fuel are real, but so is the demand on a scarce supply.',
    options: [
      {
        id: 'accept', label: 'Accept the plant on the company\'s plan',
        outcome: 'Construction starts and the town fills with work boots. Shaz\'s cousin gets a job. The bores take a harder hit, and the level on the council\'s board creeps down.',
        effects: { budget: 20, incomePerYear: 3, stress: 4, flags: { 'ind.hydrogen': 1 }, mood: { [SHAZ]: 7, [PETE]: -6 } },
        preview: { helps: [E('Big new income and jobs'), R(SHAZ, 'Work for her family and friends')], hurts: [P('A big new demand on the water'), R(PETE, 'The bores come under more strain')] },
      },
      {
        id: 'decline', label: 'Decline: the water matters more',
        outcome: 'The company packs up and looks elsewhere. The town keeps its water and its quiet. Some young people leave for the jobs they were hoping for, and Shaz is sad about that.',
        effects: { mood: { [PETE]: 5, [SHAZ]: -5 }, society: -0.5 },
        preview: { helps: [P('Water stays in the aquifer'), R(PETE, 'The bores are safer')], hurts: [E('A big chance goes elsewhere'), R(SHAZ, 'Fewer jobs for her kids')] },
      },
      {
        id: 'conditions', label: 'Accept only with a smaller plant, recycled water and its own supply',
        outcome: 'The company grumbles and halves its plans. The plant recycles water and brings in its own desalinated supply, which costs it more. Fewer jobs, less strain, and everyone gets part of what they wanted.',
        effects: { budget: 8, incomePerYear: 1, stress: 1, flags: { 'ind.hydrogen': 2 }, mood: { [SHAZ]: 2, [PETE]: 1 } },
        preview: { helps: [E('Some income and jobs'), P('A much smaller draw on the water')], hurts: [R(SHAZ, 'Fewer jobs than hoped'), E('The company\'s costs go up')] },
      },
    ],
  },
  {
    id: 'a2-school', title: 'Keeping the school open', phase: 'act2', years: [2045, 2095], speaker: BEV,
    when: { any: [t('count.coalmine', '<=', 0), t('year', '>=', 2070)] },
    setup: 'With fewer families, the school roll has dropped to a handful and the clinic only has a nurse three days a week. Without them, families leave. Bev wants both kept, but they cost money the town is not sure it has. Tia and Ben say it is their school.',
    evidence: 'Schools and clinics are among the biggest reasons families stay in a small town, and the loss of either often leads to more leaving. Remote schools can combine local teachers with online learning and visiting specialists. Telehealth and the Flying Doctor keep clinics going, and are cheaper than a full-time doctor.',
    options: [
      {
        id: 'both', label: 'Keep the school and clinic going with a new community hub', evidenceBacked: true,
        outcome: 'The old mine office becomes a hub with the school, the clinic and a telehealth room under one roof. The Flying Doctor visits twice a month. Families stay, and the pub is busy at pick-up time.',
        effects: { budget: -22, incomePerYear: -1, society: 2, mood: { [BEV]: 7, [KIDS]: 7 } },
        preview: { helps: [T('A school and a clinic that stay'), R(KIDS, 'Their school stays open')], hurts: [E('A yearly cost the town must carry')] },
      },
      {
        id: 'school-only', label: 'Keep only the school, and use telehealth for the clinic',
        outcome: 'The school stays open and the clinic goes to video visits from a hub in the pub. The Flying Doctor still lands for emergencies. Older people find the screen hard.',
        effects: { budget: -12, society: 0.5, mood: { [KIDS]: 4, [BEV]: 1 } },
        preview: { helps: [R(KIDS, 'School stays'), E('Cheaper than both')], hurts: [T('Older residents struggle with telehealth')] },
      },
      {
        id: 'close', label: 'Close both and bus children to the next town',
        outcome: 'The savings are real. The school bus leaves at six every morning and the clinic doors are locked. Within a year the town feels older and smaller. Bev does not say a word.',
        effects: { budget: 10, society: -2, mood: { [BEV]: -8, [KIDS]: -8 } },
        preview: { helps: [E('Money saved')], hurts: [T('The town loses its heart'), R(KIDS, 'A long bus ride every day')] },
      },
    ],
  },
  {
    id: 'a2-handback', title: 'Who looks after the new ground?', phase: 'act2', years: [2060, 2100], speaker: WALLY, needsConsultation: true,
    when: { all: [t('rehabPct', '>=', 40)] },
    setup: 'The rehabilitated ground is turning green, and the question now is who looks after it. The Traditional Owners would like to manage it together with the town. The council could keep it as a reserve. Or it could be leased out for solar or grazing.',
    evidence: 'Joint management of land between Traditional Owners and government is used across Australia for national parks and other reserves. It brings Traditional Owner knowledge of seasons, plants, fire and water, and it gives people a stake in the result. It works best when both sides share decisions and resources over the long term.',
    options: [
      {
        id: 'joint', label: 'Joint management with the Traditional Owners', evidenceBacked: true, needsConsultation: true,
        outcome: 'A joint management group meets on the veranda of the old mine office, with the kettle on. Uncle Wally\'s grandson is its youngest member. The town gives up some control and gains a lot.',
        effects: { budget: -8, partnership: 8, flags: { 'land.jointMgmt': 1 }, mood: { [WALLY]: 12, [ROHAN]: 4 } },
        preview: { helps: [R(WALLY, 'A real share in decisions'), C('bilby', 'Country knowledge in the care of the ground')], hurts: [E('Needs ongoing funding'), T('The town shares decisions')] },
      },
      {
        id: 'reserve', label: 'A town reserve managed by the council',
        outcome: 'The reserve gets a fence, some signs and a ranger one day a week. It is tidy and well meant. Uncle Wally comes to the opening and shakes everyone\'s hand and asks, politely, who decides.',
        effects: { budget: -6, partnership: -1, mood: { [WALLY]: -2 } },
        preview: { helps: [T('Simple and local')], hurts: [R(WALLY, 'Not a partner in the decision')] },
      },
      {
        id: 'lease', label: 'Lease it out for solar and grazing',
        outcome: 'The lease brings in steady money and some of the green gets grazed. Rohan wonders aloud what five years of monitoring was for. The first dry year, the cattle go to the soft new growth.',
        effects: { budget: 12, incomePerYear: 2, partnership: -5, mood: { [WALLY]: -8, [ROHAN]: -6, [PETE]: 3 } },
        preview: { helps: [E('Steady income'), R(PETE, 'More grazing country')], hurts: [R(WALLY, 'The ground he helped repair is leased out'), C('bilby', 'Shrubland grazed again')] },
      },
    ],
  },
];
