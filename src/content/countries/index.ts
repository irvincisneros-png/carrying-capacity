import type { CountryOverride } from '../country';
import type { ScenarioId } from '../../sim/types';

/** Scenario-specific Country text. Scenarios not listed use the Coal Coast text in content/country.ts. */
export const COUNTRY_BY_SCENARIO: Readonly<Partial<Record<ScenarioId, CountryOverride>>> = {};
