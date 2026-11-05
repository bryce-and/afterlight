import * as THREE from 'three';
import { mat } from './world.js';

// ---------------------------------------------------------------------------
// HIVE (U18, from Bryce's references in docs/reference/enemies/hive-*). Colours follow each unit's own reference
// (Bryce, 2026-11-05): bone-white Thralls on dark sinew, grey Cursed Thralls with a glowing green-white bulb, Acolytes in bone with
// mauve chitin and a tattered grey-green tabard, mauve Knights, bone Ogres with green shoulders and a purple brain, a grey-bone
// Shrieker round a purple orb, mauve Wizards in a bone robe. c.bodyMat carries each unit's main plate colour (hit flashes light it).
// Shared parts: skull (eyeless Thrall head), hiveLegs (digitigrade, bone plates, hooves), hiveArm (sinew, bone forearm, hooked claws),
// crestHelm (Acolyte and Knight helmets with three green eyes). Same builder contract as the other factions: face +z, stand on y = 0
// (floating units are lifted by `def.fly`), c.torso / c.legs / c.arms / c.muzzle per unit.
// ---------------------------------------------------------------------------
const PI = Math.PI;
const ico = (c, r, d, m, x, y, z, parent, crit = false, rot = null) => c.add(new THREE.IcosahedronGeometry(r, d), m, x, y, z, parent, crit, rot);
const cone = (c, r, h, m, x, y, z, parent, rot = null, crit = false, seg = 5) => c.add(new THREE.ConeGeometry(r, h, seg), m, x, y, z, parent, crit, rot);
const cyl = (c, rt, rb, h, seg, m, x, y, z, parent, rot = null, crit = false) => c.add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, parent, crit, rot);

let _m = null;
function hm() {
  if (!_m) _m = {
    sinew: mat(0x3a2f26), sinewD: mat(0x231c17), bone: mat(0xd9d2bf), boneG: mat(0xb3ad9d), hoof: mat(0x5a4a3c),
    teeth: mat(0xe8e2d0), chitin: mat(0x6e5468), chitinD: mat(0x45333f), moss: mat(0x5c7448), cloth: mat(0x6d6c58), clothD: mat(0x4d4c3e),
    green: mat(0x6dff8e, { emissive: 0x6dff8e, emissiveIntensity: 2.4 }),
    cursed: mat(0xc8fff0, { emissive: 0x8affd0, emissiveIntensity: 2.8 }),
    gun: mat(0x2e2c30), gunL: mat(0x6a6870), voidG: mat(0xb26bff, { emissive: 0xb26bff, emissiveIntensity: 2.6 }),
    ogreGreen: mat(0x5a7656), brain: mat(0x8c6c9c), stripe: mat(0x6e4e8e),
    shell: new THREE.MeshStandardMaterial({ color: 0x8a8174, flatShading: true, side: THREE.DoubleSide, roughness: 0.75, metalness: 0.2 }),
    shellIn: new THREE.MeshStandardMaterial({ color: 0x6a45a8, emissive: 0x4a2590, emissiveIntensity: 0.7, flatShading: true, side: THREE.DoubleSide }),
    robe: mat(0xd6c7a6), robeD: mat(0xa8977a), white: mat(0xf4f6ff, { emissive: 0xe8ecff, emissiveIntensity: 2.6 }),
    cape: new THREE.MeshStandardMaterial({ color: 0x18161a, flatShading: true, side: THREE.DoubleSide, roughness: 0.9 }),
  };
  return _m;
}

/** Eyeless Thrall skull on `parent` at (0, y, z): a long domed cranium swept back, a bare jaw of teeth (all crit). */
function skull(c, parent, y, z, s, m) {
  const M = hm();
  const h = c.pivot(0, y, z, parent);
  ico(c, 0.13 * s, 1, m, 0, 0.04 * s, -0.04 * s, h, true).scale.set(0.9, 1.0, 1.5);
  c.B(0.13 * s, 0.07 * s, 0.14 * s, 0, -0.06 * s, 0.07 * s, M.sinewD, h, true);
  c.B(0.12 * s, 0.03 * s, 0.03 * s, 0, -0.03 * s, 0.14 * s, M.teeth, h, true);
  c.B(0.11 * s, 0.03 * s, 0.03 * s, 0, -0.09 * s, 0.13 * s, M.teeth, h, true);
  for (const sx of [-1, 1]) c.B(0.03 * s, 0.1 * s, 0.12 * s, sx * 0.07 * s, -0.04 * s, 0.05 * s, m, h, true, [0, 0, sx * 0.2]); // cheek plates
  return h;
}

