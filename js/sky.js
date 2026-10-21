// Skies (U16e): a data-driven sky per destination, with a per-mission override (SKIES / MISSION_SKIES below). buildSky() turns a spec into a
// group that follows the player (so it never parallaxes, like a real sky): a gradient dome, stars, bodies (planets, moons, suns), distant
// ridge and skyline silhouettes, haze, clouds, aurora ribbons and floating rocks / spires / ships. Everything is flat-shaded low poly.
//
// spec = {
//   zenith, mid, horizon, floor,           // dome colours (horizon defaults to the level's fog colour so distant ground fades into it)
//   fog,                                   // optional: recolour the level fog and background
//   stars: { n, color, size, min },        // min = lowest elevation they reach (0 = horizon)
//   bodies: [{ color, size, pos: [x, y, z], ring, bands, patches, glow }],
//   ridges: [{ r, h: [lo, hi], color, haze, steps, y0 }],                  // silhouette bands around the horizon
//   skyline: [{ kind: 'spire'|'tower'|'dome'|'rig'|'block', n, r: [lo, hi], h: [lo, hi], w: [lo, hi], color, haze }],
//   haze: [{ color, opacity, r, h, y }],   // soft bands, bottom opaque -> top clear
//   clouds: { n, color, opacity, y: [lo, hi], size },
//   aurora: [{ color, y, r, h, arc: [a0, a1], opacity, waves }],
//   floaters: [{ kind: 'rock'|'island'|'spire'|'ship', n, r: [lo, hi], y: [lo, hi], size: [lo, hi], color, glow }],
// }
import * as THREE from 'three';
import { mulberry32, hashStr } from './util.js';

const TAU = Math.PI * 2;
const R_DOME = 850;
const col = (h) => new THREE.Color(h);

