// U23 "The Emperor's Shadow": a dungeon on the Leviathan (static geometry only). Chunk A: the Antechamber and the Imperial Baths.
// Interactive things (plates, sigil board, pool water, censers, chalices, the gate door) are built by the runtime from SHADOW_LAYOUT;
// this file builds the floor, walls, ceiling, columns, decor, lights and the terrain for the dais.
//
// HOW THE FLOOR WORKS. The ground is flat at y 0 everywhere, except the raised round dais (top 1.2 m) which is a terrain plateau pair
// (two squares, one turned 45 degrees: an octagon, inradius 6.45 m) and four terrain ramps (slope 0.33, under the 0.45 design limit) up its
// N, S, E and W sides. The terrain mesh is removed in build(); the floor, dais and ramps are drawn to match their terrain exactly.
// Walls are solid boxes at absolute heights; the ceilings and the pool rims are visual only (a rim is under 0.35 m: walked over).
// Later chunks append segments north of the Baths through the gate opening in the north wall (x -3.5..3.5, z -36, 8 m tall).
import * as THREE from 'three';

const MARB = 0xece6da, MARB2 = 0xdad2c3, MARB3 = 0xc2b9a8, CREAM = 0xe8dcc0;
const GOLD = 0xd9a43a, GOLDL = 0xffc247, GOLDD = 0x8a6a22;
const PURP = 0x4a1f6e, PURP2 = 0x35154f, LEAF = 0x3a6a3a, STEAM = 0xfff4e0;

// ---------------------------------------------------------------------------------------------------------------------------------
// Layout contract (world units, y up; floor y = 0 unless noted)
// ---------------------------------------------------------------------------------------------------------------------------------
export const SHADOW_LAYOUT = {
  spawn: [0, 0, 58],
  voidY: -30,
  segments: [
    {
      id: 'baths', name: 'The Imperial Baths', kind: 'boss',
      checkpoint: [0, 0, 44],
      region: { minX: -36, maxX: 36, minZ: -36, maxZ: 36, minY: -5, maxY: 30 },
      pools: [{ p: [-20, 0, 20], r: 8 }, { p: [20, 0, 20], r: 8 }, { p: [-20, 0, -20], r: 8 }, { p: [20, 0, -20], r: 8 }],
      plates: [[-20, 0, 20], [20, 0, 20], [-20, 0, -20], [20, 0, -20]],
      dais: { p: [0, 1.2, 0], r: 7 },
      board: [0, 10, 0],
      censers: [[0, 13, -4.5], [3.9, 13, 2.25], [-3.9, 13, 2.25]],
      boss: [0, 0, -26],
      chest: [0, 1.2, 3],
      spawns: [[-30, 0, 0], [30, 0, 0], [0, 0, 30], [-28, 0, -28], [28, 0, -28], [-28, 0, 28], [28, 0, 28], [0, 0, -30]],
      gate: { p: [0, 0, -36], w: 7, h: 8, axis: 'x' },
    },
  ],
};

// dais: an octagon made of two squares (inradius DR); ramps climb from the floor at DR + RAMP_RUN to the top at DR - 0.05
const DAIS_H = 1.2, DR = 6.45, RAMP_RUN = 3.6, RAMP_W = 4;

