/**
 * Reef Island Country content. EVERY line is placeholder text that must be reviewed with the island community
 * before release. It stays general on purpose: no named places, languages, clans or sacred specifics. Place names
 * are placeholders for the community to supply.
 */
import { countryLine as L } from '../country';
import type { CountryOverride } from '../country';

export const REEF_ISLAND_COUNTRY: CountryOverride = {
  communityName: L('the island community (placeholder: to be agreed with the community)'),
  sites: {
    1: {
      id: 1,
      name: L('the bank beside the mangrove inlet'),
      guidance: 'care',
      consulted: L('Aunty Mere walked the bank beside the inlet with you and spoke about families who have gathered and fished here for a very long time. She asked that a path to the water stays open, and that you keep talking as plans change.'),
      disturbed: L('Aunty Mere: "I wish someone had asked us first. This place has meaning for our families. It is not too late to start talking, and I would like to."'),
      ignored: L('Aunty Mere: "We did talk about this bank, and I am sad. But I will still sit down with you. That is how we mend things."'),
    },
    2: {
      id: 2,
      name: L('the high ground in the middle of the island'),
      guidance: 'protect',
      consulted: L('Aunty Mere asked, gently, that the high ground in the middle of the island be left as it is. "Some places are best left quiet," she said. "Thank you for asking. That counts for a lot."'),
      disturbed: L('Aunty Mere: "That high ground matters to us, and nobody came to talk first. Please come and yarn with me before the next one."'),
      ignored: L('Aunty Mere: "I asked for that ground to be left alone, and it was not. I am disappointed, but the door is still open."'),
    },
    3: {
      id: 3,
      name: L('the flat behind the windward back-beach'),
      guidance: 'care',
      consulted: L('Aunty Mere talked with you about the flat behind the back-beach and how people have walked it through the seasons. You can build here with care, she said, if the dunes in front stay healthy.'),
      disturbed: L('Aunty Mere: "Building here without a word hurt a little. Next time, please ask. We have more to share than you might think."'),
      ignored: L('Aunty Mere: "I asked you to take care of this flat. I will keep asking, because I believe we can do better together."'),
    },
  },
  places: [
    { id: 'inlet', english: 'the mangrove inlet', original: L('[original name to be supplied by the community]') },
    { id: 'lagoon', english: 'the lagoon', original: L('[original name to be supplied by the community]') },
    { id: 'pass', english: 'the boat pass through the reef', original: L('[original name to be supplied by the community]') },
    { id: 'hills', english: 'the rainforest hills', original: L('[original name to be supplied by the community]') },
  ],
  lines: {
    comanage: L('Aunty Mere: "You have handed the care of the island\'s bush back to the community rangers. That means a lot. We will look after it together."'),
    unlockBurning: L('Aunty Mere: "Our old people looked after the grassy slopes with fire: small, cool, slow, patch by patch, in the dry season. If you would like, we can talk about doing that again." You can now schedule cool burns on co-managed bush.'),
    unlockFishing: L('Aunty Mere and the fishers agree on seasonal rests on Sea Country. Some places are left alone while the fish, turtles and dugong breed, so there is more for everyone. Fish recover faster around the island.'),
    unlockDualNames: L('Aunty Mere and the community offer to put original place names beside the English ones on island signs. [Place names to be supplied by the community.] Many towns now do this.'),
    burnDone: (tiles: number) =>
      L(`A cool, patchy burn crept through ${tiles} tiles of grassy slope on a still dry-season morning, leaving islands of unburnt ground. Within weeks green shoots appeared between the trees.`),
  },
};
