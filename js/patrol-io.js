// U17e: the Io patrol zone (docs/reference/README.md, "Io patrol zone"). A barren green moon of layered mesas and canyons joined by dirt roads (the Sparrow routes, all laid on the
// terrain). From the Lost Oasis landing the Spine road runs north between two mesas to the Gate canyon, where it climbs a long ramp to the Pyramidion; side roads lead west to the White
// Tree canyon and Terrabase Charon (with the Taken blight beside it), and east to Giant's Scar and the Red Legion base. The Pyramidion is enterable: a 140 m hall under a 76 m roof,
// reached on foot through its south gate, with two stairways and a terraced pit under a red core. The Cabal base has walkable interiors (hangar, command hall, barracks, corridors).
// Heights: everything stands on the terrain (js/patrol-data.js IO_TERRAIN); the Pyramidion's main floor is the terrain at IO.pit and its two stairways are terrain ramps with stone laid on top.
// Rule for this map: everything walked on stands on the terrain under it; roads are laid in short pitched pieces that follow it; parapets are skirted down to the ground.
import * as THREE from 'three';
import { PATROL_DATA, IO } from './patrol-data.js';
import { IO_KIT as IK } from './level-io.js';
import { MARS_KIT as MK } from './level-mars.js';
import { hall as kitHall, desk, console_, shelf } from './patrol-kit.js';

const { VW, VW2, VB, VBR, MILK, VRED, TEAL, SULF, CAB, CAB2, CAB3, HAZ, HAZR, CONC, CONC2, STEEL, TAKEN, TAKENG } = IK.C;
const TAU = Math.PI * 2;
const INT = [0x44586a, 0x384a5a, 0x546a7e], INTL = 0x7a91a4, INTF = 0x6a7f8e;          // the dark blue-grey stone inside the Pyramidion
const EXT = [0x8d877a, 0x7b766a, 0x9f998b], EXTD = 0x6a665c;                           // the warm grey stone outside
const DIRT = 0xa68a5a, DIRTE = 0xc6b078, PALE = 0xd8d1bb, PALE2 = 0xbdb59c, MOSS = [0x4f8f86, 0x6fa597, 0x3f7a72], SAND = 0xe2d6a8, DARKR = 0x3b3a33;
const CP = { body: CAB2, top: CAB, screen: HAZ, shelf: CAB2, shelfTop: CAB };         // Cabal furniture
const CAB_HALL = { color: CAB, roofColor: CAB2, ceil: 0x3a332e, lamp: HAZ, windows: false };

// ------------------------------------------------------------------ helpers

/** A box with its base at an absolute height y0 (no ground lift). Not solid unless asked. */
const ab = (K, x, y0, z, w, h, d, color, o = {}) => K.box(x, z, w, h, d, color, { y: y0, abs: true, collide: o.collide ?? false, glow: o.glow });
/** A visual box centred at an absolute height, any rotation. */
const vb = (K, x, y, z, w, h, d, color, o = {}) => IK.vabs(K, x, y, z, w, h, d, color, o);
const pick = (K, a) => K.RP(a);
/** A thin bar from one point to another (arms, stays), merged with the scenery. */
function beam(K, x0, y0, z0, x1, y1, z1, t, color, o = {}) {
  const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, t, L), K.mat(color, o.glow));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.lookAt(x1, y1, z1);
  m.castShadow = true;
  K.scene.add(m);
}
/** A rounded rock boulder of one tone, sitting on the ground. */
function boulder(K, x, z, s, color, o = {}) {
  const sy = o.sy ?? K.R(0.55, 0.9);
  K.mesh(new THREE.DodecahedronGeometry(s, 0), color, x, s * sy * 0.45, z, { scale: [K.R(0.9, 1.25), sy, K.R(0.9, 1.25)], ry: K.R(0, TAU), collide: o.collide === false ? false : 0.75 });
}

// ------------------------------------------------------------------ roads (laid on the terrain: short pieces pitched to the slope under each)

const ROADS = [];
/** A dirt road along `pts`: pale cairns on both edges every so often. Recorded so scenery keeps off it. */
function road(K, pts, w = 8, kind = 'dirt') {
  ROADS.push({ pts, w });
  const color = kind === 'cabal' ? 0x3a332e : DIRT, edge = kind === 'cabal' ? HAZ : DIRTE;
  let run = 5;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], L = Math.hypot(x1 - x0, z1 - z0), nx = -(z1 - z0) / L, nz = (x1 - x0) / L;
    IK.tstrip(K, x0, z0, x1, z1, w, color, { y: 0.1, h: 0.08 });
    for (let d = run; d < L; d += 10) for (const s of [-1, 1]) {
      const x = x0 + (x1 - x0) * d / L + nx * s * (w / 2 + 0.5), z = z0 + (z1 - z0) * d / L + nz * s * (w / 2 + 0.5);
      if (kind === 'cabal') { K.box(x, z, 0.5, 0.9, 0.5, CAB2); K.box(x, z, 0.6, 0.15, 0.6, HAZ, { y: 0.9, collide: false, glow: 1.6 }); } else K.box(x, z, 0.7, 0.45, 0.7, edge, { collide: false });
    }
    run = 10 - ((L - run) % 10);
  }
}
/** Distance from (x, z) to the nearest road (minus its half width). */
const roadDist = (x, z) => {
  let best = Infinity;
  for (const { pts, w } of ROADS) for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], dx = x1 - x0, dz = z1 - z0, t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t)) - w / 2);
  }
  return best;
};

// ------------------------------------------------------------------ the natural world

/** Mossy teal rock: a boulder with a lighter cap. */
function mossRock(K, x, z, s) {
  boulder(K, x, z, s, pick(K, MOSS));
  K.mesh(new THREE.DodecahedronGeometry(s * 0.62, 0), 0x86b9a6, x + s * 0.15, s * 0.75, z, { collide: false });
}
/** A layered mesa rim: stacked pale slabs, each a little smaller, lying on the ground (cover and the layered look). */
function slabStack(K, x, z, w, d, n = 3) {
  for (let i = 0; i < n; i++) K.box(x + K.R(-0.6, 0.6), z + K.R(-0.6, 0.6), w * (1 - i * 0.22), 0.7, d * (1 - i * 0.22), i % 2 ? 0x9aa05a : 0xa9b062, { y: i * 0.7 });
}
/** A dark rock spire. */
function darkSpire(K, x, z, h) {
  K.cone(x, z, h * 0.16, h, DARKR, { sides: 5 });
  K.cone(x + h * 0.1, z + h * 0.05, h * 0.09, h * 0.62, 0x4a4940, { sides: 4, collide: false });
}
/** Scatters `fn` over a rectangle, away from roads. */
function scatter(K, x0, x1, z0, z1, n, fn, keep = 7) {
  let tries = 0;
  for (let i = 0; i < n && tries < n * 6; tries++) {
    const x = K.R(x0, x1), z = K.R(z0, z1);
    if (roadDist(x, z) < keep) continue;
    fn(x, z); i++;
  }
}

