// U17f: the Tangled Shore patrol zone (docs/reference/README.md, "Tangled Shore patrol zone"). Whole rock islands lashed together with cable and chain over a cloud abyss,
// under a broken ring of debris round a glowing core. Thieves' Landing (the safe hub, a cavern under a rock ceiling hung with Fallen pods, huts on stilts) and the
// Spider's lair (a plank bridge, a lit tower door between domes, the throne room inside) in the south; the chained rocks of the Rift (Fallen cranes and camps) and
// Four-Holed Cove in the middle; Jetsam of Saturn (a crashed Hive ship with a walkable hold) in the north-west; the Scorn flats and Trapper's Cave in the north-east.
// Heights: every island, deck and plank is a terrain plateau or ramp (js/patrol-data.js TANGLED_ISLANDS, TANGLED_RAMPS); the ground between them is the abyss under
// the cloud sea. Rule for this map: whatever is walked on is a whole rock island with its own underside or a deck anchored at both ends; nothing floats but the sky rocks.
// Placement: everything here is built at absolute heights (A, meshA, beamA) from K.ground, so nothing near an edge reads the abyss under it.
import * as THREE from 'three';
import { PATROL_DATA, TANGLED_ISLANDS, TANGLED_RAMPS } from './patrol-data.js';
import { TANGLED_KIT as TK } from './level-tangled.js';
import { hall } from './patrol-kit.js';

const { SCRAP, CLOTH, IRON, ROPE, LANT, BONE, ETHER, HIVE, CHITIN } = TK.C;
const TAU = Math.PI * 2;
const ROCK = [0x4e4458, 0x433b4e, 0x585064], ROCKD = 0x2e283a;                   // the purple-grey rock of the islands
const RUST = [0x6a4a3a, 0x5a4434, 0x7a5642], STEEL = 0x4a4e58, STEEL2 = 0x5c606a;  // decks, girders, stilts
const WOOD = [0x6a5038, 0x5a4430, 0x7a5c40], HUTC = [0x8a8a8e, 0x9a9690, 0x7c7a80], ORANGE = 0xff6a2a, REDEYE = 0xff3a2a, BANNER = 0xa82a2a;
const SAND = 0xb8ac96, SCRUB = [0x7a6a52, 0x8a7a5c, 0x6a5a48], NET = 0x3e5a2e, NETL = 0x54763a, PODG = 0x5a8a3a;
const HULLC = [0x3a3c48, 0x44464f, 0x34363e], HULLG = 0x7dff5a;

// ------------------------------------------------------------------ helpers (absolute heights)

/** A box with its base at absolute height y0. Not solid unless asked; a solid one must not be turned. */
function A(K, x, y0, z, w, h, d, color, o = {}) {
  const m = K.box(x, z, w, h, d, color, { y: y0, abs: true, collide: o.collide ?? false, glow: o.glow });
  if (o.rx || o.ry || o.rz) m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, 'YXZ');
  return m;
}
/** Any geometry at an absolute position. */
function meshA(K, geo, color, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, K.mat(color, o.glow));
  m.position.set(x, y, z);
  m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, o.order ?? 'XYZ');
  if (o.scale) m.scale.set(...[].concat(o.scale, o.scale, o.scale).slice(0, 3));
  m.castShadow = true;
  K.scene.add(m);
  return m;
}
/** An invisible collider at absolute heights. */
const solid = (K, x0, y0, z0, x1, y1, z1) => { const g = K.ground((x0 + x1) / 2, (z0 + z1) / 2); K.collider(x0, y0 - g, z0, x1, y1 - g, z1, null); };
let CYL = null;
/** A round bar from point a to point b ([x, y, z], absolute). */
function beamA(K, a, b, r, color, glow) {
  CYL ??= new THREE.CylinderGeometry(1, 1, 1, 6);
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 0.01;
  const m = meshA(K, CYL, color, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, { glow });
  m.scale.set(r, len, r);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
  return m;
}
/** A sagging cable from a to b. */
function cableA(K, a, b, sag, r = 0.12, color = ROPE, segs = 6) {
  const P = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
  for (let i = 0; i < segs; i++) beamA(K, P(i / segs), P((i + 1) / segs), r, color);
}
/** A heavy chain from a to b: alternating flattened links along a sag. */
function chainA(K, a, b, sag, r = 0.26) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(6, Math.min(28, Math.round(len / 1.6)));
  const P = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
  for (let i = 0; i < n; i++) { const m = beamA(K, P(i / n), P((i + 0.85) / n), r, IRON); if (i % 2) m.scale.x *= 0.45; else m.scale.z *= 0.45; }
}
/** A light at an absolute height. */
const lampA = (K, x, y, z, color, power = 8, dist = 22) => K.light(x, y - K.ground(x, z), z, color, power, dist);
const pick = (K, a) => K.RP(a);
const G = (K, x, z) => K.ground(x, z);

// ------------------------------------------------------------------ islands, decks and the sky

/** The rock under an island: a slab whose sides are the cliff, boulders round the lip, and a hanging mass of rock cones tapering down into the clouds. */
function underside(K, x0, x1, z0, z1, h) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  A(K, cx, h - 7, cz, w, 6.85, d, ROCK[0]);
  const per = 2 * (w + d), n = Math.max(6, Math.round(per / 8));
  for (let i = 0; i < n; i++) {
    let t = (i + K.R(0, 0.6)) / n * per, px, pz;
    if (t < w) { px = x0 + t; pz = z0; } else if ((t -= w) < d) { px = x1; pz = z0 + t; } else if ((t -= d) < w) { px = x1 - t; pz = z1; } else { px = x0; pz = z1 - (t - w); }
    const s = K.R(2.2, 4.2);
    meshA(K, new THREE.DodecahedronGeometry(s, 0), pick(K, ROCK), px, h - s - 0.7, pz, { ry: K.R(0, TAU), scale: [1.3, 1, 1.3] }).userData.noCollide = true; // H17: hangs below the island, out of reach
  }
  const r0 = Math.min(w, d) * 0.5;
  meshA(K, new THREE.ConeGeometry(r0, r0 * 1.6 + 10, 7), ROCKD, cx, h - 7 - (r0 * 1.6 + 10) / 2, cz, { rx: Math.PI, ry: K.R(0, TAU) });
  const k = Math.max(2, Math.round(w * d / 500));
  for (let i = 0; i < k; i++) {
    const r = Math.min(w, d) * K.R(0.2, 0.34), len = K.R(12, 30), x = cx + K.R(-0.5, 0.5) * (w - 2 * r), z = cz + K.R(-0.5, 0.5) * (d - 2 * r);
    meshA(K, new THREE.ConeGeometry(r, len, 6), pick(K, [ROCKD, ROCK[1]]), x, h - 7 - len / 2, z, { rx: Math.PI, ry: K.R(0, TAU) });
  }
}

