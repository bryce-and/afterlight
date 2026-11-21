// U33 Transmissions: NPC voice playback. Plays the baked files in assets/voice (see tools/bake_voices.py) on the NPC Voice bus.
// Each line is found by speaker and text (js/voice-data.js), so the story data stays plain text. A line with no file is simply silent
// (the subtitle still shows). Lines heard over a transmission use the comms file (assets/voice/comms); in the Tower and in cutscenes
// the NPC is standing there, so the plain file plays. Ghost, Riven and the Psion Herald have no comms version.
import { audioCtx, voiceDest } from './audio.js';
import { VOICE_LINES } from './voice-data.js';

/** 'comms' (a transmission, the default in missions) or 'person' (the Tower and cutscenes). */
let mode = 'comms';
export const setVoiceMode = (m) => { mode = m === 'person' ? 'person' : 'comms'; };
export const getVoiceMode = () => mode;

/** Lower case, letters and digits only, so small punctuation differences never hide a line. A leading stage direction in brackets is dropped. */
export const voiceKey = (text) => String(text).replace(/^\s*\([^)]*\)\s*/, '').toLowerCase().replace(/[^a-z0-9Ѐ-ӿ]+/g, ' ').trim();

const INDEX = new Map();
for (const [id, who, text, comms] of VOICE_LINES) {
  const k = `${who}|${voiceKey(text)}`;
  if (!INDEX.has(k)) INDEX.set(k, { id, who, comms: !!comms });
}

/** The voice entry for a line, or null. */
export const voiceFor = (who, text) => INDEX.get(`${who}|${voiceKey(text)}`) || null;
/** The file a line plays right now ('assets/voice/12.mp3' or the comms one), or null. */
export function voiceUrl(who, text, m = mode) {
  const e = voiceFor(who, text);
  if (!e) return null;
  return `assets/voice/${m === 'comms' && e.comms ? 'comms/' : ''}${e.id}.mp3`;
}

const cache = new Map(); // url -> AudioBuffer, or a Promise while it loads
const order = [];        // oldest first, to keep the cache small (decoded audio is large)
const CACHE_MAX = 48;

function load(url) {
  const ctx = audioCtx();
  if (!ctx) return null;
  const have = cache.get(url);
  if (have) return have;
  const p = fetch(url).then((r) => { if (!r.ok) throw new Error(`voice ${url}: ${r.status}`); return r.arrayBuffer(); })
    .then((b) => ctx.decodeAudioData(b))
    .then((buf) => { cache.set(url, buf); return buf; })
    .catch((e) => { cache.delete(url); console.warn(e.message); return null; });
  cache.set(url, p);
  order.push(url);
  while (order.length > CACHE_MAX) cache.delete(order.shift());
  return p;
}

/** Start loading a line's file so it is ready when its subtitle shows. */
export function preloadVoice(who, text) {
  const u = voiceUrl(who, text);
  if (u) load(u);
}
/** Preload a list of [speaker, text] lines (a mission's script, a Tower visit). */
export function preloadVoices(lines) { for (const [who, text] of lines) preloadVoice(who, text); }

let current = null, seq = 0; // seq: a line still loading when a newer one (or a stop) arrives must not start late
/** Stop whatever line is playing. */
export function stopVoice() {
  seq++;
  if (!current) return;
  try { current.stop(); } catch (e) { /* already ended */ }
  current = null;
}

/**
 * Play a line's voice now. Returns its length in seconds when it started, or 0 when there is nothing to play yet
 * (no file, audio not started, or still loading: then the subtitle just shows without sound).
 */
export function playVoice(who, text, m = mode) {
  const ctx = audioCtx(), dest = voiceDest();
  if (!ctx || !dest) return 0;
  const u = voiceUrl(who, text, m);
  if (!u) return 0;
  const buf = load(u);
  if (!buf) return 0;
  stopVoice();
  const my = seq;
  const go = (b) => {
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(dest);
    src.start();
    current = src;
    src.onended = () => { if (current === src) current = null; };
    return b.duration;
  };
  if (typeof buf.then === 'function') { buf.then((b) => { if (b && seq === my) go(b); }); return 0; } // still loading: it starts the moment it is ready
  return go(buf);
}

/** Length of a line's voice in seconds if its file is already loaded, else 0. */
export function voiceDuration(who, text, m = mode) {
  const u = voiceUrl(who, text, m);
  const b = u && cache.get(u);
  return b && typeof b.then !== 'function' ? b.duration : 0;
}

/** U33: loads a line's file and resolves with its length in seconds (0 when it has no file or audio is not started). Used by cutscenes to time shots. */
export function voiceReady(who, text, m = mode) {
  const u = voiceUrl(who, text, m);
  if (!u) return Promise.resolve(0);
  return Promise.resolve(load(u)).then((b) => (b ? b.duration : 0));
}