/** Two digitigrade legs: dark sinew under bone thigh and shin plates, knee caps, two-toed hooves. */
function hiveLegs(c, hipY, hipW, th, plate, under, hoof = hm().hoof) {
  for (const sx of [-1, 1]) {
    const hip = c.pivot(sx * hipW, hipY, 0);
    const L = hipY / 2;
    c.B(th, L * 1.05, th * 1.1, 0, -L * 0.48, 0.07, under, hip, false, [-0.32, 0, 0]);
    c.B(th * 1.35, L * 0.95, th * 1.3, 0, -L * 0.5, 0.1, plate, hip, false, [-0.32, 0, 0]); // thigh plate
    c.B(th * 1.4, th * 1.4, th * 1.2, 0, -L * 0.98, th * 0.55, plate, hip); // knee
    c.B(th * 1.15, L * 1.0, th * 1.2, 0, -L * 1.45, 0.06, plate, hip, false, [0.3, 0, 0]); // shin plate
    c.B(th * 1.3, 0.1, th * 1.9, 0, -hipY + 0.05, 0.08, hoof, hip);
    c.B(0.02, 0.1, th * 1.0, 0, -hipY + 0.05, 0.08 + th * 0.5, under, hip); // split toe
    c.legs.push(hip);
  }
}

/** One arm on `parent`: sinew upper arm, bone forearm, a hand of hooked claws. Pivot at the shoulder; the hand is at (0, -len, 0). */
function hiveArm(c, parent, x, y, len, th, lift, rz, plate, under, claws = 3, clawLen = 0.16) {
  const p = c.pivot(x, y, 0, parent);
  c.B(th, len * 0.5, th, 0, -len * 0.25, 0, under, p);
  c.B(th * 1.45, len * 0.5, th * 1.45, 0, -len * 0.7, 0, plate, p);
  c.B(th * 1.1, 0.07, th * 1.2, 0, -len - 0.02, 0, under, p);
  for (let k = 0; k < claws; k++) {
    const cx = (k - (claws - 1) / 2) * th * 0.55;
    cone(c, th * 0.2, clawLen, plate, cx, -len - 0.05 - clawLen * 0.45, 0.04, p, [PI - 0.35, 0, cx * 2], false, 4);
  }
  p.rotation.x = lift; p.rotation.z = rz;
  return p;
}

/** A grip at the hand of arm `a` (built with lift `lift` and length `len`), turned back to face the torso's forward, so a weapon
 *  parented to it points ahead and moves with the arm. */
function hand(c, a, len, lift) {
  const g = c.pivot(0, -len - 0.04, 0, a);
  g.rotation.x = -lift;
  return g;
}

/** Hive helmet on `parent` at (0, y, z): a domed crown with flared side fins and three green eyes in a dark face (all crit).
 *  'acolyte': low fins swept back. 'knight': a tall pointed crown and horns swept up and out. */
function crestHelm(c, parent, y, z, s, kind, shell, crown) {
  const M = hm();
  const h = c.pivot(0, y, z, parent);
  c.B(0.17 * s, 0.17 * s, 0.17 * s, 0, -0.02 * s, 0.03 * s, M.sinewD, h, true); // face
  ico(c, 0.12 * s, 1, crown, 0, 0.07 * s, -0.01, h, true).scale.set(1, 0.85, 1.1);
  for (const [ex, ey] of [[-0.04, 0.0], [0.04, 0.0], [0, 0.045]]) c.B(0.032 * s, 0.032 * s, 0.03 * s, ex * s, ey * s, 0.12 * s, M.green, h, true);
  c.B(0.08 * s, 0.05 * s, 0.05 * s, 0, -0.08 * s, 0.1 * s, M.teeth, h, true); // jaw
  if (kind === 'acolyte') {
    for (const sx of [-1, 1]) {
      c.B(0.2 * s, 0.11 * s, 0.24 * s, sx * 0.15 * s, 0.03 * s, -0.04 * s, shell, h, true, [0.1, sx * -0.35, sx * -0.3]);
      c.B(0.1 * s, 0.03 * s, 0.2 * s, sx * 0.2 * s, -0.02 * s, -0.05 * s, M.moss, h, false, [0.1, sx * -0.35, sx * -0.3]);
    }
    c.B(0.06 * s, 0.1 * s, 0.22 * s, 0, 0.14 * s, -0.04 * s, shell, h, true, [-0.3, 0, 0]); // brow ridge
  } else {
    cone(c, 0.09 * s, 0.42 * s, shell, 0, 0.3 * s, -0.03 * s, h, [-0.15, PI / 4, 0], true, 4); // pointed crown
    for (const sx of [-1, 1]) {
      cone(c, 0.07 * s, 0.38 * s, shell, sx * 0.2 * s, 0.14 * s, -0.04 * s, h, [0, 0, sx * -1.05], true, 4); // side horns
      c.B(0.12 * s, 0.16 * s, 0.18 * s, sx * 0.11 * s, 0.04 * s, 0, shell, h, true, [0, 0, sx * -0.25]); // cheek guards
    }
  }
  return h;
}

