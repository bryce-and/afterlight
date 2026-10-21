// Hand-built Earth (Cosmodrome) mission maps (see makeKit in world.js).
// e1: wide open Steppes: broken highway car graveyard -> Skywatch radar field -> the Wall's hangar doors.
// e2: the Divide (narrow concrete canyon of pipes) -> Rocketyard (gantries, standing rocket) -> Rasputin's Array plateau.
// e3: Mothyards (airliner hulks, hangar shells) -> Lunar Complex ruins -> roofed Fallen halls -> the Devils' Lair chamber.
import * as THREE from 'three';

const ROAD = 0x3b3835, PAINT = 0xd8cfae, CONC = 0x9d978c, CONC2 = 0x7c776e, RUST = 0x8e4a2a;
const WHITE = 0xd9d5cb, DARK = 0x25272b, YELLOW = 0xc9a23a, GANTRY = 0x9a3a28, HULLW = 0xbdb6a8;
const F_BLUE = 0x6fd0ff, F_RED = 0xff5a3c, CLOTH_B = 0x2c4a73, CLOTH_R = 0x7e2626, FALLEN = 0x343f52, ROOF = 0x3a3c42;

// shared unit geometries, created lazily (THREE is only needed once build() runs)
const GEO = {};
const geo = (k, make) => GEO[k] || (GEO[k] = make());
const cyl10 = () => geo('cyl10', () => new THREE.CylinderGeometry(1, 1, 1, 10));
const cyl8 = () => geo('cyl8', () => new THREE.CylinderGeometry(1, 1, 1, 8));
const hemi = () => geo('hemi', () => new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2));

// double-sided meshes (dish bowls, hangar shells) added straight to the scene
const dsMats = new Map();
function dsMesh(K, g, color, x, y, z, rx = 0, ry = 0, rz = 0, order = 'XYZ') {
  let m = dsMats.get(color);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }); dsMats.set(color, m); }
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.set(rx, ry, rz, order);
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  K.scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------- props

function car(K, x, z, alongZ = true, color) {
  const c = color ?? K.RP([K.C.accent, RUST, 0x6b5a4a, 0x56656a, 0x7a7458, 0x5b4f45]);
  const w = alongZ ? 1.9 : 4.2, d = alongZ ? 4.2 : 1.9;
  const body = K.box(x, z, w, 0.95, d, c, { y: 0.3, collide: false });
  K.box(x + (alongZ ? 0 : 0.3), z + (alongZ ? 0.3 : 0), alongZ ? 1.7 : 2.1, 0.75, alongZ ? 2.1 : 1.7, c, { y: 1.25, collide: false });
  for (const s of [-1, 1]) K.box(x + (alongZ ? 0 : s * 1.3), z + (alongZ ? s * 1.3 : 0), alongZ ? 2.0 : 0.6, 0.45, alongZ ? 0.6 : 2.0, DARK, { collide: false });
  K.collider(x - w / 2, 0, z - d / 2, x + w / 2, 2.0, z + d / 2, body);
}

function pine(K, x, z, h = K.R(5, 8.5)) {
  K.mesh(geo('trunk', () => new THREE.CylinderGeometry(0.6, 1, 1, 5)), 0x4a3a2a, x, h * 0.25, z, { scale: [0.3, h * 0.5, 0.3] });
  for (let k = 0; k < 3; k++) {
    const r = (2.0 - k * 0.55) * (h / 7);
    K.mesh(geo('cone6', () => new THREE.ConeGeometry(1, 1, 6)), k === 1 ? 0x35502f : K.C.foliage, x, h * (0.42 + k * 0.18), z, { scale: [r, h * 0.4, r], ry: k });
  }
  K.collider(x - 0.4, 0, z - 0.4, x + 0.4, h, z + 0.4, null);
}

// steel power pylon (line runs along z, arms along x)
function pylon(K, x, z, h = 24) {
  const M = 0x5c6168;
  K.mesh(geo('pyl', () => new THREE.CylinderGeometry(0.3, 1, 1, 4)), M, x, h / 2, z, { scale: [2.8, h, 2.8], ry: Math.PI / 4 });
  K.box(x, z, 13, 0.5, 0.6, M, { y: h * 0.84, collide: false });
  K.box(x, z, 9, 0.5, 0.6, M, { y: h * 0.68, collide: false });
  K.box(x, z, 0.35, 3.5, 0.35, M, { y: h, collide: false });
  K.collider(x - 1.6, 0, z - 1.6, x + 1.6, h, z + 1.6, null);
}
function wires(K, x, z1, z2, h = 24) {
  const L = Math.abs(z2 - z1), zc = (z1 + z2) / 2;
  for (const [dx, yy] of [[-6, h * 0.84], [6, h * 0.84], [-4, h * 0.68], [4, h * 0.68]]) K.box(x + dx, zc, 0.07, 0.07, L, DARK, { y: yy - 1.4, collide: false });
}

function container(K, x, z, alongZ = false, y = 0, color) {
  const c = color ?? K.RP([0x7a4a32, 0x4f6a5a, 0x5a6478, 0x8a7a4a, 0x9a5a3a]);
  const w = alongZ ? 2.5 : 6.1, d = alongZ ? 6.1 : 2.5;
  K.box(x, z, w, 2.6, d, c, { y });
  K.box(x, z, w + 0.1, 0.16, d + 0.1, DARK, { y: y + 2.45, collide: false });
}

const barrier = (K, x, z, alongX = true) => K.box(x, z, alongX ? 3.2 : 0.8, 1.1, alongX ? 0.8 : 3.2, CONC);

function banner(K, x, z, color = CLOTH_B, h = 5.5) {
  K.box(x, z, 0.25, h, 0.25, 0x4a4f58);
  K.box(x + 0.5, z, 1.8, 0.16, 0.16, 0x4a4f58, { y: h - 0.4, collide: false });
  K.box(x + 0.9, z, 1.2, 2.6, 0.06, color, { y: h - 3.0, collide: false });
  K.box(x + 0.9, z, 0.32, 0.32, 0.1, F_BLUE, { y: h - 1.6, collide: false, glow: 1.8 });
}

// Fallen energy shield barricade and supply crate
function shield(K, x, z, alongX = true) {
  K.box(x, z, alongX ? 3.4 : 0.5, 1.4, alongX ? 0.5 : 3.4, FALLEN);
  K.box(x, z, alongX ? 3.4 : 0.56, 0.14, alongX ? 0.56 : 3.4, F_BLUE, { y: 1.4, collide: false, glow: 1.6 });
}
function fcrate(K, x, z, s = 1.5) {
  K.box(x, z, s, s, s, FALLEN);
  K.box(x, z, s + 0.06, 0.12, s + 0.06, K.chance(0.5) ? F_BLUE : F_RED, { y: s * 0.55, collide: false, glow: 1.5 });
}

// hanging cloth banner with a glowing emblem (alongX = cloth plane runs along x)
function cloth(K, x, z, y, w, h, alongX, color, emblem = F_BLUE) {
  K.box(x, z, alongX ? w : 0.08, h, alongX ? 0.08 : w, color, { y, collide: false });
  K.box(x, z, alongX ? w * 0.3 : 0.14, w * 0.3, alongX ? 0.14 : w * 0.3, emblem, { y: y + h * 0.62, collide: false, glow: 1.6 });
}

