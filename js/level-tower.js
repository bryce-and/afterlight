// Hand-built Tower hub map (see makeKit in world.js). Laid out from the Destiny 1 Tower map (docs/reference/d1-tower-map.webp)
// and dressed from the Tower Watch screenshot (docs/reference/d1-tower-watch.webp): grey concrete, blue-grey ribbed steel, rust,
// grass beds, red banners and red-leaved trees under warm sun. A social hub: no enemies.
// Layout (x east, z south, north is -z; the visitor arrives at the south of the Watch looking north):
//   Tower Watch      x -30..26, z -22..20     the big plaza: Postmaster octagon, Vaults, Gunsmith, Cryptarch, Bounties, Special Orders
//   Hall of Guardians x -19..29, z -76..-22   reached by a short corridor off the Watch's north side; the Vanguard dais; Traveler's Walk overlook at the far end
//   Tower North      x -76..-30, z -30..6     west of the Watch: the Outfitter band, the New Monarchy spine, the round Speaker's chamber
//   Tower Hangar     x 30..88, z -72..8       a long walk east then north from the Watch, opening into the hangar bay
//   South Tower range x -9..9, z 20..70       walled lane south of the Watch (the one place the D1 map did not show)
// yaw convention for TOWER_SPOTS: yaw 0 faces -z (north), forward = (-sin yaw, -cos yaw); yaw PI faces +z (south).
import * as THREE from 'three';
import { TOWER_SPOTS } from './tower-data.js';

// concrete, steel, rust, grass, red (reference palette)
const CON = 0xb8bcbd, CON2 = 0x9fa5a8, CON3 = 0x80878c;
const PAVE = 0xa9a79f, PAVE2 = 0x97958e, PAVE3 = 0x84827c, GRAVEL = 0x8d8a80, GRAVEL2 = 0x7a786f;
const STEEL = 0x3a5775, STEEL2 = 0x2a4260, STEELL = 0x56789a;
const RUST = 0x8a5a3c, BRASS = 0xc89a4a, BRASSL = 0xf0c468, BRONZE = 0x8a6234;
const GRASS = 0x7b9a42, GRASS2 = 0x68863a, LEAF = 0xb02b22, LEAF2 = 0xcc4a30, BARK = 0x5a4636;
const RED = 0xb02a2a, ORANGE = 0xe08a30, TITAN = 0x2a62c8, HUNTER = 0xb02a2a, WARLOCK = 0xd9a62e;
const GLASS = 0xaee0ff, HOLO = 0xfff0c0;
const FL = 0.02; // paving top: the Tower's ground is flat (-0.08), the paving sits just above it and above the physics ground (y 0)

let _ub = null;
const UB = () => _ub || (_ub = new THREE.BoxGeometry(1, 1, 1));

// visual-only box, any rotation, no collider
function vbox(K, x, y, z, w, h, d, color, o = {}) {
  return K.mesh(UB(), color, x, y, z, { rx: o.rx, ry: o.ry, rz: o.rz, scale: [w, h, d], glow: o.glow });
}

// flat paved polygon (points are [x, z]), top at `top`. Visual only.
function floorPoly(K, pts, color, top = FL) {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))));
  geo.rotateX(-Math.PI / 2);
  const m = K.mesh(geo, color, 0, top, 0, {});
  m.castShadow = false;
  return m;
}

// flat round or octagonal patch (visual), sits `lift` above the paving. Each stacked layer must use a higher lift.
function disc(K, x, z, r, color, lift, sides = 28, glow = 0) {
  const m = K.mesh(new THREE.CylinderGeometry(r, r, 0.04, sides), color, x, FL + lift, z, { glow });
  m.castShadow = false;
  return m;
}

// thin decal on the paving
function decal(K, x, z, w, d, color, glow = 0, lift = 0.02, ry = 0) {
  const m = vbox(K, x, FL + lift, z, w, 0.04, d, color, { glow, ry });
  m.castShadow = false;
  return m;
}

// translucent unlit box (glass, light shafts, mist)
function pane(K, x, y, z, w, h, d, color, opacity = 0.25, add = false) {
  const m = new THREE.Mesh(UB(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  K.scene.add(m);
  return m;
}

// text on a flat plane (canvas texture), faces +z at ry 0. Skipped when there is no document (headless checks).
const _texCache = new Map();
function sign(K, x, y, z, w, h, text, ry = 0, bg = '#243a52', fg = '#f0d08a') {
  if (typeof document === 'undefined') return null;
  const key = `${text}|${bg}|${fg}`;
  let tex = _texCache.get(key);
  if (!tex) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = Math.max(64, Math.round(1024 * h / w));
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(10, 10, c.width - 20, c.height - 20);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = c.height * 0.5;
    g.font = `bold ${fs}px sans-serif`;
    while (g.measureText(text).width > c.width - 80 && fs > 12) { fs -= 4; g.font = `bold ${fs}px sans-serif`; }
    g.fillText(text, c.width / 2, c.height / 2 + 4);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    _texCache.set(key, tex);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  K.scene.add(m);
  return m;
}

// Floating map-style symbol over a person (the Destiny 1 map's diamond icons) instead of a text label. Billboard sprite. Only people who exist
// get one (Zavala, Cayde-6, Ikora, Kadi); the stalls keep empty posts for later (TOWER_FUTURE_POSTS in tower-data.js).
const _symCache = new Map();
function symbol(K, x, y, z, kind, size = 1.7) {
  if (typeof document === 'undefined') return null;
  let tex = _symCache.get(kind);
  if (!tex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.translate(64, 64);
    g.beginPath(); g.moveTo(0, -58); g.lineTo(58, 0); g.lineTo(0, 58); g.lineTo(-58, 0); g.closePath();
    g.fillStyle = 'rgba(70,104,170,0.88)'; g.fill();
    g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke();
    g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = 7; g.lineJoin = 'round'; g.lineCap = 'round';
    if (kind === 'shield') { g.beginPath(); g.moveTo(-17, -22); g.lineTo(17, -22); g.lineTo(17, 4); g.lineTo(0, 24); g.lineTo(-17, 4); g.closePath(); g.stroke(); }
    else if (kind === 'cube') { g.beginPath(); g.moveTo(0, -24); g.lineTo(21, -12); g.lineTo(21, 12); g.lineTo(0, 24); g.lineTo(-21, 12); g.lineTo(-21, -12); g.closePath(); g.moveTo(-21, -12); g.lineTo(0, 0); g.lineTo(21, -12); g.moveTo(0, 0); g.lineTo(0, 24); g.stroke(); }
    else if (kind === 'bullet') { g.beginPath(); g.moveTo(0, -26); g.quadraticCurveTo(14, -12, 12, 0); g.lineTo(12, 24); g.lineTo(-12, 24); g.lineTo(-12, 0); g.quadraticCurveTo(-14, -12, 0, -26); g.closePath(); g.stroke(); }
    else if (kind === 'x') { g.beginPath(); g.moveTo(-20, -20); g.lineTo(20, 20); g.moveTo(20, -20); g.lineTo(-20, 20); g.stroke(); }
    else if (kind === 'burst') { g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); g.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); } g.stroke(); }
    else { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; g.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); } g.closePath(); g.stroke(); g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.stroke(); }
    tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    _symCache.set(kind, tex);
  }
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, depthWrite: false }));
  m.scale.set(size, size, 1); m.position.set(x, y, z);
  K.scene.add(m);
  return m;
}

// Oriented wall from (x1,z1) to (x2,z2) with a colliding body, a concrete footing and cap, and steel ribs. gaps are [from, to]
// distances along the wall; each becomes a doorway with a lintel above doorH. Ends reach t/2 past the points so corners close.
function owall(K, x1, z1, x2, z2, h, o = {}) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, ry = -Math.atan2(dz, dx);
  const t = o.t ?? 1, color = o.color ?? STEEL, dh = o.doorH ?? 5.4, ribs = o.ribs ?? h > 3, Y = o.y ?? 0;
  const gaps = (o.gaps || []).slice().sort((a, b) => a[0] - b[0]);
  const at = (a) => [x1 + ux * a, z1 + uz * a];
  const piece = (a, b, hh, y0, col, tt, ext) => { // body between distances a and b
    const a2 = a - (a <= 0 ? ext : 0), b2 = b + (b >= len ? ext : 0), L = b2 - a2;
    if (L < 0.15) return;
    const [cx, cz] = at((a2 + b2) / 2);
    return K.obox(cx, cz, L, hh, tt, ry, col, { y: y0 });
  };
  const vis = (a, b, y, hh, tt, col, ext = 0) => { // visual trim between a and b
    const a2 = a - (a <= 0 ? ext : 0), b2 = b + (b >= len ? ext : 0), L = b2 - a2;
    if (L < 0.15) return;
    const [cx, cz] = at((a2 + b2) / 2);
    return vbox(K, cx, y, cz, L, hh, tt, col, { ry });
  };
  let from = 0;
  const runs = [];
  for (const [a, b] of [...gaps, [len, len]]) { if (a > from) runs.push([from, a]); from = Math.max(from, b); }
  for (const [a, b] of runs) {
    piece(a, b, h, Y, color, t, t / 2);
    vis(a, b, Y + h + 0.15, 0.3, t + 0.4, CON, t / 2);       // cap
    vis(a, b, Y + 0.35, 0.7, t + 0.35, CON2, t / 2);         // footing
    if (ribs) for (let d = Math.ceil(a / 4) * 4 + 2; d < b - 1; d += 4) { const [rx, rz] = at(d); vbox(K, rx, Y + h / 2, rz, 0.4, h, t + 0.3, STEEL2, { ry }); }
  }
  for (const [a, b] of gaps) {
    const A = Math.max(0, a), B = Math.min(len, b);
    if (h > dh + 0.2) { const [cx, cz] = at((A + B) / 2); K.obox(cx, cz, B - A, h - dh, t, ry, CON2, { y: dh }); }
    for (const d of [A - 0.25, B + 0.25]) { const [jx, jz] = at(d); vbox(K, jx, Math.min(dh, h) / 2, jz, 0.5, Math.min(dh, h), t + 0.35, CON, { ry }); }
  }
}

