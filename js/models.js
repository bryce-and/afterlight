import * as THREE from 'three';
import { ELEMENTS } from './data.js';
import { mat } from './world.js';

const BODY = { common: 0x8b929b, uncommon: 0x5e8a66, rare: 0x56739e, legendary: 0x6e5a8f, exotic: 0xc9a046 };

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

function kit(g) {
  const B = (w, h, d, x, y, z, m, rx = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z); b.rotation.x = rx; g.add(b); return b;
  };
  const T = (r, len, x, y, z, m, sides = 8, r2 = r) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, sides), m);
    c.rotation.x = Math.PI / 2; c.position.set(x, y, z); g.add(c); return c;
  };
  return { B, T };
}

function finish(g, muzzleZ, muzzleY, sightY, hip, adsZ = -0.3, flashColor = 0xffd27a) {
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.42), mat(0x3a3f47));
  sleeve.position.set(0.05, -0.2, 0.27); sleeve.rotation.x = 0.4; g.add(sleeve);
  const glove = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.1), mat(0x24272c));
  glove.position.set(0.0, -0.1, 0.05); g.add(glove);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, muzzleY, muzzleZ);
  g.add(muzzle);
  const flash = flashMesh(flashColor);
  muzzle.add(flash);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.userData = { muzzle, flash, hip: new THREE.Vector3(hip[0] + 0.03, hip[1] - 0.03, hip[2] - 0.2), ads: new THREE.Vector3(0, -sightY, adsZ - 0.14) };
  return g;
}

