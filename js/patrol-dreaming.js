// U17g: the Dreaming City patrol zone (docs/reference/README.md, "Dreaming City patrol zone"). Islands of brown rock over a sea of cloud under a torn glowing ring: the Strand
// (the landing, a wet rocky shore under a colossal pointed Awoken arch-spire), the Divalian Mists (a cliff top under a pale palace wall) with the court of the Blind Well below it,
// the Gardens of Esila behind a narrow gorge, Rheasilvia (ivory towers joined by wide bridge decks, and the lower decks the Scorn hold), a walkable palace (a pink-lilac court,
// then a dark pillared hall with a round sunken pool), a purple crystal cavern with a stair and two hooded statues, and Aphelion's Rest (cliffside ruins, a Scorn den).
// Heights: every island is a terrain plateau and every deck, gorge, path and stair a ramp (js/patrol-data.js DREAMING_ISLANDS, DREAMING_RAMPS); the ground between them is the abyss
// under the cloud sea. Rule for this map: whatever is walked on is a whole island with its own underside or a deck anchored at both ends; nothing floats but the sky rocks.
// Placement: everything here is built at absolute heights (A, meshA, beamA) from K.ground, so nothing near an edge reads the abyss under it.
import * as THREE from 'three';
import { PATROL_DATA, DREAMING_ISLANDS, DREAMING_RAMPS } from './patrol-data.js';
import { DC_KIT as DK } from './level-dc.js';
import { TANGLED_KIT as TK } from './level-tangled.js';

const { IVORY, IVORY2, LAV, LAV2, GOLD, ICE, BLIGHT, VEIN, MOSS, MOSS2, CLOTH, VIOLET, PINK } = DK.C;
const TAU = Math.PI * 2;
const ROCK = [0x5e4e58, 0x54464f, 0x6a5a62], ROCKD = 0x34283a;                   // the brown-violet rock of the cliffs
const DARK = 0x1e1a30, DARK2 = 0x2c2644, TEAL = 0x7ff0e0, CYAN = 0x7ff0ff, GREEN = 0x6affc0;
const PINKL = 0xb894b2, PINKL2 = 0xa07c9e;                                        // the pink-lilac palace stone
const BONSAI = [0x8a8a3a, 0xb0803a, 0x6a7a3a], CRYS = [0x7a50ff, 0x9a6aff, 0x5a3ad0];
const WET = [0x5a5870, 0x626078, 0x555468, 0x6a6a86];

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
/** A light at an absolute height. */
const lampA = (K, x, y, z, color, power = 8, dist = 22) => K.light(x, y - K.ground(x, z), z, color, power, dist);
const pick = (K, a) => K.RP(a);
const G = (K, x, z) => K.ground(x, z);

/** A thin floor inlay on an island: its top sits `top` above the ground, so inlays at different tops never fight. */
const slab = (K, x, z, w, d, color, top = 0.05, o = {}) => A(K, x, G(K, x, z) + top - 0.12, z, w, 0.12, d, color, { glow: o.glow, ry: o.ry });
/** A wall from (x0, z0) to (x1, z1) along one axis, solid, standing on absolute y0; gaps are [from, to] distances along it. */
function wallA(K, x0, z0, x1, z1, y0, h, t, color, gaps = [], cap = null, glow = 0) {
  const horiz = Math.abs(x1 - x0) >= Math.abs(z1 - z0), len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0), start = horiz ? Math.min(x0, x1) : Math.min(z0, z1), fixed = horiz ? z0 : x0;
  let from = 0;
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0]).concat([[len, len]])) {
    if (a - from > 0.3) {
      const mid = start + (from + a) / 2, L = a - from;
      if (horiz) { A(K, mid, y0, fixed, L, h, t, color, { collide: true, glow: glow || undefined }); if (cap) A(K, mid, y0 + h, fixed, L, 0.2, t + 0.3, cap, { glow: 0.7 }); }
      else { A(K, fixed, y0, mid, t, h, L, color, { collide: true, glow: glow || undefined }); if (cap) A(K, fixed, y0 + h, mid, t + 0.3, 0.2, L, cap, { glow: 0.7 }); }
    }
    from = Math.max(from, b);
  }
}
/** A low rail (cover and a fence at an edge), solid, following the ground in 4 m steps. */
function rail(K, x0, z0, x1, z1, h = 1.1, color = IVORY2, cap = CYAN) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 4)), alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  for (let i = 0; i < n; i++) {
    const xa = x0 + (x1 - x0) * i / n, za = z0 + (z1 - z0) * i / n, xb = x0 + (x1 - x0) * (i + 1) / n, zb = z0 + (z1 - z0) * (i + 1) / n;
    const ga = G(K, xa, za), gb = G(K, xb, zb), lo = Math.min(ga, gb) - 0.05, x = (xa + xb) / 2, z = (za + zb) / 2, l = L / n + 0.05;
    A(K, x, lo, z, alongX ? l : 0.5, h + Math.abs(ga - gb) + 0.05, alongX ? 0.5 : l, color, { collide: true });
    if (cap) A(K, x, lo + h + Math.abs(ga - gb) + 0.05, z, alongX ? l : 0.62, 0.1, alongX ? 0.62 : l, cap, { glow: 1.2 });
  }
}

// ------------------------------------------------------------------ islands, bridges and the sky

/** The rock under an island: a slab whose sides are the cliff, boulders round the lip, and a hanging mass of rock cones tapering down into the clouds. */
function underside(K, x0, x1, z0, z1, h) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  A(K, cx, h - 7, cz, w, 6.85, d, ROCK[0]);
  const per = 2 * (w + d), n = Math.max(6, Math.round(per / 9));
  for (let i = 0; i < n; i++) {
    let t = (i + K.R(0, 0.6)) / n * per, px, pz;
    if (t < w) { px = x0 + t; pz = z0; } else if ((t -= w) < d) { px = x1; pz = z0 + t; } else if ((t -= d) < w) { px = x1 - t; pz = z1; } else { px = x0; pz = z1 - (t - w); }
    const s = K.R(2.2, 4.4);
    meshA(K, new THREE.DodecahedronGeometry(s, 0), pick(K, ROCK), px, h - s - 0.7, pz, { ry: K.R(0, TAU), scale: [1.3, 1, 1.3] });
  }
  const r0 = Math.min(w, d) * 0.5;
  meshA(K, new THREE.ConeGeometry(r0, r0 * 1.6 + 10, 7), ROCKD, cx, h - 7 - (r0 * 1.6 + 10) / 2, cz, { rx: Math.PI, ry: K.R(0, TAU) });
  const k = Math.max(2, Math.round(w * d / 600));
  for (let i = 0; i < k; i++) {
    const r = Math.min(w, d) * K.R(0.2, 0.32), len = K.R(12, 30), x = cx + K.R(-0.5, 0.5) * (w - 2 * r), z = cz + K.R(-0.5, 0.5) * (d - 2 * r);
    meshA(K, new THREE.ConeGeometry(r, len, 6), pick(K, [ROCKD, ROCK[1]]), x, h - 7 - len / 2, z, { rx: Math.PI, ry: K.R(0, TAU) });
  }
}

/**
 * A path between two islands along a ramp's centre line: a wide deck (`d`, ivory plates with cyan edge lines, a Sparrow route, arch ribs under it anchored in the rock at both ends),
 * a path on foot (`w`), the gorge floor (`g`) or the cavern stair (`s`, banded treads on the slope with a lit centre line, solid underneath). Every piece is laid at the height
 * the ramp has under it, pitched to its slope.
 */
