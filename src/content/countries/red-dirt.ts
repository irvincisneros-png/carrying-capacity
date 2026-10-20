/**
 * Caring for Country text for Red Dirt. EVERY line is placeholder text that must be reviewed with the Traditional
 * Owners of the Country the mine sits on (and the relevant Land Council) before release. It stays general on
 * purpose: no named nation, language, sites or stories. "Uncle Wally" is a placeholder name.
 */
import { countryLine as L } from '../country';
import type { CountryOverride } from '../country';

const ORIGINAL = '[original name to be supplied by the community]';

export const RED_DIRT_COUNTRY: CountryOverride = {
  communityName: L('the Traditional Owners of this Country [community name to be agreed]'),
  sites: {
    1: {
      id: 1,
      name: L('the bank beside the waterhole'),
      guidance: 'care',
      consulted: L('Uncle Wally sat with you on the bank beside the waterhole and talked about the many families who have drunk here. He asked that stock and machinery stay back from the edge, and that you keep talking as plans change.'),
      disturbed: L('Uncle Wally: "Nobody asked us before you built on the bank. I am not here to shout. I would just like us to talk, because the birds and the animals need this water too."'),
      ignored: L('Uncle Wally: "We talked about this bank, and then it was built on anyway. That hurts a bit. But I will still make the tea, and we will still talk."'),
    },
    2: {
      id: 2,
      name: L('the foot of the range'),
      guidance: 'protect',
      consulted: L('Uncle Wally asked, gently, that the ground at the foot of the range be left as it is. "Some places are best left quiet," he said. "Thank you for asking. It matters more than you know."'),
      disturbed: L('Uncle Wally: "That ground matters to us, and nobody came to talk first. Come and have a yarn with me before you do the next one, will you?"'),
      ignored: L('Uncle Wally: "I asked for the foot of the range to be left alone, and it was not. I am disappointed, but I have not shut the door."'),
    },
    3: {
      id: 3,
      name: L('the flat at the creek crossing'),
      guidance: 'care',
      consulted: L('Uncle Wally talked with you about the flat at the creek crossing and the way people have used it through the seasons. You can build here with care, he said, if the creek bank and its plants are left healthy.'),
      disturbed: L('Uncle Wally: "Building on the flat without a word stung a little. Next time, ask. We have more to share about this ground than you would think."'),
      ignored: L('Uncle Wally: "I asked you to take care of the flat, and I will keep asking. I think we can still get this right together."'),
    },
  },
  places: [
    { id: 'waterhole', english: 'the waterhole', original: L(ORIGINAL) },
    { id: 'range', english: 'the range', original: L(ORIGINAL) },
    { id: 'creek', english: 'the creek', original: L(ORIGINAL) },
    { id: 'plain', english: 'the red plain', original: L(ORIGINAL) },
  ],
  lines: {
    comanage: L('Uncle Wally: "You have handed the care of this shrubland back to the ranger crew. That means a great deal. We will look after it together, and we will tell you if we need a hand."'),
    unlockBurning: L('Uncle Wally: "Our old people looked after this country with fire: small, cool, patchy burns of the spinifex after good rain years. If you would like, we can talk about doing that again." You can now schedule cool burns on co-managed shrubland.'),
    unlockFishing: L('Uncle Wally and the station owners agree on seasonal rest for the waterhole. After good rain it is left alone for a while, so the birds and the animals have room to feed and breed. The waterhole recovers faster for everyone.'),
    unlockDualNames: L('Uncle Wally and the Land Council offer to put original place names beside the English ones on town signs. [Place names to be supplied by the community.] Many outback towns now do this.'),
    burnDone: (tiles: number) =>
      L(`A cool, patchy burn crept through ${tiles} tiles of spinifex and shrubland on a still morning, leaving islands of unburnt ground. Within weeks green shoots appeared, and the birds were back to feed on the new seed.`),
    burnQuote: L('Uncle Wally: "See how low the flame is? It clears the old, dry fuel and leaves the big mulga alone. That is what a cool fire is for, and why the ground is so quick to come back."'),
    trustGrows: L('Uncle Wally: "It takes time, and it has taken some. But I can feel the trust growing, and I am glad. Pass the biscuits."'),
    seasonalTeaching: L('Uncle Wally: "We read the year from the plants and animals, not just from the calendar. When the creek runs, when the birds gather, when the ground goes quiet. Watch with us and you will see it too."'),
  },
};
