/**
 * Dilemma cards for Reef Island: 4 in Act 1 (about one every 20 years) and 9 in Act 2 (2 to 3 per in-game decade).
 * Several have no clean answer on purpose. Each option lists who it helps and hurts, for the perspective-taking
 * preview, and every card carries an accurate "what does the evidence say?" blurb.
 *
 * Cards spoken by Aunty Mere, and options that touch the partnership, are placeholders flagged needsConsultation.
 */
import { t } from '../../sim/conditions';
import type { DilemmaDef, PreviewTarget } from '../../sim/dilemmas';

const MERE = 'aunty-mere';
const KIERAN = 'kieran-walsh';
const SIONE = 'sione-havili';
const TESS = 'tess-okafor';
const HANA = 'hana-yamamoto';
const TWINS = 'kiah-bailey';

const R = (id: string, why: string): PreviewTarget => ({ type: 'resident', id, why });
const C = (id: string, why: string): PreviewTarget => ({ type: 'creature', id, why });
const P = (why: string): PreviewTarget => ({ type: 'planet', id: 'planet', why });
const E = (why: string): PreviewTarget => ({ type: 'economy', id: 'economy', why });
const T = (why: string): PreviewTarget => ({ type: 'town', id: 'town', why });

export const REEF_ISLAND_DILEMMAS: readonly DilemmaDef[] = [
  // ------------------------------------------------------------------------------------------------ Act 1
  {
    id: 'a1-old-storm', title: 'After the big blow', phase: 'act1', years: [1920, 1980], speaker: KIERAN,
    setup: 'A cyclone has pushed the sea through the low streets and into the school. Everyone wants it to never happen again. Engineers suggest a concrete wall along the front. Others say plant the dunes and let them grow. The wall is quick. The dunes are slow, and cheaper.',
    evidence: 'A hard wall stops waves reaching the street but can shrink the beach in front of it, because waves scour the sand. Dunes held by native vines and grasses absorb wave energy, rebuild after storms and keep a dry nesting beach for turtles. Neither is a match for the biggest surges, which is why homes also need to sit above the flood line.',
    options: [
      {
        id: 'wall', label: 'Build a concrete seawall along the front',
        outcome: 'The wall goes up in a season and the street feels safe. Over the next years the beach in front of it thins, and turtle tracks stop at the concrete.',
        effects: { budget: -25, society: 1, flags: { 'shore.oldWall': 1 }, mood: { [KIERAN]: -3 } },
        preview: { helps: [T('Streets feel safe soon'), R(TESS, 'Fewer flooded houses in small storms')], hurts: [C('reef-turtle', 'Less sand to nest on'), E('Costly to build and mend')] },
      },
      {
        id: 'dunes', label: 'Plant and fence the dunes with native vines', evidenceBacked: true,
        outcome: 'School kids and the CWA ladies plant thousands of vines. It takes years to look like much, but the dune holds sand and bounces back after storms.',
        effects: { budget: -10, society: 1, flags: { 'shore.dunes': 1 }, mood: { [KIERAN]: 3 } },
        preview: { helps: [C('reef-turtle', 'A dry, dark beach to nest on'), T('Kids and neighbours work together')], hurts: [T('Slower and less sure in the first big storm')] },
      },
      {
        id: 'raise', label: 'Raise the floors of the worst-hit houses',
        outcome: 'Carpenters jack up thirty houses on new stumps. The families stay put, and the dunes are left alone, so the beach stays as it is.',
        effects: { budget: -18, mood: { [TESS]: 2 } },
        preview: { helps: [T('Families stay dry in small floods'), R(TESS, 'Her street stays home')], hurts: [E('Only helps the houses that are raised')] },
      },
    ],
  },
  {
    id: 'a1-war-airstrip', title: 'An airstrip for the war', phase: 'act1', years: [1935, 1955], speaker: SIONE, priority: 1,
    setup: 'War has reached the Pacific. The air force wants a long airstrip and a fuel dump on the flat ground behind the beach, and will pay the island well for the land and the labour. Sione worries about fuel drums near the lagoon. Others say the money and the strip could change the island for good.',
    evidence: 'Wartime bases across northern Australia and the Pacific left behind fuel drums, scrap metal and contaminated soil. Where nobody insisted on a clean-up, leaking drums polluted water and reefs for decades, and some sites are still being cleaned today. Many wartime airstrips later opened islands to tourism.',
    options: [
      {
        id: 'cleanup', label: 'Agree, on condition they remove every drum and scrap heap when they leave', evidenceBacked: true,
        outcome: 'The strip is built in a dry season and the island earns more than it has in years. When peace comes, barges carry the drums away. The first tourist plane lands on the old strip a few years later.',
        effects: { budget: 30, society: 1, flags: { 'reef.airstrip': 1 }, mood: { [SIONE]: 3 } },
        preview: { helps: [E('Wartime pay for land and labour'), R(SIONE, 'The lagoon is kept clear of fuel')], hurts: [T('Families give up land behind the beach')] },
      },
      {
        id: 'nocondition', label: 'Agree, and take the extra pay for leaving the clean-up to the island',
        outcome: 'The money is good. When the air force leaves, rusting drums sit in the scrub, and after every wet season a rainbow sheen drifts into the lagoon.',
        effects: { budget: 45, flags: { 'reef.airstrip': 1 }, tiles: [{ op: 'water', scope: 'estuary', add: 0.12 }, { op: 'soil', scope: 'land', add: 0.05 }], mood: { [SIONE]: -6 } },
        preview: { helps: [E('The most money now')], hurts: [R(SIONE, 'Fuel in the lagoon'), C('reef-fish', 'Oily water over the coral'), P('Leaking drums for decades')] },
      },
      {
        id: 'depot', label: 'Offer the old copra shed as a small supply depot instead',
        outcome: 'The air force builds its strip on a bigger island and keeps a small depot here. A little money comes in, and the flat ground stays as gardens.',
        effects: { budget: 12, mood: { [SIONE]: 2 } },
        preview: { helps: [R(SIONE, 'Nothing new near the lagoon'), T('Gardens stay')], hurts: [E('Much less money')] },
      },
    ],
  },
  {
    id: 'a1-first-resort', title: 'A resort and the mangroves', phase: 'act1', years: [1960, 2005], speaker: TESS,
    setup: 'A developer wants to build the first resort on the sheltered side, where the mangroves grow. It would bring jobs for eighty people and a flight a day. A clear-felled beach would look lovely. The mangroves are where Sione sets his crab pots and the fish come to breed.',
    evidence: 'Mangroves are nurseries for fish and prawns, hold the shore with their roots and soften storm waves. Clearing them releases stored carbon and takes away habitat that is slow to return. A set-back resort with a belt of mangroves left in front can still offer a view and a short walk to the water.',
    options: [
      {
        id: 'clear', label: 'Clear the mangroves for a white sand beach',
        outcome: 'The resort opens with a lovely view and a long jetty. Jobs come at once. A year later the fish are fewer in the inlet and the bank starts to slump after rain.',
        effects: { budget: 15, society: 1, tiles: [{ op: 'water', scope: 'estuary', add: 0.15 }], mood: { [TESS]: 6, [SIONE]: -8 } },
        preview: { helps: [R(TESS, 'Steady jobs for the island'), E('Quickest income')], hurts: [R(SIONE, 'Breeding ground lost'), C('mangrove-kingfisher', 'Nesting trees cleared'), P('Stored carbon released')] },
      },
      {
        id: 'partial', label: 'Build set back, and keep a belt of mangroves in front', evidenceBacked: true,
        outcome: 'The resort is smaller and sits behind the trees. Guests walk a boardwalk to the water. Some say the view is not as grand. The mangroves stay.',
        effects: { budget: 8, tiles: [{ op: 'water', scope: 'estuary', add: 0.05 }], mood: { [TESS]: 3, [SIONE]: 2 } },
        preview: { helps: [R(TESS, 'Jobs and a good setting'), R(SIONE, 'Most of the breeding ground survives')], hurts: [E('A smaller first resort, so fewer beds')] },
      },
      {
        id: 'keep', label: 'Say no and keep the inlet as it is',
        outcome: 'The developer goes to another island. The inlet stays thick with mangroves and the fish stay in the crab pots. The island stays small and quiet, and the school roll shrinks.',
        effects: { society: -1, mood: { [TESS]: -6, [SIONE]: 6 } },
        preview: { helps: [R(SIONE, 'Crabs and fish stay'), C('mangrove-kingfisher', 'Hollow trees stay')], hurts: [R(TESS, 'No new jobs'), E('No new income')] },
      },
    ],
  },
  {
    id: 'a1-sewage', title: 'Where does the sewage go?', phase: 'act1', years: [1985, 2020], speaker: SIONE,
    setup: 'The resort and the town are growing, and every flush ends up somewhere. Right now that is septic tanks, and some leak into the lagoon. The council can build a treatment plant, pipe everything out past the reef, or ask each house to fix its own tank.',
    evidence: 'Sewage carries nitrogen and phosphorus. In a lagoon these feed algae that smother seagrass and young coral, and they can help crown-of-thorns starfish larvae grow. Treatment designed to remove nitrogen and phosphorus can cut nutrient pollution, while basic settling removes much less. Pumping sewage offshore only moves the problem, and older septic tanks leak when the ground is wet.',
    options: [
      {
        id: 'plant', label: 'Build a sewage treatment plant', evidenceBacked: true,
        outcome: 'The plant is a squat green shed by the airstrip. It costs real money, but the lagoon is clearer by the next dry season and the seagrass spreads.',
        effects: { budget: -30, tiles: [{ op: 'water', scope: 'estuary', mult: 0.8 }, { op: 'water', scope: 'sea', mult: 0.9 }], flags: { 'sewage.treated': 1 }, mood: { [SIONE]: 8 } },
        preview: { helps: [R(SIONE, 'A cleaner lagoon'), C('dugong', 'Seagrass can spread'), P('Less nutrient runoff')], hurts: [E('A big bill for a small island')] },
      },
      {
        id: 'pipe', label: 'Pipe it out past the reef edge',
        outcome: 'The pipe is cheap and out of sight. The lagoon clears, and the water at the drop-off gets a bit greener. Kieran notices the algae on the bommies.',
        effects: { budget: -10, tiles: [{ op: 'water', scope: 'estuary', mult: 0.9 }, { op: 'water', scope: 'reef', add: 0.1 }], mood: { [KIERAN]: -5 } },
        preview: { helps: [E('Cheaper than a plant'), T('Lagoon smells less')], hurts: [R(KIERAN, 'Algae creeping onto the reef'), C('reef-fish', 'Greener water over the coral')] },
      },
      {
        id: 'tanks', label: 'Ask each house to fix its own septic tank',
        outcome: 'Some do and some do not. After heavy rain a few tanks overflow into the inlet, and Sione finds a slick of scum by his pots.',
        effects: { budget: -4, tiles: [{ op: 'water', scope: 'estuary', add: 0.12 }], mood: { [SIONE]: -5 } },
        preview: { helps: [E('Almost no cost to the town')], hurts: [R(SIONE, 'Scum by the crab pots'), C('mangrove-kingfisher', 'Dirty water around the roots')] },
      },
    ],
  },

  // ------------------------------------------------------------------------------------------------ Act 2
  {
    id: 'd2-starfish', title: 'Too many crown-of-thorns starfish', phase: 'act2', years: [2025, 2100], speaker: KIERAN, repeat: 25, priority: 8,
    when: { any: [t('recent.crown-of-thorns', '>=', 1), t('outbreaks', '>=', 1)] },
    setup: 'A crown-of-thorns outbreak is eating the coral. Kieran has counted thirty starfish on a single bommie. Divers can inject them one by one, at the main dive sites or across the whole reef. It costs money every year. Some say cut the runoff first and the starfish will thin out themselves.',
    evidence: 'Crown-of-thorns starfish eat live coral, and outbreaks seem linked to nutrient-rich runoff that feeds their larvae. Trained divers inject starfish with vinegar or bile salts, which kills them and protects the surrounding coral when done correctly, at key sites, and control programs on the Great Barrier Reef have shown results. Culling treats the symptoms, so cutting runoff and nutrients is still needed.',
    options: [
      {
        id: 'cull-main', label: 'Cull at the main dive sites every year', evidenceBacked: true,
        outcome: 'Teams of divers work the best sites on a rolling roster. The corals at the jetty hold on, and the tourist trips are safe. Kieran says it feels like weeding a garden, but with spikes.',
        effects: { budget: -8, flags: { 'pol.cots.cull': 1 }, mood: { [KIERAN]: 6, [HANA]: 3 } },
        preview: { helps: [R(KIERAN, 'The sites he dives stay alive'), C('reef-fish', 'More live coral'), E('Protects the dive tourism trade')], hurts: [E('Costs money every year')] },
      },
      {
        id: 'cull-all', label: 'Cull across the whole reef, as hard as we can',
        outcome: 'Two boats and sixteen divers work the whole reef. The outbreak is stopped in its tracks, and the bills keep coming. The treasurer looks pale.',
        effects: { budget: -14, flags: { 'pol.cots.cull': 2 }, mood: { [KIERAN]: 8, [HANA]: 5 } },
        preview: { helps: [C('reef-fish', 'Most coral saved'), R(HANA, 'Whole-reef control')], hurts: [E('The most expensive option each year')] },
      },
      {
        id: 'none', label: 'Do not cull. Clean up the runoff and wait.',
        outcome: 'Nothing stops the starfish this season. Patches of coral turn to bare grey rubble, and the dive boat skips three sites. Water quality improves slowly.',
        effects: { flags: { 'pol.cots.cull': 0 }, mood: { [KIERAN]: -7 } },
        preview: { helps: [E('No ongoing cost')], hurts: [R(KIERAN, 'Coral at his sites is eaten'), C('reef-fish', 'Fewer places to shelter')] },
      },
    ],
  },
  {
    id: 'd2-turtle-lights', title: 'Lights behind the nesting beach', phase: 'act2', years: [2025, 2060], speaker: TWINS, priority: 7,
    when: { all: [t('pop.reef-turtle', '>=', 1)] },
    setup: 'Hatchlings crawl towards the brightest horizon, and tonight that is the resort car park. The twins alerted the trained turtle patrol. Tess says dark streets worry the guests. The rangers want amber lights, or lights off in the nesting months.',
    evidence: 'Hatchling turtles find the sea by heading for the brightest, lowest horizon, so lights behind a beach lead them inland. Amber or red lights, shielded and pointed down, disturb hatchlings far less than white light, and still light a path for people. Switching lights off during the nesting months is the most effective of all.',
    options: [
      {
        id: 'amber', label: 'Switch to shielded amber lights', evidenceBacked: true,
        outcome: 'The path glows soft orange instead of white. Guests say it feels cosy. The next hatchlings head straight for the sea, and Kiah counts them in.',
        effects: { budget: -14, flags: { 'turtle.lights': 1 }, mood: { [TWINS]: 8, [TESS]: 2 } },
        preview: { helps: [C('reef-turtle', 'Hatchlings find the water'), R(TWINS, 'Their patrol sees results'), R(TESS, 'Guests still feel safe')], hurts: [E('New fittings cost money')] },
      },
      {
        id: 'out', label: 'Lights out on the beach in nesting season',
        outcome: 'The beach goes properly dark each summer. Turtles love it. A few guests miss their evening stroll and the café shortens its hours.',
        effects: { budget: -4, society: -1, flags: { 'turtle.lights': 2 }, mood: { [TWINS]: 6, [TESS]: -4 } },
        preview: { helps: [C('reef-turtle', 'A truly dark beach')], hurts: [R(TESS, 'Fewer evening guests'), T('Some feel unsafe after dark')] },
      },
      {
        id: 'leave', label: 'Leave the lights as they are',
        outcome: 'Nothing changes. Rangers and volunteers keep walking the beach at night to help stranded hatchlings. The twins stay quiet at dinner.',
        effects: { mood: { [TWINS]: -7 } },
        preview: { helps: [E('No cost')], hurts: [C('reef-turtle', 'Hatchlings go the wrong way'), R(TWINS, 'Their worries are brushed off')] },
      },
    ],
  },
  {
    id: 'd2-nursery', title: 'Growing coral for the future', phase: 'act2', years: [2030, 2090], repeat: 30, speaker: HANA, priority: 6,
    when: { all: [t('count.coralnursery', '<=', 0)] },
    setup: 'Hana has a plan: grow heat-tolerant coral on frames in the lagoon and plant it onto damaged parts of the reef. It is slow, hands-on work that would employ four locals. She is honest that it is not a cure. The reef still needs cooler seas to survive.',
    evidence: 'Coral nurseries grow fragments of coral on frames and plant them on damaged reef, and some programs choose colonies that survived hot summers. Replanting can speed local recovery. It works only at small scales, so it is a supplement and not a replacement for cutting emissions that warm the sea.',
    options: [
      {
        id: 'full', label: 'Fund a full coral nursery and planting team', evidenceBacked: true,
        outcome: 'The nursery fills with frames of branching coral and the team plants out a few hundred fragments by dry season. Kieran pays for the lunch.',
        effects: { budget: -22, flags: { 'reef.nurseryFunded': 1 }, tiles: [{ op: 'health', scope: 'reef', add: 0.05 }], mood: { [HANA]: 8, [KIERAN]: 5 } },
        preview: { helps: [R(HANA, 'Her plan gets going'), C('reef-fish', 'Coral returns near the nursery'), R(KIERAN, 'Reef sites to dive again')], hurts: [E('A running cost for a small result')] },
      },
      {
        id: 'trial', label: 'Fund a small trial for a few years',
        outcome: 'Two frames, one student and a lot of patience. A few corals survive the first summer. Hana says that is a start.',
        effects: { budget: -8, tiles: [{ op: 'health', scope: 'reef', add: 0.02 }], mood: { [HANA]: 2 } },
        preview: { helps: [E('Cheap while we learn')], hurts: [C('reef-fish', 'Too little coral planted to matter yet')] },
      },
      {
        id: 'cuts', label: 'Spend it on cutting runoff and emissions instead',
        outcome: 'The money goes on drains, rain gardens and a new storage battery. The reef gets slightly better water, which may help natural recovery, but no coral is planted.',
        effects: { budget: -12, tiles: [{ op: 'water', scope: 'estuary', mult: 0.93 }], society: 1, mood: { [HANA]: -2 } },
        preview: { helps: [P('Tackles a cause, not a symptom'), C('dugong', 'Cleaner water over the seagrass')], hurts: [R(KIERAN, 'No new coral at his sites'), R(HANA, 'Her plan waits')] },
      },
    ],
  },
  {
    id: 'd2-solar', title: 'Diesel generator or the sun?', phase: 'act2', years: [2025, 2060], speaker: TESS, priority: 5,
    when: { all: [t('renewablePct', '<=', 60)] },
    setup: 'A rumbling diesel generator powers the whole island, and the fuel comes by barge. It is loud and dirty, and one rough week of weather can mean no fuel. Solar panels and big batteries could do most of the job, but they cost a lot to install.',
    evidence: 'Island grids have traditionally run on diesel, which is costly to ship and produces carbon dioxide and local fumes. Solar panels with batteries can supply most of the daytime and evening load, and many remote communities already use them. A small diesel backup is still kept for long cloudy spells and storms.',
    options: [
      {
        id: 'solar-batt', label: 'Install solar panels and a battery, keep a small diesel backup', evidenceBacked: true,
        outcome: 'Panels cover the school and clinic roofs and a field by the airstrip. The generator falls quiet for most of the year. The first month without barge fuel is a small celebration.',
        effects: { budget: -30, incomePerYear: 1, emissionsKt: -6, flags: { 'energy.solar': 1 }, mood: { [TESS]: 5, [HANA]: 4 } },
        preview: { helps: [P('Fewer emissions'), E('Less fuel to barge in'), T('Quieter nights')], hurts: [E('Big up-front cost')] },
      },
      {
        id: 'efficiency', label: 'Fit efficient fridges and cooling, keep the diesel running',
        outcome: 'The resort and the shop swap fridges and air conditioning. The generator is a little quieter. It still burns fuel every day.',
        effects: { budget: -10, society: 1, emissionsKt: -2, mood: { [TESS]: 2 } },
        preview: { helps: [E('Cheaper to start'), T('Lower power bills')], hurts: [P('Still burning diesel')] },
      },
      {
        id: 'keep-diesel', label: 'Keep the diesel generator and bring more fuel',
        outcome: 'A second barge lands each month. The fuel costs more every year. After the next cyclone the barge is late, and the island sits in the dark.',
        effects: { budget: 5, emissionsKt: 4, mood: { [HANA]: -5 } },
        preview: { helps: [E('No big bill now')], hurts: [P('Emissions continue'), R(HANA, 'Warming goal slipping'), T('No power if the barge is late')] },
      },
    ],
  },
  {
    id: 'd2-closures', title: 'Close the bleached sites?', phase: 'act2', years: [2028, 2100], speaker: KIERAN, noCleanAnswer: true, repeat: 25, priority: 9,
    when: { all: [t('recent.marine-heatwave', '>=', 1)] },
    setup: 'The reef is bleached. Hana wants the worst sites closed so the coral is left alone to recover. Kieran needs paying guests to keep the boat, and Tess needs the guests to keep the resort roster. A cap on visitors is a middle road, but nobody finds it easy.',
    evidence: 'Bleached coral is stressed and can recover if the water cools. Boat anchors, fin-kicks and heavy traffic add extra damage while it is weak, and closing sites for a season gives it a better chance. Fewer visitors also means fewer wages. Research on closures is mixed, and results depend on the site.',
    options: [
      {
        id: 'close', label: 'Close the worst sites for the season',
        outcome: 'Buoys go up and the dive boat finds other spots. The closed sites rest. Bookings drop, and Tess cuts some shifts.',
        effects: { budget: -10, flags: { 'reef.closed': 1 }, tiles: [{ op: 'health', scope: 'reef', add: 0.04 }], mood: { [HANA]: 6, [KIERAN]: -5, [TESS]: -6 } },
        preview: { helps: [R(HANA, 'Coral gets time to recover'), C('reef-fish', 'Less disturbance on weak coral')], hurts: [R(KIERAN, 'Fewer trips to run'), R(TESS, 'Shorter rosters'), E('Lost tourist income')] },
      },
      {
        id: 'cap', label: 'Set a daily visitor cap at every site',
        outcome: 'A booking system caps divers per site. The reef gets some peace, and so do the guests. Some days Kieran turns people away at the jetty.',
        effects: { budget: -4, incomePerYear: -1, flags: { 'reef.visitorCap': 1 }, tiles: [{ op: 'health', scope: 'reef', add: 0.02 }], mood: { [HANA]: 3, [KIERAN]: -2, [TESS]: -3 } },
        preview: { helps: [C('reef-fish', 'Less pressure on coral'), R(HANA, 'Some protection')], hurts: [R(TESS, 'Fewer guests overall'), R(KIERAN, 'Capped income'), E('Lower tourism income')] },
      },
      {
        id: 'stay-open', label: 'Keep everything open and carry on',
        outcome: 'The boats go out as usual. Some guests cheer at the fish, and some ask why the coral looks like that. Kieran steers around the worst patches and says nothing.',
        effects: { society: 0, mood: { [HANA]: -6, [KIERAN]: 3, [TESS]: 4 } },
        preview: { helps: [R(TESS, 'Rosters stay full'), R(KIERAN, 'Income stays up')], hurts: [R(HANA, 'More stress on weak coral'), C('reef-fish', 'Fewer places to shelter')] },
      },
    ],
  },
  {
    id: 'd2-sea-country', title: 'Sea Country and the rules', phase: 'act2', years: [2030, 2095], repeat: 30, speaker: MERE, noCleanAnswer: true, needsConsultation: true, priority: 7,
    when: { all: [t('partnership', '>=', 20)] },
    setup: 'Aunty Mere has asked to meet about the turtles, the dugong and the fishing. She asks that decisions about the sea around the island be made with the community. The choice is between a community-led management agreement and a plan led by an agency, with different decision rights, funding and monitoring. Aunty Mere says: please ask us first.',
    evidence: 'Community-led management of land and sea can work well when local knowledge and science are combined. In the Torres Strait and elsewhere, Indigenous ranger groups work with scientists to protect turtles and dugong and to manage hunting. Agency-led plans can be simpler to apply across a region, but may miss local knowledge unless the community is involved.',
    options: [
      {
        id: 'rangers', label: 'Back a community-led management agreement', needsConsultation: true,
        outcome: 'The community writes the plan, with seasonal rests and care for the turtle and dugong grounds, and agrees how it meets shared legal requirements. Some visitors find it strict. Aunty Mere nods slowly and says: this is a start.',
        effects: { budget: -12, partnership: 8, flags: { 'fishing.rest': 1, 'seacountry.led': 1 }, tiles: [{ op: 'health', scope: 'reef', add: 0.03 }], mood: { [MERE]: 10, [SIONE]: -3, [KIERAN]: 1 } },
        preview: { helps: [R(MERE, 'The community leads'), C('dugong', 'Protected feeding grounds'), C('reef-turtle', 'Safer nesting')], hurts: [R(SIONE, 'Some fishing grounds rest'), T('Rules some visitors find strict')] },
      },
      {
        id: 'uniform', label: 'Use an agency-led plan, written on the mainland',
        outcome: 'The new plan arrives by email. It is clear and easy to apply across the region. Aunty Mere reads it and says she would have liked to be asked first.',
        effects: { budget: -6, partnership: -4, flags: { 'seacountry.top-down': 1 }, mood: { [MERE]: -8, [SIONE]: 2 } },
        preview: { helps: [E('Simple and cheap to run'), R(SIONE, 'Same plan for all fishers')], hurts: [R(MERE, 'Not asked first'), C('dugong', 'Local knowledge left out')] },
      },
      {
        id: 'later', label: 'Hold off, and talk with everyone next year',
        outcome: 'Nothing changes this season. A few more fish are taken, and a few more turtles are caught in nets. Aunty Mere says she will wait, but not forever.',
        effects: { partnership: -2, mood: { [MERE]: -3 } },
        preview: { helps: [R(SIONE, 'No new limits yet')], hurts: [C('reef-turtle', 'More at risk another year'), R(MERE, 'Her request is put aside')] },
      },
    ],
  },
  {
    id: 'd2-low-houses', title: 'Wall, mangroves or moving up?', phase: 'act2', years: [2035, 2100], repeat: 25, speaker: TESS, noCleanAnswer: true, priority: 9,
    when: { any: [t('seaRiseCm', '>=', 5), t('recent.storm-surge', '>=', 1)] },
    setup: 'Forty families live on the low belt, a metre above the high tide. A cyclone surge with the rising sea now reaches their floors. Tess asks what we will do. A seawall is quick. Mangroves take years. Moving homes above the assessed flood-risk area could reduce repeated losses, but it would disrupt families and cost money.',
    evidence: 'Seawalls protect behind them but can be overtopped by very big surges, and they squeeze the beach and block turtle nesting. Healthy mangroves reduce wave height and slow erosion, and they grow back slowly. Moving homes (managed retreat) is the surest way to stop repeated flooding, but it is expensive and hard for people to accept.',
    options: [
      {
        id: 'seawall', label: 'Build a seawall along the low belt',
        outcome: 'Engineers pour a wall, a metre high. The streets feel safer by the next cyclone season. The turtles lose a section of nesting beach, and the wall is not a promise for the biggest surges.',
        effects: { budget: -28, society: 1, flags: { 'shore.seawallPlan': 1 }, mood: { [TESS]: 6, [TWINS]: -4, [HANA]: -3 } },
        preview: { helps: [R(TESS, 'Fewer flooded homes soon'), T('Streets feel safer')], hurts: [C('reef-turtle', 'Squeezes the nesting beach'), E('Costly to build and mend')] },
      },
      {
        id: 'mangroves', label: 'Restore the mangroves and the dune in front',
        outcome: 'Volunteers plant thousands of seedlings along the inlet and fence the dunes. Roots take hold slowly. It is a gamble on time, and it is the only option that grows by itself.',
        effects: { budget: -16, flags: { 'shore.mangrove': 1 }, tiles: [{ op: 'health', scope: 'wetland', add: 0.1 }, { op: 'water', scope: 'estuary', mult: 0.9 }], mood: { [SIONE]: 5, [TWINS]: 4, [TESS]: -3 } },
        preview: { helps: [C('mangrove-kingfisher', 'New nesting trees'), R(SIONE, 'More fish habitat'), C('reef-turtle', 'Beach stays open')], hurts: [R(TESS, 'Protection arrives slowly')] },
      },
      {
        id: 'retreat', label: 'Offer to move the low houses to higher ground',
        outcome: 'The first families agree to move uphill. Others do not want to leave a street their grandmothers lived on. The council argues for a month. The homes that moved stay dry.',
        effects: { budget: -35, society: -1, flags: { 'shore.retreat': 1 }, mood: { [TESS]: -4, [TWINS]: 3, [HANA]: 4 } },
        preview: { helps: [T('No homes flooded again'), R(HANA, 'The surest long-term option')], hurts: [R(TESS, 'Neighbours leave the street'), E('Very expensive'), T('Grief at leaving home')] },
      },
    ],
  },
  {
    id: 'd2-shelter', title: 'A shelter for the next cyclone', phase: 'act2', years: [2035, 2100], repeat: 30, speaker: TESS, priority: 6,
    when: { any: [t('recent.storm-surge', '>=', 1), t('homesLost', '>=', 1)] },
    setup: 'During the last cyclone sixty people sheltered in the school hall. It leaks, and the road to it floods. The clinic nurse asks for a proper shelter on high ground, with beds, water and a generator. It costs a lot to build and is hardly ever used.',
    evidence: 'In low coastal towns the biggest danger in a cyclone is the storm surge, and evacuation to higher ground saves lives. Purpose-built cyclone shelters are engineered for high winds and stocked with water and power. They sit unused most years but make a decisive difference in the one year they are needed.',
    options: [
      {
        id: 'shelter', label: 'Build a cyclone shelter on high ground', evidenceBacked: true,
        outcome: 'The shelter has a concrete roof, rainwater tanks and a solar-powered fridge. The island school uses it for assemblies, and the nurse sleeps better knowing it is there.',
        effects: { budget: -24, society: 2, flags: { 'shelter.built': 1 }, mood: { [TESS]: 6, [TWINS]: 3 } },
        preview: { helps: [T('Safe place in a cyclone'), R(TESS, 'Her family and neighbours are safe')], hurts: [E('Rarely used, still costs money')] },
      },
      {
        id: 'hall', label: 'Strengthen and raise the school hall',
        outcome: 'New roof bolts, raised floors and a bigger water tank. It is better than before, though the road still floods and the hall is not rated for the worst winds.',
        effects: { budget: -10, society: 1, flags: { 'shelter.hall': 1 }, mood: { [TESS]: 2 } },
        preview: { helps: [E('Much cheaper than a new building')], hurts: [T('Still not safe in the worst storms')] },
      },
      {
        id: 'evacuate', label: 'Plan to fly everyone to the mainland before the storm',
        outcome: 'An evacuation plan is drawn up. It works when there is warning and the planes can land. Last time the airstrip was under water two days before the storm.',
        effects: { budget: -4, mood: { [TESS]: -3, [TWINS]: -2 } },
        preview: { helps: [E('Cheapest on paper')], hurts: [T('Fails if the airstrip floods'), R(TESS, 'Her mum cannot travel far')] },
      },
    ],
  },
  {
    id: 'd2-runoff', title: 'Runoff on the lagoon', phase: 'act2', years: [2035, 2100], speaker: SIONE, repeat: 25, priority: 4,
    when: { all: [t('estuary', '<=', 65)] },
    setup: 'After heavy rain, a brown plume of fertiliser, silt and garden waste pours from the cane farms and town drains into the lagoon. The seagrass is thin, and dugongs are leaving. A wetland and rain gardens could filter it, but they take land and money.',
    evidence: 'Runoff carries soil, fertiliser and pollutants into the lagoon. It blocks sunlight that seagrass needs and feeds algae. Wetlands and rain gardens slow the water and filter out sediment and nutrients. Dugongs depend on seagrass, and when meadows are smothered they can starve or leave.',
    options: [
      {
        id: 'wetland', label: 'Build a filter wetland and rain gardens', evidenceBacked: true,
        outcome: 'The wetland fills with reeds and frogs. After the next downpour the water leaving it is clear. Sione says it is the first good news in years.',
        effects: { budget: -20, tiles: [{ op: 'water', scope: 'estuary', mult: 0.8 }, { op: 'water', scope: 'sea', mult: 0.92 }], mood: { [SIONE]: 7, [HANA]: 3 } },
        preview: { helps: [C('dugong', 'Seagrass can recover'), R(SIONE, 'Cleaner water for his pots'), C('mangrove-kingfisher', 'Cleaner roots')], hurts: [E('Costs money and land')] },
      },
      {
        id: 'rules', label: 'Ask farms and builders to follow best-practice rules',
        outcome: 'Most sign up. A few do not. The plume is a bit smaller after rain, and a lot of work goes into paperwork.',
        effects: { budget: -6, tiles: [{ op: 'water', scope: 'estuary', mult: 0.93 }], mood: { [SIONE]: 2 } },
        preview: { helps: [E('Cheaper than building'), T('Farmers are part of the plan')], hurts: [C('dugong', 'Slow improvement')] },
      },
      {
        id: 'nothing', label: 'Wait and see how the lagoon copes',
        outcome: 'The next downpour sends another brown plume to the lagoon. The seagrass thins a little more, and Sione moves his pots further out.',
        effects: { tiles: [{ op: 'water', scope: 'estuary', add: 0.1 }], mood: { [SIONE]: -6 } },
        preview: { helps: [E('No cost')], hurts: [C('dugong', 'Seagrass smothered'), R(SIONE, 'Cloudy water at his pots')] },
      },
    ],
  },
];
