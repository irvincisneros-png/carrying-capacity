import type { DilemmaDef } from '../../sim/dilemmas';
import type { ScenarioId } from '../../sim/types';
import { COAL_COAST_DILEMMAS } from './coal-coast';

export const DILEMMAS: Readonly<Partial<Record<ScenarioId, readonly DilemmaDef[]>>> = {
  'coal-coast': COAL_COAST_DILEMMAS,
};
