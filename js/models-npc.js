import * as THREE from 'three';

// Low-poly Tower NPCs: the Vanguard, the Postmaster and a bystander Guardian.
// Metres, origin at the feet, facing +z, flat shaded, no external assets.
// buildNpc(id) -> { group, update(dt, t), height }. Named sub-groups (all in group.userData.parts):
//   body (whole figure, breathing/lean), torso, head, armL, armR, cape, robe, tail, satchel, fidget
// Geometries and materials live in module-level caches and are shared by every NPC instance.

export const NPC_INFO = {
  zavala: { name: 'Zavala', title: 'Titan Vanguard', color: '#7fb3ff' },
  ikora: { name: 'Ikora Rey', title: 'Warlock Vanguard', color: '#c79bff' },
  cayde: { name: 'Cayde-6', title: 'Hunter Vanguard', color: '#ffb26b' },
  kadi: { name: 'Kadi 55-30', title: 'Postmaster', color: '#ffe08a' },
};

const _mats = new Map();
const _geos = new Map();

/** Cached flat-shaded standard material. */
function M(color, o = {}) {
  const key = color + JSON.stringify(o);
  let m = _mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, metalness: 0.12, ...o });
    _mats.set(key, m);
  }
  return m;
}
const glow = (color, k = 1.8) => M(color, { emissive: color, emissiveIntensity: k, roughness: 0.4 });
const cloth = (color) => M(color, { side: THREE.DoubleSide });
const metal = (color) => M(color, { metalness: 0.7, roughness: 0.35 });

function geo(kind, ...a) {
  const key = kind + a.join(',');
  let g = _geos.get(key);
  if (!g) {
    g = kind === 'box' ? new THREE.BoxGeometry(...a)
      : kind === 'cyl' ? new THREE.CylinderGeometry(a[0], a[1], a[2], a[3] || 6)
      : kind === 'cone' ? new THREE.ConeGeometry(a[0], a[1], a[2] || 4)
      : new THREE.IcosahedronGeometry(a[0], 0);
    _geos.set(key, g);
  }
  return g;
}

function put(o, x, y, z, parent, r) {
  o.position.set(x, y, z);
  if (r) o.rotation.set(r[0], r[1], r[2]);
  o.castShadow = true;
  parent.add(o);
  return o;
}
const box = (w, h, d, x, y, z, m, parent, r) => put(new THREE.Mesh(geo('box', w, h, d), m), x, y, z, parent, r);
const cyl = (rt, rb, h, seg, x, y, z, m, parent, r) => put(new THREE.Mesh(geo('cyl', rt, rb, h, seg), m), x, y, z, parent, r);
const cone = (rad, h, seg, x, y, z, m, parent, r) => put(new THREE.Mesh(geo('cone', rad, h, seg), m), x, y, z, parent, r);
const ico = (rad, x, y, z, m, parent) => put(new THREE.Mesh(geo('ico', rad), m), x, y, z, parent);
function pivot(x, y, z, parent, name) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (name) g.name = name;
  parent.add(g);
  return g;
}

