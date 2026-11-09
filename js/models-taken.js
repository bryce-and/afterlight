import * as THREE from 'three';
import { mat } from './world.js';

// ---------------------------------------------------------------------------
// TAKEN: Hive, Fallen and Cabal bent by the Darkness. Near-black silhouettes,
// thin white-blue edges of Light, blazing orb faces, drifting Blight wisps.
// Same builder contract as the faction builders in enemies.js:
// face +z, stand on y = 0, c.torso / c.legs / c.arms / c.muzzle set per unit.
// ---------------------------------------------------------------------------

let _blight = null, _halo = null, _orb = null;
/** Bright cyan-white light for faces and eyes: the brightest thing on the unit. */
function orbMat() { return (_orb ||= mat(0xdff4ff, { emissive: 0xdff4ff, emissiveIntensity: 4 })); }
function blightMats() {
  if (!_blight) {
    _blight = mat(0x050609);
    _halo = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.07, depthWrite: false });
  }
  return [_blight, _halo];
}

// Taken look: black body, white glowing legs and edges, one blazing orb face, and black flame
// wisps (horns off the shoulders, flames off the head) that every unit gets from wisps().
// ---------------------------------------------------------------------------

/** Two legs. `upper` and `lower` are materials (white-glow lower legs and boots are the Taken tell). Digitigrade bends the knee back. */
function legsBiped(c, hipY, hipW, thick, upper, lower, digi = false, boot = 1, bootM = null) {
  for (const s of [-1, 1]) {
    const hip = c.pivot(s * hipW, hipY, 0);
    const L = hipY / 2;
    if (digi) {
      c.B(thick, L * 1.05, thick * 1.1, 0, -L * 0.48, 0.07, upper, hip, false, [-0.32, 0, 0]);
      c.B(thick * 0.8, L * 1.05, thick * 0.9, 0, -L * 1.45, 0.06, lower, hip, false, [0.3, 0, 0]);
    } else {
      c.B(thick, L, thick * 1.1, 0, -L * 0.5, 0, upper, hip);
      c.B(thick * 0.95, L, thick, 0, -L * 1.5, 0, lower, hip);
    }
    c.B(thick * 1.15 * boot, 0.09, thick * 2 * boot, 0, -hipY + 0.045, 0.07, bootM || c.accent, hip);
    c.legs.push(hip);
  }
}

/** Rifle or pistol held at the torso; places the muzzle at its tip. Long ones get a scope and a glowing barrel line. */
function gun(c, parent, x, y, z, len, thick, glow = true) {
  c.B(thick, thick * 1.2, len, x, y, z, c.dark, parent);
  if (glow) c.B(thick * 0.4, thick * 0.35, len * 0.7, x, y + thick * 0.7, z, c.accent, parent);
  if (len > 0.9) {
    c.B(thick * 0.8, thick * 0.9, len * 0.28, x, y + thick * 0.95, z + len * 0.06, c.dark, parent);
    c.B(thick * 0.45, thick * 0.45, len * 0.4, x, y + thick * 0.05, z + len * 0.5 + 0.05, c.dark, parent);
    c.B(thick * 1.1, thick * 2.2, len * 0.14, x, y - thick * 0.9, z - len * 0.3, c.dark, parent);
  }
  c.muzzle.position.set(x, y, z + len / 2 + (len > 0.9 ? 0.2 : 0.03));
  parent.add(c.muzzle);
}

/** Arm pivot (swung by the game). Black limb with an optional strip of Light down the forearm. */
function limb(c, parent, x, y, len, thick, m, lift = -0.3, rz = 0, glow = false) {
  const p = c.pivot(x, y, 0, parent);
  c.B(thick, len, thick, 0, -len / 2, 0, m, p);
  if (glow) c.B(thick * 0.3, len * 0.55, thick * 0.3, Math.sign(x || 1) * thick * 0.5, -len * 0.62, thick * 0.3, c.accent, p);
  p.rotation.x = lift;
  p.rotation.z = rz;
  return p;
}

/** Hooked claws at the end of a limb. */
function claws(c, p, y, n, len, spread = 0.03, m = null) {
  for (let k = 0; k < n; k++) c.add(new THREE.ConeGeometry(len * 0.1, len, 3), m || c.dark, (k - (n - 1) / 2) * spread, y, 0.02, p, false, [Math.PI + 0.25, 0, 0]);
}

/** Thin strip of Light. */
function edge(c, parent, w, h, d, x, y, z, r = null) {
  return c.B(w, h, d, x, y, z, c.accent, parent, false, r);
}

/** Glowing orb (face / eye). Crit by default. */
function orb(c, parent, x, y, z, rad, crit = true) {
  return c.add(new THREE.IcosahedronGeometry(rad, 1), orbMat(), x, y, z, parent, crit);
}

/** A (squashed) ball: hoods, helmets, torsos. */
function blob(c, parent, m, x, y, z, r, sx = 1, sy = 1, sz = 1, detail = 1) {
  return c.add(new THREE.IcosahedronGeometry(r, detail), m, x, y, z, parent, false).scale.set(sx, sy, sz);
}

