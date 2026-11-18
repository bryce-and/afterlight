import * as THREE from 'three';
import { G } from './state.js';
import { rayGround, reportNonFinite } from './colliders.js';

export * from './colliders.js';

const ray = new THREE.Raycaster();
const _d = new THREE.Vector3();

/** H32: distance along a ray to the nearest wall, prop or hill (static meshes and the terrain), or Infinity. The Strand grapple fires with it. */
export function rayWorld(origin, dir, far) {
  ray.set(origin, dir);
  ray.far = far;
  const hit = ray.intersectObjects(G.staticMeshes, false)[0];
  return Math.min(hit ? hit.distance : Infinity, G.level?.groundAt || dir.y < -1e-4 ? rayGround(origin, dir, far) : Infinity);
}
export function hasLOS(a, b) {
  _d.subVectors(b, a);
  const dist = _d.length();
  if (!Number.isFinite(dist)) { reportNonFinite('hasLOS', a, b); return false; } // H28: a NaN eye or target sees nothing
  if (dist < 0.01) return true;
  _d.divideScalar(dist);
  ray.set(a, _d);
  ray.far = dist;
  if (G.level?.groundAt && rayGround(a, _d, dist) < dist - 0.05) return false; // a hill in the way (U16e)
  return ray.intersectObjects(G.staticMeshes, false).length === 0;
}
