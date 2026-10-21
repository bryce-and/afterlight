import * as THREE from 'three';
import { mat } from './world.js';

// ---------------------------------------------------------------------------
// SCORN: Fallen raised by Dark Ether. Crude, scavenged, patchy.
// c.bodyMat = grey bone plates, c.dark = rags and joints, c.accent = ether glow.
// Same builder contract as the faction builders in enemies.js.
// ---------------------------------------------------------------------------

/** Two legs; digitigrade bends the knee backward (copy of enemies.js legsBiped). */
function legsBiped(c, hipY, hipW, thick, m, foot, digi = false) {
  for (const s of [-1, 1]) {
    const hip = c.pivot(s * hipW, hipY, 0);
    const L = hipY / 2;
    if (digi) {
      c.B(thick, L * 1.05, thick * 1.1, 0, -L * 0.48, 0.07, m, hip, false, [-0.32, 0, 0]);
      c.B(thick * 0.8, L * 1.05, thick * 0.9, 0, -L * 1.45, 0.06, m, hip, false, [0.3, 0, 0]);
    } else {
      c.B(thick, L, thick * 1.1, 0, -L * 0.5, 0, m, hip);
      c.B(thick * 0.95, L, thick, 0, -L * 1.5, 0, m, hip);
    }
    c.B(thick * 1.1, 0.09, thick * 1.8, 0, -hipY + 0.045, 0.06, foot, hip);
    c.legs.push(hip);
  }
}

/** Gun held at chest height; places the muzzle at its front (copy of enemies.js gun). */
function gun(c, parent, x, y, z, len, thick, glow = true) {
  c.B(thick, thick * 1.2, len, x, y, z, c.dark, parent);
  if (glow) c.B(thick * 0.5, thick * 0.4, len * 0.4, x, y + thick * 0.7, z, c.accent, parent);
  c.muzzle.position.set(x, y, z + len / 2 + 0.03);
  parent.add(c.muzzle);
}

function arm(c, parent, x, y, len, thick, m, lift = -1.1, rz = 0) {
  const p = c.pivot(x, y, 0, parent);
  c.B(thick, len, thick, 0, -len / 2, 0, m, p);
  p.rotation.x = lift;
  p.rotation.z = rz;
  return p;
}

/** Cone helper (spikes, horns, flames). Pointing +y unless rotated. */
function cone(c, parent, r, h, x, y, z, m, rot = null, crit = false, sides = 4) {
  return c.add(new THREE.ConeGeometry(r, h, sides), m, x, y, z, parent, crit, rot);
}

const BONE = () => mat(0xb9ad8c);
const RUST = () => mat(0x6b5a44);
const CLOTH = () => mat(0x3a3128);
const FLAME = () => mat(0xffa030, { emissive: 0xff7a1a, emissiveIntensity: 2.6 });

/** A short run of scrap-spike armor studs on a shoulder or back. */
function spikes(c, parent, x, y, z, n, dx, m, h = 0.2, tilt = 0) {
  for (let i = 0; i < n; i++) cone(c, parent, 0.03, h, x + i * dx, y, z, m, [0, 0, tilt]);
}

