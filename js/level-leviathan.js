// Hand-built Leviathan finale map (see makeKit in world.js).
// Emperor Calus's world-ship: white marble and gold, five halls in a row. A Loyalist hangar, the Pleasure
// Gardens under a glass dome, the Royal Pools (the Taken stalk here), the long red-gold Gauntlet and the
// Throne Room. Halls are closed rooms joined by gold doors that open as each zone is cleared.
import * as THREE from 'three';

// white marble, gold, cream stone, Loyalist crimson (U16d: opulent and bright; black only as a thin accent)
const MARB = 0xece6da, MARB2 = 0xdad2c3, MARB3 = 0xc2b9a8;
const GOLD = 0xd9a43a, GOLDL = 0xffc247, GOLDD = 0x8a6a22, CREAM = 0xe8dcc0;
const BANR = 0x7e1a22, CARPET = 0x5a1620, DECK = 0xd2ccbf, DECK2 = 0xc3ced8;
// gardens
const HEDGE = 0x2d6a38, HEDGE2 = 0x3e8a48, LAWN = 0x3a7a42, SOIL = 0x3a2a1e, BLOOM = [0xd04a8a, 0xe8883a, 0xe8d04a];
// pools and Taken blight
const WATER = 0x2f8ae0, BLUE = 0x59a8ff, TAINT = 0x7a2ad0, TAINT2 = 0x1c0a2e;
// Gauntlet
const RED = 0xff4a2a, EMBER = 0xff8a2a;

let _ub = null;
const UB = () => _ub || (_ub = new THREE.BoxGeometry(1, 1, 1));

// visual-only box, any rotation, no collider
function vbox(K, x, y, z, w, h, d, color, o = {}) {
  return K.mesh(UB(), color, x, y, z, { rx: o.rx, ry: o.ry, rz: o.rz, scale: [w, h, d], glow: o.glow });
}

// roof slabs and glass should not throw shadows over the hall below
function ceiling(K, x, y, z, w, h, d, color, o = {}) {
  const m = vbox(K, x, y, z, w, h, d, color, o);
  m.castShadow = false;
  return m;
}

// translucent unlit pane (glass, light shafts, waterfalls)
function pane(K, x, y, z, w, h, d, color, opacity = 0.25, o = {}) {
  const m = new THREE.Mesh(o.geo || UB(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: o.side ?? THREE.FrontSide, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending }));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  K.scene.add(m);
  return m;
}

// gold lamp: a glow bulb and a light (the kit lends the 6 nearest a real light)
function lamp(K, x, y, z, color = GOLDL, intensity = 7, dist = 28) {
  K.light(x, y, z, color, intensity, dist);
}

// Leviathan wall: white marble with a gold cornice. gaps are [centre, width] in world coordinates along the wall;
// each gets a lintel up to the wall top (door height doorH) and gold posts. Doors are placed separately with K.door.
function lwall(K, x1, z1, x2, z2, h, o = {}) {
  const horiz = Math.abs(x2 - x1) >= Math.abs(z2 - z1);
  const a0 = horiz ? Math.min(x1, x2) : Math.min(z1, z2), len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1), fixed = horiz ? z1 : x1;
  const t = o.t ?? 1.2, dh = o.doorH ?? 7, gaps = o.gaps || [];
  K.wall(x1, z1, x2, z2, h, { t, color: o.color ?? MARB2, gaps: gaps.map(([c, w]) => [c - w / 2 - a0, c + w / 2 - a0]) });
  const V = (along, y, L, hh, tt, color, opts) => (horiz ? vbox(K, along, y, fixed, L, hh, tt, color, opts) : vbox(K, fixed, y, along, tt, hh, L, color, opts));
  for (const [c, w] of gaps) {
    V(c, (dh + h) / 2, w + 0.6, h - dh, t, MARB3);
    V(c - w / 2 - 0.25, dh / 2, 0.5, dh, t + 0.3, GOLD, { glow: 0.3 });
    V(c + w / 2 + 0.25, dh / 2, 0.5, dh, t + 0.3, GOLD, { glow: 0.3 });
    V(c, dh + 0.15, w + 1.2, 0.3, t + 0.4, GOLDL, { glow: 0.9 });
  }
  V(a0 + len / 2, h - 0.2, len + 0.4, 0.4, t + 0.5, GOLD, { glow: 0.3 }); // cornice
  V(a0 + len / 2, 0.5, len, 0.5, t + 0.25, MARB3); // plinth
}

