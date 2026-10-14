import * as THREE from 'three';
import { ELEMENTS } from './data.js';
import { buildGunModel } from './models.js';
import { LOOKS, SHADERS } from './style.js';

// Low-poly Guardian models (Character screen, your own third-person body, fireteam avatars).
// Units are metres; the figure stands on y = 0 facing +z (toward the camera).
// Each class keeps its own silhouette (Titan: bulky plate and the Mark; Hunter: slim, hood and cloak;
// Warlock: long coat and bond). Every armor slot is built from its look in style.js and recolored
// by the shader; glows keep the subclass color. Armor meshes carry userData.slot (icons.js uses it).

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, metalness: 0.15, ...o });
const glowM = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, flatShading: true });
const cone = (r, h) => new THREE.ConeGeometry(r, h, 4);

/** The class's own colors, worn by plain (common to rare) armor. cloth null = the subclass color. */
const CLASS_COLORS = {
  vanguard: { armor: 0x6c727b, trim: 0x4c5158, under: 0x2f3339, cloth: null },
  stalker: { armor: 0x5f574d, trim: 0x8a7a5e, under: 0x2b2a28, cloth: 0x3a2f27 },
  arcanist: { armor: 0x4b4458, trim: 0x9a8a62, under: 0x26232c, cloth: 0x2f2a3a },
};
export const DEFAULT_APPEARANCE = { helmet: 'g0', arms: 'g0', chest: 'g0', legs: 'g0', shader: null };
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

/** Materials for one armor slot: the look's colors (or the class's), recolored by the shader. */
function slotMats(lookId, shader, classId, el) {
  const L = LOOKS[lookId] || LOOKS.g0;
  const c = SHADERS[shader]?.colors || L.colors || CLASS_COLORS[classId];
  const elCloth = c.cloth == null;
  const cloth = elCloth ? el.hex : c.cloth;
  return {
    v: L,
    armor: M(c.armor),
    trim: L.glowTrim ? M(c.trim, { emissive: c.trim, emissiveIntensity: 0.45, metalness: 0.5 }) : M(c.trim, { metalness: 0.3 }),
    under: M(c.under),
    dark: M(shade(c.under, 0.65)),
    cloth: M(cloth, { side: THREE.DoubleSide, emissive: elCloth ? cloth : 0x000000, emissiveIntensity: elCloth ? 0.15 : 0 }),
  };
}

function kit(root) {
  const k = { slot: null };
  const tag = (o) => { o.castShadow = true; if (k.slot) o.userData.slot = k.slot; return o; };
  k.box = (w, h, d, x, y, z, m, parent = root, r = [0, 0, 0]) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z); o.rotation.set(...r);
    parent.add(o);
    return tag(o);
  };
  k.mesh = (geo, m, x, y, z, parent = root, r = [0, 0, 0]) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z); o.rotation.set(...r);
    parent.add(o);
    return tag(o);
  };
  k.pivot = (x, y, z, parent = root) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  return k;
}

