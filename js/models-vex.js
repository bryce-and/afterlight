import * as THREE from 'three';
import { mat } from './world.js';

// ---------------------------------------------------------------------------
// VEX (Destiny 2): one look for every unit. Bronze plating over black conduit and joints, a single red
// photoreceptor, and the milky-white radiolarian mind glowing in the chest or abdomen. Shapes follow the
// references: Goblin's fan crown, Hobgoblin's antlers and tail, Harpy's swept plates, Minotaur's heavy
// shoulders, Wyvern's shield-wings, Hydra's stacked spine, Cyclops' pedestal and blades, Imps' dome and spider legs.
// Same builder contract as the other factions: face +z, stand on y = 0 (floating units are lifted by `def.fly`),
// c.torso / c.legs / c.arms / c.muzzle set per unit.
// Also here: the Destiny 2 units added to the older factions in v2.9 (Hive Shrieker, Cabal Incendior and Gladiator; the Fallen ones moved to models-fallen.js in U18).
// ---------------------------------------------------------------------------
const PI = Math.PI;
let _m = null;
function vm() {
  if (!_m) _m = {
    bronze: mat(0x9c7a44), dbronze: mat(0x6a512c), black: mat(0x17140f),
    milk: mat(0xf4f7ff, { emissive: 0xcfe0ff, emissiveIntensity: 1.5 }),
    red: mat(0xff0d08, { emissive: 0xff0d08, emissiveIntensity: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xb59a66, transparent: true, opacity: 0.22, depthWrite: false }),
  };
  return _m;
}

const ico = (c, r, d, m, x, y, z, parent, crit = false) => c.add(new THREE.IcosahedronGeometry(r, d), m, x, y, z, parent, crit);
const cone = (c, r, h, m, x, y, z, parent, rot = null, crit = false, seg = 5) => c.add(new THREE.ConeGeometry(r, h, seg), m, x, y, z, parent, crit, rot);
const cyl = (c, rt, rb, h, seg, m, x, y, z, parent, rot = null, crit = false) => c.add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, parent, crit, rot);

/** Long thin digitigrade legs, bronze thighs and shins over black joints, clawed black feet. */
function legsBiped(c, hipY, hipW, thick, m, foot, digi = true) {
  const M = vm();
  for (const s of [-1, 1]) {
    const hip = c.pivot(s * hipW, hipY, 0);
    const L = hipY / 2;
    if (digi) {
      c.B(thick, L * 1.05, thick * 1.1, 0, -L * 0.48, 0.07, m, hip, false, [-0.32, 0, 0]);
      c.B(thick * 1.1, thick * 1.1, thick * 1.1, 0, -L * 0.98, 0.0, M.black, hip); // knee joint
      c.B(thick * 0.8, L * 1.05, thick * 0.9, 0, -L * 1.45, 0.06, m, hip, false, [0.3, 0, 0]);
    } else {
      c.B(thick, L, thick * 1.1, 0, -L * 0.5, 0, m, hip);
      c.B(thick * 0.95, L, thick, 0, -L * 1.5, 0, m, hip);
    }
    c.B(thick * 1.1, 0.07, thick * 1.8, 0, -hipY + 0.035, 0.07, foot, hip);
    for (const k of [-1, 0, 1]) cone(c, thick * 0.2, thick * 1.4, foot, k * thick * 0.35, -hipY + 0.05, 0.07 + thick * 1.2, hip, [PI / 2, 0, 0], false, 4);
    c.legs.push(hip);
  }
}
/** A gun block with a glowing top strip; the muzzle sits at the tip. */
function gun(c, parent, x, y, z, len, thick, m, glow) {
  c.B(thick, thick * 1.2, len, x, y, z, m, parent);
  c.B(thick * 0.5, thick * 0.4, len * 0.4, x, y + thick * 0.7, z, glow, parent);
  c.muzzle.position.set(x, y, z + len / 2 + 0.03);
  parent.add(c.muzzle);
}
/** An arm pivot: upper arm, a black elbow, a forearm bent a little, and a black clawed hand. */
function arm(c, parent, x, y, len, thick, m, lift = -1.1, rz = 0, claw = true) {
  const M = vm();
  const p = c.pivot(x, y, 0, parent);
  c.B(thick, len * 0.52, thick, 0, -len * 0.26, 0, m, p);
  c.B(thick * 1.3, thick * 1.3, thick * 1.3, 0, -len * 0.54, 0, M.black, p);
  c.B(thick * 1.2, len * 0.5, thick * 1.15, 0, -len * 0.78, 0.04, m, p, false, [-0.15, 0, 0]);
  if (claw) for (const k of [-1, 0, 1]) cone(c, thick * 0.22, thick * 2, M.black, k * thick * 0.35, -len - thick * 0.6, 0.06, p, [PI, 0, 0], false, 4);
  p.rotation.x = lift; p.rotation.z = rz;
  return p;
}
/** The Vex eye: a red photoreceptor in a black ring. Precision hits. */
function eye(c, parent, x, y, z, r) {
  const M = vm();
  c.add(new THREE.TorusGeometry(r * 1.35, r * 0.28, 4, 8), M.black, x, y, z - r * 0.1, parent);
  const e = ico(c, r, 1, M.red, x, y, z, parent, true);
  e.scale.z = 0.55;
  return e;
}
/** A fan-shaped crest: a centre plate with two angled side plates, like the Goblin's parasol. */
function fan(c, parent, x, y, z, w, d, m, dm) {
  c.B(w * 0.5, d, 0.06, x, y + d * 0.1, z, m, parent, false, [-0.45, 0, 0]);
  for (const s of [-1, 1]) {
    c.B(w * 0.36, d * 0.82, 0.06, x + s * w * 0.36, y - d * 0.05, z + 0.02, m, parent, false, [-0.45, 0, s * 0.7]);
    c.B(w * 0.2, d * 0.5, 0.06, x + s * w * 0.58, y - d * 0.22, z + 0.05, dm, parent, false, [-0.4, 0, s * 1.05]);
  }
}

