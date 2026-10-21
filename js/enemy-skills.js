// U14 New Factions: the skills Taken and Scorn units run on top of the shared enemy AI (enemies.js).
// Each unit lists its skills in factions.js (`skills`, with a block of numbers per skill). Nothing here is
// hardcoded to a unit id: a skill reads its numbers from the unit's definition.
//   blink        short teleport on a timer, or as a dodge when hit (Taken Thrall, Wizard, Centurion, Knight; Scorn Raider)
//   ward         a damage-reducing bubble once hurt (Taken Vandal)
//   clone        splits into a copy once hurt (Taken Psion)
//   allyShield   makes a nearby ally invulnerable until the Goblin dies (Taken Goblin)
//   summon       calls Shadow Thralls (Taken Wizard)
//   frontGuard   a small side shield with its own hitbox that cuts hits landing on it; optionally a knockback burst (Taken Phalanx, Scorn Lurker)
//   spinGuard    a rotating shield that stops bullets from the side it faces; shield-piercing rounds, melee and ability damage get through (Vex Hydra)
//   knockBurst   a close-range compression blast with knockback (Cabal Incendior)
//   deathBlast   a burst when the unit dies (Hydra, Incendior's fuel tanks, Taken Incendior)
//   deathSpawn   releases smaller units when it dies (Vex Imp Swarm)
//   revive       a Scorn corpse stands up again unless it was burned
//   totem        places Ether Totems (Scorn Chieftain); totemAura is what a totem does
import * as THREE from 'three';
import { G } from './state.js';
import { ELEMENTS } from './data.js';
import { rand, pick } from './util.js';
import { NAV, heightAt, lineClear } from './nav.js';
import { insideLeash } from './ai.js';
import { sparks, ringFx } from './effects.js';
import { sfx } from './audio.js';
import { allPlayers, damageRemote } from './coop.js';
import { damagePlayer, killEnemy, spawnUnit, findSpawn, addTicker } from './game.js';
import * as ui from './ui.js';
import { SKILL, TOTEM_KINDS, blinkRange, mayRevive, guardMult, spinBlocks } from './factions.js';

const _v = new THREE.Vector3();
const LIGHT = 0xdfe8ff, ETHER = 0xb46bff;

export function skillInit(e, o = {}) {
  const d = e.def, has = (s) => d.skills?.includes(s);
  e.sk = {};
  if (has('blink')) Object.assign(e.sk, { blinkT: rand(d.blink.cd[0], d.blink.cd[1]) * 0.6, tell: 0, hitCd: 0, dest: null });
  if (has('ward')) { e.sk.wardUsed = false; e.wardT = 0; }
  if (has('clone')) e.sk.cloned = !!o.isClone;
  if (has('allyShield')) Object.assign(e.sk, { retargetT: 0.5, ally: null });
  if (has('summon')) Object.assign(e.sk, { summonT: rand(d.summon.cd[0], d.summon.cd[1]) * 0.6, hold: 0 });
  if (has('frontGuard') || has('knockBurst')) e.sk.knockCd = rand(2, 4);
  if (has('totem')) Object.assign(e.sk, { totemT: rand(5, 8), totems: [] });
  if (has('totemAura')) {
    const kind = o.totemKind || pick(TOTEM_KINDS);
    Object.assign(e.sk, { kind, tick: 0 });
    if (o.totemKind) e.name = kind.name;
    e.lifeT = o.life ?? 22;
  }
  if (d.life) e.lifeT = d.life;
}

/** Runs every frame for a leader-owned unit. Returns false while the unit is held still (a blink tell or a summon). */
export function skillUpdate(e, dt, P, dist) {
  if (!e.sk || !e.alive || e.spawnT < 1) return true;
  if (e.lifeT !== undefined) {
    e.lifeT -= dt;
    if (e.lifeT <= 0) { e.noBlast = true; sparks(e.center(_v), e.shotColor, 12, 5, 0.1, 0.5); killEnemy(e, { self: true }); return false; }
  }
  const d = e.def, sk = e.sk, skills = d.skills || []; // the original Fallen, Hive and Cabal units and the bosses have none
  if (e.wardT > 0) e.wardT -= dt;
  if (e.auraUntil && e.auraUntil < G.time) e.auraUntil = 0;
  if (skills.includes('totemAura')) totemAura(e, dt);
  if (!P || P.dead) return true;
  let held = false;
  if (skills.includes('ward')) ward(e);
  if (skills.includes('clone')) clone(e);
  if (skills.includes('allyShield')) allyShield(e, dt);
  if (skills.includes('frontGuard') || skills.includes('knockBurst')) frontGuardBurst(e, dt, P, dist);
  if (skills.includes('totem')) totem(e, dt, dist);
  if (skills.includes('summon') && summon(e, dt, dist)) held = true;
  if (skills.includes('blink') && blink(e, dt, P, dist)) held = true;
  return !held;
}

