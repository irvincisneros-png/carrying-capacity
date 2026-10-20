import type { EventType } from '../sim/types';

/** Human-readable event text. Kept here (not in the sim) so copy edits never touch simulation code. */
export const EVENT_TEXT = {
  heatwave: (sev: number, peakC: number): string =>
    `Heatwave: ${sev > 1 ? 'a record-breaking' : 'a long'} run of days near ${peakC} C. Air conditioners are straining the grid and the bush is drying out.`,
  drought: (seasons: number): string =>
    `Drought: the rain has stopped. Expect about ${seasons} seasons of dry weather - slow plant growth, thin rivers, weak hydro and high fire danger.`,
  flood: (surge: boolean, damage: number, homesLost: number): string =>
    `${surge ? 'Storm surge' : 'Flood'}: a violent storm swept through. Repairs cost ${damage}.` +
    (homesLost > 0 ? ` ${homesLost} low-lying home${homesLost > 1 ? 's were' : ' was'} lost.` : '') +
    ' Runoff has washed soil and farm chemicals into the river.',
  marineHeatwave: (pctLost: number): string =>
    `Marine heatwave: the sea stayed unusually hot for weeks and the reef bleached. About ${pctLost}% of the coral health was lost.`,
  marineWarning: (): string =>
    'Satellite warning: sea-surface temperature is climbing off the reef. A marine heatwave is expected to arrive next season. Cutting runoff from the town now would help the coral cope.',
  bushfire: (tiles: number, hot: boolean, homes: number): string =>
    `Bushfire: ${hot ? 'a hot, fast fire' : 'a lower-intensity fire'} burned ${tiles} tiles of bush${homes > 0 ? ` and threatened ${homes} home${homes > 1 ? 's' : ''}` : ''}. ${hot ? 'Hot fires leave bare ground - regrowth starts again from nothing.' : 'The bush will recover faster from a cooler burn.'}`,
  fishKill: (tiles: number): string =>
    `Fish kill: warm, polluted water ran short of oxygen and thousands of fish died in the estuary (${tiles} tiles affected). The fishers have lost their catch.`,
  blackout: (seasonName: string, unmetPct: number): string =>
    `Blackout: in ${seasonName} the grid fell ${unmetPct}% short of demand. Homes and factories went dark during the peak.`,
} as const;

export const EVENT_NAMES: Readonly<Record<EventType, string>> = {
  heatwave: 'Heatwave',
  bushfire: 'Bushfire',
  drought: 'Drought',
  flood: 'Flood / storm surge',
  'marine-heatwave': 'Marine heatwave',
  'fish-kill': 'Fish kill',
  blackout: 'Blackout',
};

/** Names for succession stages by tile family. Index = stage 0..3. */
export const STAGE_NAMES = {
  land: ['bare ground', 'pioneer grasses', 'shrubs and heath', 'woodland'],
  beach: ['bare sand', 'dune grasses', 'coastal heath', 'coastal scrub'],
  estuary: ['mudflat', 'young saltmarsh', 'saltmarsh', 'mangrove forest'],
  sea: ['bare seabed', 'sparse seagrass', 'seagrass meadow', 'dense seagrass meadow'],
  reef: ['dead reef', 'bleached coral', 'stressed coral', 'healthy coral'],
} as const;
