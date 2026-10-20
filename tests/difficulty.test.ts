import { describe, expect, it } from 'vitest';
import { buildReportCard } from '../src/sim';
import type { GameState } from '../src/sim';
import { CITY_BOT, cityThoughtful } from './helpers/city';
import { RED_BOT, redThoughtful } from './helpers/outback';
import { REEF_BOT, reefThoughtful } from './helpers/reef';
import { RIVER_BOT, riverThoughtful } from './helpers/river';

/**
 * Difficulty ordering, measured by how sloppy a careful player can afford to be.
 * Six versions of the same thoughtful plan are played in each scenario: full effort, 60% and 30% of the usual building,
 * each started on time and four years late (while the first storms, bleaching and heatwaves are already arriving).
 * The share of those versions that still earns a star is the scenario's forgiveness:
 *   Coal Coast (easy) is the most forgiving (tests/act2-playthrough: acting 20 years late already misses the warming goal),
 *   River Town (medium) forgives some sloppiness, Reef Island and Red Dirt (hard) very little,
 *   Net Zero City (expert) the least.
 */
interface Bot { scale: number; startDelay: number }
const VARIANTS: [number, number][] = [[1, 0], [1, 4], [0.6, 0], [0.6, 4], [0.3, 0], [0.3, 4]];

function forgiveness(bot: Bot, play: () => GameState): { passes: number; stars: number[] } {
  const stars: number[] = [];
  try {
    for (const [scale, delay] of VARIANTS) {
      bot.scale = scale;
      bot.startDelay = delay;
      stars.push(buildReportCard(play()).stars);
    }
  } finally {
    bot.scale = 1;
    bot.startDelay = 0;
  }
  return { passes: stars.filter((n) => n >= 1).length, stars };
}

describe('the order of difficulty', () => {
  const river = forgiveness(RIVER_BOT, () => riverThoughtful().end);
  const reef = forgiveness(REEF_BOT, () => reefThoughtful().end);
  const red = forgiveness(RED_BOT, () => redThoughtful().end);
  const city = forgiveness(CITY_BOT, () => cityThoughtful());

  it('every scenario is winnable at full effort and on time', () => {
    for (const r of [river, reef, red, city]) expect(r.stars[0]).toBeGreaterThanOrEqual(1);
  });
  it('River Town (medium) forgives sloppiness: most versions of the plan still earn a star', () => {
    expect(river.passes).toBeGreaterThanOrEqual(3);
  });
  it('the hard scenarios (Reef Island, Red Dirt) punish a late or half-hearted plan', () => {
    expect(reef.passes).toBeLessThan(river.passes);
    expect(red.passes).toBeLessThan(river.passes);
    expect(reef.passes).toBeLessThanOrEqual(3);
    expect(red.passes).toBeLessThanOrEqual(3);
    // Four years late is already too late in both: the first storm or heatwave takes a home, or the pit stays open too long.
    expect(reef.stars[1]).toBe(0);
    expect(red.stars[1]).toBe(0);
  });
  it('Net Zero City (expert) is no more forgiving than the hard scenarios', () => {
    expect(city.passes).toBeLessThan(river.passes);
    expect(city.passes).toBeLessThanOrEqual(Math.min(reef.passes, red.passes));
    expect(city.stars.slice(4)).toEqual([0, 0]);
  });
});
