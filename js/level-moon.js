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
  K.box(x, z + r + 0.45, 1.4, 2.0, 0.1, PALE, { collide: false, glow: 0.6 });
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

// ---------- U16e helpers: ground-following layout, tunnels, pit fills ----------

// points along a segment, every ~step metres (inclusive of both ends)
function along(x0, z0, x1, z1, step, fn) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / step));
  for (let i = 0; i <= n; i++) fn(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, i, n);
}

// Roofed Hive corridor along axis-aligned legs through pts ([x, z] each, consecutive points share an axis). Inner width w, wall height h.
// Walls are trimmed where another leg opens into them, so bends are real bends, and ribs and glow strips follow every leg.
function tunnelPath(K, pts, o = {}) {
  const w = o.w ?? 7, h = o.h ?? 10, t = 1, hw = w / 2, col = o.color ?? HR2;
  const legs = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i];
    const az = Math.abs(x1 - x0) < 0.01, s = az ? [z0, z1] : [x0, x1], up = s[0] < s[1];
    legs.push({ az, c: az ? x0 : z0, a0: Math.min(...s), a1: Math.max(...s), lo: up ? i > 1 : i < pts.length - 1, hi: up ? i < pts.length - 1 : i > 1 });
  }
  const rectOf = (L) => {
    const e0 = L.a0 - (L.lo ? hw : 0), e1 = L.a1 + (L.hi ? hw : 0);
    return L.az ? { x0: L.c - hw, x1: L.c + hw, z0: e0, z1: e1 } : { x0: e0, x1: e1, z0: L.c - hw, z1: L.c + hw };
  };
  const rects = legs.map(rectOf);
  const inOther = (li, x, z) => rects.some((r, ri) => ri !== li && x > r.x0 + 0.2 && x < r.x1 - 0.2 && z > r.z0 + 0.2 && z < r.z1 - 0.2);
  legs.forEach((L, li) => {
    const e0 = L.a0 - (L.lo ? hw + t : 0), e1 = L.a1 + (L.hi ? hw + t : 0), mid = (e0 + e1) / 2, len = e1 - e0;
    for (const sd of [-1, 1]) {
      const cw = L.c + sd * (hw + t / 2);
      let pieces = [[e0, e1]];
      rects.forEach((r, ri) => {
        if (ri === li) return;
        const [lo, hi, a, b] = L.az ? [r.x0, r.x1, r.z0, r.z1] : [r.z0, r.z1, r.x0, r.x1];
        if (cw <= lo + 0.05 || cw >= hi - 0.05) return;
        pieces = pieces.flatMap(([p, q]) => ((b <= p || a >= q) ? [[p, q]] : [[p, Math.min(q, a)], [Math.max(p, b), q]].filter(([u, v]) => v - u > 0.01)));
      });
      for (const [p, q] of pieces) if (q - p > 0.3) { if (L.az) K.wall(cw, p, cw, q, h, { t, color: col }); else K.wall(p, cw, q, cw, h, { t, color: col }); }
      // glow strip along the foot of the wall
      if (L.az) K.box(L.c + sd * (hw - 0.3), L.a0 + (L.a1 - L.a0) / 2, 0.3, 0.12, L.a1 - L.a0, GREEN, { y: 0.3, collide: false, glow: 1.4 });
      else K.box(L.a0 + (L.a1 - L.a0) / 2, L.c + sd * (hw - 0.3), L.a1 - L.a0, 0.12, 0.3, GREEN, { y: 0.3, collide: false, glow: 1.4 });
    }
    if (L.az) K.box(L.c, mid, w + 2 * t, 0.6, len, CHIT, { y: h }); else K.box(mid, L.c, len, 0.6, w + 2 * t, CHIT, { y: h });
    for (let a = L.a0 + 1.5; a < L.a1 - 0.5; a += 3) {
      const [cx, cz] = L.az ? [L.c, a] : [a, L.c];
      if (inOther(li, cx, cz)) continue;
      for (const sd of [-1, 1]) {
        if (L.az) K.box(L.c + sd * (hw - 0.2), a, 0.8, h, 0.7, HR, { collide: false }); else K.box(a, L.c + sd * (hw - 0.2), 0.7, h, 0.8, HR, { collide: false });
      }
      if (L.az) K.box(L.c, a, w + 0.6, 0.6, 0.7, HR, { y: h - 0.8, collide: false }); else K.box(a, L.c, 0.7, 0.6, w + 0.6, HR, { y: h - 0.8, collide: false });
    }
    const mx = L.az ? L.c : (L.a0 + L.a1) / 2, mz = L.az ? (L.a0 + L.a1) / 2 : L.c;
    K.light(mx, 6, mz, o.light ?? GREEN, 5, 18);
  });
}

// merge a rectangular area into strips of cell-sized squares that are NOT inside any of the walkable rects ([x0, x1, z0, z1])
function pitStrips(x0, x1, z0, z1, rects, cell = 2) {
  const strips = [];
  let open = new Map();
  for (let z = z0; z < z1; z += cell) {
    const zc = z + cell / 2, segs = [];
    let xs = null;
    for (let x = x0; x < x1; x += cell) {
      const xc = x + cell / 2, inside = rects.some((r) => xc > r[0] && xc < r[1] && zc > r[2] && zc < r[3]);
      if (!inside) { if (xs === null) xs = x; } else if (xs !== null) { segs.push([xs, x]); xs = null; }
    }
    if (xs !== null) segs.push([xs, x1]);
    const next = new Map();
    for (const [a, b] of segs) {
      const k = `${a}|${b}`, s = open.get(k);
      if (s) { s.z1 = z + cell; next.set(k, s); } else { const n = { x0: a, x1: b, z0: z, z1: z + cell }; strips.push(n); next.set(k, n); }
    }
    open = next;
  }
  return strips;
}

// a green-crystal lamp column
function lamp(K, x, z, h = 3.4, y = 0) {
  K.cyl(x, z, 0.28, h, HR2, { sides: 5, y, collide: 0.9 });
  K.mesh(crystalGeo(), GREEN, x, y + h + 0.5, z, { scale: [0.3, 0.55, 0.3], glow: 2.4 });
  K.light(x, y + h + 1, z, GREEN, 3.5, 16);
}

// downed Golden Age lander: a tilted hull with a snapped leg and a dish
function lander(K, x, z, ry) {
  K.mesh(new THREE.BoxGeometry(8, 3.4, 5.5), GA, x, 2.4, z, { ry, rz: 0.1 });
  K.mesh(new THREE.BoxGeometry(8.1, 0.4, 5.6), ORANGE, x, 2.7, z, { ry, rz: 0.1 });
  K.mesh(new THREE.BoxGeometry(3.4, 1.4, 3.2), GA2, x, 4.5, z, { ry, rz: 0.1 });
  K.ocollider(x, z, 8, 4.1, 5.5, ry);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const [lx, lz, tilt] of [[-3.4, 2.4, 0.2], [3.4, 2.4, -0.2], [-3.4, -2.4, 0.25]]) {
    K.mesh(new THREE.CylinderGeometry(0.14, 0.28, 3.4, 5), GA2, x + lx * c + lz * s, 1.3, z - lx * s + lz * c, { rz: tilt, rx: 0.1 });
  }
  K.mesh(new THREE.SphereGeometry(1.8, 8, 4, 0, TAU, 0, Math.PI * 0.4), PALE, x + 1 * c, 4.8, z - 1 * s, { rx: 0.5, glow: 0.5 });
}

