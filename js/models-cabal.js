import * as THREE from 'three';
import { mat } from './world.js';

// ---------------------------------------------------------------------------
// CABAL (U18, from Bryce's references in docs/reference/enemies/cabal-*). The Red Legion look of the references on every
// destination: silver-grey plate with red panels over a dark undersuit, red scaly skin on the forearms, pale hoof boots. The
// Loyalist Cabal (a destination marked `loyalist`, the Leviathan) swap the silver plate for gold. c.bodyMat carries the main plate
// colour (hit flashes light it). Shared parts: cabalLegs (armoured thighs, big knee guards, two-toed hoof boots), cabalArm (plated
// upper arm, scaly forearm, fist), helm (a head sunk in a high collar, one helmet style per unit), hand (a grip that moves with the arm).
// Same builder contract as the other factions: face +z, stand on y = 0, c.torso / c.legs / c.arms / c.muzzle per unit.
// The generic Cabal boss fallback stays in enemies.js (bosses are out of U18).
// ---------------------------------------------------------------------------
const PI = Math.PI;
const ico = (c, r, d, m, x, y, z, parent, crit = false, rot = null) => c.add(new THREE.IcosahedronGeometry(r, d), m, x, y, z, parent, crit, rot);
const cone = (c, r, h, m, x, y, z, parent, rot = null, crit = false, seg = 5) => c.add(new THREE.ConeGeometry(r, h, seg), m, x, y, z, parent, crit, rot);
const cyl = (c, rt, rb, h, seg, m, x, y, z, parent, rot = null, crit = false) => c.add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, parent, crit, rot);

const SILVER = 0xb4b0a8, GOLD = 0xc9a046;
// Two material sets: the Red Legion's, and the Loyalists' with royal purple in place of the red livery (Bryce, 2026-11-05). cabal() picks
// the set for the unit being built; skin and War Beast hide stay red either way.
const _sets = {};
let _loyal = false;
function cm() {
  const k = _loyal ? 'loyal' : 'red';
  if (!_sets[k]) _sets[k] = {
    red: mat(_loyal ? 0x5b2a8c : 0xa3281f), redD: mat(_loyal ? 0x3c1a5e : 0x6e1c18), under: mat(0x2a282c), underL: mat(0x3e3b40), steel: mat(0x7d7a74),
    skin: mat(0xb2432c), skinD: mat(0x5e2a22), fist: mat(0x5a3a2e), face: mat(0x231d1c), tusk: mat(0xd8cfbc),
    boot: mat(0xcfc8ba), gun: mat(0x2c2b2e), gunR: mat(_loyal ? 0x4e2478 : 0x8e2a20), gunO: mat(0xc0703a), white: mat(0xe8e4dc),
    blue: mat(0x9ec8ff, { emissive: 0x6aa8ff, emissiveIntensity: 2.6 }),
    cyan: mat(0x8ff4ff, { emissive: 0x5ae8ff, emissiveIntensity: 2.4 }),
    fire: mat(0xffa040, { emissive: 0xff7a1a, emissiveIntensity: 2.6 }),
    ember: mat(0xff6a2a, { emissive: 0xff4a10, emissiveIntensity: 2.2 }),
    bristle: mat(0xe8eef4, { emissive: 0xc8d8e8, emissiveIntensity: 0.4 }),
    scale: mat(0xc0482e), belly: mat(0x3a2622), claw: mat(0xa8a49c), harness: mat(0x2e2c2e), fin: mat(0xb0503a),
  };
  return _sets[k];
}

/** Main plate: silver for the Red Legion, gold for the Loyalists. Sets c.bodyMat to it so hit flashes light the plate. */
function plateOf(c) {
  c.bodyMat.color.setHex(c.C?.loyalist ? GOLD : SILVER);
  return c.bodyMat;
}

/** Two straight legs: dark undersuit, a plate over the thigh, a big rounded knee guard, a shin plate and a two-toed hoof boot. */
function cabalLegs(c, hipY, hipW, th, plate, shin = plate) {
  const M = cm();
  for (const sx of [-1, 1]) {
    const hip = c.pivot(sx * hipW, hipY, 0);
    const L = hipY / 2;
    c.B(th, L, th * 1.1, 0, -L * 0.5, 0, M.under, hip);
    c.B(th * 1.2, L * 0.75, th * 1.2, sx * th * 0.08, -L * 0.45, 0.02, M.redD, hip); // thigh plate
    c.B(th * 0.95, L, th, 0, -L * 1.5, 0, M.under, hip);
    c.B(th * 1.45, th * 1.15, th * 1.35, 0, -L * 1.02, th * 0.35, shin, hip, false, [0.25, 0, 0]); // knee guard
    c.B(th * 1.2, L * 0.6, th * 1.25, 0, -L * 1.5, 0.03, shin, hip); // shin plate
    c.B(th * 1.5, 0.15, th * 2.0, 0, -hipY + 0.075, th * 0.35, M.boot, hip); // hoof boot
    c.B(0.03, 0.14, th * 0.9, 0, -hipY + 0.07, th * 1.0, M.under, hip); // split toe
    c.B(th * 1.3, 0.1, th * 1.2, 0, -hipY + 0.2, 0, M.boot, hip); // ankle cuff
    c.legs.push(hip);
  }
}

/** One arm on `parent` with a real elbow: a plated upper arm swung `out` away from the body (elbow out), then a red scaly forearm under
 *  a bracer bent `bend` back toward the middle, a fist; `tw` swings the arm in across the body. Pivot at the shoulder (the attack poses
 *  turn it); the side comes from `x`. `bare` leaves the upper arm scaly too (Gladiator). Two-handed poses are solved offline so the left
 *  fist lands on the foregrip of a gun pointing straight ahead. */
