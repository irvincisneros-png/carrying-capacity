// Declutter screenshots + overlap check through CDP (no Playwright). Server first: npx vite --port 8478
// usage: node tools/declutter-shots.mjs <prefix> [--check]   e.g. declutter-before / declutter-after
// env: CHROME=/path/to/chrome  URL=http://localhost:8478/carrying-capacity/
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PREFIX = process.argv[2] || 'declutter-after';
const CHECK = process.argv.includes('--check');
const OUT = 'docs/screens';
const URL = process.env.URL || 'http://localhost:8478/carrying-capacity/';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9344;
mkdirSync(OUT, { recursive: true });
const profile = join(tmpdir(), `cc-declutter-${Date.now()}`);
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
async function shot(name) { await sleep(600); const r = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64')); console.log('saved', name); }
async function size(w, h, mobile) { await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile }); await sleep(500); }

// Bounding boxes of every visible piece of in-game UI; reports pairs that overlap by more than 2px each way.
const OVERLAP = `
  const sels = ['.hud-left', '.hud-meters', '.hud .clock', '.urgentchip', '.rail', '.morebtn', '.railhost > .open', '.dock .tabs', '.dock .tools', '.dock .undo', '.tutorial', '.guidepill', '.toasts .toast', '.toast.banner'];
  const rects = [];
  for (const s of sels) for (const e of document.querySelectorAll(s)) {
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    rects.push({ s, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
  }
  const out = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.s === b.s && a.s === '.railhost > .open') continue;
    if ((a.s === '.hud .clock' && b.s === '.urgentchip') || (a.s === '.urgentchip' && b.s === '.hud .clock')) continue; // the chip lives inside the clock panel
    if (innerWidth <= 700 && (a.s === '.railhost > .open' || b.s === '.railhost > .open' || a.s === '.rail' || b.s === '.rail') && /dock|morebtn|tutorial|guidepill|toast/.test(a.s + b.s)) continue; // a phone drawer / More sheet is a bottom sheet over the toolbar
    const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (ox > 2 && oy > 2) out.push(a.s + ' x ' + b.s + ' (' + Math.round(ox) + 'x' + Math.round(oy) + ')');
  }
  const off = rects.filter((r) => r.x0 < -1 || r.y0 < -1 || r.x1 > innerWidth + 1 || r.y1 > innerHeight + 1).map((r) => r.s);
  const dock = document.querySelector('.dock .tools')?.getBoundingClientRect();
  const free = dock ? Math.round(((innerHeight - dock.height - 90) * (innerWidth)) / (innerWidth * innerHeight) * 100) : 0;
  return JSON.stringify({ overlaps: out, offscreen: off, noHScroll: document.documentElement.scrollWidth <= innerWidth + 1, panels: rects.length });
`;

const CASES = [
  { name: 'gv-1960', setup: `cc.start('green-valley'); await new Promise(r => setTimeout(r, 1200)); cc.closeModals();` },
  { name: 'gv-1990', setup: `cc.start('green-valley'); await new Promise(r => setTimeout(r, 1200)); cc.closeModals(); cc.demoTown(1990); cc.closeModals();` },
  { name: 'coal-2000', setup: `cc.start('coal-coast'); await new Promise(r => setTimeout(r, 1200)); cc.closeModals(); cc.demoTown(2000); cc.closeModals();` },
  { name: 'river-act2', setup: `cc.start('river-town'); await new Promise(r => setTimeout(r, 1200)); cc.closeModals(); cc.skipToAct2(); cc.closeModals();` },
  { name: 'netzero-act2', setup: `cc.start('net-zero-city'); await new Promise(r => setTimeout(r, 1200)); cc.closeModals(); cc.skipToAct2(); cc.closeModals();` },
];
const SIZES = [[1366, 768], [375, 812, true], [1280, 720], [1600, 900], [1920, 1080]];
const SHOT_SIZES = new Set(['1366x768', '375x812']);
const clean = `document.querySelectorAll('.toast, .bubble').forEach(t => t.remove()); return 1;`;

