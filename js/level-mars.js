// Hand-built Mars mission maps (see makeKit in world.js).
// Meridian Bay under the Cabal: sloped bulwark walls, heavy armour plates, hazard lights,
// landing pads, drop pods and ship hulks, over half-buried Golden Age (Clovis Bray) towers.
import * as THREE from 'three';

// Cabal armour and deck tones, hazard lights, Golden Age concrete and glass
const CAB = 0x6b5d50, CAB2 = 0x4d443d, CAB3 = 0x3a332e, DECK = 0x2b2827, DECK2 = 0x36302d;
const HAZ = 0xffa31a, HAZR = 0xff4a1c, BANNER = 0x8b2c24;
const GA = [0xd2c9ba, 0xbdb4a6, 0xc8b9a2], GLASS = 0x3d4f5c, STONE = 0xd8ccb4, STONE2 = 0xb9ab92, PAVE = 0xb3a088;

let _ub = null;
const UB = () => _ub || (_ub = new THREE.BoxGeometry(1, 1, 1));

// visual-only box, any rotation, no collider
function vbox(K, x, y, z, w, h, d, color, o = {}) {
  return K.mesh(UB(), color, x, y, z, { rx: o.rx, ry: o.ry, rz: o.rz, scale: [w, h, d], glow: o.glow });
}

// several boxes as one rotated group (ship hulls, statues). parts: [w, h, d, px, py, pz, color, { rx, ry, rz, glow }]
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
  g.position.set(x, y + (K.ground ? K.ground(x, z) : 0), z); // y is measured from the terrain under (x, z), like the kit
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

// Cabal bulwark: axis-aligned wall with a plinth, a sloped armour face, a set-back crown,
// buttress ribs and a hazard strip. face = +1 faces +z (or +x for a wall running along z).
function bulwark(K, x1, z1, x2, z2, h, o = {}) {
  const horiz = Math.abs(x2 - x1) >= Math.abs(z2 - z1);
  const t = o.t ?? Math.max(1.6, h * 0.4), face = o.face ?? 1;
  const col = o.color ?? CAB, col2 = o.color2 ?? CAB2, rib = o.rib ?? 9;
  const start = horiz ? Math.min(x1, x2) : Math.min(z1, z2), fixed = horiz ? z1 : x1;
  const len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const B = (along, across, L, hh, tt, color, y, opts = {}) => (horiz
    ? K.box(along, fixed + across, L, hh, tt, color, { y, ...opts })
    : K.box(fixed + across, along, tt, hh, L, color, { y, ...opts }));
  const V = (along, across, y, L, hh, tt, color, opts = {}) => (horiz
    ? vbox(K, along, y, fixed + across, L, hh, tt, color, opts)
    : vbox(K, fixed + across, y, along, tt, hh, L, color, opts));
  // sloped face plate from the plinth's front edge up to the crown
  const zf = face * t * 0.5, zc = -face * t * 0.07, run = Math.abs(zf - zc), rise = h * 0.7;
  const ang = Math.atan2(run, rise), plen = Math.hypot(run, rise);
  for (const [a, b] of runs(len, o.gaps)) {
    const L = b - a, mid = start + (a + b) / 2;
    // each layer is a hair shorter than the one below so no two end caps share a plane (z-fight free)
    B(mid, 0, L, h * 0.3, t, col, 0);
    B(mid, -face * t * 0.15, L - 0.06, h * 0.4, t * 0.68, col2, h * 0.3);
    B(mid, -face * t * 0.27, L - 0.12, h * 0.3, t * 0.4, col, h * 0.7);
    V(mid, (zf + zc) / 2, h * 0.65, L - 0.03, plen, 0.45, col, horiz ? { rx: -face * ang } : { rz: face * ang });
    V(mid, -face * t * 0.07 + face * 0.1, h * 0.88, L - 0.09, 0.3, 0.2, HAZ, { glow: 1.3 });
    if (L > rib * 1.2) {
      for (let s = a + rib / 2, k = 0; s < b - 1; s += rib, k++) {
        V(start + s, face * t * 0.5, h * 0.4, 0.9, h * 0.8, 0.9, col2);
        if (k % 2 === 0) V(start + s, face * (t * 0.5 + 0.5), h * 0.3, 0.5, 0.5, 0.2, HAZ, { glow: 1.6 });
      }
    }
  }
}

// angular Cabal pylon / bulwark tower (no crenellations): tapered stack with a sloped cap and a lamp
function pylon(K, x, z, h, o = {}) {
  const w = o.w ?? 5, col = o.color ?? CAB2, collide = o.collide ?? true, y = o.y ?? 0;
  K.box(x, z, w, h * 0.6, w * 1.2, col, { y, collide });
  K.box(x, z, w * 0.7, h * 0.4, w * 0.85, o.color2 ?? CAB, { y: y + h * 0.6, collide });
  vbox(K, x, y + h + 0.6, z + w * 0.15, w * 0.75, 0.6, w * 1.0, CAB3, { rx: 0.35 });
  vbox(K, x, y + h * 0.82, z, w * 0.72, 0.5, w * 0.87, HAZ, { glow: 1.6 });
}

// Cabal drop pod, slightly tilted where it slammed in, hazard ring at its foot
function dropPod(K, x, z, o = {}) {
  const y = o.y ?? 0, tilt = o.tilt ?? K.R(-0.18, 0.18), collide = o.collide ?? true;
  K.mesh(new THREE.CylinderGeometry(1.0, 1.7, 4.6, 6), CAB2, x, y + 2.1, z, { rz: tilt, collide: collide ? 0.72 : false });
  K.mesh(new THREE.ConeGeometry(1.0, 1.4, 6), CAB3, x - Math.sin(tilt) * 4.9, y + 5.0, z, { rz: tilt });
  K.mesh(new THREE.CylinderGeometry(1.78, 1.78, 0.35, 6), HAZ, x - Math.sin(tilt) * 0.6, y + 0.6, z, { rz: tilt, glow: 1.4 });
  vbox(K, x + 2.1, y + 0.25, z + 0.4, 1.5, 0.3, 2.4, CAB, { ry: K.R(-0.6, 0.6), rz: 0.2 });
  K.mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.05, 8), 0x3b2117, x, y + 0.14, z);
}

// visual landing pad (no collider so it never lifts enemies off y = 0), with corner lamp posts
function landingPad(K, x, z, s) {
  vbox(K, x, 0.1, z, s, 0.2, s, CAB3);
  const i = s * 0.32;
  for (const [dx, dz, w, d] of [[0, -i, i * 2, 0.35], [0, i, i * 2, 0.35], [-i, 0, 0.35, i * 2], [i, 0, 0.35, i * 2]]) vbox(K, x + dx, 0.22, z + dz, w, 0.05, d, HAZ, { glow: 1.1 });
  vbox(K, x, 0.22, z, s * 0.12, 0.05, s * 0.4, HAZ, { glow: 0.8 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    K.box(x + sx * (s / 2 - 0.4), z + sz * (s / 2 - 0.4), 0.6, 1.3, 0.6, CAB2);
    vbox(K, x + sx * (s / 2 - 0.4), 1.5, z + sz * (s / 2 - 0.4), 0.45, 0.4, 0.45, HAZ, { glow: 2 });
  }
}

// turret emplacement: low armoured ring with a gun facing angle a (radians, 0 = +x, PI/2 = +z)
function turret(K, x, z, a, o = {}) {
  const s = o.s ?? 1, y = o.y ?? 0, collide = o.collide ?? true;
  K.cyl(x, z, 2.7 * s, 1.0 * s, CAB3, { sides: 8, y, collide });
  K.box(x, z, 2 * s, 1.4 * s, 2 * s, CAB, { y: y + 1.0 * s, collide });
  vbox(K, x, y + 2.7 * s, z, 1.4 * s, 0.6 * s, 1.4 * s, CAB2, { ry: -a });
  vbox(K, x + Math.cos(a) * 2.2 * s, y + 1.9 * s, z + Math.sin(a) * 2.2 * s, 3.4 * s, 0.4 * s, 0.4 * s, CAB3, { ry: -a });
  vbox(K, x + Math.cos(a) * 1.05 * s, y + 2.0 * s, z + Math.sin(a) * 1.05 * s, 0.2, 0.3 * s, 0.6 * s, HAZR, { ry: -a, glow: 2 });
}

// comms mast: lattice column, crossbars, a dish and a blinking-red tip
function mast(K, x, z, h) {
  K.box(x, z, 0.8, h, 0.8, CAB3);
  K.box(x, z, 2.4, 1.2, 2.4, CAB2);
  for (let y = 4; y < h - 1; y += 4.5) vbox(K, x, y, z, 3.2, 0.25, 0.25, CAB2, { ry: y * 0.7 });
  K.mesh(new THREE.ConeGeometry(1.6, 0.7, 8), CAB, x + 0.9, h - 2.2, z, { rz: 1.2 });
  vbox(K, x, h + 0.3, z, 0.5, 0.6, 0.5, HAZR, { glow: 2.4 });
}

// Cabal bunker / command block: armoured box, set-back roof, hazard band, dark door slot
function bunker(K, x, z, w, d, h, o = {}) {
  K.box(x, z, w, h, d, o.color ?? CAB);
  K.box(x, z, w * 0.7, h * 0.35, d * 0.7, CAB2, { y: h });
  vbox(K, x, h * 0.72, z, w + 0.12, 0.3, d + 0.12, HAZ, { glow: 1.2 });
  vbox(K, x, h * 0.32, z + (d / 2 + 0.05) * (o.door ?? 1), w * 0.35, h * 0.6, 0.1, CAB3);
}

// stacked Cabal supply containers (cover)
function supply(K, x, z, rot = false) {
  const w = rot ? 1.7 : 2.6, d = rot ? 2.6 : 1.7;
  K.box(x, z, w, 1.6, d, CAB2);
  vbox(K, x, 0.8, z, w + 0.06, 0.2, d + 0.06, HAZ, { glow: 0.9 });
  if (K.chance(0.6)) K.box(x + K.R(-0.3, 0.3), z + K.R(-0.3, 0.3), w * 0.8, 1.3, d * 0.8, CAB, { y: 1.6 });
}

// Golden Age skyscraper half-buried in the sand, leaning by `lean` radians about axis 'x' or 'z'.
// The mesh is tilted with no collider; a stack of tight boxes follows its axis instead.
function tower(K, x, z, w, d, len, o = {}) {
  const lean = o.lean ?? 0, axis = o.axis ?? 'z', sink = o.sink ?? 4, base = o.y ?? 0, y0 = base - sink;
  const color = o.color ?? K.RP(GA);
  const ux = axis === 'z' ? -Math.sin(lean) : 0, uz = axis === 'x' ? Math.sin(lean) : 0, uy = Math.cos(lean);
  const rx = axis === 'x' ? lean : 0, rz = axis === 'z' ? lean : 0;
  const at = (s) => [x + ux * s, y0 + uy * s, z + uz * s];
  const m = K.mesh(new THREE.BoxGeometry(w, len, d).translate(0, len / 2, 0), color, x, y0, z, { rx, rz });
  const step = o.bandStep ?? 3.4;
  for (let s = sink + 1.5; s < len - 1.2; s += step) {
    const [px, py, pz] = at(s);
    vbox(K, px, py, pz, w + 0.14, 1.1, d + 0.14, GLASS, { rx, rz });
  }
  // broken crown and a stub of exposed frame
  const [tx, ty, tz] = at(len + 0.9);
  vbox(K, tx + w * 0.15, ty, tz, w * 0.55, 1.8, d * 0.7, color, { rx: rx + 0.15, rz: rz - 0.1 });
  const [fx, fy, fz] = at(len + 2.4);
  vbox(K, fx - w * 0.2, fy, fz + d * 0.2, 0.4, 3, 0.4, 0x6a625a, { rx: rx - 0.2, rz: rz + 0.25 });
  // distinct crowns so the avenue's towers do not read as one primitive: a sloped roof or a crane stub
  if (o.crown === 'slope') {
    const [sx, sy, sz] = at(len + 0.2);
    vbox(K, sx, sy, sz, w * 1.02, 2.6, d * 1.02, 0xa89c8c, { rx: rx + (axis === 'x' ? 0.55 : 0), rz: rz + (axis === 'z' ? 0.55 : 0) });
  } else if (o.crown === 'crane') {
    const [cx2, cy2, cz2] = at(len + 3);
    vbox(K, cx2, cy2, cz2, 0.5, 6, 0.5, 0x6a625a, { rx, rz });
    vbox(K, cx2 + w * 0.7, cy2 + 3, cz2, w * 1.6, 0.4, 0.4, 0x6a625a, { rx, rz });
    vbox(K, cx2 + w * 1.4, cy2 + 1.2, cz2, 0.12, 3.4, 0.12, HAZ, { glow: 1 });
  }
  // sand drift piled against the base
  const s0 = sink / uy; // where the axis meets the ground
  const [bx, , bz] = at(s0);
  K.mesh(new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), o.sand ?? K.C.ground2, bx, base, bz, { scale: [w * 0.95, 1.6, d * 0.95] });
  if (o.collide !== false) {
    const maxS = s0 + (o.colH ?? 18) / uy;
    let first = true;
    for (let s = s0; s < Math.min(len, maxS); s += 3) {
      const [px, py, pz] = at(s + 1.5);
      K.collider(px - w / 2, Math.max(0, py - 1.7), pz - d / 2, px + w / 2, py + 1.7, pz + d / 2, first ? m : null);
      first = false;
    }
  }
  return m;
}

