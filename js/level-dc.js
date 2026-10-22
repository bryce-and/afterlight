// Hand-built Dreaming City mission maps (see makeKit in world.js), on the U16e terrain engine.
// dc1 The Divalian Mists: a low fog shore climbing in terraces. Ledge -> mist plain -> gully climb to the Rheasilvia mesa and the Blind Well wall -> gully down to the sloping Strand shoreline -> long climb to the Gate of the Mists.
// dc2 The Spine of Keres: a ridge climb. Foot of the ridge -> zig-zag Gardens of Esila terraces -> a ribbed viaduct over the abyss -> the crest hall of ribs -> Morgeth's Oracle temple.
// dc3 The Wishing Chamber: a descent. Harbinger's Seclude court on the heights -> stair viaduct to the Gardens of Esila -> a gorge into the Taken Blight Hollow -> up into the Ahamkara's nest.
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


// ---- U16e helpers (every y is measured from the ground under the point, so these work on slopes) ----

// a low wall run chopped into 5 m pieces so it follows a slope (each piece sits on the ground at its own centre)
function run(K, x0, z0, x1, z1, h, o = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 5)), alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0), t = o.t ?? 1;
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f, l = L / n + 0.05;
    K.box(x, z, alongX ? l : t, h, alongX ? t : l, o.color ?? IVORY2, { collide: o.collide ?? true });
  }
  if (o.cap) K.box((x0 + x1) / 2, (z0 + z1) / 2, alongX ? Math.abs(x1 - x0) : t + 0.3, 0.25, alongX ? t + 0.3 : Math.abs(z1 - z0), o.cap, { y: h, collide: false, glow: 0.5 });
}

// a door set in a lane with a pylon on either side. The lane is a gully, so the cliffs close the rest of the gap.
function gatehouse(K, x, z, w, h, o = {}) {
  const trim = o.trim ?? GOLD, gz = K.ground(x, z);
  K.door(x, z, w, h, 'x', { zone: o.zone, color: o.doorColor ?? LAV2, trim });
  for (const s of [-1, 1]) {
    const px = x + s * (w / 2 + 1.1), off = gz - K.ground(px, z);
    K.box(px, z, 2.6, h + 3.5, 2.6, o.pillar ?? IVORY, { abs: true, y: gz - 0.4 });
    K.box(px, z, 3.4, 0.5, 3.4, trim, { y: off + h + 1.8, collide: false, glow: 0.6 });
    K.mesh(g().octa, o.tip ?? ICE, px, off + h + 5, z, { scale: [0.7, 1.4, 0.7], glow: 1.3 });
    K.light(px, off + h + 1, z + 2.5, o.lamp ?? trim, 7, 24);
  }
  if (o.banners !== false) { banner(K, x - w / 2 - 3.2, z + 2, 6.5); banner(K, x + w / 2 + 3.2, z + 2, 6.5); }
}

// a ruined room corner: a wall with a return, a fallen block and a crumbled top, turned by ry
function ruin(K, x, z, ry = 0, s = 1, col = IVORY2) {
  const c = Math.cos(ry), sn = Math.sin(ry), at = (dx, dz) => [x + dx * c + dz * sn, z - dx * sn + dz * c];
  let p = at(0, 0);
  K.obox(p[0], p[1], 7 * s, 2.2 * s, 0.9, ry, col);
  p = at(-3.1 * s, 3.4 * s);
  K.obox(p[0], p[1], 0.9, 1.5 * s, 5.6 * s, ry, col);
  p = at(1.4 * s, 0);
  K.box(p[0], p[1], 3 * s, 0.5, 0.8, col, { y: 2.2 * s, collide: false }).rotation.y = ry;
  p = at(2.2 * s, 2.4 * s);
  K.obox(p[0], p[1], 1.6 * s, 0.9 * s, 1.1 * s, ry + 0.7, col);
}

// a curved run of cover (oriented blocks along an arc) from angle a0 to a1, facing out from (cx, cz)
function arcWall(K, cx, cz, r, a0, a1, n, h, o = {}) {
  const seg = r * Math.abs(a1 - a0) / n;
  for (let i = 0; i < n; i++) {
    if (o.skip && o.skip.includes(i)) continue;
    const a = a0 + (a1 - a0) * (i + 0.5) / n;
    K.obox(cx + Math.cos(a) * r, cz + Math.sin(a) * r, seg * 0.92, h * (o.vary ? 0.7 + 0.5 * ((i * 7) % 5) / 4 : 1), o.t ?? 1.2, Math.atan2(-Math.cos(a), -Math.sin(a)), o.color ?? IVORY2);
  }
}

// a tall gold-crowned obelisk (a landmark seen across the map)
function obelisk(K, x, z, h, r = 2.4, col = IVORY) {
  K.cyl(x, z, r * 1.5, 1.4, IVORY2, { sides: 4 });
  K.cyl(x, z, r, h, col, { r2: r * 0.45, sides: 4, y: 1.4 });
  K.mesh(g().cyl6, GOLD, x, h * 0.55, z, { scale: [r * 0.8, 0.5, r * 0.8], glow: 0.7 });
  K.mesh(g().octa, ICE, x, h + 3, z, { scale: [r * 0.5, r * 1.5, r * 0.5], glow: 1.4 });
  K.light(x, h + 3, z, ICE, 9, 36);
}

// a rib of the Spine: two pillars and a lintel that follows the lane (pillars stand on their own ground)
function rib(K, x, z, span, h, o = {}) {
  const col = o.color ?? IVORY, gz = K.ground(x, z);
  for (const s of [-1, 1]) K.box(x + s * span / 2, z, 1.4, h, 1.4, col, { collide: o.collide ?? true });
  K.box(x, z, span + 1.4, 0.9, 1.2, col, { abs: true, y: gz + h - 0.4, collide: false });
  if (o.glow !== false) for (const s of [-1, 1]) K.box(x + s * (span / 2 - 0.5), z, 0.14, h * 0.55, 0.3, ICE, { y: 1.0, collide: false, glow: 1.2 });
  if (o.light) K.light(x, h - 1.2, z, ICE, 7, 22);
}

// the facing of a terrace cliff running along x at z: its top stands 0.5 m above the upper terrace (hi); gaps are x ranges left open for lanes
function faceWall(K, x0, x1, z, hi, gaps = [], o = {}) {
  const t = o.t ?? 1.1;
  for (let x = x0; x < x1 - 0.1; x += 5) {
    const xc = Math.min(x + 2.5, x1 - 0.5);
    if (gaps.some(([a, b]) => xc + 2.5 > a && xc - 2.5 < b)) continue;
    K.box(xc, z, 5.02, hi + 0.5 - K.ground(xc, z), t, o.color ?? IVORY2);
    if (o.cap) K.box(xc, z, 5.02, 0.25, t + 0.4, o.cap, { abs: true, y: hi + 0.5, collide: false });
  }
}