function cabalArm(c, parent, x, y, len, th, lift, plate, out = 0.5, bend = 0.9, bare = false, tw = 0) {
  const M = cm(), sx = Math.sign(x) || 1;
  const p = c.pivot(x, y, 0, parent);
  c.B(th * 1.1, len * 0.5, th * 1.1, 0, -len * 0.25, 0, bare ? M.skin : M.under, p);
  const e = c.pivot(0, -len * 0.5, 0, p);
  ico(c, th * 0.75, 0, bare ? M.skin : M.under, 0, 0, 0, e); // elbow
  c.B(th * 1.25, len * 0.5, th * 1.25, 0, -len * 0.25, 0, M.skin, e); // scaly forearm
  c.B(th * 1.35, len * 0.22, th * 1.35, 0, -len * 0.14, 0, bare ? M.under : plate, e); // bracer
  c.B(th * 1.25, th * 1.05, th * 1.3, 0, -len * 0.5 - 0.03, 0.01, M.fist, e);
  p.rotation.set(lift, sx * tw, sx * out); // Rx(lift) Ry(twist) Rz(out)
  e.rotation.z = -sx * bend;
  Object.assign(p.userData, { elbow: e, len, zr: sx * (out - bend), ty: sx * tw });
  return p;
}

/** A grip in the fist of arm `a` (built with lift `lift`), turned back to face the torso's forward whatever the shoulder and elbow
 *  angles, so a weapon parented to it points ahead from the fist and moves with the arm. */
function hand(c, a, lift) {
  const { elbow, len, zr, ty } = a.userData;
  const g = c.pivot(0, -len * 0.5 - 0.05, 0, elbow);
  g.rotation.order = 'ZYX';
  g.rotation.set(-lift, -ty, -zr);
  return g;
}

/** A gun held in both hands: a grip in the right fist of arm `r`, and in it a pivot `g` whose +z runs from the right fist to just under
 *  the left fist of arm `l` (`drop` below it), so a gun built along +z rests in both hands and moves with the right arm. `d` is the
 *  distance to the left hand: put the foregrip there. The arm poses are solved offline for the hold wanted (shouldered rifles: raised
 *  near eye level, a little across the body, both elbows hanging low; the Colossus: low across the hips). */
function bothHands(c, r, l, lift, drop) {
  const grip = hand(c, r, lift);
  c.g.updateMatrixWorld(true);
  const lf = grip.worldToLocal(l.userData.elbow.localToWorld(new THREE.Vector3(0, -l.userData.len * 0.5 - 0.05, 0)));
  lf.y -= drop;
  if (lf.z <= 0.05) throw new Error('bothHands: the left hand is not ahead of the right one');
  const g = c.pivot(0, 0, 0, grip);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), lf.clone().normalize());
  return { g, d: lf.length() };
}

/** A Cabal head on `parent` at (0, y, z): a dark tusked face sunk in a high collar, under one helmet style (all crit unless `noCrit`).
 *  'legion' red dome, white mask and crest; 'colossus' white dome with red bands; 'centurion' a tall pointed shield faceplate;
 *  'gladiator' a hammerhead visor; 'incendior' a round red helmet over a grilled mask; 'psion' a narrow mask with two glowing horns;
 *  'phalanx' a white dome with a red-tipped horn. */
