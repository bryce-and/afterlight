import * as THREE from 'three';
import { mat } from './world.js';

// ---------------------------------------------------------------------------
// FALLEN (U18, from Bryce's references in docs/reference/enemies/fallen-*): House of Devils red and bone.
// Bone armour plates (c.bodyMat, the faction's `enemy` colour, so hit flashes show on it), a dark red undersuit
// (c.dark), red cloth hoods, scarves and cloaks, four blue eyes (c.accent). The Servitor keeps its own purple.
// Shared parts: fallenHead (mask, four eyes, crest), fallenLegs (digitigrade, knee plates, clawed feet),
// fallenArm (undersuit sleeve, bone bracer, claw), hood. Same builder contract as the other factions:
// face +z, stand on y = 0 (floating units are lifted by `def.fly`), c.torso / c.legs / c.arms / c.muzzle per unit.
// ---------------------------------------------------------------------------
const PI = Math.PI;
const ico = (c, r, d, m, x, y, z, parent, crit = false) => c.add(new THREE.IcosahedronGeometry(r, d), m, x, y, z, parent, crit);
const cone = (c, r, h, m, x, y, z, parent, rot = null, crit = false, seg = 5) => c.add(new THREE.ConeGeometry(r, h, seg), m, x, y, z, parent, crit, rot);
const cyl = (c, rt, rb, h, seg, m, x, y, z, parent, rot = null, crit = false) => c.add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, parent, crit, rot);

let _m = null;
function fm() {
  if (!_m) _m = {
    cloth: mat(0xa3281f), clothD: mat(0x6c1a15), joint: mat(0x2c2826), wrap: mat(0x6e5e4e), steel: mat(0x56585e),
    crest: mat(0x5c1714), blade: mat(0x8fe4ff, { emissive: 0x5fd0ff, emissiveIntensity: 2.4 }),
    hot: mat(0xff6a14, { emissive: 0xff6a14, emissiveIntensity: 2.8 }), amber: mat(0xffa030, { emissive: 0xff8a20, emissiveIntensity: 2.4 }),
    net: new THREE.MeshBasicMaterial({ color: 0x1c140e, wireframe: true }),
    slate: mat(0x343b4e), band: mat(0x6f6a66), purple: mat(0xb26bff, { emissive: 0xb26bff, emissiveIntensity: 2.6 }),
    purpleD: mat(0x6a3aa8, { emissive: 0x5a2aa0, emissiveIntensity: 1.2 }),
  };
  return _m;
}

/** Head on `parent` at (0, y, z): bone mask with a breather, four blue eyes (all crit), and a crest:
 *  'mohawk' (Dreg), 'horns' (Vandal), 'crown' (Captain). */