// ---------------------------------------------------------------------------
function screeb(c) {
  const { B, add, pivot, dark, bodyMat, accent } = c;
  const bone = BONE(), rust = RUST();
  const torso = pivot(0, 0.5, 0);
  c.torso = torso;
  // squat body, raggedly plated, no armor worth the name
  B(0.5, 0.26, 0.72, 0, 0, 0, dark, torso);
  B(0.4, 0.1, 0.3, 0.04, 0.16, 0.18, bodyMat, torso, false, [0, 0.2, 0.05]);
  B(0.3, 0.08, 0.26, -0.06, 0.15, -0.2, rust, torso, false, [0, -0.3, -0.05]);
  // head: a blunt maw with a blind ether eye strip
  B(0.3, 0.2, 0.26, 0, 0.0, 0.46, bone, torso, true);
  B(0.24, 0.04, 0.04, 0, 0.04, 0.6, accent, torso, true);
  B(0.18, 0.05, 0.08, 0, -0.1, 0.56, dark, torso, true);
  // the bomb: a swollen glowing sac strapped over the spine
  add(new THREE.IcosahedronGeometry(0.3, 0), accent, 0, 0.3, -0.1, torso, true).scale.set(1, 1.15, 1.1);
  B(0.46, 0.04, 0.06, 0, 0.18, 0.02, rust, torso);
  B(0.46, 0.04, 0.06, 0, 0.2, -0.24, rust, torso);
  cone(c, torso, 0.025, 0.16, 0, 0.62, -0.1, bone);
  cone(c, torso, 0.025, 0.12, 0.14, 0.58, -0.02, bone, [0, 0, -0.5]);
  cone(c, torso, 0.025, 0.12, -0.14, 0.58, -0.18, bone, [0, 0, 0.5]);
  // ether leaking down both flanks
  for (const s of [-1, 1]) B(0.03, 0.03, 0.4, s * 0.26, 0.04, -0.02, accent, torso);
  // six jointed legs: three pairs, front to back
  for (const z of [0.24, 0, -0.24]) {
    for (const s of [-1, 1]) {
      const hip = pivot(s * 0.24, 0.5, z);
      B(0.06, 0.34, 0.06, s * 0.1, -0.1, 0, dark, hip, false, [0, 0, s * 0.9]);
      B(0.05, 0.4, 0.05, s * 0.3, -0.3, 0, bone, hip, false, [0, 0, s * -0.25]);
      B(0.08, 0.04, 0.1, s * 0.34, -0.48, 0.02, rust, hip);
      c.legs.push(hip);
    }
  }
  c.muzzle.position.set(0, 0, 0.6);
  torso.add(c.muzzle);
  c.height = 1.1;
}

// ---------------------------------------------------------------------------
function wraith(c) {
  const { B, add, pivot, dark, bodyMat, accent } = c;
  const bone = BONE(), cloth = CLOTH(), flame = FLAME();
  legsBiped(c, 0.9, 0.11, 0.08, dark, bone, true);
  const torso = pivot(0, 0.9, 0);
  torso.rotation.x = 0.5;
  c.torso = torso;
  B(0.22, 0.22, 0.18, 0, 0.12, 0, dark, torso);
  B(0.34, 0.4, 0.24, 0, 0.45, 0, dark, torso);
  // exposed ribs and a single patch of plate
  for (let i = 0; i < 3; i++) B(0.38, 0.03, 0.04, 0, 0.32 + i * 0.1, 0.13, bone, torso);
  B(0.2, 0.2, 0.05, -0.06, 0.5, 0.14, bodyMat, torso, false, [0, 0, 0.1]);
  B(0.03, 0.26, 0.03, 0.08, 0.4, 0.15, accent, torso);
  // hunched hooded head with masked eyes
  add(new THREE.ConeGeometry(0.2, 0.34, 5), cloth, 0, 0.86, -0.02, torso, true, [0.35, 0, 0]);
  B(0.18, 0.16, 0.2, 0, 0.78, 0.07, bone, torso, true);
  B(0.2, 0.05, 0.05, 0, 0.8, 0.18, dark, torso, true);
  B(0.12, 0.025, 0.03, 0, 0.77, 0.2, accent, torso, true);
  // hanging rags down the back
  B(0.34, 0.7, 0.03, 0, 0.2, -0.16, cloth, torso, false, [0.18, 0, 0]);
  B(0.12, 0.5, 0.03, -0.14, 0.05, -0.17, cloth, torso, false, [0.2, 0, 0.1]);
  B(0.1, 0.4, 0.03, 0.15, 0.0, -0.17, cloth, torso, false, [0.2, 0, -0.1]);
  // two long arms, a flame torch in each fist
  for (const s of [-1, 1]) {
    const a = arm(c, torso, s * 0.24, 0.6, 0.62, 0.065, bone, -1.15, s * 0.08);
    B(0.07, 0.07, 0.07, 0, -0.64, 0, dark, a);
    B(0.035, 0.34, 0.035, 0, -0.74, 0.03, dark, a, false, [0.4, 0, 0]);
    add(new THREE.ConeGeometry(0.07, 0.26, 5), flame, 0, -0.93, 0.07, a, false, [Math.PI + 0.4, 0, 0]);
    B(0.06, 0.06, 0.06, 0, -0.84, 0.05, flame, a);
    c.arms.push(a);
  }
  c.muzzle.position.set(0, 0.5, 0.3);
  torso.add(c.muzzle);
  c.height = 1.9;
}