// ---------------------------------------------------------------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------------------------------------------------------------
const SKIES = {
  earth: {
    zenith: 0x4a86c8, mid: 0x9fc4e0, horizon: 0xe9d3b4, floor: 0x7a7060,
    bodies: [{ color: 0xfff3d0, size: 16, pos: [-380, 90, -500], glow: 0xffe6a8 }],
    ridges: [{ r: 640, h: [40, 110], color: 0x6f86a0, haze: 0.45, steps: 70 }, { r: 560, h: [25, 70], color: 0x566c58, haze: 0.3, steps: 84 }],
    clouds: { n: 14, color: 0xffffff, opacity: 0.8, y: [90, 190], size: 18 },
  },
  moon: {
    zenith: 0x010207, mid: 0x04060c, horizon: 0x0a0e16, floor: 0x15181d,
    stars: { n: 900, color: 0xdfe8ff, size: 2.2, min: 0 },
    bodies: [{ color: 0x2f6fc4, size: 70, pos: [260, 170, -520], glow: 0x6fb0ff, patches: [0x2f6fc4, 0x2f6fc4, 0x3f8a58, 0xdfe8f2] }],
    ridges: [{ r: 600, h: [15, 55], color: 0x2c3036, haze: 0.35, steps: 90 }, { r: 520, h: [8, 28], color: 0x3a3e45, haze: 0.2, steps: 110 }],
  },
  mars: {
    zenith: 0x9a6a56, mid: 0xd19468, horizon: 0xe0b27e, floor: 0x9a5a38,
    bodies: [{ color: 0xd8c8b0, size: 14, pos: [-260, 150, -460] }, { color: 0xb8a898, size: 8, pos: [340, 210, -380] }],
    ridges: [{ r: 640, h: [50, 130], color: 0x8a4a30, haze: 0.5, steps: 64 }, { r: 540, h: [20, 60], color: 0x70392a, haze: 0.3, steps: 84 }],
    haze: [{ color: 0xe0a070, opacity: 0.5, r: 480, h: 70, y: -10 }],
  },
  titan: {
    zenith: 0x41584a, mid: 0x82926a, horizon: 0xb8a468, floor: 0x3f4a44,
    bodies: [{ color: 0xe0c89a, size: 110, pos: [320, 190, -520], ring: true, bands: [0xe0c89a, 0xd0b07a, 0xe8d6aa, 0xc89e68] }],
    ridges: [{ r: 600, h: [20, 60], color: 0x4a5a50, haze: 0.5, steps: 70 }],
    skyline: [{ kind: 'rig', n: 9, r: [430, 600], h: [40, 90], w: [10, 20], color: 0x56635b, haze: 0.5 }],
    haze: [{ color: 0xa9a56a, opacity: 0.55, r: 470, h: 120, y: -10 }],
  },
  tangled: {
    zenith: 0x1d1830, mid: 0x4a3a62, horizon: 0x9a6a78, floor: 0x241c2c,
    stars: { n: 260, color: 0xf0e0ff, size: 2, min: 0.15 },
    bodies: [{ color: 0xe8d4b0, size: 90, pos: [-280, 170, -480], ring: true, bands: [0xe8d4b0, 0xc8aa80, 0xf0e0c0] }],
    floaters: [{ kind: 'island', n: 12, r: [330, 640], y: [20, 190], size: [18, 60], color: 0x3a3040, haze: 0.4 }],
  },
  io: {
    zenith: 0x4a8a8a, mid: 0x8fc4b4, horizon: 0xd8e4c0, floor: 0x6a7a58,
    bodies: [{ color: 0xe8c890, size: 150, pos: [-330, 200, -540], bands: [0xe8c890, 0xd0784a, 0xf0dcb0, 0xb86a40, 0xe8d2a0] }],
    ridges: [{ r: 620, h: [30, 90], color: 0x6a8a78, haze: 0.5, steps: 66 }],
    haze: [{ color: 0xcfe6d2, opacity: 0.55, r: 470, h: 90, y: -10 }],
  },
  dc: {
    zenith: 0x2f2a5a, mid: 0x6c5aa0, horizon: 0xcdb0d8, floor: 0x3a3258,
    stars: { n: 220, color: 0xf6eaff, size: 2, min: 0.25 },
    ridges: [{ r: 640, h: [40, 110], color: 0x6a5a98, haze: 0.5, steps: 60 }, { r: 540, h: [18, 50], color: 0x58487c, haze: 0.3, steps: 80 }],
    aurora: [{ color: 0x5cffb8, y: 170, r: 560, h: 150, arc: [0.2, 2.6], opacity: 0.55, waves: 3 }, { color: 0xb08cff, y: 200, r: 600, h: 130, arc: [2.9, 5.4], opacity: 0.4, waves: 4 }],
    floaters: [{ kind: 'spire', n: 9, r: [360, 640], y: [60, 230], size: [14, 34], color: 0xe4dcf0, glow: 0x9fe8ff, haze: 0.25 }],
  },
  leviathan: {
    zenith: 0x120e08, mid: 0x2a2012, horizon: 0x5a4424, floor: 0x1a140a,
    stars: { n: 380, color: 0xfff0d0, size: 2, min: 0.1 },
    bodies: [{ color: 0xd8a64a, size: 90, pos: [-300, 180, -440], glow: 0xffd070 }],
  },
};

