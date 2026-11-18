// U26 "Mobile": pure logic for phone play (no DOM at import time), so tools/tests.js can exercise it.
// Detect, Mobile-mode tuning table, stick math, touch button layout and the saved settings block.
// Desktop reads the identity tuning (DESKTOP_TUNING), so nothing changes unless the gate is on.

/** Touch is the primary input (a phone or tablet), or `?mobile` forces it on a desktop for testing. `?mobile=0` forces it off. */
export function detectMobile(search = '', coarse = false) {
  const m = /[?&]mobile(?:=([^&]*))?(?:&|$)/.exec(search || '');
  if (m) return !(m[1] === '0' || m[1] === 'off' || m[1] === 'false');
  return !!coarse;
}
let _mobile = null;
/** True on a touch-primary device (cached after the first call). */
export function isMobile() {
  if (_mobile === null) {
    let coarse = false;
    try { coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(hover: hover)').matches; } catch { /* no matchMedia */ }
    _mobile = detectMobile(typeof location !== 'undefined' ? location.search : '', coarse);
  }
  return _mobile;
}

/** Mobile mode: calmer AI strafing and bigger enemy hit boxes. Damage numbers never change. */
export const MOBILE_TUNING = Object.freeze({ strafeSpeed: 0.6, strafeInterval: 1.5, hitScale: 1.35, pixelRatioCap: 2.0, particleScale: 0.6, cheapShadows: true });
/** The identity values: what desktop (and Mobile mode off) uses. */
export const DESKTOP_TUNING = Object.freeze({ strafeSpeed: 1, strafeInterval: 1, hitScale: 1, pixelRatioCap: 1.5, particleScale: 1, cheapShadows: false });
const live = { ...DESKTOP_TUNING };
/** The tuning in force right now. Read it each time (do not cache it). */
export const tuning = () => live;
/** Turn Mobile mode on or off. Returns the live table. */
export function setMobileMode(on) { return Object.assign(live, on ? MOBILE_TUNING : DESKTOP_TUNING); }

// ---------------- saved settings (settings.mobile) ----------------
export const LOOK_RANGE = [0.4, 3];
export const BTN_SIZE = [40, 130];
/** Touch buttons. Grenade, melee, class ability and weapon swap are taps on the HUD tiles (see touch-controls.js); Ghost and Gear live in the pause menu. `kind`: 'key' sets a canonical key, 'mouse' left or right, 'wheel' weapon swap, 'ui' a menu call. Default x, y are fractions of the screen (centre), s is the size in CSS px. */
export const TOUCH_BUTTONS = [
  { id: 'fire', label: 'FIRE', kind: 'mouse', target: 'left', x: 0.90, y: 0.62, s: 96 },
  { id: 'ads', label: 'AIM', kind: 'mouse', target: 'right', x: 0.79, y: 0.78, s: 70 },
  { id: 'jump', label: 'JUMP', kind: 'key', target: 'Space', x: 0.93, y: 0.84, s: 62 },
  { id: 'reload', label: 'RLD', kind: 'key', target: 'KeyR', x: 0.70, y: 0.56, s: 52 },
  { id: 'super', label: 'SUPER', kind: 'key', target: 'KeyF', x: 0.94, y: 0.34, s: 60 },
  { id: 'transcend', label: 'TRANSCEND', kind: 'key', target: 'KeyZ', x: 0.94, y: 0.20, s: 64 }, // U27: shown only while Transcendence is ready
  { id: 'interact', label: 'USE', kind: 'key', target: 'KeyE', x: 0.62, y: 0.80, s: 56 },
  { id: 'pause', label: 'II', kind: 'ui', target: 'pause', x: 0.04, y: 0.10, s: 46 },
];
const BTN_BY_ID = Object.fromEntries(TOUCH_BUTTONS.map((b) => [b.id, b]));
const clampN = (v, lo, hi, d) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.min(hi, Math.max(lo, +v)) : d);

/** The default settings block. `mode` null = automatic (on for a phone, off for a desktop). */
export const defaultMobileSettings = () => ({ mode: null, look: 1.4, aimToggle: true, aimToggleSet: false, aimAssist: true, layout: {} });
/** Cleans settings.mobile from a save: unknown fields dropped, bad numbers fall back, layout limited to known buttons. */
export function sanitizeMobile(raw) {
  const d = defaultMobileSettings();
  if (!raw || typeof raw !== 'object') return d;
  const layout = {};
  if (raw.layout && typeof raw.layout === 'object') {
    for (const id of Object.keys(BTN_BY_ID)) {
      const l = raw.layout[id]; if (!l || typeof l !== 'object') continue;
      const b = BTN_BY_ID[id];
      layout[id] = { x: clampN(l.x, 0.02, 0.98, b.x), y: clampN(l.y, 0.04, 0.96, b.y), s: clampN(l.s, BTN_SIZE[0], BTN_SIZE[1], b.s) };
    }
  }
  return { mode: raw.mode === true || raw.mode === false ? raw.mode : null, look: clampN(raw.look, LOOK_RANGE[0], LOOK_RANGE[1], d.look), aimToggle: raw.aimToggleSet === true ? !!raw.aimToggle : true, aimToggleSet: raw.aimToggleSet === true, aimAssist: raw.aimAssist !== false, layout };
}
/** Is Mobile mode on for this settings block? (Automatic follows the device.) */
export const mobileModeOn = (s, device = isMobile()) => (s && typeof s.mode === 'boolean' ? s.mode : !!device);
/** The placed button list: defaults overlaid with the player's saved moves. */
export const layoutFor = (s) => TOUCH_BUTTONS.map((b) => ({ ...b, ...(s?.layout?.[b.id] || {}) }));

// ---------------- stick and look math ----------------
/** Floating stick: finger offset (px) from where it landed, normalised to the radius with a dead zone. Screen y is down. */
export function stickVec(dx, dy, radius = 56, dead = 0.14) {
  const m = Math.hypot(dx, dy) / radius;
  if (m < dead) return { x: 0, y: 0, m: 0 };
  const k = Math.min(1, (m - dead) / (1 - dead)), a = Math.atan2(dy, dx);
  return { x: Math.cos(a) * k, y: Math.sin(a) * k, m: k };
}
/** The stick as the canonical movement keys. Pushed fully forward it sprints. */
export function stickKeys(v, t = 0.3) {
  return { KeyW: v.y < -t, KeyS: v.y > t, KeyA: v.x < -t, KeyD: v.x > t, ShiftLeft: v.m > 0.95 && v.y < -0.55 };
}
/** A look drag (px) into mouse-style counts for G.input.mouse.dx/dy. `slow` (0..1) is aim assist, ADS zoom already applies in the player. */
export function lookDelta(dx, dy, look = 1.4, slow = 1) {
  const k = look * slow;
  return { dx: Math.max(-250, Math.min(250, dx * k)), dy: Math.max(-250, Math.min(250, dy * k)) };
}
/** Aim assist: slow the drag a little while the crosshair is on an enemy. */
export const AIM_ASSIST_SLOW = 0.55;