/** Shared human skeleton: legs, torso, head, two arm pivots. Dimensions scale per NPC. */
function figure(o) {
  const group = new THREE.Group();
  const body = pivot(0, 0, 0, group, 'body');
  const hipY = o.hipY ?? 0.92;
  for (const s of [-1, 1]) {
    const leg = pivot(s * o.hipW, hipY, 0, body, 'leg');
    box(o.thigh, 0.46, o.thigh * 1.1, 0, -0.23, 0, o.pants, leg);
    box(o.thigh * 0.95, 0.42, o.thigh, 0, -0.67, 0, o.pants, leg);
    box(o.thigh * 1.1, 0.1, o.thigh * 1.8, 0, -hipY + 0.05, 0.05, o.boot, leg);
  }
  box(o.hipW * 2 + o.thigh, 0.16, o.thigh * 1.3, 0, hipY + 0.02, 0, o.pants, body);
  const torso = pivot(0, hipY + 0.1, 0, body, 'torso');
  box(o.chestW, 0.56, o.chestD, 0, 0.3, 0, o.shirt, torso);
  box(o.chestW * 0.78, 0.14, o.chestD * 0.9, 0, 0.0, 0, o.pants, torso); // waist
  const neck = box(0.1, 0.1, 0.1, 0, 0.62, 0, o.skin, torso);
  const head = pivot(0, 0.62 + 0.05, 0, torso, 'head');
  const sh = o.chestW / 2 + o.armT / 2;
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = pivot(s * sh, 0.52, 0, torso, s < 0 ? 'armR' : 'armL');
    box(o.armT, 0.3, o.armT, 0, -0.15, 0, o.sleeve, arm);
    const fore = pivot(0, -0.3, 0, arm, 'forearm');
    box(o.armT * 0.9, 0.28, o.armT * 0.9, 0, -0.14, 0, o.glove || o.sleeve, fore);
    box(o.armT * 0.8, 0.09, o.armT * 0.9, 0, -0.32, 0, o.hand || o.skin, fore);
    arms.push({ arm, fore });
  }
  return { group, body, torso, head, neck, armL: arms[1], armR: arms[0], hipY };
}

/** Plain human head: skin box with eyes and a nose block; callers add hair or helm. */
function humanHead(head, skin, w = 0.19, h = 0.23) {
  box(w, h, w * 1.05, 0, h / 2, 0, skin, head);
  const eye = M(0x16110e);
  for (const s of [-1, 1]) box(0.028, 0.02, 0.01, s * w * 0.22, h * 0.58, w * 0.53, eye, head);
  box(0.035, 0.05, 0.04, 0, h * 0.42, w * 0.55, skin, head);
  box(0.08, 0.016, 0.01, 0, h * 0.22, w * 0.53, M(0x3a1f1a), head);
}

const breathe = (t, speed = 1.3) => Math.sin(t * speed);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ---------------------------------------------------------------------------
function zavala() {
  const skin = M(0x6a98d4), skinDk = M(0x4f7cb8); // Awoken: blue skin, lighter than his armor so the two read apart
  const blue = M(0x2c5fb0, { metalness: 0.35 }), navy = M(0x1b3358), white = M(0xe8ecf2, { metalness: 0.3 });
  const gold = metal(0xc9a24b), dark = M(0x23262d);
  const f = figure({
    hipW: 0.14, thigh: 0.2, pants: navy, boot: dark, chestW: 0.5, chestD: 0.26, shirt: navy,
    armT: 0.2, sleeve: blue, glove: white, hand: white, skin,
  });
  const { group, torso, head } = f;
  // head: shaved, clean-shaven
  humanHead(head, skin, 0.2, 0.24);
  box(0.21, 0.04, 0.2, 0, 0.24, 0, skinDk, head); // brow/scalp shade
  // chest plate with the Titan mark: a V taper, broad pecs over a narrow waist (muscular, not bulky)
  box(0.74, 0.24, 0.3, 0, 0.46, 0.0, blue, torso);          // pecs
  box(0.56, 0.2, 0.28, 0, 0.27, 0.0, blue, torso);          // ribs
  box(0.4, 0.18, 0.26, 0, 0.1, 0.0, navy, torso);           // waist
  box(0.5, 0.2, 0.05, 0, 0.46, 0.16, white, torso);         // chest panel
  box(0.3, 0.2, 0.04, 0, 0.27, 0.15, white, torso);
  cone(0.09, 0.16, 3, 0, 0.46, 0.2, glow(0x9fd0ff, 1.2), torso, [Math.PI / 2, 0, 0]); // mark
  box(0.04, 0.16, 0.02, 0, 0.46, 0.2, navy, torso);
  box(0.74, 0.05, 0.3, 0, 0.6, 0.0, gold, torso); // collar trim
  cyl(0.12, 0.15, 0.1, 6, 0, 0.66, 0, blue, torso); // thick neck guard
  // heavy shoulders
  for (const s of [-1, 1]) {
    const pad = pivot(s * 0.44, 0.6, 0, torso, 'pauldron');
    box(0.32, 0.22, 0.34, 0, 0, 0, blue, pad, [0, 0, s * 0.14]);
    box(0.34, 0.05, 0.36, 0, 0.11, 0, white, pad, [0, 0, s * 0.14]);
    box(0.06, 0.05, 0.3, s * 0.12, -0.12, 0, gold, pad);
  }
  // belt
  box(0.42, 0.07, 0.28, 0, 0.0, 0, gold, torso);
  // cape over the right shoulder
  const cape = pivot(-0.34, 0.68, -0.17, torso, 'cape');
  box(0.3, 0.9, 0.04, 0, -0.42, 0, cloth(0x2c5fb0), cape, [0.05, 0, 0]);
  box(0.3, 0.06, 0.05, 0, -0.88, 0.005, M(0xe8ecf2), cape, [0.05, 0, 0]);
  // arms folded across the chest
  for (const [side, a] of [[1, f.armL], [-1, f.armR]]) {
    a.arm.rotation.set(-0.45, side * 0.15, side * 0.35);
    a.fore.rotation.set(-1.9 + (side > 0 ? 0 : 0.12), side * -0.75, 0);
  }
  box(0.2, 0.2, 0.04, 0, -0.2, 0.12, M(0x1b3358), f.armR.arm, [0, 0, 0]);
  const base = torso.position.y;
  return {
    group, height: 1.95, update(dt, t) {
      const b = breathe(t, 1.1);
      torso.scale.set(1 + b * 0.008, 1 + b * 0.014, 1 + b * 0.008);
      torso.position.y = base + b * 0.004;
      head.rotation.y = Math.sin(t * 0.25) * 0.12;
      head.rotation.x = Math.sin(t * 0.4) * 0.02;
      cape.rotation.x = 0.04 + Math.sin(t * 0.9) * 0.025;
    },
  };
}

