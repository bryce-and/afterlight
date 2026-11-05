import * as THREE from 'three';
import { mat } from './world.js';

// ---------------------------------------------------------------------------
// SCORN (U18, from Bryce's references in docs/reference/enemies/scorn-*): Fallen raised by Dark Ether. Pale, veined skin with blue ether
// welling through it, dark brown wraps and rags, riveted ochre-gold scrap armour, chains, a grinning jaw under a studded gold helm, Fallen
// digitigrade legs on taloned feet. c.bodyMat is the skin (hit flashes light it). Shared parts: scornLegs, scornArm (with grip for a
// weapon in the fist), scornHead (one helm per unit), wraps, chains, ether veins. Same builder contract as the other factions: face +z,
// stand on y = 0, c.torso / c.legs / c.arms / c.muzzle per unit. The Ravager also returns c.lamp (its lantern arm, posed by lampSlam).
// The Ether Totem is unchanged (out of U18).
// ---------------------------------------------------------------------------
const PI = Math.PI;
const UP = new THREE.Vector3(0, 1, 0);
const SKIN = 0xd8cfbf;
const ico = (c, r, d, m, x, y, z, parent, crit = false, rot = null) => c.add(new THREE.IcosahedronGeometry(r, d), m, x, y, z, parent, crit, rot);
const cone = (c, r, h, m, x, y, z, parent, rot = null, crit = false, seg = 5) => c.add(new THREE.ConeGeometry(r, h, seg), m, x, y, z, parent, crit, rot);
const cyl = (c, rt, rb, h, seg, m, x, y, z, parent, rot = null, crit = false) => c.add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, parent, crit, rot);

let _M = null;
function sm() {
  if (!_M) _M = {
    skinD: mat(0xb3a693), vein: mat(0x8e3e4c), flesh: mat(0x8a4c3c), fleshP: mat(0xb89ab4), mouth: mat(0x3a1414), teeth: mat(0xe8dfcc),
    talon: mat(0xc99482), wrap: mat(0x6a4c38), wrapD: mat(0x4a3428), cloth: mat(0x231c18), linen: mat(0xcfc5ae),
    gold: mat(0xb88a2c), goldD: mat(0x87631f), stud: mat(0x3b3128), iron: mat(0x4d463f), chain: mat(0x2f2b28), rust: mat(0x7a4a2c),
    hex: mat(0x4f6e6c),
    ether: mat(0x4f63e0, { emissive: 0x3346d8, emissiveIntensity: 1.3 }),
    fire: mat(0xffa040, { emissive: 0xff7a1a, emissiveIntensity: 2.8 }),
    eyeO: mat(0xffb060, { emissive: 0xff8a2a, emissiveIntensity: 2.6 }),
  };
  return _M;
}

/** A box from point a to point b (parent space), w wide and d deep. */
function seg(c, parent, a, b, w, d, m, crit = false) {
  const A = new THREE.Vector3(...a), dir = new THREE.Vector3(...b).sub(A);
  const mesh = c.add(new THREE.BoxGeometry(w, dir.length(), d), m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, parent, crit);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  return mesh;
}
/** A wrap band round the segment a-b at fraction f. */
function band(c, parent, a, b, f, w, m, len = 0.05) {
  const p = a.map((v, i) => v + (b[i] - v) * f), dir = b.map((v, i) => v - a[i]), L = Math.hypot(...dir), h = len / 2 / L;
  return seg(c, parent, p.map((v, i) => v - dir[i] * h), p.map((v, i) => v + dir[i] * h), w, w, m);
}
/** A run of chain links from a to b. */
function chain(c, parent, a, b, n, m, r = 0.035) {
  const geo = new THREE.TorusGeometry(r, r * 0.32, 4, 8);
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    const l = c.add(geo, m, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, parent);
    l.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    l.rotateX(i % 2 ? PI / 2 : 0);
  }
}
/** Chain coiled round a limb segment a-b (a few loose rings). */
function coils(c, parent, a, b, r, n, m) {
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  for (let i = 0; i < n; i++) {
    const f = 0.15 + (0.7 * i) / Math.max(1, n - 1);
    const ring = c.add(new THREE.TorusGeometry(r, r * 0.16, 4, 10), m, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, parent);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    ring.rotateX((i % 2 ? 1 : -1) * 0.25);
  }
}
/** Ether welling through the skin: a few blue glows and red veins scattered over an area. */
function veins(c, parent, pts, s = 1) {
  const M = sm();
  pts.forEach(([x, y, z], i) => ico(c, (i % 3 ? 0.035 : 0.05) * s, 0, i % 2 ? M.vein : M.ether, x, y, z, parent).scale.set(1.3, 0.8, 0.5));
}
/** Rivet studs over a rounded surface: n studs round a ring of radius r at height y. */
function studs(c, parent, r, y, z, n, from, to, s = 0.016, crit = false) {
  for (let i = 0; i < n; i++) {
    const a = from + ((to - from) * i) / Math.max(1, n - 1);
    ico(c, s, 0, sm().stud, Math.sin(a) * r, y, z + Math.cos(a) * r, parent, crit);
  }
}

/** Two Fallen digitigrade legs (knee forward, hock back, a long taloned foot) in skin under dark wraps. `o.knee` 'gold' or 'iron' adds a
 *  riveted knee plate (`o.kneeSide` -1 / 1 for one leg only), `o.shin` a gold greave, `o.chains` loose chain coils round the shins. */
