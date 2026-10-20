/**
 * Glue for the empathy-and-care layers. The Act 1 / Act 2 engine calls these at fixed points (decade turn, season,
 * year end, an action) so residents, dilemmas, wildlife, Country, the circular tier and satellites stay out of the
 * core loop. Everything here is deterministic and mutates only the (already cloned) state it is handed.
 */
import { castFor, checkBeats, initResidents, noteAction, reactToEvents, respond, societyShare, stepMoods } from './residents';
import { choose, dilemmaSociety, emptyDilemmas, offerAct1, offerAct2 } from './dilemmas';
import { emptyWildlife, initWildlife, noteHeat, wildlifeSummer, wildlifeYear } from './wildlife';
import { burn, comanage, consult, countryStep, countryYear, initCountry, notePlacement } from './country';
import { circularYear, dispose, emptyCircular, initCircular, onDemolished, onReplaced, research } from './circular';
import { emptySatellites, mitigate, subscribe } from './satellites';
import { meanMood } from './conditions';
import { mechBegin, mechPlaced, mechSeason, mechYear } from './mechanics';
import { applyPolicy, policyCostPerYear, rehabStep } from './scenarioActions';
import type { Action, ActionResult, GameState, PlacedBuilding, ScenarioId, SimEvent } from './types';

/** The fresh layer state for a new game. */
export function emptyLayers(scenarioId: ScenarioId): Pick<GameState, 'residents' | 'dilemmas' | 'wildlife' | 'country' | 'circular' | 'satellites'> {
  return {
    residents: initResidents(scenarioId),
    dilemmas: emptyDilemmas(),
    wildlife: emptyWildlife(),
    country: initCountry(),
    circular: emptyCircular(),
    satellites: emptySatellites(),
  };
}

/** Adds residents / species missing from a loaded state (content added since the save was made). */
export function reconcileLayers(s: GameState): void {
  for (const def of castFor(s.scenarioId)) {
    if (!s.residents.list[def.id]) s.residents.list[def.id] = { mood: def.start, trend: 0, lastBeatYear: -1 };
  }
}

// ---------------------------------------------------------------------------------------------------------
// Society feed
// ---------------------------------------------------------------------------------------------------------

/** Folds residents' moods and the dilemma choices into Society, without overwriting other writers of societyAdjust. */
function feedSociety(s: GameState): void {
  const target = societyShare(s) + dilemmaSociety(s);
  if (s.phase === 'act1' || s.phase === 'turning-point') {
    s.residents.nudge = Math.max(-6, Math.min(6, Math.round(target * 10) / 10));
    return;
  }
  s.a2.societyAdjust += target - s.residents.applied;
  s.residents.applied = target;
}

// ---------------------------------------------------------------------------------------------------------
// Act 1
// ---------------------------------------------------------------------------------------------------------

/** Decade turn, before the meters are recorded: moods follow the new metrics and nudge Society a little. */
export function layersDecadeMoods(s: GameState): void {
  stepMoods(s, 0.5);
  feedSociety(s);
}

/** Decade turn, after the act-complete check: beats and the occasional dilemma card. */
export function layersDecadeStory(s: GameState): SimEvent[] {
  const out = checkBeats(s);
  if (s.phase === 'act1') offerAct1(s);
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Act 2
// ---------------------------------------------------------------------------------------------------------

/** Called by startAct2 once the quiet fast-forward is done. */
export function beginAct2(s: GameState): void {
  s.residents.applied = 0;
  initCircular(s);
  initWildlife(s);
  mechBegin(s);
  countryYear(s);
  feedSociety(s);
  checkBeats(s);
}

/** One simulated Act 2 season (not run during the quiet fast-forward). */
export function layersSeason(s: GameState, emitted: readonly SimEvent[], seasonIndex: number): void {
  reactToEvents(s, emitted);
  for (const e of emitted) if (e.type === 'heatwave') noteHeat(s, e.severity);
  mechSeason(s, emitted, seasonIndex);
  countryStep(s, seasonIndex);
  if (s.a2.season === 0) wildlifeSummer(s);
  stepMoods(s, 0.1);
  feedSociety(s);
}

/** Year end, after the calendar and climate have moved on and before the meters are recorded. */
export function layersYearEnd(s: GameState): void {
  mechYear(s);
  const policyCost = policyCostPerYear(s);
  if (policyCost > 0) s.budget = Math.max(0, s.budget - policyCost);
  countryYear(s);
  wildlifeYear(s);
  circularYear(s);
  stepMoods(s, 0.05);
  feedSociety(s);
  s.residents.history.push({ year: s.year, mean: Math.round(meanMood(s) * 10) / 10 });
  if (s.residents.history.length > 140) s.residents.history.splice(0, s.residents.history.length - 140);
  checkBeats(s);
  offerAct2(s);
}

// ---------------------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------------------

/** After a successful 'place': counts the action, applies Country consequences, notes replaced legacy sites. */
export function onPlaced(s: GameState, b: PlacedBuilding, replaced: PlacedBuilding | undefined): void {
  noteAction(s, `built.${b.type}`);
  mechPlaced(s, b);
  notePlacement(s, b);
  if (replaced) onReplaced(s, replaced, b.type);
}

/** After a successful plain 'demolish'. */
export function onDemolishedBuilding(s: GameState, b: PlacedBuilding): void {
  noteAction(s, `demolished.${b.type}`);
  onDemolished(s, b);
}

export function applyLayerAction(
  state: GameState, action: Exclude<Action, { type: 'place' | 'demolish' | 'clear' }>,
): { state: GameState; result: ActionResult } {
  switch (action.type) {
    case 'respond': return respond(state, action.beatId, action.optionId);
    case 'choose': return choose(state, action.dilemmaId, action.optionId);
    case 'consult': return consult(state, action.x, action.y);
    case 'comanage': return comanage(state, action.x, action.y);
    case 'burn': return burn(state, action.x, action.y);
    case 'dispose': return dispose(state, action);
    case 'research': return research(state, action.id);
    case 'subscribe': return subscribe(state, action.overlay);
    case 'mitigate': return mitigate(state);
    case 'policy': return applyPolicy(state, action.id, action.value);
    case 'rehab': return rehabStep(state, action.x, action.y);
  }
}
