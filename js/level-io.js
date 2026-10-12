// Hand-built Io mission maps (see makeKit in world.js).
// Io under the Red Legion: cracked sulfur plains with teal pools and geysers, white mineral spires,
// rust-rock canyons, the Rupture where the Traveler touched the ground, Cabal bulwarks, landing pads
// and drill rigs over Golden Age research domes, and the black Vex Pyramidion buried in the crust.
import * as THREE from 'three';

// sulfur, mineral and Light tones
const SPIRE = 0xf0ead6, SPIRE2 = 0xd6cfb8, SULF = 0xe6cf4a, CRUST = 0xf4efdc, TEAL = 0x5ab8a8, STEAM = 0xf6f2e4;
const CRACK = 0xff6a24, SCAR = 0x3a2014, LIGHTG = 0xffe9a8, TAKEN = 0x07070b, TAKENG = 0xbcd4ff;
// Red Legion armour and hazard lights
const CAB = 0x6e564a, CAB2 = 0x4c3c34, CAB3 = 0x33292a, HAZ = 0xff8a1a, HAZR = 0xff4a1c, LEGION = 0x9a2a1e;
// Golden Age research base
const CONC = 0xc4beb0, CONC2 = 0xa39d8f, RUST = 0x8a4a2a, WIN = 0xffd890, STEEL = 0x5e5a56;
// dig site and Vex
const DIRT = 0x8a6a40, DIRT2 = 0x6e5234, DIRT3 = 0x54402c, FLOOD = 0xf0f4ff;
const VW = 0xe8e4d8, VW2 = 0xcdc7b6, VB = 0xb08a46, VBR = 0x6e4c2a, VD = 0x1a181c, MILK = 0xeef2ff, VRED = 0xff2a22;

let _ub = null;
const UB = () => _ub || (_ub = new THREE.BoxGeometry(1, 1, 1));

// visual-only box (centered at y), any rotation, no collider
function vbox(K, x, y, z, w, h, d, color, o = {}) {
  return K.mesh(UB(), color, x, y, z, { rx: o.rx, ry: o.ry, rz: o.rz, scale: [w, h, d], glow: o.glow });
}
// thin flat slab lying on the ground (decals: cracks, channels, markings)
function flat(K, x, z, w, d, color, o = {}) {
  return vbox(K, x, o.y ?? 0.03, z, w, o.h ?? 0.05, d, color, { ry: o.ry, glow: o.glow });
}
// flat strip from (x1, z1) to (x2, z2)
function strip(K, x1, z1, x2, z2, w, color, o = {}) {
  const dx = x2 - x1, dz = z2 - z1;
  return flat(K, (x1 + x2) / 2, (z1 + z2) / 2, Math.hypot(dx, dz) + (o.ext ?? 0.5), w, color, { y: o.y, ry: Math.atan2(-dz, dx), glow: o.glow });
}
// jagged polyline of strips
function crack(K, pts, w, color, o = {}) {
  for (let i = 1; i < pts.length; i++) strip(K, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w * K.R(0.8, 1.15), color, o);
}
// translucent effect mesh (steam, light beams, gate film); no collider
const _fx = {};
function ghost(K, geo, color, opacity, x, y, z) {
  const key = color + '|' + opacity;
  const m = _fx[key] || (_fx[key] = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  K.scene.add(mesh);
  return mesh;
}
// several boxes as one rotated group (ship hulls). parts: [w, h, d, px, py, pz, color, { rx, ry, rz, glow }]
function group(K, parts, x, y, z, rot = {}) {
  const g = new THREE.Group();
  for (const [w, h, d, px, py, pz, color, o] of parts) {
    const m = new THREE.Mesh(UB(), K.mat(color, o?.glow));
    m.scale.set(w, h, d);
    m.position.set(px, py, pz);
    if (o) m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  g.position.set(x, y, z);
  g.rotation.set(rot.rx ?? 0, rot.ry ?? 0, rot.rz ?? 0);
  K.scene.add(g);
  g.updateMatrixWorld(true);
  return g;
}
// solid runs of a line of length len with gaps [[from, to], ...]
function runs(len, gaps = []) {
  const out = [];
  let from = 0;
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0]).concat([[len, len]])) {
    if (a - from > 0.3) out.push([from, a]);
    from = Math.max(from, b);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Io natural features
// ---------------------------------------------------------------------------
// white mineral spire with a leaning side shard and a crust collar
function spire(K, x, z, h, o = {}) {
  const r = o.r ?? h * 0.15, y = o.y ?? 0, col = o.collide ?? true;
  K.cone(x, z, r, h, SPIRE, { sides: 5, y, collide: col });
  K.mesh(new THREE.ConeGeometry(r * 0.5, h * 0.5, 5), SPIRE2, x + r * 0.75, y + h * 0.22, z + r * 0.3, { rz: -0.32, rx: 0.12 });
  K.mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.6, 0.6, 6), K.C.ground2, x, y + 0.2, z);
}
// teal sulfur pool with a white mineral rim (visual only, enemies wade through)
function pool(K, x, z, r) {
  K.mesh(new THREE.CylinderGeometry(r, r, 0.08, 12), TEAL, x, 0.04, z, { glow: 0.45 });
  K.mesh(new THREE.TorusGeometry(r + 0.25, 0.35, 4, 14).rotateX(Math.PI / 2), CRUST, x, 0.08, z);
}
// geyser: pool, crusted vent cone and a steam column
function geyser(K, x, z, r, h) {
  pool(K, x, z, r);
  K.cone(x, z, 1.5, 1.3, CRUST, { sides: 7 });
  ghost(K, new THREE.CylinderGeometry(2.2, 0.7, h, 8, 1, true), STEAM, 0.22, x, 1.2 + h / 2, z);
  ghost(K, new THREE.CylinderGeometry(1.1, 0.4, h * 0.6, 7, 1, true), STEAM, 0.3, x, 1.2 + h * 0.3, z);
}
// low rounded sulfur mound (shrunk collider)
function mound(K, x, z, w, d, h) {
  K.mesh(new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2), SULF, x, 0, z, { scale: [w, h, d], collide: 0.7 });
}
// rust-rock column (canyon rims, mesas)
function cliff(K, x, z, r, h, o = {}) {
  return K.cyl(x, z, r, h, o.color ?? K.RP([K.C.rock, K.C.rock2]), { r2: r * (o.taper ?? 0.72), sides: 7, y: o.y, collide: o.collide });
}
// flat-topped mesa plateau with strata and a sulfur stain band
function mesa(K, x, z, w, d, h) {
  K.box(x, z, w, h, d, K.C.rock);
  K.box(x + K.R(-1.5, 1.5), z + K.R(-1.5, 1.5), w * 0.68, h * 0.28, d * 0.68, K.C.rock2, { y: h });
  vbox(K, x, h * 0.42, z, w + 0.4, 0.9, d + 0.4, K.C.rock2);
  vbox(K, x, h * 0.78, z, w + 0.2, 0.5, d + 0.2, SULF);
}
// floating Taken blight: black blob with a pale glowing halo
function blight(K, x, y, z, s) {
  K.mesh(new THREE.IcosahedronGeometry(s, 0), TAKEN, x, y, z, { ry: K.R(0, 6), rx: K.R(0, 1) });
  K.mesh(new THREE.TorusGeometry(s * 1.35, 0.12, 4, 14), TAKENG, x, y, z, { rx: K.R(1.2, 1.9), ry: K.R(0, 3), glow: 1.4 });
}