function span(K, r) {
  const { x0, z0, x1, z1, width: w, kind } = r;
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), nx = Math.cos(ry), nz = -Math.sin(ry);
  const n = Math.max(1, Math.round(L / (kind === 's' ? 1.25 : 4)));
  const at = (t) => [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t], gy = (t) => r.h0 + (r.h1 - r.h0) * t, pitch = -Math.atan((r.h1 - r.h0) / L);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, [x, z] = at(t), y = gy(t), seg = L / n;
    if (kind === 's') {
      A(K, x, y - 0.28, z, w + 0.3, 0.36, seg + 0.05, k % 2 ? 0x3a2e5a : 0x463870, { ry, rx: pitch });
      A(K, x, y - 0.1, z, 0.34, 0.2, seg + 0.05, CYAN, { ry, rx: pitch, glow: 2 });
      if (y - 0.5 > 26.05) A(K, x, 26, z, w + 0.3, y - 0.5 - 26, seg + 0.05, 0x2a2244); // solid under the stair
    } else if (kind === 'g') {
      A(K, x, y - 0.3, z, w + 0.6, 0.38, seg + 0.05, pick(K, [0x4a3c48, 0x54464f]), { ry, rx: pitch });
    } else if (kind === 'w') {
      A(K, x, y - 0.28, z, w + 0.2, 0.36, seg + 0.05, pick(K, [IVORY2, 0xd8d0c2]), { ry, rx: pitch });
    } else {
      A(K, x, y - 0.28, z, w + 0.3, 0.36, seg + 0.05, pick(K, [IVORY2, IVORY, 0xd8d0c2]), { ry, rx: pitch });
      if (k % 2 === 0) for (const s of [-1, 1]) A(K, x + nx * s * (w / 2 - 0.3), y + 0.06, z + nz * s * (w / 2 - 0.3), 0.18, 0.06, seg * 0.9, CYAN, { ry, rx: pitch, glow: 1.5 });
    }
  }
  if (kind === 's') return;
  // the girders under both edges, and arch ribs anchored in the rock at both ends (feet below the deck, apex under its middle)
  const sag = Math.min(8, Math.max(3, L * 0.24));
  const arch = (t) => { const [x, z] = at(t); return [x, gy(t) - 0.55 - sag * 4 * (t - 0.5) ** 2, z]; };
  for (const s of [-1, 1]) {
    const o = (w / 2 - 0.6) * s, sh = (p) => [p[0] + nx * o, p[1], p[2] + nz * o];
    beamA(K, sh([x0, gy(0) - 0.8, z0]), sh([x1, gy(1) - 0.8, z1]), 0.38, kind === 'g' ? ROCK[1] : IVORY2);
    const segs = Math.max(4, Math.round(L / 3));
    for (let i = 0; i < segs; i++) beamA(K, sh(arch(i / segs)), sh(arch((i + 1) / segs)), 0.42, kind === 'g' ? ROCK[0] : IVORY);
    for (let i = 1; i < segs; i += 2) { const p = arch(i / segs); beamA(K, sh([p[0], p[1], p[2]]), sh([p[0], gy(i / segs) - 0.7, p[2]]), 0.1, kind === 'g' ? ROCK[1] : LAV2); }
  }
}

/** A floating rock in the sky (scenery): a flattened boulder with a hanging cone, sometimes with a tuft of green on top. */
function floatRock(K, x, y, z, s, moss = false) {
  meshA(K, new THREE.DodecahedronGeometry(s, 0), pick(K, ROCK), x, y, z, { rx: K.R(0, 0.4), ry: K.R(0, TAU), scale: [K.R(1, 1.4), K.R(0.5, 0.7), K.R(0.9, 1.3)] });
  meshA(K, new THREE.ConeGeometry(s * 0.7, s * 1.1, 6), ROCK[1], x, y - s * 0.8, z, { rx: Math.PI, ry: K.R(0, TAU) });
  if (moss) meshA(K, new THREE.DodecahedronGeometry(s * 0.7, 0), MOSS, x, y + s * 0.3, z, { scale: [1.1, 0.35, 1] });
}

/** A tall slender Awoken tower rising out of the cloud sea (scenery, no collider): a tapering ivory shaft, lit bands, a pointed crown. */
function distantTower(K, x, z, top, r) {
  const base = 6, h = top - base;
  meshA(K, new THREE.CylinderGeometry(r * 0.55, r, h, 8), pick(K, [IVORY, 0xcfc9d8]), x, base + h / 2, z);
  for (const f of [0.3, 0.52, 0.74]) meshA(K, new THREE.CylinderGeometry(r * (1 - f * 0.45) + 0.1, r * (1 - f * 0.45) + 0.1, 0.9, 8), GOLD, x, base + h * f, z, { glow: 0.6 });
  meshA(K, new THREE.BoxGeometry(0.5, h * 0.7, 0.1), ICE, x, base + h * 0.5, z + r * 0.8, { glow: 1.6 });
  meshA(K, new THREE.ConeGeometry(r * 0.62, h * 0.2, 8), LAV, x, top + h * 0.1, z);
  meshA(K, new THREE.OctahedronGeometry(r * 0.3, 0), ICE, x, top + h * 0.22, z, { glow: 1.6, scale: [1, 2.2, 1] });
}

function sky(K) {
  const isl = DREAMING_ISLANDS.filter((i) => i[6] === 'i');
  const over = (x, z, m) => isl.some(([, a, b, c, d]) => x > a - m && x < b + m && z > c - m && z < d + m);
  let n = 0;
  for (let tries = 0; n < 16 && tries < 400; tries++) {
    const x = K.R(-220, 220), z = K.R(-230, 220), y = K.R(80, 140), s = K.R(3, 9);
    floatRock(K, x, y, z, s, K.chance(0.5)); n++;
  }
  for (let i = 0, k = 0; i < 300 && k < 20; i++) { // low rocks out in the clouds, half lost in them
    const x = K.R(-230, 230), z = K.R(-230, 230);
    if (over(x, z, 14)) continue;
    floatRock(K, x, K.R(12, 30), z, K.R(4, 14)); k++;
  }
  // far towers rising out of the cloud sea
  for (const [x, z, top, r] of [[-104, 150, 96, 5], [-96, -108, 120, 6], [28, -204, 104, 5], [176, -70, 100, 5], [-40, -128, 84, 4], [-190, 30, 110, 6]]) distantTower(K, x, z, top, r);
}

// ------------------------------------------------------------------ the Strand

/** A boulder (rock with a collider): a squashed dodecahedron on the ground at the given absolute height. */
function boulder(K, x, z, s, o = {}) {
  const g = G(K, x, z), sy = o.sy ?? K.R(0.6, 0.95);
  meshA(K, new THREE.DodecahedronGeometry(s, 0), pick(K, o.colors ?? ROCK), x, g + s * sy * 0.55, z, { ry: K.R(0, TAU), scale: [K.R(1, 1.3), sy, K.R(0.9, 1.2)] });
  if (o.collide !== false) solid(K, x - s * 0.8, g, z - s * 0.8, x + s * 0.8, g + s * sy * 1.1, z + s * 0.8);
  if (o.moss) meshA(K, new THREE.DodecahedronGeometry(s * 0.7, 0), MOSS2, x, g + s * sy * 1.0, z, { scale: [1.2, 0.3, 1.1] });
}

