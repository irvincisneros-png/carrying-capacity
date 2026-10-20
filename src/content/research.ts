/** Recycling innovations (syllabus 4.4.5) with costs, effects and accurate blurbs. */

export interface ResearchEffects {
  /** Added to the recycle refund multiplier (1 + sum). */
  recycleRefund?: number;
  /** Multiplies emissions from deconstructing and recycling. */
  recycleEmissions?: number;
  /** Multiplies repurposing costs. */
  repurposeCost?: number;
  /** Multiplies the waste sector's yearly emissions. */
  wasteEmissions?: number;
  /** Society nudge, once. */
  society?: number;
  /** Flags set when bought. */
  flags?: Readonly<Record<string, number>>;
}

export interface ResearchDef {
  id: string;
  name: string;
  kind: 'innovation' | 'critique';
  cost: number;
  blurb: string;
  /** What the evidence says, including limits. */
  evidence: string;
  requires?: readonly string[];
  /** Repurpose option unlocked, e.g. 'steelworks:green-steel'. */
  unlocks?: readonly string[];
  effects: ResearchEffects;
}

export const RESEARCH: readonly ResearchDef[] = [
  {
    id: 'ewaste', name: 'E-waste recovery', kind: 'innovation', cost: 25,
    blurb: 'Old phones, computers and appliances hold gold, copper and other metals. A recovery plant sorts and melts them down so new products need less mining.',
    evidence: 'A tonne of circuit boards holds far more gold than a tonne of most ores, and recycling aluminium saves about 95% of the energy of making it new, copper about 85%. But less than a quarter of the world\'s e-waste is formally recycled: collecting it and processing it safely is the hard part.',
    effects: { recycleRefund: 0.25 },
  },
  {
    id: 'tyre-road', name: 'Tyre-derived road base', kind: 'innovation', cost: 20,
    blurb: 'Worn-out tyres are ground to crumb and mixed into road asphalt or used as base material, so they stop piling up in stockpiles.',
    evidence: 'Crumb-rubber asphalt is used on roads in Australia and the United States. It can reduce cracking and road noise, but the tyres still need collecting and the mix needs careful quality control.',
    effects: { recycleRefund: 0.1, recycleEmissions: 0.85 },
  },
  {
    id: 'sorting', name: 'Smart sorting', kind: 'innovation', cost: 25,
    blurb: 'Near-infrared sensors and puffs of air sort glass, paper and plastics fast and accurately, so recycled material comes out clean.',
    evidence: 'Cleaner sorted material is worth more and can replace new material. Contamination, such as food scraps or mixed-material packaging, is still a common reason loads are rejected, so good sorting works best alongside less waste in the first place.',
    effects: { recycleRefund: 0.15 },
  },
  {
    id: 'biogas', name: 'Food-waste compost and biogas', kind: 'innovation', cost: 30,
    blurb: 'Food scraps go to compost or a digester instead of landfill. The compost feeds soil and the digester captures methane to burn for power.',
    evidence: 'Food rotting in landfill releases methane, a greenhouse gas about 80 times stronger than CO2 over 20 years. Composting returns nutrients to the soil and anaerobic digesters turn the methane into useful energy. Preventing food waste in the first place beats both.',
    effects: { wasteEmissions: 0.7, society: 1 },
  },
  {
    id: 'construction-reuse', name: 'Construction material reuse', kind: 'innovation', cost: 35,
    blurb: 'Bricks, beams, timber and concrete from old buildings are sorted and reused, or crushed for road base, instead of being dumped.',
    evidence: 'Construction and demolition waste is among the biggest waste streams, and much of it is steel, brick and concrete that can be used again. Reusing a whole steel beam saves more energy than melting it down, which is why "reuse" sits above "recycle" in the waste hierarchy.',
    effects: { recycleRefund: 0.2, repurposeCost: 0.8 },
  },
  {
    id: 'battery-recycling', name: 'Battery recycling', kind: 'innovation', cost: 40,
    blurb: 'Used lithium-ion batteries are shredded and processed to recover cobalt, nickel, lithium and copper for new batteries.',
    evidence: 'Mining battery metals has large environmental and human costs, and the first big wave of grid and vehicle batteries will reach the end of their lives from the 2030s. Recovering the metals means less mining, but plants need steady supplies of old batteries to work well.',
    effects: { recycleRefund: 0.1, recycleEmissions: 0.9 },
  },
  {
    id: 'green-steel', name: 'Green steel (hydrogen direct reduction)', kind: 'innovation', cost: 60,
    blurb: 'Hydrogen made with renewable power replaces coal in turning iron ore into iron. The by-product is water, not CO2.',
    evidence: 'Steelmaking produces roughly 7 to 9% of the world\'s CO2 because coal is used to strip oxygen from iron ore. In hydrogen direct reduction, hydrogen does that job instead, leaving water. Pilot plants in Sweden are already making it. It needs a great deal of clean electricity and costs more for now.',
    unlocks: ['steelworks:green-steel'],
    effects: { society: 1 },
  },
  {
    id: 'plastic-to-fuel', name: 'Plastic-to-fuel: independent review', kind: 'critique', cost: 10,
    blurb: 'A company says it can turn plastic back into fuel. Before anyone signs, you commission an independent look at what it can and cannot do.',
    evidence: 'Plastic-to-fuel (pyrolysis) can take some mixed plastics, but it uses a lot of energy, makes a mixed oil that usually needs refining, and when the fuel is burned its carbon becomes CO2. Most life-cycle studies find that using less plastic, reusing it and recycling it mechanically do better for the climate. It may suit a few hard-to-recycle plastics, not the whole stream.',
    effects: { society: 1, flags: { 'knows.plasticToFuel': 1 } },
  },
];

export const RESEARCH_BY_ID: Readonly<Record<string, ResearchDef>> = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));