// radar dish: pedestal, bowl tilted by `tilt` and turned by `yaw`, feed horn on a pole
function dish(K, x, z, r, standH, tilt = 0.5, yaw = 0, pad = true) {
  if (pad) K.box(x, z, r * 1.7, 0.25, r * 1.7, CONC2, { collide: false });
  K.cyl(x, z, Math.max(0.6, r * 0.13), standH, K.C.metal, { sides: 8 });
  K.box(x, z, r * 0.4, r * 0.25, r * 0.4, CONC, { y: standH - r * 0.2, collide: false });
  const R = r * 1.25, g = new THREE.SphereGeometry(R, 16, 4, 0, Math.PI * 2, 0, 0.75);
  g.translate(0, -R, 0);
  dsMesh(K, g, WHITE, x, standH, z, Math.PI - tilt, yaw, 0, 'YXZ');
  const L = r * 0.85, pr = 0.08 + r * 0.012;
  const pole = K.mesh(geo('pole', () => new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, 0.5, 0)), K.C.metal, x, standH, z, { rx: -tilt, ry: yaw, scale: [pr, L, pr] });
  pole.rotation.order = 'YXZ';
  const dx = -Math.sin(tilt) * Math.sin(yaw), dy = Math.cos(tilt), dz = -Math.sin(tilt) * Math.cos(yaw), hs = r * 0.12 + 0.2;
  K.box(x + dx * L, z + dz * L, hs, hs, hs, DARK, { y: standH + dy * L - hs / 2, collide: false });
}

// crashed Fallen skiff, nose buried toward -x
function skiff(K, x, z) {
  const H = 0x3a4658, T = 0x262c36;
  K.mesh(new THREE.BoxGeometry(17, 2.6, 5), H, x, 2.0, z, { rz: 0.14 });
  K.mesh(new THREE.BoxGeometry(9, 1.6, 3.4), T, x + 1.5, 3.7, z, { rz: 0.14 });
  for (const s of [-1, 1]) {
    K.mesh(new THREE.BoxGeometry(8, 0.9, 0.9), H, x - 11.5, 0.5, z + s * 1.7, { rz: 0.14 });
    K.mesh(cyl8(), T, x + 8.6, 3.3, z + s * 3.0, { rz: Math.PI / 2 + 0.14, scale: [1.0, 4, 1.0] });
    K.box(x + 10.7, z + s * 3.0, 0.3, 1.3, 1.3, F_BLUE, { y: 3.0, collide: false, glow: 2 });
    K.mesh(new THREE.BoxGeometry(4, 0.3, 3), H, x + 6, 4.9, z + s * 2.6, { rx: s * 0.6 });
  }
  K.collider(x - 8.5, 0, z - 4, x + 10.8, 3.9, z + 4, null);
  K.collider(x - 15.5, 0, z - 2.3, x - 8.5, 1.2, z + 2.3, null);
}

// airliner fuselage hulk lying along z, nose toward -z
function fuselage(K, x, z, L, o = {}) {
  const r = 2.4, col = o.color ?? HULLW, y = r + 0.15;
  K.mesh(cyl10(), col, x, y, z, { rx: Math.PI / 2, scale: [r, L, r], collide: true });
  if (o.nose !== false) K.mesh(hemi(), col, x, y, z - L / 2, { rx: -Math.PI / 2, scale: [r, r * 1.6, r] });
  for (const s of [-1, 1]) K.box(x + s * (r - 0.05), z, 0.2, 0.5, L * 0.85, 0x3d5a80, { y: y + 0.5, collide: false });
  if (o.tail !== false) {
    K.box(x, z + L / 2 - 2.2, 0.4, 5, 4, col, { y: y + r - 0.4, collide: false });
    K.box(x, z + L / 2 - 1.8, 9, 0.35, 2.6, col, { y: y + 0.6, collide: false });
  }
  if (o.wing) {
    for (const s of o.wing === 2 ? [-1, 1] : [o.wing]) {
      K.box(x + s * (r + 6), z + 1, 12, 0.45, 5, col, { y: 2.0 });
      K.mesh(cyl10(), 0x8f8a80, x + s * (r + 4.5), 1.2, z - 0.5, { rx: Math.PI / 2, scale: [1.0, 3.6, 1.0], collide: true });
    }
  }
  K.box(x, z + K.R(-L / 3, L / 3), r * 2.05, 1.4, 2.4, RUST, { y: y - 0.2, collide: false });
}

// Quonset hangar shell along z (open both ends); full = clad, else bare ribs with a scrap of cladding
function hangar(K, x, z, r, L, full = true, color = 0x858a8e) {
  const rib = geo('rib' + r, () => new THREE.TorusGeometry(r, 0.35, 4, 14, Math.PI));
  if (full) {
    const shell = dsMesh(K, new THREE.CylinderGeometry(r, r, L, 14, 1, true, Math.PI / 2, Math.PI), color, x, 0, z, Math.PI / 2, 0, 0);
    for (const dz of [-L / 2, 0, L / 2]) K.mesh(rib, RUST, x, 0, z + dz);
    // the shell mesh rides on the first collider so it also blocks enemy line of sight
    for (const s of [-1, 1]) K.collider(x + s * r - 0.6, 0, z - L / 2, x + s * r + 0.6, r * 0.6, z + L / 2, s < 0 ? shell : null);
  } else {
    for (let dz = -L / 2; dz <= L / 2 + 0.01; dz += 6) {
      K.mesh(rib, RUST, x, 0, z + dz);
      for (const s of [-1, 1]) K.collider(x + s * r - 0.5, 0, z + dz - 0.5, x + s * r + 0.5, 3, z + dz + 0.5, null);
    }
    dsMesh(K, new THREE.CylinderGeometry(r, r, L * 0.5, 8, 1, true, Math.PI / 2, Math.PI * 0.35), color, x, 0, z - L * 0.2, Math.PI / 2, 0, 0);
  }
}

function rocket(K, x, z) {
  K.cyl(x, z, 3.2, 36, WHITE, { sides: 12 });
  K.cyl(x, z, 3.28, 1.4, K.C.accent, { y: 12, sides: 12, collide: false });
  K.cyl(x, z, 3.28, 1.4, DARK, { y: 26, sides: 12, collide: false });
  K.cyl(x, z, 3.2, 6, WHITE, { y: 36, r2: 1.6, sides: 12, collide: false });
  K.cone(x, z, 1.6, 5, K.C.accent, { y: 42, sides: 12, collide: false });
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, bx = x + Math.cos(a) * 4.4, bz = z + Math.sin(a) * 4.4;
    K.cyl(bx, bz, 1.5, 18, WHITE, { y: 1.5, sides: 8 });
    K.cone(bx, bz, 1.5, 5, WHITE, { y: 19.5, sides: 8, collide: false });
    K.cyl(bx, bz, 1.2, 1.5, DARK, { r2: 0.8, sides: 8 });
  }
}

