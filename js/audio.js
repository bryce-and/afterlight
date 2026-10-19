// WebAudio synth: every sound is generated, no asset files.
// U12 Resonance: sounds are layered recipes (data, see SHOT_RECIPES) played through group buses
// (weapons, abilities, enemies, ui) with a shared room reverb, optional stereo position and
// distance falloff from the camera, a voice cap per group, and a music duck for big moments.
import { G } from './state.js';

let ctx = null, master = null, noiseBuf = null, room = null, musicOut = null;
let volume = 0.6, effects = 1;
const buses = {};
const last = {};
const active = {};
const VOICE_CAP = { weapons: 22, abilities: 14, enemies: 8, ui: 10 };
const GROUP_GAIN = { weapons: 1, abilities: 1, enemies: 0.45, ui: 1 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { console.warn('WebAudio not supported; sound disabled.'); return; }
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume * 0.5;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);
  const fx = ctx.createGain();
  fx.gain.value = effects;
  fx.connect(master);
  for (const k of Object.keys(VOICE_CAP)) { buses[k] = ctx.createGain(); buses[k].gain.value = GROUP_GAIN[k]; buses[k].connect(fx); active[k] = 0; }
  buses.fx = fx;
  // music goes straight to the output (not through the effects volume) via a ducking gain
  musicOut = ctx.createGain();
  musicOut.connect(ctx.destination);
  // short room reverb shared by every sound
  room = ctx.createConvolver();
  const rl = Math.floor(ctx.sampleRate * 1.3), ir = ctx.createBuffer(2, rl, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < rl; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3.2);
  }
  room.buffer = ir;
  const rg = ctx.createGain(); rg.gain.value = 0.6;
  room.connect(rg).connect(fx);
  const len = ctx.sampleRate;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

/** The shared AudioContext (null until the first user gesture starts audio). */
export const audioCtx = () => ctx;
/** Where the music score connects (a ducking gain in front of the output). */
export const musicDest = () => musicOut;

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v * 0.5;
}
/** Effects slider: scales every sound effect (not the music). */
export function setEffectsVolume(v) {
  effects = v;
  if (buses.fx) buses.fx.gain.value = v;
}

/** Dip the music under a big moment, then bring it back. */
export function duck(depth = 0.45, hold = 0.35, release = 1.1) {
  if (!ctx || !musicOut) return;
  const t = ctx.currentTime;
  musicOut.gain.cancelScheduledValues(t);
  musicOut.gain.setTargetAtTime(depth, t, 0.04);
  musicOut.gain.setTargetAtTime(1, t + hold, release / 3);
}

function throttled(key, ms) {
  const n = performance.now();
  if (last[key] && n - last[key] < ms) return true;
  last[key] = n;
  return false;
}

// ---------------------------------------------------------------------------
// Voice plumbing: play(group, opts, layers) builds one chain and runs every layer into it
// ---------------------------------------------------------------------------
let cur = null; // the node layers connect into while a voice is being built

/** Stereo pan and distance gain of a world position relative to the camera. */
export function spatial(at, cam = G.camera) {
  if (!at || !cam || typeof at.x !== 'number') return { pan: 0, gain: 1, dist: 0 };
  const dx = at.x - cam.position.x, dy = at.y - cam.position.y, dz = at.z - cam.position.z;
  const dist = Math.hypot(dx, dy, dz) || 0.001;
  const q = cam.quaternion;
  const rx = 1 - 2 * (q.y * q.y + q.z * q.z), ry = 2 * (q.x * q.y + q.w * q.z), rz = 2 * (q.x * q.z - q.w * q.y);
  const pan = Math.max(-0.9, Math.min(0.9, (dx * rx + dy * ry + dz * rz) / dist * 0.9));
  return { pan, gain: 1 / (1 + dist / 40), dist };
}

function noise({ dur = 0.15, freq = 1500, freqEnd, q = 0.8, type = 'lowpass', gain = 0.5, attack = 0.002, delay = 0 }) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq * cur.pv, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd * cur.pv, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(cur.node);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