/** The Lost Oasis: a still lake, the huge pale petrified tree on its far shore with twisted roots, a rock arch over the east road, and mossy teal rock. */
function oasis(K) {
  const LX = -48, LZ = 150;
  K.mesh(new THREE.CylinderGeometry(23.6, 23.6, 0.06, 32), 0x4aa4a8, LX, 2.9 - K.ground(LX, LZ), LZ, { glow: 0.4 });
  for (let i = 0; i < 26; i++) { const a = K.R(0, TAU), r = K.R(24, 31); const x = LX + Math.cos(a) * r, z = LZ + Math.sin(a) * r; if (z < 176 - 6 && roadDist(x, z) > 6) mossRock(K, x, z, K.R(0.8, 2.2)); }
  for (const [x, z] of [[-30, 132], [-70, 128], [-78, 160], [-20, 168]]) mossRock(K, x, z, 2.8);
  // the petrified tree: a vast pale trunk that splits into four limbs, a crown of snapped branches, twisted roots splaying from its foot
  const TX = -64, TZ = 114;
  K.cyl(TX, TZ, 7.4, 30, PALE, { r2: 5.0, sides: 9 });
  K.cyl(TX, TZ, 8.6, 5, PALE2, { r2: 7.4, sides: 9, collide: false });
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + 0.4, lean = 0.5 + 0.12 * (i % 2);
    K.mesh(new THREE.CylinderGeometry(1.4, 3.0, 24, 6), i % 2 ? PALE : PALE2, TX + Math.cos(a) * 8, 30 + 8, TZ + Math.sin(a) * 8, { rz: -Math.cos(a) * lean, rx: Math.sin(a) * lean, collide: false });
    K.mesh(new THREE.CylinderGeometry(0.5, 1.2, 14, 5), PALE2, TX + Math.cos(a) * 17, 53, TZ + Math.sin(a) * 17, { rz: -Math.cos(a) * 1.1, rx: Math.sin(a) * 1.1, collide: false });
  }
  for (let i = 0; i < 9; i++) {
    const a = i * TAU / 9 + K.R(-0.2, 0.2), r1 = 12, r2 = 24;
    const bx = TX + Math.cos(a) * r1, bz = TZ + Math.sin(a) * r1, ex = TX + Math.cos(a + 0.35) * r2, ez = TZ + Math.sin(a + 0.35) * r2;
    K.mesh(new THREE.BoxGeometry(3.4, 2.6, 16), pick(K, [PALE, PALE2]), bx, 1.1, bz, { ry: -a - 0.1 + Math.PI / 2 * 0, collide: false });
    K.mesh(new THREE.BoxGeometry(2.4, 1.8, 14), pick(K, [PALE, PALE2]), (bx + ex) / 2 + Math.cos(a + 0.2) * 3, 0.8, (bz + ez) / 2 + Math.sin(a + 0.2) * 3, { ry: -(a + 0.35) + 0.2, collide: false });
  }
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.7; mossRock(K, TX + Math.cos(a) * K.R(14, 20), TZ + Math.sin(a) * K.R(14, 20), K.R(1.4, 2.6)); }
  // the arch over the east road
  const AX = 46, AZ = 144;
  for (const s of [-1, 1]) { K.box(AX + s * 9, AZ, 6, 16, 8, PALE2); K.box(AX + s * 9, AZ, 7, 3, 9, pick(K, MOSS), { y: 0, collide: false }); }
  K.box(AX, AZ, 28, 4, 8.4, PALE, { y: 14 });
  K.box(AX, AZ, 20, 3, 7, PALE2, { y: 11, collide: false });
  for (const [dx, dy] of [[-7, 0], [7, 0], [0, 1.5]]) K.box(AX + dx, AZ + 0.2, 6, 1.4, 7.6, pick(K, MOSS), { y: 17.6 + dy, collide: false });
  // the landing: a ring of dressed stones round the Guardian's feet
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; K.box(Math.cos(a) * 9, 156 + Math.sin(a) * 9, 1.2, 0.5, 1.2, PALE, { collide: false }); }
  K.mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.1, 20), 0x7e8a64, 0, 0.1, 156, { collide: false });
}

/** The mesas: layered strata slabs on the tops, boulders on the shelves and rim rock on the canyon floors. */
function mesas(K) {
  for (const sx of [-1, 1]) {
    for (const [x, z] of [[78, 98], [64, 104], [92, 80], [58, 72], [90, 56], [70, 48]]) slabStack(K, sx * x, z, K.R(5, 9), K.R(4, 7));
    scatter(K, sx * 40, sx * 106, 44, 108, 9, (x, z) => boulder(K, x, z, K.R(1.2, 2.8), pick(K, [0x8d9658, 0x7b8450, 0x9aa261])), 8);
    for (const [x, z, r, h] of [[36, 40, 3, 11], [40, 112, 3.2, 12], [112, 60, 3.6, 12]]) IK.cliff(K, sx * x, z, r, h);
    for (const [x, z] of [[54, -10], [80, -44], [60, -52]]) darkSpire(K, sx * x, z, K.R(8, 14));
    scatter(K, sx * 44, sx * 92, -50, -10, 5, (x, z) => boulder(K, x, z, K.R(1.2, 2.4), pick(K, [0x8d9658, 0x7b8450])), 7);
  }
  scatter(K, -40, 40, 30, 130, 14, (x, z) => boulder(K, x, z, K.R(0.9, 2.2), pick(K, [0x8d9658, 0x9aa261, 0x7b8450])), 9);
  scatter(K, -100, 100, -10, 38, 14, (x, z) => boulder(K, x, z, K.R(0.9, 2.2), pick(K, [0x8d9658, 0x9aa261, 0x7b8450])), 9);
  for (const [x, z, h] of [[-44, 8, 11], [46, 6, 9], [-30, -4, 8], [30, -4, 10]]) darkSpire(K, x, z, h);
}

/** The Gate canyon: a Vex gate standing in the canyon (the incursion event), milky channels and a few stone cubes. */
function gateCanyon(K) {
  const GX = 17, GZ = 2;
  for (const s of [-1, 1]) IK.vexPillar(K, GX, GZ + s * 7, 12, { w: 2 });
  K.mesh(new THREE.TorusGeometry(6.6, 0.7, 6, 22), VB, GX, 7.4, GZ, { ry: Math.PI / 2, collide: false });
  K.mesh(new THREE.TorusGeometry(5.6, 0.3, 4, 22), VW, GX, 7.4, GZ, { ry: Math.PI / 2, collide: false });
  K.mesh(new THREE.CircleGeometry(5.3, 22), MILK, GX + 0.05, 7.4, GZ, { ry: Math.PI / 2, glow: 0.9 });
  K.mesh(new THREE.OctahedronGeometry(0.9, 0), VRED, GX, 14.4, GZ, { glow: 2.4 });
  K.box(GX, GZ, 3, 1.2, 15, VBR);
  K.light(GX - 1, 8, GZ, MILK, 9, 34);
  for (const [x, z, s] of [[-14, 14, 1.6], [-20, -4, 1.4], [12, 20, 1.3], [-8, -10, 1.2]]) IK.vexCube(K, x, 0, z, s);
  for (let k = 0; k < 6; k++) { const a = k * TAU / 6; IK.tstrip(K, 0 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, Math.cos(a) * 15, 8 + Math.sin(a) * 15, 0.5, MILK, { y: 0.14, glow: 1.2 }); }
  IK.vexPillar(K, -22, 18, 8, { w: 1.6 }); IK.vexPillar(K, 24, 20, 7, { w: 1.6 });
}

