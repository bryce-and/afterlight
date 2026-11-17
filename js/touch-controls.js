// U26 "Mobile": touch controls. A floating stick on the left, drag-to-look on the right, and buttons that set the same
// canonical inputs the keyboard does (G.input.keys.*, G.input.mouse.*), so gameplay code is untouched.
// Only started on a touch device (or ?mobile). Menu actions (pause, gear) arrive as callbacks from main.js, so this module never imports ui.js.
import * as THREE from 'three';
import { G } from './state.js';
import { writeSave } from './save.js';
import { initAudio } from './audio.js';
import {
  isMobile, layoutFor, sanitizeMobile, mobileModeOn, setMobileMode, stickVec, stickKeys, lookDelta,
  AIM_ASSIST_SLOW, LOOK_RANGE, BTN_SIZE, TOUCH_BUTTONS,
} from './mobile.js';

const inp = G.input;
const STICK_R = 56;           // px of travel for full deflection
const MOVE_ZONE = 0.42;       // left share of the screen is the move zone
let root = null, layer = null, stickEl = null, knobEl = null, editBar = null;
let cb = { pause: () => {}, character: () => {}, resume: () => {} };
const btnEls = new Map();     // id -> element
let editing = false, selected = null;
let moveId = null, moveOrigin = null, lookId = null, lookLast = null;
const held = new Map();       // pointerId -> button id
let ads = false;              // aim-toggle latch
let _mode = null;

const clean = new WeakSet(); // the block is cleaned once, then edited in place
const cfg = () => {
  const st = G.save?.settings; if (!st) return sanitizeMobile(null);
  if (!clean.has(st.mobile || {})) { st.mobile = sanitizeMobile(st.mobile); clean.add(st.mobile); }
  return st.mobile;
};
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

// ---------------- canonical input drive ----------------
const keyDown = (k) => { if (!inp.keys[k]) inp.pressed[k] = true; inp.keys[k] = true; };
const keyUp = (k) => { inp.keys[k] = false; };
function press(b, down) {
  if (b.kind === 'key') { if (down) { inp.pressed[b.target] = true; inp.keys[b.target] = true; } else inp.keys[b.target] = false; }
  else if (b.kind === 'mouse') {
    if (b.target === 'right' && cfg().aimToggle) { if (down) { ads = !ads; inp.mouse.right = ads; if (ads) inp.mouse.rightPressed = true; } return; }
    if (down) { inp.mouse[b.target] = true; inp.mouse[b.target + 'Pressed'] = true; } else inp.mouse[b.target] = false;
  } else if (b.kind === 'wheel') { if (down) inp.mouse.wheel += +b.target; }
  else if (b.kind === 'ui' && down) { if (b.target === 'pause') cb.pause(); else if (b.target === 'character') cb.character(); }
}
function releaseAll() {
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) keyUp(k);
  for (const id of held.values()) { const b = TOUCH_BUTTONS.find((x) => x.id === id); if (b && !(b.kind === 'mouse' && b.target === 'right' && cfg().aimToggle)) press(b, false); }
  held.clear(); moveId = lookId = null; ads = false;
  inp.mouse.left = inp.mouse.right = false;
  stickEl.classList.remove('on');
  for (const e of btnEls.values()) e.classList.remove('down');
}

/** A one-frame press of a canonical key (a tap on a HUD tile). */
function tap(k) { inp.pressed[k] = true; inp.keys[k] = true; setTimeout(() => { inp.keys[k] = false; }, 100); }
/** Tap the grenade, melee or class tile to use it, or a weapon row to swap to it. */
function bindHudTaps() {
  const AB = { grenade: 'KeyQ', melee: 'KeyV', class: 'KeyC' };
  document.querySelector('#abilities')?.addEventListener('pointerdown', (e) => {
    const t = e.target.closest?.('.ab'); if (!t || !AB[t.dataset.ab] || !visible()) return;
    e.preventDefault(); tap(AB[t.dataset.ab]);
  });
  document.querySelector('#weapons')?.addEventListener('pointerdown', (e) => {
    const r = e.target.closest?.('.wrow'); if (!r || !visible()) return;
    e.preventDefault(); tap('Digit' + (+r.dataset.i + 1));
  });
}

