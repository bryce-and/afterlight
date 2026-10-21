// Hand-built Tower hub map (see makeKit in world.js). A close copy of the Destiny 1 Tower, the social hub: no enemies.
// Layout (x east, z south, north is -z; the visitor arrives at the south of the Watch looking north):
//   Tower Watch plaza (centre)  x -24..24, z -22..26   Postmaster building, Cryptarch, Gunsmith, Bounty Tracker steps
//   Hall of Guardians           x -26..-8, z -46..-22  roofed hall north-west of the Watch, Vanguard + kiosks, its roof is the overlook terrace
//   Tower North (west)          x -59..-26             Speaker's chamber, sealed Food District door, big tree, Traveler's Walk
//   Tower Hangar (east)         x 24..59, z -34..26    ships on pads, sky doors, lounge, launch pad
//   South Tower shooting range  x -9..9, z 26..78      walled roofless lane, gate with sign band
// yaw convention for TOWER_SPOTS: yaw 0 faces -z (north), forward = (-sin yaw, -cos yaw); yaw PI faces +z (south).
import * as THREE from 'three';
import { TOWER_SPOTS } from './tower-data.js';

// white and cream stone, pale blue-grey roofs, weathered brass, moss
const STONE = 0xece5d3, STONE2 = 0xdcd3bd, STONE3 = 0xbfb6a0, WHITE = 0xf6f2e8;
const SLATE = 0xa8b8c6, SLATE2 = 0x8499ae;
const BRASS = 0xbf9040, BRASSL = 0xf0c468, BRONZE = 0x8a6234;
const MOSS = 0x6a9450, LEAF = 0x4c9248, LEAF2 = 0x6cb35a, BARK = 0x6e5238;
const TITAN = 0x2a62c8, HUNTER = 0x9a3030, WARLOCK = 0xd9a62e;
const FLOOR = 0xcfc6af, FLOOR2 = 0xbfb59d, FLOORH = 0xd7cfba, GRAVEL = 0x8d8a80, GRAVEL2 = 0x7a786f;
const GLASS = 0xaee0ff, HOLO = 0xfff0c0, WATER = 0x78bde8;
const FL = 0.24; // visual paving top (the terrain bumps up to ~0.23 m; physics ground is y = 0)

let _ub = null;
const UB = () => _ub || (_ub = new THREE.BoxGeometry(1, 1, 1));

// visual-only box, any rotation, no collider
function vbox(K, x, y, z, w, h, d, color, o = {}) {
  return K.mesh(UB(), color, x, y, z, { rx: o.rx, ry: o.ry, rz: o.rz, scale: [w, h, d], glow: o.glow });
}

// flat paved area, top at FL
function slab(K, x1, z1, x2, z2, color, top = FL) {
  const m = vbox(K, (x1 + x2) / 2, top / 2, (z1 + z2) / 2, x2 - x1, top, z2 - z1, color);
  m.castShadow = false;
  return m;
}

// thin decal on the paving
function decal(K, x, z, w, d, color, glow = 0, y = FL) {
  const m = vbox(K, x, y + 0.015, z, w, 0.03, d, color, { glow });
  m.castShadow = false;
  return m;
}

