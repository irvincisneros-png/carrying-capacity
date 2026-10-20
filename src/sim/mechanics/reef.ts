/** Reef Island hooks: sea level baseline, crown-of-thorns damage over time, policy costs. */
import { stageFromHealth } from '../restoration';
import { TileKind } from '../types';
import type { GameState } from '../types';
import { cullLevel, seaLevelCm, tourismIncome } from './reefCore';
import { addFlag, flag, setFlag } from './flags';

export function reefBegin(s: GameState): void {
  setFlag(s, 'r.slr0', seaLevelCm(s));
  setFlag(s, 'r.cots', 0);
}

/** An active crown-of-thorns outbreak keeps eating coral for a few seasons unless divers cull it. */
export function reefSeason(s: GameState): void {
  const left = flag(s, 'r.cots');
  if (left <= 0) return;
  const g = s.grid;
  const loss = 0.025 * (1 - 0.45 * cullLevel(s));
  for (let i = 0; i < g.kind.length; i++) {
    if (g.kind[i] !== TileKind.Reef) continue;
    g.health[i] = Math.max(0, (g.health[i] ?? 0) * (1 - loss));
    g.stage[i] = stageFromHealth(g.health[i] ?? 0);
  }
  setFlag(s, 'r.cots', cullLevel(s) >= 2 ? Math.max(0, left - 2) : left - 1);
  addFlag(s, 'r.cotsSeasons', 1);
}

export function reefIncome(s: GameState): number {
  return tourismIncome(s);
}