/** The White Tree canyon: a woven white tree glowing at its crown, sand, dark rock spires and a stream. */
function whiteTree(K) {
  const X = -160, Z = 6;
  K.cyl(X, Z, 5.6, 3.4, 0xe9e6d8, { r2: 4.2, sides: 10 });
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6, tw = 0.16 + (i % 2) * 0.06;
    K.mesh(new THREE.CylinderGeometry(0.9, 1.4, 30, 6), i % 2 ? 0xf6f3e6 : 0xe4e0cf, X + Math.cos(a) * 1.9, 18, Z + Math.sin(a) * 1.9, { rz: -Math.cos(a + 1.2) * tw, rx: Math.sin(a + 1.2) * tw, collide: false });
  }
  K.cyl(X, Z, 3.2, 30, 0xf2efe2, { r2: 2.4, sides: 8 });
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 + 0.3;
    K.mesh(new THREE.CylinderGeometry(0.35, 0.8, 14, 5), 0xf6f3e6, X + Math.cos(a) * 6, 36, Z + Math.sin(a) * 6, { rz: -Math.cos(a) * 0.9, rx: Math.sin(a) * 0.9, collide: false });
  }
  K.mesh(new THREE.IcosahedronGeometry(6.5, 1), 0xfff2b8, X, 41, Z, { glow: 1.1, collide: false });
  K.mesh(new THREE.IcosahedronGeometry(3.4, 0), 0xffffff, X, 41, Z, { glow: 1.8, collide: false });
  K.light(X, 40, Z, 0xfff0c0, 14, 70);
  for (let i = 0; i < 9; i++) { const a = i * TAU / 9; K.mesh(new THREE.BoxGeometry(2.6, i % 2 ? 1.7 : 1.6, 13), i % 2 ? 0xf0ecdc : 0xe0dcc8, X + Math.cos(a) * 9, 0.6, Z + Math.sin(a) * 9, { ry: -a, collide: false }); }
  // sand
  for (const [x, z, w, d] of [[-146, 22, 22, 14], [-172, -14, 26, 16], [-140, -8, 18, 12], [-186, 20, 16, 12], [-122, 6, 14, 10]]) IK.flat(K, x, z, w, d, SAND, { y: 0.08, h: 0.1 });
  // the stream, from the canyon head to the south wall
  IK.tcrack(K, [[-122, -30], [-136, -14], [-146, 14], [-170, 24], [-190, 34]], 3.4, 0x7fd0e0, { y: 0.12, glow: 0.4 });
  for (const [x, z, h] of [[-128, -22, 13], [-186, -24, 15], [-120, 36, 11], [-178, 36, 14], [-196, 4, 16], [-150, -28, 10], [-134, 34, 9]]) darkSpire(K, x, z, h);
  scatter(K, -194, -118, -26, 38, 10, (x, z) => boulder(K, x, z, K.R(1, 2.2), pick(K, [0x8d9658, 0x6a6a5a])), 8);
}

// ------------------------------------------------------------------ Giant's Scar

/** Giant's Scar: the Cabal's great drill column in its ringed base, braced by a crane arm, on flat sulfur slabs. */
function scar(K) {
  const X = 142, Z = 12, TOP = 38;
  for (const [dx, dz, w, d, h] of [[-22, -10, 11, 8, 0.5], [20, -14, 9, 7, 0.7], [-14, 18, 12, 9, 0.5], [24, 14, 8, 8, 0.6], [-26, 10, 8, 6, 0.9], [4, -22, 10, 6, 0.5], [12, 24, 9, 7, 0.4], [-4, 26, 7, 6, 0.8]]) {
    K.box(X + dx, Z + dz, w, h, d, pick(K, [SULF, 0xd8c23c, 0xe9d86a]), { collide: false });
  }
  // the ringed base
  K.cyl(X, Z, 12.5, 0.5, CAB3, { sides: 16, collide: false });
  K.cyl(X, Z, 10.5, 0.7, CAB2, { sides: 16, y: 0.5, collide: false });
  K.mesh(new THREE.TorusGeometry(11.6, 0.35, 5, 28).rotateX(Math.PI / 2), HAZ, X, 0.9, Z, { glow: 1.5 });
  K.mesh(new THREE.TorusGeometry(8.5, 0.25, 5, 24).rotateX(Math.PI / 2), 0xff6a24, X, 1.5, Z, { glow: 1.8 });
  K.mesh(new THREE.CylinderGeometry(7.4, 7.4, 0.9, 16), 0xff5a1a, X, 1.3, Z, { glow: 1.4, collide: false });
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2; IK.hazardPost(K, X + Math.cos(a) * 14.5, Z + Math.sin(a) * 14.5, 4); }
  // the column: stacked drums, dark and gold, a collar and the great crown
  const segs = [[4.6, 5, CAB3], [4.4, 4, 0xc99a2a], [4.7, 5, CAB2], [4.4, 4, CAB3], [4.6, 5, 0xc99a2a], [4.3, 5, CAB2], [4.6, 4, CAB3], [4.4, 5, 0xc99a2a]];
  let y = 1.2;
  for (const [r, h, c] of segs) { K.cyl(X, Z, r, h, c, { y, sides: 10, collide: y < 6 ? 0.9 : false }); K.mesh(new THREE.CylinderGeometry(r + 0.25, r + 0.25, 0.5, 10), STEEL, X, y + h, Z, { collide: false }); y += h; }
  K.cyl(X, Z, 9.5, 5.5, CAB, { y: TOP - 2, sides: 12, r2: 7.5, collide: false });
  K.mesh(new THREE.TorusGeometry(8.4, 0.5, 5, 26).rotateX(Math.PI / 2), HAZ, X, TOP + 2.6, Z, { glow: 1.6 });
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6; K.mesh(new THREE.BoxGeometry(2.4, 3.4, 2.4), 0xe8a838, X + Math.cos(a) * 6.5, TOP + 3.4, Z + Math.sin(a) * 6.5, { ry: -a, glow: 0.9, collide: false }); }
  K.mesh(new THREE.CylinderGeometry(3.6, 4.2, 5, 10), CAB2, X, TOP + 8, Z, { collide: false });
  K.light(X, 20, Z, 0xffa040, 12, 50);
  K.light(X, 4, Z, 0xff6a24, 10, 30);
  // the crane arm: a lattice mast on the east side and a great jib braced against the column crown
  const CX = 168, CZ = 24;
  K.box(CX, CZ, 3.4, 30, 3.4, CAB3);
  for (let yy = 3; yy < 30; yy += 3.5) K.mesh(new THREE.BoxGeometry(4, 0.3, 4), HAZ, CX, yy, CZ, { glow: yy % 7 < 3.5 ? 0.6 : 0, collide: false });
  beam(K, CX, K.ground(CX, CZ) + 30, CZ, X + 7, K.ground(X, Z) + TOP + 1, Z + 1, 1.6, CAB2);
  beam(K, CX + 3, K.ground(CX, CZ) + 24, CZ + 2, X + 6, K.ground(X, Z) + TOP - 2, Z + 3, 0.7, CAB3);
  beam(K, CX, K.ground(CX, CZ) + 33, CZ, CX + 14, K.ground(CX, CZ) + 22, CZ + 10, 0.5, STEEL);
  K.mesh(new THREE.BoxGeometry(5, 4, 5), CAB, CX, 31.5, CZ, { collide: false });
  K.mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), HAZR, CX, 34.5, CZ, { glow: 2.4, collide: false });
  // the camp round the base: crates, supplies, a landed dropship, floodlights, a gun nest
  MK.supply(K, X - 22, Z + 20, false); MK.supply(K, X + 18, Z + 24, true); MK.supply(K, X - 28, Z - 4, true); MK.supply(K, X + 26, Z - 6, false);
  IK.dropship(K, X - 8, 0.3, Z - 26, 14);
  K.box(X - 8, Z - 26, 6, 3, 14, CAB2, { collide: true });
  IK.gunNest(K, X + 24, Z - 20, Math.PI * 0.2);
  for (const [dx, dz, ry] of [[-18, 8, 0.5], [16, 10, -0.5], [-6, -22, 1.2]]) IK.floodlight(K, X + dx, Z + dz, 6, ry);
  // scrap and layered rock round the pad (a canyon wall behind)
  for (const [x, z] of [[116, -10], [122, 34], [172, 42], [176, -6]]) IK.cliff(K, x, z, 3.4, 11);
}

// ------------------------------------------------------------------ the Red Legion base

/** A Cabal watchtower: a solid armoured block with stairs and a lit crown. */
function watchtower(K, x, z, h = 8, stairs = ['s']) {
  K.platform(x, z, 6, 6, h, { stairs, stairW: 2.6, color: CAB2, stairColor: CAB });
  MK.vbox(K, x, h + 0.2, z, 6.4, 0.4, 6.4, CAB3, {});
  fixture(K, x, h + 1.1, z, 9);
}
/** A Cabal fixture: a hazard-orange lamp that lights what is round it. y is above the ground. */
function fixture(K, x, y, z, power = 8) {
  K.box(x, z, 0.6, 0.3, 0.6, HAZ, { y, collide: false, glow: 2.2 });
  K.light(x, y - 0.4, z, 0xffa040, power, 24);
}
const hall = (K, cx, cz, w, d, h, o = {}) => kitHall(K, cx, cz, w, d, h, { ...CAB_HALL, ...o });