// ---------------------------------------------------------------------------
// Red Legion kit
// ---------------------------------------------------------------------------
// Cabal bulwark: heavy lower block, set-back upper block, sloped armour plate on the face side,
// ribs and a hazard strip. face = +1 faces +z (or +x for a wall running along z).
function bulwark(K, x1, z1, x2, z2, h, o = {}) {
  const horiz = Math.abs(x2 - x1) >= Math.abs(z2 - z1);
  const t = o.t ?? 3, face = o.face ?? 1;
  const start = horiz ? Math.min(x1, x2) : Math.min(z1, z2), fixed = horiz ? z1 : x1;
  const len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const B = (along, across, L, hh, tt, color, y) => (horiz
    ? K.box(along, fixed + across, L, hh, tt, color, { y })
    : K.box(fixed + across, along, tt, hh, L, color, { y }));
  const V = (along, across, y, L, hh, tt, color, op = {}) => (horiz
    ? vbox(K, along, y, fixed + across, L, hh, tt, color, op)
    : vbox(K, fixed + across, y, along, tt, hh, L, color, op));
  for (const [a, b] of runs(len, o.gaps)) {
    const L = b - a, mid = start + (a + b) / 2;
    B(mid, 0, L, h * 0.45, t, CAB2, 0);
    B(mid, -face * t * 0.2, L, h * 0.55, t * 0.55, CAB, h * 0.45);
    V(mid, face * (t * 0.5 + 0.3), h * 0.32, L, h * 0.68, 0.5, CAB, horiz ? { rx: -face * 0.36 } : { rz: face * 0.36 });
    V(mid, -face * t * 0.2, h + 0.15, L + 0.2, 0.3, t * 0.62, CAB3);
    V(mid, face * (t * 0.075 + 0.08), h * 0.8, L * 0.98, 0.35, 0.1, HAZ, { glow: 1.4 });
    for (let s = a + 4; s < b - 2; s += 8) V(start + s, face * (t * 0.5 + 0.7), h * 0.38, 1.2, h * 0.76, 0.6, CAB3);
    if (o.banners) for (let s = a + 8; s < b - 4; s += 16) V(start + s, face * (t * 0.075 + 0.12), h * 0.62, 1.8, h * 0.4, 0.1, LEGION);
  }
}
// hazard lamp post
function hazardPost(K, x, z, h = 4) {
  K.box(x, z, 0.5, h, 0.5, CAB3);
  vbox(K, x, h + 0.3, z, 0.7, 0.6, 0.7, HAZ, { glow: 2 });
  vbox(K, x, 0.3, z, 1.2, 0.6, 1.2, CAB2);
}
// low Cabal barrier with a hazard stripe (cover)
function barricade(K, x, z, rot = false) {
  const w = rot ? 1.2 : 4.6, d = rot ? 4.6 : 1.2;
  K.box(x, z, w, 1.5, d, CAB2);
  vbox(K, x, 1.6, z, w * 0.9, 0.3, d * 0.9, CAB3);
  vbox(K, x, 1.0, z, w + 0.06, 0.22, d + 0.06, HAZ, { glow: 1 });
}
// stacked Cabal supply containers
function supply(K, x, z, rot = false) {
  const w = rot ? 1.8 : 2.6, d = rot ? 2.6 : 1.8;
  K.box(x, z, w, 1.6, d, CAB2);
  vbox(K, x, 0.8, z, w + 0.06, 0.2, d + 0.06, HAZ, { glow: 0.9 });
  if (K.chance(0.5)) K.box(x + K.R(-0.3, 0.3), z + K.R(-0.3, 0.3), w * 0.8, 1.3, d * 0.8, CAB, { y: 1.6 });
}
// parked Cabal dropship hull (nose toward -z), visual only; caller adds the collider
function dropship(K, x, y, z, L) {
  const W = L * 0.36, H = L * 0.22;
  vbox(K, x, y + H * 0.55, z, W, H, L * 0.72, CAB2);
  vbox(K, x, y + H * 1.2, z + L * 0.05, W * 0.55, H * 0.45, L * 0.55, CAB);
  vbox(K, x, y + H * 0.5, z - L * 0.44, W * 0.8, H * 0.75, L * 0.28, CAB, { rx: 0.42 });
  for (const s of [-1, 1]) {
    vbox(K, x + s * W * 0.64, y + H * 0.55, z + L * 0.05, W * 0.34, H * 0.9, L * 0.64, CAB3);
    vbox(K, x + s * W * 1.05, y + H * 0.85, z + L * 0.2, W * 0.9, 0.5, L * 0.2, CAB, { rz: s * -0.2 });
    vbox(K, x + s * W * 0.3, y + H * 0.1, z + s * L * 0.25, 0.6, H * 0.5, 0.6, CAB3);
    vbox(K, x + s * W * 0.25, y + H * 0.55, z + L * 0.37, W * 0.24, H * 0.35, 0.3, HAZ, { glow: 1.8 });
  }
  vbox(K, x, y + H * 1.0, z - L * 0.15, W + 0.1, 0.3, L * 0.08, HAZ, { glow: 1 });
  vbox(K, x, y + H * 0.4, z + L * 0.42, W * 0.9, H * 0.8, L * 0.1, CAB3);
}
// hovering Thresher gunship
function thresher(K, x, y, z, ry = 0, L = 14) {
  group(K, [
    [L * 0.3, L * 0.18, L, 0, 0, 0, CAB2],
    [L * 0.22, L * 0.14, L * 0.32, 0, -L * 0.02, -L * 0.6, CAB, { rx: 0.35 }],
    [L * 0.6, L * 0.05, L * 0.5, L * 0.42, -L * 0.06, L * 0.1, CAB3, { rz: -0.35 }],
    [L * 0.6, L * 0.05, L * 0.5, -L * 0.42, -L * 0.06, L * 0.1, CAB3, { rz: 0.35 }],
    [L * 0.05, L * 0.22, L * 0.25, 0, L * 0.15, L * 0.38, CAB],
    [L * 0.2, L * 0.08, 0.3, 0, 0, L * 0.51, HAZ, { glow: 2 }],
    [L * 0.1, L * 0.05, 0.3, 0, -L * 0.05, -L * 0.76, HAZR, { glow: 2 }],
  ], x, y, z, { ry });
}
// raised Cabal landing platform with hazard markings and corner lamps
function landing(K, x, z, w, d, h, stairs) {
  K.platform(x, z, w, d, h, { stairs, color: CAB2, stairColor: CAB3, stairW: 3 });
  const y = h + 0.03;
  vbox(K, x, h * 0.75, z, w + 0.1, 0.3, d + 0.1, HAZ, { glow: 0.9 });
  const iw = w * 0.36, id = d * 0.36;
  for (const [dx, dz, ww, dd] of [[0, -id, iw * 2, 0.35], [0, id, iw * 2, 0.35], [-iw, 0, 0.35, id * 2], [iw, 0, 0.35, id * 2]]) vbox(K, x + dx, y, z + dz, ww, 0.06, dd, HAZ, { glow: 1.1 });
  vbox(K, x, y, z, 0.6, 0.06, d * 0.4, HAZ, { glow: 0.8 });
  vbox(K, x, y, z, w * 0.4, 0.06, 0.6, HAZ, { glow: 0.8 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    vbox(K, x + sx * (w / 2 - 0.5), h + 0.6, z + sz * (d / 2 - 0.5), 0.5, 1.2, 0.5, CAB3);
    vbox(K, x + sx * (w / 2 - 0.5), h + 1.35, z + sz * (d / 2 - 0.5), 0.5, 0.35, 0.5, HAZR, { glow: 2 });
  }
}
// horizontal pipe on supports. along 'x' or 'z' from a to b at the fixed coordinate c
function pipe(K, along, a, b, c, y, r, step = 8) {
  const L = Math.abs(b - a), mid = (a + b) / 2;
  const geo = new THREE.CylinderGeometry(r, r, L, 8).rotateZ(Math.PI / 2);
  if (along === 'z') geo.rotateY(Math.PI / 2);
  K.mesh(geo, RUST, along === 'x' ? mid : c, y, along === 'x' ? c : mid);
  for (let s = Math.min(a, b) + 2; s < Math.max(a, b) - 1; s += step) {
    const px = along === 'x' ? s : c, pz = along === 'x' ? c : s;
    K.box(px, pz, 0.6, y, 0.6, CAB3);
    vbox(K, px, y, pz, along === 'x' ? 0.4 : r * 2.6, r * 2.6, along === 'x' ? r * 2.6 : 0.4, CAB2);
  }
}
// pole scaffold with plank decks (decks are visual so they never catch enemies)
function scaffold(K, x, z, w, d, h, levels = 2) {
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) K.box(x + sx * w / 2, z + sz * d / 2, 0.3, h, 0.3, STEEL);
  for (let i = 1; i <= levels; i++) {
    const y = (h * i) / levels;
    vbox(K, x, y - 0.15, z, w + 0.4, 0.25, d + 0.4, CAB, {});
    vbox(K, x, y + 0.6, z + d / 2, w, 0.12, 0.12, HAZ, { glow: 0.6 });
    vbox(K, x - w / 4, y - h / levels / 2, z + d / 2 + 0.05, w / 2 * 1.1, 0.15, 0.15, STEEL, { rz: Math.atan2(h / levels, w / 2) });
  }
}

