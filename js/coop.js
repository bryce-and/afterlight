import * as THREE from 'three';
import { G } from './state.js';
import { net, send, broadcast, sendTo } from './net.js';
import { buildCharacter, ghost } from './characters.js';
import { decodeAppearance } from './style.js';
import { UNITS, FACTIONS } from './factions.js';
import { Enemy, fireEnemyShot, spawnEnemyGrenade } from './enemies.js';
import { TIERS } from './tiers.js';
import { tracer, explosionFx, sparks } from './effects.js';
import { replayFx } from './abilities.js';
import { classKit, ARCHETYPES } from './data.js';
import { startMission, startActivity, newSeed, moveArena, placeActChest, missionFailed, abandonMission, damagePlayer, dealDamage, spawnPlayerProjectile, rollDrops, spawnChest, getEnemyByNetId, gainXp, reviveForCompletion } from './game.js';
import { XP } from './progression.js';
import { barrierStops } from './combat.js';
import { playerPower } from './save.js';
import { sfx } from './audio.js';
import { stinger } from './music.js';
import * as ui from './ui.js';

// Glue between the network layer and the game.
//  - Host: runs enemies + mission; sends snapshots (15/s), enemy shots, kills.
//  - Members: mirror enemies as "remote" proxies, send their state + hits.
//  - Everyone rolls their own loot from kill events (client-side loot).

const TYPES = ['grunt', 'rusher', 'captain', 'heavy', 'boss', 'suicide', ...Object.keys(UNITS)]; // U14: unit ids are appended so earlier indices never change
const DEBUFF_BITS = ['weaken', 'slow', 'suppress', 'burn', 'poison', 'jolt', 'blind', 'judged', 'corrosive']; // snapshot bit order
/** Host: an enemy's debuffs as a bitmask. */
const debuffBits = (en) => DEBUFF_BITS.reduce((b, k, i) => (en.status.has(k) ? b | (1 << i) : b), 0);
const r2 = (v) => Math.round(v * 100) / 100;

export const remotes = new Map(); // id -> remote player record
const netEnemies = new Map(); // member side: enemy netId -> proxy
const lastHits = new Map(); // member side: enemy netId -> opts of my last hit
let nextId = 1, sendT = 0, snapT = 0, rosterT = 0;

export function profile() {
  const s = G.save;
  if (!s.settings.name) { s.settings.name = `Guardian${Math.floor(1000 + Math.random() * 9000)}`; }
  return { name: s.settings.name, cls: s.classId, power: playerPower(s) };
}

/** Everyone enemies can target: the local player plus teammates in this mission. */
export function allPlayers() {
  const list = [G.player];
  for (const r of remotes.values()) if (r.inMission) list.push(r);
  return list;
}

export function pickTarget(e) {
  let best = null, bd = Infinity;
  for (const p of allPlayers()) {
    if (!p || p.dead) continue;
    const d = (p.pos.x - e.pos.x) ** 2 + (p.pos.z - e.pos.z) ** 2;
    if ((p.status?.has('invisible') || p.inv) && d > 9) continue; // Vanishing Step
    if (d < bd) { bd = d; best = p; }
  }
  return best || null;
}

// ---------------------------------------------------------------------------
// Mission lifecycle
// ---------------------------------------------------------------------------
export function onMissionStart() {
  for (const r of remotes.values()) { removeAvatar(r); r.inMission = false; }
  netEnemies.clear();
  lastHits.clear();
  nextId = 1; sendT = 0; snapT = 0;
}

export function launchFireteam(li, mi) {
  if (net.isHost) broadcast({ t: 'start', li, mi });
  startMission(li, mi);
}

/** Host: launch an activity (Horde / Endless) for the whole fireteam on a shared arena seed. */
export function launchActivity(actId) {
  const seed = newSeed();
  if (net.isHost) broadcast({ t: 'start', act: actId, seed });
  startActivity(actId, seed);
}

/** The level was rebuilt (activity arena move): avatars and enemy proxies belong to the old scene. */
export function onLevelSwap() {
  for (const r of remotes.values()) removeAvatar(r);
  netEnemies.clear();
  lastHits.clear();
}
export function announceArena(i) { if (net.isHost) broadcast({ t: 'arena', i }); }
export function announceActChest(pos, n, final) { if (net.isHost) broadcast({ t: 'ach', x: r2(pos.x), z: r2(pos.z), n, f: final ? 1 : 0 }); }

