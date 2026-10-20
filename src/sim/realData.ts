/**
 * Historical record used as the "real world" overlay.
 * Approximate decadal averages. CO2: Law Dome ice core to 1958, Mauna Loa afterwards (NOAA / CSIRO).
 * Temperature anomaly vs 1850-1900: HadCRUT5 / NASA GISTEMP (approximate).
 */

export const REAL_YEARS: readonly number[] = [
  1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000,
  2010, 2020,
];

export const REAL_CO2_PPM: readonly number[] = [
  285, 286, 288, 291, 294, 296, 300, 303, 307, 311, 311, 317, 326, 339, 354, 369, 390, 413,
];

export const REAL_TEMP_C: readonly number[] = [
  0.0, 0.0, 0.0, -0.05, -0.1, 0.0, -0.15, 0.0, 0.1, 0.25, 0.1, 0.15, 0.2, 0.35, 0.55, 0.75, 0.95,
  1.2,
];

export const PRE_INDUSTRIAL_CO2 = 280;

function interp(table: readonly number[], year: number, tailSlopePerYear: number): number {
  const first = REAL_YEARS[0] ?? 1850;
  const last = REAL_YEARS[REAL_YEARS.length - 1] ?? 2020;
  if (year <= first) return table[0] ?? 0;
  if (year >= last) return (table[table.length - 1] ?? 0) + (year - last) * tailSlopePerYear;
  const i = Math.floor((year - first) / 10);
  const y0 = REAL_YEARS[i] ?? first;
  const v0 = table[i] ?? 0;
  const v1 = table[i + 1] ?? v0;
  return v0 + ((v1 - v0) * (year - y0)) / 10;
}

/** Real CO2 (ppm). Linear between decades; extrapolated at ~2.4 ppm/yr after 2020. */
export function realCO2(year: number): number {
  return interp(REAL_CO2_PPM, year, 2.4);
}

/** Real temperature anomaly (C). Extrapolated at 0.02 C/yr after 2020. */
export function realTemp(year: number): number {
  return interp(REAL_TEMP_C, year, 0.02);
}
