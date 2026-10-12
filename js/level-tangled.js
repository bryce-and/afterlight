// Hand-built Tangled Shore mission maps (see makeKit in world.js).
// ts1: dense scrap shanty town (Thieves' Landing) -> holed rock cove -> junkyard arena.
// ts2: cliffside camp -> towering gorge with chains overhead -> Hive-tainted warrens -> roofed ritual cavern.
// ts3: wide wreck field of crashed hulls -> Scorn camp -> totem procession -> arena around a giant ether spire.
import * as THREE from 'three';

const SCRAP = [0x7a5a48, 0x6a6e74, 0x8a4a32, 0x5a6470, 0x9a6a3a, 0x4e5660, 0x6e5040];
const CLOTH = [0x5a3a7a, 0x8a3a5a, 0x3a5a6a, 0xa8743a, 0x6a2a3a, 0x4a3a6a];
const HULL = [0x4e4a5c, 0x5c5a66, 0x6a5a50, 0x3e3a48];
const LANT = 0xff9a3c, ROPE = 0x2a2628, DARK = 0x16121a, IRON = 0x3a3a42;
const BONE = 0xd8cfb4, ETHER = 0xcfeeff, HIVE = 0x7dff5a, CHITIN = 0x30342a, PAPER = 0xd8c8a0;
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

// shared unit geometries, created lazily (THREE is only needed once build() runs)
let G = null;
const geo = () => G || (G = {
  cyl: new THREE.CylinderGeometry(1, 1, 1, 6),
  rock: new THREE.DodecahedronGeometry(1, 0),
  ico: new THREE.IcosahedronGeometry(1, 0),
  cone: new THREE.ConeGeometry(1, 1, 5),
  ring: new THREE.TorusGeometry(1, 0.03, 4, 28),
});

// ---------------------------------------------------------------- helpers

// cylinder from point a to point b (no collider)
function beam(K, a, b, r, color, glow) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 0.01;
  const m = K.mesh(geo().cyl, color, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, { glow });
  m.scale.set(r, len, r);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
  return m;
}

// sagging cable a -> b; returns the polyline points
function cable(K, a, b, sag, r = 0.3, color = ROPE, segs = 5) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  for (let i = 0; i < segs; i++) beam(K, pts[i], pts[i + 1], r, color);
  return pts;
}

// chunky chain spanning a -> b (alternating flattened links along a sag)
function chainSpan(K, a, b, sag, r = 0.22) {
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const n = Math.max(6, Math.min(16, Math.round(len / 2.4)));
  const P = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
  for (let i = 0; i < n; i++) {
    const p = P(i / n), q = P((i + 0.9) / n);
    const m = beam(K, p, q, r, IRON);
    if (i % 2) m.scale.x *= 0.45; else m.scale.z *= 0.45;
  }
}

// vertical hanging chain from (x, yTop, z) down len metres
function chain(K, x, yTop, z, len, end) {
  const n = Math.max(3, Math.min(5, Math.round(len / 1.8))), lh = len / n;
  for (let i = 0; i < n; i++) {
    const odd = i % 2;
    K.box(x, z, odd ? 0.1 : 0.36, lh * 1.08, odd ? 0.36 : 0.1, IRON, { y: yTop - (i + 1) * lh, collide: false });
  }
  if (end === 'lantern') K.box(x, z, 0.5, 0.65, 0.5, LANT, { y: yTop - len - 0.65, collide: false, glow: 1.8 });
  else if (end === 'cage') {
    K.box(x, z, 1.4, 0.12, 1.4, IRON, { y: yTop - len - 0.1, collide: false });
    K.box(x, z, 1.4, 0.12, 1.4, IRON, { y: yTop - len - 2.1, collide: false });
    for (const sx of [-0.65, 0.65]) K.box(x + sx, z + sx, 0.08, 2, 0.08, IRON, { y: yTop - len - 2.1, collide: false });
  } else if (end === 'hook') K.box(x, z, 0.5, 0.6, 0.18, IRON, { y: yTop - len - 0.6, collide: false });
}

// floating asteroid (no collider)
function floater(K, x, y, z, s, chainP = 0.4) {
  const C = K.C;
  const m = K.mesh(geo().rock, K.RP([C.rock, C.rock2]), x, y, z, { rx: K.R(0, 3), ry: K.R(0, 3) });
  m.scale.set(s * K.R(1, 1.4), s * K.R(0.55, 0.85), s * K.R(0.9, 1.3));
  if (s > 3.5) {
    const c = K.mesh(geo().cone, C.rock2, x, y - s * 1.0, z, { rx: Math.PI, ry: K.R(0, 3) });
    c.scale.set(s * 0.75, s * 1.3, s * 0.75);
    if (K.chance(0.5)) { // ground crust on top, lit shanty or banner
      const cap = K.mesh(geo().cyl, C.ground, x, y + s * 0.45, z, { ry: K.R(0, 3) });
      cap.scale.set(s * 0.8, 0.5, s * 0.8);
      if (K.chance(0.5)) K.box(x, z, s * 0.5, s * 0.35, s * 0.4, K.RP(SCRAP), { y: y + s * 0.6, collide: false });
      else K.box(x, z, 0.25, 4, 0.25, C.metal, { y: y + s * 0.6, collide: false });
    }
  }
  if (K.chance(0.3)) {
    const band = K.mesh(geo().cyl, IRON, x, y, z);
    band.scale.set(s * 1.12, 0.6, s * 1.12);
    K.box(x + s * 1.12, z, 0.5, 0.9, 0.5, LANT, { y: y - 0.45, collide: false, glow: 1.6 });
  }
  if (K.chance(chainP)) {
    const n = K.chance(0.35) ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const len = Math.min(K.R(4, 14), y - s - 9);
      if (len > 2) chain(K, x + K.R(-s / 2, s / 2), y - s * 0.4, z + K.R(-s / 2, s / 2), len, K.RP(['lantern', 'hook', 'cage', null]));
    }
  }
}

// a sky full of floating rocks lashed together with Fallen cables; returns [x, y, z, s] list
function sky(K, n, o = {}) {
  const b = K.bounds, pts = [];
  for (let i = 0; i < n; i++) {
    const s = i % 5 === 0 ? K.R(6, 11) : K.R(1.5, 5);
    const x = K.R(b.minX - 55, b.maxX + 55), z = K.R(b.minZ - 55, b.maxZ + 55);
    const y = Math.max(K.R(o.yMin ?? 15, o.yMax ?? 60), 13 + s * 1.9);
    pts.push([x, y, z, s]);
    floater(K, x, y, z, s, o.chainP ?? 0.4);
  }
  for (let i = 0; i < (o.small ?? 0); i++) { // cheap small rocks drifting overhead
    const s = K.R(1, 3.5), x = K.R(b.minX - 30, b.maxX + 30), z = K.R(b.minZ - 30, b.maxZ + 30), y = K.R(16, 58);
    const m = K.mesh(geo().rock, K.RP([K.C.rock, K.C.rock2]), x, y, z, { rx: K.R(0, 3), ry: K.R(0, 3) });
    m.scale.set(s * K.R(1, 1.4), s * K.R(0.6, 0.9), s);
    if (s > 2.4) { const c = K.mesh(geo().cone, K.C.rock2, x, y - s, z, { rx: Math.PI }); c.scale.set(s * 0.7, s * 1.2, s * 0.7); }
  }
  let links = 0;
  for (let i = 0; i < pts.length && links < (o.links ?? 8); i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], c = pts[j], d = Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
      if (d > 14 && d < 42) { cable(K, [a[0], a[1], a[2]], [c[0], c[1], c[2]], d * 0.12, 0.4, ROPE, 4); links++; break; }
    }
  }
  return pts;
}

// huge Fallen cable from a ground anchor up to a floating rock
function anchor(K, x, z, top) {
  K.box(x, z, 2.6, 1.8, 2.6, K.C.metal);
  K.box(x, z, 1.4, 0.5, 1.4, LANT, { y: 1.8, collide: false, glow: 1.4 });
  cable(K, [x, 2, z], top, 3, 0.55, ROPE, 5);
}

