/**
 * River Town Country content. EVERY line here is placeholder text that must be reviewed with the local Aboriginal
 * community (the local river community and its Land Council) before release. It is kept general on purpose: no named
 * sacred sites, no invented language, no art references. Place names are placeholders for the community to supply.
 */
import { countryLine as L, siteContent } from '../country';
import type { CountryOverride } from '../country';

export const RIVER_TOWN_COUNTRY: CountryOverride = {
  communityName: L('the local river Aboriginal community (placeholder: to be named by the community)'),
  sites: {
    1: siteContent(1, 'the bank beside the big billabong', 'care'),
    2: siteContent(2, 'the red gum bend on the western reach', 'protect'),
    3: siteContent(3, 'the rise on the plain near the hills', 'care'),
  },
  places: [
    { id: 'river', english: 'the river', original: L('[original name to be supplied by the community]') },
    { id: 'billabong', english: 'the big billabong', original: L('[original name to be supplied by the community]') },
    { id: 'redgum-bend', english: 'the red gum bend', original: L('[original name to be supplied by the community]') },
    { id: 'weir-pool', english: 'the weir pool', original: L('[original name to be supplied by the community]') },
  ],
  lines: {
    comanage: L('The town and the local river community have agreed on responsibilities, decision-making and funding for this floodplain.'),
    unlockBurning: L('Cultural fire practitioners decide whether burning is appropriate here and establish the conditions for any work. You can now schedule burns on co-managed bush.'),
    unlockFishing: L('The community and river users develop a fishing plan informed by local knowledge, breeding seasons and monitoring. In this game, fish recover faster in the river.'),
    unlockDualNames: L('The Land Council and community may offer to put original place names beside the English ones on town signs. [Place names to be supplied by the community.] Many river towns now do this.'),
    burnDone: (tiles: number) =>
      L(`Cultural fire practitioners led work on ${tiles} tiles along the floodplain edge under the agreed local plan. Monitoring will track its effects on vegetation and fuel.`),
  },
};
