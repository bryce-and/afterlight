// Hand-built Moon mission maps (see makeKit in world.js).
// The Moon is the one destination with Hive castle architecture: grey moon-rock walls, ribbed tiers,
// pointed spires, bone spikes and green fire.
import * as THREE from 'three';

const HR = 0x5a5d63, HR2 = 0x404349, BONE = 0xcfc8b2, CHIT = 0x26282c, VOID = 0x040506;
const GA = 0xc9cdd2, GA2 = 0x9aa0a7, ORANGE = 0xd9822b, GREEN = 0x58ff9c, PALE = 0xbfe4ff, WARD = 0x7affd8;
const TAU = Math.PI * 2;
const flat = (geo) => geo.rotateX(-Math.PI / 2);

// cached unit geometries (scaled per use)
const GEO = {};
const unit = (k, fn) => GEO[k] || (GEO[k] = fn());
const spikeGeo = () => unit('spike', () => new THREE.ConeGeometry(1, 1, 5));
const crystalGeo = () => unit('crystal', () => new THREE.OctahedronGeometry(1, 0));

// ---------- Hive pieces ----------

// Hive spire: tiered square plinth, tapering four-sided shaft, needle tip, green slit, corner pinnacles.
function spire(K, x, z, r, h, o = {}) {
  const y = o.y ?? 0, col = o.collide ?? true;
  const bh = h * 0.2, sh = h * 0.5, th = h - bh * 1.5 - sh;
  K.box(x, z, r * 2.2, bh, r * 2.2, HR2, { y, collide: col });
  K.box(x, z, r * 1.7, bh * 0.5, r * 1.7, HR, { y: y + bh, collide: false });
  K.mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.8, sh, 4), HR, x, y + bh * 1.5 + sh / 2, z, { ry: Math.PI / 4 });
  K.mesh(new THREE.ConeGeometry(r * 0.45, th, 4), HR2, x, y + bh * 1.5 + sh + th / 2, z, { ry: Math.PI / 4 });
  if (o.glow !== false) K.box(x, z + r * 0.5, 0.3, sh * 0.55, 0.25, GREEN, { y: y + bh * 1.5 + sh * 0.2, collide: false, glow: 1.6 });
  if (o.pinnacles !== false) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    K.mesh(spikeGeo(), HR2, x + sx * r * 0.95, y + bh + bh * 0.45, z + sz * r * 0.95, { scale: [r * 0.22, bh * 0.9, r * 0.22] });
  }
}

// Ribbed, tiered Hive castle wall along x (axis 'x', at = z) or along z (axis 'z', at = x).
// face = side (+1/-1) that gets the ribs and the stepped plinth. gaps are [from, to] along the wall from a1.
function hiveWall(K, a1, a2, at, h, o = {}) {
  const ax = o.axis ?? 'x', t = o.t ?? 2.4, face = o.face ?? 1, gaps = (o.gaps || []).slice().sort((p, q) => p[0] - q[0]);
  const color = o.color ?? HR;
  const P = (a, off) => (ax === 'x' ? [a, at + off] : [at + off, a]);
  const box = (a, off, la, hh, lo, col, y, collide = false, glow) => {
    const [x, z] = P(a, off);
    K.box(x, z, ax === 'x' ? la : lo, hh, ax === 'x' ? lo : la, col, { y, collide, glow });
  };
  if (ax === 'x') K.wall(a1, at, a2, at, h, { t, color, gaps }); else K.wall(at, a1, at, a2, h, { t, color, gaps });
  const open = (a, pad) => gaps.some(([g1, g2]) => a > a1 + g1 - pad && a < a1 + g2 + pad);
  const segs = [];
  let from = 0;
  for (const [g1, g2] of [...gaps, [a2 - a1, a2 - a1]]) { if (g1 - from > 0.5) segs.push([a1 + from, a1 + g1]); from = Math.max(from, g2); }
  for (const [s1, s2] of segs) {
    box((s1 + s2) / 2, face * (t / 2 + 0.9), s2 - s1, 1.4, 1.8, HR2, 0, true); // stepped plinth
    if (o.tier !== false) box((s1 + s2) / 2, face * (t / 2 + 0.5), s2 - s1, h * 0.35, 1.0, HR2, 1.4); // second tier
    box((s1 + s2) / 2, face * (t / 2 + 0.35), s2 - s1, 0.7, 0.7, HR2, h); // cornice
  }
  const step = o.rib ?? 7;
  for (let a = a1 + step / 2; a < a2; a += step) {
    if (open(a, 1.2)) continue;
    box(a, face * (t / 2 + 0.55), 1.1, h + 2, 1.1, HR2, 0);
    const [x, z] = P(a, face * (t / 2 + 0.55));
    K.mesh(spikeGeo(), BONE, x, h + 3.2, z, { scale: [0.5, 2.4, 0.5] });
  }
  const tooth = o.teeth ?? 3.5;
  if (tooth) for (let a = a1 + tooth / 2; a < a2; a += tooth) {
    if (open(a, 0.5)) continue;
    const [x, z] = P(a, 0);
    K.mesh(spikeGeo(), HR2, x, h + 0.8, z, { scale: [0.55, 1.6, 0.55], ry: 0.6 });
  }
}

// green-fire brazier
function brazier(K, x, z, s = 1, y = 0) {
  K.cyl(x, z, 0.55 * s, 1.0 * s, HR2, { r2: 0.35 * s, sides: 6, y });
  K.cyl(x, z, 0.5 * s, 0.5 * s, CHIT, { r2: 1.0 * s, sides: 6, y: y + 1.0 * s, collide: false });
  K.cone(x, z, 0.7 * s, 1.5 * s, GREEN, { y: y + 1.4 * s, sides: 5, collide: false, glow: 2.2 });
}

