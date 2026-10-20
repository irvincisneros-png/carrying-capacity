import type { ResidentDef } from '../../sim/residents';
import type { ScenarioId } from '../../sim/types';
import { COAL_COAST_CAST } from './coal-coast';
import { GREEN_VALLEY_CAST } from './green-valley';
import { NET_ZERO_CITY_CAST } from './net-zero-city';
import { RED_DIRT_CAST } from './red-dirt';
import { REEF_ISLAND_CAST } from './reef-island';
import { RIVER_TOWN_CAST } from './river-town';

export const CAST: Readonly<Partial<Record<ScenarioId, readonly ResidentDef[]>>> = {
  'coal-coast': COAL_COAST_CAST,
  'green-valley': GREEN_VALLEY_CAST,
  'river-town': RIVER_TOWN_CAST,
  'reef-island': REEF_ISLAND_CAST,
  'red-dirt': RED_DIRT_CAST,
  'net-zero-city': NET_ZERO_CITY_CAST,
};