/** One black flame spike (base at bx,by,bz, tilted by ax/az) with a pale halo; returns its tip. */
function spike(c, parent, bx, by, bz, len, rad, az, ax, halo) {
  const d = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(ax, 0, az));
  const cx = bx + d.x * len / 2, cy = by + d.y * len / 2, cz = bz + d.z * len / 2;
  c.add(new THREE.ConeGeometry(rad, len, 4), blightMats()[0], cx, cy, cz, parent, false, [ax, 0, az]);
  const h = new THREE.Mesh(new THREE.ConeGeometry(rad * 1.5, len * 1.08, 4), halo);
  h.position.set(cx, cy, cz);
  h.rotation.set(ax, 0, az);
  parent.add(h);
  return [bx + d.x * len, by + d.y * len, bz + d.z * len];
}

/**
 * The Taken's black flame, the same helper on every unit but never the same shape: a crescent horn curling up and out from ONE
 * shoulder, torn tatters off the other, and a flame off the back of the head. Pure black, with only a very faint pale rim.
 * hy = head height, hw = shoulder half width, k = size, hz = head z, seed picks the horn side, lengths and angles per unit.
 */
function wisps(c, parent, hy, hw, k = 1, hz = 0, seed = 0) {
  const [blight, halo] = blightMats();
  const j = (n) => ((seed * 37 + n * 53) % 10) / 10; // 0..0.9, stable per seed
  const a = seed % 2 ? -1 : 1, b = -a;
  // crescent horn off shoulder a: up and out, then hooking in
  const t = spike(c, parent, a * hw, hy - 0.1 * k, hz - 0.03 * k, (0.24 + 0.08 * j(1)) * k, 0.07 * k, -a * (0.5 + 0.3 * j(2)), -0.35, halo);
  const t2 = spike(c, parent, t[0], t[1], t[2], (0.2 + 0.06 * j(3)) * k, 0.05 * k, a * (0.5 + 0.4 * j(4)), -0.45, halo);
  spike(c, parent, t2[0], t2[1], t2[2], 0.1 * k, 0.03 * k, a * 1.2, -0.5, halo);
  // torn tatters off shoulder b: thin ragged blades leaning out and back
  const n = 2 + (seed % 2);
  for (let i = 0; i < n; i++) {
    const l = (0.16 + 0.1 * j(5 + i)) * k;
    c.B(0.03 * k, l, 0.012, b * (hw + 0.03 * i * k), hy - 0.04 * k + l * 0.45, hz - (0.05 + 0.03 * i) * k, blight, parent, false, [-0.5 - 0.2 * j(8 + i), 0, b * (0.45 + 0.3 * j(2 + i))]);
  }
  // a flame off the back of the head, leaning back and to one side
  spike(c, parent, b * 0.03 * k, hy + 0.08 * k, hz - 0.08 * k, (0.18 + 0.08 * j(6)) * k, 0.05 * k, b * (0.2 + 0.3 * j(7)), -0.8, halo);
  c.B(0.02 * k, 0.14 * k, 0.01, a * 0.07 * k, hy + 0.06 * k, hz - 0.15 * k, blight, parent, false, [-0.6, 0, a * 0.6]);
}

