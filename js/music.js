// Original generative score. Every destination has its own key, tempo, chord
// progression and seeded motif; layers build with combat and a heavier boss
// section fades in during boss fights. All sound is synthesized (no files).
import { audioCtx } from './audio.js';
import { mulberry32, hashStr } from './util.js';

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

// root = MIDI note of the key; prog = scale degrees (0-based) per bar
const THEMES = {
  orbit: { root: 51, scale: MAJOR, tempo: 64, prog: [0, 5, 3, 4], pad: 'strings', lead: 'bell', drums: null, choir: 0.5 },
  earth: { root: 50, scale: MINOR, tempo: 84, prog: [0, 5, 2, 6], pad: 'strings', lead: 'bell', drums: 'taiko', choir: 0.8 },
  moon: { root: 49, scale: PHRYGIAN, tempo: 70, prog: [0, 1, 0, 4], pad: 'drone', lead: 'glass', drums: 'deep', choir: 1 },
  mars: { root: 52, scale: MINOR, tempo: 96, prog: [0, 3, 5, 4], pad: 'strings', lead: 'brass', drums: 'war', choir: 0.5 },
  titan: { root: 45, scale: DORIAN, tempo: 78, prog: [0, 6, 3, 0], pad: 'drone', lead: 'pluck', drums: 'pulse', choir: 0.6 },
  tangled: { root: 55, scale: MINOR, tempo: 100, prog: [0, 6, 5, 4], pad: 'strings', lead: 'pluck', drums: 'drive', choir: 0.4 },
};

let bus = null, verb = null, layers = null, timer = null;
let theme = null, themeId = null, section = 'explore', step = 0, nextT = 0, motif = [];
let volume = 0.5, want = { combat: 0, boss: 0 };

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function ensureGraph() {
  const ctx = audioCtx();
  if (!ctx || bus) return ctx;
  bus = ctx.createGain();
  bus.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3;
  bus.connect(comp).connect(ctx.destination);
  // generated hall reverb
  verb = ctx.createConvolver();
  const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  verb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.55;
  verb.connect(wet).connect(bus);
  layers = {};
  for (const k of ['base', 'combat', 'boss']) { layers[k] = ctx.createGain(); layers[k].gain.value = k === 'base' ? 1 : 0; layers[k].connect(bus); }
  return ctx;
}

// ---------------------------------------------------------------------------
// Instruments: each schedules its own short-lived nodes at time t
// ---------------------------------------------------------------------------
function env(ctx, g, t, a, peak, hold, rel) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  return t + a + hold + rel + 0.05;
}
function out(ctx, node, layer, send = 0.4) {
  node.connect(layers[layer]);
  if (send > 0) { const s = ctx.createGain(); s.gain.value = send; node.connect(s).connect(verb); }
}
function osc(ctx, type, f, t, end, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.value = f; o.detune.value = detune;
  o.start(t); o.stop(end);
  return o;
}

