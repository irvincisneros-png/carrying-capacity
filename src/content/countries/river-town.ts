/**
 * River Town Country content. EVERY line here is placeholder text that must be reviewed with the local Aboriginal
 * community (the local river community and its Land Council) before release. It is kept general on purpose: no named
 * sacred sites, no invented language, no art references. Place names are placeholders for the community to supply.
 */
import { countryLine as L } from '../country';
import type { CountryOverride } from '../country';

export const RIVER_TOWN_COUNTRY: CountryOverride = {
  communityName: L('the local river Aboriginal community (placeholder: to be named by the community)'),
  sites: {
    1: {
      id: 1,
      name: L('the bank beside the big billabong'),
      guidance: 'care',
      consulted: L('Uncle Ray walked the bank beside the big billabong with you and spoke about families who have camped by this water for a very long time. He asked that the water stays reachable, and that you keep talking as plans change.'),
      disturbed: L('Uncle Ray: "I wish someone had asked us first. This bank has meaning for our families. It is not too late to start talking, and I would like to."'),
      ignored: L('Uncle Ray: "We did talk about this bank, and I am sad. But I will still sit down with you. That is how we mend things."'),
    },
    2: {
      id: 2,
      name: L('the red gum bend on the western reach'),
      guidance: 'protect',
      consulted: L('Uncle Ray asked, gently, that the red gum bend be left as it is. "Some places are best left quiet," he said. "Thank you for asking. That counts for a lot."'),
      disturbed: L('Uncle Ray: "That bend matters to us, and nobody came to talk first. Please come and yarn with me before the next one."'),
      ignored: L('Uncle Ray: "I asked for the red gum bend to be left alone, and it was not. I am disappointed, but the gate is still open."'),
    },
    3: {
      id: 3,
      name: L('the rise on the plain near the hills'),
      guidance: 'care',
      consulted: L('Uncle Ray talked with you about the rise near the hills and how people have walked the plain through the seasons. You can build here with care, he said, if the old trees on the slope are left standing.'),
      disturbed: L('Uncle Ray: "Building on the rise without a word hurt a little. Next time, please ask. We have more to share than you might think."'),
      ignored: L('Uncle Ray: "I asked you to take care of the rise. I will keep asking, because I believe we can do better together."'),
    },
  },
  places: [
    { id: 'river', english: 'the river', original: L('[original name to be supplied by the community]') },
    { id: 'billabong', english: 'the big billabong', original: L('[original name to be supplied by the community]') },
    { id: 'redgum-bend', english: 'the red gum bend', original: L('[original name to be supplied by the community]') },
    { id: 'weir-pool', english: 'the weir pool', original: L('[original name to be supplied by the community]') },
  ],
  lines: {
    comanage: L('Uncle Ray: "You have handed the care of this floodplain back to the community. That means a lot. We will look after it together."'),
    unlockBurning: L('Uncle Ray: "Our old people looked after the red gum edges with fire: small, cool and patchy, in the cool season, never when the trees are thirsty. If you would like, we can talk about doing that again." You can now schedule cool burns on co-managed bush.'),
    unlockFishing: L('Uncle Ray and the river guides agree on a seasonal rest for cod. The fish are left alone in spring, when they breed, so there are more cod for everyone. Fish recover faster in the river.'),
    unlockDualNames: L('Uncle Ray and the Land Council offer to put original place names beside the English ones on town signs. [Place names to be supplied by the community.] Many river towns now do this.'),
    burnDone: (tiles: number) =>
      L(`A cool, patchy burn crept through ${tiles} tiles along the floodplain edge on a still morning in the cool season, leaving islands of unburnt ground. Within weeks green shoots appeared under the red gums.`),
  },
};