// ---------------------------------------------------------------------------
function ikora() {
  const skin = M(0x5a3a2a);
  const white = cloth(0xeeeae4), red = cloth(0x9c2a2a), gold = metal(0xd4aa4a), dark = M(0x2a2024);
  const f = figure({
    hipW: 0.1, thigh: 0.13, pants: dark, boot: dark, chestW: 0.4, chestD: 0.24, shirt: white,
    armT: 0.1, sleeve: white, glove: red, hand: skin, skin,
  });
  const { group, body, torso, head } = f;
  humanHead(head, skin, 0.16, 0.22);
  box(0.17, 0.04, 0.17, 0, 0.225, 0, M(0x4a2f22), head); // scalp shade
  cone(0.025, 0.07, 3, 0, 0.17, 0.095, glow(0xc79bff, 0.9), head, [Math.PI, 0, 0]); // forehead tilak-like mark
  // chest plate with Warlock mark
  box(0.42, 0.34, 0.27, 0, 0.36, 0.01, red, torso);
  box(0.3, 0.3, 0.04, 0, 0.36, 0.14, white, torso);
  cone(0.07, 0.12, 3, 0, 0.38, 0.17, glow(0xffd98a, 1.2), torso, [0, 0, 0]);
  cone(0.07, 0.12, 3, 0, 0.34, 0.17, glow(0xffd98a, 1.2), torso, [0, 0, Math.PI]);
  box(0.44, 0.04, 0.28, 0, 0.54, 0, gold, torso);
  box(0.42, 0.04, 0.27, 0, 0.16, 0, gold, torso);
  // shoulder mantle
  for (const s of [-1, 1]) {
    box(0.18, 0.08, 0.2, s * 0.24, 0.58, 0, red, torso, [0, 0, s * 0.2]);
    box(0.19, 0.025, 0.21, s * 0.24, 0.62, 0, gold, torso, [0, 0, s * 0.2]);
  }
  // long robe: layered tapered drapes over the legs
  const robe = pivot(0, 0.95, 0, body, 'robe');
  const layer = (w, d, h, y, m) => cyl(w, w * 1.45, h, 6, 0, y, 0, m, robe);
  layer(0.22, 0.2, 0.9, -0.45, white);
  const front = pivot(0, 0.02, 0.1, robe, 'drape');
  box(0.3, 0.95, 0.03, 0, -0.5, 0.06, red, front, [0.04, 0, 0]);
  box(0.3, 0.05, 0.035, 0, -0.97, 0.08, gold, front, [0.04, 0, 0]);
  for (const s of [-1, 1]) {
    box(0.16, 0.8, 0.03, s * 0.2, -0.46, 0.04, white, robe, [0.02, s * -0.12, s * 0.06]);
    box(0.16, 0.04, 0.035, s * 0.2, -0.84, 0.05, gold, robe, [0.02, s * -0.12, s * 0.06]);
  }
  // back drape
  box(0.4, 0.95, 0.03, 0, -0.5, -0.16, red, robe, [-0.06, 0, 0]);
  // bond cloth hanging from the left arm
  const bond = pivot(0.3, 0.46, 0, torso, 'bond');
  box(0.07, 0.65, 0.03, 0.02, -0.34, 0, cloth(0xb23030), bond, [0, 0, 0.04]);
  box(0.07, 0.04, 0.035, 0.02, -0.67, 0, gold, bond, [0, 0, 0.04]);
  // hands clasped in front
  for (const [side, a] of [[1, f.armL], [-1, f.armR]]) {
    a.arm.rotation.set(-0.35, side * 0.05, side * 0.05);
    a.fore.rotation.set(-1.15, side * -0.55, 0);
  }
  const base = torso.position.y;
  return {
    group, height: 1.88, update(dt, t) {
      const b = breathe(t, 1.0);
      torso.position.y = base + b * 0.004;
      torso.scale.set(1, 1 + b * 0.012, 1 + b * 0.01);
      body.rotation.z = Math.sin(t * 0.55) * 0.012;
      robe.rotation.z = -Math.sin(t * 0.55) * 0.02;
      robe.rotation.x = Math.sin(t * 0.8) * 0.012;
      front.rotation.x = Math.sin(t * 1.1) * 0.03;
      bond.rotation.z = Math.sin(t * 1.3) * 0.06;
      head.rotation.y = Math.sin(t * 0.3) * 0.1;
    },
  };
}

