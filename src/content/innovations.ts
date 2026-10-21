/**
 * The Act 1 innovation timeline (Round 6 WP9): real environmental inventions and laws from NSW and Australia, offered at the
 * decade turns in the order they happened. Each is a dilemma card with a cost, a benefit and evidence, with small, one-off
 * effects on pollution, CO2, Society and money. Sources are in docs/research/wp8-wp9-facts.md. Where the research is
 * uncertain the text says "reported" or "estimated". The scheduler is src/sim/innovations.ts.
 */
import type { DilemmaDef } from '../sim/dilemmas';
import type { ScenarioId } from '../sim/types';

const P = (why: string) => ({ type: 'planet' as const, id: 'planet', why });
const E = (why: string) => ({ type: 'economy' as const, id: 'economy', why });
const T = (why: string) => ({ type: 'town' as const, id: 'town', why });

export const INNOVATION_CARDS: readonly DilemmaDef[] = [
  {
    id: 'inn-clean-air', title: 'Laws to clean the air and water', phase: 'act1', years: [1970, 1989], priority: 8,
    setup: 'Smoke hangs over the chimneys and the creek runs cloudy. New South Wales has passed a Clean Air Act (1961) and a Clean Waters Act (1970), and a new commission can set limits on what factories release. Your town can follow the rules closely, do the minimum, or wait.',
    options: [
      {
        id: 'follow', label: 'Follow the laws closely and fit filters', evidenceBacked: true,
        outcome: 'Filters go on the chimneys and settling ponds beside the factories. The smoke thins and the creek runs clearer. It costs money, and the owners grumble.',
        effects: { budget: -22, society: 1, incomePerDecade: -1, tiles: [{ op: 'air', scope: 'all', mult: 0.8 }, { op: 'water', scope: 'river', mult: 0.88 }], flags: { 'innov.air': 2 } },
        preview: { helps: [P('Less smoke and cleaner water'), T('Healthier lungs')], hurts: [E('Filters cost money up front')] },
      },
      {
        id: 'minimum', label: 'Meet the minimum and no more',
        outcome: 'The town does what the inspector asks and little else. The worst smoke clears, but the creek stays cloudy after rain.',
        effects: { budget: -10, tiles: [{ op: 'air', scope: 'all', mult: 0.92 }, { op: 'water', scope: 'river', mult: 0.96 }], flags: { 'innov.air': 1 } },
        preview: { helps: [E('Cheaper than a full clean-up'), P('A little less smoke')], hurts: [P('Creek still polluted'), T('Complaints continue')] },
      },
      {
        id: 'wait', label: 'Wait and see how strictly it is enforced',
        outcome: 'Nothing changes. A few months later a visit from the inspector turns up a warning, and neighbours ask why nothing has been done.',
        effects: {},
        preview: { helps: [E('No cost now')], hurts: [P('Pollution carries on'), T('The problem is not fixed')] },
      },
    ],
    evidence: 'NSW passed a Clean Air Act in 1961 and a Clean Waters Act in 1970. The State Pollution Control Commission began work in 1971 and took over both Acts in 1974. Critics later said it focused on end-of-pipe controls, which treat pollution after it is made instead of making less. In 1991 a stronger EPA replaced it.',
  },
  {
    id: 'inn-unleaded', title: 'Lead in the petrol', phase: 'act1', years: [1986, 2009], priority: 6,
    setup: 'Cars burn petrol with lead added, and the lead ends up in street dust and in children\'s blood. Unleaded petrol arrived in 1985, and new cars from 1986 need catalytic converters, which clean exhaust fumes. Should the town lead the change or wait for the rules?',
    options: [
      {
        id: 'switch', label: 'Back unleaded fuel and catalytic converters', evidenceBacked: true,
        outcome: 'Garages put in a second pump and car buyers choose the new models. Within a few years the air tests show less lead, and the school nurse says fewer children have high lead readings.',
        effects: { budget: -18, society: 1, tiles: [{ op: 'air', scope: 'all', mult: 0.85 }], flags: { 'innov.unleaded': 1 } },
        preview: { helps: [T('Less lead in children\'s blood'), P('Cleaner exhaust')], hurts: [E('Garages and drivers pay more at first')] },
      },
      {
        id: 'slow', label: 'Let drivers switch when they are ready',
        outcome: 'Most people stay with leaded petrol until it becomes hard to buy. Australia finally ended leaded petrol on 1 January 2002, one of the slowest phase-outs in the world.',
        effects: { budget: -4, tiles: [{ op: 'air', scope: 'all', mult: 0.95 }] },
        preview: { helps: [E('Cheap and easy for now')], hurts: [T('Lead lingers for years'), P('Dirtier exhaust')] },
      },
      {
        id: 'ignore', label: 'Leave it to the state government',
        outcome: 'Nothing changes locally. The neighbouring council makes a fuss about fumes, and some parents ask why your town did nothing.',
        effects: {},
        preview: { helps: [E('No cost')], hurts: [T('Children stay exposed'), P('Air stays dirtier')] },
      },
    ],
    evidence: 'The Australian Bureau of Statistics estimated that about 90% of lead in city air came from petrol. Lead harms children\'s brains even at low blood levels (NSW Public Health Bulletin, 1993). Unleaded petrol began in 1985, and leaded petrol finally ended in 2002, after 17 years. Catalytic converters also cut other harmful gases.',
  },
  {
    id: 'inn-ozone', title: 'The hole in the sky', phase: 'act1', years: [1987, 2009], priority: 9,
    setup: 'Scientists have found a thinning of the ozone layer, the thin gas shield that blocks harmful sunlight. The cause is CFCs, gases in old fridges, air conditioners and spray cans. In 1987 countries signed the Montreal Protocol to phase them out. Will your town move early?',
    options: [
      {
        id: 'phase-out', label: 'Phase out CFCs early and swap the old fridges', evidenceBacked: true,
        outcome: 'Workshops learn to collect the old gas and fridge makers switch to safer ones. It costs money and a little work, but the town is proud to be part of something that works.',
        effects: { budget: -12, society: 2, incomePerDecade: -1, emissionsKt: -6, flags: { 'innov.ozone': 1 } },
        preview: { helps: [P('Protects the ozone layer'), P('CFCs are also strong greenhouse gases')], hurts: [E('Swapping equipment costs money')] },
      },
      {
        id: 'follow-timetable', label: 'Follow the national timetable and no faster',
        outcome: 'The town meets each deadline but not before. Australia\'s government says it met or beat every phase-out target, so the town is in step with the rest of the country.',
        effects: { budget: -6, society: 1, emissionsKt: -3, flags: { 'innov.ozone': 1 } },
        preview: { helps: [E('Spreads the cost out'), P('Still protects the ozone layer')], hurts: [P('A bit slower than it could be')] },
      },
      {
        id: 'delay', label: 'Ask for more time to change the equipment',
        outcome: 'Local firms keep using the old gas for a few more years. The delay saves money now and is hard to explain to students.',
        effects: {},
        preview: { helps: [E('No cost now')], hurts: [P('Ozone damage and warming continue')] },
      },
    ],
    evidence: 'Countries agreed the Montreal Protocol in 1987, and Australia passed the Ozone Protection Act in 1989. The government says Australia met or beat every phase-out target. It is the success story of this timeline: a worldwide ban that worked, and the ozone layer is expected to recover by about the 2060s. CFCs are also strong greenhouse gases, so the ban helped the climate too.',
  },
  {
    id: 'inn-outfall', title: 'What to do with the sewage', phase: 'act1', years: [1990, 2009], priority: 3,
    setup: 'Raw sewage runs out of pipes at the shore and fouls the beach after rain. Sydney built three deep ocean outfalls in 1990 and 1991, which carry treated sewage far out to sea. Your town could do the same, pay for a better treatment plant, or put up with it.',
    options: [
      {
        id: 'treat', label: 'Build a treatment plant first', evidenceBacked: true,
        outcome: 'It is the biggest bill of the decade. But the water leaving the plant is much cleaner, and swimmers return to the beach by summer.',
        effects: { budget: -30, society: 1, tiles: [{ op: 'water', scope: 'all', mult: 0.8 }, { op: 'water', scope: 'estuary', mult: 0.85 }], flags: { 'innov.sewage': 2 } },
        preview: { helps: [P('Cleaner water in the creek and bay'), T('Safe beaches')], hurts: [E('The largest cost of the decade')] },
      },
      {
        id: 'outfall', label: 'Pipe it far out to sea through a deep outfall',
        outcome: 'The beach is cleaner within months. But the sewage is still there, only further away. Some scientists worry about what builds up on the sea floor.',
        effects: { budget: -16, tiles: [{ op: 'water', scope: 'beach', mult: 0.7 }, { op: 'water', scope: 'river', mult: 0.92 }], flags: { 'innov.sewage': 1 } },
        preview: { helps: [T('A cleaner beach quickly'), E('Cheaper than a full plant')], hurts: [P('The problem moves offshore')] },
      },
      {
        id: 'nothing', label: 'Put up with the smell for now',
        outcome: 'The money stays in the bank. A health notice goes up at the beach after the next big storm.',
        effects: {},
        preview: { helps: [E('No cost now')], hurts: [T('Unsafe beaches'), P('More sewage in the water')] },
      },
    ],
    evidence: 'Malabar, North Head and Bondi outfalls opened in 1990 and 1991 and cleaned up Sydney\'s beaches. Critics called it "moving the problem offshore". Sydney Water says its monitoring of sediment and sea life shows no harm, but the outfalls do not remove what is dissolved in the water. Treating sewage first gives cleaner water at either end.',
  },
  {
    id: 'inn-recycling', title: 'Kerbside recycling', phase: 'act1', years: [1990, 2019], priority: 7,
    setup: 'The tip is filling up with bottles, paper and cans. Councils in New South Wales began kerbside recycling in the late 1980s and 1990s, and a newspaper company helped to pay for some. The truck and the bins cost money. Will the town start a service?',
    options: [
      {
        id: 'bins', label: 'Start kerbside recycling with a yellow-lid bin', evidenceBacked: true,
        outcome: 'Every home gets a bin. In the first year a lot of paper, glass and cans go to be remade instead of buried. Some of it is dirty and gets rejected, so the council runs a "what goes in" campaign.',
        effects: { budget: -15, society: 1, emissionsKt: -6, tiles: [{ op: 'soil', scope: 'all', mult: 0.92 }], flags: { 'innov.recycling': 2 } },
        preview: { helps: [P('Less rubbish in the tip'), P('Less methane from landfill')], hurts: [E('Trucks and bins cost money every year')] },
      },
      {
        id: 'depot', label: 'Open a drop-off depot only',
        outcome: 'Keen people carry bottles and paper to the depot on Saturdays. It is cheap, and it only reaches the households who bother.',
        effects: { budget: -6, emissionsKt: -2 },
        preview: { helps: [E('Cheap to run')], hurts: [P('Only some rubbish is saved')] },
      },
      {
        id: 'later', label: 'Wait until recycling pays for itself',
        outcome: 'The tip keeps filling. In a few years the council will have to dig a bigger one.',
        effects: {},
        preview: { helps: [E('No cost now')], hurts: [P('The tip fills faster'), T('A bigger tip later')] },
      },
    ],
    evidence: 'Many NSW councils began kerbside recycling between the late 1980s and the 1990s. Orange started in 1995. Recycling keeps useful materials in use and cuts the methane that rotting rubbish makes in a tip. Costs and results vary between councils, and dirty or mixed loads can be rejected, so the quality of what goes in matters.',
  },
  {
    id: 'inn-basix', title: 'Rules for new homes', phase: 'act1', years: [2004, 2019], priority: 5,
    setup: 'New homes use a lot of water and power. NSW introduced BASIX in 2004: new homes must meet targets for water and energy use before they are approved. Builders say it adds cost. The council must decide how firmly to apply it to the town\'s new streets.',
    options: [
      {
        id: 'apply', label: 'Apply BASIX fully and help builders meet it', evidenceBacked: true,
        outcome: 'New homes get rainwater tanks, efficient taps, insulation and solar hot water. Builders complain about the paperwork, but new owners notice smaller bills.',
        effects: { budget: -12, society: 1, emissionsKt: -8, flags: { 'innov.basix': 1 } },
        preview: { helps: [T('Lower water and power bills'), P('Less water and carbon used')], hurts: [E('Homes cost a little more to build')] },
      },
      {
        id: 'lenient', label: 'Apply it lightly to keep building costs down',
        outcome: 'Most plans pass with small changes. Savings are modest, and so are the complaints.',
        effects: { budget: -4, emissionsKt: -3 },
        preview: { helps: [E('Keeps building costs lower')], hurts: [P('Smaller savings of water and power')] },
      },
      {
        id: 'skip', label: 'Leave it to the builders',
        outcome: 'Homes are built the old way. Their owners pay for it every summer in power and water bills.',
        effects: {},
        preview: { helps: [E('No extra cost to builders')], hurts: [T('Higher bills for new owners'), P('More energy and water used')] },
      },
    ],
    evidence: 'BASIX set targets for new NSW homes of 40% less water and 25% less greenhouse gas than a typical 2004 home. Sydney Water monitoring found water savings of about 40% in 2008 and 2009. The industry reports billions of litres saved, but those totals are industry figures and have not all been checked independently.',
  },
  {
    id: 'inn-solar-bonus', title: 'Paying people for rooftop solar', phase: 'act1', years: [2010, 2020], priority: 4,
    setup: 'Rooftop solar panels are getting cheaper. NSW\'s Solar Bonus Scheme paid households 60 cents for every unit of power they fed to the grid, about three times what the power was worth. The queue to join is long. How generous should the town\'s own scheme be?',
    options: [
      {
        id: 'modest', label: 'Offer a modest payment that still helps', evidenceBacked: true,
        outcome: 'Panels spread across the town at a pace the budget can manage. Fewer homes sign up than they would have for a bigger payment, but the money lasts.',
        effects: { budget: -12, society: 1, emissionsKt: -5, flags: { 'innov.solar': 1 } },
        preview: { helps: [P('More clean power'), E('The bill stays under control')], hurts: [T('Slower than the keenest households want')] },
      },
      {
        id: 'generous', label: 'Match the generous 60 cent payment',
        outcome: 'Everyone rushes to join. Panels cover the roofs, but each household is paid far more than the power is worth, and the bill grows every year.',
        effects: { budget: -30, society: 1, emissionsKt: -10, incomePerDecade: -2, flags: { 'innov.solar': 2 } },
        preview: { helps: [P('Lots of clean power, fast'), T('Households love it')], hurts: [E('Costs far more than planned')] },
      },
      {
        id: 'later-solar', label: 'Wait for panels to get cheaper',
        outcome: 'Panels do get cheaper, and a few households fit them anyway. The town is at the back of the queue.',
        effects: {},
        preview: { helps: [E('No cost now')], hurts: [P('Slower switch to clean power')] },
      },
    ],
    evidence: 'The NSW Solar Bonus Scheme began in 2010 paying 60 cents per kilowatt-hour, then cut to 20 cents and closed to new applicants in 2011. The government forecast a cost of up to $1.9 billion; critics put the shortfall higher. Take-up was huge, but the price was set too high, so a lower payment could have done the job.',
  },
  {
    id: 'inn-container', title: 'Cash for bottles and cans', phase: 'act1', years: [2000, 2020], priority: 2,
    setup: 'Drink bottles and cans end up in the creek and along the road. South Australia has paid a deposit on containers for decades, and New South Wales started "Return and Earn" in December 2017. The idea is simple: pay people ten cents to bring each one back. Will your town push for it?',
    options: [
      {
        id: 'deposit', label: 'Back a container deposit scheme', evidenceBacked: true,
        outcome: 'Collection points open at the shops, and school clubs raise money collecting cans. Roadside litter drops over the next few years.',
        effects: { budget: -10, society: 1, emissionsKt: -3, tiles: [{ op: 'water', scope: 'river', mult: 0.94 }, { op: 'soil', scope: 'all', mult: 0.96 }], flags: { 'innov.container': 1 } },
        preview: { helps: [P('Less litter in the creek'), T('Pocket money for schools')], hurts: [E('Machines and collection cost money')] },
      },
      {
        id: 'clean-up', label: 'Fund more litter clean-up days instead',
        outcome: 'Volunteers fill dozens of bags. The creek looks great for a month. The next storm brings it all back.',
        effects: { budget: -6, tiles: [{ op: 'water', scope: 'river', mult: 0.97 }] },
        preview: { helps: [T('Neighbours working together')], hurts: [P('The litter keeps coming')] },
      },
      {
        id: 'no-deposit', label: 'Leave it as it is',
        outcome: 'Cans keep washing into the creek, and visitors notice.',
        effects: {},
        preview: { helps: [E('No cost')], hurts: [P('Litter stays in the water')] },
      },
    ],
    evidence: 'South Australia began a container deposit scheme in 1977. NSW\'s Return and Earn started in December 2017 and had passed 14 billion containers by 2025. The scheme\'s operator reports a big fall in drink-container litter, from 44% in the first year to 73% later. These are the operator\'s own figures, so independent checks would add confidence.',
  },
];

/** Per-scenario limits: at most `cap` innovation cards in the whole game, `perTurn` at one decade turn. */
export interface InnovationLimits { cap: number; perTurn: number; /** Only these cards are offered (default: all). */ only?: readonly string[] }
export const DEFAULT_INNOVATION_LIMITS: InnovationLimits = { cap: 5, perTurn: 2 };
/** Green Valley is the 30-minute tutorial, so it gets one card, the CFC success story, which also fits its 28 to 38 minute play time. */
export const INNOVATION_LIMITS: Partial<Record<ScenarioId, InnovationLimits>> = {
  'green-valley': { cap: 1, perTurn: 1, only: ['inn-ozone'] },
};