/**
 * A walkway between two islands along a centre line (x0, z0) to (x1, z1): a wide deck (`d`, rusted plates on two girders, an orange edge line, a Sparrow route)
 * or a plank bridge (`p`, planks on two beams with rope rails on posts, on foot). Every piece is laid at the terrain height under it, pitched to its slope.
 */
function span(K, x0, z0, x1, z1, w, kind) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), nx = Math.cos(ry), nz = -Math.sin(ry);
  const n = Math.max(1, Math.round(L / (kind === 'p' ? 0.7 : 4)));
  const at = (t) => [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
  const ha = G(K, ...at(0)), hb = G(K, ...at(1)), pitch = -Math.atan((hb - ha) / L);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, [x, z] = at(t), y = G(K, x, z), seg = L / n;
    if (kind === 'p') {
      if (k % 7 !== 3) A(K, x, y - 0.18, z, w, 0.24, seg * 0.82, pick(K, WOOD), { ry, rx: pitch });
    } else {
      A(K, x, y - 0.28, z, w + 0.3, 0.36, seg + 0.05, pick(K, RUST), { ry, rx: pitch });
      if (k % 2 === 0) for (const s of [-1, 1]) A(K, x + nx * s * (w / 2 - 0.3), y + 0.06, z + nz * s * (w / 2 - 0.3), 0.18, 0.06, seg * 0.9, ORANGE, { ry, rx: pitch, glow: 1.4 });
    }
  }
  // the girders under both edges, cross braces, and chains hanging off them
  const gy = (t) => G(K, ...at(t));
  for (const s of [-1, 1]) {
    const o = (w / 2 - (kind === 'p' ? 0.2 : 0.6)) * s;
    beamA(K, [x0 + nx * o, gy(0) - 0.7, z0 + nz * o], [x1 + nx * o, gy(1) - 0.7, z1 + nz * o], kind === 'p' ? 0.16 : 0.42, kind === 'p' ? WOOD[1] : STEEL);
  }
  for (let d = 4; d < L - 2; d += 8) {
    const t = d / L, [x, z] = at(t), y = gy(t) - 0.8, o = w / 2 - 0.6;
    beamA(K, [x + nx * o, y, z + nz * o], [x - nx * o, y - 1.6, z - nz * o], 0.1, kind === 'p' ? WOOD[2] : STEEL2);
    if (K.chance(0.35)) TK.chain(K, x + nx * o * K.R(-1, 1), y - G(K, x, z) - 0.2, z + nz * o * K.R(-1, 1), K.R(2, 5), K.RP(['lantern', 'hook', null]));
  }
  if (kind !== 'p') return;
  // rope rails on posts: solid along their length (a plank bridge is not a ledge to slip off)
  for (const s of [-1, 1]) {
    const o = (w / 2 - 0.12) * s;
    for (let d = 0; d <= L + 0.01; d += 4) {
      const t = Math.min(1, d / L), [x, z] = at(t), y = gy(t);
      A(K, x + nx * o, y - 0.2, z + nz * o, 0.16, 1.4, 0.16, WOOD[0]);
    }
    for (let d = 0; d < L - 0.01; d += 4) {
      const ta = d / L, tb = Math.min(1, (d + 4) / L), [xa, za] = at(ta), [xb, zb] = at(tb);
      cableA(K, [xa + nx * o, gy(ta) + 1.1, za + nz * o], [xb + nx * o, gy(tb) + 1.1, zb + nz * o], 0.25, 0.04, ROPE, 3);
      cableA(K, [xa + nx * o, gy(ta) + 0.6, za + nz * o], [xb + nx * o, gy(tb) + 0.6, zb + nz * o], 0.2, 0.03, ROPE, 3);
      const ym = Math.min(gy(ta), gy(tb)); // planks run along x or z, so the rail's collider is a plain box
      solid(K, Math.min(xa, xb) + nx * o - 0.1, ym, Math.min(za, zb) + nz * o - 0.1, Math.max(xa, xb) + nx * o + 0.1, Math.max(gy(ta), gy(tb)) + 1.15, Math.max(za, zb) + nz * o + 0.1);
    }
  }
}

/** A floating rock in the sky (scenery): a flattened boulder with a hanging cone, sometimes with a scrap shack and a lantern. */
function floatRock(K, x, y, z, s, o = {}) {
  meshA(K, new THREE.DodecahedronGeometry(s, 0), pick(K, ROCK), x, y, z, { rx: K.R(0, 0.4), ry: K.R(0, TAU), scale: [K.R(1, 1.4), K.R(0.5, 0.7), K.R(0.9, 1.3)] });
  meshA(K, new THREE.ConeGeometry(s * 0.7, s * 1.1, 6), ROCK[1], x, y - s * 0.8, z, { rx: Math.PI, ry: K.R(0, TAU) });
  if (o.shack) { A(K, x, y + s * 0.3, z, s * 0.6, s * 0.4, s * 0.5, pick(K, SCRAP)); A(K, x + s * 0.32, y + s * 0.5, z, 0.3, 0.4, 0.3, LANT, { glow: 1.8 }); }
}