// Per-mission skies: each is merged over its destination's sky (arrays replace, keys not named are inherited).
const MISSION_SKIES = {
  // Earth: dawn on the steppe, a clear noon over the Array, a bruised dusk over the Devils' Lair
  e1: { zenith: 0x5f8fc0, mid: 0xe0b890, horizon: 0xf6c8a0, bodies: [{ color: 0xfff0c0, size: 22, pos: [-420, 38, -520], glow: 0xffd8a0 }], clouds: { n: 12, color: 0xffd8c0, opacity: 0.7, y: [60, 120], size: 20 } },
  e2: { zenith: 0x2f78c8, mid: 0x78b4e4, horizon: 0xd6e8f2, bodies: [{ color: 0xffffff, size: 14, pos: [120, 330, -300], glow: 0xfff6d8 }], skyline: [{ kind: 'tower', n: 7, r: [450, 620], h: [50, 110], w: [8, 14], color: 0x7a8aa0, haze: 0.5 }] },
  e3: { zenith: 0x2a1c3c, mid: 0x7a4a62, horizon: 0xe08a58, bodies: [{ color: 0xff9a50, size: 26, pos: [-400, 28, -460], glow: 0xff7a30 }], ridges: [{ r: 640, h: [60, 140], color: 0x3a2c40, haze: 0.4, steps: 60 }, { r: 540, h: [30, 80], color: 0x2c2230, haze: 0.2, steps: 80 }], clouds: { n: 16, color: 0x6a4458, opacity: 0.8, y: [50, 130], size: 24 }, skyline: [{ kind: 'tower', n: 6, r: [440, 600], h: [40, 90], w: [8, 12], color: 0x2c2230, haze: 0.2 }] },
  // Moon: the Dark Beyond (Earth huge and low), Chamber of Night (Hive glow, spires on the horizon), Crota's End (green void)
  m1: { bodies: [{ color: 0x2f6fc4, size: 120, pos: [180, 120, -480], glow: 0x6fb0ff, patches: [0x2f6fc4, 0x2f6fc4, 0x3f8a58, 0xdfe8f2] }] },
  m2: { zenith: 0x020806, mid: 0x061410, horizon: 0x0f2a20, fog: 0x0c1c18, stars: { n: 420, color: 0xbfffe0, size: 2, min: 0.05 }, bodies: [{ color: 0x24508a, size: 36, pos: [300, 230, -520], glow: 0x58a0e0, patches: [0x24508a, 0x24508a, 0x2f6a48, 0xb8d0e0] }], skyline: [{ kind: 'spire', n: 16, r: [420, 620], h: [60, 190], w: [10, 22], color: 0x0c1a16, haze: 0.2 }], haze: [{ color: 0x3aff9a, opacity: 0.22, r: 480, h: 60, y: -6 }] },
  m3: { zenith: 0x020a06, mid: 0x0a2418, horizon: 0x1a5a36, fog: 0x0f2a1c, stars: { n: 120, color: 0xcfffe0, size: 2, min: 0.4 }, bodies: [], aurora: [{ color: 0x3cff8c, y: 150, r: 520, h: 190, arc: [0, TAU], opacity: 0.4, waves: 5 }], skyline: [{ kind: 'spire', n: 22, r: [400, 600], h: [80, 240], w: [12, 26], color: 0x081a10, haze: 0.15 }] },
  // Mars: butterscotch day with two moons and the buried towers; a red dusk with Cabal drop ships; the storm of the Red War
  r1: { skyline: [{ kind: 'tower', n: 12, r: [440, 620], h: [50, 150], w: [12, 24], color: 0x9a6a50, haze: 0.5 }] },
  r2: { zenith: 0x4a2a44, mid: 0xb2603f, horizon: 0xf0a060, bodies: [{ color: 0xffb070, size: 30, pos: [-380, 42, -480], glow: 0xff8a40 }, { color: 0xb8a898, size: 7, pos: [330, 220, -380] }], floaters: [{ kind: 'ship', n: 6, r: [380, 620], y: [50, 160], size: [14, 26], color: 0x3a2420, haze: 0.3 }] },
  r3: { zenith: 0x2a1a1a, mid: 0x6a3a30, horizon: 0xb85a3a, bodies: [], haze: [{ color: 0xc06a40, opacity: 0.65, r: 470, h: 150, y: -10 }], floaters: [{ kind: 'ship', n: 1, r: [440, 460], y: [180, 200], size: [90, 90], color: 0x241616, haze: 0.2 }, { kind: 'ship', n: 8, r: [380, 640], y: [60, 190], size: [14, 28], color: 0x2c1c1a, haze: 0.3 }], clouds: { n: 14, color: 0x4a2a26, opacity: 0.85, y: [70, 170], size: 26 } },
  // Dreaming City: the Mists at dusk, the Spine at noon, the Wishing Chamber in storm
  dc1: { zenith: 0x3a2e58, mid: 0x7a62a0, horizon: 0xc8b0d0, fog: 0xa898c8, haze: [{ color: 0xd8c8e8, opacity: 0.5, r: 470, h: 110, y: -10 }] },
  dc2: { zenith: 0x2a70b8, mid: 0x7ac0e0, horizon: 0xe0f0f0, aurora: [{ color: 0x7affd0, y: 220, r: 600, h: 120, arc: [0.5, 2.2], opacity: 0.28, waves: 3 }], clouds: { n: 12, color: 0xffffff, opacity: 0.75, y: [110, 200], size: 20 } },
  dc3: { zenith: 0x120e24, mid: 0x3a2a60, horizon: 0x7a5aa0, stars: { n: 60, color: 0xe8d8ff, size: 2, min: 0.5 }, aurora: [{ color: 0xa05aff, y: 160, r: 540, h: 200, arc: [0, TAU], opacity: 0.45, waves: 6 }], floaters: [{ kind: 'spire', n: 14, r: [340, 600], y: [50, 250], size: [18, 42], color: 0x9a8cb8, glow: 0xb08cff, haze: 0.2 }] },
};