/** An Awoken Corsair skiff beached on the shore: a long lavender hull, a gold keel line, a prow and a lit lantern. */
function skiff(K, x, z, ry) {
  const g = G(K, x, z), P = (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
  A(K, x, g + 0.1, z, 2.6, 0.9, 9, LAV2, { ry, rz: 0.08 });
  A(K, x, g + 0.95, z, 2.8, 0.14, 9.2, GOLD, { ry, rz: 0.08, glow: 0.5 });
  const [px, pz] = P(0, 4.9);
  meshA(K, new THREE.ConeGeometry(1.3, 3, 4), LAV2, px, g + 0.65, pz, { rx: -Math.PI / 2, ry, order: 'YXZ', scale: [1, 1, 0.5] });
  const [bx, bz] = P(0, -4.1);
  A(K, bx, g + 0.4, bz, 2.4, 1.4, 1.2, IVORY2, { ry });
  const [lx, lz] = P(0.9, 2.6);
  A(K, lx, g + 1.0, lz, 0.2, 0.55, 0.2, GOLD, { glow: 1.8 });
  solid(K, x - 1.5, g, z - 4, x + 1.5, g + 1.5, z + 4);
}

/** The colossal pointed arch-spire behind the shore: two ogive ribs of dark metal round a lit lattice of glass, and a gold-lit crown. The road runs through its opening. */
function archSpire(K, cx, cz, hw, H) {
  const g = G(K, cx, cz);
  // one ogive rib: two circular arcs meeting at a point, from the spring line on the ground to the apex; `inset` narrows and lowers it
  const rib = (inset, r, color, zoff) => {
    const half = hw - inset, H2 = H - inset * 1.4, R2 = (H2 * H2 + half * half) / (2 * half), a2 = Math.asin(H2 / R2);
    for (const s of [-1, 1]) {
      let prev = null;
      for (let i = 0; i <= 14; i++) {
        const a = a2 * i / 14, p = [cx + s * (R2 * Math.cos(a) - (R2 - half)), g + R2 * Math.sin(a), cz + zoff];
        if (prev) beamA(K, prev, p, r, color);
        prev = p;
      }
    }
  };
  rib(0, 1.35, 0x2a2848, 0); rib(2.6, 0.8, 0x3a3862, 0.6); rib(5.2, 0.5, 0x2a2848, -0.5);
  // the glass: a lit lattice of cyan bars inside the lower opening, behind the ribs
  const lw = hw * 0.62, lh = H * 0.5;
  for (let i = -4; i <= 4; i++) {
    const x = cx + i * lw / 4.5, top = Math.sqrt(Math.max(0, 1 - (i / 4.5) ** 2)) * lh;
    A(K, x, g + 6 + (lh - top) * 0.15, cz + 2.6, 0.22, Math.max(2, top - 4), 0.2, CYAN, { glow: 1.5 });
  }
  for (let k = 1; k <= 5; k++) { const w = lw * 2 * Math.sqrt(Math.max(0.05, 1 - ((k * lh / 6 - lh * 0.3) / lh) ** 2)) * 0.9; A(K, cx, g + 6 + k * lh / 6.4, cz + 2.6, w, 0.2, 0.12, TEAL, { glow: 1.3 }); }
  for (let k = 0; k < 6; k++) { // the glass behind the lattice, faintly lit, stepped to the point of the arch
    const w = lw * 2.1 * Math.sqrt(Math.max(0.08, 1 - (k / 6) ** 2.2));
    A(K, cx, g + 4 + k * lh * 0.95 / 6, cz + 1.4, w, lh * 0.95 / 6 + 0.02, 0.5, 0x123a4a, { glow: 0.5 });
  }
  // legs: the bases are solid blocks, with gold bands
  for (const s of [-1, 1]) {
    A(K, cx + s * (hw + 0.2), g, cz, 4.4, 16, 5, 0x2a2848, { collide: true });
    A(K, cx + s * (hw + 0.2), g + 16, cz, 4.7, 0.5, 5.3, GOLD, { glow: 0.7 });
    lampA(K, cx + s * (hw - 3), g + 5, cz + 3, CYAN, 7, 24);
  }
  meshA(K, new THREE.OctahedronGeometry(1.4, 0), GOLD, cx, g + H + 2.4, cz, { glow: 1.8, scale: [0.7, 2, 0.7] });
  lampA(K, cx, g + 12, cz + 8, 0xbfe8ff, 10, 40);
}

function strand(K) {
  // wet flat stone: slabs of blue-grey rock, each at its own height above the floor so none fight; small glinting pools
  slab(K, 0, 150, 56, 36, WET[0], 0.05); slab(K, -30, 164, 30, 20, WET[1], 0.07); slab(K, 30, 160, 28, 28, WET[2], 0.09); slab(K, -6, 132, 24, 12, WET[3], 0.11);
  for (const [x, z, r] of [[-12, 156, 3.4], [14, 146, 4.2], [-24, 140, 2.6], [6, 168, 3.2], [26, 134, 2.8]]) A(K, x, G(K, x, z) + 0.07, z, r * 2, 0.08, r * 1.7, 0x7a8ac0, { glow: 0.25, ry: K.R(0, 3) });
  // the cliffs at either side, tall angular rock, and a ring of boulders round the shore
  for (const s of [-1, 1]) for (const [dz, sc, hh] of [[0, 8, 1.6], [14, 7, 1.3], [-12, 6.5, 1.2], [26, 6, 1.0], [-24, 5.5, 1.1]]) {
    const x = s * 46, z = 146 + dz, g = G(K, x, z);
    meshA(K, new THREE.DodecahedronGeometry(sc, 0), pick(K, ROCK), x, g + sc * hh * 0.7, z, { ry: K.R(0, TAU), scale: [1.1, hh, 1.2] });
    solid(K, x - sc * 0.8, g, z - sc * 0.8, x + sc * 0.8, g + sc * hh * 1.2, z + sc * 0.8);
  }
  for (const [x, z, s] of [[-34, 172, 3.4], [-20, 174, 2.6], [-6, 175, 3.8], [12, 174, 3], [26, 172, 3.6], [38, 170, 2.8], [-40, 122, 3], [38, 122, 3.4], [-44, 160, 3.2], [44, 164, 3]]) boulder(K, x, z, s, { moss: K.chance(0.3) });
  for (const [x, z, s] of [[-22, 150, 1.2], [20, 156, 1.4], [-28, 128, 1.6], [34, 140, 1.2], [4, 138, 1], [-12, 168, 1.3]]) boulder(K, x, z, s);
  // the arch-spire and its two guard lamps; the road passes between the legs
  archSpire(K, 0, 126, 15, 56);
  // the Corsair post: a low ivory dais under a lavender awning, banners, crates and a brazier, and two beached skiffs
  const px = -30, pz = 140, gp = G(K, px, pz);
  A(K, px, gp, pz, 9, 0.4, 7, IVORY2, { collide: true });
  for (const [dx, dz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) A(K, px + dx, gp + 0.4, pz + dz, 0.4, 3.4, 0.4, LAV2, { collide: true });
  A(K, px, gp + 3.8, pz, 10, 0.2, 8, CLOTH, { rz: 0.06 });
  for (const [dx, dz] of [[-2.4, 0], [2.6, 1.4]]) A(K, px + dx, gp + 0.4, pz + dz, 1.2, 1.0, 1.2, pick(K, [IVORY2, LAV]), { collide: true });
  A(K, px, gp + 0.4, pz - 2.4, 5, 0.9, 0.5, GOLD, { glow: 0.4 });
  lampA(K, px, gp + 3.2, pz, GOLD, 7, 22);
  for (const [x, z] of [[-18, 128], [18, 128], [-40, 150], [40, 150]]) DK.banner(K, x, z, 6.5);
  for (const [x, z] of [[-14, 160], [26, 150]]) DK.brazier(K, x, z, VIOLET, 0.9);
  skiff(K, -36, 168, 0.5); skiff(K, 32, 169, -0.4);
  for (const [x, z] of [[10, 128], [-10, 134]]) DK.lamp(K, x, z, 4.5);
}

// ------------------------------------------------------------------ the Divalian Mists and the court of the Blind Well

/** A thin pale spire with a glowing tip, on the palace wall. */
function wallSpire(K, x, y, z, h) {
  A(K, x, y, z, 1.3, h * 0.55, 1.3, IVORY2);
  meshA(K, new THREE.ConeGeometry(0.85, h * 0.6, 5), IVORY, x, y + h * 0.55 + h * 0.3, z);
  meshA(K, new THREE.OctahedronGeometry(0.4, 0), ICE, x, y + h * 0.55 + h * 0.62, z, { glow: 1.6, scale: [1, 2, 1] });
}

function mists(K) {
  const h = 33;
  slab(K, 0, 76, 120, 44, 0x587a56, 0.05); // grass
  slab(K, 0, 76, 8, 48, IVORY2, 0.07); slab(K, -32, 76, 62, 6, IVORY2, 0.07); slab(K, 34, 66, 62, 6, IVORY2, 0.09); // the paths: north-south, west to the gorge, east to the bridge
  for (let i = 0; i < 44; i++) { const x = K.R(-62, 62), z = K.R(54, 98); if (Math.abs(x) < 6 || (Math.abs(z - 76) < 4 && x < 0) || (Math.abs(z - 66) < 4 && x > 0)) continue; meshA(K, new THREE.ConeGeometry(K.R(0.25, 0.5), K.R(0.5, 1.1), 4), pick(K, [MOSS, MOSS2, 0x7a9a5a]), x, G(K, x, z) + 0.4, z, { rz: K.R(-0.4, 0.4) }); }
  // the pale palace wall along the east edge, with the gate for the bridge, and along the north edge with the gate for the descent to the court
  wallA(K, 65, 52, 65, 100, h, 7, 1.4, IVORY2, [[7, 21]], GOLD);
  wallA(K, -66, 53, 66, 53, h, 5.5, 1.4, IVORY2, [[56, 76]], GOLD);
  for (let z = 56; z < 100; z += 11) { if (z > 56 && z < 78) continue; wallSpire(K, 65, h + 7, z, 14); }
  for (const x of [-56, -34, 34, 56]) wallSpire(K, x, h + 5.5, 53, 11);
  for (const z of [59, 73]) { A(K, 65, h, z, 2.4, 10, 2.4, IVORY, { collide: true }); A(K, 65, h + 10, z, 2.8, 0.5, 2.8, GOLD, { glow: 0.8 }); meshA(K, new THREE.OctahedronGeometry(0.7, 0), ICE, 65, h + 11.6, z, { glow: 1.6, scale: [1, 2, 1] }); lampA(K, 63, h + 6, z, GOLD, 7, 24); }
  // the ribbed dome and the round sealed door in the east wall
  const dx = 59, dz = 90;
  meshA(K, new THREE.CylinderGeometry(7.5, 7.8, 3, 14), IVORY2, dx, h + 1.5, dz);
  meshA(K, new THREE.SphereGeometry(7.5, 14, 7, 0, TAU, 0, Math.PI / 2), LAV, dx, h + 3, dz, { scale: [1, 0.85, 1] });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; beamA(K, [dx + Math.cos(a) * 7.6, h + 3, dz + Math.sin(a) * 7.6], [dx, h + 9.5, dz], 0.16, IVORY); }
  meshA(K, new THREE.OctahedronGeometry(0.7, 0), ICE, dx, h + 10.2, dz, { glow: 1.6, scale: [1, 2, 1] });
  solid(K, dx - 6, h, dz - 6, dx + 6, h + 5, dz + 6);
  meshA(K, new THREE.CylinderGeometry(2.6, 2.6, 0.3, 16), 0x2a2440, 64.2, h + 3.6, 84, { rz: Math.PI / 2, glow: 0.1 });
  meshA(K, new THREE.TorusGeometry(2.7, 0.22, 6, 20), GOLD, 64.0, h + 3.6, 84, { ry: Math.PI / 2, glow: 1.4 });
  meshA(K, new THREE.TorusGeometry(1.4, 0.12, 6, 16), CYAN, 63.9, h + 3.6, 84, { ry: Math.PI / 2, glow: 1.8 });
  // drifting mist, torn banners, a ruin or two, and the blight the Taken carry in
  for (const [x, z, r] of [[-30, 70, 14], [20, 88, 16], [-10, 62, 12], [40, 76, 12], [-48, 90, 12], [0, 94, 14]]) DK.mist(K, x, z, r, 0.55, 0.3);
  for (const [x, z] of [[58, 56], [58, 96], [-60, 58]]) DK.banner(K, x, z, 6.5);
  DK.ruin(K, -14, 90, 0.4, 1.1); DK.ruin(K, 24, 60, -0.3, 1);
  DK.blight(K, -42, 84, 1.8); DK.blight(K, 14, 94, 1.5); DK.blight(K, 48, 86, 1.6, { light: true }); DK.blight(K, -20, 60, 1.4);
  for (const [x, z] of [[-6, 90], [6, 62], [-40, 78], [36, 68]]) DK.lamp(K, x, z, 4.2);
  for (const [x, z] of [[-34, 62], [40, 94]]) boulder(K, x, z, 2.4, { moss: true });
}

const WELL = { x: 0, z: 10 };
function court(K) {
  const h = 28, { x: wx, z: wz } = WELL;
  slab(K, 0, 10, 62, 50, 0x4a4660, 0.05);
  // the round plate: a dark disc with a cyan ring, and a pale dais under the Well
  meshA(K, new THREE.CylinderGeometry(9.6, 9.8, 0.3, 36), 0x24222e, wx, h - 0.08, wz);
  meshA(K, new THREE.CylinderGeometry(9.9, 9.9, 0.2, 36), 0x5a566e, wx, h - 0.1, wz, { scale: [1, 1, 1] });
  meshA(K, new THREE.TorusGeometry(8.6, 0.13, 5, 56), CYAN, wx, h + 0.1, wz, { rx: Math.PI / 2, glow: 2.4 });
  meshA(K, new THREE.TorusGeometry(4.6, 0.07, 4, 40), TEAL, wx, h + 0.1, wz, { rx: Math.PI / 2, glow: 1.4 });
  meshA(K, new THREE.CylinderGeometry(3.6, 3.7, 0.2, 24), 0x6a8a92, wx, h - 0.05, wz, { glow: 0.2 });
  // the Blind Well: a glowing cyan column, a mushroom cap of dark ribs and a pale underlight
  meshA(K, new THREE.CylinderGeometry(1.15, 1.15, 9, 12), TEAL, wx, h + 4.5, wz, { glow: 1.7 });
  meshA(K, new THREE.CylinderGeometry(1.7, 2.1, 0.7, 12), 0x2a2848, wx, h + 0.35, wz);
  meshA(K, new THREE.CylinderGeometry(4.7, 4.7, 0.25, 20), TEAL, wx, h + 9.3, wz, { glow: 1.5 });
  meshA(K, new THREE.SphereGeometry(5.6, 16, 7, 0, TAU, 0, Math.PI / 2), 0x241c36, wx, h + 9.5, wz, { scale: [1, 0.55, 1] });
  meshA(K, new THREE.TorusGeometry(5.6, 0.22, 5, 24), 0x3a3262, wx, h + 9.5, wz, { rx: Math.PI / 2 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    beamA(K, [wx + Math.cos(a) * 5.3, h + 9.5, wz + Math.sin(a) * 5.3], [wx + Math.cos(a + 0.5) * 2.0, h + 0.7, wz + Math.sin(a + 0.5) * 2.0], 0.2, DARK2);
    beamA(K, [wx + Math.cos(a) * 5.0, h + 10.9, wz + Math.sin(a) * 5.0], [wx, h + 12.1, wz], 0.1, 0x3a3262);
  }
  meshA(K, new THREE.SphereGeometry(0.35, 8, 6), CYAN, wx, h + 12.3, wz, { glow: 2.4 });
  solid(K, wx - 2.2, h, wz - 2.2, wx + 2.2, h + 9, wz + 2.2);
  lampA(K, wx, h + 6, wz, CYAN, 12, 40);
  lampA(K, wx + 12, h + 3, wz + 6, 0x8a9aff, 6, 30);
  // the ring of dark needle spires round the court, and a low curved wall between them with a gate on the south, north and east
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * TAU + 0.2, x = wx + Math.cos(a) * 27, z = wz + Math.sin(a) * 25, hh = K.R(17, 26), g = G(K, x, z);
    if (z < -14 || z > 34 || Math.abs(x) > 30) continue;
    const gate = (Math.abs(x) < 9 && (z > 28 || z < -8)) || (x > 24 && Math.abs(z - 8) < 8);
    if (gate) continue;
    meshA(K, new THREE.ConeGeometry(1.5, hh, 5), 0x1c1830, x, g + hh / 2, z, { ry: K.R(0, 3) });
    meshA(K, new THREE.OctahedronGeometry(0.45, 0), CYAN, x, g + hh + 0.5, z, { glow: 1.3, scale: [1, 2, 1] });
    solid(K, x - 1, g, z - 1, x + 1, g + hh * 0.8, z + 1);
  }
  const skip = (a) => { const x = Math.cos(a), z = Math.sin(a); return (Math.abs(x) < 0.34 && Math.abs(z) > 0.9) || (x > 0.9 && Math.abs(z) < 0.34); };
  const N = 28;
  for (let i = 0; i < N; i++) {
    const a = (i + 0.5) / N * TAU;
    if (skip(a)) continue;
    const r = 22.5, x = wx + Math.cos(a) * r, z = wz + Math.sin(a) * r * 0.98;
    K.obox(x, z, 5.2, 1.5, 1.1, Math.atan2(-Math.cos(a), -Math.sin(a)), 0x3a3454);
    K.obox(x, z, 5.2, 0.2, 1.3, Math.atan2(-Math.cos(a), -Math.sin(a)), CYAN, { y: 1.5, collide: false, glow: 1.2 });
  }
  for (const [x, z, r] of [[-20, 16, 12], [18, -2, 12], [-10, 30, 10]]) DK.mist(K, x, z, r, 0.55, 0.28);
  DK.blight(K, -24, 4, 1.4); DK.blight(K, 24, 26, 1.3);
}

// ------------------------------------------------------------------ the gorge and the Gardens of Esila

function gorge(K) {
  // sheer rock walls along the gorge, taller than a jump, with the overgrown arch over its mouth
  const r = DREAMING_RAMPS.find((q) => q.id === 'gorge');
  for (const s of [-1, 1]) {
    const z = 76 + s * 5.1;
    A(K, -78, 8, z, 25, 48, 3, pick(K, ROCK), { collide: true });
    for (let x = -66; x >= -90; x -= 5) meshA(K, new THREE.DodecahedronGeometry(K.R(2.2, 3.6), 0), pick(K, ROCK), x - 1, 55 + K.R(-2, 2), z + s * 0.4, { ry: K.R(0, TAU), scale: [1.3, 1.1, 1] });
    for (let x = -68; x > -90; x -= 7) meshA(K, new THREE.ConeGeometry(0.9, K.R(3, 6), 5), 0x4a6a42, x, 58 + K.R(0, 2), z - s * 0.5, { rz: K.R(-0.3, 0.3) });
  }
  const ax = -74, y = r.h0 + (r.h1 - r.h0) * 8 / 24;
  for (const s of [-1, 1]) { A(K, ax, y - 0.3, 76 + s * 4.3, 1.9, 11, 1.6, IVORY2); A(K, ax, y + 10.7, 76 + s * 4.3, 2.4, 0.5, 2.0, MOSS); }
  A(K, ax, y + 11, 76, 2.2, 1.4, 10.8, IVORY);
  A(K, ax, y + 12.4, 76, 2.5, 0.7, 11, MOSS, { rx: 0.03 });
  for (let i = 0; i < 9; i++) A(K, ax + K.R(-0.6, 0.6), y + 11 - K.R(2.5, 5), 76 + K.R(-4.6, 4.6), 0.12, K.R(2.5, 5), 0.12, pick(K, [MOSS, MOSS2, 0x3a5a38]));
  meshA(K, new THREE.OctahedronGeometry(0.6, 0), GOLD, ax, y + 13.5, 76, { glow: 1.4, scale: [1, 1.6, 1] });
  lampA(K, ax + 3, y + 7, 76, 0xd8ffd0, 6, 20);
}

/** A gnarled bonsai: a bent trunk and three flattened clouds of leaves. */
function bonsai(K, x, y, z, s = 1) {
  const lean = K.R(-0.3, 0.3), col = pick(K, BONSAI);
  meshA(K, new THREE.CylinderGeometry(0.1 * s, 0.2 * s, 2.2 * s, 5), 0x4a3a2e, x, y + 1.1 * s, z, { rz: lean });
  for (const [dx, dy, dz, k] of [[0, 2.5, 0, 1.2], [0.9, 1.9, 0.4, 0.8], [-0.8, 2.1, -0.5, 0.9]]) meshA(K, new THREE.IcosahedronGeometry(0.9 * s * k, 0), col, x + dx * s + lean * 1.2, y + dy * s, z + dz * s, { scale: [1.4, 0.55, 1.2] });
}

/** A round planter: an ivory rim, dark soil, a mossy boulder and a bonsai. */
function planter(K, x, z, r, o = {}) {
  const g = G(K, x, z);
  meshA(K, new THREE.CylinderGeometry(r, r * 1.04, 0.9, 12), IVORY2, x, g + 0.45, z);
  meshA(K, new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.1, 12), 0x3a4a34, x, g + 0.92, z);
  solid(K, x - r * 0.82, g, z - r * 0.82, x + r * 0.82, g + 0.95, z + r * 0.82);
  meshA(K, new THREE.DodecahedronGeometry(r * 0.45, 0), pick(K, [ROCK[0], 0x5a6a48]), x + r * 0.25, g + 1.2, z - r * 0.1, { ry: K.R(0, 3), scale: [1.1, 0.8, 1] });
  meshA(K, new THREE.DodecahedronGeometry(r * 0.3, 0), MOSS2, x + r * 0.25, g + 1.55, z - r * 0.1, { scale: [1.2, 0.35, 1.1] });
  if (o.tree !== false) bonsai(K, x - r * 0.28, g + 0.95, z + r * 0.15, r * 0.6);
}