// translucent unlit box (glass, light shafts)
function pane(K, x, y, z, w, h, d, color, opacity = 0.25, add = false) {
  const m = new THREE.Mesh(UB(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  K.scene.add(m);
  return m;
}

// text on a flat plane (canvas texture), faces +z at ry 0. Skipped when there is no document (headless checks).
const _texCache = new Map();
function sign(K, x, y, z, w, h, text, ry = 0, bg = '#2a3a52', fg = '#f0d08a') {
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

// Tower wall: cream stone, brass cap. gaps are [centre, width] in world coordinates along the wall;
// each gets a solid lintel above door height dh (so the opening is a doorway, not a hole to the top) and brass jambs.
function twall(K, x1, z1, x2, z2, h, o = {}) {
  const horiz = Math.abs(x2 - x1) >= Math.abs(z2 - z1);
  const a0 = horiz ? Math.min(x1, x2) : Math.min(z1, z2), len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1), fixed = horiz ? z1 : x1;
  const t = o.t ?? 1, dh = o.doorH ?? 4.8, gaps = o.gaps || [], color = o.color ?? STONE;
  K.wall(x1, z1, x2, z2, h, { t, color, gaps: gaps.map(([c, w]) => [c - w / 2 - a0, c + w / 2 - a0]) });
  const V = (along, y, L, hh, tt, col, opts) => (horiz ? vbox(K, along, y, fixed, L, hh, tt, col, opts) : vbox(K, fixed, y, along, tt, hh, L, col, opts));
  for (const [c, w] of gaps) {
    if (h > dh + 0.2) {
      if (horiz) K.box(c, fixed, w, h - dh, t, STONE2, { y: dh }); else K.box(fixed, c, t, h - dh, w, STONE2, { y: dh });
    }
    V(c - w / 2 - 0.2, Math.min(dh, h) / 2, 0.4, Math.min(dh, h), t + 0.3, BRASS);
    V(c + w / 2 + 0.2, Math.min(dh, h) / 2, 0.4, Math.min(dh, h), t + 0.3, BRASS);
    V(c, Math.min(dh, h - 0.2) + 0.1, w + 0.8, 0.3, t + 0.4, BRASSL);
  }
  if (!o.noCap) V(a0 + len / 2, h + 0.15, len + 0.4, 0.3, t + 0.4, BRASS);
  if (!o.noFoot) V(a0 + len / 2, 0.4, len, 0.5, t + 0.2, STONE3);
}

// hanging cloth banner, 'z' hangs on a wall that faces z, 'x' on one that faces x
function banner(K, x, y, z, color, axis = 'z', h = 4, w = 1.6) {
  const f = (a, b, c) => (axis === 'z' ? [a, b, c] : [c, b, a]);
  vbox(K, x, y + h / 2 + 0.1, z, ...f(w + 0.4, 0.2, 0.2), BRASS);
  vbox(K, x, y, z, ...f(w, h, 0.1), color);
  vbox(K, x, y - h * 0.1, z, ...f(w * 0.45, w * 0.45, 0.16), BRASSL, { ry: 0, rz: Math.PI / 4, glow: 0.4 });
  vbox(K, x, y - h / 2 - 0.1, z, ...f(w + 0.2, 0.18, 0.14), BRASS);
}

function lamp(K, x, y, z, color = 0xfff0cc, intensity = 6, dist = 26) {
  K.light(x, y, z, color, intensity, dist);
}

// lamp post: stone base, brass stem, glowing lantern (bulb comes from K.light)
function lampPost(K, x, z, withLight = true) {
  K.cyl(x, z, 0.35, 0.8, STONE3, { sides: 6 });
  K.cyl(x, z, 0.12, 3.6, BRONZE, { sides: 5, collide: false });
  vbox(K, x, 4.0, z, 0.6, 0.12, 0.6, BRASS);
  if (withLight) lamp(K, x, 3.8, z, 0xfff0cc, 5, 24);
}

// low bench (collides, so it is solid furniture)
function bench(K, x, z, alongX = true, len = 2.4) {
  const w = alongX ? len : 0.7, d = alongX ? 0.7 : len;
  K.box(x, z, w, 0.5, d, STONE2);
  vbox(K, x, 0.55, z, w + 0.1, 0.1, d + 0.1, BRONZE);
}

function planterTree(K, x, z, s = 1, y0 = 0) {
  K.box(x, z, 1.6 * s, 0.8, 1.6 * s, STONE3, { y: y0 });
  vbox(K, x, y0 + 0.82, z, 1.4 * s, 0.1, 1.4 * s, MOSS);
  K.cyl(x, z, 0.14 * s, 2.0 * s, BARK, { y: y0 + 0.8, sides: 5, collide: false });
  K.mesh(new THREE.IcosahedronGeometry(1.1 * s, 0), LEAF2, x, y0 + 3.1 * s, z, {});
}

// big Tower tree (Tower North): trunk with a collider, low-poly canopy blobs, a stone ring planter
function bigTree(K, x, z, s = 1) {
  K.cyl(x, z, 1.3 * s, 8 * s, BARK, { sides: 7, r2: 0.8 * s });
  for (const [dx, dy, dz, r, c] of [[0, 9.5, 0, 5.2, LEAF], [-3.5, 8.2, 1.5, 3.8, LEAF2], [3.2, 8.6, -1.8, 4.1, LEAF2], [0.8, 12.3, 0.4, 3.4, LEAF], [-1.6, 7.6, -3.4, 3.2, LEAF]]) {
    K.mesh(new THREE.IcosahedronGeometry(r * s, 1), c, x + dx * s, dy * s, z + dz * s, {});
  }
  const R = 4.6 * s, N = 12;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    K.obox(x + Math.cos(a) * R, z + Math.sin(a) * R, 2 * R * Math.sin(Math.PI / N) * 1.08, 0.9, 0.7, -(a + Math.PI / 2), k % 2 ? STONE2 : STONE3);
  }
  K.mesh(new THREE.CylinderGeometry(R - 0.5, R - 0.5, 0.1, 12), MOSS, x, 0.4, z, {});
}

// map a stall-local (u along the stall, v toward the customer) point to the world; face = side the customer stands on
function stallMap(x, z, face) {
  return (u, v) => ({ s: [x + u, z + v], n: [x - u, z - v], e: [x + v, z + u], w: [x - v, z - u] }[face]);
}

// market stall: back wall, counter, side posts, awning. kind picks the dressing.
function stall(K, x, z, face, len, kind, awning = SLATE) {
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
  B(0, -1.9, len, 3.2, 0.5, STONE2);            // back wall
  B(0, 0, len - 0.6, 1.1, 0.9, STONE, 0);       // counter
  Vb(0, 0, len - 0.3, 0.12, 1.1, BRONZE, 1.16);
  for (const s of [-1, 1]) B(s * (len / 2 - 0.2), 1.0, 0.4, 3.6, 0.4, BRASS); // front posts
  Vb(0, -0.4, len + 1.2, 0.35, 3.8, awning, 3.9); // awning slab
  Vb(0, 1.55, len + 1.2, 0.45, 0.3, SLATE2, 3.7);
  if (kind === 'gun') {
    for (let k = -2; k <= 2; k++) { Vb(k * (len / 6), -1.58, 0.14, 0.14, 1.4, 0x4b5560, 2.2); Vb(k * (len / 6), -1.58, 0.1, 0.5, 0.3, 0x4b5560, 1.5); }
    Vb(0, -1.62, len - 1, 0.12, 0.24, BRASS, 2.9);
    Vb(0, 0, 1.4, 0.2, 0.4, 0x3b4550, 1.3);
  } else if (kind === 'crypt') {
    Vb(0, 0, 0.8, 0.8, 0.8, HOLO, 1.7, 1.4);
    Vb(-len * 0.3, -1.2, 0.6, 0.6, 0.6, BRASSL, 1.5, 0.9); Vb(len * 0.3, -1.2, 0.6, 0.6, 0.6, GLASS, 1.5, 0.9);
    Vb(0, -1.62, len - 1, 0.1, 0.3, 0x6a5a8a, 2.6, 0.6);
  } else if (kind === 'mail') {
    for (let k = -2; k <= 2; k++) { Vb(k * (len / 5), -1.6, len / 5 - 0.2, 0.9, 0.2, k % 2 ? 0x5d7a94 : BRONZE, 1.5); Vb(k * (len / 5), -1.6, len / 5 - 0.2, 0.9, 0.2, k % 2 ? BRONZE : 0x5d7a94, 2.5); }
  } else if (kind === 'bounty') {
    Vb(0, -1.58, len - 1, 1.6, 0.14, 0x25323f, 2.2); Vb(0, -1.5, len - 1.3, 1.3, 0.1, GLASS, 2.2, 0.8);
  }
}

// terminal kiosk on a plinth, ~1.2 m wide, facing yaw (0 = -z). Spot and a soft light included.
function kiosk(K, x, z, yaw, color) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  K.cyl(x, z, 1.3, 0.3, STONE3, { sides: 12, collide: false });
  K.obox(x, z, 1.3, 0.95, 0.8, yaw, STONE);                       // plinth
  vbox(K, x, 1.0, z, 1.45, 0.1, 0.95, BRASS, { ry: yaw });         // cap
  vbox(K, x + fx * 0.05, 1.8, z + fz * 0.05, 1.3, 1.1, 0.14, 0x1c2430, { ry: yaw }); // screen frame
  vbox(K, x + fx * 0.13, 1.8, z + fz * 0.13, 1.1, 0.88, 0.05, color, { ry: yaw, glow: 1.2 }); // screen
  vbox(K, x - fx * 0.05, 1.45, z - fz * 0.05, 0.3, 0.5, 0.3, STONE3, { ry: yaw }); // stem
  K.light(x + fx * 0.9, 2.2, z + fz * 0.9, color, 3.2, 12);
}