export function skyFor(loc, def) {
  const base = SKIES[loc.id];
  if (!base) return null;
  return { ...base, ...(MISSION_SKIES[def.id] || {}) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------------------------------------------
const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, fog: false, ...o });
const shaded = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, fog: false, ...o });
const hazed = (hex, horizon, k) => col(hex).lerp(col(horizon), k ?? 0);

function dome(spec) {
  const geo = new THREE.SphereGeometry(R_DOME, 32, 18), pos = geo.attributes.position, cs = new Float32Array(pos.count * 3);
  const zen = col(spec.zenith), mid = col(spec.mid ?? spec.zenith), hor = col(spec.horizon), flo = col(spec.floor ?? spec.horizon), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / R_DOME;
    if (t < 0) c.lerpColors(hor, flo, Math.min(1, -t * 6));
    else if (t < 0.3) c.lerpColors(hor, mid, t / 0.3);
    else c.lerpColors(mid, zen, Math.min(1, (t - 0.3) / 0.6));
    cs[i * 3] = c.r; cs[i * 3 + 1] = c.g; cs[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cs, 3));
  const m = new THREE.Mesh(geo, basic(0xffffff, { vertexColors: true, side: THREE.BackSide, depthWrite: false }));
  m.renderOrder = -10;
  return m;
}

function stars(spec, rng) {
  const s = spec.stars, n = s.n, p = new Float32Array(n * 3), c = new Float32Array(n * 3), base = col(s.color), t = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const el = Math.asin(s.min + rng() * (1 - s.min)), az = rng() * TAU, r = R_DOME * 0.96;
    p[i * 3] = Math.cos(el) * Math.cos(az) * r; p[i * 3 + 1] = Math.sin(el) * r; p[i * 3 + 2] = Math.cos(el) * Math.sin(az) * r;
    t.copy(base).multiplyScalar(0.45 + rng() * 0.55);
    c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: s.size, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
  pts.renderOrder = -9;
  return pts;
}

