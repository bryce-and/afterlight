import * as THREE from 'three';
import { G, lockPointer } from './state.js';
import { createMenuScene } from './world.js';
import { loadSave } from './save.js';
import { setVolume, initAudio } from './audio.js';
import { updateGame } from './game.js';
import * as ui from './ui.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
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

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const inp = G.input;
const GAME_KEYS = new Set(['Space', 'Tab', 'KeyQ', 'KeyF', 'KeyV', 'KeyC', 'KeyX', 'KeyE', 'KeyR', 'ShiftLeft']);
addEventListener('keydown', (e) => {
  if (G.state === 'playing' && GAME_KEYS.has(e.code)) e.preventDefault();
  if (e.code === 'Escape') {
    if (G.state === 'paused' || G.mpMenu) { ui.resumeGame(); return; }
    if (G.state === 'playing' && !document.pointerLockElement) { ui.showPause(); return; }
  }
  inp.keys[e.code] = true;
  if (!e.repeat) inp.pressed[e.code] = true;
});
addEventListener('keyup', (e) => { inp.keys[e.code] = false; });
addEventListener('blur', () => { inp.keys = {}; inp.mouse.left = inp.mouse.right = false; });
canvas.addEventListener('mousedown', (e) => {
  if (G.state === 'playing' && !document.pointerLockElement) lockPointer();
  if (e.button === 0) { inp.mouse.left = true; inp.mouse.leftPressed = true; }
  if (e.button === 2) inp.mouse.right = true;
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) inp.mouse.left = false;
  if (e.button === 2) inp.mouse.right = false;
});
addEventListener('mousemove', (e) => {
  if (!document.pointerLockElement) return;
  inp.mouse.dx += clampMove(e.movementX);
  inp.mouse.dy += clampMove(e.movementY);
});
const clampMove = (v) => Math.max(-250, Math.min(250, v || 0));
canvas.addEventListener('wheel', (e) => { if (G.state === 'playing') { inp.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); } }, { passive: false });
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
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    if (G.state === 'playing') {
      // co-op menu open: the world keeps running but this player's input is ignored
      if (G.mpMenu) { inp.keys = {}; inp.pressed = {}; inp.mouse.left = inp.mouse.right = false; inp.mouse.dx = inp.mouse.dy = 0; }
      updateGame(dt);
      ui.setLockHint(G.state === 'playing' && !G.mpMenu && !document.pointerLockElement);
    }
    if (G.scene && ['playing', 'paused', 'complete', 'failed'].includes(G.state)) renderer.render(G.scene, G.camera);
    else { G.menu.update(dt); renderer.render(G.menu.scene, G.menu.camera); }
  } catch (err) {
    console.error(err);
    G.lastError = err;
  }
  inp.pressed = {};
  inp.mouse.leftPressed = false;
  inp.mouse.dx = 0; inp.mouse.dy = 0; inp.mouse.wheel = 0;
}
requestAnimationFrame(frame);

window.AFTERLIGHT = G; // handy for debugging in the console