/** Rocks and debris drifting round the islands, some chained down to anchors on them. */
function sky(K) {
  const isl = TANGLED_ISLANDS.filter((i) => i[6] === 'i');
  const over = (x, z, m) => isl.some(([, a, b, c, d]) => x > a - m && x < b + m && z > c - m && z < d + m);
  let n = 0;
  for (let tries = 0; n < 18 && tries < 400; tries++) {
    const x = K.R(-200, 200), z = K.R(-200, 210), y = K.R(80, 140), s = K.R(3, 9);
    if (over(x, z, 4) && y < 92) continue; // clear of the landing's ceiling and the cranes
    floatRock(K, x, y, z, s, { shack: K.chance(0.2) });
    n++;
  }
  for (let i = 0, k = 0; i < 300 && k < 26; i++) { // low rocks out in the abyss, half lost in the clouds
    const x = K.R(-220, 220), z = K.R(-220, 230);
    if (over(x, z, 12)) continue;
    floatRock(K, x, K.R(14, 34), z, K.R(4, 14)); k++;
  }
  // big rocks chained to island anchors (the "lashed together" look): an anchor block on the island, the chain up to a rock overhead
  for (const [ax, az, rx, ry, rz, s] of [[-24, 34, -40, 82, 10, 9], [26, 66, 50, 88, 80, 8], [-92, 26, -120, 78, 0, 10], [90, 48, 118, 72, 70, 9], [20, -12, 46, 78, -16, 8], [-20, -8, -50, 84, -10, 7],
    [60, -140, 70, 92, -176, 11], [146, -60, 172, 80, -40, 9], [-150, -60, -178, 86, -40, 10], [-108, 162, -130, 96, 182, 8], [150, -146, 176, 86, -170, 9]]) {
    const g = G(K, ax, az);
    A(K, ax, g, az, 2.6, 1.6, 2.6, STEEL, { collide: true });
    A(K, ax, g + 1.6, az, 1.4, 0.4, 1.4, LANT, { glow: 1.4 });
    floatRock(K, rx, ry, rz, s);
    chainA(K, [ax, g + 1.8, az], [rx, ry - s * 0.4, rz], 4, 0.3);
  }
  // cables between drifting rocks
  for (const [a, b] of [[[-60, 96, 30], [-10, 102, 2]], [[30, 92, 120], [80, 98, 100]], [[-130, 100, -110], [-70, 96, -150]], [[100, 104, -20], [150, 110, -90]]]) cableA(K, a, b, 5, 0.3, ROPE, 8);
}

// ------------------------------------------------------------------ Fallen pieces

/** A rounded Fallen hut on steel stilts: a drum with a dome, an orange glyph band, an arched door and a red eye-light, facing ry. */
function hut(K, x, z, r, ry, o = {}) {
  const g = G(K, x, z), lift = o.lift ?? 2.4, y0 = g + lift, fx = Math.sin(ry), fz = Math.cos(ry), col = pick(K, HUTC);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A(K, x + sx * r * 0.62, g, z + sz * r * 0.62, 0.32, lift, 0.32, STEEL, { collide: true });
  beamA(K, [x - r * 0.62, g + 0.4, z - r * 0.62], [x + r * 0.62, y0 - 0.3, z + r * 0.62], 0.07, STEEL2);
  beamA(K, [x + r * 0.62, g + 0.4, z - r * 0.62], [x - r * 0.62, y0 - 0.3, z + r * 0.62], 0.07, STEEL2);
  A(K, x, y0 - 0.3, z, r * 2.2, 0.3, r * 2.2, STEEL2);
  meshA(K, new THREE.CylinderGeometry(r, r * 1.05, r * 1.1, 12), col, x, y0 + r * 0.55, z);
  meshA(K, new THREE.SphereGeometry(r, 12, 6, 0, TAU, 0, Math.PI / 2), col, x, y0 + r * 1.1, z, { scale: [1, 0.8, 1] });
  meshA(K, new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.22, 12), ORANGE, x, y0 + r * 0.95, z, { glow: 1.3 });
  meshA(K, new THREE.CylinderGeometry(r * 0.25, r * 0.3, r * 0.5, 8), STEEL2, x, y0 + r * 1.9, z);
  A(K, x + fx * (r + 0.02), y0, z + fz * (r + 0.02), r * 0.7, r * 0.75, 0.1, 0x16121a, { ry });
  meshA(K, new THREE.SphereGeometry(0.22, 8, 6), REDEYE, x + fx * (r + 0.05) + fz * r * 0.45, y0 + r * 0.95, z + fz * (r + 0.05) - fx * r * 0.45, { glow: 2.6 });
  for (let i = 0; i < 3; i++) A(K, x + fx * (r + 0.04) - fz * (i - 1) * 0.5, y0 + r * 0.35, z + fz * (r + 0.04) + fx * (i - 1) * 0.5, 0.3, 0.12 + 0.1 * i, 0.05, ORANGE, { ry, glow: 1.6 });
  solid(K, x - r * 0.75, y0, z - r * 0.75, x + r * 0.75, y0 + r * 1.9, z + r * 0.75);
  lampA(K, x + fx * (r + 1), y0 + 1.2, z + fz * (r + 1), REDEYE, 4, 10);
}

/** A bulbous Fallen pod hung from the cavern ceiling: a metal bulb, an orange band, a red eye. */
function pod(K, x, y, z, s, top) {
  meshA(K, new THREE.IcosahedronGeometry(s, 1), pick(K, HUTC), x, y, z, { scale: [1, 1.25, 1] });
  meshA(K, new THREE.CylinderGeometry(s * 1.02, s * 1.02, s * 0.18, 10), ORANGE, x, y - s * 0.2, z, { glow: 1.2 });
  meshA(K, new THREE.SphereGeometry(s * 0.22, 8, 6), REDEYE, x + s * 0.9, y + s * 0.15, z, { glow: 2.8 });
  meshA(K, new THREE.ConeGeometry(s * 0.35, s * 0.8, 6), STEEL2, x, y - s * 1.45, z, { rx: Math.PI });
  beamA(K, [x, y + s * 1.2, z], [x, top, z], 0.12, IRON);
}

