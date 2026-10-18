import * as THREE from 'three';
import { G } from './state.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const ico = new THREE.IcosahedronGeometry(1, 1);
const ring = new THREE.RingGeometry(0.88, 1, 32).rotateX(-Math.PI / 2);
const basicCache = new Map();

export function basicMat(color, additive = false) {
  const k = color + (additive ? 'a' : '');
  let m = basicCache.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color, transparent: additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !additive, side: additive ? THREE.DoubleSide : THREE.FrontSide,
    });
    basicCache.set(k, m);
  }
  return m;
}

const items = [];
let lights = [], lightIdx = 0;

export function initEffects(scene) {
  items.length = 0;
  lights = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 10, 2);
    scene.add(l);
    lights.push({ light: l, t: 0, max: 1, base: 0 });
  }
}

export function clearEffects() { items.length = 0; lights = []; }

export function flashLight(pos, color, intensity = 20, dist = 10, life = 0.08) {
  if (!lights.length) return;
  const L = lights[lightIdx++ % lights.length];
  L.light.position.copy(pos);
  L.light.color.setHex(color);
  L.light.distance = dist;
  L.base = intensity; L.t = life; L.max = life;
  L.light.intensity = intensity;
}

const MAX_ITEMS = 1400;
function add(mesh, life, update, dispose) {
  if (items.length >= MAX_ITEMS) { dispose?.(); return; }
  G.scene.add(mesh);
  items.push({ mesh, life, max: life, update, dispose });
}

export function sparks(pos, color, n = 6, speed = 6, size = 0.07, life = 0.35) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(box, basicMat(color));
    m.scale.setScalar(size);
    m.position.copy(pos);
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5)
      .normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
    add(m, life * (0.6 + Math.random() * 0.6), (f, dt) => {
      v.y -= 14 * dt;
      m.position.addScaledVector(v, dt);
      m.scale.setScalar(size * (f.life / f.max));
      m.rotation.x += dt * 10;
    });
  }
}

export function tracer(from, to, color, width = 0.025, life = 0.06) {
  const len = from.distanceTo(to);
  if (len < 0.1) return;
  const m = new THREE.Mesh(box, basicMat(color, true));
  m.position.lerpVectors(from, to, 0.5);
  m.lookAt(to);
  m.scale.set(width, width, len);
  add(m, life, (f) => { const k = f.life / f.max; m.scale.x = m.scale.y = width * k; });
}

export function ringFx(pos, radius, color, life = 0.5) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(ring, mat);
  m.position.set(pos.x, Math.max(0.08, pos.y < 1 ? 0.08 : pos.y), pos.z);
  add(m, life, (f) => {
    const k = 1 - f.life / f.max;
    m.scale.setScalar(radius * (0.2 + 0.8 * Math.sqrt(k)));
    mat.opacity = 0.8 * (1 - k);
  }, () => mat.dispose());
}

export function explosionFx(pos, radius, color) {
  if (color === VOID_FX.mid) { voidBurst(pos, radius); return; } // U9: every Void explosion uses the Void look
  const m1 = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Mesh(ico, m1);
  s.position.copy(pos);
  add(s, 0.45, (f) => {
    const k = 1 - f.life / f.max;
    s.scale.setScalar(radius * (0.2 + 0.85 * Math.sqrt(k)));
    m1.opacity = 0.85 * (1 - k);
  }, () => m1.dispose());
  const m2 = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const c = new THREE.Mesh(ico, m2);
  c.position.copy(pos);
  add(c, 0.2, (f) => { const k = 1 - f.life / f.max; c.scale.setScalar(radius * 0.4 * (0.5 + k)); m2.opacity = 1 - k; }, () => m2.dispose());
  sparks(pos, color, 12, radius * 2.5, 0.12, 0.6);
  flashLight(pos, color, 40 * radius, radius * 5, 0.25);
  ringFx(pos, radius * 1.1, color, 0.45);
}

// ---------------------------------------------------------------------------
// Void (U9): a dark core, a purple shell with a dark rim, and an implosion before the blast.
// Explosions, grenades, Nova Bomb, Nova Warp and the Void fields share these, so Void reads the same everywhere.
// ---------------------------------------------------------------------------
export const VOID_FX = { core: 0x14061f, mid: 0xb07cff, hi: 0xe6d0ff, rim: 0x3a1460 };
const voidCoreMat = () => new THREE.MeshBasicMaterial({ color: VOID_FX.core, transparent: true, opacity: 0.9, depthWrite: false });

/** A dark mote that is pulled into a point (normal blending, so it stays dark against bright skies). */
export function voidMote(center, radius, life = 0.3, size = 0.12) {
  const m = new THREE.Mesh(box, basicMat(VOID_FX.core));
  const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 - 0.2, Math.random() - 0.5).normalize();
  add(m, life, (f) => {
    const k = f.life / f.max; // 1 to 0: from the edge into the center
    m.position.copy(center).addScaledVector(dir, radius * k);
    m.scale.setScalar(size * (0.3 + 0.7 * k));
    m.rotation.set(k * 6, k * 4, 0);
  });
}