// ---------------------------------------------------------------------------
function ravager(c) {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  const bone = BONE(), rust = RUST(), flame = FLAME();
  legsBiped(c, 1.0, 0.3, 0.24, dark, rust);
  for (const s of [-1, 1]) B(0.28, 0.2, 0.34, s * 0.3, 0.6, 0.04, bodyMat); // knee plates
  const torso = pivot(0, 1.0, 0);
  torso.rotation.x = 0.28;
  c.torso = torso;
  B(0.6, 0.3, 0.4, 0, 0.14, 0, dark, torso);
  B(0.95, 0.62, 0.62, 0, 0.62, 0, bodyMat, torso);
  B(0.7, 0.3, 0.1, 0, 0.62, 0.34, rust, torso);
  for (let i = 0; i < 3; i++) B(0.6, 0.03, 0.04, 0, 0.5 + i * 0.12, 0.4, bone, torso);
  // chest sigil leaking ether
  B(0.05, 0.28, 0.03, 0, 0.62, 0.4, accent, torso);
  B(0.2, 0.05, 0.03, 0, 0.66, 0.4, accent, torso);
  // headless: a sunken neck stump with an ether glow, ringed by plate
  B(0.3, 0.2, 0.3, 0, 1.0, 0.1, dark, torso, true);
  B(0.2, 0.05, 0.05, 0, 1.02, 0.27, accent, torso, true);
  B(0.34, 0.06, 0.34, 0, 0.92, 0.08, rust, torso);
  // thick armored shoulders with scrap spikes
  for (const s of [-1, 1]) {
    B(0.5, 0.28, 0.6, s * 0.62, 0.92, 0, bodyMat, torso, false, [0, 0, s * -0.25]);
    B(0.4, 0.1, 0.5, s * 0.64, 1.1, 0, rust, torso, false, [0, 0, s * -0.25]);
    spikes(c, torso, s * 0.52, 1.2, 0, 3, s * 0.08, bone, 0.26, s * -0.3);
  }
  // back plating and rags
  B(0.7, 0.6, 0.05, 0, 0.6, -0.34, rust, torso, false, [0.1, 0, 0]);
  B(0.5, 0.6, 0.03, 0, 0.1, -0.3, CLOTH(), torso, false, [0.12, 0, 0]);
  // left arm: heavy bare fist
  const l = arm(c, torso, -0.7, 0.82, 0.95, 0.22, dark, -0.7, 0.12);
  B(0.3, 0.26, 0.3, 0, -1.0, 0.02, bone, l);
  B(0.04, 0.5, 0.04, 0, -0.5, 0.13, accent, l);
  c.arms.push(l);
  // right arm: flame cauldron swinging from a chain
  const r = arm(c, torso, 0.7, 0.82, 0.95, 0.22, dark, -0.55, -0.1);
  B(0.26, 0.2, 0.26, 0, -1.0, 0, rust, r);
  for (let i = 0; i < 4; i++) B(0.07, 0.1, 0.03, 0, -1.14 - i * 0.12, 0.1, i % 2 ? dark : bone, r, false, [0, i % 2 ? Math.PI / 2 : 0, 0]);
  add(new THREE.CylinderGeometry(0.2, 0.14, 0.26, 7), rust, 0, -1.76, 0.1, r);
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 7), flame, 0, -1.62, 0.1, r);
  add(new THREE.ConeGeometry(0.14, 0.34, 5), flame, 0, -1.5, 0.1, r);
  c.arms.push(r);
  c.muzzle.position.set(0, 0.6, 0.5);
  torso.add(c.muzzle);
  c.height = 2.3;
}

