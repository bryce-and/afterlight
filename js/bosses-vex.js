import * as THREE from 'three';
import { mat } from './world.js';
import { PI, cone, ico, tor } from './boss-kit.js';

// U29: Protheon, Modular Mind: built from scratch. A hovering milk-white octahedron cage in gold rings with one small red core (the weak point),
// a tapering gold column below, tall blade pylons either side, a crown of gold fins, and a ring of modular blocks drifting round it.
export const VEX_BOSSES = {
  vexmind(c) {
    const { B } = c;
    const milk = mat(0xe8e4d8), gold = mat(0xc9a04a, { metalness: 0.5, roughness: 0.4 }), dark = mat(0x2a2418);
    const core = mat(0xff3a2a, { emissive: 0xff2a1a, emissiveIntensity: 3.5 });
    c.hover = true;
    const body = c.pivot(0, 1.45, 0);
    c.torso = body;
    c.add(new THREE.OctahedronGeometry(0.8, 0), milk, 0, 0, 0, body).scale.set(1, 1.25, 1);
    ico(c, 0.22, 1, core, 0, 0, 0.6, body, true); // the red core, set in the cage's front face
    tor(c, 0.3, 0.05, gold, 0, 0, 0.6, body, false, null, 10);
    tor(c, 0.98, 0.05, gold, 0, 0, 0, body, false, [PI / 2, 0, 0], 14);
    tor(c, 0.9, 0.05, gold, 0, 0, 0, body, false, [0, PI / 2, 0], 14);
    
    // tapering column and base
    cone(c, 0.5, 1.1, 6, gold, 0, -1.2, 0, body, false, [PI, 0, 0]);
    cone(c, 0.12, 0.5, 4, dark, 0, -1.95, 0, body, false, [PI, 0, 0]);
    // crown of fins
    for (let i = -2; i <= 2; i++) cone(c, 0.08, 0.7 - Math.abs(i) * 0.1, 4, gold, i * 0.2, 1.15 - Math.abs(i) * 0.04, -0.05, body, false, [0, 0, -i * 0.22]);
    // blade pylons either side
    for (const s of [-1, 1]) {
      B(0.14, 1.9, 0.3, s * 1.15, 0.3, -0.1, gold, body, false, [0, 0, s * -0.12]);
      B(0.06, 1.5, 0.22, s * 1.15, 0.3, 0.06, milk, body, false, [0, 0, s * -0.12]);
      cone(c, 0.11, 0.5, 4, gold, s * 1.27, 1.45, -0.1, body, false, [0, 0, s * -0.12]);
    }
    // modular blocks drifting in a ring behind the cage
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 + 0.2, sz = 0.28 + (i % 3) * 0.06;
      B(sz, sz, sz, Math.cos(a) * 1.15, Math.sin(a) * 1.05, -0.3, i % 2 ? milk : gold, body, false, [a, a * 0.7, 0]);
    }
    c.muzzle.position.set(0, 0, 0.85);
    body.add(c.muzzle);
    c.height = 2.6;
  },
};
