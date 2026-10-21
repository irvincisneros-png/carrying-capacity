import { describe, expect, it } from 'vitest';
import {
  applyCapacityToMap, CAP, capacityReport, capCSV, capSummary, capStocks, cloneState, createGame, deserialize, serialize, stepCapacity, TileKind, toCSV,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { coalIdle, coalThoughtful } from './helpers/fullplay';
import { cityIdle, cityThoughtful } from './helpers/city';
import { redIdle, redThoughtful } from './helpers/outback';
import { reefIdle, reefThoughtful } from './helpers/reef';
import { riverIdle, riverThoughtful } from './helpers/river';
import { followTutorial, valleyIdle } from './helpers/valley';

/**
 * The carrying capacity meter (WP8a): use against renewal for water, food, fish and timber, energy and CO2 and waste.
 * Calibrated on the scripted players (ratios x100; the line is 100, energy is judged over 125). Recorded 2026-10-21:
 *   Peak overshoot in Act 1 and where the thoughtful player ends in Act 2 (water / food / harvest / energy / carbon):
 *   Green Valley follow   end  28  47  50 101   7      idle  end  83  91 179 300  90 (fish and soil stocks fall to 40 and 54)
 *   Coal Coast thoughtful peak 83  66  83 300 241  end  51  66  59  91  28    idle  end 174  68 199 300 276 (all stocks 40)
 *   River Town thoughtful peak 89  40  31 300  41  end  64  40  26  93  34    idle  end 180  58 291 300 141
 *   Reef Island thoughtful peak 88  76  88 300  63  end  68  75  53  98  22   idle  end 149  45  84 300 121
 *   Red Dirt thoughtful peak 112  86 180 300 242  end  72  85 (<100) 95  11  idle  end 229  85 300 300 300
 *   Net Zero City thoughtful end (water, food, harvest come from outside the map) energy 107, carbon 50; idle carbon 300.
 * The thoughtful players do not set out to manage the meter, so these are what a careful town ends up with. They finish
 * under the line; the idle towns finish over it on at least two lines and run the stocks down to the floor.
 */
const over = (s: GameState): number => capacityReport(s).over;
const line = (s: GameState, id: string): number => capacityReport(s).lines.find((l) => l.id === id)?.ratio ?? NaN;
const peak = (s: GameState, i: number): number => Math.max(...[...s.history, ...s.a2.yearly].map((r) => r.cap?.[i] ?? 0));

describe('capacityReport', () => {
  it('is pure and deterministic', () => {
    const s = createGame('coal-coast');
    const before = serialize(s);
    const a = capacityReport(s);
    const b = capacityReport(s);
    expect(b).toEqual(a);
    expect(serialize(s)).toBe(before);
  });

  it('has five lines in a fixed order, and a fresh town is well under the line', () => {
    const rep = capacityReport(createGame('green-valley'));
    expect(rep.lines.map((l) => l.id)).toEqual(['water', 'food', 'harvest', 'energy', 'carbon']);
    expect(rep.over).toBe(0);
    for (const l of rep.lines) { expect(l.ratio).toBeLessThan(0.5); expect(l.note.length).toBeGreaterThan(20); expect(l.parts.length).toBeGreaterThan(20); }
  });

  it('goes over the line when people outnumber what the land can supply, and names the biggest cause', () => {
    const s = cloneState(createGame('green-valley'));
    s.population = 6000;
    const w = capacityReport(s).lines.find((l) => l.id === 'water')!;
    expect(w.status).toBe('over');
    expect(w.ratio).toBeGreaterThan(1);
    expect(w.note).toMatch(/Biggest user/);
    expect(capacityReport(s).status).toBe('over');
  });

  it('counts a city\'s water and food as coming from outside the map, so they never count as its own overshoot', () => {
    const city = capacityReport(createGame('net-zero-city'));
    for (const id of ['water', 'food', 'harvest']) expect(city.lines.find((l) => l.id === id)?.external).toBe(true);
    expect(city.worst.external).toBeUndefined();
  });

  it('summarises the ratios (x100) for the history records and the CSV export', () => {
    const s = createGame('coal-coast');
    expect(s.history[0]?.cap).toEqual(capSummary(s));
    // The graphs panel's CSV export appends this table below its own data; toCSV itself is unchanged.
    const csv = capCSV(s);
    expect(toCSV(s)).not.toContain('Land limits');
    expect(csv).toMatch(/Land limits[^\n]*\nyear,water_pct,food_pct,harvest_pct,energy_pct,carbon_pct\n1850,/);
  });
});

describe('stocks: overshoot runs them down a little at a time, and they recover under the line', () => {
  const crowded = (): GameState => { const s = cloneState(createGame('green-valley')); s.population = 6000; return s; };

  it('falls by no more than fallMax a year and stops at the floor', () => {
    const s = crowded();
    let prev = capStocks(s).flow;
    for (let y = 0; y < 60; y++) {
      stepCapacity(s);
      const now = capStocks(s).flow;
      expect(prev - now).toBeLessThanOrEqual(CAP.fallMax + 1e-9);
      expect(now).toBeGreaterThanOrEqual(CAP.floor);
      prev = now;
    }
    expect(prev).toBe(CAP.floor);
  });

  it('recovers about recover a year once the town is back under the line, and never above 100', () => {
    const s = crowded();
    for (let y = 0; y < 30; y++) stepCapacity(s);
    expect(capStocks(s).flow).toBe(CAP.floor);
    s.population = 0;
    stepCapacity(s);
    expect(capStocks(s).flow).toBeCloseTo(CAP.floor + CAP.recover, 5);
    for (let y = 0; y < 80; y++) stepCapacity(s);
    expect(capStocks(s)).toEqual({ flow: 100, fish: 100, soil: 100 });
  });

  it('a lower stock lowers what the line renews (a thin creek supplies less)', () => {
    const s = crowded();
    const full = capacityReport(s).lines.find((l) => l.id === 'water')!.renew;
    s.flags['cc.flow'] = CAP.floor;
    expect(capacityReport(s).lines.find((l) => l.id === 'water')!.renew).toBeLessThan(full);
  });

  it('adds dirt to the creek only while the flow is low, and a little at a time', () => {
    const s = cloneState(createGame('green-valley'));
    const river = (): number => { let t = 0, n = 0; for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.River) { t += s.grid.waterPollution[i] ?? 0; n++; } return t / n; };
    const base = river();
    applyCapacityToMap(s, 10);
    expect(river()).toBe(base);
    s.flags['cc.flow'] = CAP.floor;
    applyCapacityToMap(s, 10);
    const added = river() - base;
    expect(added).toBeGreaterThan(0);
    expect(added).toBeLessThan(0.1);
  });

  it('old saves (no stocks) load with every stock full, and the stocks survive a save', () => {
    const s = cloneState(createGame('coal-coast'));
    delete s.flags['cc.flow'];
    const back = deserialize(serialize(s)) as GameState;
    expect(capStocks(back)).toEqual({ flow: 100, fish: 100, soil: 100 });
    s.flags['cc.fish'] = 63.5;
    expect(capStocks(deserialize(serialize(s)) as GameState).fish).toBe(63.5);
  });
});

