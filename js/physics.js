import * as THREE from 'three';
import { G } from './state.js';

export * from './colliders.js';

const ray = new THREE.Raycaster();
const _d = new THREE.Vector3();

export function hasLOS(a, b) {
  _d.subVectors(b, a);
  const dist = _d.length();
  if (dist < 0.01) return true;
  _d.divideScalar(dist);
  ray.set(a, _d);
  ray.far = dist;
  return ray.intersectObjects(G.staticMeshes, false).length === 0;
}
