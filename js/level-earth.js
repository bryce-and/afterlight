// Hand-built Earth (Cosmodrome) mission maps (see makeKit in world.js).
// e1: wide open Steppes: broken highway car graveyard -> Skywatch radar field -> the Wall's hangar doors.
// e2: the Divide (narrow concrete canyon of pipes) -> Rocketyard (gantries, standing rocket) -> Rasputin's Array plateau.
// e3: Mothyards (airliner hulks, hangar shells) -> Lunar Complex ruins -> roofed Fallen halls -> the Devils' Lair chamber.
import * as THREE from 'three';

export const ROAD = 0x3b3835, PAINT = 0xd8cfae, CONC = 0x9d978c, CONC2 = 0x7c776e, RUST = 0x8e4a2a;
export const WHITE = 0xd9d5cb, DARK = 0x25272b, YELLOW = 0xc9a23a, GANTRY = 0x9a3a28, HULLW = 0xbdb6a8;
export const F_BLUE = 0x6fd0ff, F_RED = 0xff5a3c, CLOTH_B = 0x2c4a73, CLOTH_R = 0x7e2626, FALLEN = 0x343f52, ROOF = 0x3a3c42;

// shared unit geometries, created lazily (THREE is only needed once build() runs)
const GEO = {};
const geo = (k, make) => GEO[k] || (GEO[k] = make());
const cyl10 = () => geo('cyl10', () => new THREE.CylinderGeometry(1, 1, 1, 10));
const cyl8 = () => geo('cyl8', () => new THREE.CylinderGeometry(1, 1, 1, 8));
const hemi = () => geo('hemi', () => new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2));

// double-sided meshes (dish bowls, hangar shells) added straight to the scene
const dsMats = new Map();
export function dsMesh(K, g, color, x, y, z, rx = 0, ry = 0, rz = 0, order = 'XYZ') {
  let m = dsMats.get(color);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }); dsMats.set(color, m); }
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.set(rx, ry, rz, order);
  mesh.position.set(x, y + K.ground(x, z), z); // y is measured from the ground under (x, z), like every kit call
  mesh.castShadow = true; mesh.receiveShadow = true;
  K.scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------- props

export function car(K, x, z, alongZ = true, color) {
  const c = color ?? K.RP([K.C.accent, RUST, 0x6b5a4a, 0x56656a, 0x7a7458, 0x5b4f45]);
  const w = alongZ ? 1.9 : 4.2, d = alongZ ? 4.2 : 1.9;
  const body = K.box(x, z, w, 0.95, d, c, { y: 0.3, collide: false });
  K.box(x + (alongZ ? 0 : 0.3), z + (alongZ ? 0.3 : 0), alongZ ? 1.7 : 2.1, 0.75, alongZ ? 2.1 : 1.7, c, { y: 1.25, collide: false });
  for (const s of [-1, 1]) K.box(x + (alongZ ? 0 : s * 1.3), z + (alongZ ? s * 1.3 : 0), alongZ ? 2.0 : 0.6, 0.45, alongZ ? 0.6 : 2.0, DARK, { collide: false });
  K.collider(x - w / 2, 0, z - d / 2, x + w / 2, 2.0, z + d / 2, body);
}

export function pine(K, x, z, h = K.R(5, 8.5)) {
  K.mesh(geo('trunk', () => new THREE.CylinderGeometry(0.6, 1, 1, 5)), 0x4a3a2a, x, h * 0.25, z, { scale: [0.3, h * 0.5, 0.3] });
  for (let k = 0; k < 3; k++) {
    const r = (2.0 - k * 0.55) * (h / 7);
    K.mesh(geo('cone6', () => new THREE.ConeGeometry(1, 1, 6)), k === 1 ? 0x35502f : K.C.foliage, x, h * (0.42 + k * 0.18), z, { scale: [r, h * 0.4, r], ry: k });
  }
  K.collider(x - 0.4, 0, z - 0.4, x + 0.4, h, z + 0.4, null);
}

// steel power pylon (line runs along z, arms along x)
export function pylon(K, x, z, h = 24) {
  const M = 0x5c6168;
  K.mesh(geo('pyl', () => new THREE.CylinderGeometry(0.3, 1, 1, 4)), M, x, h / 2, z, { scale: [2.8, h, 2.8], ry: Math.PI / 4 });
  K.box(x, z, 13, 0.5, 0.6, M, { y: h * 0.84, collide: false });
  K.box(x, z, 9, 0.5, 0.6, M, { y: h * 0.68, collide: false });
  K.box(x, z, 0.35, 3.5, 0.35, M, { y: h, collide: false });
  K.collider(x - 1.6, 0, z - 1.6, x + 1.6, h, z + 1.6, null);
}
export function wires(K, x, z1, z2, h = 24) {
  const L = Math.abs(z2 - z1), zc = (z1 + z2) / 2;
  for (const [dx, yy] of [[-6, h * 0.84], [6, h * 0.84], [-4, h * 0.68], [4, h * 0.68]]) K.box(x + dx, zc, 0.07, 0.07, L, DARK, { y: yy - 1.4, collide: false });
}

export function container(K, x, z, alongZ = false, y = 0, color) {
  const c = color ?? K.RP([0x7a4a32, 0x4f6a5a, 0x5a6478, 0x8a7a4a, 0x9a5a3a]);
  const w = alongZ ? 2.5 : 6.1, d = alongZ ? 6.1 : 2.5;
  K.box(x, z, w, 2.6, d, c, { y });
  K.box(x, z, w + 0.1, 0.16, d + 0.1, DARK, { y: y + 2.45, collide: false });
}

export const barrier = (K, x, z, alongX = true) => K.box(x, z, alongX ? 3.2 : 0.8, 1.1, alongX ? 0.8 : 3.2, CONC);

export function banner(K, x, z, color = CLOTH_B, h = 5.5) {
  K.box(x, z, 0.25, h, 0.25, 0x4a4f58);
  K.box(x + 0.5, z, 1.8, 0.16, 0.16, 0x4a4f58, { y: h - 0.4, collide: false });
  K.box(x + 0.9, z, 1.2, 2.6, 0.06, color, { y: h - 3.0, collide: false });
  K.box(x + 0.9, z, 0.32, 0.32, 0.1, F_BLUE, { y: h - 1.6, collide: false, glow: 1.8 });
}

// Fallen energy shield barricade and supply crate
export function shield(K, x, z, alongX = true) {
  K.box(x, z, alongX ? 3.4 : 0.5, 1.4, alongX ? 0.5 : 3.4, FALLEN);
  K.box(x, z, alongX ? 3.4 : 0.56, 0.14, alongX ? 0.56 : 3.4, F_BLUE, { y: 1.4, collide: false, glow: 1.6 });
}
export function fcrate(K, x, z, s = 1.5) {
  K.box(x, z, s, s, s, FALLEN);
  K.box(x, z, s + 0.06, 0.12, s + 0.06, K.chance(0.5) ? F_BLUE : F_RED, { y: s * 0.55, collide: false, glow: 1.5 });
}

// hanging cloth banner with a glowing emblem (alongX = cloth plane runs along x)
export function cloth(K, x, z, y, w, h, alongX, color, emblem = F_BLUE) {
  K.box(x, z, alongX ? w : 0.08, h, alongX ? 0.08 : w, color, { y, collide: false });
  K.box(x, z, alongX ? w * 0.3 : 0.14, w * 0.3, alongX ? 0.14 : w * 0.3, emblem, { y: y + h * 0.62, collide: false, glow: 1.6 });
}

// radar dish: pedestal, bowl tilted by `tilt` and turned by `yaw`, feed horn on a pole; `up` lifts the whole dish onto a deck
export function dish(K, x, z, r, standH, tilt = 0.5, yaw = 0, pad = true, up = 0) {
  if (pad) K.box(x, z, r * 1.7, 0.25, r * 1.7, CONC2, { collide: false, y: up });
  K.cyl(x, z, Math.max(0.6, r * 0.13), standH, K.C.metal, { sides: 8, y: up });
  K.box(x, z, r * 0.4, r * 0.25, r * 0.4, CONC, { y: up + standH - r * 0.2, collide: false });
  const R = r * 1.25, g = new THREE.SphereGeometry(R, 16, 4, 0, Math.PI * 2, 0, 0.75);
  g.translate(0, -R, 0);
  dsMesh(K, g, WHITE, x, up + standH, z, Math.PI - tilt, yaw, 0, 'YXZ');
  const L = r * 0.85, pr = 0.08 + r * 0.012;
  const pole = K.mesh(geo('pole', () => new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, 0.5, 0)), K.C.metal, x, up + standH, z, { rx: -tilt, ry: yaw, scale: [pr, L, pr] });
  pole.rotation.order = 'YXZ';
  const dx = -Math.sin(tilt) * Math.sin(yaw), dy = Math.cos(tilt), dz = -Math.sin(tilt) * Math.cos(yaw), hs = r * 0.12 + 0.2;
  K.box(x + dx * L, z + dz * L, hs, hs, hs, DARK, { y: up + standH + dy * L - hs / 2, collide: false });
}

