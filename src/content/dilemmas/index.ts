import type { DilemmaDef } from '../../sim/dilemmas';
import type { ScenarioId } from '../../sim/types';
import { COAL_COAST_DILEMMAS } from './coal-coast';
import { GREEN_VALLEY_DILEMMAS } from './green-valley';
import { NET_ZERO_CITY_DILEMMAS } from './net-zero-city';
import { RED_DIRT_DILEMMAS } from './red-dirt';
import { REEF_ISLAND_DILEMMAS } from './reef-island';
import { RIVER_TOWN_DILEMMAS } from './river-town';

export const DILEMMAS: Readonly<Partial<Record<ScenarioId, readonly DilemmaDef[]>>> = {
  'coal-coast': COAL_COAST_DILEMMAS,
  'green-valley': GREEN_VALLEY_DILEMMAS,
  'river-town': RIVER_TOWN_DILEMMAS,
  'reef-island': REEF_ISLAND_DILEMMAS,
  'red-dirt': RED_DIRT_DILEMMAS,
  'net-zero-city': NET_ZERO_CITY_DILEMMAS,
};