describe('the scripted players', () => {
  const valley = followTutorial().end;
  const valleyBad = valleyIdle();
  const coal = coalThoughtful(), coalBad = coalIdle();
  const river = riverThoughtful(), riverBad = riverIdle();
  const reef = reefThoughtful(), reefBad = reefIdle();
  const red = redThoughtful(), redBad = redIdle();
  const city = cityThoughtful(), cityBad = cityIdle();

  it('a thoughtful player finishes under the line on every line (Act 2 is about getting back under it)', () => {
    for (const [name, s] of [['valley', valley], ['coal', coal.end], ['river', river.end], ['reef', reef.end], ['red', red.end], ['city', city]] as const) {
      expect(over(s), `${name} ends with ${over(s)} lines over: ${capacityReport(s).lines.map((l) => `${l.id} ${Math.round(l.ratio * 100)}`).join(', ')}`).toBe(0);
    }
  });

  it('an idle player ends over the line on at least two lines, with stocks run down in the towns that have a creek', () => {
    for (const [name, s] of [['valley', valleyBad], ['coal', coalBad.end], ['river', riverBad.end], ['reef', reefBad.end], ['red', redBad.end], ['city', cityBad]] as const) {
      expect(over(s), name).toBeGreaterThanOrEqual(2);
    }
    for (const s of [coalBad.end, riverBad.end, redBad.end]) expect(capStocks(s).flow).toBeLessThan(60);
    expect(capStocks(valleyBad).fish).toBeLessThan(60);
  });

  it('overshoot is a real stretch of Act 1: a coal town runs over on CO2 and energy at the height of the boom, then comes back under', () => {
    expect(peak(coal.end, 4)).toBeGreaterThan(130);
    expect(peak(coal.end, 3)).toBeGreaterThan(125);
    expect(line(coal.end, 'carbon')).toBeLessThan(1);
    expect(line(coal.end, 'energy')).toBeLessThanOrEqual(1.25);
    expect(peak(red.end, 4)).toBeGreaterThan(130);
    expect(peak(valley, 4)).toBeGreaterThan(100);
  });

  it('a thoughtful town never has a stock fall below 60, and the idle town is always worse than the thoughtful one', () => {
    for (const s of [coal.end, river.end, reef.end, valley]) expect(Math.min(...Object.values(capStocks(s)))).toBeGreaterThanOrEqual(60);
    expect(line(coalBad.end, 'carbon')).toBeGreaterThan(line(coal.end, 'carbon'));
    expect(line(riverBad.end, 'water')).toBeGreaterThan(line(river.end, 'water'));
    expect(line(redBad.end, 'water')).toBeGreaterThan(line(red.end, 'water'));
    expect(line(reefBad.end, 'water')).toBeGreaterThan(line(reef.end, 'water'));
  });
});
