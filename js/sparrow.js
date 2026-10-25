// U17a: the Ghost view (Tab) and the Sparrow.
// Tab pulls out your Ghost and puts your weapon down. Hold E to summon a Sparrow (patrol zones only), hold O to return to orbit.
// While mounted the player is third person with weapons holstered; Tab or E gets you off.
import * as THREE from 'three';
import { G } from './state.js';
import { clamp, damp } from './util.js';
import { ELEMENTS } from './data.js';
import { moveBody, groundAt } from './physics.js';
import { sfx } from './audio.js';
import * as ui from './ui.js';
import { SPARROW } from './patrol-data.js';
import { ghost } from './characters.js';
import { sparks } from './effects.js';

export { SPARROW };

/** Where the Sparrow works. Campaign missions say no; patrol zones say yes. */
export function sparrowAllowed() { return !!G.mission?.patrol; }

const mat = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, metalness: 0.45, flatShading: true, ...o });
const glowMat = (hex) => new THREE.MeshBasicMaterial({ color: hex });

/**
 * The first-person Ghost view: the game's own Ghost model (characters.js ghost()) floating over an open hand, as in Destiny's nav mode.
 * Camera space: the camera looks down -z. userData.ghost is the part that bobs.
 */
export function buildGhostRig(look = {}) {
  const rig = new THREE.Group();
  const glove = mat(look.glove ?? 0x24272c, { metalness: 0.2, roughness: 0.7 }), sleeve = mat(look.sleeve ?? 0x3d434c, { metalness: 0.35, roughness: 0.55 });
  const trim = new THREE.MeshBasicMaterial({ color: look.trim ?? 0x7fe3ff });
  const hand = new THREE.Group();
  const box = (w, h, d, x, y, z, m = glove, rx = 0, rz = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); hand.add(o); return o; };
  box(0.095, 0.03, 0.1, 0, 0, 0);                                   // palm, facing up
  for (const [x, len] of [[-0.036, 0.07], [-0.012, 0.085], [0.012, 0.08], [0.036, 0.062]]) {
    box(0.02, 0.022, len * 0.55, x, 0.006, -0.05 - len * 0.27, glove, 0.18);   // finger base
    box(0.018, 0.018, len * 0.5, x, 0.02, -0.05 - len * 0.74, glove, 0.55);   // curled tip
  }
  box(0.024, 0.026, 0.05, 0.066, 0.004, -0.012, glove, 0, 0).rotation.y = -0.45;   // thumb: out from the palm's right edge, pointing away from the player
  box(0.021, 0.021, 0.04, 0.083, 0.012, -0.05, glove, 0.35, 0).rotation.y = -0.45;  // its tip, lifted a little
  box(0.082, 0.05, 0.3, 0, -0.012, 0.19, sleeve, 0.06);               // the forearm coming up from below
  box(0.088, 0.054, 0.05, 0, -0.012, 0.075, sleeve, 0.06);            // cuff
  box(0.09, 0.012, 0.03, 0, 0.018, 0.075, trim, 0.06);               // element trim on the cuff
  hand.position.set(0.08, -0.27, -0.6);
  hand.rotation.set(0.12, 0.1, -0.05);
  const gh = ghost();
  gh.scale.setScalar(1.0);
  gh.position.set(0.08, -0.1, -0.68);
  const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), new THREE.MeshBasicMaterial({ color: 0xbff2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.position.copy(gh.position); flash.visible = false;
  rig.add(hand, gh, flash);
  rig.userData.flash = flash;
  rig.userData.ghost = gh;
  rig.userData.hand = hand;
  return rig;
}

/** A lofted hull: rings of 7 points at each station { z, hw, yt, yb, ridge } (half width, top, bottom, ridge height), flat shaded, nose at -z. */
function loft(stations) {
  const ring = (s) => [[0, s.yt + s.ridge], [s.hw * 0.78, s.yt], [s.hw, (s.yt + s.yb) / 2 + 0.02], [s.hw * 0.55, s.yb], [-s.hw * 0.55, s.yb], [-s.hw, (s.yt + s.yb) / 2 + 0.02], [-s.hw * 0.78, s.yt]];
  const rings = stations.map((st) => ring(st).map(([x, y]) => new THREE.Vector3(x, y, st.z)));
  const tri = [];
  const n = rings[0].length;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const a = rings[i][j], b = rings[i][(j + 1) % n], c = rings[i + 1][(j + 1) % n], d = rings[i + 1][j];
      tri.push(a, b, c, a, c, d);
    }
  }
  const last = rings[rings.length - 1], mid = last.reduce((m, v) => m.add(v), new THREE.Vector3()).multiplyScalar(1 / n);
  for (let j = 0; j < n; j++) tri.push(mid, last[(j + 1) % n], last[j]);
  const geo = new THREE.BufferGeometry().setFromPoints(tri);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Low-poly Sparrow after the reference sheets and the rider image: a long tapered wedge with a needle nose, a saddle aft of centre, a handlebar
 * and windscreen forward of it, swept canards, rear thruster pods with vertical fins, skids and an under-glow. Faces -z; the origin is the hover line.
 */
