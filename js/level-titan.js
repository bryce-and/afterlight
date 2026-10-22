// Hand-built Titan mission maps (see makeKit in world.js). U16e High Ground: every mission now has real ground (terrain list) over the methane sea.
// New Pacific Arcology: a Golden Age city on stilts over the methane sea, with the Hive creeping through it.
// t1 Hope (storm): a raised rig deck with a derrick, a causeway to the Siren's Watch dish tower, a descent onto the arcology podium, the hangar.
// t2 The Sunken Labs (day): the route steps DOWN twice: entry hall (6 m) -> hull gangway -> Solarium (3 m) -> service tunnel -> flooded labs (0 m).
// t3 Savathun's Song (dusk): rig platforms on the sea, the Spine climbs to a hub, drops under the hull, a pit-shaped Hive nest, the throne hall.
// U15: boss arenas are closed rooms (zone `room`) behind a zone-clear K.door; decks and mezzanines are player-only flanks; main routes are terrain ramps.
import * as THREE from 'three';

const PALE = 0xdde1dc, PALE2 = 0xb9c0bb, AMBER = 0xffc56a, GREEN = 0x6dff8e, CHITIN = 0x26282a, CHITIN2 = 0x3b3c32;
const YELLOW = 0xd2a032, TRUNK = 0x5a5048, SOIL = 0x3a3128, LAMP = 0xfff1d0, FLOOD = 0x1f4d4a, TEAL = 0x3f7a78;
const CONT = [0xa8562a, 0x3f7a78, 0x8a8f8c, 0xb08a38, 0x56688a];
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

// ---------------------------------------------------------------------------
// shared pieces
// ---------------------------------------------------------------------------
// railing along any line: pale lip, posts and a top rail (visual only). Segments subdivide where the ground climbs, so it follows ramps.
function rail(K, ax, az, bx, bz, y = 0) {
  const L = Math.hypot(bx - ax, bz - az);
  if (L < 0.5) return;
  const ry = Math.atan2(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(L / 10), Math.ceil(Math.abs(K.ground(bx, bz) - K.ground(ax, az)) / 0.6));
  for (let k = 0; k < n; k++) {
    const x0 = ax + ((bx - ax) * k) / n, z0 = az + ((bz - az) * k) / n, x1 = ax + ((bx - ax) * (k + 1)) / n, z1 = az + ((bz - az) * (k + 1)) / n;
    const l = L / n, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    K.mesh(new THREE.BoxGeometry(0.5, 0.3, l), PALE2, cx, y + 0.15, cz, { ry });
    K.mesh(new THREE.BoxGeometry(0.1, 0.1, l), K.C.metal, cx, y + 1.05, cz, { ry });
    K.mesh(new THREE.BoxGeometry(0.16, 1.05, 0.16), K.C.metal, x0, y + 0.525, z0);
  }
  K.mesh(new THREE.BoxGeometry(0.16, 1.05, 0.16), K.C.metal, bx, y + 0.525, bz);
}

// rig leg standing in the sea: reaches down to the water from whatever height the deck is
function pylon(K, x, z) {
  const g = K.ground(x, z);
  K.cyl(x, z, 1.1, g + 2.4, K.C.rock2, { y: -g - 1.4, collide: false, sides: 8 });
  K.cyl(x, z, 1.4, 0.35, K.C.metal, { y: 0.95, collide: false, sides: 8 });
}

// the whole play area is one deck: rail its rim, give it a thick edge and legs into the sea
function deckEdge(K, step = 28) {
  const { minX, maxX, minZ, maxZ } = K.bounds, C = K.C;
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, W = maxX - minX, D = maxZ - minZ;
  rail(K, minX + 0.3, minZ, minX + 0.3, maxZ);
  rail(K, maxX - 0.3, minZ, maxX - 0.3, maxZ);
  rail(K, minX, minZ + 0.3, maxX, minZ + 0.3);
  rail(K, minX, maxZ - 0.3, maxX, maxZ - 0.3);
  K.box(minX - 0.7, cz, 1.4, 1.2, D + 2.8, C.metal, { y: -1, collide: false });
  K.box(maxX + 0.7, cz, 1.4, 1.2, D + 2.8, C.metal, { y: -1, collide: false });
  K.box(cx, minZ - 0.7, W, 1.2, 1.4, C.metal, { y: -1, collide: false });
  K.box(cx, maxZ + 0.7, W, 1.2, 1.4, C.metal, { y: -1, collide: false });
  for (let z = minZ + 8; z < maxZ; z += step) { pylon(K, minX - 3, z); pylon(K, maxX + 3, z); }
  for (let x = minX + 8; x < maxX; x += step) { pylon(K, x, minZ - 3); pylon(K, x, maxZ + 3); }
}

// distant arcology on the methane sea: stilted blocks with amber window bands, rig platforms, slender towers
function seaScenery(K, n = 22, near = 20, far = 85) {
  const C = K.C;
  K.edge((x, z, y) => {
    const t = K.rng();
    if (t < 0.5) {
      const w = K.R(10, 24), d = K.R(10, 24), h = K.R(8, 28), lift = K.R(3, 7);
      for (const [sx, sz] of CORNERS) K.box(x + sx * (w / 2 - 1), z + sz * (d / 2 - 1), 1.4, lift + 0.5, 1.4, C.rock2, { y, collide: false });
      K.box(x, z, w, h, d, K.RP([PALE, PALE2]), { y: y + lift, collide: false });
      for (let yy = y + lift + 2.5; yy < y + lift + h - 1; yy += 5) K.box(x, z, w + 0.1, 0.5, d + 0.1, AMBER, { y: yy, collide: false, glow: 1.1 });
      K.box(x, z, w * 0.5, 2, d * 0.5, C.metal, { y: y + lift + h, collide: false });
    } else if (t < 0.78) { // rig platform with a derrick
      const s = K.R(14, 22);
      for (const [sx, sz] of CORNERS) K.cyl(x + sx * s * 0.4, z + sz * s * 0.4, 0.9, 5, C.rock2, { y, collide: false });
      K.box(x, z, s, 1, s, C.metal, { y: y + 5, collide: false });
      K.cyl(x - s * 0.2, z, 2.4, K.R(12, 20), YELLOW, { y: y + 6, r2: 0.5, sides: 4, collide: false });
      K.box(x + s * 0.2, z, 2.5, 2.6, 6.1, K.RP(CONT), { y: y + 6, collide: false });
    } else { // slender tower
      const h = K.R(28, 50);
      K.cyl(x, z, 2.2, h, PALE, { y, sides: 8, collide: false });
      K.cyl(x, z, 4.5, 2, C.metal, { y: y + h, sides: 8, collide: false });
      K.cyl(x, z, 2.3, 0.6, AMBER, { y: y + h * 0.6, sides: 8, collide: false, glow: 1.2 });
    }
  }, n, near, far);
}

// arcology building block with amber window bands and a roof unit
function arco(K, x, z, w, d, h, o = {}) {
  const y = o.y ?? 0;
  K.box(x, z, w, h, d, o.color ?? PALE, { y, collide: o.collide ?? true });
  for (let yy = y + 2.2; yy < y + h - 1; yy += o.every ?? 4) K.box(x, z, w + 0.1, 0.45, d + 0.1, AMBER, { y: yy, collide: false, glow: 1.1 });
  K.box(x, z, w + 0.6, 0.5, d + 0.6, K.C.metal, { y: y + h, collide: false });
  if (o.cap !== false) K.box(x + w * 0.15, z - d * 0.1, w * 0.4, 1.6, d * 0.35, K.C.metal, { y: y + h + 0.5, collide: false });
}

// Hive growth: a cluster of leaning chitin spikes with green crystals
function hive(K, x, z, s = 1, o = {}) {
  const y = o.y ?? 0, n = 3 + Math.floor(K.rng() * 2);
  for (let i = 0; i < n; i++) {
    const r = K.R(0.35, 0.8) * s, h = K.R(1.6, 4.2) * s;
    K.cone(x + K.R(-1, 1) * s, z + K.R(-1, 1) * s, r, h, K.RP([CHITIN, CHITIN2]), { y, sides: 5, collide: false, rx: K.R(-0.35, 0.35), rz: K.R(-0.35, 0.35) });
  }
  for (let i = 0; i < 2; i++) K.mesh(new THREE.OctahedronGeometry(K.R(0.35, 0.7) * s, 0), GREEN, x + K.R(-1.2, 1.2) * s, y + K.R(0.4, 1.2) * s, z + K.R(-1.2, 1.2) * s, { glow: 1.6, scale: [1, 1.8, 1] });
  if (o.collide !== false) K.collider(x - 1.1 * s, y, z - 1.1 * s, x + 1.1 * s, y + 2.4 * s, z + 1.1 * s, null);
}

// tall green Hive crystal cluster
function crystals(K, x, z, s = 1, collide = true, y = 0) {
  for (let i = 0; i < 4; i++) K.mesh(new THREE.OctahedronGeometry(K.R(0.4, 0.8) * s, 0), GREEN, x + K.R(-0.9, 0.9) * s, y + K.R(0.6, 1.4) * s, z + K.R(-0.9, 0.9) * s, { glow: 1.5, scale: [1, K.R(1.8, 2.8), 1], rx: K.R(-0.3, 0.3), rz: K.R(-0.3, 0.3) });
  if (collide) K.collider(x - s, y, z - s, x + s, y + 2.6 * s, z + s, null);
}

// dark Hive stain on the floor with glowing veins
function creep(K, x, z, w, d, y = 0) {
  K.box(x, z, w, 0.26, d, CHITIN, { y, collide: false });
  K.box(x, z, w * 0.8, 0.28, 0.2, GREEN, { y, collide: false, glow: 1.2 });
  K.box(x + w * 0.15, z, 0.2, 0.28, d * 0.7, GREEN, { y, collide: false, glow: 1.2 });
}

// shipping container (rot = long side along z)
function container(K, x, z, rot, y = 0, color) {
  K.box(x, z, rot ? 2.5 : 6.1, 2.6, rot ? 6.1 : 2.5, color ?? K.RP(CONT), { y });
}
function stack(K, x, z, rot, n) {
  for (let i = 0; i < n; i++) container(K, x + (i ? K.R(-0.25, 0.25) : 0), z + (i ? K.R(-0.25, 0.25) : 0), rot, i * 2.6);
}
// a lane of containers along z at x (rot: long side along z), with the listed z centres and heights
function lane(K, x, list) {
  for (const [z, n] of list) stack(K, x, z, true, n);
}