// ---------------------------------------------------------------------------
// Downed players and pooled lives (host keeps the count)
// ---------------------------------------------------------------------------
export const DOWN_TIME = 18; // seconds a teammate has to revive you before a life is spent
const REVIVE_TIME = 1.5;

/** Downed too long: ask the host to spend a pooled life on me. */
export function requestLife() {
  if (net.isHost) hostUseLife(net.myId);
  else send({ t: 'life' });
}
function hostUseLife(id) {
  const M = G.mission;
  if (M.lives <= 0) return; // no lives left: only a teammate can bring them back
  M.lives--;
  broadcast({ t: 'lv', n: M.lives });
  ui.feed(`A life was used  ·  ${M.lives} left`, '#ffb36b');
  revivePlayer(id, false);
}
function revivePlayer(id, inPlace) {
  if (id === net.myId) { if (G.player.dead) G.player.respawn(inPlace); }
  else sendTo(id, { t: 'revive', ip: inPlace ? 1 : 0 });
}

/** Per frame (fireteam only): hold E next to a downed teammate to revive them; host checks for a wipe. */
function updateRevives(dt) {
  const P = G.player, M = G.mission;
  // a wipe with no lives left ends the activity, unless it is already complete (boss cache, final cache)
  const complete = ['loot', 'done', 'final'].includes(M.phase);
  if (net.isHost && G.state === 'playing' && !complete && M.lives <= 0 && allPlayers().every((p) => p.dead)) {
    broadcast({ t: 'wipe' });
    missionFailed();
    return;
  }
  let target = null, bd = 2.6;
  if (!P.dead) for (const r of remotes.values()) {
    if (!r.inMission || !r.dead) continue;
    const d = Math.hypot(r.pos.x - P.pos.x, r.pos.z - P.pos.z);
    if (d < bd) { bd = d; target = r; }
  }
  if (!target) {
    if (P.reviveTarget) { P.reviveTarget = null; P.reviveT = 0; ui.prompt(null); }
    return;
  }
  P.reviveTarget = target;
  if (G.input.keys.KeyE) {
    P.reviveT = (P.reviveT || 0) + dt;
    ui.prompt(`Reviving ${target.name}  ${Math.min(100, Math.round((P.reviveT / REVIVE_TIME) * 100))}%`);
    if (P.reviveT >= REVIVE_TIME) {
      P.reviveT = 0;
      if (net.isHost) revivePlayer(target.id, true); else send({ t: 'rev', id: target.id });
      ui.feed(`You revived ${target.name}`, '#7fd8ff');
    }
  } else {
    P.reviveT = 0;
    ui.prompt(`[Hold E]  Revive ${target.name}`);
  }
}

export function onAbandon() {
  if (net.isHost) broadcast({ t: 'end' });
  else if (net.isClient) send({ t: 'leave' });
  for (const r of remotes.values()) { removeAvatar(r); r.inMission = false; }
}

/** Host: give a freshly spawned enemy a network id and announce it. */
export function registerEnemy(e) {
  if (!net.isHost) return;
  e.netId = nextId++;
  broadcast({ t: 'sp', id: e.netId, ty: e.typeId, x: r2(e.pos.x), z: r2(e.pos.z), n: e.name, el: e.shieldEl, mh: Math.round(e.maxHp), ms: Math.round(e.maxShield), bm: e.bossModel || undefined, tr: e.tier || undefined, fc: e.isBoss && FACTIONS[e.faction] ? e.faction : undefined, nd: e.noDrops ? 1 : undefined });
}

export function announceKill(e, o) {
  if (!net.isHost || !e.netId) return;
  broadcast({ t: 'kill', id: e.netId, by: o.by || net.myId, c: o.crit ? 1 : 0 });
}

export function announceBanner(ti, su, du, so) { if (net.isHost) broadcast({ t: 'bn', ti, su, du, so }); }

export function announceLoot(pos) {
  if (net.isHost) broadcast({ t: 'loot', x: r2(pos.x), z: r2(pos.z) });
}