// Loyalist banner: crimson cloth, gold border and a glowing sun sigil. axis 'z' hangs on a wall facing z.
function banner(K, x, y, z, axis = 'z', h = 6) {
  const f = (w, hh, d) => (axis === 'z' ? [w, hh, d] : [d, hh, w]);
  vbox(K, x, y, z, ...f(2.6, h, 0.12), GOLD);
  vbox(K, x, y, z, ...f(2.1, h - 0.5, 0.2), BANR);
  vbox(K, x, y + h * 0.15, z, ...f(0.9, 0.9, 0.3), GOLDL, { glow: 1.2, ry: Math.PI / 4 });
}

// white marble pillar with gold bands, a capital and a banner on the inside face (face: +1 or -1 along z)
function bpillar(K, x, z, h, face, o = {}) {
  const w = o.w ?? 2.2;
  K.box(x, z, w, h, w, MARB2);
  vbox(K, x, 0.9, z, w + 0.3, 0.3, w + 0.3, GOLD, { glow: 0.5 });
  vbox(K, x, h - 0.7, z, w + 0.4, 0.4, w + 0.4, GOLD, { glow: 0.5 });
  banner(K, x, h * 0.55, z + face * (w / 2 + 0.1), 'z', Math.min(6, h * 0.5));
}

// life-size gilded statue on a plinth
function statue(K, x, z) {
  K.box(x, z, 1.6, 1.2, 1.6, MARB3);
  vbox(K, x, 1.25, z, 1.8, 0.2, 1.8, GOLD, { glow: 0.3 });
  vbox(K, x, 2.6, z, 0.9, 2.6, 0.6, CREAM);
  vbox(K, x, 4.1, z, 0.55, 0.55, 0.55, CREAM);
  vbox(K, x + 0.65, 3.3, z, 0.3, 1.4, 0.3, CREAM, { rz: -0.5 });
}

// tiered fountain, r = basin radius
function fountain(K, x, z, r) {
  K.cyl(x, z, r, 1.3, CREAM, { sides: 12 });
  K.mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.86, 0.1, 12), WATER, x, 1.25, z, { glow: 0.9 });
  K.mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.26, 3.2, 8), CREAM, x, 2.8, z, {});
  K.mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.3, 0.5, 10), GOLD, x, 4.2, z, { glow: 0.3 });
  K.mesh(new THREE.ConeGeometry(0.35, 2.2, 5), BLUE, x, 5.5, z, { glow: 1.1 });
  K.light(x, 4.8, z, GOLDL, 5, 22);
}

// hedge maze (decor): cols x rows cells, walls hashed on or off, outer ring closed with one gap on the avenue side
function maze(K, x0, z0, cols, rows, cell, seed, gapSide) {
  const hs = (a, b) => (((a + seed) * 73856093) ^ ((b + seed * 7) * 19349663)) >>> 0;
  const hedge = (cx, cz, w, d, k) => K.box(cx, cz, w, 2.4, d, k % 2 ? HEDGE : HEDGE2);
  const midRow = Math.floor(rows / 2);
  for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) {
    if (r > 0 && r < rows && hs(r, c) % 3 === 0) continue;
    hedge(x0 + (c + 0.5) * cell, z0 + r * cell, cell + 1.2, 1.2, hs(c, r));
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
    const edge = c === 0 || c === cols;
    if (edge && c === (gapSide === 'e' ? cols : 0) && r === midRow) continue;
    if (!edge && hs(c + 9, r) % 3 === 0) continue;
    hedge(x0 + c * cell, z0 + (r + 0.5) * cell, 1.2, cell + 1.2, hs(r, c + 3));
  }
  vbox(K, x0 + cols * cell / 2, 2.2, z0 + rows * cell / 2, 1.1, 1.1, 1.1, GOLDL, { glow: 1.2, ry: 0.8 });
}

// garden tree
function tree(K, x, z, s = 1) {
  K.cyl(x, z, 0.4 * s, 3 * s, SOIL, { sides: 5 });
  K.cone(x, z, 2.6 * s, 3.6 * s, HEDGE2, { y: 2.2 * s, collide: false });
  K.cone(x, z, 1.9 * s, 3 * s, HEDGE, { y: 4.6 * s, collide: false });
}

