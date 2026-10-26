// Zoning screenshots through CDP (no Playwright). Server first: npx vite --port 8479
// usage: node tools/zoning-shots.mjs models            -> docs/screens/zoning-p1-models.png (model viewer, all grown-building variants)
//        node tools/zoning-shots.mjs game [prefix]      -> Green Valley with zones painted and growing (docs/screens/<prefix>-*.png)
// env: CHROME=/path/to/chrome  BASE=http://127.0.0.1:8479/carrying-capacity/
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MODE = process.argv[2] || 'game';
const PREFIX = process.argv[3] || 'zoning-p1';
const OUT = process.env.OUT || 'docs/screens';
const BASE = process.env.BASE || 'http://127.0.0.1:8479/carrying-capacity/';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9355;
mkdirSync(OUT, { recursive: true });
const profile = join(tmpdir(), `cc-zoning-${Date.now()}`);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--no-sandbox', '--hide-scrollbars', '--mute-audio', '--window-size=1600,900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const errors = [];
async function connect() {
  for (let i = 0; i < 60; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const page = list.find((t) => t.type === 'page'); if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; } } catch { /* */ }
    await sleep(500);
  }
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.slice(0, 300) ?? 'exception');
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
  };
}
const cdp = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const run = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'eval failed');
  return r.result?.result?.value;
};
async function shot(name) { await sleep(700); const r = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64')); console.log('saved', name); }
async function size(w, h, mobile) { await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile }); await sleep(400); }

try {
  await connect();
  await cdp('Runtime.enable'); await cdp('Page.enable');
  if (MODE === 'models') {
    await size(1500, 900);
    await cdp('Page.navigate', { url: BASE + 'modelviewer.html?' + (process.env.ONLY ? 'only=' + process.env.ONLY + '&row=' + (process.env.ROW || 8) : 'only=zres1,zres2,zres3,zcom,zind&row=22') + '' });
    await sleep(6000);
    await shot(`${PREFIX}-models.png`);
  } else {
    await size(1366, 768);
    await cdp('Page.navigate', { url: BASE });
    await run(`for (let i = 0; i < 200 && !(window.__cc && window.__cc.renderer); i++) await new Promise(r => setTimeout(r, 300)); return !!window.__cc;`);
    await sleep(3000);
    await run(`const cc = window.__cc; cc.start('green-valley'); await new Promise(r => setTimeout(r, 1500)); cc.closeModals(); cc.speed(0); return 1;`);
    await sleep(1500);
    // Paint zones the way a player would: homes beside the road, then shops, then let the years run.
    const info = await run(`return JSON.stringify(window.__cc.zoneDemo ? window.__cc.zoneDemo(0) : 'no zoneDemo');`);
    console.log('step 0', info);
    await run(`document.querySelectorAll('.toast, .bubble').forEach(t => t.remove()); return 1;`);
    await shot(`${PREFIX}-1-zoned.png`);
    console.log('step 1', await run(`return JSON.stringify(window.__cc.zoneDemo(1));`));
    if (process.env.EVAL) console.log('eval1', await run(process.env.EVAL));
    await run(`document.querySelectorAll('.toast, .bubble').forEach(t => t.remove()); window.__cc.closeModals(); return 1;`);
    await shot(`${PREFIX}-2-growing.png`);
    console.log('step 2', await run(`return JSON.stringify(window.__cc.zoneDemo(2));`));
    await run(`document.querySelectorAll('.toast, .bubble').forEach(t => t.remove()); window.__cc.closeModals(); return 1;`);
    await shot(`${PREFIX}-3-town.png`);

  }
  console.log('console errors:', errors.length ? errors : 'none');
} finally {
  try { ws?.close(); } catch { /* */ }
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* */ }
}
