// U33 Transmissions: the cutscene engine and the scenes. A scene is a list of steps (js/cutscene-scenes.js); each step can switch the set (the
// stage), run a camera move, speak a voiced line (with its subtitle) and run a small function. The engine builds the sets from primitives on
// its own THREE.Scene, renders it in place of the game while G.state is 'cutscene', and hands control back when the scene ends or is skipped.
// Scenes are skipped in a fireteam (the world cannot freeze for one player) or with the Skip cutscenes setting, and play every time the story point comes up.
import * as THREE from 'three';
import { G } from './state.js';
import { net } from './net.js';
import { playMusic } from './music.js';
import { initAudio } from './audio.js';
import { setVoiceMode, getVoiceMode, voiceReady, playVoice, stopVoice } from './voice.js';
import { SPEAKERS } from './story.js';
import { SETS } from './cutscene-sets.js';
import { SCENES } from './cutscene-scenes.js';

let cur = null;
const blank = new THREE.Scene();
const blankCam = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
let overlay = null;

/** Test tools (which load the game in an iframe or directly) set AFTERLIGHT_NO_CUTSCENES so a headless run never waits on a scene. */
const noScenes = () => { try { return !!(globalThis.AFTERLIGHT_NO_CUTSCENES || parent.AFTERLIGHT_NO_CUTSCENES); } catch { return false; } };
export const cutsceneActive = () => !!cur;

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'cutscene';
  overlay.innerHTML = '<div class="cs-bar cs-top"></div><div class="cs-bar cs-bot"></div><div class="cs-sub hidden"><span class="cs-who"></span><span class="cs-text"></span></div>'
    + '<div class="cs-skip">Space to skip</div><div class="cs-flash"></div><div class="cs-fade"></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('pointerdown', () => skipCutscene());
  addEventListener('keydown', (e) => {
    if (!cur || !['Space', 'Enter', 'Escape'].includes(e.code)) return;
    e.preventDefault(); e.stopPropagation(); skipCutscene();
  }, true);
  return overlay;
}
const $o = (s) => overlay.querySelector(s);

/** Estimated length of a line with no voice file. */
const guess = (text) => 1.4 + text.length * 0.055;

/**
 * Play a scene. `done` runs when it ends or is skipped. Returns false (and never calls `done`) when it cannot play, so the caller carries on itself.
 */
export function playCutscene(id, done = () => {}) {
  const def = SCENES[id] && (typeof SCENES[id] === 'function' ? SCENES[id]() : SCENES[id]);
  if (!def || cur || net.active || !G.save || noScenes() || G.save.settings?.skipCutscenes) return false; // the Skip cutscenes setting // test tools set the flag so a headless run never waits on a scene
  initAudio(); // the voices and score need the audio context even when the scene is started from a console or a menu without a click
  ensureOverlay();
  const c = cur = {
    id, def, done, prev: G.state, prevVoice: getVoiceMode(), t: 0, i: -1, ready: false, steps: [], total: 0, sets: {}, set: null, flash: 0, skipped: false,
    cam: new THREE.PerspectiveCamera(def.fov || 48, innerWidth / innerHeight, 0.05, 900),
  };
  G.state = 'cutscene';
  document.body.classList.add('cutscene-on');
  setVoiceMode('person');
  $o('.cs-fade').style.opacity = 1;
  $o('.cs-sub').classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock?.();
  // load every voice file first so each shot lasts as long as its line
  const lines = def.steps.filter((s) => s.line);
  const timeout = new Promise((r) => setTimeout(r, 4000));
  Promise.race([Promise.all(lines.map((s) => voiceReady(s.line[0], s.line[1], 'person'))), timeout]).then((durs) => {
    if (cur !== c) return;
    let t = 0, li = 0;
    for (const s of def.steps) {
      const vd = s.line ? (Array.isArray(durs) ? durs[li++] : 0) : 0;
      const dur = s.line ? Math.max(s.min || 0, (vd || guess(s.line[1])) + (s.gap ?? 0.45)) : s.dur || 1;
      c.steps.push({ ...s, t0: t, dur });
      t += dur;
    }
    c.total = t + 0.2;
    c.ready = true;
    if (def.music) playMusic(def.music, { now: true });
  });
  return true;
}

