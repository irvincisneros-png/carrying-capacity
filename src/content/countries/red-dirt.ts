/**
 * Caring for Country text for Red Dirt. EVERY line is placeholder text that must be reviewed with the Traditional
 * Owners of the Country the mine sits on (and the relevant Land Council) before release. It stays general on
 * purpose: no named nation, language, sites or stories. "Uncle Wally" is a placeholder name.
 */
import { countryLine as L, siteContent } from '../country';
import type { CountryOverride } from '../country';

const ORIGINAL = '[original name to be supplied by the community]';

export const RED_DIRT_COUNTRY: CountryOverride = {
  communityName: L('the Traditional Owners of this Country [community name to be agreed]'),
  sites: {
    1: siteContent(1, 'the bank beside the waterhole', 'care'),
    2: siteContent(2, 'the foot of the range', 'protect'),
    3: siteContent(3, 'the flat at the creek crossing', 'care'),
  },
  places: [
    { id: 'waterhole', english: 'the waterhole', original: L(ORIGINAL) },
    { id: 'range', english: 'the range', original: L(ORIGINAL) },
    { id: 'creek', english: 'the creek', original: L(ORIGINAL) },
    { id: 'plain', english: 'the red plain', original: L(ORIGINAL) },
  ],
  lines: {
    comanage: L('The town and the Traditional Owners have agreed on responsibilities, decision-making and funding for this shrubland, with the ranger crew.'),
    unlockBurning: L('Traditional Owners will determine whether fire belongs in this management plan. Recovery depends on rainfall, vegetation and burn conditions. You can now schedule burns on co-managed shrubland.'),
    unlockFishing: L('The ranger crew and other water users agree on access and monitoring under a locally developed waterhole management plan. In this game, the waterhole recovers faster.'),
    unlockDualNames: L('The Land Council and Traditional Owners may offer to put original place names beside the English ones on town signs. [Place names to be supplied by the community.] Many outback towns now do this.'),
    burnDone: (tiles: number) =>
      L(`Cultural fire practitioners led work on ${tiles} tiles of shrubland under the agreed local plan. Recovery will depend on rainfall, vegetation and burn conditions, and rangers will monitor it.`),
  },
};