function scornLegs(c, H, hipW, th0, o = {}) {
  const M = sm(), skin = c.bodyMat, th = th0 * 1.35;
  for (const sx of [-1, 1]) {
    const hip = c.pivot(sx * hipW, H, 0);
    const top = [0, 0.03, 0], knee = [sx * 0.015, -0.46 * H, 0.15 * H], ank = [0, -0.85 * H, -0.13 * H], toe = [0, -H + 0.05, 0.05 * H];
    seg(c, hip, top, knee, th * 1.3, th * 1.35, skin);
    seg(c, hip, knee, ank, th, th * 1.05, skin);
    seg(c, hip, ank, toe, th * 0.72, th * 0.78, M.talon);
    ico(c, th * 0.7, 0, skin, ...knee, hip);
    band(c, hip, top, knee, 0.6, th * 1.45, M.wrap, 0.1);
    for (const f of [0.3, 0.65]) band(c, hip, knee, ank, f, th * 1.2, M.wrap, 0.08);
    const k = o.knee && (!o.kneeSide || o.kneeSide === sx) ? o.knee : null;
    if (k === 'iron') {
      ico(c, th * 0.78, 1, M.rust, knee[0], knee[1] - th * 0.1, knee[2] + th * 0.4, hip).scale.set(1, 1.15, 0.65);
      for (let i = 0; i < 5; i++) { const a = -1.0 + i * 0.5; ico(c, 0.014, 0, M.stud, knee[0] + Math.sin(a) * th * 0.6, knee[1] - th * 0.1 + Math.cos(a) * th * 0.45, knee[2] + th * 0.88, hip); }
    } else if (k) {
      const plate = k === 'gold' ? M.gold : M.rust;
      const kp = c.add(new THREE.BoxGeometry(th * 1.9, th * 2.1, 0.06), plate, knee[0], knee[1] - th * 0.2, knee[2] + th * 0.75, hip, false, [0.25, 0, 0]);
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) ico(c, 0.016, 0, M.stud, knee[0] + dx * th * 0.6, knee[1] - th * 0.2 + dy * th * 0.65, knee[2] + th * 0.8 + 0.035, hip);
      kp.scale.z = 1;
    }
    if (o.shin) {
      const g = seg(c, hip, [knee[0], knee[1] - 0.06, knee[2] + th * 0.55], [ank[0], ank[1] + 0.05, ank[2] + th * 0.55], th * 1.4, 0.05, M.gold);
      g.position.z += 0.01;
      for (const f of [0.25, 0.55, 0.85]) band(c, hip, [knee[0], knee[1] - 0.06, knee[2] + th * 0.62], [ank[0], ank[1] + 0.05, ank[2] + th * 0.62], f, th * 1.45, M.goldD, 0.025).scale.z = 0.4;
    }
    if (o.chains) coils(c, hip, knee, ank, th * 0.72, 3, M.chain);
    // three forward talons and a heel spur
    const fy = -H + 0.035;
    for (const tx of [-1, 0, 1]) cone(c, th * 0.24, th * 1.5 + 0.08, M.talon, tx * th * 0.55, fy, toe[2] + th * 0.9 + 0.03, hip, [PI / 2, 0, -tx * 0.3], false, 4);
    cone(c, th * 0.2, th * 1.0 + 0.04, M.talon, 0, fy + 0.02, toe[2] - th * 0.9, hip, [-PI / 2 - 0.3, 0, 0], false, 4);
    c.legs.push(hip);
  }
}

/** One arm hanging from a shoulder pivot at (x, y) on `parent`: a skin upper arm out to the elbow (`o.out` sideways, `o.ez` back), a
 *  wrapped forearm to the hand (`o.hz` forward), a clawed hand. The pivot is turned by `lift` (x) and `o.rz` (z). `o.stripes` bands the
 *  forearm gold (Chieftain), `o.chains` coils chain round it (Ravager), `o.cuff` adds a gold cuff. `noClaw` leaves the hand closed (a grip). */
function scornArm(c, parent, x, y, len, th0, lift, o = {}) {
  const M = sm(), skin = c.bodyMat, sx = Math.sign(x) || 1, th = th0 * 1.3;
  const p = c.pivot(x, y, 0, parent);
  const sh = [0, 0, 0], el = [sx * (o.out ?? 0.05), -len * 0.5, o.ez ?? -0.04], hd = [sx * (o.hx ?? 0.02), -len, o.hz ?? 0.06];
  ico(c, th * 1.0, 0, skin, 0, -0.02, 0, p);
  seg(c, p, sh, el, th * 1.15, th * 1.15, o.upper || skin);
  ico(c, th * 0.7, 0, skin, ...el, p);
  seg(c, p, el, hd, th, th, skin);
  if (o.stripes) for (let i = 0; i < 4; i++) band(c, p, el, hd, 0.12 + i * 0.22, th * 1.3, i % 2 ? M.linen : M.gold, 0.06);
  else if (o.wraps !== false) band(c, p, el, hd, 0.45, th * 1.25, M.wrap, 0.1);
  if (o.chains) coils(c, p, el, hd, th * 0.78, 3, M.chain);
  if (o.cuff) band(c, p, el, hd, 0.82, th * 1.45, M.gold, 0.08);
  c.B(th * 1.25, th * 1.1, th * 1.15, hd[0], hd[1] - th * 0.3, hd[2], skin, p);
  if (!o.noClaw) for (const cx of [-1, 0, 1]) cone(c, th * 0.2, th * 1.6, M.talon, hd[0] + cx * th * 0.4, hd[1] - th * 1.4, hd[2] + th * 0.3, p, [PI - 0.35, 0, cx * 0.25], false, 4);
  p.rotation.x = lift;
  p.rotation.z = sx * (o.rz || 0);
  p.userData.hand = hd;
  return p;
}
/** Turn arm `a` (built by scornArm, on the same parent as the line) so its hand lands on the line O + tD (parent space): the far reach
 *  of the arm along the line when `far`, else the near one; the closest point when it cannot reach. Used for two-handed holds. */
function reachLine(a, O, D, far) {
  const h = new THREE.Vector3(...a.userData.hand), L = h.length(), rel = O.clone().sub(a.position);
  const b = rel.dot(D), q = rel.lengthSq() - L * L, disc = b * b - q;
  const t = disc >= 0 ? (far ? -b + Math.sqrt(disc) : -b - Math.sqrt(disc)) : -b;
  const to = rel.addScaledVector(D, t).normalize();
  a.quaternion.setFromUnitVectors(h.normalize(), to);
}

/** Turn arm `a` so its hand points at `target` (the arm's parent space). */
function reachPoint(a, target) {
  const h = new THREE.Vector3(...a.userData.hand).normalize();
  a.quaternion.setFromUnitVectors(h, target.clone().sub(a.position).normalize());
}

/** A grip in the hand of arm `a`, turned back by `undo` (the arm's lift plus the torso's lean) so a weapon built along +z points ahead. */
function grip(c, a, undo) {
  const h = a.userData.hand;
  const g = c.pivot(h[0], h[1] - 0.04, h[2], a);
  g.rotation.x = -undo;
  g.rotation.z = -a.rotation.z;
  return g;
}

/** A Scorn head at (0, y, z) on `parent`, s its scale: a pale skull with a grinning open jaw under a riveted gold helm (all crit).
 *  Helm styles: 'stalker' a winged comb, 'wraith' two square fins, 'raider' two tall flat blades, 'lurker' a studded dome with ear lobes,
 *  'chieftain' a sunburst crown, 'ravager' no gold, a dark hood bound in chains. */
