import * as THREE from 'three';
import { mat } from './world.js';
import { PI, cone, cyl, ico, tor, legs, arm, gun } from './boss-kit.js';

// ---------------------------------------------------------------------------
// U29: Scorn bosses (Barons of the Tangled Shore). Shared language: stitched and corroded plate, rust and bone, breathing hoses, scavenged
// scrap bolted on, sickly green ether. Araskes (a lanky hosed gunner), Reksis (a hunched hive-grown caster), Fikrul (a long-armed berserker).
// ---------------------------------------------------------------------------
const rust = () => mat(0x7a4a2a), bone = () => mat(0xbfb59a);
const ETHER = () => mat(0x9cff6a, { emissive: 0x6aff3a, emissiveIntensity: 2.4 });

/** Scorn skull-mask head (crit): a tall bone block with eye slits and a breathing grille. */
function mask(c, p, y, z, m, s = 1) {
  c.B(0.2 * s, 0.26 * s, 0.24 * s, 0, y, z, m, p, true);
  c.B(0.14 * s, 0.07 * s, 0.1 * s, 0, y - 0.16 * s, z + 0.1 * s, c.dark, p, true);
  for (const k of [-1, 1]) c.B(0.04 * s, 0.03 * s, 0.03 * s, k * 0.05 * s, y + 0.03 * s, z + 0.13 * s, c.accent, p, true);
}
/** A drooping breathing hose: a few joined segments hanging from (x,y,z). */
function hose(c, p, x, y, z, n, m, dx = 0.04) {
  for (let i = 0; i < n; i++) c.B(0.035, 0.12, 0.035, x + dx * i * (i % 2 ? 0.5 : 1), y - i * 0.11, z, m, p, false, [0, 0, dx * i]);
}