/** A blade-like white pylon with a cyan edge. */
function pylon(K, x, z, h, lean = 0) {
  const g = G(K, x, z);
  A(K, x, g, z, 0.9, h, 0.55, IVORY, { collide: lean === 0, rz: lean });
  A(K, x + 0.48, g + h * 0.1, z, 0.06, h * 0.78, 0.2, CYAN, { glow: 1.5, rz: lean });
  meshA(K, new THREE.ConeGeometry(0.5, h * 0.22, 4), IVORY, x + lean * -h * 0.5, g + h + h * 0.1, z, { rz: lean, scale: [1.2, 1, 0.7] });
}

/** A curving white path made of short slabs along a polyline (a sine track over the terrace). */
function curvePath(K, pts, w, color, top) {
  for (let i = 1; i < pts.length; i++) {
    const [xa, za] = pts[i - 1], [xb, zb] = pts[i], x = (xa + xb) / 2, z = (za + zb) / 2, L = Math.hypot(xb - xa, zb - za);
    A(K, x, G(K, x, z) + top - 0.12, z, w, 0.12, L + 0.9, color, { ry: Math.atan2(xb - xa, zb - za) });
  }
}

function dome(K, cx, cz, r) {
  const g = G(K, cx, cz), mat = new THREE.MeshStandardMaterial({ color: 0x3a5a40, flatShading: true, transparent: true, opacity: 0.55, roughness: 0.9, depthWrite: false });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, TAU, 0, Math.PI / 2), mat);
  shell.position.set(cx, g + 1.2, cz); shell.scale.y = 0.85; K.scene.add(shell);
  const lat = new THREE.Mesh(new THREE.SphereGeometry(r + 0.12, 14, 7, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8aa860, wireframe: true }));
  lat.position.copy(shell.position); lat.scale.copy(shell.scale); K.scene.add(lat);
  meshA(K, new THREE.CylinderGeometry(r + 0.5, r + 0.7, 1.4, 16), IVORY2, cx, g + 0.7, cz);
  meshA(K, new THREE.OctahedronGeometry(0.8, 0), ICE, cx, g + 1.2 + r * 0.85 + 0.6, cz, { glow: 1.5, scale: [1, 2, 1] });
  // vines hanging down the dome
  for (let i = 0; i < 18; i++) { const a = K.R(0, TAU), rr = r * K.R(0.55, 0.95), y = g + 1.2 + Math.sqrt(Math.max(0, 1 - (rr / r) ** 2)) * r * 0.85; A(K, cx + Math.cos(a) * rr, y - K.R(1.5, 4), cz + Math.sin(a) * rr, 0.35, K.R(1.5, 4), 0.35, pick(K, [MOSS, 0x3a5a38, MOSS2])); }
  // the ringed door on the south side, facing the path
  const dz = cz + r - 0.2;
  A(K, cx, g + 1.4, dz + 0.2, 4.2, 5.2, 0.8, 0x2a2840);
  A(K, cx, g + 1.4, dz + 0.65, 3.0, 4.6, 0.1, 0x16202a, { glow: 0.2 });
  meshA(K, new THREE.TorusGeometry(2.7, 0.2, 6, 24), CYAN, cx, g + 7.8, dz + 0.6, { glow: 2 });
  meshA(K, new THREE.TorusGeometry(1.6, 0.12, 6, 20), TEAL, cx, g + 7.8, dz + 0.62, { glow: 1.6 });
  for (const s of [-1, 1]) A(K, cx + s * 1.95, g + 1.4, dz + 0.7, 0.14, 4.4, 0.1, CYAN, { glow: 1.6 });
  solid(K, cx - r * 0.82, g, cz - r * 0.6, cx + r * 0.82, g + 8, cz + r * 0.6);
  solid(K, cx - r * 0.6, g, cz - r * 0.82, cx + r * 0.6, g + 8, cz + r * 0.82);
  lampA(K, cx, g + 4, dz + 3, 0xcfffe0, 7, 24);
}