// ---- damage in ----
/** The skill adjustments to damage an enemy is about to take. `o` is the dealDamage options. Returns the new amount. */
export function skillIncoming(e, dmg, o = {}) {
  if (e.protectedBy) {
    if (e.protectedBy.alive) { sparks(e.center(_v), LIGHT, 3, 3, 0.06, 0.25); return 0; }
    e.protectedBy = null;
  }
  if (e.wardT > 0) dmg *= e.def.ward.mult;
  if (e.auraUntil > G.time) dmg *= e.auraMult ?? 1;
  if (e.def.frontGuard && !o.raw && o.pos) {
    // the guard is a small shield with its own box: bring the hit point into the unit's space and test it
    const dx = o.pos.x - e.pos.x, dz = o.pos.z - e.pos.z, c = Math.cos(e.yaw), s = Math.sin(e.yaw), sc = e.scale || 1;
    const k = guardMult(e.def, (dx * c - dz * s) / sc, (o.pos.y - e.pos.y) / sc, (dx * s + dz * c) / sc);
    if (k < 1) { dmg *= k; if (Math.random() < 0.4) sparks(_v.copy(o.pos), LIGHT, 3, 3, 0.05, 0.2); }
  }
  if (e.def.spinGuard && o.source === 'weapon' && !o.raw && !o.shieldBreaker && !o.weapon?.A?.sword && o.from !== false) {
    const A = o.pos || G.player?.pos;
    if (A && spinBlocks(e.def, e.yaw + spinAngle(e), Math.atan2(A.x - e.pos.x, A.z - e.pos.z))) {
      dmg *= e.def.spinGuard.mult;
      if (Math.random() < 0.5) sparks(_v.copy(o.pos || e.center(_v)), LIGHT, 3, 3, 0.05, 0.2);
    }
  }
  return dmg;
}

/** The Hydra's rotating shield: its angle about the unit (the model's spin pivot turns by the same amount). */
export function spinAngle(e) { return G.time * (e.def.spinGuard?.speed || 0) + (e.netId ?? e.seed ?? 0) * 2.1; }

/** A hit landed (called from dealDamage): units with an on-hit blink dodge away. */
export function skillHit(e) {
  const sk = e.sk;
  if (!sk || sk.blinkT === undefined || !e.def.blink.onHit || sk.hitCd > 0 || sk.tell > 0 || e.remote) return;
  sk.hitCd = SKILL.blinkHitCd;
  if (Math.random() < 0.55) { sk.blinkT = 0; sk.forced = true; }
}

// ---- blink ----
function validSpot(e, x, z) {
  const nav = G.nav;
  if (nav) {
    const h = heightAt(nav, x, z);
    if (h < 0 || Math.abs(h - e.pos.y) > NAV.step + 0.05 || !lineClear(nav, e.pos.x, e.pos.z, x, z)) return null;
  }
  if (e.zone?.center) { const q = insideLeash(e.zone, x, z); if (Math.abs(q.x - x) > 0.01 || Math.abs(q.z - z) > 0.01) return null; }
  const b = G.level.bounds;
  if (x < b.minX + 2 || x > b.maxX - 2 || z < b.minZ + 2 || z > b.maxZ - 2) return null;
  return { x, z };
}

function pickBlink(e, P, dist) {
  const d = e.def, base = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
  for (let i = 0; i < 8; i++) {
    const r = blinkRange(d);
    let a, rr = r;
    if (d.blink.toward) { a = base + rand(-0.5, 0.5); rr = Math.min(r, Math.max(0, dist - 3.5)); if (rr < 3) return null; }
    else a = base + (Math.random() < 0.5 ? 1 : -1) * rand(1.0, 2.2); // dodge to the side or back
    const s = validSpot(e, e.pos.x + Math.sin(a) * rr, e.pos.z + Math.cos(a) * rr);
    if (s) return s;
  }
  return null;
}