function fallenHead(c, parent, y, z, s, crest) {
  const M = fm();
  const h = c.pivot(0, y, z, parent);
  c.B(0.2 * s, 0.2 * s, 0.22 * s, 0, 0, -0.01, c.dark, h, true);
  c.B(0.23 * s, 0.15 * s, 0.07 * s, 0, 0.03 * s, 0.1 * s, c.bodyMat, h, true);
  c.B(0.13 * s, 0.1 * s, 0.09 * s, 0, -0.08 * s, 0.11 * s, M.joint, h, true); // breather
  for (const sx of [-1, 1]) {
    for (const dy of [0, 0.055]) c.B(0.045 * s, 0.035 * s, 0.03 * s, sx * 0.055 * s, (0.06 - dy) * s, 0.14 * s, c.accent, h, true);
    c.B(0.05 * s, 0.12 * s, 0.1 * s, sx * 0.1 * s, -0.07 * s, 0.08 * s, c.bodyMat, h, true, [0.25, 0, sx * 0.25]); // mandible
  }
  if (crest === 'mohawk') {
    for (let i = 0; i < 4; i++) c.B(0.035 * s, (0.2 - i * 0.025) * s, 0.06 * s, 0, (0.17 - i * 0.01) * s, (0.04 - i * 0.06) * s, M.crest, h, true, [-0.25 - i * 0.12, 0, 0]);
  } else if (crest === 'horns') {
    c.B(0.04 * s, 0.03 * s, 0.075 * s, 0, 0.11 * s, 0.1 * s, M.cloth, h, true); // red brow stripe
    for (const sx of [-1, 1]) cone(c, 0.04 * s, 0.26 * s, c.bodyMat, sx * 0.13 * s, 0.14 * s, 0.02, h, [0, 0, sx * -0.7], true, 4);
  } else if (crest === 'crown') {
    c.B(0.06 * s, 0.05 * s, 0.075 * s, 0, 0.1 * s, 0.1 * s, M.cloth, h, true);
    for (const sx of [-1, 1]) {
      c.B(0.14 * s, 0.26 * s, 0.05 * s, sx * 0.1 * s, 0.22 * s, 0, c.bodyMat, h, true, [0, 0, sx * -0.35]); // crown plates
      cone(c, 0.025 * s, 0.16 * s, M.joint, sx * 0.17 * s, 0.4 * s, 0, h, [0, 0, sx * -0.35], true, 4); // spikes
      cone(c, 0.02 * s, 0.1 * s, M.joint, sx * 0.21 * s, 0.24 * s, 0, h, [0, 0, sx * -1.2], true, 4);
    }
    cone(c, 0.03 * s, 0.2 * s, c.bodyMat, 0, 0.26 * s, 0.03, h, [-0.2, 0, 0], true, 4);
  }
  return h;
}

/** Two digitigrade legs: dark red thighs with bone plates, bone knee caps, wrapped shins, clawed feet. */
function fallenLegs(c, hipY, hipW, th) {
  const M = fm();
  for (const sx of [-1, 1]) {
    const hip = c.pivot(sx * hipW, hipY, 0);
    const L = hipY / 2;
    c.B(th * 1.15, L * 1.05, th * 1.25, 0, -L * 0.48, 0.07, c.dark, hip, false, [-0.32, 0, 0]);
    c.B(th * 1.2, L * 0.6, th * 0.4, 0, -L * 0.42, 0.07 + th * 0.7, c.bodyMat, hip, false, [-0.32, 0, 0]);
    c.B(th * 1.35, th * 1.3, th * 0.7, 0, -L * 0.98, th * 0.75, c.bodyMat, hip); // knee cap
    c.B(th * 0.85, L * 1.05, th * 0.9, 0, -L * 1.45, 0.06, M.wrap, hip, false, [0.3, 0, 0]);
    c.B(th * 1.1, 0.08, th * 1.5, 0, -hipY + 0.04, 0.08, M.joint, hip);
    for (const cx of [-1, 1]) cone(c, th * 0.28, th * 1.1, c.bodyMat, cx * th * 0.35, -hipY + 0.05, 0.08 + th * 1.2, hip, [PI / 2, 0, 0], false, 4);
    c.legs.push(hip);
  }
}

/** One arm on `parent`: undersuit sleeve, bone bracer, dark claw. Pivot at the shoulder; the hand sits at (0, -len, 0). */
function fallenArm(c, parent, x, y, len, th, lift, rz) {
  const M = fm();
  const p = c.pivot(x, y, 0, parent);
  c.B(th, len * 0.5, th, 0, -len * 0.25, 0, c.dark, p);
  c.B(th * 1.3, len * 0.48, th * 1.3, 0, -len * 0.72, 0, c.bodyMat, p);
  c.B(th * 0.95, 0.08, th * 1.1, 0, -len - 0.03, 0, M.joint, p);
  p.rotation.x = lift; p.rotation.z = rz;
  return p;
}

