// WebAudio synth: every sound is generated, no asset files.
// U12 Resonance: sounds are layered recipes (data, see SHOT_RECIPES) played through group buses
// (weapons, abilities, enemies, ui) with a shared room reverb, optional stereo position and
// distance falloff from the camera, a voice cap per group, and a music duck for big moments.
import { G } from './state.js';

let ctx = null, master = null, noiseBuf = null, room = null, musicOut = null, ambOut = null, voiceOut = null;
let volume = 0.6, effects = 1, ambiance = 1, voiceVol = 1; // U33: separate Ambiance and NPC Voice sliders (Sound tab)
const buses = {};
const last = {};
const active = {};
const VOICE_CAP = { weapons: 16, abilities: 10, enemies: 8, ui: 8 }; // U33: lower caps and a total cap, so a huge fight cannot overload the audio thread into dropouts
const TOTAL_CAP = 34;
let live = 0;
const GROUP_GAIN = { weapons: 1, abilities: 1, enemies: 0.45, ui: 1 };

export function initAudio() {
  if (ctx) { if (ctx.state !== 'running') ctx.resume?.(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { console.warn('WebAudio not supported; sound disabled.'); return; }
  ctx = new AC();
  // U33: self-healing. The browser can suspend or interrupt the context (a long frame, a background tab, a device change): bring it back at once and
  // keep checking, so sound never stays silent after a hiccup.
  const wake = () => { if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {}); };
  ctx.onstatechange = wake;
  setInterval(wake, 1500);
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, wake, { capture: true, passive: true });
  document.addEventListener('visibilitychange', wake);
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
  // U33: planet ambiance and NPC voices each get their own gain (own slider), through the master volume but not the Effects slider
  ambOut = ctx.createGain(); ambOut.gain.value = ambiance; ambOut.connect(master);
  voiceOut = ctx.createGain(); voiceOut.gain.value = voiceVol; voiceOut.connect(master);
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

/** Where the planet ambiance connects (own Ambiance slider). */
export const ambianceDest = () => ambOut;
/** Where NPC voices connect (own NPC Voice slider). */
export const voiceDest = () => voiceOut;
/** Ambiance slider: scales the planet ambiance beds. */
export function setAmbianceVolume(v) { ambiance = v; if (ambOut) ambOut.gain.value = v; }
/** NPC Voice slider: scales every NPC voice line. */
export function setVoiceVolume(v) { voiceVol = v; if (voiceOut) voiceOut.gain.value = v; }

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

const curves = {};
/** Soft clipper: squashes the noise peaks so a gunshot crack is dense and hard instead of a hiss. */
function crunchShaper(k) {
  if (!curves[k]) {
    const n = 512, c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * (1 + k * 4));
    curves[k] = c;
  }
  const ws = ctx.createWaveShaper(); // one per voice: a node can only feed one chain
  ws.curve = curves[k];
  return ws;
}

function noise({ dur = 0.15, freq = 1500, freqEnd, q = 0.8, type = 'lowpass', gain = 0.5, attack = 0.002, delay = 0, crunch = 0 }) {
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
  if (crunch) src.connect(f).connect(crunchShaper(crunch)).connect(g).connect(cur.node);
  else src.connect(f).connect(g).connect(cur.node);
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
  if (active[group] >= VOICE_CAP[group] || live >= TOTAL_CAP) return;
  try { playNow(group, layers, o); } catch (e) { if (!play.warned) { play.warned = true; console.warn('sound skipped:', e.message); } } // one bad sound must never break the frame
}
function playNow(group, layers, o) {
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
  active[group]++; live++;
  setTimeout(() => { active[group] = Math.max(0, active[group] - 1); live = Math.max(0, live - 1); }, (end + 0.1) * 1000);
}

