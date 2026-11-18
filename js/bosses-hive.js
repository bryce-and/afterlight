import * as THREE from 'three';
import { mat } from './world.js';
import { PI, cone, ico, grow, horns, shoulderSpikes, cape, backSpines } from './boss-kit.js';
import { hive } from './models-hive.js';

// U29: Hive bosses are the Hive's own units grown and made more imposing: Sardok a Knight with horns and a spiked mantle, Kathok the Knight
// with a great ritual blade, Crota a giant antlered Knight, the wizards with crowns and brood growths, Sedrak a Shrieker ringed with spines.
const bone = () => mat(0x9a9480), chitin = () => mat(0x1e1e1a), shroud = () => mat(0x2e2a22);
const GLOW = () => mat(0xa8ff7a, { emissive: 0x4aff2a, emissiveIntensity: 2.6 });

/** Ritual blade in the unit's right arm (the arm swings it): runs along the arm's +z, standing up at rest. */
function bigBlade(k, len, width) {
  const a = k.arms[1], m = GLOW();
  k.B(0.06, 0.06, 0.3, 0, -0.6, 0.05, chitin(), a);
  k.B(width * 1.8, 0.06, 0.06, 0, -0.6, 0.2, chitin(), a);
  k.B(width, 0.05, len, 0, -0.6, 0.2 + len / 2, m, a);
  cone(k, width * 0.6, 0.2, 4, m, 0, -0.6, 0.3 + len, a, false, [PI / 2, 0, 0]);
}
const noHover = (fn) => (k) => { fn(k); k.hover = false; };

export const HIVE_BOSSES = {
  knight: (c) => grow(c, (k) => hive(k, 'captain'), 2.2, (k) => {
    const t = k.torso;
    horns(k, t, 1.05, -0.02, 3, 0.5, bone(), 0.12, 0.5);
    shoulderSpikes(k, t, 0.42, 0.82, 3, 0.45, bone());
    backSpines(k, t, 5, 0.4, chitin(), 0.75, 0.2);
    k.B(0.1, 0.4, 0.04, 0, 0.5, 0.21, GLOW(), t);
  }, 0.07),
  swordbearer: (c) => grow(c, (k) => hive(k, 'boss'), 2.3, (k) => {
    const t = k.torso;
    horns(k, t, 1.0, -0.02, 2, 0.5, chitin(), 0.18, 1.0);
    shoulderSpikes(k, t, 0.42, 0.82, 2, 0.4, chitin());
    cape(k, t, 0.7, 1.5, shroud());
    bigBlade(k, 1.3, 0.14);
  }, 0.115),
  // Crota (Bryce's reference, 2026-11-17): a spectral green-white body, a great fan of leaf-blade spikes over the head, huge spiked pauldrons,
  // spiked forearms and knees, a long glowing blade.
  crota: (c) => grow(c, (k) => hive(k, 'boss'), 3.0, (k) => {
    const t = k.torso, glow = GLOW(), pale = mat(0xd8ffe8, { emissive: 0x6affb0, emissiveIntensity: 1.6 });
    for (let i = -4; i <= 4; i++) cone(k, 0.09, 0.7 - Math.abs(i) * 0.07, 4, i % 2 ? pale : glow, i * 0.1, 1.25 + (4 - Math.abs(i)) * 0.03, -0.04, t, false, [-0.1, 0, -i * 0.2]); // the fan crown
    for (const s of [-1, 1]) {
      k.B(0.5, 0.2, 0.55, s * 0.55, 0.92, 0, pale, t, false, [0, 0, s * -0.4]);
      for (let i = 0; i < 4; i++) cone(k, 0.07, 0.6 - i * 0.08, 4, glow, s * (0.5 + i * 0.07), 1.05 + i * 0.05, -0.1 + i * 0.07, t, false, [-0.2, 0, s * -(0.25 + i * 0.1)]);
    }
    for (const hip of k.legs) for (let i = 0; i < 2; i++) cone(k, 0.05, 0.25, 4, glow, 0, -0.4, 0.15 - i * 0.08, hip, false, [PI / 2 + i * 0.5, 0, 0]); // knee spikes
    cape(k, t, 1.0, 1.7, mat(0x14201a));
    bigBlade(k, 2.0, 0.22);
    // a spectral wash over the whole body: tint a private copy of every material, shared per source so the parts still merge
    const seen = new Map();
    k.g.traverse((o) => {
      if (!o.isMesh || o.material === glow || o.material === pale) return;
      let m = seen.get(o.material);
      if (!m) { m = o.material.clone(); m.color?.lerp(new THREE.Color(0x9dffc8), 0.65); if (m.emissive) { m.emissive = new THREE.Color(0x2aff8a); m.emissiveIntensity = 0.5; } seen.set(o.material, m); }
      o.material = m;
    });
  }, 0.38),
  wizard: (c) => grow(c, noHover((k) => hive(k, 'hv_wizard')), 2.2, (k) => {
    const t = k.torso;
    horns(k, t, 0.9, -0.02, 3, 0.5, bone(), 0.12, 0.6);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2; ico(k, 0.07, 0, GLOW(), Math.sin(a) * 0.55, 0.5 + (i % 2) * 0.3, Math.cos(a) * 0.55, t); } // orbiting soul-shards
  }, 0.194),
  broodwizard: (c) => grow(c, noHover((k) => hive(k, 'hv_wizard')), 2.15, (k) => {
    const t = k.torso, egg = mat(0x9fb67a, { emissive: 0x4a7a2a, emissiveIntensity: 0.7 });
    for (let i = 0; i < 6; i++) ico(k, 0.13 - (i % 2) * 0.03, 0, egg, ((i % 3) - 1) * 0.18, 0.5 + (i % 2) * 0.2 - (i > 2 ? 0.15 : 0), -0.38 - (i % 2) * 0.05, t); // egg sac on the back
    backSpines(k, t, 5, 0.45, bone(), 0.8, 0.2);
    shoulderSpikes(k, t, 0.34, 0.65, 2, 0.4, bone());
  }, 0.139),
  shrieker: (c) => { c.hover = true; grow(c, (k) => hive(k, 'hv_shrieker'), 2.6, (k) => {
    const b = k.torso || k.g;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; cone(k, 0.08, 0.6, 4, bone(), Math.sin(a) * 0.9, 0.2, Math.cos(a) * 0.9, b, false, [Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2]); }
  }, 0.129); },
};