function pad(ctx, t, notes, dur, kind, layer = 'base', level = 0.05) {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = kind === 'drone' ? 520 : 1100; f.Q.value = 0.4;
  const end = env(ctx, g, t, kind === 'drone' ? 2.4 : 1.4, level, dur - 1.2, 2.2);
  for (const n of notes) for (const dt of [-8, 7]) osc(ctx, kind === 'drone' ? 'triangle' : 'sawtooth', midi(n), t, end, dt).connect(f);
  f.connect(g); out(ctx, g, layer, 0.6);
}
function choir(ctx, t, notes, dur, level, layer = 'base') {
  const g = ctx.createGain();
  const end = env(ctx, g, t, 1.8, level, dur - 1.4, 2.4);
  for (const formant of [700, 1150]) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = formant; bp.Q.value = 6;
    for (const n of notes) osc(ctx, 'sawtooth', midi(n + 12), t, end, (Math.random() - 0.5) * 14).connect(bp);
    bp.connect(g);
  }
  out(ctx, g, layer, 0.8);
}
function bass(ctx, t, n, dur, layer = 'base', level = 0.12) {
  const g = ctx.createGain(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
  const end = env(ctx, g, t, 0.08, level, dur * 0.6, dur * 0.5);
  osc(ctx, 'sine', midi(n), t, end).connect(f); osc(ctx, 'triangle', midi(n + 12), t, end).connect(f);
  f.connect(g); out(ctx, g, layer, 0.1);
}
function lead(ctx, t, n, kind, layer = 'base', level = 0.06) {
  const g = ctx.createGain();
  if (kind === 'bell' || kind === 'glass') {
    const end = env(ctx, g, t, 0.005, level, 0, kind === 'glass' ? 3.2 : 2.2);
    osc(ctx, 'sine', midi(n + 12), t, end).connect(g);
    const h = ctx.createGain(); h.gain.value = 0.35; osc(ctx, 'sine', midi(n + 12) * (kind === 'glass' ? 3.41 : 2.76), t, end).connect(h).connect(g);
  } else if (kind === 'pluck') {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.5);
    const end = env(ctx, g, t, 0.004, level * 1.2, 0, 0.7);
    osc(ctx, 'triangle', midi(n + 12), t, end).connect(f); osc(ctx, 'square', midi(n), t, end).connect(f);
    f.connect(g);
  } else { // brass
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1800, t + 0.12); f.frequency.exponentialRampToValueAtTime(700, t + 0.8);
    const end = env(ctx, g, t, 0.06, level, 0.4, 0.6);
    for (const dt of [-6, 6]) osc(ctx, 'sawtooth', midi(n), t, end, dt).connect(f);
    f.connect(g);
  }
  out(ctx, g, layer, 0.5);
}
function drum(ctx, t, kind, layer, level = 0.5) {
  const g = ctx.createGain();
  if (kind === 'kick' || kind === 'taiko' || kind === 'tom') {
    const f0 = kind === 'kick' ? 120 : kind === 'taiko' ? 90 : 150;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.35, t + 0.25);
    const end = env(ctx, g, t, 0.003, level, 0, kind === 'taiko' ? 0.9 : 0.4);
    o.start(t); o.stop(end); o.connect(g);
    out(ctx, g, layer, kind === 'taiko' ? 0.5 : 0.15);
    return;
  }
  // snare / hat: filtered noise
  const ctxNoise = ctx.createBufferSource();
  const len = ctx.sampleRate * 0.4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  ctxNoise.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
  const end = env(ctx, g, t, 0.002, level * (kind === 'hat' ? 0.25 : 0.6), 0, kind === 'hat' ? 0.06 : 0.22);
  ctxNoise.connect(f).connect(g); ctxNoise.start(t); ctxNoise.stop(end);
  out(ctx, g, layer, 0.2);
}

// ---------------------------------------------------------------------------
// Sequencer (16th-note steps, one chord per bar)
// ---------------------------------------------------------------------------
function chordNotes(deg) {
  const sc = theme.scale, note = (d) => theme.root + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  return [note(deg), note(deg + 2), note(deg + 4)];
}

function makeMotif(id) {
  // a seeded, stepwise 8-note phrase: original per destination
  const rng = mulberry32(hashStr(`motif-${id}`));
  let d = 4; const m = [];
  for (let i = 0; i < 8; i++) { d += Math.round((rng() - 0.5) * 3.2); d = Math.max(0, Math.min(9, d)); m.push(rng() < 0.18 ? null : d); }
  return m;
}