// scrap shanty: box hut, slanted roof, dark door, lantern, maybe upper room/awning/poster/antenna
function shanty(K, x, z, w, d, h, face = 's', o = {}) {
  const C = K.C;
  K.box(x, z, w, h, d, K.RP(o.colors || SCRAP));
  const roof = K.box(x, z, w + 0.9, 0.22, d + 0.9, K.RP(SCRAP), { y: h, collide: false });
  if (w > d) roof.rotation.x = K.R(-0.16, 0.16); else roof.rotation.z = K.R(-0.16, 0.16);
  const [fx, fz] = DIRS[face];
  const ox = x + fx * (w / 2 + 0.04), oz = z + fz * (d / 2 + 0.04);
  K.box(ox, oz, fx ? 0.06 : 1.3, 2.2, fz ? 0.06 : 1.3, DARK, { collide: false });
  const side = K.chance(0.5) ? 1 : -1;
  if (o.lantern !== false && K.chance(o.lantern ?? 0.65)) K.box(ox + fx * 0.15 + (fz ? side * 1.0 : 0), oz + fz * 0.15 + (fx ? side * 1.0 : 0), 0.28, 0.38, 0.28, LANT, { y: 2.5, collide: false, glow: 1.8 });
  if (K.chance(o.awning ?? 0.25)) {
    const aw = K.box(ox + fx * 0.8, oz + fz * 0.8, fx ? 1.6 : 2.6, 0.12, fz ? 1.6 : 2.6, K.RP(CLOTH), { y: 2.7, collide: false });
    if (fz) aw.rotation.x = 0.2 * fz; else aw.rotation.z = -0.2 * fx;
  }
  if (K.chance(o.poster ?? 0.3)) { // bounty poster on a side wall
    if (fz) poster(K, x + w / 2, 1.3, z + K.R(-d / 4, d / 4), true, 1);
    else poster(K, x + K.R(-w / 4, w / 4), 1.3, z + d / 2, false, 1);
  }
  if (K.chance(o.upper ?? 0.25)) {
    const w2 = w * K.R(0.5, 0.7), d2 = d * K.R(0.5, 0.7), h2 = K.R(2, 3);
    K.box(x + K.R(-0.4, 0.4), z + K.R(-0.4, 0.4), w2, h2, d2, K.RP(SCRAP), { y: h + 0.2 });
    if (K.chance(0.5)) K.box(x, z, 0.3, 0.4, 0.3, LANT, { y: h + h2 + 0.2, collide: false, glow: 1.6 });
  } else if (K.chance(o.antenna ?? 0.2)) {
    K.box(x + w / 2 - 0.4, z, 0.12, K.R(2.5, 4.5), 0.12, C.metal, { y: h, collide: false });
  }
  if (o.hive && K.chance(o.hive)) hiveGrowth(K, x + K.R(-w / 3, w / 3), z + K.R(-d / 3, d / 3), K.R(0.8, 1.4), h);
}

// bounty poster on a wall face (thinX = poster plane faces +/-x)
function poster(K, x, y, z, thinX, out = 1) {
  const at = (k) => (thinX ? [x + out * k, z] : [x, z + out * k]);
  let [px, pz] = at(0.03);
  K.box(px, pz, thinX ? 0.04 : 1.0, 1.3, thinX ? 1.0 : 0.04, PAPER, { y, collide: false });
  [px, pz] = at(0.06);
  K.box(px, pz, thinX ? 0.04 : 0.5, 0.5, thinX ? 0.5 : 0.04, 0x3a2a3a, { y: y + 0.62, collide: false });
  K.box(px, pz, thinX ? 0.04 : 0.8, 0.14, thinX ? 0.8 : 0.04, 0xb83a2a, { y: y + 0.25, collide: false });
}

// fills a rectangle with shanties, leaving narrow slots between them
function packBlock(K, x0, x1, z0, z1, o = {}) {
  let z = z1;
  while (z - 3.5 > z0) {
    const d = Math.min(K.R(5, 7.5), z - z0);
    let x = x0;
    while (x + 3.5 < x1) {
      const w = Math.min(K.R(4.5, 8), x1 - x);
      if (!K.chance(o.skip ?? 0.12)) {
        const cx = x + w / 2, cz = z - d / 2;
        const face = typeof o.face === 'function' ? o.face(cx, cz) : (o.face ?? 's');
        shanty(K, cx, cz, w - K.R(0.7, 1.4), d - K.R(0.7, 1.4), K.R(o.hMin ?? 3, o.hMax ?? 6), face, o);
      }
      x += w;
    }
    z -= d;
  }
}

// market stall with a cloth awning, facing dir
function stall(K, x, z, face = 's') {
  const along = face === 's' || face === 'n', [fx, fz] = DIRS[face];
  const w = along ? 3.4 : 2.4, d = along ? 2.4 : 3.4;
  K.box(x + fx * 0.6, z + fz * 0.6, along ? 3.2 : 0.9, 1.0, along ? 0.9 : 3.2, K.RP(SCRAP));
  for (const sd of [-1, 1]) K.box(x + (along ? sd * (w / 2 - 0.1) : fx * (w / 2 - 0.1)), z + (along ? fz * (d / 2 - 0.1) : sd * (d / 2 - 0.1)), 0.12, 2.7, 0.12, K.C.metal, { collide: false });
  const aw = K.box(x, z, w + 0.5, 0.1, d + 0.5, K.RP(CLOTH), { y: 2.7, collide: false });
  if (along) aw.rotation.x = 0.18 * fz; else aw.rotation.z = -0.18 * fx;
  K.box(x + fx * 0.6, z + fz * 0.6, 0.5, 0.4, 0.5, K.RP([LANT, 0x6ad0ff, 0xc37aff]), { y: 1.0, collide: false, glow: 1.3 });
}

// Fallen banner on a pole
function banner(K, x, z, h = 6, thinX = false) {
  K.box(x, z, 0.3, h, 0.3, K.C.metal);
  K.box(x, z, thinX ? 0.12 : 2.2, 0.15, thinX ? 2.2 : 0.12, K.C.metal, { y: h - 0.3, collide: false });
  const ox = thinX ? 0.2 : 0, oz = thinX ? 0 : 0.2;
  K.box(x + ox, z + oz, thinX ? 0.05 : 1.8, h * 0.55, thinX ? 1.8 : 0.05, K.RP(CLOTH), { y: h * 0.4, collide: false });
  K.box(x + ox * 1.3, z + oz * 1.3, thinX ? 0.05 : 0.7, 0.7, thinX ? 0.7 : 0.05, LANT, { y: h * 0.68, collide: false, glow: 1.3 });
  K.box(x, z, 0.35, 0.35, 0.35, LANT, { y: h, collide: false, glow: 1.6 });
}

// lantern string between two points
function lanternString(K, a, b, n, sag = 1.2) {
  const pts = cable(K, a, b, sag, 0.05, ROPE, 3);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t);
    K.box(x, z, 0.32, 0.42, 0.32, K.RP([LANT, LANT, 0xffc060, 0xff6a3a]), { y: y - 0.55, collide: false, glow: 1.9 });
  }
  return pts;
}

// local-to-world helper for rotated compound props
const xf = (x, z, ry) => (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];

// wrecked Fallen skiff, long axis rotated by ry
function skiff(K, x, z, ry, s = 1, glow = 0) {
  const P = xf(x, z, ry), col = K.RP(HULL);
  let [px, pz] = P(0, 0);
  const hull = K.box(px, pz, 2.6 * s, 1.3 * s, 7 * s, col, { y: 0.1, collide: false });
  hull.rotation.set(0, ry, K.R(-0.12, 0.12));
  [px, pz] = P(0, -4.4 * s);
  K.box(px, pz, 1.5 * s, 0.9 * s, 2.4 * s, col, { y: 0.35 * s, collide: false }).rotation.set(0.25, ry, 0);
  [px, pz] = P(0, -1.6 * s);
  K.box(px, pz, 1.3 * s, 0.55 * s, 2 * s, 0xc37aff, { y: 1.35 * s, collide: false, glow: 0.4 });
  for (const sd of [-1, 1]) {
    [px, pz] = P(sd * 2.5 * s, 0.6 * s);
    K.box(px, pz, 2.6 * s, 0.2 * s, 3 * s, col, { y: 0.7 * s, collide: false }).rotation.set(0, ry, sd * 0.28);
    [px, pz] = P(sd * 0.9 * s, 3.65 * s);
    K.box(px, pz, 0.8 * s, 0.8 * s, 0.5 * s, glow ? LANT : 0x2a2a30, { y: 0.4 * s, collide: false, glow: glow || undefined });
  }
  for (const t of [-2.6, 0, 2.6]) {
    [px, pz] = P(0, t * s);
    K.collider(px - 1.25 * s, 0, pz - 1.25 * s, px + 1.25 * s, 1.5 * s, pz + 1.25 * s, t === 0 ? hull : null);
  }
}

