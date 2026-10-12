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
};