// launch gantry tower: open frame of decks, elevator core, service arms toward armDir
function gantry(K, x, z, w, h, armDir, armLen) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(x + sx * w / 2, z + sz * w / 2, 0.7, h, 0.7, GANTRY, { collide: false });
  for (let y = 5; y < h; y += 5) K.box(x, z, w + 0.7, 0.35, w + 0.7, K.C.metal, { y, collide: false });
  K.box(x, z, w * 0.45, h, w * 0.45, K.C.metal);
  const [dx, dz] = armDir;
  for (const yy of [h * 0.55, h * 0.8]) K.box(x + dx * (w / 2 + armLen / 2), z + dz * (w / 2 + armLen / 2), dx ? armLen : 1.4, 0.9, dz ? armLen : 1.4, GANTRY, { y: yy, collide: false });
  K.box(x, z, w * 0.6, 3, w * 0.6, GANTRY, { y: h, collide: false });
  K.collider(x - w / 2 - 0.4, 0, z - w / 2 - 0.4, x + w / 2 + 0.4, h, z + w / 2 + 0.4, null);
}

function crane(K, x, z, h, jib, dir = 1) {
  K.box(x, z, 1.8, h, 1.8, YELLOW);
  K.box(x + dir * (jib / 2 - 4), z, jib, 1.3, 1.3, YELLOW, { y: h + 1.5, collide: false });
  K.box(x - dir * 4.5, z, 3.5, 2.2, 2.6, CONC2, { y: h + 0.4, collide: false });
  K.box(x, z, 2.6, 2.4, 2.6, YELLOW, { y: h - 0.9, collide: false });
  K.box(x, z, 0.5, 4, 0.5, YELLOW, { y: h + 2.8, collide: false });
  const hx = x + dir * (jib - 7);
  K.box(hx, z, 0.08, 9, 0.08, DARK, { y: h - 7.5, collide: false });
  K.box(hx, z, 0.9, 1.0, 0.9, DARK, { y: h - 8.5, collide: false });
}

function sphereTank(K, x, z, r) {
  const legH = r * 0.7;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(x + sx * r * 0.6, z + sz * r * 0.6, 0.5, legH + r * 0.3, 0.5, K.C.metal, { collide: false });
  K.mesh(geo('sph', () => new THREE.SphereGeometry(1, 12, 8)), WHITE, x, legH + r, z, { scale: r, collide: 0.75 });
  K.collider(x - r * 0.7, 0, z - r * 0.7, x + r * 0.7, legH, z + r * 0.7, null);
}

function hTank(K, x, z, r, L) {
  K.mesh(cyl10(), WHITE, x, r + 0.7, z, { rx: Math.PI / 2, scale: [r, L, r], collide: true });
  for (const s of [-1, 1]) {
    K.mesh(hemi(), WHITE, x, r + 0.7, z + s * L / 2, { rx: s * Math.PI / 2, scale: [r, r * 0.5, r] });
    K.box(x, z + s * L * 0.3, r * 1.6, r * 0.9, 1, CONC2);
  }
  K.box(x, z, r * 2.06, r * 2.06, 0.8, K.C.accent, { y: 0.7, collide: false });
}

function bunker(K, x, z, w, d, h, glowC) {
  K.box(x, z, w, h, d, CONC);
  K.box(x, z, w + 0.7, 0.5, d + 0.7, CONC2, { y: h, collide: false });
  K.box(x, z, w + 0.06, 0.6, d + 0.06, glowC ?? DARK, { y: h * 0.58, collide: false, glow: glowC ? 1.0 : undefined });
  K.box(x + w * 0.2, z, 1.6, 1.0, 1.6, K.C.metal, { y: h + 0.5, collide: false });
}

function valve(K, x, z) {
  K.cyl(x, z, 1.2, 2.6, K.C.metal, { sides: 8 });
  K.cyl(x, z, 0.35, 1.2, RUST, { y: 2.6, collide: false });
  K.box(x, z, 1.8, 0.22, 0.22, 0xb03a2a, { y: 3.5, collide: false });
}

function mast(K, x, z, h) {
  K.box(x, z, 0.5, h, 0.5, K.C.metal);
  K.box(x, z, 3, 0.2, 0.2, K.C.metal, { y: h * 0.75, collide: false });
  K.box(x, z, 0.6, 0.6, 0.6, F_RED, { y: h, collide: false, glow: 2 });
}

// compound floodlight: pole, glowing lamp head and a lamp for the light pool
function flood(K, x, z, h = 9, color = 0xffe3b0, power = 7) {
  K.box(x, z, 0.4, h, 0.4, K.C.metal);
  K.box(x, z, 1.6, 0.5, 0.9, DARK, { y: h, collide: false });
  K.box(x, z, 1.3, 0.2, 0.6, color, { y: h - 0.05, collide: false, glow: 1.8 });
  K.light(x, h - 0.6, z, color, power, 26);
}

// see-through chain-link fence with posts; gaps are [from, to] metres from the min end (sorted)
let FENCE_MAT = null, UNIT = null;
function fence(K, x1, z1, x2, z2, h = 2.6, gaps = []) {
  if (!FENCE_MAT) {
    FENCE_MAT = new THREE.MeshStandardMaterial({ color: 0xa0a6aa, transparent: true, opacity: 0.32, roughness: 0.7, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide });
    UNIT = new THREE.BoxGeometry(1, 1, 1);
  }
  const horiz = Math.abs(z2 - z1) < Math.abs(x2 - x1);
  const len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const start = horiz ? Math.min(x1, x2) : Math.min(z1, z2), fixed = horiz ? z1 : x1;
  let from = 0;
  for (const [a, b] of [...gaps, [len, len]]) {
    if (a - from > 0.5) {
      const L = a - from, mid = start + (from + a) / 2;
      const px = horiz ? mid : fixed, pz = horiz ? fixed : mid;
      const m = new THREE.Mesh(UNIT, FENCE_MAT);
      m.scale.set(horiz ? L : 0.05, h, horiz ? 0.05 : L);
      m.position.set(px, h / 2, pz);
      K.scene.add(m);
      K.box(px, pz, horiz ? L : 0.1, 0.1, horiz ? 0.1 : L, K.C.metal, { y: h, collide: false });
      const n = Math.max(1, Math.round(L / 7));
      for (let i = 0; i <= n; i++) {
        const p = start + from + (i * L) / n;
        K.box(horiz ? p : fixed, horiz ? fixed : p, 0.18, h + 0.3, 0.18, K.C.metal, { collide: false });
      }
      if (horiz) K.collider(start + from, 0, fixed - 0.15, start + a, h, fixed + 0.15, null);
      else K.collider(fixed - 0.15, 0, start + from, fixed + 0.15, h, start + a, null);
    }
    from = Math.max(from, b);
  }
}

// ruined wall of uneven 3 m chunks; chunks touching a gap are left out
function ruinWall(K, x1, z1, x2, z2, hMin, hMax, gaps = [], t = 0.9, color) {
  const horiz = Math.abs(z2 - z1) < Math.abs(x2 - x1);
  const len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const start = horiz ? Math.min(x1, x2) : Math.min(z1, z2);
  for (let a = 0; a < len - 0.1; a += 3) {
    const b = Math.min(len, a + 3);
    if (gaps.some(([g0, g1]) => a < g1 && b > g0)) continue;
    const mid = start + (a + b) / 2, h = K.R(hMin, hMax), c = color ?? (K.chance(0.5) ? CONC : CONC2);
    if (horiz) K.box(mid, z1, b - a, h, t, c); else K.box(x1, mid, t, h, b - a, c);
  }
}

