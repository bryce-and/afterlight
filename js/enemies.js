import * as THREE from 'three';
import { G } from './state.js';
import { ENEMY_TYPES, ELEMENTS } from './data.js';
import { STAGGER } from './combat.js';
import { mat } from './world.js';
import { rand, clamp, pick } from './util.js';
import { hasLOS, pushOutCircle, pointInColliders, groundAt } from './physics.js';
import { NAV, heightAt, cellIndex, lineClear, findPath, floodReach, ledgeSpots, nearestWalkable } from './nav.js';
import { leashTarget, pastLeash, insideLeash, COVER, coverAllowed, CLOSE_MELEE, closeMeleeReach, SUICIDE, blastDamage } from './ai.js';
import { sparks, ringFx, basicMat, explosionFx, flashLight } from './effects.js';
import { sfx } from './audio.js';
import { damagePlayer, spawnBossAdds, killEnemy, dealDamage } from './game.js';
import * as ui from './ui.js';
import { pickTarget, allPlayers, damageRemote, announceShot, announceGrenade, remoteBarrierBlocks, sendFx } from './coop.js';
import { TIERS, FACTION_PROFILES, SHIELD, shieldFor, GRENADE, grenadeThrower, lobVelocity, JET, ENRAGE, isEnraged, SUICIDE_BLAST, suicideCore, BOSS_PHASE, bossPhaseTime, shieldBurstDamage } from './tiers.js';
import { BOSS_MODELS } from './bosses.js';
import { FACTIONS, NEW_PROFILES, UNITS, unitName, unitShield, isNewFaction } from './factions.js';
import { taken } from './models-taken.js';
import { scorn } from './models-scorn.js';
import { vex, extraModel } from './models-vex.js';
import { skillInit, skillUpdate, skillOnDeath, spinAngle } from './enemy-skills.js';
import { StatusSet, ENEMY_STATUS, SLOW_MULT } from './status.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const shotGeo = new THREE.IcosahedronGeometry(1, 0);
const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

// ---------------------------------------------------------------------------
// Enemy models: one builder per faction, shaped after Destiny's units.
// Models face +z, stand on y = 0, and are ~2m tall before def.scale.
// Head/eye meshes are tagged crit (precision hits).
// ---------------------------------------------------------------------------
function buildModel(e, C, faction) {
  if (isNewFaction(faction) && !e.bossModel) C = { ...C, ...FACTIONS[faction].colors }; // U14: Taken and Scorn units keep their own palette on any destination
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: C.enemy, flatShading: true, roughness: 0.7, metalness: 0.15 });
  const dark = mat(C.enemy2);
  const accent = mat(C.eye, { emissive: C.eye, emissiveIntensity: 2.2 });
  const hit = [];
  const add = (geo, m, x, y, z, parent = g, crit = false, r = null) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    if (r) mesh.rotation.set(r[0], r[1], r[2]);
    mesh.castShadow = true;
    mesh.userData.enemy = e;
    mesh.userData.crit = crit;
    parent.add(mesh);
    hit.push(mesh);
    return mesh;
  };
  const B = (w, h, d, x, y, z, m, parent = g, crit = false, r = null) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, crit, r);
  const pivot = (x, y, z, parent = g) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
  const c = { g, add, B, pivot, bodyMat, dark, accent, C, muzzle: new THREE.Object3D(), legs: [], arms: [], torso: null, height: 2.05 };
  const bossBuilder = e.bossModel && BOSS_MODELS[e.bossModel];
  if (bossBuilder) bossBuilder(c);
  else if (e.typeId === 'obj_node') objNode(c);
  else if (extraModel(e.typeId)) extraModel(e.typeId)(c);
  else if (faction === 'taken') taken(c, e.typeId);
  else if (faction === 'scorn') scorn(c, e.typeId);
  else if (faction === 'vex') vex(c, e.typeId);
  else if (e.typeId === 'suicide') (faction === 'scrappers' ? shank : cursedThrall)(c);
  else ({ scrappers: fallen, hollow: hive, legion: cabal })[faction](c, e.typeId);
  let shield = null;
  if (e.maxShield > 0) {
    shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: ELEMENTS[e.shieldEl].hex, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
    shield.scale.set(0.78, c.height * 0.56, 0.78);
    shield.position.y = c.height * 0.51;
    g.add(shield);
  }
  g.scale.setScalar(0.01);
  return { group: g, hit, legs: c.legs, arms: c.arms, torso: c.torso, bodyMat, muzzle: c.muzzle, shield, height: c.height, hover: !!c.hover, spin: c.spin, flames: c.flames, onDeath: c.onDeath, deathStep: c.deathStep };
}

/** Two legs; digitigrade bends the knee backward like Fallen and Hive. */
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

/** Gun held at chest height; places the muzzle at its front. */
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

// ---------------------------------------------------------------------------
// FALLEN: four arms, four eyes, cloaks, digitigrade legs
// ---------------------------------------------------------------------------
function fallen(c, t) {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  const armor = mat(0x6f716a), cloth = mat(0x3c4a5c);
  if (t === 'heavy') {
    // Brig: a walking Fallen tank
    for (const s of [-1, 1]) {
      const hip = pivot(s * 0.32, 1.0, 0);
      B(0.26, 0.55, 0.3, 0, -0.25, 0.05, armor, hip, false, [-0.25, 0, 0]);
      B(0.22, 0.55, 0.26, 0, -0.72, 0.02, dark, hip, false, [0.25, 0, 0]);
      B(0.36, 0.12, 0.5, 0, -0.96, 0.08, armor, hip);
      c.legs.push(hip);
    }
    const body = pivot(0, 1.0, 0);
    c.torso = body;
    B(0.95, 0.55, 0.8, 0, 0.42, 0, bodyMat, body);
    B(0.8, 0.2, 0.7, 0, 0.78, -0.05, armor, body);
    B(0.5, 0.18, 0.06, 0, 0.5, 0.41, dark, body, true);
    B(0.38, 0.06, 0.04, 0, 0.52, 0.44, accent, body, true);
    for (const s of [-1, 1]) {
      B(0.26, 0.26, 0.75, s * 0.62, 0.42, 0.1, armor, body);
      for (const dy of [-0.06, 0.06]) add(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6).rotateX(Math.PI / 2), dark, s * 0.62, 0.42 + dy, 0.62, body);
      B(0.03, 0.4, 0.03, s * 0.3, 1.05, -0.3, dark, body);
    }
    c.muzzle.position.set(0.62, 0.42, 0.8);
    body.add(c.muzzle);
    c.height = 2.0;
    return;
  }
  const big = t === 'captain' || t === 'boss';
  const W = big ? 1.3 : t === 'rusher' ? 0.85 : 1;
  legsBiped(c, 0.95, 0.15 * W, 0.12 * W, dark, armor, true);
  const torso = pivot(0, 0.95, 0);
  torso.rotation.x = t === 'rusher' ? 0.45 : 0.22;
  c.torso = torso;
  B(0.26 * W, 0.24, 0.2, 0, 0.12, 0, dark, torso);
  B(0.42 * W, 0.38, 0.28, 0, 0.45, 0, bodyMat, torso);
  B(0.36 * W, 0.2, 0.06, 0, 0.5, 0.15, armor, torso);
  // helmet with mandible fins and four eyes
  B(0.22, 0.18, 0.26, 0, 0.82, 0.07, armor, torso, true);
  for (const s of [-1, 1]) {
    B(0.04, 0.14, 0.12, s * 0.12, 0.74, 0.17, armor, torso, true, [0.3, 0, s * 0.2]);
    for (const dy of [0, 0.05]) B(0.035, 0.03, 0.03, s * 0.05, 0.84 - dy, 0.205, accent, torso, true);
  }
  // hooded cloak hanging off the back
  add(new THREE.ConeGeometry(0.34 * W, 0.4, 5, 1, true), cloth, 0, 0.8, -0.04, torso);
  B(0.5 * W, big ? 1.0 : 0.8, 0.03, 0, big ? 0.15 : 0.25, -0.17, cloth, torso, false, [0.15, 0, 0]);
  // four arms: upper pair holds the weapon, lower pair braces it
  const up = [arm(c, torso, -0.27 * W, 0.62, 0.48, 0.08, bodyMat, -1.2, 0.1), arm(c, torso, 0.27 * W, 0.62, 0.48, 0.08, bodyMat, -1.2, -0.1)];
  arm(c, torso, -0.2 * W, 0.36, 0.38, 0.065, bodyMat, -0.9, 0.3);
  arm(c, torso, 0.2 * W, 0.36, 0.38, 0.065, bodyMat, -0.9, -0.3);
  c.arms.push(...up);
  if (t === 'rusher') {
    // Dreg: shock blades instead of a rifle
    for (const a of up) B(0.02, 0.05, 0.36, 0, -0.5, 0.12, accent, a);
    c.muzzle.position.set(0, 0.5, 0.3); torso.add(c.muzzle);
  } else {
    gun(c, torso, 0.12, 0.42, 0.45, big ? 0.75 : 0.65, 0.08);
  }
  if (big) {
    for (const s of [-1, 1]) {
      B(0.26, 0.12, 0.32, s * 0.33, 0.68, 0, armor, torso, false, [0, 0, s * -0.3]);
      add(new THREE.ConeGeometry(0.03, 0.3, 4), armor, s * 0.08, 1.02, 0.02, torso, true, [-0.4, 0, s * -0.4]);
    }
    B(0.1, 0.5, 0.02, 0.1, 0.08, 0.16, mat(c.C.accent), torso);
  }
  if (t === 'boss') {
    // Kell-style banners behind the shoulders
    for (const s of [-1, 1]) {
      B(0.03, 1.1, 0.03, s * 0.24, 1.0, -0.2, dark, torso);
      B(0.22, 0.5, 0.015, s * 0.24 + s * 0.12, 1.3, -0.2, mat(c.C.accent), torso);
    }
  }
}

