/**
 * Multi-seed balance runs. The map is always the scenario's own (the one players get); only the weather and event
 * seed changes, so the same plan meets different droughts, floods, heatwaves and outbreaks.
 */
import { createGame } from '../../src/sim';
import type { GameState, ScenarioId } from '../../src/sim';

/** The scenario's own seed first, then three others. */
export const EVENT_SEEDS: readonly (number | null)[] = [null, 11, 23, 47];

export function seededGame(id: ScenarioId, seed: number | null = null): GameState {
  const s = createGame(id);
  return seed === null ? s : { ...s, seed: seed >>> 0 };
}
