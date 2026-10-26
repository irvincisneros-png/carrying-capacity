/**
 * "Who wins, who loses" (WP8d): three short lines on every dilemma option: the residents, the animals and the future
 * generations. Most are worked out from the option's own data (its preview and effects), so a new card gets them for
 * free. The Green Valley cards, which teach the idea, are written by hand below and win over the derived lines.
 */
import type { DilemmaOption } from '../sim/dilemmas';

export interface WinLose {
  residents: string;
  animals: string;
  future: string;
}

/** Hand-written lines, keyed `cardId/optionId`. */
export const WIN_LOSE_AUTHORED: Record<string, WinLose> = {
  'gv-factory-waste/creek': {
    residents: 'Wins: factory owners and workers, with cheap waste disposal. Loses: Jo and the downstream farms, who get muddy water.',
    animals: 'Loses: fish, platypus and water bugs, as the creek clouds and the oxygen drops.',
    future: 'Loses: the waste builds up in the creek mud and is still there for the next generation to clean.',
  },
  'gv-factory-waste/pit': {
    residents: 'Wins: Jo and her buyers, with cleaner water. Loses: the factory, which pays for the pit.',
    animals: 'Wins: creek fish and bugs, because less waste gets in.',
    future: 'Wins: cleaning at the source is cheaper than cleaning up later, and leaves a healthier creek behind.',
  },
  'gv-hillside/clear': {
    residents: 'Wins: the neighbour, with a bigger farm. Loses: Jo and the rangers, who lose the view, the birds and the clear creek.',
    animals: 'Loses: bush birds lose their nesting trees, and fish lose clear water.',
    future: 'Loses: topsoil washes away and takes decades to rebuild, and the cleared bush stops soaking up carbon.',
  },
  'gv-hillside/terrace': {
    residents: 'Wins: the neighbour gets some new farmland and the creek stays clear for everyone. Loses: a smaller farm than he hoped for.',
    animals: 'Wins: most of the bush and birds stay, and the creek stays clear.',
    future: 'Wins: roots hold the steep soil in place for good.',
  },
  'gv-hillside/leave': {
    residents: 'Wins: the rangers, and visitors who come for the birds. Loses: the neighbour, who misses out on a bigger farm.',
    animals: 'Wins: all the bush and its animals stay.',
    future: 'Wins: the bush keeps storing carbon and holding soil for generations.',
  },
  'gv-fertiliser/heavy': {
    residents: 'Wins: farmers, with a big harvest and a cheap deal. Loses: people downstream, when algae foul the creek.',
    animals: 'Loses: fish, when algae rot and use up the oxygen.',
    future: 'Loses: extra nutrients wash on to the sea and the soil life suffers, and it takes years to recover.',
  },
  'gv-fertiliser/soil-test': {
    residents: 'Wins: farmers, who spend less and still grow well. Loses: a little time and money for the tests.',
    animals: 'Wins: the creek stays clean, so fish and bugs keep their oxygen.',
    future: 'Wins: soil stays healthy for the next farmers.',
  },
  'gv-fertiliser/skip': {
    residents: 'Wins: nobody downstream is bothered. Loses: farmers, who miss out on a boost.',
    animals: 'Wins: no new nutrients reach the creek.',
    future: 'Same as before: no new harm, and no new gain.',
  },
  'gv-tip/creek-tip': {
    residents: 'Wins: the council, which saves money now. Loses: neighbours, who get smells, rats and leachate in the creek.',
    animals: 'Loses: creek animals, as the dirty liquid (leachate) seeps in.',
    future: 'Loses: leachate and methane keep leaking for decades after the tip closes.',
  },
  'gv-tip/lined': {
    residents: 'Wins: neighbours and creek users, with a safe tip. Loses: the council, which pays more.',
    animals: 'Wins: the creek stays clean.',
    future: 'Wins: the liner and gas capture keep leaks and methane in check for generations.',
  },
  'gv-dry-year/pump': {
    residents: 'Wins: farmers, who keep their crops this year. Loses: everyone downstream and anyone who loves the creek.',
    animals: 'Loses: fish and platypus when pools dry up.',
    future: 'Loses: a dried-out creek takes years to refill, and the habit makes the next drought worse.',
  },
  'gv-dry-year/restrict': {
    residents: 'Wins: people who value the creek. Loses: farmers, who earn less this year.',
    animals: 'Wins: fish and platypus keep some water.',
    future: 'Wins: the creek keeps living, which makes the valley more able to cope with the next drought.',
  },
  'gv-solar-rebate/rebate': {
    residents: 'Wins: households, with lower power bills. Loses: the council, which pays the rebate up front.',
    animals: 'Wins a little: less coal burned means less air and water pollution.',
    future: 'Wins: less CO₂ added to the air that the next generation will live in.',
  },
  'gv-solar-rebate/hall': {
    residents: 'Wins: the whole community shares a cheaper hall and school. Loses: householders who wanted their own panels.',
    animals: 'Wins a little: less coal burned.',
    future: 'Wins a little: some CO₂ saved, and the panels last 25 years or more.',
  },
  'gv-solar-rebate/wait': {
    residents: 'Wins: the council saves money now. Loses: households keep paying full power bills.',
    animals: 'Neutral: nothing changes yet.',
    future: 'Loses a little: more CO₂ is added while the town waits.',
  },
  'gv-solar-site/paddock': {
    residents: 'Wins: the valley, with fast, cheap clean power. Loses: Jo, who loses her spring grazing paddock.',
    animals: 'Loses a little: grassland where animals feed is covered by panels.',
    future: 'Wins: clean power for 25 years or more. Loses: good farmland is covered for as long as the panels stand.',
  },
  'gv-solar-site/landfill': {
    residents: 'Wins: Jo keeps her paddock and the valley gets clean power. Loses: the budget, because building on a capped landfill costs more.',
    animals: 'Wins: no new habitat or farmland is lost.',
    future: 'Wins: clean power on land that was already spoilt, and a second life for an old site.',
  },
  'gv-solar-site/roofs': {
    residents: 'Wins: households with panels save on power bills. Loses: the valley still waits for its big share of clean power.',
    animals: 'Wins: no land is cleared at all.',
    future: 'Wins a little: some CO₂ saved without using new land. Loses a little: coal power stays for longer.',
  },
  'gv-dam-or-wetland/dam': {
    residents: 'Wins: Jo and the farm, with water stored for the dry months. Loses: the budget ($14k) and Ali\'s hopes for the frogs.',
    animals: 'Loses: green and golden bell frogs, which get no shallow, sunny pools to breed in.',
    future: 'Mixed: stored water helps in dry years, but a steep, bare dam does little for wildlife for decades.',
  },
  'gv-dam-or-wetland/wetland': {
    residents: 'Wins: Ali, and everyone downstream who gets cleaner water. Loses: Jo, who gets less stored water for the farm.',
    animals: 'Wins: frogs, birds and fish gain a shallow home, and the water is filtered.',
    future: 'Wins: wetlands filter runoff and store carbon for generations.',
  },
};

