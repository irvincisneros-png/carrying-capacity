/**
 * Epilogue / Report Card. buildReportCard(state) is a pure read of the game state: objectives, stars, each
 * resident's chosen ending, the species census, an emissions timeline, the decisions that mattered most, and
 * reflection prompts. Stars: one for the goal, two with the wildlife bonus, three when every resident's arc also
 * ended well; sending legacy sites to landfill costs a star.
 */
import { EPILOGUE, LETTER_PROMPT, REFLECTIONS } from '../content/report';
import { RESEARCH_BY_ID } from '../content/research';
import { counts, legacyPercent } from './circular';
import { objectiveStatus } from './objectives';
import { projectsFunded } from './projects';
import { resolveEndings } from './residents';
import type { ResidentEnding } from './residents';
import { realTemp } from './realData';
import { getScenario } from './scenarios';
import { hash32 } from './season';
import { census } from './wildlife';
import { landPerPerson } from './ledger';
import type { LandPerPerson } from './ledger';
import type { CensusEntry } from './wildlife';
import type { EmissionsBySource, GameState, ObjectiveResult } from './types';
import { EMISSION_CATEGORIES } from './types';

export interface TimelinePoint {
  year: number;
  totalKt: number;
}

export interface DecisionNote {
  year: number;
  title: string;
  choice: string;
  evidenceBacked: boolean;
  impact: number;
}

export interface ReportCard {
  scenarioId: GameState['scenarioId'];
  scenarioName: string;
  year: number;
  verdict: 'complete' | 'failed' | 'in-progress';
  objectives: ObjectiveResult[];
  goalMet: boolean;
  bonusMet: boolean;
  residentsGood: boolean;
  stars: 0 | 1 | 2 | 3;
  /** Stars lost to sending legacy sites to landfill. */
  landfillPenalty: 0 | 1;
  starNotes: string[];
  residents: ResidentEnding[];
  census: CensusEntry[];
  speciesBack: number;
  speciesLost: number;
  emissions: {
    startYear: number;
    peakYear: number;
    peakKt: number;
    finalKt: number;
    reductionPct: number;
    cumulativeKt: number;
    bySector: EmissionsBySource;
    timeline: TimelinePoint[];
  };
  climate: { tempC: number; co2: number; realTempC: number; committedTempC: number };
  topDecisions: DecisionNote[];
  circular: { legacyTotal: number; repurposed: number; recycled: number; landfilled: number; remaining: number; pct: number; research: string[] };
  country: { partnership: number; consultedSites: number; comanagedTiles: number; burns: number; unlocks: string[] };
  satellites: { overlays: string[]; warnings: number; mitigations: number; coralSavedPct: number };
  moodByYear: { year: number; mean: number }[];
  reflections: string[];
  letterPrompt: string;
  epilogue: string;
  /** How much land the town took per person, against a compact town (null when no one lives here). */
  footprint: Footprint | null;
}

export interface Footprint {
  land: LandPerPerson;
  /** Grade for the report card: A as compact as medium-density homes, then B, C, D as the homes spread out. */
  grade: 'A' | 'B' | 'C' | 'D';
  /** Plain-words line for the report card and the print page. */
  line: string;
}

/** The town's footprint line: land under homes and cleared land per person, against a town of medium-density homes. */
export function footprintOf(s: GameState): Footprint | null {
  const land = landPerPerson(s);
  if (land.people <= 0 || land.homeTiles <= 0) return null;
  const r = land.ratio;
  const grade = r <= 1.4 ? 'A' : r <= 2.2 ? 'B' : r <= 3.5 ? 'C' : 'D';
  const fmt = (n: number): string => n.toLocaleString('en-AU');
  const how = r <= 1.4 ? 'about as compact as a town of townhouses'
    : r <= 2.2 ? `${r} times the land of a compact town`
      : `${r} times the land of a compact town, so more bush, more street and longer drives`;
  const line = `Homes covered ${fmt(land.homeM2)} m² for each person (a compact town of townhouses needs about ${fmt(land.compactHomeM2)} m²): ${how}. `
    + `The town has cleared ${fmt(land.clearedM2)} m² of land and built ${fmt(land.roadM)} m of road for each resident.`;
  return { land, grade, line };
}

const zero = (): EmissionsBySource => ({ power: 0, industry: 0, transport: 0, land: 0, waste: 0 });

function timeline(s: GameState): TimelinePoint[] {
  const pts: TimelinePoint[] = [];
  for (const h of s.history) if (h.year > (s.history[0]?.year ?? 0)) pts.push({ year: h.year, totalKt: Math.round(h.totalKt / 10) });
  for (const y of s.a2.yearly) pts.push({ year: y.year, totalKt: Math.round(y.totalKt * 10) / 10 });
  return pts;
}