/** Black bands and patches broken across white-glow legs, with dark boots edged in white (the heavy units). */
function bands(c, hipY, thick, m) {
  for (const hip of c.legs) {
    for (const f of [0.52, 0.8]) c.B(thick * 1.06, 0.1, thick * 1.2, 0, -hipY * f, 0, m, hip);
    c.B(thick * 0.5, 0.2, thick * 0.3, thick * 0.2, -hipY * 0.66, thick * 0.55, m, hip);
    c.B(thick * 0.8, 0.02, thick * 0.4, 0, -hipY + 0.095, 0.12, c.accent, hip);
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

/** Crescent horn pair off the shoulders is in wisps(); this adds a hunched-frame shoulder hump. */
function hump(c, parent, x, y, z, w, h, d, m, r = null) {
  return c.B(w, h, d, x, y, z, m, parent, false, r);
}

// ---------------------------------------------------------------------------
export function taken(c, t) {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  switch (t) {
    case 'tk_thrall': {
      // hunched, narrow body, huge orb head sunk between the shoulders, long clawed arms, bare white legs
      legsBiped(c, 0.85, 0.12, 0.1, accent, accent, true, 1.1);
      const torso = pivot(0, 0.85, 0);
      torso.rotation.x = 0.5;
      c.torso = torso;
      B(0.24, 0.5, 0.18, 0, 0.28, 0, bodyMat, torso);
      for (let i = 0; i < 3; i++) B(0.26, 0.025, 0.2, 0, 0.16 + i * 0.1, 0.01, dark, torso);
      edge(c, torso, 0.02, 0.4, 0.02, 0, 0.28, 0.1);
      hump(c, torso, -0.17, 0.5, 0, 0.14, 0.14, 0.2, dark);
      hump(c, torso, 0.17, 0.5, 0, 0.14, 0.14, 0.2, dark);
      blob(c, torso, dark, 0, 0.62, 0.12, 0.2, 1, 0.95, 1);
      orb(c, torso, 0, 0.62, 0.27, 0.12);
      for (const s of [-1, 1]) {
        const a = limb(c, torso, s * 0.2, 0.5, 0.75, 0.09, bodyMat, -0.25, s * 0.22, true);
        claws(c, a, -0.8, 3, 0.18);
        c.arms.push(a);
      }
      wisps(c, torso, 0.62, 0.22, 1.1, 0.1, 1);
      c.muzzle.position.set(0, 0.5, 0.3); torso.add(c.muzzle);
      c.height = 1.8;
      return;
    }
    case 'tk_shadow': {
      // all ink: no glow but flecks, thin loping limbs, ragged shards, one reaching arm
      const ink = bodyMat;
      legsBiped(c, 0.62, 0.08, 0.06, ink, ink, true, 0.9);
      const torso = pivot(0, 0.62, 0);
      torso.rotation.x = 0.55;
      c.torso = torso;
      B(0.18, 0.42, 0.13, 0, 0.24, 0, ink, torso);
      blob(c, torso, ink, 0, 0.5, 0.1, 0.11, 1, 1, 1.1, 0);
      orb(c, torso, 0, 0.5, 0.2, 0.035);
      for (const s of [-1, 1]) {
        const a = limb(c, torso, s * 0.12, 0.4, s > 0 ? 0.7 : 0.5, 0.04, ink, s > 0 ? -1.2 : -0.35, s * 0.15);
        claws(c, a, s > 0 ? -0.72 : -0.52, 2, 0.12, 0.025);
        edge(c, a, 0.01, 0.07, 0.01, 0, -0.3, 0.025);
        c.arms.push(a);
      }
      for (let i = 0; i < 5; i++) B(0.03, 0.2 + (i % 3) * 0.08, 0.01, (i - 2) * 0.1, 0.15 + (i % 2) * 0.1, -0.1 - i * 0.02, ink, torso, false, [0.8 - i * 0.3, 0, (i - 2) * 0.35]);
      wisps(c, torso, 0.5, 0.13, 0.8, 0.08, 2);
      c.muzzle.position.set(0, 0.4, 0.2); torso.add(c.muzzle);
      c.height = 1.45;
      return;
    }
    case 'tk_acolyte': {
      // tall hooded Hive, stooped, white orb in the hood, white bare legs, rifle, tattered pale cloak
      legsBiped(c, 1.0, 0.12, 0.1, accent, accent, true);
      const torso = pivot(0, 1.0, 0);
      torso.rotation.x = 0.2;
      c.torso = torso;
      B(0.28, 0.22, 0.2, 0, 0.1, 0, dark, torso);
      B(0.44, 0.48, 0.3, 0, 0.48, 0, bodyMat, torso);
      for (let i = 0; i < 3; i++) B(0.4, 0.035, 0.04, 0, 0.36 + i * 0.1, 0.16, dark, torso);
      edge(c, torso, 0.38, 0.015, 0.012, 0, 0.7, 0.16);
      edge(c, torso, 0.015, 0.46, 0.012, 0, 0.48, 0.165);
      blob(c, torso, dark, 0, 0.95, 0.03, 0.25, 1, 1.1, 1);
      add(new THREE.ConeGeometry(0.17, 0.4, 5), dark, 0, 1.2, -0.12, torso, false, [-0.45, 0, 0]);
      orb(c, torso, 0, 0.93, 0.2, 0.12);
      for (const s of [-1, 1]) hump(c, torso, s * 0.3, 0.7, 0, 0.2, 0.14, 0.28, dark, [0, 0, s * -0.25]);
      c.arms.push(limb(c, torso, -0.29, 0.66, 0.55, 0.08, dark, -0.5, 0.15, true), limb(c, torso, 0.29, 0.66, 0.55, 0.08, dark, -1.2, -0.1, true));
      gun(c, torso, 0.16, 0.42, 0.42, 0.6, 0.08);
      strips(c, torso, 5, 0.08, 0.7, -0.16, 0.16, 0.3, -0.17, dark, true);
      wisps(c, torso, 0.95, 0.27, 1.1, 0, 3);
      c.height = 2.15;
      return;
    }
    case 'tk_vandal': {
      // Taken Fallen sniper: four arms, helmet orb, white greaves and boots, cloak, long rifle
      legsBiped(c, 0.95, 0.15, 0.12, dark, accent, true);
      const torso = pivot(0, 0.95, 0);
      torso.rotation.x = 0.2;
      c.torso = torso;
      B(0.26, 0.24, 0.2, 0, 0.12, 0, dark, torso);
      B(0.42, 0.38, 0.28, 0, 0.45, 0, bodyMat, torso);
      for (let i = 0; i < 3; i++) edge(c, torso, 0.34, 0.012, 0.012, 0, 0.34 + i * 0.1, 0.15);
      edge(c, torso, 0.015, 0.34, 0.012, 0, 0.45, 0.15);
      B(0.22, 0.2, 0.26, 0, 0.82, 0.06, dark, torso);
      for (const s of [-1, 1]) B(0.04, 0.14, 0.12, s * 0.12, 0.76, 0.17, bodyMat, torso, false, [0.3, 0, s * 0.2]);
      orb(c, torso, 0, 0.84, 0.2, 0.09);
      add(new THREE.ConeGeometry(0.32, 0.4, 5, 1, true), dark, 0, 0.78, -0.05, torso);
      B(0.5, 0.8, 0.03, 0, 0.25, -0.17, dark, torso, false, [0.15, 0, 0]);
      strips(c, torso, 4, 0.08, 0.5, -0.18, 0.18, -0.1, -0.2, dark, true);
      c.arms.push(limb(c, torso, -0.27, 0.62, 0.5, 0.08, bodyMat, -1.4, 0.35, true), limb(c, torso, 0.27, 0.62, 0.5, 0.08, bodyMat, -1.15, -0.1, true));
      for (const s of [-1, 1]) { const a = limb(c, torso, s * 0.22, 0.38, 0.45, 0.06, bodyMat, -0.5, s * 0.7, true); claws(c, a, -0.48, 2, 0.12, 0.03); }
      gun(c, torso, 0.1, 0.46, 0.5, 1.4, 0.08);
      wisps(c, torso, 0.85, 0.24, 1, 0, 4);
      c.height = 2.1;
      return;
    }
    case 'tk_psion': {
      // black armoured shell with ribs of white light, domed helmet with a big orb, white boots, sidearm
      legsBiped(c, 0.85, 0.12, 0.12, dark, accent, false);
      for (const s of [-1, 1]) edge(c, c.legs[s < 0 ? 0 : 1], 0.015, 0.4, 0.015, s * 0.045, -0.3, 0.07);
      const torso = pivot(0, 0.85, 0);
      torso.rotation.x = 0.12;
      c.torso = torso;
      B(0.34, 0.2, 0.24, 0, 0.1, 0, dark, torso);
      B(0.44, 0.42, 0.3, 0, 0.45, 0, bodyMat, torso);
      for (let i = 0; i < 4; i++) edge(c, torso, 0.4, 0.014, 0.012, 0, 0.3 + i * 0.07, 0.16);
      hump(c, torso, -0.26, 0.62, 0, 0.14, 0.14, 0.24, dark);
      hump(c, torso, 0.26, 0.62, 0, 0.14, 0.14, 0.24, dark);
      blob(c, torso, dark, 0, 0.86, 0.02, 0.22, 1, 1.05, 1.05);
      orb(c, torso, 0, 0.86, 0.15, 0.13);
      add(new THREE.ConeGeometry(0.04, 0.12, 4), dark, 0, 1.1, 0.0, torso);
      c.arms.push(limb(c, torso, -0.28, 0.62, 0.55, 0.075, bodyMat, -0.35, 0.2, true), limb(c, torso, 0.28, 0.62, 0.55, 0.075, bodyMat, -1.2, -0.08, true));
      gun(c, torso, 0.28, 0.35, 0.3, 0.3, 0.06);
      wisps(c, torso, 0.86, 0.22, 1.0, 0, 6);
      c.height = 1.8;
      return;
    }
    case 'tk_goblin': {
      // round black shell, one huge ringed orb, antenna whips, two long legs with white feet, one gun arm
      legsBiped(c, 0.62, 0.17, 0.08, dark, accent, true, 0.9);
      const torso = pivot(0, 0.98, 0);
      c.torso = torso;
      blob(c, torso, bodyMat, 0, 0, 0, 0.4, 1, 0.95, 1);
      blob(c, torso, dark, 0, 0.14, -0.1, 0.4, 1.05, 0.7, 1.05, 0);
      add(new THREE.TorusGeometry(0.2, 0.02, 4, 14), accent, 0, 0.02, 0.37, torso);
      orb(c, torso, 0, 0.02, 0.37, 0.15);
      for (const s of [-1, 1]) {
        B(0.012, 0.5, 0.012, s * 0.18, 0.5, -0.12, accent, torso, false, [0.2, 0, s * -0.5]);
        edge(c, torso, 0.012, 0.3, 0.012, s * 0.34, 0.1, 0.2, [0, 0, s * 0.5]);
      }
      B(0.2, 0.14, 0.2, 0, -0.34, 0.05, dark, torso);
      c.arms.push(limb(c, torso, -0.4, -0.02, 0.4, 0.06, bodyMat, -0.3, 0.3, true), limb(c, torso, 0.4, -0.02, 0.4, 0.06, bodyMat, -1.2, -0.15, true));
      gun(c, torso, 0.38, -0.15, 0.32, 0.3, 0.06);
      wisps(c, torso, 0.28, 0.34, 1.0, 0.0, 7);
      c.height = 1.5;
      return;
    }
    case 'tk_wizard': {
      // floating robe over a black ribbed torso, orb face under a horned hood, glowing hands, ragged white hem
      const torso = pivot(0, 0.95, 0);
      c.torso = torso;
      add(new THREE.ConeGeometry(0.38, 1.05, 6), bodyMat, 0, -0.1, 0, torso);
      B(0.42, 0.34, 0.28, 0, 0.5, 0, dark, torso);
      for (let i = 0; i < 3; i++) edge(c, torso, 0.36, 0.014, 0.012, 0, 0.4 + i * 0.09, 0.15);
      edge(c, torso, 0.012, 0.8, 0.012, 0, 0.05, 0.31, [-0.35, 0, 0]);
      blob(c, torso, dark, 0, 0.86, 0, 0.22, 1, 1.05, 1);
      orb(c, torso, 0, 0.84, 0.15, 0.12);
      for (const s of [-1, 1]) {
        hump(c, torso, s * 0.27, 0.66, 0, 0.2, 0.12, 0.26, dark, [0, 0, s * -0.3]);
        const a = limb(c, torso, s * 0.28, 0.58, 0.55, 0.06, bodyMat, -1.0, s * 0.35, true);
        add(new THREE.IcosahedronGeometry(0.09, 0), accent, 0, -0.6, 0.02, a);
        c.arms.push(a);
      }
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, l = 0.3 + ((i * 5) % 4) * 0.08;
        add(new THREE.ConeGeometry(0.05, l, 3), i % 2 ? accent : dark, Math.sin(a) * 0.33, -0.62 - l / 2 + 0.1, Math.cos(a) * 0.33, torso, false, [Math.PI + Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2]);
      }
      wisps(c, torso, 0.86, 0.26, 1.2, 0, 8);
      c.muzzle.position.set(0, 0.6, 0.55); torso.add(c.muzzle);
      c.hover = true;
      c.height = 2.0;
      return;
    }
    case 'tk_captain': {
      // bigger four-armed Fallen: blazing orb face, white boots, shredded cape, canister launcher, horn crest
      const W = 1.3;
      legsBiped(c, 0.95, 0.15 * W, 0.12 * W, dark, accent, true);
      const torso = pivot(0, 0.95, 0);
      torso.rotation.x = 0.18;
      c.torso = torso;
      B(0.26 * W, 0.24, 0.2, 0, 0.12, 0, dark, torso);
      B(0.42 * W, 0.4, 0.28, 0, 0.46, 0, bodyMat, torso);
      for (let i = 0; i < 3; i++) edge(c, torso, 0.38 * W, 0.013, 0.012, 0, 0.34 + i * 0.1, 0.15);
      edge(c, torso, 0.015, 0.36, 0.012, 0, 0.46, 0.15);
      B(0.24, 0.2, 0.26, 0, 0.86, 0.06, dark, torso);
      orb(c, torso, 0, 0.88, 0.2, 0.1);
      for (const s of [-1, 1]) hump(c, torso, s * 0.34, 0.7, 0, 0.26, 0.14, 0.32, dark, [0, 0, s * -0.3]);
      c.arms.push(limb(c, torso, -0.27 * W, 0.62, 0.5, 0.09, bodyMat, -1.0, 0.25, true), limb(c, torso, 0.27 * W, 0.62, 0.5, 0.09, bodyMat, -1.2, -0.1, true));
      for (const s of [-1, 1]) { const a = limb(c, torso, s * 0.22 * W, 0.36, 0.42, 0.07, bodyMat, -0.5, s * 0.8, true); claws(c, a, -0.44, 2, 0.12, 0.03); }
      gun(c, torso, 0.14, 0.42, 0.45, 0.5, 0.13);
      B(0.55 * W, 0.2, 0.03, 0, 0.7, -0.17, dark, torso, false, [0.1, 0, 0]);
      strips(c, torso, 7, 0.1, 1.3, -0.3 * W, 0.3 * W, 0.6, -0.19, dark, true);
      wisps(c, torso, 0.9, 0.3, 1.2, 0, 9);
      c.height = 2.3;
      return;
    }
    case 'tk_centurion': {
      // big armoured Cabal: black dome helmet with a glowing visor slit, big horns, white greaves and fists, chevron thigh plates
      const W = 1.3;
      legsBiped(c, 0.9, 0.17 * W, 0.17 * W, dark, accent, false, 1, bodyMat);
      bands(c, 0.9, 0.17 * W, bodyMat);
      for (const s of [-1, 1]) {
        B(0.2 * W, 0.26, 0.22, s * 0.17 * W, 0.66, 0.04, bodyMat);
        edge(c, c.g, 0.012, 0.22, 0.012, s * 0.17 * W, 0.66, 0.16);
        edge(c, c.g, 0.2 * W, 0.012, 0.012, s * 0.17 * W, 0.78, 0.16);
      }
      const torso = pivot(0, 0.9, 0);
      c.torso = torso;
      B(0.42 * W, 0.26, 0.3, 0, 0.12, 0, dark, torso);
      edge(c, torso, 0.44 * W, 0.04, 0.32, 0, 0.26, 0);
      B(0.62 * W, 0.5, 0.42, 0, 0.5, 0, bodyMat, torso);
      B(0.5 * W, 0.18, 0.08, 0, 0.42, 0.22, dark, torso);
      edge(c, torso, 0.5 * W, 0.015, 0.012, 0, 0.72, 0.22);
      blob(c, torso, bodyMat, 0, 0.95, 0.03, 0.22, 1.05, 0.95, 1.05);
      add(new THREE.IcosahedronGeometry(0.1, 1), orbMat(), 0, 0.94, 0.2, torso, true).scale.set(2.1, 0.42, 0.5);
      for (const s of [-1, 1]) {
        B(0.32 * W, 0.22, 0.44, s * 0.44 * W, 0.72, 0, bodyMat, torso, false, [0, 0, s * -0.15]);
        edge(c, torso, 0.3 * W, 0.012, 0.012, s * 0.44 * W, 0.84, 0.22, [0, 0, s * -0.15]);
      }
      const arms = [limb(c, torso, -0.46 * W, 0.62, 0.55, 0.15, dark, -0.4, 0.15, true), limb(c, torso, 0.46 * W, 0.62, 0.55, 0.15, dark, -1.1, -0.12, true)];
      for (const a of arms) B(0.2, 0.22, 0.2, 0, -0.5, 0, accent, a);
      c.arms.push(...arms);
      gun(c, torso, 0.22, 0.4, 0.45, 0.6, 0.12);
      wisps(c, torso, 0.95, 0.33, 1.3, 0.0, 10);
      c.height = 2.1;
      return;
    }
    case 'tk_phalanx': {
      // brute with a tall black slab shield on the left (its hitbox is `frontGuard.box` in factions.js: x -0.62, z 0.5, 0.6 wide, 1.2 tall)
      const W = 1.4;
      legsBiped(c, 0.9, 0.17 * W, 0.18 * W, dark, accent, false, 1, bodyMat);
      bands(c, 0.9, 0.18 * W, bodyMat);
      for (const s of [-1, 1]) {
        B(0.2 * W, 0.26, 0.22, s * 0.17 * W, 0.66, 0.04, bodyMat);
        edge(c, c.g, 0.012, 0.22, 0.012, s * 0.17 * W, 0.66, 0.16);
      }
      const torso = pivot(0, 0.9, 0);
      c.torso = torso;
      B(0.42 * W, 0.26, 0.3, 0, 0.12, 0, dark, torso);
      edge(c, torso, 0.44 * W, 0.04, 0.32, 0, 0.26, 0);
      B(0.62 * W, 0.5, 0.42, 0, 0.5, 0, bodyMat, torso);
      blob(c, torso, bodyMat, 0, 0.9, 0.02, 0.21, 1.1, 0.95, 1.05);
      add(new THREE.IcosahedronGeometry(0.095, 1), orbMat(), 0, 0.9, 0.2, torso, true).scale.set(1.5, 0.8, 0.6);
      for (const s of [-1, 1]) {
        B(0.34 * W, 0.24, 0.44, s * 0.44 * W, 0.72, 0, bodyMat, torso, false, [0, 0, s * -0.15]);
        edge(c, torso, 0.3 * W, 0.012, 0.012, s * 0.44 * W, 0.85, 0.23, [0, 0, s * -0.15]);
      }
      // shield slab: tall, dark, with an edge-lit rim and a hooked horn on top
      const sx = -0.62, sy = 0.3, sz = 0.5;
      B(0.6, 1.2, 0.14, sx, sy, sz, dark, torso);
      B(0.5, 1.06, 0.06, sx, sy, sz + 0.09, bodyMat, torso);
      edge(c, torso, 0.6, 0.02, 0.02, sx, sy + 0.6, sz + 0.08);
      edge(c, torso, 0.6, 0.02, 0.02, sx, sy - 0.6, sz + 0.08);
      edge(c, torso, 0.02, 1.2, 0.02, sx - 0.3, sy, sz + 0.08);
      edge(c, torso, 0.02, 1.2, 0.02, sx + 0.3, sy, sz + 0.08);
      edge(c, torso, 0.28, 0.03, 0.02, sx, sy + 0.1, sz + 0.13);
      add(new THREE.ConeGeometry(0.06, 0.35, 4), dark, sx + 0.1, sy + 0.77, sz, torso, false, [0, 0, -0.25]);
      const la = limb(c, torso, -0.46 * W, 0.62, 0.55, 0.15, dark, -1.3, 0.2, true);
      const ra = limb(c, torso, 0.46 * W, 0.62, 0.55, 0.15, dark, -1.1, -0.12, true);
      B(0.2, 0.22, 0.2, 0, -0.5, 0, accent, la);
      B(0.2, 0.22, 0.2, 0, -0.5, 0, accent, ra);
      c.arms.push(la, ra);
      gun(c, torso, 0.52, 0.4, 0.5, 0.7, 0.1);
      wisps(c, torso, 0.9, 0.34, 1.3, 0.0, 11);
      c.height = 2.15;
      return;
    }
    case 'tk_knight': {
      // tall cloaked Hive: black wedge hood with a grinning orb, jagged shoulders, glowing skull gauntlet, white shins
      const W = 1.25;
      legsBiped(c, 0.95, 0.13 * W, 0.12 * W, dark, accent, true, 1, bodyMat);
      bands(c, 0.95, 0.12 * W, bodyMat);
      const torso = pivot(0, 0.95, 0);
      torso.rotation.x = 0.15;
      c.torso = torso;
      B(0.3 * W, 0.24, 0.22, 0, 0.12, 0, dark, torso);
      B(0.5 * W, 0.46, 0.32, 0, 0.5, 0, bodyMat, torso);
      for (let i = 0; i < 3; i++) B(0.42 * W, 0.04, 0.04, 0, 0.36 + i * 0.1, 0.17, dark, torso);
      edge(c, torso, 0.015, 0.4, 0.012, 0, 0.47, 0.2);
      edge(c, torso, 0.44 * W, 0.015, 0.012, 0, 0.7, 0.17);
      blob(c, torso, dark, 0, 0.92, 0.02, 0.22, 1, 1.05, 1.05, 0);
      add(new THREE.ConeGeometry(0.16, 0.3, 4), dark, 0, 1.18, -0.05, torso, false, [-0.3, 0, 0]);
      orb(c, torso, 0, 0.92, 0.2, 0.1);
      edge(c, torso, 0.14, 0.02, 0.012, 0, 0.8, 0.21);
      for (const s of [-1, 1]) {
        hump(c, torso, s * 0.32 * W, 0.68, 0, 0.24 * W, 0.14, 0.3, dark, [0, 0, s * -0.25]);
        add(new THREE.ConeGeometry(0.05, 0.3, 4), bodyMat, s * 0.38 * W, 0.84, -0.02, torso, false, [0, 0, s * -0.6]);
      }
      const gaunt = limb(c, torso, -0.34 * W, 0.64, 0.5, 0.11, dark, -0.45, 0.15, true);
      B(0.16, 0.34, 0.12, 0, -0.55, 0.02, accent, gaunt);
      B(0.1, 0.1, 0.1, 0, -0.76, 0.02, dark, gaunt);
      c.arms.push(gaunt, limb(c, torso, 0.34 * W, 0.64, 0.55, 0.1, dark, -1.15, -0.1, true));
      gun(c, torso, 0.18, 0.42, 0.42, 0.55, 0.14);
      B(0.28, 0.5, 0.02, 0, -0.1, 0.18, dark, torso);
      strips(c, torso, 4, 0.09, 0.7, -0.14, 0.14, 0.05, -0.17, dark, true);
      wisps(c, torso, 0.92, 0.3, 1.2, 0, 12);
      c.height = 2.2;
      return;
    }
    case 'tk_ogre': {
      // huge hunched brute: black barrel body, one giant orb eye in the chest, long arms, white legs
      legsBiped(c, 1.0, 0.3, 0.3, accent, accent, false, 1.05, bodyMat);
      bands(c, 1.0, 0.3, bodyMat);
      const torso = pivot(0, 1.0, 0);
      torso.rotation.x = 0.28;
      c.torso = torso;
      B(1.1, 0.5, 0.7, 0, 0.2, 0, dark, torso);
      blob(c, torso, bodyMat, 0, 0.8, 0, 0.62, 1.05, 0.95, 0.85);
      blob(c, torso, dark, 0, 1.15, -0.08, 0.4, 1.1, 0.7, 0.9, 0);
      for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.07, 0.34, 4), dark, -0.36 + i * 0.18, 1.45, -0.22, torso);
      // the eye: a dark socket ring with a huge orb
      add(new THREE.TorusGeometry(0.24, 0.05, 4, 10), dark, 0, 0.82, 0.46, torso);
      orb(c, torso, 0, 0.82, 0.44, 0.2);
      for (const s of [-1, 1]) {
        add(new THREE.ConeGeometry(0.1, 0.4, 4), bodyMat, s * 0.62, 1.3, 0, torso, false, [0, 0, s * -0.5]);
        const a = limb(c, torso, s * 0.72, 1.1, 1.1, 0.3, bodyMat, -0.3, s * 0.12, true);
        B(0.42, 0.34, 0.44, 0, -1.2, 0.05, dark, a);
        edge(c, a, 0.02, 0.5, 0.02, s * 0.16, -1.2, 0.2);
        c.arms.push(a);
      }
      wisps(c, torso, 1.1, 0.5, 2.0, -0.05, 13);
      c.muzzle.position.set(0, 0.8, 0.6); torso.add(c.muzzle);
      c.height = 2.6;
      return;
    }
    case 'tk_hobgoblin': {
      // the Vex Hobgoblin frame in Taken black: tall and slender, cone head with an orb face, ribbed chest, back conduits, long Line Rifle
      legsBiped(c, 1.0, 0.13, 0.09, dark, accent, true);
      const torso = pivot(0, 1.0, 0);
      torso.rotation.x = 0.1;
      c.torso = torso;
      B(0.26, 0.18, 0.2, 0, 0.07, 0, dark, torso);
      B(0.2, 0.3, 0.14, 0, 0.3, 0, bodyMat, torso);
      for (const s of [-1, 1]) for (let i = 0; i < 2; i++) edge(c, torso, 0.05, 0.1, 0.05, s * (0.13 + i * 0.015), 0.24 + i * 0.13, 0.02, [0, 0, s * (0.1 + i * 0.08)]);
      B(0.46, 0.28, 0.28, 0, 0.6, 0, bodyMat, torso);
      edge(c, torso, 0.34, 0.015, 0.012, 0, 0.7, 0.15);
      edge(c, torso, 0.015, 0.26, 0.012, 0, 0.6, 0.15);
      for (const s of [-1, 1]) {
        hump(c, torso, s * 0.29, 0.68, 0, 0.14, 0.12, 0.22, dark, [0, 0, s * -0.2]);
        B(0.05, 0.5, 0.05, s * 0.2, 0.52, -0.18, dark, torso);
        edge(c, torso, 0.015, 0.4, 0.015, s * 0.2, 0.52, -0.15);
      }
      B(0.08, 0.14, 0.08, 0, 0.82, 0, dark, torso);
      add(new THREE.ConeGeometry(0.15, 0.42, 5), dark, 0, 1.08, -0.02, torso, false, [-0.2, 0, 0]);
      blob(c, torso, bodyMat, 0, 0.94, 0.04, 0.14, 1, 1.05, 1.05, 0);
      orb(c, torso, 0, 0.94, 0.16, 0.085);
      c.arms.push(limb(c, torso, -0.3, 0.68, 0.55, 0.07, bodyMat, -1.2, 0.1, true), limb(c, torso, 0.3, 0.68, 0.55, 0.07, bodyMat, -1.25, -0.1, true));
      gun(c, torso, 0.1, 0.46, 0.55, 1.35, 0.08);
      wisps(c, torso, 1.0, 0.27, 1.0, 0, 5);
      c.height = 2.2;
      return;
    }
    default:
      throw new Error('taken(): unknown unit id ' + t);
  }
}