// walls round a polygon; per[i] overrides edge i (from pts[i] to pts[i+1]): { skip, h, gaps, t, color }
function wallsAround(K, pts, base, per = {}) {
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length], o = { ...base, ...(per[i] || {}) };
    if (!o.skip) owall(K, p[0], p[1], q[0], q[1], o.h, o);
  });
}

// low railing wall (a cliff edge or a balcony): concrete with a brass top
function rail(K, x1, z1, x2, z2, y = 0) {
  owall(K, x1, z1, x2, z2, 1.2, { t: 0.5, color: CON, ribs: false, y });
}

// hanging cloth banner, 'z' hangs on a wall that faces z, 'x' on one that faces x
function banner(K, x, y, z, color, axis = 'z', h = 4, w = 1.6) {
  const f = (a, b, c) => (axis === 'z' ? [a, b, c] : [c, b, a]);
  vbox(K, x, y + h / 2 + 0.1, z, ...f(w + 0.4, 0.2, 0.2), CON3);
  vbox(K, x, y, z, ...f(w, h, 0.1), color);
  vbox(K, x, y - h * 0.1, z, ...f(w * 0.45, w * 0.45, 0.16), BRASSL, { rz: Math.PI / 4, glow: 0.4 });
  vbox(K, x, y - h / 2 - 0.1, z, ...f(w + 0.2, 0.18, 0.14), CON3);
}

function lamp(K, x, y, z, color = 0xffe8c0, intensity = 6, dist = 26) {
  K.light(x, y, z, color, intensity, dist);
}

// lamp post: concrete base, steel stem, glowing lantern
function lampPost(K, x, z, withLight = true) {
  K.cyl(x, z, 0.35, 0.8, CON2, { sides: 6 });
  K.cyl(x, z, 0.12, 3.6, STEEL2, { sides: 5, collide: false });
  vbox(K, x, 4.0, z, 0.6, 0.12, 0.6, STEELL, { glow: 0.5 });
  if (withLight) lamp(K, x, 3.8, z, 0xffe8c0, 5, 24);
}

// low bench (collides, so it is solid furniture)
function bench(K, x, z, alongX = true, len = 2.4) {
  const w = alongX ? len : 0.7, d = alongX ? 0.7 : len;
  K.box(x, z, w, 0.5, d, CON2);
  vbox(K, x, 0.55, z, w + 0.1, 0.1, d + 0.1, BRONZE);
}

// raised bed with a concrete rim and grass
function bed(K, x, z, w, d, grass = GRASS) {
  K.box(x, z, w, 0.5, d, CON2);
  vbox(K, x, 0.52, z, w - 0.4, 0.06, d - 0.4, grass);
}

// the Tower's red-leaved tree, in a bed
function tree(K, x, z, s = 1) {
  bed(K, x, z, 3.2 * s, 3.2 * s, GRASS2);
  K.cyl(x, z, 0.5 * s, 5 * s, BARK, { sides: 6, r2: 0.28 * s, y: 0.5 });
  for (const [dx, dy, dz, r, c] of [[0, 6.4, 0, 2.5, LEAF], [-1.8, 5.6, 0.8, 1.9, LEAF2], [1.7, 5.8, -0.9, 2.0, LEAF2], [0.4, 7.8, 0.2, 1.6, LEAF]]) {
    K.mesh(new THREE.IcosahedronGeometry(r * s, 1), c, x + dx * s, dy * s, z + dz * s, {});
  }
}

// tapered concrete monolith with a red banner on its south face (the Watch's tall markers)
function monolith(K, x, z, h = 9, flag = true, color = RED) {
  K.cyl(x, z, 0.95, h, CON, { sides: 4, r2: 0.4, ry: Math.PI / 4 });
  vbox(K, x, 0.4, z, 1.9, 0.8, 1.9, CON2);
  if (flag) { banner(K, x, h - 3.2, z + 0.62, color, 'z', 4.2, 1.0); vbox(K, x, h + 0.1, z, 0.3, 0.9, 0.3, RED, { glow: 0.5 }); }
}

// map a stall-local (u along the stall, v toward the customer) point to the world; face = side the customer stands on
function stallMap(x, z, face) {
  return (u, v) => ({ s: [x + u, z + v], n: [x - u, z - v], e: [x + v, z + u], w: [x - v, z - u] }[face]);
}

// market stall: back wall, counter, side posts, awning. kind picks the dressing.
function stall(K, x, z, face, len, kind, awning = STEEL) { // the NPC post for a stall is in TOWER_FUTURE_POSTS (tower-data.js)
  const P = stallMap(x, z, face);
  const swap = face === 'e' || face === 'w';
  const B = (u, v, w, h, d, color, y = 0, collide = true) => {
    const [wx, wz] = P(u, v);
    return K.box(wx, wz, swap ? d : w, h, swap ? w : d, color, { y, collide });
  };
  const Vb = (u, v, w, h, d, color, y, glow) => {
    const [wx, wz] = P(u, v);
    return vbox(K, wx, y, wz, swap ? d : w, h, swap ? w : d, color, { glow });
  };
  B(0, -1.9, len, 3.2, 0.5, CON3);              // back wall
  B(0, 0, len - 0.6, 1.1, 0.9, CON, 0);          // counter
  Vb(0, 0, len - 0.3, 0.12, 1.1, BRONZE, 1.16);
  for (const s of [-1, 1]) B(s * (len / 2 - 0.2), 1.0, 0.4, 3.6, 0.4, STEEL2); // front posts
  Vb(0, -0.4, len + 1.2, 0.35, 3.8, awning, 3.9); // awning slab
  Vb(0, 1.55, len + 1.2, 0.45, 0.3, STEEL2, 3.7);
  if (kind === 'gun') {
    for (let k = -2; k <= 2; k++) { Vb(k * (len / 6), -1.58, 0.14, 0.14, 1.4, 0x2a323a, 2.2); Vb(k * (len / 6), -1.58, 0.1, 0.5, 0.3, 0x2a323a, 1.5); }
    Vb(0, -1.62, len - 1, 0.12, 0.24, BRASS, 2.9);
    Vb(0, 0, 1.4, 0.2, 0.4, 0x2a323a, 1.3);
  } else if (kind === 'crypt') {
    Vb(0, 0, 0.8, 0.8, 0.8, HOLO, 1.7, 1.4);
    Vb(-len * 0.3, -1.2, 0.6, 0.6, 0.6, BRASSL, 1.5, 0.9); Vb(len * 0.3, -1.2, 0.6, 0.6, 0.6, GLASS, 1.5, 0.9);
    Vb(0, -1.62, len - 1, 0.1, 0.3, 0x6a5a8a, 2.6, 0.6);
  } else if (kind === 'mail') {
    for (let k = -2; k <= 2; k++) { Vb(k * (len / 5), -1.6, len / 5 - 0.2, 0.9, 0.2, k % 2 ? 0x5d7a94 : BRONZE, 1.5); Vb(k * (len / 5), -1.6, len / 5 - 0.2, 0.9, 0.2, k % 2 ? BRONZE : 0x5d7a94, 2.5); }
  } else if (kind === 'bounty') {
    Vb(0, -1.58, len - 1, 1.6, 0.14, 0x1c2630, 2.2); Vb(0, -1.5, len - 1.3, 1.3, 0.1, GLASS, 2.2, 0.8);
  } else if (kind === 'cloth') {
    for (let k = -2; k <= 2; k++) Vb(k * (len / 5), -1.6, len / 6, 1.8, 0.1, [RED, STEELL, ORANGE, CON, GRASS][k + 2], 1.6);
  }
}

// terminal kiosk on a plinth, ~1.2 m wide, facing yaw (0 = -z). Spot and a soft light included.
function kiosk(K, x, z, yaw, color, y0 = 0) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  K.cyl(x, z, 1.3, 0.3, CON3, { sides: 12, collide: false, y: y0 });
  K.obox(x, z, 1.3, 0.95, 0.8, yaw, CON, { y: y0 });                          // plinth
  vbox(K, x, y0 + 1.0, z, 1.45, 0.1, 0.95, STEEL2, { ry: yaw });        // cap
  vbox(K, x + fx * 0.05, y0 + 1.8, z + fz * 0.05, 1.3, 1.1, 0.14, 0x141c26, { ry: yaw }); // screen frame
  vbox(K, x + fx * 0.13, y0 + 1.8, z + fz * 0.13, 1.1, 0.88, 0.05, color, { ry: yaw, glow: 1.2 }); // screen
  vbox(K, x - fx * 0.05, y0 + 1.45, z - fz * 0.05, 0.3, 0.5, 0.3, CON3, { ry: yaw }); // stem
  K.light(x + fx * 0.9, y0 + 2.2, z + fz * 0.9, color, 3.2, 12);
}

