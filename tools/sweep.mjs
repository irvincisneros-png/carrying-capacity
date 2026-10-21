// Scratch: run a vite-node script under many env combos in parallel. Usage: node tools/sweep.mjs script.ts '{"A":[1,2],"B":[3]}'
import { execFile } from 'node:child_process';

const script = process.argv[2];
const grid = JSON.parse(process.argv[3]);
const par = Number(process.argv[4] ?? 4);
const keys = Object.keys(grid);
const combos = [{}];
for (const k of keys) {
  const next = [];
  for (const c of combos) for (const v of grid[k]) next.push({ ...c, [k]: String(v) });
  combos.length = 0;
  combos.push(...next);
}
let i = 0;
const run = () => {
  const c = combos[i++];
  if (!c) return Promise.resolve();
  return new Promise((res) => {
    execFile('npx', ['vite-node', script], { env: { ...process.env, ...c }, maxBuffer: 1e8 }, (err, out) => {
      const last = String(out).trim().split('\n').slice(-1)[0];
      console.log(JSON.stringify(c), last);
      res();
    });
  }).then(run);
};
await Promise.all(Array.from({ length: par }, run));