// ---------------------------------------------------------------------------
// U21: Aurix, Hollowed Mind (The Whisper's final boss): a Vex Mind frame the Taken have taken over. About 5 m tall.
// ---------------------------------------------------------------------------
/**
 * Returns a THREE.Group with a child named `eye` (the weak point, flagged crit). Called with no argument it builds a standalone group.
 * Called with a unit-builder context `c` (js/enemies.js buildModel) the parts go through c.add, so they count as hit meshes, and c.torso /
 * c.hover / c.height / c.muzzle are set; the context's group is returned.
 */
export function buildTakenMind(c = null) {
  const g = c ? c.g : new THREE.Group();
  const add = c ? c.add : (geo, m, x, y, z, parent = g, crit = false, r = null) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    if (r) mesh.rotation.set(r[0], r[1], r[2]);
    mesh.castShadow = true;
    mesh.userData.crit = crit;
    parent.add(mesh);
    return mesh;
  };
  const B = (w, h, d, x, y, z, m, parent = g, crit = false, r = null) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, crit, r);
  const pivot = c ? c.pivot : (x, y, z, parent = g) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
  const kit = c || { g, add, B, pivot };
  const black = mat(0x07080c), plate = mat(0x15161c), bronze = mat(0x6e4c2a), brass = mat(0x8a6a3a);
  const white = orbMat();
  const red = mat(0xff3a2a, { emissive: 0xff2a1a, emissiveIntensity: 3.5 });
  const PI = Math.PI;
  g.name = 'takenMind';
  const body = pivot(0, 2.9, 0);
  // the great hexagonal head plate, black with a bronze inner plate, edged in white Light
  add(new THREE.CylinderGeometry(1.7, 1.7, 0.5, 6).rotateX(PI / 2), plate, 0, 0, 0, body);
  add(new THREE.CylinderGeometry(1.3, 1.3, 0.5, 6).rotateX(PI / 2), bronze, 0, 0, 0.07, body);
  add(new THREE.TorusGeometry(1.68, 0.06, 4, 6).rotateZ(PI / 6), white, 0, 0, 0.27, body);
  // the eye: a red orb in a white ring (the weak point)
  const eye = add(new THREE.SphereGeometry(0.85, 12, 8), red, 0, 0, 0.42, body, true);
  eye.scale.z = 0.55;
  eye.name = 'eye';
  add(new THREE.TorusGeometry(1.12, 0.08, 4, 12), white, 0, 0, 0.5, body, true);
  add(new THREE.TorusGeometry(1.0, 0.07, 4, 6), brass, 0, 0, 0.46, body, false);
  // the hollowed core hanging below: a black mass with a white heart showing through ribs
  add(new THREE.IcosahedronGeometry(0.9, 1), black, 0, -1.65, -0.05, body);
  add(new THREE.IcosahedronGeometry(0.4, 1), white, 0, -1.65, 0.05, body);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    B(0.12, 1.4, 0.12, Math.cos(a) * 0.75, -1.1, Math.sin(a) * 0.5 - 0.05, plate, body, false, [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]);
  }
  // modular blocks orbiting the frame, black and bronze, as on a Vex Mind
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * PI * 2, s = 0.5 + (i % 3) * 0.08;
    B(s, s, s, Math.cos(a) * 2.9, Math.sin(a) * 2.9 * 0.85, -0.2, i % 2 ? bronze : plate, body, false, [a, a * 0.7, 0]);
    if (i % 2 === 0) B(s * 0.2, s * 1.1, s * 1.1, Math.cos(a) * 2.9, Math.sin(a) * 2.9 * 0.85, -0.2, white, body, false, [a, a * 0.7, 0]);
  }
  // backplate spines and ragged tatters of Darkness hanging under the frame
  for (const s of [-1, 0, 1]) add(new THREE.ConeGeometry(0.2, 1.8, 4), black, s * 0.8, 1.4, -0.55, body, false, [-0.3, 0, -s * 0.45]);
  for (let i = 0; i < 9; i++) {
    const l = 0.6 + ((i * 37) % 10) / 20, x = (i - 4) * 0.36;
    B(0.12, l, 0.03, x, -1.5 - l / 2, 0.15 - (i % 3) * 0.2, black, body, false, [((i % 3) - 1) * 0.12, 0, ((i % 2) ? 1 : -1) * 0.1]);
  }
  // the Taken's flame: white-rimmed black wisps off the head and both shoulders of the plate
  wisps(kit, body, 1.7, 1.35, 2.6, -0.1, 3);
  wisps(kit, body, 1.1, 1.9, 2.2, -0.2, 6);
  const muzzle = c ? c.muzzle : new THREE.Object3D();
  muzzle.position.set(0, 0, 1.2);
  body.add(muzzle);
  if (c) { c.hover = true; c.torso = body; c.height = 5; } else g.userData = { ...g.userData, muzzle, height: 5, torso: body };
  return g;
}
