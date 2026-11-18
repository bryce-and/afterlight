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
  /** The Psion Flayers: built from scratch. Three tall robed Psions with swollen domed heads and a single glowing visor slit, gold shoulder plates
   *  and a fin crest; the lead walks, the twins float behind on rings of Light, all three joined by psionic arcs. */
  psionflayer(c) {
    const { B, bodyMat, dark } = c;
    const suit = mat(0x6a2a24), gold = mat(0xb08a3a), plate = mat(0x2a2228);
    const psion = (parent, x, z, s) => {
      const p = c.pivot(x, 0, z, parent);
      p.scale.setScalar(s);
      p.userData.hips = [-1, 1].map((k) => {
        const hip = c.pivot(k * 0.09, 0.95, 0, p);
        B(0.09, 0.45, 0.1, 0, -0.23, 0.02, suit, hip);
        B(0.09, 0.5, 0.1, 0, -0.7, 0, dark, hip);
        B(0.1, 0.06, 0.16, 0, -0.95, 0.04, gold, hip);
        return hip;
      });
      cone(c, 0.3, 0.6, 6, suit, 0, 0.95, 0, p); // a robe skirt over the hips
      B(0.32, 0.4, 0.2, 0, 1.12, 0, suit, p);
      B(0.36, 0.08, 0.24, 0, 1.3, 0, gold, p);
      for (const k of [-1, 1]) { B(0.2, 0.06, 0.26, k * 0.24, 1.34, 0, gold, p, false, [0, 0, k * -0.25]); cone(c, 0.04, 0.2, 4, gold, k * 0.32, 1.44, -0.02, p, false, [0, 0, k * -0.5]); }
      // the big domed Psion head with its single slit visor (crit) and a fin crest behind it
      c.add(new THREE.SphereGeometry(0.2, 8, 6), bodyMat, 0, 1.55, 0.02, p, true).scale.set(1, 1.15, 1.2);
      B(0.22, 0.04, 0.04, 0, 1.56, 0.24, psi(), p, true);
      for (let i = -2; i <= 2; i++) cone(c, 0.03, 0.34 - Math.abs(i) * 0.05, 4, gold, i * 0.07, 1.78, -0.12, p, false, [-0.4, 0, -i * 0.3]);
      for (const k of [-1, 1]) B(0.06, 0.5, 0.06, k * 0.22, 1.05, 0.12, plate, p, false, [-0.9, 0, k * -0.2]);
      ico(c, 0.07, 0, psi(), 0, 1.18, 0.42, p);
      return p;
    };
    const lead = psion(c.g, 0, 0, 1.15);
    c.torso = lead;
    for (const s of [-1, 1]) {
      const t = psion(c.g, s * 0.75, -0.45, 0.85);
      t.position.y = 0.35;
      t.rotation.y = s * -0.3;
      c.add(new THREE.TorusGeometry(0.22, 0.03, 4, 12), psi(), 0, 0.02, 0, t, false, [PI / 2, 0, 0]);
    }
    for (const s of [-1, 1]) B(0.03, 0.03, 0.85, s * 0.38, 1.95, -0.22, psi(), c.g, false, [0, s * 1.0, 0]); // arcs between the three heads
    c.legs.push(...lead.userData.hips);
    c.muzzle.position.set(0, 1.18, 0.55);
    lead.add(c.muzzle);
    c.height = 2.2;
  },
};
