// Hand-built Titan mission maps (see makeKit in world.js).
// New Pacific Arcology: a Golden Age city on stilts over the methane sea, with the Hive creeping through it.
// t1 Hope: one huge open rig deck (containers, cranes, Siren's Watch, arcology plaza, helipad).
// t2 The Sunken Labs: a chain of roofed arcology interiors (halls, the glass-domed Solarium, flooded labs).
// t3 Savathun's Song: separate rig platforms over the sea joined by bridges, down into a Hive nest and throne hall.
import * as THREE from 'three';

const PALE = 0xdde1dc, PALE2 = 0xb9c0bb, AMBER = 0xffc56a, GREEN = 0x6dff8e, CHITIN = 0x26282a, CHITIN2 = 0x3b3c32;
const YELLOW = 0xd2a032, TRUNK = 0x5a5048, SOIL = 0x3a3128, LAMP = 0xfff1d0, FLOOD = 0x1f4d4a;
const CONT = [0xa8562a, 0x3f7a78, 0x8a8f8c, 0xb08a38, 0x56688a];
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

// ---------------------------------------------------------------------------
// shared pieces
// ---------------------------------------------------------------------------
// deck railing: pale lip, posts and a top rail (visual only; edges are walled by bounds or sea colliders)
function rail(K, ax, az, bx, bz, y = 0) {
  const horiz = Math.abs(bz - az) < Math.abs(bx - ax);
  const L = horiz ? Math.abs(bx - ax) : Math.abs(bz - az);
  if (L < 0.5) return;
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;
  K.box(cx, cz, horiz ? L : 0.5, 0.3, horiz ? 0.5 : L, PALE2, { y, collide: false });
  K.box(cx, cz, horiz ? L : 0.1, 0.1, horiz ? 0.1 : L, K.C.metal, { y: y + 1.05, collide: false });
  const n = Math.max(1, Math.round(L / 10));
  for (let k = 0; k <= n; k++) K.box(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, 0.16, 1.05, 0.16, K.C.metal, { y, collide: false });
}

// rig leg standing in the sea
function pylon(K, x, z) {
  K.cyl(x, z, 1.1, 2.4, K.C.rock2, { y: -1.4, collide: false, sides: 8 });
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
function crystals(K, x, z, s = 1, collide = true) {
  for (let i = 0; i < 4; i++) K.mesh(new THREE.OctahedronGeometry(K.R(0.4, 0.8) * s, 0), GREEN, x + K.R(-0.9, 0.9) * s, K.R(0.6, 1.4) * s, z + K.R(-0.9, 0.9) * s, { glow: 1.5, scale: [1, K.R(1.8, 2.8), 1], rx: K.R(-0.3, 0.3), rz: K.R(-0.3, 0.3) });
  if (collide) K.collider(x - s, 0, z - s, x + s, 2.6 * s, z + s, null);
}

// dark Hive stain on the floor with glowing veins
function creep(K, x, z, w, d) {
  K.box(x, z, w, 0.26, d, CHITIN, { collide: false });
  K.box(x, z, w * 0.8, 0.28, 0.2, GREEN, { collide: false, glow: 1.2 });
  K.box(x + w * 0.15, z, 0.2, 0.28, d * 0.7, GREEN, { collide: false, glow: 1.2 });
}

// shipping container (rot = long side along z)
function container(K, x, z, rot, y = 0, color) {
  K.box(x, z, rot ? 2.5 : 6.1, 2.6, rot ? 6.1 : 2.5, color ?? K.RP(CONT), { y });
}
function stack(K, x, z, rot, n) {
  for (let i = 0; i < n; i++) container(K, x + (i ? K.R(-0.25, 0.25) : 0), z + (i ? K.R(-0.25, 0.25) : 0), rot, i * 2.6);
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
    if (y > 0.3) K.box(px, pz, 0.7, y, 0.7, K.C.rock2);
    K.box(px, pz, alongX ? 0.9 : 2 * r + 0.6, 0.3, alongX ? 2 * r + 0.6 : 0.9, K.C.metal, { y: Math.max(0, y - 0.3), collide: false });
  }
}