// ---------------- aim assist: is the crosshair on an enemy? ----------------
const ray = new THREE.Raycaster(), _c = new THREE.Vector2(0, 0);
let aimT = 0, aimOn = false;
function crosshairOnEnemy() {
  const now = performance.now();
  if (now - aimT < 80) return aimOn;
  aimT = now; aimOn = false;
  try {
    if (!G.camera || !G.hitTargets?.length) return false;
    ray.setFromCamera(_c, G.camera); ray.far = 60;
    const hit = ray.intersectObjects(G.hitTargets, false)[0];
    aimOn = !!(hit && hit.object.userData?.enemy);
  } catch { aimOn = false; }
  return aimOn;
}

// ---------------- pointers on the full-screen layer ----------------
function layerDown(e) {
  if (editing) return;
  e.preventDefault();
  const left = e.clientX < innerWidth * MOVE_ZONE;
  if (left && moveId === null) {
    moveId = e.pointerId; moveOrigin = { x: e.clientX, y: e.clientY };
    stickEl.style.transform = `translate(${e.clientX - STICK_R}px, ${e.clientY - STICK_R}px)`; knobEl.style.transform = 'translate(0,0)'; stickEl.classList.add('on');
  } else if (!left && lookId === null) { lookId = e.pointerId; lookLast = { x: e.clientX, y: e.clientY }; }
  try { layer.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
}
function layerMove(e) {
  if (e.pointerId === moveId) {
    const v = stickVec(e.clientX - moveOrigin.x, e.clientY - moveOrigin.y, STICK_R);
    const k = stickKeys(v);
    for (const n of Object.keys(k)) k[n] ? keyDown(n) : keyUp(n);
    knobEl.style.transform = `translate(${v.x * STICK_R * 0.8}px, ${v.y * STICK_R * 0.8}px)`;
  } else if (e.pointerId === lookId) {
    const c = cfg();
    const d = lookDelta(e.clientX - lookLast.x, e.clientY - lookLast.y, c.look, c.aimAssist && crosshairOnEnemy() ? AIM_ASSIST_SLOW : 1);
    inp.mouse.dx += d.dx; inp.mouse.dy += d.dy; lookLast = { x: e.clientX, y: e.clientY };
  }
}
function layerUp(e) {
  if (e.pointerId === moveId) { moveId = null; for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) keyUp(k); stickEl.classList.remove('on'); }
  else if (e.pointerId === lookId) lookId = null;
}

// ---------------- buttons ----------------
function place(b, node) {
  const s = b.s;
  node.style.width = node.style.height = `${s}px`;
  node.style.left = `calc(${(b.x * 100).toFixed(2)}% - ${s / 2}px)`;
  node.style.top = `calc(${(b.y * 100).toFixed(2)}% - ${s / 2}px)`;
  node.style.fontSize = `${Math.max(9, Math.round(s * 0.21))}px`;
}
function buildButtons() {
  for (const e of btnEls.values()) e.remove();
  btnEls.clear();
  for (const b of layoutFor(cfg())) {
    const n = el('button', `tbtn k-${b.id}`, b.label); n.type = 'button'; n.dataset.id = b.id;
    place(b, n);
    n.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (editing) { startDrag(e, b, n); return; }
      held.set(e.pointerId, b.id); n.classList.add('down'); press(b, true);
      try { n.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    const up = (e) => { if (editing) return; if (held.get(e.pointerId) === b.id) { held.delete(e.pointerId); n.classList.remove('down'); press(b, false); } };
    n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up);
    root.appendChild(n); btnEls.set(b.id, n);
  }
}