// NPC post: a small low platform ring, top at y0 + 0.3
function npcBase(K, x, z, color, y0 = 0) {
  K.cyl(x, z, 1.25, 0.3, CON3, { sides: 14, collide: false, y: y0 });
  K.mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.05, 14), color, x, y0 + 0.31, z, { glow: 0.8 });
}

// training dummy spot: a low ring plinth, top at y = 0.25
function dummyBase(K, x, z, r = 0.95, color = BRASSL) {
  K.cyl(x, z, r + 0.2, 0.25, GRAVEL2, { sides: 12, collide: false });
  K.mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.04, 12), color, x, 0.27, z, { glow: 0.7 });
}

// concrete pillar with a steel cap
function pillar(K, x, z, h, w = 1.4) {
  K.box(x, z, w, h, w, CON);
  vbox(K, x, 0.4, z, w + 0.4, 0.8, w + 0.4, CON2);
  vbox(K, x, h - 0.3, z, w + 0.4, 0.6, w + 0.4, STEEL2);
}

// tall tapered pylon on the skyline (visual only): the Tower's great fins
function pylon(K, x, z, w, h) {
  K.mesh(new THREE.CylinderGeometry(w * 0.22, w * 0.7, h, 4), CON2, x, h / 2, z, { ry: Math.PI / 4 });
  K.mesh(new THREE.CylinderGeometry(w * 0.12, w * 0.12, 6, 4), STEELL, x, h + 2.4, z, { glow: 0.6 });
}

// Vanguard-style ship on a pad: one solid hull, rest is dressing. Nose points toward dir (-1 = north).
function ship(K, x, z, dir, hull, trim) {
  K.box(x, z, 3.6, 2.3, 7.6, hull, { y: 0.1 });
  vbox(K, x, 2.0, z - dir * 0.6, 2.6, 0.8, 4.6, hull);
  K.mesh(new THREE.ConeGeometry(1.7, 3.6, 4), hull, x, 1.3, z + dir * 5.4, { rx: dir * Math.PI / 2, ry: Math.PI / 4 });
  vbox(K, x, 2.3, z + dir * 1.4, 1.8, 0.5, 2.0, GLASS, { glow: 0.5 });
  for (const s of [-1, 1]) {
    vbox(K, x + s * 3.0, 1.0, z - dir * 1.4, 3.6, 0.2, 3.4, trim, { ry: s * dir * 0.5 });
    vbox(K, x + s * 1.1, 1.0, z - dir * 4.0, 0.8, 0.8, 0.5, BRASSL, { glow: 1.8 });
  }
  vbox(K, x, 1.4, z, 3.7, 0.12, 7.7, trim);
}

// hangar landing pad (visual)
function landingPad(K, x, z, s) {
  decal(K, x, z, s, s, PAVE3, 0, 0.02);
  const i = s / 2 - 0.3;
  for (const [dx, dz, w, d] of [[0, -i, s - 0.6, 0.3], [0, i, s - 0.6, 0.3], [-i, 0, 0.3, s - 0.6], [i, 0, 0.3, s - 0.6]]) decal(K, x + dx, z + dz, w, d, ORANGE, 0.7, 0.04);
}

// ---------------------------------------------------------------------------
// the five footprints (see the header). Points are [x, z], clockwise from the north-west.
// ---------------------------------------------------------------------------
const WATCH = [[-30, -22], [18, -22], [26, -14], [26, 12], [16, 20], [-22, 20], [-30, 12]];
const HALL = [[-14, -76], [24, -76], [29, -71], [29, -40], [24, -36], [9, -36], [9, -22], [1, -22], [1, -36], [-14, -36], [-19, -40], [-19, -71]];
const NORTH = [[-76, -30], [-30, -30], [-30, 6], [-42, 6], [-42, -21], [-76, -21]];
const CORRIDOR = [[26, -2], [30, -2], [30, -32], [38, -32], [38, 8], [26, 8]];
const HANGAR = [[38, -72], [120, -72], [120, -6], [52, -6], [52, -22], [38, -22]];
const RANGE = [[-9, 20], [9, 20], [9, 70], [-9, 70]];
const CHAMBER = { x: -60, z: -2, r: 13 };