/** The base on its pad (x 100 to 196, z -150 to -50, 8 m up): bulwark walls with a south gate, watchtowers, a courtyard, and a chain of walkable interiors. */
function legionBase(K) {
  IK.flat(K, 148, -100, 92, 96, 0x2c2723, { y: 0.07, h: 0.08 });                // the deck
  // the walls and the gate (a gap in the south wall facing the ramp)
  MK.bulwark(K, 104, -54, 192, -54, 3.8, { face: 1, gaps: [[42, 54]] });
  MK.bulwark(K, 192, -54, 192, -146, 3.8, { face: 1 });
  MK.bulwark(K, 104, -54, 104, -146, 3.8, { face: -1 });
  MK.bulwark(K, 104, -146, 192, -146, 3.8, { face: -1 });
  watchtower(K, 109, -59, 8, ['e']); watchtower(K, 187, -59, 8, ['w']); watchtower(K, 109, -141, 8, ['e']); watchtower(K, 187, -141, 8, ['w']);
  MK.pylon(K, 142, -48, 9); fixture(K, 142, 11, -48, 9); MK.pylon(K, 158, -48, 9); fixture(K, 158, 11, -48, 9);   // the gate pylons
  MK.turret(K, 140, -64, Math.PI / 2); MK.turret(K, 160, -64, Math.PI / 2);
  // the hangar: a broad hall with a ship on its cradle and supplies along the walls
  hall(K, 126, -88, 30, 24, 12, { doors: { s: 12, e: 4 }, lamps: 4, props: (k, cx, cz) => {
    MK.harvester(k, cx - 2, cz - 5, { L: 20, ry: Math.PI / 2, y: 0.4, collide: true });
    MK.supply(k, cx - 12, cz - 9, false); MK.supply(k, cx - 12, cz + 9, true); MK.supply(k, cx + 11, cz - 9, true); k.crate(cx + 10, cz + 9);
    console_(k, cx + 12, cz + 2, CP);
  } });
  fixture(K, 126, 12.6, -76, 9);
  // the corridor from the hangar to the command hall, and the command hall with its consoles and a raised gallery
  hall(K, 152.5, -88, 22.2, 5, 4.6, { doors: { e: 4, w: 4 }, lamps: 3 });
  hall(K, 176, -88, 24, 22, 9, { doors: { w: 4, s: 5, n: 4 }, lamps: 3, props: (k, cx, cz) => {
    for (const x of [-6, -1, 4]) console_(k, cx + x, cz + 2, CP);
    shelf(k, cx + 10, cz, false, CP); desk(k, cx - 6, cz - 6, true, CP);
    k.platform(cx - 7, cz - 8.5, 5, 3.5, 2.2, { stairs: ['e'], stairW: 2.2, color: CAB2, stairColor: CAB });
  } });
  // the corridor north to the barracks, and the barracks
  hall(K, 176, -110, 5, 21.2, 4.6, { doors: { n: 4, s: 4 }, lamps: 3 });
  hall(K, 176, -132, 22, 22, 7, { doors: { s: 4 }, lamps: 3, props: (k, cx, cz) => {
    for (const x of [-7, 0, 7]) { k.box(cx + x, cz - 7, 2.4, 0.9, 1.2, CAB2); k.box(cx + x, cz - 3, 2.4, 0.9, 1.2, CAB2); }
    shelf(k, cx - 10, cz + 4, false, CP); k.crate(cx + 8, cz + 6);
  } });
  // the yard: a landing pad, ships on struts, supplies, a mast, a turret ring
  MK.landingPad(K, 128, -118, 14);
  MK.harvester(K, 128, -118, { L: 18, ry: 0.4, y: 5, collide: true });
  for (const [dx, dz] of [[-3, -7], [3, -7], [-3, 7], [3, 7]]) K.box(128 + dx, -118 + dz, 0.9, 5, 0.9, CAB3);
  MK.supply(K, 118, -62, true); MK.supply(K, 168, -64, false); MK.supply(K, 114, -102, false); MK.supply(K, 152, -124, true); MK.supply(K, 150, -140, false);
  MK.mast(K, 160, -128, 20); MK.pylon(K, 118, -140, 8); fixture(K, 118, 9.6, -140, 8);
  MK.turret(K, 150, -112, -Math.PI / 2); MK.turret(K, 140, -128, -Math.PI / 2);
  fixture(K, 150, 3.4, -112, 8);
  // the beachhead below the gate
  MK.landingPad(K, 168, -26, 14);
  MK.turret(K, 128, -30, Math.PI * 0.9);
}

// ------------------------------------------------------------------ Terrabase Charon and the Taken blight

/** The abandoned base: a curved range of pale blocks on its pad with an arched gate over the ramp, a round landing pad, yellow crates, and Asher Mir's lab. */
function charon(K) {
  const CX = -150, CZ = -150, R0 = 24, N = 10;
  IK.flat(K, -150, -152, 76, 72, 0xb4af9c, { y: 0.07, h: 0.08 });                 // paving
  // the crescent: blocks laid along an arc round the north, windows lit faintly, some broken
  for (let i = 0; i < N; i++) {
    const f = (i + 0.5) / N, phi = Math.PI * 1.08 + f * Math.PI * 0.84, x = CX + Math.cos(phi) * R0, z = CZ + Math.sin(phi) * R0;
    const ry = Math.atan2(-Math.cos(phi), -Math.sin(phi)), broken = i === 2 || i === 7, h = broken ? 5.5 : 8;
    K.obox(x, z, 9.4, h, 6, ry, CONC);
    K.mesh(new THREE.BoxGeometry(9.5, 0.4, 6.2), CONC2, x, h + 0.2, z, { ry, collide: false });
    K.mesh(new THREE.BoxGeometry(8, 1.0, 6.3), broken ? 0x2a2a28 : 0x3b4a50, x, h * 0.55, z, { ry, glow: broken ? 0 : 0.25, collide: false });
    if (!broken) K.mesh(new THREE.BoxGeometry(9.5, 0.3, 6.4), 0xd9b030, x, 1.2, z, { ry, collide: false });
  }
  // the arched gate over the ramp's landing (east side): two piers and a curved lintel
  for (const s of [-1, 1]) { K.box(-122, -150 + s * 8, 3, 11, 3, CONC); K.box(-122, -150 + s * 8, 3.6, 0.8, 3.6, CONC2, { y: 11, collide: false }); }
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.08 + 0.84 * i / 6), zc = -150 + Math.cos(a) * 8, yc = 11 + Math.sin(a) * 3.6;
    K.mesh(new THREE.BoxGeometry(3.2, 1.6, 2.6), CONC, -122, yc + 0.8, zc, { ry: 0, rx: Math.sin(a) * 0.0, collide: false });
  }
  K.box(-122, -150, 3.2, 1.0, 20, CONC2, { y: 14.6, collide: false });
  K.mesh(new THREE.BoxGeometry(0.4, 0.3, 14), 0xd9b030, -120.2, 14.4, -150, { glow: 0.6, collide: false });
  // the round landing pad south of the crescent
  K.mesh(new THREE.CylinderGeometry(12, 12, 0.35, 28), CONC2, -150, 0.18, -128, { collide: false });
  K.mesh(new THREE.TorusGeometry(10.4, 0.3, 4, 30).rotateX(Math.PI / 2), 0xd9b030, -150, 0.4, -128, { collide: false });
  K.mesh(new THREE.TorusGeometry(5.2, 0.22, 4, 24).rotateX(Math.PI / 2), 0xd9b030, -150, 0.4, -128, { collide: false });
  K.mesh(new THREE.BoxGeometry(1.2, 0.12, 8), 0xe8e0c8, -150, 0.42, -128, { collide: false });
  // Asher Mir's lab inside the curve, lit
  kitHall(K, -150, -161, 18, 11, 5.6, { doors: { s: 5 }, doorOffset: { s: 0 }, color: 0xd6d0bc, roofColor: CONC2, ceil: 0xe8e4d0, lamp: 0xffe9b0, lamps: 3, windows: false, props: (k, cx, cz) => {
    desk(k, cx - 5, cz - 3, true, { body: CONC2, top: 0xe8e4d0 }); desk(k, cx + 5, cz - 3, true, { body: CONC2, top: 0xe8e4d0 });
    console_(k, cx - 7.6, cz + 1, { body: CONC2, screen: 0xffd890 }); shelf(k, cx + 8, cz + 2, false, { shelf: CONC2, shelfTop: 0xe8e4d0 });
    k.box(cx, cz - 4.6, 4, 1.0, 1.0, STEEL); k.box(cx, cz - 4.6, 3.6, 0.1, 0.8, 0xffd890, { y: 1.0, collide: false, glow: 1.4 });
  } });
  // the abandoned yard: yellow crates, a toppled cart, rubble
  for (const [x, z, r] of [[-168, -122, 0], [-166, -124, 0.4], [-132, -120, 0.2], [-134, -118, 0], [-170, -138, 0.7], [-130, -140, 0], [-176, -156, 0.3]]) K.obox(x, z, 2.2, 1.6, 2.2, r, 0xd9b030);
  for (const [x, z] of [[-142, -140], [-160, -142], [-124, -166], [-176, -170]]) boulder(K, x, z, K.R(1.2, 2.0), 0xc9bf80);
  K.light(-150, 4.4, -161, 0xffe9b0, 8, 26);
}

