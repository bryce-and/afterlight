import * as THREE from 'three';
import './devconsole.js';
import { G, lockPointer } from './state.js';
import { createMenuScene } from './world.js';
import { loadSave } from './save.js';
import { setVolume, initAudio } from './audio.js';
import { updateGame } from './game.js';
import * as ui from './ui.js';
import { openTerms, termsAccepted } from './terms.js';
import { syncLive, liveKeybinds, liveTargets, mousePhys, wheelState, wheelStep } from './keybinds.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
G.renderer = renderer;

G.camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.04, 900);
G.camera.rotation.order = 'YXZ';
G.menu = createMenuScene();
G.save = loadSave();
if (G.save) setVolume(G.save.settings.volume);

ui.initUI();
ui.showTitle();
if (!termsAccepted()) openTerms({ required: true }); // H27: the first-launch agreement

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const inp = G.input;
// H27: physical inputs go through the player's binds (js/keybinds.js) onto the canonical inputs gameplay reads.
const MAC = /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent || '');
const held = new Set(); // physical inputs held right now
const wheel = wheelState();
const kb = () => { syncLive(G.save?.settings.keybinds); return liveKeybinds(); };
const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
function drive(phys, down, repeat = false, tap = false) {
  kb();
  for (const t of liveTargets(phys)) {
    if (t.startsWith('wheel:')) { if (down && !repeat) inp.mouse.wheel += +t.slice(6); continue; }
    if (t.startsWith('mouse:')) {
      const b = t.slice(6);
      if (down) { if (!tap) inp.mouse[b] = true; if (!repeat) inp.mouse[b + 'Pressed'] = true; }
      else if (!anyHeld(t)) inp.mouse[b] = false;
      continue;
    }
    if (down) { if (!tap) inp.keys[t] = true; if (!repeat) inp.pressed[t] = true; }
    else if (!anyHeld(t)) inp.keys[t] = false;
  }
}
// another held input bound to the same target keeps it held
const anyHeld = (t) => [...held].some((p) => liveTargets(p).includes(t));
addEventListener('keydown', (e) => {
  if (G.bindCapture) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) G.bindCapture(e.code); return; }
  const targets = typing(e) ? [] : (kb(), liveTargets(e.code));
  if (G.state === 'playing' && targets.length) e.preventDefault();
  if (targets.includes('KeyI') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (['orbit', 'playing', 'paused'].includes(G.state) || G.invOpen) { ui.toggleCharacter(); return; }
  }
  if (e.code === 'Escape') {
    if (G.invOpen) { ui.charEscape(); return; }
    if (G.state === 'paused' || G.mpMenu) { ui.resumeGame(); return; }
    if (G.state === 'playing' && !document.pointerLockElement) { ui.showPause(); return; }
  }
  if (typing(e) || e.metaKey || e.ctrlKey) return; // Cmd/Ctrl combos are browser shortcuts, never game input
  held.add(e.code);
  drive(e.code, true, e.repeat);
});
addEventListener('keyup', (e) => { held.delete(e.code); drive(e.code, false); });
addEventListener('blur', () => { held.clear(); inp.keys = {}; inp.mouse.left = inp.mouse.right = false; });
// Capture phase, so a rebind can take any button even over the pause menu.
addEventListener('mousedown', (e) => {
  const phys = mousePhys(e.button, e.ctrlKey, MAC);
  if (G.bindCapture) {
    e.preventDefault(); e.stopImmediatePropagation();
    // the click (or context menu) this press makes must not land on the button under the cursor
    const eat = (ev) => { ev.preventDefault(); ev.stopImmediatePropagation(); };
    for (const t of ['click', 'auxclick', 'contextmenu']) addEventListener(t, eat, { capture: true, once: true });
    setTimeout(() => { for (const t of ['click', 'auxclick', 'contextmenu']) removeEventListener(t, eat, { capture: true }); }, 400);
    G.bindCapture(phys); return;
  }
  if (e.target !== canvas) return;
  if (G.state === 'playing' && !document.pointerLockElement) lockPointer();
  if (e.button === 1) e.preventDefault(); // no autoscroll
  held.add(phys);
  drive(phys, true);
}, true);
addEventListener('mouseup', (e) => {
  if ((e.button === 3 || e.button === 4) && G.state === 'playing') e.preventDefault(); // side buttons: no browser back/forward mid-fight
  for (const p of [`Mouse${e.button}`, mousePhys(e.button, true, MAC)]) if (held.delete(p)) drive(p, false);
});
addEventListener('mousemove', (e) => {
  if (!document.pointerLockElement) return;
  inp.mouse.dx += clampMove(e.movementX);
  inp.mouse.dy += clampMove(e.movementY);
});
const clampMove = (v) => Math.max(-250, Math.min(250, v || 0));
addEventListener('wheel', (e) => {
  if (G.bindCapture && e.deltaY) { e.preventDefault(); G.bindCapture(e.deltaY < 0 ? 'WheelUp' : 'WheelDown'); return; }
  if (e.target !== canvas || G.state !== 'playing') return;
  e.preventDefault();
  const step = wheelStep(wheel, e.deltaY, performance.now(), kb().guard);
  if (step) drive(step < 0 ? 'WheelUp' : 'WheelDown', true, false, true);
}, { passive: false });
addEventListener('contextmenu', (e) => { if (G.state === 'playing' || e.target === canvas) e.preventDefault(); });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  inp.locked = locked;
  if (locked) { inp.wasLocked = true; initAudio(); }
  else if (G.state === 'playing' && inp.wasLocked) { inp.mouse.left = inp.mouse.right = false; ui.showPause(); }
  ui.setLockHint(G.state === 'playing' && !locked);
});

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  G.camera.aspect = innerWidth / innerHeight;
  G.camera.updateProjectionMatrix();
  G.menu.resize();
});

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let last = performance.now();
// Dev-only perf readout, enabled with ?perf in the URL. Costs nothing when absent.
const PERF = /[?&]perf(\b|=)/.test(location.search);
let perfTick = null;
if (PERF) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99999;padding:4px 7px;background:rgba(0,0,0,.65);color:#9f9;font:11px/1.35 monospace;pointer-events:none;white-space:pre';
  document.body.appendChild(box);
  let acc = 0, n = 0, worst = 0, since = 0;
  perfTick = (ms) => {
    acc += ms; n++; if (ms > worst) worst = ms; since += ms;
    if (since < 1000) return;
    const inf = renderer.info.render;
    const alive = G.enemies ? G.enemies.filter((e) => e.alive).length : 0;
    box.textContent = `frame ${(acc / n).toFixed(1)} ms (worst ${worst.toFixed(1)})  ${Math.round(1000 * n / since)} fps\ncalls ${inf.calls}  tris ${inf.triangles}  enemies ${alive}`;
    acc = 0; n = 0; worst = 0; since = 0;
  };
}
function frame(now) {
  requestAnimationFrame(frame);
  if (perfTick) perfTick(now - last);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    if (G.state === 'playing') {
      // co-op menu open: the world keeps running but this player's input is ignored
      if (G.mpMenu) { inp.keys = {}; inp.pressed = {}; inp.mouse.left = inp.mouse.right = false; inp.mouse.dx = inp.mouse.dy = 0; }
      updateGame(dt);
      ui.setLockHint(G.state === 'playing' && !G.mpMenu && !document.pointerLockElement);
    }
    if (G.scene && !G.invOpen && ['playing', 'paused', 'complete', 'failed'].includes(G.state)) renderer.render(G.scene, G.camera);
    else { G.menu.update(dt); renderer.render(G.menu.scene, G.menu.camera); }
  } catch (err) {
    console.error(err);
    G.lastError = err;
  }
  inp.pressed = {};
  inp.mouse.leftPressed = false; inp.mouse.rightPressed = false;
  inp.mouse.dx = 0; inp.mouse.dy = 0; inp.mouse.wheel = 0;
}
requestAnimationFrame(frame);

window.AFTERLIGHT = G; // handy for debugging in the console

// ---------------------------------------------------------------------------
// Web app: installable, works offline, warns before closing mid-mission
// ---------------------------------------------------------------------------
if ('serviceWorker' in navigator && window.top === window) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker not registered:', e.message));
}
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  G.installPrompt = e;
  ui.refreshInstall();
});
addEventListener('appinstalled', () => { G.installPrompt = null; ui.refreshInstall(); });
addEventListener('beforeunload', (e) => {
  if (G.mission && ['playing', 'paused'].includes(G.state)) { e.preventDefault(); e.returnValue = ''; }
});
