// SUPERSEDED for the HUD: this WP8 script predates the sidebar rail (it uses the old Learn menu and HUD selectors).
// Use tools/declutter-shots.mjs for screenshots and the overlap check.
// Screenshots and layout checks through the Chrome DevTools Protocol (no Playwright needed).
// usage: node tools/cdp-shots.mjs [outDir]   (server first: npx vite --port 8475)
// env: CHROME=/path/to/chrome  URL=http://localhost:8475/carrying-capacity/
// Takes the WP8 set: Act 1 and Act 2 at four screen sizes (with an overlap check on the HUD, clock, goals and needs
// panels), then the capacity panel, field kit, cause chain, win/lose card, decade report, household and print views.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = process.argv[2] || 'docs/screens';
const URL = process.env.URL || 'http://localhost:8475/carrying-capacity/';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
mkdirSync(OUT, { recursive: true });
const profile = join(tmpdir(), `cc-shots-${Date.now()}`);
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--no-sandbox', '--hide-scrollbars', '--mute-audio', '--window-size=1600,900', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const errors = [];
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
    } catch { /* not up yet */ }
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
async function shot(name) {
  await sleep(700);
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64'));
  console.log('saved', name);
}
async function size(w, h, mobile) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
  await sleep(500);
}

/** Do any of these panels overlap? Returns the pairs that do (more than 2px each way). */
const OVERLAP = `
  const sels = ['.hud-left', '.hud-meters', '.dbars', '.hud-center .clock', '.hud-right', '.rightcol .act1goals', '.rightcol .demand', '.rightcol .nextbtn', '.objectives:not(.act1goals)', '.energy', '.dock .tabs', '.dock .tools', '.act2btns', '.undo'];
  const rects = sels.map((s) => { const e = document.querySelector(s); if (!e || e.classList.contains('hidden')) return null; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return r.width < 2 ? null : { s, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; }).filter(Boolean);
  const out = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j]; const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); if (ox > 2 && oy > 2) out.push(a.s + ' x ' + b.s + ' (' + Math.round(ox) + 'x' + Math.round(oy) + ')'); }
  const noScroll = document.documentElement.scrollWidth <= innerWidth + 1;
  return JSON.stringify({ overlaps: out, noHScroll: noScroll });
`;