// crashed Fallen skiff, nose buried toward -x
export function skiff(K, x, z) {
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
export function fuselage(K, x, z, L, o = {}) {
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
  K.box(x, z + K.R(-L / 3, L / 3), r * 2.3, 1.4, 2.4, RUST, { y: y - 0.2, collide: false });
}

// airliner fuselage hulk lying along x, nose toward -x
export function fuselageX(K, x, z, L, o = {}) {
  const r = 2.4, col = o.color ?? HULLW, y = r + 0.15;
  K.mesh(cyl10(), col, x, y, z, { rz: Math.PI / 2, scale: [r, L, r], collide: true });
  if (o.nose !== false) K.mesh(hemi(), col, x - L / 2, y, z, { rz: Math.PI / 2, scale: [r, r * 1.6, r] });
  for (const s of [-1, 1]) K.box(x, z + s * (r - 0.05), L * 0.85, 0.5, 0.2, 0x3d5a80, { y: y + 0.5, collide: false });
  if (o.tail !== false) {
    K.box(x + L / 2 - 2.2, z, 4, 5, 0.4, col, { y: y + r - 0.4, collide: false });
    K.box(x + L / 2 - 1.8, z, 2.6, 0.35, 9, col, { y: y + 0.6, collide: false });
  }
  if (o.wing) {
    for (const s of o.wing === 2 ? [-1, 1] : [o.wing]) {
      K.box(x + 1, z + s * (r + 6), 5, 0.45, 12, col, { y: 2.0 });
      K.mesh(cyl10(), 0x8f8a80, x - 0.5, 1.2, z + s * (r + 4.5), { rz: Math.PI / 2, scale: [1.0, 3.6, 1.0], collide: true });
    }
  }
  K.box(x + K.R(-L / 3, L / 3), z, 2.4, 1.4, r * 2.3, RUST, { y: y - 0.2, collide: false });
}

// Quonset hangar shell along z (open both ends); full = clad, else bare ribs with a scrap of cladding
export function hangar(K, x, z, r, L, full = true, color = 0x858a8e) {
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

export function rocket(K, x, z) {
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
export function gantry(K, x, z, w, h, armDir, armLen) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(x + sx * w / 2, z + sz * w / 2, 0.7, h, 0.7, GANTRY, { collide: false });
  for (let y = 5; y < h; y += 5) K.box(x, z, w + 0.95, 0.35, w + 0.95, K.C.metal, { y, collide: false });
  K.box(x, z, w * 0.45, h, w * 0.45, K.C.metal);
  const [dx, dz] = armDir;
  for (const yy of [h * 0.55, h * 0.8]) K.box(x + dx * (w / 2 + armLen / 2), z + dz * (w / 2 + armLen / 2), dx ? armLen : 1.4, 0.9, dz ? armLen : 1.4, GANTRY, { y: yy, collide: false });
  K.box(x, z, w * 0.6, 3, w * 0.6, GANTRY, { y: h, collide: false });
  K.collider(x - w / 2 - 0.4, 0, z - w / 2 - 0.4, x + w / 2 + 0.4, h, z + w / 2 + 0.4, null);
}

export function crane(K, x, z, h, jib, dir = 1) {
  K.box(x, z, 1.8, h, 1.8, YELLOW);
  K.box(x + dir * (jib / 2 - 4), z, jib, 1.3, 1.3, YELLOW, { y: h + 1.5, collide: false });
  K.box(x - dir * 4.5, z, 3.5, 2.2, 2.6, CONC2, { y: h + 0.4, collide: false });
  K.box(x, z, 2.6, 2.4, 2.6, YELLOW, { y: h - 0.9, collide: false });
  K.box(x, z, 0.5, 4, 0.5, YELLOW, { y: h + 2.8, collide: false });
  const hx = x + dir * (jib - 7);
  K.box(hx, z, 0.08, 9, 0.08, DARK, { y: h - 7.5, collide: false });
  K.box(hx, z, 0.9, 1.0, 0.9, DARK, { y: h - 8.5, collide: false });
}

export function sphereTank(K, x, z, r) {
  const legH = r * 0.7;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(x + sx * r * 0.6, z + sz * r * 0.6, 0.5, legH + r * 0.3, 0.5, K.C.metal, { collide: false });
  K.mesh(geo('sph', () => new THREE.SphereGeometry(1, 12, 8)), WHITE, x, legH + r, z, { scale: r, collide: 0.75 });
  K.collider(x - r * 0.7, 0, z - r * 0.7, x + r * 0.7, legH, z + r * 0.7, null);
}

export function hTank(K, x, z, r, L) {
  K.mesh(cyl10(), WHITE, x, r + 0.7, z, { rx: Math.PI / 2, scale: [r, L, r], collide: true });
  for (const s of [-1, 1]) {
    K.mesh(hemi(), WHITE, x, r + 0.7, z + s * L / 2, { rx: s * Math.PI / 2, scale: [r, r * 0.5, r] });
    K.box(x, z + s * L * 0.3, r * 1.6, r * 0.9, 1, CONC2);
  }
  K.box(x, z, r * 2.06, r * 2.06, 0.8, K.C.accent, { y: 0.7, collide: false });
}

export function bunker(K, x, z, w, d, h, glowC) {
  K.box(x, z, w, h, d, CONC);
  K.box(x, z, w + 0.7, 0.5, d + 0.7, CONC2, { y: h, collide: false });
  K.box(x, z, w + 0.06, 0.6, d + 0.06, glowC ?? DARK, { y: h * 0.58, collide: false, glow: glowC ? 1.0 : undefined });
  K.box(x + w * 0.2, z, 1.6, 1.0, 1.6, K.C.metal, { y: h + 0.5, collide: false });
}

export function valve(K, x, z) {
  K.cyl(x, z, 1.2, 2.6, K.C.metal, { sides: 8 });
  K.cyl(x, z, 0.35, 1.2, RUST, { y: 2.6, collide: false });
  K.box(x, z, 1.8, 0.22, 0.22, 0xb03a2a, { y: 3.5, collide: false });
}

export function mast(K, x, z, h, up = 0) {
  K.box(x, z, 0.5, h, 0.5, K.C.metal, { y: up });
  K.box(x, z, 3, 0.2, 0.2, K.C.metal, { y: up + h * 0.75, collide: false });
  K.box(x, z, 0.6, 0.6, 0.6, F_RED, { y: up + h, collide: false, glow: 2 });
}

// compound floodlight: pole, glowing lamp head and a lamp for the light pool
export function flood(K, x, z, h = 9, color = 0xffe3b0, power = 7) {
  K.box(x, z, 0.4, h, 0.4, K.C.metal);
  K.box(x, z, 1.6, 0.5, 0.9, DARK, { y: h, collide: false });
  K.box(x, z, 1.3, 0.2, 0.6, color, { y: h - 0.05, collide: false, glow: 1.8 });
  K.light(x, h - 0.6, z, color, power, 26);
}

// see-through chain-link fence with posts; gaps are [from, to] metres from the min end (sorted)
let FENCE_MAT = null, UNIT = null;
export function fence(K, x1, z1, x2, z2, h = 2.6, gaps = []) {
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
      m.position.set(px, h / 2 + K.ground(px, pz), pz);
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
export function ruinWall(K, x1, z1, x2, z2, hMin, hMax, gaps = [], t = 0.9, color) {
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

// ---------------------------------------------------------------- terrain helpers (U16e)

// stairs whose foot stands at (x, z) and climb toward dir up to the world height `top`
export function stairUp(K, x, z, dir, w, top, color = CONC2) {
  const foot = K.ground(x, z), rise = top - foot;
  if (rise > 0.2) K.stairs(x, z, dir, w, rise, { y: foot, abs: true, color });
}

// stairs that end exactly at the top edge point (ex, ez) on a deck at world height `top`, coming up from the side opposite `dir`
export function stairTo(K, ex, ez, dir, w, top, color = CONC2) {
  const [dx, dz] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[dir], rise = top - K.ground(ex, ez), n = Math.max(1, Math.ceil(rise / 0.4));
  if (rise > 0.2) K.stairs(ex - dx * n * 0.6, ez - dz * n * 0.6, dir, w, rise, { y: K.ground(ex, ez), abs: true, color });
}

// thin painted or paved strip laid on the ground between two points, tilted to follow a ramp
export function strip(K, x0, z0, x1, z1, w, color, lift = 0.07) {
  const ya = K.ground(x0, z0), yb = K.ground(x1, z1), len = Math.hypot(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  const m = K.mesh(new THREE.BoxGeometry(w, 0.1, len), color, mx, (ya + yb) / 2 + lift - K.ground(mx, mz), mz);
  m.rotation.order = 'YXZ';
  m.rotation.set(-Math.atan2(yb - ya, len), Math.atan2(x1 - x0, z1 - z0), 0);
  return m;
}

// a pier from the ground up to the world height `top`
export const pier = (K, x, z, w, d, top, color = CONC2) => K.box(x, z, w, Math.max(0.5, top - K.ground(x, z)), d, color);

// guard rail along x at z, world height y, with gaps [from, to] in world x
export function rail(K, x0, x1, z, y, gaps = [], h = 1.1) {
  let a = Math.min(x0, x1);
  const end = Math.max(x0, x1);
  for (const [g0, g1] of [...gaps, [end, end]]) {
    if (g0 - a > 0.5) K.box((a + g0) / 2, z, g0 - a, h, 0.4, CONC2, { y, abs: true });
    a = Math.max(a, g1);
  }
}

// sandbag arc (yawed bags) around (cx, cz), radius r, from angle a0 to a1
export function sandbags(K, cx, cz, r, a0, a1) {
  const n = Math.max(2, Math.round(Math.abs(a1 - a0) * r / 1.9));
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i + 0.5) / n, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
    K.obox(x, z, 2.1, 1.0, 0.9, a + Math.PI / 2, i % 2 ? 0x8a7a58 : 0x9a8a68, { y: 0 });
    if (i % 3 === 1) K.obox(x, z, 1.9, 0.7, 0.8, a + Math.PI / 2, 0x8a7a58, { y: 1.0 });
  }
}

// a jumble of cars, none overlapping (cars share heights, so overlaps would z-fight)
export function carPile(K, cx, cz, n, spread) {
  const placed = [];
  for (let i = 0; i < n * 6 && placed.length < n; i++) {
    const x = cx + K.R(-spread, spread), z = cz + K.R(-spread * 0.8, spread * 0.8), alongZ = K.chance(0.55);
    const w = alongZ ? 2.1 : 4.4, d = alongZ ? 4.4 : 2.1;
    if (!K.clear(x, z, 2.6) || placed.some((p) => Math.abs(p.x - x) < (p.w + w) / 2 + 0.3 && Math.abs(p.z - z) < (p.d + d) / 2 + 0.3)) continue;
    car(K, x, z, alongZ);
    placed.push({ x, z, w, d });
  }
}

// open steel lattice tower: four tapering legs, braced bays, a beacon on top (unique to Skywatch)
export function latticeTower(K, x, z, h, w0 = 7) {
  const M = 0x6c727a, bays = Math.round(h / 6), bh = h / bays;
  for (let b = 0; b < bays; b++) {
    const wa = w0 * (1 - 0.7 * b / bays), wb = w0 * (1 - 0.7 * (b + 1) / bays), y0 = b * bh;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(x + sx * (wa + wb) / 4, z + sz * (wa + wb) / 4, 0.4, bh, 0.4, M, { y: y0, collide: false });
    for (const s of [-1, 1]) {
      K.box(x, z + s * wb / 2, wb, 0.25, 0.25, M, { y: y0 + bh, collide: false });
      K.box(x + s * wb / 2, z, 0.25, 0.25, wb, M, { y: y0 + bh, collide: false });
      const wm = (wa + wb) / 2, L = Math.hypot(bh, wm), ang = Math.atan2(wm, bh), BG = geo('brace' + bh.toFixed(2) + L.toFixed(2), () => new THREE.BoxGeometry(0.2, L, 0.2));
      K.mesh(BG, M, x, y0 + bh / 2, z + s * wm / 2, { rz: s * ang });
      K.mesh(BG, M, x + s * wm / 2, y0 + bh / 2, z, { rx: -s * ang });
    }
  }
  K.collider(x - w0 * 0.35, 0, z - w0 * 0.35, x + w0 * 0.35, h, z + w0 * 0.35, null);
  K.box(x, z, 2.2, 0.4, 2.2, M, { y: h, collide: false });
  K.box(x, z, 0.5, 0.5, 0.5, F_RED, { y: h + 0.4, collide: false, glow: 2.2 });
  K.box(x, z, 0.12, 4, 0.12, M, { y: h + 0.4, collide: false });
}

// ---------------------------------------------------------------- missions

export default {
  // A Guardian Rises: dawn on the steppe. The broken highway rolls out under an overpass you can climb, a ramp lifts the road onto the
  // Skywatch hill, and a terraced road climbs to the Wall's raised yard.
  e1: {
    spawn: [0, 152],
    bounds: [-75, 85, -124, 165],
    zones: [
      { name: 'The Steppes', x: 0, z: 92 },
      { name: 'Skywatch', x: 46, z: 36 },
      { name: 'The Wall', x: 8, z: -84, boss: true, room: { minX: -26, maxX: 42, minZ: -115, maxZ: -61 } },
    ],
    noEdge: true,
    // Rolling steppe (mounds first so plateaus and ramps win), the overpass abutment and its approach, the Skywatch bluff with its road
    // ramp and the descent, then two terraces up to the Wall's yard (the yard plateau sits under the whole walled compound).
    terrain: [
      { type: 'mound', x: -44, z: 104, r: 28, h: 2.4 },
      { type: 'mound', x: -46, z: 52, r: 24, h: 2.8 },
      { type: 'mound', x: 64, z: 86, r: 20, h: 2.2 },
      { type: 'mound', x: -40, z: 152, r: 22, h: 1.8 },
      { type: 'mound', x: -30, z: -22, r: 26, h: 4.5 },
      { type: 'mound', x: -48, z: -76, r: 24, h: 3.2 },
      { type: 'mound', x: 70, z: -64, r: 22, h: 3 },
      { type: 'plateau', x: 73.5, z: 128, w: 23, d: 24, h: 6.5, edge: 3 },                              // the overpass abutment
      { type: 'ramp', x0: 28, z0: 157, x1: 64, z1: 142, width: 12, h0: 0, h1: 6.5, edge: 6 },          // the on-ramp up to it (0.17)
      { type: 'plateau', x: 50, z: 34, w: 60, d: 48, h: 4.5, edge: 7 },                                // the Skywatch bluff (cliff all round)
      { type: 'ramp', x0: 14, z0: 84, x1: 40, z1: 58, width: 14, h0: 0, h1: 4.5, edge: 6 },            // the service road up to the gate (0.12)
      { type: 'ramp', x0: 34, z0: 10, x1: 34, z1: -16, width: 14, h0: 4.5, h1: 0, edge: 6 },           // down the north side (0.17)
      { type: 'ramp', x0: 10, z0: -18, x1: 10, z1: -32, width: 26, h0: 0, h1: 3, edge: 6 },            // terrace one (0.21)
      { type: 'plateau', x: 10, z: -35, w: 44, d: 6, h: 3, edge: 4 },                                  // landing
      { type: 'ramp', x0: 10, z0: -38, x1: 10, z1: -52, width: 26, h0: 3, h1: 6, edge: 6 },            // terrace two (0.21)
      { type: 'plateau', x: 8, z: -89, w: 84, d: 74, h: 6, edge: 3 },                                  // the Wall's yard
    ],
    sky: {
      // the Traveler hangs pale over the steppe, a long low dawn behind it
      bodies: [{ color: 0xfff0c0, size: 22, pos: [-420, 38, -520], glow: 0xffd8a0 }, { color: 0xeee8d8, size: 64, pos: [330, 215, -400], glow: 0xfff4d8 }],
      haze: [{ color: 0xf8c8a0, opacity: 0.55, r: 480, h: 80, y: -10 }],
      clouds: { n: 14, color: 0xffcfb0, opacity: 0.75, y: [55, 125], size: 22 },
    },
    build(K) {
      const C = K.C;
      const OZ = 128, DT = 6.5; // overpass: z of the deck, world height of its top

      // ---- the broken highway: runs out from the spawn, ends in tilted slabs at the foot of the Skywatch road ----
      K.box(0, 116, 18, 0.05, 98, ROAD, { collide: false });
      for (let z = 162; z > 70; z -= 7) K.box(0, z, 0.3, 0.06, 3, PAINT, { collide: false });
      for (const [x, z, ry] of [[2, 62, 0.15], [5, 52, -0.2], [9, 44, 0.3]]) K.mesh(new THREE.BoxGeometry(12, 0.3, 9), ROAD, x, 0.05, z, { ry, rx: 0.02 });
      for (const s of [-1, 1]) for (let z = 160; z > 70; z -= 12) if (K.chance(0.65) && !(s > 0 && ((z < 100 && z > 70) || z > 144))) K.box(s * 9.7, z - 5, 0.3, 0.8, 9, C.metal);
      // the service road up the Skywatch hill and the road to the Wall are paved strips on the ramps
      strip(K, 14, 84, 40, 58, 11, ROAD); strip(K, 34, 8, 34, -14, 11, ROAD);
      strip(K, 10, -16, 10, -32, 17, ROAD); strip(K, 10, -38, 10, -52, 17, ROAD);
      strip(K, 28, 157, 64, 142, 8, ROAD);
      for (let t = 0.08; t < 0.95; t += 0.14) strip(K, 14 + 26 * t, 84 - 26 * t, 14 + 26 * (t + 0.05), 84 - 26 * (t + 0.05), 0.3, PAINT, 0.1);
      // jammed traffic: never more than two of four lanes blocked in a row (lanes stay clear of the overpass piers)
      const lanes = [-6.3, -2.1, 2.1, 6.3];
      for (let z = 158; z > 74; z -= K.R(6.5, 9)) {
        const skip = Math.floor(K.rng() * 3);
        lanes.forEach((lx, i) => {
          if (i === skip || i === skip + 1 || !K.chance(0.6)) return;
          const x = lx + K.R(-0.4, 0.4), zz = z + K.R(-1.2, 1.2);
          if (K.clear(x, zz, 2.4)) car(K, x, zz, true);
        });
      }
      // wrecks piled against the road edge and in the shadow of the overpass
      carPile(K, -20, 138, 6, 7); carPile(K, 20, 108, 5, 6); carPile(K, -22, 76, 6, 8);

      // ---- the collapsed overpass: the east half is intact and climbable from its abutment, the west half has fallen ----
      const DB = DT - 1.4;
      K.box(25, OZ, 72, 1.4, 8, CONC, { y: DB, abs: true });                           // the intact deck (x -11 to 61)
      K.box(-53.5, OZ, 57, 1.4, 8, CONC, { y: DB, abs: true });                        // the stub of the west span
      rail(K, -11, 61, OZ - 3.8, DT, [[12, 16]]); rail(K, -11, 61, OZ + 3.8, DT);
      rail(K, -82, -25, OZ - 3.8, DT); rail(K, -82, -25, OZ + 3.8, DT);
      for (const px of [16, 36, 54]) pier(K, px, OZ, 2.2, 5, DB);
      for (const px of [-62, -42, -29]) pier(K, px, OZ, 2.2, 5, DB);
      const slab = K.mesh(new THREE.BoxGeometry(16, 1.3, 7.6), CONC, -18, 3.4, OZ, { rz: 0.42 });
      K.collider(-25.5, 0, OZ - 3.8, -11.5, 4.4, OZ + 3.8, slab);
      for (const dz of [-2.5, 0, 2.5]) { K.box(-10.4, OZ + dz, 1.6, 0.1, 0.1, RUST, { y: DT + 0.6, abs: true, collide: false }); K.box(-24.6, OZ + dz, 1.4, 0.1, 0.1, RUST, { y: DT + 0.4, abs: true, collide: false }); }
      stairTo(K, 14, OZ - 4, 's', 3, DT);                                      // way down the north side, off the road
      // the abutment: a rest stop on the high ground with cover and a lamp
      K.box(70, 134, 3.2, 1.1, 0.8, CONC); K.box(70, 122, 3.2, 1.1, 0.8, CONC);
      car(K, 78, 126, false); car(K, 80, 133, true);
      container(K, 82, 119, true, 0, 0x6a5a4a);
      flood(K, 66, 138, 7, 0xffd8a0, 6);
      K.rock(-28, 118, 1.6); K.rock(-21, 136, 1.3); K.rock(-30, 133, 1.0);

      // ---- power lines ----
      const PZ = [150, 95, 40, -15];
      PZ.forEach((pz, i) => { pylon(K, -62, pz); if (i) wires(K, -62, PZ[i - 1], pz); });
      wires(K, -62, 150, 200);
      pylon(K, 74, 80); pylon(K, 74, 20); wires(K, 74, 80, 20);
      // a toppled pylon lying across the grass
      const top = K.mesh(geo('pyl', () => new THREE.CylinderGeometry(0.3, 1, 1, 4)), 0x5c6168, -40, 2.0, 12, { rz: Math.PI / 2 - 0.08, ry: 0, scale: [2.4, 22, 2.4] });
      K.collider(-51, 0, 10.4, -29, 3.4, 13.6, top);

      // ---- pine stands, thin on the open steppe ----
      for (const [cx, cz, n] of [[-34, 150, 5], [-58, 112, 4], [64, 90, 4], [-56, 6, 5], [-30, -60, 5], [66, -36, 4], [-60, -80, 4]]) {
        K.scatter((x, z) => pine(K, x, z), cx, cz, 0, 8, n, 1.5);
      }
      K.edge((x, z, y) => { const h = K.R(5, 8); K.mesh(geo('cone6', () => new THREE.ConeGeometry(1, 1, 6)), C.foliage, x, y + h * 0.45, z, { scale: [h * 0.28, h * 0.9, h * 0.28], collide: false }); }, 46, 8, 70);
      K.edge((x, z, y) => K.mesh(new THREE.DodecahedronGeometry(K.R(2, 5), 0), C.rock, x, y + 1, z, { collide: false }), 24, 6, 50);

      // ---- Skywatch: the radar hill ----
      fence(K, 22, 56, 78, 56, 2.6, [[10, 30]]);
      fence(K, 22, 12, 78, 12, 2.6, [[4, 22]]);
      fence(K, 22, 12, 22, 56, 2.6);
      fence(K, 78, 12, 78, 56, 2.6);
      dish(K, 33, 47, 6, 5, 0.55, 0.8);
      dish(K, 72, 19, 6.5, 5.5, 0.6, -1.0);
      K.box(47, 18, 7, 0.25, 7, CONC2, { collide: false });
      dish(K, 45.5, 16.5, 2.2, 2.4, 0.6, 0.5, false); dish(K, 49, 17, 2.0, 2.2, 0.7, 2.0, false); dish(K, 47, 20.5, 2.2, 2.4, 0.5, 4, false);
      latticeTower(K, 26, 38, 34);                                                     // the Skywatch tower: the silhouette of this zone
      bunker(K, 27, 22, 8, 8, 4); K.stairs(27, 32, 'n', 3, 4.0, { color: CONC2 });     // bunker roof overlook
      bunker(K, 72, 50, 8, 6, 3.6);
      // radar tower: a control deck, and a lookout tier above it with a small dish
      K.platform(66, 32, 16, 14, 4.0, { stairs: ['s'], stairW: 5, color: CONC2, stairColor: CONC });
      K.platform(70, 32, 6, 6, 4.0, { y: 4.0, stairs: ['w'], stairW: 2.4, color: CONC, stairColor: CONC2 });
      K.box(66, 25.4, 16, 1.0, 0.3, K.C.metal, { y: 4.0, collide: false });
      dish(K, 70, 32, 2.4, 1.8, 0.6, -0.6, false, 8.0);
      K.light(66, 11, 32, 0x9fe0ff, 6, 24);
      // a shed at the north gate: a roofed room on the way to the Wall road
      K.room(58, 18, 12, 9, 4.6, { t: 0.8, color: CONC2, doors: { s: 4, n: 4 }, roof: true, roofColor: ROOF });
      K.light(58, 3, 18, 0xffb070, 5, 14);
      // cover hugging the dishes and bunkers, and containers that split the gate into two lanes
      sandbags(K, 33, 47, 8.5, 0.5, 2.3); sandbags(K, 72, 19, 9, 3.6, 5.3);
      container(K, 47, 52, true); container(K, 47, 45.2, true, 0, 0x6a5a4a); container(K, 47, 27, true, 0, 0x4f6a5a); container(K, 56, 46, true);
      barrier(K, 40, 26, false); barrier(K, 38, 29.5, false); K.crate(52, 28); K.crate(53.4, 27);
      barrier(K, 52, 54); K.crate(75, 38); K.crate(76.2, 37);
      banner(K, 30, 54, CLOTH_B); banner(K, 52, 54, CLOTH_B); banner(K, 76, 28, CLOTH_R);
      K.light(33, 6, 40, 0xffd27a, 5, 22);
      K.light(46, 6, 28, 0x9fe0ff, 5, 22);

      // ---- the Wall road: two terraces of old launch road, barriers and wrecks on the landings ----
      for (const s of [-1, 1]) {
        for (const z of [-20, -26, -42, -48]) K.box(10 + s * 14, z, 0.8, 1.1, 3.2, CONC);
        K.box(10 + s * 22, -35, 3.2, 1.1, 0.8, CONC);
      }
      container(K, -4, -35, false, 0, 0x7a4a32); container(K, 30, -35, false, 0, 0x4f6a5a);
      car(K, 20, -40, true); car(K, 0, -30, true);
      K.rock(36, -22, 2.2); K.rock(-14, -44, 2.4); K.rock(26, -48, 1.8);
      flood(K, 22, -34, 8, 0xffd8a0, 6); flood(K, -2, -34, 8, 0xffd8a0, 6);
      banner(K, 4, -51, CLOTH_R); banner(K, 16, -51, CLOTH_B);

      // ---- the Wall: colossal concrete face with the colony-ship hangar doors ----
      const WZ = -118, DX = 8;
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

      // ---- boss yard: raised, walled, one gate behind a roofed vestibule; the crashed skiff on the west, one firing deck on the east ----
      K.wall(-26, -115, -26, -60, 8, { t: 1.4, color: CONC2 });
      K.wall(42, -115, 42, -60, 8, { t: 1.4, color: CONC2 });
      K.wall(-26, -60, 42, -60, 8, { t: 1.4, color: CONC2, gaps: [[30, 38]] });
      K.door(8, -60, 8, 8, 'x', { zone: 1, t: 1.4, color: 0x4f555c, trim: C.accent });
      K.box(8, -60, 11, 1.2, 2, CONC, { y: 8, collide: false });
      for (const s of [-1, 1]) { K.box(8 + s * 5.2, -60, 2.2, 10, 2.2, CONC); K.box(8 + s * 5.2, -58.8, 0.5, 0.5, 0.2, F_RED, { y: 6, collide: false, glow: 2 }); }
      // the gatehouse: a roofed passage in front of the door (the hangar-door tunnel)
      for (const s of [-1, 1]) K.wall(8 + s * 4.6, -60, 8 + s * 4.6, -52, 9, { t: 1.2, color: CONC2 });
      K.box(8, -56, 14, 0.6, 8.6, ROOF, { y: 9, collide: false });
      K.light(8, 6.5, -56, 0xffb070, 6, 16);
      for (const [x, z] of [[-26, -60], [42, -60], [-26, -115], [42, -115]]) flood(K, x + (x < 8 ? 1.4 : -1.4), z + (z < -88 ? 1.4 : -1.4), 11);
      for (const z of [-72, -86, -100]) for (const x of [-25.2, 41.2]) K.box(x, z, 0.2, 0.3, 5, F_BLUE, { y: 5, collide: false, glow: 1.4 });
      skiff(K, -8, -106);
      fcrate(K, -16, -97); fcrate(K, -22, -112); fcrate(K, 28, -74);
      banner(K, -24.5, -71, CLOTH_B); banner(K, 20, -102, CLOTH_R);
      container(K, -1, -69, true); container(K, 17, -69, true, 0, 0x4f6a5a);        // a container pair flanking the gate
      barrier(K, -8, -82); barrier(K, 22, -86, false); shield(K, 8, -92, true); shield(K, -6, -94, false); K.crate(2, -82); K.crate(3.3, -83.5);
      banner(K, -20, -110, CLOTH_R); banner(K, 36, -112, CLOTH_B);
      // the one raised deck: a firing platform along the east wall (the west side is open skiff ground)
      K.platform(37, -90, 8, 18, 2.2, { stairs: ['w'], stairW: 4, color: CONC2, stairColor: CONC });
      K.box(40.6, -90, 0.25, 1.0, 18, K.C.metal, { y: 2.2, collide: false });
      K.light(37, 6.5, -90, F_BLUE, 6, 20);
      K.light(DX, 8, WZ + 3, 0xffb070, 10, 30);
      K.light(8, 7, -66, 0xffb070, 7, 22);
      K.light(8, 6, -104, F_BLUE, 6, 24);
      K.light(-14, 6, -86, F_BLUE, 5, 20);
    },
  },

  // The Last Array: noon. The Divide climbs through a concrete canyon to a lookout lip, the road drops into the Rocketyard bowl, and a
  // ramp rises to Rasputin's raised dish plateau.
  e2: {
    spawn: [0, 134],
    bounds: [-55, 55, -136, 145],
    zones: [
      { name: 'The Divide', x: 0, z: 78 },
      { name: 'Rocketyard', x: 12, z: -2 },
      { name: 'The Array', x: 5, z: -92, boss: true, room: { minX: -36, maxX: 42, minZ: -134, maxZ: -65 } },
    ],
    noEdge: true,
    // The canyon floor climbs 5.2 m from the south mouth to the lookout lip at z=46, the road then drops 5.2 m into the yard; the launch
    // pad is a low mound; the Array's yard stands on a 6 m plateau (cliff edge) with its own ramp.
    terrain: [
      { type: 'ramp', x0: 0, z0: 150, x1: 0, z1: 46, width: 44, h0: 0, h1: 5.2, edge: 20 },     // the Divide climbs (0.05)
      { type: 'ramp', x0: 0, z0: 46, x1: 0, z1: 16, width: 60, h0: 5.2, h1: 0, edge: 14 },      // down into the Rocketyard (0.17)
      { type: 'plateau', x: 30, z: -14, w: 22, d: 22, h: 2.4, edge: 9 },                        // the launch pad
      { type: 'plateau', x: 3, z: -100, w: 86, d: 78, h: 6, edge: 3 },                          // the Array yard
      { type: 'ramp', x0: 5, z0: -38, x1: 5, z1: -62, width: 26, h0: 0, h1: 6, edge: 6 },       // up to the Array (0.25)
    ],
    sky: {
      // a hard blue noon with the sun almost overhead and tall white cloud; the far gantries and radar domes stand on the horizon
      zenith: 0x2a74c6, mid: 0x6fb0e6, horizon: 0xdcecf4,
      bodies: [{ color: 0xffffff, size: 14, pos: [120, 330, -300], glow: 0xfff6d8 }],
      skyline: [
        { kind: 'tower', n: 6, r: [450, 620], h: [50, 110], w: [8, 14], color: 0x7a8aa0, haze: 0.5 },
        { kind: 'dome', n: 5, r: [470, 600], h: [18, 40], w: [26, 44], color: 0x8a98a8, haze: 0.45 },
      ],
      clouds: { n: 20, color: 0xffffff, opacity: 0.92, y: [110, 220], size: 26 },
    },
    build(K) {
      const C = K.C;

      // ---- the Divide: towering concrete walls lined with bundled pipes, a ledge walk along the east wall ----
      for (const [za, zb, hw] of [[152, 118, 10], [118, 100, 7.5], [100, 58, 17], [58, 36, 8]]) {
        const n = Math.max(1, Math.round((za - zb) / 9)), step = (za - zb) / n;
        for (let i = 0; i < n; i++) {
          const zc = za - (i + 0.5) * step;
          for (const s of [-1, 1]) {
            const w = hw + (i % 3) * 0.45, h = K.R(19, 27);
            K.box(s * (w + 64) / 2, zc, 64 - w, h, step, K.chance(0.5) ? CONC : CONC2);
            // three pipes bundled at different heights; every fourth slab has a breach with a snapped pipe
            if (i % 4 === 2) {
              K.box(s * (w - 0.15), zc, 0.3, 5, step * 0.5, DARK, { y: 3, collide: false });
              K.mesh(cyl8(), RUST, s * (w - 1.2), 2.2, zc, { rz: s * 0.5, scale: [0.6, 3.4, 0.6] });
            } else {
              K.mesh(cyl8(), C.metal, s * (w - 0.6), 3.5, zc, { rx: Math.PI / 2, scale: [0.6, step, 0.6], collide: s < 0 });
              K.mesh(cyl8(), RUST, s * (w - 0.6), 6.4, zc, { rx: Math.PI / 2, scale: [0.9, step, 0.9] });
              K.mesh(cyl8(), C.metal, s * (w - 0.5), 9.0, zc, { rx: Math.PI / 2, scale: [0.4, step, 0.4], collide: false });
            }
            if (i % 3 === 0) K.box(s * (w - 0.2), zc, 0.4, 0.6, 1.4, 0xffd27a, { y: 11.5, glow: 1.4, collide: false });
          }
        }
      }
      for (const [z, hw] of [[140, 10], [112, 7.5], [104, 7.5], [70, 17], [46, 8]]) K.mesh(cyl8(), C.metal, 0, 14, z, { rz: Math.PI / 2, scale: [0.8, 2 * hw + 6, 0.8] });
      K.box(0, 88, 36, 0.4, 2.6, C.metal, { y: 11, collide: false });
      for (const s of [-1, 1]) K.box(0, 88 + s * 1.2, 36, 1.0, 0.1, C.metal, { y: 11.4, collide: false });
      K.box(0, 37, 22, 4, 3, CONC2, { y: 17, collide: false });
      // the ledge walk: a concrete shelf bolted to the east wall, climbed by two side stairs, with a view down the whole canyon
      const LT = K.ground(0, 80) + 3.6;
      K.box(14.6, 80, 4.8, 3.6, 32, CONC2); // the shelf; it skirts down to the floor, which climbs under it
      stairTo(K, 12.2, 96, 'e', 4, LT, CONC); stairTo(K, 12.2, 64, 'e', 4, LT, CONC);
      K.box(12.3, 80, 0.2, 1.0, 32, C.metal, { y: 3.6, collide: false });
      K.light(14.6, 6.5, 80, 0xffd27a, 5, 20);
      // junction (zone 0): two clusters make a left lane and a right lane with a gap between
      container(K, -10, 90, true); valve(K, -13, 82); barrier(K, -7, 84, false); shield(K, -4, 88, true); fcrate(K, -9, 83);
      container(K, 10, 85, true, 0, 0x4f6a5a); valve(K, 13, 79); barrier(K, 6, 73, false); shield(K, 4, 80, true); K.crate(9, 74);
      cloth(K, -16.8, 84, 3, 2.4, 6, false, CLOTH_R); cloth(K, 16.8, 100, 3, 2.4, 6, false, CLOTH_B);
      // choke barricade and abandoned cars in the narrows
      shield(K, -3.5, 106, true); shield(K, 5.5, 108, true);
      car(K, 4, 125, true); car(K, 3.5, 113, true); K.crate(-3, 120);
      K.light(0, 10, 80, 0xffd27a, 8, 30);
      K.light(0, 10, 126, 0xffd27a, 5, 24);

      // ---- Rocketyard: a flat bowl with a launch pad, gantries, tanks and a launch bunker ----
      K.box(0, -13, 110, 0.04, 54, 0x8f8a80, { collide: false });
      K.box(30, -14, 22, 0.2, 22, 0x5a5650, { collide: false });
      K.box(30, -14, 6, 0.22, 30, DARK, { collide: false });
      rocket(K, 30, -14);
      gantry(K, 30, -2.5, 6, 40, [0, -1], 4.5);
      gantry(K, 21, -14, 4, 28, [1, 0], 3);
      // a loading dock along the pad's south apron: a service catwalk over the yard, 5 m wide stair from the west
      K.platform(31, -29, 18, 5, 2.6, { stairs: ['w'], stairW: 5, color: CONC2, stairColor: CONC });
      K.box(31, -31.1, 18, 1.0, 0.25, C.metal, { y: K.ground(31, -29) + 2.6, abs: true, collide: false });
      sphereTank(K, -40, -14, 5); sphereTank(K, -30, -30, 4);
      hTank(K, -44, 8, 2.6, 14); hTank(K, -36, 8, 2.6, 14);
      crane(K, 46, 10, 30, 26, -1); crane(K, -46, -26, 24, 22, 1);
      // rail spur with derelict wagons forming a wall on the south edge of the yard
      for (const dz of [-0.7, 0.7]) K.box(0, -33 + dz, 110, 0.15, 0.15, C.metal, { collide: false });
      for (const [x, c] of [[-12, 0x5a4a3a], [18, 0x4f5a5a], [-26, 0x6a4a3a]]) {
        const w = K.box(x, -33, 12, 3.4, 3.2, c, { y: 0.5, collide: false });
        K.box(x, -33, 11, 0.6, 2.6, DARK, { collide: false });
        K.collider(x - 6, 0, -34.6, x + 6, 3.9, -31.4, w);
      }
      // launch apron: containers in an L round the pad, wagons behind, cover on the approach
      container(K, 14, -26, false); container(K, 14, -26, false, 2.6); container(K, 10.8, -20, true); container(K, 10.8, -12, true, 0, 0x4f6a5a);
      container(K, 40, 10, true); container(K, -24, 18, true, 0, 0x7a4a32);
      barrier(K, -12, 12); barrier(K, 2, 2, false); K.crate(-16, 4); shield(K, 4, 10, false);
      fcrate(K, 0, 14); K.crate(6, 5); K.crate(7.3, 4);
      banner(K, -26, 12, CLOTH_R); banner(K, 20, 4, CLOTH_B);
      // the service deck (optional high ground) and a roofed launch bunker (optional side room)
      K.platform(-30, 2, 8, 14, 2.0, { stairs: ['e'], color: CONC2, stairColor: CONC });
      K.box(-34.1, 2, 0.25, 1.0, 14, C.metal, { y: 2.0, collide: false });
      K.room(-18, -24, 16, 12, 4.6, { t: 0.8, color: CONC2, doors: { e: 4, n: 3 }, roof: true, roofColor: ROOF });
      K.box(-18, -24, 4, 0.9, 2.2, C.metal); K.crate(-22, -28); K.crate(-14.5, -27.5);
      for (const x of [-25.6, -10.4]) K.box(x, -24, 0.2, 0.25, 11, 0xffd27a, { y: 3.4, glow: 1.2, collide: false });
      K.light(-18, 3, -24, 0xffb070, 6, 16);
      K.light(-30, 6, 2, 0xffd27a, 6, 22);
      K.light(30, 14, -2.5, 0xff7a4a, 7, 28);
      K.light(8, 6, 4, 0xffd27a, 5, 24);

      // ---- the road up to the Array: a paved ramp between Fallen barricades ----
      strip(K, 5, -38, 5, -62, 11, ROAD);
      for (const s of [-1, 1]) {
        for (const z of [-44, -54]) K.box(5 + s * 7.4, z, 0.8, 1.1, 3.2, CONC);
        shield(K, 5 + s * 8.4, -49, false);
      }
      banner(K, -4.5, -57, CLOTH_B); banner(K, 14.5, -57, CLOTH_R);

      // ---- the Array: Rasputin's dish field on a raised plateau, a walled yard with one gate ----
      K.box(3, -100, 78, 0.05, 70, 0xa39d92, { collide: false });
      K.mesh(new THREE.CylinderGeometry(22, 22, 0.06, 24), 0x8b857a, 5, 0.08, -92);
      K.mesh(new THREE.CylinderGeometry(20.5, 20.5, 0.07, 24), 0xa39d92, 5, 0.09, -92);
      // the big dish stands on two terraces, 5 m wide stairs up the front
      K.platform(5, -127, 36, 12, 2.8, { stairs: ['s'], stairW: 5, color: CONC, stairColor: CONC2 });
      K.platform(5, -129, 18, 7, 2.8, { y: 2.8, stairs: ['s'], stairW: 4, color: CONC2, stairColor: CONC });
      K.box(5, -125.2, 36.1, 0.5, 0.4, 0x9fe0ff, { y: 2.8, glow: 1.0, collide: false });
      dish(K, 5, -129, 15, 10, 0.55, Math.PI, false, 5.6);
      dish(K, -24, -84, 7, 5, 0.6, 2.5); dish(K, 31, -110, 6, 5, 0.55, -2.4); dish(K, -26, -118, 8, 6, 0.5, 2.9);
      // walled compound with one gate (the south face runs the full width of the map)
      K.wall(-55, -64, 55, -64, 9, { t: 1.2, color: CONC, gaps: [[56, 64]] });
      K.wall(-36, -135.5, 42, -135.5, 9, { t: 1.2, color: CONC });
      K.wall(-36, -135, -36, -64, 9, { t: 1.2, color: CONC });
      K.wall(42, -135, 42, -64, 9, { t: 1.2, color: CONC });
      K.door(5, -64, 8, 9, 'x', { zone: 1, t: 1.2, color: 0x4f555c, trim: 0x9fe0ff });
      for (const s of [-1, 1]) { K.box(5 + s * 5.2, -64, 2.2, 11, 2.2, CONC2); K.box(5 + s * 5.2, -62.8, 0.5, 0.5, 0.2, 0x9fe0ff, { y: 7, collide: false, glow: 2 }); }
      for (const [x, z] of [[-34.6, -65.6], [40.6, -65.6], [-34.6, -133.6], [40.6, -133.6]]) flood(K, x, z, 12, 0x9fe0ff, 6);
      // one raised relay building on the west side, a lookout deck the boss fight can be shot from
      K.platform(-27.5, -100, 11, 14, 3.2, { stairs: ['e'], stairW: 3, color: CONC2, stairColor: CONC });
      K.box(-29.5, -100, 5, 3.2, 7, CONC, { y: 3.2 });
      K.box(-29.5, -100, 5.1, 0.5, 7.1, 0x9fe0ff, { y: 4.4, glow: 1.0, collide: false });
      mast(K, -26, -95, 8, 3.2);
      K.light(-27.5, 8.5, -100, 0x9fe0ff, 6, 22);
      bunker(K, 36.5, -94, 8, 12, 5, 0x9fe0ff);
      mast(K, -20, -132, 18); mast(K, 30, -132, 22); mast(K, 40, -70, 14);
      K.box(-12, -126, 22, 0.08, 1, DARK, { collide: false }); K.box(24, -118, 24, 0.08, 1, DARK, { collide: false });
      // cover: three hand-placed slabs of different sizes between the gate and the dishes, Fallen scrap at the gate
      K.box(-6, -84, 6.4, 1.5, 1.2, CONC);
      K.box(13, -99, 3.0, 1.3, 1.5, C.metal); K.box(13, -99, 3.04, 0.5, 1.54, 0x9fe0ff, { y: 0.6, glow: 1.1, collide: false });
      K.box(23, -82, 2.2, 1.1, 4.4, CONC);
      shield(K, -3, -72, true); shield(K, 13, -73, true); shield(K, 5, -78, false); fcrate(K, -8, -77); fcrate(K, 17, -78);
      banner(K, -1.5, -68.5, CLOTH_B); banner(K, 11.5, -68.5, CLOTH_R);
      K.light(5, 8, -68, 0x9fe0ff, 6, 24);
      K.light(5, 7, -118, 0x9fe0ff, 10, 32);
      K.light(-12, 5, -86, 0x9fe0ff, 5, 20);
      K.light(20, 5, -98, 0x9fe0ff, 5, 20);
    },
  },

  // The Devils' Lair: dusk. Airliner yards on the low ground, a ramp up onto the Lunar Complex terrace and its facade, the Fallen's halls
  // behind the breach, and a long roofed corridor that comes in high above the Kell's chamber so you descend into it.
  e3: {
    spawn: [-50, 174],
    bounds: [-80, 60, -136, 186],
    zones: [
      { name: 'The Mothyards', x: -42, z: 122 },
      { name: 'Lunar Complex', x: 0, z: 56 },
      { name: "Devils' Halls", x: 10, z: -12 },
      { name: 'The Lair', x: 10, z: -100, boss: true, room: { minX: -22, maxX: 42, minZ: -131, maxZ: -69 } },
    ],
    noEdge: true,
    // The Mothyards roll a little, two ramps climb 4.5 m onto the Complex terrace (cliff front between them), and the same terrace
    // carries the halls; the roofed corridor then runs 4.5 m downhill to the Lair, whose floor is the low ground.
    terrain: [
      { type: 'mound', x: -22, z: 176, r: 20, h: 2.0 },
      { type: 'mound', x: 22, z: 162, r: 22, h: 1.8 },
      { type: 'mound', x: -76, z: 128, r: 14, h: 1.6 },
      { type: 'plateau', x: -10, z: 56, w: 150, d: 84, h: 4.5, edge: 5 },                        // the Complex terrace (z 14 to 98)
      { type: 'plateau', x: 10, z: -14, w: 60, d: 56, h: 4.5, edge: 2 },                         // behind the facade: the halls (z 14 to -42)
      { type: 'ramp', x0: -2, z0: 124, x1: -2, z1: 98, width: 18, h0: 0, h1: 4.5, edge: 5 },      // the road up (0.17)
      { type: 'ramp', x0: 42, z0: 122, x1: 42, z1: 98, width: 14, h0: 0, h1: 4.5, edge: 5 },      // the east flank (0.19)
      { type: 'ramp', x0: 10, z0: -42, x1: 10, z1: -69, width: 14, h0: 4.5, h1: 0, edge: 2 },     // the corridor runs down to the Lair (0.17)
    ],
    sky: {
      // a bruised dusk: a huge red sun on the ridge, violet cloud, first stars, the dark teeth of the old city on the horizon
      zenith: 0x20163a, mid: 0x6e3f66, horizon: 0xe8884e,
      stars: { n: 140, color: 0xffe8f0, size: 2, min: 0.35 },
      bodies: [{ color: 0xff8a40, size: 34, pos: [-400, 30, -460], glow: 0xff6a20 }],
      haze: [{ color: 0xe0804a, opacity: 0.5, r: 480, h: 70, y: -10 }],
      clouds: { n: 18, color: 0x74405a, opacity: 0.85, y: [50, 140], size: 26 },
    },
    build(K) {
      const C = K.C, TT = 4.5; // the terrace height

      // ---- Mothyards: hangar shells and airliner hulks on the low ground ----
      hangar(K, -50, 172, 11, 28);
      hangar(K, -8, 166, 10, 24, true, 0x7d8388);
      hangar(K, 46, 142, 13, 28, false);
      hangar(K, -26, 112, 10, 26, true, 0x858a8e);                                     // the full hangar that flanks the road up
      K.crate(-58, 165); K.crate(-57, 163.5); K.crate(-42, 181);
      fuselage(K, -66, 104, 26);
      fuselage(K, -66, 134, 12, { wing: 1, tail: false });                             // a hull broken in half
      fuselage(K, -66, 152, 10, { nose: false });
      fuselageX(K, -16, 130, 24, { wing: 1 });
      fuselageX(K, 22, 150, 26, { wing: 2 });
      K.mesh(cyl10(), HULLW, 24, 3.0, 118, { rx: Math.PI / 2 - 0.5, scale: [2.4, 20, 2.4], collide: 0.55 }); // a tail section nose-first in the ground
      container(K, -50, 128, true); K.crate(-32, 104); shield(K, -36, 122, true); fcrate(K, -50, 104);
      fcrate(K, -33, 119); banner(K, -46, 100, CLOTH_B);
      K.box(-28, 116, 2.2, 1.2, 5, YELLOW);
      K.mesh(new THREE.BoxGeometry(1.8, 0.4, 6), C.metal, -28, 2.6, 113.5, { rx: 0.45 });
      K.mesh(cyl10(), 0x8f8a80, -44, 1.3, 126, { rz: Math.PI / 2, scale: [1.3, 3.5, 1.3], collide: true });
      const wing = K.mesh(new THREE.BoxGeometry(14, 0.5, 4.5), HULLW, -54, 0.9, 118, { rz: 0.12 });
      K.collider(-61, 0, 115.8, -47, 1.8, 120.2, wing);
      // the one high lane of the yard: a jet bridge deck over the broken-off hull, a 5 m wide stair at each end
      const JB = 5.5;
      K.platform(-35, 130, 6, 6, JB + 0.6, { stairs: ['w'], stairW: 5, color: CONC2, stairColor: CONC });
      K.platform(7, 130, 6, 6, JB + 0.6, { stairs: ['e'], stairW: 5, color: CONC2, stairColor: CONC });
      K.box(-14, 130, 36, 0.6, 3.6, CONC2, { y: K.ground(-16, 130) + JB, abs: true });
      rail(K, -32, 4, 128.2, K.ground(-16, 130) + JB + 0.6, [], 1.0); rail(K, -32, 4, 131.8, K.ground(-16, 130) + JB + 0.6, [], 1.0);
      K.light(-16, 9, 130, F_BLUE, 6, 24);
      K.scatter((x, z) => pine(K, x, z), -66, 72, 0, 8, 3, 1.5);
      K.scatter((x, z) => pine(K, x, z), 52, 80, 0, 7, 3, 1.5);
      K.edge((x, z, y) => { const h = K.R(5, 8); K.mesh(geo('cone6', () => new THREE.ConeGeometry(1, 1, 6)), 0x2c4a32, x, y + h * 0.45, z, { scale: [h * 0.28, h * 0.9, h * 0.28], collide: false }); }, 40, 8, 70);
      K.edge((x, z, y) => K.mesh(new THREE.DodecahedronGeometry(K.R(2, 5), 0), C.rock, x, y + 1, z, { collide: false }), 24, 6, 50);
      // the road up to the terrace
      strip(K, -2, 124, -2, 98, 13, ROAD); strip(K, 42, 122, 42, 98, 10, ROAD);
      for (const [x, z] of [[-14, 100], [10, 100], [34, 100], [50, 100]]) K.box(x, z, 3.2, 1.1, 0.8, CONC);
      K.rock(-12, 106, 1.6); K.rock(16, 114, 1.9);

      // ---- Lunar Complex: a terrace facade with a blown breach, a ruined factory, a fallen hangar and a high bridge between them ----
      K.wall(-100, 24, 80, 24, 18, { t: 4, color: CONC2, gaps: [[103, 117]] });
      K.box(10, 24, 14, 6, 4, CONC2, { y: 12 });
      for (let x = -96; x <= 76; x += 12) if (Math.abs(x - 10) > 9) K.box(x, 26.6, 2, 18, 1.2, CONC);
      K.box(-10, 26.3, 178, 1.2, 0.8, CONC, { y: 13, collide: false });
      K.box(-48.5, 26.15, 101, 2, 0.4, DARK, { y: 8, collide: false });
      K.box(48.5, 26.15, 61, 2, 0.4, DARK, { y: 8, collide: false });
      K.rock(2, 32, 2.2); K.rock(18, 33, 1.8); K.rock(0.5, 21, 1.5);
      K.mesh(new THREE.BoxGeometry(4, 2, 3), CONC2, 21, 1, 31, { ry: 0.4, rz: 0.2, collide: 0.7 });
      // west factory: ruined walls and rusted trusses
      ruinWall(K, -44, 70, -22, 70, 4, 10, [[9, 15]]);
      ruinWall(K, -44, 32, -22, 32, 3, 8, [[3, 9]]);
      ruinWall(K, -44, 32, -44, 70, 6, 11);
      ruinWall(K, -22, 32, -22, 70, 3, 8, [[9, 15], [24, 30]]);
      for (const z of [38, 54, 62]) {
        K.box(-33, z, 22, 0.7, 0.7, RUST, { y: 9.5, collide: false });
        for (const x of [-43.2, -22.8]) K.box(x, z, 0.7, 9.5, 0.7, RUST);
      }
      K.cyl(-33, 66, 3, 9, RUST, { r2: 2.2 }); K.cone(-33, 66, 2.2, 3, C.metal, { y: 9, collide: false });
      // east: a collapsed hangar frame with a crane that has fallen across it and a sphere tank
      hangar(K, 36, 66, 11, 28, false);
      K.obox(36, 62, 1.4, 1.4, 30, 0.5, YELLOW, { y: 5.5 });
      K.box(29.5, 50, 3.6, 2.8, 3.2, YELLOW); K.box(29.5, 50, 3.9, 0.7, 3.5, DARK, { collide: false });
      K.box(43.4, 74.5, 1.4, 5.5, 1.4, YELLOW);
      sphereTank(K, 50, 50, 3.5);
      ruinWall(K, 22, 78, 46, 78, 3, 6, [[6, 12]]);
      // smokestacks
      K.cyl(-58, 40, 3.2, 46, CONC, { r2: 2.4, sides: 10 });
      K.cyl(-58, 40, 2.62, 3, 0xb04030, { y: 38, r2: 2.56, sides: 10, collide: false });
      K.cyl(-58, 40, 2.75, 2, WHITE, { y: 32, r2: 2.72, sides: 10, collide: false });
      K.cyl(54, 40, 3, 38, CONC, { r2: 2.2, sides: 10 });
      K.cyl(54, 40, 2.44, 3, 0xb04030, { y: 31, r2: 2.38, sides: 10, collide: false });
      // the catwalk between the factories: a 66 m deck 5 m up with a 5 m stair at each end, over the fight
      const BZ = 44, BY = K.ground(0, BZ) + 5.0;
      K.platform(-33, BZ, 8, 6, 5.6, { stairs: ['s'], stairW: 5, color: CONC2, stairColor: CONC });
      K.platform(33, BZ, 8, 6, 5.6, { stairs: ['n'], stairW: 5, color: CONC2, stairColor: CONC });
      K.box(0, BZ, 58, 0.6, 3.6, CONC2, { y: BY, abs: true });
      for (const px of [-12, 12]) K.box(px, BZ, 1.2, 5.0, 1.2, CONC);
      rail(K, -29, 29, BZ - 1.7, BY + 0.6, [], 1.0); rail(K, -29, 29, BZ + 1.7, BY + 0.6, [], 1.0);
      for (const x of [-18, 0, 18]) K.box(x, BZ, 0.5, 0.2, 3.6, F_RED, { y: BY + 0.6, abs: true, collide: false, glow: 1.2 });
      // approach cover clustered into one hold position south of the breach
      shield(K, -3, 40, true); shield(K, 5, 38, false); shield(K, 12, 41, true); fcrate(K, 8, 44); fcrate(K, -6, 36); K.crate(-9, 41); container(K, 20, 39, true);
      banner(K, -1, 29, CLOTH_R); banner(K, 20, 29, CLOTH_R); banner(K, -16, 44, CLOTH_B);
      car(K, -30, 82, true); car(K, -2, 90, false); car(K, -46, 84, true); car(K, 14, 82, true); car(K, 26, 92, false);
      // the breach is sealed until the complex is cleared
      K.door(10, 24, 14, 12, 'x', { zone: 1, t: 3.5, color: FALLEN, trim: F_RED });
      for (const s of [-1, 1]) K.box(10 + s * 8, 26.4, 0.4, 11, 0.4, F_RED, { collide: false, glow: 1.5 });
      K.light(10, 5, 31, F_RED, 7, 20);
      K.light(-33, 9, 51, F_RED, 6, 22);
      K.light(36, 9, 62, F_BLUE, 6, 22);
      K.light(-8, 6, 60, 0xffb070, 5, 20);
      K.light(0, 9, 44, F_BLUE, 5, 24);
      K.light(-50, 6, 108, F_BLUE, 5, 22);
      K.light(18, 6, 140, F_BLUE, 5, 22);

      // ---- Devils' Halls: three linked bays behind the breach (gate bay, central hall with a broken roof, the choke), floor 4.5 m up ----
      const WALL = (x1, z1, x2, z2, h) => K.wall(x1, z1, x2, z2, h, { t: 1.5, color: CONC2 });
      // gate bay 24 wide (z 22 to 4), roof 9
      WALL(-2, 22.5, -2, 3.2, 9); WALL(22, 22.5, 22, 3.2, 9);
      K.box(10, 13.4, 25.5, 0.6, 19.6, ROOF, { y: 9 });
      // central hall 36 wide (z 4 to -26), roof 12 with a collapsed section over the west of the floor
      WALL(-8, 4, -2, 4, 12); WALL(22, 4, 28, 4, 12);
      WALL(-8, 4.75, -8, -26.75, 12); WALL(28, 4.75, 28, -26.75, 12);
      K.box(-5.4, -11, 6.8, 0.6, 31.5, ROOF, { y: 12 }); K.box(19.4, -11, 18.8, 0.6, 31.5, ROOF, { y: 12 });
      K.box(4, -1.6, 12, 0.6, 12.8, ROOF, { y: 12 }); K.box(4, -23.4, 12, 0.6, 6.8, ROOF, { y: 12 });
      // the choke 14 wide (z -26 to -40), roof 8, then the corridor
      WALL(-8, -26, 3, -26, 12); WALL(17, -26, 28, -26, 12);
      WALL(3, -26, 3, -40.75, 8); WALL(17, -26, 17, -40.75, 8);
      K.box(10, -33.4, 15.5, 0.6, 14.8, ROOF, { y: 8 });
      // the light shaft: broken ceiling, rubble and a slab that came down with it
      K.rock(1.5, -12, 1.8); K.rock(7, -16, 1.4); K.rock(-0.5, -17, 1.1);
      K.mesh(new THREE.BoxGeometry(6, 0.8, 4), ROOF, 4, 1.5, -13, { rz: 0.25, ry: 0.3, collide: 0.8 });
      const beam = new THREE.Mesh(new THREE.BoxGeometry(11.5, 12.6, 11.5), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      beam.position.set(4, K.ground(4, -14) + 6.3, -14); K.scene.add(beam);
      K.light(4, 8, -14, 0xffd9a0, 12, 28);
      // the Fallen cargo lift on the east: a platform 2.2 m up in a frame that runs to the roof
      K.platform(24.5, -14, 7, 10, 2.2, { stairs: ['w'], stairW: 4, color: FALLEN, stairColor: 0x4a5668 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(24.5 + sx * 3.2, -14 + sz * 4.6, 0.5, 11.6, 0.5, FALLEN, { y: 0.4, collide: false });
      K.box(24.5, -14, 7.2, 0.5, 10.2, 0x4a5668, { y: 11.6, collide: false });
      K.box(26.2, -14, 0.3, 0.5, 6, F_BLUE, { y: 2.2, collide: false, glow: 1.6 }); fcrate(K, 25.5, -17, 1.4);
      K.light(24.5, 6, -14, F_BLUE, 6, 18);
      // the mezzanine over the choke: a deck 4.8 m up with a 5 m stair from the hall
      const MZ = K.ground(10, -32) + 4.8;
      K.box(10, -32, 12.5, 0.6, 8, FALLEN, { y: MZ - 0.6, abs: true });
      K.box(10, -35.9, 12.5, 1.0, 0.25, 0x4a5668, { y: MZ, abs: true, collide: false });
      stairTo(K, 7.5, -28, 'n', 5, MZ, 0x4a5668);
      K.light(10, 6.6, -32, F_RED, 5, 16);
      // scrap walls and shields build two lanes through the hall
      const scrap = (x, z, len, alongX) => { for (let a = 0; a < len; a += 2.6) { const h = K.R(1.5, 2.8), c = K.chance(0.5) ? RUST : FALLEN; if (alongX) K.box(x + a + 1.3, z, 2.5, h, 0.7, c); else K.box(x, z + a + 1.3, 0.7, h, 2.5, c); } };
      scrap(11, -3, 12, true); scrap(-2, -8, 8, false);
      shield(K, 15, -7, true); shield(K, 0, -24, true); shield(K, 17, -19, false); fcrate(K, -5, 1); fcrate(K, 20, 0);
      container(K, 10, 16, false, 0, FALLEN); K.crate(17, -30); fcrate(K, 5, -37);
      // banners only at the entry and the exit
      for (const x of [-1.3, 21.3]) cloth(K, x, 14, 2.5, 2.4, 6, false, x < 0 ? CLOTH_B : CLOTH_R, x < 0 ? F_BLUE : F_RED);
      for (const x of [3.8, 16.2]) cloth(K, x, -38, 2.2, 2.4, 5, false, x < 10 ? CLOTH_R : CLOTH_B, x < 10 ? F_RED : F_BLUE);
      for (const x of [-7.9, 27.9]) K.box(x, -11, 0.2, 0.25, 28, F_BLUE, { y: 7, glow: 1.5, collide: false });
      K.light(10, 7, 12, F_BLUE, 8, 24);
      K.light(18, 8, -2, F_RED, 6, 20);
      K.light(10, 6, -38, F_RED, 6, 16);

      // ---- the corridor (30 m, roofed): the floor runs 4.5 m downhill to the Lair door, the roof stays level ----
      const CT = TT + 9;
      for (let z = -41; z > -69; z -= 4) for (const x of [3.25, 16.75]) K.box(x, z - 2, 1.5, CT - K.ground(x, z - 2), 4, CONC2);
      K.box(10, -55, 15.5, 0.6, 28.5, ROOF, { y: CT, abs: true });
      for (const x of [4.4, 15.6]) for (let z = -43; z > -69; z -= 8) K.box(x, z - 3, 0.15, 0.1, 6, F_BLUE, { y: 1.4, glow: 1.5, collide: false });
      for (const z of [-46, -58, -66]) K.light(10, 6.5, z, z % 4 ? F_BLUE : F_RED, 4, 14);
      shield(K, 6.5, -52, true); fcrate(K, 13.5, -61, 1.2);

      // ---- The Lair: a roofed chamber on the low ground; a pillar ring, one west balcony, a roof open to the dusk, the Kell off to one side ----
      K.wall(-22, -69, 42, -69, 15, { t: 1.5, color: CONC2, gaps: [[26, 38]] });
      K.wall(-22, -131, 42, -131, 15, { t: 1.5, color: CONC2 });
      K.wall(-22, -131, -22, -69, 15, { t: 1.5, color: CONC2 });
      K.wall(42, -131, 42, -69, 15, { t: 1.5, color: CONC2 });
      K.box(1.15, -100, 48.8, 0.6, 63.5, ROOF, { y: 15 });
      K.box(34.4, -126.9, 17.7, 0.6, 9.6, ROOF, { y: 15 }); K.box(34.4, -89, 17.7, 0.6, 42, ROOF, { y: 15 }); K.box(40.4, -116, 5.7, 0.6, 12, ROOF, { y: 15 });
      const PH = [15, 15, 9, 15, 15, 6, 15, 12];
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + Math.PI / 8, px = 10 + Math.sin(a) * 17, pz = -100 + Math.cos(a) * 17;
        K.box(px, pz, 3, PH[i], 3, CONC);
        K.box(px, pz, 4.2, 1.2, 4.2, CONC2);
        K.box(px, pz, 3.15, 0.6, 3.15, i % 2 ? F_RED : F_BLUE, { y: 4.4, glow: 1.6, collide: false });
      }
      // dais: low plates only so the boss keeps its open floor
      K.mesh(new THREE.CylinderGeometry(8.6, 8.6, 0.1, 8), F_BLUE, 10, 0.05, -100, { glow: 1.2 });
      K.mesh(new THREE.CylinderGeometry(8, 8.3, 0.2, 8), 0x3a3f4a, 10, 0.1, -100);
      K.mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.24, 6), F_RED, 10, 0.1, -100, { glow: 0.9 });
      // the one balcony, on the west, reached by stairs from the entrance end
      K.platform(-18, -105, 6, 44, 6, { stairs: ['s'], stairW: 3, color: CONC2, stairColor: CONC });
      K.box(-15.15, -105, 0.3, 1.1, 44, C.metal, { y: 6 });
      K.box(-15.2, -105, 0.2, 0.2, 43, F_BLUE, { y: 5.6, glow: 1.4, collide: false });
      for (const z of [-90, -105, -120]) cloth(K, -21.1, z, 7.5, 2.6, 6, false, CLOTH_B);
      // the Kell's throne, off the axis in the north-east corner, under the open roof
      K.obox(26, -122, 12, 0.6, 8, 0.5, FALLEN);
      K.obox(26.2, -122.3, 8, 0.6, 5, 0.5, 0x4a5668, { y: 0.6 });
      K.obox(26.8, -123, 3.2, 1.4, 2.4, 0.5, FALLEN, { y: 1.2 });
      K.obox(27.6, -124.3, 3.8, 6, 0.8, 0.5, FALLEN, { y: 1.2 });
      K.box(28.2, -124.6, 1.2, 1.2, 0.3, F_RED, { y: 6.4, glow: 1.8, collide: false });
      for (const [x, z] of [[21, -118], [30, -126]]) { K.cyl(x, z, 0.6, 1.4, C.metal); K.cyl(x, z, 0.7, 0.4, F_BLUE, { y: 1.4, glow: 2, collide: false }); }
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(11.5, 15.4, 11.5), new THREE.MeshBasicMaterial({ color: 0xff9a60, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      shaft.position.set(31.5, 7.7, -116); K.scene.add(shaft);
      cloth(K, 2, -130.2, 4, 3.5, 9, true, CLOTH_R); cloth(K, 18, -130.2, 4, 3.5, 9, true, CLOTH_R);
      cloth(K, 10, -130.2, 8, 5, 6, true, CLOTH_B, F_RED);
      shield(K, 10, -84, true); shield(K, -1, -108, false); shield(K, 21, -106, false);
      fcrate(K, 0, -92); fcrate(K, 20, -94); fcrate(K, -12, -76); fcrate(K, 32, -78);
      // the Kell's chamber stays sealed until the halls are cleared
      K.door(10, -69, 12, 12, 'x', { zone: 2, t: 1.5, color: FALLEN, trim: F_RED });
      K.box(10, -69, 13, 3, 1.3, CONC2, { y: 12 });
      for (const [x, z] of [[-14, -76], [34, -76], [-14, -124], [34, -124]]) K.light(x, 8, z, x < 10 ? F_BLUE : F_RED, 6, 22);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; K.light(10 + Math.sin(a) * 17, 8.5, -100 + Math.cos(a) * 17, i % 2 ? F_RED : F_BLUE, 3, 14); }
      K.light(10, 11, -100, F_BLUE, 12, 40);
      K.light(26, 5, -120, F_RED, 10, 24);
      K.light(10, 6, -76, 0xa0b4ff, 7, 20);
    },
  },
};