/** A slender humanoid frame: long digitigrade legs, a black waist, wide shoulders, an open chest around a milky mind (the chest core is a precision spot). */
function vexBody(c, o = {}) {
  const M = vm();
  const h = o.h ?? 0.95, sw = o.sw ?? 1;
  legsBiped(c, h, 0.16 * sw, 0.2, M.bronze, M.black);
  const torso = c.pivot(0, h, 0);
  c.torso = torso;
  c.B(0.3 * sw, 0.14, 0.2, 0, 0.04, 0, M.black, torso); // pelvis
  c.B(0.34 * sw, 0.08, 0.22, 0, 0.1, 0, M.dbronze, torso);
  c.B(0.16 * sw, 0.26, 0.12, 0, 0.28, 0, M.black, torso); // waist
  ico(c, 0.13 * sw, 1, M.milk, 0, 0.42, 0.06, torso, true).scale.set(0.9, 1.15, 0.7); // the mind: chest core
  c.B(0.5 * sw, 0.24, 0.26, 0, 0.66, 0, M.bronze, torso); // chest and shoulder shelf
  c.B(0.26 * sw, 0.2, 0.04, 0, 0.6, 0.15, M.dbronze, torso, false, [-0.15, 0, 0]);
  for (const s of [-1, 1]) {
    c.B(0.2, 0.14, 0.26, s * 0.3 * sw, 0.74, 0, M.bronze, torso, false, [0, 0, s * -0.3]); // shoulder cap
    c.B(0.1, 0.34, 0.06, s * 0.14 * sw, 0.5, 0.12, M.black, torso, false, [0, 0, s * 0.25]);
  }
  c.B(0.1, 0.12, 0.1, 0, 0.84, 0, M.black, torso); // neck
  const head = c.pivot(0, 0.96, 0.03, torso);
  c.B(0.16, 0.16, 0.14, 0, 0.0, 0.0, M.dbronze, head, true);
  cone(c, 0.1, 0.16, M.bronze, 0, -0.1, 0.05, head, [PI + 0.2, 0, 0], false, 4); // narrow chin
  eye(c, head, 0, 0.01, 0.08, 0.045);
  torso.userData.head = head;
  return torso;
}