/** Thrall: gaunt and hunched, bone plates over dark sinew, a thin spine at the waist, a long eyeless skull, long arms of hooked claws. */
function thrall(c) {
  const M = hm();
  const bone = c.bodyMat;
  hiveLegs(c, 0.9, 0.11, 0.08, bone, M.sinew);
  const torso = c.pivot(0, 0.9, 0);
  torso.rotation.x = 0.55;
  c.torso = torso;
  c.B(0.2, 0.1, 0.14, 0, 0.0, 0, bone, torso); // pelvis
  cyl(c, 0.045, 0.05, 0.24, 6, M.sinewD, 0, 0.14, -0.02, torso); // spine waist
  c.B(0.28, 0.32, 0.2, 0, 0.42, 0, M.sinew, torso); // ribcage
  for (const sx of [-1, 1]) c.B(0.12, 0.28, 0.06, sx * 0.09, 0.43, 0.1, bone, torso, false, [0, sx * 0.25, 0]); // chest shells
  for (let i = 0; i < 3; i++) c.B(0.22, 0.025, 0.02, 0, 0.32 + i * 0.07, 0.11, M.sinewD, torso); // ribs
  for (const sx of [-1, 1]) ico(c, 0.11, 0, bone, sx * 0.19, 0.58, -0.01, torso).scale.set(1.0, 0.8, 1.25); // shoulders
  cyl(c, 0.04, 0.05, 0.14, 5, M.sinewD, 0, 0.64, 0.06, torso, [0.6, 0, 0]); // neck
  skull(c, torso, 0.74, 0.12, 1.0, bone);
  for (const sx of [-1, 1]) c.arms.push(hiveArm(c, torso, sx * 0.2, 0.56, 0.74, 0.055, -1.15, sx * 0.22, bone, M.sinew, 3, 0.18));
  c.muzzle.position.set(0, 0.5, 0.3); torso.add(c.muzzle);
  c.height = 1.8;
}

