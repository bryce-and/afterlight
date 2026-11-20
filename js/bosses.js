import * as THREE from 'three';
import { mat } from './world.js';
import * as VEX_MODELS from './models-vex.js';
import * as TAKEN_MODELS from './models-taken.js';

// ---------------------------------------------------------------------------
// Unique boss models. Each builder takes the kit from enemies.js buildModel:
// { g, add, B, pivot, bodyMat, dark, accent, C, muzzle, legs, arms, torso, height }.
// Models face +z, stand on y = 0 and are built ~2 m tall (def.scale enlarges them).
// Head/eye/weak-point meshes are tagged crit. Every model sets c.torso.
// ---------------------------------------------------------------------------
import { PI, cone, cyl, ico, legs, arm, gun } from './boss-kit.js';
import { FALLEN_BOSSES } from './bosses-fallen.js';
import { SCORN_BOSSES } from './bosses-scorn.js';
import { HIVE_BOSSES } from './bosses-hive.js';
import { CABAL_BOSSES } from './bosses-cabal.js';
import { TAKEN_BOSSES } from './bosses-taken.js';
import { veshraClassic } from './boss-veshra.js';
import { VEX_BOSSES } from './bosses-vex.js';


/**
 * U21: Aurix, Hollowed Mind (the Whisper's boss). Builder B exports buildTakenMind() from models-vex.js or models-taken.js (a THREE.Group about 5 m
 * tall with a child named 'eye'). Namespace imports keep this file loading before that export exists; asking for the model without it is an error.
 * Each mesh is baked into the enemy's hit list (the boss kit only takes geometry), so the 'eye' subtree is the precision weak point.
 */
function takenMind(c) {
  const build = VEX_MODELS.buildTakenMind || TAKEN_MODELS.buildTakenMind;
  if (!build) throw new Error('Boss model takenMind needs buildTakenMind() exported from js/models-vex.js or js/models-taken.js');
  const grp = build();
  grp.updateMatrixWorld(true);
  const eye = grp.getObjectByName('eye');
  const inEye = (o) => { for (let p = o; p; p = p.parent) if (p === eye) return true; return false; };
  grp.traverse((o) => {
    if (!o.isMesh) return;
    c.add(o.geometry.clone().applyMatrix4(o.matrixWorld), o.material, 0, 0, 0, c.g, !!eye && inEye(o));
  });
  c.torso = c.pivot(0, 2.5, 0);
  c.muzzle.position.set(0, 3.2, 1.4);
  c.g.add(c.muzzle);
  c.hover = true;
  c.height = 5;
}