export function announceGrenade(from, vel, dmg, color) {
  if (net.isHost) broadcast({ t: 'gr', f: [r2(from.x), r2(from.y), r2(from.z)], v: [r2(vel.x), r2(vel.y), r2(vel.z)], m: dmg, c: color });
}

export function announceShot(from, dir, speed, dmg, color, size, splash) {
  if (net.isHost) broadcast({ t: 'es', f: [r2(from.x), r2(from.y), r2(from.z)], d: [r2(dir.x * 1000) / 1000, r2(dir.y * 1000) / 1000, r2(dir.z * 1000) / 1000], v: speed, m: dmg, c: color, s: size, sp: splash || 0 });
}

/** Host: an enemy hit a teammate (melee, slam). */
export function damageRemote(r, dmg, from) {
  sendTo(r.id, { t: 'dmg', m: dmg, x: r2(from.x), z: r2(from.z) });
}

/** Member: report a hit on a host-owned enemy. */
export function sendHit(e, dmg, o) {
  lastHits.set(e.netId, { weapon: o.weapon, crit: o.crit, source: o.source });
  send({ t: 'hit', id: e.netId, m: Math.round(dmg * 10) / 10, el: o.element || 'kinetic', c: o.crit ? 1 : 0, src: o.source || 'weapon', wk: o.weaken || 0, sl: o.slow || 0, su: o.suppress || 0, bu: o.burn || 0, po: o.poison || 0, jo: o.jolt || 0, bl: o.blind || 0, jg: o.judged || 0, co: o.corrosive || 0, sb: o.shieldBreaker ? 1 : 0 });
}

export function sendFx(msg) { if (net.active && G.state === 'playing') send(msg); }
export function fxTracer(a, b, color) { if (net.active) sendFx({ t: 'fx', k: 'tr', a: [r2(a.x), r2(a.y), r2(a.z)], b: [r2(b.x), r2(b.y), r2(b.z)], c: color }); }
export function fxProjectile(o) {
  if (!net.active || o.visualOnly) return;
  sendFx({ t: 'fx', k: 'pj', kind: o.kind, p: [r2(o.pos.x), r2(o.pos.y), r2(o.pos.z)], v: [r2(o.vel.x), r2(o.vel.y), r2(o.vel.z)], g: o.gravity || 0, s: o.size, c: o.color, l: o.life });
}

// ---------------------------------------------------------------------------
// Per-frame
// ---------------------------------------------------------------------------
function myState() {
  const P = G.player;
  const wi = P.weapon.item;
  return {
    id: net.myId, n: G.save.settings.name, c: G.save.classId, sc: P.cls.subclassId, lk: P.lookCode,
    x: r2(P.pos.x), y: r2(P.pos.y), z: r2(P.pos.z), yw: r2(P.yaw), pt: r2(P.pitch), d: P.dead ? 1 : 0, h: r2(P.health / P.maxHealth), iv: P.status.has('invisible') ? 1 : 0,
    // animation: sprinting, airborne, firing, and the gun in hand
    s: P.sprinting ? 1 : 0, a: P.onGround ? 0 : 1, f: G.time - P.lastFire < 0.15 ? 1 : 0, pu: P.punchT > 0 ? r2(1 - P.punchT / P.punchMax) : 0, sp: P.tpsProp || '', gd: P.superActive?.guard ? 1 : 0, gv: P.shieldHex || 0, po: P.superPose || '', hv: P.superHover ? 1 : 0, gh: P.guardHits, w: (P.superActive && !P.keepsGuns) || P.holdingAxe ? '' : `${wi.arch}|${wi.rarity}|${wi.element}|${wi.rarity === 'exotic' ? wi.name : ''}`,
  };
}