/** Cursed Thrall: a greyer, more hunched Thrall, arms crossed before it, a swollen green-white bulb atop the skull and glowing cracks. */
function cursedThrall(c) {
  const M = hm();
  c.bodyMat.color.setHex(0xb8b2a2);
  const bone = c.bodyMat;
  hiveLegs(c, 0.9, 0.12, 0.08, bone, M.sinew);
  for (const hip of c.legs) {
    c.B(0.11, 0.03, 0.11, 0, -0.44, 0.06, M.cursed, hip); // knee glow
    c.B(0.1, 0.03, 0.1, 0, -0.82, 0.06, M.cursed, hip); // ankle glow
  }
  const torso = c.pivot(0, 0.9, 0);
  torso.rotation.x = 0.7;
  c.torso = torso;
  c.B(0.2, 0.1, 0.14, 0, 0.0, 0, bone, torso);
  cyl(c, 0.045, 0.05, 0.24, 6, M.sinewD, 0, 0.14, -0.02, torso);
  c.B(0.3, 0.34, 0.22, 0, 0.42, 0, M.sinew, torso);
  c.B(0.06, 0.26, 0.03, 0, 0.42, 0.12, M.cursed, torso); // chest glow
  for (const sx of [-1, 1]) {
    c.B(0.12, 0.28, 0.06, sx * 0.1, 0.44, 0.11, bone, torso, false, [0, sx * 0.3, 0]);
    ico(c, 0.13, 0, bone, sx * 0.2, 0.6, -0.01, torso).scale.set(1.0, 0.85, 1.3);
  }
  cyl(c, 0.04, 0.05, 0.14, 5, M.sinewD, 0, 0.66, 0.06, torso, [0.6, 0, 0]);
  const h = skull(c, torso, 0.76, 0.12, 1.0, bone);
  ico(c, 0.14, 1, M.cursed, 0, 0.12, -0.04, h, true).scale.set(1, 0.9, 1.15); // the bulb: precision spot
  // arms wrapped round its own body (a self-hug): upper arms hang at the sides, forearms cross the chest, claws curl round the
  // opposite flank. Built bent at the elbow and kept out of c.arms, so the attack animations never pull the hug apart.
  for (const [sx, lift] of [[-1, -0.85], [1, -0.5]]) {
    const up = c.pivot(sx * 0.21, 0.56, 0, torso);
    c.B(0.055, 0.3, 0.055, 0, -0.15, 0, M.sinew, up);
    up.rotation.set(lift, 0, sx * 0.15);
    const elbow = new THREE.Vector3(0, -0.3, 0).applyEuler(up.rotation).add(up.position);
    const fore = c.pivot(elbow.x, elbow.y, elbow.z + 0.02, torso);
    fore.rotation.z = -sx * PI / 2;
    c.B(0.08, 0.42, 0.08, 0, -0.21, 0, bone, fore);
    c.B(0.06, 0.06, 0.07, 0, -0.43, 0, M.sinew, fore);
    for (let k = -1; k <= 1; k++) cone(c, 0.012, 0.15, bone, k * 0.025, -0.45, -0.07, fore, [-PI / 2, 0, 0], false, 4);
  }
  c.muzzle.position.set(0, 0.5, 0.3); torso.add(c.muzzle);
  c.height = 1.8;
}

/** Acolyte: upright, bone limbs and mauve chitin over the chest and shoulders (mossy edges), a finned helmet with three green eyes,
 *  a tattered grey-green tabard and crossed straps, a dark shredder in the right hand. */
function acolyte(c) {
  const M = hm();
  const bone = c.bodyMat;
  hiveLegs(c, 0.95, 0.13, 0.095, bone, M.sinew);
  const torso = c.pivot(0, 0.95, 0);
  torso.rotation.x = 0.15;
  c.torso = torso;
  c.B(0.28, 0.24, 0.2, 0, 0.12, 0, M.sinew, torso);
  c.B(0.42, 0.4, 0.28, 0, 0.47, 0, M.sinew, torso);
  c.B(0.38, 0.3, 0.08, 0, 0.53, 0.13, M.chitin, torso); // chest carapace
  c.B(0.14, 0.2, 0.06, 0, 0.32, 0.13, M.chitinD, torso);
  for (const sx of [-1, 1]) {
    ico(c, 0.17, 0, M.chitin, sx * 0.27, 0.66, -0.01, torso, false, [0, 0, sx * -0.3]).scale.set(1.0, 0.75, 1.15); // pauldron
    c.B(0.14, 0.04, 0.2, sx * 0.33, 0.6, 0.0, M.moss, torso, false, [0, 0, sx * -0.5]);
    c.B(0.06, 0.62, 0.02, sx * 0.06, 0.38, 0.17, M.cloth, torso, false, [0, 0, sx * 0.55]); // crossed straps
  }
  // tabard: a front panel hanging to the knees, ragged at the hem, and a shorter back panel
  c.B(0.2, 0.62, 0.02, 0, -0.06, 0.16, M.cloth, torso, false, [-0.1, 0, 0]);
  c.B(0.06, 0.24, 0.02, -0.06, -0.48, 0.2, M.cloth, torso, false, [-0.1, 0, 0.05]);
  c.B(0.06, 0.16, 0.02, 0.05, -0.44, 0.2, M.clothD, torso, false, [-0.1, 0, -0.05]);
  c.B(0.26, 0.5, 0.02, 0, 0.0, -0.15, M.clothD, torso, false, [0.1, 0, 0]);
  crestHelm(c, torso, 0.84, 0.05, 1.0, 'acolyte', M.chitin, bone);
  const l = hiveArm(c, torso, -0.28, 0.62, 0.56, 0.065, -1.0, -0.3, bone, M.sinew, 3, 0.12);
  const r = hiveArm(c, torso, 0.28, 0.62, 0.56, 0.065, -1.15, 0.12, bone, M.sinew, 3, 0.12);
  c.arms.push(l, r);
  // shredder in the right hand: a squat dark body with a skull-like snout and a green sight
  const grip = hand(c, r, 0.56, -1.15);
  c.B(0.11, 0.15, 0.42, 0, 0.02, 0.08, M.gun, grip);
  c.B(0.09, 0.08, 0.14, 0, -0.01, 0.32, M.gunL, grip);
  c.B(0.04, 0.03, 0.16, 0, 0.11, 0.08, c.accent, grip);
  c.B(0.05, 0.12, 0.05, 0, -0.08, -0.04, M.gun, grip); // grip
  c.muzzle.position.set(0, 0, 0.42); grip.add(c.muzzle);
  c.height = 2.05;
}