function topDecisions(s: GameState, n: number): DecisionNote[] {
  const out: DecisionNote[] = s.dilemmas.decisions
    .map((d) => ({ year: d.year, title: d.title, choice: d.optionLabel, evidenceBacked: d.evidenceBacked, impact: d.impact }));
  const a = s.residents.actions;
  const add = (year: number, title: string, choice: string, impact: number): void => {
    out.push({ year, title, choice, evidenceBacked: false, impact });
  };
  const consulted = s.country.consulted.length;
  if (consulted > 0) add(s.country.log.find((l) => l.delta > 0)?.year ?? s.year, 'Asking before building', `Talked with the community about ${consulted} significant place${consulted > 1 ? 's' : ''}`, 6 + consulted * 2);
  if (s.country.comanaged.length > 0) add(s.year, 'Returning care of bush', `Co-managed ${s.country.comanaged.length} tiles of bush with the community`, 8);
  const rep = (a['repurposed.steelworks'] ?? 0) + (a['repurposed.coalpower'] ?? 0) + (a['repurposed.port'] ?? 0);
  if (rep > 0) add(s.circular.unlockedYear ?? s.year, 'Giving old sites new lives', `Repurposed ${rep} major industrial site${rep > 1 ? 's' : ''}`, 10 + rep);
  if (s.satellites.mitigations > 0) add(s.year, 'Acting on a satellite warning', `Cut runoff ${s.satellites.mitigations} time${s.satellites.mitigations > 1 ? 's' : ''} before marine heatwaves arrived`, 7);
  const funded = projectsFunded(s);
  if (funded > 0) {
    const spent = typeof s.flags['proj.spent'] === 'number' ? s.flags['proj.spent'] : 0;
    const kt = typeof s.flags['proj.avoidedKt'] === 'number' ? s.flags['proj.avoidedKt'] : 0;
    add(s.year, 'Community projects', `Funded ${funded} round${funded > 1 ? 's' : ''} of community projects ($${Math.round(spent)}k)${kt > 0 ? `, helping neighbours avoid ${kt} kt of CO2` : ''}`, 5 + funded);
  }
  const landfilled = s.circular.items.filter((i) => i.status === 'landfilled').length;
  if (landfilled > 0) add(s.year, 'Taking the landfill shortcut', `${landfilled} old site${landfilled > 1 ? 's' : ''} went to landfill`, 8 + landfilled);
  return out.sort((x, y) => y.impact - x.impact || x.year - y.year).slice(0, n);
}

function pickReflections(s: GameState, kind: 'success' | 'struggle' | 'failed'): string[] {
  const pool = REFLECTIONS.filter((r) => r.when === 'any' || r.when === kind);
  const out: string[] = [];
  const used = new Set<number>();
  // Always lead with a prompt for this kind of ending, then one from the general pool.
  const lead = pool.filter((r) => r.when === kind);
  const rest = pool.filter((r) => r.when === 'any');
  const first = (lead.length > 0 ? lead : rest)[hash32(s.seed, s.year, 61) % (lead.length > 0 ? lead.length : rest.length)];
  if (first) out.push(first.text);
  for (let k = 0; out.length < 2 && k < 20; k++) {
    const i = hash32(s.seed, s.year, 62 + k) % rest.length;
    const r = rest[i];
    if (r && !used.has(i) && r.text !== out[0]) { used.add(i); out.push(r.text); }
  }
  return out;
}