function scheduleStep(ctx, s, t) {
  const spb = 60 / theme.tempo, stepLen = spb / 4, bar = Math.floor(s / 16), pos = s % 16;
  const boss = section === 'boss';
  const prog = boss ? [0, 5, 6, 0] : theme.prog;
  const chord = chordNotes(prog[bar % prog.length]);
  const barLen = stepLen * 16;
  if (pos === 0) {
    pad(ctx, t, chord, barLen, theme.pad, 'base', boss ? 0.045 : 0.05);
    if (theme.choir) choir(ctx, t, chord, barLen, 0.012 * theme.choir * (boss ? 1.6 : 1), 'base');
    bass(ctx, t, chord[0] - 12, barLen * 0.9);
  }
  // melody: the motif every other bar (every bar in combat), 8th notes
  const melodyBar = boss || want.combat > 0.5 ? true : bar % 2 === 1;
  if (melodyBar && pos % 2 === 0) {
    const d = motif[(pos / 2 + bar * 3) % motif.length];
    if (d !== null) {
      const sc = theme.scale, n = theme.root + sc[d % 7] + 12 * Math.floor(d / 7);
      lead(ctx, t, n, theme.lead, 'base', boss ? 0.05 : 0.045);
    }
  }
  // combat layer: drums + driving bass pulse
  const dk = theme.drums;
  if (dk) {
    if (dk === 'taiko' || dk === 'deep') { if (pos === 0 || pos === 10) drum(ctx, t, 'taiko', 'combat', dk === 'deep' ? 0.6 : 0.5); if (pos === 6 || pos === 14) drum(ctx, t, 'tom', 'combat', 0.25); }
    else if (dk === 'war') { if (pos % 4 === 0) drum(ctx, t, 'kick', 'combat', 0.45); if (pos === 4 || pos === 12) drum(ctx, t, 'snare', 'combat', 0.5); if (pos % 2 === 0) drum(ctx, t, 'hat', 'combat'); }
    else if (dk === 'pulse') { if (pos % 4 === 0) drum(ctx, t, 'kick', 'combat', 0.4); bass(ctx, t, chord[0] - 12, stepLen * 0.9, 'combat', 0.05); }
    else if (dk === 'drive') { if (pos % 4 === 0) drum(ctx, t, 'kick', 'combat', 0.45); if (pos === 4 || pos === 12) drum(ctx, t, 'snare', 'combat', 0.45); drum(ctx, t, 'hat', 'combat', 0.7); }
    if (pos % 4 === 2) lead(ctx, t, chord[(pos / 4) % 3 | 0] , 'pluck', 'combat', 0.03);
  }
  // boss layer: heavy drums and brass stabs
  if (pos % 4 === 0) drum(ctx, t, pos % 8 === 0 ? 'taiko' : 'kick', 'boss', 0.6);
  if (pos === 4 || pos === 12) drum(ctx, t, 'snare', 'boss', 0.55);
  if (pos % 2 === 0) drum(ctx, t, 'hat', 'boss', 0.8);
  if (pos === 0 || pos === 3 || pos === 8) lead(ctx, t, chord[0] - 12, 'brass', 'boss', 0.05);
  if (pos === 0) choir(ctx, t, chord, barLen, 0.02, 'boss');
}

function tick() {
  const ctx = audioCtx();
  if (!ctx || !theme || !bus) return;
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05; // fell behind (tab was hidden)
  while (nextT < ctx.currentTime + 0.25) {
    scheduleStep(ctx, step, nextT);
    nextT += 60 / theme.tempo / 4;
    step++;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function setMusicVolume(v) {
  volume = v;
  const ctx = audioCtx();
  if (bus && ctx && themeId) bus.gain.setTargetAtTime(v * 0.6, ctx.currentTime, 0.3);
}

/** Start (or switch to) a destination's theme: 'orbit' | location id. */
export function playMusic(id) {
  const ctx = ensureGraph();
  if (!ctx || themeId === id) return;
  const t = THEMES[id] || THEMES.earth;
  const fadeIn = () => {
    theme = t; themeId = id; motif = makeMotif(id); step = 0; nextT = ctx.currentTime + 0.1;
    setSection('explore', true);
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setTargetAtTime(volume * 0.6, ctx.currentTime, 0.8);
    if (!timer) timer = setInterval(tick, 50);
  };
  if (themeId) { bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4); themeId = null; setTimeout(fadeIn, 1200); }
  else fadeIn();
}

export function stopMusic() {
  const ctx = audioCtx();
  if (!ctx || !bus) return;
  bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5);
  themeId = null;
  setTimeout(() => { if (!themeId) { theme = null; clearInterval(timer); timer = null; } }, 2500);
}

/** 'explore' | 'combat' | 'boss': crossfades the layers. */
export function setSection(s, now = false) {
  const ctx = audioCtx();
  if (!ctx || !layers || (s === section && !now)) return;
  section = s;
  want = { combat: s === 'explore' ? 0 : 1, boss: s === 'boss' ? 1 : 0 };
  const tc = now ? 0.05 : s === 'boss' ? 1.2 : 0.9;
  layers.combat.gain.setTargetAtTime(want.combat * (s === 'boss' ? 0.5 : 1), ctx.currentTime, tc);
  layers.boss.gain.setTargetAtTime(want.boss, ctx.currentTime, tc);
}
