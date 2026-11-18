import { mat } from './world.js';
import * as THREE from 'three';
import { PI, cone, ico, grow, horns, shoulderSpikes, cape, backSpines, legs } from './boss-kit.js';
import { scorn } from './models-scorn.js';

// U29: Scorn bosses are the Scorn's own units grown and made more imposing: Araskes a Chieftain with a banner and a bristling mantle,
// Reksis a Stalker grown over with Hive growths, Fikrul a Ravager under ram horns and a spine of bone.
const bone = () => mat(0xbfb59a), rust = () => mat(0x7a4a2a);
const green = () => mat(0x9cff6a, { emissive: 0x6aff3a, emissiveIntensity: 2.4 });

export const SCORN_BOSSES = {
  baron: (c) => grow(c, (k) => scorn(k, 'sc_chieftain'), 2.1, (k) => {
    const t = k.torso;
    shoulderSpikes(k, t, 0.36, 0.84, 3, 0.4, bone());
    horns(k, t, 1.02, -0.02, 2, 0.4, rust(), 0.12, 0.6);
    cape(k, t, 0.5, 1.5, mat(0x9a2a5a));
  }, 0.034),
  // Reksis Vahn, the Mindbender (Bryce's reference, 2026-11-17): built from scratch. A hunched, wide-stanced brute in brown leather and gold plate,
  // arms flung wide in wrapped sleeves ending in pale claws, a huge swept wing of purple bone horns framing a small gold-domed head with
  // three white eyes, bone slabs on the shoulders, a spiked belt, grilled knee guards, a blue light in a chest-mounted device.
  mindbender(c) {
    const { B, bodyMat } = c;
    const pb = mat(0xa08ab8), pbD = mat(0x6a5a80), leather = mat(0x6a4a2c), dark = mat(0x2e2218), gold = mat(0x8a6a30), steel = mat(0x8a8f96), cloak = mat(0x2a2430);
    const wrap = mat(0x5a4328), claw = mat(0xe8e4dc), eyeM = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 3 });
    const blue = mat(0x6ab8ff, { emissive: 0x3a98ff, emissiveIntensity: 3 });
    legs(c, 0.95, 0.24, 0.2, leather, dark, false);
    for (const hip of c.legs) { // grilled knee guard with a spike and strapped shins
      B(0.26, 0.3, 0.12, 0, -0.45, 0.16, gold, hip);
      for (let i = -1; i <= 1; i++) B(0.2, 0.03, 0.02, 0, -0.45 + i * 0.07, 0.23, dark, hip);
      cone(c, 0.04, 0.14, 4, steel, 0, -0.32, 0.22, hip, false, [PI / 2, 0, 0]);
      B(0.24, 0.07, 0.24, 0, -0.75, 0, wrap, hip);
    }
    const t = c.pivot(0, 0.95, 0);
    t.rotation.x = 0.3;
    c.torso = t;
    B(0.62, 0.26, 0.42, 0, 0.1, 0, leather, t);
    B(0.7, 0.1, 0.46, 0, 0.26, 0, dark, t); // belt
    for (let i = -3; i <= 3; i++) cone(c, 0.035, 0.14, 4, steel, i * 0.1, 0.26, 0.25, t, false, [PI / 2, 0, 0]); // belt spikes
    B(0.76, 0.52, 0.46, 0, 0.56, 0, leather, t); // chest
    B(0.5, 0.36, 0.1, 0, 0.58, 0.25, gold, t); // breastplate
    for (const sx of [-1, 1]) cone(c, 0.035, 0.12, 4, steel, sx * 0.2, 0.7, 0.31, t, false, [PI / 2, 0, 0]);
    // the chest device with its cold blue light
    B(0.3, 0.24, 0.34, 0.05, 0.48, 0.36, steel, t);
    ico(c, 0.07, 1, blue, -0.06, 0.46, 0.55, t);
    c.muzzle.position.set(0.12, 0.5, 0.58);
    t.add(c.muzzle);
    // dark tabard between the legs and a cloak behind
    B(0.34, 0.9, 0.03, 0, -0.2, 0.26, cloak, t, false, [-0.05, 0, 0]);
    B(0.7, 1.0, 0.03, 0, 0.1, -0.26, cloak, t, false, [0.12, 0, 0]);
    // head: a small gold dome with three white eyes and a tusked mouth (the weak point), forward on the hunch
    const h = c.pivot(0, 0.98, 0.2, t);
    c.add(new THREE.IcosahedronGeometry(0.13, 0), gold, 0, 0.04, 0, h, true).scale.set(1, 0.95, 1.05);
    B(0.16, 0.1, 0.1, 0, -0.07, 0.1, dark, h, true);
    for (const x of [-0.05, 0, 0.05]) B(0.025, 0.025, 0.02, x, 0.0, 0.13, eyeM, h, true);
    cone(c, 0.03, 0.16, 4, steel, 0, 0.17, -0.02, h); // crown antenna
    // the horn wings: three swept slabs a side, ridged, each longer and hooked at the tip, plus a cowl plate behind the head
    B(0.5, 0.5, 0.06, 0, 0.98, -0.02, pbD, t, false, [-0.15, 0, 0]);
    for (const s of [-1, 1]) {
      B(0.62, 0.1, 0.3, s * 0.4, 1.0, -0.05, pb, t, false, [0, 0, s * 0.45]);
      B(0.55, 0.08, 0.26, s * 0.55, 1.12, -0.08, pbD, t, false, [0, 0, s * 0.75]);
      B(0.4, 0.07, 0.2, s * 0.62, 1.26, -0.1, pb, t, false, [0, 0, s * 1.0]);
      for (let i = 0; i < 4; i++) B(0.03, 0.2, 0.22, s * (0.2 + i * 0.12), 0.98 + i * 0.05, -0.04, pbD, t, false, [0, 0, s * 0.45]); // ridges
      cone(c, 0.06, 0.38, 4, pb, s * 0.78, 1.36, -0.1, t, false, [0, 0, -s * 0.6]); // hooked tips
      cone(c, 0.05, 0.3, 4, pb, s * 0.66, 0.92, 0.0, t, false, [0.3, 0, s * 1.4]);
      B(0.5, 0.34, 0.14, s * 0.46, 0.84, 0, pb, t, false, [0, 0, s * -0.4]); // shoulder slab
      B(0.3, 0.1, 0.2, s * 0.44, 0.7, 0, dark, t);
    }
    // arms flung wide in wrapped sleeves, hands of pale claws
    const arms = [];
    for (const s of [-1, 1]) {
      const a = c.pivot(s * 0.46, 0.7, 0, t);
      a.rotation.set(-0.5, 0, s * -1.25);
      B(0.2, 0.8, 0.2, 0, -0.4, 0, wrap, a);
      for (let i = 0; i < 3; i++) B(0.23, 0.06, 0.23, 0, -0.2 - i * 0.2, 0, dark, a);
      B(0.18, 0.18, 0.18, 0, -0.85, 0, claw, a);
      for (let i = -1; i <= 1; i++) cone(c, 0.03, 0.2, 4, claw, i * 0.06, -1.0, 0.04, a, false, [PI - 0.3, 0, i * 0.2]);
      arms.push(a);
    }
    c.arms.push(...arms);
    c.height = 2.2;
  },

  // Fikrul, the Fanatic (Bryce's reference, 2026-11-17): built from scratch. A huge hunched brute of bulging pale flesh in torn tan cloth, a
  // riveted iron key-shaped plate over a boxed iron head sunk between the shoulders, chain-wrapped spiked forearms and shins, a chain belt,
  // and a long glaive with a pale blue blade.
  fanatic(c) {
    const { B, bodyMat } = c;
    const flesh = mat(0xd9b28a), fleshD = mat(0xb88a6a), cloth = mat(0xc9b070), clothD = mat(0x8a7040), iron = mat(0xb08a3a), ironD = mat(0x6a5420);
    const chain = mat(0x6f716a), bone = mat(0xe8e4dc), rod = mat(0x2a2420);
    const blue = mat(0x8fd8ff, { emissive: 0x3fb8ff, emissiveIntensity: 2.2 });
    legs(c, 0.95, 0.26, 0.26, cloth, fleshD, false);
    for (const hip of c.legs) { // bandaged thighs, chain-wrapped spiked shins
      B(0.32, 0.12, 0.32, 0, -0.25, 0, clothD, hip);
      for (let i = 0; i < 3; i++) { B(0.3, 0.05, 0.3, 0, -0.55 - i * 0.12, 0, chain, hip); cone(c, 0.04, 0.12, 4, iron, 0, -0.55 - i * 0.12, 0.17, hip, false, [PI / 2, 0, 0]); }
    }
    const t = c.pivot(0, 0.95, 0);
    t.rotation.x = 0.5;
    c.torso = t;
    c.add(new THREE.IcosahedronGeometry(0.5, 1), flesh, 0, 0.45, 0, t).scale.set(1.25, 1, 0.95); // the bulging chest and belly
    for (const [x, y, z, r] of [[-0.3, 0.3, 0.3, 0.2], [0.28, 0.5, 0.32, 0.18], [0, 0.18, 0.38, 0.17]]) c.add(new THREE.IcosahedronGeometry(r, 0), fleshD, x, y, z, t);
    for (const s of [-1, 1]) c.add(new THREE.IcosahedronGeometry(0.3, 1), flesh, s * 0.6, 0.75, 0.0, t).scale.set(1, 0.9, 1); // massive shoulders
    // torn cloth: a shawl over the back and shoulders, a long front flap
    B(1.1, 0.4, 0.5, 0, 0.8, -0.08, cloth, t, false, [0.1, 0, 0]);
    B(0.7, 1.0, 0.04, 0, 0.1, 0.46, cloth, t, false, [-0.08, 0, 0]);
    B(0.04, 0.9, 0.5, -0.45, 0.2, -0.1, clothD, t);
    // chain belt with iron plates and spikes
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; B(0.1, 0.07, 0.07, Math.sin(a) * 0.5, 0.0, Math.cos(a) * 0.4, chain, t); }
    B(0.2, 0.2, 0.06, 0, 0.0, 0.42, iron, t);
    // the iron head, low and forward, under the key plate
    const h = c.pivot(0, 0.95, 0.38, t);
    B(0.3, 0.32, 0.3, 0, 0, 0, iron, h, true);
    B(0.2, 0.05, 0.04, 0, 0.02, 0.16, c.accent, h, true); // glowing slit
    B(0.04, 0.34, 0.34, 0, 0.0, 0, ironD, h); // seam
    B(0.1, 0.5, 0.05, 0, 0.38, -0.02, iron, h); // the key plate: a tall bar with two toothed crossbars
    for (const y of [0.52, 0.32]) { B(0.46, 0.07, 0.05, 0, y, -0.02, iron, h); for (const x of [-0.2, 0.2]) B(0.07, 0.14, 0.05, x, y + 0.05, -0.02, iron, h); }
    B(0.34, 0.34, 0.04, 0, 0.08, -0.17, ironD, h); // back plate
    // arms: thick, wrapped in spiked chain, bone-white fists; the right holds a glaive
    const arms = [];
    for (const s of [-1, 1]) {
      const a = c.pivot(s * 0.72, 0.75, 0, t);
      a.rotation.set(s < 0 ? -0.9 : -1.2, 0, s * 0.2);
      B(0.24, 0.9, 0.24, 0, -0.45, 0, fleshD, a);
      for (let i = 0; i < 4; i++) { B(0.3, 0.05, 0.3, 0, -0.25 - i * 0.14, 0, chain, a); cone(c, 0.04, 0.14, 4, iron, 0.17, -0.25 - i * 0.14, 0, a, false, [0, 0, -PI / 2]); }
      c.add(new THREE.IcosahedronGeometry(0.17, 0), bone, 0, -1.0, 0, a);
      arms.push(a);
    }
    c.arms.push(...arms);
    // the glaive is held upright in the right fist (a grip pivot undoes the arm's and the hunch's tilt, so the staff stands while the arm swings it)
    const r = arms[1], grip = c.pivot(0, -1.0, 0, r);
    grip.rotation.x = 0.7;
    B(0.06, 1.5, 0.06, 0, 0.3, 0, rod, grip);
    B(0.2, 0.6, 0.04, 0, 1.35, 0, blue, grip);
    cone(c, 0.1, 0.25, 4, blue, 0, 1.78, 0, grip);
    for (const y of [0.95, 1.05]) B(0.22, 0.05, 0.1, 0, y, 0, iron, grip);
    B(0.12, 0.12, 0.12, 0, -0.4, 0, ironD, grip); // butt cap
    c.muzzle.position.set(0, 1.1, 0.1);
    grip.add(c.muzzle);
    c.height = 2.3;
  },
};
