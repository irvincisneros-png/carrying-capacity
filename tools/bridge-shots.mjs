// Bridge screenshots through the Chrome DevTools Protocol: Green Valley's start (entrance road and creek) and a player-built bridge.
// usage: node tools/bridge-shots.mjs [outDir]   (server first: npx vite --port 8477; URL=http://localhost:8477/carrying-capacity/)
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
const PORT = 9334;
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


// Put the camera `off` (x, y, z world units) from tile (tx, ty) looking at the deck, so the bridge is close and from a chosen side.
const focus = (tx, ty, off) => `const cc = window.__cc; const rig = cc.app.renderer.rig; const m = cc.app.renderer.world.map; const x = m.cx(${tx}), z = m.cz(${ty}); const o = [${off}]; rig.controls.target.set(x, 0.2, z); rig.camera.position.set(x + o[0], 0.2 + o[1], z + o[2]); rig.fly = null; rig.controls.update(); cc.render(); await new Promise(r => setTimeout(r, 2500)); return 1;`;
try {
  await connect();
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  // force the Medium tier (headless software GL would otherwise pick Very low)
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('cc.graphics.v2', JSON.stringify({ mode: 'manual', tier: ${+(process.env.TIER ?? 2)}, outlines: 'subtle' })); localStorage.setItem('cc.tutorial.done', '1');` });
  await cdp('Page.navigate', { url: URL });
  await run(`for (let i = 0; i < 200 && !(window.__cc && window.__cc.renderer); i++) await new Promise(r => setTimeout(r, 300)); return !!window.__cc;`);
  await sleep(3000);
  const scenario = process.env.SCENARIO || 'green-valley';
  await run(`const cc = window.__cc; cc.start('${scenario}'); await new Promise(r => setTimeout(r, 1500)); cc.closeModals(); cc.speed(0); document.querySelectorAll('.toast').forEach(t => t.remove()); return 1;`);
  if (process.env.BUILD) {
    // a player-built bridge: homes north of the creek, a farm south of it, the road tool laid over the water between them
    console.log(await run(`const cc = window.__cc; const S = cc.sim; const g = cc.game; g.state.budget = 5000; g.state.year = 1960;
      const put = (b, x, y) => g.dispatch({ type: 'place', building: b, x, y, rotation: 0 });
      const out = [];
      for (const [x, y] of [[8, 8], [10, 8], [6, 8]]) out.push(put('cottage', x, y).ok);
      out.push(put('farm', 7, 15).ok);
      for (let y = 9; y <= 14; y++) out.push(put('road', 8, y).ok);
      for (let k = 0; k < 6; k++) for (const b of g.state.buildings.filter((o) => o.type !== 'road')) { const r = S.roadRoute(g.state, b.uid); if (r) for (const i of r) g.dispatch({ type: 'place', building: 'road', x: i % g.state.grid.w, y: Math.floor(i / g.state.grid.w), rotation: 0 }); }
      const acc = S.roadAccess(g.state); const bridges = g.state.buildings.filter((b) => b.type === 'road' && g.state.grid.kind[b.y * g.state.grid.w + b.x] === 3).map((b) => b.x + ',' + b.y);
      g.setSpeed(2); return JSON.stringify({ out, unconnected: acc.unconnected.length, bridges });`));
    await sleep(8000);
  }
  const at = (process.env.AT || '14,10').split(',').map(Number);
  await run(focus(at[0], at[1], process.env.CAM || '2.2,1.6,2.2'));
  if (process.env.EVAL) console.log(await run(process.env.EVAL));
  await shot(process.env.NAME || 'bridge-start-creek.png');
  console.log('console errors:', errors.length ? errors : 'none');
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
