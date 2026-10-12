import * as THREE from 'three';
import { G } from './state.js';

const ray = new THREE.Raycaster();
const _d = new THREE.Vector3();

function overlaps(p, r, h, c) {
  return p.x + r > c.min.x && p.x - r < c.max.x && p.z + r > c.min.z && p.z - r < c.max.z && p.y + h > c.min.y && p.y < c.max.y;
}

function blockedAt(p, r, h, y) {
  const q = { x: p.x, y, z: p.z };
  return G.colliders.some((c) => overlaps(q, r, h, c));
}

function pushOutMin(p, r, c) {
  const pen = [
    ['x', c.min.x - r - 1e-3, p.x + r - c.min.x],
    ['x', c.max.x + r + 1e-3, c.max.x - (p.x - r)],
    ['z', c.min.z - r - 1e-3, p.z + r - c.min.z],
    ['z', c.max.z + r + 1e-3, c.max.z - (p.z - r)],
  ].sort((a, b) => a[2] - b[2])[0];
  p[pen[0]] = pen[1];
}

/** Axis-separated AABB movement for the player. Mutates pos & vel. */
export function moveBody(pos, vel, dt, r, h, stepUp = 0.6) {
  const C = G.colliders;
  const res = { onGround: false, hitWall: false };
  for (const axis of ['x', 'z']) {
    pos[axis] += vel[axis] * dt;
    for (const c of C) {
      if (!overlaps(pos, r, h, c)) continue;
      if (c.max.y - pos.y <= stepUp && vel.y <= 0.5 && !blockedAt(pos, r, h, c.max.y)) { pos.y = c.max.y; continue; }
      if (vel[axis] > 0) pos[axis] = c.min[axis] - r - 1e-3;
      else if (vel[axis] < 0) pos[axis] = c.max[axis] + r + 1e-3;
      else pushOutMin(pos, r, c);
      res.hitWall = true;
    }
  }
  const prevY = pos.y;
  pos.y += vel.y * dt;
  for (const c of C) {
    if (!overlaps(pos, r, h, c)) continue;
    if (vel.y <= 0 && prevY >= c.max.y - 0.02) { pos.y = c.max.y; vel.y = 0; }
    else if (vel.y > 0) { pos.y = Math.max(prevY, c.min.y - h - 1e-3); vel.y = 0; }
  }
  if (pos.y <= 0) { pos.y = 0; if (vel.y < 0) vel.y = 0; }
  res.onGround = pos.y <= 1e-3 || C.some((c) => Math.abs(pos.y - c.max.y) < 0.03 &&
    pos.x + r > c.min.x && pos.x - r < c.max.x && pos.z + r > c.min.z && pos.z - r < c.max.z);
  return res;
}

/** Push a ground-bound circle (enemies) out of colliders in XZ. */
export function pushOutCircle(pos, r, h) {
  for (const c of G.colliders) {
    if (pos.y + h <= c.min.y || pos.y >= c.max.y) continue;
    const nx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
    const nz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * r;
      pos.z = nz + (dz / d) * r;
    } else {
      pushOutMin(pos, r, c);
    }
  }
}

export function pointInColliders(p, pad = 0) {
  for (const c of G.colliders) {
    if (p.x > c.min.x - pad && p.x < c.max.x + pad && p.y > c.min.y - pad && p.y < c.max.y + pad && p.z > c.min.z - pad && p.z < c.max.z + pad) return c;
  }
  return null;
}

export function hasLOS(a, b) {
  _d.subVectors(b, a);
  const dist = _d.length();
  if (dist < 0.01) return true;
  _d.divideScalar(dist);
  ray.set(a, _d);
  ray.far = dist;
  return ray.intersectObjects(G.staticMeshes, false).length === 0;
}