/** The Taken blight: a black sphere crackling white over sulfur rocks, with black spikes and a pale glow. Beside Terrabase Charon. */
function blight(K) {
  const X = -148, Z = -92, Y = 9;
  K.mesh(new THREE.IcosahedronGeometry(6.2, 1), TAKEN, X, Y, Z, { collide: false });
  K.mesh(new THREE.IcosahedronGeometry(7.0, 0), 0x1a1a24, X, Y, Z, { rx: 0.4, ry: 0.7, collide: false, scale: [1, 0.94, 1] });
  for (let i = 0; i < 3; i++) K.mesh(new THREE.TorusGeometry(8.4 + i * 1.6, 0.18, 4, 30), TAKENG, X, Y, Z, { rx: 0.6 + i * 0.9, ry: i * 1.1, glow: 1.8, collide: false });
  for (let i = 0; i < 16; i++) {
    const a = K.R(0, TAU), b = K.R(-1.0, 1.0), r = K.R(6.4, 12.5), len = K.R(3, 8);
    const x = X + Math.cos(a) * Math.cos(b) * r, y = Y + Math.sin(b) * r, z = Z + Math.sin(a) * Math.cos(b) * r;
    beam(K, x, y, z, x + K.R(-3, 3), y + K.R(-2, 3) * len / 4, z + K.R(-3, 3), 0.14, 0xe6f0ff, { glow: 2.2 });
  }
  K.mesh(new THREE.CylinderGeometry(2.4, 5.4, 6, 8), TAKEN, X, 2.6, Z, { collide: false });
  for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + 0.2, r = 9 + K.R(0, 3); K.cone(X + Math.cos(a) * r, Z + Math.sin(a) * r, 0.9, K.R(3, 6), TAKEN, { sides: 4, collide: false, rx: Math.sin(a) * 0.4, rz: -Math.cos(a) * 0.4 }); }
  for (let i = 0; i < 18; i++) { const a = K.R(0, TAU), r = K.R(9, 24); boulder(K, X + Math.cos(a) * r, Z + Math.sin(a) * r, K.R(1.2, 3), pick(K, [0xd8cc7a, 0xc9bd68, 0xe6dc9a])); }
  K.light(X, Y + 1, Z, 0xcfe0ff, 14, 56);
  K.light(X, 3, Z, 0xa8b8ff, 8, 30);
}

// ------------------------------------------------------------------ the Pyramidion

const PY = { x0: -70, x1: 70, z0: -230, z1: -90, cz: -160, wall: 8, wallTop: 56, apex: 82 };    // interior footprint (140 m square), wall thickness, roof heights (absolute)
const FLOOR = IO.pit;

/** A stone block at absolute heights, solid or not, in the interior stone. */
const stone = (K, x0, y0, z0, x1, y1, z1, color, collide = true) => ab(K, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, { collide });

/** A stairway laid on its terrain ramp: stone on the walking surface, a dressed fascia down to the floor, and parapets on both edges. Points are [x, z] along the run. */
function stairway(K, p0, p1, w) {
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.ceil(L / 3), ux = (p1[0] - p0[0]) / L, uz = (p1[1] - p0[1]) / L, nx = -uz, nz = ux;
  const alongX = Math.abs(ux) > Math.abs(uz);
  IK.tstrip(K, p0[0], p0[1], p1[0], p1[1], w - 0.4, INTF, { y: 0.1, h: 0.08 });
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, xa = p0[0] + (p1[0] - p0[0]) * t0, za = p0[1] + (p1[1] - p0[1]) * t0, xb = p0[0] + (p1[0] - p0[0]) * t1, zb = p0[1] + (p1[1] - p0[1]) * t1;
    const xm = (xa + xb) / 2, zm = (za + zb) / 2, top = Math.min(K.ground(xa, za), K.ground(xb, zb)), sl = L / n;
    // the fascia: a block from the floor up to the low end of this piece, the width of the stairway and a little more
    if (top > FLOOR + 0.3) for (const s of [-1, 1]) ab(K, xm + nx * s * (w / 2 + 0.55), FLOOR, zm + nz * s * (w / 2 + 0.55), alongX ? sl + 0.1 : 1.1, top - FLOOR, alongX ? 1.1 : sl + 0.1, INT[i % 3]);
    for (const s of [-1, 1]) K.box(xm + nx * s * (w / 2 - 0.35), zm + nz * s * (w / 2 - 0.35), alongX ? sl : 0.7, 1.3, alongX ? 0.7 : sl, INT[(i + 1) % 3]);
  }
  // glowing seams along both edges of the surface
  for (const s of [-1, 1]) IK.tstrip(K, p0[0] + nx * s * (w / 2 - 0.9), p0[1] + nz * s * (w / 2 - 0.9), p1[0] + nx * s * (w / 2 - 0.9), p1[1] + nz * s * (w / 2 - 0.9), 0.2, MILK, { y: 0.2, h: 0.06, glow: 1.5 });
}

/** The Pyramidion's shell: four walls from the pit floor to the roof line (the south wall has the gate), the stepped outer courses, and the glow under the block. */
function shell(K) {
  const { x0, x1, z0, z1, wall: T, wallTop: H } = PY;
  const L = x1 - x0 + 2 * T;
  stone(K, x0 - T, 0, z0 - T, x0, H, z1 + T, EXT[0]);                    // west
  stone(K, x1, 0, z0 - T, x1 + T, H, z1 + T, EXT[0]);                    // east
  stone(K, x0, 0, z0 - T, x1, H, z0, EXT[1]);                            // north
  stone(K, x0, 0, z1, -6, H, z1 + T, EXT[2]);                            // south, west of the gate
  stone(K, 6, 0, z1, x1, H, z1 + T, EXT[2]);                             // south, east of the gate
  stone(K, -6, IO.plinth + 14, z1, 6, H, z1 + T, EXT[2]);                // the lintel above the gate
  // the gate: a frame of dressed stone with lit seams, and the floor of the passage
  ab(K, -6.75, IO.plinth, z1 + T / 2, 1.7, 14.4, T + 1.2, EXT[1], { collide: true }); ab(K, 6.75, IO.plinth, z1 + T / 2, 1.7, 14.4, T + 1.2, EXT[1], { collide: true });
  ab(K, 0, IO.plinth + 14, z1 + T + 0.3, 16, 1.6, 1.6, EXT[1]);
  for (const s of [-1, 1]) ab(K, s * 5.9, IO.plinth, z1 + T + 0.6, 0.3, 13.6, 0.3, MILK, { glow: 1.6 });
  ab(K, 0, IO.plinth + 13.2, z1 + T + 0.6, 12, 0.3, 0.3, MILK, { glow: 1.6 });
  IK.tstrip(K, 0, z1 + T + 6, 0, z1 - 12, 11, INTF, { y: 0.1, h: 0.08 });
}