export const BOSS_MODELS = {
  takenMind,
  // -------------------------------------------------------------------------
  // FALLEN
  // -------------------------------------------------------------------------
  ...FALLEN_BOSSES,
  ...SCORN_BOSSES,
  // -------------------------------------------------------------------------
  // HIVE
  // -------------------------------------------------------------------------
  ...HIVE_BOSSES,
  ...CABAL_BOSSES,
  ...TAKEN_BOSSES,
  veshra: veshraClassic, // U31: her original Ahamkara model, over the U29 Taken-wizard rebuild
  ...VEX_BOSSES,
  // -------------------------------------------------------------------------
  // CABAL
  // -------------------------------------------------------------------------



  // -------------------------------------------------------------------------
  // IO: Taken, Psions and the Vex
  // -------------------------------------------------------------------------



  // -------------------------------------------------------------------------
  // U15: Dreaming City and Leviathan story bosses
  // -------------------------------------------------------------------------



  calus(c) {
    const { B, add, bodyMat } = c;
    // Emperor Calus: black marble and gold on the outside, a hidden automaton underneath
    const marble = mat(0x16141a), gold = mat(0xd9a93c, { metalness: 0.7, roughness: 0.35 });
    const glow = mat(0xffc247, { emissive: 0xffc247, emissiveIntensity: 2.8 });
    const capeM = mat(0x5a1018);
    const steel = mat(0x4a4e56, { metalness: 0.8, roughness: 0.4 });
    const wire = mat(0x6a1a1a);
    const redEye = mat(0xff2a1a, { emissive: 0xff2a1a, emissiveIntensity: 1.2 });
    const W = 1.5;
    legs(c, 1.1, 0.17 * W, 0.19 * W, marble, gold);
    // exposed servo joints on the knees (a thing no flesh Cabal has)
    for (const k of c.legs) cyl(c, 0.075, 0.075, 0.26, 6, steel, 0, -0.55, 0.0, k, false, [0, 0, PI / 2]);
    const torso = c.pivot(0, 1.1, 0);
    c.torso = torso;
    B(0.44 * W, 0.28, 0.32, 0, 0.13, 0, marble, torso);
    // the plates that fly off at death are children of one group
    const plates = c.pivot(0, 0, 0, torso);
    plates.userData.parts = [];
    const part = (m) => { plates.userData.parts.push(m); return m; };
    part(B(0.7 * W, 0.62, 0.5, 0, 0.55, 0, marble, plates));
    part(B(0.56 * W, 0.2, 0.08, 0, 0.9, 0.2, gold, plates));
    // cracked chest plate with a gleam of servo behind it
    B(0.34, 0.34, 0.03, 0, 0.55, 0.255, steel, torso);
    part(B(0.3 * W, 0.4, 0.05, -0.03, 0.55, 0.28, gold, plates, false, [0, 0, 0.04]));
    part(B(0.025, 0.46, 0.06, 0.07, 0.55, 0.31, marble, plates, false, [0, 0, 0.3]));
    part(B(0.2, 0.025, 0.06, -0.04, 0.6, 0.31, marble, plates, false, [0, 0, -0.3]));
    // wires poking from the crack
    for (const [x, y, r] of [[0.07, 0.4, 0.4], [-0.05, 0.62, -0.3], [0.1, 0.7, 0.1]]) B(0.012, 0.16, 0.012, x, y, 0.27, wire, torso, false, [0.3, 0, r]);
    // head, crown and crest
    part(B(0.34, 0.34, 0.34, 0, 1.05, 0.04, marble, plates, true));
    part(B(0.26, 0.1, 0.06, 0, 1.0, 0.22, c.dark, plates, true));
    part(B(0.22, 0.035, 0.03, 0, 1.03, 0.255, glow, plates, true));
    part(B(0.4, 0.07, 0.4, 0, 1.25, 0.04, gold, plates, true));
    for (let i = 0; i < 7; i++) {
      const a = (i - 3) / 3;
      part(cone(c, 0.035, 0.22 + 0.12 * (1 - Math.abs(a)), 4, gold, a * 0.18, 1.35 + 0.05 * (1 - Math.abs(a)), 0.04, plates, true, [0, 0, -a * 0.35]));
    }
    // golden pauldrons
    for (const s of [-1, 1]) {
      part(B(0.34 * W, 0.2, 0.56, s * 0.5 * W, 0.92, 0, gold, plates, false, [0, 0, s * -0.2]));
      part(cone(c, 0.07, 0.42, 4, gold, s * 0.62 * W, 1.12, -0.05, plates, false, [0, 0, s * -0.65]));
    }
    // ceremonial cape
    part(B(1.0, 0.18, 0.16, 0, 0.98, -0.28, gold, plates));
    part(B(1.1, 2.0, 0.04, 0, -0.1, -0.34, capeM, plates, false, [0.1, 0, 0]));
    part(B(1.1, 0.06, 0.06, 0, -1.1, -0.44, gold, plates, false, [0.1, 0, 0]));
    // arms with exposed servo elbows; the right holds a huge golden hand cannon
    const arms = [arm(c, torso, -0.5 * W, 0.8, 0.6, 0.17, marble, -1.0, 0.12), arm(c, torso, 0.5 * W, 0.8, 0.6, 0.17, marble, -1.15, -0.12)];
    for (const a of arms) {
      cyl(c, 0.1, 0.1, 0.3, 6, steel, 0, -0.32, 0, a, false, [0, 0, PI / 2]);
      B(0.22, 0.24, 0.22, 0, -0.66, 0, gold, a);
      B(0.012, 0.3, 0.012, 0.09, -0.28, 0.09, wire, a);
    }
    c.arms.push(...arms);
    c.B(0.2, 0.3, 0.3, 0.55 * W, 0.62, 0.45, gold, torso);
    B(0.16, 0.2, 1.0, 0.55 * W, 0.7, 0.95, gold, torso);
    B(0.1, 0.1, 0.5, 0.55 * W, 0.7, 1.55, marble, torso);
    B(0.06, 0.05, 0.5, 0.55 * W, 0.82, 1.0, glow, torso);
    cyl(c, 0.06, 0.06, 0.5, 8, glow, 0.55 * W, 0.7, 0.95, torso, false, [PI / 2, 0, 0]);
    c.muzzle.position.set(0.55 * W, 0.7, 1.85);
    torso.add(c.muzzle);

    // ---- hidden automaton, revealed at death. Plain meshes: never hit targets while hidden.
    const sk = new THREE.Group();
    sk.visible = false;
    const bit = (w, h, d, x, y, z, m, rot) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
      sk.add(mesh);
      return mesh;
    };
    bit(0.08, 0.9, 0.08, 0, 0.55, 0, steel);
    for (let i = 0; i < 4; i++) {
      bit(0.62 - i * 0.07, 0.04, 0.04, 0, 0.35 + i * 0.14, 0.12, steel);
      for (const s of [-1, 1]) bit(0.04, 0.04, 0.3, s * (0.3 - i * 0.035), 0.35 + i * 0.14, 0, steel, [0, s * 0.3, 0]);
    }
    bit(0.28, 0.26, 0.28, 0, 1.0, 0.04, steel);
    bit(0.12, 0.05, 0.04, 0, 1.0, 0.2, redEye).material = redEye;
    bit(0.34, 0.1, 0.1, 0, 0.1, 0, steel);
    for (const s of [-1, 1]) {
      bit(0.07, 0.07, 0.5, s * 0.5 * W, 0.8, 0.1, steel);
      bit(0.1, 0.1, 0.1, s * 0.5 * W, 0.8, 0.0, steel);
    }
    for (let i = 0; i < 9; i++) bit(0.012, 0.012, 0.35, (i - 4) * 0.06, 0.35 + (i % 3) * 0.2, 0.08, wire, [i * 0.3, (i - 4) * 0.2, 0]);
    torso.add(sk);
    // sparks: plates tumble away under gravity over the death fade, the skeleton takes their place
    const sparkM = new THREE.MeshBasicMaterial({ color: 0xffc247 });
    c.onDeath = () => {
      sk.visible = true;
      for (const m of plates.userData.parts) {
        m.userData.start = m.position.clone();
        m.userData.v = new THREE.Vector3(m.position.x * 3 + (Math.random() - 0.5), 1.5 + Math.random() * 2.5, m.position.z * 2 + (Math.random() - 0.3) * 3);
        m.userData.spin = new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
      }
      c.dead = true;
    };
    c.deathStep = (t) => {
      if (!c.dead) return;
      for (const m of plates.userData.parts) {
        const u = m.userData, k = Math.min(t, 1.4);
        m.position.set(u.start.x + u.v.x * k, u.start.y + u.v.y * k - 4.9 * k * k, u.start.z + u.v.z * k);
        m.rotation.set(u.spin.x * k, u.spin.y * k, u.spin.z * k);
      }
      if (Math.random() < 0.5) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), sparkM);
        sp.position.set((Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 0.7, 0.3);
        sp.scale.setScalar(1 + Math.random());
        torso.add(sp);
        setTimeout(() => torso.remove(sp), 120);
      }
    };
    c.height = 3.1;
  },

  // U23 "Vhorrak, the Anointed": a giant Loyalist bath-attendant champion (The Emperor's Shadow). Built at its real size, about 4.6 m tall.
  anointedBather(c) {
    const { B, bodyMat } = c;
    const skin = mat(0x555a48, { roughness: 0.28, metalness: 0.18 });   // dark olive-grey, oiled
    const skin2 = mat(0x474c3c, { roughness: 0.3, metalness: 0.15 });
    const gold = mat(0xd9a93c, { metalness: 0.7, roughness: 0.35 });
    const goldD = mat(0x9a7424, { metalness: 0.6, roughness: 0.4 });
    const cloth = mat(0x4a1f6e);
    const steel = mat(0x2c3038, { metalness: 0.8, roughness: 0.35 });
    const visor = mat(0x08090c);
    const eye = mat(0x5cff7a, { emissive: 0x5cff7a, emissiveIntensity: 2.8 });
    legs(c, 1.7, 0.42, 0.52, skin, skin2);
    for (const k of c.legs) {
      B(0.58, 0.3, 0.58, 0, -0.62, 0.02, goldD, k);                         // ankle ring
      for (const dx of [-0.17, 0, 0.17]) B(0.14, 0.1, 0.22, dx, -1.66, 0.36, skin2, k); // toes
    }
    const torso = c.pivot(0, 1.7, 0);
    c.torso = torso;
    // waist cloth with a gold hem (front and back panels over the hips)
    B(1.45, 0.95, 1.0, 0, 0.05, 0, cloth, torso);
    B(1.5, 0.1, 1.06, 0, -0.45, 0, gold, torso);
    B(0.6, 0.9, 0.06, 0, -0.1, 0.55, cloth, torso, false, [0.12, 0, 0]);
    B(0.64, 0.08, 0.08, 0, -0.56, 0.59, gold, torso, false, [0.12, 0, 0]);
    B(1.5, 0.16, 1.06, 0, 0.55, 0, goldD, torso);                           // belt
    // the hunched upper body leans forward
    const up = c.pivot(0, 0.6, 0, torso);
    up.rotation.x = 0.3;
    B(1.7, 1.3, 1.05, 0, 0.7, 0, skin, up);                                 // chest and belly
    B(1.3, 0.6, 0.9, 0, 0.35, 0.15, skin2, up);                             // gut
    B(0.5, 0.5, 0.06, -0.38, 0.95, 0.54, skin2, up);                        // pectoral planes
    B(0.5, 0.5, 0.06, 0.38, 0.95, 0.54, skin2, up);
    B(1.2, 0.5, 0.8, 0, 1.5, -0.1, skin, up);                               // hump
    // mantle of overlapping gold scale plates across the shoulders and upper back
    for (let row = 0; row < 4; row++) {
      const n = 7 - row, y = 1.75 - row * 0.3, z = -0.45 - row * 0.1;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * (0.5 - row * 0.02);
        B(0.52, 0.06, 0.55, x, y, z, row % 2 ? goldD : gold, up, false, [0.55 + row * 0.1, 0, (i - (n - 1) / 2) * 0.1]);
      }
    }
    for (const s of [-1, 1]) {
      B(0.7, 0.14, 0.9, s * 1.0, 1.62, 0.05, gold, up, false, [0, 0, s * -0.25]);   // pauldron caps
      B(0.64, 0.12, 0.84, s * 1.08, 1.45, 0.05, goldD, up, false, [0, 0, s * -0.35]);
    }
    // neck and the tall gold helm: a fan crest, a narrow visor slit with two green eyes (the head is the weak point)
    B(0.55, 0.4, 0.5, 0, 1.78, 0.28, skin2, up);
    const head = c.pivot(0, 2.05, 0.5, up);
    head.rotation.x = -0.2;
    B(0.78, 0.95, 0.8, 0, 0.18, 0, gold, head, true);
    B(0.86, 0.12, 0.88, 0, -0.34, 0, goldD, head, true);
    B(0.62, 0.1, 0.84, 0, 0.78, 0, goldD, head, true);
    B(0.56, 0.08, 0.05, 0, 0.12, 0.41, visor, head, true);
    for (const s of [-1, 1]) {
      B(0.1, 0.045, 0.05, s * 0.15, 0.12, 0.43, eye, head, true);
      B(0.06, 0.5, 0.1, s * 0.41, 0.0, 0.34, goldD, head, true, [0, s * 0.4, 0]);   // cheek guards
    }
    B(0.08, 0.7, 0.06, 0, 0.35, 0.41, goldD, head, true);                           // nasal ridge
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) / 4, hgt = 0.95 + 0.45 * (1 - Math.abs(a));
      B(0.12, hgt, 0.05, a * 0.55, 0.85 + hgt * 0.4, -0.22 - Math.abs(a) * 0.12, i % 2 ? gold : goldD, head, true, [-0.15, 0, -a * 0.75]);
    }
    // arms on pivots: bare, with gold forearm bands; a broad flat cleaver in each hand
    const arms = [arm(c, torso, -1.2, 1.7, 1.9, 0.5, skin, -0.9, 0.1), arm(c, torso, 1.2, 1.7, 1.9, 0.5, skin, -1.1, -0.1)];
    for (const a of arms) {
      B(0.62, 0.22, 0.62, 0, -0.35, 0, gold, a);                           // upper arm band
      B(0.56, 0.5, 0.56, 0, -1.35, 0, gold, a);                            // forearm band
      B(0.6, 0.1, 0.6, 0, -1.07, 0, goldD, a);
      // a knife grip (Bryce, 2026-11-15): the handle runs through the closed fist at a right angle to the forearm (local z), and the
      // blade carries on forward from the fist, spine up and the gold edge down, so a raised arm holds the cleaver out like a knife
      B(0.58, 0.5, 0.56, 0, -2.1, 0, skin2, a);                            // closed fist
      for (const k of [-1, 0, 1]) B(0.12, 0.1, 0.5, k * 0.17, -2.32, 0.02, skin2, a); // knuckle ridge under the handle
      B(0.15, 0.15, 1.0, 0, -2.1, 0.05, goldD, a);                         // handle, through the fist
      B(0.2, 0.2, 0.12, 0, -2.1, -0.5, gold, a);                           // pommel cap behind the fist
      B(0.14, 0.9, 0.12, 0, -2.2, 0.55, gold, a);                          // guard
      B(0.1, 0.8, 1.6, 0, -2.3, 1.4, steel, a);                            // blade: spine at -1.9, edge at -2.7
      B(0.12, 0.09, 1.6, 0, -2.72, 1.4, gold, a);                          // gold cutting edge
      B(0.1, 0.62, 0.3, 0, -2.36, 2.26, steel, a, false, [0.55, 0, 0]);    // clipped tip
    }
    c.arms.push(...arms);
    c.muzzle.position.set(0, 1.1, 1.3);
    torso.add(c.muzzle);
    c.height = 4.6;
  },

  // U23 chunk B: Kathrax, the Royal Huntmaster (original design). A tall, broad Loyalist hunt-master in gold-and-purple hunting armour with a long
  // split cloak down the back, a war-beast skull trophy on the left shoulder, a hunting horn on the belt, a domed gold helmet with a visor (the
  // weak point) and a long harpoon cannon carried in both hands pointing forward (+z). Built ~4.3 m tall (the def scales it 0.75).
  huntmaster(c) {
    const { B, bodyMat } = c;
    const gold = mat(0xd9a93c, { metalness: 0.7, roughness: 0.35 });
    const goldD = mat(0x9a7424, { metalness: 0.6, roughness: 0.4 });
    const purple = mat(0x4a1f6e), purpleD = mat(0x35154f);
    const steel = mat(0x2c3038, { metalness: 0.8, roughness: 0.35 }), steelL = mat(0x4a505c, { metalness: 0.7, roughness: 0.4 });
    const bone = mat(0xd8cfbc), dark = mat(0x08090c);
    const eye = mat(0xff8a2a, { emissive: 0xff8a2a, emissiveIntensity: 2.8 });
    const glow = mat(0xb06cff, { emissive: 0x8a3cff, emissiveIntensity: 2.2 });
    bodyMat.color.setHex(0xd9a93c);
    legs(c, 1.6, 0.5, 0.6, steel, goldD);
    for (const k of c.legs) {
      B(0.74, 0.46, 0.78, 0, -0.8, 0.08, gold, k);                           // knee guard
      B(0.68, 0.5, 0.7, 0, -0.4, 0.0, purpleD, k);                             // thigh plate
      B(0.7, 0.2, 0.7, 0, -1.3, 0, goldD, k);                                  // greave band
      for (const dx of [-0.18, 0.18]) B(0.2, 0.14, 0.3, dx, -1.52, 0.5, goldD, k); // two-toed boots
    }
    const torso = c.pivot(0, 1.6, 0);
    c.torso = torso;
    B(1.5, 0.45, 1.0, 0, 0.22, 0, steel, torso);                               // hips
    B(1.56, 0.16, 1.06, 0, 0.5, 0, goldD, torso);                              // belt
    B(0.5, 0.5, 0.1, 0, 0.3, 0.55, gold, torso);                               // belt buckle
    B(1.9, 1.2, 1.1, 0, 1.1, 0, bodyMat, torso);                              // chest plate (the hit flash lights it)
    B(1.2, 0.5, 0.06, 0, 1.2, 0.58, purple, torso);                            // purple hunting tabard
    B(0.9, 0.9, 0.08, 0, 0.0, 0.57, purple, torso, false, [0.06, 0, 0]);       // hanging front panel
    B(0.96, 0.08, 0.1, 0, -0.45, 0.6, gold, torso, false, [0.06, 0, 0]);
    B(1.5, 0.16, 1.1, 0, 1.52, 0.02, goldD, torso);                            // gorget
    // pauldrons, the right one plain, the left one carrying the trophy
    for (const s of [-1, 1]) {
      B(0.95, 0.3, 1.15, s * 1.25, 1.68, 0, gold, torso, false, [0, 0, s * -0.2]);
      B(0.9, 0.22, 1.1, s * 1.32, 1.46, 0, goldD, torso, false, [0, 0, s * -0.35]);
      B(0.14, 0.4, 0.14, s * 1.3, 1.95, 0.35, goldD, torso);                   // pauldron spike
    }
    // the war-beast skull on the left shoulder: braincase, snout, sockets, two swept horns, a spike through it
    B(0.34, 0.5, 0.34, -1.3, 1.95, -0.2, steel, torso);
    B(0.6, 0.46, 0.7, -1.3, 2.3, 0.0, bone, torso, false, [0.15, 0.2, 0]);
    B(0.34, 0.26, 0.5, -1.3, 2.18, 0.5, bone, torso, false, [0.35, 0.2, 0]);
    for (const dx of [-0.16, 0.16]) B(0.14, 0.14, 0.08, -1.3 + dx, 2.38, 0.34, dark, torso);
    for (const dx of [-0.3, 0.3]) cone(c, 0.09, 0.55, 4, bone, -1.3 + dx, 2.62, -0.1, torso, false, [-0.5, 0, dx * -2.2]);
    // hunting horn on the right hip: a curved bone-and-gold horn with a flared bell
    B(0.2, 0.55, 0.2, 0.95, 0.15, 0.5, bone, torso, false, [0, 0, -0.25]);
    B(0.2, 0.4, 0.2, 1.1, -0.18, 0.5, bone, torso, false, [0, 0, -0.7]);
    cone(c, 0.3, 0.45, 8, gold, 1.35, -0.35, 0.5, torso, false, [0, 0, 2.2]);
    B(0.24, 0.08, 0.24, 0.95, 0.42, 0.5, gold, torso);                         // mouthpiece band
    // the long split hunting cloak: two panels down the back from a gold collar, a gold hem on each
    B(1.9, 0.3, 0.5, 0, 1.62, -0.52, gold, torso);
    for (const s of [-1, 1]) {
      B(0.92, 3.0, 0.1, s * 0.5, 0.15, -0.66, purple, torso, false, [0.06, 0, s * 0.05]);
      B(0.96, 0.1, 0.14, s * 0.5, -1.33, -0.74, gold, torso, false, [0.06, 0, s * 0.05]);
      B(0.08, 2.9, 0.14, s * 0.97, 0.15, -0.66, goldD, torso, false, [0.06, 0, s * 0.05]);
    }
    B(0.06, 2.9, 0.12, 0, 0.15, -0.66, goldD, torso, false, [0.06, 0, 0]);
    // neck and the domed gold helmet with a visor, a purple crest and a glowing slit (the weak point)
    B(0.62, 0.3, 0.6, 0, 1.78, 0.08, steel, torso);
    const head = c.pivot(0, 1.85, 0.1, torso);
    head.rotation.x = 0.05;
    B(0.92, 0.82, 0.96, 0, 0.1, 0, gold, head, true);
    ico(c, 0.52, 1, gold, 0, 0.42, -0.02, head, true).scale.set(1, 0.7, 1.05); // the dome
    B(0.98, 0.1, 1.0, 0, -0.34, 0, goldD, head, true);
    B(0.84, 0.22, 0.08, 0, 0.1, 0.5, dark, head, true);                         // visor
    B(0.62, 0.06, 0.05, 0, 0.12, 0.54, eye, head, true);                        // the glowing slit
    B(0.12, 0.5, 0.1, 0, -0.1, 0.52, goldD, head, true);                        // nasal bar
    for (const s of [-1, 1]) B(0.1, 0.55, 0.3, s * 0.47, 0.0, 0.3, goldD, head, true, [0, s * 0.3, 0]); // cheek guards
    B(0.14, 0.34, 1.0, 0, 0.7, -0.05, purple, head, true);                     // crest
    B(0.18, 0.08, 1.04, 0, 0.55, -0.05, gold, head, true);
    // arms aimed at the gun's grips (hip height): right to the rear grip, a longer left to the foregrip. Not in c.arms, so the shared
    // enemy animation never swings them off the gun (Bryce: hold it lower, it looked broken).
    const rArm = arm(c, torso, 1.1, 1.55, 1.58, 0.5, steel, -0.733, -0.566);
    const lArm = arm(c, torso, -1.1, 1.55, 2.31, 0.5, steel, -1.053, 0.496);
    for (const [a, len] of [[rArm, 1.58], [lArm, 2.31]]) {
      B(0.62, 0.6, 0.62, 0, -0.35, 0, gold, a);                                 // upper arm plate
      B(0.58, 0.5, 0.58, 0, -len * 0.7, 0, goldD, a);                           // forearm bracer
      B(0.58, 0.5, 0.58, 0, -len - 0.1, 0, steelL, a);                          // gauntlet over the grip
    }
    // the harpoon cannon, carried low at the hip pointing +z: stock, receiver, grips, a heavy barrel, a gold muzzle ring and a loaded harpoon head
    const GY = 0.72; // the gun's centre line above the torso pivot (waist height)
    B(0.34, 0.45, 0.7, 0, GY, 0.3, steel, torso);                                // stock against the hip
    B(0.56, 0.6, 1.3, 0, GY, 1.35, steel, torso);                                // receiver
    B(0.3, 0.1, 1.3, 0, GY + 0.34, 1.35, gold, torso);                           // gold rail
    B(0.06, 0.34, 0.4, 0.29, GY, 1.0, glow, torso);                              // glowing charge window (right side)
    B(0.34, 0.46, 0.3, 0, GY - 0.42, 0.95, steelL, torso, false, [0.3, 0, 0]);   // rear grip
    B(0.3, 0.4, 0.3, 0, GY - 0.4, 1.85, steelL, torso, false, [-0.15, 0, 0]);    // foregrip
    B(0.34, 0.34, 1.5, 0, GY, 2.75, steel, torso);                               // barrel
    for (const z of [2.3, 2.8, 3.3]) B(0.46, 0.46, 0.14, 0, GY, z, goldD, torso); // barrel bands
    B(0.5, 0.5, 0.2, 0, GY, 3.55, gold, torso);                                  // muzzle ring
    cone(c, 0.15, 0.7, 4, gold, 0, GY, 3.9, torso, false, [PI / 2, 0, 0]);       // harpoon head
    cyl(c, 0.28, 0.28, 0.5, 8, goldD, 0.4, GY, 1.65, torso, false, [0, 0, PI / 2]); // cable winch on the right side
    c.add(new THREE.TorusGeometry(0.3, 0.06, 4, 10), steelL, 0.68, GY, 1.65, torso, false, [0, PI / 2, 0]);
    c.muzzle.position.set(0, GY, 4.25);
    torso.add(c.muzzle);
    c.height = 4.3;
  },

  // U23 chunk C: Emperor Calus (original design). A vast, rotund Loyalist ruler: a huge belly and chest under a scale-row gold breastplate, a gold belt
  // and round buckle, a purple sash and a long purple robe down the back, short thick legs with gold knee caps and crimson shin bands, a small head
  // sunk into the shoulders (jowls, flat face, a purple brow gem: the weak point) framed by a tall gold crescent collar with spike finials, a left arm
  // hanging and a right arm raised with a gold goblet (c.gobletArm / c.goblet; psychic orbs fly from the bowl at c.muzzle). Built 4.6 m tall (the def scales it 0.8).
  emperorCalus(c) {
    const { B, bodyMat } = c;
    const gold = mat(0xd9a93c, { metalness: 0.7, roughness: 0.35 });
    const goldD = mat(0x9a7424, { metalness: 0.6, roughness: 0.4 });
    const skin = mat(0xcdb7ae, { roughness: 0.6 }), skinD = mat(0xb39a94, { roughness: 0.65 });
    const purple = mat(0x4a1f6e), purpleD = mat(0x35154f);
    const crimson = mat(0x8a1a2a);
    const dark = mat(0x120a14);
    const gem = mat(0xb06cff, { emissive: 0x8a3cff, emissiveIntensity: 2.4 });
    bodyMat.color.setHex(0xcdb7ae);
    // short thick legs: purple breeches, gold knee caps, crimson shin bands, wide gold boots
    legs(c, 1.0, 0.5, 0.62, purpleD, goldD);
    for (const k of c.legs) {
      B(0.7, 0.36, 0.4, 0, -0.5, 0.36, gold, k);
      B(0.72, 0.3, 0.72, 0, -0.78, 0, crimson, k);
      B(0.95, 0.2, 1.3, 0, -0.88, 0.2, goldD, k);
      B(0.8, 0.14, 0.4, 0, -0.78, 0.7, gold, k);
    }
    const torso = c.pivot(0, 1.0, 0);
    c.torso = torso;
    // surface of the two big masses (centre y, x radius, y radius, z radius, z offset), used to seat the plates and the sash
    const chestZ = (x, y) => 0.95 * Math.sqrt(Math.max(0, 1 - (x / 1.35) ** 2 - ((y - 1.45) / 0.85) ** 2));
    const bellyZ = (x, y) => 0.15 + 1.15 * Math.sqrt(Math.max(0, 1 - (x / 1.32) ** 2 - ((y - 0.5) / 1.15) ** 2));
    B(1.7, 0.5, 1.4, 0, 0.0, 0, purpleD, torso);                                       // hips
    ico(c, 1.15, 1, bodyMat, 0, 0.5, 0.15, torso).scale.set(1.15, 1, 1);                // the enormous belly (the hit flash lights it)
    ico(c, 1.0, 1, skin, 0, 1.45, 0, torso).scale.set(1.35, 0.85, 0.95);               // chest
    // gold belt ring round the belly with a big round buckle
    cyl(c, 1.2, 1.2, 0.2, 10, gold, 0, 0.5, 0.15, torso).scale.set(1.15, 1, 1);
    cyl(c, 0.38, 0.38, 0.14, 10, gold, 0, 0.5, 1.38, torso, false, [PI / 2, 0, 0]);
    ico(c, 0.16, 0, gem, 0, 0.5, 1.48, torso);
    // overlapping scale rows across the upper chest, each plate tilted to the chest surface
    for (let row = 0; row < 4; row++) {
      const y = 2.0 - row * 0.25, n = row % 2 ? 5 : 6;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 0.46, z = chestZ(x, y) + 0.04;
        B(0.5, 0.22, 0.1, x, y, z, row % 2 ? goldD : gold, torso, false, [-Math.asin(Math.max(-1, Math.min(1, (y - 1.45) / 0.85))) + 0.18, (x / 1.35) * 0.5, 0]);
      }
    }
    // purple sash from the right shoulder down across the belly, ending in a hanging panel with a gold fringe
    for (let i = 0; i < 6; i++) {
      const t = i / 5, x = 0.95 - 1.85 * t, y = 2.05 - 1.75 * t;
      B(0.5, 0.5, 0.08, x, y, Math.max(chestZ(x, y), bellyZ(x, y)) + 0.1, purple, torso, false, [0, 0, -0.85]);
    }
    B(0.7, 1.1, 0.08, -0.9, -0.15, 1.22, purple, torso, false, [0.3, 0, 0]);
    B(0.74, 0.1, 0.1, -0.9, -0.7, 1.3, gold, torso, false, [0.3, 0, 0]);
    // broad sloping shoulders with gold pauldrons
    for (const s of [-1, 1]) {
      ico(c, 0.55, 1, skin, s * 1.5, 2.0, 0, torso);
      B(1.1, 0.26, 1.2, s * 1.6, 2.28, 0, gold, torso, false, [0, 0, s * -0.3]);
      B(1.0, 0.2, 1.1, s * 1.8, 2.0, 0, goldD, torso, false, [0, 0, s * -0.45]);
      cone(c, 0.12, 0.35, 5, gold, s * 1.9, 2.5, 0, torso, false, [0, 0, s * -0.3]);
    }
    // neck
    B(0.9, 0.5, 0.8, 0, 2.3, 0.2, skinD, torso);
    // the small head sunk into the shoulders: every part is the weak point
    const head = c.pivot(0, 2.55, 0.4, torso);
    c.head = head;
    ico(c, 0.55, 1, skin, 0, 0.1, 0, head, true).scale.set(1.25, 0.95, 1.05);           // skull
    for (const s of [-1, 1]) ico(c, 0.36, 1, skinD, s * 0.5, -0.22, 0.2, head, true).scale.set(1, 0.9, 1); // heavy jowls
    ico(c, 0.38, 1, skinD, 0, -0.32, 0.25, head, true).scale.set(1.2, 0.8, 1);          // chins
    B(0.95, 0.5, 0.18, 0, 0.0, 0.52, skin, head, true);                                 // wide flat face
    B(1.1, 0.12, 0.22, 0, 0.26, 0.55, skinD, head, true);                               // heavy brow ridge
    B(0.2, 0.28, 0.16, 0, -0.05, 0.64, skinD, head, true);                              // nose
    B(0.5, 0.05, 0.06, 0, -0.3, 0.6, dark, head, true);                                 // mouth
    for (const s of [-1, 1]) {
      B(0.16, 0.07, 0.06, s * 0.28, 0.14, 0.62, dark, head, true);                      // small eyes
      B(0.1, 0.2, 0.08, s * 0.64, -0.02, 0.08, skinD, head, true);                      // ears
    }
    B(1.2, 0.09, 0.9, 0, 0.42, 0.18, goldD, head, true, [-0.2, 0, 0]);                  // circlet
    B(0.2, 0.2, 0.08, 0, 0.42, 0.64, gold, head, true, [-0.2, 0, PI / 4]);             // gem setting
    ico(c, 0.11, 0, gem, 0, 0.43, 0.7, head, true);                                     // the purple brow gem
    // the gold crescent collar: a semicircle of blades with spike finials, framing the head and rising to 4.6 m
    const collar = c.pivot(0, 2.5, -0.65, torso);
    collar.rotation.x = -0.12;
    for (let i = 0; i < 11; i++) {
      const a = (i - 5) / 5 * 1.3, len = 0.4 + 0.12 * Math.cos(a), r0 = 0.65, rc = r0 + len / 2, rt = r0 + len;
      B(0.34, len, 0.08, Math.sin(a) * rc, Math.cos(a) * rc, 0, i % 2 ? goldD : gold, collar, false, [0, 0, -a]);
      cone(c, 0.09, 0.28, 4, gold, Math.sin(a) * (rt + 0.1), Math.cos(a) * (rt + 0.1), 0, collar, false, [0, 0, -a]);
    }
    B(1.5, 0.14, 0.14, 0, 0.62, 0, goldD, collar);                                      // inner band
    for (const s of [-1, 1]) B(0.14, 0.7, 0.14, s * 0.72, 0.15, 0, goldD, collar, false, [0, 0, s * -0.25]);
    // the long purple robe down the back with a gold hem
    B(2.2, 2.7, 0.12, 0, 0.85, -1.1, purple, torso, false, [0.08, 0, 0]);
    B(2.3, 0.14, 0.2, 0, -0.5, -1.18, gold, torso, false, [0.08, 0, 0]);
    B(0.1, 2.7, 0.16, 0, 0.85, -1.08, goldD, torso, false, [0.08, 0, 0]);
    // left arm hanging: gold upper band, crimson forearm band, a big hand
    const lArm = arm(c, torso, -1.6, 2.0, 1.7, 0.6, skin, -0.15, -0.12);
    B(0.72, 0.24, 0.72, 0, -0.3, 0, gold, lArm);
    B(0.7, 0.5, 0.7, 0, -1.15, 0, crimson, lArm);
    B(0.76, 0.5, 0.6, 0, -1.9, 0, skinD, lArm);
    for (const k of [-1, 0, 1]) B(0.2, 0.3, 0.2, k * 0.24, -2.2, 0.05, skinD, lArm);
    c.arms.push(lArm);
    // right arm raised on its own pivot (not in c.arms): upper arm forward, forearm up, the goblet in the fist
    const rArm = c.pivot(1.6, 2.0, 0.1, torso);
    rArm.rotation.x = -1.3;
    c.gobletArm = rArm;
    B(0.6, 1.1, 0.6, 0, -0.55, 0, skin, rArm);
    B(0.72, 0.24, 0.72, 0, -0.2, 0, gold, rArm);
    const elbow = c.pivot(0, -1.1, 0, rArm);
    elbow.rotation.x = -1.6;
    ico(c, 0.36, 0, skin, 0, 0, 0, elbow);
    B(0.56, 0.7, 0.56, 0, -0.35, 0, skin, elbow);
    B(0.68, 0.4, 0.68, 0, -0.4, 0, crimson, elbow);
    // the goblet stays upright in the fist: a stem, a flared bowl, a gold rim and a purple gem
    const goblet = c.pivot(0, -0.75, 0, elbow);
    goblet.rotation.x = 2.9;
    c.goblet = goblet;
    B(0.55, 0.4, 0.5, 0, 0, 0, skinD, goblet);                                          // fist
    cyl(c, 0.1, 0.14, 0.7, 6, gold, 0, 0.45, 0, goblet);                                // stem
    cyl(c, 0.3, 0.3, 0.1, 8, goldD, 0, 0.12, 0, goblet);                                // foot
    cyl(c, 0.55, 0.16, 0.55, 8, gold, 0, 1.0, 0, goblet);                               // bowl
    cyl(c, 0.58, 0.58, 0.08, 8, goldD, 0, 1.3, 0, goblet);                              // rim
    ico(c, 0.1, 0, gem, 0, 1.0, 0.5, goblet);
    c.muzzle.position.set(0, 1.25, 0);
    goblet.add(c.muzzle);
    c.height = 4.6;
  },
};
