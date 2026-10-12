import * as THREE from 'three';
import { G } from './state.js';
import { CLASSES, ARCHETYPES, WEAPON_SLOTS, ARMOR_SLOTS, ELEMENTS } from './data.js';
import { clamp, lerp, damp } from './util.js';
import { moveBody, hasLOS } from './physics.js';
import { buildGunModel, buildSuperModel } from './models.js';
import { sfx } from './audio.js';
import { tracer, sparks, flashLight, ringFx, lightning, glowBurst, ember, beam, shockwave, pillar, flare, swirl, homingMote, afterimage } from './effects.js';
import { dealDamage, explode, getHitTargets, addTicker, spawnPlayerProjectile, enemiesNear, missionFailed, projectileMesh } from './game.js';
import { getEquipped, activeKit } from './save.js';
import { fxTracer, requestLife, DOWN_TIME } from './coop.js';
import { castFx } from './abilities.js';
import { buildCharacter } from './characters.js';
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
  // exotics can change the archetype's handling (burst size, pellets, fire mode...)
  const A = { ...ARCHETYPES[item.arch], ...(item.mods || {}) };
  const perks = new Set([...(item.perks || []), ...(item.exoticPerks || [item.exotic])].filter(Boolean));
  const mag = Math.max(1, Math.round(item.stats.mag * (perks.has('extmag') ? 1.3 : 1)));
  const primary = item.slot === 'primary';
  const reserveBase = item.reserve ?? A.reserve, brick = item.brick ?? A.brick;
  return {
    item, A, s: item.stats, has: (p) => perks.has(p), mag, ammo: mag,
    reserve: primary ? Infinity : Math.round(reserveBase * 0.7), maxReserve: primary ? Infinity : Math.round(reserveBase * 1.5), brick, memento: 0,
    fireCd: 0, reloading: false, reloadT: 0, reloadMax: 1, burstLeft: 0, charge: 0, queued: 0, bloom: 0,
    hitCount: 0, precHits: 0, killclipWindow: 0, killclipT: 0, killclipArm: false, model: null,
  };
}