export function buildSparrowModel(accent = 0xff9a3c) {
  const g = new THREE.Group();
  const hullM = mat(0xe3e7ee, { side: THREE.DoubleSide }), darkM = mat(0x2d323c), accM = mat(accent, { metalness: 0.3 }), glassM = mat(0x4a6a86, { metalness: 0.9, roughness: 0.15 });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
  add(loft([
    { z: -3.2, hw: 0.02, yt: 0.47, yb: 0.44, ridge: 0 }, { z: -2.2, hw: 0.14, yt: 0.51, yb: 0.38, ridge: 0.02 }, { z: -1.0, hw: 0.3, yt: 0.6, yb: 0.31, ridge: 0.04 },
    { z: 0.2, hw: 0.44, yt: 0.7, yb: 0.29, ridge: 0.05 }, { z: 1.2, hw: 0.46, yt: 0.76, yb: 0.3, ridge: 0.04 }, { z: 1.85, hw: 0.36, yt: 0.74, yb: 0.36, ridge: 0.02 },
  ]), hullM, 0, 0, 0);
  // an accent stripe down the spine and a dark belt under the saddle
  add(new THREE.BoxGeometry(0.1, 0.03, 2.8), accM, 0, 0.66, -1.2, -0.035);
  add(new THREE.BoxGeometry(0.62, 0.06, 1.2), darkM, 0, 0.5, 0.7);
  // saddle and backrest
  add(new THREE.BoxGeometry(0.48, 0.12, 0.95), darkM, 0, 0.84, 0.58);
  add(new THREE.BoxGeometry(0.46, 0.3, 0.12), darkM, 0, 0.98, 1.12, -0.25);
  // handlebar on a neck, grips at the ends, windscreen ahead of it
  add(new THREE.BoxGeometry(0.07, 0.24, 0.07), darkM, 0, 0.76, -0.52);
  add(new THREE.BoxGeometry(0.96, 0.05, 0.07), darkM, 0, 0.9, -0.52);
  for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 6), accM, sx * 0.5, 0.9, -0.52, 0, 0, Math.PI / 2);
  add(new THREE.BoxGeometry(0.34, 0.3, 0.025), glassM, 0, 0.9, -0.86, -0.7);
  for (const sx of [-1, 1]) {
    // rear thruster pod: a long cylinder, a cone nose, a glowing ring and disc at the back, a strut to the hull
    add(new THREE.CylinderGeometry(0.22, 0.22, 1.7, 8), darkM, sx * 0.72, 0.46, 1.05, Math.PI / 2);
    add(new THREE.ConeGeometry(0.22, 0.7, 8), hullM, sx * 0.72, 0.46, -0.15, -Math.PI / 2);
    add(new THREE.TorusGeometry(0.2, 0.035, 5, 12), glowMat(0x7fe3ff), sx * 0.72, 0.46, 1.92);
    add(new THREE.CircleGeometry(0.17, 10), glowMat(0xbff2ff), sx * 0.72, 0.46, 1.93);
    add(new THREE.BoxGeometry(0.5, 0.08, 0.5), hullM, sx * 0.5, 0.47, 0.9);
    // vertical fin, raked outward and back
    add(new THREE.BoxGeometry(0.04, 0.46, 0.78), accM, sx * 0.98, 0.72, 1.5, -0.3, 0, sx * -0.12);
    // swept canard forward
    add(new THREE.BoxGeometry(0.95, 0.04, 0.42), accM, sx * 0.72, 0.47, -0.95, 0, sx * 0.55, sx * -0.08);
    // skids
    add(new THREE.BoxGeometry(0.1, 0.3, 0.55), darkM, sx * 0.4, 0.15, 0.9);
  }
  add(new THREE.BoxGeometry(0.1, 0.22, 0.4), darkM, 0, 0.2, -1.3);
  // the stern glow and the under-glow strip
  add(new THREE.BoxGeometry(0.3, 0.1, 0.05), glowMat(0x7fe3ff), 0, 0.5, 1.9);
  add(new THREE.BoxGeometry(0.42, 0.02, 2.6), glowMat(0x7fe3ff), 0, 0.26, -0.2);
  const light = new THREE.PointLight(0x7fe3ff, 0.8, 6);
  light.position.set(0, 0.15, 0);
  g.add(light);
  return g;
}

