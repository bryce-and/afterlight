// U22 Darkness: Stasis and Strand behavior. The rules and numbers are in darkness-rules.js (pure, tested);
// this module holds what runs in the game:
//  - enemy side: freeze / suspend / shatter / unravel on hits (darkHit, darkUnravel, called by dealDamage),
//    frozen and suspended enemies held in place with a crystal shell or threads (darkHold), Darkness Captains
//    throwing Stasis or Strand grenades at players (darkEnemyStep, darkGrenadeBoom)
//  - world objects: Stasis crystals and Strand tangles, shootable and shattered by explosions (darkTargets, darkSplash)
//  - player side: the six Darkness subclasses' grenades, melees, aspects, fragments and twelve supers, mixed into
//    Player by installDarkness(Player). player.js calls the hooks at single points (marked U22 there).
// Effects every screen should see go through castFx (abilities.js), which hands unknown kinds to darkFx here.
import * as THREE from 'three';
import { G } from './state.js';
import { ELEMENTS } from './data.js';
import { dealDamage, enemiesNear, addTicker, spawnPlayerProjectile } from './game.js';
import { castFx } from './abilities.js';
import { remotes } from './coop.js';
import { net } from './net.js';
import { sparks, glowBurst, shockwave, explosionFx, swirl, ember, tracer } from './effects.js';
import { moveBody } from './physics.js';
import { sfx } from './audio.js';
import { SUPER_TUNE, SUPER_POWER } from './combat.js';
import { DARK_ASPECT_TUNE as AT, FRAGMENT_TUNE as FT } from './subclass.js';
import { DARK_PERKS, weaponChill, sliceHit, canPerch, perchAdd } from './darkness-rules.js';
import { hasLOS } from './physics.js';
import { groundAt, floorBelow } from './colliders.js';
import { STASIS, STRAND, DARK_GRENADE, canFreeze, canSuspend, chill, freezeTime, suspendTime, shatters, shatterBlast, playerChill, breakFree, unravelTargets, darkWielder } from './darkness-rules.js';
import * as ui from './ui.js';

const ST = ELEMENTS.stasis.hex, SD = ELEMENTS.strand.hex, ST_CORE = 0xe8f2ff, SD_CORE = 0xc8ffd8;
const V = (a) => (a instanceof THREE.Vector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));
const _v = new THREE.Vector3();
const superDmg = (n) => n * SUPER_POWER * (G.mission?.hpMult ?? 1);
const glow = (c, k = 2.2, op = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, flatShading: true, transparent: op < 1, opacity: op });

// ===========================================================================
// Enemy side
// ===========================================================================

/** Freeze an enemy (bosses never). `mult` lengthens it (Whisper of Durance). Returns true if it froze. */
function freezeEnemy(e, mult = 1) {
  if (!canFreeze(e)) return false;
  e.status.remove('slow');
  e.status.apply('frozen', { t: freezeTime(e.cls, mult), set: true });
  e.windup = 0; e.lunge = 0; e.cmWind = 0; e.cmSwing = 0; e.burstLeft = 0;
  return true;
}

/**
 * Darkness part of a hit (dealDamage, after the shared debuffs). A damaging hit on a frozen enemy shatters it
 * first; then slow stacks, freezes and suspends from this hit go on. A fireteam member predicts the statuses on
 * its copy; the leader (the owner) runs the shatter blast.
 */
export function darkHit(e, o, dmg) {
  if (e.status.has('frozen') && shatters(o, dmg)) {
    e.status.remove('frozen');
    shatterFx(e.center(new THREE.Vector3()), 1);
    if (!e.remote) shatterBlastAt(e, o);
  }
  const mine = !o.remoteHit;
  let froze = false;
  if (o.slowAdd) {
    const c = chill(e.status.stacks('slow'), o.slowAdd, !canFreeze(e));
    if (c.freeze) froze = freezeEnemy(e, o.freezeMult || 1);
    else e.status.apply('slow', { t: STASIS.slowT, stacks: c.stacks });
  }
  if (o.freeze && !froze && !e.status.has('frozen')) froze = freezeEnemy(e, o.freeze);
  if (froze && mine) G.player?.darkOnFreeze?.(e);
  if (o.suspend && canSuspend(e)) {
    e.status.apply('suspend', { t: suspendTime(e.cls, o.suspend) });
    e.windup = 0; e.lunge = 0; e.burstLeft = 0;
  }
  if (o.sever && mine) G.player?.darkOnSever?.(e);
}

/** A frozen enemy shatters: heavy Stasis damage to it, splash around (which shatters other frozen ones). */
function shatterBlastAt(e, o) {
  const local = !o.remoteHit;
  const B = shatterBlast(local && G.player?.frag?.has('fissures') ? FT.fissures : 0);
  const c = e.center(new THREE.Vector3());
  dealDamage(e, B.dmg, { element: 'stasis', source: 'ability', pos: c.clone(), shatterHit: true, jolted: true });
  for (const x of enemiesNear(c, B.r, 12, e)) dealDamage(x, B.splash, { element: 'stasis', source: 'ability', pos: x.center(new THREE.Vector3()), jolted: true });
  darkSplash(c, B.r * 0.6);
  if (local) G.player?.darkOnShatter?.(c, false);
}

/** Unravel: a hit on an unraveled enemy spins threads into up to two enemies nearby (owner side, like jolt). */
export function darkUnravel(e, o, dealt) {
  if (dealt <= 0 || o.thread || !e.status.has('unravel') || e.unravelAt > G.time) return;
  const U = STRAND.unravel;
  e.unravelAt = G.time + U.gap;
  const c = e.center(new THREE.Vector3());
  const near = unravelTargets(enemiesNear(c, U.r, 6, e));
  if (!near.length) return;
  castFx('threads', { pts: [c, ...near.map((x) => x.center(new THREE.Vector3()))] });
  for (const x of near) dealDamage(x, U.dmg, { element: 'strand', source: 'ability', pos: x.center(new THREE.Vector3()), thread: true, jolted: true });
}

/** Enemy damage multiplier from sever (Enemy.dmgMult reads it). */
export const SEVER_MULT = STRAND.sever.mult;

// ---- frozen and suspended enemies: held in place, shown with a crystal shell or threads ----
function shellFor(e) {
  if (e.darkShell) return e.darkShell;
  const g = new THREE.Group();
  const h = e.model.height || 2;
  const ice = glow(ST, 0.9, 0.55), core = glow(ST_CORE, 1.4, 0.4);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, r = 0.38;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.16, h * (0.55 + 0.1 * (i % 3)), 4), i % 2 ? ice : core);
    s.position.set(Math.cos(a) * r, h * 0.35 + (i % 3) * 0.08, Math.sin(a) * r);
    s.rotation.set(Math.sin(a) * 0.35, a, Math.cos(a) * 0.35);
    g.add(s);
  }
  const block = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), ice);
  block.scale.set(1, h * 0.9, 1); block.position.y = h * 0.45; g.add(block);
  g.visible = false;
  e.model.group.add(g);
  e.darkShell = g;
  return g;
}
function threadsFor(e) {
  if (e.darkThreads) return e.darkThreads;
  const g = new THREE.Group();
  const h = e.model.height || 2, m = glow(SD, 2.2, 0.85);
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3, 3), m);
    const a = (i / 4) * Math.PI * 2;
    t.position.set(Math.cos(a) * 0.5, -1.2, Math.sin(a) * 0.5);
    t.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
    g.add(t);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 4, 12).rotateX(Math.PI / 2), m);
  ring.position.y = h * 0.5; g.add(ring);
  g.visible = false;
  e.model.group.add(g);
  e.darkThreads = g;
  return g;
}

/**
 * Per frame for every live enemy (owner and fireteam copies): the Darkness look, and the suspend lift.
 * Returns true when the owner's enemy is frozen or suspended: it skips its AI, movement and attacks.
 */
export function darkHold(e, dt) {
  const frozen = e.status.has('frozen'), sus = e.status.has('suspend');
  if (frozen || e.darkShell) shellFor(e).visible = frozen;
  if (sus || e.darkThreads) threadsFor(e).visible = sus;
  const want = sus ? STRAND.lift : 0;
  e.darkLift = (e.darkLift || 0) + (want - (e.darkLift || 0)) * Math.min(1, dt * (sus ? 5 : 9));
  if (e.darkLift < 0.01 && !sus) e.darkLift = 0;
  if (sus && Math.random() < 0.15) sparks(e.center(_v), SD, 1, 1.5, 0.05, 0.4);
  if (frozen && Math.random() < 0.1) sparks(e.center(_v), ST_CORE, 1, 1, 0.05, 0.5);
  if (e.status.has('unravel') && Math.random() < 0.12) sparks(e.center(_v), SD, 1, 2, 0.04, 0.3);
  if (e.remote || !(frozen || sus)) return false;
  // held: hold still (a frozen enemy keeps its pose; a suspended one turns slowly), keep the model placed
  const m = e.model;
  e.knock.multiplyScalar(Math.exp(-6 * dt));
  if (sus) e.yaw += dt * 0.8;
  m.group.position.copy(e.pos);
  m.group.position.y += e.fly + e.darkLift;
  m.group.rotation.y = e.yaw;
  m.bodyMat.emissive.setRGB(frozen ? 0.05 : 0, frozen ? 0.12 : 0.1, frozen ? 0.3 : 0.04);
  return true;
}

// ---- Darkness Captains ----
/** Set up a unit as a Darkness wielder from its shield element (Enemy constructor). */
export function darkEnemyInit(e) {
  e.darkEl = darkWielder(e.cls, e.shieldEl);
  e.darkGrenT = e.darkEl ? 3 + Math.random() * 4 : Infinity;
}
/** A Darkness Captain lobs its element's grenade at its target every few seconds (owner side). */
export function darkEnemyStep(e, dt, dist, P) {
  if (!e.darkEl || e.remote) return;
  e.darkGrenT -= dt;
  if (e.darkGrenT > 0 || !e.los || P.dead || dist < DARK_GRENADE.minRange || dist > DARK_GRENADE.maxRange) return;
  e.darkGrenT = DARK_GRENADE.cd[0] + Math.random() * (DARK_GRENADE.cd[1] - DARK_GRENADE.cd[0]);
  e.throwGrenade(P, e.darkEl);
}

