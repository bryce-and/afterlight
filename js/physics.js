import * as THREE from 'three';
import { G } from './state.js';
import { rayGround, reportNonFinite } from './colliders.js';

export * from './colliders.js';

const ray = new THREE.Raycaster();
const _d = new THREE.Vector3();

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