// ---------------------------------------------------------------------------
// HIVE: bone and chitin, green eyes, crowns of spikes
// ---------------------------------------------------------------------------
function hive(c, t) {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  const chitin = mat(0x2a2a24), bone = bodyMat, cloth = mat(0x4a4436);
  if (t === 'heavy') {
    // Ogre: huge, hunched, tiny head with a beam eye
    legsBiped(c, 0.8, 0.28, 0.26, chitin, chitin);
    const torso = pivot(0, 0.8, 0);
    torso.rotation.x = 0.35;
    c.torso = torso;
    B(1.0, 0.85, 0.7, 0, 0.5, 0, bone, torso);
    B(0.9, 0.35, 0.6, 0, 0.9, -0.08, chitin, torso);
    for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.06, 0.3, 4), bone, -0.32 + i * 0.16, 1.1, -0.2, torso);
    B(0.3, 0.24, 0.26, 0, 0.82, 0.38, chitin, torso, true);
    B(0.2, 0.08, 0.04, 0, 0.84, 0.52, accent, torso, true);
    c.muzzle.position.set(0, 0.84, 0.56); torso.add(c.muzzle);
    for (const s of [-1, 1]) {
      const a = arm(c, torso, s * 0.62, 0.8, 0.95, 0.24, bone, -0.4, s * -0.15);
      B(0.3, 0.2, 0.32, 0, -1.0, 0.05, chitin, a);
      c.arms.push(a);
    }
    c.height = 2.1;
    return;
  }
  if (t === 'rusher') {
    // Thrall: emaciated, eyeless, all claws
    legsBiped(c, 0.85, 0.1, 0.08, bone, bone, true);
    const torso = pivot(0, 0.85, 0);
    torso.rotation.x = 0.6;
    c.torso = torso;
    B(0.24, 0.5, 0.18, 0, 0.3, 0, bone, torso);
    for (let i = 0; i < 3; i++) B(0.26, 0.025, 0.2, 0, 0.2 + i * 0.1, 0.01, chitin, torso);
    add(new THREE.ConeGeometry(0.11, 0.34, 6), bone, 0, 0.66, 0.08, torso, true, [0.9, 0, 0]);
    for (const s of [-1, 1]) {
      const a = arm(c, torso, s * 0.17, 0.5, 0.62, 0.05, bone, -1.3, s * -0.1);
      for (let k = -1; k <= 1; k++) add(new THREE.ConeGeometry(0.012, 0.16, 3), chitin, k * 0.025, -0.68, 0.02, a, false, [Math.PI, 0, 0]);
      c.arms.push(a);
    }
    c.muzzle.position.set(0, 0.5, 0.3); torso.add(c.muzzle);
    c.height = 1.8;
    return;
  }
  const big = t === 'captain' || t === 'boss';
  const W = big ? 1.25 : 0.9;
  legsBiped(c, 0.95, 0.13 * W, 0.11 * W, chitin, chitin, true);
  const torso = pivot(0, 0.95, 0);
  torso.rotation.x = 0.12;
  c.torso = torso;
  B(0.3 * W, 0.24, 0.22, 0, 0.12, 0, chitin, torso);
  B(0.46 * W, 0.42, 0.3, 0, 0.47, 0, chitin, torso);
  for (let i = 0; i < 3; i++) B(0.4 * W, 0.04, 0.04, 0, 0.36 + i * 0.1, 0.16, bone, torso);
  // rounded helmet with a single glowing slit
  add(new THREE.IcosahedronGeometry(0.15, 0), chitin, 0, 0.84, 0.03, torso, true).scale.set(1, 1.15, 1.2);
  B(0.16, 0.035, 0.04, 0, 0.84, 0.18, accent, torso, true);
  for (const s of [-1, 1]) {
    B(0.2 * W, 0.12, 0.28, s * 0.3 * W, 0.66, 0, bone, torso, false, [0, 0, s * -0.25]);
    add(new THREE.ConeGeometry(0.04, 0.28, 4), bone, s * 0.36 * W, 0.8, -0.02, torso, false, [0, 0, s * -0.6]);
  }
  const arms = [arm(c, torso, -0.32 * W, 0.62, 0.55, 0.09, chitin, -1.15, 0.1), arm(c, torso, 0.32 * W, 0.62, 0.55, 0.09, chitin, -1.15, -0.1)];
  c.arms.push(...arms);
  // Acolyte shredder / Knight boomer
  gun(c, torso, 0.16, 0.42, 0.42, big ? 0.5 : 0.6, big ? 0.13 : 0.08);
  if (big) {
    // Knight: crown of spikes and a tattered loincloth
    for (let i = -2; i <= 2; i++) add(new THREE.ConeGeometry(0.03, 0.22 + (2 - Math.abs(i)) * 0.07, 4), bone, i * 0.06, 1.02, 0, torso, true, [0, 0, -i * 0.15]);
    B(0.22, 0.5, 0.02, 0, -0.1, 0.17, cloth, torso);
  }
  if (t === 'boss') {
    B(0.2, 0.2, 0.04, 0, 0.55, 0.17, accent, torso);
    for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.06, 0.6, 4), bone, s * 0.22, 1.2, -0.05, torso, true, [0, 0, s * -0.35]);
  }
}

// ---------------------------------------------------------------------------
// CABAL: massive armoured soldiers, jetpacks, war beasts
// ---------------------------------------------------------------------------
function cabal(c, t) {
  const { B, add, pivot, bodyMat, dark, accent } = c;
  const armor = bodyMat, under = dark, metal = mat(0x4a4440);
  if (t === 'rusher') {
    // War Beast: four-legged attack hound
    const body = pivot(0, 0.62, 0);
    c.torso = body;
    B(0.46, 0.38, 1.0, 0, 0.0, 0, under, body);
    B(0.5, 0.18, 0.8, 0, 0.18, -0.05, armor, body);
    B(0.38, 0.3, 0.38, 0, 0.06, 0.62, armor, body, true);
    B(0.3, 0.1, 0.3, 0, -0.08, 0.68, under, body, true);
    for (const s of [-1, 1]) {
      add(new THREE.ConeGeometry(0.04, 0.22, 4), metal, s * 0.16, -0.08, 0.84, body, false, [Math.PI / 2 + 0.4, 0, 0]);
      B(0.05, 0.04, 0.03, s * 0.1, 0.12, 0.81, accent, body, true);
    }
    B(0.06, 0.06, 0.5, 0, 0.05, -0.7, under, body, false, [0.5, 0, 0]);
    // harness strap and a row of back spikes
    B(0.52, 0.06, 0.12, 0, 0.17, 0.15, mat(c.C.accent), body);
    for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.05, 0.2, 4), metal, 0, 0.3, -0.35 + i * 0.18, body);
    for (const [x, z] of [[-0.2, 0.36], [0.2, 0.36], [0.2, -0.36], [-0.2, -0.36]]) {
      const hip = pivot(x, 0.6, z);
      B(0.12, 0.6, 0.14, 0, -0.3, 0, under, hip);
      B(0.14, 0.06, 0.2, 0, -0.58, 0.04, metal, hip);
      c.legs.push(hip);
    }
    c.muzzle.position.set(0, 0.62, 0.9); c.g.add(c.muzzle);
    c.height = 1.15;
    return;
  }
  // Loyalist variant (Calus's guard): gold trims; Red Legion keeps the faction accent
  const trim = c.C.loyalist ? mat(0xf2c14e, { emissive: 0xf2c14e, emissiveIntensity: 0.5 }) : mat(c.C.accent);
  if (t === 'heavy') return colossus(c, armor, under, metal, trim);
  if (t === 'captain') return centurion(c, armor, under, metal, trim);
  if (t === 'boss') return cabalBoss(c, armor, under, metal);
  legionary(c, armor, under, metal, trim);
}

/** Legionary: small plain soldier, round helm with one vertical visor slit, light plate, slug rifle two-handed. */
function legionary(c, armor, under, metal, trim) {
  const { B, add, pivot, accent } = c;
  legsBiped(c, 0.85, 0.15, 0.16, under, metal);
  for (const s of [-1, 1]) B(0.18, 0.2, 0.2, s * 0.15, 0.58, 0.04, armor);
  const torso = pivot(0, 0.85, 0);
  c.torso = torso;
  B(0.38, 0.24, 0.28, 0, 0.12, 0, under, torso);
  B(0.5, 0.42, 0.36, 0, 0.46, 0, armor, torso);
  B(0.3, 0.14, 0.06, 0, 0.4, 0.2, metal, torso);
  // rounded helm: a dome over a jaw block, one vertical slit
  add(new THREE.SphereGeometry(0.17, 8, 6), armor, 0, 0.84, 0.03, torso, true);
  B(0.2, 0.1, 0.22, 0, 0.74, 0.04, under, torso, true);
  B(0.04, 0.18, 0.03, 0, 0.84, 0.2, accent, torso, true);
  for (const s of [-1, 1]) B(0.2, 0.15, 0.3, s * 0.32, 0.64, 0, armor, torso, false, [0, 0, s * -0.15]);
  // faction stripe across the left shoulder
  B(0.22, 0.04, 0.32, -0.32, 0.725, 0, trim, torso, false, [0, 0, 0.15]);
  const arms = [arm(c, torso, -0.32, 0.58, 0.5, 0.11, under, -1.25, 0.35), arm(c, torso, 0.32, 0.58, 0.5, 0.11, under, -1.3, -0.3)];
  for (const a of arms) B(0.14, 0.16, 0.14, 0, -0.38, 0, armor, a);
  c.arms.push(...arms);
  // long slug rifle held in both hands
  gun(c, torso, 0.04, 0.34, 0.5, 0.8, 0.09);
  B(0.07, 0.14, 0.12, 0.04, 0.24, 0.35, metal, torso);
  c.height = 1.75;
}

/** Centurion: tall officer. Plumed helm, cape, one oversized pauldron, jetpack, hand cannon. */
function centurion(c, armor, under, metal, trim) {
  const { B, add, pivot, accent } = c;
  legsBiped(c, 1.0, 0.17, 0.17, under, metal);
  for (const s of [-1, 1]) B(0.2, 0.26, 0.22, s * 0.17, 0.7, 0.04, armor);
  const torso = pivot(0, 1.0, 0);
  c.torso = torso;
  B(0.42, 0.28, 0.3, 0, 0.14, 0, under, torso);
  B(0.6, 0.56, 0.4, 0, 0.56, 0, armor, torso);
  B(0.4, 0.2, 0.08, 0, 0.5, 0.22, trim, torso);
  // helm with a tall plume
  B(0.3, 0.3, 0.3, 0, 1.0, 0.04, armor, torso, true);
  B(0.24, 0.1, 0.06, 0, 0.97, 0.2, under, torso, true);
  B(0.2, 0.035, 0.03, 0, 0.98, 0.235, accent, torso, true);
  B(0.05, 0.12, 0.42, 0, 1.2, 0, trim, torso, true);
  B(0.05, 0.3, 0.1, 0, 1.3, -0.2, trim, torso, true, [-0.4, 0, 0]);
  // asymmetric shoulders: one oversized pauldron on the left, small plate on the right
  B(0.46, 0.3, 0.5, -0.46, 0.84, 0, armor, torso, false, [0, 0, 0.2]);
  B(0.5, 0.06, 0.54, -0.46, 1.0, 0, trim, torso, false, [0, 0, 0.2]);
  B(0.2, 0.14, 0.3, 0.38, 0.8, 0, armor, torso, false, [0, 0, -0.15]);
  // cape down the back
  B(0.5, 0.95, 0.03, 0, 0.3, -0.26, trim, torso, false, [0.08, 0, 0]);
  // jetpack with thruster flames, hidden until lift-off (U13b)
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.09, 0.11, 0.42, 8), metal, s * 0.14, 0.45, -0.32, torso);
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 8), accent, s * 0.14, 0.22, -0.32, torso);
    const fl = add(new THREE.ConeGeometry(0.09, 0.55, 6).rotateX(Math.PI), mat(0xffa030, { emissive: 0xff7a1a, emissiveIntensity: 2.4 }), s * 0.14, -0.05, -0.32, torso);
    fl.visible = false;
    (c.flames ||= []).push(fl);
  }
  // off arm raised, cannon arm forward
  const arms = [arm(c, torso, -0.42, 0.7, 0.58, 0.14, under, -0.5, 0.3), arm(c, torso, 0.42, 0.7, 0.58, 0.14, under, -1.2, -0.12)];
  for (const a of arms) B(0.18, 0.2, 0.18, 0, -0.44, 0, armor, a);
  c.arms.push(...arms);
  gun(c, torso, 0.36, 0.4, 0.5, 0.65, 0.16);
  B(0.22, 0.22, 0.22, 0.36, 0.4, 0.82, metal, torso);
  c.height = 2.3;
}