// ---------------------------------------------------------------------------
// Golden Age research base
// ---------------------------------------------------------------------------
function dome(K, x, z, r) {
  K.mesh(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), CONC, x, 0, z, { collide: 0.74 });
  K.mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.05, 0.8, 12), CONC2, x, 0.4, z);
  K.mesh(new THREE.TorusGeometry(r * 0.7, 0.2, 4, 16).rotateX(Math.PI / 2), RUST, x, r * 0.714, z);
  K.box(x, z + r * 0.92, r * 0.42, r * 0.42, 1.6, CONC2);
  vbox(K, x, r * 0.17, z + r * 0.92 + 0.82, r * 0.24, r * 0.3, 0.1, 0x1c1a18);
  vbox(K, x + r * 0.2, r + 1.2, z, 0.18, 2.6, 0.18, STEEL);
  vbox(K, x + r * 0.2, r + 2.6, z, 0.3, 0.3, 0.3, HAZR, { glow: 2 });
}
// lattice radio mast with crossbars, dish and a red tip
function antenna(K, x, z, h) {
  K.box(x, z, 4, 1, 4, CONC2);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) vbox(K, x + sx * 0.9, 1 + h / 2, z + sz * 0.9, 0.22, h, 0.22, STEEL);
  for (let y = 3; y < h - 1; y += 3) {
    const alt = Math.round(y / 3) % 2;
    vbox(K, x, 1 + y, z + (alt ? 0.9 : -0.9), 2, 0.14, 0.14, STEEL);
    vbox(K, x + (alt ? 0.9 : -0.9), 1 + y, z, 0.14, 0.14, 2, STEEL);
    vbox(K, x, y - 0.5, z + (alt ? -0.9 : 0.9), 0.12, 3.4, 0.12, STEEL, { rz: alt ? 0.55 : -0.55 });
  }
  K.mesh(new THREE.ConeGeometry(2.2, 0.9, 10), CONC, x + 1.6, h * 0.7, z, { rz: 1.25 });
  K.mesh(new THREE.ConeGeometry(1.4, 0.6, 10), CONC, x - 1.2, h * 0.5, z + 0.4, { rz: -1.25 });
  vbox(K, x, 1 + h + 1.5, z, 0.16, 3, 0.16, STEEL);
  vbox(K, x, 1 + h + 3.1, z, 0.5, 0.5, 0.5, HAZR, { glow: 2.6 });
  K.collider(x - 1.1, 0, z - 1.1, x + 1.1, h + 1, z + 1.1, null);
}
// concrete hab block with lit window bands, roof units and a door slot
function hab(K, x, z, w, d, h) {
  K.box(x, z, w, h, d, K.RP([CONC, CONC2]));
  for (let y = 1.6; y < h - 0.8; y += 2.4) vbox(K, x, y, z, w + 0.08, 0.5, d * 0.8, WIN, { glow: 0.55 });
  vbox(K, x, h * 0.45, z, w * 0.75, 0.3, d + 0.08, RUST);
  K.box(x + w * 0.15, z - d * 0.2, w * 0.4, 1.2, d * 0.3, STEEL, { y: h, collide: false });
  vbox(K, x - w * 0.25, h + 0.4, z + d * 0.25, 0.8, 0.8, 0.8, CONC2);
  vbox(K, x, 1.2, z + d / 2 + 0.05, w * 0.3, 2.4, 0.1, 0x1c1a18);
}