// ---------------------------------------------------------------------------
/** Exo head: metal skull, a faceplate with glowing eyes, painted mouth and a grille. */
function exoHead(head, shell, plate, eyeColor, w = 0.17, h = 0.22) {
  box(w, h, w * 1.05, 0, h / 2, 0, shell, head);
  box(w * 0.84, h * 0.7, 0.03, 0, h * 0.5, w * 0.53, plate, head);
  for (const s of [-1, 1]) box(0.04, 0.025, 0.02, s * w * 0.2, h * 0.62, w * 0.59, glow(eyeColor, 2.2), head);
  box(w * 0.7, h * 0.12, 0.02, 0, h * 0.18, w * 0.53, plate, head);
  box(w * 0.35, 0.05, 0.03, 0, 0.0, w * 0.5, shell, head); // chin
  box(w * 1.06, 0.02, w * 1.1, 0, h * 0.8, 0, shell, head); // brow ring
}

function cayde() {
  const frame = metal(0x8a8f96), frameDk = M(0x3a3d42, { metalness: 0.6 });
  const green = cloth(0x3e6b3a), greenDk = cloth(0x2c4d2a), tan = cloth(0xc8aa72), leather = M(0x5a4332);
  const gold = metal(0xd4aa4a), blk = M(0x15161a, { metalness: 0.5 }), plate = M(0xc9ccd0, { metalness: 0.6, roughness: 0.3 });
  const f = figure({
    hipW: 0.12, thigh: 0.14, pants: leather, boot: blk, chestW: 0.46, chestD: 0.27, shirt: M(0x6a7580),
    armT: 0.11, sleeve: frame, glove: frameDk, hand: frameDk, skin: frame,
  });
  const { group, body, torso, head } = f;
  exoHead(head, frame, plate, 0x6fd8ff);
  box(0.13, 0.03, 0.01, 0, 0.055, 0.1, M(0xf2f2ee), head); // pale painted grin
  for (const s of [-0.045, -0.015, 0.015, 0.045]) box(0.007, 0.03, 0.012, s, 0.055, 0.106, M(0x303338), head);
  box(0.05, 0.05, 0.03, 0, 0.02, 0.105, frameDk, head); // goatee grille
  cone(0.025, 0.04, 3, 0, -0.01, 0.1, frameDk, head, [Math.PI, 0, 0]);
  box(0.02, 0.1, 0.02, -0.095, 0.19, 0, gold, head); // antenna nub
  // light Hunter armor
  box(0.5, 0.3, 0.3, 0, 0.38, 0.01, M(0x7a6a50), torso);
  box(0.2, 0.34, 0.04, 0, 0.36, 0.16, M(0x55627a), torso);
  box(0.5, 0.04, 0.3, 0, 0.16, 0, leather, torso);
  box(0.12, 0.08, 0.05, 0, 0.14, 0.15, gold, torso); // buckle
  for (const s of [-1, 1]) box(0.17, 0.09, 0.2, s * 0.28, 0.58, 0, M(0x6a5a40), torso, [0, 0, s * 0.2]);
  // tan scarf wrapped at the neck with a trailing tail
  box(0.23, 0.07, 0.23, 0, 0.62, 0, tan, torso);
  const tail = pivot(-0.1, 0.6, -0.12, torso, 'tail');
  box(0.09, 0.5, 0.03, 0, -0.25, 0, tan, tail, [0.08, 0, 0.06]);
  // green cloak: hood bunched at the neck, hanging back and a tattered edge
  const cape = pivot(0, 0.66, -0.15, torso, 'cape');
  box(0.5, 0.96, 0.035, 0, -0.48, 0, green, cape, [0.05, 0, 0]);
  box(0.5, 0.06, 0.04, 0, -0.96, 0.01, greenDk, cape, [0.05, 0, 0]);
  box(0.12, 0.16, 0.04, -0.2, -1.04, 0.01, greenDk, cape, [0.05, 0, 0]);
  box(0.12, 0.2, 0.04, 0.12, -1.06, 0.01, greenDk, cape, [0.05, 0, 0]);
  box(0.4, 0.1, 0.2, 0, 0.0, 0.0, green, cape, [0.5, 0, 0]); // hood bunch
  // fidget group: the shoulders shrug here
  const fidget = pivot(0, 0, 0, torso, 'fidget');
  // Ace of Spades holstered on the right thigh
  const holster = pivot(-0.16, 0.0, 0.0, body, 'holster');
  holster.position.set(-0.26, 0.88, 0.0);
  box(0.06, 0.2, 0.12, 0, -0.1, 0, leather, holster);
  box(0.05, 0.18, 0.2, 0, -0.08, 0.0, blk, holster, [0.1, 0, 0]);
  box(0.05, 0.07, 0.28, 0, -0.02, 0.1, blk, holster, [0.05, 0, 0]);
  box(0.052, 0.025, 0.2, 0, 0.012, 0.12, gold, holster);
  box(0.055, 0.1, 0.05, 0, -0.14, -0.04, gold, holster, [0.35, 0, 0]);
  box(0.03, 0.03, 0.06, 0, -0.03, 0.26, gold, holster);
  // relaxed arms: left hanging, right hand on hip
  f.armL.arm.rotation.set(0.05, 0, 0.08);
  f.armL.fore.rotation.set(-0.25, 0, 0);
  f.armR.arm.rotation.set(0.25, 0, -0.5);
  f.armR.fore.rotation.set(-1.35, 0.5, 0);
  const base = torso.position.y;
  let nextFidget = 3, fT = -1;
  return {
    group, height: 1.82, update(dt, t) {
      const b = breathe(t, 1.2);
      torso.position.y = base + b * 0.004;
      body.rotation.z = 0.06 + Math.sin(t * 0.5) * 0.01; // leaning
      body.position.x = 0.02;
      cape.rotation.x = 0.03 + Math.sin(t * 1.0) * 0.03;
      tail.rotation.z = Math.sin(t * 1.6) * 0.1;
      if (fT < 0 && t > nextFidget) { fT = 0; nextFidget = t + 3 + (Math.sin(t * 7.3) + 1) * 1.6; }
      let tilt = 0, shrug = 0;
      if (fT >= 0) {
        fT += dt;
        const k = clamp01(fT / 1.1);
        const env = Math.sin(k * Math.PI);
        tilt = env * 0.22 * Math.sin(k * Math.PI * 2 + 0.6);
        shrug = env;
        if (fT >= 1.1) fT = -1;
      }
      head.rotation.z = tilt;
      head.rotation.y = Math.sin(t * 0.7) * 0.1 + tilt * 0.8;
      fidget.position.y = shrug * 0.03;
      torso.rotation.z = -shrug * 0.02;
      f.armL.arm.rotation.z = 0.08 + shrug * 0.12;
      f.armR.arm.rotation.z = -0.5 - shrug * 0.08;
    },
  };
}