function helm(c, parent, y, z, s, kind, plate, noCrit = false) {
  const M = cm(), k = !noCrit;
  cyl(c, 0.2 * s, 0.24 * s, 0.14 * s, 8, M.under, 0, y - 0.1 * s, z - 0.04 * s, parent); // collar
  const h = c.pivot(0, y, z, parent);
  ico(c, 0.13 * s, 1, M.face, 0, -0.01 * s, -0.02 * s, h, k).scale.set(1, 1.05, 1.0);
  for (const sx of [-1, 1]) cone(c, 0.015 * s, 0.06 * s, M.tusk, sx * 0.04 * s, -0.09 * s, 0.13 * s, h, [PI, 0, 0], k, 4);
  if (kind === 'legion') {
    ico(c, 0.15 * s, 1, M.red, 0, 0.05 * s, -0.03 * s, h, k).scale.set(1, 0.9, 1.15);
    c.B(0.15 * s, 0.17 * s, 0.05 * s, 0, 0.02 * s, 0.13 * s, plate, h, k); // mask
    c.B(0.035 * s, 0.17 * s, 0.02 * s, 0, 0.03 * s, 0.16 * s, M.red, h, k);
    for (const sx of [-1, 1]) c.B(0.04 * s, 0.025 * s, 0.02 * s, sx * 0.045 * s, 0.04 * s, 0.16 * s, c.accent, h, k); // eye slits
    c.B(0.035 * s, 0.14 * s, 0.24 * s, 0, 0.2 * s, -0.01 * s, plate, h, k, [-0.15, 0, 0]); // crest fin
  } else if (kind === 'colossus') {
    ico(c, 0.16 * s, 1, M.white, 0, 0.05 * s, -0.02 * s, h, k).scale.set(1, 0.95, 1.15);
    for (const sx of [-1, 1]) c.B(0.04 * s, 0.2 * s, 0.3 * s, sx * 0.07 * s, 0.07 * s, 0.0, M.red, h, k, [0, 0, sx * -0.25]);
    c.B(0.16 * s, 0.06 * s, 0.05 * s, 0, -0.04 * s, 0.14 * s, M.white, h, k); // jaw guard
    c.B(0.1 * s, 0.025 * s, 0.02 * s, 0, 0.03 * s, 0.16 * s, c.accent, h, k);
  } else if (kind === 'centurion') {
    ico(c, 0.15 * s, 1, plate, 0, 0.04 * s, -0.04 * s, h, k).scale.set(1, 0.95, 1.1);
    c.B(0.2 * s, 0.32 * s, 0.05 * s, 0, 0.1 * s, 0.13 * s, M.white, h, k, [-0.12, 0, 0]); // shield faceplate
    cone(c, 0.1 * s, 0.12 * s, M.white, 0, -0.1 * s, 0.14 * s, h, [PI, PI / 4, 0], k, 4); // pointed chin
    for (const sx of [-1, 1]) c.B(0.05 * s, 0.1 * s, 0.04 * s, sx * 0.07 * s, 0.3 * s, 0.1 * s, M.white, h, k, [-0.2, 0, sx * -0.15]); // top prongs
    c.B(0.03 * s, 0.24 * s, 0.02 * s, 0, 0.08 * s, 0.165 * s, M.red, h, k, [-0.12, 0, 0]);
  } else if (kind === 'gladiator') {
    ico(c, 0.14 * s, 1, plate, 0, 0.03 * s, -0.03 * s, h, k);
    c.B(0.46 * s, 0.09 * s, 0.2 * s, 0, 0.14 * s, 0.04 * s, M.white, h, k); // hammerhead bar
    for (const sx of [-1, 1]) cone(c, 0.05 * s, 0.12 * s, M.white, sx * 0.25 * s, 0.14 * s, 0.04 * s, h, [0, 0, sx * -PI / 2], k, 4);
    c.B(0.12 * s, 0.2 * s, 0.05 * s, 0, 0.0, 0.14 * s, M.white, h, k); // faceplate
    c.B(0.08 * s, 0.025 * s, 0.02 * s, 0, 0.04 * s, 0.17 * s, c.accent, h, k);
  } else if (kind === 'incendior') {
    ico(c, 0.16 * s, 1, M.red, 0, 0.04 * s, -0.01 * s, h, k).scale.set(1, 1, 1.15);
    c.B(0.16 * s, 0.14 * s, 0.06 * s, 0, -0.02 * s, 0.14 * s, M.under, h, k); // grilled mask
    for (let i = 0; i < 3; i++) c.B(0.12 * s, 0.015 * s, 0.02 * s, 0, -0.06 * s + i * 0.035 * s, 0.175 * s, M.steel, h, k);
    for (const sx of [-1, 1]) c.B(0.02 * s, 0.2 * s, 0.26 * s, sx * 0.06 * s, 0.1 * s, 0.0, M.white, h, k, [0.1, 0, 0]); // white piping
  } else if (kind === 'psion') {
    ico(c, 0.11 * s, 1, M.underL, 0, 0.04 * s, -0.02 * s, h, k).scale.set(1, 1.2, 1.1);
    c.B(0.09 * s, 0.26 * s, 0.05 * s, 0, 0.0, 0.11 * s, M.white, h, k); // narrow mask
    c.B(0.015 * s, 0.14 * s, 0.02 * s, 0, -0.03 * s, 0.14 * s, M.face, h, k);
    c.B(0.03 * s, 0.03 * s, 0.02 * s, 0, 0.09 * s, 0.14 * s, M.ember, h, k);
    for (const sx of [-1, 1]) {
      c.B(0.03 * s, 0.26 * s, 0.05 * s, sx * 0.07 * s, 0.2 * s, -0.01 * s, M.white, h, k, [0, 0, sx * -0.2]); // horn frame
      c.B(0.018 * s, 0.22 * s, 0.03 * s, sx * 0.06 * s, 0.21 * s, 0.02 * s, M.ember, h, k, [0, 0, sx * -0.2]); // glowing horn
    }
  } else if (kind === 'phalanx') {
    ico(c, 0.16 * s, 1, plate, 0, 0.05 * s, -0.02 * s, h, k).scale.set(1, 0.95, 1.2);
    c.B(0.15 * s, 0.07 * s, 0.06 * s, 0, -0.06 * s, 0.13 * s, plate, h, k); // jaw guard
    cone(c, 0.06 * s, 0.26 * s, plate, 0, 0.22 * s, 0.08 * s, h, [-0.35, 0, 0], k, 5); // horn
    cone(c, 0.025 * s, 0.07 * s, M.red, 0, 0.36 * s, 0.03 * s, h, [-0.35, 0, 0], k, 5);
    c.B(0.1 * s, 0.025 * s, 0.02 * s, 0, 0.03 * s, 0.17 * s, c.accent, h, k);
  } else throw new Error(`No Cabal helmet ${kind}`);
  return h;
}

/** A round pauldron on the torso at side `sx`: a plate dome with a red band. */
function pauldron(c, torso, sx, x, y, r, plate, band = true) {
  const M = cm();
  ico(c, r, 1, plate, sx * x, y, 0, torso, false, [0, 0, sx * -0.3]).scale.set(1.0, 0.8, 1.1);
  if (band) c.B(r * 0.5, r * 0.18, r * 2.1, sx * (x + r * 0.35), y + r * 0.45, 0, M.red, torso, false, [0, 0, sx * -0.6]);
}

/** Tasset plates round the waist and a hanging front tabard (red with a plate emblem unless `plain`). */
function skirt(c, torso, w, plate, tabard = 0.5, plain = false) {
  const M = cm();
  for (const sx of [-1, 1]) c.B(w * 0.36, 0.3, 0.32, sx * w * 0.36, -0.08, 0.02, plate, torso, false, [0, 0, sx * 0.18]);
  c.B(w * 0.32, tabard, 0.03, 0, -tabard / 2 + 0.05, 0.2, plain ? M.under : M.red, torso, false, [-0.06, 0, 0]);
  if (!plain) {
    c.B(w * 0.2, 0.03, 0.02, 0, -tabard * 0.35, 0.225, plate, torso, false, [-0.06, 0, 0]);
    for (const sx of [-1, 1]) c.B(0.03, tabard * 0.22, 0.02, sx * w * 0.08, -tabard * 0.45, 0.225, plate, torso, false, [-0.06, 0, 0]);
  }
}

/** Legionary: the line soldier. Silver chest and pauldrons striped red, a red domed helmet with a white mask and crest, a small
 *  jet pack, a slug rifle with a blue lens held at the hip. Loyalists add four tall fins on the back (cabal-legionary-loyalist-1). */
