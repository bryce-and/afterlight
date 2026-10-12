import * as THREE from 'three';
import { G } from './state.js';
import { CLASSES, ARCHETYPES, WEAPON_SLOTS, ARMOR_SLOTS, ELEMENTS } from './data.js';
import { clamp, lerp, damp } from './util.js';
import { moveBody, hasLOS } from './physics.js';
import { buildGunModel, buildSuperModel } from './models.js';
import { sfx } from './audio.js';
import { tracer, sparks, flashLight, ringFx, lightning } from './effects.js';
import { dealDamage, explode, getHitTargets, addTicker, spawnPlayerProjectile, enemiesNear, missionFailed } from './game.js';
import { getEquipped } from './save.js';
import * as ui from './ui.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _fwd = new THREE.Vector3();
const ray = new THREE.Raycaster();
const UP = new THREE.Vector3(0, 1, 0);

function applySpread(dir, spread) {
  if (spread <= 0) return dir;
  const up = Math.abs(dir.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : UP;
  const right = new THREE.Vector3().crossVectors(dir, up).normalize();
  const up2 = new THREE.Vector3().crossVectors(right, dir).normalize();
  const r = spread * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
  return dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(up2, Math.sin(a) * r).normalize();
}

function makeWeapon(item) {
  if (!item) throw new Error('Player: an equipped weapon is missing from the save.');
  const A = ARCHETYPES[item.arch];
  const perks = new Set([...(item.perks || []), item.exotic].filter(Boolean));
  const mag = Math.max(1, Math.round(item.stats.mag * (perks.has('extmag') ? 1.3 : 1)));
  const primary = A.slot === 'primary';
  return {
    item, A, s: item.stats, has: (p) => perks.has(p), mag, ammo: mag,
    reserve: primary ? Infinity : Math.round(A.reserve * 0.7), maxReserve: primary ? Infinity : Math.round(A.reserve * 1.5),
    fireCd: 0, reloading: false, reloadT: 0, reloadMax: 1, burstLeft: 0, charge: 0, queued: 0, bloom: 0,
    hitCount: 0, precHits: 0, killclipWindow: 0, killclipT: 0, killclipArm: false, model: null,
  };
}

export class Player {
  constructor(save) {
    this.cls = CLASSES[save.classId];
    const st = { ...this.cls.base };
    for (const s of ARMOR_SLOTS) {
      const it = getEquipped(save, s);
      if (it) { st.mob += it.stats.mob; st.res += it.stats.res; st.rec += it.stats.rec; }
    }
    this.stats = st;
    this.maxHealth = 100;
    this.maxShield = Math.round(55 + st.res * 3);
    this.health = this.maxHealth; this.shield = this.maxShield;
    this.regenDelay = clamp(4.6 - st.rec * 0.1, 1.6, 4.6);
    this.regenRate = 40 + st.rec * 2.5;
    this.regenT = 0;
    this.speed = 6.2 * (1 + st.mob * 0.012);
    this.jumpV = 8.2 + st.mob * 0.03;

    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.eye = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.recoilAcc = 0;
    this.onGround = true; this.radius = 0.4; this.height = 1.8; this.eyeH = 1.62;
    const ab = this.cls.abilities;
    this.cd = { grenade: 0, melee: 0, class: 0 };
    this.cdMax = { grenade: ab.grenade.cd, melee: ab.melee.cd, class: ab.class.cd };
    this.meleeLock = 0;
    this.superCharge = 0; this.superActive = null; this.superWasReady = false;
    this.air = { fuel: 1, usedDouble: false };
    this.dash = 0; this.dashDir = new THREE.Vector3();
    this.buffs = { rampage: 0, rampageT: 0, outlaw: 0, inRift: 0 };
    this.dead = false; this.respawnT = 0;
    this.adsT = 0; this.shake = 0; this.bobT = 0; this.kick = 0; this.punchT = 0; this.landDip = 0; this.sprintT = 0;
    this.sway = { x: 0, y: 0 };
    this.lastFire = -10;
    this.sens = 0.0022 * save.settings.sens;
    this.baseFov = save.settings.fov;

    this.viewmodel = new THREE.Group();
    G.camera.add(this.viewmodel);
    this.weapons = WEAPON_SLOTS.map((slot) => makeWeapon(getEquipped(save, slot)));
    for (const w of this.weapons) { w.model = buildGunModel(w.item); w.model.visible = false; this.viewmodel.add(w.model); }
    this.superModel = buildSuperModel(ab.super.id);
    this.superModel.visible = false;
    this.viewmodel.add(this.superModel);
    this.cur = 0; this.switchT = 0; this.switchMax = 0.4;
    this.showModel();
  }

  get weapon() { return this.weapons[this.cur]; }
  activeModel() { return this.superActive ? this.superModel : this.weapon.model; }

  showModel() {
    for (const w of this.weapons) w.model.visible = false;
    this.superModel.visible = false;
    this.activeModel().visible = true;
  }

  spawn(p) {
    this.pos.copy(p); this.vel.set(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.updateCamera(0);
  }

  getForward(out) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  // -------------------------------------------------------------------------
  update(dt) {
    const inp = G.input;
    if (this.dead) {
      this.respawnT -= dt;
      ui.updateDeath(Math.max(0, this.respawnT));
      if (this.respawnT <= 0) {
        if (G.mission.failing) { missionFailed(); return; }
        this.respawn();
      }
      this.updateCamera(dt);
      return;
    }
    const zoom = this.currentZoom();
    const sensMul = 1 / (1 + (zoom - 1) * this.adsT * 0.85);
    this.yaw -= inp.mouse.dx * this.sens * sensMul;
    this.pitch = clamp(this.pitch - inp.mouse.dy * this.sens * sensMul, -1.5, 1.5);
    this.sway.x = damp(this.sway.x, clamp(-inp.mouse.dx * 0.0005, -0.04, 0.04), 10, dt);
    this.sway.y = damp(this.sway.y, clamp(inp.mouse.dy * 0.0005, -0.04, 0.04), 10, dt);
    if (this.recoilAcc > 0) {
      const rec = Math.min(this.recoilAcc, dt * 0.35);
      this.pitch -= rec; this.recoilAcc -= rec;
    }
    this.updateMovement(dt);
    this.updateCombat(dt);
    this.updateAbilities(dt);
    this.updateRegen(dt);
    this.updateCamera(dt);
    this.updateViewmodel(dt);
  }

  currentZoom() {
    if (this.superActive) return 1;
    return this.weapon.A.zoom;
  }

  // -------------------------------------------------------------------------
  updateMovement(dt) {
    const k = G.input.keys;
    let ix = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), iz = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
    const len = Math.hypot(ix, iz);
    if (len > 0) { ix /= len; iz /= len; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = ix * cos + iz * sin, wz = -ix * sin + iz * cos;
    this.moveDir = { x: wx, z: wz, len };
    this.sprinting = !!k.ShiftLeft && iz < 0 && this.adsT < 0.3 && G.time - this.lastFire > 0.35 && !this.weapon.reloading;
    this.sprintT = damp(this.sprintT, this.sprinting ? 1 : 0, 10, dt);
    let speed = this.speed * (this.sprinting ? 1.5 : 1) * lerp(1, 0.55, this.adsT);
    if (this.superActive?.type === 'hammers') speed *= 1.1;
    const accel = this.onGround ? 14 : 2.5;
    this.vel.x = damp(this.vel.x, wx * speed, accel, dt);
    this.vel.z = damp(this.vel.z, wz * speed, accel, dt);
    if (this.dash > 0) {
      this.dash -= dt;
      this.vel.x = this.dashDir.x * 20; this.vel.z = this.dashDir.z * 20;
    }
    this.vel.y -= 24 * dt;
    const jumpPressed = G.input.pressed.Space;
    const j = this.cls.jump;
    if (this.onGround) {
      this.air.usedDouble = false; this.air.fuel = 1;
      if (jumpPressed) { this.vel.y = this.jumpV; this.onGround = false; sfx.jump(); }
    } else if (j === 'double') {
      if (jumpPressed && !this.air.usedDouble) {
        this.air.usedDouble = true;
        this.vel.y = this.jumpV * 0.95;
        this.vel.x += wx * 3; this.vel.z += wz * 3;
        sfx.airMove();
        ringFx(this.pos, 1.2, ELEMENTS[this.cls.element].hex, 0.3);
      }
    } else if (j === 'lift') {
      if (k.Space && this.air.fuel > 0 && this.vel.y < 1.5) {
        if (this.air.fuel === 1) sfx.airMove();
        this.vel.y = Math.min(6.5, this.vel.y + 40 * dt);
        this.air.fuel = Math.max(0, this.air.fuel - dt / 1.1);
        if (Math.random() < 0.5) sparks(_v.copy(this.pos), ELEMENTS.solar.hex, 1, 2, 0.06, 0.3);
      }
    } else if (j === 'glide') {
      if (k.Space && this.air.fuel > 0 && this.vel.y < 0) {
        if (this.air.fuel === 1) sfx.airMove();
        this.vel.y = damp(this.vel.y, -0.7, 8, dt);
        this.vel.x = damp(this.vel.x, wx * speed * 1.35, 3, dt);
        this.vel.z = damp(this.vel.z, wz * speed * 1.35, 3, dt);
        this.air.fuel = Math.max(0, this.air.fuel - dt / 2.6);
        if (Math.random() < 0.4) sparks(_v.copy(this.pos), ELEMENTS.void.hex, 1, 2, 0.06, 0.3);
      }
    }
    const vyBefore = this.vel.y;
    const wasGround = this.onGround;
    const res = moveBody(this.pos, this.vel, dt, this.radius, this.height);
    this.onGround = res.onGround;
    if (!wasGround && this.onGround && vyBefore < -7) { this.landDip = Math.min(0.15, -vyBefore * 0.012); sfx.land(); }
    this.landDip = damp(this.landDip, 0, 10, dt);
    this.eye.set(this.pos.x, this.pos.y + this.eyeH - this.landDip, this.pos.z);
  }

  // -------------------------------------------------------------------------
  updateCombat(dt) {
    const inp = G.input;
    const w = this.weapon;
    for (const ww of this.weapons) {
      ww.fireCd = Math.max(0, ww.fireCd - dt);
      ww.killclipWindow = Math.max(0, ww.killclipWindow - dt);
      ww.killclipT = Math.max(0, ww.killclipT - dt);
      ww.bloom = Math.max(0, ww.bloom - dt * 0.06);
      ww.queued = Math.max(0, ww.queued - dt);
    }
    this.buffs.rampageT -= dt;
    if (this.buffs.rampageT <= 0) this.buffs.rampage = 0;
    this.buffs.outlaw = Math.max(0, this.buffs.outlaw - dt);
    this.buffs.inRift = Math.max(0, this.buffs.inRift - dt);
    this.kick = damp(this.kick, 0, 14, dt);
    this.punchT = Math.max(0, this.punchT - dt);
    w.model.userData.flash.visible = false;
    this.superModel.userData.flash.visible = false;

    if (this.superActive) { this.adsT = damp(this.adsT, 0, 14, dt); this.updateSuper(dt); return; }

    for (let i = 0; i < 3; i++) if (inp.pressed['Digit' + (i + 1)]) this.switchTo(i);
    if (inp.mouse.wheel) this.switchTo((this.cur + (inp.mouse.wheel > 0 ? 1 : 2)) % 3);
    if (this.switchT > 0) { this.switchT -= dt; this.adsT = damp(this.adsT, 0, 14, dt); return; }

    if (inp.pressed.KeyR) this.startReload(w);
    if (w.reloading) {
      w.reloadT -= dt * (this.buffs.inRift > 0 ? 1.6 : 1);
      if (w.reloadT <= 0) this.finishReload(w);
    }
    const wantAds = inp.mouse.right && !w.reloading && this.punchT <= 0;
    this.adsT = damp(this.adsT, wantAds ? 1 : 0, 14, dt);

    const A = w.A;
    const held = inp.mouse.left, pressed = inp.mouse.leftPressed;
    if (pressed) w.queued = 0.18;
    if (w.reloading && pressed && w.ammo > 0) w.reloading = false;
    if (w.reloading || this.punchT > 0) { w.charge = 0; return; }
    if (w.ammo <= 0) {
      w.charge = 0; w.burstLeft = 0;
      if (pressed) sfx.empty();
      if (w.reserve > 0 && w.fireCd <= 0) this.startReload(w);
      return;
    }
    if (A.mode === 'auto') { if (held && w.fireCd <= 0) this.fire(w); }
    else if (A.mode === 'semi') { if (w.queued > 0 && w.fireCd <= 0) { w.queued = 0; this.fire(w); } }
    else if (A.mode === 'burst') { if (w.fireCd <= 0 && (w.burstLeft > 0 || held)) this.fire(w); }
    else if (A.mode === 'charge') {
      if (held && w.fireCd <= 0) {
        if (w.charge === 0) sfx.charge();
        w.charge += dt;
        if (w.charge >= A.charge) { this.fire(w); w.charge = 0; }
      } else w.charge = 0;
    }
  }

  switchTo(i) {
    if (i === this.cur || this.superActive) return;
    const w = this.weapon;
    w.reloading = false; w.charge = 0; w.burstLeft = 0;
    this.cur = i;
    this.switchT = this.switchMax = this.weapon.has('hotswap') ? 0.2 : 0.42;
    this.showModel();
    sfx.swap();
  }

  startReload(w) {
    if (w.reloading || w.ammo >= w.mag || w.reserve <= 0) return;
    w.reloading = true;
    let t = w.s.reload;
    if (this.buffs.outlaw > 0) t *= 0.55;
    if (w.has('hotswap')) t *= 0.85;
    w.reloadT = w.reloadMax = t;
    if (w.killclipWindow > 0) w.killclipArm = true;
    w.burstLeft = 0;
    sfx.reload();
  }

  finishReload(w) {
    const take = Math.min(w.mag - w.ammo, w.reserve);
    w.ammo += take;
    if (w.reserve !== Infinity) w.reserve -= take;
    w.reloading = false;
    if (w.killclipArm) { w.killclipArm = false; w.killclipT = 5; ui.feed('Kill Clip active', '#ffd27a'); }
    sfx.reloadDone();
  }

  instantReload(w) {
    const take = Math.min(w.mag - w.ammo, w.reserve);
    w.ammo += take;
    if (w.reserve !== Infinity) w.reserve -= take;
    w.reloading = false;
  }

  getSpread(w) {
    let s = lerp(w.s.spread, w.A.ads, this.adsT);
    const moving = Math.hypot(this.vel.x, this.vel.z) > 1;
    if (moving) s *= lerp(1.3, 1.05, this.adsT);
    if (!this.onGround) s *= 1.8;
    if (w.has('steady')) s *= 0.65;
    return s + w.bloom * (1 - this.adsT * 0.6);
  }

  muzzlePos(out) {
    const m = this.activeModel();
    G.camera.updateMatrixWorld(true);
    return m.userData.muzzle.getWorldPosition(out);
  }

  weaponDmgMult(w, crit) {
    let m = 1;
    if (w.has('rampage')) m *= 1 + 0.12 * this.buffs.rampage;
    if (w.killclipT > 0) m *= 1.3;
    if (w.has('highcal')) m *= 1.1;
    if (crit && w.has('precise')) m *= 1.2;
    return m;
  }

  fire(w) {
    const A = w.A, s = w.s;
    w.ammo--;
    this.lastFire = G.time;
    if (A.mode === 'burst') {
      if (w.burstLeft <= 0) w.burstLeft = A.burst;
      w.burstLeft--;
      w.fireCd = w.burstLeft > 0 ? 60 / s.rpm : A.burstDelay;
      if (w.ammo <= 0) w.burstLeft = 0;
    } else w.fireCd = 60 / s.rpm;
    const eye = this.eye;
    const fwd = this.getForward(_fwd);
    const spread = this.getSpread(w);
    const muzzle = this.muzzlePos(new THREE.Vector3());
    const el = ELEMENTS[w.item.element];
    if (A.projectile) {
      const dir = applySpread(fwd.clone(), spread);
      const start = eye.clone().addScaledVector(dir, 0.7).add(new THREE.Vector3(0, -0.15, 0));
      spawnPlayerProjectile({
        kind: A.id, pos: start, vel: dir.multiplyScalar(A.projectile.speed), gravity: A.projectile.gravity,
        size: A.projectile.size, color: el.hex, life: 6, tracking: w.has('tracking'),
        onHit: (p, enemy) => this.weaponExplosion(w, p, enemy),
      });
    } else {
      const pellets = A.pellets || 1;
      for (let i = 0; i < pellets; i++) {
        const dir = applySpread(fwd.clone(), spread);
        this.hitscan(eye, dir, w, s.dmg, muzzle, A.id === 'linear' ? { tracerWidth: 0.07, tracerColor: el.hex } : {});
      }
    }
    if (A.bloom) w.bloom = Math.min(0.025, w.bloom + A.bloom);
    const rec = A.recoil * (w.has('steady') ? 0.65 : 1) * lerp(1, 0.7, this.adsT);
    this.pitch += rec; this.recoilAcc += rec * 0.7;
    this.yaw += (Math.random() - 0.5) * rec * 0.5;
    this.kick = Math.min(1, this.kick + 0.35 + rec * 6);
    w.model.userData.flash.visible = true;
    w.model.userData.flash.rotation.z = Math.random() * Math.PI;
    flashLight(muzzle, el.id === 'kinetic' ? 0xffc870 : el.hex, 6, 7, 0.05);
    sfx.shot(A.id);
  }

  hitscan(origin, dir, w, dmg, from, o = {}) {
    const range = o.range ?? Math.max(90, w.s.range * 4);
    ray.set(origin, dir);
    ray.far = range;
    const hits = ray.intersectObjects(getHitTargets(), false);
    const groundT = dir.y < -1e-4 ? -origin.y / dir.y : Infinity;
    let end = null;
    const seen = new Set();
    for (const h of hits) {
      if (h.distance > groundT) break;
      const e = h.object.userData.enemy;
      if (e) {
        if (!e.alive || seen.has(e)) continue;
        seen.add(e);
        const fr = w.s.range;
        const fall = h.distance <= fr ? 1 : Math.max(0.5, 1 - ((h.distance - fr) / (fr * 1.5)) * 0.5);
        this.applyHit(w, e, dmg * fall, !!h.object.userData.crit, h.point, o);
        if (!(o.pierce || w.has('pierce') || w.A?.pierce)) { end = h.point; break; }
      } else {
        end = h.point;
        sparks(h.point, 0xffe0a0, 3, 3, 0.05, 0.25);
        break;
      }
    }
    if (!end) {
      if (groundT < range) { end = origin.clone().addScaledVector(dir, groundT); sparks(end, 0xd8c8a0, 3, 3, 0.05, 0.25); }
      else end = origin.clone().addScaledVector(dir, Math.min(range, 150));
    }
    if (!o.noTracer) tracer(from, end, o.tracerColor ?? (w.item.element === 'kinetic' ? 0xffe3a0 : ELEMENTS[w.item.element].hex), o.tracerWidth ?? 0.02, 0.06);
    return end;
  }

  applyHit(w, e, dmg, crit, point, o = {}) {
    const m = o.isSuper ? 1 : this.weaponDmgMult(w, crit);
    const element = o.element ?? w.item.element;
    const res = dealDamage(e, dmg * m, { crit, precMult: o.precMult ?? w.A.prec, element, weapon: o.isSuper ? null : w, pos: point, source: o.isSuper ? 'super' : 'weapon' });
    if (o.isSuper) return res;
    w.hitCount++;
    if (w.has('endless') && w.hitCount % 3 === 0) w.ammo = Math.min(w.mag, w.ammo + 1);
    if (w.has('chain')) {
      const other = enemiesNear(e.pos, 9, 1, e)[0];
      if (other) {
        const c = other.center(new THREE.Vector3());
        lightning(point, c, ELEMENTS.arc.hex, 0.03);
        dealDamage(other, dmg * m * 0.5, { element: 'arc', source: 'perk', pos: c });
      }
    }
    if (crit && w.has('sunburst')) {
      w.precHits++;
      if (w.precHits % 4 === 0) explode(point, 3.5, dmg * 2.2, 'solar', { source: 'perk' });
    }
    return res;
  }

  weaponExplosion(w, p, enemy) {
    const m = this.weaponDmgMult(w, false);
    const dmg = w.s.dmg * m;
    if (enemy && enemy.alive) dealDamage(enemy, dmg * 0.3, { element: w.item.element, weapon: w, source: 'weapon' });
    explode(p, w.A.projectile.radius, dmg, w.item.element, { weapon: w, source: 'weapon' });
    if (w.has('cluster')) {
      for (let i = 0; i < 4; i++) {
        const off = new THREE.Vector3(Math.cos(i * 1.57) * 3, 0.5, Math.sin(i * 1.57) * 3).add(p);
        let t = 0.2 + i * 0.08;
        addTicker({ update(dt) { t -= dt; if (t <= 0) { explode(off, 2.8, dmg * 0.3, w.item.element, { source: 'perk' }); return false; } return true; } });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Kills & damage
  // -------------------------------------------------------------------------
  onKill(e, o) {
    const typeBonus = e.typeId === 'heavy' ? 4 : e.typeId === 'captain' ? 2 : 0;
    const gain = (o.source === 'ability' ? 5 : 3) + (o.crit ? 1 : 0) + typeBonus;
    if (!this.superActive) this.superCharge = Math.min(100, this.superCharge + gain);
    for (const k of ['grenade', 'melee', 'class']) this.cd[k] = Math.max(0, this.cd[k] - 0.6);
    const w = o.weapon;
    if (!w) return;
    if (w.has('rampage')) { this.buffs.rampage = Math.min(3, this.buffs.rampage + 1); this.buffs.rampageT = 5; }
    if (w.has('killclip')) w.killclipWindow = 3;
    if (w.has('outlaw') && o.crit) this.buffs.outlaw = 6;
    if (w.has('leech')) this.heal(20);
    const c = e.center(new THREE.Vector3());
    if (w.has('firefly') && o.crit) explode(c, 3, 90, 'solar', { source: 'perk' });
    if (w.has('voidheart')) explode(c, 4, 180, 'void', { source: 'perk' });
    if (w.has('scavenger') && w.reserve !== Infinity && Math.random() < 0.4) {
      w.reserve = Math.min(w.maxReserve, w.reserve + (w.A.slot === 'heavy' ? Math.ceil(w.A.brick / 2) : 1));
    }
  }

  heal(n) {
    const h = Math.min(n, this.maxHealth - this.health);
    this.health += h;
    this.shield = Math.min(this.maxShield, this.shield + (n - h));
  }

  addAmmo(slot) {
    const w = this.weapons[WEAPON_SLOTS.indexOf(slot)];
    if (w.has('overflow')) w.ammo = Math.max(w.ammo, w.mag * 2);
    w.reserve = Math.min(w.maxReserve, w.reserve + w.A.brick);
  }

  takeDamage(amount, from) {
    if (this.dead || G.mission.phase === 'done') return;
    if (this.superActive?.type === 'hammers') amount *= 0.6;
    if (this.superActive?.type === 'revolver') amount *= 0.8;
    if (this.dash > 0) amount *= 0.5;
    this.regenT = this.regenDelay;
    const hadShield = this.shield > 0;
    if (this.shield > 0) {
      const a = Math.min(this.shield, amount);
      this.shield -= a; amount -= a;
      if (this.shield <= 0 && hadShield) sfx.playerShieldBreak();
    }
    this.health -= amount;
    sfx.hurt();
    ui.damageFlash();
    if (from) ui.damageDir(from);
    this.shake = Math.max(this.shake, 0.08);
    if (this.health <= 0) this.die();
  }

  die() {
    const M = G.mission;
    this.dead = true; this.health = 0; this.shield = 0;
    this.superActive = null;
    this.viewmodel.visible = false;
    M.deaths++;
    M.revives--;
    if (M.revives < 0) { M.failing = true; this.respawnT = 2.5; }
    else this.respawnT = 5;
    ui.showDeath(M.revives);
    sfx.death();
  }

  respawn() {
    const M = G.mission;
    this.dead = false;
    this.health = this.maxHealth; this.shield = this.maxShield;
    this.pos.copy(M.checkpoint).add(new THREE.Vector3(0, 0, 6));
    this.vel.set(0, 0, 0);
    this.viewmodel.visible = true;
    this.showModel();
    ui.hideDeath();
    ui.centerMessage('Revived', `${M.revives} revive${M.revives === 1 ? '' : 's'} remaining`, 2);
  }

  updateRegen(dt) {
    if (this.regenT > 0) { this.regenT -= dt; return; }
    if (this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + this.regenRate * dt);
    else if (this.shield < this.maxShield) {
      if (this.shield === 0) sfx.shieldRecharge();
      this.shield = Math.min(this.maxShield, this.shield + this.regenRate * 1.4 * dt);
    }
  }

  // -------------------------------------------------------------------------
  // Abilities
  // -------------------------------------------------------------------------
  updateAbilities(dt) {
    for (const k of ['grenade', 'melee', 'class']) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.meleeLock = Math.max(0, this.meleeLock - dt);
    if (!this.superActive) this.superCharge = Math.min(100, this.superCharge + dt * 0.75);
    const ready = this.superCharge >= 100;
    if (ready && !this.superWasReady) { sfx.superReady(); ui.feed('Super ready [X]', ELEMENTS[this.cls.element].color); }
    this.superWasReady = ready;
    const p = G.input.pressed;
    if (p.KeyQ) this.useGrenade();
    if (p.KeyF) this.useMelee();
    if (p.KeyC) this.useClass();
    if (p.KeyX) this.useSuper();
  }

  useGrenade() {
    if (this.cd.grenade > 0) { sfx.denied(); return; }
    this.cd.grenade = this.cdMax.grenade;
    const id = this.cls.abilities.grenade.id;
    const el = this.cls.element;
    const fwd = this.getForward(new THREE.Vector3());
    spawnPlayerProjectile({
      kind: 'grenade', pos: this.eye.clone().addScaledVector(fwd, 0.6), vel: fwd.clone().multiplyScalar(24).add(new THREE.Vector3(0, 4, 0)),
      gravity: 22, size: 0.16, color: ELEMENTS[el].hex, life: 2.0, onHit: (pt) => this.detonateGrenade(id, pt),
    });
    this.punchT = 0.25;
    sfx.throw();
  }

  detonateGrenade(id, pt) {
    pt.y = Math.max(pt.y, 0.3);
    if (id === 'pulse') {
      explode(pt, 3.5, 60, 'solar', { source: 'ability' });
      let n = 6, t = 0.5;
      const zone = makeZoneMesh(pt, 4.5, ELEMENTS.solar.hex);
      addTicker({
        update(dt) {
          t -= dt; zone.rotation.y += dt * 2;
          if (t <= 0) { t = 0.5; n--; explode(pt, 4.5, 45, 'solar', { source: 'ability', small: true }); }
          return n > 0;
        },
        dispose() { G.scene.remove(zone); },
      });
    } else if (id === 'arcbolt') {
      explode(pt, 3.5, 90, 'arc', { source: 'ability' });
      let prev = pt.clone();
      for (const e of enemiesNear(pt, 14, 4)) {
        const c = e.center(new THREE.Vector3());
        lightning(prev, c, ELEMENTS.arc.hex);
        dealDamage(e, 110, { element: 'arc', source: 'ability', pos: c });
        prev = c;
      }
      sfx.zap();
    } else if (id === 'vortex') {
      const zone = makeZoneMesh(pt, 5.5, ELEMENTS.void.hex, true);
      let life = 4, tick = 0;
      addTicker({
        update(dt) {
          life -= dt; tick -= dt;
          zone.rotation.y += dt * 4;
          zone.children[0].scale.setScalar(1 + Math.sin(G.time * 10) * 0.08);
          const c = new THREE.Vector3();
          for (const e of enemiesNear(pt, 6.5, 99)) {
            if (!e.isBoss) { const d = c.copy(pt).sub(e.pos).setY(0); if (d.length() > 0.5) e.knock.addScaledVector(d.normalize(), dt * 14); }
          }
          if (tick <= 0) {
            tick = 0.25;
            for (const e of enemiesNear(pt, 5.5, 99)) dealDamage(e, 22, { element: 'void', source: 'ability' });
          }
          return life > 0;
        },
        dispose() { G.scene.remove(zone); },
      });
      sfx.ability();
    }
  }

  findMeleeTarget(range, cone = 0.6) {
    const fwd = this.getForward(new THREE.Vector3());
    let best = null, bd = Infinity;
    const c = new THREE.Vector3();
    for (const e of G.enemies) {
      if (!e.alive) continue;
      e.center(c);
      const d = c.clone().sub(this.eye);
      const dist = d.length();
      if (dist > range + e.radius) continue;
      if (d.normalize().dot(fwd) < cone) continue;
      if (!hasLOS(this.eye, c)) continue;
      if (dist < bd) { bd = dist; best = e; }
    }
    return best;
  }

  useMelee() {
    if (this.meleeLock > 0) return;
    this.meleeLock = 0.7;
    this.punchT = 0.3;
    const charged = this.cd.melee <= 0;
    const id = this.cls.abilities.melee.id;
    const c = new THREE.Vector3();
    sfx.melee();
    if (charged && id === 'knife') {
      this.cd.melee = this.cdMax.melee;
      const dir = this.getForward(new THREE.Vector3());
      const pseudo = { s: { range: 40 }, A: { prec: 2 }, item: { element: 'arc' }, has: () => false };
      this.hitscan(this.eye, dir, pseudo, 160, this.muzzlePos(new THREE.Vector3()), { isSuper: true, element: 'arc', precMult: 2, range: 45, tracerColor: ELEMENTS.arc.hex, tracerWidth: 0.05 });
      return;
    }
    if (charged && id === 'fist') {
      const t = this.findMeleeTarget(7, 0.7);
      if (t) {
        this.cd.melee = this.cdMax.melee;
        t.center(c);
        const dir = c.clone().sub(this.pos).setY(0).normalize();
        const dist = c.clone().setY(0).distanceTo(_v.copy(this.pos).setY(0));
        this.pos.addScaledVector(dir, Math.max(0, dist - t.radius - 1.0));
        dealDamage(t, 320, { element: 'solar', source: 'ability', pos: c, knock: dir.clone().multiplyScalar(10) });
        explode(c, 3.5, 120, 'solar', { source: 'ability' });
        this.shake = 0.25;
        return;
      }
    }
    if (charged && id === 'siphon') {
      const t = this.findMeleeTarget(12, 0.8);
      if (t) {
        this.cd.melee = this.cdMax.melee;
        t.center(c);
        lightning(this.muzzlePos(new THREE.Vector3()), c, ELEMENTS.void.hex, 0.06);
        dealDamage(t, 180, { element: 'void', source: 'ability', pos: c });
        this.heal(60);
        sfx.heal();
        return;
      }
    }
    const t = this.findMeleeTarget(2.6, 0.5);
    if (t) {
      t.center(c);
      const dir = c.clone().sub(this.pos).setY(0).normalize();
      dealDamage(t, 70, { element: 'kinetic', source: 'melee', pos: c, knock: dir.multiplyScalar(6) });
      sparks(c, 0xffffff, 6, 4, 0.06, 0.3);
    }
  }

  useClass() {
    if (this.cd.class > 0) { sfx.denied(); return; }
    const id = this.cls.abilities.class.id;
    this.cd.class = this.cdMax.class;
    sfx.ability();
    if (id === 'barricade') {
      const fwd = this.getForward(new THREE.Vector3()).setY(0).normalize();
      const p = this.pos.clone().addScaledVector(fwd, 3.2);
      const alongX = Math.abs(fwd.z) > Math.abs(fwd.x);
      const w = alongX ? 5 : 0.6, d = alongX ? 0.6 : 5, h = 2.2;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0xff8b2b, emissive: 0xff6a10, emissiveIntensity: 0.6, transparent: true, opacity: 0.55, flatShading: true }));
      mesh.position.set(p.x, h / 2, p.z);
      G.scene.add(mesh);
      const col = { min: new THREE.Vector3(p.x - w / 2, 0, p.z - d / 2), max: new THREE.Vector3(p.x + w / 2, h, p.z + d / 2) };
      G.colliders.push(col);
      ringFx(p, 3, 0xff8b2b, 0.5);
      for (const ww of this.weapons) this.instantReload(ww);
      let life = 12;
      addTicker({
        update(dt) { life -= dt; mesh.material.opacity = 0.35 + 0.2 * Math.sin(G.time * 4); if (life < 1) mesh.scale.y = life; return life > 0; },
        dispose() { G.scene.remove(mesh); mesh.material.dispose(); const i = G.colliders.indexOf(col); if (i >= 0) G.colliders.splice(i, 1); },
      });
    } else if (id === 'dodge') {
      const md = this.moveDir;
      if (md && md.len > 0) this.dashDir.set(md.x, 0, md.z);
      else this.dashDir.copy(this.getForward(new THREE.Vector3()).setY(0).normalize().negate());
      this.dash = 0.22;
      this.instantReload(this.weapon);
      ringFx(this.pos, 1.5, ELEMENTS.arc.hex, 0.3);
    } else if (id === 'rift') {
      const pt = this.pos.clone();
      const zone = makeZoneMesh(pt, 4.5, 0xb07cff);
      let life = 10;
      const self = this;
      addTicker({
        update(dt) {
          life -= dt; zone.rotation.y += dt;
          if (self.pos.distanceTo(pt) < 4.7 && !self.dead) { self.buffs.inRift = 0.2; self.heal(28 * dt); self.regenT = Math.min(self.regenT, 0.5); }
          return life > 0;
        },
        dispose() { G.scene.remove(zone); },
      });
      sfx.heal();
    }
  }

  useSuper() {
    if (this.superActive) return;
    if (this.superCharge < 100) { sfx.denied(); return; }
    this.superCharge = 0;
    const ab = this.cls.abilities.super;
    const el = ELEMENTS[this.cls.element];
    sfx.superStart();
    ringFx(this.pos, 6, el.hex, 0.7);
    flashLight(this.eye, el.hex, 80, 20, 0.4);
    ui.centerMessage(ab.name, '', 1.5);
    const w = this.weapon;
    w.reloading = false; w.charge = 0;
    if (ab.id === 'hammers') this.superActive = { type: 'hammers', t: 15, max: 15, cd: 0 };
    else if (ab.id === 'revolver') this.superActive = { type: 'revolver', t: 12, max: 12, cd: 0, shots: 6 };
    else this.superActive = { type: 'nova', t: 0.8, max: 0.8, cd: 0, launched: false };
    this.showModel();
  }

  updateSuper(dt) {
    const S = this.superActive;
    S.t -= dt; S.cd -= dt;
    const inp = G.input;
    const fwd = this.getForward(new THREE.Vector3());
    const flash = this.superModel.userData.flash;
    if (S.type === 'hammers' && inp.mouse.left && S.cd <= 0) {
      S.cd = 0.45;
      spawnPlayerProjectile({
        kind: 'hammer', pos: this.eye.clone().addScaledVector(fwd, 0.8), vel: fwd.clone().multiplyScalar(40).add(new THREE.Vector3(0, 3, 0)),
        gravity: 9, size: 0.2, color: ELEMENTS.solar.hex, life: 4, onHit: (p) => explode(p, 4.5, 420, 'solar', { source: 'super' }),
      });
      this.kick = 1; flash.visible = true;
      sfx.shot('hammer');
    }
    if (S.type === 'revolver' && inp.mouse.leftPressed && S.cd <= 0 && S.shots > 0) {
      S.cd = 0.35; S.shots--;
      const pseudo = { s: { range: 200 }, A: { prec: 1.5 }, item: { element: 'arc' }, has: () => false };
      const end = this.hitscan(this.eye, fwd, pseudo, 1100, this.muzzlePos(new THREE.Vector3()), { isSuper: true, element: 'arc', precMult: 1.5, range: 220, tracerColor: ELEMENTS.arc.hex, tracerWidth: 0.08 });
      let prev = end;
      for (const e of enemiesNear(end, 10, 2)) {
        const c = e.center(new THREE.Vector3());
        lightning(prev, c, ELEMENTS.arc.hex, 0.06);
        dealDamage(e, 350, { element: 'arc', source: 'super', pos: c });
        prev = c;
      }
      this.kick = 1; this.pitch += 0.05; flash.visible = true;
      flashLight(this.eye, ELEMENTS.arc.hex, 30, 10, 0.1);
      sfx.shot('revolver');
      if (S.shots <= 0) S.t = Math.min(S.t, 0.5);
    }
    if (S.type === 'nova' && !S.launched && S.t < 0.45) {
      S.launched = true;
      spawnPlayerProjectile({
        kind: 'nova', pos: this.eye.clone().addScaledVector(fwd, 1.2), vel: fwd.clone().multiplyScalar(30), gravity: 0,
        size: 0.7, color: ELEMENTS.void.hex, life: 5,
        onHit: (p) => { explode(p, 10, 2600, 'void', { source: 'super' }); ringFx(p, 16, ELEMENTS.void.hex, 0.8); },
      });
      this.kick = 1;
      sfx.shot('rocket');
    }
    if (S.t <= 0) { this.superActive = null; this.showModel(); }
  }

  // -------------------------------------------------------------------------
  updateCamera(dt) {
    const cam = G.camera;
    this.eye.set(this.pos.x, this.pos.y + (this.dead ? 0.35 : this.eyeH - this.landDip), this.pos.z);
    this.shake = damp(this.shake, 0, 6, dt);
    const sx = (Math.random() - 0.5) * this.shake * 0.25, sy = (Math.random() - 0.5) * this.shake * 0.25;
    cam.position.copy(this.eye);
    cam.rotation.set(this.pitch + sx, this.yaw + sy, this.dead ? 0.4 : 0);
    const fov = this.baseFov / lerp(1, this.currentZoom(), this.adsT) + this.sprintT * 6;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }

  updateViewmodel(dt) {
    const vm = this.viewmodel;
    const model = this.activeModel();
    const ud = model.userData;
    const w = this.weapon;
    const a = this.adsT;
    const hsp = Math.hypot(this.vel.x, this.vel.z);
    const moveK = this.onGround ? Math.min(1, hsp / this.speed) : 0;
    this.bobT += dt * moveK * (this.sprinting ? 12 : 8.5);
    const bobAmp = (this.sprinting ? 0.022 : 0.012) * (1 - a * 0.85);
    vm.position.lerpVectors(ud.hip, ud.ads, a);
    vm.position.x += Math.sin(this.bobT) * bobAmp + this.sway.x * (1 - a);
    vm.position.y += -Math.abs(Math.cos(this.bobT)) * bobAmp + this.sway.y * (1 - a) - this.landDip * 0.5;
    vm.position.z += this.kick * 0.06;
    let rx = this.kick * 0.1, ry = 0, rz = 0;
    if (!this.superActive) {
      if (w.reloading) {
        const r = Math.sin(Math.PI * (1 - w.reloadT / w.reloadMax));
        rx -= r * 0.6; vm.position.y -= r * 0.08; rz += r * 0.4;
      }
      if (this.switchT > 0) vm.position.y -= (this.switchT / this.switchMax) * 0.35;
      if (w.A.mode === 'charge' && w.charge > 0) { vm.position.x += (Math.random() - 0.5) * 0.006 * w.charge; vm.position.y += (Math.random() - 0.5) * 0.006 * w.charge; }
    }
    ry += this.sprintT * 0.5; rx -= this.sprintT * 0.15; vm.position.x -= this.sprintT * 0.04;
    if (this.punchT > 0) { const p = Math.sin((this.punchT / 0.3) * Math.PI); vm.position.x -= p * 0.12; vm.position.y -= p * 0.1; rz += p * 0.5; }
    vm.rotation.set(rx, ry, rz);
    const scoped = !this.superActive && w.A.zoom >= 3 && a > 0.85;
    model.visible = !scoped;
    ui.setScope(scoped);
  }
}

function makeZoneMesh(pt, r, color, sphere = false) {
  const g = new THREE.Group();
  const matA = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  let core;
  if (sphere) core = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.35, 1), matA);
  else core = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 24, 1, true), matA);
  core.position.y = sphere ? 1 : 0.15;
  g.add(core);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.94, r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ring.position.y = 0.06;
  g.add(ring);
  g.position.set(pt.x, 0, pt.z);
  G.scene.add(g);
  return g;
}
