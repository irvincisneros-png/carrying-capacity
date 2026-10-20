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

/**
 * Narrator placeholder text for one significant site. No Elder is quoted and no cultural significance, permission or
 * forgiveness is invented: the real guidance has to come from the Traditional Owners.
 */
export function siteContent(id: number, place: string, guidance: 'care' | 'protect'): SiteContent {
  return {
    id,
    name: L(place),
    guidance,
    consulted: guidance === 'protect'
      ? L(`In this game the community asks that ${place} be left as it is. Real guidance would come from the Traditional Owners, who decide how this place is represented.`)
      : L(`The Traditional Owners will determine how ${place} is represented and what guidance is shared. In this game you can build here with care, and keep talking as plans change.`),
    disturbed: L('Building began here before the community was asked. Trust has been damaged, and an agreed process is needed to talk it through.'),
    ignored: L('The community\'s request was not followed. Further decisions need an agreed process to address the damage and prevent it happening again.'),
  };
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
    1: siteContent(1, 'the bank upstream of the estuary', 'care'),
    2: siteContent(2, 'the foot of the escarpment', 'protect'),
    3: siteContent(3, 'the flat behind the beach', 'care'),
  } as Record<number, SiteContent>,
  lines: {
    comanage: L('The town and Traditional Owners have agreed on responsibilities, decision-making and funding for this area.'),
    comanageSmall: L('This patch of bush is too small to look after on its own. Try a larger area of bushland.'),
    burnTooSoon: L('This patch was burnt recently. Burns are spaced out so the bush has time to recover.'),
    burnNeedsCoMgmt: L('Cultural fire happens only on land under an agreed management plan. Agree on co-management of this bush first.'),
    burnWrongSeason: L('Traditional Owners and cultural fire practitioners decide when burning is appropriate. Timing depends on local Country and conditions.'),
    burnLocked: L('This activity needs a community-led agreement. Cultural knowledge is shared only with permission.'),
    burnDone: (tiles: number): CountryLine =>
      L(`Cultural fire practitioners led work on ${tiles} tiles of bush under the agreed local plan. Monitoring will track its effects on vegetation and fuel.`),
    burnQuote: L('Cultural fire is led by Aboriginal cultural fire practitioners. They decide whether, where and when burning is appropriate for this Country. Outcomes depend on local conditions.'),
    unlockDualNames: L('The Land Council and community may offer to put original place names beside the English ones on town signs. [Place names to be supplied by the community.] Many towns now do this.'),
    unlockBurning: L('The community has agreed to talk about cultural fire. Whether, where and how it is used is for cultural fire practitioners to decide. You can now schedule burns on co-managed bush.'),
    unlockFishing: L('The agreed plan protects selected breeding and feeding areas. Rangers and fishers will monitor whether populations recover. In this game, fish recover faster in the estuary.'),
    trustGrows: L('Trust is growing slowly. It takes time and ongoing work, and it has to keep being earned.'),
    seasonalTeaching: L('Community-approved seasonal knowledge may be included here, with permission and attribution.'),
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