export function skipCutscene() {
  if (!cur || cur.t < 0.8) return;
  cur.skipped = true;
  finish();
}

function finish() {
  const c = cur;
  if (!c) return;
  cur = null;
  stopVoice();
  for (const s of Object.values(c.sets)) {
    s.scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose?.(); x.dispose?.(); }); });
  }
  document.body.classList.remove('cutscene-on');
  setVoiceMode(c.prevVoice);
  G.state = c.prev;
  try { c.def.onEnd?.(c.skipped); } catch (e) { console.error(e); }
  c.done();
}

function enter(c, st) {
  if (st.set && st.set !== c.set?.name) {
    c.set = c.sets[st.set] || (c.sets[st.set] = Object.assign(SETS[st.set](c.def), { name: st.set }));
    c.setT0 = c.t;
  }
  st.fn?.(c.set, c);
  const sub = $o('.cs-sub');
  if (st.line) {
    const [who, text] = st.line;
    const sp = SPEAKERS[who] || { name: who, color: '#fff' };
    sub.querySelector('.cs-who').textContent = sp.name;
    sub.querySelector('.cs-who').style.color = sp.color;
    sub.querySelector('.cs-text').textContent = text;
    sub.classList.remove('hidden');
    playVoice(who, text, 'person');
  } else sub.classList.add('hidden');
}

const ease = (k) => k * k * (3 - 2 * k);
function camera(c, st, k) {
  let v = st.cam;
  if (typeof v === 'string') v = c.set.cams[v];
  if (typeof v === 'function') v = v(k, c.set);
  if (v && v.a) { const e = ease(k); v = v.a.map((x, j) => x + (v.b[j] - x) * e); }
  if (!v) v = c.set.defaultCam || [0, 1.6, 6, 0, 1.4, 0];
  c.cam.position.set(v[0], v[1], v[2]);
  c.cam.lookAt(v[3], v[4], v[5]);
  if (c.cam.aspect !== innerWidth / innerHeight) { c.cam.aspect = innerWidth / innerHeight; c.cam.updateProjectionMatrix(); }
}

/** Called from main.js every frame. Returns true when it drew the frame (the game and menu are skipped). */
export function frameCutscene(dt, renderer) {
  const c = cur;
  if (!c) return false;
  if (!c.ready) { renderer.render(blank, blankCam); return true; }
  c.t += dt;
  if (c.t >= c.total) { finish(); return false; }
  let i = c.i < 0 ? 0 : c.i;
  while (i < c.steps.length - 1 && c.t >= c.steps[i + 1].t0) i++;
  if (i !== c.i || c.i < 0) {
    c.i = i;
    for (let j = i; j >= 0; j--) if (c.steps[j].set) { if (c.steps[j].set !== c.set?.name) enter(c, { set: c.steps[j].set }); break; } // a frame that jumps over a short step still shows the right set
    enter(c, c.steps[i]);
  }
  const st = c.steps[i], k = Math.min(1, (c.t - st.t0) / st.dur);
  camera(c, st, k);
  c.set.tick?.(dt, c.t, st, k, c);
  // fades: in at the start, out at the end, a short dip when the set changes
  const out = Math.max(0, (c.t - (c.total - 1.2)) / 1.0);
  const inn = Math.max(0, 1 - c.t / 1.2);
  const dip = c.setT0 > 0 ? Math.max(0, 1 - (c.t - c.setT0) / 0.7) : 0;
  $o('.cs-fade').style.opacity = Math.min(1, Math.max(out, inn, dip));
  c.flash = Math.max(0, c.flash - dt * 0.9);
  $o('.cs-flash').style.opacity = c.flash;
  $o('.cs-skip').style.opacity = c.t > 0.8 ? 0.7 : 0;
  renderer.render(c.set.scene, c.cam);
  return true;
}

/** A white flash on screen (a Ghost revive, a burst). */
export function flashScreen(v = 1) { if (cur) cur.flash = v; }

/** Tower stops that play as a cutscene instead of a walk through the Tower. */
export const DEBRIEFS = { earth: 'debrief_earth', mars: 'debrief_mars', dc: 'debrief_dc' };

/** Jump forward to a time in the running scene (a debug aid for checking shots). */
export function seekCutscene(t) { if (cur?.ready && t > cur.t) cur.t = t; }
