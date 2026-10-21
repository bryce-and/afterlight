// Hand-built Dreaming City mission maps (see makeKit in world.js).
// dc1 The Divalian Mists: fog-bound ruins and rope bridges -> Rheasilvia and the sealed Blind Well door -> the Strand plaza -> the Gate of the Mists.
// dc2 The Spine of Keres: the Strand's hill and cave mouth -> overgrown terraces of Esila -> crystal tunnels of the Spine -> Morgeth's roofed Oracle temple.
// dc3 The Wishing Chamber: Harbinger's Seclude cloister -> hedge-lane Gardens -> the Blight Hollow crater -> the vast roofed nest of the Ahamkara brood.
// Awoken ivory and lavender stone, crystal and gold, with Taken blight (black growths, orange veins) and torn banners spreading over it.
import * as THREE from 'three';

const IVORY = 0xe6dfcf, IVORY2 = 0xcfc7b4, LAV = 0xb8aed0, LAV2 = 0x8f84ad, DUSK = 0x5a5078, GOLD = 0xffd36b;
const ICE = 0x9fe8ff, BLIGHT = 0x15101c, BLIGHT2 = 0x2a1a2e, VEIN = 0xff7a1c, MOSS = 0x4f7a5c, MOSS2 = 0x6f9a6c;
const CLOTH = 0x5a2a6a, MIST = 0xeee8f8, VIOLET = 0xb48cff, BONE = 0xd8cfb4, PINK = 0xffc6e0;

// shared unit geometries, created lazily (THREE is only needed once build() runs)
let G = null;
const g = () => G || (G = {
  cone5: new THREE.ConeGeometry(1, 1, 5),
  octa: new THREE.OctahedronGeometry(1, 0),
  rock: new THREE.DodecahedronGeometry(1, 0),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl28: new THREE.CylinderGeometry(1, 1, 1, 28),
  disc: new THREE.CircleGeometry(1, 14),
  ico: new THREE.IcosahedronGeometry(1, 1),
});

// ---------------------------------------------------------------- helpers

// make a mesh translucent (materials are cached per colour, so give it its own copy)
function ghost(m, opacity) {
  m.material = m.material.clone();
  m.material.transparent = true;
  m.material.opacity = opacity;
  m.material.depthWrite = false;
  m.castShadow = false;
  return m;
}

// low drifting mist: a flat translucent disc (no collider)
function mist(K, x, z, r, y = 0.5, op = 0.3) {
  const m = K.mesh(g().disc, MIST, x, y, z, { rx: -Math.PI / 2, scale: [r, r, 1] });
  return ghost(m, op);
}

// flat floor inlay (no collider); the ground undulates by about 0.2 m so it sits above that
function pad(K, x, z, r, color, o = {}) {
  const m = K.mesh(g().cyl28, color, x, (o.y ?? 0) + 0.17, z, { scale: [r, 0.34, o.rz ?? r], glow: o.glow, ry: o.ry ?? 0 });
  m.castShadow = false;
  return m;
}

// ivory spire with a gold band and a glowing crystal tip
function spire(K, x, z, h, r, o = {}) {
  K.cyl(x, z, r, h, o.color ?? IVORY, { r2: r * 0.45, sides: 6 });
  K.mesh(g().cyl6, GOLD, x, h * 0.62, z, { scale: [r * 0.75, 0.35, r * 0.75], glow: 0.6 });
  K.mesh(g().octa, o.tip ?? ICE, x, h + r * 0.9, z, { scale: [r * 0.55, r * 1.2, r * 0.55], glow: 1.2 });
}

// distant scenery spire, no collider
function farSpire(K, x, z, y) {
  const h = K.R(14, 34), r = K.R(1.6, 3);
  K.mesh(g().cone5, K.RP([IVORY, IVORY2, LAV]), x, y + h / 2, z, { scale: [r, h, r], collide: false });
  K.mesh(g().octa, ICE, x, y + h + 0.6, z, { scale: [0.6, 1.4, 0.6], glow: 1.1 });
}

// two pillars and a lintel; axis 'x' puts the pillars apart along x (you walk through along z). broken: one pillar snapped
function arch(K, x, z, span, h, axis = 'x', o = {}) {
  const px = axis === 'x', col = o.color ?? IVORY;
  const a = [px ? x - span / 2 : x, px ? z : z - span / 2], b = [px ? x + span / 2 : x, px ? z : z + span / 2];
  K.box(a[0], a[1], 1.7, h, 1.7, col);
  K.box(b[0], b[1], 1.7, o.broken ? h * 0.42 : h, 1.7, col);
  if (!o.broken) {
    K.box(x, z, px ? span + 1.7 : 1.5, 1.3, px ? 1.5 : span + 1.7, col, { y: h - 0.2, collide: false });
    K.mesh(g().octa, GOLD, x, h + 1.3, z, { scale: [0.5, 0.8, 0.5], glow: 1.4 });
  } else {
    K.box(a[0] + (px ? span * 0.25 : 0), a[1] + (px ? 0 : span * 0.25), 2.6, 1.0, 1.4, col, { y: 0, collide: false }).rotation.y = 0.4;
  }
  if (o.light) K.light(x, h * 0.8, z, o.light, 6, 20);
}

// pale blue crystal cluster with a small collider
function crystal(K, x, z, s = 1, col = ICE) {
  for (const [dx, dz, k, hh] of [[0, 0, 1, 2.8], [0.7, 0.4, 0.6, 1.8], [-0.6, 0.5, 0.5, 1.5]]) {
    K.mesh(g().cone5, col, x + dx * s, hh * s / 2, z + dz * s, { scale: [0.5 * s * k + 0.1, hh * s, 0.5 * s * k + 0.1], glow: 0.7, rz: dx * 0.25 });
  }
  K.collider(x - 0.8 * s, 0, z - 0.8 * s, x + 0.8 * s, 2.5 * s, z + 0.8 * s, null);
}

// Taken blight growth: black lump with glowing orange veins
function blight(K, x, z, s = 1.6, o = {}) {
  K.mesh(g().rock, BLIGHT, x, s * 0.7, z, { scale: [s, s * 1.3, s * 0.9], ry: K.R(0, 6), collide: o.collide === false ? false : 0.7 });
  K.mesh(g().rock, BLIGHT2, x + s * 0.7, s * 0.35, z + s * 0.3, { scale: [s * 0.5, s * 0.6, s * 0.5], ry: 1 });
  for (let i = 0; i < 3; i++) {
    const a = K.R(0, 6.28);
    K.mesh(g().octa, VEIN, x + Math.cos(a) * s * 0.7, s * K.R(0.4, 1.3), z + Math.sin(a) * s * 0.7, { scale: [s * 0.12, s * 0.45, s * 0.12], glow: 1.8, rz: K.R(-0.4, 0.4) });
  }
  if (o.light) K.light(x, s * 1.3, z, VEIN, 4, 14);
}

