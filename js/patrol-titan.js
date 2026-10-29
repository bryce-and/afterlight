// U17c: the Titan patrol zone (docs/reference/README.md, "Titan patrol zone"). Everything stands on decks high over the methane sea, in two halves joined by pipe bridges.
// The Rigs fill the south: the landing deck with Sloane's command post and the dish, six stations (derricks, tank farms, crane yards, a flare), Siren's Watch (a stepped tower
// rig with a climb to a lookout). The Arcology fills the north: a glass-lattice dome on a platform, curved terraced towers, overgrown plazas, ponds and kiosk pillars. The Hive hold the
// Solarium and the north tower wing only. A ramp in the dome's east gate runs down a glass tube into the Sunken Gallery, a corridor under the water ending in a Hive chamber.
// Heights: decks are flat plateaus at TITAN.deck; the sea is drawn at TITAN.sea, above the gallery floor (ground never dips below 0, so the gallery sits at 0 and the sea is raised).
// Rule for this map: everything walked on stands on the terrain under it; rails stand on the deck edge; the tube's floor and walls follow its slope.
import * as THREE from 'three';
import { PATROL_DATA, TITAN, TITAN_DECKS, TITAN_RAMP } from './patrol-data.js';
import { TITAN_KIT as TK } from './level-titan.js';
import { road as kitRoad, hall as kitHall, desk, console_, shelf } from './patrol-kit.js';

const { PALE2, AMBER, GREEN, CHITIN, CHITIN2, YELLOW, TEAL } = TK.C;
const WHITE = 0xe6e9e3, RED = 0xb8382a, ORANGE = 0xd9702a, HULL = 0x7a837e, HULL2 = 0x59635f, GRATE = 0x323b39, PIPE = 0xc4cbc5, PINK = 0xff5fa8, SKY = 0x4a8cff;
const LEAF = [0x2f6b3a, 0x3f8a4a, 0x27553a, 0x55a05a], WALL = 0xcdd3cc, WALLD = 0x8d9893, HIVEWALL = 0x3a443e, EGG = 0xc9d8a8;
const { deck: DECK, sea: SEA } = TITAN;
const [DCX, DCZ, DR] = [0, -100, 66];                                  // the dome: centre and radius at its base
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ helpers

/** A solid block: a plain mesh (so the scene merge folds it into few draw calls) plus an invisible collider. y is measured from the ground; ry turns it. */
function blk(K, x, z, w, h, d, color, o = {}) {
  const y = o.y ?? 0, ry = o.ry ?? 0;
  if (ry) K.mesh(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, { ry, glow: o.glow });
  else K.box(x, z, w, h, d, color, { y, collide: false, glow: o.glow });
  if (o.collide === false) return;
  if (ry) K.ocollider(x, z, w, h, d, ry, y); else K.collider(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, null);
}

/** A box at an absolute height (the tube and the gallery, where the ground is not the deck). */
const A = (K, x, y0, z, w, h, d, color, o = {}) => K.box(x, z, w, h, d, color, { y: y0, abs: true, collide: o.collide ?? false, glow: o.glow });
/** An invisible collider at absolute heights. */
const solid = (K, x0, y0, z0, x1, y1, z1) => { const g = K.ground((x0 + x1) / 2, (z0 + z1) / 2); K.collider(x0, y0 - g, z0, x1, y1 - g, z1, null); };

/** A thin bar from one point to another (cables, stays). */
function cable(K, x0, y0, z0, x1, y1, z1, t = 0.12, color = 0x2a3230) {
  const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, t, L), K.mat(color));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.lookAt(x1, y1, z1);
  m.castShadow = true;
  K.scene.add(m);
}

let GLASS = null;
/** A pane of translucent glass (not merged, not solid: a collider elsewhere keeps people out). */
function glass(K, x, y0, z, w, h, d) {
  GLASS ??= TK.glassMat();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), GLASS);
  m.position.set(x, y0 + h / 2, z);
  K.scene.add(m);
}

const leaf = (K) => K.RP(LEAF);
/** A fern or palm: a few flat leaves splayed round a stalk. */
function plant(K, x, z, s = 1, y = 0) {
  const n = 4 + Math.floor(K.rng() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + K.R(0, 0.6);
    K.cone(x + Math.cos(a) * 0.35 * s, z + Math.sin(a) * 0.35 * s, 0.34 * s, K.R(1.4, 2.2) * s, leaf(K), { y, sides: 4, collide: false, rx: Math.sin(a) * 0.7, rz: -Math.cos(a) * 0.7 });
  }
}
function palm(K, x, z, h = 6, y = 0) {
  K.cyl(x, z, 0.28, h, 0x6b5a46, { y, r2: 0.18, sides: 5, collide: false });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    K.cone(x + Math.cos(a) * 0.9, z + Math.sin(a) * 0.9, 0.4, 2.6, leaf(K), { y: y + h - 0.4, sides: 4, collide: false, rx: Math.sin(a) * 1.0, rz: -Math.cos(a) * 1.0 });
  }
}
/** A hanging vine: a thin dark strip dropping from a ledge at height y. */
const vine = (K, x, z, y, len) => K.box(x, z, 0.12, len, 0.12, K.RP([0x244d2f, 0x2f6b3a]), { y: y - len, collide: false });

/** A cluster of Hive eggs: pale glowing ovals on a stained patch. */
function eggs(K, x, z, s = 1, y = 0) {
  K.box(x, z, 3.2 * s, 0.18, 3.2 * s, CHITIN, { y, collide: false });
  for (let i = 0; i < 4; i++) {
    const ex = x + K.R(-1.1, 1.1) * s, ez = z + K.R(-1.1, 1.1) * s, e = K.R(0.5, 0.8) * s;
    K.mesh(new THREE.SphereGeometry(e, 7, 5), EGG, ex, y + e * 1.2, ez, { glow: 0.6, scale: [1, 1.4, 1] });
  }
  K.collider(x - 1.4 * s, y, z - 1.4 * s, x + 1.4 * s, y + 1.6 * s, z + 1.4 * s, null);
}

const road = (K, pts, kind = 'deck', w) => kitRoad(K, pts, kind === 'boulevard'
  ? { w: w ?? 12, gap: 22, color: 0xc9d1cb, edge: 0x7fb0a2, lamp: parkLamp }
  : { w: w ?? 8, gap: 26, color: 0x2e3836, edge: YELLOW, lamp: deckLamp });
/** An industrial lamp on a rig deck: a post with an amber head. */
function deckLamp(K, x, z) { TK.lamp(K, x, z, 5.5, AMBER); K.light(x, 5.2, z, AMBER, 8, 24); }
/** A park lamp in the arcology: a pale post with a soft cool light. */
function parkLamp(K, x, z) {
  K.box(x, z, 0.3, 5, 0.3, WALL);
  K.box(x, z, 0.8, 0.2, 0.8, WALLD, { y: 5, collide: false });
  K.box(x, z, 0.6, 0.12, 0.6, 0xe6fff4, { y: 4.9, collide: false, glow: 2 });
  K.light(x, 4.4, z, 0xdaf6ea, 8, 24);
}

// ------------------------------------------------------------------ the decks: sea, rails, hulls, legs, bridges

const rects = TITAN_DECKS.map(([id, x0, x1, z0, z1, kind]) => ({ id, x0, x1, z0, z1, kind }));
const inRect = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
const walkClass = (x, z) => (rects.some((r) => r.kind !== 'x' && inRect(r, x, z)) ? 1 : rects.some((r) => inRect(r, x, z)) ? 2 : 0);

