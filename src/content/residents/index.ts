import type { ResidentDef } from '../../sim/residents';
import type { ScenarioId } from '../../sim/types';
import { COAL_COAST_CAST } from './coal-coast';

export const CAST: Readonly<Partial<Record<ScenarioId, readonly ResidentDef[]>>> = {
  'coal-coast': COAL_COAST_CAST,
};
