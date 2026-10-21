import * as THREE from 'three';
import { mat } from './world.js';

// ---------------------------------------------------------------------------
// VEX (Destiny 2): gold-bronze limbs, cream ceramic plating, a single red photoreceptor, and the
// milky radiolarian mind visible in the chest or abdomen. Same builder contract as the other factions:
// face +z, stand on y = 0 (floating units are lifted by `def.fly`), c.torso / c.legs / c.arms / c.muzzle set per unit.
// Also here: the Destiny 2 units added to the older factions in v2.9 (Fallen Servitor, Hive Shrieker, Cabal Incendior and Gladiator).
// ---------------------------------------------------------------------------
const PI = Math.PI;
let _m = null;
function vm() {
  if (!_m) _m = {
    gold: mat(0xb8944f), bronze: mat(0x6b5232), cream: mat(0xe9e2cf), dark: mat(0x2a2218),
    milk: mat(0xf4f7ff, { emissive: 0xcfe0ff, emissiveIntensity: 1.5 }),
    red: mat(0xff3a2a, { emissive: 0xff2a1a, emissiveIntensity: 3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xe9e2cf, transparent: true, opacity: 0.5, depthWrite: false }),
    void: new THREE.MeshBasicMaterial({ color: 0x9b6bff, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
  };
  return _m;
}

function legsBiped(c, hipY, hipW, thick, m, foot, digi = false) {
  for (const s of [-1, 1]) {
    const hip = c.pivot(s * hipW, hipY, 0);
    const L = hipY / 2;
    if (digi) {
      c.B(thick, L * 1.05, thick * 1.1, 0, -L * 0.48, 0.07, m, hip, false, [-0.32, 0, 0]);
      c.B(thick * 0.8, L * 1.05, thick * 0.9, 0, -L * 1.45, 0.06, m, hip, false, [0.3, 0, 0]);
    } else {
      c.B(thick, L, thick * 1.1, 0, -L * 0.5, 0, m, hip);
      c.B(thick * 0.95, L, thick, 0, -L * 1.5, 0, m, hip);
    }
    c.B(thick * 1.1, 0.09, thick * 1.8, 0, -hipY + 0.045, 0.06, foot, hip);
    c.legs.push(hip);
  }
}
function gun(c, parent, x, y, z, len, thick, m, glow) {
  c.B(thick, thick * 1.2, len, x, y, z, m, parent);
  c.B(thick * 0.5, thick * 0.4, len * 0.4, x, y + thick * 0.7, z, glow, parent);
  c.muzzle.position.set(x, y, z + len / 2 + 0.03);
  parent.add(c.muzzle);
}
function arm(c, parent, x, y, len, thick, m, lift = -1.1, rz = 0) {
  const p = c.pivot(x, y, 0, parent);
  c.B(thick, len, thick, 0, -len / 2, 0, m, p);
  p.rotation.x = lift; p.rotation.z = rz;
  return p;
}
const ico = (c, r, d, m, x, y, z, parent, crit = false) => c.add(new THREE.IcosahedronGeometry(r, d), m, x, y, z, parent, crit);
const cone = (c, r, h, m, x, y, z, parent, rot = null, crit = false, seg = 5) => c.add(new THREE.ConeGeometry(r, h, seg), m, x, y, z, parent, crit, rot);

/** The Vex eye: a red photoreceptor in a cream ring. Precision hits. */
function eye(c, parent, x, y, z, r) {
  const M = vm();
  c.add(new THREE.TorusGeometry(r * 1.35, r * 0.28, 4, 8), M.cream, x, y, z - r * 0.1, parent);
  const e = ico(c, r, 1, M.red, x, y, z, parent, true);
  e.scale.z = 0.55;
  return e;
}

/** A slender humanoid frame: conical head with one eye, ribbed chest around a milky mind (the abdomen is a precision spot). */
function vexBody(c, o = {}) {
  const M = vm();
  const h = o.h ?? 0.88, sw = o.sw ?? 1;
  legsBiped(c, h, 0.13 * sw, 0.1, M.gold, M.bronze, true);
  const torso = c.pivot(0, h, 0);
  c.torso = torso;
  c.B(0.26 * sw, 0.16, 0.2, 0, 0.06, 0, M.bronze, torso);
  // exposed abdomen: ribs around the mind core
  ico(c, 0.13 * sw, 1, M.milk, 0, 0.3, 0.02, torso, true);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) c.B(0.05, 0.1, 0.05, s * (0.14 + i * 0.015) * sw, 0.23 + i * 0.13, 0, M.cream, torso, false, [0, 0, s * (0.1 + i * 0.08)]);
  // chest plate
  c.B(0.42 * sw, 0.26, 0.26, 0, 0.58, 0, M.gold, torso);
  c.B(0.3 * sw, 0.14, 0.04, 0, 0.62, 0.15, M.cream, torso);
  for (const s of [-1, 1]) c.B(0.14, 0.12, 0.2, s * 0.27 * sw, 0.66, 0, M.cream, torso, false, [0, 0, s * -0.2]);
  // neck and a tall conical head, eye on its face
  c.B(0.08, 0.14, 0.08, 0, 0.78, 0, M.bronze, torso);
  const head = c.pivot(0, 0.92, 0.02, torso);
  cone(c, 0.15, 0.4, M.cream, 0, 0.12, -0.02, head, [-0.25, 0, 0], false, 4);
  c.B(0.2, 0.12, 0.16, 0, 0.0, 0.03, M.gold, head, true);
  eye(c, head, 0, 0.0, 0.12, 0.05);
  return torso;
}

// ---- Vex units ----
const BUILD = {
  vx_goblin(c) {
    const M = vm();
    const torso = vexBody(c);
    const l = arm(c, torso, -0.27, 0.64, 0.5, 0.07, M.bronze, -1.0, 0.1), r = arm(c, torso, 0.27, 0.64, 0.5, 0.07, M.bronze, -1.2, -0.1);
    c.arms.push(l, r);
    gun(c, torso, 0.12, 0.42, 0.34, 0.5, 0.09, M.gold, M.red); // Slap Rifle
    c.height = 1.95;
  },
  vx_fanatic(c) {
    // a damaged goblin: cracked plating, glitching, with a swelling core
    const M = vm();
    BUILD.vx_goblin(c);
    c.torso.rotation.z = 0.12;
    for (let i = 0; i < 4; i++) c.B(0.05, 0.05, 0.05, -0.25 + i * 0.16, 0.5 + (i % 2) * 0.2, 0.2, M.red, c.torso);
    c.g.scale.multiplyScalar(0.96);
  },
  vx_hobgoblin(c) {
    // taller, a rounder head with a big eye, a long Line Rifle, a spine of conduits
    const M = vm();
    const torso = vexBody(c, { h: 1.0, sw: 1.15 });
    for (const s of [-1, 1]) {
      c.B(0.05, 0.5, 0.05, s * 0.2, 0.5, -0.18, M.bronze, torso);
      ico(c, 0.07, 0, M.milk, s * 0.2, 0.76, -0.18, torso);
    }
    const l = arm(c, torso, -0.3, 0.64, 0.55, 0.07, M.bronze, -1.2, 0.1), r = arm(c, torso, 0.3, 0.64, 0.55, 0.07, M.bronze, -1.25, -0.1);
    c.arms.push(l, r);
    gun(c, torso, 0.1, 0.45, 0.5, 0.95, 0.08, M.cream, M.red);
    c.B(0.04, 0.04, 0.3, 0.1, 0.5, 1.0, M.gold, torso);
    c.height = 2.3;
  },
  vx_harpy(c) {
    // a hovering scout: hexagonal body, two swept wing blades, one big eye; no legs
    const M = vm();
    c.hover = true;
    const body = c.pivot(0, 0.9, 0);
    c.torso = body;
    c.add(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 6).rotateX(PI / 2), M.gold, 0, 0, 0, body, true);
    c.add(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 6).rotateX(PI / 2), M.cream, 0, 0, 0.03, body);
    eye(c, body, 0, 0.02, 0.14, 0.09);
    ico(c, 0.1, 1, M.milk, 0, -0.26, -0.04, body, true);
    for (const s of [-1, 1]) {
      c.B(0.7, 0.05, 0.3, s * 0.55, 0.05, -0.05, M.cream, body, false, [0, s * 0.35, s * -0.18]);
      c.B(0.5, 0.06, 0.1, s * 0.5, 0.0, 0.06, M.bronze, body, false, [0, s * 0.35, s * -0.18]);
    }
    c.B(0.07, 0.07, 0.4, 0.17, -0.1, 0.26, M.gold, body);
    c.muzzle.position.set(0.17, -0.1, 0.5); body.add(c.muzzle);
    c.height = 1.6;
  },
  vx_supplicant(c) {
    BUILD.vx_harpy(c);
    for (let i = 0; i < 3; i++) c.B(0.06, 0.06, 0.06, -0.2 + i * 0.2, 0.2, 0.2, vm().red, c.torso);
  },
  vx_minotaur(c) {
    // a big, aggressive foundry: heavy legs, a barrel chest with a milky mind in the abdomen, a Void shield on one arm, a Torch Hammer on the other
    const M = vm();
    legsBiped(c, 0.95, 0.24, 0.2, M.gold, M.bronze, true);
    const torso = c.pivot(0, 0.95, 0);
    c.torso = torso;
    c.B(0.5, 0.22, 0.34, 0, 0.1, 0, M.bronze, torso);
    ico(c, 0.17, 1, M.milk, 0, 0.36, 0.05, torso, true); // weak spot: the abdomen
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) c.B(0.06, 0.12, 0.06, s * 0.2, 0.26 + i * 0.1, 0.02, M.cream, torso, false, [0, 0, s * (0.15 + i * 0.1)]);
    c.B(0.78, 0.34, 0.42, 0, 0.74, 0, M.gold, torso);
    c.B(0.5, 0.2, 0.05, 0, 0.78, 0.23, M.cream, torso);
    for (const s of [-1, 1]) c.B(0.3, 0.2, 0.46, s * 0.5, 0.88, 0, M.cream, torso, false, [0, 0, s * -0.2]);
    c.B(0.28, 0.18, 0.26, 0, 1.0, 0.04, M.bronze, torso, true);
    const head = c.pivot(0, 1.14, 0.04, torso);
    cone(c, 0.18, 0.46, M.cream, 0, 0.12, -0.05, head, [-0.2, 0, 0], false, 5);
    eye(c, head, 0, 0.0, 0.14, 0.06);
    const shield = c.pivot(-0.78, 0.5, 0.2, torso);
    c.add(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 6).rotateX(PI / 2), M.void, 0, 0, 0, shield).userData.crit = false;
    c.B(0.1, 0.9, 0.08, 0, 0, 0, M.cream, shield);
    const l = arm(c, torso, -0.52, 0.86, 0.6, 0.12, M.bronze, -1.2, 0.2);
    const r = arm(c, torso, 0.52, 0.86, 0.6, 0.12, M.bronze, -1.0, -0.1);
    c.arms.push(l, r);
    c.B(0.14, 0.9, 0.14, 0, -0.9, 0.1, M.dark, r);
    c.B(0.34, 0.3, 0.3, 0, -1.3, 0.1, M.gold, r);
    c.muzzle.position.set(0.1, 0.6, 0.5); torso.add(c.muzzle);
    c.height = 2.5;
  },
  vx_wyvern(c) {
    // a Minotaur and Harpy fused: the Minotaur's frame with two big shield-wings and a Warp Lance
    const M = vm();
    BUILD.vx_minotaur(c);
    for (const s of [-1, 1]) {
      const w = c.pivot(s * 0.5, 0.95, -0.35, c.torso);
      c.B(1.3, 0.06, 0.6, s * 0.65, 0.15, 0, M.cream, w, false, [0, s * 0.4, s * -0.4]);
      c.B(1.1, 0.07, 0.14, s * 0.6, 0.1, 0.1, M.gold, w, false, [0, s * 0.4, s * -0.4]);
    }
    c.B(0.1, 0.1, 1.6, 0.3, 0.55, 0.7, M.gold, c.torso); // Warp Lance
    c.B(0.05, 0.05, 0.4, 0.3, 0.55, 1.6, M.red, c.torso);
    c.height = 2.7;
  },
  vx_hydra(c) {
    // a levitating centipede: a tapering spine of linked segments around a milky node, a rotating shield ring (`c.spin`)
    const M = vm();
    c.hover = true;
    const body = c.pivot(0, 1.1, 0);
    c.torso = body;
    for (let i = 0; i < 6; i++) {
      const k = 1 - i * 0.11, z = -i * 0.34 + 0.4, y = -0.12 * i + Math.sin(i * 0.9) * 0.05;
      c.B(0.5 * k, 0.4 * k, 0.34, 0, y, z, i % 2 ? M.gold : M.cream, body, i === 0);
      ico(c, 0.1 * k, 0, M.milk, 0, y + 0.0, z + 0.02, body, i === 2);
      for (const s of [-1, 1]) c.B(0.3 * k, 0.04, 0.05, s * 0.34 * k, y - 0.08, z, M.bronze, body, false, [0, 0, s * 0.5]);
    }
    cone(c, 0.24, 0.5, M.cream, 0, 0.14, 0.58, body, [PI / 2 + 0.2, 0, 0], false, 5);
    eye(c, body, 0, 0.1, 0.78, 0.07);
    c.B(0.12, 0.12, 0.9, 0.3, -0.1, 0.5, M.bronze, body); // Aeon Maul
    c.B(0.28, 0.28, 0.28, 0.3, -0.1, 1.0, M.gold, body);
    c.muzzle.position.set(0.3, -0.1, 1.15); body.add(c.muzzle);
    const spin = c.pivot(0, 0.0, 0.1, body);
    for (const a of [-0.9, 0, 0.9]) {
      const p = c.pivot(0, 0, 0, spin);
      p.rotation.y = a;
      c.B(0.8, 1.0, 0.05, 0, 0, 0.9, M.glass, p);
      c.B(0.8, 0.05, 0.08, 0, 0.5, 0.9, M.gold, p);
      c.B(0.8, 0.05, 0.08, 0, -0.5, 0.9, M.gold, p);
      c.B(0.05, 0.7, 0.07, 0, 0, 0.93, M.bronze, p);
    }
    c.spin = spin;
    c.height = 2.6;
  },
  vx_cyclops(c) {
    // floating artillery: a big sphere with one huge eye on the front, a mortar tube, and trailing conduit legs
    const M = vm();
    c.hover = true;
    const body = c.pivot(0, 1.3, 0);
    c.torso = body;
    ico(c, 0.95, 1, M.gold, 0, 0, 0, body);
    ico(c, 0.78, 1, M.cream, 0, 0.0, 0.1, body).scale.set(1, 0.9, 0.9);
    c.add(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 8).rotateX(PI / 2), M.bronze, 0, 0.05, 0.86, body);
    eye(c, body, 0, 0.05, 0.96, 0.26);
    c.add(new THREE.CylinderGeometry(0.2, 0.28, 1.3, 6), M.dark, 0, 0.95, -0.2, body, false, [0.6, 0, 0]);
    c.muzzle.position.set(0, 1.55, 0.35); body.add(c.muzzle);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      c.B(0.12, 1.1, 0.12, Math.cos(a) * 0.6, -0.85, Math.sin(a) * 0.6, M.bronze, body, false, [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25]);
      ico(c, 0.1, 0, M.milk, Math.cos(a) * 0.72, -1.4, Math.sin(a) * 0.72, body);
    }
    c.height = 3.0;
  },
  vx_imp(c) {
    // one of the Imp Swarm: a tiny winged construct
    const M = vm();
    c.hover = true;
    const b = c.pivot(0, 0.6, 0);
    c.torso = b;
    ico(c, 0.14, 0, M.gold, 0, 0, 0, b, true);
    ico(c, 0.07, 0, M.red, 0, 0, 0.11, b, true);
    for (const s of [-1, 1]) c.B(0.22, 0.03, 0.12, s * 0.18, 0.03, -0.02, M.cream, b, false, [0, 0, s * -0.3]);
    c.height = 0.9;
  },
  vx_imp_swarm(c) {
    // the main body of a swarm: a milky radiolaria core ringed by six circling imps; killing it sends the rest charging
    const M = vm();
    c.hover = true;
    const b = c.pivot(0, 0.9, 0);
    c.torso = b;
    ico(c, 0.26, 1, M.milk, 0, 0, 0, b, true);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2, x = Math.cos(a) * 0.5, z = Math.sin(a) * 0.5;
      ico(c, 0.1, 0, M.gold, x, Math.sin(a * 2) * 0.12, z, b);
      ico(c, 0.045, 0, M.red, x * 1.12, Math.sin(a * 2) * 0.12, z * 1.12, b);
      c.B(0.18, 0.025, 0.1, x, Math.sin(a * 2) * 0.12 + 0.05, z, M.cream, b, false, [0, -a, 0]);
    }
    c.muzzle.position.set(0, 0, 0.4); b.add(c.muzzle);
    c.height = 1.5;
  },
};