/**
 * The sea: slabs at the water line over every cell that is not a deck (merged greedily), with a tall invisible collider where they lie inside the map so nobody can fall in,
 * and a railing on every railed deck edge (the enclosed tube and gallery have walls instead).
 */
function sea(K) {
  const { minX, maxX, minZ, maxZ } = K.bounds, C = K.C, FAR = 700;
  const uniq = (a) => [...new Set(a)].sort((p, q) => p - q);
  const xs = uniq([-FAR, FAR, ...rects.flatMap((r) => [r.x0, r.x1])]), zs = uniq([-FAR, FAR, ...rects.flatMap((r) => [r.z0, r.z1])]);
  const nx = xs.length - 1, nz = zs.length - 1;
  const W = xs.slice(0, nx).map((_, i) => zs.slice(0, nz).map((_, j) => walkClass((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2)));
  const cls = (i, j) => (i >= 0 && j >= 0 && i < nx && j < nz ? W[i][j] : 0);
  const used = W.map((col) => col.map(() => false));
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (W[i][j] || used[i][j]) continue;
    let i2 = i;
    while (i2 + 1 < nx && !W[i2 + 1][j] && !used[i2 + 1][j]) i2++;
    let j2 = j;
    for (;;) {
      if (j2 + 1 >= nz) break;
      let ok = true;
      for (let k = i; k <= i2; k++) if (W[k][j2 + 1] || used[k][j2 + 1]) { ok = false; break; }
      if (!ok) break;
      j2++;
    }
    for (let a = i; a <= i2; a++) for (let b = j; b <= j2; b++) used[a][b] = true;
    const x1 = xs[i], x2 = xs[i2 + 1], z1 = zs[j], z2 = zs[j2 + 1];
    K.box((x1 + x2) / 2, (z1 + z2) / 2, x2 - x1 - 0.04, 0.8, z2 - z1 - 0.04, C.sea, { y: SEA - 0.8, abs: true, collide: false });
    const cx1 = Math.max(x1, minX - 10), cx2 = Math.min(x2, maxX + 10), cz1 = Math.max(z1, minZ - 10), cz2 = Math.min(z2, maxZ + 10);
    if (cx2 > cx1 && cz2 > cz1) solid(K, cx1, -2, cz1, cx2, 70, cz2);
  }
  // railings on lines of constant z, then of constant x: only where a railed deck meets the sea
  for (let j = 0; j <= nz; j++) {
    let run = null;
    for (let i = 0; i <= nx; i++) {
      const up = cls(i, j - 1), dn = cls(i, j), s = i < nx && !!up !== !!dn ? (dn ? (dn === 1 ? 1 : 0) : (up === 1 ? -1 : 0)) : 0;
      if (run && s !== run.s) { TK.rail(K, xs[run.i], zs[j] + run.s * 0.3, xs[i], zs[j] + run.s * 0.3); run = null; }
      if (s && !run) run = { i, s };
    }
  }
  for (let i = 0; i <= nx; i++) {
    let run = null;
    for (let j = 0; j <= nz; j++) {
      const lf = cls(i - 1, j), rt = cls(i, j), s = j < nz && !!lf !== !!rt ? (rt ? (rt === 1 ? 1 : 0) : (lf === 1 ? -1 : 0)) : 0;
      if (run && s !== run.s) { TK.rail(K, xs[i] + run.s * 0.3, zs[run.j], xs[i] + run.s * 0.3, zs[j]); run = null; }
      if (s && !run) run = { j, s };
    }
  }
}

/** A red leg standing in the sea up to a deck's underside, with a checkered marker. y is absolute (the ground under a bridge's middle is the deck). */
function leg(K, x, z, top = DECK - 3.4, r = 1.6) {
  const g = K.ground(x, z);
  K.cyl(x, z, r, top - (SEA - 1), RED, { y: SEA - 1 - g, sides: 10, collide: false });
  K.cyl(x, z, r + 0.06, 1.1, WHITE, { y: SEA + 5 - g, sides: 10, collide: false });
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 0; k < 2; k++) K.box(x + dx * (r + 0.08), z + dz * (r + 0.08), dx ? 0.08 : 0.55, 0.55, dx ? 0.55 : 0.08, k ? WHITE : 0x1a2020, { y: SEA + 1.2 + k * 0.55 - g, collide: false });
}

/** A thin steel plate over a deck's whole top (the terrain's own top face is not drawn to the very edge). */
const plate = (K, r, color) => K.box((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.03, r.z1 - r.z0, color, { y: 0, collide: false });

/**
 * Under a rig deck: a thick fascia with a red foot band all round, a slab closing the underside, and legs at the corners and along the long sides. `cut` leaves a gap where
 * the descent tube leaves the dome platform (its floor is below the deck there): { x, z0, z1 }.
 */
function hull(K, r, cut) {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, W = r.x1 - r.x0, D = r.z1 - r.z0, pad = 1.5, y = DECK - 3.4;
  const strip = (x, z, w, d) => { A(K, x, y, z, w, 3.2, d, HULL); A(K, x, y, z, w + 0.1, 0.5, d + 0.1, RED); A(K, x, y + 2.2, z, w + 0.06, 0.4, d + 0.06, YELLOW); };
  const under = (x0, x1, z0, z1) => A(K, (x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, 3.1, z1 - z0, HULL2);
  strip(cx, r.z0 - pad / 2, W + 2 * pad, pad);
  strip(cx, r.z1 + pad / 2, W + 2 * pad, pad);
  strip(r.x0 - pad / 2, cz, pad, D);
  if (cut) { strip(r.x1 + pad / 2, (r.z0 + cut.z0) / 2, pad, cut.z0 - r.z0); strip(r.x1 + pad / 2, (cut.z1 + r.z1) / 2, pad, r.z1 - cut.z1); } else strip(r.x1 + pad / 2, cz, pad, D);
  if (cut) { under(r.x0, r.x1, r.z0, cut.z0); under(r.x0, r.x1, cut.z1, r.z1); under(r.x0, cut.x, cut.z0, cut.z1); } else under(r.x0, r.x1, r.z0, r.z1);
  const lx = (n) => Array.from({ length: n }, (_, i) => r.x0 + (i + 0.5) * W / n), lz = (n) => Array.from({ length: n }, (_, i) => r.z0 + (i + 0.5) * D / n);
  for (const x of lx(Math.max(2, Math.round(W / 22)))) { leg(K, x, r.z0 - pad - 0.4); leg(K, x, r.z1 + pad + 0.4); }
  for (const z of lz(Math.max(2, Math.round(D / 22)))) { leg(K, r.x0 - pad - 0.4, z); if (!cut || z < cut.z0 - 3 || z > cut.z1 + 3) leg(K, r.x1 + pad + 0.4, z); }
}

/** A pipe bridge: a grated plate closing its underside, two big pale pipes with clamps along the outer edges, a cable at knee height on the rail posts, and (on long spans) a leg and stay cables from two masts. */
function bridge(K, r) {
  const alongX = r.x1 - r.x0 > r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, L = alongX ? r.x1 - r.x0 : r.z1 - r.z0, Wd = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
  A(K, cx, DECK - 1.0, cz, alongX ? L : Wd + 0.4, 0.97, alongX ? Wd + 0.4 : L, GRATE);
  plate(K, r, 0x3b4643);
  for (const s of [-1, 1]) {
    const px = alongX ? cx : cx + s * (Wd / 2 + 0.7), pz = alongX ? cz + s * (Wd / 2 + 0.7) : cz, g = K.ground(px, pz), turn = alongX ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 };
    K.mesh(new THREE.CylinderGeometry(0.8, 0.8, L, 8), PIPE, px, DECK - 0.8 - g, pz, { ...turn, collide: false });
    for (let d = -L / 2 + 3; d < L / 2; d += 7) K.mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.5, 8), 0x6d7a76, alongX ? px + d : px, DECK - 0.8 - g, alongX ? pz : pz + d, { ...turn, collide: false });
    const e = Wd / 2 - 0.3;                                                // the cable runs along the rail posts
    if (alongX) K.mesh(new THREE.BoxGeometry(L - 0.6, 0.07, 0.07), 0x2a3230, cx, 0.55, cz + s * e, { collide: false }); else K.mesh(new THREE.BoxGeometry(0.07, 0.07, L - 0.6), 0x2a3230, cx + s * e, 0.55, cz, { collide: false });
  }
  if (L > 30) {
    leg(K, cx, cz, DECK - 1.0, 1.3);
    for (const s of [-1, 1]) {                                             // two masts at the middle, stays running down to the deck near each end
      const mx = alongX ? cx : cx + s * (Wd / 2 + 0.4), mz = alongX ? cz + s * (Wd / 2 + 0.4) : cz, top = DECK + 11;
      A(K, mx, DECK - 0.5, mz, 0.7, 11.5, 0.7, PALE2);
      const ex = alongX ? L / 2 - 2.5 : 0, ez = alongX ? 0 : L / 2 - 2.5;
      for (const q of [-1, 1]) cable(K, mx, top, mz, mx + q * ex, DECK + 0.4, mz + q * ez, 0.14);
      A(K, mx, top, mz, 0.5, 0.5, 0.5, 0xff4a2a, { glow: 1.6 });
    }
  }
}

