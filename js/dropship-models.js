// U32 "Dropships": the ship and gate models (no game imports, so tools/dropshot.js can draw them on their own).
// Four ships (Cabal, Fallen, Hive, Scorn; nose toward +Z) and the Vex and Taken teleport gates.
import * as THREE from 'three';

// ---------------------------------------------------------------- shared geometry and materials
const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 8), CONE = new THREE.ConeGeometry(1, 1, 5), SPH = new THREE.SphereGeometry(1, 7, 5), TORUS = new THREE.TorusGeometry(1, 0.12, 5, 14);
const CYL_OPEN = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); // gate columns: no caps
const mats = new Map();
const lit = (c, rough = 0.8, metal = 0.25) => { const k = `l${c}${rough}${metal}`; if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, flatShading: true })); return mats.get(k); };
const glow = (c, o = 0.95) => { const k = `g${c}${o}`; if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false })); return mats.get(k); };

/** One part: a shared geometry, scaled, placed and tilted. */
function part(g, geo, mat, [sx, sy, sz], [x, y, z], [rx = 0, ry = 0, rz = 0] = []) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  g.add(m);
  return m;
}
export const HALF = Math.PI / 2;

// ---------------------------------------------------------------- ship models (nose toward +Z)
/** Cabal: a Phobos-class armored lander. Red hull, bronze trim, two big rear engines, a glowing belly hatch. */
function buildCabal(g, pulse) {
  const hull = lit(0x6b1f1a, 0.7, 0.35), trim = lit(0x9a7a3c, 0.5, 0.6), dark = lit(0x24120f);
  part(g, BOX, hull, [6.4, 2.6, 9], [0, 0, 0]);
  part(g, CONE, hull, [3.2, 5, 1.7], [0, 0, 7], [HALF, Math.PI / 4, 0]); // blunt armored nose
  part(g, BOX, trim, [6.7, 0.35, 9.2], [0, 1.2, 0]);
  part(g, BOX, trim, [0.4, 2.2, 6], [3.3, 0, -0.5]); part(g, BOX, trim, [0.4, 2.2, 6], [-3.3, 0, -0.5]);
  for (const s of [-1, 1]) {
    part(g, BOX, hull, [5.5, 0.6, 3.6], [s * 5.4, 0.2, -1.4], [0, s * 0.25, s * -0.12]); // swept wings
    part(g, CYL, dark, [1.3, 3.4, 1.3], [s * 3.4, 0.2, -5.4], [HALF, 0, 0]); // engine
    part(g, CYL, trim, [1.5, 0.5, 1.5], [s * 3.4, 0.2, -3.9], [HALF, 0, 0]);
    pulse.push(part(g, CYL, glow(0xff7a2a), [1.0, 0.25, 1.0], [s * 3.4, 0.2, -7.2], [HALF, 0, 0]));
    pulse.push(part(g, CONE, glow(0xff9a3a, 0.5), [0.9, 3.2, 0.9], [s * 3.4, 0.2, -8.9], [-HALF, 0, 0])); // exhaust plume
  }
  part(g, BOX, dark, [3.4, 0.4, 4], [0, -1.4, 0.5]);
  pulse.push(part(g, BOX, glow(0xff5a2a, 0.8), [2.8, 0.2, 3.4], [0, -1.65, 0.5])); // hatch light
  part(g, BOX, glow(0xffd26a, 0.9), [0.9, 0.25, 0.1], [0, 0.5, 7.4]); // sensor slit
}

/** Fallen: a Ketch skiff. Sleek sandy hull, four blade fins, a long prow, blue ether thrusters. */
function buildFallen(g, pulse) {
  const sand = lit(0xd8ccae, 0.6, 0.3), red = lit(0xa3281f, 0.6, 0.3), dark = lit(0x3a2b22);
  part(g, SPH, sand, [2.4, 1.1, 6.4], [0, 0, 0]);
  part(g, CONE, sand, [1.3, 5.5, 1.1], [0, 0.1, 7.4], [HALF, 0, 0]); // long prow
  part(g, BOX, red, [0.5, 0.5, 8], [0, 1.0, 0]);
  for (const s of [-1, 1]) for (const z of [-1.2, -4]) {
    part(g, BOX, s > 0 && z > -2 ? red : sand, [0.18, 3.4, 3.4], [s * 2.5, 0.2, z], [0, 0, s * 0.95]); // blade fins
    part(g, BOX, dark, [0.25, 0.25, 3.8], [s * 3.5, -0.9, z], [0, 0, s * 0.95]);
  }
  for (const s of [-1, 1]) {
    pulse.push(part(g, SPH, glow(0x7fd8ff), [0.8, 0.8, 0.8], [s * 1.2, 0.1, -6.6]));
    pulse.push(part(g, CONE, glow(0x62b4ff, 0.55), [0.7, 3.6, 0.7], [s * 1.2, 0.1, -8.6], [-HALF, 0, 0]));
  }
  pulse.push(part(g, BOX, glow(0x7fd8ff, 0.8), [1.8, 0.15, 3.2], [0, -1.15, 0.4])); // ether hatch
  part(g, SPH, dark, [0.7, 0.5, 0.9], [0, 0.95, 3.2]); // the Captain's seat
}

