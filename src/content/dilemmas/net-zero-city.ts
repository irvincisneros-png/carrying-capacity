/**
 * Dilemma cards for Net Zero City: all Act 2 (2025 to 2095), about one every few years, a few recurring. Several have
 * no clean answer on purpose. Cards with Aunty Lorraine are placeholders that need consultation before release.
 */
import { t } from '../../sim/conditions';
import type { DilemmaDef, PreviewTarget } from '../../sim/dilemmas';

const LORRAINE = 'aunty-lorraine';
const GARY = 'gary-novak';
const DOLORES = 'dolores-fitzgerald';
const AISHA = 'aisha-rahman';
const RAVI = 'ravi-patel';
const ZOE = 'zoe-lin';

const R = (id: string, why: string): PreviewTarget => ({ type: 'resident', id, why });
const C = (id: string, why: string): PreviewTarget => ({ type: 'creature', id, why });
const P = (why: string): PreviewTarget => ({ type: 'planet', id: 'planet', why });
const E = (why: string): PreviewTarget => ({ type: 'economy', id: 'economy', why });
const T = (why: string): PreviewTarget => ({ type: 'town', id: 'town', why });

export const NET_ZERO_CITY_DILEMMAS: readonly DilemmaDef[] = [
  {
    id: 'heat-aftermath', title: 'After the record heat', phase: 'act2', years: [2025, 2033], speaker: DOLORES,
    setup: 'The ambulances have stopped, and the council has a small pot of money. Street trees take years to shade a footpath. Cool roofs help the buildings under them. Cooling centres in libraries and halls could open next week. Dolores says the people who needed help most were the ones who never rang.',
    evidence: 'Trees shade streets and cool the air as water evaporates from their leaves, but take years to grow. Cool roofs lower indoor heat in the building below, yet do little for people outside. Heat deaths are highest among older people living alone or with chronic illness. Cooling centres reach them best when someone checks in.',
    options: [
      {
        id: 'trees-centres', label: 'Plant street trees and open cooling centres', evidenceBacked: true,
        outcome: 'Saplings go in along the hottest streets, and three halls become cool rooms on hot days. It will take a decade for the shade to arrive. The chairs are already full.',
        effects: { budget: -25, tiles: [{ op: 'health', scope: 'land', add: 0.04 }], mood: { [DOLORES]: 8, [AISHA]: 3 }, flags: { 'heat.trees': 1 } },
        preview: { helps: [R(DOLORES, 'Shade and a cool room nearby'), T('Fewer heat deaths over time'), C('flying-fox', 'More leafy cover')], hurts: [E('Money now for shade later')] },
      },
      {
        id: 'cool-roofs', label: 'Subsidise cool roofs on the oldest buildings',
        outcome: 'White paint and reflective coatings go on a thousand roofs. Top-floor flats are a few degrees cooler indoors. The footpaths below are as hot as ever.',
        effects: { budget: -15, mood: { [DOLORES]: 3 } },
        preview: { helps: [R(DOLORES, 'A cooler top-floor flat'), E('Cheaper than trees per roof')], hurts: [T('Streets stay hot'), P('No new shade or habitat')] },
      },
      {
        id: 'wait-heat', label: 'Wait for the next heat report first',
        outcome: 'The money stays in the bank. Another hot week comes before the report does, and the ambulances are out again.',
        effects: { budget: 5, mood: { [DOLORES]: -8 }, society: -1 },
        preview: { helps: [E('Keeps the money for now')], hurts: [R(DOLORES, 'Left to cope alone'), T('Risk to older neighbours')] },
      },
    ],
  },
  {
    id: 'checkin', title: 'A knock on the door', phase: 'act2', years: [2026, 2095], speaker: DOLORES, repeat: 25,
    when: { all: [t('recent.heatwave', '>=', 1)] },
    setup: 'Dolores wants to know who rings the people who live alone. Council could send heat warnings by text and phone. It could also recruit neighbours and volunteers to knock on doors, with a ride to the cooling centre. It costs less than an ambulance, and more than a leaflet.',
    evidence: 'Heat-health warning systems are linked to fewer deaths in several cities, mostly when a warning triggers action, such as phone calls, visits or free transport. Warnings alone reach many people, but not the isolated older person who most needs them. The evidence is encouraging rather than certain, and results vary between cities.',
    options: [
      {
        id: 'checkin-program', label: 'Warnings plus neighbour check-ins and rides', evidenceBacked: true,
        outcome: 'Eight hundred volunteers sign up in a month. On the next hot day, the knocks start at nine in the morning. Dolores is first on the list and tells her visitor to sit down.',
        effects: { budget: -12, society: 1, flags: { 'heat.checkin': 1 }, mood: { [DOLORES]: 8, [LORRAINE]: 3 } },
        preview: { helps: [R(DOLORES, 'Someone checks she is safe'), T('Fewer deaths, more connection')], hurts: [E('Ongoing volunteer coordination costs')] },
      },
      {
        id: 'text-only', label: 'Heat warnings by text and radio only',
        outcome: 'The alerts go out. Plenty of people read them. Some of the people who needed them most do not own a mobile phone.',
        effects: { budget: -3, mood: { [DOLORES]: 1 } },
        preview: { helps: [E('Cheap and quick')], hurts: [R(DOLORES, 'Warnings miss people who live alone'), T('Reaches only some households')] },
      },
    ],
  },
  {
    id: 'coal-close', title: 'The coal station\'s last years', phase: 'act2', years: [2026, 2045], speaker: GARY, noCleanAnswer: true,
    when: { all: [t('count.coalpower', '>=', 1)] },
    setup: 'Coal power is the biggest single source of the city\'s emissions. Closing the station early means retraining three hundred workers and finding replacement power. Running it to the end of its life means years more of emissions. Gary says: whichever you choose, plan it with us, not around us.',
    evidence: 'Closing coal stations early cuts emissions fastest, and cleaner air helps health nearby. Studies of closed plants show many workers face lasting income loss unless retraining and new jobs arrive at the same time. A reliable grid needs replacement power before closure, not after. Each path has real costs, which is why this is hard.',
    options: [
      {
        id: 'close-support', label: 'Close early with a funded retraining and jobs plan',
        outcome: 'A date is set and posted at the gate. Every worker gets a place in training or a new role. It costs a lot, and the grid needs rebuilding fast. The station goes quiet.',
        effects: { budget: -28, society: 1, emissionsKt: -10, flags: { 'gary.retrain': 1 }, mood: { [GARY]: 10, [AISHA]: 4, [ZOE]: 6 } },
        preview: { helps: [P('Emissions fall sooner'), R(GARY, 'A plan for the crew'), R(ZOE, 'Faster action')], hurts: [E('Large up-front cost'), T('Grid must be ready in time')] },
      },
      {
        id: 'run-out', label: 'Run the station to the end of its life',
        outcome: 'The chimneys keep going, and the crew keeps their pay. The cost is more emissions every year, and a very hard goodbye later on.',
        effects: { budget: 10, emissionsKt: 8, mood: { [GARY]: 4, [ZOE]: -8, [AISHA]: -4 } },
        preview: { helps: [R(GARY, 'Secure work for now'), E('No closure bill yet')], hurts: [P('Years of extra emissions'), R(ZOE, 'Target slips further away')] },
      },
      {
        id: 'close-fast', label: 'Close early and offer redundancy payments only',
        outcome: 'The station closes in two years. The payments are fair, but the jobs do not follow. Some of the crew head north for mine work. The town feels the gap.',
        effects: { budget: -12, society: -1, emissionsKt: -10, mood: { [GARY]: -8, [ZOE]: 4 } },
        preview: { helps: [P('Emissions fall sooner'), E('Cheaper than full retraining')], hurts: [R(GARY, 'No plan for the crew'), T('Local jobs and spending drop')] },
      },
    ],
  },
  {
    id: 'transit-choice', title: 'Rail, buses or bike lanes?', phase: 'act2', years: [2027, 2050], speaker: RAVI,
    setup: 'Highways carry most of the city\'s car emissions. A light rail line is the slow, expensive, popular answer. Bus lanes are cheap and fast to build. Bike lanes are cheaper again, but not everyone can ride. Ravi says people will use what comes often, comes on time, and does not get stuck in traffic.',
    evidence: 'Public transport gets more riders when it is frequent, fast and separated from traffic. Light rail and bus lanes can both do that. Rail costs far more per kilometre. Bus priority can sometimes be introduced quickly, while major works take longer. Compare passengers, journey times, accessibility, construction impacts and running costs. Bike lanes work best for short trips and for people who can ride. Most cities need a mix.',
    options: [
      {
        id: 'rail-and-lanes', label: 'Light rail on the busiest corridor, with bus lanes feeding it', evidenceBacked: true,
        outcome: 'Years of roadworks and noise, and then the first train glides in. Bus lanes feed it from the west. Ravi rides it on opening day and cannot stop grinning.',
        effects: { budget: -32, emissionsKt: -4, tiles: [{ op: 'air', scope: 'all', mult: 0.96 }], mood: { [RAVI]: 10, [AISHA]: 3, [ZOE]: 4 }, flags: { 'transit.rail': 1 } },
        preview: { helps: [R(RAVI, 'Reliable service for his passengers'), P('Fewer car emissions'), T('Cleaner air along the corridor')], hurts: [E('The most expensive option'), T('Years of construction disruption')] },
      },
      {
        id: 'bus-lanes', label: 'Bus lanes across the city, no rail',
        outcome: 'Red paint goes down on the main roads in a few months. Buses move faster and trips get shorter. Some commuters grumble about losing a car lane.',
        effects: { budget: -14, emissionsKt: -2, mood: { [RAVI]: 6, [ZOE]: 2 } },
        preview: { helps: [R(RAVI, 'Faster buses'), E('Much cheaper than rail')], hurts: [T('Some drivers lose a lane'), P('Smaller emissions cut than rail')] },
      },
      {
        id: 'bike-only', label: 'A bike lane network',
        outcome: 'Painted lanes and protected paths spread through the inner suburbs. Short trips by bike double. The western suburbs, far from the paths, notice little.',
        effects: { budget: -8, emissionsKt: -1, mood: { [RAVI]: -2, [ZOE]: 3 } },
        preview: { helps: [E('Cheap'), T('Healthier short trips')], hurts: [R(RAVI, 'Passengers with no bike or no way to ride'), P('Small emissions effect')] },
      },
    ],
  },
  {
    id: 'highway-widen', title: 'Widen the highway?', phase: 'act2', years: [2035, 2060], speaker: RAVI,
    setup: 'The western highway jams at eight every morning. Widening it would cost a lot and give drivers relief, for a while. Giving one lane to buses and shared cars would cost less and make drivers cross. Ravi, stuck in the same jam, has seen both sides of the windscreen.',
    evidence: 'Studies of many cities find that new road lanes fill up with extra traffic within a few years, a pattern called induced demand. Dedicated transit lanes carry far more people per hour than a general lane. Drivers can still lose some time, and the benefit depends on frequent, reliable buses.',
    options: [
      {
        id: 'bus-lane', label: 'Give one lane to buses and shared cars', evidenceBacked: true,
        outcome: 'The lane opens. Drivers grumble for a month, and then the bus time falls by a third. Ravi writes the number on the depot whiteboard.',
        effects: { budget: -8, emissionsKt: -3, mood: { [RAVI]: 8, [ZOE]: 4 }, flags: { 'highway.laneShared': 1 } },
        preview: { helps: [R(RAVI, 'Faster, more reliable buses'), P('Fewer car trips')], hurts: [T('Some drivers lose time at first')] },
      },
      {
        id: 'widen', label: 'Widen the highway for cars',
        outcome: 'The new lane is full of cars in four years. Everyone is stuck at the same speed in a wider jam. The road gets more emissions, not fewer.',
        effects: { budget: -30, emissionsKt: 8, mood: { [RAVI]: -6, [ZOE]: -6, [AISHA]: -3 } },
        preview: { helps: [T('Short-term relief for drivers')], hurts: [P('More traffic and emissions'), E('Large cost'), R(ZOE, 'Wrong direction for the target')] },
      },
    ],
  },
  {
    id: 'rent-retrofit', title: 'Who pays for the retrofit?', phase: 'act2', years: [2035, 2100], repeat: 30, speaker: AISHA, noCleanAnswer: true,
    setup: 'Many people rent the brick homes that leak heat and cold. Insulation, shade and heat pumps would cut bills and emissions. The landlord pays, the tenant gains, and rents may go up. Aisha says homes are where much of the city\'s heat risk lives.',
    evidence: 'Better insulation, shading and efficient heating and cooling lower energy use and make homes safer in a heatwave. In rented homes the landlord pays but the tenant gets the cheaper bills, so upgrades often stall. Standards, grants or both can help, but rules can raise rents or lead some landlords to sell.',
    options: [
      {
        id: 'rental-standard', label: 'Set a minimum standard for rentals',
        outcome: 'Landlords have five years to upgrade. Bills drop for tenants, and some rents rise as landlords pass on costs. A few landlords sell up.',
        effects: { budget: -6, society: 1, emissionsKt: -5, mood: { [DOLORES]: 5, [AISHA]: 4 } },
        preview: { helps: [R(DOLORES, 'A safer, cooler home'), P('Less energy used')], hurts: [T('Rents may rise'), E('Pressure on small landlords')] },
      },
      {
        id: 'grants', label: 'Public grants for landlords who upgrade',
        outcome: 'Landlords queue for the grant, and the money runs out in a year. Thousands of homes are upgraded. The rest are still waiting.',
        effects: { budget: -26, emissionsKt: -4, mood: { [DOLORES]: 4, [AISHA]: 2 } },
        preview: { helps: [T('Tenants and landlords both gain'), P('Lower energy use')], hurts: [E('Public money, not enough to reach everyone')] },
      },
      {
        id: 'market', label: 'Leave it to the market',
        outcome: 'Owner-occupiers upgrade, and renters wait. Heat deaths cluster in the same unshaded blocks as before.',
        effects: { society: -1, mood: { [DOLORES]: -6, [ZOE]: -3 } },
        preview: { helps: [E('No public cost')], hurts: [R(DOLORES, 'Left in a hot flat'), T('Renters pay the most in heat and bills')] },
      },
    ],
  },
  {
    id: 'infill', title: 'Apartments by the station', phase: 'act2', years: [2040, 2100], repeat: 30, speaker: ZOE, noCleanAnswer: true,
    setup: 'Zoe wants homes near the new train line so people can live without a car. Residents of the old brick streets want to keep their gardens, light and quiet. Apartments could also take away trees, if they are not planned carefully. Everyone in this fight loves the same suburb.',
    evidence: 'Homes near frequent transit let more people live without a car, which cuts household emissions. Denser suburbs can also add paving and lose trees, making heat worse unless shade and green space are planned in. Most residents care about neighbourhood character as well as housing costs, which is why consultation matters.',
    options: [
      {
        id: 'infill-yes', label: 'Allow mid-rise apartments near stations, with tree rules',
        outcome: 'Cranes arrive near the stations. Some neighbours lose their afternoon sun, and a few ask for compensation. The trains fill up.',
        effects: { budget: -6, society: -1, emissionsKt: -4, mood: { [ZOE]: 8, [RAVI]: 4, [DOLORES]: -2 } },
        preview: { helps: [R(ZOE, 'Homes near transit'), R(RAVI, 'More riders for the trains'), P('Fewer car trips')], hurts: [T('Neighbours lose sun and quiet')] },
      },
      {
        id: 'infill-no', label: 'Protect the suburb\'s character and keep rules as they are',
        outcome: 'Streets stay as they were: low, green and quiet. Housing costs keep climbing, and young people commute in from further out.',
        effects: { society: 1, emissionsKt: 3, mood: { [ZOE]: -6, [DOLORES]: 3 } },
        preview: { helps: [T('Neighbourhood feel and gardens kept'), R(DOLORES, 'Her street stays as it is')], hurts: [R(ZOE, 'Fewer homes she can afford'), P('More car travel')] },
      },
    ],
  },
  {
    id: 'budget-squeeze', title: 'The money runs short', phase: 'act2', years: [2030, 2095], speaker: AISHA, noCleanAnswer: true, repeat: 25,
    setup: 'The big projects come in dearer than planned. The council can borrow and pay it back later, raise rates this year, or cut services such as libraries and pools. Each option moves the cost to a different person or a different year. Aisha says delay also costs money.',
    evidence: 'Borrowing spreads the cost of long-lived assets over the years they are used, but interest is a real cost. Higher rates directly affect property owners, and costs may flow on to renters, though rebates and hardship arrangements can ease some of the impact. Cutting services saves quickly but removes things such as cool, free public spaces that people rely on in a heatwave. Delay can cost more later.',
    options: [
      {
        id: 'borrow', label: 'Borrow and repay over twenty years',
        outcome: 'The project keeps its date. The cost moves to later budgets, with interest. Future councils will inherit the repayments, and a working grid.',
        effects: { budget: 24, incomePerYear: -2, mood: { [AISHA]: 2, [ZOE]: 2 } },
        preview: { helps: [P('Projects stay on schedule'), R(ZOE, 'No delay')], hurts: [E('Interest and repayments for years')] },
      },
      {
        id: 'rates', label: 'Raise rates for a few years',
        outcome: 'Rates go up. Most households grumble and pay. Pensioners on fixed incomes feel it first, and the council offers them a rebate.',
        effects: { budget: 20, society: -1, incomePerYear: 1, mood: { [DOLORES]: -4, [GARY]: -3 } },
        preview: { helps: [E('Pays for projects now')], hurts: [R(DOLORES, 'Tighter on a pension'), R(GARY, 'Another bill for the family')] },
      },
      {
        id: 'cut', label: 'Cut services and delay smaller projects',
        outcome: 'Pool hours are cut, and so are some library days. The library was a cooling centre for half the street. The project saves money, and the city feels thinner.',
        effects: { budget: 15, society: -2, mood: { [DOLORES]: -5, [ZOE]: -3 } },
        preview: { helps: [E('Quick savings')], hurts: [R(DOLORES, 'Fewer cool places to go'), T('Services people rely on shrink')] },
      },
    ],
  },
  {
    id: 'river-bush', title: 'Owls, the river and new homes', phase: 'act2', years: [2045, 2100], repeat: 30, speaker: LORRAINE, needsConsultation: true, noCleanAnswer: true,
    setup: 'A strip of old bush runs along the river and links to the foothills. Powerful owls hunt there, and the trees keep the water cool. Developers want to build homes on part of it. Aunty Lorraine says her family has walked this corridor for as long as anyone can say. The city needs homes too.',
    evidence: 'Powerful owls need large, connected patches of mature bush, with hollow trees that take about a hundred years to form. Bush along rivers also shades the water and cools the air around it. A city needs homes too. Compact development elsewhere can ease the pressure, but not for free.',
    options: [
      {
        id: 'protect-corridor', label: 'Protect the corridor and build homes elsewhere', needsConsultation: true,
        outcome: 'The corridor stays whole. Homes go up on cleared sites instead, at higher cost. Aunty Lorraine nods slowly, and the owls hoot that night as usual.',
        effects: { budget: -12, society: -1, partnership: 5, tiles: [{ op: 'health', scope: 'bush', add: 0.05 }], mood: { [LORRAINE]: 10, [ZOE]: 3 } },
        preview: { helps: [C('powerful-owl', 'Connected hunting range stays'), R(LORRAINE, 'Asked first, and heard'), C('flying-fox', 'Roosting trees stay')], hurts: [E('Costlier homes elsewhere'), T('Fewer homes in the short run')] },
      },
      {
        id: 'build-all', label: 'Build homes on the corridor', needsConsultation: true,
        outcome: 'Four hundred homes go up in two years. The corridor is cut in half, and the owls move on. The homes are popular. Nobody asked Aunty Lorraine.',
        effects: { budget: 10, partnership: -5, tiles: [{ op: 'health', scope: 'bush', mult: 0.8 }], mood: { [LORRAINE]: -10, [ZOE]: 2 } },
        preview: { helps: [T('More homes sooner'), E('Land sale income')], hurts: [C('powerful-owl', 'Hunting range cut in two'), R(LORRAINE, 'Not consulted'), P('Less shade and habitat')] },
      },
      {
        id: 'part-build', label: 'Build on the outer edge only, and replant the rest', needsConsultation: true,
        outcome: 'A narrower strip of homes goes up, and volunteers replant the gaps. The corridor holds, thinner. Nobody gets exactly what they wanted.',
        effects: { budget: -4, partnership: 1, tiles: [{ op: 'health', scope: 'bush', add: 0.01 }], mood: { [LORRAINE]: 1 } },
        preview: { helps: [T('Some new homes'), C('powerful-owl', 'Most of the corridor stays')], hurts: [R(LORRAINE, 'Compromise made without a seat at the table'), P('A thinner corridor')] },
      },
    ],
  },
  {
    id: 'ev-or-transit', title: 'Electric cars or public transport?', phase: 'act2', years: [2045, 2100], repeat: 30, speaker: ZOE,
    setup: 'Zoe sees electric cars on every street and wonders if that is enough. A subsidy would help families switch. Money spent on public transport helps everyone, including the people who do not own a car. The city cannot afford both at full strength.',
    evidence: 'Electric cars produce no exhaust and cut emissions more as the grid gets cleaner. Electric cars can lower running costs and exhaust pollution, but they still need road space, materials and an upfront purchase, and they do not reduce traffic. Public transport moves many more people per lane and reaches people without cars. Cutting transport emissions usually means combining both.',
    options: [
      {
        id: 'transit-first', label: 'Fund transit first, with a smaller subsidy for fleets and taxis', evidenceBacked: true,
        outcome: 'Taxi companies and delivery vans switch to electric first, and the money for buses and rail stays in the budget. The roads are a bit quieter, and the smog a bit thinner.',
        effects: { budget: -22, emissionsKt: -5, tiles: [{ op: 'air', scope: 'all', mult: 0.94 }], mood: { [RAVI]: 7, [ZOE]: 6, [AISHA]: 3 } },
        preview: { helps: [R(RAVI, 'More money for buses and rail'), P('Lower emissions across the board'), T('Cleaner air')], hurts: [T('Families still waiting for an EV subsidy')] },
      },
      {
        id: 'ev-subsidy', label: 'A big subsidy for families buying electric cars',
        outcome: 'Thousands of families switch. The streets are quieter and the air a little cleaner. The traffic jams look the same. Those without a car see little change.',
        effects: { budget: -26, emissionsKt: -4, tiles: [{ op: 'air', scope: 'all', mult: 0.96 }], mood: { [RAVI]: -3, [ZOE]: 2 } },
        preview: { helps: [T('Families who can afford a car'), P('Lower exhaust emissions')], hurts: [R(RAVI, 'Bus riders see no benefit'), E('Expensive for the emissions cut')] },
      },
    ],
  },
  {
    id: 'factory-sites', title: 'What to do with the old factories', phase: 'act2', years: [2038, 2080], speaker: GARY,
    when: { all: [t('count.factory', '>=', 1)] },
    setup: 'Some old factories sit empty, with cracked car parks and tired fences. Gary worked next to them for years. They could become homes, a recycling plant with jobs, or a green park that cools the area. The ground under them may be contaminated, so it has to be tested before anyone moves in.',
    evidence: 'Old industrial land can hold contaminants in the soil, so it must be tested and cleaned before housing or parks. Reusing these sites saves bushland elsewhere. Large paved sites run hot, and replacing the asphalt with trees and soil lowers local temperatures. Employment depends on the site and the proposal, so compare construction work, ongoing jobs, training needs and operating costs.',
    options: [
      {
        id: 'recycle-jobs', label: 'Clean the sites and make them recycling and repair plants', evidenceBacked: true,
        outcome: 'Soil is tested, the worst patches removed, and the sheds are reborn as plants. Gary\'s old shift supervisor runs one. They hire forty people, and a few kids from the footy club.',
        effects: { budget: -22, emissionsKt: -3, society: 1, tiles: [{ op: 'soil', scope: 'contaminated', mult: 0.7 }], flags: { 'factories.reused': 1 }, mood: { [GARY]: 9, [AISHA]: 3 } },
        preview: { helps: [R(GARY, 'Local jobs for former workers'), P('Recycling instead of landfill'), E('New industry')], hurts: [E('Clean-up cost up front')] },
      },
      {
        id: 'homes-sites', label: 'Clean the sites and build homes',
        outcome: 'Homes and a corner shop go up on clean ground. Nobody has to drive far for the first time in years. The job count in the area falls.',
        effects: { budget: -14, emissionsKt: -1, tiles: [{ op: 'soil', scope: 'contaminated', mult: 0.7 }], mood: { [GARY]: -2, [ZOE]: 4 } },
        preview: { helps: [T('Homes near transit'), R(ZOE, 'Housing for people her age')], hurts: [R(GARY, 'Fewer workplaces nearby')] },
      },
      {
        id: 'park-sites', label: 'Turn the sites into parkland with trees',
        outcome: 'Concrete is broken up and trees go in. In summer the old car parks are the coolest spots in the area. The plan has few ongoing jobs in it, and Gary says so.',
        effects: { budget: -18, tiles: [{ op: 'health', scope: 'land', add: 0.03 }, { op: 'soil', scope: 'contaminated', mult: 0.6 }], mood: { [GARY]: -4, [DOLORES]: 5 } },
        preview: { helps: [P('Shade and cooler streets'), C('flying-fox', 'More trees to roost in')], hurts: [R(GARY, 'Few jobs in this plan'), E('Park upkeep costs')] },
      },
    ],
  },
  {
    id: 'foreshore', title: 'Planning the foreshore', phase: 'act2', years: [2040, 2100], repeat: 30, speaker: LORRAINE, needsConsultation: true,
    setup: 'Sea level is creeping up, and the harbour foreshore needs a plan: a seawall, a wide shady buffer of trees and mudflat, or a mix. Aunty Lorraine says the estuary has seen many shorelines come and go. She would like to sit at the planning table from the first meeting, not the last.',
    evidence: 'Mudflats, saltmarsh and shoreline trees absorb wave energy and give migratory shorebirds somewhere to feed, which hard walls cannot. Walls protect buildings but can speed erosion in front of them. Indigenous-led and co-managed land management in Australia and elsewhere often gives biodiversity outcomes at least as good as formal reserves.',
    options: [
      {
        id: 'foreshore-together', label: 'Plan it with Aunty Lorraine from the start', evidenceBacked: true, needsConsultation: true,
        outcome: 'The meetings take longer. The plan is better: trees on the upper bank, mudflat left open for the birds, a path that stays public. Aunty Lorraine brings a thermos and a very detailed map.',
        effects: { budget: -14, partnership: 7, tiles: [{ op: 'health', scope: 'wetland', add: 0.05 }, { op: 'water', scope: 'estuary', mult: 0.95 }], flags: { 'lorraine.foreshore': 1 }, mood: { [LORRAINE]: 12, [AISHA]: 3 } },
        preview: { helps: [R(LORRAINE, 'At the table from the start'), C('shorebirds', 'Feeding mudflats stay open'), P('Natural flood buffer')], hurts: [E('Slower process, higher design cost')] },
      },
      {
        id: 'seawall', label: 'Build a seawall and ask for comments later', needsConsultation: true,
        outcome: 'The wall goes up quickly, and it works for now. The mudflat in front of it thins out. Aunty Lorraine reads the plan at the back of the hall and says nothing.',
        effects: { budget: -24, partnership: -4, tiles: [{ op: 'health', scope: 'wetland', mult: 0.85 }], mood: { [LORRAINE]: -9 } },
        preview: { helps: [T('Protection for foreshore buildings'), E('Clear, familiar engineering')], hurts: [R(LORRAINE, 'Asked after the decision'), C('shorebirds', 'Less mudflat to feed on')] },
      },
      {
        id: 'foreshore-leave', label: 'Make no foreshore plan yet', needsConsultation: true,
        outcome: 'The foreshore stays as it is. Storm surges nibble the edge of the track. The decision waits for a bigger problem to force it.',
        effects: { society: -1, mood: { [LORRAINE]: -3 } },
        preview: { helps: [E('Saves money for now')], hurts: [T('Risk of damage to the foreshore'), R(LORRAINE, 'Planning without her keeps being put off')] },
      },
    ],
  },
  {
    id: 'lights-on', title: 'Keeping the lights on', phase: 'act2', years: [2030, 2095], speaker: GARY, repeat: 25,
    when: { all: [t('renewablePct', '>=', 15)] },
    setup: 'On the hottest evenings everyone turns on the air-conditioning just as the sun goes down. Batteries can cover that peak for a few hours. Gas peaker plants can run as long as there is gas, and add emissions. Gary knows both, and says a blackout in a heatwave is no joke.',
    evidence: 'Grid batteries respond within a fraction of a second and can cover short evening peaks by storing solar power from the day. How long a battery runs and how much it supplies depend on its design and charge. In this game the grid battery covers short peaks, and longer shortages need other resources. Gas peaker plants start quickly and run as long as they have fuel, but they emit carbon dioxide. A reliable grid usually needs several kinds of backup together.',
    options: [
      {
        id: 'batteries', label: 'Build grid batteries to cover the evening peak', evidenceBacked: true,
        outcome: 'Rows of white containers go up near the old power station. On the next 45-degree evening, the lights stay on and the fans keep turning. Gary runs the monitoring.',
        effects: { budget: -24, emissionsKt: -2, flags: { 'grid.batteries': 1 }, mood: { [GARY]: 6, [DOLORES]: 5, [AISHA]: 3 } },
        preview: { helps: [R(DOLORES, 'Fans and lifts keep working'), P('No new fuel burnt'), R(GARY, 'Work at the new site')], hurts: [E('Large up-front cost'), T('Only covers a few hours')] },
      },
      {
        id: 'gas-peakers', label: 'Build gas peaker plants as backup',
        outcome: 'The peakers fire up on the worst nights and keep the grid steady. The emissions line ticks up a little, and Zoe puts it on a poster.',
        effects: { budget: -14, emissionsKt: 6, mood: { [GARY]: 4, [DOLORES]: 3, [ZOE]: -6, [AISHA]: -3 } },
        preview: { helps: [R(DOLORES, 'A steady supply'), E('Cheaper to build')], hurts: [P('More emissions'), R(ZOE, 'Target slips')] },
      },
      {
        id: 'demand', label: 'Pay households to ease back at peak times',
        outcome: 'Thousands of households sign up to cool their homes earlier and ease back at the peak. It is cheap and clever. On the worst night, it is not enough.',
        effects: { budget: -6, society: -1, mood: { [GARY]: -2, [DOLORES]: -4 } },
        preview: { helps: [E('Low cost'), P('No new fuel burnt')], hurts: [R(DOLORES, 'Risk of an outage on the worst night'), T('Less cooling for those who most need it')] },
      },
    ],
  },
];