// ------------------------------------------------------------------ rig pieces

/** A station: a big metal building with a red foot, a teal stripe, a row of portholes on both long faces and gear on the roof. */
function station(K, cx, cz, w, d, h, o = {}) {
  const body = o.color ?? WHITE, trim = o.trim ?? TEAL;
  blk(K, cx, cz, w, h, d, body);
  blk(K, cx, cz, w + 0.2, 1.1, d + 0.2, o.base ?? RED, { collide: false });
  blk(K, cx, cz, w + 0.2, 1.0, d + 0.2, trim, { y: h * 0.58, collide: false });
  blk(K, cx, cz, w + 0.3, 0.35, d + 0.3, HULL2, { y: h, collide: false });
  for (const s of [-1, 1]) for (let x = -w / 2 + 2; x < w / 2 - 1; x += 3.4) K.box(cx + x, cz + s * (d / 2 + 0.06), 1.0, 1.0, 0.12, 0x1a2328, { y: h * 0.74, collide: false });
  for (const s of [-1, 1]) for (let z = -d / 2 + 2; z < d / 2 - 1; z += 3.4) K.box(cx + s * (w / 2 + 0.06), cz + z, 0.12, 1.0, 1.0, 0x1a2328, { y: h * 0.74, collide: false });
  if (o.roof !== false) {
    blk(K, cx - w * 0.2, cz + d * 0.1, w * 0.3, 1.8, d * 0.35, o.gear ?? ORANGE, { y: h + 0.35, collide: false });
    K.cyl(cx + w * 0.25, cz - d * 0.15, 1.1, 2.2, PIPE, { y: h + 0.35, sides: 8, collide: false });
    K.box(cx + w * 0.38, cz + d * 0.28, 0.2, 3.4, 0.2, HULL2, { y: h + 0.35, collide: false });
  }
}

/** A hazard-striped patch of deck: alternating yellow and dark bars. */
function hazard(K, x0, x1, z0, z1, alongX = true) {
  const n = Math.max(2, Math.round((alongX ? x1 - x0 : z1 - z0) / 1.4));
  for (let i = 0; i < n; i += 2) {
    const a = (alongX ? x0 : z0) + i * ((alongX ? x1 - x0 : z1 - z0) / n), b = (alongX ? x0 : z0) + (i + 1) * ((alongX ? x1 - x0 : z1 - z0) / n);
    if (alongX) K.box((a + b) / 2, (z0 + z1) / 2, b - a, 0.06, z1 - z0, YELLOW, { y: 0.03, collide: false }); else K.box((x0 + x1) / 2, (a + b) / 2, x1 - x0, 0.06, b - a, YELLOW, { y: 0.03, collide: false });
  }
}

/** A pipe stack: tall cylinders in two colours, tied by a collar. */
function pipeStack(K, x, z, n = 4, hs = [9, 12, 7, 10]) {
  for (let i = 0; i < n; i++) {
    const px = x + (i % 2) * 2.6, pz = z + Math.floor(i / 2) * 2.6;
    K.cyl(px, pz, 0.95, hs[i % hs.length], i % 2 ? ORANGE : PIPE, { sides: 8 });
    K.cyl(px, pz, 1.1, 0.4, HULL2, { y: hs[i % hs.length] * 0.6, sides: 8, collide: false });
  }
}

/** A tank farm: a row of white silos with a teal band, on a low rail. */
function silos(K, x, z, n, r = 3.6, h = 8, dx = 8.4, dz = 0) {
  for (let i = 0; i < n; i++) {
    const sx = x + i * dx, sz = z + i * dz;
    K.cyl(sx, sz, r, h, WHITE, { sides: 10 });
    K.cyl(sx, sz, r + 0.06, 0.8, TEAL, { y: h * 0.55, sides: 10, collide: false });
    K.cyl(sx, sz, r + 0.06, 0.5, RED, { sides: 10, collide: false });
    K.cyl(sx, sz, r * 0.5, 0.8, HULL2, { y: h, sides: 8, collide: false });
  }
}

/** Containers in the rig colours, alone or stacked. */
const CONT = [RED, ORANGE, TEAL, 0xd2a032, 0x56688a, 0x8a8f8c];
function crates(K, x, z, rot, n = 1) {
  for (let i = 0; i < n; i++) K.box(x + (i ? K.R(-0.2, 0.2) : 0), z + (i ? K.R(-0.2, 0.2) : 0), rot ? 2.5 : 6.1, 2.6, rot ? 6.1 : 2.5, K.RP(CONT), { y: i * 2.6 });
}

// ------------------------------------------------------------------ the rigs