/** A tall red Fallen banner on a pole. */
function banner(K, x, z, h = 9) {
  const g = G(K, x, z);
  A(K, x, g, z, 0.25, h, 0.25, STEEL, { collide: true });
  A(K, x, g + h - 0.3, z, 0.12, 0.12, 2.4, STEEL2);
  A(K, x, g + h * 0.35, z + 0.4, 0.05, h * 0.6, 1.5, BANNER, { rz: 0.03 });
  meshA(K, new THREE.ConeGeometry(0.75, 1.6, 3), BANNER, x, g + h * 0.35 - 0.8, z + 0.4, { rx: Math.PI, scale: [0.08, 1, 1] });
}

/** A Fallen crane: a drum base, a tower, an eye-lit head and a jib with a cargo cradle (or net) hanging off its tip, turned to ry. */
function crane(K, x, z, h, ry, jib, o = {}) {
  const g = G(K, x, z), fx = Math.sin(ry), fz = Math.cos(ry);
  meshA(K, new THREE.CylinderGeometry(2.2, 2.6, 2, 8), STEEL, x, g + 1, z);
  solid(K, x - 2, g, z - 2, x + 2, g + 2, z + 2);
  A(K, x, g + 2, z, 1.5, h - 2, 1.5, pick(K, RUST), { collide: true });
  A(K, x, g + h - 1, z, 3, 2.4, 3, STEEL2, { ry });
  meshA(K, new THREE.SphereGeometry(0.45, 10, 8), 0xffc060, x + fx * 1.6, g + h + 0.3, z + fz * 1.6, { glow: 3 });
  lampA(K, x + fx * 2.4, g + h, z + fz * 2.4, 0xffb050, 7, 20);
  const tip = [x + fx * jib, g + h + 0.6, z + fz * jib];
  beamA(K, [x - fx * 4, g + h + 0.4, z - fz * 4], tip, 0.4, IRON);
  beamA(K, [x, g + h + 4, z], tip, 0.08, ROPE); beamA(K, [x, g + h + 4, z], [x - fx * 4, g + h + 0.4, z - fz * 4], 0.08, ROPE);
  A(K, x, g + h + 1.2, z, 0.3, 3, 0.3, IRON);
  const cy = tip[1] - (o.drop ?? 6);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) beamA(K, tip, [tip[0] + a * 1.4, cy, tip[2] + b * 1.0], 0.04, ROPE);
  if (o.net) { A(K, tip[0], cy - 2.4, tip[2], 2.8, 2.4, 2.2, NET); for (let i = 0; i < 3; i++) A(K, tip[0] + K.R(-0.8, 0.8), cy - 2.2, tip[2] + K.R(-0.6, 0.6), 0.9, 0.9, 0.9, pick(K, SCRAP)); }
  else { A(K, tip[0], cy - 0.2, tip[2], 2.8, 0.2, 2, IRON); A(K, tip[0], cy, tip[2], 1.4, 1.2, 1.2, pick(K, SCRAP)); }
}

/** A Fallen supply heap: crates, a tarp and a lantern on a post. */
function supplies(K, x, z) {
  const g = G(K, x, z);
  for (const [dx, dz, s] of [[0, 0, 1.4], [1.6, 0.3, 1.1], [0.5, -1.5, 1.2], [0.7, 0.2, 0.9]]) A(K, x + dx, g + (s < 1 ? 1.4 : 0), z + dz, s, s, s, pick(K, SCRAP), { collide: s >= 1 });
  A(K, x - 1.6, g, z + 1, 0.12, 2.2, 0.12, STEEL);
  A(K, x - 1.6, g + 2.2, z + 1, 0.35, 0.45, 0.35, LANT, { glow: 1.8 });
  lampA(K, x - 1.6, g + 2.6, z + 1, LANT, 5, 14);
}

// ------------------------------------------------------------------ Thieves' Landing