export const TOWER = {
  tower: {
    spawn: [-9, 12],
    bounds: [-82, 120, -76, 74],
    open: { e: true, n: true }, // the Hangar's east edge and the Hall's great window have no barrier: jump off and you fall
    zones: [],
    noEdge: true,
    build(K) {
      const WH = 7;       // plaza wall height
      const WALL = { h: WH, t: 1.2 };

      // ================= paving =================
      floorPoly(K, WATCH, PAVE);
      floorPoly(K, HALL, 0x9a958a);
      floorPoly(K, NORTH, PAVE);
      floorPoly(K, CORRIDOR, PAVE2);
      floorPoly(K, HANGAR, PAVE2);
      floorPoly(K, RANGE, GRAVEL);
      disc(K, CHAMBER.x, CHAMBER.z, CHAMBER.r, PAVE3, 0.002, 32);
      floorPoly(K, [[-47, -6], [-41, -6], [-41, 2], [-47, 2]], PAVE);        // threshold into the Speaker's chamber

      // ================= walls (doorways are gaps; shared edges are drawn once) =================
      wallsAround(K, WATCH, WALL, {
        0: { gaps: [[31, 39]], doorH: 6 },     // north: the corridor to the Hall
        1: { h: 5 }, 3: { h: 5 }, 5: { h: 5 },
        2: { gaps: [[12, 22]], doorH: 5.4 },   // east: the long way to the Hangar
        4: { gaps: [[10, 22]], doorH: 5.4 },   // south: the range gate
        6: { gaps: [[20, 30]], doorH: 5.4 },   // west: Tower North
      });
      wallsAround(K, HALL, { h: 12, t: 1.4, color: 0x70757f }, {
        0: { gaps: [[8, 30]], doorH: 9 },       // north: the great window onto the Traveler (glass and a barrier fill it)
        6: { skip: true },                      // the gate, drawn by the Watch
      });
      wallsAround(K, NORTH, { h: 8, t: 1.2, color: CON2 }, {
        1: { gaps: [[8, 40]] },                 // the Watch's west wall already stands here
        3: { gaps: [[4, 12]], doorH: 5.4 },     // the passage to the Speaker's chamber
      });
      wallsAround(K, CORRIDOR, { h: 7, t: 1.2, color: CON2 }, {
        5: { skip: true },
        3: { gaps: [[2, 8]], doorH: 6 },        // the Hangar's west door
      });
      wallsAround(K, HANGAR, { h: 12, t: 1.4 }, {
        1: { skip: true },                      // east: open to the sky, no barrier: step off the edge and you fall
        5: { gaps: [[0, 10]] },                 // the corridor wall already stands at the door
      });
      wallsAround(K, RANGE, { h: 4.6, t: 1, color: CON2, ribs: false }, { 0: { skip: true } });
      // passage side walls into the chamber
      owall(K, -47, -6, -41, -6, 6, { t: 0.8 });
      owall(K, -47, 2, -41, 2, 6, { t: 0.8 });

      // ================= Tower Watch =================
      // the sunken basin and the octagonal Postmaster building in it (the reference's centre piece)
      disc(K, -2, 0, 9.5, PAVE2, 0.012, 8);
      disc(K, -2, 0, 8.4, 0x6c93ad, 0.024, 8);
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + Math.PI / 8, R = 9.0;
        vbox(K, -2 + Math.sin(a) * R, 0.25, Math.cos(a) * R, 7.2, 0.5, 0.7, CON, { ry: a });
      }
      // the Postmaster booth: an octagon of walls with a service window on the south side. Kadi stands inside, behind the counter.
      for (let k = 1; k < 8; k++) { const n = k * Math.PI / 4; K.obox(-2 + Math.sin(n) * 5, Math.cos(n) * 5, 4.2, 3.4, 0.6, n, STEEL); }
      for (const k of [2, 3, 5, 6]) { const n = k * Math.PI / 4; vbox(K, -2 + Math.sin(n) * 5.35, 1.9, Math.cos(n) * 5.35, 2.6, 0.9, 0.1, 0xffa050, { ry: n, glow: 0.9 }); }
      disc(K, -2, 0, 4.6, 0x8a6f3a, 0.05, 8);
      K.mesh(new THREE.CylinderGeometry(2.6, 6.1, 1.5, 8), STEELL, -2, 4.15, 0, { ry: Math.PI / 8 });
      K.mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.12, 8), 0xff7a3a, -2, 4.95, 0, { glow: 1.1 });
      K.box(-2, 4.95, 4.6, 1.1, 0.8, CON);                                            // the counter across the window
      vbox(K, -2, 1.16, 4.95, 4.9, 0.12, 1.0, BRONZE);
      for (const x of [-3.6, -0.4]) vbox(K, x, 1.5, 4.95, 0.9, 0.6, 0.6, x < -2 ? BRONZE : 0x5d7a94);  // parcels on the counter
      for (let k = -1; k <= 1; k++) { vbox(K, -2 + k * 1.7, 1.8, -4.3, 1.4, 2.4, 0.3, k % 2 ? 0x5d7a94 : BRONZE); vbox(K, -2 + k * 1.7, 2.9, -4.15, 0.8, 0.25, 0.1, BRASSL, { glow: 0.6 }); } // lockers
      npcBase(K, -2, 2.6, 0xbfa070);
      symbol(K, -2, 6.6, 0, 'hex');
      lamp(K, -2, 5.5, 3, 0xffa060, 5, 22);
      // Vaults: three capsules, south of the basin
      for (const x of [3, 7, 11]) {
        K.box(x, 13, 2.2, 5.6, 2.2, STEEL);
        vbox(K, x, 0.55, 13, 2.5, 1.1, 2.5, CON);
        vbox(K, x, 5.65, 13, 2.5, 0.3, 2.5, CON2);
        vbox(K, x, 3.6, 11.85, 1.4, 2.6, 0.12, 0xe6e9ec);
        vbox(K, x, 2.2, 11.82, 0.5, 0.5, 0.1, 0xffa050, { glow: 1.0 });
      }
      lamp(K, 7, 5, 9, 0xffd8a0, 4, 18);
      // Gunsmith (Banshee-44), north-east, under an orange awning; Cryptarch (Rahool), east; Bounties, north-west; Special Orders, west
      stall(K, 17, -19, 's', 6.4, 'gun', ORANGE);
      stall(K, 22.4, -8.5, 'w', 6, 'crypt', 0x8a7fb0);
      stall(K, -15, -19, 's', 6, 'bounty', STEELL);
      stall(K, -23.5, 8, 'e', 6, 'mail', 0x6a7f94);
      // monoliths with red banners (a row along the west, a pair at the range gate), beds and trees
      for (const [x, z] of [[-25, -6], [-25, 4], [-25, 14]]) monolith(K, x, z, 9, true);
      for (const x of [-9.5, 9.5]) monolith(K, x, 17.2, 7, true);
      for (const [x, z, w, d] of [[-14, 15, 10, 3.4], [20, 14.2, 6, 3]]) bed(K, x, z, w, d);
      tree(K, -23, -14, 1);
      tree(K, 13, -15, 1.05);
      bench(K, -2, 12, true); bench(K, 17, 4, false);
      for (const [x, z, lit] of [[-10, -4, true], [12, -4, true], [-10, 10, false], [18, 8, false], [0, -17, false]]) lampPost(K, x, z, lit);
      // broad steps at the north gate, and floor lines
      decal(K, 5, -20, 8, 4, PAVE2, 0, 0.03);
      for (let k = 0; k < 4; k++) decal(K, 5, -22.4 + k * 0.5, 8 - k * 0.4, 0.14, CON3, 0, 0.05);
      disc(K, -2, 0, 12.4, PAVE3, 0.03, 8);
      disc(K, -2, 0, 11.7, PAVE, 0.036, 8);
      lamp(K, 0, 7, 4, 0xffe8c0, 7, 40);
      lamp(K, 16, 6, -8, 0xffe8c0, 4, 24);
      lamp(K, -16, 6, 10, 0xffe8c0, 4, 24);
      // low mist along the south of the Watch (reference: fog in the courtyard)
      pane(K, 4, 0.5, 6, 40, 0.9, 14, 0xe8eef4, 0.1);
      pane(K, -10, 0.4, -8, 24, 0.8, 10, 0xe8eef4, 0.08);

      // ================= Hall of Guardians =================
      // After the Vanguard room in the Destiny 1 Tower (docs/reference/d1-vanguard-room.md): a vaulted, roofed hall, dim and warm,
      // with a sunken floor and the war table in a gold ring. A raised walkway runs round it (south balcony, west and east galleries,
      // a north ledge under the great window), steps lead down, tall banners hang by black columns and bookshelves line the walls.
      const HX = 5, T = 1.4, DARK = 0xa49f94, DARK2 = 0x7a766e;
      for (const [x1, z1, x2, z2] of [[-14, -44, 24, -36], [-19, -71, -13, -36], [23, -71, 29, -36], [-14, -76, 24, -69]]) {
        K.box((x1 + x2) / 2, (z1 + z2) / 2, x2 - x1, T, z2 - z1, DARK);
      }
      // rails along the sunken floor's edge (open at the two flights of steps)
      rail(K, -13, -44, -0.5, -44, T); rail(K, 10.5, -44, 23, -44, T);
      rail(K, -13, -69, -0.5, -69, T); rail(K, 10.5, -69, 23, -69, T);
      rail(K, -13, -44, -13, -69, T); rail(K, 23, -44, 23, -69, T);
      for (const x of [-13, 23]) vbox(K, x, T + 1.35, -56.5, 0.6, 0.12, 25.2, STEELL);
      K.stairs(HX, -46.4, 's', 10, T, { color: CON2 });        // down from the south balcony
      K.stairs(HX, -66.6, 'n', 10, T, { color: CON2 });        // down from the north ledge
      K.stairs(HX, -33.6, 'n', 8, T, { color: CON2 });         // up from the corridor onto the balcony
      // the war table in its gold ring
      disc(K, HX, -57, 7.4, 0x6a665e, 0.01, 40);
      disc(K, HX, -57, 6.7, 0x8a6f3a, 0.02, 40);
      disc(K, HX, -57, 5.6, 0x7a766e, 0.03, 40);
      disc(K, HX, -57, 4.7, 0xd9a83a, 0.04, 40, 0.25);
      K.obox(HX, -57, 8.4, 0.95, 3.0, 0, CON3);
      vbox(K, HX, 1.0, -57, 8.8, 0.1, 3.4, STEEL2);
      vbox(K, HX, 1.07, -57, 7.6, 0.04, 2.4, 0x6fb4d8, { glow: 0.9 });
      for (const [dx, c] of [[-2.4, 0xffc247], [0, 0x9fe8ff], [2.4, 0xffa050]]) vbox(K, HX + dx, 1.2, -57, 0.5, 0.3, 0.4, c, { glow: 0.8 });
      lamp(K, HX, 5.5, -57, 0xffc060, 9, 34);
      // Zavala, Cayde-6 and Ikora stand round the table, facing the entrance
      for (const [x, c] of [[-1, TITAN], [5, HUNTER], [11, WARLOCK]]) { npcBase(K, x, x === 5 ? -52.5 : -53, c); symbol(K, x, 4.0, x === 5 ? -52.5 : -53, 'shield', 1.3); }
      // the great window at the north end, with the Traveler beyond
      for (const x of [-6.4, 16.4]) vbox(K, x, 6, -76, 0.9, 12, 1.2, 0x23262d);
      vbox(K, HX, 9.2, -76, 23.5, 0.8, 1.4, 0x23262d);
      for (const x of [-2, 2, 8, 12]) vbox(K, x, 4.5, -76, 0.25, 9, 0.35, 0x23262d);
      // the vault: a half-barrel roof on arched ribs
      {
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(24.4, 24.4, 41, 20, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x58606c, side: THREE.DoubleSide, flatShading: true, roughness: 1 }));
        shell.rotation.x = Math.PI / 2; shell.scale.set(1, 1, 0.42); shell.position.set(HX, 12, -56);
        shell.castShadow = false; shell.receiveShadow = true;
        K.scene.add(shell);
        for (const z of [-75, -67, -59, -51, -43, -36.5]) {
          const rib = K.mesh(new THREE.TorusGeometry(24.2, 0.75, 5, 24, Math.PI), 0x2f333c, HX, 12, z, {});
          rib.scale.y = 0.42;
        }
        vbox(K, HX, 22.2, -56, 0.9, 0.5, 40, 0x23262d);      // ridge beam
      }
      // black columns with tall hanging banners along both galleries
      const BAN = [0xe0902a, 0xe8c040, 0x1a1a1e, 0xe0902a, 0xe8c040];
      for (let k = 0; k < 5; k++) {
        const z = -66 + k * 5.4;
        for (const x of [-17.4, 27.4]) {
          K.box(x, z, 1.1, 11, 1.1, 0x23262d);
          banner(K, x + (x < 0 ? 0.65 : -0.65), 5.0, z, BAN[k], 'x', 8, 1.4);
        }
      }
      // bookshelves in the wall niches
      for (let k = 0; k < 3; k++) for (const [x, face] of [[-18.2, 1], [28.2, -1]]) {
        const z = -62 + k * 8;
        K.box(x, z, 0.9, 2.6, 3.2, 0x4a3a2a, { y: T });
        for (let r = 0; r < 3; r++) vbox(K, x + face * 0.5, T + 0.6 + r * 0.75, z, 0.2, 0.5, 2.8, [0xd9a83a, 0x8a4a2a, 0xb9b0a0][(k + r) % 3], { glow: 0.2 });
      }
      // terminals along the galleries (rooms of a command post) and a crate or two
      for (const [x, z] of [[-17, -40], [27, -40], [-17, -72], [27, -72]]) { K.box(x, z, 1.6, 1.2, 1.6, CON3, { y: T }); vbox(K, x, T + 1.5, z, 1.2, 0.8, 0.1, 0x6fc4ff, { glow: 1.0 }); }
      // kiosks stand on the balcony, facing the entrance
      kiosk(K, -6, -40, Math.PI, 0x6fc4ff, T);
      kiosk(K, 16, -40, Math.PI, 0xffd36a, T);
      // the corridor from the Watch: signs on its walls
      // warm light inside, blue accents, a little dust in the air
      for (const [x, z] of [[-14, -48], [24, -48], [-14, -64], [24, -64]]) lamp(K, x, 6, z, 0xffb060, 6, 26);
      for (const [x, z] of [[-17, -42], [27, -42], [-17, -70], [27, -70]]) lamp(K, x, 9, z, 0x6aa8ff, 4, 22);
      lamp(K, HX, 4, -40, 0xffc880, 5, 20);
      pane(K, HX, 0.6, -58, 40, 0.9, 24, 0xd8d0c0, 0.06);

      // ================= Tower North (west) =================
      // the Outfitter's band, the New Monarchy spine, the round Speaker's chamber
      stall(K, -64, -27.6, 's', 6, 'cloth', RED);
      stall(K, -39.4, -13, 'e', 6, 'cloth', STEELL);
      tree(K, -50, -22.4, 1.1); tree(K, -72, -22.4, 1);
      bed(K, -60, -22.2, 7, 1.6); bed(K, -36, 3.2, 6, 1.8);
      for (const x of [-72, -56, -44]) banner(K, x, 4.6, -29.3, RED, 'z', 4.6, 1.8);
      for (const z of [-27, -3]) lampPost(K, -33, z, true);
      lampPost(K, -55, -22.6, false); lampPost(K, -67, -22.6, true);
      // the Speaker's chamber: a ring wall (open to the east), the Traveler projector, seats
      {
        const { x: cx, z: cz, r: R } = CHAMBER, N = 20;
        for (let k = 1; k < N - 1; k++) {
          const a = ((k + 0.5) / N) * Math.PI * 2, seg = 2 * R * Math.sin(Math.PI / N) * 1.08;
          K.obox(cx + Math.cos(a) * R, cz + Math.sin(a) * R, seg, 6.5, 0.9, -(a + Math.PI / 2), k % 2 ? CON : CON2);
        }
        K.mesh(new THREE.TorusGeometry(R, 0.28, 4, 40), BRASS, cx, 6.7, cz, { rx: Math.PI / 2 });
        disc(K, cx, cz, 9.5, PAVE, 0.012, 32);
        disc(K, cx, cz, 6.2, PAVE3, 0.024, 32);
        disc(K, cx, cz, 3.4, BRASS, 0.036, 24, 0.25);
        K.cyl(cx, cz, 1.0, 1.1, CON3, { sides: 8 });
        K.cyl(cx, cz, 0.5, 1.5, BRONZE, { sides: 8, y: 1.1 });
        K.mesh(new THREE.IcosahedronGeometry(0.75, 1), HOLO, cx, 3.5, cz, { glow: 1.6 });
        K.mesh(new THREE.TorusGeometry(1.05, 0.05, 5, 16), BRASSL, cx, 3.5, cz, { rx: Math.PI / 2.4, glow: 1.0 });
        pane(K, cx, 3.0, cz, 1.4, 4.4, 1.4, HOLO, 0.12, true);
        K.light(cx, 3.6, cz, HOLO, 7, 22);
        for (const a of [1.2, 2.1, 4.1, 5.2]) K.box(cx + Math.cos(a) * 7.2, cz + Math.sin(a) * 7.2, 1.4, 0.5, 0.8, CON2);
        // the orrery (Destiny 1 reference): brass rings round the projector, a wire globe with a glowing core, a lattice dome overhead
        for (const [r, rx, rz] of [[3.5, 0, 0], [3.1, Math.PI / 2, 0.5], [2.7, Math.PI / 3, -0.7]]) K.mesh(new THREE.TorusGeometry(r, 0.13, 6, 28), BRASS, cx, 4.8, cz, { rx, rz, glow: 0.2 });
        K.mesh(new THREE.IcosahedronGeometry(2.2, 1), 0x9a7bff, cx, 4.8, cz, { glow: 0.5 }).material.wireframe = true;
        K.mesh(new THREE.IcosahedronGeometry(0.9, 1), 0xff9a50, cx, 4.8, cz, { glow: 1.8 });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc89a4a, wireframe: true, transparent: true, opacity: 0.35 }));
        dome.position.set(cx, 6.8, cz); K.scene.add(dome);
        // a sunken ring round the orrery: a low brass rail with a gap toward the entrance, braziers at the door, red wall panels
        for (let k = 1; k < 15; k++) {
          const a = (k / 16) * Math.PI * 2, rr = 7.2;
          K.obox(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, 2 * rr * Math.sin(Math.PI / 16) * 1.05, 0.9, 0.18, -(a + Math.PI / 2), STEELL);
        }
        disc(K, cx, cz, 7.9, 0x4a4a52, 0.018, 32);
        for (const dz of [-3.4, 3.4]) { K.cyl(cx + 10.5, cz + dz, 0.22, 1.0, BRONZE, { sides: 6 }); K.cyl(cx + 10.5, cz + dz, 0.8, 0.5, BRONZE, { sides: 10, y: 1.0, r2: 1.1 }); K.mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 10), 0xff8a30, cx + 10.5, 1.52, cz + dz, { glow: 1.4 }); lamp(K, cx + 10.5, 2.6, cz + dz, 0xff9a50, 3, 12); }
        for (let k = 0; k < 8; k++) { const a = ((k + 1) / 10) * Math.PI * 2 + 0.3, rr = R - 0.55; vbox(K, cx + Math.cos(a) * rr, 3.6, cz + Math.sin(a) * rr, 0.1, 6.4, 2.4, 0x8a2a2a, { ry: -(a + Math.PI / 2) }); }

      }

      // ================= Hangar corridor and bay =================
      for (const z of [-24, -10, 4]) lampPost(K, 36.4, z, z !== -10);
      for (const z of [-20, -4]) banner(K, 30.6, 3.2, z, RED, 'x', 3.8, 1.6);
      // vendors along the north wall, ships on pads, the launch pad in the south wing
      stall(K, 57, -69.6, 's', 6, 'cloth', STEELL);   // Quartermaster, in the workshop
      // faction bays along the north wall (first pass; refine from references): Future War Cult, Dead Orbit, the Shipwright
      for (const x of [62, 71, 80]) owall(K, x, -71.3, x, -62, 4.4, { t: 0.5, color: 0x2a2d33, ribs: false });
      {
        // Future War Cult (reference: a dark bay, diamond-plate floor, a blue mat, white swept-F signs over a long white panel with an
        // orange light strip, orange rails and a short stair)
        floorPoly(K, [[62.3, -71], [70.7, -71], [70.7, -62.3], [62.3, -62.3]], 0x2b2d33, FL + 0.01);
        for (let k = 0; k < 6; k++) decal(K, 66.5, -70 + k * 1.5, 8.2, 0.05, 0x3b3e46, 0, 0.02);
        decal(K, 65, -66.4, 4.6, 3.2, 0x2a4fc0, 0, 0.03);
        vbox(K, 66.5, 2.2, -71.15, 8.4, 4.4, 0.2, 0x23262c);
        vbox(K, 66.5, 3.4, -70.98, 7.6, 1.1, 0.14, 0xe6e6ea);
        vbox(K, 66.5, 3.4, -70.9, 6.2, 0.2, 0.1, 0xff6a2a, { glow: 1.4 });
        for (const x of [63.2, 64.3, 65.4]) vbox(K, x, 1.8, -70.95, 0.28, 2.6, 0.1, 0xf4f4f6, { rz: -0.22, glow: 0.5 });
        vbox(K, 62.6, 2.2, -70.9, 0.14, 3.6, 0.1, 0x6a8aff, { glow: 1.2 });
        K.stairs(69.6, -63.5, 'n', 2.4, 1.2, { color: 0x3b3e46 });
        K.box(69.6, -69.4, 2.4, 1.2, 3.2, 0x3b3e46);
        for (const x of [68.35, 70.85]) vbox(K, x, 1.9, -66.8, 0.08, 1.0, 6.6, 0xff5a1a);
        K.box(65, -64.2, 4.6, 1.1, 0.9, 0x3b3e46); vbox(K, 65, 1.16, -64.2, 4.8, 0.12, 1.0, 0xe6e6ea);
        for (const [x, z] of [[63.2, -69.2], [64.6, -69.6]]) { K.box(x, z, 1.1, 1.0, 1.1, 0x4a4e58); vbox(K, x, 1.1, z, 0.8, 0.1, 0.8, 0x7fa0ff, { glow: 0.8 }); }
        lamp(K, 66, 4, -66, 0xbfd0ff, 4, 14);
      }
      {
        // Dead Orbit (reference: black cylinder banners with the white emblem, camo netting, scaffolding with yellow and black trim,
        // gas cylinders, tiered steps and a green haze). Far to the east of the Cult, on its own stretch of the north wall.
        const D = 97.5;
        for (const x of [D - 4.5, D + 4.5]) owall(K, x, -71.3, x, -62, 4.4, { t: 0.5, color: 0x2a2d33, ribs: false });
        floorPoly(K, [[D - 4.2, -71], [D + 4.2, -71], [D + 4.2, -62.3], [D - 4.2, -62.3]], 0x25272c, FL + 0.01);
        for (let k = 0; k < 6; k++) decal(K, D, -70 + k * 1.5, 8.2, 0.05, 0x383b42, 0, 0.02);
        decal(K, D, -62.9, 8, 0.28, 0xe8c030, 0, 0.03);
        vbox(K, D, 2.2, -71.15, 8.4, 4.4, 0.2, 0x1e2024);
        for (const x of [D - 3.1, D + 3.1]) {
          K.cyl(x, -68.2, 0.85, 6, 0x131416, { sides: 14 });
          K.mesh(new THREE.TorusGeometry(0.5, 0.06, 5, 18), 0xe8e8ec, x, 4.2, -67.32, { glow: 0.3 });
          vbox(K, x, 4.2, -67.3, 0.35, 0.35, 0.05, 0xe8e8ec);
        }
        for (const [x, z] of [[D - 3.5, -64.2], [D + 3.5, -64.2], [D - 3.5, -70.4], [D + 3.5, -70.4]]) vbox(K, x, 2.6, z, 0.25, 5.2, 0.25, 0x2a2d33);
        for (const z of [-64.2, -70.4]) vbox(K, D, 5.1, z, 7.2, 0.25, 0.25, 0xe8c030);
        pane(K, D, 4.8, -67.3, 7.4, 0.12, 6.4, 0x4a5a44, 0.78);
        K.stairs(D, -64.6, 'n', 3.4, 1.2, { color: 0x3a3d44 });
        K.box(D, -69.2, 3.4, 1.2, 3.6, 0x3a3d44);
        for (const [dx, z, c] of [[-2.3, -63.6, 0xd8b020], [-1.6, -63.4, 0xb8bcc0], [2.5, -63.6, 0xd8b020], [3.2, -63.4, 0xd8b020]]) K.cyl(D + dx, z, 0.3, 1.5, c, { sides: 8 });
        for (const [dx, z] of [[-3.3, -65.6], [3.3, -65.4]]) { K.box(D + dx, z, 1.6, 1.2, 1.4, 0x4a4e58); vbox(K, D + dx, 1.3, z, 1.2, 0.2, 1.0, 0xe8c030); }
        K.box(D, -63.2, 3.6, 1.1, 0.8, 0x3a3d44); vbox(K, D, 1.16, -63.2, 3.8, 0.12, 0.9, 0xe8c030);
        pane(K, D, 0.9, -67, 8.4, 1.8, 8, 0x9fe8c0, 0.08);
        lamp(K, D, 4, -66, 0xb8ffd0, 4, 14);
      }
      {
        // Shipwright: on the south wall of the lower wing, facing north; a counter and a ship model on a plinth
        const SX = 82;
        for (const x of [SX - 4.5, SX + 4.5]) owall(K, x, -6.7, x, -14, 4.4, { t: 0.5, color: 0x3a4048, ribs: false });
        floorPoly(K, [[SX - 4.2, -7], [SX + 4.2, -7], [SX + 4.2, -14], [SX - 4.2, -14]], 0x6d6c68, FL + 0.01);
        decal(K, SX, -12.8, 8, 0.3, ORANGE, 0.3, 0.03);
        vbox(K, SX, 2.2, -6.85, 8.4, 4.4, 0.2, 0x4a5260);
        K.cyl(SX, -9.6, 1.3, 1.0, CON); K.mesh(new THREE.ConeGeometry(0.7, 2.2, 4), 0xe8e8e4, SX, 2.1, -9.6, { rx: Math.PI / 2, ry: Math.PI / 4, glow: 0.2 });
        vbox(K, SX, 1.6, -9.6, 1.8, 0.1, 0.6, ORANGE, { glow: 0.9 });
        K.box(SX, -12.6, 5.4, 1.1, 0.9, CON); vbox(K, SX, 1.16, -12.6, 5.6, 0.12, 1.0, STEELL);
        lamp(K, SX, 4, -10, 0xfff0e0, 4, 14);
      }
      for (const [x, z, c, t] of [[84, -42, 0xe8e8e4, RED], [108, -42, 0xd0d4d8, TITAN], [96, -26, 0xe8e0d0, WARLOCK]]) {
        landingPad(K, x, z + 0.5, 11);
        ship(K, x, z, -1, c, t);
      }
      landingPad(K, 112, -14, 8);
      K.mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.1, 20), 0x6fd0ff, 112, FL + 0.06, -14, { glow: 1.3 });
      K.mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.12, 20), 0xdff6ff, 112, FL + 0.1, -14, { glow: 1.0 });
      pane(K, 112, 3.0, -14, 3.4, 6, 3.4, 0x9fe4ff, 0.14, true);
      K.light(112, 3, -14, 0x8fdcff, 6, 22);
      // the workshop, in the west bay: roofed and industrial after the Destiny 1 hangar reference (dark steel, mesh rails, cable
      // bundles, yellow bins, a catwalk with a stair, bright overhead panels and an orange-lit window)
      {
        const RY = 11, WX = 49, WZ = -47;
        vbox(K, WX, RY, WZ, 22, 0.6, 50, 0x23272e);
        for (let z = -69; z <= -25; z += 6) vbox(K, WX, RY - 0.7, z, 22, 0.7, 0.5, 0x2f343c);
        for (const x of [41, 57]) vbox(K, x, RY - 0.7, WZ, 0.5, 0.7, 50, 0x2f343c);
        for (const z of [-66, -56, -46, -36, -26]) for (const x of [43, 55]) vbox(K, x, RY - 0.5, z, 2.4, 0.2, 1.0, 0xfff4d8, { glow: 1.7 });
        lamp(K, 44, 8, -58, 0xffe8c0, 6, 30); lamp(K, 54, 8, -36, 0xffe8c0, 6, 30);
        // catwalk deck on legs, a stair up from the floor, mesh rails
        K.box(42, -59, 8, 0.4, 14, 0x2b2f36, { y: 3.2 });
        for (const [x, z] of [[38.6, -65.6], [45.4, -65.6], [38.6, -52.4], [45.4, -52.4]]) K.box(x, z, 0.5, 3.2, 0.5, 0x1c2026);
        K.stairs(52, -57, 'w', 3, 3.6, { color: 0x2b2f36 });
        K.box(47.3, -57, 1.4, 0.4, 3, 0x2b2f36, { y: 3.2 });
        for (const [x, z, w, d] of [[42, -52.2, 8, 0.15], [45.9, -59, 0.15, 14], [42, -65.8, 8, 0.15]]) { pane(K, x, 3.2 + 0.65, z, w, 1.3, d, 0x151a22, 0.55); K.collider(x - w / 2, 3.2, z - d / 2, x + w / 2, 4.6, z + d / 2, null); }
        // crates, yellow bins, gas cylinders and cable bundles
        for (const [x, z, w, d] of [[52, -30, 2.6, 1.6], [55, -30, 2.2, 1.6], [53.5, -27.4, 2.4, 1.4], [59, -66, 3, 1.6], [41, -28, 2.6, 1.6]]) {
          K.box(x, z, w, 1.5, d, 0x3a424c);
          vbox(K, x, 1.9, z, w * 0.8, 0.8, d * 0.8, 0xe0b82a);
        }
        for (const [x, z] of [[58, -34], [59, -34.8], [40, -25]]) K.cyl(x, z, 0.32, 1.5, 0xd8b020, { sides: 8 });
        for (const [x, z, rz] of [[40.2, -44, 0.05], [41.4, -42.6, -0.04]]) K.mesh(new THREE.CylinderGeometry(0.75, 0.75, 11, 8), 0x7a2a45, x, 5.5, z, { rz });
        vbox(K, 38.5, 6, -32, 0.2, 3.2, 7, 0xffa050, { glow: 1.0 });
        for (let k = 0; k < 5; k++) vbox(K, 38.7, 1.6, -30 + k * 1.6, 0.1, 2.4, 0.05, 0x1c2026);   // mesh rail slats at the window
      }
      // east side: rail wall with tall open frames toward the sky
      for (const z of [-60, -39, -14]) {
        for (const s of [-1, 1]) { vbox(K, 119.4, 6, z + s * 6.2, 1.2, 12, 1.6, CON); vbox(K, 119.4, 6.2, z + s * 6.8, 0.5, 11, 0.6, STEEL2); }
        vbox(K, 119.4, 12.2, z, 1.4, 1.2, 14, CON);
        vbox(K, 119.4, 12.9, z, 1.6, 0.3, 14.4, STEEL2);
      }
      for (const [x, z] of [[41, -37], [41, -66]]) { K.box(x, z, 1.6, 1.4, 1.6, CON3); vbox(K, x, 1.55, z, 1.2, 0.2, 1.2, ORANGE, { glow: 0.5 }); }
      for (const [x, z] of [[78, -40], [100, -40], [78, -14], [100, -20], [116, -50]]) lamp(K, x, 8, z, 0xffe8c0, 6, 36);
      
      // ================= South Tower shooting range =================
      const RZ = 20;
      pillar(K, -6.8, RZ, 8, 1.6);
      pillar(K, 6.8, RZ, 8, 1.6);
      vbox(K, 0, 7.5, RZ, 15.4, 1.8, 1.6, CON2);
      vbox(K, 0, 8.55, RZ, 15.8, 0.3, 1.9, STEEL2);
      lamp(K, 0, 6.2, RZ + 2, 0xffe8c0, 6, 24);
      decal(K, 0, 45, 15, 50, GRAVEL2, 0, 0.012);
      decal(K, 0, 27.2, 14.6, 0.6, BRASSL, 0.9, 0.025);          // firing line (fire point is z = 26)
      for (const d of [8, 16, 24, 32, 40]) decal(K, 0, 26 + d, 14.8, 0.18, 0xe8e0c8, 0.2, 0.025);
      for (const d of [8, 16, 24, 32, 40]) {
        sign(K, -8.45, 2.4, 26 + d, 1.6, 0.6, `${d} M`, Math.PI / 2, '#243a52');
        sign(K, 8.45, 2.4, 26 + d, 1.6, 0.6, `${d} M`, -Math.PI / 2, '#243a52');
      }
      for (const s of [-1, 1]) { K.box(s * 7.6, 26, 1.6, 0.9, 2.4, CON2); vbox(K, s * 7.6, 0.95, 26, 1.7, 0.1, 2.5, BRONZE); }
      for (const d of TOWER_SPOTS.rangeDummies) dummyBase(K, d.x, d.z);
      dummyBase(K, TOWER_SPOTS.rangeBoss.x, TOWER_SPOTS.rangeBoss.z, 2.2, 0xff9a6a);
      banner(K, 0, 3.3, 69.4, STEEL, 'z', 4, 4);
      for (const x of [-6, 6]) banner(K, x, 3.3, 69.4, RED, 'z', 3.4, 1.4);
      for (const z of [32, 50]) for (const s of [-1, 1]) lampPost(K, s * 8.1, z, false);
      lamp(K, 0, 5, 30, 0xffe8c0, 6, 30);
      lamp(K, 0, 5, 50, 0xffe8c0, 6, 34);
      lamp(K, 0, 5, 64, 0xffe8c0, 6, 30);

      // ================= skyline: the Tower's great fins (visual only, outside the walls) =================
      for (const [x, z, w, h] of [[-26, -84, 12, 70], [34, -88, 14, 84], [64, -82, 10, 52], [-48, -40, 10, 46], [-70, 12, 9, 40], [-34, 24, 10, 34], [40, 22, 11, 38], [78, 6, 10, 44], [56, 30, 8, 28], [-12, 44, 8, 30], [30, 52, 9, 34]]) pylon(K, x, z, w, h);
    },
  },
};