function legionary(c) {
  const M = cm(), plate = plateOf(c);
  cabalLegs(c, 0.85, 0.16, 0.15, plate);
  const torso = c.pivot(0, 0.85, 0);
  torso.rotation.x = 0.03;
  c.torso = torso;
  c.B(0.4, 0.26, 0.3, 0, 0.13, 0, M.under, torso);
  c.B(0.58, 0.44, 0.42, 0, 0.5, 0, plate, torso);
  c.B(0.5, 0.06, 0.06, 0, 0.56, 0.21, M.red, torso); // chest stripe
  c.B(0.3, 0.14, 0.04, 0, 0.36, 0.21, M.redD, torso);
  pauldron(c, torso, -1, 0.34, 0.68, 0.17, plate);
  pauldron(c, torso, 1, 0.34, 0.68, 0.17, plate, false);
  skirt(c, torso, 0.5, plate, 0.42);
  // small jet pack
  for (const sx of [-1, 1]) cyl(c, 0.08, 0.1, 0.36, 8, M.steel, sx * 0.13, 0.5, -0.28, torso);
  if (c.C?.loyalist) for (let i = 0; i < 4; i++) c.B(0.05, 0.5, 0.12, -0.24 + i * 0.16, 1.0, -0.3, plate, torso, false, [-0.15, 0, (i - 1.5) * -0.08]);
  helm(c, torso, 0.86, 0.06, 1.0, 'legion', plate);
  const l = cabalArm(c, torso, -0.34, 0.6, 0.7, 0.1, -0.5, plate, -0.6, 1.0, false, 1.0);
  const r = cabalArm(c, torso, 0.34, 0.6, 0.7, 0.1, -0.3, plate, 0.1, 2.3, false, 0.9);
  c.arms.push(l, r);
  // slug rifle in both hands: a red body, dark receiver, a foregrip under the left fist, a squat front housing with a blue lens
  const { g, d } = bothHands(c, r, l, -0.3, 0.06); // shouldered: raised near eye level, a little across the body
  c.B(0.08, 0.12, 0.26, 0, 0.02, -0.16, M.gunR, g); // stock back to the shoulder
  c.B(0.1, 0.13, d + 0.17, 0, 0.04, (d - 0.07) / 2, M.gunR, g);
  c.B(0.12, 0.08, 0.3, 0, 0.13, 0.0, M.gun, g);
  c.B(0.06, 0.12, 0.06, 0, -0.04, d, M.gun, g); // foregrip
  c.B(0.07, 0.14, 0.07, 0, -0.06, -0.02, M.gun, g); // grip
  c.B(0.16, 0.18, 0.16, 0, 0.06, d + 0.13, M.gun, g);
  c.B(0.08, 0.08, 0.03, 0, 0.06, d + 0.225, M.blue, g);
  c.muzzle.position.set(0, 0.06, d + 0.26); g.add(c.muzzle);
  c.height = 1.85;
}

/** War Beast: a red-scaled quadruped hound, dark below, a pointed silver helmet over the head and a fanged jaw, a harness of dark
 *  tubes with red fins swept back, silver claws, a spiked tail. */
function warBeast(c) {
  const M = cm(), plate = plateOf(c);
  plate.color.setHex(0xc0482e); // the hit flash lights the scales
  const body = c.pivot(0, 0.66, 0);
  c.torso = body;
  c.B(0.5, 0.42, 1.0, 0, 0.02, 0, plate, body);
  c.B(0.42, 0.14, 0.9, 0, -0.18, 0.02, M.belly, body);
  ico(c, 0.3, 1, plate, 0, 0.12, 0.3, body).scale.set(1.0, 0.85, 1.0); // shoulders
  for (let i = 0; i < 6; i++) cone(c, 0.05, 0.16, plate, 0, 0.26 - i * 0.015, -0.1 - i * 0.14, body, [-0.6, 0, 0], false, 4); // back scales
  // tail
  c.B(0.14, 0.12, 0.5, 0, 0.0, -0.68, plate, body, false, [0.25, 0, 0]);
  cone(c, 0.06, 0.3, plate, 0, -0.08, -1.02, body, [-PI / 2 - 0.25, 0, 0], false, 4);
  // head: neck, fanged jaw, pointed silver helmet; head and eyes are the precision spots
  const head = c.pivot(0, 0.06, 0.58, body);
  head.rotation.x = 0.25;
  c.B(0.26, 0.24, 0.3, 0, 0, 0.06, plate, head, true);
  c.B(0.24, 0.08, 0.28, 0, -0.14, 0.12, M.belly, head, true); // lower jaw
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) cone(c, 0.015, 0.06, M.tusk, sx * (0.03 + i * 0.025), -0.08, 0.24 - i * 0.04, head, [PI, 0, 0], true, 3);
  c.B(0.3, 0.16, 0.34, 0, 0.1, 0.08, M.steel, head, true); // helmet
  cone(c, 0.14, 0.26, M.claw, 0, 0.08, 0.34, head, [PI / 2, PI / 4, 0], true, 4); // helmet point
  for (const sx of [-1, 1]) {
    c.B(0.03, 0.18, 0.16, sx * 0.15, -0.04, 0.12, M.steel, head, true); // cheek plate
    c.B(0.03, 0.03, 0.02, sx * 0.1, 0.0, 0.22, M.ember, head, true); // eye
  }
  // harness: dark tubes down the neck to a pack, red fins swept back
  for (const sx of [-1, 1]) c.B(0.06, 0.06, 0.6, sx * 0.1, 0.3, 0.22, M.harness, body, false, [0.35, 0, 0]);
  c.B(0.36, 0.12, 0.34, 0, 0.3, -0.02, M.harness, body);
  for (let i = 0; i < 4; i++) c.B(0.02, 0.06, 0.5 - i * 0.05, (i % 2 ? 1 : -1) * 0.06 * (1 + (i >> 1)), 0.42 + i * 0.04, -0.2, M.fin, body, false, [0.55 + i * 0.08, 0, 0]);
  // legs: thick upper, scaly lower, three silver claws
  for (const [x, z] of [[-0.22, 0.34], [0.22, 0.34], [0.22, -0.34], [-0.22, -0.34]]) {
    const hip = c.pivot(x, 0.62, z);
    c.B(0.16, 0.34, 0.2, 0, -0.17, 0.02, plate, hip);
    c.B(0.11, 0.3, 0.12, 0, -0.44, -0.02, M.skinD, hip);
    for (let k = -1; k <= 1; k++) cone(c, 0.02, 0.1, M.claw, k * 0.04, -0.6, 0.08, hip, [PI / 2, 0, 0], false, 4);
    c.legs.push(hip);
  }
  c.muzzle.position.set(0, 0.66, 0.95); c.g.add(c.muzzle);
  c.height = 1.2;
}