// Supers hit hard and keep pace with the mission: their damage scales with the same
// multiplier as enemy health, so a super feels as strong in the last mission as the first.
const SUPER_POWER = 2.2;
const superDmg = (n) => n * SUPER_POWER * (G.mission?.hpMult ?? 1);
// damage taken while each super is active
const SUPER_ARMOR = { hammers: 0.45, fists: 0.35, stormtrance: 0.5, revolver: 0.6, tether: 0.6, staff: 0.45, sentinel: 0.5, songflame: 0.6 };
const OVERSHIELD_MAX = 60;
// roaming supers play in third person, over the right shoulder
const TPS_SUPERS = new Set(['hammers', 'fists', 'staff', 'sentinel', 'stormtrance']);
const _ray = new THREE.Raycaster(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _cp = new THREE.Vector3(), _pv = new THREE.Vector3();

export class Player {
  constructor(save) {
    this.cls = activeKit(save);
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
    this.buffs = { rampage: 0, rampageT: 0, outlaw: 0, inRift: 0, empower: 0 };
    this.invisT = 0; this.dashSpeed = 20; this.charge = null;
    this.over = 0; this.overT = 0; this.restoreT = 0; this.lethalT = 0; // overshield, Restoration, Lethal Current
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

  /** In-mission inventory: swap the weapon in slot i for item, keeping the ammo you were carrying. */
  swapWeapon(i, item) {
    const old = this.weapons[i];
    const w = makeWeapon(item);
    if (old.reserve !== Infinity) {
      const total = old.ammo + old.reserve;
      w.ammo = Math.min(w.mag, total);
      w.reserve = Math.min(w.maxReserve, total - w.ammo);
    }
    w.model = buildGunModel(item);
    w.model.visible = false;
    this.viewmodel.remove(old.model);
    this.viewmodel.add(w.model);
    this.weapons[i] = w;
    if (this.cur === i) { this.switchT = this.switchMax; this.adsT = 0; }
    this.showModel();
  }
  get thirdPerson() { return !!this.superActive && !this.dead && TPS_SUPERS.has(this.superActive.type); }

  /** Aim direction from the eye. In third person: toward whatever is under the crosshair, so shots land where you aim. */
  aimForward(out) {
    this.getForward(out);
    if ((this.tpsT || 0) < 0.5) return out;
    _ray.set(G.camera.position, out);
    _ray.far = 250;
    const hit = _ray.intersectObjects(getHitTargets(), false).find((h) => h.distance > 0.5);
    const target = hit ? hit.point : _cp.copy(G.camera.position).addScaledVector(out, 250);
    return out.copy(target).sub(this.eye).normalize();
  }

  /** Your own body, shown while the camera is over the shoulder. */
  updateBody(dt) {
    const k = this.tpsT || 0;
    if (k <= 0.02) {
      if (this.body) this.body.group.visible = false;
      this.viewmodel.visible = !this.dead;
      return;
    }
    if (!this.body) {
      this.body = buildCharacter(G.save.classId, this.cls.element);
      this.body.group.children[1].visible = false; // stage disc
      this.body.group.children[2].visible = false; // stage ring
      this.body.setGun(null);
    }
    const b = this.body.group;
    if (b.parent !== G.scene) G.scene.add(b);
    b.visible = k > 0.3;
    this.viewmodel.visible = !this.dead && k < 0.3;
    const prop = this.thirdPerson ? this.superActive.type : null;
    if (this.bodyProp !== prop) { this.bodyProp = prop; this.body.setProp(prop); }
    b.position.copy(this.pos);
    b.rotation.y = this.yaw + Math.PI;
    this.body.update(dt, { speed: Math.hypot(this.vel.x, this.vel.z), sprint: !!this.sprinting, air: !this.onGround, pitch: this.pitch, firing: false, armsLow: prop === 'fists' && this.punchT <= 0, punch: this.punchT > 0 ? 1 - this.punchT / this.punchMax : 0 });
  }

  get keepsGuns() { return this.superActive?.type === 'songflame'; }
  activeModel() { return this.superActive && !this.keepsGuns ? this.superModel : this.weapon.model; }

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
      const M = G.mission;
      if (M.coop) {
        // downed: teammates can revive us; when the timer runs out a pooled life brings us back
        this.downT -= dt;
        if (this.downT <= 0 && !this.lifeAsked && M.lives > 0) { this.lifeAsked = true; requestLife(); }
        ui.updateDeath(M.lives <= 0 ? 'No lives left: a teammate must revive you'
          : this.downT > 0 ? `Revive in ${Math.ceil(this.downT)}s using a life (${M.lives} left)` : 'Using a life…');
      } else {
        this.respawnT -= dt;
        ui.updateDeath(this.respawnT > 0 ? `Reviving in ${this.respawnT.toFixed(1)}s` : '');
        if (this.respawnT <= 0) {
          if (M.failing) { missionFailed(); return; }
          this.respawn();
        }
      }
      this.updateCamera(dt);
      this.updateBody(dt);
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
    this.updateBody(dt);
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
    if (this.superActive?.type === 'fists') speed *= 1.3;
    const accel = this.onGround ? 14 : 2.5;
    this.vel.x = damp(this.vel.x, wx * speed, accel, dt);
    this.vel.z = damp(this.vel.z, wz * speed, accel, dt);
    if (this.dash > 0) {
      this.dash -= dt;
      this.vel.x = this.dashDir.x * this.dashSpeed; this.vel.z = this.dashDir.z * this.dashSpeed;
      if (this.charge && !this.charge.hit) {
        // Shoulder Charge: slam the first enemy we run into
        const t = G.enemies.find((e) => e.alive && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 1.4 + e.radius);
        if (t) {
          this.charge.hit = true;
          this.dash = 0;
          const c = t.center(new THREE.Vector3());
          dealDamage(t, 280, { element: 'arc', source: 'ability', pos: c, knock: this.dashDir.clone().multiplyScalar(14) });
          explode(c, 3, 100, 'arc', { source: 'ability' });
          castFx('slam', { p: c, el: 'arc', r: 4 });
          this.shake = 0.3;
          sfx.melee();
        }
      }
    } else this.charge = null;
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
        castFx('airburst', { p: this.pos.clone(), el: this.cls.element });
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
        castFx('airburst', { p: this.pos.clone(), el: this.cls.element });
      }
      if (this.air.usedDouble && k.Space && this.air.fuel > 0 && this.vel.y < 1.2) {
        this.vel.y = damp(this.vel.y, this.air.fuel > 0.6 ? 1.0 : -0.7, 6, dt);
        this.vel.x = damp(this.vel.x, wx * speed * 1.35, 3, dt);
        this.vel.z = damp(this.vel.z, wz * speed * 1.35, 3, dt);
        this.air.fuel = Math.max(0, this.air.fuel - dt / 2.8);
        if (Math.random() < 0.6) glowBurst(_v.copy(this.pos), Math.random() < 0.5 ? ELEMENTS[this.cls.element].hex : 0xffffff, 1, 1.5, 0.06, 0.4, -3, -1);
      }
    }
    const vyBefore = this.vel.y;
    const wasGround = this.onGround;
    const res = moveBody(this.pos, this.vel, dt, this.radius, this.height);
    this.onGround = res.onGround;
    if (this.diving && res.onGround) {
      // Phoenix Dive landing
      this.diving = false;
      castFx('phoenix', { p: this.pos.clone(), r: 5 });
      explode(this.pos.clone().setY(0.6), 5, 170, 'solar', { source: 'ability' });
      this.shake = 0.3;
    }
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
      if (G.time - this.lastFire > 0.5) ww.spin = Math.max(0, (ww.spin || 0) - dt * 2);
      ww.queued = Math.max(0, ww.queued - dt);
    }
    this.buffs.rampageT -= dt;
    if (this.buffs.rampageT <= 0) this.buffs.rampage = 0;
    this.buffs.outlaw = Math.max(0, this.buffs.outlaw - dt);
    this.buffs.inRift = Math.max(0, this.buffs.inRift - dt);
    this.buffs.empower = Math.max(0, this.buffs.empower - dt);
    this.invisT = Math.max(0, this.invisT - dt);
    this.kick = damp(this.kick, 0, 14, dt);
    this.punchT = Math.max(0, this.punchT - dt);
    w.model.userData.flash.visible = false;
    this.superModel.userData.flash.visible = false;

    if (this.superActive) {
      this.updateSuper(dt);
      if (!this.keepsGuns) { this.adsT = damp(this.adsT, 0, 14, dt); return; }
    }

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
    else if (A.mode === 'semi') {
      const auto = G.save.settings.fullAuto && held; // Full Auto setting: holding fires at the weapon's own rate
      if ((w.queued > 0 || auto) && w.fireCd <= 0) { w.queued = 0; this.fire(w); }
    }
    else if (A.mode === 'burst') { if (w.fireCd <= 0 && (w.burstLeft > 0 || held)) this.fire(w); }
    else if (A.mode === 'charge') {
      if (held && w.fireCd <= 0) {
        if (w.charge === 0) sfx.charge();
        w.charge += dt * (1 + (w.has('spinup') ? (w.spin || 0) : 0));
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
    if (w.has('memento')) w.memento = 6;
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
    if ((this.tpsT || 0) > 0.5) {
      // right hand of the third-person body
      return out.set(this.pos.x, this.pos.y + 1.3, this.pos.z).addScaledVector(_r.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), 0.35).addScaledVector(this.getForward(_f).setY(0).normalize(), 0.45);
    }
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
    if (this.buffs.empower > 0) m *= 1.25;
    if (this.keepsGuns) m *= 1.3; // Song of Flame
    if (w.memento > 0) m *= 1.4;
    return m;
  }

  fire(w) {
    // Spinning Up: sustained fire ramps the rate of fire
    if (w.has('spinup')) w.spin = Math.min(1, (w.spin || 0) + 60 / w.s.rpm * 0.9);
    const spinMul = w.has('spinup') ? 1 + 0.7 * (w.spin || 0) : 1;
    const A = w.A, s = w.s;
    w.ammo--;
    if (w.memento > 0) w.memento--;
    this.lastFire = G.time;
    if (A.mode === 'burst') {
      if (w.burstLeft <= 0) w.burstLeft = A.burst;
      w.burstLeft--;
      w.fireCd = (w.burstLeft > 0 ? 60 / s.rpm : A.burstDelay) / spinMul;
      if (w.ammo <= 0) w.burstLeft = 0;
    } else w.fireCd = 60 / s.rpm / spinMul;
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
    if (!o.noTracer) {
      const tc = o.tracerColor ?? (w.item.element === 'kinetic' ? 0xffe3a0 : ELEMENTS[w.item.element].hex);
      tracer(from, end, tc, o.tracerWidth ?? 0.02, 0.06);
      fxTracer(from, end, tc);
    }
    return end;
  }

  applyHit(w, e, dmg, crit, point, o = {}) {
    const m = o.isSuper ? 1 : this.weaponDmgMult(w, crit);
    const element = o.element ?? w.item.element;
    const res = dealDamage(e, dmg * m, { crit, precMult: o.precMult ?? w.A.prec, element, weapon: o.isSuper ? null : w, pos: point, source: o.isSuper ? 'super' : 'weapon', shieldBreaker: !o.isSuper && w.has('shieldbreaker') });
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
    if (crit && w.has('whitenail')) {
      // White Nail: three precision hits in a row refill 3 rounds for free
      w.wn = G.time - (w.wnT || 0) < 4 ? (w.wn || 0) + 1 : 1;
      w.wnT = G.time;
      if (w.wn >= 3) { w.wn = 0; w.ammo = Math.min(w.mag, w.ammo + 3); ui.feed('White Nail', '#6dff8e'); sfx.engram(2); }
    } else if (!crit && w.has('whitenail')) w.wn = 0;
    if (w.has('thorn')) {
      // Mark of the Devourer: poison for 3 ticks
      let n = 3, t = 1;
      const tick = dmg * m * 0.15;
      addTicker({ update(dt) { t -= dt; if (t <= 0) { t = 1; n--; if (e.alive) { dealDamage(e, tick, { element: 'kinetic', source: 'perk' }); sparks(e.center(new THREE.Vector3()), 0x6dff8e, 3, 2, 0.06, 0.3); } } return n > 0 && e.alive; } });
    }
    if (w.has('explosive')) explode(point, 2.2, dmg * m * 0.4, w.item.element === 'kinetic' ? 'solar' : w.item.element, { source: 'perk', small: true });
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
      w.reserve = Math.min(w.maxReserve, w.reserve + (w.item.slot === 'heavy' ? Math.ceil(w.brick / 2) : 1));
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
    w.reserve = Math.min(w.maxReserve, w.reserve + w.brick);
  }

  takeDamage(amount, from) {
    if (this.dead || G.mission.phase === 'done') return;
    if (this.superActive) amount *= this.superActive.guard ? 0.15 : SUPER_ARMOR[this.superActive.type] ?? 1;
    if (this.over > 0) { const a = Math.min(this.over, amount); this.over -= a; amount -= a; if (amount <= 0) { sfx.hurt(); return; } }
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
    if (M.coop) {
      this.downT = DOWN_TIME; this.lifeAsked = false;
      ui.showDeath('Downed', 'Hold on: a teammate can revive you');
    } else {
      M.revives--;
      if (M.revives < 0) { M.failing = true; this.respawnT = 2.5; }
      else this.respawnT = 5;
      ui.showDeath('You Have Fallen', M.revives < 0 ? 'No revives remaining' : `Revives remaining: ${M.revives}`);
    }
    sfx.death();
  }

  /** inPlace: revived by a teammate where we fell; otherwise back at the checkpoint. */
  respawn(inPlace = false) {
    const M = G.mission;
    this.dead = false;
    this.health = this.maxHealth; this.shield = this.maxShield;
    if (!inPlace) this.pos.copy(M.checkpoint).add(new THREE.Vector3(0, 0, 6));
    this.vel.set(0, 0, 0);
    this.viewmodel.visible = true;
    this.showModel();
    ui.hideDeath();
    ui.centerMessage('Revived', M.coop ? (inPlace ? 'A teammate picked you up' : `A life was used  ·  ${M.lives} left`) : `${M.revives} revive${M.revives === 1 ? '' : 's'} remaining`, 2);
  }

  /** Restoration (Dawnblade): health and shields regenerate for t seconds, even under fire. */
  restore(t) { this.restoreT = Math.max(this.restoreT, t); }
  /** Overshield (Sentinel): extra protection on top of your shield that fades after a while. */
  addOvershield(n, t = 8) { this.over = Math.min(OVERSHIELD_MAX, this.over + n); this.overT = t; }

  updateRegen(dt) {
    if (this.overT > 0) this.overT -= dt; else this.over = Math.max(0, this.over - dt * 15);
    if (this.restoreT > 0) {
      this.restoreT -= dt;
      this.heal(16 * dt);
      if (Math.random() < 0.2) ember(this.pos.clone().setY(this.pos.y + 0.4 + Math.random()), 0xffb547, 0.04, 1.2, 0.5);
    }
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
    const song = this.keepsGuns ? 8 : 1;
    for (const k of ['grenade', 'melee', 'class']) this.cd[k] = Math.max(0, this.cd[k] - dt * (k === 'class' ? 1 : song));
    this.lethalT = Math.max(0, this.lethalT - dt);
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
      gravity: 22, size: 0.16, color: ELEMENTS[el].hex, life: 2.0, onHit: (pt, e) => this.detonateGrenade(id, pt, e),
    });
    flare(start, ELEMENTS[el].hex, 0.4, 0.15);
    if (this.cls.subclassId === 'dawnblade') this.restore(3); // Dawnblade trait: abilities grant Restoration
    this.throwFist(0.32);
    sfx.throw();
  }

  detonateGrenade(id, pt, hitEnemy = null) {
    pt.y = Math.max(pt.y, 0.3);
    const el = this.cls.element;
    if (id === 'flux') {
      // Flux: sticks to the enemy it hits, then detonates and jolts two more
      const stuck = hitEnemy && hitEnemy.alive ? hitEnemy : null;
      let t = stuck ? 0.6 : 0;
      const self = this;
      addTicker({ update(dt) {
        t -= dt;
        if (stuck && stuck.alive) stuck.center(pt);
        if (Math.random() < 0.5) sparks(pt, ELEMENTS.arc.hex, 2, 3, 0.05, 0.2);
        if (t > 0) return true;
        if (stuck && stuck.alive) dealDamage(stuck, 300, { element: 'arc', source: 'ability', pos: pt.clone() });
        explode(pt.clone(), 3.5, 140, 'arc', { source: 'ability' });
        self.jolt(pt.clone(), 2, 120, stuck);
        return false;
      } });
      return;
    }
    if (id === 'healing') {
      explode(pt.clone(), 4, 150, 'solar', { source: 'ability' });
      castFx('healburst', { p: pt, r: 7 });
      return;
    }
    if (id === 'suppressor') {
      castFx('suppress', { p: pt, r: 6 });
      for (const e of enemiesNear(pt, 6)) dealDamage(e, 150, { element: 'void', source: 'ability', suppress: 4, weaken: 3 });
      this.addOvershield(25);
      return;
    }
    if (id === 'pulse') castFx('pulse', { p: pt, el });
    else if (id === 'vortex') castFx('vortex', { p: pt });
    else if (id === 'storm') castFx('storm', { p: pt });
    else if (id === 'swarm' || id === 'axion') {
      // Swarm Grenade: 4 small seekers. Axion Bolt: 2 strong ones.
      castFx('burst', { p: pt, el });
      const n = id === 'swarm' ? 4 : 2, dmg = id === 'swarm' ? 110 : 170;
      const targets = enemiesNear(pt, 20, n);
      for (let i = 0; i < n; i++) {
        const tgt = targets[i % Math.max(1, targets.length)] || null;
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        spawnPlayerProjectile({
          kind: 'seeker', pos: pt.clone().add(new THREE.Vector3(0, 0.4, 0)), vel: new THREE.Vector3(Math.cos(a) * 8, 9, Math.sin(a) * 8),
          gravity: tgt ? 0 : 14, size: id === 'axion' ? 0.1 : 0.07, color: ELEMENTS[el].hex, life: 2.5, target: tgt, turn: 4,
          onHit: (p, e) => {
            if (e && e.alive) dealDamage(e, dmg, { element: el, source: 'ability', pos: p.clone(), weaken: id === 'axion' ? 2 : 0 });
            explode(p, 2, 30, el, { source: 'ability', small: true });
          },
        });
      }
      sfx.zap();
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
    if (this.superActive?.type === 'sentinel') { this.shieldBash(); return; }
    if (this.cd.melee > 0) { sfx.denied(); return; }
    const id = this.cls.abilities.melee.id;
    const el = this.cls.element;
    const fwd = this.getForward(new THREE.Vector3());
    const c = new THREE.Vector3();
    this.meleeLock = 0.6;
    this.cd.melee = this.cdMax.melee;
    sfx.melee();
    if (id === 'knife' || id === 'snare') {
      this.throwFist(0.3);
      const start = this.eye.clone().addScaledVector(fwd, 0.5).add(new THREE.Vector3(0, -0.08, 0));
      if (id === 'knife') {
        spawnPlayerProjectile({
          kind: 'knife', pos: start, vel: fwd.clone().multiplyScalar(46), gravity: 5, size: 0.1, color: ELEMENTS.solar.hex, life: 1.4,
          onHit: (p, e) => this.knifeHit(p, e, fwd.clone()),
        });
      } else {
        spawnPlayerProjectile({
          kind: 'grenade', pos: start, vel: fwd.clone().multiplyScalar(22).add(new THREE.Vector3(0, 3, 0)), gravity: 20, size: 0.12, color: ELEMENTS.void.hex, life: 1.6,
          onHit: (p) => castFx('snare', { p: p.setY(Math.max(0.3, p.y)) }),
        });
      }
      sfx.throw();
      return;
    }
    if (id === 'hammerthrow') {
      // Throwing Hammer: lands where it hits; walk over it to pick it up and recharge the melee
      this.throwFist(0.32);
      const start = this.eye.clone().addScaledVector(fwd, 0.6);
      spawnPlayerProjectile({
        kind: 'hammer', pos: start, vel: fwd.clone().multiplyScalar(34).add(new THREE.Vector3(0, 2.5, 0)), gravity: 16, size: 0.16, color: ELEMENTS.solar.hex, life: 2.2,
        onHit: (p, e) => {
          if (e && e.alive) dealDamage(e, 280, { element: 'solar', source: 'ability', pos: p.clone(), knock: fwd.clone().setY(0).normalize().multiplyScalar(6) });
          explode(p.clone(), 2.2, 60, 'solar', { source: 'ability', small: true });
          this.dropHammer(p);
        },
      });
      sfx.throw();
      return;
    }
    if (id === 'combo') {
      // Combination Blow: lunge strike; kills heal fully and refund half the melee. Lethal Current doubles it after a dodge.
      this.throwFist(0.32, true);
      const t = this.findMeleeTarget(6, 0.65);
      const lethal = this.lethalT > 0;
      this.lethalT = 0;
      if (!t) { castFx('slam', { p: this.pos.clone().addScaledVector(fwd.clone().setY(0).normalize(), 2).setY(0.6), el: 'arc', r: 3 }); return; }
      t.center(c);
      const dir = c.clone().sub(this.pos).setY(0).normalize();
      const dist = c.clone().setY(0).distanceTo(_v.copy(this.pos).setY(0));
      this.pos.addScaledVector(dir, Math.max(0, dist - t.radius - 1.0));
      const res = dealDamage(t, lethal ? 520 : 260, { element: 'arc', source: 'ability', pos: c, knock: dir.clone().multiplyScalar(8) });
      castFx('slam', { p: c.clone(), el: 'arc', r: lethal ? 5 : 3 });
      if (lethal) this.jolt(c.clone(), 3, 140, t);
      if (res.killed) { this.heal(1000); this.cd.melee *= 0.5; ui.feed('Combination Blow: healed', ELEMENTS.arc.color); sfx.heal(); }
      this.shake = 0.2;
      return;
    }
    if (id === 'snap') {
      // Incinerator Snap: three bursts down a line ahead, each setting enemies alight
      this.throwFist(0.25);
      const flat = fwd.clone().setY(0).normalize();
      [3, 6.5, 10].forEach((d, i) => setTimeout(() => {
        if (!G.mission) return;
        const p = this.eye.clone().addScaledVector(flat, d).setY(Math.max(0.6, this.eye.y - 0.6));
        explode(p, 2.6, 110, 'solar', { source: 'ability' });
        for (const e of enemiesNear(p, 2.6)) this.ignite(e, 30, 3);
      }, i * 70));
      this.restore(2.5);
      sfx.shot('hand');
      return;
    }
    if (id === 'shieldthrow') {
      this.throwFist(0.32);
      this.addOvershield(40);
      this.throwShield(this.eye.clone().addScaledVector(fwd, 0.6), fwd, 3, [220, 160, 120], 'ability');
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
      castFx('slam', { p: at, el: 'solar', r: 6 });
      ui.screenFlash(ELEMENTS.solar.color, 0.25);
      this.fovKick = Math.max(this.fovKick, 6);
      this.shake = 0.3;
      return;
    }
    if (id === 'charge') {
      // Shoulder Charge: a short sprint-tackle; the first enemy in the way takes the hit
      this.dashDir.copy(fwd).setY(0).normalize();
      this.dash = 0.32; this.dashSpeed = 24;
      this.charge = { hit: false };
      this.fovKick = Math.max(this.fovKick, 10);
      return;
    }
    if (id === 'siphon' || id === 'chainl') {
      this.throwFist(0.3);
      const from = this.muzzlePos(new THREE.Vector3());
      const t = this.findMeleeTarget(12, 0.8);
      if (!t) {
        spawnPlayerProjectile({
          kind: 'drain', pos: this.eye.clone().addScaledVector(fwd, 0.6), vel: fwd.clone().multiplyScalar(38), gravity: 0, size: 0.09,
          color: ELEMENTS[el].hex, life: 0.8,
          onHit: (p, e) => { if (e && e.alive) (id === 'siphon' ? this.drainHit(p, e, e.center(new THREE.Vector3())) : this.chainHit(p, e)); else glowBurst(p, ELEMENTS[el].hex, 10, 4, 0.08, 0.4); },
        });
        return;
      }
      t.center(c);
      if (id === 'siphon') this.drainHit(from, t, c); else this.chainHit(from, t);
    }
  }

  /** Throwing Hammer on the ground: stand next to it to pick it up (melee recharged, small heal). */
  dropHammer(p) {
    const at = p.clone();
    at.y = 0.15;
    const mesh = projectileMesh({ kind: 'hammer', color: ELEMENTS.solar.hex, size: 0.16 });
    mesh.position.copy(at);
    mesh.rotation.set(0, Math.random() * 6, Math.PI / 2);
    G.scene.add(mesh);
    const self = this;
    let life = 14;
    addTicker({
      update(dt) {
        life -= dt;
        mesh.position.y = 0.15 + Math.abs(Math.sin(G.time * 3)) * 0.08;
        if (Math.random() < 0.3) ember(at.clone().setY(0.3), 0xffb547, 0.03, 0.8, 0.4);
        const P = G.player;
        if (P === self && !P.dead && Math.hypot(P.pos.x - at.x, P.pos.z - at.z) < 1.6 && Math.abs(P.pos.y - at.y) < 2) {
          P.cd.melee = 0;
          P.heal(30);
          ui.feed('Hammer recovered: melee ready', ELEMENTS.solar.color);
          sfx.engram(1);
          flare(at.clone().setY(0.6), ELEMENTS.solar.hex, 0.8, 0.2);
          return false;
        }
        return life > 0;
      },
      dispose() { G.scene?.remove(mesh); },
    });
  }

  /** Arc jolt: lightning from p into up to n more enemies. */
  jolt(p, n, dmg, skip = null) {
    const pts = [p.clone()];
    for (const e of enemiesNear(p, 10, n + 1)) {
      if (e === skip || !e.alive || pts.length > n) continue;
      const c = e.center(new THREE.Vector3());
      dealDamage(e, dmg, { element: 'arc', source: 'ability', pos: c });
      pts.push(c);
    }
    if (pts.length > 1) castFx('chain', { pts, el: 'arc', w: 0.05 });
  }

  /** Solar burn: dps damage per second for t seconds. */
  ignite(e, dps, t) {
    let left = t, tick = 0.5;
    addTicker({ update(dt) {
      left -= dt; tick -= dt;
      if (tick <= 0 && e.alive) { tick = 0.5; dealDamage(e, dps * 0.5, { element: 'solar', source: 'ability' }); ember(e.center(new THREE.Vector3()), 0xff8b2b, 0.05, 1, 0.4); }
      return left > 0 && e.alive;
    } });
  }

  /** Void shield that ricochets between enemies, then flies back. */
  throwShield(from, dir, bounces, dmgs, source) {
    const col = ELEMENTS.void.hex, self = this;
    const hit = new Set();
    const launch = (pos, vel, target, i) => spawnPlayerProjectile({
      kind: 'shield', pos, vel, gravity: 0, size: 0.22, color: col, life: 1.4, target, turn: 12,
      onHit: (p, e) => {
        if (e && e.alive) {
          hit.add(e);
          dealDamage(e, source === 'super' ? superDmg(dmgs[Math.min(i, dmgs.length - 1)]) : dmgs[Math.min(i, dmgs.length - 1)], { element: 'void', source, pos: p.clone(), weaken: 2 });
          sparks(p, col, 10, 5, 0.07, 0.3);
        }
        const next = i + 1 < bounces ? enemiesNear(p, 14, 6).find((x) => x.alive && !hit.has(x)) : null;
        if (next) {
          const c = next.center(new THREE.Vector3());
          launch(p.clone(), c.sub(p).normalize().multiplyScalar(30), next, i + 1);
        } else if (G.player === self && !self.dead) {
          // fly back to the thrower (visual only)
          const back = self.eye.clone().sub(p);
          spawnPlayerProjectile({ kind: 'shield', pos: p.clone(), vel: back.normalize().multiplyScalar(36), gravity: 0, size: 0.22, color: col, life: Math.min(1.2, p.distanceTo(self.eye) / 36), visualOnly: true, onHit: () => {} });
        }
      },
    });
    launch(from, dir.clone().multiplyScalar(30), enemiesNear(from.clone().addScaledVector(dir, 8), 10, 1)[0] || null, 0);
  }

  /** Sentinel Shield bash (F / V during the super). */
  shieldBash() {
    const S = this.superActive;
    if (S.bashCd > 0) return;
    S.bashCd = 0.55;
    this.throwFist(0.3, true);
    const fwd = this.getForward(new THREE.Vector3()).setY(0).normalize();
    const p = this.pos.clone().addScaledVector(fwd, 2).setY(1);
    for (const e of enemiesNear(p, 3.2)) dealDamage(e, superDmg(300), { element: 'void', source: 'super', pos: e.center(new THREE.Vector3()), knock: fwd.clone().multiplyScalar(12) });
    castFx('slam', { p, el: 'void', r: 4 });
    this.shake = Math.max(this.shake, 0.2);
    sfx.melee();
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
    const stuck = projectileMesh({ kind: 'knife', color: col, size: 0.1 });
    stuck.position.copy(p);
    stuck.lookAt(p.clone().add(dir));
    G.scene.add(stuck);
    let life = 3;
    addTicker({ update(dt) { life -= dt; return life > 0; }, dispose() { G.scene?.remove(stuck); } });
    sparks(p, 0xffe0a0, 6, 3, 0.05, 0.3);
  }

  drainHit(from, t, c) {
    castFx('drain', { a: from, b: c });
    dealDamage(t, 180, { element: 'void', source: 'ability', pos: c });
    this.heal(60);
    ui.screenFlash(ELEMENTS.void.color, 0.2);
    sfx.heal();
  }

  /** Chain Lightning: 150 to the target, then jumps to three more. */
  chainHit(from, t) {
    const pts = [from.clone(), t.center(new THREE.Vector3())];
    dealDamage(t, 150, { element: 'arc', source: 'ability', pos: pts[1] });
    let prev = t;
    const dmgs = [100, 70, 50];
    for (const d of dmgs) {
      const next = enemiesNear(prev.pos, 9, 4).find((e) => e !== prev && e.alive && !pts.some((q) => q.distanceTo(e.center(new THREE.Vector3())) < 0.1));
      if (!next) break;
      const c = next.center(new THREE.Vector3());
      dealDamage(next, d, { element: 'arc', source: 'ability', pos: c });
      pts.push(c);
      prev = next;
    }
    castFx('chain', { pts, el: 'arc', w: 0.06 });
    sfx.zap();
  }

  throwFist(dur, punch = false) {
    this.punchT = dur; this.punchMax = dur; this.punchIsPunch = punch;
  }

  useClass() {
    if (this.superActive?.type === 'staff') return; // Arc Staff dodges are free (handled in the super)
    if (this.cd.class > 0) { sfx.denied(); return; }
    const id = this.cls.abilities.class.id;
    this.cd.class = this.cdMax.class;
    sfx.ability();
    if (id === 'barricade') {
      const fwd = this.getForward(new THREE.Vector3()).setY(0).normalize();
      const p = this.pos.clone().addScaledVector(fwd, 3.2);
      castFx('barricade', { p, alongX: Math.abs(fwd.z) > Math.abs(fwd.x) });
      for (const ww of this.weapons) this.instantReload(ww);
      ui.feed('All weapons reloaded', '#ffb36b');
    } else if (id === 'dodge' || id === 'vanish') {
      const md = this.moveDir;
      if (md && md.len > 0) this.dashDir.set(md.x, 0, md.z);
      else this.dashDir.copy(this.getForward(new THREE.Vector3()).setY(0).normalize().negate());
      this.dash = 0.22; this.dashSpeed = 20;
      this.instantReload(this.weapon);
      castFx(id, { p: this.pos.clone(), el: this.cls.element });
      const self = this, col = ELEMENTS[this.cls.element].hex;
      let t = 0.22;
      addTicker({ update(dt) { t -= dt; afterimage(self.pos, col, 0.35); return t > 0; } });
      this.fovKick = Math.max(this.fovKick, 10);
      if (id === 'vanish') { this.invisT = 4; ui.feed('Invisible', ELEMENTS.void.color); }
    } else if (id === 'gambler') {
      this.staffDodge();
      this.cd.melee = 0;
      this.lethalT = 4;
      ui.feed('Melee ready  ·  Lethal Current', ELEMENTS.arc.color);
    } else if (id === 'phoenix') {
      // Phoenix Dive: from the air, slam down in a solar burst; always heals
      const airborne = !this.onGround && this.pos.y > 0.4;
      if (airborne) { this.vel.set(this.vel.x * 0.2, -30, this.vel.z * 0.2); this.diving = true; }
      else castFx('phoenix', { p: this.pos.clone(), r: 4 });
      this.heal(60);
      this.restore(5);
      sfx.heal();
    } else if (id === 'ward') {
      castFx('ward', { p: this.pos.clone(), r: 6 });
      this.addOvershield(OVERSHIELD_MAX);
    } else if (id === 'rift' || id === 'empower') {
      castFx('rift', { p: this.pos.clone(), kind: id === 'empower' ? 'empower' : 'heal' });
      ui.screenFlash(id === 'empower' ? '#5fd3ff' : '#b07cff', 0.2);
    }
  }

  /** Quick dodge in the movement direction (Gambler's Dodge, Arc Staff). */
  staffDodge() {
    const md = this.moveDir;
    if (md && md.len > 0) this.dashDir.set(md.x, 0, md.z);
    else this.dashDir.copy(this.getForward(new THREE.Vector3()).setY(0).normalize().negate());
    this.dash = 0.22; this.dashSpeed = 21;
    this.instantReload(this.weapon);
    castFx('dodge', { p: this.pos.clone(), el: 'arc' });
    const self = this, col = ELEMENTS.arc.hex;
    let t = 0.22;
    addTicker({ update(dt) { t -= dt; afterimage(self.pos, col, 0.35); return t > 0; } });
    this.fovKick = Math.max(this.fovKick, 10);
  }

  useSuper() {
    if (this.superActive) return;
    if (this.superCharge < 100) { sfx.denied(); return; }
    this.superCharge = 0;
    const ab = this.cls.abilities.super;
    const el = ELEMENTS[this.cls.element];
    sfx.superStart();
    castFx('superStart', { p: this.pos.clone(), el: el.id });
    flashLight(this.eye, el.hex, 120, 25, 0.6);
    ui.screenFlash(el.color, 0.55);
    this.fovKick = 14;
    this.shake = 0.3;
    ui.centerMessage(ab.name, '', 1.5);
    const w = this.weapon;
    w.reloading = false; w.charge = 0;
    const T = { hammers: 15, revolver: 12, nova: 0.8, fists: 14, tether: 10, stormtrance: 12, staff: 14, sentinel: 15, songflame: 12 }[ab.id];
    this.superActive = { type: ab.id, t: T, max: T, cd: 0, shots: ab.id === 'revolver' ? 6 : ab.id === 'tether' ? 3 : 0, launched: false, combo: 0, comboT: 0, bashCd: 0, dodgeCd: 0, auraT: 0 };
    if (ab.id === 'songflame') { this.cd.grenade = 0; this.cd.melee = 0; }
    if (ab.id === 'sentinel') this.addOvershield(OVERSHIELD_MAX, 15);
    this.showModel();
  }

  updateSuper(dt) {
    const S = this.superActive;
    S.t -= dt; S.cd -= dt;
    const inp = G.input;
    const fwd = this.aimForward(new THREE.Vector3());
    const flash = this.superModel.userData.flash;
    const hand = this.muzzlePos(new THREE.Vector3());
    if (S.type === 'hammers') {
      if (Math.random() < 0.5) ember(hand, Math.random() < 0.5 ? 0xff8b2b : 0xffd27a, 0.03, 0.25, 0.3);
      if (inp.mouse.left && S.cd <= 0) {
        S.cd = 0.45;
        spawnPlayerProjectile({
          kind: 'hammer', pos: this.eye.clone().addScaledVector(fwd, 0.8), vel: fwd.clone().multiplyScalar(40).add(new THREE.Vector3(0, 3, 0)),
          gravity: 9, size: 0.2, color: ELEMENTS.solar.hex, life: 4,
          onHit: (p) => { explode(p, 4.5, superDmg(420), 'solar', { source: 'super' }); castFx('blast', { p, el: 'solar', r: 4.5 }); },
        });
        this.kick = 1; flash.visible = true;
        this.throwFist(0.25);
        sfx.shot('hammer');
      }
    }
    if (S.type === 'revolver' && inp.mouse.leftPressed && S.cd <= 0 && S.shots > 0) {
      S.cd = 0.35; S.shots--;
      const pseudo = { s: { range: 200 }, A: { prec: 1.5 }, item: { element: 'solar' }, has: () => false };
      const end = this.hitscan(this.eye, fwd, pseudo, superDmg(1100), hand, { isSuper: true, element: 'solar', precMult: 1.5, range: 220, noTracer: true });
      const pts = [hand.clone(), end.clone()];
      let prev = end;
      for (const e of enemiesNear(end, 10, 2)) {
        const c = e.center(new THREE.Vector3());
        dealDamage(e, superDmg(350), { element: 'solar', source: 'super', pos: c });
        pts.push(c);
        prev = c;
      }
      castFx('chain', { pts, el: 'solar', beam: true, w: 0.12 });
      this.kick = 1; this.pitch += 0.05; flash.visible = true;
      flashLight(this.eye, ELEMENTS.solar.hex, 40, 12, 0.15);
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
          onHit: (p) => { explode(p, 10, superDmg(2600), 'void', { source: 'super' }); castFx('blast', { p, el: 'void', r: 10, big: true }); },
        });
        this.kick = 1;
        this.throwFist(0.35);
        sfx.shot('rocket');
      }
    }
    if (S.type === 'fists') {
      // Fists of Havoc: each click is a lunging arc slam
      if (Math.random() < 0.5) ember(hand, Math.random() < 0.5 ? 0x5fd3ff : 0xffffff, 0.03, 0.25, 0.3);
      if (inp.mouse.leftPressed && S.cd <= 0) {
        S.cd = 0.7;
        this.dashDir.copy(fwd).setY(0).normalize();
        this.dash = 0.18; this.dashSpeed = 26;
        S.slamT = 0.18;
        this.throwFist(0.3, true);
      }
      if (S.slamT !== undefined && S.slamT > 0) {
        S.slamT -= dt;
        if (S.slamT <= 0) {
          const p = this.pos.clone().addScaledVector(this.dashDir, 1.2).setY(0.6);
          explode(p, 5, superDmg(520), 'arc', { source: 'super' });
          castFx('slam', { p, el: 'arc', r: 6 });
          this.shake = Math.max(this.shake, 0.3);
          sfx.explosion(6);
        }
      }
    }
    if (S.type === 'tether' && inp.mouse.leftPressed && S.cd <= 0 && S.shots > 0) {
      // Shadowshot: void arrows that anchor a tether where they land
      S.cd = 0.6; S.shots--;
      spawnPlayerProjectile({
        kind: 'seeker', pos: this.eye.clone().addScaledVector(fwd, 0.8), vel: fwd.clone().multiplyScalar(60), gravity: 3, size: 0.12, color: ELEMENTS.void.hex, life: 3,
        onHit: (p, e) => {
          if (e && e.alive) dealDamage(e, superDmg(300), { element: 'void', source: 'super', pos: p.clone(), weaken: 4 });
          castFx('tether', { p });
        },
      });
      this.kick = 1; flash.visible = true;
      sfx.shot('linear');
      if (S.shots <= 0) S.t = Math.min(S.t, 0.6);
    }
    if (S.type === 'stormtrance') {
      // Stormtrance: hold fire to pour chain lightning on whatever is in front of you
      S.tick = (S.tick ?? 0) - dt;
      if (inp.mouse.left && S.tick <= 0) {
        S.tick = 0.1;
        let best = null, bd = Infinity;
        const c = new THREE.Vector3();
        for (const e of G.enemies) {
          if (!e.alive) continue;
          e.center(c);
          const d = c.clone().sub(this.eye), dist = d.length();
          if (dist > 18 || d.normalize().dot(fwd) < 0.86 || dist >= bd) continue;
          if (!hasLOS(this.eye, c)) continue;
          bd = dist; best = e;
        }
        const pts = [hand.clone()];
        if (best) {
          const bc = best.center(new THREE.Vector3());
          dealDamage(best, superDmg(26), { element: 'arc', source: 'super', pos: bc });
          pts.push(bc);
          for (const e of enemiesNear(best.pos, 8, 3)) {
            if (e === best) continue;
            const ec = e.center(new THREE.Vector3());
            dealDamage(e, superDmg(14), { element: 'arc', source: 'super', pos: ec });
            pts.push(ec);
          }
        } else pts.push(this.eye.clone().addScaledVector(fwd, 10));
        castFx('chain', { pts, el: 'arc', w: 0.07 });
        sfx.zap();
      }
    }
    if (S.type === 'staff') {
      // Arc Staff: three-hit combo, the third is a shockwave; C dodges for free
      S.comboT -= dt; S.dodgeCd -= dt;
      if (S.comboT <= 0) S.combo = 0;
      if (G.input.pressed.KeyC && S.dodgeCd <= 0) { S.dodgeCd = 0.7; this.staffDodge(); }
      if ((inp.mouse.leftPressed || inp.mouse.left) && S.cd <= 0) {
        S.cd = 0.34; S.combo = (S.combo % 3) + 1; S.comboT = 0.9;
        const flat = fwd.clone().setY(0).normalize();
        const center = this.pos.clone().addScaledVector(flat, 2).setY(1);
        const finisher = S.combo === 3;
        for (const e of enemiesNear(center, finisher ? 4.2 : 3.2)) {
          dealDamage(e, superDmg(finisher ? 520 : 260), { element: 'arc', source: 'super', pos: e.center(new THREE.Vector3()), knock: flat.clone().multiplyScalar(finisher ? 12 : 5) });
        }
        castFx(finisher ? 'slam' : 'chain', finisher ? { p: center, el: 'arc', r: 5 } : { pts: [hand.clone(), center.clone().add(new THREE.Vector3(-flat.z * 1.5, 0, flat.x * 1.5)), center.clone().add(new THREE.Vector3(flat.z * 1.5, 0, -flat.x * 1.5))], el: 'arc', w: 0.06 });
        this.throwFist(0.25, true);
        this.superModel.rotation.z = S.combo === 2 ? 0.9 : S.combo === 1 ? -0.9 : 0;
        if (finisher) { this.shake = 0.25; sfx.explosion(4); } else sfx.melee();
      }
    }
    if (S.type === 'sentinel') {
      // Sentinel Shield: click throws the shield (ricochets, returns), hold right-click to guard
      S.bashCd -= dt;
      S.guard = inp.mouse.right;
      this.superModel.position.x = S.guard ? -0.12 : 0;
      if (inp.mouse.leftPressed && S.cd <= 0 && !S.guard) {
        S.cd = 0.9;
        this.throwShield(this.eye.clone().addScaledVector(fwd, 0.6), fwd, 4, [380, 300, 240, 200], 'super');
        this.throwFist(0.3);
        sfx.throw();
      }
    }
    if (S.type === 'songflame') {
      // Song of Flame: keep shooting; abilities recharge fast; empower allies around you
      S.auraT -= dt;
      this.restore(0.5);
      if (S.auraT <= 0) { S.auraT = 2; castFx('songflame', { p: this.pos.clone(), r: 15 }); }
      if (Math.random() < 0.6) ember(hand, Math.random() < 0.5 ? 0xffb547 : 0xff6a2b, 0.04, 1.2, 0.5);
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
    this.tpsT = damp(this.tpsT || 0, this.thirdPerson ? 1 : 0, 6, dt);
    if (this.tpsT > 0.001) {
      const cp = Math.cos(this.pitch);
      _f.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
      _r.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      _pv.copy(this.eye).addScaledVector(_r, 0.45); // shoulder pivot
      _cp.copy(_pv).addScaledVector(_r, 0.35).add({ x: 0, y: 0.3, z: 0 }).addScaledVector(_f, -3.4);
      // pull the camera in front of any wall between it and the shoulder
      const dir = _cp.clone().sub(_pv), len = dir.length();
      _ray.set(_pv, dir.normalize()); _ray.far = len;
      const hit = _ray.intersectObjects(G.staticMeshes, false)[0];
      if (hit) _cp.copy(_pv).addScaledVector(dir, Math.max(0.2, hit.distance - 0.3));
      cam.position.lerpVectors(this.eye, _cp, this.tpsT);
    }
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
      this.fist.visible = (this.tpsT || 0) < 0.3; // first-person only
      this.fist.position.set(0.2 - ext * 0.14, -0.24 + ext * (this.punchIsPunch ? 0.1 : 0.16), -0.3 - ext * 0.28);
      this.fist.rotation.set(this.punchIsPunch ? 0 : -ext * 0.8, 0, ext * 0.3);
    } else this.fist.visible = false;
    vm.rotation.set(rx, ry, rz);
    const scoped = !this.superActive && w.A.zoom >= 3 && a > 0.85;
    model.visible = !scoped;
    ui.setScope(scoped);
  }
}