const LAND = { x0: -48, x1: 48, z0: 108, z1: 172, ceil: 68 };
function landing(K) {
  const h = G(K, 0, 150), C = LAND.ceil;
  // the rock ceiling: a vast hanging mass over the whole landing, pillars of rock holding it at the corners, and stalactites
  for (const [x, z, s, sy] of [[-30, 130, 30, 0.35], [24, 128, 32, 0.32], [-26, 162, 30, 0.34], [28, 160, 30, 0.33], [0, 146, 34, 0.3], [-52, 146, 24, 0.4], [52, 142, 24, 0.4]]) {
    meshA(K, new THREE.DodecahedronGeometry(s, 1), pick(K, ROCK), x, C + s * sy * 0.8, z, { ry: K.R(0, TAU), scale: [1.1, sy, 1] });
  }
  for (let i = 0; i < 22; i++) { const x = K.R(-44, 44), z = K.R(110, 172), len = K.R(3, 9); meshA(K, new THREE.ConeGeometry(K.R(1, 2.4), len, 5), ROCKD, x, C - len / 2 + 0.5, z, { rx: Math.PI }); }
  for (const [x, z, r] of [[-43, 115, 4.5], [43, 117, 4.5], [-42, 167, 5], [42, 167, 5]]) {
    meshA(K, new THREE.CylinderGeometry(r * 0.7, r, C - h + 4, 7), pick(K, ROCK), x, h + (C - h + 4) / 2 - 2, z);
    solid(K, x - r * 0.7, h, z - r * 0.7, x + r * 0.7, C, z + r * 0.7);
  }
  // pods hanging from the ceiling, their red eyes watching the landing
  for (const [x, z, y, s] of [[-26, 124, 58, 2.6], [-8, 130, 60, 2.2], [18, 122, 57, 2.8], [34, 136, 59, 2.4], [-36, 146, 57, 2.6], [-14, 158, 59, 2.2], [12, 164, 57, 2.8], [30, 156, 60, 2.2], [0, 140, 61, 1.8]]) pod(K, x, y, z, s, C + 2);
  for (const [x, z] of [[-20, 136], [20, 140], [0, 120], [-6, 166]]) lampA(K, x, 54, z, 0xff6a50, 6, 30);
  // huts on stilts round the edge of the landing, facing in; the middle is open
  for (const [x, z, r, ry] of [[-32, 124, 4.2, 0.9], [-36, 148, 4.8, Math.PI / 2], [-18, 164, 3.8, Math.PI * 0.95], [20, 165, 4.4, Math.PI], [36, 148, 4.6, -Math.PI / 2], [32, 122, 4, -0.8]]) hut(K, x, z, r, ry);
  // walkways between the huts, raised on stilts like them
  for (const [x, z, w, d] of [[-34, 136, 2.4, 14], [34, 135, 2.4, 14], [0, 166, 26, 2.4]]) { A(K, x, h + 2.1, z, w, 0.3, d, STEEL2); for (const s of [-1, 1]) A(K, x + (w > d ? s * w * 0.4 : 0), h, z + (d > w ? s * d * 0.4 : 0), 0.2, 2.1, 0.2, STEEL, { collide: true }); }
  for (const [x, z] of [[-14, 116], [14, 116], [-44, 132], [44, 132], [-26, 170], [26, 170]]) banner(K, x, z, K.R(8, 11));
  for (const [x, z] of [[-22, 128], [22, 130], [-24, 154], [26, 152]]) supplies(K, x, z);
  // the Spider's crew keep a few stalls under the huts
  for (const [x, z, face] of [[-10, 170, 'n'], [10, 170, 'n']]) TK.shanty(K, x, z, 4, 3, 2.6, face, { lantern: 1, poster: 0, upper: 0, antenna: 0 });
  // the lip of the landing: a low scrap rail along the south edge (over the blue mist), lit from below
  for (let x = -44; x <= 44; x += 8) A(K, x, h, 171.4, 6, 0.9, 0.3, pick(K, RUST), { collide: true });
  for (const x of [-30, 0, 30]) lampA(K, x, h - 6, 176, 0x6fb0ff, 8, 30);
  // the deck north out of the cavern: a gateway of two posts with a Fallen glyph sign
  for (const s of [-1, 1]) { A(K, s * 7, h, 110, 1.2, 8, 1.2, STEEL, { collide: true }); A(K, s * 7, h + 8, 110, 1.6, 0.6, 1.6, ORANGE, { glow: 1.6 }); }
  A(K, 0, h + 6.6, 110, 15, 1.2, 0.4, pick(K, RUST));
  for (let i = 0; i < 4; i++) A(K, -4.5 + i * 3, h + 6.9, 109.7, 1.4, 0.5, 0.1, ORANGE, { glow: 1.8 });
  lampA(K, 0, h + 6, 112, LANT, 8, 20);
}

// ------------------------------------------------------------------ the Spider's lair

const LAIR = { cx: -96, cz: 146, w: 30, d: 34, h: 10 };
function lair(K) {
  const h = G(K, -92, 146), { cx, cz, w, d } = LAIR;
  // the bridge's circle-marked side panels, and lanterns along it
  for (let x = -70; x <= -50; x += 5) for (const s of [-1, 1]) { A(K, x, h + 0.1, 146 + s * 2.6, 2.4, 1.2, 0.1, pick(K, RUST)); meshA(K, new THREE.CylinderGeometry(0.4, 0.4, 0.06, 12), 0xd8d0c0, x, h + 0.7, 146 + s * 2.66, { rx: Math.PI / 2 }); }
  // two Fallen domes either side of the tower door, the crane lowering a cargo net over the bridge
  for (const z of [134, 158]) {
    meshA(K, new THREE.SphereGeometry(6, 12, 6, 0, TAU, 0, Math.PI / 2), pick(K, HUTC), -78, h, z);
    meshA(K, new THREE.CylinderGeometry(6.05, 6.05, 0.3, 12), ORANGE, -78, h + 1.6, z, { glow: 1.2 });
    meshA(K, new THREE.SphereGeometry(0.4, 8, 6), REDEYE, -72.2, h + 3, z, { glow: 2.6 });
    solid(K, -82.5, h, z - 4.5, -73.5, h + 5, z + 4.5);
  }
  crane(K, -76, 128, 15, 0.66, 20, { net: true, drop: 7 });
  // the tower door: a tall lit frame on the east wall of the lair
  for (const s of [-1, 1]) { A(K, cx + w / 2 + 0.6, h, cz + s * 3.4, 1.4, 16, 1.4, STEEL, { collide: true }); A(K, cx + w / 2 + 1.35, h + 1, cz + s * 3.4, 0.1, 14, 0.4, 0xffd890, { glow: 2.2 }); }
  A(K, cx + w / 2 + 0.6, h + 16, cz, 1.6, 2, 8.4, STEEL2);
  meshA(K, new THREE.CylinderGeometry(3.4, 4, 9, 8), pick(K, HUTC), cx + w / 2 - 2, h + 14.5, cz);
  meshA(K, new THREE.SphereGeometry(3.4, 10, 6, 0, TAU, 0, Math.PI / 2), pick(K, HUTC), cx + w / 2 - 2, h + 19, cz);
  lampA(K, cx + w / 2 + 3, h + 4, cz, 0xffd890, 10, 24);
  // the throne room: a big shed of plating, its walls hung with green cargo netting like a tent, bare lamps on wires, a cable-strewn deck
  hall(K, cx, cz, w, d, LAIR.h, { doors: { e: 5 }, color: 0x4a4440, roofColor: 0x3a3430, ceil: 0x2a2826, lamp: 0xfff0c0, lamps: 0, windows: false });
  for (const [x, z] of [[cx - 8, cz - 8], [cx - 8, cz + 8], [cx + 4, cz - 6], [cx + 4, cz + 6], [cx - 2, cz]]) {
    beamA(K, [x, h + LAIR.h - 0.2, z], [x, h + 6.4, z], 0.02, IRON);
    meshA(K, new THREE.SphereGeometry(0.22, 8, 6), 0xfff6d8, x, h + 6.2, z, { glow: 3.2 });
    lampA(K, x, h + 6, z, 0xffe6b0, 7, 16);
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = cx - w / 2 + 3 + i * 6;
      A(K, x, h + 1.5, cz + s * (d / 2 - 1.2), 5.8, LAIR.h - 2, 0.06, i % 2 ? NET : NETL, { rx: s * 0.06 });
    }
    A(K, cx - w / 2 + 1.2, h + 1.5, cz + s * 8, 0.06, LAIR.h - 2, 15, NET, { rz: s * 0.04 });
    A(K, cx, h + LAIR.h - 1.6, cz + s * 6, w - 2, 0.06, 6, NETL, { rx: s * 0.35 });
  }
  A(K, cx, h + 0.02, cz, w - 3, 0.04, d - 3, 0x3a4a2a); // the netting laid over the deck
  for (let i = 0; i < 7; i++) { const z = cz + K.R(-12, 12); beamA(K, [cx - 10, h + 0.1, z], [cx + 12, h + 0.1, z + K.R(-4, 4)], 0.06, 0x2a2a2e); }
  for (const [x, z, s] of [[cx - 12, cz - 13, 1.4], [cx - 9, cz - 14, 1.1], [cx - 12, cz + 13, 1.5], [cx + 8, cz + 14, 1.2], [cx + 10, cz - 14, 1.3]]) {
    meshA(K, new THREE.IcosahedronGeometry(s, 1), PODG, x, h + s, z, { scale: [1, 0.85, 1], glow: 0.3 });
    solid(K, x - s, h, z - s, x + s, h + s * 1.7, z + s);
  }
  for (const [x, z] of [[cx + 10, cz + 12], [cx + 6, cz - 13]]) TK.crateHeap(K, x, z);
  // the raised throne dais at the west end, lit from below
  A(K, cx - 8, h, cz, 8, 0.8, 11, 0x3a3634, { collide: true });
  A(K, cx - 3.9, h + 0.2, cz, 0.1, 0.12, 9, 0xbfe4ff, { glow: 2 });
  for (const s of [-1, 1]) A(K, cx - 3.6, h, cz + s * 3, 0.8, 0.4, 2, 0x3a3634, { collide: true });
  lampA(K, cx - 5, h + 1.2, cz, 0xffe0a0, 9, 14);
  lampA(K, cx - 2, h + 4.5, cz, 0xfff0d0, 10, 14); // a lamp on him from the front
}

