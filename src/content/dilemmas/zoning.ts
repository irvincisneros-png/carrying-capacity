/**
 * The two zoning cards, offered in every scenario that has an Act 1 (the sprawl lesson):
 *   - "A developer wants to subdivide the bushland on the ridge": money now and sprawl later, or build up near the station.
 *   - "Residents oppose flats next door": density against local character. Deliberately no clean answer.
 * One factory, so the wording and numbers stay the same shape in each town; only the place names and the neighbour change.
 * Both cards wait until the town has grown some zoned homes, and sit below the scenario's own cards in priority, so they use
 * a free slot rather than pushing a story card out.
 */
import { t } from '../../sim/conditions';
import type { DilemmaDef } from '../../sim/dilemmas';
import type { ScenarioId } from '../../sim/types';

interface Place {
  /** Resident who brings the ridge problem, and the neighbour in the flats row. */
  ridgeSpeaker: string;
  flatsSpeaker: string;
  /** Name for the cast members in the text. */
  ridgeWho: string;
  flatsWho: string;
  /** "the ridge", "the headland": where the bush is. */
  ridge: string;
  /** Where building up would go instead. */
  hub: string;
  /** What the bush is home to in this town (for the setup line). */
  wild: string;
  /** What the town is called in the flats card. */
  park: string;
  /** What the path, bus stop and trees cost the council ($k) if the town builds up near the station. */
  stationCost: number;
}

const PLACES: Partial<Record<ScenarioId, Place>> = {
  'green-valley': { ridgeSpeaker: 'ali-rahman', flatsSpeaker: 'jo-marsh', ridgeWho: 'Ali, the ranger,', flatsWho: 'Jo', ridge: 'the ridge', hub: 'the railway station', wild: 'bush birds', park: 'the park', stationCost: 16 },
  'coal-coast': { ridgeSpeaker: 'dot-harris', flatsSpeaker: 'mick-kowalski', ridgeWho: 'Dot, the dairy farmer,', flatsWho: 'Mick', ridge: 'the headland', hub: 'the railway station', wild: 'koalas and cockatoos', park: 'the oval', stationCost: 16 },
  'river-town': { ridgeSpeaker: 'sue-pellegrino', flatsSpeaker: 'kerry-brennan', ridgeWho: 'Sue, the mayor,', flatsWho: 'Kerry', ridge: 'the red gum rise', hub: 'the railway station', wild: 'parrots and frogs', park: 'the riverbank park', stationCost: 16 },
  'reef-island': { ridgeSpeaker: 'kieran-walsh', flatsSpeaker: 'tess-okafor', ridgeWho: 'Kieran, the dive operator,', flatsWho: 'Tess', ridge: 'the hill behind the beach', hub: 'the ferry wharf', wild: 'shorebirds and turtles', park: 'the foreshore', stationCost: 16 },
  'red-dirt': { ridgeSpeaker: 'pete-hanrahan', flatsSpeaker: 'bev-gallagher', ridgeWho: 'Pete, the station owner,', flatsWho: 'Bev', ridge: 'the rocky rise', hub: 'the main street and bus stop', wild: 'bilbies and budgies', park: 'the town park', stationCost: 8 },
};

function sprawlCard(id: ScenarioId, p: Place): DilemmaDef {
  return {
    id: `${id}-sprawl`,
    title: `Subdivide ${p.ridge}?`,
    phase: 'act1',
    years: [1960, 2019],
    when: { all: [t('grown.res', '>=', 6)] },
    speaker: p.ridgeSpeaker,
    priority: 1,
    setup: `A developer wants to subdivide the bushland on ${p.ridge}: 120 big blocks, and fees for the council now. ${p.ridgeWho} says it is the last big stretch of bush for the ${p.wild}. There is empty land beside ${p.hub}, where townhouses and shops could go instead, but the council would pay for a path and a bus stop. Bush left: {bush}%.`,
    options: [
      {
        id: 'subdivide', label: `Approve the subdivision on ${p.ridge}`,
        outcome: 'The bulldozers move in. Blocks sell fast and the council banks the fees. The bush on the slope is gone, with about {birds} pairs of birds left, and the new streets mean more road to mend and longer drives. Bush left: {bush}%.',
        effects: { budget: 14, incomePerDecade: 4, clearBush: 6, emissionsKt: 10, flags: { 'sprawl.ridge': 1, 'runoff.ridge': 0.02 }, mood: { [p.ridgeSpeaker]: -6 } },
        preview: {
          helps: [{ type: 'economy', id: 'economy', why: 'Fees now: $14k, and about $4k more income every decade' }],
          hurts: [{ type: 'planet', id: 'planet', why: 'Bush is cleared, streets cut the habitat up, and longer drives add CO2' }, { type: 'resident', id: p.ridgeSpeaker, why: 'The last big stretch of bush is gone' }],
        },
      },
      {
        id: 'station', label: `Say no to the bush and build up near ${p.hub}`,
        outcome: `The developer builds three-storey townhouses and shops by the station instead. The council pays about $${p.stationCost}k for a path, a bus stop and trees, and a few neighbours grumble. The bush stays, with about {birds} pairs of birds, and many families can walk to the shops. Bush left: {bush}%.`,
        effects: { budget: -p.stationCost, incomePerDecade: 3, society: 1, emissionsKt: -6, flags: { 'sprawl.compact': 1 }, mood: { [p.ridgeSpeaker]: 6 } },
        evidenceBacked: true,
        preview: {
          helps: [{ type: 'planet', id: 'planet', why: 'The bush stays, there is less new road, and shorter trips cut CO2' }, { type: 'resident', id: p.ridgeSpeaker, why: 'The nesting trees stay' }],
          hurts: [{ type: 'economy', id: 'economy', why: `Costs the council $${p.stationCost}k for the path, bus stop and trees` }, { type: 'town', id: 'town', why: 'Some families wanted a big yard, and some neighbours dislike the extra people' }],
        },
      },
    ],
    evidence: 'Spread-out suburbs are called urban sprawl. They need more land, road, pipe and cable for every home. Australian research (Trubka, Newman and Bilsborough, 2010) found that fringe development costs more in infrastructure and transport than the same number of homes in established suburbs. Newman and Kenworthy (1999) found that people in low-density cities drive much further. Clearing bush also splits up habitat, and the 2021 State of the Environment report lists urban growth as a pressure on wildlife. Building up saves bush but costs money.',
  };
}