function boneSpike(K, x, z, h, o = {}) {
  K.mesh(spikeGeo(), BONE, x, (o.y ?? 0) + h * 0.45, z, { scale: [h * 0.11, h, h * 0.11], rx: o.rx ?? K.R(-0.2, 0.2), rz: o.rz ?? K.R(-0.2, 0.2) });
}

function crystals(K, x, z, s = 1, o = {}) {
  const col = o.color ?? GREEN, n = o.n ?? 4, y = o.y ?? 0;
  for (let k = 0; k < n; k++) {
    const r = s * K.R(0.5, 1.0), a = (k / n) * TAU + K.R(0, 1), off = k === 0 ? 0 : s * 0.9, sy = K.R(1.8, 2.8);
    K.mesh(crystalGeo(), col, x + Math.sin(a) * off, y + r * sy * 0.6, z + Math.cos(a) * off, { glow: o.glow ?? 1.1, scale: [r, r * sy, r], rx: K.R(-0.3, 0.3), rz: K.R(-0.3, 0.3) });
  }
  if (o.collide !== false) K.collider(x - s * 1.3, y, z - s * 1.3, x + s * 1.3, y + s * 3, z + s * 1.3, null);
}

// pointed Hive arch outline (glow) over a gateway centred at x, facing +z/-z, of width w, starting at height y
function pointedArch(K, x, z, w, y, o = {}) {
  const s = w / Math.SQRT2;
  K.mesh(new THREE.BoxGeometry(s, s, 0.5), o.fill ?? VOID, x, y, z, { rz: Math.PI / 4 });
  for (const sgn of [-1, 1]) K.mesh(new THREE.BoxGeometry(s + 0.4, 0.35, 0.3), GREEN, x + sgn * w / 4, y + w / 4, z + (o.face ?? 1) * 0.3, { rz: -sgn * Math.PI / 4, glow: 1.6 });
}

function broken(K, x, z, h, o = {}) { // broken Hive pillar with a bone crown
  K.box(x, z, 1.8, h, 1.8, o.color ?? HR);
  K.box(x, z, 2.4, 0.6, 2.4, HR2, { collide: false });
  if (h > 4) boneSpike(K, x + 0.4, z, 2.2, { y: h });
}

// ---------- Moon surface / Golden Age pieces ----------

function crater(K, x, z, r) {
  K.mesh(flat(new THREE.CircleGeometry(r, 14)), 0x6c7177, x, 0.22, z);
  K.mesh(new THREE.TorusGeometry(r, r * 0.16, 3, 14), K.C.ground2, x, 0.05, z, { rx: Math.PI / 2, scale: [1, 1, 0.45] });
}

function dome(K, x, z, r) {
  K.mesh(new THREE.SphereGeometry(r, 10, 5, 0, TAU, 0, Math.PI / 2), GA, x, 0, z, { collide: 0.72 });
  K.mesh(new THREE.TorusGeometry(r * 1.0, 0.25, 4, 16), ORANGE, x, 0.6, z, { rx: Math.PI / 2 });
  K.mesh(new THREE.TorusGeometry(r * 0.75, 0.16, 4, 16), PALE, x, r * 0.66, z, { rx: Math.PI / 2, glow: 0.9 });
  K.box(x, z + r - 0.4, 2.2, 2.6, 1.6, GA2, { collide: false });
  K.box(x, z + r + 0.35, 1.4, 2.0, 0.1, PALE, { collide: false, glow: 0.6 });
  K.cyl(x + r * 0.3, z - r * 0.2, 0.08, 3, GA2, { y: r * 0.9, collide: false, sides: 4 });
}

function gaModule(K, x, z, w, d, h = 3.4) {
  K.box(x, z, w, h, d, GA);
  K.box(x, z, w + 0.08, 0.35, d + 0.08, ORANGE, { y: h * 0.62, collide: false });
  K.box(x, z, w + 0.06, 0.4, d + 0.06, PALE, { y: h * 0.32, collide: false, glow: 0.7 });
  K.box(x, z, w * 0.5, 0.8, d * 0.5, GA2, { y: h, collide: false });
}

function tube(K, x1, z1, x2, z2, r = 1.1) { // axis-aligned corridor tube
  const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1), L = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  K.mesh(new THREE.CylinderGeometry(r, r, L, 8), GA2, (x1 + x2) / 2, r + 0.2, (z1 + z2) / 2, alongX ? { rz: Math.PI / 2, collide: true } : { rx: Math.PI / 2, collide: true });
}

function rover(K, x, z, alongX = true) {
  const w = alongX ? 3.8 : 2.2, d = alongX ? 2.2 : 3.8;
  K.box(x, z, w, 0.9, d, GA2, { y: 0.55, collide: false });
  K.box(x + (alongX ? -0.5 : 0), z + (alongX ? 0 : -0.5), alongX ? 1.7 : 1.9, 1.0, alongX ? 1.9 : 1.7, GA, { y: 1.45, collide: false });
  K.box(x + (alongX ? -0.5 : 0), z + (alongX ? 0 : -0.5), alongX ? 1.75 : 1.5, 0.4, alongX ? 1.5 : 1.75, PALE, { y: 1.9, collide: false, glow: 0.4 });
  for (const i of [-1, 0, 1]) for (const s of [-1, 1]) {
    if (i === 1 && s === 1) continue; // lost a wheel
    const wx = alongX ? x + i * 1.3 : x + s * 1.2, wz = alongX ? z + s * 1.2 : z + i * 1.3;
    K.mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.35, 8), CHIT, wx, 0.48, wz, alongX ? { rx: Math.PI / 2 } : { rz: Math.PI / 2 });
  }
  K.cyl(x + (alongX ? 1.4 : 0.6), z + (alongX ? 0.6 : 1.4), 0.06, 2.2, GA2, { y: 1.4, collide: false, sides: 4 });
  K.collider(x - w / 2, 0, z - d / 2, x + w / 2, 2.4, z + d / 2, null);
}

