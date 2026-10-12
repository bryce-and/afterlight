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
    B(mid, 0, L, h * 0.3, t, col, 0);
    B(mid, -face * t * 0.15, L, h * 0.4, t * 0.68, col2, h * 0.3);
    B(mid, -face * t * 0.27, L, h * 0.3, t * 0.4, col, h * 0.7);
    V(mid, (zf + zc) / 2, h * 0.65, L, plen, 0.45, col, horiz ? { rx: -face * ang } : { rz: face * ang });
    V(mid, -face * t * 0.07 + face * 0.1, h * 0.88, L, 0.3, 0.2, HAZ, { glow: 1.3 });
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
    // only axis-aligned headings (ry 0 / PI along z, PI/2 along x) get colliders
    const alongX = Math.abs(Math.sin(o.ry ?? 0)) > 0.5;
    const hw = (alongX ? L * 0.42 : W * 0.8), hd = (alongX ? W * 0.8 : L * 0.42);
    K.collider(x - hw, 0, z - hd, x + hw, y + H * 1.2, z + hd, null);
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

export default {
  // -------------------------------------------------------------------------
  // The Buried City: open dunes -> rocky outposts -> street canyons between leaning
  // Clovis Bray towers -> a sunken plaza ringed by buried skyscrapers.
  // -------------------------------------------------------------------------
  r1: {
    spawn: [0, 18],
    bounds: [-75, 75, -285, 30],
    zones: [
      { name: 'The Barrens', x: -12, z: -45 },
      { name: 'The Scablands', x: 24, z: -108 },
      { name: 'The Buried City', x: 0, z: -172 },
      { name: 'The Sunken Plaza', x: 0, z: -245, boss: true },
    ],
    noEdge: true,
    build(K) {
      const { R, C } = K;

      // ---- The Barrens: wide red dunes, Cabal barrier lines, a drop pod field ----
      dropPod(K, -13, 9); dropPod(K, 15, 3); dropPod(K, 26, 16);
      for (const [x, z, w, d, h] of [[34, -18, 13, 9, 2.0], [-42, -8, 12, 9, 2.4], [-46, -72, 15, 10, 2.6], [44, -58, 12, 10, 2.1], [-30, -90, 10, 7, 1.7], [56, 10, 10, 8, 1.8], [-58, 14, 10, 7, 2]]) dune(K, x, z, w, d, h);
      // staggered Cabal barrier walls across the dunes
      bulwark(K, -44, -24, -26, -24, 3.4, { t: 1.8 });
      bulwark(K, -2, -24, 16, -24, 3.4, { t: 1.8 });
      bulwark(K, -36, -63, -22, -63, 3.0, { t: 1.6 });
      bulwark(K, -4, -63, 10, -63, 3.0, { t: 1.6 });
      // the Cabal defensive line on the western ridge, with pylons
      bulwark(K, -60, -8, -60, -100, 8, { t: 3.2, face: 1 });
      for (const z of [-20, -54, -88]) pylon(K, -60, z, 12, { w: 4.5 });
      for (const [x, z] of [[-25, -38], [2, -53], [-29, -54], [6, -37], [-9, -66]]) dropPod(K, x, z);
      supply(K, -18, -31); supply(K, 0, -44, true); supply(K, -22, -48);
      // first Golden Age towers poking out of the sand
      tower(K, 54, -34, 9, 9, 30, { lean: 0.22, axis: 'x', sink: 10 });
      tower(K, 46, -78, 8, 10, 22, { lean: -0.35, axis: 'z', sink: 8 });

      // ---- The Scablands: broken rock, mesas, a Cabal outpost ----
      for (const [x, z, r, h] of [[-10, -116, 5, 4], [-32, -100, 6, 6], [-48, -128, 7, 9], [58, -92, 6, 7], [62, -132, 5, 5], [-58, -150, 6, 8]]) cliff(K, x, z, r, h, { taper: 0.85 });
      K.scatter((x, z) => K.rock(x, z, R(1.3, 3)), 24, -108, 8, 21, 11, 2.6);
      K.scatter((x, z) => K.rock(x, z, R(2, 4)), -20, -110, 4, 14, 5, 3);
      K.scatter(K.prop, 24, -108, 24, 40, 5, 5);
      bunker(K, 47, -112, 8, 10, 4.5, { door: -1 });
      landingPad(K, 8, -124, 10);
      turret(K, 38, -94, Math.PI * 0.75);
      turret(K, 30, -126, Math.PI * 0.6);
      mast(K, 52, -128, 15);
      bulwark(K, 12, -90, 28, -90, 3, { t: 1.6 });
      supply(K, 20, -100); supply(K, 34, -115, true); supply(K, 12, -112);

      // ---- The Buried City: crossroads between leaning towers ----
      // corner blocks around the crossroads (avenue x -12..12, cross street z -160..-184)
      tower(K, -17, -155, 10, 10, 40, { lean: 0.1, axis: 'x', sink: 6 });
      tower(K, 17, -154, 10, 9, 44, { lean: -0.07, axis: 'x', sink: 6 });
      tower(K, -17, -190, 9, 11, 34, { lean: 0.16, axis: 'x', sink: 6 });
      tower(K, 18, -190, 11, 10, 32, { lean: 0.25, axis: 'z', sink: 5 }); // leans out over the avenue
      // outer blocks
      tower(K, -34, -146, 10, 10, 36, { lean: -0.12, axis: 'z', sink: 8 });
      tower(K, 36, -146, 9, 9, 30, { lean: 0.18, axis: 'z', sink: 4 });
      tower(K, -36, -198, 10, 9, 38, { lean: -0.1, axis: 'x', sink: 6 });
      tower(K, 36, -200, 10, 10, 42, { lean: 0.08, axis: 'x', sink: 8 });
      tower(K, 56, -172, 10, 12, 46, { lean: 0.14, axis: 'z', sink: 8 });
      tower(K, -60, -190, 9, 10, 30, { lean: -0.2, axis: 'z', sink: 6 });
      tower(K, 56, -140, 9, 9, 26, { lean: -0.3, axis: 'x', sink: 4 });
      tower(K, -36, -126, 9, 9, 24, { lean: 0.28, axis: 'x', sink: 6 });
      // a toppled tower leaning right across the west cross street (walk underneath)
      tower(K, -50, -172, 8, 9, 42, { lean: -0.95, axis: 'z', sink: 5, colH: 20 });
      // street-level Cabal presence and rubble
      bulwark(K, -10, -144, 2, -144, 2.4, { t: 1.4 });
      bulwark(K, 22, -170, 22, -182, 2.4, { t: 1.4, face: -1 });
      dropPod(K, 6, -183); dropPod(K, -7, -160);
      supply(K, -9, -178, true); supply(K, 9, -164); supply(K, -26, -168); supply(K, 28, -176, true);
      for (const [x, z, w, h, d] of [[-6, -150, 2.4, 1.6, 3], [10, -186, 3, 1.2, 2], [-24, -180, 2, 2.2, 2.4], [26, -164, 2.6, 1.4, 2], [4, -198, 3, 1.8, 2.2], [-4, -207, 2.2, 1.4, 3]]) K.box(x, z, w, h, d, K.RP(GA));
      // the avenue narrows between two towers into the plaza
      tower(K, -17, -208, 10, 9, 36, { lean: 0.12, axis: 'z', sink: 6 });
      tower(K, 17, -209, 10, 9, 30, { lean: -0.1, axis: 'z', sink: 5 });

      // ---- Boss: the Sunken Plaza. Stepped terraces ring a paved square, buried towers lean in ----
      const cz = -245;
      vbox(K, 0, 0.09, cz, 54, 0.18, 54, PAVE);
      K.mesh(new THREE.CylinderGeometry(7, 7, 0.22, 12), 0x9a876f, 0, 0.11, cz);
      K.mesh(new THREE.TorusGeometry(7, 0.35, 4, 16).rotateX(Math.PI / 2), STONE2, 0, 0.25, cz);
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1]]) vbox(K, dx * 17, 0.2, cz + dz * 17, dx ? 18 : 1.2, 0.05, dz ? 18 : 1.2, 0x8d7a62);
      for (let k = 0; k < 3; k++) {
        const off = 28.5 + 3 * k, h = 1.2 * (k + 1), col = [0xb8a68d, 0xa8967c, 0x9a8a72][k];
        K.wall(-off, cz + off, off, cz + off, h, { t: 3, color: col, gaps: [[off - 7, off + 7]] });
        K.wall(-off, cz - off, off, cz - off, h, { t: 3, color: col });
        K.wall(-off, cz - off, -off, cz + off, h, { t: 3, color: col });
        K.wall(off, cz - off, off, cz + off, h, { t: 3, color: col });
      }
      // broken colonnade and a fallen column
      for (const [x, z, h] of [[-13, cz + 13, 4.2], [13, cz + 13, 2.6], [-13, cz - 13, 3], [13, cz - 13, 5]]) {
        K.cyl(x, z, 1.3, h, STONE, { sides: 8 });
        vbox(K, x, h + 0.25, z, 3, 0.5, 3, STONE2, { rz: 0.1 });
      }
      K.box(-19, cz - 2, 2.2, 2.2, 9, STONE);
      K.box(19, cz + 3, 7, 1.8, 2.4, STONE2);
      // Valus's Cabal camp in the plaza
      dropPod(K, 17, cz - 8); dropPod(K, -9, cz - 19);
      supply(K, 8, cz - 18, true); supply(K, -20, cz + 15); supply(K, 21, cz + 16, true);
      for (const x of [-6, 6]) {
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
  // Dust Palace: gorge approach -> breach in the huge outer bulwark -> Cabal command
  // courtyard (pads, turrets, masts) -> Bracus Zahn's roofed hangar throne hall.
  // -------------------------------------------------------------------------
  r2: {
    spawn: [-38, 18],
    bounds: [-65, 65, -268, 30],
    zones: [
      { name: 'The Scablands', x: -32, z: -42 },
      { name: 'The Outer Bulwark', x: 6, z: -100 },
      { name: 'Dust Palace Courtyard', x: 0, z: -162 },
      { name: 'The Throne Hangar', x: 0, z: -232, boss: true },
    ],
    noEdge: true,
    build(K) {
      const { R, C } = K;

      // ---- Scablands gorge: cliffs west, rock plateau east, opening into a basin ----
      for (let z = 26; z > -86; z -= 8) cliff(K, -59 + R(-2, 2), z, R(5, 7), R(10, 18));
      for (let z = 28; z > -12; z -= 8) cliff(K, -12 + R(-2, 2), z, R(4.5, 6), R(9, 15));
      for (let x = 4; x < 62; x += 13) for (let z = 26; z > -58; z -= 13) {
        if (K.chance(0.85)) cliff(K, x + R(-3, 3), z + R(-3, 3), R(6, 8.5), R(7, 16));
      }
      K.scatter((x, z) => K.rock(x, z, R(1.3, 3.2)), -32, -42, 8, 20, 10, 2.6);
      for (const [x, z] of [[-45, -30], [-40, -60]]) K.prop(x, z);
      // Cabal forward picket
      bulwark(K, -46, -24, -34, -24, 3.2, { t: 1.6 });
      turret(K, -18, -32, Math.PI * 0.7);
      dropPod(K, -26, -52); dropPod(K, -44, -46);
      supply(K, -36, -34); supply(K, -24, -40, true);
      for (const [x, z, s] of [[-14, -74, 2.5], [-4, -66, 3], [26, -70, 3.5], [-48, -84, 3]]) K.rock(x, z, s);

      // ---- The Outer Bulwark: one huge sloped wall across the valley, blown open ----
      bulwark(K, -65, -100, 65, -100, 14, { t: 7, face: 1, rib: 10, gaps: [[63, 79]] });
      for (const x of [-48, -22, 30, 52]) pylon(K, x, -100, 20, { w: 6 });
      // breach rubble: torn armour plates and wall chunks
      for (const [x, z, w, h, d] of [[-6, -94, 3, 2.4, 3], [17, -95, 2.6, 3, 3.4], [-4, -108, 3.4, 1.8, 2.6], [15, -107, 2.4, 2.2, 2.4]]) K.box(x, z, w, h, d, CAB2);
      for (const [x, z, ry, rz] of [[-3, -98, 0.4, 0.5], [16, -101, -0.6, -0.4], [2, -91, 1.2, 0.3], [11, -110, -0.2, 0.6]]) vbox(K, x, 1.2, z, 4, 0.5, 3, CAB, { ry, rz });
      K.mesh(new THREE.CylinderGeometry(9, 9, 0.05, 10), 0x34201a, 6, 0.13, -96);
      // outside the wall: tank traps and craters
      for (const [x, z] of [[-30, -84], [-12, -88], [24, -86], [40, -82], [-46, -90], [54, -88]]) {
        for (const r of [0, 1.05, 2.1]) vbox(K, x, 1, z, 3.2, 0.45, 0.45, CAB3, { ry: r, rz: 0.6 });
        K.collider(x - 1, 0, z - 1, x + 1, 1.8, z + 1, null);
      }
      // inside: kill zone covered by turrets
      turret(K, -22, -122, -Math.PI / 2 + 0.4);
      turret(K, 30, -120, -Math.PI / 2 - 0.4);
      supply(K, -8, -116); supply(K, 20, -118, true); supply(K, -30, -110, true); supply(K, 40, -112);

      // ---- Dust Palace Courtyard: walled command post ----
      vbox(K, 0, 0.08, -170, 96, 0.16, 80, 0x5e5249);
      for (const x of [-30, 30]) vbox(K, x, 0.18, -170, 0.4, 0.05, 70, HAZ, { glow: 0.6 });
      bulwark(K, -48, -128, -48, -262, 10, { t: 5, face: 1, rib: 11 });
      bulwark(K, 48, -128, 48, -262, 10, { t: 5, face: -1, rib: 11 });
      bulwark(K, -48, -132, 48, -132, 8, { t: 4, face: 1, rib: 10, gaps: [[38, 58]] });
      for (const x of [-13, 13]) pylon(K, x, -132, 14, { w: 5 });
      landingPad(K, -26, -150, 14);
      landingPad(K, 28, -178, 14);
      harvester(K, 28, -178, { L: 18, collide: true, y: 0.6 });
      for (const [x, z] of [[24, -174], [32, -174], [24, -184], [32, -184]]) K.box(x, z, 0.6, 0.8, 0.6, CAB3, { collide: false });
      turret(K, -16, -176, Math.PI / 2);
      turret(K, 16, -146, Math.PI / 2);
      turret(K, -36, -190, Math.PI * 0.35);
      turret(K, 36, -142, Math.PI * 0.7);
      mast(K, -38, -142, 22); mast(K, 40, -198, 18); mast(K, -24, -202, 26);
      bunker(K, -36, -168, 8, 12, 5, { door: 1 });
      for (const [x, z, r] of [[-8, -150, 0], [10, -168, 1], [-12, -172, 1], [6, -181, 0], [14, -156, 0], [-26, -186, 0], [20, -194, 1]]) supply(K, x, z, !!r);
      bulwark(K, -8, -191, 2, -191, 1.8, { t: 1.2 });
      bulwark(K, -26, -158, -26, -164, 1.8, { t: 1.2, face: 1 });

      // ---- Boss: the roofed hangar / throne hall ----
      const hz = -232;
      K.room(0, hz, 56, 48, 13, { t: 1.6, color: CAB2, roofColor: CAB3, roof: true, doors: { s: 16 } });
      vbox(K, 0, 0.09, hz, 54, 0.18, 46, DECK);
      // exterior facade: buttresses either side of the blast door, lintel and Cabal sigil
      for (const sx of [-1, 1]) {
        K.box(sx * 11, -206.2, 4, 15, 3.6, CAB);
        vbox(K, sx * 11, 15.8, -205.6, 4.2, 1.2, 4.4, CAB3, { rx: 0.35 });
        vbox(K, sx * 11, 10, -204.3, 0.5, 6, 0.2, HAZ, { glow: 1.6 });
      }
      vbox(K, 0, 12.2, -207, 18, 1.4, 1.2, CAB);
      vbox(K, 0, 12.2, -206.3, 16, 0.3, 0.2, HAZ, { glow: 1.6 });
      K.mesh(new THREE.ConeGeometry(1.8, 2.6, 3), BANNER, 0, 14.6, -206.6, { rx: Math.PI, glow: 0.8 });
      for (const x of [-20, -8, 8, 20]) vbox(K, x, 13.9, hz + R(-10, 10), 4, 1.2, 4, CAB2);
      // interior: wall ribs, hazard strips, overhead gantries, support pillars
      for (let z = hz - 18; z <= hz + 18; z += 9) for (const sx of [-1, 1]) K.box(sx * 26.8, z, 1.2, 13, 1.2, CAB);
      for (const sx of [-1, 1]) vbox(K, sx * 27.05, 9, hz, 0.3, 0.35, 46, HAZ, { glow: 1.4 });
      vbox(K, 0, 9, hz - 24.05, 54, 0.35, 0.3, HAZ, { glow: 1.4 });
      for (const z of [hz - 14, hz, hz + 14]) {
        vbox(K, 0, 11.6, z, 54, 0.8, 1.2, CAB3);
        for (const x of [-14, 0, 14]) vbox(K, x, 11.0, z, 1.4, 0.3, 0.6, HAZ, { glow: 2 });
      }
      for (const sx of [-1, 1]) K.box(sx * 13, hz - 6, 1.6, 13, 1.6, CAB);
      // raised command platform and Bracus's throne
      K.platform(0, hz - 19, 22, 8, 2.8, { stairs: ['s'], color: CAB, stairColor: CAB3, stairW: 6 });
      vbox(K, 0, 2.85, hz - 14.9, 22, 0.06, 0.5, HAZ, { glow: 1.4 });
      K.box(0, hz - 21.5, 3.2, 2.6, 2.2, CAB3, { y: 2.8 });
      K.box(0, hz - 22.7, 5, 7, 0.8, CAB2, { y: 2.8 });
      vbox(K, 0, 9.2, hz - 22.25, 3.2, 0.4, 0.15, HAZR, { glow: 2 });
      K.box(-7, hz - 18, 2.6, 1.1, 1.6, CAB3, { y: 2.8 });
      vbox(K, -7, 4.0, hz - 18, 2.2, 0.08, 1.2, HAZ, { glow: 1.8 });
      for (const sx of [-1, 1]) vbox(K, sx * 7, 7.5, hz - 23.1, 2.6, 6.5, 0.12, BANNER);
      // hangar floor clutter: cargo stacks and a parked tank
      supply(K, -14, hz + 10); supply(K, 14, hz + 10, true); supply(K, -20, hz - 6, true); supply(K, 21, hz - 4);
      K.box(-19, hz + 18, 5, 2.2, 7, CAB2);
      K.box(-19, hz + 17.4, 3, 1.4, 3.4, CAB, { y: 2.2 });
      vbox(K, -19, 2.9, hz + 13.4, 0.5, 0.5, 4, CAB3);
      K.light(-16, 10, hz + 12, HAZ, 10, 26);
      K.light(16, 10, hz + 12, HAZ, 10, 26);
      K.light(-16, 10, hz - 12, HAZ, 10, 26);
      K.light(16, 10, hz - 12, HAZ, 10, 26);
      K.light(0, 7, hz - 18, HAZR, 9, 18);
      K.light(0, 9, -203, HAZ, 9, 22);

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
  // The Red War: Valley of Kings -> siege trenches -> crashed-ship drop zone ->
  // the flagship's boarding ramp -> Dominus Ghaul on his flagship deck under the Traveler.
  // -------------------------------------------------------------------------
  r3: {
    spawn: [0, 18],
    bounds: [-70, 70, -360, 30],
    zones: [
      { name: 'Valley of Kings', x: 0, z: -42 },
      { name: 'Siege Trenches', x: -18, z: -108 },
      { name: 'Cabal Drop Zone', x: 18, z: -172 },
      { name: 'The Boarding Ramp', x: 0, z: -232 },
      { name: "Ghaul's Flagship", x: 0, z: -306, boss: true },
    ],
    noEdge: true,
    build(K) {
      const { R, C } = K;

      // ---- Valley of Kings: canyon walls, colossi and fallen statues ----
      for (let z = 26; z > -78; z -= 9) for (const sx of [-1, 1]) {
        if (sx === -1 && z < -48 && z > -72) continue; // left colossus stands here
        if (sx === 1 && z < -14 && z > -38) continue;  // right colossus stands here
        cliff(K, sx * (38 + R(0, 5)), z + R(-2, 2), R(5, 7), R(14, 22));
      }
      colossus(K, -44, -60, 1.1, { face: Math.PI / 2 });
      colossus(K, 44, -26, 1.1, { face: -Math.PI / 2 });
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

      // ---- Siege trenches: four Cabal trench lines with staggered gaps ----
      const lines = [
        [-86, [[-30, -23], [5, 12], [40, 47]]],
        [-98, [[-50, -43], [-12, -5], [22, 29]]],
        [-114, [[-30, -23], [0, 7], [35, 42]]],
        [-126, [[-45, -38], [-15, -8], [15, 22]]],
      ];
      for (const [z, gx] of lines) {
        const gaps = gx.map(([a, b]) => [a + 70, b + 70]);
        K.wall(-70, z, 70, z, 1.6, { t: 1.4, color: CAB3, gaps });
        for (const [a, b] of runs(140, gaps)) {
          for (let s = a + 2; s < b - 1.5; s += 5) vbox(K, s - 70, 1.0, z + 1.0, 4.2, 2.2, 0.35, K.RP([CAB, CAB2]), { rx: -0.35, ry: R(-0.06, 0.06) });
        }
      }
      for (const [x, z] of [[-40, -92], [12, -92], [-2, -106], [30, -106], [-56, -120], [-30, -120], [44, -120], [0, -133]]) {
        for (const r of [0, 1.05, 2.1]) vbox(K, x, 1, z, 3.2, 0.45, 0.45, CAB3, { ry: r, rz: 0.6 });
        K.collider(x - 1, 0, z - 1, x + 1, 1.8, z + 1, null);
      }
      for (const [x, z, r] of [[-34, -104, 4], [16, -120, 3.5], [-6, -92, 3], [48, -98, 4.5], [-50, -132, 3.5]]) K.mesh(new THREE.CylinderGeometry(r, r * 0.7, 0.06, 9), 0x2f1d16, x, 0.13, z);
      turret(K, -42, -134, -Math.PI / 2);
      turret(K, 32, -136, -Math.PI / 2 - 0.3);
      // a burned-out Cabal tank
      K.box(-48, -106, 5, 2.2, 7, CAB3);
      vbox(K, -47, 3.0, -105, 3, 1.4, 3.4, CAB2, { ry: 0.5, rz: 0.2 });

      // ---- Cabal drop zone: crashed Harvesters, a downed Thresher, pods and fires ----
      harvester(K, -28, -166, { L: 30, rx: 0.12, rz: 0.1, y: -1.2, collide: true });
      harvester(K, 40, -204, { L: 24, ry: Math.PI / 2, rz: 0.14, y: -1, collide: true });
      thresher(K, 54, 2, -158, 0.3, { L: 13, rz: 0.4, rx: 0.15 });
      K.collider(48, 0, -164, 60, 3.5, -152, null);
      for (const [x, z] of [[8, -160], [30, -162], [26, -186], [4, -182], [36, -176]]) dropPod(K, x, z);
      for (const [x, y, z, s] of [[-28, 6, -158, 1.4], [-24, 4.5, -176, 1], [38, 5, -204, 1.2], [54, 3.5, -158, 1]]) {
        K.mesh(new THREE.ConeGeometry(0.9 * s, 2.4 * s, 5), HAZR, x, y, z, { glow: 2.2 });
        K.mesh(new THREE.ConeGeometry(0.5 * s, 1.6 * s, 5), HAZ, x + 0.3, y + 0.4, z, { glow: 2.4 });
      }
      for (const [x, z, r] of [[14, -168, 5], [-6, -190, 4], [44, -186, 3.5]]) K.mesh(new THREE.CylinderGeometry(r, r * 0.7, 0.06, 9), 0x2f1d16, x, 0.13, z);
      supply(K, 22, -158); supply(K, 0, -170, true); supply(K, 12, -192);
      K.light(-28, 7, -160, 0xff6a2a, 10, 26);
      K.light(46, 6, -176, 0xff6a2a, 9, 24);

      // ---- The Boarding Ramp: the flagship's hull wall with its ramp lowered ----
      bulwark(K, -70, -262, 70, -262, 18, { t: 6, face: 1, rib: 12, color: DECK2, color2: DECK, gaps: [[61, 79]] });
      K.box(0, -262, 20, 5, 6, DECK, { y: 13 });
      vbox(K, 0, 12.6, -258.8, 18, 0.5, 0.3, HAZ, { glow: 1.6 });
      vbox(K, 0, 0.12, -246, 16, 0.24, 26, DECK);
      for (const sx of [-1, 1]) {
        vbox(K, sx * 8.3, 0.6, -246, 0.4, 0.9, 26, CAB3);
        for (let z = -256; z <= -236; z += 5) vbox(K, sx * 8.3, 1.15, z, 0.5, 0.2, 0.5, HAZ, { glow: 2 });
        K.mesh(new THREE.CylinderGeometry(0.9, 0.9, 3, 8), CAB3, sx * 6, 0.9, -258.6, { rz: Math.PI / 2 });
      }
      for (const z of [-252, -244, -236]) vbox(K, 0, 0.27, z, 12, 0.05, 0.8, HAZ, { glow: 0.9 });
      // forward hull prows either side of the ramp
      for (const sx of [-1, 1]) {
        K.box(sx * 44, -246, 22, 10, 22, DECK2);
        vbox(K, sx * 44, 11.4, -244, 20, 0.8, 24, DECK, { rx: 0.25 });
        vbox(K, sx * 33.1, 5, -246, 0.2, 0.4, 20, HAZR, { glow: 1.6 });
        turret(K, sx * 44, -250, Math.PI / 2, { s: 1.8, y: 10, collide: false });
      }
      supply(K, -10, -226); supply(K, 12, -222, true); supply(K, -16, -240, true); supply(K, 18, -238);
      bulwark(K, -4, -214, 6, -214, 1.8, { t: 1.2 });
      K.light(0, 10, -257, HAZ, 10, 24);

      // ---- Boss: the deck of Ghaul's flagship under the Traveler ----
      const dz = -306;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) vbox(K, -52.5 + i * 35, 0.1, -277 + j * -23.5 - 0.5, 34.6, 0.2, 23.1, (i + j) % 2 ? DECK : DECK2);
      for (const x of [-35, 0, 35]) vbox(K, x, 0.22, -312, 0.25, 0.05, 92, HAZR, { glow: 0.7 });
      // angular superstructure along both rails and the bridge tower at the stern
      for (const sx of [-1, 1]) {
        for (const [z, d, h] of [[-278, 20, 14], [-304, 22, 24], [-330, 20, 16], [-352, 14, 28]]) {
          const x = sx * 62;
          K.box(x, z, 12, h, d, DECK2);
          K.box(x + sx * 2, z, 8, h * 0.3, d * 0.7, DECK, { y: h });
          vbox(K, x - sx * 4.2, h * 0.95, z, 6, 0.8, d, DECK, { rz: sx * 0.6 });
          vbox(K, x - sx * 6.05, h * 0.6, z, 0.15, 0.4, d * 0.8, HAZR, { glow: 1.6 });
        }
        turret(K, sx * 36, -334, Math.PI / 2, { s: 1.6 });
      }
      K.box(0, -354, 48, 14, 10, DECK2);
      K.box(0, -356, 30, 10, 6, DECK, { y: 14 });
      K.box(0, -357, 16, 8, 4, DECK2, { y: 24 });
      vbox(K, 0, 26, -354.9, 14, 1, 0.2, HAZR, { glow: 2 });
      vbox(K, 0, 9, -348.9, 40, 0.5, 0.2, HAZ, { glow: 1.4 });
      vbox(K, 0, 15, -351, 48, 1, 6, DECK, { rx: -0.5 });
      // deck cover: hatches, vents and armour plates
      for (const [x, z] of [[-14, -290], [14, -292], [-24, -308], [24, -306], [-15, -322], [16, -324], [0, -328]]) {
        K.box(x, z, 3.2, 1.3, 3.2, DECK2);
        vbox(K, x, 1.35, z, 2.4, 0.06, 2.4, HAZR, { glow: 1.2 });
      }
      for (const [x, z, w, d] of [[-8, -282, 6, 0.8], [10, -280, 6, 0.8], [-32, -296, 0.8, 6], [32, -316, 0.8, 6], [-30, -326, 6, 0.8]]) K.box(x, z, w, 2, d, CAB2);
      supply(K, -40, -284); supply(K, 42, -290, true); supply(K, -44, -320, true); supply(K, 40, -340);
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