export interface NameOf { (id: string, type: string): string }

type Target = { type: string; id: string; why: string };

const CLIMATE = /(co2|carbon|climate|warm|emission|coal|fuel|power|solar|methane)/i;
const NATURE = /(bush|habitat|creek|river|fish|bird|animal|wildlife|koala|turtle|platypus|water|wetland|reef|coral|estuary|tree|soil|land)/i;
const PEOPLE = /(farm|family|home|job|worker|town|school|health|neighbour|people|resident|child)/i;

const list = (xs: string[]): string => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const short = (t: string): string => t.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase());

const whoOf = (x: string): string => x.replace(/ \(.*$/, '');
/** If one party appears on both sides, it becomes a single entry under Loses that keeps the upside as a "though". */
function netParties(win: string[], lose: string[]): void {
  for (let i = win.length - 1; i >= 0; i--) {
    const who = whoOf(win[i]!);
    const j = lose.findIndex((x) => whoOf(x) === who);
    if (j < 0) continue;
    const up = /\((.*)\)$/.exec(win[i]!)?.[1];
    const down = /\((.*)\)$/.exec(lose[j]!)?.[1];
    lose[j] = up && down ? `${who} (${down}, though ${up})` : lose[j]!;
    win.splice(i, 1);
  }
}

/** Works out the three lines from an option's preview and effects. */
export function deriveWinLose(opt: DilemmaOption, nameOf: NameOf): WinLose {
  const helps = (opt.preview?.helps ?? []) as readonly Target[];
  const hurts = (opt.preview?.hurts ?? []) as readonly Target[];
  const fx = opt.effects ?? {};

  const side = (xs: readonly Target[], pick: (t: Target) => boolean): string[] => xs.filter(pick).map((t) => {
    const who = t.type === 'resident' ? nameOf(t.id, t.type) : t.type === 'economy' ? 'the budget' : t.type === 'town' ? 'the town' : t.type === 'creature' ? nameOf(t.id, t.type) : 'the land';
    return t.why ? `${who} (${short(t.why)})` : who;
  });

  // Residents: named people, the town and the budget.
  const isPeople = (t: Target): boolean => t.type === 'resident' || t.type === 'town' || t.type === 'economy' || (t.type === 'planet' && PEOPLE.test(t.why) && !NATURE.test(t.why));
  const rWin = side(helps, isPeople), rLose = side(hurts, isPeople);
  // The budget is netted: an option never lists it as both a win and a loss. A cost now that pays back later (or the reverse) is one entry.
  const upfront = fx.budget ?? 0;
  const rate = (fx.incomePerDecade ?? 0) + (fx.incomePerYear ?? 0) * 10;
  const isBudget = (x: string): boolean => x.startsWith('the budget');
  const mixed = (upfront < 0 && rate > 0) || (upfront > 0 && rate < 0);
  if (mixed || (rWin.some(isBudget) && rLose.some(isBudget))) {
    for (const arr of [rWin, rLose]) for (let i = arr.length - 1; i >= 0; i--) if (isBudget(arr[i]!)) arr.splice(i, 1);
    const k = (n: number): string => `$${Math.round(Math.abs(n))}k`;
    if (mixed) {
      const entry = upfront < 0
        ? `the budget (${k(upfront)} now, then about ${k(rate)} a decade coming back)`
        : `the budget (${k(upfront)} now, then about ${k(rate)} a decade less)`;
      (upfront < 0 ? rLose : rWin).push(entry);
    } else if (upfront !== 0 || rate !== 0) {
      (upfront + rate < 0 ? rLose : rWin).push('the budget');
    }
  } else {
    if (((upfront < 0) || rate < 0) && !rLose.some(isBudget) && !rWin.some(isBudget)) rLose.push('the budget (it costs money)');
    if (((upfront > 0) || rate > 0) && !rWin.some(isBudget) && !rLose.some(isBudget)) rWin.push('the budget (it brings in money)');
  }
  netParties(rWin, rLose);
  const residents = [rWin.length ? `Wins: ${list(rWin)}.` : '', rLose.length ? `Loses: ${list(rLose)}.` : ''].filter(Boolean).join(' ') || 'No clear winners or losers among the residents.';

  // Animals: creatures, and anything that touches habitat or water.
  const isAnimal = (t: Target): boolean => t.type === 'creature' || (t.type === 'planet' && NATURE.test(t.why) && !CLIMATE.test(t.why));
  const aWin = side(helps, isAnimal), aLose = side(hurts, isAnimal);
  const tiles = fx.tiles ?? [];
  if ((fx.clearBush ?? 0) > 0 && !aLose.length) aLose.push(`bush animals (${fx.clearBush} bush tiles cleared)`);
  if (tiles.some((t) => t.op === 'water' && ((t.add ?? 0) > 0))) { if (!aLose.length) aLose.push('creek fish and bugs (dirtier water)'); }
  if (tiles.some((t) => t.op === 'water' && ((t.mult ?? 1) < 1))) { if (!aWin.length) aWin.push('creek fish and bugs (cleaner water)'); }
  if (tiles.some((t) => t.op === 'health' && ((t.add ?? 0) > 0 || (t.mult ?? 1) > 1))) { if (!aWin.length) aWin.push('wildlife (more habitat)'); }
  if (tiles.some((t) => t.op === 'soil' && ((t.mult ?? 1) < 1))) { if (!aWin.length) aWin.push('soil life (less contamination)'); }
  netParties(aWin, aLose);
  const animals = [aWin.length ? `Wins: ${list(aWin)}.` : '', aLose.length ? `Loses: ${list(aLose)}.` : ''].filter(Boolean).join(' ') || 'No big change for wildlife.';

  // Future generations: climate, long-lived habitat and lasting harm.
  const isFuture = (t: Target): boolean => t.type === 'planet' && CLIMATE.test(t.why);
  const fWin = side(helps, isFuture), fLose = side(hurts, isFuture);
  const kt = fx.emissionsKt ?? 0;
  if (kt > 0 && !fLose.length) fLose.push(`people not yet born (adds about ${Math.round(kt)} kt of CO₂ that stays in the air)`);
  if (kt < 0 && !fWin.length) fWin.push(`people not yet born (saves about ${Math.round(-kt)} kt of CO₂)`);
  if (!fWin.length && !fLose.length) {
    if (opt.evidenceBacked) fWin.push('people not yet born (it follows the evidence and leaves a healthier place)');
    else if (aLose.length) fLose.push('people not yet born (lost habitat takes a long time to return)');
    else if (aWin.length) fWin.push('people not yet born (a healthier place to inherit)');
  }
  netParties(fWin, fLose);
  const future = [fWin.length ? `Wins: ${list(fWin)}.` : '', fLose.length ? `Loses: ${list(fLose)}.` : ''].filter(Boolean).join(' ') || 'Mostly a choice for today, with little lasting effect.';
  return { residents, animals, future };
}

export function winLoseFor(cardId: string, opt: DilemmaOption, nameOf: NameOf): WinLose {
  return WIN_LOSE_AUTHORED[`${cardId}/${opt.id}`] ?? deriveWinLose(opt, nameOf);
}