// dock crane: four legs, a cab, and a long jib along x or z (dir +-1)
function crane(K, x, z, h = 20, dir = 1, alongX = true) {
  for (const [sx, sz] of CORNERS) K.box(x + sx * 2.5, z + sz * 2.5, 0.9, h, 0.9, YELLOW);
  K.box(x, z, 6.4, 1.2, 6.4, YELLOW, { y: h, collide: false });
  K.box(x, z, 4, 3, 4, PALE, { y: h + 1.2, collide: false });
  const L = 28, jc = dir * (L / 2 - 5), tip = dir * (L - 6);
  if (alongX) {
    K.box(x + jc, z, L, 1.2, 1.4, YELLOW, { y: h + 4.2, collide: false });
    K.box(x - dir * 6, z, 4, 2.4, 3, K.C.rock2, { y: h + 2.4, collide: false });
    K.box(x + tip, z, 0.12, h - 3.8, 0.12, CHITIN, { y: 8, collide: false });
    K.box(x + tip, z, 1.4, 0.8, 1.4, K.C.metal, { y: 7.2, collide: false });
  } else {
    K.box(x, z + jc, 1.4, 1.2, L, YELLOW, { y: h + 4.2, collide: false });
    K.box(x, z - dir * 6, 3, 2.4, 4, K.C.rock2, { y: h + 2.4, collide: false });
    K.box(x, z + tip, 0.12, h - 3.8, 0.12, CHITIN, { y: 8, collide: false });
    K.box(x, z + tip, 1.4, 0.8, 1.4, K.C.metal, { y: 7.2, collide: false });
  }
}

// axis-aligned pipe on supports (bottom of pipe at y)
function pipeRun(K, x1, z1, x2, z2, y = 2.6, r = 0.6, color) {
  const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1), L = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  K.mesh(new THREE.CylinderGeometry(r, r, L, 8), color ?? K.C.metal, (x1 + x2) / 2, y + r, (z1 + z2) / 2, alongX ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 });
  const n = Math.max(1, Math.round(L / 12));
  for (let k = 0; k <= n; k++) {
    const px = x1 + ((x2 - x1) * k) / n, pz = z1 + ((z2 - z1) * k) / n;
    if (y > 0.5) K.box(px, pz, 0.7, y, 0.7, K.C.rock2);
    K.box(px, pz, alongX ? 0.9 : 2 * r + 0.6, 0.3, alongX ? 2 * r + 0.6 : 0.9, K.C.metal, { y: Math.max(0, y - 0.32), collide: false });
  }
}

function lamp(K, x, z, h = 6, color = AMBER, y = 0) {
  K.box(x, z, 0.3, h, 0.3, K.C.metal, { y });
  K.box(x, z, 0.9, 0.4, 0.9, color, { y: y + h, collide: false, glow: 1.8 });
}

function tank(K, x, z, r = 4, h = 6) {
  K.cyl(x, z, r, h, PALE, { sides: 10 });
  K.cyl(x, z, r + 0.05, 0.45, AMBER, { y: h * 0.7, sides: 10, glow: 1.1, collide: false });
  K.cyl(x, z, r * 0.6, 0.6, K.C.metal, { y: h, sides: 10, collide: false });
}

// dead tree with bare branches
function tree(K, x, z, y = 0, h = 7) {
  K.cyl(x, z, 0.45, h, TRUNK, { y, r2: 0.22, sides: 6 });
  for (let i = 0; i < 3; i++) {
    const a = K.R(0, 6.28), L = K.R(2, 3.4);
    K.mesh(new THREE.CylinderGeometry(0.08, 0.18, L, 5), TRUNK, x + Math.sin(a) * L * 0.35, y + h * K.R(0.55, 0.9), z + Math.cos(a) * L * 0.35, { rx: Math.cos(a) * 0.8, rz: -Math.sin(a) * 0.8 });
  }
}

// semicircular rib arch (chitin or steel); feet get small colliders
function archRib(K, x, z, R, h, alongX, color = CHITIN, tube = 0.7, y = 0) {
  K.mesh(new THREE.TorusGeometry(R, tube, 5, 14, Math.PI), color, x, y, z, { ry: alongX ? 0 : Math.PI / 2, scale: [1, h / R, 1] });
  for (const s of [-1, 1]) {
    const fx = alongX ? x + s * R : x, fz = alongX ? z : z + s * R;
    K.collider(fx - 1, y, fz - 1, fx + 1, y + 3, fz + 1, null);
  }
}

function brazier(K, x, z, y = 0) {
  K.cyl(x, z, 0.8, 1.3, CHITIN2, { y, r2: 1.1, sides: 6 });
  K.cone(x, z, 0.8, 2.2, GREEN, { y: y + 1.3, glow: 2, collide: false, sides: 5 });
  K.cone(x, z, 0.4, 3, 0xd8ffe0, { y: y + 1.3, glow: 2.2, collide: false, sides: 5 });
}

function glassMat() {
  return new THREE.MeshStandardMaterial({ color: 0xbfe8e0, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.5, side: THREE.DoubleSide, depthWrite: false });
}
function glassBox(K, gm, x, z, w, h, d, y = 0, collide = true) {
  const g = K.ground(x, z);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), gm);
  m.position.set(x, g + y + h / 2, z);
  K.scene.add(m);
  if (collide) K.collider(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, null);
  return m;
}

// glowing light strips along the inner faces of a K.room
function roomStrips(K, cx, cz, w, d, y, color = AMBER) {
  const t = 0.55;
  K.box(cx, cz - d / 2 + t, w - 1.2, 0.3, 0.12, color, { y, collide: false, glow: 1.4 });
  K.box(cx, cz + d / 2 - t, w - 1.2, 0.3, 0.12, color, { y, collide: false, glow: 1.4 });
  K.box(cx - w / 2 + t, cz, 0.12, 0.3, d - 1.2, color, { y, collide: false, glow: 1.4 });
  K.box(cx + w / 2 - t, cz, 0.12, 0.3, d - 1.2, color, { y, collide: false, glow: 1.4 });
}

// oil derrick: four leaning legs (you can walk through them), rings, a crown block and a drill string. y0 = height of the floor under it
function derrick(K, x, z, h = 34, y0 = 0) {
  const base = 3.4, top = 0.9, ang = Math.atan((base - top) / h), len = Math.hypot(h, (base - top) * 1.41);
  for (const [sx, sz] of CORNERS) {
    K.mesh(new THREE.BoxGeometry(0.55, len, 0.55), YELLOW, x + (sx * (base + top)) / 2, y0 + h / 2, z + (sz * (base + top)) / 2, { rx: -sz * ang, rz: sx * ang });
    K.collider(x + sx * base - 0.6, y0, z + sz * base - 0.6, x + sx * base + 0.6, y0 + 9, z + sz * base + 0.6, null);
  }
  for (const k of [0.16, 0.34, 0.52, 0.7, 0.88]) {
    const s = base - (base - top) * k, yy = y0 + h * k;
    K.box(x, z + s, 2 * s, 0.3, 0.3, YELLOW, { y: yy, collide: false });
    K.box(x, z - s, 2 * s, 0.3, 0.3, YELLOW, { y: yy, collide: false });
    K.box(x + s, z, 0.3, 0.3, 2 * s, YELLOW, { y: yy, collide: false });
    K.box(x - s, z, 0.3, 0.3, 2 * s, YELLOW, { y: yy, collide: false });
  }
  K.cyl(x, z, 0.5, h, K.C.metal, { y: y0, sides: 6, collide: false });
  K.cyl(x, z, 1.4, 1.4, K.C.metal, { y: y0 + 0.3, sides: 8, collide: false });
  K.box(x, z, 3.2, 2.2, 3.2, YELLOW, { y: y0 + h, collide: false });
  K.box(x, z, 1.4, 5, 1.4, K.C.metal, { y: y0 + h + 2.2, collide: false });
  K.box(x, z, 0.9, 0.5, 0.9, 0xff4a2a, { y: y0 + h + 7.2, collide: false, glow: 1.8 });
}

// methane flare stack with a burning tip
function flare(K, x, z, h = 34, y0 = 0) {
  K.cyl(x, z, 0.9, h, K.C.metal, { y: y0, sides: 6, r2: 0.5 });
  for (let k = 1; k < 5; k++) K.cyl(x, z, 1.5, 0.3, YELLOW, { y: y0 + (h * k) / 5, sides: 6, collide: false });
  K.cone(x, z, 1.5, 4.5, 0xff8a2a, { y: y0 + h, glow: 2.4, collide: false, sides: 6 });
  K.cone(x, z, 0.8, 7.5, 0xffd070, { y: y0 + h, glow: 2.6, collide: false, sides: 5 });
  K.light(x, y0 + h + 2, z, 0xff8a3a, 12, 70);
}

// satellite dish on a stalk (y above the ground at x, z); faces up and toward +x by default
function dish(K, x, y, z, r = 8, tilt = -0.7, ry = 0) {
  K.mesh(new THREE.ConeGeometry(r, r * 0.28, 18), PALE, x, y, z, { rx: Math.PI + tilt, ry });
  K.mesh(new THREE.TorusGeometry(r, 0.3, 4, 26), K.C.metal, x, y + 0.1, z, { rx: Math.PI / 2 + tilt, ry });
  K.mesh(new THREE.CylinderGeometry(0.15, 0.15, r * 0.95, 4), K.C.metal, x, y + r * 0.42, z, { rx: tilt, ry });
  K.mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), K.C.metal, x, y - 1.2, z);
}

// slim lattice mast with a beacon
function mast(K, x, z, h, y0 = 0) {
  K.cyl(x, z, 0.7, h, PALE2, { y: y0, sides: 4, r2: 0.22 });
  for (const f of [0.35, 0.6, 0.82]) K.box(x, z, 3.4 * (1 - f * 0.7), 0.25, 0.25, K.C.metal, { y: y0 + h * f, collide: false });
  K.box(x, z, 0.5, 0.5, 0.5, 0xff4a2a, { y: y0 + h, collide: false, glow: 1.8 });
}