/** Red hood around the head and a scarf at the neck; `drape` hangs a cloak of that length down the back. */
function hood(c, torso, y, W, drape) {
  const M = fm();
  // cowl: a cloth wall behind and beside the head, below the crest, so the mask and crest stay readable
  c.B(0.3, 0.24, 0.07, 0, y + 0.01, -0.15, M.cloth, torso, false, [-0.15, 0, 0]);
  for (const sx of [-1, 1]) c.B(0.05, 0.2, 0.2, sx * 0.15, y - 0.02, -0.05, M.cloth, torso, false, [0, sx * 0.2, 0]);
  c.B(0.34 * W, 0.1, 0.26, 0, y - 0.12, 0.02, M.cloth, torso);
  if (drape) {
    c.B(0.48 * W, drape, 0.03, 0, y - 0.1 - drape / 2, -0.18, M.cloth, torso, false, [0.12, 0, 0]);
    c.B(0.4 * W, drape * 0.85, 0.02, 0, y - 0.1 - drape * 0.45, -0.2, M.clothD, torso, false, [0.14, 0, 0]);
  }
}

/** The biped Fallen body (Dreg, Vandal, Captain): legs, a torso leaning forward, chest plates, belt sash, head, hood, four arms.
 *  Returns { torso, up: [left, right] upper arms, low: [left, right] lower arms }. */
function fallenBody(c, W, lean, crest, drape) {
  const M = fm();
  fallenLegs(c, 0.95, 0.15 * W, 0.12 * W);
  const torso = c.pivot(0, 0.95, 0);
  torso.rotation.x = lean;
  c.torso = torso;
  c.B(0.26 * W, 0.24, 0.2, 0, 0.12, 0, c.dark, torso);
  c.B(0.34 * W, 0.08, 0.24, 0, 0.04, 0.01, M.cloth, torso); // sash
  c.B(0.2 * W, 0.34, 0.03, 0, -0.14, 0.12, M.cloth, torso, false, [-0.12, 0, 0]); // loincloth
  c.B(0.42 * W, 0.38, 0.28, 0, 0.45, 0, c.dark, torso);
  c.B(0.38 * W, 0.22, 0.06, 0, 0.5, 0.15, c.bodyMat, torso); // chest plate
  for (const sx of [-1, 1]) c.B(0.18 * W, 0.12, 0.26, sx * 0.25 * W, 0.66, 0, c.bodyMat, torso, false, [0, 0, sx * -0.35]); // pauldrons
  fallenHead(c, torso, 0.82, 0.07, 1, crest);
  hood(c, torso, 0.82, W, drape);
  const up = [fallenArm(c, torso, -0.27 * W, 0.62, 0.48, 0.08, -1.2, 0.1), fallenArm(c, torso, 0.27 * W, 0.62, 0.48, 0.08, -1.2, -0.1)];
  const low = [fallenArm(c, torso, -0.2 * W, 0.36, 0.38, 0.065, -0.9, 0.3), fallenArm(c, torso, 0.2 * W, 0.36, 0.38, 0.065, -0.9, -0.3)];
  return { torso, up, low };
}

/** Dreg: lean and hunched, wrapped limbs, a scarf hood and a dark red mohawk; a shock knife in one upper hand and a shock pistol in the other. */
function dreg(c) {
  const M = fm();
  const { torso, up } = fallenBody(c, 0.85, 0.45, 'mohawk', 0);
  c.arms.push(...up);
  c.B(0.025, 0.06, 0.36, 0, -0.52, 0.16, M.blade, up[0]); // shock knife
  c.B(0.04, 0.06, 0.08, 0, -0.5, -0.02, M.joint, up[0]);
  c.B(0.06, 0.08, 0.18, 0, -0.5, 0.08, M.steel, up[1]); // shock pistol
  c.B(0.025, 0.025, 0.04, 0, -0.48, 0.18, c.accent, up[1]);
  c.muzzle.position.set(0, 0.5, 0.3); torso.add(c.muzzle);
}