/** Knight: massive, mauve plate with bone limbs, a ridged chest, huge pauldrons, a pointed crown with swept horns and three
 *  green eyes, a boomer with a violet core in the right hand. `boss` adds a crown of spikes and a glowing chest sigil. */
function knight(c, boss = false) {
  const M = hm();
  c.bodyMat.color.setHex(0x8e6a7c);
  const plate = c.bodyMat;
  const W = 1.35;
  hiveLegs(c, 0.95, 0.15 * W, 0.11 * W, plate, M.sinew);
  for (const hip of c.legs) c.B(0.12 * W, 0.2, 0.08, 0, -0.75, 0.15, M.bone, hip, false, [0.3, 0, 0]); // bone shin edge
  const torso = c.pivot(0, 0.95, 0);
  torso.rotation.x = 0.14;
  c.torso = torso;
  c.B(0.32 * W, 0.24, 0.24, 0, 0.12, 0, M.sinew, torso);
  for (let i = 0; i < 3; i++) c.B(0.3 * W - i * 0.02, 0.07, 0.06, 0, 0.06 + i * 0.09, 0.13, plate, torso); // abdomen plates
  c.B(0.5 * W, 0.44, 0.32, 0, 0.5, 0, M.sinew, torso);
  c.B(0.48 * W, 0.34, 0.12, 0, 0.56, 0.13, plate, torso); // chest plate
  c.B(0.06, 0.34, 0.06, 0, 0.56, 0.2, M.chitinD, torso); // centre ridge
  for (const sx of [-1, 1]) {
    c.B(0.2 * W, 0.18, 0.42, sx * 0.36 * W, 0.74, 0, plate, torso, false, [0, 0, sx * -0.35]); // pauldron
    c.B(0.16 * W, 0.08, 0.36, sx * 0.4 * W, 0.62, 0, M.bone, torso, false, [0, 0, sx * -0.35]);
    cone(c, 0.06, 0.26, plate, sx * 0.48 * W, 0.86, -0.04, torso, [0, 0, sx * -0.9], false, 4); // pauldron spike
  }
  crestHelm(c, torso, 0.92, 0.06, 1.25, 'knight', plate, plate);
  const l = hiveArm(c, torso, -0.36 * W, 0.66, 0.6, 0.085, -0.9, -0.35, M.bone, M.sinew, 3, 0.14);
  const r = hiveArm(c, torso, 0.36 * W, 0.66, 0.6, 0.085, -1.15, 0.12, M.bone, M.sinew, 3, 0.14);
  c.arms.push(l, r);
  // boomer in the right hand: a heavy dark-silver frame round a violet core
  const grip = hand(c, r, 0.6, -1.15);
  c.B(0.16, 0.2, 0.62, 0, 0.04, 0.12, M.gunL, grip);
  c.B(0.1, 0.1, 0.36, 0, 0.04, 0.16, M.voidG, grip);
  c.B(0.2, 0.06, 0.4, 0, 0.17, 0.1, M.gun, grip);
  c.B(0.07, 0.14, 0.07, 0, -0.08, -0.04, M.gun, grip); // grip
  c.muzzle.position.set(0, 0.04, 0.46); grip.add(c.muzzle);
  if (boss) {
    for (let i = -2; i <= 2; i++) cone(c, 0.035, 0.26 + (2 - Math.abs(i)) * 0.08, M.bone, i * 0.08, 1.32, -0.04, torso, [0, 0, -i * 0.18], true, 4);
    c.B(0.2, 0.2, 0.04, 0, 0.56, 0.2, c.accent, torso);
  }
  c.height = 2.3;
}