function gardens(K) {
  // the first terrace: grass and moss under white curving paths, planters, pylons and the creeping blight
  slab(K, -123, 84, 62, 52, 0x56744e, 0.05);
  const path1 = []; for (let i = 0; i <= 16; i++) path1.push([-123 + Math.sin(i * 0.5) * 14, 108 - i * 3.3]);
  curvePath(K, path1, 4.2, 0xe6dfcf, 0.08);
  curvePath(K, [[-104, 76], [-114, 74], [-124, 77], [-136, 75]], 3.6, 0xdcd4c2, 0.1);
  for (const [x, z, r] of [[-142, 100, 3], [-106, 98, 2.6], [-146, 72, 3.2], [-102, 64, 2.4], [-132, 62, 2.8], [-110, 84, 2.2]]) planter(K, x, z, r);
  for (const [x, z, h] of [[-100, 106, 9], [-150, 108, 8], [-96, 92, 7], [-152, 62, 9], [-114, 108, 7]]) pylon(K, x, z, h);
  DK.arcWall(K, -123, 92, 17, 0.4, 2.7, 6, 1.1, { color: IVORY2 });
  for (const [x, z] of [[-114, 88], [-134, 66]]) DK.blight(K, x, z, 1.5);
  DK.blight(K, -148, 88, 1.8); DK.blight(K, -100, 76, 1.3, { light: true });
  for (const [x, z] of [[-128, 100], [-110, 60]]) DK.lamp(K, x, z, 4.2);
  DK.mist(K, -123, 84, 18, 0.5, 0.2);
  // the second terrace
  slab(K, -128, 15, 52, 50, 0x536f4c, 0.05);
  const path2 = []; for (let i = 0; i <= 14; i++) path2.push([-128 + Math.sin(i * 0.55 + 1) * 12, 38 - i * 3.6]);
  curvePath(K, path2, 4.2, 0xe6dfcf, 0.08);
  for (const [x, z, r] of [[-146, 30, 3], [-110, 34, 2.8], [-146, 4, 3.2], [-108, 6, 2.6], [-124, 20, 2.4]]) planter(K, x, z, r);
  for (const [x, z, h] of [[-106, 40, 8], [-152, 38, 9], [-104, -6, 8], [-150, -6, 7]]) pylon(K, x, z, h);
  DK.arcWall(K, -128, 24, 15, 3.4, 5.9, 5, 1.0, { color: IVORY2 });
  DK.blight(K, -140, 14, 2.2); DK.blight(K, -112, 20, 1.8, { light: true }); DK.blight(K, -126, 0, 1.6); DK.blight(K, -144, 40, 1.5);
  for (const [x, z] of [[-122, 36], [-134, -2]]) DK.lamp(K, x, z, 4.2);
  // the rocks above: the vine-covered lattice dome on its pale ring, with white spires round the court
  slab(K, -136, -50, 56, 32, 0x4f6a48, 0.05);
  dome(K, -146, -52, 11);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3, x = -146 + Math.cos(a) * 17, z = -52 + Math.sin(a) * 13; DK.spire(K, x, z, K.R(8, 12), 0.9); }
  curvePath(K, [[-133, -34], [-140, -37], [-146, -39.5]], 4, 0xe6dfcf, 0.08);
  for (const [x, z] of [[-122, -40], [-122, -62]]) DK.blight(K, x, z, 1.7);
  DK.blight(K, -164, -60, 1.5, { light: true });
}