// pole with a torn Awoken banner
function banner(K, x, z, h = 6) {
  K.box(x, z, 0.2, h, 0.2, LAV2, { collide: false });
  K.box(x + 0.5, z, 1.0, 2.6, 0.06, CLOTH, { y: h - 3, collide: false });
  K.box(x + 0.35, z, 0.55, 1.2, 0.06, CLOTH, { y: h - 4.1, collide: false });
  K.box(x, z, 0.5, 0.18, 0.5, GOLD, { y: h, collide: false, glow: 1 });
}

// lamp post with a warm bulb
function lamp(K, x, z, h = 4.5, color = GOLD) {
  K.box(x, z, 0.25, h, 0.25, LAV2, { collide: false });
  K.light(x, h + 0.3, z, color, 6, 20);
}

// brazier: bowl and a flame cone, with its own light
function brazier(K, x, z, color = VIOLET, s = 1) {
  K.cyl(x, z, 0.7 * s, 1.3 * s, IVORY2, { r2: 0.45 * s, sides: 6 });
  K.mesh(g().cone5, color, x, 1.9 * s, z, { scale: [0.5 * s, 1.1 * s, 0.5 * s], glow: 1.8, collide: false });
  K.light(x, 2.6 * s, z, color, 7, 22);
}

// pavilion-less rope bridge over a mist stream: planked deck, posts and two rails (decor; the ground is the walkway)
function bridge(K, x, z, len, w, axis = 'z') {
  const al = axis === 'z';
  K.box(x, z, al ? w : len, 0.1, al ? len : w, IVORY2, { y: 0.28, collide: false });
  for (const s of [-1, 1]) {
    const px = al ? x + s * w / 2 : x, pz = al ? z : z + s * w / 2;
    K.box(px, pz, al ? 0.12 : len, 0.12, al ? len : 0.12, DUSK, { y: 1.0, collide: false });
    for (const t of [-0.5, 0, 0.5]) K.box(al ? px : x + t * len, al ? z + t * len : pz, 0.22, 1.3, 0.22, LAV2, { y: 0.2, collide: false });
  }
}

// shallow glowing stream strip under a bridge
function stream(K, x, z, w, d, op = 0.5) {
  return ghost(K.box(x, z, w, 0.1, d, ICE, { y: 0.22, collide: false, glow: 0.35 }), op);
}

// full-width wall across the map with one gap, optionally closed by a zone-clear door; flanking pillars, trim and lights
function gateWall(K, z, gx, gapW, h, o = {}) {
  const b = K.bounds, c = gx - b.minX, col = o.color ?? IVORY2, trim = o.trim ?? GOLD, len = b.maxX - b.minX;
  K.wall(b.minX, z, b.maxX, z, h, { t: o.t ?? 1.8, color: col, gaps: [[c - gapW / 2, c + gapW / 2]] });
  K.box((b.minX + b.maxX) / 2, z, len, 0.3, (o.t ?? 1.8) + 0.3, trim, { y: h, collide: false, glow: 0.7 });
  for (const s of [-1, 1]) {
    const px = gx + s * (gapW / 2 + 1.4);
    K.box(px, z, 2.6, h + 3, 2.6, o.pillar ?? IVORY);
    K.mesh(g().octa, o.tip ?? ICE, px, h + 4, z, { scale: [0.7, 1.4, 0.7], glow: 1.3 });
    K.light(px, h + 1, z + 2.5, o.lamp ?? trim, 7, 24);
  }
  if (o.zone != null) K.door(gx, z, gapW, h, 'x', { zone: o.zone, color: o.doorColor ?? LAV2, trim });
  if (o.banners !== false) { banner(K, gx - gapW / 2 - 3.4, z + 2, 6.5); banner(K, gx + gapW / 2 + 3.4, z + 2, 6.5); }
}

// roofed tunnel running along z from za to zb: side walls, roof, glowing ribs and lights
function tunnel(K, x, za, zb, o = {}) {
  const w = o.w ?? 8, h = o.h ?? 10, col = o.color ?? LAV2, gl = o.glow ?? ICE;
  const z1 = Math.max(za, zb), z2 = Math.min(za, zb), zm = (z1 + z2) / 2, L = z1 - z2;
  K.wall(x - w / 2, z1, x - w / 2, z2, h, { t: 1, color: col });
  K.wall(x + w / 2, z1, x + w / 2, z2, h, { t: 1, color: col });
  K.box(x, zm, w + 2, 0.7, L, o.roof ?? LAV, { y: h });
  for (let z = z1 - 3; z > z2; z -= 6) {
    K.box(x, z, w, 0.6, 0.7, col, { y: h - 0.6, collide: false });
    for (const s of [-1, 1]) K.box(x + s * (w / 2 - 0.55), z, 0.14, 4.5, 0.4, gl, { y: 1.2, collide: false, glow: 1.3 });
  }
  for (let z = z1 - 4; z > z2; z -= 8) K.light(x, h - 1.5, z, gl, 6, 18);
}

// ragged rock crest and cave-mouth wall across the map with one gap (dc2 and dc3); door optional
function cliffWall(K, z, gx, gapW, h, o = {}) {
  const b = K.bounds, c = gx - b.minX, t = o.t ?? 4;
  K.wall(b.minX, z, b.maxX, z, h, { t, color: K.C.rock2, gaps: [[c - gapW / 2, c + gapW / 2]] });
  for (let x = b.minX + 6; x < b.maxX; x += 11) {
    if (Math.abs(x - gx) < gapW / 2 + 2) continue;
    K.mesh(g().rock, K.RP([K.C.rock, K.C.rock2]), x + K.R(-2, 2), h + 0.5, z + K.R(-0.6, 0.6), { scale: [K.R(4, 6.5), K.R(2, 5), t * 0.6], ry: K.R(-0.2, 0.2), collide: false });
  }
  for (const s of [-1, 1]) {
    const px = gx + s * (gapW / 2 + 1.6);
    K.mesh(g().rock, K.C.rock, px, h * 0.55, z, { scale: [2.6, h * 0.7, t * 0.6], collide: false });
    crystal(K, px + s * 3, z + 3.2, 1.3);
  }
  K.mesh(g().rock, K.C.rock, gx, h + 1.4, z, { scale: [gapW * 0.7, 3, t * 0.55], collide: false });
  if (o.zone != null) K.door(gx, z, gapW, h, 'x', { zone: o.zone, color: o.doorColor ?? K.C.rock2, trim: o.trim ?? ICE });
  K.light(gx, h - 1, z + 3, o.lamp ?? ICE, 8, 26);
}

// hedge row (collides, climbable-height cover)
function hedge(K, x, z, w, d, h = 1.4) {
  K.box(x, z, w, h, d, MOSS);
  K.box(x, z, w * 0.96, 0.35, d * 0.96, MOSS2, { y: h, collide: false });
}

// small pale flowers, glowing a little
function flowers(K, cx, cz, r, n) {
  for (let i = 0; i < n; i++) {
    const a = K.R(0, 6.28), d = K.R(0, r);
    K.mesh(g().octa, K.RP([PINK, IVORY, ICE]), cx + Math.cos(a) * d, 0.5, cz + Math.sin(a) * d, { scale: 0.22, glow: 0.6, collide: false });
  }
}