/** The roof: four huge slabs, two sloping along z and two along x, crossing over the middle (the inside of the hall; outside, the tilted block hides it). */
function roof(K) {
  const { x0, x1, z0, z1, wallTop: H, apex: A, cz } = PY, run = (z1 - z0) / 2 + PY.wall, rise = A - H, len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
  for (const s of [-1, 1]) {
    // the slabs along x (sloping in z), thick, with a lit seam on their undersides
    vb(K, 0, (H + A) / 2 + 2.4, cz + s * run / 2, (x1 - x0) + 2 * PY.wall + 4, 6, len + 2, INT[0], { rx: s * ang });
    for (let k = -3; k <= 3; k++) {                                       // lit seams along the underside, one every 12 m
      const o = k * 12, th = s * ang;
      vb(K, 0, (H + A) / 2 + 2.4 - 3.1 * Math.cos(th) - o * Math.sin(th), cz + s * run / 2 - 3.1 * Math.sin(th) + o * Math.cos(th), (x1 - x0) * 0.9, 0.3, 0.7, MILK, { rx: th, glow: 1.3 });
    }
    // the slabs along z (sloping in x), a little lower so they cross
    vb(K, s * run / 2, (H + A) / 2 + 0.6, cz, len + 2, 6, (z1 - z0) + 2 * PY.wall + 4, INT[1], { rz: -s * ang });
    for (let k = -3; k <= 3; k++) {
      const o = k * 12, th = -s * ang;
      vb(K, s * run / 2 + o * Math.cos(th) + 3.1 * Math.sin(th), (H + A) / 2 + 0.6 + o * Math.sin(th) - 3.1 * Math.cos(th), cz, 0.7, 0.3, (z1 - z0) * 0.9, MILK, { rz: th, glow: 1.3 });
    }
  }
  // the capping wall courses above the roof line, outside, close the gaps between the slabs
  for (const [x, z, w, d] of [[0, z0 - PY.wall / 2, x1 - x0 + 2 * PY.wall, PY.wall], [0, z1 + PY.wall / 2, x1 - x0 + 2 * PY.wall, PY.wall]]) ab(K, x, H - 0.1, z, w, 3, d, EXT[0]);
}

/**
 * The Pyramidion as it is seen from outside (docs/reference/io-patrol-pyramidion-exterior.webp): one colossal block of pale Vex stone tipped up on its north edge, 200 m wide and
 * over 300 m tall, its underside lifted over the gate and the ramp with a red-orange glow beneath, every face covered in stepped, layered relief. The hall is inside it.
 * The block is built in its own frame (x across, v up its height, u along its length) and tilted by BLK.a about x. Only its faces are built, so nothing of it shows inside the
 * hall; the underside is left open above the hall, where the hall's walls close it.
 */
const BLK = { a: 0.61, W: 200, H: 300, L: 300, ez: -40, ey: 75 };                 // tilt, size, and where its lifted front edge hangs (z, height)
const blkC = (() => {
  const { a, H, L, ez, ey } = BLK, c = Math.cos(a), s = Math.sin(a);
  return { c, s, y: ey + (H / 2) * c - (L / 2) * s, z: ez - (H / 2) * s - (L / 2) * c };
})();
/** A box in the block's frame: centre (x, v, u), size along x, v and u. */
function bb(K, x, v, u, w, h, d, color, o = {}) {
  const { c, s, y, z } = blkC;
  vb(K, x, y + v * c + u * s, z - v * s + u * c, w, h, d, color, { rx: -BLK.a, glow: o.glow });
}
const STONE = [0xb3ab9a, 0xa39b8a, 0xc4bcaa, 0x958d7d], STONED = 0x6f685c;
/**
 * Stepped relief on one face: the rectangle (a0..a1, b0..b1) is split again and again into panels; each panel stands out from the face and carries a smaller panel on top
 * (sometimes two), or sinks as a dark recess. `put(a, b, n, wa, wb, wn, color)` places a box with its centre at face coordinates a, b and height n off the face.
 */
function relief(K, put, a0, a1, b0, b1, depth = 0, glowSeam = 0) {
  const wa = a1 - a0, wb = b1 - b0;
  if (depth < 5 && Math.max(wa, wb) > 26 && K.R(0, 1) < 0.92) {
    const alongA = wa > wb ? K.R(0, 1) < 0.8 : K.R(0, 1) < 0.2, t = K.R(0.3, 0.7);
    if (alongA) { const m = a0 + wa * t; relief(K, put, a0, m, b0, b1, depth + 1, glowSeam); relief(K, put, m, a1, b0, b1, depth + 1, glowSeam); }
    else { const m = b0 + wb * t; relief(K, put, a0, a1, b0, m, depth + 1, glowSeam); relief(K, put, a0, a1, m, b1, depth + 1, glowSeam); }
    return;
  }
  const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2, gap = 0.8, pa = wa - gap, pb = wb - gap;
  if (K.R(0, 1) < 0.14) { put(ca, cb, 0.2, pa * 0.8, pb * 0.8, 0.6, STONED); return; }             // a dark recess
  let h = K.R(1.2, 5.5), n = 0, sa = pa, sb = pb;
  const steps = K.R(0, 1) < 0.5 ? 3 : 2;
  for (let k = 0; k < steps; k++) {
    const warm = glowSeam && k === steps - 1 && K.R(0, 1) < glowSeam * 0.5;    // on the underside, some panels glow with the red-orange light beneath
    put(ca + (k ? K.R(-0.12, 0.12) * sa : 0), cb + (k ? K.R(-0.12, 0.12) * sb : 0), n + h / 2, sa, sb, h, warm ? 0xc4502a : STONE[(depth + k + (K.R(0, 4) | 0)) % 4], warm ? 0.9 : 0);
    n += h; sa *= K.R(0.45, 0.75); sb *= K.R(0.45, 0.75); h = K.R(0.8, 3.5);
    if (sa < 3 || sb < 3) break;
  }
  if (glowSeam && K.R(0, 1) < glowSeam) put(ca, cb + pb / 2 + 0.2, 1.2, pa * 0.9, 0.5, 2.4, 0xff5a2a, 2.2);
}
function block(K) {
  const { W, H, L } = BLK, hw = W / 2, hh = H / 2, hl = L / 2, T = 6;
  // the faces: top, front (south, lifted), back (north, buried), the two sides; the underside in three parts so it stays out of the hall
  bb(K, 0, hh - T / 2, 0, W, T, L, STONE[0]);
  bb(K, 0, 0, hl - T / 2, W, H, T, STONE[1]);
  bb(K, 0, 0, -hl + T / 2, W, H, T, STONE[3]);
  for (const sx of [-1, 1]) bb(K, sx * (hw - T / 2), 0, 0, T, H, L, STONE[2]);
  const uCut = (-86 - blkC.z - hh * blkC.s) / blkC.c;                          // where the underside passes over the hall's south wall
  for (const sx of [-1, 1]) bb(K, sx * (hw + 74) / 2, -hh + T / 2, 0, hw - 74, T, L, STONE[3]);
  bb(K, 0, -hh + T / 2, (uCut + hl) / 2, 148, T, hl - uCut, STONE[3]);
  // relief on every face that can be seen (wa, wb, wn are the sizes along the face's own axes and its normal)
  relief(K, (a, b, n, wa, wb, wn, col, glow) => bb(K, a, b, hl + n, wa, wb, wn, col, { glow: glow || 0 }), -hw, hw, -hh, hh);                     // front: a = x, b = v
  relief(K, (a, b, n, wa, wb, wn, col, glow) => bb(K, a, hh + n, b, wa, wn, wb, col, { glow: glow || 0 }), -hw, hw, -hl, hl);                     // top: a = x, b = u
  for (const sx of [-1, 1]) relief(K, (a, b, n, wa, wb, wn, col, glow) => bb(K, sx * (hw + n), a, b, wn, wa, wb, col, { glow: glow || 0 }), -hh, hh, -hl, hl); // sides: a = v, b = u
  for (const sx of [-1, 1]) relief(K, (a, b, n, wa, wb, wn, col, glow) => bb(K, a, -hh - n, b, wa, wn, wb, col, { glow: glow || 0 }), sx > 0 ? 74 : -hw, sx > 0 ? hw : -74, -hl, hl, 1, 0.35);
  relief(K, (a, b, n, wa, wb, wn, col, glow) => bb(K, a, -hh - n, b, wa, wn, wb, col, { glow: glow || 0 }), -74, 74, uCut, hl, 1, 0.8);             // underside over the gate
  // the red-orange glow beneath the lifted edge, lighting the gate and the underside
  K.light(0, IO.plinth + 8, -64, 0xff6a30, 90, 140);
  K.light(-60, IO.plinth + 4, -96, 0xff5a2a, 60, 110); K.light(60, IO.plinth + 4, -96, 0xff5a2a, 60, 110);
  K.light(0, 20, -60, 0xff7a3a, 70, 110);                                      // up under the lifted edge, so the underside glows warm
  bb(K, 0, -BLK.H / 2 - 0.45, BLK.L / 2 - 3, 148, 0.8, 4, 0xff6a30, { glow: 2.4 }); // a seam of light along the lifted edge
  for (const q of [-1, 1]) ab(K, q * 40, IO.plinth + 0.3, -81.4, 60, 1.1, 0.8, 0xff7a3a, { glow: 2.2 });
  // solid where the block meets the ground beside and behind the hall (its underside is high overhead everywhere else a player can go)
  for (const sx of [-1, 1]) { K.ocollider(sx * (78 + hw) / 2, -248, hw - 78, 90, 228, 0); K.ocollider(sx * 81, -119, 6, 90, 32, 0); } // the ground at 4 m, and the plinth's lip
  K.ocollider(0, -300, W, 90, 124, 0);
}