export function buildReportCard(s: GameState): ReportCard {
  const sc = getScenario(s.scenarioId);
  const objectives = objectiveStatus(s);
  const finished = s.phase === 'epilogue';
  const verdict: ReportCard['verdict'] = s.phase === 'failed' ? 'failed' : finished ? 'complete' : 'in-progress';
  const required = objectives.filter((o) => !o.bonus);
  const bonus = objectives.filter((o) => o.bonus);
  const goalMet = finished && required.length > 0 && required.every((o) => o.status === 'met');
  const bonusMet = goalMet && bonus.length > 0 && bonus.every((o) => o.status === 'met');
  const residents = resolveEndings(s);
  const residentsGood = residents.length > 0 && residents.every((r) => r.quality === 'good');
  const c = counts(s);
  const penalty: 0 | 1 = c.landfilled > 0 ? 1 : 0;
  let stars = goalMet ? 1 : 0;
  if (bonusMet) stars = 2;
  if (bonusMet && residentsGood) stars = 3;
  const lost = Math.min(penalty, stars);
  stars -= lost;
  const starNotes: string[] = [];
  if (goalMet) starNotes.push('Goal met: every required objective reached.');
  if (bonusMet) starNotes.push('Bonus met: the wildlife bonus is achieved.');
  if (bonusMet && residentsGood) starNotes.push('Every resident\'s story ended well.');
  if (goalMet && !bonusMet) starNotes.push('The wildlife bonus was not reached.');
  if (bonusMet && !residentsGood) {
    const bad = residents.filter((r) => r.quality !== 'good').map((r) => r.name);
    starNotes.push(`Not every story ended well: ${bad.join(', ')}.`);
  }
  if (penalty > 0) starNotes.push(`Sending ${c.landfilled} old site${c.landfilled > 1 ? 's' : ''} to landfill cost a star.`);

  const cen = census(s);
  const em = timeline(s);
  let peak = { year: sc.startYear, kt: 0 };
  for (const p of em) if (p.totalKt > peak.kt) peak = { year: p.year, kt: p.totalKt };
  const last = s.a2.yearly[s.a2.yearly.length - 1];
  const finalKt = last ? last.totalKt : (em[em.length - 1]?.totalKt ?? 0);
  const sector = zero();
  if (last) for (const k of EMISSION_CATEGORIES) sector[k] = Math.round((last.emissionsKt[k] ?? 0) * 10) / 10;
  const kind = verdict === 'failed' ? 'failed' : stars >= 2 ? 'success' : 'struggle';
  const epilogue = verdict === 'in-progress'
    ? EPILOGUE.inProgress
    : verdict === 'failed'
      ? EPILOGUE.failed(s.year, s.a2.failure?.text ?? '')
      : stars === 3 ? EPILOGUE.three(s.year)
        : stars === 2 ? EPILOGUE.two(s.year)
          : stars === 1 ? EPILOGUE.one(s.year) : EPILOGUE.none(s.year);
  const unlocks: string[] = [];
  if (s.country.unlocked.dualNames) unlocks.push('dual place names');
  if (s.country.unlocked.culturalBurning) unlocks.push('cultural burning');
  if (s.country.unlocked.fishing) unlocks.push('seasonal fishing protocols');
  return {
    scenarioId: s.scenarioId,
    scenarioName: sc.name,
    year: s.year,
    verdict,
    objectives,
    goalMet,
    bonusMet,
    residentsGood,
    stars: stars as 0 | 1 | 2 | 3,
    landfillPenalty: lost as 0 | 1,
    starNotes,
    residents,
    census: cen,
    speciesBack: cen.filter((x) => x.pop > 0 && x.start === 0).length,
    speciesLost: cen.filter((x) => x.pop === 0 && x.start > 0).length,
    emissions: {
      startYear: em[0]?.year ?? sc.startYear,
      peakYear: peak.year,
      peakKt: peak.kt,
      finalKt,
      reductionPct: peak.kt > 0 ? Math.round(((peak.kt - finalKt) / peak.kt) * 100) : 0,
      cumulativeKt: Math.round(s.cumulativeKt),
      bySector: sector,
      timeline: em,
    },
    climate: { tempC: Math.round(s.tempC * 100) / 100, co2: Math.round(s.co2), realTempC: Math.round(realTemp(s.year) * 100) / 100, committedTempC: Math.round(s.a2.eqTempC * 100) / 100 },
    topDecisions: topDecisions(s, 5),
    circular: {
      legacyTotal: s.circular.items.length,
      repurposed: c.repurposed,
      recycled: c.recycled,
      landfilled: c.landfilled,
      remaining: c.standing + c.rubble,
      pct: legacyPercent(s),
      research: s.circular.research.map((id) => RESEARCH_BY_ID[id]?.name ?? id),
    },
    country: {
      partnership: Math.round(s.country.partnership),
      consultedSites: s.country.consulted.length,
      comanagedTiles: s.country.comanaged.length,
      burns: s.country.burns.length,
      unlocks,
    },
    satellites: {
      overlays: Object.keys(s.satellites.overlays).filter((k) => s.satellites.overlays[k as keyof typeof s.satellites.overlays]),
      warnings: s.satellites.warningsGiven,
      mitigations: s.satellites.mitigations,
      coralSavedPct: s.satellites.savedPct,
    },
    moodByYear: s.residents.history.slice(),
    reflections: pickReflections(s, kind),
    letterPrompt: LETTER_PROMPT,
    epilogue,
    footprint: footprintOf(s),
  };
}
