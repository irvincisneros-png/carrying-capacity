import type { EventType } from '../sim/types';

/** Human-readable event text. Kept here (not in the sim) so copy edits never touch simulation code. */
export const EVENT_TEXT = {
  heatwave: (sev: number, peakC: number): string =>
    `Heatwave: ${sev > 1 ? 'an exceptionally severe' : 'a long'} run of days near ${peakC} C. Air conditioners are straining the grid and the bush is drying out.`,
  drought: (seasons: number): string =>
    `Drought: rainfall has stayed below the town\'s needs. In this simulation the dry conditions will last about ${seasons} seasons, with slow plant growth, thin rivers, weak hydro and high fire danger.`,
  flood: (surge: boolean, damage: number, homesLost: number): string =>
    `${surge ? 'Storm surge' : 'Flood'}: a violent storm swept through. Repairs cost ${damage}.` +
    (homesLost > 0 ? ` ${homesLost} low-lying home${homesLost > 1 ? 's were' : ' was'} lost.` : '') +
    ' Runoff has washed soil and farm chemicals into the river.',
  marineHeatwave: (pctLost: number): string =>
    `Marine heatwave: the sea stayed unusually hot for weeks and the reef bleached. About ${pctLost}% of the coral health was lost.`,
  marineWarning: (): string =>
    'Satellite warning: sea-surface temperature is climbing off the reef, and the risk of unusually warm seas next season is higher. Cutting runoff from the town now may help the coral cope, but cannot prevent heat stress.',
  bushfire: (tiles: number, hot: boolean, homes: number): string =>
    `Bushfire: ${hot ? 'a hot, fast fire' : 'a lower-intensity fire'} burned ${tiles} tiles of bush${homes > 0 ? ` and threatened ${homes} home${homes > 1 ? 's' : ''}` : ''}. ${hot ? 'Severe fire has damaged trees and ground cover. Recovery depends on what survived and the weather that follows.' : 'The bush will usually recover faster from a cooler burn.'}`,
  fishKill: (tiles: number): string =>
    `Fish kill: warm, polluted water ran short of oxygen and thousands of fish died in the estuary (${tiles} tiles affected). The fishers have lost their catch.`,
  algalBloom: (sev: number): string =>
    `Blue-green algae bloom: warm, slow, nutrient-rich water turned the river green${sev > 1 ? ' from bank to bank' : ''}. Some blooms release toxins, so swimming and stock watering are banned and the town's water treatment is working overtime. Fish are dying where the oxygen has run out.`,
  crownOfThorns: (pctLost: number): string =>
    `Crown-of-thorns outbreak: numbers of these native coral-eating starfish have surged on the reef, and nutrient runoff from the land may contribute. About ${pctLost}% of the coral health has gone. Trained control teams can protect priority sites.`,
  stormSurge: (heightM: number, damage: number, homesLost: number, saved: number, warned = 0): string =>
    `Storm surge: a cyclone pushed the sea about ${heightM.toFixed(1)} m above the predicted tide. Repairs cost ${damage}.` +
    (homesLost > 0 ? ` ${homesLost} low-lying home${homesLost > 1 ? 's were' : ' was'} flooded beyond repair.`
      : warned > 0 ? ` Water got into ${warned} low-lying home${warned > 1 ? 's' : ''}. They can be dried out this time, but the next surge will be higher: move people to higher ground.`
        : ' No homes were lost.') +
    (saved > 0 ? ` Seawalls and mangroves kept ${saved} home${saved > 1 ? 's' : ''} dry.` : ''),
  blackout: (seasonName: string, unmetPct: number): string =>
    `Blackout: in ${seasonName} the grid fell ${unmetPct}% short of demand. Homes and factories went dark during the peak.`,
} as const;

export const EVENT_NAMES: Readonly<Record<EventType, string>> = {
  heatwave: 'Heatwave',
  bushfire: 'Bushfire',
  drought: 'Drought',
  flood: 'Flood',
  'marine-heatwave': 'Marine heatwave',
  'fish-kill': 'Fish kill',
  blackout: 'Blackout',
  'algal-bloom': 'Blue-green algae bloom',
  'crown-of-thorns': 'Crown-of-thorns outbreak',
  'storm-surge': 'Storm surge',
};

/** Names for succession stages by tile family. Index = stage 0..3. Estuary habitats (mudflat, saltmarsh, mangrove) differ by conditions; none is automatically better than another. */
export const STAGE_NAMES = {
  land: ['bare ground', 'pioneer grasses', 'shrubs and heath', 'woodland'],
  beach: ['bare sand', 'dune grasses', 'coastal heath', 'coastal scrub'],
  estuary: ['bare sediment', 'recovering estuary vegetation', 'established estuary vegetation', 'healthy estuary habitat'],
  sea: ['bare seabed', 'sparse seagrass', 'seagrass meadow', 'dense seagrass meadow'],
  reef: ['recently settled coral', 'growing coral', 'established coral', 'healthy coral community'],
} as const;