function antenna(K, x, z, h) {
  K.cyl(x, z, 0.45, h, GA2, { r2: 0.25, sides: 6 });
  for (const f of [0.35, 0.65]) K.box(x, z, 2.4, 0.18, 0.18, GA2, { y: h * f, collide: false });
  K.mesh(new THREE.SphereGeometry(2.4, 10, 4, 0, TAU, 0, Math.PI * 0.32), GA, x, h + 0.3, z + 0.6, { rx: 1.1 });
  K.box(x, z + 1.4, 0.25, 0.25, 0.25, ORANGE, { y: h + 0.6, collide: false, glow: 1.5 });
}

function fallenAntenna(K, x, z, L) { // lying along x
  K.box(x, z, L, 0.8, 0.8, GA2);
  for (let i = -L / 2 + 1.5; i < L / 2; i += 3) K.box(x + i, z, 0.15, 0.15, 2.2, GA2, { y: 0.8, collide: false });
  K.mesh(new THREE.SphereGeometry(2.4, 10, 4, 0, TAU, 0, Math.PI * 0.32), GA, x + L / 2 + 1.2, 1.4, z, { rz: -1.3 });
}

function hiveEdge(K, n, spireChance = 0.35, far = 70) {
  K.edge((x, z, y) => {
    if (K.chance(spireChance)) spire(K, x, z, K.R(2.5, 5.5), K.R(22, 48), { y, collide: false, pinnacles: false });
    else K.rock(x, z, K.R(3, 8), { y, collide: false });
  }, n, 8, far);
}

// ======================================================================================

