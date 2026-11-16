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
import { PVP_HEALTH, PVP_REF_RES, GUARDIAN_AI as AI, CONTROL, weaponDamage, startLoad, abilityDamage, AI_CLASS_IDS, AI_ELEMENT_IDS } from './pvp.js';
import { getHitTargets, addTicker } from './game.js';
import { aiGoal, foesOf, pvpDamagePlayer, onGuardianDeath, crateGoal, damageFoesInRadius } from './crucible.js';
import { crSendHit } from './crucible-net.js';

const ray = new THREE.Raycaster(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _box = new THREE.Box3(), _hit = new THREE.Vector3();
const TEAM_HEX = { blue: 0x6ec8ff, red: 0xff6a5a };
const SPEED = 6.0, STRAFE = 3.4, GRAVITY = 24;

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** One shot's worth of rules for a primary or special: shots per second, magazine and reload. */
const gunOf = (id) => { const A = ARCHETYPES[id]; return { id, A, mag: A.mag, rate: 60 / A.rpm }; };

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
  center(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z); }
  headPos(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.9, this.pos.z); }
  get eye() { return _a.set(this.pos.x, this.pos.y + 1.55, this.pos.z); }
  flush() {} stagger() {} breakShield() {} onDeath() {}

  /** A new life: full health and shield, the start ammo (js/pvp.js startLoad), at `pos`. */
  spawn(pos) {
    this.pos.copy(pos); this.vel.set(0, 0, 0);
    this.hp = this.maxHp; this.shield = this.maxShield; this.alive = true; this.dieT = 0; this.regenT = 0;
    for (const w of [this.primary, this.special]) if (w) { const L = startLoad(w.id, w.A.slot, w.A.mag); w.ammo = L.ammo; w.reserve = L.reserve; }
    this.cur = this.special && this.special.ammo + this.special.reserve > 0 && Math.random() < 0.4 ? this.special : this.primary;
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
    this.meleeT -= dt; this.abilityT -= dt;

    // movement intent
    let wx = 0, wz = 0, speed = SPEED, facing = null;
    const hurt = this.pool < (this.maxHp + this.maxShield) * AI.regroupHp;
    if (this.tgt) {
      const t = this.tgt, dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z, dist = Math.hypot(dx, dz) || 0.01, nx = dx / dist, nz = dz / dist;
      facing = [nx, nz];
      this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = AI.strafe * (0.6 + Math.random() * 0.8); this.strafe = -this.strafe; }
      const want = Math.min(this.cur.A.range * 0.9, 24);
      let fwd = dist > want * 1.15 ? 1 : dist < Math.min(6, want * 0.5) ? -1 : 0;
      if (hurt) fwd = -1;
      wx = nx * fwd * STRAFE + -nz * this.strafe * STRAFE; wz = nz * fwd * STRAFE + nx * this.strafe * STRAFE;
      speed = STRAFE;
      if (fwd === 1) { // out of effective range: path in to a trading distance (walls are common here, so never walk straight at them)
        const g = this.toGoal(dt, { x: t.pos.x, z: t.pos.z, r: want * 0.8 }); wx = g.x * SPEED; wz = g.z * SPEED; speed = SPEED;
      }
      this.fightAt(dt, t, dist, nx, nz);
    } else {
      const g = this.toGoal(dt);
      wx = g.x * SPEED; wz = g.z * SPEED;
      if (this.cur !== this.primary && this.cur.ammo <= 0) this.cur = this.primary;
      this.burstN = 0;
    }
    // apply
    const len = Math.hypot(wx, wz);
    if (len > speed) { wx *= speed / len; wz *= speed / len; }
    this.vel.x = wx; this.vel.z = wz; this.vel.y -= GRAVITY * dt;
    const res = moveBody(this.pos, this.vel, dt, this.radius, this.height);
    if (res.onGround) this.vel.y = 0;
    this.speedNow = Math.hypot(wx, wz);
    // stuck: jump the path forward
    this.stuckT += dt;
    if (this.stuckT > 0.6) { this.stuckT = 0; if (Math.hypot(this.pos.x - this.lastX, this.pos.z - this.lastZ) < 0.25 && len > 1) { this.path = null; this.goalT = 0; this.strafe = -this.strafe; this.vel.x += -this.strafe * 4; this.vel.z += this.strafe * 4; } this.lastX = this.pos.x; this.lastZ = this.pos.z; }
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
    this.body.update(dt, { speed: this.speedNow, sprint: !this.tgt && this.speedNow > 5, air: this.netAir, pitch: 0, firing });
    this.body.group.traverse((o) => { if (o.material?.emissive && o.userData.slot) o.material.emissiveIntensity = this.flash > 0 ? 1.2 : o.material.emissiveIntensity; });
  }

  /** Steps along the way to the current objective: a zone to take or hold, or a crate when the special is empty. Returns a unit step. */
  toGoal(dt, over) {
    this.goalT -= dt;
    if (!over && (this.goalT <= 0 || !this.goal)) {
      this.goalT = 3 + Math.random() * 3;
      const crate = this.special && this.special.ammo + this.special.reserve <= 0 ? crateGoal(this) : null;
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
    // abilities: a grenade at a distant foe, a melee swing up close
    if (dist < 2.6 && this.meleeT <= 0 && this.reactT <= 0) { this.meleeT = 1.4; this.melee(t); return; }
    if (this.abilityT <= 0 && dist > 8 && dist < 26 && this.reactT <= 0) { this.abilityT = AI.abilityEvery * (0.7 + Math.random() * 0.6); this.grenade(t); }
    if (this.reactT > 0) return;
    const w = this.cur;
    // out of ammo in a special: back to the primary
    if (w !== this.primary && w.ammo + w.reserve <= 0) { this.cur = this.primary; return; }
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.finishReload(w); return; }
    if (w.ammo <= 0) { this.reloadT = w.A.reload; return; }
    this.fireT -= dt;
    if (this.fireT > 0) return;
    const A = w.A;
    if (A.charge && this.chargeT < A.charge) { this.chargeT += dt + 0.0001; this.fireT = 0; return; } // a charge weapon spins up first
    this.chargeT = 0;
    this.shoot(w, t, dist);
    // rate: bursts, semi pacing and a small pause between bursts so it does not hose
    const A2 = A;
    if (A2.mode === 'burst') { this.burstN++; this.fireT = this.burstN % A2.burst === 0 ? A2.burstDelay + AI.fireGap : w.rate; }
    else if (A2.mode === 'auto' || A2.mode === 'beam') { this.burstN++; if (this.burstN >= 8 + Math.floor(Math.random() * 8)) { this.burstN = 0; this.fireT = AI.fireGap * 2.5 + w.rate; } else this.fireT = w.rate; }
    else this.fireT = w.rate + AI.fireGap * 1.5; // semi, charge and the rest
  }

  finishReload(w) {
    if (w === this.primary) { w.ammo = w.A.mag; return; }
    const take = Math.min(w.A.mag, w.reserve); w.ammo = take; w.reserve -= take;
  }

  /** One shot (a volley for pellet weapons): the same ray and PvP numbers a player's shot uses. */
  shoot(w, t, dist) {
    const A = w.A;
    w.ammo--;
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
    if (hitFoe) {
      const crit = hitCrit && Math.random() < AI.headshotChance;
      const r = weaponDamage(A.id, { crit, dist: hd, range: A.range });
      if (hitFoe.isGuardian) hitFoe.takePvp(r.dmg, r.oneHit, this);
      else pvpDamagePlayer(r.dmg, { attacker: this, oneHit: r.oneHit, crit, from: this.pos });
    }
    if (drawTracer) tracer(origin, end, TEAM_HEX[this.team], 0.03, 0.07);
  }

  melee(t) {
    const r = abilityDamage('melee', 0, {});
    sparks(_b.set(t.pos.x, t.pos.y + 1.2, t.pos.z), TEAM_HEX[this.team], 10, 6, 0.09, 0.3);
    if (t.isGuardian) t.takePvp(r.dmg, false, this); else pvpDamagePlayer(r.dmg, { attacker: this, from: this.pos });
  }

  /** A grenade lands on the foe after a short flight (the damage is a PvP ability number, never the PvE one). */
  grenade(t) {
    const at = new THREE.Vector3(t.pos.x, t.pos.y + 0.4, t.pos.z), team = this.team, me = this;
    let life = 0.9;
    addTicker({ update(dt) { life -= dt; if (life > 0) return true; explosionFx(at, 4, TEAM_HEX[team]); sfx.explosion?.(4, at, 'arc'); damageFoesInRadius(at, 4, AI.abilityDmg, me); return false; } });
  }
}

export const AI_CLASSES = AI_CLASS_IDS;
export const AI_ELEMENTS = AI_ELEMENT_IDS;
