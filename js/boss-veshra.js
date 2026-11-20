// U31: Veshra, Riven's Brood, gets her original model back (a young Ahamkara: low quadruped, split jaw, bone plates, six eyes, spined tentacles).
// U29 had rebuilt her from the Taken wizard unit; Bryce wants the old build, restored verbatim from js/bosses.js before commit 5a2405e.
import * as THREE from 'three';
import { mat } from './world.js';
import { PI, cone, ico } from './boss-kit.js';

export function veshraClassic(c) {
  const { B, add } = c;
  // Riven's brood, a young Ahamkara: low sleek quadruped, split jaw, four head plates, six eyes, no wings
  const tent = mat(0x5a2a44), hide = mat(0x2a1d2c), bone = mat(0xcdbf9c), flesh = mat(0x8a3a4a), mottle = mat(0x14101a);
  const glow = mat(0xff9a3c, { emissive: 0xff9a3c, emissiveIntensity: 2.8 });
  const gold = mat(0xffd36b, { emissive: 0xc9962a, emissiveIntensity: 1.2 });
  const eye = mat(0xffd9a0, { emissive: 0xff9a3c, emissiveIntensity: 3.2 });
  // four legs; order makes the shared walk swing trot in diagonal pairs
  for (const [x, z] of [[-0.24, 0.55], [0.24, 0.55], [-0.24, -0.5], [0.24, -0.5]]) {
    const hip = c.pivot(x, 0.62, z);
    B(0.14, 0.34, 0.16, 0, -0.14, 0.04, hide, hip, false, [-0.35, 0, 0]);
    B(0.1, 0.36, 0.12, 0, -0.44, 0.0, hide, hip, false, [0.3, 0, 0]);
    B(0.18, 0.07, 0.24, 0, -0.6, 0.08, mottle, hip);
    for (let k = -1.5; k <= 1.5; k++) cone(c, 0.018, 0.1, 3, bone, k * 0.045, -0.6, 0.23, hip, false, [PI / 2, 0, 0]);
    c.legs.push(hip);
  }
  const body = c.pivot(0, 0.72, 0);
  c.torso = body;
  B(0.62, 0.48, 1.5, 0, 0.0, 0, hide, body);
  B(0.5, 0.2, 1.3, 0, 0.3, -0.05, mottle, body);
  for (let i = 0; i < 6; i++) B(0.12 + (i % 2) * 0.06, 0.1, 0.16, ((i * 7) % 5 - 2) * 0.1, 0.27, 0.5 - i * 0.2, i % 2 ? gold : mottle, body);
  // back spines
  for (let i = 0; i < 6; i++) cone(c, 0.03, 0.18, 4, bone, 0, 0.42, 0.5 - i * 0.22, body);
  // blight heart: glowing crystal mass in the exposed chest
  B(0.42, 0.34, 0.1, 0, 0.0, 0.76, mottle, body);
  ico(c, 0.17, 0, glow, 0, 0.0, 0.8, body, true);
  for (const [x, y, r] of [[-0.12, -0.08, 0.6], [0.13, 0.1, -0.5], [0.0, 0.14, 0.2]]) cone(c, 0.05, 0.22, 4, glow, x, y, 0.84, body, true, [PI / 2 - 0.2, 0, r]);
  // neck rising to a low, forward-reaching head
  const neck = c.pivot(0, 0.12, 0.7, body);
  neck.rotation.x = -0.5;
  B(0.3, 0.3, 0.7, 0, 0, 0.3, hide, neck);
  const head = c.pivot(0, 0.04, 0.72, neck);
  head.rotation.x = 0.55;
  B(0.34, 0.24, 0.62, 0, 0, 0.12, hide, head, true);
  B(0.2, 0.14, 0.2, 0, -0.02, 0.5, hide, head, true);
  // six glowing eyes, three per side
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.028, 6, 5), eye, s * (0.17 - k * 0.01), 0.08 - k * 0.02, 0.22 + k * 0.1, head, true);
  // four bone plates folded back and slightly open, showing flesh underneath
  for (const [x, y, z, rz, len] of [[-0.22, 0.12, 0.1, 0.55, 0.52], [0.22, 0.12, 0.1, -0.55, 0.52], [-0.12, 0.17, 0.06, 0.25, 0.46], [0.12, 0.17, 0.06, -0.25, 0.46]]) {
    B(0.14, 0.04, len, x * 0.7, y - 0.03, z - 0.02, flesh, head, true, [-0.22, 0, rz]);
    B(0.14, 0.04, len, x, y + 0.02, z - 0.02, bone, head, true, [-0.3, 0, rz]);
  }
  for (const s of [-1, 1]) cone(c, 0.04, 0.34, 4, bone, s * 0.16, 0.2, -0.2, head, true, [-1.2, 0, s * 0.2]);
  // split lower jaw: two halves swung apart, rows of shark teeth
  for (const s of [-1, 1]) {
    const jaw = c.pivot(s * 0.03, -0.1, 0.3, head);
    jaw.rotation.x = 0.5;
    jaw.rotation.y = s * -0.2;
    B(0.09, 0.07, 0.56, s * 0.05, 0, 0.24, bone, jaw, true);
    for (let k = 0; k < 6; k++) cone(c, 0.018, 0.09, 3, bone, s * 0.05, 0.07, 0.05 + k * 0.09, jaw, true);
    for (let k = 0; k < 5; k++) cone(c, 0.018, 0.09, 3, bone, s * 0.05, -0.001 + 0.14, 0.2 + k * 0.07 - 0.2, head, true, [PI, 0, 0]);
  }
  // three large spined tentacles a side off the neck, smaller ones beneath
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const t = c.pivot(s * 0.14, 0.08 - k * 0.04, 0.1 + k * 0.1, neck);
    t.rotation.set(-0.7 - k * 0.2, -s * (0.9 + k * 0.35), 0);
    B(0.09, 0.09, 0.62, 0, 0, -0.31, tent, t);
    for (let j = 0; j < 4; j++) cone(c, 0.025, 0.14, 3, j % 2 ? gold : bone, 0, 0.08, -0.15 - j * 0.18, t);
    const u = c.pivot(s * 0.1, -0.12, 0.14 + k * 0.1, neck);
    u.rotation.set(-1.0, -s * (0.6 + k * 0.4), 0);
    B(0.05, 0.05, 0.4, 0, 0, -0.2, tent, u);
  }
  // long serpentine tail
  let tp = c.pivot(0, 0.0, -0.72, body);
  for (let i = 0; i < 7; i++) {
    const w = 0.28 - i * 0.032;
    B(w, w * 0.9, 0.42, 0, 0, -0.2, i % 3 === 2 ? mottle : hide, tp);
    if (i % 2) cone(c, w * 0.15, 0.1, 3, bone, 0, w * 0.5, -0.2, tp);
    const nx = c.pivot(0, 0, -0.4, tp);
    nx.rotation.set(0.05, Math.sin(i * 1.1) * 0.28, 0);
    tp = nx;
  }
  cone(c, 0.05, 0.3, 4, gold, 0, 0, -0.15, tp, false, [-PI / 2, 0, 0]);
  // Taken mottling over the hide
  for (const [x, y, z, w] of [[0.32, 0.05, 0.1, 0.1], [-0.31, -0.05, -0.2, 0.12], [0.31, 0.0, -0.5, 0.09], [-0.31, 0.1, 0.45, 0.1]]) B(0.03, w, w * 1.6, x, y, z, glow, body);
  c.muzzle.position.set(0, 0.45, 1.5);
  body.add(c.muzzle);
  c.height = 1.6;

}
