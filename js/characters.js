import * as THREE from 'three';
import { ELEMENTS } from './data.js';
import { buildGunModel } from './models.js';

// Low-poly Guardian models for the Character screen. Units are metres; the
// figure stands on y = 0 facing +z (toward the camera).

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, metalness: 0.15, ...o });
const glowM = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, flatShading: true });

function kit(root) {
  const box = (w, h, d, x, y, z, m, parent = root, r = [0, 0, 0]) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z); o.rotation.set(...r);
    o.castShadow = true;
    parent.add(o);
    return o;
  };
  const mesh = (geo, m, x, y, z, parent = root, r = [0, 0, 0]) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z); o.rotation.set(...r);
    o.castShadow = true;
    parent.add(o);
    return o;
  };
  const pivot = (x, y, z, parent = root) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  return { box, mesh, pivot };
}

/** Shared skeleton: returns pivots so each class can bolt on its own armour. */
function body(root, k, P) {
  const { box, pivot } = k;
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = pivot(s * P.hipW, 0.96, 0);
    box(P.thigh, 0.46, P.thigh * 1.1, 0, -0.23, 0, P.under, hip);
    box(P.thigh * 1.05, 0.2, P.thigh * 1.15, 0, -0.2, 0.01, P.armor, hip);
    const knee = pivot(0, -0.47, 0, hip);
    box(P.thigh * 0.95, 0.44, P.thigh, 0, -0.22, 0, P.armor, knee);
    box(P.thigh * 0.8, 0.1, 0.06, 0, -0.02, P.thigh * 0.55, P.trim, knee);
    box(P.thigh * 1.1, 0.1, P.thigh * 1.7, 0, -0.46, 0.05, P.dark, knee);
    legs.push(hip);
  }
  const torso = pivot(0, 0.98, 0);
  box(P.waistW, 0.2, 0.26, 0, 0.02, 0, P.dark, torso);
  box(P.waistW * 0.92, 0.22, 0.24, 0, 0.18, 0, P.under, torso);
  const chest = box(P.chestW, 0.42, 0.3, 0, 0.47, 0, P.armor, torso);
  box(P.chestW * 0.7, 0.24, 0.05, 0, 0.5, 0.16, P.trim, torso);
  box(0.13, 0.1, 0.13, 0, 0.73, 0, P.under, torso);
  for (const s of [-1, 1]) {
    const sh = pivot(s * (P.chestW / 2 + 0.06), 0.62, 0, torso);
    box(0.13, 0.3, 0.14, 0, -0.16, 0, P.under, sh);
    const el = pivot(0, -0.32, 0, sh);
    box(P.forearm, 0.3, P.forearm, 0, -0.15, 0, P.armor, el);
    box(0.1, 0.1, 0.12, 0, -0.33, 0.01, P.dark, el);
    sh.rotation.z = s * 0.12;
    el.rotation.x = -0.15;
    arms.push(sh);
  }
  const head = pivot(0, 0.86, 0, torso);
  return { legs, arms, torso, head, chest };
}

function titan(root, el) {
  const k = kit(root);
  const P = { hipW: 0.13, thigh: 0.2, waistW: 0.42, chestW: 0.6, forearm: 0.19, armor: M(0x6c727b), under: M(0x2f3339), dark: M(0x1f2226), trim: M(0x4c5158) };
  const b = body(root, k, P);
  const accent = glowM(el.hex);
  const cloth = M(el.hex, { emissive: el.hex, emissiveIntensity: 0.15 });
  // pauldrons, layered
  for (const s of [-1, 1]) {
    k.box(0.3, 0.16, 0.36, s * 0.42, 1.62, 0, P.armor, root, [0, 0, s * -0.25]);
    k.box(0.26, 0.08, 0.32, s * 0.45, 1.53, 0, P.trim, root, [0, 0, s * -0.35]);
    k.box(0.04, 0.04, 0.3, s * 0.36, 1.71, 0, accent, root, [0, 0, s * -0.25]);
  }
  // chest plate ridge + gauntlet cuffs
  k.box(0.08, 0.3, 0.06, 0, 1.46, 0.17, P.trim, root);
  for (const a of b.arms) k.box(0.23, 0.12, 0.23, 0, -0.42, 0, P.armor, a.children[1]);
  // helmet: boxy with visor slit and crest
  k.box(0.28, 0.3, 0.3, 0, 0.16, 0, P.armor, b.head);
  k.box(0.22, 0.05, 0.04, 0, 0.17, 0.155, accent, b.head);
  k.box(0.05, 0.08, 0.32, 0, 0.33, 0, P.trim, b.head);
  k.box(0.3, 0.08, 0.1, 0, 0.04, 0.12, P.trim, b.head);
  // Titan Mark: cloth sash hanging at the waist front
  k.box(0.18, 0.44, 0.02, 0.04, 0.78, 0.15, cloth, root, [0.08, 0, 0.04]);
  k.box(0.2, 0.05, 0.03, 0.04, 1.0, 0.15, P.dark, root);
  return b;
}

