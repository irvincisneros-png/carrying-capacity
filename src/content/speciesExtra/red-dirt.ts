/** Red Dirt wildlife: greater bilbies, black-footed rock-wallabies and budgerigar flocks at the waterhole. */
import type { SpeciesDef } from '../species';

export const RED_DIRT_SPECIES: readonly SpeciesDef[] = [
  {
    id: 'bilby',
    name: 'Greater bilby',
    scientific: 'Macrotis lagotis',
    icon: 'bilby',
    scenarios: ['red-dirt'],
    habitat: { kind: 'woodland-patch', minPatch: 10, perTile: 0.35, minHealth: 0.6, roadBuffer: true, maxAir: 1.2 },
    startPop: 2,
    founders: 3,
    arriveAfter: 4,
    growth: 0.1,
    decline: 0.2,
    families: [
      {
        id: 'burrow-mob', name: 'The burrow mob', minPop: 2,
        arrive: 'Fresh bilby diggings at dawn: the burrow mob is back among the mulga, and the kids found the tracks first.',
        lost: 'The burrow mob has gone from the mulga. The diggings are blowing away.',
      },
      {
        id: 'creek-mob', name: 'The creek bank mob', minPop: 6,
        arrive: 'A second bilby group, the creek bank mob, has dug in along the creek.',
        lost: 'The creek bank mob has left.',
      },
    ],
    thrive: { pop: 10 },
    text: {
      blurb: 'A shy burrowing marsupial with huge ears. Needs shrubland where it can dig.',
      needs: ['A large patch of healthy shrubland', 'Quiet ground away from roads', 'No heavy dust or pollution'],
      arrive: 'Bilbies have moved back into the shrubland: {n} arrived.',
      lost: 'The last bilby has left the shrubland.',
      thrive: 'About {n} bilbies live in the shrubland, and their burrows are everywhere.',
      help: 'Bilbies need a big patch of healthy shrubland. Rehabilitate the mine ground, restore the creek and keep roads away from their ground.',
    },
    evidence:
      'Greater bilbies dig deep burrows that shelter many other animals, and their digging mixes seeds and nutrients into the soil. They once lived across about 70% of Australia but are now found in about a fifth of that range. Feral cats, foxes, rabbits and changed fire patterns are the main threats. They are listed as vulnerable.',
  },
  {
    id: 'rock-wallaby',
    name: 'Black-footed rock-wallaby',
    scientific: 'Petrogale lateralis',
    icon: 'wallaby',
    scenarios: ['red-dirt'],
    habitat: { kind: 'roost', minPatch: 5, waterDist: 8, perTile: 1.3 },
    startPop: 8,
    founders: 6,
    arriveAfter: 3,
    growth: 0.1,
    decline: 0.2,
    heatSensitive: true,
    families: [
      {
        id: 'gorge-colony', name: 'The gorge colony', minPop: 6,
        arrive: 'The gorge colony is back on the rocks above the creek, basking in the first sun and bounding between ledges.',
        lost: 'The gorge colony has gone from the ranges.',
      },
      {
        id: 'ridge-colony', name: 'The ridge colony', minPop: 16,
        arrive: 'A second colony, the ridge colony, has settled in the rocks at the foot of the range.',
        lost: 'The ridge colony has disappeared.',
      },
    ],
    thrive: { pop: 24 },
    text: {
      blurb: 'A nimble wallaby that lives on rocky ledges and feeds on grasses around them. Sensitive to heat and drought.',
      needs: ['Healthy shrubland and grass near rocky ranges', 'Water within reach', 'Shade and cooler summers'],
      arrive: 'Rock-wallabies are back on the ranges: {n} arrived.',
      lost: 'The last rock-wallaby has left the ranges.',
      thrive: 'About {n} rock-wallabies live on the ranges, bounding along ledges at dusk.',
      help: 'Rock-wallabies need healthy shrubland near the ranges and water nearby, and relief from extreme heat. Restore the bush and keep the planet cooler.',
    },
    evidence:
      'Black-footed rock-wallabies shelter in caves and crevices in rocky ranges and come out at dusk to feed on grasses and shrubs. Foxes and feral cats are the main threats, and long droughts and heat make life on bare rock harder. Some populations are now managed with fox baiting and fire planning, often with Traditional Owners and rangers.',
  },
  {
    id: 'budgerigar',
    name: 'Budgerigars',
    scientific: 'Melopsittacus undulatus',
    icon: 'parrot',
    scenarios: ['red-dirt'],
    habitat: { kind: 'waterhole', minLevel: 0.35, minAquifer: 30, minShrub: 6, perShrub: 9 },
    startPop: 40,
    founders: 60,
    arriveAfter: 2,
    growth: 0.18,
    decline: 0.3,
    heatSensitive: true,
    families: [
      {
        id: 'waterhole-flock', name: 'The waterhole flock', minPop: 40,
        arrive: 'A flock of budgerigars swept in at sunrise, a green and yellow ribbon over the waterhole, drinking in rows along the edge.',
        lost: 'The budgerigars have left the waterhole.',
      },
      {
        id: 'big-flock', name: 'The big flock', minPop: 140,
        arrive: 'The big flock has arrived: thousands of budgerigars wheeling over the plain like smoke.',
        lost: 'The big flock has gone.',
      },
    ],
    thrive: { pop: 160 },
    text: {
      blurb: 'Small wild parrots that follow the rain across the desert and drink every day.',
      needs: ['A waterhole with water in it', 'Shrubs and trees nearby for shelter', 'A full aquifer to top the waterhole up'],
      arrive: 'Budgerigars have found the waterhole: about {n} arrived.',
      lost: 'The budgerigars have gone. The waterhole is dry or too exposed.',
      thrive: 'About {n} budgerigars wheel over the waterhole at dusk.',
      help: 'Budgerigars need water in the waterhole and shrubs around it. Do not let the aquifer run dry, and plant the creek banks.',
    },
    evidence:
      'Wild budgerigars are nomadic and follow rain and seeding grasses across inland Australia. They must drink daily in hot weather, so they gather at waterholes. In extreme heat, flocks have dropped from the sky: thousands of budgerigars died in heatwaves in the 2019-2020 summer, and during very hot days small birds can lose water faster than they can drink.',
  },
];