// ------------------------------------------------------------------ Rheasilvia: the towers and the lower decks

/** An ivory tower: a ring base, a tapering shaft with lit vertical lines and dark arched windows, gold bands and a lavender crown. */
function tower(K, x, z, r, h) {
  const g = G(K, x, z);
  meshA(K, new THREE.CylinderGeometry(r * 1.3, r * 1.4, 2, 10), IVORY2, x, g + 1, z);
  meshA(K, new THREE.CylinderGeometry(r * 0.62, r, h, 10), pick(K, [IVORY, 0xd8d2e4]), x, g + 2 + h / 2, z);
  solid(K, x - r * 1.2, g, z - r * 1.2, x + r * 1.2, g + 2, z + r * 1.2);
  solid(K, x - r * 0.75, g, z - r * 0.75, x + r * 0.75, g + 2 + h, z + r * 0.75);
  for (const f of [0.28, 0.55, 0.8]) meshA(K, new THREE.CylinderGeometry(r * (1 - f * 0.38) + 0.15, r * (1 - f * 0.38) + 0.15, 0.7, 10), GOLD, x, g + 2 + h * f, z, { glow: 0.6 });
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4, rr = r * 0.86; A(K, x + Math.cos(a) * rr, g + 6, z + Math.sin(a) * rr, 0.3, h * 0.7, 0.3, CYAN, { glow: 1.4, ry: -a }); }
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 1.2, rr = r * 0.82; A(K, x + Math.cos(a) * rr, g + 12 + i * 4, z + Math.sin(a) * rr, 1.4, 3.2, 0.2, 0x1e2440, { ry: -a + Math.PI / 2 }); }
  meshA(K, new THREE.ConeGeometry(r * 0.66, h * 0.22, 10), LAV, x, g + 2 + h + h * 0.11, z);
  meshA(K, new THREE.OctahedronGeometry(r * 0.28, 0), ICE, x, g + 2 + h + h * 0.26, z, { glow: 1.8, scale: [1, 2.2, 1] });
  lampA(K, x, g + 6, z, 0xcfe8ff, 9, 30);
}

function towers(K) {
  slab(K, 104, 64, 38, 38, IVORY2, 0.06); meshA(K, new THREE.CylinderGeometry(9, 9, 0.12, 20), 0xd8d0c2, 104, G(K, 104, 64) + 0.08 - 0.06, 64);
  tower(K, 110, 76, 4.6, 44);
  for (const [x, z] of [[88, 48], [120, 48], [88, 80]]) DK.banner(K, x, z, 6.5);
  for (const [x, z] of [[96, 74], [116, 56]]) DK.brazier(K, x, z, VIOLET, 0.8);
  rail(K, 85, 46, 85, 60, 1.1); rail(K, 85, 72, 85, 83, 1.1);
  slab(K, 106, 0, 42, 40, IVORY2, 0.06);
  tower(K, 108, -8, 4.5, 40);
  for (const [x, z] of [[88, -18], [124, 18]]) DK.banner(K, x, z, 6.5);
  DK.brazier(K, 98, 14, VIOLET, 0.8);
  // the lower decks: broken ivory colonnades the Scorn have taken, with their totems, ether and spikes
  slab(K, 164, 64, 34, 76, 0xcfc7b4, 0.06); slab(K, 164, 64, 26, 60, 0xb8b0a0, 0.08);
  rail(K, 181, 28, 181, 100, 1.2, IVORY2, null);
  for (let z = 30; z <= 98; z += 12) { const hh = z % 24 === 6 ? 9 : 4.5 + (z % 7); A(K, 152, G(K, 152, z), z, 1.6, hh, 1.6, IVORY, { collide: true }); if (hh > 8) A(K, 158, G(K, 158, z), z + 6, 2.4, 0.3, 14, IVORY2); }
  for (const [x, z, ry] of [[162, 36, 0.4], [170, 90, -0.6], [158, 66, 1.4]]) TK.totem(K, x, z, 5.5);
  for (const [x, z] of [[160, 58], [168, 70], [164, 78], [158, 46]]) TK.etherCan(K, x, z, 0.6, 1.8);
  for (const [x, z, len, ax] of [[154, 52, 8, false], [172, 52, 8, true], [152, 80, 8, false], [172, 76, 8, true]]) TK.spikes(K, x, z, len, ax);
  for (const [x, z, s] of [[158, 92, 1.8], [174, 36, 1.6]]) boulder(K, x, z, s, { colors: [ROCKD] });
  lampA(K, 164, 33, 64, 0xbfe4ff, 8, 28);
  for (const [x, z] of [[160, 40], [164, 84]]) lampA(K, x, G(K, x, z) + 2, z, 0xb480ff, 5, 16);
}

// ------------------------------------------------------------------ the palace

const PAL = { x0: 72, x1: 116, z0: -110, z1: -50, h: 40 };
function palace(K) {
  const { x0, x1, z0, z1, h } = PAL;
  slab(K, 94, -66, 42, 27.4, PINKL, 0.05); slab(K, 94, -66, 14, 26, 0xc8a8c4, 0.07); slab(K, 94, -66, 3, 26, GOLD, 0.09, { glow: 0.4 });
  slab(K, 94, -96, 42, 27.4, 0x241e34, 0.05);
  slab(K, 123, -80, 10, 58, IVORY2, 0.05);
  // the court: pink-lilac walls with a gate on the south for the bridge, a huge carved white arch on the north wall, curved planters
  wallA(K, x0 + 0.6, z1 - 1.6, x1 - 0.6, z1 - 1.6, h, 11, 1.2, PINKL2, [[15, 29]], GOLD);
  wallA(K, x0 + 0.6, z1 - 1.6, x0 + 0.6, -82, h, 11, 1.2, PINKL2, [], GOLD);
  wallA(K, x1 - 0.6, z1 - 1.6, x1 - 0.6, -82, h, 11, 1.2, PINKL2, [], GOLD);
  wallA(K, x0 + 0.6, -82, x1 - 0.6, -82, h, 13, 1.2, PINKL2, [[15, 29]], GOLD);
  for (const s of [-1, 1]) { A(K, 94 + s * 8.1, h, -81.2, 2.4, 9, 2.6, IVORY, { collide: true }); A(K, 94 + s * 8.1, h + 9, -81.2, 2.7, 0.4, 2.9, GOLD, { glow: 0.7 }); }
  meshA(K, new THREE.TorusGeometry(8.1, 1.2, 6, 20, Math.PI), IVORY, 94, h + 9, -81.2, { scale: [1, 1.05, 1.1] });
  meshA(K, new THREE.TorusGeometry(6.6, 0.18, 5, 20, Math.PI), CYAN, 94, h + 9, -80.5, { glow: 1.8 });
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) A(K, 94 + s * 8.1, h + 1 + i * 2, -80.5, 0.12, 1.1, 0.1, GOLD, { glow: 0.9 });
  for (const s of [-1, 1]) { DK.arcWall(K, 94 + s * 14, -66, 7, s < 0 ? -1.2 : 3.4, s < 0 ? 1.2 : 6.0, 5, 1.0, { color: PINKL2 }); }
  for (const [x, z] of [[78, -58], [110, -58], [78, -76], [110, -76]]) { planter(K, x, z, 2.2, { tree: false }); bonsai(K, x, G(K, x, z) + 0.95, z, 1.4); }
  for (const [x, z] of [[86, -54], [102, -54]]) DK.lamp(K, x, z, 4.5, 0xffd8f0);
  for (const x of [76, 112]) for (const z of [-60, -76]) wallSpire(K, x, h + 11, z, 11);
  lampA(K, 94, h + 6, -66, 0xffc8f0, 10, 40);
  // the hall behind it: a dark roofed hall of pillars with lattice lamps, a round sunken pool and a lit orb pedestal; its east side opens onto the strip of rock
  const H = 17;
  wallA(K, x0 + 0.6, z0 + 1.2, x1 - 0.6, z0 + 1.2, h, H, 1.2, 0x3a3254, [], null, 0.45);
  wallA(K, x0 + 0.6, z0 + 1.2, x0 + 0.6, -82, h, H, 1.2, 0x3a3254, [], null, 0.45);
  wallA(K, x1 - 0.6, z0 + 1.2, x1 - 0.6, -82, h, H, 1.2, 0x3a3254, [[8, 18]], null, 0.45);
  A(K, x0 + 1.4, h + 9, -96, 0.12, 0.3, 26, TEAL, { glow: 1.8 }); A(K, 94, h + 9, z0 + 1.9, 42, 0.3, 0.12, TEAL, { glow: 1.8 }); A(K, x1 - 1.4, h + 9, -102, 0.12, 0.3, 14, TEAL, { glow: 1.8 });
  for (const [x, z, c] of [[84, -90, 0x9a80ff], [104, -90, 0x7affd0], [84, -102, 0x7affd0], [104, -102, 0x9a80ff]]) lampA(K, x, h + 13, z, c, 12, 34);
  A(K, 94, h + H, -96, 46, 1.2, 30, 0x2a2440, { collide: true, glow: 0.3 });
  A(K, 94, h + H - 0.1, -96, 40, 0.1, 24, 0x5a4a8a, { glow: 0.6 });
  for (const x of [82, 106]) for (let z = -104; z <= -88; z += 8) {
    A(K, x, h, z, 1.8, H, 1.8, 0x1e1a30, { collide: true });
    A(K, x + 0.95, h + 1.5, z, 0.08, H * 0.6, 0.6, GREEN, { glow: 1.5 });
    for (let k = 0; k < 4; k++) A(K, x + 0.95, h + 3 + k * 3.2, z, 0.06, 0.1, 1.2, GREEN, { glow: 1.6 });
    A(K, x + 0.95, h + 0.3, z, 0.2, 1.1, 0.45, CYAN, { glow: 1.8 });
  }
  for (const [x, z] of [[82, -92], [106, -100], [94, -86]]) lampA(K, x, h + 3.5, z, 0x7affd0, 6, 20);
  // the pool: a dark ring wall, the sunken water, a cyan edge line
  meshA(K, new THREE.TorusGeometry(7.4, 0.3, 5, 36), 0x3a3454, 94, h + 0.04, -92, { rx: Math.PI / 2 });
  meshA(K, new THREE.CylinderGeometry(6.4, 6.4, 0.1, 28), 0x2a8aa0, 94, h - 0.5, -92, { glow: 0.7 });
  meshA(K, new THREE.TorusGeometry(4.6, 0.08, 4, 32), CYAN, 94, h - 0.4, -92, { rx: Math.PI / 2, glow: 1.8 });
  lampA(K, 94, h + 0.5, -92, 0x5ad8ff, 8, 22);
  // the orb pedestal at the back
  meshA(K, new THREE.CylinderGeometry(1.5, 1.9, 1.2, 8), 0x2a2848, 94, h + 0.6, -105);
  meshA(K, new THREE.CylinderGeometry(0.5, 0.8, 1.6, 8), DARK2, 94, h + 2.0, -105);
  meshA(K, new THREE.SphereGeometry(0.8, 12, 8), 0xaff8ff, 94, h + 3.4, -105, { glow: 3 });
  solid(K, 92.2, h, -106.8, 95.8, h + 2.8, -103.2);
  lampA(K, 94, h + 3.4, -104, 0xaff8ff, 9, 22);
  // the strip beside the palace: rails along the east edge, spires, a lit lamp or two
  rail(K, 129.2, -108, 129.2, -52, 1.1);
  for (const z of [-100, -80, -60]) DK.lamp(K, 123, z, 4.2);
  for (const z of [-106, -90, -74, -58]) wallSpire(K, 128, h, z, 9);
}