function terrainFeatures() {
  const out = [
    { type: 'plateau', x: 0, z: 0, w: 2 * DR, d: 2 * DR, h: DAIS_H, edge: 0.25 },
    { type: 'plateau', x: 0, z: 0, w: 2 * DR, d: 2 * DR, h: DAIS_H, ry: Math.PI / 4, edge: 0.25 },
  ];
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    out.push({ type: 'ramp', x0: dx * (DR + RAMP_RUN - 0.05), z0: dz * (DR + RAMP_RUN - 0.05), x1: dx * (DR - 0.05), z1: dz * (DR - 0.05), width: RAMP_W, h0: 0, h1: DAIS_H, edge: 0.5 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Location (shaped like a LOCATIONS entry; not in the Director's list). Copied from the Leviathan: every Cabal here is a gold Loyalist.
// ---------------------------------------------------------------------------------------------------------------------------------
export const SHADOW_LOC = {
  id: 'shadow', name: "The Emperor's Shadow", planetName: 'The Leviathan', faction: 'Cabal',
  desc: "A dungeon under Emperor Calus's world-ship, where his Loyalists keep what the Emperor does not show his guests.",
  fog: [20, 110], sunDir: [0.3, 1, 0.2], light: { hemi: 1.8, sun: 0.45 },
  colors: { sky: 0x2a2012, fog: 0xc9b48a, hemiTop: 0xfff6e2, hemiBot: 0xb8a888, sun: 0xfff0d8, ground: 0xd8d0c0, ground2: 0xcbc2b0, rock: 0xbfb5a0, rock2: 0xa99f8c, wall: 0xe4dccb, metal: 0xb9a98a, accent: 0xffc247, crate: 0x5a4a3a, foliage: 0x3a6a4a, enemy: 0x8a6a2a, enemy2: 0x2a2018, eye: 0xffc247, loyalist: true },
  planetColors: { sea: false, c: [0x2a1c34, 0x6a5a4e, 0xffc247, 0xffe3a8] }, atmo: 0xffc247,
  skyBody: { color: 0x000000, size: 0.1, pos: [0, -900, 0] }, // not drawn in an enclosed hall
  enemyNames: { grunt: 'Loyalist Legionary', rusher: 'War Beast', captain: 'Loyalist Centurion', heavy: 'Loyalist Colossus' },
  zoneNames: ['The Imperial Baths'], missions: [],
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Building helpers (all heights ABSOLUTE)
// ---------------------------------------------------------------------------------------------------------------------------------
let _ub = null;
const UB = () => _ub || (_ub = new THREE.BoxGeometry(1, 1, 1));
/** Visual box centred at (x, y, z), size w x h x d, no collider. o.geo swaps the geometry (then w, h, d are ignored). */
function vb(K, x, y, z, w, h, d, color, o = {}) {
  const m = new THREE.Mesh(o.geo || UB(), K.mat(color, o.glow));
  if (!o.geo) m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
  m.receiveShadow = true; m.castShadow = !!o.shadow;
  m.userData.noCollide = true;
  K.scene.add(m);
  return m;
}
const vx = (K, x0, x1, y0, y1, z0, z1, color, o) => vb(K, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, o);
/** Solid box by extents at absolute heights (mesh + collider). */
const solid = (K, x0, x1, y0, y1, z0, z1, color, o = {}) => K.box((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, { y: y0, abs: true, glow: o.glow });
/** Translucent effect mesh (light shafts, steam). */
function fx(K, geo, color, opacity, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: true, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending }));
  m.position.set(x, y, z);
  m.userData.noCollide = true; m.renderOrder = 2;
  K.scene.add(m);
  return m;
}
const lamp = (K, x, y, z, color, intensity = 10, dist = 34) => K.light(x, y - K.ground(x, z), z, color, intensity, dist);

/** A wall run along x (fixed z, thickness t) or along z (fixed x) from a0 to a1, y0..y1, with openings [{ a, b, top }] (wall left out below top). */
function wallRun(K, axis, fixed, a0, a1, y0, y1, t, color, gaps = []) {
  const put = (u0, u1, yb, yt) => {
    if (u1 - u0 < 0.05 || yt - yb < 0.05) return;
    if (axis === 'x') solid(K, u0, u1, yb, yt, fixed - t / 2, fixed + t / 2, color);
    else solid(K, fixed - t / 2, fixed + t / 2, yb, yt, u0, u1, color);
  };
  let from = a0;
  for (const g of [...gaps].sort((p, q) => p.a - q.a)) { put(from, g.a, y0, y1); put(g.a, g.b, g.top, y1); from = g.b; }
  put(from, a1, y0, y1);
}

/** Marble column with gold bands, a capital and a plinth. */
function column(K, x, z, h, w = 2.2) {
  solid(K, x - w / 2, x + w / 2, 0, h, z - w / 2, z + w / 2, MARB2);
  vb(K, x, 0.35, z, w + 0.5, 0.7, w + 0.5, MARB3);
  for (const f of [0.1, 0.42, 0.74]) vb(K, x, h * f + 0.5, z, w + 0.18, 0.55, w + 0.18, GOLD, { glow: 0.3 });
  vb(K, x, h - 0.5, z, w + 0.7, 1.0, w + 0.7, GOLD, { glow: 0.3 });
  vb(K, x, h - 1.25, z, w + 0.35, 0.5, w + 0.35, MARB3);
}
/** Purple banner with a gold border and a sun sigil; axis 'z' hangs on a wall facing z, 'x' on a wall facing x. */
function banner(K, x, y, z, axis, h = 8) {
  const f = (w, hh, d) => (axis === 'z' ? [w, hh, d] : [d, hh, w]);
  vb(K, x, y, z, ...f(3.0, h, 0.12), GOLD);
  vb(K, x, y, z, ...f(2.5, h - 0.5, 0.22), PURP);
  vb(K, x, y - h * 0.5 + 0.2, z, ...f(3.0, 0.4, 0.3), GOLD, { glow: 0.3 });
  vb(K, x, y + h * 0.12, z, ...f(1.0, 1.0, 0.34), GOLDL, { glow: 1.2, ry: Math.PI / 4 });
}
/** Gilded robed Cabal emperor on a marble plinth (own low-poly design). `ry` turns it. */
function statue(K, x, z, ry = 0) {
  solid(K, x - 1, x + 1, 0, 1.2, z - 1, z + 1, MARB2);
  vb(K, x, 1.25, z, 2.3, 0.14, 2.3, GOLD, { glow: 0.3 });
  solid(K, x - 0.6, x + 0.6, 1.2, 3.6, z - 0.6, z + 0.6, MARB); // the robe: the body is solid cover
  const part = (px, py, pz, w, h, d, c, o = {}) => {
    const s = Math.sin(ry), co = Math.cos(ry);
    vb(K, x + px * co + pz * s, py, z - px * s + pz * co, w, h, d, c, { ry, ...o });
  };
  vb(K, x, 2.4, z, 1, 1, 1, MARB, { geo: new THREE.CylinderGeometry(0.55, 0.9, 2.5, 8) });   // robe
  vb(K, x, 1.4, z, 1, 1, 1, GOLD, { geo: new THREE.CylinderGeometry(0.93, 0.93, 0.18, 8), glow: 0.3 }); // gold hem
  part(0, 3.8, 0, 1.7, 0.4, 0.8, MARB);                       // shoulders
  part(0, 3.95, 0, 1.9, 0.14, 0.95, GOLD, { glow: 0.3 });      // mantle trim
  part(0, 4.35, 0, 0.55, 0.6, 0.5, CREAM);                     // head
  part(0, 4.78, 0, 0.7, 0.16, 0.62, GOLD, { glow: 0.5 });      // crown band
  for (const px of [-0.25, 0, 0.25]) part(px, 5.0, 0, 0.1, 0.3, 0.1, GOLD, { glow: 0.5 }); // crown points
  part(0, 3.0, -0.55, 1.3, 2.6, 0.08, PURP);                   // cape
  part(0.95, 3.7, 0.25, 0.2, 0.9, 0.2, MARB, { rx: -0.6 });     // arm
  part(0.95, 4.3, 0.55, 0.1, 2.6, 0.1, GOLD, { glow: 0.4 });   // scepter
  part(0.95, 5.65, 0.55, 0.3, 0.3, 0.3, GOLDL, { glow: 1.2, ry: ry + Math.PI / 4 }); // its jewel
}
/** Marble planter with a gold rim and a low leafy bush. */
function planter(K, x, z) {
  solid(K, x - 1.2, x + 1.2, 0, 1.1, z - 0.8, z + 0.8, MARB2);
  vb(K, x, 1.12, z, 2.5, 0.12, 1.7, GOLD, { glow: 0.3 });
  vb(K, x, 1.7, z, 1, 1, 1, LEAF, { geo: new THREE.IcosahedronGeometry(0.85, 0) });
  vb(K, x + 0.5, 1.5, z - 0.2, 1, 1, 1, 0x4f8a4a, { geo: new THREE.IcosahedronGeometry(0.55, 0) });
}
/** Low gold-and-marble bench along x. */
function bench(K, x, z, ry = false) {
  const w = ry ? 1.1 : 3.6, d = ry ? 3.6 : 1.1;
  solid(K, x - w / 2, x + w / 2, 0, 0.9, z - d / 2, z + d / 2, MARB);
  vb(K, x, 0.92, z, w + 0.15, 0.12, d + 0.15, GOLD, { glow: 0.3 });
  for (const s of [-1, 1]) vb(K, x + (ry ? 0 : s * (w / 2 - 0.1)), 0.45, z + (ry ? s * (d / 2 - 0.1) : 0), ry ? 1.3 : 0.25, 0.9, ry ? 0.25 : 1.3, GOLD);
}
/** Brazier on a pedestal with a flame and a warm light. */
function brazier(K, x, z) {
  solid(K, x - 0.45, x + 0.45, 0, 1.3, z - 0.45, z + 0.45, GOLDD);
  vb(K, x, 0.15, z, 1.3, 0.3, 1.3, MARB3);
  vb(K, x, 1.5, z, 1, 1, 1, GOLD, { geo: new THREE.CylinderGeometry(0.9, 0.45, 0.5, 8), glow: 0.3 });
  vb(K, x, 2.1, z, 1, 1, 1, 0xff9a2a, { geo: new THREE.ConeGeometry(0.5, 1.1, 5), glow: 2.2 });
  vb(K, x, 1.95, z, 1, 1, 1, 0xffd870, { geo: new THREE.ConeGeometry(0.28, 0.8, 5), glow: 2.6 });
  lamp(K, x, 2.6, z, 0xffa84a, 7, 24);
}
/** The Baths' ornate gold frame round the gate opening (north wall). */
function gateFrame(K) {
  const z = -36, hw = 3.5, h = 8;
  for (const s of [-1, 1]) {
    vb(K, s * (hw + 0.65), h / 2 + 0.6, z - 0.5, 1.3, h + 1.2, 2.5, GOLD, { glow: 0.35 });
    vb(K, s * (hw + 0.65), 0.45, z - 0.5, 1.9, 0.9, 3.0, MARB3);
    vb(K, s * (hw + 0.65), h + 0.7, z - 0.5, 1.9, 0.7, 3.0, GOLDD);
    vb(K, s * (hw + 1.65), h / 2 + 2, z - 0.4, 0.9, h + 4, 2.1, MARB2);
    for (let i = 0; i < 4; i++) vb(K, s * (hw + 0.65), 1.5 + i * 1.8, z + 0.78, 0.5, 0.5, 0.2, GOLDL, { glow: 0.9, ry: Math.PI / 4 });
  }
  vb(K, 0, h + 0.7, z - 0.5, 2 * hw + 3.2, 1.4, 2.5, GOLD, { glow: 0.35 });
  vb(K, 0, h + 1.8, z - 0.5, 2 * hw + 5, 0.9, 2.8, MARB3);
  vb(K, 0, h + 2.9, z - 0.5, 8, 1.4, 2.2, GOLD, { glow: 0.3 });
  vb(K, 0, h + 3.9, z + 0.7, 1.5, 1.5, 0.3, GOLDL, { glow: 1.4, ry: Math.PI / 4 }); // sun sigil over the door
  for (const k of [-3, -2, -1, 1, 2, 3]) vb(K, k * 1.1, h + 3.6, z + 0.76, 0.2, 2.0, 0.12, GOLDL, { glow: 0.9, rz: k * 0.26 });
  lamp(K, 0, 6, z + 2.5, GOLDL, 8, 22);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The set
// ---------------------------------------------------------------------------------------------------------------------------------
const SHADOW = {
  spawn: [0, 58],
  bounds: [-39, 39, -40, 67],
  zones: [],
  terrain: terrainFeatures(),
  noEdge: true, rim: 0, merge: true, hideBulbs: true, lightPool: 8, lockIn: false,
  build(K) {
    // the terrain mesh is not wanted: the floor, dais and ramps are drawn to match their terrain exactly
    for (const o of K.scene.children.slice()) if (o.isMesh && o.material?.vertexColors && o.geometry?.attributes?.color) { K.scene.remove(o); o.geometry.dispose(); }
    const H = 22; // Baths wall height

    // ============================== floor ==============================
    vx(K, -38, 38, -3, 0, -38, 66, MARB);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) vx(K, -36 + i * 9, -27 + i * 9, 0, 0.012, -36 + j * 9, -27 + j * 9, MARB2);
    vx(K, -7, 7, 0, 0.012, 36, 64, MARB2);
    // gold border line round the hall and a gold ring round the dais
    for (const [x0, x1, z0, z1] of [[-35.6, 35.6, -35.6, -35.2], [-35.6, 35.6, 35.2, 35.6], [-35.6, -35.2, -35.6, 35.6], [35.2, 35.6, -35.6, 35.6]]) vx(K, x0, x1, 0, 0.03, z0, z1, GOLD, { glow: 0.3 });
    vb(K, 0, 0.015, 0, 1, 1, 1, GOLD, { geo: new THREE.RingGeometry(10.4, 10.9, 32).rotateX(-Math.PI / 2), glow: 0.3 });
    // gold diagonal inlays from the dais towards each pool (flat on the floor: lines stay open)
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const len = 8.5;
      vb(K, sx * 14.5, 0.02, sz * 14.5, len, 0.02, 0.35, GOLD, { ry: (sx * sz > 0 ? -Math.PI / 4 : Math.PI / 4), glow: 0.25 });
    }
    // runner carpet from the antechamber to the dais south ramp, and a short one north of the dais
    vx(K, -1.7, 1.7, 0, 0.04, 10, 64, PURP);
    for (const s of [-1, 1]) vx(K, s * 1.7 - 0.12, s * 1.7 + 0.12, 0, 0.05, 10, 64, GOLD, { glow: 0.3 });
    vx(K, -1.7, 1.7, 0, 0.04, -36, -10, PURP);
    for (const s of [-1, 1]) vx(K, s * 1.7 - 0.12, s * 1.7 + 0.12, 0, 0.05, -36, -10, GOLD, { glow: 0.3 });

    // ============================== walls ==============================
    const wc = MARB;
    // Baths: x, z in [-36, 36]; the gate (north, x -3.5..3.5, 8 m) and the entrance (south, x -5..5, 10 m)
    wallRun(K, 'x', -37, -38, 38, 0, H, 2, wc, [{ a: -3.5, b: 3.5, top: 8 }]);
    wallRun(K, 'x', 37, -38, 38, 0, H, 2, wc, [{ a: -5, b: 5, top: 10 }]);
    wallRun(K, 'z', -37, -36, 36, 0, H, 2, wc);
    wallRun(K, 'z', 37, -36, 36, 0, H, 2, wc);
    // Antechamber: x -7..7, z 36..64
    wallRun(K, 'z', -8, 38, 66, 0, 13.5, 2, wc);
    wallRun(K, 'z', 8, 38, 66, 0, 13.5, 2, wc);
    wallRun(K, 'x', 65, -9, 9, 0, 13.5, 2, wc);
    // gold cornice and skirting on the inside of the Baths
    for (const [x0, x1, z0, z1] of [[-36, 36, -36.4, -35.4], [-36, 36, 35.4, 36.4], [-36.4, -35.4, -36, 36], [35.4, 36.4, -36, 36]]) vx(K, x0, x1, 20.4, 21.6, z0, z1, GOLD, { glow: 0.3 });
    gateFrame(K);
    // the entrance arch (south wall opening)
    for (const s of [-1, 1]) {
      vb(K, s * 5.6, 5.5, 36.6, 1.3, 11.2, 1.8, GOLD, { glow: 0.3 });
      vb(K, s * 5.6, 0.45, 36.6, 1.9, 0.9, 2.4, MARB3);
    }
    vb(K, 0, 10.6, 36.6, 12.4, 1.4, 1.8, GOLD, { glow: 0.3 });
    vb(K, 0, 11.7, 36.6, 8, 0.9, 1.6, MARB3);
    vb(K, 0, 12.6, 36.4, 1.1, 1.1, 0.3, GOLDL, { glow: 1.3, ry: Math.PI / 4 });

    // ============================== the Baths ==============================
    // columns along the walls (every 12 m, off the gate and the entrance), banners between them
    for (const z of [-30, -18, -6, 6, 18, 30]) for (const s of [-1, 1]) column(K, s * 34.9, z, H);
    for (const x of [-30, -18, 18, 30]) for (const s of [-1, 1]) column(K, x, s * 34.9, H);
    for (const z of [-24, -12, 0, 12, 24]) for (const s of [-1, 1]) banner(K, s * 35.7, 10.5, z, 'x', 9);
    for (const x of [-24, -12, 12, 24]) for (const s of [-1, 1]) banner(K, x, 10.5, s * 35.7, 'z', 9);

    // ceiling (visual): a flat roof with a coffer grid, a gold sunburst and a round skylight above the centre
    vx(K, -38, 38, H, H + 2, -38, 38, MARB2).castShadow = false;
    for (const c of [-27, -18, -9, 9, 18, 27]) {
      vx(K, -36, 36, H - 1.2, H, c - 0.3, c + 0.3, MARB3);
      vx(K, c - 0.3, c + 0.3, H - 1.2, H, -36, 36, MARB3);
      vx(K, -36, 36, H - 1.24, H - 1.2, c - 0.12, c + 0.12, GOLD, { glow: 0.3 });
      vx(K, c - 0.12, c + 0.12, H - 1.24, H - 1.2, -36, 36, GOLD, { glow: 0.3 });
    }
    for (const r of [9, 12.5]) vb(K, 0, H - 0.5, 0, 1, 1, 1, GOLD, { geo: new THREE.TorusGeometry(r, 0.45, 5, 36).rotateX(Math.PI / 2), glow: 0.5 });
    vb(K, 0, H - 0.3, 0, 1, 1, 1, MARB3, { geo: new THREE.CylinderGeometry(15, 15, 0.6, 24) });
    for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8; vb(K, Math.cos(a) * 11, H - 0.62, Math.sin(a) * 11, 4.4, 0.16, 0.5, GOLDL, { ry: -a, glow: 0.8 }); }
    vb(K, 0, H - 0.04, 0, 1, 1, 1, 0xffe2a0, { geo: new THREE.CircleGeometry(7.4, 28).rotateX(Math.PI / 2), glow: 2.0 });
    fx(K, new THREE.CylinderGeometry(7.2, 11, H, 20, 1, true), 0xffe0a0, 0.09, 0, H / 2, 0, { add: true });
    lamp(K, 0, H - 4, 0, GOLDL, 16, 56);

    // the dais: an octagonal marble drum (matches the terrain octagon), a gold sun inlay and a gold foot ring; four step-ramps
    vb(K, 0, DAIS_H / 2 + 0.02, 0, 1, 1, 1, MARB, { geo: new THREE.CylinderGeometry(DR / Math.cos(Math.PI / 8), DR / Math.cos(Math.PI / 8), DAIS_H + 0.04, 8).rotateY(Math.PI / 8), shadow: true });
    vb(K, 0, DAIS_H + 0.04, 0, 1, 1, 1, GOLD, { geo: new THREE.CylinderGeometry(6.1, 6.1, 0.05, 8).rotateY(Math.PI / 8), glow: 0.3 });
    vb(K, 0, DAIS_H + 0.07, 0, 1, 1, 1, MARB2, { geo: new THREE.CylinderGeometry(5.5, 5.5, 0.05, 8).rotateY(Math.PI / 8) });
    for (let k = 0; k < 8; k++) vb(K, 0, DAIS_H + 0.1, 0, 5, 0.04, 0.5, GOLDL, { ry: (k * Math.PI) / 4, glow: 0.7 });
    vb(K, 0, DAIS_H + 0.1, 0, 1, 1, 1, GOLDL, { geo: new THREE.CylinderGeometry(1.2, 1.2, 0.06, 12), glow: 0.9 });
    vb(K, 0, DAIS_H - 0.1, 0, 1, 1, 1, GOLD, { geo: new THREE.CylinderGeometry(DR / Math.cos(Math.PI / 8) + 0.12, DR / Math.cos(Math.PI / 8) + 0.12, 0.2, 8).rotateY(Math.PI / 8), glow: 0.3 });
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x0 = dx * (DR + RAMP_RUN - 0.05), z0 = dz * (DR + RAMP_RUN - 0.05), x1 = dx * (DR - 0.05), z1 = dz * (DR - 0.05);
      const len = Math.hypot(x1 - x0, z1 - z0), rise = DAIS_H, pitch = Math.atan2(rise, len), L = Math.hypot(len, rise);
      const yaw = Math.atan2(-(z1 - z0), x1 - x0), th = 0.5;
      vb(K, (x0 + x1) / 2, rise / 2 - (Math.cos(pitch) * th) / 2 + 0.02, (z0 + z1) / 2, L, th, RAMP_W, MARB, { ry: yaw, rz: pitch, shadow: true });
      for (const s of [-1, 1]) vb(K, (x0 + x1) / 2 + Math.sin(yaw) * s * (RAMP_W / 2), rise / 2 + 0.07, (z0 + z1) / 2 + Math.cos(yaw) * s * (RAMP_W / 2), L, 0.1, 0.2, GOLD, { ry: yaw, rz: pitch, glow: 0.3 });
    }

    // four pools: a low marble rim (0.3 m: walked over), a gold mosaic disc flush with the floor (the water surface is drawn by the runtime)
    for (const [px, pz] of [[-20, 20], [20, 20], [-20, -20], [20, -20]]) {
      vb(K, px, 0.02, pz, 1, 1, 1, GOLDD, { geo: new THREE.CylinderGeometry(7.9, 7.9, 0.04, 28) });
      vb(K, px, 0.03, pz, 1, 1, 1, GOLD, { geo: new THREE.CylinderGeometry(7.6, 7.6, 0.04, 28), glow: 0.25 });
      for (const [r0, r1, c] of [[6.2, 6.6, GOLDD], [4.2, 4.5, MARB], [2.2, 2.5, GOLDD]]) vb(K, px, 0.055, pz, 1, 1, 1, c, { geo: new THREE.RingGeometry(r0, r1, 28).rotateX(-Math.PI / 2) });
      for (let k = 0; k < 8; k++) vb(K, px, 0.056, pz, 7, 0.02, 0.3, MARB, { ry: (k * Math.PI) / 4, glow: 0.2 });
      vb(K, px, 0.02, pz, 1, 1, 1, MARB, { geo: new THREE.TorusGeometry(8, 0.3, 5, 36).rotateX(Math.PI / 2), shadow: true });
      vb(K, px, 0.26, pz, 1, 1, 1, GOLD, { geo: new THREE.TorusGeometry(8.0, 0.07, 4, 36).rotateX(Math.PI / 2), glow: 0.4 });
      fx(K, new THREE.CylinderGeometry(6.5, 8, 5.5, 14, 1, true), STEAM, 0.06, px, 3, pz);
      lamp(K, px, 6, pz, 0xffd890, 7, 30);
    }

    // cover: statues of the emperor between the pools, planters, low benches
    for (const [x, z, ry] of [[-20, 0, Math.PI / 2], [20, 0, -Math.PI / 2], [-13, 29, Math.PI], [13, 29, Math.PI], [-13, -29, 0], [13, -29, 0]]) statue(K, x, z, ry);
    for (const [x, z] of [[-13, -5], [13, -5], [-13, 5], [13, 5], [-5, -14], [5, -14], [-5, 14], [5, 14]]) planter(K, x, z);
    for (const [x, z] of [[-22, 8], [22, 8], [-22, -8], [22, -8]]) bench(K, x, z);
    for (const [x, z] of [[-33, 14], [33, 14], [-33, -14], [33, -14]]) bench(K, x, z, true);
    for (const [x, z] of [[-25, 20.5], [25, 20.5], [-25, -20.5], [25, -20.5]]) lamp(K, x, 5, z, 0xffc86a, 5, 20);
    for (const [x, z] of [[-30, 0], [30, 0], [0, 28], [0, -28]]) lamp(K, x, 9, z, GOLDL, 8, 36);

    // ============================== the Antechamber ==============================
    vx(K, -7, 7, 13.5 - 1.5, 13.5, 38, 66, MARB2).castShadow = false;       // roof (visual)
    vx(K, -9, 9, 13.5, 15, 36, 66, MARB3).castShadow = false;
    for (let z = 40; z <= 62; z += 5.5) {
      for (const s of [-1, 1]) {
        vb(K, s * 6.75, 5.8, z, 0.5, 11.6, 1.2, MARB2);                      // pilaster
        for (const f of [0.1, 0.5, 0.92]) vb(K, s * 6.7, 11.6 * f + 0.2, z, 0.65, 0.5, 1.5, GOLD, { glow: 0.3 });
        vb(K, s * 6.68, 9.5, z + 2.75, 0.1, 5, 2.6, PURP2);                  // hanging cloth between pilasters
        vb(K, s * 6.65, 7, z + 2.75, 0.14, 0.3, 2.7, GOLD, { glow: 0.3 });
      }
      vx(K, -7, 7, 11.4, 12.0, z - 0.3, z + 0.3, GOLD, { glow: 0.3 });        // gold cross beam
    }
    for (const s of [-1, 1]) vb(K, s * 6.7, 12.4, 51, 0.5, 0.6, 26, GOLD, { glow: 0.3 }); // cornice
    // brazier pairs and the end wall
    for (const z of [42, 50, 58]) for (const s of [-1, 1]) brazier(K, s * 4.6, z);
    vb(K, 0, 7.5, 63.85, 9, 8, 0.2, PURP);
    vb(K, 0, 7.5, 63.8, 9.7, 8.7, 0.12, GOLD);
    vb(K, 0, 8.6, 63.7, 2.4, 2.4, 0.3, GOLDL, { glow: 1.3, ry: Math.PI / 4 });
    lamp(K, 0, 9.5, 56, 0xffd890, 11, 36);
    lamp(K, 0, 9.5, 44, 0xffd890, 10, 32);
    lamp(K, 0, 7, 38, GOLDL, 7, 22);
  },
};

export default { shadow: SHADOW };