/** Centurion (after cabal-centurion-1): the officer. Broad and red with a silver chest, a white domed helmet, a horseshoe crown frame
 *  behind the head with two white bristle fans, exhaust stacks on the shoulders, a red tabard, jet thrusters on the back (flames hidden
 *  until lift-off, U13b), a five-barrel slug cannon with blue bores on the right fist, pointing ahead; the left hand is free. */
function centurion(c) {
  const M = cm(), plate = plateOf(c);
  const red = M.red;
  cabalLegs(c, 0.78, 0.3, 0.26, plate, red);
  const torso = c.pivot(0, 0.78, 0);
  torso.rotation.x = 0;
  c.torso = torso;
  c.B(0.8, 0.3, 0.52, 0, 0.14, 0, M.under, torso);
  c.B(1.0, 0.66, 0.64, 0, 0.62, 0, red, torso);
  c.B(0.56, 0.5, 0.06, 0, 0.6, 0.33, plate, torso); // silver chest
  skirt(c, torso, 0.86, plate, 0.6);
  for (const sx of [-1, 1]) {
    ico(c, 0.3, 1, red, sx * 0.66, 0.92, 0, torso, false, [0, 0, sx * -0.2]).scale.set(1.0, 0.85, 1.15);
    for (let i = 0; i < 3; i++) cyl(c, 0.025, 0.03, 0.22, 5, M.under, sx * (0.52 + i * 0.12), 1.16 - i * 0.03, -0.12 + i * 0.05, torso);
  }
  // crown frame and bristle fans behind the head
  const crown = c.pivot(0, 1.12, -0.2, torso);
  for (const sx of [-1, 1]) {
    c.B(0.09, 0.5, 0.12, sx * 0.24, 0.12, 0, M.underL, crown, false, [0, 0, sx * -0.25]);
    c.B(0.09, 0.14, 0.12, sx * 0.17, 0.4, 0, M.underL, crown, false, [0, 0, sx * 0.6]);
    for (let i = 0; i < 6; i++) cone(c, 0.025, 0.24, M.bristle, sx * (0.32 + Math.sin(i * 0.45) * 0.06), 0.0 + i * 0.08, -0.02, crown, [0, 0, sx * (-0.9 - i * 0.12)], false, 3);
  }
  helm(c, torso, 1.0, 0.12, 1.1, 'colossus', plate);
  for (const sx of [-1, 1]) {
    cyl(c, 0.1, 0.12, 0.4, 8, M.steel, sx * 0.2, 0.5, -0.36, torso);
    cyl(c, 0.07, 0.07, 0.04, 8, c.accent, sx * 0.2, 0.28, -0.36, torso);
    const fl = cone(c, 0.09, 0.55, M.fire, sx * 0.2, 0.0, -0.36, torso, [PI, 0, 0], false, 6);
    fl.visible = false;
    (c.flames ||= []).push(fl);
  }
  const off = cabalArm(c, torso, -0.68, 0.82, 0.62, 0.2, -0.45, red, 0.3, 0.15);
  const gun = cabalArm(c, torso, 0.68, 0.82, 0.62, 0.22, -1.45, red, 0.3, 0.3);
  c.arms.push(off, gun);
  // slug cannon over the right fist, pointing ahead: a grey block, five white barrels in a row with blue bores
  const g = hand(c, gun, -1.45);
  c.B(0.5, 0.26, 0.5, 0, 0.06, 0.12, M.steel, g);
  c.B(0.44, 0.1, 0.34, 0, 0.23, 0.04, M.gun, g);
  for (let i = 0; i < 5; i++) {
    const bx = (i - 2) * 0.09;
    cyl(c, 0.04, 0.04, 0.32, 7, M.white, bx, 0.0, 0.5, g, [PI / 2, 0, 0]);
    cyl(c, 0.028, 0.028, 0.02, 7, M.blue, bx, 0.0, 0.66, g, [PI / 2, 0, 0]);
  }
  c.muzzle.position.set(0, 0.0, 0.7); g.add(c.muzzle);
  c.height = 2.15;
}
/** Colossus (after cabal-colossus-1 and -2): the heavy. Plate with red, a pointed shield faceplate, broad vented pauldrons striped red,
 *  a red tabard, a rack of rocket tubes on the back over two fuel cans, a long slug thrower held low across the body in both hands
 *  (rear at the right hip, barrel forward and to the left), angled down until it fires. It plants its feet and raises the gun to fire (FACTION_PROFILES.legion.plant in tiers.js, `aimLift`). */
