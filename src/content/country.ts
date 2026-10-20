/**
 * Caring for Country content. EVERY line here is placeholder text that must be reviewed with the local Aboriginal
 * Education Consultative Group (AECG) and the Local Aboriginal Land Council before release. It is kept general on
 * purpose: no named sacred sites, no ceremonies, no invented language, no art references. Place names are
 * placeholders for the community to supply.
 */

export interface CountryLine {
  text: string;
  needsConsultation: true;
}
const L = (text: string): CountryLine => ({ text, needsConsultation: true });

export interface SiteContent {
  id: number;
  /** How the site is described in the UI. */
  name: CountryLine;
  /** What the community asks for once consulted. 'protect' = asks that the place is left as it is. */
  guidance: 'care' | 'protect';
  consulted: CountryLine;
  /** Said when someone builds before asking. */
  disturbed: CountryLine;
  /** Said when someone builds after being asked to leave it be. */
  ignored: CountryLine;
}

export const COUNTRY = {
  /** Where trust starts: a town that has not yet listened is a stranger, not an enemy. */
  baseline: 20,
  thresholds: { dualNames: 30, culturalBurning: 45, fishing: 60 },
  costs: { consult: 3, comanage: 15, burn: 12 },
  gains: { consult: 5, consultProtect: 6, comanageFirst: 6, comanageLater: 3, burn: 1.5, yearly: 0.3 },
  /** Partnership lost for building on a significant place without asking, by phase. */
  penalty: { act1: 5, act2: 8, repeat: 1.5, ignoredAdvice: 5 },
  /** Fraction of a co-managed patch a mosaic burn covers. */
  mosaicShare: 0.45,
  sites: {
    1: {
      id: 1,
      name: L('the bank upstream of the estuary'),
      guidance: 'care',
      consulted: L('Aunty June walked the bank with you and spoke about families who have gathered by this water for a very long time. She asked that a path to the water stays open, and that you keep talking as plans change.'),
      disturbed: L('Aunty June: "I wish someone had asked us first. This place has meaning for our families. It is not too late to start talking, and I would like to."'),
      ignored: L('Aunty June: "We did talk about this place, and I am sad. But I will still sit down with you. That is how we mend things."'),
    },
    2: {
      id: 2,
      name: L('the foot of the escarpment'),
      guidance: 'protect',
      consulted: L('Aunty June asked, gently, that this ground at the foot of the escarpment be left as it is. "Some places are best left quiet," she said. "Thank you for asking. That counts for a lot."'),
      disturbed: L('Aunty June: "That ground matters to us, and nobody came to talk first. Please come and yarn with me before the next one."'),
      ignored: L('Aunty June: "I asked for this place to be left alone, and it was not. I am disappointed, but the door is still open."'),
    },
    3: {
      id: 3,
      name: L('the flat behind the beach'),
      guidance: 'care',
      consulted: L('Aunty June talked with you about the flat behind the beach and how people have walked it through the seasons. You can build here with care, she said, if the dunes in front stay healthy.'),
      disturbed: L('Aunty June: "Building here without a word hurt a little. Next time, please ask. We have more to share than you might think."'),
      ignored: L('Aunty June: "I asked you to take care of this place. I will keep asking, because I believe we can do better together."'),
    },
  } as Record<number, SiteContent>,
  lines: {
    comanage: L('Aunty June: "You have handed the care of this bush back to the community. That means a lot. We will look after it together."'),
    comanageSmall: L('This patch of bush is too small to look after on its own. Try a larger area of bushland.'),
    burnTooSoon: L('This patch was burnt recently. Cool burns are spaced out so the bush has time to recover.'),
    burnNeedsCoMgmt: L('Cool burns are led by the community on bush they co-manage. Return the care of this bush first.'),
    burnWrongSeason: L('Cool burns are done in the cooler months, autumn or winter, when fire creeps slowly along the ground.'),
    burnLocked: L('Cultural burning is knowledge that is shared as trust grows. It is not yet time to ask.'),
    burnDone: (tiles: number): CountryLine =>
      L(`A cool, patchy burn crept through ${tiles} tiles of bush on a still morning, leaving islands of unburnt ground. Within weeks green shoots appeared under the trees.`),
    burnQuote: L('Aunty June: "See how low the flame is? It cleans the ground and the old fuel, and leaves the big trees alone. That is what cool fire is for."'),
    unlockDualNames: L('Aunty June and the Land Council offer to put original place names beside the English ones on town signs. [Place names to be supplied by the community.] Many towns now do this.'),
    unlockBurning: L('Aunty June: "Our old people looked after Country with fire: small, cool, slow, patch by patch, in the right season. If you would like, we can talk about doing that again." You can now schedule cool burns on co-managed bush.'),
    unlockFishing: L('Aunty June and the fishers agree on seasonal protocols. Some places rest while the fish are breeding, so there are more fish for everyone. Fish recover faster in the estuary.'),
    trustGrows: L('Aunty June: "It takes time, and it has taken some. But I feel the trust growing, and I am glad."'),
    seasonalTeaching: L('Aunty June: "We read the year from the plants and animals, not just a calendar. When the wattle flowers, when the mullet run, when the birds change. Watch with us and you will see it too."'),
  },
  /** Dual names offered once unlocked. `original` stays a placeholder until the community provides names. */
  places: [
    { id: 'estuary', english: 'the estuary', original: L('[original name to be supplied by the community]') },
    { id: 'headland', english: 'the headland', original: L('[original name to be supplied by the community]') },
    { id: 'escarpment', english: 'the escarpment', original: L('[original name to be supplied by the community]') },
    { id: 'beach', english: 'the main beach', original: L('[original name to be supplied by the community]') },
  ],
} as const;

export interface CountryLines {
  comanage: CountryLine; comanageSmall: CountryLine; burnTooSoon: CountryLine; burnNeedsCoMgmt: CountryLine; burnWrongSeason: CountryLine;
  burnLocked: CountryLine; burnDone: (tiles: number) => CountryLine; burnQuote: CountryLine; unlockDualNames: CountryLine;
  unlockBurning: CountryLine; unlockFishing: CountryLine; trustGrows: CountryLine; seasonalTeaching: CountryLine;
}

/** The shape of the Country content (numbers shared by every scenario, text that can be replaced per scenario). */
export interface CountryContent {
  baseline: number;
  thresholds: { dualNames: number; culturalBurning: number; fishing: number };
  costs: { consult: number; comanage: number; burn: number };
  gains: { consult: number; consultProtect: number; comanageFirst: number; comanageLater: number; burn: number; yearly: number };
  penalty: { act1: number; act2: number; repeat: number; ignoredAdvice: number };
  mosaicShare: number;
  sites: Record<number, SiteContent>;
  lines: CountryLines;
  places: readonly { id: string; english: string; original: CountryLine }[];
}

/** Per-scenario replacements for the places, lines and significant sites. Every line stays flagged needsConsultation. */
export interface CountryOverride {
  sites?: Record<number, SiteContent>;
  places?: readonly { id: string; english: string; original: CountryLine }[];
  lines?: Partial<CountryLines>;
  /** What the Country page calls the community (placeholder until the real community is consulted). */
  communityName?: CountryLine;
}

export { L as countryLine };