/** Colossus: squat and very wide. Sunken helm between huge shoulders, back slab and gas tank, gatling arm. */
function colossus(c, armor, under, metal, trim) {
  const { B, add, pivot, accent } = c;
  legsBiped(c, 0.75, 0.3, 0.3, under, metal);
  for (const s of [-1, 1]) B(0.34, 0.26, 0.34, s * 0.3, 0.52, 0.04, armor);
  const torso = pivot(0, 0.75, 0);
  c.torso = torso;
  B(0.8, 0.3, 0.5, 0, 0.14, 0, under, torso);
  B(1.0, 0.64, 0.62, 0, 0.6, 0, armor, torso);
  B(0.7, 0.2, 0.08, 0, 0.5, 0.33, trim, torso);
  // small helm sunk low, with a wide visor slit
  B(0.26, 0.24, 0.26, 0, 1.0, 0.08, armor, torso, true);
  B(0.2, 0.05, 0.06, 0, 1.0, 0.22, accent, torso, true);
  // huge shoulders rise above the head line
  for (const s of [-1, 1]) {
    B(0.5, 0.36, 0.7, s * 0.7, 0.98, 0, armor, torso, false, [0, 0, s * -0.12]);
    B(0.54, 0.06, 0.74, s * 0.7, 1.17, 0, trim, torso, false, [0, 0, s * -0.12]);
  }
  // heavy plated back slab and a gas tank
  B(0.9, 0.8, 0.14, 0, 0.7, -0.38, metal, torso);
  add(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 8), under, 0.22, 0.7, -0.55, torso);
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8), accent, 0.22, 1.08, -0.55, torso);
  // off arm hangs thick; gatling arm braced forward
  const off = arm(c, torso, -0.78, 0.8, 0.6, 0.26, under, -0.6, 0.15);
  B(0.32, 0.3, 0.32, 0, -0.46, 0, armor, off);
  const gat = arm(c, torso, 0.78, 0.8, 0.5, 0.28, under, -1.0, -0.05);
  B(0.34, 0.3, 0.34, 0, -0.4, 0, armor, gat);
  c.arms.push(off, gat);
  // slug-thrower gatling: six barrels around a drum
  const gx = 0.66, gy = 0.46, gz = 0.6;
  B(0.3, 0.3, 0.4, gx, gy, gz - 0.2, metal, torso);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(new THREE.CylinderGeometry(0.028, 0.028, 0.7, 6).rotateX(Math.PI / 2), under, gx + Math.cos(a) * 0.09, gy + Math.sin(a) * 0.09, gz + 0.2, torso);
  }
  c.muzzle.position.set(gx, gy, gz + 0.58); torso.add(c.muzzle);
  c.height = 2.15;
}

/** Cabal boss fallback body: Centurion-sized officer with a crest (named bosses use js/bosses.js). */
function cabalBoss(c, armor, under, metal) {
  const { B, pivot, accent } = c;
  legsBiped(c, 0.9, 0.23, 0.23, under, metal);
  const torso = pivot(0, 0.9, 0);
  c.torso = torso;
  B(0.56, 0.26, 0.3, 0, 0.12, 0, under, torso);
  B(0.84, 0.5, 0.42, 0, 0.5, 0, armor, torso);
  B(0.5, 0.18, 0.08, 0, 0.42, 0.22, metal, torso);
  B(0.32, 0.3, 0.32, 0, 0.92, 0.04, armor, torso, true);
  B(0.24, 0.12, 0.06, 0, 0.9, 0.2, under, torso, true);
  B(0.2, 0.035, 0.03, 0, 0.92, 0.235, accent, torso, true);
  for (const s of [-1, 1]) B(0.4, 0.2, 0.42, s * 0.56, 0.72, 0, armor, torso, false, [0, 0, s * -0.15]);
  B(0.04, 0.16, 0.36, 0, 1.12, 0.02, mat(c.C.accent), torso);
  for (let i = -2; i <= 2; i++) B(0.04, 0.2 + (2 - Math.abs(i)) * 0.08, 0.04, i * 0.07, 1.16, -0.04, accent, torso, true);
  const arms = [arm(c, torso, -0.56, 0.62, 0.55, 0.15, under, -1.1, 0.12), arm(c, torso, 0.56, 0.62, 0.55, 0.15, under, -1.1, -0.12)];
  for (const a of arms) B(0.2, 0.22, 0.2, 0, -0.42, 0, armor, a);
  c.arms.push(...arms);
  gun(c, torso, 0.2, 0.4, 0.45, 0.6, 0.12);
}

/** Story objective target: a plinth with a tilted crystal pylon and a glowing band; the crystal is the precision spot. */
function objNode(c) {
  const { B, add, accent } = c;
  add(new THREE.CylinderGeometry(0.7, 0.9, 0.35, 8), c.dark, 0, 0.17, 0);
  B(0.5, 1.3, 0.5, 0, 1.0, 0, c.bodyMat, c.g, false, [0.0, 0.5, 0.12]);
  B(0.7, 0.14, 0.7, 0, 1.0, 0, accent, c.g);
  add(new THREE.OctahedronGeometry(0.45), accent, 0, 1.95, 0, c.g, true);
  B(0.08, 0.5, 0.08, 0.5, 0.75, 0, c.dark, c.g, false, [0, 0, -0.3]);
  B(0.08, 0.5, 0.08, -0.5, 0.75, 0, c.dark, c.g, false, [0, 0, 0.3]);
  c.muzzle.position.set(0, 1.4, 0.4); c.g.add(c.muzzle);
  c.height = 2.4;
}

/** Cursed Thrall: a Thrall with a swollen, glowing sac strapped to its back. */
function cursedThrall(c) {
  hive(c, 'rusher');
  const hot = mat(0xff7a1a, { emissive: 0xff7a1a, emissiveIntensity: 2.6 });
  c.B(0.42, 0.4, 0.4, 0, 0.3, -0.28, hot, c.torso, true);
  c.B(0.14, 0.14, 0.14, 0, 0.55, -0.28, c.accent, c.torso);
}

/** Explosive Shank: a hovering drone with a glowing charge in its nose. */
function shank(c) {
  const { B, add, pivot, bodyMat, dark } = c;
  const hot = mat(0xff4a1a, { emissive: 0xff4a1a, emissiveIntensity: 2.8 });
  const core = pivot(0, 1.0, 0);
  c.torso = core;
  add(new THREE.OctahedronGeometry(0.42, 0), bodyMat, 0, 0, 0, core, true);
  B(0.55, 0.14, 0.55, 0, 0, 0, dark, core, false, [0, Math.PI / 4, 0]);
  add(new THREE.IcosahedronGeometry(0.2, 0), hot, 0, 0, 0.3, core, true);
  for (const sx of [-1, 1]) B(0.5, 0.04, 0.22, sx * 0.5, 0, -0.1, dark, core, false, [0, 0, sx * 0.25]);
  c.muzzle.position.set(0, 0, 0.4);
  core.add(c.muzzle);
  c.hover = true;
  c.height = 1.5;
}

const THRALL_SCALE = 1.15;

export class Enemy {
  constructor(typeId, pos, o) {
    const def = ENEMY_TYPES[typeId];
    if (!def) throw new Error(`Unknown enemy type ${typeId}`);
    const M = G.mission;
    this.typeId = typeId;
    this.def = def;
    this.isBoss = typeId === 'boss';
    // unique boss model (Servitor, Wizard, Kell...); falls back to the faction model
    this.bossModel = this.isBoss ? (o.model ?? M.bossModel ?? null) : null;
    this.cls = def.base || typeId; // U14: the base class (grunt, rusher, captain, heavy, suicide, boss) a unit extends; cover, stagger, XP and close melee key on it
    const faction = o.faction || UNITS[typeId]?.faction || { earth: 'scrappers', moon: 'hollow', mars: 'legion', titan: 'hollow', tangled: 'scrappers', io: 'legion', dc: 'hollow', leviathan: 'legion' }[M.loc.id];
    this.name = o.name || unitName(typeId) || M.loc.enemyNames[this.cls];
    this.pos = pos.clone(); this.pos.y = groundAt(pos.x, pos.z);
    // U13b: minor or major (bosses have neither); a major shares its minor's abilities with more health and size
    this.tier = typeId === 'boss' ? null : (o.tier || 'minor');
    const T = TIERS[this.tier] || { hp: 1, dmg: 1, size: 1 };
    this.prof = NEW_PROFILES[faction] || FACTION_PROFILES[faction];
    // H3: Hive Thralls are a little bigger than other rushers
    this.scale = def.scale * T.size * (faction === 'hollow' && typeId === 'rusher' ? THRALL_SCALE : 1);
    this.radius = 0.45 * this.scale;
    this.fly = def.fly || 0; // floating units (Vex, Servitor, Shrieker) hang this high above the floor
    this.large = this.cls === 'heavy' || this.scale >= 1.3; // large units never hop onto ledges or crates; they walk the nav grid's ramps and steps
    this.height = 2.05 * this.scale;
    this.maxHp = def.hp * o.hpMult * T.hp; this.hp = this.maxHp;
    // shields are elemental and belong to certain units per faction (tiers.js SHIELD): Captains everywhere, Colossi for the Cabal
    const ownEls = unitShield(typeId); // U14 units name their own shield element and size
    const shieldEls = ownEls || shieldFor(faction, this.cls);
    const shieldBase = ownEls ? (def.shield || 0) : (def.shield || (this.cls === 'heavy' && shieldEls && !def.noShield ? SHIELD[faction].heavyHp : 0));
    this.maxShield = shieldBase ? shieldBase * o.hpMult * T.hp : 0; this.shield = this.maxShield;
    this.shieldEl = o.element || (shieldEls ? pick(shieldEls) : 'arc');
    this.dmgMult = o.dmgMult * T.dmg;
    this.zone = o.zone;
    this.alive = true; this.dieT = 0; this.spawnT = 0;
    this.status = new StatusSet(ENEMY_STATUS); // debuffs: weaken, slow, suppress, burn, poison, jolt
    this.fireT = rand(0.8, 2.0);
    this.burstLeft = 0; this.burstT = 0;
    this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = rand(1, 3);
    this.losT = Math.random() * 0.3; this.los = false;
    this.meleeT = 0.5; this.windup = 0; this.lunge = 0; this.lungeHit = false; this.lungeDir = new THREE.Vector3(); this.flash = 0; this.walk = Math.random() * 6; this.yaw = 0;
    this.knock = new THREE.Vector3();
    this.staggerT = 0; this.staggerMax = 0; this.staggerCd = 0; // flinch when hit hard (see combat.js STAGGER)
    this.seed = Math.random() * 100;
    this.specialT = rand(4, 6);
    this.thresholds = this.isBoss ? [0.66, 0.33] : [];
    // shooters hide behind cover between bursts
    this.usesCover = (this.cls === 'grunt' || this.cls === 'captain') && !def.static && !def.stationary && !def.support && Math.random() < this.prof.coverMul; // Hive seldom hide
    this.ai = { state: 'advance', t: rand(0.2, 1.2), cover: null, peek: null, exposeT: 0, noCoverT: 0, cycles: 0 };
    // U13a: navigation, close-range melee, suicide fuse
    this.path = null; this.pathIdx = 0; this.pathT = 0; this.pathGoal = { x: 0, z: 0 }; this.stuckT = 0; this.stuck = false; this.lastX = pos.x; this.lastZ = pos.z; this.chkT = 0.5;
    this.post = null; this.postT = rand(1, 3); this.postLoss = 0; this.heavyNear = false; this.heavyT = rand(0, 0.5);
    this.cmCd = rand(0.4, 1.2); this.cmWind = 0; this.cmSwing = 0; this.cmHit = false;
    this.fuse = -1; this.detonated = false; this.hop = null; this.stuckN = 0;
    this.faction = faction;
    // U13b: grenades, Cabal jetpacks, Ogre enrage, suicide escort, boss push and hold
    this.grenT = grenadeThrower(faction, typeId) ? rand(4, 9) : Infinity; this.throwT = 0;
    this.jet = this.prof.jet && JET.who.includes(this.cls) ? { s: 'ground', t: 0, cd: rand(4, 9), y: 0, y0: 0, sq: 0 } : null;
    this.enraged = false; this.rushing = false;
    this.escort = false; this.escortT = SUICIDE_BLAST.escortHold; this.allyT = 0;
    this.bossPhase = 'hold'; this.bossPhaseT = this.isBoss ? bossPhaseTime('hold', 0) : 0;
    this.noDrops = !!(def.noDrops || o.noDrops); this.revived = !!o.revived; this.owner = o.owner || null;
    this.shotColor = def.shotColor || FACTIONS[faction]?.shot || M.loc.colors.eye;
    this.model = buildModel(this, M.loc.colors, faction);
    this.height = this.model.height * this.scale;
    this.hitMeshes = this.model.hit;
    this.model.group.position.copy(this.pos);
    this.model.group.rotation.order = 'YXZ'; // pitch (stagger, death) tilts about the enemy's own right axis
    G.scene.add(this.model.group);
    ringFx(this.pos, 2 * this.scale, this.shotColor, 0.6);
    sparks(_v.copy(this.pos).setY(1), this.shotColor, 8, 5, 0.1, 0.5);
    skillInit(this, o);
  }

