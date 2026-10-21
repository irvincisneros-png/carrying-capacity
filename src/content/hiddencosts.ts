/**
 * Hidden costs of clean tech (WP8e): balanced evidence lines for the solar, wind and battery build cards, and the text
 * for the circular-economy "hidden costs" review. Figures and sources are from docs/research/wp8-wp9-facts.md section 5.
 * Several figures are secondhand or differ between reports, so the wording says "about", "an estimate" and "one study".
 * The point is not that clean energy is bad. Every way of making power has costs, and the costs of clean tech can be
 * managed: panels and batteries can be recycled, and mines rehabilitated, but burnt coal cannot be recycled.
 */
import type { BuildingId } from '../sim/types';

export interface HiddenCost {
  /** Short line for the build-card tooltip (about 30 words). */
  short: string;
  /** Longer line for the Inspect panel and the review (about 45 words), with its source. */
  long: string;
  /** The honest other side. */
  balance: string;
}

const PANELS: HiddenCost = {
  short: 'Panels last about 25 to 30 years, and old ones are a growing waste stream. An estimate for Australia: up to 100,000 tonnes a year by about 2030.',
  long: 'A 2024 UNSW study estimated Australia could be throwing out up to 100,000 tonnes of old panels a year by about 2030, and roughly a million tonnes in all by 2035. Landfill costs about $2 a panel and recycling $10 to $20, so many go to landfill unless the rules change. (UNSW / ACAP scoping study, 2024)',
  balance: 'Panels can be recycled for glass, aluminium and silver. Coal, once burnt, cannot.',
};

const WIND: HiddenCost = {
  short: 'Many turbine magnets use rare earth metals. Refining them leaves low-level radioactive waste, so how it is stored matters.',
  long: 'Many turbines use rare earth magnets. Lynas, an Australian company, refines rare earths in Malaysia and stores low-level radioactive residue on site. A study for a Malaysian environment group warned that liquid from the waste could reach groundwater. How well the waste is managed matters. (Oeko-Institut, for a Malaysian NGO)',
  balance: 'Careful waste storage and recycling of magnets can reduce the harm. A wind farm burns no fuel at all.',
};

const BATTERY: HiddenCost = {
  short: 'Batteries need lithium. Australia mines about a third of the world\'s, and one WA mine sought to clear up to 541 hectares of bush. Only about 2% of lithium battery waste was recycled in 2018.',
  long: 'Australia mined about 88,000 tonnes of lithium in 2024, around 37% of the world\'s (figures vary by source). A WA mine sought to clear up to 541 hectares of bush and had to offset black cockatoo habitat. In 2018 CSIRO found only about 2% of lithium battery waste was recycled here, but 98% of lead-acid batteries were. (USGS; WA EPA; CSIRO)',
  balance: 'Lead-acid batteries show a high recycling rate is possible. Mines can be rehabilitated and offset, and recycled lithium reduces the need for new mining.',
};

export const HIDDEN_COSTS: Partial<Record<BuildingId, HiddenCost>> = {
  solarfarm: PANELS,
  rooftopsolar: PANELS,
  solarlandfill: PANELS,
  windfarm: WIND,
  offshorewind: WIND,
  battery: BATTERY,
  batteryhub: BATTERY,
};

/** The circular-economy review that puts the three together (research item `clean-tech-costs`). */
export const CLEAN_TECH_REVIEW = {
  blurb: 'An independent look at what it costs to build clean energy: mining for lithium and rare earths, old panels, and batteries that are rarely recycled. A critique that asks how to make clean tech cleaner.',
  evidence: 'Solar, wind and batteries cost less in carbon than burning coal, but they are not free of harm. Lithium and rare earth mining clear bush and make waste: one WA lithium mine sought to clear up to 541 hectares and offset cockatoo habitat. Australia could be throwing out up to 100,000 tonnes of panels a year by about 2030 (UNSW, 2024). Only about 2% of lithium battery waste was recycled in 2018 (CSIRO), though 98% of lead-acid batteries were, so a high rate is possible. The answer is not to avoid renewables. It is to mine with care, design for recycling and keep the materials in use.',
};
