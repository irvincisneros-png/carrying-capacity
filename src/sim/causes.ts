/**
 * "Why did that happen?" (WP8c): which chain an event opens, and the player's own causes to show under each box.
 * Pure: reads the state, never changes it. The chains themselves live in content/causes.ts.
 */
import { CAUSE_CHAINS, LOSS_WORDS } from '../content/causes';
import type { CauseChain, ChainKey } from '../content/causes';
import { capacityReport } from './capacity';
import { landSnapshot } from './ledger';
import { mechMetric } from './mechanics';
import { estuaryHealth } from './metrics';
import { workingBuildings } from './roads';
import { getScenario } from './scenarios';
import { TileKind } from './types';
import type { GameState, SimEvent } from './types';

export type { CauseChain, ChainKey } from '../content/causes';
export { CAUSE_CHAINS } from '../content/causes';

/** The chain an event opens, or null where there is none (a plain story line). */
export function chainKeyFor(e: Pick<SimEvent, 'type' | 'text' | 'story'>): ChainKey | null {
  switch (e.type) {
    case 'fish-kill': return 'fish-kill';
    case 'algal-bloom': return 'algal-bloom';
    case 'flood': return 'flood';
    case 'storm-surge': return 'storm-surge';
    case 'marine-heatwave': return 'coral-bleaching';
    case 'crown-of-thorns': return 'crown-of-thorns';
    case 'drought': return 'drought';
    case 'heatwave': return 'heat-deaths';
    case 'bushfire': return 'bushfire';
    case 'blackout': return 'blackout';
    case 'story':
      if (e.story?.channel === 'wildlife' && (e.story.tone === 'loss' || LOSS_WORDS.test(e.text))) return 'species-loss';
      return null;
    default: return null;
  }
}

const n = (s: GameState, id: string): number => workingBuildings(s).filter((b) => b.type === id).length;
const plural = (k: number, one: string, many = `${one}s`): string => `${k} ${k === 1 ? one : many}`;

function bushLostPct(s: GameState): number {
  if (s.initialBushTiles <= 0) return 0;
  let bush = 0;
  for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.Bush) bush++;
  return Math.max(0, Math.round((1 - bush / s.initialBushTiles) * 100));
}

export type WaterBody = 'creek' | 'estuary' | 'river' | 'reef';

/**
 * Which water body an event or report line is about. Read from its text ("... in the estuary"); with no text, Act 1 is the
 * creek, and Act 2 is the estuary where the map has one (otherwise the river).
 */
export function waterBodyOf(s: GameState, text?: string): WaterBody {
  if (text) {
    if (/estuar/i.test(text)) return 'estuary';
    if (/reef|coral/i.test(text)) return 'reef';
    if (/river/i.test(text)) return 'river';
    if (/creek/i.test(text)) return 'creek';
  }
  if (s.phase === 'act1' || s.phase === 'turning-point') return 'creek';
  return s.grid.kind.includes(TileKind.Estuary) ? 'estuary' : 'river';
}

/**
 * Per-box lines about the player's own town (null where the sim knows nothing to say). Same length as the chain's boxes.
 * `about` is the event's text: it names the water body, so the lines never describe a different one than the event did.
 */
