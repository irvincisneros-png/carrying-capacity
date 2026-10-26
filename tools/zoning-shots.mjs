// Zoning screenshots through CDP (no Playwright). Server first: npx vite --port 8479
// usage: node tools/zoning-shots.mjs models            -> docs/screens/zoning-p1-models.png (model viewer, all grown-building variants)
//        node tools/zoning-shots.mjs game [prefix]      -> Green Valley with zones painted and growing (docs/screens/<prefix>-*.png)
//        node tools/zoning-shots.mjs all [prefix]       -> phase 3: every scenario at 1366x768 and 375x812 with a zoned and grown town
//                                                         (docs/screens/<prefix>-<scenario>-desktop.png / -phone.png), plus the Land per person
//                                                         panel (<prefix>-land-per-person.png) and the sprawl and flats cards (<prefix>-card-*.png)
// env: CHROME=/path/to/chrome  BASE=http://127.0.0.1:8479/carrying-capacity/  ONLY=green-valley,reef-island
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
  } else if (MODE === 'scaffold') {
    // The grow animation: homes zoned in Green Valley, the clock running at 4x, a shot each time a scaffold is on the ground.
    await size(1366, 768);
    await cdp('Page.navigate', { url: BASE });
    await run(`for (let i = 0; i < 200 && !(window.__cc && window.__cc.renderer); i++) await new Promise(r => setTimeout(r, 300)); return !!window.__cc;`);
    await sleep(3000);
    await run(`const cc = window.__cc; cc.start('green-valley'); await new Promise(r => setTimeout(r, 1500)); cc.closeModals(); cc.speed(0); cc.app.renderer.applyTier(+(window.__tier || 2)); await new Promise(r => setTimeout(r, 2500)); return 1;`);
    console.log(await run(`return JSON.stringify(window.__cc.zoneDemo(0));`));
    await run(`document.querySelectorAll('.toast, .bubble').forEach(t => t.remove()); const cc = window.__cc; cc.app.toolbar.select(null); cc.game.state.budget = 900; cc.autoPlace('farm', 3, 0, 0); cc.autoPlace('coalpower', 1, 0, 0); cc.sim.connectAllFree(cc.game.state); cc.speed(4); return 1;`);
    // Close up on the zoned strip, then watch for new grown buildings and shoot while the scaffold is still up.
    await run(`const cc = window.__cc; const s = cc.game.state; const g = s.grid; let n = 0, sx = 0, sy = 0; for (let i = 0; i < g.zoning.length; i++) if (g.zoning[i]) { n++; sx += i % g.w; sy += Math.floor(i / g.w); } const p = cc.app.renderer.tileWorld(Math.round(sx / n), Math.round(sy / n)); cc.app.renderer.rig.focus(p.x, p.z, 18); return n;`);
    let got = 0, last = 0;
    for (let i = 0; i < 400 && got < 2; i++) {
      await sleep(30);
      const n = await run(`return window.__cc.game.state.buildings.filter(b => b.grown).length;`);
      if (n > last) {
        last = n;
        if (process.env.PROBE) { for (let k = 0; k < 6; k++) { console.log('anims', await run(`const b = window.__cc.app.renderer.world.bld; return JSON.stringify({ busy: b.busy, anims: b.anims.map(a => [a.rec.type, +a.t.toFixed(2), a.dir, a.rec.scaf !== undefined]), chunks: b.zc.meshCount, batch: b.batch.count });`)); await sleep(250); } }
        await sleep(+(process.env.GROW_DELAY || 150));
        await run(`window.__cc.closeModals(); document.querySelectorAll('.toast, .bubble').forEach(t => t.remove()); return 1;`);
        const r = await cdp('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(OUT, `${PREFIX}-grow-${++got}.png`), Buffer.from(r.result.data, 'base64'));
        console.log('saved grow', got, 'grown', n);
      }
    }
    console.log('scaffold shots', got);
  } else if (MODE === 'all') {
    await cdp('Page.navigate', { url: BASE });
    await size(1366, 768);
    await run(`for (let i = 0; i < 200 && !(window.__cc && window.__cc.renderer); i++) await new Promise(r => setTimeout(r, 300)); return !!window.__cc;`);
    await sleep(3000);
    const ids = (process.env.ONLY || 'green-valley,coal-coast,river-town,reef-island,red-dirt,net-zero-city').split(',');
    const clean = `document.querySelectorAll('.toast, .bubble').forEach(t => t.remove()); window.__cc.closeModals(); return 1;`;
    for (const sid of ids) {
      await size(1366, 768);
      await run(`const cc = window.__cc; cc.start('${sid}'); await new Promise(r => setTimeout(r, 1500)); cc.closeModals(); cc.speed(0); return 1;`);
      await sleep(1200);
      const out = [];
      for (const step of [0, 1, 2]) {
        out.push(await run(`try { return JSON.stringify(window.__cc.zoneDemo(${step})); } catch (e) { return 'err ' + e.message; }`));
        // Act 2 starts (Net Zero City) grow on the clock: let a few years pass.
        await run(`const cc = window.__cc; if (cc.game.state.phase === 'act2') cc.game.debugTick(4); cc.closeModals(); return 1;`);
      }
      console.log(sid, out.join(' | '));
      await run(`window.__cc.app.toolbar.select(null); return 1;`);
      await run(clean);
      await shot(`${PREFIX}-${sid}-desktop.png`);
      await size(375, 812, true);
      await run(clean);
      await shot(`${PREFIX}-${sid}-phone.png`);
      if (sid === 'green-valley') {
        await size(1366, 768);
        await run(`window.__cc.app.rail.open('needs'); await new Promise(r => setTimeout(r, 400)); document.querySelector('.landstat').scrollIntoView({ block: 'center' }); return 1;`);
        await shot(`${PREFIX}-land-per-person.png`);
        await run(`window.__cc.app.rail.close(); return 1;`);
        for (const card of ['sprawl', 'flats']) {
          const r = await run(`const cc = window.__cc; const s = cc.game.state; const id = s.scenarioId + '-${card}'; const d = cc.sim.getDilemma(s.scenarioId, id); if (!d) return 'no card'; s.dilemmas.decisions = s.dilemmas.decisions.filter(x => x.dilemmaId !== id); delete s.dilemmas.offered[id]; s.dilemmas.pending = s.dilemmas.pending.filter(x => x !== id); cc.sim.fire(s, d); cc.game.flushEvents(); await new Promise(r => setTimeout(r, 1800)); return 'fired';`);
          console.log('card', card, r);
          await shot(`${PREFIX}-card-${card}.png`);
          await run(`const b = [...document.querySelectorAll('.modal button, .modal summary')].find(x => /evidence/i.test(x.textContent)); if (b) b.click(); return 1;`);
          await shot(`${PREFIX}-card-${card}-evidence.png`);
          await run(`window.__cc.closeModals(); return 1;`);
        }
      }
    }
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
    // Hover over a waiting tile with the Homes zone tool to read why it is waiting.
    const hv = await run(`const cc = window.__cc; const s = cc.game.state; const codes = cc.sim.zoneReasons(s); let best = -1; for (let i = 0; i < codes.length; i++) { if (codes[i] === cc.sim.REASON.noDemand || codes[i] === cc.sim.REASON.noPower) { best = i; break; } } if (best < 0) return 'none'; const tx = best % s.grid.w, ty = Math.floor(best / s.grid.w); cc.app.toolbar.select('zonehomes'); const p = cc.app.renderer.tileWorld(tx, ty); const q = cc.app.renderer.project(p.x, p.y, p.z); return JSON.stringify({ x: q.x, y: q.y, code: codes[best] });`);
    console.log('hover', hv);
    if (hv !== 'none') {
      const { x, y } = JSON.parse(hv);
      await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await sleep(300);
      await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + 1, y: y + 1 });
      await shot(`${PREFIX}-4-hover-reason.png`);
    }
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