// ======================================================================================
export default {
  // ---------------- M1: a ravine, a Golden Age station, a Hive tunnel and the Gate of Oryx ----------------
  // Rhythm: Archer's Line (ravine fight, antenna ridge above) > the rise to the station (traversal) > Anchor of Light (station fight)
  // > the cave mouth and a 50 m Hive tunnel with a side cavern (traversal into a new area) > Gate of Oryx (plaza, terraced gateway).
  m1: {
    spawn: [0, 18],
    bounds: [-80, 80, -292, 30],
    zones: [
      { name: "Archer's Line", x: -19, z: -62 },
      { name: 'Anchor of Light', x: 14, z: -132 },
      { name: 'Gate of Oryx', x: 0, z: -246, boss: true, room: { minX: -43, maxX: 43, minZ: -271.5, maxZ: -223.5 } },
    ],
    noEdge: true,
    // Earth hangs huge and low over the dark; a thin blue earthlight lies along the horizon
    sky: {
      stars: { n: 1500, color: 0xdfe8ff, size: 2.2, min: 0 },
      bodies: [{ color: 0x2f6fc4, size: 150, pos: [150, 140, -420], glow: 0x6fb0ff, patches: [0x2f6fc4, 0x2f6fc4, 0x3f8a58, 0xdfe8f2] }],
      haze: [{ color: 0x2a5aa0, opacity: 0.16, r: 470, h: 60, y: -6 }],
    },
    // The station sits on a low shelf; the ravine rises to it. Later features win, so the ridges are listed last.
    terrain: [
      { type: 'plateau', x: 22, z: -124, w: 76, d: 64, h: 2.5, edge: 14 },                  // the station shelf
      { type: 'plateau', x: -60, z: -64, w: 30, d: 62, h: 4.8, edge: 7 },                   // west ridge, the antenna overlook
      { type: 'ramp', x0: -38, z0: -30, x1: -54, z1: -42, width: 5, h0: 0, h1: 4.8, edge: 3 }, // the path up the west ridge
      { type: 'plateau', x: 24, z: -66, w: 36, d: 60, h: 5.6, edge: 5 },                    // east ridge, the cave wall
    ],
    build(K) {
      // ---- the plain (spawn) and the ravine floor: a few craters, only where the ground is level ----
      for (const [x, z, r] of [[-20, 2, 4], [24, 4, 5], [6, -20, 5], [-8, -12, 4], [-56, -8, 7], [58, -8, 6], [-46, 12, 5]]) crater(K, x, z, r);
      for (const [x, z, r] of [[-22, -50, 6], [-12, -76, 5], [-30, -72, 4], [-8, -45, 3.5], [-26, -88, 4.5]]) crater(K, x, z, r);
      for (const [x, z, s] of [[-31, -42, 1.8], [11, -30, 1.6], [-14, -92, 2.0], [-62, -12, 2.6], [50, -14, 2.2], [-4, 6, 1.4], [30, 14, 1.8]]) K.rock(x, z, s);

      // ---- Archer's Line: a shallow ravine between two ridges, Golden Age array above ----
      lander(K, -17, -68, 0.35);                                   // the downed lander: the central cover block
      rover(K, -33, -46, false);
      rover(K, -4, -58, false);
      rover(K, -34, -80, false);
      rover(K, -6, -86, false);
      fallenAntenna(K, -10, -50, 12);
      for (const [x, z, w, d] of [[-27, -52, 1.2, 5], [-9, -66, 1.2, 4], [-26, -78, 5, 1.2]]) K.box(x, z, w, 1.4, d, GA2);
      for (const [x, z] of [[-28, -58], [-14, -54], [-22, -83], [-10, -78]]) K.crate(x, z);
      // west ridge top: the antenna trio, the equipment shed, a long view down the ravine
      antenna(K, -64, -50, 14);
      antenna(K, -68, -66, 11);
      antenna(K, -58, -78, 9);
      fallenAntenna(K, -56, -90, 10);
      K.box(-62, -62, 6, 1.6, 3, GA2);
      K.box(-62, -62, 6.1, 0.3, 3.1, ORANGE, { y: 1.0, collide: false });
      for (const [x, z, s] of [[-50, -40, 2.0], [-49, -58, 2.4], [-50, -72, 1.8], [-51, -86, 2.2]]) K.rock(x, z, s);
      K.light(-60, 5, -60, ORANGE, 5, 20);
      K.light(-56, 5, -46, ORANGE, 4, 18);
      // east ridge: the Hive cave mouth cut into its face, inside the zone
      for (const [x, z, s] of [[9, -44, 2.4], [8, -60, 2.8], [9, -84, 2.2]]) K.rock(x, z, s);
      K.box(3.4, -70, 6, 5, 22, K.C.rock2);
      K.box(-0.1, -70, 0.4, 7, 9, VOID, { collide: false });
      pointedArch(K, -0.3, -70, 9, 7, { fill: VOID });
      for (const dz of [-6, 6]) K.box(-0.6, -70 + dz, 1.2, 9, 1.2, HR2);
      for (const dz of [-9, -3, 3, 9]) boneSpike(K, -1.8, -70 + dz * 1.3, K.R(3, 5), { rz: 0.5 });
      crystals(K, -2.4, -57, 1.2);
      crystals(K, -2.6, -83, 1.0);
      K.light(-2, 4, -70, GREEN, 8, 26);
      K.light(-16, 5, -52, PALE, 4, 20);
      K.light(-26, 5, -80, PALE, 4, 20);
      // the Hive cairn path: the way out of the ravine, marked in bone
      along(-24, -96, -2, -110, 7, (x, z, i) => { K.rock(x + (i % 2 ? 2 : -2), z, 1.1 + (i % 3) * 0.3); if (i % 2) boneSpike(K, x - 1.5, z + 1, 3 + (i % 3)); });

      // ---- Anchor of Light: Golden Age station on its shelf, the Hive taking the east dome ----
      const pad = [24, -122];
      K.platform(pad[0], pad[1], 10, 10, 1.0, { stairs: ['s', 'n', 'e', 'w'], stairW: 5, color: GA2, stairColor: GA }); // the raised pad
      for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; K.box(pad[0] + Math.sin(a) * 4.2, pad[1] + Math.cos(a) * 4.2, 0.6, 0.12, 0.6, ORANGE, { y: 1.0, collide: false, glow: 1.4 }); }
      K.box(pad[0], pad[1], 6, 0.1, 1, ORANGE, { y: 1.02, collide: false });
      K.box(pad[0], pad[1], 1, 0.1, 6, ORANGE, { y: 1.02, collide: false });
      dome(K, -4, -112, 7);
      dome(K, 46, -102, 6);
      dome(K, 46, -148, 8);                                         // the infected dome
      dome(K, 4, -150, 5);
      gaModule(K, 22, -100, 14, 5);
      gaModule(K, 56, -126, 5, 12);
      gaModule(K, -8, -130, 5, 10);
      tube(K, 29, -100, 40.2, -102);
      tube(K, -8, -125, -8, -118);
      antenna(K, 56, -108, 20);
      antenna(K, -12, -98, 12);
      // two hand-placed cover rings: a broken ring of jersey barriers round the pad and a looser ring of crates and slabs outside
      for (let k = 0; k < 5; k++) { const a = 0.35 + k * (TAU / 5); K.obox(pad[0] + Math.cos(a) * 12, pad[1] + Math.sin(a) * 12, 4, 1.2, 0.8, -a - Math.PI / 2, GA2); }
      for (const [x, z, w, d] of [[34, -140, 5, 0.9], [10, -108, 0.9, 4], [40, -114, 4, 0.9]]) K.box(x, z, w, 1.3, d, GA2);
      for (const [x, z] of [[8, -142], [11, -140.5], [38, -128], [36, -125.5], [14, -112]]) K.crate(x, z);
      // the beacon: the Anchor itself, a tall Golden Age tower over the station
      K.cyl(-2, -140, 2.0, 34, GA, { r2: 1.0, sides: 8 });
      K.cyl(-2, -140, 2.6, 1.0, GA2, { sides: 8 });
      for (const y of [8, 17, 26]) K.cyl(-2, -140, 1.9 - y * 0.025, 0.5, ORANGE, { sides: 8, y, collide: false, glow: 1.2 });
      K.mesh(new THREE.OctahedronGeometry(1.5, 0), PALE, -2, 36.5, -140, { glow: 2 });
      K.light(-2, 37, -140, PALE, 12, 70);
      // the Hive is taking the east dome only
      for (const [x, z, h] of [[40, -152, 7], [47, -158, 9], [43, -146, 5], [52, -150, 6], [49, -140, 4]]) boneSpike(K, x, z, h);
      crystals(K, 36, -142, 1.1);
      crystals(K, 54, -140, 1.0);
      for (const [x, z, w, d] of [[34, -150, 6, 0.3], [40, -144, 0.3, 5], [52, -146, 5, 0.3]]) K.box(x, z, w, 0.3, d, GREEN, { collide: false, glow: 1.2 });
      K.light(pad[0], 9, pad[1], PALE, 6, 30);
      K.platform(47, -118, 8, 6, 2.0, { stairs: ['w'], color: GA2, stairColor: GA }); // raised dock
      K.light(47, 5, -118, ORANGE, 5, 20);
      K.light(-8, 6, -132, PALE, 4, 20);
      K.light(14, 6, -104, ORANGE, 4, 20);

      // ---- the cave mouth: a rock massif with a Hive tunnel through it (about 50 m, one bend, a side cavern) ----
      for (const s of [-1, 1]) {
        K.box(s * 27.5, -183, 46, 24, 22, K.C.rock2);
        K.box(s * 27.5, -183, 40, 7, 18, K.C.rock, { y: 24, collide: false });
        boneSpike(K, s * 6.5, -171, K.R(4, 6), { rz: s * 0.2 });
      }
      K.box(0, -183, 9, 12, 22, K.C.rock, { y: 10.6, collide: false });
      pointedArch(K, 0, -171.2, 9, 8, { fill: HR2 });
      for (const s of [-1, 1]) { spire(K, s * 9, -171, 1.6, 16, { pinnacles: false }); brazier(K, s * 6, -168, 1.0); }
      for (const [x, z] of [[-10, -166], [12, -164]]) K.rock(x, z, 1.8);
      tunnelPath(K, [[0, -172], [0, -194]]);
      K.room(-6, -204, 26, 20, 10, { t: 1.2, doors: { s: 8, n: 8 }, doorOffset: { s: 6, n: -8 }, roof: true, color: HR2, roofColor: CHIT });
      tunnelPath(K, [[-14, -214], [-14, -221]]);
      // the side cavern: stalagmites, a Hive growth, a lamp
      for (const [x, z, r, h] of [[-15, -199, 1.6, 5], [3, -208, 1.4, 4], [-12, -210, 1.2, 3.5]]) K.cone(x, z, r, h, K.C.rock2, { sides: 5 });
      crystals(K, 2, -198, 1.1);
      crystals(K, -16, -209, 0.9);
      for (const [x, z] of [[-4, -202], [-9, -207]]) K.rock(x, z, 1.6);
      for (const [x, z] of [[-1, -200], [-10, -204]]) boneSpike(K, x, z, K.R(3, 5));
      K.mesh(flat(new THREE.CircleGeometry(3.4, 10)), GREEN, -6, 0.28, -204, { glow: 0.5 });
      K.light(-6, 7, -204, GREEN, 8, 24);

      // ---- Gate of Oryx: a temple plaza before a huge spired facade, the gateway raised on three terraces ----
      const gz = -56; // the plaza begins past the tunnel
      K.box(0, -190 + gz, 70, 0.3, 50, 0x54575c, { collide: false });                      // plaza floor
      for (let z = -168; z > -212; z -= 8) K.box(0, z + gz, 68, 0.32, 0.4, HR2, { collide: false }); // floor seams
      hiveWall(K, -80, 80, -217 + gz, 16, { t: 3, face: 1, rib: 8, teeth: 4, gaps: [[74, 86]] });
      K.box(0, -220.5 + gz, 13, 16, 4, VOID);                                              // the dark gateway
      // three terraces climb to the gateway, a 5 m stair at each step; the top terrace fills the slot through the wall
      K.platform(0, -265.5, 30, 12, 1.6, { stairs: ['s'], stairW: 5, color: HR2, stairColor: HR });
      K.platform(0, -267, 22, 9, 1.6, { y: 1.6, stairs: ['s'], stairW: 5, color: HR, stairColor: HR2 });
      K.platform(0, -270, 14, 9, 1.6, { y: 3.2, stairs: ['s'], stairW: 5, color: HR2, stairColor: HR });
      pointedArch(K, 0, -215.4 + gz, 9, 12);
      for (const s of [-1, 1]) K.box(s * 6.3, -215.6 + gz, 0.5, 14, 0.4, GREEN, { y: 4.8, collide: false, glow: 1.6 });
      brazier(K, -9, -266, 1, 3.2);
      brazier(K, 9, -266, 1, 3.2);
      // ziggurat tiers flanking the terraces
      for (const s of [-1, 1]) {
        K.box(s * 25, -265, 14, 1.6, 8, HR2);
        K.box(s * 25, -266, 10, 1.6, 6, HR, { y: 1.6 });
        K.box(s * 25, -267, 6, 1.6, 4, HR2, { y: 3.2 });
        brazier(K, s * 25, -267, 1.2, 4.8);
      }
      // the great spires of the facade
      for (const [x, r, h] of [[11.5, 4.5, 46], [28, 3.6, 34], [48, 3.2, 28], [70, 2.6, 22]]) for (const s of [-1, 1]) spire(K, s * x, -218 + gz, r, h);
      // side wings close the plaza into a U
      for (const s of [-1, 1]) {
        hiveWall(K, -214 + gz, -166 + gz, s * 44, 9, { axis: 'z', t: 2, face: -s, rib: 7 });
        for (const z of [-170, -186, -202]) brazier(K, s * 29, z + gz, 1.1);
      }
      // south wall closes the plaza: one 8 m door where the tunnel arrives, sealed until Anchor of Light is cleared
      hiveWall(K, -44, 44, -166 + gz, 12, { axis: 'x', t: 2.4, face: -1, rib: 8, teeth: 4, gaps: [[26, 34]] });
      K.door(-14, -166 + gz, 8, 12, 'x', { zone: 1, t: 2.4, color: HR2, trim: GREEN });
      for (const sx of [-25, -3]) spire(K, sx, -166 + gz, 1.4, 18, { pinnacles: false });
      for (const sx of [-23.5, -4.5]) brazier(K, sx, -163 + gz, 1.1);
      // east flank deck: a firing position over the plaza; the west flank is a roofed cloister (the plaza is partly roofed)
      K.platform(36.5, -246, 8, 24, 2.0, { stairs: ['s'], color: HR2, stairColor: HR });
      K.box(32.6, -246, 0.25, 1.0, 24, GREEN, { y: 2.0, collide: false, glow: 1.2 });
      K.light(36.5, 5, -246, GREEN, 6, 22);
      for (const [x, z] of [[-40, -236], [-28, -236], [-40, -248], [-28, -248], [-40, -260], [-28, -260]]) { K.box(x, z, 1.8, 9, 1.8, HR); K.box(x, z, 2.4, 0.6, 2.4, HR2, { collide: false }); }
      K.box(-34, -248, 15, 0.8, 30, HR2, { y: 9 });
      for (let z = -238; z > -260; z -= 7) K.box(-34, z, 15.4, 0.5, 0.6, HR, { y: 8.5, collide: false });
      brazier(K, -34, -248, 1.1);
      K.light(-34, 7, -248, GREEN, 6, 24);
      K.light(0, 8, -226, GREEN, 6, 24);
      K.light(22, 7, -228, GREEN, 5, 22);
      // cover in the arena
      for (const [x, z, h] of [[-12, -234, 6], [13, -236, 3], [-9, -252, 3.5], [14, -251, 7], [0, -227, 2.2]]) broken(K, x, z, h);
      K.box(-20, -242, 1, 1.6, 6, HR2);
      K.box(21, -240, 1, 1.6, 6, HR2);
      K.light(0, 10, -260, GREEN, 14, 45);

      hiveEdge(K, 70, 0.3, 80);
    },
  },

  // ---------------- M2: Temple of Crota terraces, the Hellmouth pit, tunnels, cathedral ----------------
  // Rhythm: Temple (a forecourt in three terraces climbing to the wall gate) > the high ground behind the wall (traversal, the pit comes into
  // view) > the Hellmouth (combat on the shelf around the pit while descending) > the gully and a 42 m kinked tunnel (traversal) > Hive Tunnels hall
  // (bridge and galleries, the hall fires down the tunnel) > a 38 m tunnel > Chamber of Night (the long nave).
  m2: {
    spawn: [0, 18],
    bounds: [-80, 85, -392, 30],
    zones: [
      { name: 'Temple of Crota', x: 0, z: -56 },
      { name: 'The Hellmouth', x: -2, z: -168 },
      { name: 'Hive Tunnels', x: -32, z: -254 },
      { name: 'Chamber of Night', x: -10, z: -344, boss: true, room: { minX: -34.2, maxX: 14.2, minZ: -375.2, maxZ: -312.8 } },
    ],
    noEdge: true,
    // the Hive's green glow on the horizon, tomb ships hanging in the dark, a faint green aurora over the pit
    sky: {
      floaters: [{ kind: 'ship', n: 6, r: [380, 620], y: [70, 210], size: [22, 40], color: 0x0a1612, glow: 0x3aff9a, haze: 0.2 }],
      aurora: [{ color: 0x3aff9a, y: 150, r: 520, h: 130, arc: [0.2, 2.6], opacity: 0.2, waves: 3 }],
      haze: [{ color: 0x3aff9a, opacity: 0.3, r: 480, h: 70, y: -6 }],
    },
    // terraces climb to the gate (7.2 m), the high ground steps down to the Hellmouth shelf (4 m, the pit a bowl down to 0), a gully reaches the cliff
    terrain: [
      { type: 'plateau', x: 2.5, z: -43, w: 170, d: 10, h: 2.4, edge: 3 },
      { type: 'plateau', x: 2.5, z: -66, w: 170, d: 8, h: 4.8, edge: 3 },
      { type: 'plateau', x: 2.5, z: -97, w: 170, d: 42, h: 7.2, edge: 4 },
      { type: 'plateau', x: 10, z: -165, w: 120, d: 62, h: 4, edge: 6 },
      { type: 'ramp', x0: 2.5, z0: -20, x1: 2.5, z1: -38, width: 166, h0: 0, h1: 2.4, edge: 3 },
      { type: 'ramp', x0: 2.5, z0: -48, x1: 2.5, z1: -62, width: 166, h0: 2.4, h1: 4.8, edge: 3 },
      { type: 'ramp', x0: 2.5, z0: -70, x1: 2.5, z1: -80, width: 166, h0: 4.8, h1: 7.2, edge: 3 },
      { type: 'ramp', x0: 2.5, z0: -116, x1: 2.5, z1: -134, width: 166, h0: 7.2, h1: 4, edge: 3 },
      { type: 'basin', x: 20, z: -168, r: 16, flat: 0.4, depth: 4 },
      { type: 'ramp', x0: -30, z0: -188, x1: -30, z1: -206, width: 26, h0: 4, h1: 0, edge: 4 },
    ],
    build(K) {
      // ---- processional approach (level ground) ----
      for (const z of [2, -12]) for (const s of [-1, 1]) brazier(K, s * 9, z, 1.1);
      for (const s of [-1, 1]) hiveWall(K, -16, 14, s * 62, 6, { axis: 'z', t: 2, face: -s, rib: 8, tier: false });

      // ---- Temple of Crota: a forecourt in three terraces, fallen wall pieces for cover, the great wall at the top ----
      for (const s of [-1, 1]) { brazier(K, s * 16, -43, 1.2); brazier(K, s * 16, -66, 1.2); brazier(K, s * 11, -76, 1.2); }
      for (const [x, z, h] of [[-14, -28, 5], [15, -31, 3.5], [-13, -52, 4], [14, -55, 6], [-15, -64, 3], [13, -68, 5]]) broken(K, x, z, h);
      for (const [x, z, w, h, d, ry] of [[-26, -44, 8, 1.8, 1.5, 0.45], [24, -42, 7, 1.4, 1.5, -0.5], [-22, -67, 6, 1.6, 1.4, -0.3], [28, -65, 7, 1.8, 1.5, 0.4], [-7, -55, 5, 1.2, 1.2, 0.2]]) K.obox(x, z, w, h, d, ry, HR2);
      crystals(K, -22, -30, 1.0);
      crystals(K, 24, -50, 1.1);
      crystals(K, -32, -62, 0.9);
      // the wall: ribbed, tiered, crowned with spikes, gate at x -7..7 (it stands on the top terrace, the high ground behind it)
      hiveWall(K, -80, 85, -80, 16, { t: 3.2, face: 1, rib: 7, teeth: 4.5, gaps: [[73, 87]] });
      K.box(0, -80, 14, 4, 3.2, HR2, { y: 11, collide: false });
      pointedArch(K, 0, -78.2, 9, 15.5, { fill: HR2 });
      for (const s of [-1, 1]) K.box(s * 7.3, -78.3, 0.4, 11, 0.4, GREEN, { collide: false, glow: 1.6 });
      for (const [x, r, h] of [[12, 4, 38], [34, 3, 28], [58, 3, 24]]) for (const s of [-1, 1]) spire(K, s * x, -81, r, h);
      spire(K, 80, -81, 2.6, 20);
      K.light(0, 8, -74, GREEN, 10, 30);
      K.light(-14, 5, -43, GREEN, 5, 22);
      K.light(14, 5, -66, GREEN, 5, 22);

      // ---- inside the wall: the high ground, Hive pillars leading to the edge where the Hellmouth opens below ----
      for (const [x, z, h] of [[-30, -96, 4], [10, -100, 6], [-12, -106, 3.5], [36, -94, 5], [-52, -108, 3], [56, -104, 4.5]]) broken(K, x, z, h);
      K.box(-26, -90, 7, 2, 1, HR2);
      K.box(22, -110, 1, 1.8, 6, HR2);
      crystals(K, -38, -100, 1.2);
      crystals(K, 0, -88, 0.9);
      for (const [x, z] of [[-60, -92], [44, -110], [66, -96]]) K.prop(x, z);
      for (const s of [-1, 1]) { brazier(K, s * 14, -92, 1.3); brazier(K, s * 20, -111, 1.2); }
      K.light(0, 5, -100, GREEN, 6, 28);

      // ---- The Hellmouth: a vast pit on its shelf; the walkway rings it, a bone span crosses to an island ----
      const px = 20, pz = -168, pr = 16;
      K.mesh(flat(new THREE.CircleGeometry(6.4, 28)), VOID, px, 0.29, pz);
      K.mesh(flat(new THREE.RingGeometry(3.0, 3.7, 28)), GREEN, px, 0.3, pz, { glow: 0.7 });
      K.mesh(flat(new THREE.RingGeometry(5.0, 5.4, 32)), GREEN, px, 0.29, pz, { glow: 0.35 });
      // the bowl, dark, following the ground
      {
        const pts = [];
        for (let r = pr + 0.5; r >= 0; r -= 1) pts.push(new THREE.Vector2(r, K.ground(px + r, pz) + 0.2 - (r >= pr ? 0.17 : 0)));
        const bowl = K.mesh(new THREE.LatheGeometry(pts, 40), 0x0b0d10, px, 0, pz);
        bowl.material = bowl.material.clone(); bowl.material.side = THREE.DoubleSide;
      }
      const ringR = pr + 1.6, N = 36;
      for (let k = 0; k < N; k++) {
        const a = (k / N) * TAU, x = px + Math.sin(a) * ringR, z = pz + Math.cos(a) * ringR;
        K.mesh(new THREE.BoxGeometry(3.1, 2.4, 1.4), HR, x, 1.2, z, { ry: a });
        if (k % 2 === 0) K.mesh(spikeGeo(), BONE, x + Math.sin(a) * 0.3, 3.4, z + Math.cos(a) * 0.3, { scale: [0.45, 2.8, 0.45], rx: Math.cos(a) * 0.35, rz: -Math.sin(a) * 0.35 });
      }
      // fill the bowl with colliders so nothing walks or spawns in it: tall rows, with a low strip under the span and a hole for the island
      const fillRow = (x0, x1, zc, top) => { const gc = K.ground((x0 + x1) / 2, zc); K.collider(x0, -1 - gc, zc - 1.5, x1, top - gc, zc + 1.5, null); };
      for (let dz = -15; dz <= 15; dz += 3) {
        const zc = pz + dz, hw = Math.sqrt(Math.max(0, (pr - 0.5) ** 2 - Math.max(0, Math.abs(dz) - 1.5) ** 2));
        if (dz >= 6) { fillRow(px - hw, px - 2.5, zc, 8); fillRow(px + 2.5, px + hw, zc, 8); fillRow(px - 2.5, px + 2.5, zc, 2.4); }
        else if (Math.abs(dz) <= 3) { fillRow(px - hw, px - 4, zc, 8); fillRow(px + 4, px + hw, zc, 8); }
        else fillRow(px - hw, px + hw, zc, 8);
      }
      // the island and the span
      K.platform(px, pz, 8, 8, 4, { color: HR2 });
      K.box(px, pz - 0.0, 3.6, 0.5, 3.6, GREEN, { y: 4.0, abs: true, collide: false, glow: 0.8 });
      K.box(px, pz + 7.5, 3, 0.6, 13, HR, { y: 3.45, abs: true });
      for (const s of [-1, 1]) K.box(px + s * 1.6, pz + 7.5, 0.35, 1.0, 13, HR, { y: 4.05, abs: true });
      for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) brazier(K, px + dx, pz + dz, 1.0, 4.05 - K.ground(px + dx, pz + dz));
      for (const [dx, dz] of [[-3.4, 0], [3.4, 0]]) boneSpike(K, px + dx, pz + dz, 5, { y: 4 - K.ground(px + dx, pz + dz) });
      // giant teeth leaning over the pit and spires on its far rim
      for (let k = 0; k < 7; k++) {
        const a = Math.PI * 0.1 + (k / 6) * Math.PI * 0.9, r = ringR + 2.5, x = px + Math.sin(a) * r, z = pz + Math.cos(a) * r;
        K.mesh(spikeGeo(), BONE, x, 5, z, { scale: [1.0, 12, 1.0], rx: -Math.cos(a) * 0.45, rz: Math.sin(a) * 0.45 });
      }
      spire(K, 52, -150, 3.5, 30);
      spire(K, 56, -170, 4, 36);
      spire(K, 46, -188, 3, 24);
      spire(K, 36, -140, 2.6, 20);
      // cover on the near rim and the shelf
      for (const [x, z, h] of [[-20, -150, 4], [-28, -178, 5.5], [-8, -190, 3], [6, -144, 3.5], [-40, -160, 3], [44, -192, 4.5]]) broken(K, x, z, h);
      K.box(-14, -160, 7, 2, 1, HR2);
      K.box(-2, -182, 1, 1.8, 6, HR2);
      crystals(K, -36, -146, 1.2);
      crystals(K, 0, -152, 0.9);
      for (const [x, z] of [[-48, -140], [-44, -190], [62, -156]]) K.prop(x, z);
      brazier(K, 2, -160, 1.3);
      brazier(K, 4, -182, 1.3);
      // west overlook (stairs only)
      K.platform(-42, -176, 8, 14, 2.0, { stairs: ['e'], color: HR2, stairColor: HR });
      brazier(K, -42, -182, 1.0, 2.0);
      K.light(-42, 6, -176, GREEN, 5, 22);
      K.light(px, 8, pz, GREEN, 9, 40);
      K.light(2, 5, -168, GREEN, 6, 24);
      K.light(-26, 5, -150, GREEN, 5, 22);

      // ---- cliff with the tunnel mouth ----
      hiveWall(K, -80, 85, -214, 18, { t: 3, face: 1, rib: 9, teeth: 6, gaps: [[46, 54]] });
      spire(K, -38, -212.5, 2.4, 26);
      spire(K, -22, -212.5, 2.4, 26);
      pointedArch(K, -30, -212.3, 8, 11, { fill: HR2 });
      for (const s of [-1, 1]) K.box(-30 + s * 4.2, -212.3, 0.35, 10, 0.35, GREEN, { collide: false, glow: 1.4 });

      // ---- Hive tunnels: a 42 m kinked tunnel in, the ribbed junction hall, a 38 m tunnel out ----
      tunnelPath(K, [[-30, -214], [-30, -230], [-18, -230], [-18, -244]]);
      K.room(-30, -265, 44, 42, 10, { t: 1.2, doors: { s: 8, n: 8 }, doorOffset: { s: 12, n: 8 }, roof: true, color: HR2, roofColor: CHIT });
      K.door(-18, -244, 8, 10, 'x', { zone: 1, t: 1.2, color: HR2, trim: GREEN }); // sealed until the Hellmouth is cleared
      for (let z = -247; z > -286; z -= 4) for (const s of [-1, 1]) K.box(-30 + s * 21.2, z, 0.7, 10, 1.0, HR, { collide: false });
      for (let z = -248; z > -286; z -= 6) K.box(-30, z, 42, 0.7, 0.9, HR, { y: 9.0, collide: false });
      for (const [x, z] of [[-41, -256], [-19.5, -258], [-40, -275], [-21, -273.5]]) { // four pillars, none on a grid
        K.cyl(x, z, 1.7, 10, HR, { r2: 1.1, sides: 6 });
        K.box(x, z, 3.2, 0.6, 3.2, HR2, { y: 0, collide: false });
      }
      for (const [x, z] of [[-48, -248], [-12, -248], [-48, -282], [-12, -282]]) crystals(K, x, z, 1.0);
      for (const [x, z] of [[-30, -255], [-36, -275], [-22, -270]]) K.mesh(flat(new THREE.CircleGeometry(2.2, 10)), GREEN, x, 0.28, z, { glow: 0.6 });
      for (const [x, z] of [[-50.5, -260], [-9.5, -270], [-50.5, -273]]) K.mesh(new THREE.SphereGeometry(1.1, 6, 4), BONE, x, 2.2, z, { scale: [0.6, 1.4, 0.8] });
      K.box(-36, -264, 6, 1.4, 1, HR2);
      K.box(-23, -266, 1, 1.4, 5, HR2);
      K.light(-30, 8, -255, GREEN, 8, 24);
      K.light(-30, 8, -275, GREEN, 8, 24);
      for (const [x, z] of [[-41, -256], [-19.5, -258], [-40, -275], [-21, -273.5]]) K.light(x, 4, z, GREEN, 4, 14);
      tunnelPath(K, [[-22, -286], [-22, -298], [-10, -298], [-10, -312]]);
      // the caverns have levels: a bone-ribbed bridge crosses the hall 3.6 m up on a stair at each end, and a gallery runs along each wall
      K.platform(-30, -265, 5, 22, 3.6, { stairs: ['s', 'n'], stairW: 3.5, color: HR2, stairColor: HR });
      for (const s of [-1, 1]) {
        K.box(-30 + s * 2.4, -265, 0.3, 1.0, 22, HR, { y: 3.6, collide: false });
        for (let z = -274; z <= -256; z += 6) boneSpike(K, -30 + s * 2.4, z, 1.8, { y: 4.6, rx: 0 });
      }
      K.platform(-49.4, -265, 4, 28, 3.6, { stairs: ['s'], stairW: 3, color: HR2, stairColor: HR });
      K.platform(-10.6, -265, 4, 28, 3.6, { stairs: ['s'], stairW: 3, color: HR2, stairColor: HR });
      K.box(-47.3, -265, 0.3, 1.0, 28, HR, { y: 3.6, collide: false });
      K.box(-12.7, -265, 0.3, 1.0, 28, HR, { y: 3.6, collide: false });
      for (const z of [-255, -265, -275]) { K.light(-49.4, 7, z, GREEN, 4, 16); K.light(-10.6, 7, z, GREEN, 4, 16); }

      // ---- Chamber of Night: roofed nave, pillar rows, braziers, raised altar, a loft by the door ----
      const cz = -344;
      K.room(-10, cz, 50, 64, 16, { t: 1.6, doors: { s: 8 }, roof: true, color: HR2, roofColor: CHIT });
      for (const dz of [22, 12, 2, -8, -18]) for (const x of [-26, 6]) {
        K.box(x, cz + dz, 2.4, 16, 2.4, HR);
        K.box(x, cz + dz, 3.4, 1.2, 3.4, HR2, { collide: false });
        K.box(x, cz + dz, 3.0, 0.8, 3.0, HR2, { y: 13.5, collide: false });
        boneSpike(K, x, cz + dz + 1.4, 2.4, { y: 14.3, rx: 0.3 });
      }
      for (let dz = 24; dz > -30; dz -= 10) K.box(-10, cz + dz, 48, 1.0, 1.0, HR, { y: 14.4, collide: false }); // vault ribs
      for (let dz = 22; dz > -24; dz -= 10) for (const s of [-1, 1]) { // green slit windows
        K.box(-10 + s * 24.1, cz + dz + 5, 0.3, 6, 0.8, GREEN, { y: 6, collide: false, glow: 1.3 });
        K.box(-10 + s * 23.9, cz + dz, 0.9, 16, 1.4, HR, { collide: false });
      }
      for (const [x, dz] of [[-18, 16], [-2, 16], [-18, -12], [-2, -12]]) brazier(K, x, cz + dz, 1.1);
      for (const [x, dz, h] of [[-20, 5, 3], [0, -8, 2.4]]) broken(K, x, cz + dz, h);
      // raised altar at the north end
      K.platform(-10, cz - 24, 20, 10, 2.0, { stairs: ['s'], color: HR2, stairColor: HR, stairW: 8 });
      K.box(-10, cz - 26, 5, 1.3, 2.2, HR, { y: 2.0 });
      K.box(-10, cz - 26, 5.2, 0.15, 2.4, GREEN, { y: 3.3, collide: false, glow: 1.4 });
      brazier(K, -17, cz - 23, 1.2, 2);
      brazier(K, -3, cz - 23, 1.2, 2);
      for (const s of [-1, 1]) boneSpike(K, -10 + s * 6, cz - 28, 8, { y: 2, rz: -s * 0.18, rx: 0 });
      crystals(K, -10, cz - 29.5, 1.6, { y: 2, collide: false, glow: 1.5 });
      pointedArch(K, -10, cz - 30.9, 12, 9.5, { face: 1, fill: CHIT });
      // sealed until the tunnels are cleared
      K.door(-10, -312, 8, 12, 'x', { zone: 2, t: 1.6, color: HR2, trim: GREEN });
      K.box(-10, -312, 8.4, 4, 1.6, HR2, { y: 12 });
      // side galleries 4 m up, stairs from the entrance end (optional firing positions), and a loft beside the door
      K.platform(-31.7, cz + 6, 5, 30, 4.0, { stairs: ['s'], stairW: 3, color: HR2, stairColor: HR });
      K.platform(11.7, cz + 6, 5, 30, 4.0, { stairs: ['s'], stairW: 3, color: HR2, stairColor: HR });
      K.box(-29.35, cz + 6, 0.3, 1.0, 30, HR, { y: 4.0, collide: false });
      K.box(9.35, cz + 6, 0.3, 1.0, 30, HR, { y: 4.0, collide: false });
      for (const dz of [-6, 6, 18]) { K.light(-31.7, 7, cz + dz, GREEN, 4, 16); K.light(11.7, 7, cz + dz, GREEN, 4, 16); }
      K.platform(2, -316, 12, 6, 4.0, { stairs: ['n'], stairW: 4, color: HR2, stairColor: HR });
      K.box(2, -313.2, 12, 1.0, 0.3, HR, { y: 4.0, collide: false });
      brazier(K, 6, -317, 1.0, 4.0);
      K.light(2, 8, -316, GREEN, 5, 20);
      for (const [x, dz] of [[-18, 16], [-2, 16], [-18, -12], [-2, -12]]) K.light(x, 3, cz + dz, GREEN, 4, 14);
      K.light(-10, 12, cz + 6, GREEN, 9, 40);
      K.light(-10, 7, cz - 22, GREEN, 12, 26);

      hiveEdge(K, 45, 0.35, 70);
    },
  },

  // ---------------- M3: raid descent: the Abyss, the Bridge, the Deathsinger's ward, Crota's throne ----------------
  // Rhythm: the Abyss (islands in a pit, stairs between decks) > the Bridge (a real span, arched 6 m over the chasm, fought on the way across)
  // > Deathsinger's Ward (octagonal ritual hall, central altar) > a 44 m kinked tunnel (traversal) > Throne of Crota (round amphitheater, pit ring).
  m3: {
    spawn: [0, 20],
    bounds: [-60, 70, -326, 30],
    zones: [
      { name: 'The Abyss', x: -7, z: -43 },
      { name: 'The Bridge', x: 0, z: -118 },
      { name: "Deathsinger's Ward", x: 0, z: -182 },
      { name: 'Throne of Crota', x: 22, z: -286, boss: true, room: { minX: 0, maxX: 60, minZ: -300, maxZ: -240 } },
    ],
    noEdge: true,
    // a void storm: black-green cloud banks, restless aurora, Hive spires on the horizon
    sky: {
      clouds: { n: 22, color: 0x0c2a1a, opacity: 0.85, y: [60, 170], size: 34 },
      aurora: [{ color: 0x3cff8c, y: 140, r: 520, h: 200, arc: [0, TAU], opacity: 0.4, waves: 6 }, { color: 0x1affc8, y: 220, r: 560, h: 120, arc: [0.5, 3.2], opacity: 0.25, waves: 4 }],
      stars: { n: 80, color: 0xcfffe0, size: 2, min: 0.5 },
    },
    // the Bridge is a real arch: it climbs from the Abyss door to 6 m over the chasm and comes down at the Ward
    terrain: [
      { type: 'plateau', x: -11, z: -14, w: 14, d: 12, h: 1.6, edge: 1.5 },                  // Abyss island B
      { type: 'plateau', x: 24, z: -45, w: 12, d: 14, h: 2.4, edge: 1.5 },                   // Abyss sniper nest
      { type: 'plateau', x: 0, z: -118, w: 44, d: 40, h: 6, edge: 4 },                       // Bridge midspan
      { type: 'ramp', x0: -11, z0: 6, x1: -11, z1: -8, width: 6, h0: 0, h1: 1.6, edge: 1.5 },    // walkway up to B
      { type: 'ramp', x0: -7, z0: -20, x1: -7, z1: -34, width: 6, h0: 1.6, h1: 0, edge: 1.5 },   // walkway down to the fight island
      { type: 'ramp', x0: 6, z0: -45, x1: 18, z1: -45, width: 6, h0: 0, h1: 2.4, edge: 1.5 },    // walkway up to the nest
      { type: 'ramp', x0: 0, z0: -78, x1: 0, z1: -100, width: 20, h0: 0, h1: 6, edge: 4 },
      { type: 'ramp', x0: 0, z0: -136, x1: 0, z1: -166, width: 20, h0: 6, h1: 0, edge: 4 },
    ],
    build(K) {
      // ---- The Abyss: a pitch-dark roofed cavern; islands on bone walkways across a pit, decks at different heights ----
      K.room(0, -21, 80, 102, 12, { t: 2, doors: { n: 16 }, roof: true, color: HR2, roofColor: 0x2a2c30 });
      const walk = [ // [x0, x1, z0, z1] of everything a Guardian can stand on (even numbers, for the pit grid)
        [-14, 14, 6, 30],     // A  the arrival island
        [-14, -8, -8, 6],     // W1 walkway (a ramp up to B)
        [-18, -4, -20, -8],   // B  raised island (1.6 m)
        [-10, -4, -34, -20],  // W2 walkway (a ramp down to C)
        [-20, 6, -52, -34],   // C  the fight island
        [6, 18, -48, -42],    // walkway east (a ramp up to the nest)
        [18, 30, -52, -38],   // E  sniper nest (2.4 m)
        [-10, -4, -58, -52],  // W3 walkway
        [-14, 14, -72, -58],  // D  the exit island
      ];
      for (const s of pitStrips(-40, 40, -72, 30, walk)) {
        const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
        K.collider(s.x0, -3, s.z0, s.x1, 12, s.z1, null);                                   // the pit: nothing walks, spawns or jumps into it
        K.box(cx, cz, s.x1 - s.x0, 0.3, s.z1 - s.z0, VOID, { collide: false });
      }
      const slab = (x, z, w, d) => K.box(x, z, w, 0.34, d, 0x54575c, { collide: false });
      slab(0, 18, 28, 24); slab(-7, -43, 26, 18); slab(0, -65, 28, 14); slab(-7, -55, 6, 6);
      slab(-11, -14, 14, 12); slab(24, -45, 12, 14);
      // bone planks on the walkways (they follow the slope in short runs) and low rails on the ramps
      for (let z = 5; z > -8; z -= 2) K.box(-11, z, 6.2, 0.1, 0.3, BONE, { y: 0.02, collide: false });
      for (let z = -21; z > -34; z -= 2) K.box(-7, z, 6.2, 0.1, 0.3, BONE, { y: 0.02, collide: false });
      for (let x = 7; x < 18; x += 2) K.box(x, -45, 0.3, 0.1, 6.2, BONE, { y: 0.02, collide: false });
      for (let z = -53; z > -58; z -= 2) K.box(-7, z, 6.2, 0.1, 0.3, BONE, { y: 0.02, collide: false });
      // lit lamp columns, one cover piece per island
      for (const [x, z] of [[-12, 26], [12, 26], [0, 8]]) lamp(K, x, z);
      for (const [x, z] of [[-17, -19], [-5, -9]]) lamp(K, x, z, 3);
      for (const [x, z] of [[-18, -36], [4, -49], [-18, -50]]) lamp(K, x, z);
      for (const [x, z] of [[28, -50], [20, -39]]) lamp(K, x, z, 3);
      for (const [x, z] of [[-12, -61], [12, -61]]) lamp(K, x, z);
      for (const [x, z, h] of [[-8, 18, 3], [10, 24, 2.4], [-14, -45, 3], [2, -38, 5], [-8, -49, 2.4], [-8, -66, 3.5], [10, -62, 2.4]]) broken(K, x, z, h);
      K.box(-12, -14, 2, 2.2, 2, HR);
      K.box(26, -49, 2, 2.4, 2, HR);
      // stalagmites at the walls, a giant stalactite cluster over the middle of the pit, a few more hanging at the edges
      for (const [x, z, r, h] of [[-30, 12, 2, 6], [28, 6, 2.4, 8], [30, -30, 2, 5], [-33, -50, 2.6, 7], [24, -64, 1.8, 5], [-28, -64, 2, 6], [34, -10, 1.6, 4]]) K.cone(x, z, r, h, K.C.rock2, { sides: 5 });
      for (const [x, z, h, w] of [[-4, -24, 9, 1.6], [2, -28, 7, 1.3], [-9, -22, 6, 1.1], [8, -22, 5.5, 1.0], [0, -18, 4, 0.9], [-12, -29, 4.5, 0.9], [5, -31, 6.5, 1.2]]) {
        K.mesh(spikeGeo(), K.C.rock2, x, 12 - h / 2, z, { scale: [w, h, w], rx: Math.PI });
      }
      for (const [x, z, h] of [[-34, 20, 2.5], [33, 14, 3], [-35, -20, 2.2], [36, -28, 2.8], [-34, -62, 3], [32, -66, 2.4]]) K.mesh(spikeGeo(), K.C.rock2, x, 12 - h / 2, z, { scale: [h * 0.35, h, h * 0.35], rx: Math.PI });
      for (const s of [-1, 1]) K.box(s * 8.8, -71, 1.4, 12, 1.4, HR, { collide: false });
      K.box(0, -71, 18, 2, 1.6, HR, { y: 10, collide: false });
      for (const s of [-1, 1]) K.box(s * 8.4, -70.1, 0.35, 10, 0.35, GREEN, { collide: false, glow: 1.6 });
      K.door(0, -72, 16, 10, 'x', { zone: 0, t: 2, color: HR2, trim: GREEN }); // sealed until the Abyss is cleared
      K.light(-7, 8, -43, GREEN, 6, 28);
      K.light(0, 6, -66, GREEN, 6, 22);
      K.light(0, 7, 14, GREEN, 5, 24);
      K.light(-11, 5, -14, GREEN, 4, 18);
      K.light(24, 7, -45, GREEN, 5, 20);

      // ---- The Bridge: a long arched span across the chasm, widening at midspan ----
      const voids = [
        [-60, -10, -96, -72], [-60, -22, -140, -96], [-60, -10, -172, -140],
        [10, 70, -96, -72], [22, 70, -140, -96], [10, 70, -172, -140],
      ];
      for (const [x1, x2, z1, z2] of voids) {
        K.collider(x1, -2, z1, x2, 16, z2, null);                                // nothing walks, spawns or leaves the span (an unseen wall at the chasm's edge)
        K.box((x1 + x2) / 2, (z1 + z2) / 2, x2 - x1, 0.3, z2 - z1, VOID, { collide: false });
      }
      for (let z = -80; z > -168; z -= 6) K.box(0, z, 20, 0.2, 0.35, HR2, { collide: false }); // deck seams (they sit in the slope's skin)
      K.mesh(flat(new THREE.RingGeometry(6.2, 6.8, 24)), GREEN, 0, 0.1, -118, { glow: 0.8 });
      // parapets with bone spikes, following the slope in short pieces
      for (const s of [-1, 1]) {
        along(s * 10.5, -78, s * 10.5, -98, 3.4, (x, z) => K.box(x, z, 0.6, 1.0, 3.6, HR, { collide: false }));
        along(s * 10.5, -138, s * 10.5, -166, 3.4, (x, z) => K.box(x, z, 0.6, 1.0, 3.6, HR, { collide: false }));
        along(s * 22.5, -98, s * 22.5, -138, 3.4, (x, z) => K.box(x, z, 0.6, 1.0, 3.6, HR, { collide: false }));
        K.box(s * 16.3, -98, 12.6, 1.0, 0.6, HR, { collide: false });
        K.box(s * 16.3, -138, 12.6, 1.0, 0.6, HR, { collide: false });
        for (let z = -80; z > -165; z -= 7) { const x = z < -98 && z > -138 ? s * 22.5 : s * 10.5; boneSpike(K, x, z, 1.8, { y: 1.0, rz: s * 0.35, rx: 0 }); }
        spire(K, s * 23, -96, 1.4, 16, { pinnacles: false });
        spire(K, s * 23, -140, 1.4, 16, { pinnacles: false });
      }
      // the chasm: towering spires rising out of the dark either side (they stand on the chasm floor, far below the span)
      for (const [x, z, r, h] of [[-34, -80, 3, 40], [-46, -110, 4, 50], [-36, -156, 3, 42], [-52, -136, 2.6, 34], [38, -84, 3, 42], [50, -118, 4.2, 52], [40, -158, 3, 40], [60, -96, 2.6, 36]]) spire(K, x, z, r, h, { collide: false });
      // a cross-gate arch on the way down, roofless
      for (const s of [-1, 1]) { K.box(s * 10.8, -152, 1.8, 14, 1.8, HR); K.box(s * 10.8, -152, 2.4, 0.8, 2.4, HR2, { y: 14, collide: false }); }
      K.box(0, -152, 25.5, 1.4, 1.8, HR, { y: 14, collide: false });
      pointedArch(K, 0, -152.2, 16, 15, { fill: VOID });
      // cover on the span
      for (const [x, z, h] of [[-9, -108, 3], [10, -110, 5], [-15, -125, 2.4], [15, -128, 3.5], [0, -133, 2.2], [-4, -88, 2.4], [5, -148, 3]]) broken(K, x, z, h);
      K.box(-6, -122, 1, 1.4, 5, HR2);
      K.box(7, -118, 1, 1.4, 4, HR2);
      for (const s of [-1, 1]) { K.light(s * 23, 14, -96, GREEN, 6, 28); K.light(s * 23, 14, -140, GREEN, 6, 28); }
      K.light(0, 6, -118, GREEN, 7, 30);
      K.light(0, 6, -88, GREEN, 5, 22);
      K.light(0, 6, -156, GREEN, 5, 22);

      // ---- Deathsinger's Ward: an octagonal ritual hall round a crystal altar ----
      const wc = [0, -194], A = 22, WT = 1.4, WH = 11;
      const wseg = (k, gapW = 0, gapOff = 0) => {
        const a = k * Math.PI / 4, dx = Math.cos(a), dz = Math.sin(a), tx = -dz, tz = dx, len = 2 * A * Math.tan(Math.PI / 8) + WT;
        let pieces = [[-len / 2, len / 2]];
        if (gapW) pieces = [[-len / 2, gapOff - gapW / 2], [gapOff + gapW / 2, len / 2]].filter(([p, q]) => q - p > 0.2);
        for (const [p, q] of pieces) { const m = (p + q) / 2; K.obox(wc[0] + dx * A + tx * m, wc[1] + dz * A + tz * m, q - p, WH, WT, -a - Math.PI / 2, HR2); }
      };
      for (let k = 0; k < 8; k++) wseg(k, k === 2 ? 12 : k === 6 ? 9 : 0, k === 6 ? 5 : 0);
      for (const k of [1, 3, 5, 7]) { // solid rock fills the corners outside the diagonal walls
        const a = k * Math.PI / 4, d = A + WT / 2 + 4.1;
        K.obox(wc[0] + Math.cos(a) * d, wc[1] + Math.sin(a) * d, 2 * A * Math.tan(Math.PI / 8) + 1.6, WH, 8.2, -a - Math.PI / 2, HR2);
      }
      K.cyl(wc[0], wc[1], A / Math.cos(Math.PI / 8) + 0.8, 0.6, CHIT, { sides: 8, y: WH, collide: false, ry: Math.PI / 8 });
      K.collider(-24, WH, -218, 24, WH + 0.6, -170, null);
      K.door(0, -172, 12, 11, 'x', { zone: 1, t: 1.4, color: HR2, trim: WARD }); // sealed until the Bridge is cleared
      // the altar: a raised crystal dais, stair east and west, a shaft of light to the roof
      K.platform(0, -194, 10, 10, 1.2, { stairs: ['e', 'w'], stairW: 5, color: HR2, stairColor: HR });
      crystals(K, 0, -194, 1.5, { y: 1.2, color: WARD, n: 6, glow: 1.5, collide: false });
      K.box(0, -194, 0.7, 8.4, 0.7, WARD, { y: 2.6, collide: false, glow: 1.4 });
      K.mesh(new THREE.TorusGeometry(5.5, 0.3, 4, 24), WARD, 0, 10.6, -194, { rx: Math.PI / 2, glow: 1.2 });
      K.mesh(flat(new THREE.RingGeometry(7.4, 8.0, 32)), WARD, 0, 0.3, -194, { glow: 1.0 });
      K.mesh(flat(new THREE.RingGeometry(11.4, 11.8, 32)), WARD, 0, 0.3, -194, { glow: 0.6 });
      // a second tier: a 3.6 m ledge along the north wall, a stair up from the south
      K.platform(-6, -211, 10, 4, 3.6, { stairs: ['s'], stairW: 4, color: HR2, stairColor: HR });
      K.box(-6, -209.2, 10, 1.0, 0.3, HR, { y: 3.6, collide: false });
      crystals(K, -6, -212, 1.0, { y: 3.6, color: WARD, n: 3, glow: 1.4, collide: false });
      // two crystal-lit alcoves for cover, uneven
      for (const [x, z, sz, n] of [[-15, -181, 2.0, 5], [-17, -203, 1.2, 3], [16, -183, 1.5, 4], [15, -205, 2.2, 6], [12, -175, 0.9, 3]]) crystals(K, x, z, sz, { color: WARD, n, glow: 1.4 });
      for (const [x, z, sz] of [[-8, -179, 1.5], [9, -209, 1.4], [-14, -194, 1.3]]) crystals(K, x, z, sz, { color: WARD, n: 3, glow: 1.4 });
      for (const s of [-1, 1]) for (let dz = -7; dz <= 7; dz += 7) K.box(s * 21.4, wc[1] + dz, 0.8, 10.6, 0.9, HR, { collide: false });
      K.light(0, 9, -186, WARD, 8, 30);
      K.light(0, 9, -202, WARD, 8, 30);
      K.light(0, 3, -194, WARD, 7, 22);
      for (const [x, z] of [[-15, -181], [16, -183], [15, -205], [-17, -203]]) K.light(x, 4, z, WARD, 4, 16);
      // tunnel to the throne: 44 m with two bends
      tunnelPath(K, [[5, -216], [5, -228], [30, -228], [30, -239]], { w: 8 });

      // ---- Throne of Crota: a round amphitheater, the pit ring in the middle, Crota's dais across it ----
      const tc = [30, -270], TR = 30;
      for (let k = 0; k < 24; k++) {
        if (k === 6) continue; // the south door
        const a = k * TAU / 24;
        K.obox(tc[0] + Math.cos(a) * TR, tc[1] + Math.sin(a) * TR, 8.4, 18, 1.8, -a - Math.PI / 2, HR2);
      }
      K.cyl(tc[0], tc[1], TR + 1.2, 0.6, CHIT, { sides: 24, y: 18, collide: false });
      K.collider(-1, 18, -301, 61, 18.6, -239, null);
      K.door(30, -240, 9, 12, 'x', { zone: 2, t: 2, color: HR2, trim: GREEN }); // sealed until the Ward is cleared
      K.box(30, -240, 9.4, 6, 2, HR2, { y: 12 });
      K.light(30, 6, -231, GREEN, 5, 18);
      // eight buttress columns round the wall
      for (let k = 0; k < 8; k++) {
        const a = (k + 0.5) * TAU / 8, x = tc[0] + Math.cos(a) * 27, z = tc[1] + Math.sin(a) * 27;
        K.box(x, z, 2.6, 18, 2.6, HR);
        K.box(x, z, 3.6, 1.2, 3.6, HR2, { collide: false });
        boneSpike(K, x - Math.cos(a) * 1.6, z - Math.sin(a) * 1.6, 3, { y: 15, rx: 0, rz: 0 });
      }
      for (let r = 6; r <= 28; r += 11) K.mesh(new THREE.TorusGeometry(r, 0.5, 4, 36), HR, tc[0], 16.6, tc[1], { rx: Math.PI / 2 }); // vault rings
      // the pit ring: a void in the floor, bone teeth round its lip
      const pr = 9, pz = -257;
      K.mesh(flat(new THREE.CircleGeometry(pr - 1.6, 32)), VOID, tc[0], 0.3, pz);
      K.mesh(flat(new THREE.RingGeometry(pr - 1.6, pr + 1.2, 36)), HR2, tc[0], 0.26, pz);
      K.mesh(flat(new THREE.RingGeometry(pr - 3.4, pr - 3.0, 32)), GREEN, tc[0], 0.31, pz, { glow: 0.8 });
      K.mesh(flat(new THREE.RingGeometry(3.4, 3.8, 24)), GREEN, tc[0], 0.31, pz, { glow: 0.8 });
      for (let dz = -9; dz <= 9; dz += 3) {
        const hw = Math.sqrt(Math.max(0, (pr + 0.5) ** 2 - Math.max(0, Math.abs(dz) - 1.5) ** 2));
        K.collider(tc[0] - hw, 0, pz + dz - 1.5, tc[0] + hw, 12, pz + dz + 1.5, null);
      }
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * TAU, x = tc[0] + Math.sin(a) * (pr + 0.6), z = pz + Math.cos(a) * (pr + 0.6);
        K.mesh(new THREE.BoxGeometry(2.6, 1.0, 1.0), HR, x, 0.5, z, { ry: a });
        if (k % 2 === 0) K.mesh(spikeGeo(), BONE, x, 1.8, z, { scale: [0.4, 2.6, 0.4], rx: Math.cos(a) * 0.4, rz: -Math.sin(a) * 0.4 });
      }
      // the orb over the pit, on chains
      K.mesh(new THREE.IcosahedronGeometry(4.5, 1), GREEN, tc[0], 11.5, pz, { glow: 1.8 });
      K.mesh(new THREE.TorusGeometry(6.5, 0.3, 4, 24), HR, tc[0], 11.5, pz, { rx: Math.PI / 2 + 0.25 });
      for (const [dx, dz] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) K.box(tc[0] + dx, pz + dz, 0.25, 4, 0.25, CHIT, { y: 14.2, collide: false });
      // six sword spires on the outer ring
      for (let k = 0; k < 6; k++) {
        const a = k * TAU / 6 + 0.5, x = tc[0] + Math.cos(a) * 21.5, z = tc[1] + Math.sin(a) * 21.5;
        K.box(x, z, 1.0, 2.6, 1.0, HR2);
        K.box(x, z, 3.4, 0.5, 0.7, HR, { y: 2.6, collide: false });
        K.mesh(spikeGeo(), BONE, x, 2.9 + 5.5, z, { scale: [0.55, 11, 0.4], ry: -a });
        K.light(x, 5, z, GREEN, 3, 14);
      }
      // Crota's dais across the pit: two stepped tiers, the throne, two spires
      K.platform(30, -293, 20, 8, 1.2, { stairs: ['s'], stairW: 10, color: HR2, stairColor: HR });
      K.platform(30, -295.5, 12, 5, 1.2, { y: 1.2, stairs: ['s'], stairW: 6, color: HR, stairColor: HR2 });
      K.box(30, -296, 4, 1.2, 3, HR2, { y: 2.4 });
      K.box(30, -297.8, 4.4, 8, 1, HR2, { y: 2.4 });
      for (const dx of [-1.8, 0, 1.8]) K.mesh(spikeGeo(), BONE, 30 + dx, 11.4 + (dx ? 0 : 1), -297.8, { scale: [0.5, dx ? 3 : 4.2, 0.5] });
      K.mesh(crystalGeo(), GREEN, 30, 8, -297.2, { scale: [0.6, 1.1, 0.3], glow: 2 });
      spire(K, 20, -296, 1.8, 16, { pinnacles: false, y: 0 });
      spire(K, 40, -296, 1.8, 16, { pinnacles: false });
      brazier(K, 21, -289, 1.3, 1.2);
      brazier(K, 39, -289, 1.3, 1.2);
      // cover on the outer ring
      for (const [x, z, h] of [[14, -258, 5], [48, -256, 3], [11, -280, 6], [50, -282, 2.6], [22, -246, 2.4], [40, -248, 3.5]]) broken(K, x, z, h);
      crystals(K, 6, -250, 1.2);
      crystals(K, 54, -252, 1.2);
      // one broken ring ledge on the west arc, 4 m up, a stair from the south
      K.platform(8, -259, 5, 10, 4.0, { stairs: ['s'], stairW: 3, color: HR2, stairColor: HR });
      K.platform(6.6, -269, 5, 10, 4.0, { color: HR2 });
      K.platform(7.6, -279, 5, 10, 4.0, { color: HR2 });
      K.box(10.3, -269, 0.3, 1.0, 30, HR, { y: 4.0, collide: false });
      for (const z of [-259, -269, -279]) K.light(7, 7, z, GREEN, 4, 16);
      K.light(30, 10, -262, GREEN, 14, 50);
      K.light(30, 6, -290, GREEN, 8, 24);
      K.light(14, 5, -250, GREEN, 5, 20);
      K.light(46, 5, -250, GREEN, 5, 20);

      hiveEdge(K, 50, 0.5, 70);
    },
  },
};
