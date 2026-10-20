import type { BuildingId } from '../sim/types';

/** Legacy types the waste hierarchy applies to. Homes, farms and roads stay in use (reuse comes first). */
export const LEGACY_TYPES: readonly BuildingId[] = [
  'coalmine', 'rail', 'port', 'steelworks', 'coalpower', 'factory', 'landfill', 'carpark', 'outfall',
];

export interface RepurposeOption {
  id: string;
  /** New building, or 'rehab' to return the land to bush. */
  into: BuildingId | 'rehab';
  label: string;
  cost: number;
  /** Research id that must be bought first. */
  requires?: string;
  story: string;
  blurb: string;
}

/** Repurpose options by legacy building type. */
export const REPURPOSE: Readonly<Partial<Record<BuildingId, readonly RepurposeOption[]>>> = {
  steelworks: [
    {
      id: 'green-steel', into: 'greensteel', label: 'Green steel plant', cost: 90, requires: 'green-steel',
      blurb: 'Keep making steel, but with hydrogen from renewable power instead of coal. Keeps skilled jobs.',
      story: 'The blast furnace went cold for the last time. Within two years the same gates opened onto a green steel plant, and the workers who knew the site best were hired first.',
    },
    {
      id: 'museum', into: 'makerspace', label: 'Museum and makerspace', cost: 25,
      blurb: 'Keep the story: part museum of the town, part workshop where people learn to weld, repair and build.',
      story: 'The steelworks gates now open on a museum of the town\'s story, and a workshop where kids and retirees learn to weld, mend and make things side by side.',
    },
    {
      id: 'rehab', into: 'rehab', label: 'Return to bushland', cost: 20,
      blurb: 'Test the soil, manage any contamination, then restore suitable native vegetation.',
      story: 'The last steel frames were lifted away. After the soil was tested and treated, crews sowed native grass seed and monitored the site, and a year later the first wattles came up.',
    },
  ],
  port: [
    {
      id: 'wind-port', into: 'windport', label: 'Wind-turbine port', cost: 40,
      blurb: 'The deep berth that shipped coal now ships turbine blades and towers for offshore wind.',
      story: 'The coal loader\'s deep berth was fitted with heavy-lift cranes. The first thing it shipped was a 90-metre turbine blade, and half the town came down to watch.',
    },
  ],
  landfill: [
    {
      id: 'solar-landfill', into: 'solarlandfill', label: 'Solar farm on the capped landfill', cost: 30,
      blurb: 'Seal the rubbish under a cap and mount panels on weighted frames. Land that was hard to use makes power.',
      story: 'Panels went up on weighted frames, so nothing had to be dug into the capped rubbish below. Sheep graze underneath. The old tip now powers a few hundred homes.',
    },
  ],
  coalpower: [
    {
      id: 'battery-site', into: 'batteryhub', label: 'Battery site', cost: 45,
      blurb: 'The station already has a grid connection, cooling-water access and skilled staff. Batteries can use the same connection.',
      story: 'The boilers came out and rows of batteries went in, plugged into the same big connection to the grid. Several of the old control-room operators kept their jobs.',
    },
    {
      id: 'community-hub', into: 'communityhub', label: 'Community hub', cost: 20,
      blurb: 'Library, meeting rooms and a cool place to be in a heatwave inside the old walls.',
      story: 'The turbine hall became a library, a market and a cool refuge on hot days. People say the high roof makes it feel like a cathedral.',
    },
    {
      id: 'rehab', into: 'rehab', label: 'Return to bushland', cost: 20,
      blurb: 'Test the soil, manage any contamination, then restore suitable native vegetation.',
      story: 'With the chimney down, the ash safely managed and the soil treated, crews planted native seedlings and monitored the site. Birds and wind soon brought more.',
    },
  ],
  factory: [
    {
      id: 'recycler', into: 'recycler', label: 'Recycling and remanufacturing plant', cost: 35,
      blurb: 'The factory floor and the skilled workforce make products from the town\'s own recycled materials.',
      story: 'The sawtooth-roofed factory still hums. It now sorts the town\'s glass, metals and plastics and turns them into new products, and the whistle still blows at shift change.',
    },
    {
      id: 'rehab', into: 'rehab', label: 'Return to bushland', cost: 15,
      blurb: 'Test the soil, manage any contamination, then restore suitable native vegetation.',
      story: 'The factory came down brick by brick, and the bricks went to new homes. After the soil was tested and treated, native grasses were planted and their recovery monitored.',
    },
  ],
  coalmine: [
    {
      id: 'rehab', into: 'rehab', label: 'Rehabilitated bushland', cost: 25,
      blurb: 'Seal the workings, clean up the soil, and plant native bush. The soil must be clean enough first.',
      story: 'The mine was sealed, the soil was tested, and local seed went in. Bushland is returning to the escarpment where the headframe once stood.',
    },
  ],
  rail: [
    {
      id: 'rehab', into: 'rehab', label: 'Wildlife corridor', cost: 8,
      blurb: 'Lift the track and let bush grow along the old rail corridor, joining woodland patches.',
      story: 'The rails were lifted and recycled. Along the old corridor, seedlings are joining one patch of bush to the next.',
    },
  ],
  carpark: [
    {
      id: 'rehab', into: 'rehab', label: 'Return to bushland', cost: 10,
      blurb: 'Take up the asphalt and let the bush come back.',
      story: 'The asphalt was ground up for road base. Beneath it the soil was hard and tired, but native grasses took hold.',
    },
  ],
};

/** What recycling a legacy building recovers, as short accurate notes. */
export const RECYCLE_STORY: Readonly<Partial<Record<BuildingId, string>>> = {
  steelworks: 'The steelworks was carefully taken apart. Steel is one of the most recycled materials on Earth, and most of the structure went back into new steel.',
  coalpower: 'The power station was dismantled piece by piece. Its steel, copper and concrete were sorted and sold for reuse.',
  port: 'The coal loader was dismantled and its steel sold to be melted into new beams.',
  factory: 'The factory was deconstructed, and its bricks, beams and machinery were sorted for reuse.',
  coalmine: 'The surface buildings were taken apart and the steel recycled. The workings were sealed.',
  landfill: 'Specialist crews excavated selected waste and recovered usable materials. Contaminated and unrecoverable waste still needed safe disposal.',
  rail: 'The rail was lifted. Steel rail is among the most easily recycled material there is.',
  carpark: 'The car park was broken up, and suitable asphalt and concrete were recovered for new road base.',
  outfall: 'The old outfall pipe was removed and its materials recycled.',
};

export const LANDFILL_STORY =
  'The old site was knocked down and the rubble trucked to landfill. It was quick and cheap, but materials that might have been reused or recycled were lost, and demolition and transport produced emissions.';
