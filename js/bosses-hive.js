import * as THREE from 'three';
import { mat } from './world.js';
import { PI, cone, cyl, ico, tor, legs, arm } from './boss-kit.js';

// ---------------------------------------------------------------------------
// U29: Hive bosses. Shared language: black chitin over bone, ribbed torsos, ritual blades glowing sickly green, crowns of horns and
// ragged shrouds. Sardok (a low shield-bearing knight), Kathok (a tall blade-and-banner champion), Crota (a towering horned god-prince),
// Omnigul (a gaunt hooded wizard), Ir Halak (a squat egg-laden brood wizard), Sedrak (a hovering bone bell).
// ---------------------------------------------------------------------------
const bone = () => mat(0x9a9480), chitin = () => mat(0x1e1e1a), shroud = () => mat(0x2e2a22);
const GLOW = () => mat(0xa8ff7a, { emissive: 0x4aff2a, emissiveIntensity: 2.6 });

/** Hive head (crit): a chitin block with a glowing slit. */
function head(c, p, y, z, s = 1, m = null) {
  c.B(0.26 * s, 0.26 * s, 0.3 * s, 0, y, z, m || chitin(), p, true);
  c.B(0.2 * s, 0.035 * s, 0.04 * s, 0, y, z + 0.16 * s, c.accent, p, true);
}
/** Ritual blade held in an arm: runs along the arm's +z so it stands up at rest and swings on melee. */
function blade(c, a, len, armLen, width) {
  const m = GLOW(), hilt = mat(0x3a3428);
  c.B(0.06, 0.06, 0.3, 0, -armLen, 0.05, hilt, a);
  c.B(width * 1.8, 0.06, 0.06, 0, -armLen, 0.2, hilt, a);
  c.B(width, 0.05, len, 0, -armLen, 0.2 + len / 2, m, a);
  cone(c, width * 0.6, 0.2, 4, m, 0, -armLen, 0.3 + len, a, false, [PI / 2, 0, 0]);
}
/** Chitin torso on a pivot with a rib cage. */
function torsoRibs(c, hipY, w, lean, mBody) {
  const t = c.pivot(0, hipY, 0);
  t.rotation.x = lean;
  c.torso = t;
  c.B(0.3 * w, 0.24, 0.22, 0, 0.12, 0, chitin(), t);
  c.B(0.44 * w, 0.5, 0.3, 0, 0.5, 0, mBody, t);
  for (let i = 0; i < 4; i++) c.B(0.5 * w, 0.04, 0.06, 0, 0.3 + i * 0.1, 0.17, bone(), t);
  return t;
}