/** Vandal: bone plating over the red suit, horned helm, hooded red cloak and a backpack; a wire rifle held by the upper pair. */
function vandal(c) {
  const M = fm();
  const { torso, up } = fallenBody(c, 1, 0.22, 'horns', 0.75);
  c.arms.push(...up);
  c.B(0.26, 0.3, 0.16, 0, 0.5, -0.2, c.bodyMat, torso); // pack
  c.B(0.08, 0.1, 0.06, 0.08, 0.68, -0.24, M.steel, torso);
  // wire rifle: stock, body, long barrel with blue coil, held across the chest
  c.B(0.08, 0.1, 0.3, 0.12, 0.42, 0.28, M.joint, torso);
  c.B(0.05, 0.05, 0.42, 0.12, 0.44, 0.62, M.steel, torso);
  c.B(0.03, 0.03, 0.18, 0.12, 0.5, 0.5, c.accent, torso);
  c.muzzle.position.set(0.12, 0.44, 0.85); torso.add(c.muzzle);
}

/** Captain: bigger, a spiked crown, a red scarf over a long cloak, heavy spiked pauldrons; a heavy scorch cannon held across the body
 *  by the upper pair, its glowing muzzle forward (Bryce 2026-11-05: captains shoot, no sword). */
function captain(c) {
  const M = fm();
  const W = 1.3;
  const { torso, up } = fallenBody(c, W, 0.18, 'crown', 1.0);
  c.arms.push(...up);
  for (const sx of [-1, 1]) {
    c.B(0.28, 0.14, 0.34, sx * 0.36, 0.7, 0, c.bodyMat, torso, false, [0, 0, sx * -0.3]);
    for (const k of [0, 1]) cone(c, 0.03, 0.18, M.joint, sx * (0.38 + k * 0.08), 0.8 - k * 0.04, -0.06 + k * 0.1, torso, [0, 0, sx * -0.5], false, 4);
    c.B(0.025, 0.3, 0.025, sx * 0.06, 0.66, 0.16, M.joint, torso, false, [0.2, 0, sx * 0.2]); // breather hoses
  }
  c.B(0.36 * W, 0.12, 0.3, 0, 0.72, 0.02, M.cloth, torso); // scarf
  // scorch cannon: dark stock against the chest, a long heavy body with a bone top plate, glowing vents and a red-hot muzzle
  c.B(0.12, 0.14, 0.3, 0.14, 0.44, 0.24, M.joint, torso);
  c.B(0.14, 0.16, 0.6, 0.14, 0.44, 0.62, M.steel, torso);
  c.B(0.1, 0.05, 0.42, 0.14, 0.54, 0.58, c.bodyMat, torso);
  for (const dz of [0.5, 0.62, 0.74]) c.B(0.15, 0.03, 0.04, 0.14, 0.44, dz, M.hot, torso);
  c.B(0.16, 0.16, 0.08, 0.14, 0.44, 0.94, M.joint, torso);
  c.B(0.1, 0.1, 0.03, 0.14, 0.44, 0.99, M.hot, torso);
  c.muzzle.position.set(0.14, 0.44, 1.02); torso.add(c.muzzle);
  c.height = 2.2;
}

/** Brig: a walking Fallen tank. Domed bone hull with a red band, a cluster of eight amber eyes (crit), antennae and exhaust stubs,
 *  a round shoulder cannon with a blue ring on the right, a long arm cannon on the left; thick plated legs on clawed feet. */
