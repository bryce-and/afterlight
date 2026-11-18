import { mat } from './world.js';
import { cone, grow, horns, shoulderSpikes, cape, backSpines } from './boss-kit.js';
import { fallen } from './models-fallen.js';

// U29: Fallen bosses are the Fallen's own units grown and made more imposing (Bryce, 2026-11-17): Sepiks is a Servitor wrapped in spines,
// Riksis a Captain under a tall forked crown, Draksis the Fallen boss frame in ice and a pelt.
const gold = () => mat(0xc9a64a), ice = () => mat(0xcdefff, { emissive: 0x8fd8ff, emissiveIntensity: 1.3 });

export const FALLEN_BOSSES = {
  servitor: (c) => grow(c, (k) => fallen(k, 'fl_servitor'), 2.1, (k) => {
    const dark = mat(0x2a2a30), b = k.torso;
    for (let i = 0; i < 12; i++) { // a ring of spines round the shell, none across the face
      const a = (i / 12) * Math.PI * 2 + 0.26;
      if (Math.cos(a) > 0.6 && Math.abs(Math.sin(a)) < 0.5) continue;
      cone(k, 0.07, 0.5, 4, dark, Math.sin(a) * 0.62, Math.cos(a) * 0.62, -0.05, b, false, [0, 0, -a]);
    }
    for (let i = -2; i <= 2; i++) cone(k, 0.06, 0.55 - Math.abs(i) * 0.1, 4, gold(), i * 0.2, 0.55, -0.3, b, false, [-0.5, 0, -i * 0.3]); // crest
  }, 0.333),
  archon: (c) => grow(c, (k) => fallen(k, 'captain'), 2.6, (k) => {
    const t = k.torso;
    for (const s of [-1, 1]) { k.B(0.05, 0.5, 0.05, s * 0.14, 1.25, -0.02, gold(), t); cone(k, 0.05, 0.22, 4, gold(), s * 0.14, 1.6, -0.02, t); } // tall forked crown
    k.B(0.33, 0.05, 0.05, 0, 1.1, -0.04, gold(), t);
    shoulderSpikes(k, t, 0.34, 0.78, 2, 0.4, gold());
    cape(k, t, 0.6, 1.5, mat(0x3c2c5a));
  }, 0.176),
  kell: (c) => grow(c, (k) => fallen(k, 'boss'), 2.3, (k) => {
    const t = k.torso;
    horns(k, t, 1.0, -0.04, 3, 0.55, ice(), 0.1, 0.4); // a fan of ice crystals
    shoulderSpikes(k, t, 0.4, 0.8, 3, 0.45, ice());
    cape(k, t, 0.8, 1.6, mat(0x3d4f6a));
  }, 0.217),
};