/** The interior: dressed wall courses, the stairs, terraces round the pit, the core, pillars, floating and leaning blocks, the lit gate far below. */
function interior(K) {
  const { x0, x1, z0, z1, wallTop: H, cz } = PY, midx = 0;
  // wall courses on the inside: stepped ledges at several heights with lit seams (visual only)
  const course = (alongX, c, side, y, depth, h, color, from, to) => {
    const len = to - from, mid = (from + to) / 2;
    if (alongX) vb(K, mid, y, c + side * depth / 2, len, h, depth, color); else vb(K, c + side * depth / 2, y, mid, depth, h, len, color);
  };
  for (let k = 0; k < 7; k++) {
    const y = 14 + k * 6.4, depth = 3.6 - k * 0.35, col = INT[k % 3];
    course(true, z0, 1, y, depth, 3, col, x0 + 2, x1 - 2);                // north wall
    course(false, x0, 1, y, depth, 3, col, z0 + 2, z1 - 2);               // west wall
    course(false, x1, -1, y, depth, 3, col, z0 + 2, z1 - 2);              // east wall
    if (k >= 4) course(true, z1, -1, y, depth, 3, col, x0 + 2, x1 - 2);   // south wall (the stairs run along it below)
    const seam = y + 1.7;
    course(true, z0, 1, seam, depth + 0.05, 0.18, MILK, x0 + 6, x1 - 6);
    course(false, x0, 1, seam, depth + 0.05, 0.18, MILK, z0 + 6, z1 - 6);
    course(false, x1, -1, seam, depth + 0.05, 0.18, MILK, z0 + 6, z1 - 6);
  }
  // vertical piers on the walls between the courses
  for (const px of [-56, -36, -16, 16, 36, 56]) { vb(K, px, 34, z0 + 2.4, 5, 56, 4.8, INT[(px / 10 | 0) & 1 ? 0 : 2]); }
  for (const pz of [-210, -190, -170, -150, -130, -110]) for (const sx of [-1, 1]) vb(K, sx * 67.6, 34, pz, 4.8, 56, 5, INT[(pz / 10 | 0) & 1 ? 1 : 2]);
  // the stairways and their landings
  const ILH = IO.plinth;
  IK.flat(K, 0, -97, 30, 13, INTF, { y: 0.1, h: 0.08 });
  for (const s of [-1, 1]) {
    IK.flat(K, s * 54, -100, 19, 17, INTF, { y: 0.1, h: 0.08 });
    stairway(K, [s * 12, -98], [s * 46, -98], 9);
    stairway(K, [s * 54, -101], [s * 54, -150], 9);
    // the landing's open edges: parapets (skirted to the floor)
    for (const [bx, bz, w, d] of [[s * 61.2, -109.4, 4.6, 0.8], [s * 46.8, -109.4, 4.6, 0.8], [s * 64.4, -100, 0.8, 17], [s * 44.6, -105, 0.8, 7]]) K.box(bx, bz, w, 1.3, d, INT[1]);
  }
  // dressed stone under the ledge and the landings, so the terrain beneath never shows as bare cliff
  ab(K, 0, FLOOR, -97.5, 31.6, ILH - 0.2 - FLOOR, 14.6, INT[0]);
  for (const s of [-1, 1]) ab(K, s * 54, FLOOR, -100, 19.6, IO.landing - 0.2 - FLOOR, 18.6, INT[2]);
  // the entry ledge: parapet along its open north edge, a lit sill, and two monumental piers either side of the descent
  K.box(0, -103.4, 31.6, 1.3, 0.8, INT[1]);
  for (const s of [-1, 1]) { K.box(s * 14.5, -103.4, 3, 7, 3, INT[0]); K.box(s * 14.5, -103.4, 3.6, 0.6, 3.6, INTL, { y: 7, collide: false }); }
  ab(K, 0, ILH + 0.9, -103.8, 28, 0.15, 0.2, MILK, { glow: 1.6 });
  // the pit: terraces of lit stone stepping down to a red floor
  const levels = [[50, 4.5], [40, 3], [30, 1.5], [22, 0]];
  // stone on every terrace (a ring round the next one down, at its own height) and on the main floor round the pit, so no bare ground shows inside
  levels.forEach(([w, h], i) => {
    const wi = levels[i + 1]?.[0] ?? 0, band = (w - wi) / 2;
    if (!wi) { ab(K, 0, h + 0.02, -172, w, 0.08, w, INTF); return; }
    for (const s of [-1, 1]) { ab(K, 0, h + 0.02, -172 + s * (w - band) / 2, w, 0.08, band, INTF); ab(K, s * (w - band) / 2, h + 0.02, -172, band, 0.08, wi, INTF); }
  });
  for (const [x0, x1, z0, z1] of [[PY.x0, PY.x1, PY.z0, -197], [PY.x0, PY.x1, -147, PY.z1], [PY.x0, -25, -197, -147], [25, PY.x1, -197, -147]]) ab(K, (x0 + x1) / 2, FLOOR + 0.02, (z0 + z1) / 2, x1 - x0, 0.08, z1 - z0, INTF);
  for (const [w, h] of levels) for (const [dx, dz, ww, dd] of [[0, -w / 2 - 0.4, w + 1, 0.3], [0, w / 2 + 0.4, w + 1, 0.3], [-w / 2 - 0.4, 0, 0.3, w + 1], [w / 2 + 0.4, 0, 0.3, w + 1]]) ab(K, dx, h + 0.1, -172 + dz, ww, 0.5, dd, 0xff4a2a, { glow: 1.4 });
  ab(K, 0, 0.12, -172, 19, 0.15, 19, 0xff3a22, { glow: 1.8 });
  K.light(0, 4, -172, 0xff3a22, 18, 64); K.light(0, 24, -172, 0xff5a3a, 12, 70);
  // the red core: a great cube hanging over the pit with a smaller one nested in it, ringed by stone pillars
  vb(K, 0, 28, -172, 12, 12, 12, VRED, { ry: Math.PI / 4, rz: 0.6, rx: 0.6, glow: 1.6 });
  vb(K, 0, 28, -172, 15, 15, 15, 0xb02a1c, { ry: Math.PI / 4, rz: 0.6, rx: 0.6, glow: 0.4 });
  vb(K, 0, 14, -172, 4.4, 16, 4.4, 0xff6a3a, { glow: 1.8, ry: 0.4 });
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 + TAU / 16, px = Math.cos(a) * 36, pz = -172 + Math.sin(a) * 36, h = 14 + (i % 3) * 5;
    K.box(px, pz, 4.4, h, 4.4, INT[i % 3]); K.box(px, pz, 5.2, 1.2, 5.2, INTL, { y: h, collide: false }); K.box(px + 2.6, pz + 1, 3.4, h * 0.45, 3.4, INT[(i + 1) % 3]);
    ab(K, px, FLOOR + h * 0.4, pz, 4.6, 0.25, 4.6, MILK, { glow: 1.4 });
  }
  // the lit gate far below: a Vex gate in the north wall at floor level
  IK.vexGate(K, 0, 12, z0 + 0.6, 9, 0);
  K.box(0, z0 + 2, 26, 3, 3.5, INT[0]);
  K.light(0, 9, z0 + 8, MILK, 14, 56);
  // leaning blocks: stepped slabs standing in the corners and along the walls, solid, their tops far overhead on one side
  const lean = (x, z, dx, dz, w, steps, h0) => { for (let i = 0; i < steps; i++) K.box(x + dx * i * 2.6, z + dz * i * 2.6, dx ? 2.8 : w, h0 + i * 3.2, dz ? 2.8 : w, INT[i % 3]); };
  lean(-62, -186, 1, 0, 9, 5, 5); lean(62, -186, -1, 0, 9, 5, 5); lean(-62, -214, 1, 0, 11, 6, 5); lean(62, -214, -1, 0, 11, 6, 5);
  lean(-30, -226, 0, 1, 8, 4, 4); lean(30, -226, 0, 1, 8, 4, 4);
  // cover on the floor: broken blocks and cubes
  for (const [x, z, w, h, d] of [[-24, -140, 5, 3.4, 4], [24, -142, 4, 3, 5], [-20, -204, 6, 3, 4], [20, -206, 4, 3.6, 6], [-50, -170, 4, 3, 4], [50, -170, 4, 3.4, 4], [-14, -122, 3, 2.4, 3], [14, -124, 3, 2.4, 3]]) { K.box(x, z, w, h, d, INT[(Math.abs(x) | 0) % 3]); K.box(x, z, w + 0.1, 0.3, d + 0.1, MILK, { y: h * 0.7, collide: false, glow: 1.2 }); }
  for (const [x, z, s] of [[-40, -150, 1.6], [40, -152, 1.6], [-8, -196, 1.4], [8, -198, 1.4], [-36, -196, 1.5], [36, -194, 1.5]]) IK.vexCube(K, x, 0, z, s);
  // floating and leaning blocks overhead: none lower than the stairways' heads, none over the entry
  for (let i = 0; i < 46; i++) {
    const x = K.R(-64, 64), z = K.R(-226, -112), y = K.R(36, 64), s = K.R(4, 14);
    if (z > -112 - 0 && y < 46) continue;
    vb(K, x, y, z, s * K.R(0.6, 1.6), s * K.R(0.4, 1.2), s * K.R(0.6, 1.6), INT[i % 3], { rx: K.R(-0.7, 0.7), ry: K.R(0, TAU), rz: K.R(-0.7, 0.7) });
    if (i % 4 === 0) vb(K, x, y, z, s * 0.9, 0.3, s * 0.9, MILK, { rx: K.R(-0.7, 0.7), glow: 1.2 });
  }
  for (const [x, y, z, w, h, d, rz, rx] of [[-44, 40, -140, 40, 5, 12, 0.5, 0.1], [46, 44, -150, 44, 5, 12, -0.55, 0.1], [-30, 52, -196, 50, 6, 14, 0.4, -0.2], [34, 50, -200, 52, 6, 14, -0.45, 0.2], [0, 62, -120, 70, 5, 10, 0.12, 0], [0, 38, -214, 56, 5, 10, 0, 0.35]]) vb(K, x, y, z, w, h, d, INT[1], { rz, rx });
  // lights: cold, from the seams, and teal motes
  for (const [x, y, z] of [[-40, 40, -140], [40, 40, -140], [-40, 44, -200], [40, 44, -200], [0, 58, -165]]) K.light(x, y, z, 0x9fe8ff, 12, 70);
  for (const [x, y, z] of [[-30, 32, -112], [30, 32, -112]]) K.light(x, y, z, 0x9fe8ff, 9, 50);
}

