// Hand-built Leviathan finale map (see makeKit in world.js).
// Emperor Calus's world-ship: white marble and gold, five halls on the way up to the throne. A Loyalist hangar with a raised
// cargo dock, the Pleasure Gardens (a sunken lawn ringed by terraces, under a glass dome), the Royal Pools (a great bath you
// descend into, crossed by a gold bridge), the long red-gold Gauntlet that climbs in three sections, and the Throne Room on its
// own high plateau with the dais at the back. Halls are closed rooms on terrain plateaus; gold doors open as each zone clears.
//
// Heights (world metres): Bay 0, dock 2.4 | Gardens promenade 2.4, lawn 0, north terrace 4.5 | Pools rim 4.5, bath 0 |
// Gauntlet 4.5, 6.5, 8.5 | Throne Room 8.5, dais 11. Every shared door sits where both halls have the same floor height.
import * as THREE from 'three';

// white marble, gold, cream stone, Loyalist crimson (U16d: opulent and bright; black only as a thin accent)
const MARB = 0xece6da, MARB2 = 0xdad2c3, MARB3 = 0xc2b9a8;
const GOLD = 0xd9a43a, GOLDL = 0xffc247, GOLDD = 0x8a6a22, CREAM = 0xe8dcc0;
const BANR = 0x7e1a22, CARPET = 0x5a1620, DECK2 = 0xc3ced8;
// gardens
const HEDGE = 0x2d6a38, HEDGE2 = 0x3e8a48, LAWN = 0x3a7a42, SOIL = 0x3a2a1e, BLOOM = [0xd04a8a, 0xe8883a, 0xe8d04a];
// pools
const WATER = 0x2f8ae0, BLUE = 0x59a8ff;
// Gauntlet
const RED = 0xff4a2a, EMBER = 0xff8a2a;

let _ub = null;
const UB = () => _ub || (_ub = new THREE.BoxGeometry(1, 1, 1));

// kit y of a world (absolute) height at (x, z): the kit measures every y from the ground under the point
const gA = (K, x, z, yAbs) => yAbs - K.ground(x, z);

// visual-only box, any rotation, no collider
function vbox(K, x, y, z, w, h, d, color, o = {}) {
  return K.mesh(UB(), color, x, y, z, { rx: o.rx, ry: o.ry, rz: o.rz, scale: [w, h, d], glow: o.glow });
}
// the same at an absolute world height (yAbs is the centre)
function vA(K, x, yAbs, z, w, h, d, color, o = {}) {
  return vbox(K, x, gA(K, x, z, yAbs), z, w, h, d, color, o);
}

// roof slabs and glass should not throw shadows over the hall below
function ceiling(K, x, yAbs, z, w, h, d, color, o = {}) {
  const m = vA(K, x, yAbs, z, w, h, d, color, o);
  m.castShadow = false;
  return m;
}
// a roof slab covering a rectangle, centred at world height yAbs
function slab(K, x0, z0, x1, z1, yAbs, color = MARB) {
  return ceiling(K, (x0 + x1) / 2, yAbs, (z0 + z1) / 2, x1 - x0 - 0.1, 0.8, z1 - z0 - 0.1, color); // inset so its ends do not line up with the walls'
}

// translucent unlit pane (glass, light shafts, waterfalls, water); position is in absolute world coordinates
function pane(K, x, y, z, w, h, d, color, opacity = 0.25, o = {}) {
  const m = new THREE.Mesh(o.geo || UB(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: o.side ?? THREE.FrontSide, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending }));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  K.scene.add(m);
  return m;
}
// pane at a height above the ground under it (for light shafts and falls that stand on the floor)
function paneG(K, x, y, z, w, h, d, color, opacity, o) {
  return pane(K, x, y + K.ground(x, z), z, w, h, d, color, opacity, o);
}

// terrain-following sheet over a rectangle: floors, lawns, carpets, lane stripes. With snap the rectangle lands on the 2 m ground grid and
// shares its triangles (so it sits a constant lift above the ground); thin strips are sampled every 1.5 m instead.
function sheet(K, x0, z0, x1, z1, color, o = {}) {
  if (o.snap) { x0 = Math.floor(x0 / 2) * 2; z0 = Math.floor(z0 / 2) * 2; x1 = Math.ceil(x1 / 2) * 2; z1 = Math.ceil(z1 / 2) * 2; }
  const W = x1 - x0, D = z1 - z0;
  const n = (L) => (o.snap ? L / 2 : L <= 2 ? 1 : Math.ceil(L / 1.5));
  const geo = new THREE.PlaneGeometry(W, D, n(W), n(D));
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = geo.attributes.position, lift = o.lift ?? (o.snap ? 0.07 : 0.12);
  for (let i = 0; i < p.count; i++) p.setY(i, K.ground(p.getX(i), p.getZ(i)) + lift);
  const g2 = geo.toNonIndexed();
  g2.computeVertexNormals();
  const m = new THREE.Mesh(g2, K.mat(color, o.glow));
  m.receiveShadow = true;
  K.scene.add(m);
  return m;
}
// a straight stripe along x or z, w wide
function stripe(K, x0, z0, x1, z1, w, color, o = {}) {
  const horiz = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  return horiz ? sheet(K, Math.min(x0, x1), z0 - w / 2, Math.max(x0, x1), z0 + w / 2, color, o) : sheet(K, x0 - w / 2, Math.min(z0, z1), x0 + w / 2, Math.max(z0, z1), color, o);
}

