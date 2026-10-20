/** Heat health hooks: heatwave events hurt people, less so under trees, in cooling centres and with the lights on. */
import { getScenario } from '../scenarios';
import { emitStory } from '../story';
import type { GameState, SimEvent } from '../types';
import { addFlag, flag, setFlag } from './flags';
import { canopyShare, coolingCoverage, heatDeathsExpected, heatDeathsUnprotected } from './heatCore';

export function heatSeason(s: GameState, emitted: readonly SimEvent[]): void {
  if (!getScenario(s.scenarioId).act2.heat) return;
  for (const e of emitted) {
    if (e.type !== 'heatwave') continue;
    const blackout = s.a2.lastGrid?.blackout === true || emitted.some((x) => x.type === 'blackout');
    const expected = heatDeathsExpected(s, e.severity, blackout);
    // Without trees or centres the same heatwave would have been this bad.
    const bare = heatDeathsUnprotected(s, e.severity, blackout);
    const carry = flag(s, 'h.carry');
    const total = expected + carry;
    const deaths = Math.floor(total);
    setFlag(s, 'h.carry', total - deaths);
    const avoided = Math.max(0, Math.floor(Math.max(bare, expected) - expected));
    addFlag(s, 'h.deaths', deaths);
    addFlag(s, 'h.avoided', avoided);
    setFlag(s, 'h.last', deaths);
    s.a2.stress += deaths * 1.2;
    const canopy = Math.round(canopyShare(s) * 100);
    const cool = Math.round(coolingCoverage(s) * 100);
    if (deaths > 0) {
      emitStory(s, `Heat illness: ${deaths} ${deaths === 1 ? 'person' : 'people'} died in the heatwave, most of them older people living alone. Tree canopy is ${canopy}% and cooling centres cover ${cool}% of the town.`, {
        channel: 'town', tone: 'loss',
      }, 0.8);
    } else if (avoided >= 1) {
      emitStory(s, `Nobody died in the heatwave. Shade trees and cooling centres (canopy ${canopy}%, centres cover ${cool}%) are thought to have saved about ${avoided} ${avoided === 1 ? 'life' : 'lives'}.`, {
        channel: 'town', tone: 'joy',
      }, 0.5);
    }
  }
}
