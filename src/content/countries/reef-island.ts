/**
 * Reef Island Country content. EVERY line is placeholder text that must be reviewed with the island community
 * before release. It stays general on purpose: no named places, languages, clans or sacred specifics. Place names
 * are placeholders for the community to supply.
 */
import { countryLine as L, siteContent } from '../country';
import type { CountryOverride } from '../country';

export const REEF_ISLAND_COUNTRY: CountryOverride = {
  communityName: L('the island community (placeholder: to be agreed with the community)'),
  sites: {
    1: siteContent(1, 'the bank beside the mangrove inlet', 'care'),
    2: siteContent(2, 'the high ground in the middle of the island', 'protect'),
    3: siteContent(3, 'the flat behind the windward back-beach', 'care'),
  },
  places: [
    { id: 'inlet', english: 'the mangrove inlet', original: L('[original name to be supplied by the community]') },
    { id: 'lagoon', english: 'the lagoon', original: L('[original name to be supplied by the community]') },
    { id: 'pass', english: 'the boat pass through the reef', original: L('[original name to be supplied by the community]') },
    { id: 'hills', english: 'the rainforest hills', original: L('[original name to be supplied by the community]') },
  ],
  lines: {
    comanage: L('The island community rangers and the Traditional Owners have agreed on responsibilities, decision-making and funding for the island\'s bush.'),
    unlockBurning: L('Any cultural fire activity will follow a plan led and approved by the island\'s cultural fire practitioners. You can now schedule burns on co-managed bush.'),
    unlockFishing: L('Sea Country management will follow community-based plans developed by Traditional Owners, rangers and relevant partners. In this game, fish recover faster around the island.'),
    unlockDualNames: L('The community may offer to put original place names beside the English ones on island signs. [Place names to be supplied by the community.] Many towns now do this.'),
    burnDone: (tiles: number) =>
      L(`Cultural fire practitioners led work on ${tiles} tiles of grassy slope under a plan approved by the island community. Monitoring will track its effects on vegetation and fuel.`),
  },
};