function body(b, rng) {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(b.size, 2), palette = b.bands || b.patches, seed = rng() * 10;
  let m;
  if (palette) {
    // one colour per facet: bands run along y with a little wobble, patches are blobs made of a few sines
    const flatGeo = geo.toNonIndexed(), pp = flatGeo.attributes.position, fc = new Float32Array(pp.count * 3), v = new THREE.Vector3(), t = new THREE.Vector3();
    for (let i = 0; i < pp.count; i += 3) {
      v.set(0, 0, 0);
      for (let j = 0; j < 3; j++) v.add(t.fromBufferAttribute(pp, i + j));
      v.divideScalar(3 * b.size);
      const k = b.bands ? v.y * 0.5 + 0.5 + 0.05 * Math.sin(v.x * 7 + seed) : 0.5 + 0.5 * Math.sin(v.x * 4.1 + seed) * Math.sin(v.y * 3.3 + 1.7) * Math.sin(v.z * 3.7 + 0.4) + 0.25 * Math.sin(v.x * 9 - v.z * 7);
      const c = col(palette[Math.min(palette.length - 1, Math.max(0, Math.floor(k * palette.length)))]);
      for (let j = 0; j < 3; j++) { fc[(i + j) * 3] = c.r; fc[(i + j) * 3 + 1] = c.g; fc[(i + j) * 3 + 2] = c.b; }
    }
    flatGeo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
    m = new THREE.Mesh(flatGeo, basic(0xffffff, { vertexColors: true }));
  } else m = new THREE.Mesh(geo, basic(b.color));
  g.add(m);
  if (b.glow) g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(b.size * 1.18, 1), basic(b.glow, { transparent: true, opacity: 0.18, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
  if (b.ring) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(b.size * 1.35, b.size * 2.1, 48), basic(0xd8c49a, { transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
    ring.rotation.set(1.2, 0.3, 0.2);
    g.add(ring);
  }
  g.position.set(...b.pos);
  return g;
}

function ridge(r, spec, rng) {
  const steps = r.steps ?? 72, y0 = r.y0 ?? -30, pos = [], idx = [];
  const phase = [rng() * TAU, rng() * TAU, rng() * TAU];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU, k = 0.5 + 0.25 * Math.sin(a * 3 + phase[0]) + 0.15 * Math.sin(a * 7 + phase[1]) + 0.1 * Math.sin(a * 13 + phase[2]);
    const h = r.h[0] + (r.h[1] - r.h[0]) * Math.max(0, Math.min(1, k * (0.75 + 0.5 * rng()))); // each facet is its own height: a jagged ridge
    pos.push(Math.cos(a) * r.r, y0, Math.sin(a) * r.r, Math.cos(a) * r.r, y0 + h, Math.sin(a) * r.r);
    if (i < steps) { const v = i * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  return new THREE.Mesh(geo, basic(hazed(r.color, spec.horizon, r.haze), { side: THREE.DoubleSide }));
}

const SKYLINE = {
  spire: (w, h) => new THREE.ConeGeometry(w * 0.5, h, 4).translate(0, h / 2, 0),
  tower: (w, h) => new THREE.BoxGeometry(w, h, w).translate(0, h / 2, 0),
  dome: (w, h) => new THREE.SphereGeometry(w, 8, 4, 0, TAU, 0, Math.PI / 2),
  rig: (w, h) => { const g = new THREE.BoxGeometry(w, h * 0.55, w).translate(0, h * 0.7, 0); return g; },
  block: (w, h) => new THREE.BoxGeometry(w * 1.6, h, w).translate(0, h / 2, 0),
};
function skyline(s, spec, rng) {
  const g = new THREE.Group(), m = basic(hazed(s.color, spec.horizon, s.haze));
  for (let i = 0; i < s.n; i++) {
    const a = (i + rng() * 0.7) / s.n * TAU, r = s.r[0] + rng() * (s.r[1] - s.r[0]), h = s.h[0] + rng() * (s.h[1] - s.h[0]), w = s.w[0] + rng() * (s.w[1] - s.w[0]);
    const mesh = new THREE.Mesh(SKYLINE[s.kind](w, h), m);
    mesh.position.set(Math.cos(a) * r, -12, Math.sin(a) * r); mesh.rotation.y = rng() * 3;
    g.add(mesh);
    if (s.kind === 'rig') for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(w * 0.15, h * 0.5, w * 0.15).translate(0, h * 0.25, 0), m); leg.position.set(mesh.position.x + sx * w * 0.35 * Math.cos(mesh.rotation.y), -12, mesh.position.z - sx * w * 0.35 * Math.sin(mesh.rotation.y)); g.add(leg); }
  }
  return g;
}

/** A soft band: opaque at the bottom, clear at the top (vertex alpha), additive for aurora and normal for haze. */
function ribbon(color, r, h, y, o = {}) {
  const arc = o.arc ?? [0, TAU], segs = 48, waves = o.waves ?? 0;
  const geo = new THREE.CylinderGeometry(r, r, h, segs, 6, true, arc[0], arc[1] - arc[0]);
  const pos = geo.attributes.position, cs = new Float32Array(pos.count * 4), c = col(color);
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / h + 0.5; // 0 bottom .. 1 top
    const a = o.aurora ? Math.sin(Math.PI * t) ** 1.5 : 1 - t;
    cs[i * 4] = c.r; cs[i * 4 + 1] = c.g; cs[i * 4 + 2] = c.b; cs[i * 4 + 3] = a;
    if (waves) { const ang = Math.atan2(pos.getZ(i), pos.getX(i)), k = 1 + 0.06 * Math.sin(ang * waves * 3 + t * 4); pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); pos.setY(i, pos.getY(i) + Math.sin(ang * waves) * h * 0.12); }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cs, 4));
  const m = new THREE.Mesh(geo, basic(0xffffff, { vertexColors: true, transparent: true, opacity: o.opacity ?? 0.5, side: THREE.DoubleSide, depthWrite: false, blending: o.aurora ? THREE.AdditiveBlending : THREE.NormalBlending }));
  m.position.y = y;
  return m;
}

function clouds(c, spec, rng) {
  const g = new THREE.Group(), m = basic(c.color, { transparent: true, opacity: c.opacity });
  for (let i = 0; i < c.n; i++) {
    const a = rng() * TAU, r = 380 + rng() * 380, y = c.y[0] + rng() * (c.y[1] - c.y[0]), cl = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(c.size * (0.8 + rng() * 0.9), 0), m);
      p.scale.set(1.8, 0.5, 1); p.position.set((k - 1.5) * c.size * 1.3, rng() * 5, rng() * 12);
      cl.add(p);
    }
    cl.position.set(Math.cos(a) * r, y, Math.sin(a) * r); cl.rotation.y = rng() * 3;
    g.add(cl);
  }
  return g;
}