function flatsCard(id: ScenarioId, p: Place): DilemmaDef {
  return {
    id: `${id}-flats`,
    title: 'Residents oppose flats next door',
    phase: 'act1',
    years: [1975, 2019],
    when: { all: [t('grown.res', '>=', 8)] },
    speaker: p.flatsSpeaker,
    priority: 0,
    noCleanAnswer: true,
    setup: `A developer has bought three old houses beside ${p.park} and wants to put up a six-storey block of 40 flats. It is close to the shops and the bus, so families on small incomes could afford to live there. The neighbours have signed a petition. They worry about parking, shade over their yards, noise and losing the feel of the street. ${p.flatsWho} is one of them. The housing has to go somewhere.`,
    options: [
      {
        id: 'approve', label: 'Approve the flats',
        outcome: 'The block goes up. Forty more households live near the shops and the bus, so more people walk and fewer new streets are needed. The neighbours lose some afternoon sun and street parking, and the street feels different. {pop} people now live in town.',
        effects: { budget: 8, incomePerDecade: 3, emissionsKt: -5, society: -1, mood: { [p.flatsSpeaker]: -8 }, flags: { 'flats.approved': 1 } },
        preview: {
          helps: [{ type: 'planet', id: 'planet', why: 'Less land and road for each person, and shorter trips' }, { type: 'town', id: 'town', why: '40 households find a home they can afford' }],
          hurts: [{ type: 'resident', id: p.flatsSpeaker, why: 'Less sun, less parking and a changed street' }],
        },
      },
      {
        id: 'refuse', label: 'Refuse: keep the street as it is',
        outcome: 'The council says no. The street keeps its trees, sun and quiet, and the neighbours cheer. But those 40 households still need homes, so a few more blocks are cut on the edge of town. That means more bush cleared and longer drives, and rents creep up. Bush left: {bush}%.',
        effects: { budget: 0, incomePerDecade: -2, clearBush: 3, emissionsKt: 6, society: -1, mood: { [p.flatsSpeaker]: 8 }, flags: { 'flats.refused': 1 } },
        preview: {
          helps: [{ type: 'resident', id: p.flatsSpeaker, why: 'The street stays as it is' }],
          hurts: [{ type: 'planet', id: 'planet', why: 'The homes spread to the edge of town, clearing bush and adding to drives' }, { type: 'town', id: 'town', why: 'Fewer affordable homes near the shops, so rents rise' }],
        },
      },
      {
        id: 'smaller', label: 'Allow a smaller block of three storeys, with trees and parking',
        outcome: 'A smaller block of 15 flats is built, with a row of trees and parking underneath. The neighbours still lose some sun, the developer grumbles about the profit, and fewer households find a home near the shops. Nobody gets everything they wanted.',
        effects: { budget: -4, clearBush: 1, emissionsKt: 1, mood: { [p.flatsSpeaker]: 2 }, flags: { 'flats.smaller': 1 } },
        preview: {
          helps: [{ type: 'resident', id: p.flatsSpeaker, why: 'Less shade and noise than six storeys' }, { type: 'town', id: 'town', why: '15 more homes near the shops' }],
          hurts: [{ type: 'economy', id: 'economy', why: 'Costs the council $4k for the trees and parking' }, { type: 'planet', id: 'planet', why: 'Still some homes spill onto the edge of town' }],
        },
      },
    ],
    evidence: 'Higher density means less land for each person, and it helps buses, trains and local shops work because more customers live nearby (Newman and Kenworthy, 1999). But a tall block can shade neighbours, add traffic and squeeze parking, and research on planning disputes finds that people care about having a say and about good design, not only about storeys. In a hot city, tall blocks with little greenery can add to the urban heat island. There is no single right answer.',
  };
}

export const ZONING_CARDS: Readonly<Partial<Record<ScenarioId, readonly DilemmaDef[]>>> = Object.fromEntries(
  (Object.keys(PLACES) as ScenarioId[]).map((id) => [id, [sprawlCard(id, PLACES[id]!), flatsCard(id, PLACES[id]!)]]),
);