/** Outside the Pyramidion: the plinth edge, boulders and old Vex blocks, a ring of cubes before the gate. */
function pyramidExterior(K) {
  for (const [x, z] of [[-30, -60], [30, -60], [-44, -40], [44, -40]]) { IK.vexPillar(K, x, z, 10, { w: 1.8 }); }
  for (const [x, z, s] of [[-12, -30, 1.8], [12, -34, 1.6], [-8, -52, 1.4], [8, -56, 1.4]]) IK.vexCube(K, x, 0, z, s);
  for (const [x, y, z, s] of [[-16, 22, -60, 7], [20, 28, -50, 9], [-30, 34, -80, 6]]) vb(K, x, y, z, s, s * 0.8, s, EXT[1], { rx: 0.3, ry: 0.6 });
  // the plinth's edge walkway on the north and sides: rock and spires
  for (const [x, z] of [[-86, -100], [86, -100], [-86, -200], [86, -200], [-60, -258], [60, -258]]) darkSpire(K, x, z, 12);
}

// ------------------------------------------------------------------ the map

export default {
  i_patrol: {
    ...PATROL_DATA.i_patrol,
    build(K) {
      ROADS.length = 0;
      // ================================================================ the roads: dirt Sparrow routes through the canyons and up the mesas, one marked road from the landing to every area
      road(K, [[0, 156], [0, 120], [3, 90], [0, 40], [0, 16], [0, -16]], 9);
      road(K, [[0, -16], [0, -76]], 10);
      road(K, [[-4, 150], [24, 146], [46, 142], [96, 142]], 8);
      road(K, [[-4, 150], [-18, 128], [-52, 114]], 7);
      road(K, [[0, 16], [-60, 16], [-104, 16], [-130, 14], [-160, 10]], 9);
      road(K, [[0, 16], [60, 16], [112, 18], [142, 12]], 9);
      road(K, [[-104, 16], [-100, -20], [-98, -74], [-104, -112], [-112, -140], [-116, -150]], 9);   // bends west of the Pyramidion's grounded side
      road(K, [[-116, -150], [-124, -150]], 9);
      road(K, [[142, 12], [150, -4], [150, -20], [150, -48], [150, -66]], 9, 'cabal');
      for (const s of [-1, 1]) {
        road(K, [[s * 3, 100], [s * 22, 100], [s * 52, 100]], 8);
        road(K, [[s * 52, 100], [s * 60, 94], [s * 62, 88], [s * 62, 64]], 7);
        road(K, [[s * 4, -10], [s * 26, -20], [s * 50, -16]], 8);
      }

      oasis(K);
      mesas(K);
      gateCanyon(K);
      whiteTree(K);
      scar(K);
      legionBase(K);
      charon(K);
      blight(K);
      pyramidExterior(K);
      shell(K);
      roof(K);
      block(K);
      interior(K);
    },
  },
};
