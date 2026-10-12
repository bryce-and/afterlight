import * as THREE from 'three';
import { ELEMENTS, EXOTIC_WEAPONS } from './data.js';
import { mat } from './world.js';

// Viewmodel guns are authored in "f" coordinates: f = metres forward of the
// pistol grip (model z = -f), y = up from the bore line, x = right.
// Every gun's sight line sits at height S; when aiming, the viewmodel moves to
// (0, -S, -adsDist) so the sight's reticle lands exactly on screen centre,
// which is where hitscan shots go.

const BODY = { common: 0x8b929b, uncommon: 0x5e8a66, rare: 0x56739e, legendary: 0x6e5a8f, exotic: 0xc9a046 };
const DS = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, side: THREE.DoubleSide });
const darkDS = DS(0x23272d);
const lensMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
const retCache = new Map();
function retMat(color, opacity = 1) {
  const k = `${color}|${opacity}`;
  if (!retCache.has(k)) retCache.set(k, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide, toneMapped: false }));
  return retCache.get(k);
}
const RED = 0xff3b30;

function kit(g) {
  const add = (geo, m, x, y, f, rx = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, -f);
    o.rotation.x = rx;
    g.add(o);
    return o;
  };
  return {
    add,
    B: (w, h, l, x, y, f, m, rx = 0) => add(new THREE.BoxGeometry(w, h, l), m, x, y, f, rx),
    // cylinder along the barrel axis; r2 is the radius at the forward end
    T: (r, l, x, y, f, m, sides = 10, r2 = r, open = false) => {
      const geo = new THREE.CylinderGeometry(r2, r, l, sides, 1, open);
      geo.rotateX(-Math.PI / 2);
      return add(geo, m, x, y, f);
    },
    // side-profile polygon [[f, y], ...] extruded to width w (centred on x)
    P: (pts, w, m, x = 0, holes = [], bevel = 0.003) => {
      const shape = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
      for (const h of holes) shape.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a, b))));
      const depth = Math.max(0.001, w - bevel * 2);
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
      geo.translate(0, 0, -depth / 2);
      geo.rotateY(Math.PI / 2);
      return add(geo, m, x, 0, 0);
    },
  };
}

// ---------------------------------------------------------------------------
// Sights
// ---------------------------------------------------------------------------
function ironSights(k, m, S, rearF, rearBase, frontF, frontBase, dot = 0x7dff9a) {
  // rear notch: two ears whose tops sit on the sight line, with a 1.2cm gap
  k.B(0.012, 0.014, 0.012, -0.012, S - 0.007, rearF, m);
  k.B(0.012, 0.014, 0.012, 0.012, S - 0.007, rearF, m);
  const rh = S - 0.014 - rearBase;
  if (rh > 0) k.B(0.038, rh, 0.014, 0, rearBase + rh / 2, rearF, m);
  // front post: its tip (level with the ear tops) is the point of aim
  const fh = S - frontBase;
  k.B(0.007, fh, 0.007, 0, frontBase + fh / 2, frontF, m);
  k.add(new THREE.SphereGeometry(0.0034, 8, 6), retMat(dot), 0, S - 0.0024, frontF + 0.004);
}

function redDot(k, m, S, f, y0, r = 0.02, len = 0.045, color = RED) {
  k.T(r, len, 0, S, f, darkDS, 18, r, true);
  for (const e of [-1, 1]) k.add(new THREE.TorusGeometry(r, 0.0035, 4, 18), m, 0, S, f + (e * len) / 2);
  const mh = S - r - y0;
  if (mh > 0) k.B(0.022, mh, 0.03, 0, y0 + mh / 2, f, m);
  k.add(new THREE.CircleGeometry(r * 0.96, 20), lensMat, 0, S, f + len / 2);
  k.add(new THREE.CircleGeometry(0.0017, 12), retMat(color), 0, S, f + len / 2 - 0.002);
  k.add(new THREE.CircleGeometry(0.0045, 12), retMat(color, 0.25), 0, S, f + len / 2 - 0.0025);
}

function holo(k, m, S, f, y0, color = RED) {
  const w = 0.066, h = 0.046, d = 0.026;
  k.B(0.006, h + 0.006, d, -w / 2, S, f, m);
  k.B(0.006, h + 0.006, d, w / 2, S, f, m);
  k.B(w + 0.006, 0.006, d, 0, S + h / 2, f, m);
  k.B(w + 0.012, 0.016, 0.07, 0, S - h / 2 - 0.006, f - 0.015, m);
  const mh = S - h / 2 - 0.014 - y0;
  if (mh > 0) k.B(0.03, mh, 0.05, 0, y0 + mh / 2, f - 0.015, m);
  k.add(new THREE.PlaneGeometry(w, h), lensMat, 0, S, f + 0.004);
  k.add(new THREE.RingGeometry(0.0072, 0.0086, 28), retMat(color), 0, S, f + 0.003);
  k.add(new THREE.CircleGeometry(0.0013, 10), retMat(color), 0, S, f + 0.003);
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    k.add(new THREE.PlaneGeometry(dx ? 0.003 : 0.0009, dy ? 0.003 : 0.0009), retMat(color), dx * 0.0115, S + dy * 0.0115, f + 0.003);
  }
}

