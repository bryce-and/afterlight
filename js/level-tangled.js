// Hand-built Tangled Shore mission maps (see makeKit in world.js).
// ts1: dense scrap shanty town (Thieves' Landing) -> holed rock cove -> junkyard arena.
// ts2: cliffside camp -> towering gorge with chains overhead -> Hive-tainted warrens -> roofed ritual cavern.
// ts3: wide wreck field of crashed hulls -> Scorn camp -> totem procession -> arena around a giant ether spire.
// U15: every boss arena is a walled room (zone `room`) behind a zone-clear K.door; raised catwalks and decks are reached by K.stairs.
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

// Scrapper crane: drum base, tower, jib and a hanging cradle (the Reef silhouette), turned by ry
function crane(K, x, z, h = 16, ry = 0, jib = 14) {
  const P = xf(x, z, ry);
  K.cyl(x, z, 2.6, 2.4, IRON, { sides: 8 });
  K.box(x, z, 1.8, h, 1.8, 0x4a4650);
  K.box(x, z, 3.4, 1.6, 3.4, 0x5a4a44, { y: h - 1.2, collide: false });
  const [jx, jz] = P(0, -jib), [bx, bz] = P(0, 4);
  beam(K, [bx, h - 0.6, bz], [jx, h - 0.4, jz], 0.4, IRON);
  beam(K, [x, h + 4, z], [jx, h - 0.4, jz], 0.1, ROPE);
  beam(K, [x, h + 4, z], [bx, h - 0.6, bz], 0.1, ROPE);
  K.box(x, z, 0.3, 4, 0.3, IRON, { y: h, collide: false });
  chain(K, jx, h - 0.6, jz, 7, 'hook');
  K.box(jx, jz, 1.1, 1.1, 1.1, LANT, { y: h - 2.1, collide: false, glow: 1.8 });
}

// a solid hull wall along z in 7 m runs (so it sits on the slope), with leaning plating and a Fallen stripe; gaps are [zA, zB] world values
function hullWall(K, x, z0, z1, h, o = {}) {
  const t = o.t ?? 3, side = o.side ?? 1, hi = Math.max(z0, z1), lo = Math.min(z0, z1);
  let spans = [[lo, hi]];
  for (const [ga, gb] of o.gaps || []) {
    const g0 = Math.min(ga, gb), g1 = Math.max(ga, gb);
    spans = spans.flatMap(([a, b]) => (g1 <= a || g0 >= b ? [[a, b]] : [[a, Math.min(b, g0)], [Math.max(a, g1), b]].filter(([p, q]) => q - p > 0.5)));
  }
  for (const [a, b] of spans) {
    const n = Math.max(1, Math.round((b - a) / 7)), L = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const cz = a + L * (i + 0.5), ht = h * K.R(0.85, 1.1), col = K.RP(o.colors || HULL);
      K.box(x, cz, t, ht, L, col);
      const p = K.box(x + side * (t / 2 + 0.15), cz, 0.3, ht * 0.7, L * 0.9, K.RP(o.colors || HULL), { y: 0.2, collide: false });
      p.rotation.z = -side * K.R(0.04, 0.16);
      if (K.chance(0.4)) K.box(x + side * (t / 2 + 0.34), cz, 0.08, 0.3, L * 0.7, LANT, { y: ht * 0.45, collide: false, glow: 0.8 });
    }
  }
}

// a stack of crates in a loose heap
function crateHeap(K, x, z) {
  K.crate(x, z); K.crate(x + 1.7, z + 0.4); K.crate(x + 0.6, z - 1.6);
}

// the walls and floor details of a small interior (shop, hull passage): lamp, counter and a few crates
function interior(K, x, z, w, d, lamp = LANT) {
  K.light(x, 3, z, lamp, 6, 14);
  K.box(x, z - d / 2 + 1.1, w * 0.55, 1.0, 0.9, K.RP(SCRAP));
  K.box(x, z - d / 2 + 0.5, w * 0.5, 0.2, 0.1, lamp, { y: 1.8, collide: false, glow: 1.2 });
}

// ---------------------------------------------------------------- missions