// ---------------------------------------------------------------- missions

export default {
  // A Guardian Rises: open dawn steppe. Highway car graveyard, Skywatch dishes, the Wall.
  e1: {
    spawn: [0, 152],
    bounds: [-75, 85, -100, 165],
    zones: [
      { name: 'The Steppes', x: 0, z: 85 },
      { name: 'Skywatch', x: 35, z: 15 },
      { name: 'The Wall', x: 8, z: -58, boss: true, room: { minX: -26, maxX: 42, minZ: -91, maxZ: -37 } },
    ],
    build(K) {
      const C = K.C;

      // ---- the broken highway ----
      K.box(0, 100, 18, 0.05, 134, ROAD, { collide: false });
      for (let z = 162; z > 36; z -= 7) K.box(0, z, 0.3, 0.06, 3, PAINT, { collide: false });
      for (const [x, z, ry] of [[2, 25, 0.15], [5, 13, -0.2], [9, 3, 0.3]]) K.mesh(new THREE.BoxGeometry(12, 0.3, 9), ROAD, x, 0.05, z, { ry, rx: 0.02 });
      for (const s of [-1, 1]) for (let z = 160; z > 40; z -= 12) if (K.chance(0.65)) K.box(s * 9.7, z - 5, 0.3, 0.8, 9, C.metal);
      // jammed traffic: never more than two of four lanes blocked in a row
      const lanes = [-6.3, -2.1, 2.1, 6.3];
      for (let z = 158; z > 40; z -= K.R(6.5, 9)) {
        const skip = Math.floor(K.rng() * 3);
        lanes.forEach((lx, i) => {
          if (i === skip || i === skip + 1 || !K.chance(0.6)) return;
          const x = lx + K.R(-0.4, 0.4), zz = z + K.R(-1.2, 1.2);
          if (K.clear(x, zz, 2.4)) car(K, x, zz, true);
        });
      }
      // car graveyard lots beside the road
      for (const rz of [128, 142]) for (let x = -52; x <= -22; x += 2.7) if (K.chance(0.7) && K.clear(x, rz, 2.4)) car(K, x, rz, true);
      for (const rz of [72]) for (let x = 24; x <= 54; x += 2.7) if (K.chance(0.65)) car(K, x, rz, true);

      // ---- collapsed overpass ----
      const OZ = 118;
      K.box(-53.5, OZ, 57, 1.4, 8, CONC, { y: 7.5 });
      K.box(40.5, OZ, 103, 1.4, 8, CONC, { y: 7.5 });
      for (const [a, b] of [[-82, -25], [-11, 92]]) for (const s of [-1, 1]) K.box((a + b) / 2, OZ + s * 3.8, b - a, 0.9, 0.4, CONC2, { y: 8.9, collide: false });
      for (const px of [-62, -42, -26, -11, 14, 38, 62]) K.box(px, OZ, 2.2, 7.5, 5, CONC2);
      const slab = K.mesh(new THREE.BoxGeometry(16, 1.3, 7.6), CONC, -18, 3.6, OZ, { rz: 0.42 });
      K.collider(-25.5, 0, OZ - 3.8, -11.5, 4.6, OZ + 3.8, slab);
      for (const [x, s] of [[-25, -1], [-11, 1]]) for (const dz of [-2.5, 0, 2.5]) K.box(x + s * 0.6, OZ + dz, 1.4, 0.1, 0.1, RUST, { y: 7.9, collide: false });
      K.rock(-28, 112, 1.6); K.rock(-21, 124, 1.3); K.rock(-30, 122, 1.0);

      // ---- power lines ----
      const PZ = [150, 95, 40, -15];
      PZ.forEach((pz, i) => { pylon(K, -62, pz); if (i) wires(K, -62, PZ[i - 1], pz); });
      wires(K, -62, 150, 200);
      pylon(K, 74, 140); pylon(K, 74, 60); wires(K, 74, 140, 60);
      // a toppled pylon lying across the grass
      const top = K.mesh(geo('pyl', () => new THREE.CylinderGeometry(0.3, 1, 1, 4)), 0x5c6168, -40, 2.0, 20, { rz: Math.PI / 2 - 0.08, ry: 0, scale: [2.4, 22, 2.4] });
      K.collider(-51, 0, 18.4, -29, 3.4, 21.6, top);

      // ---- pine stands ----
      for (const [cx, cz, n] of [[48, 148, 6], [60, 100, 5], [-38, 70, 6], [-56, 8, 6], [66, -30, 5], [-50, -48, 6], [34, 98, 3], [-20, 42, 4]]) {
        K.scatter((x, z) => pine(K, x, z), cx, cz, 0, 8, n, 1.5);
      }

      // ---- Skywatch ----
      fence(K, 4, 46, 72, 46, 2.6, [[8, 24]]);
      fence(K, 4, -16, 72, -16, 2.6, [[12, 28]]);
      fence(K, 4, -16, 4, 46, 2.6);
      fence(K, 72, -16, 72, 46, 2.6);
      dish(K, 14, 30, 6, 5, 0.55, 0.8);
      dish(K, 22, -4, 6, 5, 0.5, 2.4);
      dish(K, 52, 0, 6.5, 5.5, 0.6, -1.0);
      dish(K, 54, 30, 6, 5, 0.5, 3.6);
      K.box(44.2, 24, 7, 0.25, 7, CONC2, { collide: false });
      dish(K, 42.5, 22.5, 2.2, 2.4, 0.6, 0.5, false);
      dish(K, 46, 23, 2.0, 2.2, 0.7, 2.0, false);
      dish(K, 44, 26.5, 2.2, 2.4, 0.5, 4, false);
      bunker(K, 64, 12, 10, 16, 4.4);
      bunker(K, 12, 8, 12, 10, 4);
      bunker(K, 40, 40, 8, 6, 3.6);
      mast(K, 30, 42, 16);
      K.stairs(0, 8, 'e', 3, 4.0, { color: CONC2 }); // bunker roof overlook (optional high ground)
      K.light(14, 6, 8, 0xffd27a, 5, 22);
      K.light(52, 6, 20, 0x9fe0ff, 5, 22);
      barrier(K, 27, 10, false); container(K, 30, 22, false); K.crate(42, 10); K.crate(43, 8.5);
      barrier(K, 36, 4); K.crate(31, 2); barrier(K, 45, 12, false); K.crate(26, 16); barrier(K, 36, 28);
      banner(K, 10, 43, CLOTH_B); banner(K, 30, 43, CLOTH_B); banner(K, 60, -10, CLOTH_R);

      // ---- road to the Wall ----
      container(K, 40, -30, true); container(K, 40, -30, true, 2.6); container(K, 44, -24, false);
      container(K, -4, -24, false); container(K, -10, -30, true);
      K.rock(28, -31, 2.2); K.rock(-18, -12, 2.6); K.rock(58, -50, 2.0);

      // ---- the Wall: colossal concrete face with the colony-ship hangar doors ----
      const WZ = -94, DX = 8;
      K.box(0, WZ - 5, 260, 38, 10, CONC2);
      for (let x = -120; x <= 120; x += 18) if (Math.abs(x - DX) > 28) K.box(x, WZ + 0.7, 3, 38, 1.4, CONC);
      K.box(0, WZ + 0.5, 260, 2, 1, CONC, { y: 31, collide: false });
      K.box(0, WZ - 1, 262, 1.5, 12, CONC, { y: 38, collide: false });
      for (const s of [-1, 1]) K.box(DX + s * 24, WZ + 1.3, 4, 30, 2.6, CONC);
      K.box(DX, WZ + 1.3, 52, 4, 2.6, CONC, { y: 28 });
      for (const s of [-1, 1]) K.box(DX + s * 11.2, WZ + 0.6, 21.6, 28, 1.2, 0x4f555c);
      K.box(DX, WZ + 0.2, 0.8, 27, 0.4, 0xffc27a, { glow: 1.5, collide: false });
      for (const yy of [9, 18]) K.box(DX, WZ + 1.3, 44, 0.8, 0.3, DARK, { y: yy, collide: false });
      K.box(DX, WZ + 1.3, 44, 1.2, 0.3, C.accent, { y: 0.2, collide: false });
      K.mesh(cyl10(), C.metal, -48, 1.2, WZ + 2.2, { rz: Math.PI / 2, scale: [0.9, 54, 0.9], collide: true });
      K.mesh(cyl10(), C.metal, 60, 1.2, WZ + 2.2, { rz: Math.PI / 2, scale: [0.9, 50, 0.9], collide: true });

      // ---- boss yard: walled Wall compound with one gate, crashed skiff, cover, two raised decks ----
      K.wall(-26, -91, -26, -36, 8, { t: 1.4, color: CONC2 });
      K.wall(42, -91, 42, -36, 8, { t: 1.4, color: CONC2 });
      K.wall(-26, -36, 42, -36, 8, { t: 1.4, color: CONC2, gaps: [[30, 38]] });
      K.door(8, -36, 8, 8, 'x', { zone: 1, t: 1.4, color: 0x4f555c, trim: C.accent });
      K.box(8, -36, 11, 1.2, 2, CONC, { y: 8, collide: false });
      for (const s of [-1, 1]) { K.box(8 + s * 5.2, -36, 2.2, 10, 2.2, CONC); K.box(8 + s * 5.2, -34.8, 0.5, 0.5, 0.2, F_RED, { y: 6, collide: false, glow: 2 }); }
      for (const [x, z] of [[-26, -36], [42, -36], [-26, -91], [42, -91]]) flood(K, x + (x < 8 ? 1.4 : -1.4), z + (z < -60 ? 1.4 : -1.4), 11);
      for (const z of [-48, -62, -76]) for (const x of [-25.2, 41.2]) K.box(x, z, 0.2, 0.3, 5, F_BLUE, { y: 5, collide: false, glow: 1.4 });
      skiff(K, -6, -83);
      fcrate(K, -12, -50); fcrate(K, -16, -73); fcrate(K, -22, -86);
      banner(K, -24.5, -47, CLOTH_B); banner(K, -14, -76, CLOTH_R);
      barrier(K, -2, -48); barrier(K, 18, -48); container(K, 22, -66, true);
      shield(K, -4, -66, false); shield(K, 12, -76, true); fcrate(K, 26, -52); K.crate(-6, -58);
      container(K, 50, -86, false); container(K, 50, -86, false, 2.6); container(K, 58, -80, true); container(K, -40, -86, false);
      banner(K, -20, -88, CLOTH_R); banner(K, 36, -88, CLOTH_B);
      // raised decks along both walls: firing positions over the yard (stairs only, optional)
      K.platform(37, -62, 8, 18, 2.0, { stairs: ['w'], color: CONC2, stairColor: CONC });
      K.platform(-20, -62, 8, 18, 2.0, { stairs: ['e'], color: CONC2, stairColor: CONC });
      for (const [x, dx] of [[40.6, -1], [-23.6, 1]]) K.box(x, -62, 0.25, 1.0, 18, K.C.metal, { y: 2.0, collide: false });
      K.light(37, 6, -62, F_BLUE, 6, 20);
      K.light(DX, 8, WZ + 3, 0xffb070, 10, 30);
      K.light(-20, 6, -62, F_BLUE, 6, 20);
      K.light(8, 7, -40, 0xffb070, 7, 22);
      K.light(8, 6, -82, F_BLUE, 6, 24);
    },
  },

  // The Last Array: concrete canyon -> industrial rocketyard -> open dish plateau.
  e2: {
    spawn: [0, 134],
    bounds: [-55, 55, -112, 145],
    zones: [
      { name: 'The Divide', x: 0, z: 78 },
      { name: 'Rocketyard', x: -8, z: 8 },
      { name: 'The Array', x: 5, z: -68, boss: true, room: { minX: -36, maxX: 42, minZ: -110, maxZ: -41 } },
    ],
    build(K) {
      const C = K.C;

      // ---- the Divide: towering concrete walls lined with pipes ----
      for (const [za, zb, hw] of [[152, 118, 10], [118, 100, 7.5], [100, 58, 17], [58, 36, 8]]) {
        const n = Math.max(1, Math.round((za - zb) / 9)), step = (za - zb) / n;
        for (let i = 0; i < n; i++) {
          const zc = za - (i + 0.5) * step;
          for (const s of [-1, 1]) {
            const w = hw + K.R(0, 1.2), h = K.R(17, 26);
            K.box(s * (w + 64) / 2, zc, 64 - w, h, step, K.chance(0.5) ? CONC : CONC2);
            K.mesh(cyl8(), C.metal, s * (w - 0.6), 6.5, zc, { rx: Math.PI / 2, scale: [0.6, step, 0.6] });
            if (s < 0) K.mesh(cyl8(), RUST, s * (w - 0.9), 1.3, zc, { rx: Math.PI / 2, scale: [0.9, step, 0.9], collide: true });
            if (K.chance(0.5)) K.box(s * (w - 0.2), zc, 0.4, 0.6, 1.4, 0xffd27a, { y: 9, glow: 1.4, collide: false });
          }
        }
      }
      for (const [z, hw] of [[140, 10], [112, 7.5], [104, 7.5], [70, 17], [46, 8]]) K.mesh(cyl8(), C.metal, 0, 14, z, { rz: Math.PI / 2, scale: [0.8, 2 * hw + 6, 0.8] });
      K.box(0, 88, 36, 0.4, 2.6, C.metal, { y: 11, collide: false });
      for (const s of [-1, 1]) K.box(0, 88 + s * 1.2, 36, 1.0, 0.1, C.metal, { y: 11.4, collide: false });
      K.box(0, 37, 22, 4, 3, CONC2, { y: 17, collide: false });
      // junction (zone 1) cover
      container(K, -10, 92, false); valve(K, 9, 88); barrier(K, -6, 69); container(K, 11, 66, true);
      valve(K, -12, 78); K.crate(5, 95); shield(K, 7, 76, false); shield(K, -4, 84, true); fcrate(K, 13, 80);
      barrier(K, -11, 62, false); K.crate(-14, 98);
      cloth(K, -16.8, 84, 3, 2.4, 6, false, CLOTH_R); cloth(K, 16.8, 72, 3, 2.4, 6, false, CLOTH_B);
      // choke barricade and abandoned cars in the narrows
      shield(K, -3.5, 106, true); shield(K, 5.5, 108, true);
      car(K, 4, 125, true); car(K, 3.5, 113, true); K.crate(-3, 120);
      K.light(0, 10, 80, 0xffd27a, 8, 30);

      // ---- Rocketyard ----
      K.box(0, -2, 110, 0.04, 76, 0x8f8a80, { collide: false });
      K.box(30, -14, 22, 0.2, 22, 0x5a5650, { collide: false });
      K.box(30, -14, 6, 0.22, 30, DARK, { collide: false });
      rocket(K, 30, -14);
      gantry(K, 30, -2.5, 6, 40, [0, -1], 4.5);
      gantry(K, 21, -14, 4, 28, [1, 0], 3);
      sphereTank(K, -40, -14, 5); sphereTank(K, -30, -28, 4);
      hTank(K, -44, 22, 2.6, 14); hTank(K, -36, 22, 2.6, 14);
      crane(K, 46, 26, 30, 26, -1); crane(K, -46, -24, 24, 22, 1);
      // rail spur with derelict wagons
      for (const dz of [-0.7, 0.7]) K.box(0, -33 + dz, 110, 0.15, 0.15, C.metal, { collide: false });
      for (const [x, c] of [[-12, 0x5a4a3a], [18, 0x4f5a5a]]) {
        const w = K.box(x, -33, 12, 3.4, 3.2, c, { y: 0.5, collide: false });
        K.box(x, -33, 11, 0.6, 2.6, DARK, { collide: false });
        K.collider(x - 6, 0, -34.6, x + 6, 3.9, -31.4, w);
      }
      container(K, 10, 24, false); container(K, 10, 24, false, 2.6); container(K, -24, 30, true);
      container(K, 40, 14, true); container(K, -14, -20, false);
      barrier(K, -14, 16); barrier(K, 0, 0, false); K.crate(-18, 2); shield(K, 2, 14, false);
      container(K, -20, -6, true); fcrate(K, -2, 20); K.crate(4, 4);
      banner(K, -26, 16, CLOTH_R); banner(K, 14, -6, CLOTH_B);
      // Rocketyard raised service deck (optional high ground over the yard)
      K.platform(-30, 2, 8, 14, 2.0, { stairs: ['e'], color: CONC2, stairColor: CONC });
      K.box(-34.1, 2, 0.25, 1.0, 14, K.C.metal, { y: 2.0, collide: false });
      K.light(-30, 6, 2, 0xffd27a, 6, 22);
      K.light(30, 14, -2.5, 0xff7a4a, 7, 28);
      K.light(-8, 6, 8, 0xffd27a, 5, 24);

      // ---- the Array: Rasputin's dish field on an open plateau ----
      K.box(5, -76, 110, 0.05, 72, 0xa39d92, { collide: false });
      K.mesh(new THREE.CylinderGeometry(22, 22, 0.06, 24), 0x8b857a, 5, 0.08, -68);
      K.mesh(new THREE.CylinderGeometry(20.5, 20.5, 0.07, 24), 0xa39d92, 5, 0.09, -68);
      K.box(5, -104, 16, 6, 12, CONC);
      K.box(5, -104, 16.1, 0.6, 12.1, 0x9fe0ff, { y: 3.6, glow: 1.0, collide: false });
      dish(K, 5, -102, 16, 11, 0.55, Math.PI, false);
      dish(K, -24, -52, 7, 5, 0.6, 2.5); dish(K, 32, -52, 7, 5, 0.6, -2.5);
      dish(K, -22, -100, 8, 6, 0.55, 2.8); dish(K, 30, -100, 8, 6, 0.55, -2.8);
      // walled Array compound with one gate (the old low wall is now the south face)
      K.wall(-55, -40, 55, -40, 9, { t: 1.2, color: CONC, gaps: [[56, 64]] });
      K.wall(-36, -110.5, 42, -110.5, 9, { t: 1.2, color: CONC });
      K.wall(-36, -110, -36, -40, 9, { t: 1.2, color: CONC });
      K.wall(42, -110, 42, -40, 9, { t: 1.2, color: CONC });
      K.door(5, -40, 8, 9, 'x', { zone: 1, t: 1.2, color: 0x4f555c, trim: 0x9fe0ff });
      for (const s of [-1, 1]) { K.box(5 + s * 5.2, -40, 2.2, 11, 2.2, CONC2); K.box(5 + s * 5.2, -38.8, 0.5, 0.5, 0.2, 0x9fe0ff, { y: 7, collide: false, glow: 2 }); }
      for (const [x, z] of [[-34.6, -41.6], [40.6, -41.6], [-34.6, -108.6], [40.6, -108.6]]) flood(K, x, z, 12, 0x9fe0ff, 6);
      // raised decks along the walls: firing positions over the dish floor (stairs only)
      K.platform(-30, -82, 8, 20, 2.0, { stairs: ['e'], color: CONC2, stairColor: CONC });
      K.platform(36, -80, 8, 20, 2.0, { stairs: ['w'], color: CONC2, stairColor: CONC });
      K.box(-34.1, -82, 0.25, 1.0, 20, K.C.metal, { y: 2.0, collide: false });
      K.box(40.1, -80, 0.25, 1.0, 20, K.C.metal, { y: 2.0, collide: false });
      K.light(-30, 6, -82, 0x9fe0ff, 6, 22);
      K.light(36, 6, -80, 0x9fe0ff, 6, 22);
      K.light(5, 8, -44, 0x9fe0ff, 6, 24);
      bunker(K, -44, -70, 12, 16, 6, 0x9fe0ff); bunker(K, 48, -72, 10, 14, 5, 0x9fe0ff);
      mast(K, -20, -104, 18); mast(K, 30, -104, 22); mast(K, -48, -46, 14); mast(K, 50, -44, 16);
      K.box(-12, -98, 30, 0.08, 1, DARK, { collide: false }); K.box(24, -98, 30, 0.08, 1, DARK, { collide: false });
      for (let k = 0; k < 6; k++) {
        const a = 0.5 + k * Math.PI / 3, x = 5 + Math.sin(a) * 14, z = -68 + Math.cos(a) * 14;
        if (k % 2) barrier(K, x, z, Math.abs(Math.cos(a)) > 0.5);
        else { K.box(x, z, 2.4, 1.3, 1.2, C.metal); K.box(x, z, 2.0, 0.6, 1.25, 0x9fe0ff, { y: 0.6, glow: 1.1, collide: false }); }
      }
      K.light(5, 7, -96, 0x9fe0ff, 10, 32);
      K.light(-12, 5, -60, 0x9fe0ff, 5, 20);
    },
  },

  // The Devils' Lair: airliner yards -> ruined complex -> roofed Fallen halls -> the Kell's chamber.
  e3: {
    spawn: [-50, 174],
    bounds: [-80, 60, -116, 186],
    zones: [
      { name: 'The Mothyards', x: -40, z: 112 },
      { name: 'Lunar Complex', x: 0, z: 52 },
      { name: "Devils' Halls", x: 10, z: -12 },
      { name: 'The Lair', x: 10, z: -83, boss: true, room: { minX: -21, maxX: 41, minZ: -113, maxZ: -53 } },
    ],
    build(K) {
      const C = K.C;

      // ---- Mothyards: hangar shells and airliner hulks ----
      hangar(K, -50, 172, 11, 28);
      hangar(K, -8, 166, 10, 24, true, 0x7d8388);
      hangar(K, 30, 112, 13, 30, false);
      K.crate(-58, 165); K.crate(-57, 163.5); K.crate(-42, 181);
      fuselage(K, -66, 104, 26);
      fuselage(K, -66, 140, 24, { wing: 1 });
      fuselage(K, -16, 124, 24, { wing: -1 });
      fuselage(K, -14, 92, 20, { nose: false });
      fuselage(K, 18, 150, 28, { wing: 2 });
      fuselage(K, -34, 150, 16, { nose: false });
      container(K, -50, 128, true); K.crate(-32, 104); shield(K, -36, 122, true); fcrate(K, -50, 104);
      fcrate(K, -33, 119); banner(K, -46, 100, CLOTH_B);
      K.box(-28, 116, 2.2, 1.2, 5, YELLOW);
      K.mesh(new THREE.BoxGeometry(1.8, 0.4, 6), C.metal, -28, 2.6, 113.5, { rx: 0.45 });
      K.mesh(cyl10(), 0x8f8a80, -44, 1.3, 126, { rz: Math.PI / 2, scale: [1.3, 3.5, 1.3], collide: true });
      const wing = K.mesh(new THREE.BoxGeometry(14, 0.5, 4.5), HULLW, -54, 0.9, 118, { rz: 0.12 });
      K.collider(-61, 0, 115.8, -47, 1.8, 120.2, wing);
      K.scatter((x, z) => pine(K, x, z), -66, 72, 0, 8, 4, 1.5);
      K.scatter((x, z) => pine(K, x, z), 46, 88, 0, 7, 3, 1.5);
      for (const [x, z] of [[-30, 76], [-2, 84], [-46, 80], [12, 80]]) K.prop(x, z);

      // ---- Lunar Complex: facade with a blown breach, ruined factory halls ----
      K.wall(-100, 24, 80, 24, 18, { t: 4, color: CONC2, gaps: [[103, 117]] });
      K.box(10, 24, 14, 6, 4, CONC2, { y: 12 });
      for (let x = -96; x <= 76; x += 12) if (Math.abs(x - 10) > 9) K.box(x, 26.6, 2, 18, 1.2, CONC);
      K.box(-10, 26.3, 180, 1.2, 0.8, CONC, { y: 13, collide: false });
      K.box(-48.5, 26.15, 103, 2, 0.4, DARK, { y: 8, collide: false });
      K.box(48.5, 26.15, 63, 2, 0.4, DARK, { y: 8, collide: false });
      K.box(-40, 10, 30, 7, 20, CONC2, { y: 18, collide: false });
      K.box(40, 6, 22, 5, 16, CONC2, { y: 18, collide: false });
      K.rock(2, 30, 2.2); K.rock(18, 31, 1.8); K.rock(0.5, 19, 1.5); K.rock(19.5, 18, 1.6);
      K.mesh(new THREE.BoxGeometry(4, 2, 3), CONC2, 21, 1, 29, { ry: 0.4, rz: 0.2, collide: 0.7 });
      // west factory
      ruinWall(K, -44, 70, -22, 70, 4, 10, [[9, 15]]);
      ruinWall(K, -44, 32, -22, 32, 3, 8, [[3, 9]]);
      ruinWall(K, -44, 32, -44, 70, 6, 11);
      ruinWall(K, -22, 32, -22, 70, 3, 8, [[9, 15], [24, 30]]);
      for (const z of [40, 50, 60]) {
        K.box(-33, z, 22, 0.7, 0.7, RUST, { y: 9.5, collide: false });
        for (const x of [-43.2, -22.8]) K.box(x, z, 0.7, 9.5, 0.7, RUST);
      }
      K.cyl(-33, 51, 3, 9, RUST, { r2: 2.2 }); K.cone(-33, 51, 2.2, 3, C.metal, { y: 9, collide: false });
      // east factory with a conveyor bridge to the facade
      ruinWall(K, 22, 74, 46, 74, 4, 9, [[6, 12]]);
      ruinWall(K, 22, 34, 46, 34, 3, 7);
      ruinWall(K, 46, 34, 46, 74, 6, 10);
      ruinWall(K, 22, 34, 22, 74, 3, 7, [[6, 12], [24, 33]]);
      K.box(34, 49, 3, 1.6, 50, CONC2, { y: 10, collide: false });
      for (const z of [64, 49, 34.8]) K.box(34, z, 1.2, 10, 1.2, CONC2);
      sphereTank(K, 38, 58, 3.5);
      // smokestacks
      K.cyl(-58, 40, 3.2, 46, CONC, { r2: 2.4, sides: 10 });
      K.cyl(-58, 40, 2.62, 3, 0xb04030, { y: 38, r2: 2.56, sides: 10, collide: false });
      K.cyl(-58, 40, 2.75, 2, WHITE, { y: 32, r2: 2.72, sides: 10, collide: false });
      K.cyl(52, 44, 3, 38, CONC, { r2: 2.2, sides: 10 });
      K.cyl(52, 44, 2.44, 3, 0xb04030, { y: 31, r2: 2.38, sides: 10, collide: false });
      // approach cover
      shield(K, -6, 42, true); shield(K, 8, 62, true); fcrate(K, 12, 46); fcrate(K, -10, 58);
      K.crate(-14, 48); K.rock(-12, 38, 1.4); K.rock(-4, 66, 1.6); container(K, -14, 64, false); fcrate(K, 15, 56);
      banner(K, -1, 29, CLOTH_R); banner(K, 20, 29, CLOTH_R); banner(K, -16, 44, CLOTH_B);
      // the breach is sealed until the complex is cleared
      K.door(10, 24, 14, 12, 'x', { zone: 1, t: 3.5, color: FALLEN, trim: F_RED });
      for (const s of [-1, 1]) K.box(10 + s * 8, 26.4, 0.4, 11, 0.4, F_RED, { collide: false, glow: 1.5 });
      // west factory mezzanine (optional high ground)
      K.platform(-38, 39, 8, 10, 2.0, { stairs: ['e'], color: CONC2, stairColor: CONC });
      K.box(-42.1, 39, 0.25, 1.0, 10, K.C.metal, { y: 2.0, collide: false });
      K.light(10, 5, 30, F_RED, 7, 20);
      K.light(-33, 9, 51, F_RED, 6, 22);
      K.light(34, 9, 54, F_BLUE, 6, 22);
      K.light(-8, 6, 56, 0xffb070, 5, 20);
      K.light(-50, 6, 108, F_BLUE, 5, 22);
      K.light(18, 6, 140, F_BLUE, 5, 22);

      // ---- Devils' Halls: roofed pillared hall behind the breach ----
      K.box(-11, -7.5, 6, 12, 61, CONC2);
      K.box(31, -7.5, 6, 12, 61, CONC2);
      K.box(10, -7.5, 44, 0.8, 62, ROOF, { y: 10 });
      K.wall(-8, -38, 28, -38, 10, { t: 1.5, color: CONC2, gaps: [[12, 24]] });
      let k = 0;
      for (const x of [0, 20]) for (const z of [14, 2, -10, -22, -32]) {
        K.box(x, z, 1.6, 10, 1.6, CONC);
        K.box(x, z, 1.7, 0.3, 1.7, k++ % 2 ? F_RED : F_BLUE, { y: 3, glow: 1.4, collide: false });
      }
      for (const x of [-7.9, 27.9]) K.box(x, -7.5, 0.2, 0.25, 60, F_BLUE, { y: 7, glow: 1.5, collide: false });
      K.platform(-4.5, -16, 6, 12, 2.4, { stairs: ['n'], color: FALLEN });
      K.platform(24.5, -4, 6, 12, 2.4, { stairs: ['s'], color: FALLEN });
      shield(K, 4, -4, true); shield(K, 16, -20, true); fcrate(K, 6, -24); fcrate(K, 14, 2);
      container(K, 10, 19, false, 0, FALLEN); K.crate(17, -30); fcrate(K, 2, -30);
      for (const z of [12, -4, -20, -32]) {
        cloth(K, -7.5, z, 2.5, 2.4, 6, false, z % 8 ? CLOTH_B : CLOTH_R);
        cloth(K, 27.5, z, 2.5, 2.4, 6, false, z % 8 ? CLOTH_R : CLOTH_B, F_RED);
      }
      for (const [x, z] of [[25, 16], [-4, 18], [25, -34]]) {
        K.cyl(x, z, 0.9, 2.6, FALLEN, { sides: 8 });
        K.cyl(x, z, 0.95, 0.4, F_BLUE, { y: 1.6, sides: 8, glow: 1.6, collide: false });
      }
      K.light(10, 8, 8, F_BLUE, 10, 28);
      for (const x of [0, 20]) for (const z of [14, -10, -32]) K.light(x, 6, z, x ? F_RED : F_BLUE, 5, 16);
      K.light(-4.5, 5, -16, F_BLUE, 5, 14);
      K.light(24.5, 5, -4, F_RED, 5, 14);
      K.light(10, 8, -28, F_RED, 9, 24);
      // short roofed corridor to the lair
      K.box(3.25, -45, 1.5, 9, 14, CONC2);
      K.box(16.75, -45, 1.5, 9, 14, CONC2);
      K.box(10, -45, 15, 0.6, 14, ROOF, { y: 9 });
      for (const x of [4.4, 15.6]) K.box(x, -45, 0.15, 0.1, 13, F_BLUE, { glow: 1.5, collide: false });

      // ---- The Lair: roofed chamber, pillar ring, central dais, side balconies, Kell's throne ----
      K.room(10, -83, 64, 62, 15, { t: 1.5, color: CONC2, doors: { s: 12 }, roof: true, roofColor: ROOF });
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + Math.PI / 8, px = 10 + Math.sin(a) * 17, pz = -83 + Math.cos(a) * 17;
        K.box(px, pz, 3, 15, 3, CONC);
        K.box(px, pz, 4.2, 1.2, 4.2, CONC2);
        K.box(px, pz, 3.15, 0.6, 3.15, i % 2 ? F_RED : F_BLUE, { y: 7, glow: 1.6, collide: false });
      }
      // dais: low plates only (no collider) so the boss keeps its open floor
      K.mesh(new THREE.CylinderGeometry(8.6, 8.6, 0.1, 8), F_BLUE, 10, 0.05, -83, { glow: 1.2 });
      K.mesh(new THREE.CylinderGeometry(8, 8.3, 0.2, 8), 0x3a3f4a, 10, 0.1, -83);
      K.mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.24, 6), F_RED, 10, 0.1, -83, { glow: 0.9 });
      K.mesh(new THREE.CylinderGeometry(3, 1.5, 2.5, 8), FALLEN, 10, 12.8, -83);
      K.mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.8, 8), F_BLUE, 10, 11.2, -83, { glow: 2 });
      K.box(10, -83, 0.4, 1.2, 0.4, C.metal, { y: 13.8, collide: false });
      // balconies reached by stairs from the entrance end
      for (const [bx, rx, cl] of [[-18, -14.85, CLOTH_B], [38, 34.85, CLOTH_R]]) {
        K.platform(bx, -84, 6, 44, 6, { stairs: ['s'], stairW: 3, color: CONC2, stairColor: CONC });
        K.box(rx, -84, 0.3, 1.1, 44, C.metal, { y: 6 });
        K.box(rx + (rx < 10 ? -0.05 : 0.05), -84, 0.2, 0.2, 44, F_BLUE, { y: 5.6, glow: 1.4, collide: false });
        for (const z of [-70, -84, -98]) cloth(K, bx < 10 ? -21.1 : 41.1, z, 7.5, 2.6, 6, false, cl);
      }
      // the Kell's throne
      K.platform(10, -108, 16, 8, 1.6, { stairs: ['s'], stairW: 6, color: FALLEN });
      K.box(10, -110, 3.2, 1.2, 2.2, FALLEN, { y: 1.6 });
      K.box(10, -111.3, 3.6, 6, 0.8, FALLEN, { y: 1.6 });
      K.box(10, -110.85, 1.2, 1.2, 0.3, F_RED, { y: 6.2, glow: 1.8, collide: false });
      for (const x of [4, 16]) {
        K.cyl(x, -106, 0.6, 1.4, C.metal, { y: 1.6 });
        K.cyl(x, -106, 0.7, 0.4, F_BLUE, { y: 3.0, glow: 2, collide: false });
      }
      cloth(K, 2, -113.2, 4, 3.5, 9, true, CLOTH_R); cloth(K, 18, -113.2, 4, 3.5, 9, true, CLOTH_R);
      cloth(K, 10, -113.2, 8, 5, 6, true, CLOTH_B, F_RED);
      cloth(K, -6, -52.9, 4, 3, 8, true, CLOTH_R); cloth(K, 26, -52.9, 4, 3, 8, true, CLOTH_R);
      shield(K, 10, -69, true); shield(K, -1, -90, false); shield(K, 21, -90, false);
      fcrate(K, 0, -74); fcrate(K, 20, -76); fcrate(K, -12, -58); fcrate(K, 32, -58);
      // the Kell's chamber stays sealed until the halls are cleared
      K.door(10, -52, 12, 12, 'x', { zone: 2, t: 1.5, color: FALLEN, trim: F_RED });
      K.box(10, -52, 12.6, 3, 1.5, CONC2, { y: 12 });
      for (const [x, z] of [[-14, -62], [34, -62], [-14, -104], [34, -104]]) K.light(x, 8, z, x < 10 ? F_BLUE : F_RED, 6, 22);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; K.light(10 + Math.sin(a) * 17, 8.5, -83 + Math.cos(a) * 17, i % 2 ? F_RED : F_BLUE, 3, 14); }
      K.light(10, 11, -83, F_BLUE, 12, 40);
      K.light(10, 5, -106, F_RED, 10, 24);
      K.light(10, 6, -58, 0xa0b4ff, 7, 20);
    },
  },
};
