// Scratch: summarise a .cpuprofile by self time per function. Usage: node tools/profsum.mjs file.cpuprofile [top]
import { readFileSync } from 'node:fs';
const p = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const top = +(process.argv[3] || 25);
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const self = new Map();
const dt = p.timeDeltas;
for (let i = 0; i < p.samples.length; i++) self.set(p.samples[i], (self.get(p.samples[i]) || 0) + (dt[i] || 0));
const agg = new Map();
for (const [id, t] of self) {
  const n = byId.get(id);
  const f = n.callFrame;
  const key = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/')}:${f.lineNumber}`;
  agg.set(key, (agg.get(key) || 0) + t);
}
const total = [...agg.values()].reduce((a, b) => a + b, 0);
for (const [k, t] of [...agg].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log((t / 1000).toFixed(0).padStart(7), 'ms', ((100 * t) / total).toFixed(1).padStart(5) + '%', k);