// ------------------------------------------------------------------ the Rift and the chained rocks

function rift(K) {
  // Fallen cranes with cradles hanging over the edges; supply heaps and shacks for the camps
  crane(K, -20, 36, 16, -2.4, 14); crane(K, 22, 64, 14, 0.7, 12); crane(K, -90, 52, 15, -0.8, 12); crane(K, 92, 22, 14, 2.3, 12);
  crane(K, 44, 92, 11, 0.6, 9); crane(K, -46, 98, 10, -0.6, 8);
  for (const [x, z] of [[-10, 56], [14, 40], [-80, 30], [-68, 52], [70, 22], [86, 44], [36, 84], [-40, 86]]) supplies(K, x, z);
  for (const [x, z, face] of [[-24, 62, 'e'], [24, 34, 'w'], [-92, 36, 'e'], [62, 34, 'e'], [94, 36, 'w']]) TK.shanty(K, x, z, K.R(4, 6), K.R(3.5, 5), K.R(3, 4), face, { upper: 0.3 });
  // rusted deck plating laid over parts of the rock, and scrap
  for (const [x, z, w, d] of [[8, 50, 14, 10], [-80, 44, 10, 8], [76, 30, 12, 10]]) A(K, x, G(K, x, z) - 0.3, z, w, 0.36, d, pick(K, RUST));
  for (const [x, z, r] of [[-26, 46, 2], [26, 54, 1.6], [-94, 24, 2.2], [96, 50, 1.8]]) TK.junkPile(K, x, z, r);
  for (const [x, z] of [[-8, 34], [12, 68], [-74, 24], [70, 50]]) TK.minePod(K, x, z);
}

/** Four-Holed Cove: a rock wall round the north of the cove holed through to the abyss, and a Fallen camp in its shelter. */
function cove(K) {
  TK.holedWall(K, 'x', -42.5, -22, 22, 15, 3, [[-18, -12, 2.5, 9], [-6, 0, 3, 11], [5, 11, 2.5, 9], [14, 19, 3.5, 10]]);
  for (const s of [-1, 1]) TK.holedWall(K, 'z', s * 22.5, -41, -22, 12, 3, [[-36, -30, 2.5, 8]]); // walls and buttresses stay inside the island
  for (const [x, z, face] of [[-14, -32, 's'], [14, -36, 's']]) TK.shanty(K, x, z, 5, 4, 3.2, face, { upper: 0.4 });
  supplies(K, 4, -40); supplies(K, -6, -22);
  banner(K, -20, -14, 9); banner(K, 20, -14, 9);
  TK.junkPile(K, 18, -22, 1.8);
}

// ------------------------------------------------------------------ Jetsam of Saturn: the crashed Hive ship