// ---- Vex units ----
const BUILD = {
  vx_goblin(c) {
    // a tall thin frame, a fan crown over a small red-eyed face, long arms: a Slap Rifle on one, a clawed hand on the other
    const M = vm();
    const torso = vexBody(c, { sw: 1.25 });
    const head = torso.userData.head;
    fan(c, head, 0, 0.2, -0.04, 0.95, 0.4, M.bronze, M.dbronze);
    const l = arm(c, torso, -0.34, 0.74, 0.62, 0.14, M.bronze, -1.0, 0.1, false), r = arm(c, torso, 0.34, 0.74, 0.62, 0.14, M.bronze, -0.12, -0.1);
    c.arms.push(l, r);
    c.B(0.16, 0.18, 0.22, 0, -0.66, 0.1, M.black, l); // rifle housing on the left forearm
    ico(c, 0.1, 0, M.dbronze, 0, -0.68, 0.22, l);
    gun(c, torso, -0.34, 0.46, 0.36, 0.5, 0.09, M.black, M.red); // Slap Rifle
    c.height = 2.0;
  },
  vx_fanatic(c) {
    // a hunched, damaged frame that scuttles forward: a swollen white core, a small crested head, long dangling claws
    const M = vm();
    legsBiped(c, 0.85, 0.16, 0.17, M.bronze, M.black);
    const torso = c.pivot(0, 0.85, 0.05);
    c.torso = torso;
    torso.rotation.x = 0.35;
    c.B(0.3, 0.14, 0.22, 0, 0.04, 0, M.black, torso);
    ico(c, 0.22, 1, M.milk, 0, 0.42, 0.08, torso, true).scale.set(0.95, 1.3, 0.75); // the swelling core
    c.B(0.2, 0.46, 0.06, 0, 0.42, 0.2, M.dbronze, torso, false, [0, 0, 0]);
    c.B(0.5, 0.2, 0.28, 0, 0.74, -0.02, M.bronze, torso);
    for (const s of [-1, 1]) {
      c.B(0.22, 0.2, 0.3, s * 0.34, 0.76, -0.02, M.dbronze, torso, false, [0, 0, s * -0.3]);
      c.B(0.05, 0.38, 0.05, s * 0.16, 0.42, -0.18, M.black, torso, false, [0, 0, s * 0.2]);
    }
    const head = c.pivot(0, 0.96, 0.04, torso);
    head.rotation.x = -0.3;
    c.B(0.12, 0.2, 0.12, 0, 0.1, 0, M.bronze, head, true);
    cone(c, 0.06, 0.28, M.black, 0, 0.3, -0.04, head, [-0.3, 0, 0], false, 4); // crest
    eye(c, head, 0, 0.1, 0.07, 0.035);
    const l = arm(c, torso, -0.34, 0.8, 0.7, 0.14, M.bronze, -0.5, 0.15), r = arm(c, torso, 0.34, 0.8, 0.7, 0.14, M.bronze, -1.2, -0.1, false);
    c.arms.push(l, r);
    c.B(0.14, 0.14, 0.2, 0, -0.72, 0.1, M.black, r);
    gun(c, torso, 0.34, 0.5, 0.35, 0.36, 0.08, M.black, M.red);
    c.height = 1.75;
  },
  vx_hobgoblin(c) {
    // a sniper: swept antlers, a long tail, an open V chest with the core, and a very long rifle
    const M = vm();
    const torso = vexBody(c, { h: 1.05, sw: 1.1 });
    const head = torso.userData.head;
    for (const s of [-1, 1]) {
      c.B(0.34, 0.09, 0.09, s * 0.2, 0.12, 0, M.bronze, head, false, [0, 0, s * 0.35]);
      c.B(0.55, 0.08, 0.09, s * 0.5, 0.26, 0, M.dbronze, head, false, [0, 0, s * 0.8]);
      cone(c, 0.04, 0.3, M.bronze, s * 0.28, 0.24, 0, head, [0, 0, s * -0.35], false, 4);
    }
    // tail: a chain of boxes curving up behind
    for (let i = 0; i < 6; i++) c.B(0.06 - i * 0.006, 0.06, 0.28, 0, 0.1 + i * 0.01 - (i > 3 ? 0 : 0.0), -0.3 - i * 0.26, M.black, torso, false, [-0.15 + i * 0.1, 0, 0]);
    for (const s of [-1, 1]) c.B(0.12, 0.34, 0.12, s * 0.46, 0.84, -0.04, M.bronze, torso, false, [0, 0, s * -0.25]); // spiked shoulder blades
    const l = arm(c, torso, -0.38, 0.78, 0.66, 0.14, M.bronze, -0.2, 0.2), r = arm(c, torso, 0.38, 0.78, 0.66, 0.14, M.bronze, -1.25, -0.1, false);
    c.arms.push(l, r);
    // the long rifle: stock, barrel, scope; the muzzle sits at the tip
    gun(c, torso, 0.38, 0.52, 0.68, 1.5, 0.07, M.black, M.red);
    c.B(0.1, 0.12, 0.3, 0.38, 0.5, 0.0, M.dbronze, torso);
    c.B(0.05, 0.05, 0.4, 0.38, 0.62, 0.8, M.bronze, torso);
    c.height = 2.35;
  },
  vx_harpy(c) {
    // a hovering scout: a dark core housing with a big red eye, swept bronze plates up and down, an open jaw, trailing cables
    const M = vm();
    c.hover = true;
    const body = c.pivot(0, 0.9, 0);
    c.torso = body;
    cyl(c, 0.26, 0.3, 0.42, 6, M.black, 0, 0, 0, body, [PI / 2, 0, 0]);
    cyl(c, 0.2, 0.2, 0.1, 8, M.dbronze, 0, 0, 0.22, body, [PI / 2, 0, 0]);
    eye(c, body, 0, 0.0, 0.29, 0.12);
    ico(c, 0.06, 0, M.red, 0, -0.17, 0.26, body, true);
    for (const s of [-1, 1]) {
      c.B(0.8, 0.06, 0.7, s * 0.6, 0.3, -0.15, M.bronze, body, false, [0.15, s * 0.5, s * -0.5]); // upper swept plate
      c.B(0.7, 0.06, 0.55, s * 0.55, -0.34, -0.05, M.dbronze, body, false, [-0.2, s * -0.5, s * 0.55]); // lower plate
      c.B(0.8, 0.03, 0.12, s * 0.7, 0.02, -0.2, M.black, body, false, [0, s * 0.35, s * 0.1]); // cable
    }
    // jaw: two dark prongs under the eye
    for (const s of [-1, 1]) cone(c, 0.05, 0.4, M.black, s * 0.14, -0.28, 0.3, body, [PI / 2 + 0.2, 0, s * 0.3], false, 4);
    c.B(0.07, 0.07, 0.3, 0.0, -0.1, 0.4, M.bronze, body);
    c.muzzle.position.set(0, -0.1, 0.6); body.add(c.muzzle);
    c.height = 1.6;
  },
  vx_minotaur(c) {
    // a big heavy: thick bent legs, massive rounded shoulders with red lights, a sunk head with a horned crown, a glowing abdomen, a cannon on one arm and a Torch Hammer on the other
    const M = vm();
    legsBiped(c, 0.95, 0.27, 0.28, M.dbronze, M.black);
    const torso = c.pivot(0, 0.95, 0);
    c.torso = torso;
    c.B(0.56, 0.2, 0.36, 0, 0.1, 0, M.black, torso);
    ico(c, 0.17, 1, M.milk, 0, 0.34, 0.1, torso, true).scale.set(1, 1.1, 0.7); // weak spot: the abdomen
    c.B(0.78, 0.36, 0.44, 0, 0.72, 0, M.bronze, torso); // barrel chest
    c.B(0.5, 0.08, 0.06, 0, 0.58, 0.24, M.black, torso);
    for (const s of [-1, 1]) {
      ico(c, 0.3, 1, M.bronze, s * 0.56, 0.86, 0, torso).scale.set(1.1, 0.95, 1.2); // huge round shoulders
      ico(c, 0.05, 0, M.red, s * 0.26, 0.78, 0.24, torso);
    }
    c.B(0.3, 0.16, 0.22, 0, 0.98, 0.0, M.black, torso);
    const head = c.pivot(0, 1.06, 0.06, torso);
    c.B(0.22, 0.2, 0.2, 0, 0.04, 0, M.bronze, head, true);
    cone(c, 0.12, 0.14, M.black, 0, -0.06, 0.06, head, [PI + 0.2, 0, 0], false, 4);
    eye(c, head, 0, 0.04, 0.1, 0.05);
    for (const s of [-1, 1]) c.B(0.26, 0.06, 0.08, s * 0.2, 0.2, -0.02, M.bronze, head, false, [0, 0, s * 0.4]); // crown horns
    const l = arm(c, torso, -0.68, 0.84, 0.74, 0.14, M.bronze, -1.2, 0.2, false);
    const r = arm(c, torso, 0.68, 0.84, 0.74, 0.14, M.bronze, -0.15, -0.1, false);
    c.arms.push(l, r);
    c.B(0.24, 0.7, 0.24, 0, -0.95, 0.04, M.black, l); // cannon forearm (the arm points forward, so its length runs along local y)
    c.B(0.12, 0.4, 0.12, 0, -1.4, 0.04, M.dbronze, l);
    c.B(0.16, 0.8, 0.16, 0, -0.9, 0.12, M.black, r); // Torch Hammer haft
    c.B(0.4, 0.34, 0.34, 0, -1.34, 0.12, M.bronze, r); // hammer head
    c.B(0.42, 0.06, 0.2, 0, -1.34, 0.12, M.red, r);
    c.muzzle.position.set(0.1, 0.62, 0.5); torso.add(c.muzzle);
    c.height = 2.5;
  },
  vx_wyvern(c) {
    // a Minotaur frame with a broad delta crest and two big shield-wings on glowing nodes, and a Warp Lance
    const M = vm();
    BUILD.vx_minotaur(c);
    const t = c.torso;
    // crest: a wide delta over the head
    c.B(0.9, 0.05, 0.4, 0, 1.3, 0.0, M.bronze, t, false, [-0.3, 0, 0]);
    for (const s of [-1, 1]) {
      c.B(0.5, 0.05, 0.3, s * 0.6, 1.22, 0.0, M.dbronze, t, false, [-0.3, 0, s * 0.45]);
      cone(c, 0.05, 0.5, M.bronze, s * 0.2, 1.48, -0.05, t, [0, 0, s * -0.3], false, 4);
    }
    // wings: a dark node with a milky glow, a big flat fan plate on each side
    for (const s of [-1, 1]) {
      const w = c.pivot(s * 0.98, 1.02, -0.45, t);
      ico(c, 0.14, 0, M.milk, 0, 0, 0, w);
      cyl(c, 0.5, 0.5, 0.07, 6, M.bronze, s * 0.3, 0.1, 0, w, [PI / 2, 0, s * 0.3]);
      cyl(c, 0.34, 0.34, 0.09, 6, M.dbronze, s * 0.3, 0.1, 0, w, [PI / 2, 0, s * 0.3]);
    }
    c.B(0.1, 0.1, 1.6, 0.34, 0.55, 0.8, M.black, t); // Warp Lance
    c.B(0.06, 0.06, 0.4, 0.34, 0.55, 1.7, M.red, t);
    c.muzzle.position.set(0.34, 0.55, 1.95);
    c.height = 2.7;
  },
  vx_hydra(c) {
    // a levitating armoured spine: a heavy winged head with the red eye, a big stack of bronze plated segments with swept fins, a short spike tail, a rotating shield ring (`c.spin`)
    const M = vm();
    c.hover = true;
    const body = c.pivot(0, 1.1, 0);
    c.torso = body;
    // heavy head: wide armoured block, swept-back fins, a brow plate
    c.B(0.8, 0.46, 0.7, 0, 0.8, 0.12, M.bronze, body, true);
    c.B(0.9, 0.12, 0.5, 0, 1.06, 0.0, M.dbronze, body, false, [-0.2, 0, 0]);
    eye(c, body, 0, 0.82, 0.5, 0.1);
    for (const s of [-1, 1]) {
      c.B(0.9, 0.1, 0.5, s * 0.7, 1.0, -0.2, M.bronze, body, false, [0.15, s * 0.4, s * -0.2]); // swept-back fins
      c.B(0.6, 0.1, 0.4, s * 0.55, 0.62, -0.1, M.dbronze, body, false, [0.1, s * 0.4, s * 0.3]);
      c.B(0.14, 0.4, 0.5, s * 0.42, 0.78, 0.15, M.black, body);
    }
    // body: a chunky stack of plated segments, each with a black core, a bronze collar and heavy side arms
    for (let i = 0; i < 4; i++) {
      const y = 0.4 - i * 0.42, k = 1 - i * 0.1;
      c.B(0.7 * k, 0.4, 0.6 * k, 0, y, 0, M.bronze, body);
      c.B(0.82 * k, 0.1, 0.7 * k, 0, y + 0.22, 0, M.dbronze, body);
      c.B(0.3 * k, 0.12, 0.64 * k, 0, y - 0.04, 0.0, M.black, body);
      ico(c, 0.1, 0, M.milk, 0, y, 0.3 * k, body, i === 0);
      for (const s of [-1, 1]) c.B(0.85 * k, 0.16, 0.34, s * 0.62 * k, y + 0.06, 0.0, M.bronze, body, false, [0, 0, s * (-0.12 - i * 0.06)]);
    }
    cone(c, 0.2, 0.6, M.black, 0, -1.55, 0, body, [PI, 0, 0], false, 4); // short spike tail
    c.B(0.14, 0.14, 0.9, 0.6, 0.45, 0.55, M.black, body); // Aeon Maul
    c.B(0.3, 0.3, 0.3, 0.6, 0.45, 1.05, M.bronze, body);
    c.muzzle.position.set(0.6, 0.45, 1.2); body.add(c.muzzle);
    // shield ring: thin translucent panels well outside the body
    const spin = c.pivot(0, 0.0, 0.0, body);
    for (const a of [-1.0, 0, 1.0]) {
      const p = c.pivot(0, 0, 0, spin);
      p.rotation.y = a;
      c.B(0.85, 1.0, 0.025, 0, 0, 1.25, M.glass, p);
      c.B(0.85, 0.04, 0.05, 0, 0.5, 1.25, M.bronze, p);
      c.B(0.85, 0.04, 0.05, 0, -0.5, 1.25, M.bronze, p);
    }
    c.spin = spin;
    c.height = 2.6;
  },
  vx_cyclops(c) {
    // a pedestal turret: a ringed base and column holding a dark sphere with one huge red eye, petal plates around it, two long swept blades up
    const M = vm();
    c.hover = true;
    const body = c.pivot(0, 1.3, 0);
    c.torso = body;
    ico(c, 0.7, 1, M.black, 0, 0, 0, body);
    cyl(c, 0.52, 0.52, 0.16, 8, M.dbronze, 0, 0.0, 0.58, body, [PI / 2, 0, 0]);
    eye(c, body, 0, 0.0, 0.7, 0.3);
    for (let i = 0; i < 6; i++) { // petal plates around the eye
      const a = (i / 6) * PI * 2 + PI / 6;
      c.B(0.34, 0.5, 0.05, Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.2, M.bronze, body, false, [0, 0.3, a - PI / 2]);
    }
    for (const s of [-1, 1]) { // long swept blades
      c.B(1.5, 0.12, 0.3, s * 1.15, 0.55, -0.05, M.dbronze, body, false, [0, 0, s * 0.4]);
      c.B(0.14, 0.9, 0.24, s * 1.85, 1.0, -0.05, M.black, body, false, [0, 0, s * -0.12]);
      c.B(0.9, 0.05, 0.55, s * 0.8, 0.35, -0.08, M.bronze, body, false, [0, 0, s * 0.45]);
    }
    cyl(c, 0.3, 0.38, 0.9, 6, M.bronze, 0, -0.9, 0, body); // column
    cyl(c, 0.12, 0.12, 0.5, 6, M.black, 0, -0.9, 0.0, body);
    cyl(c, 0.8, 0.8, 0.08, 10, M.black, 0, -1.3, 0, body); // ring base
    cyl(c, 0.6, 0.6, 0.1, 10, M.dbronze, 0, -1.26, 0, body);
    c.muzzle.position.set(0, 0.2, 0.9); body.add(c.muzzle);
    c.height = 3.0;
  },
  vx_imp(c) {
    // one of the Imp Swarm: a small dome with two crescent wings, a red eye and dangling spider legs
    imp(c, 1);
    c.height = 0.9;
  },
  vx_imp_swarm(c) {
    // the main body of a swarm: a bigger imp with a milky radiolaria core and red eye ring, circled by small imps; killing it sends the rest charging
    const M = vm();
    imp(c, 1.7);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + 0.4, x = Math.cos(a) * 0.75, z = Math.sin(a) * 0.75, y = Math.sin(a * 2) * 0.12;
      const o = c.pivot(x, 0.9 + y, z, c.torso);
      o.rotation.y = PI / 2 - a;
      impParts(c, o, 0.55, false);
    }
    c.height = 1.5;
  },
};