// low rounded sand dune (cover, shrunk collider)
function dune(K, x, z, w, d, h) {
  K.mesh(new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2), K.C.ground2, x, 0, z, { scale: [w, h, d], collide: 0.7 });
}

// Cabal Harvester dropship hull (nose toward -z in local space). o: { L, ry, rx, rz, y, collide }
function harvester(K, x, z, o = {}) {
  const L = o.L ?? 20, W = L * 0.34, H = L * 0.2, y = o.y ?? 0;
  group(K, [
    [W, H, L * 0.8, 0, H / 2, 0, CAB2],
    [W * 0.5, H * 0.5, L * 0.6, 0, H * 1.2, L * 0.05, CAB],
    [W * 0.8, H * 0.8, L * 0.3, 0, H * 0.45, -L * 0.48, CAB, { rx: 0.45 }],
    [W * 0.35, H * 0.9, L * 0.7, W * 0.62, H * 0.5, L * 0.05, CAB3],
    [W * 0.35, H * 0.9, L * 0.7, -W * 0.62, H * 0.5, L * 0.05, CAB3],
    [W * 0.9, H * 0.9, L * 0.12, 0, H * 0.55, L * 0.45, CAB3],
    [W * 0.25, H * 0.35, 0.3, W * 0.25, H * 0.55, L * 0.52, HAZ, { glow: 1.6 }],
    [W * 0.25, H * 0.35, 0.3, -W * 0.25, H * 0.55, L * 0.52, HAZ, { glow: 1.6 }],
    [W + 0.1, 0.3, L * 0.08, 0, H * 0.92, -L * 0.2, HAZ, { glow: 1 }],
    [W * 1.9, 0.5, L * 0.18, 0, H * 0.7, L * 0.22, CAB, { rz: 0 }],
  ], x, y, z, { rx: o.rx ?? 0, ry: o.ry ?? 0, rz: o.rz ?? 0 });
  if (o.collide) {
    // yawed hull: exact oriented footprint (U13a)
    K.ocollider(x, z, W * 1.6, y + H * 1.2, L * 0.84, o.ry ?? 0);
  }
}

// Cabal Thresher gunship: compact hull with drooping angular wings
function thresher(K, x, y, z, ry = 0, o = {}) {
  const L = o.L ?? 14;
  group(K, [
    [L * 0.3, L * 0.18, L, 0, 0, 0, CAB2],
    [L * 0.22, L * 0.14, L * 0.32, 0, -L * 0.02, -L * 0.6, CAB, { rx: 0.35 }],
    [L * 0.6, L * 0.05, L * 0.5, L * 0.42, -L * 0.06, L * 0.1, CAB3, { rz: -0.35 }],
    [L * 0.6, L * 0.05, L * 0.5, -L * 0.42, -L * 0.06, L * 0.1, CAB3, { rz: 0.35 }],
    [L * 0.05, L * 0.22, L * 0.25, 0, L * 0.15, L * 0.38, CAB],
    [L * 0.2, L * 0.08, 0.3, 0, 0, L * 0.51, HAZ, { glow: 2 }],
    [L * 0.1, L * 0.05, 0.3, 0, -L * 0.05, -L * 0.76, HAZR, { glow: 2 }],
  ], x, y, z, { ry, rx: o.rx ?? 0, rz: o.rz ?? 0 });
}

// fallen Golden Age statue, robed figure lying on its back. head = 'n' | 's' | 'e' | 'w'. S = scale
function fallenStatue(K, x, z, head, S = 1) {
  const ry = { n: 0, w: Math.PI / 2, s: Math.PI, e: -Math.PI / 2 }[head];
  group(K, [
    [3.4 * S, 2.2 * S, 10 * S, 0, 1.1 * S, 0, STONE],
    [4.4 * S, 1.8 * S, 2.6 * S, 0, 1.0 * S, -5.4 * S, STONE],
    [2.0 * S, 2.0 * S, 2.3 * S, 0, 1.1 * S, -7.6 * S, STONE, { rx: 0.15 }],
    [2.6 * S, 0.6 * S, 2.4 * S, 0, 2.0 * S, -7.8 * S, STONE2, { rx: 0.2 }],
    [1.0 * S, 1.0 * S, 4.6 * S, 2.6 * S, 0.5 * S, -2.8 * S, STONE2, { ry: 0.25 }],
    [1.0 * S, 1.0 * S, 3.6 * S, -2.4 * S, 1.6 * S, -3.0 * S, STONE2, { ry: -0.2, rz: 0.4 }],
    [3.8 * S, 1.6 * S, 1.4 * S, 0, 0.8 * S, 5.2 * S, STONE2],
  ], x, 0, z, { ry });
  // body + head as two tight boxes, rotated with the heading
  const along = head === 'n' || head === 's', sg = head === 'n' || head === 'w' ? -1 : 1;
  const box = (a0, a1, hw, h) => {
    const lo = Math.min(a0 * sg, a1 * sg), hi = Math.max(a0 * sg, a1 * sg);
    if (along) K.collider(x - hw, 0, z + lo, x + hw, h, z + hi, null);
    else K.collider(x + lo, 0, z - hw, x + hi, h, z + hw, null);
  };
  box(-5.9 * S, 6.5 * S, 2.0 * S, 2.2 * S);
  box(6.5 * S, 8.9 * S, 1.2 * S, 2.3 * S);
}

// colossal standing Golden Age statue: plinth, robed body, hooded head, hands folded over a sword
function colossus(K, x, z, S = 1, o = {}) {
  const collide = o.collide ?? true, y = o.y ?? 0, face = o.face ?? 0;
  K.box(x, z, 9 * S, 3 * S, 9 * S, STONE2, { y, collide });
  K.mesh(new THREE.CylinderGeometry(2.4 * S, 3.8 * S, 15 * S, 4), STONE, x, y + 3 * S + 7.5 * S, z, { ry: Math.PI / 4 + face, collide: collide ? 0.7 : false });
  K.mesh(new THREE.CylinderGeometry(1.6 * S, 2.4 * S, 2.6 * S, 4), STONE2, x, y + 19.3 * S, z, { ry: Math.PI / 4 + face });
  K.mesh(new THREE.ConeGeometry(1.7 * S, 2.6 * S, 4), STONE, x, y + 21.5 * S, z, { ry: Math.PI / 4 + face });
  vbox(K, x + Math.sin(face) * 2.6 * S, y + 11 * S, z + Math.cos(face) * 2.6 * S, 0.6 * S, 12 * S, 0.5 * S, STONE2, { ry: face });
  vbox(K, x + Math.sin(face) * 2.9 * S, y + 15 * S, z + Math.cos(face) * 2.9 * S, 3.6 * S, 1.2 * S, 1.2 * S, STONE, { ry: face });
}

function traveler(K, x, y, z, r) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 3), new THREE.MeshBasicMaterial({ color: 0xe9e6dd, fog: false }));
  m.position.set(x, y, z);
  K.scene.add(m);
}

// tall rock column / cliff piece
function cliff(K, x, z, r, h, o = {}) {
  return K.cyl(x, z, r, h, o.color ?? K.RP([K.C.rock, K.C.rock2]), { r2: r * (o.taper ?? 0.72), sides: 7, y: o.y, collide: o.collide });
}

// The Red War siege berms: [cx, cz, length, yaw]. Plain data shared by the terrain list and the parapets built on top.
const BERMS = [
  [-45, -84, 38, 0], [6, -84, 36, 0], [51, -84, 26, 0],
  [-30, -100, 44, 0.15], [28, -102, 40, -0.15],
  [-50, -116, 28, 0], [-5, -116, 38, 0], [45, -116, 38, 0],
  [-24, -132, 32, -0.12], [36, -132, 34, 0.12],
];