/** A ring that fades from purple to a dark rim as it spreads. */
export function voidRing(pos, radius, life = 0.55) {
  ringFx(pos, radius, VOID_FX.mid, life);
  const mat = fade(VOID_FX.rim, 0.75);
  const m = new THREE.Mesh(ring, mat);
  m.position.set(pos.x, Math.max(0.1, pos.y < 1 ? 0.1 : pos.y + 0.02), pos.z);
  add(m, life, (f) => {
    const k = 1 - f.life / f.max;
    m.scale.setScalar(radius * (0.25 + 0.85 * Math.sqrt(k)));
    mat.opacity = 0.75 * (1 - k);
  }, () => mat.dispose());
}

/** Void explosion: particles rush in, the core collapses, then a dark core and a purple shell burst out. */
export function voidBurst(pos, radius) {
  const n = Math.min(26, 8 + Math.round(radius * 3));
  for (let i = 0; i < n; i++) swirl(pos, radius * 1.3, i % 3 ? VOID_FX.hi : VOID_FX.mid, 0.2, true, 0.1, radius * 0.5);
  for (let i = 0; i < Math.min(10, 3 + Math.round(radius)); i++) voidMote(pos, radius * 1.2, 0.2);
  const IMP = 0.3; // share of the life spent imploding
  const shell = new THREE.MeshBasicMaterial({ color: VOID_FX.mid, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Mesh(ico, shell);
  s.position.copy(pos);
  add(s, 0.6, (f) => {
    const k = 1 - f.life / f.max;
    s.scale.setScalar(k < IMP ? radius * 0.3 * (1 - k / IMP) + 0.05 : radius * Math.sqrt((k - IMP) / (1 - IMP)));
    shell.opacity = k < IMP ? 0.9 : 0.8 * (1 - (k - IMP) / (1 - IMP));
  }, () => shell.dispose());
  const coreM = voidCoreMat();
  const c = new THREE.Mesh(ico, coreM);
  c.position.copy(pos);
  add(c, 0.6, (f) => {
    const k = 1 - f.life / f.max;
    c.scale.setScalar(k < IMP ? radius * 0.18 * (1 - k / IMP) + 0.04 : radius * 0.45 * Math.sin(Math.min(1, (k - IMP) / (1 - IMP)) * Math.PI));
    coreM.opacity = 0.9 * (1 - k * 0.6);
  }, () => coreM.dispose());
  // the burst itself, once the implosion finishes
  add(new THREE.Object3D(), 0.6 * IMP, null, () => {
    if (!G.scene) return;
    voidRing(pos, radius * 1.15, 0.55);
    sparks(pos, VOID_FX.hi, 10, radius * 2.2, 0.1, 0.5);
    flashLight(pos, VOID_FX.mid, 40 * radius, radius * 5, 0.3);
  });
  flashLight(pos, VOID_FX.hi, 12 * radius, radius * 3, 0.15);
}

export function lightning(a, b, color = 0x5fd3ff, width = 0.05) {
  const segs = 6;
  let prev = a.clone();
  const len = a.distanceTo(b);
  for (let i = 1; i <= segs; i++) {
    const p = new THREE.Vector3().lerpVectors(a, b, i / segs);
    if (i < segs) p.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(len * 0.12));
    tracer(prev, p, color, width, 0.18);
    prev = p;
  }
  flashLight(b, color, 30, 8, 0.1);
}

// ---------------------------------------------------------------------------
// Flashier primitives for abilities and supers
// ---------------------------------------------------------------------------
const cyl = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
// big glow shapes use normal blending so they keep their colour against bright skies
const fade = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });

/** Additive glowing particles. rise > 0 floats them up, rise < 0 lets them fall. */
export function glowBurst(pos, color, n = 12, speed = 6, size = 0.1, life = 0.6, rise = 2, up = 0.3) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(box, basicMat(color, true));
    m.scale.setScalar(size);
    m.position.copy(pos);
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5 + up, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.9));
    add(m, life * (0.5 + Math.random() * 0.7), (f, dt) => {
      v.y += rise * dt;
      v.multiplyScalar(Math.exp(-2.5 * dt));
      m.position.addScaledVector(v, dt);
      m.scale.setScalar(size * (f.life / f.max));
      m.rotation.y += dt * 6;
    });
  }
}

/** One drifting ember, for projectile trails. */
export function ember(pos, color, size = 0.08, life = 0.35, drift = 0.6) {
  glowBurst(pos, color, 1, drift, size, life, 1.5, 0);
}