function blink(e, dt, P, dist) {
  const sk = e.sk, d = e.def;
  sk.hitCd = Math.max(0, sk.hitCd - dt);
  if (sk.tell > 0) {
    sk.tell -= dt;
    e.model.group.visible = Math.sin(G.time * 70) > -0.2; // shimmer
    if (Math.random() < 0.5) sparks(e.center(_v), LIGHT, 1, 2, 0.05, 0.3);
    if (sk.tell <= 0) {
      e.model.group.visible = true;
      if (sk.dest) {
        sparks(e.center(_v), LIGHT, 10, 5, 0.08, 0.4); ringFx(e.pos, 1.6 * e.scale, LIGHT, 0.3);
        e.pos.x = sk.dest.x; e.pos.z = sk.dest.z; e.path = null; e.post = null;
        const nav = G.nav, h = nav ? heightAt(nav, e.pos.x, e.pos.z) : -1;
        if (h >= 0) e.pos.y = h;
        e.model.group.position.copy(e.pos);
        sparks(e.center(_v), LIGHT, 10, 5, 0.08, 0.4); ringFx(e.pos, 1.6 * e.scale, LIGHT, 0.3);
        sfx.blink?.(e.pos);
      }
      sk.dest = null; sk.forced = false;
      sk.blinkT = rand(d.blink.cd[0], d.blink.cd[1]);
    }
    return true;
  }
  sk.blinkT -= dt;
  if (sk.blinkT > 0 || (!e.los && !sk.forced) || e.staggerT > 0) return false;
  const far = d.blink.toward ? dist > 9 : dist < d.range + 6;
  if (!far && !sk.forced) { sk.blinkT = 1; return false; }
  const dest = pickBlink(e, P, dist);
  if (!dest) { sk.blinkT = 1.5; return false; }
  sk.dest = dest; sk.tell = SKILL.blinkTell;
  return true;
}

// ---- ward ----
function ward(e) {
  const sk = e.sk, w = e.def.ward;
  if (sk.wardUsed || e.hp >= e.maxHp * w.below) return;
  sk.wardUsed = true; e.wardT = w.dur;
  ringFx(e.pos, 3, LIGHT, 0.6); sparks(e.center(_v), LIGHT, 14, 4, 0.08, 0.5);
  sfx.shieldBreak?.(e.pos);
}

// ---- clone ----
function clone(e) {
  const sk = e.sk, c = e.def.clone, z = e.zone;
  if (sk.cloned || !z || e.hp >= e.maxHp * c.below) return;
  if ((z.clones || 0) >= c.maxPerZone) { sk.cloned = true; return; }
  sk.cloned = true; z.clones = (z.clones || 0) + 1;
  const pos = findSpawn(e.pos, Math.random() * Math.PI * 2, Math.PI, 2.5, 5);
  spawnUnit(z, e.typeId, pos, { tier: e.tier, hpFrac: c.hpFrac, isClone: true, noDrops: true });
  ringFx(e.pos, 3, LIGHT, 0.5); sparks(e.center(_v), LIGHT, 16, 5, 0.1, 0.5);
}

// ---- ally shield (Goblin) ----
function allyShield(e, dt) {
  const sk = e.sk, a = e.def.allyShield;
  sk.retargetT -= dt;
  if (sk.ally && (!sk.ally.alive || sk.ally.protectedBy !== e)) sk.ally = null;
  if (sk.retargetT <= 0) {
    sk.retargetT = a.retarget;
    let best = null, bs = -1;
    for (const o of e.zone?.enemies || []) {
      if (o === e || !o.alive || o.def.skills?.includes('allyShield') || o.def.static || (o.protectedBy && o.protectedBy !== e)) continue;
      if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) > a.range) continue;
      const score = o.maxHp + (o.cls === 'heavy' ? 400 : 0);
      if (score > bs) { bs = score; best = o; }
    }
    if (best !== sk.ally) {
      if (sk.ally) sk.ally.protectedBy = null;
      sk.ally = best;
      if (best) best.protectedBy = e;
    }
  }
  if (sk.ally && Math.random() < 0.18) { sparks(sk.ally.center(_v), LIGHT, 2, 2, 0.07, 0.35); ringFx(sk.ally.pos, 1.3 * sk.ally.scale, LIGHT, 0.25); }
}