// ---------------------------------------------------------------------------
function stalker(c) {
  const { B, add, pivot, dark, bodyMat, accent } = c;
  const bone = BONE(), cloth = CLOTH();
  legsBiped(c, 0.9, 0.1, 0.07, dark, dark, true);
  const torso = pivot(0, 0.9, 0);
  torso.rotation.x = 0.2;
  c.torso = torso;
  B(0.2, 0.22, 0.16, 0, 0.12, 0, dark, torso);
  B(0.3, 0.38, 0.2, 0, 0.45, 0, dark, torso);
  B(0.24, 0.18, 0.05, 0.02, 0.5, 0.12, bodyMat, torso, false, [0, 0, -0.1]);
  B(0.03, 0.2, 0.03, -0.1, 0.38, 0.12, accent, torso);
  // narrow skull wrapped in a cloth strip over the eyes
  B(0.16, 0.2, 0.22, 0, 0.82, 0.05, bone, torso, true);
  B(0.2, 0.07, 0.24, 0, 0.84, 0.06, cloth, torso, true);
  B(0.03, 0.2, 0.03, 0.12, 0.74, 0.0, cloth, torso, false, [0.1, 0, 0.1]);
  B(0.03, 0.22, 0.03, -0.1, 0.72, -0.05, cloth, torso, false, [0.1, 0, -0.15]);
  for (const s of [-1, 1]) B(0.025, 0.025, 0.03, s * 0.04, 0.77, 0.18, accent, torso, true);
  // scrap shoulder spike and a thin rag cloak
  cone(c, torso, 0.03, 0.22, -0.2, 0.7, 0, bone, [0, 0, 0.6]);
  B(0.3, 0.7, 0.025, 0, 0.2, -0.13, cloth, torso, false, [0.14, 0, 0]);
  // two thin arms bracing the crossbow
  const up = [arm(c, torso, -0.2, 0.6, 0.5, 0.055, bone, -1.2, 0.1), arm(c, torso, 0.2, 0.6, 0.5, 0.055, bone, -1.25, -0.1)];
  c.arms.push(...up);
  gun(c, torso, 0.06, 0.44, 0.42, 0.6, 0.07);
  // crossbow bow-limbs crossing the front, with an ether-lit string
  B(0.9, 0.04, 0.05, 0.06, 0.46, 0.66, bone, torso);
  for (const s of [-1, 1]) B(0.2, 0.04, 0.05, 0.06 + s * 0.5, 0.44, 0.62, bone, torso, false, [0, s * 0.5, 0]);
  B(0.84, 0.012, 0.012, 0.06, 0.46, 0.58, accent, torso);
  c.height = 1.85;
}