function lamp(K, x, z, h = 6, color = AMBER) {
  K.box(x, z, 0.3, h, 0.3, K.C.metal);
  K.box(x, z, 0.9, 0.4, 0.9, color, { y: h, collide: false, glow: 1.8 });
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
function archRib(K, x, z, R, h, alongX, color = CHITIN, tube = 0.7) {
  K.mesh(new THREE.TorusGeometry(R, tube, 5, 14, Math.PI), color, x, 0, z, { ry: alongX ? 0 : Math.PI / 2, scale: [1, h / R, 1] });
  for (const s of [-1, 1]) {
    const fx = alongX ? x + s * R : x, fz = alongX ? z : z + s * R;
    K.collider(fx - 1, 0, fz - 1, fx + 1, 3, fz + 1, null);
  }
}

function brazier(K, x, z) {
  K.cyl(x, z, 0.8, 1.3, CHITIN2, { r2: 1.1, sides: 6 });
  K.cone(x, z, 0.8, 2.2, GREEN, { y: 1.3, glow: 2, collide: false, sides: 5 });
  K.cone(x, z, 0.4, 3, 0xd8ffe0, { y: 1.3, glow: 2.2, collide: false, sides: 5 });
}

function glassMat() {
  return new THREE.MeshStandardMaterial({ color: 0xbfe8e0, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.5, side: THREE.DoubleSide, depthWrite: false });
}
function glassBox(K, gm, x, z, w, h, d, y = 0, collide = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), gm);
  m.position.set(x, y + h / 2, z);
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

// short roofed corridor along z between two rooms (10 m clear)
function corridor(K, z1, z2, h = 10) {
  K.wall(-5.4, z1, -5.4, z2, h);
  K.wall(5.4, z1, 5.4, z2, h);
  const mid = (z1 + z2) / 2, L = Math.abs(z1 - z2);
  K.box(0, mid, 11.6, 0.6, L, PALE2, { y: h });
  K.box(0, mid, 1, 0.15, L, LAMP, { y: h - 0.2, collide: false, glow: 1.5 });
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
    K.box((x1 + x2) / 2, (z1 + z2) / 2, x2 - x1, 0.22, z2 - z1, C.sea, { collide: false });
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
    if (r[4] === 'b') { // bridge deck plating
      K.box((r[0] + r[1]) / 2, (r[2] + r[3]) / 2, r[1] - r[0] - 1.4, 0.24, r[3] - r[2] - 0.2, 0x59625e, { collide: false });
    }
  }
}

