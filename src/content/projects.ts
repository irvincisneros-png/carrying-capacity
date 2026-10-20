/**
 * Community projects: a place for Act 2 savings to do good once the town's own transition is paid for. Each can be
 * funded a few times; every round costs more (the easy wins go first). Australian English, Year 9 reading level.
 */

export interface ProjectEffects {
  /** Society nudge, once per round (via the dilemma adjustment, like research). */
  society?: number;
  /** Emissions avoided elsewhere (kt CO2, scaled by the scenario's emission scale), taken off the world's total. */
  avoidedKt?: number;
  /** Bare, weedy or pioneer land tiles beside living bush that are cleared of weeds and planted. */
  plantTiles?: number;
  /** Weedy tiles anywhere that volunteers clear. */
  clearWeeds?: number;
  /** Mood points for every resident. */
  mood?: number;
}

export interface ProjectDef {
  id: string;
  name: string;
  /** Cost of the first round ($k). */
  cost: number;
  /** Each further round costs this much more (multiplier). */
  costGrowth: number;
  /** Rounds that can be funded. */
  rounds: number;
  blurb: string;
  /** What the evidence says, including limits. */
  evidence: string;
  effects: ProjectEffects;
}

export const PROJECTS: readonly ProjectDef[] = [
  {
    id: 'adopt-habitat', name: 'Adopt a habitat', cost: 120, costGrowth: 1.5, rounds: 3,
    blurb: 'Pay a local Landcare group and a bush regeneration crew to pull weeds and plant native seedlings on cleared ground beside living bush.',
    evidence: 'Planting next to existing bush works best: seeds, fungi, insects and birds move in from the healthy side, and new plants join up habitat that animals can travel through. Restoration takes years of follow-up weeding to stick.',
    effects: { plantTiles: 12, society: 1 },
  },
  {
    id: 'climate-aid', name: 'Climate aid for a neighbouring town', cost: 150, costGrowth: 1.5, rounds: 3,
    blurb: 'Share your know-how and money with a town that cannot afford its own transition: rooftop solar for its school and hospital, and help to close an old boiler early.',
    evidence: 'Climate change does not stop at council borders: a tonne of CO2 cut anywhere slows warming everywhere. Richer places helping poorer ones cut emissions and adapt is part of the Paris Agreement. Aid works best when the receiving community decides what it needs.',
    effects: { avoidedKt: 60, society: 1 },
  },
  {
    id: 'cool-refuges', name: 'Cool refuges for older residents', cost: 100, costGrowth: 1.5, rounds: 2,
    blurb: 'Insulate and shade the homes of older people who live alone, and open air-conditioned libraries as cool refuges on the hottest days.',
    evidence: 'Heatwaves kill more Australians than any other natural hazard, and older people living alone are most at risk. Shade, insulation, a cool place to go and someone checking in all save lives.',
    effects: { society: 2, mood: 3 },
  },
  {
    id: 'junior-rangers', name: 'Junior rangers and citizen science', cost: 80, costGrowth: 1.5, rounds: 2,
    blurb: 'Students join weekend weeding crews, count frogs and birds with apps, and send their records to scientists.',
    evidence: 'Citizen scientists collect millions of wildlife records a year in Australia (for example through the Atlas of Living Australia and FrogID). The data shows where species are recovering, and volunteers who help often keep caring for a place for life.',
    effects: { clearWeeds: 25, society: 1, mood: 1 },
  },
];

export const PROJECTS_BY_ID: Readonly<Record<string, ProjectDef>> = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
