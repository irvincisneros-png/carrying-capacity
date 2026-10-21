// A/B the software-GL proxy on two builds, back to back (so host load hits both alike).
// usage: node tools/perf-proxy/ab.mjs <baseUrl> <newUrl> <scenario,scenario> <tier,tier> [rounds]
// Needs the same environment as bench.mjs (PLAYWRIGHT_CORE_DIR, CHROME) and both builds served (vite preview).
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const [baseUrl, newUrl, scns, tiers, rounds = '1'] = process.argv.slice(2);
const bench = join(dirname(fileURLToPath(import.meta.url)), 'bench.mjs');
const run = (scn, tier, url) => new Promise((res) => {
  execFile('node', [bench, scn, tier, `/tmp/ab-${scn}-${tier}.json`, url], { maxBuffer: 1e8, env: process.env }, (err, out) => {
    const line = String(out).trim().split('\n').filter((l) => l.startsWith('{')).slice(-1)[0];
    try { res(JSON.parse(line)); } catch { res(null); }
  });
});
for (let r = 0; r < +rounds; r++) {
  for (const scn of scns.split(',')) {
    for (const tier of tiers.split(',')) {
      for (const [label, url] of [['base', baseUrl], ['new ', newUrl]]) {
        const j = await run(scn, tier, url);
        if (!j) { console.log(scn, tier, label, 'failed'); continue; }
        console.log(scn.padEnd(14), 'tier', tier, label, `${j.info.w}x${j.info.h} items ${j.info.items}`.padEnd(22), `pan ${j.pan.fps} fps (1% ${j.pan.low1})`.padEnd(24), `4x ${j.fast.fps} fps`.padEnd(14), `calls ${j.pan.calls} tris ${Math.round(j.pan.tris / 1000)}k cpu ${j.pan.cpuMs}ms`);
      }
    }
  }
}