function scope(k, m, S, fRear, fFront, y0, r = 0.03, color = RED, simple = false) {
  const len = fFront - fRear, c = (fRear + fFront) / 2;
  k.T(r, len * 0.6, 0, S, c, darkDS, 18, r, true);
  k.T(r, len * 0.25, 0, S, fFront - len * 0.125, darkDS, 18, r * 1.35, true);
  k.T(r * 1.15, len * 0.2, 0, S, fRear + len * 0.1, darkDS, 18, r * 1.15, true);
  for (const f of [fRear, fFront]) k.add(new THREE.TorusGeometry(f === fFront ? r * 1.35 : r * 1.15, 0.004, 4, 20), m, 0, S, f);
  k.B(0.014, 0.016, 0.016, 0, S + r + 0.007, c, m);
  k.B(0.016, 0.014, 0.016, r + 0.007, S, c, m);
  for (const f of [fRear + len * 0.28, fFront - len * 0.38]) {
    k.add(new THREE.TorusGeometry(r + 0.004, 0.005, 4, 16), m, 0, S, f);
    const mh = S - r - y0;
    if (mh > 0) k.B(0.02, mh, 0.018, 0, y0 + mh / 2, f, m);
  }
  const rf = fFront - 0.004;
  k.add(new THREE.CircleGeometry(r * 1.3, 24), lensMat, 0, S, fFront);
  const ink = retMat(0x0b0c0e), t = 0.0011, R = r * 1.3;
  if (simple) {
    // plain thin crosshair with a dot
    k.add(new THREE.PlaneGeometry(R * 2, t * 0.6), ink, 0, S, rf);
    k.add(new THREE.PlaneGeometry(t * 0.6, R * 2), ink, 0, S, rf);
    k.add(new THREE.CircleGeometry(0.0011, 10), retMat(color), 0, S, rf + 0.0005);
    return;
  }
  // duplex crosshair: thick outer posts, thin centre lines, red centre dot
  for (const s of [-1, 1]) {
    k.add(new THREE.PlaneGeometry(R * 0.7, t * 2), ink, s * (R * 0.3 + R * 0.35), S, rf);
    k.add(new THREE.PlaneGeometry(t * 2, R * 0.7), ink, 0, S + s * (R * 0.3 + R * 0.35), rf);
  }
  k.add(new THREE.PlaneGeometry(R * 0.6, t * 0.5), ink, 0, S, rf);
  k.add(new THREE.PlaneGeometry(t * 0.5, R * 0.6), ink, 0, S, rf);
  k.add(new THREE.CircleGeometry(0.0012, 10), retMat(color), 0, S, rf + 0.0005);
}

// ---------------------------------------------------------------------------
// Shared parts
// ---------------------------------------------------------------------------
function grip(k, m, f = 0, w = 0.036) {
  k.P([[f - 0.03, -0.04], [f + 0.025, -0.04], [f + 0.002, -0.145], [f - 0.055, -0.135]], w, m);
}
function triggerGuard(k, m, steel, f = 0.025, top = -0.04) {
  k.P([[f, top], [f + 0.055, top], [f + 0.05, top - 0.035], [f - 0.005, top - 0.035]], 0.012, m, 0,
    [[[f + 0.006, top - 0.005], [f + 0.047, top - 0.005], [f + 0.043, top - 0.029], [f + 0.002, top - 0.029]]], 0.001);
  k.B(0.004, 0.02, 0.006, 0, top - 0.014, f + 0.02, steel, 0.3);
}
function rail(k, m, teeth, y, fFrom, fTo, w = 0.034) {
  k.B(w, 0.01, fTo - fFrom, 0, y, (fFrom + fTo) / 2, m);
  const n = Math.floor((fTo - fFrom) / 0.028);
  for (let i = 0; i <= n; i++) k.B(w + 0.004, 0.005, 0.01, 0, y + 0.007, fFrom + i * 0.028, teeth);
}

function flashMesh(color) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(0.2, 0.2);
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(geo, m); p.rotation.z = (i * Math.PI) / 3; g.add(p); }
  const side = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.3), m);
  side.rotation.y = Math.PI / 2; side.position.z = -0.1; g.add(side);
  g.visible = false;
  return g;
}

function finish(g, { muzzleF, muzzleY = 0, S, hip, ads, flash = 0xffd27a, gripF = 0 }) {
  const { B } = kit(g);
  const sleeve = B(0.1, 0.1, 0.42, 0.05, -0.22, gripF - 0.26, mat(0x3a3f47));
  sleeve.rotation.x = 0.4;
  sleeve.userData.hand = true;
  B(0.075, 0.085, 0.1, 0.0, -0.1, gripF - 0.02, mat(0x24272c)).userData.hand = true;
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, muzzleY, -muzzleF);
  g.add(muzzle);
  const fl = flashMesh(flash);
  muzzle.add(fl);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.userData = { muzzle, flash: fl, hip: new THREE.Vector3(...hip), ads: new THREE.Vector3(0, -S, -ads), sightY: S };
  return g;
}

// ---------------------------------------------------------------------------
// Guns
// ---------------------------------------------------------------------------
const EXO_LOOK = Object.fromEntries(EXOTIC_WEAPONS.map((e) => [e.name, e.look]));

export function buildGunModel(item) {
  const look = item.rarity === 'exotic' ? EXO_LOOK[item.name] : null;
  const g = buildBaseGun(item, look);
  if (look) exoticParts(g, look);
  return g;
}

