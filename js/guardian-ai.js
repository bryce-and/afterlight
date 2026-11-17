// U25 Crucible: AI Guardians. A Guardian is a body built by buildCharacter that fights with the same PvP numbers and ammo rules as a player
// (js/pvp.js), and is deliberately "not too strong": reaction delay, aim error and a cap on precision hits, all data in GUARDIAN_AI.
// It lives in G.enemies (so every existing melee, ability, explosion and projectile loop sees it) and answers to `isGuardian`: dealDamage
// hands every hit on it to crucible.js pvpDealDamage, so no PvE number is ever applied to it.
import * as THREE from 'three';
import { G } from './state.js';
import { ARCHETYPES, ELEMENTS } from './data.js';
import { buildCharacter } from './characters.js';
import { StatusSet, ENEMY_STATUS } from './status.js';
import { shieldMax } from './armor.js';
import { moveBody, hasLOS } from './physics.js';
import { findPath, lineClear } from './nav.js';
import { tracer, explosionFx, sparks } from './effects.js';
import { sfx } from './audio.js';
import { PVP_HEALTH, PVP_REF_RES, GUARDIAN_AI as AI, CONTROL, weaponDamage, startLoad, abilityDamage, AI_CLASS_IDS, AI_ELEMENT_IDS,
  BOT_ABILITY as BA, ROAMING_SUPERS, grenadeDef, classDef, superName, subclassFor } from './pvp.js';
import { npcFx } from './abilities.js';
import { CLASSES } from './data.js';
import { getHitTargets, addTicker } from './game.js';
import { aiGoal, foesOf, pvpDamagePlayer, onGuardianDeath, crateGoal, damageFoesInRadius } from './crucible.js';
import { crSendHit } from './crucible-net.js';

