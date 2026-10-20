/** River Town wildlife: Murray cod, the red gum parrot colonies and the billabong frogs (the platypus is shared with Coal Coast). */
import type { SpeciesDef } from '../species';

export const RIVER_TOWN_SPECIES: readonly SpeciesDef[] = [
  {
    id: 'murray-cod',
    name: 'Murray cod',
    scientific: 'Maccullochella peelii',
    icon: 'fish',
    scenarios: ['river-town'],
    habitat: { kind: 'river-health', minHealth: 55, perPoint: 0.55, needsPassage: true },
    startPop: 4,
    founders: 4,
    arriveAfter: 3,
    growth: 0.12,
    decline: 0.2,
    families: [
      {
        id: 'old-granddad', name: 'Old Granddad', minPop: 2,
        arrive: 'A large Murray cod has been recorded beside the fallen red gum, longer than a surfboard. The locals call him Old Granddad.',
        lost: 'Nobody has seen Old Granddad this year. The snag pool under the red gum is empty.',
      },
      {
        id: 'snag-pool', name: 'Snag Pool cod', minPop: 8,
        arrive: 'A second group of Murray cod, the Snag Pool cod, has settled around the fallen timber below the bend.',
        lost: 'The Snag Pool cod have gone from the bend.',
      },
      {
        id: 'weir-school', name: 'Weir pool cod', minPop: 16,
        arrive: 'Young Murray cod are turning up in the weir pool. Some must have swum up through the fishway.',
        lost: 'The Weir pool cod have not been seen for a season.',
      },
    ],
    thrive: { pop: 18 },
    text: {
      blurb: 'The biggest freshwater fish in Australia. Needs clean, flowing water, fallen timber to shelter in, and a way past the weir.',
      needs: ['A healthy river (river health 55 or more)', 'Water that keeps flowing in a dry year', 'A fishway at the weir'],
      arrive: 'Murray cod have been seen in the river again: {n} arrived.',
      lost: 'The last Murray cod has gone from the river.',
      thrive: 'About {n} Murray cod have been recorded along the river. Anglers are throwing the big ones back.',
      help: 'Murray cod need river health of 55 or more, steady flows in a dry year, and a fishway so they can pass the weir. Cut the water taken in dry times and plant the banks.',
    },
    evidence:
      'Murray cod are Australia\'s largest freshwater fish. They can live for forty years or more and grow longer than a metre. They shelter in fallen timber ("snags"), the males guard their eggs in hollow logs in spring, and they need water that is clean, well oxygenated and flowing. Barriers can block movement, and releases from deep storage dams can also cool downstream water and disrupt breeding. In the 2018 and 2019 fish kills, many large old cod died when low flows, heat and algae drained the oxygen from the water. The species is listed as Vulnerable under national law.',
  },
  {
    id: 'superb-parrot',
    name: 'Superb parrot',
    scientific: 'Polytelis swainsonii',
    icon: 'parrot',
    scenarios: ['river-town'],
    habitat: { kind: 'roost', minPatch: 8, waterDist: 3, perTile: 3 },
    startPop: 6,
    founders: 6,
    arriveAfter: 3,
    growth: 0.1,
    decline: 0.2,
    families: [
      {
        id: 'redgum-hollow', name: 'Red gum hollow colony', minPop: 4,
        arrive: 'The Red gum hollow colony is back. Bright green parrots are squabbling over a nest hollow in the biggest old tree on the floodplain.',
        lost: 'The Red gum hollow colony has left. The old hollows are silent.',
      },
      {
        id: 'billabong-bend', name: 'Billabong Bend colony', minPop: 12,
        arrive: 'A second colony, the Billabong Bend colony, is nesting in the red gums by the billabong.',
        lost: 'The Billabong Bend colony has gone.',
      },
    ],
    thrive: { pop: 24 },
    text: {
      blurb: 'A slim green parrot that nests in the hollows of old river red gums.',
      needs: ['A large patch of mature river red gum woodland', 'Water within a few tiles', 'Old trees left standing for hollows'],
      arrive: 'Superb parrots have found the red gums again: {n} arrived.',
      lost: 'The last superb parrot has left the floodplain.',
      thrive: 'About {n} superb parrots are nesting in the red gums. The woodland rings with their calls at dawn.',
      help: 'Superb parrots need a big patch of mature red gum woodland near water. Plant and protect the floodplain, and keep it watered by floods.',
    },
    evidence:
      'Superb parrots nest almost only in hollows in large old trees, and in the Murray-Darling Basin that mostly means river red gums. A hollow big enough for a nest takes a hundred years or more to form, so old trees matter as much as new plantings. Red gums depend on floods that soak the floodplain every few years, and when rivers are held back for irrigation, whole stands of gums can die. The species is listed as vulnerable.',
  },
  {
    id: 'southern-bell-frog',
    name: 'Southern bell frog',
    scientific: 'Litoria raniformis',
    icon: 'frog',
    scenarios: ['river-town'],
    habitat: { kind: 'billabong', minWet: 0.35, maxWater: 0.8, perTile: 6 },
    startPop: 10,
    founders: 14,
    arriveAfter: 2,
    growth: 0.2,
    decline: 0.3,
    families: [
      {
        id: 'billabong-chorus', name: 'Billabong chorus', minPop: 10,
        arrive: 'The Billabong chorus has started up after the flood: a deep, rolling "crawk crawk" all night.',
        lost: 'The Billabong chorus has gone quiet.',
      },
      {
        id: 'floodplain-chorus', name: 'Floodplain chorus', minPop: 40,
        arrive: 'A second chorus, the Floodplain chorus, has taken up in the shallows beyond the red gums.',
        lost: 'The Floodplain chorus has fallen silent.',
      },
    ],
    thrive: { pop: 45 },
    text: {
      blurb: 'A big green frog that breeds in billabongs filled by spring floods.',
      needs: ['Billabongs that have filled with floodwater', 'Clean water', 'A river that still floods the low ground in spring'],
      arrive: 'Southern bell frogs have found the billabongs: about {n} arrived.',
      lost: 'The frogs have gone from the billabongs.',
      thrive: 'There are about {n} southern bell frogs calling from the billabongs after the spring flood.',
      help: 'Southern bell frogs need billabongs that fill in spring, so leave enough water in the river then. They also need clean water.',
    },
    evidence:
      'The southern bell frog breeds in still, shallow, sunny water on river floodplains. Spring flows fill the billabongs and trigger breeding, and when rivers are regulated for irrigation, the floods that used to fill them become rare. Chytrid fungus and farm chemicals have added to the losses. The southern bell frog is nationally Vulnerable and listed as Endangered in NSW. Environmental watering that mimics a natural spring flood has brought frogs back to wetlands in the Murray-Darling Basin.',
  },
];
