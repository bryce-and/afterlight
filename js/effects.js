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

function add(mesh, life, update, dispose) {
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
