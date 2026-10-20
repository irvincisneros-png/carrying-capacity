/**
 * "Simplified!" notes: where the game bends reality to stay playable, and what is really true. Shown in game
 * (Settings > Simplified!) and on the teacher page, which links to each by id. Australian English, Year 9 level.
 */

export interface SimplifiedNote {
  id: string;
  title: string;
  /** What the game does. */
  game: string;
  /** What is really true. */
  reality: string;
  /** Syllabus dot points it touches. */
  dotPoints?: readonly string[];
}

export const SIMPLIFIED: readonly SimplifiedNote[] = [
  {
    id: 'one-town-world', title: 'One town stands in for the whole world',
    game: 'Your town\'s emissions, compared with a "typical industrialising town", scale the real CO₂ curve up or down (between 0.4 and 1.6 times the real rise). That is how one town can warm the planet in the game.',
    reality: 'No single town changes global CO₂ measurably. Global CO₂ is the sum of billions of decisions, which is why the game treats your town as a stand-in for everyone making the same choices.',
    dotPoints: ['4.2.4', '4.2.6'],
  },
  {
    id: 'climate-maths', title: 'Warming from CO₂ is one simple formula',
    game: 'Warming = 1.8 °C for every doubling of CO₂ above 280 ppm, and in Act 2 the actual temperature catches up with that value slowly (a 20-year lag), so warming keeps rising for a while after emissions fall.',
    reality: 'Real climate models include oceans, ice, clouds, aerosols, other greenhouse gases and feedbacks. The 1.8 °C figure sits inside the range scientists estimate for the transient response, and the lag (committed warming) is real.',
    dotPoints: ['4.2.3', '4.2.4'],
  },
  {
    id: 'net-zero-line', title: 'Net zero is a line on a graph',
    game: 'In Red Dirt and Net Zero City, "net zero" means keeping yearly emissions under a fixed line (12 kt and 48 kt) and holding it.',
    reality: 'Real net zero means cutting emissions as far as possible and balancing whatever is left with removals, such as growing forests or capturing CO₂. Removals are limited and uncertain, so deep cuts come first.',
    dotPoints: ['4.2.5'],
  },
  {
    id: 'weather-dice', title: 'Weather events are dice rolls that get more likely',
    game: 'Each season, heatwaves, droughts, bushfires, floods and marine heatwaves are rolled at random. Warming raises the odds and the severity. The same save always rolls the same weather.',
    reality: 'Climate change shifts the odds of extreme weather rather than causing any single event, which is why scientists talk about "attribution": how much more likely or severe an event became. Real forecasts use physics, not dice.',
    dotPoints: ['4.2.1', '4.3.1', '4.3.2', '4.3.3'],
  },
  {
    id: 'time', title: 'Time runs in decades, then seasons',
    game: 'Act 1 jumps ten years per turn. Act 2 runs four seasons a year, 15 seconds a year at normal speed.',
    reality: 'Change happens every day. Compressing 250 years into an hour hides how slowly some things (forests, coral, trust) recover, so the game speeds those up too.',
  },
  {
    id: 'pollution-fields', title: 'Pollution is three numbers per tile',
    game: 'Every tile has an air, a water and a soil pollution value. Sources add to their neighbours, wind and water spread it, and in Act 2 air pollution clears within about a year of its source closing.',
    reality: 'Real pollutants are many different chemicals and particles, each with its own sources, health effects and lifetime. Some, like heavy metals in soil, last for decades or centuries unless the soil is cleaned up or removed.',
    dotPoints: ['4.4.1', '4.5.1'],
  },
  {
    id: 'restoration-speed', title: 'Land heals in years, not decades',
    game: 'Restored tiles grow from bare ground to grasses, shrubs and woodland in a few in-game years if the soil is clean and there is a seed source nearby.',
    reality: 'Real ecological restoration usually takes decades, needs years of weeding and follow-up, and does not always succeed. A planted forest is not the same as an old-growth one.',
    dotPoints: ['4.3.2'],
  },
  {
    id: 'wildlife-rules', title: 'Animals follow a few habitat rules',
    game: 'Each species needs a few things (enough habitat tiles, clean water, connected bush, dark beaches) and its numbers grow or shrink each year depending on them.',
    reality: 'Real populations also depend on disease, predators, food, genetics, chance and more. Scientists survey them over many years before they can say a species is recovering.',
  },
  {
    id: 'energy-grid', title: 'The power grid has two blocks a day',
    game: 'Each season the grid is balanced for one day block and one night block: solar only by day, wind and hydro both, batteries move spare daytime power into the night, then coal and gas fill the gap.',
    reality: 'Real grids balance supply and demand every second, across a whole state, with transmission lines, frequency control, weather forecasts and markets.',
    dotPoints: ['4.2.5'],
  },
  {
    id: 'money', title: 'Money is game dollars',
    game: 'Costs and income are in thousands of game dollars ($k), tuned so choices are hard but possible. In Act 2, savings above a cap become a Transition Fund paid out over 20 to 25 years.',
    reality: 'Real costs vary a lot by place and year, and are often shared between governments, businesses and households. The relative ideas (cheap now, costly later; prevention beats repair) are the point, not the prices.',
  },
  {
    id: 'water-shares', title: 'River water is shared by three sliders',
    game: 'In River Town, the town, the farms and the river each get a share of the flow, and a drought plan banks wet-season water for the farms and restricts use in droughts.',
    reality: 'The Murray–Darling Basin Plan sets sustainable diversion limits, environmental water holdings, water trading and carryover rules across four states and the ACT. It is far more complex, and hotly debated.',
    dotPoints: ['4.3.3'],
  },
  {
    id: 'coral', title: 'Coral health is one number per tile',
    game: 'Reef tiles lose health in marine heatwaves, starfish outbreaks and dirty water, and slowly recover, faster near coral nurseries and with clean water.',
    reality: 'Bleaching risk is measured in "degree heating weeks", recovery takes about a decade between severe events, and different corals respond very differently. Nurseries help locally but cannot replace a whole reef.',
    dotPoints: ['4.3.2', '4.3.4'],
  },
  {
    id: 'country', title: 'Caring for Country is shown as game mechanics',
    game: 'Asking before you build, co-managing bush and cool burns are actions with game effects, and the partnership grows with respectful choices. All of this text is a draft waiting for consultation.',
    reality: 'Aboriginal and Torres Strait Islander land and sea management is knowledge held by communities, specific to each Country and led by Traditional Owners. A game can only point towards it; local Elders and organisations are the right people to teach it.',
    dotPoints: ['4.4.2'],
  },
  {
    id: 'recycling', title: 'Every old building has three fates',
    game: 'Each Act 1 site can be repurposed, taken apart and recycled, or sent to landfill, with research that makes recycling cheaper and cleaner.',
    reality: 'The waste hierarchy (avoid, reduce, reuse, recycle, recover, dispose) is real, but real demolition involves contamination checks, markets for recovered materials and years of planning.',
    dotPoints: ['4.4.3', '4.4.4', '4.4.5'],
  },
];