// ---- summon (Wizard) ----
function summon(e, dt, dist) {
  const sk = e.sk, s = e.def.summon;
  if (sk.hold > 0) {
    sk.hold -= dt;
    if (Math.random() < 0.6) sparks(e.center(_v), 0x7a4ab0, 2, 3, 0.07, 0.4);
    if (sk.hold <= 0) {
      for (let i = 0; i < s.n; i++) {
        const pos = findSpawn(e.pos, Math.random() * Math.PI * 2, Math.PI, 2.5, 4.5);
        const m = spawnUnit(e.zone, s.type, pos, { tier: 'minor', noDrops: true });
        if (m) sk.minions = [...(sk.minions || []).filter((x) => x.alive), m];
      }
      ringFx(e.pos, 4, 0x7a4ab0, 0.5);
      sfx.alert();
      sk.summonT = rand(s.cd[0], s.cd[1]);
    }
    return true;
  }
  sk.summonT -= dt;
  if (sk.summonT > 0 || !e.los || dist > 36 || !e.zone) return false;
  sk.minions = (sk.minions || []).filter((x) => x.alive);
  if (sk.minions.length >= s.max) { sk.summonT = 2; return false; }
  sk.hold = SKILL.summonTell;
  return true;
}

// ---- front guard (Phalanx, Lurker) ----
function frontGuardBurst(e, dt, P, dist) {
  const k = e.def.knockBurst || e.def.frontGuard?.knock, sk = e.sk;
  if (!k) return;
  sk.knockCd -= dt;
  if (sk.knockCd > 0 || dist > k.range || !e.los || e.staggerT > 0 || e.windup > 0) return;
  sk.knockCd = k.cd;
  ringFx(e.pos, k.range, ELEMENTS.arc.hex, 0.4); sparks(e.center(_v), ELEMENTS.arc.hex, 18, 7, 0.1, 0.5); sfx.explosion(2, e.pos);
  for (const Pl of allPlayers()) {
    if (Pl.dead || Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z) > k.range) continue;
    if (Pl.remote) { damageRemote(Pl, k.dmg * e.dmgMult, e.pos); continue; }
    damagePlayer(k.dmg * e.dmgMult, e.pos, 'splash');
    const l = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z) || 1;
    Pl.vel.x += (Pl.pos.x - e.pos.x) / l * k.push; Pl.vel.z += (Pl.pos.z - e.pos.z) / l * k.push; Pl.vel.y = Math.max(Pl.vel.y, 2.5);
    Pl.shake = Math.max(Pl.shake, 0.35);
  }
}

// ---- Ether Totems (Chieftain) ----
function totem(e, dt, dist) {
  const sk = e.sk, t = e.def.totem;
  sk.totems = sk.totems.filter((x) => x.alive);
  sk.totemT -= dt;
  if (sk.totemT > 0 || !e.los || dist > 38 || !e.zone || sk.totems.length >= t.max) return;
  sk.totemT = rand(t.cd[0], t.cd[1]);
  const pos = findSpawn(e.pos, Math.atan2(G.player.pos.x - e.pos.x, G.player.pos.z - e.pos.z), 1.2, 3, 6);
  const m = spawnUnit(e.zone, 'sc_totem', pos, { tier: 'minor', noDrops: true, owner: e, life: t.life, totemKind: pick(TOTEM_KINDS) });
  if (m) { sk.totems.push(m); ringFx(pos, 3, ETHER, 0.6); sfx.alert(); }
}