export default {
  // ------------------------------------------------ ts1: The Trickster (dusk)
  // Rhythm: the landing pad > Cutpurse Row climbs the shanty hillside (traversal, the market fight begins at the top) > Thieves' Landing
  // (market shelf, two shops to cut through, a rooftop stair) > the descent between the Spider's arch rocks (traversal) > Four-Holed Cove
  // (low cove, east shelf, a smugglers' tunnel) > the ramp through the holed wall up into the Trickster's raised scrapyard.
  ts1: {
    spawn: [0, 20],
    noEdge: true,
    bounds: [-70, 75, -228, 32],
    zones: [
      { name: "Thieves' Landing", x: 0, z: -50 },
      { name: 'Four-Holed Cove', x: 36, z: -116 },
      { name: "The Trickster's Scrapyard", x: 10, z: -186, boss: true, room: { minX: -21, maxX: 41, minZ: -220, maxZ: -150 } },
    ],
    // a Reef dusk: Saturn low and huge, a hot pink horizon, hanging rocks lit from below
    sky: {
      zenith: 0x24184a, mid: 0xa04a78, horizon: 0xffa468, floor: 0x3a2030, fog: 0xb0708c,
      stars: { n: 140, color: 0xffe8f0, size: 2, min: 0.5 },
      bodies: [{ color: 0xf0c8a0, size: 120, pos: [-300, 100, -430], ring: true, bands: [0xf0c8a0, 0xd09a70, 0xf4d8b8, 0xc8885c] }],
      haze: [{ color: 0xff9a68, opacity: 0.5, r: 470, h: 110, y: -10 }],
      clouds: { n: 10, color: 0xff9a8a, opacity: 0.55, y: [70, 150], size: 22 },
      floaters: [{ kind: 'island', n: 14, r: [300, 620], y: [20, 170], size: [16, 56], color: 0x4a2a48, haze: 0.35 }],
    },
    // The town is bolted to an asteroid shelf: the alleys climb to the market, the market steps down to the cove, the scrapyard is raised
    terrain: [
      { type: 'plateau', x: -4, z: -50, w: 100, d: 56, h: 4, edge: 6 },                          // Thieves' Landing shelf
      { type: 'ramp', x0: 0, z0: 10, x1: 0, z1: -24, width: 66, h0: 0, h1: 4, edge: 6 },        // Cutpurse Row, the whole hillside climbs
      { type: 'plateau', x: 68, z: -122, w: 14, d: 34, h: 4.8, edge: 3 },                       // the cove's east shelf
      { type: 'plateau', x: 10, z: -183, w: 66, d: 80, h: 3, edge: 3 },                          // the scrapyard floor
      { type: 'plateau', x: 10, z: -209, w: 24, d: 12, h: 5.6, edge: 2.5 },                      // Araskes's stage
      { type: 'ramp', x0: 32, z0: -72, x1: 32, z1: -104, width: 10, h0: 4, h1: 0, edge: 4 },    // the descent to the cove
      { type: 'ramp', x0: 52, z0: -124, x1: 64, z1: -124, width: 6, h0: 0, h1: 4.8, edge: 3 },  // up to the east shelf
      { type: 'ramp', x0: 20, z0: -122, x1: 20, z1: -146, width: 8, h0: 0, h1: 3, edge: 3 },    // through the door of the holed wall
      { type: 'ramp', x0: 10, z0: -188, x1: 10, z1: -203, width: 8, h0: 3, h1: 5.6, edge: 2.5 }, // up to the stage
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
      banner(K, -5, 9, 7); banner(K, 5, 9, 7);
      for (const [x, z] of [[-55, -4], [-60, -22], [56, -6], [62, -24], [-52, 26], [55, 28]]) K.prop(x, z);
      K.rock(-62, 8, 4.5); K.rock(64, 10, 5);

      // --- Cutpurse Row: shanty rows up the hillside, the main alley x -5.5..5.5, side alleys beyond
      packBlock(K, -19, -5.5, -22, 6, { face: 'e', poster: 0.35 });
      packBlock(K, 5.5, 19, -22, 6, { face: 'w', poster: 0.35 });
      packBlock(K, -33, -24, -20, 2, { face: 'e', skip: 0.25 });
      packBlock(K, 24, 33, -20, 2, { face: 'w', skip: 0.25 });
      for (let z = 0; z > -24; z -= 11) lanternString(K, [-5.2, 5.5, z], [5.2, 5.2, z - 2], 3, 0.8);
      lanternString(K, [-23.5, 5, -4], [-18, 5, -12], 3, 0.6);
      lanternString(K, [19, 5, -8], [24.5, 5, -16], 3, 0.6);
      banner(K, -5.5, -22, 6.5); banner(K, 5.5, -22, 6.5);

      // --- Thieves' Landing: market shelf (flat, h 4). Two shops flank the top of the alley; the east shop has a stair to its roof.
      K.room(-15, -35.5, 9, 8, 4.4, { t: 0.5, doors: { e: 3, n: 3 }, roof: true, color: 0x6a5048, roofColor: 0x4e4650 });
      interior(K, -15, -35.5, 9, 8);
      K.box(-18.2, -37, 0.8, 1.2, 3, 0x7a5a48); K.crate(-17.5, -33.5);
      K.room(15, -35.5, 9, 8, 4.4, { t: 0.5, doors: { w: 3, n: 3 }, roof: true, color: 0x5a4a52, roofColor: 0x4e4650 });
      interior(K, 15, -35.5, 9, 8, 0xc37aff);
      K.box(18.2, -34, 0.8, 1.2, 3, 0x7a5a48); K.crate(17.5, -37.8);
      K.stairs(27.6, -35.5, 'w', 3, 5, { color: C.metal }); // the rooftop stair: the roof (5 m) is a player-only perch over the alley
      lanternString(K, [15, 7, -40], [-15, 7, -40], 5, 1.6);
      K.box(-18.2, -39.84, 2.2, 0.8, 0.1, 0x3a2a3a, { y: 3.2, collide: false }); K.box(18.2, -39.84, 2.2, 0.8, 0.1, 0xb83a2a, { y: 3.2, collide: false }); // shop signs
      // the square: stalls in two rows and a loose cluster, not a ring
      for (const [x, z, f] of [[-24, -68, 's'], [-12, -70, 's'], [4, -68, 's'], [18, -70, 's'], [31, -56, 'w'], [31, -44, 'w'], [-30, -33, 'e']]) stall(K, x, z, f);
      for (const [x, z] of [[-14, -50], [11, -56], [8, -47], [-4, -63], [20, -50]]) crateHeap(K, x, z);
      crane(K, -9, -60, 18, 2.4, 12); // the hoist that lowers cargo from the Spider's floating warehouse
      for (const [x, z] of [[-26, -36], [26, -34], [-22, -66], [28, -66], [2, -76]]) { // lantern poles
        K.box(x, z, 0.4, 8, 0.4, C.metal);
      }
      lanternString(K, [-26, 7.8, -36], [-22, 7.8, -66], 5, 2);
      lanternString(K, [28, 7.8, -66], [26, 7.8, -34], 5, 2);
      lanternString(K, [-22, 7.8, -66], [2, 7.8, -76], 4, 1.4);
      lanternString(K, [2, 7.8, -76], [28, 7.8, -66], 4, 1.4);
      K.light(0, 7, -50, LANT, 9, 32);
      // the Spider's den: a stacked scrap hall on the west edge of the shelf, its lookout deck beside it
      K.box(-44, -52, 18, 6, 20, 0x5a4a44);
      K.box(-45, -52, 13, 5, 15, 0x6a5a50, { y: 6 });
      K.box(-46, -52, 8, 4, 10, 0x4e4a54, { y: 11 });
      K.box(-46, -52, 9, 0.3, 11, IRON, { y: 15, collide: false }).rotation.z = 0.12;
      K.box(-34.9, -52, 0.1, 3.4, 4.4, DARK, { collide: false });
      K.box(-33, -52, 4, 0.15, 9, 0x5a3a7a, { y: 4, collide: false }).rotation.z = -0.15;
      banner(K, -33, -46.5, 9, true); banner(K, -33, -57.5, 9, true);
      K.box(-41.8, -52, 0.3, 1, 3, LANT, { y: 12, collide: false, glow: 1.5 });
      K.light(-31, 5, -52, 0xffb060, 7, 18);
      K.platform(-27, -50, 8, 14, 2.4, { stairs: ['e'], stairW: 3, color: 0x5a4a44 }); // the Spider's lookout deck
      lanternString(K, [-31, 5, -57], [-23, 5, -43], 4, 0.6);
      // bolted to the asteroid: cables run from the shelf to hanging rocks
      anchor(K, -44, -72, [-58, 50, -92]);
      floater(K, -58, 50, -92, 7, 0);
      anchor(K, 40, -24, [58, 40, -8]);
      floater(K, 58, 42, -8, 6, 0);
      // the shelf's back edge and the descent
      for (const [x, z, w, d] of [[-30, -88, 22, 16], [-8, -90, 20, 14], [12, -88, 14, 14], [-52, -86, 20, 20]]) K.box(x, z, w, K.R(8, 13), d, K.RP([C.rock, C.rock2]));
      cliffRun(K, -62, -60, -98, -1, 8, 14, { jog: 2 });
      for (const [x, z] of [[-58, -34], [-60, -70]]) K.rock(x, z, K.R(3.5, 5));
      for (const [x, z, w, d] of [[17, -90, 12, 22], [47, -90, 12, 24], [52, -66, 12, 14]]) K.box(x, z, w, K.R(9, 13), d, K.RP([C.rock, C.rock2]));
      for (const [x, z] of [[56, -36], [62, -54], [60, -80], [64, -20]]) junkPile(K, x, z, K.R(3.5, 5.5));
      for (const [x, z] of [[-50, -30], [40, -70]]) banner(K, x, z, 6);

      // --- the Spider's arch, then Four-Holed Cove (floor at 0 under the shelf)
      K.box(24, -98, 3.5, 11, 3.5, C.rock); K.box(40, -98, 3.5, 12, 3.5, C.rock2);
      K.box(32, -98, 20, 4, 4.5, C.rock, { y: 11 });
      K.rock(32, -98, 3, { y: 13.5, collide: false });
      K.box(46, -122, 22, 0.2, 20, 0x2c3448, { collide: false }); // dark tide pool
      for (const [x, z] of [[40, -126], [52, -132], [28, -134]]) K.rock(x, z, K.R(1.8, 2.8));
      skiff(K, 52, -108, 1.2, 1.1);
      for (const [x, z, w, d] of [[34, -134, 7, 1.2], [14, -122, 1.2, 6], [26, -112, 5, 1.2], [44, -140, 6, 1.2]]) K.box(x, z, w, 1.4, d, K.RP(SCRAP)); // cover walls of scrap plate
      for (const [x, z] of [[30, -128], [46, -110], [18, -136]]) crateHeap(K, x, z);
      shanty(K, 10, -108, 6, 5, 4, 'e', { poster: 1 }); // smuggler hut
      cliffRun(K, -22, -100, -146, -1, 10, 18, { jog: 4 }); // rock mass west of the cove
      for (const [x, z] of [[-10, -108], [2, -128], [-4, -118]]) K.rock(x, z, K.R(2, 3.5));
      // the great holed wall closing the cove (four holes; the door hole is the way on, the east hole is a smugglers' tunnel)
      holedWall(K, 'x', -147, -22, 75, 15, 5, [[-8, -2, 5, 10], [16, 24, 0, 8.5], [42, 48, 6, 11], [57, 64, 0, 9.5]]);
      lanternString(K, [16, 6, -143], [24, 6, -143], 3, 0.5);
      anchor(K, 66, -100, [80, 40, -112]);
      floater(K, 80, 42, -112, 6, 0);
      // the smugglers' tunnel behind the east hole: a cache nook (mines at the mouth), closed by rock
      K.box(71.5, -160, 6, 12, 26, C.rock2); K.box(59.5, -192, 29, 14, 40, C.rock); K.box(48, -157, 5, 12, 12, C.rock2);
      for (const [x, z] of [[58, -153], [62, -156], [60, -159], [64, -153]]) minePod(K, x, z, 0xff5a2a);
      for (const [x, z] of [[54, -166], [64, -168]]) crateHeap(K, x, z);
      skiff(K, 60, -170, 0.2, 1.2);
      K.light(60, 5, -162, LANT, 6, 18);

      // --- the Trickster's scrapyard (boss): walled in by rock on the raised floor, the 8 m door in the holed wall opens when the cove is clear
      const bx = 10, bz = -186;
      K.wall(-22, -221, -22, -150, 14, { t: 2, color: C.rock });
      K.wall(-22, -221, 42, -221, 14, { t: 2, color: C.rock });
      K.wall(42, -221, 42, -150, 14, { t: 2, color: C.rock2 });
      for (let a = -216; a < -154; a += K.R(7, 11)) {
        K.box(-22, a, 2.6, K.R(2, 5), K.R(3, 6), C.rock2, { y: 14, collide: false });
        K.box(42, a + 3, 2.6, K.R(2, 5), K.R(3, 6), C.rock, { y: 14, collide: false });
      }
      for (let a = -14; a < 40; a += K.R(7, 11)) K.box(a, -221, K.R(3, 6), K.R(2, 5), 2.6, C.rock, { y: 14, collide: false });
      K.door(20, -147, 8, 8.5, 'x', { zone: 1, t: 2.5, color: 0x5a4a44, trim: LANT });
      K.light(20, 6, -153, LANT, 8, 20);
      // wreck rows: two broken lines of stacked hulls make three lanes (west scrap lane, the centre minefield lane, the east lane)
      const stack = (x, z, w, d, h, ry) => {
        K.obox(x, z, w, h, d, ry, K.RP(HULL));
        K.obox(x + K.R(-0.6, 0.6), z + K.R(-1, 1), w * 0.7, h * 0.6, d * 0.45, ry, K.RP(SCRAP), { y: h });
        K.box(x, z, w + 0.1, 0.3, 0.1, LANT, { y: h * 0.5, collide: false, glow: 0.8 });
      };
      for (const [x, z, w, d, h, ry] of [[-3, -163, 6, 12, 3.2, 0.05], [-4, -184, 6.5, 18, 4.4, -0.04], [-2, -206, 6, 13, 3.2, 0.08],
        [25, -165, 6, 10, 3.2, -0.06], [27, -183, 7, 16, 4.4, 0.05], [25, -203, 6, 15, 3.2, -0.05]]) stack(x, z, w, d, h, ry);
      // the minefield strip down the centre lane (the Trickster's mines, in a staggered line rather than scattered)
      for (let i = 0; i < 9; i++) minePod(K, bx + (i % 2 ? 2.6 : -2.6) + (i % 3) * 0.4, -166 - i * 3.6, K.RP([0xff5a2a, 0xff5a2a, LANT, 0xc37aff]));
      for (let i = 0; i < 3; i++) minePod(K, 33 + i * 2.5, -198, 0xff5a2a);
      // west lane: raised scrap gantry (a player-only perch) and loose heaps; east lane: a wrecked skiff and crates
      K.platform(-15, -186, 6, 24, 2.4, { stairs: ['e'], stairW: 3, color: 0x5a4a44 });
      for (const z of [-197, -175]) K.box(-17.5, z, 0.2, 2.2, 0.2, K.C.metal, { y: 2.4, collide: false });
      K.box(-12.1, -186, 0.12, 0.12, 24, IRON, { y: 3.4, collide: false });
      for (const [x, z, r] of [[-18, -160, 4], [-17, -213, 5], [-9, -216, 3.5]]) junkPile(K, x, z, r);
      skiff(K, 36, -176, 1.57, 1.3);
      crateHeap(K, 36, -160); crateHeap(K, 35, -212);
      for (const [x, z] of [[-9, -172], [-9, -198], [17, -158]]) K.crate(x, z);
      // Araskes's stage: the raised scrap dais at the north end with banners and a bounty board
      for (const sx of [-1, 1]) K.box(bx + sx * 11.6, -209, 0.6, 2.2, 12, K.C.metal, { collide: false, y: 0 });
      banner(K, bx - 8, bz - 21, 7); banner(K, bx + 8, bz - 21, 7);
      K.box(bx, -214.3, 12, 3.4, 0.4, 0x4a3a30);
      for (const dx of [-4, -1.4, 1.4, 4]) poster(K, bx + dx, 1.6, -214.0, false, 1);
      // scrap crane and its magnet over the yard
      crane(K, -18, -208, 24, -2.16, 21.6);
      K.cyl(0, -196, 2.2, 0.8, 0xc33a2a, { y: 15, collide: false, glow: 1.4 });
      K.light(bx, 7, bz, LANT, 10, 34);
      K.light(bx, 4, -207, 0xff5a2a, 8, 20);
    },
  },

  // ------------------------------------------------ ts2: The Mindbender (night)
  // Rhythm: spawn meadow > the climb to Trapper's Cave (camp on a ledge, a cave tunnel flank) > a causeway down into the Rift (traversal) > the gorge floor
  // fight with ledges and a rope bridge overhead (combat during traversal) > the climb into the Hive-tainted Warrens (huts on a raised shelf, a mound at the
  // centre) > the long ramp down to the sealed ritual cavern (the lowest point, a roofed room with a back shelf).
  ts2: {
    spawn: [6, 18],
    noEdge: true,
    bounds: [-55, 55, -282, 30],
    zones: [
      { name: "Trapper's Cave", x: -12, z: -40 },
      { name: 'The Rift', x: 0, z: -112 },
      { name: 'Hive-Tainted Warrens', x: 10, z: -183 },
      { name: "The Mindbender's Cavern", x: 0, z: -250, boss: true, room: { minX: -26, maxX: 26, minZ: -274, maxZ: -226 } },
    ],
    // a moonless night: faint Saturn, a Hive-green haze low on the horizon, dark rocks drifting
    sky: {
      zenith: 0x03030a, mid: 0x120e2a, horizon: 0x2c2252, floor: 0x120e1c, fog: 0x1a1432,
      stars: { n: 800, color: 0xdcd0ff, size: 2.2, min: 0.04 },
      bodies: [{ color: 0x9a8a9a, size: 60, pos: [260, 200, -480], ring: true, bands: [0x8a7a8a, 0x6a5a70, 0x9a8a98] }],
      haze: [{ color: 0x4aff8a, opacity: 0.12, r: 470, h: 70, y: -6 }],
      aurora: [{ color: 0x7a5aff, y: 170, r: 560, h: 150, arc: [0.4, 2.4], opacity: 0.2, waves: 4 }],
      floaters: [{ kind: 'island', n: 14, r: [320, 640], y: [20, 190], size: [18, 58], color: 0x1c1830, haze: 0.4 }],
    },
    // The camp sits on a ledge; the Rift is the low gorge between two tall walls; the Warrens are a shelf; the cavern is the floor again.
    // Plateaus are listed before the ramps that join them.
    terrain: [
      { type: 'plateau', x: -8, z: -42, w: 76, d: 52, h: 5, edge: 5 },                           // Trapper's ledge
      { type: 'plateau', x: -36, z: -117, w: 26, d: 68, h: 16, edge: 3 },                        // the Rift's west wall
      { type: 'plateau', x: 36, z: -117, w: 26, d: 68, h: 18, edge: 3 },                         // the Rift's east wall
      { type: 'plateau', x: -20, z: -124, w: 8, d: 14, h: 6, edge: 3 },                          // west ledge, notched into the wall
      { type: 'plateau', x: 20, z: -124, w: 8, d: 14, h: 6, edge: 3 },                           // east ledge, notched into the wall
      { type: 'plateau', x: 2, z: -183, w: 80, d: 50, h: 6, edge: 5 },                           // the Warrens' shelf
      { type: 'mound', x: 10, z: -183, r: 9, h: 1.8 },                                           // the egg mound
      { type: 'plateau', x: -6, z: -266, w: 24, d: 10, h: 3.6, edge: 2 },                        // the cavern's back shelf
      { type: 'ramp', x0: 8, z0: 10, x1: 6, z1: -16, width: 8, h0: 0, h1: 5, edge: 4 },          // climb from the spawn meadow to the camp
      { type: 'ramp', x0: -6, z0: -64, x1: 0, z1: -100, width: 8, h0: 5, h1: 0, edge: 4 },      // the causeway down into the gorge
      { type: 'ramp', x0: -4, z0: -102, x1: -18, z1: -118, width: 5, h0: 0, h1: 6, edge: 3 },    // up to the west ledge
      { type: 'ramp', x0: 12, z0: -146, x1: 18, z1: -131, width: 5, h0: 0, h1: 6, edge: 3 },     // up to the east ledge, from the far end
      { type: 'ramp', x0: -2, z0: -142, x1: -2, z1: -160, width: 8, h0: 0, h1: 6, edge: 4 },     // out of the gorge, into the Warrens
      { type: 'ramp', x0: 0, z0: -200, x1: 0, z1: -226, width: 12, h0: 6, h1: 0, edge: 4 },      // down to the cavern door
      { type: 'ramp', x0: 10, z0: -244, x1: -2, z1: -262, width: 6, h0: 0, h1: 3.6, edge: 2 },   // the long way up to the shelf
      { type: 'ramp', x0: -22, z0: -252, x1: -15, z1: -262, width: 5, h0: 0, h1: 3.6, edge: 2 }, // the short, steep way
    ],
    build(K) {
      const C = K.C;
      sky(K, 16, { yMin: 30, yMax: 70, chainP: 0.45, links: 5, small: 12 });
      K.edge((x, z, y) => (K.chance(0.6) ? K.rock(x, z, K.R(3, 8), { y, collide: false }) : K.prop(x, z, y, false)), 40);

      // --- spawn meadow and the climb: a cliff to the west, rock to the east
      cliffRun(K, -46, 30, -14, -1, 16, 26);
      K.box(-52, -48, 6, 16, 70, C.rock2); // seals the strip beyond the camp's west rim
      for (const [x, z, w, d] of [[44, -36, 22, 56], [44, -4, 20, 24], [50, -72, 12, 22], [-52, -86, 6, 24]]) K.box(x, z, w, K.R(12, 16), d, K.RP([C.rock, C.rock2]));
      for (const [x, z] of [[40, 18], [-30, 12], [-44, 20], [26, -8]]) K.rock(x, z, K.R(3, 5));
      for (const [x, z] of [[-12, 4], [18, 8]]) K.crate(x, z);
      banner(K, 2, 4, 7); banner(K, 11, 4, 7);

      // --- Trapper's Cave: the camp on its ledge, the cave tunnel through the west rim
      cliffRun(K, -46, -17, -68, -1, 14, 22);
      K.room(-38, -52, 10, 22, 6.5, { t: 1.2, doors: { s: 4, n: 4 }, roof: true, color: C.rock2, roofColor: C.rock }); // the tunnel (a flank: camp to the causeway rim)
      K.platform(-40.8, -53, 2.6, 10, 2.2, { stairs: ['s'], stairW: 2.4, color: C.rock });  // an inner ledge over the tunnel
      K.box(-38, -52, 7, 0.15, 19, 0x2a2228, { collide: false });
      etherCan(K, -35, -44); etherCan(K, -35.8, -46.2, 0.5, 1.4);
      K.crate(-36, -58); K.crate(-34.6, -57);
      chain(K, -38, 6.5, -47, 2.5, 'cage'); chain(K, -38, 6.5, -57, 2.2, 'cage');
      K.light(-38, 4, -52, LANT, 8, 18);
      K.light(-38, 4, -45, HIVE, 4, 10);
      // the camp, packed round its fire; the east half of the ledge stays an open firing lane with a few rocks and cages
      K.cone(-20, -40, 0.8, 1.2, LANT, { glow: 2, collide: false });
      for (let i = 0; i < 6; i++) K.box(-20 + Math.sin(i) * 1.2, -40 + Math.cos(i) * 1.2, 0.5, 0.35, 0.5, C.rock2, { collide: false });
      for (const [x, z] of [[-29, -33], [-29, -46], [-17, -29], [-25, -56]]) K.cone(x, z, 2.6, 3.2, K.RP(CLOTH), { sides: 4 });
      for (const [x, z] of [[-27, -40], [-14, -50]]) { // pelt and net racks
        K.box(x, z - 1.6, 0.2, 2.6, 0.2, C.metal); K.box(x, z + 1.6, 0.2, 2.6, 0.2, C.metal);
        K.box(x, z, 0.1, 0.12, 3.4, C.metal, { y: 2.5, collide: false });
        K.box(x, z, 0.05, 1.6, 2.8, 0x6a5a4a, { y: 0.8, collide: false });
      }
      for (const [x, z] of [[2, -24], [-6, -60], [8, -56]]) { // trapper's cages
        K.box(x, z, 2, 0.15, 2, IRON, { y: 2.2, collide: false });
        for (const sx of [-0.9, 0.9]) for (const sz of [-0.9, 0.9]) K.box(x + sx, z + sz, 0.12, 2.2, 0.12, IRON, { collide: false });
        K.collider(x - 1, 0, z - 1, x + 1, 2.3, z + 1, null);
      }
      for (const sx of [-1.4, 1.4]) for (const sz of [-1.4, 1.4]) K.box(16 + sx, -34 + sz, 0.4, 7, 0.4, C.metal); // a trapper's watchtower, the camp's landmark
      K.box(16, -34, 4.4, 0.3, 4.4, K.RP(SCRAP), { y: 7, collide: false }); K.box(16, -34, 3, 1.8, 3, 0x5a4a44, { y: 7.3, collide: false });
      K.box(16, -32.4, 0.5, 0.5, 0.2, LANT, { y: 8.4, collide: false, glow: 1.8 }); chain(K, 17.6, 7, -34, 3, 'cage');
      for (const [x, z, s] of [[-6, -33, 1.8], [2, -46, 2.2], [10, -37, 1.6], [16, -48, 2], [-1, -20, 1.5]]) K.rock(x, z, s);
      banner(K, -33, -34, 7, true); banner(K, -33, -48, 7, true);
      shanty(K, 22, -30, 6, 5, 4, 'w', { poster: 1, hive: 0 });
      shanty(K, 21, -56, 5, 6, 4.5, 'w');
      anchor(K, 28, -22, [46, 45, -36]);
      floater(K, 46, 45, -36, 8, 0.5);

      // --- The Rift: a long gorge between two tall walls (terrain), chains and a rope bridge overhead, ledges to climb for the high ground
      for (let z = -84; z > -150; z -= K.R(8, 11)) { // rock crowns and overhanging lips along both rims
        K.box(-31, z, K.R(7, 12), K.R(2, 6), 8, K.RP([C.rock, C.rock2]));
        K.box(32, z - 2, K.R(7, 12), K.R(2, 6), 8, K.RP([C.rock, C.rock2]));
        K.box(-21.8, z - 4, 3.2, 3, 7, C.rock2, { y: 12.5, abs: true, collide: false });
        K.box(21.8, z - 1, 3.2, 3, 7, C.rock, { y: 14.5, abs: true, collide: false });
      }
      for (const z of [-86, -100, -120, -142]) {
        chainSpan(K, [-22, K.R(17, 20), z], [22, K.R(17, 20), z + K.R(-4, 4)], K.R(3, 5));
        chain(K, K.R(-8, 8), 18, z, K.R(3, 6), K.RP(['cage', 'lantern', 'hook']));
      }
      // the rope bridge between the ledges at 6 m (a thin deck: the gorge floor stays open under it)
      K.box(0, -124, 32, 0.5, 3.2, 0x5a4a3a, { y: 5.5 });
      for (const rz of [-122.5, -125.5]) cable(K, [-16, 7.2, rz], [16, 7.2, rz], 1.0, 0.07);
      for (const x of [-16, -8, 0, 8, 16]) for (const rz of [-122.5, -125.5]) K.box(x, rz, 0.14, 1.3, 0.14, ROPE, { y: 6, collide: false });
      K.box(0, -124, 1.2, 0.5, 1.2, LANT, { y: 7.5, collide: false, glow: 1.4 });
      // floor cover, placed along the lanes: rocks, scrap plates and a wrecked skiff
      for (const [x, z, s] of [[-12, -92, 2.2], [11, -98, 2.6], [-9, -110, 1.8], [14, -118, 2.2], [-12, -134, 2.4], [-2, -148, 2]]) K.rock(x, z, s);
      for (const [x, z, w, d] of [[-5, -96, 5, 0.8], [6, -108, 0.8, 5], [-4, -126, 4, 0.8], [8, -136, 5, 0.8]]) K.box(x, z, w, 1.6, d, K.RP(SCRAP));
      skiff(K, -13, -144, 0.3, 1);
      for (const [x, z] of [[-18, -92], [18, -108], [-17, -146]]) { // wall lamps
        K.box(x, z, 0.3, 4, 0.3, C.metal); K.box(x, z, 0.5, 0.5, 0.5, LANT, { y: 4, collide: false, glow: 2 });
      }
      // the ledges: a sniper nest on the west, a brazier and cages on the east
      K.crate(-21, -127); K.crate(-22.4, -125.8); K.box(-22.5, -120, 0.4, 3, 6, 0x5a3a7a, { collide: false });
      K.cyl(21, -127, 0.7, 1, IRON, { sides: 6 }); K.cone(21, -127, 0.5, 1, LANT, { y: 1, glow: 2, collide: false });
      chain(K, 21, 14, -120, 4, 'cage');
      K.light(0, 12, -112, LANT, 8, 34);
      K.light(0, 9, -124, 0xc37aff, 5, 22);
      anchor(K, -36, -80, [-44, 46, -90]);
      floater(K, -44, 46, -90, 7, 0.5);

      // --- Hive-tainted Warrens: three clusters of huts on the shelf, a central chamber with an egg mound, narrow lanes between
      for (const [cx, cz] of [[-1.5, -174]]) { // a scrap canopy over the entrance lane
        for (const sx of [-5, 5]) for (const sz of [-4, 4]) K.box(cx + sx, cz + sz, 0.5, 9, 0.5, C.metal);
        K.box(cx, cz, 13, 0.4, 10, 0x4a4440, { y: 9, collide: false }).rotation.x = 0.05;
        hiveGrowth(K, cx + 3, cz, 1.6, 9.3);
        chain(K, cx, 9, cz - 3, 3, 'lantern');
      }
      const warren = [[-9, -166, 5, 5, 'e'], [-18, -172, 7, 5, 's'], [-14, -183, 5, 7, 'e'], [-26, -181, 6, 6, 'e'], [-16, -196, 7, 5, 'e'], [-28, -194, 5, 6, 'e'], [-9, -202, 5, 4, 'n'],
        [6, -166, 5, 5, 'w'], [20, -168, 6, 5, 'w'], [24, -181, 5, 7, 'w'], [33, -175, 6, 6, 'w'], [22, -195, 7, 5, 'w'], [34, -190, 5, 6, 'w'], [12, -204, 6, 4, 'n']];
      for (const [x, z, w, d, f] of warren) shanty(K, x, z, w, d, K.R(3.2, 5), f, { hive: 0.9, colors: [0x4e5050, 0x5a4a40, 0x44484e], awning: 0.1, upper: 0.15 });
      // the egg mound: a chitin dome with a green heart, eggs clustered at its foot and inside the huts
      K.mesh(new THREE.SphereGeometry(4, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), CHITIN, 10, 0, -183, { collide: 0.8 });
      K.mesh(new THREE.SphereGeometry(1.6, 6, 4), HIVE, 10, 3.2, -183, { glow: 1.6 });
      for (const [x, z] of [[5, -180], [6, -187], [14.5, -179], [15, -187], [10, -190], [10, -176], [-14, -186], [26, -183], [22, -197], [-18, -198]]) {
        const e = K.mesh(geo().ico, 0xa8d880, x, 0.5, z, { glow: 0.5 }); e.scale.set(0.6, 0.9, 0.6);
      }
      for (const [x, z, s] of [[-4, -176, 1.4], [14, -170, 1.2], [3, -196, 1.5], [18, -188, 1.1], [30, -184, 1]]) hiveGrowth(K, x, z, s, 0, true);
      for (const [x, z] of [[-1, -186], [26, -203]]) { // chitin arches over two lane mouths
        beam(K, [x - 3, 0, z], [x - 1, 7, z], 0.6, CHITIN); beam(K, [x + 3, 0, z], [x + 1, 7, z], 0.6, CHITIN);
        beam(K, [x - 1, 7, z], [x + 1, 7, z], 0.6, CHITIN);
        K.collider(x - 3.6, 0, z - 0.6, x - 2.4, 4, z + 0.6, null); K.collider(x + 2.4, 0, z - 0.6, x + 3.6, 4, z + 0.6, null);
      }
      K.light(10, 6, -184, HIVE, 8, 26);
      K.light(-1, 5, -172, HIVE, 5, 18);
      cliffRun(K, -42, -160, -208, -1, 14, 22);
      cliffRun(K, 44, -160, -208, 1, 14, 22);
      K.box(-17, -215, 20, 12, 6, C.rock); K.box(18, -215, 22, 12, 6, C.rock2); // close the north rim either side of the ramp

      // --- the Mindbender's ritual cavern (roofed), the lowest point of the mission
      const bx = 0, bz = -250;
      K.room(bx, bz, 56, 52, 14, { t: 2.4, color: C.rock2, doors: { s: 12 }, roof: true, roofColor: C.rock });
      K.door(0, -224, 12, 14, 'x', { zone: 2, t: 2.4, color: C.rock2, trim: HIVE }); // the cavern seals until the warrens are clear
      for (const [x, z, s] of [[-18, -258, 14], [16, -262, 15], [0, -240, 12], [-30, -230, 10], [30, -232, 11], [0, -278, 12]]) {
        const m = K.mesh(geo().rock, K.RP([C.rock, C.rock2]), x, 14 + s * 0.3, z, { ry: K.R(0, 3) });
        m.scale.set(s * 1.2, s * 0.7, s);
      }
      K.box(-20, -223.5, 12, 18, 3, C.rock); K.box(20, -223.5, 12, 18, 3, C.rock2);
      K.box(0, -223.5, 14, 4, 3, C.rock, { y: 14 });
      K.box(-6.6, -221.8, 0.2, 9, 0.6, HIVE, { glow: 1, collide: false }); K.box(6.6, -221.8, 0.2, 9, 0.6, HIVE, { glow: 1, collide: false });
      // the walls bulge inward in a few big masses; the shelf at the back is lined with tall stalagmites
      for (const [x, z, w, d, h] of [[-22.5, -238, 7, 9, 10], [-23.5, -262, 5, 11, 9], [23, -246, 6, 12, 11], [21, -268, 9, 7, 10], [-13, -272.5, 8, 4, 8]]) K.box(x, z, w, h, d, K.RP([C.rock, C.rock2]));
      for (const [x, z, h] of [[-4, -269, 6], [3, -268, 4.5], [-13, -267, 7]]) K.cone(x, z, 1.4, h, C.rock2, { sides: 5 });
      for (const [x, z] of [[-24, -226], [-8, -227], [12, -227], [24, -228]]) { // stalactites over the door wall and over the shelf
        const s = K.mesh(geo().cone, K.RP([C.rock, C.rock2]), x, 12.4, z, { rx: Math.PI });
        s.scale.set(K.R(0.8, 1.4), K.R(2.4, 3.6), K.R(0.8, 1.4));
      }
      for (const [x, z] of [[-12, -240], [15, -252], [-6, -268], [-20, -246], [5, -236], [20, -262], [-17, -233]]) {
        const s = K.mesh(geo().cone, K.RP([C.rock, C.rock2]), x, 12.4, z, { rx: Math.PI });
        s.scale.set(K.R(0.6, 1.2), K.R(2, 3.2), K.R(0.6, 1.2));
      }
      // ritual circle
      const ring = K.mesh(geo().ring, HIVE, bx, 0.08, bz, { rx: Math.PI / 2, glow: 1.6 }); ring.scale.set(7, 7, 7);
      const ring2 = K.mesh(geo().ring, 0xc37aff, bx, 0.08, bz, { rx: Math.PI / 2, glow: 1.6 }); ring2.scale.set(4.5, 4.5, 4.5);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.28;
        K.box(bx + Math.sin(a) * 5.8, bz + Math.cos(a) * 5.8, 0.6, 0.06, 0.6, HIVE, { collide: false, glow: 1.8 });
      }
      for (const [x, z, s] of [[-17, -238, 1.1], [18, -242, 1], [-19, -253, 1.3], [17, -265, 1.2], [9, -232, 0.8]]) hiveCrystals(K, x, z, s);
      for (const [x, z, ry] of [[-11, -256, 0.2], [12, -238, -0.3]]) { // two consoles, at odd angles
        K.obox(x, z, 2, 1.3, 1.2, ry, 0x3a3848);
        K.box(x, z + 0.62, 1.6, 0.6, 0.06, 0xc37aff, { y: 0.6, collide: false, glow: 1.6 }).rotation.y = ry;
      }
      K.box(-14, -246, 1, 9, 1, 0x3a3848); K.box(-14, -246, 0.5, 0.5, 0.5, 0x7ab8ff, { y: 9, glow: 2, collide: false }); // a shock pylon
      for (const [x, z] of [[-14, -230], [15, -231], [-22, -272]]) K.cyl(x, z, 1.8, 14, C.rock, { sides: 7, r2: 2.4 });
      const serv = K.mesh(geo().ico, 0x4a3a6a, bx - 6, 8, bz - 13); serv.scale.set(2.4, 2.4, 2.4);
      K.mesh(geo().cyl, 0xc37aff, bx - 6, 8, bz - 10.7, { rx: Math.PI / 2, glow: 2 }).scale.set(0.9, 0.2, 0.9);
      beam(K, [bx - 6, 13.7, bz - 13], [bx - 6, 10.4, bz - 13], 0.3, IRON);
      beam(K, [bx - 26, 6, bz - 20], [bx - 8, 7, bz - 13], 0.35, ETHER, 0.4);
      for (const [x, z, s] of [[-25, -240, 1.2], [25, -258, 1.3], [-24, -268, 1], [24, -236, 1]]) hiveGrowth(K, x, z, s, K.R(3, 7));
      K.light(-12, 9, bz, HIVE, 9, 28);
      K.light(12, 9, bz, HIVE, 9, 28);
      K.light(bx, 6, -266, 0xc37aff, 9, 26);
    },
  },

  // ------------------------------------------------ ts3: Scorned (storm)
  // Rhythm: Jetsam of Saturn (a wreck field of hills and hulls, a ketch passage flank) > the climb to the Scorn Encampment (traversal, the camp fight starts on
  // the ramp) > the Scorn hold on its rise (palisade, pylon, bone scaffold) > the drop back to the field and two terraces up the Fanatic's Approach
  // (traversal, combat in the pinch) > the chained gate into the raised hull arena round the ether spire.
  ts3: {
    spawn: [-28, 20],
    noEdge: true,
    bounds: [-80, 80, -266, 30],
    zones: [
      { name: 'Jetsam of Saturn', x: -30, z: -45 },
      { name: 'Scorn Encampment', x: 26, z: -96 },
      { name: "The Fanatic's Approach", x: -8, z: -160 },
      { name: "Fikrul's Ether Spire", x: 0, z: -220, boss: true, room: { minX: -37, maxX: 37, minZ: -263, maxZ: -201 } },
    ],
    // a Reef storm: no Saturn, low bruised cloud, wrecks drifting overhead
    sky: {
      zenith: 0x14111a, mid: 0x3a3040, horizon: 0x7a5a58, floor: 0x241a22, fog: 0x5a4a58,
      stars: { n: 1, color: 0xffffff, size: 2, min: 0.9 },
      bodies: [],
      haze: [{ color: 0x8a5a60, opacity: 0.55, r: 470, h: 130, y: -10 }],
      clouds: { n: 24, color: 0x3a2f3c, opacity: 0.9, y: [60, 150], size: 30 },
      aurora: [],
      floaters: [{ kind: 'ship', n: 9, r: [330, 620], y: [40, 190], size: [14, 30], color: 0x2a2030, haze: 0.3 }, { kind: 'island', n: 6, r: [380, 640], y: [30, 160], size: [20, 54], color: 0x2e2434, haze: 0.4 }],
    },
    terrain: [
      { type: 'mound', x: -52, z: -24, r: 16, h: 3.2 },                                           // wreck hills in the Jetsam field
      { type: 'mound', x: 12, z: -6, r: 14, h: 2.4 },
      { type: 'mound', x: -6, z: -66, r: 13, h: 2.6 },
      { type: 'mound', x: 34, z: -30, r: 14, h: 3 },
      { type: 'mound', x: 8, z: -28, r: 12, h: 2.4 },                                              // the freighter bow's hill
      { type: 'plateau', x: 26, z: -96, w: 56, d: 46, h: 6, edge: 4 },                            // the Scorn hold's rise
      { type: 'plateau', x: -8, z: -163, w: 50, d: 26, h: 1.8, edge: 5 },                         // first terrace of the Approach
      { type: 'plateau', x: 0, z: -232, w: 80, d: 68, h: 3.6, edge: 3 },                          // the arena floor
      { type: 'ramp', x0: -30, z0: -72, x1: 0, z1: -90, width: 8, h0: 0, h1: 6, edge: 3 },        // up to the hold's west gate
      { type: 'ramp', x0: 16, z0: -112, x1: -2, z1: -138, width: 7, h0: 6, h1: 0, edge: 3 },      // down from the north gate
      { type: 'ramp', x0: -6, z0: -140, x1: -6, z1: -152, width: 12, h0: 0, h1: 1.8, edge: 3 },    // onto the first terrace
      { type: 'ramp', x0: -6, z0: -174, x1: 0, z1: -198, width: 12, h0: 1.8, h1: 3.6, edge: 3 },   // up to the arena gate
    ],
    build(K) {
      const C = K.C;
      sky(K, 22, { yMin: 20, yMax: 65, chainP: 0.35, links: 6, small: 18 });
      K.edge((x, z, y) => (K.chance(0.6) ? K.rock(x, z, K.R(3, 8), { y, collide: false }) : K.prop(x, z, y, false)), 40);
      for (let i = 0; i < 8; i++) { // hull fragments drifting overhead
        const m = K.box(K.R(-120, 120), K.R(-300, 60), K.R(4, 9), K.R(0.5, 1), K.R(6, 14), K.RP(HULL), { y: K.R(22, 55), collide: false });
        m.rotation.set(K.R(-1, 1), K.R(0, 3), K.R(-1, 1));
      }
      // hull masses close the field on the flanks (the way on is the ramp, not a detour round the edge)
      for (const [x, z, w, d] of [[-76, -55, 8, 76], [68, -36, 22, 56], [-60, -165, 40, 60], [50, -160, 52, 70], [-58, -228, 36, 66], [62, -232, 34, 70]]) K.box(x, z, w, K.R(12, 16), d, K.RP(HULL));

      // --- Jetsam of Saturn: the field of crashed hulls, with hills where the wrecks dug in
      // the listing ketch along the west edge, with a roofed passage through its hull (a flank with a catwalk)
      const ketch = K.box(-71, -55, 10, 12, 58, 0x4e4a5c, { y: -2, collide: false });
      ketch.rotation.z = 0.32;
      K.room(-62, -56, 10, 34, 7, { t: 1, doors: { s: 4, n: 4 }, roof: true, color: 0x4e4a5c, roofColor: 0x3e3a48 });
      K.platform(-64.2, -56, 2.6, 20, 2.4, { stairs: ['s'], stairW: 2.4, color: 0x5c5a66 });
      K.box(-62, -56, 8, 0.12, 31, 0x2a2630, { collide: false });
      interior(K, -61, -50, 8, 8, 0xc37aff);
      K.crate(-59.5, -66); K.crate(-59.5, -64.5); K.crate(-63.6, -45);
      K.light(-62, 4, -62, 0xc37aff, 6, 14);
      for (const z of [-40, -48, -64, -72]) K.box(-56.8, z, 0.3, 1.2, 2.4, 0xc37aff, { y: 4, collide: false, glow: 1.2 });
      const prow = K.box(-64, -92, 10, 10, 10, 0x3e3a48, { y: -1, collide: false }); prow.rotation.set(0.3, 0.78, 0.32);
      K.collider(-70, 0, -97, -59, 7, -87, prow);
      ribs(K, -64, -14, 0, 16, 14, 3, 4.5);
      // freighter bow buried nose-first on its own hill
      const bow = K.box(8, -26, 9, 30, 9, 0x6a6a70, { y: -4, collide: false }); bow.rotation.set(0.55, 0.3, 0);
      K.collider(2, 0, -34, 14, 9, -20, bow);
      K.box(8, -26, 9.2, 1.2, 9.2, 0xb8a060, { y: 6, collide: false }).rotation.set(0.55, 0.3, 0);
      // engine section on its side
      const eng = K.mesh(geo().cyl, 0x5c5a66, -44, 5, -92, { rz: Math.PI / 2 }); eng.scale.set(5, 15, 5);
      K.collider(-51.5, 0, -97, -36.5, 9, -87, eng);
      K.mesh(geo().cyl, LANT, -36.4, 5, -92, { rz: Math.PI / 2, glow: 0.8 }).scale.set(3.6, 0.3, 3.6);
      skiff(K, 56, -30, 0.7, 2.4);
      ribs(K, 46, -58, 1.2, 12, 10, 2, 5);
      ribs(K, 14, -46, 0, 14, 11, 4, 5.5); // a spine of broken ribs: a covered lane toward the ramp
      // plating laid out as two broken hull corridors from the spawn toward the ramp, with gaps to cross
      for (const [x, z, w, al, ln] of [[-46, 4, 8, false, 0.3], [-44, -14, 7, false, -0.3], [-14, 8, 7, false, 0.35], [-12, -10, 6, false, -0.25], [-14, -28, 7, false, 0.3],
        [-48, -36, 6, true, -0.4], [-40, -64, 6, true, -0.5], [-20, -60, 6, true, 0.4], [-8, -76, 7, true, -0.3], [28, -4, 6, true, 0.3], [38, -16, 7, false, 0.35], [26, -56, 6, false, -0.35]]) plate(K, x, z, w, K.R(3, 5), 0.5, al, ln);
      for (const [x, z] of [[-41, -30], [-22, -42], [-34, -56]]) plate(K, x, z, K.R(3, 4), K.R(1.6, 2.4), 0.4, K.chance(0.5), K.R(-0.4, 0.4)); // low cover in the fight area
      for (const [x, z] of [[-22, -32], [-38, -42], [-26, -58], [8, -12], [-50, -22]]) K.cone(x, z, 0.5, 1.1, LANT, { glow: 2, collide: false }); // small fires
      for (const [x, z, s] of [[-18, 0, 1.6], [-40, -18, 1.4], [-22, -18, 1.2], [4, -58, 1.6], [24, -18, 1.4]]) K.rock(x, z, s);
      crane(K, -14, -70, 16, 0.6, 10); crane(K, 30, -8, 14, -1.2, 10); // salvage cranes working the wrecks
      skiff(K, -12, -14, 0.9, 2); skiff(K, 20, -66, -0.6, 1.8);
      K.light(-30, 4, -45, LANT, 8, 26);
      K.light(-60, 4, -30, 0xc37aff, 6, 22);

      // --- Scorn Encampment: a palisaded hold on its rise. West gate (from the ramp), north gate (to the Approach), a bone scaffold and an ether pylon
      const WALL = 0x5a4a40, PX = 6, PX1 = 46, PZ0 = -111, PZ1 = -81;
      K.wall(PX, PZ0, PX, PZ1, 4.6, { t: 0.9, color: WALL, gaps: [[11, 19]] });
      K.wall(PX, PZ0, PX1, PZ0, 4.6, { t: 0.9, color: WALL, gaps: [[6, 14]] });
      K.wall(PX, PZ1, PX1, PZ1, 4.6, { t: 0.9, color: WALL });
      K.wall(PX1, PZ0, PX1, PZ1, 4.6, { t: 0.9, color: WALL });
      for (let a = 0; a <= 40; a += 1.6) { // spike tips, skipping the gates
        const x = PX + a;
        if (!(a > 5 && a < 15)) { beam(K, [x, 4.2, PZ0], [x + 0.2, 6.4, PZ0 - 0.3], 0.1, BONE); }
        beam(K, [x, 4.2, PZ1], [x - 0.2, 6.4, PZ1 + 0.3], 0.1, BONE);
      }
      for (let a = 0; a <= 30; a += 1.6) {
        const z = PZ0 + a;
        if (!(a > 10 && a < 20)) beam(K, [PX, 4.2, z], [PX - 0.3, 6.4, z + 0.2], 0.1, BONE);
        beam(K, [PX1, 4.2, z], [PX1 + 0.3, 6.4, z - 0.2], 0.1, BONE);
      }
      // the skull gate on the west side
      for (const gz of [-100.6, -91.4]) K.box(PX, gz, 1, 8, 1, BONE);
      K.box(PX, -96, 1.1, 0.8, 11, BONE, { y: 8, collide: false });
      K.box(PX - 0.7, -96, 0.5, 1.4, 1.6, BONE, { y: 8.8, collide: false });
      K.box(PX - 1, -96.5, 0.06, 0.3, 0.3, ETHER, { y: 9.4, glow: 2.2, collide: false }); K.box(PX - 1, -95.5, 0.06, 0.3, 0.3, ETHER, { y: 9.4, glow: 2.2, collide: false });
      spikes(K, 12.5, -102.5, 7, true); spikes(K, 12.5, -89.5, 7, true); // a spike funnel inside the gate
      for (const [x, z] of [[2, -103], [2, -89]]) totem(K, x, z, 7);
      totem(K, 10, -109, 6); totem(K, 22, -109, 6);
      // the pylon, with ether cans round its foot and pipes up its shaft
      const px = 31, pz = -102;
      K.cyl(px, pz, 2.6, 3, IRON, { sides: 8 });
      K.cyl(px, pz, 1.8, 14, 0x6a5040, { y: 3, r2: 1.0, sides: 6, collide: false });
      for (const y of [6, 11, 15]) K.cyl(px, pz, 1.7 - y * 0.05, 0.6, ETHER, { y, glow: 1.5, collide: false });
      K.mesh(geo().ico, ETHER, px, 19.5, pz, { glow: 2.4 }).scale.set(1.5, 1.5, 1.5);
      K.light(px, 18, pz, ETHER, 14, 46);
      for (const [x, z] of [[28, -100], [34, -99], [33.5, -105], [27, -104.5], [30, -97]]) etherCan(K, x, z, 0.7, 2);
      for (const [x, z] of [[28, -100], [34, -99]]) beam(K, [x, 1.8, z], [px, 5, pz], 0.2, IRON);
      // the bone scaffold on the east side: a raised deck (a player-only perch) over the back wall huts
      K.platform(40, -92, 10, 9, 3.6, { stairs: ['w'], stairW: 5, color: 0x4a4440 });
      totem(K, 44, -90, 6);
      shanty(K, 41.5, -105.5, 5, 5, 3.5, 'w', { colors: [0x4a4440, 0x5a524a], lantern: false, poster: 0, upper: 0 });
      shanty(K, 41.5, -85.5, 5, 5, 3.5, 'w', { colors: [0x4a4440, 0x5a524a], lantern: false, poster: 0, upper: 0 });
      for (const [x, z] of [[18, -86], [36, -107]]) { // Scorn rag banners
        K.box(x, z, 0.3, 7, 0.3, BONE);
        K.box(x, z + 0.2, 1.5, 4, 0.05, 0x1e2430, { y: 2.6, collide: false });
        K.box(x, z + 0.25, 0.5, 0.5, 0.05, ETHER, { y: 5, collide: false, glow: 2 });
      }
      for (const [x, z] of [[19, -97], [24, -92], [14, -97]]) K.cover(x, z);
      K.light(14, 4, -96, ETHER, 8, 24);
      K.light(30, 4, -90, 0x8ac8ff, 7, 22);
      for (const [x, z] of [[50, -110], [52, -76]]) totem(K, x, z, 9);

      // --- the Fanatic's Approach: a procession between hull walls, climbing two terraces to the arena gate (a pinch at the second terrace)
      hullWall(K, -34, -146, -168, 9, { side: 1 });
      hullWall(K, -22, -171, -182, 9, { side: 1 });
      hullWall(K, -16, -184, -198, 9, { side: 1 });
      K.box(-28, -169.5, 12, 9, 3, HULL[3]); K.box(-19, -183, 6, 9, 3, HULL[1]);
      hullWall(K, 22, -146, -168, 9, { side: -1 });
      hullWall(K, 14, -172, -198, 9, { side: -1 });
      K.box(18, -170, 8, 9, 3, HULL[3]);
      for (let i = 0; i < 6; i++) totem(K, -8 + (i % 2 ? 9 : -9) + (i > 2 ? 3 : 0), -146 - i * 10, 6 + (i % 3));
      totem(K, -17, -171, 10); totem(K, 9, -171, 10); // the pinch pair
      for (const [x, z, w, ln] of [[-12, -136, 5, 0.3], [-24, -156, 5, -0.4], [10, -152, 6, 0.3], [-2, -186, 4, -0.3]]) plate(K, x, z, w, K.R(2, 3), 0.5, K.chance(0.5), ln);
      for (const [x, z] of [[-14, -160], [8, -160]]) { // Scorn rag banners at the pocket
        K.box(x, z, 0.3, 7, 0.3, BONE);
        K.box(x, z + 0.2, 1.5, 4, 0.05, 0x1e2430, { y: 2.6, collide: false });
        K.box(x, z + 0.25, 0.5, 0.5, 0.05, ETHER, { y: 5, collide: false, glow: 2 });
      }
      // chained wreck gate before the arena
      for (const gx of [-12.5, 12.5]) { const g = K.box(gx, -200, 3, 16, 3, HULL[0]); g.rotation.z = gx < 0 ? -0.05 : 0.05; }
      chainSpan(K, [-12, 15, -200], [12, 15, -200], 3, 0.2);
      chain(K, -4, 13, -200, 4, 'cage'); chain(K, 5, 12.5, -200, 3, 'hook');
      K.box(0, -200.2, 3, 5, 0.06, 0x1e2430, { y: 6, collide: false });
      K.box(0, -200.3, 1, 1, 0.06, ETHER, { y: 9, collide: false, glow: 2 });
      K.light(0, 8, -196, ETHER, 7, 22);
      K.light(-8, 6, -150, ETHER, 6, 24);

      // --- Fikrul's ether spire (boss): a hull-walled arena on the raised floor
      const bx = 0, bz = -234, tz = -241;
      K.room(0, -232, 76, 64, 12, { doors: { s: 21 }, color: 0x4e4a5c, t: 1.2 });
      K.door(0, -200, 21, 12, 'x', { zone: 2, t: 1.2, color: HULL[0], trim: ETHER });
      for (const x of [-30, -18, 18, 30]) K.box(x, -200.7, 4, 0.3, 0.1, ETHER, { y: 9, collide: false, glow: 1.4 });
      K.platform(31, -236, 6, 16, 2.8, { stairs: ['w'], stairW: 3, color: 0x4e4a5c }); // the one firing deck, east
      ribs(K, -27, -232, 0, 12, 10, 3, 6); // a wrecked hull's ribs lean over the west side
      for (const [x, z, w, al, ln] of [[-22, -212, 8, true, 0.2], [18, -213, 7, true, -0.25], [-18, -252, 7, false, 0.3], [22, -254, 6, false, -0.2], [11, -228, 5, true, 0.3], [-12, -230, 5, false, -0.3]]) plate(K, x, z, w, K.R(4, 7), 0.8, al, ln);
      spikes(K, -7, -209, 6, true); spikes(K, 7, -210, 5, true);
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
      for (let i = 0; i < 4; i++) { // ether tanks on the ground feeding the spire
        const a = Math.PI / 4 + (i * Math.PI) / 2, x = bx + Math.sin(a) * 10, z = tz + Math.cos(a) * 10;
        K.cyl(x, z, 1.5, 5, ETHER, { glow: 1 });
        K.cyl(x, z, 1.7, 0.4, C.metal, { y: 5, collide: false });
        beam(K, [x, 3.5, z], [bx + Math.sin(a) * 4.5, 6, tz + Math.cos(a) * 4.5], 0.3, IRON);
      }
      for (const [x, z] of [[-18, -241], [18, -241], [0, -259]]) { // cables from the crown down to anchors
        K.box(x, z, 1.8, 1.4, 1.8, IRON);
        cable(K, [bx, 28, tz], [x, 1.4, z], 1.5, 0.22, IRON, 4);
      }
      for (const [x, z, h] of [[-14, -222, 6], [15, -226, 7], [-20, -243, 5], [21, -247, 6], [-6, -257, 7], [12, -258, 5]]) totem(K, x, z, h);
      K.light(bx, 22, tz, ETHER, 12, 44);
      K.light(bx, 5, bz + 8, 0x8ac8ff, 6, 22);
    },
  },
};