// ---------------------------------------------------------------------------
function kadi() {
  const chrome = metal(0xcfd3d8), chromeDk = M(0x6d7278, { metalness: 0.7 });
  const brown = cloth(0x7a5636), tan = cloth(0xc9a56e), trim = metal(0xd4aa4a), dark = M(0x2a2118);
  const paper = M(0xf0e8d2);
  const f = figure({
    hipW: 0.09, thigh: 0.1, pants: chromeDk, boot: dark, chestW: 0.34, chestD: 0.2, shirt: chrome,
    armT: 0.08, sleeve: chrome, glove: chromeDk, hand: chromeDk, skin: chrome, hipY: 0.9,
  });
  const { group, torso, head } = f;
  exoHead(head, chrome, M(0x2a2f36, { metalness: 0.5 }), 0xffc86b, 0.15, 0.2);
  box(0.12, 0.035, 0.01, 0, 0.07, 0.085, glow(0xffc86b, 1.0), head); // visor bar
  // small cap
  box(0.17, 0.05, 0.17, 0, 0.215, 0, brown, head);
  box(0.13, 0.04, 0.13, 0, 0.255, -0.005, brown, head);
  box(0.15, 0.015, 0.09, 0, 0.205, 0.12, dark, head, [0.15, 0, 0]); // brim
  box(0.05, 0.02, 0.01, 0, 0.23, 0.087, trim, head); // badge
  // postal coat: tailored chest, long skirt, collar
  box(0.38, 0.5, 0.24, 0, 0.3, 0.0, brown, torso);
  box(0.06, 0.5, 0.02, 0, 0.3, 0.125, tan, torso); // coat placket
  for (const y of [0.18, 0.32, 0.46]) box(0.03, 0.03, 0.015, 0.06, y, 0.135, trim, torso);
  box(0.4, 0.05, 0.26, 0, 0.56, 0, tan, torso); // collar
  const skirt = pivot(0, 0.96, 0, f.body, 'skirt');
  box(0.36, 0.5, 0.24, 0, -0.25, 0, brown, skirt, [0.02, 0, 0]);
  box(0.37, 0.04, 0.25, 0, -0.5, 0, tan, skirt, [0.02, 0, 0]);
  // satchel strap and bag with letters, on the right hip
  const satchel = pivot(-0.24, 0.1, 0.0, torso, 'satchel');
  box(0.04, 0.66, 0.26, 0.2, 0.28, 0, dark, torso, [0, 0, -0.55]); // diagonal strap
  box(0.1, 0.24, 0.3, 0, -0.1, 0, tan, satchel);
  box(0.11, 0.08, 0.31, 0, 0.0, 0, brown, satchel);
  box(0.02, 0.04, 0.04, -0.06, -0.02, 0.0, trim, satchel);
  for (let i = 0; i < 3; i++) box(0.03, 0.12, 0.1, -0.01 + i * 0.015, 0.06, -0.08 + i * 0.08, paper, satchel, [0.1 * i, 0, 0.1 * i]);
  // arms: right hand holds a letter, left hangs
  f.armL.arm.rotation.set(0.0, 0, 0.1);
  f.armL.fore.rotation.set(-0.3, 0, 0);
  f.armR.arm.rotation.set(-0.4, 0, -0.1);
  f.armR.fore.rotation.set(-1.2, 0, 0);
  box(0.12, 0.01, 0.08, 0, -0.38, 0.05, paper, f.armR.fore, [0.1, 0.2, 0]);
  const base = torso.position.y;
  return {
    group, height: 1.75, update(dt, t) {
      const b = breathe(t, 1.4);
      torso.position.y = base + b * 0.004;
      head.rotation.y = Math.sin(t * 0.6) * 0.18;
      head.rotation.z = Math.sin(t * 0.37) * 0.03;
      satchel.rotation.z = Math.sin(t * 1.1) * 0.03;
      skirt.rotation.x = Math.sin(t * 0.9) * 0.015;
      f.armR.fore.rotation.x = -1.2 + Math.sin(t * 0.8) * 0.06;
    },
  };
}