/** Where an enemy Darkness grenade bursts: Stasis chills (three stacks freeze) and leaves a slowing field; Strand suspends. */
export function darkGrenadeBoom(el, pos) {
  const P = G.player, D = DARK_GRENADE;
  if (el === 'stasis') {
    glowBurst(pos, ST, 16, 6, 0.1, 0.6);
    darkField(pos, D.r, D.stasis.field, ST);
  } else {
    swirl(pos, D.strand.suspendR, SD, 0.7, true, 0.07, 2);
    glowBurst(pos, SD, 14, 5, 0.08, 0.5);
  }
  if (!P || P.dead) return;
  const d = Math.hypot(P.pos.x - pos.x, P.pos.y + 1 - pos.y, P.pos.z - pos.z);
  if (el === 'stasis' && d < D.r) P.darkChill(D.stasis.chill);
  if (el === 'strand' && d < D.strand.suspendR) P.darkSuspend();
}
/** The lingering Stasis field an enemy grenade leaves (chills a player standing in it, one stack a second). */
function darkField(pos, r, life, color) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ring.position.set(pos.x, (pos.y > 1 ? pos.y - 0.1 : 0.06), pos.z);
  G.scene.add(ring);
  let t = life, tick = 1;
  addTicker({
    update(dt) {
      t -= dt; tick -= dt;
      if (Math.random() < 0.4) ember(new THREE.Vector3(pos.x + (Math.random() - 0.5) * r * 1.6, pos.y + 0.2, pos.z + (Math.random() - 0.5) * r * 1.6), ST_CORE, 0.06, 0.6, 0.4);
      const P = G.player;
      if (tick <= 0) { tick = 1; if (P && !P.dead && Math.hypot(P.pos.x - pos.x, P.pos.z - pos.z) < r) P.darkChill(1); }
      return t > 0;
    },
    dispose() { G.scene?.remove(ring); },
  });
}

// ===========================================================================
// World objects: Stasis crystals and Strand tangles
// ===========================================================================
// Every screen sees them (castFx 'crystal' / 'tangle'); only the caster's copy is shootable and deals damage,
// and its break is sent as 'darkbreak' so the others remove theirs.
const objs = new Map();
let objN = 0;

/** Hit meshes of this player's own crystals and tangles (getHitTargets). */
export function darkTargets() { const out = []; for (const c of objs.values()) if (c.local) out.push(c.hit); return out; }
/** Explosions shatter crystals and set off tangles inside the radius (explode in game.js). */
export function darkSplash(pos, r) {
  for (const c of [...objs.values()]) if (c.local && c.pos.distanceTo(pos) < r + 0.6) breakObj(c);
}
/** Clear every crystal and tangle (mission start, reset). */
export function resetDark() {
  for (const c of [...objs.values()]) removeObj(c);
  for (const m of perch.list) m.parent?.remove(m); // H23: perched threadlings do not follow you to a new map
  perch.list.length = 0; perch.ticker = null; perch.sent = -1;
  for (const st of remotePerch.values()) for (const m of st.list) m.parent?.remove(m);
  remotePerch.clear();
}

function crystalMesh(size) {
  const g = new THREE.Group();
  const ice = glow(ST, 1.1, 0.85), core = glow(ST_CORE, 2.2);
  const spikes = [[0, 1, 0, 1.6], [0.35, 0.8, 0.2, 1.1], [-0.3, 0.75, -0.25, 1.0], [0.2, 0.7, -0.35, 0.9], [-0.25, 0.65, 0.3, 0.85]];
  spikes.forEach(([x, y, z, h], i) => {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.22, h * size, 4), i ? ice : core);
    s.position.set(x * size, (h * size) / 2, z * size);
    s.rotation.set(z * 0.8, i, -x * 0.8);
    g.add(s);
  });
  return g;
}
function tangleMesh() {
  const g = new THREE.Group();
  const m = glow(SD, 2.4), c = glow(SD_CORE, 2);
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), c));
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 4, 14), m); t.rotation.set(i * 1.1, i * 0.7, 0); g.add(t); }
  return g;
}

function addObj(kind, o, local) {
  const pos = V(o.p);
  const mesh = kind === 'crystal' ? crystalMesh(o.size || STASIS.crystal.size) : tangleMesh();
  mesh.position.copy(pos);
  if (kind === 'tangle') mesh.position.y += 0.5;
  G.scene.add(mesh);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, kind === 'crystal' ? 1.8 : 1, 6), new THREE.MeshBasicMaterial());
  hit.visible = false;
  hit.position.copy(pos).setY(pos.y + (kind === 'crystal' ? 0.9 : 0.5));
  G.scene.add(hit);
  const c = { id: o.id, kind, pos, mesh, hit, local, life: o.life, max: o.life, opt: o };
  hit.userData.mechShot = () => breakObj(c);
  objs.set(o.id, c);
  if (local) G.hitDirty = true;
  if (kind === 'crystal') {
    shockwave(pos.clone().setY(pos.y + 0.05), STASIS.crystal.freezeR, ST, 0.4);
    glowBurst(pos.clone().setY(pos.y + 0.6), ST_CORE, 8, 4, 0.08, 0.4);
    if (local) for (const e of enemiesNear(pos, STASIS.crystal.freezeR)) dealDamage(e, 30, { element: 'stasis', source: 'ability', pos: e.center(new THREE.Vector3()), freeze: G.player?.freezeMult?.() ?? 1 });
  }
  addTicker({
    update(dt) {
      if (!objs.has(c.id)) return false;
      c.life -= dt;
      if (kind === 'tangle') mesh.rotation.y += dt * 1.5;
      const k = c.life / c.max;
      if (k < 0.2) mesh.scale.setScalar(Math.max(0.05, k / 0.2)); // dissolving
      if (c.life <= 0) { removeObj(c); return false; }
      return true;
    },
  });
}
function removeObj(c) {
  objs.delete(c.id);
  G.scene?.remove(c.mesh); G.scene?.remove(c.hit);
  if (c.local) G.hitDirty = true;
}
/** The caster's crystal shatters (or tangle detonates): damage, effects, and tell the fireteam. */
function breakObj(c) {
  if (!objs.has(c.id)) return;
  removeObj(c);
  castFx('darkbreak', { id: c.id, p: c.pos, kind: c.kind });
  const P = G.player;
  if (c.kind === 'crystal') {
    const C = STASIS.crystal, at = c.pos.clone().setY(c.pos.y + 0.8);
    for (const e of enemiesNear(at, C.r)) dealDamage(e, C.dmg, { element: 'stasis', source: 'ability', pos: e.center(new THREE.Vector3()) });
    darkSplash(at, C.r * 0.5); // neighbouring crystals go too
    P?.darkOnShatter?.(at, true);
  } else {
    const T = STRAND.tangle, at = c.pos.clone().setY(c.pos.y + 0.5);
    for (const e of enemiesNear(at, T.r)) dealDamage(e, T.dmg, { element: 'strand', source: 'ability', pos: e.center(new THREE.Vector3()), suspend: P?.suspendMult?.() ?? 1 });
    if (P?.asp?.has('maelstrom')) castFx('maelstrom', { p: at, t: AT.maelstrom.t });
  }
}
function newObjId() { return `${net.myId || 'solo'}:${++objN}`; }
/** Raise a crystal at p (the caster's, shootable). */
/** Raise a Stasis crystal at p, standing on the floor under it (H24: was clamped to y = 0, so it sank into raised floors). */
export function raiseCrystal(p, size) { castFx('crystal', { id: newObjId(), p: p.clone().setY(floorBelow(p.x, p.z, p.y + 0.6)), life: STASIS.crystal.life, size }); }
/** Drop a tangle at p. */
export function dropTangle(p, lifeMult = 1) { castFx('tangle', { id: newObjId(), p: p.clone().setY(Math.max(0, p.y - 0.3)), life: STRAND.tangle.life * lifeMult }); }

function shatterFx(p, k = 1) {
  explosionFx(p, 1.6 * k, ST);
  glowBurst(p, ST_CORE, 18, 7 * k, 0.1, 0.5, 1, 0.4);
  sparks(p, ST, 14, 8 * k, 0.09, 0.5);
  sfx.shieldBreak(p);
}

// ===========================================================================
// Effects (castFx kinds; abilities.js hands them over). local = this machine cast it: it deals the damage.
// ===========================================================================
export function darkFx(kind, o, local) {
  switch (kind) {
    case 'crystal': case 'tangle': addObj(kind, o, local); return true;
    case 'darkbreak': {
      const c = objs.get(o.id);
      if (c) removeObj(c);
      const p = V(o.p);
      if (o.kind === 'crystal') shatterFx(p.setY(p.y + 0.8), 1.2);
      else { explosionFx(p.setY(p.y + 0.5), 2.2, SD); swirl(p, STRAND.tangle.r, SD, 0.6, true, 0.07, 2); }
      return true;
    }
    case 'shatter': shatterFx(V(o.p), o.k || 1); return true;
    case 'threads': { // unravel threads and Strand lines between points
      const pts = o.pts.map(V);
      for (let i = 1; i < pts.length; i++) tracer(pts[0], pts[i], SD, 0.03, 0.18);
      return true;
    }
    case 'line': tracer(V(o.a), V(o.b), o.el === 'stasis' ? ST : SD, o.w || 0.04, o.life || 0.2); return true;
    case 'darkslam': { // a Stasis or Strand ground slam
      const p = V(o.p), col = o.el === 'stasis' ? ST : SD;
      shockwave(p.clone().setY(p.y + 0.05), o.r, col, 0.5);
      glowBurst(p, o.el === 'stasis' ? ST_CORE : SD_CORE, 16, o.r * 1.4, 0.1, 0.5);
      if (o.el === 'stasis') sparks(p, ST, 20, o.r * 2, 0.1, 0.5); else swirl(p, o.r, SD, 0.6, true, 0.07, 1.5);
      return true;
    }
    case 'duskfield': { // Duskfield Grenade: a Stasis field that slows enemies inside until they freeze
      const p = V(o.p), r = o.r;
      const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), new THREE.MeshBasicMaterial({ color: ST, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      dome.position.copy(p); dome.scale.y = 0.6;
      G.scene.add(dome);
      let t = o.life, tick = 0;
      addTicker({
        update(dt) {
          t -= dt; tick -= dt; dome.rotation.y += dt * 0.4;
          if (Math.random() < 0.6) ember(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * r * 1.6, Math.random() * r * 0.6, (Math.random() - 0.5) * r * 1.6)), ST_CORE, 0.06, 0.5, 0.2);
          if (local && tick <= 0) { tick = 0.5; for (const e of enemiesNear(p, r)) dealDamage(e, 8, { element: 'stasis', source: 'ability', pos: e.center(new THREE.Vector3()), slowAdd: 1, freezeMult: o.fm || 1 }); }
          return t > 0;
        },
        dispose() { G.scene?.remove(dome); },
      });
      return true;
    }
    case 'bleak': case 'decoy': case 'maelstrom': case 'squall': return companionFx(kind, o, local);
    case 'thrd': case 'perch': return local ? true : remoteThreadlingFx(kind, o); // H23: the caster runs its own
    default: return false;
  }
}