function colossus(c) {
  const M = cm(), plate = plateOf(c);
  cabalLegs(c, 1.0, 0.18, 0.17, plate);
  const torso = c.pivot(0, 1.0, 0);
  torso.rotation.x = 0.1;
  c.torso = torso;
  c.B(0.44, 0.28, 0.32, 0, 0.14, 0, M.under, torso);
  c.B(0.64, 0.56, 0.44, 0, 0.56, 0, plate, torso);
  c.B(0.36, 0.3, 0.05, 0, 0.56, 0.23, M.red, torso); // chest shield
  c.B(0.26, 0.04, 0.03, 0, 0.64, 0.26, plate, torso);
  c.B(0.04, 0.2, 0.03, -0.11, 0.53, 0.26, plate, torso);
  skirt(c, torso, 0.58, plate, 0.62);
  for (const sx of [-1, 1]) {
    c.B(0.36, 0.3, 0.52, sx * 0.46, 0.84, 0, plate, torso, false, [0, 0, sx * -0.18]); // broad pauldron
    c.B(0.1, 0.32, 0.54, sx * 0.48, 0.86, 0, M.red, torso, false, [0, 0, sx * -0.18]);
    for (const dz of [-0.12, 0.12]) c.B(0.04, 0.08, 0.08, sx * 0.64, 0.82, dz, M.under, torso, false, [0, 0, sx * -0.18]); // vents
  }
  // mortar tubes on the back, two per side, angled up and out
  for (const sx of [-1, 1]) for (const k of [0, 1]) {
    cyl(c, 0.07, 0.08, 0.6, 7, plate, sx * (0.14 + k * 0.14), 1.05 + k * 0.04, -0.32 - k * 0.04, torso, [-0.35, 0, sx * (-0.15 - k * 0.2)]);
    cyl(c, 0.05, 0.05, 0.04, 7, M.under, sx * (0.16 + k * 0.2), 1.33 + k * 0.04, -0.42 - k * 0.04, torso, [-0.35, 0, sx * (-0.15 - k * 0.2)]);
  }
  for (const sx of [-1, 1]) cyl(c, 0.1, 0.12, 0.42, 8, M.steel, sx * 0.15, 0.45, -0.32, torso); // fuel cans
  helm(c, torso, 0.98, 0.06, 1.15, 'centurion', plate);
  const l = cabalArm(c, torso, -0.44, 0.72, 0.8, 0.12, -0.6, plate, -0.3, 0.3, false, 0.0);
  const r = cabalArm(c, torso, 0.44, 0.72, 0.8, 0.12, -0.4, plate, 0.5, 1.5, false, -0.7);
  c.arms.push(l, r);
  c.aimLift = -0.28; // both arms come up this much while it stands and fires (enemies.js closeMeleeStep), lifting the gun
  // slug thrower (after cabal-colossus-1 and -2) held low across the body: the right fist on the rear grip at the hip, the barrel running
  // forward and across to the left under the left hand on its top handle, angled down; a long dark boxy body with a gold rail, a big
  // block at the rear, twin barrels, a feed hose to the back
  const { g, d } = bothHands(c, r, l, -0.4, 0.1);
  c.B(0.07, 0.16, 0.08, 0, -0.08, 0, M.gun, g); // rear grip
  c.B(0.22, 0.18, d + 0.5, 0, 0.0, (d + 0.2) / 2, M.gun, g); // body
  c.B(0.12, 0.05, d + 0.3, 0, 0.11, (d + 0.2) / 2, M.gunO, g); // rail
  c.B(0.05, 0.06, 0.16, 0, 0.1, d, M.steel, g); // top handle under the left hand
  c.B(0.24, 0.24, 0.34, -0.02, -0.14, -0.06, M.gunO, g); // rear block
  c.B(0.2, 0.04, 0.28, -0.02, -0.02, -0.06, M.gun, g);
  for (const bx of [-0.05, 0.05]) {
    cyl(c, 0.045, 0.045, 0.5, 7, M.gun, bx, 0.03, d + 0.6, g, [PI / 2, 0, 0]);
    cyl(c, 0.05, 0.05, 0.04, 7, M.gunO, bx, 0.03, d + 0.86, g, [PI / 2, 0, 0]);
  }
  c.B(0.05, 0.05, 0.5, 0.06, 0.0, -0.3, M.under, g, false, [0.3, 0, 0]); // feed hose
  c.muzzle.position.set(0, 0.03, d + 0.9); g.add(c.muzzle);
  c.height = 2.35;
}


/** Incendior: grey plate with red, a round red helmet over a grilled mask (crit-proof), two fuel tanks with domed tops on the back
 *  (the precision spots; they burst when it dies), a flamethrower with a glowing nozzle and a fuel hose. */
function incendior(c) {
  const M = cm(), plate = plateOf(c);
  if (!c.C?.loyalist) plate.color.setHex(0x8e8a84);
  cabalLegs(c, 0.9, 0.22, 0.2, plate, M.redD);
  const torso = c.pivot(0, 0.9, 0);
  torso.rotation.x = 0.06;
  c.torso = torso;
  c.B(0.5, 0.28, 0.34, 0, 0.14, 0, M.under, torso);
  c.B(0.76, 0.54, 0.5, 0, 0.54, 0, plate, torso);
  c.B(0.5, 0.14, 0.06, 0, 0.66, 0.25, M.redD, torso); // red collar plate
  skirt(c, torso, 0.68, plate, 0.4);
  for (const sx of [-1, 1]) pauldron(c, torso, sx, 0.42, 0.74, 0.2, plate, sx < 0);
  // twin tanks: precision spots
  for (const sx of [-1, 1]) {
    cyl(c, 0.17, 0.17, 0.6, 10, M.white, sx * 0.2, 0.62, -0.42, torso, null, true);
    ico(c, 0.17, 1, M.white, sx * 0.2, 0.92, -0.42, torso, true).scale.set(1, 0.6, 1);
    c.B(0.05, 0.03, 0.18, sx * 0.2, 1.03, -0.42, M.gunO, torso);
  }
  c.B(0.18, 0.22, 0.06, 0.38, 0.6, -0.42, M.ember, torso); // tank gauge
  helm(c, torso, 0.94, 0.08, 1.15, 'incendior', plate, true);
  const l = cabalArm(c, torso, -0.46, 0.68, 0.78, 0.13, -0.3, plate, -0.8, 0.9, false, 0.9);
  const r = cabalArm(c, torso, 0.46, 0.68, 0.78, 0.13, 0.0, plate, -0.2, 2.2, false, 0.8);
  c.arms.push(l, r);
  // flamethrower in both hands: a long copper body with ribbed cooling, a glowing nozzle, a hose back over the shoulder
  const { g, d } = bothHands(c, r, l, 0.0, 0.06); // shouldered: raised near eye level, a little across the body
  c.B(0.08, 0.12, 0.24, 0, 0.02, -0.15, M.gun, g); // stock
  c.B(0.12, 0.14, d + 0.3, 0, 0.06, (d + 0.1) / 2, M.gunO, g);
  for (let i = 0; i < 3; i++) c.B(0.14, 0.03, 0.04, 0, 0.14, 0.05 + i * 0.1, M.gun, g);
  c.B(0.06, 0.12, 0.06, 0, -0.05, d, M.gun, g); // foregrip
  cyl(c, 0.05, 0.07, 0.16, 6, M.gun, 0, 0.06, d + 0.28, g, [PI / 2, 0, 0]);
  cone(c, 0.03, 0.18, M.fire, 0, 0.06, d + 0.44, g, [PI / 2, 0, 0], false, 5);
  c.B(0.05, 0.05, 0.6, 0, 0.32, -0.12, M.under, g, false, [-0.9, 0, 0]); // hose
  c.muzzle.position.set(0, 0.06, d + 0.46); g.add(c.muzzle);
  c.height = 2.2;
}