/** Shared skeleton plus the leg, chest and gauntlet armor. Returns pivots so each class adds its own pieces. */
function body(k, P, S, accent) {
  const { box, mesh, pivot } = k;
  const legs = [], arms = [];
  // legs
  k.slot = 'legs';
  const L = S.legs, lv = L.v.legs;
  for (const s of [-1, 1]) {
    const hip = pivot(s * P.hipW, 0.96, 0);
    box(P.thigh, 0.46, P.thigh * 1.1, 0, -0.23, 0, L.under, hip);
    box(P.thigh * 1.05, 0.2, P.thigh * 1.15, 0, -0.2, 0.01, L.armor, hip);
    const knee = pivot(0, -0.47, 0, hip);
    hip.userData.knee = knee;
    box(P.thigh * 0.95, 0.44, P.thigh, 0, -0.22, 0, L.armor, knee);
    box(P.thigh * 1.1, 0.1, P.thigh * 1.7, 0, -0.46, 0.05, L.dark, knee); // boot
    const kz = P.thigh * 0.55;
    if (lv.knee === 'pad') box(P.thigh * 0.95, 0.14, 0.08, 0, -0.01, kz, L.trim, knee);
    else if (lv.knee === 'guard') { box(P.thigh * 1.15, 0.16, 0.08, 0, -0.01, kz, L.trim, knee); box(0.04, 0.14, P.thigh * 0.9, s * P.thigh * 0.6, -0.02, 0, L.armor, knee); }
    else {
      box(P.thigh * 0.8, 0.1, 0.06, 0, -0.02, kz, L.trim, knee);
      if (lv.knee === 'spike') mesh(cone(0.035, 0.12), L.trim, 0, -0.01, kz + 0.07, knee, [Math.PI / 2, 0, 0]);
    }
    if (lv.shin === 'plated') box(P.thigh * 0.75, 0.22, 0.05, 0, -0.26, P.thigh * 0.52, L.trim, knee);
    else if (lv.shin === 'stripe') box(0.035, 0.26, 0.03, 0, -0.25, P.thigh * 0.52, accent, knee);
    legs.push(hip);
  }
  // torso and chest armor
  k.slot = 'chest';
  const Ch = S.chest, cv = Ch.v.chest;
  const torso = pivot(0, 0.98, 0);
  box(P.waistW, 0.2, 0.26, 0, 0.02, 0, Ch.dark, torso);
  box(P.waistW * 0.92, 0.22, 0.24, 0, 0.18, 0, Ch.under, torso);
  const chest = box(P.chestW, 0.42, 0.3, 0, 0.47, 0, Ch.armor, torso);
  box(P.chestW * 0.7, 0.24, 0.05, 0, 0.5, 0.16, Ch.trim, torso);
  box(0.13, 0.1, 0.13, 0, 0.73, 0, Ch.under, torso);
  if (cv.plate === 'ridge') box(0.07, 0.34, 0.05, 0, 0.48, 0.19, Ch.armor, torso);
  else if (cv.plate === 'layered') { box(P.chestW * 0.86, 0.12, 0.33, 0, 0.3, 0, Ch.armor, torso); box(P.chestW * 0.6, 0.05, 0.03, 0, 0.3, 0.175, Ch.trim, torso); }
  else if (cv.plate === 'vents') for (const s of [-1, 1]) for (const y of [0.6, 0.53]) box(0.09, 0.04, 0.03, s * P.chestW * 0.3, y, 0.165, Ch.dark, torso);
  else if (cv.plate === 'emblem') mesh(new THREE.OctahedronGeometry(0.055, 0), accent, 0, 0.52, 0.2, torso);
  // arms and gauntlets
  k.slot = 'arms';
  const A = S.arms, av = A.v.arms;
  for (const s of [-1, 1]) {
    const sh = pivot(s * (P.chestW / 2 + 0.06), 0.62, 0, torso);
    box(0.13, 0.3, 0.14, 0, -0.16, 0, A.under, sh);
    const el = pivot(0, -0.32, 0, sh);
    sh.userData.elbow = el;
    box(P.forearm, 0.3, P.forearm, 0, -0.15, 0, A.armor, el);
    box(0.1, 0.1, 0.12, 0, -0.33, 0.01, A.dark, el); // glove
    const f = P.forearm;
    if (av.cuff === 'layered') { box(f * 1.25, 0.09, f * 1.25, 0, -0.06, 0, A.trim, el); box(f * 1.2, 0.08, f * 1.2, 0, -0.26, 0, A.armor, el); }
    else if (av.cuff === 'bracer') box(f * 0.9, 0.24, 0.04, 0, -0.15, f * 0.55, A.trim, el);
    else {
      box(f * 1.2, 0.08, f * 1.2, 0, -0.27, 0, A.trim, el);
      if (av.cuff === 'spiked') mesh(cone(0.03, 0.12), A.trim, s * f * 0.62, -0.13, 0, el, [0, 0, -s * Math.PI / 2]);
    }
    if (av.light) box(0.03, 0.2, 0.03, s * f * 0.53, -0.15, 0.02, accent, el);
    sh.rotation.z = s * 0.12;
    el.rotation.x = -0.15;
    arms.push(sh);
  }
  k.slot = null;
  const head = pivot(0, 0.86, 0, torso);
  return { legs, arms, torso, head, chest };
}