// ---------------------------------------------------------------------------
export default {
  // =========================================================================
  // HOPE: one big open rig deck in a storm. Containers and cranes, the Siren's Watch tower,
  // the arcology plaza, and a helipad where Kathok waits under a Hive tomb ship.
  // =========================================================================
  t1: {
    spawn: [40, 18],
    bounds: [-80, 80, -250, 30],
    zones: [
      { name: 'The Rig', x: 30, z: -35 },
      { name: "Siren's Watch", x: -25, z: -90 },
      { name: 'Arcology Plaza', x: 20, z: -150 },
      { name: 'Rig Helipad', x: 0, z: -212, boss: true },
    ],
    noEdge: true,
    build(K) {
      const C = K.C;
      deckEdge(K, 30);
      seaScenery(K, 22);

      // ---- landing deck (spawn) ----
      container(K, 62, 22, true);
      stack(K, 18, 24, false, 2);
      arco(K, 70, 2, 10, 12, 7, { cap: false });
      lamp(K, 30, 26); lamp(K, 52, 26);

      // ---- The Rig: container rows, cranes, pipe racks ----
      stack(K, 10, -24, false, 2); stack(K, 10, -27, false, 1);
      stack(K, 46, -20, true, 3); stack(K, 49, -20, true, 1);
      stack(K, 24, -52, false, 2); stack(K, 38, -54, false, 1);
      stack(K, 52, -44, true, 2); stack(K, 16, -40, true, 1);
      stack(K, 40, -33, true, 1); stack(K, 28, -17, false, 1);
      crane(K, 64, -12, 20, -1, true);
      crane(K, -4, -50, 18, 1, false);
      pipeRun(K, 72, -2, 72, -80, 2.6, 0.7);
      pipeRun(K, 75.5, -2, 75.5, -80, 1.2, 0.5, YELLOW);
      pipeRun(K, -78, -64, -14, -64, 3.2, 0.7);
      tank(K, -50, -20, 4.5, 7); tank(K, -62, -34, 4, 6); tank(K, -46, -38, 3.5, 5);
      arco(K, -32, 4, 14, 10, 8);
      arco(K, 66, -46, 10, 10, 9);
      hive(K, 20, -28, 1.2); hive(K, 44, -46, 1); hive(K, 5, -38, 1.4);
      creep(K, 30, -44, 8, 5);
      K.light(64, 23, -12, AMBER, 10, 40);

      // ---- Siren's Watch: tall comms tower with a walkway deck around its base ----
      K.platform(-55, -100, 22, 22, 1.6, { stairs: ['e', 's'], stairW: 4, color: C.metal });
      rail(K, -66, -110.7, -44, -110.7, 1.6);
      rail(K, -65.7, -111, -65.7, -89, 1.6);
      K.cyl(-55, -100, 4.5, 46, PALE, { y: 1.6, sides: 10 });
      for (let y = 9; y < 46; y += 8) K.cyl(-55, -100, 4.6, 0.5, AMBER, { y, sides: 10, glow: 1.2, collide: false });
      K.cyl(-55, -100, 8, 0.6, C.metal, { y: 21, sides: 10, collide: false });
      K.cyl(-55, -100, 7.5, 1.2, C.metal, { y: 47.6, sides: 10, collide: false });
      K.cyl(-55, -100, 5, 3, PALE, { y: 48.8, r2: 3, sides: 10, collide: false });
      K.cyl(-55, -100, 0.3, 12, C.metal, { y: 51.8, collide: false });
      K.mesh(new THREE.OctahedronGeometry(1, 0), AMBER, -55, 64.5, -100, { glow: 2 });
      K.light(-55, 30, -100, AMBER, 8, 40);
      stack(K, -10, -76, true, 1); stack(K, -38, -72, false, 2); stack(K, -6, -104, false, 1);
      K.box(-22, -104, 6, 1.2, 0.8, PALE2); K.box(-36, -92, 0.8, 1.2, 6, PALE2); K.box(-14, -96, 0.8, 1.2, 5, PALE2);
      K.prop(-4, -88);
      hive(K, -28, -103, 1.3); hive(K, -12, -82, 1);
      creep(K, -40, -100, 6, 8);

      // ---- Arcology Plaza: white blocks with amber windows around a planted square ----
      arco(K, -45, -150, 26, 46, 24);
      arco(K, -12, -140, 14, 20, 14);
      arco(K, 62, -150, 22, 48, 20);
      arco(K, 46, -128, 10, 12, 10, { cap: false });
      arco(K, 55, -185, 46, 12, 16);
      K.box(18, -140, 46, 1.6, 5, PALE, { y: 10, collide: false }); // skybridge
      K.box(18, -140, 46, 0.3, 5.2, AMBER, { y: 9.8, collide: false, glow: 1.2 });
      for (const [px, pz] of [[8, -138], [32, -138], [8, -162], [32, -162]]) {
        K.box(px, pz, 6, 0.9, 6, PALE);
        K.box(px, pz, 5.4, 0.2, 5.4, SOIL, { y: 0.9, collide: false });
        K.cone(px, pz, 1.6, 3.4, C.foliage, { y: 1.1, collide: false });
      }
      lamp(K, 0, -150, 7); lamp(K, 40, -150, 7); lamp(K, 20, -128, 7); lamp(K, 20, -172, 7);
      K.box(20, -132, 4, 0.5, 1, C.metal); K.box(20, -168, 4, 0.5, 1, C.metal);
      // Hive creep climbing the west block
      K.box(-4.8, -140, 0.3, 9, 10, CHITIN, { collide: false });
      K.box(-4.6, -140, 0.2, 7, 0.3, GREEN, { y: 1, collide: false, glow: 1.3 });
      K.box(-4.6, -137, 0.2, 5, 0.3, GREEN, { y: 2, collide: false, glow: 1.3 });
      hive(K, -2, -160, 1.5); hive(K, 36, -170, 1.2); hive(K, 12, -130, 1);
      container(K, 30, -150, true);
      K.light(20, 8, -150, AMBER, 8, 30);

      // ---- Rig Helipad (boss): painted pad ringed by Hive spires, tomb ship overhead ----
      const bz = -212;
      K.mesh(new THREE.CylinderGeometry(25, 25, 0.3, 16), 0x4c5652, 0, 0.15, bz);
      K.mesh(new THREE.TorusGeometry(19, 0.35, 4, 32), YELLOW, 0, 0.32, bz, { rx: Math.PI / 2, glow: 0.4 });
      K.box(-3, bz, 1.2, 0.08, 8, PALE, { y: 0.3, collide: false });
      K.box(3, bz, 1.2, 0.08, 8, PALE, { y: 0.3, collide: false });
      K.box(0, bz, 6, 0.08, 1.2, PALE, { y: 0.3, collide: false });
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * 0.32 + (k * Math.PI * 1.36) / 8, r = 26;
        const x = Math.sin(a) * r, z = bz + Math.cos(a) * r, h = K.R(9, 15);
        K.cone(x, z, K.R(1.6, 2.4), h, CHITIN, { sides: 5, collide: false, rx: Math.cos(a) * 0.25, rz: -Math.sin(a) * 0.25 });
        K.collider(x - 1.3, 0, z - 1.3, x + 1.3, h * 0.6, z + 1.3, null);
        if (k % 2 === 0) crystals(K, x - Math.sin(a) * 3, z - Math.cos(a) * 3, 0.9);
      }
      for (const [x, z] of [[-12, -205], [11, -219], [-6, -226], [14, -200], [-15, -218]]) hive(K, x, z, 1.1);
      stack(K, -20, -196, false, 2); stack(K, 21, -228, true, 1);
      creep(K, 6, bz - 6, 10, 6);
      for (const [x, z] of [[-22, -190], [22, -190]]) lamp(K, x, z, 9, AMBER);
      // Hive tomb ship hanging over the pad
      K.mesh(new THREE.ConeGeometry(5, 46, 5), CHITIN, 26, 34, -232, { rz: Math.PI / 2, rx: 0.15 });
      K.mesh(new THREE.ConeGeometry(3, 18, 4), CHITIN2, 34, 40, -232, { rz: -0.4 });
      K.mesh(new THREE.ConeGeometry(3, 18, 4), CHITIN2, 34, 28, -232, { rz: Math.PI + 0.4 });
      K.box(26, -232, 30, 0.4, 1.2, GREEN, { y: 30.6, collide: false, glow: 1.6 });
      K.light(0, 10, bz, GREEN, 10, 40);
      K.light(22, 26, -232, GREEN, 8, 30);
    },
  },

  // =========================================================================
  // THE SUNKEN LABS: indoors almost all the way. A roofed arcology hall, the glass-domed Solarium,
  // half-roofed flooded labs, then Ir Halak's sealed lab chamber overrun by the Hive.
  // =========================================================================
  t2: {
    spawn: [0, 20],
    bounds: [-38, 38, -264, 32],
    zones: [
      { name: 'Arcology Interior', x: 0, z: -30 },
      { name: 'The Solarium', x: 0, z: -96 },
      { name: 'Flooded Labs', x: 0, z: -163 },
      { name: 'Containment Lab', x: 0, z: -229, boss: true },
    ],
    noEdge: true,
    build(K) {
      const C = K.C, gm = glassMat();
      deckEdge(K, 26);
      seaScenery(K, 24);

      // ---- entry deck and arcology facade ----
      K.room(0, -31, 74, 54, 10, { doors: { s: 12, n: 10 }, roof: true });
      arco(K, 0, -31, 40, 30, 14, { y: 10.6, collide: false });
      for (const y of [3, 6.2]) {
        K.box(-22, -3.5, 28, 0.4, 0.2, AMBER, { y, collide: false, glow: 1.3 });
        K.box(22, -3.5, 28, 0.4, 0.2, AMBER, { y, collide: false, glow: 1.3 });
      }
      K.box(0, -1, 16, 0.5, 6, C.metal, { y: 7, collide: false }); // entrance canopy
      lamp(K, -9, 4, 5); lamp(K, 9, 4, 5);
      for (const x of [-26, 26]) { K.box(x, 18, 6, 0.9, 6, PALE); K.cone(x, 18, 1.6, 3, C.foliage, { y: 0.9, collide: false }); }
      container(K, -30, 26, true); container(K, 30, 8, true);

      // ---- Arcology Interior: columned hall ----
      roomStrips(K, 0, -31, 74, 54, 7.5);
      for (const x of [-14, 14]) for (const z of [-12, -24, -38, -50]) {
        K.box(x, z, 1.6, 10, 1.6, PALE2);
        K.box(x, z, 1.7, 0.3, 1.7, AMBER, { y: 6.5, collide: false, glow: 1.3 });
      }
      for (const x of [-20, 0, 20]) for (const z of [-14, -31, -48]) K.box(x, z, 6, 0.15, 1.2, LAMP, { y: 9.6, collide: false, glow: 1.5 });
      K.box(0, -15, 10, 1.2, 1.6, C.metal); // reception counter
      K.box(0, -15, 10.2, 0.12, 1.8, PALE, { y: 1.2, collide: false });
      for (const x of [-7, 7]) { K.box(x, -43, 4, 0.8, 4, PALE); K.cone(x, -43, 1.2, 2.4, C.foliage, { y: 0.8, collide: false }); }
      K.box(-22, -30, 0.8, 1.4, 6, PALE2); K.box(22, -32, 0.8, 1.4, 6, PALE2);
      K.box(-26, -46, 3, 1.1, 1.2, C.metal); K.box(26, -18, 3, 1.1, 1.2, C.metal);
      K.crate(-30, -14); K.crate(30, -50); K.crate(-8, -26); K.crate(9, -34);
      hive(K, -31, -52, 1.2); hive(K, 30, -9, 1); hive(K, -28, -9, 0.9);
      creep(K, -24, -50, 8, 6);
      K.light(0, 8, -18, AMBER, 9, 30);
      K.light(0, 8, -44, AMBER, 9, 30);

      corridor(K, -58, -64);

      // ---- The Solarium: huge atrium under a glass dome, dead trees in planters ----
      K.room(0, -96, 70, 64, 10, { doors: { s: 10, n: 10 } });
      roomStrips(K, 0, -96, 70, 64, 8.6);
      {
        const dome = new THREE.Group();
        dome.position.set(0, 10, -96);
        dome.scale.set(1, 0.5, 32 / 35);
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
      for (const [px, pz] of [[-16, -82], [16, -82], [-16, -110], [16, -110], [0, -71]]) {
        K.box(px, pz, 8, 1, 8, PALE);
        K.box(px, pz, 7.4, 0.15, 7.4, SOIL, { y: 1, collide: false });
        tree(K, px + K.R(-1, 1), pz + K.R(-1, 1), 1.15, K.R(6, 8.5));
      }
      K.platform(-29, -96, 10, 30, 3, { stairs: ['n'], stairW: 3, color: PALE2 });
      K.platform(29, -96, 10, 30, 3, { stairs: ['s'], stairW: 3, color: PALE2 });
      rail(K, -23.7, -111, -23.7, -81, 3); rail(K, 23.7, -111, 23.7, -81, 3);
      K.box(-8, -125, 16, 0.24, 4, FLOOD, { collide: false, glow: 0.15 }); // dry reflecting pool
      K.box(-8, -125, 16.6, 0.5, 0.3, PALE2, { collide: false });
      for (const [x, z] of [[-6, -88], [7, -104], [-24, -122], [24, -70]]) K.box(x, z, 3, 0.5, 0.9, C.metal);
      for (let i = 0; i < 5; i++) K.mesh(new THREE.BoxGeometry(K.R(1, 2.5), 0.08, K.R(1, 2)), 0xa8d8d0, K.R(-26, 26), 0.2, K.R(-122, -70), { ry: K.R(0, 3), rz: K.R(-0.2, 0.2) });
      hive(K, -10, -118, 1.1); hive(K, 14, -74, 1); hive(K, 26, -122, 1.3);
      creep(K, 22, -118, 7, 5);

      corridor(K, -128, -136);

      // ---- Flooded Labs: half-roofed, ankle-deep water, benches, specimen tanks ----
      K.room(0, -163, 64, 54, 10, { doors: { s: 10, n: 10 } });
      K.box(-23, -163, 18.8, 0.6, 54.8, PALE2, { y: 10 });
      K.box(23, -163, 18.8, 0.6, 54.8, PALE2, { y: 10 });
      for (const z of [-146, -156, -170, -180]) K.box(0, z, 28, 0.8, 0.8, C.metal, { y: 9.4, collide: false });
      K.box(0, -163, 62, 0.22, 52, FLOOD, { collide: false, glow: 0.12 });
      for (const z of [-145, -155, -171, -181]) for (const x of [-24, 24]) {
        K.box(x, z, 8, 1.1, 1.6, C.metal);
        K.box(x, z, 8.2, 0.12, 1.8, 0xe8ecea, { y: 1.1, collide: false });
      }
      for (const x of [-13, 13]) {
        glassBox(K, gm, x, -147.5, 0.2, 2.6, 15);
        glassBox(K, gm, x, -178.5, 0.2, 2.6, 15);
        K.box(x, -147.5, 0.3, 0.2, 15, C.metal, { y: 2.6, collide: false });
        K.box(x, -178.5, 0.3, 0.2, 15, C.metal, { y: 2.6, collide: false });
      }
      for (const [x, z, broken] of [[-20, -187, false], [-14, -187, true], [14, -187, false], [20, -187, false], [-28, -139.5, false], [28, -139.5, true]]) {
        K.cyl(x, z, 1.5, 0.6, C.metal, { sides: 10 });
        const g = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, broken ? 1.4 : 3.4, 10, 1, true), gm);
        g.position.set(x, 0.6 + (broken ? 0.7 : 1.7), z);
        K.scene.add(g);
        K.collider(x - 1.3, 0, z - 1.3, x + 1.3, 4.4, z + 1.3, null);
        if (broken) crystals(K, x, z, 0.8, false);
        else {
          K.cyl(x, z, 1.0, 3.2, GREEN, { y: 0.6, glow: 0.7, collide: false, sides: 10 });
          K.cyl(x, z, 1.5, 0.4, C.metal, { y: 4, collide: false, sides: 10 });
        }
      }
      K.mesh(new THREE.BoxGeometry(9, 0.6, 5), PALE2, 7, 1.4, -170, { rz: 0.28 }); // fallen ceiling panel
      K.collider(2.5, 0, -172.5, 11.5, 2.4, -167.5, null);
      K.box(-8, -150, 4, 1.2, 4, C.metal);
      hive(K, -6, -178, 1.2); hive(K, 10, -152, 1);
      K.light(0, 7, -163, 0x7fffd0, 8, 30);

      corridor(K, -190, -198);

      // ---- Containment Lab (boss): sealed chamber, Hive ribs and crystals everywhere ----
      K.room(0, -229, 58, 62, 13, { doors: { s: 10 }, roof: true, color: 0xb8bfba });
      roomStrips(K, 0, -229, 58, 62, 10, GREEN);
      for (const z of [-208, -229, -250]) archRib(K, 0, z, 25, 11.5, true, CHITIN, 0.9);
      for (const [x, z] of [[-20, -205], [21, -207], [-23, -252], [22, -249], [-26, -229], [26, -232]]) crystals(K, x, z, 1.3);
      for (const [x, z] of [[-11, -216], [12, -241], [-14, -240], [13, -218]]) hive(K, x, z, 1.1);
      K.box(-12, -229, 0.9, 1.3, 5, C.metal); K.box(13, -230, 0.9, 1.3, 5, C.metal);
      K.mesh(new THREE.BoxGeometry(5, 1.1, 1.6), C.metal, 0, 0.7, -214, { rz: 0.35 });
      K.collider(-2.5, 0, -215, 2.5, 1.6, -213, null);
      // ruptured containment vessel at the back, Hive bursting out
      K.cyl(0, -253, 4.2, 1.2, C.metal, { sides: 12 });
      K.cyl(0, -253, 3, 6, GREEN, { y: 1.2, glow: 1.1, collide: false, sides: 12 });
      K.cyl(0, -253, 4.2, 1, C.metal, { y: 11, sides: 12, collide: false });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        K.cone(Math.sin(a) * 3.6, -253 + Math.cos(a) * 3.6, 0.7, K.R(4, 8), CHITIN, { y: 1.2, sides: 5, collide: false, rx: Math.cos(a) * 0.4, rz: -Math.sin(a) * 0.4 });
      }
      creep(K, 0, -244, 16, 8); creep(K, -18, -222, 6, 10);
      for (const z of [-212, -246]) K.box(0, z, 8, 0.15, 1.2, LAMP, { y: 12.8, collide: false, glow: 1.2 });
      K.light(0, 10, -214, GREEN, 10, 35);
      K.light(0, 10, -244, 0x9a6dff, 10, 35);
      K.light(0, 5, -250, GREEN, 8, 22);
    },
  },

  // =========================================================================
  // SAVATHUN'S SONG: separate rig platforms on the methane sea joined by bridges,
  // the Spine of Keres, the stilt forest under the arcology, the Hive nest, and the choir's throne hall.
  // =========================================================================
  t3: {
    spawn: [-45, 15],
    bounds: [-82, 52, -330, 34],
    zones: [
      { name: 'The Methane Sea', x: -40, z: -45 },
      { name: 'Spine of Keres', x: 20, z: -95 },
      { name: 'Arcology Underbelly', x: -20, z: -160 },
      { name: 'The Hive Nest', x: -35, z: -225 },
      { name: 'Choir of Savathûn', x: 8, z: -290, boss: true },
    ],
    noEdge: true,
    build(K) {
      const C = K.C;
      // walkable decks [minX, maxX, minZ, maxZ, 'p' platform | 'b' bridge]
      seaPlatforms(K, [
        [-70, -20, 0, 30, 'p'],       // landing platform
        [-52, -38, -15, 0, 'b'],
        [-70, -10, -75, -15, 'p'],    // rig platform A
        [-10, 14, -48, -36, 'b'],
        [14, 26, -75, -36, 'b'],      // Spine of Keres
        [0, 40, -115, -75, 'p'],      // spine hub
        [14, 26, -135, -115, 'b'],
        [-60, 30, -188, -135, 'p'],   // underbelly
        [-42, -28, -200, -188, 'b'],
        [-75, 5, -255, -200, 'p'],    // Hive nest
        [-6, 12, -262, -255, 'b'],
        [-20, 36, -320, -262, 'p'],   // throne hall
      ]);
      seaScenery(K, 12, 22, 90);

      // ---- landing platform ----
      arco(K, -62, 6, 10, 8, 5, { cap: false });
      container(K, -28, 24, true); container(K, -30, 6, false);
      lamp(K, -66, 26); lamp(K, -24, 15);

      // ---- The Methane Sea: rig platform A ----
      K.cyl(-62, -68, 3.5, 26, YELLOW, { r2: 0.6, sides: 4 }); // derrick
      K.mesh(new THREE.OctahedronGeometry(0.8, 0), AMBER, -62, 26.6, -68, { glow: 2 });
      crane(K, -64, -22, 16, 1, false);
      stack(K, -24, -24, true, 2); stack(K, -22, -62, false, 1); stack(K, -50, -62, false, 2);
      stack(K, -32, -32, false, 1); stack(K, -52, -40, true, 1);
      tank(K, -18, -48, 3.5, 5);
      pipeRun(K, -68, -45, -60, -45, 0.4, 0.6);
      K.box(-42, -58, 6, 1.2, 0.8, PALE2); K.box(-28, -46, 0.8, 1.2, 5, PALE2);
      hive(K, -35, -55, 1.1); hive(K, -50, -28, 1);
      lamp(K, -16, -18); lamp(K, -66, -72);

      // ---- Spine of Keres: rib arches along the walkway, pipelines alongside ----
      for (const z of [-40, -49, -58, -67, -119, -128]) {
        K.box(14.5, z, 0.9, 7.5, 0.9, PALE2);
        K.box(25.5, z, 0.9, 7.5, 0.9, PALE2);
        K.box(20, z, 12, 1, 1.2, PALE2, { y: 7.5, collide: false });
        K.cone(20, z, 0.8, 2.6, PALE2, { y: 8.5, collide: false, sides: 4 });
      }
      pipeRun(K, 28.5, -36, 28.5, -75, 0.4, 0.8);
      pipeRun(K, 11.5, -50, 11.5, -75, 0.4, 0.8);
      pipeRun(K, 28.5, -115, 28.5, -135, 0.4, 0.8);
      pipeRun(K, 11.5, -115, 11.5, -135, 0.4, 0.8);
      // hub
      arco(K, 33, -108, 8, 8, 5, { cap: false });
      tank(K, 6, -80, 3, 5);
      stack(K, 34, -82, true, 1); stack(K, 7, -108, false, 1);
      K.box(12, -96, 0.8, 1.2, 6, PALE2); K.box(28, -92, 0.8, 1.2, 6, PALE2); K.box(20, -84, 5, 1.2, 0.8, PALE2);
      hive(K, 16, -104, 1.1); hive(K, 30, -100, 0.9);
      creep(K, 22, -110, 8, 4);
      K.light(20, 8, -95, AMBER, 8, 30);

      // ---- Arcology Underbelly: stilt forest under the city's hull ----
      K.box(-15, -161.5, 96, 3, 58, 0x9aa19c, { y: 14, collide: false });
      arco(K, -15, -161.5, 80, 44, 18, { y: 17, collide: false, every: 5 });
      for (const x of [-54, -41, -28, -15, -2, 11, 24]) for (const z of [-181, -168, -155, -142]) {
        if (Math.hypot(x + 20, z + 160) < 6) continue;
        K.box(x, z, 1.8, 14, 1.8, PALE2);
        K.box(x, z, 1.9, 0.3, 1.9, AMBER, { y: 3, collide: false, glow: 1.2 });
      }
      for (const z of [-181, -168, -155, -142]) K.box(-15, z, 80, 0.8, 0.8, C.metal, { y: 12, collide: false });
      for (const x of [-54, -28, -2, 24]) K.box(x, -161.5, 0.8, 0.8, 42, C.metal, { y: 11, collide: false });
      for (const x of [-34, 6]) K.box(x, -161.5, 1.2, 1.2, 50, C.rock2, { y: 9, collide: false }); // hanging ducts
      for (const [x, z] of [[-41, -168], [11, -155], [-28, -142]]) { K.box(x, z, 2.2, 8, 2.2, CHITIN, { collide: false }); K.box(x, z, 2.3, 4, 0.2, GREEN, { y: 1, collide: false, glow: 1.3 }); }
      stack(K, -8, -148, true, 1); stack(K, -46, -176, false, 1);
      K.box(-32, -162, 0.8, 1.2, 5, PALE2); K.box(-10, -170, 5, 1.2, 0.8, PALE2);
      hive(K, -22, -174, 1.1); hive(K, 2, -165, 1);
      creep(K, -36, -150, 8, 6);
      K.light(-20, 10, -160, AMBER, 10, 40);

      // ---- The Hive Nest: chitin walls, egg sacs, ribs overhead ----
      for (let z = -252; z <= -204; z += 4) K.cone(-72, z, K.R(1.6, 2.2), K.R(5, 9), K.RP([CHITIN, CHITIN2]), { sides: 5, collide: false, rz: K.R(-0.2, 0.2) });
      K.collider(-74, 0, -254, -70, 8, -202, null);
      for (let x = -66; x <= -10; x += 5) K.cone(x, -252.5, K.R(1.4, 2), K.R(4, 7), CHITIN, { sides: 5, collide: false, rx: K.R(-0.2, 0.2) });
      K.collider(-68, 0, -254.5, -8, 6, -250.5, null);
      archRib(K, -35, -212, 22, 14, true, CHITIN, 0.9);
      archRib(K, -35, -238, 22, 14, true, CHITIN, 0.9);
      for (const [x, z] of [[-50, -212], [-20, -238], [-12, -210], [-56, -238]]) {
        for (let i = 0; i < 3; i++) K.mesh(new THREE.SphereGeometry(K.R(0.7, 1.1), 6, 5), 0x8a9a5a, x + K.R(-1, 1), K.R(0.5, 0.9), z + K.R(-1, 1), { glow: 0.5, scale: [1, 1.3, 1] });
        K.collider(x - 1.6, 0, z - 1.6, x + 1.6, 2, z + 1.6, null);
      }
      K.cyl(-58, -246, 2.4, 14, CHITIN, { r2: 0.4, sides: 4 }); // Hive obelisk
      K.box(-58, -246, 0.3, 10, 4.9, GREEN, { collide: false, glow: 1.4 });
      for (const [x, z] of [[-24, -218], [-46, -230], [-30, -244], [-42, -208]]) hive(K, x, z, 1.2);
      crystals(K, -14, -228, 1.2); crystals(K, -60, -222, 1.1);
      creep(K, -35, -225, 18, 4); creep(K, -48, -240, 8, 8); creep(K, -20, -208, 6, 6);
      K.light(-35, 6, -225, GREEN, 10, 35);

      // ---- Choir of Savathun (boss): roofed Hive throne hall, green fire, altar ----
      const hx = 8, hz = -291;
      K.room(hx, hz, 56, 58, 13, { doors: { s: 12 }, doorOffset: { s: -5 }, roof: true, color: 0x3a3c36, roofColor: CHITIN });
      K.box(hx, hz, 54, 0.26, 56, 0x2c2e2a, { collide: false });
      roomStrips(K, hx, hz, 56, 58, 9, GREEN);
      for (const x of [hx - 20, hx + 20]) for (const z of [-272, -284, -298, -310]) {
        K.box(x, z, 2.4, 13, 2.4, CHITIN2);
        K.box(x, z, 2.5, 3, 0.3, GREEN, { y: 3, collide: false, glow: 1.2 });
        K.cone(x, z, 1.6, 3, CHITIN, { y: 7, collide: false, sides: 4 });
      }
      for (let i = 0; i < 6; i++) {
        const sx = hx + K.R(-24, 24), sz = K.R(-316, -266), h = K.R(2.5, 5);
        K.cone(sx, sz, K.R(0.6, 1.1), h, CHITIN, { y: 13 - h, rx: Math.PI, collide: false, sides: 5 });
      }
      K.platform(hx, -313, 18, 8, 1.2, { stairs: ['s'], stairW: 6, color: CHITIN2, stairColor: CHITIN });
      K.box(hx, -314, 5, 1.2, 2.4, CHITIN, { y: 1.2 }); // altar
      K.box(hx, -314, 5.2, 0.25, 2.6, GREEN, { y: 2.4, collide: false, glow: 1.8 });
      K.box(hx, -317, 3.6, 7, 1.2, CHITIN, { y: 1.2 }); // throne back
      for (const s of [-1, 1]) K.cone(hx + s * 2.2, -317, 0.6, 4, CHITIN2, { y: 8.2, collide: false, sides: 4, rz: -s * 0.3 });
      for (const [x, z] of [[hx - 12, -304], [hx + 12, -304], [hx - 12, -278], [hx + 12, -278], [hx - 14, -268], [hx + 16, -268], [hx - 11, -316], [hx + 11, -316]]) brazier(K, x, z);
      for (const [x, z] of [[hx - 10, -292], [hx + 11, -288], [hx, -279]]) hive(K, x, z, 1.1);
      crystals(K, hx - 22, -320 + 4, 1.2); crystals(K, hx + 22, -316, 1.2);
      creep(K, hx, -300, 12, 5);
      K.light(hx, 9, -276, GREEN, 10, 35);
      K.light(hx, 9, -304, GREEN, 10, 35);
      K.light(hx, 4, -312, 0xffa040, 8, 22);
    },
  },
};