// ---------------------------------------------------------------------------
// Ghost view
// ---------------------------------------------------------------------------
let hud = null;
function ensureHud() {
  if (hud) return hud;
  const root = document.createElement('div');
  root.id = 'ghost-hud';
  root.className = 'hidden';
  root.innerHTML = `
    <div class="gh-mode">NAV MODE</div>
    <div class="gh-row" data-k="summon"><kbd>E</kbd><span class="gh-name">SUMMON VEHICLE</span><i class="gh-fill"></i></div>
    <div class="gh-row" data-k="orbit"><kbd>O</kbd><span class="gh-name">GO TO ORBIT</span><i class="gh-fill"></i></div>`;
  document.getElementById('hud').appendChild(root);
  hud = { root, summon: root.querySelector('[data-k=summon] .gh-fill'), orbit: root.querySelector('[data-k=orbit] .gh-fill'), summonRow: root.querySelector('[data-k=summon]') };
  return hud;
}

function setGhostHud(P) {
  const h = ensureHud();
  h.root.classList.toggle('hidden', !(P.ghostOut && P.ghostT >= 1));
  h.summonRow.classList.toggle('off', !sparrowAllowed());
  h.summon.style.transform = `scaleX(${clamp(P.ghostHold.summon / SPARROW.summonHold, 0, 1)})`;
  h.orbit.style.transform = `scaleX(${clamp(P.ghostHold.orbit / SPARROW.orbitHold, 0, 1)})`;
}

export function initGhost(P) {
  P.ghostOut = false;          // wanted: weapon down, Ghost out
  P.ghostT = 0;                // actual progress 0..1 of the animation (weapon lowers, hand rises, Ghost teleports in; the reverse on the way out)
  P.ghostLower = 0;            // how far the weapon is lowered (Player.updateViewmodel reads it)
  P.ghostHold = { summon: 0, orbit: 0, deniedT: 0 };
  P.ghostModel = buildGhostRig({ trim: ELEMENTS[P.cls?.element]?.hex });
  P.ghostModel.visible = false;
  G.camera.add(P.ghostModel);
  P.mount = null;
}

export function toggleGhost(P, on = !P.ghostOut) {
  if (P.mount) return;
  if (on === P.ghostOut) return;
  P.ghostOut = on;
  P.ghostHold.summon = P.ghostHold.orbit = 0;
  if (on) sfx.airMove();
  setGhostHud(P);
}

const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const GHOST_ANIM = { inT: 1.1, outT: 0.55, hand: [0.25, 0.65], tele: 0.62 }; // seconds in and out; where in 0..1 the hand rises and the Ghost teleports
const _gw = new THREE.Vector3();