export function netTick(dt) {
  if (!net.active || !G.mission) return;
  updateRevives(dt);
  if (G.state !== 'playing') return;
  sendT -= dt; snapT -= dt; rosterT -= dt;
  if (net.isClient && sendT <= 0) { sendT = 0.05; send({ t: 'p', ...myState() }); }
  if (net.isHost && snapT <= 0) {
    snapT = 1 / 15;
    const e = [];
    for (const en of G.enemies) if (en.alive && en.netId) e.push([en.netId, TYPES.indexOf(en.typeId), r2(en.pos.x), r2(en.pos.z), r2(en.yaw), Math.round((en.hp / en.maxHp) * 1000), en.maxShield ? Math.round((en.shield / en.maxShield) * 1000) : 0, debuffBits(en), Math.round(en.staggerT * 100), r2(en.pos.y), (en.cmWind > 0 || en.cmSwing > 0 ? 1 : 0) | (en.fuse > 0 ? 2 : 0) | (en.enraged ? 4 : 0) | (en.jet && en.jet.s !== 'ground' && en.jet.s !== 'crouch' ? 8 : 0)]);
    const M = G.mission;
    const z = M.zones[M.current];
    const ms = { cur: M.current, zs: z ? z.state : 'cleared', obj: M.phase === 'loot' || M.phase === 'done' ? 'Open the cache' : M.objective, wp: M.waypoint ? [r2(M.waypoint.x), r2(M.waypoint.y || 0), r2(M.waypoint.z)] : null, cp: [r2(M.checkpoint.x), r2(M.checkpoint.z)], lv: M.lives, w: M.wave ?? 0 };
    const ps = [myState()];
    for (const r of remotes.values()) if (r.inMission && r.state) ps.push(r.state);
    broadcast({ t: 's', e, ms, ps });
  }
  updateAvatars(dt);
  if (rosterT <= 0) { rosterT = 0.25; ui.updateRoster(rosterRows()); }
}

function rosterRows() {
  const rows = [{ name: G.save.settings.name, cls: G.save.classId, h: G.player.health / G.player.maxHealth, dead: G.player.dead, me: true }];
  for (const r of remotes.values()) if (r.inMission) rows.push({ name: r.name, cls: r.cls, h: r.h ?? 1, dead: r.dead });
  return rows;
}

// ---------------------------------------------------------------------------
// Remote players (avatars + targeting records)
// ---------------------------------------------------------------------------
function ensureRemote(st) {
  let r = remotes.get(st.id);
  if (!r) {
    r = { id: st.id, remote: true, pos: new THREE.Vector3(st.x, st.y, st.z), target: new THREE.Vector3(st.x, st.y, st.z), eye: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: st.yw, dead: false, inMission: false, avatar: null, plate: null };
    remotes.set(st.id, r);
  }
  r.name = st.n; r.h = st.h; r.dead = !!st.d; r.inv = !!st.iv; r.state = st;
  if (!r.inMission) { r.pos.set(st.x, st.y, st.z); r.inMission = true; }
  if (r.cls !== st.c || r.sc !== st.sc || r.lk !== st.lk) { removeAvatar(r); r.cls = st.c; r.sc = st.sc; r.lk = st.lk; }
  r.target.set(st.x, st.y, st.z);
  r.targetYaw = st.yw;
  if (!r.avatar && G.scene) {
    const ch = buildCharacter(st.c, classKit(st.c, st.sc).element, decodeAppearance(st.lk));
    ch.group.children[1].visible = false; // stage disc
    ch.group.children[2].visible = false; // stage ring
    r.avatar = ch;
    G.scene.add(ch.group);
    r.plate = ui.makeNameplate(st.n, classKit(st.c, st.sc).color);
  }
  return r;
}

/** Downed teammate: their Ghost hovers over the body, glowing, until they're back up. */
function setReviveGhost(r, on) {
  if (!on) { if (r.reviveGhost) { r.reviveGhost.parent?.remove(r.reviveGhost); r.reviveGhost = null; } return; }
  if (r.reviveGhost) return;
  const g = new THREE.Group();
  const model = ghost();
  model.scale.setScalar(3.2);
  const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
  const beamM = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.18, 1.2, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beamM.position.y = -0.65;
  g.add(model, glow, beamM);
  g.userData = { model, glow };
  G.scene.add(g);
  r.reviveGhost = g;
}

/** U9: a teammate's Sentinel Shield barrier stops enemy shots on this screen too, so it protects you when you stand behind it. */
export function remoteBarrierBlocks(p) {
  for (const r of remotes.values()) if (r.inMission && !r.dead && r.state?.sp === 'sentinel' && r.state.gd && barrierStops(r.pos.x, r.pos.y, r.pos.z, r.yaw, p)) return true;
  return false;
}