function scornHead(c, parent, y, z, s, kind) {
  const M = sm(), skin = c.bodyMat;
  seg(c, parent, [0, y - 0.24 * s, z - 0.06 * s], [0, y - 0.06 * s, z], 0.1 * s, 0.11 * s, M.skinD);
  const h = c.pivot(0, y, z, parent);
  ico(c, 0.12 * s, 1, skin, 0, -0.03 * s, 0.01 * s, h, true).scale.set(0.95, 1.1, 1.15);
  c.B(0.13 * s, 0.06 * s, 0.08 * s, 0, -0.12 * s, 0.08 * s, M.mouth, h, true);
  c.B(0.14 * s, 0.03 * s, 0.1 * s, 0, -0.165 * s, 0.06 * s, skin, h, true); // lower jaw
  for (let i = -2; i <= 2; i++) {
    cone(c, 0.012 * s, 0.045 * s, M.teeth, i * 0.024 * s, -0.1 * s, 0.12 * s, h, [PI, 0, 0], true, 3);
    cone(c, 0.011 * s, 0.04 * s, M.teeth, i * 0.024 * s, -0.145 * s, 0.11 * s, h, null, true, 3);
  }
  if (kind === 'ravager') {
    ico(c, 0.15 * s, 1, M.cloth, 0, 0.03 * s, -0.02 * s, h, true).scale.set(1.05, 1.0, 1.15);
    for (let i = 0; i < 4; i++) {
      const r = c.add(new THREE.TorusGeometry(0.155 * s, 0.018 * s, 4, 12), M.chain, 0, (0.08 - i * 0.045) * s, -0.01 * s, h, true);
      r.rotation.set(PI / 2 + (i % 2 ? 0.35 : -0.3), 0, i * 0.4);
    }
    for (const sx of [-1, 1]) c.B(0.02 * s, 0.02 * s, 0.02 * s, sx * 0.045 * s, -0.02 * s, 0.155 * s, M.eyeO, h, true);
    return h;
  }
  // the helm: a studded gold dome down over the eyes, a nose bar to the jaw
  ico(c, 0.145 * s, 1, M.gold, 0, 0.035 * s, -0.01 * s, h, true).scale.set(1.0, 0.82, 1.12);
  c.B(0.03 * s, 0.11 * s, 0.03 * s, 0, -0.04 * s, 0.155 * s, M.gold, h, true);
  c.B(0.2 * s, 0.03 * s, 0.17 * s, 0, -0.035 * s, 0.07 * s, M.goldD, h, true); // brim
  studs(c, h, 0.15 * s, 0.03 * s, -0.01 * s, 7, -1.3, 1.3, 0.013 * s, true);
  studs(c, h, 0.11 * s, 0.11 * s, -0.01 * s, 5, -1.0, 1.0, 0.013 * s, true);
  if (kind === 'stalker') {
    for (const sx of [-1, 1]) {
      c.B(0.025 * s, 0.17 * s, 0.13 * s, sx * 0.07 * s, 0.2 * s, -0.02 * s, M.gold, h, true, [0, 0, sx * -0.55]);
      for (let i = 0; i < 3; i++) c.B(0.11 * s, 0.022 * s, 0.05 * s, sx * (0.15 + i * 0.012) * s, (0.16 + i * 0.05) * s, -0.02 * s, M.gold, h, true, [0, 0, sx * -0.15]);
    }
  } else if (kind === 'wraith') {
    for (const sx of [-1, 1]) {
      c.B(0.12 * s, 0.15 * s, 0.04 * s, sx * 0.075 * s, 0.2 * s, -0.02 * s, M.gold, h, true, [0, 0, sx * -0.18]);
      for (const dy of [-1, 1]) ico(c, 0.012 * s, 0, M.stud, sx * 0.08 * s, (0.2 + dy * 0.04) * s, 0.005 * s, h, true);
    }
  } else if (kind === 'raider') {
    for (const sx of [-1, 1]) c.B(0.1 * s, 0.32 * s, 0.035 * s, sx * 0.065 * s, 0.27 * s, -0.05 * s, M.goldD, h, true, [-0.2, 0, sx * -0.1]);
  } else if (kind === 'lurker') {
    for (const sx of [-1, 1]) ico(c, 0.06 * s, 1, M.gold, sx * 0.1 * s, 0.13 * s, -0.02 * s, h, true).scale.set(0.8, 1, 0.6);
  } else if (kind === 'chieftain') {
    c.B(0.16 * s, 0.14 * s, 0.04 * s, 0, 0.17 * s, 0.02 * s, M.gold, h, true);
    for (let i = 0; i < 9; i++) {
      const a = -1.45 + (2.9 * i) / 8;
      c.B(0.035 * s, 0.3 * s, 0.03 * s, Math.sin(a) * 0.2 * s, 0.1 * s + Math.cos(a) * 0.2 * s, -0.04 * s, i % 2 ? M.goldD : M.gold, h, true, [0, 0, -a]);
    }
  } else throw new Error(`No Scorn helm ${kind}`);
  return h;
}

/** A gold riveted plate (pauldron, greave) on `parent`. */
function plate(c, parent, w, h, d, x, y, z, rot, m = sm().gold, n = 2) {
  c.add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, false, rot);
  for (let i = 0; i < n; i++) ico(c, 0.015, 0, sm().stud, x + (i - (n - 1) / 2) * w * 0.5, y + h * 0.25, z + d / 2 + 0.01, parent);
}

/** The Scorn ether sidearm (Stalker, Chieftain): a stubby gun with a gold cap and a purple glowing barrel. Builds along +z on `g`. */
function sidearm(c, g, big = 1) {
  const M = sm(), s = big;
  c.B(0.07 * s, 0.1 * s, 0.24 * s, 0, 0.0, 0.08 * s, M.iron, g);
  c.B(0.05 * s, 0.12 * s, 0.06 * s, 0, -0.07 * s, 0.0, M.wrapD, g); // handle
  cyl(c, 0.055 * s, 0.05 * s, 0.1 * s, 6, M.gold, 0, 0.01 * s, 0.2 * s, g, [PI / 2, 0, 0]);
  cyl(c, 0.04 * s, 0.04 * s, 0.08 * s, 6, c.accent, 0, 0.01 * s, 0.27 * s, g, [PI / 2, 0, 0]);
  for (const sx of [-1, 1]) cone(c, 0.012, 0.06 * s, M.gold, sx * 0.05 * s, 0.03 * s, 0.22 * s, g, [0, 0, sx * -1.2], false, 3);
  c.muzzle.position.set(0, 0.01 * s, 0.33 * s);
  g.add(c.muzzle);
}

/** Pale chest and belly with a dark waist wrap and a hanging loincloth. Returns nothing; draws on `torso`. */
function trunk(c, torso, w0, h, d0, o = {}) {
  const M = sm(), skin = c.bodyMat, w = w0 * 1.15, d = d0 * 1.2;
  c.B(w * 0.72, h * 0.42, d * 0.85, 0, h * 0.2, 0, skin, torso); // belly
  c.B(w, h * 0.6, d, 0, h * 0.68, 0, skin, torso); // chest
  for (const sx of [-1, 1]) c.B(w * 0.44, h * 0.2, 0.03, sx * w * 0.23, h * 0.74, d * 0.5, skin, torso, false, [0.1, 0, 0]); // flat chest muscle
  c.B(w * 0.78, h * 0.13, d * 0.95, 0, h * 0.02, 0, M.wrap, torso); // waist wrap
  c.B(w * 0.4, h * (o.loin ?? 0.9), 0.025, 0, -h * (o.loin ?? 0.9) * 0.5, d * 0.45, M.cloth, torso, false, [-0.08, 0, 0]);
  c.B(w * 0.55, h * (o.loin ?? 0.9) * 0.8, 0.025, 0, -h * (o.loin ?? 0.9) * 0.4, -d * 0.45, M.cloth, torso, false, [0.1, 0, 0]);
  return { w, h, d };
}

/** Chest gear over a trunk of size {w, h, d} (from trunk): `o.vest` a cloth vest (front panels and shoulders, a material), `o.cross`
 *  two leather straps crossed over the chest and back, `o.sash` one strap over the left shoulder, `o.ribs` that many wrap bands round
 *  the ribs, `o.chains` chains crossed over the chest, `o.buckle` a gold buckle plate where the straps meet, `o.plate` a riveted gold
 *  chest plate. */