// ---------------------------------------------------------------------------
function raider(c) {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  const bone = BONE(), cloth = CLOTH(), rust = RUST();
  legsBiped(c, 0.95, 0.14, 0.11, dark, rust, true);
  const torso = pivot(0, 0.95, 0);
  torso.rotation.x = 0.22;
  c.torso = torso;
  B(0.24, 0.24, 0.2, 0, 0.12, 0, dark, torso);
  B(0.42, 0.38, 0.28, 0, 0.45, 0, bodyMat, torso);
  B(0.36, 0.2, 0.06, 0.03, 0.5, 0.15, rust, torso, false, [0, 0, 0.1]);
  B(0.03, 0.3, 0.03, -0.1, 0.42, 0.15, accent, torso);
  // eye-plating: a broad plate mask over the eyes, one glowing crack
  B(0.24, 0.2, 0.26, 0, 0.82, 0.06, bone, torso, true);
  B(0.3, 0.09, 0.08, 0, 0.84, 0.19, rust, torso, true);
  B(0.04, 0.02, 0.03, 0.06, 0.8, 0.235, accent, torso, true);
  B(0.04, 0.02, 0.03, -0.06, 0.8, 0.235, accent, torso, true);
  cone(c, torso, 0.03, 0.2, 0.12, 0.98, 0.0, bone, [0, 0, -0.4], true);
  // ragged cloak, torn into strips
  add(new THREE.ConeGeometry(0.32, 0.36, 5, 1, true), cloth, 0, 0.78, -0.04, torso);
  for (let i = -2; i <= 2; i++) B(0.1, 0.7 + (i % 2) * 0.18, 0.025, i * 0.1, 0.1, -0.17, cloth, torso, false, [0.15, 0, i * 0.05]);
  // four arms: upper pair holds the saw rifle, lower pair braces it
  const up = [arm(c, torso, -0.27, 0.62, 0.48, 0.075, bodyMat, -1.2, 0.1), arm(c, torso, 0.27, 0.62, 0.48, 0.075, bodyMat, -1.2, -0.1)];
  arm(c, torso, -0.2, 0.36, 0.38, 0.06, dark, -0.9, 0.3);
  arm(c, torso, 0.2, 0.36, 0.38, 0.06, dark, -0.9, -0.3);
  c.arms.push(...up);
  // long saw-toothed rifle
  gun(c, torso, 0.1, 0.42, 0.55, 0.95, 0.075);
  for (let i = 0; i < 6; i++) cone(c, torso, 0.025, 0.07, 0.1, 0.35, 0.2 + i * 0.13, bone, [Math.PI, 0, 0], false, 3);
  // shoulder spike and drifting ether wisps
  cone(c, torso, 0.035, 0.26, 0.3, 0.74, 0, bone, [0, 0, -0.7]);
  const wisp = mat(c.C.eye, { emissive: c.C.eye, emissiveIntensity: 2.6 });
  for (const [x, y, z] of [[-0.36, 0.9, -0.1], [0.38, 0.35, -0.2], [-0.3, 0.2, 0.2]]) {
    add(new THREE.OctahedronGeometry(0.04, 0), wisp, x, y, z, torso);
  }
  c.height = 2.05;
}

// ---------------------------------------------------------------------------
function lurker(c) {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  const bone = BONE(), rust = RUST(), cloth = CLOTH();
  legsBiped(c, 0.75, 0.19, 0.17, dark, rust);
  const torso = pivot(0, 0.75, 0);
  torso.rotation.x = 0.1;
  c.torso = torso;
  B(0.4, 0.22, 0.28, 0, 0.1, 0, dark, torso);
  B(0.62, 0.5, 0.4, 0, 0.45, 0, bodyMat, torso);
  B(0.5, 0.16, 0.08, 0, 0.36, 0.22, rust, torso);
  // squat helm with an eye plate
  B(0.3, 0.26, 0.3, 0, 0.82, 0.04, bone, torso, true);
  B(0.34, 0.1, 0.1, 0, 0.82, 0.19, rust, torso, true);
  B(0.18, 0.03, 0.03, 0, 0.78, 0.245, accent, torso, true);
  cone(c, torso, 0.04, 0.2, 0, 1.03, 0.0, bone, null, true);
  // pauldrons with scrap spikes, rag skirt
  for (const s of [-1, 1]) {
    B(0.3, 0.2, 0.42, s * 0.4, 0.66, 0, bodyMat, torso, false, [0, 0, s * -0.2]);
    cone(c, torso, 0.035, 0.2, s * 0.44, 0.82, 0, bone, [0, 0, s * -0.4]);
  }
  B(0.5, 0.4, 0.03, 0, -0.12, 0.2, cloth, torso, false, [-0.1, 0, 0]);
  B(0.5, 0.45, 0.03, 0, -0.05, -0.2, cloth, torso, false, [0.1, 0, 0]);
  // arms: one braces the shield, one holds the pistol behind it
  const l = arm(c, torso, -0.4, 0.58, 0.46, 0.1, dark, -1.35, 0.15);
  const r = arm(c, torso, 0.38, 0.58, 0.46, 0.09, dark, -1.2, -0.1);
  c.arms.push(l, r);
  gun(c, torso, 0.14, 0.42, 0.36, 0.34, 0.07);
  // the scrap-plate shield (small, held out to the left; hitbox is `frontGuard.box` in factions.js): three bolted plates, crossbars, edge studs, a seam of ether
  const sh = pivot(-0.6, 0.38, 0.5, torso);
  sh.scale.setScalar(0.6);
  B(0.34, 0.95, 0.05, -0.31, 0, 0, bodyMat, sh, false, [0, 0, 0.03]);
  B(0.36, 1.0, 0.05, 0.0, 0.02, 0.01, rust, sh);
  B(0.32, 0.9, 0.05, 0.31, -0.03, 0, bodyMat, sh, false, [0, 0, -0.04]);
  for (const y of [-0.28, 0.28]) B(0.98, 0.07, 0.04, 0, y, 0.04, dark, sh);
  B(0.03, 0.8, 0.03, 0.17, 0, 0.045, accent, sh);
  for (let i = 0; i < 4; i++) {
    B(0.05, 0.05, 0.05, -0.46, -0.4 + i * 0.27, 0.04, bone, sh);
    B(0.05, 0.05, 0.05, 0.46, -0.4 + i * 0.27, 0.04, bone, sh);
  }
  B(0.06, 0.06, 0.06, -0.16, 0.46, 0.04, bone, sh);
  B(0.06, 0.06, 0.06, 0.16, 0.46, 0.04, bone, sh);
  c.height = 1.8;
}