  center(out) { return out.set(this.pos.x, this.pos.y + this.fly + this.height * 0.5, this.pos.z); }
  headPos(out) { return out.set(this.pos.x, this.pos.y + this.fly + this.height * 0.95, this.pos.z); }

  /** Flinch: stop moving and attacking for t seconds; a cooldown follows so it can't chain. */
  stagger(t) {
    this.staggerT = this.staggerMax = t;
    this.staggerCd = t + STAGGER.cooldown;
    this.windup = 0; this.lunge = 0; this.cmWind = 0; this.cmSwing = 0;
    const torso = this.model.torso;
    if (torso?.userData.rx !== undefined) torso.rotation.x = torso.userData.rx;
  }

  /** `burst`: broken by its own element, so it explodes and hurts neighbours (Destiny 2). Only the leader applies the damage. */
  breakShield(matched, burst = false) {
    if (this.model.shield) this.model.shield.visible = false;
    sfx.shieldBreak(this.pos);
    const c = this.center(_v);
    sparks(c, ELEMENTS[this.shieldEl].hex, 16, 7, 0.1, 0.5);
    if (!burst) return;
    const hex = ELEMENTS[this.shieldEl].hex, at = c.clone();
    explosionFx(at, 2.5, hex);
    ringFx(this.pos, 5, hex, 0.5);
    sfx.explosion(3, at);
    if (this.remote) return;
    for (const o of G.enemies.slice()) {
      if (o === this || !o.alive || o.remote) continue;
      const d = o.center(new THREE.Vector3()).distanceTo(at);
      const dmg = shieldBurstDamage(this.maxShield, d);
      if (dmg > 0) dealDamage(o, dmg, { raw: true, source: 'burst', pos: o.headPos(new THREE.Vector3()), jolted: true });
    }
  }

  onDeath() {
    this.fallDir = Math.random() < 0.5 ? 1 : -1;
    skillOnDeath(this);
    if (this.def.suicide && !this.noBlast) this.detonate();
    if (this.model.shield) this.model.shield.visible = false;
    this.model.onDeath?.(); // boss models with a death reveal (Calus)
    sparks(this.center(_v), G.mission.loc.colors.eye, this.isBoss ? 40 : 10, this.isBoss ? 10 : 5, 0.1, 0.6);
  }

  remove() { G.scene.remove(this.model.group); this.model.bodyMat.dispose(); }