/** Lingering Darkness companions: Bleak Watcher turret, Threaded Specter decoy, Whirling Maelstrom, Squall. */
function companionFx(kind, o, local) {
  const p = V(o.p);
  const g = new THREE.Group();
  if (kind === 'bleak') { const c = crystalMesh(0.7); g.add(c); const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), glow(ST_CORE, 3)); eye.position.y = 1.3; g.add(eye); }
  else if (kind === 'decoy') { const m = glow(SD, 1.6, 0.5); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.1, 3, 6), m); b.position.y = 0.9; g.add(b); }
  else if (kind === 'maelstrom' || kind === 'squall') {
    const col = kind === 'squall' ? ST : SD;
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.6 + i * 0.5, 0.04, 4, 16).rotateX(Math.PI / 2), glow(col, 2, 0.7)); t.position.y = 0.4 + i * 0.5; g.add(t); }
  }
  g.position.copy(p);
  G.scene.add(g);
  let t = o.life ?? o.t ?? 6, tick = 0.3;
  const pos = p.clone();
  addTicker({
    update(dt) {
      t -= dt; tick -= dt;
      if (kind === 'maelstrom' || kind === 'squall') g.rotation.y += dt * 6;
      if (kind === 'squall' && local) { // Squall roams after the nearest enemy
        const tgt = enemiesNear(pos, 30, 1)[0];
        if (tgt) { const d = tgt.pos.clone().sub(pos).setY(0); if (d.length() > 0.5) pos.addScaledVector(d.normalize(), SUPER_TUNE.silencesquall.speed * dt); }
        g.position.copy(pos);
      }
      if (local && tick <= 0) {
        if (kind === 'bleak') {
          tick = AT.bleakwatcher.tick;
          const tgt = enemiesNear(pos, AT.bleakwatcher.range, 1)[0];
          if (tgt) {
            const from = pos.clone().setY(pos.y + 1.3), to = tgt.center(new THREE.Vector3());
            castFx('line', { a: from, b: to, el: 'stasis', w: 0.05 });
            dealDamage(tgt, AT.bleakwatcher.dmg, { element: 'stasis', source: 'ability', pos: to, slowAdd: AT.bleakwatcher.stacks, companion: true });
          }
        } else if (kind === 'decoy') {
          tick = 0.2;
          if (enemiesNear(pos, AT.threadedspecter.r, 1).length) t = 0;
        } else if (kind === 'maelstrom') {
          tick = AT.maelstrom.tick;
          for (const e of enemiesNear(pos, AT.maelstrom.r)) dealDamage(e, AT.maelstrom.dmg, { element: 'strand', source: 'ability', pos: e.center(new THREE.Vector3()), sever: STRAND.sever.t, companion: true });
        } else if (kind === 'squall') {
          tick = 0.5;
          for (const e of enemiesNear(pos, SUPER_TUNE.silencesquall.squallR)) dealDamage(e, superDmg(SUPER_TUNE.silencesquall.squall), { element: 'stasis', source: 'super', pos: e.center(new THREE.Vector3()), slowAdd: 1 });
        }
      }
      if (t <= 0) {
        if (kind === 'decoy') { glowBurst(pos.clone().setY(1), SD, 14, 5, 0.08, 0.5); if (local) G.player?.threadlings(pos.clone().setY(1), AT.threadedspecter.n); }
        return false;
      }
      return true;
    },
    dispose() { G.scene?.remove(g); },
  });
  return true;
}

// ===========================================================================
// H23 Threadlings: small striped Strand eggs that skitter along the ground, leap at a target and burst.
// A Broodweaver's threadlings that miss or find nothing climb back onto the caster and perch (up to five);
// perched threadlings jump off when the caster's weapon deals damage. The caster's screen runs them and deals
// the damage; teammates see a cosmetic copy ('thrd') and the perched count ('perch').
// ===========================================================================
let thrGeo = null;
function threadlingMesh() {
  if (!thrGeo) {
    thrGeo = {
      core: new THREE.SphereGeometry(0.12, 8, 6), ring: new THREE.TorusGeometry(1, 0.16, 4, 12).rotateX(Math.PI / 2),
      dark: new THREE.MeshStandardMaterial({ color: 0x0a140d, roughness: 0.6, flatShading: true }), lit: glow(SD, 2.6), hot: glow(SD_CORE, 3),
    };
  }
  const g = new THREE.Group(), body = new THREE.Group();
  const core = new THREE.Mesh(thrGeo.core, thrGeo.dark); core.scale.set(1, 1.35, 1.1); core.position.y = 0.16; body.add(core);
  for (let i = 0; i < 4; i++) { // the wavy green stripes over the dark shell
    const r = new THREE.Mesh(thrGeo.ring, thrGeo.lit), k = 0.125 - Math.abs(i - 1.2) * 0.022;
    r.scale.setScalar(k); r.position.y = 0.07 + i * 0.065; r.rotation.z = (i % 2 ? 0.25 : -0.25); body.add(r);
  }
  const foot = new THREE.Mesh(thrGeo.core, thrGeo.hot); foot.scale.set(0.5, 0.2, 0.5); foot.position.y = 0.03; body.add(foot);
  g.add(body); g.userData.body = body;
  g.scale.setScalar(STRAND.threadling.scale); // about knee height, as in Destiny 2
  return g;
}

const perch = { list: [], ticker: null, releaseAt: -9, sent: -1 };
const remotePerch = new Map(); // caster id -> { list, ticker }

/** Where perched threadling i of n floats around an anchor (H24: low at the feet, slowly circling, out of the first-person view). */
function perchSpot(anchor, i, n, out) {
  const T = STRAND.threadling, a = G.time * 1.4 + (i / Math.max(1, n)) * Math.PI * 2;
  return out.set(anchor.x + Math.cos(a) * T.perchR, anchor.y + T.perchY + Math.sin(G.time * 3 + i) * 0.06, anchor.z + Math.sin(a) * T.perchR);
}

function perchTicker(store, anchorFn) {
  const sp = new THREE.Vector3();
  return {
    update(dt) {
      const anchor = anchorFn();
      store.list.forEach((m, i) => {
        if (anchor) m.position.lerp(perchSpot(anchor, i, store.list.length, sp), Math.min(1, dt * 8));
        m.scale.setScalar(STRAND.threadling.perchScale); // H24: perched ones are small
        m.userData.body.rotation.y += dt * 3;
        if (Math.random() < 0.04) ember(m.position.clone(), SD, 0.03, 0.3, 0.2);
      });
      if (!store.list.length) { store.ticker = null; return false; }
      return true;
    },
    dispose() {},
  };
}
function ensureTicker(store, anchorFn) {
  if (store.ticker && G.tickers.includes(store.ticker)) return;
  if (store.ticker) { for (const m of store.list) m.parent?.remove(m); store.list.length = 0; } // a new map cleared the tickers: perched ones are gone
  store.ticker = perchTicker(store, anchorFn);
  addTicker(store.ticker);
}
function sendPerch() {
  if (perch.sent === perch.list.length) return;
  perch.sent = perch.list.length;
  castFx('perch', { n: perch.list.length });
}
/** How many threadlings are perched on you (the HUD reads this). */
export const perchedCount = () => (perch.ticker && G.tickers.includes(perch.ticker) ? perch.list.length : 0);

function burstAt(p) { glowBurst(p, SD, 8, 3, 0.07, 0.35); sparks(p, SD_CORE, 5, 3, 0.04, 0.25); }

/**
 * One threadling. `local`: the caster's screen (hunts real enemies and deals damage). `o.tgt` a preferred enemy,
 * `o.to` (cosmetic copies) the point it runs to. `o.perch`: it climbs back onto the caster when it finds nothing.
 */