/** Helmet: the class's base shape (d) with the look's visor, crest and jaw. `crest0` is the class default for looks without one. */
function helmet(k, head, H, accent, d, crest0 = null) {
  k.slot = 'helmet';
  const { box, mesh } = k, v = H.v.helmet, fz = d.d / 2, vy = d.y + 0.01, top = d.y + d.h / 2;
  box(d.w, d.h, d.d, 0, d.y, 0, H.armor, head);
  if (v.visor === 'T') { box(d.w * 0.78, 0.045, 0.03, 0, vy + 0.02, fz, accent, head); box(0.045, 0.11, 0.03, 0, vy - 0.04, fz, accent, head); }
  else if (v.visor === 'eyes') for (const s of [-1, 1]) box(0.06, 0.04, 0.03, s * d.w * 0.22, vy + 0.01, fz, accent, head);
  else if (v.visor === 'wide') { box(d.w * 0.9, 0.11, 0.04, 0, vy, fz, H.dark, head); box(d.w * 0.9, 0.02, 0.045, 0, vy - 0.05, fz, accent, head); }
  else if (v.visor === 'round') mesh(new THREE.SphereGeometry(0.08, 8, 6), accent, 0, vy, fz - 0.02, head).scale.set(1.3, 0.75, 0.6);
  else box(d.w * 0.78, 0.045, 0.03, 0, vy, fz, accent, head); // slit
  if (v.jaw) box(d.w * 1.05, 0.08, 0.1, 0, d.y - d.h * 0.4, fz - 0.03, H.trim, head);
  const crest = v.crest ?? crest0;
  if (crest === 'fin') box(0.04, 0.08, d.d * 1.05, 0, top + 0.03, 0, H.trim, head);
  else if (crest === 'horns') for (const s of [-1, 1]) mesh(cone(0.035, 0.2), H.trim, s * d.w * 0.42, top, -0.02, head, [-0.5, 0, -s * 0.5]);
  else if (crest === 'antenna') { box(0.02, 0.22, 0.02, d.w * 0.45, top + 0.06, -0.04, H.trim, head); box(0.035, 0.035, 0.035, d.w * 0.45, top + 0.17, -0.04, accent, head); }
  else if (crest === 'crown') for (let i = -2; i <= 2; i++) mesh(cone(0.025, 0.14 + (2 - Math.abs(i)) * 0.04), H.trim, i * d.w * 0.2, top + 0.05, -0.02, head);
  else if (crest === 'spikes') for (let i = -1; i <= 1; i++) mesh(cone(0.03, 0.1), H.trim, i * d.w * 0.3, top + 0.03, -0.04, head, [-0.4, 0, 0]);
  else if (crest === 'halo') mesh(new THREE.TorusGeometry(d.w * 0.55, 0.012, 4, 20), accent, 0, top + 0.08, -0.04, head, [Math.PI / 2 - 0.25, 0, 0]);
  k.slot = null;
}

const SHOULDER = { small: 0.85, big: 1.15, tall: 1 };