function hunter(root, el) {
  const k = kit(root);
  const P = { hipW: 0.1, thigh: 0.16, waistW: 0.34, chestW: 0.44, forearm: 0.14, armor: M(0x5f574d), under: M(0x2b2a28), dark: M(0x1a1918), trim: M(0x8a7a5e) };
  const b = body(root, k, P);
  const accent = glowM(el.hex);
  const cloakM = M(0x3a2f27, { side: THREE.DoubleSide });
  // hood + angular helmet with a visor band
  k.box(0.24, 0.28, 0.26, 0, 0.15, 0.01, P.armor, b.head);
  k.box(0.2, 0.06, 0.03, 0, 0.16, 0.14, accent, b.head);
  k.box(0.32, 0.36, 0.3, 0, 0.17, -0.04, cloakM, b.head);
  k.mesh(new THREE.ConeGeometry(0.05, 0.22, 4), P.trim, 0.12, 0.32, -0.02, b.head, [0, 0, -0.5]);
  k.mesh(new THREE.ConeGeometry(0.05, 0.22, 4), P.trim, -0.12, 0.32, -0.02, b.head, [0, 0, 0.5]);
  // scarf
  k.box(0.32, 0.1, 0.28, 0, 1.72, 0.02, cloakM, root);
  // single shoulder pad on the right
  k.box(0.2, 0.1, 0.24, 0.3, 1.62, 0, P.trim, root, [0, 0, -0.3]);
  // cloak hangs from the shoulders to the knees, split down the middle
  const cloak = new THREE.Group();
  cloak.position.set(0, 1.66, -0.17);
  root.add(cloak);
  for (const s of [-1, 1]) {
    const panel = k.box(0.25, 1.1, 0.025, s * 0.13, -0.55, 0, cloakM, cloak, [0.08, 0, s * 0.04]);
    k.box(0.25, 0.04, 0.03, s * 0.13, -1.08, 0.04, accent, cloak);
    panel.userData.cloak = true;
  }
  // knife on the right thigh
  k.box(0.04, 0.22, 0.03, 0.2, 0.68, 0.06, P.dark, root);
  k.box(0.03, 0.08, 0.02, 0.2, 0.83, 0.06, accent, root);
  b.cloak = cloak;
  return b;
}

function warlock(root, el) {
  const k = kit(root);
  const P = { hipW: 0.11, thigh: 0.17, waistW: 0.36, chestW: 0.48, forearm: 0.15, armor: M(0x4b4458), under: M(0x26232c), dark: M(0x18161c), trim: M(0x9a8a62) };
  const b = body(root, k, P);
  const accent = glowM(el.hex);
  const robeM = M(0x2f2a3a, { side: THREE.DoubleSide });
  // long coat: an open-fronted flared skirt from waist to shins
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.44, 0.78, 10, 1, true, Math.PI * 0.62, Math.PI * 1.76), robeM);
  robe.position.set(0, 0.62, 0);
  robe.castShadow = true;
  root.add(robe);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.015, 3, 20, Math.PI * 1.76), accent);
  hem.rotation.set(Math.PI / 2, 0, Math.PI * 0.62 + Math.PI / 2);
  hem.position.set(0, 0.23, 0);
  root.add(hem);
  // belt, sash panels, tall collar
  k.box(0.4, 0.07, 0.28, 0, 1.0, 0, P.trim, root);
  k.box(0.12, 0.5, 0.02, 0, 0.72, 0.17, robeM, root);
  k.box(0.36, 0.2, 0.3, 0, 1.76, -0.02, P.armor, root);
  // helmet with crown points
  k.box(0.24, 0.27, 0.26, 0, 0.15, 0, P.armor, b.head);
  k.box(0.18, 0.04, 0.03, 0, 0.15, 0.14, accent, b.head);
  for (let i = -2; i <= 2; i++) k.mesh(new THREE.ConeGeometry(0.025, 0.14 + (2 - Math.abs(i)) * 0.04, 4), P.trim, i * 0.05, 0.33, -0.02, b.head);
  // bond: glowing ring on the left forearm
  const bond = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 4, 16), accent);
  bond.rotation.x = Math.PI / 2;
  bond.position.set(0, -0.12, 0);
  b.arms[0].children[1].add(bond);
  b.robe = robe;
  return b;
}

function ghost() {
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

/** Builds a class model. Returns { group, update(dt) }. */
export function buildCharacter(classId, elementId) {
  const el = ELEMENTS[elementId];
  const group = new THREE.Group();
  const fig = new THREE.Group();
  group.add(fig);
  const b = classId === 'vanguard' ? titan(fig, el) : classId === 'stalker' ? hunter(fig, el) : warlock(fig, el);
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
  const knee = (leg) => leg.children[2];
  const elbow = (arm) => arm.children[1];
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