// ---------------------------------------------------------------------------
// U16b vista: the Tower stands on a cliff above the Last City, with mountains on the horizon and the Wall
// curving round the south. Everything here is far scenery (no colliders), unfogged and pre-hazed so it
// reads against the pale sky. Called once by buildLevel (world.js) for a location with `vista`.
// ---------------------------------------------------------------------------
const CITY_Y = -140;
function hazy(hex, k) { return new THREE.Color(hex).lerp(new THREE.Color(0xcfe3f2), k); }
function flat(color, extra = {}) { return new THREE.MeshLambertMaterial({ color, flatShading: true, fog: false, ...extra }); }


// ---------------------------------------------------------------------------
// The Traveler, painted. After the Destiny 1 reference: a white-grey sphere lit from the upper left, shading toward blue-grey
// at the lower left, hairline cracks and small dark marks, and the black wreck of the old ship along its underside: a skyline of
// jagged spires at the bottom, long crescents hugging the rim on both sides.
// ---------------------------------------------------------------------------
function paintTraveler(rng) {
  const N = 1024, C = N / 2, R = 470;
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  g.save(); g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.clip();
  let gr = g.createLinearGradient(C - R * 0.75, C - R, C + R * 0.55, C + R);
  gr.addColorStop(0, '#fcfdff'); gr.addColorStop(0.42, '#e8ecf5'); gr.addColorStop(0.7, '#b4bfd6'); gr.addColorStop(1, '#8c98b5');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  gr = g.createLinearGradient(C - R, C + R * 0.1, C + R * 0.4, C - R * 0.25); // a soft diagonal shadow band across the left
  gr.addColorStop(0, 'rgba(96,112,150,0.42)'); gr.addColorStop(0.6, 'rgba(96,112,150,0.12)'); gr.addColorStop(1, 'rgba(96,112,150,0)');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  gr = g.createRadialGradient(C, C, R * 0.72, C, C, R); // limb: a cool edge
  gr.addColorStop(0, 'rgba(90,110,170,0)'); gr.addColorStop(1, 'rgba(90,110,170,0.34)');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  gr = g.createRadialGradient(C, C + R, 0, C, C + R, R * 0.7); // warm light under it
  gr.addColorStop(0, 'rgba(236,206,150,0.5)'); gr.addColorStop(1, 'rgba(236,206,150,0)');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  // hairline cracks
  g.strokeStyle = 'rgba(110,122,150,0.35)'; g.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2, r = R * (0.2 + rng() * 0.7), len = 0.15 + rng() * 0.5;
    g.beginPath(); g.arc(C + Math.cos(a) * r * 0.4, C + Math.sin(a) * r * 0.4, r, a, a + len); g.stroke();
  }
  // small dark marks and scratches on the face
  g.fillStyle = '#23262e'; g.strokeStyle = '#23262e';
  for (let i = 0; i < 90; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * R * 0.86, x = C + Math.cos(a) * r, y = C - Math.abs(Math.sin(a)) * r * 0.9 + R * 0.1;
    g.save(); g.translate(x, y); g.rotate(rng() * Math.PI); g.fillRect(0, 0, 2 + rng() * 9, 1 + rng() * 2.4); g.restore();
  }
  g.lineWidth = 2;
  for (let i = 0; i < 9; i++) { const x = C + (rng() - 0.3) * R * 1.1, y = C - R * 0.3 + rng() * R * 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + rng() * 60, y + 10 + rng() * 40); g.stroke(); }
  // the wreck: dark crescents hugging the rim
  g.fillStyle = '#16181e';
  const crescent = (a1, a2, maxW) => {
    g.beginPath();
    const steps = 48;
    for (let k = 0; k <= steps; k++) { const a = a1 + (a2 - a1) * k / steps; g.lineTo(C + Math.cos(a) * (R + 4), C + Math.sin(a) * (R + 4)); }
    for (let k = steps; k >= 0; k--) { const t = k / steps, a = a1 + (a2 - a1) * t, w = maxW * Math.sin(Math.PI * t) * (0.55 + rng() * 0.45); g.lineTo(C + Math.cos(a) * (R - w), C + Math.sin(a) * (R - w)); }
    g.closePath(); g.fill();
  };
  const rad = (d) => d * Math.PI / 180;
  crescent(rad(2), rad(84), 46);     // right side, running down into the bottom
  crescent(rad(-24), rad(8), 22);
  crescent(rad(116), rad(168), 34);  // left side
  crescent(rad(-40), rad(-24), 12);
  // a skyline of spires standing up out of the bottom: stacked blocks, narrower toward the top, notched
  const tower = (th, w, h) => {
    g.save(); g.translate(C + Math.cos(th) * (R + 6), C + Math.sin(th) * (R + 6)); g.rotate(th - Math.PI / 2);
    let y = 0, ww = w;
    for (let k = 0; k < 5 && y < h; k++) {
      const hh = (h - y) * (0.35 + rng() * 0.3);
      g.fillRect(-ww / 2 + (rng() - 0.5) * 6, -(y + hh), ww, hh + 2);
      y += hh * 0.9; ww *= 0.55 + rng() * 0.35;
    }
    g.beginPath(); g.moveTo(-ww / 2, -y); g.lineTo((rng() - 0.5) * ww, -y - 10 - rng() * 36); g.lineTo(ww / 2, -y); g.closePath(); g.fill();
    g.restore();
  };
  for (let i = 0; i < 44; i++) { const th = rad(28 + rng() * 112), mid = 1 - Math.abs(th - rad(88)) / rad(70); tower(th, 10 + rng() * 26, 24 + rng() * 40 + Math.max(0, mid) * 120 * rng()); }
  for (const [d, w, h] of [[78, 44, 220], [92, 30, 180], [64, 26, 150], [104, 24, 130], [50, 20, 100]]) tower(rad(d), w, h);
  g.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// soft halo behind the Traveler (additive): cool white round the rim, warm underneath
