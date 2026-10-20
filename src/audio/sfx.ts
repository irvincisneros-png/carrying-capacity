// Procedural WebAudio sound: UI clicks, build pops, coins, demolish crunch, chimes, plus a soft ambient bed
// (surf + wind, birdsong that thins out as the environment declines). No audio files.

type Sfx = 'click' | 'open' | 'place' | 'coin' | 'demolish' | 'error' | 'decade' | 'event' | 'good' | 'tick' | 'grow';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambGain: GainNode | null = null;
let muted = false;
let birdLevel = 0.6;
let birdTimer = 0;

try {
  muted = localStorage.getItem('cc.mute') === '1';
} catch {
  /* ignore */
}

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    startAmbient();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from a user gesture to unlock audio. */
export function unlockAudio(): void {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('cc.mute', m ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.05);
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
  const c = ctx;
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, q = 1, delay = 0): void {
  const c = ctx;
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
}

export function sfx(kind: Sfx): void {
  if (muted) return;
  if (!ensure()) return;
  switch (kind) {
    case 'click': tone(660, 0.06, 'triangle', 0.08, 520); break;
    case 'tick': tone(880, 0.04, 'sine', 0.04); break;
    case 'open': tone(440, 0.12, 'sine', 0.06, 660); break;
    case 'place':
      tone(180, 0.18, 'sine', 0.22, 90);
      noise(0.15, 0.25, 600, 0.8);
      tone(520, 0.09, 'triangle', 0.08, 780, 0.05);
      break;
    case 'grow':
      tone(523, 0.12, 'triangle', 0.07);
      tone(784, 0.16, 'triangle', 0.07, undefined, 0.07);
      break;
    case 'coin':
      tone(988, 0.08, 'square', 0.04);
      tone(1319, 0.18, 'square', 0.04, undefined, 0.07);
      break;
    case 'demolish':
      noise(0.45, 0.5, 300, 0.6);
      tone(120, 0.3, 'sawtooth', 0.08, 50);
      break;
    case 'error': tone(160, 0.16, 'square', 0.06, 120); tone(150, 0.16, 'square', 0.05, 110, 0.1); break;
    case 'decade':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 'sine', 0.08, undefined, i * 0.08));
      break;
    case 'event':
      tone(220, 0.8, 'sine', 0.12, 196);
      tone(330, 0.8, 'sine', 0.06, 294, 0.05);
      break;
    case 'good':
      [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.35, 'triangle', 0.07, undefined, i * 0.07));
      break;
  }
}

// ---------------------------------------------------------------- ambient bed
function startAmbient(): void {
  const c = ctx;
  if (!c || !master) return;
  ambGain = c.createGain();
  ambGain.gain.value = 0.18;
  ambGain.connect(master);
  // brown-ish noise through a slowly swept lowpass = surf
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
    d[i] = last * 3.5;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  const lfo = c.createOscillator();
  const lfoG = c.createGain();
  lfo.frequency.value = 0.09;
  lfoG.gain.value = 260;
  lfo.connect(lfoG);
  lfoG.connect(lp.frequency);
  src.connect(lp);
  lp.connect(ambGain);
  src.start();
  lfo.start();
}

/** Called every frame: occasional bird chirps scaled by environment health (0..1). */
export function ambientTick(dt: number, env01: number): void {
  if (!ctx || muted) return;
  birdLevel += (env01 - birdLevel) * Math.min(1, dt * 0.5);
  birdTimer -= dt;
  if (birdTimer > 0) return;
  birdTimer = 1.5 + Math.random() * 5 / Math.max(0.15, birdLevel);
  if (Math.random() > birdLevel) return;
  // whipbird-ish / bellbird-ish chirps
  const base = 1800 + Math.random() * 1600;
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) tone(base * (1 + i * 0.08), 0.07, 'sine', 0.018 * birdLevel, base * 1.3, i * 0.11);
}
