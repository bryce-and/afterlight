import * as THREE from 'three';
import { G } from './state.js';
import { CLASSES, ARCHETYPES, WEAPON_SLOTS, ARMOR_SLOTS, ELEMENTS } from './data.js';
import { clamp, lerp, damp } from './util.js';
import { moveBody, hasLOS } from './physics.js';
import { buildGunModel, buildSuperModel } from './models.js';
import { sfx } from './audio.js';
import { tracer, sparks, flashLight, ringFx, lightning, glowBurst, ember, beam, shockwave, pillar, flare, swirl, homingMote, afterimage } from './effects.js';
import { dealDamage, explode, getHitTargets, addTicker, spawnPlayerProjectile, enemiesNear, missionFailed, projectileMesh } from './game.js';
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
    this.adsT = 0; this.shake = 0; this.bobT = 0; this.kick = 0; this.punchT = 0; this.punchMax = 0.3; this.punchIsPunch = false; this.landDip = 0; this.sprintT = 0; this.fovKick = 0;
    this.sway = { x: 0, y: 0 };
    this.lastFire = -10;
    this.sens = 0.0022 * save.settings.sens;
    this.baseFov = save.settings.fov;

    this.viewmodel = new THREE.Group();
    G.camera.add(this.viewmodel);
    // a gloved fist + forearm that appears for melee and throws
    this.fist = new THREE.Group();
    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.1), new THREE.MeshStandardMaterial({ color: 0x2a2d33, flatShading: true }));
    const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: ELEMENTS[this.cls.element].hex, emissive: ELEMENTS[this.cls.element].hex, emissiveIntensity: 0.8, flatShading: true }));
    knuckle.position.set(0, 0.02, -0.05);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: 0x3a3f47, flatShading: true }));
    arm.position.z = 0.24;
    this.fist.add(glove, knuckle, arm);
    this.fist.visible = false;
    G.camera.add(this.fist);
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
      // Burst Glide: press Space in the air for an upward burst, keep holding to glide
      if (jumpPressed && !this.air.usedDouble) {
        this.air.usedDouble = true;
        this.air.fuel = 1;
        this.vel.y = Math.max(this.vel.y, 9.4);
        this.vel.x += wx * 2; this.vel.z += wz * 2;
        sfx.airMove();
        const feet = _v.copy(this.pos);
        shockwave(feet, 1.8, ELEMENTS.void.hex, 0.4);
        glowBurst(feet, ELEMENTS.void.hex, 14, 5, 0.08, 0.5, -2, -0.8);
      }
      if (this.air.usedDouble && k.Space && this.air.fuel > 0 && this.vel.y < 1.2) {
        this.vel.y = damp(this.vel.y, this.air.fuel > 0.6 ? 1.0 : -0.7, 6, dt);
        this.vel.x = damp(this.vel.x, wx * speed * 1.35, 3, dt);
        this.vel.z = damp(this.vel.z, wz * speed * 1.35, 3, dt);
        this.air.fuel = Math.max(0, this.air.fuel - dt / 2.8);
        if (Math.random() < 0.6) glowBurst(_v.copy(this.pos), Math.random() < 0.5 ? ELEMENTS.void.hex : 0xe6d0ff, 1, 1.5, 0.06, 0.4, -3, -1);
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
      if (w.precHits % 5 === 0) explode(point, 3.5, dmg * 2.6, w.item.element === 'kinetic' ? 'solar' : w.item.element, { source: 'perk' });
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
    if (w.has('voidheart')) explode(c, 4, 180, w.item.element === 'kinetic' ? 'void' : w.item.element, { source: 'perk' });
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
    if (p.KeyV) this.basicMelee();
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
    const start = this.eye.clone().addScaledVector(fwd, 0.6);
    spawnPlayerProjectile({
      kind: 'grenade', pos: start, vel: fwd.clone().multiplyScalar(24).add(new THREE.Vector3(0, 4, 0)),
      gravity: 22, size: 0.16, color: ELEMENTS[el].hex, life: 2.0, onHit: (pt) => this.detonateGrenade(id, pt),
    });
    flare(start, ELEMENTS[el].hex, 0.4, 0.15);
    this.throwFist(0.32);
    sfx.throw();
  }

  detonateGrenade(id, pt) {
    pt.y = Math.max(pt.y, 0.3);
    const ground = pt.clone().setY(0.05);
    if (id === 'pulse') {
      // Solar Grenade: a lingering sun that pulses six times
      const col = ELEMENTS.solar.hex;
      explode(pt, 3.5, 60, 'solar', { source: 'ability' });
      shockwave(ground, 4.5, col, 0.6);
      pillar(ground, 1.4, 7, col, 3.2, 0.25);
      const zone = makeZoneMesh(pt, 4.5, col, true);
      let n = 6, t = 0.5;
      addTicker({
        update(dt) {
          t -= dt; zone.rotation.y += dt * 2;
          zone.children[0].scale.setScalar(1 + Math.sin(G.time * 14) * 0.12);
          if (Math.random() < 0.6) glowBurst(pt, Math.random() < 0.5 ? col : 0xffd27a, 1, 3, 0.1, 0.6, 4, 0.6);
          if (t <= 0) {
            t = 0.5; n--;
            explode(pt, 4.5, 45, 'solar', { source: 'ability', small: true });
            shockwave(ground, 4.5, col, 0.45);
            glowBurst(pt, col, 10, 5, 0.1, 0.5, 3, 0.6);
          }
          return n > 0;
        },
        dispose() { G.scene.remove(zone); },
      });
    } else if (id === 'arcbolt') {
      // Swarm Grenade: burst, then real seekers home in on up to 4 enemies
      const col = ELEMENTS.solar.hex;
      explode(pt, 3.5, 90, 'solar', { source: 'ability' });
      shockwave(ground, 3.5, col, 0.5);
      glowBurst(pt, 0xffd27a, 20, 8, 0.1, 0.6, 1, 0.5);
      const targets = enemiesNear(pt, 18, 4);
      for (let i = 0; i < 4; i++) {
        const tgt = targets[i % Math.max(1, targets.length)] || null;
        const a = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
        spawnPlayerProjectile({
          kind: 'seeker', pos: pt.clone().add(new THREE.Vector3(0, 0.4, 0)), vel: new THREE.Vector3(Math.cos(a) * 8, 9, Math.sin(a) * 8),
          gravity: tgt ? 0 : 14, size: 0.07, color: col, life: 2.5, target: tgt, turn: 4,
          onHit: (p, e) => {
            if (e && e.alive) dealDamage(e, 110, { element: 'solar', source: 'ability', pos: p.clone() });
            explode(p, 2, 30, 'solar', { source: 'ability', small: true });
            flare(p, col, 1.2, 0.2);
          },
        });
      }
      sfx.zap();
    } else if (id === 'vortex') {
      const col = ELEMENTS.void.hex;
      const zone = makeZoneMesh(pt, 5.5, col, true);
      shockwave(ground, 5.5, col, 0.7);
      flare(pt, 0xe6d0ff, 2.5, 0.3);
      let life = 4, tick = 0;
      addTicker({
        update(dt) {
          life -= dt; tick -= dt;
          zone.rotation.y += dt * 4;
          zone.children[0].scale.setScalar(1 + Math.sin(G.time * 10) * 0.12);
          for (let i = 0; i < 4; i++) swirl(pt, 5.5, i % 2 ? col : 0xe6d0ff, 0.7, true, 0.09, 2.4);
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
        dispose() { G.scene.remove(zone); explode(pt, 4, 80, 'void', { source: 'ability' }); },
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

  /** V: plain melee. Lunges a short way toward a close target. */
  basicMelee() {
    if (this.meleeLock > 0 || this.superActive?.type === 'nova') return;
    this.meleeLock = 0.6;
    this.throwFist(0.3, true);
    sfx.melee();
    const t = this.findMeleeTarget(4.5, 0.55);
    if (!t) return;
    const c = t.center(new THREE.Vector3());
    const dir = c.clone().sub(this.pos).setY(0);
    const dist = dir.length();
    dir.normalize();
    if (dist > 1.6) this.pos.addScaledVector(dir, Math.min(3, dist - t.radius - 1.0));
    dealDamage(t, 70, { element: 'kinetic', source: 'melee', pos: c, knock: dir.clone().multiplyScalar(7) });
    sparks(c, 0xffffff, 8, 5, 0.06, 0.3);
    flare(c, 0xffffff, 0.5, 0.12);
    this.shake = Math.max(this.shake, 0.08);
  }

  /** F: powered class melee (needs the ability charged). */
  useMelee() {
    if (this.meleeLock > 0) return;
    if (this.cd.melee > 0) { sfx.denied(); return; }
    const id = this.cls.abilities.melee.id;
    const fwd = this.getForward(new THREE.Vector3());
    const c = new THREE.Vector3();
    this.meleeLock = 0.6;
    this.cd.melee = this.cdMax.melee;
    sfx.melee();
    if (id === 'knife') {
      // Knife Trick: a real thrown knife
      this.throwFist(0.3);
      const start = this.eye.clone().addScaledVector(fwd, 0.5).add(new THREE.Vector3(0, -0.08, 0));
      spawnPlayerProjectile({
        kind: 'knife', pos: start, vel: fwd.clone().multiplyScalar(46), gravity: 5, size: 0.1, color: ELEMENTS.solar.hex, life: 1.4,
        onHit: (p, e) => this.knifeHit(p, e, fwd.clone()),
      });
      sfx.throw();
      return;
    }
    if (id === 'fist') {
      // Hammer Strike: lunge and slam. No target in range = slam the ground ahead.
      this.throwFist(0.35, true);
      const t = this.findMeleeTarget(7, 0.7);
      let at;
      if (t) {
        t.center(c);
        const dir = c.clone().sub(this.pos).setY(0).normalize();
        const dist = c.clone().setY(0).distanceTo(_v.copy(this.pos).setY(0));
        this.pos.addScaledVector(dir, Math.max(0, dist - t.radius - 1.0));
        dealDamage(t, 320, { element: 'solar', source: 'ability', pos: c, knock: dir.clone().multiplyScalar(10) });
        at = c.clone();
      } else at = this.pos.clone().addScaledVector(fwd.setY(0).normalize(), 2.5).setY(0.6);
      explode(at, 3.5, 120, 'solar', { source: 'ability' });
      shockwave(at.clone().setY(0.05), 6, ELEMENTS.solar.hex, 0.6);
      glowBurst(at, 0xffd27a, 24, 9, 0.12, 0.7, 2, 0.8);
      pillar(at.clone().setY(0), 1.2, 6, ELEMENTS.solar.hex, 0.5, 0.4);
      ui.screenFlash(ELEMENTS.solar.color, 0.25);
      this.fovKick = Math.max(this.fovKick, 6);
      this.shake = 0.3;
      return;
    }
    if (id === 'siphon') {
      // Energy Drain: instant strike on a target in range, otherwise a void bolt
      this.throwFist(0.3);
      const from = this.muzzlePos(new THREE.Vector3());
      const t = this.findMeleeTarget(12, 0.8);
      if (t) { t.center(c); this.drainHit(from, t, c); return; }
      spawnPlayerProjectile({
        kind: 'drain', pos: this.eye.clone().addScaledVector(fwd, 0.6), vel: fwd.clone().multiplyScalar(38), gravity: 0, size: 0.09,
        color: ELEMENTS.void.hex, life: 0.8,
        onHit: (p, e) => { if (e && e.alive) this.drainHit(p, e, e.center(new THREE.Vector3())); else glowBurst(p, ELEMENTS.void.hex, 10, 4, 0.08, 0.4); },
      });
    }
  }

  knifeHit(p, e, dir) {
    const col = ELEMENTS.solar.hex;
    flare(p, col, 0.9, 0.18);
    glowBurst(p, 0xffd27a, 10, 5, 0.07, 0.4, 1, 0.3);
    if (e && e.alive) {
      const crit = p.y > e.pos.y + e.height * 0.8;
      dealDamage(e, 160, { element: 'solar', source: 'ability', crit, precMult: 2, pos: p.clone(), knock: dir.setY(0).normalize().multiplyScalar(4) });
      explode(p, 1.6, 30, 'solar', { source: 'ability', small: true });
      return;
    }
    // stick in the wall/ground for a few seconds
    const stuck = projectileMesh({ kind: 'knife', color: col, size: 0.1 });
    stuck.position.copy(p);
    stuck.lookAt(p.clone().add(dir));
    G.scene.add(stuck);
    let life = 3;
    addTicker({ update(dt) { life -= dt; return life > 0; }, dispose() { G.scene.remove(stuck); } });
    sparks(p, 0xffe0a0, 6, 3, 0.05, 0.3);
  }

  drainHit(from, t, c) {
    const col = ELEMENTS.void.hex;
    beam(from, c, col, 0.07, 0.3);
    lightning(from, c, 0xe6d0ff, 0.03);
    dealDamage(t, 180, { element: 'void', source: 'ability', pos: c });
    flare(c, col, 1.2, 0.25);
    const self = this;
    for (let i = 0; i < 14; i++) homingMote(c, () => self.eye.clone().add(new THREE.Vector3(0, -0.3, 0)), i % 2 ? col : 0xe6d0ff, 0.9, 0.08);
    this.heal(60);
    ui.screenFlash(ELEMENTS.void.color, 0.2);
    sfx.heal();
  }

  throwFist(dur, punch = false) {
    this.punchT = dur; this.punchMax = dur; this.punchIsPunch = punch;
  }

  useClass() {
    if (this.cd.class > 0) { sfx.denied(); return; }
    const id = this.cls.abilities.class.id;
    this.cd.class = this.cdMax.class;
    sfx.ability();
    if (id === 'barricade') {
      const col = 0xff8b2b;
      const fwd = this.getForward(new THREE.Vector3()).setY(0).normalize();
      const p = this.pos.clone().addScaledVector(fwd, 3.2);
      const alongX = Math.abs(fwd.z) > Math.abs(fwd.x);
      const w = alongX ? 5 : 0.6, d = alongX ? 0.6 : 5, h = 2.2;
      const geo = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, emissive: 0xff6a10, emissiveIntensity: 0.7, transparent: true, opacity: 0.5, flatShading: true }));
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending }));
      mesh.add(edges);
      mesh.position.set(p.x, 0, p.z);
      mesh.scale.y = 0.01;
      G.scene.add(mesh);
      const col2 = { min: new THREE.Vector3(p.x - w / 2, 0, p.z - d / 2), max: new THREE.Vector3(p.x + w / 2, h, p.z + d / 2) };
      G.colliders.push(col2);
      shockwave(p.clone().setY(0.05), 4, col, 0.5);
      for (let i = 0; i < 16; i++) {
        const q = p.clone().add(new THREE.Vector3(alongX ? (Math.random() - 0.5) * w : 0, 0.1, alongX ? 0 : (Math.random() - 0.5) * d));
        glowBurst(q, i % 2 ? col : 0xffd27a, 1, 3, 0.1, 0.7, 4, 1);
      }
      for (const ww of this.weapons) this.instantReload(ww);
      ui.feed('All weapons reloaded', '#ffb36b');
      let life = 12, age = 0;
      addTicker({
        update(dt) {
          life -= dt; age += dt;
          mesh.scale.y = Math.min(1, age / 0.25) * (life < 1 ? life : 1);
          mesh.material.opacity = 0.35 + 0.15 * Math.sin(G.time * 4);
          if (Math.random() < 0.3) glowBurst(new THREE.Vector3(p.x + (alongX ? (Math.random() - 0.5) * w : 0), h * Math.random(), p.z + (alongX ? 0 : (Math.random() - 0.5) * d)), col, 1, 1, 0.06, 0.6, 2, 0.5);
          return life > 0;
        },
        dispose() { G.scene.remove(mesh); mesh.material.dispose(); geo.dispose(); const i = G.colliders.indexOf(col2); if (i >= 0) G.colliders.splice(i, 1); },
      });
    } else if (id === 'dodge') {
      const col = ELEMENTS.solar.hex;
      const md = this.moveDir;
      if (md && md.len > 0) this.dashDir.set(md.x, 0, md.z);
      else this.dashDir.copy(this.getForward(new THREE.Vector3()).setY(0).normalize().negate());
      this.dash = 0.22;
      this.instantReload(this.weapon);
      afterimage(this.pos, col, 0.6);
      shockwave(this.pos.clone().setY(0.05), 2, col, 0.35);
      const self = this;
      let t = 0.22;
      addTicker({ update(dt) { t -= dt; afterimage(self.pos, col, 0.35); glowBurst(self.pos.clone().setY(0.9), 0xffd27a, 2, 1, 0.06, 0.3, 0, 0); return t > 0; } });
      this.fovKick = Math.max(this.fovKick, 10);
    } else if (id === 'rift') {
      const col = 0xb07cff;
      const pt = this.pos.clone();
      const zone = makeZoneMesh(pt, 4.5, col);
      shockwave(pt.clone().setY(0.05), 5, col, 0.7);
      pillar(pt, 4.3, 0.6, col, 10, 0.12);
      pillar(pt, 0.5, 9, 0xe6d0ff, 1.0, 0.5);
      let life = 10, pulse = 0;
      const self = this;
      addTicker({
        update(dt) {
          life -= dt; pulse -= dt; zone.rotation.y += dt;
          for (let i = 0; i < 2; i++) swirl(pt, 4.3, i ? col : 0xe6d0ff, 1.4, false, 0.07, 3.5);
          if (pulse <= 0) { pulse = 1; ringFx(pt, 4.5, col, 0.8); }
          if (self.pos.distanceTo(pt) < 4.7 && !self.dead) { self.buffs.inRift = 0.2; self.heal(28 * dt); self.regenT = Math.min(self.regenT, 0.5); }
          return life > 0;
        },
        dispose() { G.scene.remove(zone); },
      });
      ui.screenFlash('#b07cff', 0.2);
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
    // activation spectacle
    const feet = this.pos.clone().setY(0.05);
    shockwave(feet, 9, el.hex, 0.8);
    shockwave(feet, 5, 0xffffff, 0.5);
    pillar(this.pos, 1.6, 14, el.hex, 0.9, 0.45);
    glowBurst(this.pos.clone().setY(1), el.hex, 40, 12, 0.14, 0.9, 3, 0.6);
    flashLight(this.eye, el.hex, 120, 25, 0.6);
    ui.screenFlash(el.color, 0.55);
    this.fovKick = 14;
    this.shake = 0.3;
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
    const hand = this.muzzlePos(new THREE.Vector3());
    if (S.type === 'hammers') {
      if (Math.random() < 0.5) ember(hand, Math.random() < 0.5 ? 0xff8b2b : 0xffd27a, 0.03, 0.25, 0.3);
      if (inp.mouse.left && S.cd <= 0) {
        S.cd = 0.45;
        spawnPlayerProjectile({
          kind: 'hammer', pos: this.eye.clone().addScaledVector(fwd, 0.8), vel: fwd.clone().multiplyScalar(40).add(new THREE.Vector3(0, 3, 0)),
          gravity: 9, size: 0.2, color: ELEMENTS.solar.hex, life: 4,
          onHit: (p) => {
            explode(p, 4.5, 420, 'solar', { source: 'super' });
            shockwave(p.clone().setY(0.05), 6, ELEMENTS.solar.hex, 0.6);
            glowBurst(p, 0xffd27a, 18, 9, 0.12, 0.7, 3, 0.8);
            pillar(p.clone().setY(0), 1.0, 5, ELEMENTS.solar.hex, 0.4, 0.4);
          },
        });
        this.kick = 1; flash.visible = true;
        this.throwFist(0.25);
        sfx.shot('hammer');
      }
    }
    if (S.type === 'revolver' && inp.mouse.leftPressed && S.cd <= 0 && S.shots > 0) {
      S.cd = 0.35; S.shots--;
      const col = ELEMENTS.solar.hex;
      const pseudo = { s: { range: 200 }, A: { prec: 1.5 }, item: { element: 'solar' }, has: () => false };
      const end = this.hitscan(this.eye, fwd, pseudo, 1100, hand, { isSuper: true, element: 'solar', precMult: 1.5, range: 220, noTracer: true });
      beam(hand, end, col, 0.12, 0.4);
      flare(end, 0xffd27a, 2.2, 0.3);
      shockwave(end, 3, col, 0.4);
      glowBurst(end, col, 16, 8, 0.1, 0.5, 1, 0.3);
      let prev = end;
      for (const e of enemiesNear(end, 10, 2)) {
        const c = e.center(new THREE.Vector3());
        beam(prev, c, col, 0.05, 0.3);
        dealDamage(e, 350, { element: 'solar', source: 'super', pos: c });
        flare(c, col, 1.2, 0.25);
        prev = c;
      }
      this.kick = 1; this.pitch += 0.05; flash.visible = true;
      flashLight(this.eye, col, 40, 12, 0.15);
      ui.screenFlash('#ffb547', 0.15);
      this.fovKick = Math.max(this.fovKick, 4);
      sfx.shot('revolver');
      if (S.shots <= 0) S.t = Math.min(S.t, 0.5);
    }
    if (S.type === 'nova') {
      if (!S.launched) for (let i = 0; i < 3; i++) swirl(hand, 0.8, i ? ELEMENTS.void.hex : 0xe6d0ff, 0.4, true, 0.04, 0.3);
      if (!S.launched && S.t < 0.45) {
        S.launched = true;
        spawnPlayerProjectile({
          kind: 'nova', pos: this.eye.clone().addScaledVector(fwd, 1.2), vel: fwd.clone().multiplyScalar(30), gravity: 0,
          size: 0.7, color: ELEMENTS.void.hex, life: 5,
          onHit: (p) => {
            const col = ELEMENTS.void.hex;
            explode(p, 10, 2600, 'void', { source: 'super' });
            const g0 = p.clone().setY(0.05);
            shockwave(g0, 16, col, 0.9);
            let n = 2;
            addTicker({ t: 0.18, update(dt) { this.t -= dt; if (this.t <= 0) { this.t = 0.18; shockwave(g0, 10 + n * 4, n % 2 ? 0xe6d0ff : col, 0.7); n--; } return n > 0; } });
            pillar(g0, 4, 18, col, 0.9, 0.4);
            flare(p, 0xe6d0ff, 9, 0.5);
            glowBurst(p, col, 50, 16, 0.18, 1.0, 2, 0.4);
            for (let i = 0; i < 20; i++) swirl(p, 10, i % 2 ? col : 0xe6d0ff, 0.9, true, 0.15, 3);
            const d = G.player.pos.distanceTo(p);
            if (d < 40) { ui.screenFlash('#b07cff', 0.5 * (1 - d / 40)); G.player.shake = Math.max(G.player.shake, 0.6 * (1 - d / 40)); }
          },
        });
        this.kick = 1;
        this.throwFist(0.35);
        sfx.shot('rocket');
      }
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
    this.fovKick = damp(this.fovKick, 0, 5, dt);
    const fov = this.baseFov / lerp(1, this.currentZoom(), this.adsT) + this.sprintT * 6 + this.fovKick;
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
    const bobAmp = (this.sprinting ? 0.022 : 0.012) * (1 - a * 0.97);
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
    if (this.punchT > 0) {
      const k = 1 - this.punchT / this.punchMax;
      const p = Math.sin(k * Math.PI);
      vm.position.x -= p * 0.14; vm.position.y -= p * 0.14; rz += p * 0.5;
      const ext = this.punchIsPunch ? Math.sin(Math.min(1, k * 1.6) * Math.PI) : Math.sin(k * Math.PI);
      this.fist.visible = true;
      this.fist.position.set(0.2 - ext * 0.14, -0.24 + ext * (this.punchIsPunch ? 0.1 : 0.16), -0.3 - ext * 0.28);
      this.fist.rotation.set(this.punchIsPunch ? 0 : -ext * 0.8, 0, ext * 0.3);
    } else this.fist.visible = false;
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
