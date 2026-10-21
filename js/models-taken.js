import * as THREE from 'three';
import { mat } from './world.js';

// ---------------------------------------------------------------------------
// TAKEN: Hive, Fallen and Cabal bent by the Darkness. Near-black silhouettes,
// thin white-blue edges of Light, blazing orb faces, drifting Blight wisps.
// Same builder contract as the faction builders in enemies.js:
// face +z, stand on y = 0, c.torso / c.legs / c.arms / c.muzzle set per unit.
// ---------------------------------------------------------------------------

let _blight = null, _halo = null;
function blightMats() {
  if (!_blight) {
    _blight = mat(0x050609);
    _halo = new THREE.MeshBasicMaterial({ color: 0x9ab8ff, transparent: true, opacity: 0.35, depthWrite: false });
  }
  return [_blight, _halo];
}

/** Two legs; digitigrade bends the knee backward (copy of enemies.js legsBiped). */
function legsBiped(c, hipY, hipW, thick, m, foot, digi = false) {
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

/** Gun held at chest height; places the muzzle at its front (copy of enemies.js gun). */
function gun(c, parent, x, y, z, len, thick, glow = true) {
  c.B(thick, thick * 1.2, len, x, y, z, c.dark, parent);
  if (glow) c.B(thick * 0.5, thick * 0.4, len * 0.4, x, y + thick * 0.7, z, c.accent, parent);
  c.muzzle.position.set(x, y, z + len / 2 + 0.03);
  parent.add(c.muzzle);
}

function arm(c, parent, x, y, len, thick, m, lift = -1.1, rz = 0) {
  const p = c.pivot(x, y, 0, parent);
  c.B(thick, len, thick, 0, -len / 2, 0, m, p);
  p.rotation.x = lift;
  p.rotation.z = rz;
  return p;
}

/** Thin strip of Light. */
function edge(c, parent, w, h, d, x, y, z, r = null) {
  return c.B(w, h, d, x, y, z, c.accent, parent, false, r);
}

/** Glowing orb (face / eye). Crit by default. */
function orb(c, parent, x, y, z, rad, crit = true) {
  return c.add(new THREE.IcosahedronGeometry(rad, 1), c.accent, x, y, z, parent, crit);
}

/** n Blight wisps circling (cx, cy, cz): dark core plus a pale non-hittable halo. */
function wisps(c, parent, n, radius, cx, cy, cz, size = 0.07, phase = 0) {
  const [blight, halo] = blightMats();
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * radius, z = cz + Math.sin(a) * radius, y = cy + (i % 2 ? 0.14 : -0.1);
    c.add(new THREE.IcosahedronGeometry(size, 0), blight, x, y, z, parent);
    const h = new THREE.Mesh(new THREE.IcosahedronGeometry(size * 1.8, 0), halo);
    h.position.set(x, y, z);
    parent.add(h);
  }
}

/** Tattered hanging strips along x, each a different length and sway. */
function strips(c, parent, n, width, len, x0, x1, y, z, m, glowTips = false) {
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? x0 : x0 + ((x1 - x0) * i) / (n - 1);
    const l = len * (0.55 + ((i * 37) % 10) / 22);
    c.B(width, l, 0.02, x, y - l / 2, z, m, parent, false, [((i % 3) - 1) * 0.12, 0, ((i % 2) ? 1 : -1) * 0.08]);
    if (glowTips && i % 2 === 0) edge(c, parent, 0.012, l * 0.9, 0.012, x + width / 2, y - l / 2, z + 0.012);
  }
}