// Separate platforms over the sea: everything in bounds that is not a walkable rect becomes
// water (flat sea-coloured slab + tall invisible collider), and every platform edge gets a railing.
function seaPlatforms(K, rects) {
  const { minX, maxX, minZ, maxZ } = K.bounds, C = K.C;
  const uniq = (a) => [...new Set(a)].sort((p, q) => p - q);
  const xs = uniq([minX, maxX, ...rects.flatMap((r) => [r[0], r[1]])]).filter((v) => v >= minX && v <= maxX);
  const zs = uniq([minZ, maxZ, ...rects.flatMap((r) => [r[2], r[3]])]).filter((v) => v >= minZ && v <= maxZ);
  const nx = xs.length - 1, nz = zs.length - 1;
  const W = [];
  for (let i = 0; i < nx; i++) {
    W.push([]);
    for (let j = 0; j < nz; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
      W[i].push(rects.some((r) => cx > r[0] && cx < r[1] && cz > r[2] && cz < r[3]));
    }
  }
  const walk = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && W[i][j];
  // water: greedy merge of non-walkable cells into rectangles
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
    K.box((x1 + x2) / 2, (z1 + z2) / 2, x2 - x1 - 0.04, 0.22, z2 - z1 - 0.04, C.sea, { collide: false });
    K.collider(x1, -2, z1, x2, 60, z2, null);
  }
  // railings on lines of constant z
  for (let j = 0; j <= nz; j++) {
    let run = null;
    for (let i = 0; i <= nx; i++) {
      const s = i < nx && walk(i, j) !== walk(i, j - 1) ? (walk(i, j) ? 1 : -1) : 0;
      if (run && s !== run.s) { rail(K, xs[run.i], zs[j] + run.s * 0.3, xs[i], zs[j] + run.s * 0.3); run = null; }
      if (s && !run) run = { i, s };
    }
  }
  // railings on lines of constant x
  for (let i = 0; i <= nx; i++) {
    let run = null;
    for (let j = 0; j <= nz; j++) {
      const s = j < nz && walk(i, j) !== walk(i - 1, j) ? (walk(i, j) ? 1 : -1) : 0;
      if (run && s !== run.s) { rail(K, xs[i] + run.s * 0.3, zs[run.j], xs[i] + run.s * 0.3, zs[j]); run = null; }
      if (s && !run) run = { j, s };
    }
  }
  // rig legs at platform corners and under bridge spans
  const isWalk = (x, z) => rects.some((r) => x > r[0] && x < r[1] && z > r[2] && z < r[3]);
  for (const r of rects) {
    const pts = r[4] === 'b'
      ? ((r[1] - r[0]) > (r[3] - r[2])
        ? [[(r[0] + r[1]) / 2, r[2] - 1.8], [(r[0] + r[1]) / 2, r[3] + 1.8]]
        : [[r[0] - 1.8, (r[2] + r[3]) / 2], [r[1] + 1.8, (r[2] + r[3]) / 2]])
      : [[r[0] - 1.8, r[2] - 1.8], [r[1] + 1.8, r[2] - 1.8], [r[0] - 1.8, r[3] + 1.8], [r[1] + 1.8, r[3] + 1.8]];
    for (const [px, pz] of pts) if (!isWalk(px, pz)) pylon(K, px, pz);
  }
}