// ---------------------------------------------------------------------------
// Excavation and Vex kit
// ---------------------------------------------------------------------------
// floodlight on a pole aimed by ry
function floodlight(K, x, z, h, ry) {
  K.box(x, z, 0.5, h, 0.5, STEEL);
  vbox(K, x, 0.3, z, 1.6, 0.6, 1.6, CAB3);
  vbox(K, x, h + 0.2, z, 2.6, 0.3, 0.3, STEEL, { ry });
  for (const s of [-0.8, 0.8]) vbox(K, x + Math.cos(ry) * s, h + 0.7, z - Math.sin(ry) * s, 1.0, 0.8, 0.5, FLOOD, { ry, rx: 0.35, glow: 2.2 });
}
// lattice tower crane: mast, jib toward angle a (0 = +x, PI/2 = -z), counter-jib, cab and hook
function crane(K, x, z, h, jib, a) {
  K.box(x, z, 2.2, h, 2.2, CAB3);
  for (let y = 2; y < h; y += 2.5) vbox(K, x, y, z, 2.6, 0.2, 2.6, HAZ, { glow: y % 5 < 2.5 ? 0.5 : 0 });
  const cx = Math.cos(a), cz = -Math.sin(a);
  vbox(K, x + cx * jib / 2, h + 0.8, z + cz * jib / 2, jib, 1.2, 1.2, CAB2, { ry: a });
  vbox(K, x - cx * 5, h + 0.8, z - cz * 5, 10, 1.0, 1.4, CAB2, { ry: a });
  vbox(K, x - cx * 8.5, h - 0.4, z - cz * 8.5, 3, 2.4, 2.4, CAB, { ry: a });
  vbox(K, x, h + 4, z, 0.6, 6.4, 0.6, CAB3);
  vbox(K, x + cx * 1.6, h - 1, z + cz * 1.6, 2.2, 2, 2.2, CAB, { ry: a });
  const hx = x + cx * jib * 0.8, hz = z + cz * jib * 0.8;
  vbox(K, hx, (h + 7) / 2, hz, 0.12, h - 7, 0.12, STEEL);
  vbox(K, hx, 7, hz, 1.2, 1.4, 1.2, HAZ, { glow: 0.8 });
  vbox(K, x + cx * jib, h + 1.6, z + cz * jib, 0.4, 0.4, 0.4, HAZR, { glow: 2.4 });
}
// Vex pillar: bronze plinth, white column, brass bands, milky slits, red eye
function vexPillar(K, x, z, h, o = {}) {
  const w = o.w ?? 1.8, eye = o.eye ?? true;
  K.box(x, z, w * 1.45, 1, w * 1.45, VBR);
  K.box(x, z, w, h - 1, w, VW, { y: 1 });
  for (const f of [0.35, 0.7]) vbox(K, x, h * f, z, w * 1.12, 0.45, w * 1.12, VB);
  vbox(K, x, h * 0.55, z, w + 0.06, h * 0.5, 0.25, MILK, { glow: 1.2 });
  vbox(K, x, h * 0.55, z, 0.25, h * 0.5, w + 0.06, MILK, { glow: 1.2 });
  vbox(K, x, h - 0.3, z, w * 1.35, 0.6, w * 1.35, VB);
  if (eye) vbox(K, x, h * 0.86, z, w * 0.3, w * 0.3, w + 0.1, VRED, { glow: 2.4 });
}
// Vex cube block (optionally floating, no collider when floating)
function vexCube(K, x, y, z, s, o = {}) {
  if (y < 0.5 && o.collide !== false) K.box(x, z, s, s, s, o.color ?? VW, { y });
  else vbox(K, x, y + s / 2, z, s, s, s, o.color ?? VW, { ry: o.ry ?? 0 });
  vbox(K, x, y + s * 0.5, z, s + 0.06, s * 0.12, s + 0.06, MILK, { glow: 1.3, ry: y < 0.5 ? 0 : o.ry ?? 0 });
}
// Vex gate ring on a wall, facing ry (0 = +z)
function vexGate(K, x, y, z, r, ry) {
  K.mesh(new THREE.TorusGeometry(r, 0.55, 6, 20), VB, x, y, z, { ry });
  K.mesh(new THREE.TorusGeometry(r * 0.86, 0.22, 4, 20), VW, x, y, z, { ry });
  K.mesh(new THREE.CircleGeometry(r * 0.8, 20), MILK, x + Math.sin(ry) * 0.05, y, z + Math.cos(ry) * 0.05, { ry, glow: 1.1 });
  vbox(K, x + Math.sin(ry) * 0.3, y + r + 0.9, z + Math.cos(ry) * 0.3, 0.7, 0.7, 0.5, VRED, { ry, glow: 2.4 });
  vbox(K, x, y - r - 1.2, z, r * 1.2, 1.4, 0.8, VBR, { ry });
}

