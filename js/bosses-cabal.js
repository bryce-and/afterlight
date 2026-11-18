import * as THREE from 'three';
import { mat } from './world.js';
import { PI, cone, ico, grow, horns, shoulderSpikes, cape } from './boss-kit.js';
import { cabal } from './models-cabal.js';

// U29: Cabal bosses are the Legion's own units grown and made more imposing: Valus a Centurion in a red war-cape and crest, Bracus a Phalanx
// with a horned helm, Ghaul a Colossus under a tall gold crown, the Psion Flayers three Psions linked by Light. (The Leviathan dungeon bosses
// and Emperor Calus keep their own models.)
const gold = () => mat(0xb89a5a), steel = () => mat(0x4a4440);
const psi = () => mat(0xff9a6a, { emissive: 0xff5a2a, emissiveIntensity: 2.2 });
const light = () => mat(0xfff4d0, { emissive: 0xffd36a, emissiveIntensity: 2.8 });

/** A copy of the build kit that builds a second unit into its own pivot (so the Flayers' twins get their own legs, arms and torso). */
function subKit(c, root) {
  const sub = { ...c, g: root, legs: [], arms: [], torso: null, muzzle: new THREE.Object3D() };
  sub.add = (geo, m, x, y, z, parent = root, crit = false, r = null) => c.add(geo, m, x, y, z, parent, crit, r);
  sub.B = (w, h, d, x, y, z, m, parent = root, crit = false, r = null) => c.add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, crit, r);
  sub.pivot = (x, y, z, parent = root) => c.pivot(x, y, z, parent);
  return sub;
}

export const CABAL_BOSSES = {
  valus: (c) => grow(c, (k) => cabal(k, 'captain'), 2.45, (k) => {
    const t = k.torso;
    k.B(0.05, 0.15, 0.45, 0, 1.08, -0.02, mat(c.C.accent), t, true); // a tall crest over the helm
    shoulderSpikes(k, t, 0.42, 0.84, 2, 0.4, gold());
    cape(k, t, 0.8, 1.5, mat(c.C.accent));
  }, 0.107),
  bracus: (c) => grow(c, (k) => cabal(k, 'lg_phalanx'), 2.4, (k) => {
    const t = k.torso;
    horns(k, t, 1.02, -0.02, 2, 0.5, gold(), 0.2, 1.0);
    shoulderSpikes(k, t, 0.44, 0.86, 2, 0.4, gold());
  }, 0.215),
  ghaul: (c) => grow(c, (k) => cabal(k, 'heavy'), 2.9, (k) => {
    const t = k.torso;
    k.B(0.04, 0.5, 0.04, 0, 1.4, -0.04, gold(), t);
    horns(k, t, 1.2, -0.06, 2, 0.75, gold(), 0.18, 0.4); // a tall horned crown
    for (const y of [0.4, 0.62]) k.B(0.6, 0.03, 0.03, 0, y, 0.3, light(), t); // Light through the armour seams
    shoulderSpikes(k, t, 0.5, 0.95, 2, 0.5, gold());
    cape(k, t, 0.95, 2.0, mat(0x2a2420));
    ico(k, 0.13, 1, light(), 0.4, 0.4, 0.55, t);
  }, 0.506),
  psionflayer: (c) => {
    // the Flayers fight as a trio: the lead Psion and two twins hovering behind it on linked Light
    grow(c, (k) => {
      cabal(k, 'lg_psion');
      for (const s of [-1, 1]) {
        const root = k.pivot(s * 0.75, 0.15, -0.45);
        root.scale.setScalar(0.85);
        root.rotation.y = s * -0.3;
        cabal(subKit(k, root), 'lg_psion');
        k.add(new THREE.TorusGeometry(0.22, 0.03, 4, 12), psi(), 0, -0.25, 0, root, false, [PI / 2, 0, 0]);
        k.B(0.03, 0.03, 0.85, s * 0.38, 1.3, -0.22, psi(), k.g, false, [0, s * 1.0, 0]); // links between the heads
      }
    }, 2.2, null, 1.197);
  },
};