export const SCORN_BOSSES = {
  /** Araskes, the Trickster: tall and lean, hose-mask, long scrap-barrel gun along the right arm, mine belt, bell-shaped scrap pack. */
  baron(c) {
    const { B, bodyMat, dark } = c;
    const rag = mat(0x4a3a30), pipe = mat(0x8a8f96);
    const mine = mat(0xffd040, { emissive: 0xffa020, emissiveIntensity: 1.6 });
    legs(c, 0.98, 0.1, 0.085, dark, rust(), true);
    const torso = c.pivot(0, 0.98, 0);
    torso.rotation.x = 0.16;
    c.torso = torso;
    B(0.24, 0.22, 0.18, 0, 0.1, 0, dark, torso);
    B(0.32, 0.46, 0.2, 0, 0.45, 0, bodyMat, torso);
    for (let i = 0; i < 3; i++) B(0.34, 0.03, 0.22, 0, 0.3 + i * 0.12, 0, bone(), torso); // rib bands
    mask(c, torso, 0.86, 0.06, bone(), 1);
    hose(c, torso, 0.08, 0.76, 0.18, 4, pipe); // hoses from the mask to the pack
    cone(c, 0.2, 0.4, 5, rag, 0, 1.03, -0.05, torso); // cowl
    // bell-shaped scrap pack with a bent antenna
    cyl(c, 0.14, 0.26, 0.6, 6, rust(), 0, 0.5, -0.27, torso);
    B(0.03, 0.45, 0.03, 0.1, 1.0, -0.28, pipe, torso, false, [0.1, 0, -0.1]);
    // mine belt
    for (let i = 0; i < 4; i++) cyl(c, 0.045, 0.045, 0.05, 6, mine, -0.15 + i * 0.1, 0.18, 0.13, torso, false, [PI / 2, 0, 0]);
    // asymmetry: the left shoulder carries a scavenged plate, the right arm a huge long gun
    B(0.2, 0.2, 0.26, -0.22, 0.72, 0, rust(), torso, false, [0, 0, 0.3]);
    const arms = [arm(c, torso, -0.22, 0.62, 0.55, 0.07, bodyMat, -0.9, 0.1), arm(c, torso, 0.22, 0.62, 0.55, 0.075, bodyMat, -1.4, -0.05)];
    c.arms.push(...arms);
    B(0.1, 0.12, 0.6, 0.22, 0.4, 0.4, dark, torso);
    B(0.05, 0.05, 0.3, 0.22, 0.5, 0.45, c.accent, torso);
    for (const z of [0.25, 0.5]) B(0.14, 0.16, 0.06, 0.22, 0.4, z, pipe, torso);
    c.muzzle.position.set(0.22, 0.4, 0.73);
    torso.add(c.muzzle);
    // tattered half-coat
    B(0.3, 0.8, 0.03, -0.05, -0.05, -0.15, rag, torso, false, [0.15, 0, 0.05]);
    c.height = 2.1;
  },

  /** Reksis, the Mindbender: a hunched caster under a hive-grown carapace, a green growth hanging from the back like a lantern, long bone staff. */
  mindbender(c) {
    const { B, bodyMat, dark } = c;
    const chitin = mat(0x2a2a24), growth = mat(0x4f7a2a, { emissive: 0x6aff3a, emissiveIntensity: 0.9 }), green = ETHER();
    legs(c, 0.95, 0.12, 0.09, dark, chitin, true);
    const torso = c.pivot(0, 0.95, 0);
    torso.rotation.x = 0.2;
    c.torso = torso;
    B(0.3, 0.24, 0.2, 0, 0.12, 0, dark, torso);
    B(0.4, 0.44, 0.26, 0, 0.46, 0, bodyMat, torso);
    B(0.44, 0.08, 0.3, 0, 0.7, 0, chitin, torso); // yoke
    // hunch: a hive carapace dome over the shoulders with ribs
    ico(c, 0.32, 0, chitin, 0, 0.78, -0.18, torso).scale.set(1.2, 0.8, 0.9);
    for (let i = -2; i <= 2; i++) cone(c, 0.035, 0.34, 4, chitin, i * 0.1, 0.98, -0.2, torso, false, [-0.5, 0, -i * 0.15]);
    // hooded skull-mask with two small horns
    mask(c, torso, 0.92, 0.12, bone(), 1);
    cone(c, 0.035, 0.18, 4, chitin, 0.09, 1.08, 0.08, torso, false, [0, 0, -0.5]);
    cone(c, 0.035, 0.18, 4, chitin, -0.09, 1.08, 0.08, torso, false, [0, 0, 0.5]);
    // growths: a green lantern-sac hanging off the back by a chain, bulbs on the shoulders
    B(0.02, 0.4, 0.02, 0.0, 0.7, -0.3, dark, torso);
    ico(c, 0.14, 0, green, 0, 0.45, -0.32, torso);
    ico(c, 0.1, 0, growth, -0.26, 0.72, 0, torso);
    ico(c, 0.12, 0, growth, 0.28, 0.62, 0.04, torso);
    // robe strips
    for (let i = 0; i < 3; i++) B(0.12, 0.7 - (i % 2) * 0.2, 0.02, -0.12 + i * 0.12, 0.0, 0.14, mat(0x3c4a3a), torso, false, [-0.05, 0, (i - 1) * 0.05]);
    // arms: the right wields a tall bone staff topped with a green eye, the left hangs, claws
    const arms = [arm(c, torso, -0.26, 0.62, 0.5, 0.07, bodyMat, -0.7, 0.2), arm(c, torso, 0.26, 0.62, 0.5, 0.07, bodyMat, -1.25, -0.1)];
    c.arms.push(...arms);
    B(0.04, 1.9, 0.04, 0.46, 0.35, 0.28, bone(), torso);
    for (const s of [-1, 1]) cone(c, 0.025, 0.28, 4, chitin, 0.46 + s * 0.1, 1.28, 0.28, torso, false, [0, 0, s * -0.7]);
    ico(c, 0.11, 0, green, 0.46, 1.32, 0.28, torso);
    c.muzzle.position.set(0.46, 1.32, 0.42);
    torso.add(c.muzzle);
    c.height = 2.2;
  },

  /** Fikrul, the Fanatic: a berserker, bent double, with a pair of oversized dragging arms, a ram-horn mask and an ether-lit chest cavity. */
  fanatic(c) {
    const { B, bodyMat, dark } = c;
    const ether = ETHER(), rag = mat(0x4a4038), chain = mat(0x6f716a);
    legs(c, 0.98, 0.14, 0.1, dark, dark, true);
    const torso = c.pivot(0, 0.98, 0);
    torso.rotation.x = 0.1;
    c.torso = torso;
    B(0.26, 0.24, 0.2, 0, 0.12, 0, dark, torso);
    B(0.44, 0.5, 0.3, 0, 0.5, 0, bodyMat, torso);
    // open chest cavity lit with ether, caged by bone ribs
    B(0.22, 0.3, 0.06, 0, 0.5, 0.16, ether, torso);
    for (const s of [-1, 0, 1]) B(0.04, 0.38, 0.06, s * 0.09, 0.5, 0.19, bone(), torso, false, [0, 0, s * 0.15]);
    // skull mask with two big curling ram horns (crit)
    mask(c, torso, 0.94, 0.1, bone(), 1.15);
    for (const s of [-1, 1]) {
      cone(c, 0.07, 0.34, 5, bone(), s * 0.2, 1.12, 0.02, torso, true, [0, 0, s * -1.0]);
      cone(c, 0.05, 0.3, 5, bone(), s * 0.36, 1.0, 0.02, torso, true, [0, 0, s * 0.5]);
    }
    // chains of trophies across the back and a ragged hump
    B(0.5, 0.3, 0.3, 0, 0.78, -0.14, rag, torso);
    for (let i = 0; i < 3; i++) B(0.03, 0.42, 0.03, -0.12 + i * 0.12, 0.28, -0.22, chain, torso, false, [0.1, 0, 0.05 * i]);
    // arms: two long ones (the animating pair), hands as heavy blocks that nearly reach the ground; a gun on the right wrist
    const up = [arm(c, torso, -0.3, 0.7, 0.8, 0.11, bodyMat, -0.3, 0.15), arm(c, torso, 0.3, 0.7, 0.8, 0.11, bodyMat, -0.5, -0.1)];
    for (const a of up) { B(0.2, 0.26, 0.24, 0, -0.85, 0, rust(), a); cone(c, 0.05, 0.2, 4, bone(), 0, -1.05, 0, a, false, [PI, 0, 0]); }
    c.arms.push(...up);
    gun(c, torso, 0.36, 0.5, 0.35, 0.4, 0.08);
    // spine spikes
    for (let i = 0; i < 4; i++) cone(c, 0.03, 0.2, 4, bone(), 0, 0.3 + i * 0.16, -0.2 - i * 0.02, torso, false, [-0.8, 0, 0]);
    c.height = 2.3;
  },
};
