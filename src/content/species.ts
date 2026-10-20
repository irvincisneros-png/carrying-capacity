import type { ScenarioId } from '../sim/types';
import { NET_ZERO_CITY_SPECIES } from './speciesExtra/net-zero-city';
import { RED_DIRT_SPECIES } from './speciesExtra/red-dirt';
import { REEF_ISLAND_SPECIES } from './speciesExtra/reef-island';
import { RIVER_TOWN_SPECIES } from './speciesExtra/river-town';

/** What a species needs, evaluated every year against the map (see sim/wildlife.ts). */
export type HabitatSpec =
  /** Connected woodland patches (corridors count; roads and industry break them unless a crossing is placed). */
  | { kind: 'woodland-patch'; minPatch: number; perTile: number; minHealth: number; roadBuffer: boolean; maxAir: number }
  /** Coastal she-oak plus old woodland for nest hollows. */
  | { kind: 'she-oak'; minTiles: number; perTile: number; coastDist: number; hollowPatch: number }
  /** Seagrass to graze, clean water, and a dark, clean beach to nest on each summer. */
  | { kind: 'nesting-beach'; minSeagrass: number; minDarkFrac: number; darkDist: number; maxWater: number; perTile: number }
  /** Clean river with vegetated banks. With `minFlow`, a river kept flowing (River Town's environmental flow) replaces "no drought". */
  | { kind: 'clean-river'; maxWater: number; minRiparian: number; perTile: number; minFlow?: number }
  /** A healthy river (River Town's river health score), with a fishway at the weir if there is one. */
  | { kind: 'river-health'; minHealth: number; perPoint: number; needsPassage: boolean }
  /** Billabongs that have filled with floodwater and stay clean. */
  | { kind: 'billabong'; minWet: number; maxWater: number; perTile: number }
  /** Shallow seagrass meadows with clean water. */
  | { kind: 'seagrass-meadow'; minTiles: number; maxWater: number; perTile: number }
  /** A living reef: mean coral health above a floor. */
  | { kind: 'reef-cover'; minHealth: number; perPoint: number }
  /** Mature mangrove on the estuary tiles. */
  | { kind: 'mangrove'; minTiles: number; maxWater: number; perTile: number }
  /** A waterhole with water in it and shrubs around it (Red Dirt). */
  | { kind: 'waterhole'; minLevel: number; minAquifer: number; minShrub: number; perShrub: number }
  /** Still, clean wetlands. */
  | { kind: 'wetland'; minWetlands: number; maxWater: number; perWetland: number }
  /** A large, healthy woodland roost near water. */
  | { kind: 'roost'; minPatch: number; waterDist: number; perTile: number }
  /** Estuary mudflats with clean water and quiet edges. */
  | { kind: 'mudflat'; minTiles: number; minEstuary: number; perTile: number; quietDist: number };

export interface FamilyDef {
  id: string;
  /** Name shown in the UI and the census. */
  name: string;
  /** The family shows up once the population reaches this. */
  minPop: number;
  /** Event text when the family first appears (or returns). */
  arrive: string;
  /** Event text when it disappears. */
  lost: string;
}

export interface SpeciesDef {
  id: string;
  name: string;
  scientific: string;
  icon: string;
  scenarios: readonly ScenarioId[];
  habitat: HabitatSpec;
  /** Animals present when Act 2 begins (a remnant in the best case). */
  startPop: number;
  /** Animals that arrive when habitat has been suitable for `arriveAfter` years and none are left. */
  founders: number;
  arriveAfter: number;
  /** Fractional growth per year towards capacity, and decline per year when habitat fails. */
  growth: number;
  decline: number;
  heatSensitive?: boolean;
  families: readonly FamilyDef[];
  /** Population level that counts as thriving (and, for the turtle, a nesting streak). */
  thrive: { pop: number; nestStreak?: number };
  /** Nesting-season lines for turtles ({eggs}, {hatch} and {n} are filled in). Default: the Coal Coast turtle's. */
  nest?: { first: string; again: string; streak: string; missed: string };
  text: {
    blurb: string;
    /** Plain-language needs shown in the habitat tooltip. */
    needs: readonly string[];
    arrive: string;
    lost: string;
    thrive: string;
    /** Tooltip when habitat fails: what to do. */
    help: string;
  };
  /** "What does the evidence say?" blurb. */
  evidence: string;
}