  update(dt) {
    const m = this.model;
    if (!this.alive) {
      this.dieT += dt;
      const k = Math.min(1, this.dieT * 2.2);
      m.group.rotation.x = -k * 1.4 * this.fallDir;
      m.group.position.y = this.pos.y - Math.max(0, this.dieT - 0.9) * 1.5;
      m.bodyMat.emissive.setRGB(0, 0, 0);
      m.deathStep?.(this.dieT);
      if (this.dieT > 1.8) { this.remove(); return false; }
      return true;
    }
    if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt * 2.2);
      m.group.scale.setScalar(this.scale * Math.max(0.05, easeOutBack(this.spawnT)));
      m.group.position.copy(this.pos);
      return true;
    }
    this.status.tick(dt);
    if (this.remote) { this.remoteStep(dt); return true; }
    if (!this.skillStep(dt)) return true;
    // target the nearest living fireteam member (just the local player when solo)
    this.tgtT = (this.tgtT ?? 0) - dt;
    if (this.tgtT <= 0 || !this.tgt || this.tgt.dead || this.tgt.status?.has('invisible') || this.tgt.inv) { this.tgtT = 0.5; this.tgt = pickTarget(this); }
    // nobody to target (everyone invisible or down): hold position
    const P = this.tgt || { pos: this.pos.clone().add(new THREE.Vector3(0, 0, 0.01)), eye: this.pos, vel: new THREE.Vector3(), dead: true };
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    const def = this.def;
    this.enrageStep();
    this.escortStep(dt);
    this.jetStep(dt, P, dist);

    this.flash = Math.max(0, this.flash - dt);
    const f = Math.min(1, this.flash * 8);
    if (this.enraged) m.bodyMat.emissive.setRGB(Math.max(f, 0.4 + 0.15 * Math.sin(G.time * 11)), Math.max(f, 0.04), Math.max(f, 0.02));
    else m.bodyMat.emissive.setRGB(f, f, f);
    if (m.shield) {
      m.shield.visible = this.shield > 0;
      if (m.shield.visible) { m.shield.material.opacity = 0.14 + 0.08 * Math.sin(G.time * 6 + this.seed); m.shield.rotation.y += dt; }
    }

    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.3 + Math.random() * 0.2;
      this.headPos(_v);
      this.los = !P.dead && hasLOS(_v, P.eye);
    }

    // ---- movement ----
    // enemies with a 3:1 numbers advantage push and shoot instead of hiding
    const M = G.mission;
    const pushing = (M.aggro ?? 0) >= 3;
    this.ai.noCoverT = Math.max(0, this.ai.noCoverT - dt);
    this.cmCd = Math.max(0, this.cmCd - dt);
    this.heavyT -= dt;
    if (this.heavyT <= 0) {
      this.heavyT = 0.5;
      this.heavyNear = false;
      for (const o of this.zone?.enemies || []) {
        if (o === this || !o.alive || !(o.cls === 'heavy' || o.isBoss)) continue;
        if (Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) < COVER.heavyNear) { this.heavyNear = true; break; }
      }
    }
    const coverOn = coverAllowed({ usesCover: this.usesCover, aggro: M.aggro ?? 0, heavyNear: this.heavyNear, flushed: this.ai.noCoverT > 0 });
    // leash: a unit heads for its target, or for the edge of its zone when the target is out of reach
    const lt = this.zone?.center ? leashTarget(this.zone, P.pos.x, P.pos.z) : { x: P.pos.x, z: P.pos.z, held: false };
    this.held = lt.held;
    const rooted = this.cmWind > 0 || this.cmSwing > 0;
    let mx = 0, mz = 0;
    if (!P.dead && !def.static && !def.stationary) {
      if (this.jet && this.jet.s !== 'ground') {
        // airborne Centurion: the jet state machine owns height and leaps; while hovering it drifts and holds range
        if (this.jet.s === 'hover') {
          this.strafeT -= dt;
          if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = rand(1.5, 3); }
          mx = -nz * this.strafe * 0.6; mz = nx * this.strafe * 0.6;
          if (dist < def.prefer - 4) { mx -= nx * 0.6; mz -= nz * 0.6; } else if (dist > def.prefer + 6) { mx += nx * 0.7; mz += nz * 0.7; }
        }
      } else if (this.rushing) {
        // enraged Ogre: rush the target and hit it
        if (!rooted && dist > closeMeleeReach(this.cls, this.radius) * 0.8) { const sd = this.steer(lt.x, lt.z, dt); mx = sd.x; mz = sd.z; }
      } else if (def.melee || def.suicide) {
        if (this.windup > 0 || this.lunge > 0) { /* rooted while winding up; lunge moves below */ }
        else if (this.escort && dist < SUICIDE_BLAST.escortDist) {
          // a Cursed Thrall with company keeps its distance and weaves until it is alone (or the escort timer ends)
          mx = -nz * this.strafe * 0.7; mz = nx * this.strafe * 0.7;
          this.strafeT -= dt;
          if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = rand(0.8, 1.6); }
        } else if (dist > 1.5 || lt.held) {
          const sd = this.steer(lt.x, lt.z, dt);
          const zig = (this.escort || !(def.suicide && this.prof.rushAlone) ? Math.sin(G.time * 3 + this.seed) : 0) * (dist > 6 ? 0.6 : 0);
          mx = sd.x - sd.z * zig; mz = sd.z + sd.x * zig;
        }
      } else if (rooted) {
        /* swinging at someone in reach */
      } else if (this.usesCover && this.ai.state !== 'advance' && coverOn) {
        const m = this.coverMove(dt);
        mx = m.x; mz = m.z;
      } else {
        if (this.usesCover && this.ai.state !== 'advance') this.ai.state = 'advance'; // pushed out of cover (numbers, a heavy nearby, or flushed)
        // pushing: close in to ~60% of preferred range and keep shooting
        const bossPush = this.isBoss && this.bossPhase === 'push';
        const want = bossPush ? 5 : this.isBoss ? def.prefer + 4 : pushing ? def.prefer * 0.6 : def.prefer;
        const reach = def.closeMelee ? closeMeleeReach(this.cls, this.radius) : 0;
        this.updatePost(dt, P, dist, want);
        if (this.post) {
          // hop up from the floor next to the ledge, then hold it
          const up = this.post.from && Math.abs(this.pos.y - this.post.h) > 0.3;
          const goal = up ? this.post.from : this.post;
          const sd = this.steer(goal.x, goal.z, dt);
          mx = sd.x; mz = sd.z;
          if (up && !this.hop && Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z) < 0.9) this.hop = { t: 0, dur: 0.5, x0: this.pos.x, z0: this.pos.z, y0: this.pos.y, x1: this.post.x, z1: this.post.z, y1: this.post.h };
        } else if (dist > want + 4 || (!this.los && dist > 6) || lt.held) {
          const sd = this.steer(lt.x, lt.z, dt);
          mx = sd.x; mz = sd.z;
        } else if (dist < want - 6 && !(reach && dist < reach + 1.5 && this.cmCd <= 0)) { mx = -nx; mz = -nz; }
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = rand(2, 4); }
        const sf = (pushing ? 0.25 : 0.35) * this.prof.strafe;
        if (!this.post) { mx += -nz * this.strafe * sf; mz += nx * this.strafe * sf; }
        if (this.usesCover && coverOn) {
          this.ai.t -= dt;
          if (this.ai.t <= 0) { this.ai.t = 1.2; const c = findCover(this); if (c) { this.ai.cover = c; this.ai.state = 'toCover'; this.ai.t = 4; this.post = null; } }
        }
      }
    }
    this.staggerT = Math.max(0, this.staggerT - dt);
    this.staggerCd = Math.max(0, this.staggerCd - dt);
    const staggered = this.staggerT > 0;
    if (staggered) { mx = 0; mz = 0; }
    const ml = Math.hypot(mx, mz);
    const suppressed = this.status.has('suppress') || this.status.has('blind'); // blinded enemies cannot attack either
    if (suppressed && Math.random() < 0.2) sparks(this.headPos(_v), 0x7a4ab0, 1, 1.5, 0.06, 0.3);
    if (this.status.has('weaken') && Math.random() < 0.15) sparks(this.center(_v), 0x7a4ab0, 1, 1, 0.08, 0.4);
    if (this.status.has('jolt') && Math.random() < 0.2) sparks(this.center(_v), 0x5fd3ff, 1, 2, 0.05, 0.25);
    if (suppressed && this.usesCover && this.ai.state !== 'advance') this.flush(); // suppression drives a hidden unit out of cover
    const modeMul = this.enraged ? ENRAGE.speed
      : this.isBoss && this.bossPhase === 'push' ? BOSS_PHASE.pushSpeed
      : def.suicide && this.prof.rushAlone ? (this.escort ? SUICIDE_BLAST.escortMul : SUICIDE_BLAST.rushMul)
      : this.jet?.s === 'hover' ? 0.6 : 1;
    const speed = def.speed * modeMul * (this.burstLeft > 0 && !this.isBoss && !this.rushing ? 0.4 : 1) * (this.status.has('slow') ? SLOW_MULT : 1) * (this.fuse > 0 ? 0.5 : 1);
    if (ml > 0) { mx /= ml; mz /= ml; }
    this.pos.x += (mx * speed + this.knock.x) * dt;
    this.pos.z += (mz * speed + this.knock.z) * dt;
    if (this.lunge > 0) this.pos.addScaledVector(this.lungeDir, 11 * dt);
    this.knock.multiplyScalar(Math.exp(-6 * dt));
    for (const o of G.enemies) {
      if (o === this || !o.alive) continue;
      const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z;
      const rr = this.radius + o.radius;
      const d2 = ox * ox + oz * oz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (rr - d) * 0.5;
        this.pos.x += (ox / d) * push; this.pos.z += (oz / d) * push;
      }
    }
    // climb onto a step or ledge cell that is a legal step up; drop back down to the floor beneath
    let hopping = false;
    if (this.hop) {
      const h = this.hop;
      h.t += dt / h.dur;
      const k = Math.min(1, h.t);
      this.pos.x = h.x0 + (h.x1 - h.x0) * k; this.pos.z = h.z0 + (h.z1 - h.z0) * k;
      this.pos.y = h.y0 + (h.y1 - h.y0) * k + Math.sin(Math.PI * k) * 0.6;
      if (k >= 1) { this.pos.y = h.y1; this.hop = null; } else hopping = true;
    }
    if (this.jet && this.jet.s !== 'ground') { this.pos.y = this.jet.y; hopping = true; } // jet flight owns height
    const nav = G.nav;
    if (nav && !hopping) {
      const hh = heightAt(nav, this.pos.x, this.pos.z);
      if (hh >= 0) {
        if (hh > this.pos.y) { if (hh - this.pos.y <= NAV.step + 0.05) this.pos.y = hh; }
        else this.pos.y = Math.max(hh, this.pos.y - 14 * dt);
      }
      if (G.level.groundAt) this.pos.y = Math.max(this.pos.y, groundAt(this.pos.x, this.pos.z)); // never under the terrain (knockback, a step too steep for the grid)
    }
    if (!hopping || this.jet?.s === 'hover') pushOutCircle(this.pos, this.radius, this.height);
    const b = G.level.bounds;
    this.pos.x = clamp(this.pos.x, b.minX + 1, b.maxX - 1);
    this.pos.z = clamp(this.pos.z, b.minZ + 1, b.maxZ - 1);
    // never past the zone leash, even when knocked back
    if (this.zone?.center && pastLeash(this.zone, this.pos.x, this.pos.z)) {
      const q = insideLeash(this.zone, this.pos.x, this.pos.z);
      this.pos.x = q.x; this.pos.z = q.z;
    }
    // stuck detector: wanting to move but barely moving for a second forces a fresh path and a sidestep
    this.chkT -= dt;
    if (this.chkT <= 0) {
      const moved = Math.hypot(this.pos.x - this.lastX, this.pos.z - this.lastZ);
      this.chkT = 0.5; this.lastX = this.pos.x; this.lastZ = this.pos.z;
      if (ml > 0 && !this.held && this.fuse < 0 && moved < speed * 0.5 * 0.25) {
        this.stuckT += 0.5;
        if (this.stuckT >= 1) { this.stuckT = 0; this.stuck = true; this.stuckN++; G.navLog?.push({ t: this.typeId, x: +this.pos.x.toFixed(1), z: +this.pos.z.toFixed(1), y: +this.pos.y.toFixed(1), st: this.ai.state, goal: this.path ? 'path' : 'direct', held: this.held, post: !!this.post }); this.strafe *= -1; this.knock.x += -mz * 3; this.knock.z += mx * 3; }
      } else this.stuckT = 0;
    }

    const targetYaw = Math.atan2(dx, dz);
    let dy = targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 8);

    this.walk += dt * speed * (ml > 0 ? 2.2 : 0);
    const sw = Math.sin(this.walk) * (ml > 0 ? 0.6 : 0);
    m.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? -sw : sw) * (i >= 2 ? -1 : 1); });
    if (this.jet) this.jetPose(this.jet.s, dt);

    // ---- attacks ---- (suppressed enemies cannot attack)
    if (!P.dead && !suppressed && !staggered && !def.static) {
      if (def.suicide) {
        this.suicideStep(dt, dist, P);
      } else if (def.melee) {
        // wind up, then lunge ~3m; the hit lands if the player is in reach during the lunge
        this.meleeT -= dt;
        const vdy = Math.abs(P.pos.y - this.pos.y);
        const reach = 1.25 + this.radius;
        if (this.windup > 0) {
          this.windup -= dt;
          m.torso.rotation.x = (m.torso.userData.rx ?? (m.torso.userData.rx = m.torso.rotation.x)) - 0.35;
          m.arms.forEach((a) => (a.rotation.x = -2.4));
          if (this.windup <= 0) {
            this.lunge = 0.26; this.lungeHit = false;
            this.lungeDir.set(nx, 0, nz);
          }
        } else if (this.lunge > 0) {
          this.lunge -= dt;
          m.torso.rotation.x = (m.torso.userData.rx ?? 0) + 0.3;
          if (!this.lungeHit && dist < reach && vdy < 2.2) {
            this.lungeHit = true;
            m.arms.forEach((a) => (a.rotation.x = -0.6));
            sfx.melee();
            if (P.remote) damageRemote(P, def.meleeDmg * this.dmgMult, this.pos);
            else {
              damagePlayer(def.meleeDmg * this.dmgMult, this.pos, 'melee');
              P.shake = Math.max(P.shake, 0.2);
              P.vel.x += this.lungeDir.x * 5; P.vel.z += this.lungeDir.z * 5;
            }
          }
          if (this.lunge <= 0 && m.torso.userData.rx !== undefined) m.torso.rotation.x = m.torso.userData.rx;
        } else if (dist < 3.4 && vdy < 2.2 && this.meleeT <= 0 && this.los) {
          this.windup = 0.22; this.meleeT = 1.2;
          sfx.enemyShot(this.pos, this.faction);
        }
        if (this.windup <= 0 && this.lunge <= 0) m.arms.forEach((a) => (a.rotation.x += (-1.3 - a.rotation.x) * Math.min(1, dt * 6)));
      } else if (this.rushing) {
        this.burstLeft = 0;
        this.closeMeleeStep(dt, dist, P); // an enraged Ogre only fights in melee
      } else {
        const swinging = def.closeMelee ? this.closeMeleeStep(dt, dist, P) : false;
        if (swinging) this.burstLeft = 0;
        else this.grenadeStep(dt, dist, P);
        this.fireT -= dt;
        const jetBusy = this.jet && this.jet.s !== 'ground' && this.jet.s !== 'hover';
        const mayFire = !swinging && !jetBusy && this.throwT <= 0 && (!this.usesCover || this.ai.state === 'peek' || this.ai.state === 'advance');
        if (mayFire && this.fireT <= 0 && this.los && dist < def.range) {
          const mad = def.berserk && this.hp < this.maxHp * def.berserk.below; // a Cyclops pushed into its berserk rage fires far faster
          this.burstLeft = Math.max(1, Math.round(def.burst * this.prof.burstMul)); this.burstT = 0;
          this.fireT = rand(def.fireCd[0], def.fireCd[1]) * (mad ? def.berserk.cdMul : 1) + def.burst * def.burstGap;
        }
        if (this.burstLeft > 0) {
          this.burstT -= dt;
          if (this.burstT <= 0) {
            this.shoot(dist); this.burstLeft--; this.burstT = def.burstGap;
            // burst done while peeking: duck back behind cover
            if (this.burstLeft === 0 && this.usesCover && this.ai.state === 'peek') {
              // two bursts per peek, then duck back
              this.ai.bursts = (this.ai.bursts || 0) + 1;
              if (this.ai.bursts >= COVER.bursts) {
                this.ai.state = 'toCover'; this.ai.t = 3;
                // cover to cover: every second peek the unit relocates to a different piece of cover
                if (++this.ai.cycles % 2 === 0) { const c = findCover(this, this.ai.cover); if (c) { this.ai.cover = c; this.ai.t = 4; } }
              }
              else this.fireT = Math.min(this.fireT, 0.5);
            }
          }
        }
      }
      if (this.isBoss) this.bossUpdate(dt, dist);
    }

    m.group.position.copy(this.pos);
    if (m.hover) m.group.position.y += 0.35 + 0.25 * Math.sin(G.time * 1.8 + this.seed);
    m.group.position.y += this.fly;
    if (m.spin && this.def.spinGuard) m.spin.rotation.y = spinAngle(this);
    m.group.rotation.y = this.yaw;
    // stagger: a quick backward jolt that settles
    m.group.rotation.x = staggered ? -0.28 * Math.sin(Math.PI * (1 - this.staggerT / this.staggerMax)) : 0;
    return true;
  }


  /** Skills (enemy-skills.js): returns false while a blink tell or a summon holds the unit still. */
  skillStep(dt) {
    const P = this.tgt;
    const dist = P ? Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) : 99;
    return skillUpdate(this, dt, P, dist);
  }

  /** Hive Ogre below 30% health goes into a rage: it stops shooting, runs at its target and hits harder and faster. */
  enrageStep() {
    if (this.enraged) return;
    const low = this.def.enrage ? this.hp > 0 && this.hp / this.maxHp < ENRAGE.below : isEnraged(this.hp, this.maxHp, this.faction, this.cls); // U14: the Taken Ogre and Scorn Abomination enrage too
    if (!low) return;
    this.enraged = true; this.rushing = true;
    this.ai.state = 'advance'; this.post = null; this.burstLeft = 0; this.cmCd = 0.3; this.throwT = 0;
    ringFx(this.pos, 4 * this.scale, 0xff3a1a, 0.7);
    sparks(this.center(_v), 0xff3a1a, 24, 8, 0.12, 0.6);
    sfx.alert();
  }

  /** A Cursed Thrall with other Hive around it keeps pace and weaves; alone, or after the escort timer, it rushes. */
  escortStep(dt) {
    if (!this.def.suicide || !this.prof.rushAlone) return;
    this.allyT -= dt;
    if (this.allyT <= 0) {
      this.allyT = 0.5;
      let allies = 0;
      for (const o of this.zone?.enemies || []) {
        if (o === this || !o.alive || o.def.suicide) continue;
        if (Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) < SUICIDE_BLAST.ally) allies++;
      }
      this.escort = allies > 0 && this.escortT > 0;
    }
    if (this.escort) this.escortT -= dt;
  }

  // ---- Cabal jetpacks (U13b) ----
  // ground -> crouch -> rise -> hover (5 to 10 s, shooting) -> land -> ground, or a rocket leap across ground it cannot walk.
  jetStep(dt, P, dist) {
    const j = this.jet;
    if (!j) return;
    j.t -= dt;
    const gy = () => { const h = G.nav ? heightAt(G.nav, this.pos.x, this.pos.z) : -1; return h >= 0 ? h : j.y0; };
    if (j.s === 'ground') {
      j.y = this.pos.y; j.cd -= dt;
      if (j.cd > 0 || P.dead || this.staggerT > 0 || this.cmWind > 0 || this.cmSwing > 0 || this.hop || this.throwT > 0 || this.status.has('suppress')) return;
      const blocked = this.stuck || (!this.los && dist > JET.leapMin + 3);
      if (blocked && dist > JET.leapMin && this.startLeap(P, dist)) return;
      if (this.los && dist > 10 && dist < this.def.range - 4 && Math.random() < JET.hoverChance) {
        j.s = 'crouch'; j.t = JET.crouch; j.y0 = this.pos.y;
        this.ai.state = 'advance'; this.post = null; this.burstLeft = 0;
      } else j.cd = rand(2, 4);
      return;
    }
    if (j.s === 'crouch') { if (j.t <= 0) { j.s = 'rise'; j.t = JET.rise; sfx.alert(); sparks(_v.copy(this.pos).setY(this.pos.y + 0.2), 0xffa030, 14, 6, 0.1, 0.5); } return; }
    if (j.s === 'rise') {
      const k = Math.min(1, 1 - j.t / JET.rise), e = 1 - (1 - k) * (1 - k);
      j.y = j.y0 + JET.hoverH * e;
      if (j.t <= 0) { j.s = 'hover'; j.t = rand(JET.hover[0], JET.hover[1]); }
      return;
    }
    if (j.s === 'hover') {
      j.y = j.y0 + JET.hoverH + 0.25 * Math.sin(G.time * 2.2 + this.seed);
      if (j.t <= 0 || P.dead || this.status.has('suppress')) { j.s = 'land'; j.t = JET.land; j.yFrom = j.y; j.yTo = gy(); }
      return;
    }
    if (j.s === 'land') {
      const k = Math.min(1, 1 - j.t / JET.land);
      j.y = j.yFrom + (j.yTo - j.yFrom) * k * k;
      if (j.t <= 0) {
        j.s = 'ground'; j.y = j.yTo; this.pos.y = j.yTo; j.cd = rand(JET.cd[0], JET.cd[1]); j.sq = 1;
        ringFx(this.pos, 3, 0xffa030, 0.4); sparks(_v.copy(this.pos).setY(this.pos.y + 0.1), 0xffa030, 16, 6, 0.1, 0.5); sfx.explosion(2, this.pos);
      }
      return;
    }
    if (j.s === 'leap') {
      const k = Math.min(1, 1 - j.t / JET.leapTime);
      this.pos.x = j.x0 + (j.x1 - j.x0) * k; this.pos.z = j.z0 + (j.z1 - j.z0) * k;
      j.y = j.y0 + (j.y1 - j.y0) * k + 4 * JET.leapArc * k * (1 - k);
      if (j.t <= 0) { j.s = 'land'; j.t = 0.3; j.yFrom = j.y1; j.yTo = j.y1; this.path = null; this.pathT = 0; }
    }
  }

  /** Rocket leap: jump toward the target over ground it can't walk. Returns false when there is no safe landing. */
  startLeap(P, dist) {
    const j = this.jet, nav = G.nav;
    const d = clamp(dist * 0.6, JET.leapMin, JET.leapMax);
    const nx = (P.pos.x - this.pos.x) / (dist || 1), nz = (P.pos.z - this.pos.z) / (dist || 1);
    let tx = this.pos.x + nx * d, tz = this.pos.z + nz * d;
    if (this.zone?.center) { const q = insideLeash(this.zone, tx, tz); tx = q.x; tz = q.z; }
    let ty = 0;
    if (nav) {
      const w = nearestWalkable(nav, tx, tz, 3);
      if (!w) { j.cd = rand(3, 5); return false; }
      tx = w.x; tz = w.z; ty = nav.hgt[w.idx];
    }
    if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < JET.leapMin * 0.6) { j.cd = rand(3, 5); return false; }
    j.s = 'leap'; j.t = JET.leapTime; j.x0 = this.pos.x; j.z0 = this.pos.z; j.y0 = this.pos.y; j.x1 = tx; j.z1 = tz; j.y1 = ty;
    this.ai.state = 'advance'; this.post = null; this.burstLeft = 0; this.path = null;
    sfx.alert(); sparks(_v.copy(this.pos).setY(this.pos.y + 0.2), 0xffa030, 14, 6, 0.1, 0.5);
    return true;
  }

  /** Thruster flames, tucked legs, a crouch and a landing squash. Works for the leader's unit and for members' copies (state by name). */
  jetPose(state, dt) {
    const m = this.model, j = this.jet;
    const up = state === 'rise' || state === 'hover' || state === 'leap' || state === 'airborne';
    const burn = state === 'rise' ? 1.7 : state === 'leap' ? 1.9 : state === 'hover' || state === 'airborne' ? 1 : state === 'land' ? 0.8 : 0;
    if (m.flames) for (const fl of m.flames) {
      fl.visible = burn > 0;
      if (burn > 0) fl.scale.set(1, burn * (0.85 + 0.3 * Math.sin(G.time * 40 + this.seed)), 1);
    }
    if (burn > 0 && Math.random() < 0.5) sparks(_v.copy(this.pos).setY(this.pos.y + 0.8), 0xffa030, 1, 2, 0.06, 0.3);
    if (up) m.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? 0.55 : 0.35) + 0.08 * Math.sin(G.time * 3 + i); });
    if (state === 'crouch') m.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? -0.9 : 0.9) * 0.5; });
    if (up && state !== 'hover' && state !== 'airborne') m.arms.forEach((a) => { a.userData.rx0 ??= a.rotation.x; a.rotation.x += (0.5 - a.rotation.x) * Math.min(1, dt * 10); });
    if (m.torso) {
      m.torso.userData.rx ??= m.torso.rotation.x;
      if (state === 'leap') m.torso.rotation.x = m.torso.userData.rx + 0.45;
      else if (state === 'crouch') m.torso.rotation.x = m.torso.userData.rx + 0.3;
      else if (state === 'ground' && !(this.cmWind > 0 || this.cmSwing > 0 || this.windup > 0 || this.lunge > 0)) m.torso.rotation.x = m.torso.userData.rx;
    }
    // squash on take-off and landing
    let sq = 0;
    if (state === 'crouch') sq = 1;
    else if (j && j.sq > 0) { j.sq = Math.max(0, j.sq - dt * 4); sq = j.sq; }
    const sy = this.scale * (1 - 0.14 * sq), sxz = this.scale * (1 + 0.06 * sq);
    if (m.group.scale.y !== sy) m.group.scale.set(sxz, sy, sxz);
  }

  // ---- grenades (U13b) ----
  grenadeStep(dt, dist, P) {
    if (this.grenT === Infinity) return;
    if (this.throwT > 0) {
      this.throwT -= dt;
      const a = this.model.arms[0];
      if (a) { a.userData.rx0 ??= a.rotation.x; a.rotation.x = -2.7 + (this.throwT < 0.15 ? 1.6 * (1 - this.throwT / 0.15) : 0); }
      if (this.throwT <= 0) this.throwGrenade(P);
      return;
    }
    this.grenT -= dt;
    if (this.grenT > 0 || !this.los || P.dead || dist < GRENADE.minRange || dist > GRENADE.maxRange) return;
    if (this.usesCover && this.ai.state !== 'advance' && this.ai.state !== 'peek') return;
    this.throwT = 0.5; this.burstLeft = 0;
    this.grenT = rand(GRENADE.cd[0], GRENADE.cd[1]);
    sfx.alert();
  }

  throwGrenade(P) {
    const from = this.model.muzzle.getWorldPosition(new THREE.Vector3());
    from.y += 0.3;
    const lead = 0.4;
    const L = lobVelocity(P.pos.x + (P.vel?.x ?? 0) * lead - from.x, P.pos.y + 0.4 - from.y, P.pos.z + (P.vel?.z ?? 0) * lead - from.z);
    const vel = new THREE.Vector3(L.vx, L.vy, L.vz);
    spawnEnemyGrenade(from, vel, GRENADE.dmg * this.dmgMult, GRENADE[this.faction].color);
  }

  /** Leave cover and don't look for more for a while: splash, suppression and flanking all drive a unit out. */
  flush() {
    const A = this.ai;
    if (!this.usesCover) return;
    A.state = 'advance'; A.t = COVER.flushedFor; A.noCoverT = COVER.flushedFor;
  }

  /**
   * Direction (unit vector, or zero on arrival) toward (tx, tz). Straight when the way is clear on the
   * nav grid; otherwise follows an A* path, repathed when the goal moves, on a timer, or when stuck, and
   * only while this frame's path budget (G.navBudget) lasts. With no nav or no budget it falls back to straight.
   */
  steer(tx, tz, dt) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.6) return { x: 0, z: 0 };
    const nav = G.nav;
    if (!nav || lineClear(nav, this.pos.x, this.pos.z, tx, tz)) { this.path = null; this.stuck = false; return { x: dx / d, z: dz / d }; }
    this.pathT -= dt;
    const goalMoved = Math.hypot(tx - this.pathGoal.x, tz - this.pathGoal.z);
    if ((!this.path || goalMoved > 3 || this.pathT <= 0 || this.stuck) && (G.navBudget ?? 0) > 0) {
      G.navBudget--;
      this.pathT = 1 + Math.random() * 0.5; this.stuck = false;
      const r = findPath(nav, this.pos.x, this.pos.z, tx, tz);
      this.path = r ? r.pts : null; this.pathIdx = 0; this.pathGoal = { x: tx, z: tz };
    }
    if (this.path) {
      while (this.pathIdx < this.path.length && Math.hypot(this.path[this.pathIdx].x - this.pos.x, this.path[this.pathIdx].z - this.pos.z) < 0.7) this.pathIdx++;
      if (this.pathIdx < this.path.length) {
        const w = this.path[this.pathIdx], wx = w.x - this.pos.x, wz = w.z - this.pos.z, wd = Math.hypot(wx, wz) || 1;
        return { x: wx / wd, z: wz / wd };
      }
      this.path = null;
    }
    return { x: dx / d, z: dz / d };
  }

  /** Ranged units pick a reachable ledge or high ground with a view of the target and hold it for a while. */
  updatePost(dt, P, dist, want) {
    const nav = G.nav, Z = this.zone;
    if (!nav || !Z?.center || this.isBoss || this.large) { this.post = null; return; }
    if (this.post) {
      this.postT -= dt;
      this.postLoss = this.los ? 0 : this.postLoss + dt;
      if (this.postT <= 0 || this.postLoss > 3 || dist > this.def.range * 0.95 || pastLeash(Z, this.post.x, this.post.z, 0)) { this.post = null; this.postT = rand(3, 5); }
      return;
    }
    this.postT -= dt;
    if (this.postT > 0 || dist < 6) return;
    this.postT = rand(3, 5);
    if (!Z.reach) { Z.reach = floodReach(nav, Z.center.x, Z.center.z); Z.ledges = ledgeSpots(nav, Z.reach, Z.center.x, Z.center.z, 40); }
    if (!Z.ledges.length) return;
    const R = this.def.range * 0.85;
    const cand = [];
    for (const l of Z.ledges) {
      const du = Math.hypot(l.x - this.pos.x, l.z - this.pos.z);
      if (du > 16) continue;
      const dp = Math.hypot(l.x - P.pos.x, l.z - P.pos.z);
      if (dp < 8 || dp > R) continue;
      if (this.held && pastLeash(Z, l.x, l.z, 0)) continue;
      cand.push({ l, score: du * 0.3 - l.h * 2 + Math.abs(dp - want) * 0.15 + Math.random() * 2 });
    }
    cand.sort((a, b) => a.score - b.score);
    for (const c of cand.slice(0, 3)) {
      if (hasLOS(_v.set(c.l.x, c.l.h + 1.7, c.l.z), P.eye)) { this.post = c.l; this.postT = rand(6, 10); this.postLoss = 0; return; }
    }
  }

  /** Close-range melee for units that shoot (V21): wind up, swing, hit. Returns true while busy so the unit doesn't fire. */
  closeMeleeStep(dt, dist, P) {
    const cm = CLOSE_MELEE[this.cls];
    if (!cm) return false;
    const m = this.model, torso = m.torso;
    const rest = (a) => (a.userData.rx0 ??= a.rotation.x);
    const vdy = Math.abs(P.pos.y - this.pos.y), reach = closeMeleeReach(this.cls, this.radius);
    if (this.cmWind > 0) {
      this.cmWind -= dt;
      m.arms.forEach((a) => { rest(a); a.rotation.x += (-2.4 - a.rotation.x) * Math.min(1, dt * 18); });
      if (torso) torso.rotation.x = (torso.userData.rx ??= torso.rotation.x) - 0.3;
      if (this.cmWind <= 0) { this.cmSwing = CLOSE_MELEE.swing; this.cmHit = false; }
      return true;
    }
    if (this.cmSwing > 0) {
      this.cmSwing -= dt;
      m.arms.forEach((a) => { rest(a); a.rotation.x += (-0.2 - a.rotation.x) * Math.min(1, dt * 24); });
      if (torso) torso.rotation.x = (torso.userData.rx ??= torso.rotation.x) + 0.3;
      if (!this.cmHit && dist < reach + 0.6 && vdy < 2.2) {
        this.cmHit = true;
        sfx.melee();
        const dmg = cm.dmg * this.dmgMult * (this.enraged ? ENRAGE.meleeMul : 1);
        if (P.remote) damageRemote(P, dmg, this.pos);
        else {
          damagePlayer(dmg, this.pos, 'melee');
          P.shake = Math.max(P.shake, 0.25);
          const d = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) || 1;
          P.vel.x += (P.pos.x - this.pos.x) / d * 5; P.vel.z += (P.pos.z - this.pos.z) / d * 5;
        }
      }
      if (this.cmSwing <= 0 && torso?.userData.rx !== undefined) torso.rotation.x = torso.userData.rx;
      return this.cmSwing > 0;
    }
    // idle: arms ease back to their rest pose
    m.arms.forEach((a) => { if (a.userData.rx0 !== undefined) a.rotation.x += (a.userData.rx0 - a.rotation.x) * Math.min(1, dt * 8); });
    if (dist < reach && vdy < 2.2 && this.cmCd <= 0 && this.los) {
      this.cmWind = CLOSE_MELEE.windup; this.cmCd = this.enraged ? ENRAGE.cd : CLOSE_MELEE.cooldown;
      sfx.enemyShot(this.pos, this.faction);
      return true;
    }
    return false;
  }

  /** Suicide units (V22): run at the target, light a short fuse when close, blow up. */
  suicideStep(dt, dist, P) {
    const vdy = Math.abs(P.pos.y - this.pos.y);
    if (this.fuse < 0 && dist < SUICIDE.trigger && vdy < 2.5) {
      this.fuse = SUICIDE.fuse;
      ringFx(this.pos, SUICIDE.radius, 0xff5a1a, SUICIDE.fuse);
      sfx.alert();
    }
    if (this.fuse > 0) {
      this.fuse -= dt;
      this.flash = Math.sin(G.time * 45) > 0 ? 0.12 : 0;
      if (this.fuse <= 0) this.detonate();
    }
  }

  /** The blast: hurts every Guardian in range (not other enemies), then the unit is gone. */
  detonate() {
    if (this.detonated || this.remote) return; // fireteam members see the leader's boom as an effect message
    this.detonated = true;
    const c = this.center(new THREE.Vector3()), col = 0xff7a2a;
    explosionFx(c, SUICIDE.radius * 0.6, col);
    flashLight(c, col, 40, SUICIDE.radius * 3, 0.2);
    sfx.explosion(SUICIDE.radius, c);
    sendFx({ t: 'fx', k: 'boom', p: [Math.round(c.x * 100) / 100, Math.round(c.y * 100) / 100, Math.round(c.z * 100) / 100], r: SUICIDE.radius * 0.6, c: col, s: 0 });
    for (const Pl of allPlayers()) {
      if (Pl.dead) continue;
      const d = Math.hypot(Pl.pos.x - c.x, Pl.pos.y + 1 - c.y, Pl.pos.z - c.z);
      // dangerous: most of a Guardian's health and shield at the core, never a clean one-shot (tiers.js suicideCore)
      const total = (Pl.maxHealth ?? G.player.maxHealth) + (Pl.maxShield ?? G.player.maxShield ?? 0);
      const intake = Math.max(1, (G.mission.incomingMult ?? 1) * (Pl.splashMult ?? 1)); // damagePlayer scales by this afterwards; divide it out so the cap holds
      const dmg = blastDamage(suicideCore(total, this.dmgMult), d) / intake;
      if (dmg <= 0) continue;
      if (Pl.remote) { damageRemote(Pl, dmg, this.pos); continue; }
      damagePlayer(dmg, this.pos, 'splash');
      const k = Math.hypot(Pl.pos.x - c.x, Pl.pos.z - c.z) || 1;
      Pl.vel.x += (Pl.pos.x - c.x) / k * 6; Pl.vel.z += (Pl.pos.z - c.z) / k * 6; Pl.vel.y = Math.max(Pl.vel.y, 3);
      Pl.shake = Math.max(Pl.shake, 0.5);
    }
    if (this.alive) killEnemy(this, { self: true });
  }

  /** Cover state machine: toCover -> hide -> peek (shoot one burst) -> toCover ... */
  /** Fireteam member's copy of a leader-owned enemy: just follow the network state. */
  remoteStep(dt) {
    const m = this.model;
    const k = Math.min(1, dt * 10);
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += (this.netPos.x - this.pos.x) * k;
    this.pos.z += (this.netPos.z - this.pos.z) * k;
    this.pos.y += (this.netPos.y - this.pos.y) * k; // ledges and steps
    // the leader's close-range swing and suicide fuse, shown as a raised-arm pose and a blinking flash
    const fl = this.netFl ?? 0;
    m.arms.forEach((a) => { a.userData.rx0 ??= a.rotation.x; a.rotation.x += (((fl & 1) ? -1.6 : a.userData.rx0) - a.rotation.x) * k; });
    if (fl & 2) this.flash = Math.sin(G.time * 45) > 0 ? 0.12 : 0;
    if ((fl & 4) && !this.enraged) { this.enraged = true; ringFx(this.pos, 4 * this.scale, 0xff3a1a, 0.7); sfx.alert(); }
    if (this.jet) this.jetPose(fl & 8 ? 'airborne' : 'ground', dt);
    let dy = this.netYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * k;
    const sp = Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-3);
    this.walk += dt * sp * 2.2;
    const ph = Math.floor(this.walk / Math.PI); // heavy units thud on each footfall
    if (sp > 0.3 && this.scale >= 1.35 && ph !== this.stepPh) sfx.step(this.pos);
    this.stepPh = ph;
    const sw = Math.sin(this.walk) * (sp > 0.3 ? 0.6 : 0);
    m.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? -sw : sw) * (i >= 2 ? -1 : 1); });
    this.flash = Math.max(0, this.flash - dt);
    const f = Math.min(1, this.flash * 8);
    if (this.enraged) m.bodyMat.emissive.setRGB(Math.max(f, 0.4 + 0.15 * Math.sin(G.time * 11)), Math.max(f, 0.04), Math.max(f, 0.02));
    else m.bodyMat.emissive.setRGB(f, f, f);
    if (m.shield) m.shield.visible = this.shield > 0;
    m.group.position.copy(this.pos);
    if (m.hover) m.group.position.y += 0.35 + 0.25 * Math.sin(G.time * 1.8 + this.seed);
    m.group.position.y += this.fly;
    if (m.spin && this.def.spinGuard) m.spin.rotation.y = spinAngle(this);
    m.group.rotation.y = this.yaw;
    // the leader's stagger: the same backward jolt as on the leader's screen
    this.staggerT = Math.max(0, this.staggerT - dt);
    m.group.rotation.x = this.staggerT > 0 ? -0.28 * Math.sin(Math.PI * (1 - this.staggerT / this.staggerMax)) : 0;
  }

  coverMove(dt) {
    const A = this.ai, P = this.tgt || G.player;
    A.t -= dt;
    // walk to a spot along the nav grid; d is how far is left
    const go = (p) => {
      const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
      if (d <= 0.35) return { x: 0, z: 0, d };
      const sd = this.steer(p.x, p.z, dt);
      return { x: sd.x, z: sd.z, d };
    };
    if (A.state === 'toCover') {
      const m = go(A.cover);
      if (m.d <= 0.35 || A.t <= 0) { A.state = 'hide'; A.t = rand(COVER.hide[0], COVER.hide[1]); A.exposeT = COVER.recheck; }
      return m;
    }
    if (A.state === 'hide') {
      A.exposeT -= dt;
      if (A.exposeT <= 0) {
        A.exposeT = COVER.recheck;
        // flanked: cover no longer blocks the player's view, so find new cover
        if (hasLOS(P.eye, _v.set(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z))) { A.state = 'advance'; A.t = 0; return { x: 0, z: 0 }; }
      }
      if (A.t <= 0) {
        A.state = 'peek'; A.t = COVER.peek; A.bursts = 0;
        A.peek = peekPoint(this, A.cover);
        this.fireT = Math.min(this.fireT, 0.3);
      }
      return { x: 0, z: 0 };
    }
    // peek: sidestep out until we can see the player; the firing code takes the shot
    if (A.t <= 0) { A.state = 'hide'; A.t = rand(COVER.hide[0], COVER.hide[1]) * 0.5; return { x: 0, z: 0 }; }
    if (this.los) return { x: 0, z: 0 };
    return go(A.peek);
  }

  shoot(dist, spreadMul = 1, dirOverride = null) {
    const P = this.tgt || G.player, def = this.def;
    this.model.group.updateMatrixWorld(true);
    const from = this.model.muzzle.getWorldPosition(new THREE.Vector3());
    if (def.lob) { // artillery: a mortar round on a high arc that lands, shows its ring and bursts (the grenade system)
      const lead = 0.5;
      const L = lobVelocity(P.pos.x + (P.vel?.x ?? 0) * lead - from.x, P.pos.y + 0.4 - from.y, P.pos.z + (P.vel?.z ?? 0) * lead - from.z, 18);
      spawnEnemyGrenade(from, new THREE.Vector3(L.vx, L.vy, L.vz), def.dmg * this.dmgMult, this.shotColor);
      flashLight(from, this.shotColor, 8, 8, 0.1);
      sfx.enemyShot(this.pos, this.faction);
      return;
    }
    let dir;
    if (dirOverride) dir = dirOverride;
    else {
      const t = dist / def.projSpeed;
      _v2.set(P.pos.x + P.vel.x * t * 0.5, P.pos.y + 1.1 + P.vel.y * t * 0.2, P.pos.z + P.vel.z * t * 0.5);
      const inacc = 0.05 + dist * 0.045 * spreadMul;
      _v2.x += (Math.random() - 0.5) * inacc * 2;
      _v2.y += (Math.random() - 0.5) * inacc;
      _v2.z += (Math.random() - 0.5) * inacc * 2;
      dir = _v2.sub(from).normalize();
    }
    if (def.spiral && !dirOverride) { // a Shrieker's continuous stream winds around its aim
      this.spiralA = (this.spiralA || 0) + def.spiral.turn;
      const r = def.spiral.r * Math.min(1, 0.4 + dist / 30);
      dir.x += Math.cos(this.spiralA) * r; dir.y += Math.sin(this.spiralA) * r; dir.z += Math.sin(this.spiralA * 0.5) * r * 0.5;
      dir.normalize();
    }
    fireEnemyShot(from, dir, def.projSpeed, def.dmg * this.dmgMult, this.shotColor, def.shotSize, def.splash);
    flashLight(from, this.shotColor, 6, 6, 0.06);
    sfx.enemyShot(this.pos, this.faction);
  }

  bossUpdate(dt, dist) {
    const flipTo = (ph) => {
      this.bossPhase = ph;
      this.bossPhaseT = bossPhaseTime(ph, 2 - this.thresholds.length);
      this.specialT = Math.min(this.specialT, 1);
      if (ph === 'push') { ringFx(this.pos, 8, G.mission.loc.colors.eye, 0.5); sfx.alert(); }
    };
    if (this.thresholds.length && this.hp / this.maxHp < this.thresholds[0]) {
      this.thresholds.shift();
      this.shield = this.maxShield * 0.6;
      if (this.model.shield) this.model.shield.visible = true;
      spawnBossAdds(this);
      flipTo('push'); // each third of health opens with a push
    }
    // hold (range, volleys) and push (close, slams) alternate; later thirds hold less and push more
    this.bossPhaseT -= dt;
    if (this.bossPhaseT <= 0) flipTo(this.bossPhase === 'hold' ? 'push' : 'hold');
    this.specialT -= dt;
    if (this.specialT > 0) return;
    this.specialT = this.bossPhase === 'push' ? rand(3, 4.5) : rand(3, 5);
    if (this.bossPhase === 'push' && dist < 10) {
      // ground slam
      ringFx(this.pos, 10, G.mission.loc.colors.eye, 0.6);
      explosionFx(_v.copy(this.pos).setY(0.5), 3, G.mission.loc.colors.eye);
      sfx.explosion(8);
      for (const P of allPlayers()) {
        const d = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) || 0.01;
        if (P.dead || d >= 9 || P.pos.y >= 1.5) continue;
        if (P.remote) { damageRemote(P, 32 * this.dmgMult, this.pos); continue; }
        damagePlayer(32 * this.dmgMult, this.pos, 'splash');
        P.vel.x += (P.pos.x - this.pos.x) / d * 12;
        P.vel.z += (P.pos.z - this.pos.z) / d * 12;
        P.vel.y = 6;
      }
    } else if (this.los && !(this.bossPhase === 'push' && dist < 10)) {
      // fan volley
      const P = this.tgt || G.player;
      this.model.group.updateMatrixWorld(true);
      const from = this.model.muzzle.getWorldPosition(new THREE.Vector3());
      const base = _v.set(P.pos.x, P.pos.y + 1, P.pos.z).sub(from).normalize();
      for (let i = -3; i <= 3; i++) {
        const d = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.09);
        fireEnemyShot(from, d, this.def.projSpeed * 0.9, this.def.dmg * this.dmgMult, G.mission.loc.colors.eye, 0.26, 2);
      }
      sfx.alert();
    }
  }
}

