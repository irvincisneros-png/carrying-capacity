import type { CountryOverride } from '../country';
import type { ScenarioId } from '../../sim/types';
import { NET_ZERO_CITY_COUNTRY } from './net-zero-city';
import { RED_DIRT_COUNTRY } from './red-dirt';
import { REEF_ISLAND_COUNTRY } from './reef-island';
import { RIVER_TOWN_COUNTRY } from './river-town';

/** Scenario-specific Country text. Scenarios not listed use the neutral base text in content/country.ts. Country is only active where the cast has an Elder (sim/country.ts countryActive), so no other scenario's cultural geography is shown elsewhere. */
export const COUNTRY_BY_SCENARIO: Readonly<Partial<Record<ScenarioId, CountryOverride>>> = {
  'river-town': RIVER_TOWN_COUNTRY,
  'reef-island': REEF_ISLAND_COUNTRY,
  'red-dirt': RED_DIRT_COUNTRY,
  'net-zero-city': NET_ZERO_CITY_COUNTRY,
};
