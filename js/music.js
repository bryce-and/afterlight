// Original generative score. Every destination has its own key, tempo, chord
// progression and seeded motif. U12 Resonance: four sections (explore is sparse and ambient,
// tense adds low strings and a pulse, combat is orchestral with brass and timpani, boss is the
// heaviest), phrases that vary every 8 bars, and short stingers. All sound is synthesized (no files).
import { audioCtx, musicDest } from './audio.js';
import { mulberry32, hashStr } from './util.js';

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

// root = MIDI note of the key; prog = scale degrees (0-based) per bar
const THEMES = {
  tower: { root: 53, scale: MAJOR, tempo: 72, prog: [0, 3, 4, 0], pad: 'strings', lead: 'bell', drums: null, choir: 0.7 }, // U16: the Tower, warm and open
  orbit: { root: 51, scale: MAJOR, tempo: 64, prog: [0, 5, 3, 4], pad: 'strings', lead: 'bell', drums: null, choir: 0.5 },
  earth: { root: 50, scale: MINOR, tempo: 84, prog: [0, 5, 2, 6], pad: 'strings', lead: 'bell', drums: 'taiko', choir: 0.8 },
  moon: { root: 49, scale: PHRYGIAN, tempo: 70, prog: [0, 1, 0, 4], pad: 'drone', lead: 'glass', drums: 'deep', choir: 1 },
  mars: { root: 52, scale: MINOR, tempo: 96, prog: [0, 3, 5, 4], pad: 'strings', lead: 'brass', drums: 'war', choir: 0.5 },
  titan: { root: 45, scale: DORIAN, tempo: 78, prog: [0, 6, 3, 0], pad: 'drone', lead: 'pluck', drums: 'pulse', choir: 0.6 },
  tangled: { root: 55, scale: MINOR, tempo: 100, prog: [0, 6, 5, 4], pad: 'strings', lead: 'pluck', drums: 'drive', choir: 0.4 },
  io: { root: 47, scale: DORIAN, tempo: 76, prog: [0, 3, 6, 4], pad: 'drone', lead: 'glass', drums: 'deep', choir: 0.9 },
  dc: { root: 57, scale: DORIAN, tempo: 70, prog: [0, 4, 5, 3], pad: 'strings', lead: 'bell', drums: 'deep', choir: 1 },
  leviathan: { root: 48, scale: PHRYGIAN, tempo: 92, prog: [0, 1, 4, 0], pad: 'strings', lead: 'brass', drums: 'war', choir: 0.7 },
};