/** Ogre: squat and hunched, bone limbs striped purple, mossy green shoulder carapace with horn fins, a swollen purple brain over a
 *  small toothed skull (the brain is the precision spot and the eye beam's source), long thick arms with clawed hands. */
function ogre(c) {
  const M = hm();
  const bone = c.bodyMat;
  hiveLegs(c, 0.72, 0.24, 0.17, bone, M.sinew);
  for (const hip of c.legs) c.B(0.2, 0.04, 0.24, 0, -0.42, 0.1, M.stripe, hip, false, [-0.2, 0, 0]);
  const torso = c.pivot(0, 0.72, 0);
  torso.rotation.x = 0.45;
  c.torso = torso;
  c.B(0.62, 0.36, 0.46, 0, 0.18, 0, bone, torso); // belly
  c.B(0.92, 0.6, 0.62, 0, 0.62, -0.02, M.sinew, torso);
  c.B(0.8, 0.46, 0.18, 0, 0.6, 0.26, bone, torso); // chest plate
  for (const sx of [-1, 1]) {
    c.B(0.06, 0.3, 0.04, sx * 0.2, 0.6, 0.36, M.stripe, torso);
    ico(c, 0.25, 1, M.ogreGreen, sx * 0.55, 0.84, -0.08, torso).scale.set(1.0, 0.75, 1.2); // shoulder carapace
    cone(c, 0.08, 0.42, bone, sx * 0.66, 1.0, -0.08, torso, [0, 0, sx * -0.45], false, 4); // horn fin
  }
  // brain and skull, set low between the shoulders
  const h = c.pivot(0, 0.9, 0.38, torso);
  ico(c, 0.36, 1, M.brain, 0, 0.1, 0, h, true).scale.set(1.05, 0.95, 0.95);
  for (const [bx, by, bz] of [[-0.16, 0.26, 0.16], [0.15, 0.24, 0.18], [0, 0.36, 0.08], [-0.24, 0.08, 0.2], [0.24, 0.07, 0.19], [0, 0.14, 0.28]]) ico(c, 0.12, 0, M.brain, bx, by, bz, h, true);
  ico(c, 0.08, 1, M.voidG, 0, 0.12, 0.34, h, true); // eye-beam glow
  c.B(0.26, 0.16, 0.16, 0, -0.2, 0.2, bone, h, true); // skull
  c.B(0.22, 0.04, 0.04, 0, -0.25, 0.29, M.teeth, h, true);
  c.muzzle.position.set(0, 0.12, 0.34); h.add(c.muzzle);
  for (const sx of [-1, 1]) {
    const a = hiveArm(c, torso, sx * 0.58, 0.82, 1.0, 0.19, -0.5, sx * 0.2, bone, M.sinew, 3, 0.26);
    c.B(0.24, 0.06, 0.24, 0, -0.62, 0.1, M.stripe, a);
    c.arms.push(a);
  }
  c.height = 2.2;
}

/** Shrieker (references hive-shrieker-1 to -5): a swirling purple orb with a bright eye (the precision spot), caged by six designed
 *  blades in a three-sided layout (Bryce: two tetrahedra base to base, split). Three upper blades rise from the orb and meet at the
 *  crown, three lower ones fall to a keel point; each flares into a sharp wing at the middle. The halves mirror each other and slowly turn in opposite directions (`c.spinners`). A blade is a thick fin with an armour
 *  panel down its outer edge, a ridge and two white running lights on the panel, a wing panel with a violet underside, a violet
 *  inner edge facing the orb and barbs along its back. Hovers and swivels to aim. */