function buildBaseGun(item, look) {
  const g = new THREE.Group();
  const k = kit(g);
  const { B, T, P } = k;
  const body = mat(look?.body ?? BODY[item.rarity] ?? BODY.common);
  const dark = mat(0x262a30), mid = mat(0x454b54), steel = mat(0x6a7078), gripM = mat(0x1d2024), wood = mat(0x5a3d2b);
  const el = ELEMENTS[item.element];
  const glow = mat(el.hex, { emissive: el.hex, emissiveIntensity: 1.4 });
  const fc = item.element === 'kinetic' ? 0xffd27a : el.hex;
  let S;
  switch (item.arch) {
    case 'auto': {
      S = 0.104;
      P([[-0.13, 0.045], [0.2, 0.045], [0.24, 0.025], [0.24, -0.035], [0.06, -0.045], [-0.13, -0.04]], 0.058, body);
      rail(k, dark, mid, 0.05, -0.1, 0.22);
      P([[0.24, 0.038], [0.5, 0.032], [0.53, 0.012], [0.53, -0.02], [0.5, -0.035], [0.24, -0.04]], 0.052, mid);
      for (let i = 0; i < 4; i++) B(0.058, 0.008, 0.028, 0, 0.0, 0.3 + i * 0.055, dark);
      T(0.011, 0.14, 0, 0.006, 0.58, steel); T(0.017, 0.045, 0, 0.006, 0.66, dark, 6);
      P([[0.07, -0.04], [0.13, -0.04], [0.17, -0.17], [0.11, -0.185]], 0.034, dark);
      grip(k, gripM); triggerGuard(k, dark, steel);
      P([[-0.13, 0.035], [-0.37, 0.03], [-0.39, -0.09], [-0.33, -0.1], [-0.13, -0.035]], 0.04, dark, 0, [[[-0.18, 0.012], [-0.31, 0.01], [-0.32, -0.06], [-0.21, -0.03]]]);
      B(0.022, 0.012, 0.04, 0.035, 0.028, -0.04, mid);
      B(0.066, 0.01, 0.2, 0, 0.02, 0.07, glow);
      holo(k, dark, S, 0.06, 0.055);
      return finish(g, { muzzleF: 0.69, muzzleY: 0.006, S, hip: [0.21, -0.22, -0.5], ads: 0.33, flash: fc });
    }
    case 'hand': {
      S = 0.058;
      P([[-0.06, 0.03], [0.12, 0.03], [0.13, 0.005], [0.12, -0.03], [-0.02, -0.035], [-0.065, -0.005]], 0.04, body);
      T(0.033, 0.062, 0, 0.0, 0.055, steel, 8);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; B(0.007, 0.007, 0.064, Math.cos(a) * 0.031, Math.sin(a) * 0.031, 0.055, dark); }
      T(0.007, 0.075, 0, 0, 0.055, dark, 6);
      P([[0.12, 0.034], [0.31, 0.03], [0.315, 0.0], [0.31, -0.022], [0.12, -0.024]], 0.032, body);
      B(0.012, 0.007, 0.19, 0, 0.035, 0.215, dark);
      B(0.026, 0.016, 0.16, 0, -0.03, 0.21, dark);
      T(0.0095, 0.004, 0, 0.004, 0.318, mat(0x0a0a0a));
      P([[-0.05, 0.02], [-0.038, 0.02], [-0.062, 0.042], [-0.074, 0.037]], 0.012, steel);
      P([[-0.035, -0.03], [0.02, -0.03], [-0.005, -0.135], [-0.075, -0.13], [-0.068, -0.04]], 0.038, wood);
      triggerGuard(k, dark, steel, 0.0, -0.03);
      B(0.044, 0.006, 0.13, 0, 0.016, 0.05, glow);
      ironSights(k, dark, S, -0.045, 0.03, 0.3, 0.038);
      return finish(g, { muzzleF: 0.32, muzzleY: 0.004, S, hip: [0.19, -0.2, -0.48], ads: 0.36, flash: fc });
    }
    case 'pulse': {
      S = 0.096;
      P([[-0.22, 0.05], [0.18, 0.05], [0.22, 0.03], [0.22, -0.045], [0.09, -0.055], [-0.22, -0.065]], 0.066, body);
      rail(k, dark, mid, 0.055, -0.15, 0.16);
      T(0.03, 0.17, 0, 0.0, 0.31, dark, 8);
      for (let i = 0; i < 3; i++) T(0.033, 0.01, 0, 0, 0.25 + i * 0.05, glow, 8);
      T(0.012, 0.07, 0, 0, 0.43, steel); T(0.017, 0.03, 0, 0, 0.455, mid, 6);
      P([[-0.1, -0.06], [-0.05, -0.055], [-0.04, -0.16], [-0.09, -0.165]], 0.034, dark);
      grip(k, gripM, 0.03); triggerGuard(k, dark, steel, 0.055, -0.05);
      B(0.06, 0.12, 0.03, 0, -0.012, -0.235, gripM);
      B(0.07, 0.012, 0.16, 0, 0.0, -0.05, glow);
      redDot(k, dark, S, 0.05, 0.062, 0.021);
      return finish(g, { muzzleF: 0.47, S, hip: [0.21, -0.21, -0.5], ads: 0.31, flash: fc, gripF: 0.03 });
    }
    case 'scout': {
      S = 0.1;
      P([[-0.12, 0.042], [0.3, 0.042], [0.33, 0.02], [0.33, -0.03], [0.12, -0.04], [-0.12, -0.036]], 0.054, body);
      P([[0.33, 0.03], [0.5, 0.026], [0.52, 0.0], [0.5, -0.03], [0.33, -0.036]], 0.05, mid);
      T(0.0105, 0.2, 0, 0.008, 0.6, steel); T(0.016, 0.05, 0, 0.008, 0.72, dark, 6);
      B(0.03, 0.085, 0.055, 0, -0.08, 0.15, dark);
      grip(k, gripM); triggerGuard(k, dark, steel);
      P([[-0.12, 0.03], [-0.38, 0.025], [-0.4, -0.09], [-0.3, -0.1], [-0.12, -0.034]], 0.042, body, 0, [[[-0.16, 0.0], [-0.24, 0.0], [-0.24, -0.05], [-0.17, -0.04]]]);
      B(0.058, 0.008, 0.26, 0, 0.018, 0.12, glow);
      scope(k, dark, S, 0.0, 0.13, 0.045, 0.028, RED, true);
      return finish(g, { muzzleF: 0.75, muzzleY: 0.008, S, hip: [0.21, -0.22, -0.5], ads: 0.17, flash: fc });
    }
    case 'smg': {
      S = 0.09;
      P([[-0.08, 0.042], [0.17, 0.042], [0.19, 0.02], [0.19, -0.035], [0.06, -0.042], [-0.08, -0.04]], 0.055, body);
      rail(k, dark, mid, 0.047, -0.05, 0.15, 0.03);
      T(0.022, 0.1, 0, 0.004, 0.24, dark, 8);
      for (let i = 0; i < 3; i++) B(0.046, 0.01, 0.012, 0, 0.004, 0.21 + i * 0.03, mat(0x0b0c0e));
      T(0.01, 0.04, 0, 0.004, 0.3, steel);
      P([[0.07, -0.04], [0.11, -0.04], [0.12, -0.2], [0.085, -0.2]], 0.03, dark);
      B(0.028, 0.06, 0.03, 0, -0.07, 0.17, gripM);
      grip(k, gripM); triggerGuard(k, dark, steel, 0.02);
      for (const s of [-1, 1]) B(0.008, 0.008, 0.22, s * 0.02, 0.01, -0.19, steel);
      B(0.05, 0.07, 0.012, 0, -0.02, -0.3, dark);
      B(0.059, 0.008, 0.14, 0, 0.016, 0.05, glow);
      redDot(k, dark, S, 0.04, 0.052, 0.018);
      return finish(g, { muzzleF: 0.32, muzzleY: 0.004, S, hip: [0.2, -0.21, -0.47], ads: 0.28, flash: fc });
    }
    case 'shotgun': {
      S = 0.062;
      P([[-0.1, 0.04], [0.17, 0.04], [0.17, -0.04], [0.05, -0.045], [-0.1, -0.04]], 0.06, body);
      T(0.018, 0.42, 0, 0.022, 0.38, steel, 10);
      T(0.015, 0.36, 0, -0.016, 0.35, dark, 10);
      B(0.01, 0.008, 0.4, 0, 0.044, 0.38, dark);
      B(0.046, 0.042, 0.14, 0, -0.018, 0.33, wood);
      for (let i = 0; i < 4; i++) B(0.048, 0.004, 0.01, 0, -0.018, 0.28 + i * 0.03, dark);
      grip(k, gripM); triggerGuard(k, dark, steel);
      P([[-0.1, 0.03], [-0.38, 0.0], [-0.39, -0.1], [-0.33, -0.11], [-0.1, -0.035]], 0.045, wood);
      B(0.064, 0.01, 0.16, 0, 0.012, 0.04, glow);
      B(0.03, 0.02, 0.05, 0.035, 0.0, 0.08, mat(0x0b0c0e));
      ironSights(k, dark, S, 0.0, 0.04, 0.57, 0.048, 0xff9a3c);
      return finish(g, { muzzleF: 0.6, muzzleY: 0.022, S, hip: [0.21, -0.21, -0.5], ads: 0.32, flash: fc });
    }
    case 'sniper': {
      S = 0.106;
      P([[-0.12, 0.04], [0.28, 0.04], [0.3, 0.02], [0.3, -0.03], [0.1, -0.04], [-0.12, -0.035]], 0.056, body);
      T(0.014, 0.45, 0, 0.008, 0.53, steel); B(0.035, 0.03, 0.06, 0, 0.008, 0.78, dark);
      for (let i = 0; i < 3; i++) B(0.037, 0.006, 0.01, 0, 0.008, 0.765 + i * 0.015, mat(0x0b0c0e));
      B(0.045, 0.008, 0.008, 0.03, 0.02, 0.04, steel);
      k.add(new THREE.SphereGeometry(0.01, 8, 6), steel, 0.055, 0.02, 0.04);
      B(0.034, 0.07, 0.06, 0, -0.07, 0.14, dark);
      for (const s of [-1, 1]) B(0.008, 0.008, 0.18, s * 0.012, -0.022, 0.4, dark);
      grip(k, gripM); triggerGuard(k, dark, steel);
      P([[-0.12, 0.03], [-0.42, 0.035], [-0.44, -0.1], [-0.36, -0.11], [-0.24, -0.06], [-0.12, -0.035]], 0.046, body);
      B(0.04, 0.02, 0.12, 0, 0.045, -0.25, dark);
      B(0.06, 0.008, 0.24, 0, 0.016, 0.1, glow);
      scope(k, dark, S, -0.03, 0.22, 0.043, 0.032);
      return finish(g, { muzzleF: 0.81, muzzleY: 0.008, S, hip: [0.21, -0.22, -0.5], ads: 0.1, flash: fc });
    }
    case 'fusion': {
      S = 0.106;
      P([[-0.12, 0.055], [0.22, 0.055], [0.26, 0.03], [0.26, -0.05], [0.06, -0.055], [-0.12, -0.05]], 0.075, body);
      T(0.03, 0.2, 0, 0, 0.37, dark, 8);
      for (let i = 0; i < 4; i++) T(0.045, 0.018, 0, 0, 0.3 + i * 0.045, glow, 8);
      for (const s of [-1, 1]) B(0.012, 0.012, 0.09, 0, s * 0.03, 0.5, steel);
      B(0.05, 0.07, 0.08, 0, -0.08, 0.13, dark); B(0.052, 0.012, 0.06, 0, -0.07, 0.13, glow);
      grip(k, gripM); triggerGuard(k, dark, steel);
      B(0.05, 0.08, 0.18, 0, -0.01, -0.2, dark);
      rail(k, dark, mid, 0.06, -0.06, 0.18);
      holo(k, dark, S, 0.04, 0.065, el.hex === ELEMENTS.kinetic.hex ? RED : el.hex);
      return finish(g, { muzzleF: 0.54, S, hip: [0.22, -0.22, -0.5], ads: 0.31, flash: el.hex });
    }
    case 'linear': {
      S = 0.112;
      P([[-0.12, 0.05], [0.36, 0.05], [0.4, 0.03], [0.4, -0.045], [0.12, -0.05], [-0.12, -0.045]], 0.07, body);
      for (let i = 0; i < 5; i++) B(0.076, 0.012, 0.02, 0, 0.0, 0.18 + i * 0.045, glow);
      for (const s of [-1, 1]) B(0.012, 0.012, 0.32, 0, s * 0.021, 0.56, steel);
      for (let i = 0; i < 3; i++) B(0.022, 0.06, 0.012, 0, 0, 0.45 + i * 0.09, dark);
      B(0.04, 0.08, 0.07, 0, -0.085, 0.18, dark);
      grip(k, gripM); triggerGuard(k, dark, steel);
      P([[-0.12, 0.04], [-0.38, 0.03], [-0.4, -0.1], [-0.3, -0.1], [-0.12, -0.04]], 0.05, dark, 0, [[[-0.16, 0.01], [-0.27, 0.005], [-0.28, -0.06], [-0.18, -0.03]]]);
      rail(k, dark, mid, 0.055, -0.08, 0.2);
      scope(k, dark, S, -0.02, 0.18, 0.06, 0.032, el.hex === ELEMENTS.kinetic.hex ? RED : el.hex);
      return finish(g, { muzzleF: 0.73, S, hip: [0.22, -0.22, -0.52], ads: 0.09, flash: el.hex });
    }
    case 'rocket': {
      S = 0.135;
      T(0.075, 0.9, 0, 0, 0.12, body, 12);
      T(0.08, 0.08, 0, 0, 0.6, dark, 12, 0.092);
      T(0.088, 0.08, 0, 0, -0.35, dark, 12, 0.08);
      for (const f of [-0.15, 0.25, 0.45]) T(0.078, 0.025, 0, 0, f, mid, 12);
      B(0.03, 0.09, 0.035, 0, -0.115, 0.2, gripM);
      grip(k, gripM, 0, 0.034); triggerGuard(k, dark, steel, 0.02, -0.06);
      B(0.1, 0.03, 0.2, 0, -0.085, -0.17, dark);
      B(0.03, 0.06, 0.12, -0.09, 0.0, 0.1, dark); B(0.032, 0.01, 0.1, -0.09, 0.015, 0.1, glow);
      B(0.16, 0.012, 0.03, 0, 0.0, 0.38, glow);
      holo(k, dark, S, 0.05, 0.072);
      return finish(g, { muzzleF: 0.65, S, hip: [0.25, -0.16, -0.48], ads: 0.3, flash: 0xffb060 });
    }
    case 'mg': {
      S = 0.118;
      P([[-0.14, 0.06], [0.24, 0.06], [0.28, 0.035], [0.28, -0.05], [0.08, -0.06], [-0.14, -0.055]], 0.08, body);
      B(0.07, 0.015, 0.22, 0, 0.066, 0.07, mid);
      T(0.026, 0.28, 0, 0.01, 0.42, dark, 8);
      for (let i = 0; i < 6; i++) B(0.056, 0.008, 0.014, 0, 0.01, 0.31 + i * 0.04, mat(0x0b0c0e));
      T(0.012, 0.12, 0, 0.01, 0.62, steel); T(0.018, 0.04, 0, 0.01, 0.67, dark, 6);
      B(0.07, 0.09, 0.11, 0.03, -0.1, 0.08, dark); B(0.03, 0.02, 0.04, 0.045, -0.045, 0.1, steel);
      B(0.012, 0.04, 0.12, 0.05, 0.05, 0.3, dark);
      for (const s of [-1, 1]) B(0.008, 0.008, 0.2, s * 0.014, -0.02, 0.45, dark);
      grip(k, gripM); triggerGuard(k, dark, steel);
      P([[-0.14, 0.045], [-0.4, 0.04], [-0.41, -0.09], [-0.14, -0.05]], 0.05, dark);
      B(0.084, 0.012, 0.2, 0, 0.03, 0.06, glow);
      holo(k, dark, S, 0.05, 0.074);
      return finish(g, { muzzleF: 0.7, muzzleY: 0.01, S, hip: [0.22, -0.22, -0.5], ads: 0.31, flash: fc });
    }
    case 'glauncher': {
      S = 0.088;
      P([[-0.1, 0.045], [0.14, 0.045], [0.14, -0.04], [-0.1, -0.04]], 0.06, body);
      T(0.085, 0.12, 0, -0.03, 0.2, mid, 6);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; T(0.022, 0.124, Math.cos(a) * 0.05, -0.03 + Math.sin(a) * 0.05, 0.2, dark, 8); }
      T(0.034, 0.22, 0, 0.02, 0.38, dark, 10); T(0.04, 0.02, 0, 0.02, 0.48, glow, 10);
      B(0.03, 0.07, 0.04, 0, -0.04, 0.38, gripM);
      grip(k, gripM); triggerGuard(k, dark, steel);
      for (const s of [-1, 1]) B(0.008, 0.008, 0.22, s * 0.022, 0.0, -0.2, steel);
      B(0.055, 0.08, 0.014, 0, -0.02, -0.31, dark);
      B(0.064, 0.01, 0.12, 0, 0.02, 0.02, glow);
      ironSights(k, dark, S, -0.02, 0.045, 0.47, 0.054, 0xff9a3c);
      return finish(g, { muzzleF: 0.5, muzzleY: 0.02, S, hip: [0.22, -0.2, -0.5], ads: 0.34, flash: fc });
    }
    default:
      throw new Error(`buildGunModel: unknown archetype ${item.arch}`);
  }
}