function brig(c) {
  const M = fm();
  for (const sx of [-1, 1]) {
    const hip = c.pivot(sx * 0.34, 1.0, 0);
    c.B(0.32, 0.55, 0.36, 0, -0.25, 0.05, c.bodyMat, hip, false, [-0.25, 0, 0]);
    cyl(c, 0.09, 0.09, 0.06, 8, M.joint, 0, -0.04, 0.2, hip, [PI / 2, 0, 0]);
    c.B(0.24, 0.55, 0.26, 0, -0.72, 0.02, c.dark, hip, false, [0.25, 0, 0]);
    c.B(0.27, 0.3, 0.12, 0, -0.66, 0.16, c.bodyMat, hip, false, [0.25, 0, 0]); // shin guard
    c.B(0.38, 0.1, 0.46, 0, -0.96, 0.08, M.joint, hip);
    for (const tx of [-1, 0, 1]) cone(c, 0.05, 0.16, M.joint, tx * 0.12, -0.95, 0.36, hip, [PI / 2, 0, 0], false, 4);
    c.legs.push(hip);
  }
  const body = c.pivot(0, 1.0, 0);
  c.torso = body;
  c.B(0.6, 0.2, 0.55, 0, 0.08, 0, c.dark, body); // pelvis
  ico(c, 0.5, 1, c.bodyMat, 0, 0.5, 0, body).scale.set(1.0, 0.9, 0.85);
  c.B(1.0, 0.12, 0.88, 0, 0.42, 0, M.cloth, body); // red band
  c.B(0.5, 0.26, 0.1, 0, 0.36, 0.4, M.joint, body, true); // eye plate
  for (let i = 0; i < 4; i++) for (const dy of [0, 0.08]) c.B(0.06, 0.05, 0.04, -0.15 + i * 0.1, 0.44 - dy, 0.46, M.amber, body, true);
  for (const sx of [-1, 1]) cyl(c, 0.04, 0.05, 0.12, 6, M.joint, sx * 0.24, 0.3, 0.42, body, [PI / 2, 0, 0]);
  for (const [x, z, h] of [[-0.15, -0.1, 0.4], [0.05, -0.15, 0.32], [0.2, 0.0, 0.26]]) c.B(0.025, h, 0.025, x, 0.92 + h / 2, z, M.joint, body);
  for (const [x, z] of [[-0.3, 0.1], [0.3, 0.12], [0.0, 0.3]]) cyl(c, 0.04, 0.04, 0.18, 6, M.wrap, x, 0.88, z, body, [0.4, 0, x]);
  // right: shoulder cannon pod with a blue ring
  cyl(c, 0.22, 0.22, 0.42, 10, c.bodyMat, 0.66, 0.62, 0.08, body, [PI / 2, 0, 0]);
  c.add(new THREE.TorusGeometry(0.14, 0.035, 5, 12), c.accent, 0.66, 0.62, 0.3, body);
  cyl(c, 0.07, 0.07, 0.04, 8, M.joint, 0.66, 0.62, 0.3, body, [PI / 2, 0, 0]);
  // left: long arm cannon held forward
  c.B(0.2, 0.2, 0.2, -0.62, 0.55, 0, c.dark, body);
  c.B(0.2, 0.22, 0.95, -0.66, 0.38, 0.28, M.joint, body);
  c.B(0.21, 0.06, 0.4, -0.66, 0.5, 0.2, M.cloth, body);
  for (const sx of [-1, 1]) c.B(0.03, 0.3, 0.18, -0.66 + sx * 0.12, 0.42, -0.05, M.steel, body, false, [0, 0, sx * 0.3]);
  c.muzzle.position.set(-0.66, 0.38, 0.8); body.add(c.muzzle);
  c.height = 2.0;
}

/** Shank: a red drone with two round side pods, a bone face plate with three blue eyes (crit), fins and a thruster behind,
 *  and a gun under the chin. */