function harness(c, torso, { w, h, d }, o = {}) {
  const M = sm(), f = d / 2 + 0.02, b = -d / 2 - 0.02;
  if (o.vest) {
    for (const sx of [-1, 1]) c.B(w * 0.3, h * 0.62, 0.03, sx * w * 0.33, h * 0.66, f - 0.005, o.vest, torso);
    for (const sx of [-1, 1]) c.B(w * 0.3, 0.05, d * 1.05, sx * w * 0.33, h * 0.98, 0, o.vest, torso);
    c.B(w * 0.9, h * 0.6, 0.03, 0, h * 0.66, b + 0.005, o.vest, torso);
  }
  for (let i = 0; i < (o.ribs || 0); i++) c.B(w * 1.04, 0.05, d * 1.06, 0, h * (0.36 + i * 0.12), 0, i % 2 ? M.wrapD : M.wrap, torso);
  const strap = (sx, z, m = M.wrap, wd = 0.07) => seg(c, torso, [sx * w * 0.36, h * 1.0, z], [-sx * w * 0.38, h * 0.1, z], wd, 0.025, m);
  if (o.cross) for (const sx of [-1, 1]) { strap(sx, f); strap(sx, b); }
  if (o.sash) { strap(-1, f, M.wrapD, 0.1); strap(-1, b, M.wrapD, 0.1); }
  if (o.chains) for (const sx of [-1, 1]) chain(c, torso, [sx * w * 0.38, h * 0.98, f], [-sx * w * 0.36, h * 0.15, f], 9, M.chain, 0.028);
  if (o.buckle) { c.B(0.09, 0.09, 0.03, 0, h * 0.56, f + 0.015, M.gold, torso); ico(c, 0.016, 0, M.stud, 0, h * 0.56, f + 0.035, torso); }
  if (o.plate) {
    c.B(w * 0.62, h * 0.32, 0.04, 0, h * 0.72, f + 0.01, M.gold, torso, false, [0.08, 0, 0]);
    for (let i = 0; i < 4; i++) ico(c, 0.016, 0, M.stud, -w * 0.24 + i * w * 0.16, h * 0.84, f + 0.045, torso);
  }
}

// ---------------------------------------------------------------------------
/** Screeb: a low crawling knot of flesh with swollen ether sacs on its back, a small fanged face and four long taloned legs. */
function screeb(c) {
  const M = sm(), skin = c.bodyMat;
  const torso = c.pivot(0, 0.48, 0);
  c.torso = torso;
  ico(c, 0.3, 1, M.flesh, 0, 0.04, -0.02, torso).scale.set(1.05, 0.8, 1.25);
  for (const [x, y, z, r] of [[0.17, 0.12, 0.14, 0.12], [-0.16, 0.1, 0.16, 0.13], [0.2, 0.0, -0.18, 0.13], [-0.19, 0.03, -0.2, 0.12], [0, -0.1, 0.06, 0.14], [0.06, 0.18, -0.1, 0.11], [-0.08, -0.08, -0.22, 0.12]]) {
    ico(c, r, 0, M.flesh, x, y, z, torso).scale.set(1, 0.85, 1);
  }
  // the ether sacs (what blows up)
  for (const [x, y, z, r] of [[-0.14, 0.27, -0.12, 0.14], [0.13, 0.29, -0.04, 0.13], [0.0, 0.31, 0.1, 0.11], [-0.02, 0.24, -0.3, 0.12], [0.21, 0.2, -0.24, 0.09], [-0.22, 0.18, 0.02, 0.09]]) {
    ico(c, r, 1, M.ether, x, y, z, torso).scale.set(1, 0.8, 1.05);
  }
  // the face at the front (the weak point)
  const h = c.pivot(0, 0.02, 0.36, torso);
  ico(c, 0.12, 1, M.flesh, 0, 0, 0, h, true).scale.set(1, 0.95, 0.9);
  c.B(0.11, 0.05, 0.05, 0, -0.045, 0.085, M.mouth, h, true);
  for (let i = -2; i <= 2; i++) cone(c, 0.011, 0.045, M.teeth, i * 0.022, -0.02, 0.105, h, [PI, 0, 0], true, 3);
  for (const sx of [-1, 1]) ico(c, 0.02, 0, M.ether, sx * 0.045, 0.045, 0.095, h, true);
  // four thick legs: lumpy flesh to a high knee, pale bone shins to taloned feet set wide
  const legs = [[0.18, 0.16, 0.48, 0.12, 0.42, 0.6, -0.47, 0.56], [0.17, -0.16, 0.46, 0.14, -0.4, 0.55, -0.47, -0.52]];
  for (const [hx, hz, kx, ky, kz, fx, fy, fz] of legs) {
    for (const sx of [-1, 1]) {
      const hip = c.pivot(sx * hx, 0, hz, torso);
      const k = [sx * (kx - hx), ky, kz - hz], f = [sx * (fx - hx), fy, fz - hz];
      seg(c, hip, [0, 0, 0], k, 0.12, 0.12, M.flesh);
      for (const t of [0.3, 0.7]) ico(c, 0.08, 0, M.flesh, k[0] * t, k[1] * t + 0.03, k[2] * t, hip);
      ico(c, 0.09, 0, M.flesh, ...k, hip);
      seg(c, hip, k, f, 0.08, 0.08, skin);
      band(c, hip, k, f, 0.4, 0.12, M.flesh, 0.14);
      ico(c, 0.06, 0, M.ether, f[0] * 0.92 + k[0] * 0.08, f[1] + 0.1, f[2] * 0.92 + k[2] * 0.08, hip);
      for (const tx of [-1, 0, 1]) cone(c, 0.022, 0.14, M.talon, f[0] + tx * 0.035, f[1] + 0.015, f[2] + Math.sign(f[2]) * 0.07, hip, [Math.sign(f[2]) * PI / 2, 0, tx * 0.4], false, 3);
      c.legs.push(hip);
    }
  }
  // two small grasping forelimbs under the face
  for (const sx of [-1, 1]) {
    seg(c, torso, [sx * 0.1, -0.08, 0.28], [sx * 0.18, -0.26, 0.46], 0.05, 0.05, skin);
    cone(c, 0.018, 0.1, M.talon, sx * 0.19, -0.32, 0.5, torso, [PI - 0.6, 0, 0], false, 3);
  }
  c.muzzle.position.set(0, 0, 0.5);
  torso.add(c.muzzle);
  c.height = 1.0;
}