// ------------------------------------------------------------------ the crystal cavern

/** A hooded statue on a plinth: a tapering robed body, a hood, and both arms raised holding a glowing orb. */
function statue(K, x, z, ry) {
  const g = G(K, x, z);
  A(K, x, g, z, 4.6, 1.2, 4.6, 0x2a2848, { collide: true });
  meshA(K, new THREE.CylinderGeometry(1.1, 2.0, 8, 7), 0x2a2c58, x, g + 1.2 + 4, z, { ry });
  meshA(K, new THREE.CylinderGeometry(1.5, 1.2, 1.4, 7), 0x343868, x, g + 9, z, { ry });
  meshA(K, new THREE.ConeGeometry(1.35, 2.8, 7), 0x23264a, x, g + 10.9, z, { ry });
  for (const s of [-1, 1]) beamA(K, [x + s * 1.1, g + 8.6, z], [x + s * 0.5, g + 12.2, z + 0.5], 0.28, 0x343868);
  meshA(K, new THREE.SphereGeometry(0.8, 10, 8), CYAN, x, g + 12.9, z + 0.5, { glow: 2.6 });
  solid(K, x - 1.6, g, z - 1.6, x + 1.6, g + 9, z + 1.6);
  lampA(K, x, g + 12.9, z + 0.5, CYAN, 8, 26);
}

const CAV = { x0: -34, x1: 34, z0: -96, z1: -40, h: 26, H: 24 };
function cavern(K) {
  const { x0, x1, z0, z1, h, H } = CAV;
  const rockWall = 0x4a3a80;
  wallA(K, x0 + 0.8, z1 - 0.8, x1 - 0.8, z1 - 0.8, h, H, 1.6, rockWall, [[25, 43]], null, 0.55);
  wallA(K, x0 + 0.8, z0 + 0.8, x1 - 0.8, z0 + 0.8, h, H, 1.6, rockWall, [], null, 0.55);
  wallA(K, x0 + 0.8, z0 + 0.8, x0 + 0.8, z1 - 0.8, h, H, 1.6, rockWall, [], null, 0.55);
  wallA(K, x1 - 0.8, z0 + 0.8, x1 - 0.8, z1 - 0.8, h, H, 1.6, rockWall, [], null, 0.55);
  A(K, 0, h + H, -68, 70, 1.4, 58, 0x2a2050, { collide: true, glow: 0.3 });
  A(K, 0, h + H - 0.1, -68, 66, 0.1, 54, 0x6a4ac0, { glow: 0.8 });
  for (const s of [-1, 1]) { A(K, s * 32.2, h + 9, -68, 0.12, 0.3, 52, 0x9a7aff, { glow: 1.8 }); A(K, s * 32.2, h + 15, -68, 0.12, 0.3, 52, CYAN, { glow: 1.4 }); }
  A(K, 0, h + 12, z0 + 1.7, 64, 0.3, 0.12, 0x9a7aff, { glow: 1.8 });
  for (const [x, z, c] of [[-22, -50, 0x9a7aff], [22, -50, 0x6affd0], [-22, -74, 0x6affd0], [22, -74, 0x9a7aff], [0, -46, 0xaa8aff]]) lampA(K, x, h + 12, z, c, 13, 38);
  A(K, 0, h + 0.05 - 0.12, -68, 64, 0.12, 52, 0x2a2244); slab(K, 0, -54, 20, 24, 0x3a2e5a, 0.07); // the floor at the cavern's height (its centre is on the stair, so slab() would lift it to head height)
  slab(K, 0, -88, 48, 14, 0x34286a, 0.07); // the head of the stair
  // purple crystals along the walls and in the corners, some over a head, some tall as a pillar
  for (let i = 0; i < 26; i++) {
    const side = i % 4, t = K.R(0, 1);
    const x = side === 0 ? x0 + 3 : side === 1 ? x1 - 3 : x0 + 5 + t * 58, z = side < 2 ? z0 + 4 + t * 50 : side === 2 ? z0 + 3 : z1 - 3;
    if (side === 3 && Math.abs(x) < 11) continue;
    const g = G(K, x, z), s = K.R(1.2, 2.4), col = pick(K, CRYS);
    for (const [dx, dz, k, hh] of [[0, 0, 1, 3.4], [0.9, 0.5, 0.65, 2.2], [-0.8, 0.6, 0.55, 1.8]]) meshA(K, new THREE.ConeGeometry(0.6 * s * k + 0.1, hh * s, 5), col, x + dx * s, g + hh * s / 2, z + dz * s, { glow: 1.5, rz: dx * 0.2 });
    solid(K, x - s * 0.9, g, z - s * 0.9, x + s * 0.9, g + 2.6 * s, z + s * 0.9);
  }
  for (let i = 0; i < 8; i++) { const x = K.R(-30, 30), z = K.R(-94, -42), len = K.R(5, 11); meshA(K, new THREE.ConeGeometry(K.R(0.8, 1.6), len, 5), pick(K, CRYS), x, h + H - len / 2, z, { rx: Math.PI, glow: 1.3 }); }
  // dark pillars wrapped in green lattice lamps, either side of the way up
  for (const x of [-18, 18]) for (const z of [-50, -62]) {
    A(K, x, h, z, 2.6, H, 2.6, 0x1c1830, { collide: true });
    for (const face of [-1, 1]) {
      beamA(K, [x - 1.35 * face, h + 2, z + 1.4], [x - 1.35 * face, h + 9, z + 1.4], 0.1, GREEN, 1.6);
      beamA(K, [x - 1.35 * face, h + 9, z + 1.4], [x - 1.35 * face, h + 2, z - 1.4], 0.1, GREEN, 1.6);
    }
    A(K, x, h + 0.2, z + 1.4, 0.5, 1.1, 0.12, CYAN, { glow: 1.8 });
    lampA(K, x, h + 5, z, 0x6affc0, 6, 18);
  }
  // the stair: banded treads on the slope with a lit centre line, solid cheeks on both sides, two hooded statues holding orbs up
  for (const s of [-1, 1]) for (let z0s = -80; z0s < -60; z0s += 5) {
    const tA = (-60 - z0s) / 20, tB = (-60 - (z0s + 5)) / 20, yHigh = 26 + 7 * Math.max(tA, tB), zc = z0s + 2.5;
    A(K, s * 7.9, 26, zc, 1.2, yHigh - 26 + 1.2, 5.02, 0x2a2650, { collide: true });
    A(K, s * 7.9, yHigh + 1.2, zc, 1.4, 0.12, 5.02, CYAN, { glow: 1.6 });
  }
  for (const s of [-1, 1]) statue(K, s * 12, -68, s * 0.4);
  for (const x of [-12, 12]) lampA(K, x, 29, -75, 0x8a7aff, 6, 22);
  // the sealed door at the head of the stair: a dark frame, lit green lattice leaves, a ring crown with an orb
  const dz = z0 + 1.9, g2 = 33;
  A(K, 0, g2, dz, 10, 14, 1.0, 0x1e1a30, { collide: true });
  A(K, 0, g2, dz + 0.6, 7, 11, 0.2, 0x2a2850);
  for (const s of [-1, 1]) { A(K, s * 1.7, g2 + 0.5, dz + 0.78, 2.6, 9.6, 0.1, 0x1a3a3a, { glow: 0.5 }); for (let k = 0; k < 7; k++) A(K, s * 1.7, g2 + 1.2 + k * 1.3, dz + 0.86, 2.4, 0.08, 0.08, GREEN, { glow: 1.7 }); }
  A(K, 0, g2 + 0.5, dz + 0.8, 0.14, 9.6, 0.1, CYAN, { glow: 2 });
  meshA(K, new THREE.TorusGeometry(3.4, 0.28, 6, 28), CYAN, 0, g2 + 17.5, dz + 0.7, { glow: 2.2 });
  meshA(K, new THREE.TorusGeometry(2.4, 0.14, 6, 24), TEAL, 0, g2 + 17.5, dz + 0.72, { glow: 1.6 });
  meshA(K, new THREE.SphereGeometry(1.2, 10, 8), 0xaff8ff, 0, g2 + 17.5, dz + 0.7, { glow: 1.6 });
  lampA(K, 0, g2 + 10, dz + 5, 0x9affe0, 9, 28);
  for (const s of [-1, 1]) { A(K, s * 14, g2, dz + 0.4, 3, 9, 1.4, 0x1c1830, { collide: true }); A(K, s * 12.7, g2 + 1, dz + 1.2, 0.1, 6.5, 0.1, GREEN, { glow: 1.5 }); }
}