function titan(root, k, S, accent) {
  const b = body(k, { hipW: 0.13, thigh: 0.2, waistW: 0.42, chestW: 0.6, forearm: 0.19 }, S, accent);
  const Ch = S.chest, sv = Ch.v.chest.shoulder, sc = SHOULDER[sv];
  k.slot = 'chest';
  // pauldrons, layered
  for (const s of [-1, 1]) {
    k.box(0.3 * sc, 0.16 * sc, 0.36 * sc, s * 0.42, 0.64, 0, Ch.armor, b.torso, [0, 0, s * -0.25]);
    k.box(0.26 * sc, 0.08, 0.32 * sc, s * 0.45, 0.55, 0, Ch.trim, b.torso, [0, 0, s * -0.35]);
    k.box(0.04, 0.04, 0.3 * sc, s * 0.36, 0.73, 0, accent, b.torso, [0, 0, s * -0.25]);
    if (sv === 'tall') k.box(0.06, 0.2, 0.3, s * 0.52, 0.77, 0, Ch.armor, b.torso, [0, 0, s * -0.25]);
  }
  // Titan Mark: a cloth sash at the waist front
  k.box(0.18, 0.44, 0.02, 0.04, -0.2, 0.15, Ch.cloth, b.torso, [0.08, 0, 0.04]);
  k.box(0.2, 0.05, 0.03, 0.04, 0.02, 0.15, Ch.dark, b.torso);
  // heavy gauntlets
  k.slot = 'arms';
  for (const a of b.arms) k.box(0.24, 0.13, 0.24, 0, -0.24, 0, S.arms.armor, a.userData.elbow);
  // helmet: boxy with a chin guard
  helmet(k, b.head, S.helmet, accent, { w: 0.28, h: 0.3, d: 0.3, y: 0.16 });
  k.slot = 'helmet';
  k.box(0.3, 0.08, 0.1, 0, 0.04, 0.12, S.helmet.trim, b.head);
  k.slot = null;
  return b;
}

function hunter(root, k, S, accent) {
  const b = body(k, { hipW: 0.1, thigh: 0.16, waistW: 0.34, chestW: 0.44, forearm: 0.14 }, S, accent);
  const Ch = S.chest, sv = Ch.v.chest.shoulder, sc = SHOULDER[sv];
  // angular helmet under a hood (the hood ears are the default crest)
  helmet(k, b.head, S.helmet, accent, { w: 0.24, h: 0.28, d: 0.26, y: 0.15 }, 'horns');
  k.slot = 'helmet';
  k.box(0.32, 0.36, 0.3, 0, 0.17, -0.04, S.helmet.cloth, b.head);
  k.slot = 'chest';
  k.box(0.32, 0.1, 0.28, 0, 0.74, 0.02, Ch.cloth, b.torso); // scarf
  // a single shoulder pad on the left
  k.box(0.2 * sc, 0.1 * sc, 0.24 * sc, 0.3, 0.64, 0, Ch.trim, b.torso, [0, 0, -0.3]);
  if (sv === 'tall') k.box(0.16, 0.06, 0.2, 0.33, 0.72, 0, Ch.armor, b.torso, [0, 0, -0.3]);
  // cloak hangs from the shoulders to the knees, split down the middle
  const cloak = new THREE.Group();
  cloak.position.set(0, 0.68, -0.17);
  b.torso.add(cloak);
  for (const s of [-1, 1]) {
    const panel = k.box(0.25, 1.1, 0.025, s * 0.13, -0.55, 0, Ch.cloth, cloak, [0.08, 0, s * 0.04]);
    k.box(0.25, 0.04, 0.03, s * 0.13, -1.08, 0.04, accent, cloak);
    panel.userData.cloak = true;
  }
  // knife on the right thigh
  k.slot = 'legs';
  k.box(0.04, 0.22, 0.03, 0.2, 0.68, 0.06, S.legs.dark, root);
  k.box(0.03, 0.08, 0.02, 0.2, 0.83, 0.06, accent, root);
  k.slot = null;
  b.cloak = cloak;
  return b;
}