function runThreadling(from, o, local, mesh = null) {
  const T = STRAND.threadling;
  const g = mesh || threadlingMesh();
  g.scale.setScalar(T.scale); // H24: a released perched threadling grows back to full size
  const pos = from.clone();
  const gy = groundAt(pos.x, pos.z);
  if (pos.y < gy) pos.y = gy;
  g.position.copy(pos);
  if (!g.parent) G.scene.add(g);
  const vel = new THREE.Vector3((Math.random() - 0.5) * 3, 2.5, (Math.random() - 0.5) * 3);
  let state = 'skitter', tgt = o.tgt || null, life = T.life, idle = 0, k = 0;
  const leapFrom = new THREE.Vector3(), aim = new THREE.Vector3(), d = new THREE.Vector3();
  const to = o.to ? V(o.to) : null;
  const done = { v: false };
  const end = (miss) => {
    if (local && miss && o.perch && G.player && !G.player.dead) { state = 'return'; return; }
    burstAt(pos.clone().setY(pos.y + 0.2));
    done.v = true;
  };
  const target = () => {
    if (!local) return to;
    if (!tgt || !tgt.alive) tgt = enemiesNear(pos, T.seekR, 1)[0] || null;
    return tgt ? tgt.center(aim) : null;
  };
  addTicker({
    update(dt) {
      if (done.v) return false;
      if (state === 'skitter') {
        life -= dt;
        const at = target();
        if (!at) { idle += dt; vel.x *= 0.9; vel.z *= 0.9; if (idle > 0.6 || life <= 0) end(true); }
        else {
          idle = 0;
          d.copy(at).sub(pos).setY(0);
          const dist = d.length();
          if (dist < T.leapR) { state = 'leap'; leapFrom.copy(pos); k = 0; }
          else { d.normalize(); vel.x = d.x * T.speed; vel.z = d.z * T.speed; g.rotation.y = Math.atan2(d.x, d.z); }
          if (life <= 0) end(true);
        }
        vel.y -= 24 * dt;
        moveBody(pos, vel, dt, 0.15, 0.3);
        g.userData.body.position.y = Math.abs(Math.sin(G.time * 22)) * 0.05; // the skitter
        if (Math.random() < 0.25) ember(pos.clone().setY(pos.y + 0.05), SD, 0.025, 0.25, 0.15);
      } else if (state === 'leap') {
        k = Math.min(1, k + dt / T.leapT);
        const at = local ? (tgt && tgt.alive ? tgt.center(aim) : aim) : to;
        pos.lerpVectors(leapFrom, at, k).y += Math.sin(Math.PI * k) * 1.1;
        g.userData.body.rotation.x += dt * 14;
        if (k >= 1) {
          g.userData.body.rotation.x = 0;
          if (local && tgt && tgt.alive && tgt.center(d).distanceTo(pos) < tgt.radius + 1.3) {
            dealDamage(tgt, T.dmg, { element: 'strand', source: 'ability', pos: pos.clone(), companion: true, unravel: o.unravel ? STRAND.unravel.t : 0 });
            end(false);
          } else end(true);
        }
      } else if (state === 'return') { // back to the caster's shoulder, then perch
        const P = G.player;
        if (!P || P.dead) { end(false); return false; }
        perchSpot(P.pos, perch.list.length, perch.list.length + 1, d);
        pos.lerp(d, Math.min(1, dt * 6));
        g.scale.setScalar(Math.max(T.perchScale, g.scale.x - dt * 4)); // H24: shrinks as it climbs on
        if (pos.distanceTo(d) < 0.5) {
          const r = perchAdd(perch.list.length, 1);
          if (r.lost) { burstAt(pos.clone()); done.v = true; }
          else { ensureTicker(perch, () => (G.player && !G.player.dead ? G.player.pos : null)); perch.list.push(g); sendPerch(); done.v = true; return false; }
        }
      }
      g.position.copy(pos);
      if (done.v) { g.parent?.remove(g); return false; }
      return true;
    },
    dispose() { if (!perch.list.includes(g)) g.parent?.remove(g); },
  });
}

/** Cosmetic copies of a teammate's threadlings and their perched count. */
function remoteThreadlingFx(kind, o) {
  if (kind === 'thrd') { runThreadling(V(o.p), { to: o.to }, false); return true; }
  // 'perch': show o.n threadlings floating around the caster's avatar
  let st = remotePerch.get(o.by);
  if (!st) { st = { list: [], ticker: null }; remotePerch.set(o.by, st); }
  ensureTicker(st, () => remotes.get(o.by)?.pos || null);
  while (st.list.length < o.n) { const m = threadlingMesh(); const a = remotes.get(o.by)?.pos; if (a) m.position.copy(a).setY(a.y + 1.4); G.scene.add(m); st.list.push(m); }
  while (st.list.length > o.n) { const m = st.list.pop(); burstAt(m.position.clone()); m.parent?.remove(m); }
  return true;
}

// ===========================================================================
// Player side (mixed into Player.prototype)
// ===========================================================================
const STASIS_GRENADES = new Set(['glacier', 'duskfield', 'coldsnap']);
const DARK_GRENADE_KINDS = new Set([...STASIS_GRENADES, 'grapple', 'shackle', 'threadling']);
const DARK_MELEES = new Set(['shiver', 'withering', 'penumbral', 'frenzied', 'spike', 'needle']);
export const DARK_SUPERS = new Set(['glacialquake', 'avalanche', 'silencesquall', 'rimeblades', 'winterswrath', 'absolutezero', 'bladefury', 'ripcord', 'silkstrike', 'cradle', 'needlestorm', 'loomwalker']);