/** Gladiator: melee brute, grey plate over red scaly arms and legs, a hammerhead helmet, a long three-fingered tabard, two large
 *  serrated cleavers with glowing orange edges held upright like knives, one in each fist. */
function gladiator(c) {
  const M = cm(), plate = plateOf(c);
  if (!c.C?.loyalist) plate.color.setHex(0x86837e);
  cabalLegs(c, 0.95, 0.28, 0.2, plate, plate);
  for (const hip of c.legs) c.B(0.21, 0.34, 0.2, 0, -0.26, 0.02, M.skin, hip); // scaly thigh
  const torso = c.pivot(0, 0.95, 0);
  torso.rotation.x = 0.14;
  c.torso = torso;
  c.B(0.5, 0.28, 0.34, 0, 0.14, 0, M.under, torso);
  c.B(0.84, 0.56, 0.52, 0, 0.56, 0, plate, torso);
  for (let i = 0; i < 3; i++) c.B(0.6, 0.04, 0.04, 0, 0.42 + i * 0.09, 0.27, M.white, torso); // ribbing
  c.B(0.22, 0.05, 0.03, 0, 0.72, 0.27, M.gunO, torso);
  for (const sx of [-1, 1]) c.B(0.38, 0.32, 0.5, sx * 0.54, 0.84, 0, plate, torso, false, [0, 0, sx * -0.2]); // slab shoulders
  // long tabard ending in three fingers
  c.B(0.3, 0.6, 0.03, 0, -0.22, 0.24, plate, torso, false, [-0.3, 0, 0]);
  for (let i = -1; i <= 1; i++) c.B(0.07, 0.3, 0.03, i * 0.1, -0.64, 0.36, plate, torso, false, [-0.3, 0, 0]);
  c.B(0.14, 0.03, 0.02, 0, -0.1, 0.26, M.red, torso, false, [-0.3, 0, 0]);
  for (const sx of [-1, 1]) c.B(0.28, 0.32, 0.3, sx * 0.34, -0.08, 0.02, plate, torso, false, [0, 0, sx * 0.2]);
  helm(c, torso, 0.98, 0.12, 1.2, 'gladiator', plate);
  const l = cabalArm(c, torso, -0.56, 0.78, 0.7, 0.15, -0.5, plate, 0.35, 0.9, true);
  const r = cabalArm(c, torso, 0.56, 0.78, 0.7, 0.15, -0.5, plate, 0.35, 0.9, true);
  c.arms.push(l, r);
  // cleavers (after cabal-gladiator-2), held like knives: fists low in front, a broad dark blade about a metre long rising upright from
  // each fist with its glowing serrated edge facing ahead, glowing slots through the blade, a hooked tip, a steel spine, a short pommel
  for (const a of [l, r]) {
    const g = hand(c, a, -0.5);
    c.B(0.08, 0.26, 0.08, 0, -0.02, 0, M.gun, g); // haft
    c.B(0.06, 0.06, 0.06, 0, -0.17, 0, M.steel, g); // pommel
    c.B(0.12, 0.06, 0.26, 0, 0.12, 0.04, M.steel, g); // guard
    const bl = c.pivot(0, 0.12, 0.04, g);
    bl.rotation.x = 0.15; // tipped a little forward
    c.B(0.05, 1.0, 0.32, 0, 0.55, 0.06, M.gun, bl); // blade
    c.B(0.06, 0.92, 0.05, 0, 0.55, -0.11, M.steel, bl); // spine
    c.B(0.055, 0.94, 0.05, 0, 0.58, 0.23, M.ember, bl); // edge
    for (let i = 0; i < 5; i++) {
      c.B(0.065, 0.03, 0.14, 0, 0.22 + i * 0.16, 0.08, M.ember, bl); // slots
      cone(c, 0.035, 0.1, M.ember, 0, 0.18 + i * 0.18, 0.27, bl, [PI / 2 - 0.5, 0, 0], false, 3); // teeth
    }
    c.B(0.05, 0.2, 0.22, 0, 1.08, 0.14, M.gun, bl, false, [0.6, 0, 0]); // hooked tip
    c.B(0.055, 0.16, 0.04, 0, 1.12, 0.26, M.ember, bl, false, [0.6, 0, 0]);
  }
  c.muzzle.position.set(0, 0.6, 0.4); torso.add(c.muzzle);
  c.height = 2.45;
}

/** Psion: small and slender psychic, dark suit with red thigh and forearm plates, a white and plate chest, a narrow white mask with
 *  two glowing horns, long thin arms, a long sniper rifle in the right hand. */
