/**
 * Net Zero City Country content. EVERY line is placeholder text to be reviewed with the local Aboriginal Education
 * Consultative Group and the Local Aboriginal Land Council before release. Kept general on purpose: no named nation,
 * language, sites or stories. Place names are placeholders for the community to supply.
 */
import { countryLine as L } from '../country';
import type { CountryOverride } from '../country';

export const NET_ZERO_CITY_COUNTRY: CountryOverride = {
  communityName: L('the local Aboriginal community (name to be supplied by the community)'),
  sites: {
    1: {
      id: 1,
      name: L('the bank near the river mouth'),
      guidance: 'care',
      consulted: L('Aunty Lorraine walked the river bank with you, north of the estuary, and talked about families who have gathered by this water since long before the city. She asked that a path stays open, and the shade trees stay.'),
      disturbed: L('Aunty Lorraine: "Nobody rang me first. This bank means a lot to my family, love. It is not too late to sit down and talk, and I would like to."'),
      ignored: L('Aunty Lorraine: "We talked about this bank, and then it was built on anyway. I am sad. But I will still turn up. That is how things get mended."'),
    },
    2: {
      id: 2,
      name: L('the foothills on the west side'),
      guidance: 'protect',
      consulted: L('Aunty Lorraine asked, gently, that this ground in the western foothills be left as it is. "Some places are best left quiet," she said. "Thank you for asking. In this city, that counts for a lot."'),
      disturbed: L('Aunty Lorraine: "That ground in the foothills matters to us, and nobody came to talk first. Please yarn with me before the next one."'),
      ignored: L('Aunty Lorraine: "I asked for the foothills to be left alone, and they were not. I am disappointed. The door is still open, though."'),
    },
    3: {
      id: 3,
      name: L('the flat on the harbour\'s southern shore'),
      guidance: 'care',
      consulted: L('Aunty Lorraine talked with you about the flat on the harbour\'s southern shore and how people have walked it through the seasons. You can build here with care, she said, if the shoreline and its birds are looked after.'),
      disturbed: L('Aunty Lorraine: "Building on the southern shore without a word stung a little. Next time, please ask. We have more to share than you might think."'),
      ignored: L('Aunty Lorraine: "I asked you to take care of the southern shore. I will keep asking, because I believe this city can do better with us at the table."'),
    },
  },
  places: [
    { id: 'estuary', english: 'the estuary', original: L('[original name to be supplied by the community]') },
    { id: 'harbour', english: 'the harbour', original: L('[original name to be supplied by the community]') },
    { id: 'river', english: 'the river', original: L('[original name to be supplied by the community]') },
    { id: 'foothills', english: 'the foothills', original: L('[original name to be supplied by the community]') },
  ],
  lines: {
    comanage: L('Aunty Lorraine: "You have handed the care of this bush back to the community. That means a lot, and it will mean more in the hot years. We will look after it together."'),
    unlockBurning: L('Aunty Lorraine: "Our old people looked after the foothills bush with fire: small, cool and slow, patch by patch, in the cool season. It keeps the fuel down near the houses. If you like, we can talk about doing it again." You can now schedule cool burns on co-managed bush.'),
    unlockFishing: L('Aunty Lorraine and the fishers agree on seasonal rests for parts of the estuary while the fish and the birds are breeding. There are more fish for everyone, and more to feed the shorebirds.'),
    unlockDualNames: L('Aunty Lorraine and the Land Council offer to put original place names beside the English ones on signs along the river and the harbour. [Place names to be supplied by the community.] Many cities now do this.'),
    burnDone: (tiles: number) =>
      L(`A cool, patchy burn crept through ${tiles} tiles of foothills bush on a still morning in the cool season, leaving islands of unburnt ground. Within weeks green shoots appeared under the trees, and the houses below felt safer.`),
  },
};
