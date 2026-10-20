/**
 * Net Zero City Country content. EVERY line is placeholder text to be reviewed with the local Aboriginal Education
 * Consultative Group and the Local Aboriginal Land Council before release. Kept general on purpose: no named nation,
 * language, sites or stories. Place names are placeholders for the community to supply.
 */
import { countryLine as L, siteContent } from '../country';
import type { CountryOverride } from '../country';

export const NET_ZERO_CITY_COUNTRY: CountryOverride = {
  communityName: L('the local Aboriginal community (name to be supplied by the community)'),
  sites: {
    1: siteContent(1, 'the bank near the river mouth', 'care'),
    2: siteContent(2, 'the foothills on the west side', 'protect'),
    3: siteContent(3, "the flat on the harbour's southern shore", 'care'),
  },
  places: [
    { id: 'estuary', english: 'the estuary', original: L('[original name to be supplied by the community]') },
    { id: 'harbour', english: 'the harbour', original: L('[original name to be supplied by the community]') },
    { id: 'river', english: 'the river', original: L('[original name to be supplied by the community]') },
    { id: 'foothills', english: 'the foothills', original: L('[original name to be supplied by the community]') },
  ],
  lines: {
    comanage: L('The city and the Traditional Owners have agreed on responsibilities, decision-making and funding for this bush.'),
    unlockBurning: L('The community has agreed to talk about cultural fire near the foothills. Whether, where and how it is used is for cultural fire practitioners to decide. You can now schedule burns on co-managed bush.'),
    unlockFishing: L('The agreed plan protects selected breeding and feeding areas in the estuary. Rangers and fishers will monitor whether fish and shorebird numbers recover. In this game, fish recover faster.'),
    unlockDualNames: L('The Land Council and community may offer to put original place names beside the English ones on signs along the river and the harbour. [Place names to be supplied by the community.] Many cities now do this.'),
    burnDone: (tiles: number) =>
      L(`Cultural fire practitioners led work on ${tiles} tiles of foothills bush under the agreed local plan. Monitoring will track its effects on vegetation and fuel.`),
  },
};
