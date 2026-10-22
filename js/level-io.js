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
    V(mid, face * (t * 0.5 + 0.3), h * 0.32, L - 0.1, h * 0.68, 0.5, CAB, horiz ? { rx: -face * 0.36 } : { rz: face * 0.36 });
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
    vbox(K, x, y - 0.28, z, w + 0.4, 0.25, d + 0.4, CAB, {});
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
  vbox(K, x, h + 0.2, z, 2.9, 0.3, 0.3, STEEL, { ry });
  for (const s of [-0.8, 0.8]) vbox(K, x + Math.cos(ry) * s, h + 0.7, z - Math.sin(ry) * s, 1.0, 0.8, 0.5, FLOOD, { ry, rx: 0.35, glow: 2.2 });
}
// lattice tower crane: mast, jib toward angle a (0 = +x, PI/2 = -z), counter-jib, cab and hook
function crane(K, x, z, h, jib, a) {
  K.box(x, z, 2.2, h, 2.2, CAB3);
  for (let y = 2; y < h; y += 2.5) vbox(K, x, y, z, 2.6, 0.2, 2.6, HAZ, { glow: y % 5 < 2.5 ? 0.5 : 0 });
  const cx = Math.cos(a), cz = -Math.sin(a);
  vbox(K, x + cx * jib / 2, h + 0.8, z + cz * jib / 2, jib, 1.2, 1.2, CAB2, { ry: a });
  vbox(K, x - cx * 4.8, h + 0.8, z - cz * 4.8, 9.6, 1.0, 1.4, CAB2, { ry: a });
  vbox(K, x - cx * 8.5, h - 0.4, z - cz * 8.5, 3, 2.4, 2.4, CAB, { ry: a });
  vbox(K, x, h + 4, z, 0.6, 6.4, 0.6, CAB3);
  vbox(K, x + cx * 1.6, h - 1.3, z + cz * 1.6, 2.9, 2, 2.9, CAB, { ry: a });
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
  vbox(K, x, h - 0.25, z, w * 1.35, 0.6, w * 1.35, VB);
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


// ---------------------------------------------------------------------------
// U16e High Ground helpers (terrain aware: every y is measured from the ground under x, z)
// ---------------------------------------------------------------------------
const PSI = 0xa98aff;
// visual box centred at an ABSOLUTE world height (for ribs, spans and lintels that cross sloping ground)
function vabs(K, x, y, z, w, h, d, color, o = {}) {
  return vbox(K, x, y - K.ground(x, z), z, w, h, d, color, o);
}
// decal strip that follows the terrain: pieces of at most 3 m, each pitched to the slope under it
function tstrip(K, x1, z1, x2, z2, w, color, o = {}) {
  const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / 3));
  for (let i = 0; i < n; i++) {
    const ax = x1 + ((x2 - x1) * i) / n, az = z1 + ((z2 - z1) * i) / n, bx = x1 + ((x2 - x1) * (i + 1)) / n, bz = z1 + ((z2 - z1) * (i + 1)) / n;
    const len = Math.hypot(bx - ax, bz - az), dh = K.ground(bx, bz) - K.ground(ax, az);
    vbox(K, (ax + bx) / 2, o.y ?? 0.07, (az + bz) / 2, len + 0.3, o.h ?? 0.06, w, color, { ry: Math.atan2(-(bz - az), bx - ax), rz: Math.atan2(dh, len), glow: o.glow });
  }
}
function tcrack(K, pts, w, color, o = {}) {
  for (let i = 1; i < pts.length; i++) tstrip(K, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w * K.R(0.85, 1.12), color, o);
}
// a giant fossil rib arching across a canyon at z, feet on the ground at xa and xb
function rib(K, xa, xb, z, peak, th = 2.6, color = SPIRE2) {
  const ya = K.ground(xa, z) - 1.2, yb = K.ground(xb, z) - 1.2, N = 10;
  let px = xa, py = ya;
  const tip = [];
  for (let i = 1; i <= N; i++) {
    const s = i / N, x = xa + (xb - xa) * s, y = ya + (yb - ya) * s + peak * 4 * s * (1 - s);
    const dx = x - px, dy = y - py, len = Math.hypot(dx, dy), t = th * (0.7 + 0.6 * Math.abs(2 * s - 1));
    vabs(K, (x + px) / 2, (y + py) / 2, z, len + 0.45, t, 3.4 + t * 0.5, i % 2 ? color : SPIRE, { rz: Math.atan2(dy, dx) });
    if (i === Math.round(N / 2)) tip.push(x, y);
    px = x; py = y;
  }
  return tip; // [x, y] of the apex
}
// Cabal gun emplacement on a mesa top
function gunNest(K, x, z, ry = 0) {
  K.box(x, z, 5, 1.6, 5, CAB3);
  vbox(K, x, 2.1, z, 3.6, 1.0, 3.6, CAB2);
  vbox(K, x + Math.sin(ry) * 2.6, 2.3, z + Math.cos(ry) * 2.6, 0.5, 0.5, 4.4, CAB3, { ry });
  vbox(K, x, 1.65, z, 5.1, 0.2, 5.1, HAZ, { glow: 1 });
}
// Psion mind-link pod: a lit glass cylinder on a Legion plinth (collides at the base only)
function psionPod(K, x, z, h = 5) {
  K.cyl(x, z, 1.3, 1.2, CAB3, { sides: 8 });
  K.mesh(new THREE.CylinderGeometry(0.85, 0.85, h, 8), PSI, x, h / 2 + 1.2, z, { glow: 1.5 });
  K.mesh(new THREE.TorusGeometry(1.5, 0.14, 4, 12).rotateX(Math.PI / 2), CAB2, x, h * 0.7 + 1.2, z);
  vbox(K, x, h + 1.5, z, 1.9, 0.5, 1.9, CAB3);
}
// hazard markings for a landing pad on the ground (the terrain makes the pad itself)
function padMarks(K, x, z, w, d) {
  const iw = w * 0.4, id = d * 0.4;
  for (const [dx, dz, ww, dd] of [[0, -id, iw * 2, 0.35], [0, id, iw * 2, 0.35], [-iw, 0, 0.35, id * 2], [iw, 0, 0.35, id * 2]]) vbox(K, x + dx, 0.05, z + dz, ww, 0.06, dd, HAZ, { glow: 1.1 });
  vbox(K, x, 0.05, z, 0.6, 0.06, d * 0.5, HAZ, { glow: 0.8 });
  vbox(K, x, 0.05, z, w * 0.5, 0.06, 0.6, HAZ, { glow: 0.8 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    vbox(K, x + sx * (w / 2 - 0.6), 0.6, z + sz * (d / 2 - 0.6), 0.5, 1.2, 0.5, CAB3);
    vbox(K, x + sx * (w / 2 - 0.6), 1.35, z + sz * (d / 2 - 0.6), 0.5, 0.35, 0.5, HAZR, { glow: 2 });
  }
}
// a tight cluster of white spires: [[dx, dz, h, r?], ...]
function cluster(K, cx, cz, list, o = {}) {
  for (const [dx, dz, h, r] of list) spire(K, cx + dx, cz + dz, h, { r, collide: o.collide });
}

export default {

  // -------------------------------------------------------------------------
  // Sacred Ground (U16e High Ground). Rhythm:
  //   Lost Oasis (an open teal lake under dawn light, a curved shore path, spire clusters: combat) -> the Traveler's arch and the
  //   mouth of the Scar (traversal) -> Giant's Scar (the canyon floor climbs 7 m under a giant's ribs, a west ledge climbs ahead
  //   of the fight: combat during traversal) -> the Light gate at the lip -> a long ramp DOWN into the Rupture, a crater the Taken
  //   hold (new area). Elevation 0 to 22 m (canyon walls), the route climbs to 7.4 m and drops back to 0.
  // -------------------------------------------------------------------------
  io1: {
    spawn: [0, 18],
    bounds: [-80, 80, -230, 30],
    zones: [
      { name: 'Lost Oasis', x: -8, z: -42 },
      { name: "Giant's Scar", x: 6, z: -112 },
      { name: 'The Rupture', x: 0, z: -188, boss: true, room: { minX: -23, maxX: 23, minZ: -211, maxZ: -165 } },
    ],
    noEdge: false,
    terrain: [
      // Oasis: soft banks west and east, a low rise under the arch at the far shore
      { type: 'mound', x: -56, z: -36, r: 26, h: 5 },
      { type: 'mound', x: 54, z: -30, r: 24, h: 4 },
      { type: 'plateau', x: 4, z: -70, w: 30, d: 10, h: 1.8, edge: 11 },
      // the Scar floor climbs from 0 at the mouth to 7.4 m at the lip
      { type: 'ramp', x0: 4, z0: -78, x1: 4, z1: -136, width: 26, h0: 0, h1: 7.4, edge: 6 },
      // the canyon walls, in pieces of different heights ([z from, z to, wall top, inner edge])
      ...[[-78, -94, 12, -30], [-94, -110, 17, -14], [-110, -126, 21, -12], [-126, -148, 19, -12]].map(([a, b, h, ix]) => ({ type: 'plateau', x: ix - 35, z: (a + b) / 2, w: 70, d: a - b + 2, h, edge: 3 })),
      ...[[-78, -94, 10, 36], [-94, -108, 15, 22], [-108, -124, 20, 20], [-124, -148, 18, 18]].map(([a, b, h, ix]) => ({ type: 'plateau', x: ix + 35, z: (a + b) / 2, w: 70, d: a - b + 2, h, edge: 3 })),
      // the Rupture: a crater carved out of a high rim (rim pieces first, the pit last)
      { type: 'plateau', x: 0, z: -152, w: 150, d: 20, h: 15, edge: 3 },
      { type: 'plateau', x: -40, z: -186, w: 52, d: 70, h: 10, edge: 3 },
      { type: 'plateau', x: 40, z: -184, w: 52, d: 70, h: 12.5, edge: 3 },
      { type: 'plateau', x: 0, z: -218, w: 150, d: 30, h: 15, edge: 3 },
      { type: 'plateau', x: 4, z: -140, w: 20, d: 8, h: 7.4, edge: 1.5 }, // the lip, where the Light gate stands
      { type: 'plateau', x: -26, z: -120, w: 12, d: 24, h: 11, edge: 2.5 }, // the west ledge over the Scar
      { type: 'plateau', x: 0, z: -190, w: 52, d: 52, h: 0, edge: 3 }, // the crater floor
      { type: 'plateau', x: 31, z: -188, w: 12, d: 28, h: 4.5, edge: 2 }, // a rim shelf on the east side of the crater
      // routes: up to the west ledge and on to the lip, down into the crater, up to the rim shelf
      { type: 'ramp', x0: -4, z0: -96, x1: -27, z1: -116, width: 7, h0: 2.3, h1: 11 },
      { type: 'ramp', x0: -26, z0: -128, x1: -6, z1: -140, width: 7, h0: 11, h1: 7.4 },
      { type: 'ramp', x0: 4, z0: -142, x1: 2, z1: -170, width: 16, h0: 7.4, h1: 0, edge: 4 },
      { type: 'ramp', x0: 6, z0: -196, x1: 24, z1: -196, width: 8, h0: 0, h1: 4.5 },
    ],
    sky: {
      // dawn: Jupiter rising huge and low over the Scar, a gold horizon under a violet zenith, teal mist in the basins
      zenith: 0x35498a, mid: 0xb08ca8, horizon: 0xf6c890, fog: 0xb7cdbc,
      stars: { n: 200, color: 0xfff0e0, size: 2, min: 0.5 },
      bodies: [
        { color: 0xf0c890, size: 300, pos: [330, 110, -470], bands: [0xf0c890, 0xd0784a, 0xf8dcb0, 0xb86a40, 0xf0d2a0, 0xc88a56] },
        { color: 0xf4eee0, size: 12, pos: [-300, 190, -400] },
      ],
      ridges: [{ r: 620, h: [30, 100], color: 0x7a7a8a, haze: 0.5, steps: 66 }, { r: 540, h: [15, 50], color: 0x8a8a8a, haze: 0.35, steps: 84 }],
      haze: [{ color: 0xf0d0a8, opacity: 0.55, r: 470, h: 90, y: -10 }, { color: 0xa8d8c8, opacity: 0.35, r: 440, h: 40, y: -6 }],
    },
    build(K) {
      const { R, C } = K;

      // ---- Lost Oasis: one teal lake with a pale shore path on the east side, clusters of spires, a beacon geyser ----
      const LX = -6, LZ = -46;
      pool(K, LX, LZ, 14);
      pool(K, -28, -22, 3.4); pool(K, 26, -42, 3); pool(K, 42, -12, 3.6);
      geyser(K, -26, -66, 4, 34);
      geyser(K, 34, -16, 3.4, 20);
      tcrack(K, [[2, 12], [8, -2], [20, -16], [28, -30], [29, -46], [22, -60], [12, -68]], 3.6, CRUST, { y: 0.03 });
      cluster(K, -34, -30, [[0, 0, 18], [5, 3, 12], [-4, 5, 9], [3, -6, 14], [-7, -2, 7]]);
      cluster(K, 40, -58, [[0, 0, 22], [-5, 4, 12], [5, 5, 9], [2, -6, 15]]);
      cluster(K, -17, -74, [[0, 0, 26, 2.4], [4, 4, 16], [-5, 3, 11], [6, -3, 19]]);
      cluster(K, 24, -76, [[0, 0, 24, 2.2], [-4, -4, 15], [4, 4, 10]]);
      for (const [x, z, w, d, h] of [[-48, -2, 8, 5, 1.6], [20, -8, 6, 5, 1.2], [52, -48, 9, 7, 2], [-50, -62, 7, 6, 1.8]]) mound(K, x, z, w, d, h);
      for (const [x, z, s] of [[-30, -40, 2.4], [-20, -30, 1.6], [36, -50, 2.6], [30, -64, 1.8], [6, -20, 1.5], [-12, -8, 1.8]]) K.rock(x, z, s);
      crack(K, [[-60, -30], [-44, -34], [-30, -46], [-24, -50]], 0.5, C.rock2, { y: 0.02 });
      crack(K, [[46, 0], [50, -12], [56, -24], [70, -22]], 0.5, C.rock2, { y: 0.02 });
      // the Traveler's arch on the far shore: two white pillars, a lintel and a hovering mote of Light
      K.box(-5, -66, 2.4, 11, 2.4, SPIRE); K.box(13, -66, 2.4, 11, 2.4, SPIRE);
      K.box(-5, -66, 3.2, 1, 3.2, SPIRE2, { y: 11 }); K.box(13, -66, 3.2, 1, 3.2, SPIRE2, { y: 11 });
      vbox(K, 4, 12.4, -66, 21, 1.6, 2.2, SPIRE, { rz: 0.03 });
      vbox(K, 4, 11.5, -66, 17, 0.25, 0.3, LIGHTG, { glow: 1.8 });
      K.mesh(new THREE.OctahedronGeometry(1.1, 0), LIGHTG, 4, 8, -66, { glow: 2.4 });
      ghost(K, new THREE.CylinderGeometry(0.5, 1.4, 12, 6, 1, true), LIGHTG, 0.18, 4, 6, -66);
      K.light(LX, 3, LZ, 0x7ae8d4, 9, 32);
      K.light(4, 9, -66, LIGHTG, 9, 28);
      K.light(34, 3, -16, 0x7ae8d4, 5, 20);

      // ---- Giant's Scar: the canyon climbs under a giant's ribs; a west ledge runs ahead of the floor fight ----
      // an arch of rock at the mouth, to walk under
      cliff(K, -12, -84, 3.2, 14, { taper: 0.7 }); cliff(K, 18, -84, 3, 12, { taper: 0.7 });
      vbox(K, 3, 13.6, -84, 36, 2.6, 5, C.rock2, { rz: 0.04 });
      vbox(K, 3, 12.1, -84, 32, 0.4, 5.2, SULF);
      // the ribs, then the spine that joins their tips
      const tips = [[-92, -36, 42, 20], [-104, -20, 28, 17], [-116, -18, 26, 15], [-130, -18, 24, 13]].map(([z, xa, xb, pk]) => { const t = rib(K, xa, xb, z, pk, 2.8); return [t[0], t[1], z]; });
      for (let i = 1; i < tips.length; i++) {
        const [x1, y1, z1] = tips[i - 1], [x2, y2, z2] = tips[i], dy = y1 - y2, dz = z1 - z2, len = Math.hypot(dy, dz);
        vabs(K, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, 2.6, 2.4, len + 1, SPIRE2, { rx: Math.atan2(-dy, dz), ry: Math.atan2(x2 - x1, z1 - z2) * 0.2 });
      }
      // fallen slabs leaning on the walls, rocks, spires on the floor
      vbox(K, -9.5, 5.2, -104, 2.2, 12, 8, C.rock, { rz: 0.4 });
      K.collider(-11, 0, -108, -7.4, 5, -100, null);
      vbox(K, 20.5, 5.2, -124, 2.2, 12, 8, C.rock2, { rz: -0.4 });
      K.collider(18.4, 0, -128, 22, 5, -120, null);
      for (const [x, z, s] of [[-4, -90, 2.6], [14, -130, 3], [-6, -122, 2.2], [16, -92, 2.2], [10, -102, 1.6]]) K.rock(x, z, s);
      spire(K, -7, -112, 9); spire(K, 15, -108, 7); spire(K, 12, -86, 6);
      // rim columns on the wall tops
      for (const [x, z, r, h] of [[-24, -100, 3, 9], [-38, -116, 3.4, 11], [-22, -138, 3.6, 10], [30, -100, 3, 8], [26, -114, 3.4, 12], [24, -134, 3.4, 9], [-40, -86, 4, 8], [46, -86, 4, 7]]) cliff(K, x, z, r, h, { taper: 0.7, collide: false });
      // the glowing crack down the floor, following the slope
      const scarPts = [[4, -80], [0, -90], [9, -98], [3, -108], [11, -118], [5, -126], [8, -136]];
      tcrack(K, scarPts, 2.8, SCAR, { y: 0.06 });
      tcrack(K, scarPts, 1.2, CRACK, { y: 0.1, glow: 1.6 });
      tcrack(K, [[9, -98], [14, -102], [17, -100]], 0.6, CRACK, { y: 0.1, glow: 1.4 });
      K.light(6, 1.5, -112, CRACK, 8, 30);
      K.light(-26, 13, -120, CRACK, 6, 20); K.light(14, 4, -90, CRACK, 6, 22);
      // on the west ledge: a leaning Taken-blighted slab as cover
      K.rock(-28, -112, 2.4); K.rock(-24, -126, 1.8); spire(K, -30, -122, 8, { r: 1.2 });

      // ---- the Light gate at the lip ----
      K.door(4, -141.5, 18, 14, 'x', { zone: 1, t: 2.4, color: 0xd9d2b8, trim: LIGHTG });
      for (const sx of [-1, 1]) {
        spire(K, 4 + sx * 11, -140, 15, { r: 1.5 });
        vbox(K, 4 + sx * 8.6, 6, -141.5, 0.3, 10, 0.3, LIGHTG, { glow: 1.8 });
      }
      K.light(4, 7, -137, LIGHTG, 9, 26);

      // ---- The Rupture: a crater the Taken hold. Walk down from the gate; a fallen rib climbs to a shelf on the east rim ----
      const BX = 0, BZ = -188;
      // the fissure: dark scorched rift with a white-gold Light core, all flat (enemies still walk)
      const rift = [[-26, -176], [-16, -181], [-7, -184], [0, -188], [7, -192], [16, -197], [26, -202]];
      crack(K, rift, 9, SCAR, { y: 0.02 });
      crack(K, rift, 4.5, LIGHTG, { y: 0.045, glow: 1.8 });
      crack(K, [[0, -188], [-3, -197], [-9, -206]], 2, LIGHTG, { y: 0.045, glow: 1.6 });
      crack(K, [[0, -188], [4, -179], [2, -172]], 2, LIGHTG, { y: 0.045, glow: 1.6 });
      crack(K, [[-16, -181], [-20, -192], [-19, -200]], 1, LIGHTG, { y: 0.045, glow: 1.3 });
      for (const [x, z] of [[-11, -178], [9, -203], [-5, -196], [-20, -184]]) vbox(K, x, 0.2, z, R(1.5, 2.6), 0.4, R(1, 2), C.rock2, { ry: R(0, 3), rx: R(-0.3, 0.3) });
      ghost(K, new THREE.CylinderGeometry(2.6, 4.2, 90, 10, 1, true), LIGHTG, 0.12, BX, 45, BZ);
      ghost(K, new THREE.CylinderGeometry(1.2, 1.8, 90, 8, 1, true), LIGHTG, 0.18, BX, 45, BZ);
      // three big shards as cover, not a ring: two on the west side of the floor, one by the descent
      spire(K, -13, -178, 11, { r: 1.9 }); spire(K, -15, -200, 8, { r: 1.5 }); spire(K, 11, -174, 6.5, { r: 1.3 });
      K.rock(-4, -206, 2.4); K.rock(14, -208, 2); K.rock(-20, -190, 2.2);
      // the fallen rib that is the ramp to the east shelf: two bone arches over the climb
      for (const x of [10, 19]) {
        vbox(K, x, 2.6, -196, 1.4, 5.2, 9, SPIRE2, { rz: 0.02 });
        vbox(K, x, 5.4, -196, 3.2, 1, 9.4, SPIRE);
      }
      K.collider(9.2, 0, -199, 10.8, 3, -193, null); K.collider(18.2, 0, -199, 19.8, 3, -193, null);
      // crystal clusters on the rim, a rock shelf lit gold
      cluster(K, 0, -222, [[-14, 0, 24, 2.2], [0, 4, 30, 2.6], [12, -2, 21, 2]], { collide: false });
      cluster(K, -42, -190, [[0, 0, 15, 1.8], [-3, 10, 20, 2], [4, -9, 12, 1.5]], { collide: false });
      cluster(K, 44, -196, [[0, 0, 18, 1.8], [-4, 9, 13, 1.5]], { collide: false });
      vbox(K, 25.2, 4.6, -188, 0.1, 0.12, 28, LIGHTG, { glow: 1.6 });
      // Taken blight over the arena, black pools on the ground
      for (const [x, y, z, s] of [[-14, 12, -202, 3], [16, 15, -176, 2.5], [-20, 9, -170, 2], [10, 18, -206, 3.5], [22, 11, -190, 2], [-24, 16, -192, 2.6]]) blight(K, x, y, z, s);
      for (const [x, z, r] of [[-12, -204, 3.5], [14, -178, 3], [2, -210, 2.5], [-18, -172, 2.5], [18, -206, 2.2]]) {
        K.mesh(new THREE.CylinderGeometry(r, r, 0.05, 9), TAKEN, x, 0.06, z);
        K.mesh(new THREE.TorusGeometry(r, 0.12, 3, 12).rotateX(Math.PI / 2), TAKENG, x, 0.08, z, { glow: 1.2 });
      }
      K.light(BX, 3, BZ, LIGHTG, 12, 34);
      K.light(12, 12, -200, 0x9ab4ff, 6, 22);
      K.light(30, 7, -188, LIGHTG, 6, 20);

      // spires on the far slopes
      K.edge((x, z, y) => spire(K, x, z, R(10, 26), { y, collide: false }), 24);
    },
  },

  // -------------------------------------------------------------------------
  // Echo Mesa (U16e High Ground). Rhythm:
  //   Terrabase Charon (flat Golden Age base being taken by the Legion, a roofed lab to cut through) -> the Legion chicane
  //   (traversal) -> Echo Mesa (a canyon floor under a Legion-held mesa, ramp up to the gun nest: combat) -> the west lane climbs
  //   to the Landing Pads plateau (combat during traversal) -> Landing Pads (a raised dock pad above the field) -> the descent
  //   ramp to the Drill compound under the great rig (new area).
  // Elevation 0 to 12 m (canyon walls), the playable route climbs to 7.5 m.
  // -------------------------------------------------------------------------
  io2: {
    spawn: [-40, 18],
    bounds: [-90, 90, -262, 30],
    zones: [
      { name: 'Terrabase Charon', x: -36, z: -36 },
      { name: 'Echo Mesa', x: 26, z: -90 },
      { name: 'Landing Pads', x: -14, z: -152 },
      { name: 'The Drill', x: 20, z: -218, boss: true, room: { minX: -4, maxX: 44, minZ: -242, maxZ: -194 } },
    ],
    noEdge: false,
    terrain: [
      // the canyon walls of Echo Mesa
      { type: 'plateau', x: -74, z: -94, w: 40, d: 60, h: 12, edge: 3 },
      { type: 'plateau', x: 70, z: -98, w: 40, d: 70, h: 11, edge: 3 },
      // the Legion-held mesa in the canyon
      { type: 'plateau', x: -14, z: -92, w: 26, d: 24, h: 7.5, edge: 2.5 },
      // the Landing Pads plateau and the raised dock pad on it
      { type: 'plateau', x: -24, z: -152, w: 70, d: 50, h: 4.8, edge: 2.5 },
      { type: 'plateau', x: -48, z: -152, w: 20, d: 22, h: 7.2, edge: 2 },
      // the Drill compound: a gun terrace along its east wall
      { type: 'plateau', x: 37.5, z: -212, w: 10, d: 22, h: 3.4, edge: 2 },
      // routes: up the mesa from the open floor, the east rim, the west lane to the pads, mesa top to the pads, pad to dock pad,
      // the descent to the Drill and the compound terrace
      { type: 'ramp', x0: 24, z0: -62, x1: -6, z1: -84, width: 8, h0: 0, h1: 7.5 },
      { type: 'ramp', x0: 66, z0: -18, x1: 66, z1: -66, width: 8, h0: 0, h1: 11 },
      { type: 'ramp', x0: -40, z0: -104, x1: -36, z1: -130, width: 9, h0: 0, h1: 4.8 },
      { type: 'ramp', x0: -14, z0: -104, x1: -14, z1: -128, width: 8, h0: 7.5, h1: 4.8 },
      { type: 'ramp', x0: -26, z0: -152, x1: -40, z1: -152, width: 8, h0: 4.8, h1: 7.2 },
      { type: 'ramp', x0: 6, z0: -160, x1: 6, z1: -190, width: 9, h0: 4.8, h1: 0 },
      { type: 'ramp', x0: 24, z0: -198, x1: 35, z1: -206, width: 7, h0: 0, h1: 3.4, edge: 3 },
    ],
    sky: {
      // clear teal day: a banded Jupiter hanging high over the mesas, Europa pale beside it, mist along the canyon floors
      zenith: 0x2f7f9c, mid: 0x7ec4b4, horizon: 0xd6ead2, fog: 0xa6d0bc,
      bodies: [
        { color: 0xe8c890, size: 230, pos: [-150, 310, -420], bands: [0xe8c890, 0xd0784a, 0xf0dcb0, 0xb86a40, 0xe8d2a0, 0xc88a56] },
        { color: 0xf0f0e8, size: 14, pos: [300, 230, -380] },
      ],
      ridges: [{ r: 620, h: [40, 110], color: 0x6a8a78, haze: 0.5, steps: 66 }, { r: 540, h: [20, 60], color: 0x7a9a86, haze: 0.35, steps: 84 }],
      haze: [{ color: 0xb9e6d2, opacity: 0.6, r: 470, h: 100, y: -10 }],
      clouds: { n: 8, color: 0xeaf6e8, opacity: 0.5, y: [110, 200], size: 26 },
    },
    build(K) {
      const { R, C } = K;

      // ---- Terrabase Charon: a Golden Age base on flat ground, a roofed lab to cut through, the Legion pushing in from the east ----
      dome(K, -78, -52, 7); dome(K, -12, 8, 6); dome(K, -82, 4, 6);
      antenna(K, -46, -58, 34);
      // the lab: a long roofed hall on the west flank, doors at its ends
      K.room(-62, -32, 14, 30, 5.5, { t: 0.8, color: CONC, roofColor: CONC2, roof: true, doors: { n: 5, s: 6 }, doorOffset: { n: -2, s: 2 } });
      for (const z of [-42, -32, -22]) vbox(K, -68.55, 3, z, 0.1, 0.7, 5, WIN, { glow: 1.5 });
      K.box(-65, -38, 3, 1, 1.2, STEEL); K.box(-59, -28, 1.2, 1, 3.2, STEEL); K.box(-64, -24, 2.4, 1.5, 2.4, CONC2);
      flat(K, -62, -32, 12.4, 28, CONC2, { y: 0.03 });
      flat(K, -62, -34, 5, 5, RUST, { y: 0.05 });
      K.light(-62, 3.5, -32, WIN, 6, 18);
      // hab blocks off the grid: a long slab, a squat block, a broken one that has lost its roof
      hab(K, -20, -16, 7, 10, 6); hab(K, -44, -6, 9, 7, 6); hab(K, -26, -60, 22, 6, 4);
      K.box(-4, -46, 10, 3.2, 7, CONC2);
      vbox(K, -4, 4.6, -46, 9, 0.5, 6.6, CONC, { rx: 0.5, rz: 0.12 });
      vbox(K, -8.4, 2.4, -46, 0.8, 4.8, 6.4, CONC2);
      vbox(K, -19, 6.4, -30, 2, 0.4, 20, STEEL); // one catwalk over the alley
      // courtyard
      flat(K, -34, -34, 24, 26, CONC2, { y: 0.03 });
      K.box(-31, -26, 3, 0.9, 3, CONC2); vbox(K, -31, 1.4, -26, 2.4, 1, 2.4, 0x6a8a5a);
      K.box(-44, -46, 3, 0.9, 3, CONC2); vbox(K, -44, 1.4, -46, 2.4, 1, 2.4, 0x6a8a5a);
      // the Legion line coming in from the east
      bulwark(K, 6, -62, 6, -24, 5, { t: 2, face: -1, gaps: [[14, 22]], banners: true });
      barricade(K, -12, -38, true); barricade(K, -8, -28); barricade(K, -14, -50); barricade(K, -40, -24, true);
      supply(K, -2, -36, true); supply(K, -60, -50); supply(K, -26, -44);
      hazardPost(K, -26, -8); hazardPost(K, 2, -64); hazardPost(K, 10, -20, 3.5);
      K.light(-36, 6, -36, WIN, 6, 26);
      for (const [x, z] of [[-19, -28], [-8, -56], [-48, -16]]) K.light(x, 5, z, WIN, 5, 20);
      K.light(2, 5, -40, HAZ, 6, 22);
      thresher(K, 22, 26, -32, 2.4, 12);

      // ---- Echo Mesa: a canyon floor under the Legion mesa. Offset bulwarks guard the mouth, a ramp climbs to the gun nest on top ----
      bulwark(K, -24, -68, 8, -68, 7, { t: 3, face: 1, banners: true });
      bulwark(K, 32, -76, 46, -76, 7, { t: 3, face: 1 });
      for (const [x, z] of [[10, -66], [30, -72], [-26, -66]]) hazardPost(K, x, z, 3.5);
      // the mesa top: parapets either side of the ramp head, the gun nest, supplies
      bulwark(K, -26, -81, -9, -81, 2.4, { t: 1.2, face: 1 });
      bulwark(K, -3, -103, -3, -88, 2.4, { t: 1.2, face: 1 });
      gunNest(K, -18, -96, 0.5);
      supply(K, -8, -98, true); supply(K, -22, -86);
      K.light(-14, 5, -92, HAZ, 7, 24);
      // rock columns on the mesa rim and the canyon walls
      for (const [x, z, r, h] of [[-26, -102, 3, 7], [-2, -102, 2.6, 5], [-60, -64, 4, 8], [-58, -110, 5, 9], [54, -68, 4, 8], [54, -124, 5, 9], [78, -90, 5, 12]]) cliff(K, x, z, r, h, { taper: 0.8, collide: false });
      // the echo arch in the west lane
      cliff(K, -50, -92, 3.4, 17, { taper: 0.7 }); cliff(K, -31, -92, 3, 15, { taper: 0.7 });
      vbox(K, -40.5, 15.4, -92, 24, 3.2, 5.6, C.rock2, { rz: 0.03 });
      vbox(K, -40.5, 13.6, -92, 22, 0.4, 5.8, SULF);
      // the open floor in front of the mesa: staggered cover, fallen mesa chunks
      barricade(K, 12, -84, true); barricade(K, 32, -100); barricade(K, 40, -82, true); barricade(K, 4, -106);
      supply(K, 20, -76); supply(K, 34, -110, true);
      for (const [x, z, s] of [[8, -112, 3.6], [-36, -112, 3], [44, -110, 2.8], [16, -70, 2.4], [26, -112, 2.2]]) K.rock(x, z, s);
      K.light(26, 5, -90, HAZ, 7, 26); K.light(-40, 6, -92, SULF, 5, 20);
      // Legion overwatch nest on the east rim, up the long ramp
      gunNest(K, 66, -82, -1.2);
      bulwark(K, 56, -100, 56, -70, 2.4, { t: 1.2, face: -1, banners: true });
      supply(K, 76, -76); supply(K, 74, -96, true);
      K.light(66, 5, -82, HAZ, 6, 22);

      // ---- Landing Pads: a plateau above the field, the dock pad raised higher, a docked dropship and fuel lines ----
      padMarks(K, -48, -152, 20, 22);
      dropship(K, -48, 0, -152, 18);
      K.collider(-51.4, 0, -161, -44.6, 5, -143, null);
      flat(K, -14, -152, 0.6, 9, HAZ, { glow: 0.7, y: 0.04 });
      flat(K, -14, -152, 9, 0.6, HAZ, { glow: 0.7, y: 0.04 });
      K.mesh(new THREE.TorusGeometry(6, 0.3, 3, 24).rotateX(Math.PI / 2), HAZ, -14, 0.05, -152, { glow: 0.8 });
      landing(K, 0, -172, 12, 10, 1.8, ['n']);
      landing(K, -34, -178, 14, 10, 2.2, ['e']);
      for (const [x, z] of [[-6, -168], [-24, -132]]) { K.cyl(x, z, 2, 4.5, STEEL, { sides: 10 }); vbox(K, x, 3.2, z, 4.1, 0.4, 4.1, HAZ, { glow: 0.8 }); }
      pipe(K, 'x', -24, -6, -168, 1.4, 0.5, 6);
      for (const [x, z, rot] of [[-30, -140, false], [-2, -158, true], [-18, -128, false]]) {
        K.box(x, z, rot ? 2.6 : 6, 2.6, rot ? 6 : 2.6, CAB2);
        vbox(K, x, 1.3, z, (rot ? 2.6 : 6) + 0.06, 0.25, (rot ? 6 : 2.6) + 0.06, HAZ, { glow: 0.8 });
      }
      barricade(K, -22, -144, true); barricade(K, -8, -164); supply(K, 4, -150);
      thresher(K, -26, 26, -150, 0.7);
      thresher(K, -4, 32, -176, -0.4, 11);
      K.light(-14, 6, -152, HAZ, 8, 28);
      K.light(-48, 6, -152, HAZ, 7, 24); K.light(2, 5, -138, HAZ, 6, 22); K.light(-34, 5, -178, HAZ, 6, 22);
      // rim rock on the plateau's far edge, the field below
      for (const [x, z, r, h] of [[-62, -128, 3.4, 6], [-60, -176, 3.6, 7], [12, -136, 3, 5]]) cliff(K, x, z, r, h, { taper: 0.8, collide: false });

      // ---- The Drill: a walled compound under the great rig, entered by the descent ramp. Psion pods feed the rig; a gun terrace on the east wall ----
      bulwark(K, -6, -192, 46, -192, 9, { t: 3, face: -1, gaps: [[2, 18]], banners: true });
      K.door(4, -192, 16, 9, 'x', { zone: 2, t: 3, color: CAB2, trim: HAZR });
      hazardPost(K, -5.5, -189, 6); K.light(-5.5, 7, -189, HAZ, 8, 24);
      K.light(13.5, 7, -189, HAZ, 8, 24);
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
          vbox(K, RX, y, RZ + s * 4.6, 10.4, 1, 1, CAB);
          vbox(K, RX + s * 4.6, y, RZ, 1, 1, 10.4, CAB);
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
      // the Psion pods that run the drill, linked to the rig by lit cables
      psionPod(K, 8, -234, 5); psionPod(K, 21, -240, 6.5); psionPod(K, 14, -200, 4.5);
      strip(K, 8, -234, 28, -232, 0.5, PSI, { y: 0.04, glow: 1.4 });
      strip(K, 21, -240, 28, -234, 0.5, PSI, { y: 0.04, glow: 1.4 });
      K.light(14, 4, -236, PSI, 6, 20);
      // scaffolds, pipes and the gun terrace (reached by the terrain ramp from the floor)
      scaffold(K, -1.5, -218, 3, 20, 8);
      scaffold(K, 30, -196.5, 12, 3, 7);
      pipe(K, 'x', 30, -4, -234, 7, 0.8);
      gunNest(K, 38, -212, -1.57);
      vbox(K, 33.4, 0.1, -212, 0.3, 0.1, 20, HAZ, { glow: 1.6 });
      // cover around the boss floor, off the mirror
      barricade(K, 9, -208); barricade(K, 28, -222, true); barricade(K, 2, -226, true);
      supply(K, 24, -204); supply(K, 4, -214, true);
      hazardPost(K, 43, -196, 5); hazardPost(K, -3, -240, 5);
      K.light(14, 7, -206, HAZ, 7, 26);
      K.light(0, 7, -236, HAZ, 7, 24); K.light(40, 7, -200, HAZ, 7, 24); K.light(24, 8, -226, HAZR, 7, 22);
    },
  },

  // -------------------------------------------------------------------------
  // The Pyramidion (U16e High Ground). Rhythm:
  //   a night bluff above Excavation Site XII; the haul road drops into the dig pit (combat on the pit floor, cranes overhead) ->
  //   the open end of the pit runs into the roofed Aphix Conduit (a Vex hall, a dais in the nave) -> a ramp climbs out of the
  //   hall onto the pyramid's plateau (combat during traversal) -> the Pyramidion Gate plaza under the black pyramid ->
  //   the off-centre gate and Protheon's Chamber. Elevation 0 to 8.4 m.
  // -------------------------------------------------------------------------
  io3: {
    spawn: [0, 18],
    bounds: [-70, 70, -282, 30],
    zones: [
      { name: 'Excavation Site XII', x: 0, z: -42 },
      { name: 'Aphix Conduit', x: 14, z: -102 },
      { name: 'Pyramidion Gate', x: 0, z: -168 },
      { name: "Protheon's Chamber", x: 0, z: -234, boss: true, room: { minX: -23, maxX: 23, minZ: -257, maxZ: -211 } },
    ],
    noEdge: false,
    terrain: [
      // the dig: arms of undisturbed ground either side of the pit, the spawn bluff across the south end, the pit open to the north
      { type: 'plateau', x: -50, z: -40, w: 40, d: 56, h: 7.2, edge: 3 },
      { type: 'plateau', x: 50, z: -40, w: 36, d: 56, h: 6.4, edge: 3 },
      { type: 'plateau', x: 0, z: 16, w: 150, d: 58, h: 8.4, edge: 3 },
      // a bench along the east wall of the pit under the half-dug Vex gate
      { type: 'plateau', x: 24, z: -52, w: 10, d: 24, h: 2.6, edge: 2 },
      // the pyramid's plateau: the plaza, the pyramid and the chamber floor
      { type: 'plateau', x: 0, z: -215, w: 120, d: 138, h: 4.8, edge: 3 },
      // routes: the haul road into the pit, up to the bench, out of the Conduit onto the plateau
      { type: 'ramp', x0: -26, z0: -14, x1: -26, z1: -56, width: 8, h0: 8.4, h1: 0 },
      { type: 'ramp', x0: 24, z0: -22, x1: 24, z1: -42, width: 6, h0: 0, h1: 2.6, edge: 8 },
      { type: 'ramp', x0: 8, z0: -134, x1: 4, z1: -158, width: 10, h0: 0, h1: 4.8 },
    ],
    sky: {
      // night: a dim banded Jupiter overhead, a hard field of stars, teal mist hugging the ground, the black pyramid's own glow
      zenith: 0x02060e, mid: 0x0a2430, horizon: 0x1e5a5a, floor: 0x0a1618, fog: 0x0c2a2e,
      stars: { n: 900, color: 0xe4f2ff, size: 2.2, min: 0.04 },
      bodies: [
        { color: 0x9a7a58, size: 250, pos: [-170, 270, -400], bands: [0x9a7a58, 0x6a3a28, 0xb89a70, 0x5a3020, 0x8a6a48, 0x7a4a34] },
        { color: 0xc8d8e0, size: 10, pos: [320, 200, -360] },
      ],
      ridges: [{ r: 620, h: [30, 100], color: 0x10242a, haze: 0.4, steps: 66 }, { r: 540, h: [15, 50], color: 0x0c1c20, haze: 0.2, steps: 84 }],
      skyline: [{ kind: 'spire', n: 8, r: [470, 620], h: [50, 140], w: [10, 18], color: 0x081418, haze: 0.3 }],
      haze: [{ color: 0x2a9a90, opacity: 0.42, r: 470, h: 70, y: -10 }],
    },
    build(K) {
      const { R } = K;

      // ---- Excavation Site XII: an open dig pit below a bluff. Cranes work the pit from the arms, the haul road drops in from the west ----
      flat(K, 0, -42, 62, 52, DIRT, { y: 0.02 });
      flat(K, -6, -38, 30, 22, DIRT2, { y: 0.035 });
      flat(K, 9, -50, 14, 12, DIRT3, { y: 0.05 });
      // exposed Vex relics in the pit, a half-dug Vex gate on the bench at the north end
      vexCube(K, 10, 0, -46, 2.4); vexCube(K, -10, 0, -32, 1.8);
      K.box(-4, -50, 1.6, 3, 1.6, VW); vbox(K, -4, 3.2, -50, 2, 0.4, 2, VB); vbox(K, -4, 2.2, -50, 1.66, 0.3, 1.66, MILK, { glow: 1.2 });
      vbox(K, 14, 0.4, -34, 4, 0.8, 1.2, VW2, { ry: 0.4 });
      vexGate(K, 24, 8.2, -63, 6.2, 0);
      K.light(24, 6, -60, MILK, 6, 22);
      // scaffolds in the pit, floodlights and cranes on the arms
      scaffold(K, 14, -28, 6, 8, 8, 2);
      scaffold(K, -14, -56, 8, 6, 6, 2);
      floodlight(K, -33, -22, 9, 0); floodlight(K, -33, -58, 9, 0.5);
      floodlight(K, 35, -26, 9, Math.PI); floodlight(K, 35, -54, 9, 2.7);
      crane(K, -50, -34, 26, 30, 0);
      crane(K, 52, -32, 22, 24, Math.PI);
      // the Red Legion dig crew's gear, set where they have dug in
      barricade(K, 14, -24); barricade(K, -8, -48, true); barricade(K, 20, -62);
      supply(K, 22, -40, true); supply(K, -17, -38); supply(K, 8, -60);
      hazardPost(K, -18, -62, 3.5); hazardPost(K, 22, -30, 3.5);
      for (const [x, z, sz] of [[-17, -26, 2.2], [-12, -60, 2.6], [15, -66, 2], [2, -24, 1.6]]) K.rock(x, z, sz);
      K.light(-18, 9, -30, FLOOD, 10, 34);
      K.light(20, 9, -46, FLOOD, 10, 34);
      K.light(-30, 6, -56, FLOOD, 7, 24);
      // up on the bluff: the dig office, a floodlit overlook, rubble
      hab(K, -44, 6, 10, 8, 5); hab(K, 38, 2, 8, 7, 4.5);
      floodlight(K, -14, -8, 9, -1.57); floodlight(K, 14, -8, 9, -1.57);
      supply(K, 24, -4, true); barricade(K, -26, -6);
      for (const [x, z, s] of [[-30, 10, 2.4], [30, 14, 2], [-8, 4, 1.6]]) K.rock(x, z, s);
      K.light(-44, 6, 6, FLOOD, 6, 24); K.light(0, 9, -6, FLOOD, 8, 30);

      // ---- Aphix Conduit: a roofed Vex hall of white and brass pillars, a dais in the nave ----
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
      K.box(-1, HZ, 14, 1, 58, VD, { y: 14.05 });
      K.box(29, HZ, 14, 1, 58, VD, { y: 14.05 });
      K.box(HX, HZ, 16.2, 0.8, 58, VD, { y: 14.4 });
      for (let z = -78; z >= -126; z -= 8) { vbox(K, HX, 14.2, z, 16, 0.8, 1.2, VB); vbox(K, HX, 14.0, z - 4, 12, 0.1, 0.5, MILK, { glow: 1.4 }); }
      // pillars off the grid: one snapped short, one toppled across the nave
      vexPillar(K, 3, -82, 14); vexPillar(K, 26, -87, 14, { eye: false }); vexPillar(K, 3, -99, 6, { eye: false });
      vexPillar(K, 25, -108, 14); vexPillar(K, 4, -117, 14, { eye: false }); vexPillar(K, 26, -124, 14);
      K.box(17, -121, 13, 1.7, 1.9, VW);
      vbox(K, 17, 1.0, -121, 13.2, 0.4, 2.1, VB, {}); vbox(K, 17, 0.9, -121, 2, 1.8, 2.2, VRED, { glow: 1.2 });
      // milky glowing channels in the floor
      flat(K, HX, HZ, 44, 56, VD, { y: 0.02 });
      flat(K, HX, HZ, 1.4, 56, MILK, { y: 0.05, glow: 1.4 });
      for (const x of [8, 20]) flat(K, x, HZ, 0.6, 52, MILK, { y: 0.05, glow: 1.1 });
      for (const z of [-86, -118]) flat(K, HX, z, 40, 0.6, MILK, { y: 0.05, glow: 1.1 });
      // the dais: a raised Vex platform in the middle of the nave, stairs both ends
      K.platform(HX, HZ, 12, 10, 2.4, { stairs: ['w', 'e'], color: VW2, stairColor: VW, stairW: 3 });
      K.mesh(new THREE.TorusGeometry(4, 0.25, 3, 20).rotateX(Math.PI / 2), MILK, HX, 2.5, HZ, { glow: 1.4 });
      for (const [x, y, z, s] of [[6, 10, -88, 1.6], [22, 11, -112, 2], [14, 9, -122, 1.4], [10, 10.5, -96, 1.2]]) vexCube(K, x, y, z, s, { ry: R(0, 1.5) });
      vexCube(K, 19, 0, -92, 1.6); vexCube(K, 9, 0, -112, 1.8);
      K.light(HX, 9, HZ, MILK, 10, 36);
      for (const z of [-82, -92, -112, -122]) K.light(HX, 11, z, MILK, 7, 24);
      for (const [x, z] of [[-4, -90], [-4, -114], [32, -90], [32, -114]]) K.light(x, 9, z, VRED, 4, 16);

      // ---- Pyramidion Gate: the plaza on the pyramid's plateau, the gate off to the west of the black pyramid's face ----
      const PZ = -234, PH = 95, PS = 40, GX = -13;
      K.mesh(new THREE.ConeGeometry(PS * Math.SQRT2, PH, 4), VD, 0, PH / 2, PZ, { ry: Math.PI / 4 });
      for (const y of [18, 38, 58, 76]) {
        const s = PS * (1 - y / PH) + 0.15;
        for (const sg of [-1, 1]) {
          vbox(K, 0, y, PZ + sg * s, s * 2, 0.3, 0.3, MILK, { glow: 0.8 });
          vbox(K, sg * s, y, PZ, 0.3, 0.3, s * 2, MILK, { glow: 0.8 });
        }
      }
      // colliding plinth around the whole footprint (gate gap on the north face)
      K.wall(-PS, PZ + PS, PS, PZ + PS, 5, { t: 3, color: VBR, gaps: [[PS + GX - 6, PS + GX + 6]] });
      K.wall(-PS, PZ - PS, PS, PZ - PS, 5, { t: 3, color: VBR });
      K.wall(-PS, PZ - PS, -PS, PZ + PS, 5, { t: 3, color: VBR });
      K.wall(PS, PZ - PS, PS, PZ + PS, 5, { t: 3, color: VBR });
      vbox(K, (-PS + GX - 6) / 2, 4.6, PZ + PS + 1.55, GX - 6 + PS, 0.3, 0.2, MILK, { glow: 1.2 });
      vbox(K, (PS + GX + 6) / 2, 4.6, PZ + PS + 1.55, PS - GX - 6, 0.3, 0.2, MILK, { glow: 1.2 });
      // the gate portal, glowing frame and film
      for (const sx of [-1, 1]) {
        K.box(GX + sx * 8, PZ + PS + 0.7, 3.6, 18, 4, VW);
        vbox(K, GX + sx * 8, 9, PZ + PS + 2.55, 1.2, 14, 0.2, MILK, { glow: 1.5 });
        vbox(K, GX + sx * 6.1, 7, PZ + PS + 2.2, 0.3, 14, 0.4, MILK, { glow: 2 });
      }
      K.box(GX, PZ + PS + 0.5, 20, 3, 4, VW, { y: 15 });
      vbox(K, GX, 14, PZ + PS + 2.2, 12.4, 0.3, 0.4, MILK, { glow: 2 });
      K.mesh(new THREE.OctahedronGeometry(1.4, 0), VRED, GX, 20.5, PZ + PS + 2.6, { glow: 2.6 });
      ghost(K, new THREE.PlaneGeometry(12, 14), MILK, 0.16, GX, K.ground(GX, PZ + PS) + 7, PZ + PS + 1.8);
      // passage through the pyramid wall to the chamber
      K.box(GX - 7, PZ + PS - 8, 1.8, 12, 16, VBR);
      K.box(GX + 7, PZ + PS - 8, 1.8, 12, 16, VBR);
      K.box(GX, PZ + PS - 8, 16, 1, 16, VD, { y: 12 });
      for (const sx of [-1, 1]) vbox(K, GX + sx * 5.9, 5, PZ + PS - 8, 0.2, 0.4, 16, MILK, { glow: 1.4 });
      flat(K, GX, PZ + PS - 8, 1.2, 16, MILK, { y: 0.05, glow: 1.4 });
      // plaza: obelisks that are not a pair, a cluster of broken Vex construct to one side, Legion barricades, glowing lines to the gate
      vexPillar(K, -32, -180, 26, { w: 3 }); vexPillar(K, 28, -156, 16, { w: 2.4 });
      K.box(-38, -152, 15, 2.4, 2.4, VW); vbox(K, -38, 1.3, -152, 15.2, 0.4, 2.6, VB); vbox(K, -31, 1.6, -152, 1.4, 2.2, 2.7, VRED, { glow: 1.1 });
      vexPillar(K, -17, -176, 8, { w: 1.9, eye: false }); vexPillar(K, -22, -170, 11, { w: 2.2 }); vexPillar(K, -14, -182, 6, { w: 1.7, eye: false });
      for (const [x, z, s] of [[-10, -153, 2.4], [14, -178, 2], [24, -170, 1.6], [12, -151, 1.8], [-27, -163, 1.4]]) vexCube(K, x, 0, z, s);
      barricade(K, 10, -148, true); barricade(K, -2, -152); supply(K, 16, -150);
      strip(K, 3, -158, GX, PZ + PS + 1, 1.2, MILK, { y: 0.05, glow: 1.4 });
      strip(K, 12, -156, GX + 5, PZ + PS + 1, 0.5, MILK, { y: 0.05, glow: 1.1 });
      strip(K, -4, -158, GX - 5, PZ + PS + 1, 0.5, MILK, { y: 0.05, glow: 1.1 });
      for (const [x, y, z, s] of [[-18, 14, -168, 2.4], [16, 18, -166, 2], [4, 24, -176, 3], [-8, 20, -150, 1.6]]) vexCube(K, x, y, z, s, { ry: R(0, 1.5) });
      K.light(GX, 8, PZ + PS + 4, MILK, 10, 30);
      // a single Vex lookout on the east side, up a stair
      K.platform(34, -176, 8, 12, 2.8, { stairs: ['w'], color: VW2, stairColor: VW });
      vbox(K, 30.05, 2.9, -176, 0.1, 0.15, 12, MILK, { glow: 1.6 }); K.light(34, 6, -176, MILK, 7, 24);
      for (const [x, z] of [[-24, -176], [20, -164], [0, -150]]) K.light(x, 9, z, MILK, 6, 22);

      // ---- Protheon's Chamber: a roofed Vex hall inside the pyramid, entered off-centre, one gallery, uneven pillars ----
      const CX = 0, CZ = PZ, CW = 48, CH = 16;
      K.room(CX, CZ, CW, CW, CH, { t: 2, color: VW2, doors: { s: 12 }, doorOffset: { s: GX }, roof: true, roofColor: VD });
      // sealed Vex door in the chamber doorway: opens when the Pyramidion Gate is cleared
      K.door(GX, CZ + CW / 2, 12, 14, 'x', { zone: 2, t: 2, color: VBR, trim: MILK });
      for (const sx of [-1, 1]) {
        vbox(K, GX + sx * 6.4, 7, CZ + CW / 2 + 1.1, 0.5, 14, 0.3, VB);
        vbox(K, GX + sx * 6.4, 8, CZ + CW / 2 - 1.1, 0.3, 11, 0.2, MILK, { glow: 1.6 });
      }
      flat(K, CX, CZ, CW - 2, CW - 2, VD, { y: 0.02 });
      // wall pilasters and milky slits
      for (let s = -18; s <= 18; s += 9) {
        for (const [x, z, ry] of [[-22.9, CZ + s, 0], [22.9, CZ + s, 0], [s, CZ - 22.9, Math.PI / 2]]) {
          if (ry && s === 0) continue; // the big gate sits there
          vbox(K, x, CH / 2, z, 1.2, CH, 1.2, VB, { ry });
          vbox(K, x + (ry ? 2.2 : 0), CH * 0.6, z + (ry ? 0 : 2.2), 0.3, CH * 0.5, 0.3, MILK, { glow: 1.3 });
        }
      }
      // pillars: three standing, one snapped, one lying across the floor
      vexPillar(K, CX - 16, CZ - 14, CH, { w: 3 }); vexPillar(K, CX + 13, CZ - 16, CH, { w: 3 }); vexPillar(K, CX + 15, CZ + 11, CH, { w: 3 });
      vexPillar(K, CX - 14, CZ + 14, 4.5, { w: 3, eye: false });
      K.box(CX + 7, CZ + 16, 11, 2.2, 2.6, VW); vbox(K, CX + 7, 1.15, CZ + 16, 11.2, 0.4, 2.8, VB);
      // Vex gates on the walls
      vexGate(K, CX - 22.6, 6, CZ - 13.5, 3.2, Math.PI / 2);
      vexGate(K, CX + 22.6, 6, CZ - 5, 3.2, -Math.PI / 2);
      vexGate(K, CX + 22.6, 6, CZ + 6, 3.2, -Math.PI / 2);
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
      // two great shards of broken construct as cover, and smaller cubes
      K.box(9, CZ + 3, 3.4, 3.6, 2.4, VW2); vbox(K, 9, 3.9, CZ + 3, 3.2, 0.5, 2.2, VB, { rz: 0.2 });
      K.box(-9, CZ - 8, 2.4, 2.8, 3.6, VW2); vbox(K, -9, 3.1, CZ - 8, 2.2, 0.5, 3.4, VB, { rx: -0.2 });
      for (const [x, z, s] of [[-9, CZ + 12, 1.4], [3, CZ - 11, 1.2], [-12, CZ + 2, 1.2]]) vexCube(K, x, 0, z, s);
      K.light(CX, 10, CZ, MILK, 14, 40);
      K.light(CX, 5, CZ - 20, VRED, 9, 28);
      for (const [x, z] of [[-19, CZ - 19], [19, CZ - 19], [-19, CZ + 19], [19, CZ + 19], [GX, CZ + 20]]) K.light(x, 8, z, MILK, 7, 24);
      // a single Vex gallery on the west wall (stairs from the floor)
      K.platform(-20, CZ - 3, 4, 12, 2.8, { stairs: ['s'], color: VW2, stairColor: VW, stairW: 3 });
      vbox(K, -17.95, 2.9, CZ - 3, 0.1, 0.15, 12, MILK, { glow: 1.8 });
    },
  },
};