// ---------------------------------------------------------------------------
export function taken(c, t) {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  switch (t) {
    case 'tk_thrall': {
      // hunched, long clawed arms, digitigrade legs, orb face
      legsBiped(c, 0.85, 0.1, 0.08, dark, dark, true);
      const torso = pivot(0, 0.85, 0);
      torso.rotation.x = 0.6;
      c.torso = torso;
      B(0.24, 0.5, 0.18, 0, 0.3, 0, bodyMat, torso);
      for (let i = 0; i < 3; i++) B(0.26, 0.025, 0.2, 0, 0.2 + i * 0.1, 0.01, dark, torso);
      edge(c, torso, 0.02, 0.5, 0.02, 0, 0.3, -0.1);
      add(new THREE.ConeGeometry(0.11, 0.3, 6), dark, 0, 0.62, 0.05, torso, true, [0.9, 0, 0]);
      orb(c, torso, 0, 0.68, 0.16, 0.09);
      for (const s of [-1, 1]) {
        const a = arm(c, torso, s * 0.17, 0.5, 0.62, 0.05, bodyMat, -1.3, s * -0.1);
        edge(c, a, 0.012, 0.6, 0.012, s * 0.03, -0.31, 0);
        for (let k = -1; k <= 1; k++) add(new THREE.ConeGeometry(0.012, 0.16, 3), dark, k * 0.025, -0.68, 0.02, a, false, [Math.PI, 0, 0]);
        c.arms.push(a);
      }
      wisps(c, torso, 2, 0.32, 0, 0.35, -0.1, 0.05);
      c.muzzle.position.set(0, 0.5, 0.3); torso.add(c.muzzle);
      c.height = 1.8;
      return;
    }
    case 'tk_shadow': {
      // smaller, wispy, thin limbs
      for (const s of [-1, 1]) {
        const hip = pivot(s * 0.07, 0.6, 0);
        B(0.045, 0.62, 0.045, 0, -0.3, 0.02, dark, hip, false, [-0.15, 0, 0]);
        c.legs.push(hip);
      }
      const torso = pivot(0, 0.6, 0);
      torso.rotation.x = 0.5;
      c.torso = torso;
      B(0.16, 0.42, 0.12, 0, 0.24, 0, bodyMat, torso);
      edge(c, torso, 0.012, 0.42, 0.012, 0, 0.24, 0.07);
      add(new THREE.ConeGeometry(0.08, 0.24, 5), dark, 0, 0.54, 0.05, torso, true, [0.9, 0, 0]);
      orb(c, torso, 0, 0.58, 0.12, 0.06);
      for (const s of [-1, 1]) {
        const a = arm(c, torso, s * 0.11, 0.4, 0.55, 0.03, dark, -1.3, s * -0.1);
        edge(c, a, 0.008, 0.5, 0.008, 0, -0.28, 0.02);
        for (let k = -1; k <= 1; k++) add(new THREE.ConeGeometry(0.008, 0.13, 3), dark, k * 0.018, -0.6, 0.02, a, false, [Math.PI, 0, 0]);
        c.arms.push(a);
      }
      // trailing wisp tail
      B(0.04, 0.4, 0.02, 0, 0.1, -0.12, dark, torso, false, [0.7, 0, 0]);
      wisps(c, torso, 3, 0.25, 0, 0.3, 0, 0.04);
      c.muzzle.position.set(0, 0.4, 0.2); torso.add(c.muzzle);
      c.height = 1.5;
      return;
    }
    case 'tk_acolyte': {
      // tall hooded chitin humanoid, orb in the hood
      legsBiped(c, 1.0, 0.12, 0.1, dark, dark, true);
      const torso = pivot(0, 1.0, 0);
      torso.rotation.x = 0.1;
      c.torso = torso;
      B(0.28, 0.24, 0.2, 0, 0.12, 0, dark, torso);
      B(0.44, 0.46, 0.3, 0, 0.5, 0, bodyMat, torso);
      for (let i = 0; i < 3; i++) B(0.4, 0.035, 0.04, 0, 0.38 + i * 0.1, 0.16, dark, torso);
      edge(c, torso, 0.38, 0.015, 0.012, 0, 0.7, 0.16);
      edge(c, torso, 0.015, 0.46, 0.012, 0, 0.5, 0.165);
      // tall hood
      add(new THREE.ConeGeometry(0.2, 0.62, 5), dark, 0, 1.0, 0.0, torso, true);
      B(0.26, 0.22, 0.22, 0, 0.86, 0.02, bodyMat, torso, true);
      orb(c, torso, 0, 0.87, 0.14, 0.085);
      edge(c, torso, 0.22, 0.012, 0.012, 0, 0.99, 0.12);
      for (const s of [-1, 1]) {
        B(0.2, 0.12, 0.28, s * 0.3, 0.7, 0, dark, torso, false, [0, 0, s * -0.25]);
        add(new THREE.ConeGeometry(0.04, 0.3, 4), bodyMat, s * 0.36, 0.84, -0.02, torso, false, [0, 0, s * -0.6]);
      }
      c.arms.push(arm(c, torso, -0.29, 0.66, 0.55, 0.08, dark, -1.15, 0.1), arm(c, torso, 0.29, 0.66, 0.55, 0.08, dark, -1.15, -0.1));
      gun(c, torso, 0.16, 0.42, 0.42, 0.6, 0.08);
      strips(c, torso, 4, 0.07, 0.6, -0.12, 0.12, 0.05, 0.17, dark, true);
      wisps(c, torso, 2, 0.4, 0, 0.5, 0, 0.05, 1);
      c.height = 2.15;
      return;
    }
    case 'tk_vandal': {
      // four arms, four eyes, cloak
      legsBiped(c, 0.95, 0.15, 0.12, dark, bodyMat, true);
      const torso = pivot(0, 0.95, 0);
      torso.rotation.x = 0.22;
      c.torso = torso;
      B(0.26, 0.24, 0.2, 0, 0.12, 0, dark, torso);
      B(0.42, 0.38, 0.28, 0, 0.45, 0, bodyMat, torso);
      edge(c, torso, 0.36, 0.015, 0.012, 0, 0.6, 0.15);
      edge(c, torso, 0.015, 0.34, 0.012, 0, 0.45, 0.15);
      B(0.22, 0.18, 0.26, 0, 0.82, 0.07, dark, torso, true);
      for (const s of [-1, 1]) {
        B(0.04, 0.14, 0.12, s * 0.12, 0.74, 0.17, dark, torso, true, [0.3, 0, s * 0.2]);
        for (const dy of [0, 0.05]) B(0.035, 0.03, 0.03, s * 0.05, 0.84 - dy, 0.205, accent, torso, true);
      }
      add(new THREE.ConeGeometry(0.34, 0.4, 5, 1, true), dark, 0, 0.8, -0.04, torso);
      B(0.5, 0.8, 0.03, 0, 0.25, -0.17, dark, torso, false, [0.15, 0, 0]);
      edge(c, torso, 0.5, 0.012, 0.012, 0, -0.14, -0.2, [0.15, 0, 0]);
      const up = [arm(c, torso, -0.27, 0.62, 0.48, 0.08, bodyMat, -1.2, 0.1), arm(c, torso, 0.27, 0.62, 0.48, 0.08, bodyMat, -1.2, -0.1)];
      arm(c, torso, -0.2, 0.36, 0.38, 0.065, bodyMat, -0.9, 0.3);
      arm(c, torso, 0.2, 0.36, 0.38, 0.065, bodyMat, -0.9, -0.3);
      c.arms.push(...up);
      gun(c, torso, 0.12, 0.42, 0.45, 0.65, 0.08);
      strips(c, torso, 4, 0.08, 0.5, -0.18, 0.18, -0.1, -0.2, dark, true);
      wisps(c, torso, 2, 0.45, 0, 0.5, 0, 0.05);
      return;
    }
    case 'tk_psion': {
      // thin hovering alien with a big glowing dome
      for (const s of [-1, 1]) {
        const hip = pivot(s * 0.06, 0.75, 0);
        B(0.045, 0.5, 0.045, 0, -0.25, 0.02, dark, hip, false, [-0.1, 0, 0]);
        B(0.06, 0.04, 0.1, 0, -0.51, 0.04, dark, hip);
        c.legs.push(hip);
      }
      const torso = pivot(0, 0.75, 0);
      c.torso = torso;
      B(0.16, 0.2, 0.1, 0, 0.08, 0, dark, torso);
      B(0.2, 0.34, 0.13, 0, 0.35, 0, bodyMat, torso);
      edge(c, torso, 0.012, 0.34, 0.012, 0, 0.35, 0.07);
      B(0.05, 0.14, 0.05, 0, 0.59, 0, dark, torso);
      add(new THREE.IcosahedronGeometry(0.2, 1), dark, 0, 0.82, 0, torso, true).scale.set(1, 1.1, 1);
      orb(c, torso, 0, 0.82, 0.07, 0.15);
      for (const s of [-1, 1]) {
        const a = arm(c, torso, s * 0.13, 0.5, 0.55, 0.035, bodyMat, -0.9, s * -0.1);
        edge(c, a, 0.01, 0.5, 0.01, 0, -0.28, 0.02);
        c.arms.push(a);
      }
      gun(c, torso, 0.14, 0.28, 0.3, 0.3, 0.05);
      wisps(c, torso, 3, 0.36, 0, 0.4, 0, 0.045);
      c.hover = true;
      c.height = 1.7;
      return;
    }
    case 'tk_goblin': {
      // spherical shell, one big eye, hooked legs, projector ring
      const torso = pivot(0, 0.68, 0);
      c.torso = torso;
      add(new THREE.IcosahedronGeometry(0.4, 1), bodyMat, 0, 0, 0, torso);
      add(new THREE.TorusGeometry(0.4, 0.014, 4, 18), accent, 0, 0, 0, torso, false, [0, Math.PI / 2, 0]);
      add(new THREE.TorusGeometry(0.4, 0.014, 4, 18), accent, 0, 0, 0, torso, false, [Math.PI / 2, 0, 0]);
      add(new THREE.CylinderGeometry(0.17, 0.2, 0.06, 8).rotateX(Math.PI / 2), dark, 0, 0, 0.37, torso);
      orb(c, torso, 0, 0, 0.4, 0.11);
      // projector ring above
      B(0.06, 0.2, 0.06, 0, 0.5, 0, dark, torso);
      add(new THREE.TorusGeometry(0.26, 0.016, 4, 18).rotateX(Math.PI / 2), accent, 0, 0.7, 0, torso);
      // short hooked legs
      for (const [x, z] of [[-0.24, 0.18], [0.24, 0.18], [-0.24, -0.18], [0.24, -0.18]]) {
        const hip = pivot(x, 0.45, z);
        B(0.05, 0.3, 0.05, x * 0.2, -0.15, 0, dark, hip, false, [0, 0, x > 0 ? -0.3 : 0.3]);
        add(new THREE.ConeGeometry(0.03, 0.18, 4), dark, x * 0.55, -0.37, 0.02, hip, false, [Math.PI, 0, 0]);
        c.legs.push(hip);
      }
      for (const s of [-1, 1]) {
        const a = arm(c, torso, s * 0.36, -0.02, 0.28, 0.04, dark, -0.6, s * -0.4);
        c.arms.push(a);
      }
      gun(c, torso, 0, -0.2, 0.35, 0.2, 0.05);
      wisps(c, torso, 2, 0.55, 0, 0.1, 0, 0.045);
      c.height = 1.45;
      return;
    }
    case 'tk_wizard': {
      // floating robe, orb face, tattered hem, circling Blight
      const torso = pivot(0, 0.95, 0);
      c.torso = torso;
      add(new THREE.ConeGeometry(0.38, 1.0, 6), bodyMat, 0, -0.1, 0, torso);
      B(0.4, 0.3, 0.26, 0, 0.5, 0, dark, torso);
      edge(c, torso, 0.34, 0.015, 0.012, 0, 0.62, 0.14);
      edge(c, torso, 0.012, 0.8, 0.012, 0, 0.05, 0.3, [-0.35, 0, 0]);
      add(new THREE.ConeGeometry(0.2, 0.46, 5), dark, 0, 0.92, -0.02, torso, true);
      orb(c, torso, 0, 0.82, 0.1, 0.12);
      for (const s of [-1, 1]) {
        B(0.2, 0.1, 0.24, s * 0.26, 0.6, 0, dark, torso, false, [0, 0, s * -0.3]);
        const a = arm(c, torso, s * 0.28, 0.55, 0.65, 0.035, bodyMat, -1.0, s * -0.35);
        edge(c, a, 0.01, 0.6, 0.01, 0, -0.33, 0.02);
        c.arms.push(a);
      }
      // tattered hem
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, l = 0.3 + ((i * 5) % 4) * 0.08;
        B(0.08, l, 0.02, Math.sin(a) * 0.32, -0.62 - l / 2, Math.cos(a) * 0.32, dark, torso, false, [Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2]);
      }
      wisps(c, torso, 4, 0.75, 0, 0.35, 0, 0.07);
      c.muzzle.position.set(0, 0.6, 0.55); torso.add(c.muzzle);
      c.hover = true;
      c.height = 2.0;
      return;
    }
    case 'tk_captain': {
      // bigger four-armed Fallen, shredded cape, Kell crest
      const W = 1.3;
      legsBiped(c, 0.95, 0.15 * W, 0.12 * W, dark, bodyMat, true);
      const torso = pivot(0, 0.95, 0);
      torso.rotation.x = 0.2;
      c.torso = torso;
      B(0.26 * W, 0.24, 0.2, 0, 0.12, 0, dark, torso);
      B(0.42 * W, 0.38, 0.28, 0, 0.45, 0, bodyMat, torso);
      edge(c, torso, 0.38 * W, 0.015, 0.012, 0, 0.62, 0.15);
      edge(c, torso, 0.015, 0.36, 0.012, 0, 0.45, 0.15);
      B(0.22, 0.18, 0.26, 0, 0.84, 0.07, dark, torso, true);
      for (const s of [-1, 1]) {
        B(0.04, 0.14, 0.12, s * 0.12, 0.76, 0.17, dark, torso, true, [0.3, 0, s * 0.2]);
        for (const dy of [0, 0.05]) B(0.035, 0.03, 0.03, s * 0.05, 0.86 - dy, 0.205, accent, torso, true);
        B(0.26, 0.12, 0.32, s * 0.33, 0.68, 0, dark, torso, false, [0, 0, s * -0.3]);
        add(new THREE.ConeGeometry(0.03, 0.34, 4), dark, s * 0.09, 1.04, 0.02, torso, true, [-0.4, 0, s * -0.4]);
      }
      // Kell crest: tall central fin with a glowing edge
      B(0.03, 0.3, 0.28, 0, 1.02, -0.02, dark, torso, true, [0.35, 0, 0]);
      edge(c, torso, 0.012, 0.28, 0.012, 0, 1.08, 0.12, [0.35, 0, 0]);
      const up = [arm(c, torso, -0.27 * W, 0.62, 0.5, 0.09, bodyMat, -1.2, 0.1), arm(c, torso, 0.27 * W, 0.62, 0.5, 0.09, bodyMat, -1.2, -0.1)];
      arm(c, torso, -0.2 * W, 0.36, 0.4, 0.07, bodyMat, -0.9, 0.3);
      arm(c, torso, 0.2 * W, 0.36, 0.4, 0.07, bodyMat, -0.9, -0.3);
      c.arms.push(...up);
      gun(c, torso, 0.12, 0.42, 0.45, 0.75, 0.09);
      // long cape of shredded strips
      B(0.5 * W, 0.2, 0.03, 0, 0.7, -0.17, dark, torso, false, [0.1, 0, 0]);
      strips(c, torso, 7, 0.1, 1.3, -0.3 * W, 0.3 * W, 0.6, -0.19, dark, true);
      wisps(c, torso, 3, 0.55, 0, 0.5, 0, 0.06);
      c.height = 2.3;
      return;
    }
    case 'tk_centurion': {
      // big armoured Cabal, domed helmet, orb visor, no jetpack
      const W = 1.3;
      const metal = mat(0x0c0c10);
      legsBiped(c, 0.9, 0.17 * W, 0.17 * W, dark, metal);
      for (const s of [-1, 1]) B(0.2 * W, 0.24, 0.22, s * 0.17 * W, 0.62, 0.04, bodyMat);
      const torso = pivot(0, 0.9, 0);
      c.torso = torso;
      B(0.42 * W, 0.26, 0.3, 0, 0.12, 0, dark, torso);
      B(0.62 * W, 0.5, 0.42, 0, 0.5, 0, bodyMat, torso);
      B(0.5 * W, 0.18, 0.08, 0, 0.42, 0.22, metal, torso);
      edge(c, torso, 0.5 * W, 0.015, 0.012, 0, 0.72, 0.22);
      edge(c, torso, 0.015, 0.4, 0.012, 0, 0.5, 0.215);
      add(new THREE.IcosahedronGeometry(0.2, 1), bodyMat, 0, 0.95, 0.03, torso, true).scale.set(1, 0.95, 1.05);
      B(0.26, 0.12, 0.08, 0, 0.92, 0.19, dark, torso, true);
      orb(c, torso, 0, 0.92, 0.23, 0.065);
      for (const s of [-1, 1]) {
        B(0.3 * W, 0.2, 0.42, s * 0.42 * W, 0.72, 0, bodyMat, torso, false, [0, 0, s * -0.15]);
        edge(c, torso, 0.3 * W, 0.012, 0.012, s * 0.42 * W, 0.82, 0.21, [0, 0, s * -0.15]);
      }
      const arms = [arm(c, torso, -0.44 * W, 0.62, 0.55, 0.15, dark, -1.1, 0.12), arm(c, torso, 0.44 * W, 0.62, 0.55, 0.15, dark, -1.1, -0.12)];
      for (const a of arms) B(0.2, 0.22, 0.2, 0, -0.42, 0, bodyMat, a);
      c.arms.push(...arms);
      gun(c, torso, 0.2, 0.4, 0.45, 0.6, 0.12);
      // crest and torn cape
      B(0.04, 0.16, 0.36, 0, 1.15, 0.02, dark, torso, true);
      strips(c, torso, 3, 0.12, 0.8, -0.3 * W, -0.1, 0.7, -0.15, dark, true);
      wisps(c, torso, 2, 0.6, 0, 0.55, 0, 0.06, 0.5);
      c.height = 2.1;
      return;
    }
    case 'tk_phalanx': {
      // brute with a front slab shield; short weapon beside it
      const W = 1.4;
      const metal = mat(0x0c0c10);
      legsBiped(c, 0.9, 0.17 * W, 0.18 * W, dark, metal);
      for (const s of [-1, 1]) B(0.2 * W, 0.24, 0.22, s * 0.17 * W, 0.62, 0.04, bodyMat);
      const torso = pivot(0, 0.9, 0);
      c.torso = torso;
      B(0.42 * W, 0.26, 0.3, 0, 0.12, 0, dark, torso);
      B(0.62 * W, 0.5, 0.42, 0, 0.5, 0, bodyMat, torso);
      add(new THREE.IcosahedronGeometry(0.19, 1), bodyMat, 0, 0.9, 0.02, torso, true).scale.set(1.1, 0.9, 1);
      B(0.26, 0.08, 0.08, 0, 0.9, 0.17, dark, torso, true);
      orb(c, torso, 0, 0.9, 0.2, 0.05);
      for (const s of [-1, 1]) B(0.3 * W, 0.2, 0.42, s * 0.42 * W, 0.72, 0, bodyMat, torso, false, [0, 0, s * -0.15]);
      // shield slab: small, held out to the left of the body, edge-lit (its hitbox is `frontGuard.box` in factions.js)
      const sx = -0.62, sy = 0.3, sz = 0.5;
      B(0.55, 1.1, 0.1, sx, sy, sz, dark, torso);
      B(0.45, 0.98, 0.06, sx, sy, sz + 0.07, bodyMat, torso);
      edge(c, torso, 0.55, 0.018, 0.02, sx, sy + 0.55, sz + 0.06);
      edge(c, torso, 0.55, 0.018, 0.02, sx, sy - 0.55, sz + 0.06);
      edge(c, torso, 0.018, 1.1, 0.02, sx - 0.275, sy, sz + 0.06);
      edge(c, torso, 0.018, 1.1, 0.02, sx + 0.275, sy, sz + 0.06);
      edge(c, torso, 0.3, 0.03, 0.02, sx, sy + 0.32, sz + 0.11);
      // arms: left braces the shield, right holds the weapon
      const la = arm(c, torso, -0.44 * W, 0.62, 0.55, 0.15, dark, -1.3, 0.2);
      const ra = arm(c, torso, 0.44 * W, 0.62, 0.55, 0.15, dark, -1.1, -0.12);
      B(0.2, 0.22, 0.2, 0, -0.42, 0, bodyMat, la);
      B(0.2, 0.22, 0.2, 0, -0.42, 0, bodyMat, ra);
      c.arms.push(la, ra);
      gun(c, torso, 0.5, 0.4, 0.5, 0.7, 0.1);
      wisps(c, torso, 2, 0.7, 0, 0.5, -0.1, 0.06, 0.8);
      c.height = 2.15;
      return;
    }
    case 'tk_knight': {
      // tall armoured Hive, boomer, horned crest, orb eye
      const W = 1.25;
      legsBiped(c, 0.95, 0.13 * W, 0.11 * W, dark, dark, true);
      const torso = pivot(0, 0.95, 0);
      torso.rotation.x = 0.12;
      c.torso = torso;
      B(0.3 * W, 0.24, 0.22, 0, 0.12, 0, dark, torso);
      B(0.46 * W, 0.42, 0.3, 0, 0.47, 0, bodyMat, torso);
      for (let i = 0; i < 3; i++) B(0.4 * W, 0.04, 0.04, 0, 0.36 + i * 0.1, 0.16, dark, torso);
      edge(c, torso, 0.015, 0.4, 0.012, 0, 0.47, 0.19);
      edge(c, torso, 0.44 * W, 0.015, 0.012, 0, 0.7, 0.16);
      add(new THREE.IcosahedronGeometry(0.15, 0), dark, 0, 0.86, 0.03, torso, true).scale.set(1, 1.15, 1.2);
      orb(c, torso, 0, 0.86, 0.18, 0.055);
      for (let i = -2; i <= 2; i++) add(new THREE.ConeGeometry(0.03, 0.22 + (2 - Math.abs(i)) * 0.08, 4), dark, i * 0.06, 1.05, 0, torso, true, [0, 0, -i * 0.15]);
      for (const s of [-1, 1]) {
        add(new THREE.ConeGeometry(0.05, 0.4, 4), bodyMat, s * 0.14, 1.0, 0.02, torso, true, [0.2, 0, s * -0.9]);
        B(0.2 * W, 0.12, 0.28, s * 0.3 * W, 0.66, 0, dark, torso, false, [0, 0, s * -0.25]);
        add(new THREE.ConeGeometry(0.04, 0.3, 4), bodyMat, s * 0.36 * W, 0.82, -0.02, torso, false, [0, 0, s * -0.6]);
      }
      c.arms.push(arm(c, torso, -0.32 * W, 0.62, 0.55, 0.1, dark, -1.15, 0.1), arm(c, torso, 0.32 * W, 0.62, 0.55, 0.1, dark, -1.15, -0.1));
      gun(c, torso, 0.16, 0.42, 0.42, 0.55, 0.15);
      B(0.26, 0.5, 0.02, 0, -0.1, 0.17, dark, torso);
      strips(c, torso, 3, 0.08, 0.6, -0.12, 0.12, 0.05, -0.17, dark, true);
      wisps(c, torso, 2, 0.5, 0, 0.5, 0, 0.06);
      c.height = 2.2;
      return;
    }
    case 'tk_ogre': {
      // huge hulking brute with a gaping orb in the chest
      legsBiped(c, 1.0, 0.3, 0.3, dark, dark);
      const torso = pivot(0, 1.0, 0);
      torso.rotation.x = 0.25;
      c.torso = torso;
      B(1.1, 0.95, 0.75, 0, 0.55, 0, bodyMat, torso);
      B(1.0, 0.4, 0.65, 0, 1.0, -0.08, dark, torso);
      for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.07, 0.34, 4), dark, -0.36 + i * 0.18, 1.3, -0.22, torso);
      // chest maw: dark frame and glowing orb
      B(0.5, 0.5, 0.08, 0, 0.55, 0.38, dark, torso, true);
      orb(c, torso, 0, 0.55, 0.42, 0.2);
      edge(c, torso, 0.56, 0.02, 0.02, 0, 0.82, 0.42);
      edge(c, torso, 0.56, 0.02, 0.02, 0, 0.28, 0.42);
      edge(c, torso, 0.02, 0.56, 0.02, -0.28, 0.55, 0.42);
      edge(c, torso, 0.02, 0.56, 0.02, 0.28, 0.55, 0.42);
      // small head with horns
      B(0.32, 0.26, 0.28, 0, 0.98, 0.34, dark, torso, true);
      B(0.14, 0.04, 0.04, 0, 1.0, 0.49, accent, torso, true);
      for (const s of [-1, 1]) {
        add(new THREE.ConeGeometry(0.06, 0.4, 4), bodyMat, s * 0.16, 1.2, 0.3, torso, true, [0.3, 0, s * -0.7]);
        add(new THREE.ConeGeometry(0.1, 0.4, 4), bodyMat, s * 0.62, 1.12, 0, torso, false, [0, 0, s * -0.5]);
        const a = arm(c, torso, s * 0.72, 0.9, 1.1, 0.3, bodyMat, -0.4, s * -0.15);
        B(0.42, 0.34, 0.44, 0, -1.2, 0.05, dark, a);
        edge(c, a, 0.02, 1.0, 0.02, s * 0.16, -0.55, 0.14);
        c.arms.push(a);
      }
      wisps(c, torso, 4, 0.95, 0, 0.6, 0, 0.09);
      c.muzzle.position.set(0, 0.55, 0.6); torso.add(c.muzzle);
      c.height = 2.6;
      return;
    }
    default:
      throw new Error('taken(): unknown unit id ' + t);
  }
}