function shrieker(c) {
  const M = hm();
  const metal = new THREE.MeshStandardMaterial({ color: 0x8c7b6e, flatShading: true, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.35 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x5e5049, flatShading: true, roughness: 0.6, metalness: 0.4 });
  const lamp = mat(0xeefff0, { emissive: 0xdfffe8, emissiveIntensity: 3 });
  const orbM = new THREE.MeshBasicMaterial({ color: 0x7a3de0, transparent: true, opacity: 0.55, depthWrite: false });
  const wispM = new THREE.MeshBasicMaterial({ color: 0xd2b8ff, transparent: true, opacity: 0.55, depthWrite: false });
  c.hover = true;
  const b = c.pivot(0, 1.9, 0);
  c.torso = b;
  // the fin's outline in its own plane: u outward from the axis, v up. Apex at the top, a wing flaring out at the bottom.
  const fin = (() => {
    const sh = new THREE.Shape();
    sh.moveTo(0.04, 1.72);
    sh.quadraticCurveTo(0.42, 1.4, 0.5, 1.0); // outer edge, bowed out
    sh.lineTo(0.62, 0.66);
    sh.lineTo(1.45, 0.34); // wing tip
    sh.lineTo(0.92, 0.42);
    sh.lineTo(0.7, 0.32); // notch under the wing
    sh.lineTo(0.42, 0.3);
    sh.lineTo(0.28, 0.42); // root beside the orb
    sh.quadraticCurveTo(0.16, 0.9, 0.04, 1.72); // inner edge, hollowed round the orb
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 1, curveSegments: 5 });
    g.translate(0, 0, -0.13);
    return g;
  })();
  // a box from point p to q in the fin plane, `w` wide across the plane and `t` thick, pushed `out` along its outward normal
  const strip = (u, p, q, w, t, m, out = 0, z = 0) => {
    const du = q[0] - p[0], dv = q[1] - p[1], len = Math.hypot(du, dv);
    const nx = dv / len, ny = -du / len; // right-hand normal of p->q: outward for the edges drawn below
    return c.B(len, t, w, (p[0] + q[0]) / 2 + nx * out, (p[1] + q[1]) / 2 + ny * out, z, m, u, false, [0, 0, Math.atan2(dv, du)]);
  };
  const blade = (half, theta, up) => {
    const u = c.pivot(0, 0, 0, half);
    u.rotation.y = theta - PI / 2; // local x points outward along theta
    if (up < 0) u.scale.y = -1;
    c.add(fin, metal, 0, 0, 0, u);
    // armour panel down the outer edge, with a raised ridge and two running lights near the top
    strip(u, [0.36, 1.42], [0.62, 0.66], 0.62, 0.08, panel, 0.06);
    strip(u, [0.36, 1.42], [0.62, 0.66], 0.08, 0.05, metal, 0.12);
    for (const dz of [-0.15, 0.15]) strip(u, [0.4, 1.32], [0.45, 1.16], 0.035, 0.03, lamp, 0.11, dz);
    // wing panel with a violet underside
    strip(u, [0.62, 0.68], [1.4, 0.38], 0.52, 0.1, panel, 0.06);
    strip(u, [1.4, 0.32], [0.62, 0.6], 0.42, 0.05, M.shellIn, 0.06);
    c.B(0.03, 0.03, 0.08, 1.1, 0.5, 0, lamp, u); // light on the wing
    // violet inner edge facing the orb
    strip(u, [0.06, 1.6], [0.28, 0.44], 0.3, 0.05, M.shellIn, 0.04);
    // barbs along the back of the blade
    for (const [bu, bv, r] of [[0.48, 1.18, -0.9], [0.56, 0.86, -1.1], [0.9, 0.5, -0.2]]) cone(c, 0.05, 0.22, metal, bu + 0.06, bv + 0.05, 0, u, [0, 0, r], false, 4);
  };
  // the two halves mirror each other (each lower blade straight under an upper one) and turn slowly in opposite directions
  const top = c.pivot(0, 0, 0, b), bot = c.pivot(0, 0, 0, b);
  for (let i = 0; i < 3; i++) {
    const theta = PI / 3 + (i * 2 * PI) / 3; // front-left, front-right, back
    blade(top, theta, 1);
    blade(bot, theta, -1);
  }
  c.spinners = [{ obj: top, speed: 0.35 }, { obj: bot, speed: -0.35 }];
  // the orb, wisps swirling round it, the eye
  c.add(new THREE.SphereGeometry(0.62, 14, 10), orbM, 0, 0, 0, b);
  for (const [rx, ry] of [[0.3, 0], [1.2, 0.7], [-0.6, 1.5]]) c.add(new THREE.TorusGeometry(0.68, 0.025, 4, 18, PI * 1.3), wispM, 0, 0, 0, b, false, [rx, ry, 0]);
  ico(c, 0.3, 1, M.voidG, 0, 0, 0.4, b, true).scale.set(1, 1, 0.55);
  ico(c, 0.16, 1, M.white, 0, 0, 0.55, b, true);
  c.muzzle.position.set(0, 0, 0.8); b.add(c.muzzle);
  c.height = 3.7;
}