// glowing flower bed (no collider)
function bed(K, x, z, w, d, i) {
  vbox(K, x, 0.22, z, w, 0.2, d, SOIL);
  vbox(K, x, 0.4, z, w - 0.5, 0.15, d - 0.5, BLOOM[i % 3], { glow: 0.5 });
}

// Cabal beast pen: fenced yard with two crouching War Beasts
function pen(K, cx, cz, w, d, openSide) {
  const x1 = cx - w / 2, x2 = cx + w / 2, z1 = cz - d / 2, z2 = cz + d / 2;
  const gate = [[(openSide === 'e' || openSide === 'w' ? d : w) / 2 - 3, (openSide === 'e' || openSide === 'w' ? d : w) / 2 + 3]];
  const opt = (side) => ({ t: 0.4, color: GOLDD, gaps: side === openSide ? gate : [] });
  K.wall(x1, z1, x2, z1, 3, opt('n'));
  K.wall(x1, z2, x2, z2, 3, opt('s'));
  K.wall(x1, z1, x1, z2, 3, opt('w'));
  K.wall(x2, z1, x2, z2, 3, opt('e'));
  for (const [bx, bz, s] of [[cx - w * 0.2, cz - d * 0.15, 1], [cx + w * 0.15, cz + d * 0.2, 0.85]]) {
    vbox(K, bx, 0.9 * s, bz, 2.8 * s, 1.1 * s, 1.1 * s, MARB3);
    vbox(K, bx + 1.5 * s, 1.1 * s, bz, 0.9 * s, 0.8 * s, 0.9 * s, MARB2);
    vbox(K, bx + 2.0 * s, 1.15 * s, bz, 0.1, 0.18, 0.5, GOLDL, { glow: 1.6 });
    for (const lx of [-0.9, 0.9]) vbox(K, bx + lx * s, 0.3 * s, bz, 0.35, 0.6 * s, 0.9 * s, MARB);
  }
}

// raised pool: a solid marble basin (2.2 m, too high to climb) with a gold coping rim and glowing water on top
function poolBlock(K, x1, z1, x2, z2) {
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, w = x2 - x1, d = z2 - z1, H = 2.2;
  K.box(cx, cz, w, H, d, MARB2);
  vbox(K, cx, H + 0.25, z1 + 0.25, w + 0.5, 0.5, 0.5, GOLD, { glow: 0.25 });
  vbox(K, cx, H + 0.25, z2 - 0.25, w + 0.5, 0.5, 0.5, GOLD, { glow: 0.25 });
  vbox(K, x1 + 0.25, H + 0.25, cz, 0.5, 0.5, d, GOLD, { glow: 0.25 });
  vbox(K, x2 - 0.25, H + 0.25, cz, 0.5, 0.5, d, GOLD, { glow: 0.25 });
  vbox(K, cx, H + 0.3, cz, w - 1.2, 0.1, d - 1.2, WATER, { glow: 0.9 });
  vbox(K, cx, 0.45, z2 + 0.06, w * 0.8, 0.12, 0.1, BLUE, { glow: 1.4 });
}

// dark Taken blight creeping in from the edges: a black puddle with glowing violet thorns
function blight(K, x, z, s) {
  K.mesh(new THREE.CylinderGeometry(s, s * 1.15, 0.12, 7), TAINT2, x, 0.17, z, {});
  for (let k = 0; k < 2; k++) {
    const h = K.R(1.2, 2.8);
    K.mesh(new THREE.ConeGeometry(0.25, h, 4), TAINT, x + K.R(-s, s) * 0.6, 0.1 + h / 2, z + K.R(-s, s) * 0.6, { rz: K.R(-0.3, 0.3), glow: 1.3 });
  }
}

// gold arch over a walkway (two piers with colliders and a lintel)
function arch(K, x, z, w, h, axis = 'x', color = GOLD) {
  const px = axis === 'x' ? w / 2 : 0, pz = axis === 'x' ? 0 : w / 2;
  K.box(x - px, z - pz, 1.4, h, 1.4, MARB2);
  K.box(x + px, z + pz, 1.4, h, 1.4, MARB2);
  vbox(K, x, h + 0.4, z, axis === 'x' ? w + 2.2 : 1.8, 0.9, axis === 'x' ? 1.8 : w + 2.2, color, { glow: 0.5 });
}

