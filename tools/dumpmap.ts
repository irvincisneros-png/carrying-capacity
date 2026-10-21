// Debug: ASCII dump of a scenario's generated terrain. Usage: npx vite-node tools/dumpmap.ts <scenarioId>
import { SCENARIOS, generateTerrain } from '../src/sim';
import { TileKind } from '../src/sim/types';

const id = process.argv[2] as keyof typeof SCENARIOS;
const sc = SCENARIOS[id];
const g = generateTerrain(sc, sc.seed);
const ch: Record<number, string> = {};
for (const [k, v] of Object.entries(TileKind)) if (typeof v === 'number') ch[v] = (k[0] ?? '?').toLowerCase();
ch[TileKind.Land] = '.'; ch[TileKind.Sea] = '~'; ch[TileKind.Rock] = '#'; ch[TileKind.Bush] = 'b'; ch[TileKind.River] = '='; ch[TileKind.Beach] = ',';
let out = '';
for (let y = 0; y < g.h; y++) { for (let x = 0; x < g.w; x++) out += ch[g.kind[y * g.w + x] ?? 0] ?? '?'; out += '\n'; }
console.log(out);