// roofed tunnel running along z from za to zb on flat ground: side walls, roof, glowing ribs and lights
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
  // The Divalian Mists: a low fog shore that climbs, terrace by terrace, to Petra's gate.
  // ===========================================================================
  dc1: {
    spawn: [0, 18],
    bounds: [-72, 72, -292, 30],
    zones: [
      { name: 'Divalian Mists', x: 12, z: -50 },
      { name: 'Rheasilvia', x: -14, z: -130 },
      { name: 'The Strand', x: 6, z: -194 },
      { name: 'Gate of the Mists', x: 0, z: -242, boss: true, room: { minX: -29, maxX: 29, minZ: -268, maxZ: -216 } },
    ],
    // dusk over a pale sea: a low violet moon, drifting mist banks, fogged ridges and a green sheet of aurora
    sky: {
      zenith: 0x2a2250, mid: 0x6c5696, horizon: 0xd2aacb, fog: 0xa898c8,
      stars: { n: 150, color: 0xf2e8ff, size: 2, min: 0.35 },
      bodies: [{ color: 0xe6def4, size: 52, pos: [-330, 80, -500], glow: 0xb8a8e8 }],
      ridges: [{ r: 640, h: [30, 90], color: 0x54467a, haze: 0.55, steps: 60 }, { r: 560, h: [14, 40], color: 0x6a5a90, haze: 0.5, steps: 80 }],
      haze: [{ color: 0xe0d0ee, opacity: 0.6, r: 470, h: 130, y: -10 }, { color: 0xc8b8e0, opacity: 0.4, r: 520, h: 60, y: 30 }],
      aurora: [{ color: 0x5cffb8, y: 150, r: 560, h: 120, arc: [0.3, 2.3], opacity: 0.4, waves: 3 }],
      clouds: { n: 10, color: 0xe4d0ec, opacity: 0.55, y: [70, 130], size: 22 },
      floaters: [{ kind: 'island', n: 6, r: [380, 640], y: [40, 150], size: [24, 56], color: 0x6a5a90, top: 0xcfc7e0, haze: 0.45 }, { kind: 'spire', n: 7, r: [420, 640], y: [50, 170], size: [14, 28], color: 0xe4dcf0, glow: 0x9fe8ff, haze: 0.4 }],
    },
    // U16e: the shore ledge, a mist plain of dunes, the Rheasilvia mesa (9 m) cut by two gullies, the Strand's long slope up to the Gate plateau
    terrain: [
      { type: 'plateau', x: 0, z: 12, w: 190, d: 38, h: 2.4, edge: 3 },                                  // the landing ledge
      { type: 'ramp', x0: 0, z0: -6, x1: 0, z1: -28, width: 18, h0: 2.4, h1: 0, edge: 5 },              // down into the mist
      { type: 'mound', x: -44, z: -60, r: 22, h: 3.4 },                                                  // the hill of the broken ring
      { type: 'mound', x: 44, z: -34, r: 14, h: 1.6 },
      { type: 'mound', x: 40, z: -76, r: 16, h: 2.0 },
      { type: 'mound', x: -20, z: -34, r: 12, h: 1.1 },
      { type: 'plateau', x: 0, z: -128, w: 200, d: 64, h: 9, edge: 3 },                                  // Rheasilvia mesa
      { type: 'plateau', x: 58, z: -128, w: 30, d: 32, h: 14, edge: 3 },                                 // the overlook on the east
      { type: 'ramp', x0: 28, z0: -114, x1: 52, z1: -114, width: 9, h0: 9, h1: 14, edge: 2 },
      { type: 'ramp', x0: -30, z0: -84, x1: -30, z1: -97, width: 10, h0: 0, h1: 0, edge: 2 },            // flat run-in, so the mesa's foot skirt leaves no bump
      { type: 'ramp', x0: -30, z0: -96, x1: -30, z1: -136, width: 10, h0: 0, h1: 9, edge: 2 },          // gully up out of the mist
      { type: 'ramp', x0: 24, z0: -132, x1: 24, z1: -164, width: 10, h0: 9, h1: 0, edge: 2 },           // gully down to the shore
      { type: 'ramp', x0: 0, z0: -170, x1: 0, z1: -212, width: 190, h0: 0, h1: 6, edge: 6 },            // the Strand's slope
      { type: 'plateau', x: 0, z: -252, w: 200, d: 80, h: 6, edge: 3 },                                  // the high ground behind the Gate courtyard (no pit round it)
    ],
    build(K) {
      const { R } = K;

      // ---- the landing ledge: a parapet with ruined gaps, an arch over the way down ----
      for (const [x, w] of [[-52, 26], [-27, 11], [29, 12], [51, 24]]) stub(K, x, -4.6, w, 1.0, 1.3);
      arch(K, 0, -16, 16, 10, 'x', { light: GOLD });
      for (const [x, z] of [[-14, -2], [14, -4], [-40, 12], [38, 14]]) lamp(K, x, z, 3.6, ICE);
      for (const [x, z] of [[-24, 6], [24, -1], [-50, 16], [50, 18]]) banner(K, x, z, R(5.5, 7));
      crystal(K, -58, 20, 1.5); crystal(K, 60, 10, 1.3);
      mist(K, -30, 6, 16, 3.0, 0.22); mist(K, 32, 4, 14, 3.0, 0.2);

      // ---- Divalian Mists: a fog-swallowed plain of dunes, ruin rooms and broken arches ----
      for (const [x, z, r, y] of [[-30, -22, 15, 0.5], [26, -30, 16, 0.8], [-6, -62, 14, 0.6], [34, -62, 13, 0.9], [-52, -44, 12, 0.7], [0, -12, 12, 0.5], [-24, -78, 10, 0.8], [10, -46, 13, 0.7]]) {
        mist(K, x, z, r, y, 0.34); mist(K, x + 3, z - 2, r * 0.7, y + 0.55, 0.22);
      }
      // the great broken ring, standing on its hill and half lost in the fog
      K.mesh(new THREE.TorusGeometry(11, 1.3, 5, 14, 4.2), IVORY, -44, 10, -60, { ry: 0.3 });
      K.box(-52, -58, 4, 3, 3, IVORY2); K.box(-38, -64, 4, 2, 3, IVORY2);
      K.light(-44, 10, -56, GOLD, 8, 30);
      // ruin rooms scatter the plain into lanes
      ruin(K, -14, -46, 0.4, 1.1); ruin(K, 36, -58, -0.6, 1.0); ruin(K, -18, -72, 2.2, 1.2); ruin(K, 24, -26, 1.2, 0.8);
      arch(K, -30, -88, 12, 9, 'x', { light: ICE });
      arch(K, 14, -74, 10, 10, 'x', { broken: true });
      arch(K, -4, -30, 9, 9, 'x', { light: GOLD });
      arch(K, 32, -46, 8, 8, 'z', { broken: true });
      fallen(K, 0, -58, 6, 0.3); fallen(K, 28, -40, 5, -0.5);
      for (const [x, z] of [[-50, -22], [46, -44], [44, -88]]) blight(K, x, z, R(2.4, 3.2), { light: true });
      for (const [x, z] of [[-10, -14], [14, -36], [-8, -64], [30, -10]]) banner(K, x, z, R(5.5, 7));
      for (const [x, z] of [[-6, 8], [8, -24], [-22, -54], [22, -52]]) lamp(K, x, z, 3.6, ICE);
      K.scatter((x, z) => K.rock(x, z, R(1, 2)), 12, -50, 8, 19, 5, 2.4);
      crystal(K, -60, -26, 1.6); crystal(K, 58, -22, 1.4); crystal(K, 56, -60, 1.2);
      for (const [x, z] of [[-62, 6], [60, 2], [-66, -30], [64, -58], [-62, -88], [58, -90]]) spire(K, x, z, R(16, 26), 2.2);

      // ---- the gully mouth: the first gate, at the foot of the mesa ----
      gatehouse(K, -30, -98, 10, 8, { zone: 0 });
      for (let z = -102; z > -134; z -= 6) K.box(-30, z, 8.4, 0.1, 0.5, GOLD, { y: 0.22, collide: false, glow: 0.4 });
      for (const z of [-104, -120]) for (const s of [-1, 1]) lamp(K, -30 + s * 5.6, z, 3.2, ICE);

      // ---- Rheasilvia: the mesa. The way in climbs a gully; the Blind Well wall closes the west ----
      // west: sheer wall with the Blind Well door, a sealed gold-ringed slab
      K.wall(-64, -98, -64, -160, 14, { t: 3, color: LAV2, gaps: [[26, 38]] });
      K.door(-64, -128, 12, 14, 'z', { zone: null, id: 'blindwell', color: IVORY2, trim: GOLD });
      for (const z of [-135.8, -120.2]) { K.box(-64, z, 3.2, 17, 2.6, IVORY); K.mesh(g().octa, GOLD, -64, 18, z, { scale: [0.7, 1.4, 0.7], glow: 1.4 }); }
      K.mesh(new THREE.TorusGeometry(4.4, 0.3, 5, 28), GOLD, -62.2, 7, -128, { ry: Math.PI / 2, glow: 1.2 });
      K.mesh(new THREE.TorusGeometry(2.4, 0.25, 5, 20), GOLD, -62.2, 7, -128, { ry: Math.PI / 2, glow: 1.2 });
      K.platform(-58, -128, 5, 18, 0.8, { stairs: ['e'], color: IVORY2, stairColor: LAV, stairW: 6 });
      K.light(-60, 6, -128, GOLD, 10, 30);
      for (let z = -102; z > -158; z -= 12) { if (Math.abs(z + 128) < 12) continue; K.mesh(g().rock, K.C.rock2, -64, 14.5, z, { scale: [3, 3, 5], collide: false }); }
      // broken cover facing the door, in two arcs
      arcWall(K, -44, -128, 15, 2.5, 3.9, 4, 1.7, { vary: true, skip: [2] });
      arcWall(K, -36, -128, 25, -0.75, 0.75, 5, 1.5, { vary: true, skip: [1, 3] });
      ruin(K, 2, -112, 0.2, 1.1, LAV); ruin(K, 6, -148, 2.9, 1.0, LAV);
      for (const [x, z] of [[-6, -102], [18, -142]]) K.rock(x, z, R(2, 3));
      for (const [x, z] of [[-12, -150], [12, -126], [-44, -104]]) blight(K, x, z, R(2, 3), { light: true });
      for (const [x, z] of [[-22, -108], [0, -138], [30, -150]]) lamp(K, x, z, 4, GOLD);
      for (const [x, z] of [[-50, -150], [10, -102], [38, -104]]) banner(K, x, z, R(5.5, 7));
      K.scatter((x, z) => K.rock(x, z, R(1, 2)), -14, -130, 8, 19, 4, 2.6);
      crystal(K, -54, -106, 1.5); crystal(K, -54, -152, 1.3);
      mist(K, -20, -112, 14, 0.7, 0.26); mist(K, 14, -146, 12, 0.7, 0.24);
      // the north lip: a parapet, open where the second gully drops away
      K.wall(-72, -158.4, 12, -158.4, 2.4, { t: 1.2, color: IVORY2 });
      K.wall(36, -158.4, 72, -158.4, 2.4, { t: 1.2, color: IVORY2 });
      K.box(-30, -158.4, 84, 0.3, 1.5, GOLD, { y: 2.4, collide: false, glow: 0.5 });
      // the overlook on the east: a shrine of four columns, a spire and a watch deck
      for (const [x, z] of [[52, -136], [64, -136], [52, -120], [64, -120]]) K.box(x, z, 1.1, 5, 1.1, IVORY);
      spire(K, 58, -128, 11, 1.2, { color: IVORY2 });
      K.platform(70, -128, 4, 10, 1.6, { stairs: ['w'], stairW: 4, color: LAV, stairColor: IVORY2 });
      K.light(58, 7, -128, GOLD, 9, 30);
      for (const z of [-114]) for (const s of [-1, 1]) lamp(K, 40 + s * 2, z + 5.2, 3.2, GOLD);
      spire(K, 66, -156, 22, 2.4); spire(K, 4, -158, 18, 2.0);

      // ---- the second gully: down to the shore, with its gate ----
      gatehouse(K, 24, -150, 10, 7.5, { zone: 1, color: LAV });
      for (let z = -138; z > -148; z -= 5) K.box(24, z, 8.4, 0.1, 0.5, GOLD, { y: 0.22, collide: false, glow: 0.4 });

      // ---- The Strand: the long shoreline slope. Tide pools, a toppled giant, a sea wall and a lighthouse ----
      for (const [x, z, r] of [[-34, -166, 7], [10, -168, 9], [48, -167, 6]]) ghost(K.mesh(g().cyl28, ICE, x, 0.12, z, { scale: [r, 0.08, r * 0.7], glow: 0.35, collide: false }), 0.5);
      // the toppled giant lies across the slope: torso, head, a snapped arm and its broken plinth
      K.obox(-8, -190, 16, 3.4, 4.6, 0.35, IVORY2);
      K.mesh(g().ico, IVORY, 1.5, 2.2, -192.5, { scale: [3, 3.2, 3], collide: 0.7 });
      K.obox(-19, -186, 7, 1.6, 1.8, 1.0, IVORY2);
      K.box(-30, -192, 6, 2.2, 6, IVORY2); K.cyl(-30, -192, 1.1, 7, IVORY, { y: 2.2, sides: 6, r2: 0.9 });
      // the broken sea wall, in three runs
      K.obox(22, -178, 14, 1.5, 1.4, -0.45, IVORY2); K.obox(38, -187, 12, 1.5, 1.4, -0.7, IVORY2); K.obox(51, -199, 10, 1.5, 1.4, -1.05, IVORY2);
      for (const [x, z] of [[22, -178], [38, -187], [51, -199]]) K.box(x, z, 4, 0.4, 1.6, GOLD, { y: 1.5, collide: false, glow: 0.4 });
      // the lighthouse on the north east spur
      K.platform(52, -214, 12, 12, 3.2, { stairs: ['w'], stairW: 5, color: LAV, stairColor: IVORY2 });
      K.box(52, -214, 5, 26, 5, IVORY, { y: 3.2 });
      K.box(52, -214, 6.4, 1, 6.4, GOLD, { y: 20, collide: false, glow: 0.6 });
      K.mesh(g().octa, ICE, 52, 33, -214, { scale: [2, 4, 2], glow: 1.5 });
      K.light(52, 32, -214, ICE, 14, 60);
      // broken arches line the causeway toward it, stub rooms cover the slope
      arch(K, 28, -200, 8, 7, 'z', { broken: true }); arch(K, 40, -208, 8, 8, 'z', { light: ICE });
      ruin(K, -26, -176, 0.9, 1.1); ruin(K, 14, -206, 3.3, 1.0); ruin(K, -40, -204, 1.7, 1.2); ruin(K, 30, -166, 0.2, 0.8);
      fallen(K, 44, -178, 8, 0.2); fallen(K, -12, -206, 6, -0.4);
      for (const [x, z, h] of [[-62, -198, 30], [-60, -176, 22], [64, -176, 34]]) { K.box(x, z, 7, h, 7, IVORY); K.box(x, z, 5, 4, 5, GOLD, { y: h, collide: false, glow: 0.5 }); K.mesh(g().octa, ICE, x, h + 6, z, { scale: [1.4, 3, 1.4], glow: 1.2 }); }
      for (const [x, z] of [[-26, -202], [48, -172], [4, -178]]) blight(K, x, z, R(2.6, 3.4), { light: true });
      for (const [x, z] of [[-14, -176], [34, -194], [-48, -190], [18, -186]]) banner(K, x, z, R(6, 8));
      for (const [x, z] of [[-4, -184], [-34, -184], [26, -204], [8, -196]]) lamp(K, x, z, 4.2, ICE);
      mist(K, -30, -172, 18, 0.5, 0.22); mist(K, 40, -180, 14, 0.5, 0.2);
      K.scatter((x, z) => K.rock(x, z, R(1, 1.8)), 6, -194, 11, 19, 3, 2.4);
      crystal(K, 62, -196, 1.6); crystal(K, -56, -214, 1.5);

      // ---- Gate of the Mists: a walled courtyard on the high plateau, a raised dais before the sealed gate ----
      K.room(0, -242, 58, 52, 11, { t: 1.6, color: IVORY2, doors: { s: 8 } });
      K.door(0, -216, 8, 11, 'x', { zone: 2, color: LAV2, trim: GOLD });
      // the courtyard's wings run out to the map edge, so nothing can walk round the back
      K.wall(-72, -216, -29.8, -216, 11, { t: 1.6, color: IVORY2 }); K.wall(29.8, -216, 72, -216, 11, { t: 1.6, color: IVORY2 });
      K.box(-51, -216, 42, 0.5, 2.2, GOLD, { y: 11, collide: false, glow: 0.5 }); K.box(51, -216, 42, 0.5, 2.2, GOLD, { y: 11, collide: false, glow: 0.5 });
      // a broken half-ring of gold on the floor, an aisle of pale paving down to the dais
      K.mesh(new THREE.TorusGeometry(14, 0.22, 4, 30, 3.8), GOLD, 0, 0.38, -250, { rx: Math.PI / 2, glow: 1 });
      K.box(0, -236, 6, 0.1, 40, LAV2, { y: 0.12, collide: false });
      pad(K, 0, -226, 3.2, GOLD, { glow: 0.5 });
      K.platform(0, -259, 24, 10, 1.3, { stairs: ['s'], color: LAV2, stairColor: IVORY2, stairW: 8 });
      K.box(0, -259, 22.8, 0.1, 9, GOLD, { y: 1.3, collide: false, glow: 0.3 });
      for (const [x, z, h] of [[-21, -230, 13], [21, -230, 10], [-21, -254, 8], [22, -255, 13]]) {
        K.box(x, z, 3.2, h, 3.2, IVORY);
        K.box(x, z, 4.2, 0.9, 4.2, GOLD, { y: h, collide: false, glow: 0.5 });
        K.mesh(g().octa, ICE, x, h + 2, z, { scale: [0.8, 1.6, 0.8], glow: 1.3 });
      }
      // the sealed gate in the north wall
      for (const s of [-1, 1]) { K.box(s * 8, -266.6, 2.6, 15, 2.6, IVORY); K.mesh(g().octa, GOLD, s * 8, 16.5, -266.6, { scale: [0.8, 1.6, 0.8], glow: 1.4 }); }
      K.box(0, -266.6, 20, 2.0, 2.4, IVORY, { y: 11, collide: false });
      ghost(K.box(0, -266.7, 13.4, 11, 0.3, VIOLET, { collide: false, glow: 1.1 }), 0.7);
      K.mesh(new THREE.TorusGeometry(4.6, 0.3, 5, 28), GOLD, 0, 6.5, -266.4, { glow: 1.2 });
      // wave-arena cover: two broken arcs facing the gate and scattered ruin blocks
      arcWall(K, 0, -262, 17, -2.9, -0.25, 5, 1.8, { vary: true, skip: [2] });
      arcWall(K, 0, -270, 28, -2.7, -0.45, 4, 1.4, { vary: true });
      for (const [x, z, w, d, h] of [[-13, -229, 4, 1.2, 1.5], [10, -236, 1.2, 4, 1.2], [-6, -244, 3, 1.2, 2.2], [15, -224, 4, 1.2, 1.6], [-19, -243, 1.2, 4, 1.4]]) stub(K, x, z, w, d, h);
      K.cyl(7, -241, 1.2, 5.5, IVORY2, { sides: 6, r2: 0.9 }); K.cyl(-12, -238, 1.1, 3.4, IVORY2, { sides: 6, r2: 0.8 });
      for (const [x, z, c] of [[-26, -224, VIOLET], [26, -229, VIOLET], [-26, -244, GOLD], [26, -246, GOLD], [-10, -265, VIOLET]]) brazier(K, x, z, c, 1.1);
      for (const [x, z] of [[-26.6, -236], [26.6, -238], [-26.6, -252]]) banner(K, x, z, 8.5);
      for (const [x, z] of [[-24, -264], [25, -220], [-25, -219], [24, -264]]) blight(K, x, z, R(2, 2.8), { light: true });
      mist(K, -18, -236, 9, 0.5, 0.25); mist(K, 18, -250, 9, 0.5, 0.25);
      K.light(0, 9, -242, VIOLET, 12, 40);

      K.edge((x, z, y) => farSpire(K, x, z, y), 26, 6, 40);
    },
  },

  // ===========================================================================
  // The Spine of Keres: the Queen's road to the Oracle, a climb up a ridge to Morgeth's temple.
  // ===========================================================================
  dc2: {
    spawn: [0, 18],
    bounds: [-72, 72, -346, 30],
    zones: [
      { name: 'The Strand', x: 6, z: -48 },
      { name: 'Gardens of Esila', x: -6, z: -134 },
      { name: 'Spine of Keres', x: 0, z: -234 },
      { name: 'Oracle Temple', x: 0, z: -310, boss: true, room: { minX: -31, maxX: 31, minZ: -342, maxZ: -278 } },
    ],
    // a clear noon on the heights: bright blue, tall white cloud, drifting Awoken islands and spires, a faint green ribbon over the Reef
    sky: {
      stars: null,
      zenith: 0x2a74c0, mid: 0x86c8e8, horizon: 0xeaf4f4,
      bodies: [{ color: 0xfff6d8, size: 18, pos: [-300, 170, -540], glow: 0xffe9a8 }],
      ridges: [{ r: 640, h: [60, 140], color: 0x8aa0c0, haze: 0.5, steps: 64 }, { r: 560, h: [24, 70], color: 0x7a98a8, haze: 0.4, steps: 80 }],
      skyline: [{ kind: 'spire', n: 14, r: [470, 640], h: [70, 170], w: [10, 20], color: 0xd8d4e8, haze: 0.45 }],
      clouds: { n: 16, color: 0xffffff, opacity: 0.8, y: [100, 210], size: 22 },
      aurora: [{ color: 0x7affd0, y: 230, r: 600, h: 120, arc: [0.5, 2.3], opacity: 0.22, waves: 3 }],
      floaters: [{ kind: 'island', n: 8, r: [360, 640], y: [50, 200], size: [26, 62], color: 0xa8b0c8, top: 0x7aa080, haze: 0.3 }, { kind: 'spire', n: 8, r: [380, 640], y: [70, 230], size: [16, 34], color: 0xf0ecf8, glow: 0x9fe8ff, haze: 0.3 }],
    },
    // U16e: a flat foot with a hill, three Gardens terraces cut by zig-zag ramps (5, 8.4, 11.8 m), a viaduct over the abyss to the crest hall and temple (15 m)
    terrain: [
      { type: 'mound', x: 52, z: -40, r: 24, h: 4.2 },                                                     // the grassy hill with the shrine
      { type: 'mound', x: -52, z: -26, r: 16, h: 2.4 },
      { type: 'mound', x: -40, z: -70, r: 13, h: 1.8 },
      { type: 'plateau', x: 0, z: -100, w: 200, d: 28, h: 5, edge: 1.6 },                                    // terrace 1
      { type: 'plateau', x: 0, z: -132, w: 200, d: 36, h: 8.4, edge: 1.6 },                                  // terrace 2
      { type: 'plateau', x: 0, z: -190, w: 200, d: 24, h: 7, edge: 2 },                                      // the lower shelf under the viaduct (a fall lands here, not in a pit)
      { type: 'plateau', x: 0, z: -164, w: 200, d: 28, h: 11.8, edge: 1.6 },                                 // terrace 3
      { type: 'ramp', x0: 30, z0: -72, x1: 30, z1: -87, width: 10, h0: 0, h1: 0, edge: 2 },                // flat run-in to the gully
      { type: 'ramp', x0: 30, z0: -86, x1: 30, z1: -106, width: 10, h0: 0, h1: 5, edge: 2 },               // gully up to terrace 1
      { type: 'ramp', x0: -46, z0: -100, x1: -46, z1: -115, width: 9, h0: 5, h1: 5, edge: 2 },
      { type: 'ramp', x0: -46, z0: -114, x1: -46, z1: -136, width: 9, h0: 5, h1: 8.4, edge: 2 },           // west ramp up to terrace 2
      { type: 'ramp', x0: 44, z0: -132, x1: 44, z1: -151, width: 9, h0: 8.4, h1: 8.4, edge: 2 },
      { type: 'ramp', x0: 44, z0: -150, x1: 44, z1: -172, width: 9, h0: 8.4, h1: 11.8, edge: 2 },          // east ramp up to terrace 3
      { type: 'ramp', x0: -60, z0: -200, x1: -60, z1: -178, width: 9, h0: 7, h1: 11.8, edge: 2 },           // goat paths from the shelf back up to terrace 3
      { type: 'ramp', x0: 60, z0: -200, x1: 60, z1: -178, width: 9, h0: 7, h1: 11.8, edge: 2 },
      { type: 'ramp', x0: 0, z0: -172, x1: 0, z1: -206, width: 14, h0: 11.8, h1: 15, edge: 6 },            // the viaduct over the shelf
      { type: 'plateau', x: 0, z: -282, w: 200, d: 160, h: 15, edge: 3 },                                   // the crest: hall, tunnel and temple (full width, so no edge to fall off inside the map)
    ],
    build(K) {
      const { R, C } = K;

      // ---- The Strand: the foot of the ridge. An obelisk, a hill shrine, ruin rooms, crystals leaning up the Spine ----
      obelisk(K, -16, -58, 26, 2.6);
      for (const [x, z] of [[46, -50], [58, -50], [46, -30], [58, -30]]) K.box(x, z, 1.1, 5, 1.1, IVORY, { y: 0 });
      spire(K, 52, -40, 9, 1.0, { color: IVORY2 });
      K.light(52, 10, -40, GOLD, 8, 26);
      for (const [x, z, s] of [[40, -70, 1.4], [66, -66, 1.6], [38, -12, 1.2], [-58, -50, 1.3], [-6, -76, 1.1]]) crystal(K, x, z, s);
      for (const [x, z, ry, s] of [[-12, -38, 0.5, 1.1], [24, -64, -0.7, 1.0], [-34, -66, 2.0, 1.1], [22, -24, 1.3, 0.9]]) ruin(K, x, z, ry, s);
      arch(K, -20, -26, 10, 9, 'x', { light: ICE });
      arch(K, 10, -78, 9, 8, 'x', { broken: true });
      arch(K, -48, -52, 8, 8, 'z', { broken: true });
      fallen(K, -4, -62, 7, 0.4); fallen(K, 30, -30, 5, 1.1);
      for (const [x, z] of [[-60, -14], [-62, -86], [38, -22]]) K.mesh(g().rock, C.rock2, x, 2.2, z, { scale: [R(4, 6), R(3, 4.5), R(4, 6)], collide: 0.75 });
      for (const [x, z] of [[-40, -30], [14, -10]]) blight(K, x, z, R(2, 2.8), { light: true });
      for (const [x, z] of [[-8, -8], [24, -44], [-30, -44]]) banner(K, x, z, R(5.5, 7));
      for (const [x, z] of [[-4, 8], [14, -16], [-8, -44]]) lamp(K, x, z, 3.6, GOLD);
      K.scatter((x, z) => K.rock(x, z, R(1, 2)), 6, -48, 8, 19, 5, 2.4);
      flowers(K, -20, -20, 14, 14);
      for (const [x, z] of [[-62, 8], [64, 12], [64, -76]]) spire(K, x, z, R(18, 26), 2.2);
      // the ridge face rises across the map: crystals and rock teeth, and the gully gate
      faceWall(K, -72, 72, -85.2, 5, [[24, 36]], { color: DUSK, cap: LAV2 });
      for (const x of [-60, -38, -14, 8, 50, 62]) crystal(K, x, -83, R(1.1, 1.7));
      gatehouse(K, 30, -89, 10, 8, { zone: 0, trim: ICE, color: IVORY2 });
      for (let z = -92; z > -104; z -= 5) K.box(30, z, 8.4, 0.1, 0.5, ICE, { y: 0.22, collide: false, glow: 0.5 });

      // ---- Gardens of Esila: three terraces, zig-zagged by ramps. Lower lawn, a fountain plaza, an ivy pavilion on the crown ----
      // the terrace faces, with the lanes left open
      faceWall(K, -72, 72, -113.2, 8.4, [[-51, -41]], { color: IVORY2, cap: MOSS2 });
      faceWall(K, -72, 72, -149.2, 11.8, [[39, 49]], { color: IVORY, cap: MOSS2 });
      // terrace 1: curved lawn lanes, hedges and a trellis walk toward the west ramp
      hedge(K, 6, -96, 22, 1.1); hedge(K, -20, -104, 22, 1.1); hedge(K, -44, -94, 14, 1.1); hedge(K, 56, -104, 1.1, 14);
      for (const [x, z] of [[-30, -98], [-10, -92]]) { arch(K, x, z, 6, 5, 'x', { color: IVORY }); K.box(x, z, 7, 0.8, 1.1, MOSS2, { y: 4.7, collide: false }); }
      flowers(K, 8, -104, 12, 12); flowers(K, -34, -106, 8, 8);
      for (const [x, z] of [[18, -92], [-4, -108], [-40, -108]]) lamp(K, x, z, 3.6, PINK);
      blight(K, 62, -96, 2.4, { light: true });
      // terrace 2: the fountain plaza, four paved lanes and corner planters
      pad(K, -6, -132, 12, IVORY2); pad(K, -6, -132, 10.8, LAV2);
      K.box(-6, -132, 3.0, 0.12, 34, IVORY2, { y: 0.12, collide: false }); K.box(-6, -132, 64, 0.12, 3.0, IVORY2, { y: 0.12, collide: false });
      K.cyl(-6, -132, 3.4, 1.0, IVORY2, { sides: 10 });
      K.mesh(g().cyl28, ICE, -6, 1.0, -132, { scale: [2.9, 0.15, 2.9], glow: 0.5, collide: false });
      crystal(K, -6, -132, 1.0);
      for (const [x, z] of [[-20, -120], [8, -120], [-20, -144], [8, -144]]) { K.box(x, z, 5, 0.9, 2.2, IVORY2); K.box(x, z, 4.6, 0.4, 1.8, MOSS2, { y: 0.9, collide: false }); }
      hedge(K, -40, -126, 1.1, 10); hedge(K, 28, -140, 1.1, 10); hedge(K, 34, -122, 12, 1.1);
      for (const [x, z] of [[-2, -116], [-18, -140], [20, -132]]) banner(K, x, z, R(5.5, 7));
      for (const [x, z] of [[-6, -120], [-6, -144], [-20, -132], [8, -132]]) lamp(K, x, z, 3.8, PINK);
      for (const [x, z] of [[40, -122], [-50, -146]]) blight(K, x, z, R(2.2, 3), { light: true });
      flowers(K, -6, -132, 22, 26);
      K.scatter((x, z) => K.rock(x, z, R(1, 1.8)), -6, -132, 12, 19, 3, 2.4);
      // terrace 3: the crown. An ivy pavilion with a deck above the lawn, ivy-wrapped spires
      K.platform(-36, -164, 12, 10, 3.2, { stairs: ['e'], stairW: 4, color: IVORY2, stairColor: LAV });
      for (const [x, z] of [[-40, -168], [-32, -168], [-40, -160], [-32, -160]]) K.box(x, z, 1.1, 4.2, 1.1, IVORY, { y: 3.2 });
      K.box(-36, -164, 11, 0.6, 9, MOSS, { y: 7.4, collide: false });
      K.mesh(g().cone5, MOSS2, -36, 9.2, -164, { scale: [6, 2.6, 5], ry: 0.8, collide: false });
      for (const [x, z] of [[-62, -156], [60, -168], [-58, -172]]) { spire(K, x, z, R(14, 20), 2.0); K.mesh(g().cone5, MOSS, x, 4, z, { scale: [3, 8, 3], collide: false }); }
      for (const [x, z] of [[30, -160], [-10, -158]]) blight(K, x, z, R(2, 2.6), { light: true });
      for (const [x, z] of [[8, -158], [24, -172]]) lamp(K, x, z, 3.8, PINK);
      flowers(K, 10, -164, 14, 14);
      hedge(K, 16, -172, 14, 1.1);
      // the lower shelf: ruined garden terraces seen from the viaduct, with goat paths up at both ends
      for (const [x, z, s] of [[-30, -190, 1.5], [34, -186, 1.7], [-8, -198, 1.1], [14, -182, 1.2]]) crystal(K, x, z, s);
      for (const [x, z] of [[-40, -196], [24, -196], [-20, -184]]) blight(K, x, z, R(2, 2.8), { light: true });
      ruin(K, -34, -190, 0.3, 1.0); ruin(K, 40, -192, 2.6, 1.1);
      mist(K, 0, -190, 22, 7.6, 0.2); mist(K, -40, -192, 14, 7.6, 0.18); mist(K, 44, -190, 14, 7.6, 0.18);
      for (const x of [-60, 60]) for (let z = -196; z < -180; z += 5) K.box(x, z, 7.4, 0.1, 0.5, ICE, { y: 0.22, collide: false, glow: 0.45 });
      // the viaduct: a spine of ribs over the drop, rails and crystals on the rails
      run(K, -7, -178, -7, -205, 1.3, { t: 0.8, color: IVORY, cap: GOLD });
      run(K, 7, -178, 7, -205, 1.3, { t: 0.8, color: IVORY, cap: GOLD });
      for (let z = -184; z > -204; z -= 6) rib(K, 0, z, 12.6, 7 + (z % 12 ? 0 : 1), { light: z % 12 === 0 });
      crystal(K, -8.6, -192, 1.2); crystal(K, 8.6, -198, 1.2); crystal(K, -8.6, -202, 1.0);
      K.light(0, 6, -180, ICE, 8, 28); K.light(0, 6, -198, ICE, 8, 28);

      // ---- Spine of Keres: the crest hall of ribs, with balconies along both flanks ----
      const zh = -234;
      // the crest's front: a wall out to either edge, so the only way on is the door
      K.wall(-72, -203.2, -8.6, -203.2, 6, { t: 1.2, color: IVORY2 }); K.wall(8.6, -203.2, 72, -203.2, 6, { t: 1.2, color: IVORY2 });
      K.box(-40, -203.2, 63, 0.3, 1.6, GOLD, { y: 6, collide: false, glow: 0.5 }); K.box(40, -203.2, 63, 0.3, 1.6, GOLD, { y: 6, collide: false, glow: 0.5 });
      K.room(0, zh, 52, 56, 12, { t: 1.4, color: LAV2, roofColor: LAV, doors: { s: 8, n: 8 }, roof: true });
      K.door(0, zh + 28, 8, 12, 'x', { zone: 1, color: IVORY2, trim: ICE });
      for (let z = zh + 24; z > zh - 26; z -= 7) {
        K.box(0, z, 50, 0.9, 1.0, IVORY, { y: 10.6, collide: false });
        for (const s of [-1, 1]) { K.box(s * 24.6, z, 1.2, 10.6, 1.0, IVORY, { collide: false }); K.box(s * 24.0, z, 0.2, 6, 0.5, ICE, { y: 2.4, collide: false, glow: 1.2 }); }
      }
      for (const s of [-1, 1]) {
        K.platform(s * 20, zh, 8, 30, 2.4, { stairs: [s < 0 ? 'e' : 'w'], color: LAV, stairColor: IVORY2, stairW: 5 });
        K.box(s * 20, zh, 7.4, 0.4, 29.4, ICE, { y: 2.4, collide: false, glow: 0.35 });
      }
      for (const [x, z, c] of [[-22, zh + 11, 1.4], [-21, zh - 3, 1.1], [-23, zh - 14, 1.5], [22, zh + 5, 1.2], [21, zh - 9, 1.5], [23, zh + 14, 1.0]]) crystal(K, x, z, c);
      for (const [x, z, h] of [[-10, zh + 17, 12], [10, zh + 16, 9], [-11, zh - 19, 12], [9, zh - 20, 12]]) { K.box(x, z, 2.4, h, 2.4, IVORY); K.box(x, z, 3.2, 0.7, 3.2, GOLD, { y: h - 1, collide: false, glow: 0.6 }); }
      // cover for a big room: toppled ribs and fallen stone across the nave
      K.obox(-4, zh + 4, 11, 1.8, 1.5, 0.5, IVORY2); K.obox(7, zh - 6, 9, 1.4, 1.4, -0.4, IVORY2); K.obox(-6, zh - 13, 7, 2.2, 1.4, 1.2, IVORY2);
      for (const [x, z] of [[-7, zh - 2], [8, zh + 8], [-3, zh + 12], [5, zh - 16]]) K.rock(x, z, R(1, 1.5));
      pad(K, 0, zh, 6, ICE, { glow: 0.45 });
      K.box(0, zh, 1.0, 0.1, 50, ICE, { y: 0.34, collide: false, glow: 1.2 });
      for (const [x, z] of [[-24, zh + 24], [24, zh + 24], [-24, zh - 24]]) crystal(K, x, z, 1.6);
      for (const [x, z] of [[0, zh + 22], [-14, zh], [14, zh], [0, zh - 22], [-14, zh + 12], [14, zh - 12]]) K.light(x, 9, z, ICE, 7, 24);
      blight(K, 15, zh - 20, 2.4, { light: true }); blight(K, -16, zh + 18, 2.2, { light: true });
      tunnel(K, 0, zh - 28, zh - 44, { color: LAV2, glow: ICE });

      // ---- Oracle Temple: Morgeth's roofed hall, a broken colonnade, the stepped Oracle dais ----
      const zt = -310;
      K.room(0, zt, 62, 64, 14, { t: 1.6, color: IVORY2, roofColor: IVORY, doors: { s: 8 }, roof: true });
      K.door(0, zt + 32, 8, 14, 'x', { zone: 2, color: LAV2, trim: GOLD });
      K.box(0, zt - 2, 8, 0.1, 52, LAV, { y: 0.12, collide: false });                       // a plain carpet aisle to the dais
      K.box(0, zt - 2, 8.6, 0.1, 52.6, GOLD, { y: 0.08, collide: false, glow: 0.3 });
      for (const [dz, s, h] of [[-24, -1, 14], [-18, 1, 14], [-12, -1, 8], [-8, 1, 14], [-2, -1, 14], [6, 1, 9], [8, -1, 14], [16, 1, 14], [22, -1, 14], [-30, 1, 14]]) {
        const x = s * 22 + (dz % 4 ? 0 : -s * 1.5), z = zt + dz;
        K.box(x, z, 2.2, h, 2.2, IVORY);
        if (h > 12) K.box(x, z, 3.2, 0.9, 3.2, GOLD, { y: 12.6, collide: false, glow: 0.5 }); else K.box(x + 0.4, z, 3.0, 0.8, 3.0, IVORY2, { y: h, collide: false }).rotation.y = 0.5;
      }
      for (let z = zt + 26; z > zt - 30; z -= 8) K.box(0, z, 60, 0.9, 0.9, IVORY, { y: 13, collide: false });
      for (const dz of [14, -4, -20]) for (const s of [-1, 1]) K.box(s * 30.5, zt + dz, 0.3, 7, 3, ICE, { y: 4, collide: false, glow: 1.2 });
      // the Oracle: a gold ring and a bright core, on a stepped dais at the north
      K.platform(0, zt - 24, 26, 10, 1.2, { stairs: ['s'], color: IVORY2, stairColor: LAV, stairW: 9 });
      K.platform(0, zt - 26, 12, 5, 1.2, { y: 1.2, stairs: ['s'], color: IVORY, stairColor: IVORY2, stairW: 5 });
      K.mesh(new THREE.TorusGeometry(6, 0.55, 6, 32), GOLD, 0, 9, zt - 28.4, { glow: 1.0 });
      K.mesh(new THREE.TorusGeometry(3.6, 0.4, 6, 28), GOLD, 0, 9, zt - 28.2, { glow: 1.0 });
      K.mesh(g().ico, 0xfff0c0, 0, 9, zt - 28.2, { scale: 1.8, glow: 1.6, collide: false });
      K.light(0, 9, zt - 24, GOLD, 14, 44);
      // wave-arena cover: broken pillar clusters and low walls on both sides of the aisle
      for (const [x, z, w, d, h] of [[-12, zt + 18, 4, 1.2, 1.6], [13, zt + 12, 1.2, 4, 1.8], [-14, zt - 6, 1.2, 5, 2.0], [11, zt - 10, 4, 1.2, 1.4], [-8, zt - 14, 3, 1.2, 1.2], [16, zt + 24, 1.2, 4, 1.4]]) stub(K, x, z, w, d, h);
      K.cyl(-10, zt + 4, 1.2, 5, IVORY2, { sides: 6, r2: 0.9 }); K.cyl(8, zt - 2, 1.1, 3.2, IVORY2, { sides: 6, r2: 0.8 });
      for (const [x, z, c] of [[-14, zt + 24, 0xff9a3c], [15, zt + 26, 0xff9a3c], [-12, zt - 20, 0xff9a3c], [10, zt - 20, 0xff9a3c]]) brazier(K, x, z, c, 1.2);
      for (const [x, z] of [[-28, zt + 26], [28, zt + 24], [-28, zt - 26], [28, zt - 26]]) crystal(K, x, z, 1.6);
      for (const [x, z] of [[-30.4, zt + 8], [30.4, zt - 4], [-30.4, zt - 10], [30.4, zt + 14]]) banner(K, x, z, 10);
      for (const [x, z] of [[-27, zt - 22], [27, zt - 20]]) blight(K, x, z, 2.6, { light: true });
      for (const [x, z] of [[-8, zt + 26], [8, zt + 26], [0, zt + 6]]) K.light(x, 11, z, ICE, 7, 26);

      K.edge((x, z, y) => farSpire(K, x, z, y), 26, 6, 40);
    },
  },

  // ===========================================================================
  // The Wishing Chamber: Riven's brood, deep in the Taken-infested north of the city. A descent into the dark.
  // ===========================================================================
  dc3: {
    spawn: [0, 18],
    bounds: [-80, 80, -324, 30],
    zones: [
      { name: "Harbinger's Seclude", x: 0, z: -44 },
      { name: 'Gardens of Esila', x: -8, z: -124 },
      { name: 'Blight Hollow', x: -1, z: -192 },
      { name: 'The Wishing Chamber', x: 0, z: -268, boss: true, room: { minX: -44, maxX: 44, minZ: -310, maxZ: -226 } },
    ],
    // a storm over the Reef: bruised violet, red-lit horizon, dark cloud, purple lightning ribbons, spires of the dead city
    sky: {
      zenith: 0x0e0a20, mid: 0x30224e, horizon: 0x7a4a78, floor: 0x1a1226,
      stars: { n: 40, color: 0xe8d8ff, size: 2, min: 0.6 },
      bodies: [{ color: 0xff9a68, size: 26, pos: [320, 46, -520], glow: 0xff6a30 }],
      ridges: [{ r: 640, h: [60, 150], color: 0x2a1e3c, haze: 0.45, steps: 60 }, { r: 560, h: [24, 70], color: 0x20162e, haze: 0.3, steps: 80 }],
      haze: [{ color: 0xa04a70, opacity: 0.5, r: 470, h: 90, y: -10 }],
      clouds: { n: 18, color: 0x3a2a54, opacity: 0.85, y: [60, 160], size: 28 },
      aurora: [{ color: 0xa05aff, y: 160, r: 540, h: 200, arc: [0, 6.283], opacity: 0.5, waves: 6 }, { color: 0xff5a30, y: 90, r: 520, h: 100, arc: [1, 2.5], opacity: 0.3, waves: 4 }],
      floaters: [{ kind: 'spire', n: 16, r: [340, 620], y: [50, 260], size: [18, 44], color: 0x8a7caa, glow: 0xb08cff, haze: 0.25 }, { kind: 'rock', n: 10, r: [360, 640], y: [30, 200], size: [10, 28], color: 0x3a2e50, haze: 0.3 }],
    },
    // U16e: a descent. The Seclude court on the heights (15 m), a stair viaduct down to the Gardens (7 m), a gorge cut through a ridge down to the Hollow floor (0), a ramp up into the nest (3 m)
    terrain: [
      { type: 'plateau', x: 0, z: -20, w: 200, d: 140, h: 15, edge: 3 },                                   // the Seclude court
      { type: 'plateau', x: 0, z: -120, w: 200, d: 60, h: 7, edge: 3 },                                    // the Gardens
      { type: 'ramp', x0: 0, z0: -84, x1: 0, z1: -116, width: 16, h0: 15, h1: 7, edge: 3 },               // the stair viaduct
      { type: 'plateau', x: 0, z: -158, w: 200, d: 16, h: 10, edge: 3 },                                   // the rock ridge before the Hollow
      { type: 'plateau', x: -53, z: -193.5, w: 54, d: 57, h: 9, edge: 2 },                                 // gorge wall, west
      { type: 'plateau', x: 52, z: -193.5, w: 56, d: 57, h: 10, edge: 2 },                                 // gorge wall, east
      { type: 'plateau', x: 36, z: -198, w: 20, d: 16, h: 4, edge: 2 },                                    // the sniper shelf in the east wall
      { type: 'ramp', x0: 14, z0: -198, x1: 30, z1: -198, width: 7, h0: 0, h1: 4, edge: 2 },              // up to the shelf
      { type: 'ramp', x0: -6, z0: -144, x1: -6, z1: -172, width: 10, h0: 7, h1: 0, edge: 2 },             // the gorge down through the ridge
      { type: 'plateau', x: -16, z: -215, w: 20, d: 6, h: 8, edge: 2 },                                    // the choke, west jaw
      { type: 'plateau', x: 15, z: -215, w: 18, d: 6, h: 9, edge: 2 },                                     // the choke, east jaw
      { type: 'plateau', x: 0, z: -280, w: 200, d: 116, h: 3, edge: 3 },                                   // the nest (full width, so nothing drops into a pit beside it)
      { type: 'ramp', x0: 0, z0: -207, x1: 0, z1: -224, width: 12, h0: 0, h1: 3, edge: 2 },               // up through the choke into the nest
    ],
    build(K) {
      const { R, C } = K;

      // ---- Harbinger's Seclude: a cloister court on the heights, a pool and statues, the ring tower ----
      K.box(0, -30, 5, 0.12, 110, IVORY2, { y: 0.1, collide: false });                      // the processional strip
      // a colonnade that has lost some of its pillars
      for (const z of [-4, -14, -23, -41, -50, -59, -77]) {
        K.box(-34, z, 1.7, 8, 1.7, IVORY); K.box(-34, z, 2.4, 0.7, 2.4, GOLD, { y: 8, collide: false, glow: 0.4 });
      }
      for (const z of [-8, -17, -32, -50, -62, -72]) {
        const h = z === -32 ? 4.6 : 8;
        K.box(34, z, 1.7, h, 1.7, IVORY); if (h > 6) K.box(34, z, 2.4, 0.7, 2.4, GOLD, { y: 8, collide: false, glow: 0.4 });
      }
      K.box(-38.5, -10, 7, 0.7, 1.2, IVORY2, { y: 8.3, collide: false }); K.box(-38.5, -55, 7, 0.7, 1.2, IVORY2, { y: 8.3, collide: false });
      lamp(K, -28, -27, 3.8, GOLD); lamp(K, 28, -63, 3.8, GOLD);
      for (const sx of [-1, 1]) K.wall(sx * 42, 0, sx * 42, -78, 6, { t: 1.2, color: IVORY2, gaps: sx < 0 ? [[14, 24], [50, 60]] : [[8, 18], [38, 46]] });
      // the reflecting pool with a stepped rim (low cover) and a statue on a plinth; statues gather round it
      pad(K, 22, -50, 12, IVORY2);
      ghost(K.mesh(g().cyl28, ICE, 22, 0.4, -50, { scale: [10.6, 0.1, 10.6], glow: 0.4, collide: false }), 0.6);
      for (const a of [0.4, 1.5, 2.6, 3.7, 4.9]) K.obox(22 + Math.cos(a) * 11.6, -50 + Math.sin(a) * 11.6, 5.6, 0.9, 1.1, Math.atan2(-Math.cos(a), -Math.sin(a)), IVORY2);
      K.box(22, -50, 2.4, 1.6, 2.4, IVORY2); K.box(22, -50, 0.9, 3.4, 0.7, IVORY, { y: 1.6 });
      K.mesh(g().ico, IVORY, 22, 5.7, -50, { scale: [0.7, 0.9, 0.6], collide: false });
      K.mesh(g().octa, ICE, 22, 7.1, -50, { scale: [0.3, 0.5, 0.3], glow: 1.6 });
      for (const [x, z] of [[8, -40], [10, -62], [36, -38]]) {
        K.box(x, z, 2, 1.3, 2, IVORY2); K.box(x, z, 0.9, 3, 0.7, IVORY, { y: 1.3 });
        K.mesh(g().ico, IVORY, x, 5.3, z, { scale: [0.65, 0.8, 0.55], collide: false }); K.mesh(g().octa, ICE, x, 6.5, z, { scale: 0.22, glow: 1.4 });
      }
      // the Harbinger's tower, a tall ivory shaft with floating gold rings
      K.box(-52, -62, 8, 38, 8, IVORY);
      K.box(-52, -62, 9.5, 1.2, 9.5, GOLD, { y: 14, collide: false, glow: 0.5 });
      K.box(-52, -62, 6, 3, 6, IVORY2, { y: 38, collide: false });
      for (const [r, y] of [[8, 30], [6, 36], [4.4, 42]]) K.mesh(new THREE.TorusGeometry(r, 0.3, 4, 28), GOLD, -52, y, -62, { rx: Math.PI / 2, glow: 1 });
      K.mesh(g().octa, ICE, -52, 47, -62, { scale: [1.8, 3.4, 1.8], glow: 1.4 });
      K.light(-52, 14, -54, GOLD, 8, 28);
      for (const [x, z] of [[-12, -26], [-20, -70]]) K.box(x, z, 4, 0.8, 0.9, IVORY2);
      for (const [x, z, ry] of [[-26, -34, 0.3], [18, -22, 1.2], [4, -74, 0.1]]) ruin(K, x, z, ry, 0.9);
      for (const [x, z] of [[-30, -36], [30, -34], [-14, -8], [14, -76]]) blight(K, x, z, R(2.4, 3.2), { light: true });
      for (const [x, z] of [[-10, -64], [12, -16], [-30, -8], [30, -60]]) banner(K, x, z, R(6, 8));
      for (const [x, z] of [[-6, -30], [8, -58], [-20, -52]]) crystal(K, x, z, 1.2);
      K.scatter((x, z) => K.rock(x, z, R(1, 1.8)), 0, -44, 9, 19, 3, 2.4);
      mist(K, -16, -30, 12, 0.5, 0.2);
      for (const [x, z] of [[-64, 6], [64, 4], [-66, -24], [66, -28], [-68, -82], [70, -80]]) spire(K, x, z, R(16, 24), 2.2);
      // the north lip: a balustrade above the drop, the gate where the stairs leave
      K.wall(-80, -85.5, -8.6, -85.5, 2.4, { t: 1.2, color: IVORY2 });
      K.wall(8.6, -85.5, 80, -85.5, 2.4, { t: 1.2, color: IVORY2 });
      K.box(-44, -85.5, 71, 0.3, 1.5, GOLD, { y: 2.4, collide: false, glow: 0.5 }); K.box(44, -85.5, 71, 0.3, 1.5, GOLD, { y: 2.4, collide: false, glow: 0.5 });
      gatehouse(K, 0, -86.4, 16, 3.4, { zone: 0, color: IVORY2, pillar: IVORY });

      // ---- the stair viaduct: a long way down, a colonnade of broken pillars either side ----
      run(K, -8.4, -88, -8.4, -115, 1.3, { t: 0.8, color: IVORY, cap: GOLD });
      run(K, 8.4, -88, 8.4, -115, 1.3, { t: 0.8, color: IVORY, cap: GOLD });
      for (const [x, z, h] of [[-9.4, -92, 9], [9.4, -92, 9], [-9.4, -101, 6], [9.4, -101, 9], [-9.4, -110, 9]]) {
        K.box(x, z, 1.5, h, 1.5, IVORY); if (h > 7) K.box(x, z, 2.2, 0.6, 2.2, GOLD, { y: h, collide: false, glow: 0.4 });
      }
      for (let z = -90; z > -114; z -= 4) K.box(0, z, 14.4, 0.1, 0.4, GOLD, { y: 0.16, collide: false, glow: 0.35 });
      K.light(0, 5, -96, VIOLET, 8, 28); K.light(0, 5, -110, VIOLET, 8, 28);

      // ---- Gardens of Esila (the northern side): hedge lanes, trellis clusters, a greenhouse, a raised terrace ----
      // lanes of hedge, with breaks of different lengths
      for (const x of [-30, 26]) for (const [a, b] of x < 0 ? [[-96, -106], [-112, -120], [-130, -142]] : [[-98, -104], [-110, -122], [-128, -138]]) hedge(K, x, (a + b) / 2, 1.2, Math.abs(b - a), 1.6);
      // trellis arches in two clusters, not one long row
      for (const [x, z] of [[-14, -128], [-14, -135], [-14, -141], [14, -100], [14, -107]]) { arch(K, x, z, 7, 5.2, 'x', { color: IVORY }); K.box(x, z, 8, 0.8, 1.1, MOSS2, { y: 5.0, collide: false }); }
      // the greenhouse on the east: ivory ribs and translucent ice panes
      for (let z = -102; z > -144; z -= 8) K.box(46, z, 0.8, 7, 0.8, IVORY);
      K.box(46, -122, 0.8, 0.8, 42, IVORY, { y: 7, collide: false });
      for (let z = -106; z > -140; z -= 8) ghost(K.box(46.2, z, 0.2, 6.2, 7.4, ICE, { collide: false, glow: 0.2 }), 0.32);
      K.box(54, -122, 0.8, 7, 42, IVORY2);
      // raised west terrace, stairs up, a low colonnade
      K.platform(-52, -122, 16, 34, 2.4, { stairs: ['e'], color: IVORY2, stairColor: LAV, stairW: 7 });
      for (const z of [-108, -116, -124, -132, -138]) K.box(-58, z, 1.2, 5, 1.2, IVORY, { y: 2.4 });
      K.box(-58, -123, 1.2, 0.8, 32, IVORY, { y: 7.4, collide: false });
      K.light(-52, 6, -122, GOLD, 7, 24);
      // blight has taken the old fountain
      K.cyl(12, -138, 3.0, 1.0, IVORY2, { sides: 10 });
      blight(K, 12, -138, 2.2, { light: true });
      for (const [x, z] of [[-34, -100], [36, -108], [-34, -142]]) blight(K, x, z, R(2.2, 3), { light: true });
      ruin(K, 6, -112, 2.6, 1.0); ruin(K, -20, -112, 0.4, 0.9);
      flowers(K, -4, -124, 22, 18);
      for (const [x, z] of [[-18, -96], [10, -144], [38, -134]]) banner(K, x, z, R(6, 8));
      for (const [x, z] of [[-14, -112], [16, -130]]) lamp(K, x, z, 4, VIOLET);
      for (const [x, z] of [[-66, -96], [68, -98], [-66, -142], [68, -140]]) spire(K, x, z, R(16, 22), 2.0);
      mist(K, 0, -126, 20, 0.5, 0.18);
      K.scatter((x, z) => K.rock(x, z, R(1, 1.8)), -4, -122, 8, 19, 3, 2.4);
      // the ridge's face, vein-lit, and the gate where the gorge begins
      faceWall(K, -80, 80, -148.5, 10, [[-12, 0]], { color: BLIGHT2, cap: VEIN });
      for (const x of [-60, -40, -22, 12, 30, 50, 66]) blight(K, x, -146.4, R(1.6, 2.4), { light: true });
      gatehouse(K, -6, -153, 10, 8, { zone: 1, trim: VEIN, lamp: VEIN, color: BLIGHT2, doorColor: BLIGHT2, pillar: BLIGHT2, tip: VEIN });

      // ---- Blight Hollow: the gorge floor. Walls close in to a choke; a rock shelf for snipers; veins follow the path ----
      for (const [x, z, a, l] of [[-5, -178, 0.25, 14], [-2, -188, -0.1, 14], [2, -199, 0.2, 14], [0, -209, 0, 10]]) K.box(x, z, R(0.3, 0.5), 0.1, l, VEIN, { y: 0.1, collide: false, glow: 1.4 }).rotation.y = a;
      pad(K, -1, -192, 13, BLIGHT);
      // the walls: black rock and growths, the Taken spire on the west rim
      for (const [x, z] of [[-30, -178], [-34, -194], [-30, -208], [30, -176], [30, -212], [-44, -216]]) K.rock(x, z, R(4, 6));
      for (const [x, z, s] of [[-28, -186, 4.2], [28, -184, 3.8], [-28, -214, 4.6], [28, -208, 3.6], [-17, -197, 2.2], [14, -178, 2.4]]) blight(K, x, z, s, { light: true });
      K.cone(-44, -196, 4.6, 34, BLIGHT, { sides: 5 });
      for (const a of [0, 2.1, 4.2]) K.mesh(g().octa, VEIN, -44 + Math.cos(a) * 3.4, 12 + a * 3, -196 + Math.sin(a) * 3.4, { scale: [0.5, 2.6, 0.5], glow: 1.9, collide: false });
      K.light(-44, 14, -196, VEIN, 12, 44);
      // cover on the floor, alternating sides of the path
      for (const [x, z, w, d, h] of [[-14, -184, 5, 1.6, 2.0], [12, -176, 1.6, 5, 1.7], [-8, -200, 4, 1.6, 1.4], [14, -203, 1.6, 4, 1.8]]) stub(K, x, z, w, d, h, BLIGHT2);
      // the shelf: a low rail, growths and a crystal
      K.box(36, -205.6, 18, 1.0, 0.8, BLIGHT2); crystal(K, 41, -195, 1.3, VEIN); blight(K, 41, -202, 2.2, { light: true });
      for (const [x, z] of [[-18, -176], [20, -190], [-16, -202]]) banner(K, x, z, R(5, 6.5));
      for (const x of [-34, 36]) for (const z of [-188, -204]) crystal(K, x + R(-2, 2), z, 1.2, VEIN);
      for (const [x, z] of [[-6, -180], [10, -194], [-12, -206]]) K.light(x, 7, z, VEIN, 8, 26);
      K.scatter((x, z) => K.rock(x, z, R(1, 2)), -1, -192, 8, 16, 4, 2.6);
      mist(K, -1, -192, 18, 0.5, 0.1);
      // the choke: two jaws of rock either side of the ramp up
      for (const [x, z, s] of [[-10, -212, 3.4], [10, -212, 3.2]]) blight(K, x, z, s, { light: true, collide: false });
      for (const s of [-1, 1]) K.light(s * 7, 5, -206, VEIN, 8, 24);

      // ---- The Wishing Chamber: the Ahamkara's nest, a vast roofed hall, up from the dark ----
      K.room(0, -268, 88, 84, 20, { t: 2, color: DUSK, roofColor: LAV2, doors: { s: 10 }, roof: true });
      K.door(0, -226, 10, 20, 'x', { zone: 2, color: LAV2, trim: VEIN });
      // wings close the strip in front of the hall, so the only way on is the door
      K.wall(-80, -222.6, -8.6, -222.6, 8, { t: 1.4, color: DUSK }); K.wall(8.6, -222.6, 80, -222.6, 8, { t: 1.4, color: DUSK });
      K.box(-44, -222.6, 71, 0.3, 1.6, VEIN, { y: 8, collide: false, glow: 0.8 }); K.box(44, -222.6, 71, 0.3, 1.6, VEIN, { y: 8, collide: false, glow: 0.8 });
      // wish-light veins run from the nest to the door, branching: no ringed floor
      for (const [x, z, a, l, w] of [[0, -262, 0, 70, 1.1], [-12, -258, 0.55, 22, 0.6], [11, -262, -0.5, 24, 0.6], [-20, -276, 0.9, 16, 0.5], [18, -278, -0.8, 18, 0.5]]) K.box(x, z, w, 0.1, l, VEIN, { y: 0.1, collide: false, glow: 1.3 }).rotation.y = a;
      pad(K, 0, -300, 7, BLIGHT);
      // broken pillars: tall ones and snapped stumps for cover
      for (const [x, z, h] of [[-32, -246, 20], [32, -248, 12], [-36, -268, 20], [36, -270, 6], [-30, -290, 9], [30, -290, 20], [-14, -240, 20], [14, -241, 5]]) {
        K.box(x, z, 3.4, h, 3.4, IVORY2);
        if (h > 12) { K.box(x, z, 4.6, 1.3, 4.6, GOLD, { y: 14, collide: false, glow: 0.4 }); K.box(x, z, 4.2, 1.2, 4.2, LAV2, { collide: false }); }
      }
      for (const [x, z, ry] of [[-16, -262, 0.3], [20, -256, -0.5], [-6, -274, 1.0], [10, -282, 0.2], [-24, -280, -0.9], [26, -270, 0.7]]) K.obox(x, z, R(5, 7), R(1.4, 2.4), 1.6, ry, LAV2);
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
      for (const [x, z] of [[-43, -250], [43, -250], [-43, -286], [43, -286]]) banner(K, x, z, 14);
      for (const [x, z] of [[0, -240], [-24, -268], [24, -268], [0, -262], [-30, -240], [30, -240], [-40, -266], [40, -268]]) K.light(x, 12, z, x === 0 ? GOLD : VEIN, 9, 34);
      K.light(0, 7, -300, VEIN, 16, 46);
      // tall ice-blue windows high in the walls, storm-lit
      for (const z of [-244, -268, -292]) for (const s of [-1, 1]) K.box(s * 43.4, z, 0.3, 8, 5, ICE, { y: 9, collide: false, glow: 0.9 });

      K.edge((x, z, y) => farSpire(K, x, z, y), 26, 6, 40);
    },
  },
};
