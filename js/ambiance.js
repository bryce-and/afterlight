// U33 Transmissions: planet ambiance. A synthesized bed per destination (wind, grit, a low drone and now and then a one-shot sound)
// that plays under the music and sets the place. Pure data in AMBIANCE; the WebAudio build is below. Routed to the Ambiance slider.
import { audioCtx, ambianceDest } from './audio.js';

/**
 * wind:  { lo, hi, gain, gust: [Hz, depth 0..1] }  band-passed noise with a slow gust LFO (centre = geometric mean of lo and hi)
 * hiss:  { hz, gain }                               fine high-passed noise (grit, rain, static)
 * drone: { freqs: [Hz], gain, type }                low tones that sit under everything
 * shots: [{ kind, gain, every: [min s, max s] }]    rare one-shot sounds (see SHOTS)
 */
export const AMBIANCE = {
  earth: { // Cosmodrome: cold wind through rusted metal
    wind: { lo: 260, hi: 1100, gain: 0.30, gust: [0.07, 0.6] }, hiss: { hz: 3500, gain: 0.015 }, drone: { freqs: [55, 82.4], gain: 0.05, type: 'sine' },
    shots: [{ kind: 'creak', gain: 0.10, every: [9, 20] }, { kind: 'clank', gain: 0.09, every: [14, 30] }, { kind: 'whistle', gain: 0.05, every: [12, 26] }],
  },
  moon: { // Hellmouth: cold, hollow, something is watching
    wind: { lo: 120, hi: 520, gain: 0.20, gust: [0.05, 0.5] }, hiss: { hz: 2500, gain: 0.008 }, drone: { freqs: [41.2, 61.7, 123.5], gain: 0.07, type: 'sine' },
    shots: [{ kind: 'wail', gain: 0.07, every: [18, 40] }, { kind: 'drip', gain: 0.08, every: [6, 14] }, { kind: 'rumble', gain: 0.10, every: [22, 45] }],
  },
  mars: { // Meridian Bay: a dusty desert, wind-driven grit and a low hum
    wind: { lo: 380, hi: 1500, gain: 0.34, gust: [0.09, 0.7] }, hiss: { hz: 4200, gain: 0.03 }, drone: { freqs: [49, 73.4], gain: 0.045, type: 'triangle' },
    shots: [{ kind: 'thud', gain: 0.10, every: [14, 32] }, { kind: 'creak', gain: 0.07, every: [16, 34] }, { kind: 'whistle', gain: 0.05, every: [10, 22] }],
  },
  io: { // Io: electric hum and far storms
    wind: { lo: 200, hi: 800, gain: 0.16, gust: [0.06, 0.5] }, hiss: { hz: 5000, gain: 0.02 }, drone: { freqs: [60, 90, 120], gain: 0.06, type: 'sawtooth' },
    shots: [{ kind: 'crackle', gain: 0.10, every: [6, 16] }, { kind: 'rumble', gain: 0.12, every: [18, 38] }, { kind: 'ping', gain: 0.05, every: [14, 30] }],
  },
  titan: { // New Pacific Arcology: methane storm and groaning rigs
    wind: { lo: 140, hi: 900, gain: 0.34, gust: [0.11, 0.7] }, hiss: { hz: 3000, gain: 0.05 }, drone: { freqs: [46.2, 69.3], gain: 0.07, type: 'sine' },
    shots: [{ kind: 'clank', gain: 0.10, every: [10, 24] }, { kind: 'steam', gain: 0.07, every: [12, 28] }, { kind: 'rumble', gain: 0.10, every: [18, 36] }],
  },
  tangled: { // Tangled Shore: station creaks, crackling ether, distant engines
    wind: { lo: 100, hi: 420, gain: 0.12, gust: [0.04, 0.4] }, hiss: { hz: 5200, gain: 0.02 }, drone: { freqs: [55, 110, 165], gain: 0.06, type: 'triangle' },
    shots: [{ kind: 'creak', gain: 0.10, every: [8, 18] }, { kind: 'clank', gain: 0.08, every: [12, 26] }, { kind: 'ping', gain: 0.05, every: [12, 28] }, { kind: 'crackle', gain: 0.06, every: [16, 34] }],
  },
  dc: { // Dreaming City: airy, bright, crystal chimes in a violet mist
    wind: { lo: 500, hi: 2600, gain: 0.16, gust: [0.06, 0.5] }, hiss: { hz: 6000, gain: 0.01 }, drone: { freqs: [65.4, 98, 130.8], gain: 0.05, type: 'sine' },
    shots: [{ kind: 'chime', gain: 0.09, every: [5, 12] }, { kind: 'whistle', gain: 0.04, every: [14, 30] }],
  },
  leviathan: { // Leviathan: a vast gilded hall, a deep resonant hum
    wind: { lo: 90, hi: 380, gain: 0.10, gust: [0.03, 0.3] }, hiss: { hz: 3000, gain: 0.005 }, drone: { freqs: [43.7, 65.4, 87.3, 130.8], gain: 0.09, type: 'sine' },
    shots: [{ kind: 'gong', gain: 0.10, every: [20, 40] }, { kind: 'chime', gain: 0.06, every: [10, 22] }],
  },
  tower: { // The Tower: high wind, a city far below, a distant bell
    wind: { lo: 300, hi: 1300, gain: 0.22, gust: [0.08, 0.6] }, hiss: { hz: 3500, gain: 0.01 }, drone: { freqs: [55, 82.4], gain: 0.035, type: 'sine' },
    shots: [{ kind: 'chime', gain: 0.07, every: [10, 24] }, { kind: 'whistle', gain: 0.05, every: [12, 26] }],
  },
  orbit: { // Orbit: very quiet, a low hum
    wind: null, hiss: { hz: 1800, gain: 0.006 }, drone: { freqs: [55, 82.4], gain: 0.045, type: 'sine' },
    shots: [{ kind: 'ping', gain: 0.04, every: [20, 40] }],
  },
};