// ---------------------------------------------------------------------------
// Weapon recipes: transient (click), crack (mid noise), body (low thump), tail (room).
// n = noise layer, t = tone layer. Heavier weapons get more body and a longer tail.
// ---------------------------------------------------------------------------
const click = (g = 0.2) => ({ n: { dur: 0.012, freq: 6500, type: 'highpass', gain: g, attack: 0.0005 } });
// A gunshot is a hard noise crack (clipped so it stays dense) and a low noise thump for the body. Dry on purpose: almost no reverb.
// No pitched tones: a swept oscillator reads as a note. Only the energy weapons keep a noisy synthetic sweep.
const crack = (dur, f0, f1, gain, crunch = 2) => ({ n: { dur, freq: f0, freqEnd: f1, type: 'bandpass', q: 0.45, gain, attack: 0.0004, crunch } });
const thump = (dur, f0, f1, gain, delay = 0) => ({ n: { dur, freq: f0, freqEnd: f1, type: 'lowpass', q: 0.9, gain, attack: 0.0008, delay, crunch: 1 } });
const zapSweep = (dur, f0, f1, gain) => ({ n: { dur, freq: f0, freqEnd: f1, type: 'bandpass', q: 2.5, gain, attack: 0.001, crunch: 2 } });
export const SHOT_RECIPES = {
  auto: { send: 0.04, layers: [click(0.18), crack(0.05, 3200, 1500, 0.55), thump(0.08, 420, 140, 1.4)] },
  hand: { send: 0.04, layers: [click(0.3), crack(0.1, 2600, 900, 0.8), thump(0.22, 320, 70, 2.0)] },
  pulse: { send: 0.04, layers: [click(0.2), crack(0.045, 3600, 1800, 0.5), thump(0.07, 520, 200, 1.1)] },
  scout: { send: 0.04, layers: [click(0.28), crack(0.08, 3000, 1100, 0.75), thump(0.15, 280, 80, 1.7)] },
  smg: { send: 0.04, layers: [click(0.15), crack(0.035, 3800, 2000, 0.5), thump(0.05, 620, 250, 0.9)] },
  shotgun: { send: 0.04, layers: [click(0.4), crack(0.15, 2400, 500, 1.0, 3), thump(0.3, 240, 50, 2.4)] },
  sniper: { send: 0.04, layers: [click(0.45), crack(0.14, 3000, 700, 1.1, 3), thump(0.42, 240, 40, 2.6)] },
  fusion: { send: 0.04, layers: [zapSweep(0.25, 5200, 900, 0.75), crack(0.07, 2800, 900, 0.6), thump(0.3, 260, 50, 2.0)] },
  linear: { send: 0.04, layers: [zapSweep(0.4, 6200, 600, 0.85), crack(0.1, 2600, 700, 0.8), thump(0.55, 220, 36, 2.6)] },
  rocket: { send: 0.04, layers: [{ n: { dur: 0.6, freq: 500, freqEnd: 1800, type: 'bandpass', q: 0.6, gain: 0.45, attack: 0.05 } }, crack(0.12, 1800, 500, 0.7), thump(0.5, 260, 45, 2.6)] },
  rocketround: { send: 0.04, layers: [{ n: { dur: 0.25, freq: 700, freqEnd: 2400, type: 'bandpass', q: 0.7, gain: 0.3, attack: 0.02 } }, crack(0.06, 2200, 800, 0.55), thump(0.18, 330, 80, 1.7)] },
  xenophage: { send: 0.04, layers: [zapSweep(0.14, 4600, 800, 0.6), crack(0.08, 2400, 700, 0.65), thump(0.16, 300, 70, 1.8)] },
  mg: { send: 0.04, layers: [click(0.22), crack(0.06, 2600, 1000, 0.7), thump(0.1, 380, 110, 1.7)] },
  glauncher: { send: 0.04, layers: [click(0.35), crack(0.05, 1500, 600, 0.6), thump(0.2, 300, 70, 2.0)] },
  sidearm: { send: 0.04, layers: [click(0.18), crack(0.05, 3200, 1500, 0.55), thump(0.09, 450, 150, 1.2)] },
  glaive: { send: 0.04, layers: [zapSweep(0.1, 5000, 1500, 0.4), thump(0.14, 300, 80, 1.3)] },
  trace: { send: 0.04, layers: [{ n: { dur: 0.12, freq: 4200, freqEnd: 3200, type: 'bandpass', q: 1.2, gain: 0.2 } }] },
  forerunner: { send: 0.04, layers: [click(0.2), crack(0.07, 2800, 1000, 0.55), thump(0.14, 300, 90, 1.4)] },
  revolver: { send: 0.04, layers: [click(0.45), crack(0.16, 3000, 800, 1.1, 3), thump(0.5, 260, 45, 2.6)] },
  hammer: { send: 0.04, layers: [zapSweep(0.25, 800, 2600, 0.45), thump(0.25, 280, 70, 1.5)] },
};
const SHOT_DEFAULT = { send: 0.2, layers: [{ n: { dur: 0.1, freq: 2000, gain: 0.3 } }] };