// ---------------------------------------------------------------------------
function abomination(c) {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  const bone = BONE(), rust = RUST(), cloth = CLOTH();
  // thick, mismatched legs
  legsBiped(c, 1.0, 0.36, 0.38, dark, rust);
  c.legs[0].children[0].scale.set(1.15, 1, 1.15);
  const torso = pivot(0, 1.0, 0);
  torso.rotation.x = 0.35;
  c.torso = torso;
  // the mass: fused bodies and slabs of bone
  B(1.3, 0.5, 0.9, 0, 0.2, 0, dark, torso);
  B(1.5, 1.0, 1.0, 0, 0.9, 0, bodyMat, torso);
  add(new THREE.IcosahedronGeometry(0.5, 0), dark, -0.5, 1.2, -0.2, torso).scale.set(1, 0.9, 1);
  add(new THREE.IcosahedronGeometry(0.42, 0), bodyMat, 0.55, 0.5, 0.2, torso);
  B(0.5, 0.9, 0.4, 0.7, 1.3, -0.15, bone, torso, false, [0.2, 0.3, -0.5]); // a fused body, limp
  B(0.3, 0.7, 0.3, -0.75, 0.55, 0.2, bone, torso, false, [-0.3, 0, 0.6]);
  for (let i = 0; i < 4; i++) B(1.2, 0.05, 0.06, 0, 0.55 + i * 0.16, 0.52, bone, torso, false, [0, 0, (i - 1.5) * 0.05]);
  // embedded skulls (non-crit decoration)
  B(0.22, 0.2, 0.2, -0.3, 0.9, 0.52, bone, torso);
  B(0.18, 0.16, 0.18, 0.4, 1.1, 0.5, bone, torso);
  B(0.03, 0.03, 0.03, -0.34, 0.92, 0.63, accent, torso);
  B(0.03, 0.03, 0.03, -0.26, 0.92, 0.63, accent, torso);
  // headless: a sunken ether-lit hollow between the shoulders (the weak point)
  B(0.5, 0.3, 0.4, 0, 1.46, 0.22, dark, torso, true);
  add(new THREE.IcosahedronGeometry(0.12, 0), accent, 0, 1.5, 0.4, torso, true);
  // spines along the back
  for (let i = 0; i < 6; i++) cone(c, torso, 0.06, 0.4 + (i % 3) * 0.12, -0.55 + i * 0.22, 1.5, -0.42, bone, [-0.5, 0, 0]);
  // ether seams
  B(0.04, 0.8, 0.04, 0.2, 0.9, 0.52, accent, torso, false, [0, 0, 0.2]);
  B(0.4, 0.04, 0.04, -0.1, 0.35, 0.47, accent, torso);
  B(1.0, 0.7, 0.04, 0, 0.5, -0.52, cloth, torso, false, [0.1, 0, 0]);
  // huge arms ending in sparking ether hands
  for (const s of [-1, 1]) {
    const a = arm(c, torso, s * 0.95, 1.3, 1.25, 0.4, bodyMat, -0.45, s * -0.12);
    B(0.55, 0.3, 0.55, 0, -0.1, 0, rust, a);
    B(0.5, 0.5, 0.5, 0, -1.3, 0.05, dark, a);
    add(new THREE.IcosahedronGeometry(0.28, 0), accent, 0, -1.55, 0.1, a);
    cone(c, a, 0.04, 0.3, 0.2, -1.55, 0.1, accent, [0, 0, -1.2]);
    cone(c, a, 0.04, 0.3, -0.2, -1.6, 0.0, accent, [0, 0, 1.2]);
    cone(c, a, 0.04, 0.26, 0, -1.8, 0.2, accent, [1.2, 0, 0]);
    if (s === 1) gun(c, a, 0, -1.55, 0.1, 0.2, 0.1, false); // muzzle at the right hand
    c.arms.push(a);
  }
  c.height = 2.8;
}

