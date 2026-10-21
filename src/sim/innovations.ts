/**
 * Act 1 innovation timeline scheduler (Round 6 WP9). At each decade turn it puts the next historical environmental
 * innovations on the table as dilemma cards (content/innovations.ts), earliest and highest priority first, within a
 * per-scenario cap so Green Valley stays a short tutorial. An innovation nobody answers by the next turn lapses quietly
 * (no Society penalty): it is a chance, not a duty. Deterministic: no random draws.
 */
import { DEFAULT_INNOVATION_LIMITS, INNOVATION_CARDS, INNOVATION_LIMITS } from '../content/innovations';
import { DATACENTRE_CARDS } from '../content/dilemmas/datacentre';
import { fire, isInnovation, PENDING_EXPIRY_YEARS } from './dilemmas';
import { hash32 } from './season';
import { getScenario } from './scenarios';
import { emitStory } from './story';
import type { GameState } from './types';

export const innovationCards = INNOVATION_CARDS;

/** How many innovation cards have been put on the table so far (answered, lapsed or waiting). */
export function innovationsOffered(s: GameState): number {
  return Object.keys(s.dilemmas.offered).filter(isInnovation).length;
}

/** Innovations the player adopted (any option other than the last, "do nothing" one). */
export function innovationsAdopted(s: GameState): string[] {
  const out: string[] = [];
  for (const d of s.dilemmas.decisions) {
    if (!isInnovation(d.dilemmaId) || d.optionId === 'ignored') continue;
    const card = INNOVATION_CARDS.find((c) => c.id === d.dilemmaId);
    if (card && card.options[card.options.length - 1]?.id !== d.optionId) out.push(d.dilemmaId);
  }
  return out;
}

export function offerInnovations(s: GameState): void {
  if (s.phase !== 'act1' || !getScenario(s.scenarioId).act1) return;
  // Unanswered cards from earlier turns lapse without a penalty.
  s.dilemmas.pending = s.dilemmas.pending.filter((id) => !isInnovation(id) || (s.dilemmas.offered[id] ?? s.year) >= s.year);
  // The ozone layer note: a success story, shown one decade after the CFC phase-out was chosen.
  if (s.flags['innov.ozone'] === 1 && s.flags['innov.ozoneNote'] === undefined && s.dilemmas.offered['inn-ozone'] !== undefined && s.year > (s.dilemmas.offered['inn-ozone'] ?? 0)) {
    s.flags['innov.ozoneNote'] = 1;
    emitStory(s, 'Ozone news: the hole over Antarctica has stopped growing. Because countries phased out CFCs together, scientists expect the ozone layer to recover by about the 2060s. This is one of the few times the whole world fixed an environmental problem.', {
      channel: 'town', tone: 'joy',
    }, 0.6);
  }
  const lim = INNOVATION_LIMITS[s.scenarioId] ?? DEFAULT_INNOVATION_LIMITS;
  const room = Math.min(lim.perTurn, lim.cap - innovationsOffered(s));
  if (room <= 0) return;
  const picks = INNOVATION_CARDS
    .filter((d) => (!lim.only || lim.only.includes(d.id)) && s.dilemmas.offered[d.id] === undefined && s.year >= d.years[0] && s.year <= d.years[1])
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, room);
  for (const d of picks) fire(s, d);
}

/** Year the tech company makes its offer: 2035 plus 0 to 7 years, fixed by the game's seed. */
export function dataCentreOfferYear(s: GameState): number {
  return 2035 + (hash32(s.seed, 2035, 77) % 8);
}

/**
 * Act 2, each year end: the data-centre offer (content/dilemmas/datacentre.ts) arrives once, on top of the regular cards
 * and outside their per-decade count. If nobody answers it within five years the company takes its offer elsewhere,
 * with no penalty.
 */
export function offerDataCentre(s: GameState): void {
  if (s.phase !== 'act2') return;
  const card = DATACENTRE_CARDS[s.scenarioId];
  if (!card) return;
  const at = s.dilemmas.offered[card.id];
  if (at !== undefined) {
    if (s.dilemmas.pending.includes(card.id) && s.year - at >= PENDING_EXPIRY_YEARS) {
      s.dilemmas.pending = s.dilemmas.pending.filter((id) => id !== card.id);
    }
    return;
  }
  if (s.year >= dataCentreOfferYear(s) && s.year <= card.years[1]) fire(s, card);
}
