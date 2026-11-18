import * as THREE from 'three';
import { mat } from './world.js';
import { PI, cone, cyl, ico, tor, legs, arm, gun } from './boss-kit.js';

// ---------------------------------------------------------------------------
// U29: Fallen bosses. Shared language: bone-grey plate over dark undersuit, glowing ether tanks, hooked horns, four-armed or hovering
// frames, rags in the House's colour. Each boss has its own silhouette: Sepiks (a tall tank-ringed drone), Riksis (a tall fork-crowned
// lancer), Draksis (a wide, ice-mantled brute).
// ---------------------------------------------------------------------------
const ETHER = () => mat(0xb48cff, { emissive: 0x8a5cff, emissiveIntensity: 2.2 });

/** Four-eyed Fallen face block: crit. */
function face(c, p, y, z, m, s = 1) {
  c.B(0.22 * s, 0.2 * s, 0.26 * s, 0, y, z, m, p, true);
  for (const k of [-1, 1]) {
    c.B(0.04 * s, 0.14 * s, 0.1 * s, k * 0.12 * s, y - 0.07 * s, z + 0.1 * s, m, p, true, [0.3, 0, k * 0.2]);
    for (const dy of [0.04, -0.01]) c.B(0.035 * s, 0.03 * s, 0.03 * s, k * 0.05 * s, y + dy * s, z + 0.135 * s, c.accent, p, true);
  }
}
/** Ether tank on a stand: a cylinder with glowing caps. */
function tank(c, p, x, y, z, h, r, shell, glow) {
  cyl(c, r, r, h, 6, shell, x, y, z, p);
  cyl(c, r * 0.6, r * 0.6, 0.05, 6, glow, x, y + h / 2 + 0.02, z, p);
}