// NPC post: a small low platform ring, top at y = 0.3
function npcBase(K, x, z, color) {
  K.cyl(x, z, 1.25, 0.3, STONE3, { sides: 14, collide: false });
  K.mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.05, 14), color, x, 0.31, z, { glow: 0.8 });
}

// training dummy spot: a low ring plinth, top at y = 0.25
function dummyBase(K, x, z, r = 0.95, color = BRASSL) {
  K.cyl(x, z, r + 0.2, 0.25, GRAVEL2, { sides: 12, collide: false });
  K.mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.04, 12), color, x, 0.27, z, { glow: 0.7 });
}

// Tower pillar: stone shaft, brass bands
function pillar(K, x, z, h, w = 1.4) {
  K.box(x, z, w, h, w, STONE);
  vbox(K, x, 0.4, z, w + 0.4, 0.8, w + 0.4, STONE3);
  vbox(K, x, h - 0.3, z, w + 0.4, 0.6, w + 0.4, BRASS);
}

// pyramid roof on a rectangle (visual, 4-sided cone scaled to fit)
function roof(K, x, y, z, w, d, h, color = SLATE) {
  return K.mesh(new THREE.ConeGeometry(0.7071, h, 4), color, x, y + h / 2, z, { ry: Math.PI / 4, scale: [w, 1, d] });
}

// spire tower (inaccessible skyline)
function spire(K, x, z, w, h, roofH) {
  K.box(x, z, w, h, w, STONE);
  vbox(K, x, h * 0.55, z, w + 0.5, 0.5, w + 0.5, BRASS);
  vbox(K, x, h - 0.2, z, w + 0.8, 0.5, w + 0.8, BRASS);
  roof(K, x, h, z, w + 1.6, w + 1.6, roofH);
  K.mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 5), BRASSL, x, h + roofH + 1.2, z, { glow: 0.5 });
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
  decal(K, x, z, s, s, FLOOR2, 0, FL);
  const i = s / 2 - 0.3;
  for (const [dx, dz, w, d] of [[0, -i, s - 0.6, 0.3], [0, i, s - 0.6, 0.3], [-i, 0, 0.3, s - 0.6], [i, 0, 0.3, s - 0.6]]) decal(K, x + dx, z + dz, w, d, BRASSL, 0.7, FL + 0.02);
}