/** Shared imp frame: parts in a pivot at 0.9 on the unit (or a small satellite). */
function impParts(c, b, k, main) {
  const M = vm();
  ico(c, 0.17 * k, 0, M.bronze, 0, 0.02 * k, 0, b).scale.set(1.1, 0.85, 1);
  ico(c, 0.08 * k, 1, M.red, 0, -0.02 * k, 0.13 * k, b, main).scale.z = 0.6;
  c.B(0.34 * k, 0.025, 0.04, 0, -0.01 * k, 0.15 * k, M.red, b); // the eye's glowing bar
  for (const s of [-1, 1]) {
    c.B(0.2 * k, 0.04 * k, 0.16 * k, s * 0.15 * k, 0.12 * k, -0.02 * k, M.dbronze, b, false, [0, 0, s * -0.45]); // crescent wing
    c.B(0.16 * k, 0.04 * k, 0.12 * k, s * 0.27 * k, 0.2 * k, -0.02 * k, M.bronze, b, false, [0, 0, s * -0.9]);
    for (const f of [-1, 1]) { // spider legs, two segments each
      const lx = s * 0.1 * k, lz = f * 0.06 * k;
      c.B(0.04 * k, 0.16 * k, 0.04 * k, lx + s * 0.05 * k, -0.12 * k, lz, M.black, b, false, [0, 0, s * 0.6]);
      c.B(0.035 * k, 0.16 * k, 0.035 * k, lx + s * 0.12 * k, -0.25 * k, lz, M.black, b, false, [0, 0, s * -0.4]);
    }
  }
}
function imp(c, k) {
  const M = vm();
  c.hover = true;
  const b = c.pivot(0, 0.6 + (k - 1) * 0.3, 0);
  c.torso = b;
  impParts(c, b, k, true);
  if (k > 1) { // swarm leader: milky core under the dome, a precision spot
    ico(c, 0.1 * k, 1, M.milk, 0, -0.04 * k, 0.0, b, true);
    c.muzzle.position.set(0, 0, 0.4); b.add(c.muzzle);
  }
}