// ---------------------------------------------------------------------------
// Super viewmodels
// ---------------------------------------------------------------------------
export function buildSuperModel(type) {
  const g = new THREE.Group();
  const { B, T } = kit(g);
  if (type === 'hammers') {
    const glow = mat(0xff8b2b, { emissive: 0xff8b2b, emissiveIntensity: 2.2 });
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.4, 6), mat(0x5a3a22));
    h.position.set(0, 0, -0.1); h.rotation.x = -0.4; g.add(h);
    B(0.2, 0.12, 0.12, 0, 0.18, 0.18, glow);
    return finish(g, { muzzleF: 0.2, muzzleY: 0.15, S: 0.2, hip: [0.24, -0.2, -0.4], ads: 0.4, flash: 0xff8b2b });
  }
  if (type === 'revolver') {
    const gold = mat(0xd9b04a, { emissive: 0x7a4a10, emissiveIntensity: 0.6 });
    const glow = mat(0xffb547, { emissive: 0xff8b2b, emissiveIntensity: 2 });
    B(0.065, 0.1, 0.26, 0, 0.01, 0.1, gold); T(0.024, 0.24, 0, 0.02, 0.33, gold); T(0.05, 0.08, 0, -0.005, 0.1, glow, 6);
    B(0.05, 0.14, 0.06, 0, -0.1, -0.03, mat(0x2a1f10), -0.35); B(0.068, 0.016, 0.16, 0, 0.06, 0.12, glow);
    return finish(g, { muzzleF: 0.46, muzzleY: 0.02, S: 0.075, hip: [0.18, -0.17, -0.36], ads: 0.32, flash: 0xff8b2b });
  }
  if (type === 'fists') {
    const glow = mat(0x5fd3ff, { emissive: 0x5fd3ff, emissiveIntensity: 2.2 });
    const plate = mat(0x6c727b);
    for (const [x, f] of [[0.02, 0.22], [-0.3, 0.12]]) {
      B(0.16, 0.14, 0.18, x, -0.02, f, plate);
      B(0.17, 0.05, 0.04, x, 0.03, f + 0.08, glow);
      B(0.12, 0.12, 0.32, x + 0.03, -0.08, f - 0.22, mat(0x3a3f47));
    }
    return finish(g, { muzzleF: 0.3, muzzleY: 0, S: 0.05, hip: [0.2, -0.22, -0.42], ads: 0.42, flash: 0x5fd3ff });
  }
  if (type === 'staff') {
    // Arc Staff: a staff angled up and away from the hand, with crackling ends
    const glow = mat(0x5fd3ff, { emissive: 0x5fd3ff, emissiveIntensity: 2.6 });
    const st = new THREE.Group();
    st.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.95, 6), mat(0x39404c)));
    for (const s of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 6), glow);
      band.position.y = s * 0.3;
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), glow);
      tip.position.y = s * 0.5; tip.scale.y = 2;
      st.add(band, tip);
    }
    st.rotation.set(-0.9, 0.2, -0.55);
    st.position.set(0.0, 0.02, -0.12);
    g.add(st);
    B(0.07, 0.06, 0.08, 0.02, -0.03, 0.12, mat(0x24272c));
    return finish(g, { muzzleF: 0.4, muzzleY: 0.1, S: 0.1, hip: [0.2, -0.24, -0.46], ads: 0.5, flash: 0x5fd3ff });
  }
  if (type === 'sentinel') {
    // Sentinel Shield: round void shield on the left arm, glowing rim
    const glow = mat(0xb07cff, { emissive: 0xb07cff, emissiveIntensity: 2.4 });
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 14).rotateX(Math.PI / 2), mat(0x3a3048));
    face.position.set(-0.16, 0.02, -0.12);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 4, 18), glow);
    rim.position.copy(face.position);
    const boss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: 0xe6d0ff }));
    boss.position.set(-0.16, 0.02, -0.15);
    g.add(face, rim, boss);
    B(0.09, 0.08, 0.1, 0.08, -0.06, 0.1, mat(0x2a2d33));
    return finish(g, { muzzleF: 0.2, muzzleY: 0.02, S: 0.05, hip: [0.2, -0.2, -0.42], ads: 0.42, flash: 0xb07cff });
  }
  if (type === 'tether') {
    const glow = new THREE.MeshBasicMaterial({ color: 0xb07cff });
    const limb = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.018, 4, 18, Math.PI * 0.9), glow);
    limb.rotation.set(0, Math.PI / 2, Math.PI / 2 + Math.PI * 0.05);
    limb.position.set(0, 0, -0.15);
    g.add(limb);
    B(0.004, 0.6, 0.004, 0, 0, 0.0, new THREE.MeshBasicMaterial({ color: 0xe6d0ff }));
    B(0.02, 0.02, 0.5, 0, 0, -0.18, glow);
    B(0.05, 0.12, 0.05, 0, 0, -0.15, mat(0x2a2030));
    return finish(g, { muzzleF: 0.45, muzzleY: 0, S: 0.05, hip: [0.18, -0.18, -0.42], ads: 0.42, flash: 0xb07cff });
  }
  if (type === 'stormtrance') {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), new THREE.MeshBasicMaterial({ color: 0xe0f6ff }));
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial({ color: 0x5fd3ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.position.set(0, 0.04, -0.22); shell.position.copy(core.position); g.add(core, shell);
    return finish(g, { muzzleF: 0.22, muzzleY: 0.04, S: 0.04, hip: [0.16, -0.18, -0.38], ads: 0.4, flash: 0x5fd3ff });
  }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), new THREE.MeshBasicMaterial({ color: 0xe6d0ff }));
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshBasicMaterial({ color: 0xb07cff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.position.set(0, 0.06, -0.2); shell.position.copy(core.position); g.add(core, shell);
  return finish(g, { muzzleF: 0.2, muzzleY: 0.06, S: 0.06, hip: [0.16, -0.18, -0.38], ads: 0.4, flash: 0xb07cff });
}

// ---------------------------------------------------------------------------
// Exotic signature parts, layered on the archetype's base model
// ---------------------------------------------------------------------------
function exoticParts(g, look) {
  const k = kit(g);
  const { B, add } = k;
  const mf = -g.userData.muzzle.position.z; // muzzle distance forward of the grip
  const S = g.userData.sightY;
  const acc = mat(look.accent);
  const glow = mat(look.accent, { emissive: look.accent, emissiveIntensity: 1.6 });
  const fwdCone = (r, h, x, y, f, m) => add(new THREE.ConeGeometry(r, h, 5).rotateX(-Math.PI / 2), m, x, y, f);
  for (const part of look.parts) {
    switch (part) {
      case 'stripes': for (const x of [-1, 1]) B(0.006, 0.014, 0.32, x * 0.042, 0.0, 0.05, glow); break;
      case 'drum': add(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 12).rotateZ(Math.PI / 2), acc, 0, -0.12, 0.12); add(new THREE.TorusGeometry(0.06, 0.01, 4, 14).rotateY(Math.PI / 2), mat(0xc9a046, { emissive: 0x8a6a1e, emissiveIntensity: 0.6 }), 0, -0.12, 0.12); break;
      case 'fins': for (const x of [-1, 1]) B(0.006, 0.05, 0.22, x * 0.046, -0.01, mf - 0.22, glow, 0.15).rotation.z = x * 0.35; break;
      case 'sun': // sun emblems on both sides of the frame, clear of the sights
        for (const x of [-1, 1]) {
          add(new THREE.TorusGeometry(0.03, 0.006, 4, 16).rotateY(Math.PI / 2), glow, x * 0.042, -0.005, mf * 0.45);
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; add(new THREE.BoxGeometry(0.004, 0.006, 0.016), glow, x * 0.042, -0.005 + Math.sin(a) * 0.044, -mf * 0.45 + Math.cos(a) * 0.044).rotation.x = -a; }
        }
        break;
      case 'spikes':
        for (let i = 0; i < 7; i++) for (const x of [-1, 1]) add(new THREE.ConeGeometry(0.01, 0.06, 4), acc, x * 0.04, 0.02 - (i % 2) * 0.02, 0.0 + i * 0.045).rotation.z = -x * Math.PI / 2;
        for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(0.009, 0.05, 4).rotateX(Math.PI), glow, 0, -0.05, mf * 0.3 + i * 0.05);
        break;
      case 'spade': for (const x of [-1, 1]) B(0.004, 0.04, 0.04, x * 0.034, 0.0, 0.04, glow, Math.PI / 4); break;
      case 'orb':
        add(new THREE.IcosahedronGeometry(0.03, 1), new THREE.MeshBasicMaterial({ color: look.accent }), 0.05, 0, -0.06);
        add(new THREE.IcosahedronGeometry(0.045, 1), new THREE.MeshBasicMaterial({ color: look.accent, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }), 0.05, 0, -0.06);
        break;
      case 'siva': for (let i = 0; i < 5; i++) B(0.006, 0.02, 0.03, (i % 2 ? 1 : -1) * 0.043, -0.02 + (i % 3) * 0.02, -0.05 + i * 0.06, glow); break;
      case 'star': for (const x of [-1, 1]) { B(0.004, 0.07, 0.014, x * 0.04, 0.0, 0.06, glow); B(0.004, 0.07, 0.014, x * 0.04, 0.0, 0.06, glow, Math.PI / 2); B(0.004, 0.045, 0.012, x * 0.041, 0.0, 0.06, glow, Math.PI / 4); } break;
      case 'hazard': for (let i = 0; i < 6; i++) for (const x of [-1, 1]) B(0.004, 0.03, 0.025, x * 0.042, -0.01, -0.06 + i * 0.05, i % 2 ? acc : mat(0x111111)); break;
      case 'bull': for (const x of [-1, 1]) add(new THREE.ConeGeometry(0.012, 0.08, 4).rotateX(-Math.PI / 2 - 0.5), mat(0xe8dcc0), x * 0.04, 0.05, mf - 0.14).rotation.z = -x * 0.4; break;
      case 'jaw': for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.009, 0.04, 3).rotateX(Math.PI), mat(0xe8e0d0), -0.03 + i * 0.015, -0.04, mf - 0.04); B(0.07, 0.012, 0.08, 0, -0.03, mf - 0.06, glow); break;
      case 'blade': B(0.008, 0.028, 0.44, 0, -0.05, mf - 0.26, mat(0xdfe6ee)); B(0.03, 0.02, 0.02, 0, -0.05, mf - 0.49, mat(0x1b1d22)); B(0.012, 0.07, 0.012, 0, -0.09, 0.02, glow); break;
      case 'crystal': for (let i = 0; i < 5; i++) { const o = add(new THREE.OctahedronGeometry(0.022 + (i % 2) * 0.008, 0), glow, (i - 2) * 0.02, -0.06 - (i % 2) * 0.025, mf - 0.08 - (i % 3) * 0.04); o.scale.y = 1.8; o.rotation.z = (i - 2) * 0.3; } break;
      case 'coils': for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.042, 0.01, 4, 16), glow, 0, -0.01, mf - 0.2 + i * 0.06); break;
      case 'ornate': { const gold = mat(0xf4d27a, { emissive: 0x8a6a1e, emissiveIntensity: 0.5 }); for (const x of [-1, 1]) B(0.006, 0.01, 0.42, x * 0.04, 0.012, 0.15, gold); add(new THREE.ConeGeometry(0.025, 0.1, 4).rotateX(Math.PI), gold, 0, -0.09, -0.12); B(0.05, 0.05, 0.03, 0, 0.0, mf - 0.05, glow); break; }
      case 'wings':
        for (const x of [-1, 1]) {
          const w = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([[0.04, 0.02], [0.32, 0.07], [0.26, 0.13], [0.1, 0.1]].map(([a, b]) => new THREE.Vector2(a, b))), { depth: 0.006, bevelEnabled: false }).rotateY(Math.PI / 2), mat(look.body));
          w.position.set(x * 0.045, 0, 0); g.add(w);
          B(0.008, 0.006, 0.26, x * 0.05, 0.075, 0.18, glow);
        }
        break;
      case 'prongs': for (const [x, y] of [[0, 0.04], [-0.035, -0.02], [0.035, -0.02]]) B(0.01, 0.01, 0.14, x, y, mf + 0.03, glow); break;
      case 'mouth': for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; fwdCone(0.01, 0.05, Math.cos(a) * 0.04, 0.01 + Math.sin(a) * 0.04, mf + 0.01, mat(0xe8e0d0)); } add(new THREE.CircleGeometry(0.035, 10), glow, 0, 0.01, mf + 0.005); break;
      case 'wolf': {
        const gold = mat(0xf4d27a, { emissive: 0x8a6a1e, emissiveIntensity: 0.5 });
        fwdCone(0.075, 0.18, 0, -0.01, mf + 0.06, gold);
        for (const x of [-1, 1]) { add(new THREE.ConeGeometry(0.022, 0.07, 4), gold, x * 0.075, 0.04, mf - 0.06).rotation.z = -x * 0.6; B(0.02, 0.012, 0.01, x * 0.03, 0.02, mf - 0.02, glow); }
        break;
      }
      case 'skull': {
        const bone = mat(0xe8e0d0);
        for (const x of [-1, 1]) { add(new THREE.IcosahedronGeometry(0.035, 0), bone, x * 0.09, 0.02, 0.1); B(0.006, 0.012, 0.012, x * 0.12, 0.025, 0.09, glow); }
        break;
      }
      default: console.warn('Unknown exotic part', part);
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
}
