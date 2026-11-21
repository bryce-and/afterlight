// U32 "Dropships": the ship and gate models (no game imports, so tools/dropshot.js can draw them on their own).
// Four ships (Cabal, Fallen, Hive, Scorn; nose toward +Z) and the Vex and Taken teleport gates.
import * as THREE from 'three';

// ---------------------------------------------------------------- shared geometry and materials
const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 8), CONE = new THREE.ConeGeometry(1, 1, 5), SPH = new THREE.SphereGeometry(1, 7, 5), TORUS = new THREE.TorusGeometry(1, 0.12, 5, 14);
const CYL_OPEN = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); // gate columns: no caps
const mats = new Map();
const lit = (c, rough = 0.8, metal = 0.25) => { const k = `l${c}${rough}${metal}`; if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, flatShading: true, emissive: new THREE.Color(c).multiplyScalar(0.28) })); return mats.get(k); };
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
/** Cabal: a Harvester-class lander. Boxy red hull with grey armor plates, two forward engine pods on booms, small rear engines, a black cargo bay slung underneath. */
function buildCabal(g, pulse) {
  const red = lit(0xb83a2e, 0.55, 0.3), redDk = lit(0x7d231c, 0.6, 0.3), grey = lit(0x8f8f94, 0.6, 0.5), dark = lit(0x1c1c20, 0.7, 0.4), steel = lit(0x3a3a40, 0.6, 0.5), white = lit(0xe8e4dc, 0.6, 0.2);
  part(g, BOX, red, [4.4, 2.2, 10], [0, 0, 0]); // fuselage
  part(g, BOX, red, [4.4, 1.7, 2.8], [0, 0.35, 6], [-0.32, 0, 0]); // sloped nose
  part(g, BOX, redDk, [3.4, 1.0, 5], [0, 1.6, -1.5]); // raised rear deck
  part(g, BOX, steel, [2.4, 0.5, 1.6], [0, 1.0, 4.6]); // dark canopy slit
  for (const s of [-1, 1]) {
    part(g, BOX, grey, [0.4, 1.7, 6.8], [s * 2.3, 0, 0.4]); // side armor plates
    part(g, BOX, white, [0.45, 0.16, 1.5], [s * 2.33, 0.45, 2.6], [0, 0, 0]); // chevron marks
    part(g, BOX, white, [0.45, 0.16, 1.5], [s * 2.33, 0.05, 2.0], [0, 0, 0]);
    part(g, BOX, grey, [3.2, 0.5, 1.0], [s * 3.8, 0.2, 2.6]); // booms
    part(g, BOX, redDk, [1.9, 1.7, 4.4], [s * 5.4, 0.2, 2.6]); // forward engine pods
    part(g, BOX, steel, [1.5, 1.1, 0.5], [s * 5.4, 0.2, 5.0]); // intake grille
    part(g, BOX, grey, [2.1, 0.3, 3.2], [s * 5.4, 1.15, 2.2]); // pod armor
    pulse.push(part(g, BOX, glow(0xff7a2a), [1.2, 0.12, 1.5], [s * 5.4, -0.7, 2.6])); // down-thrust
    pulse.push(part(g, CYL, glow(0xff9a3a, 0.5), [0.6, 1.8, 0.6], [s * 5.4, -1.7, 2.6])); // thrust plume
    part(g, BOX, redDk, [1.3, 1.3, 2.6], [s * 3.1, -0.2, -5.2]); // rear engines
    pulse.push(part(g, BOX, glow(0xff7a2a), [1.0, 0.9, 0.18], [s * 3.1, -0.2, -6.6]));
    pulse.push(part(g, CONE, glow(0xff9a3a, 0.45), [0.55, 2.6, 0.55], [s * 3.1, -0.2, -8.0], [-HALF, 0, 0]));
  }
  part(g, BOX, dark, [3.4, 1.2, 6.4], [0, -1.65, -0.4]); // cargo bay
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) part(g, BOX, steel, [0.12, 0.8, 1.2], [s * 1.75, -1.6, -2.7 + i * 1.7]); // bay hatches
  pulse.push(part(g, BOX, glow(0xff5a2a, 0.8), [2.4, 0.1, 5.0], [0, -2.3, -0.4])); // drop light
  part(g, CYL, grey, [0.07, 2.2, 0.07], [2.5, -0.6, 7.6], [HALF, 0, 0]); // the light cannon
}