// ---------------------------------------------------------------------------
/** Wraith: four arms, a burning torch in each upper fist, tall square gold shoulder plates, a chain round the chest. */
function wraith(c) {
  const M = sm();
  scornLegs(c, 0.92, 0.12, 0.08, { knee: 'gold', kneeSide: 1 });
  const torso = c.pivot(0, 0.92, 0);
  torso.rotation.x = 0.22;
  c.torso = torso;
  harness(c, torso, trunk(c, torso, 0.4, 0.62, 0.24, { loin: 0.75 }), { cross: true, ribs: 2, buckle: true });
  veins(c, torso, [[0.1, 0.48, 0.13], [-0.12, 0.38, 0.12], [0.05, 0.3, 0.12], [-0.06, 0.55, 0.13], [0.14, 0.25, 0.1]]);
  const ring = c.add(new THREE.TorusGeometry(0.25, 0.018, 4, 16), M.chain, 0, 0.55, 0.02, torso);
  ring.rotation.set(PI / 2 - 0.25, 0, 0.15);
  for (const sx of [-1, 1]) {
    plate(c, torso, 0.24, 0.07, 0.3, sx * 0.3, 0.66, 0, [0, 0, sx * -0.35]);
    plate(c, torso, 0.04, 0.2, 0.26, sx * 0.4, 0.76, 0, [0, 0, sx * -0.12], M.gold, 1);
    c.B(0.03, 0.14, 0.03, sx * 0.43, 0.82, 0.08, M.goldD, torso);
  }
  scornHead(c, torso, 0.82, 0.05, 1, 'wraith');
  // upper arms with torches (animated); lower arms hanging, clawed
  const lift = -1.3;
  for (const sx of [-1, 1]) {
    const a = scornArm(c, torso, sx * 0.3, 0.6, 0.62, 0.065, lift, { out: 0.08, rz: 0.15 });
    const g = grip(c, a, lift + 0.22);
    cyl(c, 0.025, 0.03, 0.62, 5, M.iron, 0, 0.05, 0, g);
    for (let i = 0; i < 5; i++) ico(c, 0.016, 0, M.stud, 0.02, -0.18 + i * 0.1, 0.02, g);
    cyl(c, 0.055, 0.04, 0.12, 6, M.rust, 0, 0.38, 0, g);
    ico(c, 0.07, 0, M.fire, 0, 0.47, 0, g);
    cone(c, 0.06, 0.24, M.fire, 0, 0.6, 0, g);
    c.arms.push(a);
    scornArm(c, torso, sx * 0.22, 0.4, 0.5, 0.05, -0.35, { out: 0.06, rz: 0.25 });
  }
  c.muzzle.position.set(0, 0.5, 0.3);
  torso.add(c.muzzle);
  c.height = 1.9;
}

// ---------------------------------------------------------------------------
/** Stalker: the common Scorn. Winged gold helm, a black sash crossed over the pale chest, an ether sidearm in the right hand and a spiked
 *  mace in the left, a gold knee plate. */
function stalker(c) {
  const M = sm();
  scornLegs(c, 0.9, 0.12, 0.08, { knee: 'gold', kneeSide: -1 });
  const torso = c.pivot(0, 0.9, 0);
  torso.rotation.x = 0.16;
  c.torso = torso;
  harness(c, torso, trunk(c, torso, 0.38, 0.6, 0.24, { loin: 0.85 }), { ribs: 2, buckle: true });
  for (const sx of [-1, 1]) c.B(0.1, 0.62, 0.03, sx * 0.07, 0.42, 0.135, M.cloth, torso, false, [0, 0, sx * 0.55]); // the crossed sash
  c.B(0.42, 0.06, 0.27, 0, 0.62, 0, M.cloth, torso);
  veins(c, torso, [[0.15, 0.62, 0.11], [-0.16, 0.6, 0.1], [0.12, 0.25, 0.11], [-0.1, 0.18, 0.11]]);
  scornHead(c, torso, 0.8, 0.05, 1, 'stalker');
  const lift = -1.3;
  const r = scornArm(c, torso, 0.24, 0.6, 0.56, 0.06, lift, { out: 0.06, rz: 0.1 });
  sidearm(c, grip(c, r, lift + 0.16));
  const l = scornArm(c, torso, -0.24, 0.6, 0.56, 0.06, -0.45, { out: 0.06, rz: 0.12, noClaw: true });
  const g = grip(c, l, -0.45 + 0.16);
  seg(c, g, [0, 0.06, -0.11], [0, -0.16, 0.29], 0.035, 0.035, M.wrapD); // the mace haft, through the closed fist
  c.B(0.075, 0.07, 0.07, 0, 0, 0, c.bodyMat, g); // fingers closed round the haft
  const mh = [0, -0.17, 0.33];
  ico(c, 0.075, 0, M.iron, ...mh, g);
  for (const [x, y, z] of [[0.08, 0, 0], [-0.08, 0, 0], [0, 0.08, 0], [0, -0.08, 0], [0, 0, 0.08]]) cone(c, 0.018, 0.07, M.iron, x, mh[1] + y, mh[2] + z, g, [z ? PI / 2 : 0, 0, x ? -Math.sign(x) * PI / 2 : y < 0 ? PI : 0], false, 4);
  c.arms.push(r, l);
  c.height = 1.85;
}

// ---------------------------------------------------------------------------
/** Raider: the sniper. Hunched and four-armed behind a heavy ether crossbow, a big studded plate over the shoulders, a tall blade-eared
 *  helm, a pale tabard. */