function warlock(root, k, S, accent) {
  const b = body(k, { hipW: 0.11, thigh: 0.17, waistW: 0.36, chestW: 0.48, forearm: 0.15 }, S, accent);
  const Ch = S.chest, sv = Ch.v.chest.shoulder;
  k.slot = 'chest';
  // long coat: an open-fronted flared skirt from waist to shins
  const robe = k.mesh(new THREE.CylinderGeometry(0.25, 0.44, 0.78, 10, 1, true, Math.PI * 0.62, Math.PI * 1.76), Ch.cloth, 0, 0.62, 0, root);
  k.mesh(new THREE.TorusGeometry(0.44, 0.015, 3, 20, Math.PI * 1.76), accent, 0, 0.23, 0, root, [Math.PI / 2, 0, Math.PI * 0.62 + Math.PI / 2]);
  // belt, sash panel, tall collar (its size follows the shoulder variant)
  k.box(0.4, 0.07, 0.28, 0, 0.02, 0, Ch.trim, b.torso);
  k.box(0.12, 0.5, 0.02, 0, -0.26, 0.17, Ch.cloth, b.torso);
  const col = { small: [0.36, 0.2], big: [0.44, 0.24], tall: [0.36, 0.32] }[sv];
  k.box(col[0], col[1], 0.3, 0, 0.78 + (col[1] - 0.2) / 2, -0.02, Ch.armor, b.torso);
  helmet(k, b.head, S.helmet, accent, { w: 0.24, h: 0.27, d: 0.26, y: 0.15 }, 'crown');
  // bond: glowing ring on the left forearm
  k.slot = 'arms';
  k.mesh(new THREE.TorusGeometry(0.11, 0.018, 4, 16), accent, 0, -0.12, 0, b.arms[0].userData.elbow, [Math.PI / 2, 0, 0]);
  k.slot = null;
  b.robe = robe;
  return b;
}

/** The Ghost model (also hovers over downed teammates in a fireteam). */
export function ghost() {
  const g = new THREE.Group();
  const shell = M(0xd8dde4, { metalness: 0.4, roughness: 0.4 });
  const dark = M(0x2a2d33);
  for (let i = 0; i < 6; i++) {
    const piece = new THREE.Mesh(new THREE.TetrahedronGeometry(0.07, 0), i % 2 ? shell : dark);
    const a = (i / 6) * Math.PI * 2;
    piece.position.set(Math.cos(a) * 0.06, Math.sin(a) * 0.06, -0.02);
    piece.lookAt(piece.position.clone().multiplyScalar(3));
    g.add(piece);
  }
  const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 1), new THREE.MeshBasicMaterial({ color: 0x8fd8ff }));
  eye.position.z = 0.05;
  const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.z = 0.05;
  g.add(eye, halo);
  return g;
}