export function buildGunModel(item) {
  const g = new THREE.Group();
  const { B, T } = kit(g);
  const body = mat(BODY[item.rarity] ?? BODY.common);
  const dark = mat(0x23272d), mid = mat(0x3b4048);
  const el = ELEMENTS[item.element];
  const glow = mat(el.hex, { emissive: el.hex, emissiveIntensity: 1.4 });
  const fc = item.element === 'kinetic' ? 0xffd27a : el.hex;
  switch (item.arch) {
    case 'auto':
      B(0.07, 0.1, 0.44, 0, 0, -0.12, body); B(0.06, 0.06, 0.26, 0, 0.01, -0.45, mid); T(0.016, 0.14, 0, 0.015, -0.63, dark);
      B(0.05, 0.16, 0.08, 0, -0.11, -0.17, dark, 0.25); B(0.055, 0.09, 0.2, 0, -0.02, 0.18, dark);
      B(0.04, 0.12, 0.05, 0, -0.1, 0.03, dark, -0.3); B(0.03, 0.035, 0.12, 0, 0.068, -0.08, dark); B(0.074, 0.016, 0.22, 0, 0.035, -0.18, glow);
      return finish(g, -0.71, 0.015, 0.088, [0.2, -0.19, -0.36], -0.3, fc);
    case 'hand':
      B(0.06, 0.09, 0.24, 0, 0.01, -0.1, body); T(0.022, 0.2, 0, 0.02, -0.31, dark); T(0.048, 0.08, 0, -0.005, -0.1, mid, 6);
      B(0.05, 0.14, 0.06, 0, -0.1, 0.03, dark, -0.35); B(0.062, 0.014, 0.14, 0, 0.055, -0.12, glow); B(0.014, 0.03, 0.02, 0, 0.06, -0.38, dark);
      return finish(g, -0.42, 0.02, 0.075, [0.18, -0.17, -0.36], -0.32, fc);
    case 'pulse':
      B(0.08, 0.12, 0.46, 0, 0, -0.12, body); B(0.07, 0.07, 0.24, 0, 0.0, -0.46, dark); T(0.018, 0.1, 0, 0.0, -0.62, dark);
      B(0.05, 0.13, 0.07, 0, -0.11, -0.12, dark, 0.15); B(0.06, 0.1, 0.18, 0, -0.01, 0.18, mid);
      B(0.04, 0.12, 0.05, 0, -0.1, 0.03, dark, -0.3); B(0.05, 0.04, 0.3, 0, 0.08, -0.15, dark); B(0.082, 0.02, 0.16, 0, 0.0, -0.3, glow);
      return finish(g, -0.68, 0.0, 0.1, [0.2, -0.19, -0.36], -0.3, fc);
    case 'scout':
      B(0.065, 0.1, 0.5, 0, 0, -0.12, body); T(0.016, 0.3, 0, 0.015, -0.5, dark); B(0.05, 0.12, 0.07, 0, -0.1, -0.1, dark, 0.2);
      B(0.05, 0.08, 0.22, 0, -0.01, 0.2, dark); B(0.04, 0.12, 0.05, 0, -0.1, 0.03, dark, -0.3);
      T(0.026, 0.22, 0, 0.09, -0.08, dark); B(0.02, 0.04, 0.02, 0, 0.06, -0.08, dark); B(0.067, 0.015, 0.3, 0, 0.04, -0.15, glow);
      return finish(g, -0.66, 0.015, 0.09, [0.2, -0.19, -0.36], -0.28, fc);
    case 'smg':
      B(0.07, 0.1, 0.3, 0, 0, -0.08, body); T(0.016, 0.12, 0, 0.01, -0.28, dark); B(0.04, 0.2, 0.05, 0, -0.13, -0.12, dark);
      B(0.04, 0.12, 0.05, 0, -0.1, 0.03, dark, -0.3); B(0.03, 0.03, 0.08, 0, 0.065, -0.05, dark); B(0.072, 0.015, 0.14, 0, 0.03, -0.1, glow);
      B(0.03, 0.06, 0.16, 0, -0.02, 0.12, dark);
      return finish(g, -0.35, 0.01, 0.08, [0.19, -0.19, -0.35], -0.32, fc);
    case 'shotgun':
      B(0.09, 0.12, 0.36, 0, 0, -0.06, body); T(0.022, 0.4, -0.022, 0.025, -0.42, dark); T(0.022, 0.4, 0.022, 0.025, -0.42, dark);
      B(0.08, 0.07, 0.16, 0, -0.04, -0.34, mid); B(0.06, 0.1, 0.22, 0, -0.03, 0.2, dark); B(0.04, 0.12, 0.05, 0, -0.1, 0.03, dark, -0.3);
      B(0.092, 0.02, 0.18, 0, 0.055, -0.05, glow);
      return finish(g, -0.63, 0.025, 0.075, [0.21, -0.2, -0.36], -0.3, fc);
    case 'sniper':
      B(0.07, 0.1, 0.5, 0, 0, -0.1, body); T(0.018, 0.5, 0, 0.015, -0.6, dark); B(0.05, 0.1, 0.07, 0, -0.1, -0.08, dark, 0.2);
      B(0.06, 0.12, 0.26, 0, -0.02, 0.22, dark); B(0.04, 0.12, 0.05, 0, -0.1, 0.03, dark, -0.3);
      T(0.038, 0.32, 0, 0.11, -0.08, dark, 8); T(0.045, 0.04, 0, 0.11, -0.25, mid, 8); B(0.072, 0.016, 0.3, 0, 0.04, -0.15, glow);
      return finish(g, -0.86, 0.015, 0.11, [0.21, -0.2, -0.36], -0.3, fc);
    case 'fusion':
      B(0.1, 0.13, 0.44, 0, 0, -0.12, body); B(0.06, 0.12, 0.2, 0, -0.02, 0.2, dark); B(0.04, 0.12, 0.05, 0, -0.1, 0.03, dark, -0.3);
      for (let i = 0; i < 3; i++) T(0.06, 0.03, 0, 0, -0.36 - i * 0.07, glow, 8);
      B(0.03, 0.035, 0.12, 0, 0.08, -0.08, dark); T(0.03, 0.08, 0, 0, -0.56, dark, 6);
      return finish(g, -0.62, 0.0, 0.1, [0.2, -0.19, -0.36], -0.3, el.hex);
    case 'linear':
      B(0.09, 0.12, 0.5, 0, 0, -0.1, body); B(0.05, 0.05, 0.42, 0, 0.0, -0.55, dark); B(0.06, 0.12, 0.24, 0, -0.02, 0.24, dark);
      B(0.04, 0.12, 0.05, 0, -0.1, 0.03, dark, -0.3); T(0.032, 0.26, 0, 0.11, -0.08, dark, 8);
      for (let i = 0; i < 4; i++) B(0.1, 0.02, 0.03, 0, 0.0, -0.32 - i * 0.07, glow);
      B(0.092, 0.016, 0.3, 0, 0.06, -0.12, glow);
      return finish(g, -0.8, 0.0, 0.11, [0.21, -0.2, -0.36], -0.3, el.hex);
    case 'rocket':
      T(0.075, 0.95, 0, 0.02, -0.18, body, 8); T(0.09, 0.08, 0, 0.02, -0.66, dark, 8); T(0.09, 0.1, 0, 0.02, 0.3, dark, 8);
      B(0.04, 0.12, 0.05, 0, -0.1, 0.0, dark, -0.3); B(0.04, 0.12, 0.05, 0, -0.1, -0.3, dark, -0.3);
      B(0.03, 0.06, 0.12, -0.09, 0.08, -0.15, dark); B(0.155, 0.02, 0.2, 0, 0.02, -0.2, glow);
      return finish(g, -0.72, 0.02, 0.1, [0.24, -0.14, -0.34], -0.26, 0xffb060);
    case 'mg':
      B(0.11, 0.14, 0.5, 0, 0, -0.1, body); T(0.022, 0.4, 0, 0.02, -0.55, dark); T(0.04, 0.16, 0, 0.02, -0.42, mid, 6);
      B(0.1, 0.14, 0.14, 0.03, -0.12, -0.06, dark); B(0.06, 0.11, 0.2, 0, -0.01, 0.25, dark); B(0.04, 0.12, 0.05, 0, -0.1, 0.06, dark, -0.3);
      B(0.03, 0.04, 0.12, 0, 0.09, -0.08, dark); B(0.112, 0.02, 0.24, 0, 0.04, -0.15, glow);
      return finish(g, -0.76, 0.02, 0.11, [0.22, -0.2, -0.36], -0.3, fc);
    case 'glauncher': {
      B(0.08, 0.1, 0.36, 0, 0, -0.08, body); T(0.045, 0.3, 0, 0.03, -0.38, dark, 8);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 6), mid); drum.rotation.x = Math.PI / 2; drum.position.set(0, -0.03, -0.12); g.add(drum);
      B(0.06, 0.1, 0.18, 0, -0.02, 0.18, dark); B(0.04, 0.12, 0.05, 0, -0.1, 0.05, dark, -0.3); B(0.03, 0.04, 0.08, 0, 0.075, -0.06, dark);
      T(0.092, 0.03, 0, -0.03, -0.12, glow, 6);
      return finish(g, -0.55, 0.03, 0.095, [0.21, -0.19, -0.36], -0.3, fc);
    }
    default:
      throw new Error(`buildGunModel: unknown archetype ${item.arch}`);
  }
}

