// On-screen controls + performance overlay (plain DOM).
import { STYLES, type StyleId } from './styles';
import type { Quality } from './post';

export interface HudStats {
  fps: number; frameMs: number; cpuMs: number; calls: number; triangles: number; geometries: number; textures: number; programs: number; quality: string;
}

export interface HudHandlers {
  onStyle(i: StyleId): void;
  onQuality(q: Quality): void;
  onRestore(t: number): void;
  onPlay(): void;
}

const CSS = `
.lab-hud{position:fixed;inset:0;pointer-events:none;font:12px/1.35 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#f4efe6}
.lab-panel{pointer-events:auto;background:rgba(22,26,30,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.12);border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.25)}
.lab-perf{position:absolute;top:12px;left:12px;padding:10px 12px;min-width:190px;font-variant-numeric:tabular-nums}
.lab-perf h1{font-size:12px;margin:0 0 6px;letter-spacing:.06em;text-transform:uppercase;color:#f2c230;font-weight:700}
.lab-perf .row{display:flex;justify-content:space-between;gap:12px}
.lab-perf .row b{font-weight:600;color:#fff}
.lab-perf .good{color:#7ee0a1!important}.lab-perf .ok{color:#f2c230!important}.lab-perf .bad{color:#ff7a6b!important}
.lab-styles{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px;padding:6px}
.lab-styles button,.lab-q button,.lab-bottom button{pointer-events:auto;font:inherit;color:#f4efe6;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:7px;padding:6px 10px;cursor:pointer}
.lab-styles button.on,.lab-q button.on{background:#f2c230;color:#1b1d1f;border-color:#f2c230;font-weight:700}
.lab-styles button kbd{opacity:.6;margin-right:4px;font:inherit}
.lab-q{position:absolute;top:12px;right:12px;display:flex;gap:4px;padding:6px;align-items:center}
.lab-q span{margin:0 6px 0 4px;opacity:.75}
.lab-bottom{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;padding:8px 14px;width:min(560px,calc(100vw - 32px));box-sizing:border-box}
.lab-bottom input{flex:1;accent-color:#f2c230}
.lab-bottom label{white-space:nowrap;opacity:.85}
.lab-bottom output{width:38px;text-align:right;font-variant-numeric:tabular-nums}
.lab-help{position:absolute;right:12px;bottom:14px;padding:8px 10px;opacity:.8;max-width:220px}
@media (max-width:760px){.lab-styles{top:auto;bottom:70px}.lab-help{display:none}.lab-perf{min-width:150px}}
.lab-hidden{display:none}
`;

export function createHud(h: HudHandlers) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'lab-hud';
  root.innerHTML = `
    <div class="lab-panel lab-perf">
      <h1>Style Lab · perf</h1>
      <div class="row"><span>FPS (1 s avg)</span><b data-k="fps">–</b></div>
      <div class="row"><span>Frame</span><b data-k="frameMs">–</b></div>
      <div class="row"><span>CPU / frame</span><b data-k="cpuMs">–</b></div>
      <div class="row"><span>Draw calls</span><b data-k="calls">–</b></div>
      <div class="row"><span>Triangles</span><b data-k="triangles">–</b></div>
      <div class="row"><span>Programs</span><b data-k="programs">–</b></div>
      <div class="row"><span>Quality</span><b data-k="quality">–</b></div>
      <div class="row"><span>Style</span><b data-k="style">–</b></div>
    </div>
    <div class="lab-panel lab-styles">${STYLES.map((s) => `<button data-s="${s.id}"><kbd>${s.id + 1}</kbd>${s.key} · ${s.name}</button>`).join('')}</div>
    <div class="lab-panel lab-q"><span>Quality (Q)</span>${['Low', 'Med', 'High'].map((n, i) => `<button data-q="${i}">${n}</button>`).join('')}</div>
    <div class="lab-panel lab-bottom">
      <button data-play>▶ Play</button>
      <label for="lab-restore">Restoration front</label>
      <input id="lab-restore" type="range" min="0" max="1" step="0.001" value="0.5" />
      <output data-out>50%</output>
    </div>
    <div class="lab-panel lab-help">1–4 style · Q quality · Space play · H hide UI<br/>Drag orbit · right-drag pan · wheel zoom</div>
  `;
  document.body.appendChild(root);
  const q = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  const vals = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>('[data-k]').forEach((el) => vals.set(el.dataset.k!, el));
  root.querySelectorAll<HTMLButtonElement>('[data-s]').forEach((b) => b.addEventListener('click', () => h.onStyle(Number(b.dataset.s) as StyleId)));
  root.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((b) => b.addEventListener('click', () => h.onQuality(Number(b.dataset.q) as Quality)));
  const slider = q<HTMLInputElement>('#lab-restore');
  const out = q<HTMLOutputElement>('[data-out]');
  const play = q<HTMLButtonElement>('[data-play]');
  slider.addEventListener('input', () => {
    out.textContent = `${Math.round(Number(slider.value) * 100)}%`;
    h.onRestore(Number(slider.value));
  });
  play.addEventListener('click', () => h.onPlay());

  let currentQ = '';
  return {
    update(s: HudStats) {
      const fps = vals.get('fps')!;
      fps.textContent = s.fps.toFixed(1);
      fps.className = s.fps >= 55 ? 'good' : s.fps >= 30 ? 'ok' : 'bad';
      vals.get('frameMs')!.textContent = `${s.frameMs.toFixed(2)} ms`;
      vals.get('cpuMs')!.textContent = `${s.cpuMs.toFixed(2)} ms`;
      const calls = vals.get('calls')!;
      calls.textContent = String(s.calls);
      calls.className = s.calls <= 150 ? 'good' : 'bad';
      vals.get('triangles')!.textContent = s.triangles >= 1e6 ? `${(s.triangles / 1e6).toFixed(2)} M` : `${(s.triangles / 1e3).toFixed(1)} k`;
      vals.get('programs')!.textContent = String(s.programs);
      if (s.quality !== currentQ) {
        currentQ = s.quality;
        vals.get('quality')!.textContent = s.quality;
        root.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((b) => b.classList.toggle('on', ['Low', 'Med', 'High'][Number(b.dataset.q)] === s.quality));
      }
    },
    setStyle(i: StyleId) {
      root.querySelectorAll<HTMLButtonElement>('[data-s]').forEach((b) => b.classList.toggle('on', Number(b.dataset.s) === i));
      vals.get('style')!.textContent = `${STYLES[i].key} ${STYLES[i].name}`;
    },
    setRestore(t: number) {
      slider.value = String(t);
      out.textContent = `${Math.round(t * 100)}%`;
    },
    setPlaying(p: boolean) {
      play.textContent = p ? '❚❚ Pause' : '▶ Play';
    },
    play() { h.onPlay(); },
    toggle() { root.classList.toggle('lab-hidden'); },
    show(v: boolean) { root.classList.toggle('lab-hidden', !v); },
    setQuality(qq: Quality) {
      currentQ = ['Low', 'Med', 'High'][qq];
      vals.get('quality')!.textContent = currentQ;
      root.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((b) => b.classList.toggle('on', Number(b.dataset.q) === qq));
    },
  };
}