// ---------------------------------------------------------------------------
export default {
  // =========================================================================
  // HOPE (storm). Rhythm:
  //   landing deck -> The Rig (raised rig deck, derrick on its drill floor, three container lanes; the fight spills onto the causeway)
  //   -> the gantry causeway climbs over the lower deck to Siren's Watch (a platform on stilts, dish tower with an enterable base)
  //   -> a long descent onto the arcology podium (Plaza) -> a ramp down into the hangar where Kathok waits under a Hive tomb ship.
  // Elevation 0 to 4.8 m (towers and the derrick go much higher).
  // =========================================================================
  t1: {
    spawn: [40, 18],
    bounds: [-80, 80, -250, 30],
    zones: [
      { name: 'The Rig', x: 16, z: -44 },
      { name: "Siren's Watch", x: -30, z: -96 },
      { name: 'Arcology Plaza', x: 12, z: -146 },
      { name: 'Rig Helipad', x: 0, z: -212, boss: true, room: { minX: -31, maxX: 31, minZ: -245, maxZ: -181 } },
    ],
    noEdge: true,
    terrain: [
      { type: 'plateau', x: 30, z: -38, w: 60, d: 50, h: 2.4, edge: 12 },   // the rig deck, a broad low terrace
      { type: 'plateau', x: -30, z: -96, w: 44, d: 40, h: 4.8, edge: 2.5 }, // Siren's Watch, a platform on stilts (cliffs all round)
      { type: 'plateau', x: 8, z: -148, w: 56, d: 50, h: 3.6, edge: 3 },    // the arcology podium
      { type: 'ramp', x0: 4, z0: -60, x1: -14, z1: -82, width: 10, h0: 2.4, h1: 4.8, edge: 3 },      // the gantry causeway
      { type: 'ramp', x0: -18, z0: -108, x1: 2, z1: -134, width: 12, h0: 4.8, h1: 3.6, edge: 3 },    // the long descent to the podium
      { type: 'ramp', x0: 8, z0: -156, x1: 8, z1: -179, width: 14, h0: 3.6, h1: 0, edge: 3 },        // the hangar ramp
    ],
    sky: {
      // a methane storm: low green-black cloud, Saturn a dim ghost behind it, rigs as silhouettes
      zenith: 0x151d1e, mid: 0x34474a, horizon: 0x6a7f76, fog: 0x4e5f58,
      bodies: [{ color: 0xb9a37c, size: 62, pos: [300, 110, -520], ring: true, bands: [0xb9a37c, 0xa48c66, 0xc2ae88, 0x9a8260] }],
      clouds: { n: 30, color: 0x232d2e, opacity: 0.92, y: [45, 125], size: 36 },
      haze: [{ color: 0x56695f, opacity: 0.75, r: 470, h: 170, y: -10 }],
      skyline: [{ kind: 'rig', n: 11, r: [420, 600], h: [40, 100], w: [10, 22], color: 0x1d2626, haze: 0.45 }],
    },
    build(K) {
      const C = K.C;
      deckEdge(K, 30);
      seaScenery(K, 22);

      // ---- landing deck (spawn) ----
      K.mesh(new THREE.CylinderGeometry(12, 12, 0.14, 20), 0x4c5652, 40, 0.07, 12);
      K.mesh(new THREE.TorusGeometry(10.4, 0.3, 4, 28), YELLOW, 40, 0.16, 12, { rx: Math.PI / 2, glow: 0.4 });
      K.box(40, 12, 1.1, 0.06, 7, PALE, { y: 0.14, collide: false }); K.box(40, 12, 6, 0.06, 1.1, PALE, { y: 0.14, collide: false });
      container(K, 66, 22, true);
      stack(K, 14, 24, false, 2);
      arco(K, 70, 2, 10, 12, 7, { cap: false });
      lamp(K, 28, 26); lamp(K, 54, 26);
      tank(K, -30, 18, 4, 6); hive(K, -12, 8, 1.2); creep(K, -14, 6, 8, 5);
      mast(K, 74, 20, 18);

      // ---- The Rig: a raised deck, the derrick on its own drill floor, three container lanes, spoke pipes ----
      K.platform(46, -38, 18, 18, 2.4, { stairs: ['s', 'w'], stairW: 4, color: C.metal }); // the drill floor (player stairs; the deck below is open)
      derrick(K, 46, -38, 36, 2.4);
      for (const [x, z] of [[40, -45], [52, -32], [40, -31]]) K.box(x, z, 1.6, 1.1, 1.6, YELLOW, { y: 2.4 }); // pumps on the drill floor
      rail(K, 37, -29, 55, -29, 2.4); rail(K, 37, -47, 55, -47, 2.4);
      lane(K, 5, [[-18, 1], [-25.5, 1], [-33, 2], [-46, 2], [-53.5, 1]]);
      lane(K, 28, [[-17, 1], [-24.5, 2], [-55, 2], [-62, 1]]);
      lane(K, 58, [[-22, 1], [-29.5, 1], [-37, 2]]);
      stack(K, 16, -22, false, 1); stack(K, 34, -57, false, 1);
      pipeRun(K, 55, -38, 79, -38, 2.6, 0.7);        // spokes: east to the edge
      pipeRun(K, 46, -47, 46, -62, 2.6, 0.7, YELLOW); // north to the flare
      pipeRun(K, 37, -38, 33, -38, 2.6, 0.7);
      flare(K, 52, -62, 38);
      K.box(52, -62, 8, 0.4, 8, 0xff8a2a, { y: 0.05, collide: false, glow: 0.6 });
      crane(K, 66, -12, 20, -1, true);
      crane(K, -6, -26, 18, 1, false);
      arco(K, 70, -62, 10, 12, 9);
      tank(K, -26, -40, 4.5, 7); tank(K, -40, -32, 4, 6);
      hive(K, 14, -52, 1.3); hive(K, 40, -22, 1); hive(K, 22, -30, 1.1);
      creep(K, 16, -36, 9, 5);
      K.light(46, 14, -38, AMBER, 10, 50); K.light(16, 6, -44, AMBER, 8, 30);

      // ---- the gantry causeway: a raised lane over the lower deck, a Hive den under it ----
      {
        const ux = -18, uz = -22, L = Math.hypot(ux, uz), nx = -uz / L, nz = ux / L; // direction and normal of the ramp
        for (const s of [-1, 1]) {
          rail(K, 4 + nx * 4.8 * s, -60 + nz * 4.8 * s, -14 + nx * 4.8 * s, -82 + nz * 4.8 * s, 2.4);
          for (const t of [0.3, 0.7]) lamp(K, 4 + ux * t + nx * 4.8 * s, -60 + uz * t + nz * 4.8 * s, 5, AMBER, 3.2);
        }
        K.box(-4, -72, 5, 2.6, 0.8, PALE2, { y: 3.2, collide: true }); // a deliberate chokepoint: a barrier with gaps either side
        hive(K, -22, -64, 1.4); hive(K, -2, -84, 1.2); creep(K, -14, -70, 10, 6);
        crane(K, -48, -62, 16, 1, true);
        stack(K, 14, -80, true, 2); stack(K, 6, -92, false, 1);
      }

      // ---- Siren's Watch: a dish tower on stilts. The base is a roofed room, its roof a terrace reached by a long stair ----
      {
        const rx = -42, rz = -104;
        K.room(rx, rz, 14, 14, 7, { doors: { e: 6, s: 6 }, roof: true, color: PALE2 });
        K.box(rx, rz, 8, 0.3, 8, 0x59625e, { y: 0.02, collide: false });
        for (const [x, z] of [[-45, -101], [-39, -107]]) K.box(x, z, 2.4, 1.1, 1.2, C.metal);
        K.box(rx, rz, 3, 0.3, 3, AMBER, { y: 0.1, collide: false, glow: 1.3 });
        K.light(rx, 4, rz, AMBER, 8, 22);
        hive(K, -46, -108, 1); creep(K, -41.6, -103, 6, 5, 0.1);
        // tower shaft
        K.cyl(rx, rz, 4.2, 40, PALE, { y: 7.6, sides: 10, r2: 3.4 });
        for (let y = 14; y < 46; y += 7) K.cyl(rx, rz, 4.3, 0.5, AMBER, { y, sides: 10, glow: 1.2, collide: false });
        K.cyl(rx, rz, 7.2, 0.6, C.metal, { y: 47.6, sides: 10, collide: false });
        K.cyl(rx, rz, 2.4, 6, C.metal, { y: 48.2, sides: 8, collide: false });
        dish(K, rx + 5, 56, rz - 1, 10, -0.75, 0.4);
        mast(K, rx - 4, rz + 4, 62, 7.6);
        K.light(rx, 30, rz, AMBER, 8, 40);
        // roof terrace stair (player-only), rails on the terrace
        K.stairs(-35, -113.2, 'w', 3.5, 7.5, { color: C.metal });
        rail(K, rx - 7, rz - 7, rx + 7, rz - 7, 7.6); rail(K, rx + 7, rz - 7, rx + 7, rz + 7, 7.6); rail(K, rx - 7, rz + 7, rx + 7, rz + 7, 7.6); rail(K, rx - 7, rz - 7, rx - 7, rz + 7, 7.6);
      }
      // a deliberate firing line facing the causeway, flanked by container stacks
      for (const z of [-92.5, -85, -77.5]) K.box(-24, z, 0.9, 1.35, 5, PALE2);
      K.box(-24, -81.3, 0.9, 0.3, 2.4, AMBER, { collide: false, glow: 1 });
      stack(K, -18, -100, false, 2); stack(K, -48, -84, false, 1); stack(K, -12, -114, true, 1); stack(K, -30, -113, false, 1);
      tank(K, -50, -92, 3.2, 5);
      hive(K, -22, -108, 1.2); hive(K, -36, -84, 1);
      lamp(K, -10, -90); lamp(K, -10, -112);

      // ---- Arcology Plaza: the podium. White towers round a planted square, a lobby you can cut through, a sculpture ----
      arco(K, -14, -148, 12, 42, 26);
      arco(K, 33, -144, 8, 36, 20);
      arco(K, -12, -176, 16, 6, 18, { cap: false }); arco(K, 26, -176, 16, 6, 18, { cap: false });
      arco(K, -46, -150, 22, 44, 30);   // west of the podium on the lower deck
      arco(K, 54, -134, 12, 26, 14);
      arco(K, 56, -170, 18, 10, 12, { cap: false });
      K.box(10, -128, 44, 1.6, 5, PALE, { y: 11, collide: false }); // skybridge
      K.box(10, -128, 44, 0.3, 5.2, AMBER, { y: 10.8, collide: false, glow: 1.2 });
      // planters at odd places (not a grid)
      for (const [px, pz, s] of [[-2, -136, 5], [18, -139, 5], [-1, -162, 4], [28, -154, 5.5], [20, -166, 3.4]]) {
        K.box(px, pz, s, 0.9, s, PALE);
        K.box(px, pz, s - 0.6, 0.2, s - 0.6, SOIL, { y: 0.9, collide: false });
        K.cone(px, pz, s * 0.3, s * 0.7, C.foliage, { y: 1.1, collide: false });
      }
      // the sculpture at the heart of the square: a pale ring on a plinth, a lit sphere inside it
      K.cyl(12, -158, 3.4, 1.1, PALE, { sides: 12 });
      K.mesh(new THREE.TorusGeometry(3.6, 0.45, 5, 20), PALE2, 12, 5.5, -158, { rx: 0.25 });
      K.mesh(new THREE.OctahedronGeometry(1.1, 0), AMBER, 12, 5.5, -158, { glow: 1.6 });
      K.box(12, -158, 0.5, 4.4, 0.5, PALE2, { y: 1.1, collide: false });
      lamp(K, -6, -150, 7); lamp(K, 34, -150, 7); lamp(K, 14, -130, 7); lamp(K, 4, -170, 7);
      K.box(18, -138, 4, 0.5, 1, C.metal); K.box(-4, -150, 1, 0.5, 4, C.metal);
      // Hive creep climbing the west tower
      K.box(-7.8, -148, 0.3, 12, 14, CHITIN, { collide: false });
      K.box(-7.6, -148, 0.2, 9, 0.3, GREEN, { y: 1, collide: false, glow: 1.3 });
      K.box(-7.6, -144, 0.2, 6, 0.3, GREEN, { y: 2.2, collide: false, glow: 1.3 });
      hive(K, -4, -158, 1.5); hive(K, 29, -166, 1.2); hive(K, 22, -127, 1);
      container(K, 30, -140, true); container(K, 2, -146, false);
      K.light(12, 8, -146, AMBER, 8, 32);
      // the ground-floor lobby: roofed, doors on the plaza side and on the west
      K.room(27, -165, 14, 10, 6, { doors: { w: 5, s: 5 }, roof: true, color: PALE2 });
      K.box(27, -168, 8, 1.1, 1.2, C.metal); K.box(23, -163, 1.2, 0.9, 3, PALE); K.box(31, -162, 3, 0.9, 1.2, PALE);
      K.light(27, 4, -165, AMBER, 7, 18);
      K.platform(25, -130, 6, 4, 2.4, { stairs: ['w'], stairW: 3, color: PALE2 }); // overlook deck
      rail(K, 22, -128, 28, -128, 2.4);
      // the hangar ramp, railed
      for (const s of [-1, 1]) rail(K, 8 + s * 6.8, -158, 8 + s * 6.8, -176, 0);

      // ---- Rig Helipad (boss): a hangar around a painted pad, a fallen crane, Hive spires in no particular order, tomb ship overhead ----
      const bz = -212;
      K.room(0, -213, 64, 64, 9, { doors: { s: 12 }, doorOffset: { s: 8 }, color: 0x4a5450, t: 1.2 });
      K.door(8, -181, 12, 9, 'x', { zone: 2, t: 1.2, color: C.metal, trim: AMBER });
      for (const x of [-26, -10, 12, 27]) K.box(x, -244.2, 1.2, 8.9, 0.5, AMBER, { y: 0, collide: false, glow: 0.9 });
      K.platform(-29.2, -228, 3.2, 16, 3, { stairs: ['s'], stairW: 2.4, color: C.metal }); // one firing deck, on the west wall
      rail(K, -27.6, -236, -27.6, -220, 3);
      K.mesh(new THREE.CylinderGeometry(25, 25, 0.3, 16), 0x4c5652, 0, 0.15, bz);
      K.mesh(new THREE.TorusGeometry(19, 0.35, 4, 32), YELLOW, 0, 0.32, bz, { rx: Math.PI / 2, glow: 0.4 });
      K.box(-3, bz, 1.2, 0.08, 8, PALE, { y: 0.3, collide: false });
      K.box(3, bz, 1.2, 0.08, 8, PALE, { y: 0.3, collide: false });
      K.box(0, bz, 6, 0.08, 1.2, PALE, { y: 0.3, collide: false });
      for (const [x, z, h, lx, lz] of [[-25, -231, 13, 0.2, 0.1], [-13, -242, 9.5, 0.1, -0.2], [3, -243.5, 15.5, -0.1, 0.1], [19, -240, 11, -0.2, -0.1], [-26, -213, 10, 0.25, 0], [-27, -197, 7.5, 0.2, 0.1], [14, -197, 6.5, 0, 0.2]]) {
        K.cone(x, z, K.R(1.6, 2.4), h, CHITIN, { sides: 5, collide: false, rx: lz, rz: lx });
        K.collider(x - 1.3, 0, z - 1.3, x + 1.3, h * 0.6, z + 1.3, null);
      }
      crystals(K, -21, -236, 0.9); crystals(K, 8, -240, 1);
      for (const [x, z] of [[-12, -205], [11, -219], [-6, -226], [14, -203]]) hive(K, x, z, 1.1);
      // the fallen crane across the east side
      K.obox(22, -229, 2.4, 2.4, 34, 0.18, YELLOW);
      K.obox(26, -211, 5, 3, 5, 0.18, PALE);
      K.box(28, -248 + 6, 0.9, 3.4, 0.9, YELLOW, { collide: false });
      stack(K, -20, -196, false, 2); stack(K, 20, -190, true, 1);
      creep(K, 6, bz - 6, 10, 6);
      for (const [x, z] of [[-22, -190], [24, -190]]) lamp(K, x, z, 9, AMBER);
      // Hive tomb ship hanging over the pad
      K.mesh(new THREE.ConeGeometry(5, 46, 5), CHITIN, 26, 34, -232, { rz: Math.PI / 2, rx: 0.15 });
      K.mesh(new THREE.ConeGeometry(3, 18, 4), CHITIN2, 34, 40, -232, { rz: -0.4 });
      K.mesh(new THREE.ConeGeometry(3, 18, 4), CHITIN2, 34, 28, -232, { rz: Math.PI + 0.4 });
      K.box(26, -232, 30, 0.4, 1.2, GREEN, { y: 30.6, collide: false, glow: 1.6 });
      K.light(0, 10, bz, GREEN, 10, 40);
      K.light(22, 26, -232, GREEN, 8, 30);
      K.light(8, 7, -184, AMBER, 7, 22);
    },
  },

  // =========================================================================
  // THE SUNKEN LABS (day). The route steps DOWN twice. Rhythm:
  //   entry deck + the arcology hall (6 m, area) -> a gangway down the hull in the open (traversal, the Solarium zone engages on its way down)
  //   -> the Solarium (3 m, area) -> a service tunnel with a dogleg and a collapse, descending to the waterline (traversal / the labs engage at its foot)
  //   -> the Flooded Labs (0 m, the water has taken the floor) -> a lateral corridor -> the Containment Lab (boss).
  // Elevation 0 to 6 m.
  // =========================================================================
  t2: {
    spawn: [0, 20],
    bounds: [-60, 72, -332, 34],
    zones: [
      { name: 'Arcology Interior', x: -4, z: -34 },
      { name: 'The Solarium', x: 24, z: -112 },
      { name: 'Flooded Labs', x: -6, z: -218 },
      { name: 'Containment Lab', x: 30, z: -296, boss: true, room: { minX: 2, maxX: 58, minZ: -326, maxZ: -266 } },
    ],
    noEdge: true,
    terrain: [
      { type: 'plateau', x: -6, z: -14, w: 80, d: 100, h: 6, edge: 6 },         // the entry deck and the hall
      { type: 'plateau', x: 24, z: -116, w: 84, d: 76, h: 3, edge: 3 },         // the Solarium
      { type: 'ramp', x0: 22, z0: -34, x1: 46, z1: -34, width: 9, h0: 6, h1: 6, edge: 3 },        // the gangway: out of the hall
      { type: 'ramp', x0: 46, z0: -34, x1: 46, z1: -80, width: 9, h0: 6, h1: 3, edge: 3 },         // ... down the hull
      { type: 'ramp', x0: 46, z0: -80, x1: 24, z1: -80, width: 9, h0: 3, h1: 3, edge: 3 },         // ... to the Solarium door
      { type: 'ramp', x0: 24, z0: -140, x1: 24, z1: -160, width: 12, h0: 3, h1: 3, edge: 2.5 },    // service tunnel, leg 1
      { type: 'ramp', x0: 24, z0: -160, x1: -4, z1: -160, width: 12, h0: 3, h1: 3, edge: 2.5 },    // leg 2 (the dogleg)
      { type: 'ramp', x0: -4, z0: -160, x1: -4, z1: -196, width: 12, h0: 3, h1: 0, edge: 2.5 },    // leg 3: down to the waterline
    ],
    sky: {
      // clear teal day: Saturn huge, thin white cloud, the New Pacific skyline standing in the haze
      zenith: 0x2f7f88, mid: 0x7fc0bc, horizon: 0xe2d7a6,
      bodies: [{ color: 0xe6d0a2, size: 135, pos: [250, 190, -470], ring: true, bands: [0xe6d0a2, 0xd6b886, 0xeeddb4, 0xcfa872] }],
      clouds: { n: 14, color: 0xfaf6e8, opacity: 0.7, y: [90, 190], size: 26 },
      skyline: [{ kind: 'tower', n: 9, r: [430, 610], h: [60, 130], w: [10, 18], color: 0x7e9a96, haze: 0.5 }, { kind: 'rig', n: 6, r: [460, 620], h: [40, 80], w: [12, 22], color: 0x6d8c88, haze: 0.5 }],
    },
    build(K) {
      const C = K.C, gm = glassMat();
      deckEdge(K, 26);
      seaScenery(K, 26);

      // ---- entry deck and arcology facade (6 m up) ----
      K.room(-8, -34, 60, 50, 10, { doors: { s: 12, e: 8 }, roof: true });
      arco(K, -8, -34, 44, 34, 14, { y: 10.6, collide: false });
      for (const y of [3, 6.2]) {
        K.box(-22, -8.6, 24, 0.4, 0.2, AMBER, { y, collide: false, glow: 1.3 });
        K.box(6, -8.6, 20, 0.4, 0.2, AMBER, { y, collide: false, glow: 1.3 });
      }
      K.box(-8, -6, 16, 0.5, 6, C.metal, { y: 7, collide: false }); // entrance canopy
      lamp(K, -15, 2, 5); lamp(K, -1, 2, 5);
      for (const [x, z] of [[-30, 14], [20, 22]]) { K.box(x, z, 6, 0.9, 6, PALE); K.cone(x, z, 1.6, 3, C.foliage, { y: 0.9, collide: false }); }
      container(K, -36, 24, true); container(K, 26, 4, true);
      // the tall hull rising beside the gangway and along the west flank of the complex, so the drop has walls to it
      arco(K, -58, -40, 14, 70, 30); arco(K, -58, -150, 14, 90, 34);
      arco(K, 62, -44, 14, 56, 26); arco(K, 62, -200, 14, 60, 22);

      // ---- Arcology Interior: columned hall, lobby clusters, a sealed stairwell well, a fallen ceiling ----
      roomStrips(K, -8, -34, 60, 50, 7.5);
      for (const [x, z] of [[-26, -18], [-17, -27], [4, -17], [9, -41], [-31, -47], [-6, -52]]) { // columns in no grid
        K.box(x, z, 1.6, 10, 1.6, PALE2);
        K.box(x, z, 1.7, 0.3, 1.7, AMBER, { y: 6.5, collide: false, glow: 1.3 });
      }
      for (const [x, z, w] of [[-20, -16, 6], [4, -30, 5], [-14, -44, 7], [10, -22, 4]]) K.box(x, z, w, 0.15, 1.2, LAMP, { y: 9.6, collide: false, glow: 1.5 });
      K.box(-26, -13.4, 12, 1.2, 1.6, C.metal); K.box(-26, -13.4, 12.2, 0.12, 1.8, PALE, { y: 1.2, collide: false }); // reception counter, off the doorway
      // the stairwell: a railed well with the lower floors glowing below it
      K.box(-4, -44, 10.4, 0.22, 7, 0x1a2e2c, { collide: false });
      K.box(-4, -44, 8, 0.2, 5, 0x7fffd0, { y: 0.22, collide: false, glow: 1 });
      for (const [x, z, w, d] of [[-4, -47.7, 10.4, 0.6], [-4, -40.3, 10.4, 0.6], [-9.5, -44, 0.6, 7], [1.5, -44, 0.6, 7]]) K.box(x, z, w, 1.1, d, PALE2);
      K.light(-4, 0.8, -44, 0x7fffd0, 6, 16);
      // lobby furniture clusters
      for (const [x, z] of [[-24, -34], [14, -48], [-12, -22]]) { K.box(x, z, 3.2, 0.7, 1.2, 0x56688a); K.box(x, z - 1.6, 3.2, 0.7, 1.2, 0x56688a); K.box(x + 2.4, z - 0.8, 1.2, 0.5, 1.2, PALE); }
      for (const [x, z] of [[-16, -52], [-24, -52]]) { K.box(x, z, 4, 0.8, 4, PALE); K.cone(x, z, 1.2, 2.4, C.foliage, { y: 0.8, collide: false }); }
      // ceiling fallen across the east side
      K.mesh(new THREE.BoxGeometry(9, 0.6, 5), PALE2, 14, 1.4, -30, { rz: 0.28, ry: 0.4 });
      K.collider(10, 0, -33, 18, 2.4, -27, null);
      K.platform(-33, -34, 8, 22, 3.2, { stairs: ['e'], stairW: 3, color: PALE2 }); // one mezzanine, on the west wall
      rail(K, -29, -45, -29, -23, 3.2);
      hive(K, -28, -9.6 - 3, 1.1); hive(K, 18, -14, 1); hive(K, 14, -52, 1.2); hive(K, -34, -55, 0.9);
      creep(K, 12, -26, 8, 6); creep(K, -26, -50, 7, 6);
      K.light(-8, 8, -18, AMBER, 9, 30); K.light(-8, 8, -48, AMBER, 9, 30);
      K.door(22, -34, 8, 10, 'z', { zone: 0, color: PALE2, trim: AMBER });

      // ---- the gangway: out of the hall onto an open causeway down the hull, Saturn overhead ----
      for (const s of [-1, 1]) {
        rail(K, 22, -34 + 4.8 * s, 46 + 4.8 * s * -1 * 0, -34 + 4.8 * s, 6);
        rail(K, 46 + 4.8 * s, -34, 46 + 4.8 * s, -80, 6);
      }
      rail(K, 46 - 4.8, -80 + 4.8, 24 + 4.8, -80 + 4.8, 3); rail(K, 46 - 4.8, -80 - 4.8, 24 + 4.8, -80 - 4.8, 3);
      for (const [x, z] of [[40, -42], [51, -56], [40, -70], [51, -66]]) lamp(K, x, z, 4.5, AMBER, K.ground(x, z) - K.ground(46, z) + 0.0);
      for (const z of [-44, -58, -72]) K.box(46, z, 11, 0.4, 0.4, K.C.metal, { y: 5.6, collide: false });
      hive(K, 38, -52, 1.2, { y: 0 }); creep(K, 46, -64, 4, 6);
      K.box(46, -52, 3, 1.2, 0.8, PALE2); K.box(46.5, -66, 0.8, 1.2, 3, PALE2); // a little cover on the open stretch
      K.light(46, 5, -58, 0xbfe8e0, 7, 26);

      // ---- The Solarium: a big atrium under a glass dome, dead trees in planters (3 m) ----
      K.room(24, -116, 70, 62, 10, { doors: { s: 10, n: 10 } });
      roomStrips(K, 24, -116, 70, 62, 8.6);
      {
        const dome = new THREE.Group();
        dome.position.set(24, K.ground(24, -116) + 10, -116);
        dome.scale.set(1, 0.5, 31 / 35);
        const shell = new THREE.Mesh(new THREE.SphereGeometry(35, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), gm);
        dome.add(shell);
        const frame = K.mat(C.metal);
        for (let k = 0; k < 4; k++) {
          const rib = new THREE.Mesh(new THREE.TorusGeometry(35, 0.4, 4, 20, Math.PI), frame);
          rib.rotation.y = (k * Math.PI) / 4;
          dome.add(rib);
        }
        for (const [rr, yy] of [[35, 0], [24.7, 24.7], [12, 32.9]]) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.45, 4, 32), frame);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = yy;
          dome.add(ring);
        }
        K.scene.add(dome);
      }
      for (const [px, pz] of [[8, -97], [42, -102], [11, -135], [40, -131], [34, -92]]) { // planters, staggered
        K.box(px, pz, 8, 1, 8, PALE);
        K.box(px, pz, 7.4, 0.15, 7.4, SOIL, { y: 1, collide: false });
        tree(K, px + K.R(-1, 1), pz + K.R(-1, 1), 1.15, K.R(6, 8.5));
      }
      K.platform(-5, -116, 8, 30, 3, { stairs: ['e'], stairW: 3, color: PALE2 }); // one long gallery on the west wall
      rail(K, -0.7, -131, -0.7, -101, 3);
      K.box(30, -141, 16, 0.24, 4, FLOOD, { collide: false, glow: 0.15 }); // dry reflecting pool
      K.box(30, -141, 16.6, 0.5, 0.3, PALE2, { collide: false });
      for (const [x, z] of [[18, -104], [31, -122], [0, -142], [52, -90]]) K.box(x, z, 3, 0.5, 0.9, C.metal);
      for (let i = 0; i < 5; i++) K.mesh(new THREE.BoxGeometry(K.R(1, 2.5), 0.08, K.R(1, 2)), 0xa8d8d0, K.R(-2, 50), 0.2, K.R(-142, -90), { ry: K.R(0, 3), rz: K.R(-0.2, 0.2) });
      { // a section of the dome has come down across the east side
        const g = K.ground(46, -112), pane = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 7), gm);
        pane.position.set(46, g + 3.2, -112); pane.rotation.set(0.1, 0.5, 0.5);
        K.scene.add(pane);
        K.mesh(new THREE.BoxGeometry(12, 0.5, 0.5), C.metal, 46, 3.4, -112, { ry: 0.5, rz: 0.5 });
        K.collider(44.5, 0, -113.5, 47.5, 2.6, -110.5, null);
        K.collider(41, 0, -108, 43.5, 1.2, -105.5, null);
      }
      hive(K, 14, -138, 1.1); hive(K, 38, -90, 1); hive(K, 52, -134, 1.3); creep(K, 48, -132, 7, 5);
      K.light(24, 8, -116, 0xbfe8e0, 9, 40);
      K.door(24, -147, 10, 10, 'x', { zone: 1, color: PALE2, trim: AMBER });

      // ---- service tunnel: down a dogleg to the waterline, with a collapse where the ceiling has fallen ----
      {
        const H = 8, wallZ = (x, a, b) => { for (let z = a; z > b; z -= 6) K.wall(x, z, x, Math.max(b, z - 6), H); };
        K.wall(29.4, -147, 29.4, -165.4, H);          // outer wall of leg 1
        K.wall(18.6, -147, 18.6, -154.6, H);          // inner wall of leg 1
        K.wall(29.4, -165.4, 1.8, -165.4, H);         // north wall of the dogleg
        K.wall(18.6, -154.6, -9.4, -154.6, H);        // south wall of the dogleg
        wallZ(1.4, -165.4, -198);                     // leg 3, east
        wallZ(-9.4, -154.6, -198);                    // leg 3, west
        K.box(24, -156.4, 10.8, 0.6, 18.8, PALE2, { y: H });                  // roof, leg 1
        K.box(-1.5, -160, 14, 0.6, 10.8, PALE2, { y: H });                  // roof over the west end of the dogleg
        K.box(21.5, -160, 6, 0.6, 10.8, PALE2, { y: H });
        for (let z = -166; z > -198; z -= 6) K.box(-4, z - 3, 10.8, 0.6, 6.1, PALE2, { y: H }); // roof, leg 3
        // the collapse: a slab fallen across the middle of the dogleg and daylight through the hole
        K.mesh(new THREE.BoxGeometry(8, 0.7, 5), PALE2, 11, 1.6, -160, { rz: 0.45, ry: 0.3 });
        K.collider(8, 0, -162.4, 14, 2.4, -157.6, null);
        K.mesh(new THREE.BoxGeometry(2, 0.5, 1.4), PALE2, 14.5, 0.3, -163.5, { ry: 0.6, rz: 0.2 });
        K.mesh(new THREE.BoxGeometry(1.6, 0.5, 1.2), PALE2, 7, 0.3, -156.5, { ry: 1.1, rz: -0.2 });
        for (let z = -150; z > -196; z -= 8) K.box(z > -166 ? 24 : -4, z > -166 ? z : z, 0.12, 0.3, 4, LAMP, { y: 7.4, collide: false, glow: 1.4 });
        for (let x = 22; x > -6; x -= 8) K.box(x, -160, 4, 0.3, 0.12, LAMP, { y: 7.4, collide: false, glow: 1.4 });
        pipeRun(K, 28.4, -148, 28.4, -164, 4.2, 0.35); pipeRun(K, 20, -164.4, 3, -164.4, 5, 0.35);
        hive(K, 22, -150, 0.9); hive(K, -7, -176, 1); hive(K, 20, -162, 0.8); creep(K, 24, -152, 6, 5); creep(K, -4, -182, 6, 7);
        K.light(24, 6, -152, AMBER, 7, 18); K.light(12, 9, -160, 0xbfe8e0, 8, 22); K.light(-4, 3, -186, 0x7fffd0, 7, 20);
      }

      // ---- Flooded Labs: the water has the floor. Raised walkways, benches awash, a cracked tank, the ceiling half gone ----
      K.room(-10, -226, 64, 56, 10, { doors: { s: 10, n: 10 }, doorOffset: { s: 6, n: 22 } });
      K.box(-33, -226, 18.8, 0.6, 56.8, PALE2, { y: 10 });
      K.box(13, -226, 18.8, 0.6, 56.8, PALE2, { y: 10 });
      for (const z of [-208, -222, -238]) K.box(-33, z, 18, 0.8, 0.8, C.metal, { y: 9.4, collide: false });
      K.box(-10, -226, 62, 0.45, 54, FLOOD, { collide: false, glow: 0.18 }); // knee-deep water over the floor
      // walkways: planked decks just above the water
      for (const [x, z, w, d] of [[-4, -214, 4, 32], [-4, -248, 4, 12], [-24, -222, 28, 3.2], [8, -232, 24, 3.2], [-24, -246, 20, 3.2]]) {
        K.box(x, z, w, 0.62, d, 0x59625e, { collide: false });
        K.box(x, z, w + 0.3, 0.12, d + 0.3, C.metal, { y: 0.6, collide: false });
      }
      for (const [x, z, rot] of [[-34, -208, 0], [-20, -211, 1], [-35, -232, 0], [4, -206, 0], [16, -212, 1], [15, -240, 0], [-30, -246, 0], [-14, -248, 1], [5, -246, 0]]) {
        K.box(x, z, rot ? 1.6 : 8, 1.1, rot ? 8 : 1.6, C.metal);
        K.box(x, z, rot ? 1.8 : 8.2, 0.12, rot ? 8.2 : 1.8, 0xe8ecea, { y: 1.1, collide: false });
      }
      glassBox(K, gm, -25, -233, 0.2, 2.6, 14); glassBox(K, gm, 5, -208, 14, 2.6, 0.2); glassBox(K, gm, 14, -226, 0.2, 2.6, 10);
      for (const [x, z, broken] of [[-38, -203, false], [-38, -214, true], [18, -251, false], [-38, -250, false], [19, -203, true]]) {
        K.cyl(x, z, 1.5, 0.6, C.metal, { sides: 10 });
        const g = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, broken ? 1.4 : 3.4, 10, 1, true), gm);
        g.position.set(x, K.ground(x, z) + 0.6 + (broken ? 0.7 : 1.7), z);
        K.scene.add(g);
        K.collider(x - 1.3, 0, z - 1.3, x + 1.3, 4.4, z + 1.3, null);
        if (broken) crystals(K, x, z, 0.8, false);
        else { K.cyl(x, z, 1.0, 3.2, GREEN, { y: 0.6, glow: 0.7, collide: false, sides: 10 }); K.cyl(x, z, 1.5, 0.4, C.metal, { y: 4, collide: false, sides: 10 }); }
      }
      // the landmark: a huge cracked specimen tank with the Hive growing out of it
      K.cyl(-18, -240, 6.4, 1.2, C.metal, { sides: 14 });
      {
        const g = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 11, 14, 1, true), gm);
        g.position.set(-18, K.ground(-18, -240) + 1.2 + 5.5, -240);
        K.scene.add(g);
      }
      K.cyl(-18, -240, 4.4, 8.5, GREEN, { y: 1.2, glow: 0.6, collide: false, sides: 12 });
      K.cyl(-18, -240, 6.4, 1.2, C.metal, { y: 12.2, collide: false, sides: 14 });
      for (let k = 0; k < 5; k++) { const a = k * 1.3 + 0.4; K.cone(-18 + Math.sin(a) * 3.6, -240 + Math.cos(a) * 3.6, 0.8, K.R(5, 9), CHITIN, { y: 12.4, sides: 5, collide: false, rx: Math.cos(a) * 0.5, rz: -Math.sin(a) * 0.5 }); }
      K.collider(-23, 0, -245, -13, 5, -235, null);
      K.mesh(new THREE.BoxGeometry(9, 0.6, 5), PALE2, 7, 1.4, -218, { rz: 0.28 }); // fallen ceiling panel
      K.collider(2.5, 0, -220.5, 11.5, 2.4, -215.5, null);
      K.platform(-10, -250, 14, 5, 2.4, { stairs: ['s'], stairW: 3, color: PALE2 }); // control deck over the tanks
      rail(K, -17, -247.5, -3, -247.5, 2.4);
      hive(K, -28, -222, 1.1); hive(K, 8, -224, 1.2); hive(K, -2, -238, 1);
      K.light(-10, 7, -226, 0x7fffd0, 9, 36); K.light(-10, 6, -204, 0xbfe8e0, 7, 24);

      // ---- corridor along the lab's north end, offset east to the Containment Lab ----
      K.wall(22, -254, 35, -254, 10); K.wall(35, -254, 35, -265, 10); K.wall(7, -254, 7, -265, 10);
      K.box(21, -259.5, 29, 0.6, 12, PALE2, { y: 10 });
      K.box(21, -259.5, 1, 0.15, 11, LAMP, { y: 9.8, collide: false, glow: 1.5 });
      K.box(14, -258, 1, 1.1, 5, C.metal);
      hive(K, 28, -257, 0.9);

      // ---- Containment Lab (boss): sealed chamber, Hive ribs and crystals everywhere ----
      K.room(30, -296, 58, 62, 13, { doors: { s: 10 }, roof: true, color: 0xb8bfba });
      K.door(30, -265, 10, 13, 'x', { zone: 2, color: PALE2, trim: GREEN });
      K.platform(7, -284, 6, 14, 3.2, { stairs: ['e'], stairW: 3, color: PALE2 }); // a single balcony, west wall
      rail(K, 10.2, -291, 10.2, -277, 3.2);
      roomStrips(K, 30, -296, 58, 62, 10, GREEN);
      for (const [z, R] of [[-276, 25], [-297, 24], [-317, 25]]) archRib(K, 30, z, R, 11.5, true, CHITIN, 0.9);
      for (const [x, z] of [[12, -272], [50, -275], [8, -318], [51, -314], [5, -299], [55, -302]]) crystals(K, x, z, 1.3);
      for (const [x, z] of [[19, -283], [43, -309], [17, -309], [44, -284]]) hive(K, x, z, 1.1);
      K.box(18, -297, 0.9, 1.3, 5, C.metal); K.box(43, -300, 0.9, 1.3, 5, C.metal);
      K.mesh(new THREE.BoxGeometry(5, 1.1, 1.6), C.metal, 30, 0.7, -283, { rz: 0.35 });
      K.collider(27.5, 0, -284, 32.5, 1.6, -282, null);
      // ruptured containment vessel at the back, Hive bursting out
      K.cyl(30, -320, 4.2, 1.2, C.metal, { sides: 12 });
      K.cyl(30, -320, 3, 6, GREEN, { y: 1.2, glow: 1.1, collide: false, sides: 12 });
      K.cyl(30, -320, 4.2, 1, C.metal, { y: 11, sides: 12, collide: false });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        K.cone(30 + Math.sin(a) * 3.6, -320 + Math.cos(a) * 3.6, 0.7, K.R(4, 8), CHITIN, { y: 1.2, sides: 5, collide: false, rx: Math.cos(a) * 0.4, rz: -Math.sin(a) * 0.4 });
      }
      creep(K, 30, -312, 16, 8); creep(K, 12, -290, 6, 10);
      for (const z of [-281, -314]) K.box(30, z, 8, 0.15, 1.2, LAMP, { y: 12.8, collide: false, glow: 1.2 });
      K.light(30, 10, -282, GREEN, 10, 35);
      K.light(30, 10, -312, 0x9a6dff, 10, 35);
      K.light(30, 5, -318, GREEN, 8, 22);
    },
  },
  // =========================================================================
  // SAVATHUN'S SONG (dusk). Rig platforms on the sea joined by bridges. Rhythm:
  //   the Methane Sea (a flat burner platform, flare stack, pontoon dock: area) -> the Spine of Keres climbs 4.8 m on a rib-arched bridge
  //   (the hub zone engages mid-climb) -> the hub (area) -> a descent under the hull -> the Underbelly (colossal columns, a raised catwalk)
  //   -> a ramp up onto the rim of the Hive nest and down into its pit -> the rim procession of ribs -> a ramp down to the throne hall.
  // Elevation 0 to 4.8 m.
  // =========================================================================
  t3: {
    spawn: [-45, 15],
    bounds: [-82, 52, -330, 34],
    zones: [
      { name: 'The Methane Sea', x: -40, z: -45 },
      { name: 'Spine of Keres', x: 20, z: -88 },
      { name: 'Arcology Underbelly', x: -10, z: -158 },
      { name: 'The Hive Nest', x: -35, z: -231 },
      { name: 'Choir of Savathûn', x: 8, z: -290, boss: true, room: { minX: -19, maxX: 35, minZ: -319, maxZ: -263 } },
    ],
    noEdge: true,
    terrain: [
      { type: 'plateau', x: 20, z: -95, w: 40, d: 40, h: 4.8, edge: 1.5 },        // the hub
      { type: 'plateau', x: -33, z: -230.5, w: 84, d: 49, h: 2.4, edge: 1.5 },    // the nest rim
      { type: 'basin', x: -35, z: -231, r: 21, flat: 0.5, depth: 2.4 },           // the pit inside it (floor back at 0)
      { type: 'ramp', x0: 20, z0: -46, x1: 20, z1: -76, width: 12, h0: 0, h1: 4.8, edge: 1.5 },     // the Spine climbs
      { type: 'ramp', x0: 20, z0: -114, x1: 20, z1: -136, width: 12, h0: 4.8, h1: 0, edge: 1.5 },   // and drops under the hull
      { type: 'ramp', x0: -35, z0: -190, x1: -35, z1: -206, width: 12, h0: 0, h1: 2.4, edge: 1.5 }, // up onto the nest rim
      { type: 'ramp', x0: 3, z0: -245, x1: 3, z1: -260, width: 12, h0: 2.4, h1: 0, edge: 1.5 },     // out of the nest to the throne door
    ],
    sky: {
      // dusk over the sea: Saturn huge and low in a copper haze, a teal vault above, rigs black on the horizon, a green glow where the choir sings
      zenith: 0x16202e, mid: 0x3f6068, horizon: 0xdc8a48, fog: 0x8c6a52,
      stars: { n: 100, color: 0xffeed8, size: 2, min: 0.4 },
      bodies: [{ color: 0xe6bb86, size: 150, pos: [-220, 70, -440], ring: true, bands: [0xe6bb86, 0xcfa070, 0xf0cf9c, 0xbf8a5a], glow: 0xff9a50 }],
      clouds: { n: 12, color: 0x74504a, opacity: 0.6, y: [60, 140], size: 26 },
      haze: [{ color: 0xe0883e, opacity: 0.55, r: 470, h: 140, y: -10 }],
      aurora: [{ color: 0x3cff8c, y: 70, r: 560, h: 80, arc: [2.4, 4.0], opacity: 0.2, waves: 4 }],
      skyline: [{ kind: 'rig', n: 10, r: [420, 600], h: [40, 100], w: [10, 22], color: 0x261c20, haze: 0.3 }, { kind: 'tower', n: 6, r: [440, 620], h: [60, 130], w: [10, 16], color: 0x2c2024, haze: 0.3 }],
    },
    build(K) {
      const C = K.C, gm = glassMat();
      // walkable decks [minX, maxX, minZ, maxZ, 'p' platform | 'b' bridge]
      seaPlatforms(K, [
        [-70, -20, 0, 30, 'p'],       // landing platform
        [-52, -38, -15, 0, 'b'],
        [-70, -10, -75, -15, 'p'],    // burner platform
        [-80, -70, -62, -36, 'p'],    // pontoon dock
        [-10, 14, -48, -36, 'b'],
        [14, 26, -75, -36, 'b'],      // Spine of Keres (climbs)
        [0, 40, -115, -75, 'p'],      // spine hub
        [14, 26, -136, -115, 'b'],    // down under the hull
        [-60, 30, -188, -135, 'p'],   // underbelly
        [-42, -28, -206, -188, 'b'],  // up onto the nest rim
        [-75, 9, -255, -206, 'p'],    // Hive nest (pit inside)
        [-3, 9, -262, -255, 'b'],     // out to the throne door
        [-20, 36, -320, -262, 'p'],   // throne hall
      ]);
      seaScenery(K, 12, 22, 90);

      // ---- landing platform ----
      arco(K, -62, 6, 10, 8, 5, { cap: false });
      container(K, -28, 24, true); container(K, -30, 6, false);
      lamp(K, -66, 26); lamp(K, -24, 15);

      // ---- The Methane Sea: a burner platform. Flare stack, methane spheres, a pontoon dock. Flat and open on purpose ----
      flare(K, -62, -68, 42);
      K.cyl(-62, -68, 7, 0.4, 0x3a2a22, { sides: 12, collide: false });
      K.cyl(-62, -68, 4.2, 0.45, 0xff8a2a, { y: 0.05, sides: 10, glow: 0.8, collide: false });
      pipeRun(K, -62, -60, -62, -46, 0.4, 0.8); pipeRun(K, -56, -46, -30, -46, 0.4, 0.8);
      for (const [x, z] of [[-20, -62], [-15, -50], [-24, -52]]) { // methane spheres on stilts
        K.mesh(new THREE.SphereGeometry(4, 10, 8), PALE, x, 5.6, z, { collide: 0.8 });
        K.cyl(x, z, 0.4, 1.8, K.C.metal, { y: 0.4, collide: false, sides: 6 });
        for (const [sx, sz] of CORNERS) K.box(x + sx * 2.6, z + sz * 2.6, 0.5, 2, 0.5, C.rock2);
      }
      crane(K, -64, -22, 16, 1, false);
      stack(K, -28, -26, true, 2); stack(K, -48, -64, false, 1); stack(K, -36, -34, false, 1);
      K.box(-42, -58, 6, 1.2, 0.8, PALE2); K.box(-28, -44, 0.8, 1.2, 5, PALE2);
      hive(K, -35, -56, 1.1); hive(K, -50, -28, 1);
      lamp(K, -16, -20); lamp(K, -66, -72);
      K.light(-62, 4, -68, 0xff8a3a, 10, 50);
      // pontoon dock on the west side: floats, bollards, a hoist
      for (const z of [-60, -52, -44, -38]) for (const x of [-79, -71]) K.cyl(x, z, 1.1, 2, 0x2f5a8a, { y: -1.3, collide: false, sides: 8 });
      for (const z of [-56, -40]) K.cyl(-79, z, 0.45, 0.9, K.C.metal, { sides: 6 });
      K.box(-76, -49, 2, 5, 2, YELLOW); K.box(-76, -49, 7, 0.8, 0.8, YELLOW, { y: 5, collide: false });
      K.box(-75, -41, 5, 1.6, 2.4, K.RP(CONT)); K.box(-75, -57, 4, 1.4, 2, K.RP(CONT));

      // ---- Spine of Keres: rib arches along the climbing bridge (no two alike, one down), pipelines alongside ----
      const spineArch = (z, h, lean = 0, broken = false) => {
        K.box(14.5, z, 0.9, h, 0.9, PALE2);
        if (!broken) {
          K.box(25.5, z, 0.9, h, 0.9, PALE2);
          K.mesh(new THREE.BoxGeometry(12, 1, 1.2), PALE2, 20, h, z, { rz: lean });
          K.cone(20, z, 0.8, 2.6, PALE2, { y: h + 0.5, collide: false, sides: 4 });
        } else { // the far leg and half the beam are on the deck
          K.box(25.5, z, 0.9, h * 0.35, 0.9, PALE2);
          K.mesh(new THREE.BoxGeometry(8, 0.9, 1.2), PALE2, 21.5, 0.5, z + 1.2, { ry: 0.4, rz: 0.1 });
          K.mesh(new THREE.BoxGeometry(5, 1, 1.2), PALE2, 16.5, h * 0.8, z, { rz: -0.45 });
        }
      };
      spineArch(-50, 7.5); spineArch(-58, 8.6, 0.06); spineArch(-66, 7.5, 0, true); spineArch(-73, 9.4, -0.05);
      spineArch(-120, 7.8, 0.05); spineArch(-128, 6.8);
      pipeRun(K, 28.5, -40, 28.5, -76, 0.4, 0.8);
      pipeRun(K, 11.5, -52, 11.5, -76, 0.4, 0.8);
      pipeRun(K, 28.5, -115, 28.5, -135, 0.4, 0.8);
      pipeRun(K, 11.5, -115, 11.5, -135, 0.4, 0.8);
      hive(K, 16, -62, 0.9); hive(K, 24, -44, 0.8);
      // hub (4.8 m up): a vertebra of the Spine at its heart, a stilted arcology bay, tanks, an overlook
      {
        const sx = 25, sz = -106;
        for (let i = 0; i < 5; i++) K.cyl(sx + i * 0.15, sz, 3.4 - i * 0.45, 3.2, i % 2 ? CHITIN2 : CHITIN, { y: i * 3.1, sides: 6, collide: i < 2 });
        for (let k = 0; k < 6; k++) { const a = k * 1.05; K.cone(sx + Math.sin(a) * 3.8, sz + Math.cos(a) * 3.8, 0.6, K.R(7, 12), CHITIN, { y: 0.5, sides: 5, collide: false, rx: Math.cos(a) * 0.5, rz: -Math.sin(a) * 0.5 }); }
        K.mesh(new THREE.OctahedronGeometry(1.8, 0), GREEN, sx, 17, sz, { glow: 1.8, scale: [1, 1.8, 1] });
        K.light(sx, 12, sz, GREEN, 9, 34);
      }
      arco(K, 35, -82, 8, 8, 5, { cap: false });
      tank(K, 4, -98, 3, 5);
      stack(K, 34, -98, true, 1); stack(K, 6, -110, false, 1);
      K.platform(35.5, -91, 7, 8, 2.4, { stairs: ['w'], stairW: 3, color: PALE2 }); // hub overlook
      rail(K, 32, -95, 32, -87, 2.4);
      K.box(10, -84, 5, 1.2, 0.8, PALE2); K.box(30, -112, 0.8, 1.2, 6, PALE2); K.box(14, -104, 4, 1.2, 0.8, PALE2);
      hive(K, 12, -112, 1.1); hive(K, 36, -108, 0.9); creep(K, 22, -112, 8, 4);
      K.light(20, 8, -92, AMBER, 8, 30);

      // ---- Arcology Underbelly: colossal columns in a cluster, a lift shaft, a raised catwalk, a collapsed walkway ----
      K.box(-15, -161.5, 96, 3, 58, 0x9aa19c, { y: 14, collide: false });
      arco(K, -15, -161.5, 80, 44, 18, { y: 17, collide: false, every: 5 });
      for (const [x, z, r] of [[-40, -150, 4.5], [-6, -148, 4.2], [-34, -178, 5], [7, -172, 4.4], [-54, -170, 4]]) {
        K.cyl(x, z, r, 14, PALE2, { sides: 10 });
        K.cyl(x, z, r + 1.1, 1.1, C.rock2, { sides: 10 });                                       // base ledge ring (cover)
        K.cyl(x, z, r + 0.2, 0.5, AMBER, { y: 7, sides: 10, glow: 1.2, collide: false });
        K.cyl(x, z, r + 0.5, 0.8, C.metal, { y: 12.8, sides: 10, collide: false });
        for (let k = 0; k < 3; k++) { const a = K.R(0, 6.28); K.box(x + Math.sin(a) * (r + 2.2), z + Math.cos(a) * (r + 2.2), 1.1, 14, 1.1, PALE2); }
      }
      // lift shaft with a lit cage
      K.box(-14, -183, 6, 14, 6, C.metal);
      glassBox(K, gm, -14, -179.6, 4, 3.4, 0.4, 0.8, false);
      K.box(-14, -179.4, 3.6, 0.3, 0.3, GREEN, { y: 4.4, collide: false, glow: 1.6 });
      for (const [x, z] of [[-26, -156], [-22, -154], [-24, -158]]) K.cyl(x, z, 0.9, 10, C.rock2, { y: 4, sides: 6, collide: false }); // a hanging pipe bundle
      // the central maintenance catwalk, 3.6 m up (a perch; the lanes below are the route)
      K.platform(-27, -168, 32, 4.5, 3.6, { stairs: ['e', 'w'], stairW: 3.5, color: PALE2 });
      rail(K, -43, -170.25, -11, -170.25, 3.6); rail(K, -43, -165.75, -11, -165.75, 3.6);
      // a walkway that came down across the east side
      K.mesh(new THREE.BoxGeometry(15, 0.6, 3.6), PALE2, 8, 2.2, -154, { rz: 0.3, ry: 0.15 });
      K.collider(3.5, 0, -156, 12.5, 3.4, -152, null);
      stack(K, -24, -139, false, 1); stack(K, -48, -184, false, 1); stack(K, 22, -150, true, 1);
      K.box(-32, -156, 0.8, 1.2, 5, PALE2); K.box(0, -184, 5, 1.2, 0.8, PALE2); K.box(-12, -150, 4, 1.2, 0.8, PALE2);
      for (const [x, z] of [[-45, -150], [-12, -172], [-2, -176], [-28, -150]]) hive(K, x, z, 1.1);
      creep(K, -36, -150, 8, 6); creep(K, 0, -165, 8, 6);
      K.light(-20, 10, -160, AMBER, 10, 40); K.light(-14, 6, -178, GREEN, 8, 26);
      K.door(-35, -194, 14, 8, 'x', { zone: 2, color: CHITIN2, trim: GREEN }); // sealed Hive door on the nest bridge

      // ---- The Hive Nest: a pit inside a rim, ribs in procession along the rim toward the throne, a tomb ----
      for (let z = -252; z <= -208; z += 4) K.cone(-72, z, K.R(1.6, 2.2), K.R(5, 9), K.RP([CHITIN, CHITIN2]), { sides: 5, collide: false, rz: K.R(-0.2, 0.2) });
      for (let x = -66; x <= -22; x += 5) K.cone(x, -252.5, K.R(1.4, 2), K.R(4, 7), CHITIN, { sides: 5, collide: false, rx: K.R(-0.2, 0.2) });
      for (const z of [-213, -221, -229, -237, -245]) archRib(K, -5, z, 7, 9 + (z % 3), true, CHITIN, 0.8, 2.4); // the procession (along the rim)
      for (const [x, z] of [[-39, -237], [-44, -224], [-27, -239], [-46, -235], [-25, -222]]) { // egg sacs in the pit
        for (let i = 0; i < 3; i++) K.mesh(new THREE.SphereGeometry(K.R(0.7, 1.1), 6, 5), 0x8a9a5a, x + K.R(-1, 1), K.R(0.5, 0.9), z + K.R(-1, 1), { glow: 0.5, scale: [1, 1.3, 1] });
        K.collider(x - 1.6, 0, z - 1.6, x + 1.6, 2, z + 1.6, null);
      }
      K.cyl(-35, -231, 8, 0.12, GREEN, { sides: 12, glow: 0.8, collide: false }); // the glowing floor of the pit
      K.cone(-64, -243, 6, 28, CHITIN, { sides: 5, collide: false, y: 2.4 });                // a tall tomb on the west rim
      K.collider(-67, 2.4, -246, -61, 14, -240, null);
      K.box(-64, -243, 0.4, 14, 3, GREEN, { y: 3, collide: false, glow: 1.4 });
      K.cyl(-58, -214, 2.2, 16, CHITIN, { y: 2.4, r2: 0.4, sides: 4 });                      // Hive obelisk
      K.box(-58, -214, 0.3, 10, 4.4, GREEN, { y: 3.6, collide: false, glow: 1.4 });
      for (const [x, z] of [[-24, -214], [-48, -246], [-12, -240], [-60, -230]]) hive(K, x, z, 1.2);
      for (const [x, z] of [[-18, -222], [-52, -224], [-30, -246]]) crystals(K, x, z, 1.2, true);
      creep(K, -35, -216, 14, 4); creep(K, -22, -244, 8, 6);
      K.light(-35, 5, -231, GREEN, 12, 40); K.light(-4, 6, -230, GREEN, 8, 30);

      // ---- Choir of Savathun (boss): roofed Hive throne hall, a stepped choir loft, green fire, altar ----
      const hx = 8, hz = -291;
      K.room(hx, hz, 56, 58, 13, { doors: { s: 12 }, doorOffset: { s: -5 }, roof: true, color: 0x3a3c36, roofColor: CHITIN });
      K.box(hx, hz, 54, 0.26, 56, 0x2c2e2a, { collide: false });
      K.door(3, -262, 12, 13, 'x', { zone: 3, color: CHITIN2, trim: GREEN });
      // the choir loft: two tiers climbing the east wall, with the choir standing on them
      K.platform(hx + 24, hz + 4, 8, 28, 1.8, { stairs: ['w'], stairW: 5, color: CHITIN2, stairColor: CHITIN });
      K.platform(hx + 26, hz + 4, 4, 24, 1.8, { y: 1.8, stairs: ['w'], stairW: 4, color: CHITIN2, stairColor: CHITIN });
      K.box(hx + 21.6, hz + 4, 0.2, 0.3, 28, GREEN, { y: 1.8, collide: false, glow: 1.2 });
      for (const [x, z, t] of [[hx + 23, hz - 6, 1.8], [hx + 23, hz + 3, 1.8], [hx + 23, hz + 12, 1.8], [hx + 26.5, hz - 4, 3.6], [hx + 26.5, hz + 5, 3.6], [hx + 26.5, hz + 14, 3.6]]) K.cone(x, z, 0.7, 3.2, CHITIN, { y: t, sides: 5, collide: false });
      roomStrips(K, hx, hz, 56, 58, 9, GREEN);
      for (const [x, z] of [[hx - 19, -274], [hx + 15, -281], [hx - 16, -291], [hx + 13, -300], [hx - 20, -307], [hx + 17, -312]]) { // pillars in no particular order
        K.box(x, z, 2.4, 13, 2.4, CHITIN2);
        K.box(x, z, 2.5, 3, 0.3, GREEN, { y: 3, collide: false, glow: 1.2 });
        K.cone(x, z, 1.6, 3, CHITIN, { y: 7, collide: false, sides: 4 });
      }
      for (let i = 0; i < 6; i++) {
        const sx = hx + K.R(-24, 20), sz = K.R(-316, -266), h = K.R(2.5, 5);
        K.cone(sx, sz, K.R(0.6, 1.1), h, CHITIN, { y: 13 - h, rx: Math.PI, collide: false, sides: 5 });
      }
      K.platform(hx - 2, -313, 18, 8, 1.2, { stairs: ['s'], stairW: 6, color: CHITIN2, stairColor: CHITIN });
      K.box(hx - 2, -314, 5, 1.2, 2.4, CHITIN, { y: 1.2 }); // altar
      K.box(hx - 2, -314, 5.2, 0.25, 2.6, GREEN, { y: 2.4, collide: false, glow: 1.8 });
      K.box(hx - 2, -317, 3.6, 7, 1.2, CHITIN, { y: 1.2 }); // throne back
      for (const s of [-1, 1]) K.cone(hx - 2 + s * 2.2, -317, 0.6, 4, CHITIN2, { y: 8.2, collide: false, sides: 4, rz: -s * 0.3 });
      for (const [x, z] of [[hx - 11, -303], [hx + 8, -306], [hx - 13, -280], [hx + 10, -276], [hx - 14, -268], [hx + 3, -269], [hx - 12, -316]]) brazier(K, x, z);
      for (const [x, z] of [[hx - 8, -292], [hx + 7, -286], [hx - 2, -279]]) hive(K, x, z, 1.1);
      crystals(K, hx - 22, -316, 1.2); crystals(K, hx + 16, -317, 1.2);
      creep(K, hx, -300, 12, 5, 0.02);
      K.light(hx, 9, -276, GREEN, 10, 35);
      K.light(hx, 9, -304, GREEN, 10, 35);
      K.light(hx, 4, -312, 0xffa040, 8, 22);
    },
  },
};
