/**
 * Dilemma cards for Coal Coast: 5 in Act 1 (about one every 20 years) and 22 in Act 2 (two per in-game decade; 27 cards in all after the round-4 trim).
 * Several have no clean answer on purpose. Each option lists who it helps and hurts, for the perspective-taking
 * preview, and every card carries an accurate "what does the evidence say?" blurb.
 */
import { t } from '../../sim/conditions';
import type { DilemmaDef, PreviewTarget } from '../../sim/dilemmas';

const MICK = 'mick-kowalski';
const LENA = 'lena-tran';
const JUNE = 'aunty-june';
const PRIYA = 'priya-shah';
const KIDS = 'sam-jordan';
const DOT = 'dot-harris';

const R = (id: string, why: string): PreviewTarget => ({ type: 'resident', id, why });
const C = (id: string, why: string): PreviewTarget => ({ type: 'creature', id, why });
const P = (why: string): PreviewTarget => ({ type: 'planet', id: 'planet', why });
const E = (why: string): PreviewTarget => ({ type: 'economy', id: 'economy', why });
const T = (why: string): PreviewTarget => ({ type: 'town', id: 'town', why });

export const COAL_COAST_DILEMMAS: readonly DilemmaDef[] = [
  // ------------------------------------------------------------------------------------------------ Act 1
  {
    id: 'a1-outfall', title: 'The cheap pipe', phase: 'act1', years: [1880, 1940], speaker: LENA,
    setup: 'The new streets are growing, and so is the sewage. The council can pipe it straight out to the estuary, build a settling tank first, or have every house dig a septic pit. Each costs a different amount, and the estuary is where all of it ends up.',
    evidence: 'Sewage is rich in nitrogen and phosphorus. In an estuary these feed algae, and when the algae die, bacteria use up the oxygen and fish suffocate. Settling removes suspended solids, but much dissolved nitrogen and phosphorus remains. Additional treatment is needed to remove nutrients and pathogens, which is why most towns eventually built treatment plants.',
    options: [
      {
        id: 'pipe', label: 'Pipe it straight to the estuary',
        outcome: 'It is quick and cheap. The smell leaves the streets and turns up in the shallows.',
        effects: { tiles: [{ op: 'water', scope: 'estuary', add: 0.25 }], mood: { [LENA]: -4 } },
        preview: { helps: [E('Cheapest option today')], hurts: [R(LENA, 'The fish she depends on'), C('shorebirds', 'Feeding grounds fouled'), P('Nutrients feed algae')] },
      },
      {
        id: 'tank', label: 'Build a settling tank first', evidenceBacked: true,
        outcome: 'The tank costs real money, but the water by the boat ramp stays clearer and the oysters hold on.',
        effects: { budget: -20, tiles: [{ op: 'water', scope: 'estuary', mult: 0.9 }], mood: { [LENA]: 3 } },
        preview: { helps: [R(LENA, 'Cleaner water for her catch'), P('Fewer solids reach the water')], hurts: [E('Costs money the town does not yet have')] },
      },
      {
        id: 'pits', label: 'Septic pits for every house',
        outcome: 'Households grumble about the digging. The estuary gets a little less, but the creek smells in wet weather.',
        effects: { budget: -8, tiles: [{ op: 'water', scope: 'estuary', add: 0.1 }] },
        preview: { helps: [E('Cheaper than a tank')], hurts: [T('Smelly in wet weather'), P('Seepage into the creek')] },
      },
    ],
  },
  {
    id: 'a1-ridge', title: 'A request about the ridge', phase: 'act1', years: [1900, 1970], speaker: JUNE, needsConsultation: true,
    setup: 'The town needs more homes, and the ridge above the creek is the obvious place. Aunty June has asked to talk before the bush is cleared. She says there are places on the ridge with meaning for her family. Builders say every month of waiting costs money.',
    evidence: 'Bush on a slope holds the soil, shelters animals and slows the water running into the creek. Clearing it also releases the carbon stored in plants and soil. Planning should involve the relevant Traditional Owners early, because they hold knowledge of Country and of places that matter, and it avoids costly mistakes.',
    options: [
      {
        id: 'clear', label: 'Clear the ridge now', needsConsultation: true,
        outcome: 'The homes go up quickly. Aunty June is quiet when the bulldozers arrive. Someone remarks that nobody asked.',
        effects: { budget: 10, partnership: -6, emissionsKt: 12, mood: { [JUNE]: -10 } },
        preview: { helps: [E('Homes and jobs sooner')], hurts: [R(JUNE, 'Not asked before her family\'s places were disturbed'), P('Carbon released from cleared bush')] },
      },
      {
        id: 'ask', label: 'Talk with Aunty June first, then build lower down', evidenceBacked: true, needsConsultation: true,
        outcome: 'It takes a few weeks of yarning. The homes go on the lower slope, and the ridge is left standing. Aunty June thanks you for listening.',
        effects: { budget: -4, partnership: 7, mood: { [JUNE]: 10 } },
        preview: { helps: [R(JUNE, 'Asked first and listened to'), P('Ridge bush stays standing')], hurts: [E('A short delay and a slightly higher cost')] },
      },
      {
        id: 'flat', label: 'Build on the flat by the creek instead',
        outcome: 'The ridge stays wooded, but the flat floods in the next big storm and the creek takes more runoff.',
        effects: { budget: -10, tiles: [{ op: 'water', scope: 'river', add: 0.1 }] },
        preview: { helps: [P('Ridge bush stays')], hurts: [T('Homes in the flood zone'), E('Extra cost')] },
      },
    ],
  },
  {
    id: 'a1-smoke', title: 'Smoke over the town', phase: 'act1', years: [1940, 2010], speaker: MICK,
    when: { all: [t('heavyJobs', '>=', 100)] },
    setup: 'On still days a brown haze hangs over the streets. Mick and his mates know where it comes from, and they also know their wages come from the same chimneys. The works could build taller stacks, fit scrubbers and filters, or carry on as they are.',
    evidence: 'Tall chimneys spread pollution over a wider area rather than removing it, and some falls as acid rain downwind. Scrubbers and filters capture particles and gases before they leave the stack. Filters and scrubbers remove some pollutants; cleaner processes can prevent others. Both cost money.',
    options: [
      {
        id: 'tall', label: 'Build taller stacks',
        outcome: 'The haze thins over the town. It drifts to the hills and the next valley instead.',
        effects: { budget: -15, tiles: [{ op: 'air', scope: 'all', mult: 0.92 }] },
        preview: { helps: [T('Cleaner air at street level')], hurts: [P('Pollution moves, it does not go away')] },
      },
      {
        id: 'scrub', label: 'Fit scrubbers and filters', evidenceBacked: true,
        outcome: 'The works spend heavily on filters, and the brown haze fades. Mick says his daughter\'s cough has eased.',
        effects: { budget: -35, tiles: [{ op: 'air', scope: 'all', mult: 0.7 }], flags: { 'steel.filters': 1 }, mood: { [MICK]: 6 } },
        preview: { helps: [R(MICK, 'Cleaner air for his family'), P('Less pollution released')], hurts: [E('A big bill for the works')] },
      },
      {
        id: 'carry-on', label: 'Delay the upgrade to keep costs down',
        outcome: 'Nothing changes. Wages are paid on Friday, and the haze is still there on Monday.',
        effects: { budget: 5, mood: { [MICK]: -3 }, society: -1 },
        preview: { helps: [E('No extra cost')], hurts: [T('Lungs of children and workers'), P('Ongoing air pollution')] },
      },
    ],
  },
  {
    id: 'a1-strike', title: 'Trouble at the works', phase: 'act1', years: [1950, 2000], speaker: MICK, noCleanAnswer: true,
    when: { all: [t('heavyJobs', '>=', 100)] },
    setup: 'The steelworkers want safer machinery and a better wage after another injury on the floor. The company says it cannot afford both and stay competitive against cheaper overseas steel. Mick has a foot in each camp: he needs the job, and he saw the accident.',
    evidence: 'Studies link strong safety rules and worker representation with fewer injuries and deaths. Companies also face real cost pressure from competition, and some do close when costs rise. Mediation often settles disputes with less lost production than a long strike. People weigh these trade-offs differently, which is why this is hard.',
    options: [
      {
        id: 'workers', label: 'Back the workers\' demands',
        outcome: 'The works pay more and fit guards on the machines. Prices rise and the company threatens to cut shifts, but the injuries drop.',
        effects: { budget: -25, society: 2, mood: { [MICK]: 10 } },
        preview: { helps: [R(MICK, 'Safer work and better pay'), T('Fewer injuries')], hurts: [E('Higher costs; some risk to jobs later')] },
      },
      {
        id: 'company', label: 'Side with the company and hold costs down',
        outcome: 'The works stay profitable. A month later another man is hurt, and the mood on the floor turns sour.',
        effects: { budget: 15, society: -2, mood: { [MICK]: -8 } },
        preview: { helps: [E('Lower costs, steadier profits')], hurts: [R(MICK, 'Safety and pay unchanged'), T('Trust between workers and the town')] },
      },
      {
        id: 'mediate', label: 'Offer mediation and a shared deal',
        outcome: 'It takes three tough weeks. The deal gives modest raises and a safety committee. Nobody is delighted, and nobody walks out.',
        effects: { budget: -10, society: 1, mood: { [MICK]: 4 } },
        preview: { helps: [T('Peace and a shared deal'), R(MICK, 'Some safety and some pay')], hurts: [E('A moderate cost')] },
      },
    ],
  },
  {
    id: 'a1-tip', title: 'Where does the rubbish go?', phase: 'act1', years: [1960, 2020],
    setup: 'The tip by the creek is nearly full. The council can dig a bigger one, start collecting recyclables at the kerb, or burn the rubbish at the old works. Each makes the problem go somewhere else.',
    evidence: 'Rubbish rotting in landfill releases methane, a strong greenhouse gas. Recycling saves energy: making an aluminium can from recycled metal uses about 5% of the energy needed to make it from ore. Burning waste shrinks it but releases gases and ash that need careful filtering.',
    options: [
      {
        id: 'big-tip', label: 'Dig a bigger tip beside the creek',
        outcome: 'It is easy and cheap, and the smell and runoff become next generation\'s problem.',
        effects: { emissionsKt: 15, tiles: [{ op: 'soil', scope: 'land', add: 0.05 }] },
        preview: { helps: [E('Cheapest today')], hurts: [P('Methane and seepage for decades'), C('frogs', 'Creek water fouled')] },
      },
      {
        id: 'recycle', label: 'Start kerbside recycling', evidenceBacked: true,
        outcome: 'Households learn which bin to use. More material is recovered and less goes to the tip, which lasts years longer, though collection needs extra trucks and planning.',
        effects: { budget: -25, emissionsKt: -8, society: 1 },
        preview: { helps: [P('Less waste and less new material needed'), T('A tidier town')], hurts: [E('Needs money for bins and trucks')] },
      },
      {
        id: 'burn', label: 'Burn it at the old works',
        outcome: 'The pile shrinks and the haze thickens. Kids at the school next door cough on windy days.',
        effects: { tiles: [{ op: 'air', scope: 'all', add: 0.1 }], emissionsKt: 5, society: -1 },
        preview: { helps: [E('Cheap and quick')], hurts: [T('Children near the works'), P('Air pollution and CO2')] },
      },
    ],
  },

  // ------------------------------------------------------------------------------------------------ Act 2
  {
    id: 'd2-closure', title: 'The steelworks question', phase: 'act2', years: [2025, 2045], speaker: MICK, priority: 10,
    when: { all: [t('count.steelworks', '>=', 1)] },
    setup: 'The steelworks is the town\'s biggest employer and its biggest emitter. Mick and hundreds of workers want to know what is next. Closing with retraining costs money now. Closing in a hurry saves money but leaves workers little time to find new income. Keeping it open delays the problem.',
    evidence: 'When an industry closes suddenly, communities often suffer long-term unemployment and poorer health. Planned transitions with retraining and new local industries, like those in Germany\'s Ruhr region, tend to do better, though they are not painless. Steelmaking can also be changed rather than closed, using hydrogen instead of coal.',
    options: [
      {
        id: 'transition', label: 'Fund a retraining and transition program, then close', evidenceBacked: true,
        outcome: 'The program signs up workers within a fortnight: apprenticeships, retraining, a bridging payment. The furnace is scheduled to close, and for once the workers feel part of the plan.',
        effects: { budget: -40, society: 2, flags: { 'transition.funded': 1 }, mood: { [MICK]: 10, [PRIYA]: 2 } },
        preview: { helps: [R(MICK, 'A plan and a future'), P('Emissions fall'), T('Families stay')], hurts: [E('A big cost now')] },
      },
      {
        id: 'abrupt', label: 'Close it now to cut emissions fast',
        outcome: 'The gates close within the month. Emissions fall straight away, and so does the mood in the pub.',
        effects: { budget: 10, society: -3, flags: { 'closure.abrupt': 1 }, mood: { [MICK]: -12 } },
        preview: { helps: [P('Emissions drop at once'), E('Saves transition money')], hurts: [R(MICK, 'Job lost without a plan'), T('Little time to find new work')] },
      },
      {
        id: 'delay', label: 'Keep it running for now and plan later',
        outcome: 'The furnace rolls on. Nobody is happy, but nobody is angry either. The question stays on the table.',
        effects: { society: 0, mood: { [MICK]: 3, [PRIYA]: -5 } },
        preview: { helps: [R(MICK, 'The job stays for now')], hurts: [P('Emissions continue'), R(PRIYA, 'Warming clock keeps ticking')] },
      },
    ],
  },
  {
    id: 'd2-coalphase', title: 'Lights on, coal off?', phase: 'act2', years: [2025, 2050], speaker: PRIYA, priority: 8,
    when: { all: [t('count.coalpower', '>=', 1)] },
    setup: 'Coal still makes most of the town\'s electricity, and most of its carbon. Closing it before the grid is ready means blackouts. Gas could bridge the gap, but it is still a fossil fuel. Priya says wind, solar and batteries can carry most of the load if they come first.',
    evidence: 'Gas emits roughly half the CO2 of coal per unit of electricity, but methane leaks along the supply chain can eat into that advantage, and a new gas plant can lock in emissions for decades. Wind, solar and batteries are now cheap enough to supply much of the power. But retiring coal needs enough replacement generation, storage, grid connections and backup to meet demand through difficult weather periods, such as calm, dark evenings.',
    options: [
      {
        id: 'renewables-first', label: 'Build wind, solar and batteries first, then retire coal', evidenceBacked: true,
        outcome: 'The new capacity goes in over a few busy years. When the first coal unit finally switches off, with storage and backup ready, nobody notices the lights.',
        effects: { budget: -30, flags: { 'grid.renewablesFirst': 1 }, mood: { [PRIYA]: 6 } },
        preview: { helps: [P('Emissions fall for good'), R(PRIYA, 'A plan the data supports')], hurts: [E('A big upfront cost')] },
      },
      {
        id: 'gas-bridge', label: 'Switch to gas as a bridge',
        outcome: 'Gas turbines are quick to build and quick to ramp. They will also be there in 2060 unless somebody switches them off.',
        effects: { budget: -15, society: 1, flags: { 'grid.gasBridge': 1 }, mood: { [PRIYA]: -5 } },
        preview: { helps: [T('Reliable power sooner'), E('Cheaper than a fast renewable build')], hurts: [P('Still a fossil fuel, with methane leaks'), R(PRIYA, 'A step sideways')] },
      },
      {
        id: 'keep-coal', label: 'Keep coal until it wears out',
        outcome: 'The old units rumble on. Repairs are dear and the smoke is dirty. The bill is deferred, not removed.',
        effects: { budget: 10, society: -1, mood: { [PRIYA]: -8 } },
        preview: { helps: [E('No new spending')], hurts: [P('High emissions continue'), R(PRIYA, 'Warming goal slipping')] },
      },
    ],
  },
  {
    id: 'd2-fishing', title: 'A pause for the fish', phase: 'act2', years: [2025, 2045], speaker: LENA, noCleanAnswer: true, priority: 6,
    when: { all: [t('estuary', '<=', 55)] },
    setup: 'The estuary is struggling and fish stocks are thin. Scientists suggest a three-year netting pause so breeding fish can recover. Lena agrees in principle, but her family lives on the catch. Others say pollution is the real problem, not the fishing.',
    evidence: 'Fish stocks need both clean water and enough breeding adults. Pausing fishing lets populations rebuild faster, but if the water stays polluted the recovery stalls. Support payments can help fishing families through a pause.',
    options: [
      {
        id: 'pause', label: 'A three-year pause, with payments to the fishers',
        outcome: 'The nets stay in the shed. By the second year, young fish are back in the seagrass. Lena helps count them.',
        effects: { budget: -25, flags: { 'fishing.pause': 1 }, tiles: [{ op: 'health', scope: 'estuary', add: 0.1 }], mood: { [LENA]: 4 } },
        preview: { helps: [P('Breeding fish recover'), C('shorebirds', 'More food in the mud')], hurts: [R(LENA, 'No catch for three years'), E('Payments cost money')] },
      },
      {
        id: 'seasonal', label: 'Seasonal limits only',
        outcome: 'Fishers stay out in the breeding months. It helps a little, and it hurts a little less.',
        effects: { budget: -5, tiles: [{ op: 'health', scope: 'estuary', add: 0.04 }], mood: { [LENA]: 2 } },
        preview: { helps: [R(LENA, 'Still fishing most of the year')], hurts: [P('Slower recovery')] },
      },
      {
        id: 'water-first', label: 'No limits. Fix the water first.',
        outcome: 'Lena keeps working. The water gets attention, slowly. Some fishers say they should have been asked.',
        effects: { mood: { [LENA]: -2 } },
        preview: { helps: [R(LENA, 'Her livelihood is untouched')], hurts: [P('Fewer breeding fish'), C('shorebirds', 'Less food')] },
      },
    ],
  },
  {
    id: 'd2-turtlelights', title: 'Lights on the turtle beach', phase: 'act2', years: [2025, 2055], speaker: KIDS, priority: 7,
    when: { all: [t('pop.green-turtle', '>=', 1)] },
    setup: 'Old Shelly nests on the beach below the streetlights, and hatchlings follow the brightest horizon. Last summer some wandered onto the road. The kids want the lights changed. Shop owners say a dark street feels unsafe, and amber lights cost more.',
    evidence: 'Hatchling sea turtles find the ocean by heading toward the brightest horizon, so artificial lights confuse them. Amber or red lights, shielded and aimed downwards, are far less disruptive than white light, and still keep streets safe for people.',
    options: [
      {
        id: 'amber', label: 'Switch to shielded amber lights', evidenceBacked: true,
        outcome: 'The beach glows a soft orange instead of white. Volunteers say the hatchlings head for the sea.',
        effects: { budget: -18, flags: { 'turtle.lights': 1 }, mood: { [KIDS]: 8 } },
        preview: { helps: [C('green-turtle', 'Hatchlings find the sea'), R(KIDS, 'Their turtles are safer')], hurts: [E('Costs more than the old lights')] },
      },
      {
        id: 'lights-out', label: 'Lights out on the beach during nesting season',
        outcome: 'The beach goes properly dark in summer. Turtles like it. Some shopkeepers do not, and a few residents complain.',
        effects: { budget: -4, society: -1, flags: { 'turtle.lights': 2 }, mood: { [KIDS]: 6 } },
        preview: { helps: [C('green-turtle', 'A truly dark beach')], hurts: [T('Some feel less safe at night'), E('Late-night trade dips')] },
      },
      {
        id: 'leave', label: 'Leave the lights as they are',
        outcome: 'Nothing changes. A volunteer carries a hatchling back to the water by hand and shakes her head.',
        effects: { mood: { [KIDS]: -6 } },
        preview: { helps: [E('No cost')], hurts: [C('green-turtle', 'Hatchlings go the wrong way'), R(KIDS, 'Their concerns are brushed off')] },
      },
    ],
  },
  {
    id: 'd2-heat', title: 'Forty degrees and rising', phase: 'act2', years: [2028, 2100], repeat: 40, priority: 6,
    when: { all: [t('recent.heatwave', '>=', 1)] },
    setup: 'After days above forty, the old and the very young are suffering, and the flying-foxes are falling from the trees. The council has money for only one big step: shade trees, cooling centres in the old hall, or rebates for cool roofs.',
    evidence: 'Heat is among the deadliest natural hazards in Australia. Trees cool streets by several degrees through shade and evaporation, but take years to grow. Cooling centres save lives in an emergency. Cool roofs reduce indoor heat. None of these replaces cutting the emissions that make heatwaves hotter and more common.',
    options: [
      {
        id: 'trees', label: 'Plant street trees and shade the flying-fox camp', evidenceBacked: true,
        outcome: 'Hundreds of saplings go in. The shade is thin at first, but the flying-fox camp gets misters and cloth shade by summer.',
        effects: { budget: -20, society: 1, flags: { 'wildlife.shade': 1 }, tiles: [{ op: 'health', scope: 'land', add: 0.03 }] },
        preview: { helps: [C('flying-fox', 'Shade and cooler roosts'), T('Cooler streets in years to come'), P('Carbon stored in trees')], hurts: [E('Slow payoff; costs now')] },
      },
      {
        id: 'centres', label: 'Open cooling centres in the old hall',
        outcome: 'The hall fills on the worst days with elderly neighbours, toddlers and dogs. It saves people, and it fixes nothing outside.',
        effects: { budget: -10, society: 2 },
        preview: { helps: [T('Vulnerable people on the worst days')], hurts: [C('flying-fox', 'Nothing for the camp')] },
      },
      {
        id: 'cool-roofs', label: 'Rebates for cool roofs',
        outcome: 'Light-coloured roofs spread across town. Indoors drops a few degrees. It does little for the park or the camp.',
        effects: { budget: -25, society: 1, incomePerYear: 0 },
        preview: { helps: [T('Cooler homes'), E('Lower air-conditioning bills')], hurts: [C('flying-fox', 'Nothing for the camp')] },
      },
    ],
  },
  {
    id: 'd2-koalaroad', title: 'A road through koala country', phase: 'act2', years: [2028, 2075], speaker: KIDS, priority: 7,
    when: { all: [t('pop.koala', '>=', 1), t('count.road', '>=', 1)] },
    setup: 'A koala was found hurt beside the road where it cuts through the woodland. The kids want something done. Engineers can fence the verge and build crossings, lower the night speed limit, or leave things as they are. Drivers say they already take care.',
    evidence: 'Fenced underpasses and overpasses cut koala road deaths dramatically, because fences guide animals to the crossing. Signs and speed limits help less, but cost little. Without safe crossings, roads also split woodland into patches too small for koalas to live in.',
    options: [
      {
        id: 'fence-cross', label: 'Fence the verge and fund crossings', evidenceBacked: true,
        outcome: 'Fences funnel koalas towards a wildlife underpass. Cameras catch the first one crossing within a month, and kids gather to watch the footage.',
        effects: { budget: -30, flags: { 'koala.roadSafe': 1 }, mood: { [KIDS]: 8 } },
        preview: { helps: [C('koala', 'Safe passage between woodland patches'), R(KIDS, 'Their koalas are safer')], hurts: [E('Costs real money')] },
      },
      {
        id: 'speed', label: 'Drop the night speed limit to 40 km/h',
        outcome: 'Drivers grumble, then adapt. Fewer koalas are hit, though not none.',
        effects: { budget: -3, society: -1, flags: { 'koala.slow': 1 }, mood: { [KIDS]: 3 } },
        preview: { helps: [C('koala', 'Fewer collisions')], hurts: [T('Slower trips for drivers')] },
      },
      {
        id: 'nothing', label: 'Leave things as they are',
        outcome: 'Nothing changes. The koalas keep trying to cross.',
        effects: { mood: { [KIDS]: -5 } },
        preview: { helps: [E('No cost')], hurts: [C('koala', 'More collisions'), R(KIDS, 'Ignored')] },
      },
    ],
  },
  {
    id: 'd2-countryfire', title: 'An offer about fire', phase: 'act2', years: [2028, 2075], speaker: JUNE, needsConsultation: true, priority: 6,
    when: { all: [t('partnership', '>=', 28), t('flag.culturalBurning', '<=', 0)] },
    setup: 'Aunty June has offered to talk about cultural burning, the cool, patchy fires Aboriginal peoples have long used to look after Country. The fire brigade is cautious, and the insurers are nervous. It would take trust, planning and time from everyone.',
    evidence: 'Aboriginal peoples have long used, and continue to use, fire to care for Country. Practices differ between places. Reviews after the 2019-20 fires called for more cultural burning alongside conventional hazard reduction. It depends on local knowledge, partnership and the right conditions, so it cannot simply be copied from one place to another.',
    options: [
      {
        id: 'co-design', label: 'Invite Aunty June to co-design a burning program', evidenceBacked: true, needsConsultation: true,
        outcome: 'A mixed crew of fire brigade and community members walk the bush with Aunty June. A plan comes together, season by season.',
        effects: { budget: -10, partnership: 8, flags: { 'country.coDesign': 1 }, mood: { [JUNE]: 10 } },
        preview: { helps: [R(JUNE, 'Her knowledge is valued'), C('koala', 'Healthier, lower-fuel bush'), T('Lower fire risk')], hurts: [E('Time and money to set up')] },
      },
      {
        id: 'consultants', label: 'Hire consultants for ordinary hazard-reduction burns',
        outcome: 'A contractor does the work to a standard checklist. The bush is safer in places. Aunty June is polite, and a little sad.',
        effects: { budget: -20, flags: { 'fire.prep': 1 }, mood: { [JUNE]: -6 } },
        preview: { helps: [T('Predictable, insured work')], hurts: [R(JUNE, 'Local knowledge left out')] },
      },
      {
        id: 'wait', label: 'Wait until after the next fire season',
        outcome: 'The decision is put off. The bush keeps growing. Aunty June says the offer will still be there, but it will not wait forever.',
        effects: { partnership: -1, mood: { [JUNE]: -3 } },
        preview: { helps: [E('No spending')], hurts: [R(JUNE, 'Another year of waiting'), T('Fuel keeps building up')] },
      },
    ],
  },
  {
    id: 'd2-solarsite', title: 'Where do the panels go?', phase: 'act2', years: [2028, 2095], priority: 4,
    setup: 'The town needs another solar farm. One site is a bare paddock cleared a century ago. The other is a patch of regrowing bush closer to the grid. The paddock costs more in cables. The bush is cheaper, and the kids have noticed.',
    evidence: 'Solar farms are best on land already cleared, such as degraded paddocks, car parks and roofs. Clearing regrowing bush releases stored carbon and removes habitat, which defeats part of the point. Sheep or native grass between the panels can keep the land productive.',
    options: [
      {
        id: 'paddock', label: 'Use the bare paddock', evidenceBacked: true,
        outcome: 'The panels go up on the old paddock. Sheep graze underneath, and the bush stays untouched.',
        effects: { budget: -15, mood: { [KIDS]: 3 } },
        preview: { helps: [C('koala', 'Bush kept'), P('No clearing needed')], hurts: [E('Longer cables cost more')] },
      },
      {
        id: 'bush', label: 'Use the regrowing bush: cheaper and closer',
        outcome: 'The site is cleared in a week. Cheaper power, but the young trees that were coming back are gone.',
        effects: { budget: 5, tiles: [{ op: 'health', scope: 'bush', add: -0.12 }], emissionsKt: 10, mood: { [KIDS]: -5 } },
        preview: { helps: [E('Saves money')], hurts: [C('koala', 'Woodland lost'), P('Carbon released'), R(KIDS, 'Their bush is cut')] },
      },
      {
        id: 'roofs', label: 'Panels over car parks and roofs instead',
        outcome: 'It takes longer and costs more per unit, but nothing is cleared. The shopping-centre car park gets shade as a bonus.',
        effects: { budget: -25, society: 1 },
        preview: { helps: [P('No land used'), T('Shade for cars')], hurts: [E('Higher cost per unit of power')] },
      },
    ],
  },
  {
    id: 'd2-seawall', title: 'After the storm surge', phase: 'act2', years: [2035, 2100], repeat: 45, noCleanAnswer: true, priority: 7,
    when: { all: [t('recent.flood', '>=', 1)] },
    setup: 'A storm surge flooded the streets by the estuary. Residents want a seawall. Engineers warn walls can speed erosion on neighbouring beaches and need constant repair. Mangroves soak up waves, but take years to grow, and some of the lowest homes might need to move back.',
    evidence: 'Seawalls protect what is behind them, but waves reflect off them and can scour the beach in front, and the wall must be raised as seas rise. Mangroves and saltmarsh can reduce wave energy, trap sediment and store carbon, but they work best on gentle shores and take years to grow. Moving back avoids repeat damage but is painful for the people affected.',
    options: [
      {
        id: 'wall', label: 'Build a concrete seawall',
        outcome: 'The wall holds the next surge. The beach in front shrinks year by year, and the shorebirds lose the mudflat.',
        effects: { budget: -45, society: 2, flags: { 'coast.seawall': 1 }, tiles: [{ op: 'health', scope: 'beach', add: -0.1 }] },
        preview: { helps: [T('Homes behind the wall are safer')], hurts: [C('shorebirds', 'Mudflats squeezed'), C('green-turtle', 'Beach erodes'), E('Expensive to keep raising')] },
      },
      {
        id: 'living', label: 'Restore mangroves and saltmarsh as a living shoreline',
        outcome: 'Volunteers plant thousands of seedlings along the edge. The shore is softer, greener and full of crabs. The next surge is smaller than feared.',
        effects: { budget: -25, flags: { 'coast.living': 1 }, tiles: [{ op: 'health', scope: 'estuary', add: 0.12 }, { op: 'health', scope: 'beach', add: 0.05 }], mood: { [LENA]: 4 } },
        preview: { helps: [C('shorebirds', 'More feeding habitat'), R(LENA, 'Nursery for fish'), P('Carbon stored')], hurts: [T('Protection takes years to build')] },
      },
      {
        id: 'retreat', label: 'Help the lowest homes move back',
        outcome: 'It is painful. Some families have lived there for generations. The vacated land becomes a park that floods safely.',
        effects: { budget: -35, society: -1, tiles: [{ op: 'health', scope: 'estuary', add: 0.04 }] },
        preview: { helps: [P('Space for wetlands to migrate'), T('No repeat losses')], hurts: [T('Families displaced'), E('A big cost')] },
      },
    ],
  },
  {
    id: 'd2-hydrogen', title: 'Spare sunshine', phase: 'act2', years: [2038, 2085], priority: 4,
    when: { all: [t('renewablePct', '>=', 50)] },
    setup: 'At midday the grid has more solar than it can use. A company wants to turn the spare power into hydrogen for export and for green steel. Electrolysers need lots of clean power and water. Some neighbours worry about water and noise, others see jobs.',
    evidence: 'Hydrogen made by splitting water with renewable electricity can replace coal in steelmaking and fuel in shipping, but a lot of energy is lost along the way, so it makes most sense where electrification is hard. It needs large amounts of clean power and water.',
    options: [
      {
        id: 'hydrogen', label: 'Build a hydrogen plant for local industry and export',
        outcome: 'The electrolysers hum beside the old port. Jobs arrive, and so do some noise complaints.',
        effects: { budget: -30, incomePerYear: 4, society: 1, mood: { [MICK]: 5 } },
        preview: { helps: [R(MICK, 'New skilled jobs'), E('New income')], hurts: [T('Noise and water use')] },
      },
      {
        id: 'storage', label: 'Use the spare power for batteries and local needs',
        outcome: 'Batteries soak up the midday surplus and release it at dinner time. Less glamorous, quietly useful.',
        effects: { budget: -20, incomePerYear: 1, flags: { 'grid.storage': 1 } },
        preview: { helps: [T('Evening power is steadier')], hurts: [E('Smaller income than hydrogen')] },
      },
      {
        id: 'wait', label: 'Wait for the technology to mature',
        outcome: 'The company shrugs and looks for another town. The spare sunshine goes to waste.',
        effects: { mood: { [MICK]: -3 } },
        preview: { helps: [E('No risk')], hurts: [R(MICK, 'No new jobs'), P('Spare clean power wasted')] },
      },
    ],
  },
  {
    id: 'd2-fireseason', title: 'A fire at the fence line', phase: 'act2', years: [2028, 2100], repeat: 40, priority: 7,
    when: { all: [t('recent.bushfire', '>=', 1)] },
    setup: 'A bushfire came within a street of the houses. The brigade wants more funding, some residents want the homes closest to the bush bought out, and others want better warnings and evacuation plans. The council can afford one big step this year.',
    evidence: 'No single approach is enough. Hazard-reduction burning lowers fuel in some forests but not all. Building standards, warnings and evacuation plans save lives, and the biggest driver of worse fire weather is the warming climate.',
    options: [
      {
        id: 'brigade', label: 'Fund more hazard reduction and firefighters',
        outcome: 'More crews and cool-season burns follow. The edge of town feels safer.',
        effects: { budget: -30, flags: { 'fire.prep': 1 } },
        preview: { helps: [T('Faster response, less fuel')], hurts: [E('Ongoing cost'), P('Smoke from burns')] },
      },
      {
        id: 'buyback', label: 'Buy back the homes closest to the bush',
        outcome: 'It is a hard conversation at some kitchen tables. The buy-back leaves a wide, safe buffer.',
        effects: { budget: -40, society: -2, flags: { 'fire.buyback': 1 } },
        preview: { helps: [T('Fewer homes in the danger zone'), C('koala', 'Bush edge left alone')], hurts: [T('Families asked to move'), E('A large cost')] },
      },
      {
        id: 'warnings', label: 'Strengthen warnings and evacuation plans', evidenceBacked: true,
        outcome: 'Sirens, text alerts and a rehearsed evacuation route are in place by spring. People sleep a little easier, knowing the plan has been practised.',
        effects: { budget: -12, society: 2 },
        preview: { helps: [T('Earlier warnings help people leave safely')], hurts: [P('Does not reduce the fire risk itself')] },
      },
    ],
  },
  {
    id: 'd2-plasticfuel', title: 'Plastic into diesel?', phase: 'act2', years: [2035, 2095], speaker: PRIYA, priority: 5,
    setup: 'A company offers to build a plant that turns plastic waste into diesel, promising to solve the plastic problem and create thirty jobs. Priya wants to see the evidence first. Others worry the town would be locked into making plastic waste to keep the plant running.',
    evidence: 'Plastic-to-fuel (pyrolysis) can handle some mixed plastics, but it uses a lot of energy, makes a mixed oil that usually needs refining, and when the fuel is burned its carbon becomes CO2. Most life-cycle studies find that using less plastic, reusing it and recycling it mechanically do better for the climate.',
    options: [
      {
        id: 'yes', label: 'Say yes and build it',
        outcome: 'The plant opens with a ribbon-cutting. The town soon finds the plant needs a steady supply of plastic to keep running.',
        effects: { budget: 10, incomePerYear: 2, emissionsKt: 25, society: -1, flags: { 'plasticfuel.built': 1 }, mood: { [PRIYA]: -8 } },
        preview: { helps: [E('Some jobs and income')], hurts: [P('More CO2 than recycling'), R(PRIYA, 'Wanted the evidence first')] },
      },
      {
        id: 'sorting', label: 'Say no and invest in sorting and reuse instead', evidenceBacked: true,
        outcome: 'The money goes to better sorting and a repair cafe. It makes fewer headlines and cuts more waste.',
        effects: { budget: -20, society: 1, emissionsKt: -5, mood: { [PRIYA]: 5 } },
        preview: { helps: [P('Less plastic made and burned'), R(PRIYA, 'Follows the evidence')], hurts: [E('No new jobs from the plant')] },
      },
      {
        id: 'review', label: 'Ask for an independent review first', evidenceBacked: true,
        outcome: 'The review compares emissions, costs, waste types and alternatives. It recommends proceeding only if the plant meets the town\'s published criteria.',
        effects: { budget: -8, flags: { 'knows.plasticToFuel': 1 }, mood: { [PRIYA]: 6 } },
        preview: { helps: [R(PRIYA, 'Wants the evidence'), P('Avoids a costly mistake')], hurts: [E('A delay and a small cost')] },
      },
    ],
  },
  {
    id: 'd2-biogas', title: 'Food scraps', phase: 'act2', years: [2038, 2098], priority: 5,
    setup: 'Food scraps make up a big share of the household bin, and rotting food in landfill makes methane. A digester could turn scraps into biogas and a nutrient-rich residue for gardens. It would need a new bin, a new truck route and some patience from households.',
    evidence: 'Landfilled food waste breaks down without oxygen and releases methane. Composting avoids that and returns nutrients to soil. Anaerobic digestion captures the methane for energy and leaves a nutrient-rich residue called digestate, which needs appropriate treatment before use on gardens. Wasting less food in the first place avoids all of it.',
    options: [
      {
        id: 'digester', label: 'Roll out a food-scraps bin and a digester', evidenceBacked: true,
        outcome: 'The green bins appear on kerbs. By autumn the digester is running the council depot, and the treated residue is going on the school gardens.',
        effects: { budget: -30, emissionsKt: -15, society: 1, flags: { 'biogas.rollout': 1 } },
        preview: { helps: [P('Less methane'), T('Nutrients for gardens')], hurts: [E('Upfront cost'), T('One more bin to sort')] },
      },
      {
        id: 'compost', label: 'Backyard compost workshops only',
        outcome: 'Keen households learn to compost. Most do not change a thing.',
        effects: { budget: -5, emissionsKt: -3 },
        preview: { helps: [E('Cheap'), P('A little less methane')], hurts: [P('Most food waste still goes to landfill')] },
      },
      {
        id: 'landfill', label: 'Keep sending food waste to landfill',
        outcome: 'Nothing changes. The tip keeps releasing methane.',
        effects: { emissionsKt: 10 },
        preview: { helps: [E('No new spending')], hurts: [P('Methane keeps leaking')] },
      },
    ],
  },
  {
    id: 'd2-heritage', title: 'The furnace tower', phase: 'act2', years: [2030, 2085], speaker: MICK, noCleanAnswer: true, priority: 5,
    when: { all: [t('count.steelworks', '<=', 0), t('acts.demolished.steelworks', '>=', 1)] },
    setup: 'The old blast furnace tower still stands over the empty works. Mick\'s generation wants it kept as a monument. The council has quotes to pull it down, which is safer and cheaper, but the families who worked there feel it is their story.',
    evidence: 'Heritage sites help communities remember and make sense of change, and industrial heritage has helped places like Germany\'s Ruhr valley build new economies from old works. Keeping old structures safe can be costly, and the steel can be recycled, so the trade-off is memory against money.',
    options: [
      {
        id: 'keep', label: 'Keep the tower as a monument',
        outcome: 'The tower stays, floodlit at night. Old workers bring grandchildren to see where they worked.',
        effects: { budget: -20, society: 2, mood: { [MICK]: 10 } },
        preview: { helps: [R(MICK, 'His story is honoured'), T('A shared memory')], hurts: [E('Upkeep costs')] },
      },
      {
        id: 'demolish', label: 'Pull it down and recycle the steel',
        outcome: 'The steel is cut up and sold to be melted down, and the skyline feels strange without it.',
        effects: { budget: 15, emissionsKt: -5, mood: { [MICK]: -6 } },
        preview: { helps: [E('Money back'), P('Steel recycled')], hurts: [R(MICK, 'A piece of his family\'s story is gone')] },
      },
      {
        id: 'trail', label: 'Keep it, add a lookout and a story trail',
        outcome: 'The lookout and a trail of worker stories bring visitors. A retired furnace man gives tours on Saturdays.',
        effects: { budget: -30, society: 3, incomePerYear: 2, mood: { [MICK]: 12 } },
        preview: { helps: [R(MICK, 'His story told to visitors'), E('Some tourism income')], hurts: [E('The most expensive option')] },
      },
    ],
  },
  {
    id: 'd2-lastcoal', title: 'The last coal station', phase: 'act2', years: [2045, 2080], speaker: PRIYA, priority: 9,
    when: { all: [t('count.coalpower', '>=', 1)] },
    setup: 'The last coal station is old, dirty and expensive to repair. Closing it would cut a large share of the town\'s emissions, but the grid still needs power on still, hot nights. Priya says batteries and wind could cover much of it.',
    evidence: 'Old coal plants break down more often and cost more to maintain, and each year they run adds to the CO2 that stays in the air for centuries. Batteries and wind can cover peaks, but retiring coal needs enough replacement generation, storage, grid connections and backup to meet demand through difficult weather periods before the last plant closes.',
    options: [
      {
        id: 'retire', label: 'Retire it now and add batteries', evidenceBacked: true,
        outcome: 'The stack stops steaming. With batteries, grid links and backup ready, the first hot night passes without a blackout.',
        effects: { budget: -35, society: 1, mood: { [PRIYA]: 8, [MICK]: -2 } },
        preview: { helps: [P('Large emissions cut'), R(PRIYA, 'Does the right thing')], hurts: [E('A big cost'), T('Workers at the station need new jobs')] },
      },
      {
        id: 'repair', label: 'Repair it for another ten years',
        outcome: 'The repairs eat the budget. The station keeps burning coal, and the town keeps warming.',
        effects: { budget: -20, emissionsKt: 20, society: -1, mood: { [PRIYA]: -8 } },
        preview: { helps: [E('Keeps the lights on cheaply for now')], hurts: [P('More CO2'), R(PRIYA, 'Warming goal slipping')] },
      },
    ],
  },
  {
    id: 'd2-newcomers', title: 'Room for newcomers?', phase: 'act2', years: [2050, 2100], noCleanAnswer: true, priority: 5,
    setup: 'Families displaced by floods and drought elsewhere are looking for somewhere to live. The town has some empty homes and land, but the water, the estuary and the bush are already under pressure. How many can the town welcome?',
    evidence: 'Towns can often take more people than they expect if they plan housing, water and jobs, and newcomers add skills and energy. But every extra person uses land, water and energy, so planning, not just goodwill, sets the limits. Climate change is already moving people within and between countries.',
    options: [
      {
        id: 'many', label: 'Welcome many families and plan new homes carefully',
        outcome: 'The school fills, the market has new stalls and the water meter creeps upwards. It is busy and warm and a little stretched.',
        effects: { budget: -30, society: 2, incomePerYear: 3, tiles: [{ op: 'water', scope: 'estuary', add: 0.04 }], flags: { 'newcomers.many': 1 } },
        preview: { helps: [T('Families find a home'), E('More workers and customers')], hurts: [P('More pressure on water and land'), R(LENA, 'The estuary takes more load')] },
      },
      {
        id: 'some', label: 'Welcome a smaller number now, more as the town can afford it',
        outcome: 'A few families arrive. The town copes comfortably, though some feel it could have done more.',
        effects: { budget: -15, society: 1 },
        preview: { helps: [T('A manageable start')], hurts: [T('Some families wait longer')] },
      },
      {
        id: 'full', label: 'Say the town is full',
        outcome: 'It saves resources, and it stings. The story gets around, and not warmly.',
        effects: { society: -3 },
        preview: { helps: [P('No extra pressure on the estuary')], hurts: [T('Families turned away'), E('Fewer workers')] },
      },
    ],
  },
  {
    id: 'd2-turtlenest', title: 'Hot sand', phase: 'act2', years: [2040, 2095], speaker: KIDS, priority: 6,
    when: { all: [t('pop.green-turtle', '>=', 1), t('tempC', '>=', 1.3)] },
    setup: 'The sand is getting hotter. Volunteers measured a nest at 32 degrees, which is warm enough to produce mostly females. They could shade the nests with sand-coloured cloth, move the eggs to cooler sand, or leave nature to take its course.',
    evidence: 'In sea turtles the temperature of the nest decides whether embryos become male or female: warmer sand makes more females. Warmer nests generally produce more females, and extreme or prolonged heat can reduce survival. Shade and dune plants cool nests. Rangers use local monitoring to decide whether to intervene. Moving eggs is risky and best left to experts.',
    options: [
      {
        id: 'shade', label: 'Shade the nests and plant dune vegetation', evidenceBacked: true,
        outcome: 'Cloth sails and young dune grasses cool the sand by a couple of degrees. The next hatching has a better mix.',
        effects: { budget: -12, flags: { 'turtle.shade': 1 }, tiles: [{ op: 'health', scope: 'beach', add: 0.05 }], mood: { [KIDS]: 5 } },
        preview: { helps: [C('green-turtle', 'Cooler nests'), R(KIDS, 'Their turtles have a chance')], hurts: [E('A small cost')] },
      },
      {
        id: 'move', label: 'Move vulnerable nests to a cooler spot',
        outcome: 'Experts move a few nests carefully. Some hatch well, others do not.',
        effects: { budget: -8, mood: { [KIDS]: 2 } },
        preview: { helps: [C('green-turtle', 'Some nests saved')], hurts: [C('green-turtle', 'Moving eggs can harm them')] },
      },
      {
        id: 'leave-nest', label: 'Leave nature to take its course',
        outcome: 'Nothing is done. A season later the hatchlings are almost all female.',
        effects: { mood: { [KIDS]: -3 } },
        preview: { helps: [E('No cost')], hurts: [C('green-turtle', 'A skewed future population'), R(KIDS, 'Feels like giving up')] },
      },
    ],
  },
  {
    id: 'd2-tourism', title: 'Visitors to the estuary', phase: 'act2', years: [2060, 2100], needsConsultation: true, priority: 4,
    when: { all: [t('estuary', '>=', 55), t('wildlifeAlive', '>=', 4)] },
    setup: 'The restored estuary draws more visitors every year. A tour company wants to run boat trips and build a boardwalk. Locals welcome the money, but shorebirds need undisturbed places to feed and rest, and Aunty June worries about crowds on ground that matters to her community.',
    evidence: 'Nature tourism can fund conservation and give locals a stake in protecting places, but too many visitors disturb wildlife, especially nesting and feeding birds. Visitor limits, careful timing and consulting Traditional Owners about places of significance help keep both people and nature happy.',
    options: [
      {
        id: 'limited', label: 'A limited boardwalk and guided tours in the quiet season', evidenceBacked: true, needsConsultation: true,
        outcome: 'Tours are small and well run, and Aunty June\'s family gets to say where the boardwalk goes. The money helps pay for rangers.',
        effects: { budget: 10, incomePerYear: 3, partnership: 3, mood: { [JUNE]: 4 } },
        preview: { helps: [E('Steady income'), R(JUNE, 'Asked about the route'), C('shorebirds', 'Undisturbed feeding and resting areas')], hurts: [T('Some want more tours')] },
      },
      {
        id: 'protect', label: 'Keep the estuary strictly protected',
        outcome: 'The estuary stays quiet. The shorebirds love it, and the tour company takes its business to the next town.',
        effects: { society: -1, mood: { [JUNE]: 3 } },
        preview: { helps: [C('shorebirds', 'Undisturbed feeding'), P('Habitat protected')], hurts: [E('No tourism money'), R(LENA, 'Fewer customers for her fish')] },
      },
      {
        id: 'grow', label: 'Let tourism grow and tidy up later',
        outcome: 'Visitors flood in, and so does the money. The mudflats get busy, the birds move on, and Aunty June is not consulted.',
        effects: { incomePerYear: 6, partnership: -3, tiles: [{ op: 'water', scope: 'estuary', add: 0.05 }], mood: { [JUNE]: -6 } },
        preview: { helps: [E('The biggest income')], hurts: [C('shorebirds', 'Disturbed and displaced'), R(JUNE, 'Not asked'), P('More pressure on the estuary')] },
      },
    ],
  },
  {
    id: 'd2-moorings', title: 'Anchors in the seagrass', phase: 'act2', years: [2026, 2100], priority: 3,
    setup: 'Boat anchors drag through the seagrass meadow and tear it up in long scars. A mooring system costs money. A ban on anchoring needs rangers to enforce it. Lena says the scars are the first thing she sees when she fishes the bay.',
    evidence: 'Seagrass meadows feed turtles, shelter young fish and store carbon, and anchors and chains scar them, leaving bare patches that can take years to recover. Seagrass-friendly moorings hold a boat on a buoy without dragging on the bottom.',
    options: [
      {
        id: 'moorings', label: 'Install seagrass-friendly moorings', evidenceBacked: true,
        outcome: 'Boats clip onto neat buoys. By next summer, new green shoots fill the old scars.',
        effects: { budget: -15, tiles: [{ op: 'health', scope: 'sea', add: 0.06 }], mood: { [LENA]: 4 } },
        preview: { helps: [C('green-turtle', 'More seagrass to graze'), R(LENA, 'Nursery for fish'), P('Carbon stored in seagrass')], hurts: [E('Costs money to install')] },
      },
      {
        id: 'ban', label: 'Ban anchoring in the seagrass, with fines',
        outcome: 'It works where rangers are watching, and not where they are not.',
        effects: { budget: -3, tiles: [{ op: 'health', scope: 'sea', add: 0.02 }], society: -1 },
        preview: { helps: [C('green-turtle', 'Some seagrass saved')], hurts: [T('Boaters feel policed')] },
      },
      {
        id: 'ignore', label: 'Leave it. There are bigger problems.',
        outcome: 'The scars slowly widen.',
        effects: { mood: { [LENA]: -3 } },
        preview: { helps: [E('No cost')], hurts: [C('green-turtle', 'Less seagrass'), R(LENA, 'Her bay is scarred')] },
      },
    ],
  },
  {
    id: 'd2-water', title: 'Water for a drier future', phase: 'act2', years: [2035, 2100], speaker: DOT,
    when: { all: [t('count.farm', '>=', 1)] },
    setup: 'A drier future means less water for the river. The treatment plant could supply recycled water to farms and parks, taking pressure off the river, but some residents find the idea unappealing. Dot says her cows would not care.',
    evidence: 'Recycled water is treated to strict standards and is widely used for irrigation, parks and industry in Australian cities. Using it leaves more water in rivers for ecosystems like platypus habitat, though treatment uses energy and people need time to trust it.',
    options: [
      {
        id: 'recycled', label: 'Build a recycled-water scheme', evidenceBacked: true,
        outcome: 'Purple pipes carry treated water to the farms and the park. The river keeps more of its flow, and Dot\'s pasture stays green.',
        effects: { budget: -30, tiles: [{ op: 'water', scope: 'river', mult: 0.92 }], flags: { 'water.recycled': 1 }, mood: { [DOT]: 6 } },
        preview: { helps: [R(DOT, 'Reliable water for the farm'), C('platypus', 'More flow in the river')], hurts: [E('Upfront cost and energy use')] },
      },
      {
        id: 'allocations', label: 'Cut irrigation allocations',
        outcome: 'The river holds more water. Farmers pay the price.',
        effects: { society: -1, mood: { [DOT]: -8 } },
        preview: { helps: [C('platypus', 'More flow in the river')], hurts: [R(DOT, 'Less water for the farm'), E('Farm income falls')] },
      },
      {
        id: 'hope', label: 'Rely on rain',
        outcome: 'It rains, and then it does not.',
        effects: { mood: { [DOT]: -2 } },
        preview: { helps: [E('No spending')], hurts: [R(DOT, 'Uncertain water'), C('platypus', 'Drought risk')] },
      },
    ],
  },
  {
    id: 'd2-signs', title: 'Two names on the signs', phase: 'act2', years: [2035, 2100], speaker: JUNE, needsConsultation: true,
    when: { all: [t('flag.dualNames', '>=', 1)] },
    setup: 'The Land Council and Aunty June offer to put original place names beside the English ones on town signs. Some residents are proud, some are puzzled, and a few say it will confuse tourists. The council has to decide how quickly to do it.',
    evidence: 'Dual naming, using the original names of places beside the names given by settlers, is now common across Australia and in other countries. It recognises that these places had names and meanings long before the towns were built, and it is a way of sharing the history of a place with everyone who lives there. Names, permissions, timing and interpretation should be agreed with the relevant Traditional Owners.',
    options: [
      {
        id: 'all-signs', label: 'Add the original names to all the signs this year', needsConsultation: true,
        outcome: 'New signs go up across town, with the names the community has chosen. At first people stop and read them, and by the end of the year they are part of the landscape.',
        effects: { budget: -12, partnership: 6, society: 1, mood: { [JUNE]: 10 } },
        preview: { helps: [R(JUNE, 'Her community\'s names are seen'), T('A richer shared story')], hurts: [E('Cost of new signs')] },
      },
      {
        id: 'few-signs', label: 'Start with a few places agreed with the community, then build', evidenceBacked: true, needsConsultation: true,
        outcome: 'Three signs go up first, with a morning tea and a talk at the school. More follow as people get comfortable.',
        effects: { budget: -5, partnership: 4, mood: { [JUNE]: 6 } },
        preview: { helps: [R(JUNE, 'A respectful start'), T('Time to learn')], hurts: [T('Slower than some would like')] },
      },
      {
        id: 'not-now', label: 'Not now. Other priorities come first.', needsConsultation: true,
        outcome: 'The offer is set aside. Aunty June nods and says the offer stands.',
        effects: { partnership: -2, mood: { [JUNE]: -5 } },
        preview: { helps: [E('No cost')], hurts: [R(JUNE, 'Her offer is put aside')] },
      },
    ],
  },
  {
    id: 'd2-legacy', title: 'What do we leave?', phase: 'act2', years: [2078, 2100], speaker: KIDS, noCleanAnswer: true, priority: 6,
    setup: 'As the century closes, the town has some money left over. It could train the next generation, buy more land to return to bush, or cut local rates and let people decide. Sam and Jordan, now grown, want a say. Which future does the money buy?',
    evidence: 'Different investments pay back over different times. Education and skills raise incomes for decades. Restored habitat provides clean water, carbon storage and wildlife. There is no formula for the right mix: it is a choice about values as well as facts.',
    options: [
      {
        id: 'youth', label: 'Invest in education and training for young people',
        outcome: 'The scholarships and apprenticeships fill quickly. Within a decade the town has its own engineers, ecologists and electricians.',
        effects: { budget: -20, society: 3, incomePerYear: 2 },
        preview: { helps: [R(KIDS, 'Opportunities for their generation'), E('A skilled town')], hurts: [P('Less money for land')] },
      },
      {
        id: 'bush', label: 'Buy and restore more bushland',
        outcome: 'The town buys the old farm on the ridge. Native seedlings go in, and a wildlife corridor joins two patches of bush.',
        effects: { budget: -30, partnership: 2, tiles: [{ op: 'health', scope: 'bush', add: 0.05 }, { op: 'health', scope: 'land', add: 0.04 }] },
        preview: { helps: [C('koala', 'More woodland'), P('Carbon and habitat'), R(JUNE, 'Care of Country')], hurts: [E('No money left for other things')] },
      },
      {
        id: 'rates', label: 'Cut rates and let people decide',
        outcome: 'People are pleased. Some spend their savings on home batteries, some on holidays. Less money is left for shared projects.',
        effects: { budget: 20, society: 1 },
        preview: { helps: [T('Money in everyone\'s pocket')], hurts: [P('Less funding for shared projects')] },
      },
    ],
  },
];
