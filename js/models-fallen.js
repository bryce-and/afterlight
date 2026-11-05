import * as THREE from 'three';
import { mat } from './world.js';

// ---------------------------------------------------------------------------
// FALLEN (U18): every Fallen unit, moved out of enemies.js and models-vex.js. Same builder contract as the other
// factions: face +z, stand on y = 0 (floating units are lifted by `def.fly`), c.torso / c.legs / c.arms / c.muzzle set per unit.
// ---------------------------------------------------------------------------
const PI = Math.PI;
const ico = (c, r, d, m, x, y, z, parent, crit = false) => c.add(new THREE.IcosahedronGeometry(r, d), m, x, y, z, parent, crit);
const cone = (c, r, h, m, x, y, z, parent, rot = null, crit = false, seg = 5) => c.add(new THREE.ConeGeometry(r, h, seg), m, x, y, z, parent, crit, rot);

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

/** Gun held at chest height; places the muzzle at its front. */
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

// ---------------------------------------------------------------------------
// FALLEN: four arms, four eyes, cloaks, digitigrade legs
// ---------------------------------------------------------------------------
function fallenBase(c, t) {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  const armor = mat(0x6f716a), cloth = mat(0x3c4a5c);
  if (t === 'heavy') {
    // Brig: a walking Fallen tank
    for (const s of [-1, 1]) {
      const hip = pivot(s * 0.32, 1.0, 0);
      B(0.26, 0.55, 0.3, 0, -0.25, 0.05, armor, hip, false, [-0.25, 0, 0]);
      B(0.22, 0.55, 0.26, 0, -0.72, 0.02, dark, hip, false, [0.25, 0, 0]);
      B(0.36, 0.12, 0.5, 0, -0.96, 0.08, armor, hip);
      c.legs.push(hip);
    }
    const body = pivot(0, 1.0, 0);
    c.torso = body;
    B(0.95, 0.55, 0.8, 0, 0.42, 0, bodyMat, body);
    B(0.8, 0.2, 0.7, 0, 0.78, -0.05, armor, body);
    B(0.5, 0.18, 0.06, 0, 0.5, 0.41, dark, body, true);
    B(0.38, 0.06, 0.04, 0, 0.52, 0.44, accent, body, true);
    for (const s of [-1, 1]) {
      B(0.26, 0.26, 0.75, s * 0.62, 0.42, 0.1, armor, body);
      for (const dy of [-0.06, 0.06]) add(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6).rotateX(Math.PI / 2), dark, s * 0.62, 0.42 + dy, 0.62, body);
      B(0.03, 0.4, 0.03, s * 0.3, 1.05, -0.3, dark, body);
    }
    c.muzzle.position.set(0.62, 0.42, 0.8);
    body.add(c.muzzle);
    c.height = 2.0;
    return;
  }
  const big = t === 'captain' || t === 'boss';
  const W = big ? 1.3 : t === 'rusher' ? 0.85 : 1;
  legsBiped(c, 0.95, 0.15 * W, 0.12 * W, dark, armor, true);
  const torso = pivot(0, 0.95, 0);
  torso.rotation.x = t === 'rusher' ? 0.45 : 0.22;
  c.torso = torso;
  B(0.26 * W, 0.24, 0.2, 0, 0.12, 0, dark, torso);
  B(0.42 * W, 0.38, 0.28, 0, 0.45, 0, bodyMat, torso);
  B(0.36 * W, 0.2, 0.06, 0, 0.5, 0.15, armor, torso);
  // helmet with mandible fins and four eyes
  B(0.22, 0.18, 0.26, 0, 0.82, 0.07, armor, torso, true);
  for (const s of [-1, 1]) {
    B(0.04, 0.14, 0.12, s * 0.12, 0.74, 0.17, armor, torso, true, [0.3, 0, s * 0.2]);
    for (const dy of [0, 0.05]) B(0.035, 0.03, 0.03, s * 0.05, 0.84 - dy, 0.205, accent, torso, true);
  }
  // hooded cloak hanging off the back
  add(new THREE.ConeGeometry(0.34 * W, 0.4, 5, 1, true), cloth, 0, 0.8, -0.04, torso);
  B(0.5 * W, big ? 1.0 : 0.8, 0.03, 0, big ? 0.15 : 0.25, -0.17, cloth, torso, false, [0.15, 0, 0]);
  // four arms: upper pair holds the weapon, lower pair braces it
  const up = [arm(c, torso, -0.27 * W, 0.62, 0.48, 0.08, bodyMat, -1.2, 0.1), arm(c, torso, 0.27 * W, 0.62, 0.48, 0.08, bodyMat, -1.2, -0.1)];
  arm(c, torso, -0.2 * W, 0.36, 0.38, 0.065, bodyMat, -0.9, 0.3);
  arm(c, torso, 0.2 * W, 0.36, 0.38, 0.065, bodyMat, -0.9, -0.3);
  c.arms.push(...up);
  if (t === 'rusher') {
    // Dreg: shock blades instead of a rifle
    for (const a of up) B(0.02, 0.05, 0.36, 0, -0.5, 0.12, accent, a);
    c.muzzle.position.set(0, 0.5, 0.3); torso.add(c.muzzle);
  } else {
    gun(c, torso, 0.12, 0.42, 0.45, big ? 0.75 : 0.65, 0.08);
  }
  if (big) {
    for (const s of [-1, 1]) {
      B(0.26, 0.12, 0.32, s * 0.33, 0.68, 0, armor, torso, false, [0, 0, s * -0.3]);
      add(new THREE.ConeGeometry(0.03, 0.3, 4), armor, s * 0.08, 1.02, 0.02, torso, true, [-0.4, 0, s * -0.4]);
    }
    B(0.1, 0.5, 0.02, 0.1, 0.08, 0.16, mat(c.C.accent), torso);
  }
  if (t === 'boss') {
    // Kell-style banners behind the shoulders
    for (const s of [-1, 1]) {
      B(0.03, 1.1, 0.03, s * 0.24, 1.0, -0.2, dark, torso);
      B(0.22, 0.5, 0.015, s * 0.24 + s * 0.12, 1.3, -0.2, mat(c.C.accent), torso);
    }
  }
}