const ray = new THREE.Raycaster(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _box = new THREE.Box3(), _hit = new THREE.Vector3();
const TEAM_HEX = { blue: 0x6ec8ff, red: 0xff6a5a };
const SPEED = 6.0, STRAFE = 3.4, GRAVITY = 24;

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** One shot's worth of rules for a primary or special: shots per second, magazine and reload. */
const gunOf = (id) => { const A = ARCHETYPES[id]; return { id, A, mag: A.mag, rate: 60 / A.rpm }; };
const ELEMENT_OF_SLOT = ['kinetic', 'arc', 'solar']; // the gun model's element per slot, so a switch reads at a glance
/** U29: the range band each special and heavy is drawn for (m). Outside it the AI Guardian holds its primary. */
const BAND = { shotgun: [0, 8], fusion: [4, 15], glaive: [0, 18], sniper: [22, 120], rocket: [7, 45], mg: [0, 40], linear: [14, 120] };
const inBand = (id, d) => { const b = BAND[id]; return !!b && d >= b[0] && d <= b[1]; };

export class Guardian {
  /**
   * o: { team, name, classId, element, arch, special, slot (index in its team), pos }
   * Networked matches (chunk B): `puppet: true` is a body the host's snapshots drive (no AI runs); `gid` names it on the wire, `humanId` is set when a
   * human plays it (its hits are relayed to that player), `look` is their decoded appearance.
   */
  constructor(o) {
    this.isGuardian = true; this.remote = false; this.typeId = 'guardian'; this.cls = 'grunt'; this.tier = null; this.isBoss = false; this.def = { range: 40 };
    this.team = o.team; this.name = o.name; this.faction = 'guardian'; this.slot = o.slot ?? 0;
    this.puppet = !!o.puppet; this.humanId = o.humanId || null; this.gid = o.gid ?? o.humanId ?? null; this.deathScored = false;
    this.netPos = new THREE.Vector3(); this.netYaw = 0; this.netFire = false; this.netAir = false; this.netSprint = false; this.firing = false; this.gunKey = null;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0;
    this.radius = 0.45; this.height = 1.8; this.fly = 0; this.scale = 1; this.large = false;
    this.maxHp = PVP_HEALTH; this.maxShield = shieldMax(PVP_REF_RES);
    this.shieldEl = 'arc'; this.zone = null; this.spawnT = 1; this.flash = 0;
    this.status = new StatusSet(ENEMY_STATUS); this.knock = new THREE.Vector3();
    this.primary = gunOf(o.arch || 'auto'); this.special = o.special ? gunOf(o.special) : null;
    // U29: the whole kit, rolled once a match (js/pvp.js rollKit) and kept every life
    const kit = o.kit || {};
    this.classId = o.classId || 'vanguard'; this.element = o.element || 'arc';
    this.heavy = kit.heavy && ARCHETYPES[kit.heavy] ? gunOf(kit.heavy) : null; if (this.heavy) { this.heavy.ammo = 0; this.heavy.reserve = 0; }
    this.grenadeK = grenadeDef(this.element, kit.gr); this.classK = classDef(this.classId, kit.ca);
    this.superId = kit.su || null; this.superN = superName(this.classId, this.element);
    const sub = subclassFor(this.classId, this.element);
    this.subName = kit.scName || sub?.name || ''; this.className = CLASSES[this.classId]?.name || '';
    this.superCharge = Math.random() * 25; this.superActive = false; this.superT = 0; this.superStepT = 0; this.superN2 = 0;
    this.classT = 6 + Math.random() * AI.classEvery; this.buffT = { well: 0, empower: 0 }; this.lungeT = 0; this.lungeV = new THREE.Vector3();
    this.weaponSlot = 0; this.onGround = true; this.how = '';
    this.stat = { supers: 0, grenades: 0, classes: 0, jumps: 0, swaps: 0, specialShots: 0, heavyShots: 0 }; // U29: read by tools/cruciblecheck.js
    this.kills = 0; this.deaths = 0;
    // behaviour state
    this.goal = null; this.goalT = 0; this.path = null; this.pathIdx = 0; this.pathT = 0; this.stuckT = 0; this.lastX = 0; this.lastZ = 0;
    this.tgt = null; this.tgtT = 0; this.seenT = 0; this.reactT = 0; this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = 1 + Math.random();
    this.fireT = 0; this.burstN = 0; this.reloadT = 0; this.abilityT = 4 + Math.random() * AI.abilityEvery; this.meleeT = 0; this.chargeT = 0;
    this.regenT = 0; this.dieT = 0; this.respawnT = 0; this.alive = false; this.speedNow = 0; this.crit = false;
    // the body
    const el = ELEMENTS[o.element || 'arc'];
    this.body = buildCharacter(o.classId || 'vanguard', o.element || 'arc', o.look);
    this.group = this.body.group;
    for (const i of [1, 2, 3]) if (this.group.children[i]) this.group.children[i].visible = false; // stage disc, ring and Ghost
    this.group.rotation.order = 'YXZ';
    if (!this.puppet || o.arch) this.body.setGun({ arch: o.arch || 'auto', rarity: 'legendary', element: 'kinetic' });
    this.shownSlot = 0;
    // a team marker over the head (blue or red) and two invisible hit boxes: the body and a precision head box
    const mk = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: TEAM_HEX[this.team], fog: false }));
    mk.position.y = 2.35; this.marker = mk; this.group.add(mk);
    const hbMat = new THREE.MeshBasicMaterial({ visible: false });
    const bodyBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.35, 0.6), hbMat), headBox = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.38), hbMat);
    bodyBox.position.y = 0.68; headBox.position.y = 1.55;
    bodyBox.userData = { enemy: this, crit: false }; headBox.userData = { enemy: this, crit: true };
    bodyBox.visible = headBox.visible = false;
    this.hitMeshes = [bodyBox, headBox];
    this.group.add(bodyBox, headBox);
    G.scene.add(this.group);
    G.enemies.push(this);
    this.spawn(o.pos);
    void el;
  }

  get pool() { return this.hp + this.shield; }
  slotGun(i) { return i === 2 ? this.heavy : i === 1 ? this.special : this.primary; }
  /** Shows the gun for slot `i` in its hands (a puppet calls this from the host's snapshot). */
  holdSlot(i) {
    if (i === this.shownSlot) return;
    const w = this.slotGun(i);
    if (!w) return;
    this.shownSlot = i; this.weaponSlot = i;
    this.body.setGun({ arch: w.id, rarity: i === 2 ? 'exotic' : 'legendary', element: ELEMENT_OF_SLOT[i] });
  }
  /** Picks `w` as the gun in hand (a short swap delay, like a player's). */
  equip(w) {
    if (!w || w === this.cur) return;
    if (this.cur) this.stat.swaps++;
    this.cur = w; this.reloadT = 0; this.chargeT = 0; this.burstN = 0; this.fireT = Math.max(this.fireT, 0.45);
    this.holdSlot(w === this.heavy ? 2 : w === this.special ? 1 : 0);
  }
  /** U29: a teammate's rift or well (js/abilities.js) heals and buffs this Guardian while it stands inside. */
  allyBuff(kind, dt) {
    if (!this.alive) return;
    const full = this.maxHp + this.maxShield;
    if (kind === 'rift' || kind === 'well') {
      this.regenT = Math.min(this.regenT, 0.5);
      let heal = (kind === 'well' ? 0.45 : 0.28) * full * dt;
      const h = Math.min(heal, this.maxHp - this.hp); this.hp += h; heal -= h;
      this.shield = Math.min(this.maxShield, this.shield + heal);
    }
    if (kind === 'well') this.buffT.well = 0.3;
    if (kind === 'empower' || kind === 'well') this.buffT.empower = 0.3;
  }
  onKill() { this.kills++; if (!this.superActive) this.superCharge = Math.min(100, this.superCharge + AI.superPerKill); }
  center(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z); }
  headPos(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.9, this.pos.z); }
  get eye() { return _a.set(this.pos.x, this.pos.y + 1.55, this.pos.z); }
  flush() {} stagger() {} breakShield() {} onDeath() {}

  /** A new life: full health and shield, the start ammo (js/pvp.js startLoad), at `pos`. */
  spawn(pos) {
    this.pos.copy(pos); this.vel.set(0, 0, 0);
    this.hp = this.maxHp; this.shield = this.maxShield; this.alive = true; this.dieT = 0; this.regenT = 0;
    for (const w of [this.primary, this.special]) if (w) { const L = startLoad(w.id, w.A.slot, w.A.mag); w.ammo = L.ammo; w.reserve = L.reserve; }
    if (this.heavy) { this.heavy.ammo = 0; this.heavy.reserve = 0; }
    this.cur = null; this.equip(this.primary); this.fireT = 0.6;
    this.superActive = false; this.superT = 0; this.lungeT = 0; this.buffT.well = this.buffT.empower = 0; this.how = '';
    this.tgt = null; this.path = null; this.goalT = 0; this.reloadT = 0; this.fireT = 0.6; this.burstN = 0; this.status.clear?.();
    this.group.visible = true; this.group.rotation.set(0, this.yaw + Math.PI, 0);
    this.group.position.copy(this.pos);
    G.hitDirty = true;
  }

  remove() { G.scene.remove(this.group); }

  /** Takes PvP damage (already final). Shield first. `oneHit` kills outright. Returns { dealt, killed }. */
  takePvp(dmg, oneHit, attacker) {
    if (!this.alive) return { dealt: 0, killed: false };
    if (G.mission?.crucible?.duel?.phase === 'between') return { dealt: 0, killed: false }; // nobody is hurt between Duel rounds
    if (this.puppet) { // not simulated here: report the hit to the host, which relays it to the human (or applies it to the AI Guardian)
      this.flash = 0.12;
      crSendHit(this.gid, dmg, oneHit, attacker ? attacker.gid : null);
      return { dealt: Math.min(dmg, this.pool), killed: false };
    }
    if (!oneHit && this.superActive && ROAMING_SUPERS.includes(this.superId)) dmg *= AI.superDR; // U29: a roaming super shrugs off most damage
    if (!oneHit && this.buffT.well > 0) dmg *= 0.75; // standing in a teammate's Well of Radiance
    const total = oneHit ? Math.max(this.pool, dmg) : dmg;
    let left = total, dealt = 0;
    if (this.shield > 0) { const a = Math.min(this.shield, left); this.shield -= a; left -= a; dealt += a; if (this.shield <= 0) sparks(this.center(_b), 0x9fe8ff, 10, 5, 0.08, 0.4); }
    if (left > 0) { const a = Math.min(this.hp, left); this.hp -= a; dealt += a; }
    this.regenT = 5; this.flash = 0.12;
    if (attacker && this.tgt !== attacker) { this.tgt = attacker; this.reactT = AI.reaction * 0.5; } // being shot at: turn on whoever did it
    if (this.hp <= 0) { this.die(attacker); return { dealt, killed: true }; }
    return { dealt, killed: false };
  }

  die(attacker) {
    this.superActive = false;
    this.alive = false; this.hp = 0; this.shield = 0; this.dieT = 0; this.deaths++; this.respawnT = CONTROL.respawn;
    this.fallDir = Math.random() < 0.5 ? 1 : -1;
    G.hitDirty = true;
    sparks(this.center(_b), TEAM_HEX[this.team], 14, 6, 0.1, 0.6);
    sfx.enemyDie?.(this.pos, 'guardian');
    onGuardianDeath(this, attacker);
  }

  // ---- AI ----
  /** The best visible foe: the nearest living enemy Guardian or the player, with a line of sight within sight range. */
  pickTarget() {
    const eye = _a.copy(this.pos).setY(this.pos.y + 1.55);
    let best = null, bd = AI.sight * AI.sight;
    for (const f of foesOf(this)) {
      const dx = f.pos.x - this.pos.x, dz = f.pos.z - this.pos.z, d2 = dx * dx + dz * dz;
      if (d2 > bd) continue;
      _b.set(f.pos.x, f.pos.y + 1.2, f.pos.z);
      if (!hasLOS(eye, _b)) continue;
      best = f; bd = d2;
    }
    return best;
  }

  /** A puppet's frame: ease toward the last snapshot's place and heading; the host owns everything else. */
  updatePuppet(dt) {
    const m = this.group;
    if (!this.alive) {
      this.dieT += dt;
      m.rotation.x = -Math.min(1, this.dieT * 2.2) * 1.4 * this.fallDir;
      if (this.dieT > 2.2) m.visible = false;
      return true;
    }
    this.flash = Math.max(0, this.flash - dt);
    const k = Math.min(1, dt * 14), ox = this.pos.x, oz = this.pos.z;
    this.pos.lerp(this.netPos, k);
    this.yaw += wrapA(this.netYaw - this.yaw) * k;
    this.speedNow = Math.min(9, Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-3));
    this.firing = this.netFire;
    this.animate(dt, this.netFire);
    return true;
  }

  /** A puppet's alive flag from the host (or the human's own row): a death plays the fall, a new life stands it back up. */
  setNetAlive(on) {
    if (on === this.alive) return;
    G.hitDirty = true;
    if (!on) {
      this.alive = false; this.hp = 0; this.shield = 0; this.dieT = 0; this.fallDir = Math.random() < 0.5 ? 1 : -1;
      sparks(this.center(_b), TEAM_HEX[this.team], 14, 6, 0.1, 0.6);
      sfx.enemyDie?.(this.pos, 'guardian');
      return;
    }
    this.alive = true; this.dieT = 0; this.deathScored = false;
    this.group.visible = true; this.group.rotation.set(0, this.yaw + Math.PI, 0);
    this.pos.copy(this.netPos); this.hp = this.maxHp; this.shield = this.maxShield;
  }

  /** The gun in a puppet's hands (the same `arch|rarity|element|name` key the fireteam avatars use). */
  setGunKey(key) {
    if (key === this.gunKey) return;
    this.gunKey = key;
    const [arch, rarity, element, name] = (key || '').split('|');
    this.body.setGun(key ? { arch, rarity, element, name } : null);
  }

  update(dt) {
    if (this.puppet) return this.updatePuppet(dt);
    const m = this.group;
    if (!this.alive) {
      this.dieT += dt;
      m.rotation.x = -Math.min(1, this.dieT * 2.2) * 1.4 * this.fallDir;
      if (this.dieT > 2.2) m.visible = false;
      return true;
    }
    const M = G.mission;
    if (!M || M.phase === 'done' || M.crucible?.duel?.phase === 'between') { this.speedNow = 0; this.animate(dt, false); return true; } // a finished match, or the break between Duel rounds: stand still
    this.flash = Math.max(0, this.flash - dt);
    // regeneration: shield after a quiet moment, then health
    this.regenT -= dt;
    if (this.regenT <= 0) {
      if (this.shield < this.maxShield) this.shield = Math.min(this.maxShield, this.shield + 32 * dt);
      else if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 14 * dt);
    }
    // target
    this.tgtT -= dt;
    if (this.tgtT <= 0) {
      this.tgtT = 0.25;
      const t = this.pickTarget();
      if (t !== this.tgt) { this.tgt = t; if (t) this.reactT = AI.reaction * (0.7 + Math.random() * 0.6); }
      this.seenT = t ? 0 : this.seenT + 0.25;
    }
    if (this.tgt && !this.tgt.alive && this.tgt.alive !== undefined) this.tgt = null;
    if (this.tgt && this.tgt.dead) this.tgt = null; // the player flag
    this.reactT -= dt;
    this.meleeT -= dt; this.abilityT -= dt; this.classT -= dt; this.buffT.well -= dt; this.buffT.empower -= dt;
    if (!this.superActive) this.superCharge = Math.min(100, this.superCharge + (100 / AI.superTime) * dt);

    // movement intent
    let wx = 0, wz = 0, speed = SPEED, facing = null;
    const hurt = this.pool < (this.maxHp + this.maxShield) * AI.regroupHp;
    if (this.tgt) {
      const t = this.tgt, dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z, dist = Math.hypot(dx, dz) || 0.01, nx = dx / dist, nz = dz / dist;
      facing = [nx, nz];
      this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = AI.strafe * (0.6 + Math.random() * 0.8); this.strafe = -this.strafe; if (this.onGround && Math.random() < AI.hopChance) this.jump(); }
      const want = Math.min(this.cur.A.range * 0.9, 24);
      let fwd = dist > want * 1.15 ? 1 : dist < Math.min(6, want * 0.5) ? -1 : 0;
      if (hurt) fwd = -1;
      wx = nx * fwd * STRAFE + -nz * this.strafe * STRAFE; wz = nz * fwd * STRAFE + nx * this.strafe * STRAFE;
      speed = STRAFE;
      const cg = this.goal && this.goal.r === 1 ? this.goal : null; // U29: a crate it needs a few steps away is worth breaking off for
      if (cg && !hurt && Math.hypot(cg.x - this.pos.x, cg.z - this.pos.z) < 14) { const g = this.toGoal(dt); wx = g.x * SPEED; wz = g.z * SPEED; speed = SPEED; }
      else if (fwd === 1) { // out of effective range: path in to a trading distance (walls are common here, so never walk straight at them)
        const g = this.toGoal(dt, { x: t.pos.x, z: t.pos.z, r: want * 0.8 }); wx = g.x * SPEED; wz = g.z * SPEED; speed = SPEED;
      }
      this.fightAt(dt, t, dist, nx, nz);
    } else {
      const g = this.toGoal(dt);
      wx = g.x * SPEED; wz = g.z * SPEED;
      if (this.cur !== this.primary && this.cur.ammo + (this.cur.reserve || 0) <= 0) this.equip(this.primary);
      this.burstN = 0;
      if (this.superActive) this.superStep(dt, null, 0);
      else if (this.classT <= 0 && hurt) this.useClass(null, 0);
    }
    // apply
    const len = Math.hypot(wx, wz);
    if (len > speed) { wx *= speed / len; wz *= speed / len; }
    if (this.lungeT > 0) { this.lungeT -= dt; wx = this.lungeV.x; wz = this.lungeV.z; } // a dodge, or a super's lunge
    this.vel.x = wx; this.vel.z = wz; this.vel.y -= GRAVITY * dt;
    const res = moveBody(this.pos, this.vel, dt, this.radius, this.height, 0.6, this.team);
    if (res.onGround && this.vel.y < 0) this.vel.y = 0;
    this.onGround = res.onGround; this.netAir = !res.onGround;
    this.speedNow = Math.hypot(wx, wz);
    // U29: jump onto whatever blocks the way (a bench, a crate, a planter, a low wall), up to AI.jumpReach above the feet
    if (res.hitWall && res.onGround && len > 1) { const top = this.ledgeAhead(wx / len, wz / len); if (top !== null) this.jump(); }
    // stuck: jump the path forward
    this.stuckT += dt;
    if (this.stuckT > 0.6) { this.stuckT = 0; if (Math.hypot(this.pos.x - this.lastX, this.pos.z - this.lastZ) < 0.25 && len > 1) { this.path = null; this.goalT = 0; this.strafe = -this.strafe; this.vel.x += -this.strafe * 4; this.vel.z += this.strafe * 4; if (this.onGround) this.jump(); } this.lastX = this.pos.x; this.lastZ = this.pos.z; }
    // face the target or the way we walk
    const fx = facing ? facing[0] : len > 0.1 ? wx / len : null, fz = facing ? facing[1] : len > 0.1 ? wz / len : null;
    if (fx !== null) {
      const want = Math.atan2(-fx, -fz);
      let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 9);
    }
    this.firing = !!this.tgt && this.reactT <= 0;
    this.animate(dt, this.firing);
    return true;
  }

  animate(dt, firing) {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw + Math.PI;
    this.marker.rotation.y += dt * 2;
    this.body.update(dt, { speed: this.speedNow, sprint: !this.tgt && this.speedNow > 5, air: this.netAir, pitch: 0, firing: firing && !this.superActive });
    this.body.group.traverse((o) => { if (o.material?.emissive && o.userData.slot) o.material.emissiveIntensity = this.flash > 0 ? 1.2 : o.material.emissiveIntensity; });
  }

  /** Steps along the way to the current objective: a zone to take or hold, or a crate when the special is empty. Returns a unit step. */
  toGoal(dt, over) {
    this.goalT -= dt; this.crateT = (this.crateT ?? 0) - dt;
    if (!over && this.crateT <= 0) { // U29: a crate it needs that just came up wins over the zone it was walking to
      this.crateT = 1;
      const cr = crateGoal(this);
      if (cr && !(this.goal && this.goal.r === 1)) { this.goal = cr; this.path = null; this.goalT = 8; }
      else if (!cr && this.goal && this.goal.r === 1) this.goalT = 0; // someone else took it: back to the zones
    }
    if (!over && (this.goalT <= 0 || !this.goal)) {
      this.goalT = 3 + Math.random() * 3;
      const crate = crateGoal(this); // an empty special, or an empty heavy (U29), sends it to a ready crate nearby
      this.goal = crate || aiGoal(this);
      this.path = null;
    }
    const g = over || this.goal;
    if (!g) return { x: 0, z: 0 };
    const dx = g.x - this.pos.x, dz = g.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < (g.r ?? 3)) { // on the ring: hold, drifting about it
      this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = 1.5 + Math.random() * 2; this.strafe = -this.strafe; }
      return { x: (-dz / (d || 1)) * 0.25 * this.strafe, z: (dx / (d || 1)) * 0.25 * this.strafe };
    }
    const nav = G.nav;
    if (!nav || lineClear(nav, this.pos.x, this.pos.z, g.x, g.z)) { this.path = null; return { x: dx / d, z: dz / d }; }
    this.pathT -= dt;
    if ((!this.path || this.pathT <= 0) && (G.navBudget ?? 0) > 0) {
      G.navBudget--; this.pathT = 1.2 + Math.random() * 0.6;
      const r = findPath(nav, this.pos.x, this.pos.z, g.x, g.z);
      this.path = r ? r.pts : null; this.pathIdx = 0;
    }
    if (this.path) {
      while (this.pathIdx < this.path.length && Math.hypot(this.path[this.pathIdx].x - this.pos.x, this.path[this.pathIdx].z - this.pos.z) < 0.9) this.pathIdx++;
      if (this.pathIdx < this.path.length) { const w = this.path[this.pathIdx], wx = w.x - this.pos.x, wz = w.z - this.pos.z, wd = Math.hypot(wx, wz) || 1; return { x: wx / wd, z: wz / wd }; }
      this.path = null;
    }
    return { x: dx / d, z: dz / d };
  }

  // ---- fighting ----
  fightAt(dt, t, dist, nx, nz) {
    if (this.reactT > 0) return;
    // U29: a charged super goes off as soon as a foe is in its reach; while it lasts it replaces the guns
    if (this.superActive) { this.superStep(dt, t, dist); return; }
    if (this.superCharge >= 100 && this.superReady(t, dist)) { this.startSuper(t, dist); return; }
    // melee up close, the grenade at a distant foe, the class ability when it fits
    if (dist < 2.6 && this.meleeT <= 0) { this.meleeT = 1.4; this.melee(t); return; }
    if (this.abilityT <= 0 && dist > 6 && dist < 28) { this.abilityT = AI.abilityEvery * (0.7 + Math.random() * 0.6); this.grenade(t); }
    if (this.classT <= 0) this.useClass(t, dist);
    // U29: the right gun for the range: heavy when it has ammo, then a special in its band, else the primary
    const has = (w) => w && w.ammo + (w.reserve || 0) > 0;
    const pick = has(this.heavy) && inBand(this.heavy.id, dist) ? this.heavy : has(this.special) && inBand(this.special.id, dist) ? this.special : this.primary;
    if (pick !== this.cur && this.reloadT <= 0) this.equip(pick);
    const w = this.cur;
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.finishReload(w); return; }
    if (w.ammo <= 0) { if (w !== this.primary && w.reserve <= 0) { this.equip(this.primary); return; } this.reloadT = w.A.reload; return; }
    this.fireT -= dt;
    if (this.fireT > 0) return;
    const A = w.A;
    if (A.charge && this.chargeT < A.charge) { this.chargeT += dt + 0.0001; this.fireT = 0; return; } // a charge weapon spins up first
    this.chargeT = 0;
    this.shoot(w, t, dist);
    // rate: bursts, semi pacing and a small pause between bursts so it does not hose
    if (A.mode === 'burst') { this.burstN++; this.fireT = this.burstN % A.burst === 0 ? A.burstDelay + AI.fireGap : w.rate; }
    else if (A.mode === 'auto' || A.mode === 'beam') { this.burstN++; if (this.burstN >= 8 + Math.floor(Math.random() * 8)) { this.burstN = 0; this.fireT = AI.fireGap * 2.5 + w.rate; } else this.fireT = w.rate; }
    else this.fireT = w.rate + AI.fireGap * 1.5; // semi, charge and the rest
    void nx; void nz;
  }

  // ---- movement helpers (U29) ----
  /** The top of a collider just ahead in direction (dx, dz) that is worth jumping onto, or null. */
  ledgeAhead(dx, dz) {
    const px = this.pos.x + dx * (this.radius + 0.5), pz = this.pos.z + dz * (this.radius + 0.5), feet = this.pos.y;
    let top = null;
    for (const c of G.colliders) {
      if (c.pass && !(c.team && c.team !== this.team)) continue;
      if (px < c.min.x || px > c.max.x || pz < c.min.z || pz > c.max.z || c.min.y > feet + 1.6) continue;
      const h = c.max.y - feet;
      if (h > AI.jumpReach) return null; // a real wall: path around it
      if (h > 0.5 && (top === null || c.max.y > top)) top = c.max.y;
    }
    return top;
  }
  jump() { if (!this.onGround) return; this.stat.jumps++; this.vel.y = AI.jumpV; this.onGround = false; this.netAir = true; }

  // ---- abilities (U29) ----
  /** Where a foe will be after `t` seconds (it leads a moving target a little). */
  lead(f, t) { const v = f.vel || _hit.set(0, 0, 0); return new THREE.Vector3(f.pos.x + (v.x || 0) * t * 0.6, f.pos.y, f.pos.z + (v.z || 0) * t * 0.6); }
  hit(f, dmg, how) { // a PvP ability or super hit on one foe
    this.how = how;
    if (f.isGuardian) f.takePvp(dmg, false, this); else pvpDamagePlayer(dmg, { attacker: this, from: this.pos });
  }
  area(p, r, dmg, how) { this.how = how; damageFoesInRadius(p, r, dmg, this); }
  sees(f) { return hasLOS(_a.set(this.pos.x, this.pos.y + 1.55, this.pos.z), _b.set(f.pos.x, f.pos.y + 1.2, f.pos.z)); }
  /** Runs `fn` after `t` seconds, unless the match ended. */
  later(t, fn) { addTicker({ update(dt) { t -= dt; if (t > 0) return true; if (G.mission?.phase !== 'done') fn(); return false; } }); }
  /** Runs `fn(i)` `n` times, `every` seconds apart, starting after `delay`. */
  repeat(n, every, delay, fn) { let i = 0, t = delay; addTicker({ update(dt) { t -= dt; if (t > 0) return true; if (G.mission?.phase === 'done') return false; fn(i++); t = every; return i < n; } }); }

  melee(t) {
    const r = abilityDamage('melee', 0, {});
    this.how = 'Melee';
    sparks(_b.set(t.pos.x, t.pos.y + 1.2, t.pos.z), TEAM_HEX[this.team], 10, 6, 0.09, 0.3);
    if (t.isGuardian) t.takePvp(r.dmg, false, this); else pvpDamagePlayer(r.dmg, { attacker: this, from: this.pos });
  }

  /** The grenade it rolled this match: thrown at the foe, it plays that grenade's own effect and deals PvP numbers. */
  grenade(t) {
    this.stat.grenades++;
    const g = this.grenadeK, el = this.element, at = this.lead(t, 0.8), me = this, name = g.name;
    at.y = t.pos.y + 0.3;
    const T = BA.grenade[g.fx] || BA.grenade.burst;
    this.later(0.8, () => {
      if (g.fx === 'pulse') { npcFx('pulse', { p: at, el, n: T.n }); me.area(at, T.r, T.first, name); me.repeat(T.n, 0.5, 0.5, () => me.area(at, T.r, T.tick, name)); }
      else if (g.fx === 'storm') { npcFx('storm', { p: at, life: T.n * 0.6 }); me.repeat(T.n, 0.6, 0.3, () => me.area(at, T.r, T.tick, name)); }
      else if (g.fx === 'vortex') { npcFx('vortex', { p: at }); me.repeat(T.n, 0.5, 0.25, (i) => me.area(at, T.r, i === T.n - 1 ? T.last : T.tick, name)); }
      else { npcFx('burst', { p: at, el }); explosionFx(at, 3, ELEMENTS[el]?.hex ?? 0xffffff); me.area(at, T.r, T.dmg, name); }
      sfx.explosion?.(3, at, el);
    });
  }

  /** Its class ability: a barricade toward the foe (Titan), a dodge with a reload or melee refill (Hunter), a rift at its feet (Warlock). */
  useClass(t, dist) {
    const k = this.classK;
    if (!k) return;
    const hurt = this.pool < (this.maxHp + this.maxShield) * 0.6;
    const feet = new THREE.Vector3(this.pos.x, this.pos.y, this.pos.z);
    if (k.id === 'barricade' || k.id === 'rally') {
      if (!t || dist < 7 || (!hurt && Math.random() < 0.5)) { this.classT = 2; return; }
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z, d = Math.hypot(dx, dz) || 1;
      const p = new THREE.Vector3(this.pos.x + (dx / d) * 1.8, this.pos.y, this.pos.z + (dz / d) * 1.8);
      npcFx('barricade', { p, el: this.element, alongX: Math.abs(dz) > Math.abs(dx), small: k.id === 'rally', team: this.team });
      for (const w of [this.primary, this.special]) if (w && w.reserve !== 0) { if (w === this.primary) w.ammo = w.A.mag; else this.finishReload(w); }
      this.reloadT = 0;
    } else if (k.id === 'marksman' || k.id === 'gambler') {
      if (!t || (!hurt && this.cur.ammo > 0 && dist > 3)) { this.classT = 1.5; return; }
      const dx = t ? t.pos.x - this.pos.x : 1, dz = t ? t.pos.z - this.pos.z : 0, d = Math.hypot(dx, dz) || 1;
      this.lungeV.set((-dz / d) * this.strafe * 14, 0, (dx / d) * this.strafe * 14); this.lungeT = 0.22;
      npcFx('dodge', { p: feet, el: this.element });
      if (k.id === 'marksman') { if (this.cur === this.primary) this.cur.ammo = this.cur.A.mag; else this.finishReload(this.cur); this.reloadT = 0; } else this.meleeT = 0;
    } else { // Healing Rift / Empowering Rift
      if (k.id === 'rift' ? !hurt : !t) { this.classT = 2; return; }
      npcFx('rift', { p: feet, el: this.element, kind: k.id, team: this.team });
    }
    this.stat.classes++;
    this.classT = AI.classEvery * (0.8 + Math.random() * 0.4);
  }

  // ---- supers (U29) ----
  superReady(t, dist) {
    const id = this.superId, S = BA[id];
    if (!S || !this.sees(t)) return false;
    if (id === 'well') return dist < 25 && (this.pool < (this.maxHp + this.maxShield) * 0.7 || dist < 15);
    if (id === 'fists' || id === 'staff') return dist < 14;
    if (id === 'stormtrance') return dist < S.range;
    return dist < (S.range || 30);
  }

  startSuper(t, dist) {
    const id = this.superId, S = BA[id], el = this.element, me = this, name = this.superN;
    this.stat.supers++;
    this.superCharge = 0; this.superActive = true; this.superStepT = 0.35; this.superN2 = 0;
    this.hp = this.maxHp; this.shield = this.maxShield; // casting a super restores you, as in the game
    npcFx('superStart', { p: this.pos.clone(), el });
    sfx.superStart?.(el);
    this.how = name;
    if (id === 'hammers' || id === 'fists' || id === 'sentinel' || id === 'staff') this.superT = S.n * S.every + 0.5;
    else if (id === 'stormtrance') this.superT = S.t;
    else this.superT = id === 'goldengun' ? S.n * S.every + 0.4 : 1.2;
    if (id === 'well') { // plant the sword: a blast, then a well that heals its team and burns foes inside
      const p = this.pos.clone();
      npcFx('well', { p, r: S.r, life: S.life, team: this.team });
      npcFx('blast', { p: p.clone().setY(p.y + 0.5), el: 'solar', r: S.r * 0.8 });
      this.area(p, S.r, S.blast, name);
      this.repeat(Math.floor(S.life / 0.5), 0.5, 0.5, () => me.area(p, S.r, S.burn, name));
    } else if (id === 'nova') { // a slow ball of void that erases whoever it lands on
      const at = this.lead(t, 0.7), from = this.pos.clone().setY(this.pos.y + 1.5);
      npcFx('chain', { pts: [from, at.clone().setY(at.y + 1)], el: 'void', beam: true, w: 0.25 });
      this.later(0.7, () => { npcFx('blast', { p: at, el: 'void', r: S.r, big: true }); me.area(at, S.r, S.dmg, name); });
    } else if (id === 'tether') { // Shadowshot: an arrow, then an anchor that hurts and holds foes near it
      const at = t.pos.clone(), from = this.pos.clone().setY(this.pos.y + 1.5);
      npcFx('chain', { pts: [from, at.clone().setY(at.y + 1)], el: 'void', beam: true, w: 0.08 });
      this.later(0.35, () => { npcFx('blast', { p: at, el: 'void', r: S.r }); me.area(at, S.r, S.dmg, name); });
    }
    void dist;
  }

  /** One frame of an active super. `t` may be null (no foe in sight): roaming supers keep running and act when one shows up. */
  superStep(dt, t, dist) {
    const id = this.superId, S = BA[id], el = this.element, name = this.superN;
    this.superT -= dt; this.superStepT -= dt;
    if (this.superT <= 0 || !S) { this.superActive = false; return; }
    if (this.superStepT > 0 || !t || !this.sees(t)) return;
    this.how = name;
    const from = this.pos.clone().setY(this.pos.y + 1.5), aimAt = t.pos.clone().setY(t.pos.y + 1.1);
    if (id === 'goldengun' || id === 'sentinel') {
      if (dist > S.range) return;
      this.superStepT = S.every;
      const lands = Math.random() < (id === 'goldengun' ? 0.75 : 0.85);
      npcFx('chain', { pts: [from, lands ? aimAt : aimAt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3))], el: id === 'goldengun' ? 'solar' : 'void', beam: true, w: id === 'goldengun' ? 0.12 : 0.18 });
      sfx.shot?.(id === 'goldengun' ? 'hand' : 'glaive', this.pos, el);
      if (lands) this.hit(t, S.dmg, name);
      if (id === 'goldengun' && ++this.superN2 >= S.n) this.superActive = false;
    } else if (id === 'hammers') {
      if (dist > S.range) return;
      this.superStepT = S.every;
      const at = this.lead(t, 0.5), me = this;
      npcFx('chain', { pts: [from, at.clone().setY(at.y + 0.5)], el: 'solar', w: 0.06 });
      this.later(0.5, () => { npcFx('blast', { p: at, el: 'solar', r: S.r }); me.area(at, S.r, S.dmg, name); });
    } else if (id === 'fists' || id === 'staff') {
      if (dist > (S.lunge + 3)) return;
      this.superStepT = S.every;
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z, d = Math.hypot(dx, dz) || 1, go = Math.max(0, d - 1.5);
      this.lungeV.set((dx / d) * go / 0.25, 0, (dz / d) * go / 0.25); this.lungeT = 0.25;
      const me = this;
      this.later(0.26, () => {
        if (!me.alive) return;
        const p = me.pos.clone();
        if (id === 'fists') { npcFx('slam', { p, el: 'arc', r: S.r }); me.area(p, S.r, S.dmg, name); }
        else { npcFx('slam', { p, el: 'arc', r: S.reach }); me.area(p, S.reach, S.dmg, name); }
      });
    } else if (id === 'stormtrance') {
      if (dist > S.range) return;
      this.superStepT = S.every;
      npcFx('chain', { pts: [from, aimAt], el: 'arc' });
      this.hit(t, S.dmg, name);
    }
  }

  finishReload(w) {
    if (w === this.primary) { w.ammo = w.A.mag; return; }
    const take = Math.min(w.A.mag, w.reserve); w.ammo = take; w.reserve -= take;
  }

  /** One shot (a volley for pellet weapons): the same ray and PvP numbers a player's shot uses. */
  shoot(w, t, dist) {
    const A = w.A;
    w.ammo--;
    this.how = A.name;
    if (w === this.special) this.stat.specialShots++; else if (w === this.heavy) this.stat.heavyShots++;
    const origin = _a.set(this.pos.x, this.pos.y + 1.5, this.pos.z);
    const aim = _b.set(t.pos.x, t.pos.y + (t.isGuardian || t.eye ? 1.15 : 1.1), t.pos.z);
    const base = new THREE.Vector3().subVectors(aim, origin).normalize();
    const err = AI.aimError * (0.5 + Math.min(dist, 28) / 20) + A.spread * 0.6;
    const pellets = A.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const dir = base.clone();
      dir.x += (Math.random() - 0.5) * 2 * err; dir.y += (Math.random() - 0.5) * 2 * err; dir.z += (Math.random() - 0.5) * 2 * err;
      dir.normalize();
      this.resolve(origin.clone(), dir, w, i === 0);
    }
    sfx.shot?.(A.id, this.pos, 'kinetic');
  }

  resolve(origin, dir, w, drawTracer) {
    const A = w.A, range = Math.max(60, A.range * 3);
    ray.set(origin, dir); ray.far = range;
    const hits = ray.intersectObjects(getHitTargets(), false);
    let end = origin.clone().addScaledVector(dir, range), hitFoe = null, hitCrit = false, hd = range;
    for (const h of hits) {
      const e = h.object.userData.enemy;
      if (e === this) continue; // our own boxes
      if (h.object.userData.barricade === this.team) continue; // U29: its team's barricade lets its shots through
      if (e) {
        if (!e.alive) continue;
        if (e.team === this.team) { end = h.point; hd = h.distance; break; } // a teammate in the way takes the bullet's path (no friendly fire)
        hitFoe = e; hitCrit = !!h.object.userData.crit; end = h.point; hd = h.distance; break;
      }
      end = h.point; hd = h.distance; break;
    }
    // the player is not in the hit list: test their body against the same ray
    const P = G.player;
    if (P && !P.dead && P.team !== this.team && !G.mission.spectate && foesOf(this).includes(P)) {
      _box.min.set(P.pos.x - 0.4, P.pos.y, P.pos.z - 0.4); _box.max.set(P.pos.x + 0.4, P.pos.y + 1.8, P.pos.z + 0.4);
      const p = ray.ray.intersectBox(_box, _hit);
      if (p) {
        const d = p.distanceTo(origin);
        if (d < hd) { hitFoe = P; hitCrit = p.y > P.pos.y + 1.42; end = p.clone(); hd = d; }
      }
    }
    if (A.projectile) { // U29: a rocket or grenade launcher round bursts where it lands (the PvP direct number as the blast)
      const at = end.clone(), me = this, dmg = weaponDamage(A.id, { dist: 0 }).dmg, R = Math.min(5, A.projectile.radius * 0.7);
      this.later(Math.min(0.8, hd / A.projectile.speed), () => { explosionFx(at, R, 0xff9a4a); sfx.explosion?.(R, at, 'solar'); me.how = A.name; damageFoesInRadius(at, R, dmg, me); });
      if (drawTracer) tracer(origin, end, 0xffb070, 0.06, 0.2);
      return;
    }
    if (hitFoe) {
      const crit = hitCrit && Math.random() < AI.headshotChance;
      const r = weaponDamage(A.id, { crit, dist: hd, range: A.range });
      if (!r.oneHit && this.buffT.empower > 0) r.dmg *= 1.2; // a teammate's Empowering Rift or Well
      if (hitFoe.isGuardian) hitFoe.takePvp(r.dmg, r.oneHit, this);
      else pvpDamagePlayer(r.dmg, { attacker: this, oneHit: r.oneHit, crit, from: this.pos });
    }
    if (drawTracer) tracer(origin, end, TEAM_HEX[this.team], 0.03, 0.07);
  }

}

export const AI_CLASSES = AI_CLASS_IDS;
export const AI_ELEMENTS = AI_ELEMENT_IDS;