export const TOWER = {
  tower: {
    spawn: [0, 16],
    bounds: [-60, 60, -62, 79],
    zones: [],
    noEdge: true,
    build(K) {
      const WH = 5.5; // plaza wall height

      // ================= paving =================
      slab(K, -24, -22, 24, 26, FLOOR);                 // Tower Watch
      slab(K, -26, -46, -8, -22, FLOORH);               // Hall of Guardians
      slab(K, -59, -62, -24, 26, FLOOR2);               // Tower North
      slab(K, 24, -34, 59, 26, FLOOR);                  // Hangar
      slab(K, 45, 12, 59, 26, 0x9fb0c0, FL + 0.01);      // lounge (lowest part of the hangar)
      slab(K, -9, 26, 9, 78, GRAVEL);                   // range
      slab(K, -6, 26, 6, 34, FLOOR, FL + 0.01);          // range gate apron
      // central Watch emblem and paths
      K.mesh(new THREE.CylinderGeometry(7, 7, 0.05, 28), STONE2, 0, FL + 0.03, 4, {});
      K.mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.05, 28), FLOOR, 0, FL + 0.06, 4, {});
      K.mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.06, 20), BRASS, 0, FL + 0.09, 4, { glow: 0.25 });
      for (let k = 0; k < 4; k++) decal(K, 0, 4, 13, 0.4, BRASS, 0.25, FL + 0.07).rotation.y = k * Math.PI / 4;
      decal(K, 0, 20, 5, 12, STONE, 0, FL + 0.01);

      // ================= Tower Watch walls =================
      twall(K, -26, -22, -8, -22, 5.6, { gaps: [[-16, 8]], doorH: 4.6, t: 1.2 }); // Hall south wall, doorway
      twall(K, -3, -22, 24, -22, WH);                                          // north wall (Postmaster, Gunsmith)
      twall(K, -24, -22, -24, 26, WH, { gaps: [[-1, 14]], doorH: 4.5 });       // west wall, gap to Tower North
      twall(K, 24, -34, 24, 26, WH, { gaps: [[3, 18]], doorH: 4.8 });          // east wall, gap to the Hangar
      twall(K, -59, 26, 24, 26, WH, { gaps: [[0, 12]], doorH: 4.8, t: 1.2 });  // south wall: range gate
      // gate pillars and sign band over the range entrance
      pillar(K, -6.8, 26, 8, 1.6);
      pillar(K, 6.8, 26, 8, 1.6);
      vbox(K, 0, 7.5, 26, 15.4, 1.8, 1.6, STONE2);
      vbox(K, 0, 8.55, 26, 15.8, 0.3, 1.9, BRASS);
      sign(K, 0, 7.5, 27.0, 13.6, 1.4, 'SOUTH TOWER  RANGE', 0);
      sign(K, 0, 7.5, 25.0, 13.6, 1.4, 'SOUTH TOWER  RANGE', Math.PI);
      lamp(K, 0, 6.2, 28, 0xfff0cc, 6, 24);

      // ================= Watch dressing =================
      // Postmaster building (Kadi): open front on the south, roof and side walls, lockers inside
      K.box(2, -17.5, 0.8, 5.6, 9, STONE);
      K.box(14, -17.5, 0.8, 5.6, 9, STONE);
      K.box(8, -21.4, 12, 5.6, 1.2, STONE);
      K.box(8, -17.5, 12.8, 0.5, 9.6, SLATE, { y: 5.6 });
      roof(K, 8, 6.1, -17.5, 14.8, 11.5, 2.4, SLATE2);
      vbox(K, 8, 5.2, -12.6, 12.8, 0.5, 0.5, BRASS);
      vbox(K, 8, 4.2, -12.9, 6, 0.9, 0.2, BRONZE);
      sign(K, 8, 4.2, -12.78, 5.6, 0.7, 'POSTMASTER', 0, '#3a4a5e');
      for (let k = -2; k <= 2; k++) { vbox(K, 8 + k * 2.1, 1.6, -21.0, 1.7, 2.6, 0.3, k % 2 ? 0x5d7a94 : BRONZE); vbox(K, 8 + k * 2.1, 2.7, -20.85, 0.9, 0.3, 0.1, BRASSL, { glow: 0.6 }); }
      K.box(5, -14.7, 1.4, 1.0, 1.0, STONE2); K.box(11, -14.7, 1.4, 1.0, 1.0, STONE2); // parcel counters either side of Kadi
      vbox(K, 5, 1.55, -14.7, 1.0, 0.8, 0.8, BRONZE); vbox(K, 11, 1.55, -14.7, 1.0, 0.8, 0.8, 0x5d7a94);
      lamp(K, 8, 4.4, -16.2, 0xfff0cc, 5, 18);
      // Gunsmith stall (Banshee-44), upper right corner
      stall(K, 19.5, -19.2, 's', 6.4, 'gun', 0x7d93a8);
      // Cryptarch (Master Rahool), right side, customers stand west of the stall
      stall(K, 22.2, -10, 'w', 6, 'crypt', 0x8a7fb0);
      // Bounty Tracker up a short set of steps (west side)
      K.platform(-20.5, -15.5, 6, 5, 1.2, { stairs: ['e'], stairW: 3, color: STONE2, stairColor: STONE });
      vbox(K, -20.5, 1.28, -15.5, 6.2, 0.1, 5.2, BRONZE);
      K.box(-22, -17.5, 4.4, 2.6, 0.6, STONE3, { y: 1.2 });
      vbox(K, -22, 3.2, -17.5, 3.4, 1.2, 0.2, 0x25323f); vbox(K, -22, 3.2, -17.38, 3.0, 0.9, 0.05, GLASS, { glow: 0.9 });
      K.box(-18.7, -15.5, 1.1, 1.0, 0.9, STONE, { y: 1.2 });
      vbox(K, -18.7, 2.5, -15.5, 0.9, 0.7, 0.1, GLASS, { glow: 1.1, ry: -Math.PI / 2 });
      sign(K, -22.9, 5.0, -21.2, 2.4, 0.6, 'BOUNTIES', 0, '#3a4a5e');
      // central fountain-free planters, benches, lamp posts, banners
      for (const [x, z] of [[-9, 8], [9, 8], [-9, 18], [9, 18]]) planterTree(K, x, z, 1);
      bench(K, -14, 10, false); bench(K, 14, 10, false); bench(K, -4, 22, true); bench(K, 4, 22, true);
      for (const [x, z, lit] of [[-14, -3, true], [14, -3, true], [-14, 14, false], [14, 14, false], [0, -9, false], [0, 22, false], [-5, 24, false], [5, 24, false]]) lampPost(K, x, z, lit);
      for (const [x, c] of [[-20, TITAN], [-12, HUNTER], [12, WARLOCK], [20, TITAN]]) banner(K, x, 3.4, 25.45, c, 'z', 4);
      for (const z of [8, 18]) banner(K, 23.45, 3.4, z, HUNTER, 'x', 4);
      // facing stone steps at the south
      for (let k = 0; k < 3; k++) K.box(0, 23.3 + k * 0.7, 10 - k * 1.2, 0.18 * (k + 1), 0.7, STONE, { collide: false });

      // ================= Watch staircase (rises to the Hall's roof terrace, the overlook) =================
      K.stairs(-5.5, -22, 'n', 5, 6.0, { color: STONE2 });
      K.box(-5.5, -34, 5, 6.0, 6, STONE2);                       // top landing, flush with the terrace (x -8)
      K.box(-2.75, -29.75, 0.5, 7.4, 15.5, STONE, { y: 0 });     // outer stair wall (east side)
      K.box(-5.5, -37.25, 5.6, 7.3, 0.5, STONE);                // landing north wall
      vbox(K, -2.75, 7.55, -29.75, 0.7, 0.2, 15.7, BRASS);
      // arch over the Hall doorway
      vbox(K, -16, 5.0, -22, 9.2, 0.5, 1.6, BRASS);
      banner(K, -21.8, 2.6, -21.3, TITAN, 'z', 3.2, 1.0);
      banner(K, -10.2, 2.6, -21.3, WARLOCK, 'z', 3.2, 1.0);

      // ================= Hall of Guardians =================
      twall(K, -26, -46, -8, -46, 5.6, { t: 1.2, noCap: true });  // north wall
      twall(K, -26, -62, -26, -22, 7, { t: 1.2 });                 // west wall (also Tower North's east wall)
      twall(K, -8, -46, -8, -37, 5.6, { t: 1.2, noCap: true });    // east wall, north of the landing
      twall(K, -8, -31, -8, -22, 5.6, { t: 1.2, noCap: true });    // east wall, south of the landing
      K.box(-8, -34, 1.2, 5.6, 6, STONE, { y: 0 });                 // east wall behind the landing
      K.box(-17.3, -34, 18.4, 0.4, 25, STONE2, { y: 5.6 });            // roof slab = terrace floor (top y 6.0)
      for (const z of [-28, -34, -40]) { pillar(K, -24.8, z, 5.6, 1.2); pillar(K, -9.2, z, 5.6, 1.2); }
      // Vanguard banners and the three posts in front of them
      for (const [x, c, name] of [[-23, TITAN, 'TITAN'], [-17, HUNTER, 'HUNTER'], [-11, WARLOCK, 'WARLOCK']]) {
        banner(K, x, 2.9, -45.3, c, 'z', 3.4, 2.2);
        decal(K, x, -41.5, 4, 3.6, c, 0.3, FL + 0.01);
      }
      sign(K, -17, 5.1, -45.35, 7.5, 0.6, 'THE VANGUARD', 0, '#3a4a5e');
      // Vanguard emblem on the floor, tall windows light the hall
      K.mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.05, 20), BRASS, -17, FL + 0.04, -33, { glow: 0.2 });
      K.mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.06, 20), FLOORH, -17, FL + 0.06, -33, {});
      for (let k = 0; k < 3; k++) decal(K, -17, -33, 5.6, 0.35, BRASS, 0.3, FL + 0.08).rotation.y = k * Math.PI / 3;
      for (const x of [-22, -12]) vbox(K, x, 3, -22.05, 2.4, 3.2, 0.2, GLASS, { glow: 0.2 });
      lamp(K, -17, 5.0, -29, 0xfff0cc, 6, 24);
      lamp(K, -17, 5.0, -40, 0xfff0cc, 6, 24);
      // kiosks
      kiosk(K, -22, -29.5, Math.PI, 0x6fc4ff);
      kiosk(K, -12, -29.5, Math.PI, 0xffd36a);
      // post bases
      npcBase(K, -23, -41.5, TITAN);
      npcBase(K, -17, -42.5, HUNTER);
      npcBase(K, -11, -41.5, WARLOCK);
      npcBase(K, 8, -14.6, 0xbfa070);

      // ================= overlook terrace on the Hall roof (Traveler view) =================
      const TOP = 6.0;
      const rail = (x, z, w, d) => { K.box(x, z, w, 1.3, d, STONE, { y: TOP }); vbox(K, x, TOP + 1.35, z, w + 0.1, 0.12, d + 0.1, BRASS); };
      rail(-26.45, -34, 0.5, 24.4);                 // west edge, looks over Tower North
      rail(-17, -46.3, 19.4, 0.5);                  // north edge
      rail(-8.3, -42, 0.5, 8.6);                    // east edge, north of landing
      rail(-8.3, -25.5, 0.5, 6.2);                  // east edge, south of landing
      rail(-17, -21.7, 19.4, 0.5);                  // south edge over the Watch
      for (const [x, z] of [[-24, -43], [-24, -25]]) planterTree(K, x, z, 0.9, TOP);
      K.box(-23, -34, 0.7, 0.5, 2.4, STONE2, { y: TOP });
      vbox(K, -23, TOP + 0.55, -34, 0.7, 0.1, 2.5, BRONZE);
      K.box(-24.4, -38.5, 0.5, 1.2, 0.5, BRASS, { y: TOP });
      vbox(K, -24.4, TOP + 1.6, -38.5, 0.3, 0.3, 1.6, BRASS, { rx: 0.3 });
      lamp(K, -17, TOP + 3.5, -34, 0xfff0cc, 4, 20);

      // ================= Tower North (west) =================
      twall(K, -59, -62, -26, -62, 10, { noFoot: true, t: 1.4 });          // Food District wall
      K.wall(-59, -62, -59, 26, 2.6, { t: 0.8, color: STONE2 });             // west railing wall (Traveler's Walk is behind it)
      // west wall tops: arches and a brass rail
      for (let z = -56; z <= 20; z += 12) { vbox(K, -59, 3.0, z, 0.9, 0.5, 1.2, BRASS); }
      // big tree and the central courtyard
      bigTree(K, -41, -8, 1.5);
      // Speaker's chamber
      {
        const cx = -42, cz = -47, R = 8.5, N = 14;
        for (let k = 0; k < N; k++) {
          if (k === 3) continue;                       // doorway on the south side (angle 90 deg)
          const a = ((k + 0.5) / N) * Math.PI * 2;
          const seg = 2 * R * Math.sin(Math.PI / N) * 1.1;
          const o = K.obox(cx + Math.cos(a) * R, cz + Math.sin(a) * R, seg, 6.5, 0.9, -(a + Math.PI / 2), k % 2 ? STONE : STONE2);
          void o;
        }
        K.box(cx, cz + R, 3.9, 2, 0.9, STONE2, { y: 4.5 });          // lintel over the doorway
        vbox(K, cx - 2.1, 2.5, cz + R, 0.4, 5, 1.2, BRASS); vbox(K, cx + 2.1, 2.5, cz + R, 0.4, 5, 1.2, BRASS);
        K.mesh(new THREE.ConeGeometry(R + 1.4, 3.4, 14), SLATE, cx, 6.5 + 1.7, cz, {});
        K.mesh(new THREE.CylinderGeometry(R - 0.5, R - 0.5, 0.06, 14), 0xb7b0a2, cx, FL + 0.03, cz, {});
        K.mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.06, 14), BRASS, cx, FL + 0.07, cz - 0.5, { glow: 0.2 });
        // the machine that projects a small Traveler
        K.cyl(cx, cz - 0.5, 1.0, 1.1, STONE3, { sides: 8 });
        K.cyl(cx, cz - 0.5, 0.5, 1.5, BRONZE, { sides: 8, y: 1.1 });
        K.mesh(new THREE.IcosahedronGeometry(0.75, 1), HOLO, cx, 3.5, cz - 0.5, { glow: 1.6 });
        K.mesh(new THREE.TorusGeometry(1.05, 0.05, 5, 16), BRASSL, cx, 3.5, cz - 0.5, { rx: Math.PI / 2.4, glow: 1.0 });
        pane(K, cx, 3.0, cz - 0.5, 1.4, 4.4, 1.4, HOLO, 0.12, true);
        K.light(cx, 3.6, cz - 0.5, HOLO, 7, 22);
        for (const a of [0.9, 2.2, 4.0, 5.4]) K.box(cx + Math.cos(a) * 5.6, cz + Math.sin(a) * 5.6, 1.2, 0.5, 0.8, STONE2); // stone seats
      }
      sign(K, -42, 5.5, -37.98, 3.6, 0.7, "SPEAKER", 0, '#3a4a5e');
      // sealed door: the Food District (closed)
      K.door(-45, -61.1, 11, 8.6, 'x', { zone: null, id: 'food-district', color: STONE3, trim: BRASS, t: 1.0 });
      sign(K, -45, 9.3, -61.25, 10, 0.8, 'FOOD DISTRICT  SEALED', 0, '#5a2a2a', '#ffdca0');
      for (const x of [-55, -35]) banner(K, x, 5.0, -61.2, SLATE2, 'z', 5.5, 1.8);
      // Traveler's Walk: raised promenade along the west edge with a view of the Traveler
      K.platform(-56.2, -26, 5, 28, 0.8, { stairs: ['e'], stairW: 4, color: STONE2, stairColor: STONE });
      K.platform(-56.2, 0, 5, 20, 0.8, { stairs: ['e'], stairW: 4, color: STONE2, stairColor: STONE });
      for (const [z, d] of [[-26, 28], [0, 20]]) {
        K.box(-58.6, z, 0.5, 1.3, d, STONE, { y: 0.8 });
        vbox(K, -58.6, 2.15, z, 0.6, 0.12, d + 0.1, BRASS);
      }
      for (const z of [-36, -26, -16, -6, 4, 10 - 0.1]) lampPost(K, -54.2, z, Math.abs(z + 26) < 12 || z === 4);
      sign(K, -53.8, 3.2, -26, 6, 0.7, "TRAVELER'S WALK", Math.PI / 2, '#3a4a5e');
      // flowers and moss beds around the courtyard
      for (const [x, z, w, d] of [[-32, 16, 6, 2], [-50, 16, 6, 2], [-32, -18, 2, 6], [-48, 2, 6, 2]]) {
        K.box(x, z, w, 0.6, d, STONE3);
        vbox(K, x, 0.65, z, w - 0.3, 0.1, d - 0.3, MOSS);
        vbox(K, x, 0.72, z, w - 0.8, 0.1, d - 0.8, 0xe8a0b4, { glow: 0.3 });
      }
      lamp(K, -41, 5, -8, 0xfff0cc, 5, 28);
      lamp(K, -42, 6, -30, 0xfff0cc, 4, 26);
      lamp(K, -50, 5, 12, 0xfff0cc, 4, 22);

      // ================= Tower Hangar (east) =================
      twall(K, 24, -34, 59, -34, 8, { t: 1.2 });                           // hangar north wall
      twall(K, 24, 26, 59, 26, 8, { t: 1.2 });                             // hangar south wall
      // east wall: rail wall with tall open door frames toward the sky
      K.wall(59, -34, 59, 26, 2.4, { t: 1, color: STONE });
      for (const z of [-26, -8, 10]) {
        for (const s of [-1, 1]) { vbox(K, 59, 6, z + s * 6.2, 1.2, 12, 1.6, STONE2); vbox(K, 59, 6.2, z + s * 6.8, 0.5, 11, 0.6, BRASS); }
        vbox(K, 59, 12.2, z, 1.4, 1.2, 14, STONE2);
        vbox(K, 59, 12.9, z, 1.6, 0.3, 14.4, BRASS);
      }
      vbox(K, 59, 3.4, -30, 1.0, 4, 1.2, STONE2); // door panels slid open at the ends
      // inside the hangar: ships on pads
      for (const [x, z, c, t] of [[36, -26, 0xe8e4d8, TITAN], [50, -26, 0xd8d4c4, HUNTER], [43, -12, 0xe8e0c8, WARLOCK]]) {
        landingPad(K, x, z + 0.5, 11);
        ship(K, x, z, -1, c, t);
      }
      // launch pad (return to orbit)
      landingPad(K, 40, 10, 8);
      K.mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.1, 20), 0x6fd0ff, 40, FL + 0.06, 10, { glow: 1.3 });
      K.mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.12, 20), 0xdff6ff, 40, FL + 0.1, 10, { glow: 1.0 });
      pane(K, 40, 3.0, 10, 3.4, 6, 3.4, 0x9fe4ff, 0.14, true);
      K.light(40, 3, 10, 0x8fdcff, 6, 22);
      // lounge with Hunter banners
      for (const [x, z, w, d] of [[48, 17, 3.2, 1.0], [48, 23, 3.2, 1.0], [56, 20, 1.0, 3.2]]) { K.box(x, z, w, 0.6, d, 0x5d7a94); vbox(K, x, 0.95, z + (d < w ? (z > 20 ? 0.4 : -0.4) : 0), w, 0.7, d < w ? 0.2 : d, 0x4a6580); }
      K.box(52, 20, 2.2, 0.6, 2.2, BRONZE);
      vbox(K, 52, 0.7, 20, 2.0, 0.08, 2.0, GLASS, { glow: 0.3 });
      for (const x of [48, 52, 56]) banner(K, x, 4.2, 25.4, HUNTER, 'z', 5, 1.8);
      for (const [x, z] of [[45.5, 13.5], [58, 13.5], [45.5, 24.5], [58, 24.5]]) K.box(x, z, 0.5, 4.2, 0.5, BRASS);
      K.box(52, 19, 13.4, 0.35, 12.4, SLATE, { y: 4.2 });
      lamp(K, 52, 3.8, 19, 0xfff0cc, 5, 24);
      // hangar dressing
      for (const [x, z] of [[27, -30], [27, 22]]) { K.box(x, z, 1.6, 1.4, 1.6, 0x8a98a6); vbox(K, x, 1.55, z, 1.2, 0.2, 1.2, BRASSL, { glow: 0.5 }); }
      for (const z of [-31, -17]) banner(K, 24.55, 3.0, z, TITAN, 'x', 3.4, 1.8);
      lamp(K, 40, 7, -20, 0xfff0cc, 6, 36);
      lamp(K, 40, 7, 4, 0xfff0cc, 6, 34);
      sign(K, 24.6, 5.1, 3, 7, 0.55, 'TOWER HANGAR', Math.PI / 2, '#3a4a5e');

      // ================= South Tower shooting range =================
      const RW = 4.4;
      twall(K, -9, 26, -9, 78, RW, { t: 1.0, color: STONE2 });
      twall(K, 9, 26, 9, 78, RW, { t: 1.0, color: STONE2 });
      twall(K, -9, 78, 9, 78, RW, { t: 1.0, color: STONE2 });
      // lane floor and stripes
      decal(K, 0, 52, 15, 52, GRAVEL2, 0, FL);
      decal(K, 0, 33.2, 14.6, 0.6, BRASSL, 0.9, FL);          // firing line (fire point is z = 32)
      for (const d of [8, 16, 24, 32, 40]) { decal(K, 0, 32 + d, 14.8, 0.18, 0xe8e0c8, 0.2, FL); }
      for (const [d, label] of [[8, '8 M'], [16, '16 M'], [24, '24 M'], [32, '32 M'], [40, '40 M']]) {
        sign(K, -8.45, 2.4, 32 + d, 1.6, 0.6, label, Math.PI / 2, '#3a4a5e');
        sign(K, 8.45, 2.4, 32 + d, 1.6, 0.6, label, -Math.PI / 2, '#3a4a5e');
      }
      // firing line: low rails with a shooter bench at each side
      for (const s of [-1, 1]) { K.box(s * 7.6, 32, 1.6, 0.9, 2.4, STONE2); vbox(K, s * 7.6, 0.95, 32, 1.7, 0.1, 2.5, BRONZE); }
      // dummy and boss plinths
      const dummies = [[-4.5, 40], [3.5, 46], [-2.5, 52], [4.5, 58], [-4.0, 64], [2.5, 70]];
      for (const [x, z] of dummies) dummyBase(K, x, z);
      dummyBase(K, 0, 72, 2.2, 0xff9a6a);
      // back wall target banner and sand stop
      banner(K, 0, 3.3, 77.4, SLATE2, 'z', 4, 4);
      for (const x of [-6, 6]) banner(K, x, 3.3, 77.4, HUNTER, 'z', 3.4, 1.4);
      for (const z of [38, 56]) for (const s of [-1, 1]) lampPost(K, s * 8.1, z, false);
      lamp(K, 0, 5, 36, 0xfff0cc, 6, 30);
      lamp(K, 0, 5, 58, 0xfff0cc, 6, 34);
      lamp(K, 0, 5, 72, 0xfff0cc, 6, 30);

      // ================= skyline (inaccessible towers around the Tower) =================
      spire(K, 12, -44, 8, 26, 12);
      spire(K, -4, -52, 5, 36, 14);
      spire(K, 30, -50, 6, 18, 8);
      spire(K, 48, -46, 7, 22, 9);
      spire(K, -50, 40, 5, 16, 7);
      spire(K, 52, 40, 5, 18, 7);
      spire(K, 30, 44, 4, 12, 6);
      spire(K, -34, 48, 6, 14, 7);
      // clad the hidden ground behind the walls with slate roofs so the outside reads as rooftops
      K.box(34, -44, 18, 6, 8, STONE2);
      roof(K, 34, 6, -44, 19, 9, 3.5, SLATE2);
      K.box(-14, -56, 20, 5, 8, STONE2);
      roof(K, -14, 5, -56, 21, 9, 3, SLATE);
      // light shafts in the plaza for the warm-sunlight look
      pane(K, -10, 9, 6, 2, 18, 2, 0xfff2c8, 0.08, true);
      pane(K, 8, 9, -2, 2, 18, 2, 0xfff2c8, 0.08, true);
      lamp(K, 0, 7, 4, 0xfff0cc, 7, 40);
      lamp(K, 16, 6, -8, 0xfff0cc, 4, 24);
      lamp(K, -16, 6, 14, 0xfff0cc, 4, 24);
    },
  },
};