/** The bed for a destination id; an unknown id plays no ambiance. */
export const ambianceFor = (id) => AMBIANCE[id] || null;

let curId = null, cur = null, timer = null;
let noiseBuf = null;
const rand = (a, b) => a + Math.random() * (b - a);

function noise(ctx) {
  if (noiseBuf) return noiseBuf;
  const len = ctx.sampleRate * 6;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0; // a little pink-ish tilt
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
  }
  // seamless loop: crossfade the last 0.3 s into the start
  const x = Math.floor(ctx.sampleRate * 0.3);
  for (let i = 0; i < x; i++) { const f = i / x; d[len - x + i] = d[len - x + i] * (1 - f) + d[i] * f; }
  return noiseBuf;
}

// One-shot sounds: each is a few oscillators and a noise burst through the bed's own output.
const SHOTS = {
  thud(ctx, out, g, t) { env(ctx, out, osc(ctx, 'sine', 70, t, 0.6, 38), g, t, 0.01, 0.5); },
  rumble(ctx, out, g, t) { const f = bp(ctx, 90, 0.8); noiseTo(ctx, f, t, 3); env(ctx, out, f, g * 2.4, t, 1.2, 2.2); },
  creak(ctx, out, g, t) { const o = osc(ctx, 'sawtooth', rand(140, 260), t, 1.4, rand(-40, 60)); const f = bp(ctx, 700, 6); o.connect(f); env(ctx, out, f, g * 0.7, t, 0.25, 1.1); },
  clank(ctx, out, g, t) { for (const fr of [rand(520, 640), rand(1300, 1700), rand(2400, 3100)]) env(ctx, out, osc(ctx, 'sine', fr, t, 1.2), g * 0.4, t, 0.003, 0.9); },
  whistle(ctx, out, g, t) { const f = bp(ctx, rand(900, 1500), 14); noiseTo(ctx, f, t, 2.8); env(ctx, out, f, g * 4, t, 1.0, 1.7); },
  wail(ctx, out, g, t) { const o = osc(ctx, 'sine', 320, t, 4, -110); const v = ctx.createOscillator(); v.frequency.value = 5; const vg = ctx.createGain(); vg.gain.value = 9; v.connect(vg).connect(o.frequency); v.start(t); v.stop(t + 4.2); env(ctx, out, o, g, t, 1.4, 2.6); },
  drip(ctx, out, g, t) { env(ctx, out, osc(ctx, 'sine', rand(1100, 1700), t, 0.2, -300), g, t, 0.004, 0.18); },
  crackle(ctx, out, g, t) { for (let i = 0; i < 6; i++) { const f = hp(ctx, rand(2500, 5000)); noiseTo(ctx, f, t + i * rand(0.02, 0.09), 0.05); env(ctx, out, f, g, t + i * 0.05, 0.002, 0.05); } },
  ping(ctx, out, g, t) { env(ctx, out, osc(ctx, 'sine', rand(900, 1400), t, 1.6), g * 0.6, t, 0.004, 1.4); },
  steam(ctx, out, g, t) { const f = hp(ctx, 3200); noiseTo(ctx, f, t, 2.4); env(ctx, out, f, g * 1.6, t, 0.25, 1.9); },
  chime(ctx, out, g, t) { const base = [523.3, 659.3, 784, 880, 1046.5][Math.floor(Math.random() * 5)]; for (const m of [1, 2.76]) env(ctx, out, osc(ctx, 'sine', base * m, t, 3.5), g * (m === 1 ? 0.7 : 0.2), t, 0.006, 3.2); },
  gong(ctx, out, g, t) { for (const m of [1, 1.51, 2.32]) env(ctx, out, osc(ctx, 'sine', 98 * m, t, 6), g * (m === 1 ? 0.8 : 0.3), t, 0.04, 5.4); },
};
export const SHOT_KINDS = Object.keys(SHOTS);