// ---------------------------------------------------------------------------
// Cover finding
// ---------------------------------------------------------------------------
const _c = new THREE.Vector3();

/** Finds a spot behind a collider that blocks the player's view, or null. */
function findCover(e, avoid = null) {
  const P = e.tgt || G.player;
  const b = G.level.bounds;
  let best = null, bestScore = Infinity;
  for (const c of G.colliders) {
    if (c.pass) continue; // Guardian barricades aren't enemy cover
    const hx = (c.max.x - c.min.x) / 2, hz = (c.max.z - c.min.z) / 2, h = c.max.y - c.min.y;
    if (h < 1.0 || hx > 15 || hz > 15) continue; // too low to hide behind, or a boundary wall
    const cx = (c.min.x + c.max.x) / 2, cz = (c.min.z + c.max.z) / 2;
    const toE = Math.hypot(cx - e.pos.x, cz - e.pos.z);
    if (toE > 14) continue;
    let dx = cx - P.pos.x, dz = cz - P.pos.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    const edge = Math.min(Math.abs(dx) > 1e-3 ? hx / Math.abs(dx) : Infinity, Math.abs(dz) > 1e-3 ? hz / Math.abs(dz) : Infinity);
    const off = edge + e.radius + 0.35;
    _c.set(cx + dx * off, 0, cz + dz * off); _c.y = groundAt(_c.x, _c.z);
    const pd = Math.hypot(_c.x - P.pos.x, _c.z - P.pos.z);
    if (pd < 7 || pd > e.def.range) continue;
    if (_c.x < b.minX + 1 || _c.x > b.maxX - 1 || _c.z < b.minZ + 1 || _c.z > b.maxZ - 1) continue;
    if (pointInColliders(_c.clone().setY(_c.y + 0.5), e.radius)) continue;
    if (avoid && Math.hypot(_c.x - avoid.x, _c.z - avoid.z) < 2.5) continue;
    if (!coverReachable(e, _c)) continue;
    if (hasLOS(P.eye, _c.clone().setY(Math.min(1.0, h - 0.1)))) continue; // must actually block the view
    const score = toE + Math.abs(pd - e.def.prefer) * 0.4;
    if (score < bestScore) { bestScore = score; best = _c.clone(); }
  }
  return best;
}