export const HIVE_BOSSES = {
  /** Sardok, Eye of Oryx: low and wide, a great bone ward-shield on the left arm, a cleaver held low, tall single horn. */
  knight(c) {
    const { B, bodyMat, accent } = c;
    legs(c, 0.9, 0.16, 0.14, chitin(), chitin(), true);
    const t = torsoRibs(c, 0.9, 1.3, 0.1, bodyMat);
    head(c, t, 0.9, 0.04, 1);
    cone(c, 0.06, 0.38, 4, bone(), 0, 1.16, 0, t, true); // the one tall horn
    for (const s of [-1, 1]) B(0.08, 0.22, 0.3, s * 0.16, 0.86, 0, bone(), t);
    // heavy shoulders with a spiked collar
    for (const s of [-1, 1]) { B(0.3, 0.2, 0.4, s * 0.4, 0.76, 0, bone(), t, false, [0, 0, s * -0.3]); for (let i = 0; i < 2; i++) cone(c, 0.05, 0.3, 4, chitin(), s * (0.34 + i * 0.1), 0.94, -0.06, t, false, [0, 0, s * -0.4]); }
    B(0.2, 0.2, 0.04, 0, 0.5, 0.19, accent, t);
    // left arm: a big bone ward-shield (fixed plates standing off the arm)
    const arms = [arm(c, t, -0.42, 0.66, 0.6, 0.13, chitin(), -0.5, 0.1), arm(c, t, 0.42, 0.66, 0.6, 0.13, chitin(), -1.2, -0.1)];
    c.arms.push(...arms);
    B(0.12, 0.9, 0.55, -0.62, 0.35, 0.2, bone(), t);
    B(0.06, 0.6, 0.3, -0.62, 0.35, 0.45, GLOW(), t);
    // right arm: a long straight cleaver
    blade(c, arms[1], 0.55, 0.6, 0.14);
    c.muzzle.position.set(0, 0.6, 0.4);
    t.add(c.muzzle);
    c.height = 2.2;
  },

  /** Kathok, Swordbearer: tall and lean, a ram-horn helm, a banner-cloak of bone plates down the back, one enormous sword. */
  swordbearer(c) {
    const { B, bodyMat, accent } = c;
    legs(c, 0.98, 0.14, 0.11, chitin(), chitin(), true);
    const t = torsoRibs(c, 0.98, 1.15, 0.12, bodyMat);
    head(c, t, 0.94, 0.04, 1);
    for (const s of [-1, 1]) { // ram horns curling down and out
      cone(c, 0.07, 0.36, 5, bone(), s * 0.2, 1.0, 0, t, false, [0, 0, s * -1.2]);
      cone(c, 0.05, 0.3, 5, bone(), s * 0.34, 0.88, 0, t, false, [0, 0, s * 0.7]);
    }
    cone(c, 0.05, 0.4, 4, chitin(), 0, 1.22, -0.03, t, true);
    for (const s of [-1, 1]) { B(0.26, 0.14, 0.34, s * 0.36, 0.76, 0, bone(), t, false, [0, 0, s * -0.25]); cone(c, 0.05, 0.36, 4, chitin(), s * 0.4, 0.95, -0.04, t, false, [0, 0, s * -0.3]); }
    // banner-cloak: overlapping bone plates hanging from the shoulders
    B(0.56, 0.16, 0.14, 0, 0.78, -0.16, shroud(), t);
    for (let i = 0; i < 5; i++) B(0.4 - i * 0.05, 0.2, 0.04, 0, 0.6 - i * 0.22, -0.2 - i * 0.04, i % 2 ? shroud() : bone(), t, false, [0.15, 0, 0]);
    B(0.16, 0.16, 0.04, 0, 0.52, 0.19, accent, t);
    const arms = [arm(c, t, -0.34, 0.66, 0.6, 0.1, chitin(), -0.6, 0.15), arm(c, t, 0.34, 0.66, 0.6, 0.1, chitin(), -1.15, -0.1)];
    c.arms.push(...arms);
    for (const a of arms) c.B(0.14, 0.18, 0.14, 0, -0.45, 0, bone(), a);
    blade(c, arms[1], 1.3, 0.6, 0.15);
    c.muzzle.position.set(0, 0.6, 0.4);
    t.add(c.muzzle);
    c.height = 2.3;
  },

  /** Crota, Son of Oryx: a giant whose antlered crown reaches far over the head, a hollow glowing ribcage, huge spiked pauldrons, a war-blade. */
  crota(c) {
    const { B, bodyMat, dark, accent } = c;
    const horn = bone(), cape = shroud();
    legs(c, 1.2, 0.26, 0.22, chitin(), bone(), true);
    for (const s of [-1, 1]) cone(c, 0.08, 0.4, 4, bone(), s * 0.26, 0.55, 0.28, undefined, false, [0.9, 0, 0]);
    const t = torsoRibs(c, 1.2, 1.75, 0.14, bodyMat);
    t.scale.setScalar(1.15);
    B(0.2, 0.34, 0.06, 0, 0.5, 0.2, GLOW(), t); // the hollow glowing core of the ribs
    head(c, t, 1.0, 0.06, 1.15, bone());
    B(0.06, 0.06, 0.04, 0, 1.0, 0.24, accent, t, true);
    // antlered crown: two great tines forking up and out
    for (const s of [-1, 1]) {
      B(0.06, 0.6, 0.06, s * 0.16, 1.4, -0.02, horn, t, false, [0, 0, s * -0.22]);
      for (let i = 0; i < 3; i++) cone(c, 0.04, 0.4 - i * 0.06, 4, horn, s * (0.24 + i * 0.1), 1.55 + i * 0.16, -0.02, t, false, [0, 0, s * (-0.7 + i * 0.2)]);
    }
    cone(c, 0.06, 0.6, 4, horn, 0, 1.55, -0.04, t);
    // massive pauldrons with a fan of blades
    for (const s of [-1, 1]) {
      B(0.4, 0.26, 0.6, s * 0.55, 0.9, 0, horn, t, false, [0, 0, s * -0.3]);
      for (let i = 0; i < 4; i++) cone(c, 0.07, 0.6 - i * 0.08, 4, chitin(), s * (0.5 + i * 0.07), 1.05 + i * 0.05, -0.1 + i * 0.06, t, false, [-0.2, 0, s * -(0.2 + i * 0.08)]);
    }
    // tattered war-cape
    B(1.1, 0.26, 0.22, 0, 0.9, -0.2, cape, t);
    for (let i = 0; i < 5; i++) { const L = 1.6 + ((i * 3) % 3) * 0.2; B(0.22, L, 0.03, -0.45 + i * 0.22, 0.85 - L / 2, -0.3, cape, t, false, [0.15, 0, (i - 2) * 0.04]); }
    const arms = [arm(c, t, -0.5, 0.8, 0.7, 0.18, chitin(), -0.8, 0.1), arm(c, t, 0.5, 0.8, 0.7, 0.18, chitin(), -1.15, -0.1)];
    c.arms.push(...arms);
    for (const a of arms) c.B(0.28, 0.3, 0.28, 0, -0.55, 0, horn, a);
    blade(c, arms[1], 2.0, 0.7, 0.22);
    c.muzzle.position.set(0, 0.6, 0.4);
    t.add(c.muzzle);
    c.height = 3.0;
  },

  /** Omnigul, Will of Crota: a gaunt hooded wizard on a long shroud, a forked gem-crowned skull, arms trailing ritual ribbons. */
  wizard(c) {
    const { B, bodyMat } = c;
    const robe = mat(0x2e3a2a), rag = mat(0x3a4a32), gem = GLOW();
    cyl(c, 0.18, 0.5, 0.9, 7, robe, 0, 0.5, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; B(0.14, 0.3 + (i % 3) * 0.08, 0.03, Math.sin(a) * 0.48, 0.12, Math.cos(a) * 0.48, rag, undefined, false, [0.1, a, 0]); }
    legs(c, 1.0, 0.08, 0.06, chitin(), chitin(), true);
    const t = c.pivot(0, 1.0, 0);
    t.rotation.x = 0.05;
    c.torso = t;
    B(0.22, 0.26, 0.18, 0, 0.12, 0, robe, t);
    B(0.32, 0.44, 0.22, 0, 0.46, 0, bodyMat, t);
    for (let i = 0; i < 4; i++) B(0.34, 0.03, 0.04, 0, 0.32 + i * 0.1, 0.12, bone(), t);
    // tall cowl, skull face, a glowing gem set in the brow (crit)
    cone(c, 0.26, 0.6, 6, robe, 0, 0.98, -0.06, t);
    c.add(new THREE.IcosahedronGeometry(0.13, 0), bone(), 0, 0.86, 0.06, t, true).scale.set(0.9, 1.2, 1);
    ico(c, 0.07, 0, gem, 0, 1.0, 0.16, t, true);
    for (const s of [-1, 1]) cone(c, 0.03, 0.36, 4, bone(), s * 0.1, 1.08, 0.02, t, true, [0, 0, s * -0.55]);
    B(0.6, 0.1, 0.3, 0, 0.68, 0, robe, t);
    // long thin arms with ribbons, an orb held between the hands
    const arms = [arm(c, t, -0.24, 0.62, 0.65, 0.05, bodyMat, -0.7, 0.1), arm(c, t, 0.24, 0.62, 0.65, 0.05, bodyMat, -0.7, -0.1)];
    c.arms.push(...arms);
    for (const a of arms) for (let i = 0; i < 2; i++) B(0.05, 0.4 + i * 0.15, 0.02, (i - 0.5) * 0.08, -0.85, -0.04, rag, a);
    ico(c, 0.12, 1, gem, 0, 0.4, 0.4, t);
    for (let i = 0; i < 3; i++) B(0.2, 0.9 + i * 0.15, 0.03, -0.18 + i * 0.18, -0.25 - i * 0.05, -0.2, rag, t, false, [0.25, 0, 0]);
    c.muzzle.position.set(0, 0.4, 0.52);
    t.add(c.muzzle);
    c.height = 2.2;
  },

  /** Ir Halak, Brood Wizard: squat and broad, a frill crest, a sac of eggs on its back, a bone staff with a hanging egg. */
  broodwizard(c) {
    const { B, bodyMat } = c;
    const egg = mat(0x9fb67a, { emissive: 0x4a7a2a, emissiveIntensity: 0.7 }), robe = mat(0x2a3626), gem = GLOW();
    legs(c, 0.85, 0.18, 0.13, chitin(), chitin(), true);
    const t = c.pivot(0, 0.85, 0);
    t.rotation.x = 0.28;
    c.torso = t;
    B(0.4, 0.28, 0.3, 0, 0.14, 0, robe, t);
    B(0.62, 0.5, 0.38, 0, 0.55, 0, bodyMat, t);
    for (let i = 0; i < 3; i++) B(0.56, 0.04, 0.06, 0, 0.4 + i * 0.12, 0.21, bone(), t);
    // a frilled head: wide fan of bone spines behind a small skull, a gem in the crown (crit)
    c.add(new THREE.IcosahedronGeometry(0.15, 0), chitin(), 0, 0.98, 0.06, t, true).scale.set(1.1, 1, 1.1);
    ico(c, 0.07, 0, gem, 0, 1.1, 0.12, t, true);
    for (let i = -3; i <= 3; i++) cone(c, 0.04, 0.4 - Math.abs(i) * 0.05, 4, bone(), i * 0.1, 1.05, -0.1, t, false, [-0.4, 0, -i * 0.3]);
    // pauldrons and a big egg sac on the back
    for (const s of [-1, 1]) B(0.26, 0.16, 0.34, s * 0.44, 0.82, 0, bone(), t, false, [0, 0, s * -0.3]);
    for (let i = 0; i < 5; i++) ico(c, 0.14 - (i % 2) * 0.03, 0, egg, ((i % 3) - 1) * 0.16, 0.48 + (i % 2) * 0.22 - (i > 2 ? 0.1 : 0), -0.32 - (i % 2) * 0.05, t);
    const arms = [arm(c, t, -0.4, 0.7, 0.6, 0.1, bodyMat, -1.1, 0.2), arm(c, t, 0.4, 0.7, 0.6, 0.1, bodyMat, -1.35, -0.1)];
    c.arms.push(...arms);
    // staff in the right hand ending in a hanging egg
    B(0.04, 1.6, 0.04, 0.5, 0.4, 0.3, bone(), t);
    ico(c, 0.13, 0, egg, 0.5, 0.2, 0.3, t);
    c.muzzle.position.set(0.5, 0.2, 0.45);
    t.add(c.muzzle);
    c.height = 2.15;
  },

  /** Sedrak, Song of Savathun: a hovering bone bell, a vertical maw with the eye in it, hanging chime bones, a crown of spines. */
  shrieker(c) {
    const { add, bodyMat, dark, accent } = c;
    const ch = chitin(), glow = mat(0x1c2a20, { emissive: 0x1a4a20, emissiveIntensity: 0.6 });
    c.hover = true;
    const body = c.pivot(0, 1.35, 0);
    c.torso = body;
    cyl(c, 0.35, 0.95, 1.5, 8, bodyMat, 0, 0, 0, body); // the bell: narrow at the crown, flared at the lip
    cyl(c, 0.95, 0.97, 0.12, 8, bone(), 0, -0.78, 0, body);
    cyl(c, 0.75, 0.75, 0.04, 8, glow, 0, -0.84, 0, body);
    // the maw: a tall dark slot with the eye inside (crit) and a ring of teeth
    c.B(0.3, 0.9, 0.12, 0, -0.05, 0.62, dark, body);
    add(new THREE.SphereGeometry(0.2, 8, 6), accent, 0, 0.05, 0.65, body, true).scale.z = 0.6;
    tor(c, 0.26, 0.04, bone(), 0, 0.05, 0.7, body, true, null, 8);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) cone(c, 0.04, 0.2, 4, bone(), s * 0.17, -0.3 + i * 0.28, 0.66, body, false, [0, 0, s * -PI / 2]);
    // rib-spines up the bell and a crown
    for (let k = 0; k < 4; k++) { const a = k * (PI / 2); c.B(0.07, 1.5, 0.07, Math.sin(a) * 0.62, 0, Math.cos(a) * 0.62 * 0.9, ch, body, false, [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35]); }
    for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; cone(c, 0.06, 0.5, 4, bone(), Math.sin(a) * 0.25, 0.95, Math.cos(a) * 0.25, body, false, [Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4]); }
    // chime bones hanging below the lip
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.3; c.B(0.06, 0.55 + (i % 2) * 0.2, 0.06, Math.sin(a) * 0.7, -1.15 - (i % 2) * 0.1, Math.cos(a) * 0.7, bone(), body); }
    c.muzzle.position.set(0, 0.05, 0.85);
    body.add(c.muzzle);
    c.height = 2.6;
  },
};