/** Tab: the weapon lowers, a hand comes up from below, and the Ghost teleports in over the palm (and the reverse on the way out). */
function animateGhost(P, dt) {
  const A = GHOST_ANIM, rig = P.ghostModel, gh = rig.userData.ghost, hand = rig.userData.hand, flash = rig.userData.flash;
  const prev = P.ghostT, want = P.ghostOut ? 1 : 0;
  P.ghostT = want > prev ? Math.min(1, prev + dt / A.inT) : Math.max(0, prev - dt / A.outT);
  const t = P.ghostT;
  P.ghostLower = smooth(t / 0.3);
  const rise = smooth((t - A.hand[0]) / (A.hand[1] - A.hand[0]));
  rig.visible = t > 0.01;
  hand.visible = rise > 0.001;
  hand.position.set(0.08, -0.27 - (1 - rise) * 0.55 + Math.sin(G.time * 1.3) * 0.004 * rise, -0.6 + (1 - rise) * 0.12);
  hand.rotation.set(0.12 + (1 - rise) * 0.5, 0.1, -0.05);
  const pop = smooth((t - A.tele) / 0.2);
  const here = t > A.tele;
  if (here !== (prev > A.tele)) { // the Ghost blinks in or out: a flash and a burst of light at the palm
    gh.getWorldPosition(_gw);
    sparks(_gw, 0x8fd8ff, 16, 3, 0.05, 0.5);
    if (here) sfx.airMove();
  }
  gh.visible = here;
  const e = 1 - Math.pow(1 - pop, 3);
  gh.scale.set(0.1 + 0.9 * e, 2.4 - 1.4 * e, 0.1 + 0.9 * e); // a thin streak of light that snaps into the Ghost
  flash.visible = here && pop < 1;
  flash.scale.setScalar(0.4 + pop * 2.4);
  flash.material.opacity = (1 - pop) * 0.85;
  gh.rotation.y = Math.sin(G.time * 0.9) * 0.5;
  gh.rotation.x = Math.sin(G.time * 0.7) * 0.12;
  gh.position.y = -0.1 + Math.sin(G.time * 1.8) * 0.012;
}

/** Runs from Player.update while the player is alive. `orbit` leaves the activity (game.js abandonMission). */
export function updateGhost(P, dt, orbit) {
  const inp = G.input, k = inp.keys;
  if (P.mount) {
    P.ghostT = 0; P.ghostLower = 0; P.ghostModel.visible = false;
    if (inp.pressed.Tab || inp.pressed.KeyE) dismount(P);
    return false;
  }
  if (inp.pressed.Tab) toggleGhost(P);
  if (P.ghostOut || P.ghostT > 0) {
    P.adsT = damp(P.adsT, 0, 14, dt); // aiming down sights lets go as the weapon lowers
    animateGhost(P, dt);
  } else P.ghostModel.visible = false;
  if (!P.ghostOut) { setGhostHud(P); return false; }
  const H = P.ghostHold;
  H.deniedT = Math.max(0, H.deniedT - dt);
  if (P.ghostT < 1) return false; // the keys wake once the Ghost is out
  if (k.KeyE) {
    if (sparrowAllowed()) {
      H.summon += dt;
      if (H.summon >= SPARROW.summonHold) { H.summon = 0; summon(P); }
    } else {
      H.summon = 0;
      if (inp.pressed.KeyE && H.deniedT <= 0) { H.deniedT = 1.5; ui.centerMessage('Unable to summon.', '', 1.5); sfx.empty?.(); }
    }
  } else H.summon = 0;
  if (k.KeyO) {
    H.orbit += dt;
    if (H.orbit >= SPARROW.orbitHold) { H.orbit = 0; toggleGhost(P, false); orbit(); return true; }
  } else H.orbit = 0;
  setGhostHud(P);
  return false;
}