const COAST: readonly ScenarioId[] = ['coal-coast'];
const COAST_VALLEY: readonly ScenarioId[] = ['coal-coast', 'green-valley'];
const COAST_RIVER: readonly ScenarioId[] = ['coal-coast', 'river-town'];
const COAST_CITY: readonly ScenarioId[] = ['coal-coast', 'net-zero-city'];

const BASE_SPECIES: readonly SpeciesDef[] = [
  {
    id: 'koala',
    name: 'Koala',
    scientific: 'Phascolarctos cinereus',
    icon: 'koala',
    scenarios: COAST_VALLEY,
    habitat: { kind: 'woodland-patch', minPatch: 14, perTile: 0.3, minHealth: 0.7, roadBuffer: true, maxAir: 1.5 },
    startPop: 6,
    founders: 4,
    arriveAfter: 3,
    growth: 0.1,
    decline: 0.25,
    families: [
      {
        id: 'marri', name: 'Marri family', minPop: 2,
        arrive: 'The Marri family is back. Two koalas were seen high in the eucalypts at dawn, munching quietly.',
        lost: 'The Marri family has gone from the woodland. The gum leaves are still, and the nights are quieter.',
      },
      {
        id: 'wattle-gully', name: 'Wattle Gully family', minPop: 7,
        arrive: 'A second koala family, the Wattle Gully family, has settled in the connected woodland.',
        lost: 'The Wattle Gully family has not been seen for a season. The corridor to them may have closed.',
      },
      {
        id: 'banksia-ridge', name: 'Banksia Ridge family', minPop: 14,
        arrive: 'A third koala family, the Banksia Ridge family, has joined the others. The bush is full of grunting at night in breeding season.',
        lost: 'The Banksia Ridge family has disappeared from the ridge.',
      },
    ],
    thrive: { pop: 14 },
    text: {
      blurb: 'Eucalypt specialists that need big, connected woodland.',
      needs: ['Woodland patches of 14 or more tiles', 'Corridors joining patches', 'Safe road crossings', 'Clean air'],
      arrive: 'Koalas have found the woodland again: {n} arrived. They will stay as long as the trees stay connected.',
      lost: 'The last koala has left the woodland. Plant and join up more trees, and they may return.',
      thrive: 'There are now {n} koalas in the woodland, in several families. The bush is alive with them.',
      help: 'Koalas need a connected woodland patch of at least 14 tiles. Grow more mature woodland, keep it joined, and put wildlife crossings where roads split it.',
    },
    evidence:
      'Koalas live almost entirely on eucalypt leaves and rarely come to the ground except to cross open country. They were listed as endangered in NSW, Queensland and the ACT in 2022. The biggest threats are habitat loss and fragmentation, vehicle strikes, dog attacks, disease, and drought and heat. Where fenced underpasses and overpasses have been built, road deaths have fallen sharply.',
  },
  {
    id: 'black-cockatoo',
    name: 'Glossy black-cockatoo',
    scientific: 'Calyptorhynchus lathami',
    icon: 'cockatoo',
    scenarios: COAST,
    habitat: { kind: 'she-oak', minTiles: 10, perTile: 0.5, coastDist: 5, hollowPatch: 8 },
    startPop: 8,
    founders: 4,
    arriveAfter: 3,
    growth: 0.08,
    decline: 0.2,
    families: [
      {
        id: 'she-oak-flock', name: 'She-oak flock', minPop: 3,
        arrive: 'The She-oak flock is back. You can hear them cracking open she-oak cones from a long way off.',
        lost: 'The She-oak flock has left. The cones are lying whole under the trees.',
      },
      {
        id: 'headland-flock', name: 'Headland flock', minPop: 8,
        arrive: 'A second group, the Headland flock, has started roosting near the she-oaks above the beach.',
        lost: 'The Headland flock has gone from the cliffs.',
      },
    ],
    thrive: { pop: 10 },
    text: {
      blurb: 'Feeds on she-oak seeds and nests in old tree hollows.',
      needs: ['Coastal she-oak growing back (shrub stage or older)', 'A patch of mature woodland with old hollows'],
      arrive: 'Glossy black-cockatoos are feeding on the she-oaks again: {n} arrived.',
      lost: 'The last glossy black-cockatoo has left. Without she-oak seed to eat, they cannot stay.',
      thrive: 'There are {n} glossy black-cockatoos in the she-oaks. Their soft, creaking calls drift over the dunes.',
      help: 'Black-cockatoos need coastal she-oak growing back and a patch of old woodland nearby for nest hollows.',
    },
    evidence:
      'Glossy black-cockatoos eat almost nothing but the seeds of she-oaks (Allocasuarina), and they need large old trees with hollows to nest in. A suitable hollow can take a hundred years or more to form, which is why protecting old trees matters as much as planting new ones. The species is listed as vulnerable in NSW.',
  },
  {
    id: 'green-turtle',
    name: 'Green turtle',
    scientific: 'Chelonia mydas',
    icon: 'turtle',
    scenarios: COAST,
    habitat: { kind: 'nesting-beach', minSeagrass: 14, minDarkFrac: 0.4, darkDist: 3, maxWater: 0.6, perTile: 0.12 },
    startPop: 1,
    founders: 1,
    arriveAfter: 3,
    growth: 0.07,
    decline: 0.2,
    families: [
      {
        id: 'old-shelly', name: 'Old Shelly', minPop: 1,
        arrive: 'Old Shelly is back in the bay, grazing the seagrass in the early morning.',
        lost: 'Nobody has seen Old Shelly this year. The seagrass meadow is empty.',
      },
      {
        id: 'shellys-clutch', name: "Shelly's youngsters", minPop: 4,
        arrive: "Young turtles from Shelly's clutches are now feeding in the bay.",
        lost: "Shelly's youngsters have left the bay.",
      },
    ],
    thrive: { pop: 3, nestStreak: 3 },
    text: {
      blurb: 'Grazes seagrass, and nests on dark, clean beaches in summer.',
      needs: ['A healthy seagrass meadow', 'Clean water around the beach', 'A dark beach at night, away from lights'],
      arrive: 'A green turtle has arrived in the bay and is grazing the seagrass.',
      lost: 'The last green turtle has left the bay. Without seagrass to eat, it cannot stay.',
      thrive: 'Old Shelly has nested for {n} summers in a row, and young turtles are feeding in the bay.',
      help: 'Green turtles need healthy seagrass, clean water, and a beach that is dark at night. Keep lights and buildings back from the sand.',
    },
    evidence:
      'Adult green turtles graze seagrass, so a healthy meadow feeds them. Females come ashore on warm beaches in summer to lay eggs, and hatchlings find the sea by heading for the brightest horizon, so street lights can lead them the wrong way. The temperature of the sand sets the sex of the hatchlings: warmer nests produce more females, so a heating climate can skew the balance.',
  },
  {
    id: 'platypus',
    name: 'Platypus',
    scientific: 'Ornithorhynchus anatinus',
    icon: 'platypus',
    scenarios: COAST_RIVER,
    habitat: { kind: 'clean-river', maxWater: 0.6, minRiparian: 8, perTile: 0.35, minFlow: 0.65 },
    startPop: 0,
    founders: 2,
    arriveAfter: 5,
    growth: 0.1,
    decline: 0.25,
    families: [
      {
        id: 'reedbed-pair', name: 'Reedbed pair', minPop: 2,
        arrive: 'A platypus! The Reedbed pair has been spotted at dusk, making rings in the quiet water.',
        lost: 'The Reedbed pair is gone from the river. The water is still, but not in a good way.',
      },
      {
        id: 'rocky-run', name: 'Rocky Run pair', minPop: 5,
        arrive: 'A second platypus pair, the Rocky Run pair, has taken up burrows in the upstream bank.',
        lost: 'The Rocky Run pair has left the upstream bank.',
      },
    ],
    thrive: { pop: 5 },
    text: {
      blurb: 'Needs clean, flowing water and vegetated banks to burrow in.',
      needs: ['Clean river water', 'Plants growing along the banks', 'No drought drying the river'],
      arrive: 'Platypus have come back to the river: {n} arrived.',
      lost: 'The last platypus has left the river.',
      thrive: 'There are {n} platypus along the river. People line the bridge at dusk to watch.',
      help: 'Platypus need clean river water and shrubs and trees growing along the banks. Treat runoff and plant the river edge.',
    },
    evidence:
      'Platypus hunt underwater for insect larvae and shrimps, and dig burrows into the banks, so they need clean, flowing water and plants holding the banks together. Droughts, dams and land clearing have shrunk their numbers in many rivers. Scientists can find them by testing river water for traces of their DNA.',
  },
  {
    id: 'frogs',
    name: 'Green and golden bell frog',
    scientific: 'Litoria aurea',
    icon: 'frog',
    scenarios: COAST_VALLEY,
    habitat: { kind: 'wetland', minWetlands: 1, maxWater: 0.8, perWetland: 22 },
    startPop: 0,
    founders: 12,
    arriveAfter: 3,
    growth: 0.2,
    decline: 0.3,
    families: [
      {
        id: 'reed-chorus', name: 'Reedbed chorus', minPop: 10,
        arrive: 'The Reedbed chorus has started up in the new wetland: a deep, throaty call after rain.',
        lost: 'The Reedbed chorus has gone quiet.',
      },
      {
        id: 'dusk-chorus', name: 'Dusk chorus', minPop: 40,
        arrive: 'A second chorus, the Dusk chorus, now starts up when the sun goes down.',
        lost: 'The Dusk chorus has fallen silent.',
      },
    ],
    thrive: { pop: 40 },
    text: {
      blurb: 'Breeds in still, shallow, sunny ponds.',
      needs: ['Constructed or restored wetlands', 'Clean water in and around the wetlands'],
      arrive: 'Green and golden bell frogs have found the wetland: about {n} arrived.',
      lost: 'The frogs have gone from the wetland.',
      thrive: 'There are about {n} bell frogs calling from the wetlands.',
      help: 'Frogs need a stormwater wetland with clean water. Build or protect wetlands beside the river or estuary.',
    },
    evidence:
      'The green and golden bell frog was once common along the east coast but has disappeared from most of it. Drained wetlands and a fungal disease called chytrid are the main causes. It breeds in still, shallow, sunny ponds, so restored and constructed wetlands can give it a home again.',
  },
  {
    id: 'flying-fox',
    name: 'Grey-headed flying-fox',
    scientific: 'Pteropus poliocephalus',
    icon: 'flying-fox',
    scenarios: COAST_CITY,
    habitat: { kind: 'roost', minPatch: 12, waterDist: 5, perTile: 14 },
    startPop: 60,
    founders: 60,
    arriveAfter: 2,
    growth: 0.12,
    decline: 0.2,
    heatSensitive: true,
    families: [
      {
        id: 'estuary-camp', name: 'Estuary camp', minPop: 80,
        arrive: 'The Estuary camp has filled with flying-foxes again. At dusk the sky is full of them.',
        lost: 'The Estuary camp is empty. The trees have lost their night visitors.',
      },
      {
        id: 'headland-camp', name: 'Headland camp', minPop: 250,
        arrive: 'A second camp, the Headland camp, has formed in the tall trees.',
        lost: 'The Headland camp has gone.',
      },
    ],
    thrive: { pop: 150 },
    text: {
      blurb: 'Pollinates and spreads seed at night; very sensitive to extreme heat.',
      needs: ['A large, healthy woodland roost near water', 'Shade and cooler summers'],
      arrive: 'Flying-foxes have found a roost: about {n} arrived.',
      lost: 'The last flying-fox camp has gone.',
      thrive: 'About {n} flying-foxes roost by the estuary, spreading seed across the bush at night.',
      help: 'Flying-foxes need a large mature woodland near water, and relief from extreme heat. Plant dense trees and keep the planet cooler.',
    },
    evidence:
      'Flying-foxes carry pollen and seed over long distances at night, so they help forests regrow. In extreme heat, above about 40 C, they can die by the thousands in a single day, as has happened in several heatwaves in eastern Australia. More frequent heatwaves are one of the main threats to them.',
  },
  {
    id: 'shorebirds',
    name: 'Migratory shorebirds',
    scientific: 'Numenius madagascariensis and Limosa lapponica',
    icon: 'shorebird',
    scenarios: COAST_CITY,
    habitat: { kind: 'mudflat', minTiles: 3, minEstuary: 40, perTile: 12, quietDist: 1 },
    startPop: 20,
    founders: 10,
    arriveAfter: 2,
    growth: 0.12,
    decline: 0.2,
    families: [
      {
        id: 'godwits', name: 'Godwit flock', minPop: 10,
        arrive: 'The godwit flock has landed on the mudflats after its long flight. They look worn out and hungry.',
        lost: 'The godwit flock did not return this year.',
      },
      {
        id: 'curlews', name: 'Curlews', minPop: 30,
        arrive: 'A few eastern curlews have joined the godwits, probing the mud with their long curved bills.',
        lost: 'The curlews have gone from the mudflats.',
      },
    ],
    thrive: { pop: 60 },
    text: {
      blurb: 'Fly thousands of kilometres to feed on clean estuary mud.',
      needs: ['Healthy, clean estuary water', 'Undisturbed mudflats and saltmarsh'],
      arrive: 'Shorebirds have landed on the mudflats: about {n} arrived.',
      lost: 'The shorebirds have gone from the estuary.',
      thrive: 'About {n} shorebirds are feeding on the mudflats, fresh from a flight across the Pacific.',
      help: 'Shorebirds need a clean estuary with undisturbed mudflats. Treat water pollution and keep buildings back from the edge.',
    },
    evidence:
      'Migratory shorebirds such as the bar-tailed godwit and eastern curlew travel thousands of kilometres from the Arctic and Siberia to feed on mud flats here. They need clean mud full of worms and small crabs, and quiet places to rest. Losing estuary habitat along the route is the main reason their numbers are falling.',
  },
];

export const SPECIES: readonly SpeciesDef[] = [
  ...BASE_SPECIES, ...RIVER_TOWN_SPECIES, ...REEF_ISLAND_SPECIES, ...RED_DIRT_SPECIES, ...NET_ZERO_CITY_SPECIES,
];

export const SPECIES_BY_ID: Readonly<Record<string, SpeciesDef>> = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

export function speciesFor(scenario: ScenarioId): SpeciesDef[] {
  return SPECIES.filter((s) => s.scenarios.includes(scenario));
}

/** Species that must all be thriving for a scenario's wildlife bonus star. */
export const BONUS_SPECIES: Readonly<Partial<Record<ScenarioId, readonly string[]>>> = {
  'coal-coast': ['koala', 'green-turtle'],
  'green-valley': ['frogs'],
  'river-town': ['platypus'],
  'reef-island': ['reef-turtle'],
};