function shankDrone(c) {
  const M = fm();
  c.hover = true;
  const b = c.pivot(0, 0.9, 0);
  b.scale.setScalar(1.25); // a little bigger than the pre-U18 drone (Bryce, 2026-11-05)
  c.torso = b;
  ico(c, 0.3, 1, M.cloth, 0, 0, 0, b).scale.set(1.25, 0.8, 1.15);
  c.B(0.44, 0.28, 0.08, 0, 0.0, 0.32, c.bodyMat, b, true);
  for (const [x, y, r] of [[-0.08, 0.04, 0.045], [0.08, 0.04, 0.045], [0.12, -0.07, 0.035]]) cyl(c, r, r, 0.04, 8, c.accent, x, y, 0.37, b, [PI / 2, 0, 0], true);
  for (const sx of [-1, 1]) {
    ico(c, 0.17, 1, M.cloth, sx * 0.36, 0.08, -0.08, b).scale.set(1.3, 0.7, 1.1);
    c.add(new THREE.TorusGeometry(0.08, 0.02, 4, 8), M.joint, sx * 0.38, 0.2, -0.08, b, false, [PI / 2, 0, 0]);
    c.B(0.05, 0.3, 0.14, sx * 0.2, -0.24, -0.2, M.clothD, b, false, [0.6, 0, sx * -0.4]); // fins
  }
  cyl(c, 0.07, 0.09, 0.14, 8, M.joint, 0, 0.04, -0.36, b, [PI / 2, 0, 0]);
  ico(c, 0.06, 0, M.hot, 0, 0.04, -0.44, b);
  c.B(0.08, 0.08, 0.32, 0, -0.22, 0.24, M.steel, b);
  c.B(0.03, 0.03, 0.06, 0, -0.22, 0.42, c.accent, b);
  c.muzzle.position.set(0, -0.22, 0.46); b.add(c.muzzle);
  c.height = 1.2;
}

/** Explosive Shank: a squat drone wrapped in cargo netting over three glowing orange charges; the middle charge and the hull are crit. */
function explosiveShank(c) {
  const M = fm();
  c.hover = true;
  const core = c.pivot(0, 1.0, 0);
  core.scale.setScalar(1.25); // a little bigger (Bryce, 2026-11-05)
  c.torso = core;
  ico(c, 0.32, 1, M.joint, 0, 0.05, 0, core, true).scale.set(1.3, 0.75, 1.0);
  for (const sx of [-1, 1]) ico(c, 0.18, 1, c.bodyMat, sx * 0.34, 0.14, -0.04, core).scale.set(1.2, 0.8, 1.1);
  for (const [x, y, z, crit] of [[0, -0.12, 0.2, true], [-0.24, -0.1, 0.06, false], [0.24, -0.1, 0.06, false]]) ico(c, 0.17, 1, M.hot, x, y, z, core, crit);
  for (const sx of [-1, 1]) c.B(0.04, 0.03, 0.03, sx * 0.07, 0.12, 0.3, c.accent, core, true);
  c.add(new THREE.IcosahedronGeometry(0.5, 1), M.net, 0, 0, 0.02, core).scale.set(1.25, 0.75, 1.0);
  c.muzzle.position.set(0, 0, 0.4); core.add(c.muzzle);
  c.height = 1.65;
}

/** Servitor (its own purple, Bryce 2026-11-05): a dark slate sphere, a recessed front ring with six blocks round a glowing purple
 *  eye (crit), and two broken bands wrapped round the shell. */