export function buildSuperModel(type) {
  const g = new THREE.Group();
  const { B, T } = kit(g);
  if (type === 'hammers') {
    const glow = mat(0xff8b2b, { emissive: 0xff8b2b, emissiveIntensity: 2.2 });
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.4, 6), mat(0x5a3a22));
    h.position.set(0, 0, -0.1); h.rotation.x = -0.4; g.add(h);
    B(0.2, 0.12, 0.12, 0, 0.18, -0.18, glow);
    return finish(g, -0.2, 0.15, 0.2, [0.24, -0.2, -0.4], -0.4, 0xff8b2b);
  }
  if (type === 'revolver') {
    const gold = mat(0xd9b04a, { metalness: 0.6, roughness: 0.35 });
    const glow = mat(0x5fd3ff, { emissive: 0x5fd3ff, emissiveIntensity: 2 });
    B(0.065, 0.1, 0.26, 0, 0.01, -0.1, gold); T(0.024, 0.24, 0, 0.02, -0.33, gold); T(0.05, 0.08, 0, -0.005, -0.1, glow, 6);
    B(0.05, 0.14, 0.06, 0, -0.1, 0.03, mat(0x2a1f10), -0.35); B(0.068, 0.016, 0.16, 0, 0.06, -0.12, glow);
    return finish(g, -0.46, 0.02, 0.075, [0.18, -0.17, -0.36], -0.32, 0x5fd3ff);
  }
  // nova: a ball of void in the palm
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), new THREE.MeshBasicMaterial({ color: 0xe6d0ff }));
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshBasicMaterial({ color: 0xb07cff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.position.set(0, 0.06, -0.2); shell.position.copy(core.position); g.add(core, shell);
  return finish(g, -0.2, 0.06, 0.06, [0.16, -0.18, -0.38], -0.4, 0xb07cff);
}