// Loyalist landing pad (visual, no collider so enemies are never lifted)
function pad(K, x, z, s) {
  vbox(K, x, 0.1, z, s, 0.1, s, MARB);
  const i = s * 0.4;
  for (const [dx, dz, w, d] of [[0, -i, i * 2, 0.4], [0, i, i * 2, 0.4], [-i, 0, 0.4, i * 2], [i, 0, 0.4, i * 2]]) vbox(K, x + dx, 0.17, z + dz, w, 0.04, d, GOLDL, { glow: 1.0 });
  vbox(K, x, 0.17, z, 0.5, 0.04, s * 0.5, GOLDL, { glow: 0.8 });
  vbox(K, x, 0.17, z, s * 0.5, 0.04, 0.5, GOLDL, { glow: 0.8 });
}

// Loyalist barge parked on a pad (one solid hull, rest is dressing)
function barge(K, x, z, dir = 1) {
  K.box(x, z, 15, 3.2, 6.5, MARB2, { y: 0.4 });
  vbox(K, x + dir * 8.5, 1.9, z, 5, 2.2, 4.5, MARB3, { rz: dir * -0.35 });
  vbox(K, x - dir * 1, 3.9, z, 7, 0.8, 5, GOLDD);
  vbox(K, x, 2.1, z + 3.3, 13, 0.3, 0.1, GOLDL, { glow: 1.2 });
  vbox(K, x, 2.1, z - 3.3, 13, 0.3, 0.1, GOLDL, { glow: 1.2 });
  vbox(K, x + dir * 6.5, 2.7, z, 2.6, 0.7, 3.4, BLUE, { glow: 0.9, rz: dir * -0.35 });
  for (const sz of [-1, 1]) {
    vbox(K, x - dir * 3, 1.6, z + sz * 5.2, 5, 0.3, 4, MARB3, { ry: sz * dir * 0.3 });
    K.mesh(new THREE.CylinderGeometry(0.8, 0.9, 1.4, 8), EMBER, x - dir * 8.2, 2.0, z + sz * 1.6, { rz: Math.PI / 2, glow: 1.8 });
  }
}

// stacked cargo containers (cover). rot swaps the long side onto z
function cargo(K, x, z, rot, color = 0x4a3a2a, tall = false) {
  const w = rot ? 2.6 : 6, d = rot ? 6 : 2.6;
  K.box(x, z, w, 2.6, d, color);
  vbox(K, x, 2.5, z, w + 0.1, 0.18, d + 0.1, GOLD, { glow: 0.3 });
  if (tall) K.box(x + (rot ? 0 : 0.6), z + (rot ? 0.6 : 0), w * (rot ? 1 : 0.8), 2.6, d * (rot ? 0.8 : 1), 0x2c2a3a, { y: 2.6 });
}