let bus = null, verb = null, layers = null, timer = null;
let theme = null, themeId = null, section = 'explore', step = 0, nextT = 0, motif = [], lastChange = 0;
let volume = 0.5, want = { tense: 0, combat: 0, boss: 0 };

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function ensureGraph() {
  const ctx = audioCtx();
  if (!ctx || bus) return ctx;
  bus = ctx.createGain();
  bus.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3;
  bus.connect(comp).connect(musicDest() || ctx.destination);
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
  for (const k of ['base', 'tense', 'combat', 'boss']) { layers[k] = ctx.createGain(); layers[k].gain.value = k === 'base' ? 1 : 0; layers[k].connect(bus); }
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

let noiseB = null;
function noiseSrc(ctx) {
  if (!noiseB) {
    noiseB = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseB.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const n = ctx.createBufferSource(); n.buffer = noiseB; n.loop = true;
  return n;
}
/** String section: detuned saws with a slow bow attack and a gentle vibrato. */
function strings(ctx, t, notes, dur, layer = 'base', level = 0.05, bright = 1400) {
  const g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = bright; f.Q.value = 0.3;
  const end = env(ctx, g, t, Math.min(0.5, dur * 0.4), level, Math.max(0.05, dur - 0.9), 0.7);
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 5.2; lg.gain.value = 9; lfo.start(t); lfo.stop(end); lfo.connect(lg);
  for (const n of notes) for (const dt of [-9, 0, 9]) { const o = osc(ctx, 'sawtooth', midi(n), t, end, dt); lg.connect(o.detune); o.connect(f); }
  f.connect(g); out(ctx, g, layer, 0.55);
}
/** Noise riser that builds, then drops. */
function swell(ctx, t, dur, layer = 'tense', level = 0.05) {
  const n = noiseSrc(ctx), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'bandpass'; f.Q.value = 1.1;
  f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(5200, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + dur * 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
  n.connect(f).connect(g); n.start(t); n.stop(t + dur + 0.2);
  out(ctx, g, layer, 0.5);
}
function crash(ctx, t, layer, level = 0.12) {
  const n = noiseSrc(ctx), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'highpass'; f.frequency.value = 4800;
  const end = env(ctx, g, t, 0.004, level, 0, 2.2);
  n.connect(f).connect(g); n.start(t); n.stop(end); out(ctx, g, layer, 0.5);
}
function boom(ctx, t, layer, level = 0.5) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(26, t + 1.4);
  const end = env(ctx, g, t, 0.004, level, 0, 1.6);
  o.start(t); o.stop(end); o.connect(g); out(ctx, g, layer, 0.4);
}

// ---------------------------------------------------------------------------
// Sequencer (16th-note steps, one chord per bar)
// ---------------------------------------------------------------------------
function chordNotes(deg) {
  const sc = theme.scale, note = (d) => theme.root + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  return [note(deg), note(deg + 2), note(deg + 4)];
}

function makeMotif(id, variant = 0) {
  // a seeded, stepwise 8-note phrase: original per destination (variant 0 is the signature theme)
  const rng = mulberry32(hashStr(variant ? `motif-${id}-${variant}` : `motif-${id}`));
  let d = 4; const m = [];
  for (let i = 0; i < 8; i++) { d += Math.round((rng() - 0.5) * 3.2); d = Math.max(0, Math.min(9, d)); m.push(rng() < 0.18 ? null : d); }
  return m;
}

// Pure director: picks the next section from the nearest enemy and boss distances. Entering a
// section takes a smaller distance than staying in it, so the music doesn't flip-flop.
export function musicSectionFor(prev, nearest, bossDist) {
  const was = (...a) => a.includes(prev);
  if (bossDist < (prev === 'boss' ? 85 : 70)) return 'boss';
  if (nearest < (was('combat', 'boss') ? 50 : 35)) return 'combat';
  if (nearest < (was('tense', 'combat', 'boss') ? 95 : 70)) return 'tense';
  return 'explore';
}

const AMBIENT_LEAD = { bell: 'bell', glass: 'glass', pluck: 'bell', brass: 'bell' };

function scheduleStep(ctx, s, t) {
  const spb = 60 / theme.tempo, stepLen = spb / 4, bar = Math.floor(s / 16), pos = s % 16;
  const barLen = stepLen * 16, phrase = Math.floor(bar / 8);
  const boss = section === 'boss', combat = section === 'combat' || boss, tense = section !== 'explore';
  if (pos === 0 && bar % 8 === 0 && bar > 0) motif = makeMotif(themeId, phrase % 4); // a new phrase every 8 bars
  let prog = boss ? [0, 5, 6, 0] : theme.prog;
  if (phrase % 2 === 1) prog = prog.map((_, i) => prog[(i + 1) % prog.length]); // alternate phrases rotate the progression
  const chord = chordNotes(prog[bar % prog.length]);
  const settling = ctx.currentTime - lastChange < 5; // keep fading layers fed until they are silent
  const hot = (k) => want[k] > 0 || settling;

  // ambient bed: always on. Sparse in explore, with a rising bell phrase every fourth bar.
  if (pos === 0) {
    pad(ctx, t, chord, barLen, theme.pad, 'base', boss ? 0.045 : 0.05);
    strings(ctx, t, [chord[0], chord[2]], barLen, 'base', combat ? 0.03 : 0.018, combat ? 1800 : 900);
    if (theme.choir) choir(ctx, t, chord, barLen, 0.012 * theme.choir * (boss ? 1.6 : 1), 'base');
    bass(ctx, t, chord[0] - 12, barLen * 0.9);
  }
  const melodyBar = combat ? true : tense ? bar % 2 === 1 : bar % 4 === 3;
  if (melodyBar && pos % (combat ? 2 : 4) === 0) {
    const d = motif[(pos / 2 + bar * 3) % motif.length];
    if (d !== null) {
      const sc = theme.scale, n = theme.root + sc[d % 7] + 12 * Math.floor(d / 7);
      lead(ctx, t, n, combat ? theme.lead : AMBIENT_LEAD[theme.lead] || 'bell', 'base', boss ? 0.05 : combat ? 0.045 : 0.035);
    }
  }

  // tense layer: low string pulse, heartbeat, a riser before every fourth bar
  if (hot('tense')) {
    if (pos === 0) strings(ctx, t, [chord[0] - 12, chord[1] - 12], barLen, 'tense', 0.05, 700);
    if (pos % 2 === 0) bass(ctx, t, chord[0] - 12, stepLen * 1.7, 'tense', 0.05);
    if (pos === 0 || pos === 10) drum(ctx, t, 'tom', 'tense', 0.28);
    if (bar % 4 === 3 && pos === 0) swell(ctx, t, barLen, 'tense', 0.045);
  }

  // combat layer: orchestral. Drums, string stabs, brass swells, timpani roll, cymbal crash.
  if (hot('combat')) {
    const dk = theme.drums;
    if (dk) {
      if (dk === 'taiko' || dk === 'deep') { if (pos === 0 || pos === 10) drum(ctx, t, 'taiko', 'combat', dk === 'deep' ? 0.6 : 0.5); if (pos === 6 || pos === 14) drum(ctx, t, 'tom', 'combat', 0.25); }
      else if (dk === 'war') { if (pos % 4 === 0) drum(ctx, t, 'kick', 'combat', 0.45); if (pos === 4 || pos === 12) drum(ctx, t, 'snare', 'combat', 0.5); if (pos % 2 === 0) drum(ctx, t, 'hat', 'combat'); }
      else if (dk === 'pulse') { if (pos % 4 === 0) drum(ctx, t, 'kick', 'combat', 0.4); bass(ctx, t, chord[0] - 12, stepLen * 0.9, 'combat', 0.05); }
      else if (dk === 'drive') { if (pos % 4 === 0) drum(ctx, t, 'kick', 'combat', 0.45); if (pos === 4 || pos === 12) drum(ctx, t, 'snare', 'combat', 0.45); drum(ctx, t, 'hat', 'combat', 0.7); }
      if (pos % 4 === 2) lead(ctx, t, chord[(pos / 4) % 3 | 0], 'pluck', 'combat', 0.03);
    }
    if (pos === 0 || pos === 6 || pos === 10) strings(ctx, t, chord.map((n) => n + 12), stepLen * 2.4, 'combat', 0.035, 2600);
    if (pos === 0) lead(ctx, t, chord[0], 'brass', 'combat', 0.04);
    if (bar % 4 === 3 && pos >= 12) drum(ctx, t, 'tom', 'combat', 0.12 + (pos - 12) * 0.07); // timpani roll into the next phrase
    if (bar % 4 === 0 && pos === 0) crash(ctx, t, 'combat', 0.08);
  }

  // boss layer: heavy drums, brass stabs and booms
  if (hot('boss')) {
    if (pos % 4 === 0) drum(ctx, t, pos % 8 === 0 ? 'taiko' : 'kick', 'boss', 0.6);
    if (pos === 4 || pos === 12) drum(ctx, t, 'snare', 'boss', 0.55);
    if (pos % 2 === 0) drum(ctx, t, 'hat', 'boss', 0.8);
    if (pos === 0 || pos === 3 || pos === 8) lead(ctx, t, chord[0] - 12, 'brass', 'boss', 0.05);
    if (pos === 0) { choir(ctx, t, chord, barLen, 0.02, 'boss'); strings(ctx, t, [chord[0] - 12, chord[0], chord[1]], barLen, 'boss', 0.04, 2200); }
    if (pos === 0 && bar % 2 === 0) boom(ctx, t, 'boss', 0.35);
  }
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

export const getSection = () => section;

/** 'explore' | 'tense' | 'combat' | 'boss': crossfades the layers. */
export function setSection(s, now = false) {
  const ctx = audioCtx();
  if (!ctx || !layers || (s === section && !now)) return;
  section = s;
  lastChange = ctx.currentTime;
  want = { tense: s === 'explore' ? 0 : s === 'tense' ? 1 : 0.5, combat: s === 'combat' || s === 'boss' ? 1 : 0, boss: s === 'boss' ? 1 : 0 };
  const tc = now ? 0.05 : s === 'boss' ? 1.2 : s === 'tense' ? 1.6 : 0.9;
  layers.tense.gain.setTargetAtTime(want.tense, ctx.currentTime, tc);
  layers.combat.gain.setTargetAtTime(want.combat * (s === 'boss' ? 0.5 : 1), ctx.currentTime, tc);
  layers.boss.gain.setTargetAtTime(want.boss, ctx.currentTime, tc);
}

/** One-shot cue over the score: 'start' | 'clear' | 'boss' | 'complete'. */
export function stinger(kind) {
  const ctx = ensureGraph();
  if (!ctx || !bus) return;
  const th = theme || THEMES.earth;
  const prev = theme; theme = th; // chordNotes reads the active theme
  const t = ctx.currentTime + 0.05, chord = chordNotes(0), bright = th.scale === MAJOR;
  if (kind === 'start') { swell(ctx, t, 1.2, 'base', 0.04); strings(ctx, t + 0.9, chord, 3, 'base', 0.05); lead(ctx, t + 1.2, chord[2], 'bell', 'base', 0.05); }
  else if (kind === 'clear') { strings(ctx, t, [chord[0], chord[0] + 7, chord[1] + (bright ? 0 : 1), chord[2]], 3.2, 'base', 0.06, 2600); lead(ctx, t, chord[2] + 7, 'bell', 'base', 0.06); lead(ctx, t + 0.18, chord[2] + 12, 'bell', 'base', 0.05); boom(ctx, t, 'base', 0.2); }
  else if (kind === 'boss') { boom(ctx, t, 'base', 0.6); lead(ctx, t, chord[0] - 12, 'brass', 'base', 0.09); lead(ctx, t + 0.02, chord[0] - 5, 'brass', 'base', 0.07); crash(ctx, t, 'base', 0.14); }
  else if (kind === 'complete') {
    [0, 0.45, 0.9].forEach((dt, i) => lead(ctx, t + dt, chord[i] , 'brass', 'base', 0.07));
    strings(ctx, t + 0.9, chord.map((n) => n + 12), 4, 'base', 0.07, 3000); choir(ctx, t + 0.9, chord, 4, 0.03, 'base'); crash(ctx, t + 0.9, 'base', 0.12); boom(ctx, t + 0.9, 'base', 0.4);
  }
  theme = prev;
}