// ---------------------------------------------------------------------------
function chieftain(c) {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  const bone = BONE(), rust = RUST(), cloth = CLOTH();
  const W = 1.3;
  legsBiped(c, 0.95, 0.15 * W, 0.12 * W, dark, rust, true);
  const torso = pivot(0, 0.95, 0);
  torso.rotation.x = 0.15;
  c.torso = torso;
  B(0.26 * W, 0.24, 0.2, 0, 0.12, 0, dark, torso);
  B(0.42 * W, 0.38, 0.28, 0, 0.45, 0, bodyMat, torso);
  B(0.36 * W, 0.22, 0.06, 0, 0.5, 0.15, rust, torso);
  // glowing ether sigil on the chest
  B(0.05, 0.22, 0.03, 0, 0.5, 0.19, accent, torso);
  B(0.18, 0.04, 0.03, 0, 0.54, 0.19, accent, torso);
  B(0.12, 0.04, 0.03, 0, 0.45, 0.19, accent, torso);
  // tall horned and crested bone helm
  B(0.26, 0.22, 0.28, 0, 0.84, 0.06, bone, torso, true);
  B(0.3, 0.07, 0.1, 0, 0.84, 0.2, rust, torso, true);
  for (const s of [-1, 1]) {
    B(0.03, 0.025, 0.03, s * 0.06, 0.83, 0.26, accent, torso, true);
    add(new THREE.ConeGeometry(0.05, 0.5, 5), bone, s * 0.2, 1.0, 0.0, torso, true, [0, 0, s * -0.7]);
    add(new THREE.ConeGeometry(0.035, 0.3, 4), bone, s * 0.1, 1.12, -0.02, torso, true, [0, 0, s * -0.25]);
  }
  B(0.06, 0.4, 0.2, 0, 1.15, -0.02, bone, torso, true);
  B(0.04, 0.22, 0.1, 0, 1.4, -0.05, rust, torso, true);
  // shoulder spikes
  for (const s of [-1, 1]) {
    B(0.28, 0.13, 0.34, s * 0.34, 0.68, 0, rust, torso, false, [0, 0, s * -0.3]);
    cone(c, torso, 0.04, 0.34, s * 0.38, 0.84, 0, bone, [0, 0, s * -0.5]);
    cone(c, torso, 0.03, 0.24, s * 0.3, 0.84, -0.12, bone, [-0.3, 0, s * -0.2]);
  }
  // long ragged banner-cape on a pole
  B(0.03, 1.5, 0.03, 0, 0.7, -0.2, dark, torso);
  const banner = mat(0x4a3a5a);
  for (let i = -2; i <= 2; i++) B(0.12, 1.0 + ((i + 2) % 3) * 0.2, 0.02, i * 0.12, 0.1 - ((i + 2) % 3) * 0.1, -0.24, i % 2 ? cloth : banner, torso, false, [0.12, 0, i * 0.04]);
  B(0.4, 0.04, 0.03, 0, 1.18, -0.24, bone, torso);
  B(0.08, 0.4, 0.02, 0, 0.4, -0.27, accent, torso, false, [0.12, 0, 0]);
  // four arms: upper pair on the weapon, lower pair braced
  const up = [arm(c, torso, -0.27 * W, 0.62, 0.48, 0.08, bodyMat, -1.2, 0.1), arm(c, torso, 0.27 * W, 0.62, 0.48, 0.08, bodyMat, -1.2, -0.1)];
  arm(c, torso, -0.2 * W, 0.36, 0.38, 0.065, bodyMat, -0.9, 0.3);
  arm(c, torso, 0.2 * W, 0.36, 0.38, 0.065, bodyMat, -0.9, -0.3);
  c.arms.push(...up);
  gun(c, torso, 0.12, 0.42, 0.5, 0.8, 0.09);
  // skull fetish at the gun's mouth
  B(0.12, 0.12, 0.12, 0.12, 0.42, 0.95, bone, torso);
  c.height = 2.25;
}