/** A hot beam: white core inside a coloured glow that lingers. */
export function beam(from, to, color, width = 0.1, life = 0.3) {
  tracer(from, to, 0xffffff, width * 0.35, life * 0.7);
  tracer(from, to, color, width, life);
  tracer(from, to, color, width * 2.4, life * 0.5);
}

/** Ground shockwave: two expanding rings plus a rising wall of light. */
export function shockwave(pos, radius, color, life = 0.6) {
  ringFx(pos, radius, color, life);
  ringFx(pos, radius * 0.6, 0xffffff, life * 0.6);
  const mat = fade(color, 0.5);
  const m = new THREE.Mesh(cyl, mat);
  m.position.set(pos.x, Math.max(0, pos.y - 0.2), pos.z);
  add(m, life, (f) => {
    const k = 1 - f.life / f.max;
    const r = radius * (0.15 + 0.9 * Math.sqrt(k));
    m.scale.set(r, 1.6 * (1 - k) + 0.2, r);
    m.position.y = Math.max(0, pos.y - 0.2) + m.scale.y / 2;
    mat.opacity = 0.5 * (1 - k);
  }, () => mat.dispose());
}

/** Vertical column of light. */
export function pillar(pos, radius, height, color, life = 0.8, opacity = 0.35) {
  const mat = fade(color, opacity);
  const m = new THREE.Mesh(cyl, mat);
  m.position.set(pos.x, height / 2, pos.z);
  m.scale.set(radius, height, radius);
  add(m, life, (f, dt) => {
    const k = f.life / f.max;
    mat.opacity = opacity * Math.min(1, k * 2);
    m.scale.x = m.scale.z = radius * (0.6 + 0.4 * k);
    m.rotation.y += dt * 2;
  }, () => mat.dispose());
}

/** Quick expanding glow sphere. */
export function flare(pos, color, size = 1, life = 0.25) {
  const mat = fade(color, 0.9);
  const m = new THREE.Mesh(ico, mat);
  m.position.copy(pos);
  add(m, life, (f) => {
    const k = 1 - f.life / f.max;
    m.scale.setScalar(size * (0.3 + k));
    mat.opacity = 0.9 * (1 - k);
  }, () => mat.dispose());
}

/** Particle that spirals into (inward) or out of a centre point. */
export function swirl(center, radius, color, life = 0.8, inward = true, size = 0.09, height = 1.2) {
  const m = new THREE.Mesh(box, basicMat(color, true));
  m.scale.setScalar(size);
  let a = Math.random() * Math.PI * 2;
  const y0 = center.y + (Math.random() - 0.3) * height;
  add(m, life, (f, dt) => {
    const k = f.life / f.max;
    const r = inward ? radius * k : radius * (1 - k);
    a += dt * (inward ? 7 : 3) * (1.5 - k);
    m.position.set(center.x + Math.cos(a) * r, inward ? y0 * k + center.y * (1 - k) : center.y + (1 - k) * height, center.z + Math.sin(a) * r);
    m.scale.setScalar(size * (0.4 + 0.6 * k));
  });
}

/** Particle that flies from a point toward a moving target (e.g. drained energy). */
export function homingMote(from, getTarget, color, life = 0.6, size = 0.1) {
  const m = new THREE.Mesh(box, basicMat(color, true));
  m.scale.setScalar(size);
  m.position.copy(from).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.6));
  const v = new THREE.Vector3(Math.random() - 0.5, Math.random() + 0.3, Math.random() - 0.5).multiplyScalar(5);
  add(m, life, (f, dt) => {
    const t = getTarget();
    const to = t.clone().sub(m.position);
    v.lerp(to.multiplyScalar(4), Math.min(1, dt * 6));
    m.position.addScaledVector(v, dt);
    if (m.position.distanceTo(t) < 0.4) f.life = 0.0001;
  });
}

/** Translucent copy of a capsule at a spot, fading out (dodge afterimage). */
export function afterimage(pos, color, life = 0.5) {
  const mat = fade(color, 0.45);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.0, 4, 8), mat);
  m.position.set(pos.x, pos.y + 0.9, pos.z);
  add(m, life, (f) => { const k = f.life / f.max; mat.opacity = 0.45 * k; m.scale.setScalar(1 + (1 - k) * 0.3); }, () => { mat.dispose(); m.geometry.dispose(); });
}

export function updateEffects(dt) {
  for (let i = items.length - 1; i >= 0; i--) {
    const f = items[i];
    f.life -= dt;
    if (f.life <= 0) {
      f.mesh.parent?.remove(f.mesh);
      f.dispose?.();
      items.splice(i, 1);
      continue;
    }
    f.update?.(f, dt);
  }
  for (const L of lights) {
    if (L.t > 0) { L.t -= dt; L.light.intensity = L.base * Math.max(0, L.t / L.max); }
    else L.light.intensity = 0;
  }
}
