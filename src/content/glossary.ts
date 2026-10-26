/**
 * The field guide (WP8d): key terms, each underlined with a tooltip the first time it shows up, and listed in the
 * Field guide panel. `match` is a case-insensitive pattern for the words as they appear in the game's text.
 * Plain definitions at Year 9 level; science follows the research notes.
 */

export interface GlossTerm {
  id: string;
  term: string;
  /** Regular expression source matched case-insensitively with word boundaries. */
  match: string;
  def: string;
}

export const GLOSSARY: readonly GlossTerm[] = [
  { id: 'carrying-capacity', term: 'Carrying capacity', match: 'carrying capacity', def: 'The most living things a place can support for a long time with its own food, water and space.' },
  { id: 'overshoot', term: 'Overshoot', match: 'overshoot', def: 'Using nature faster than it can grow back. Like spending more than you earn: it works for a while, but the savings run out.' },
  { id: 'footprint', term: 'Ecological footprint', match: 'ecological footprint|footprint', def: 'How much land and sea it takes to supply what we use and to soak up our waste.' },
  { id: 'biocapacity', term: 'Biocapacity', match: 'biocapacity', def: 'How much nature can regrow in a year.' },
  { id: 'renewable', term: 'Renewable', match: 'renewables?', def: 'Something that is replaced by nature as fast as we use it, like sunlight, wind, flowing water and tides. Coal and gas are not renewable.' },
  { id: 'fossil-fuel', term: 'Fossil fuel', match: 'fossil fuels?', def: 'Coal, oil and gas, formed from ancient plants and animals over millions of years. Burning them releases carbon dioxide.' },
  { id: 'greenhouse-gas', term: 'Greenhouse gas', match: 'greenhouse gas(?:es)?', def: 'A gas, like carbon dioxide or methane, that traps heat in the air. More of it means a warmer planet.' },
  { id: 'carbon-sink', term: 'Carbon sink', match: 'carbon sinks?', def: 'Something that takes in more carbon dioxide than it gives out, like growing forests, wetlands and the sea.' },
  { id: 'biodiversity', term: 'Biodiversity', match: 'biodiversity', def: 'The variety of living things in a place, from tiny bugs to big trees. More variety usually means a stronger, healthier place.' },
  { id: 'habitat', term: 'Habitat', match: 'habitats?', def: 'The place where an animal or plant finds the food, water and shelter it needs.' },
  { id: 'succession', term: 'Succession', match: 'succession', def: 'The slow, steady order in which a place regrows: bare ground, then grasses, then shrubs, then woodland.' },
  { id: 'restoration', term: 'Restoration', match: 'restoration', def: 'Helping a damaged place recover, by planting, weeding, cleaning up pollution and protecting what is left.' },
  { id: 'eutrophication', term: 'Eutrophication', match: 'eutrophication', def: 'When too many nutrients (like nitrogen and phosphorus from fertiliser and sewage) feed algae, which then die and rot and use up the oxygen in the water.' },
  { id: 'algal-bloom', term: 'Algal bloom', match: 'algal blooms?|algae bloom|blue-green algae', def: 'A fast outbreak of algae that turns the water green. Some types make toxins that harm fish, animals and people.' },
  { id: 'dissolved-oxygen', term: 'Dissolved oxygen', match: 'dissolved oxygen', def: 'The oxygen mixed into water that fish and water bugs breathe. Healthy rivers are about 85 to 110 percent saturated.' },
  { id: 'turbidity', term: 'Turbidity', match: 'turbidity', def: 'How cloudy water is. Mud smothers fish eggs and blocks the sunlight plants need.' },
  { id: 'macroinvertebrate', term: 'Macroinvertebrates (water bugs)', match: 'macroinvertebrates?|water bugs?', def: 'Small animals without backbones that you can see without a microscope, like mayfly and caddisfly larvae. Which ones live in a creek tells you how clean it is.' },
  { id: 'signal2', term: 'SIGNAL2', match: 'signal2|signal score', def: 'A score for water bugs. Each kind gets a grade from 1 (copes with pollution) to 10 (needs clean water), and the score is the average. Above about 6 is healthy.' },
  { id: 'salinity', term: 'Salinity', match: 'salinity', def: 'How much salt is in the water or soil. Too much harms crops, plants and freshwater animals. Irrigation and low river flow can raise it.' },
  { id: 'leachate', term: 'Leachate', match: 'leachate', def: 'The dirty liquid that seeps out of rubbish and soaks into the ground and creeks.' },
  { id: 'bioaccumulation', term: 'Bioaccumulation', match: 'bioaccumulation|bioaccumulate', def: 'When a poison, like mercury, builds up in the bodies of living things, and gets stronger as it passes from small animals to the big ones that eat them.' },
  { id: 'runoff', term: 'Runoff', match: 'runoff|run-off', def: 'Rain that washes over the ground into creeks, carrying soil, fertiliser and dirt with it.' },
  { id: 'catchment', term: 'Catchment', match: 'catchments?', def: 'All the land that drains into one creek or river.' },
  { id: 'erosion', term: 'Erosion', match: 'erosion|erode', def: 'Soil being washed or blown away, usually where plants have been cleared.' },
  { id: 'remediation', term: 'Remediation', match: 'remediation|phytoremediation', def: 'Cleaning up polluted soil or water. Phytoremediation uses plants that take up the pollution.' },
  { id: 'circular-economy', term: 'Circular economy', match: 'circular economy', def: 'An economy that keeps materials in use by reusing, repairing and recycling, so little becomes waste.' },
  { id: 'waste-hierarchy', term: 'Waste hierarchy', match: 'waste hierarchy', def: 'The order of best choices for waste: avoid it, reuse it, recycle it, recover energy from it, and only last, bury it.' },
  { id: 'methane', term: 'Methane', match: 'methane', def: 'A greenhouse gas from rotting rubbish and food waste, and from livestock. Over 20 years it traps about 80 times as much heat as the same weight of carbon dioxide.' },
  { id: 'emissions', term: 'Emissions', match: 'emissions', def: 'Gases, like carbon dioxide, released into the air by burning fuel, clearing land and making things.' },
  { id: 'mitigation', term: 'Mitigation', match: 'mitigation|mitigate', def: 'Acting to make a problem smaller, such as cutting the emissions that cause warming.' },
  { id: 'marine-heatwave', term: 'Marine heatwave', match: 'marine heatwave', def: 'A spell when the sea stays unusually hot for weeks. It can bleach corals white.' },
  { id: 'bleaching', term: 'Coral bleaching', match: 'bleach(?:ing|ed)?', def: 'When hot water makes corals push out the tiny algae that feed and colour them. The coral turns white and may starve.' },
  { id: 'wetland', term: 'Wetland', match: 'wetlands?', def: 'Land that is soaked with water, like a swamp or billabong. Wetlands filter dirty water and are home to frogs, birds and fish.' },
  { id: 'urban-sprawl', term: 'Urban sprawl', match: 'urban sprawl|sprawl(?:ing)?', def: 'When a town spreads out over a lot of land, with big blocks and long roads. Each person uses more land, more road and more fuel to get around, and more bush is cleared.' },
  { id: 'density', term: 'Density', match: 'densit(?:y|ies)', def: 'How many people live on each hectare of land. Low density means houses on big blocks; high density means townhouses and flats. Denser towns use less land and shorter roads for each person, but they need buses, parks and good design.' },
  { id: 'urban-heat-island', term: 'Urban heat island', match: 'urban heat islands?|heat islands?', def: 'A city that is hotter than the bush around it, because dark roofs and roads soak up heat, there are fewer trees to cool the air, and buildings and cars give off heat.' },
  { id: 'aquifer', term: 'Aquifer', match: 'aquifers?', def: 'Rock or sand underground that holds water, which bores can pump up.' },
];

export const GLOSS_BY_ID: Record<string, GlossTerm> = Object.fromEntries(GLOSSARY.map((t) => [t.id, t]));
