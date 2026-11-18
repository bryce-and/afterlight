import { mat } from './world.js';
import { PI, cone, grow } from './boss-kit.js';
import { vex } from './models-vex.js';

// U29: Protheon, Modular Mind: the Vex pedestal Mind grown, floating, with a halo of extra gold blades.
export const VEX_BOSSES = {
  vexmind: (c) => {
    c.hover = true;
    grow(c, (k) => vex(k, 'vx_cyclops'), 2.6, (k) => {
      const gold = mat(0xd9a93c, { metalness: 0.6, roughness: 0.4 });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; cone(k, 0.07, 0.7, 4, gold, Math.cos(a) * 1.0, Math.sin(a) * 1.0, -0.2, k.torso, false, [0, 0, a - PI / 2]); }
    }, 0.092);
  },
};