export const FALLEN_BOSSES = {
  /** Sepiks Prime: an upright egg drone ringed by six ether tanks, hanging claw-cables. */
  servitor(c) {
    const { add, B, pivot, bodyMat, dark, accent } = c;
    const plate = mat(0x6f716a), glow = ETHER(), brass = mat(0xc9a64a);
    c.hover = true;
    const body = pivot(0, 1.25, 0);
    c.torso = body;
    add(new THREE.SphereGeometry(0.7, 10, 8), bodyMat, 0, 0, 0, body).scale.set(0.9, 1.2, 0.9); // the egg
    // the great eye in a sunk collar
    cyl(c, 0.38, 0.44, 0.2, 8, dark, 0, 0.12, 0.55, body, false, [PI / 2, 0, 0]);
    add(new THREE.SphereGeometry(0.28, 8, 6), accent, 0, 0.12, 0.66, body, true).scale.z = 0.6;
    tor(c, 0.4, 0.05, plate, 0, 0.12, 0.7, body, true, null, 10);
    // brass bands up the egg
    tor(c, 0.7, 0.04, brass, 0, 0.5, 0, body, false, [PI / 2, 0, 0], 12);
    tor(c, 0.72, 0.04, brass, 0, -0.45, 0, body, false, [PI / 2, 0, 0], 12);
    // six ether tanks standing in a ring at the waist
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + 0.3;
      if (i === 0) continue; // keep the face clear
      tank(c, body, Math.sin(a) * 1.0, -0.05, Math.cos(a) * 1.0 * 0.9, 0.7, 0.14, plate, glow);
    }
    // four antennae and a back fin
    for (const s of [-1, 1]) cone(c, 0.04, 0.5, 4, plate, s * 0.3, 1.0, -0.15, body, false, [-0.3, 0, -s * 0.35]);
    B(0.05, 0.5, 0.5, 0, 0.75, -0.3, plate, body, false, [0.4, 0, 0]);
    // hanging claw cables beneath
    for (const s of [-1, 1]) {
      B(0.06, 0.55, 0.06, s * 0.3, -0.95, 0.1, dark, body, false, [0.1, 0, s * 0.15]);
      cone(c, 0.1, 0.22, 4, brass, s * 0.36, -1.28, 0.12, body, false, [PI, 0, 0]);
    }
    cyl(c, 0.2, 0.1, 0.22, 6, dark, 0, -0.9, -0.05, body);
    c.muzzle.position.set(0, 0.12, 0.92);
    body.add(c.muzzle);
    c.height = 2.1;
  },

  /** Riksis, Devil Archon: tall and narrow, a tuning-fork crown, back-mounted ether stack and a long arc lance. */
  archon(c) {
    const { B, bodyMat, dark, accent } = c;
    const robe = mat(0x3c2c5a), trim = mat(0xc9a64a), armor = mat(0x6f716a), glow = ETHER();
    legs(c, 0.95, 0.12, 0.09, dark, armor, true);
    for (const s of [-1, 1]) B(0.14, 0.7, 0.34, s * 0.14, 0.62, 0.02, robe, undefined, false, [0.05, 0, s * 0.04]); // split tabard over the thighs
    const torso = c.pivot(0, 1.0, 0);
    torso.rotation.x = 0.1;
    c.torso = torso;
    B(0.3, 0.22, 0.2, 0, 0.1, 0, dark, torso);
    B(0.42, 0.46, 0.26, 0, 0.45, 0, bodyMat, torso);
    B(0.36, 0.1, 0.06, 0, 0.62, 0.15, trim, torso); // gorget
    // tall ether stack on the back: three tubes of glow
    for (let i = -1; i <= 1; i++) { cyl(c, 0.07, 0.07, 0.85, 6, dark, i * 0.13, 0.55, -0.26, torso); cyl(c, 0.04, 0.04, 0.8, 5, glow, i * 0.13, 0.55, -0.3, torso); }
    // long neck and the face
    B(0.1, 0.28, 0.1, 0, 0.85, 0.02, armor, torso);
    face(c, torso, 1.05, 0.08, armor);
    // tuning-fork crown: two tall prongs rising either side, joined by a bridge, with a short centre spike
    for (const s of [-1, 1]) {
      B(0.05, 0.5, 0.05, s * 0.12, 1.28, -0.02, trim, torso, true);
      cone(c, 0.05, 0.2, 4, trim, s * 0.12, 1.63, -0.02, torso, true);
    }
    B(0.29, 0.05, 0.05, 0, 1.12, -0.04, trim, torso, true);
    cone(c, 0.04, 0.2, 4, accent, 0, 1.27, 0.05, torso, true);
    // pauldron horns
    for (const s of [-1, 1]) {
      B(0.2, 0.1, 0.3, s * 0.3, 0.68, 0, armor, torso, false, [0, 0, s * -0.25]);
      cone(c, 0.05, 0.4, 4, trim, s * 0.38, 0.88, -0.05, torso, false, [-0.2, 0, s * -0.4]);
    }
    // four arms: the upper right holds the arc lance, the rest hang
    const up = [arm(c, torso, -0.27, 0.64, 0.46, 0.07, bodyMat, -0.9, 0.1), arm(c, torso, 0.27, 0.64, 0.46, 0.07, bodyMat, -1.35, -0.05)];
    arm(c, torso, -0.2, 0.38, 0.36, 0.06, bodyMat, -0.7, 0.25);
    arm(c, torso, 0.2, 0.38, 0.36, 0.06, bodyMat, -0.6, -0.25);
    c.arms.push(...up);
    B(0.05, 0.7, 0.05, 0.3, 0.55, 0.2, dark, torso, false, [PI / 2, 0, 0]);
    cone(c, 0.06, 0.2, 4, glow, 0.3, 0.55, 0.58, torso, false, [PI / 2, 0, 0]);
    c.muzzle.position.set(0.3, 0.55, 0.62);
    torso.add(c.muzzle);
    c.height = 2.6;
  },

  /** Draksis, Winter Kell: broad and low, a fan of ice crystals behind the head, spiked ice pauldrons, a shoulder-slung shrapnel cannon. */
  kell(c) {
    const { B, add, bodyMat, dark } = c;
    const armor = mat(0x8a8f96), ice = mat(0xcdefff, { emissive: 0x8fd8ff, emissiveIntensity: 1.3 }), fur = mat(0x3d4f6a);
    legs(c, 1.0, 0.26, 0.2, dark, armor, true);
    const torso = c.pivot(0, 1.0, 0);
    torso.rotation.x = 0.22;
    c.torso = torso;
    B(0.5, 0.24, 0.34, 0, 0.12, 0, dark, torso);
    B(0.8, 0.42, 0.42, 0, 0.46, 0, bodyMat, torso);
    B(0.6, 0.2, 0.1, 0, 0.5, 0.24, armor, torso);
    for (const y of [0.4, 0.58]) B(0.52, 0.03, 0.04, 0, y, 0.3, ice, torso);
    // low heavy head between huge shoulders, with a fan of ice crystals
    face(c, torso, 0.82, 0.12, armor, 1.15);
    for (let i = -2; i <= 2; i++) cone(c, 0.055, 0.5 - Math.abs(i) * 0.07, 4, ice, i * 0.1, 1.08 - Math.abs(i) * 0.03, -0.06, torso, true, [-0.15, 0, -i * 0.28]);
    // ice-crusted pauldrons with outward spikes
    for (const s of [-1, 1]) {
      B(0.42, 0.24, 0.5, s * 0.5, 0.72, 0, armor, torso, false, [0, 0, s * -0.22]);
      B(0.44, 0.04, 0.52, s * 0.5, 0.82, 0, ice, torso, false, [0, 0, s * -0.22]);
      for (let k = 0; k < 2; k++) cone(c, 0.07, 0.4, 4, ice, s * (0.58 + k * 0.1), 0.95 + k * 0.1, -0.05 - k * 0.1, torso, false, [0, 0, s * -(0.5 + k * 0.4)]);
    }
    // pelt mantle down the back
    B(0.9, 1.1, 0.05, 0, 0.1, -0.28, fur, torso, false, [0.2, 0, 0]);
    // arms: huge upper pair, small lower pair
    const up = [arm(c, torso, -0.5, 0.66, 0.55, 0.14, bodyMat, -1.1, 0.08), arm(c, torso, 0.5, 0.66, 0.55, 0.14, bodyMat, -1.1, -0.08)];
    for (const a of up) B(0.2, 0.22, 0.2, 0, -0.5, 0, armor, a);
    arm(c, torso, -0.24, 0.36, 0.4, 0.08, bodyMat, -0.9, 0.3);
    arm(c, torso, 0.24, 0.36, 0.4, 0.08, bodyMat, -0.9, -0.3);
    c.arms.push(...up);
    // shrapnel launcher: twin barrels slung over the right shoulder
    B(0.26, 0.28, 0.6, 0.34, 0.5, 0.4, armor, torso);
    for (const dx of [-0.06, 0.06]) add(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 6).rotateX(PI / 2), dark, 0.34 + dx, 0.52, 0.85, torso);
    gun(c, torso, 0.34, 0.4, 0.7, 0.6, 0.1);
    c.height = 2.3;
  },
};