function landing(K) {
  K.mesh(new THREE.CylinderGeometry(12, 12, 0.14, 24), 0x3f4a47, 0, 0.07, 160, { collide: false });
  K.mesh(new THREE.TorusGeometry(10.4, 0.3, 4, 32), YELLOW, 0, 0.16, 160, { rx: Math.PI / 2, glow: 0.4 });
  K.box(0, 160, 1.2, 0.06, 8, WHITE, { y: 0.14, collide: false }); K.box(0, 160, 7, 0.06, 1.2, WHITE, { y: 0.14, collide: false });
  hazard(K, -28, -14, 128, 130, true); hazard(K, 14, 28, 172, 174, true);
  // the dish on a lattice tower
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) blk(K, -24 + sx * 2, 138 + sz * 2, 0.7, 11, 0.7, PALE2);
  for (const y of [3.5, 7]) { blk(K, -24, 136, 4.4, 0.25, 0.25, HULL2, { y, collide: false }); blk(K, -24, 140, 4.4, 0.25, 0.25, HULL2, { y, collide: false }); }
  K.box(-24, 138, 5.2, 0.5, 5.2, HULL2, { y: 11, collide: false });
  TK.dish(K, -24, 15.5, 138, 7.5, -0.7, 0.6);
  TK.mast(K, -30, 130, 22); TK.mast(K, 30, 172, 18); TK.mast(K, -30, 172, 14);
  pipeStack(K, -28, 164); pipeStack(K, 24, 128, 3, [8, 11, 7]);
  TK.crane(K, -26, 152, 15, 1, false);
  crates(K, -20, 168, true, 2); crates(K, 16, 170, false, 1); crates(K, -14, 130, false, 1);
  K.box(10, 134, 3, 1.2, 1.6, ORANGE); K.box(-6, 134, 1.8, 1.0, 1.8, TEAL);
  // Sloane's command post: a white hall with a red foot, a console room and a map table
  kitHall(K, 24, 144, 14, 10, 4.6, {
    color: WHITE, roofColor: HULL, lamp: 0xcfeee8, ceil: 0xdfe6e2, windows: false, doors: { s: 5 }, doorOffset: { s: -1 }, lamps: 2,
    props: (k, cx, cz) => {
      const CP = { body: HULL2, top: WHITE, screen: 0x7fe0d0, shelf: HULL2, shelfTop: WALL };
      console_(k, cx - 4, cz - 3.4, CP); console_(k, cx, cz - 3.4, CP); console_(k, cx + 4, cz - 3.4, CP); shelf(k, cx - 6, cz + 0.5, false, CP);
      desk(k, cx + 3, cz + 0.5, true, { body: HULL2, top: WHITE }); k.crate(cx + 5.4, cz + 3.6);
    },
  });
  // the red foot and teal band run round the outside of the walls, not through the room
  for (const [c, y, h] of [[RED, 0, 0.5], [TEAL, 2.3, 0.9]]) {
    K.box(24, 138.45, 15.3, h, 0.2, c, { y, collide: false });
    K.box(18.4, 149.55, 4.1, h, 0.2, c, { y, collide: false }); K.box(28.6, 149.55, 6.1, h, 0.2, c, { y, collide: false }); // the south side leaves the door (x 20.5 to 25.5) open
    for (const s of [-1, 1]) K.box(24 + s * 7.55, 144, 0.2, h, 11.3, c, { y, collide: false });
  }
  TK.lamp(K, 14, 154, 5.5, AMBER); K.light(14, 5.2, 154, AMBER, 8, 22);
}

/** The pump station, hub of the rigs: four blocks round the crossing. */
function pump(K) {
  station(K, -14, 62, 12, 9, 9, { color: WHITE }); station(K, 14, 62, 11, 9, 7, { color: 0xe4a864, trim: RED, base: HULL2 });
  silos(K, 10, 84, 2, 3.2, 7, 7.6); TK.crane(K, -16, 82, 14, 1, true);
  crates(K, -14, 70, true, 2); crates(K, 16, 74, false, 1);
  pipeStack(K, -20, 88, 2, [8, 10]); hazard(K, -8, 8, 87, 89, true);
}

/** A rig with a derrick, containers and a hazard apron: the breach rig and its siblings. */
function drillRig(K, r, o = {}) {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  if (o.derrick) TK.derrick(K, o.derrick[0], o.derrick[1], 30, 0);
  if (o.flare) TK.flare(K, o.flare[0], o.flare[1], 32, 0);
  for (const [x, z, w, d, h, c] of o.stations || []) station(K, x, z, w, d, h, c);
  for (const [x, z, n, rr, h, dx, dz] of o.silos || []) silos(K, x, z, n, rr, h, dx, dz);
  for (const [x, z, rot, n] of o.crates || []) crates(K, x, z, rot, n);
  for (const [x, z] of o.stacks || []) pipeStack(K, x, z);
  for (const [x, z, h, dir, alongX] of o.cranes || []) TK.crane(K, x, z, h, dir, alongX);
  for (const [x0, x1, z0, z1, ax] of o.hazards || []) hazard(K, x0, x1, z0, z1, ax);
  return [cx, cz];
}

/** Siren's Watch: a stepped tower rig. Three solid tiers, each reached by its own flight of stairs that starts on the tier below; a lookout on top with a mast and a dish. */
function sirensWatch(K) {
  const tiers = [[-126, -96, -6, 24, 0, 8], [-124, -108, -4, 12, 8, 16], [-124, -112, -4, 3, 16, 22]];
  for (const [x0, x1, z0, z1, y0, y1] of tiers) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, h = y1 - y0;
    blk(K, cx, cz, w, h, d, WHITE, { y: y0 });
    blk(K, cx, cz, w + 0.2, 1.0, d + 0.2, y0 ? TEAL : RED, { y: y0 + (y0 ? h * 0.5 : 0), collide: false });
    blk(K, cx, cz, w + 0.3, 0.4, d + 0.3, ORANGE, { y: y0 + h - 0.46, collide: false });
    for (const s of [-1, 1]) for (let x = x0 + 2; x < x1 - 1; x += 3.4) if (!(y0 === 0 && s === 1 && Math.abs(x + 100) < 2.4)) K.box(x, cz + s * (d / 2 + 0.06), 1, 1, 0.12, 0x1a2328, { y: y0 + h * 0.5, collide: false });
  }
  // stairs: each is a solid wedge standing on what is under it (the deck, then tier 1's top, then tier 2's top)
  K.stairs(-100, 36, 'n', 3.2, 8, { color: HULL2 });
  K.stairs(-118, 24, 'n', 3, 8, { color: HULL2, y: 8 });
  K.stairs(-120, 12, 'n', 3, 6, { color: HULL2, y: 16 });
  // rails round the tops of the tiers, standing on their edges and broken where a flight arrives or leaves
  const top = (x0, x1, z0, z1, y, gaps) => {
    TK.rail(K, x0 + 0.3, z0 + 0.3, x1 - 0.3, z0 + 0.3, y); TK.rail(K, x0 + 0.3, z0 + 0.3, x0 + 0.3, z1 - 0.3, y); TK.rail(K, x1 - 0.3, z0 + 0.3, x1 - 0.3, z1 - 0.3, y);
    let at = x0 + 0.3;
    for (const [a, b] of [...gaps, [x1, x1]]) { if (a - at > 1) TK.rail(K, at, z1 - 0.3, a, z1 - 0.3, y); at = Math.max(at, b); }
  };
  top(-126, -96, -6, 24, 8, [[-119.5, -116.5], [-101.6, -98.4]]);
  top(-124, -108, -4, 12, 16, [[-121.5, -116.5]]);
  top(-124, -112, -4, 3, 22, [[-121.5, -118.5]]);
  // the lookout: a mast and a dish
  TK.mast(K, -120, -2, 22, 22); TK.dish(K, -115, 25.4, -2, 4.5, -0.6, -0.5);
  K.light(-118, 25, 0, 0xcfeee8, 8, 26);
  // the deck below: a derrick beyond the tower, crates and a hazard apron
  TK.derrick(K, -120, 32, 26, 0);
  crates(K, -94, 30, true, 2); crates(K, -128, 22, false, 1);
  hazard(K, -108, -102, 38, 39.4, true);
}

// ------------------------------------------------------------------ the arcology: dome, ring wall, terraced towers

