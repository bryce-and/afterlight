import * as THREE from 'three';
import { mat } from './world.js';

// ---------------------------------------------------------------------------
// Unique boss models. Each builder takes the kit from enemies.js buildModel:
// { g, add, B, pivot, bodyMat, dark, accent, C, muzzle, legs, arms, torso, height }.
// Models face +z, stand on y = 0 and are built ~2 m tall (def.scale enlarges them).
// Head/eye/weak-point meshes are tagged crit. Every model sets c.torso.
// ---------------------------------------------------------------------------
const PI = Math.PI;

const cone = (c, r, h, seg, m, x, y, z, p, crit = false, rot = null) => c.add(new THREE.ConeGeometry(r, h, seg), m, x, y, z, p, crit, rot);
const cyl = (c, rt, rb, h, seg, m, x, y, z, p, crit = false, rot = null) => c.add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, p, crit, rot);
const ico = (c, r, det, m, x, y, z, p, crit = false) => c.add(new THREE.IcosahedronGeometry(r, det), m, x, y, z, p, crit);

/** Two legs; digitigrade bends the knee backward (Fallen, Hive, Scorn). */
function legs(c, hipY, hipW, thick, m, foot, digi = false) {
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

function arm(c, parent, x, y, len, thick, m, lift = -1.1, rz = 0) {
  const p = c.pivot(x, y, 0, parent);
  c.B(thick, len, thick, 0, -len / 2, 0, m, p);
  p.rotation.x = lift;
  p.rotation.z = rz;
  return p;
}

/** Gun fixed to the torso; places the muzzle at its front. */
function gun(c, parent, x, y, z, len, thick, glow = true) {
  c.B(thick, thick * 1.2, len, x, y, z, c.dark, parent);
  if (glow) c.B(thick * 0.5, thick * 0.4, len * 0.4, x, y + thick * 0.7, z, c.accent, parent);
  c.muzzle.position.set(x, y, z + len / 2 + 0.03);
  parent.add(c.muzzle);
}

// ---- Fallen helpers -------------------------------------------------------
function fallenHead(c, p, y, z, m, s = 1) {
  c.B(0.22 * s, 0.18 * s, 0.26 * s, 0, y, z, m, p, true);
  for (const k of [-1, 1]) {
    c.B(0.04 * s, 0.14 * s, 0.12 * s, k * 0.12 * s, y - 0.08 * s, z + 0.1 * s, m, p, true, [0.3, 0, k * 0.2]);
    for (const dy of [0, 0.05]) c.B(0.035 * s, 0.03 * s, 0.03 * s, k * 0.05 * s, y + (0.02 - dy) * s, z + 0.135 * s, c.accent, p, true);
  }
}
function fallenBody(c, W, hipY, lean, legM, footM) {
  legs(c, hipY, 0.15 * W, 0.12 * W, legM, footM, true);
  const torso = c.pivot(0, hipY, 0);
  torso.rotation.x = lean;
  c.torso = torso;
  c.B(0.26 * W, 0.24, 0.2, 0, 0.12, 0, c.dark, torso);
  c.B(0.42 * W, 0.38, 0.28, 0, 0.45, 0, c.bodyMat, torso);
  return torso;
}
/** Four arms: upper pair animates (pushed to c.arms), lower pair is fixed. */
function fallenArms(c, torso, W, m, sleeve = null) {
  const up = [arm(c, torso, -0.27 * W, 0.62, 0.48, 0.08, m, -1.2, 0.1), arm(c, torso, 0.27 * W, 0.62, 0.48, 0.08, m, -1.2, -0.1)];
  const lo = [arm(c, torso, -0.2 * W, 0.36, 0.38, 0.065, m, -0.9, 0.3), arm(c, torso, 0.2 * W, 0.36, 0.38, 0.065, m, -0.9, -0.3)];
  if (sleeve) for (const a of [...up, ...lo]) cone(c, 0.09, 0.32, 5, sleeve, 0, -0.22, 0, a);
  c.arms.push(...up);
  return [...up, ...lo];
}

// ---- Hive helpers ---------------------------------------------------------
function hiveKnight(c, W, hipY, chitin) {
  legs(c, hipY, 0.15 * W, 0.15 * W, chitin, chitin);
  for (const s of [-1, 1]) c.B(0.16 * W, 0.2, 0.08, s * 0.15 * W, hipY * 0.52, 0.1, c.bodyMat);
  const torso = c.pivot(0, hipY, 0);
  torso.rotation.x = 0.14;
  c.torso = torso;
  c.B(0.36 * W, 0.26, 0.26, 0, 0.12, 0, chitin, torso);
  c.B(0.56 * W, 0.5, 0.36, 0, 0.5, 0, c.bodyMat, torso);
  for (let i = 0; i < 3; i++) c.B(0.48 * W, 0.05, 0.05, 0, 0.36 + i * 0.12, 0.19, chitin, torso);
  c.B(0.08, 0.5, 0.1, 0, 0.55, -0.2, chitin, torso);
  // helmet with a single glowing slit
  c.B(0.28, 0.28, 0.32, 0, 0.92, 0.04, chitin, torso, true);
  c.B(0.2, 0.035, 0.04, 0, 0.92, 0.215, c.accent, torso, true);
  for (const s of [-1, 1]) c.B(0.26 * W, 0.16, 0.36, s * 0.36 * W, 0.74, 0, c.bodyMat, torso, false, [0, 0, s * -0.25]);
  const arms = [arm(c, torso, -0.38 * W, 0.66, 0.6, 0.11 * W, chitin, -1.15, 0.1), arm(c, torso, 0.38 * W, 0.66, 0.6, 0.11 * W, chitin, -1.15, -0.1)];
  for (const a of arms) c.B(0.15 * W, 0.2, 0.15 * W, 0, -0.45, 0, c.bodyMat, a);
  c.arms.push(...arms);
  return { torso, arms };
}
/** Sword held in an arm: the blade runs along the arm's +z, so it stands upright at rest and swings on melee. */
function sword(c, a, len, armLen, width, blade, hilt) {
  c.B(0.06, 0.06, 0.3, 0, -armLen, 0.05, hilt, a);
  c.B(width * 1.8, 0.06, 0.06, 0, -armLen, 0.2, hilt, a);
  c.B(width, 0.05, len, 0, -armLen, 0.2 + len / 2, blade, a);
  cone(c, width * 0.6, 0.2, 4, blade, 0, -armLen, 0.3 + len, a, false, [PI / 2, 0, 0]);
}
/** Robe skirt standing on the ground, with ragged hanging strips. */
function robe(c, rTop, rBot, h, m, strips, stripM) {
  cyl(c, rTop, rBot, h, 7, m, 0, h / 2 + 0.05, 0);
  for (let i = 0; i < strips; i++) {
    const a = (i / strips) * PI * 2;
    const L = 0.3 + ((i * 7) % 5) * 0.08;
    c.B(0.16, L, 0.03, Math.sin(a) * (rBot - 0.02), 0.08 + L / 2 - 0.08, Math.cos(a) * (rBot - 0.02), stripM, undefined, false, [0.1, a, 0]);
  }
}

// ---- Cabal helpers --------------------------------------------------------
function cabalBody(c, W, hipY, metal) {
  const under = c.dark;
  legs(c, hipY, 0.17 * W, 0.17 * W, under, metal);
  for (const s of [-1, 1]) c.B(0.2 * W, 0.26, 0.24, s * 0.17 * W, hipY * 0.68, 0.04, c.bodyMat);
  const torso = c.pivot(0, hipY, 0);
  c.torso = torso;
  c.B(0.42 * W, 0.26, 0.3, 0, 0.12, 0, under, torso);
  c.B(0.62 * W, 0.52, 0.44, 0, 0.5, 0, c.bodyMat, torso);
  c.B(0.5 * W, 0.18, 0.08, 0, 0.42, 0.23, metal, torso);
  c.B(0.32, 0.3, 0.32, 0, 0.94, 0.04, c.bodyMat, torso, true);
  c.B(0.24, 0.12, 0.06, 0, 0.92, 0.2, under, torso, true);
  c.B(0.2, 0.035, 0.03, 0, 0.94, 0.235, c.accent, torso, true);
  const arms = [arm(c, torso, -0.44 * W, 0.64, 0.55, 0.15, under, -1.1, 0.12), arm(c, torso, 0.44 * W, 0.64, 0.55, 0.15, under, -1.1, -0.12)];
  for (const a of arms) c.B(0.2, 0.22, 0.2, 0, -0.42, 0, c.bodyMat, a);
  c.arms.push(...arms);
  return torso;
}

export const BOSS_MODELS = {
  // -------------------------------------------------------------------------
  // FALLEN
  // -------------------------------------------------------------------------
  servitor(c) {
    const { add, B, pivot, bodyMat, dark, accent } = c;
    const plate = mat(0x6f716a), glow = mat(0x9a6bff, { emissive: 0x7a4bff, emissiveIntensity: 1.8 });
    c.hover = true;
    const body = pivot(0, 1.2, 0);
    c.torso = body;
    ico(c, 0.72, 1, bodyMat, 0, 0, 0, body);
    // the great eye
    add(new THREE.CylinderGeometry(0.4, 0.44, 0.16, 10).rotateX(PI / 2), dark, 0, 0.02, 0.62, body);
    add(new THREE.SphereGeometry(0.3, 10, 8), accent, 0, 0.02, 0.68, body, true).scale.z = 0.6;
    add(new THREE.TorusGeometry(0.42, 0.05, 5, 12), plate, 0, 0.02, 0.72, body, true);
    // armour plates around the sides and back
    for (let i = 0; i < 5; i++) {
      const a = PI / 3 + i * (PI / 3);
      B(0.44, 0.52, 0.12, Math.sin(a) * 0.74, 0.08, Math.cos(a) * 0.74, plate, body, false, [0, a, 0]);
    }
    B(0.5, 0.12, 0.7, 0, 0.7, -0.1, plate, body);
    // equatorial ring with spikes
    add(new THREE.TorusGeometry(0.98, 0.06, 5, 16), dark, 0, -0.08, 0, body, false, [PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) {
      if (i === 6) continue;
      const a = (i * PI) / 4;
      cone(c, 0.07, 0.4, 4, plate, Math.cos(a) * 1.15, -0.08, -Math.sin(a) * 1.15, body, false, [0, a, -PI / 2]);
    }
    for (const x of [-0.25, 0, 0.25]) cone(c, 0.07, 0.55, 4, plate, x, 0.82, -0.25, body, false, [-0.5, 0, -x * 1.2]);
    // thrusters underneath
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      cyl(c, 0.13, 0.09, 0.3, 6, dark, Math.sin(a) * 0.35, -0.72, Math.cos(a) * 0.35, body);
      cyl(c, 0.08, 0.08, 0.04, 6, glow, Math.sin(a) * 0.35, -0.89, Math.cos(a) * 0.35, body);
    }
    c.muzzle.position.set(0, 0.02, 0.92);
    body.add(c.muzzle);
    c.height = 2.1;
  },

  archon(c) {
    const { B, bodyMat, dark, accent } = c;
    const cloth = mat(0x5a3a6a), trim = mat(0xc9a64a), armor = mat(0x6f716a);
    legs(c, 0.95, 0.12, 0.1, dark, armor, true);
    // long robe hides the legs
    cyl(c, 0.3, 0.6, 1.0, 7, cloth, 0, 0.55, 0);
    cyl(c, 0.61, 0.64, 0.08, 7, trim, 0, 0.06, 0);
    B(0.2, 0.92, 0.04, 0, 0.52, 0.45, trim, undefined, false, [-0.29, 0, 0]);
    const torso = c.pivot(0, 1.0, 0);
    torso.rotation.x = 0.12;
    c.torso = torso;
    B(0.36, 0.26, 0.24, 0, 0.1, 0, cloth, torso);
    B(0.48, 0.42, 0.3, 0, 0.42, 0, bodyMat, torso);
    for (const s of [-1, 1]) B(0.08, 0.6, 0.03, s * 0.12, 0.3, 0.17, trim, torso);
    B(0.72, 0.1, 0.38, 0, 0.6, 0, cloth, torso);
    fallenHead(c, torso, 0.78, 0.06, armor);
    // tall ceremonial headdress
    B(0.16, 0.55, 0.06, 0, 1.12, 0, trim, torso, true);
    for (const s of [-1, 1]) {
      B(0.1, 0.42, 0.05, s * 0.13, 1.04, -0.02, trim, torso, true, [0, 0, s * -0.35]);
      B(0.06, 0.3, 0.04, s * 0.24, 0.96, -0.04, cloth, torso, false, [0, 0, s * -0.7]);
    }
    cone(c, 0.07, 0.22, 4, trim, 0, 1.5, 0, torso, true);
    B(0.07, 0.07, 0.04, 0, 1.05, 0.04, accent, torso, true);
    // hood mantle behind the head
    cone(c, 0.3, 0.45, 5, cloth, 0, 0.82, -0.08, torso);
    fallenArms(c, torso, 1.05, bodyMat, cloth);
    // ceremonial staff
    B(0.045, 2.0, 0.045, 0.42, 0.05, 0.3, dark, torso);
    c.add(new THREE.TorusGeometry(0.14, 0.025, 4, 10), trim, 0.42, 1.18, 0.3, torso);
    ico(c, 0.08, 0, accent, 0.42, 1.18, 0.3, torso);
    for (const s of [-1, 1]) cone(c, 0.03, 0.22, 4, trim, 0.42 + s * 0.14, 1.3, 0.3, torso, false, [0, 0, s * -0.4]);
    c.muzzle.position.set(0.42, 1.18, 0.42);
    torso.add(c.muzzle);
    c.height = 2.6;
  },

  kell(c) {
    const { B, add, bodyMat, dark } = c;
    const W = 1.5;
    const armor = mat(0x8a8f96), cape = mat(0x3d4f6a), ice = mat(0xcdefff, { emissive: 0x8fd8ff, emissiveIntensity: 1.2 });
    const torso = fallenBody(c, W, 1.0, 0.18, dark, armor);
    B(0.5 * W, 0.22, 0.08, 0, 0.5, 0.17, armor, torso);
    for (const y of [0.36, 0.64]) B(0.44 * W, 0.03, 0.03, 0, y, 0.2, ice, torso);
    fallenHead(c, torso, 0.84, 0.08, armor, 1.25);
    // horned crown
    for (const s of [-1, 1]) {
      cone(c, 0.06, 0.55, 4, ice, s * 0.13, 1.14, -0.02, torso, true, [-0.2, 0, s * -0.45]);
      cone(c, 0.04, 0.3, 4, armor, s * 0.07, 1.08, 0.06, torso, true, [-0.1, 0, s * -0.2]);
    }
    cone(c, 0.05, 0.36, 4, ice, 0, 1.15, 0.04, torso, true);
    // pauldrons with icy trim
    for (const s of [-1, 1]) {
      B(0.3, 0.14, 0.38, s * 0.36 * W, 0.7, 0, armor, torso, false, [0, 0, s * -0.3]);
      B(0.32, 0.03, 0.4, s * 0.36 * W, 0.64, 0, ice, torso, false, [0, 0, s * -0.3]);
      cone(c, 0.05, 0.3, 4, armor, s * 0.44 * W, 0.86, -0.04, torso, false, [0, 0, s * -0.5]);
    }
    // great cape and collar
    B(1.0, 1.7, 0.04, 0, 0.0, -0.26, cape, torso, false, [0.16, 0, 0]);
    for (const s of [-1, 1]) B(0.04, 1.4, 0.4, s * 0.5, 0.1, -0.12, cape, torso, false, [0.1, 0, s * 0.08]);
    B(0.9, 0.04, 0.05, 0, -0.84, -0.4, ice, torso, false, [0.16, 0, 0]);
    B(0.7, 0.24, 0.14, 0, 0.74, -0.16, cape, torso);
    fallenArms(c, torso, W, bodyMat);
    // shrapnel launcher
    B(0.22, 0.24, 0.5, 0.2, 0.4, 0.36, armor, torso);
    for (const dx of [-0.05, 0.05]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6).rotateX(PI / 2), dark, 0.2 + dx, 0.42, 0.78, torso);
    gun(c, torso, 0.2, 0.32, 0.6, 0.6, 0.1);
    c.height = 2.3;
  },

  baron(c) {
    const { B, bodyMat, dark } = c;
    const coat = mat(0xb0306a), scarf = mat(0x2ac0b0), gold = mat(0xe8c030);
    const mine = mat(0xffd040, { emissive: 0xffa020, emissiveIntensity: 1.6 });
    const torso = fallenBody(c, 0.95, 1.0, 0.3, dark, gold);
    B(0.36, 0.22, 0.06, 0, 0.5, 0.15, scarf, torso);
    fallenHead(c, torso, 0.82, 0.08, mat(0x6f716a));
    // hood and scarf
    cone(c, 0.24, 0.5, 5, coat, 0, 0.92, -0.04, torso);
    B(0.4, 0.1, 0.3, 0, 0.66, 0.02, scarf, torso);
    B(0.08, 0.5, 0.02, 0.1, 0.4, 0.18, scarf, torso, false, [0, 0, 0.1]);
    // long tattered coat
    B(0.52, 1.3, 0.03, 0, -0.1, -0.18, coat, torso, false, [0.18, 0, 0]);
    for (const s of [-1, 1]) {
      B(0.18, 0.9, 0.03, s * 0.2, -0.25, 0.12, coat, torso, false, [-0.1, 0, s * 0.08]);
      B(0.03, 1.2, 0.3, s * 0.27, -0.12, -0.03, coat, torso, false, [0.1, 0, 0]);
      for (const dx of [-0.05, 0.05]) B(0.06, 0.18, 0.03, s * 0.2 + dx, -0.78 - (dx > 0 ? 0.06 : 0), 0.06, coat, torso);
    }
    // mine bandolier
    B(0.06, 0.62, 0.03, 0, 0.42, 0.17, gold, torso, false, [0, 0, 0.75]);
    for (let i = 0; i < 4; i++) cyl(c, 0.04, 0.04, 0.04, 6, mine, -0.16 + i * 0.105, 0.24 + i * 0.1, 0.19, torso, false, [PI / 2, 0, 0]);
    fallenArms(c, torso, 0.95, bodyMat);
    // twin weapons
    gun(c, torso, -0.18, 0.4, 0.42, 0.45, 0.07);
    gun(c, torso, 0.18, 0.4, 0.42, 0.45, 0.07);
    c.height = 2.1;
  },

  mindbender(c) {
    const { B, bodyMat, dark } = c;
    const armor = mat(0x6f716a), chitin = mat(0x2a2a24);
    const growth = mat(0x4f7a2a, { emissive: 0x6aff3a, emissiveIntensity: 0.9 });
    const green = mat(0x9cff6a, { emissive: 0x6aff3a, emissiveIntensity: 2.4 });
    const robeM = mat(0x3c4a3a);
    const torso = fallenBody(c, 1.1, 0.95, 0.22, dark, armor);
    B(0.4, 0.2, 0.06, 0, 0.5, 0.15, armor, torso);
    fallenHead(c, torso, 0.82, 0.07, armor);
    cone(c, 0.3, 0.42, 5, robeM, 0, 0.82, -0.05, torso);
    B(0.55, 0.95, 0.03, 0, 0.2, -0.18, robeM, torso, false, [0.15, 0, 0]);
    // Hive-tainted growths and chitin over the armour
    ico(c, 0.13, 0, growth, -0.22, 0.68, 0.02, torso);
    ico(c, 0.1, 0, growth, 0.2, 0.62, 0.1, torso);
    ico(c, 0.16, 0, growth, 0.06, 0.5, -0.2, torso);
    ico(c, 0.08, 0, growth, -0.1, 0.96, -0.04, torso, true);
    ico(c, 0.06, 0, growth, 0.12, 0.2, 0.12, torso);
    for (let i = 0; i < 4; i++) cone(c, 0.035, 0.3 + i * 0.05, 4, chitin, -0.15 + i * 0.1, 0.78, -0.18, torso, false, [-0.6, 0, 0.3 - i * 0.2]);
    for (const s of [-1, 1]) {
      B(0.24, 0.12, 0.3, s * 0.32, 0.68, 0, chitin, torso, false, [0, 0, s * -0.3]);
      cone(c, 0.04, 0.24, 4, growth, s * 0.36, 0.8, 0, torso, false, [0, 0, s * -0.5]);
    }
    B(0.2, 0.03, 0.03, 0, 0.32, 0.16, green, torso);
    fallenArms(c, torso, 1.1, bodyMat);
    // ritual staff with a Hive totem
    B(0.045, 2.0, 0.045, 0.4, 0.05, 0.3, chitin, torso);
    B(0.4, 0.04, 0.04, 0.4, 0.9, 0.3, chitin, torso);
    for (const dx of [-0.16, 0.16]) B(0.04, 0.16, 0.04, 0.4 + dx, 0.8, 0.3, growth, torso);
    ico(c, 0.11, 0, green, 0.4, 1.12, 0.3, torso);
    for (const s of [-1, 1]) cone(c, 0.025, 0.25, 4, chitin, 0.4 + s * 0.08, 1.2, 0.3, torso, false, [0, 0, s * 0.4]);
    c.muzzle.position.set(0.4, 1.12, 0.45);
    torso.add(c.muzzle);
    c.height = 2.2;
  },

  fanatic(c) {
    const { B, bodyMat, dark } = c;
    const bone = mat(0xbfb59a), rag = mat(0x4a4038), wrap = mat(0x6a5a48);
    const ether = mat(0x8fe8ff, { emissive: 0x3fc8ff, emissiveIntensity: 2.4 });
    legs(c, 0.95, 0.12, 0.09, dark, dark, true);
    const torso = c.pivot(0, 0.95, 0);
    torso.rotation.x = 0.38;
    c.torso = torso;
    B(0.2, 0.24, 0.16, 0, 0.12, 0, dark, torso);
    B(0.34, 0.4, 0.22, 0, 0.45, 0, bodyMat, torso);
    for (let i = 0; i < 3; i++) B(0.36, 0.025, 0.2, 0, 0.36 + i * 0.09, 0.02, bone, torso);
    // ether veins
    B(0.03, 0.34, 0.02, -0.08, 0.45, 0.12, ether, torso, false, [0, 0, 0.3]);
    B(0.03, 0.3, 0.02, 0.09, 0.42, 0.12, ether, torso, false, [0, 0, -0.4]);
    // gaunt head with glowing eyes
    B(0.18, 0.18, 0.22, 0, 0.8, 0.07, bone, torso, true);
    B(0.12, 0.08, 0.1, 0, 0.7, 0.16, bone, torso, true);
    for (const s of [-1, 1]) B(0.05, 0.035, 0.03, s * 0.05, 0.82, 0.19, ether, torso, true);
    // antler bone crown
    for (const s of [-1, 1]) {
      const p = c.pivot(s * 0.08, 0.88, 0, torso);
      p.rotation.set(-0.2, 0, s * -0.55);
      B(0.04, 0.6, 0.04, 0, 0.3, 0, bone, p, true);
      cone(c, 0.025, 0.28, 4, bone, s * 0.1, 0.42, 0, p, true, [0, 0, s * -0.9]);
      cone(c, 0.02, 0.22, 4, bone, s * -0.07, 0.56, 0, p, true, [0, 0, s * 0.7]);
      cone(c, 0.02, 0.2, 4, bone, 0, 0.66, 0.06, p, true, [0.5, 0, 0]);
    }
    // ragged cloth
    B(0.45, 0.2, 0.3, 0, 0.66, -0.02, rag, torso);
    for (let i = 0; i < 4; i++) B(0.1, 0.5 + (i % 2) * 0.25, 0.02, -0.15 + i * 0.1, 0.1 - (i % 2) * 0.12, -0.13, rag, torso, false, [0.15, 0, (i - 1.5) * 0.08]);
    for (const s of [-1, 1]) B(0.12, 0.6, 0.02, s * 0.1, -0.15, 0.12, wrap, torso, false, [-0.1, 0, s * 0.1]);
    // arms: two long, two small, ether-streaked
    const up = [arm(c, torso, -0.22, 0.62, 0.6, 0.07, bodyMat, -1.2, 0.12), arm(c, torso, 0.22, 0.62, 0.6, 0.07, bodyMat, -1.2, -0.12)];
    for (const a of up) B(0.025, 0.3, 0.02, 0, -0.32, 0.04, ether, a);
    arm(c, torso, -0.17, 0.36, 0.34, 0.05, bodyMat, -0.8, 0.35);
    arm(c, torso, 0.17, 0.36, 0.34, 0.05, bodyMat, -0.8, -0.35);
    c.arms.push(...up);
    // ether lantern hanging at the side, canister on the back
    B(0.02, 0.2, 0.02, -0.32, 0.3, 0.2, dark, torso);
    cyl(c, 0.08, 0.08, 0.04, 6, dark, -0.32, 0.2, 0.2, torso);
    ico(c, 0.075, 0, ether, -0.32, 0.12, 0.2, torso);
    cyl(c, 0.06, 0.08, 0.04, 6, dark, -0.32, 0.03, 0.2, torso);
    cyl(c, 0.09, 0.09, 0.4, 6, dark, 0, 0.45, -0.2, torso);
    B(0.06, 0.3, 0.02, 0, 0.45, -0.3, ether, torso);
    gun(c, torso, 0.16, 0.42, 0.4, 0.5, 0.07);
    c.height = 2.3;
  },

  // -------------------------------------------------------------------------
  // HIVE
  // -------------------------------------------------------------------------
  knight(c) {
    const { B, add, bodyMat, dark, accent } = c;
    const chitin = mat(0x2a2a24), cloth = mat(0x4a4436);
    const { torso } = hiveKnight(c, 1.3, 0.95, chitin);
    // ridged helmet
    for (const x of [-0.09, 0, 0.09]) B(0.04, 0.14, 0.36, x, 1.09 + (x === 0 ? 0.04 : 0), 0.02, bodyMat, torso, true);
    for (const s of [-1, 1]) B(0.04, 0.22, 0.26, s * 0.16, 0.9, 0.05, bodyMat, torso, true);
    for (const s of [-1, 1]) cone(c, 0.05, 0.3, 4, bodyMat, s * 0.48, 0.86, -0.02, torso, false, [0, 0, s * -0.6]);
    B(0.26, 0.6, 0.02, 0, -0.15, 0.18, cloth, torso);
    B(0.2, 0.2, 0.04, 0, 0.55, 0.19, accent, torso);
    // boomer cannon
    B(0.24, 0.28, 0.4, 0.28, 0.4, 0.3, chitin, torso);
    add(new THREE.CylinderGeometry(0.11, 0.13, 0.5, 7).rotateX(PI / 2), dark, 0.28, 0.42, 0.7, torso);
    add(new THREE.TorusGeometry(0.12, 0.03, 4, 8), accent, 0.28, 0.42, 0.95, torso);
    B(0.06, 0.06, 0.4, 0.28, 0.58, 0.45, accent, torso);
    c.muzzle.position.set(0.28, 0.42, 0.98);
    torso.add(c.muzzle);
    c.height = 2.2;
  },

  swordbearer(c) {
    const { B, bodyMat, accent } = c;
    const chitin = mat(0x2a2a24), cloak = mat(0x3a3428);
    const blade = mat(0xb6ff8a, { emissive: 0x6aff3a, emissiveIntensity: 2.2 }), hilt = mat(0x5a5040);
    const { torso, arms } = hiveKnight(c, 1.25, 0.95, chitin);
    // horned helmet
    for (const s of [-1, 1]) cone(c, 0.05, 0.4, 4, bodyMat, s * 0.12, 1.14, -0.02, torso, true, [-0.3, 0, s * -0.35]);
    cone(c, 0.04, 0.3, 4, bodyMat, 0, 1.15, 0.02, torso, true);
    // spiked shoulders
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) cone(c, 0.05, 0.36 - i * 0.06, 4, bodyMat, s * (0.36 + i * 0.08), 0.86 - i * 0.04, -0.06 + i * 0.06, torso, false, [-0.2, 0, s * -0.4]);
    // cloak
    B(0.7, 1.5, 0.04, 0, -0.05, -0.24, cloak, torso, false, [0.15, 0, 0]);
    for (const x of [-0.25, 0, 0.25]) B(0.16, 0.25, 0.03, x, -0.88 + (x === 0 ? -0.05 : 0), -0.36, cloak, torso, false, [0.15, 0, 0]);
    B(0.6, 0.18, 0.16, 0, 0.74, -0.16, cloak, torso);
    B(0.2, 0.2, 0.04, 0, 0.55, 0.19, accent, torso);
    // huge glowing sword in the right hand
    sword(c, arms[1], 1.3, 0.6, 0.14, blade, hilt);
    c.muzzle.position.set(0, 0.6, 0.4);
    torso.add(c.muzzle);
    c.height = 2.3;
  },

  crota(c) {
    const { B, bodyMat, dark, accent } = c;
    const chitin = mat(0x1e1e1a), cape = mat(0x2e2a22), bone = mat(0x9a9480);
    const blade = mat(0xa8ff7a, { emissive: 0x4aff2a, emissiveIntensity: 2.8 }), hilt = mat(0x3a3428);
    const { torso, arms } = hiveKnight(c, 1.55, 1.2, chitin);
    torso.scale.setScalar(1.15);
    // layered chest armour and knee spikes
    B(0.7, 0.14, 0.1, 0, 0.72, 0.18, bone, torso);
    B(0.16, 0.3, 0.05, 0, 0.3, 0.2, accent, torso);
    for (const s of [-1, 1]) cone(c, 0.06, 0.3, 4, bone, s * 0.26, 0.66, 0.18, undefined, false, [0.9, 0, 0]);
    // crown of tall spines
    for (let i = -3; i <= 3; i++) {
      const h = 0.35 + (3 - Math.abs(i)) * 0.16;
      cone(c, 0.035, h, 4, bone, i * 0.05, 1.06 + h / 2, -0.04, torso, true, [-0.15, 0, -i * 0.16]);
    }
    for (const s of [-1, 1]) B(0.04, 0.2, 0.3, s * 0.15, 0.92, 0.05, bone, torso, true);
    B(0.06, 0.06, 0.04, 0, 1.0, 0.21, accent, torso, true);
    // massive spiked pauldrons
    for (const s of [-1, 1]) {
      B(0.38, 0.2, 0.46, s * 0.58, 0.84, 0, bone, torso, false, [0, 0, s * -0.3]);
      for (let i = 0; i < 3; i++) cone(c, 0.06, 0.5 - i * 0.1, 4, bone, s * (0.5 + i * 0.12), 1.0 - i * 0.04, -0.08 + i * 0.07, torso, false, [-0.25, 0, s * -0.35]);
    }
    // flowing tattered cape
    B(1.0, 0.24, 0.2, 0, 0.82, -0.18, cape, torso);
    for (let i = 0; i < 6; i++) {
      const L = 1.5 + ((i * 3) % 4) * 0.15;
      B(0.19, L, 0.03, -0.48 + i * 0.19, 0.75 - L / 2, -0.28 - L * 0.08, cape, torso, false, [0.17, 0, (i - 2.5) * 0.04]);
    }
    for (const s of [-1, 1]) B(0.04, 0.5, 0.04, s * 0.12, -0.25, 0.2, dark, torso);
    // enormous glowing sword
    sword(c, arms[1], 2.0, 0.6, 0.2, blade, hilt);
    c.muzzle.position.set(0, 0.6, 0.4);
    torso.add(c.muzzle);
    c.height = 3.0;
  },

  wizard(c) {
    const { B, bodyMat, dark, accent } = c;
    const chitin = mat(0x2a2a24), robeM = mat(0x2e3a2a), rag = mat(0x3a4a32);
    legs(c, 1.0, 0.1, 0.08, chitin, chitin, true);
    robe(c, 0.2, 0.5, 0.75, robeM, 8, rag);
    const torso = c.pivot(0, 1.0, 0);
    torso.rotation.x = 0.06;
    c.torso = torso;
    B(0.26, 0.26, 0.2, 0, 0.12, 0, robeM, torso);
    B(0.4, 0.42, 0.26, 0, 0.46, 0, bodyMat, torso);
    for (let i = 0; i < 3; i++) B(0.34, 0.03, 0.04, 0, 0.34 + i * 0.1, 0.14, chitin, torso);
    B(0.12, 0.12, 0.04, 0, 0.5, 0.15, accent, torso);
    // head with a horned crown
    c.add(new THREE.IcosahedronGeometry(0.14, 0), chitin, 0, 0.84, 0.04, torso, true).scale.set(1, 1.2, 1.15);
    B(0.15, 0.035, 0.04, 0, 0.84, 0.19, accent, torso, true);
    for (const s of [-1, 1]) {
      const h = c.pivot(s * 0.1, 0.94, -0.02, torso);
      h.rotation.set(-0.3, 0, s * -0.7);
      cone(c, 0.045, 0.32, 4, bodyMat, 0, 0.16, 0, h, true);
      cone(c, 0.03, 0.26, 4, bodyMat, s * -0.06, 0.38, 0, h, true, [0, 0, s * 0.6]);
    }
    for (let i = -1; i <= 1; i++) cone(c, 0.03, 0.3 - Math.abs(i) * 0.06, 4, bodyMat, i * 0.06, 1.04, -0.06, torso, true, [-0.4, 0, -i * 0.3]);
    // high collar and shoulder mantle
    B(0.56, 0.12, 0.3, 0, 0.66, -0.02, robeM, torso);
    B(0.46, 0.3, 0.03, 0, 0.82, -0.14, robeM, torso, false, [-0.2, 0, 0]);
    // long sleeves and glowing hands
    const arms = [arm(c, torso, -0.26, 0.62, 0.55, 0.07, bodyMat, -1.25, 0.15), arm(c, torso, 0.26, 0.62, 0.55, 0.07, bodyMat, -1.25, -0.15)];
    for (const a of arms) {
      cone(c, 0.13, 0.55, 6, robeM, 0, -0.3, 0, a);
      for (let i = 0; i < 2; i++) B(0.06, 0.25, 0.02, (i - 0.5) * 0.1, -0.65, -0.1, rag, a);
      ico(c, 0.07, 0, accent, 0, -0.6, 0, a);
    }
    c.arms.push(...arms);
    // trailing robe behind
    for (let i = 0; i < 3; i++) B(0.18, 0.9 + i * 0.15, 0.03, -0.18 + i * 0.18, -0.25 - i * 0.07, -0.2, rag, torso, false, [0.25, 0, 0]);
    c.muzzle.position.set(0, 0.46, 0.5);
    torso.add(c.muzzle);
    c.height = 2.2;
  },

  broodwizard(c) {
    const { B, bodyMat, accent } = c;
    const chitin = mat(0x26281c), robeM = mat(0x3a3a24), rag = mat(0x4a4a2a);
    const sac = mat(0xc8c26a, { emissive: 0x9ab030, emissiveIntensity: 0.8 });
    const sick = mat(0xd8ff5a, { emissive: 0xb0e030, emissiveIntensity: 2.4 });
    legs(c, 0.95, 0.15, 0.12, chitin, chitin, true);
    robe(c, 0.35, 0.68, 0.7, robeM, 7, rag);
    const torso = c.pivot(0, 0.95, 0);
    torso.rotation.x = 0.22;
    c.torso = torso;
    B(0.44, 0.28, 0.32, 0, 0.12, 0, robeM, torso);
    B(0.66, 0.5, 0.42, 0, 0.5, 0, bodyMat, torso);
    ico(c, 0.2, 0, chitin, 0, 0.36, 0.14, torso);
    B(0.16, 0.16, 0.04, 0, 0.55, 0.22, sick, torso);
    // hunched head and crown of chitin spikes
    c.add(new THREE.IcosahedronGeometry(0.16, 0), chitin, 0, 0.86, 0.12, torso, true).scale.set(1.1, 1, 1.2);
    for (const s of [-1, 1]) B(0.05, 0.04, 0.04, s * 0.05, 0.86, 0.3, sick, torso, true);
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + i * 0.3;
      cone(c, 0.035, 0.28 + (i % 2) * 0.12, 4, chitin, Math.sin(a) * 0.18, 1.0, 0.08 - Math.cos(a) * 0.08, torso, true, [-0.4, 0, -a * 0.8]);
    }
    // humped shoulders
    for (const s of [-1, 1]) {
      ico(c, 0.2, 0, chitin, s * 0.36, 0.76, -0.04, torso);
      cone(c, 0.05, 0.3, 4, bodyMat, s * 0.4, 0.96, -0.08, torso, false, [0, 0, s * -0.4]);
    }
    // egg sacs clustered on the back
    for (const [x, y, z, r] of [[-0.16, 0.7, -0.3, 0.17], [0.15, 0.62, -0.32, 0.15], [0, 0.4, -0.32, 0.19], [-0.24, 0.32, -0.26, 0.12], [0.24, 0.3, -0.26, 0.13], [0.04, 0.85, -0.22, 0.11]]) {
      c.add(new THREE.IcosahedronGeometry(r, 1), sac, x, y, z, torso);
    }
    // bulky sleeves with sickly glowing hands
    const arms = [arm(c, torso, -0.38, 0.62, 0.55, 0.1, bodyMat, -1.2, 0.15), arm(c, torso, 0.38, 0.62, 0.55, 0.1, bodyMat, -1.2, -0.15)];
    for (const a of arms) {
      cone(c, 0.17, 0.5, 6, robeM, 0, -0.28, 0, a);
      ico(c, 0.09, 0, sick, 0, -0.6, 0, a);
    }
    c.arms.push(...arms);
    B(0.12, 0.12, 0.04, 0, 0.6, 0.25, accent, torso);
    c.muzzle.position.set(0, 0.5, 0.55);
    torso.add(c.muzzle);
    c.height = 2.15;
  },

  shrieker(c) {
    const { add, B, pivot, bodyMat, dark, accent } = c;
    const chitin = mat(0x2a2a24), crystal = mat(0x1c2a20, { emissive: 0x1a4a20, emissiveIntensity: 0.6 });
    c.hover = true;
    const body = pivot(0, 1.25, 0);
    c.torso = body;
    // tall faceted crystal body
    const core = add(new THREE.OctahedronGeometry(0.7, 0), crystal, 0, 0, 0, body);
    core.scale.y = 1.6;
    core.rotation.y = PI / 4;
    // central eye
    add(new THREE.TorusGeometry(0.26, 0.05, 4, 10), bodyMat, 0, 0, 0.5, body, true);
    add(new THREE.SphereGeometry(0.24, 10, 8), accent, 0, 0, 0.45, body, true).scale.z = 0.7;
    for (const s of [-1, 1]) B(0.36, 0.04, 0.05, 0, s * 0.3, 0.42, chitin, body, false, [0, 0, 0]);
    // chitin ribs along the vertical edges
    for (let k = 0; k < 4; k++) {
      const a = PI / 4 + k * (PI / 2);
      for (const s of [1, -1]) {
        B(0.07, 1.36, 0.07, Math.cos(a) * 0.38, s * 0.58, -Math.sin(a) * 0.38, chitin, body, false, [0, a, s * 0.56]);
      }
      cone(c, 0.05, 0.3, 4, bodyMat, Math.cos(a) * 0.78, 0, -Math.sin(a) * 0.78, body, false, [0, a, -PI / 2]);
    }
    // tip spikes and a halo of shards
    cone(c, 0.08, 0.5, 4, bodyMat, 0, 1.3, 0, body);
    cone(c, 0.08, 0.4, 4, bodyMat, 0, -1.25, 0, body, false, [PI, 0, 0]);
    add(new THREE.TorusGeometry(0.95, 0.03, 4, 16), dark, 0, 0.55, 0, body, false, [PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + 0.3;
      add(new THREE.OctahedronGeometry(0.09, 0), accent, Math.cos(a) * 0.95, 0.55, Math.sin(a) * 0.95, body);
    }
    c.muzzle.position.set(0, 0, 0.72);
    body.add(c.muzzle);
    c.height = 2.6;
  },

  // -------------------------------------------------------------------------
  // CABAL
  // -------------------------------------------------------------------------
  valus(c) {
    const { B, add, bodyMat, dark, accent } = c;
    const W = 1.7;
    const metal = mat(0x4a4440), red = mat(c.C.accent), gold = mat(0xb08a3a);
    const torso = cabalBody(c, W, 0.9, metal);
    B(0.66 * W, 0.12, 0.46, 0, 0.78, 0, gold, torso);
    // crested helmet
    B(0.05, 0.24, 0.52, 0, 1.15, -0.02, red, torso, true);
    for (const s of [-1, 1]) B(0.04, 0.1, 0.3, s * 0.17, 1.0, 0.02, gold, torso, true);
    // heavy layered pauldrons
    for (const s of [-1, 1]) {
      B(0.34 * W, 0.22, 0.5, s * 0.44 * W, 0.78, 0, bodyMat, torso, false, [0, 0, s * -0.18]);
      B(0.3 * W, 0.12, 0.44, s * 0.48 * W, 0.62, 0, metal, torso, false, [0, 0, s * -0.3]);
      B(0.32 * W, 0.04, 0.06, s * 0.44 * W, 0.8, 0.25, gold, torso, false, [0, 0, s * -0.18]);
    }
    // cape
    B(0.8, 1.35, 0.04, 0, 0.1, -0.3, red, torso, false, [0.12, 0, 0]);
    // jump pack
    B(0.6, 0.5, 0.24, 0, 0.55, -0.42, metal, torso);
    for (const s of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.11, 0.13, 0.5, 8), dark, s * 0.24, 0.48, -0.56, torso);
      add(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 8), accent, s * 0.24, 0.21, -0.56, torso);
    }
    // slug rifle
    B(0.2, 0.26, 0.4, 0.3, 0.4, 0.32, metal, torso);
    gun(c, torso, 0.3, 0.44, 0.75, 0.75, 0.13);
    c.height = 2.45;
  },

  bracus(c) {
    const { B, bodyMat, dark, accent } = c;
    const W = 1.6;
    const metal = mat(0x4a4440), bronze = mat(0x8a6a3a), red = mat(c.C.accent);
    const torso = cabalBody(c, W, 0.9, metal);
    // horned helmet
    for (const s of [-1, 1]) {
      cone(c, 0.06, 0.4, 5, bronze, s * 0.24, 1.08, -0.02, torso, true, [0, 0, s * -1.0]);
      cone(c, 0.045, 0.24, 5, bronze, s * 0.36, 1.26, -0.04, torso, true, [-0.2, 0, s * -0.1]);
    }
    for (const s of [-1, 1]) {
      B(0.32 * W, 0.22, 0.46, s * 0.44 * W, 0.76, 0, bodyMat, torso, false, [0, 0, s * -0.15]);
      B(0.08, 0.6, 0.04, s * 0.3, 0.15, 0.2, red, torso);
    }
    // Phalanx tower shield on the left
    B(0.85, 1.35, 0.1, -0.5, 0.15, 0.62, metal, torso);
    B(0.95, 0.1, 0.14, -0.5, 0.82, 0.62, bronze, torso);
    B(0.95, 0.1, 0.14, -0.5, -0.52, 0.62, bronze, torso);
    for (const s of [-1, 1]) B(0.08, 1.35, 0.14, -0.5 + s * 0.44, 0.15, 0.62, bronze, torso);
    B(0.5, 0.05, 0.04, -0.5, 0.6, 0.69, accent, torso);
    B(0.16, 0.5, 0.04, -0.5, 0.15, 0.69, bronze, torso);
    B(0.12, 0.12, 0.3, -0.5, 0.3, 0.46, dark, torso);
    // jetpack
    for (const s of [-1, 1]) cyl(c, 0.1, 0.12, 0.44, 8, metal, s * 0.18, 0.5, -0.32, torso);
    // hand cannon on the right
    B(0.18, 0.24, 0.24, 0.34, 0.36, 0.38, metal, torso);
    gun(c, torso, 0.34, 0.42, 0.66, 0.45, 0.15);
    c.height = 2.4;
  },

  ghaul(c) {
    const { B, bodyMat, dark } = c;
    const W = 1.4;
    const metal = mat(0x3a3530), gold = mat(0xb89a5a);
    const light = mat(0xfff4d0, { emissive: 0xffd36a, emissiveIntensity: 2.8 });
    const capeM = mat(0x2a2420);
    const torso = cabalBody(c, W, 1.1, metal);
    // Light bleeding through the armour seams
    B(0.04, 0.46, 0.04, 0, 0.5, 0.235, light, torso);
    for (const y of [0.34, 0.6]) B(0.56 * W, 0.03, 0.03, 0, y, 0.225, light, torso);
    for (const s of [-1, 1]) {
      B(0.03, 0.3, 0.03, s * 0.2, 0.15, 0.17, light, torso);
      B(0.03, 0.4, 0.03, s * 0.17 * W, 0.7, 0.18, light);
    }
    // tall horned crown-helmet
    B(0.3, 0.2, 0.28, 0, 1.15, 0.0, bodyMat, torso, true);
    B(0.04, 0.5, 0.04, 0, 1.4, -0.04, gold, torso, true);
    for (const s of [-1, 1]) {
      cone(c, 0.07, 0.75, 4, gold, s * 0.2, 1.42, -0.12, torso, true, [-0.45, 0, s * -0.32]);
      cone(c, 0.05, 0.45, 4, gold, s * 0.13, 1.3, 0.02, torso, true, [-0.2, 0, s * -0.12]);
      B(0.03, 0.18, 0.03, s * 0.08, 1.12, 0.15, light, torso, true);
    }
    // sweeping pauldrons
    for (const s of [-1, 1]) {
      B(0.3 * W, 0.18, 0.48, s * 0.44 * W, 0.8, 0, bodyMat, torso, false, [0, 0, s * -0.22]);
      B(0.3 * W, 0.03, 0.04, s * 0.44 * W, 0.78, 0.25, light, torso, false, [0, 0, s * -0.22]);
      cone(c, 0.06, 0.4, 4, gold, s * 0.54 * W, 0.96, -0.08, torso, false, [0, 0, s * -0.7]);
    }
    // long cape to the ground
    B(0.85, 0.2, 0.2, 0, 0.82, -0.22, capeM, torso);
    B(0.95, 1.95, 0.04, 0, -0.18, -0.3, capeM, torso, false, [0.1, 0, 0]);
    B(0.95, 0.05, 0.05, 0, -1.12, -0.4, gold, torso, false, [0.1, 0, 0]);
    // orb of stolen Light held at the right hand
    ico(c, 0.13, 1, light, 0.4, 0.38, 0.6, torso);
    c.muzzle.position.set(0.4, 0.38, 0.75);
    torso.add(c.muzzle);
    c.height = 2.9;
  },

  // -------------------------------------------------------------------------
  // IO: Taken, Psions and the Vex
  // -------------------------------------------------------------------------
  takencaptain(c) {
    const { B, add } = c;
    // Taken are pure black silhouettes outlined in white Light, with blazing white eyes
    const black = mat(0x0a0a0e), edge = mat(0xf4f6ff, { emissive: 0xdfe6ff, emissiveIntensity: 2.6 });
    const eye = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 3.2 });
    legs(c, 1.05, 0.17, 0.14, black, black, true);
    const torso = c.pivot(0, 1.05, 0);
    torso.rotation.x = 0.12;
    c.torso = torso;
    B(0.62, 0.62, 0.42, 0, 0.42, 0, black, torso);
    for (const y of [0.13, 0.73]) B(0.66, 0.03, 0.46, 0, y, 0, edge, torso);
    // captain's cape, shredded into floating Taken strips
    for (let i = 0; i < 5; i++) B(0.13, 1.0 - (i % 2) * 0.25, 0.03, -0.3 + i * 0.15, -0.05, -0.26, black, torso, false, [0.22, 0, (i - 2) * 0.06]);
    // tall hood-crest
    B(0.32, 0.26, 0.34, 0, 0.92, 0.04, black, torso, true);
    B(0.05, 0.42, 0.42, 0, 1.18, -0.04, black, torso, true, [-0.35, 0, 0]);
    B(0.03, 0.42, 0.03, 0, 1.18, 0.18, edge, torso, true, [-0.35, 0, 0]);
    // four blank white eyes
    for (const x of [-0.08, 0.08]) for (const y of [0.9, 0.97]) add(new THREE.SphereGeometry(0.035, 6, 5), eye, x, y, 0.22, torso, true);
    // four arms, the upper pair raised, each edged in white
    const arms = [];
    for (const [y, lift, len] of [[0.66, -1.5, 0.62], [0.36, -0.9, 0.5]]) for (const s of [-1, 1]) {
      const a = arm(c, torso, s * 0.36, y, len, 0.09, black, lift, s * -0.2);
      B(0.02, len, 0.02, s * 0.05, -len / 2, 0.05, edge, a);
      arms.push(a);
    }
    c.arms.push(...arms);
    // Taken blight orbs drifting around it
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2;
      ico(c, 0.11, 0, black, Math.cos(a) * 0.62, 0.3 + (i % 2) * 0.5, Math.sin(a) * 0.4, torso);
      ico(c, 0.04, 0, edge, Math.cos(a) * 0.62, 0.3 + (i % 2) * 0.5, Math.sin(a) * 0.4 + 0.1, torso);
    }
    // shrapnel launcher in the lower right hand
    gun(c, torso, 0.36, 0.3, 0.42, 0.55, 0.12);
    c.height = 2.4;
  },

  psionflayer(c) {
    const { B, add, bodyMat, dark, accent } = c;
    // the Flayers fight as a trio: a lead Psion with two kneeling-air twins welded to its Light
    const suit = mat(0x6a2a24), gold = mat(0xb08a3a);
    const psi = mat(0xff9a6a, { emissive: 0xff5a2a, emissiveIntensity: 2.2 });
    const psion = (parent, x, z, s) => {
      const p = c.pivot(x, 0, z, parent);
      p.scale.setScalar(s);
      p.userData.hips = [-1, 1].map((k) => {
        const hip = c.pivot(k * 0.09, 0.95, 0, p);
        B(0.09, 0.45, 0.1, 0, -0.23, 0.02, suit, hip);
        B(0.09, 0.5, 0.1, 0, -0.7, 0, dark, hip);
        return hip;
      });
      B(0.32, 0.4, 0.2, 0, 1.12, 0, suit, p);
      B(0.36, 0.08, 0.24, 0, 1.3, 0, gold, p);
      // the big bulbous Psion head with its single slit visor
      add(new THREE.SphereGeometry(0.2, 8, 6), bodyMat, 0, 1.55, 0.02, p, true).scale.set(1, 1.15, 1.2);
      B(0.22, 0.04, 0.04, 0, 1.56, 0.24, psi, p, true);
      for (const k of [-1, 1]) B(0.06, 0.5, 0.06, k * 0.22, 1.05, 0.12, suit, p, false, [-0.9, 0, k * -0.2]);
      ico(c, 0.07, 0, psi, 0, 1.18, 0.42, p);
      return p;
    };
    const lead = psion(c.g, 0, 0, 1.15);
    c.torso = lead;
    // the two twins hover behind on psionic Light
    for (const s of [-1, 1]) {
      const t = psion(c.g, s * 0.75, -0.45, 0.85);
      t.position.y = 0.35;
      t.rotation.y = s * -0.3;
      add(new THREE.TorusGeometry(0.22, 0.03, 4, 12), psi, 0, 0.02, 0, t, false, [PI / 2, 0, 0]);
    }
    // psionic links between the three heads
    for (const s of [-1, 1]) B(0.03, 0.03, 0.85, s * 0.38, 1.95, -0.22, psi, c.g, false, [0, s * 1.0, 0]);
    // legs list lets the walk cycle swing the lead's thighs
    c.legs.push(...lead.userData.hips);
    c.muzzle.position.set(0, 1.18, 0.55);
    lead.add(c.muzzle);
    c.height = 2.2;
  },

  vexmind(c) {
    const { B, add, dark } = c;
    // Protheon, Modular Mind: a floating brass frame around a milky core and one red eye
    const brass = mat(0x9a7a4a), bronze = mat(0x5a4632), white = mat(0xe8e4d8);
    const milk = mat(0xf2f6ff, { emissive: 0xcfe0ff, emissiveIntensity: 1.6 });
    const red = mat(0xff3a2a, { emissive: 0xff2a1a, emissiveIntensity: 3 });
    c.hover = true;
    const body = c.pivot(0, 1.35, 0);
    c.torso = body;
    // hexagonal head-plate standing upright, eye at the center
    add(new THREE.CylinderGeometry(0.85, 0.85, 0.22, 6).rotateX(PI / 2), brass, 0, 0.25, 0, body);
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.26, 6).rotateX(PI / 2), bronze, 0, 0.25, 0.04, body);
    add(new THREE.SphereGeometry(0.22, 10, 8), red, 0, 0.25, 0.2, body, true).scale.z = 0.5;
    add(new THREE.TorusGeometry(0.3, 0.04, 4, 6), brass, 0, 0.25, 0.2, body, true);
    // milky radiolaria core hanging below the plate
    ico(c, 0.42, 1, milk, 0, -0.5, -0.05, body);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      B(0.08, 0.7, 0.08, Math.cos(a) * 0.5, -0.3, Math.sin(a) * 0.3 - 0.05, white, body, false, [Math.sin(a) * 0.3, 0, Math.cos(a) * -0.3]);
    }
    // modular blocks orbiting the frame (Protheon splits and rebuilds itself)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      B(0.24, 0.24, 0.24, Math.cos(a) * 1.15, 0.25 + Math.sin(a) * 1.15, -0.1, i % 2 ? brass : white, body, false, [a, a, 0]);
    }
    // backplate spines
    for (const s of [-1, 0, 1]) B(0.1, 1.1, 0.1, s * 0.4, 0.4, -0.2, bronze, body, false, [0, 0, s * -0.4]);
    B(0.5, 0.06, 0.06, 0, -0.95, -0.05, dark, body);
    c.muzzle.position.set(0, 0.25, 0.4);
    body.add(c.muzzle);
    c.height = 2.6;
  },

  // -------------------------------------------------------------------------
  // U15: Dreaming City and Leviathan story bosses
  // -------------------------------------------------------------------------
  takenchampion(c) {
    const { B, add } = c;
    // An Awoken warrior eaten by the Taken: slender, long coat, cracked blue-grey skin under black ooze
    const black = mat(0x14131c), skin = mat(0x9fb9cc), ooze = mat(0x07070b);
    const glow = mat(0xff9a3c, { emissive: 0xff9a3c, emissiveIntensity: 2.6 });
    const eye = mat(0xdfe8ff, { emissive: 0xdfe8ff, emissiveIntensity: 3 });
    legs(c, 1.15, 0.13, 0.11, black, ooze);
    const torso = c.pivot(0, 1.15, 0);
    torso.rotation.x = 0.1;
    c.torso = torso;
    B(0.4, 0.28, 0.26, 0, 0.14, 0, black, torso);
    B(0.5, 0.58, 0.32, 0, 0.55, 0, black, torso);
    // cracked pale skin plate on the chest, split by orange blight
    B(0.3, 0.4, 0.04, -0.06, 0.58, 0.18, skin, torso);
    B(0.04, 0.46, 0.05, 0.1, 0.56, 0.2, glow, torso, false, [0, 0, 0.35]);
    B(0.16, 0.03, 0.05, 0.0, 0.62, 0.2, glow, torso, false, [0, 0, -0.5]);
    // tattered long coat to the shins
    for (let i = 0; i < 6; i++) {
      const L = 1.0 + (i % 3) * 0.18;
      B(0.11, L, 0.03, -0.27 + i * 0.108, 0.0 - (L - 1.0) * 0.4 - 0.05, -0.2, black, torso, false, [0.14, 0, (i - 2.5) * 0.05]);
    }
    B(0.56, 0.12, 0.34, 0, 0.84, 0, ooze, torso);
    // head: pale Awoken face under a blight crown
    B(0.22, 0.26, 0.24, 0, 1.0, 0.04, skin, torso, true);
    B(0.24, 0.1, 0.26, 0, 1.09, 0.02, ooze, torso, true);
    for (const x of [-0.055, 0.055]) add(new THREE.SphereGeometry(0.03, 6, 5), eye, x, 1.0, 0.165, torso, true);
    B(0.03, 0.1, 0.03, 0.0, 0.93, 0.165, glow, torso, true, [0, 0, 0.5]);
    // spiked halo of blight standing behind the head
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2;
      cone(c, 0.035, 0.34, 4, i % 3 === 0 ? glow : ooze, Math.cos(a) * 0.32, 1.1 + Math.sin(a) * 0.32, -0.16, torso, true, [0, 0, a - PI / 2]);
    }
    add(new THREE.TorusGeometry(0.32, 0.016, 4, 14), glow, 0, 1.1, -0.16, torso, true);
    // shoulder spikes
    for (const s of [-1, 1]) cone(c, 0.07, 0.4, 4, black, s * 0.34, 0.92, -0.04, torso, false, [0, 0, s * -0.9]);
    // arms: right hand carries a long blight blade, left hand trails Taken ooze
    const L = arm(c, torso, -0.32, 0.8, 0.6, 0.08, black, -1.0, 0.1);
    const R = arm(c, torso, 0.32, 0.8, 0.6, 0.08, black, -1.2, -0.1);
    B(0.1, 0.12, 0.1, 0, -0.62, 0, skin, L);
    B(0.1, 0.12, 0.1, 0, -0.62, 0, skin, R);
    c.arms.push(L, R);
    sword(c, R, 1.3, 0.62, 0.07, black, ooze);
    B(0.015, 0.03, 1.2, 0, -0.62, 0.8, glow, R);
    c.muzzle.position.set(0.32, 0.4, 0.9);
    torso.add(c.muzzle);
    c.height = 2.5;
  },

  morgeth(c) {
    const { B, add } = c;
    // A Taken Ogre: bulk, heavy shoulders, an orange-lit chest cavity and a spire of ivory stone
    const black = mat(0x14131c), ooze = mat(0x07070b), ivory = mat(0xd9d2bc);
    const glow = mat(0xff9a3c, { emissive: 0xff9a3c, emissiveIntensity: 2.6 });
    const eye = mat(0xdfe8ff, { emissive: 0xdfe8ff, emissiveIntensity: 3 });
    legs(c, 1.2, 0.3, 0.3, black, ooze);
    for (const s of [-1, 1]) B(0.4, 0.22, 0.5, s * 0.3, 0.12, 0.08, ooze);
    const torso = c.pivot(0, 1.2, 0);
    torso.rotation.x = 0.22;
    c.torso = torso;
    B(0.8, 0.36, 0.6, 0, 0.16, 0, ooze, torso);
    B(1.3, 0.8, 0.8, 0, 0.8, 0, black, torso);
    // glowing chest cavity: a ribbed hollow with a blight core
    B(0.55, 0.5, 0.06, 0, 0.8, 0.4, ooze, torso);
    B(0.34, 0.34, 0.07, 0, 0.8, 0.42, glow, torso, true);
    for (const y of [0.64, 0.8, 0.96]) B(0.62, 0.04, 0.09, 0, y, 0.44, black, torso);
    // hunched back spines
    for (const x of [-0.4, 0, 0.4]) cone(c, 0.08, 0.5, 4, ooze, x, 1.3, -0.3, torso, false, [-0.5, 0, 0]);
    // small low head sunk between the shoulders
    B(0.38, 0.34, 0.4, 0, 1.38, 0.22, black, torso, true);
    B(0.3, 0.12, 0.1, 0, 1.28, 0.44, ooze, torso, true);
    for (const x of [-0.08, 0.08]) add(new THREE.SphereGeometry(0.04, 6, 5), eye, x, 1.4, 0.43, torso, true);
    for (const s of [-1, 1]) cone(c, 0.06, 0.4, 4, ivory, s * 0.18, 1.62, 0.12, torso, true, [0.3, 0, s * -0.3]);
    // enormous pauldrons
    for (const s of [-1, 1]) {
      B(0.62, 0.34, 0.8, s * 0.88, 1.28, 0, black, torso, false, [0, 0, s * -0.25]);
      for (let k = 0; k < 3; k++) cone(c, 0.07, 0.4, 4, ooze, s * (0.78 + k * 0.17), 1.52 - k * 0.05, 0, torso, false, [0, 0, s * -0.5]);
    }
    // thick arms; right swings the spire club
    const L = arm(c, torso, -0.88, 1.12, 1.05, 0.34, black, -0.7, 0.12);
    const R = arm(c, torso, 0.88, 1.12, 1.05, 0.34, black, -1.15, -0.12);
    for (const a of [L, R]) B(0.42, 0.4, 0.42, 0, -1.1, 0, ooze, a);
    c.arms.push(L, R);
    // spire: ivory pillar, a pointed tip, wrapped in blight bands
    B(0.3, 0.3, 1.9, 0, -1.1, 1.1, ivory, R);
    cone(c, 0.2, 0.5, 4, ivory, 0, -1.1, 2.3, R, false, [PI / 2, 0, 0]);
    for (const z of [0.55, 0.95, 1.35, 1.75]) {
      B(0.36, 0.36, 0.1, 0, -1.1, z, ooze, R);
      B(0.38, 0.04, 0.12, 0, -1.1 + 0.18, z, glow, R);
    }
    c.muzzle.position.set(0.88, 0.6, 1.1);
    torso.add(c.muzzle);
    c.height = 3.4;
  },

  veshra(c) {
    const { B, add } = c;
    // Riven's brood, a young Ahamkara: low sleek quadruped, split jaw, four head plates, six eyes, no wings
    const tent = mat(0x5a2a44), hide = mat(0x2a1d2c), bone = mat(0xcdbf9c), flesh = mat(0x8a3a4a), mottle = mat(0x14101a);
    const glow = mat(0xff9a3c, { emissive: 0xff9a3c, emissiveIntensity: 2.8 });
    const gold = mat(0xffd36b, { emissive: 0xc9962a, emissiveIntensity: 1.2 });
    const eye = mat(0xffd9a0, { emissive: 0xff9a3c, emissiveIntensity: 3.2 });
    // four legs; order makes the shared walk swing trot in diagonal pairs
    for (const [x, z] of [[-0.24, 0.55], [0.24, 0.55], [-0.24, -0.5], [0.24, -0.5]]) {
      const hip = c.pivot(x, 0.62, z);
      B(0.14, 0.34, 0.16, 0, -0.14, 0.04, hide, hip, false, [-0.35, 0, 0]);
      B(0.1, 0.36, 0.12, 0, -0.44, 0.0, hide, hip, false, [0.3, 0, 0]);
      B(0.18, 0.07, 0.24, 0, -0.6, 0.08, mottle, hip);
      for (let k = -1.5; k <= 1.5; k++) cone(c, 0.018, 0.1, 3, bone, k * 0.045, -0.6, 0.23, hip, false, [PI / 2, 0, 0]);
      c.legs.push(hip);
    }
    const body = c.pivot(0, 0.72, 0);
    c.torso = body;
    B(0.62, 0.48, 1.5, 0, 0.0, 0, hide, body);
    B(0.5, 0.2, 1.3, 0, 0.3, -0.05, mottle, body);
    for (let i = 0; i < 6; i++) B(0.12 + (i % 2) * 0.06, 0.1, 0.16, ((i * 7) % 5 - 2) * 0.1, 0.27, 0.5 - i * 0.2, i % 2 ? gold : mottle, body);
    // back spines
    for (let i = 0; i < 6; i++) cone(c, 0.03, 0.18, 4, bone, 0, 0.42, 0.5 - i * 0.22, body);
    // blight heart: glowing crystal mass in the exposed chest
    B(0.42, 0.34, 0.1, 0, 0.0, 0.76, mottle, body);
    ico(c, 0.17, 0, glow, 0, 0.0, 0.8, body, true);
    for (const [x, y, r] of [[-0.12, -0.08, 0.6], [0.13, 0.1, -0.5], [0.0, 0.14, 0.2]]) cone(c, 0.05, 0.22, 4, glow, x, y, 0.84, body, true, [PI / 2 - 0.2, 0, r]);
    // neck rising to a low, forward-reaching head
    const neck = c.pivot(0, 0.12, 0.7, body);
    neck.rotation.x = -0.5;
    B(0.3, 0.3, 0.7, 0, 0, 0.3, hide, neck);
    const head = c.pivot(0, 0.04, 0.72, neck);
    head.rotation.x = 0.55;
    B(0.34, 0.24, 0.62, 0, 0, 0.12, hide, head, true);
    B(0.2, 0.14, 0.2, 0, -0.02, 0.5, hide, head, true);
    // six glowing eyes, three per side
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.028, 6, 5), eye, s * (0.17 - k * 0.01), 0.08 - k * 0.02, 0.22 + k * 0.1, head, true);
    // four bone plates folded back and slightly open, showing flesh underneath
    for (const [x, y, z, rz, len] of [[-0.22, 0.12, 0.1, 0.55, 0.52], [0.22, 0.12, 0.1, -0.55, 0.52], [-0.12, 0.17, 0.06, 0.25, 0.46], [0.12, 0.17, 0.06, -0.25, 0.46]]) {
      B(0.14, 0.04, len, x * 0.7, y - 0.03, z - 0.02, flesh, head, true, [-0.22, 0, rz]);
      B(0.14, 0.04, len, x, y + 0.02, z - 0.02, bone, head, true, [-0.3, 0, rz]);
    }
    for (const s of [-1, 1]) cone(c, 0.04, 0.34, 4, bone, s * 0.16, 0.2, -0.2, head, true, [-1.2, 0, s * 0.2]);
    // split lower jaw: two halves swung apart, rows of shark teeth
    for (const s of [-1, 1]) {
      const jaw = c.pivot(s * 0.03, -0.1, 0.3, head);
      jaw.rotation.x = 0.5;
      jaw.rotation.y = s * -0.2;
      B(0.09, 0.07, 0.56, s * 0.05, 0, 0.24, bone, jaw, true);
      for (let k = 0; k < 6; k++) cone(c, 0.018, 0.09, 3, bone, s * 0.05, 0.07, 0.05 + k * 0.09, jaw, true);
      for (let k = 0; k < 5; k++) cone(c, 0.018, 0.09, 3, bone, s * 0.05, -0.001 + 0.14, 0.2 + k * 0.07 - 0.2, head, true, [PI, 0, 0]);
    }
    // three large spined tentacles a side off the neck, smaller ones beneath
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const t = c.pivot(s * 0.14, 0.08 - k * 0.04, 0.1 + k * 0.1, neck);
      t.rotation.set(-0.7 - k * 0.2, -s * (0.9 + k * 0.35), 0);
      B(0.09, 0.09, 0.62, 0, 0, -0.31, tent, t);
      for (let j = 0; j < 4; j++) cone(c, 0.025, 0.14, 3, j % 2 ? gold : bone, 0, 0.08, -0.15 - j * 0.18, t);
      const u = c.pivot(s * 0.1, -0.12, 0.14 + k * 0.1, neck);
      u.rotation.set(-1.0, -s * (0.6 + k * 0.4), 0);
      B(0.05, 0.05, 0.4, 0, 0, -0.2, tent, u);
    }
    // long serpentine tail
    let tp = c.pivot(0, 0.0, -0.72, body);
    for (let i = 0; i < 7; i++) {
      const w = 0.28 - i * 0.032;
      B(w, w * 0.9, 0.42, 0, 0, -0.2, i % 3 === 2 ? mottle : hide, tp);
      if (i % 2) cone(c, w * 0.15, 0.1, 3, bone, 0, w * 0.5, -0.2, tp);
      const nx = c.pivot(0, 0, -0.4, tp);
      nx.rotation.set(0.05, Math.sin(i * 1.1) * 0.28, 0);
      tp = nx;
    }
    cone(c, 0.05, 0.3, 4, gold, 0, 0, -0.15, tp, false, [-PI / 2, 0, 0]);
    // Taken mottling over the hide
    for (const [x, y, z, w] of [[0.32, 0.05, 0.1, 0.1], [-0.31, -0.05, -0.2, 0.12], [0.31, 0.0, -0.5, 0.09], [-0.31, 0.1, 0.45, 0.1]]) B(0.03, w, w * 1.6, x, y, z, glow, body);
    c.muzzle.position.set(0, 0.45, 1.5);
    body.add(c.muzzle);
    c.height = 1.6;
  },

  calus(c) {
    const { B, add, bodyMat } = c;
    // Emperor Calus: black marble and gold on the outside, a hidden automaton underneath
    const marble = mat(0x16141a), gold = mat(0xd9a93c, { metalness: 0.7, roughness: 0.35 });
    const glow = mat(0xffc247, { emissive: 0xffc247, emissiveIntensity: 2.8 });
    const capeM = mat(0x5a1018);
    const steel = mat(0x4a4e56, { metalness: 0.8, roughness: 0.4 });
    const wire = mat(0x6a1a1a);
    const redEye = mat(0xff2a1a, { emissive: 0xff2a1a, emissiveIntensity: 1.2 });
    const W = 1.5;
    legs(c, 1.1, 0.17 * W, 0.19 * W, marble, gold);
    // exposed servo joints on the knees (a thing no flesh Cabal has)
    for (const k of c.legs) cyl(c, 0.075, 0.075, 0.26, 6, steel, 0, -0.55, 0.0, k, false, [0, 0, PI / 2]);
    const torso = c.pivot(0, 1.1, 0);
    c.torso = torso;
    B(0.44 * W, 0.28, 0.32, 0, 0.13, 0, marble, torso);
    // the plates that fly off at death are children of one group
    const plates = c.pivot(0, 0, 0, torso);
    plates.userData.parts = [];
    const part = (m) => { plates.userData.parts.push(m); return m; };
    part(B(0.7 * W, 0.62, 0.5, 0, 0.55, 0, marble, plates));
    part(B(0.56 * W, 0.2, 0.08, 0, 0.9, 0.2, gold, plates));
    // cracked chest plate with a gleam of servo behind it
    B(0.34, 0.34, 0.03, 0, 0.55, 0.255, steel, torso);
    part(B(0.3 * W, 0.4, 0.05, -0.03, 0.55, 0.28, gold, plates, false, [0, 0, 0.04]));
    part(B(0.025, 0.46, 0.06, 0.07, 0.55, 0.31, marble, plates, false, [0, 0, 0.3]));
    part(B(0.2, 0.025, 0.06, -0.04, 0.6, 0.31, marble, plates, false, [0, 0, -0.3]));
    // wires poking from the crack
    for (const [x, y, r] of [[0.07, 0.4, 0.4], [-0.05, 0.62, -0.3], [0.1, 0.7, 0.1]]) B(0.012, 0.16, 0.012, x, y, 0.27, wire, torso, false, [0.3, 0, r]);
    // head, crown and crest
    part(B(0.34, 0.34, 0.34, 0, 1.05, 0.04, marble, plates, true));
    part(B(0.26, 0.1, 0.06, 0, 1.0, 0.22, c.dark, plates, true));
    part(B(0.22, 0.035, 0.03, 0, 1.03, 0.255, glow, plates, true));
    part(B(0.4, 0.07, 0.4, 0, 1.25, 0.04, gold, plates, true));
    for (let i = 0; i < 7; i++) {
      const a = (i - 3) / 3;
      part(cone(c, 0.035, 0.22 + 0.12 * (1 - Math.abs(a)), 4, gold, a * 0.18, 1.35 + 0.05 * (1 - Math.abs(a)), 0.04, plates, true, [0, 0, -a * 0.35]));
    }
    // golden pauldrons
    for (const s of [-1, 1]) {
      part(B(0.34 * W, 0.2, 0.56, s * 0.5 * W, 0.92, 0, gold, plates, false, [0, 0, s * -0.2]));
      part(cone(c, 0.07, 0.42, 4, gold, s * 0.62 * W, 1.12, -0.05, plates, false, [0, 0, s * -0.65]));
    }
    // ceremonial cape
    part(B(1.0, 0.18, 0.16, 0, 0.98, -0.28, gold, plates));
    part(B(1.1, 2.0, 0.04, 0, -0.1, -0.34, capeM, plates, false, [0.1, 0, 0]));
    part(B(1.1, 0.06, 0.06, 0, -1.1, -0.44, gold, plates, false, [0.1, 0, 0]));
    // arms with exposed servo elbows; the right holds a huge golden hand cannon
    const arms = [arm(c, torso, -0.5 * W, 0.8, 0.6, 0.17, marble, -1.0, 0.12), arm(c, torso, 0.5 * W, 0.8, 0.6, 0.17, marble, -1.15, -0.12)];
    for (const a of arms) {
      cyl(c, 0.1, 0.1, 0.3, 6, steel, 0, -0.32, 0, a, false, [0, 0, PI / 2]);
      B(0.22, 0.24, 0.22, 0, -0.66, 0, gold, a);
      B(0.012, 0.3, 0.012, 0.09, -0.28, 0.09, wire, a);
    }
    c.arms.push(...arms);
    c.B(0.2, 0.3, 0.3, 0.55 * W, 0.62, 0.45, gold, torso);
    B(0.16, 0.2, 1.0, 0.55 * W, 0.7, 0.95, gold, torso);
    B(0.1, 0.1, 0.5, 0.55 * W, 0.7, 1.55, marble, torso);
    B(0.06, 0.05, 0.5, 0.55 * W, 0.82, 1.0, glow, torso);
    cyl(c, 0.06, 0.06, 0.5, 8, glow, 0.55 * W, 0.7, 0.95, torso, false, [PI / 2, 0, 0]);
    c.muzzle.position.set(0.55 * W, 0.7, 1.85);
    torso.add(c.muzzle);

    // ---- hidden automaton, revealed at death. Plain meshes: never hit targets while hidden.
    const sk = new THREE.Group();
    sk.visible = false;
    const bit = (w, h, d, x, y, z, m, rot) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
      sk.add(mesh);
      return mesh;
    };
    bit(0.08, 0.9, 0.08, 0, 0.55, 0, steel);
    for (let i = 0; i < 4; i++) {
      bit(0.62 - i * 0.07, 0.04, 0.04, 0, 0.35 + i * 0.14, 0.12, steel);
      for (const s of [-1, 1]) bit(0.04, 0.04, 0.3, s * (0.3 - i * 0.035), 0.35 + i * 0.14, 0, steel, [0, s * 0.3, 0]);
    }
    bit(0.28, 0.26, 0.28, 0, 1.0, 0.04, steel);
    bit(0.12, 0.05, 0.04, 0, 1.0, 0.2, redEye).material = redEye;
    bit(0.34, 0.1, 0.1, 0, 0.1, 0, steel);
    for (const s of [-1, 1]) {
      bit(0.07, 0.07, 0.5, s * 0.5 * W, 0.8, 0.1, steel);
      bit(0.1, 0.1, 0.1, s * 0.5 * W, 0.8, 0.0, steel);
    }
    for (let i = 0; i < 9; i++) bit(0.012, 0.012, 0.35, (i - 4) * 0.06, 0.35 + (i % 3) * 0.2, 0.08, wire, [i * 0.3, (i - 4) * 0.2, 0]);
    torso.add(sk);
    // sparks: plates tumble away under gravity over the death fade, the skeleton takes their place
    const sparkM = new THREE.MeshBasicMaterial({ color: 0xffc247 });
    c.onDeath = () => {
      sk.visible = true;
      for (const m of plates.userData.parts) {
        m.userData.start = m.position.clone();
        m.userData.v = new THREE.Vector3(m.position.x * 3 + (Math.random() - 0.5), 1.5 + Math.random() * 2.5, m.position.z * 2 + (Math.random() - 0.3) * 3);
        m.userData.spin = new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
      }
      c.dead = true;
    };
    c.deathStep = (t) => {
      if (!c.dead) return;
      for (const m of plates.userData.parts) {
        const u = m.userData, k = Math.min(t, 1.4);
        m.position.set(u.start.x + u.v.x * k, u.start.y + u.v.y * k - 4.9 * k * k, u.start.z + u.v.z * k);
        m.rotation.set(u.spin.x * k, u.spin.y * k, u.spin.z * k);
      }
      if (Math.random() < 0.5) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), sparkM);
        sp.position.set((Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 0.7, 0.3);
        sp.scale.setScalar(1 + Math.random());
        torso.add(sp);
        setTimeout(() => torso.remove(sp), 120);
      }
    };
    c.height = 3.1;
  },
};