// gold lamp: a glow bulb and a light (the kit lends the 6 nearest a real light)
function lamp(K, x, y, z, color = GOLDL, intensity = 7, dist = 28) {
  K.light(x, y, z, color, intensity, dist);
}

// Leviathan wall: white marble with a gold cornice, run in 8 m pieces so each stands right on the terrain under it. top is the
// world height of the wall top. gaps are [centre, width] along the wall; each gets a lintel, gold posts and a glowing bar.
// Doors are placed separately with K.door.
function lwall(K, x1, z1, x2, z2, top, o = {}) {
  const horiz = Math.abs(x2 - x1) >= Math.abs(z2 - z1);
  const a0 = horiz ? Math.min(x1, x2) : Math.min(z1, z2), a1 = horiz ? Math.max(x1, x2) : Math.max(z1, z2), fixed = horiz ? z1 : x1;
  const t = o.t ?? 1.2, dh = o.doorH ?? 7, color = o.color ?? MARB2;
  const gaps = (o.gaps || []).map(([c, w]) => [c - w / 2, c + w / 2]).sort((a, b) => a[0] - b[0]);
  const at = (a) => (horiz ? K.ground(a, fixed) : K.ground(fixed, a));
  const V = (a, yAbs, L, hh, tt, c, opts) => (horiz ? vA(K, a, yAbs, fixed, L, hh, tt, c, opts) : vA(K, fixed, yAbs, a, tt, hh, L, c, opts));
  const runs = [];
  let from = a0;
  for (const [g0, g1] of [...gaps, [a1, a1]]) { if (g0 - from > 0.3) runs.push([from, g0]); from = Math.max(from, g1); }
  for (const [r0, r1] of runs) {
    const n = Math.ceil((r1 - r0) / 8), L = (r1 - r0) / n;
    for (let i = 0; i < n; i++) {
      const c = r0 + L * (i + 0.5), g = at(c);
      if (horiz) K.box(c, fixed, L, top - g, t, color); else K.box(fixed, c, t, top - g, L, color);
      V(c, g + 0.5, L - 0.1, 0.5, t + 0.25, MARB3); // plinth (a little short so no face lines up with the wall's)
    }
  }
  for (const [g0, g1] of gaps) {
    const c = (g0 + g1) / 2, w = g1 - g0, g = at(c);
    if (top - g - dh > 0.3) V(c, (g + dh + top) / 2, w, top - g - dh, t + 0.06, MARB3);
    V(g0 - 0.32, g + dh / 2, 0.5, dh, t + 0.3, GOLD, { glow: 0.3 });
    V(g1 + 0.32, g + dh / 2, 0.5, dh, t + 0.3, GOLD, { glow: 0.3 });
    V(c, g + dh + 0.15, w + 1.2, 0.3, t + 0.4, GOLDL, { glow: 0.9 });
  }
  V((a0 + a1) / 2, top - 0.15, a1 - a0 + 0.4, 0.4, t + 0.5, GOLD, { glow: 0.3 }); // cornice (its top sits just proud of the wall top)
}

// Loyalist banner: crimson cloth, gold border and a glowing sun sigil. axis 'z' hangs on a wall facing z. y is above the ground there.
function banner(K, x, y, z, axis = 'z', h = 6) {
  const f = (w, hh, d) => (axis === 'z' ? [w, hh, d] : [d, hh, w]);
  vbox(K, x, y, z, ...f(2.6, h, 0.12), GOLD);
  vbox(K, x, y, z, ...f(2.1, h - 0.5, 0.2), BANR);
  vbox(K, x, y + h * 0.15, z, ...f(0.9, 0.9, 0.3), GOLDL, { glow: 1.2, ry: Math.PI / 4 });
}