// Original (pre-rework) helpers, kept for the older factions' units below so they are unchanged.
function legsStd(c, hipY, hipW, thick, m, foot, digi = false) {
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
function armStd(c, parent, x, y, len, thick, m, lift = -1.1, rz = 0) {
  const p = c.pivot(x, y, 0, parent);
  c.B(thick, len, thick, 0, -len / 2, 0, m, p);
  p.rotation.x = lift; p.rotation.z = rz;
  return p;
}

// ---- the older factions' new Destiny 2 units ----
const EXTRA = {
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
    legsStd(c, 0.9, 0.19 * W, 0.2, c.dark, steel);
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
    const l = armStd(c, torso, -0.46 * W, 0.7, 0.55, 0.15, c.dark, -1.2, 0.15), r = armStd(c, torso, 0.46 * W, 0.7, 0.55, 0.15, c.dark, -1.1, -0.1);
    c.arms.push(l, r);
    gun(c, torso, 0.1, 0.42, 0.52, 0.9, 0.16, steel, c.accent);
    c.add(new THREE.CylinderGeometry(0.1, 0.07, 0.3, 6).rotateX(PI / 2), steel, 0.1, 0.42, 1.02, torso);
    c.height = 2.2;
  },
  lg_gladiator(c) {
    // massive melee infantry: a wide dark-grey frame, shoulder slabs, a horned helm with a visor slit, a Severus blade
    const steel = mat(0x4a4a50), red = mat(0xb02a1a);
    const W = 1.5;
    legsStd(c, 0.95, 0.2 * W, 0.22, c.dark, steel);
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
    const l = armStd(c, torso, -0.52 * W, 0.78, 0.6, 0.17, c.dark, -0.9, 0.15), r = armStd(c, torso, 0.52 * W, 0.78, 0.6, 0.17, c.dark, -1.35, -0.1);
    c.arms.push(l, r);
    c.B(0.07, 1.5, 0.14, 0, -0.9, 0.2, steel, r, false, [0.2, 0, 0]); // Severus
    c.B(0.04, 1.3, 0.08, 0, -0.9, 0.28, c.accent, r, false, [0.2, 0, 0]);
    c.height = 2.5;
  },
};

export function vex(c, typeId) { (BUILD[typeId] || BUILD.vx_goblin)(c); }
/** Builders for the new Destiny 2 units of the older factions (null when `typeId` is not one of them). */
export function extraModel(typeId) { return EXTRA[typeId] || null; }