// ---------------------------------------------------------------------------
// Sparrow
// ---------------------------------------------------------------------------
export function summon(P) {
  if (P.mount || !sparrowAllowed()) return false;
  toggleGhost(P, false);
  P.ghostT = 0; P.ghostLower = 0; P.ghostModel.visible = false; setGhostHud(P);
  const model = buildSparrowModel(P.cls?.element === 'void' ? 0xb07bff : P.cls?.element === 'arc' ? 0x6fd4ff : 0xff9a3c);
  G.scene.add(model);
  P.mount = { model, speed: 0, heading: P.yaw, boost: false, tilt: 0, roll: 0 };
  P.vel.set(0, 0, 0);
  sfx.airMove();
  ui.feed('Sparrow summoned', '#7fe3ff');
  return true;
}

export function dismount(P) {
  if (!P.mount) return;
  P.mount.model.removeFromParent();
  P.mount = null;
  P.vel.x *= 0.4; P.vel.z *= 0.4;
}

/** Replaces Player.updateMovement while mounted. Keys: W throttle, S brake and reverse, Shift boost, Space hop; the camera steers. */
export function driveSparrow(P, dt) {
  const k = G.input.keys, M = P.mount, T = SPARROW;
  // heading eases toward where the camera looks
  let dy = P.yaw - M.heading;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const turn = clamp(dy, -T.turn * dt, T.turn * dt);
  M.heading += turn;
  M.boost = !!k.ShiftLeft && !!k.KeyW;
  const target = k.KeyW ? (M.boost ? T.boost : T.top) : k.KeyS ? -T.reverse : 0;
  const rate = target === 0 ? T.brake * 0.35 : (Math.sign(target) === Math.sign(M.speed) || M.speed === 0) && Math.abs(target) > Math.abs(M.speed) ? T.accel : T.brake;
  M.speed += clamp(target - M.speed, -rate * dt, rate * dt);
  const fx = -Math.sin(M.heading), fz = -Math.cos(M.heading);
  const grip = P.onGround ? 7 : 1.6;
  P.vel.x = damp(P.vel.x, fx * M.speed, grip, dt);
  P.vel.z = damp(P.vel.z, fz * M.speed, grip, dt);
  P.vel.y -= 24 * dt;
  if (P.onGround && G.input.pressed.Space) { P.vel.y = T.jump; P.onGround = false; sfx.jump?.(); }
  const before = P.vel.clone();
  const res = moveBody(P.pos, P.vel, dt, T.radius, T.height, T.stepUp);
  P.onGround = res.onGround; P.hitWall = res.hitWall;
  if (res.hitWall) { // a wall takes the speed off
    M.speed *= 0.4;
    if (before.length() > 12) { P.shake = Math.max(P.shake, 0.25); sfx.land?.(); }
  }
  P.eye.set(P.pos.x, P.pos.y + P.eyeH, P.pos.z);
  // the model hovers just above the ground and leans with the slope, the turn and the throttle
  const m = M.model;
  const gy = groundAt(P.pos.x, P.pos.z), gf = groundAt(P.pos.x + fx * 1.4, P.pos.z + fz * 1.4), gb = groundAt(P.pos.x - fx * 1.4, P.pos.z - fz * 1.4);
  M.tilt = damp(M.tilt, Math.atan2(gf - gb, 2.8), 8, dt);
  M.roll = damp(M.roll, clamp(-turn / Math.max(dt, 1e-3) * 0.12, -0.5, 0.5) * clamp(M.speed / T.top, 0, 1), 6, dt);
  m.position.set(P.pos.x, Math.max(P.pos.y, gy) + T.hover * (P.onGround ? 1 : 0.4), P.pos.z);
  m.rotation.set(M.tilt, M.heading, M.roll, 'YXZ');
}

/** Where the rider sits, for the player's body (Player.updateBody). */
export function riderPos(P, out) {
  const m = P.mount.model;
  const h = P.mount.heading;
  return out.copy(m.position).add({ x: Math.sin(h) * 0.58, y: -0.06, z: Math.cos(h) * 0.58 }); // hips on the saddle (aft of centre, 0.9 up); the rig's hips are 0.96 above its feet
}
