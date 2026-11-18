import { mat } from './world.js';
import { PI, cone, ico, grow, horns, shoulderSpikes, cape, backSpines } from './boss-kit.js';
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
  // Reksis Vahn (Bryce's reference, 2026-11-17): a bulky spiked-leather brute under a huge swept wing of purple bone horns, bone slabs on the
  // shoulders, spiked belt and knee grilles, a cold blue light in the chest.
  mindbender: (c) => grow(c, (k) => scorn(k, 'sc_stalker'), 2.2, (k) => {
    const t = k.torso, pb = mat(0x9a82b0), pbD = mat(0x6a5a80), blue = mat(0x6ab8ff, { emissive: 0x3a98ff, emissiveIntensity: 3 }), spike = mat(0x8a8f96);
    for (const s of [-1, 1]) { // the horn wings: two long swept slabs with hooked tips
      k.B(0.7, 0.08, 0.3, s * 0.42, 0.98, -0.06, pb, t, false, [0, 0, s * 0.55]);
      k.B(0.5, 0.06, 0.22, s * 0.55, 1.1, -0.08, pbD, t, false, [0, 0, s * 0.8]);
      cone(k, 0.06, 0.4, 4, pb, s * 0.78, 1.15, -0.08, t, false, [0, 0, -s * 0.5]);
      cone(k, 0.05, 0.3, 4, pb, s * 0.55, 0.98, 0.08, t, false, [0.4, 0, s * 1.2]);
      k.B(0.4, 0.34, 0.1, s * 0.42, 0.88, 0, pb, t, false, [0, 0, s * -0.5]); // shoulder slab
      cone(k, 0.04, 0.2, 4, spike, s * 0.2, 0.15, 0.17, t, false, [PI / 2, 0, 0]); // belt spikes
      cone(k, 0.04, 0.2, 4, spike, s * 0.34, 0.2, 0.08, t, false, [PI / 2, 0, -s * 0.8]);
    }
    cone(k, 0.06, 0.3, 4, pb, 0, 0.98, -0.04, t); // brow horn
    ico(k, 0.07, 1, blue, 0, 0.55, 0.22, t);
    for (const hip of k.legs) { k.B(0.12, 0.16, 0.06, 0, -0.42, 0.1, spike, hip); cone(k, 0.04, 0.16, 4, spike, 0, -0.42, 0.16, hip, false, [PI / 2, 0, 0]); }
  }, 0.05),
  // Fikrul, the Fanatic (Bryce's reference, 2026-11-17): a hunched flesh-heavy brute, a riveted key-shaped iron plate on a boxed head, a chain
  // belt, chain-wrapped spiked forearms, a cloth tabard and a long glaive with a pale blue blade.
  fanatic: (c) => grow(c, (k) => scorn(k, 'sc_abomination'), 2.3, (k) => {
    const t = k.torso, iron = mat(0xb08a3a), cloth = mat(0xc9b070), chain = mat(0x6f716a), blue = mat(0x8fd8ff, { emissive: 0x3fb8ff, emissiveIntensity: 2.2 }), rod = mat(0x2a2420);
    k.B(0.3, 0.6, 0.06, 0, 1.95, 0.62, iron, t); // the key plate on the head: a tall bar with two toothed crossbars
    for (const y of [2.1, 1.85]) { k.B(0.55, 0.08, 0.06, 0, y, 0.62, iron, t); for (const x of [-0.25, 0.25]) k.B(0.08, 0.16, 0.06, x, y + 0.06, 0.62, iron, t); }
    k.B(0.4, 0.5, 0.45, 0, 1.5, 0.6, iron, t); // the boxed iron helm
    k.B(0.7, 0.9, 0.04, 0, 0.1, 0.34, cloth, t, false, [-0.05, 0, 0]); // tabard over the front
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; k.B(0.1, 0.06, 0.06, Math.sin(a) * 0.3, 0.2, Math.cos(a) * 0.26, chain, t); } // chain belt
    for (const s of [-1, 1]) { // chain-wrapped spiked forearms
      for (let i = 0; i < 3; i++) cone(k, 0.05, 0.2, 4, iron, s * 0.62, 0.55 - i * 0.12, 0.1, t, false, [0, 0, -s * PI / 2]);
      k.B(0.16, 0.5, 0.16, s * 0.6, 0.45, 0.1, chain, t);
    }
    // the glaive, planted in the right hand
    k.B(0.05, 2.4, 0.05, 0.75, 0.6, 0.45, rod, t);
    k.B(0.22, 0.9, 0.04, 0.75, 1.9, 0.45, blue, t, false, [0, 0, -0.06]);
    cone(k, 0.11, 0.3, 4, blue, 0.75, 2.5, 0.45, t);
    for (const y of [1.45, 1.55]) k.B(0.22, 0.05, 0.1, 0.75, y, 0.45, iron, t);
  }, 0.357),
};