function psion(c) {
  const M = cm(), plate = plateOf(c);
  cabalLegs(c, 0.82, 0.12, 0.09, plate, M.white);
  for (const hip of c.legs) c.B(0.04, 0.3, 0.03, 0, -0.55, 0.07, M.ember, hip); // glowing shin seam
  const torso = c.pivot(0, 0.82, 0);
  torso.rotation.x = 0.08;
  c.torso = torso;
  c.B(0.24, 0.24, 0.18, 0, 0.12, 0, M.under, torso);
  c.B(0.32, 0.32, 0.24, 0, 0.42, 0, M.underL, torso);
  c.B(0.28, 0.22, 0.06, 0, 0.44, 0.13, plate, torso); // chest plate
  for (const sx of [-1, 1]) {
    c.B(0.14, 0.24, 0.16, sx * 0.17, -0.04, 0.03, M.red, torso, false, [0, 0, sx * 0.15]); // thigh pouches
    ico(c, 0.09, 1, M.white, sx * 0.2, 0.56, 0, torso);
  }
  c.B(0.14, 0.12, 0.08, 0.06, -0.02, 0.14, M.redD, torso); // belt pouch
  helm(c, torso, 0.72, 0.07, 0.95, 'psion', plate);
  const l = cabalArm(c, torso, -0.2, 0.54, 0.62, 0.06, -1.1, M.red, 0.0, 1.1, false, 1.0);
  const r = cabalArm(c, torso, 0.2, 0.54, 0.62, 0.06, -0.8, M.red, 0.5, 2.4, false, 1.0);
  c.arms.push(l, r);
  // sniper rifle in both hands: a long dark frame, a scope with a red lens, a barrel shroud
  const { g, d } = bothHands(c, r, l, -0.8, 0.05); // shouldered high, the scope near the eye
  c.B(0.06, 0.1, 0.22, 0, 0.02, -0.13, M.gun, g); // stock
  c.B(0.07, 0.1, d + 0.5, 0, 0.05, (d + 0.2) / 2, M.gun, g);
  c.B(0.05, 0.05, 0.24, 0, 0.13, 0.12, M.steel, g);
  c.B(0.03, 0.03, 0.02, 0, 0.13, 0.25, M.ember, g);
  c.B(0.05, 0.1, 0.05, 0, -0.04, -0.02, M.gun, g); // grip
  cyl(c, 0.025, 0.025, 0.3, 6, M.steel, 0, 0.04, d + 0.6, g, [PI / 2, 0, 0]);
  c.muzzle.position.set(0, 0.04, d + 0.76); g.add(c.muzzle);
  c.height = 1.6;
}

/** Phalanx: a stocky guard in plate with red, a white domed helmet with a red-tipped horn, a shield block on the left arm that projects
 *  a diamond energy panel (its hitbox is `frontGuard.box` in factions.js) round an orange core, a slug rifle in the right hand. */
function phalanx(c) {
  const M = cm(), plate = plateOf(c);
  cabalLegs(c, 0.9, 0.22, 0.19, plate, M.white);
  const torso = c.pivot(0, 0.9, 0);
  torso.rotation.x = 0.04;
  c.torso = torso;
  c.B(0.5, 0.28, 0.34, 0, 0.14, 0, M.under, torso);
  c.B(0.74, 0.54, 0.48, 0, 0.54, 0, plate, torso);
  c.B(0.5, 0.06, 0.05, 0, 0.52, 0.25, M.red, torso);
  skirt(c, torso, 0.66, plate, 0.44);
  pauldron(c, torso, -1, 0.42, 0.74, 0.2, plate);
  pauldron(c, torso, 1, 0.42, 0.74, 0.2, plate);
  helm(c, torso, 0.92, 0.08, 1.15, 'phalanx', M.white);
  const l = cabalArm(c, torso, -0.44, 0.66, 0.5, 0.13, -1.25, plate, 0.85, 1.2);
  const r = cabalArm(c, torso, 0.44, 0.66, 0.5, 0.13, -1.1, plate, 0.8, 1.05);
  c.arms.push(l, r);
  // shield (after cabal-phalanx-2): a block on the left arm, four dark chevron brackets at the corners of a diamond and a pale energy
  // panel between them, an orange core in the block's red face. Built in body space so it matches `frontGuard` in factions.js
  // (panel box x -0.4, y 1.15, z 0.62; core box at z 0.7). Shooting the core drops the panel for a while (enemy-skills.js guardStep).
  const sh = c.pivot(-0.4, 1.15, 0.62);
  sh.rotation.z = PI / 4;
  const a = 0.45;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    c.B(0.28, 0.09, 0.12, sx * (a - 0.12), sy * a, 0, M.gun, sh);
    c.B(0.09, 0.28, 0.12, sx * a, sy * (a - 0.12), 0, M.gun, sh);
    c.B(0.05, 0.05, 0.05, sx * (a - 0.06), sy * (a - 0.06), 0.07, M.gunO, sh); // stud
  }
  c.B(0.34, 0.34, 0.12, 0, 0, 0, plate, sh); // the block
  c.B(0.26, 0.26, 0.04, 0, 0, 0.07, M.red, sh);
  for (const sx of [-1, 1]) c.B(0.06, 0.18, 0.06, sx * 0.17, 0, 0.0, M.gun, sh); // emitter lugs
  const coreMat = mat(0xffa040, { emissive: 0xff7a1a, emissiveIntensity: 2.6 });
  const core = cyl(c, 0.09, 0.09, 0.05, 8, coreMat, 0, 0, 0.1, sh, [PI / 2, 0, 0]);
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  const panel = c.B(2 * a, 2 * a, 0.02, 0, 0, 0.0, panelMat, sh);
  c.guard = { panel, core, coreMat, panelMat };
  // slug rifle in the right hand
  const grip = hand(c, r, -1.1);
  c.B(0.1, 0.13, 0.5, 0, 0.04, 0.12, M.gunO, grip);
  c.B(0.16, 0.18, 0.16, 0, 0.06, 0.42, M.gun, grip);
  c.B(0.08, 0.08, 0.03, 0, 0.06, 0.505, M.blue, grip);
  c.muzzle.position.set(0, 0.06, 0.54); grip.add(c.muzzle);
  c.height = 2.2;
}

const BUILD = {
  grunt: legionary, rusher: warBeast, captain: centurion, heavy: colossus,
  lg_incendior: incendior, lg_gladiator: gladiator, lg_psion: psion, lg_phalanx: phalanx,
};

/** Every Cabal unit except the generic boss fallback (enemies.js): the base classes (grunt Legionary, rusher War Beast, captain
 *  Centurion, heavy Colossus) and the Destiny 2 units (Incendior, Gladiator, Psion, Phalanx). */
export function cabal(c, t) {
  const b = BUILD[t];
  if (!b) throw new Error(`No Cabal model for ${t}`);
  _loyal = !!c.C?.loyalist;
  b(c);
}
