import { describe, expect, it } from 'vitest';
import {
  climateAt, co2For, emissionsMultiplier, M_MAX, M_MIN, REAL_CO2_PPM, REAL_TEMP_C, REAL_YEARS,
  realCO2, realTemp, reefHealth, referenceCumulative, REFERENCE_DECADE_KT, tempFor,
} from '../src/sim';

describe('real data', () => {
  it('has matching table lengths and the spec anchor values', () => {
    expect(REAL_YEARS).toHaveLength(18);
    expect(REAL_CO2_PPM).toHaveLength(18);
    expect(REAL_TEMP_C).toHaveLength(18);
    expect(realCO2(1850)).toBe(285);
    expect(realCO2(2020)).toBe(413);
    expect(realTemp(1940)).toBe(0.25);
    expect(realTemp(2020)).toBe(1.2);
  });
  it('interpolates between decades and extrapolates after 2020', () => {
    expect(realCO2(1855)).toBeCloseTo(285.5, 5);
    expect(realCO2(2030)).toBeGreaterThan(413);
  });
});

describe('climate model', () => {
  it('m = 1 reproduces real CO2 every decade', () => {
    REAL_YEARS.forEach((y, i) => expect(co2For(y, 1)).toBeCloseTo(REAL_CO2_PPM[i] ?? 0, 9));
  });
  it('maps 413 ppm to about 1.0 C', () => {
    expect(tempFor(413)).toBeGreaterThan(0.95);
    expect(tempFor(413)).toBeLessThan(1.05);
    expect(tempFor(280)).toBeCloseTo(0, 9);
    expect(tempFor(560)).toBeCloseTo(1.8, 9);
  });
  it('applies the scenario sensitivity multiplier to temperature only', () => {
    expect(tempFor(413, 1.2)).toBeCloseTo(tempFor(413) * 1.2, 9);
  });
  it('clamps m to [0.4, 1.6] and handles 1850 (both ~0)', () => {
    expect(emissionsMultiplier(0, 0)).toBe(1);
    expect(emissionsMultiplier(1, 1000)).toBe(M_MIN);
    expect(emissionsMultiplier(5000, 1000)).toBe(M_MAX);
    expect(emissionsMultiplier(900, 1000)).toBeCloseTo(0.9, 9);
    expect(emissionsMultiplier(10, 0)).toBe(M_MAX);
  });
  it('a player who matches the reference reproduces the real record', () => {
    for (const y of REAL_YEARS) {
      const c = climateAt(y, referenceCumulative(y));
      expect(c.co2).toBeCloseTo(realCO2(y), 6);
    }
  });
  it('more emissions give more CO2 and more warming', () => {
    const lo = climateAt(2000, referenceCumulative(2000) * 0.5);
    const hi = climateAt(2000, referenceCumulative(2000) * 1.5);
    expect(hi.co2).toBeGreaterThan(lo.co2);
    expect(hi.tempC).toBeGreaterThan(lo.tempC);
  });
  it('reference cumulative is monotonic, starts at 0 and covers every playable decade', () => {
    expect(referenceCumulative(1850)).toBe(0);
    expect(REFERENCE_DECADE_KT).toHaveLength(17);
    let prev = -1;
    for (const y of REAL_YEARS) {
      const c = referenceCumulative(y);
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
    expect(referenceCumulative(1855)).toBeGreaterThan(0);
  });
  it('reef health falls with temperature and water pollution, within 0..1', () => {
    expect(reefHealth(0, 0)).toBe(1);
    expect(reefHealth(1, 0)).toBeLessThan(reefHealth(0.5, 0));
    expect(reefHealth(0.5, 2)).toBeLessThan(reefHealth(0.5, 0));
    expect(reefHealth(10, 10)).toBe(0);
  });
});
