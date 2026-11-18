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

/**
 * U29: a boss is the faction's own unit model, grown and made more imposing (Bryce, 2026-11-17: "a knight boss is the knight scaled up and a
 * little more intimidating"). Builds `unit(c)` into the kit, lets `decorate(c)` add horns, plates and glow in the unit's own space (c.torso is set
 * by then), then scales everything up to `height` so the hit height stays what the boss had before.
 * `critCap` is the most weak-point volume (bounding box, m3 at the final size) the boss may have: the old model's. Crit meshes furthest from the
 * weak-point centre lose their crit tag until the rest fit, so a grown head looks as big as it does but the precision area does not grow.
 */
export function grow(c, unit, height, decorate = null, critCap = null) {
  unit(c);
  if (decorate) decorate(c);
  const k = height / c.height;
  for (const ch of c.g.children) { ch.position.multiplyScalar(k); ch.scale.multiplyScalar(k); }
  c.height = height;
  if (critCap) capCrit(c, critCap);
}

function capCrit(c, cap) {
  c.g.updateMatrixWorld(true);
  const crits = [];
  c.g.traverse((o) => { if (o.isMesh && o.userData.crit) { o.userData.cb = new THREE.Box3().setFromObject(o); crits.push(o); } });
  if (!crits.length) return;
  const vol = (b) => { const s = b.getSize(new THREE.Vector3()); return s.x * s.y * s.z; };
  const all = new THREE.Box3();
  for (const o of crits) all.union(o.userData.cb);
  if (vol(all) <= cap) { for (const o of crits) delete o.userData.cb; return; }
  const ctr = all.getCenter(new THREE.Vector3());
  crits.sort((a, b) => a.userData.cb.getCenter(new THREE.Vector3()).distanceTo(ctr) - b.userData.cb.getCenter(new THREE.Vector3()).distanceTo(ctr));
  const keep = new THREE.Box3();
  for (const o of crits) {
    const next = keep.clone().union(o.userData.cb);
    if (!keep.isEmpty() && vol(next) > cap) o.userData.crit = false; else keep.copy(next);
    delete o.userData.cb;
  }
}

// ---- intimidation decor, in the unit's torso space (a unit's head sits near y 0.9, its shoulders near x +-0.38, y 0.75) ----
/** A pair of horns rising from (+-x, y, z), tilted out by `spread` and `n` tines long. */
export function horns(c, p, y, z, n, len, m, x = 0.12, spread = 0.5) {
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) cone(c, 0.05 - i * 0.008, len - i * 0.1, 4, m, s * (x + i * 0.07), y + i * 0.05, z, p, false, [-0.15, 0, -s * (spread + i * 0.25)]);
}
/** Rows of spikes standing off both shoulders. */
export function shoulderSpikes(c, p, x, y, n, len, m, z = -0.04) {
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) cone(c, 0.05, len - i * 0.05, 4, m, s * (x + i * 0.08), y + i * 0.06, z + i * 0.05, p, false, [-0.15, 0, -s * (0.35 + i * 0.12)]);
}
/** A cape hanging from the shoulders down the back. */
export function cape(c, p, w, len, m, y = 0.7, z = -0.22) {
  c.B(w, 0.14, 0.14, 0, y, z, m, p);
  c.B(w * 0.95, len, 0.03, 0, y - len / 2, z - 0.06, m, p, false, [0.14, 0, 0]);
}
/** A row of spines down the back from the neck to the waist. */
export function backSpines(c, p, n, len, m, y0 = 0.75, y1 = 0.2, z = -0.2) {
  for (let i = 0; i < n; i++) cone(c, 0.04, len * (1 - i * 0.08), 4, m, 0, y0 + (y1 - y0) * (i / Math.max(1, n - 1)), z - i * 0.01, p, false, [-0.9, 0, 0]);
}