/** Explosive Shank: a hovering drone with a glowing charge in its nose. */
function shank(c) {
  const { B, add, pivot, bodyMat, dark } = c;
  const hot = mat(0xff4a1a, { emissive: 0xff4a1a, emissiveIntensity: 2.8 });
  const core = pivot(0, 1.0, 0);
  c.torso = core;
  add(new THREE.OctahedronGeometry(0.42, 0), bodyMat, 0, 0, 0, core, true);
  B(0.55, 0.14, 0.55, 0, 0, 0, dark, core, false, [0, Math.PI / 4, 0]);
  add(new THREE.IcosahedronGeometry(0.2, 0), hot, 0, 0, 0.3, core, true);
  for (const sx of [-1, 1]) B(0.5, 0.04, 0.22, sx * 0.5, 0, -0.1, dark, core, false, [0, 0, sx * 0.25]);
  c.muzzle.position.set(0, 0, 0.4);
  core.add(c.muzzle);
  c.hover = true;
  c.height = 1.5;
}

const EXTRA = {
  fl_shank(c) {
    // a Fallen drone: a dark angular hull with a blue eye and a short gun under the chin, four splayed brass legs
    const hull = mat(0x3a3a46), brass = mat(0xa88a4e), eyeM = mat(0x62b4ff, { emissive: 0x62b4ff, emissiveIntensity: 2.6 });
    c.hover = true;
    const b = c.pivot(0, 0.9, 0);
    c.torso = b;
    ico(c, 0.34, 0, hull, 0, 0, 0, b).scale.set(1.1, 0.8, 1.3);
    for (const s of [-1, 1]) c.B(0.06, 0.34, 0.5, s * 0.34, 0.08, -0.05, brass, b, false, [0, 0, s * -0.5]);
    c.add(new THREE.TorusGeometry(0.13, 0.04, 4, 8), brass, 0, 0.02, 0.4, b);
    ico(c, 0.09, 1, eyeM, 0, 0.02, 0.39, b, true).scale.z = 0.6;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      cone(c, 0.04, 0.4, brass, Math.cos(a) * 0.22, -0.3, Math.sin(a) * 0.22 - 0.05, b, [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], false, 4);
    }
    c.B(0.07, 0.07, 0.3, 0, -0.16, 0.3, brass, b);
    c.muzzle.position.set(0, -0.16, 0.5); b.add(c.muzzle);
    c.height = 1.0;
  },
  fl_servitor(c) {
    // a floating sphere with one purple eye, plating peeled back to circuitry, Ether tubes below
    const bone = mat(0xc8c2d2), plate = mat(0x8a8698), purple = mat(0xb26bff, { emissive: 0xb26bff, emissiveIntensity: 2.4 });
    c.hover = true;
    const b = c.pivot(0, 1.2, 0);
    c.torso = b;
    ico(c, 0.55, 1, plate, 0, 0, 0, b);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + 0.4;
      c.B(0.5, 0.5, 0.04, Math.cos(a) * 0.5, Math.sin(a) * 0.2, Math.sin(a) * 0.5, bone, b, false, [0.4, -a, 0.2]);
    }
    c.add(new THREE.TorusGeometry(0.24, 0.07, 5, 10), bone, 0, 0.02, 0.52, b);
    ico(c, 0.17, 1, purple, 0, 0.02, 0.5, b, true).scale.z = 0.6;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2;
      c.B(0.05, 0.5, 0.05, Math.cos(a) * 0.22, -0.7, Math.sin(a) * 0.22, bone, b);
      ico(c, 0.06, 0, purple, Math.cos(a) * 0.22, -0.98, Math.sin(a) * 0.22, b);
    }
    c.muzzle.position.set(0, 0.02, 0.65); b.add(c.muzzle);
    c.height = 2.2;
  },
};

/** Every Fallen unit: the base classes (grunt Vandal, rusher Dreg, captain, heavy Brig, suicide Explosive Shank, generic boss) and the v2.9 units. */
export function fallen(c, t) {
  if (EXTRA[t]) return EXTRA[t](c);
  if (t === 'suicide') return shank(c);
  return fallenBase(c, t);
}