function servitor(c) {
  const M = fm();
  c.hover = true;
  const b = c.pivot(0, 1.2, 0);
  b.scale.setScalar(1.74); // about 2.1 m across, bigger than a Guardian's 1.8 m; with `fly` 0.3 it hovers about 0.4 m off the ground (Bryce, 2026-11-05)
  c.torso = b;
  ico(c, 0.6, 2, M.slate, 0, 0, 0, b);
  c.add(new THREE.TorusGeometry(0.36, 0.08, 6, 14), M.joint, 0, 0, 0.47, b);
  cyl(c, 0.3, 0.3, 0.04, 14, M.purpleD, 0, 0, 0.47, b, [PI / 2, 0, 0]);
  ico(c, 0.15, 1, M.purple, 0, 0, 0.53, b, true).scale.z = 0.6;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + PI / 6;
    c.B(0.12, 0.09, 0.08, Math.cos(a) * 0.37, Math.sin(a) * 0.37, 0.53, M.band, b, false, [0, 0, a]);
    c.B(0.04, 0.035, 0.02, Math.cos(a) * 0.37, Math.sin(a) * 0.37, 0.58, M.purple, b);
  }
  // two broken bands that never cross the face (Bryce, 2026-11-05): one round the silhouette, one over the back and top,
  // ending above the eye ring
  c.add(new THREE.TorusGeometry(0.62, 0.04, 4, 16, PI * 1.1), M.band, 0, 0, 0, b, false, [0, 0, PI * 0.45]);
  c.add(new THREE.TorusGeometry(0.62, 0.035, 4, 16, PI * 0.7), M.band, 0, 0, 0, b, false, [0, PI / 2, 0]);
  c.muzzle.position.set(0, 0, 0.65); b.add(c.muzzle);
  c.height = 2.3;
}

const BUILD = {
  grunt: vandal, rusher: dreg, captain, heavy: brig, suicide: explosiveShank, boss: genericBoss,
  fl_shank: shankDrone, fl_servitor: servitor,
};

/** Every Fallen unit: the base classes (grunt Vandal, rusher Dreg, captain, heavy Brig, suicide Explosive Shank, generic boss) and the v2.9 units. */
export function fallen(c, t) {
  const b = BUILD[t];
  if (!b) throw new Error(`No Fallen model for ${t}`);
  b(c);
}

// ---- pre-U18 code kept for the generic boss ----
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

/** Gun held at chest height; places the muzzle at its front. */
function gun(c, parent, x, y, z, len, thick, glow = true) {
  c.B(thick, thick * 1.2, len, x, y, z, c.dark, parent);
  if (glow) c.B(thick * 0.5, thick * 0.4, len * 0.4, x, y + thick * 0.7, z, c.accent, parent);
  c.muzzle.position.set(x, y, z + len / 2 + 0.03);
  parent.add(c.muzzle);
}

function arm(c, parent, x, y, len, thick, m, lift = -1.1, rz = 0) {
  const p = c.pivot(x, y, 0, parent);
  c.B(thick, len, thick, 0, -len / 2, 0, m, p);
  p.rotation.x = lift;
  p.rotation.z = rz;
  return p;
}