/** Element tints stacked on a weapon shot or an ability: a small extra layer per element. */
export const ELEMENT_TINT = {
  solar: [{ n: { dur: 0.14, freq: 5200, freqEnd: 2200, type: 'bandpass', q: 3, gain: 0.12 } }],
  arc: [{ n: { dur: 0.1, freq: 6500, type: 'highpass', gain: 0.14, crunch: 3 } }, { n: { dur: 0.06, freq: 3000, type: 'bandpass', q: 3, gain: 0.1, delay: 0.02, crunch: 3 } }],
  void: [{ n: { dur: 0.35, freq: 200, freqEnd: 80, type: 'lowpass', gain: 0.35 } }],
  stasis: [{ n: { dur: 0.12, freq: 7000, type: 'highpass', gain: 0.14, crunch: 2 } }, { n: { dur: 0.1, freq: 4200, type: 'bandpass', q: 5, gain: 0.08, delay: 0.03 } }],
  strand: [{ n: { dur: 0.25, freq: 1500, freqEnd: 700, type: 'bandpass', q: 5, gain: 0.12 } }],
};
ELEMENT_TINT.prismatic = [ELEMENT_TINT.solar[0], ELEMENT_TINT.stasis[0], ELEMENT_TINT.void[0]]; // U27: the subclass's own sound (its abilities use their own elements)
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
  // U14: Taken are a thin, high, glassy whine with a hollow collapse; Scorn a rough saw with a wet crunch
  taken: { shot: [{ t: { freq: 1250, freqEnd: 380, dur: 0.18, type: 'sine', gain: 0.2, vib: 30 } }, { n: { dur: 0.1, freq: 4200, freqEnd: 1200, type: 'bandpass', gain: 0.16 } }], die: [{ t: { freq: 700, freqEnd: 90, dur: 0.5, type: 'sine', gain: 0.22, vib: 26 } }, { n: { dur: 0.35, freq: 2600, freqEnd: 200, type: 'bandpass', gain: 0.2 } }] },
  scorn: { shot: [{ t: { freq: 360, freqEnd: 120, dur: 0.16, type: 'sawtooth', gain: 0.24 } }, { n: { dur: 0.12, freq: 1200, freqEnd: 400, type: 'bandpass', gain: 0.3 } }], die: [{ n: { dur: 0.4, freq: 800, freqEnd: 120, gain: 0.4 } }, { t: { freq: 220, freqEnd: 70, dur: 0.35, type: 'sawtooth', gain: 0.2 } }] },
  // v2.9: Vex are a bright metallic ping with a ceramic crack on death
  vex: { shot: [{ t: { freq: 1500, freqEnd: 600, dur: 0.1, type: 'square', gain: 0.12 } }, { n: { dur: 0.08, freq: 5200, freqEnd: 2000, type: 'bandpass', gain: 0.22 } }], die: [{ n: { dur: 0.3, freq: 3000, freqEnd: 500, type: 'bandpass', gain: 0.4 } }, { t: { freq: 900, freqEnd: 140, dur: 0.35, type: 'triangle', gain: 0.2 } }] },
  legion: { shot: [{ t: { freq: 620, freqEnd: 240, dur: 0.14, type: 'square', gain: 0.18 } }, { n: { dur: 0.1, freq: 2200, freqEnd: 600, gain: 0.3 } }], die: [{ n: { dur: 0.4, freq: 1100, freqEnd: 150, gain: 0.45 } }, { t: { freq: 160, freqEnd: 60, dur: 0.35, type: 'sine', gain: 0.3 } }] },
};

