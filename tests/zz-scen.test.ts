import { it } from 'vitest';
import { objectiveStatus } from '../src/sim';
import type { GameState } from '../src/sim';
import { reefThoughtful } from './helpers/reef';
import { redThoughtful } from './helpers/outback';
import { riverThoughtful } from './helpers/river';
import { cityThoughtful } from './helpers/city';
import { coalThoughtful } from './helpers/fullplay';

const WHICH = process.env.SCEN ?? 'reef';

function show(label: string, a1: GameState | null, e: GameState): void {
  const t: Record<string, number> = {};
  for (const b of e.buildings) t[b.type] = (t[b.type] ?? 0) + 1;
  if (a1) console.log(`ZZ ${label} a1 bud ${Math.round(a1.budget)} pop ${a1.population} cum ${Math.round(a1.cumulativeKt)} meters ${JSON.stringify(a1.meters)}`);
  console.log(`ZZ ${label} end ${e.phase} ${e.year} temp ${e.tempC.toFixed(2)} bud ${Math.round(e.budget)}`);
  console.log(`ZZ ${label} fail ${JSON.stringify(e.a2.failure)}`);
  console.log(`ZZ ${label} obj ${JSON.stringify(objectiveStatus(e).map((o) => `${o.id}:${o.status}:${o.current}`))}`);
  console.log(`ZZ ${label} bld ${JSON.stringify(t)}`);
  console.log(`ZZ ${label} yearly ${e.a2.yearly.filter((y) => y.year % 5 === 0).map((y) => `${y.year}:soc${Math.round(y.meters.society)}:eco${Math.round(y.meters.economy)}:un${y.unmetFrac.toFixed(2)}:bud${Math.round(y.budget)}`).join(' ')}`);
  console.log(`ZZ ${label} badyears ${e.a2.yearly.filter((y) => y.year > 2025 && y.unmetFrac > 0.02).length}`);
}

it('scen', () => {
  if (WHICH === 'reef') { const r = reefThoughtful(); show('reef', r.act1, r.end); }
  if (WHICH === 'red') { const r = redThoughtful(); show('red', r.act1, r.end); }
  if (WHICH === 'river') { const r = riverThoughtful(); show('river', r.act1, r.end); }
  if (WHICH === 'coal') { const r = coalThoughtful(); show('coal', r.act1, r.end); console.log('ZZ coal badlist', r.end.a2.yearly.filter((y) => y.year > 2025 && y.unmetFrac > 0.02).map((y) => `${y.year}:${y.unmetFrac.toFixed(2)}`).join(' ')); }
  if (WHICH === 'city') { const e = cityThoughtful(); show('city', null, e); }
});