// ------------------------------------------------------------------ Aphelion's Rest

/** A dark boulder with a white Scorn sigil painted on its face. */
function sigilRock(K, x, z, s, ry) {
  const g = G(K, x, z), fx = Math.sin(ry), fz = Math.cos(ry);
  meshA(K, new THREE.DodecahedronGeometry(s, 0), ROCKD, x, g + s * 0.5, z, { ry, scale: [1.4, 0.9, 0.9] });
  solid(K, x - s, g, z - s, x + s, g + s * 1.2, z + s);
  const px = x + fx * s * 0.86, pz = z + fz * s * 0.86, y = g + s * 0.6;
  A(K, px, y - 0.5, pz, 0.14, 1.1, 0.05, 0xeeeae0, { ry, glow: 0.6 });
  meshA(K, new THREE.TorusGeometry(0.32, 0.06, 4, 10), 0xeeeae0, px, y + 0.4, pz, { ry, glow: 0.6 });
  for (const s2 of [-1, 1]) for (const dy of [-0.2, 0.25]) A(K, px - fz * s2 * 0.32, y + dy, pz + fx * s2 * 0.32, 0.5, 0.07, 0.05, 0xeeeae0, { ry, rz: s2 * 0.5, glow: 0.6 });
}

function rest(K) {
  const h = 36;
  slab(K, 100, -149, 78, 52, 0x6a6076, 0.05); slab(K, 100, -149, 50, 30, 0x5a5268, 0.07);
  // broken colonnades: two rows of pale pillars, many snapped, a few still carrying their lintels
  const HS = [10, 10, 3.5, 6, 10, 10, 2.5, 8, 4, 10, 10];
  for (let x = 68, i = 0; x <= 132; x += 7, i++) {
    const hh = HS[i % HS.length], nx = HS[(i + 1) % HS.length];
    A(K, x, h, -134, 1.6, hh, 1.6, i % 3 ? IVORY2 : IVORY, { collide: true });
    if (hh === 10 && nx === 10 && x + 7 <= 132) A(K, x + 3.5, h + 10, -134, 8.6, 1.0, 1.8, IVORY2); // a lintel carried on two standing pillars
    else if (hh < 5) A(K, x + 1.8, h, -135.2, 2.4, 0.8, 1.2, IVORY2, { ry: 0.5 });
  }
  const HZ = [10, 10, 7, 4, 10, 10];
  for (let z = -172, i = 0; z <= -142; z += 6, i++) {
    const hh = HZ[i % HZ.length], nz = HZ[(i + 1) % HZ.length];
    A(K, 66, h, z, 1.6, hh, 1.6, IVORY2, { collide: true });
    if (hh === 10 && nz === 10 && z + 6 <= -142) A(K, 66, h + 10, z + 3, 1.8, 1.0, 7.6, IVORY2);
  }
  // the toppled spire: its stump on the east ledge, the long shaft lying across the ledge on rubble, its tip still glowing
  const sx = 116, sz = -168;
  A(K, sx + 6, h, sz, 5, 3.4, 5, IVORY2, { collide: true });
  meshA(K, new THREE.CylinderGeometry(2.6, 3.2, 3.5, 6), IVORY, sx + 6, h + 5, sz, { rx: 0.12 });
  for (const [x, w, hh] of [[sx - 6, 5, 6.4], [sx - 17, 5, 5], [sx - 27, 4, 3.8]]) solid(K, x - w / 2, h, sz - 2.4, x + w / 2, h + hh, sz + 2.4);
  meshA(K, new THREE.ConeGeometry(3.2, 40, 6), IVORY, sx - 14, h + 3.6, sz, { rz: Math.PI / 2 + 0.03, ry: 0, scale: [1, 1, 1] });
  meshA(K, new THREE.CylinderGeometry(3.2, 3.5, 1.2, 6), GOLD, sx + 5.5, h + 3.4, sz, { rz: Math.PI / 2, glow: 0.5 });
  meshA(K, new THREE.OctahedronGeometry(0.9, 0), ICE, sx - 35, h + 3.2, sz, { glow: 1.6, scale: [2.4, 1, 1] });
  for (const [x, z, s, ry] of [[sx - 8, sz + 4.6, 1.6, 0.4], [sx - 20, sz - 4.4, 1.3, 1.2], [sx - 30, sz + 4, 1.4, 2]]) boulder(K, x, z, s, { colors: [IVORY2, ROCK[0]] });
  // the Scorn den: the totem ring round the haul, ether cans, spike barricades, sigil rocks
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; TK.totem(K, 100 + Math.cos(a) * 13, -150 + Math.sin(a) * 13, 6); }
  for (const [x, z] of [[96, -148], [104, -154], [100, -158], [94, -154]]) TK.etherCan(K, x, z, 0.6, 1.8);
  for (const [x, z, len, ax] of [[76, -128, 8, true], [124, -128, 8, true], [78, -160, 10, false], [126, -158, 8, false]]) TK.spikes(K, x, z, len, ax);
  for (const [x, z] of [[84, -150], [114, -144], [92, -166], [108, -130]]) { TK.etherCan(K, x, z); lampA(K, x, h + 2, z, 0xbfe4ff, 4, 12); }
  for (const [x, z, s, ry] of [[72, -150, 2.4, 1.6], [128, -150, 2.2, -1.6], [100, -126, 2.2, 3.14], [84, -170, 2, 0.4]]) sigilRock(K, x, z, s, ry);
  lampA(K, 100, h + 4, -150, 0xbfe4ff, 9, 28);
  // broken ivory blocks and rubble, the edge rails where the den meets the cliff, and a few torn banners
  for (const [x, z] of [[62, -128], [138, -128], [62, -174], [138, -174]]) DK.banner(K, x, z, 6);
  for (const [x, z, s] of [[84, -140, 1.4], [116, -156, 1.6], [90, -126, 1.3], [110, -170, 1.5]]) boulder(K, x, z, s, { colors: [IVORY2, ROCK[2]] });
  rail(K, 61, -123, 118, -123, 1.2, IVORY2, null);
}

// ------------------------------------------------------------------ the map

export default {
  dc_patrol: {
    ...PATROL_DATA.dc_patrol,
    build(K) {
      for (const [, x0, x1, z0, z1, h, kind] of DREAMING_ISLANDS) if (kind === 'i') underside(K, x0, x1, z0, z1, h);
      for (const r of DREAMING_RAMPS) span(K, r);
      sky(K);
      strand(K);
      mists(K);
      court(K);
      gorge(K);
      gardens(K);
      towers(K);
      palace(K);
      cavern(K);
      rest(K);
    },
  },
};