/** A cover spot must be on the nav grid, inside the unit's leash, and in the part of the map the zone can reach. */
function coverReachable(e, p) {
  const nav = G.nav;
  if (e.zone?.center && pastLeash(e.zone, p.x, p.z, 0)) return false;
  if (!nav) return true;
  const i = cellIndex(nav, p.x, p.z);
  if (i < 0 || nav.hgt[i] < 0 || Math.abs(nav.hgt[i] - e.pos.y) > NAV.step) return false;
  const Z = e.zone;
  if (Z?.center) {
    if (!Z.reach) { Z.reach = floodReach(nav, Z.center.x, Z.center.z); Z.ledges = ledgeSpots(nav, Z.reach, Z.center.x, Z.center.z, 40); }
    if (!Z.reach[i]) return false;
  }
  return true;
}

/** A spot just to the side of cover, where the shooter can see the player. */
function peekPoint(e, cover) {
  const P = e.tgt || G.player;
  const dx = P.pos.x - cover.x, dz = P.pos.z - cover.z, d = Math.hypot(dx, dz) || 1;
  const px = -dz / d, pz = dx / d;
  for (const s of Math.random() < 0.5 ? [1, -1] : [-1, 1]) {
    const p = new THREE.Vector3(cover.x + px * s * 1.8 + (dx / d) * 0.6, 0, cover.z + pz * s * 1.8 + (dz / d) * 0.6);
    p.y = groundAt(p.x, p.z);
    if (!pointInColliders(p.clone().setY(p.y + 0.5), e.radius)) return p;
  }
  return new THREE.Vector3(cover.x + (dx / d) * 1.5, 0, cover.z + (dz / d) * 1.5);
}