const methods = {
  // ---- small helpers ----
  perchN() { return perchedCount(); }, // H23: the HUD reads this
  isDark() { return this.cls.element === 'stasis' || this.cls.element === 'strand'; },
  giveEnergy(k, f) { this.cd[k] = Math.max(0, this.cd[k] - this.cdMax[k] * f); },
  giveSuper(n) { if (!this.superActive) this.superCharge = Math.min(100, this.superCharge + n); },
  freezeMult() { return this.frag.has('durance') ? FT.durance : 1; },
  suspendMult() { return (this.frag.has('continuity') ? FT.continuity : 1) * (this.asp.has('mindspun') && this._mindspunHit ? 1.5 : 1); },
  /** Stasis hit options: slow stacks (and the freeze length for when they freeze). */
  stasisO(stacks, extra = {}) { return { element: 'stasis', slowAdd: stacks, freezeMult: this.freezeMult(), ...extra }; },

  /** H23 Threadlings: they skitter along the ground and leap at enemies; a Broodweaver's perch when they find nothing. */
  threadlings(from, n) {
    const T = STRAND.threadling;
    const targets = enemiesNear(from, T.seekR, n);
    const o = { perch: canPerch(this.cls.subclassId), unravel: this.asp.has('weaverscall') };
    for (let i = 0; i < n; i++) {
      const tgt = targets[i % Math.max(1, targets.length)] || null;
      const p = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8));
      runThreadling(p, { ...o, tgt }, true);
      castFx('thrd', { p, to: tgt ? tgt.center(new THREE.Vector3()) : p });
    }
    sfx.zap();
  },
  /** Perched threadlings jump off at the enemy you hit and the enemies near it (H24: dealDamage calls this on any
   *  direct hit, at any range; was weapon hits only, within seekR of you). */
  releasePerched(hit = null) {
    if (!perchedCount() || G.time < perch.releaseAt) return;
    const T = STRAND.threadling;
    const near = enemiesNear(hit ? hit.pos : this.pos, T.seekR, perch.list.length);
    const targets = hit && hit.alive ? [hit, ...near.filter((x) => x !== hit)] : near;
    if (!targets.length) return;
    perch.releaseAt = G.time + T.releaseGap;
    const o = { perch: canPerch(this.cls.subclassId), unravel: this.asp.has('weaverscall') };
    const out = perch.list.splice(0);
    out.forEach((m, i) => {
      const tgt = targets[i % targets.length];
      runThreadling(m.position.clone(), { ...o, tgt }, true, m);
      castFx('thrd', { p: m.position.clone(), to: tgt.center(new THREE.Vector3()) });
    });
    sendPerch();
    sfx.zap();
  },

  // ---- player debuffs from Darkness enemies ----
  darkChill(n) {
    if (this.dead || this.status.has('frozen')) return;
    const c = playerChill(this.status.stacks('chilled'), n);
    if (c.freeze) {
      this.status.remove('chilled');
      this.status.apply('frozen', { t: STASIS.player.freezeT, set: true });
      ui.centerMessage('Frozen', 'Press Space to break free', 1.2);
      sfx.shieldBreak(this.pos);
    } else this.status.apply('chilled', { stacks: c.stacks, set: true });
  },
  darkSuspend() {
    if (this.dead || this.superActive) return;
    this.status.apply('suspended', { t: STRAND.player.suspendT, set: true });
    this.vel.set(0, 3, 0);
  },
  /** Frozen or suspended: no moving, firing or abilities. Space presses break a freeze early at a small health cost. */
  darkHeld(dt) {
    const fr = this.status.has('frozen'), su = this.status.has('suspended');
    if (!fr && !su) return false;
    if (fr && G.input.pressed.Space) {
      const s = this.status.get('frozen');
      s.t = breakFree(s.t);
      this.health = Math.max(1, this.health - this.maxHealth * STASIS.player.breakCost);
      sparks(this.eye, ST_CORE, 6, 4, 0.06, 0.3);
      if (s.t <= 0) { this.status.remove('frozen'); shatterFx(this.pos.clone().setY(this.pos.y + 1), 0.8); }
    }
    this.vel.x = 0; this.vel.z = 0;
    if (su) this.vel.y = this.pos.y < (this.susFloor ?? (this.susFloor = this.pos.y)) + 1.4 ? 2 : 0;
    else { this.vel.y -= 24 * dt; }
    this.onGround = moveBody(this.pos, this.vel, dt, this.radius, this.height).onGround;
    if (!su) this.susFloor = undefined;
    return true;
  },
  /** Movement speed multiplier from Darkness effects. */
  darkSpeed() {
    let m = 1;
    if (this.status.has('chilled')) m *= STASIS.player.move;
    if (this.status.has('weavewalk')) m *= AT.weavewalk.speed;
    if (this.status.has('cryoclasm')) m *= AT.cryoclasm.speed;
    const t = this.superActive?.type;
    if (t === 'glacialquake' || t === 'rimeblades') m *= 1.15;
    if (t === 'bladefury' || t === 'silkstrike') m *= 1.2;
    return m;
  },
  darkReload() { return (this.status.has('chilled') ? 1 / STASIS.player.handling : 1) * (this.status.has('ascent') ? 1 / FT.ascent.reload : 1); },
  darkSpread() { return this.status.has('chilled') ? STASIS.player.spread : 1; },
  /** Ability recharge multiplier (outside REGEN_CAP, like the exotics): Chilled halves it, Banner of War speeds the melee. */
  darkRegen(k) {
    let m = this.status.has('chilled') ? STASIS.player.regen : 1;
    if (k === 'melee' && this.status.has('banner')) m *= AT.bannerofwar.melee;
    if (k === 'melee' && this.status.has('weavewalk')) m *= 4;
    return m;
  },
  /** Incoming damage multiplier: Woven Mail, Weavewalk, Whisper of Chains. */
  darkResist() {
    let m = 1;
    if (this.status.has('wovenmail') || this.superActive?.type === 'loomwalker') m *= STRAND.woven.cut;
    if (this.status.has('weavewalk')) m *= AT.weavewalk.cut;
    if (this.frag.has('chains')) {
      const near = [...objs.values()].some((c) => c.kind === 'crystal' && c.pos.distanceTo(this.pos) < FT.chains.r)
        || enemiesNear(this.pos, FT.chains.r).some((e) => e.status.has('frozen'));
      if (near) m *= FT.chains.cut;
    }
    return m;
  },
  darkWeaponMult() { return this.status.has('hedrons') ? FT.hedrons.dmg : 1; },
  /**
   * Extra dealDamage options for a weapon hit: Unraveling, Chilling and Severing Rounds, Banner of War,
   * Chill Clip, Slice and Whisper of Impairment (H23). `w`, `e`, `crit` may be missing (old callers).
   */
  darkDeal(w, e, crit) {
    const o = {};
    if (this.status.has('unraveling')) o.unravel = STRAND.unravel.t;
    if (!e) return o.unravel ? o : null;
    if (this.status.has('severing') || (this.asp.has('bannerofwar') && this.status.has('banner'))) o.sever = STRAND.sever.t;
    if (w?.has?.('slice')) {
      const r = sliceHit(e.sliceHits?.[w.idx] || [], G.time);
      (e.sliceHits ||= {})[w.idx] = r.times;
      if (r.sever) o.sever = STRAND.sever.t;
    }
    if (G.time >= (e.chillAt ?? -9)) {
      const n = weaponChill({ chillclip: !!w?.has?.('chillclip'), chilling: this.status.has('chilling'), impairment: this.frag.has('impairment'), slowed: e.status.has('slow'), frozen: e.status.has('frozen'), crit });
      if (n) { o.slowAdd = n; o.freezeMult = this.freezeMult(); e.chillAt = G.time + DARK_PERKS.chillclip.gap; }
    }
    return Object.keys(o).length ? o : null;
  },
  darkWeaponHit() {
    if (this.frag.has('generation')) this.giveEnergy('grenade', FT.generation);
  },
  /** H23: weapon kill effects from Darkness perks and fragments. */
  darkWeaponKill(w, e, crit) {
    const c = e.center(new THREE.Vector3());
    if (crit && w.has('headstone')) raiseCrystal(e.pos.clone(), DARK_PERKS.headstone.size);
    if (crit && w.has('hatchling')) this.threadlings(c, DARK_PERKS.hatchling.n);
    if (this.frag.has('frostbite')) for (const x of enemiesNear(c, FT.frostbite.r, 8, e)) if (!x.status.has('frozen')) dealDamage(x, 10, { ...this.stasisO(FT.frostbite.stacks), source: 'ability', pos: x.center(new THREE.Vector3()), companion: true });
    if (this.frag.has('isolation')) {
      castFx('darkslam', { p: e.pos.clone(), el: 'strand', r: FT.isolation.r });
      for (const x of enemiesNear(c, FT.isolation.r, 8, e)) dealDamage(x, 10, { element: 'strand', source: 'ability', pos: x.center(new THREE.Vector3()), sever: STRAND.sever.t, companion: true });
    }
    if (crit && this.frag.has('snaring') && (e.status.has('sever') || e.status.has('unravel'))) {
      castFx('darkslam', { p: e.pos.clone(), el: 'strand', r: FT.snaring.r });
      for (const x of enemiesNear(c, FT.snaring.r, 8, e)) dealDamage(x, 10, { element: 'strand', source: 'ability', pos: x.center(new THREE.Vector3()), suspend: this.suspendMult(), companion: true });
    }
  },

  // ---- per frame ----
  darkTick(dt) {
    if (this.grapple) { // Grapple: pulled along the line to where it landed
      const g = this.grapple;
      g.t -= dt;
      const d = g.to.clone().sub(this.pos);
      if (d.length() < 1.5 || g.t <= 0) { this.grapple = null; this.vel.multiplyScalar(0.4); }
      else { this.vel.copy(d.normalize().multiplyScalar(26)); this.onGround = false; if (Math.random() < 0.6) tracer(this.eye, g.to, SD, 0.02, 0.05); }
    }
    if (this.asp.has('cryoclasm') && this.sprinting) {
      let hit = false;
      for (const c of [...objs.values()]) if (c.local && c.kind === 'crystal' && Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z) < AT.cryoclasm.r) { breakObj(c); hit = true; }
      for (const e of enemiesNear(this.pos, AT.cryoclasm.r)) if (e.status.has('frozen')) { dealDamage(e, 40, { element: 'stasis', source: 'melee', pos: e.center(new THREE.Vector3()) }); hit = true; }
      if (hit) this.status.apply('cryoclasm', { set: true });
    }
    if (this.status.has('banner')) this.healPct(AT.bannerofwar.heal * dt); // Banner of War: a slow heal
    if (this.darkLand && this.onGround) { const f = this.darkLand; this.darkLand = null; f(); }
  },

  // ---- grenades ----
  /** Q while sprinting with Weavewalk: wrap yourself instead of throwing. Returns true if it replaced the throw. */
  darkGrenadeUse() {
    if (!(this.asp.has('weavewalk') && this.sprinting) || this.cd.grenade > 0) return false;
    this.cd.grenade = this.cdMax.grenade;
    this.status.apply('weavewalk', { set: true });
    castFx('darkslam', { p: this.pos.clone(), el: 'strand', r: 2.5 });
    sfx.ability('strand');
    return true;
  },
  darkOnGrenade() { if (this.frag.has('ascent')) this.status.apply('ascent', { set: true }); },
  isDarkGrenade(g) { return DARK_GRENADE_KINDS.has(g.kind); },
  darkGrenade(g, pt, hitEnemy) {
    pt.y = Math.max(pt.y, 0.3);
    const fy = floorBelow(pt.x, pt.z, pt.y + 0.6); // H24: the floor under the impact (was y = 0, so effects sank into raised floors)
    const id = g.kind, tw = this.asp.has('touchwinter'), ms = this.asp.has('mindspun');
    if (STASIS_GRENADES.has(id) && this.asp.has('bleakwatcher')) { castFx('bleak', { p: pt.clone().setY(fy), life: AT.bleakwatcher.life }); return; }
    if (this.asp.has('wanderer') && hitEnemy?.alive && g.element === 'strand') {
      for (const e of enemiesNear(hitEnemy.center(new THREE.Vector3()), AT.wanderer.r)) dealDamage(e, 90, { element: 'strand', source: 'ability', pos: e.center(new THREE.Vector3()), suspend: this.suspendMult() });
    }
    if (id === 'glacier') {
      const fwd = this.getForward(new THREE.Vector3()).setY(0).normalize(), side = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const n = tw ? 7 : 5;
      for (let i = 0; i < n; i++) raiseCrystal(pt.clone().addScaledVector(side, (i - (n - 1) / 2) * 1.4).addScaledVector(fwd, (i % 2) * 0.6));
      castFx('darkslam', { p: pt.clone().setY(fy + 0.1), el: 'stasis', r: 4 });
    } else if (id === 'duskfield') {
      castFx('duskfield', { p: pt.clone().setY(fy), r: tw ? 6 : 4.5, life: 6, fm: this.freezeMult() });
    } else if (id === 'coldsnap') {
      this.coldsnap(pt, tw ? 3 : 1);
    } else if (id === 'grapple') {
      this.grapple = { to: pt.clone().setY(pt.y + 1.2), t: 0.9 };
      this.status.apply('grapplemelee', { set: true });
      if (ms) dropTangle(pt);
      if (this.asp.has('widowssilk')) { this.cd.grenade *= 0.5; this.status.apply('severing', { t: AT.widowssilk.rounds, set: true }); } // H23: Severing Rounds
    } else if (id === 'shackle') {
      const r = ms ? 6.5 : 4.5;
      castFx('darkslam', { p: pt.clone(), el: 'strand', r });
      this._mindspunHit = ms;
      for (const e of enemiesNear(pt, r)) dealDamage(e, 120, { element: 'strand', source: 'ability', pos: e.center(new THREE.Vector3()), suspend: this.suspendMult() });
      this._mindspunHit = false;
    } else if (id === 'threadling') {
      glowBurst(pt, SD, 14, 5, 0.08, 0.5);
      this.threadlings(pt.clone(), ms ? 5 : 3);
    }
  },
  /** Coldsnap: a seeker runs along the ground to the nearest enemy, freezes it, then seeks `more` others. */
  coldsnap(from, more, skip = null) {
    const tgt = enemiesNear(from, 20, 4).find((e) => e !== skip && !e.status.has('frozen')) || null;
    spawnPlayerProjectile({
      kind: 'swarm', pos: from.clone().setY(Math.max(0.35, from.y)), vel: new THREE.Vector3(0, 0, 0).add(tgt ? tgt.pos.clone().sub(from).setY(0).normalize().multiplyScalar(14) : this.getForward(new THREE.Vector3()).setY(0).normalize().multiplyScalar(14)),
      gravity: 0, size: 0.14, color: ST, life: 2.5, target: tgt, turn: 6,
      onHit: (p, e) => {
        shatterFx(p, 0.6);
        if (e && e.alive) {
          dealDamage(e, 140, { element: 'stasis', source: 'ability', pos: p.clone(), freeze: this.freezeMult() });
          if (more > 0) this.coldsnap(p.clone(), more - 1, e);
        }
      },
    });
  },

  // ---- melees ----
  isDarkMelee(id) { return DARK_MELEES.has(id) || this.status.has('grapplemelee'); },
  darkMelee(id, fwd) {
    const c = new THREE.Vector3();
    if (this.status.has('grapplemelee')) { // Grapple Melee: suspends enemies around the target
      this.status.remove('grapplemelee');
      const t = this.findMeleeTarget(6, 0.5);
      const at = t ? t.center(c) : this.pos.clone().addScaledVector(fwd, 2).setY(this.pos.y + 1);
      castFx('darkslam', { p: at.clone(), el: 'strand', r: 4 });
      for (const e of enemiesNear(at, 4)) dealDamage(e, 300, { element: 'strand', source: 'melee', pos: e.center(new THREE.Vector3()), suspend: this.suspendMult() });
      this.throwFist(0.3, true);
      return;
    }
    if (id === 'shiver') {
      if (this.asp.has('howlstorm') && this.sprinting) this.crystalWave(fwd);
      this.lungeStrike(6, (t, at) => {
        dealDamage(t, 260, { ...this.stasisO(3), source: 'melee', pos: at.clone(), knock: fwd.clone().setY(0).normalize().multiplyScalar(8) });
        for (const e of enemiesNear(at, 4, 8, t)) dealDamage(e, 60, { ...this.stasisO(2), source: 'melee', pos: e.center(new THREE.Vector3()) });
        castFx('darkslam', { p: at.clone(), el: 'stasis', r: 4 });
      });
      return;
    }
    if (id === 'frenzied') {
      const n = this.asp.has('flechette') ? AT.flechette.dashes : 1;
      let k = 0, gap = 0;
      const self = this;
      const strike = () => self.lungeStrike(7, (t, at) => {
        dealDamage(t, 240, { element: 'strand', source: 'melee', pos: at.clone(), sever: STRAND.sever.t });
        for (const e of enemiesNear(at, 2.5, 6, t)) dealDamage(e, 90, { element: 'strand', source: 'melee', pos: e.center(new THREE.Vector3()), sever: STRAND.sever.t });
        castFx('threads', { pts: [self.eye.clone(), at.clone()] });
      }, true);
      strike(); k++;
      if (n > 1) addTicker({ update(dt) { gap += dt; if (gap >= 0.28) { gap = 0; strike(); k++; } return k < n; } });
      return;
    }
    this.throwFist(0.3);
    const start = this.eye.clone().addScaledVector(fwd, 0.6);
    sfx.throw(this.cls.element);
    if (id === 'withering') { // two seeking kunai
      const targets = enemiesNear(this.pos.clone().addScaledVector(fwd, 8), 16, 2);
      for (let i = 0; i < 2; i++) {
        const v = fwd.clone().multiplyScalar(40).add(new THREE.Vector3(-fwd.z * (i ? 3 : -3), 1, fwd.x * (i ? 3 : -3)));
        spawnPlayerProjectile({ kind: 'knife', pos: start.clone(), vel: v, gravity: 2, size: 0.09, color: ST, life: 1.4, target: targets[i] || targets[0] || null, turn: 5,
          onHit: (p, e) => { if (e && e.alive) dealDamage(e, 150, { ...this.stasisO(2), source: 'melee', pos: p.clone() }); sparks(p, ST, 8, 4, 0.06, 0.3); } });
      }
    } else if (id === 'penumbral') { // a Stasis burst from the staff
      spawnPlayerProjectile({ kind: 'drain', pos: start, vel: fwd.clone().multiplyScalar(38), gravity: 0, size: 0.16, color: ST, life: 1.0,
        onHit: (p, e) => {
          if (e && e.alive) dealDamage(e, 220, { ...this.stasisO(3, { freeze: this.freezeMult() }), source: 'melee', pos: p.clone() }); // H24: a direct hit freezes (bosses only slow)
          for (const x of enemiesNear(p, 3, 8, e)) dealDamage(x, 50, { ...this.stasisO(2), source: 'melee', pos: x.center(new THREE.Vector3()) });
          shatterFx(p, 0.7);
        } });
    } else if (id === 'spike') { // ricochets through up to three enemies, then comes home
      this.spikeHop(start, fwd.clone().multiplyScalar(42), 3, []);
    } else if (id === 'needle') { // three homing needles that unravel
      const targets = enemiesNear(this.pos.clone().addScaledVector(fwd, 8), 18, 3);
      for (let i = 0; i < 3; i++) {
        const v = fwd.clone().multiplyScalar(36).add(new THREE.Vector3((i - 1) * 3, 1.5, (i - 1) * -1));
        spawnPlayerProjectile({ kind: 'knife', pos: start.clone(), vel: v, gravity: 0, size: 0.06, color: SD, life: 1.5, target: targets[i] || targets[0] || null, turn: 6,
          onHit: (p, e) => { if (e && e.alive) dealDamage(e, 95, { element: 'strand', source: 'melee', pos: p.clone(), unravel: STRAND.unravel.t }); sparks(p, SD, 6, 3, 0.05, 0.3); } });
      }
    }
  },
  /** Lunge to the nearest enemy in front within `range` and run onHit(target, point). No target: a short dash. */
  lungeStrike(range, onHit, dash = false) {
    const t = this.findMeleeTarget(range, 0.55);
    this.throwFist(0.3, true);
    const fwd = this.getForward(new THREE.Vector3()).setY(0).normalize();
    if (!t) { if (dash) { this.dashDir.copy(fwd); this.dash = 0.18; this.dashSpeed = 24; } return; }
    const at = t.center(new THREE.Vector3());
    const dir = at.clone().sub(this.pos).setY(0);
    const dist = dir.length();
    dir.normalize();
    if (dist > 1.6) this.pos.addScaledVector(dir, Math.max(0, dist - t.radius - 1.0));
    onHit(t, at);
    this.shake = Math.max(this.shake, 0.12);
  },
  spikeHop(from, vel, left, hit) {
    spawnPlayerProjectile({ kind: 'knife', pos: from.clone(), vel, gravity: 0, size: 0.1, color: SD, life: 1.0, target: null,
      onHit: (p, e) => {
        sparks(p, SD, 8, 4, 0.06, 0.3);
        if (e && e.alive) { dealDamage(e, 200, { element: 'strand', source: 'melee', pos: p.clone(), sever: STRAND.sever.t }); hit.push(e); }
        const next = left > 1 ? enemiesNear(p, 12, 6).find((x) => !hit.includes(x)) : null;
        if (next) this.spikeHop(p, next.center(new THREE.Vector3()).sub(p).normalize().multiplyScalar(42), left - 1, hit);
        else { this.giveEnergy('melee', 0.3 * hit.length); castFx('line', { a: p, b: this.eye.clone(), el: 'strand' }); } // the spike returns: melee energy per enemy struck
      } });
  },
  /** Howl of the Storm: a line of crystals rolling forward. */
  crystalWave(fwd) {
    const A = AT.howlstorm, f = fwd.clone().setY(0).normalize(), base = this.pos.clone();
    let i = 0, t = 0;
    const self = this;
    addTicker({ update(dt) {
      t -= dt;
      if (t > 0) return true;
      t = 0.08; i++;
      const p = base.clone().addScaledVector(f, i * A.step + 1).setY(0);
      raiseCrystal(p, 0.9);
      for (const e of enemiesNear(p, A.r)) dealDamage(e, A.dmg, { element: 'stasis', source: 'melee', pos: e.center(new THREE.Vector3()), freeze: self.freezeMult() });
      return i < A.n;
    } });
  },
  /** Diamond Lance: B or left-click (H24) throws the lance; it freezes enemies where it lands. Returns true if it replaced the quick melee. */
  darkBasicMelee() {
    if (!this.status.has('diamondlance')) return false;
    this.status.remove('diamondlance');
    const fwd = this.aimForward(new THREE.Vector3()), A = AT.diamondlance; // H24: at the crosshair (it is thrown in third person)
    this.throwFist(0.32);
    spawnPlayerProjectile({ kind: 'hammer', pos: this.eye.clone().addScaledVector(fwd, 0.6), vel: fwd.clone().multiplyScalar(36).add(new THREE.Vector3(0, 2, 0)), gravity: 12, size: 0.16, color: ST, life: 2,
      onHit: (p) => {
        castFx('darkslam', { p: p.clone(), el: 'stasis', r: A.r });
        for (const e of enemiesNear(p, A.r)) dealDamage(e, A.dmg, { element: 'stasis', source: 'melee', pos: e.center(new THREE.Vector3()), freeze: this.freezeMult() });
      } });
    sfx.throw('stasis');
    return true;
  },

  // ---- class abilities (after useClass / dodge) ----
  darkOnClass(id, airborne) {
    const A = this.asp;
    if ((id === 'rift' || id === 'empower') && A.has('frostpulse')) {
      castFx('darkslam', { p: this.pos.clone(), el: 'stasis', r: AT.frostpulse.r });
      for (const e of enemiesNear(this.pos, AT.frostpulse.r)) dealDamage(e, 60, { element: 'stasis', source: 'ability', pos: e.center(new THREE.Vector3()), freeze: this.freezeMult() });
      this.status.apply('chilling', { t: AT.frostpulse.rounds, set: true }); // H23: Chilling Rounds
    }
    if ((id === 'rift' || id === 'empower') && A.has('weaverscall')) this.threadlings(this.pos.clone(), AT.weaverscall.n); // H24: from your feet, not your perched ones' spot
    if ((id === 'barricade' || id === 'rally') && A.has('drengrslash')) {
      const D = AT.drengrslash, f = this.getForward(new THREE.Vector3()).setY(0).normalize();
      for (let i = 1; i <= D.n; i++) {
        const p = this.pos.clone().addScaledVector(f, i * D.step).setY(this.pos.y + 0.5);
        for (const e of enemiesNear(p, D.r)) dealDamage(e, D.dmg, { element: 'strand', source: 'ability', pos: e.center(new THREE.Vector3()), suspend: this.suspendMult() });
      }
      castFx('threads', { pts: [this.pos.clone().setY(this.pos.y + 0.5), this.pos.clone().addScaledVector(f, D.n * D.step).setY(this.pos.y + 0.5)] });
    }
    if (id !== 'marksman' && id !== 'gambler') return;
    if (A.has('wintersshroud')) {
      castFx('darkslam', { p: this.pos.clone(), el: 'stasis', r: AT.wintersshroud.r });
      for (const e of enemiesNear(this.pos, AT.wintersshroud.r)) dealDamage(e, 20, { ...this.stasisO(AT.wintersshroud.stacks), source: 'ability', pos: e.center(new THREE.Vector3()) });
      this.status.apply('chilling', { t: AT.wintersshroud.rounds, set: true }); // H23: Chilling Rounds
    }
    if (A.has('threadedspecter')) castFx('decoy', { p: this.pos.clone().setY(0), life: AT.threadedspecter.life });
    if (airborne && (A.has('shatterdive') || A.has('ensnaring'))) {
      // dive to the ground; the burst goes off on landing
      this.dash = 0; this.vel.set(this.vel.x * 0.3, -(A.has('shatterdive') ? AT.shatterdive.speed : AT.ensnaring.speed), this.vel.z * 0.3);
      const stasis = A.has('shatterdive');
      this.darkLand = () => {
        const p = this.pos.clone();
        if (stasis) {
          castFx('darkslam', { p, el: 'stasis', r: AT.shatterdive.r });
          darkSplash(p, AT.shatterdive.r);
          for (const e of enemiesNear(p, AT.shatterdive.r)) dealDamage(e, AT.shatterdive.dmg, { element: 'stasis', source: 'ability', pos: e.center(new THREE.Vector3()) });
        } else {
          castFx('darkslam', { p, el: 'strand', r: AT.ensnaring.r });
          for (const e of enemiesNear(p, AT.ensnaring.r)) dealDamage(e, AT.ensnaring.dmg, { element: 'strand', source: 'ability', pos: e.center(new THREE.Vector3()), suspend: this.suspendMult() });
        }
        this.shake = 0.3;
      };
    }
  },

  // ---- events from the enemy side ----
  darkOnFreeze() {
    if (this.frag.has('bonds')) this.giveSuper(FT.bonds);
    if (this.frag.has('hedrons')) this.status.apply('hedrons', { set: true });
    if (this.asp.has('glacialharvest') && G.time - (this.gharvestAt || -9) >= AT.glacialharvest.gap) {
      this.gharvestAt = G.time;
      for (const k of ['grenade', 'melee', 'class']) this.giveEnergy(k, AT.glacialharvest.energy);
    }
  },
  darkOnShatter(at, crystal) {
    if (this.frag.has('rime')) this.addOvershield(FT.rime, 5);
    if (this.frag.has('shards')) this.giveEnergy('grenade', FT.shards);
    if (this.asp.has('diamondlance')) this.status.apply('diamondlance', { set: true });
    if (crystal && this.asp.has('tectonic')) {
      this.giveEnergy('grenade', AT.tectonic.grenade); this.giveEnergy('melee', AT.tectonic.melee);
      for (const e of enemiesNear(at, AT.tectonic.r)) if (!e.status.has('frozen')) dealDamage(e, 10, { ...this.stasisO(AT.tectonic.stacks), source: 'ability', pos: e.center(new THREE.Vector3()), companion: true }); // H23
    }
    if (!crystal && this.asp.has('iceflare')) {
      const I = AT.iceflare;
      let hits = 0;
      for (const tgt of enemiesNear(at, I.r, I.n + 1)) { // H24: hitscan bolts (were seekers) at enemies in sight of the shatter
        const c = tgt.center(new THREE.Vector3());
        if (c.distanceTo(at) < 0.5 || !hasLOS(at, c)) continue;
        castFx('line', { a: at.clone(), b: c.clone(), el: 'stasis', w: 0.05, life: 0.25 });
        dealDamage(tgt, I.dmg, { ...this.stasisO(2), source: 'ability', pos: c.clone(), companion: true });
        sparks(c, ST, 6, 3, 0.05, 0.3);
        if (++hits >= I.n) break;
      }
    }
  },
  darkOnSever() { if (this.frag.has('fury') && G.time - (this.furyAt || -9) > 0.5) { this.furyAt = G.time; this.giveEnergy('melee', FT.fury); } },
  darkOnKill(e, o) {
    if (o.jolted || o.companion || o.thread) return;
    const ability = o.source === 'ability' || o.source === 'melee' || o.source === 'super';
    const slowed = e.status.has('slow') || e.status.has('frozen');
    if (this.asp.has('grimharvest') && slowed) for (const k of ['grenade', 'melee', 'class']) this.giveEnergy(k, AT.grimharvest.energy);
    if (this.frag.has('hunger') && ability && o.element === 'stasis') this.giveEnergy('melee', FT.hunger);
    if (this.asp.has('intothefray') && ability && o.element === 'strand') this.status.apply('wovenmail', { t: AT.intothefray.t, set: true });
    if (this.frag.has('warding') && e.status.has('suspend')) this.status.apply('wovenmail', { t: FT.warding, set: true });
    if (this.frag.has('wisdom') && e.status.has('unravel')) this.giveSuper(FT.wisdom);
    if (this.frag.has('rebirth') && (e.status.has('sever') || e.status.has('unravel'))) this.threadlings(e.center(new THREE.Vector3()), FT.rebirth);
    if (this.asp.has('bannerofwar') && o.source === 'melee') { this.status.apply('banner', { t: AT.bannerofwar.t, set: true }); }
    if (this.frag.has('propagation') && o.source === 'melee' && this.meleeT > 0) this.status.apply('unraveling', { t: FT.propagation, set: true });
    if (this.superActive?.type === 'loomwalker') this.threadlings(e.center(new THREE.Vector3()), 1);
    // Strand ability and super kills by a Strand Guardian sometimes leave a tangle
    if (this.cls.element === 'strand' && ability && o.element === 'strand' && Math.random() < 0.35) dropTangle(e.pos.clone(), this.asp.has('widowssilk') ? 2 : 1);
  },

  // ---- supers ----
  isDarkSuper(type) { return DARK_SUPERS.has(type); },
  updateDarkSuper(S, dt, fwd, hand) {
    if (!DARK_SUPERS.has(S.type)) return;
    const inp = G.input, T = SUPER_TUNE[S.type], flat = fwd.clone().setY(0).normalize();
    const el = this.cls.element, col = el === 'stasis' ? ST : SD;
    if (Math.random() < 0.4) ember(hand, Math.random() < 0.5 ? col : (el === 'stasis' ? ST_CORE : SD_CORE), 0.04, 0.4, 0.3);
    const L = inp.mouse.leftPressed && S.cd <= 0, R = inp.mouse.rightPressed && S.cd <= 0;
    const cone = (range, dot = 0.5) => G.enemies.filter((e) => e.alive && e.center(_v).distanceTo(this.eye) < range + e.radius && _v.clone().sub(this.eye).normalize().dot(fwd) > dot);
    switch (S.type) {
      // ---------- roaming ----------
      case 'glacialquake':
        // H24: walking or sprinting into one of your crystals during the super shatters it
        for (const c of [...objs.values()]) if (c.local && c.kind === 'crystal' && Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z) < T.walkR && Math.abs(c.pos.y - this.pos.y) < 2) breakObj(c);
        if (R) {
          S.cd = T.heavyCd;
          castFx('darkslam', { p: this.pos.clone(), el, r: T.heavyR });
          darkSplash(this.pos, T.heavyR);
          for (const e of enemiesNear(this.pos, T.heavyR)) dealDamage(e, superDmg(T.heavy), { element: 'stasis', source: 'super', pos: e.center(new THREE.Vector3()) });
          this.throwFist(0.4, true); this.shake = 0.35; sfx.explosion(5);
        } else if (L) {
          S.cd = T.slamCd;
          const p = this.pos.clone().addScaledVector(flat, 2.4);
          castFx('darkslam', { p: p.clone().setY(this.pos.y + 0.2), el, r: T.slamR });
          const side = new THREE.Vector3(-flat.z, 0, flat.x), at = p.clone().addScaledVector(flat, 1.5).setY(this.pos.y); // H24: a cluster of crystals (was one)
          for (let i = 0; i < T.crystals; i++) raiseCrystal(at.clone().addScaledVector(side, (i % 2 ? 1 : -1) * (0.55 + 0.25 * (i >> 1))).addScaledVector(flat, (i >> 1) * 1.1 + (Math.random() - 0.5) * 0.3), 0.8 + Math.random() * 0.35);
          for (const e of enemiesNear(p.setY(this.pos.y + 1), T.slamR)) dealDamage(e, superDmg(T.slam), { ...this.stasisO(T.stacks), source: 'super', pos: e.center(new THREE.Vector3()) });
          this.throwFist(0.3, true); this.shake = 0.2; sfx.melee(el);
        }
        break;
      case 'bladefury': case 'rimeblades': {
        if (R) {
          S.cd = T.throwCd;
          spawnPlayerProjectile({ kind: 'knife', pos: this.eye.clone().addScaledVector(fwd, 0.6), vel: fwd.clone().multiplyScalar(40), gravity: 2, size: 0.18, color: col, life: 1.5,
            onHit: (p) => {
              castFx('darkslam', { p: p.clone(), el, r: T.throwR });
              for (const e of enemiesNear(p, T.throwR)) dealDamage(e, superDmg(T.throw), el === 'stasis' ? { element: 'stasis', source: 'super', pos: e.center(new THREE.Vector3()), freeze: this.freezeMult() } : { element: 'strand', source: 'super', pos: e.center(new THREE.Vector3()), suspend: this.suspendMult() });
            } });
          this.throwFist(0.3); sfx.throw(el);
        } else if (L) {
          S.cd = T.slashCd; S.combo = (S.combo % 3) + 1;
          const c = this.pos.clone().addScaledVector(flat, 1.8).setY(this.pos.y + 1);
          const third = S.combo === 3;
          for (const e of enemiesNear(c, T.slashR)) {
            const o = el === 'stasis' ? (third ? { element: 'stasis', freeze: this.freezeMult() } : this.stasisO(T.stacks)) : { element: 'strand', sever: T.sever };
            dealDamage(e, superDmg(T.slash) * (third ? 1.3 : 1), { ...o, source: 'super', pos: e.center(new THREE.Vector3()), knock: flat.clone().multiplyScalar(4) });
          }
          castFx('darkslam', { p: c, el, r: T.slashR * 0.8 });
          this.throwFist(0.2, true); sfx.melee(el);
        }
        break;
      }
      case 'silkstrike':
        if (R) {
          S.cd = T.leapCd;
          this.vel.set(flat.x * 16, 9, flat.z * 16); this.onGround = false;
          this.darkLand = () => {
            castFx('darkslam', { p: this.pos.clone(), el, r: T.leapR });
            for (const e of enemiesNear(this.pos, T.leapR)) dealDamage(e, superDmg(T.leap), { element: 'strand', source: 'super', pos: e.center(new THREE.Vector3()), suspend: this.suspendMult() });
            this.shake = 0.3;
          };
        } else if (L) {
          S.cd = T.whipCd;
          const hits = cone(T.whipRange, 0.6);
          for (const e of hits) dealDamage(e, superDmg(T.whip), { element: 'strand', source: 'super', pos: e.center(new THREE.Vector3()), unravel: STRAND.unravel.t });
          castFx('threads', { pts: [hand.clone(), this.eye.clone().addScaledVector(fwd, T.whipRange), ...hits.slice(0, 3).map((e) => e.center(new THREE.Vector3()))] });
          this.throwFist(0.25); sfx.melee(el);
        }
        break;
      case 'winterswrath':
        if (R) {
          S.cd = T.waveCd;
          const hits = cone(T.waveRange, 0.55);
          for (const c of [...objs.values()]) if (c.local && c.kind === 'crystal' && c.pos.distanceTo(this.pos) < T.waveRange && c.pos.clone().sub(this.eye).normalize().dot(fwd) > 0.5) breakObj(c);
          for (const e of hits) dealDamage(e, superDmg(T.wave), { element: 'stasis', source: 'super', pos: e.center(new THREE.Vector3()) });
          castFx('darkslam', { p: this.pos.clone().addScaledVector(flat, 4), el, r: 6 });
          this.throwFist(0.4, true); this.shake = 0.3; sfx.explosion(4);
        } else if (inp.mouse.left && S.cd <= 0) {
          S.cd = T.shardCd;
          spawnPlayerProjectile({ kind: 'drain', pos: hand.clone(), vel: this.aimForward(new THREE.Vector3()).multiplyScalar(55), gravity: 0, size: 0.12, color: ST, life: 1.2,
            onHit: (p, e) => {
              if (e && e.alive) dealDamage(e, superDmg(T.shard), { ...this.stasisO(T.stacks, { freeze: this.freezeMult() }), source: 'super', pos: p.clone() }); // H24: a direct hit freezes
              for (const x of enemiesNear(p, 1.6, 4, e)) dealDamage(x, superDmg(T.shard) * 0.4, { ...this.stasisO(1), source: 'super', pos: x.center(new THREE.Vector3()) });
              sparks(p, ST, 8, 4, 0.06, 0.3);
            } });
          this.throwFist(0.12);
        }
        break;
      case 'loomwalker':
        S.auraT -= dt;
        if (inp.mouse.left && S.auraT <= 0) {
          S.auraT = T.tick;
          const tgt = cone(T.range, 0.85).sort((a, b) => a.pos.distanceToSquared(this.pos) - b.pos.distanceToSquared(this.pos))[0];
          const end = tgt ? tgt.center(new THREE.Vector3()) : this.eye.clone().addScaledVector(fwd, T.range);
          tracer(hand, end, SD, 0.025, 0.08);
          if (tgt) dealDamage(tgt, superDmg(T.needle), { element: 'strand', source: 'super', pos: end, unravel: STRAND.unravel.t });
        }
        break;
      // ---------- burst: cast once after the caster rises ----------
      default:
        if (S.launched || S.slam || S.age < 0.35) break; // H25: a slamming super (Avalanche) casts on landing instead
        S.launched = true;
        this.darkBurst(S.type, T, fwd, flat, hand);
    }
  },
  darkBurst(type, T, fwd, flat, hand) {
    const self = this, el = this.cls.element;
    const later = (delay, f) => { let t = delay; addTicker({ update(dt) { t -= dt; if (t > 0) return true; f(); return false; } }); };
    this.shake = 0.4;
    if (type === 'avalanche' || type === 'absolutezero') {
      const p = this.pos.clone();
      castFx('darkslam', { p, el: 'stasis', r: T.r });
      if (type === 'avalanche') for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; raiseCrystal(p.clone().add(new THREE.Vector3(Math.cos(a) * T.r * 0.6, 0, Math.sin(a) * T.r * 0.6)), 1.4); }
      for (const e of enemiesNear(p, T.r)) dealDamage(e, superDmg(T.dmg), { element: 'stasis', source: 'super', pos: e.center(new THREE.Vector3()), freeze: this.freezeMult() });
      sfx.explosion(6);
      later(T.delay, () => {
        castFx('shatter', { p: p.clone().setY(p.y + 1), k: 3 });
        darkSplash(p, T.r);
        for (const e of enemiesNear(p, T.r)) dealDamage(e, superDmg(T.shatter), { element: 'stasis', source: 'super', pos: e.center(new THREE.Vector3()) });
        sfx.explosion(7);
      });
      return;
    }
    if (type === 'needlestorm') {
      const at = this.aimPoint(30);
      for (let i = 0; i < 18; i++) later(i * 0.03, () => castFx('line', { a: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * T.r * 1.6, 9, (Math.random() - 0.5) * T.r * 1.6)), b: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * T.r * 1.6, 0, (Math.random() - 0.5) * T.r * 1.6)), el: 'strand', w: 0.05, life: 0.3 }));
      later(0.5, () => {
        castFx('darkslam', { p: at, el: 'strand', r: T.r });
        for (const e of enemiesNear(at, T.r)) dealDamage(e, superDmg(T.dmg), { element: 'strand', source: 'super', pos: e.center(new THREE.Vector3()), unravel: STRAND.unravel.t });
        self.threadlings(at.clone().setY(at.y + 0.5), T.threadlings);
      });
      return;
    }
    // thrown supers: Silence and Squall (two kama), Ripcord (anchor), Cat's Cradle (spool)
    // lobbed onto the point under the crosshair (offset sideways for the second kama)
    const target = this.aimPoint(32);
    const lob = (off = 0) => {
      const from = this.eye.clone().addScaledVector(fwd, 0.6), to = target.clone().addScaledVector(new THREE.Vector3(-flat.z, 0, flat.x), off);
      const t = Math.max(0.35, Math.min(1.1, from.distanceTo(to) / 26)), gr = 14;
      return new THREE.Vector3((to.x - from.x) / t, (to.y - from.y) / t + 0.5 * gr * t, (to.z - from.z) / t);
    };
    const throwIt = (vel, color, onLand) => spawnPlayerProjectile({ kind: 'hammer', pos: this.eye.clone().addScaledVector(fwd, 0.6), vel, gravity: 14, size: 0.22, color, life: 3, onHit: (p) => onLand(p.setY(Math.max(0.3, p.y))) });
    if (type === 'silencesquall') {
      throwIt(lob(-1.5), ST, (p) => { // Silence
        castFx('darkslam', { p, el: 'stasis', r: T.silenceR });
        for (const e of enemiesNear(p, T.silenceR)) dealDamage(e, superDmg(T.silence), { element: 'stasis', source: 'super', pos: e.center(new THREE.Vector3()), freeze: this.freezeMult() });
        later(1.2, () => { for (const e of enemiesNear(p, T.silenceR + 1)) if (e.status.has('frozen')) dealDamage(e, superDmg(T.shatter), { element: 'stasis', source: 'super', pos: e.center(new THREE.Vector3()) }); });
      });
      throwIt(lob(1.5), ST, (p) => castFx('squall', { p: p.setY(0), life: T.life })); // Squall
      sfx.throw('stasis');
      return;
    }
    if (type === 'ripcord' || type === 'cradle') {
      throwIt(lob(), SD, (p) => {
        castFx('darkslam', { p, el: 'strand', r: T.r });
        const caught = enemiesNear(p, T.r);
        for (const e of caught) dealDamage(e, 40, { element: 'strand', source: 'super', pos: e.center(new THREE.Vector3()), suspend: 2, unravel: type === 'cradle' ? STRAND.unravel.t : 0 });
        castFx('threads', { pts: [p.clone().setY(p.y + 1), ...caught.slice(0, 8).map((e) => e.center(new THREE.Vector3()))] });
        if (type === 'ripcord') for (const e of caught) if (!e.isBoss) e.knock.add(p.clone().sub(e.pos).setY(0).multiplyScalar(2.2));
        later(type === 'ripcord' ? T.pull : T.delay, () => {
          castFx('darkslam', { p, el: 'strand', r: T.r * 0.8 });
          for (const e of enemiesNear(p, T.r + 1)) dealDamage(e, superDmg(T.dmg), { element: 'strand', source: 'super', pos: e.center(new THREE.Vector3()) });
          sfx.explosion(6);
        });
      });
      sfx.throw('strand');
    }
  },
  /** Where the crosshair points, up to `range` away (on the ground or the first thing hit). */
  aimPoint(range) {
    const f = this.aimForward(new THREE.Vector3());
    const end = this.eye.clone().addScaledVector(f, range);
    const near = G.enemies.filter((e) => e.alive).map((e) => ({ e, c: e.center(new THREE.Vector3()) })).filter(({ c }) => c.clone().sub(this.eye).normalize().dot(f) > 0.97 && c.distanceTo(this.eye) < range).sort((a, b) => a.c.distanceTo(this.eye) - b.c.distanceTo(this.eye))[0];
    if (near) return near.c.setY(near.e.pos.y);
    if (f.y < -0.05) { const t = (this.eye.y - this.pos.y) / -f.y; if (t < range) return this.eye.clone().addScaledVector(f, t); }
    return end.setY(this.pos.y);
  },
};

export function installDarkness(Player) {
  for (const [k, f] of Object.entries(methods)) {
    if (k in Player.prototype) throw new Error(`installDarkness: Player already has ${k}`);
    Player.prototype[k] = f;
  }
}

// ---- dev and tests ----
export const _dark = { objs, freezeEnemy, DARK_GRENADE_KINDS, DARK_MELEES };