const HOLD = { cx: -112, cz: -120, w: 60, d: 26, h: 10 };
function hulk(K) {
  const h = G(K, -112, -96), { cx, cz, w, d } = HOLD;
  // the hold: a long dark hall inside the hull, two openings on its south face, Hive growth and crystals, green light
  hall(K, cx, cz, w, d, HOLD.h, { doors: { s: 7 }, breaks: [['s', 6, 11]], color: 0x2e3230, roofColor: 0x262a28, ceil: 0x1c201e, lamp: 0x9aff7a, lamps: 4, windows: false,
    props: (KK) => {
      for (const [x, z, s] of [[cx - 20, cz - 6, 1.4], [cx + 18, cz - 8, 1.6], [cx - 4, cz + 8, 1.2], [cx + 24, cz + 6, 1.1]]) TK.hiveGrowth(KK, x, z, s, 0, true);
      TK.hiveCrystals(KK, cx + 6, cz - 7, 0.9);
      for (const [x, z] of [[cx - 26, cz - 8], [cx - 12, cz - 9], [cx + 12, cz + 9]]) A(KK, x, h, z, 3, 4, 2, pick(KK, HULLC), { collide: true });
    } });
  // ribs inside the hold: arches of hull frame
  for (let x = cx - w / 2 + 6; x < cx + w / 2; x += 9) for (const s of [-1, 1]) beamA(K, [x, h, cz + s * (d / 2 - 0.6)], [x, h + HOLD.h - 0.4, cz + s * (d / 2 - 3)], 0.35, HULLC[1]);
  // the hull outside: solid blocks either end of the hold, the great body above and overhanging the south, plated and lit with small green lights
  for (const [x0, x1] of [[-157, cx - w / 2 - 0.5], [cx + w / 2 + 0.5, -67]]) { A(K, (x0 + x1) / 2, h, -121, x1 - x0, HOLD.h + 2, 34, pick(K, HULLC), { collide: true }); }
  A(K, cx, h - 0.5, -136, w + 2, HOLD.h + 2, 3.6, HULLC[0], { collide: true }); // set in from the island's edge (no shared face with the rock)
  const HY = h + HOLD.h + 0.6;
  A(K, -112, HY, -122, 92, 24, 36, HULLC[0], { rx: -0.05 });
  A(K, -112, HY + 3, -98, 88, 14, 14, HULLC[1], { rx: 0.12 }); // the overhang over the debris slope
  A(K, -112, HY + 22, -122, 70, 10, 26, HULLC[2], { rz: 0.06 });
  for (let i = 0; i < 28; i++) A(K, K.R(-154, -70), HY + K.R(2, 30), -103.5 - K.R(0, 18), K.R(4, 10), K.R(1.5, 4), 0.6, pick(K, HULLC), { rx: K.R(-0.2, 0.2) });
  for (let x = -150; x <= -74; x += 6) A(K, x, HY + 2.5, -91.2, 0.5, 0.4, 0.3, HULLG, { glow: 2.4, rx: 0.12 });
  for (const x of [-140, -112, -84]) { meshA(K, new THREE.TorusGeometry(2.4, 0.4, 6, 14), HULLC[2], x, HY + 6, -90.6, { rx: 0.12 }); meshA(K, new THREE.SphereGeometry(0.9, 8, 6), HULLG, x, HY + 6, -90.4, { glow: 3 }); }
  for (const [x, z] of [[-150, -92], [-74, -92]]) meshA(K, new THREE.SphereGeometry(6, 10, 6, 0, TAU, 0, Math.PI / 2), HULLC[1], x, HY + 23, z - 28);
  // the green glow spilling out of the hold, and lights along the slope
  for (const x of [-112, -134]) lampA(K, x, h + 3, -104, 0x9aff7a, 10, 22);
  lampA(K, -96, h + 4, -78, 0x9aff7a, 6, 20);
  // the debris slope under the overhang: fallen plates, rocks, Hive growth, plank walkways with rope rails, a round pad and a dome turret
  for (const [x, z, s] of [[-146, -86, 3], [-124, -94, 2.4], [-88, -92, 2.8], [-76, -70, 2.2], [-150, -62, 2.6]]) { const col = pick(K, ROCK), ry = K.R(0, TAU); meshA(K, new THREE.DodecahedronGeometry(s, 0), col, x, h + s * 0.4, z, { ry, scale: [1.2, 0.7, 1.1] }); K.ocollider(x, z, s * 1.9, s * 1.1, s * 1.7, ry, h - K.ground(x, z)); } // H17: collider turned with the rock
  for (const [x, z, a] of [[-136, -96, 0.5], [-100, -98, -0.4], [-82, -84, 0.3]]) TK.solidTilted(K, A(K, x, h - 0.3, z, 7, 0.4, 4, pick(K, HULLC), { ry: a, rz: 0.25 }), 0.5); // H17: fallen plate, collider follows its tilt
  for (const [x, z, s] of [[-120, -84, 1.2], [-142, -76, 1.4], [-92, -74, 1], [-104, -94, 1.3]]) TK.hiveGrowth(K, x, z, s);
  for (const [x0, z0, x1, z1] of [[-150, -70, -130, -70], [-86, -64, -86, -84]]) {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    for (let t = 0.6; t < L; t += 0.8) A(K, x0 + (x1 - x0) * t / L, h + 0.02, z0 + (z1 - z0) * t / L, 2.4, 0.14, 0.55, pick(K, WOOD), { ry });
    for (const s of [-1, 1]) for (let t = 0; t <= L; t += 4) A(K, x0 + (x1 - x0) * t / L + Math.cos(ry) * s * 1.3, h, z0 + (z1 - z0) * t / L - Math.sin(ry) * s * 1.3, 0.14, 1.1, 0.14, WOOD[0]);
  }
  meshA(K, new THREE.CylinderGeometry(6, 6.4, 0.5, 16), STEEL, -140, h + 0.1, -66);
  meshA(K, new THREE.TorusGeometry(5.2, 0.12, 4, 24), HULLG, -140, h + 0.4, -66, { rx: Math.PI / 2, glow: 1.6 });
  meshA(K, new THREE.SphereGeometry(3, 10, 6, 0, TAU, 0, Math.PI / 2), HULLC[2], -72, h, -64);
  A(K, -72, h + 2.2, -61, 0.5, 0.5, 4, IRON);
  solid(K, -75, h, -67, -69, h + 3, -61);
}

// ------------------------------------------------------------------ the Scorn flats and Trapper's Cave

/** A dark boulder with a white Scorn sigil painted on its face. */
function sigilRock(K, x, z, s, ry) {
  const g = G(K, x, z), fx = Math.sin(ry), fz = Math.cos(ry);
  meshA(K, new THREE.DodecahedronGeometry(s, 0), ROCKD, x, g + s * 0.5, z, { ry, scale: [1.4, 0.9, 0.9] });
  K.ocollider(x, z, s * 2.2, s * 1.2, s * 1.5, ry, g - K.ground(x, z)); // H17: turned with the rock (it is 1.4 long by 0.9 across)
  const px = x + fx * s * 0.86, pz = z + fz * s * 0.86, y = g + s * 0.6;
  A(K, px, y - 0.5, pz, 0.14, 1.1, 0.05, 0xeeeae0, { ry, glow: 0.6 });
  meshA(K, new THREE.TorusGeometry(0.32, 0.06, 4, 10), 0xeeeae0, px, y + 0.4, pz, { ry, glow: 0.6 });
  for (const s2 of [-1, 1]) for (const dy of [-0.2, 0.25]) A(K, px - fz * s2 * 0.32, y + dy, pz + fx * s2 * 0.32, 0.5, 0.07, 0.05, 0xeeeae0, { ry, rz: s2 * 0.5, glow: 0.6 });
}