// ---------------------------------------------------------------------------
function guardian() {
  const skin = M(0x8a6648), armor = M(0x7a8088), trim = M(0xa38a52, { metalness: 0.4 }), under = M(0x2f3339), cl = cloth(0x4b5a6e);
  const f = figure({
    hipW: 0.12, thigh: 0.15, pants: M(0x40454c), boot: under, chestW: 0.48, chestD: 0.28, shirt: armor,
    armT: 0.12, sleeve: armor, glove: under, hand: under, skin,
  });
  const { group, torso, head } = f;
  // helmet: simple visor helm
  box(0.2, 0.25, 0.22, 0, 0.125, 0, armor, head);
  box(0.17, 0.05, 0.03, 0, 0.14, 0.112, glow(0x9fd8ff, 1.0), head);
  box(0.02, 0.1, 0.2, 0, 0.29, 0, trim, head);
  box(0.5, 0.34, 0.3, 0, 0.38, 0.01, armor, torso);
  box(0.5, 0.04, 0.3, 0, 0.16, 0, trim, torso);
  for (const s of [-1, 1]) box(0.2, 0.1, 0.22, s * 0.3, 0.58, 0, armor, torso, [0, 0, s * 0.15]);
  const cape = pivot(0, 0.64, -0.17, torso, 'cape');
  box(0.38, 0.7, 0.03, 0, -0.35, 0, cl, cape, [0.05, 0, 0]);
  f.armL.arm.rotation.set(0.0, 0, 0.1);
  f.armR.arm.rotation.set(0.0, 0, -0.1);
  f.armL.fore.rotation.set(-0.2, 0, 0);
  f.armR.fore.rotation.set(-0.2, 0, 0);
  const base = torso.position.y;
  return {
    group, height: 1.85, update(dt, t) {
      const b = breathe(t, 1.3);
      torso.position.y = base + b * 0.004;
      head.rotation.y = Math.sin(t * 0.35 + 1) * 0.3;
      cape.rotation.x = 0.04 + Math.sin(t * 1.0) * 0.025;
    },
  };
}

const BUILDERS = { zavala, ikora, cayde, kadi, guardian };

/** Build one Tower NPC. Returns { group, update(dt, t), height }. */
export function buildNpc(id) {
  const build = BUILDERS[id];
  if (!build) throw new Error(`buildNpc: unknown NPC id "${id}"`);
  const { group, update, height } = build();
  // Fit the figure to its target height (rest-pose bounds), so every NPC reads at the intended size.
  const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
  if (size.y > 0) group.scale.setScalar(height / size.y);
  group.userData.npcId = id;
  const parts = {};
  group.traverse((o) => { if (o.name && o.isGroup) parts[o.name] = o; });
  group.userData.parts = parts;
  return { group, update, height };
}