export function ownCauses(s: GameState, key: ChainKey, about?: string): (string | null)[] {
  const chain = CAUSE_CHAINS[key];
  const out: (string | null)[] = chain.boxes.map(() => null);
  const set = (i: number, text: string | null): void => { if (i < out.length) out[i] = text; };
  const land = landSnapshot(s);
  const farms = n(s, 'farm') + n(s, 'dripfarm');
  const outfalls = n(s, 'outfall'), plants = n(s, 'sewagetreatment'), wetlands = n(s, 'wetland');
  const runoff = Object.keys(s.flags).filter((k) => k.startsWith('runoff.') && Number(s.flags[k]) > 0).length;
  const coal = n(s, 'coalpower') + n(s, 'gaspower');
  const heavy = n(s, 'factory') + n(s, 'steelworks') + n(s, 'coalmine');
  const warm = `${s.tempC >= 0 ? '+' : ''}${(Math.round(s.tempC * 10) / 10).toFixed(1)} °C`;
  const cap = capacityReport(s);
  const lost = bushLostPct(s);

  const nutrients = (): string | null => {
    const parts: string[] = [];
    if (farms > 0) parts.push(plural(farms, 'farm'));
    if (outfalls > plants) parts.push(`${plural(outfalls, 'sewage outfall')} with ${plants === 0 ? 'no treatment plant' : plural(plants, 'treatment plant')}`);
    if (runoff > 0) parts.push(`${plural(runoff, 'lasting runoff problem')} from earlier choices`);
    if (wetlands === 0 && parts.length) parts.push('no wetlands to filter it');
    return parts.length ? `Your town has ${parts.join(', ')}.` : null;
  };

  switch (key) {
    case 'fish-kill':
      set(0, nutrients());
      switch (waterBodyOf(s, about)) {
        case 'creek': set(2, `Creek health is ${land.creek} percent, and about ${land.fish} schools of fish are left.`); break;
        case 'estuary': set(2, `Estuary water health is ${Math.round(estuaryHealth(s))} percent. The dirtier it is, the less oxygen is left for fish.`); break;
        case 'river': { const rh = mechMetric(s, 'riverHealth'); set(2, rh !== null ? `River health is ${Math.round(rh)} out of 100. The dirtier the water, the less oxygen is left for fish.` : null); break; }
        case 'reef': break;
      }
      set(3, s.tempC > 0.5 ? `The world is ${warm} warmer than 1850 to 1900, and warm water holds less oxygen.` : null);
      break;
    case 'algal-bloom':
      set(0, nutrients());
      set(1, cap.stocks.flow < 95 ? `Your town takes a lot of water: creek flow is down to ${Math.round(cap.stocks.flow)} percent of normal.` : null);
      break;
    case 'smog':
      set(0, coal + heavy > 0 ? `Your town runs ${[coal ? plural(coal, 'power station') : '', heavy ? plural(heavy, 'factory, mine or steelworks', 'factories, mines and steelworks') : ''].filter(Boolean).join(' and ')}.` : null);
      set(1, `Air quality around homes is ${land.air} percent clean.`);
      break;
    case 'species-loss':
      set(0, lost > 0 ? `${lost} percent of the starting bush has been cleared or built on.` : null);
      set(1, `About ${land.birds} pairs of bush birds are left.`);
      set(3, s.tempC > 0.5 ? `Warming is ${warm}, which brings more heat and fire.` : null);
      break;
    case 'heat-deaths': {
      const canopy = mechMetric(s, 'canopyPct');
      set(0, s.cumulativeKt > 0 ? `Your town has added about ${Math.round(s.cumulativeKt).toLocaleString('en-AU')} kt of CO₂ so far.` : null);
      set(1, `Warming is ${warm}.`);
      set(2, canopy !== null ? `Tree canopy covers ${Math.round(canopy)} percent of the city, and there are ${plural(n(s, 'coolingcentre'), 'cooling centre')}.` : null);
      break;
    }
    case 'coral-bleaching':
      set(0, s.cumulativeKt > 0 ? `Your town has added about ${Math.round(s.cumulativeKt).toLocaleString('en-AU')} kt of CO₂ so far.` : null);
      set(1, `Warming is ${warm}.`);
      set(4, nutrients());
      break;
    case 'crown-of-thorns':
      set(0, nutrients());
      break;
    case 'flood':
      set(1, lost > 0 ? `${lost} percent of the starting bush has gone, so less rain soaks in.` : null);
      set(2, getScenario(s.scenarioId).mechanics?.includes('reef') ? 'Some homes sit on low ground near the water.' : null);
      set(3, nutrients());
      break;
    case 'storm-surge':
      set(1, s.tempC > 0.5 ? `Warming is ${warm}, so seas are higher than they were.` : null);
      break;
    case 'drought': {
      const w = cap.lines.find((l) => l.id === 'water');
      set(1, w && w.ratio > 0.85 ? `Your town uses ${Math.round(w.ratio * 100)} percent of the water the land renews.` : null);
      set(2, farms > 0 ? `Your town has ${plural(farms, 'irrigated farm')}.` : null);
      break;
    }
    case 'erosion':
      set(0, lost > 0 ? `${lost} percent of the starting bush has been cleared or built on.` : null);
      set(2, `Creek health is ${land.creek} percent.`);
      break;
    case 'bushfire':
      set(0, s.tempC > 0.5 ? `Warming is ${warm}.` : null);
      break;
    case 'blackout': {
      const g = s.a2.lastGrid;
      set(0, g ? `Last season's demand was ${Math.round(g.demandTotal)} units and ${Math.round(g.unmetFrac * 100)} percent went unmet.` : null);
      break;
    }
  }
  return out;
}

export function chainFor(key: ChainKey): CauseChain {
  return CAUSE_CHAINS[key];
}