/** The lattice over the dome and the glass between its ribs. */
function domeShell(K) {
  const H = 46, y0 = DECK + 6, ribs = 12, rib = (R, ry) => K.mesh(new THREE.TorusGeometry(R, 0.5, 4, 28, Math.PI), 0xc9d1cc, DCX, y0 - K.ground(DCX, DCZ), DCZ, { ry, scale: [1, H / R, 1] });
  for (let k = 0; k < ribs; k++) rib(DR + 0.6, (Math.PI * k) / ribs);
  for (const lat of [0.22, 0.48, 0.74, 0.98, 1.22]) K.mesh(new THREE.TorusGeometry((DR + 0.6) * Math.cos(lat), 0.42, 4, 44), 0xc9d1cc, DCX, y0 + H * Math.sin(lat) - K.ground(DCX, DCZ), DCZ, { rx: Math.PI / 2 });
  // triangulated bracing between the first two parallels would cost hundreds of beams; a few diagonals are enough to read as a lattice
  const gm = TK.glassMat(), cap = new THREE.Mesh(new THREE.SphereGeometry(DR + 0.2, 36, 12, 0, TAU, 0, Math.PI / 2), gm);
  cap.position.set(DCX, y0, DCZ); cap.scale.y = H / (DR + 0.2);
  K.scene.add(cap);
  // growth on the lattice: leafy clumps clinging to the ribs, thick on the north-east where the Hive hold it
  for (let i = 0; i < 34; i++) {
    const a = -(Math.PI * Math.floor(K.R(0, ribs)) / ribs) + (K.chance(0.5) ? Math.PI : 0), lat = K.R(0.2, 1.2), r = (DR + 0.5) * Math.cos(lat), x = DCX + Math.cos(a) * r, z = DCZ + Math.sin(a) * r, y = y0 + H * Math.sin(lat);
    const hive = (a + TAU) % TAU > 4.3 && (a + TAU) % TAU < 5.8;
    K.mesh(new THREE.IcosahedronGeometry(K.R(1.4, 2.6), 0), hive ? K.RP([CHITIN, CHITIN2]) : K.RP([0x4a9a52, 0x62b060, 0x3f8a4a]), x, y - K.ground(x, z), z, { collide: false, scale: [1.2, 0.7, 1.2] });
    if (hive && i % 3 === 0) K.mesh(new THREE.OctahedronGeometry(1.1, 0), GREEN, x, y - K.ground(x, z) - 1.2, z, { glow: 1.6, scale: [1, 2, 1] });
  }
}

/** The ring wall round the dome's foot: a low plinth with a strip window, open at the south gate (the boulevard) and the east gate (the tube). */
function ringWall(K) {
  const N = 48, wseg = 2 * DR * Math.sin(Math.PI / N) * 1.03;
  for (let k = 0; k < N; k++) {
    const a = (k + 0.5) * TAU / N, x = DCX + Math.cos(a) * (DR + 1.5), z = DCZ + Math.sin(a) * (DR + 1.5), ry = -a - Math.PI / 2;
    if (Math.sin(a) > 0.9 && Math.abs(x - DCX) < 9) continue;                                                      // the south gate
    if (Math.cos(a) > 0.9 && Math.abs(z - DCZ) < 7) continue;                                                      // the east gate
    blk(K, x, z, wseg, 6, 2.6, WALL, { ry });
    blk(K, x - Math.cos(a) * 1.31, z - Math.sin(a) * 1.31, wseg * 0.94, 0.55, 0.12, 0x9fe8d8, { y: 3.2, ry, glow: 1.2, collide: false });
  }
  for (const zz of [-106.6, -93.4]) blk(K, DCX + DR + 1.5, zz, 2.6, 6, 3.2, WALL);                                    // the buttresses that close the east gate round the tube
  // the gates: a low lintel arch over the south gate
  for (const sx of [-1, 1]) blk(K, DCX + sx * 8.8, DCZ + DR + 1.5, 1.6, 12, 2.2, PALE2);
  K.box(DCX, DCZ + DR + 1.5, 19, 1.2, 2.2, PALE2, { y: 12, collide: false });
  K.box(DCX, DCZ + DR + 0.3, 14, 0.4, 0.2, 0x9fe8d8, { y: 11.4, collide: false, glow: 1.6 });
}

/** A curved terraced tower: stacked arcs of faceted blocks, each level set back, strip windows on the inner face, plants on the terraces and vines over the lips. */
function tower(K, a0, a1, rIn, o = {}) {
  const levels = o.levels ?? 5, depth = o.depth ?? 14, hl = 4.2, hive = !!o.hive, body = hive ? HIVEWALL : WALL, win = hive ? GREEN : 0xaee8dc;
  for (let i = 0; i < levels; i++) {
    const r = rIn + 2.8 * i, rc = r + depth / 2, n = Math.max(2, Math.ceil((a1 - a0) * rc / 6.2)), da = (a1 - a0) / n, w = da * rc * 1.05, y = i * hl;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k + 0.5) * da, ry = -a - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      blk(K, DCX + ca * rc, DCZ + sa * rc, w, hl, depth, i % 2 ? body : (hive ? 0x46524a : 0xbfc7c0), { y, ry });
      for (const wy of [1.0, 2.5]) blk(K, DCX + ca * (r - 0.07), DCZ + sa * (r - 0.07), w * 0.93, 0.55, 0.14, win, { y: y + wy, ry, glow: hive ? 1.2 : 0.9, collide: false });
      blk(K, DCX + ca * (r - 0.2), DCZ + sa * (r - 0.2), w * 1.0, 0.3, 1.5, hive ? HIVEWALL : WHITE, { y: y + hl, ry, collide: false });
      if (K.rng() < 0.55) {
        const px = DCX + ca * (r + 1.6 + K.R(0, 1)), pz = DCZ + sa * (r + 1.6 + K.R(0, 1));
        if (hive) K.rng() < 0.6 ? TK.hive(K, px, pz, 0.9, { y: y + hl + 0.3, collide: false }) : TK.crystals(K, px, pz, 0.9, false, y + hl + 0.3); else plant(K, px, pz, 1.2, y + hl + 0.3);
      }
      if (!hive && K.rng() < 0.5) vine(K, DCX + ca * (r - 0.2), DCZ + sa * (r - 0.2), y + hl, K.R(1.6, 4.4));
    }
  }
}

/** The curved white path to a raised garden: a platform with stairs, a palm and ferns, a low wall. */
function garden(K, x, z, w, d, h, side) {
  K.platform(x, z, w, d, h, { stairs: [side], stairW: 3.2, color: WHITE, stairColor: 0xd5dcd6 });
  K.box(x, z, w + 0.3, 0.3, d + 0.3, WALLD, { y: h, collide: false });
  palm(K, x - w * 0.25, z - d * 0.2, 5.4, h); palm(K, x + w * 0.2, z + d * 0.25, 4.6, h);
  for (let i = 0; i < 5; i++) plant(K, x + K.R(-w / 2 + 1, w / 2 - 1), z + K.R(-d / 2 + 1, d / 2 - 1), 1.2, h);
}

/** A white kiosk pillar with a dark screen and a blue panel. */
function kiosk(K, x, z, ry = 0) {
  K.cyl(x, z, 1.1, 3.6, WHITE, { sides: 10 });
  K.cyl(x, z, 1.16, 0.3, HULL2, { y: 1.9, sides: 10, collide: false });
  const sx = Math.sin(ry) * 1.12, sz = Math.cos(ry) * 1.12;
  K.mesh(new THREE.BoxGeometry(1.0, 1.5, 0.1), 0x10181c, x + sx, 2.4, z + sz, { ry, collide: false });
  K.mesh(new THREE.BoxGeometry(0.7, 0.8, 0.08), SKY, x + sx * 1.04, 1.0, z + sz * 1.04, { ry, collide: false, glow: 1.2 });
}