// ---- the older factions' new Destiny 2 units ----
const EXTRA = {
  fl_servitor(c) {
    // a floating sphere with one purple eye, plating peeled back to circuitry, Ether tubes below
    const bone = mat(0xc8c2d2), plate = mat(0x8a8698), purple = mat(0xb26bff, { emissive: 0xb26bff, emissiveIntensity: 2.4 });
    c.hover = true;
    const b = c.pivot(0, 1.2, 0);
    c.torso = b;
    ico(c, 0.55, 1, plate, 0, 0, 0, b);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + 0.4;
      c.B(0.5, 0.5, 0.04, Math.cos(a) * 0.5, Math.sin(a) * 0.2, Math.sin(a) * 0.5, bone, b, false, [0.4, -a, 0.2]);
    }
    c.add(new THREE.TorusGeometry(0.24, 0.07, 5, 10), bone, 0, 0.02, 0.52, b);
    ico(c, 0.17, 1, purple, 0, 0.02, 0.5, b, true).scale.z = 0.6;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2;
      c.B(0.05, 0.5, 0.05, Math.cos(a) * 0.22, -0.7, Math.sin(a) * 0.22, bone, b);
      ico(c, 0.06, 0, purple, Math.cos(a) * 0.22, -0.98, Math.sin(a) * 0.22, b);
    }
    c.muzzle.position.set(0, 0.02, 0.65); b.add(c.muzzle);
    c.height = 2.2;
  },
  hv_shrieker(c) {
    // Destiny 2 Shrieker: four swept, jagged chitin plates (purple-veined) caging a crackling energy orb, a spiked sigil with a
    // green glyph hanging in the middle (the weak spot). About twice the old size; hovers and swivels to aim.
    const shell = new THREE.MeshStandardMaterial({ color: 0x4a3640, flatShading: true, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.2 });
    const vein = new THREE.MeshStandardMaterial({ color: 0x7a45c0, emissive: 0x5a259a, emissiveIntensity: 0.6, flatShading: true, side: THREE.DoubleSide });
    const orbM = new THREE.MeshBasicMaterial({ color: 0x8a3df0, transparent: true, opacity: 0.42, depthWrite: false });
    const rimM = new THREE.MeshBasicMaterial({ color: 0xd9c4ff, transparent: true, opacity: 0.45, depthWrite: false });
    const glyph = mat(0xb8ff6a, { emissive: 0xb8ff6a, emissiveIntensity: 3 });
    c.hover = true;
    const b = c.pivot(0, 1.9, 0);
    c.torso = b;
    // a jagged blade, root at the origin, pointing +x; sx -1 mirrors it
    const plate = (len, wid, sx, depth) => {
      const sh = new THREE.Shape();
      sh.moveTo(0, -wid * 0.1); sh.lineTo(len * 0.3, wid * 0.55); sh.lineTo(len * 0.42, wid * 0.32); sh.lineTo(len * 0.68, wid * 0.78);
      sh.lineTo(len * 0.8, wid * 0.4); sh.lineTo(len, wid * 0.05); sh.lineTo(len * 0.62, -wid * 0.28); sh.lineTo(len * 0.36, -wid * 0.12); sh.lineTo(len * 0.14, -wid * 0.3);
      const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
      g.translate(0, 0, -depth / 2);
      if (sx < 0) g.scale(-1, 1, 1);
      return g;
    };
    for (const s of [-1, 1]) {
      // upper plates sweep up and out, lower plates down and out, the lower pair larger and heavier
      c.add(plate(1.9, 1.05, s, 0.2), shell, s * 0.3, 0.5, -0.05, b, false, [0, s * 0.35, s * 0.4]);
      c.add(plate(1.55, 0.42, s, 0.05), vein, s * 0.4, 0.78, 0.1, b, false, [0, s * 0.35, s * 0.4]);
      c.add(plate(2.1, 1.2, s, 0.22), shell, s * 0.28, -0.5, -0.05, b, false, [0, s * 0.35, s * -0.48]);
      c.add(plate(1.7, 0.45, s, 0.05), vein, s * 0.36, -0.7, 0.12, b, false, [0, s * 0.35, s * -0.48]);
    }
    // the orb: a halo ring and a glowing sphere
    c.add(new THREE.SphereGeometry(0.78, 14, 10), orbM, 0, 0, 0, b);
    c.add(new THREE.TorusGeometry(0.8, 0.045, 5, 20), rimM, 0, 0, 0, b);
    c.add(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd9b8ff, transparent: true, opacity: 0.18, depthWrite: false }), 0, 0, -0.05, b);
    // the sigil: a spiked blade with a glowing glyph, precision hits
    const sig = c.add(new THREE.OctahedronGeometry(0.2, 0), shell, 0, 0.02, 0.1, b, true);
    sig.scale.set(0.8, 2.2, 0.8);
    cone(c, 0.07, 0.34, shell, 0, 0.58, 0.1, b, null, true, 4);
    cone(c, 0.07, 0.34, shell, 0, -0.55, 0.1, b, [PI, 0, 0], true, 4);
    c.add(new THREE.BoxGeometry(0.1, 0.22, 0.05), glyph, 0, 0.02, 0.24, b, true);
    c.muzzle.position.set(0, 0, 0.9); b.add(c.muzzle);
    c.height = 3.7;
  },
  lg_incendior(c, taken = false) {
    // Barant infantry with a reinforced helmet (no precision hits) and twin fuel tanks on the back (the weak spot), a Magma Launcher
    const armor = taken ? c.bodyMat : c.bodyMat, tank = mat(taken ? 0x2a2a34 : 0xb85a2a), steel = mat(0x4a4a50);
    const W = 1.15;
    legsBiped(c, 0.9, 0.19 * W, 0.2, c.dark, steel);
    const torso = c.pivot(0, 0.9, 0);
    c.torso = torso;
    c.B(0.46 * W, 0.26, 0.32, 0, 0.12, 0, c.dark, torso);
    c.B(0.7 * W, 0.52, 0.46, 0, 0.52, 0, armor, torso);
    // helmet: crit-proof, so these boxes are not tagged
    c.B(0.34, 0.34, 0.34, 0, 0.98, 0.02, c.bodyMat, torso);
    c.B(0.3, 0.06, 0.1, 0, 1.0, 0.2, c.accent, torso);
    for (const s of [-1, 1]) c.B(0.3 * W, 0.2, 0.44, s * 0.46 * W, 0.78, 0, armor, torso, false, [0, 0, s * -0.15]);
    // twin tanks: precision spots; they burst when the unit dies
    for (const s of [-1, 1]) {
      c.add(new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8), tank, s * 0.2, 0.55, -0.4, torso, true);
      c.B(0.08, 0.08, 0.3, s * 0.2, 0.95, -0.3, steel, torso);
    }
    const l = arm(c, torso, -0.46 * W, 0.7, 0.55, 0.15, c.dark, -1.2, 0.15), r = arm(c, torso, 0.46 * W, 0.7, 0.55, 0.15, c.dark, -1.1, -0.1);
    c.arms.push(l, r);
    gun(c, torso, 0.1, 0.42, 0.52, 0.9, 0.16, steel, c.accent);
    c.add(new THREE.CylinderGeometry(0.1, 0.07, 0.3, 6).rotateX(PI / 2), steel, 0.1, 0.42, 1.02, torso);
    c.height = 2.2;
  },
  lg_gladiator(c) {
    // massive melee infantry: a wide dark-grey frame, shoulder slabs, a horned helm with a visor slit, a Severus blade
    const steel = mat(0x4a4a50), red = mat(0xb02a1a);
    const W = 1.5;
    legsBiped(c, 0.95, 0.2 * W, 0.22, c.dark, steel);
    const torso = c.pivot(0, 0.95, 0);
    c.torso = torso;
    c.B(0.46 * W, 0.28, 0.36, 0, 0.12, 0, c.dark, torso);
    c.B(0.72 * W, 0.58, 0.5, 0, 0.56, 0, c.bodyMat, torso);
    c.B(0.5, 0.1, 0.06, 0, 0.6, 0.27, red, torso);
    c.B(0.34, 0.32, 0.34, 0, 1.06, 0.03, c.bodyMat, torso, true);
    c.B(0.3, 0.05, 0.08, 0, 1.08, 0.2, c.accent, torso, true);
    for (const s of [-1, 1]) {
      c.B(0.34 * W, 0.26, 0.5, s * 0.5 * W, 0.84, 0, c.bodyMat, torso, false, [0, 0, s * -0.2]);
      cone(c, 0.05, 0.3, steel, s * 0.2, 1.3, 0, torso, [0, 0, s * -0.5]);
    }
    const l = arm(c, torso, -0.52 * W, 0.78, 0.6, 0.17, c.dark, -0.9, 0.15), r = arm(c, torso, 0.52 * W, 0.78, 0.6, 0.17, c.dark, -1.35, -0.1);
    c.arms.push(l, r);
    c.B(0.07, 1.5, 0.14, 0, -0.9, 0.2, steel, r, false, [0.2, 0, 0]); // Severus
    c.B(0.04, 1.3, 0.08, 0, -0.9, 0.28, c.accent, r, false, [0.2, 0, 0]);
    c.height = 2.5;
  },
};

EXTRA.tk_incendior = (c) => EXTRA.lg_incendior(c, true); // the Taken Cabal flamer: same frame, near-black plating

export function vex(c, typeId) { (BUILD[typeId] || BUILD.vx_goblin)(c); }
/** Builders for the new Destiny 2 units of the older factions (null when `typeId` is not one of them). */
export function extraModel(typeId) { return EXTRA[typeId] || null; }