function raider(c) {
  const M = sm();
  scornLegs(c, 0.95, 0.15, 0.1, { knee: 'iron' });
  const torso = c.pivot(0, 0.95, 0);
  torso.rotation.set(0.42, 0.38, 0, 'YXZ'); // hunched, turned a little to its right
  c.torso = torso;
  harness(c, torso, trunk(c, torso, 0.46, 0.64, 0.3, { loin: 0.95 }), { vest: sm().linen, cross: true, buckle: true });
  veins(c, torso, [[0.18, 0.6, 0.2], [-0.18, 0.5, 0.2], [0.2, 0.3, 0.19], [-0.1, 0.2, 0.2], [0.05, 0.72, 0.2]]);
  // the studded pauldron: a rusted shell over the left shoulder, and a plate rising from it behind the head
  const sp = c.pivot(-0.25, 0.68, -0.01, torso);
  c.add(new THREE.SphereGeometry(0.18, 8, 5, 0, PI * 2, 0, 1.35), M.rust, 0, 0, 0, sp, false, [0, 0, 0.45]).scale.set(1.0, 0.85, 1.15);
  for (let i = 0; i < 6; i++) { const a = -1.1 + i * 0.44; ico(c, 0.016, 0, M.stud, Math.sin(a) * 0.15 - 0.02, 0.12, Math.cos(a) * 0.16, sp); }
  const bp = c.pivot(0.14, 0.08, -0.15, sp);
  bp.rotation.set(-0.35, 0.2, -0.3);
  c.B(0.2, 0.46, 0.05, 0, 0.2, 0, M.rust, bp);
  c.B(0.22, 0.05, 0.07, 0, 0.42, 0.01, M.goldD, bp);
  for (let i = 0; i < 4; i++) for (const dx of [-0.06, 0.06]) ico(c, 0.016, 0, M.stud, dx, 0.04 + i * 0.11, 0.03, bp);
  scornHead(c, torso, 0.84, 0.1, 1.05, 'raider').rotation.y = -0.38; // looks straight ahead over the turned shoulders
  // the ether crossbow, held low across the body and pointing ahead: a heavy stock, crossed bow limbs with glowing blades, an ether ring
  const xb = c.pivot(0.06, 0.28, 0.36, torso);
  xb.rotation.set(-0.42, -0.38, 0, 'YXZ');
  c.B(0.11, 0.15, 0.46, 0, 0, -0.06, M.rust, xb); // stock
  cone(c, 0.06, 0.24, M.wrapD, 0, -0.02, -0.4, xb, [-PI / 2, 0, 0], false, 4); // stock spike
  c.B(0.13, 0.13, 0.34, 0, 0.02, 0.3, M.iron, xb); // receiver
  for (const z of [0.18, 0.4]) c.B(0.15, 0.15, 0.04, 0, 0.02, z, M.goldD, xb);
  c.B(0.05, 0.05, 0.3, 0, 0.11, 0.28, M.wrapD, xb); // top rail
  c.B(0.03, 0.02, 0.5, 0, 0.09, 0.22, M.ether, xb);
  const bow = c.pivot(0, 0.02, 0.5, xb);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const limb = c.pivot(0, 0, 0, bow);
      limb.rotation.set(0, sx * 0.35, sy * (sx > 0 ? 0.55 : PI - 0.55));
      c.B(0.34, 0.05, 0.05, 0.17, 0, 0, M.iron, limb);
      c.B(0.24, 0.025, 0.06, 0.2, 0.02, 0.0, M.ether, limb);
      cone(c, 0.025, 0.1, M.ether, 0.37, 0, 0, limb, [0, 0, -PI / 2], false, 3);
    }
  }
  c.add(new THREE.TorusGeometry(0.15, 0.012, 4, 16), c.accent, 0, 0, 0.06, bow);
  cyl(c, 0.04, 0.05, 0.08, 6, M.gold, 0, 0, 0.04, bow, [PI / 2, 0, 0]);
  c.muzzle.position.set(0, 0.02, 0.62);
  xb.add(c.muzzle);
  // one fist on the stock at the hip, the other forward on the receiver, each arm turned to reach the crossbow's line
  const up = [scornArm(c, torso, -0.28, 0.62, 0.52, 0.07, -0.9, { out: 0.06, hz: 0.08, noClaw: true }), scornArm(c, torso, 0.28, 0.62, 0.52, 0.07, -0.5, { out: 0.06, hz: 0.08, noClaw: true })];
  const D = new THREE.Vector3(0, 0, 1).applyEuler(xb.rotation);
  reachLine(up[0], xb.position.clone().addScaledVector(D, 0.3), D, true);
  reachLine(up[1], xb.position.clone().addScaledVector(D, -0.05), D, false);
  c.arms.push(...up);
  // the lower pair hangs, claws open
  for (const sx of [-1, 1]) scornArm(c, torso, sx * 0.24, 0.4, 0.46, 0.055, -0.35, { out: 0.08, rz: 0.3 });
  c.height = 2.0;
}

// ---------------------------------------------------------------------------
/** Lurker: crouched wide behind a round gold shield (left; its hitbox is `frontGuard.box` in factions.js), a three-eyed hand cannon in the
 *  right fist, gold greaves. */
function lurker(c) {
  const M = sm();
  scornLegs(c, 0.8, 0.2, 0.095, { shin: true, knee: 'gold' });
  for (const l of c.legs) l.rotation.z = Math.sign(l.position.x) * 0.12;
  const torso = c.pivot(0, 0.8, 0);
  torso.rotation.x = 0.22;
  c.torso = torso;
  harness(c, torso, trunk(c, torso, 0.44, 0.6, 0.28, { loin: 0.7 }), { vest: M.cloth, sash: true, ribs: 1, plate: true });
  veins(c, torso, [[0.18, 0.4, 0.14], [-0.15, 0.3, 0.14], [0.1, 0.2, 0.13]]);
  scornHead(c, torso, 0.8, 0.06, 1, 'lurker');
  const l = scornArm(c, torso, -0.26, 0.6, 0.52, 0.07, -1.25, { out: 0.12, rz: 0.15 });
  const r = scornArm(c, torso, 0.26, 0.6, 0.52, 0.07, -1.35, { out: 0.08, rz: 0.05, noClaw: true });
  c.arms.push(l, r);
  // the three-eyed hand cannon
  const g = grip(c, r, -1.35 + 0.22);
  c.B(0.13, 0.13, 0.2, 0, 0, 0.06, M.rust, g);
  c.B(0.15, 0.15, 0.04, 0, 0, 0.17, M.gold, g);
  for (const [x, y] of [[-0.035, 0.03], [0.035, 0.03], [0, -0.035]]) ico(c, 0.024, 0, M.eyeO, x, y, 0.19, g);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; cone(c, 0.012, 0.06, M.iron, Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.12, g, [0, 0, a - PI / 2], false, 3); }
  c.muzzle.position.set(0, 0, 0.22);
  g.add(c.muzzle);
  // the round shield (r 0.35), strapped to the left fist: the arm reaches to the centre of the guard box (factions.js), and the shield
  // hangs from a grip in that hand, facing forward
  c.g.updateMatrixWorld(true);
  reachPoint(l, torso.worldToLocal(new THREE.Vector3(-0.6, 1.1, 0.42)));
  l.updateMatrixWorld(true);
  const sh = c.pivot(0, 0, 0, l);
  sh.position.set(...l.userData.hand);
  const q = new THREE.Quaternion(); l.getWorldQuaternion(q);
  sh.quaternion.copy(q.invert());
  sh.translateZ(0.07);
  const R0 = 0.35;
  cyl(c, R0, R0, 0.05, 16, M.gold, 0, 0, 0, sh, [PI / 2, 0, 0]);
  cyl(c, R0 * 0.8, R0 * 0.8, 0.03, 16, M.rust, 0, 0, 0.03, sh, [PI / 2, 0, 0]);
  cyl(c, R0 * 0.6, R0 * 0.6, 0.02, 6, M.hex, 0, 0, 0.045, sh, [PI / 2, 0, 0]);
  ico(c, R0 * 0.27, 1, M.gold, 0, 0, 0.06, sh).scale.set(1, 1, 0.45);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; ico(c, 0.016, 0, M.stud, Math.cos(a) * R0 * 0.9, Math.sin(a) * R0 * 0.9, 0.03, sh); }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + 0.4; cone(c, 0.02, 0.08, M.goldD, Math.cos(a) * (R0 + 0.01), Math.sin(a) * (R0 + 0.01), 0, sh, [0, 0, a - PI / 2], false, 4); }
  c.B(0.06, 0.1, 0.06, 0, 0, -0.04, M.wrapD, sh); // the hand strap
  c.height = 1.8;
}

// ---------------------------------------------------------------------------
/** Ravager: the melee Scorn at normal size, hunched low, its head bound in a chained hood, a burning lantern on a chain in the right
 *  fist (c.lamp: the lampSlam skill whirls it overhead and slams it down), chains coiled on the arms and shins. */
