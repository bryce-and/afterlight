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
// U23 chunk B data: Underbelly footholds and grates, the Gardens' hedges. Every walkable Underbelly surface is a terrain plateau
// (ground under 1 m inside the pit is the void); grates are colliders solid only while the local player holds Favor.
// ---------------------------------------------------------------------------------------------------------------------------------
export const GY = 11, PAV_H = 1.4; // the Gardens floor and the pavilion's rise
/** Underbelly footholds: { id, x0, x1, z0, z1 (z0 > z1: north is -z), top, stage }. stage 0 deck A, 1 deck B, 2 deck C, 'perch' a sniper shelf. */
export const UB_FOOT = [
  { id: 'ub_in2', x0: -4, x1: 4, z0: -48, z1: -52, top: 2, stage: 0 },
  { id: 'ub_a1', x0: -10, x1: 10, z0: -52, z1: -64, top: 2, stage: 0 },
  { id: 'ub_a2', x0: -2, x1: 2, z0: -64, z1: -80, top: 2, stage: 0 },
  { id: 'ub_a3', x0: -14, x1: 14, z0: -80, z1: -94, top: 2, stage: 0 },
  { id: 'ub_b1', x0: -24, x1: 14, z0: -138, z1: -150, top: 2, stage: 1 },
  { id: 'ub_b2', x0: -24, x1: -20, z0: -150, z1: -162, top: 2, stage: 1 },
  { id: 'ub_c1', x0: -24, x1: 16, z0: -191.2, z1: -206, top: 11, stage: 2 },
  { id: 'ub_alc', x0: -30, x1: -24, z0: -196, z1: -201, top: 11, stage: 2 },
  { id: 'ub_sh1', x0: 21, x1: 26, z0: -112, z1: -116, top: 12, stage: 'perch' },
  { id: 'ub_sh2', x0: -26, x1: -21, z0: -118, z1: -122, top: 12, stage: 'perch' },
];
/** Gold grates: { id, x0, x1, z0, z1, top, run }. G1: an 11-panel bridge A3 -> B1 (44 m, flat). G2: 12 steps B2 -> C1 (0.75 m each, 9 m up). */
export const UB_GRATES = [
  ...Array.from({ length: 11 }, (_, k) => ({ id: `g1_${k + 1}`, x0: -2, x1: 2, z0: -94 - k * 4, z1: -98 - k * 4, top: 2, run: 'G1' })),
  ...Array.from({ length: 12 }, (_, k) => ({ id: `g2_${k + 1}`, x0: -24, x1: -20, z0: -162.4 - k * 2.4, z1: -164.4 - k * 2.4, top: 2 + 0.75 * (k + 1), run: 'G2' })),
];
export const GRATE_T = 0.3; // grate thickness (a box from top - 0.3 to top)
/** Hedges in the Gardens: 16 parterres (10 x 7 m) and four screens round the pavilion, as { x0, x1, z0, z1 }. */
export const GARDEN_HEDGES = [
  ...[-37, -22, 22, 37].flatMap((x) => [-229, -243, -269, -283].map((z) => ({ x0: x - 5, x1: x + 5, z0: z + 3.5, z1: z - 3.5 }))),
  { x0: -13, x1: -9, z0: -239, z1: -245 }, { x0: 9, x1: 13, z0: -239, z1: -245 }, { x0: -13, x1: -9, z0: -267, z1: -273 }, { x0: 9, x1: 13, z0: -267, z1: -273 }, // 3 m off the centre beast's lanes (z -236, -276)
];
const UB_EDGE = 0.12; // a foothold edge is a cliff (a landing on the skirt slides off into the void)

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
    {
      // U23 chunk B. A traversal over the machine pit: three decks (A intake, B furnace row, C upper gantry) joined by two gold-grate
      // stretches that are solid only for a player holding Favor (G1 a 44 m bridge, G2 a 9 m climb). checkShadowRoute() proves no class jump skips them.
      id: 'underbelly', name: 'The Underbelly', kind: 'traversal',
      checkpoint: [0, 0, -40],
      region: { minX: -31, maxX: 28, minZ: -207, maxZ: -38, minY: -40, maxY: 40 },
      pit: { minX: -26, maxX: 26, minZ: -206, maxZ: -52 },
      fog: { color: 0x170d24, near: 8, far: 95 }, // dark steel and purple: the runtime swaps the fog while you are in here // ground under 1 m in here has no floor (dungeon.js sets voidAt)
      decks: [
        { id: 'a', foot: ['ub_in2', 'ub_a1', 'ub_a2', 'ub_a3'], checkpoint: [0, 2, -56], spawns: [[-10, 2, -88], [10, 2, -84], [0, 2, -91], [-6, 2, -82]], taster: [7, 2, -60], snipers: [[23.5, 12, -114], [-23.5, 12, -120]] },
        { id: 'b', foot: ['ub_b1', 'ub_b2'], checkpoint: [0, 2, -141], spawns: [[-14, 2, -146], [8, 2, -148], [-4, 2, -147], [-21, 2, -143]], taster: [10, 2, -141], snipers: [] },
        { id: 'c', foot: ['ub_c1', 'ub_alc'], checkpoint: [-20, 11, -194], spawns: [[0, 11, -200], [10, 11, -197], [-8, 11, -204], [12, 11, -204]], taster: [14, 11, -194], snipers: [] },
      ],
      grates: UB_GRATES,
      movers: [ // pistons: exotic-rules.js moverState / moverBox / moverSafe (imported, never edited). 9 m tall so their tops are no foothold
        { id: 'um1', p: [4.2, 6.5, -106], s: [1.4, 9, 3.2], axis: 'x', travel: -6.4, period: 7.0, phase: 0, push: 9, lane: 4 },
        { id: 'um2', p: [-4.2, 6.5, -124], s: [1.4, 9, 3.2], axis: 'x', travel: 6.4, period: 7.6, phase: 3.5, push: 9, lane: 4 },
        { id: 'um3', p: [-18.6, 11, -175.4], s: [1.4, 9, 2.4], axis: 'x', travel: -6.4, period: 7.2, phase: 1.6, push: 9, lane: 4 },
      ],
      vents: [ // furnace vents on walkway B2: the same clock; hot during fire + hold, they throw you east off the walkway
        { id: 'uv1', p: [-22, 4.5, -153.5], s: [4, 5, 3], period: 6.4, phase: 0, push: 9, lane: 3, dir: [1, 0] },
        { id: 'uv2', p: [-22, 4.5, -158.5], s: [4, 5, 3], period: 6.8, phase: 3.1, push: 9, lane: 3, dir: [1, 0] },
      ],
      watchers: { // Imperial Watchers by deck: p is the deck spot (they hover 3 m up), yaw the centre of their sweep (0 faces +z)
        a: [{ p: [-9, 2, -86], yaw: 0.5, sweep: 0.9, period: 7, phase: 0 }, { p: [9, 2, -90], yaw: -0.5, sweep: 0.9, period: 8, phase: 2.5 }, { p: [0, 2, -62], yaw: Math.PI, sweep: 1.1, period: 9, phase: 1 }],
        b: [{ p: [6, 2, -146], yaw: 0.3, sweep: 1.0, period: 7.5, phase: 0 }, { p: [-20, 2, -142], yaw: 0.9, sweep: 0.8, period: 6.5, phase: 3 }],
        c: [{ p: [-16, 11, -200], yaw: 0.4, sweep: 1.0, period: 8, phase: 0 }, { p: [10, 11, -203], yaw: -0.3, sweep: 1.0, period: 7, phase: 2 }, { p: [2, 11, -194], yaw: -1.2, sweep: 0.7, period: 6, phase: 4 }],
      },
      plaque: { p: [-25.85, 6, -144], n: [1, 0] }, // the lever order, on B1's west wall: readable only with Favor
      levers: [{ p: [-12, 11, -205], sigil: 'axes' }, { p: [-4, 11, -205], sigil: 'chalice' }, { p: [4, 11, -205], sigil: 'sun' }, { p: [12, 11, -205], sigil: 'hound' }],
      hatch: { p: [-26, 11, -198.5], w: 5, h: 4.5, axis: 'z' }, // the secret alcove door in C's west wall
      secretChest: [-28.6, 11, -198.5],
      exit: { p: [0, 11, -209], r: 3.5 },
    },
    {
      // U23 chunk B. A walled garden on the deck above the pit. Royal Beasts patrol by sight; Favored players carry a prism that lights
      // flowers (Bloom: a stacking weapon damage buff); all the round's flowers lit opens a DPS window on Kathrax, the Royal Huntmaster.
      id: 'gardens', name: 'The Pleasure Gardens', kind: 'boss',
      checkpoint: [0, 11, -211],
      region: { minX: -50, maxX: 50, minZ: -298, maxZ: -215, minY: 5, maxY: 45 },
      pavilion: { p: [0, GY + PAV_H, -256], r: 7 },
      hedges: GARDEN_HEDGES, // solid, 2.8 m tall: they block a beast's sight
      hedgeH: 2.8,
      flowers: [[-37, GY, -236], [37, GY, -236], [-37, GY, -276], [37, GY, -276], [-22, GY, -256], [22, GY, -256], [0, GY, -222], [0, GY, -290]],
      beasts: [ // patrol loops (x, z) at the garden floor; a beast walks them and pauses at each corner to look about
        { path: [[-29.5, -236], [-29.5, -276], [-45, -276], [-45, -236]], phase: 0 },
        { path: [[29.5, -276], [29.5, -236], [45, -236], [45, -276]], phase: 0.5 },
        { path: [[-15, -236], [15, -236], [15, -276], [-15, -276]], phase: 0.25 },
      ],
      tasters: [[-46, GY, -219], [46, GY, -219], [-46, GY, -293], [46, GY, -293]],
      boss: [0, GY + PAV_H, -256],
      chest: [0, GY + PAV_H, -251],
      spawns: [[-30, GY, -256], [30, GY, -256], [-20, GY, -221], [20, GY, -221], [-20, GY, -291], [20, GY, -291]],
      gate: { p: [0, GY, -298], w: 7, h: 8, axis: 'x' },
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
  // U23 chunk B. The Underbelly: a ramp up the entry corridor (0 -> 2 m), then the footholds over the pit
  out.push({ type: 'ramp', x0: 0, z0: -40, x1: 0, z1: -48.05, width: 8, h0: 0, h1: 2, edge: 0.3 });
  for (const f of UB_FOOT) out.push({ type: 'plateau', x: (f.x0 + f.x1) / 2, z: (f.z0 + f.z1) / 2, w: f.x1 - f.x0, d: f.z0 - f.z1, h: f.top, edge: UB_EDGE });
  // The Gardens: the corridor from C1 and the garden floor at 11 m, and the pavilion (an octagon like the Baths' dais, 1.4 m up, four ramps)
  out.push({ type: 'plateau', x: 0, z: -210, w: 8, d: 8, h: GY, edge: UB_EDGE });
  out.push({ type: 'plateau', x: 0, z: -256, w: 104, d: 86, h: GY, edge: UB_EDGE });
  const pz = -256;
  out.push({ type: 'plateau', x: 0, z: pz, w: 2 * DR, d: 2 * DR, h: GY + PAV_H, edge: 0.25 });
  out.push({ type: 'plateau', x: 0, z: pz, w: 2 * DR, d: 2 * DR, h: GY + PAV_H, ry: Math.PI / 4, edge: 0.25 });
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    out.push({ type: 'ramp', x0: dx * (DR + RAMP_RUN - 0.05), z0: pz + dz * (DR + RAMP_RUN - 0.05), x1: dx * (DR - 0.05), z1: pz + dz * (DR - 0.05), width: RAMP_W, h0: GY, h1: GY + PAV_H, edge: 0.5 });
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
  zoneNames: ['The Imperial Baths', 'The Underbelly', 'The Pleasure Gardens'], missions: [],
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
// U23 chunk B drawing: the Underbelly (north of the Baths) and the Pleasure Gardens. Everything here is VISUAL except the walls, the deck
// cover and the Gardens' hedges, colonnade columns, pavilion columns, tree trunks, fountain cores, statue plinths and brazier pedestals.
// NOTHING solid stands in the pit (x -26..26, z -52..-206) but the walls and UB_COVER: an extra surface could let a player skip a grate run.
// ---------------------------------------------------------------------------------------------------------------------------------
const ST = 0x2a2d34, ST2 = 0x3a3e48, ST3 = 0x1c1e24, VIO = 0x8a3cff, VIOD = 0x5a1f9e, FURN = 0xff7a2a, ABYSS = 0x0d0614, AMBER = 0xffb35a;
const HEDGE = 0x2d5a30, HEDGE2 = 0x4f8f45, GRASS = 0x4a8a3e, BARK = 0x5a3a22;

/** Cover on the decks (solid, at most 2.2 m above the deck top, at least 1.5 m in from its edges). deck = a UB_FOOT id. */
export const UB_COVER = [
  { deck: 'ub_a1', x: -6.5, z: -55.5, w: 2.4, d: 2.4, h: 1.4, kind: 'crate' },
  { deck: 'ub_a1', x: -6.5, z: -60.5, w: 2.4, d: 2.4, h: 2.0, kind: 'pump' },
  { deck: 'ub_a1', x: 6.5, z: -55.5, w: 2.4, d: 2.4, h: 1.4, kind: 'crate' },
  { deck: 'ub_a3', x: -6.5, z: -85.5, w: 2.4, d: 2.2, h: 1.8, kind: 'pump' },
  { deck: 'ub_a3', x: 6.5, z: -84, w: 2.6, d: 2.0, h: 1.4, kind: 'crate' },
  { deck: 'ub_a3', x: -10.5, z: -91, w: 2.2, d: 2.0, h: 1.8, kind: 'crate' },
  { deck: 'ub_a3', x: 10.5, z: -90.5, w: 2.2, d: 2.0, h: 2.0, kind: 'pump' },
  { deck: 'ub_b1', x: -9, z: -144, w: 2.4, d: 2.2, h: 1.6, kind: 'crate' },
  { deck: 'ub_b1', x: 3, z: -145.5, w: 2.6, d: 2.2, h: 1.8, kind: 'pump' },
  { deck: 'ub_b1', x: 11, z: -145, w: 2.2, d: 2.2, h: 1.4, kind: 'crate' },
  { deck: 'ub_b1', x: -15, z: -141, w: 2.4, d: 2.0, h: 2.0, kind: 'pump' },
  { deck: 'ub_c1', x: -12, z: -196, w: 2.4, d: 2.2, h: 1.8, kind: 'crate' },
  { deck: 'ub_c1', x: -12, z: -201, w: 2.4, d: 2.2, h: 1.6, kind: 'pump' },
  { deck: 'ub_c1', x: 6, z: -195.5, w: 2.6, d: 2.2, h: 1.4, kind: 'crate' },
  { deck: 'ub_c1', x: 12.5, z: -200.5, w: 2.2, d: 2.2, h: 2.0, kind: 'pump' },
];

/** Visual box by extents with the z pair in either order. */
const vxs = (K, x0, x1, y0, y1, za, zb, color, o) => vx(K, x0, x1, y0, y1, Math.min(za, zb), Math.max(za, zb), color, o);
/** Solid box by extents with the z pair in either order. */
const sol = (K, x0, x1, y0, y1, za, zb, color, o) => solid(K, x0, x1, y0, y1, Math.min(za, zb), Math.max(za, zb), color, o);
const cylv = (K, x, y, z, rt, rb, h, color, o = {}, seg = 10) => vb(K, x, y, z, 1, 1, 1, color, { geo: new THREE.CylinderGeometry(rt, rb, h, seg), ...o });
const ringv = (K, x, y, z, r, t, color, o = {}) => vb(K, x, y, z, 1, 1, 1, color, { geo: new THREE.TorusGeometry(r, t, 5, 28).rotateX(Math.PI / 2), ...o });
/** A copy of K whose builders put everything `dy` higher, so floor-level helpers (statue, banner) can be reused on the Gardens' floor. */
function lifted(K, dy) {
  const s = Object.create(K);
  s.scene = { add: (m) => { m.position.y += dy; K.scene.add(m); } };
  s.box = (x, z, w, h, d, color, o = {}) => K.box(x, z, w, h, d, color, { ...o, y: (o.y ?? 0) + dy, abs: true });
  return s;
}
/** A flat slab ramp from (x0, z0) at height y0 up to (x1, z1) at y1 (the technique of the Baths' dais ramps), with gold side rails. */
function rampSlab(K, x0, z0, x1, z1, y0, y1, w, th, color) {
  const len = Math.hypot(x1 - x0, z1 - z0), rise = y1 - y0, pitch = Math.atan2(rise, len), L = Math.hypot(len, rise);
  const yaw = Math.atan2(-(z1 - z0), x1 - x0);
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  vb(K, mx, y0 + rise / 2 - (Math.cos(pitch) * th) / 2 + 0.02, mz, L, th, w, color, { ry: yaw, rz: pitch, shadow: true });
  for (const s of [-1, 1]) vb(K, mx + Math.sin(yaw) * s * (w / 2), y0 + rise / 2 + 0.07, mz + Math.cos(yaw) * s * (w / 2), L, 0.1, 0.2, GOLD, { ry: yaw, rz: pitch, glow: 0.3 });
}
/** A hanging lamp from the ceiling (y 32): rod, cage, a glowing bulb and a pooled light. */
function hangLamp(K, x, y, z, color, intensity = 8, dist = 30) {
  cylv(K, x, (y + 32) / 2, z, 0.06, 0.06, 32 - y, ST, {}, 5);
  cylv(K, x, y, z, 0.5, 0.36, 0.8, ST2, {}, 8);
  cylv(K, x, y + 0.5, z, 0.2, 0.5, 0.2, GOLDD, {}, 8);
  vb(K, x, y - 0.1, z, 1, 1, 1, color, { geo: new THREE.IcosahedronGeometry(0.3, 0), glow: 2.2 });
  lamp(K, x, y - 0.6, z, color, intensity, dist);
}
/** An Underbelly foothold: a steel deck plate (top exactly at f.top, 0.6 m deep) with gold edge trim, plate seams and a purple under-glow. */
function ubDeck(K, f) {
  const { x0, x1, top } = f, za = Math.min(f.z0, f.z1), zb = Math.max(f.z0, f.z1);
  vxs(K, x0, x1, top - 0.6, top, za, zb, ST2);
  for (let z = za + 1.5; z < zb - 0.5; z += 3) vxs(K, x0 + 0.15, x1 - 0.15, top, top + 0.012, z - 0.04, z + 0.04, ST3);
  const t = 0.2, e = 0.025;
  vxs(K, x0, x1, top, top + e, za, za + t, GOLD, { glow: 0.3 });
  vxs(K, x0, x1, top, top + e, zb - t, zb, GOLD, { glow: 0.3 });
  vxs(K, x0, x0 + t, top, top + e, za, zb, GOLD, { glow: 0.3 });
  vxs(K, x1 - t, x1, top, top + e, za, zb, GOLD, { glow: 0.3 });
  vxs(K, x0, x1, top - 0.5, top - 0.4, za - 0.04, za, VIOD, { glow: 1.2 });
  vxs(K, x0, x1, top - 0.5, top - 0.4, zb, zb + 0.04, VIOD, { glow: 1.2 });
  vxs(K, x0 - 0.04, x0, top - 0.5, top - 0.4, za, zb, VIOD, { glow: 1.2 });
  vxs(K, x1, x1 + 0.04, top - 0.5, top - 0.4, za, zb, VIOD, { glow: 1.2 });
}
/** Girders hanging from a deck into the pit (visual only): posts at both long edges and two levels of cross beams. */
function ubGirders(K, f) {
  const { x0, x1, top } = f, za = Math.min(f.z0, f.z1), zb = Math.max(f.z0, f.z1);
  const n = Math.ceil((x1 - x0) / 7) + 1;
  for (let i = 0; i < n; i++) {
    const x = x0 + 0.6 + ((x1 - x0 - 1.2) * i) / (n - 1);
    for (const z of [za + 0.5, zb - 0.5]) {
      vxs(K, x - 0.25, x + 0.25, -20, top - 0.6, z - 0.25, z + 0.25, ST);
      vxs(K, x - 0.4, x + 0.4, top - 1.0, top - 0.6, z - 0.4, z + 0.4, GOLDD);
    }
  }
  for (const y of [-6, -14]) for (const z of [za + 0.5, zb - 0.5]) vxs(K, x0 + 0.6, x1 - 0.6, y - 0.2, y + 0.2, z - 0.2, z + 0.2, ST2);
  for (const x of [x0 + 0.6, x1 - 0.6]) vxs(K, x - 0.2, x + 0.2, -6.2, -5.8, za + 0.5, zb - 0.5, ST2);
}
/** A sniper shelf: a steel plate on two diagonal brackets and a back plate on the wall. */
function ubShelf(K, f) {
  const { x0, x1, top } = f, za = Math.min(f.z0, f.z1), zb = Math.max(f.z0, f.z1);
  const s = x1 >= 26 ? 1 : -1, wx = s > 0 ? 26 : -26; // the wall side
  vxs(K, x0, x1, top - 0.3, top, za, zb, ST2);
  const out0 = s > 0 ? x0 : x1; // the open edge
  vxs(K, Math.min(out0, out0 + (s > 0 ? 0.2 : -0.2)), Math.max(out0, out0 + (s > 0 ? 0.2 : -0.2)), top, top + 0.03, za, zb, GOLD, { glow: 0.3 });
  vxs(K, x0, x1, top, top + 0.03, za, za + 0.15, GOLD, { glow: 0.3 });
  vxs(K, x0, x1, top, top + 0.03, zb - 0.15, zb, GOLD, { glow: 0.3 });
  vxs(K, Math.min(wx, wx - s * 0.3), Math.max(wx, wx - s * 0.3), top - 5, top, za, zb, ST);
  for (const z of [za + 0.6, zb - 0.6]) {
    const dx = -s * 4.4, dy = -4.2, len = Math.hypot(dx, dy);
    vb(K, wx + dx / 2, top - 0.4 + dy / 2, z, len, 0.25, 0.3, ST, { rz: Math.atan2(dy, dx) });
    vb(K, wx + dx, top - 4.6, z, 0.5, 0.3, 0.5, GOLDD);
  }
}
/** A solid cover box on a deck: steel crate or pump housing with gold trim (all within the box's own extents). */
function ubCover(K, c, top) {
  const hh = c.h, x0 = c.x - c.w / 2, x1 = c.x + c.w / 2, z0 = c.z - c.d / 2, z1 = c.z + c.d / 2;
  if (c.kind === 'pump') {
    sol(K, x0, x1, top, top + hh - 0.3, z0, z1, ST2);
    vb(K, c.x, top + hh - 0.15, c.z, 1, 1, 1, GOLDD, { geo: new THREE.CylinderGeometry(Math.min(c.w, c.d) * 0.42, Math.min(c.w, c.d) * 0.42, 0.3, 10) });
    for (const sx of [-1, 1]) vb(K, c.x + sx * (c.w / 2 + 0.01), top + hh * 0.45, c.z, 0.04, 0.3, 0.3, VIO, { glow: 1.6 });
    vb(K, c.x, top + 0.45, c.z, c.w + 0.06, 0.12, c.d + 0.06, GOLD, { glow: 0.3 });
  } else {
    sol(K, x0, x1, top, top + hh, z0, z1, ST2);
    vb(K, c.x, top + hh - 0.05, c.z, c.w + 0.05, 0.1, c.d + 0.05, GOLD, { glow: 0.3 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) vb(K, c.x + sx * c.w / 2, top + hh / 2, c.z + sz * c.d / 2, 0.1, hh, 0.1, GOLDD);
    vb(K, c.x, top + hh * 0.5, c.z, c.w + 0.02, 0.1, c.d + 0.02, ST3);
  }
}

function buildUnderbelly(K) {
  const foot = (id) => UB_FOOT.find((f) => f.id === id);
  const side = (s, a, b) => (s > 0 ? [a, b] : [-b, -a]);
  const WALL = ST2;

  // ============================== the entry corridor (z -38..-52): marble turning to steel ==============================
  vxs(K, -4, 4, -3, 0, -40, -38, MARB);
  vxs(K, -4, 4, -3, 0, -48, -40, ST3);
  rampSlab(K, 0, -40, 0, -48.05, 0, 2, 8, 0.5, ST2);
  const rampY = (z) => (2 * (-40 - z)) / 8.05;
  for (const z of [-41, -42.6, -44.2, -45.8, -47.4]) vb(K, 0, rampY(z) + 0.045, z, 6, 0.03, 0.4, VIO, { rx: Math.atan2(2, 8.05), glow: 1.4 });
  for (const s of [-1, 1]) {
    sol(K, ...side(s, 4, 6), -30, 10.5, -50, -38, WALL);
    for (const [z0, z1, c] of [[-38, -42, MARB2], [-42, -45, MARB3], [-45, -48, ST2], [-48, -50, ST]]) vxs(K, ...side(s, 3.9, 4), 0, 9, z0, z1, c);
    vxs(K, ...side(s, 3.84, 4), 4.3, 4.7, -50, -38, GOLD, { glow: 0.3 });
    vxs(K, ...side(s, 3.84, 4), 8.3, 8.6, -50, -38, GOLD, { glow: 0.3 });
    for (const [z, c] of [[-41.5, GOLDL], [-45, VIO], [-48.5, VIO]]) vxs(K, ...side(s, 3.82, 3.9), 1.5, 8, z - 0.1, z + 0.1, c, { glow: 1.6 });
  }
  vxs(K, -6, 6, 9, 10.5, -50, -38, ST2);
  for (const z of [-40, -44, -48]) vxs(K, -4, 4, 8.8, 9, z - 0.2, z + 0.2, GOLD, { glow: 0.3 });
  vxs(K, -0.4, 0.4, 8.75, 8.8, -50, -38, VIO, { glow: 1.6 });
  lamp(K, 0, 7.5, -42, AMBER, 8, 22);
  lamp(K, 0, 7.5, -48, VIO, 9, 24);

  // ============================== the machine hall: walls, ceiling ==============================
  wallRun(K, 'x', -51, -26, 26, -30, 32, 2, WALL, [{ a: -4, b: 4, top: 9.5 }]);                         // south wall, the corridor opening
  wallRun(K, 'z', -27, -208, -50, -30, 32, 2, WALL, [{ a: -201, b: -196, top: 15.5 }]);                  // west wall, the alcove opening
  sol(K, -28, -26, -30, 11, -201, -196, WALL);
  wallRun(K, 'z', 27, -208, -50, -30, 32, 2, WALL);                                                       // east wall
  wallRun(K, 'x', -207, -28, 28, -30, 32, 2, WALL, [{ a: -4, b: 4, top: 18 }]);                         // north wall, the way to the Gardens
  sol(K, -4, 4, -30, 11, -208, -206, WALL);
  vxs(K, -28, 28, 32, 34, -208, -50, ST3).castShadow = false;
  for (let z = -62; z >= -202; z -= 14) {
    vxs(K, -26, 26, 30.4, 32, z - 0.6, z + 0.6, ST2);
    vxs(K, -22, 22, 30.3, 30.4, z - 0.12, z + 0.12, VIO, { glow: 1.4 });
  }
  vxs(K, -0.5, 0.5, 30.2, 30.4, -204, -54, VIOD, { glow: 1.0 });
  // the corridor mouth on the hall side (z -52 face): a gold frame and purple lights; and the Gardens door's frame (z -206 face)
  for (const s of [-1, 1]) {
    vb(K, s * 4.5, 5.75, -52.2, 1.0, 7.5, 0.5, GOLD, { glow: 0.3 });
    vb(K, s * 6.5, 12, -52.15, 3.0, 20, 0.3, ST, {});
    vb(K, s * 4.5, 14.5, -205.7, 1.0, 7, 0.6, GOLD, { glow: 0.3 });
    vb(K, s * 4.5, 10.9, -205.7, 1.5, 0.3, 0.8, MARB3);
  }
  vb(K, 0, 9.75, -52.2, 10, 0.5, 0.5, GOLD, { glow: 0.3 });
  vb(K, 0, 18.5, -205.7, 10, 1.0, 0.6, GOLD, { glow: 0.3 });
  vb(K, 0, 19.9, -205.7, 12, 0.8, 0.5, MARB3);
  vb(K, 0, 21.2, -205.8, 1.6, 1.6, 0.3, GOLDL, { glow: 1.4, ry: Math.PI / 4 });
  for (const s of [-1, 1]) {                                                                              // purple tapestries either side of the door
    vb(K, s * 11, 20, -205.9, 9, 10, 0.1, GOLD);
    vb(K, s * 11, 20, -205.85, 8.4, 9.4, 0.14, PURP);
    vb(K, s * 11, 20.5, -205.75, 1.4, 1.4, 0.2, GOLDL, { glow: 1.0, ry: Math.PI / 4 });
  }
  vb(K, 0, 9.5, -52.15, 52, 0.2, 0.2, GOLD, { glow: 0.3 });
  for (const x of [-18, -10, 10, 18]) vb(K, x, 6, -52.12, 0.5, 5, 0.12, VIO, { glow: 1.5 });

  // wall ribs, bands and pipes (visual): the walls are a steel curtain of ribs with a gold band
  for (const s of [-1, 1]) {
    for (let z = -58; z >= -202; z -= 12) {
      if (s < 0 && (z === -118 || z === -142 || z === -154 || z === -202)) continue; // shelf, plaque, furnace soot, hatch
      vxs(K, ...side(s, 25.4, 26), -22, 30, z - 0.6, z + 0.6, ST);
      for (const y of [8, 20]) vxs(K, ...side(s, 25.34, 26), y - 0.15, y + 0.15, z - 0.7, z + 0.7, GOLDD);
    }
    vxs(K, ...side(s, 25.7, 26), 8.4, 8.7, -204, -52, GOLD, { glow: 0.25 });
  }
  const pipes = [[1, [-58, -76, -98, -126, -150, -172, -190]], [-1, [-60, -80, -104, -130]]];
  for (const [s, zs] of pipes) for (const z of zs) {
    cylv(K, s * 24.8, 3.5, z, 0.6, 0.6, 55, ST2, {}, 8);
    for (const y of [-12, 0, 12, 24]) cylv(K, s * 24.8, y, z, 0.8, 0.8, 0.35, GOLDD, {}, 8);
    vb(K, s * 24.8, 14, z, 1, 1, 1, VIO, { geo: new THREE.CylinderGeometry(0.62, 0.62, 0.4, 8), glow: 1.2 });
  }
  // gauges: a round brass dial with a purple face on the ribs
  for (const [s, z, y] of [[1, -64, 16], [-1, -88, 15], [1, -134, 17], [-1, -170, 18], [1, -182, 15]]) {
    vb(K, s * 25.55, y, z, 1, 1, 1, GOLD, { geo: new THREE.CylinderGeometry(1.1, 1.1, 0.2, 14).rotateZ(Math.PI / 2), glow: 0.3 });
    vb(K, s * 25.4, y, z, 1, 1, 1, VIO, { geo: new THREE.CylinderGeometry(0.85, 0.85, 0.1, 14).rotateZ(Math.PI / 2), glow: 1.2 });
    vb(K, s * 25.3, y, z, 0.06, 0.12, 0.9, AMBER, { rx: 0.5, glow: 1.0 });
  }

  // ============================== the footholds (a plate each) ==============================
  for (const f of UB_FOOT) {
    if (f.stage === 'perch') { ubShelf(K, f); continue; }
    ubDeck(K, f);
    if (['ub_a1', 'ub_a3', 'ub_b1', 'ub_c1'].includes(f.id)) ubGirders(K, f);
  }
  // the ramp into the first deck: the in-corridor flat is a gold-trimmed plate; a brass rail either side of the mouth
  const in2 = foot('ub_in2');
  for (const s of [-1, 1]) vxs(K, ...side(s, 3.7, 4), in2.top, in2.top + 0.9, -52, -48, GOLDD);
  // ---- the secret alcove behind the west wall's hatch (the runtime builds the hatch) ----
  sol(K, -32, -30, 11, 16, -202, -195, WALL);
  sol(K, -30, -26, 11, 16, -196, -195, WALL);
  sol(K, -30, -26, 11, 16, -202, -201, WALL);
  vxs(K, -32, -26, 16, 16.6, -202, -195, ST3);
  vb(K, -29.88, 13.5, -198.5, 0.12, 4.2, 4.2, GOLD, { glow: 0.3 });
  vb(K, -29.82, 13.5, -198.5, 0.14, 3.6, 3.6, PURP);
  vb(K, -29.7, 13.5, -198.5, 0.2, 1, 1, GOLDL, { glow: 1.2, ry: Math.PI / 4 });
  for (const z of [-195.4, -201.6]) vb(K, -28, 13.6, z, 4, 0.18, 0.2, GOLD, { glow: 0.3 });
  vxs(K, -32, -26, 11, 11.04, -202, -195, GOLDD);
  lamp(K, -29, 14.5, -198.5, GOLDL, 6, 16);

  // ============================== deck cover ==============================
  for (const c of UB_COVER) ubCover(K, c, foot(c.deck).top);

  // ============================== the grates' housings (the runtime builds the grates; these hang under their line) ==============================
  for (const g of UB_GRATES) {
    if (g.run === 'G1') {
      for (const s of [-1, 1]) {
        vxs(K, s * 2.1 - 0.1, s * 2.1 + 0.1, 0.6, 1.35, g.z1 + 0.06, g.z0 - 0.06, GOLDD);
        vxs(K, s * 2.1 - 0.14, s * 2.1 + 0.14, 1.3, 1.35, g.z1 + 0.06, g.z0 - 0.06, GOLD, { glow: 0.3 });
      }
      vxs(K, -2.1, 2.1, 0.9, 1.0, (g.z0 + g.z1) / 2 - 0.1, (g.z0 + g.z1) / 2 + 0.1, ST2);
    } else {
      vxs(K, -26, -25.5, g.top - 1.0, g.top, g.z1, g.z0, GOLDD);                  // the brass rack: one tread's worth of bracket per step
      vxs(K, -26, -25.46, g.top - 0.05, g.top, g.z1, g.z0, GOLD, { glow: 0.3 });
    }
  }
  vxs(K, -26, -25.5, 2, 11.5, -191.6, -162, ST);                                     // the rack's back plate

  // ============================== the abyss, the glow and the steam ==============================
  vxs(K, -26, 26, -25, -24, -206, -52, ABYSS);
  fx(K, new THREE.PlaneGeometry(52, 154).rotateX(-Math.PI / 2), VIOD, 0.45, 0, -23.9, -129, { add: true });
  fx(K, new THREE.PlaneGeometry(52, 154).rotateX(-Math.PI / 2), VIO, 0.1, 0, -14, -129, { add: true });
  for (const [x, z] of [[-6, -70], [8, -110], [-8, -128], [10, -166], [-12, -186]]) fx(K, new THREE.CylinderGeometry(1.4, 2.6, 16, 10, 1, true), STEAM, 0.07, x, -14, z);
  for (const z of [-84, -128, -178]) { const x = z === -128 ? 8 : -10; lamp(K, x, -8, z, VIO, 12, 40); }

  // pump cylinders standing on the abyss, their tops far below any foothold (top y -7)
  for (const [x, z, r] of [[-17, -100, 2.6], [16, -118, 3], [-8, -128, 2.2], [18, -156, 2.8], [8, -168, 2.4], [-10, -178, 3.0], [12, -186, 2.6], [-18, -70, 2.4], [16, -66, 2.2]]) {
    cylv(K, x, -15.5, z, r, r * 1.1, 17, ST2, { shadow: true }, 12);
    for (const y of [-21, -15, -9.4]) cylv(K, x, y, z, r * 1.12, r * 1.12, 0.45, GOLDD, {}, 12);
    cylv(K, x, -7.4, z, r * 0.8, r, 0.8, ST, {}, 12);
    vb(K, x, -12, z + r + 0.02, 1.2, 1.6, 0.1, VIO, { glow: 1.5 });
    cylv(K, x, -13, z, 0.4, 0.4, 6, ST, { rz: Math.PI / 2 }, 6); // a stub of exhaust pipe
  }
  // crank wheels turning on the walls, centres at y -10, radius 3.5 (top -6.5)
  for (const [x, z] of [[-24.4, -90], [24.4, -112], [-24.4, -168], [24.4, -162]]) {
    vb(K, x, -10, z, 1, 1, 1, GOLDD, { geo: new THREE.TorusGeometry(3.5, 0.35, 5, 18).rotateY(Math.PI / 2) });
    cylv(K, x, -10, z, 0.7, 0.7, 0.8, GOLD, { rz: Math.PI / 2, glow: 0.3 }, 8);
    for (let k = 0; k < 3; k++) vb(K, x, -10, z, 0.3, 7, 0.3, ST2, { rx: (k * Math.PI) / 3 });
  }
  // chains hanging from the ceiling, ending in a gold weight (their ends stay above y 20)
  for (const [x, z] of [[-12, -70], [10, -100], [0, -118], [-10, -150], [12, -170], [0, -186], [-14, -128]]) {
    cylv(K, x, 27.5, z, 0.05, 0.05, 9, ST, {}, 4);
    for (let k = 0; k < 6; k++) vb(K, x, 31 - k * 1.4, z, 1, 1, 1, ST2, { geo: new THREE.TorusGeometry(0.2, 0.05, 4, 8), ry: k % 2 ? Math.PI / 2 : 0 });
    vb(K, x, 22.8, z, 1, 1, 1, GOLD, { geo: new THREE.IcosahedronGeometry(0.4, 0), glow: 0.3 });
  }
  // hanging lamps along the route: over each deck and the bridge, purple and amber
  hangLamp(K, 0, 25, -58, AMBER, 9, 30);
  hangLamp(K, 0, 25, -72, VIO, 8, 28);
  hangLamp(K, 0, 25, -87, AMBER, 9, 30);
  hangLamp(K, -4, 25, -116, VIO, 8, 30);
  hangLamp(K, -6, 25, -144, AMBER, 9, 30);
  hangLamp(K, -20, 25, -174, VIO, 8, 30);
  hangLamp(K, 0, 28, -199, AMBER, 10, 34);
  lamp(K, -22, 6, -156, FURN, 9, 26);

  // ============================== furnace walkway B2: scorch marks round the vents, soot on the wall ==============================
  const b2 = foot('ub_b2');
  for (const [za, zb] of [[-152, -155], [-157, -160]]) {
    vxs(K, -24, -20, b2.top, b2.top + 0.01, za, zb, 0x15121a);
    vxs(K, -26, -25.9, 2, 13, za + 0.5, zb - 0.5, 0x16131a);
    vxs(K, -26, -25.88, 2, 5.4, za, zb, 0x22140e);
  }
  vxs(K, -25.9, -25.85, 5, 5.4, -152, -160, FURN, { glow: 1.6 });
  // ============================== the pistons' rest-side housing posts (visual) ==============================
  for (const [x0, x1, z0, z1, y0, y1] of [[4.9, 6.5, -104.4, -107.6, 2, 11], [-6.5, -4.9, -122.4, -125.6, 2, 11], [-17.9, -16.3, -174.2, -176.6, 6.5, 15.5]]) {
    vxs(K, x0, x1, y0, y1, z0, z1, ST2);
    for (const y of [y0 + 1, (y0 + y1) / 2, y1 - 1]) vxs(K, x0 - 0.1, x1 + 0.1, y - 0.2, y + 0.2, z0 + 0.1, z1 - 0.1, GOLDD);
    vxs(K, x0 + 0.3, x1 - 0.3, y0 + 0.5, y1 - 0.5, Math.min(z0, z1) - 0.04, Math.min(z0, z1), VIO, { glow: 1.2 });
  }
  vxs(K, -26, -16.3, 14.6, 15.4, -175.8, -174.6, ST2); // um3's mount to the west wall
}

/** A gold frame round a Gardens door in a wall facing z: `z` is the wall face, `dir` +1 when the garden lies on the +z side. */
function gardenFrame(K, z, dir, top, hw) {
  const L = lifted(K, GY), oh = top - GY; // oh: the opening's height above the garden floor
  for (const s of [-1, 1]) {
    vb(L, s * (hw + 0.65), oh / 2 + 0.5, z + dir * 0.4, 1.3, oh + 1, 1.4, GOLD, { glow: 0.35 });
    vb(L, s * (hw + 0.65), 0.45, z + dir * 0.4, 1.9, 0.9, 1.9, MARB3);
    vb(L, s * (hw + 1.8), oh / 2 + 2, z + dir * 0.3, 1.0, oh + 4, 1.2, MARB2);
    for (let i = 0; i < 3; i++) vb(L, s * (hw + 0.65), 1.6 + i * 1.6, z + dir * 1.12, 0.45, 0.45, 0.16, GOLDL, { glow: 0.9, ry: Math.PI / 4 });
  }
  vb(L, 0, oh + 0.5, z + dir * 0.4, 2 * hw + 3.2, 1.2, 1.4, GOLD, { glow: 0.35 });
  vb(L, 0, oh + 1.6, z + dir * 0.4, 2 * hw + 5, 0.8, 1.6, MARB3);
  vb(L, 0, oh + 2.6, z + dir * 0.5, 1.4, 1.4, 0.3, GOLDL, { glow: 1.4, ry: Math.PI / 4 });
}
/** A column on the Gardens floor (base y GY), solid, with gold bands and a capital. */
function gardenColumn(K, x, z, h, w) {
  sol(K, x - w / 2, x + w / 2, GY, GY + h, z - w / 2, z + w / 2, MARB2);
  vb(K, x, GY + 0.3, z, w + 0.5, 0.6, w + 0.5, MARB3);
  for (const f of [0.15, 0.5, 0.8]) vb(K, x, GY + h * f, z, w + 0.14, 0.4, w + 0.14, GOLD, { glow: 0.3 });
  vb(K, x, GY + h - 0.4, z, w + 0.7, 0.8, w + 0.7, GOLD, { glow: 0.3 });
}
/** A brazier pedestal for an alcove: solid pedestal, a gold bowl and a flame (no light of its own). */
function gardenBrazier(K, x, z) {
  sol(K, x - 0.45, x + 0.45, GY, GY + 1.3, z - 0.45, z + 0.45, GOLDD);
  vb(K, x, GY + 0.15, z, 1.3, 0.3, 1.3, MARB3);
  cylv(K, x, GY + 1.5, z, 0.9, 0.45, 0.5, GOLD, { glow: 0.3 }, 8);
  vb(K, x, GY + 2.1, z, 1, 1, 1, 0xff9a2a, { geo: new THREE.ConeGeometry(0.5, 1.1, 5), glow: 2.2 });
  vb(K, x, GY + 1.95, z, 1, 1, 1, 0xffd870, { geo: new THREE.ConeGeometry(0.28, 0.8, 5), glow: 2.6 });
}
/** A fountain: a solid core 3.2 m square and 0.5 m high (inside a visual round rim of radius 2.4), tiered bowls and jets. */
function gardenFountain(K, x, z) {
  sol(K, x - 1.6, x + 1.6, GY, GY + 0.5, z - 1.6, z + 1.6, MARB2);
  cylv(K, x, GY + 0.25, z, 2.4, 2.4, 0.5, MARB, { shadow: true }, 16);
  ringv(K, x, GY + 0.52, z, 2.35, 0.09, GOLD, { glow: 0.4 });
  vb(K, x, GY + 0.47, z, 1, 1, 1, 0x9fe0ff, { geo: new THREE.CircleGeometry(2.1, 16).rotateX(-Math.PI / 2), glow: 0.5 });
  cylv(K, x, GY + 1.1, z, 0.35, 0.55, 1.2, MARB, {}, 8);
  cylv(K, x, GY + 1.8, z, 1.1, 0.45, 0.3, GOLD, { glow: 0.3 }, 10);
  cylv(K, x, GY + 2.4, z, 0.2, 0.3, 1.0, MARB, {}, 8);
  cylv(K, x, GY + 3.0, z, 0.7, 0.25, 0.25, GOLD, { glow: 0.3 }, 10);
  fx(K, new THREE.ConeGeometry(0.5, 1.6, 8, 1, true), 0xcff0ff, 0.28, x, GY + 3.7, z);
  fx(K, new THREE.CylinderGeometry(1.6, 2.1, 1.0, 12, 1, true), 0xcff0ff, 0.15, x, GY + 1.0, z);
}
/** A flowering tree: a thin solid trunk, a dark leafy crown and pink, violet and gold blossoms. */
function gardenTree(K, x, z, k) {
  sol(K, x - 0.25, x + 0.25, GY, GY + 4.6, z - 0.25, z + 0.25, BARK);
  vb(K, x, GY + 0.2, z, 1.4, 0.4, 1.4, BARK);
  const cols = [0xff7ab8, 0xc79bff, 0xffd24a];
  for (const [dx, dy, dz, r] of [[0, 5.6, 0, 2.3], [1.3, 5.0, 0.5, 1.6], [-1.2, 5.2, -0.6, 1.7], [0.2, 6.6, -0.2, 1.4]]) vb(K, x + dx, GY + dy, z + dz, 1, 1, 1, LEAF, { geo: new THREE.IcosahedronGeometry(r, 0), shadow: true });
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + k;
    vb(K, x + Math.cos(a) * 2.0, GY + 5.4 + Math.sin(a * 1.7) * 1.0, z + Math.sin(a) * 2.0, 1, 1, 1, cols[(i + k) % 3], { geo: new THREE.IcosahedronGeometry(0.36, 0), glow: 0.4 });
  }
}

function buildGardens(K) {
  const L = lifted(K, GY);
  const WALL = MARB2;

  // ============================== the corridor from the Underbelly (z -206..-214) ==============================
  vxs(K, -4, 4, GY - 1, GY, -214, -206, MARB);
  vxs(K, -1.2, 1.2, GY, GY + 0.04, -214, -206, PURP);
  for (const s of [-1, 1]) {
    sol(K, ...(s > 0 ? [4, 6] : [-6, -4]), GY - 2, 18, -212, -206, WALL);
    vxs(K, ...(s > 0 ? [1.2, 1.4] : [-1.4, -1.2]), GY, GY + 0.05, -214, -206, GOLD, { glow: 0.3 });
    vxs(K, ...(s > 0 ? [3.88, 4] : [-4, -3.88]), GY + 3.2, GY + 3.6, -212, -206, GOLD, { glow: 0.3 });
    for (const z of [-208, -211]) vxs(K, ...(s > 0 ? [3.82, 4] : [-4, -3.82]), GY, 18, z - 0.3, z + 0.3, MARB3);
  }
  vxs(K, -6, 6, 18, 19.4, -214, -206, MARB3);
  vxs(K, -4, 4, 17.8, 18, -214, -206, GOLD, { glow: 0.3 });
  lamp(K, 0, 16, -210, GOLDL, 8, 22);

  // ============================== the garden: walls, floor, ceiling ==============================
  wallRun(K, 'z', -51, -300, -212, 0, 40, 2, WALL);                                   // west wall
  wallRun(K, 'z', 51, -300, -212, 0, 40, 2, WALL);                                    // east wall
  wallRun(K, 'x', -213, -52, 52, 0, 40, 2, MARB, [{ a: -4, b: 4, top: 18 }]);        // south wall, the door from the corridor
  wallRun(K, 'x', -299, -52, 52, 0, 40, 2, MARB, [{ a: -3.5, b: 3.5, top: 19 }]);   // north wall, the gate
  gardenFrame(K, -214, -1, 18, 4);   // the door's frame on its garden side faces north (-z)
  gardenFrame(K, -298, 1, 19, 3.5);  // the gate's frame
  vxs(K, -50, 50, GY - 1, GY, -214, -298, MARB);
  vxs(K, -3.5, 3.5, GY - 1, GY, -298, -300, MARB);
  vxs(K, -4, 4, GY - 1, GY, -212, -214, MARB);
  // gold border round the floor and a gold line down each side
  for (const [x0, x1, z0, z1] of [[-49.4, 49.4, -214.6, -215.0], [-49.4, 49.4, -297.4, -297.0], [-49.4, -49.0, -215, -297.2], [49.0, 49.4, -215, -297.2]]) vxs(K, x0, x1, GY, GY + 0.03, z0, z1, GOLD, { glow: 0.3 });
  // paths: marble strips with gold lines
  for (const z of [-236, -276]) for (const [a, b] of [[-46, -14], [14, 46]]) { vxs(K, a, b, GY, GY + 0.012, z - 2.5, z + 2.5, MARB3); vxs(K, a, b, GY, GY + 0.02, z - 0.08, z + 0.08, GOLD, { glow: 0.25 }); }
  for (const x of [-45, 45, -29.5, 29.5]) { vxs(K, x - 1.5, x + 1.5, GY, GY + 0.012, -217, -295, MARB3); vxs(K, x - 0.08, x + 0.08, GY, GY + 0.02, -217, -295, GOLD, { glow: 0.25 }); }
  for (const x of [-15, 15]) vxs(K, x - 1.5, x + 1.5, GY, GY + 0.012, -236, -276, MARB3);
  // the entrance path and the gate path: purple runner, gold edges
  for (const [z0, z1] of [[-214, -245], [-267, -298]]) {
    vxs(K, -2, 2, GY, GY + 0.025, z0, z1, PURP);
    for (const s of [-1, 1]) vxs(K, s * 2 - 0.1, s * 2 + 0.1, GY, GY + 0.035, z0, z1, GOLD, { glow: 0.3 });
  }
  // lawns under the hedges, with a low marble kerb all round (under 0.2 m, visual)
  const lawn = (x0, x1, za, zb, pad) => {
    vxs(K, x0 - pad, x1 + pad, GY, GY + 0.02, za - pad, zb + pad, GRASS);
    const k = 0.25, lo = GY + 0.15;
    vxs(K, x0 - pad - k, x1 + pad + k, GY, lo, za - pad - k, za - pad, MARB);
    vxs(K, x0 - pad - k, x1 + pad + k, GY, lo, zb + pad, zb + pad + k, MARB);
    vxs(K, x0 - pad - k, x0 - pad, GY, lo, za - pad, zb + pad, MARB);
    vxs(K, x1 + pad, x1 + pad + k, GY, lo, za - pad, zb + pad, MARB);
  };
  // ceiling (visual): a coffered flat roof, a gold grid, and a big round golden skylight over the pavilion
  const pz = -256, CY = 40;
  vxs(K, -52, 52, CY, CY + 2, -300, -212, MARB3).castShadow = false;
  for (let x = -48; x <= 48; x += 12) vxs(K, x - 0.4, x + 0.4, CY - 0.6, CY, -298, -214, MARB2);
  for (let z = -220; z >= -292; z -= 12) vxs(K, -50, 50, CY - 0.6, CY, z - 0.4, z + 0.4, MARB2);
  for (let x = -48; x <= 48; x += 12) vxs(K, x - 0.1, x + 0.1, CY - 0.64, CY - 0.6, -298, -214, GOLD, { glow: 0.4 });
  for (let z = -220; z >= -292; z -= 12) vxs(K, -50, 50, CY - 0.64, CY - 0.6, z - 0.1, z + 0.1, GOLD, { glow: 0.4 });
  vb(K, 0, CY - 0.5, pz, 1, 1, 1, MARB2, { geo: new THREE.CylinderGeometry(17, 17, 1.0, 24) });
  vb(K, 0, CY - 1.05, pz, 1, 1, 1, 0xffe2a0, { geo: new THREE.CircleGeometry(14, 28).rotateX(Math.PI / 2), glow: 2.2 });
  for (const r of [14.2, 16.4]) ringv(K, 0, CY - 1.0, pz, r, 0.4, GOLD, { glow: 0.5 });
  for (let k = 0; k < 12; k++) vb(K, Math.cos((k * Math.PI) / 6) * 10, CY - 1.08, pz + Math.sin((k * Math.PI) / 6) * 10, 12, 0.14, 0.5, GOLDL, { ry: -(k * Math.PI) / 6, glow: 0.9 });
  fx(K, new THREE.CylinderGeometry(10, 15, CY - GY - 2, 20, 1, true), 0xffe0a0, 0.07, 0, (CY + GY) / 2, pz, { add: true });
  lamp(K, 0, 34, pz, 0xffe2a0, 16, 70);

  // ============================== the pavilion at (0, 12.4, -256): an octagonal marble platform (copy of the Baths' dais) ==============================
  const PH = PAV_H, base = GY, R8 = DR / Math.cos(Math.PI / 8);
  vb(K, 0, base + PH / 2 + 0.02, pz, 1, 1, 1, MARB, { geo: new THREE.CylinderGeometry(R8, R8, PH + 0.04, 8).rotateY(Math.PI / 8), shadow: true });
  vb(K, 0, base + PH + 0.04, pz, 1, 1, 1, GOLD, { geo: new THREE.CylinderGeometry(6.1, 6.1, 0.05, 8).rotateY(Math.PI / 8), glow: 0.3 });
  vb(K, 0, base + PH + 0.07, pz, 1, 1, 1, MARB2, { geo: new THREE.CylinderGeometry(5.5, 5.5, 0.05, 8).rotateY(Math.PI / 8) });
  for (let k = 0; k < 8; k++) vb(K, 0, base + PH + 0.1, pz, 5, 0.04, 0.5, GOLDL, { ry: (k * Math.PI) / 4, glow: 0.7 });
  vb(K, 0, base + PH + 0.1, pz, 1, 1, 1, GOLDL, { geo: new THREE.CylinderGeometry(1.2, 1.2, 0.06, 12), glow: 0.9 });
  vb(K, 0, base + PH - 0.1, pz, 1, 1, 1, GOLD, { geo: new THREE.CylinderGeometry(R8 + 0.12, R8 + 0.12, 0.2, 8).rotateY(Math.PI / 8), glow: 0.3 });
  ringv(K, 0, GY + 0.04, pz, 11, 0.2, GOLD, { glow: 0.4 });
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) rampSlab(K, dx * (DR + RAMP_RUN - 0.05), pz + dz * (DR + RAMP_RUN - 0.05), dx * (DR - 0.05), pz + dz * (DR - 0.05), GY, GY + PH, RAMP_W, 0.5, MARB);
  // eight slim gold columns round the rim (thin solid), a gold ring, rafters, a light canopy and a purple awning
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4, cx = Math.cos(a) * 6.5, cz = pz + Math.sin(a) * 6.5;
    sol(K, cx - 0.22, cx + 0.22, GY + PH, 18.8, cz - 0.22, cz + 0.22, GOLD);
    vb(K, cx, GY + PH + 0.25, cz, 0.7, 0.5, 0.7, GOLDD);
    vb(K, cx, 18.7, cz, 0.8, 0.3, 0.8, GOLDL, { glow: 0.4 });
  }
  ringv(K, 0, 19.0, pz, 6.5, 0.22, GOLD, { glow: 0.4 });
  for (let k = 0; k < 8; k++) vb(K, Math.cos((k * Math.PI) / 4 + Math.PI / 8) * 3.25, 19.1, pz + Math.sin((k * Math.PI) / 4 + Math.PI / 8) * 3.25, 6.5, 0.14, 0.2, GOLD, { ry: -((k * Math.PI) / 4 + Math.PI / 8), glow: 0.3 });
  vb(K, 0, 19.2, pz, 1, 1, 1, GOLDL, { geo: new THREE.CylinderGeometry(0.5, 0.5, 0.3, 8), glow: 1.2 });
  fx(K, new THREE.ConeGeometry(7.2, 1.8, 8, 1, true), 0xffeab0, 0.14, 0, 20.1, pz, { add: true });
  vb(K, 0, 21.2, pz, 1, 1, 1, PURP, { geo: new THREE.ConeGeometry(8.4, 1.9, 8), shadow: true });
  ringv(K, 0, 20.3, pz, 8.2, 0.16, GOLD, { glow: 0.4 });
  vb(K, 0, 22.5, pz, 1, 1, 1, GOLDL, { geo: new THREE.IcosahedronGeometry(0.3, 0), glow: 1.4 });
  lamp(K, 0, 17, pz, GOLDL, 14, 48);

  // ============================== hedges (solid, 2.8 m: line-of-sight blockers for the stealth mechanic), lawns, flowers ==============================
  const FL = [0xff7ab8, 0xc79bff, 0xffd24a, 0xff6a4a];
  GARDEN_HEDGES.forEach((h, i) => {
    const za = Math.min(h.z0, h.z1), zb = Math.max(h.z0, h.z1);
    lawn(h.x0, h.x1, za, zb, 0.7);
    sol(K, h.x0, h.x1, GY, GY + 2.8, za, zb, HEDGE);
    vxs(K, h.x0 + 0.15, h.x1 - 0.15, GY + 2.8, GY + 2.9, za + 0.15, zb - 0.15, HEDGE2);
    for (let k = 0; k < 3; k++) {
      const u = ((i * 37 + k * 53) % 100) / 100, v = ((i * 59 + k * 29) % 100) / 100;
      vb(K, h.x0 + 0.8 + (h.x1 - h.x0 - 1.6) * u, GY + 3.0, za + 0.8 + (zb - za - 1.6) * v, 1, 1, 1, FL[(i + k) % 4], { geo: new THREE.IcosahedronGeometry(0.34, 0), glow: 0.4 });
    }
  });

  // ============================== colonnades, banners, corner alcoves ==============================
  for (const s of [-1, 1]) {
    for (let z = -226; z >= -286; z -= 10) gardenColumn(K, s * 48.4, z, 16, 1.6);
    vxs(K, ...(s > 0 ? [47, 50] : [-50, -47]), GY + 16, GY + 17.4, -298, -214, GOLD, { glow: 0.3 });
    vxs(K, ...(s > 0 ? [47.2, 50] : [-50, -47.2]), GY + 17.4, GY + 18.6, -298, -214, MARB3);
    for (let z = -231; z >= -281; z -= 10) banner(L, s * 49.7, 10.5, z, 'x', 9);
    vxs(K, ...(s > 0 ? [49.7, 50] : [-50, -49.7]), GY, GY + 3.2, -298, -214, MARB3);
  }
  for (const [sx, sz] of [[-1, -219], [1, -219], [-1, -293], [1, -293]]) {
    gardenBrazier(K, sx * 48.5, sz);
    vb(K, sx * 49.8, GY + 4.5, sz, 0.2, 9, 6.4, GOLD, { glow: 0.3 });
    vb(K, sx * 49.7, GY + 4.5, sz, 0.2, 8.4, 5.8, PURP);
    vb(K, sx * 49.6, GY + 6.5, sz, 0.2, 1.2, 1.2, GOLDL, { glow: 1.2, ry: Math.PI / 4 });
    vb(K, sx * 46, GY + 0.02, sz, 4, 0.04, 4, PURP);
    lamp(K, sx * 46, GY + 4, sz, GOLDL, 6, 20);
  }

  // ============================== fountains, statues, trees ==============================
  for (const x of [-36, 36]) { gardenFountain(K, x, pz); lamp(K, x, GY + 6, pz, 0xffd890, 6, 24); }
  statue(L, -8, -292, 0);
  statue(L, 8, -292, 0);
  [[-10, -221], [10, -221], [-24, -220], [24, -220], [-24, -292], [24, -292], [-14, -290], [14, -290], [-41.5, -250], [41.5, -250], [-41.5, -262], [41.5, -262]].forEach(([x, z], k) => gardenTree(K, x, z, k));
  lamp(K, 0, 15, -295, GOLDL, 9, 26);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The set
// ---------------------------------------------------------------------------------------------------------------------------------
const SHADOW = {
  spawn: [0, 58],
  bounds: [-54, 54, -302, 67],
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

    // U23 chunk B: the Underbelly (z -38..-207) and the Pleasure Gardens (z -207..-300)
    buildUnderbelly(K);
    buildGardens(K);
  },
};

export default { shadow: SHADOW };