// ---------------------------------------------------------------------------
// Enemy projectiles
// ---------------------------------------------------------------------------
export function fireEnemyShot(from, dir, speed, dmg, color, size, splash, fromNet = false) {
  if (!fromNet) announceShot(from, dir, speed, dmg, color, size, splash);
  const mesh = new THREE.Mesh(shotGeo, basicMat(color));
  mesh.scale.setScalar(size);
  mesh.position.copy(from);
  G.scene.add(mesh);
  G.enemyShots.push({ pos: from.clone(), vel: dir.clone().multiplyScalar(speed), dmg, mesh, life: 4, splash: splash || 0, color, origin: from.clone() });
}

function distToPlayer(p) {
  const P = G.player;
  const y = clamp(p.y, P.pos.y + 0.3, P.pos.y + 1.5);
  return Math.hypot(p.x - P.pos.x, p.y - y, p.z - P.pos.z);
}

export function updateEnemyShots(dt) {
  const P = G.player;
  for (let i = G.enemyShots.length - 1; i >= 0; i--) {
    const s = G.enemyShots[i];
    s.life -= dt;
    const steps = Math.max(1, Math.ceil((s.vel.length() * dt) / 0.4));
    let hit = s.life <= 0 ? 'expire' : null;
    for (let k = 0; k < steps && !hit; k++) {
      s.pos.addScaledVector(s.vel, dt / steps);
      if (s.pos.y < groundAt(s.pos.x, s.pos.z) + 0.02) hit = 'ground';
      else if (pointInColliders(s.pos)) hit = 'wall';
      else if (G.tickers.some((t) => t.ward && t.ward.p.distanceToSquared(s.pos) < t.ward.r2)) hit = 'wall'; // Bastion Ward
      else if (P.barrierBlocks?.(s.pos)) { hit = 'wall'; P.barrierBlocked(s.dmg); } // Sentinel Shield barrier (U9)
      else if (remoteBarrierBlocks(s.pos)) hit = 'wall';
      else if (!P.dead && distToPlayer(s.pos) < 0.5) hit = 'player';
    }
    if (hit) {
      if (hit === 'player') damagePlayer(s.dmg, s.origin);
      else if (s.splash && !P.dead) {
        const d = distToPlayer(s.pos);
        if (d < s.splash) damagePlayer(s.dmg * 0.6 * (1 - d / s.splash), s.pos, 'splash');
      }
      if (s.splash) explosionFx(s.pos, s.splash * 0.6, s.color);
      else if (hit !== 'expire') sparks(s.pos, s.color, 3, 3, 0.05, 0.2);
      G.scene.remove(s.mesh);
      G.enemyShots.splice(i, 1);
      continue;
    }
    s.mesh.position.copy(s.pos);
  }
}

// ---------------------------------------------------------------------------
// Enemy grenades (U13b): lobbed, land, show a ring, explode. They hurt Guardians only.
// Every fireteam member simulates its own copy and damages itself, like enemy shots.
// ---------------------------------------------------------------------------
export function spawnEnemyGrenade(from, vel, dmg, color, fromNet = false) {
  if (!fromNet) announceGrenade(from, vel, dmg, color);
  const mesh = new THREE.Mesh(shotGeo, basicMat(color));
  mesh.scale.setScalar(0.22);
  mesh.position.copy(from);
  G.scene.add(mesh);
  (G.enemyGrenades ||= []).push({ pos: from.clone(), vel: vel.clone(), dmg, color, mesh, fuse: -1, life: 8 });
}

export function updateEnemyGrenades(dt) {
  const list = G.enemyGrenades;
  if (!list?.length) return;
  const P = G.player;
  for (let i = list.length - 1; i >= 0; i--) {
    const g = list[i];
    g.life -= dt;
    let boom = g.life <= 0;
    if (g.fuse < 0) {
      g.vel.y -= GRENADE.gravity * dt;
      const nx = g.pos.x + g.vel.x * dt, ny = g.pos.y + g.vel.y * dt, nz = g.pos.z + g.vel.z * dt;
      if (pointInColliders(_v.set(nx, g.pos.y, nz))) { g.vel.x *= -0.3; g.vel.z *= -0.3; }
      else { g.pos.x = nx; g.pos.z = nz; }
      g.pos.y = ny;
      const gnd = groundAt(g.pos.x, g.pos.z);
      if (g.pos.y <= gnd + 0.15) {
        g.pos.y = gnd + 0.15; g.vel.set(0, 0, 0); g.fuse = 0.6;
        ringFx(_v.copy(g.pos).setY(gnd + 0.05), GRENADE.radius, g.color, 0.6); // the warning ring
        sfx.alert();
      } else if (!P.dead && g.pos.distanceTo(_v2.set(P.pos.x, P.pos.y + 1, P.pos.z)) < 0.7) boom = true;
    } else {
      g.fuse -= dt;
      g.mesh.visible = Math.sin(G.time * 30) > -0.3;
      if (g.fuse <= 0) boom = true;
    }
    g.mesh.position.copy(g.pos);
    if (!boom) continue;
    explosionFx(g.pos, GRENADE.radius * 0.5, g.color);
    flashLight(g.pos, g.color, 30, GRENADE.radius * 3, 0.2);
    sfx.explosion(GRENADE.radius, g.pos);
    if (!P.dead) {
      const d = Math.hypot(P.pos.x - g.pos.x, P.pos.y + 1 - g.pos.y, P.pos.z - g.pos.z);
      const dm = blastDamage(g.dmg, d, GRENADE.radius);
      if (dm > 0) {
        damagePlayer(dm, g.pos, 'splash');
        const k = Math.hypot(P.pos.x - g.pos.x, P.pos.z - g.pos.z) || 1;
        P.vel.x += (P.pos.x - g.pos.x) / k * 5; P.vel.z += (P.pos.z - g.pos.z) / k * 5; P.vel.y = Math.max(P.vel.y, 2.5);
        P.shake = Math.max(P.shake, 0.4);
      }
    }
    G.scene.remove(g.mesh);
    list.splice(i, 1);
  }
}