function ravager(c) {
  const M = sm();
  scornLegs(c, 0.88, 0.14, 0.095, { chains: true });
  const torso = c.pivot(0, 0.88, 0);
  torso.rotation.x = 0.42;
  c.torso = torso;
  harness(c, torso, trunk(c, torso, 0.44, 0.6, 0.28, { loin: 0.8 }), { chains: true, ribs: 2 });
  c.B(0.36, 0.08, 0.3, 0, 0.0, 0.0, M.gold, torso); // belt
  for (let i = 0; i < 3; i++) c.B(0.04, 0.1, 0.02, -0.08 + i * 0.08, -0.09, 0.15, M.cloth, torso);
  veins(c, torso, [[0.18, 0.62, 0.13], [-0.16, 0.55, 0.13], [0.08, 0.4, 0.14], [-0.12, 0.3, 0.13], [0.2, 0.25, 0.12], [-0.04, 0.68, 0.14]]);
  for (const sx of [-1, 1]) ico(c, 0.13, 0, c.bodyMat, sx * 0.27, 0.62, 0, torso).scale.set(1, 0.85, 1); // heavy shoulders
  scornHead(c, torso, 0.7, 0.14, 1.05, 'ravager');
  const l = scornArm(c, torso, -0.3, 0.6, 0.6, 0.075, -1.3, { out: 0.1, rz: 0.15, chains: true });
  c.arms.push(l);
  // the lantern arm: the chain hangs from the fist; lampPose (enemy-skills.js) raises the arm and spins the chain
  const rest = -0.3;
  const arm = scornArm(c, torso, 0.3, 0.6, 0.6, 0.075, rest, { out: 0.1, rz: 0.12, chains: true, noClaw: true });
  const ch = c.pivot(arm.userData.hand[0], arm.userData.hand[1] - 0.05, arm.userData.hand[2], arm);
  ch.rotation.order = 'YXZ';
  chain(c, ch, [0, 0, 0], [0, -0.42, 0], 6, M.chain, 0.03);
  const lamp = c.pivot(0, -0.6, 0, ch);
  cone(c, 0.12, 0.1, M.iron, 0, 0.13, 0, lamp, null, false, 6);
  cyl(c, 0.13, 0.13, 0.03, 6, M.iron, 0, 0.07, 0, lamp);
  cyl(c, 0.13, 0.13, 0.03, 6, M.iron, 0, -0.12, 0, lamp);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; c.B(0.025, 0.2, 0.025, Math.cos(a) * 0.12, -0.025, Math.sin(a) * 0.12, M.iron, lamp); }
  cyl(c, 0.09, 0.08, 0.17, 6, M.fire, 0, -0.025, 0, lamp);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2; cone(c, 0.02, 0.1, M.iron, Math.cos(a) * 0.15, -0.12, Math.sin(a) * 0.15, lamp, [Math.sin(a) * PI / 2, 0, -Math.cos(a) * PI / 2], false, 4); }
  cone(c, 0.03, 0.1, M.iron, 0, -0.19, 0, lamp, [PI, 0, 0], false, 4);
  c.lamp = { arm, chain: ch, rest };
  c.muzzle.position.set(0, 0.5, 0.3);
  torso.add(c.muzzle);
  c.height = 1.75;
}

// ---------------------------------------------------------------------------
/** Chieftain: taller, a gold sunburst crown, layered gold pauldrons over a dark sash, gold-striped arms, a long gold tabard and greaves,
 *  an ether sidearm in the right hand, a lower pair of small arms. */
function chieftain(c) {
  const M = sm();
  scornLegs(c, 1.0, 0.15, 0.1, { shin: true, knee: 'gold' });
  const torso = c.pivot(0, 1.0, 0);
  torso.rotation.x = 0.12;
  c.torso = torso;
  harness(c, torso, trunk(c, torso, 0.48, 0.68, 0.3, { loin: 0.95 }), { cross: true, ribs: 1, plate: true });
  c.B(0.5, 0.12, 0.33, 0, 0.66, 0, M.cloth, torso); // sash over the shoulders
  for (const sx of [-1, 1]) c.B(0.1, 0.5, 0.03, sx * 0.13, 0.45, 0.16, M.cloth, torso, false, [0, 0, sx * 0.1]);
  // the long tabard: gold and dark strips down to the knees
  for (let i = -1; i <= 1; i++) c.B(0.1, 0.85, 0.025, i * 0.1, -0.38, 0.17, i ? M.cloth : M.gold, torso, false, [-0.05, 0, 0]);
  veins(c, torso, [[0.16, 0.5, 0.15], [-0.15, 0.35, 0.15], [0.1, 0.25, 0.14]]);
  for (const sx of [-1, 1]) {
    plate(c, torso, 0.28, 0.07, 0.34, sx * 0.33, 0.74, 0, [0, 0, sx * -0.45]);
    plate(c, torso, 0.24, 0.07, 0.3, sx * 0.39, 0.64, 0, [0, 0, sx * -0.75], M.goldD);
    for (let i = 0; i < 3; i++) c.B(0.03, 0.22, 0.12, sx * (0.3 + i * 0.06), 0.84, -0.04 + i * 0.03, M.gold, torso, false, [0, 0, sx * -0.2]);
  }
  scornHead(c, torso, 0.9, 0.06, 1.1, 'chieftain');
  const lift = -1.3;
  const r = scornArm(c, torso, 0.32, 0.66, 0.6, 0.07, lift, { out: 0.08, rz: 0.12, stripes: true, cuff: true, noClaw: true });
  sidearm(c, grip(c, r, lift + 0.12), 1.2);
  const l = scornArm(c, torso, -0.32, 0.66, 0.6, 0.07, -0.55, { out: 0.1, rz: 0.15, stripes: true, cuff: true });
  c.arms.push(r, l);
  for (const sx of [-1, 1]) scornArm(c, torso, sx * 0.24, 0.42, 0.42, 0.05, -0.6, { out: 0.06, rz: 0.3 });
  c.height = 2.25;
}

// ---------------------------------------------------------------------------
/** Abomination: a huge headless mass of ether-swollen flesh with pale plated limbs; its gold helm is sunk into the top of its chest (the
 *  weak point). Chains and gold cuffs on the forearms and shins, iron knobs on the shoulders, a dark band across the chest. */