// decorative Fallen mine pod
function minePod(K, x, z, col = 0xff5a2a) {
  const m = K.mesh(geo().ico, 0x2a2630, x, 0.55, z, { ry: K.R(0, 3) });
  m.scale.set(0.6, 0.55, 0.6);
  const b = K.mesh(geo().cyl, col, x, 0.6, z, { glow: 2 });
  b.scale.set(0.66, 0.14, 0.66);
  K.box(x, z, 0.12, 0.5, 0.12, IRON, { y: 1.0, collide: false });
}

// heap of scrap
function junkPile(K, x, z, r) {
  K.cone(x, z, r, r * K.R(0.8, 1.25), K.RP(SCRAP), { sides: 5 });
  for (let i = 0; i < 2; i++) {
    const a = K.R(0, 6.28), rr = r * K.R(0.3, 0.8);
    const m = K.box(x + Math.sin(a) * rr, z + Math.cos(a) * rr, K.R(1, 2.5), K.R(0.4, 1.4), K.R(1, 2.5), K.RP(SCRAP), { y: K.R(0, r * 0.4), collide: false });
    m.rotation.set(K.R(-0.6, 0.6), K.R(0, 3), K.R(-0.6, 0.6));
  }
  if (K.chance(0.4)) beam(K, [x, 0, z], [x + K.R(-2, 2), r * 1.7, z + K.R(-2, 2)], 0.12, K.C.metal);
}

// rock wall with holes punched through it. axis 'x' = runs along x at z = fixed.
// holes: [from, to, bottom, top] in world coords along the wall
function holedWall(K, axis, fixed, a0, a1, h, t, holes) {
  const C = K.C, ax = axis === 'x';
  const at = (a, w, hh, y, col, collide = true) => (ax ? K.box(a, fixed, w, hh, t, col, { y, collide }) : K.box(fixed, a, t, hh, w, col, { y, collide }));
  const ground = holes.filter((hh) => hh[2] <= 0);
  const gaps = holes.map((hh) => [hh[0] - a0, hh[1] - a0]);
  if (ax) K.wall(a0, fixed, a1, fixed, h, { t, color: C.rock, gaps }); else K.wall(fixed, a0, fixed, a1, h, { t, color: C.rock, gaps });
  for (const [f, to, bot, top] of holes) {
    const mid = (f + to) / 2, L = to - f;
    if (bot > 0) at(mid, L, bot, 0, C.rock2);
    at(mid, L + 0.02, h - top, top, C.rock2);
  }
  // jagged crown and buttresses (skip buttresses in front of ground holes)
  for (let a = a0 + 3; a < a1 - 2; a += K.R(5, 9)) {
    const hh = K.R(2, 6);
    at(a, K.R(3, 7), hh, h, K.RP([C.rock, C.rock2]), false).rotation.y = K.R(-0.2, 0.2);
    if (ground.some((g) => a > g[0] - 4 && a < g[1] + 4) || K.chance(0.5)) continue;
    const bw = K.R(2.5, 5), bh = h * K.R(0.4, 0.8), bt = K.R(1.5, 3);
    for (const sd of [-1, 1]) {
      if (ax) K.box(a, fixed + sd * (t / 2 + bt / 2), bw, bh, bt, C.rock2);
      else K.box(fixed + sd * (t / 2 + bt / 2), a, bt, bh, bw, C.rock2);
    }
  }
}

// cliff run along z: inner face near x = face, extending away from the gorge in dir (-1 west, +1 east)
function cliffRun(K, face, z0, z1, dir, hMin, hMax, o = {}) {
  const C = K.C;
  for (let z = z0; z > z1;) {
    const L = Math.min(K.R(5, 9), z - z1), jog = K.R(0, o.jog ?? 3), depth = K.R(8, 14);
    const xf0 = face + dir * jog, h = K.R(hMin, hMax), cz = z - L / 2;
    K.box(xf0 + dir * depth / 2, cz, depth, h, L + 0.6, K.RP([C.rock, C.rock2]));
    if (K.chance(0.6)) { // overhang lip near the top
      K.box(xf0 - dir * 1.2, cz, 2.6, K.R(2, 4), L * K.R(0.5, 0.9), C.rock2, { y: h - K.R(4, 8) });
    }
    if (K.chance(0.5)) {
      const r = K.mesh(geo().rock, K.RP([C.rock, C.rock2]), xf0 + dir * depth / 2, h, cz, { ry: K.R(0, 3) });
      r.scale.set(depth * 0.5, K.R(2, 5), L * 0.6);
    }
    z -= L;
  }
}

// Hive growth: chitin lump with glowing green crystals
function hiveGrowth(K, x, z, s = 1, y = 0, collide = false) {
  const m = K.mesh(geo().rock, CHITIN, x, y + s * 0.4, z, { ry: K.R(0, 3) });
  m.scale.set(s * 1.3, s * 0.8, s * 1.2);
  for (let i = 0; i < 3; i++) {
    const c = K.mesh(geo().cone, HIVE, x + K.R(-s, s), y + s * 1.1, z + K.R(-s, s), { rx: K.R(-0.5, 0.5), rz: K.R(-0.5, 0.5), glow: 1.1 });
    c.scale.set(s * 0.3, s * K.R(1.2, 2.2), s * 0.3);
  }
  if (collide) K.collider(x - s, y, z - s, x + s, y + s * 1.6, z + s, m);
}

// big Hive crystal cluster (boss cavern)
function hiveCrystals(K, x, z, s = 1) {
  for (let i = 0; i < 4; i++) {
    const h = s * K.R(3.5, 8), r = s * K.R(0.6, 1.2);
    const c = K.mesh(geo().cone, i ? HIVE : 0xb8ff9a, x + K.R(-1.4, 1.4) * s, h / 2 - 0.3, z + K.R(-1.4, 1.4) * s, { rx: K.R(-0.35, 0.35), rz: K.R(-0.35, 0.35), glow: 0.9 });
    c.scale.set(r, h, r);
  }
  const base = K.mesh(geo().rock, CHITIN, x, 0.3, z, { ry: K.R(0, 3) });
  base.scale.set(2.2 * s, 1 * s, 2.2 * s);
  K.collider(x - 1.8 * s, 0, z - 1.8 * s, x + 1.8 * s, 5 * s, z + 1.8 * s, base);
}

// tilted crashed hull plate, mostly along x (ry small) or along z (ry ~ PI/2)
function plate(K, x, z, w, h, t, alongX, lean, color) {
  const m = K.box(x, z, alongX ? w : t, h, alongX ? t : w, color ?? K.RP(HULL), { y: -0.6, collide: false });
  if (alongX) m.rotation.x = lean; else m.rotation.z = lean;
  const sway = Math.abs(Math.sin(lean)) * h * 0.35 + t / 2 + 0.3;
  if (alongX) K.collider(x - w / 2, 0, z - sway, x + w / 2, h * 0.8, z + sway, m);
  else K.collider(x - sway, 0, z - w / 2, x + sway, h * 0.8, z + w / 2, m);
  if (K.chance(0.5)) { // orange Fallen stripe
    const s = K.box(x, z, alongX ? w * 0.7 : t + 0.08, 0.35, alongX ? t + 0.08 : w * 0.7, LANT, { y: h * 0.45, collide: false, glow: 0.8 });
    if (alongX) s.rotation.x = lean; else s.rotation.z = lean;
  }
  return m;
}