const SHIP_SND = { cabal: { f: 70, nf: 350, wave: 'sawtooth' }, fallen: { f: 120, nf: 700, wave: 'square', vib: 18 }, hive: { f: 85, nf: 450, wave: 'sawtooth', vib: 11 } };
const GATE_SND = { vex: { f: 500, nf: 3200, wave: 'square', vib: 0 }, taken: { f: 160, nf: 900, wave: 'sine', vib: 25 }, scorn: { f: 220, nf: 1200, wave: 'sawtooth', vib: 12 } };

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
    const heavy = ['rocket', 'mg', 'xenophage', 'sniper', 'linear', 'shotgun', 'glauncher'].includes(arch);
    play('weapons', [
      { n: { dur: 0.06, freq: heavy ? 1800 : 3000, type: 'bandpass', gain: 0.25 } },
      { t: { freq: heavy ? 120 : 200, freqEnd: heavy ? 60 : 110, dur: 0.07, type: 'sine', gain: heavy ? 0.3 : 0.15 } },
      { n: { dur: 0.06, freq: heavy ? 1400 : 2200, type: 'bandpass', gain: 0.25, delay: heavy ? 0.45 : 0.25 } },
      { t: { freq: heavy ? 90 : 160, freqEnd: 50, dur: 0.08, type: 'sine', gain: heavy ? 0.3 : 0.15, delay: heavy ? 0.45 : 0.25 } },
    ], { vary: 0.04 });
  },
  reloadDone(arch) {
    const heavy = ['rocket', 'mg', 'xenophage', 'sniper', 'linear', 'shotgun', 'glauncher'].includes(arch);
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
  /** Right eye in the glyph puzzle: a short bright two-note rising chime. */
  glyphRight() { play('ui', [{ t: { freq: 880, dur: 0.18, gain: 0.08 } }, { t: { freq: 1318.5, dur: 0.32, gain: 0.08, delay: 0.09 } }, { t: { freq: 1760, dur: 0.3, gain: 0.03, delay: 0.09, type: 'triangle' } }], { send: 0.5, vary: 0 }); },
  /** Wrong eye: a low dissonant buzz with a dull thud. */
  glyphWrong() { play('ui', [{ t: { freq: 110, freqEnd: 90, dur: 0.38, type: 'sawtooth', gain: 0.07 } }, { t: { freq: 117, freqEnd: 96, dur: 0.38, type: 'square', gain: 0.04 } }, { t: { freq: 60, freqEnd: 40, dur: 0.3, gain: 0.12 } }], { vary: 0 }); },
  areaClear() { play('ui', [523, 659, 784].map((f, i) => ({ t: { freq: f, dur: 0.4, gain: 0.08, delay: i * 0.1 } })).concat([{ t: { freq: 262, dur: 0.8, gain: 0.07, type: 'triangle' } }]), { send: 0.6, vary: 0 }); },
  bossIntro() {
    play('abilities', [{ t: { freq: 52, freqEnd: 40, dur: 2.0, type: 'sawtooth', gain: 0.2 } }, { t: { freq: 40, freqEnd: 28, dur: 2.2, type: 'sine', gain: 0.5 } }, { n: { dur: 1.8, freq: 160, freqEnd: 600, gain: 0.3 } }, { n: { dur: 0.05, freq: 3000, type: 'highpass', gain: 0.35 } }], { send: 0.8 });
    duck(0.3, 1.6, 2);
  },
  missionComplete() { play('ui', [392, 523, 659, 784, 1046].map((f, i) => ({ t: { freq: f, dur: 0.7, gain: 0.09, delay: i * 0.12 } })).concat([{ t: { freq: 196, dur: 1.4, gain: 0.09, type: 'triangle' } }]), { send: 0.7, vary: 0 }); duck(0.6, 1.2, 1.5); },
  chest() { play('abilities', [{ n: { dur: 0.4, freq: 500, freqEnd: 3000, type: 'bandpass', gain: 0.3 } }], { send: 0.4 }); sfx.engram(3); },
  ui() { play('ui', [{ t: { freq: 900, dur: 0.04, type: 'triangle', gain: 0.05 } }], { vary: 0 }); },
  // U21b Whisper feedback: every interaction answers with its own sound (right: bright and rising, wrong or lost: low and falling)
  /** Attunement is about to fade while you stand on a phase block: a short tick, faster and higher when under two seconds. */
  attuneTick(urgent) { play('ui', [{ t: { freq: urgent ? 1500 : 1100, dur: 0.05, type: 'square', gain: 0.045 } }], { vary: 0 }); },
  /** Attunement ended: two falling notes. */
  attuneFade() { play('ui', [{ t: { freq: 520, freqEnd: 400, dur: 0.22, type: 'triangle', gain: 0.07 } }, { t: { freq: 330, freqEnd: 220, dur: 0.4, type: 'triangle', gain: 0.07, delay: 0.14 } }], { vary: 0, send: 0.3 }); },
  /** A blight smothers your attunement. */
  attuneDrain() { play('ui', [{ t: { freq: 300, freqEnd: 70, dur: 0.5, type: 'sawtooth', gain: 0.07 } }, { n: { dur: 0.4, freq: 900, freqEnd: 200, type: 'bandpass', gain: 0.12 } }], { vary: 0 }); },
  /** A piston charges: a rising hum at its housing (spatial). */
  pistonHum(at) { play('abilities', [{ t: { freq: 70, freqEnd: 190, dur: 1.0, type: 'sawtooth', gain: 0.07 } }, { n: { dur: 1.0, freq: 300, freqEnd: 1400, type: 'bandpass', gain: 0.1 } }], { at, vary: 0, send: 0.2 }); },
  /** The piston slams out. */
  watcherAlarm(at) { play('abilities', [{ t: { freq: 740, dur: 0.16, type: 'square', gain: 0.06 } }, { t: { freq: 554, dur: 0.16, type: 'square', gain: 0.06, delay: 0.2 } }, { t: { freq: 740, dur: 0.16, type: 'square', gain: 0.06, delay: 0.4 } }], { at, vary: 0, send: 0.3 }); }, // U23 chunk B: an Imperial Watcher calls the guard
  beastHowl(at) { play('abilities', [{ t: { freq: 210, freqEnd: 520, dur: 1.3, type: 'sawtooth', gain: 0.09 } }, { t: { freq: 330, freqEnd: 170, dur: 1.6, type: 'triangle', gain: 0.07, delay: 0.5 } }, { n: { dur: 1.4, freq: 600, freqEnd: 250, type: 'bandpass', gain: 0.06 } }], { at, vary: 0, send: 0.6 }); }, // U23 chunk B: a Royal Beast has your scent
  pistonSlam(at) { play('abilities', [{ n: { dur: 0.16, freq: 1800, freqEnd: 300, type: 'bandpass', gain: 0.3 } }, { t: { freq: 90, freqEnd: 40, dur: 0.3, gain: 0.3 } }], { at, vary: 0, send: 0.3 }); },
  /** The piston hits you. */
  pistonHit() { play('abilities', [{ t: { freq: 140, freqEnd: 45, dur: 0.3, gain: 0.35 } }, { n: { dur: 0.12, freq: 900, type: 'bandpass', gain: 0.25 } }], { vary: 0 }); },
  /** A hidden eye shot: a pitched glassy ping, higher for each of the three. */
  hiddenEye(n) { const f = 660 * Math.pow(2, (n - 1) * 4 / 12); play('ui', [{ t: { freq: f, dur: 0.5, gain: 0.09 } }, { t: { freq: f * 2.01, dur: 0.35, gain: 0.04, type: 'triangle' } }], { send: 0.6, vary: 0 }); },
  /** The side path opens: a rising sweep and a chord. */
  pathOpen() { play('ui', [{ t: { freq: 220, freqEnd: 880, dur: 0.9, type: 'triangle', gain: 0.07 } }, ...[523, 659, 784, 1046].map((f, i) => ({ t: { freq: f, dur: 0.6, gain: 0.06, delay: 0.5 + i * 0.08 } }))], { send: 0.6, vary: 0 }); },
  /** A shot on a blight: a dull pulse. Destroyed: a burst. */
  blightHit() { play('abilities', [{ t: { freq: 170, freqEnd: 120, dur: 0.1, type: 'square', gain: 0.1 } }, { n: { dur: 0.08, freq: 2400, type: 'highpass', gain: 0.1 } }], { vary: 0 }); },
  blightDown() { play('abilities', [{ n: { dur: 0.45, freq: 2200, freqEnd: 400, type: 'bandpass', gain: 0.25 } }, { t: { freq: 440, freqEnd: 880, dur: 0.3, gain: 0.08 } }], { vary: 0, send: 0.4 }); },
  // ---- U32 dropships and U34 indoor arrivals. Ships use the abilities bus (they are far away, so no enemy distance cut); units use the enemies bus.
  /** A ship comes into view and flies to its hover spot: an engine swell. `kind`: cabal (deep, rough), fallen (thin, whining), hive (wet, droning). */
  shipIn(at, kind) {
    const k = SHIP_SND[kind] || SHIP_SND.cabal;
    play('abilities', [
      { t: { freq: k.f, freqEnd: k.f * 1.7, dur: 2.7, type: k.wave, gain: 0.09, attack: 1.9, vib: k.vib } },
      { n: { dur: 2.7, freq: k.nf, freqEnd: k.nf * 3, type: 'bandpass', q: 0.9, gain: 0.28, attack: 1.9 } },
    ], { at, gain: 2.2, send: 0.35, vary: 0.04 });
  },
  /** The ship holds over the drop point: a steady rumble for `dur` seconds. */
  shipHover(at, kind, dur = 1.5) {
    const k = SHIP_SND[kind] || SHIP_SND.cabal;
    play('abilities', [
      { t: { freq: k.f * 1.5, dur, type: k.wave, gain: 0.07, attack: 0.25, vib: k.vib || 9 } },
      { n: { dur, freq: k.nf * 0.8, type: 'lowpass', gain: 0.22, attack: 0.25 } },
    ], { at, gain: 2.2, send: 0.3, vary: 0.03 });
  },
  /** The ship climbs away. */
  shipOut(at, kind) {
    const k = SHIP_SND[kind] || SHIP_SND.cabal;
    play('abilities', [
      { t: { freq: k.f * 2.2, freqEnd: k.f * 0.8, dur: 2.4, type: k.wave, gain: 0.08, attack: 0.2, vib: k.vib } },
      { n: { dur: 2.4, freq: k.nf * 3, freqEnd: k.nf * 0.5, type: 'bandpass', q: 0.9, gain: 0.24, attack: 0.3 } },
    ], { at, gain: 2.0, send: 0.35 });
  },
  /** A dropped unit hits the ground. */
  dropLand(at) {
    if (throttled('dl', 90)) return;
    play('enemies', [{ t: { freq: 95, freqEnd: 40, dur: 0.22, type: 'sine', gain: 0.6 } }, { n: { dur: 0.16, freq: 900, freqEnd: 200, gain: 0.35 } }], { at, gain: 1.8, vary: 0.12, send: 0.25 });
  },
  /** A teleport gate charges (rising hum), then the unit steps out (crack and boom). */
  gateCharge(at, faction) {
    if (throttled('gc', 80)) return;
    const k = GATE_SND[faction] || GATE_SND.vex;
    play('enemies', [{ t: { freq: k.f, freqEnd: k.f * 2.4, dur: 0.9, type: k.wave, gain: 0.14, attack: 0.7, vib: k.vib } }, { n: { dur: 0.9, freq: k.nf, freqEnd: k.nf * 2.5, type: 'bandpass', q: 1.5, gain: 0.2, attack: 0.7 } }], { at, gain: 1.8, send: 0.35 });
  },
  gateOpen(at, faction) {
    if (throttled('go', 70)) return;
    const k = GATE_SND[faction] || GATE_SND.vex;
    play('enemies', [{ n: { dur: 0.22, freq: k.nf * 2, freqEnd: k.nf * 0.4, type: 'bandpass', q: 0.8, gain: 0.5, attack: 0.002, crunch: 1 } }, { t: { freq: k.f * 0.6, freqEnd: 38, dur: 0.35, type: 'sine', gain: 0.5 } }], { at, gain: 1.8, send: 0.4 });
  },
  /** Indoor arrival telegraph (1.5 s): a pod's engine screams down, a vent rattles and clangs, a crack rumbles and spits. Call once per kind per wave. */
  arrivalWarn(at, kind) {
    if (kind === 'pod') play('abilities', [{ t: { freq: 220, freqEnd: 700, dur: 1.5, type: 'sawtooth', gain: 0.08, attack: 1.2 } }, { n: { dur: 1.5, freq: 600, freqEnd: 2600, type: 'bandpass', q: 1.2, gain: 0.25, attack: 1.2 } }], { at, gain: 2, send: 0.5 });
    else if (kind === 'vent') play('abilities', [0, 0.18, 0.34, 0.5, 0.66, 0.8, 0.92, 1.04, 1.14, 1.24].map((d, i) => ({ n: { dur: 0.07, freq: 1700 + (i % 3) * 500, type: 'bandpass', q: 3, gain: 0.2 + i * 0.015, delay: d, attack: 0.001 } })).concat([{ t: { freq: 150, freqEnd: 110, dur: 1.4, type: 'square', gain: 0.05, attack: 0.5 } }]), { at, gain: 2, send: 0.5, vary: 0.05 });
    else play('abilities', [{ t: { freq: 55, freqEnd: 90, dur: 1.5, type: 'sawtooth', gain: 0.12, attack: 1.0, vib: 8 } }, { n: { dur: 1.5, freq: 250, freqEnd: 900, type: 'lowpass', gain: 0.28, attack: 1.0 } }, ...[0.3, 0.7, 1.0, 1.25].map((d) => ({ n: { dur: 0.09, freq: 3000, type: 'highpass', gain: 0.14, delay: d, attack: 0.001 } }))], { at, gain: 2, send: 0.5 });
  },
  /** The unit is out: a pod slams, a grate clangs down, a crack bursts wet. */
  arrivalOut(at, kind) {
    if (throttled('ao', 60)) return;
    if (kind === 'pod') play('enemies', [{ t: { freq: 110, freqEnd: 35, dur: 0.35, type: 'sine', gain: 0.65 } }, { n: { dur: 0.3, freq: 3500, freqEnd: 400, type: 'bandpass', q: 0.8, gain: 0.5 } }], { at, gain: 1.8, send: 0.4 });
    else if (kind === 'vent') play('enemies', [{ n: { dur: 0.25, freq: 2400, freqEnd: 700, type: 'bandpass', q: 4, gain: 0.5, attack: 0.001 } }, { t: { freq: 780, freqEnd: 520, dur: 0.3, type: 'triangle', gain: 0.18 } }, { t: { freq: 90, freqEnd: 40, dur: 0.25, type: 'sine', gain: 0.5, delay: 0.1 } }], { at, gain: 1.8, send: 0.4 });
    else play('enemies', [{ n: { dur: 0.3, freq: 800, freqEnd: 150, type: 'lowpass', gain: 0.55, attack: 0.002, crunch: 1 } }, { t: { freq: 150, freqEnd: 50, dur: 0.4, type: 'sawtooth', gain: 0.2, vib: 14 } }], { at, gain: 1.8, send: 0.4 });
  },
  /** A shot on an eye that is already lit (nothing changes): a faint tick. */
  eyeAgain() { play('ui', [{ t: { freq: 1320, dur: 0.05, type: 'triangle', gain: 0.03 } }], { vary: 0 }); },
};