/** A domed screen over an alcove: a pink half sphere with a blue wing. */
function screenDome(K, x, z, y, r, ry = 0) {
  K.mesh(new THREE.SphereGeometry(r, 14, 7, 0, TAU, 0, Math.PI / 2), PINK, x, y, z, { rx: Math.PI / 2, ry, glow: 1.5, collide: false, scale: [1.5, 1, 0.55] });
  K.mesh(new THREE.SphereGeometry(r * 0.55, 10, 6, 0, TAU, 0, Math.PI / 2), SKY, x + Math.cos(ry) * r * 0.9, y - r * 0.15, z - Math.sin(ry) * r * 0.9, { rx: Math.PI / 2, ry, glow: 1.5, collide: false, scale: [1.2, 1, 0.5] });
}

/** A pond: a shallow teal disc with reeds round the rim. */
function pond(K, x, z, r) {
  K.mesh(new THREE.CylinderGeometry(r, r, 0.12, 20), 0x2c8a8c, x, 0.07, z, { collide: false, glow: 0.25 });
  for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + K.R(0, 0.4); plant(K, x + Math.cos(a) * (r + 0.4), z + Math.sin(a) * (r + 0.4), 1.1); }
}

/** The sectors the towers stand in (angle from +x round the dome's centre, and the radius they start at), so planting keeps out of them. */
const TOWERS = [[2.45, 3.75], [0.5, 1.15], [4.3, 5.1]];
const inTower = (a, r) => r > 30 && TOWERS.some(([a0, a1]) => a >= a0 - 0.05 && a <= a1 + 0.05);
const BOUL = [[0, -30], [0, -62], [-14, -80], [-20, -100], [-14, -120], [-4, -124], [16, -80], [22, -100], [56, -100], [34, -112], [34, -118]];

function arcology(K) {
  domeShell(K); ringWall(K);
  // the paving: pale, a little grey-green, closed at the tube where the floor drops away
  const pave = 0x6f7f75;
  K.box(-6.25, DCZ, 127.5, 0.03, 140, pave, { y: 0, collide: false });
  K.box(63.75, -137.75, 12.5, 0.03, 64.5, pave, { y: 0, collide: false }); K.box(63.75, -62.25, 12.5, 0.03, 64.5, pave, { y: 0, collide: false });
  // the towers: two clean ones and the Hive wing in the north
  tower(K, TOWERS[0][0], TOWERS[0][1], 32, { levels: 5 });                    // west
  tower(K, TOWERS[1][0], TOWERS[1][1], 32, { levels: 4, depth: 12 });         // south-east
  tower(K, TOWERS[2][0], TOWERS[2][1], 32, { levels: 5, hive: true });        // the north wing, held by the Hive
  // the plaza: a pond, kiosks, raised gardens, planting, a domed screen on the west tower
  pond(K, 0, -100, 9);
  for (const [x, z, ry] of [[-12, -78, 0.4], [12, -66, -0.4], [-26, -96, 1.6], [26, -108, -1.6], [-18, -62, 0], [-24, -112, 0.9], [6, -124, 3.1], [40, -96, 0.3]]) kiosk(K, x, z, ry);
  garden(K, -28, -58, 14, 10, 3, 'e'); garden(K, 54, -82, 14, 10, 3, 'w'); garden(K, -30, -136, 12, 9, 3, 'e');
  screenDome(K, -31.6, -100, 7, 6, Math.PI / 2);
  for (let i = 0; i < 100; i++) {
    const a = K.R(0, TAU), r = K.R(10, 60), x = DCX + Math.cos(a) * r, z = DCZ + Math.sin(a) * r;
    if (inTower(a, r) || r < 11 || BOUL.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 7) || Math.hypot(x - 34, z + 124) < 17 || Math.abs(z + 100) < 8 && x > 40) continue;
    K.rng() < 0.7 ? plant(K, x, z, K.R(0.9, 1.5)) : palm(K, x, z, K.R(4, 7));
  }
  for (const [x, z] of [[-40, -50], [-6, -146], [36, -50], [-48, -86]]) TK.tree(K, x, z, 0, 7);
}

/** The Hive wing and the Solarium: gunk, crystals, eggs and braziers over a conservatory and the plaza in front of the north tower. */
function hiveHold(K) {
  const sx = 34, sz = -124, w = 26, d = 20;
  // the Solarium: a glass conservatory on a low wall, open at the south and west
  const wall = (x0, z0, x1, z1, gaps) => {
    K.wall(x0, z0, x1, z1, 1.0, { t: 0.8, color: WALLD, gaps });
    const horiz = Math.abs(z1 - z0) < Math.abs(x1 - x0), len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0), start = horiz ? Math.min(x0, x1) : Math.min(z0, z1);
    let from = 0;
    for (const [a, b] of [...gaps, [len, len]]) {
      if (a - from > 0.5) { const mid = start + (from + a) / 2, L = a - from; if (horiz) glass(K, mid, DECK + 1, z0, L, 4.4, 0.2); else glass(K, x0, DECK + 1, mid, 0.2, 4.4, L); }
      from = Math.max(from, b);
    }
    for (let t = 0; t <= len; t += 6.5) { const px = horiz ? start + t : x0, pz = horiz ? z0 : start + t; K.box(px, pz, 0.4, 5.6, 0.4, 0xb3bcb6); }
  };
  wall(sx - w / 2, sz - d / 2, sx + w / 2, sz - d / 2, []);
  wall(sx - w / 2, sz + d / 2, sx + w / 2, sz + d / 2, [[w / 2 - 4, w / 2 + 4]]);
  wall(sx - w / 2, sz - d / 2, sx - w / 2, sz + d / 2, [[d / 2 - 3, d / 2 + 3]]);
  wall(sx + w / 2, sz - d / 2, sx + w / 2, sz + d / 2, []);
  for (const dz of [-d / 2, d / 2]) K.box(sx, sz + dz, w + 0.4, 0.4, 0.4, 0xb3bcb6, { y: 6.0, collide: false });
  for (const dx of [-w / 2, w / 2]) K.box(sx + dx, sz, 0.4, 0.4, d, 0xb3bcb6, { y: 6.0, collide: false });
  for (let t = -w / 2 + 3; t < w / 2; t += 6.5) K.box(sx + t, sz, 0.35, 0.35, d, 0xb3bcb6, { y: 6.0, collide: false });
  glass(K, sx, DECK + 6.4, sz, w, 0.2, d);
  // inside: eggs, crystals, creep, braziers
  for (const [x, z, s] of [[-7, -4, 1.2], [-3, 3, 1.0], [4, -5, 1.3], [8, 2, 1.1], [0, 6, 0.9], [-9, 4, 1.0]]) eggs(K, sx + x, sz + z, s);
  for (const [x, z] of [[-10, -7], [10, -7], [11, 6]]) TK.crystals(K, sx + x, sz + z, 1.2);
  for (const [x, z] of [[-4, -1], [6, -1]]) TK.creep(K, sx + x, sz + z, 9, 6);
  TK.brazier(K, sx - 6, sz - 7); TK.brazier(K, sx + 3, sz + 7);
  K.light(sx, 4.4, sz, 0x6dff8e, 9, 30);
  // outside: gunk and growth running to the wing
  for (const [x, z, s] of [[24, -108, 1.4], [44, -108, 1.2], [14, -114, 1.5], [52, -112, 1.2], [14, -124, 1.3], [8, -122, 1.3], [-10, -120, 1.4], [2, -132, 1.5], [-12, -132, 1.3], [54, -134, 1.3]]) { TK.hive(K, x, z, s); TK.creep(K, x + 2, z + 1, 6, 5); }
  for (const [x, z] of [[18, -108], [38, -106], [0, -114], [-8, -128], [10, -130], [50, -136]]) TK.crystals(K, x, z, 1.4);
  for (const [x, z] of [[-2, -114], [26, -112]]) TK.brazier(K, x, z);
  for (const [x, z, s] of [[4, -116, 1.0], [30, -106, 1.1], [-6, -126, 1.2]]) eggs(K, x, z, s);
  K.light(4, 5, -124, 0x6dff8e, 9, 30);
}