/** Fallen: a Skiff. A long tan hull with a bulbous prow, two tall tail sails, a teal underbelly rail on struts, ring thrusters and purple house banners. */
function buildFallen(g, pulse) {
  const tan = lit(0xc89a5a, 0.85, 0.15), orange = lit(0xb5702f, 0.85, 0.2), teal = lit(0x3f7f8a, 0.5, 0.6), rust = lit(0x5a4636, 0.9, 0.3), dark = lit(0x2a2a2e, 0.7, 0.4), purple = lit(0x8a5bd8, 0.8, 0);
  part(g, BOX, tan, [2.4, 1.5, 11], [0, 0, 0]); // main hull
  part(g, BOX, tan, [1.2, 1.0, 9], [0, 0.1, -9.5]); // tapering tail boom
  part(g, SPH, orange, [1.7, 1.35, 2.9], [0, 0.1, 6.4]); // bulbous prow
  part(g, BOX, dark, [1.5, 0.9, 1.4], [0, 0.2, 8.4]); // open mouth
  part(g, BOX, rust, [1.5, 0.7, 4.4], [0, 1.0, 1.6]); // dorsal canopy
  for (let i = 0; i < 9; i++) pulse.push(part(g, BOX, glow(0xff8a3a), [0.14, 0.14, 0.14], [0, 1.45, -8 + i * 1.5])); // string lights
  for (const s of [-1, 1]) {
    part(g, CONE, orange, [0.12, 5.4, 2.4], [s * 2.2, 2.6, -6.4], [0, 0, s * -0.1]); // the two tail sails
    part(g, BOX, rust, [0.22, 0.22, 3.4], [s * 2.2, 0.3, -6.4]);
    part(g, CYL, dark, [0.05, 3.2, 0.05], [s * 2.2, 5.6, -6.4]); // masts
    pulse.push(part(g, SPH, glow(0xff4a2a), [0.14, 0.14, 0.14], [s * 2.2, 7.2, -6.4]));
    part(g, BOX, purple, [0.05, 1.1, 3.8], [s * 2.2, 5.0, -9.2]); // banners off the sails
    part(g, BOX, teal, [0.28, 0.28, 13], [s * 1.5, -1.9, -1.2]); // underbelly rails
    for (const z of [-6, -2, 2]) part(g, BOX, dark, [0.14, 1.4, 0.14], [s * 1.2, -1.2, z], [0, 0, s * 0.3]); // rail struts
    part(g, CYL, teal, [0.85, 1.5, 0.85], [s * 0.9, -1.05, -3.6], [HALF, 0, 0]); // ring thrusters
    pulse.push(part(g, CYL, glow(0xff5a2a), [0.7, 0.14, 0.7], [s * 0.9, -1.05, -4.4], [HALF, 0, 0]));
    pulse.push(part(g, CONE, glow(0xff8a4a, 0.45), [0.6, 2.4, 0.6], [s * 0.9, -1.05, -5.7], [-HALF, 0, 0]));
    part(g, CYL, dark, [0.05, 4.6, 0.05], [s * 1.6, -2.6, -8.6], [0.9, 0, s * 0.15]); // trailing masts, red tips
    pulse.push(part(g, SPH, glow(0xff4a2a), [0.14, 0.14, 0.14], [s * 1.9, -4.5, -10.7]));
    part(g, CYL, dark, [0.05, 3.4, 0.05], [s * 2.5, 2.3, 2.4]); // forward whip masts
    pulse.push(part(g, SPH, glow(0xff4a2a), [0.12, 0.12, 0.12], [s * 2.5, 4.0, 2.4]));
  }
  part(g, BOX, purple, [0.05, 0.9, 5], [0, 0.5, -15]); // long tail streamer
  part(g, BOX, purple, [0.05, 1.0, 3], [0.2, 2.4, 3.8], [0, 0.3, 0]); // dorsal flags
  for (let i = 0; i < 4; i++) part(g, CYL, teal, [0.42, 0.9, 0.42], [0, -1.1, -2.4 + i * 1.5]); // ether tanks between the rails
  pulse.push(part(g, BOX, glow(0x7fd8ff, 0.7), [1.3, 0.1, 4.2], [0, -1.65, 0.4])); // drop bay light
}

/** Hive: a Tombship. A vast dark slab: a wide ribbed bar across the front, a heavy stem behind it, organ-pipe ribs hanging underneath, green lamps. */
function buildHive(g, pulse) {
  const slab = lit(0x625b52, 0.9, 0.3), brown = lit(0x74695b, 0.9, 0.25), dark = lit(0x34302c, 0.95, 0.2), rib = lit(0x4d463f, 0.9, 0.3);
  part(g, BOX, slab, [22, 2.2, 4.2], [0, 0, 5.4]); // the wide bar
  part(g, BOX, slab, [7.6, 3.2, 13], [0, 0.2, -2.4]); // the heavy stem
  for (const s of [-1, 1]) part(g, BOX, brown, [6.2, 2.4, 3.4], [s * 6.2, 0, 1.2], [0, s * 0.6, 0]); // shoulders joining bar and stem
  for (const s of [-1, 1]) part(g, CONE, dark, [1.1, 3.4, 1.1], [s * 11.9, 0, 5.4], [0, 0, -s * HALF]); // wing tips
  for (let i = 0; i < 13; i++) part(g, BOX, rib, [0.55, 0.7, 0.9], [-10.2 + i * 1.7, 1.45, 5.4]); // ribbed rim on the bar
  for (let i = 0; i < 6; i++) part(g, BOX, rib, [8.0, 0.35, 0.5], [0, 1.85, -7.6 + i * 1.9]); // ridges along the stem
  part(g, BOX, brown, [5.6, 0.9, 8], [0, 1.95, -3.2]); // top plate
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) part(g, BOX, dark, [0.55, 2.8, 0.55], [s * 2.5, -2.5, -8.4 + i * 1.5]); // organ-pipe ribs under the stem
  for (let i = 0; i < 3; i++) part(g, BOX, rib, [20, 0.5, 0.5], [0, -1.3, 3.8 + i * 1.3]); // ribs under the bar
  pulse.push(part(g, BOX, glow(0x9dff5a, 0.8), [3.2, 0.12, 8], [0, -2.0, -2.2])); // the maw: where the troops come out
  for (let i = 0; i < 6; i++) pulse.push(part(g, SPH, glow(0x9dff5a), [0.4, 0.4, 0.4], [-8 + i * 3.2, 0.2, 7.55])); // lamps on the bar's face
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) pulse.push(part(g, SPH, glow(0x9dff5a), [0.36, 0.36, 0.36], [s * 3.85, 0.6, -7 + i * 3.2])); // lamps on the stem
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
const SHIP_SCALE = { cabal: 1.1, fallen: 0.95, hive: 0.9, scorn: 1.15 };

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

