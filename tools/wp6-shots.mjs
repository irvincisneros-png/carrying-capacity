// WP6 screenshots: each scenario at its start and one mid-game, at 1366x768, into docs/screens/wp6-*.png.
// Usage: npx vite --port 8474   (in another terminal), then
//   PLAYWRIGHT_CORE_DIR=/dir/with/node_modules CHROME=/path/to/chrome-headless-shell node tools/wp6-shots.mjs [scenario ...]
// Software GL (SwiftShader), so each frame takes a few seconds; the tier is forced to Medium (2) for the look of the game.
import { createRequire } from 'node:module';
const require = createRequire((process.env.PLAYWRIGHT_CORE_DIR || process.cwd()) + '/');
const { chromium } = require('playwright-core');

const URL = process.env.URL || 'http://127.0.0.1:8474/carrying-capacity/';
const TIER = +(process.env.TIER ?? 2);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['green-valley', 'coal-coast', 'river-town', 'red-dirt', 'reef-island', 'net-zero-city'];
const OUT = process.env.OUT || 'docs/screens';

const browser = await chromium.launch({
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
await ctx.addInitScript((t) => {
  localStorage.setItem('cc.graphics.v2', JSON.stringify({ mode: 'manual', tier: t, outlines: 'subtle' }));
  // skip the tutorial and onboarding so the shot shows the game, not a card
  try { localStorage.setItem('cc.tutorial.done', '1'); } catch { /* ignore */ }
}, TIER);
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__cc && window.__cc.renderer && window.__cc.renderer.stats.calls > 0, null, { timeout: 120000 });

const settle = async (ms = 6000) => {
  await page.evaluate(() => { window.__cc.closeModals(); });
  await page.waitForTimeout(ms);
};
const shot = async (name) => {
  await page.evaluate(() => { const c = window.__cc; c.closeModals(); c.renderer.rig?.update(5); c.render(); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/wp6-${name}.png` });
  console.log('wrote', name);
};

// title backdrop first
await settle(5000);
await page.screenshot({ path: `${OUT}/wp6-title.png` });
console.log('wrote title');

for (const id of ids) {
  await page.evaluate((id) => { const c = window.__cc; c.start(id); c.closeModals(); }, id);
  await settle(7000);
  await shot(`${id}-start`);
  const info = await page.evaluate((id) => {
    const c = window.__cc;
    try {
      if (c.game.state.phase === 'act1') { c.demoTown(2000); c.demoAct2(10); } else { c.game.state.budget = Math.max(c.game.state.budget, 3000); c.demoAct2(12); }
    } catch (e) { return 'err ' + e.message; }
    // a few more of the common Act 2 builds so the picture is a town and not a bare map
    for (const t of ['solarfarm', 'windfarm', 'nursery', 'wetland', 'rooftopsolar']) { try { c.autoPlace(t, 4, 0, 0); } catch { /* ignore */ } }
    c.game.setSpeed(0);
    c.closeModals();
    const s = c.game.state;
    return `${s.phase} ${s.year} ${s.grid.w}x${s.grid.h} buildings ${s.buildings.length}`;
  }, id);
  console.log(id, info);
  await page.evaluate(() => { window.__cc.app.renderer.frameTown(false); });
  await settle(7000);
  await shot(`${id}-mid`);
}
console.log('errors:', JSON.stringify(errs.slice(0, 8)));
await browser.close();