export const TOWER_LOC = {
  id: 'tower', name: 'The Tower', planetName: 'Earth', faction: 'Vanguard', sea: true, theme: 'earth',
  desc: "The last safe city's Tower, the Vanguard's home: the Watch, the Hall of Guardians, the Hangar and the South Tower range.",
  fog: [90, 330], sunDir: [0.5, 1, 0.35], light: { hemi: 2.0, sun: 2.5 },
  colors: { sky: 0xa6d2f5, fog: 0xdcebf6, hemiTop: 0xfff6e2, hemiBot: 0xb4bfa8, sun: 0xfff0d0, ground: 0xd5ccb6, ground2: 0xc7bea8, rock: 0x9aa5ae, rock2: 0x7c8893, wall: 0xe6dfcd, metal: 0x8c9aa6, accent: 0xd9a64a, crate: 0x9a7e55, foliage: 0x4f9a4a, sea: 0xeaf2f8, enemy: 0x8a8f96, enemy2: 0x3a3f46, eye: 0x7fd8ff },
  planetColors: { sea: true, c: [0x2b5d8f, 0x3f7d4a, 0x8a7350, 0xe2e2e2] }, atmo: 0x9fd0ff,
  skyBody: { color: 0xf3e9c8, size: 150, pos: [-420, 80, -340], ring: false },
  enemyNames: {},
  zoneNames: ['Tower Watch', 'Hall of Guardians', 'Tower North', 'Tower Hangar', 'South Tower Range'],
  missions: [],
};

export { TOWER_SPOTS };
