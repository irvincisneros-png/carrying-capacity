// usage: node tools/perf-proxy/bench.mjs <scenario> <tier 0-4|auto> [out.json] [url]   (env: SECS, WARM, THROTTLE)
// Software-GL performance proxy for a school Chromebook (see docs/reviews/perf-chromebook-proxy.md).
// Needs playwright-core and a Chromium (set CHROME=/path/to/chrome-headless-shell, or PLAYWRIGHT_CORE_DIR=/dir/with/node_modules).
// Serve the build first:  npx vite build && npx vite preview --host 127.0.0.1 --port 8462 --strictPort
import { createRequire } from 'node:module';
const require = createRequire((process.env.PLAYWRIGHT_CORE_DIR || process.cwd()) + '/');
const { chromium } = require('playwright-core');
import { writeFileSync } from 'node:fs';
const [scn, tierArg, out, urlArg] = process.argv.slice(2);
// BASE=1 benchmarks an older (pre-'Very low', graphics key v1) build served on :8471
const BASE = !!process.env.BASE;
const URL = urlArg || (BASE ? 'http://127.0.0.1:8471/carrying-capacity/' : 'http://127.0.0.1:8462/');
const SECS = +(process.env.SECS || 10);
const WARM = +(process.env.WARM ?? 12);
const bin = process.env.CHROME || undefined;
const browser = await chromium.launch({ ...(bin ? { executablePath: bin } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'.replace('--disable-frame-rate-limit','--no-sandbox')] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.THROTTLE || 6) });
// pre-seed prefs
if (tierArg !== 'auto') await page.addInitScript(([t, key]) => { localStorage.setItem(key, JSON.stringify({ mode: 'manual', tier: +t, outlines: 'subtle' })); }, [BASE ? +tierArg - 1 : +tierArg, BASE ? 'cc.graphics.v1' : 'cc.graphics.v2']);
else await page.addInitScript(() => { localStorage.removeItem('cc.graphics.v2'); localStorage.removeItem('cc.graphics.v1'); });
const t0 = Date.now();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__cc && window.__cc.renderer && window.__cc.renderer.stats.calls > 0, null, { timeout: 120000 });
const ttfi = Date.now() - t0;
const gpu = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
// start scenario & populate
const info = await page.evaluate(async (scn) => {
  const cc = window.__cc;
  cc.start(scn);
  cc.closeModals();
  // generic populate
  const g = cc.game;
  let note = g.state.phase;
  try { if (g.state.phase === 'act1') { cc.demoTown(2030); note += '>' + cc.demoAct2(8); } } catch (e) { note += ' err:' + e.message; }
  g.state.budget = Math.max(g.state.budget, 5000);
  const types = ['road','cottage','suburb','farm','solarfarm','windfarm','battery','nursery','wetland','rooftopsolar','apartment','park','school','market','rail','coalpower','factory','coalmine','carpark','port'];
  for (const t of types) { try { cc.autoPlace(t, 6, 0, 0); } catch {} }
  try { g.debugTick(6); } catch (e) { note += ' tickerr:' + e.message; }
  cc.closeModals();
  g.setSpeed(0);
  const s = g.state;
  return { note, phase: s.phase, year: s.year, w: s.grid.w, h: s.grid.h, items: (s.items||s.buildings||[]).length };
}, scn);
await page.waitForTimeout(3000); // let deferred rebuilds settle and auto-tier sample
if (WARM > 0) await warmup(WARM);
// Profiling aids: LIST=1 prints the scene's named objects with triangle / instance counts; HIDE=a,b,c* takes the named
// objects (trailing * = prefix match) out of the camera's layers (not just .visible, which layer rebuilds reset) before measuring.
if (process.env.LIST) console.error(JSON.stringify(await page.evaluate(() => { const out = []; window.__cc.renderer.scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh || o.isBatchedMesh) { const g = o.geometry; out.push([o.name || o.type, o.isInstancedMesh ? o.count : (o.isBatchedMesh ? 'batch' : 1), g && g.index ? (g.index.count / 3) | 0 : (g && g.attributes.position ? (g.attributes.position.count / 3) | 0 : 0), o.visible]); } }); return out; })));
if (process.env.HIDE) await page.evaluate((names) => { window.__cc.renderer.scene.traverse((o) => { if (names.some((n) => o.name === n || (n.endsWith('*') && o.name.startsWith(n.slice(0, -1))))) o.layers.set(31); }); }, process.env.HIDE.split(','));
// NODEF=CC_SWAY,CC_ANIM: experiment, drops those shader defines from every material (forces a recompile) to price a shader feature.
if (process.env.NODEF) await page.evaluate((defs) => { for (const m of window.__cc.renderer.lib.all()) { for (const d of defs) if (m.defines && d in m.defines) delete m.defines[d]; m.needsUpdate = true; } }, process.env.NODEF.split(','));
const tierAfterSettle = await page.evaluate(() => window.__cc.renderer.stats.tier);
const auto0 = await page.evaluate(() => window.__cc.renderer.stats.auto);
async function warmup(secs) {
  // SwiftShader JIT-compiles every new shader/state combination on first use: move the camera + run time so the
  // timed windows measure steady state, not compile hitches
  await page.evaluate(async (secs) => { const cc = window.__cc; const rig = cc.renderer.rig; cc.speed(4); rig.idleSpin = 0.5; rig.setKey('KeyW', true); await new Promise((r) => setTimeout(r, secs * 1000)); rig.setKey('KeyW', false); rig.idleSpin = 0; cc.speed(0); }, secs);
}
async function measure(speed) {
  return page.evaluate(async ({ secs, speed }) => {
    const cc = window.__cc; const r = cc.renderer; const rig = r.rig;
    cc.speed(speed);
    rig.idleSpin = 0.35;
    const keys = ['KeyW','KeyD','KeyS','KeyA'];
    let ki = 0; rig.setKey(keys[0], true);
    const dts = []; let maxCalls = 0, maxTris = 0; const t0 = performance.now(); let last = t0; let ks = t0;
    await new Promise((res) => {
      const step = (now) => {
        dts.push(now - last); last = now;
        maxCalls = Math.max(maxCalls, r.stats.calls); maxTris = Math.max(maxTris, r.stats.triangles);
        if (now - ks > 1500) { rig.setKey(keys[ki], false); ki = (ki + 1) % 4; rig.setKey(keys[ki], true); ks = now; }
        if (now - t0 < secs * 1000) requestAnimationFrame(step); else res();
      }; requestAnimationFrame(step);
    });
    keys.forEach((k) => rig.setKey(k, false)); rig.idleSpin = 0; cc.speed(0);
    dts.shift();
    const total = dts.reduce((a, b) => a + b, 0);
    const sorted = [...dts].sort((a, b) => b - a);
    const n1 = Math.max(1, Math.ceil(dts.length * 0.01));
    const low1 = n1 / (sorted.slice(0, n1).reduce((a, b) => a + b, 0) / 1000);
    return { fps: +(dts.length / (total / 1000)).toFixed(1), low1: +low1.toFixed(1), worstMs: +sorted[0].toFixed(0), frames: dts.length, calls: maxCalls, tris: maxTris, tier: r.stats.tier, dpr: r.renderer.getPixelRatio(), cpuMs: +r.stats.cpuMs.toFixed(1) };
  }, { secs: SECS, speed });
}
const pan = await measure(1);
const fast = await measure(4);
const res = { scn, tierArg, gpu, ttfiMs: ttfi, info, tierAfterSettle, auto: auto0, pan, fast, errs };
console.log(JSON.stringify(res));
if (out) writeFileSync(out, JSON.stringify(res, null, 1));
await browser.close();