// ---------------------------------------------------------------------------
// FALLEN: four arms, four eyes, cloaks, digitigrade legs
// ---------------------------------------------------------------------------
/** The generic Fallen boss (bosses without their own model): the pre-U18 shape, kept as it was. */
function genericBoss(c, t = 'boss') {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  const armor = mat(0x6f716a), cloth = mat(0x3c4a5c);
  if (t === 'heavy') {
    // Brig: a walking Fallen tank
    for (const s of [-1, 1]) {
      const hip = pivot(s * 0.32, 1.0, 0);
      B(0.26, 0.55, 0.3, 0, -0.25, 0.05, armor, hip, false, [-0.25, 0, 0]);
      B(0.22, 0.55, 0.26, 0, -0.72, 0.02, dark, hip, false, [0.25, 0, 0]);
      B(0.36, 0.12, 0.5, 0, -0.96, 0.08, armor, hip);
      c.legs.push(hip);
    }
    const body = pivot(0, 1.0, 0);
    c.torso = body;
    B(0.95, 0.55, 0.8, 0, 0.42, 0, bodyMat, body);
    B(0.8, 0.2, 0.7, 0, 0.78, -0.05, armor, body);
    B(0.5, 0.18, 0.06, 0, 0.5, 0.41, dark, body, true);
    B(0.38, 0.06, 0.04, 0, 0.52, 0.44, accent, body, true);
    for (const s of [-1, 1]) {
      B(0.26, 0.26, 0.75, s * 0.62, 0.42, 0.1, armor, body);
      for (const dy of [-0.06, 0.06]) add(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6).rotateX(Math.PI / 2), dark, s * 0.62, 0.42 + dy, 0.62, body);
      B(0.03, 0.4, 0.03, s * 0.3, 1.05, -0.3, dark, body);
    }
    c.muzzle.position.set(0.62, 0.42, 0.8);
    body.add(c.muzzle);
    c.height = 2.0;
    return;
  }
  const big = t === 'captain' || t === 'boss';
  const W = big ? 1.3 : t === 'rusher' ? 0.85 : 1;
  legsBiped(c, 0.95, 0.15 * W, 0.12 * W, dark, armor, true);
  const torso = pivot(0, 0.95, 0);
  torso.rotation.x = t === 'rusher' ? 0.45 : 0.22;
  c.torso = torso;
  B(0.26 * W, 0.24, 0.2, 0, 0.12, 0, dark, torso);
  B(0.42 * W, 0.38, 0.28, 0, 0.45, 0, bodyMat, torso);
  B(0.36 * W, 0.2, 0.06, 0, 0.5, 0.15, armor, torso);
  // helmet with mandible fins and four eyes
  B(0.22, 0.18, 0.26, 0, 0.82, 0.07, armor, torso, true);
  for (const s of [-1, 1]) {
    B(0.04, 0.14, 0.12, s * 0.12, 0.74, 0.17, armor, torso, true, [0.3, 0, s * 0.2]);
    for (const dy of [0, 0.05]) B(0.035, 0.03, 0.03, s * 0.05, 0.84 - dy, 0.205, accent, torso, true);
  }
  // hooded cloak hanging off the back
  add(new THREE.ConeGeometry(0.34 * W, 0.4, 5, 1, true), cloth, 0, 0.8, -0.04, torso);
  B(0.5 * W, big ? 1.0 : 0.8, 0.03, 0, big ? 0.15 : 0.25, -0.17, cloth, torso, false, [0.15, 0, 0]);
  // four arms: upper pair holds the weapon, lower pair braces it
  const up = [arm(c, torso, -0.27 * W, 0.62, 0.48, 0.08, bodyMat, -1.2, 0.1), arm(c, torso, 0.27 * W, 0.62, 0.48, 0.08, bodyMat, -1.2, -0.1)];
  arm(c, torso, -0.2 * W, 0.36, 0.38, 0.065, bodyMat, -0.9, 0.3);
  arm(c, torso, 0.2 * W, 0.36, 0.38, 0.065, bodyMat, -0.9, -0.3);
  c.arms.push(...up);
  if (t === 'rusher') {
    // Dreg: shock blades instead of a rifle
    for (const a of up) B(0.02, 0.05, 0.36, 0, -0.5, 0.12, accent, a);
    c.muzzle.position.set(0, 0.5, 0.3); torso.add(c.muzzle);
  } else {
    gun(c, torso, 0.12, 0.42, 0.45, big ? 0.75 : 0.65, 0.08);
  }
  if (big) {
    for (const s of [-1, 1]) {
      B(0.26, 0.12, 0.32, s * 0.33, 0.68, 0, armor, torso, false, [0, 0, s * -0.3]);
      add(new THREE.ConeGeometry(0.03, 0.3, 4), armor, s * 0.08, 1.02, 0.02, torso, true, [-0.4, 0, s * -0.4]);
    }
    B(0.1, 0.5, 0.02, 0.1, 0.08, 0.16, mat(c.C.accent), torso);
  }
  if (t === 'boss') {
    // Kell-style banners behind the shoulders
    for (const s of [-1, 1]) {
      B(0.03, 1.1, 0.03, s * 0.24, 1.0, -0.2, dark, torso);
      B(0.22, 0.5, 0.015, s * 0.24 + s * 0.12, 1.3, -0.2, mat(c.C.accent), torso);
    }
  }
}