function osc(ctx, type, f, t, dur, sweep = 0) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (sweep) o.frequency.linearRampToValueAtTime(Math.max(20, f + sweep), t + dur);
  o.start(t); o.stop(t + dur + 0.1);
  return o;
}
function bp(ctx, f, q) { const n = ctx.createBiquadFilter(); n.type = 'bandpass'; n.frequency.value = f; n.Q.value = q; return n; }
function hp(ctx, f) { const n = ctx.createBiquadFilter(); n.type = 'highpass'; n.frequency.value = f; return n; }
function noiseTo(ctx, dest, t, dur) { const s = ctx.createBufferSource(); s.buffer = noise(ctx); s.loop = true; s.connect(dest); s.start(t, rand(0, 3)); s.stop(t + dur + 0.1); }
/** Gain envelope: a fast attack then a decay, into `out`. `src` is a node that is already started. */
function env(ctx, out, src, g, t, atk, dec) {
  const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t);
  e.gain.linearRampToValueAtTime(g, t + atk); e.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
  src.connect(e).connect(out);
}

function build(ctx, def) {
  const out = ctx.createGain(); out.gain.value = 0; out.connect(ambianceDest());
  const nodes = [];
  const t0 = ctx.currentTime;
  if (def.wind) {
    const w = def.wind, mid = Math.sqrt(w.lo * w.hi);
    const src = ctx.createBufferSource(); src.buffer = noise(ctx); src.loop = true; src.loopStart = 0; src.loopEnd = 5.7;
    const f = bp(ctx, mid, 0.55);
    const g = ctx.createGain(); g.gain.value = w.gain * (1 - w.gust[1] * 0.5);
    src.connect(f).connect(g).connect(out); src.start(t0, rand(0, 4));
    const lfo = ctx.createOscillator(); lfo.frequency.value = w.gust[0]; const lg = ctx.createGain(); lg.gain.value = w.gain * w.gust[1] * 0.5; lfo.connect(lg).connect(g.gain); lfo.start(t0);
    const lf2 = ctx.createOscillator(); lf2.frequency.value = w.gust[0] * 0.63; const lg2 = ctx.createGain(); lg2.gain.value = mid * 0.35; lf2.connect(lg2).connect(f.frequency); lf2.start(t0);
    nodes.push(src, lfo, lf2);
  }
  if (def.hiss) {
    const src = ctx.createBufferSource(); src.buffer = noise(ctx); src.loop = true; src.loopStart = 0; src.loopEnd = 5.7;
    const f = hp(ctx, def.hiss.hz); const g = ctx.createGain(); g.gain.value = def.hiss.gain;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11; const lg = ctx.createGain(); lg.gain.value = def.hiss.gain * 0.5; lfo.connect(lg).connect(g.gain); lfo.start(t0);
    src.connect(f).connect(g).connect(out); src.start(t0, rand(0, 4)); nodes.push(src, lfo);
  }
  if (def.drone) {
    def.drone.freqs.forEach((fr, i) => {
      const o = ctx.createOscillator(); o.type = def.drone.type; o.frequency.value = fr;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      const g = ctx.createGain(); g.gain.value = def.drone.gain / def.drone.freqs.length;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.04 + i * 0.013; const lg = ctx.createGain(); lg.gain.value = 3 + i; lfo.connect(lg).connect(o.detune); lfo.start(t0);
      o.connect(lp).connect(g).connect(out); o.start(t0); nodes.push(o, lfo);
    });
  }
  out.gain.setTargetAtTime(1, t0, 1.6); // fade in
  const next = (def.shots || []).map((s) => t0 + rand(s.every[0] * 0.4, s.every[1] * 0.7)); // first one-shots a little sooner
  return { out, nodes, def, next };
}

function tick() {
  const ctx = audioCtx();
  if (!ctx || !cur || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  cur.def.shots?.forEach((s, i) => {
    if (now < cur.next[i]) return;
    SHOTS[s.kind]?.(ctx, cur.out, s.gain, now + 0.05);
    cur.next[i] = now + rand(s.every[0], s.every[1]);
  });
}

/** Start (or switch to) a destination's ambiance: a location id, 'tower' or 'orbit'. */
export function startAmbiance(id) {
  const ctx = audioCtx();
  if (!ctx || !ambianceDest() || curId === id) return;
  stopAmbiance();
  const def = ambianceFor(id);
  curId = id;
  if (!def) return;
  cur = build(ctx, def);
  if (!timer) timer = setInterval(tick, 400);
}

/** Fade the current ambiance out and release its nodes. */
export function stopAmbiance() {
  const ctx = audioCtx();
  const old = cur; cur = null; curId = null;
  if (!old || !ctx) return;
  old.out.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
  setTimeout(() => { for (const n of old.nodes) { try { n.stop(); } catch (e) { /* already stopped */ } } old.out.disconnect(); }, 3000);
}

export const currentAmbiance = () => curId;