// ------------------------------------------------------------------ the descent tube and the Sunken Gallery

let WATER = null;
/** The sea seen through the windows: an inside-out teal box round the whole gallery. Seen only from within. */
function water(K, x0, x1, z0, z1, y0, y1) {
  WATER ??= new THREE.MeshStandardMaterial({ color: 0x2a7e7c, emissive: 0x185a58, emissiveIntensity: 0.55, roughness: 0.4, side: THREE.BackSide });
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), WATER);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.userData.noMerge = true;
  K.scene.add(m);
}

/** A gallery wall along x or z from a to b (the other coordinate fixed at c): a sill, ribs every 5 m, a lintel, panes between, and one collider the full height. */
function sunkWall(K, alongX, c, a, b, o = {}) {
  const lo = Math.min(a, b), hi = Math.max(a, b), t = 1.0, top = SEA, gaps = o.gaps || [];
  const at = (u, w, y0, h, color, gl) => (alongX ? A(K, u, y0, c, w, h, t, color, { glow: gl }) : A(K, c, y0, u, t, h, w, color, { glow: gl }));
  const cut = [[lo, lo], ...gaps.map(([p, q]) => [p, q]), [hi, hi]];
  for (let i = 0; i < cut.length - 1; i++) {
    const s0 = cut[i][1], s1 = cut[i + 1][0];
    if (s1 - s0 < 0.5) continue;
    const mid = (s0 + s1) / 2, L = s1 - s0;
    at(mid, L, 0, 1.4, WALLD); at(mid, L, 6.2, top - 6.2, WALLD);
    if (!o.solid) {
      for (let u = s0; u <= s1 + 0.01; u += 5) at(Math.min(u, s1), 0.9, 1.4, 4.8, WALL);
      (alongX ? glass(K, mid, 1.4, c, L, 4.8, 0.12) : glass(K, c, 1.4, mid, 0.12, 4.8, L));
      at(mid, L, 5.4, 0.12, 0x9fe8d8, 1.0);
    } else at(mid, L, 1.4, 4.8, WALLD);
    if (alongX) solid(K, s0, 0, c - t / 2, s1, top, c + t / 2); else solid(K, c - t / 2, 0, s0, c + t / 2, top, s1);
  }
}

/** The tube: a ramp from the dome floor down to the gallery. Its walls and roof are tilted slabs that follow the floor, so nothing floats and nothing is clipped. */
function tube(K) {
  const { x0, x1, h0, h1 } = TITAN_RAMP, zc = TITAN_RAMP.z0, L = x1 - x0, th = Math.atan2(h0 - h1, L), cs = Math.cos(th), mx = (x0 + x1) / 2, fy = (x) => h0 - (x - x0) * (h0 - h1) / L;
  const slab = (z, wd, hv, yv, color, o = {}) => K.mesh(new THREE.BoxGeometry(L / cs, hv, wd), color, mx, yv - K.ground(mx, z), z, { rz: -th, glow: o.glow, collide: false });
  // walls (vertical faces, slanted top and foot) on both sides, a roof 8 m over the floor, and a grated floor plate laid on the ramp
  for (const z of [zc - 4.5, zc + 4.5]) { slab(z, 1.0, 9.8 * cs, fy(mx) + 3.9, WALL); solid(K, x0, 0, z - 0.5, x1, h0 + 8.8, z + 0.5); }
  slab(zc, 11, 0.8 * cs, fy(mx) + 8 + 0.4 / cs, WALLD);
  slab(zc, 8.2, 0.1, fy(mx) + 0.08, GRATE);
  // ribs every 9 m: two pilasters and a beam, standing on the floor under them
  for (let x = x0 + 5; x < x1 - 2; x += 9) {
    const f = fy(x);
    for (const z of [zc - 3.75, zc + 3.75]) A(K, x, f, z, 0.6, 8, 0.5, WALL);
    A(K, x, f + 7.4, zc, 0.6, 0.6, 8, WALL);
  }
  // strip lights under the roof, and a few real lights
  K.mesh(new THREE.BoxGeometry(L / cs - 6, 0.1, 0.5), 0xdaf6ea, mx, fy(mx) + 7.9 - K.ground(mx, zc), zc, { rz: -th, glow: 1.8, collide: false });
  for (const x of [x0 + 8, x0 + 24, x0 + 40]) K.light(x, fy(x) + 6.4 - K.ground(x, zc), zc, 0xdaf6ea, 9, 26);
  // the dome end: an arch over the mouth and a hazard sill; the sea end opens on the gallery
  A(K, x0 - 0.2, h0 + 6.9, zc, 1.0, 1.2, 11, WALLD); A(K, x0 + 0.5, h0 + 6.4, zc, 0.2, 0.3, 9, 0x9fe8d8, { glow: 1.6 });
}

/** The Sunken Gallery: a glass corridor under the water running east then north, then a Hive-held chamber. */
function gallery(K) {
  water(K, 104, 176, -198, -88, -0.5, SEA);
  const roof = (x0, x1, z0, z1) => { A(K, (x0 + x1) / 2, 7.9, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0, 0x4d6866, { glow: 0.3 }); A(K, (x0 + x1) / 2, 8.2, (z0 + z1) / 2, x1 - x0, SEA - 8.2, z1 - z0, K.C.sea); };
  const floor = (x0, x1, z0, z1) => A(K, (x0 + x1) / 2, 0.05, (z0 + z1) / 2, x1 - x0, 0.08, z1 - z0, 0x38403e);
  // the corridor east (x 112 to 152 at z -104 to -96) and north (x 144 to 152 at z -150 to -96)
  roof(111, 153, -105, -95); roof(143, 153, -150, -105); floor(112, 152, -104, -96); floor(144, 152, -150, -96);
  sunkWall(K, true, -104.5, 112, 143); sunkWall(K, true, -95.5, 112, 153);
  sunkWall(K, false, 143.5, -150, -104); sunkWall(K, false, 152.5, -150, -95);
  A(K, 132, 7.8, -100, 40, 0.08, 0.5, 0x9fe8d8, { glow: 1.8 }); A(K, 148, 7.8, -128, 0.5, 0.08, 44, 0x9fe8d8, { glow: 1.8 });
  for (const x of [118, 130, 142]) K.light(x, 6.9 - K.ground(x, -100), -100, 0x9fe8d8, 8, 22);
  for (const z of [-120, -138]) K.light(148, 6.9 - K.ground(148, z), z, 0x9fe8d8, 8, 22);
  // the lab: consoles along the walls, a cracked sample tank, a bench
  for (const [x, z] of [[122, -102.6], [134, -97.4], [128, -102.6]]) { A(K, x, 0, z, 2.4, 1.0, 0.9, HULL2, { collide: true }); A(K, x, 1.0, z, 2.0, 0.06, 0.7, 0x7fe0d0, { glow: 1.4 }); }
  A(K, 138, 0, -101, 2.2, 0.3, 2.2, HULL2, { collide: true }); A(K, 138, 0.3, -101, 1.6, 2.6, 1.6, 0x6fd8a0, { glow: 0.5 });
  // the Hive chamber: a roofed hall with pillars, eggs, crystals and creep
  const cx0 = 108, cx1 = 156, cz0 = -192, cz1 = -150;
  roof(cx0 - 1, cx1 + 1, cz0 - 1, cz1 + 1); floor(cx0, cx1, cz0, cz1);
  for (const z of [-160, -172, -184]) A(K, 132, 7.8, z, 36, 0.08, 0.5, 0x6dff8e, { glow: 1.6 });
  sunkWall(K, true, cz0 - 0.5, cx0, cx1 + 1); sunkWall(K, false, cx0 - 0.5, cz0, cz1, { solid: true }); sunkWall(K, false, cx1 + 0.5, cz0, cz1, { solid: true });
  sunkWall(K, true, cz1 + 0.5, cx0, cx1, { gaps: [[144, 152]] });
  for (const [x, z] of [[120, -162], [132, -162], [144, -166], [120, -178], [132, -178], [144, -182]]) { A(K, x, 0, z, 2.2, 8, 2.2, HIVEWALL, { collide: true }); A(K, x, 7.4, z, 3.0, 0.6, 3.0, CHITIN2); }
  for (const [x, z, s] of [[116, -168, 1.3], [128, -172, 1.5], [138, -160, 1.2], [148, -176, 1.4], [114, -184, 1.2], [140, -186, 1.3], [152, -164, 1.1], [126, -184, 1.2]]) eggs(K, x, z, s);
  for (const [x, z] of [[112, -156], [152, -156], [112, -188], [152, -188], [138, -176], [124, -176]]) TK.crystals(K, x, z, 1.5);
  for (const [x, z, s] of [[130, -156, 1.3], [118, -158, 1.2], [148, -188, 1.4], [110, -172, 1.3], [154, -170, 1.2]]) TK.hive(K, x, z, s);
  for (const [x, z] of [[122, -170], [140, -172], [132, -186]]) TK.creep(K, x, z, 10, 8);
  TK.brazier(K, 126, -158); TK.brazier(K, 142, -158);
  K.light(132, 7, -170, 0x6dff8e, 10, 40); K.light(120, 6, -184, 0x6dff8e, 8, 30); K.light(146, 6, -156, 0x9fe8d8, 8, 26);
  // hanging growth under the roof
  for (let i = 0; i < 16; i++) K.cone(K.R(112, 152), K.R(-188, -154), K.R(0.5, 0.9), K.R(1.6, 3.2), K.RP([CHITIN, CHITIN2]), { y: 8 - 2.4, sides: 5, collide: false, rx: Math.PI });
}