// ---------------------------------------------------------------------------
function totem(c) {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  const bone = BONE(), rust = RUST(), cloth = CLOTH();
  const torso = pivot(0, 0, 0);
  c.torso = torso;
  // stepped base of scrap
  B(1.0, 0.18, 1.0, 0, 0.09, 0, rust, torso);
  B(0.8, 0.14, 0.8, 0, 0.25, 0, dark, torso, false, [0, 0.4, 0]);
  // vertical stack: plate, skull, bone, skull
  B(0.5, 0.4, 0.5, 0, 0.5, 0, bodyMat, torso, false, [0, 0.2, 0]);
  B(0.38, 0.3, 0.38, 0, 0.85, 0, bone, torso, false, [0, -0.3, 0]);
  B(0.3, 0.26, 0.3, 0, 1.15, 0.0, bone, torso);
  B(0.07, 0.05, 0.03, -0.07, 1.17, 0.16, dark, torso);
  B(0.07, 0.05, 0.03, 0.07, 1.17, 0.16, dark, torso);
  B(0.34, 0.12, 0.34, 0, 1.35, 0, rust, torso, false, [0, 0.5, 0]);
  B(0.12, 0.3, 0.12, 0, 1.55, 0, bone, torso);
  // scrap spikes jutting from the stack, hanging chain links and rags
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    cone(c, torso, 0.04, 0.4, Math.cos(a) * 0.3, 0.7 + (i % 2) * 0.35, Math.sin(a) * 0.3, bone, [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9]);
  }
  for (let i = 0; i < 4; i++) B(0.05, 0.08, 0.02, 0.26, 1.3 - i * 0.1, 0.1, i % 2 ? dark : bone, torso);
  B(0.3, 0.5, 0.02, 0, 0.62, 0.28, cloth, torso, false, [-0.1, 0, 0]);
  // ether seams up the stack
  for (const y of [0.45, 0.8, 1.15]) B(0.34, 0.025, 0.03, 0, y, 0.2, accent, torso);
  B(0.03, 1.0, 0.03, 0.2, 0.8, 0.21, accent, torso);
  // floating ether crystal: the weak point
  const crystal = add(new THREE.OctahedronGeometry(0.2, 0), accent, 0, 1.78, 0, torso, true);
  crystal.scale.set(0.8, 1.4, 0.8);
  c.crystal = crystal; // optional: spin/bob target for the integrator
  for (const [x, y, z] of [[0.3, 1.6, 0.0], [-0.26, 1.85, 0.12], [0.05, 1.95, -0.3]]) add(new THREE.OctahedronGeometry(0.05, 0), accent, x, y, z, torso);
  c.muzzle.position.set(0, 1.78, 0);
  torso.add(c.muzzle);
  c.height = 2.0;
}

const BUILDERS = {
  sc_screeb: screeb,
  sc_wraith: wraith,
  sc_ravager: ravager,
  sc_stalker: stalker,
  sc_raider: raider,
  sc_lurker: lurker,
  sc_abomination: abomination,
  sc_chieftain: chieftain,
  sc_totem: totem,
};

/** Scorn model dispatcher: `t` is the unit id (sc_screeb ... sc_totem). */
export function scorn(c, t) {
  const build = BUILDERS[t];
  if (!build) throw new Error(`Unknown Scorn unit ${t}`);
  build(c);
}