function totemAura(e, dt) {
  const sk = e.sk, a = e.def.totemAura;
  if (e.owner && !e.owner.alive) { e.noBlast = true; killEnemy(e, { self: true }); return; }
  sk.tick -= dt;
  if (Math.random() < 0.12) sparks(_v.set(e.pos.x, e.pos.y + 1.8, e.pos.z), ELEMENTS[sk.kind.el].hex, 1, 2, 0.06, 0.5);
  if (sk.tick > 0) return;
  sk.tick = SKILL.totemTick;
  const hex = ELEMENTS[sk.kind.el].hex;
  if (sk.kind.id === 'shield') {
    for (const o of e.zone?.enemies || []) {
      if (o === e || !o.alive || o.def.static) continue;
      if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < a.radius) { o.auraUntil = G.time + 0.7; o.auraMult = a.mult; }
    }
    if (Math.random() < 0.5) ringFx(e.pos, a.radius * 0.5, hex, 0.35);
  } else {
    // Ether Bind (arc) and Ether Torch (solar) hurt Guardians standing near them
    const R = a.radius * 0.55;
    ringFx(e.pos, R, hex, 0.3);
    for (const Pl of allPlayers()) {
      if (Pl.dead || Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.z - e.pos.z) > R) continue;
      if (Pl.remote) damageRemote(Pl, 5 * e.dmgMult, e.pos);
      else { damagePlayer(5 * e.dmgMult, e.pos, 'splash'); Pl.shake = Math.max(Pl.shake, 0.1); }
    }
  }
}

// ---- revive (Scorn) ----
/** Called when a unit dies on the leader: a Scorn corpse that was not burned stands up again after a few seconds. */
export function skillOnDeath(e) {
  const d = e.def;
  if (e.remote) return;
  if (d.skills?.includes('deathBlast') && !e.noBlast) deathBlast(e);
  if (d.skills?.includes('deathSpawn') && e.zone && !e.noBlast) for (let i = 0; i < d.deathSpawn.n; i++) {
    const pos = findSpawn(e.pos, Math.random() * Math.PI * 2, Math.PI, 0.8, 2.2);
    spawnUnit(e.zone, d.deathSpawn.type, pos, { tier: 'minor', noDrops: true });
  }
  if (d.skills?.includes('totem')) for (const t of e.sk.totems || []) if (t.alive) { t.noBlast = true; killEnemy(t, { self: true }); }
  if (!d.skills?.includes('revive') || e.noBlast) return;
  const z = e.zone, M = G.mission;
  const burned = SKILL.reviveBurn.some((k) => e.status.has(k));
  if (burned) { sparks(e.center(_v), 0xff7a2a, 12, 4, 0.1, 0.5); return; }
  if (!z || !mayRevive({ hasSkill: true, zoneRevives: z.revives || 0, burned, alreadyRevived: e.revived })) return;
  z.revives = (z.revives || 0) + 1;
  z.pending = (z.pending || 0) + 1;
  if (!M.reviveHint) { M.reviveHint = true; ui.feed('Scorn rise again unless burned', '#c37aff'); }
  const at = e.pos.clone();
  let t = rand(d.revive.delay[0], d.revive.delay[1]), pulse = 0;
  const info = { tier: e.tier, hpFrac: d.revive.hpFrac, revived: true, noDrops: true };
  addTicker({
    update(dt) {
      if (G.mission !== M || G.state !== 'playing') { z.pending = Math.max(0, (z.pending || 1) - 1); return false; }
      t -= dt; pulse -= dt;
      if (pulse <= 0) { pulse = 0.5; sparks(_v.set(at.x, 0.4, at.z), ETHER, 2, 1.5, 0.07, 0.6); }
      if (t > 0) return true;
      z.pending = Math.max(0, z.pending - 1);
      if (z.state === 'active') {
        spawnUnit(z, e.typeId, at, info);
        ringFx(at, 3, ETHER, 0.5); sfx.alert();
      }
      return false;
    },
  });
}

// ---- death blast (Hydra, Incendior) ----
function deathBlast(e) {
  const b = e.def.deathBlast, at = e.center(new THREE.Vector3());
  ringFx(e.pos, b.radius, 0xff7a2a, 0.5); sparks(at, 0xff7a2a, 18, 8, 0.12, 0.6); sfx.explosion(3, e.pos);
  for (const Pl of allPlayers()) {
    if (Pl.dead) continue;
    const d = Math.hypot(Pl.pos.x - e.pos.x, Pl.pos.y + 1 - at.y, Pl.pos.z - e.pos.z);
    if (d > b.radius) continue;
    const dmg = b.dmg * e.dmgMult * (1 - d / b.radius * 0.7);
    if (Pl.remote) { damageRemote(Pl, dmg, e.pos); continue; }
    damagePlayer(dmg, e.pos, 'splash');
  }
}