function abomination(c) {
  const M = sm(), skin = c.bodyMat;
  scornLegs(c, 1.0, 0.36, 0.22, { chains: true });
  const torso = c.pivot(0, 1.0, 0);
  torso.rotation.x = 0.28;
  c.torso = torso;
  c.B(0.8, 0.3, 0.55, 0, 0.1, 0, M.cloth, torso); // hips and loincloth
  c.B(0.3, 0.7, 0.03, 0, -0.3, 0.3, M.cloth, torso, false, [-0.05, 0, 0]);
  c.B(0.1, 0.6, 0.035, 0, -0.27, 0.31, M.gold, torso, false, [-0.05, 0, 0]);
  ico(c, 0.72, 1, M.fleshP, 0, 0.95, 0, torso).scale.set(1.15, 0.95, 0.85);
  for (const [x, y, z, r] of [[0.35, 1.25, 0.35, 0.28], [-0.35, 1.2, 0.38, 0.3], [0.2, 0.7, 0.5, 0.25], [-0.25, 0.65, 0.48, 0.24], [0, 0.45, 0.4, 0.26], [0.45, 0.9, 0.3, 0.22], [-0.48, 0.92, 0.28, 0.22], [0, 1.4, 0.1, 0.3]]) {
    ico(c, r, 0, M.fleshP, x, y, z, torso).scale.set(1, 0.9, 0.8);
  }
  veins(c, torso, [[0.3, 1.0, 0.6], [-0.2, 0.8, 0.62], [0.1, 0.55, 0.6], [-0.4, 1.1, 0.5], [0.45, 0.7, 0.45], [-0.05, 1.05, 0.66]], 2);
  c.B(1.5, 0.12, 1.0, 0, 0.82, 0.02, M.cloth, torso, false, [0, 0, 0.12]); // the band across the chest
  for (const sx of [-1, 1]) {
    ico(c, 0.42, 1, skin, sx * 0.72, 1.28, 0, torso).scale.set(1, 0.85, 1); // pale plated shoulders
    for (const [dx, dz] of [[-0.1, 0.25], [0.12, -0.05], [0, -0.3]]) ico(c, 0.07, 0, M.iron, sx * (0.72 + dx), 1.62, dz, torso);
  }
  // the helm sunk into the chest
  const hm = c.pivot(0, 1.42, 0.55, torso);
  hm.rotation.x = -0.25;
  const rim = c.add(new THREE.TorusGeometry(0.22, 0.05, 5, 14), M.goldD, 0, 0, 0, hm, true);
  rim.rotation.y = 0;
  ico(c, 0.2, 1, M.gold, 0, 0, -0.04, hm, true).scale.set(1, 1, 0.5);
  for (let i = 0; i < 4; i++) c.B(0.2, 0.025, 0.03, 0, -0.08 + i * 0.05, 0.08, M.cloth, hm, true, [0, 0, -0.5]);
  c.B(0.04, 0.3, 0.05, 0, 0.0, 0.1, M.gold, hm, true);
  for (const sx of [-1, 1]) {
    c.B(0.12, 0.2, 0.04, sx * 0.08, 0.3, 0.02, M.gold, hm, true, [0, 0, sx * -0.12]);
    for (let i = 0; i < 2; i++) c.B(0.05, 0.03, 0.05, sx * 0.17, 0.25 + i * 0.07, 0.02, M.gold, hm, true);
  }
  studs(c, hm, 0.23, 0.0, 0.0, 5, -1.2, 1.2, 0.018, true);
  // the huge arms, fists down
  for (const sx of [-1, 1]) {
    const a = scornArm(c, torso, sx * 0.82, 1.2, 1.3, 0.24, -0.35, { out: 0.18, rz: 0.1, chains: true, cuff: true, hz: 0.12 });
    const h = a.userData.hand;
    ico(c, 0.26, 1, skin, h[0], h[1] - 0.12, h[2], a).scale.set(1, 1.1, 1);
    if (sx === 1) { c.muzzle.position.set(h[0], h[1] - 0.15, h[2] + 0.28); a.add(c.muzzle); }
    c.arms.push(a);
  }
  c.height = 2.8;
}

// ---------------------------------------------------------------------------
// The Ether Totem (unchanged from U14; out of U18) and the helpers it was built with.
const BONE = () => mat(0xb9ad8c);
const RUST = () => mat(0x6b5a44);
const CLOTH = () => mat(0x3a3128);
function oldCone(c, parent, r, h, x, y, z, m, rot = null, crit = false, sides = 4) {
  return c.add(new THREE.ConeGeometry(r, h, sides), m, x, y, z, parent, crit, rot);
}

function totem(c) {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  const bone = BONE(), rust = RUST(), cloth = CLOTH();
  const torso = pivot(0, 0, 0);
  c.torso = torso;
  // stepped base of scrap
  B(1.0, 0.18, 1.0, 0, 0.09, 0, rust, torso);
  B(0.8, 0.14, 0.8, 0, 0.25, 0, dark, torso, false, [0, 0.4, 0]);
  // vertical stack: plate, skull, bone, skull
  B(0.5, 0.4, 0.5, 0, 0.5, 0, bodyMat, torso, false, [0, 0.2, 0]);
  B(0.38, 0.3, 0.38, 0, 0.85, 0, bone, torso, false, [0, -0.3, 0]);
  B(0.3, 0.26, 0.3, 0, 1.15, 0.0, bone, torso);
  B(0.07, 0.05, 0.03, -0.07, 1.17, 0.16, dark, torso);
  B(0.07, 0.05, 0.03, 0.07, 1.17, 0.16, dark, torso);
  B(0.34, 0.12, 0.34, 0, 1.35, 0, rust, torso, false, [0, 0.5, 0]);
  B(0.12, 0.3, 0.12, 0, 1.55, 0, bone, torso);
  // scrap spikes jutting from the stack, hanging chain links and rags
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    oldCone(c, torso, 0.04, 0.4, Math.cos(a) * 0.3, 0.7 + (i % 2) * 0.35, Math.sin(a) * 0.3, bone, [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9]);
  }
  for (let i = 0; i < 4; i++) B(0.05, 0.08, 0.02, 0.26, 1.3 - i * 0.1, 0.1, i % 2 ? dark : bone, torso);
  B(0.3, 0.5, 0.02, 0, 0.62, 0.28, cloth, torso, false, [-0.1, 0, 0]);
  // ether seams up the stack
  for (const y of [0.45, 0.8, 1.15]) B(0.34, 0.025, 0.03, 0, y, 0.2, accent, torso);
  B(0.03, 1.0, 0.03, 0.2, 0.8, 0.21, accent, torso);
  // floating ether crystal: the weak point
  const crystal = add(new THREE.OctahedronGeometry(0.2, 0), accent, 0, 1.78, 0, torso, true);
  crystal.scale.set(0.8, 1.4, 0.8);
  c.crystal = crystal; // optional: spin/bob target for the integrator
  for (const [x, y, z] of [[0.3, 1.6, 0.0], [-0.26, 1.85, 0.12], [0.05, 1.95, -0.3]]) add(new THREE.OctahedronGeometry(0.05, 0), accent, x, y, z, torso);
  c.muzzle.position.set(0, 1.78, 0);
  torso.add(c.muzzle);
  c.height = 2.0;
}


const BUILDERS = {
  sc_screeb: screeb,
  sc_wraith: wraith,
  sc_ravager: ravager,
  sc_stalker: stalker,
  sc_raider: raider,
  sc_lurker: lurker,
  sc_abomination: abomination,
  sc_chieftain: chieftain,
  sc_totem: totem,
};

/** Scorn model dispatcher: `t` is the unit id (sc_screeb ... sc_totem). Every unit but the totem wears the pale Scorn skin as c.bodyMat. */
export function scorn(c, t) {
  const build = BUILDERS[t];
  if (!build) throw new Error(`Unknown Scorn unit ${t}`);
  if (t !== 'sc_totem') c.bodyMat.color.setHex(SKIN);
  build(c);
}