function paintHalo() {
  const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  let gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.46, 'rgba(228,238,255,0.8)'); gr.addColorStop(0.56, 'rgba(190,212,255,0.3)'); gr.addColorStop(1, 'rgba(190,212,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  gr = g.createRadialGradient(N / 2, N * 0.7, 0, N / 2, N * 0.7, N * 0.3);
  gr.addColorStop(0, 'rgba(255,214,150,0.5)'); gr.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildTowerVista(scene) {
  const g = new THREE.Group();
  // gradient sky dome
  const dome = new THREE.SphereGeometry(850, 24, 12);
  const pos = dome.attributes.position, col = new Float32Array(pos.count * 3);
  const top = new THREE.Color(0x3f86d6), mid = new THREE.Color(0x8fc3ee), hor = new THREE.Color(0xd6e8f4), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 850);
    if (t < 0.25) c.lerpColors(hor, mid, t / 0.25); else c.lerpColors(mid, top, Math.min(1, (t - 0.25) / 0.6));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  dome.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  // a few flat clouds
  const cloudM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  const rng = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < 16; i++) {
    const ang = rng() * Math.PI * 2, r = 380 + rng() * 360, y = 70 + rng() * 150;
    const cl = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(16 + rng() * 18, 0), cloudM);
      m.scale.set(1.8, 0.5, 1); m.position.set((k - 1.5) * 24, rng() * 5, rng() * 12);
      cl.add(m);
    }
    cl.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r - 20); cl.rotation.y = rng() * 3;
    g.add(cl);
  }
  // the ground far below: farmland and the city floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(880, 40).rotateX(-Math.PI / 2), flat(hazy(0x7f9a68, 0.25)));
  floor.position.y = CITY_Y - 1; g.add(floor);
  // mountain ranges: three rings, nearer is darker and less hazy
  const ranges = [{ r: 780, n: 24, h: [150, 330], w: [110, 190], k: 0.62, col: 0x6a7f9a }, { r: 660, n: 22, h: [110, 230], w: [90, 150], k: 0.42, col: 0x586f8a }, { r: 540, n: 20, h: [70, 150], w: [70, 120], k: 0.22, col: 0x4a6a57 }];
  for (const rg of ranges) {
    for (let i = 0; i < rg.n; i++) {
      const ang = (i / rg.n) * Math.PI * 2 + rng() * 0.12, h = rg.h[0] + rng() * (rg.h[1] - rg.h[0]), w = rg.w[0] + rng() * (rg.w[1] - rg.w[0]);
      const peak = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5 + Math.floor(rng() * 2)), flat(hazy(rg.col, rg.k)));
      peak.position.set(Math.cos(ang) * rg.r, CITY_Y + h / 2 - 8, Math.sin(ang) * rg.r - 20); peak.rotation.y = rng() * 3;
      g.add(peak);
      if (h > 200) { // snow cap
        const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.34, h * 0.3, 5), flat(hazy(0xf4f7fb, rg.k * 0.5)));
        cap.position.set(peak.position.x, CITY_Y + h - h * 0.15 - 8, peak.position.z); cap.rotation.y = peak.rotation.y;
        g.add(cap);
      }
    }
  }
  // the Wall: a long curved rampart on the south side, with Traveler-white stone and tower stubs
  const wallM = flat(hazy(0xeae4d2, 0.12));
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (0.18 + (i / 25) * 0.64) ;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(46, 60, 14), wallM);
    seg.position.set(Math.cos(a) * 430, CITY_Y + 30, Math.sin(a) * 430 - 20); seg.rotation.y = -a + Math.PI / 2;
    g.add(seg);
    if (i % 5 === 0) { const t2 = new THREE.Mesh(new THREE.BoxGeometry(22, 90, 22), wallM); t2.position.set(seg.position.x, CITY_Y + 45, seg.position.z); g.add(t2); }
  }
  // the Last City: terraced blocks in rings, taller near the Tower's base, with a few domes and spires
  const roofM = [flat(hazy(0x9fb4c6, 0.1)), flat(hazy(0xc9a36a, 0.1)), flat(hazy(0xb86a58, 0.1))];
  const wallS = flat(hazy(0xf0ead8, 0.08)), wallS2 = flat(hazy(0xd6cdb4, 0.08));
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const blocks = [];
  for (let i = 0; i < 560; i++) {
    const ang = rng() * Math.PI * 2, r = 70 + Math.pow(rng(), 0.8) * 320;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r - 20;
    if (x > -110 && x < 120 && z > -110 && z < 100) continue; // keep the cliff foot clear
    const w = 8 + rng() * 14, d = 8 + rng() * 14, h = 9 + rng() * 26 * (1.3 - r / 420);
    blocks.push({ x, z, w, d, h, ry: Math.round(rng() * 3) * 0.2 + ang * 0.0 });
  }
  const bodies = new THREE.InstancedMesh(BOX, wallS, blocks.length), roofs = new THREE.InstancedMesh(BOX, roofM[0], blocks.length);
  const rc = [new THREE.Color(roofM[0].color), new THREE.Color(roofM[1].color), new THREE.Color(roofM[2].color)];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  roofs.material = flat(0xffffff);
  blocks.forEach((b, i) => {
    q.setFromEuler(e.set(0, b.ry, 0));
    bodies.setMatrixAt(i, m4.compose(v.set(b.x, CITY_Y + b.h / 2, b.z), q, sc.set(b.w, b.h, b.d)));
    roofs.setMatrixAt(i, m4.compose(v.set(b.x, CITY_Y + b.h + 0.9, b.z), q, sc.set(b.w + 1.2, 1.8, b.d + 1.2)));
    roofs.setColorAt(i, rc[i % 3]);
  });
  g.add(bodies, roofs);
  // domes and spires
  for (let i = 0; i < 10; i++) {
    const ang = rng() * Math.PI * 2, r = 120 + rng() * 220, x = Math.cos(ang) * r, z = Math.sin(ang) * r - 20;
    if (x > -110 && x < 120 && z > -110 && z < 100) continue;
    if (i % 2) { const d = new THREE.Mesh(new THREE.SphereGeometry(14, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), flat(hazy(0x9fb4c6, 0.1))); d.position.set(x, CITY_Y + 18, z); g.add(d); }
    else { const sp = new THREE.Mesh(new THREE.ConeGeometry(8, 70, 4), flat(hazy(0xece5d3, 0.08))); sp.position.set(x, CITY_Y + 35, z); g.add(sp); }
  }
  // the Traveler: a painted disc (shaded white sphere, the black wreck along its underside), a soft halo and drifting dust.
  // It is far enough away that it does not need to be a solid; it faces the Tower. See paintTraveler.
  if (typeof document !== 'undefined') {
    const TV = new THREE.Vector3(20, 380, -640), S = 2 * 170 * (512 / 470);
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshBasicMaterial({ map: paintTraveler(rng), transparent: true, fog: false, depthWrite: false }));
    disc.position.copy(TV); disc.lookAt(0, 80, 0); disc.renderOrder = 2;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(S * 2.1, S * 2.1), new THREE.MeshBasicMaterial({ map: paintHalo(), transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.copy(TV).addScaledVector(new THREE.Vector3(0, 80, 0).sub(TV).normalize(), -6); halo.lookAt(0, 80, 0); halo.renderOrder = 1;
    g.add(halo, disc);
    const n = 160, pts = new Float32Array(n * 3), toward = disc.quaternion;
    for (let i = 0; i < n; i++) { // dust lifting off the upper right
      const a = (-0.2 + rng() * 1.5) * Math.PI / 2 + 0.2, r = 175 + rng() * rng() * 230;
      const v = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0).applyQuaternion(toward).add(TV);
      pts.set([v.x, v.y, v.z], i * 3);
    }
    const dust = new THREE.BufferGeometry(); dust.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    g.add(new THREE.Points(dust, new THREE.PointsMaterial({ color: 0xffffff, size: 2.5, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
  }
  scene.add(g);
  return g;
}

export const TOWER_LOC = {
  id: 'tower', name: 'The Tower', planetName: 'Earth', faction: 'Vanguard', sea: true, theme: 'earth',
  desc: "The last safe city's Tower, the Vanguard's home: the Watch, the Hall of Guardians, Tower North, the Hangar and the South Tower range.",
  fog: [220, 700], vista: buildTowerVista, sunDir: [0.7, 1, 0.4], light: { hemi: 1.3, sun: 2.6 },
  colors: { sky: 0xa6d2f5, fog: 0xc9d9e6, hemiTop: 0xd2e4f6, hemiBot: 0x8a7a68, sun: 0xffdcaa, ground: 0x7d8286, ground2: 0x72777b, rock: 0x8d949a, rock2: 0x757c82, wall: 0xb8bcbd, metal: 0x4b6a88, accent: 0xd9a64a, crate: 0x9a7e55, foliage: 0x6a8a3a, sea: 0xeaf2f8, enemy: 0x8a8f96, enemy2: 0x3a3f46, eye: 0x7fd8ff },
  planetColors: { sea: true, c: [0x2b5d8f, 0x3f7d4a, 0x8a7350, 0xe2e2e2] }, atmo: 0x9fd0ff,
  skyBody: { color: 0xf6efd6, size: 0.1, pos: [0, -900, 0], ring: false }, // not used: the Traveler is painted in buildTowerVista
  enemyNames: {},
  zoneNames: ['Tower Watch', 'Hall of Guardians', 'Tower North', 'Tower Hangar', 'South Tower Range'],
  missions: [],
};

export { TOWER_SPOTS };