// white marble pillar with gold bands, a capital and a banner on the inside face (face: +1 or -1 along z), rising to a world height top
function bpillar(K, x, z, top, face, o = {}) {
  const w = o.w ?? 2.2, h = top - K.ground(x, z);
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

// hedge maze drawn by hand: '#' is a hedge cell, '.' open. Rows run along +z from z0, columns along +x from x0 (flipped for the mirror twin).
function hedgeMaze(K, x0, z0, rows, cell, flip) {
  const R = rows.length, C = rows[0].length, at = (r, c) => rows[r][flip ? C - 1 - c : c];
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C;) {
      if (at(r, c) !== '#') { c++; continue; }
      let e = c;
      while (e + 1 < C && at(r, e + 1) === '#') e++;
      const n = e - c + 1;
      K.box(x0 + (c + n / 2) * cell, z0 + (r + 0.5) * cell, n * cell, 2.4, cell, (r + c) % 2 ? HEDGE : HEDGE2);
      c = e + 1;
    }
  }
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

// gold arch over a walkway, rising to world height top (two piers with colliders and a lintel)
function arch(K, x, z, w, top, axis = 'x', color = GOLD) {
  const px = axis === 'x' ? w / 2 : 0, pz = axis === 'x' ? 0 : w / 2;
  K.box(x - px, z - pz, 1.4, top - K.ground(x - px, z - pz), 1.4, MARB2);
  K.box(x + px, z + pz, 1.4, top - K.ground(x + px, z + pz), 1.4, MARB2);
  vA(K, x, top + 0.4, z, axis === 'x' ? w + 2.2 : 1.8, 0.9, axis === 'x' ? 1.8 : w + 2.2, color, { glow: 0.5 });
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

// sloped Cabal bulwark: an angled marble plate with a glowing top edge (oriented collider, so it blocks only where it is)
function bulwark(K, x, z, w, ry, glow = GOLDL) {
  K.obox(x, z, w, 1.6, 1.5, ry, MARB3);
  vbox(K, x, 1.7, z, w + 0.1, 0.16, 1.6, glow, { ry, glow: 1.2 });
}

// hedge maze plan (7 x 9 cells): two doors on the avenue side, a loop round the middle, dead ends to hold
const MAZE = ['#######', '#.....#', '#.###.#', '#...#.#', '..#.#.#', '#.#...#', '#.###.#', '......#', '#######'];

export default {
  lev1: {
    spawn: [0, 80],
    bounds: [-66, 66, -270, 94],
    zones: [
      { name: 'Docking Bay', x: 0, z: 42 },
      { name: 'The Pleasure Gardens', x: 0, z: -45 },
      { name: 'The Royal Pools', x: 0, z: -118 },
      { name: 'The Gauntlet', x: 0, z: -165.5 },
      { name: 'The Throne Room', x: 0, z: -220.5, boss: true, room: { minX: -49, maxX: 49, minZ: -260, maxZ: -181 } },
    ],
    noEdge: true,
    rim: 0,
    // the Leviathan's deep gold void seen through the dome and the skylights: Calus's glow low on the horizon, the ship's own
    // towers and domes as silhouettes, Cabal ships hanging in the dark
    sky: {
      zenith: 0x07060e, mid: 0x241808, horizon: 0xb88830, floor: 0x1a1208,
      stars: { n: 520, color: 0xfff0d0, size: 2.2, min: 0.05 },
      bodies: [{ color: 0xffd47a, size: 120, pos: [-300, 140, -430], glow: 0xffc247 }, { color: 0x8a5a2a, size: 34, pos: [360, 230, -320], bands: [0x8a5a2a, 0xc89a52, 0x6a4020] }],
      skyline: [{ kind: 'tower', n: 14, r: [420, 620], h: [50, 150], w: [10, 22], color: 0x4a3818, haze: 0.4 }, { kind: 'dome', n: 5, r: [440, 600], h: [30, 70], w: [40, 90], color: 0x5a4420, haze: 0.45 }],
      haze: [{ color: 0xd8a640, opacity: 0.45, r: 480, h: 100, y: -10 }],
      floaters: [{ kind: 'ship', n: 8, r: [340, 640], y: [50, 230], size: [20, 44], color: 0x2e2210, glow: 0xffc247, haze: 0.2 }],
    },
    // every hall is a flat plateau; halls climb toward the throne: dock, sunken lawn and terraces, the great bath, three Gauntlet steps, the dais.
    // Hall plateaus keep a short skirt so they do not leak into the next hall; each hall is joined to the next by ramps at its door.
    terrain: [
      // Docking Bay: floor 0, a cargo dock (2.4 m) across the north end, reached by two cargo ramps
      { type: 'plateau', x: 0, z: 6.5, w: 100, d: 23, h: 2.4, edge: 3 },
      { type: 'ramp', x0: -22, z0: 40, x1: -22, z1: 20, width: 14, h0: 0, h1: 2.4, edge: 2 },
      { type: 'ramp', x0: 22, z0: 40, x1: 22, z1: 20, width: 14, h0: 0, h1: 2.4, edge: 2 },
      // Pleasure Gardens: promenade (2.4) at the door, a sunken lawn (0) down the middle, west and east terraces, the north terrace (4.5)
      { type: 'plateau', x: 0, z: -14, w: 100, d: 19, h: 2.4, edge: 3 },
      { type: 'plateau', x: -45, z: -45, w: 10, d: 44, h: 2.4, edge: 3 },
      { type: 'plateau', x: 45, z: -45, w: 10, d: 44, h: 2.4, edge: 3 },
      { type: 'plateau', x: 0, z: -77, w: 100, d: 16, h: 4.5, edge: 3 },
      { type: 'ramp', x0: 0, z0: -21, x1: 0, z1: -35, width: 12, h0: 2.4, h1: 0, edge: 3 },
      { type: 'ramp', x0: 0, z0: -54, x1: 0, z1: -70, width: 12, h0: 0, h1: 4.5, edge: 3 },
      { type: 'ramp', x0: -45, z0: -57, x1: -45, z1: -69, width: 8, h0: 2.4, h1: 4.5, edge: 2 },
      { type: 'ramp', x0: 45, z0: -57, x1: 45, z1: -69, width: 8, h0: 2.4, h1: 4.5, edge: 2 },
      // Royal Pools: rim 4.5, the Great Bath sunk to 0 with three ramps down (the gold bridge across it is a deck, not terrain, so units walk under it)
      { type: 'plateau', x: 0, z: -118, w: 112, d: 66, h: 4.5, edge: 0.5 },
      { type: 'plateau', x: -8, z: -118, w: 52, d: 36, h: 0, edge: 3 },
      { type: 'ramp', x0: -26, z0: -94, x1: -26, z1: -112, width: 8, h0: 4.5, h1: 0, edge: 2 },
      { type: 'ramp', x0: 12, z0: -118, x1: 32, z1: -118, width: 8, h0: 0, h1: 4.5, edge: 2 },
      { type: 'ramp', x0: -24, z0: -124, x1: -24, z1: -142, width: 8, h0: 0, h1: 4.5, edge: 2 },
      // Throne Room: a high plateau (8.5), a ramp up to the dais (11)
      { type: 'plateau', x: 0, z: -221, w: 100, d: 82, h: 8.5, edge: 0.5 },
      // Gauntlet: 4.5 at the entry, a climb to 6.5, a climb to 8.5 at the throne door
      { type: 'plateau', x: 48, z: -165.5, w: 28, d: 29, h: 4.5, edge: 0.5 },
      { type: 'plateau', x: 0, z: -165.5, w: 28, d: 29, h: 6.5, edge: 0.5 },
      { type: 'plateau', x: -48, z: -165.5, w: 28, d: 29, h: 8.5, edge: 0.5 },
      { type: 'ramp', x0: 34, z0: -165.5, x1: 14, z1: -165.5, width: 29, h0: 4.5, h1: 6.5, edge: 0.5 },
      { type: 'ramp', x0: -14, z0: -165.5, x1: -34, z1: -165.5, width: 29, h0: 6.5, h1: 8.5, edge: 0.5 },
      { type: 'plateau', x: 0, z: -252, w: 28, d: 14, h: 11, edge: 2 },
      { type: 'ramp', x0: 0, z0: -232, x1: 0, z1: -246, width: 14, h0: 8.5, h1: 11, edge: 1.5 },
    ],
    build(K) {
      const gate = (x, z, w, h, axis, zone, id) => K.door(x, z, w, h, axis, { zone, id, color: GOLDD, trim: GOLDL });
      const BAY_ROOF = 14.5, GARD_ROOF = 21, POOL_ROOF = 17.9, GAUNT_ROOF = 18.9, THRONE_ROOF = 29;

      // ---- hall shells: walls shared between neighbours (the taller roof wins), gaps closed by gold doors ----
      lwall(K, -50, -5, 50, -5, GARD_ROOF, { gaps: [[0, 8]], doorH: 7 }); // hangar | gardens
      lwall(K, -56, -85, 56, -85, GARD_ROOF, { gaps: [[-18, 7]], doorH: 7 }); // gardens | pools
      lwall(K, -62, -151, 62, -151, GAUNT_ROOF - 0.4, { gaps: [[52, 6]], doorH: 7 }); // pools | gauntlet
      lwall(K, -62, -180, 62, -180, THRONE_ROOF - 0.5, { gaps: [[-42, 7]], doorH: 9 }); // gauntlet | throne room
      lwall(K, -50, -5, -50, 90, BAY_ROOF - 0.5); lwall(K, 50, -5, 50, 90, BAY_ROOF - 0.5); lwall(K, -50, 90, 50, 90, BAY_ROOF - 0.5); // hangar
      lwall(K, -50, -85, -50, -5, GARD_ROOF); lwall(K, 50, -85, 50, -5, GARD_ROOF); // gardens
      lwall(K, -56, -151, -56, -85, POOL_ROOF - 0.4); lwall(K, 56, -151, 56, -85, POOL_ROOF - 0.4); // pools
      lwall(K, -62, -180, -62, -151, GAUNT_ROOF - 0.4); lwall(K, 62, -180, 62, -151, GAUNT_ROOF - 0.4); // gauntlet
      lwall(K, -50, -261, -50, -180, THRONE_ROOF - 0.5); lwall(K, 50, -261, 50, -180, THRONE_ROOF - 0.5); lwall(K, -50, -261, 50, -261, THRONE_ROOF - 0.5); // throne room
      gate(0, -5, 8, 7, 'x', 0, 'door-bay');
      gate(-18, -85, 7, 7, 'x', 1, 'door-gardens');
      gate(52, -151, 6, 7, 'x', 2, 'door-pools');

      // =====================================================================
      // Zone 0: Docking Bay. A huge Loyalist hangar. Combat on the floor, with the cargo dock (2.4 m) across the north end as the
      // high ground: two cargo ramps climb to it, two cargo perches overlook it, and the door to the gardens stands at its far side.
      // =====================================================================
      for (const x of [-12, 12]) stripe(K, x, 90, x, -4, 0.5, GOLD, { glow: 0.5 });
      for (let z = 70; z > 24; z -= 8) stripe(K, 0, z, 0, z, 7, GOLDL, { glow: 0.6, lift: 0.1 }); // chevron lane to the ramps
      stripe(K, -50, 17.2, 50, 17.2, 0.6, GOLDL, { glow: 0.9 }); // the dock's lip
      pad(K, -33, 62, 24); pad(K, 33, 64, 24);
      barge(K, -33, 62, 1); barge(K, 33, 64, -1);
      for (const [x, z, rot] of [[-43, 36, true], [-43, 46, true], [43, 30, true], [43, 38, true], [43, 54, true], [-43, 24, true]]) cargo(K, x, z, rot, 0x4a3a2a, z % 8 === 0);
      // mid-floor cover: cargo stacks and angled hulls in the open lane
      for (const [x, z, rot] of [[-9, 56, false], [9, 28, false], [0, 68, true]]) cargo(K, x, z, rot, 0x3a3046);
      for (const [x, z, w, ry] of [[24, 58, 7, 0.4], [-24, 56, 7, -0.4], [0, 48, 8, 0], [-8, 34, 5, 0.5]]) bulwark(K, x, z, w, ry);
      for (const [x, z] of [[-4, 36], [12, 50], [-16, 50], [15, 62], [-20, 46]]) K.crate(x, z);
      // dock: two cargo perches (player-only decks with stairs), cargo, bulwarks by the door
      for (const s of [-1, 1]) {
        K.box(s * 39, 6, 12, 2.4, 14, MARB3, { y: 0 }); // the deck sits on the dock
        K.stairs(s * 39, 13.05 + 3.6, 'n', 4, 2.4, { color: GOLDD });
        vbox(K, s * 39, 2.5, 12.9, 12.3, 0.5, 0.3, GOLD, { glow: 0.4 });
        K.box(s * 39, 5, 6, 1.8, 2.6, 0x4a3a2a, { y: 2.4 }); // cover on the perch
        vbox(K, s * 39, 4.3, 5, 6.1, 0.18, 2.7, GOLD, { glow: 0.3 });
        K.obox(s * 12, 4, 3.2, 3.2, 1.6, s * 0.5, MARB3);
        vbox(K, s * 12, 3.3, 4, 5, 0.2, 0.2, GOLDL, { glow: 1.2, ry: s * 0.5 });
      }
      // side colonnade with banners, a gantry overhead and the glowing roof (skylight over the open floor)
      for (let z = 8; z <= 80; z += 18) for (const s of [-1, 1]) bpillar(K, s * 47.6, z, BAY_ROOF - 0.5, 1, { w: 2.4 });
      for (const z of [10, 34, 58, 80]) vA(K, 0, 11, z, 98, 0.8, 1.2, MARB3);
      slab(K, -50, -5, -22, 90, BAY_ROOF); slab(K, 22, -5, 50, 90, BAY_ROOF); slab(K, -22, -5, 22, 22, BAY_ROOF); slab(K, -22, 70, 22, 90, BAY_ROOF);
      pane(K, 0, BAY_ROOF, 46, 44, 0.2, 48, 0xffe0a0, 0.1);
      for (const z of [26, 46, 66]) ceiling(K, 0, BAY_ROOF + 0.1, z, 44, 0.5, 0.6, GOLD, { glow: 0.4 });
      for (const x of [-30, 30]) vA(K, x, 13.9, 42, 1.2, 0.1, 92, GOLDL, { glow: 1.1 });
      for (const [x, z] of [[-30, 20], [30, 20], [-30, 50], [30, 50], [0, 12], [0, 66], [-18, 80], [18, 80], [0, 36]]) lamp(K, x, 9.5, z, GOLDL, 8, 34);
      banner(K, 0, 9, 89.2, 'z', 10); banner(K, -16, 8, 89.2, 'z', 8); banner(K, 16, 8, 89.2, 'z', 8);
      // landmark: the great Loyalist sun over the bay door
      vbox(K, 0, 9, -4.2, 6, 6, 0.4, GOLDL, { glow: 1.4, rz: Math.PI / 4 });
      vbox(K, 0, 9, -4.2, 3, 3, 0.5, BANR, { rz: Math.PI / 4 });

      // =====================================================================
      // Zone 1: The Pleasure Gardens. Indoor gardens under a lattice glass dome. You enter on the promenade (2.4 m), go down into a
      // sunken lawn (0) guarded by hedge mazes and beast pens, and climb out to the north terrace (4.5 m). West and east terraces ring
      // the lawn as the dome-edge walkways.
      // =====================================================================
      sheet(K, -38, -66, 38, -28, LAWN, { snap: true });
      stripe(K, 0, -4, 0, -82, 7, CREAM, { lift: 0.12 }); // main avenue
      stripe(K, -18, -45, 18, -45, 6, CREAM, { lift: 0.12 }); // cross path
      hedgeMaze(K, 19, -57.2, MAZE, 2.6, false);
      hedgeMaze(K, -37.2, -57.2, MAZE, 2.6, true);
      for (const s of [-1, 1]) { bed(K, s * 28.1, -45, 2.4, 2.4, 1); vbox(K, s * 28.1, 2.2, -45, 0.9, 0.9, 0.9, GOLDL, { glow: 1.2, ry: 0.8 }); }
      pen(K, -35, -14, 14, 14, 'e');
      pen(K, 35, -14, 14, 14, 'w');
      fountain(K, 0, -14, 4.5);
      fountain(K, 6, -78, 4);
      // a low marble ring planter at the heart of the lawn: cover for the fight
      K.cyl(0, -45, 2.6, 1.1, CREAM, { sides: 10 });
      K.mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.12, 10), HEDGE2, 0, 1.12, -45, { glow: 0.3 });
      // statue avenue down the lawn
      for (const z of [-31, -39, -51, -59]) for (const s of [-1, 1]) statue(K, s * 10, z);
      for (const [x, z, s] of [[-46, -30, 1], [46, -30, 1], [-46, -42, 1.1], [46, -42, 1.1], [-46, -55, 0.9], [46, -55, 0.9], [-44, -9, 1], [44, -9, 1], [-22, -76, 0.9], [22, -76, 0.9], [-30, -80, 1], [30, -80, 1]]) tree(K, x, z, s);
      for (let i = 0; i < 8; i++) bed(K, (i % 2 ? 1 : -1) * 15, -31 - Math.floor(i / 2) * 8.5, 2.6, 1.8, i);
      // lattice glass dome (wide enough to roof the corners) over the whole hall
      const dome = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      pane(K, 0, GARD_ROOF, -45, 68, 17, 54, 0x9fd0ff, 0.16, { geo: dome, side: THREE.DoubleSide });
      const lattice = new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ color: GOLD, wireframe: true }));
      lattice.scale.set(68.1, 17.1, 54.1); lattice.position.set(0, GARD_ROOF, -45); K.scene.add(lattice);
      for (const z of [-30, -60]) vA(K, 0, GARD_ROOF - 0.4, z, 100, 0.5, 0.5, GOLD, { glow: 0.3 });
      // warm gold lamps along the avenue and the terraces
      for (let z = -12; z > -84; z -= 12) for (const s of [-1, 1]) lamp(K, s * 8, 3.4, z, GOLDL, 6, 26);
      for (const [x, z] of [[-45, -70], [45, -70], [-45, -45], [45, -45], [-42, -8], [42, -8]]) lamp(K, x, 5, z, 0xffb060, 6, 26);
      banner(K, 0, 12, -5.7, 'z', 8); banner(K, -18, 10, -84.0, 'z', 7);

      // =====================================================================
      // Zone 2: The Royal Pools. A marble hall on a 4.5 m rim around the Great Bath, a sunken pool (4.5 m deep, shallow water) with three
      // ramps down. A gold bridge crosses over it at rim height. Raised basins and a gilded Calus statue stand on the rim.
      // =====================================================================
      sheet(K, -56, -151, 56, -85, DECK2, { snap: true });
      // the bath: shallow water in the pit, gold coping round the cliff edge
      pane(K, -8, 1.0, -118, 52, 0.1, 36, WATER, 0.55);
      for (const [x0, z0, x1, z1] of [[-37.6, -139.6, 21.6, -139.0], [-37.6, -97.0, 21.6, -96.4], [-37.6, -139.6, -37.0, -96.4], [21.0, -139.6, 21.6, -96.4]]) {
        sheet(K, x0, z0, x1, z1, GOLD, { glow: 0.3, lift: 0.14 });
      }
      // gold bridge across the bath: rails, a pier arch and blue light
      // (a deck 0.6 m thick at rim height: players cross over the bath, units walk beneath it; the nav grid ignores it overhead)
      K.box(-6, -118, 5, 0.66, 44, GOLDD, { y: 3.9, abs: true });
      for (const s of [-1, 1]) K.box(-6 + s * 2.55, -118, 0.3, 1.0, 44, GOLD, { y: 4.56, abs: true, glow: 0.4 });
      arch(K, -6, -118, 7, 10.5, 'x');
      K.light(-6, 8, -118, BLUE, 6, 26);
      // raised basins on the rim and the gilded Calus statue rising from the east one
      poolBlock(K, -53, -132, -43, -108);
      poolBlock(K, 34, -108, 50, -92);
      poolBlock(K, 36, -134, 50, -122);
      K.box(42, -100, 4, 3.4, 4, GOLDD, { y: 2.2 });
      vbox(K, 42, 9.1, -100, 2.2, 7, 1.4, GOLD, { glow: 0.4 });
      vbox(K, 42, 13.4, -100, 1.5, 1.5, 1.5, GOLDL, { glow: 0.8 });
      // colonnade, waterfall wall and gold archways over the rim walks
      for (let z = -92; z > -146; z -= 14) for (const s of [-1, 1]) { K.box(s * 53.4, z, 2, 13, 2, MARB2); vbox(K, s * 53.4, 1, z, 2.3, 0.3, 2.3, GOLD, { glow: 0.5 }); }
      for (const x of [-34, 0, 34]) pane(K, x, 10.5, -149.7, 8, 12, 0.5, BLUE, 0.4, { add: true });
      arch(K, 0, -90, 10, 11.5, 'x'); arch(K, 40, -140, 10, 11.5, 'x');
      // roof with a skylight over the bath
      slab(K, -56, -151, -30, -85, POOL_ROOF); slab(K, 30, -151, 56, -85, POOL_ROOF); slab(K, -30, -100, 30, -85, POOL_ROOF); slab(K, -30, -151, 30, -136, POOL_ROOF);
      pane(K, 0, POOL_ROOF, -118, 60, 0.2, 36, 0x9fd0ff, 0.14);
      for (const x of [-20, 0, 20]) ceiling(K, x, POOL_ROOF + 0.1, -118, 0.6, 0.5, 36, GOLD, { glow: 0.4 });
      for (const x of [-42, 42]) vA(K, x, POOL_ROOF - 0.5, -118, 2, 0.1, 62, BLUE, { glow: 1.2 });
      // cool blue light, and the odd gold lamp for contrast
      for (const [x, z] of [[-20, -92], [20, -92], [-50, -92], [-50, -140], [0, -146], [20, -146], [48, -125], [48, -92]]) lamp(K, x, 5.5, z, BLUE, 7, 30);
      for (const [x, z] of [[-20, -112], [8, -126], [-8, -105]]) lamp(K, x, 6, z, BLUE, 7, 30);
      K.light(34, 5, -105, GOLDL, 4, 22);

      // =====================================================================
      // Zone 3: The Gauntlet. A 124 m red-gold hold that climbs in three steps toward the throne (4.5, 6.5, 8.5 m). Angled Cabal bulwarks,
      // banner pillars, two gates in series.
      // =====================================================================
      stripe(K, -62, -165.5, 62, -165.5, 5, CARPET, { lift: 0.1 });
      for (const dz of [-2.8, 2.8]) stripe(K, -62, -165.5 + dz, 62, -165.5 + dz, 0.3, GOLD, { glow: 0.7, lift: 0.13 });
      for (const [x0, x1] of [[34, 14], [-14, -34]]) for (let x = Math.min(x0, x1) + 2; x < Math.max(x0, x1); x += 4) stripe(K, x, -163, x, -168, 0.5, GOLDL, { glow: 0.8, lift: 0.14 }); // chevrons mark the climbs
      for (const px of [-54, -42, -30, -18, -6, 6, 18, 30, 42, 54]) {
        if (px !== 54) bpillar(K, px, -153.4, GAUNT_ROOF - 0.5, -1, { w: 2.2 }); // pools side (clear of the entry door at x 52)
        if (px !== -42) bpillar(K, px, -177.6, GAUNT_ROOF - 0.5, 1, { w: 2.2 }); // clear of the throne door at x -42
      }
      slab(K, -63, -181, 63, -150, GAUNT_ROOF);
      for (const x of [-48, -16, 16, 48]) vA(K, x, GAUNT_ROOF - 0.5, -165.5, 2, 0.1, 26, RED, { glow: 1.2 });
      // alcove niches in the walls: dark recess with a lit statue
      for (const x of [-48, -24, 0, 24, 48]) {
        vbox(K, x, 3.2, -151.9, 3.6, 5, 0.3, MARB, {});
        vbox(K, x, 6, -151.9, 3.9, 0.3, 0.4, EMBER, { glow: 1.2 });
      }
      // angled bulwarks in the holds: the vestibule, the open middle step, the throne approach
      for (const [x, z, w, ry] of [[46, -160, 5, 0.5], [44, -172, 5, -0.5], [8, -158, 6, 0.4], [-6, -172, 6, -0.4], [2, -165.5, 4, 0], [22, -168, 4, 0.3], [-22, -163, 4, -0.3], [-48, -158, 5, -0.5], [-50, -172, 5, 0.5]]) bulwark(K, x, z, w, ry, RED);
      for (let x = -56; x <= 56; x += 14) for (const z of [-157, -174]) lamp(K, x, 7, z, (x / 14) % 2 ? RED : EMBER, 7, 28);
      gate(34, -165.5, 27.8, 8.5, 'z', 2, 'gate-a');
      gate(-34, -165.5, 27.8, 8.5, 'z', 3, 'gate-b');
      for (const gx of [34, -34]) vbox(K, gx, 9.2, -165.5, 1.4, 0.9, 29, GOLD, { glow: 0.6 });
      banner(K, -61.3, 6, -165.5, 'x', 8);

      // =====================================================================
      // Zone 4: The Throne Room (boss, horde arena). Closed chamber on a high plateau (8.5 m): pillar ring, balconies, cover for the
      // waves, and the gold dais (11 m) at the back reached by a grand ramp.
      // =====================================================================
      const tc = -220.5;
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
      // cover for the waves: angled gold-trimmed plates in a loose ring, clear of the centre, the ramp and the balconies
      for (const [x, z, w, ry] of [[-16, -203, 6, 0.5], [16, -203, 6, -0.5], [-27, -222, 5, 1.2], [27, -222, 5, -1.2], [-14, -238, 6, -0.4], [14, -238, 6, 0.4], [0, -196, 5, 0]]) bulwark(K, x, z, w, ry);
      // raised dais (the plateau) and throne
      K.box(0, -255, 5, 1.6, 4, GOLD, { glow: 0.35 });
      K.box(0, -257.8, 5.4, 9, 1.4, GOLD, { glow: 0.3 });
      for (let k = -2; k <= 2; k++) K.mesh(new THREE.ConeGeometry(0.4, 4 - Math.abs(k) * 0.6, 4), GOLDL, k * 1.0, 9.0 + (2 - Math.abs(k)) * 0.3, -257.8, { glow: 1.2 });
      for (const s of [-1, 1]) { K.cyl(s * 8, -249, 0.8, 1.2, GOLDD, { sides: 6 }); K.mesh(new THREE.ConeGeometry(0.7, 1.6, 5), EMBER, s * 8, 2.6, -249, { glow: 1.8 }); K.light(s * 8, 3.0, -249, EMBER, 6, 26); }
      // steps of gold light up the ramp
      for (let z = -234; z > -245; z -= 3) stripe(K, 0, z, 0, z, 14, GOLDL, { glow: 0.5, lift: 0.1 });
      // sunburst on the back wall
      for (let k = 0; k < 9; k++) vbox(K, 0, 6, -260.2, 1.2, 22, 0.2, GOLDL, { glow: 0.6, rz: (k - 4) * 0.28 });
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
      // banners, light shafts and a vaulted roof with an oculus of glass (the sky shows through it)
      for (const x of [-30, -15, 15, 30]) banner(K, x, 11, -260, 'z', 12);
      slab(K, -51, -262, -16, -179, THRONE_ROOF); slab(K, 16, -262, 51, -179, THRONE_ROOF); slab(K, -16, -262, 16, -237, THRONE_ROOF); slab(K, -16, -204, 16, -179, THRONE_ROOF);
      pane(K, 0, THRONE_ROOF, tc, 32, 0.2, 33, 0xffe0a0, 0.12);
      for (let k = 0; k < 4; k++) ceiling(K, 0, THRONE_ROOF - 0.5, tc, 98, 0.5, 0.8, GOLD, { glow: 0.4, ry: k * Math.PI / 4 });
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3, x = 18 * Math.cos(a), z = tc + 18 * Math.sin(a);
        paneG(K, x, 10, z, 3, 20, 3, GOLDL, 0.13, { add: true });
      }
      gate(-42, -180, 7, 9, 'x', 3, 'door-throne');
      lamp(K, 0, 17, tc, GOLDL, 14, 50); lamp(K, 0, 6, -245, GOLDL, 9, 34); lamp(K, -30, 12, -190, GOLDL, 8, 34); lamp(K, 30, 12, -190, GOLDL, 8, 34);
    },
  },
};