/** Hive: a living Thrall-ship. Bone hull, curved tusks, a ribbed underbelly and a green-lit maw. */
function buildHive(g, pulse) {
  const bone = lit(0xcfc7a8, 0.85, 0.05), dark = lit(0x2a3a1f, 0.9, 0), ridge = lit(0x8d8a6a, 0.9, 0.05);
  part(g, SPH, bone, [3.8, 1.8, 5.6], [0, 0, 0]);
  for (let i = 0; i < 5; i++) part(g, CONE, ridge, [0.45, 1.6 - i * 0.12, 0.45], [0, 1.5, -3.2 + i * 1.5], [i * 0.05, 0, 0]); // spine ridges
  for (const [x, a, l] of [[-1.5, 0.2, 5.2], [1.5, 0.2, 5.2], [-3.1, 0.45, 4.4], [3.1, 0.45, 4.4]]) {
    part(g, CONE, bone, [0.55, l, 0.55], [x, -0.7, 5.0 + Math.abs(x) * 0.15], [HALF + a, 0, x * 0.12]); // forward tusks
  }
  for (let i = 0; i < 4; i++) part(g, BOX, dark, [5.6 - i * 0.7, 0.16, 0.5], [0, -1.55, -2.6 + i * 1.55]); // belly ribs
  pulse.push(part(g, SPH, glow(0x9dff5a, 0.85), [1.6, 0.7, 1.6], [0, -1.65, 0.3])); // the maw
  for (const s of [-1, 1]) {
    pulse.push(part(g, SPH, glow(0x9dff5a), [0.35, 0.35, 0.35], [s * 1.1, 0.5, 4.6]));
    for (let i = 0; i < 3; i++) part(g, CYL, dark, [0.12, 2.4 + i * 0.5, 0.12], [s * (0.6 + i * 0.7), -1.0 - i * 0.5, -5.0 - i * 0.2], [0.5, 0, s * 0.1]); // trailing tendrils
  }
}

/** Scorn: a scrap gunship. Rusted patchwork hull, four down-thrusters, exhaust stacks, a hanging lamp. */
function buildScorn(g, pulse) {
  const rust = lit(0x6a3b24, 0.95, 0.4), plate = lit(0x8b8470, 0.9, 0.35), iron = lit(0x3a342c, 0.8, 0.5), bone = lit(0xb9b29a);
  part(g, BOX, rust, [4.8, 2.1, 7.2], [0, 0, 0]);
  part(g, BOX, plate, [2.6, 0.3, 3], [-1, 1.1, 1.6], [0, 0.15, 0]); part(g, BOX, plate, [2.2, 0.3, 2.4], [1.2, 1.1, -1.4], [0, -0.2, 0.05]);
  part(g, BOX, iron, [5.2, 0.4, 1.2], [0, 0.2, 3.4]); // armored brow
  part(g, CONE, iron, [1.8, 2.4, 1.8], [0, 0, 4.6], [HALF, Math.PI / 4, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    part(g, CYL, iron, [0.9, 1.7, 0.9], [sx * 3.1, -0.5, sz * 2.7]);
    part(g, BOX, rust, [0.3, 0.3, 2.8], [sx * 2.7, 0.2, sz * 2.7]); // strut
    pulse.push(part(g, CYL, glow(0xb46bff), [0.8, 0.15, 0.8], [sx * 3.1, -1.4, sz * 2.7]));
    pulse.push(part(g, CONE, glow(0xc37aff, 0.45), [0.8, 2.6, 0.8], [sx * 3.1, -2.7, sz * 2.7], [Math.PI, 0, 0]));
  }
  for (const s of [-1, 1]) part(g, CYL, iron, [0.3, 2.6, 0.3], [s * 1.2, 2.2, -3], [0, 0, 0]); // exhaust stacks
  for (const x of [-1.4, 0, 1.4]) part(g, BOX, bone, [0.12, 2.2, 0.12], [x, -2.0, -1.2]); // dangling chains
  pulse.push(part(g, CONE, glow(0xc5ff6a, 0.55), [1.1, 2.4, 1.1], [0, -1.2, 3.2], [Math.PI, 0, 0])); // the lamp
}

const BUILDERS = { cabal: buildCabal, fallen: buildFallen, hive: buildHive, scorn: buildScorn };
/** Overall scale so a 4-unit load fits under each hull. */
const SHIP_SCALE = { cabal: 1.0, fallen: 1.15, hive: 1.1, scorn: 1.15 };

export function buildShip(kind) {
  const g = new THREE.Group(), pulse = [];
  BUILDERS[kind](g, pulse);
  g.scale.setScalar(SHIP_SCALE[kind]);
  const root = new THREE.Group();
  root.add(g);
  root.userData.pulse = pulse;
  return root;
}

// ---------------------------------------------------------------- teleport gates (Vex, Taken)
const GATE = {
  vex: { col: 0x7fe8ff, ring: 0xffcf6a, flash: 0xbff4ff, add: true },
  taken: { col: 0x0b0a12, ring: 0xdfe8ff, flash: 0xdfe8ff, add: false },
};
export function buildGate(faction) {
  const L = GATE[faction] || GATE.vex;
  const g = new THREE.Group();
  const mat = L.add ? new THREE.MeshBasicMaterial({ color: L.col, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    : new THREE.MeshBasicMaterial({ color: L.col, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
  const ringMat = new THREE.MeshBasicMaterial({ color: L.ring, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const col = new THREE.Mesh(CYL_OPEN, mat); col.position.y = 2; col.scale.set(1, 4, 1);
  const ring = new THREE.Mesh(TORUS, ringMat); ring.position.y = 1.1;
  g.add(col, ring);
  g.userData = { col, ring, mat, ringMat, L };
  return g;
}
export function disposeGate(g) { g.userData.mat?.dispose(); g.userData.ringMat?.dispose(); }

