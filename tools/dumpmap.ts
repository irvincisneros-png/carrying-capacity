// Debug: ASCII dump of a scenario's generated terrain. Usage: npx vite-node tools/dumpmap.ts <scenarioId> [--game]
// With --game the new game's roads are drawn: + road, # bridge (road on water), E entrance, B other building.
import { SCENARIOS, createGame, generateTerrain, entranceList } from '../src/sim';
import { TileKind } from '../src/sim/types';

const id = process.argv[2] as keyof typeof SCENARIOS;
const game = process.argv.includes('--game');
const sc = SCENARIOS[id];
const st = game ? createGame(id) : null;
const g = st ? st.grid : generateTerrain(sc, sc.seed);
const ch: Record<number, string> = {};
for (const [k, v] of Object.entries(TileKind)) if (typeof v === 'number') ch[v] = (k[0] ?? '?').toLowerCase();
ch[TileKind.Land] = '.'; ch[TileKind.Sea] = '~'; ch[TileKind.Rock] = 'R'; ch[TileKind.Bush] = 'b'; ch[TileKind.River] = '='; ch[TileKind.Beach] = ',';
const ent = st ? new Set(entranceList(st)) : new Set<number>();
let out = '';
for (let y = 0; y < g.h; y++) {
  for (let x = 0; x < g.w; x++) {
    const i = y * g.w + x;
    let c = ch[g.kind[i] ?? 0] ?? '?';
    if (st && (g.building[i] ?? 0) !== 0) {
      const b = st.buildings.find((o) => o.uid === g.building[i]);
      c = b?.type === 'road' ? (g.kind[i] === TileKind.River ? '#' : '+') : 'B';
      if (ent.has(i)) c = 'E';
    }
    out += c;
  }
  out += '\n';
}
console.log(out);