function flats(K) {
  const h = G(K, 96, -100);
  A(K, 96, h - 0.1, -100, 111.6, 0.16, 95.6, SAND); // pale sand over the whole island
  for (let i = 0; i < 70; i++) { // dry scrub
    const x = K.R(44, 148), z = K.R(-146, -54);
    if (Math.hypot(x - 96, z + 104) < 18 || (x > 126 && z > -94 && z < -70)) continue;
    for (let k = 0; k < 3; k++) meshA(K, new THREE.ConeGeometry(K.R(0.3, 0.6), K.R(0.5, 1.1), 4), pick(K, SCRUB), x + K.R(-0.6, 0.6), h + 0.4, z + K.R(-0.6, 0.6), { rz: K.R(-0.4, 0.4) }).userData.noCollide = true; // H17: scrub tufts
  }
  for (const [x, z, s, ry] of [[60, -64, 2.4, 0.6], [104, -70, 2.8, 2.6], [70, -118, 2.6, -1.2], [140, -110, 2.2, -2.2], [118, -140, 2.6, 0.2], [52, -96, 2.2, 1.4]]) sigilRock(K, x, z, s, ry);
  for (const [x, z, s] of [[86, -66, 1.6], [56, -132, 2], [146, -140, 1.8], [120, -118, 1.4], [76, -92, 1.2]]) { const ry = K.R(0, TAU); meshA(K, new THREE.DodecahedronGeometry(s, 0), ROCKD, x, h + s * 0.35, z, { ry, scale: [1.3, 0.6, 1] }); K.ocollider(x, z, s * 2.1, s * 0.9, s * 1.6, ry, h - K.ground(x, z)); } // H17: collider turned with the rock
  for (const [x, z, ry] of [[62, -140, 0.4], [132, -126, -0.9], [88, -136, 1.8]]) TK.ribs(K, x, z, ry, 10, 7, 3, 4);
  // the totem ring the Scorn haul their ether to (the event), cans stacked round it
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; TK.totem(K, 96 + Math.cos(a) * 15, -104 + Math.sin(a) * 15, 6.5); }
  for (const [x, z] of [[92, -100], [100, -106], [96, -110], [90, -108]]) TK.etherCan(K, x, z, 0.6, 1.8);
  lampA(K, 96, h + 4, -104, 0xbfe4ff, 9, 26);
  for (const [x, z, len, ax] of [[74, -80, 8, true], [118, -96, 8, false], [80, -126, 10, true], [126, -134, 8, true]]) TK.spikes(K, x, z, len, ax);
  for (const [x, z] of [[66, -82], [110, -92], [128, -128], [72, -128]]) { TK.etherCan(K, x, z); lampA(K, x, h + 2, z, 0xbfe4ff, 4, 12); }
  // Trapper's Cave: a low rock den on the east of the flats, its mouth facing west
  const cx = 138, cz = -82, w = 20, d = 18, ch = 5;
  hall(K, cx, cz, w, d, ch, { doors: { w: 6 }, color: ROCK[1], roofColor: ROCKD, ceil: 0x2a2434, lamp: 0xb46bff, lamps: 2, windows: false });
  for (let i = 0; i < 9; i++) meshA(K, new THREE.DodecahedronGeometry(K.R(3, 6), 0), pick(K, ROCK), cx + K.R(-9, 9), h + ch + K.R(0, 2), cz + K.R(-8, 8), { ry: K.R(0, TAU), scale: [1.3, 0.6, 1.2] }).userData.noCollide = true; // H17: rubble on the cave roof, out of reach
  for (const s of [-1, 1]) { // the two big rocks either side of the mouth: solid, and clear of the 6 m doorway
    const col = pick(K, ROCK), ry = K.R(0, TAU);
    meshA(K, new THREE.DodecahedronGeometry(4, 0), col, cx - w / 2 - 1, h + 2.5, cz + s * 6, { ry, scale: [0.8, 1.2, 0.9] });
    K.ocollider(cx - w / 2 - 1, cz + s * 6, 5.1, 6.5, 5.6, ry, h - K.ground(cx - w / 2 - 1, cz + s * 6)); // H17
  }
  for (const [x, z] of [[cx + 6, cz - 5], [cx + 7, cz + 5]]) TK.etherCan(K, x, z);
  TK.totem(K, cx + 7, cz, 4);
  for (let i = 0; i < 6; i++) beamA(K, [cx + K.R(-6, 6), h + 0.1, cz + K.R(-6, 6)], [cx + K.R(-6, 6), h + 0.3, cz + K.R(-6, 6)], 0.08, BONE);
  sigilRock(K, cx - w / 2 - 5, cz - 9, 2, -Math.PI / 2);
}

// ------------------------------------------------------------------ the map

export default {
  ts_patrol: {
    ...PATROL_DATA.ts_patrol,
    build(K) {
      for (const [, x0, x1, z0, z1, h, kind] of TANGLED_ISLANDS) {
        if (kind === 'i') { underside(K, x0, x1, z0, z1, h); continue; }
        const alongZ = z1 - z0 > x1 - x0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        if (alongZ) span(K, cx, z1, cx, z0, x1 - x0, kind); else span(K, x0, cz, x1, cz, z1 - z0, kind);
      }
      for (const r of TANGLED_RAMPS) span(K, r.x0, r.z0, r.x1, r.z1, r.width, r.kind);
      sky(K);
      landing(K);
      lair(K);
      rift(K);
      cove(K);
      hulk(K);
      flats(K);
    },
  },
};