try {
  await connect();
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Page.navigate', { url: URL });
  await run(`for (let i = 0; i < 200 && !(window.__cc && window.__cc.renderer); i++) await new Promise(r => setTimeout(r, 300)); return !!window.__cc;`);
  await sleep(3000);
  const sizes = [[1366, 768], [1280, 720], [1600, 900], [375, 812, true]];

  // ---- Act 1 and Act 2 at each size
  for (const [w, h, m] of sizes) {
    await size(w, h, m);
    await run(`const cc = window.__cc; cc.start('coal-coast'); await new Promise(r => setTimeout(r, 1200)); cc.closeModals(); cc.demoTown(2000); cc.closeModals(); cc.speed(0); document.querySelectorAll('.toast').forEach(t => t.remove()); return 1;`);
    await sleep(1500);
    console.log(`Act 1 ${w}x${h}:`, await run(OVERLAP));
    await shot(`wp8-act1-${w}x${h}.png`);
    await run(`const cc = window.__cc; cc.skipToAct2(); cc.closeModals(); document.querySelectorAll('.toast').forEach(t => t.remove()); return 1;`);
    await sleep(1500);
    console.log(`Act 2 ${w}x${h}:`, await run(OVERLAP));
    await shot(`wp8-act2-${w}x${h}.png`);
  }

  // ---- the learning views at 1366x768
  await size(1366, 768);
  await run(`const cc = window.__cc; cc.start('coal-coast'); await new Promise(r => setTimeout(r, 1200)); cc.closeModals(); cc.demoTown(2000); cc.closeModals(); cc.speed(0); document.querySelectorAll('.toast').forEach(t => t.remove()); document.querySelector('[data-qa=capbar]').click(); return 1;`);
  await shot('wp8-capacity-panel.png');
  await run(`window.__cc.closeModals(); document.querySelector('[data-qa=learn-btn]').click(); [...document.querySelectorAll('.learn-item')].find(b => b.textContent.includes('Water field kit')).click(); await new Promise(r => setTimeout(r, 300)); document.querySelector('[data-qa=kit-test]').click(); await new Promise(r => setTimeout(r, 300)); document.querySelector('.kit [data-pred=worse]').click(); return 1;`);
  await shot('wp8-fieldkit.png');
  await run(`document.querySelector('.kit').classList.remove('open'); window.__cc.app.onSimEvents([{ id: 9999, type: 'fish-kill', year: 2000, season: 0, seasonIndex: 0, severity: 1, text: 'Fish kill: warm, polluted water ran short of oxygen and thousands of fish died in the estuary (12 tiles affected). The fishers have lost their catch.' }]); await new Promise(r => setTimeout(r, 400)); return 1;`);
  await shot('wp8-toast-why.png');
  await run(`document.querySelector('.toast.why').click(); return 1;`);
  await shot('wp8-cause-chain.png');
  await run(`window.__cc.closeModals(); document.querySelectorAll('.toast').forEach(t => t.remove()); window.__cc.app.game.nextDecade(); const app = window.__cc.app; app.pendingPhase = false; return 1;`);
  // decade report with the ledger and the why links
  await run(`window.__cc.closeModals(); const app = window.__cc.app; const r = window.__cc.app.game.state; app.showReport({ fromYear: 1990, toYear: 2000, emissionsKt: { power: 450, industry: 235, transport: 16, land: 81, waste: 15 }, totalKt: 797, topSource: 'power', co2Ppm: 398, realCo2Ppm: 369, tempC: 0.9, realTempC: 0.5, deltaCo2: 24, deltaTempC: 0.1, meters: { environment: 36, society: 80, economy: 65 }, meterDeltas: { environment: -2, society: 0, economy: 1 }, population: 1063, income: 338, demand: 'Your town needs: homes.', demandItems: [], fact: null, actComplete: false, cost: { bushLost: 12, bushLeft: 401, creekBefore: 82, creekAfter: 61, airBefore: 75, airAfter: 62, co2Kt: 797, birdsBefore: 410, birdsAfter: 380, fishBefore: 40, fishAfter: 30 } }); return 1;`);
  await run(`document.querySelector('.modal').scrollTop = 520; return 1;`);
  await shot('wp8-decade-why.png');
  await run(`window.__cc.closeModals(); window.__cc.app.pendingPhase = false; return 1;`);

  // ---- a card with "who wins, who loses" (Green Valley)
  await run(`const cc = window.__cc; cc.start('green-valley'); await new Promise(r => setTimeout(r, 1200)); cc.closeModals(); const s = cc.game.state; cc.app.onSimEvents([{ id: 9001, type: 'story', year: 1970, season: 0, seasonIndex: 0, severity: 1, text: 'Jo\\'s neighbour wants to clear the hillside above the creek.', story: { channel: 'dilemma', ref: 'gv-hillside', speakerId: 'jo-marsh', choice: { prompt: 'Clear the hillside for a bigger farm?', options: [{ id: 'clear', label: 'Clear the hillside' }, { id: 'terrace', label: 'Farm only the gentle slope' }, { id: 'leave', label: 'Leave it' }] } } }]); await new Promise(r => setTimeout(r, 800)); return 1;`);
  await shot('wp8-winlose-card.png');
  await run(`window.__cc.closeModals(); window.__cc.app.dilemmaQueue.length = 0; return 1;`);

  // ---- hidden cost tooltip on the solar card (Act 2), field guide, household and print at the end
  await run(`const cc = window.__cc; cc.start('coal-coast'); await new Promise(r => setTimeout(r, 1200)); cc.closeModals(); cc.skipToAct2(); cc.closeModals(); [...document.querySelectorAll('.tab')].find(t => t.textContent.includes('Energy')).click(); await new Promise(r => setTimeout(r, 300)); const card = [...document.querySelectorAll('.tool')].find(t => t.textContent.includes('Solar farm')); card.dispatchEvent(new Event('pointerenter')); return 1;`);
  await shot('wp8-hidden-cost-tip.png');
  await run(`document.querySelector('[data-qa=learn-btn]').click(); [...document.querySelectorAll('.learn-item')].find(b => b.textContent.includes('Field guide')).click(); return 1;`);
  await shot('wp8-field-guide.png');
  await run(`document.querySelectorAll('.drawer.open').forEach(d => d.classList.remove('open')); const a = window.__cc.app; a.game.debugTick(76); a.pendingPhase = false; a.checkPhase(a.game.state); await new Promise(r => setTimeout(r, 800)); return 1;`);
  await shot('wp8-ending.png');
  await run(`document.querySelector('[data-qa=open-household]').click(); await new Promise(r => setTimeout(r, 400)); document.querySelector('#hh-tr-bus').click(); document.querySelector('#hh-wa-shower').click(); return 1;`);
  await shot('wp8-household.png');
  await run(`[...document.querySelectorAll('.modal .btn')].find(b => b.textContent.includes('Print my report')).click(); return 1;`);
  await shot('wp8-print.png');
  await cdp('Emulation.setEmulatedMedia', { media: 'print' });
  await sleep(500);
  const printVis = await run(`const r = (s) => { const e = document.querySelector(s); if (!e) return 'none'; const c = getComputedStyle(e); return c.display + '/' + c.position; }; return JSON.stringify({ app: r('#app'), ui: r('.ui'), bar: r('.print-bar'), sheet: r('.print-sheet'), wrap: r('.print-wrap') });`);
  console.log('print media:', printVis);
  await shot('wp8-print-media.png');
  await cdp('Emulation.setEmulatedMedia', { media: '' });
  console.log('console errors:', errors.length ? errors : 'none');
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