function tone({ freq = 440, freqEnd, dur = 0.1, type = 'sine', gain = 0.2, attack = 0.005, delay = 0, vib = 0 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq * cur.pv, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd * cur.pv, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(cur.node);
  if (vib) { // slow wobble for void and strand style tones
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = vib; lg.gain.value = freq * 0.04;
    l.connect(lg).connect(o.frequency);
    l.start(t); l.stop(t + dur + 0.05);
  }
  o.start(t);
  o.stop(t + dur + 0.05);
}

const runLayer = (L) => (L.n ? noise(L.n) : tone(L.t));

/**
 * Play a layered recipe. `o`: { at } world position, { send } reverb amount 0..1,
 * { vary } pitch randomisation, { gain } extra gain. Over the group's voice cap the sound is dropped.
 */
function play(group, layers, o = {}) {
  if (!ctx || !layers) return;
  if (active[group] >= VOICE_CAP[group]) return;
  if (o.at && typeof o.at.x !== 'number') o.at = null;
  const sp = spatial(o.at);
  if (group === 'enemies' && sp.dist > 110) return;
  const input = ctx.createGain();
  input.gain.value = (o.gain ?? 1) * (o.at ? sp.gain : 1);
  let node = input;
  if (o.at && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = sp.pan; input.connect(p); node = p; }
  node.connect(buses[group]);
  if ((o.send ?? 0) > 0) { const s = ctx.createGain(); s.gain.value = o.send; node.connect(s).connect(room); }
  const prev = cur;
  cur = { node: input, pv: 1 + ((Math.random() - 0.5) * (o.vary ?? 0.07)) };
  let end = 0;
  for (const L of layers) { runLayer(L); const p = L.n || L.t; end = Math.max(end, (p.dur || 0.1) + (p.delay || 0)); }
  cur = prev;
  active[group]++;
  setTimeout(() => { active[group] = Math.max(0, active[group] - 1); }, (end + 0.1) * 1000);
}

// ---------------------------------------------------------------------------
// Weapon recipes: transient (click), crack (mid noise), body (low thump), tail (room).
// n = noise layer, t = tone layer. Heavier weapons get more body and a longer tail.
// ---------------------------------------------------------------------------
const click = (g = 0.2) => ({ n: { dur: 0.012, freq: 6500, type: 'highpass', gain: g, attack: 0.0005 } });
export const SHOT_RECIPES = {
  auto: { send: 0.18, layers: [click(0.22), { n: { dur: 0.08, freq: 2800, freqEnd: 700, gain: 0.34 } }, { t: { freq: 190, freqEnd: 60, dur: 0.1, type: 'triangle', gain: 0.22 } }] },
  hand: { send: 0.4, layers: [click(0.35), { n: { dur: 0.16, freq: 2600, freqEnd: 400, gain: 0.6 } }, { t: { freq: 150, freqEnd: 38, dur: 0.22, type: 'sine', gain: 0.5 } }, { n: { dur: 0.5, freq: 900, freqEnd: 90, gain: 0.22, delay: 0.03 } }] },
  pulse: { send: 0.22, layers: [click(0.2), { n: { dur: 0.06, freq: 3600, freqEnd: 1200, gain: 0.26 } }, { t: { freq: 480, freqEnd: 220, dur: 0.07, type: 'sawtooth', gain: 0.07 } }, { t: { freq: 140, freqEnd: 70, dur: 0.08, type: 'sine', gain: 0.2 } }] },
  scout: { send: 0.3, layers: [click(0.3), { n: { dur: 0.13, freq: 3000, freqEnd: 500, gain: 0.45 } }, { t: { freq: 170, freqEnd: 50, dur: 0.16, type: 'sine', gain: 0.4 } }, { n: { dur: 0.4, freq: 1200, freqEnd: 150, gain: 0.14, delay: 0.02 } }] },
  smg: { send: 0.12, layers: [click(0.16), { n: { dur: 0.05, freq: 3800, freqEnd: 1400, gain: 0.24 } }, { t: { freq: 230, freqEnd: 90, dur: 0.05, type: 'triangle', gain: 0.1 } }] },
  shotgun: { send: 0.5, layers: [click(0.45), { n: { dur: 0.3, freq: 1700, freqEnd: 180, gain: 0.85 } }, { t: { freq: 100, freqEnd: 30, dur: 0.32, type: 'sine', gain: 0.65 } }, { n: { dur: 0.75, freq: 700, freqEnd: 70, gain: 0.3, delay: 0.04 } }] },
  sniper: { send: 0.65, layers: [click(0.5), { n: { dur: 0.35, freq: 2600, freqEnd: 120, gain: 0.85 } }, { t: { freq: 85, freqEnd: 26, dur: 0.55, type: 'sine', gain: 0.75 } }, { n: { dur: 1.1, freq: 800, freqEnd: 60, gain: 0.3, delay: 0.05 } }] },
  fusion: { send: 0.4, layers: [{ t: { freq: 1100, freqEnd: 230, dur: 0.28, type: 'sawtooth', gain: 0.16 } }, { n: { dur: 0.28, freq: 4500, freqEnd: 500, type: 'bandpass', q: 1.5, gain: 0.5 } }, { t: { freq: 95, freqEnd: 34, dur: 0.3, type: 'sine', gain: 0.5 } }] },
  linear: { send: 0.7, layers: [{ t: { freq: 1900, freqEnd: 110, dur: 0.5, type: 'sawtooth', gain: 0.2 } }, { n: { dur: 0.45, freq: 6000, freqEnd: 300, type: 'bandpass', q: 1.2, gain: 0.6 } }, { t: { freq: 70, freqEnd: 24, dur: 0.6, type: 'sine', gain: 0.7 } }, { n: { dur: 1.0, freq: 900, freqEnd: 70, gain: 0.22, delay: 0.05 } }] },
  rocket: { send: 0.6, layers: [{ n: { dur: 0.7, freq: 900, freqEnd: 180, gain: 0.55 } }, { t: { freq: 210, freqEnd: 60, dur: 0.5, type: 'sawtooth', gain: 0.12 } }, { t: { freq: 80, freqEnd: 30, dur: 0.5, type: 'sine', gain: 0.55 } }] },
  mg: { send: 0.2, layers: [click(0.25), { n: { dur: 0.1, freq: 2300, freqEnd: 420, gain: 0.42 } }, { t: { freq: 120, freqEnd: 44, dur: 0.1, type: 'sine', gain: 0.4 } }] },
  glauncher: { send: 0.45, layers: [{ t: { freq: 320, freqEnd: 90, dur: 0.16, type: 'square', gain: 0.16 } }, { n: { dur: 0.16, freq: 1100, freqEnd: 250, gain: 0.4 } }, { t: { freq: 90, freqEnd: 34, dur: 0.22, type: 'sine', gain: 0.45 } }] },
  sidearm: { send: 0.15, layers: [click(0.2), { n: { dur: 0.07, freq: 3200, freqEnd: 900, gain: 0.3 } }, { t: { freq: 210, freqEnd: 80, dur: 0.07, type: 'triangle', gain: 0.14 } }] },
  glaive: { send: 0.3, layers: [{ t: { freq: 1200, freqEnd: 380, dur: 0.1, type: 'triangle', gain: 0.15 } }, { n: { dur: 0.08, freq: 4600, freqEnd: 1500, type: 'bandpass', gain: 0.2 } }, { t: { freq: 130, freqEnd: 60, dur: 0.12, type: 'sine', gain: 0.25 } }] },
  trace: { send: 0.15, layers: [{ t: { freq: 540, freqEnd: 470, dur: 0.14, type: 'sawtooth', gain: 0.05 } }, { n: { dur: 0.1, freq: 5400, freqEnd: 3600, type: 'bandpass', gain: 0.12 } }] },
  forerunner: { send: 0.3, layers: [{ t: { freq: 780, freqEnd: 300, dur: 0.14, type: 'triangle', gain: 0.14 } }, { n: { dur: 0.1, freq: 3200, freqEnd: 900, gain: 0.3 } }, { t: { freq: 110, freqEnd: 50, dur: 0.14, type: 'sine', gain: 0.3 } }] },
  revolver: { send: 0.7, layers: [click(0.5), { n: { dur: 0.5, freq: 3200, freqEnd: 180, gain: 0.85 } }, { t: { freq: 1500, freqEnd: 320, dur: 0.4, type: 'sawtooth', gain: 0.16 } }, { t: { freq: 80, freqEnd: 26, dur: 0.55, type: 'sine', gain: 0.7 } }, { n: { dur: 1.0, freq: 900, freqEnd: 80, gain: 0.25, delay: 0.04 } }] },
  hammer: { send: 0.4, layers: [{ n: { dur: 0.25, freq: 600, freqEnd: 1800, type: 'bandpass', gain: 0.5 } }, { t: { freq: 140, freqEnd: 60, dur: 0.25, type: 'sine', gain: 0.3 } }] },
};
const SHOT_DEFAULT = { send: 0.2, layers: [{ n: { dur: 0.1, freq: 2000, gain: 0.3 } }] };

/** Element tints stacked on a weapon shot or an ability: a small extra layer per element. */
export const ELEMENT_TINT = {
  solar: [{ n: { dur: 0.14, freq: 5200, freqEnd: 2200, type: 'bandpass', q: 3, gain: 0.12 } }],
  arc: [{ t: { freq: 2400, freqEnd: 1100, dur: 0.1, type: 'square', gain: 0.045 } }, { n: { dur: 0.12, freq: 6500, type: 'highpass', gain: 0.1 } }],
  void: [{ t: { freq: 180, freqEnd: 90, dur: 0.35, type: 'sine', gain: 0.16, vib: 9 } }],
  stasis: [{ t: { freq: 2900, freqEnd: 2000, dur: 0.2, type: 'triangle', gain: 0.05 } }, { t: { freq: 3900, freqEnd: 2800, dur: 0.16, type: 'sine', gain: 0.035, delay: 0.03 } }],
  strand: [{ n: { dur: 0.25, freq: 1500, freqEnd: 700, type: 'bandpass', q: 5, gain: 0.12 } }],
};
const tint = (el) => ELEMENT_TINT[el] || [];

// Casts, throws and impacts per element.
export const ABILITY_RECIPES = {
  cast: { send: 0.35, layers: [{ t: { freq: 260, freqEnd: 760, dur: 0.3, type: 'triangle', gain: 0.14 } }, { n: { dur: 0.3, freq: 1800, type: 'bandpass', gain: 0.16 } }, { t: { freq: 90, freqEnd: 60, dur: 0.3, type: 'sine', gain: 0.22 } }] },
  throw: { send: 0.15, layers: [{ n: { dur: 0.16, freq: 700, freqEnd: 2600, type: 'bandpass', gain: 0.22 } }, { t: { freq: 160, freqEnd: 90, dur: 0.1, type: 'sine', gain: 0.14 } }] },
  melee: { send: 0.2, layers: [{ n: { dur: 0.14, freq: 500, freqEnd: 200, gain: 0.55 } }, { t: { freq: 130, freqEnd: 45, dur: 0.18, type: 'sine', gain: 0.45 } }, { n: { dur: 0.05, freq: 3000, type: 'highpass', gain: 0.18 } }] },
  zap: { send: 0.3, layers: [{ n: { dur: 0.16, freq: 5200, freqEnd: 1800, type: 'bandpass', q: 4, gain: 0.3 } }, { t: { freq: 1900, freqEnd: 600, dur: 0.1, type: 'sawtooth', gain: 0.05 } }] },
  heal: { send: 0.5, layers: [{ t: { freq: 520, freqEnd: 820, dur: 0.45, type: 'sine', gain: 0.09 } }, { t: { freq: 780, freqEnd: 1230, dur: 0.45, type: 'sine', gain: 0.05, delay: 0.05 } }] },
  superStart: { send: 0.7, layers: [{ t: { freq: 70, freqEnd: 420, dur: 1.0, type: 'sawtooth', gain: 0.16 } }, { n: { dur: 1.0, freq: 250, freqEnd: 3400, type: 'bandpass', q: 1.2, gain: 0.4 } }, { t: { freq: 48, freqEnd: 30, dur: 1.2, type: 'sine', gain: 0.5 } }, { t: { freq: 330, freqEnd: 660, dur: 0.9, type: 'triangle', gain: 0.07, delay: 0.1 } }] },
};

export const FACTION_SOUND = {
  scrappers: { shot: [{ t: { freq: 900, freqEnd: 320, dur: 0.14, type: 'triangle', gain: 0.3 } }, { n: { dur: 0.08, freq: 3200, freqEnd: 900, type: 'bandpass', gain: 0.25 } }], die: [{ n: { dur: 0.35, freq: 1800, freqEnd: 300, type: 'bandpass', gain: 0.4 } }, { t: { freq: 420, freqEnd: 120, dur: 0.3, type: 'triangle', gain: 0.18 } }] },
  hollow: { shot: [{ t: { freq: 420, freqEnd: 150, dur: 0.2, type: 'sawtooth', gain: 0.22, vib: 14 } }, { n: { dur: 0.12, freq: 1500, freqEnd: 500, type: 'bandpass', gain: 0.2 } }], die: [{ t: { freq: 300, freqEnd: 80, dur: 0.45, type: 'sawtooth', gain: 0.25, vib: 20 } }, { n: { dur: 0.3, freq: 900, freqEnd: 200, gain: 0.25 } }] },
  legion: { shot: [{ t: { freq: 620, freqEnd: 240, dur: 0.14, type: 'square', gain: 0.18 } }, { n: { dur: 0.1, freq: 2200, freqEnd: 600, gain: 0.3 } }], die: [{ n: { dur: 0.4, freq: 1100, freqEnd: 150, gain: 0.45 } }, { t: { freq: 160, freqEnd: 60, dur: 0.35, type: 'sine', gain: 0.3 } }] },
};

export const sfx = {
  /** Weapon shot. `at` places a fireteam member's shot in the world; `el` tints it by element. */
  shot(arch, at, el) {
    if (!ctx) return;
    const r = SHOT_RECIPES[arch] || SHOT_DEFAULT;
    play('weapons', el && el !== 'kinetic' ? r.layers.concat(tint(el)) : r.layers, { at, send: r.send });
  },
  charge() { play('weapons', [{ t: { freq: 200, freqEnd: 1200, dur: 0.6, type: 'sawtooth', gain: 0.06 } }], { send: 0.3 }); },
  enemyShot(at, faction) {
    if (throttled('es', 60)) return;
    const f = (FACTION_SOUND[faction] || FACTION_SOUND.scrappers).shot;
    play('enemies', f, { at, send: 0.25, vary: 0.12 });
  },
  enemyDie(at, faction) {
    if (throttled('ed', 70)) return;
    play('enemies', (FACTION_SOUND[faction] || FACTION_SOUND.scrappers).die, { at, send: 0.3, vary: 0.15 });
  },
  /** Heavy enemy footfall. */
  step(at) { if (throttled('step', 180)) return; play('enemies', [{ t: { freq: 70, freqEnd: 38, dur: 0.2, type: 'sine', gain: 0.5 } }, { n: { dur: 0.08, freq: 400, gain: 0.25 } }], { at, vary: 0.1 }); },
  explosion(r = 4, at, el) {
    if (throttled('ex', 40)) return;
    const big = r >= 6;
    play('abilities', [
      { n: { dur: 0.5 + r * 0.07, freq: 1000, freqEnd: 55, gain: Math.min(0.95, 0.4 + r * 0.06) } },
      { t: { freq: 85, freqEnd: 26, dur: 0.6 + r * 0.04, type: 'sine', gain: Math.min(0.8, 0.35 + r * 0.05) } },
      { n: { dur: 0.04, freq: 5000, type: 'highpass', gain: 0.3, attack: 0.0005 } },
      { n: { dur: 0.9 + r * 0.1, freq: 500, freqEnd: 50, gain: 0.2, delay: 0.06 } },
    ].concat(tint(el)), { at, send: Math.min(0.8, 0.4 + r * 0.04) });
    if (big) duck(0.5, 0.25, 0.9);
  },
  hit(crit) {
    if (throttled('hit', 30)) return;
    if (crit) play('weapons', [{ t: { freq: 1800, freqEnd: 1500, dur: 0.07, type: 'triangle', gain: 0.12 } }, { t: { freq: 2700, freqEnd: 2300, dur: 0.05, type: 'sine', gain: 0.05 } }], { vary: 0 });
    else play('weapons', [{ t: { freq: 1100, dur: 0.04, type: 'triangle', gain: 0.07 } }], { vary: 0 });
  },
  kill() { if (throttled('kill', 40)) return; play('weapons', [{ t: { freq: 500, freqEnd: 1200, dur: 0.1, type: 'triangle', gain: 0.1 } }], { vary: 0 }); },
  shieldBreak(at) { play('enemies', [{ n: { dur: 0.3, freq: 5000, freqEnd: 1500, type: 'highpass', gain: 0.35 } }, { t: { freq: 1500, freqEnd: 500, dur: 0.25, type: 'triangle', gain: 0.12 } }], { at, send: 0.4 }); },
  playerShieldBreak() { play('abilities', [{ t: { freq: 600, freqEnd: 150, dur: 0.4, type: 'sawtooth', gain: 0.15 } }, { n: { dur: 0.3, freq: 4500, freqEnd: 1000, type: 'highpass', gain: 0.25 } }], { send: 0.4 }); },
  block() { if (throttled('block', 90)) return; play('abilities', [{ t: { freq: 240, freqEnd: 110, dur: 0.14, type: 'square', gain: 0.1 } }, { n: { dur: 0.1, freq: 1600, type: 'bandpass', gain: 0.25 } }, { t: { freq: 90, freqEnd: 50, dur: 0.15, type: 'sine', gain: 0.25 } }], { send: 0.3 }); },
  shieldRecharge() { play('abilities', [{ t: { freq: 300, freqEnd: 900, dur: 0.5, type: 'sine', gain: 0.08 } }], { send: 0.4 }); },
  hurt() { if (throttled('hurt', 90)) return; play('abilities', [{ n: { dur: 0.14, freq: 500, freqEnd: 200, gain: 0.4 } }, { t: { freq: 100, freqEnd: 50, dur: 0.14, type: 'sine', gain: 0.3 } }], { vary: 0 }); },
  death() { play('abilities', [{ t: { freq: 300, freqEnd: 50, dur: 1.4, type: 'sawtooth', gain: 0.2 } }, { t: { freq: 60, freqEnd: 28, dur: 1.4, type: 'sine', gain: 0.4 } }], { send: 0.6 }); duck(0.3, 1.2, 2); },
  /** Reload. `arch` picks the weight: heavy weapons clunk, light ones click. */
  reload(arch) {
    const heavy = ['rocket', 'mg', 'sniper', 'linear', 'shotgun', 'glauncher'].includes(arch);
    play('weapons', [
      { n: { dur: 0.06, freq: heavy ? 1800 : 3000, type: 'bandpass', gain: 0.25 } },
      { t: { freq: heavy ? 120 : 200, freqEnd: heavy ? 60 : 110, dur: 0.07, type: 'sine', gain: heavy ? 0.3 : 0.15 } },
      { n: { dur: 0.06, freq: heavy ? 1400 : 2200, type: 'bandpass', gain: 0.25, delay: heavy ? 0.45 : 0.25 } },
      { t: { freq: heavy ? 90 : 160, freqEnd: 50, dur: 0.08, type: 'sine', gain: heavy ? 0.3 : 0.15, delay: heavy ? 0.45 : 0.25 } },
    ], { vary: 0.04 });
  },
  reloadDone(arch) {
    const heavy = ['rocket', 'mg', 'sniper', 'linear', 'shotgun', 'glauncher'].includes(arch);
    play('weapons', [{ n: { dur: 0.07, freq: 1800, type: 'bandpass', q: 3, gain: 0.35 } }, { t: { freq: heavy ? 100 : 170, freqEnd: 55, dur: 0.1, type: 'sine', gain: heavy ? 0.4 : 0.22 } }], { vary: 0.04 });
  },
  swap() { play('weapons', [{ n: { dur: 0.05, freq: 2500, type: 'bandpass', gain: 0.2 } }, { t: { freq: 150, freqEnd: 80, dur: 0.06, type: 'sine', gain: 0.15 } }]); },
  empty() { if (throttled('empty', 150)) return; play('weapons', [{ t: { freq: 1200, dur: 0.03, type: 'square', gain: 0.05 } }, { n: { dur: 0.02, freq: 4000, type: 'highpass', gain: 0.1 } }], { vary: 0 }); },
  jump() { play('abilities', [{ n: { dur: 0.1, freq: 600, gain: 0.08 } }]); },
  land() { play('abilities', [{ n: { dur: 0.12, freq: 300, gain: 0.2 } }, { t: { freq: 80, freqEnd: 45, dur: 0.12, type: 'sine', gain: 0.2 } }]); },
  airMove() { play('abilities', [{ t: { freq: 250, freqEnd: 600, dur: 0.2, type: 'triangle', gain: 0.08 } }, { n: { dur: 0.2, freq: 1200, freqEnd: 3000, type: 'bandpass', gain: 0.08 } }]); },
  throw(el) { const r = ABILITY_RECIPES.throw; play('abilities', r.layers.concat(tint(el)), { send: r.send }); },
  melee(el) { const r = ABILITY_RECIPES.melee; play('abilities', r.layers.concat(tint(el)), { send: r.send }); },
  /** Sword: a light swing, a heavy swing, or a block. */
  sword(kind = 'swing') {
    if (kind === 'block') return sfx.block();
    const heavy = kind === 'heavy';
    play('abilities', [
      { n: { dur: heavy ? 0.4 : 0.18, freq: heavy ? 300 : 700, freqEnd: heavy ? 2200 : 3200, type: 'bandpass', q: 1.5, gain: heavy ? 0.5 : 0.3 } },
      { t: { freq: heavy ? 110 : 160, freqEnd: heavy ? 36 : 70, dur: heavy ? 0.4 : 0.2, type: 'sine', gain: heavy ? 0.5 : 0.25 } },
    ], { send: 0.3 });
  },
  ability(el) { const r = ABILITY_RECIPES.cast; play('abilities', r.layers.concat(tint(el)), { send: r.send }); },
  zap() { if (throttled('zap', 50)) return; const r = ABILITY_RECIPES.zap; play('abilities', r.layers, { send: r.send }); },
  heal() { const r = ABILITY_RECIPES.heal; play('abilities', r.layers, { send: r.send }); },
  superStart(el) { const r = ABILITY_RECIPES.superStart; play('abilities', r.layers.concat(tint(el)), { send: r.send }); duck(0.35, 0.8, 1.6); },
  superReady() { play('ui', [{ t: { freq: 660, dur: 0.14, gain: 0.1 } }, { t: { freq: 990, dur: 0.24, gain: 0.1, delay: 0.1 } }, { t: { freq: 1320, dur: 0.3, gain: 0.05, delay: 0.2 } }], { send: 0.5, vary: 0 }); },
  denied() { if (throttled('deny', 200)) return; play('ui', [{ t: { freq: 160, dur: 0.08, type: 'square', gain: 0.06 } }], { vary: 0 }); },
  pickupAmmo() { play('ui', [{ t: { freq: 700, freqEnd: 1000, dur: 0.08, type: 'triangle', gain: 0.1 } }, { n: { dur: 0.03, freq: 3500, type: 'highpass', gain: 0.1 } }]); },
  engram(rIdx = 0) {
    const base = 440 + rIdx * 80;
    const notes = [0, 4, 7, 12].slice(0, 2 + Math.min(2, rIdx));
    play('ui', notes.map((st, i) => ({ t: { freq: base * Math.pow(2, st / 12), dur: 0.3, gain: 0.09, delay: i * 0.07 } })), { send: 0.45, vary: 0 });
  },
  alert() { play('ui', [{ t: { freq: 440, dur: 0.12, type: 'square', gain: 0.05 } }, { t: { freq: 330, dur: 0.18, type: 'square', gain: 0.05, delay: 0.14 } }], { vary: 0 }); },
  areaClear() { play('ui', [523, 659, 784].map((f, i) => ({ t: { freq: f, dur: 0.4, gain: 0.08, delay: i * 0.1 } })).concat([{ t: { freq: 262, dur: 0.8, gain: 0.07, type: 'triangle' } }]), { send: 0.6, vary: 0 }); },
  bossIntro() {
    play('abilities', [{ t: { freq: 52, freqEnd: 40, dur: 2.0, type: 'sawtooth', gain: 0.2 } }, { t: { freq: 40, freqEnd: 28, dur: 2.2, type: 'sine', gain: 0.5 } }, { n: { dur: 1.8, freq: 160, freqEnd: 600, gain: 0.3 } }, { n: { dur: 0.05, freq: 3000, type: 'highpass', gain: 0.35 } }], { send: 0.8 });
    duck(0.3, 1.6, 2);
  },
  missionComplete() { play('ui', [392, 523, 659, 784, 1046].map((f, i) => ({ t: { freq: f, dur: 0.7, gain: 0.09, delay: i * 0.12 } })).concat([{ t: { freq: 196, dur: 1.4, gain: 0.09, type: 'triangle' } }]), { send: 0.7, vary: 0 }); duck(0.6, 1.2, 1.5); },
  chest() { play('abilities', [{ n: { dur: 0.4, freq: 500, freqEnd: 3000, type: 'bandpass', gain: 0.3 } }], { send: 0.4 }); sfx.engram(3); },
  ui() { play('ui', [{ t: { freq: 900, dur: 0.04, type: 'triangle', gain: 0.05 } }], { vary: 0 }); },
};