export default {
  // -------------------------------------------------------------------------
  // Sacred Ground: open sulfur plain with pools and geysers -> Giant's Scar canyon
  // under rock ribs -> the Rupture, a ring of rim rock around the Traveler's fissure.
  // -------------------------------------------------------------------------
  io1: {
    spawn: [0, 18],
    bounds: [-80, 80, -230, 30],
    zones: [
      { name: 'Lost Oasis', x: -8, z: -42 },
      { name: "Giant's Scar", x: 6, z: -112 },
      { name: 'The Rupture', x: 0, z: -188, boss: true },
    ],
    noEdge: false,
    build(K) {
      const { R, C } = K;

      // ---- Lost Oasis: open plain, teal pools, steaming geysers, scattered white spires ----
      for (const [x, z, r] of [[8, -56, 4], [14, -27, 3.5], [-4, -10, 3], [-56, -58, 4], [30, -64, 3], [-14, -60, 2.5], [58, -36, 4.5], [-28, 2, 3.5]]) pool(K, x, z, r);
      for (const [x, z, r, h] of [[-24, -30, 5, 22], [32, -46, 5, 16], [-30, -62, 6, 26], [-46, -20, 4, 14], [42, -8, 3.5, 18]]) geyser(K, x, z, r, h);
      for (const [x, z, h] of [[-20, -50, 10], [4, -27, 7], [18, -46, 12], [-36, -40, 16], [-15, -22, 6], [22, -60, 9], [-2, -62, 8], [46, -28, 18], [-58, -44, 20], [60, -60, 14], [-62, -6, 12], [30, 6, 10], [-34, 10, 8], [66, -16, 22], [-68, -64, 18], [10, -4, 5]]) spire(K, x, z, h);
      for (const [x, z, w, d, h] of [[-44, 0, 8, 5, 1.6], [24, -18, 6, 5, 1.2], [52, -50, 9, 7, 2], [-48, -64, 7, 6, 1.8], [-20, -8, 9, 6, 1.4], [62, 10, 8, 6, 1.5]]) mound(K, x, z, w, d, h);
      // dark cracks across the crust
      crack(K, [[-60, -30], [-44, -34], [-30, -46], [-20, -44], [-8, -54]], 0.5, C.rock2, { y: 0.02 });
      crack(K, [[20, 0], [24, -12], [36, -20], [50, -24], [70, -22]], 0.5, C.rock2, { y: 0.02 });
      crack(K, [[-6, -70], [0, -64], [6, -48], [2, -34]], 0.4, C.rock2, { y: 0.02 });
      K.scatter((x, z) => K.rock(x, z, R(1.4, 3.2)), -8, -42, 22, 44, 10, 3);
      K.scatter(K.prop, -8, -42, 26, 50, 6, 4);
      K.light(-24, 2, -30, 0x7ae8d4, 7, 22);

      // ---- Giant's Scar: canyon between towering rust cliffs, rock ribs overhead ----
      for (let z = -76; z > -150; z -= 6) {
        const flare = z > -84 || z < -142 ? 5 : 0;
        const w1 = -15 - R(0, 2.5) - flare, e1 = 27 + R(0, 2.5) + flare;
        K.box((-80 + w1) / 2, z - 3, w1 + 80, R(16, 27), 6.2, K.RP([C.rock, C.rock2]));
        K.box((80 + e1) / 2, z - 3, 80 - e1, R(16, 27), 6.2, K.RP([C.rock, C.rock2]));
        vbox(K, w1 + 0.3, R(4, 11), z - 3, 1, R(1, 2), 6.4, K.RP([C.rock2, SULF]));
        vbox(K, e1 - 0.3, R(4, 11), z - 3, 1, R(1, 2), 6.4, K.RP([C.rock2, SULF]));
      }
      // slanted rock ribs spanning the canyon high overhead (no colliders)
      for (const z of [-86, -99, -113, -127, -140]) vbox(K, 6 + R(-3, 3), R(18, 23), z, 56, R(2.2, 3.4), R(3, 5.5), K.RP([C.rock, C.rock2]), { rz: R(-0.2, 0.2), ry: R(-0.22, 0.22), rx: R(-0.2, 0.2) });
      // fallen slabs leaning on the walls (tight base colliders)
      vbox(K, -11.5, 5.2, -104, 2.2, 12, 8, C.rock, { rz: 0.4 });
      K.collider(-13, 0, -108, -9.4, 5, -100, null);
      vbox(K, 23.5, 5.2, -124, 2.2, 12, 8, C.rock2, { rz: -0.4 });
      K.collider(21.4, 0, -128, 25, 5, -120, null);
      for (const [x, z, s] of [[-8, -94, 2.6], [18, -130, 3], [-6, -134, 2.2], [20, -92, 2.2], [14, -100, 1.6]]) K.rock(x, z, s);
      spire(K, -10, -122, 9); spire(K, 22, -106, 7); spire(K, -9, -84, 6);
      // the glowing crack along the canyon floor
      const scarPts = [[4, -70], [0, -84], [9, -94], [3, -106], [11, -118], [5, -130], [12, -142], [6, -156]];
      crack(K, scarPts, 2.8, SCAR, { y: 0.02 });
      crack(K, scarPts, 1.2, CRACK, { y: 0.04, glow: 1.6 });
      crack(K, [[9, -94], [16, -98], [20, -96]], 0.6, CRACK, { y: 0.04, glow: 1.4 });
      K.light(6, 1.5, -112, CRACK, 8, 30);

      // ---- The Rupture: ring of rim rock around the Traveler's fissure ----
      const BX = 0, BZ = -188;
      for (let a = 0; a < 360; a += 11) {
        if (a < 30 || a > 330) continue; // the way in from the canyon
        const r = R(27, 30), rad = (a * Math.PI) / 180;
        cliff(K, BX + Math.sin(rad) * r, BZ + Math.cos(rad) * r, R(4.8, 6), R(10, 22), { taper: 0.6 });
        if (a % 22 === 0) cliff(K, BX + Math.sin(rad) * (r + 8), BZ + Math.cos(rad) * (r + 8), R(5, 8), R(18, 30), { taper: 0.5, collide: false });
      }
      // white crystal spires around the rim, a few shards as cover
      for (let a = 45; a < 330; a += 30) {
        const rad = (a * Math.PI) / 180;
        spire(K, BX + Math.sin(rad) * 21, BZ + Math.cos(rad) * 21, R(9, 18), { r: 1.6 });
      }
      for (const a of [40, 140, 220, 320]) {
        const rad = (a * Math.PI) / 180;
        spire(K, BX + Math.sin(rad) * 13.5, BZ + Math.cos(rad) * 13.5, R(4.5, 6.5), { r: 1.1 });
        K.rock(BX + Math.sin(rad) * 15.5, BZ + Math.cos(rad) * 15.5, 1.6);
      }
      // the fissure: dark scorched rift with a white-gold Light core, all flat (enemies still walk)
      const rift = [[-26, -176], [-16, -181], [-7, -184], [0, -188], [7, -192], [16, -197], [26, -202]];
      crack(K, rift, 9, SCAR, { y: 0.02 });
      crack(K, rift, 4.5, LIGHTG, { y: 0.045, glow: 1.8 });
      crack(K, [[0, -188], [-3, -197], [-9, -206]], 2, LIGHTG, { y: 0.045, glow: 1.6 });
      crack(K, [[0, -188], [4, -179], [2, -168]], 2, LIGHTG, { y: 0.045, glow: 1.6 });
      crack(K, [[-16, -181], [-20, -192], [-19, -200]], 1, LIGHTG, { y: 0.045, glow: 1.3 });
      crack(K, [[16, -197], [20, -186], [18, -176]], 1, LIGHTG, { y: 0.045, glow: 1.3 });
      for (const [x, z] of [[-11, -178], [9, -199], [-5, -193], [6, -183], [-20, -184], [20, -193]]) vbox(K, x, 0.2, z, R(1.5, 2.6), 0.4, R(1, 2), C.rock2, { ry: R(0, 3), rx: R(-0.3, 0.3) });
      ghost(K, new THREE.CylinderGeometry(2.6, 4.2, 90, 10, 1, true), LIGHTG, 0.12, BX, 45, BZ);
      ghost(K, new THREE.CylinderGeometry(1.2, 1.8, 90, 8, 1, true), LIGHTG, 0.18, BX, 45, BZ);
      // Taken blight: black blobs over the arena, black pools on the ground
      for (const [x, y, z, s] of [[-14, 12, -202, 3], [16, 15, -176, 2.5], [-20, 9, -170, 2], [10, 18, -206, 3.5], [22, 11, -196, 2], [-24, 16, -190, 2.6]]) blight(K, x, y, z, s);
      for (const [x, z, r] of [[-12, -200, 3.5], [14, -176, 3], [18, -204, 2.5], [-18, -172, 2.5]]) {
        K.mesh(new THREE.CylinderGeometry(r, r, 0.05, 9), TAKEN, x, 0.06, z);
        K.mesh(new THREE.TorusGeometry(r, 0.12, 3, 12).rotateX(Math.PI / 2), TAKENG, x, 0.08, z, { glow: 1.2 });
      }
      K.light(BX, 3, BZ, LIGHTG, 12, 34);
      K.light(12, 12, -200, 0x9ab4ff, 6, 22);

      // spires on the far slopes
      K.edge((x, z, y) => spire(K, x, z, R(10, 26), { y, collide: false }), 24);
    },
  },

  // -------------------------------------------------------------------------
  // Echo Mesa: Golden Age research base -> Red Legion bulwark lines between mesas ->
  // raised landing pads with a parked dropship -> the drill rig compound.
  // -------------------------------------------------------------------------
  io2: {
    spawn: [-40, 18],
    bounds: [-90, 90, -262, 30],
    zones: [
      { name: 'Terrabase Charon', x: -36, z: -36 },
      { name: 'Echo Mesa', x: 18, z: -88 },
      { name: 'Landing Pads', x: -22, z: -152 },
      { name: 'The Drill', x: 20, z: -218, boss: true },
    ],
    noEdge: false,
    build(K) {
      const { R, C } = K;

      // ---- Terrabase Charon: concrete domes, radio mast, hab blocks with alleys ----
      dome(K, -70, -38, 10); dome(K, -44, -74, 7); dome(K, -12, 6, 6); dome(K, -66, 0, 5);
      antenna(K, -62, -60, 34);
      for (const [x, z, w, d, h] of [[-19, -20, 7, 10, 6], [-19, -52, 7, 10, 5], [-53, -20, 7, 10, 6], [-53, -52, 7, 10, 5], [-19, -4, 7, 10, 7], [-54, -4, 7, 9, 6], [-5, -24, 8, 8, 5], [-5, -48, 8, 8, 4.5]]) hab(K, x, z, w, d, h);
      // catwalks over the alleys
      vbox(K, -19, 6.4, -36, 2, 0.4, 22, STEEL);
      vbox(K, -53, 6.4, -36, 2, 0.4, 22, STEEL);
      vbox(K, -12, 5.2, -24, 7, 0.4, 2, STEEL);
      // courtyard: Golden Age planters and Legion barriers
      for (const [x, z] of [[-30, -28], [-42, -44]]) { K.box(x, z, 3, 0.9, 3, CONC2); vbox(K, x, 1.4, z, 2.4, 1, 2.4, 0x6a8a5a); }
      barricade(K, -36, -24); barricade(K, -26, -44, true); barricade(K, -46, -30, true);
      supply(K, -8, -36, true); supply(K, -60, -26);
      hazardPost(K, -28, -10); hazardPost(K, -44, -62);
      vbox(K, -36, 0.03, -36, 30, 0.05, 30, CONC2);
      K.light(-36, 6, -36, WIN, 6, 26);

      // ---- Echo Mesa: Red Legion bulwark lines between rust mesas ----
      mesa(K, -30, -95, 22, 30, 12); mesa(K, 62, -92, 28, 40, 14); mesa(K, 60, -155, 30, 34, 10);
      mesa(K, -72, -104, 30, 40, 16); mesa(K, 70, -30, 24, 30, 12); mesa(K, -75, -205, 26, 50, 14);
      bulwark(K, 4, -68, 48, -68, 8, { t: 3, face: 1, gaps: [[12, 19], [28, 34]], banners: true });
      bulwark(K, -12, -108, 46, -108, 8, { t: 3, face: 1, gaps: [[12, 20], [34, 40]], banners: true });
      bulwark(K, 27, -88, 39, -88, 4.5, { t: 2, face: 1 });
      bulwark(K, -6, -86, 4, -86, 4.5, { t: 2, face: 1 });
      for (const [x, z] of [[14, -65], [25, -65], [30, -65], [40, -65], [-2, -105], [10, -105], [20, -105], [30, -105]]) hazardPost(K, x, z, 3.5);
      barricade(K, 10, -78); barricade(K, 30, -98, true); barricade(K, 6, -96, true); barricade(K, 22, -76);
      supply(K, 34, -78); supply(K, 2, -90, true);
      K.light(18, 5, -88, HAZ, 7, 26);

      // ---- Landing Pads: raised Cabal platforms, parked dropship, hovering Thresher ----
      landing(K, -50, -140, 18, 18, 3, ['e']);
      dropship(K, -50, 3, -140, 18);
      K.collider(-53.4, 3, -149, -46.6, 8, -131, null);
      landing(K, -24, -178, 16, 12, 2.4, ['s']);
      landing(K, 6, -134, 12, 12, 2, ['w']);
      // floor-level pad marking at the heart of the zone
      K.mesh(new THREE.TorusGeometry(6, 0.3, 3, 24).rotateX(Math.PI / 2), HAZ, -22, 0.05, -152, { glow: 0.8 });
      flat(K, -22, -152, 0.6, 9, HAZ, { glow: 0.7, y: 0.04 });
      flat(K, -22, -152, 9, 0.6, HAZ, { glow: 0.7, y: 0.04 });
      for (const [x, z] of [[-6, -162], [-40, -166]]) { K.cyl(x, z, 2, 4.5, STEEL, { sides: 10 }); vbox(K, x, 3.2, z, 4.1, 0.4, 4.1, HAZ, { glow: 0.8 }); }
      for (const [x, z, rot] of [[-36, -128, false], [-8, -172, true], [-4, -142, false]]) {
        K.box(x, z, rot ? 2.6 : 6, 2.6, rot ? 6 : 2.6, CAB2);
        vbox(K, x, 1.3, z, (rot ? 2.6 : 6) + 0.06, 0.25, (rot ? 6 : 2.6) + 0.06, HAZ, { glow: 0.8 });
      }
      barricade(K, -30, -146, true); barricade(K, -14, -138); supply(K, -12, -158);
      thresher(K, -6, 24, -150, 0.7);
      thresher(K, -44, 30, -176, -0.4, 11);
      K.light(-22, 6, -152, HAZ, 8, 28);

      // ---- The Drill: walled compound around a Red Legion drill rig ----
      bulwark(K, -6, -192, 46, -192, 9, { t: 3, face: -1, gaps: [[2, 18]], banners: true });
      bulwark(K, -6, -244, 46, -244, 9, { t: 3, face: 1, banners: true });
      bulwark(K, -6, -244, -6, -192, 9, { t: 3, face: 1, banners: true });
      bulwark(K, 46, -244, 46, -192, 9, { t: 3, face: -1 });
      // the rig, set off-center so the boss floor stays open
      const RX = 36, RZ = -232;
      K.box(RX, RZ, 12, 3, 12, CAB3);
      vbox(K, RX, 2.6, RZ, 12.1, 0.3, 12.1, HAZ, { glow: 1.2 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        vbox(K, RX + sx * 4.6, 3 + 16, RZ + sz * 4.6, 1.6, 32, 1.6, CAB2);
        vbox(K, RX + sx * 3.2, 9, RZ + sz * 3.2, 0.9, 13, 0.9, STEEL, { rx: sz * -0.22, rz: sx * 0.22 });
      }
      for (const y of [10, 17, 24, 31]) {
        for (const s of [-1, 1]) {
          vbox(K, RX, y, RZ + s * 4.6, 10.8, 1, 1, CAB);
          vbox(K, RX + s * 4.6, y, RZ, 1, 1, 10.8, CAB);
        }
      }
      vbox(K, RX, 17.6, RZ, 9.6, 0.4, 9.6, CAB3);
      K.mesh(new THREE.CylinderGeometry(2.1, 2.1, 28, 10), 0xff6a2a, RX, 3 + 14, RZ, { glow: 1.7 });
      for (const y of [6, 12, 20, 27]) K.mesh(new THREE.TorusGeometry(2.4, 0.4, 4, 12).rotateX(Math.PI / 2), CAB2, RX, y, RZ);
      vbox(K, RX, 37, RZ, 10, 5, 10, CAB);
      vbox(K, RX, 40.5, RZ, 7, 2, 7, CAB2, { rx: 0.15 });
      vbox(K, RX, 45, RZ, 0.7, 8, 0.7, CAB3);
      vbox(K, RX, 49.3, RZ, 0.8, 0.8, 0.8, HAZR, { glow: 2.6 });
      vbox(K, RX - 13, 35.5, RZ, 22, 1.4, 1.4, CAB2);
      vbox(K, RX - 22, 25, RZ, 0.15, 20, 0.15, STEEL);
      vbox(K, RX - 22, 15, RZ, 1.6, 1.6, 1.6, HAZ, { glow: 0.9 });
      K.mesh(new THREE.TorusGeometry(8.5, 0.35, 3, 24).rotateX(Math.PI / 2), HAZR, RX, 0.06, RZ, { glow: 1.4 });
      K.light(RX, 12, RZ, 0xff6a2a, 12, 40);
      // scaffolds and pipes
      scaffold(K, -1.5, -218, 3, 20, 8);
      scaffold(K, 30, -196.5, 12, 3, 7);
      pipe(K, 'x', 30, -4, -234, 7, 0.8);
      pipe(K, 'z', -226, -195, 40, 5.5, 0.7);
      // cover around the boss floor
      barricade(K, 8, -206); barricade(K, 30, -210, true); barricade(K, 6, -228, true); barricade(K, 18, -234);
      supply(K, 26, -202); supply(K, 4, -214, true);
      for (const [x, z] of [[-3, -196], [43, -196], [-3, -240], [-2, -206]]) hazardPost(K, x, z, 5);
      K.light(14, 7, -200, HAZ, 7, 26);
    },
  },

  // -------------------------------------------------------------------------
  // The Pyramidion: night dig site -> roofed Vex conduit hall -> the black pyramid's gate ->
  // Protheon's chamber inside the pyramid.
  // -------------------------------------------------------------------------
  io3: {
    spawn: [0, 18],
    bounds: [-70, 70, -282, 30],
    zones: [
      { name: 'Excavation Site XII', x: 0, z: -36 },
      { name: 'Aphix Conduit', x: 14, z: -102 },
      { name: 'Pyramidion Gate', x: 0, z: -163 },
      { name: "Protheon's Chamber", x: 0, z: -234, boss: true },
    ],
    noEdge: false,
    build(K) {
      const { R } = K;

      // ---- Excavation Site XII: stepped dig terraces, scaffolds, floodlights, cranes ----
      flat(K, 0, -36, 52, 44, DIRT, { y: 0.02 });
      flat(K, 0, -36, 28, 22, DIRT2, { y: 0.035 });
      flat(K, 0, -36, 12, 10, DIRT3, { y: 0.05 });
      // outer terrace bank (low walls with ramps cut through)
      K.wall(-26, -14, 26, -14, 1.4, { t: 1.2, color: DIRT, gaps: [[20, 32]] });
      K.wall(-26, -58, 26, -58, 1.4, { t: 1.2, color: DIRT, gaps: [[22, 36]] });
      K.wall(-26, -58, -26, -14, 1.4, { t: 1.2, color: DIRT, gaps: [[16, 28]] });
      K.wall(26, -58, 26, -14, 1.4, { t: 1.2, color: DIRT, gaps: [[16, 28]] });
      // inner trench step
      K.wall(-14, -25, 14, -25, 0.9, { t: 0.8, color: DIRT2, gaps: [[11, 17]] });
      K.wall(-14, -47, 14, -47, 0.9, { t: 0.8, color: DIRT2, gaps: [[11, 17]] });
      K.wall(-14, -47, -14, -25, 0.9, { t: 0.8, color: DIRT2, gaps: [[8, 14]] });
      K.wall(14, -47, 14, -25, 0.9, { t: 0.8, color: DIRT2, gaps: [[8, 14]] });
      // exposed Vex relics in the pit
      vexCube(K, 8, 0, -42, 2.4); vexCube(K, -7, 0, -30, 1.8);
      K.box(-8, -44, 1.6, 3, 1.6, VW); vbox(K, -8, 3.2, -44, 2, 0.4, 2, VB); vbox(K, -8, 2.2, -44, 1.66, 0.3, 1.66, MILK, { glow: 1.2 });
      vbox(K, 6, 0.4, -30, 4, 0.8, 1.2, VW2, { ry: 0.4 });
      // scaffolds, floodlights, cranes
      scaffold(K, -31, -24, 6, 6, 8, 2);
      scaffold(K, 31, -50, 6, 8, 6, 2);
      floodlight(K, -22, -18, 9, -0.8); floodlight(K, 22, -18, 9, -2.4);
      floodlight(K, -22, -54, 9, 0.8); floodlight(K, 22, -54, 9, 2.4);
      crane(K, 34, -14, 26, 28, Math.PI * 0.9);
      crane(K, -38, -58, 22, 24, -Math.PI * 0.2);
      // Red Legion dig crew gear
      barricade(K, -18, -8); barricade(K, 18, -64); supply(K, 30, -30, true); supply(K, -32, -46); supply(K, 12, -20);
      hazardPost(K, -6, -12, 3.5); hazardPost(K, 6, -12, 3.5);
      K.scatter((x, z) => K.rock(x, z, R(1.4, 2.8)), 0, -36, 30, 46, 8, 3);
      K.light(-18, 9, -22, FLOOD, 10, 34);
      K.light(18, 9, -50, FLOOD, 10, 34);

      // ---- Aphix Conduit: semi-roofed Vex hall of white and brass pillars ----
      const HX = 14, HZ = -102;
      K.box(-9, HZ, 2, 15, 58, VBR);
      K.box(37, HZ, 2, 15, 58, VBR);
      for (let z = -78; z >= -126; z -= 8) {
        for (const [x, s] of [[-7.85, 1], [35.85, -1]]) {
          vbox(K, x, 7, z, 0.3, 12, 5.2, VW);
          vbox(K, x + s * 0.1, 7, z - 4, 0.3, 10, 0.4, MILK, { glow: 1.3 });
          vbox(K, x + s * 0.12, 11, z, 0.3, 0.6, 0.6, VRED, { glow: 2.2 });
        }
      }
      K.wall(-10, -73, 38, -73, 15, { t: 2, color: VBR, gaps: [[14, 26]] });
      K.wall(-10, -131, 38, -131, 15, { t: 2, color: VBR, gaps: [[12, 24]] });
      K.box(10, -73, 12, 3, 2.2, VW, { y: 12 });
      K.box(8, -131, 12, 3, 2.2, VW, { y: 12 });
      vbox(K, 10, 11.6, -71.8, 12, 0.4, 0.3, MILK, { glow: 1.5 });
      vbox(K, 8, 11.6, -132.2, 12, 0.4, 0.3, MILK, { glow: 1.5 });
      // roof over the side aisles, open skylight with crossbeams over the nave
      K.box(-1, HZ, 14, 1, 58, VD, { y: 14 });
      K.box(29, HZ, 14, 1, 58, VD, { y: 14 });
      for (let z = -78; z >= -126; z -= 8) vbox(K, HX, 14.5, z, 16, 0.8, 1.2, VB);
      for (const x of [3, 25]) for (let z = -82; z >= -122; z -= 10) vexPillar(K, x, z, 14, { eye: ((z + 82) / 10) % 2 === 0 });
      // milky glowing channels in the floor
      flat(K, HX, HZ, 44, 56, VD, { y: 0.02 });
      flat(K, HX, HZ, 1.4, 56, MILK, { y: 0.05, glow: 1.4 });
      for (const x of [8, 20]) flat(K, x, HZ, 0.6, 52, MILK, { y: 0.05, glow: 1.1 });
      for (const z of [-86, -102, -118]) flat(K, HX, z, 40, 0.6, MILK, { y: 0.05, glow: 1.1 });
      K.mesh(new THREE.TorusGeometry(4, 0.25, 3, 20).rotateX(Math.PI / 2), MILK, HX, 0.06, HZ, { glow: 1.4 });
      for (const [x, y, z, s] of [[6, 10, -88, 1.6], [22, 11, -112, 2], [14, 9, -122, 1.4], [10, 10.5, -96, 1.2]]) vexCube(K, x, y, z, s, { ry: R(0, 1.5) });
      vexCube(K, 18, 0, -92, 1.6); vexCube(K, 9, 0, -114, 1.8);
      K.light(HX, 9, HZ, MILK, 10, 36);

      // ---- Pyramidion Gate: plaza before the black pyramid ----
      const PZ = -234, PH = 95, PS = 44;
      K.mesh(new THREE.ConeGeometry(PS * Math.SQRT2, PH, 4), VD, 0, PH / 2, PZ, { ry: Math.PI / 4 });
      for (const y of [18, 38, 58, 76]) {
        const s = PS * (1 - y / PH) + 0.15;
        for (const sg of [-1, 1]) {
          vbox(K, 0, y, PZ + sg * s, s * 2, 0.3, 0.3, MILK, { glow: 0.8 });
          vbox(K, sg * s, y, PZ, 0.3, 0.3, s * 2, MILK, { glow: 0.8 });
        }
      }
      // colliding plinth around the whole footprint (gate gap on the north face)
      K.wall(-PS, PZ + PS, PS, PZ + PS, 5, { t: 3, color: VBR, gaps: [[PS - 6, PS + 6]] });
      K.wall(-PS, PZ - PS, PS, PZ - PS, 5, { t: 3, color: VBR });
      K.wall(-PS, PZ - PS, -PS, PZ + PS, 5, { t: 3, color: VBR });
      K.wall(PS, PZ - PS, PS, PZ + PS, 5, { t: 3, color: VBR });
      for (const sx of [-1, 1]) vbox(K, sx * (PS + 6) / 2, 4.6, PZ + PS + 1.55, PS - 6, 0.3, 0.2, MILK, { glow: 1.2 });
      // the gate portal, glowing frame and film
      for (const sx of [-1, 1]) {
        K.box(sx * 8, PZ + PS + 0.5, 4, 18, 4, VW);
        vbox(K, sx * 8, 9, PZ + PS + 2.55, 1.2, 14, 0.2, MILK, { glow: 1.5 });
        vbox(K, sx * 6.1, 7, PZ + PS + 2.2, 0.3, 14, 0.4, MILK, { glow: 2 });
      }
      K.box(0, PZ + PS + 0.5, 20, 3, 4, VW, { y: 15 });
      vbox(K, 0, 14, PZ + PS + 2.2, 12.4, 0.3, 0.4, MILK, { glow: 2 });
      K.mesh(new THREE.OctahedronGeometry(1.4, 0), VRED, 0, 20.5, PZ + PS + 2.6, { glow: 2.6 });
      ghost(K, new THREE.PlaneGeometry(12, 14), MILK, 0.16, 0, 7, PZ + PS + 1.8);
      // passage through the pyramid wall to the chamber
      K.box(-7, PZ + PS - 10, 2, 12, 20, VBR);
      K.box(7, PZ + PS - 10, 2, 12, 20, VBR);
      K.box(0, PZ + PS - 10, 16, 1, 20, VD, { y: 12 });
      for (const sx of [-1, 1]) vbox(K, sx * 5.9, 5, PZ + PS - 10, 0.2, 0.4, 20, MILK, { glow: 1.4 });
      flat(K, 0, PZ + PS - 10, 1.2, 20, MILK, { y: 0.05, glow: 1.4 });
      // plaza: white obelisks, broken Vex blocks, Legion barricades, glowing lines to the gate
      vexPillar(K, -30, -176, 28, { w: 3 }); vexPillar(K, 30, -176, 28, { w: 3 });
      vexPillar(K, -44, -150, 18, { w: 2.4 }); vexPillar(K, 44, -150, 18, { w: 2.4 });
      for (const [x, z, s] of [[-10, -153, 2.4], [12, -170, 2], [-14, -173, 2], [11, -151, 1.8], [-20, -160, 1.4], [20, -160, 1.4]]) vexCube(K, x, 0, z, s);
      barricade(K, -6, -146); barricade(K, 8, -142, true); supply(K, -22, -146);
      strip(K, 0, -140, 0, PZ + PS + 1, 1.2, MILK, { y: 0.05, glow: 1.4 });
      for (const sx of [-1, 1]) strip(K, sx * 10, -146, sx * 5, PZ + PS + 1, 0.5, MILK, { y: 0.05, glow: 1.1 });
      for (const [x, y, z, s] of [[-18, 14, -168, 2.4], [16, 18, -158, 2], [4, 24, -176, 3], [-8, 20, -150, 1.6]]) vexCube(K, x, y, z, s, { ry: R(0, 1.5) });
      K.light(0, 8, PZ + PS + 4, MILK, 10, 30);

      // ---- Protheon's Chamber: roofed Vex hall inside the pyramid ----
      const CX = 0, CZ = PZ, CW = 48, CH = 16;
      K.room(CX, CZ, CW, CW, CH, { t: 2, color: VW2, doors: { s: 12 }, roof: true, roofColor: VD });
      flat(K, CX, CZ, CW - 2, CW - 2, VD, { y: 0.02 });
      // wall pilasters and milky slits
      for (let s = -18; s <= 18; s += 9) {
        for (const [x, z, ry] of [[-22.9, CZ + s, 0], [22.9, CZ + s, 0], [s, CZ - 22.9, Math.PI / 2]]) {
          if (ry && s === 0) continue; // the big gate sits there
          vbox(K, x, CH / 2, z, 1.2, CH, 1.2, VB, { ry });
          vbox(K, x + (ry ? 2.2 : 0), CH * 0.6, z + (ry ? 0 : 2.2), 0.3, CH * 0.5, 0.3, MILK, { glow: 1.3 });
        }
      }
      // four great pillars
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) vexPillar(K, CX + sx * 15, CZ + sz * 15, CH, { w: 3 });
      // Vex gates on the walls
      vexGate(K, CX - 22.6, 6, CZ - 13.5, 3.2, Math.PI / 2);
      vexGate(K, CX - 22.6, 6, CZ + 13.5, 3.2, Math.PI / 2);
      vexGate(K, CX + 22.6, 6, CZ - 13.5, 3.2, -Math.PI / 2);
      vexGate(K, CX + 22.6, 6, CZ + 13.5, 3.2, -Math.PI / 2);
      vexGate(K, CX, 8, CZ - 22.6, 5.5, 0);
      // central dais (visual, low) with a floating ring and a red eye above
      K.mesh(new THREE.CylinderGeometry(8, 8.6, 0.24, 8), VB, CX, 0.12, CZ);
      K.mesh(new THREE.CylinderGeometry(5.4, 5.8, 0.4, 8), VW, CX, 0.2, CZ);
      K.mesh(new THREE.TorusGeometry(8.4, 0.18, 3, 24).rotateX(Math.PI / 2), MILK, CX, 0.26, CZ, { glow: 1.6 });
      K.mesh(new THREE.TorusGeometry(6, 0.35, 4, 28).rotateX(Math.PI / 2), MILK, CX, 11, CZ, { glow: 1.6 });
      K.mesh(new THREE.TorusGeometry(4.6, 0.5, 4, 24).rotateX(Math.PI / 2), VB, CX, 11, CZ);
      K.mesh(new THREE.OctahedronGeometry(1.2, 0), VRED, CX, 13.2, CZ, { glow: 2.6 });
      // milky channels radiating from the dais
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4 + Math.PI / 8;
        strip(K, CX + Math.cos(a) * 9.5, CZ + Math.sin(a) * 9.5, CX + Math.cos(a) * 21.5, CZ + Math.sin(a) * 21.5, 0.5, MILK, { y: 0.05, glow: 1.3 });
      }
      for (const [x, z, s] of [[-9, CZ + 12, 1.4], [10, CZ - 11, 1.4], [12, CZ + 10, 1.2], [-11, CZ - 10, 1.2]]) vexCube(K, x, 0, z, s);
      K.light(CX, 10, CZ, MILK, 14, 40);
      K.light(CX, 5, CZ - 20, VRED, 9, 28);
    },
  },
};