function floater(f, spec, rng) {
  const g = new THREE.Group(), n = f.n;
  const rock = shaded(hazed(f.color, spec.horizon, f.haze)), top = shaded(hazed(f.top ?? f.color, spec.horizon, (f.haze ?? 0) * 0.8));
  for (let i = 0; i < n; i++) {
    const a = (i + rng() * 0.8) / n * TAU, r = f.r[0] + rng() * (f.r[1] - f.r[0]), y = f.y[0] + rng() * (f.y[1] - f.y[0]), s = f.size[0] + rng() * (f.size[1] - f.size[0]);
    const o = new THREE.Group();
    if (f.kind === 'island') { // a slab of ground on a hanging cone of rock
      o.add(new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.1, 6).rotateX(Math.PI).translate(0, -s * 0.55, 0), rock));
      o.add(new THREE.Mesh(new THREE.CylinderGeometry(s, s, s * 0.14, 6).translate(0, s * 0.07, 0), top));
    } else if (f.kind === 'spire') { // an Awoken spire: slim ivory cone on a floating base, crystal at the tip
      o.add(new THREE.Mesh(new THREE.ConeGeometry(s * 0.22, s * 2.2, 6).translate(0, s * 1.1, 0), rock));
      o.add(new THREE.Mesh(new THREE.ConeGeometry(s * 0.38, s * 0.5, 6).rotateX(Math.PI).translate(0, -s * 0.2, 0), top));
      if (f.glow) o.add(new THREE.Mesh(new THREE.OctahedronGeometry(s * 0.14), basic(f.glow)).translateY(s * 2.3));
    } else if (f.kind === 'ship') { // a Cabal ship: long flat wedge with a prow
      o.add(new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, s * 0.28, s * 0.6), rock));
      o.add(new THREE.Mesh(new THREE.ConeGeometry(s * 0.3, s * 0.7, 4).rotateZ(-Math.PI / 2).translate(s * 1.1, 0, 0), top));
      o.add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.5, s * 0.3, s * 0.3).translate(-s * 0.4, s * 0.25, 0), rock));
    } else o.add(new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0).scale(1, 0.6, 1), rock));
    o.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    o.rotation.y = rng() * 6; o.rotation.z = (rng() - 0.5) * 0.2;
    o.userData = { y, bob: rng() * 6, amp: 1 + rng() * 3 };
    g.add(o);
  }
  return g;
}

/** Build a sky from its spec. Returns { group, update(p, t) }: call update every frame so the sky follows the player. */
export function buildSky(scene, spec, seedKey) {
  const rng = mulberry32(hashStr(`sky:${seedKey}`)), group = new THREE.Group(), moving = [], pulse = [];
  group.add(dome(spec));
  if (spec.stars) group.add(stars(spec, rng));
  for (const b of spec.bodies || []) group.add(body(b, rng));
  for (const r of spec.ridges || []) group.add(ridge(r, spec, rng));
  for (const s of spec.skyline || []) group.add(skyline(s, spec, rng));
  for (const h of spec.haze || []) group.add(ribbon(h.color, h.r, h.h, h.y, { opacity: h.opacity }));
  if (spec.clouds) group.add(clouds(spec.clouds, spec, rng));
  for (const a of spec.aurora || []) { const m = ribbon(a.color, a.r, a.h, a.y, { arc: a.arc, opacity: a.opacity, waves: a.waves, aurora: true }); pulse.push({ m, base: a.opacity ?? 0.5, ph: rng() * 6 }); group.add(m); }
  for (const f of spec.floaters || []) { const fg = floater(f, spec, rng); moving.push(fg); group.add(fg); }
  group.traverse((o) => { o.frustumCulled = false; });
  scene.add(group);
  return {
    group,
    update(p, t = 0) {
      group.position.set(p.x, 0, p.z);
      for (const q of pulse) q.m.material.opacity = q.base * (0.75 + 0.25 * Math.sin(t * 0.5 + q.ph));
      for (const fg of moving) for (const o of fg.children) o.position.y = o.userData.y + Math.sin(t * 0.3 + o.userData.bob) * o.userData.amp;
    },
  };
}