// ---------------- layout editor ----------------
let drag = null;
function startDrag(e, b, n) {
  select(b.id);
  const R = root.getBoundingClientRect(), cur = currentOf(b.id);
  drag = { id: b.id, pid: e.pointerId, dx: e.clientX - (R.left + cur.x * R.width), dy: e.clientY - (R.top + cur.y * R.height) };
  try { n.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  n.onpointermove = (ev) => {
    if (!drag || ev.pointerId !== drag.pid) return;
    const R = root.getBoundingClientRect(), c = cfg(); c.layout[b.id] = lay({ ...currentOf(b.id), x: Math.min(0.98, Math.max(0.02, (ev.clientX - drag.dx - R.left) / R.width)), y: Math.min(0.96, Math.max(0.04, (ev.clientY - drag.dy - R.top) / R.height)) });
    place({ ...b, ...c.layout[b.id] }, n);
  };
  n.onpointerup = n.onpointercancel = () => { drag = null; n.onpointermove = null; };
}
const lay = (o) => ({ x: o.x, y: o.y, s: o.s });
const currentOf = (id) => layoutFor(cfg()).find((b) => b.id === id);
function select(id) { selected = id; for (const [k, n] of btnEls) n.classList.toggle('sel', k === id); }
function resize(delta) {
  if (!selected) return;
  const c = cfg(), cur = currentOf(selected);
  c.layout[selected] = lay({ ...cur, s: Math.min(BTN_SIZE[1], Math.max(BTN_SIZE[0], cur.s + delta)) });
  place(currentOf(selected), btnEls.get(selected));
}
/** Open the layout editor (called from the pause menu). `done` runs when the player taps Done. */
export function editLayout(done) {
  editing = true; selected = null; releaseAll();
  root.classList.add('editing'); document.body.classList.add('t-edit');
  editBar.classList.remove('hidden');
  editBar.querySelector('.eb-hint').textContent = 'Drag a button to move it. Tap one, then + or - to resize.';
  editBar.onDone = () => { editing = false; selected = null; root.classList.remove('editing'); document.body.classList.remove('t-edit'); editBar.classList.add('hidden'); for (const n of btnEls.values()) n.classList.remove('sel'); if (G.save) writeSave(G.save); done?.(); };
}
function resetLayout() { cfg().layout = {}; buildButtons(); selected = null; if (G.save) writeSave(G.save); }

// ---------------- settings block for the pause menu ----------------
/** HTML for the pause menu's touch settings (mobile only; empty on desktop). */
export function settingsHtml() {
  if (!isMobile() || !G.save) return '';
  const c = cfg(), on = mobileModeOn(c);
  return `<div class="settings tset">
    <label>Look sensitivity <span id="v-tlook">${c.look.toFixed(2)}</span><input type="range" id="s-tlook" min="${LOOK_RANGE[0]}" max="${LOOK_RANGE[1]}" step="0.05" value="${c.look}"></label>
    <label class="toggle-row">Aim assist <span class="hint">Slows the look drag a little while your crosshair is on an enemy</span><input type="checkbox" id="s-tassist" ${c.aimAssist ? 'checked' : ''}></label>
    <label class="toggle-row">Aim button toggles <span class="hint">Tap AIM to zoom in and tap again to zoom out, instead of holding</span><input type="checkbox" id="s-ttoggle" ${c.aimToggle ? 'checked' : ''}></label>
    <label class="toggle-row">Mobile mode <span class="hint">Enemies strafe slower and have bigger hit boxes. Damage is unchanged</span><input type="checkbox" id="s-tmode" ${on ? 'checked' : ''}></label>
    <div class="row-btns"><button class="btn" id="p-tgear">Gear</button><button class="btn" id="p-tghost">Ghost</button></div>
    <div class="row-btns"><button class="btn" id="p-tedit">Edit touch layout</button><button class="btn" id="p-treset">Reset layout</button></div>
  </div>`;
}
/** Wire the block above. `reopen` redraws the pause menu after the layout editor closes. */
export function bindSettings(rootEl, reopen) {
  const $ = (s) => rootEl.querySelector(s); if (!$('#s-tlook')) return;
  const c = cfg();
  $('#s-tlook').addEventListener('input', (e) => { c.look = +e.target.value; $('#v-tlook').textContent = c.look.toFixed(2); writeSave(G.save); });
  $('#s-tassist').addEventListener('change', (e) => { c.aimAssist = e.target.checked; writeSave(G.save); });
  $('#s-ttoggle').addEventListener('change', (e) => { c.aimToggle = e.target.checked; ads = false; writeSave(G.save); });
  $('#s-tmode').addEventListener('change', (e) => { c.mode = e.target.checked; syncMode(); writeSave(G.save); });
  $('#p-tgear').addEventListener('click', () => cb.character());
  $('#p-tghost').addEventListener('click', () => { cb.resume(); setTimeout(() => tap('Tab'), 120); });
  $('#p-tedit').addEventListener('click', () => { rootEl.classList.add('hidden'); editLayout(() => { rootEl.classList.remove('hidden'); reopen?.(); }); });
  $('#p-treset').addEventListener('click', () => { resetLayout(); });
}

function syncMode() {
  const on = mobileModeOn(G.save?.settings.mobile);
  if (on !== _mode) { _mode = on; setMobileMode(on); }
}

// ---------------- visibility and lifecycle ----------------
function visible() {
  const playing = G.state === 'playing' && !G.invOpen && !G.mpMenu && !G.boonMenu && !G.bindCapture;
  return editing || playing;
}
function poll() {
  const v = visible();
  if (v !== root.classList.contains('show')) { root.classList.toggle('show', v); if (!v) releaseAll(); }
  syncMode();
  requestAnimationFrame(poll);
}

/** Start the touch controls. Safe to call once; does nothing off a touch device. `callbacks`: { pause(), character() }. */
export function initTouch(callbacks) {
  if (!isMobile() || root) return false;
  cb = { ...cb, ...callbacks };
  document.documentElement.classList.add('mobile');
  root = el('div'); root.id = 'touch';
  layer = el('div', 't-layer'); stickEl = el('div', 't-stick'); knobEl = el('i'); stickEl.appendChild(knobEl);
  root.append(layer, stickEl);
  editBar = el('div', 't-editbar hidden');
  editBar.innerHTML = '<span class="eb-hint"></span><button type="button" data-a="-">-</button><button type="button" data-a="+">+</button><button type="button" data-a="reset">Reset</button><button type="button" data-a="done" class="primary">Done</button>';
  editBar.addEventListener('pointerdown', (e) => e.stopPropagation());
  editBar.addEventListener('click', (e) => {
    const a = e.target?.dataset?.a; if (!a) return;
    if (a === '+') resize(8); else if (a === '-') resize(-8); else if (a === 'reset') resetLayout(); else if (a === 'done') editBar.onDone?.();
  });
  root.appendChild(editBar);
  document.body.appendChild(root);
  buildButtons(); bindHudTaps();
  layer.addEventListener('pointerdown', layerDown); layer.addEventListener('pointermove', layerMove);
  layer.addEventListener('pointerup', layerUp); layer.addEventListener('pointercancel', layerUp);
  // no pinch zoom (CSS handles the callout, selection and double-tap zoom)
  for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, (e) => e.preventDefault());
  addEventListener('pointerdown', () => initAudio(), { passive: true }); // iOS starts audio only inside a tap
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  // keep the screen awake while playing; pause when the app is switched away or the phone locks
  let lock = null;
  const wake = async () => { try { if (navigator.wakeLock && G.state === 'playing' && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch { lock = null; } };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { releaseAll(); if (G.state === 'playing' && !G.invOpen && !G.mpMenu) cb.pause(); }
    else wake();
  });
  addEventListener('pointerdown', wake, { passive: true });
  // portrait: a "turn your phone" card; the game itself needs landscape
  const rot = el('div', 't-rotate'); rot.innerHTML = '<div><b>Turn your phone sideways</b><span>Afterlight plays in landscape.</span></div>'; document.body.appendChild(rot);
  installHint();
  requestAnimationFrame(poll);
  return true;
}

/** iOS Safari (not yet installed): a one-line "Add to Home Screen" card, once. Never shown inside the installed app. */
function installHint() {
  try {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    if (!ios || standalone || localStorage.getItem('afterlight.installHint')) return;
    const h = el('div', 't-install');
    h.innerHTML = '<b>Play full screen:</b> tap Share, then <b>Add to Home Screen</b>.<button type="button">Got it</button>';
    h.querySelector('button').addEventListener('click', () => { h.remove(); try { localStorage.setItem('afterlight.installHint', '1'); } catch { /* private mode */ } });
    document.body.appendChild(h);
  } catch { /* hint is optional */ }
}