// parapet along a berm: short oriented slabs with a sloped armour plate in front; every third slot is left open as a crossing
function berm(K, cx, cz, len, ry) {
  const c = Math.cos(ry), s = -Math.sin(ry), nx = Math.sin(ry), nz = Math.cos(ry);
  let k = 0;
  for (let t = -len / 2 + 3; t < len / 2 - 2; t += 7.5, k++) {
    if (k % 3 === 2) continue;
    const x = cx + c * t, z = cz + s * t;
    K.obox(x, z, 6.2, 1.5, 1.1, ry, CAB3);
    vbox(K, x + nx * 0.85, 0.9, z + nz * 0.85, 6, 1.9, 0.3, k % 2 ? CAB : CAB2, { ry, rx: -0.35 });
  }
}

/** U17b: the helpers and tones the Mars patrol zone (js/patrol-mars.js) builds with. */
export const MARS_KIT = {
  vbox, group, bulwark, pylon, dropPod, landingPad, turret, mast, bunker, supply, tower, dune, harvester, thresher, fallenStatue, colossus, cliff, berm,
  C: { CAB, CAB2, CAB3, DECK, DECK2, HAZ, HAZR, BANNER, GA, GLASS, STONE, STONE2, PAVE },
};

export default {
  // -------------------------------------------------------------------------
  // The Buried City (U16e High Ground). Rhythm:
  //   Barrens (open dunes, Cabal beachhead)  ->  climb to a mesa causeway (traversal) ->  Scablands (gully floor below,
  //   outposts on the mesas above: combat during traversal)  ->  Buried City (street fight under a podium and a fallen tower,
  //   a roofed lobby)  ->  the avenue climbs to a terrace and the Sunken Plaza is entered from above by a wide stair.
  // Elevation 0 to 6 m.
  // -------------------------------------------------------------------------
  r1: {
    spawn: [0, 18],
    bounds: [-75, 75, -285, 30],
    zones: [
      { name: 'The Barrens', x: -12, z: -44 },
      { name: 'The Scablands', x: 0, z: -112 },
      { name: 'The Buried City', x: 0, z: -172 },
      { name: 'The Sunken Plaza', x: 0, z: -245, boss: true, room: { minX: -28, maxX: 28, minZ: -273, maxZ: -217 } },
    ],
    noEdge: true,
    terrain: [
      // Barrens: low rolling dunes, the middle stays open
      { type: 'mound', x: -44, z: -6, r: 16, h: 2.4 },
      { type: 'mound', x: 56, z: 12, r: 15, h: 2.0 },
      { type: 'mound', x: -56, z: -70, r: 18, h: 2.8 },
      { type: 'mound', x: 10, z: 2, r: 12, h: 1.4 },
      // the Cabal forward base on the eastern dunes, reached by a long ramp, then a raised causeway along the mesa tops
      { type: 'ramp', x0: 36, z0: -12, x1: 36, z1: -40, width: 8, h0: 0, h1: 4.8 },
      { type: 'plateau', x: 36, z: -52, w: 26, d: 26, h: 4.8, edge: 3 },
      { type: 'ramp', x0: 36, z0: -62, x1: 36, z1: -92, width: 8, h0: 4.8, h1: 4.6, edge: 3 },
      // Scablands: two mesas with a gully at ground level between them
      { type: 'plateau', x: 34, z: -114, w: 42, d: 44, h: 4.6, edge: 2.5 },
      { type: 'plateau', x: -38, z: -116, w: 44, d: 36, h: 3.4, edge: 2.5 },
      { type: 'ramp', x0: -38, z0: -76, x1: -38, z1: -98, width: 7, h0: 0, h1: 3.4 },
      // down from the mesas into the city: the east mesa to the cross street, the west mesa to the podium
      { type: 'ramp', x0: 40, z0: -134, x1: 40, z1: -158, width: 8, h0: 4.6, h1: 0 },
      { type: 'ramp', x0: -38, z0: -132, x1: -39, z1: -156, width: 7, h0: 3.4, h1: 6 },
      // the podium (a collapsed tower's foundation) and the long ramp up to it from the street
      { type: 'plateau', x: -48, z: -178, w: 30, d: 44, h: 6, edge: 3 },
      { type: 'ramp', x0: -6, z0: -176, x1: -34, z1: -176, width: 7, h0: 0, h1: 6 },
      // the avenue climbs to the plaza's gate terrace; the plaza floor stays at 0, so the gate stair goes down
      { type: 'ramp', x0: 0, z0: -186, x1: 0, z1: -208, width: 16, h0: 0, h1: 4.2 },
      { type: 'plateau', x: 0, z: -212, w: 20, d: 8, h: 4.2, edge: 1.5 },
      { type: 'ramp', x0: 0, z0: -216, x1: 0, z1: -232, width: 14, h0: 4.2, h1: 0, edge: 3 }, // inside the gate the floor drops to the plaza (a ramp: stairs this tall are walls to the nav grid)
    ],
    sky: {
      // butterscotch noon: a white-gold sun, thin dust cloud, the buried towers standing on the horizon
      zenith: 0x8a6a62, mid: 0xd9a070, horizon: 0xe8bf88,
      bodies: [{ color: 0xfff0c8, size: 22, pos: [300, 150, -470], glow: 0xffe0a0 }, { color: 0xd8c8b0, size: 9, pos: [-320, 210, -400] }],
      clouds: { n: 9, color: 0xeccba2, opacity: 0.5, y: [110, 200], size: 30 },
      skyline: [{ kind: 'tower', n: 14, r: [440, 620], h: [50, 160], w: [12, 24], color: 0x9a6a50, haze: 0.5 }, { kind: 'block', n: 8, r: [480, 620], h: [20, 60], w: [20, 40], color: 0x8a5a40, haze: 0.55 }],
    },
    build(K) {
      const { R, C } = K;

      // ---- The Barrens: wide red dunes, one long broken Cabal fortification, a drop pod beachhead ----
      for (const [x, z, w, d, h] of [[-30, -90, 10, 7, 1.7], [-58, 14, 10, 7, 2], [24, -22, 9, 6, 1.5]]) dune(K, x, z, w, d, h);
      // the beachhead: a line of four pods that came in along the approach toward the western ridge
      for (const [x, z] of [[8, -12], [-6, -19], [-21, -26], [-36, -33]]) dropPod(K, x, z);
      // one long fortification with two gaps
      bulwark(K, -58, -56, 20, -56, 3.4, { t: 1.8, gaps: [[20, 31], [50, 60]], rib: 10 });
      dropPod(K, 2, -62, { tilt: 0.3 });
      // the Cabal defensive line on the western ridge, with pylons
      bulwark(K, -62, -8, -62, -100, 8, { t: 3.2, face: 1 });
      for (const z of [-20, -54, -88]) pylon(K, -62, z, 12, { w: 4.5 });
      supply(K, -18, -31); supply(K, 0, -44, true); supply(K, -22, -50); supply(K, 14, -47);
      K.light(-12, 4, -28, HAZ, 6, 22);
      // forward base on the high dunes: the first sight line of the mission
      bunker(K, 40, -60, 9, 8, 4.5, { door: 1 });
      turret(K, 28, -44, Math.PI * 0.8);
      mast(K, 46, -46, 16);
      supply(K, 30, -58); supply(K, 44, -48, true);
      vbox(K, 36, 0.12, -40.4, 8, 0.05, 0.6, HAZ, { glow: 1.4 });
      K.light(36, 5, -48, HAZ, 7, 24);
      // first Golden Age tower poking out of the sand
      tower(K, 62, -30, 9, 9, 30, { lean: 0.22, axis: 'x', sink: 10 });
      tower(K, -66, -50, 8, 10, 22, { lean: -0.35, axis: 'z', sink: 8, crown: 'crane' });

      // ---- The Scablands: two mesas and the gully between them ----
      // east mesa: the Cabal outpost
      bunker(K, 46, -124, 8, 10, 4.5, { door: 1 });
      landingPad(K, 28, -126, 10);
      turret(K, 17, -100, Math.PI * 0.95);
      turret(K, 16, -128, Math.PI * 0.9);
      mast(K, 50, -98, 15);
      supply(K, 30, -100); supply(K, 40, -112, true); supply(K, 24, -116);
      vbox(K, 15.4, 0.1, -113, 0.3, 0.1, 40, HAZ, { glow: 1.1 });
      K.light(30, 6, -118, HAZ, 8, 26); K.light(46, 6, -100, HAZ, 7, 22);
      cliff(K, 54, -132, 4, 7, { taper: 0.85 }); cliff(K, 52, -92, 3.5, 5, { taper: 0.85 });
      // west mesa: broken rock and a sniper nest looking down into the gully
      bulwark(K, -20, -128, -20, -106, 3, { t: 1.6, face: 1 });
      turret(K, -26, -122, 0);
      supply(K, -34, -112); supply(K, -44, -124, true);
      K.scatter((x, z) => K.rock(x, z, R(1.4, 3.2)), -40, -116, 4, 14, 8, 3);
      cliff(K, -54, -104, 5, 8, { taper: 0.85 }); cliff(K, -50, -130, 4, 6, { taper: 0.85 }); cliff(K, -24, -102, 3, 4, { taper: 0.85 });
      K.light(-30, 6, -112, HAZ, 7, 24);
      // gully floor: rock cover and a barricade across the mouth
      K.scatter((x, z) => K.rock(x, z, R(1.2, 2.8)), 0, -112, 3, 12, 9, 2.6);
      K.scatter(K.prop, 0, -112, 7, 16, 3, 4);
      bulwark(K, -8, -98, 8, -98, 2.6, { t: 1.4, gaps: [[6, 10]] });
      supply(K, -4, -104); supply(K, 4, -121, true);
      K.light(0, 5, -110, HAZ, 7, 22);

      // ---- The Buried City: crossroads between leaning towers, a podium to the west, a roofed lobby to the east ----
      tower(K, 17, -154, 10, 9, 44, { lean: -0.07, axis: 'x', sink: 6, crown: 'slope' });
      tower(K, -17, -190, 9, 11, 34, { lean: 0.16, axis: 'x', sink: 6 });
      tower(K, 18, -190, 11, 10, 32, { lean: 0.25, axis: 'z', sink: 5 }); // leans out over the avenue
      tower(K, 56, -172, 10, 12, 46, { lean: 0.14, axis: 'z', sink: 8 });
      tower(K, 62, -140, 9, 9, 30, { lean: -0.3, axis: 'x', sink: 4 });
      // the toppled tower: it came down across the west street and rests against the podium, flanking the long ramp up
      tower(K, -8, -164, 8, 9, 30, { lean: 1.46, axis: 'z', sink: 1, colH: 20 });
      // the podium: a Cabal sniper nest on the collapsed foundation, with sight lines down both streets
      tower(K, -36, -198, 10, 9, 38, { lean: -0.1, axis: 'x', sink: 6 });
      tower(K, -60, -190, 9, 10, 30, { lean: -0.2, axis: 'z', sink: 6, crown: 'crane' });
      bunker(K, -54, -196, 9, 7, 4, { door: 1 });
      bulwark(K, -62, -158, -36, -158, 2.4, { t: 1.4 });
      turret(K, -38, -170, 0, { s: 1.15 });
      supply(K, -46, -172); supply(K, -52, -182, true);
      K.light(-46, 4, -176, HAZ, 8, 26);
      // street-level Cabal presence and rubble
      bulwark(K, -10, -144, 2, -144, 2.4, { t: 1.4 });
      bulwark(K, 22, -170, 22, -182, 2.4, { t: 1.4, face: -1 });
      dropPod(K, 6, -183); dropPod(K, -7, -160);
      supply(K, -9, -182, true); supply(K, 9, -164); supply(K, 28, -178, true);
      // a broken floor slab on the east side of the cross street as a firing position
      K.platform(32, -170, 8, 12, 2.8, { stairs: ['w'], color: GA[2], stairColor: GA[0] });
      for (const [x, z] of [[-10, -160], [10, -184], [-3, -196], [6, -148]]) K.light(x, 6, z, HAZ, 7, 24);
      for (const [x, z, w, h, d] of [[-6, -150, 2.4, 1.6, 3], [10, -186, 3, 1.2, 2], [26, -164, 2.6, 1.4, 2], [4, -198, 3, 1.8, 2.2], [-4, -207, 2.2, 1.4, 3]]) K.box(x, z, w, h, d, K.RP(GA));
      // the avenue narrows between two towers as it starts to climb
      tower(K, -17, -208, 10, 9, 36, { lean: 0.12, axis: 'z', sink: 6 });
      tower(K, 17, -209, 10, 9, 30, { lean: -0.1, axis: 'z', sink: 5 });
      // optional roofed interior: the lobby of a buried tower, two doors (the avenue side and the cross street)
      K.room(31, -203, 14, 18, 6.4, { t: 0.7, color: GA[1], roofColor: GA[0], roof: true, doors: { w: 5, n: 5 } });
      vbox(K, 31, 0.08, -203, 13, 0.16, 17, PAVE);
      K.box(31, -208, 7, 1.2, 1.4, STONE2); // reception desk
      for (const x of [26.5, 35.5]) K.cyl(x, -198, 0.6, 5.8, STONE, { sides: 6 });
      for (const z of [-199, -207]) vbox(K, 31, 5.9, z, 13, 0.25, 0.4, HAZ, { glow: 1.2 });
      vbox(K, 37.7, 3.4, -203, 0.15, 2.2, 10, GLASS);
      supply(K, 35, -198, true);
      K.light(31, 5.2, -203, HAZ, 8, 18);

      // ---- Boss: the Sunken Plaza. Entered from above: a ramp drops 4 m from the gate onto a paved square ----
      const cz = -245;
      vbox(K, 0, 0.09, cz, 54, 0.18, 54, PAVE);
      K.mesh(new THREE.CylinderGeometry(7, 7, 0.22, 12), 0x9a876f, 0, 0.11, cz);
      K.mesh(new THREE.TorusGeometry(7, 0.35, 4, 16).rotateX(Math.PI / 2), STONE2, 0, 0.25, cz);
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1]]) vbox(K, dx * 17, 0.2, cz + dz * 17, dx ? 18 : 1.2, 0.05, dz ? 18 : 1.2, 0x8d7a62);
      // closed arena: a stepped retaining wall ring (low terrace, then a tall stone face) with one gate on the avenue
      // side; the gate opens when the Buried City is cleared
      for (const [off, t, h, col, hw] of [[29.8, 3.6, 3.2, 0xb8a68d, 7], [31.8, 2.4, 12, 0xa8967c, 7.2]]) {
        K.wall(-off, cz + off, off, cz + off, h, { t, color: col, gaps: [[off - hw, off + hw]] });
        K.wall(-off, cz - off, off, cz - off, h, { t, color: col });
        K.wall(-off, cz - off, -off, cz + off, h, { t, color: col });
        K.wall(off, cz - off, off, cz + off, h, { t, color: col });
      }
      K.door(0, cz + 30.8, 14, 12, 'x', { zone: 2, t: 5, color: STONE2, trim: HAZ });
      vbox(K, 0, 2.2, -224, 13.4, 0.2, 16.4, PAVE, { rx: -0.2565 }); // paving on the ramp down from the gate
      for (const sx of [-1, 1]) vbox(K, sx * 6.8, 2.5, -224, 0.3, 0.3, 16.4, HAZ, { glow: 1.1, rx: -0.2565 });
      for (const sx of [-1, 1]) {
        K.box(sx * 9, cz + 30.8, 2.4, 15, 5.4, STONE2);
        vbox(K, sx * 9, 15.5, cz + 30.8, 3, 1, 6, STONE, { rz: sx * 0.1 });
        vbox(K, sx * 7.7, 7, cz + 28.1, 0.2, 10, 0.2, HAZ, { glow: 1.8 });
      }
      // gun balconies inside the wall, reached by stairs
      K.platform(24, cz - 16, 5, 14, 2.8, { stairs: ['w'], color: STONE2, stairColor: STONE });
      K.platform(-24, cz - 16, 5, 14, 2.8, { stairs: ['e'], color: STONE2, stairColor: STONE });
      for (const [x, z] of [[-24, 24], [24, 24], [24, -26], [0, -26]]) {
        K.cyl(x, cz + z, 0.7, 4.2, CAB3, { sides: 6 });
        vbox(K, x, 4.6, cz + z, 1.2, 0.6, 1.2, HAZ, { glow: 2 });
        K.light(x, 5.6, cz + z, HAZ, 8, 24);
      }
      // broken colonnade and a fallen column
      for (const [x, z, h] of [[-13, cz + 13, 4.2], [13, cz - 13, 5]]) {
        K.cyl(x, z, 1.3, h, STONE, { sides: 8 });
        vbox(K, x, h + 0.25, z, 3, 0.5, 3, STONE2, { rz: 0.1 });
      }
      K.box(-19, cz - 2, 2.2, 2.2, 9, STONE);
      K.box(19, cz + 3, 7, 1.8, 2.4, STONE2);
      // Valus's Cabal camp in the plaza, banner line off axis
      dropPod(K, 17, cz - 8); dropPod(K, -9, cz - 19);
      supply(K, 8, cz - 18, true); supply(K, -20, cz + 15); supply(K, 21, cz + 16, true);
      for (const x of [-9, 3]) {
        K.box(x, cz - 24, 0.4, 7, 0.4, CAB3);
        vbox(K, x, 4.8, cz - 23.7, 2, 4, 0.12, BANNER);
      }
      // ring of buried skyscrapers leaning in over the plaza
      tower(K, -46, cz, 10, 10, 44, { lean: -0.3, axis: 'z', sink: 8, colH: 14 });
      tower(K, 46, cz + 4, 10, 11, 40, { lean: 0.28, axis: 'z', sink: 8, colH: 14 });
      tower(K, -44, cz - 32, 10, 10, 38, { lean: 0.22, axis: 'x', sink: 6, colH: 14 });
      tower(K, 44, cz - 32, 9, 10, 46, { lean: 0.24, axis: 'z', sink: 10, colH: 14 });
      tower(K, -44, cz + 34, 9, 9, 34, { lean: -0.2, axis: 'z', sink: 6, colH: 14 });
      tower(K, 44, cz + 34, 9, 9, 36, { lean: 0.2, axis: 'z', sink: 6, colH: 14 });
      tower(K, 0, cz - 52, 14, 10, 50, { lean: 0.26, axis: 'x', sink: 10, collide: false });

      // ---- horizon: buried towers in the dunes, Cabal gunships overhead ----
      K.edge((x, z, y) => {
        if (K.chance(0.45)) tower(K, x, z, R(7, 12), R(7, 12), R(24, 50), { y, sink: R(4, 14), lean: R(-0.4, 0.4), axis: K.chance(0.5) ? 'x' : 'z', collide: false, bandStep: 6 });
        else K.rock(x, z, R(3, 8), { y, collide: false });
      }, 44, 8, 55);
      thresher(K, -40, 42, -110, 0.6);
      thresher(K, 55, 50, -215, -0.9);
      harvester(K, 90, 60, -60, { L: 22, ry: 1.4, rz: 0.08 });
    },
  },

  // -------------------------------------------------------------------------
  // Dust Palace (U16e High Ground). Rhythm:
  //   The Cleft: a long, narrow gorge walk (traversal, sight lines down it) -> a rock arch -> the basin around a downed Harvester (combat)
  //   -> a rubble ramp up to the breach in the Outer Bulwark: fight over the breach from the ledge while Cabal guns fire from the wall-walk
  //   -> down into the command courtyard (combat) -> a palace ramp up to Bracus Zahn's raised hangar (the new area).
  // Elevation 0 to 16 m (the gorge walls), the playable route climbs to 5.6 m.
  // -------------------------------------------------------------------------
  r2: {
    spawn: [-38, 18],
    bounds: [-65, 65, -268, 30],
    zones: [
      { name: 'The Cleft', x: -10, z: -62 },
      { name: 'The Outer Bulwark', x: 6, z: -116 },
      { name: 'Dust Palace Courtyard', x: 0, z: -162 },
      { name: 'The Throne Hangar', x: 0, z: -232, boss: true, room: { minX: -27, maxX: 27, minZ: -255, maxZ: -209 } },
    ],
    noEdge: true,
    terrain: [
      // the Cleft: the west wall angles in at the gorge mouth, both walls open out into the basin at z -36
      { type: 'plateau', x: -58, z: 24, w: 24, d: 40, h: 14, edge: 3 },
      { type: 'plateau', x: -44, z: -12, w: 24, d: 48, h: 16, edge: 3 },
      { type: 'plateau', x: 22, z: 24, w: 40, d: 40, h: 13, edge: 3 },
      { type: 'plateau', x: 2, z: -12, w: 24, d: 48, h: 16, edge: 3 },
      { type: 'plateau', x: -54, z: -64, w: 28, d: 56, h: 10, edge: 3, ry: 0.2 },
      { type: 'plateau', x: 34, z: -62, w: 24, d: 50, h: 10, edge: 3, ry: -0.2 },
      // the rubble ramp up to the breach ledge, the breach itself at 4 m, and the way back down inside the wall
      { type: 'ramp', x0: 6, z0: -72, x1: 6, z1: -95, width: 16, h0: 0, h1: 4, edge: 4 },
      { type: 'plateau', x: 6, z: -100, w: 16, d: 12, h: 4, edge: 1.5 },
      { type: 'ramp', x0: 6, z0: -106, x1: 6, z1: -128, width: 16, h0: 4, h1: 0, edge: 4 },
      // the palace ramp to the hangar floor (the hangar sits on a plateau, the room needs level ground)
      { type: 'ramp', x0: 0, z0: -180, x1: 0, z1: -206, width: 18, h0: 0, h1: 5.6, edge: 4 },
      { type: 'plateau', x: 0, z: -232, w: 56, d: 50, h: 5.6, edge: 2 },
    ],
    sky: {
      // red dusk: a huge low sun, Cabal drop ships working across the sky, the palace's own towers on the horizon
      zenith: 0x34203e, mid: 0xa4503c, horizon: 0xf29a58,
      stars: { n: 140, color: 0xffe8d0, size: 2, min: 0.55 },
      bodies: [{ color: 0xffb070, size: 44, pos: [-360, 34, -470], glow: 0xff7a30 }, { color: 0xb8a898, size: 7, pos: [330, 230, -380] }],
      ridges: [{ r: 640, h: [50, 130], color: 0x5a2c34, haze: 0.5, steps: 64 }, { r: 540, h: [20, 60], color: 0x45222c, haze: 0.3, steps: 84 }],
      skyline: [{ kind: 'spire', n: 7, r: [470, 620], h: [60, 150], w: [10, 18], color: 0x3a1c28, haze: 0.45 }],
      haze: [{ color: 0xf08a50, opacity: 0.55, r: 480, h: 90, y: -10 }],
      floaters: [{ kind: 'ship', n: 9, r: [380, 620], y: [50, 170], size: [14, 28], color: 0x2e1a20, haze: 0.3 }],
    },
    build(K) {
      const { R, C } = K;

      // ---- The Cleft: a gorge between two rock walls, an arch at its exit, a Harvester wreck in the basin ----
      for (const [x, z, r, h] of [[-42, -4, 5, 5], [-48, -26, 6, 7], [-52, 14, 6, 6], [4, -2, 5, 5], [2, -26, 6, 6], [18, 8, 5, 6], [-60, -58, 6, 5], [40, -66, 6, 5]]) cliff(K, x, z, r, h, { collide: false, taper: 0.8 });
      // natural arch over the gorge exit
      cliff(K, -30, -35, 3.4, 15, { taper: 0.85 });
      cliff(K, -12, -35, 3.4, 15, { taper: 0.85 });
      K.box(-21, -35, 22, 3, 5, C.rock2, { y: 12 });
      // boulders along the gorge floor
      for (const [x, z, s] of [[-28, 4, 2.2], [-14, -8, 2.6], [-24, -18, 1.8], [-16, -26, 2.2], [-27, 14, 2.4]]) K.rock(x, z, s);
      // the fight centre: a downed Cabal Harvester in the basin
      harvester(K, -12, -62, { L: 24, ry: 0.5, rz: 0.12, y: -0.8, collide: true });
      K.mesh(new THREE.CylinderGeometry(7, 7, 0.05, 10), 0x2f1d16, -12, 0.14, -62);
      for (const [x, y, z, s] of [[-12, 5, -62, 1.2], [-6, 3.5, -56, 0.9]]) {
        K.mesh(new THREE.ConeGeometry(0.9 * s, 2.4 * s, 5), HAZR, x, y, z, { glow: 2.2 });
        K.mesh(new THREE.ConeGeometry(0.5 * s, 1.6 * s, 5), HAZ, x + 0.3, y + 0.4, z, { glow: 2.4 });
      }
      // tipped rock slabs and wreckage in two clusters
      K.obox(-30, -52, 6, 2.4, 2, 0.5, C.rock2); K.obox(-27, -49, 3.4, 1.4, 4, -0.3, C.rock);
      K.obox(8, -70, 5, 2, 2.2, -0.6, C.rock2); K.obox(12, -66, 3, 1.6, 3, 0.2, C.rock);
      dropPod(K, -26, -70); dropPod(K, 14, -54);
      supply(K, -22, -72); supply(K, 2, -56, true);
      // Cabal forward picket, facing the gorge
      bulwark(K, -36, -88, -16, -88, 3.2, { t: 1.6 });
      turret(K, -2, -82, Math.PI * 0.7);
      K.light(-26, 4, -80, HAZ, 6, 22); K.light(-12, 5, -58, 0xff6a2a, 9, 24);

      // ---- The Outer Bulwark: one huge sloped wall across the valley, blown open; the breach is a 4 m ledge ----
      bulwark(K, -65, -100, 65, -100, 14, { t: 7, face: 1, rib: 10, gaps: [[63, 79]] });
      for (const x of [-48, -22, 30, 52]) pylon(K, x, -100, 20, { w: 6 });
      // breach rubble: torn armour plates and wall chunks on either side of the lane
      for (const [x, z, w, h, d] of [[-1, -90, 3, 2.4, 3], [15, -92, 2.6, 3, 3.4], [-1, -110, 3.4, 1.8, 2.6], [15, -112, 2.4, 2.2, 2.4]]) K.box(x, z, w, h, d, CAB2);
      for (const [x, z, ry, rz] of [[-3, -98, 0.4, 0.5], [16, -101, -0.6, -0.4]]) vbox(K, x, 4.8, z, 4, 0.5, 3, CAB, { ry, rz });
      // outside the wall: tank traps staggered in depth, two knocked over
      for (const [x, z, tip] of [[-30, -82, 0], [-17, -91, 0.9], [28, -96, 0], [-47, -97, 0], [50, -97, 1.1]]) {
        for (const r of [0, 1.05, 2.1]) vbox(K, x, 1, z, 3.2, 0.45, 0.45, CAB3, { ry: r, rz: 0.6 + tip });
        K.collider(x - 1, 0, z - 1, x + 1, 1.8, z + 1, null);
      }
      // the wall-walk: fire steps behind the wall (a 5 m deck each side, 5 m stair), Cabal guns fire from above
      K.platform(-34, -107, 44, 6, 5, { stairs: ['n'], stairW: 5, color: CAB2, stairColor: CAB3 });
      K.platform(38, -107, 40, 6, 5, { stairs: ['n'], stairW: 5, color: CAB2, stairColor: CAB3 });
      for (const [x, w] of [[-34, 44], [38, 40]]) vbox(K, x, 5.1, -104.1, w, 0.1, 0.2, HAZ, { glow: 1.4 });
      turret(K, -42, -107, Math.PI / 2, { y: 5 });
      turret(K, -24, -107, Math.PI / 2, { y: 5 });
      turret(K, 30, -107, Math.PI / 2, { y: 5 });
      // a knocked-out turret: one gun silenced
      K.box(46, -107, 2.2, 1.0, 2.2, CAB3, { y: 5 });
      vbox(K, 46.6, 6.5, -106.6, 3.2, 0.4, 0.4, CAB3, { rz: 0.5, ry: 0.6 });
      K.mesh(new THREE.ConeGeometry(0.8, 2.2, 5), HAZR, 46, 6.8, -107, { glow: 2.2 });
      // inside: the kill zone below the breach
      supply(K, -12, -120); supply(K, 24, -118, true); supply(K, -30, -118, true); supply(K, 44, -118);
      K.light(-34, 9, -107, HAZ, 8, 24); K.light(38, 9, -107, HAZ, 8, 24);
      K.light(6, 8, -104, HAZR, 8, 28);

      // ---- Dust Palace Courtyard: walled command post, a palace ramp to the hangar ----
      vbox(K, 0, 0.07, -170.2, 95.6, 0.14, 79.4, 0x5e5249);
      for (const x of [-30, 30]) vbox(K, x, 0.18, -170, 0.4, 0.05, 70, HAZ, { glow: 0.6 });
      bulwark(K, -48, -128, -48, -262, 10, { t: 5, face: 1, rib: 11 });
      bulwark(K, 48, -128, 48, -262, 10, { t: 5, face: -1, rib: 11 });
      bulwark(K, -48, -132, 48, -132, 8, { t: 4, face: 1, rib: 10, gaps: [[38, 58]] });
      for (const x of [-13, 13]) pylon(K, x, -132, 14, { w: 5 });
      // sealed inner gate: opens when the Outer Bulwark is cleared
      K.door(0, -132, 20, 8, 'x', { zone: 1, t: 4, color: CAB2, trim: HAZR });
      K.light(-14, 8, -126, HAZ, 8, 24); K.light(14, 8, -126, HAZ, 8, 24);
      landingPad(K, -26, -150, 14);
      landingPad(K, 28, -178, 14);
      harvester(K, 28, -178, { L: 18, collide: true, y: 0.6 });
      for (const [x, z] of [[24, -174], [32, -174], [24, -184], [32, -184]]) K.box(x, z, 0.6, 0.8, 0.6, CAB3, { collide: false });
      turret(K, -16, -170, Math.PI / 2);
      turret(K, 16, -146, Math.PI / 2);
      turret(K, 36, -142, Math.PI * 0.7);
      mast(K, -38, -142, 22); mast(K, -24, -204, 26);
      // a barricade across the middle with two gaps
      for (const [x, z, r] of [[-24, -156, 0], [-17, -157, 1], [-1, -156, 1], [5, -155, 0], [21, -157, 0], [28, -156, 1], [-36, -168, 1], [38, -166, 0]]) supply(K, x, z, !!r);
      bulwark(K, -8, -192, 2, -192, 1.8, { t: 1.2 });
      // the palace: two command towers and banners flank the ramp to the hangar
      pylon(K, -17, -190, 18, { w: 6 }); pylon(K, 17, -190, 18, { w: 6 });
      for (const z of [-186, -194, -202]) for (const sx of [-1, 1]) {
        K.box(sx * 11.5, z, 0.4, 7, 0.4, CAB3);
        vbox(K, sx * 11.5, 5, z + 0.25, 0.12, 4, 2, BANNER);
      }
      vbox(K, 0, 2.85, -193, 17.4, 0.2, 26.6, CAB3, { rx: 0.2121 }); // a deck on the ramp: palace paving
      for (const sx of [-1, 1]) vbox(K, sx * 8.9, 3.0, -193, 0.3, 0.3, 26.6, HAZ, { glow: 1.2, rx: 0.2121 });

      // ---- command wings: a roofed Operations Hall (west) and a sealed Comms Centre (east) ----
      // west hall: open doorway on the courtyard side, an inner sealed bay behind a partition door
      K.room(-35, -180, 19, 36, 10, { t: 0.8, color: CAB2, roofColor: CAB3, roof: true, doors: { e: 8 }, doorOffset: { e: 9 } });
      K.wall(-44.5, -180, -25.5, -180, 10, { t: 0.8, color: CAB, gaps: [[13, 19]] });
      K.door(-28.5, -180, 6, 10, 'x', { zone: 2, t: 0.8, color: CAB3, trim: HAZR });
      vbox(K, -35, 0.08, -180, 18, 0.16, 35, DECK);
      for (const z of [-170, -190]) for (const sx of [-1, 1]) {
        K.box(-35 + sx * 7, z, 3.4, 1.2, 1.6, CAB3);
        vbox(K, -35 + sx * 7, 1.35, z, 3, 0.08, 1.2, HAZ, { glow: 1.8 });
      }
      for (const z of [-166, -174, -186, -194]) vbox(K, -35, 9.4, z, 18, 0.3, 0.5, HAZ, { glow: 1.5 });
      supply(K, -41, -170); supply(K, -41, -187, true);
      for (const [x, z] of [[-35, -172], [-38, -190]]) K.light(x, 8, z, HAZ, 8, 22);
      vbox(K, -44.2, 5, -190, 0.2, 5, 10, BANNER);
      // east comms centre: sealed until the courtyard is cleared
      K.room(37.5, -200, 15, 18, 10, { t: 0.8, color: CAB2, roofColor: CAB3, roof: true, doors: { s: 6 } });
      K.door(37.5, -191, 6, 10, 'x', { zone: 2, t: 0.8, color: CAB3, trim: HAZR });
      vbox(K, 37.5, 0.08, -200, 14, 0.16, 17, DECK);
      for (const x of [33, 37.5, 42]) {
        K.box(x, -205, 3, 1.4, 1.4, CAB3);
        vbox(K, x, 1.55, -205, 2.6, 0.08, 1.1, HAZ, { glow: 2 });
        vbox(K, x, 3.2, -208.4, 2.4, 2.2, 0.15, 0x1a2a30, { glow: 0.6 });
      }
      K.light(37.5, 8, -200, HAZR, 8, 20); K.light(37.5, 8, -196, HAZ, 6, 16);
      mast(K, 52, -200, 18);

      // ---- Boss: Bracus Zahn's hangar, raised on a plateau. A dropship is parked on the floor, a gantry bridge crosses overhead,
      //      the east bay is open to the sky and a Cabal ship is docked outside it. ----
      const hz = -232;
      K.room(0, hz, 56, 48, 13, { t: 1.6, color: CAB2, roofColor: CAB3, roof: true, doors: { s: 16, e: 24 } });
      vbox(K, 0, 0.09, hz, 54, 0.18, 45.6, DECK);
      K.door(0, -208, 16, 13, 'x', { zone: 2, t: 1.6, color: CAB3, trim: HAZR });
      // exterior facade: buttresses either side of the blast door, lintel and Cabal sigil
      for (const sx of [-1, 1]) {
        K.box(sx * 11, -206.2, 4, 15, 3.6, CAB);
        vbox(K, sx * 11, 15.8, -205.6, 4.2, 1.2, 4.4, CAB3, { rx: 0.35 });
        vbox(K, sx * 11, 10, -204.3, 0.5, 6, 0.2, HAZ, { glow: 1.6 });
      }
      vbox(K, 0, 12.2, -207, 18, 1.4, 1.2, CAB);
      vbox(K, 0, 12.2, -206.3, 16, 0.3, 0.2, HAZ, { glow: 1.6 });
      K.mesh(new THREE.ConeGeometry(1.8, 2.6, 3), BANNER, 0, 14.6, -206.6, { rx: Math.PI, glow: 0.8 });
      // the east bay: an open dock door. The gap is sealed by an invisible barrier so the hall stays a closed arena.
      K.collider(27.2, 0, hz - 12, 28.8, 13, hz + 12, null);
      for (const dz of [-12.8, 12.8]) {
        K.box(28, hz + dz, 1.8, 13.4, 1.8, CAB);
        vbox(K, 27.1, 7, hz + dz * 0.985, 0.2, 9, 0.2, HAZ, { glow: 1.6 });
      }
      vbox(K, 28, 12.6, hz, 2.0, 1.4, 26, CAB3);
      vbox(K, 27.1, 12.1, hz, 0.3, 0.3, 24, HAZ, { glow: 1.6 });
      vbox(K, 37, 2.7, hz, 18, 5.4, 22, CAB3, { }); // the dock deck outside (visual)
      vbox(K, 37, 5.45, hz, 17, 0.1, 21, DECK2);
      harvester(K, 38, hz, { L: 26, ry: Math.PI / 2, y: 5.5 });
      // interior: wall ribs, hazard strips, overhead gantries, support pillars
      for (let z = hz - 18; z <= hz + 18; z += 9) K.box(-26.8, z, 1.2, 13, 1.2, CAB);
      for (const z of [hz - 18, hz + 18]) K.box(26.8, z, 1.2, 13, 1.2, CAB);
      vbox(K, -27.05, 9, hz, 0.3, 0.35, 46, HAZ, { glow: 1.4 });
      vbox(K, 0, 9, hz - 24.05, 54, 0.35, 0.3, HAZ, { glow: 1.4 });
      for (const z of [hz - 14, hz, hz + 14]) {
        vbox(K, 0, 11.6, z, 54, 0.8, 1.5, CAB3);
        for (const x of [-14, 0, 14]) vbox(K, x, 11.0, z, 1.4, 0.3, 0.6, HAZ, { glow: 2 });
      }
      for (const sx of [-1, 1]) K.box(sx * 13, hz - 6, 1.6, 13, 1.6, CAB);
      // floor markings: a parking ring and lane lines
      K.mesh(new THREE.TorusGeometry(11, 0.25, 4, 28).rotateX(Math.PI / 2), HAZ, 0, 0.24, hz + 3, { glow: 0.9 });
      for (const x of [-20, 20]) vbox(K, x, 0.2, hz, 0.4, 0.05, 44, HAZ, { glow: 0.6 });
      // the parked dropship
      harvester(K, 0, hz + 3, { L: 22, ry: Math.PI / 2, collide: true, y: 0.2 });
      // its boarding gantry: a climbable wing deck on the east side
      K.platform(14, hz + 3, 6, 12, 2.4, { stairs: ['e'], stairW: 3, color: CAB, stairColor: CAB3 });
      vbox(K, 11.05, 2.5, hz + 3, 0.1, 0.15, 12, HAZ, { glow: 1.6 });
      // the overhead gantry: a 5 m high bridge across the hall with stairs at both ends
      K.box(0, hz + 15, 46, 0.7, 3.4, CAB3, { y: 4.3 });
      for (const sx of [-1, 1]) {
        K.box(sx * 23.6, hz + 15, 1.2, 4.3, 3.4, CAB);
        K.stairs(sx * 22, hz + 22.9, 'n', 3, 5, { color: CAB3 });
        vbox(K, sx * 11.5, 5.2, hz + 13.4, 22, 0.1, 0.15, HAZ, { glow: 1.6 });
      }
      // cranes and a fuel gantry
      vbox(K, -8, 9.4, hz - 2, 2.4, 2.2, 2, CAB3); vbox(K, -8, 11.3, hz - 2, 0.15, 3, 0.15, CAB2);
      vbox(K, 10, 9.4, hz + 8, 2.4, 2.2, 2, CAB3); vbox(K, 10, 11.3, hz + 8, 0.15, 3, 0.15, CAB2);
      for (const z of [hz - 14, hz - 9, hz - 4]) K.cyl(23, z, 1.4, 4.4, CAB3, { sides: 8 });
      vbox(K, 23, 4.7, hz - 9, 2.4, 0.3, 14, CAB2);
      // raised command platform and Bracus's throne
      K.platform(0, hz - 19, 22, 8, 2.8, { stairs: ['s'], color: CAB, stairColor: CAB3, stairW: 6 });
      vbox(K, 0, 2.85, hz - 14.9, 22, 0.06, 0.5, HAZ, { glow: 1.4 });
      K.box(0, hz - 21.5, 3.2, 2.6, 2.2, CAB3, { y: 2.8 });
      K.box(0, hz - 22.7, 5, 7, 0.8, CAB2, { y: 2.8 });
      vbox(K, 0, 9.2, hz - 22.25, 3.2, 0.4, 0.15, HAZR, { glow: 2 });
      K.box(-7, hz - 18, 2.6, 1.1, 1.6, CAB3, { y: 2.8 });
      vbox(K, -7, 4.0, hz - 18, 2.2, 0.08, 1.2, HAZ, { glow: 1.8 });
      for (const sx of [-1, 1]) vbox(K, sx * 7, 7.5, hz - 23.1, 2.6, 6.5, 0.12, BANNER);
      // one side gun balcony only (west), asymmetric by design
      K.platform(-23.5, hz - 8, 5, 16, 2.8, { stairs: ['s'], color: CAB, stairColor: CAB3, stairW: 3 });
      vbox(K, -21.05, 2.9, hz - 8, 0.1, 0.15, 16, HAZ, { glow: 1.6 });
      // hangar floor clutter: cargo stacks and a parked tank
      supply(K, -14, hz + 12); supply(K, 20, hz + 18, true); supply(K, -20, hz - 6, true); supply(K, 18, hz - 14);
      K.box(-19, hz + 18, 5, 2.2, 7, CAB2);
      K.box(-19, hz + 17.4, 3, 1.4, 3.4, CAB, { y: 2.2 });
      vbox(K, -19, 2.9, hz + 13.4, 0.5, 0.5, 4, CAB3);
      K.light(-16, 10, hz + 12, HAZ, 10, 26);
      K.light(16, 10, hz + 12, HAZ, 10, 26);
      K.light(-16, 10, hz - 12, HAZ, 10, 26);
      K.light(16, 10, hz - 12, HAZ, 10, 26);
      K.light(0, 7, hz - 18, HAZR, 9, 18);
      K.light(0, 9, -203, HAZ, 9, 22);
      K.light(-22, 9, hz - 2, HAZ, 8, 22);
      K.light(24, 6, hz, 0xffb070, 9, 24);
      K.light(0, 9, hz + 4, HAZ, 8, 22);
      K.light(0, 9, hz - 20, HAZR, 8, 20);

      // ---- horizon: mesas, more Cabal walls and a carrier over the palace ----
      K.edge((x, z, y) => {
        if (K.chance(0.25)) pylon(K, x, z, R(16, 26), { w: R(5, 8), y, collide: false });
        else cliff(K, x, z, R(5, 10), R(8, 22), { y, collide: false, taper: 0.8 });
      }, 60, 6, 50);
      harvester(K, -30, 48, -200, { L: 30, ry: 0.4 });
      thresher(K, 40, 36, -120, -2.2);
      thresher(K, -50, 40, -60, 2.5);
    },
  },

  // -------------------------------------------------------------------------
  // The Red War (U16e High Ground). Rhythm:
  //   Valley of Kings (the statue walk; colossi on stepped plinths are sniper perches)  ->  Siege Trenches: four raised berms to climb
  //   over and fight across (combat during traversal)  ->  Cabal Drop Zone (crashed Harvesters, a walkable hull)  ->  the Boarding
  //   Ramp: a long true climb up to the flagship hull (traversal with fire from the prows)  ->  Ghaul's flagship deck, entered
  //   from above, level with the hull's top.
  // Elevation 0 to 5.6 m on the route, canyon walls to 20 m.
  // -------------------------------------------------------------------------
  r3: {
    spawn: [0, 18],
    bounds: [-70, 70, -360, 30],
    zones: [
      { name: 'Valley of Kings', x: 0, z: -42 },
      { name: 'Siege Trenches', x: -18, z: -108 },
      { name: 'Cabal Drop Zone', x: 18, z: -172 },
      { name: 'The Boarding Ramp', x: 0, z: -232 },
      { name: "Ghaul's Flagship", x: 0, z: -306, boss: true, room: { minX: -56, maxX: 56, minZ: -348, maxZ: -266 } },
    ],
    noEdge: true,
    terrain: [
      // Valley of Kings: continuous canyon masses with a side alcove, the floor stays open
      { type: 'plateau', x: -64, z: 16, w: 26, d: 40, h: 16, edge: 3 },
      { type: 'plateau', x: -66, z: -38, w: 24, d: 46, h: 20, edge: 3 },
      { type: 'plateau', x: 62, z: 12, w: 24, d: 40, h: 18, edge: 3 },
      { type: 'plateau', x: 66, z: -48, w: 20, d: 50, h: 15, edge: 3 },
      // Siege Trenches: four lines of raised berms (2.8 m), broken by ground-level crossings; two lines are shorter and angled
      ...BERMS.map(([x, z, w, ry]) => ({ type: 'plateau', x, z, w, d: 5, h: 2.8, edge: 9, ry })),
      // mortar pits between the lines: a raised rim round each
      { type: 'basin', x: -34, z: -108, r: 5, flat: 0.5, depth: 0, rim: 0.9, rimW: 3.5 },
      { type: 'basin', x: 28, z: -108, r: 5, flat: 0.5, depth: 0, rim: 0.9, rimW: 3.5 },
      // the drop zone's impact crater rim
      { type: 'basin', x: 14, z: -176, r: 9, flat: 0.5, depth: 0, rim: 1.1, rimW: 4 },
      // the Boarding Ramp: a long causeway from the drop zone up to the hull gate, then the flagship deck at the same height
      { type: 'ramp', x0: 0, z0: -204, x1: 0, z1: -258, width: 34, h0: 0, h1: 5.6, edge: 6 },
      { type: 'plateau', x: 0, z: -264, w: 34, d: 12, h: 5.6, edge: 3 },
      { type: 'plateau', x: 0, z: -307, w: 116, d: 86, h: 5.6, edge: 3 },
    ],
    sky: {
      // storm: black-red cloud deck, a red glow low in the storm, Cabal ships working the sky, Ghaul's flagship overhead
      zenith: 0x160c10, mid: 0x4a2824, horizon: 0xa8462c,
      bodies: [],
      aurora: [{ color: 0xff5a30, y: 150, r: 540, h: 170, arc: [0, 6.28], opacity: 0.2, waves: 5 }],
      haze: [{ color: 0xc06a40, opacity: 0.7, r: 470, h: 160, y: -10 }],
      clouds: { n: 20, color: 0x3a1e1c, opacity: 0.9, y: [60, 170], size: 28 },
      floaters: [{ kind: 'ship', n: 1, r: [440, 460], y: [190, 210], size: [100, 100], color: 0x1c1010, haze: 0.2 }, { kind: 'ship', n: 10, r: [360, 640], y: [60, 200], size: [14, 30], color: 0x2c1c1a, haze: 0.3 }],
    },
    build(K) {
      const { R, C } = K;

      // ---- Valley of Kings: canyon walls, colossi on stepped plinths, fallen statues ----
      for (const [x, z, r, h] of [[-58, 6, 5, 6], [-62, 28, 6, 7], [-60, -30, 5, 6], [-62, -50, 5, 8], [56, 2, 5, 6], [58, 24, 6, 7], [60, -34, 5, 7], [62, -60, 5, 6]]) cliff(K, x, z, r, h, { collide: false, taper: 0.85 });
      // alcove boulders at the foot of the canyon
      for (const [x, z, s] of [[-50, -9, 2.4], [-52, 26, 2.8], [52, -14, 2.6], [50, 30, 2.2]]) K.rock(x, z, s);
      // the colossi stand on two stepped tiers (2.4 m each, a stair up each): a sniper perch under their feet
      K.platform(-44, -60, 22, 22, 2.4, { stairs: ['e'], stairW: 5, color: STONE2, stairColor: STONE });
      K.platform(-44, -60, 15, 15, 2.4, { y: 2.4, stairs: ['e'], stairW: 3, color: STONE, stairColor: STONE2 });
      colossus(K, -44, -60, 1.1, { face: Math.PI / 2, y: 4.8 });
      K.platform(44, -26, 22, 22, 2.4, { stairs: ['w'], stairW: 5, color: STONE2, stairColor: STONE });
      K.platform(44, -26, 15, 15, 2.4, { y: 2.4, stairs: ['w'], stairW: 3, color: STONE, stairColor: STONE2 });
      colossus(K, 44, -26, 1.1, { face: -Math.PI / 2, y: 4.8 });
      fallenStatue(K, -15, -30, 'n', 1.1);
      fallenStatue(K, 26, -62, 'e', 0.9);
      // a colossal head half in the sand
      K.mesh(new THREE.BoxGeometry(6, 6.5, 6), STONE, 15, 2.6, -48, { ry: 0.5, rz: 0.35 });
      K.mesh(new THREE.ConeGeometry(4.6, 4, 4), STONE2, 15.6, 6.4, -48.4, { ry: 0.5 + Math.PI / 4, rz: 0.35 });
      K.collider(12.3, 0, -50.7, 17.7, 5.4, -45.3, null);
      // broken legs on a plinth
      K.box(-20, -8, 9, 2, 6, STONE2);
      for (const sx of [-1, 1]) K.box(-20 + sx * 2.2, -8, 2.4, 8 + sx, 3, STONE, { y: 2 });
      vbox(K, -20, 12, -8, 6.5, 2.2, 3.4, STONE, { rz: 0.12 });
      K.scatter((x, z) => K.rock(x, z, R(1.2, 2.6)), 0, -42, 8, 20, 6, 2.5);
      dropPod(K, 8, -28); dropPod(K, -6, -58);

      // ---- Siege trenches: four lines of raised berms with parapets, a command bunker, mortar pits ----
      for (const [x, z, w, ry] of BERMS) berm(K, x, z, w, ry);
      bunker(K, 2, -108, 8, 7, 4, { door: 1 });
      mast(K, 8, -112, 14);
      for (const [x, z] of [[-34, -108], [28, -108]]) {
        K.cyl(x, z, 1.0, 1.3, CAB3, { sides: 8 });
        vbox(K, x, 2.0, z + 0.4, 0.7, 2.6, 0.7, CAB2, { rx: -0.6 });
        vbox(K, x, 0.7, z - 1.6, 1.4, 0.5, 1.0, HAZ, { glow: 1.2 });
      }
      dropPod(K, -19, -84, { tilt: 0.3 }); // landed on the line and broke it
      for (const [x, z] of [[-40, -92], [14, -92], [-56, -124], [-28, -124], [44, -124], [4, -124], [34, -108]]) {
        for (const r of [0, 1.05, 2.1]) vbox(K, x, 1, z, 3.2, 0.45, 0.45, CAB3, { ry: r, rz: 0.6 });
        K.collider(x - 1, 0, z - 1, x + 1, 1.8, z + 1, null);
      }
      for (const [x, z, r] of [[-34, -108, 4], [22, -108, 3.5], [-50, -124, 3.5], [48, -92, 4]]) K.mesh(new THREE.CylinderGeometry(r, r * 0.7, 0.06, 9), 0x2f1d16, x, 0.13, z);
      K.light(-20, 5, -108, HAZ, 7, 24); K.light(24, 5, -108, HAZ, 7, 24);
      turret(K, -24, -132, -Math.PI / 2);
      turret(K, 38, -132, -Math.PI / 2 - 0.3);
      // a burned-out Cabal tank
      K.box(-48, -108, 5, 2.2, 7, CAB3);
      vbox(K, -47, 3.0, -107, 3, 1.4, 3.4, CAB2, { ry: 0.5, rz: 0.2 });

      // ---- Cabal drop zone: a crashed Harvester with a walkable hull, a downed Thresher, a trail of pods ----
      harvester(K, -28, -166, { L: 30, rz: 0.05, y: -2.6 });
      K.platform(-28, -166, 9, 22, 3.8, { stairs: ['s'], stairW: 3, color: CAB2, stairColor: CAB3 }); // the hull plating: climb the stern
      K.ocollider(-28, -164.5, 5.1, 2.4, 18, 0, 3.8); // the cabin on top
      vbox(K, -28, 3.9, -177.1, 8.6, 0.12, 0.2, HAZ, { glow: 1.4 });
      harvester(K, 40, -204, { L: 24, ry: Math.PI / 2, rz: 0.14, y: -1, collide: true });
      thresher(K, 54, 2, -158, 0.3, { L: 13, rz: 0.4, rx: 0.15 });
      K.collider(48, 0, -164, 60, 3.5, -152, null);
      K.platform(55, -148, 9, 6, 2.0, { stairs: ['w'], stairW: 2.4, color: CAB2, stairColor: CAB3 }); // a wing-height ledge
      // the debris trail from the impact
      for (const [x, z] of [[-6, -163], [6, -168], [20, -163], [29, -182], [41, -186]]) dropPod(K, x, z);
      for (const [x, y, z, s] of [[-28, 6.5, -158, 1.4], [-24, 4.5, -176, 1], [38, 5, -204, 1.2], [54, 3.5, -158, 1]]) {
        K.mesh(new THREE.ConeGeometry(0.9 * s, 2.4 * s, 5), HAZR, x, y, z, { glow: 2.2 });
        K.mesh(new THREE.ConeGeometry(0.5 * s, 1.6 * s, 5), HAZ, x + 0.3, y + 0.4, z, { glow: 2.4 });
      }
      for (const [x, z, r] of [[8, -158, 4], [-6, -190, 4], [44, -186, 3.5]]) K.mesh(new THREE.CylinderGeometry(r, r * 0.7, 0.06, 9), 0x2f1d16, x, 0.13, z);
      supply(K, 22, -156); supply(K, 0, -176, true); supply(K, 12, -194);
      // wreck-top gun deck with stairs
      K.platform(-50, -200, 12, 12, 2.8, { stairs: ['e'], color: CAB2, stairColor: CAB3 });
      K.light(-50, 6, -200, 0xff6a2a, 8, 24);
      K.light(-28, 9, -158, 0xff6a2a, 10, 26);
      K.light(46, 6, -176, 0xff6a2a, 9, 24);

      // ---- The Boarding Ramp: the flagship's hull wall with its ramp lowered; a 5.6 m climb ----
      bulwark(K, -70, -262, 70, -262, 18, { t: 6, face: 1, rib: 12, color: DECK2, color2: DECK, gaps: [[61, 79]] });
      K.box(0, -262, 20, 5, 6, DECK, { y: 13 });
      // blast door in the ramp gap: opens when the Boarding Ramp is cleared
      K.door(0, -262, 18, 13, 'x', { zone: 3, t: 6, color: DECK, trim: HAZR });
      vbox(K, 0, 12.6, -258.8, 18, 0.5, 0.3, HAZ, { glow: 1.6 });
      // the ramp's deck, in tilted sections that follow the climb, with lit rails
      const rtilt = Math.atan2(5.6, 54);
      for (let k = 0; k < 9; k++) {
        const zc = -207 - k * 6;
        vbox(K, 0, 0.1, zc, 30, 0.2, 6, DECK, { rx: rtilt });
        for (const sx of [-1, 1]) {
          vbox(K, sx * 15.8, 0.6, zc, 0.4, 0.9, 6, CAB3, { rx: rtilt });
          vbox(K, sx * 15.8, 1.15, zc, 0.5, 0.2, 0.5, HAZ, { glow: 2, rx: rtilt });
        }
        if (k % 2 === 0) vbox(K, 0, 0.27, zc, 12, 0.05, 0.8, HAZ, { glow: 0.9, rx: rtilt });
      }
      for (const sx of [-1, 1]) K.mesh(new THREE.CylinderGeometry(0.9, 0.9, 3, 8), CAB3, sx * 6, 0.9, -258.6, { rz: Math.PI / 2 });
      // forward hull prows either side of the ramp
      for (const sx of [-1, 1]) {
        K.box(sx * 44, -246, 22, 10, 22, DECK2);
        vbox(K, sx * 44, 11.4, -244, 20, 0.8, 24, DECK, { rx: 0.25 });
        vbox(K, sx * 32.85, 5, -246, 0.2, 0.4, 20, HAZR, { glow: 1.6 });
        turret(K, sx * 44, -250, Math.PI / 2, { s: 1.8, y: 10, collide: false });
      }
      supply(K, -26, -218); supply(K, 27, -222, true); supply(K, -30, -240, true); supply(K, 31, -238);
      K.platform(-30, -226, 10, 14, 2.8, { stairs: ['n'], color: DECK2, stairColor: DECK });
      K.platform(30, -226, 10, 14, 2.8, { stairs: ['n'], color: DECK2, stairColor: DECK });
      for (const [x, z] of [[-24, -224], [24, -224], [-20, -244], [20, -244]]) K.light(x, 6, z, HAZ, 7, 24);
      K.light(0, 10, -257, HAZ, 10, 24);

      // ---- Boss: the deck of Ghaul's flagship under the Traveler. One big circular dais, command dais at the stern ----
      const dz = -306;
      vbox(K, 0, 0.1, dz, 114, 0.2, 83.4, DECK);
      K.mesh(new THREE.CylinderGeometry(26, 26, 0.16, 32), DECK2, 0, 0.22, dz);
      K.mesh(new THREE.TorusGeometry(26, 0.4, 4, 40).rotateX(Math.PI / 2), HAZR, 0, 0.34, dz, { glow: 1.1 });
      K.mesh(new THREE.TorusGeometry(14, 0.25, 4, 32).rotateX(Math.PI / 2), HAZR, 0, 0.34, dz, { glow: 0.9 });
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; vbox(K, Math.cos(a) * 20, 0.32, dz + Math.sin(a) * 20, 12, 0.05, 0.3, HAZR, { ry: -a, glow: 0.8 }); }
      // the flagship's inner hull closes the deck: side bulkheads and a stern wall (the ramp door is the only way in)
      bulwark(K, -58, -262, -58, -350, 16, { t: 2.4, face: 1, rib: 12, color: DECK2, color2: DECK });
      bulwark(K, 58, -262, 58, -350, 16, { t: 2.4, face: -1, rib: 12, color: DECK2, color2: DECK });
      bulwark(K, -58, -350, 58, -350, 16, { t: 2.4, face: 1, rib: 12, color: DECK2, color2: DECK });
      // gun gantries along the bulkheads, reached by stairs
      K.platform(-50, -296, 8, 24, 2.8, { stairs: ['s'], color: DECK2, stairColor: DECK, stairW: 3 });
      K.platform(50, -318, 8, 22, 2.8, { stairs: ['s'], color: DECK2, stairColor: DECK, stairW: 3 });
      for (const [x, z, L] of [[-46, -296, 24], [46, -318, 22]]) vbox(K, x, 2.9, z, 0.1, 0.15, L, HAZR, { glow: 1.8 });
      for (const [x, z] of [[-48, -280], [48, -290], [-48, -330], [48, -336], [-24, -345], [24, -345], [0, -272]]) K.light(x, 9, z, HAZR, 8, 28);
      // angular superstructure along both rails (the two sides differ) and the bridge tower at the stern
      for (const [sx, rows] of [[-1, [[-278, 20, 14], [-304, 22, 24], [-330, 20, 16], [-352, 14, 28]]], [1, [[-272, 16, 10], [-298, 26, 20], [-324, 14, 30], [-350, 18, 18]]]]) {
        for (const [z, d, h] of rows) {
          const x = sx * 62;
          K.box(x, z, 12, h, d, DECK2);
          K.box(x + sx * 2, z, 8, h * 0.3, d * 0.7, DECK, { y: h });
          vbox(K, x - sx * 4.2, h * 0.95, z, 6, 0.8, d - 0.3, DECK, { rz: sx * 0.6 });
          vbox(K, x - sx * 6.05, h * 0.6, z, 0.15, 0.4, d * 0.8, HAZR, { glow: 1.6 });
        }
      }
      turret(K, -36, -334, Math.PI / 2, { s: 1.6 });
      turret(K, 40, -338, Math.PI / 2, { s: 1.4 });
      K.box(0, -354, 48, 14, 10, DECK2);
      K.box(0, -356, 30, 10, 6, DECK, { y: 14 });
      K.box(0, -357, 16, 8, 4, DECK2, { y: 24 });
      vbox(K, 0, 26, -354.9, 14, 1, 0.2, HAZR, { glow: 2 });
      vbox(K, 0, 9, -348.9, 40, 0.5, 0.2, HAZ, { glow: 1.4 });
      vbox(K, 0, 15, -351, 48, 1, 6, DECK, { rx: -0.5 });
      // Ghaul's command dais and console, near the arena rather than on the far tower
      K.platform(-6, -332, 24, 10, 2.8, { stairs: ['s'], stairW: 5, color: DECK2, stairColor: DECK });
      vbox(K, -6, 2.85, -327.05, 24, 0.06, 0.4, HAZR, { glow: 1.6 });
      K.box(-6, -335, 7, 1.4, 2.4, DECK, { y: 2.8 });
      vbox(K, -6, 4.6, -336.2, 6, 1.6, 0.2, HAZR, { glow: 1.1, rx: -0.3 });
      K.box(-14, -334, 2, 3.2, 2, DECK, { y: 2.8 }); K.box(2, -334, 2, 3.2, 2, DECK, { y: 2.8 });
      // deck cover: a few hatches and two clusters of armour plates
      for (const [x, z] of [[-18, -288], [20, -296], [-27, -314], [12, -326]]) {
        K.box(x, z, 3.2, 1.3, 3.2, DECK2);
        vbox(K, x, 1.35, z, 2.4, 0.06, 2.4, HAZR, { glow: 1.2 });
      }
      for (const [x, z, w, d] of [[-34, -286, 7, 0.8], [-37, -283, 0.8, 5], [-30, -283, 5, 0.8], [30, -322, 0.8, 7], [33, -318, 5, 0.8], [33, -326, 5, 0.8]]) K.box(x, z, w, 2, d, CAB2);
      supply(K, -40, -284); supply(K, 42, -300, true); supply(K, -44, -322, true);
      K.light(0, 12, dz, HAZR, 9, 40);
      K.light(-40, 8, -300, HAZ, 8, 26);
      K.light(40, 8, -322, HAZ, 8, 26);
      traveler(K, -70, 170, -720, 80);

      // ---- horizon: storm-lashed cliffs and wrecks; dark hull plating around the flagship ----
      K.edge((x, z, y) => {
        if (z < -262) {
          const h = R(10, 30);
          vbox(K, x, y + h / 2, z, R(8, 16), h, R(8, 16), K.RP([DECK, DECK2]));
          if (K.chance(0.4)) vbox(K, x, y + h * 0.7, z, 0.4, 0.4, R(4, 8), HAZR, { glow: 1.6 });
        } else if (K.chance(0.12)) harvester(K, x, z, { L: R(18, 26), y: y - 1, ry: R(0, 6), rz: R(-0.3, 0.3) });
        else cliff(K, x, z, R(5, 10), R(10, 24), { y, collide: false, taper: 0.7 });
      }, 70, 6, 50);
      thresher(K, 30, 34, -200, 2.6);
      thresher(K, -36, 46, -280, 0.4, { L: 18 });
    },
  },
};
