import * as THREE from 'three';

// U29: shared primitives for the per-faction boss builders (js/bosses-fallen.js, bosses-scorn.js, ...).
// Every helper takes the buildModel kit `c` from enemies.js and tags weak-point meshes with crit = true.
export const PI = Math.PI;

export const cone = (c, r, h, seg, m, x, y, z, p, crit = false, rot = null) => c.add(new THREE.ConeGeometry(r, h, seg), m, x, y, z, p, crit, rot);
export const cyl = (c, rt, rb, h, seg, m, x, y, z, p, crit = false, rot = null) => c.add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, p, crit, rot);
export const ico = (c, r, det, m, x, y, z, p, crit = false) => c.add(new THREE.IcosahedronGeometry(r, det), m, x, y, z, p, crit);
export const tor = (c, r, tube, m, x, y, z, p, crit = false, rot = null, seg = 10) => c.add(new THREE.TorusGeometry(r, tube, 4, seg), m, x, y, z, p, crit, rot);

/** Two legs; digitigrade bends the knee backward. Pushes both hips into c.legs. */
export function legs(c, hipY, hipW, thick, m, foot, digi = false) {
  for (const s of [-1, 1]) {
    const hip = c.pivot(s * hipW, hipY, 0);
    const L = hipY / 2;
    if (digi) {
      c.B(thick, L * 1.05, thick * 1.1, 0, -L * 0.48, 0.07, m, hip, false, [-0.32, 0, 0]);
      c.B(thick * 0.8, L * 1.05, thick * 0.9, 0, -L * 1.45, 0.06, m, hip, false, [0.3, 0, 0]);
    } else {
      c.B(thick, L, thick * 1.1, 0, -L * 0.5, 0, m, hip);
      c.B(thick * 0.95, L, thick, 0, -L * 1.5, 0, m, hip);
    }
    c.B(thick * 1.1, 0.09, thick * 1.8, 0, -hipY + 0.045, 0.06, foot, hip);
    c.legs.push(hip);
  }
}

/** A swinging arm pivot with one box limb; callers push the ones that animate into c.arms. */
export function arm(c, parent, x, y, len, thick, m, lift = -1.1, rz = 0) {
  const p = c.pivot(x, y, 0, parent);
  c.B(thick, len, thick, 0, -len / 2, 0, m, p);
  p.rotation.x = lift;
  p.rotation.z = rz;
  return p;
}

/** Gun fixed to a parent; places the muzzle at its front. */
export function gun(c, parent, x, y, z, len, thick, glow = true) {
  c.B(thick, thick * 1.2, len, x, y, z, c.dark, parent);
  if (glow) c.B(thick * 0.5, thick * 0.4, len * 0.4, x, y + thick * 0.7, z, c.accent, parent);
  c.muzzle.position.set(x, y, z + len / 2 + 0.03);
  parent.add(c.muzzle);
}