function removeAvatar(r) {
  setReviveGhost(r, false);
  if (r.avatar) { r.avatar.group.parent?.remove(r.avatar.group); r.avatar = null; r.gunKey = undefined; r.prop = undefined; r.wasInv = false; }
  r.plate?.remove(); r.plate = null;
}

const _p = new THREE.Vector3();
function updateAvatars(dt) {
  const k = Math.min(1, dt * 12);
  for (const r of remotes.values()) {
    if (!r.inMission || !r.avatar) continue;
    const ox = r.pos.x, oz = r.pos.z;
    r.pos.lerp(r.target, k);
    r.vel.set((r.pos.x - ox) / Math.max(dt, 1e-3), 0, (r.pos.z - oz) / Math.max(dt, 1e-3));
    let dy = r.targetYaw - (r.yaw ?? 0);
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    r.yaw = (r.yaw ?? 0) + dy * k;
    r.eye.set(r.pos.x, r.pos.y + 1.62, r.pos.z);
    const g = r.avatar.group;
    g.position.copy(r.pos);
    g.rotation.y = r.yaw + Math.PI;
    g.rotation.x = r.dead ? -1.4 : 0;
    setReviveGhost(r, r.dead);
    if (r.reviveGhost) {
      const gh = r.reviveGhost;
      gh.position.set(r.pos.x, r.pos.y + 1.3 + Math.sin(G.time * 2.4) * 0.08, r.pos.z);
      gh.userData.model.lookAt(G.camera.position);
      gh.userData.glow.scale.setScalar(1 + Math.sin(G.time * 5) * 0.18);
    }
    const st = r.state || {};
    const gunKey = st.w ?? '';
    if (r.gunKey !== gunKey) {
      r.gunKey = gunKey;
      const [arch, rarity, element, name] = gunKey.split('|');
      r.avatar.setGun(gunKey ? { arch, rarity, element, name } : null);
    }
    // a fireteam member's gunfire, placed in the world; they only send an is-firing flag, so pace it by the weapon's rate
    if (st.f && gunKey && r.avatar && G.time - (r.shotSfxT || 0) > 60 / Math.min(600, ARCHETYPES[gunKey.split('|')[0]]?.rpm || 300)) {
      r.shotSfxT = G.time;
      const [a, , el] = gunKey.split('|');
      sfx.shot(a, r.pos, el);
    }
    // super prop in hand (hammer, gauntlets, staff, shield, storm orbs)
    const prop = st.sp || null;
    if (r.prop !== prop) { r.prop = prop; r.avatar.setProp(prop); }
    // Sentinel Shield guard: the shield flashes when the count of blocked hits goes up
    r.avatar.setShield(st.gv || 0); // a raised Glaive shield, in the glaive's element colour
    if (st.gh > r.guardHits) r.avatar.blockHit();
    r.guardHits = st.gh || 0;
    r.avatar.update(dt, { speed: Math.hypot(r.vel.x, r.vel.z), sprint: !!st.s, air: !!st.a, pitch: st.pt || 0, firing: !!st.f, armsLow: prop === 'fists' && !st.pu, punch: st.pu || 0, guard: prop === 'sentinel' && !!st.gd, superPose: st.po || null, hover: !!st.hv });
    // Vanishing Step: barely visible to teammates too
    if (r.wasInv !== r.inv) {
      r.wasInv = r.inv;
      // character materials are per-avatar; gun materials are shared, so hide the gun instead of fading it
      r.avatar.group.traverse((o) => { if (o.material && !o.userData.gunPart) { o.material.transparent = r.inv; o.material.opacity = r.inv ? 0.18 : 1; } });
      if (r.avatar.gun) r.avatar.gun.visible = !r.inv;
    }
    _p.set(r.pos.x, r.pos.y + (r.dead ? 1.85 : 2.35), r.pos.z).project(G.camera);
    if (r.plate) {
      const vis = _p.z < 1;
      r.plate.style.display = vis ? 'block' : 'none';
      if (vis) r.plate.style.transform = `translate(${((_p.x * 0.5 + 0.5) * innerWidth).toFixed(0)}px, ${((-_p.y * 0.5 + 0.5) * innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
      r.plate.classList.toggle('down', r.dead);
    }
  }
}

// ---------------------------------------------------------------------------
// Member-side enemy proxies
// ---------------------------------------------------------------------------
function proxy(id, type, x, z, info = {}) {
  const M = G.mission;
  const e = new Enemy(type, new THREE.Vector3(x, 0, z), { zone: M.zones[M.current] || { enemies: [] }, hpMult: 1, dmgMult: 1, element: info.el, name: info.n, model: info.bm, tier: info.tr, faction: info.fc, noDrops: !!info.nd });
  e.remote = true;
  e.netId = id;
  if (info.mh) { e.maxHp = info.mh; e.hp = info.mh; }
  if (info.ms) { e.maxShield = info.ms; e.shield = info.ms; }
  e.netPos = e.pos.clone();
  e.netYaw = 0;
  G.enemies.push(e);
  netEnemies.set(id, e);
  G.hitDirty = true;
  return e;
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------
const inMission = () => G.mission && ['playing', 'paused'].includes(G.state);

net.on('start', (m) => {
  if (G.mission) abandonMission(true);
  ui.hideOverlays();
  if (m.act) startActivity(m.act, m.seed); else startMission(m.li, m.mi);
  ui.feed('Fireteam leader launched the mission. Click to capture the mouse.', '#7fd8ff');
});
net.on('end', () => { if (inMission()) { abandonMission(true); ui.orbitNotice('The fireteam leader ended the mission.'); } });
net.on('hostgone', () => { if (G.mission && G.state !== 'complete') { abandonMission(true); } });
net.on('disbanded', (m) => { if (m.reason) ui.orbitNotice(m.reason); });
net.on('joined', () => { sfx.ui(); });
net.on('left', (m) => {
  const r = remotes.get(m.id);
  if (r) { removeAvatar(r); remotes.delete(m.id); }
  if (inMission() && m.name) ui.feed(`${m.name} left the fireteam`, '#aab3bf');
});
net.on('leave', (m, from) => { const r = remotes.get(from); if (r) { removeAvatar(r); r.inMission = false; } });

// host <- member
net.on('p', (m, from) => { if (inMission()) ensureRemote({ ...m, id: from }); });
net.on('hit', (m, from) => {
  if (!inMission()) return;
  const e = getEnemyByNetId(m.id);
  if (e && e.alive) dealDamage(e, m.m, { raw: true, element: m.el, crit: !!m.c, source: m.src, by: from, remoteHit: true, weaken: m.wk, slow: m.sl, suppress: m.su, burn: m.bu, poison: m.po, jolt: m.jo, blind: m.bl, judged: m.jg, corrosive: m.co, shieldBreaker: !!m.sb });
});

// both: effects
net.on('fx', (m, from) => {
  if (!inMission()) return;
  if (net.isHost) broadcast(m, from);
  if (m.k === 'tr') tracer(new THREE.Vector3(...m.a), new THREE.Vector3(...m.b), m.c, 0.02, 0.06);
  else if (m.k === 'pj') {
    // visual copy only: the caster's explosion arrives as its own 'boom'
    spawnPlayerProjectile({ kind: m.kind, pos: new THREE.Vector3(...m.p), vel: new THREE.Vector3(...m.v), gravity: m.g, size: m.s, color: m.c, life: m.l, visualOnly: true, onHit: () => {} });
  } else if (m.k === 'boom') {
    const p = new THREE.Vector3(...m.p);
    if (m.s) sparks(p, m.c, 6, m.r * 2, 0.08, 0.4); else explosionFx(p, m.r, m.c);
  } else if (m.k === 'ab') {
    replayFx(m.kind, m.o);
  }
});

// member <- host
net.on('sp', (m) => { if (inMission() && !netEnemies.has(m.id)) proxy(m.id, m.ty, m.x, m.z, m); });
net.on('s', (m) => {
  if (!inMission()) return;
  for (const [id, ti, x, z, yaw, hp, sh, db = 0, st = 0, y = 0, fl = 0] of m.e) {
    const e = netEnemies.get(id) || proxy(id, TYPES[ti], x, z);
    if (!e.alive) continue;
    e.netPos.set(x, y, z);
    e.netFl = fl; // bit 1: swinging at someone in reach, bit 2: suicide fuse lit, bit 4: enraged, bit 8: Centurion in the air
    e.netYaw = yaw;
    e.hp = (hp / 1000) * e.maxHp;
    e.shield = (sh / 1000) * e.maxShield;
    // the leader's debuffs and stagger: refreshed every snapshot, so they lapse soon after the leader's do
    DEBUFF_BITS.forEach((k, i) => { if (db & (1 << i)) e.status.apply(k, { t: 0.3 }); });
    if (st > (e.netStag ?? 0)) e.staggerT = e.staggerMax = st / 100; // a rise means a new stagger on the leader's side
    e.netStag = st;
  }
  const M = G.mission, ms = m.ms;
  if (M.phase !== 'loot' && M.phase !== 'done') {
    for (let i = 0; i < M.zones.length; i++) M.zones[i].state = i < ms.cur ? 'cleared' : i === ms.cur ? ms.zs : 'pending';
    M.current = ms.cur;
    M.objective = ms.obj;
    M.waypoint = ms.wp ? new THREE.Vector3(...ms.wp) : null;
    M.checkpoint.set(ms.cp[0], 0, ms.cp[1]);
  }
  M.lives = ms.lv;
  if (M.act && ms.w > (M.wave ?? 0)) {
    M.wave = ms.w;
    ui.centerMessage(ms.w % M.act.arenaEvery === 0 ? M.arenaDef.boss.name : `Wave ${ms.w}`, M.act.waves === Infinity ? '' : `of ${M.act.waves}`, 2);
  }
  for (const st of m.ps) if (st.id !== net.myId) ensureRemote(st);
});
net.on('kill', (m) => {
  if (!inMission()) return;
  const e = netEnemies.get(m.id);
  if (!e || !e.alive) return;
  e.alive = false; e.hp = 0;
  G.hitDirty = true;
  e.onDeath();
  sfx.kill();
  rollDrops(e); // every player rolls their own loot
  if (!e.noDrops) gainXp(Math.round((XP.kill[e.cls] ?? 0) * (TIERS[e.tier]?.xp ?? 1))); // the whole fireteam shares kill XP
  if (m.by === net.myId) {
    G.mission.kills++;
    if (m.c) G.mission.crits++;
    const o = lastHits.get(m.id) || {};
    G.player.onKill(e, { ...o, crit: !!m.c });
    ui.hitmarker(!!m.c, true);
  }
  if (e.isBoss) explosionFx(e.center(new THREE.Vector3()), 6, G.mission.loc.colors.eye);
});
net.on('bn', (m) => { if (inMission()) { ui.centerMessage(m.ti, m.su, m.du); sfx[m.so]?.(); } });
net.on('es', (m) => { if (inMission()) fireEnemyShot(new THREE.Vector3(...m.f), new THREE.Vector3(...m.d), m.v, m.m, m.c, m.s, m.sp, true); });
net.on('gr', (m) => { if (inMission()) spawnEnemyGrenade(new THREE.Vector3(...m.f), new THREE.Vector3(...m.v), m.m, m.c, true); });
net.on('dmg', (m) => { if (inMission() && !G.player.dead) damagePlayer(m.m, new THREE.Vector3(m.x, 0, m.z)); });
net.on('loot', (m) => {
  const M = G.mission;
  if (!inMission() || M.phase === 'loot' || M.phase === 'done') return;
  for (const z of M.zones) z.state = 'cleared';
  M.phase = 'loot';
  M.chest = spawnChest(new THREE.Vector3(m.x, 0, m.z));
  reviveForCompletion();
  G.player.health = G.player.maxHealth; G.player.shield = G.player.maxShield;
  ui.centerMessage('Boss Defeated', 'Claim your reward', 3);
  sfx.missionComplete();
  stinger('complete');
});

// activities
net.on('arena', (m) => { if (inMission() && G.mission.act) moveArena(m.i); });
net.on('ach', (m) => { if (inMission() && G.mission.act) placeActChest(new THREE.Vector3(m.x, 0, m.z), m.n, !!m.f); });

// revives
net.on('life', (m, from) => { if (inMission() && net.isHost) hostUseLife(from); });
net.on('rev', (m, from) => { if (inMission() && net.isHost) revivePlayer(m.id, true); });
net.on('revive', (m) => { if (inMission() && G.player.dead) G.player.respawn(!!m.ip); });
net.on('lv', (m) => { if (inMission()) G.mission.lives = m.n; });
net.on('wipe', () => { if (inMission()) missionFailed(); });
