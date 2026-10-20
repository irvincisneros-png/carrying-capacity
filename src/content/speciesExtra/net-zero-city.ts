/** Net Zero City wildlife: powerful owls in the bush corridors (flying-foxes and shorebirds are shared with Coal Coast). */
import type { SpeciesDef } from '../species';

export const NET_ZERO_CITY_SPECIES: readonly SpeciesDef[] = [
  {
    id: 'powerful-owl',
    name: 'Powerful owl',
    scientific: 'Ninox strenua',
    icon: 'owl',
    scenarios: ['net-zero-city'],
    habitat: { kind: 'woodland-patch', minPatch: 12, perTile: 0.15, minHealth: 0.7, roadBuffer: true, maxAir: 1.2 },
    startPop: 2,
    founders: 2,
    arriveAfter: 4,
    growth: 0.07,
    decline: 0.15,
    families: [
      {
        id: 'foothills-pair', name: 'The foothills pair', minPop: 2,
        arrive: 'The foothills pair is back: a huge owl hooting low and slow in the dark above the old quarry.',
        lost: 'The foothills pair has left. The nights are very quiet.',
      },
      {
        id: 'river-pair', name: 'The river corridor pair', minPop: 5,
        arrive: 'A second pair of powerful owls has taken a hollow along the river corridor.',
        lost: 'The river corridor pair has gone.',
      },
    ],
    thrive: { pop: 5 },
    text: {
      blurb: "Australia's biggest owl. Hunts possums at night in tall bushland with old, hollow trees.",
      needs: ['A big patch of tall, mature bushland', 'Old trees with hollows', 'Corridors that join patches'],
      arrive: 'Powerful owls have come back to the city bush: {n} arrived.',
      lost: 'The last powerful owl has left the city bush.',
      thrive: 'About {n} powerful owls live in the city bushland. Joggers pause on the track to hear them.',
      help: 'Powerful owls need a large patch of mature bushland and old trees. Protect and join up the bush along the river and the foothills.',
    },
    evidence:
      'Powerful owls are the largest owls in Australia. They hunt possums and gliders and need big trees with hollows to nest in, which take a century or more to form. In cities they survive only where large patches of bush are connected. They are listed as vulnerable in several states, and loss of old trees is the main reason.',
  },
];