// ------------------------------------------------------------------ the map

export default {
  t_patrol: {
    ...PATROL_DATA.t_patrol,
    build(K) {
      sea(K);
      for (const r of rects) if (r.kind === 'p') { hull(K, r, r.id === 'arco' ? { x: 57, z0: -105.5, z1: -94.5 } : null); if (r.id !== 'arco') plate(K, r, 0x46504d); } else if (r.kind === 'b') bridge(K, r);
      // the sea scenery stands on the water line, not at the world's own (it is lower than the water here)
      TK.seaScenery(Object.assign(Object.create(K), { edge: (fn, n, a, b) => K.edge((x, z) => fn(x, z, SEA), n, a, b) }), 26, 20, 90);

      // ================================================================ roads: deck lanes for the Sparrow across the rigs and bridges, the boulevard in the dome
      road(K, [[0, 160], [0, -30]]);
      road(K, [[8, 160], [28, 158]], 'deck', 6);
      road(K, [[0, 140], [24, 131], [94, 131], [94, 122]]); road(K, [[0, 140], [-24, 131], [-94, 131], [-94, 122]]);
      road(K, [[0, 71], [68, 71], [90, 71], [90, 56]]); road(K, [[94, 122], [93, 86], [90, 71]]);
      road(K, [[0, 71], [-68, 71], [-90, 71], [-90, 56]]); road(K, [[-94, 122], [-93, 86], [-90, 71]]);
      road(K, [[-90, 66], [-99, 50], [-99, 40], [-94, 36], [-92, 30]]);
      road(K, [[90, 56], [89, 46], [89, 26], [90, 6]]);
      road(K, [[0, 5], [68, 5], [90, 5]]); road(K, [[0, 5], [-90, 5]]);
      road(K, [[0, -30], [0, -62], [-14, -78], [-20, -100], [-14, -122], [0, -136], [0, -150]], 'boulevard');
      road(K, [[0, -62], [16, -80], [22, -100], [56, -100]], 'boulevard', 10);
      road(K, [[22, -100], [34, -112], [34, -118]], 'boulevard', 8);
      road(K, [[0, -136], [-6, -128]], 'boulevard', 6);

      landing(K);
      pump(K);
      // Rig Three, the breach rig (public event ground at its middle): stations and silos on the edges, Hive crawling up the east and south sides
      drillRig(K, rects[2], {
        stations: [[80, 106, 10, 8, 8, {}], [108, 138, 10, 8, 9, { color: 0xe4a864, trim: RED, base: HULL2 }]],
        silos: [[104, 106, 2, 3.4, 8, 8, 0]], crates: [[78, 136, true, 2], [112, 118, true, 1]], cranes: [[110, 126, 15, -1, true]], hazards: [[84, 104, 102, 104, true]],
      });
      for (const [x, z, s] of [[114, 120, 1.3], [113, 132, 1.2], [100, 142, 1.2], [88, 142, 1.1]]) { TK.hive(K, x, z, s); TK.creep(K, x - 0.5, z - 0.5, 5, 4); }
      // Rig Four: a derrick and a crane yard
      drillRig(K, rects[3], {
        derrick: [-108, 110], stations: [[-80, 138, 10, 8, 8, {}]], crates: [[-110, 134, true, 2], [-100, 134, true, 1], [-78, 106, false, 1]], cranes: [[-84, 104, 14, 1, false]], hazards: [[-94, -76, 142, 144, true]],
      });
      // Rig Five: a flare and a processing block
      drillRig(K, rects[4], {
        flare: [106, 52], stations: [[76, 80, 11, 9, 8, { color: 0xe4a864, trim: RED, base: HULL2 }], [104, 78, 8, 8, 10, {}]], stacks: [[74, 50]], crates: [[100, 64, true, 1], [76, 62, false, 1]], hazards: [[84, 96, 48, 50, true]],
      });
      // Rig Six: a tank farm
      drillRig(K, rects[5], {
        silos: [[-106, 52, 4, 3.6, 9, 8.4, 0], [-106, 78, 3, 3.2, 7, 8.4, 0]], stations: [[-76, 58, 8, 8, 8, {}]], crates: [[-80, 82, false, 2]], cranes: [[-74, 78, 14, -1, true]], stacks: [[-112, 62]],
      });
      sirensWatch(K);
      // Rig Eight: a drilling rig; Rig Seven: a waystation
      drillRig(K, rects[7], {
        derrick: [102, 12], stations: [[76, -8, 10, 8, 8, {}], [76, 18, 8, 6, 6, { color: 0xe4a864, trim: RED, base: HULL2 }]], silos: [[96, -8, 2, 3.2, 7, 7.6, 0]], crates: [[106, 22, true, 1], [74, 0, true, 1]], hazards: [[84, 100, -12, -10, true]],
      });
      drillRig(K, rects[8], {
        stations: [[-14, 18, 10, 8, 7, {}], [14, -8, 10, 8, 8, { color: 0xe4a864, trim: RED, base: HULL2 }]], silos: [[8, 16, 2, 3, 6, 7, 0]], crates: [[-14, -8, true, 1]], stacks: [[-18, 6]],
      });
      // the dome and everything in it
      arcology(K);
      hiveHold(K);
      tube(K);
      gallery(K);
    },
  },
};