export default {
  // ---------------- M1: open lunar plains, Golden Age base, Hive gate -----------------
  m1: {
    spawn: [0, 18],
    bounds: [-80, 80, -230, 30],
    zones: [
      { name: "Archer's Line", x: -25, z: -55 },
      { name: 'Anchor of Light', x: 20, z: -118 },
      { name: 'Gate of Oryx', x: 0, z: -186, boss: true },
    ],
    noEdge: true,
    build(K) {
      // ---- the plains: craters everywhere ----
      for (const [x, z, r] of [[-38, -46, 7], [-12, -68, 5], [-32, -74, 4], [6, -32, 6], [-55, -18, 9], [-60, -92, 6], [32, -58, 8], [48, -18, 6],
        [-4, -96, 5], [58, -86, 7], [-20, 2, 4], [24, 4, 5], [-46, -128, 8], [62, -150, 6], [-62, -160, 7], [40, -168, 5], [-28, -150, 4]]) crater(K, x, z, r);
      // rocks on some crater rims
      for (const [x, z, s] of [[-31, -42, 1.8], [-44, -52, 2.2], [11, -36, 1.6], [37, -53, 2.4], [-9, -64, 1.4], [26, -62, 1.8], [-50, -122, 2.4]]) K.rock(x, z, s);
      // long low ridge on the west, boulders scattered
      for (let z = 6; z > -150; z -= 9) K.rock(K.R(-76, -68), z + K.R(-3, 3), K.R(2.6, 4.5));
      K.scatter((x, z) => K.rock(x, z, K.R(1.2, 2.6)), 0, -10, 10, 40, 8, 2.5);

      // ---- Archer's Line: rover wrecks, Golden Age antenna array ----
      rover(K, -16, -44, true);
      rover(K, -37, -63, false);
      rover(K, 14, 0, true);
      fallenAntenna(K, -6, -80, 12);
      antenna(K, -58, -48, 14);
      antenna(K, -63, -62, 11);
      antenna(K, -52, -70, 9);
      K.box(-58, -60, 6, 1.6, 3, GA2); // equipment shed
      K.box(-58, -60, 6.1, 0.3, 3.1, ORANGE, { y: 1.0, collide: false });
      for (const [x, z] of [[-22, -40], [-36, -52], [-14, -58], [-28, -68], [-20, -71]]) K.cover(x, z);
      for (const [x, z] of [[-40, -58], [-10, -50], [-30, -38]]) K.prop(x, z);
      // Hive cave mouth carved into the eastern cliff
      K.box(68, -46, 24, 12, 34, K.C.rock2);
      K.box(70, -46, 22, 6, 26, K.C.rock, { y: 12, collide: false });
      K.box(55.8, -46, 0.4, 7, 9, VOID, { collide: false });
      pointedArch(K, 55.6, -46, 9, 7, { fill: VOID });
      for (const dz of [-6, 6]) K.box(55.6, -46 + dz, 1.2, 9, 1.2, HR2);
      for (const dz of [-9, -3, 3, 9]) boneSpike(K, 54.5, -46 + dz * 1.4, K.R(3, 5), { rz: 0.5 });
      crystals(K, 52, -36, 1.2);
      crystals(K, 51, -57, 1.0);
      K.light(53, 4, -46, GREEN, 8, 26);

      // ---- Anchor of Light: Golden Age lunar base with Hive growths ----
      K.cyl(20, -118, 10, 0.32, GA2, { sides: 12, collide: false });
      K.cyl(20, -118, 8.6, 0.34, 0x7f858c, { sides: 12, collide: false });
      for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; K.box(20 + Math.sin(a) * 9.3, -118 + Math.cos(a) * 9.3, 0.6, 0.12, 0.6, ORANGE, { y: 0.34, collide: false, glow: 1.4 }); }
      K.box(20, -118, 6, 0.1, 1, ORANGE, { y: 0.36, collide: false });
      K.box(20, -118, 1, 0.1, 6, ORANGE, { y: 0.36, collide: false });
      dome(K, -6, -104, 7);
      dome(K, 46, -96, 6);
      dome(K, 46, -142, 8);
      dome(K, 0, -142, 5);
      gaModule(K, 20, -94, 14, 5);
      gaModule(K, 54, -120, 5, 12);
      gaModule(K, -8, -122, 5, 10);
      tube(K, 27, -94, 40.2, -94);
      tube(K, -8, -117, -8, -110.5);
      tube(K, 52, -126, 52, -136.5);
      antenna(K, 62, -104, 20);
      antenna(K, -20, -88, 12);
      // jersey barriers and crates around the pad
      for (const [x, z, w, d] of [[8, -108, 4, 0.8], [33, -126, 0.8, 4], [12, -131, 4, 0.8], [31, -106, 4, 0.8]]) K.box(x, z, w, 1.2, d, GA2);
      K.scatter(K.crate, 20, -118, 9, 16, 6, 1.5);
      // the Hive is taking the base: bone spikes through the domes, crystal growths, glowing cracks
      for (const [x, z, h] of [[40, -138, 7], [47, -146, 9], [44, -135, 5], [-9, -100, 6], [-2, -108, 5]]) boneSpike(K, x, z, h);
      crystals(K, 34, -132, 1.1);
      crystals(K, 4, -112, 0.9);
      crystals(K, 52, -112, 1.0);
      for (const [x, z, w, d] of [[30, -136, 6, 0.3], [36, -132, 0.3, 5], [-2, -116, 0.3, 6], [8, -122, 5, 0.3]]) K.box(x, z, w, 0.3, d, GREEN, { collide: false, glow: 1.2 });
      K.light(20, 9, -118, PALE, 6, 30);

      // ---- approach: Golden Age gives way to Hive obelisks ----
      for (const z of [-150, -162]) for (const s of [-1, 1]) spire(K, s * 16, z, 1.3, 10, { pinnacles: false });
      for (const [x, z] of [[-30, -138], [28, -160], [-12, -156], [50, -172]]) boneSpike(K, x, z, K.R(4, 7));
      for (const [x, z] of [[-40, -164], [36, -150], [-8, -136]]) K.prop(x, z);

      // ---- Gate of Oryx: temple plaza before a huge spired facade ----
      K.box(0, -190, 70, 0.3, 50, 0x54575c, { collide: false });                     // plaza floor
      for (let z = -168; z > -212; z -= 8) K.box(0, z, 70, 0.32, 0.4, HR2, { collide: false }); // floor seams
      hiveWall(K, -80, 80, -217, 16, { t: 3, face: 1, rib: 8, teeth: 4, gaps: [[74, 86]] });
      // dark recessed gateway on a raised platform, reached by ziggurat steps
      K.box(0, -220.5, 13, 16, 4, VOID);
      K.stairs(0, -204, 'n', 14, 2.0, { color: HR2 });
      K.box(0, -212.75, 14, 2.0, 11.5, HR2);
      pointedArch(K, 0, -215.4, 9, 12);
      for (const s of [-1, 1]) K.box(s * 6.3, -215.6, 0.5, 14, 0.4, GREEN, { y: 2, collide: false, glow: 1.6 });
      brazier(K, -5.5, -209, 1, 2);
      brazier(K, 5.5, -209, 1, 2);
      // ziggurat tiers flanking the stairs
      for (const s of [-1, 1]) {
        K.box(s * 20, -209, 16, 1.6, 9, HR2);
        K.box(s * 20, -210, 12, 1.6, 7, HR, { y: 1.6 });
        K.box(s * 20, -211, 8, 1.6, 5, HR2, { y: 3.2 });
        brazier(K, s * 20, -211, 1.2, 4.8);
      }
      // the great spires of the facade
      for (const [x, r, h] of [[11.5, 4.5, 46], [28, 3.6, 34], [48, 3.2, 28], [70, 2.6, 22]]) for (const s of [-1, 1]) spire(K, s * x, -218, r, h);
      // side wings close the plaza into a U
      for (const s of [-1, 1]) {
        hiveWall(K, -214, -168, s * 44, 9, { axis: 'z', t: 2, face: -s, rib: 7, gaps: [[12, 20]] });
        for (const z of [-170, -186, -202]) brazier(K, s * 32, z, 1.1);
      }
      // cover in the arena
      for (const [x, z, h] of [[-12, -178, 6], [13, -180, 3], [-11, -196, 3.5], [12, -195, 7], [0, -171, 2.2]]) broken(K, x, z, h);
      K.box(-20, -186, 1, 1.6, 6, HR2);
      K.box(20, -186, 1, 1.6, 6, HR2);
      K.light(0, 10, -204, GREEN, 14, 45);

      hiveEdge(K, 70, 0.3, 80);
    },
  },

  // ---------------- M2: Temple of Crota walls, the Hellmouth pit, tunnels, cathedral ----------------
  m2: {
    spawn: [0, 18],
    bounds: [-80, 85, -308, 30],
    zones: [
      { name: 'Temple of Crota', x: 0, z: -48 },
      { name: 'The Hellmouth', x: -14, z: -125 },
      { name: 'Hive Tunnels', x: -30, z: -200 },
      { name: 'Chamber of Night', x: -10, z: -268, boss: true },
    ],
    noEdge: true,
    build(K) {
      // ---- processional approach ----
      for (const z of [2, -12, -26]) for (const s of [-1, 1]) brazier(K, s * 9, z, 1.1);
      for (const s of [-1, 1]) hiveWall(K, -40, 10, s * 62, 6, { axis: 'z', t: 2, face: -s, rib: 8, tier: false });

      // ---- Temple of Crota: courtyard before the great wall ----
      K.platform(-27, -44, 10, 8, 2.4, { stairs: ['e'], color: HR2, stairColor: HR });
      K.platform(27, -54, 10, 8, 2.4, { stairs: ['w'], color: HR2, stairColor: HR });
      for (const [x, z] of [[-29, -41], [-25, -47], [25, -51], [29, -57]]) boneSpike(K, x, z, 3, { y: 2.4 });
      for (const [x, z, h] of [[-10, -38, 5], [11, -42, 3], [-13, -58, 3.5], [8, -61, 6], [-2, -66, 2.4]]) broken(K, x, z, h);
      K.box(-19, -60, 6, 1.6, 1, HR2);
      K.box(18, -36, 1, 1.6, 6, HR2);
      crystals(K, -20, -28, 1.0);
      crystals(K, 22, -68, 1.1);
      // the wall: ribbed, tiered, crowned with spikes, gate at x -7..7
      hiveWall(K, -80, 85, -80, 16, { t: 3.2, face: 1, rib: 7, teeth: 4.5, gaps: [[73, 87]] });
      K.box(0, -80, 14.4, 4, 3.2, HR2, { y: 11, collide: false });
      pointedArch(K, 0, -78.2, 9, 15.5, { fill: HR2 });
      for (const s of [-1, 1]) K.box(s * 7.3, -78.3, 0.4, 11, 0.4, GREEN, { collide: false, glow: 1.6 });
      for (const [x, r, h] of [[12, 4, 38], [34, 3, 28], [58, 3, 24]]) for (const s of [-1, 1]) spire(K, s * x, -81, r, h);
      spire(K, 80, -81, 2.6, 20);
      K.light(0, 8, -74, GREEN, 10, 30);

      // ---- inside the walls: Hive ground leading to the Hellmouth ----
      for (const [x, z, h] of [[-30, -96, 4], [10, -100, 6], [-40, -132, 3], [4, -116, 3.5], [-28, -146, 5.5], [2, -140, 2.5]]) broken(K, x, z, h);
      K.box(-26, -112, 7, 2, 1, HR2);
      K.box(-2, -128, 1, 1.8, 6, HR2);
      crystals(K, -38, -114, 1.2);
      crystals(K, 0, -106, 0.9);
      for (const [x, z] of [[-55, -100], [-60, -140], [40, -95], [60, -108]]) K.prop(x, z);

      // ---- The Hellmouth: a vast pit ringed by a spiked wall ----
      const px = 26, pz = -146, pr = 15;
      K.mesh(flat(new THREE.RingGeometry(pr, pr + 3, 36)), HR2, px, 0.26, pz);
      K.mesh(flat(new THREE.RingGeometry(11, pr, 36)), 0x17191c, px, 0.27, pz);
      K.mesh(flat(new THREE.RingGeometry(6.5, 11, 32)), 0x0b0c0e, px, 0.28, pz);
      K.mesh(flat(new THREE.CircleGeometry(6.5, 28)), VOID, px, 0.29, pz);
      K.mesh(flat(new THREE.RingGeometry(3.0, 3.7, 28)), GREEN, px, 0.3, pz, { glow: 0.7 });
      K.mesh(flat(new THREE.RingGeometry(8.4, 8.8, 32)), GREEN, px, 0.29, pz, { glow: 0.35 });
      const ringR = pr + 1.6, N = 34;
      for (let k = 0; k < N; k++) {
        const a = (k / N) * TAU, x = px + Math.sin(a) * ringR, z = pz + Math.cos(a) * ringR;
        K.mesh(new THREE.BoxGeometry(3.1, 2.4, 1.4), HR, x, 1.2, z, { ry: a });
        if (k % 2 === 0) K.mesh(spikeGeo(), BONE, x + Math.sin(a) * 0.3, 3.4, z + Math.cos(a) * 0.3, { scale: [0.45, 2.8, 0.45], rx: Math.cos(a) * 0.35, rz: -Math.sin(a) * 0.35 });
      }
      // solid fill so nothing walks or spawns inside the pit
      for (let b = -3; b <= 3; b++) {
        const zc = b * 5, hw = Math.sqrt(Math.max(0, (ringR + 0.8) ** 2 - Math.max(0, Math.abs(zc) - 2.5) ** 2));
        K.collider(px - hw, 0, pz + zc - 2.5, px + hw, 2.4, pz + zc + 2.5, null);
      }
      // giant teeth leaning over the pit and spires on its far rim
      for (let k = 0; k < 7; k++) {
        const a = Math.PI * 0.1 + (k / 6) * Math.PI * 0.9, r = ringR + 2.5, x = px + Math.sin(a) * r, z = pz + Math.cos(a) * r;
        K.mesh(spikeGeo(), BONE, x, 5, z, { scale: [1.0, 12, 1.0], rx: -Math.cos(a) * 0.45, rz: Math.sin(a) * 0.45 });
      }
      spire(K, 50, -134, 3.5, 30);
      spire(K, 54, -150, 4, 36);
      spire(K, 46, -160, 3, 24);
      spire(K, 40, -123, 2.6, 20);
      for (const [x, z] of [[2, -134], [4, -156]]) brazier(K, x, z, 1.3);

      // ---- cliff with the tunnel mouth ----
      hiveWall(K, -80, 85, -168, 18, { t: 3, face: 1, rib: 9, teeth: 6, gaps: [[46, 54]] });
      spire(K, -38, -166.5, 2.4, 26);
      spire(K, -22, -166.5, 2.4, 26);
      pointedArch(K, -30, -166.3, 8, 11, { fill: HR2 });
      for (const s of [-1, 1]) K.box(-30 + s * 4.2, -166.3, 0.35, 10, 0.35, GREEN, { collide: false, glow: 1.6 });

      // ---- Hive tunnels: narrow roofed passages and a ribbed junction hall ----
      const tunnel = (x, z1, z2) => {
        K.wall(x - 4, z1, x - 4, z2, 10, { t: 1, color: HR2 });
        K.wall(x + 4, z1, x + 4, z2, 10, { t: 1, color: HR2 });
        const zm = (z1 + z2) / 2, L = Math.abs(z2 - z1);
        K.box(x, zm, 9, 0.6, L, CHIT, { y: 10 });
        for (let z = Math.max(z1, z2) - 1.5; z > Math.min(z1, z2); z -= 3) {
          for (const s of [-1, 1]) K.box(x + s * 3.3, z, 0.5, 10, 0.7, HR, { collide: false });
          K.box(x, z, 7, 0.6, 0.7, HR, { y: 9.2, collide: false });
        }
        for (const s of [-1, 1]) K.box(x + s * 3.2, zm, 0.3, 0.12, L, GREEN, { y: 0.3, collide: false, glow: 1.4 });
      };
      tunnel(-30, -168, -179);
      K.room(-30, -200, 44, 42, 10, { t: 1.2, doors: { s: 8, n: 8 }, doorOffset: { n: 8 }, roof: true, color: HR2, roofColor: CHIT });
      for (let z = -182; z > -220; z -= 4) for (const s of [-1, 1]) K.box(-30 + s * 21.2, z, 0.7, 10, 1.0, HR, { collide: false });
      for (let z = -183; z > -220; z -= 6) K.box(-30, z, 42, 0.7, 0.9, HR, { y: 9.0, collide: false });
      for (const [x, z] of [[-40, -191], [-20, -191], [-40, -209], [-20, -209]]) {
        K.cyl(x, z, 1.7, 10, HR, { r2: 1.1, sides: 6 });
        K.box(x, z, 3.2, 0.6, 3.2, HR2, { y: 0, collide: false });
      }
      for (const [x, z] of [[-48, -183], [-12, -183], [-48, -217], [-12, -217]]) crystals(K, x, z, 1.0);
      for (const [x, z] of [[-30, -190], [-36, -210], [-22, -205]]) K.mesh(flat(new THREE.CircleGeometry(2.2, 10)), GREEN, x, 0.28, z, { glow: 0.6 });
      for (const [x, z] of [[-50.5, -195], [-9.5, -205], [-50.5, -208]]) K.mesh(new THREE.SphereGeometry(1.1, 6, 4), BONE, x, 2.2, z, { scale: [0.6, 1.4, 0.8] });
      K.box(-36, -199, 6, 1.4, 1, HR2);
      K.box(-23, -201, 1, 1.4, 5, HR2);
      K.light(-30, 8, -190, GREEN, 8, 24);
      K.light(-30, 8, -210, GREEN, 8, 24);
      tunnel(-22, -221, -236);

      // ---- Chamber of Night: roofed cathedral, pillar rows, braziers, raised altar ----
      K.room(-10, -268, 50, 64, 16, { t: 1.6, doors: { s: 8 }, doorOffset: { s: -12 }, roof: true, color: HR2, roofColor: CHIT });
      for (const z of [-246, -256, -266, -276, -286]) for (const x of [-26, 6]) {
        K.box(x, z, 2.4, 16, 2.4, HR);
        K.box(x, z, 3.4, 1.2, 3.4, HR2, { collide: false });
        K.box(x, z, 3.0, 0.8, 3.0, HR2, { y: 13.5, collide: false });
        boneSpike(K, x, z + 1.4, 2.4, { y: 14.3, rx: 0.3 });
      }
      for (let z = -244; z > -298; z -= 10) K.box(-10, z, 48, 1.0, 1.0, HR, { y: 14.4, collide: false }); // vault ribs
      for (let z = -246; z > -292; z -= 10) for (const s of [-1, 1]) { // green slit windows
        K.box(-10 + s * 24.1, z + 5, 0.3, 6, 0.8, GREEN, { y: 6, collide: false, glow: 1.3 });
        K.box(-10 + s * 23.9, z, 0.9, 16, 1.4, HR, { collide: false });
      }
      for (const [x, z] of [[-18, -252], [-2, -252], [-18, -280], [-2, -280]]) brazier(K, x, z, 1.1);
      for (const [x, z, h] of [[-20, -263, 3], [0, -276, 2.4]]) broken(K, x, z, h);
      // raised altar at the north end
      K.platform(-10, -292, 20, 10, 2.0, { stairs: ['s'], color: HR2, stairColor: HR, stairW: 8 });
      K.box(-10, -294, 5, 1.3, 2.2, HR, { y: 2.0 });
      K.box(-10, -294, 5.2, 0.15, 2.4, GREEN, { y: 3.3, collide: false, glow: 1.4 });
      brazier(K, -17, -291, 1.2, 2);
      brazier(K, -3, -291, 1.2, 2);
      for (const s of [-1, 1]) boneSpike(K, -10 + s * 6, -296, 8, { y: 2, rz: -s * 0.18, rx: 0 });
      crystals(K, -10, -297.5, 1.6, { y: 2, collide: false, glow: 1.5 });
      pointedArch(K, -10, -298.9, 12, 9.5, { face: 1, fill: CHIT });
      K.light(-10, 12, -262, GREEN, 9, 40);
      K.light(-10, 7, -290, GREEN, 12, 26);

      hiveEdge(K, 45, 0.35, 70);
    },
  },

  // ---------------- M3: raid descent: the Abyss, the Bridge, the Deathsinger's ward, Crota's throne ----------------
  m3: {
    spawn: [0, 20],
    bounds: [-60, 70, -300, 30],
    zones: [
      { name: 'The Abyss', x: -6, z: -42 },
      { name: 'The Bridge', x: 0, z: -118 },
      { name: "Deathsinger's Ward", x: 0, z: -190 },
      { name: 'Throne of Crota', x: 30, z: -262, boss: true },
    ],
    noEdge: true,
    build(K) {
      // ---- The Abyss: pitch-dark roofed cavern, lamps marking a winding path ----
      K.room(0, -21, 80, 102, 12, { t: 2, doors: { n: 16 }, roof: true, color: HR2, roofColor: 0x2a2c30 });
      const path = [[0, 14], [-14, 0], [-20, -18], [-6, -42], [12, -56], [0, -70]];
      let side = 1;
      for (let i = 0; i < path.length - 1; i++) {
        const [ax, az] = path[i], [bx, bz] = path[i + 1], L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L;
        for (let t = 0; t < L; t += 7) {
          const x = ax + dx * t - dz * side * 3.5, z = az + dz * t + dx * side * 3.5;
          side = -side;
          if (Math.hypot(x, z - 20) < 8 || Math.hypot(x + 6, z + 42) < 5.5) continue;
          K.cyl(x, z, 0.2, 3, HR2, { sides: 5, collide: 0.9 });
          K.mesh(crystalGeo(), GREEN, x, 3.4, z, { scale: [0.35, 0.55, 0.35], glow: 2.4 });
        }
      }
      // stalagmites, stepped ledges along the walls, stalactites
      for (const [x, z, r, h] of [[-30, 12, 2, 6], [28, 6, 2.4, 8], [30, -30, 2, 5], [-33, -50, 2.6, 7], [24, -64, 1.8, 5], [-28, -64, 2, 6], [18, -20, 1.6, 4]]) K.cone(x, z, r, h, K.C.rock2, { sides: 5 });
      for (const [x, z] of [[-12, -30], [2, -50], [-18, -50], [6, -34], [-2, -24]]) K.rock(x, z, K.R(1.4, 2.2));
      for (const s of [-1, 1]) for (let z = 20; z > -66; z -= 14) {
        K.box(s * 36.5, z, 5, 1.6, 12, HR, { collide: false });
        K.box(s * 37.5, z - 2, 3, 3.2, 8, HR2, { collide: false });
      }
      for (let k = 0; k < 22; k++) {
        const x = K.R(-36, 36), z = K.R(-68, 26), h = K.R(1.5, 3.5);
        K.mesh(spikeGeo(), K.C.rock2, x, 12 - h / 2, z, { scale: [h * 0.35, h, h * 0.35], rx: Math.PI });
      }
      for (const s of [-1, 1]) K.box(s * 8.8, -71, 1.4, 12, 1.4, HR, { collide: false });
      K.box(0, -71, 18, 2, 1.6, HR, { y: 10, collide: false });
      for (const s of [-1, 1]) K.box(s * 8.4, -70.1, 0.35, 10, 0.35, GREEN, { collide: false, glow: 1.6 });
      K.light(-6, 7, -42, GREEN, 5, 26);
      K.light(0, 6, -66, GREEN, 6, 22);

      // ---- The Bridge: a long span across the chasm, widening at midspan ----
      const voids = [
        [-60, -10, -96, -72], [-60, -22, -140, -96], [-60, -10, -168, -140],
        [10, 70, -96, -72], [22, 70, -140, -96], [10, 70, -168, -140],
      ];
      for (const [x1, x2, z1, z2] of voids) {
        K.collider(x1, 0, z1, x2, 4, z2, null);                                  // nothing walks or spawns in the chasm
        K.box((x1 + x2) / 2, (z1 + z2) / 2, x2 - x1, 0.3, z2 - z1, VOID, { collide: false });
      }
      K.box(0, -120, 20, 0.34, 96, 0x6a6e74, { collide: false });
      K.box(0, -118, 44, 0.34, 44, 0x6a6e74, { collide: false });
      for (let z = -76; z > -166; z -= 6) K.box(0, z, 20, 0.36, 0.35, HR2, { collide: false });
      K.mesh(flat(new THREE.RingGeometry(6.2, 6.8, 24)), GREEN, 0, 0.37, -118, { glow: 0.8 });
      // parapets with bone spikes
      const para = (x, z, w, d) => K.box(x, z, w, 1.0, d, HR, { collide: false });
      for (const s of [-1, 1]) {
        para(s * 10.3, -84, 0.6, 24); para(s * 10.3, -153, 0.6, 26);
        para(s * 22.3, -118, 0.6, 44);
        para(s * 16.3, -96.3, 12.6, 0.6); para(s * 16.3, -139.7, 12.6, 0.6);
        for (let z = -78; z > -165; z -= 7) { const x = z < -96 && z > -140 ? s * 22.3 : s * 10.3; boneSpike(K, x, z, 1.8, { y: 1.0, rz: s * 0.35, rx: 0 }); }
        spire(K, s * 23, -96, 1.4, 16, { pinnacles: false });
        spire(K, s * 23, -140, 1.4, 16, { pinnacles: false });
      }
      // the chasm: towering spires rising out of the dark either side
      for (const [x, z, r, h] of [[-34, -80, 3, 34], [-46, -110, 4, 44], [-36, -156, 3, 36], [-52, -136, 2.6, 28], [38, -84, 3, 36], [50, -118, 4.2, 46], [40, -158, 3, 34], [60, -96, 2.6, 30]]) spire(K, x, z, r, h, { collide: false });
      // cover on the span
      for (const [x, z, h] of [[-9, -108, 3], [10, -110, 5], [-15, -125, 2.4], [15, -128, 3.5], [0, -133, 2.2], [-4, -88, 2.4], [5, -152, 3]]) broken(K, x, z, h);
      K.box(-6, -122, 1, 1.4, 5, HR2);
      K.box(7, -118, 1, 1.4, 4, HR2);

      // ---- Deathsinger's Ward: crystal-lit roofed chamber ----
      K.room(0, -190, 46, 44, 11, { t: 1.4, doors: { s: 12, n: 10 }, doorOffset: { n: 12 }, roof: true, color: HR2, roofColor: CHIT });
      for (const s of [-1, 1]) for (let z = -172; z > -210; z -= 5) K.box(s * 22.4, z, 0.8, 11, 0.9, HR, { collide: false });
      for (const [x, z, sz] of [[-19, -173, 1.6], [19, -173, 1.4], [-19.5, -190, 1.8], [19.5, -192, 1.7], [-18, -208, 1.5], [-4, -209, 1.3], [-8, -173, 1.0]]) crystals(K, x, z, sz, { color: WARD, n: 5, glow: 1.4 });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + 0.5, x = Math.sin(a) * 11, z = -190 + Math.cos(a) * 11;
        K.mesh(crystalGeo(), WARD, x, 3.2, z, { scale: [0.8, 3.4, 0.8], glow: 1.6, collide: 0.8 });
        K.cyl(x, z, 1.3, 0.6, HR, { sides: 6, collide: false });
      }
      K.mesh(flat(new THREE.RingGeometry(5.4, 6.0, 30)), WARD, 0, 0.3, -190, { glow: 1.0 });
      K.mesh(flat(new THREE.RingGeometry(2.2, 2.5, 20)), WARD, 0, 0.31, -190, { glow: 1.0 });
      K.light(0, 9, -180, WARD, 8, 28);
      K.light(0, 9, -202, WARD, 8, 28);
      // tunnel to the throne
      K.wall(7, -212, 7, -232, 10, { t: 1, color: HR2 });
      K.wall(17, -212, 17, -232, 10, { t: 1, color: HR2 });
      K.box(12, -222, 11, 0.6, 20, CHIT, { y: 10 });
      for (let z = -214; z > -231; z -= 3) K.box(12, z, 9, 0.6, 0.7, HR, { y: 9.2, collide: false });
      for (const s of [-1, 1]) K.box(12 + s * 4.2, -222, 0.3, 0.12, 20, GREEN, { y: 0.3, collide: false, glow: 1.4 });

      // ---- Throne of Crota: vast roofed hall, green orb overhead, stepped dais ----
      K.room(30, -262, 64, 60, 18, { t: 2, doors: { s: 10 }, doorOffset: { s: -18 }, roof: true, color: HR2, roofColor: CHIT });
      for (const z of [-240, -252, -264, -276, -288]) for (const x of [4, 56]) {
        K.box(x, z, 3, 18, 3, HR);
        K.box(x, z, 4.2, 1.4, 4.2, HR2, { collide: false });
        boneSpike(K, x + (x < 30 ? 1.6 : -1.6), z, 3, { y: 15, rz: x < 30 ? -0.6 : 0.6, rx: 0 });
      }
      for (let z = -236; z > -292; z -= 8) K.box(30, z, 62, 1.2, 1.2, HR, { y: 16.6, collide: false });
      // the orb (no collider) on chains
      K.mesh(new THREE.IcosahedronGeometry(4.5, 1), GREEN, 30, 11.5, -262, { glow: 1.8 });
      K.mesh(new THREE.TorusGeometry(6.5, 0.3, 4, 24), HR, 30, 11.5, -262, { rx: Math.PI / 2 + 0.25 });
      for (const [dx, dz] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) K.box(30 + dx, -262 + dz, 0.25, 3.5, 0.25, CHIT, { y: 14.5, collide: false });
      // stepped dais and throne
      K.platform(30, -282, 24, 12, 1.2, { stairs: ['s'], color: HR2, stairColor: HR, stairW: 10 });
      K.platform(30, -285, 12, 6, 1.2, { y: 1.2, stairs: ['s'], color: HR, stairColor: HR2, stairW: 6 });
      K.box(30, -286, 4, 1.2, 3, HR2, { y: 2.4 });
      K.box(30, -287.8, 4.4, 8, 1, HR2, { y: 2.4 });
      for (const dx of [-1.8, 0, 1.8]) K.mesh(spikeGeo(), BONE, 30 + dx, 11.4 + (dx ? 0 : 1), -287.8, { scale: [0.5, dx ? 3 : 4.2, 0.5] });
      K.mesh(crystalGeo(), GREEN, 30, 8, -287.2, { scale: [0.6, 1.1, 0.3], glow: 2 });
      spire(K, 18, -290, 2, 16, { pinnacles: false });
      spire(K, 42, -290, 2, 16, { pinnacles: false });
      brazier(K, 19, -277, 1.3, 1.2);
      brazier(K, 41, -277, 1.3, 1.2);
      // cover
      for (const [x, z, h] of [[18, -254, 3], [43, -256, 5], [30, -247, 2.4], [16, -268, 6], [44, -268, 2.6]]) broken(K, x, z, h);
      crystals(K, 8, -236, 1.2);
      crystals(K, 52, -236, 1.2);
      K.light(30, 10, -262, GREEN, 14, 50);
      K.light(30, 6, -282, GREEN, 8, 24);

      hiveEdge(K, 50, 0.5, 70);
    },
  },
};