/** Wizard: floats; a mauve carapace with green ribbing over a long bone robe that trails into tatters, a dark tattered cape, a wide
 *  flared helmet with two white eye slits, thin bone arms with long claws, a glowing orb in the right hand. */
function wizard(c) {
  const M = hm();
  c.bodyMat.color.setHex(0x8e6a7c);
  const plate = c.bodyMat;
  c.hover = true;
  const torso = c.pivot(0, 1.0, 0);
  c.torso = torso;
  // robe: a widening bone skirt, a green panel down the front, ragged strips at the hem
  cyl(c, 0.2, 0.36, 0.9, 7, M.robe, 0, -0.45, 0, torso);
  c.B(0.1, 0.9, 0.03, 0, -0.45, 0.28, M.moss, torso, false, [-0.14, 0, 0]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * PI * 2, len = 0.25 + ((i * 37) % 5) * 0.06;
    c.B(0.12, len, 0.02, Math.sin(a) * 0.33, -0.9 - len / 2, Math.cos(a) * 0.33, i % 2 ? M.robeD : M.robe, torso, false, [0, a, 0]);
  }
  // cape: dark tattered panels hanging from the shoulders down the back
  for (let i = -2; i <= 2; i++) c.B(0.15, 1.5 - Math.abs(i) * 0.18, 0.02, i * 0.13, -0.15 - Math.abs(i) * 0.05, -0.3, M.cape, torso, false, [0.08, 0, i * 0.04]);
  // carapace
  c.B(0.36, 0.5, 0.26, 0, 0.3, 0, plate, torso);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) c.B(0.03, 0.14, 0.2, sx * 0.19, 0.18 + i * 0.12, 0.0, M.moss, torso);
  c.B(0.05, 0.4, 0.04, 0, 0.32, 0.14, M.chitinD, torso);
  for (const sx of [-1, 1]) {
    c.B(0.24, 0.16, 0.34, sx * 0.27, 0.58, 0, plate, torso, false, [0, 0, sx * -0.35]); // pauldron
    c.B(0.2, 0.12, 0.3, sx * 0.33, 0.49, 0, plate, torso, false, [0, 0, sx * -0.55]);
  }
  // helmet: a dark face under a wide, flat flared crest with two white slits
  const h = c.pivot(0, 0.72, 0.05, torso);
  c.B(0.16, 0.18, 0.16, 0, 0, 0.02, M.sinewD, h, true);
  c.B(0.56, 0.08, 0.26, 0, 0.12, -0.02, plate, h, true, [-0.15, 0, 0]);
  for (const sx of [-1, 1]) {
    c.B(0.2, 0.16, 0.06, sx * 0.24, 0.2, -0.04, plate, h, true, [0, 0, sx * -0.6]); // flared tips
    c.B(0.03, 0.12, 0.02, sx * 0.03, 0.15, 0.1, M.white, h, true, [-0.2, 0, 0]); // eye slit
  }
  c.B(0.08, 0.16, 0.16, 0, 0.22, -0.02, plate, h, true); // crest ridge
  const l = hiveArm(c, torso, -0.3, 0.5, 0.62, 0.05, -0.5, -0.4, M.robe, M.sinew, 4, 0.14);
  const r = hiveArm(c, torso, 0.3, 0.5, 0.62, 0.05, -0.9, 0.35, M.robe, M.sinew, 4, 0.14);
  ico(c, 0.09, 1, M.white, 0, -0.72, 0.06, r);
  c.arms.push(l, r);
  c.muzzle.position.set(0, 0.4, 0.3); torso.add(c.muzzle);
  c.height = 2.4;
}

const BUILD = {
  grunt: acolyte, rusher: thrall, captain: (c) => knight(c), heavy: ogre, suicide: cursedThrall, boss: (c) => knight(c, true),
  hv_shrieker: shrieker, hv_wizard: wizard,
};

/** Every Hive unit: the base classes (grunt Acolyte, rusher Thrall, captain Knight, heavy Ogre, suicide Cursed Thrall, generic boss
 *  a crowned Knight) and the Destiny 2 units (Shrieker, Wizard). */
export function hive(c, t) {
  const b = BUILD[t];
  if (!b) throw new Error(`No Hive model for ${t}`);
  b(c);
}