try {
  await connect();
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Page.navigate', { url: URL });
  await run(`for (let i = 0; i < 200 && !(window.__cc && window.__cc.renderer); i++) await new Promise(r => setTimeout(r, 300)); return !!window.__cc;`);
  await sleep(3000);
  for (const c of CASES) {
    await size(1366, 768);
    await run(`const cc = window.__cc; ${c.setup} cc.speed(0); return 1;`);
    await sleep(1200);
    for (const [w, h, m] of SIZES) {
      await size(w, h, m);
      await run(`window.dispatchEvent(new Event('resize')); ` + clean);
      await sleep(700);
      if (CHECK) console.log(`${c.name} ${w}x${h}:`, await run(OVERLAP));
      if (SHOT_SIZES.has(`${w}x${h}`)) await shot(`${PREFIX}-${c.name}-${w}x${h}.png`);
      if (CHECK) {
        // three events at once: at most two toasts may show, bottom-left, clear of the toolbar and the clock
        await run(`const e = (i, t) => ({ id: 9000 + i, type: t, year: 2000, season: 0, seasonIndex: 0, severity: 1, text: 'Event ' + i + ': a short note about what happened in the town.' }); window.__cc.app.onSimEvents([e(1, 'heatwave'), e(2, 'flood'), e(3, 'bushfire')]); return 1;`);
        await sleep(500);
        const n = await run(`return document.querySelectorAll('.toasts .toast').length;`);
        console.log(`${c.name} ${w}x${h} toasts=${n}:`, await run(OVERLAP));
        if (SHOT_SIZES.has(`${w}x${h}`) && c.name === 'coal-2000') await shot(`${PREFIX}-${c.name}-toasts-${w}x${h}.png`);
        await run(clean);
        // every rail button in turn: opens one drawer, and the drawer clears the toolbar and the other panels
        const ids = await run(`return JSON.stringify([...document.querySelectorAll('.rail [data-rail]')].filter(b => !b.classList.contains('hidden')).map(b => b.dataset.rail));`);
        const bad = [];
        for (const rid of JSON.parse(ids)) {
          if (['frame', 'settings', 'household'].includes(rid)) continue;
          await run(`if (innerWidth <= 700 && !document.querySelector('.rail.sheet-open')) document.querySelector('.morebtn').click(); document.querySelector('.rail [data-rail="${rid}"]').click(); await new Promise(r => setTimeout(r, 450)); return 1;`);
          const o = JSON.parse(await run(OVERLAP));
          const open = await run(`return document.querySelectorAll('.railhost > .open').length;`);
          if (o.overlaps.length || o.offscreen.length || open !== 1) bad.push({ rid, open, ...o });
        }
        await run(`window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'})); return 1;`);
        console.log(`${c.name} ${w}x${h} every-drawer:`, bad.length ? JSON.stringify(bad) : 'ok');
      }
      if (CHECK && w === 375 && c.name === 'gv-1990') {
        await run(`document.querySelector('.morebtn').click(); await new Promise(r => setTimeout(r, 300)); return 1;`);
        console.log(`${c.name} ${w}x${h} more-sheet:`, await run(OVERLAP));
        await shot(`${PREFIX}-${c.name}-more-sheet-375x812.png`);
        await run(`window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'})); return 1;`);
      }
      if (SHOT_SIZES.has(`${w}x${h}`) && CHECK && (c.name === 'gv-1990' || c.name === 'netzero-act2')) {
        const opened = await run(`const b = document.querySelector('.rail [data-rail="goals"]') ?? document.querySelector('.morebtn'); if (!b) return 'no-rail'; b.click(); if (document.querySelector('.morebtn') && !document.querySelector('.rail [data-rail]')) { const g = document.querySelector('.moresheet [data-rail="goals"]'); g && g.click(); } await new Promise(r => setTimeout(r, 400)); return 'ok';`);
        if (opened === 'ok') {
          console.log(`${c.name} ${w}x${h} drawer:`, await run(OVERLAP));
          await shot(`${PREFIX}-${c.name}-drawer-${w}x${h}.png`);
          await run(`document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'})); window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'})); return 1;`);
        }
      }
    }
  }
  console.log('console errors:', errors.length ? errors : 'none');
} finally {
  try { ws?.close(); } catch { /* */ }
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* */ }
}