export default {
  lev1: {
    spawn: [0, 80],
    bounds: [-66, 66, -270, 94],
    zones: [
      { name: 'Docking Bay', x: 0, z: 38 },
      { name: 'The Pleasure Gardens', x: 0, z: -45 },
      { name: 'The Royal Pools', x: 0, z: -118 },
      { name: 'The Gauntlet', x: 0, z: -165.5 },
      { name: 'The Throne Room', x: 0, z: -220.5, boss: true, room: { minX: -49, maxX: 49, minZ: -260, maxZ: -181 } },
    ],
    noEdge: true,
    build(K) {
      const gate = (x, z, w, h, axis, zone, id) => K.door(x, z, w, h, axis, { zone, id, color: GOLDD, trim: GOLDL });

      // ---- hall shells: walls shared between neighbours, gaps closed by gold doors ----
      lwall(K, -50, -5, 50, -5, 17, { gaps: [[0, 8]], doorH: 7 }); // hangar | gardens
      lwall(K, -56, -85, 56, -85, 17, { gaps: [[-18, 7]], doorH: 7 }); // gardens | pools
      lwall(K, -62, -151, 62, -151, 13, { gaps: [[52, 6]], doorH: 7 }); // pools | gauntlet
      lwall(K, -62, -180, 62, -180, 20, { gaps: [[-42, 7]], doorH: 9 }); // gauntlet | throne room
      lwall(K, -50, -5, -50, 90, 14); lwall(K, 50, -5, 50, 90, 14); lwall(K, -50, 90, 50, 90, 14); // hangar
      lwall(K, -50, -85, -50, -5, 17); lwall(K, 50, -85, 50, -5, 17); // gardens
      lwall(K, -56, -151, -56, -85, 13); lwall(K, 56, -151, 56, -85, 13); // pools
      lwall(K, -62, -180, -62, -151, 10); lwall(K, 62, -180, 62, -151, 10); // gauntlet
      lwall(K, -50, -261, -50, -180, 20); lwall(K, 50, -261, 50, -180, 20); lwall(K, -50, -261, 50, -261, 20); // throne room
      gate(0, -5, 8, 7, 'x', 0, 'door-bay');
      gate(-18, -85, 7, 7, 'x', 1, 'door-gardens');
      gate(52, -151, 6, 7, 'x', 2, 'door-pools');

      // =====================================================================
      // Zone 0: Docking Bay. A huge Loyalist hangar: pads, barges, cargo, banners, a 14 m roof
      // =====================================================================
      vbox(K, 0, 0, 42, 100, 0.24, 96, DECK);
      for (const x of [-12, 12]) vbox(K, x, 0.14, 42, 0.5, 0.04, 92, GOLD, { glow: 0.5 });
      for (let z = 70; z > 4; z -= 8) vbox(K, 0, 0.14, z, 7, 0.04, 0.5, GOLDL, { glow: 0.6 });
      pad(K, -33, 62, 24); pad(K, 33, 64, 24); pad(K, -34, 14, 16); pad(K, 34, 14, 16);
      barge(K, -33, 62, 1); barge(K, 33, 64, -1);
      for (const [x, z, rot] of [[-43, 36, true], [-43, 44, true], [43, 30, true], [43, 38, true], [-43, 2, true], [43, 54, true]]) cargo(K, x, z, rot, 0x4a3a2a, z % 8 === 0);
      for (const [x, z, rot] of [[-14, 54, false], [15, 24, false]]) cargo(K, x, z, rot, 0x3a3046);
      for (const [x, z] of [[-9, 30], [10, 48], [-6, 56], [14, 34], [-15, 28]]) K.crate(x, z);
      // side colonnade with banners, a gantry overhead and the glowing roof
      for (let z = 8; z <= 80; z += 18) for (const s of [-1, 1]) bpillar(K, s * 47.6, z, 14, 1, { w: 2.4 });
      for (const z of [10, 34, 58, 80]) vbox(K, 0, 11, z, 98, 0.8, 1.2, MARB3);
      ceiling(K, 0, 14.5, 42, 100, 0.8, 96, MARB);
      for (const x of [-30, -10, 10, 30]) vbox(K, x, 13.9, 42, 1.2, 0.1, 92, GOLDL, { glow: 1.1 });
      for (const [x, z] of [[-30, 20], [30, 20], [-30, 50], [30, 50], [0, 12], [0, 66], [-18, 80], [18, 80], [0, 36]]) lamp(K, x, 9.5, z, GOLDL, 8, 34);
      banner(K, 0, 9, 89.2, 'z', 10); banner(K, -16, 8, 89.2, 'z', 8); banner(K, 16, 8, 89.2, 'z', 8);
      // landmark: the great Loyalist sun over the bay door
      vbox(K, 0, 11, -4.2, 6, 6, 0.4, GOLDL, { glow: 1.4, ry: 0, rz: Math.PI / 4 });
      vbox(K, 0, 11, -4.2, 3, 3, 0.5, BANR, { rz: Math.PI / 4 });
      // sloped Cabal bulwarks guarding the door
      for (const s of [-1, 1]) {
        K.obox(s * 12, 4, 3.2, 3.2, 1.6, s * 0.5, MARB3);
        vbox(K, s * 12, 3.3, 4, 5, 0.2, 0.2, GOLDL, { glow: 1.2, ry: s * 0.5 });
      }

      // =====================================================================
      // Zone 1: The Pleasure Gardens. Indoor lawns under a lattice glass dome, hedge mazes, fountains, beast pens
      // =====================================================================
      vbox(K, 0, 0, -45, 100, 0.24, 80, 0x24341f);
      for (const [x, z, w, d] of [[-30, -45, 32, 54], [30, -45, 32, 54]]) vbox(K, x, 0.14, z, w, 0.06, d, LAWN);
      vbox(K, 0, 0.15, -45, 9, 0.06, 80, CREAM); // main avenue
      vbox(K, 0, 0.15, -45, 100, 0.06, 7, CREAM, {}); // cross path
      vbox(K, -9, 0.15, -78, 18, 0.06, 5, CREAM);
      maze(K, -48, -84, 3, 4, 7, 1, 'e');
      maze(K, 27, -84, 3, 4, 7, 5, 'w');
      pen(K, -39, -20, 18, 18, 'e');
      pen(K, 39, -20, 18, 18, 'w');
      fountain(K, 0, -16, 4.5);
      fountain(K, 0, -74, 5);
      for (const [x, z] of [[-10, -34], [10, -34], [-10, -56], [10, -56], [-15, -45], [15, -45]]) statue(K, x, z);
      for (const [x, z, s] of [[-47, -44, 1.2], [47, -44, 1.2], [-24, -9, 1], [24, -9, 1], [-23, -80, 1], [23, -80, 1], [-30, -45, 0.9], [30, -45, 0.9], [-24, -64, 0.8], [24, -64, 0.8]]) tree(K, x, z, s);
      for (let i = 0; i < 8; i++) bed(K, (i % 2 ? 1 : -1) * (7 + (i % 3) * 1.4), -14 - i * 8.5, 2.6, 1.8, i);
      // lattice glass dome
      const dome = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      pane(K, 0, 17, -45, 54, 15, 44, 0x9fd0ff, 0.16, { geo: dome, side: THREE.DoubleSide });
      const lattice = new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ color: GOLD, wireframe: true }));
      lattice.scale.set(54.1, 15.1, 44.1); lattice.position.set(0, 17, -45); K.scene.add(lattice);
      for (const z of [-30, -60]) vbox(K, 0, 16.6, z, 100, 0.5, 0.5, GOLD, { glow: 0.3 });
      // warm gold lamps along the avenue and the maze lanes
      for (let z = -12; z > -84; z -= 12) for (const s of [-1, 1]) lamp(K, s * 8, 3.4, z, GOLDL, 6, 26);
      for (const [x, z] of [[-38, -70], [38, -70], [-38, -45], [38, -45], [-42, -8], [42, -8]]) lamp(K, x, 5, z, 0xffb060, 6, 26);
      banner(K, 0, 10, -5.7, 'z', 8); banner(K, -18, 9, -84.3, 'z', 7);

      // =====================================================================
      // Zone 2: The Royal Pools. Raised white marble basins, a canal crossed by gold bridges, blue light, Taken blight
      // =====================================================================
      vbox(K, 0, 0, -118, 112, 0.24, 66, DECK2);
      poolBlock(K, -54, -130, -26, -96);
      poolBlock(K, 26, -130, 44, -100);
      poolBlock(K, 30, -96, 44, -88);
      poolBlock(K, -22, -130, -14, -126);
      // canal across the hall (decor water between parapets); two bridges, 5 m wide, deck 0.6 m with a half step each end
      vbox(K, 0, 0.1, -140, 112, 0.1, 5.4, WATER, { glow: 1.0 });
      const bridges = [-14, 38];
      for (const zr of [-137, -143]) {
        let from = -56;
        for (const bx of [...bridges, 999]) {
          const to = bx === 999 ? 56 : bx - 2.5;
          if (to - from > 0.3) K.box((from + to) / 2, zr, to - from, 1.8, 0.7, MARB2);
          from = bx + 2.5;
        }
      }
      for (const bx of bridges) {
        K.box(bx, -140, 5, 0.6, 7.1, GOLDD); // edges sit just past cell centres so the nav grid keeps every deck cell
        K.box(bx, -137.0, 5, 0.3, 3.6, GOLD); // half-height approach steps; they overlap the deck so the nav grid sees one walkable run
        K.box(bx, -143.0, 5, 0.3, 3.6, GOLD);
        for (const s of [-1, 1]) vbox(K, bx + s * 2.6, 1.5, -140, 0.25, 0.9, 7.6, GOLD, { glow: 0.4 });
        arch(K, bx, -140, 7, 5.5, 'x');
        K.light(bx, 5, -140, BLUE, 5, 24);
      }
      // colonnade, waterfall wall and gold archways over the walkways
      for (let z = -92; z > -146; z -= 14) for (const s of [-1, 1]) { K.box(s * 53.4, z, 2, 13, 2, MARB2); vbox(K, s * 53.4, 1, z, 2.3, 0.3, 2.3, GOLD, { glow: 0.5 }); }
      for (const x of [-34, 0, 34]) pane(K, x, 7, -149.7, 8, 12, 0.5, BLUE, 0.4, { add: true });
      arch(K, 0, -112, 10, 7, 'x'); arch(K, 49.5, -110, 10, 7, 'x');
      ceiling(K, 0, 13.4, -118, 114, 0.8, 68, MARB);
      for (const x of [-36, 0, 36]) vbox(K, x, 12.9, -118, 2, 0.1, 62, BLUE, { glow: 1.2 });
      // cool blue light, and the odd gold lamp for contrast
      for (const [x, z] of [[-20, -95], [20, -95], [-20, -135], [0, -118], [48, -92], [48, -125], [-50, -92], [-50, -140], [0, -146], [20, -146]]) lamp(K, x, 5.5, z, BLUE, 7, 30);
      K.light(34, 5, -105, GOLDL, 4, 22);
      // landmark: a gilded Calus statue rising from the east pool
      K.box(35, -115, 4, 3.4, 4, GOLDD, { y: 2.2 });
      vbox(K, 35, 9.1, -115, 2.2, 7, 1.4, GOLD, { glow: 0.4 });
      vbox(K, 35, 13.4, -115, 1.5, 1.5, 1.5, GOLDL, { glow: 0.8 });
      // Taken blight on the edges
      for (const [x, z, s] of [[-54, -88, 2], [-54, -122, 1.6], [-22, -90, 1.2], [20, -92, 1.4], [54, -96, 2.2], [54, -132, 1.8], [-8, -148, 2], [24, -148, 1.6], [-46, -148, 2], [8, -90, 1.2], [-20, -134, 1.2], [50, -118, 1.4]]) blight(K, x, z, s);

      // =====================================================================
      // Zone 3: The Gauntlet. A 124 m red-gold hold in three sections, banner pillars, gates in series
      // =====================================================================
      vbox(K, 0, 0, -165.5, 124, 0.24, 28, 0xcfc6b4);
      vbox(K, 0, 0.14, -165.5, 124, 0.05, 5, CARPET);
      for (const dz of [-2.8, 2.8]) vbox(K, 0, 0.17, -165.5 + dz, 124, 0.04, 0.3, GOLD, { glow: 0.7 });
      for (const px of [-54, -42, -30, -18, -6, 6, 18, 30, 42, 54]) {
        if (px !== 54) bpillar(K, px, -153.4, 10, -1, { w: 2.2 }); // pools side (clear of the entry door at x 52)
        if (px !== -42) bpillar(K, px, -177.6, 10, 1, { w: 2.2 }); // clear of the throne door at x -42
      }
      ceiling(K, 0, 10.4, -165.5, 126, 0.8, 30, MARB);
      for (const x of [-48, -16, 16, 48]) vbox(K, x, 9.9, -165.5, 2, 0.1, 26, RED, { glow: 1.2 });
      // alcove niches in the walls: dark recess with a lit statue
      for (const x of [-48, -24, 0, 24, 48]) {
        vbox(K, x, 3.2, -151.9, 3.6, 5, 0.3, MARB, {});
        vbox(K, x, 6, -151.9, 3.9, 0.3, 0.4, EMBER, { glow: 1.2 });
      }
      // defensive barricades in the central hold
      for (const [x, z, w, d] of [[-14, -159, 4, 1.2], [14, -172, 4, 1.2], [-6, -172, 3, 1.2], [8, -159, 3, 1.2], [-24, -166, 1.2, 4], [24, -166, 1.2, 4]]) {
        K.box(x, z, w, 1.3, d, MARB3);
        vbox(K, x, 1.35, z, w + 0.1, 0.12, d + 0.1, RED, { glow: 1.0 });
      }
      for (let x = -56; x <= 56; x += 14) for (const z of [-157, -174]) lamp(K, x, 7, z, (x / 14) % 2 ? RED : EMBER, 7, 28);
      gate(34, -165.5, 27.8, 8.5, 'z', 2, 'gate-a');
      gate(-34, -165.5, 27.8, 8.5, 'z', 3, 'gate-b');
      for (const gx of [34, -34]) { vbox(K, gx, 9.2, -165.5, 1.4, 0.9, 29, GOLD, { glow: 0.6 }); }
      banner(K, -61.3, 6, -165.5, 'x', 8);

      // =====================================================================
      // Zone 4: The Throne Room (boss). Closed chamber, gold dais, pillar ring, balconies and gold light shafts
      // =====================================================================
      const tc = -220.5;
      vbox(K, 0, 0, tc, 100, 0.24, 80, 0xe6dfd0);
      for (const [r0, r1, c] of [[34, 36, GOLD], [23.4, 24.2, GOLD], [12, 12.5, GOLD]]) K.mesh(new THREE.RingGeometry(r0, r1, 48).rotateX(-Math.PI / 2), c, 0, 0.17, tc, { glow: 0.6 });
      for (let k = 0; k < 8; k++) vbox(K, 0, 0.2, tc, 68, 0.03, 0.5, GOLD, { glow: 0.6, ry: k * Math.PI / 8 });
      K.mesh(new THREE.CylinderGeometry(9.2, 9.2, 0.05, 32), GOLDL, 0, 0.22, tc, { glow: 0.7 });
      // pillar ring
      for (let k = 0; k < 10; k++) {
        const a = (k + 0.5) * Math.PI / 5, x = 36 * Math.cos(a), z = tc + 22 * Math.sin(a);
        K.box(x, z, 3, 20, 3, MARB2);
        vbox(K, x, 1, z, 3.5, 0.4, 3.5, GOLD, { glow: 0.5 }); vbox(K, x, 19.4, z, 3.6, 0.6, 3.6, GOLD, { glow: 0.5 }); vbox(K, x, 10, z, 3.2, 0.3, 3.2, GOLD, { glow: 0.4 });
        lamp(K, x * 0.8, 14, tc + (z - tc) * 0.8, GOLDL, 9, 38);
      }
      // raised dais and throne
      K.platform(0, -251, 20, 14, 1.6, { stairs: ['s'], stairW: 10, color: GOLDD, stairColor: GOLD });
      K.box(0, -255, 5, 1.6, 4, GOLD, { y: 1.6, glow: 0.35 });
      K.box(0, -257.8, 5.4, 9, 1.4, GOLD, { y: 1.6, glow: 0.3 });
      for (let k = -2; k <= 2; k++) K.mesh(new THREE.ConeGeometry(0.4, 4 - Math.abs(k) * 0.6, 4), GOLDL, k * 1.0, 10.6 + (2 - Math.abs(k)) * 0.3, -257.8, { glow: 1.2 });
      for (const s of [-1, 1]) { K.cyl(s * 8, -249, 0.8, 1.2, GOLDD, { y: 1.6, sides: 6 }); K.mesh(new THREE.ConeGeometry(0.7, 1.6, 5), EMBER, s * 8, 4.2, -249, { glow: 1.8 }); K.light(s * 8, 4.6, -249, EMBER, 6, 26); }
      // sunburst on the back wall
      for (let k = 0; k < 9; k++) vbox(K, 0, 8, -260.2, 1.2, 22, 0.2, GOLDL, { glow: 0.6, rz: (k - 4) * 0.28 });
      // balconies, 4.8 m up, reached by stairs at either end
      for (const s of [-1, 1]) {
        K.platform(s * 45.5, tc, 7.4, 30, 4.8, { stairs: ['n', 's'], stairW: 4, color: MARB3, stairColor: GOLDD });
        vbox(K, s * 41.6, 5.4, tc, 0.4, 1.2, 30, GOLD, { glow: 0.4 });
        lamp(K, s * 45.5, 8.5, tc, GOLDL, 7, 30);
      }
      // chamfer walls across three corners
      K.obox(43, -192.6, 17, 20, 1.6, Math.PI / 4, MARB2);
      K.obox(-43, -248.4, 17, 20, 1.6, Math.PI / 4, MARB2);
      K.obox(43, -248.4, 17, 20, 1.6, -Math.PI / 4, MARB2);
      // banners, light shafts and a vaulted roof
      for (const x of [-30, -15, 15, 30]) banner(K, x, 11, -260, 'z', 12);
      ceiling(K, 0, 20.4, tc, 102, 0.8, 82, MARB);
      for (let k = 0; k < 8; k++) vbox(K, 0, 19.8, tc, 98, 0.5, 0.8, GOLD, { glow: 0.4, ry: k * Math.PI / 8 });
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3, x = 18 * Math.cos(a), z = tc + 18 * Math.sin(a);
        pane(K, x, 10, z, 3, 20, 3, GOLDL, 0.13, { add: true });
      }
      gate(-42, -180, 7, 9, 'x', 3, 'door-throne');
      lamp(K, 0, 17, tc, GOLDL, 14, 50); lamp(K, 0, 9, -245, GOLDL, 9, 34); lamp(K, -30, 12, -190, GOLDL, 8, 34); lamp(K, 30, 12, -190, GOLDL, 8, 34);
    },
  },
};