// broken hull rib arcs sticking out of the ground
function ribs(K, x, z, ry, span, h, n = 3, gap = 4) {
  const P = xf(x, z, ry);
  for (let i = 0; i < n; i++) {
    const lz = (i - (n - 1) / 2) * gap;
    for (const sd of [-1, 1]) {
      if (K.chance(0.2)) continue; // snapped off
      const [ax, az] = P(sd * span / 2, lz), [bx, bz] = P(sd * (span / 2 + 1.2), lz), [cx, cz] = P(sd * span / 5, lz);
      beam(K, [ax, -0.5, az], [bx, h * 0.6, bz], 0.4, HULL[0]);
      beam(K, [bx, h * 0.6, bz], [cx, h, cz], 0.32, HULL[1]);
      K.collider(ax - 0.6, 0, az - 0.6, ax + 0.6, h * 0.5, az + 0.6, null);
    }
  }
}

// Scorn totem of bone and scrap with an ether glow
function totem(K, x, z, h = 6) {
  K.box(x, z, 1.4, 1.2, 1.4, K.RP(SCRAP));
  K.box(x, z, 0.45, h, 0.45, BONE, { collide: false });
  beam(K, [x - 1.3, h * 0.55, z - 0.3], [x + 1.3, h * 0.78, z + 0.3], 0.12, BONE);
  beam(K, [x - 1.3, h * 0.78, z + 0.3], [x + 1.3, h * 0.55, z - 0.3], 0.12, BONE);
  K.box(x, z, 0.85, 0.75, 0.85, BONE, { y: h - 0.2, collide: false });
  K.box(x, z + 0.43, 0.55, 0.14, 0.04, ETHER, { y: h + 0.15, collide: false, glow: 2.2 });
  beam(K, [x - 0.35, h + 0.45, z], [x - 1.0, h + 1.6, z], 0.1, BONE);
  beam(K, [x + 0.35, h + 0.45, z], [x + 1.0, h + 1.6, z], 0.1, BONE);
  K.box(x + 0.3, z, 0.05, h * 0.4, 0.8, 0x2a3040, { y: h * 0.3, collide: false });
  K.box(x, z - 0.3, 0.35, 0.35, 0.35, ETHER, { y: h * 0.42, collide: false, glow: 2 });
}

// ether canister
function etherCan(K, x, z, r = 0.6, h = 1.8) {
  K.cyl(x, z, r, h, ETHER, { glow: 1.2 });
  K.cyl(x, z, r * 1.1, 0.25, K.C.metal, { y: h, collide: false });
  K.cyl(x, z, r * 1.1, 0.25, K.C.metal, { collide: false });
}

// spiked Scorn barricade, along x or z
function spikes(K, x, z, len, alongX) {
  K.box(x, z, alongX ? len : 0.6, 1.5, alongX ? 0.6 : len, K.RP(SCRAP));
  for (let a = -len / 2 + 0.6; a < len / 2; a += 1.3) {
    const bx = alongX ? x + a : x, bz = alongX ? z : z + a, s = K.chance(0.5) ? 1 : -1;
    beam(K, [bx, 0.8, bz], [bx + (alongX ? 0 : s * 1.1), 2.6, bz + (alongX ? s * 1.1 : 0)], 0.09, K.RP([BONE, IRON]));
  }
}

// ring of positions around a center, skipping a mouth (angle measured from +z toward +x)
function ringAround(cx, cz, r, n, skip) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (skip && skip(a)) continue;
    out.push([cx + Math.sin(a) * r, cz + Math.cos(a) * r, a]);
  }
  return out;
}

// ---------------------------------------------------------------- missions

