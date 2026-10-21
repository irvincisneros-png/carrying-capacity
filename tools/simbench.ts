// Scratch: per-season sim cost on each scenario. Usage: npx vite-node tools/simbench.ts
import { advanceDecade, createGame, SCENARIO_IDS, startAct2, tick } from '../src/sim';
import type { GameState } from '../src/sim';

for (const id of SCENARIO_IDS) {
  let s: GameState = createGame(id);
  const t0 = performance.now();
  if (s.phase === 'act1') {
    let n = 0;
    while (s.phase === 'act1' && n++ < 30) s = advanceDecade(s).state;
    const t1 = performance.now();
    console.log(id, s.grid.w, 'act1 decades', n, `${((t1 - t0) / Math.max(1, n)).toFixed(0)} ms/decade`);
    if (s.phase === 'turning-point') s = startAct2(s);
  }
  const a0 = performance.now();
  let seasons = 0;
  while (s.phase === 'act2' && seasons < 80) { s = tick(s, 0.25).state; seasons++; }
  const a1 = performance.now();
  console.log(id, 'act2 seasons', seasons, `${((a1 - a0) / Math.max(1, seasons)).toFixed(1)} ms/season`);
}
