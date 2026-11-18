import { mat } from './world.js';
import { cone, ico, grow, horns, shoulderSpikes, cape, backSpines } from './boss-kit.js';
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
  mindbender: (c) => grow(c, (k) => scorn(k, 'sc_stalker'), 2.2, (k) => {
    const t = k.torso, g = mat(0x4f7a2a, { emissive: 0x6aff3a, emissiveIntensity: 0.9 });
    for (const [x, y, z, r] of [[-0.3, 0.78, 0, 0.14], [0.32, 0.72, 0.04, 0.17], [0, 0.55, -0.26, 0.2], [-0.18, 0.9, -0.12, 0.1]]) ico(k, r, 0, g, x, y, z, t);
    ico(k, 0.13, 0, green(), 0, 0.3, -0.34, t);
    backSpines(k, t, 5, 0.5, mat(0x2a2a24), 0.95, 0.3, -0.24);
    horns(k, t, 1.0, -0.02, 2, 0.4, mat(0x2a2a24), 0.1, 0.5);
  }, 0.05),
  fanatic: (c) => grow(c, (k) => scorn(k, 'sc_ravager'), 2.3, (k) => {
    const t = k.torso;
    for (const s of [-1, 1]) { cone(k, 0.09, 0.45, 5, bone(), s * 0.2, 1.05, 0.0, t, false, [0, 0, s * -1.1]); cone(k, 0.06, 0.4, 5, bone(), s * 0.42, 0.92, 0.0, t, false, [0, 0, s * 0.5]); }
    backSpines(k, t, 6, 0.5, bone(), 0.8, 0.15);
    shoulderSpikes(k, t, 0.36, 0.78, 2, 0.4, bone());
  }, 0.357),
};