export default {
  // ------------------------------------------------ ts1: The Trickster
  ts1: {
    spawn: [0, 20],
    noEdge: true,
    bounds: [-70, 75, -228, 32],
    zones: [
      { name: "Thieves' Landing", x: 0, z: -50 },
      { name: 'Four-Holed Cove', x: 36, z: -116 },
      { name: "The Trickster's Scrapyard", x: 10, z: -186, boss: true },
    ],
    build(K) {
      const C = K.C;
      sky(K, 10, { chainP: 0.3, links: 4, small: 14 });
      K.edge((x, z, y) => (K.chance(0.6) ? K.rock(x, z, K.R(3, 8), { y, collide: false }) : K.prop(x, z, y, false)), 40);

      // --- landing pad at spawn
      K.box(0, 20, 16, 0.25, 14, C.metal, { collide: false });
      for (const sx of [-7.6, 7.6]) for (const sz of [13.6, 26.4]) K.box(sx, sz, 0.5, 0.35, 0.5, LANT, { collide: false, glow: 2 });
      skiff(K, 14, 22, 0.35, 1, 1.2);
      for (const [x, z] of [[-11, 10], [11, 9], [-24, 22], [26, 14]]) K.crate(x, z);
      shanty(K, -30, 14, 7, 6, 4.5, 'e', { poster: 1 });
      shanty(K, 32, 22, 6, 7, 5, 'w', { poster: 1 });
      shanty(K, -32, 4, 6, 6, 5, 'e');
      banner(K, -5, 7, 7); banner(K, 5, 7, 7);

      // --- dense shanty blocks with alleys leading to the market square
      // main alley x -3.5..3.5, side alleys x -23..-17.5 and 19..24.5
      const faceAlley = (x0, x1) => (cx) => (cx > (x0 + x1) / 2 ? 'e' : 'w');
      packBlock(K, -17.5, -3.5, -29, 3, { face: faceAlley(-17.5, -3.5), poster: 0.35 });
      packBlock(K, 3.5, 19, -29, 3, { face: faceAlley(3.5, 19), poster: 0.35 });
      packBlock(K, -32, -23, -27, 0, { face: 'e', skip: 0.2 });
      packBlock(K, 24.5, 33, -27, 0, { face: 'w', skip: 0.2 });
      for (const [x, z] of [[-40, -8], [40, -16]]) K.prop(x, z);
      for (const [x, z] of [[-55, -4], [-60, -22], [56, -6], [62, -24], [-52, 26], [55, 28]]) K.prop(x, z);
      K.rock(-62, 8, 4.5); K.rock(64, 10, 5);
      // lantern strings across the main alley and side alleys
      for (let z = -2; z > -28; z -= 12) lanternString(K, [-4.2, 5.5, z], [4.2, 5.2, z - 2], 3, 0.8);
      lanternString(K, [-23.5, 5, -6], [-17, 5, -14], 3, 0.6);
      lanternString(K, [18.5, 5, -10], [25, 5, -18], 3, 0.6);
      banner(K, -4.5, -28, 6.5); banner(K, 4.5, -28, 6.5);

      // --- Thieves' Landing market square (open ring around (0,-50))
      const poles = [0, 1, 2, 3, 4, 5].map((i) => { const a = (i + 0.5) * Math.PI / 3, x = Math.sin(a) * 20, z = -50 + Math.cos(a) * 20; K.box(x, z, 0.4, 8, 0.4, C.metal); return [x, 7.8, z]; });
      for (let i = 0; i < 3; i++) lanternString(K, poles[i], poles[i + 3], 5, 2.2);
      for (let i = 0; i < 6; i += 2) lanternString(K, poles[i], poles[(i + 1) % 6], 3, 1.0);
      for (const [x, z, a] of ringAround(0, -50, 14, 8, (a) => Math.abs(a - Math.PI) < 0.35 || a < 0.3 || a > 5.98)) {
        const face = Math.abs(Math.sin(a)) > Math.abs(Math.cos(a)) ? (Math.sin(a) > 0 ? 'w' : 'e') : (Math.cos(a) > 0 ? 'n' : 's');
        stall(K, x, z, face);
      }
      K.scatter(K.crate, 0, -50, 6, 10, 4, 1.5);
      K.light(0, 7, -50, LANT, 9, 32);
      // the Spider's den: big stacked scrap hall on the west side of the square
      K.box(-46, -52, 18, 6, 20, 0x5a4a44);
      K.box(-47, -52, 13, 5, 15, 0x6a5a50, { y: 6 });
      K.box(-48, -52, 8, 4, 10, 0x4e4a54, { y: 11 });
      K.box(-48, -52, 9, 0.3, 11, IRON, { y: 15, collide: false }).rotation.z = 0.12;
      K.box(-36.9, -52, 0.1, 3.4, 4.4, DARK, { collide: false });
      K.box(-35, -52, 4, 0.15, 9, 0x5a3a7a, { y: 4, collide: false }).rotation.z = -0.15;
      banner(K, -35, -46.5, 9, true); banner(K, -35, -57.5, 9, true);
      lanternString(K, [-36.5, 6, -62], [-36.5, 6, -42], 5, 0.6);
      K.box(-43.8, -52, 0.3, 1, 3, LANT, { y: 12, collide: false, glow: 1.5 });
      K.light(-33, 5, -52, 0xffb060, 7, 18);
      anchor(K, -40, -66, [-52, 48, -80]);
      floater(K, -52, 48, -80, 7, 0);
      // blocks around the square, leaving the southeast exit (x 8..30) toward the cove
      for (const [x, z] of [[-62, -34], [-63, -70], [-64, -52]]) K.rock(x, z, K.R(3.5, 5));
      packBlock(K, 26, 40, -68, -30, { face: 'w', skip: 0.5, hMax: 7 });
      packBlock(K, -14, 7, -98, -77, { face: 's', skip: 0.4 });
      for (const [x, z, w] of [[-24, -86, 12], [-40, -82, 14], [-58, -90, 18]]) K.box(x, z, w, K.R(7, 12), 14, K.RP([C.rock, C.rock2]));
      cliffRun(K, -30, -76, -99, -1, 8, 14, { jog: 2 });
      for (const [x, z] of [[50, -40], [62, -58], [48, -78], [64, -84], [56, -20]]) junkPile(K, x, z, K.R(3.5, 5.5));
      for (const [x, z] of [[-30, -32], [-32, -70], [24, -32]]) banner(K, x, z, 6);
      K.scatter((x, z) => K.prop(x, z), 60, -60, 2, 12, 5, 3);

      // --- Four-Holed Cove
      K.box(56, -118, 30, 0.2, 30, 0x2c3448, { collide: false }); // dark tide pool
      for (const [x, z] of [[50, -108], [62, -126], [46, -130]]) K.rock(x, z, K.R(1.4, 2.4));
      skiff(K, 64, -104, 1.2, 1.1);
      // rock arch standing in the cove
      K.box(58, -98, 3.5, 11, 3.5, C.rock); K.box(70, -98, 3.5, 12, 3.5, C.rock2);
      K.box(64, -98, 16, 4, 4.5, C.rock, { y: 11 });
      K.rock(64, -98, 3, { y: 13.5, collide: false });
      // the great holed wall closing the cove (four holes, two walkable)
      holedWall(K, 'x', -147, -22, 75, 15, 5, [[-8, -2, 5, 10], [16, 24, 0, 8.5], [42, 48, 6, 11], [57, 64, 0, 9.5]]);
      cliffRun(K, -22, -100, -150, -1, 10, 18, { jog: 4 }); // rock mass west of the cove
      for (const [x, z] of [[-10, -108], [2, -128], [-4, -118]]) K.rock(x, z, K.R(2, 3.5));
      K.scatter((x, z) => K.rock(x, z, K.R(1.2, 2.2)), 36, -116, 8, 18, 3, 2.5);
      K.scatter(K.cover, 36, -116, 6, 17, 5, 2);
      shanty(K, 10, -104, 6, 5, 4, 'e', { poster: 1 }); // smuggler hut
      lanternString(K, [16, 6, -143], [24, 6, -143], 3, 0.5);
      anchor(K, 68, -138, [80, 40, -150]);
      floater(K, 80, 42, -150, 6, 0);

      // --- the Trickster's scrapyard (boss)
      const bx = 10, bz = -186;
      for (const [x, z, a] of ringAround(bx, bz, 28, 16, (a) => a < 1.25 || a > 5.75 || Math.abs(a - Math.PI) < 0.2)) {
        junkPile(K, x, z, K.R(4, 6));
        if (K.chance(0.25)) minePod(K, x - Math.sin(a) * 5, z - Math.cos(a) * 5);
      }
      skiff(K, bx - 13, bz - 6, 0.6, 1.2);
      skiff(K, bx + 17, bz - 10, 1.57, 1.3);
      for (let i = 0; i < 8; i++) {
        const a = K.R(0, 6.28), r = K.R(9.5, 24);
        minePod(K, bx + Math.sin(a) * r, bz + Math.cos(a) * r, K.RP([0xff5a2a, LANT, 0xc37aff]));
      }
      K.scatter(K.crate, bx, bz, 11, 20, 6, 1.5);
      K.scatter((x, z) => K.box(x, z, K.R(3, 5), K.R(1.2, 2), 0.8, K.RP(SCRAP)), bx, bz, 14, 22, 4, 3);
      // Araskes's stage: scrap dais with banners and a bounty board
      K.platform(bx, bz - 20, 9, 5, 1.6, { stairs: ['s'], color: 0x5a4a44 });
      banner(K, bx - 4, bz - 22, 7); banner(K, bx + 4, bz - 22, 7);
      K.box(bx, bz - 22.3, 4, 3, 0.3, 0x4a3a30, { y: 1.6 });
      for (const dx of [-1.2, 0, 1.2]) poster(K, bx + dx, 2.4, bz - 22.15, false, 1);
      // scrap crane looming over the yard
      K.box(-20, -208, 2, 24, 2, IRON);
      beam(K, [-20, 23, -208], [4, 26, -196], 0.5, IRON);
      beam(K, [-20, 23, -208], [-28, 20, -214], 0.5, IRON);
      chain(K, 2, 25.5, -197, 9, 'hook');
      K.box(-28, -214, 3, 3, 3, IRON, { y: 17, collide: false });
      // the hollow beyond the east passage
      for (const [x, z] of [[62, -170], [60, -210]]) junkPile(K, x, z, K.R(4, 6));
      skiff(K, 60, -188, 0.2, 1.2);
      K.light(bx, 7, bz, LANT, 10, 34);
      K.light(bx, 4, bz - 19, 0xff5a2a, 8, 20);
    },
  },

  // ------------------------------------------------ ts2: The Mindbender
  ts2: {
    spawn: [6, 18],
    noEdge: true,
    bounds: [-55, 55, -282, 30],
    zones: [
      { name: "Trapper's Cave", x: -12, z: -40 },
      { name: 'The Rift', x: 0, z: -112 },
      { name: 'Hive-Tainted Warrens', x: 10, z: -180 },
      { name: "The Mindbender's Cavern", x: 0, z: -250, boss: true },
    ],
    build(K) {
      const C = K.C;
      sky(K, 16, { yMin: 30, yMax: 70, chainP: 0.45, links: 5, small: 12 });
      K.edge((x, z, y) => (K.chance(0.6) ? K.rock(x, z, K.R(3, 8), { y, collide: false }) : K.prop(x, z, y, false)), 40);

      // --- Trapper's Cave: cliffside camp under a towering west cliff
      cliffRun(K, -34, 30, -33, -1, 16, 26);
      cliffRun(K, -34, -47, -68, -1, 16, 26);
      // the cave mouth (recess with a rock roof)
      K.box(-50, -40, 4, 14, 16, C.rock2);
      K.box(-42, -32.2, 16, 9, 1.6, C.rock); K.box(-42, -47.8, 16, 9, 1.6, C.rock);
      K.box(-42, -40, 18, 6, 17.6, C.rock2, { y: 9 });
      K.box(-42, -40, 15, 0.15, 14, 0x2a2228, { collide: false });
      etherCan(K, -46, -36); etherCan(K, -46.5, -38.5, 0.5, 1.4);
      K.crate(-45, -44); K.crate(-38, -45.5);
      chain(K, -40, 9, -37, 3.5, 'cage'); chain(K, -44, 9, -42, 3, 'cage');
      K.light(-40, 5, -40, LANT, 9, 20);
      // camp: tents, trap racks, cages, fire
      for (const [x, z] of [[-29, -22], [-28, -58], [-30, -10], [-26, -66]]) K.cone(x, z, 2.6, 3.2, K.RP(CLOTH), { sides: 4 });
      for (const [x, z] of [[-25, -30], [-24, -50]]) { // pelt / net racks
        K.box(x, z - 1.6, 0.2, 2.6, 0.2, C.metal); K.box(x, z + 1.6, 0.2, 2.6, 0.2, C.metal);
        K.box(x, z, 0.1, 0.12, 3.4, C.metal, { y: 2.5, collide: false });
        K.box(x, z, 0.05, 1.6, 2.8, 0x6a5a4a, { y: 0.8, collide: false });
      }
      for (const [x, z] of [[2, -24], [-6, -60], [8, -56]]) { // trapper's cages
        K.box(x, z, 2, 0.15, 2, IRON, { y: 2.2, collide: false });
        for (const sx of [-0.9, 0.9]) for (const sz of [-0.9, 0.9]) K.box(x + sx, z + sz, 0.12, 2.2, 0.12, IRON, { collide: false });
        K.collider(x - 1, 0, z - 1, x + 1, 2.3, z + 1, null);
      }
      K.cone(-20, -40, 0.8, 1.2, LANT, { glow: 2, collide: false });
      for (let i = 0; i < 6; i++) K.box(-20 + Math.sin(i) * 1.2, -40 + Math.cos(i) * 1.2, 0.5, 0.35, 0.5, C.rock2, { collide: false });
      banner(K, -31, -36, 7, true); banner(K, -31, -44, 7, true);
      shanty(K, 22, -30, 6, 5, 4, 'w', { poster: 1, hive: 0 });
      shanty(K, 20, -54, 5, 6, 4.5, 'w');
      K.scatter((x, z) => K.rock(x, z, K.R(1.2, 2.5)), -12, -40, 7, 18, 6, 2.5);
      for (const [x, z] of [[40, -10], [44, -50], [36, 10]]) K.rock(x, z, K.R(4, 6));
      anchor(K, 34, -30, [50, 45, -45]);
      floater(K, 50, 45, -45, 8, 0.5);

      // --- The Rift: long gorge between towering asteroid walls
      cliffRun(K, -28, -68, -78, -1, 22, 30);
      cliffRun(K, 28, -68, -78, 1, 22, 30);
      cliffRun(K, -21, -78, -160, -1, 24, 34, { jog: 2.5 });
      cliffRun(K, 21, -78, -160, 1, 24, 34, { jog: 2.5 });
      // east side closure between camp and gorge mouth
      K.box(42, -60, 26, 14, 10, C.rock2); K.box(-44, -72, 22, 18, 10, C.rock); K.box(46, -73, 18, 14, 12, C.rock);
      K.box(42, -158, 26, 20, 6, C.rock2); K.box(-42, -158, 26, 20, 6, C.rock);
      for (const z of [-84, -102, -122, -142]) {
        chainSpan(K, [-22, K.R(22, 26), z], [22, K.R(22, 26), z + K.R(-4, 4)], K.R(3, 5));
        chain(K, K.R(-8, 8), 19, z, K.R(3, 6), K.RP(['cage', 'lantern', 'hook']));
      }
      // Fallen rope bridge high across the gorge
      K.box(0, -132, 44, 0.3, 2.6, 0x5a4a3a, { y: 20, collide: false });
      cable(K, [-22, 21.4, -130.8], [22, 21.4, -130.8], 1.2, 0.06);
      cable(K, [-22, 21.4, -133.2], [22, 21.4, -133.2], 1.2, 0.06);
      K.box(0, -132, 3.4, 9, 0.08, 0x5a3a7a, { y: 11, collide: false });
      K.box(0, -132.06, 1.4, 1.4, 0.08, LANT, { y: 16, collide: false, glow: 1.4 });
      for (const [x, z] of [[-14, -96], [12, -100], [-10, -126], [14, -124], [-3, -150], [6, -88]]) K.rock(x, z, K.R(1.5, 2.8));
      for (const [x, z] of [[-6, -96], [8, -136]]) K.box(x, z, 5, 1.6, 0.8, K.RP(SCRAP));
      skiff(K, 13, -146, 0.3, 1);
      for (const [x, z] of [[-18, -90], [18, -112], [-18, -138]]) { // wall lamps
        K.box(x, z, 0.3, 4, 0.3, C.metal); K.box(x, z, 0.5, 0.5, 0.5, LANT, { y: 4, collide: false, glow: 2 });
      }
      K.light(0, 12, -112, LANT, 8, 34);

      // --- Hive-tainted warrens: shanties choked with Hive growth under scrap canopies
      cliffRun(K, -40, -160, -222, -1, 18, 28);
      cliffRun(K, 42, -160, -222, 1, 18, 28);
      const warren = [[-22, -166, 6, 5, 'e'], [-26, -184, 5, 7, 'e'], [-20, -202, 7, 5, 'e'], [-34, -174, 5, 6, 'e'],
        [33, -166, 6, 5, 'w'], [34, -186, 5, 6, 'w'], [30, -204, 6, 5, 'w'], [-8, -160, 5, 4, 's'], [24, -158, 5, 5, 's']];
      for (const [x, z, w, d, f] of warren) shanty(K, x, z, w, d, K.R(3.2, 5), f, { hive: 0.9, colors: [0x4e5050, 0x5a4a40, 0x44484e], awning: 0.1, upper: 0.15 });
      for (const [cx, cz] of [[-24, -184], [32, -185]]) { // scrap canopies on posts
        for (const sx of [-6, 6]) for (const sz of [-8, 8]) K.box(cx + sx, cz + sz, 0.5, 10, 0.5, C.metal);
        K.box(cx, cz, 14, 0.4, 18, 0x4a4440, { y: 10, collide: false }).rotation.x = 0.05;
        hiveGrowth(K, cx + 3, cz, 1.6, 10.3);
        chain(K, cx, 10, cz - 3, 4, 'lantern');
      }
      for (const [x, z, s] of [[-6, -170, 1.4], [26, -174, 1.2], [-4, -196, 1.6], [24, -196, 1.3], [14, -201, 1.0], [-12, -186, 1.1], [32, -176, 1]]) hiveGrowth(K, x, z, s, 0, true);
      for (const [x, z] of [[-14, -176], [30, -194]]) { // chitin arches
        beam(K, [x - 3, 0, z], [x - 1, 7, z], 0.6, CHITIN); beam(K, [x + 3, 0, z], [x + 1, 7, z], 0.6, CHITIN);
        beam(K, [x - 1, 7, z], [x + 1, 7, z], 0.6, CHITIN);
        K.collider(x - 3.6, 0, z - 0.6, x - 2.4, 4, z + 0.6, null); K.collider(x + 2.4, 0, z - 0.6, x + 3.6, 4, z + 0.6, null);
      }
      for (let i = 0; i < 8; i++) { // egg sacs
        const a = K.R(0, 6.28), r = K.R(10, 22), x = 10 + Math.sin(a) * r, z = -180 + Math.cos(a) * r;
        const e = K.mesh(geo().ico, 0xa8d880, x, 0.5, z, { glow: 0.5 }); e.scale.set(0.6, 0.9, 0.6);
      }
      K.light(10, 6, -184, HIVE, 7, 26);

      // --- the Mindbender's ritual cavern (roofed)
      const bx = 0, bz = -250;
      K.room(bx, bz, 56, 52, 14, { t: 2.4, color: C.rock2, doors: { s: 12 }, roof: true, roofColor: C.rock });
      // mountain mass over and around the cavern
      for (const [x, z, s] of [[-18, -258, 14], [16, -262, 15], [0, -240, 12], [-30, -230, 10], [30, -232, 11], [0, -278, 12]]) {
        const m = K.mesh(geo().rock, K.RP([C.rock, C.rock2]), x, 14 + s * 0.3, z, { ry: K.R(0, 3) });
        m.scale.set(s * 1.2, s * 0.7, s);
      }
      K.box(-20, -223.5, 12, 18, 3, C.rock); K.box(20, -223.5, 12, 18, 3, C.rock2);
      K.box(0, -223.5, 14, 4, 3, C.rock, { y: 14 });
      K.box(-6.6, -221.8, 0.2, 9, 0.6, HIVE, { glow: 1, collide: false }); K.box(6.6, -221.8, 0.2, 9, 0.6, HIVE, { glow: 1, collide: false });
      // irregular cave walls inside
      for (let i = 0; i < 14; i++) {
        const t = i / 14, side = i % 4;
        let x, z;
        if (side === 0) { x = -26; z = bz - 24 + t * 48; } else if (side === 1) { x = 26; z = bz - 24 + t * 48; } else { x = bx - 24 + t * 48; z = bz - 24; }
        if (side === 3) { x = K.RP([-20, -14, 14, 20]); z = bz + 23; }
        K.rock(x, z, K.R(2, 3.5));
      }
      for (let i = 0; i < 12; i++) { // stalactites
        const s = K.mesh(geo().cone, K.RP([C.rock, C.rock2]), K.R(-24, 24), 14 - 1.6, bz + K.R(-23, 23), { rx: Math.PI });
        s.scale.set(K.R(0.6, 1.4), K.R(2, 3.6), K.R(0.6, 1.4));
      }
      // ritual circle
      const ring = K.mesh(geo().ring, HIVE, bx, 0.08, bz, { rx: Math.PI / 2, glow: 1.6 }); ring.scale.set(7, 7, 7);
      const ring2 = K.mesh(geo().ring, 0xc37aff, bx, 0.08, bz, { rx: Math.PI / 2, glow: 1.6 }); ring2.scale.set(4.5, 4.5, 4.5);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.28;
        K.box(bx + Math.sin(a) * 5.8, bz + Math.cos(a) * 5.8, 0.6, 0.06, 0.6, HIVE, { collide: false, glow: 1.8 });
      }
      // Hive crystals and Fallen tech around the circle
      for (const [x, z, s] of [[-17, -238, 1.1], [17, -240, 1], [-19, -262, 1.3], [18, -264, 1.2], [-8, -270, 0.9], [9, -232, 0.8]]) hiveCrystals(K, x, z, s);
      for (const [x, z] of [[-11, -256], [11, -256], [-12, -244], [12, -244]]) { // consoles
        K.box(x, z, 2, 1.3, 1.2, 0x3a3848);
        K.box(x, z + 0.62, 1.6, 0.6, 0.06, 0xc37aff, { y: 0.6, collide: false, glow: 1.6 });
      }
      for (const [x, z] of [[-21, -250], [21, -250]]) { // shock pylons
        K.box(x, z, 1, 9, 1, 0x3a3848);
        K.box(x, z, 0.5, 0.5, 0.5, 0x7ab8ff, { y: 9, glow: 2, collide: false });
      }
      for (const [x, z] of [[-14, -230], [14, -230], [-22, -272], [22, -272]]) K.cyl(x, z, 1.8, 14, C.rock, { sides: 7, r2: 2.4 });
      const serv = K.mesh(geo().ico, 0x4a3a6a, bx, 8, bz - 13); serv.scale.set(2.4, 2.4, 2.4);
      K.mesh(geo().cyl, 0xc37aff, bx, 8, bz - 10.7, { rx: Math.PI / 2, glow: 2 }).scale.set(0.9, 0.2, 0.9);
      beam(K, [bx, 13.7, bz - 13], [bx, 10.4, bz - 13], 0.3, IRON);
      beam(K, [bx - 26, 6, bz - 20], [bx - 2, 7, bz - 13], 0.35, ETHER, 0.4);
      beam(K, [bx + 26, 6, bz - 20], [bx + 2, 7, bz - 13], 0.35, ETHER, 0.4);
      for (const [x, z, s] of [[-25, -240, 1.2], [25, -258, 1.3], [-24, -268, 1], [24, -236, 1]]) hiveGrowth(K, x, z, s, K.R(3, 7));
      K.light(-12, 9, bz, HIVE, 9, 28);
      K.light(12, 9, bz, HIVE, 9, 28);
      K.light(bx, 10, bz - 14, 0xc37aff, 9, 26);
    },
  },

  // ------------------------------------------------ ts3: Scorned
  ts3: {
    spawn: [-28, 20],
    noEdge: true,
    bounds: [-80, 80, -266, 30],
    zones: [
      { name: 'Jetsam of Saturn', x: -30, z: -45 },
      { name: 'Scorn Encampment', x: 26, z: -96 },
      { name: "The Fanatic's Approach", x: -8, z: -160 },
      { name: "Fikrul's Ether Spire", x: 0, z: -220, boss: true },
    ],
    build(K) {
      const C = K.C;
      sky(K, 22, { yMin: 20, yMax: 65, chainP: 0.35, links: 6, small: 18 });
      K.edge((x, z, y) => (K.chance(0.6) ? K.rock(x, z, K.R(3, 8), { y, collide: false }) : K.prop(x, z, y, false)), 40);
      for (let i = 0; i < 8; i++) { // hull fragments drifting overhead
        const m = K.box(K.R(-120, 120), K.R(-300, 60), K.R(4, 9), K.R(0.5, 1), K.R(6, 14), K.RP(HULL), { y: K.R(22, 55), collide: false });
        m.rotation.set(K.R(-1, 1), K.R(0, 3), K.R(-1, 1));
      }

      // --- Jetsam of Saturn: field of crashed hulls
      // giant Fallen ketch listing on its side along the west edge
      const ketch = K.box(-66, -55, 16, 14, 62, 0x4e4a5c, { y: -2, collide: false });
      ketch.rotation.z = 0.32;
      K.collider(-74, 0, -86, -58, 12, -24, ketch);
      K.box(-62, -55, 0.4, 0.8, 50, LANT, { y: 8, collide: false, glow: 1 }).rotation.z = 0.32;
      for (const z of [-40, -50, -60, -70]) K.box(-58.6, z, 0.3, 1.2, 2.4, 0xc37aff, { y: 4, collide: false, glow: 1.2 });
      const prow = K.box(-64, -92, 10, 10, 10, 0x3e3a48, { y: -1, collide: false }); prow.rotation.set(0.3, 0.78, 0.32);
      K.collider(-70, 0, -97, -59, 7, -87, prow);
      ribs(K, -64, -14, 0, 16, 14, 3, 4.5);
      // freighter bow buried nose-first
      const bow = K.box(8, -26, 9, 30, 9, 0x6a6a70, { y: -4, collide: false }); bow.rotation.set(0.55, 0.3, 0);
      K.collider(2, 0, -34, 14, 9, -20, bow);
      K.box(8, -26, 9.2, 1.2, 9.2, 0xb8a060, { y: 6, collide: false }).rotation.set(0.55, 0.3, 0);
      // engine section on its side
      const eng = K.mesh(geo().cyl, 0x5c5a66, -20, 5, -82, { rz: Math.PI / 2 }); eng.scale.set(5, 15, 5);
      K.collider(-27.5, 0, -87, -12.5, 9, -77, eng);
      K.mesh(geo().cyl, LANT, -12.4, 5, -82, { rz: Math.PI / 2, glow: 0.8 }).scale.set(3.6, 0.3, 3.6);
      // smaller wreck east
      skiff(K, 56, -30, 0.7, 2.4);
      ribs(K, 46, -60, 1.2, 12, 10, 2, 5);
      // debris across the field
      for (const [x, z, w, al, ln] of [[-46, -30, 8, true, 0.4], [-14, -50, 7, false, -0.35], [-38, -64, 6, true, -0.5], [-20, -24, 5, false, 0.5], [-46, -50, 5, false, 0.3], [-8, -38, 6, true, 0.3]]) plate(K, x, z, w, K.R(3, 5), 0.5, al, ln);
      for (const [x, z] of [[-58, 8], [-4, 4], [24, 0], [40, -8], [-50, -10], [30, -50], [10, -60]]) plate(K, x, z, K.R(5, 9), K.R(3, 6), 0.6, K.chance(0.5), K.R(-0.5, 0.5));
      for (let i = 0; i < 6; i++) { // small fires
        const a = K.R(0, 6.28), r = K.R(8, 20), x = -30 + Math.sin(a) * r, z = -45 + Math.cos(a) * r;
        K.cone(x, z, 0.5, 1.1, LANT, { glow: 2, collide: false });
      }
      K.scatter((x, z) => K.rock(x, z, K.R(1, 2)), -30, -45, 8, 18, 4, 2);
      K.light(-30, 4, -45, LANT, 8, 26);

      // --- Scorn encampment: bone/scrap totems behind a spiked barricade, ether glow
      const sx = 26, sz = -96;
      for (const [x, z, a] of ringAround(sx, sz, 24, 14, (a) => (a > 4.9 && a < 5.9) || (a > 3.3 && a < 4.3))) {
        const alongX = Math.abs(Math.cos(a)) > 0.7;
        if (K.inBounds(x, z, 3)) spikes(K, x, z, 6, alongX);
      }
      for (const [x, z] of ringAround(sx, sz, 15, 7, null)) totem(K, x + K.R(-2, 2), z + K.R(-2, 2), K.R(5, 8));
      for (const [x, z] of [[sx + 30, sz - 18], [sx + 22, sz + 26], [sx - 26, sz + 14]]) totem(K, x, z, 10);
      for (const [x, z] of [[sx + 8, sz - 4], [sx - 7, sz + 5], [sx + 4, sz + 9]]) etherCan(K, x, z, 0.7, 2);
      for (const [x, z, f] of [[sx + 34, sz + 4, 'w'], [sx + 32, sz - 30, 'w'], [sx - 2, sz - 32, 'n'], [sx + 14, sz + 30, 's']]) {
        if (K.inBounds(x, z, 4)) shanty(K, x, z, 5, 5, 3.5, f, { colors: [0x4a4440, 0x5a524a], lantern: false, poster: 0, upper: 0 });
      }
      for (const [x, z] of [[sx - 12, sz - 10], [sx + 12, sz + 14]]) { // Scorn rag banners
        K.box(x, z, 0.3, 7, 0.3, BONE);
        K.box(x, z + 0.2, 1.5, 4, 0.05, 0x1e2430, { y: 2.6, collide: false });
        K.box(x, z + 0.25, 0.5, 0.5, 0.05, ETHER, { y: 5, collide: false, glow: 2 });
      }
      K.scatter(K.cover, sx, sz, 7, 17, 5, 2);
      K.light(sx + 6, 4, sz - 2, ETHER, 9, 26);
      K.light(sx - 10, 4, sz + 8, 0x8ac8ff, 7, 22);

      // --- the Fanatic's approach: totem procession between leaning hull walls
      for (const [x, z, w, ln] of [[-44, -130, 14, 0.25], [-46, -152, 12, -0.2], [-42, -176, 14, 0.3], [-36, -196, 10, -0.25]]) plate(K, x, z, w, K.R(10, 14), 1, false, ln, HULL[3]);
      for (const [x, z, w, ln] of [[36, -138, 14, -0.3], [32, -160, 12, 0.25], [30, -182, 12, -0.2], [32, -200, 8, 0.2]]) plate(K, x, z, w, K.R(9, 13), 1, false, ln, HULL[3]);
      for (const [x, z] of [[2, -128], [20, -132], [-10, -142], [10, -146], [-22, -150], [4, -170], [-24, -172], [-16, -186], [6, -188]]) totem(K, x, z, K.R(6, 9));
      for (const [x, z] of [[-12, -136], [14, -158], [-26, -160], [-4, -178]]) plate(K, x, z, K.R(4, 6), K.R(2, 3), 0.5, K.chance(0.5), K.R(-0.4, 0.4));
      // chained wreck gate before the arena
      for (const gx of [-12, 12]) { const g = K.box(gx, -200, 3, 16, 3, HULL[0], { collide: true }); g.rotation.z = gx < 0 ? -0.05 : 0.05; }
      chainSpan(K, [-12, 15, -200], [12, 15, -200], 3, 0.2);
      chain(K, -4, 13, -200, 4, 'cage'); chain(K, 5, 12.5, -200, 3, 'hook');
      K.box(0, -200.2, 3, 5, 0.06, 0x1e2430, { y: 6, collide: false });
      K.box(0, -200.3, 1, 1, 0.06, ETHER, { y: 9, collide: false, glow: 2 });
      K.light(0, 8, -196, ETHER, 7, 22);

      // --- Fikrul's ether spire (boss)
      const bx = 0, bz = -234, tz = -241;
      for (const [x, z, a] of ringAround(bx, bz, 30, 18, (a) => a < 0.5 || a > 5.78)) {
        if (!K.inBounds(x, z, 2.5)) continue;
        if (K.chance(0.55)) { const al = Math.abs(Math.cos(a)) > 0.7; plate(K, x, z, K.R(6, 9), K.R(5, 9), 0.8, al, K.R(-0.3, 0.3)); }
        else spikes(K, x, z, 5, Math.abs(Math.cos(a)) > 0.7);
      }
      // the spire: stacked scrap and bone drums wrapped in ether tanks
      K.cyl(bx, tz, 5.5, 3, IRON, { sides: 8 });
      K.cyl(bx, tz, 4.2, 9, 0x6a5040, { y: 3, r2: 3.6, sides: 8, collide: false });
      K.cyl(bx, tz, 4.3, 0.8, ETHER, { y: 11.5, glow: 1.5, collide: false });
      K.cyl(bx, tz, 3.5, 9, BONE, { y: 12, r2: 2.8, sides: 7, collide: false });
      K.cyl(bx, tz, 2.9, 0.7, ETHER, { y: 20.5, glow: 1.5, collide: false });
      K.cyl(bx, tz, 2.6, 10, 0x4e4a5c, { y: 21, r2: 1.4, sides: 6, collide: false });
      const orb = K.mesh(geo().ico, ETHER, bx, 34, tz, { glow: 2.4 }); orb.scale.set(2.8, 2.8, 2.8);
      for (let i = 0; i < 6; i++) { // horns around the crown and tanks wrapped around the shaft
        const a = (i / 6) * 6.28;
        beam(K, [bx + Math.sin(a) * 1.8, 30, tz + Math.cos(a) * 1.8], [bx + Math.sin(a) * 4.5, 36, tz + Math.cos(a) * 4.5], 0.3, BONE);
        K.cyl(bx + Math.sin(a + 0.5) * 4.3, tz + Math.cos(a + 0.5) * 4.3, 0.8, 4, ETHER, { y: 5, glow: 1.3, collide: false });
        beam(K, [bx + Math.sin(a) * 6, -0.3, tz + Math.cos(a) * 6], [bx + Math.sin(a) * 3.2, 14, tz + Math.cos(a) * 3.2], 0.35, BONE);
      }
      // ether tanks on the ground feeding the spire
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2, x = bx + Math.sin(a) * 10, z = tz + Math.cos(a) * 10;
        K.cyl(x, z, 1.5, 5, ETHER, { glow: 1 });
        K.cyl(x, z, 1.7, 0.4, C.metal, { y: 5, collide: false });
        beam(K, [x, 3.5, z], [bx + Math.sin(a) * 4.5, 6, tz + Math.cos(a) * 4.5], 0.3, IRON);
      }
      // cables from the crown down to anchors
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2, x = bx + Math.sin(a) * 18, z = tz + Math.cos(a) * 18;
        if (Math.hypot(x - bx, z - (-220)) < 10) continue;
        K.box(x, z, 1.8, 1.4, 1.8, IRON);
        cable(K, [bx, 28, tz], [x, 1.4, z], 1.5, 0.22, IRON, 4);
      }
      for (const [x, z] of [[-14, -222], [15, -224], [-20, -244], [20, -246], [-8, -256], [9, -258]]) totem(K, x, z, K.R(5, 7));
      for (const [x, z] of [[-17, -232], [18, -236]]) plate(K, x, z, 5, 2.5, 0.5, true, 0.3);
      K.light(bx, 22, tz, ETHER, 12, 44);
      K.light(bx, 5, bz + 8, 0x8ac8ff, 6, 22);
    },
  },
};