/** Builds a class model wearing `look` ({ helmet, arms, chest, legs, shader }, see style.js appearance). Returns { group, update(dt) }. */
export function buildCharacter(classId, elementId, look = DEFAULT_APPEARANCE) {
  const el = ELEMENTS[elementId];
  const a = { ...DEFAULT_APPEARANCE, ...(look || {}) };
  const S = Object.fromEntries(['helmet', 'arms', 'chest', 'legs'].map((sl) => [sl, slotMats(a[sl], a.shader, classId, el)]));
  const group = new THREE.Group();
  const fig = new THREE.Group();
  group.add(fig);
  const k = kit(fig), accent = glowM(el.hex);
  const b = classId === 'vanguard' ? titan(fig, k, S, accent) : classId === 'stalker' ? hunter(fig, k, S, accent) : warlock(fig, k, S, accent);
  // stage disc + element ring
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 1 }));
  disc.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 0.9, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: el.hex, transparent: true, opacity: 0.8 }));
  ring.position.y = 0.002;
  group.add(disc, ring);
  const gh = ghost();
  group.add(gh);
  let t = Math.random() * 10, phase = 0, gun = null;
  const props = [];
  const knee = (leg) => leg.userData.knee;
  const elbow = (arm) => arm.userData.elbow;
  const towards = (cur, target, k) => cur + (target - cur) * k;
  return {
    group,
    /** Hold a weapon (item-like { arch, rarity, element }) or null for empty hands. */
    get gun() { return gun; },
    setGun(item) {
      if (gun) { b.torso.remove(gun); gun = null; }
      if (!item) return;
      gun = buildGunModel(item);
      gun.traverse((o) => { o.userData.gunPart = true; if (o.userData.hand) o.visible = false; });
      gun.userData.flash.visible = false;
      gun.rotation.order = 'YXZ';
      gun.position.set(-0.2, 0.42, 0.3); // right hand, chest height (the figure faces +z, its right is -x)
      b.torso.add(gun);
    },
    /** Super props held in third person: 'hammers' | 'fists' | 'staff' | 'sentinel' | 'stormtrance' | null. */
    setProp(type) {
      for (const p of props) p.parent?.remove(p);
      props.length = 0;
      const R = elbow(b.arms[0]), L = elbow(b.arms[1]); // right and left forearms; the hand is ~0.45 down the forearm
      const glow = (c, k = 2.4) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, flatShading: true });
      const put = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); props.push(mesh); return mesh; };
      if (type === 'hammers') {
        // raised over the shoulder: the forearm's +z points up while aiming
        put(R, new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a3a22, flatShading: true })), 0, -0.45, 0.35);
        put(R, new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.28), glow(0xff8b2b, 2.8)), 0, -0.45, 0.78);
      } else if (type === 'fists') {
        for (const arm of [R, L]) {
          put(arm, new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.3), glow(0x5fd3ff, 2.2)), 0, -0.4, 0);
          put(arm, new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshBasicMaterial({ color: 0x5fd3ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })), 0, -0.55, 0);
        }
      } else if (type === 'staff') {
        const st = put(R, new THREE.Group(), 0, -0.47, 0);
        st.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 6).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x39404c, flatShading: true })));
        for (const sx of [-1, 1]) { const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), glow(0x5fd3ff, 2.8)); tip.position.x = sx * 0.88; tip.scale.x = 2; st.add(tip); }
      } else if (type === 'sentinel') {
        const sh = put(L, new THREE.Group(), 0, -0.4, 0.06);
        sh.add(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.06, 18), new THREE.MeshStandardMaterial({ color: 0x3a3048, flatShading: true })));
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.05, 4, 22).rotateX(Math.PI / 2), glow(0xb07cff, 2.8));
        const boss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), glow(0xe6d0ff, 3));
        boss.position.y = -0.05;
        sh.add(rim, boss);
      } else if (type === 'stormtrance') {
        for (const arm of [R, L]) {
          put(arm, new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), new THREE.MeshBasicMaterial({ color: 0xbfefff })), 0, -0.52, 0);
          put(arm, new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshBasicMaterial({ color: 0x5fd3ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })), 0, -0.52, 0);
        }
      }
    },
    /** pose: null = idle on the Character screen; otherwise { speed, sprint, air, pitch, firing, dead }. */
    update(dt, pose = null) {
      t += dt;
      const br = Math.sin(t * 1.6);
      if (b.cloak) b.cloak.rotation.x = 0.05 + Math.sin(t * 1.3) * 0.03 + (pose ? Math.min(0.5, (pose.speed || 0) * 0.05) : 0);
      if (b.robe) b.robe.rotation.y = Math.sin(t * 0.9) * 0.03;
      gh.position.set(0.55 + Math.sin(t * 0.7) * 0.05, 1.85 + Math.sin(t * 1.9) * 0.05, 0.25);
      gh.rotation.set(Math.sin(t) * 0.2, -0.5 + Math.sin(t * 0.6) * 0.3, t * 0.3);
      if (!pose) {
        b.torso.position.y = 0.98 + br * 0.006;
        b.chest.scale.set(1 + br * 0.01, 1, 1 + br * 0.015);
        b.arms[0].rotation.z = -0.12 - br * 0.02;
        b.arms[1].rotation.z = 0.12 + br * 0.02;
        b.head.rotation.y = Math.sin(t * 0.4) * 0.12;
        return;
      }
      const k = Math.min(1, dt * 12);
      const speed = pose.speed || 0, pitch = pose.pitch || 0;
      // legs: walk / run cycle, tucked in the air
      phase += dt * speed * (pose.sprint ? 1.25 : 1.55);
      const amp = Math.min(1, speed / 6) * (pose.sprint ? 0.95 : 0.6);
      const sw = Math.sin(phase);
      const hipT = pose.air ? [-0.7, -0.35] : [sw * amp, -sw * amp];
      const kneeT = pose.air ? [1.1, 0.6] : [Math.max(0, Math.sin(phase + 1.6)) * amp * 1.3, Math.max(0, Math.sin(phase + 1.6 + Math.PI)) * amp * 1.3];
      b.legs.forEach((leg, i) => { leg.rotation.x = towards(leg.rotation.x, hipT[i], k); knee(leg).rotation.x = towards(knee(leg).rotation.x, kneeT[i], k); });
      // torso: bob while moving, lean forward when sprinting
      b.torso.position.y = 0.98 - (pose.air ? 0.05 : Math.abs(Math.sin(phase)) * 0.045 * Math.min(1, speed / 4));
      b.torso.rotation.x = towards(b.torso.rotation.x, pose.sprint ? 0.25 : 0, k);
      b.head.rotation.x = towards(b.head.rotation.x, -pitch * 0.6 - (pose.sprint ? 0.2 : 0), k);
      b.head.rotation.y = 0;
      // arms: shouldered weapon aimed with the look pitch, lowered while sprinting
      // armsLow: fists carried at the sides (Fists of Havoc)
      const aim = pose.armsLow ? -0.35 : pose.sprint ? -0.55 : -1.35 - pitch * 0.85;
      const kick = pose.firing ? Math.random() * 0.08 : 0;
      b.arms[0].rotation.x = towards(b.arms[0].rotation.x, aim + kick, k);
      b.arms[0].rotation.z = towards(b.arms[0].rotation.z, pose.armsLow ? -0.35 : pose.sprint ? -0.15 : 0.1, k);
      b.arms[1].rotation.x = towards(b.arms[1].rotation.x, (pose.armsLow ? -0.35 : pose.sprint ? -0.4 : -1.2 - pitch * 0.85) + kick, k);
      b.arms[1].rotation.z = towards(b.arms[1].rotation.z, pose.armsLow ? 0.35 : pose.sprint ? 0.2 : -0.55, k);
      // punch / throw: the right arm swings out and back (third-person supers and melee)
      if (pose.punch) {
        const sw = Math.sin(pose.punch * Math.PI);
        b.arms[0].rotation.x = -1.2 - sw * 1.1;
        b.arms[0].rotation.z = 0.1 + sw * 0.25;
        b.torso.rotation.y = -sw * 0.35;
      } else b.torso.rotation.y = towards(b.torso.rotation.y, 0, k);
      elbow(b.arms[0]).rotation.x = towards(elbow(b.arms[0]).rotation.x, pose.punch ? -0.1 : pose.sprint ? -0.9 : -0.15, k);
      elbow(b.arms[1]).rotation.x = towards(elbow(b.arms[1]).rotation.x, pose.sprint ? -0.9 : -0.35, k);
      if (gun) {
        gun.rotation.set(towards(gun.rotation.x, pose.sprint ? 0.7 : pitch, k), Math.PI, pose.sprint ? -0.6 : 0);
        gun.userData.flash.visible = !!pose.firing && Math.random() < 0.5;
      }
    },
  };
}