// fallen column
function fallen(K, x, z, len, ry, r = 0.8) {
  K.mesh(g().cyl6, IVORY2, x, r, z, { scale: [r, len, r], rz: Math.PI / 2, ry, collide: 0.9 });
}

// stone ruin wall stub with a crumbled top
function stub(K, x, z, w, d, h, col = IVORY2) {
  K.box(x, z, w, h, d, col);
  K.box(x + w * 0.2, z, w * 0.4, 0.5, d * 0.9, col, { y: h, collide: false });
}

export default {
  // ===========================================================================
  // The Divalian Mists: Petra's gate at the end of a fog-bound approach.
  // ===========================================================================
  dc1: {
    spawn: [0, 18],
    bounds: [-72, 72, -292, 30],
    zones: [
      { name: 'Divalian Mists', x: 0, z: -42 },
      { name: 'Rheasilvia', x: -14, z: -110 },
      { name: 'The Strand', x: 10, z: -176 },
      { name: 'Gate of the Mists', x: 0, z: -242, boss: true, room: { minX: -29, maxX: 29, minZ: -268, maxZ: -216 } },
    ],
    build(K) {
      const { R } = K;

      // ---- Divalian Mists: fog-swallowed ruins, mist streams, rope bridges ----
      for (const [x, z, r, y] of [[-30, -20, 15, 0.5], [28, -34, 16, 0.8], [-8, -58, 14, 0.6], [34, -66, 13, 0.9], [-44, -48, 12, 0.7], [6, -6, 12, 0.5], [-22, -72, 10, 0.8], [8, -44, 13, 0.7]]) {
        mist(K, x, z, r, y, 0.34); mist(K, x + 3, z - 2, r * 0.7, y + 0.55, 0.22);
      }
      stream(K, 0, -12, 144, 7);
      bridge(K, 0, -12, 11, 5); bridge(K, -40, -12, 11, 4); bridge(K, 42, -12, 11, 4);
      arch(K, 0, -62, 12, 11, 'x', { light: GOLD });
      arch(K, -26, -30, 9, 9, 'x', { broken: true });
      arch(K, 26, -50, 10, 10, 'x', { light: ICE });
      arch(K, 40, -20, 8, 8, 'z', { broken: true });
      for (const [x, z, w, d, h] of [[-14, -22, 6, 0.9, 2.2], [16, -24, 0.9, 6, 1.8], [-38, -52, 7, 0.9, 2.6], [12, -60, 5, 0.9, 2.0], [-14, -34, 0.9, 5, 1.4], [16, -48, 5, 0.9, 1.6], [-30, -66, 6, 0.9, 2.4]]) stub(K, x, z, w, d, h);
      fallen(K, -22, -44, 7, 0.3); fallen(K, 24, -66, 6, -0.5); fallen(K, 10, -30, 5, 1.2);
      // the great broken ring, half lost in the fog
      K.mesh(new THREE.TorusGeometry(11, 1.3, 5, 14, 4.2), IVORY, -52, 10, -62, { ry: 0.3 });
      K.box(-58, -60, 4, 3, 3, IVORY2); K.box(-47, -66, 4, 2, 3, IVORY2);
      for (const [x, z] of [[-48, -22], [46, -44], [42, -72]]) blight(K, x, z, R(2.4, 3.2), { light: true });
      for (const [x, z] of [[-10, -14], [14, -36], [-6, -66], [30, -8]]) banner(K, x, z, R(5.5, 7));
      for (const [x, z] of [[-6, 6], [8, -28], [-18, -50], [20, -42]]) lamp(K, x, z, 3.6, ICE);
      K.scatter((x, z) => K.rock(x, z, R(1, 2)), 0, -42, 8, 19, 5, 2.4);
      crystal(K, -56, -30, 1.6); crystal(K, 56, -26, 1.4); crystal(K, 52, -64, 1.2);
      for (const [x, z] of [[-50, 4], [50, 6], [-60, -34], [60, -50], [-58, -76], [56, -78]]) spire(K, x, z, R(16, 26), 2.2);

      // ---- veil wall and gate (opens when the Mists are cleared) ----
      gateWall(K, -80, 0, 8, 8, { zone: 0 });

      // ---- Rheasilvia: the mountain approach, tiered cliffs and the sealed Blind Well door ----
      // east: three stepped terraces of high ground
      K.platform(52, -102, 22, 30, 1.2, { stairs: ['w'], color: LAV, stairColor: IVORY2, stairW: 6 });
      K.platform(56, -102, 14, 20, 1.2, { y: 1.2, stairs: ['w'], color: LAV2, stairColor: IVORY2, stairW: 5 });
      K.platform(60, -102, 7, 10, 1.2, { y: 2.4, stairs: ['w'], color: DUSK, stairColor: IVORY2, stairW: 4 });
      for (const [x, z, h] of [[50, -116, 2.4], [58, -92, 3.2]]) stub(K, x, z, 5, 1, h, IVORY2);
      K.platform(52, -134, 16, 14, 0.8, { stairs: ['w'], color: LAV, stairColor: IVORY2, stairW: 4 });
      spire(K, 66, -80, 22, 2.6); spire(K, 66, -126, 18, 2.4);
      // west: sheer wall with the Blind Well door, a sealed gold-ringed slab
      K.wall(-64, -82, -64, -142, 14, { t: 3, color: LAV2, gaps: [[28, 40]] });
      K.door(-64, -108, 12, 14, 'z', { zone: null, id: 'blindwell', color: IVORY2, trim: GOLD });
      for (const z of [-115.8, -100.2]) { K.box(-64, z, 3.2, 17, 2.6, IVORY); K.mesh(g().octa, GOLD, -64, 18, z, { scale: [0.7, 1.4, 0.7], glow: 1.4 }); }
      K.mesh(new THREE.TorusGeometry(4.4, 0.3, 5, 28), GOLD, -62.2, 7, -108, { ry: Math.PI / 2, glow: 1.2 });
      K.mesh(new THREE.TorusGeometry(2.4, 0.25, 5, 20), GOLD, -62.2, 7, -108, { ry: Math.PI / 2, glow: 1.2 });
      K.platform(-58, -108, 5, 18, 0.8, { stairs: ['e'], color: IVORY2, stairColor: LAV, stairW: 6 });
      K.light(-60, 6, -108, GOLD, 10, 30);
      for (let z = -88; z > -140; z -= 12) { if (Math.abs(z + 108) < 12) continue; K.mesh(g().rock, K.C.rock2, -64, 14.5, z, { scale: [3, 3, 5], collide: false }); }
      // the path up: waystones and broken stairs, rubble and blight creeping in
      for (const [x, z] of [[-30, -92], [0, -126], [28, -88], [-40, -128]]) K.rock(x, z, R(2, 3.2));
      for (const [x, z] of [[-34, -100], [26, -130], [36, -108]]) blight(K, x, z, R(2, 3), { light: true });
      for (const [x, z, w, d, h] of [[-26, -106, 5, 0.9, 2.2], [4, -98, 0.9, 5, 1.8], [-34, -122, 6, 0.9, 2.5], [14, -122, 0.9, 5, 1.6]]) stub(K, x, z, w, d, h, LAV);
      for (let i = 0; i < 5; i++) banner(K, -44 + i * 5, -84 - i * 11, R(5.5, 7));
      for (const [x, z] of [[-34, -110], [34, -92], [20, -112]]) lamp(K, x, z, 4, GOLD);
      K.scatter((x, z) => K.rock(x, z, R(1, 2)), -14, -110, 8, 19, 5, 2.6);
      mist(K, -20, -100, 16, 0.6, 0.3); mist(K, 12, -126, 14, 0.7, 0.28);
      crystal(K, -50, -92, 1.5); crystal(K, -48, -134, 1.3);
      gateWall(K, -142, 8, 8, 8, { zone: 1, color: LAV });

      // ---- The Strand: the wide valley, a ruined plaza ringed by broken columns ----
      pad(K, 10, -176, 24, LAV);
      pad(K, 10, -176, 22.4, IVORY2);
      K.mesh(new THREE.TorusGeometry(15, 0.3, 4, 40), GOLD, 10, 0.36, -176, { rx: Math.PI / 2, glow: 0.8 });
      pad(K, 10, -176, 4, GOLD, { glow: 0.5 });
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.2, x = 10 + Math.cos(a) * 23, z = -176 + Math.sin(a) * 23, h = i % 3 === 0 ? 3 : R(6, 10);
        K.cyl(x, z, 1.2, h, IVORY, { r2: 1, sides: 6 });
        if (h > 5) K.box(x, z, 2.6, 0.6, 2.6, IVORY2, { y: h, collide: false });
      }
      for (const [x, z, w, d, h] of [[-4, -166, 5, 0.9, 1.4], [24, -168, 0.9, 5, 1.4], [20, -186, 5, 0.9, 1.4], [-2, -186, 0.9, 5, 1.4], [10, -160, 4, 0.9, 1.2]]) stub(K, x, z, w, d, h);
      // a toppled giant statue across the north west
      K.box(-30, -190, 14, 3, 4.4, IVORY2, { collide: false }).rotation.y = 0.5;
      K.collider(-37, 0, -194, -23, 3, -186, null);
      K.mesh(g().ico, IVORY, -22, 2.4, -194, { scale: [3, 3.2, 3], collide: 0.7 });
      K.box(-44, -183, 2.2, 8, 2.2, IVORY2);
      fallen(K, 44, -166, 8, 0.2);
      // far valley towers
      for (const [x, z, h] of [[-62, -160, 30], [64, -150, 36], [62, -200, 26]]) { K.box(x, z, 7, h, 7, IVORY); K.box(x, z, 5, 4, 5, GOLD, { y: h, collide: false, glow: 0.5 }); K.mesh(g().octa, ICE, x, h + 6, z, { scale: [1.4, 3, 1.4], glow: 1.2 }); }
      for (const [x, z] of [[-26, -158], [44, -200], [-40, -204]]) blight(K, x, z, R(2.6, 3.4), { light: true });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; lamp(K, 10 + Math.cos(a) * 26, -176 + Math.sin(a) * 26, 4.2, i % 2 ? GOLD : VIOLET); }
      for (const [x, z] of [[-14, -156], [34, -154], [34, -198]]) banner(K, x, z, R(6, 8));
      mist(K, -30, -170, 18, 0.5, 0.22); mist(K, 50, -180, 16, 0.5, 0.22);
      K.scatter((x, z) => K.rock(x, z, R(1, 1.8)), 10, -176, 11, 19, 3, 2.4);
      crystal(K, 58, -176, 1.6); crystal(K, -54, -176, 1.5);

      // ---- Gate of the Mists: walled courtyard, ringed dais, the great sealed gate ----
      K.room(0, -242, 58, 52, 11, { t: 1.6, color: IVORY2, doors: { s: 8 } });
      K.door(0, -216, 8, 11, 'x', { zone: 2, color: LAV2, trim: GOLD });
      pad(K, 0, -242, 18, LAV);
      pad(K, 0, -242, 16.8, IVORY2);
      K.mesh(new THREE.TorusGeometry(16.5, 0.22, 4, 44), GOLD, 0, 0.38, -242, { rx: Math.PI / 2, glow: 1 });
      pad(K, 0, -242, 9.4, LAV2);
      pad(K, 0, -242, 3.2, GOLD, { glow: 0.7 });
      for (const [x, z] of [[-21, -230], [21, -230], [-21, -254], [21, -254]]) {
        K.box(x, z, 3.2, 13, 3.2, IVORY);
        K.box(x, z, 4.2, 0.9, 4.2, GOLD, { y: 13, collide: false, glow: 0.5 });
        K.mesh(g().octa, ICE, x, 15, z, { scale: [0.8, 1.6, 0.8], glow: 1.3 });
      }
      // the sealed gate in the north wall
      for (const s of [-1, 1]) { K.box(s * 8, -266.6, 2.6, 15, 2.6, IVORY); K.mesh(g().octa, GOLD, s * 8, 16.5, -266.6, { scale: [0.8, 1.6, 0.8], glow: 1.4 }); }
      K.box(0, -266.6, 20, 2.0, 2.4, IVORY, { y: 11, collide: false });
      ghost(K.box(0, -266.7, 13.4, 11, 0.3, VIOLET, { collide: false, glow: 1.1 }), 0.7);
      K.mesh(new THREE.TorusGeometry(4.6, 0.3, 5, 28), GOLD, 0, 6.5, -266.4, { glow: 1.2 });
      for (const [x, z, c] of [[-26, -222, VIOLET], [26, -222, VIOLET], [-26, -242, GOLD], [26, -242, GOLD], [-26, -262, VIOLET], [26, -262, VIOLET]]) brazier(K, x, z, c, 1.1);
      for (const [x, z] of [[-26.6, -236], [26.6, -236], [-26.6, -250], [26.6, -250]]) banner(K, x, z, 8.5);
      for (const [x, z] of [[-24, -264], [25, -220], [-25, -219], [24, -264]]) blight(K, x, z, R(2, 2.8), { light: true });
      for (const [x, z, w, d] of [[-13, -258, 5, 1], [13, -226, 5, 1], [-14, -226, 1, 5], [14, -258, 1, 5]]) stub(K, x, z, w, d, 1.5);
      mist(K, -18, -236, 9, 0.5, 0.25); mist(K, 18, -250, 9, 0.5, 0.25);
      K.light(0, 9, -242, VIOLET, 12, 40);

      K.edge((x, z, y) => farSpire(K, x, z, y), 26, 6, 40);
    },
  },

  // ===========================================================================
  // The Spine of Keres: the Queen's road to the Oracle, ending in Morgeth's temple.
  // ===========================================================================
  dc2: {
    spawn: [0, 18],
    bounds: [-72, 72, -316, 30],
    zones: [
      { name: 'The Strand', x: 0, z: -46 },
      { name: 'Gardens of Esila', x: -10, z: -122 },
      { name: 'Spine of Keres', x: 0, z: -200 },
      { name: 'Oracle Temple', x: 0, z: -276, boss: true, room: { minX: -31, maxX: 31, minZ: -308, maxZ: -244 } },
    ],
    build(K) {
      const { R, C } = K;

      // ---- The Strand: a grassy hill on the east, ruins below it, the cave mouth ahead ----
      K.platform(50, -44, 22, 36, 1.2, { stairs: ['w'], color: MOSS, stairColor: IVORY2, stairW: 6 });
      K.platform(54, -44, 14, 24, 1.2, { y: 1.2, stairs: ['w'], color: MOSS2, stairColor: IVORY2, stairW: 5 });
      K.platform(58, -44, 7, 12, 1.2, { y: 2.4, stairs: ['w'], color: IVORY2, stairColor: IVORY2, stairW: 4 });
      // a hilltop shrine: four columns and a small spire
      for (const [x, z] of [[56, -50], [60, -50], [56, -38], [60, -38]]) K.box(x, z, 1.1, 5, 1.1, IVORY, { y: 3.6 });
      spire(K, 58, -44, 9, 1.0, { color: IVORY2 });
      K.light(58, 10, -44, GOLD, 8, 26);
      crystal(K, 40, -70, 1.4); crystal(K, 66, -66, 1.6); crystal(K, 40, -14, 1.2);
      arch(K, -20, -30, 10, 9, 'x', { light: ICE });
      arch(K, 18, -66, 9, 8, 'x', { broken: true });
      arch(K, -34, -60, 8, 8, 'z', { broken: true });
      for (const [x, z, w, d, h] of [[-12, -22, 6, 0.9, 2.0], [20, -22, 0.9, 6, 1.6], [-30, -44, 0.9, 6, 2.2], [14, -58, 5, 0.9, 1.5], [-16, -58, 5, 0.9, 1.7]]) stub(K, x, z, w, d, h);
      fallen(K, -8, -64, 7, 0.4); fallen(K, 26, -30, 5, 1.1);
      for (const [x, z] of [[-48, -20], [-50, -62], [30, -14]]) {
        K.mesh(g().rock, C.rock2, x, 2.2, z, { scale: [R(4, 6), R(3, 4.5), R(4, 6)], collide: 0.75 });
      }
      for (const [x, z] of [[-40, -30], [6, -10]]) blight(K, x, z, R(2, 2.8), { light: true });
      for (const [x, z] of [[-8, -8], [10, -36], [-26, -50]]) banner(K, x, z, R(5.5, 7));
      for (const [x, z] of [[-4, 8], [12, -18], [-12, -40]]) lamp(K, x, z, 3.6, GOLD);
      K.scatter((x, z) => K.rock(x, z, R(1, 2)), 0, -46, 8, 19, 5, 2.4);
      flowers(K, -20, -20, 14, 14);
      for (const [x, z] of [[-60, -6], [64, 8], [-62, -76]]) spire(K, x, z, R(18, 26), 2.2);
      // the cave mouth: ragged rock wall, door opens on the clear
      cliffWall(K, -82, 0, 10, 10, { zone: 0 });

      // ---- Gardens of Esila: overgrown ivory terraces, hedge rows, arbors, a fountain ----
      pad(K, -10, -122, 15, MOSS);
      // west terraces climbing the slope, green-topped
      K.platform(-54, -118, 18, 40, 0.8, { stairs: ['e'], color: IVORY2, stairColor: LAV, stairW: 6 });
      K.platform(-58, -118, 10, 30, 0.8, { y: 0.8, stairs: ['e'], color: IVORY, stairColor: LAV, stairW: 5 });
      K.box(-54, -118, 17.4, 0.3, 39.4, MOSS, { y: 0.8, collide: false });
      K.box(-58, -118, 9.4, 0.3, 29.4, MOSS2, { y: 1.6, collide: false });
      hedge(K, -48, -100, 0.9, 10); hedge(K, -48, -136, 0.9, 10);
      // hedge rows and arbors
      hedge(K, 14, -102, 14, 1.1); hedge(K, 22, -140, 12, 1.1); hedge(K, -30, -100, 10, 1.1); hedge(K, -28, -142, 9, 1.1);
      hedge(K, 32, -118, 1.1, 12); hedge(K, -34, -122, 1.1, 8);
      for (const [x, z, ax] of [[0, -98, 'x'], [-22, -134, 'x'], [28, -128, 'z']]) {
        arch(K, x, z, 6, 5, ax, { color: IVORY });
        K.box(x, z, ax === 'x' ? 7 : 1.1, 0.8, ax === 'x' ? 1.1 : 7, MOSS2, { y: 4.7, collide: false });
      }
      // ruined fountain with a crystal heart
      K.cyl(30, -104, 3.2, 1.0, IVORY2, { sides: 10 });
      K.mesh(g().cyl28, ICE, 30, 1.0, -104, { scale: [2.7, 0.15, 2.7], glow: 0.5, collide: false });
      crystal(K, 30, -104, 1.0);
      // an ivory pavilion with a green roof
      for (const [x, z] of [[-30, -148], [-22, -148], [-30, -140], [-22, -140]]) K.box(x, z, 1.1, 5, 1.1, IVORY);
      K.box(-26, -144, 10, 0.6, 10, MOSS, { y: 5, collide: false });
      K.mesh(g().cone5, MOSS2, -26, 6.4, -144, { scale: [6, 2.6, 6], ry: 0.8, collide: false });
      // ivy-wrapped spires along the north
      for (const [x, z] of [[-62, -92], [60, -96], [58, -146], [-64, -150]]) { spire(K, x, z, R(14, 20), 2.0); K.mesh(g().cone5, MOSS, x, 4, z, { scale: [3, 8, 3], collide: false }); }
      for (const [x, z] of [[36, -150], [-38, -90]]) blight(K, x, z, R(2.2, 3), { light: true });
      flowers(K, -10, -122, 22, 26); flowers(K, 24, -116, 8, 10);
      for (const [x, z] of [[-16, -98], [8, -150], [-44, -112]]) banner(K, x, z, R(5.5, 7));
      for (const [x, z] of [[-4, -110], [18, -126], [-28, -118]]) lamp(K, x, z, 3.8, PINK);
      K.scatter((x, z) => K.rock(x, z, R(1, 1.8)), -10, -122, 8, 19, 4, 2.4);
      gateWall(K, -158, 0, 8, 8, { color: IVORY2, trim: MOSS2, pillar: IVORY, tip: MOSS2, lamp: GOLD });

      // ---- Spine of Keres: tunnel in, crystal-blue hall of ribs and balconies, tunnel on ----
      tunnel(K, 0, -158, -172, { color: LAV2, glow: ICE });
      K.room(0, -200, 52, 56, 12, { t: 1.4, color: LAV2, roofColor: LAV, doors: { s: 8, n: 8 }, roof: true });
      K.door(0, -172, 8, 12, 'x', { zone: 1, color: IVORY2, trim: ICE });
      // rib arches of a great spine overhead, with pale glow strips
      for (let z = -176; z > -226; z -= 7) {
        K.box(0, z, 50, 0.9, 1.0, IVORY, { y: 10.6, collide: false });
        for (const s of [-1, 1]) { K.box(s * 24.6, z, 1.2, 10.6, 1.0, IVORY, { collide: false }); K.box(s * 24.0, z, 0.2, 6, 0.5, ICE, { y: 2.4, collide: false, glow: 1.2 }); }
      }
      // balconies with stairs along both flanks: optional high ground
      for (const s of [-1, 1]) {
        K.platform(s * 20, -200, 8, 30, 2.4, { stairs: [s < 0 ? 'e' : 'w'], color: LAV, stairColor: IVORY2, stairW: 5 });
        K.box(s * 20, -200, 7.4, 0.4, 29.4, ICE, { y: 2.4, collide: false, glow: 0.35 });
        for (const dz of [-12, 0, 12]) crystal(K, s * 22, -200 + dz, 1.4);
      }
      for (const [x, z] of [[-10, -182], [10, -182], [-10, -220], [10, -220]]) { K.box(x, z, 2.4, 12, 2.4, IVORY); K.box(x, z, 3.2, 0.7, 3.2, GOLD, { y: 11, collide: false, glow: 0.6 }); }
      for (const [x, z] of [[-7, -204], [8, -194], [-6, -192], [7, -212]]) K.rock(x, z, R(0.9, 1.4));
      pad(K, 0, -200, 6, ICE, { glow: 0.45 });
      K.box(0, -200, 1.0, 0.1, 50, ICE, { y: 0.34, collide: false, glow: 1.2 });
      for (const [x, z] of [[-24, -176], [24, -176], [-24, -224], [24, -224]]) crystal(K, x, z, 1.6);
      for (const [x, z] of [[0, -178], [-14, -200], [14, -200], [0, -224], [-14, -186], [14, -214]]) K.light(x, 9, z, ICE, 7, 24);
      blight(K, 15, -222, 2.4, { light: true }); blight(K, -16, -180, 2.2, { light: true });
      tunnel(K, 0, -228, -246, { color: LAV2, glow: ICE });

      // ---- Oracle Temple: Morgeth's roofed hall, colonnades, the stepped Oracle dais ----
      K.room(0, -276, 62, 64, 14, { t: 1.6, color: IVORY2, roofColor: IVORY, doors: { s: 8 }, roof: true });
      K.door(0, -244, 8, 14, 'x', { zone: 2, color: LAV2, trim: GOLD });
      pad(K, 0, -276, 17, LAV);
      pad(K, 0, -276, 15.8, IVORY2);
      K.mesh(new THREE.TorusGeometry(15.4, 0.22, 4, 44), GOLD, 0, 0.38, -276, { rx: Math.PI / 2, glow: 1 });
      pad(K, 0, -276, 3.4, GOLD, { glow: 0.7 });
      for (const z of [-258, -268, -278, -288, -298]) for (const s of [-1, 1]) {
        K.box(s * 22, z, 2.2, 14, 2.2, IVORY);
        K.box(s * 22, z, 3.2, 0.9, 3.2, GOLD, { y: 12.6, collide: false, glow: 0.5 });
        K.box(s * 22, z, 3.0, 0.8, 3.0, IVORY2, { collide: false });
      }
      for (let z = -250; z > -306; z -= 8) K.box(0, z, 60, 0.9, 0.9, IVORY, { y: 13, collide: false });
      for (const z of [-262, -280, -296]) for (const s of [-1, 1]) K.box(s * 30.5, z, 0.3, 7, 3, ICE, { y: 4, collide: false, glow: 1.2 });
      // the Oracle: a gold ring and a bright core, on a stepped dais at the north
      K.platform(0, -300, 26, 10, 1.2, { stairs: ['s'], color: IVORY2, stairColor: LAV, stairW: 9 });
      K.platform(0, -302, 12, 5, 1.2, { y: 1.2, stairs: ['s'], color: IVORY, stairColor: IVORY2, stairW: 5 });
      K.mesh(new THREE.TorusGeometry(6, 0.55, 6, 32), GOLD, 0, 9, -304.4, { glow: 1.0 });
      K.mesh(new THREE.TorusGeometry(3.6, 0.4, 6, 28), GOLD, 0, 9, -304.2, { glow: 1.0 });
      K.mesh(g().ico, 0xfff0c0, 0, 9, -304.2, { scale: 1.8, glow: 1.6, collide: false });
      K.light(0, 9, -300, GOLD, 14, 44);
      for (const [x, z, c] of [[-14, -252, 0xff9a3c], [14, -252, 0xff9a3c], [-14, -296, 0xff9a3c], [14, -296, 0xff9a3c]]) brazier(K, x, z, c, 1.2);
      for (const [x, z] of [[-28, -250], [28, -250], [-28, -304], [28, -304]]) crystal(K, x, z, 1.6);
      for (const [x, z] of [[-30.4, -272], [30.4, -272], [-30.4, -286], [30.4, -286]]) banner(K, x, z, 10);
      for (const [x, z] of [[-27, -296], [27, -298]]) blight(K, x, z, 2.6, { light: true });
      for (const [x, z, w, d] of [[-12, -262, 4, 1], [12, -262, 4, 1], [-12, -290, 4, 1], [12, -290, 4, 1]]) stub(K, x, z, w, d, 1.4);
      for (const [x, z] of [[-8, -250], [8, -250], [0, -270]]) K.light(x, 11, z, ICE, 7, 26);

      K.edge((x, z, y) => farSpire(K, x, z, y), 26, 6, 40);
    },
  },

  // ===========================================================================
  // The Wishing Chamber: Riven's brood, deep in the Taken-infested north of the city.
  // ===========================================================================
  dc3: {
    spawn: [0, 18],
    bounds: [-80, 80, -324, 30],
    zones: [
      { name: "Harbinger's Seclude", x: 0, z: -44 },
      { name: 'Gardens of Esila', x: -4, z: -118 },
      { name: 'Blight Hollow', x: 6, z: -192 },
      { name: 'The Wishing Chamber', x: 0, z: -268, boss: true, room: { minX: -44, maxX: 44, minZ: -310, maxZ: -226 } },
    ],
    build(K) {
      const { R, C } = K;

      // ---- Harbinger's Seclude: a cloistered retreat, colonnades, reflecting pool, the Harbinger's tower ----
      pad(K, 0, -44, 9, LAV); // processional paving
      K.box(0, -40, 5, 0.22, 100, IVORY2, { y: 0.1, collide: false });
      // colonnade rows down both sides of the avenue
      for (const sx of [-1, 1]) for (let z = 0; z > -78; z -= 9) {
        const x = sx * 34;
        K.box(x, z, 1.7, 8, 1.7, IVORY);
        K.box(x, z, 2.4, 0.7, 2.4, GOLD, { y: 8, collide: false, glow: 0.4 });
        if (z < 0) K.box(sx * 38.5, z - 4.5, 7, 0.7, 1.2, IVORY2, { y: 8.3, collide: false });
        if (z === -27 || z === -63) lamp(K, sx * 28, z, 3.8, GOLD);
      }
      for (const sx of [-1, 1]) K.wall(sx * 42, 0, sx * 42, -78, 6, { t: 1.2, color: IVORY2, gaps: [[14, 24], [50, 60]] });
      // reflecting pool east, with a statue on a plinth
      pad(K, 22, -50, 12, IVORY2);
      ghost(K.mesh(g().cyl28, ICE, 22, 0.4, -50, { scale: [10.6, 0.1, 10.6], glow: 0.4, collide: false }), 0.6);
      {
        K.box(22, -50, 2.4, 1.6, 2.4, IVORY2);
        K.box(22, -50, 0.9, 3.4, 0.7, IVORY, { y: 1.6 });
        K.mesh(g().ico, IVORY, 22, 5.7, -50, { scale: [0.7, 0.9, 0.6], collide: false });
        K.mesh(g().octa, ICE, 22, 7.1, -50, { scale: [0.3, 0.5, 0.3], glow: 1.6 });
      }
      // the Harbinger's tower, a tall ivory shaft with floating gold rings
      K.box(-50, -62, 8, 38, 8, IVORY);
      K.box(-50, -62, 9.5, 1.2, 9.5, GOLD, { y: 14, collide: false, glow: 0.5 });
      K.box(-50, -62, 6, 3, 6, IVORY2, { y: 38, collide: false });
      for (const [r, y] of [[8, 30], [6, 36], [4.4, 42]]) K.mesh(new THREE.TorusGeometry(r, 0.3, 4, 28), GOLD, -50, y, -62, { rx: Math.PI / 2, glow: 1 });
      K.mesh(g().octa, ICE, -50, 47, -62, { scale: [1.8, 3.4, 1.8], glow: 1.4 });
      K.light(-50, 14, -54, GOLD, 8, 28);
      // Awoken statues on plinths along the cloister, and a stone bench or two
      for (const [x, z] of [[-24, -20], [26, -22], [-22, -70], [18, -72]]) {
        K.box(x, z, 2, 1.3, 2, IVORY2);
        K.box(x, z, 0.9, 3, 0.7, IVORY, { y: 1.3 });
        K.mesh(g().ico, IVORY, x, 5.3, z, { scale: [0.65, 0.8, 0.55], collide: false });
        K.mesh(g().octa, ICE, x, 6.5, z, { scale: 0.22, glow: 1.4 });
      }
      for (const [x, z] of [[-12, -26], [14, -64]]) K.box(x, z, 4, 0.8, 0.9, IVORY2);
      for (const [x, z] of [[-30, -36], [30, -34], [-14, -8], [14, -76]]) blight(K, x, z, R(2.4, 3.2), { light: true });
      for (const [x, z] of [[-10, -64], [12, -16], [-30, -8], [30, -60]]) banner(K, x, z, R(6, 8));
      for (const [x, z] of [[-6, -30], [8, -58], [-20, -52]]) crystal(K, x, z, 1.2);
      K.scatter((x, z) => K.rock(x, z, R(1, 1.8)), 0, -44, 9, 19, 3, 2.4);
      mist(K, -16, -30, 12, 0.5, 0.2);
      for (const [x, z] of [[-60, 6], [62, 4], [-62, -20], [60, -24]]) spire(K, x, z, R(16, 24), 2.2);
      gateWall(K, -84, 0, 8, 8, { zone: 0, color: IVORY2, pillar: IVORY });

      // ---- Gardens of Esila (the northern side): lanes of hedge and trellis arches, a greenhouse frame, a raised terrace ----
      // three lanes: hedge walls run north-south with openings between them
      for (const x of [-26, 22]) for (const [a, b] of [[-90, -104], [-112, -126], [-134, -144]]) hedge(K, x, (a + b) / 2, 1.2, Math.abs(b - a), 1.6);
      for (let z = -92; z > -146; z -= 9) {
        if (Math.abs(z + 118) < 10) continue; // keep the middle clear
        arch(K, -4, z, 7, 5.2, 'x', { color: IVORY });
        K.box(-4, z, 8, 0.8, 1.1, MOSS2, { y: 5.0, collide: false });
      }
      // the greenhouse frame on the east: ivory ribs and translucent ice panes
      for (let z = -100; z > -140; z -= 8) K.box(44, z, 0.8, 7, 0.8, IVORY);
      K.box(44, -120, 0.8, 0.8, 40, IVORY, { y: 7, collide: false });
      for (let z = -104; z > -136; z -= 8) ghost(K.box(44.2, z, 0.2, 6.2, 7.4, ICE, { collide: false, glow: 0.2 }), 0.32);
      K.box(52, -120, 0.8, 7, 40, IVORY2);
      // raised west terrace, stairs up, a low colonnade
      K.platform(-50, -118, 16, 34, 2.4, { stairs: ['e'], color: IVORY2, stairColor: LAV, stairW: 7 });
      for (const z of [-104, -112, -120, -128, -136]) K.box(-56, z, 1.2, 5, 1.2, IVORY, { y: 2.4 });
      K.box(-56, -120, 1.2, 0.8, 34, IVORY, { y: 7.4, collide: false });
      K.light(-50, 6, -118, GOLD, 7, 24);
      // blight has taken the old fountain
      K.cyl(12, -138, 3.0, 1.0, IVORY2, { sides: 10 });
      blight(K, 12, -138, 2.2, { light: true });
      for (const [x, z] of [[-34, -96], [34, -100], [-34, -140]]) blight(K, x, z, R(2.2, 3), { light: true });
      flowers(K, -4, -118, 22, 18);
      for (const [x, z] of [[-18, -90], [10, -146], [34, -130]]) banner(K, x, z, R(6, 8));
      for (const [x, z] of [[-14, -108], [16, -128]]) lamp(K, x, z, 4, VIOLET);
      for (const [x, z] of [[-60, -90], [62, -92], [-60, -150], [62, -150]]) spire(K, x, z, R(16, 22), 2.0);
      mist(K, 0, -120, 20, 0.5, 0.18);
      K.scatter((x, z) => K.rock(x, z, R(1, 1.8)), -4, -118, 8, 19, 3, 2.4);
      // a rock-ribbed gate into the Hollow (opens when the Court is cleared)
      cliffWall(K, -154, 6, 10, 9, { zone: 1, trim: VEIN, lamp: VEIN });

      // ---- Blight Hollow: a crater of black growths, orange-veined, rimmed with rock ----
      pad(K, 6, -192, 28, BLIGHT);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.3, d = R(14, 24);
        K.box(6 + Math.cos(a) * d, -192 + Math.sin(a) * d, R(0.3, 0.5), 0.1, R(8, 14), VEIN, { y: 0.34, collide: false, glow: 1.4 }).rotation.y = a;
      }
      // the rim: tall rocks, with gaps at the south and north
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        if (Math.abs(Math.cos(a)) < 0.3) continue; // south and north openings
        const x = 6 + Math.cos(a) * 36, z = -192 + Math.sin(a) * 30, s = R(5, 8);
        K.rock(x, z, s);
        K.mesh(g().cone5, BLIGHT2, x, s * 2.2, z, { scale: [s * 0.5, s * 2, s * 0.5], collide: false });
      }
      // large pulsing growths on the rim and hanging stalactites
      for (const [x, z, s] of [[-26, -176, 4], [34, -172, 4.4], [-22, -212, 4.8], [38, -208, 3.6], [8, -222, 4]]) blight(K, x, z, s, { light: true });
      for (let i = 0; i < 8; i++) K.mesh(g().cone5, BLIGHT2, R(-30, 42), R(14, 20), R(-218, -166), { rx: Math.PI, scale: [R(1, 2), R(5, 9), R(1, 2)], collide: false });
      for (const [x, z] of [[-6, -172], [20, -178], [-8, -210], [24, -206]]) blight(K, x, z, R(1.4, 2), { light: true });
      for (const [x, z] of [[-30, -190], [40, -192]]) crystal(K, x, z, 1.3, VEIN);
      for (const [x, z] of [[-18, -170], [28, -214], [-12, -216]]) banner(K, x, z, R(5, 6.5));
      K.scatter((x, z) => K.rock(x, z, R(1, 2)), 6, -192, 8, 19, 5, 2.6);
      for (const [x, z] of [[6, -192], [-14, -192], [26, -192], [6, -176], [6, -210]]) K.light(x, 8, z, VEIN, 8, 26);
      mist(K, 6, -192, 22, 0.5, 0.1);

      // ---- The Wishing Chamber: the Ahamkara's nest, a vast roofed hall ----
      K.room(0, -268, 88, 84, 20, { t: 2, color: DUSK, roofColor: LAV2, doors: { s: 10 }, roof: true });
      K.door(0, -226, 10, 20, 'x', { zone: 2, color: LAV2, trim: VEIN });
      pad(K, 0, -268, 24, BLIGHT);
      pad(K, 0, -268, 22.6, DUSK);
      K.mesh(new THREE.TorusGeometry(22, 0.3, 4, 56), VEIN, 0, 0.38, -268, { rx: Math.PI / 2, glow: 1.2 });
      K.mesh(new THREE.TorusGeometry(12, 0.25, 4, 40), GOLD, 0, 0.38, -268, { rx: Math.PI / 2, glow: 1 });
      pad(K, 0, -268, 4, VEIN, { glow: 0.8 });
      // pillar ring, with broken ones
      for (const [x, z] of [[-32, -246], [32, -246], [-36, -268], [36, -268], [-32, -290], [32, -290], [-16, -240], [16, -240]]) {
        K.box(x, z, 3.4, 20, 3.4, IVORY2);
        K.box(x, z, 4.6, 1.3, 4.6, GOLD, { y: 14, collide: false, glow: 0.4 });
        K.box(x, z, 4.2, 1.2, 4.2, LAV2, { collide: false });
      }
      for (let z = -232; z > -306; z -= 9) K.box(0, z, 86, 1.1, 1.1, LAV, { y: 18.6, collide: false });
      for (let x = -36; x <= 36; x += 18) K.box(x, -268, 1.1, 1.1, 82, LAV, { y: 18.6, collide: false });
      // the dais: a stepped nest, eggs and wish-light
      K.platform(0, -298, 36, 14, 1.6, { stairs: ['s'], color: DUSK, stairColor: LAV2, stairW: 12 });
      K.platform(0, -301, 20, 8, 1.6, { y: 1.6, stairs: ['s'], color: LAV2, stairColor: IVORY2, stairW: 8 });
      for (const [x, z, s] of [[-10, -296, 2.2], [9, -297, 2.6], [-4, -302, 2.0], [14, -300, 1.9], [-14, -301, 1.7]]) {
        K.mesh(g().ico, BLIGHT, x, 1.6 + s * 0.9, z, { scale: [s, s * 1.2, s], collide: 0.8, y: 0 });
        K.mesh(g().octa, VEIN, x, 1.6 + s * 1.0, z + s * 0.5, { scale: [s * 0.25, s * 0.7, s * 0.25], glow: 1.7 });
      }
      blight(K, 0, -303, 3.6, { light: true });
      // bones of the wish-dragon: huge ribs arching over the dais
      for (const dz of [-288, -296, -304]) for (const s of [-1, 1]) {
        K.mesh(g().cone5, BONE, s * 17, 9, dz, { scale: [1.0, 16, 1.0], rz: s * 0.5, collide: false });
        K.mesh(g().cone5, BONE, s * 11, 15, dz, { scale: [0.7, 9, 0.7], rz: -s * 0.9, collide: false });
      }
      K.mesh(g().ico, BONE, 0, 9.5, -308, { scale: [4.5, 5.6, 3.2], collide: false });
      for (const s of [-1, 1]) K.mesh(g().octa, VEIN, s * 1.6, 10.2, -305.2, { scale: [0.55, 0.9, 0.4], glow: 2 });
      // wells of orange wish-light with growths around them
      for (const [x, z] of [[-30, -258], [30, -258], [-30, -280], [30, -280]]) {
        K.cyl(x, z, 2.4, 1.1, IVORY2, { sides: 8 });
        K.mesh(g().cyl28, VEIN, x, 1.15, z, { scale: [1.9, 0.12, 1.9], glow: 1.5, collide: false });
        K.light(x, 3, z, VEIN, 8, 26);
      }
      for (const [x, z] of [[-40, -240], [40, -240], [-40, -296], [40, -296], [-24, -302], [24, -302]]) blight(K, x, z, R(2.6, 3.6), { light: true });
      for (const [x, z, w, d] of [[-18, -252, 5, 1.2], [18, -252, 5, 1.2], [-20, -284, 1.2, 5], [20, -284, 1.2, 5]]) stub(K, x, z, w, d, 1.5, LAV);
      for (const [x, z] of [[-43, -250], [43, -250], [-43, -286], [43, -286]]) banner(K, x, z, 14);
      for (const [x, z] of [[0, -240], [-24, -268], [24, -268], [0, -262], [-30, -240], [30, -240], [-40, -266], [40, -268]]) K.light(x, 12, z, x === 0 ? GOLD : VEIN, 9, 34);
      K.light(0, 7, -300, VEIN, 16, 46);
      // tall ice-blue windows high in the walls, storm-lit
      for (const z of [-244, -268, -292]) for (const s of [-1, 1]) K.box(s * 43.4, z, 0.3, 8, 5, ICE, { y: 9, collide: false, glow: 0.9 });

      K.edge((x, z, y) => farSpire(K, x, z, y), 26, 6, 40);
    },
  },
};
