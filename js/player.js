import * as THREE from 'three';
import { G } from './state.js';
import { CLASSES, WEAPON_SLOTS, ARMOR_SLOTS, ELEMENTS, EXOTIC_ARMOR_PERKS, DEFAULT_FALLOFF } from './data.js';
import { clamp, lerp, damp } from './util.js';
import { moveBody, hasLOS, pointInColliders } from './physics.js';
import { buildGunModel, buildSuperModel } from './models.js';
import { sfx } from './audio.js';
import { tracer, sparks, flashLight, ringFx, lightning, glowBurst, ember, beam, shockwave, pillar, flare, swirl, homingMote, afterimage, voidMote, VOID_FX } from './effects.js';
import { dealDamage, explode, getHitTargets, addTicker, spawnPlayerProjectile, enemiesNear, missionFailed, projectileMesh } from './game.js';
import { getEquipped, activeKit, playerLevel, wornAppearance } from './save.js';
import { activeSets, encodeAppearance, SET_TUNE } from './style.js';
import { net } from './net.js';
import { MODS_LEVEL, MODS_TUNE, ORB, CHARGE, STAT_KEYS, STAT_CAP, CLASS_STAT, COOLDOWN_FLOOR, armorStats, modCounts, cooldownMult, superRateMult, speedMult, jumpBonus, shieldMax, regenDelay, regenRate, FONT_STAT, usesCharge } from './armor.js';
import { fxTracer, requestLife, DOWN_TIME, sendHit } from './coop.js';
import { castFx } from './abilities.js';
import { buildCharacter, SUPER_POSES } from './characters.js';
import * as ui from './ui.js';
import { StatusSet } from './status.js';
import { regenMult, HAMMER_FUSE, SUPERS, JUMP_TUNE, ASPECT_TUNE, FRAGMENT_TUNE } from './subclass.js';
import { weaponHandling } from './frames.js';
import { CLASS_FX_LIFE, SUPER_TUNE, SUPER_TIME, SUPER_PASSIVE, SUPER_HANDSON, superKillGain, SUPER_POWER, SONG, PRIMARY_BOOST, spreadFor, chainTargets, STORMTRANCE_CHAIN, GOLDEN_GUN_SPLASH, SUPER_DYNAMO, IONIC, NIGHTHAWK, LIARS, RAIDEN, STARFIRE, restHeight, ARC_SOUL, KILL_CD_REFUND, GOLDEN_GUN, NOVA_FIELD, QUIET, URSA, HALLOWFIRE, GRAVITON, AHAMKARA, RASPBERRY, ORPHEUS, SENTINEL_GUARD, DIRE, SUNBRACERS, STORMDANCER, SUPER_ARMOR, BURST_SUPERS, SLAM_SUPERS, SUPER_HOVER, SENTINEL_BARRIER, barrierStops } from './combat.js';
const TARGET_MOD = ['targetp', 'targets', 'targeth'], LOADER_MOD = ['loaderp', 'loaders', 'loaderh'];

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

/** Current element of a weapon (Hard Light cycles its own). */
const wEl = (w) => w.el || w.item.element;
const after = (sec, fn) => { let t = sec; addTicker({ update(dt) { t -= dt; if (t <= 0) { fn(); return false; } return true; } }); };
const VOLATILE_CYCLE = ['arc', 'solar', 'void'];
const WAVE_STEP = 1.5, WAVE_RADIUS = 2.4; // Compressed Wave Frame bursts

function makeWeapon(item) {
  if (!item) throw new Error('Player: an equipped weapon is missing from the save.');
  // the weapon's archetype (frame) and exotic overrides shape its handling (burst size, pellets, charge...)
  const A = weaponHandling(item);
  const perks = new Set([...(item.perks || []), ...(item.exoticPerks || [item.exotic])].filter(Boolean));
  const mag = Math.max(1, Math.round(item.stats.mag * (perks.has('extmag') ? 1.3 : 1)));
  const primary = item.slot === 'primary';
  const reserveBase = item.reserve ?? A.reserve, brick = item.brick ?? A.brick;
  return {
    item, A, s: item.stats, has: (p) => perks.has(p), mag, ammo: mag,
    reserve: primary ? Infinity : Math.round(reserveBase * 0.7), maxReserve: primary ? Infinity : Math.round(reserveBase * 1.5), brick,
    fireCd: 0, reloading: false, reloadT: 0, reloadMax: 1, burstLeft: 0, charge: 0, queued: 0, bloom: 0,
    hitCount: 0, precHits: 0, honed: 0, el: null, voltWin: 0, voltArm: false, reconT: 0, killclipWindow: 0, killclipArm: false, model: null,
  };
}

// Supers hit hard and keep pace with the mission: their damage scales with the same
// multiplier as enemy health, so a super feels as strong in the last mission as the first.
const superDmg = (n) => n * SUPER_POWER * (G.mission?.hpMult ?? 1);
const OVERSHIELD_MAX = 60;
// Daybreak (H3): the first jump goes 2.5x as high (speed x sqrt 2.5), then the wings sink at this speed
const DAYBREAK_JUMP = Math.sqrt(2.5), DAYBREAK_FALL = -1.2;
const SPRINT_CANCEL = 0.5; // H3: seconds of held sprint that cancel a reload
// roaming supers play in third person, over the right shoulder (each super declares its camera in data.js)
const TPS_SUPERS = new Set([...Object.values(CLASSES).flatMap((c) => Object.values(c.subclasses)).map((sc) => sc.abilities.super), ...Object.entries(SUPERS).map(([id, x]) => ({ id, ...x }))].filter((a) => a.camera === 'third').map((a) => a.id));
const _ray = new THREE.Raycaster(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _cp = new THREE.Vector3(), _pv = new THREE.Vector3();

export class Player {
  constructor(save) {
    this.cls = activeKit(save);
    const L = playerLevel(save);
    this.modsOn = L >= MODS_LEVEL; // the mod system: sockets, Orbs of Power, armor charge
    const worn = ARMOR_SLOTS.map((sl) => getEquipped(save, sl)).filter(Boolean);
    this.statBase = armorStats(this.cls.id, worn, L);
    this.ap = modCounts(worn, L); // active mods by id, summed over the four pieces (the former perks keep their ids)
    this.sets = new Set(activeSets(worn)); // destination set bonuses (3 of 4 pieces)
    this.lookCode = encodeAppearance(wornAppearance(save)); // what fireteam members see
    this.maxHealth = 100;
    this.regenT = 0;
    this.finderS = (this.ap.finders || 0) * MODS_TUNE.finderS; this.finderH = (this.ap.finderh || 0) * MODS_TUNE.finderH;
    this.splashMult = Math.max(0.5, 1 - MODS_TUNE.concussive * (this.ap.concussive || 0));
    this.meleeResist = Math.max(0.5, 1 - MODS_TUNE.meleeRes * (this.ap.meleeres || 0));
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.eye = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.recoilAcc = 0;
    this.onGround = true; this.radius = 0.4; this.height = 1.8; this.eyeH = 1.62;
    const ab = this.cls.abilities;
    this.cd = { grenade: 0, melee: 0, class: 0 };
    this.icarus = { n: ASPECT_TUNE.icarus.charges, t: 0 }; // Icarus Dash charges
    // equipped aspects and fragments (subclass loadout)
    this.asp = new Set(this.cls.aspects); this.frag = new Set(this.cls.fragments);
    this.gpKills = 0; this.jugT = 0; this.sentryN = 0; this.prowlUsed = false;
    this.cdBase = { grenade: ab.grenade.cd, melee: ab.melee.cd, class: ab.class.cd };
    this.cdMax = { ...this.cdBase };
    // exotic armor effects (any class can wear any exotic)
    this.exo = new Set(ARMOR_SLOTS.map((sl) => getEquipped(save, sl)).filter((it) => it?.rarity === 'exotic').map((it) => EXOTIC_ARMOR_PERKS[it.name]?.id).filter(Boolean));
    // armor charge and Orbs of Power
    this.armorCharge = 0; this.armorChargeT = 0; this.fonted = false;
    this.orbN = 0; this.superOrbs = 0; this.wKills = []; this.hKills = []; this.harmonicAt = 0; this.emergT = 0;
    this.grenadeWin = 0; this.grenadePending = false; this.grenadeOrbUsed = false; this.meleeWin = 0; this.meleePending = false; this.meleeOrbUsed = false; this.classWin = 0; this.classOrbUsed = false;
    this.shield = undefined;
    this.applyStats();
    this.health = this.maxHealth; this.shield = this.maxShield;
    this.meleeT = 0; // recent melee use (Synthoceps)
    this.meleeLock = 0;
    this.superCharge = 0; this.superActive = null; this.superWasReady = false;
    this.air = { fuel: 1, usedDouble: false, jumps: 0 };
    this.dash = 0; this.dashDir = new THREE.Vector3();
    this.status = new StatusSet(); // every timed effect the player can see (buff HUD)
    this.fightT = 0;
    this.dashSpeed = 20; this.charge = null;
    this.over = 0; // overshield amount (its hold timer is the 'overshield' status)
    this.dead = false; this.respawnT = 0;
    this.adsT = 0; this.shake = 0; this.bobT = 0; this.kick = 0; this.punchT = 0; this.punchMax = 0.3; this.punchIsPunch = false; this.landDip = 0; this.sprintT = 0; this.fovKick = 0;
    this.sway = { x: 0, y: 0 };
    this.guardHits = 0; // hits blocked by Sentinel Shield's guard (fireteam avatars flash when it goes up)
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
    this.weapons = WEAPON_SLOTS.map((slot, i) => Object.assign(makeWeapon(getEquipped(save, slot)), { idx: i }));
    for (const w of this.weapons) { w.model = buildGunModel(w.item); w.model.visible = false; this.viewmodel.add(w.model); }
    if (this.ap.reserves) for (const w of this.weapons) if (w.reserve !== Infinity) { const k = 1 + 0.2 * this.ap.reserves; w.reserve = Math.round(w.reserve * k); w.maxReserve = Math.round(w.maxReserve * k); }
    this.superModel = buildSuperModel(ab.super.id);
    this.superModel.visible = false;
    this.viewmodel.add(this.superModel);
    this.cur = 0; this.switchT = 0; this.switchMax = 0.4;
    this.lungeMul = 1;
    // exotic armor state: Starfire Protocol, Transversive Steps, Dunemarchers (timed effects are statuses)
    this.gBank = 0; this.gBankT = 0; this.trvT = 0; this.dune = 0;
    this.ahamAt = -9; this.freeGAt = -9; this.novaRefund = 0; // Young Ahamkara's Spine, Sunbracers, Skull of Dire Ahamkara
    this.showModel();
  }

  get weapon() { return this.weapons[this.cur]; }

  /** In-mission inventory: swap the weapon in slot i for item, keeping the ammo you were carrying. */
  swapWeapon(i, item) {
    const old = this.weapons[i];
    const w = makeWeapon(item);
    w.idx = i;
    this.status.clearScope(i);
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
  get holdingAxe() { return !this.superActive && !this.dead && this.status.has('voidaxe'); } // U9: a picked-up Twilight Arsenal axe
  get thirdPerson() { return !this.dead && ((!!this.superActive && TPS_SUPERS.has(this.superActive.type)) || this.holdingAxe); }
  /** The prop held in third person: the super's id, or 'twilight' for a picked-up axe. */
  get tpsProp() { return !this.thirdPerson ? null : this.superActive ? this.superActive.type : 'twilight'; }

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
      this.body = buildCharacter(G.save.classId, this.cls.element, wornAppearance(G.save));
      this.body.group.children[1].visible = false; // stage disc
      this.body.group.children[2].visible = false; // stage ring
      this.body.setGun(null);
    }
    const b = this.body.group;
    if (b.parent !== G.scene) G.scene.add(b);
    b.visible = k > 0.3;
    this.viewmodel.visible = !this.dead && k < 0.3;
    const prop = this.tpsProp;
    if (this.bodyProp !== prop) { this.bodyProp = prop; this.body.setProp(prop); }
    b.position.copy(this.pos);
    b.rotation.y = this.yaw + Math.PI;
    this.body.update(dt, { speed: Math.hypot(this.vel.x, this.vel.z), sprint: !!this.sprinting, air: !this.onGround, pitch: this.pitch, firing: false, armsLow: prop === 'fists' && this.punchT <= 0, punch: this.punchT > 0 ? 1 - this.punchT / this.punchMax : 0, guard: prop === 'sentinel' && !!this.superActive?.guard, superPose: this.superPose, hover: this.superHover });
  }

  /** U9: the held pose of the active third-person super (characters.js SUPER_POSES), or null. Burst supers drop it once released. */
  get superPose() {
    const S = this.superActive;
    if (!S || !this.thirdPerson) return null;
    if (S.slam) return 'slam';
    if ((S.type === 'nova' || S.type === 'gathering' || S.type === 'bladebarrage') && S.launched) return null;
    if (S.type === 'novawarp' && S.charge <= 0) return null;
    return SUPER_POSES[S.type] || null;
  }
  get superHover() { return this.superActive?.hoverY !== undefined && !this.dead; }

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
          : this.downT > 0 ? `Reviving in ${Math.ceil(this.downT)}  ·  uses a life (${M.lives} left)` : 'Reviving…');
      } else {
        this.respawnT -= dt;
        ui.updateDeath(this.respawnT > 0 ? (M.failing ? `Mission failed in ${Math.ceil(this.respawnT)}` : `Reviving in ${Math.ceil(this.respawnT)}`) : '');
        if (this.respawnT <= 0) {
          if (M.failing) { missionFailed(); return; }
          this.respawn();
        }
      }
      // a body downed in the air drops to the ground (teammates see it land)
      if (!this.onGround) {
        this.vel.x = 0; this.vel.z = 0; this.vel.y -= 24 * dt;
        this.onGround = moveBody(this.pos, this.vel, dt, this.radius, this.height).onGround;
      }
      this.updateCamera(dt);
      this.updateBody(dt);
      return;
    }
    this.status.tick(dt);
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
    const wantSprint = !!k.ShiftLeft && iz < 0 && this.adsT < 0.3 && G.time - this.lastFire > 0.35;
    // holding sprint for SPRINT_CANCEL seconds cancels a reload (the magazine stays as it was)
    this.sprintHoldT = wantSprint && this.weapon.reloading ? (this.sprintHoldT || 0) + dt : 0;
    if (this.sprintHoldT >= SPRINT_CANCEL) { this.weapon.reloading = false; this.weapon.reloadT = 0; this.sprintHoldT = 0; }
    this.sprinting = wantSprint && !this.weapon.reloading;
    this.sprintT = damp(this.sprintT, this.sprinting ? 1 : 0, 10, dt);
    let speed = this.speed * (this.status.has('wind') ? 1.15 : 1) * (this.sprinting ? (this.exo.has('transversive') ? 1.72 : 1.5) : 1) * lerp(1, 0.55, this.adsT);
    if (!this.superActive && this.weapon.A.move) speed *= this.weapon.A.move; // Lightweight Frame
    if (this.status.has('amplified')) speed *= ASPECT_TUNE.amplitude.speed; // Amplified
    if (this.superActive?.type === 'hammers') speed *= 1.1;
    if (this.superActive?.type === 'fists') speed *= 1.3;
    if (this.superActive?.type === 'maul' || this.superActive?.type === 'spectral') speed *= 1.15;
    if (this.status.has('tempered')) speed *= ASPECT_TUNE.tempered.speed; // Tempered Metal
    if (this.asp.has('prowl') && this.status.has('invisible')) speed *= ASPECT_TUNE.prowl.speed; // On the Prowl
    const accel = this.onGround ? 14 : (JUMP_TUNE[this.cls.jump]?.air ?? 2.5);
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
    const j = this.cls.jump, JT = JUMP_TUNE[j];
    if (this.updateSuperMove(dt, wx, wz, speed, jumpPressed)) { /* the super moves us (Thundercrash, Daybreak, Nova Warp) */ }
    else if (this.onGround) {
      this.air.usedDouble = false; this.air.fuel = 1; this.air.jumps = 0; this.air.hover = ASPECT_TUNE.angel.hover;
      if (jumpPressed) { this.vel.y = this.jumpV; this.onGround = false; sfx.jump(); }
    } else if (this.asp.has('angel') && G.input.mouse.right && this.air.hover > 0 && !this.superActive) {
      // Angel of Light: aiming in the air hovers
      this.air.hover = Math.max(0, this.air.hover - dt);
      this.vel.y = damp(this.vel.y, 0, 10, dt);
      if (Math.random() < 0.3) glowBurst(_v.copy(this.pos), ELEMENTS.void.hex, 1, 1, 0.05, 0.4, -2, -1);
    } else if (j === 'blink') {
      if (jumpPressed && !this.air.usedDouble) { this.air.usedDouble = true; this.blink(wx, wz); }
    } else if (j === 'double') {
      // Triple Jump: the ground jump plus two in the air, the second a little weaker
      if (jumpPressed && this.air.jumps < 2) {
        this.air.jumps++;
        this.vel.y = this.jumpV * (this.air.jumps === 1 ? 0.95 : 0.85);
        this.vel.x += wx * 3; this.vel.z += wz * 3;
        sfx.airMove();
        castFx('airburst', { p: this.pos.clone(), el: this.cls.element });
      }
    } else if (j === 'highjump' || j === 'strafejump') {
      // High Jump: one tall air jump. Strafe Jump: one normal air jump you can steer
      if (jumpPressed && this.air.jumps < 1) {
        this.air.jumps++;
        this.vel.y = this.jumpV * JT.v;
        this.vel.x += wx * 3; this.vel.z += wz * 3;
        sfx.airMove();
        castFx('airburst', { p: this.pos.clone(), el: this.cls.element });
      }
    } else if (j === 'lift' || j === 'highlift' || j === 'strafelift') {
      if (k.Space && this.air.fuel > 0 && this.vel.y < 1.5) {
        if (this.air.fuel === 1) sfx.airMove();
        this.vel.y = Math.min(JT.max, this.vel.y + 40 * dt);
        this.air.fuel = Math.max(0, this.air.fuel - dt / JT.fuel);
        if (Math.random() < 0.5) sparks(_v.copy(this.pos), ELEMENTS.solar.hex, 1, 2, 0.06, 0.3);
      }
    } else if (JT?.burst) {
      // Glides: press Space in the air for an upward burst, keep holding to glide
      if (jumpPressed && !this.air.usedDouble) {
        this.air.usedDouble = true;
        this.air.fuel = 1;
        this.vel.y = Math.max(this.vel.y, JT.burst);
        this.vel.x += wx * 2; this.vel.z += wz * 2;
        sfx.airMove();
        castFx('airburst', { p: this.pos.clone(), el: this.cls.element });
      }
      if (this.air.usedDouble && k.Space && this.air.fuel > 0 && this.vel.y < 1.2) {
        this.vel.y = damp(this.vel.y, this.air.fuel > 0.6 ? 1.0 : -0.7, 6, dt);
        this.vel.x = damp(this.vel.x, wx * speed * JT.speed, JT.steer, dt);
        this.vel.z = damp(this.vel.z, wz * speed * JT.speed, JT.steer, dt);
        this.air.fuel = Math.max(0, this.air.fuel - dt / JT.fuel);
        if (Math.random() < 0.6) glowBurst(_v.copy(this.pos), Math.random() < 0.5 ? ELEMENTS[this.cls.element].hex : 0xffffff, 1, 1.5, 0.06, 0.4, -3, -1);
      }
    }
    const vyBefore = this.vel.y;
    const wasGround = this.onGround;
    const res = moveBody(this.pos, this.vel, dt, this.radius, this.height);
    this.onGround = res.onGround; this.hitWall = res.hitWall;
    if (this.diving && res.onGround) {
      // Phoenix Dive landing
      this.diving = false;
      this.phoenixBurst();
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
      ww.voltWin = Math.max(0, ww.voltWin - dt);
      ww.bloom = Math.max(0, ww.bloom - dt * 0.06);
      if (G.time - this.lastFire > 0.5) ww.spin = Math.max(0, (ww.spin || 0) - dt * 2);
      ww.queued = Math.max(0, ww.queued - dt);
    }
    this.fightT = G.time - this.lastFire < 3 ? this.fightT + dt : 0; // Frenzy
    for (const ww of this.weapons) if (ww.has('frenzy')) { if (this.fightT >= 6) this.status.apply('frenzy', { scope: ww.idx }); else this.status.remove('frenzy', ww.idx); }
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
      w.reloadT -= dt * (this.status.has('rift') ? 1.6 : 1) * (this.status.has('amplified') ? ASPECT_TUNE.amplitude.reload : 1) * (1 + MODS_TUNE.loader * (this.ap[LOADER_MOD[w.idx]] || 0));
      if (w.reloadT <= 0) this.finishReload(w);
    }
    const wantAds = inp.mouse.right && !w.reloading && this.punchT <= 0;
    this.adsT = damp(this.adsT, wantAds ? 1 : 0, (w.has('snapshot') ? 28 : 14) * (1 + MODS_TUNE.targetAim * (this.ap[TARGET_MOD[w.idx]] || 0)), dt);
    if (w.has('reconstruction') && !w.reloading && w.ammo < w.mag && w.reserve > 0 && G.time - this.lastFire > 4) {
      w.reconT += dt;
      if (w.reconT >= 0.25) { w.reconT = 0; w.ammo++; if (w.reserve !== Infinity) w.reserve--; }
    }

    const A = w.A;
    const held = inp.mouse.left, pressed = inp.mouse.leftPressed;
    if (this.status.has('voidaxe') && !this.superActive) { // a Twilight Arsenal axe in hand: no guns, left-click throws it
      w.charge = 0; w.burstLeft = 0;
      if (pressed) this.throwHeldAxe();
      return;
    }
    if (pressed) w.queued = 0.18;
    if (w.reloading && pressed && w.ammo > 0) w.reloading = false;
    if (w.reloading || this.punchT > 0) { w.charge = 0; w.cburst = 0; return; }
    // Aggressive Frame linear fusions: the rest of the burst follows the first bolt on the same round
    if (w.cburst > 0) {
      if (w.fireCd <= 0) { w.cburst--; w.ammo++; this.fire(w, true); }
      return;
    }
    if (w.ammo <= 0) {
      w.charge = 0; w.burstLeft = 0;
      if (pressed) sfx.empty();
      if (w.reserve > 0 && w.fireCd <= 0 && !this.sprinting) this.startReload(w); // a sprint that cancelled the reload waits
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
        w.charge += dt * (1 + (w.has('spinup') ? (w.spin || 0) : 0)) * (this.status.has('merciless', w.idx) ? 6 : 1);
        if (w.charge >= A.charge) { this.fire(w); w.charge = 0; }
      } else w.charge = 0;
    }
  }

  switchTo(i) {
    if (i === this.cur || this.superActive) return;
    const w = this.weapon;
    w.reloading = false; w.charge = 0; w.burstLeft = 0;
    const peace = this.exo.has('peacekeepers');
    if (peace && w.item.arch === 'smg') this.instantReload(w); // Peacekeepers: a stowed SMG reloads itself
    this.cur = i;
    this.switchT = this.switchMax = (this.weapon.has('hotswap') ? 0.2 : 0.42) * (peace && this.weapon.item.arch === 'smg' ? 0.5 : 1);
    this.showModel();
    sfx.swap();
  }

  startReload(w) {
    if (w.has('honed') && !w.honed && w.mag > 1 && w.ammo >= w.mag) {
      // Honed Edge: load the whole magazine into one shot
      w.honed = w.ammo; w.ammo = 1;
      this.status.apply('honed', { scope: w.idx, stacks: w.honed, set: true });
      sfx.reloadDone();
      return;
    }
    if (w.reloading || w.ammo >= w.mag || w.reserve <= 0) return;
    w.reloading = true;
    let t = w.s.reload;
    if (this.status.has('outlaw')) t *= 0.55;
    if (w.has('hotswap')) t *= 0.85;
    if (this.status.has('feeding', w.idx)) t *= 0.55;
    if (this.status.has('frenzy', w.idx)) t *= 0.7;
    if (this.status.has('rally')) t *= 0.7;
    if (this.status.has('flowstate')) t *= 0.75;
    if (this.status.has('tempered')) t *= ASPECT_TUNE.tempered.reload; // Tempered Metal
    if (this.status.has('frequency')) t *= 0.6;
    t *= 1 - 0.15 * this.status.stacks('onyourmark');
    if (this.sets.has('earth')) t *= SET_TUNE.reload; // Skywatch: Golden Age Salvage
    w.reloadT = w.reloadMax = t;
    if (w.killclipWindow > 0) w.killclipArm = true;
    if (w.voltWin > 0) w.voltArm = true;
    w.burstLeft = 0;
    sfx.reload();
  }

  finishReload(w) {
    const take = Math.min(w.mag - w.ammo, w.reserve);
    w.ammo += take;
    if (w.reserve !== Infinity) w.reserve -= take;
    w.reloading = false;
    if (w.voltArm) { w.voltArm = false; this.status.apply('voltshot', { scope: w.idx }); }
    if (w.killclipArm) { w.killclipArm = false; this.status.apply('killclip', { scope: w.idx, set: true }); }
    if (w.has('memento')) this.status.apply('memento', { scope: w.idx, stacks: 6 });
    if (w.has('volatile')) {
      w.el = VOLATILE_CYCLE[(VOLATILE_CYCLE.indexOf(wEl(w)) + 1) % VOLATILE_CYCLE.length];
      this.status.apply('hardlight', { scope: w.idx, set: true });
    }
    sfx.reloadDone();
  }

  instantReload(w) {
    const take = Math.min(w.mag - w.ammo, w.reserve);
    w.ammo += take;
    if (w.reserve !== Infinity) w.reserve -= take;
    w.reloading = false;
  }

  getSpread(w) {
    return spreadFor({ hip: w.s.spread, ads: w.A.ads, adsT: this.adsT, moving: Math.hypot(this.vel.x, this.vel.z) > 1, air: !this.onGround, steady: w.has('steady'), bloom: w.bloom }) * (1 - MODS_TUNE.target * (this.ap[TARGET_MOD[w.idx]] || 0) * this.adsT);
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
    if (w.item.slot === 'primary') m *= PRIMARY_BOOST;
    if (w.has('rampage')) m *= 1 + 0.12 * this.status.stacks('rampage');
    if (this.status.has('killclip', w.idx)) m *= 1.3;
    if (w.has('highcal')) m *= 1.1;
    if (crit && w.has('precise')) m *= 1.2;
    if (this.status.has('empower')) m *= 1.25;
    if (this.keepsGuns) m *= 1.3; // Song of Flame
    if (w.mementoShot) m *= 1.5;
    if (w.honed) m *= w.honed;
    if (w.has('regime') && w.ammo < w.mag / 2) m *= 1.25;
    if (this.status.has('wolves', w.idx)) m *= 1.25;
    if (w.has('surrounded') && enemiesNear(this.pos, 8, 3).length >= 3) m *= 1.25;
    if (w.openShot) m *= 1.25;
    if (this.status.has('frenzy', w.idx)) m *= 1.2;
    if (this.status.has('radiant')) m *= 1.15; // Ember of Torches
    if (this.status.has('wol')) m *= SUPER_TUNE.ward.wol; // Ward of Dawn: Weapons of Light
    if (this.status.has('well')) m *= SUPER_TUNE.well.dmg; // Well of Radiance
    return m;
  }

  /** Ability damage from aspects (read by dealDamage for every hit this player makes). */
  buildMult(o) {
    if (o.source !== 'ability' && o.source !== 'melee') return 1;
    let m = 1 + 0.2 * this.status.stacks('roaring'); // Roaring Flames
    if (this.asp.has('bulwark') && this.over > 0 && this.meleeT > 0) m *= 1.5; // Offensive Bulwark
    return m;
  }

  /** Knockout: breaking a shield. */
  onShieldBreak() { if (this.asp.has('knockout')) this.knockout(); }
  knockout() {
    this.heal(40);
    this.status.apply('knockout', { set: true });
  }

  /** Echo of Persistence: void buffs last 25% longer. */
  voidT(t) { return this.frag.has('persistence') ? t * 1.25 : t; }

  /** Ionic Trace: a mote flies back to you and recharges every ability by frac of its cooldown (one per IONIC.gap seconds). */
  ionicTrace(from, frac) {
    if (G.time < (this.ionicAt ?? -Infinity)) return;
    this.ionicAt = G.time + IONIC.gap;
    homingMote(from, () => this.eye.clone().add(new THREE.Vector3(0, -0.3, 0)), ELEMENTS.arc.hex, 0.5, 0.12);
    after(0.5, () => { for (const k of ['grenade', 'melee', 'class']) this.cd[k] = Math.max(0, this.cd[k] - this.cdMax[k] * frac); if (this.asp.has('ionicsentry')) this.chargeSentry(); });
  }

  fire(w, burstBolt = false) {
    // firing breaks invisibility (On the Prowl still weakens with this shot); Spectral Blades keeps its own
    if (this.status.has('invisible') && this.superActive?.type !== 'spectral') { this.prowlShot = !this.prowlUsed; this.status.remove('invisible'); }
    // Opening Shot: the first shot after a pause
    w.openShot = w.has('opening') && G.time - (w.lastShotT ?? -99) > 2;
    w.lastShotT = G.time;
    // Spinning Up: sustained fire ramps the rate of fire
    if (w.has('spinup')) w.spin = Math.min(1, (w.spin || 0) + 60 / w.s.rpm * 0.9);
    const spinMul = w.has('spinup') ? 1 + 0.7 * (w.spin || 0) : 1;
    const A = w.A, s = w.s;
    w.ammo--;
    w.mementoShot = this.status.has('memento', w.idx); // Ace of Spades: Memento rounds fire a white tracer and a bigger Firefly
    if (w.mementoShot) this.status.consume('memento', w.idx);
    this.lastFire = G.time;
    if (A.mode === 'burst') {
      if (w.burstLeft <= 0) w.burstLeft = A.burst;
      w.burstLeft--;
      w.fireCd = (w.burstLeft > 0 ? 60 / s.rpm : A.burstDelay) / spinMul;
      if (w.ammo <= 0) w.burstLeft = 0;
    } else w.fireCd = 60 / s.rpm / spinMul;
    if (A.chargeBurst) {
      if (!burstBolt) w.cburst = A.chargeBurst - 1;
      if (w.cburst > 0) w.fireCd = 0.07;
    }
    if (this.status.has('wolves', w.idx)) w.fireCd /= 2;
    const eye = this.eye;
    const fwd = this.getForward(_fwd);
    const spread = this.getSpread(w) * (w.openShot ? 0.4 : 1);
    const muzzle = this.muzzlePos(new THREE.Vector3());
    const el = ELEMENTS[wEl(w)];
    if (A.projectile) {
      const dir = applySpread(fwd.clone(), spread);
      const flat = dir.clone().setY(0).normalize();
      const start = eye.clone().addScaledVector(dir, 0.7).add(new THREE.Vector3(0, -0.15, 0));
      spawnPlayerProjectile({
        kind: A.id, pos: start, vel: dir.multiplyScalar(A.projectile.speed), gravity: A.projectile.gravity,
        size: A.projectile.size, color: el.hex, life: 6, tracking: w.has('tracking') || !!A.tracking,
        onHit: (p, enemy) => this.weaponExplosion(w, p, enemy, flat),
      });
    } else {
      const pellets = A.pellets || 1;
      for (let i = 0; i < pellets; i++) {
        const dir = applySpread(fwd.clone(), spread);
        this.hitscan(eye, dir, w, s.dmg, muzzle, A.id === 'linear' ? { tracerWidth: 0.07, tracerColor: el.hex } : w.mementoShot ? { tracerWidth: 0.045, tracerColor: 0xffffff } : {});
      }
    }
    w.honed = 0;
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
        const F = w.A?.falloff || DEFAULT_FALLOFF, d = h.distance;
        const fr = w.s.range * (this.status.has('wind') ? 1.25 : 1);
        let fall = d <= fr ? 1 : Math.max(F.min, 1 - ((1 - F.min) * (d - fr)) / (fr * F.span));
        if (F.close && d < F.close * 2) fall *= 1 + (F.bonus - 1) * Math.min(1, (F.close * 2 - d) / F.close); // point-blank bonus
        o.hit ??= e; // the first enemy struck (Golden Gun splash skips it)
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
      const tc = o.tracerColor ?? (wEl(w) === 'kinetic' ? 0xffe3a0 : ELEMENTS[wEl(w)].hex);
      tracer(from, end, tc, o.tracerWidth ?? 0.02, 0.06);
      fxTracer(from, end, tc);
    }
    return end;
  }

  applyHit(w, e, dmg, crit, point, o = {}) {
    const m = o.isSuper ? 1 : this.weaponDmgMult(w, crit);
    const element = o.element ?? wEl(w);
    const prowl = !o.isSuper && this.asp.has('prowl') && !this.prowlUsed && (this.status.has('invisible') || this.prowlShot); // On the Prowl
    if (prowl) this.prowlUsed = true;
    this.prowlShot = false;
    const res = dealDamage(e, dmg * m, { crit, precMult: o.precMult ?? w.A.prec, element, weapon: o.isSuper ? null : w, pos: point, source: o.isSuper ? 'super' : 'weapon', shieldBreaker: !o.isSuper && w.has('shieldbreaker'), weaken: prowl ? 4 : 0 });
    if (o.isSuper) return res;
    w.hitCount++;
    if (this.status.has('voltshot', w.idx)) {
      // Voltshot: the charged hit jolts nearby enemies
      this.status.remove('voltshot', w.idx);
      for (const other of enemiesNear(e.pos, 10, 3, e)) {
        const c = other.center(new THREE.Vector3());
        lightning(point, c, ELEMENTS.arc.hex, 0.04);
        dealDamage(other, w.s.dmg * (w.A.pellets || 1) * 0.6, { element: 'arc', source: 'perk', pos: c });
      }
    }
    const conducting = this.status.has('conductor', w.idx);
    if (w.has('chain')) {
      for (const other of enemiesNear(e.pos, 9, conducting ? 3 : 1, e)) {
        const c = other.center(new THREE.Vector3());
        lightning(point, c, ELEMENTS.arc.hex, 0.03);
        dealDamage(other, dmg * m * 0.5, { element: 'arc', source: 'perk', pos: c });
      }
    }
    if (conducting && w.hitCount % 2 === 0) w.ammo = Math.min(w.mag, w.ammo + 1);
    if (w.has('regime') && w.ammo < w.mag / 2) this.heal(2);
    if (w.has('payday') && (w.spin || 0) >= 1 && Math.random() < 0.5) w.ammo = Math.min(w.mag, w.ammo + 1);
    if (w.has('volatile')) {
      const other = enemiesNear(e.pos, 12, 1, e)[0];
      if (other) {
        const c = other.center(new THREE.Vector3());
        lightning(point, c, ELEMENTS[element].hex, 0.03);
        dealDamage(other, dmg * m * 0.7, { element, source: 'perk', pos: c });
      }
    }
    if (w.has('sleeper')) {
      // Refraction: the bolt splits toward up to 2 more enemies
      for (const other of enemiesNear(e.pos, 15, 2, e)) {
        const c = other.center(new THREE.Vector3());
        lightning(point, c, ELEMENTS.solar.hex, 0.05);
        dealDamage(other, dmg * m * 0.8, { element, source: 'perk', pos: c });
      }
    }
    if (crit && w.has('siva')) {
      // Parasitic Nanites: a swarm that seeks nearby enemies
      for (const other of enemiesNear(e.pos, 12, 2, e)) {
        const d = dmg * m * 0.5;
        this.seekerSwarm(point, other, 0xd8333a, 0.06, (p) => explode(p, 2, d, 'kinetic', { source: 'perk', small: true }));
      }
    }
    if (w.has('telesto')) {
      // Unstable Payload: pellets stick and pool into one blast per enemy
      if (e.telDmg) e.telDmg += dmg * m * 0.35;
      else {
        e.telDmg = dmg * m * 0.35;
        after(1, () => {
          const c = e.alive ? e.center(new THREE.Vector3()) : e.pos.clone().setY(1);
          explode(c, 2.5, e.telDmg, 'void', { source: 'perk' });
          e.telDmg = 0;
        });
      }
    }
    if (w.has('reign') && w.hitCount % 8 === 0) {
      lightning(point.clone().add(new THREE.Vector3(0, 14, 0)), point, ELEMENTS.arc.hex, 0.12);
      explode(point, 3.5, dmg * m * 3, 'arc', { source: 'perk' });
    }
    if (w.has('xeno')) {
      explode(point, 2.6, dmg * m * 0.5, 'solar', { source: 'perk', small: true });
      for (const x of enemiesNear(point, 2.6, 4)) this.dot(x, dmg * m * 0.1, 3, 'solar', ELEMENTS.solar.hex);
    }
    if (crit && w.has('whitenail')) {
      // White Nail: three precision hits in a row refill 3 rounds for free
      w.wn = G.time - (w.wnT || 0) < 4 ? (w.wn || 0) + 1 : 1;
      w.wnT = G.time;
      if (w.wn >= 3) { w.wn = 0; w.ammo = Math.min(w.mag, w.ammo + 3); this.status.apply('whitenail', { scope: w.idx, set: true }); sfx.engram(2); }
    } else if (!crit && w.has('whitenail')) w.wn = 0;
    if (w.has('thorn')) this.dot(e, dmg * m * 0.18, 4, 'kinetic', 0x6dff8e); // Mark of the Devourer
    if (w.has('explosive')) explode(point, 2.2, dmg * m * 0.4, w.item.element === 'kinetic' ? 'solar' : w.item.element, { source: 'perk', small: true });
    if (crit && w.has('sunburst')) {
      w.precHits++;
      if (w.precHits % 5 === 0) {
        explode(point, 3.5, dmg * 2.6, w.item.element === 'kinetic' ? 'solar' : w.item.element, { source: 'perk' });
        w.ammo = Math.max(w.ammo, w.mag);
      }
    }
    return res;
  }

  /** Damage over time: n ticks, one per second. */
  dot(e, tick, n, element, color) {
    let t = 1;
    const mark = element === 'solar' ? 'burn' : 'poison'; // shown on the enemy plate while it ticks
    if (e.alive) e.status.apply(mark, { t: n });
    addTicker({ update(dt) { t -= dt; if (t <= 0) { t = 1; n--; if (e.alive) { dealDamage(e, tick, { element, source: 'perk', [mark]: n > 0 ? 1.1 : 0.1 }); sparks(e.center(new THREE.Vector3()), color, 3, 2, 0.06, 0.3); } } return n > 0 && e.alive; } });
  }

  weaponExplosion(w, p, enemy, dir = null) {
    const m = this.weaponDmgMult(w, false);
    const dmg = w.s.dmg * m;
    if (enemy && enemy.alive) dealDamage(enemy, dmg * 0.3, { element: w.item.element, weapon: w, source: 'weapon' });
    if (w.A.wave && dir) {
      // Compressed Wave Frame: the blast rolls forward along the ground in a line of bursts
      const at = p.clone().setY(Math.max(0.3, restHeight(p.x, p.z, p.y, G.colliders.filter((c) => !c.pass)) + 0.3));
      for (let i = 0; i < w.A.wave; i++) {
        const q = at.clone().addScaledVector(dir, i * WAVE_STEP);
        after(i * 0.07, () => explode(q, WAVE_RADIUS, dmg, w.item.element, { weapon: w, source: 'weapon', small: i % 2 === 1 }));
      }
    } else explode(p, w.A.projectile.radius, dmg, w.item.element, { weapon: w, source: 'weapon' });
    if (w.has('cluster')) {
      for (let i = 0; i < 4; i++) {
        const off = new THREE.Vector3(Math.cos(i * 1.57) * 3, 0.5, Math.sin(i * 1.57) * 3).add(p);
        let t = 0.2 + i * 0.08;
        addTicker({ update(dt) { t -= dt; if (t <= 0) { explode(off, 2.8, dmg * 0.3, w.item.element, { source: 'perk' }); return false; } return true; } });
      }
    }
    if (w.has('wolfpack')) {
      // Wolfpack Rounds: four seekers split off toward the nearest enemies
      const prey = enemiesNear(p, 18, 4);
      for (let i = 0; i < 4; i++) {
        const target = prey.length ? prey[i % prey.length] : null;
        const from = p.clone().add(new THREE.Vector3(0, 0.6, 0));
        after(0.1 + i * 0.08, () => this.seekerSwarm(from, target, ELEMENTS[w.item.element].hex, 0.08, (q) => explode(q, 2.5, dmg * 0.35, w.item.element, { source: 'perk' })));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Kills & damage
  // -------------------------------------------------------------------------
  onKill(e, o) {
    // jolt chains and companions (Arc Soul, Child of the Old Gods) pay like weapon kills and skip Hands-On and Ionic Traces
    const chain = !!(o.jolted || o.companion);
    if (!this.superActive) this.superCharge = Math.min(100, this.superCharge + superKillGain(chain ? 'weapon' : o.source, o.crit, e.typeId));
    for (const k of ['grenade', 'melee', 'class']) this.cd[k] = Math.max(0, this.cd[k] - KILL_CD_REFUND);
    if (this.ap.recuperation) this.heal(15 * this.ap.recuperation);
    if (!chain && (o.source === 'ability' || o.source === 'melee') && this.ap.handson && !this.superActive) this.superCharge = Math.min(100, this.superCharge + SUPER_HANDSON * this.ap.handson);
    this.buildOnKill(e, o);
    this.modsOnKill(e, o, chain);
    this.traitOnKill(e, o);
    if (!chain) this.setsOnKill(o);
    if (this.exo.has('nighthawk') && o.source === 'super' && this.superActive?.type === 'revolver') this.hawkKill = true; // refund when the super ends
    if (this.exo.has('starfire') && !chain && o.source === 'ability' && G.time < this.grenadeWin && this.cls.abilities.grenade.element === 'solar') {
      this.cd.grenade = Math.max(0, this.cd.grenade - this.cdMax.grenade * STARFIRE.refund);
    }
    if (o.source === 'ability' || o.source === 'melee') {
      if (this.exo.has('nezarec') && o.element === 'void') this.status.apply('nezarec', { t: 5 }); // Void ability kills
      if (this.exo.has('skullfort') && this.meleeT > 0) { this.cd.melee = 0; this.heal(1000); this.status.apply('skullfort', { set: true }); }
      if (this.exo.has('quietone') && o.element === 'void') this.heal(QUIET.heal); // Mask of the Quiet One
      if (this.exo.has('sunbracers') && o.element === 'solar' && this.meleeT > 0) this.status.apply('sunbracers', { t: SUNBRACERS.t, set: true });
    }
    if (o.source === 'super') this.exoticSuperKill();
    const w = o.weapon;
    if (!w) return;
    if (w.has('rampage')) this.status.apply('rampage', { add: 1, set: true });
    if (w.has('killclip')) w.killclipWindow = 3;
    if (w.has('outlaw') && o.crit) this.status.apply('outlaw');
    if (w.has('leech')) this.heal(20);
    const c = e.center(new THREE.Vector3());
    if (w.has('firefly') && o.crit) explode(c, w.mementoShot ? 4.5 : 3, w.mementoShot ? 180 : 90, 'solar', { source: 'perk' });
    if (w.has('memento')) {
      w.ammo = Math.max(w.ammo, w.mag); w.reloading = false; this.status.apply('memento', { scope: w.idx, stacks: 6 });
    }
    if (w.has('voidheart')) explode(c, 4, 180, w.item.element === 'kinetic' ? 'void' : w.item.element, { source: 'perk' });
    const shot = w.s.dmg * (w.A.pellets || 1); // one full shot's damage
    if (w.has('feeding')) this.status.apply('feeding', { scope: w.idx });
    if (w.has('voltshot')) w.voltWin = 4;
    if (w.has('incandescent')) for (const x of enemiesNear(c, 5, 6)) this.dot(x, shot * 0.2, 3, 'solar', ELEMENTS.solar.hex);
    if (w.has('destabilizing')) {
      glowBurst(c, ELEMENTS.void.hex, 14, 6, 0.1, 0.5);
      for (const x of enemiesNear(c, 6, 6)) dealDamage(x, shot * 0.15, { element: 'void', source: 'perk', weaken: 4 });
    }
    if (w.has('chainreaction')) explode(c, 3.5, shot * 0.5, wEl(w) === 'kinetic' ? 'solar' : wEl(w), { source: 'perk' });
    if (w.has('demolitionist')) this.cd.grenade = Math.max(0, this.cd.grenade - 2.5);
    if (w.has('killingwind')) this.status.apply('wind');
    if (w.has('sunshot')) {
      // Sunburn: the blast leaps to nearby enemies
      explode(c, 3.5, w.s.dmg * 1.5, 'solar', { source: 'perk' });
      for (const x of enemiesNear(c, 10, 3)) {
        const xc = x.center(new THREE.Vector3());
        lightning(c, xc, ELEMENTS.solar.hex, 0.04);
        explode(xc, 2.5, w.s.dmg * 1.2, 'solar', { source: 'perk', small: true });
      }
    }
    if (w.has('thorn')) {
      // Mark of the Devourer: the poison bursts out of the kill and spreads
      glowBurst(c, 0x6dff8e, 22, 7, 0.09, 0.7, 1.5, 0.3);
      glowBurst(c, 0x1d5a2a, 12, 4, 0.14, 0.9, 0.8, 0.2);
      shockwave(c.clone().setY(Math.max(0.05, c.y - 0.8)), 7, 0x6dff8e, 0.5);
      for (const x of enemiesNear(c, 7, 3)) { this.dot(x, w.s.dmg * 0.3, 3, 'kinetic', 0x6dff8e); lightning(c, x.center(new THREE.Vector3()), 0x6dff8e, 0.05); }
    }
    if (w.has('ridebull')) { w.ammo = Math.max(w.ammo, w.mag); w.spin = 1; }
    if (w.has('wolves')) this.status.apply('wolves', { scope: w.idx });
    if (w.has('merciless')) this.status.apply('merciless', { scope: w.idx });
    if (w.has('acrius')) explode(c, 7, w.s.dmg * 4, 'arc', { source: 'perk' });
    if (w.has('truth') && w.ammo < w.mag && w.reserve > 0) { this.instantReload(w); this.status.apply('truth', { scope: w.idx, set: true }); }
    if (w.has('scavenger') && w.reserve !== Infinity && Math.random() < 0.4) {
      w.reserve = Math.min(w.maxReserve, w.reserve + (w.item.slot === 'heavy' ? Math.ceil(w.brick / 2) : 1));
    }
  }

  /** Former subclass traits (aspects since H3) that react to a kill. */
  traitOnKill(e, o) {
    const A = this.asp, abil = o.source === 'ability' || o.source === 'melee';
    if (A.has('amplitude') && abil && o.element === 'arc') this.status.apply('amplified', { t: ASPECT_TUNE.amplitude.amplified });
    if (A.has('chainofwoe') && o.source === 'weapon' && o.crit) {
      this.cd.melee = Math.max(0, this.cd.melee - this.cdMax.melee * ASPECT_TUNE.chainofwoe.melee);
      this.cd.grenade = Math.max(0, this.cd.grenade - this.cdMax.grenade * ASPECT_TUNE.chainofwoe.grenade);
    }
    if (A.has('pyre') && e.status.has('burn')) {
      const P = ASPECT_TUNE.pyre, c = e.center(new THREE.Vector3());
      for (const x of enemiesNear(c, P.spreadR, 4, e)) { this.ignite(x, P.spreadDps, P.spreadT); castFx('chain', { pts: [c, x.center(new THREE.Vector3())], el: 'solar', beam: true, w: 0.04 }); }
    }
    if (A.has('crackling') && (o.source === 'melee' || (abil && G.time < this.meleeWin))) this.heal(ASPECT_TUNE.crackling.heal);
  }

  /** Former subclass traits (aspects since H3) on this player's own grenade and melee hits. Returns extra debuffs for the hit. */
  traitHitOpts(e, o) {
    // Liar's Handshake: a powered melee hit grants Cross Counter (not the uncharged melee that spends it)
    if (this.exo.has('liars') && !this.inBasicMelee && G.time < this.meleeWin) this.status.apply('crosscounter', { t: LIARS.t, set: true });
    if (this.exo.has('ahamkara') && o.source === 'ability' && G.time < this.grenadeWin && this.meleeT <= 0 && G.time - this.ahamAt >= AHAMKARA.gap) {
      this.ahamAt = G.time; // Young Ahamkara's Spine
      for (const k of ['melee', 'class']) this.cd[k] = Math.max(0, this.cd[k] - this.cdMax[k] * AHAMKARA.refund);
    }
    const A = this.asp;
    if (!A.size) return null;
    const melee = o.source === 'melee' || this.inBasicMelee || G.time < this.meleeWin; // grenade hits fall outside the melee window
    const powered = !this.inBasicMelee && o.source === 'ability' && G.time < this.meleeWin;
    const out = {};
    if (A.has('pyre') && o.element === 'solar' && !(e.traitBurnAt > G.time)) {
      const P = ASPECT_TUNE.pyre;
      e.traitBurnAt = G.time + P.burnTicks;
      this.dot(e, P.burnTick, P.burnTicks, 'solar', ELEMENTS.solar.hex);
    }
    if (A.has('abyssal') && melee) {
      const B = ASPECT_TUNE.abyssal;
      if (e.status.has('weaken')) {
        const c = e.center(new THREE.Vector3());
        for (const x of enemiesNear(c, B.spreadR, 6, e)) dealDamage(x, 1, { element: 'void', source: 'perk', raw: true, weaken: B.weaken }); // the debuff travels with the hit to the enemy's owner
        castFx('suppress', { p: c, r: B.spreadR });
      }
      out.weaken = Math.max(o.weaken || 0, B.weaken);
    }
    if (A.has('bloom') && o.element === 'void') this.bloom(e);
    if (A.has('unlimitedpower') && powered) {
      const U = ASPECT_TUNE.unlimitedpower, c = e.center(new THREE.Vector3());
      out.jolt = Math.max(o.jolt || 0, U.jolt);
      for (const x of enemiesNear(c, U.r, U.n, e)) {
        const xc = x.center(new THREE.Vector3());
        castFx('chain', { pts: [c, xc], el: 'arc', beam: true, w: 0.05 });
        dealDamage(x, U.dmg, { element: 'arc', source: 'ability', jolted: true, jolt: U.jolt, pos: xc });
      }
    }
    return out;
  }

  /** Bloom (Voidwalker aspect): the enemy is unstable; it drains to you while it lasts and detonates if it dies. */
  bloom(e) {
    const B = ASPECT_TUNE.bloom;
    if (e.bloomUntil > G.time) { e.bloomUntil = G.time + B.t; return; } // refresh, one drain per enemy
    e.bloomUntil = G.time + B.t;
    const self = this;
    let tick = B.tick;
    addTicker({ update(dt) {
      if (!e.alive) {
        if (G.time <= e.bloomUntil + 0.05) {
          const c = e.center(new THREE.Vector3());
          explode(c, B.r, 60, 'void', { source: 'perk', small: true, debuffs: { weaken: B.weaken } });
          castFx('suppress', { p: c, r: B.r });
        }
        return false;
      }
      if (G.time > e.bloomUntil || self.dead) return false;
      tick -= dt;
      if (tick <= 0) {
        tick = B.tick;
        const r = dealDamage(e, B.dmg, { element: 'void', source: 'perk', raw: true });
        if (r.dealt > 0) self.heal(r.dealt);
        if (Math.random() < 0.6) sparks(e.center(new THREE.Vector3()), 0xb07cff, 2, 1.5, 0.05, 0.4);
      }
      return true;
    } });
  }

  /** Aspect and fragment reactions to a kill this player made. */
  buildOnKill(e, o) {
    const A = this.asp, F = this.frag;
    if (this.superActive?.type === 'spectral' && o.source === 'super') this.goInvisible(3); // Spectral Blades: kills keep you hidden
    if (!A.size && !F.size && !this.status.has('volatile')) return;
    const abil = o.source === 'ability' || o.source === 'melee';
    const weakened = e.status.has('weaken'), suppressed = e.status.has('suppress'), jolted = e.status.has('jolt');
    const c = e.center(new THREE.Vector3());
    if (abil && o.element === 'solar') {
      if (A.has('solinvictus')) castFx('sunspot', { p: e.pos.clone().setY(0) });
      if (A.has('roaring')) this.status.apply('roaring', { add: 1, set: true });
      if (F.has('singeing')) this.cd.class = Math.max(0, this.cd.class - 2);
      if (A.has('giftsun')) this.firesprite(c);
      if (F.has('empyrean')) for (const id of ['restoration', 'radiant']) { const st = this.status.get(id); if (st) { st.t += 2; st.max = Math.max(st.max, st.t); } }
    }
    if (abil && o.element === 'arc') {
      if (A.has('flowstate')) this.status.apply('flowstate', { set: true });
      if (A.has('electrostatic') && !o.jolted && !o.companion) this.ionicTrace(c, IONIC.electrostatic);
    }
    if (abil && o.element === 'void' && F.has('expulsion')) explode(c, 3, 100, 'void', { source: 'perk', small: true });
    if (this.status.has('devour')) { this.heal(1000); this.cd.grenade = Math.max(0, this.cd.grenade - this.cdMax.grenade * 0.1); this.status.apply('devour', { t: this.voidT(8), set: true }); } // Devour: +10% grenade energy per kill
    else if (abil && A.has('feedvoid')) { this.heal(1000); this.status.apply('devour', { t: this.voidT(8), set: true }); }
    if (A.has('demolition') && (weakened || suppressed)) { explode(c, 3.5, 120, 'void', { source: 'perk' }); this.heal(20); }
    if (A.has('executioner') && weakened) { this.goInvisible(3, false); this.heal(30); }
    if (F.has('starvation') && weakened) this.heal(30);
    if (F.has('ions') && jolted && !o.jolted && !o.companion) this.ionicTrace(c, IONIC.ions);
    if (o.weapon && this.status.has('volatile')) explode(c, 3, 80, 'void', { source: 'perk', small: true });
    if (F.has('instability') && weakened && o.weapon) this.status.apply('volatile', { set: true });
    if (A.has('gunpowder') && !this.status.has('gunpowder') && ++this.gpKills >= 5) { this.gpKills = 0; this.status.apply('gunpowder'); }
    if (A.has('heatrises') && !this.onGround) this.restore(3);
    if (A.has('knockout') && o.source === 'ability' && this.meleeT > 0) this.knockout();
    // Light Ascendant aspects and fragments
    const powered = abil && G.time < this.meleeWin; // a powered melee kill
    if (abil && o.element === 'solar' && A.has('tempered')) this.status.apply('tempered', { t: ASPECT_TUNE.tempered.t, set: true });
    if (abil && o.element === 'arc' && A.has('ionicsentry') && !o.jolted && !o.companion) this.chargeSentry();
    if (powered && A.has('fasttwitch')) { this.cd.class = 0; this.status.apply('amplified', { t: ASPECT_TUNE.fasttwitch.amplified, set: true }); }
    if (o.weapon && A.has('angel') && !this.onGround && G.input.mouse.right) this.cd.grenade = Math.max(0, this.cd.grenade - this.cdMax.grenade * ASPECT_TUNE.angel.refund);
    if (F.has('searing') && e.status.has('burn')) this.cd.melee = Math.max(0, this.cd.melee - this.cdMax.melee * FRAGMENT_TUNE.searing);
    if (F.has('combustion') && powered) explode(c, FRAGMENT_TUNE.combustion.r, FRAGMENT_TUNE.combustion.dmg, 'solar', { source: 'perk' });
    if (F.has('tempering') && o.weapon && o.element === 'solar') this.restore(FRAGMENT_TUNE.tempering);
    if (F.has('discharge') && o.weapon && o.element === 'arc' && Math.random() < FRAGMENT_TUNE.discharge) this.ionicTrace(c, IONIC.ions);
    if (F.has('obscurity') && powered) this.goInvisible(FRAGMENT_TUNE.obscurity);
    if (F.has('leeching') && (powered || o.source === 'melee')) this.heal(FRAGMENT_TUNE.leeching);
  }

  /** Ionic Sentry: every third Ionic Trace or Arc ability kill deploys a turret at your feet. */
  chargeSentry() {
    if (++this.sentryN < ASPECT_TUNE.ionicsentry.every) return;
    this.sentryN = 0;
    castFx('companion', { p: this.pos.clone(), kind: 'sentry', life: ASPECT_TUNE.ionicsentry.life, fixed: true });
  }

  /** Aftershocks: Arc ability and super hits recharge grenade and melee (at most once per gap). */
  aftershock() {
    if (!this.asp.has('aftershocks') || G.time < (this.aftershockAt ?? -9)) return;
    this.aftershockAt = G.time + ASPECT_TUNE.aftershocks.gap;
    for (const k of ['grenade', 'melee']) this.cd[k] = Math.max(0, this.cd[k] - this.cdMax[k] * ASPECT_TUNE.aftershocks.refund);
  }

  /** Unbreakable: Q raises a void shield; when it drops it explodes and weakens. */
  unbreakable() {
    if (this.cd.grenade > 0) { sfx.denied(); return; }
    const U = ASPECT_TUNE.unbreakable;
    this.cd.grenade = this.cdMax.grenade;
    this.grenadeWin = G.time + U.t + 3; this.grenadePending = true; this.grenadeOrbUsed = false;
    this.empowerOthers('grenade');
    this.status.apply('unbreakable', { t: U.t, set: true });
    castFx('ward', { p: this.pos.clone(), r: 1.6, life: U.t });
    sfx.ability();
    after(U.t, () => {
      if (this.dead) return;
      const p = this.pos.clone().setY(this.pos.y + 0.8);
      explode(p, U.r, U.dmg, 'void', { source: 'ability', debuffs: { weaken: 4 } });
      castFx('suppress', { p, r: U.r });
      if (this.asp.has('resolve')) this.addOvershield(ASPECT_TUNE.resolve.over); // Defender's Resolve
    });
  }

  /** Crackshot: three scorching shots at the nearest enemies in front; heal if all three land. */
  crackshot() {
    const C = ASPECT_TUNE.crackshot, fwd = this.getForward(new THREE.Vector3()).setY(0).normalize();
    const c = new THREE.Vector3();
    const targets = enemiesNear(this.eye, C.range, 6).filter((e) => { e.center(c); return c.clone().sub(this.eye).setY(0).normalize().dot(fwd) > 0.3 && hasLOS(this.eye, c); }).slice(0, C.shots);
    if (!targets.length) return;
    let hits = 0;
    for (let i = 0; i < C.shots; i++) after(0.08 + i * 0.1, () => {
      const t = targets[i % targets.length];
      if (!t.alive || this.dead) return;
      const tc = t.center(new THREE.Vector3());
      castFx('chain', { pts: [this.eye.clone().add(new THREE.Vector3(0, -0.2, 0)), tc], el: 'solar', beam: true, w: 0.05 });
      dealDamage(t, C.dmg, { element: 'solar', source: 'ability', pos: tc });
      this.ignite(t, 18, 2);
      if (++hits === C.shots) this.heal(C.heal);
      sfx.shot('revolver');
    });
  }

  /** Derived stats: the six armor stats (plus Font bonuses while charged) set speed, shield, regen and ability cooldowns. */
  applyStats() {
    const st = { ...this.statBase };
    this.fonted = this.armorCharge > 0;
    if (this.fonted) {
      for (const [id, k] of Object.entries(FONT_STAT)) st[k] += CHARGE.font * (this.ap[id] || 0);
      for (const k of STAT_KEYS) st[k] = Math.min(STAT_CAP, st[k]);
    }
    this.stats = st;
    this.maxShield = shieldMax(st.res);
    if (this.shield !== undefined) this.shield = Math.min(this.shield, this.maxShield);
    this.regenDelay = regenDelay(st.rec) * (this.sets.has('titan') ? SET_TUNE.regenDelay : 1); // Arcology: Tidewater Seals
    this.regenRate = regenRate(st.rec);
    this.speed = 6.2 * speedMult(st.mob);
    this.jumpV = 8.2 + jumpBonus(st.mob);
    this.superRate = superRateMult(st.int);
    const ap = (k) => this.ap[k] || 0;
    const cd = (v, perk) => Math.max(COOLDOWN_FLOOR, cooldownMult(v) * perk);
    this.cdMax.grenade = this.cdBase.grenade * cd(st.dis, 1 - 0.15 * ap('grenadier'));
    this.cdMax.melee = this.cdBase.melee * cd(st.str, 1 - 0.15 * ap('brawler')) * (this.exo.has('synthoceps') ? 0.75 : 1);
    this.cdMax.class = this.cdBase.class * cd(st[CLASS_STAT[this.cls.id]], 1 - 0.2 * ap('kickstart')) * (this.exo.has('stomp') ? 0.7 : 1);
    if (this.exo.has('stomp')) { this.jumpV *= 1.3; this.speed *= 1.08; }
  }

  chargeDur() { return CHARGE.decay * (1 + CHARGE.timeDil * (this.ap.timedil || 0)); }
  chargeMax() { return CHARGE.max + (this.ap.chargedup || 0); }

  /** Armor charge: up to 3 stacks (Charged Up adds more); one stack decays at a time. */
  addCharge(n) {
    if (!this.modsOn) return;
    this.armorCharge = Math.min(this.chargeMax(), this.armorCharge + n);
    this.armorChargeT = this.chargeDur();
    if (!this.fonted) this.applyStats();
  }

  updateCharge(dt) {
    if (this.armorCharge > 0) {
      this.armorChargeT -= dt;
      if (this.armorChargeT <= 0) { this.armorCharge--; this.armorChargeT = this.chargeDur(); }
    }
    if ((this.armorCharge > 0) !== this.fonted) this.applyStats();
  }

  /** Surge mods: weapon damage of that element while armor is charged. */
  surgeMult(o) {
    if (this.armorCharge <= 0 || o.source !== 'weapon') return 1;
    return CHARGE.surge[Math.min(3, this.ap['surge_' + o.element] || 0)];
  }

  /** Set bonuses on kills: Hellmouth Vigil heals on precision weapon kills, Reef Outlaw empowers weapons after a powered melee kill. */
  setsOnKill(o) {
    if (this.sets.has('moon') && o.source === 'weapon' && o.crit) this.heal(SET_TUNE.precHeal);
    if (this.sets.has('tangled') && (o.source === 'ability' || o.source === 'melee') && G.time < this.meleeWin) this.status.apply('outlawsedge', { t: SET_TUNE.outlawT, set: true });
  }

  /** Weapon damage from set bonuses (Reef Outlaw). */
  setMult(o) {
    return o.source === 'weapon' && this.status.has('outlawsedge') ? SET_TUNE.outlawDmg : 1;
  }

  /** An Orb of Power appears where `pos` is, for the whole fireteam. */
  spawnOrb(pos) {
    if (!this.modsOn) return;
    castFx('orb', { p: pos.clone().setY(Math.max(0, pos.y)), id: `${net.myId || 'solo'}-${++this.orbN}` });
  }

  pickupOrb() {
    const ap = (k) => this.ap[k] || 0;
    if (!this.superActive) this.superCharge = Math.min(100, this.superCharge + ORB.super);
    this.heal(ORB.heal); // U9: every orb heals a little, with or without charge mods
    // U9: armor charge only when a mod uses it (Fonts, Surges, Charged Up, Time Dilation, Stacks on Stacks)
    if (usesCharge(this.ap)) this.addCharge(ORB.charge + ap('stacks') + (this.sets.has('mars') ? SET_TUNE.orbCharge : 0)); // Meridian Legion: Rally the Line
    for (const [k, mod] of [['grenade', 'innervation'], ['melee', 'invigoration'], ['class', 'insulation']]) {
      if (ap(mod)) this.cd[k] = Math.max(0, this.cd[k] - this.cdMax[k] * ORB.energy * ap(mod));
    }
    if (ap('betteralready')) this.regenT = 0;
    sfx.pickupAmmo();
  }

  /** Orb-making and ability-kill mods. `chain` kills (jolt chains, companions) never count. */
  modsOnKill(e, o, chain) {
    if (!this.modsOn || chain) return;
    const ap = this.ap, t = G.time;
    if (this.superActive) {
      if (this.superOrbs < ORB.superMax) { this.superOrbs++; this.spawnOrb(e.pos); }
      return;
    }
    const w = o.weapon;
    if (w && o.source === 'weapon') {
      if (w.item && ['legendary', 'exotic'].includes(w.item.rarity)) {
        this.wKills = this.wKills.filter((x) => t - x < ORB.window); this.wKills.push(t);
        if (this.wKills.length >= ORB.weaponKills) { this.wKills = []; this.spawnOrb(e.pos); }
      }
      if (ap.harmonic && o.element === this.cls.element) {
        this.hKills = this.hKills.filter((x) => t - x < ORB.harmonicWindow); this.hKills.push(t);
        if (this.hKills.length >= ORB.harmonicKills && t >= this.harmonicAt) { this.hKills = []; this.harmonicAt = t + ORB.harmonicGap; this.spawnOrb(e.pos); }
      }
    }
    if (o.source === 'ability' || o.source === 'melee') {
      if (t < this.meleeWin) { if (ap.heavyhanded && !this.meleeOrbUsed) { this.meleeOrbUsed = true; this.spawnOrb(e.pos); } }
      else if (t < this.classWin) { if (ap.reaper && !this.classOrbUsed) { this.classOrbUsed = true; this.spawnOrb(e.pos); } }
      else if (t < this.grenadeWin) { if (ap.firepower && !this.grenadeOrbUsed) { this.grenadeOrbUsed = true; this.spawnOrb(e.pos); } }
    }
  }

  /** The first hit of a powered melee or a grenade can refill other abilities (Impact Induction, Momentum Transfer, Bolstering Detonation). */
  modOnHit(o) {
    if (!this.modsOn) return;
    const ap = this.ap, t = G.time;
    const refill = (k, frac) => { this.cd[k] = Math.max(0, this.cd[k] - this.cdMax[k] * frac); };
    if (t < this.meleeWin) {
      if (this.meleePending) { this.meleePending = false; if (ap.impact) refill('grenade', MODS_TUNE.impact * ap.impact); }
    } else if (t < this.grenadeWin && this.grenadePending) {
      this.grenadePending = false;
      if (ap.momentum) refill('melee', MODS_TUNE.momentum * ap.momentum);
      if (ap.bolstering) refill('class', MODS_TUNE.bolstering * ap.bolstering);
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
    const scav = 1 + MODS_TUNE.scav * (this.ap[slot === 'special' ? 'scavs' : 'scavh'] || 0);
    w.reserve = Math.min(w.maxReserve, w.reserve + Math.round(w.brick * scav));
  }

  takeDamage(amount, from) {
    const M = G.mission;
    if (this.dead || M.phase === 'done' || M.phase === 'loot' || M.chest?.final) return; // the activity is complete: no more damage
    if (this.exo.has('quietone')) this.status.apply('quietone', { t: QUIET.t, set: true }); // Mask of the Quiet One
    if (this.superActive?.guard) {
      if (this.exo.has('ursa')) this.superActive.blocked = (this.superActive.blocked || 0) + amount * SENTINEL_GUARD.cut; // Ursa Furiosa
      if (amount > 0) { this.guardHits++; this.body?.blockHit(); sfx.block(); }
    }
    if (this.superActive) amount *= this.superActive.guard ? 1 - SENTINEL_GUARD.cut : SUPER_ARMOR[this.superActive.type] ?? 1;
    if (this.status.has('direahamkara')) amount *= DIRE.cut; // Skull of Dire Ahamkara
    if (this.status.has('well')) amount *= SUPER_TUNE.well.cut; // Well of Radiance
    if (this.status.has('unbreakable')) amount *= ASPECT_TUNE.unbreakable.cut; // Unbreakable shield
    if (this.frag.has('resistance') && enemiesNear(this.pos, FRAGMENT_TUNE.resistance.r, FRAGMENT_TUNE.resistance.n).length >= FRAGMENT_TUNE.resistance.n) amount *= FRAGMENT_TUNE.resistance.cut; // Spark of Resistance
    if (this.over > 0) {
      const a = Math.min(this.over, amount); this.over -= a; amount -= a;
      if (this.over <= 0) this.status.remove('overshield');
      if (amount <= 0) { sfx.hurt(); return; }
    }
    if (this.dash > 0) amount *= 0.5;
    if (this.status.has('juggernaut')) amount *= 0.5; // Juggernaut: frontal shield while sprinting
    if (this.status.has('contraverse')) amount *= 0.8; // Contraverse Hold
    const cw = this.weapon;
    if (cw?.has('conductor')) { if (this.status.has('conductor', cw.idx)) amount *= 0.75; this.status.apply('conductor', { scope: cw.idx, set: true }); }
    if (this.ap.plating) amount *= Math.max(0.6, 1 - 0.08 * this.ap.plating);
    if (this.status.has('emergency')) amount *= 1 - MODS_TUNE.emergency.cut; // Emergency Reinforcement
    this.regenT = this.regenDelay;
    const hadShield = this.shield > 0;
    if (this.shield > 0) {
      const a = Math.min(this.shield, amount);
      this.shield -= a; amount -= a;
      if (this.shield <= 0 && hadShield) {
        sfx.playerShieldBreak();
        if (this.ap.emergency && G.time >= this.emergT) { this.emergT = G.time + MODS_TUNE.emergency.cd; this.status.apply('emergency', { t: MODS_TUNE.emergency.t, set: true }); }
      }
    }
    this.health -= amount;
    sfx.hurt();
    ui.damageFlash();
    if (from) ui.damageDir(from);
    this.shake = Math.max(this.shake, this.ap.unflinching && this.adsT > 0.5 ? 0.08 * MODS_TUNE.unflinching : 0.08);
    if (this.health <= 0) this.die();
  }

  die() {
    const M = G.mission;
    this.dead = true; this.health = 0; this.shield = 0;
    this.superActive = null;
    this.status.remove('nighthawk');
    this.viewmodel.visible = false;
    M.deaths++;
    if (M.coop) {
      this.downT = DOWN_TIME; this.lifeAsked = false;
      ui.showDeath('You Died', 'A teammate can revive you');
    } else {
      M.revives--;
      if (M.revives < 0) { M.failing = true; this.respawnT = 2.5; }
      else this.respawnT = 5;
      ui.showDeath('You Died', M.revives < 0 ? 'No revives remaining' : `Revives remaining: ${M.revives}`);
    }
    sfx.death();
  }

  /** inPlace: revived by a teammate where we fell; otherwise back at the checkpoint. quiet: no banner (the activity just ended). */
  respawn(inPlace = false, quiet = false) {
    const M = G.mission;
    this.dead = false;
    this.health = this.maxHealth; this.shield = this.maxShield;
    if (!inPlace) this.pos.copy(M.checkpoint).add(new THREE.Vector3(0, 0, 6));
    this.vel.set(0, 0, 0);
    this.viewmodel.visible = true;
    this.showModel();
    ui.hideDeath();
    if (!quiet) ui.centerMessage('Revived', M.coop ? (inPlace ? 'A teammate picked you up' : `A life was used  ·  ${M.lives} left`) : `${M.revives} revive${M.revives === 1 ? '' : 's'} remaining`, 2);
  }

  /** Invisibility (Nightstalker). Graviton Forfeit makes it last longer. */
  goInvisible(t, set = true) { this.prowlUsed = false; this.status.apply('invisible', { t: this.voidT(t) * (this.exo.has('graviton') ? GRAVITON.dur : 1), set }); }

  /** Restoration (Sunsinger): health and shields regenerate for t seconds, even under fire. */
  restore(t) { this.status.apply('restoration', { t }); }
  /** Defender's Resolve: using a grenade, powered melee or class ability. */
  abilityAspects() {
    if (this.asp.has('resolve')) this.addOvershield(ASPECT_TUNE.resolve.over);
  }
  /** Gift of the Sun: a Firesprite on the ground that only this player sees and collects for grenade energy. */
  firesprite(at) {
    const T = ASPECT_TUNE.giftsun;
    this.spriteTk = (this.spriteTk ?? []).filter((t) => G.tickers.includes(t)); // tickers are dropped on a mission reset
    if (this.spriteTk.length >= T.max) return;
    const p = at.clone().setY(Math.max(0, at.y - 0.4)), col = ELEMENTS.solar.hex;
    const m = new THREE.Group();
    m.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })));
    m.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })));
    m.position.copy(p);
    G.scene.add(m);
    glowBurst(p, col, 10, 4, 0.08, 0.5, 2, 0.3);
    const self = this;
    let life = T.life;
    const tk = {
      update(dt) {
        life -= dt;
        m.position.y = p.y + Math.sin(G.time * 4) * 0.1;
        m.children[0].rotation.y += dt * 3;
        if (Math.random() < 0.3) ember(m.position.clone(), col, 0.04, 0.6, 0.5);
        if (!self.dead && Math.hypot(self.pos.x - p.x, self.pos.z - p.z) < T.r && Math.abs(self.pos.y + 1 - p.y) < 2) {
          self.cd.grenade = Math.max(0, self.cd.grenade - self.cdMax.grenade * T.energy);
          glowBurst(m.position.clone(), col, 14, 4, 0.08, 0.5, 2, 0.3);
          sfx.pickupAmmo();
          return false;
        }
        return life > 0 && G.player === self;
      },
      dispose() { G.scene?.remove(m); },
    };
    this.spriteTk.push(tk);
    addTicker(tk);
  }
  /** Overshield (Sentinel): extra protection on top of your shield that fades after a while. */
  addOvershield(n, t = 8) { this.over = Math.min(OVERSHIELD_MAX, this.over + n); this.status.apply('overshield', { t: this.voidT(t) }); }

  updateRegen(dt) {
    if (!this.status.has('overshield')) this.over = Math.max(0, this.over - dt * 15);
    if (this.status.has('restoration')) {
      this.heal(16 * dt);
      if (Math.random() < 0.2) ember(this.pos.clone().setY(this.pos.y + 0.4 + Math.random()), 0xffb547, 0.04, 1.2, 0.5);
    }
    if (this.exo.has('graviton') && this.status.has('invisible')) this.heal(GRAVITON.heal * dt); // Graviton Forfeit
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
    const song = this.keepsGuns ? SONG.abilityRegen : 1;
    const nez = this.status.has('nezarec') ? 2 : 1; // Nezarec's Sin
    const boost = this.buildRegen();
    // v1.7 exotics, outside REGEN_CAP like the others: Mask of the Quiet One, Hallowfire Heart, Graviton Forfeit (melee)
    const hallow = this.exo.has('hallowfire') && !this.superActive && this.superCharge >= 100;
    if (hallow) this.status.apply('hallowfire', { set: true }); else this.status.remove('hallowfire');
    const exo = (this.status.has('quietone') ? QUIET.regen : 1) * (hallow ? HALLOWFIRE.regen : 1);
    const grav = this.exo.has('graviton') && this.status.has('invisible') ? GRAVITON.melee : 1;
    for (const k of ['grenade', 'melee', 'class']) {
      this.cd[k] = Math.max(0, this.cd[k] - dt * (k === 'class' ? 1 : song) * (this.status.has('heart', k) ? 1.6 : 1) * nez * boost[k] * exo * (k === 'melee' ? grav : 1));
    }
    const IC = ASPECT_TUNE.icarus; // Icarus Dash: charges come back one at a time
    if (this.icarus.n < IC.charges && (this.icarus.t -= dt) <= 0) { this.icarus.n++; this.icarus.t = IC.cd; }
    if (this.asp.has('juggernaut')) {
      this.jugT = this.sprinting ? this.jugT + dt : 0;
      if (this.jugT >= 1) this.status.apply('juggernaut'); else this.status.remove('juggernaut');
    }
    this.meleeT = Math.max(0, this.meleeT - dt);
    this.updateExoticArmor(dt);
    const lw = this.weapon; // Lunafaction Boots (anyone's): standing in the rift reloads the weapon in your hands
    if (this.status.has('lunafaction') && lw.ammo < lw.mag && lw.reserve > 0 && !this.superActive) this.instantReload(lw);
    this.updateCharge(dt);
    this.meleeLock = Math.max(0, this.meleeLock - dt);
    if (!this.superActive) this.superCharge = Math.min(100, this.superCharge + dt * SUPER_PASSIVE * (1 + SUPER_DYNAMO * (this.ap.dynamo || 0)) * this.superRate * (this.sets.has('io') ? SET_TUNE.superPassive : 1));
    const ready = this.superCharge >= 100;
    if (ready && !this.superWasReady) sfx.superReady(); // the super bar turns gold
    this.superWasReady = ready;
    const p = G.input.pressed;
    if (p.KeyQ) this.useGrenade();
    if (p.KeyB) this.basicMelee();
    if (p.KeyV) this.useMelee();
    if (p.KeyC) this.useClass();
    if (p.ShiftLeft && this.asp.has('icarus') && !this.onGround && this.pos.y > 0.4) this.icarusDash();
    if (p.KeyF) this.useSuper();
  }

  /** Recharge speed per ability from aspects and fragments (capped by REGEN_CAP). */
  buildRegen() {
    const b = { grenade: [], melee: [], class: [] };
    const both = (x) => { b.grenade.push(x); b.melee.push(x); };
    if (this.status.has('sunspot')) { both(1.5); b.class.push(1.5); } // Sol Invictus
    if (this.asp.has('heatrises') && !this.onGround) both(1.5);
    if (this.asp.has('bulwark') && this.over > 0) b.grenade.push(1.5);
    if (this.frag.has('recharge') && this.health < this.maxHealth * 0.5) both(1.5);
    if (this.frag.has('momentum') && this.sprinting) both(1.2);
    if (this.status.has('flowstate')) b.class.push(1.5);
    if (this.frag.has('benevolence') && this.status.has('restoration')) { both(FRAGMENT_TUNE.benevolence); b.class.push(FRAGMENT_TUNE.benevolence); } // Ember of Benevolence
    if (this.asp.has('prowl') && this.status.has('invisible')) b.melee.push(ASPECT_TUNE.prowl.melee); // On the Prowl
    return { grenade: regenMult(b.grenade), melee: regenMult(b.melee), class: regenMult(b.class) };
  }

  /** Per-frame exotic armor effects. */
  updateExoticArmor(dt) {
    const x = this.exo;
    if (x.has('starfire') && this.gBank < 1) {
      // the stored second charge recharges once the first one is full
      if (this.cd.grenade <= 0) { this.gBankT += dt; if (this.gBankT >= this.cdMax.grenade) { this.gBank = 1; this.gBankT = 0; } }
    }
    const w = this.weapon;
    if (this.sprinting) {
      if (x.has('transversive')) { this.trvT += dt; if (this.trvT > 0.6 && w.ammo < w.mag && w.reserve > 0) { this.instantReload(w); this.trvT = 0; } }
      if (x.has('dunemarchers') && this.dune < 1) { this.dune = Math.min(1, this.dune + dt / 1.5); if (this.dune >= 1) this.status.apply('dunemarchers'); }
    } else this.trvT = 0;
    if (this.dune >= 1 && Math.random() < 0.3) sparks(this.pos.clone().setY(this.pos.y + 0.3), ELEMENTS.arc.hex, 1, 2, 0.04, 0.2);
  }

  /** Super kills for v1.7 exotics: Stormdancer's Brace (during Stormtrance), Skull of Dire Ahamkara (Nova Bomb, which lands after the cast ends). */
  exoticSuperKill() {
    const S = this.superActive;
    if (this.exo.has('stormdancer') && S?.type === 'stormtrance') {
      S.storm = Math.min(STORMDANCER.maxStacks, S.storm + 1);
      const add = Math.min(STORMDANCER.extend, STORMDANCER.maxExtend - S.ext);
      if (add > 0) { S.ext += add; S.t += add; S.max = Math.max(S.max, S.t); }
      this.status.apply('stormdancer', { stacks: S.storm, set: true });
    }
    if (this.exo.has('direahamkara') && this.cls.abilities.super.id === 'nova' && (!S || S.type === 'nova')) {
      const add = Math.min(DIRE.perKill, DIRE.max - this.novaRefund);
      if (add > 0) { this.novaRefund += add; this.superCharge = Math.min(100, this.superCharge + add); }
      this.status.apply('direahamkara', { t: DIRE.t, set: true });
    }
  }

  /** Dunemarchers: a charged melee chains lightning. */
  discharge() {
    if (this.dune < 1) return;
    this.dune = 0;
    this.status.remove('dunemarchers');
    const p = this.pos.clone().addScaledVector(this.getForward(new THREE.Vector3()).setY(0).normalize(), 2).setY(1);
    this.jolt(p, 3, 250);
    sfx.zap();
  }

  /** Heart of Inmost Light: using one ability empowers the other two. */
  empowerOthers(used) {
    if (!this.exo.has('heart')) return;
    for (const k of ['grenade', 'melee', 'class']) if (k !== used) this.status.apply('heart', { scope: k, t: 8, set: true });
  }

  useGrenade() {
    if (this.cd.grenade > 0 && this.status.has('gunpowder')) { this.throwGunpowder(); return; }
    if (this.asp.has('unbreakable')) { this.unbreakable(); return; }
    const free = this.status.has('sunbracers') && this.cls.abilities.grenade.element === 'solar'; // Sunbracers
    if (free) {
      if (G.time - this.freeGAt < SUNBRACERS.gap) return;
      this.freeGAt = G.time;
    } else if (this.cd.grenade > 0) {
      if (this.gBank <= 0) { sfx.denied(); return; }
      this.gBank--; // Starfire Protocol: spend the stored second charge
    } else this.cd.grenade = this.cdMax.grenade; // (cooldowns run 4x during Song of Flame)
    this.grenadeWin = G.time + 3; this.grenadePending = true; this.grenadeOrbUsed = false; // grenade mods: hits and kills in the next 3s
    const g = this.cls.abilities.grenade;
    if (this.exo.has('contraverse') && g.element === 'void') this.status.apply('contraverse', { t: 3, set: true }); // Void grenades only
    this.empowerOthers('grenade');
    const el = g.element;
    const fwd = this.getForward(new THREE.Vector3());
    const start = this.eye.clone().addScaledVector(fwd, 0.6);
    spawnPlayerProjectile({
      kind: 'grenade', pos: start, vel: fwd.clone().multiplyScalar(24).add(new THREE.Vector3(0, 4, 0)),
      gravity: 22, size: 0.16, color: ELEMENTS[el].hex, life: 2.0, onHit: (pt, e) => this.detonateGrenade(g, pt, e),
    });
    flare(start, ELEMENTS[el].hex, 0.4, 0.15);
    this.abilityAspects();
    this.throwFist(0.32);
    sfx.throw();
  }

  /** Gunpowder Gamble: an explosive charged by kills, thrown while the grenade recharges. */
  throwGunpowder() {
    this.status.remove('gunpowder');
    const fwd = this.getForward(new THREE.Vector3());
    const start = this.eye.clone().addScaledVector(fwd, 0.6);
    spawnPlayerProjectile({
      kind: 'grenade', pos: start, vel: fwd.clone().multiplyScalar(24).add(new THREE.Vector3(0, 4, 0)), gravity: 22, size: 0.2, color: ELEMENTS.solar.hex, life: 2.0,
      onHit: (pt) => {
        pt.y = Math.max(pt.y, 0.3);
        castFx('blast', { p: pt, el: 'solar', r: 4.5 });
        for (const e of enemiesNear(pt, 4.5)) this.ignite(e, 30, 3);
        explode(pt.clone(), 4.5, 260, 'solar', { source: 'ability' });
      },
    });
    this.throwFist(0.32);
    sfx.throw();
  }

  detonateGrenade(g, pt, hitEnemy = null) {
    pt.y = Math.max(pt.y, 0.3);
    if (this.exo.has('contraverse') && g.element === 'void' && enemiesNear(pt, 6).length) this.cd.grenade *= 0.7; // refund 30% (Void grenades)
    if (this.exo.has('raspberry') && g.element === 'arc') {
      // Lucky Raspberry: Arc grenades chain further and refund energy when they catch someone
      if (enemiesNear(pt, 6).length) this.cd.grenade *= 1 - RASPBERRY.refund;
      this.jolt(pt.clone(), RASPBERRY.chains, 120);
    }
    const id = g.kind, el = g.element;
    // aspect and fragment upgrades
    const thunder = this.asp.has('thunder'), flame = this.asp.has('touchflame'), chaos = this.asp.has('chaos');
    const jolt = this.frag.has('shock') ? 4 : 0, weaken = this.frag.has('undermining') ? 4 : 0;
    const mag = this.frag.has('magnitude') ? FRAGMENT_TUNE.magnitude : null, linger = this.frag.has('remnants') ? FRAGMENT_TUNE.remnants : 1;
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
        if (stuck && stuck.alive) dealDamage(stuck, 300, { element: 'arc', source: 'ability', pos: pt.clone(), jolt: thunder ? 4 : jolt });
        explode(pt.clone(), 3.5, 140, 'arc', { source: 'ability', debuffs: { jolt } });
        self.jolt(pt.clone(), 2 + (mag ? mag.flux : 0), 120, stuck, jolt);
        return false;
      } });
      return;
    }
    if (id === 'healing') {
      explode(pt.clone(), 4, 150, 'solar', { source: 'ability' });
      castFx('healburst', { p: pt, r: flame ? 9 : 7, big: flame });
      return;
    }
    if (id === 'suppressor') {
      const r = chaos ? 8 : 6;
      castFx('suppress', { p: pt, r });
      for (const e of enemiesNear(pt, r)) dealDamage(e, 150, { element: 'void', source: 'ability', suppress: 4, weaken: Math.max(3, weaken) });
      return;
    }
    if (id === 'pulse') castFx('pulse', { p: pt, el, n: ((el === 'arc' && thunder) || (el === 'solar' && flame) ? 8 : 6) + (el === 'arc' && mag ? mag.pulses : 0), jolt: el === 'arc' ? jolt : 0, scorch: el === 'solar' && flame });
    else if (id === 'vortex') castFx('vortex', { p: pt, big: chaos, weaken, linger });
    else if (id === 'storm') castFx('storm', { p: pt, life: (thunder ? 4.5 : 3) + (mag ? mag.storm : 0), jolt });
    else if (id === 'swarm' || id === 'axion') {
      // Swarm Grenade: 4 small seekers (6 with Touch of Flame). Axion Bolt: 2 strong ones (3 with Chaos Accelerant).
      castFx('burst', { p: pt, el });
      const n = id === 'swarm' ? (flame ? 6 : 4) : (chaos ? 3 : 2), dmg = id === 'swarm' ? 110 : 170;
      const targets = enemiesNear(pt, 20, n);
      for (let i = 0; i < n; i++) {
        const tgt = targets[i % Math.max(1, targets.length)] || null;
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        spawnPlayerProjectile({
          kind: 'swarm', pos: pt.clone().add(new THREE.Vector3(0, 0.4, 0)), vel: new THREE.Vector3(Math.cos(a) * 8, 9, Math.sin(a) * 8),
          gravity: tgt ? 0 : 14, size: id === 'axion' ? 0.1 : 0.07, color: ELEMENTS[el].hex, life: 2.5, target: tgt, turn: 4,
          onHit: (p, e) => {
            if (e && e.alive) dealDamage(e, dmg, { element: el, source: 'ability', pos: p.clone(), weaken: id === 'axion' ? Math.max(2, weaken) : 0 });
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

  /** A Twilight Arsenal axe picked up from the ground: left-click throws it. */
  throwHeldAxe() {
    this.status.remove('voidaxe');
    this.meleeLock = 0.4;
    this.throwAxe(this.aimForward(new THREE.Vector3()), superDmg(SUPER_TUNE.twilight.pickup), false);
    this.throwFist(0.3);
  }

  /** B: plain melee. Lunges a short way toward a close target. */
  basicMelee() {
    if (this.meleeLock > 0 || this.superActive?.type === 'nova') return;
    this.meleeT = 0.6;
    this.meleeLock = 0.6;
    this.throwFist(0.3, true);
    sfx.melee();
    this.discharge();
    const ko = this.status.has('knockout'), lunge = this.lungeMul * (ko ? 1.5 : 1); // Knockout
    const t = this.findMeleeTarget(4.5 * lunge, 0.55);
    if (!t) return;
    const c = t.center(new THREE.Vector3());
    const dir = c.clone().sub(this.pos).setY(0);
    const dist = dir.length();
    dir.normalize();
    if (dist > 1.6) this.pos.addScaledVector(dir, Math.min(3 * lunge, dist - t.radius - 1.0));
    const cross = this.status.has('crosscounter'); // Liar's Handshake
    if (cross) { this.status.remove('crosscounter'); this.heal(LIARS.heal); }
    this.inBasicMelee = true;
    dealDamage(t, (ko ? 140 : 70) * (cross ? LIARS.mult : 1), { element: ko ? 'arc' : 'kinetic', source: 'melee', pos: c, knock: dir.clone().multiplyScalar(ko ? 10 : 7) });
    this.inBasicMelee = false;
    sparks(c, 0xffffff, 8, 5, 0.06, 0.3);
    flare(c, 0xffffff, 0.5, 0.12);
    this.shake = Math.max(this.shake, 0.08);
  }

  /** V: powered class melee (needs the ability charged). */
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
    this.meleeT = 1.2;
    this.meleeWin = G.time + 1.5; this.meleePending = true; this.meleeOrbUsed = false; // melee mods
    this.empowerOthers('melee');
    this.abilityAspects();
    this.discharge();
    sfx.melee();
    if (this.frag.has('torches')) this.status.apply('radiant', { set: true }); // Ember of Torches
    if (this.frag.has('frequency')) this.status.apply('frequency', { set: true }); // Spark of Frequency
    if (this.asp.has('consecration')) this.consecrate(fwd);
    if (this.asp.has('surge') && this.sprinting) { this.lightningSurge(fwd); return; }
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
          onHit: (p) => castFx('snare', { p: p.setY(Math.max(0.3, p.y)), linger: this.frag.has('remnants') ? FRAGMENT_TUNE.remnants : 1 }),
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
          this.dropHammer(p, fwd);
        },
      });
      sfx.throw();
      return;
    }
    if (id === 'combo') {
      // Combination Blow: lunge strike; kills heal fully and refund half the melee. Lethal Current doubles it after a dodge.
      this.throwFist(0.32, true);
      const t = this.findMeleeTarget(6 * this.lungeMul, 0.65);
      const lethal = this.status.has('lethal');
      this.status.remove('lethal');
      if (!t) { castFx('slam', { p: this.pos.clone().addScaledVector(fwd.clone().setY(0).normalize(), 2).setY(0.6), el: 'arc', r: 3 }); return; }
      t.center(c);
      const dir = c.clone().sub(this.pos).setY(0).normalize();
      const dist = c.clone().setY(0).distanceTo(_v.copy(this.pos).setY(0));
      this.pos.addScaledVector(dir, Math.max(0, dist - t.radius - 1.0));
      const res = dealDamage(t, lethal ? 520 : 260, { element: 'arc', source: 'ability', pos: c, knock: dir.clone().multiplyScalar(8) });
      castFx('slam', { p: c.clone(), el: 'arc', r: lethal ? 5 : 3 });
      if (lethal) this.jolt(c.clone(), 3, 140, t);
      if (res.killed) { this.heal(1000); this.cd.melee *= 0.5; this.status.apply('combo', { set: true }); sfx.heal(); }
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
      const t = this.findMeleeTarget(7 * this.lungeMul, 0.7);
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

  /** Consecration: a wave of solar fire rolls along the ground ahead. */
  consecrate(fwd) {
    const flat = fwd.clone().setY(0).normalize(), start = this.pos.clone();
    [2.5, 5, 7.5].forEach((d, i) => after(0.1 + i * 0.09, () => {
      const p = start.clone().addScaledVector(flat, d).setY(0.6);
      castFx('slam', { p, el: 'solar', r: 2.6 });
      for (const e of enemiesNear(p, 2.6)) this.ignite(e, 20, 2);
      explode(p, 2.6, 80, 'solar', { source: 'ability', small: true });
    }));
  }

  /** Lightning Surge: surge forward and call lightning down along the path. */
  lightningSurge(fwd) {
    const flat = fwd.clone().setY(0).normalize(), start = this.pos.clone();
    this.dashDir.copy(flat); this.dash = 0.28; this.dashSpeed = 30;
    this.fovKick = Math.max(this.fovKick, 12);
    [2.5, 5.5, 8.5].forEach((d, i) => after(0.08 + i * 0.07, () => {
      const p = start.clone().addScaledVector(flat, d).setY(0.6);
      castFx('chain', { pts: [p.clone().setY(14), p], el: 'arc', beam: true, w: 0.1 });
      explode(p, 3, 160, 'arc', { source: 'ability', debuffs: { jolt: 4 } });
    }));
    sfx.zap();
  }

  /** Throwing Hammer on the ground: stand next to it to pick it up (melee recharged, small heal). Left alone, it glows brighter and explodes. */
  dropHammer(p, fwd) {
    const at = p.clone();
    // a wall hit lands inside the wall: step back along the throw until clear
    const back = fwd.clone().setY(0).normalize().multiplyScalar(-0.1);
    const solid = G.colliders.filter((c) => !c.pass); // never on a barricade
    for (let i = 0; i < 30 && pointInColliders(at.clone().setY(restHeight(at.x, at.z, at.y, solid) + 0.15), 0.15, true); i++) at.add(back);
    const base = restHeight(at.x, at.z, at.y, solid); // crate top or ground
    at.y = base + 0.15;
    const mesh = projectileMesh({ kind: 'hammer', color: ELEMENTS.solar.hex, size: 0.16 });
    mesh.position.copy(at);
    mesh.rotation.set(0, Math.random() * 6, Math.PI / 2);
    G.scene.add(mesh);
    const self = this;
    let life = HAMMER_FUSE.fuse;
    addTicker({
      update(dt) {
        life -= dt;
        const heat = 1 - life / HAMMER_FUSE.fuse; // 0 when it lands, 1 when it blows
        mesh.position.y = at.y + Math.abs(Math.sin(G.time * (3 + heat * 9))) * 0.08;
        mesh.scale.setScalar(1 + heat * 0.35 + (heat > 0.7 ? Math.sin(G.time * 30) * 0.08 : 0));
        if (Math.random() < 0.3 + heat * 0.7) ember(at.clone().setY(at.y + 0.15), heat > 0.6 ? 0xffe0a0 : 0xffb547, 0.03 + heat * 0.06, 0.8, 0.4 + heat);
        if (life <= 0) {
          explode(at.clone(), HAMMER_FUSE.r, HAMMER_FUSE.dmg, 'solar', { source: 'ability' });
          castFx('blast', { p: at.clone(), el: 'solar', r: HAMMER_FUSE.r });
          return false;
        }
        const P = G.player;
        if (P === self && !P.dead && Math.hypot(P.pos.x - at.x, P.pos.z - at.z) < 1.6 && Math.abs(P.pos.y - at.y) < 2) {
          P.cd.melee = 0;
          P.heal(30);
          P.status.apply('hammer', { set: true });
          sfx.engram(1);
          flare(at.clone().setY(at.y + 0.45), ELEMENTS.solar.hex, 0.8, 0.2);
          return false;
        }
        return life > 0;
      },
      dispose() { G.scene?.remove(mesh); },
    });
  }

  /** A tracking round (SIVA, Wolfpack): a particle swarm that flies to the target and bursts where it lands. */
  seekerSwarm(from, target, color, size, onArrive) {
    const a = Math.random() * Math.PI * 2;
    spawnPlayerProjectile({
      kind: 'swarm', pos: from.clone(), vel: new THREE.Vector3(Math.cos(a) * 6, 7, Math.sin(a) * 6),
      gravity: target ? 0 : 14, size, color, life: 2, target, turn: 5,
      onHit: (p) => onArrive(p),
    });
  }

  /** Arc jolt: lightning from p into up to n more enemies. */
  jolt(p, n, dmg, skip = null, joltT = 0) {
    const pts = [p.clone()];
    for (const e of enemiesNear(p, 10, n + 1)) {
      if (e === skip || !e.alive || pts.length > n) continue;
      const c = e.center(new THREE.Vector3());
      dealDamage(e, dmg, { element: 'arc', source: 'ability', pos: c, jolt: joltT });
      pts.push(c);
    }
    if (pts.length > 1) castFx('chain', { pts, el: 'arc', w: 0.05 });
  }

  /** Solar burn: dps damage per second for t seconds. */
  ignite(e, dps, t) {
    let left = t * (this.frag.has('ashes') ? 1.5 : 1), tick = 0.5; // Ember of Ashes
    if (e.alive) e.status.apply('burn', { t: left }); // shown at once; each tick also sends it to the enemy's owner
    addTicker({ update(dt) {
      left -= dt; tick -= dt;
      if (tick <= 0 && e.alive) { tick = 0.5; dealDamage(e, dps * 0.5, { element: 'solar', source: 'ability', burn: Math.min(left + 0.1, 0.6) }); ember(e.center(new THREE.Vector3()), 0xff8b2b, 0.05, 1, 0.4); }
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
    const airborne = !this.onGround && this.pos.y > 0.4;
    if (this.cd.class > 0) { sfx.denied(); return; }
    const id = this.cls.abilities.class.id;
    this.cd.class = this.cdMax.class;
    this.classWin = G.time + 2; this.classOrbUsed = false; // Reaper
    this.empowerOthers('class');
    sfx.ability();
    this.abilityAspects();
    if (id === 'barricade' || id === 'rally') {
      const fwd = this.getForward(new THREE.Vector3()).setY(0).normalize();
      const p = this.pos.clone().addScaledVector(fwd, id === 'rally' ? 2.4 : 3.2);
      castFx('barricade', { p, alongX: Math.abs(fwd.z) > Math.abs(fwd.x), small: id === 'rally', el: this.cls.element });
      this.status.apply('barricadeup', { t: CLASS_FX_LIFE[id], set: true });
      for (const ww of this.weapons) this.instantReload(ww);
      this.status.apply(id === 'rally' ? 'rally' : 'reloaded', { set: true });
    } else if (id === 'phoenix') {
      this.phoenixDive(airborne);
    } else if (id === 'marksman' || id === 'gambler') {
      this.dodge(id, airborne);
    } else if (id === 'rift' || id === 'empower') {
      castFx('rift', { p: this.pos.clone(), kind: id === 'empower' ? 'empower' : 'heal', el: this.cls.element, luna: this.exo.has('lunafaction') }); // Lunafaction Boots: for everyone inside
      ui.screenFlash(ELEMENTS[this.cls.element].color, 0.2);
      this.status.apply('riftup', { t: CLASS_FX_LIFE.rift, set: true });
      if (this.asp.has('childgods')) castFx('companion', { p: this.pos.clone(), kind: 'child', life: 8 });
      if (this.asp.has('arcsoul')) castFx('companion', { p: this.pos.clone(), kind: 'soul', life: ARC_SOUL.life });
    }
    // Hellion (U9): any class ability summons it, and it follows you
    if (this.asp.has('hellion')) castFx('companion', { p: this.pos.clone(), kind: 'hellion', life: ASPECT_TUNE.hellion.life });
  }

  /** Hunter dodges. Marksman's reloads, Gambler's recharges the melee; aspects add the rest. */
  dodge(id, airborne) {
    const md = this.moveDir;
    if (md && md.len > 0) this.dashDir.set(md.x, 0, md.z);
    else this.dashDir.copy(this.getForward(new THREE.Vector3()).setY(0).normalize().negate());
    this.dash = 0.22; this.dashSpeed = 20;
    const A = this.asp, el = this.cls.element;
    castFx(A.has('vanishing') ? 'vanish' : 'dodge', { p: this.pos.clone(), el });
    const self = this, col = ELEMENTS[el].hex;
    let t = 0.22;
    addTicker({ update(dt) { t -= dt; afterimage(self.pos, col, 0.35); return t > 0; } });
    this.fovKick = Math.max(this.fovKick, 10);
    if (id === 'marksman') this.instantReload(this.weapon);
    if (id === 'gambler' || A.has('crackling')) { this.cd.melee = 0; this.status.apply('meleeready', { set: true }); } // Crackling Blade: dodging recharges your melee
    if (A.has('lethal')) this.status.apply('lethal', { t: 4, set: true });
    if (A.has('vanishing')) this.goInvisible(4);
    if (A.has('trapper')) castFx('snare', { p: this.pos.clone().setY(0.3), linger: this.frag.has('remnants') ? FRAGMENT_TUNE.remnants : 1 });
    if (A.has('crackshot')) this.crackshot();
    if (A.has('onyourmark')) this.status.apply('onyourmark', { add: 1, set: true });
    if (A.has('knockemdown')) this.cd.melee *= 0.5;
    if (A.has('ascension') && airborne) {
      this.dash = 0;
      this.vel.y = 13;
      castFx('airburst', { p: this.pos.clone(), el: 'arc' });
      this.jolt(this.pos.clone().setY(this.pos.y + 1), 3, 120, null, 4);
    }
  }

  /** Phoenix Dive (Dawnblade class ability): from the air, slam down in a solar burst; on the ground, burst in place. Always heals. */
  phoenixDive(airborne) {
    if (airborne) { this.vel.set(this.vel.x * 0.2, -30, this.vel.z * 0.2); this.diving = true; }
    else this.phoenixBurst();
    this.heal(60);
    this.restore(5);
    sfx.heal();
  }
  phoenixBurst() {
    castFx('phoenix', { p: this.pos.clone(), r: 5 });
    explode(this.pos.clone().setY(this.pos.y + 0.6), 5, 170, 'solar', { source: 'ability' });
    this.shake = 0.3;
  }

  /** Icarus Dash (aspect): an air dash in the movement direction, on its own charges. */
  icarusDash() {
    const IC = ASPECT_TUNE.icarus;
    if (this.icarus.n <= 0 || this.diving) return;
    if (this.icarus.n === IC.charges) this.icarus.t = IC.cd;
    this.icarus.n--;
    const md = this.moveDir;
    if (md && md.len > 0) this.dashDir.set(md.x, 0, md.z);
    else this.dashDir.copy(this.getForward(new THREE.Vector3()).setY(0).normalize());
    this.dash = IC.t; this.dashSpeed = IC.speed;
    this.vel.y = Math.max(this.vel.y, 1);
    castFx('airburst', { p: this.pos.clone(), el: 'solar' });
    const self = this, col = ELEMENTS.solar.hex;
    let t = IC.t;
    addTicker({ update(dt) { t -= dt; afterimage(self.pos, col, 0.35); return t > 0; } });
    this.fovKick = Math.max(this.fovKick, 8);
  }

  /** Blink: a short teleport in the movement direction, moved in small steps so it never passes through a wall. */
  blink(wx, wz, dist = JUMP_TUNE.blink.dist) {
    const B = { ...JUMP_TUNE.blink, dist };
    const dir = Math.hypot(wx, wz) > 0.1 ? new THREE.Vector3(wx, 0, wz).normalize() : this.getForward(new THREE.Vector3()).setY(0).normalize();
    const from = this.pos.clone();
    const step = new THREE.Vector3(dir.x * B.dist, B.lift, dir.z * B.dist).divideScalar(B.steps);
    for (let i = 0; i < B.steps; i++) moveBody(this.pos, _v2.copy(step).multiplyScalar(20), 0.05, this.radius, this.height);
    this.vel.set(dir.x * 4, Math.max(0, this.vel.y) * 0.3, dir.z * 4);
    castFx('blink', { a: from.setY(from.y + 1), b: this.pos.clone().setY(this.pos.y + 1), el: this.cls.element });
    this.fovKick = Math.max(this.fovKick, 8);
    sfx.airMove();
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
    if (this.superActive?.type === 'chaosreach') { this.endChaosReach(); return; } // F again ends Chaos Reach
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
    const T = SUPER_TIME[ab.id];
    if (T === undefined) throw new Error(`useSuper: no duration for ${ab.id}`);
    this.superOrbs = 0; this.novaRefund = 0;
    const shots = { revolver: 6 + (this.asp.has('knockemdown') ? 2 : 0), tether: 3, twilight: 3, stormsedge: 3 }[ab.id] ?? 0;
    this.superActive = { type: ab.id, t: T, max: T, cd: 0, age: 0, shots, launched: false, combo: 0, comboT: 0, bashCd: 0, dodgeCd: 0, auraT: 0, blocked: 0, orph: 0, storm: 0, ext: 0, charge: 0 };
    this.startSuper(this.superActive);
    if (ab.id === 'songflame') { this.cd.grenade = 0; this.cd.melee = 0; }
    if (this.exo.has('nighthawk') && ab.id === 'revolver') {
      // Celestial Nighthawk: one devastating Golden Gun shot; a kill with it returns super energy
      this.status.apply('nighthawk', { value: NIGHTHAWK.goldenGun });
      this.superActive.shots = 1;
      this.hawkKill = false;
    }
    if (ab.id === 'staff') Object.assign(this.superActive, { raid: 0, raidAt: -9, ext: 0 }); // Raiden Flux
    if (ab.id === 'sentinel') this.addOvershield(OVERSHIELD_MAX, 15);
    this.showModel();
  }

  updateSuper(dt) {
    const S = this.superActive;
    S.t -= dt; S.cd -= dt; S.age += dt;
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
          onHit: (p) => {
            explode(p, 4.5, superDmg(420), 'solar', { source: 'super' });
            castFx('blast', { p, el: 'solar', r: 4.5 });
            castFx('sunspot', { p: p.clone().setY(restHeight(p.x, p.z, p.y, G.colliders.filter((c) => !c.pass))) }); // Hammer of Sol leaves a Sunspot
          },
        });
        this.kick = 1; flash.visible = true;
        this.throwFist(0.25);
        sfx.shot('hammer');
      }
    }
    if (S.type === 'revolver' && inp.mouse.leftPressed && S.cd <= 0 && S.shots > 0) {
      S.cd = 0.35; S.shots--;
      const pseudo = { s: { range: 200 }, A: { prec: 1.5 }, item: { element: 'solar' }, has: () => false };
      const shot = { isSuper: true, element: 'solar', precMult: 1.5, range: 220, noTracer: true };
      const gg = this.asp.has('knockemdown') ? GOLDEN_GUN.knockMult : 1; // two extra shots cost a little damage each
      const end = this.hitscan(this.eye, fwd, pseudo, superDmg(GOLDEN_GUN.shot) * gg, hand, shot);
      const pts = [hand.clone(), end.clone()];
      let prev = end;
      // the splash never re-hits the enemy the shot struck
      for (const e of chainTargets(shot.hit, enemiesNear(end, 10, GOLDEN_GUN_SPLASH + 1), GOLDEN_GUN_SPLASH)) {
        const c = e.center(new THREE.Vector3());
        dealDamage(e, superDmg(GOLDEN_GUN.splash) * gg, { element: 'solar', source: 'super', pos: c });
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
      // the ball gathers over the raised hands in third person (U9), in the hand in first person
      const ball = this.thirdPerson ? _v2.set(this.pos.x, this.pos.y + 2.45, this.pos.z) : hand;
      if (!S.launched) { for (let i = 0; i < 3; i++) swirl(ball, 0.8, i ? ELEMENTS.void.hex : VOID_FX.hi, 0.4, true, 0.04, 0.3); if (Math.random() < 0.5) voidMote(ball, 1, 0.3, 0.07); }
      if (!S.launched && S.t < 0.45) {
        S.launched = true;
        spawnPlayerProjectile({
          kind: 'nova', pos: this.eye.clone().addScaledVector(fwd, 1.2), vel: fwd.clone().multiplyScalar(30), gravity: 0,
          size: 0.7, color: ELEMENTS.void.hex, life: 5,
          onHit: (p) => {
            explode(p, 10, superDmg(2600), 'void', { source: 'super' });
            castFx('blast', { p, el: 'void', r: 10, big: true });
            // the bomb leaves a void field that damages, weakens and suppresses whatever stays inside
            castFx('novafield', { p: p.clone().setY(restHeight(p.x, p.z, p.y, G.colliders.filter((c) => !c.pass))), dmg: superDmg(NOVA_FIELD.dmg) });
          },
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
          if (this.exo.has('orpheus') && this.superActive?.type === 'tether') this.superActive.orph += enemiesNear(p, 8).length * ORPHEUS.perEnemy; // Orpheus Rig
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
          const sd = 1 + STORMDANCER.step * S.storm; // Stormdancer's Brace
          dealDamage(best, superDmg(26) * sd, { element: 'arc', source: 'super', pos: bc });
          pts.push(bc);
          for (const e of chainTargets(best, enemiesNear(best.pos, 8, STORMTRANCE_CHAIN + 1), STORMTRANCE_CHAIN)) {
            const ec = e.center(new THREE.Vector3());
            dealDamage(e, superDmg(14) * sd, { element: 'arc', source: 'super', pos: ec });
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
        const hits = enemiesNear(center, finisher ? 4.2 : 3.2);
        let raid = 1;
        if (this.exo.has('raiden') && hits.length) {
          // Raiden Flux: hits extend the super; quick successive hits stack damage
          S.raid = G.time - S.raidAt <= RAIDEN.window ? Math.min(RAIDEN.maxStacks, S.raid + 1) : 0;
          S.raidAt = G.time;
          raid = 1 + RAIDEN.step * S.raid;
          const add = Math.min(RAIDEN.extend, RAIDEN.maxExtend - S.ext);
          if (add > 0) { S.ext += add; S.t += add; S.max = Math.max(S.max, S.t); }
        }
        for (const e of hits) {
          dealDamage(e, superDmg(finisher ? 520 : 260) * raid, { element: 'arc', source: 'super', pos: e.center(new THREE.Vector3()), knock: flat.clone().multiplyScalar(finisher ? 12 : 5) });
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
      if (S.guard) this.barrierBlind();
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
    this.updateAscendantSuper(S, dt, fwd, hand, flash);
    if (S.t <= 0) {
      this.superActive = null; this.status.remove('nighthawk'); this.status.remove('stormdancer'); this.showModel();
      if (this.hawkKill) { this.hawkKill = false; this.superCharge = Math.min(100, this.superCharge + NIGHTHAWK.refund); } // Celestial Nighthawk
      // Ursa Furiosa and Orpheus Rig pay out when the super ends
      const back = Math.min(URSA.max, S.blocked * URSA.perDmg) + Math.min(ORPHEUS.max, S.orph);
      if (back > 0) this.superCharge = Math.min(100, this.superCharge + back);
    }
  }


  // -------------------------------------------------------------------------
  // Light Ascendant supers
  // -------------------------------------------------------------------------
  /** One-time setup when a super starts. */
  startSuper(S) {
    const id = S.type;
    if (id === 'thundercrash') { this.vel.set(0, 15, 0); this.onGround = false; S.dir = this.aimForward(new THREE.Vector3()); }
    if (id === 'spectral') this.goInvisible(3);
    // U9: Well and Ward slam to the ground first (a dive from the air), then cast where you land
    if (SLAM_SUPERS.includes(id)) { S.slam = true; if (this.onGround) { this.vel.set(0, SUPER_HOVER.hop, 0); this.onGround = false; } }
    // U9: burst supers lift the caster and hold them in the air while casting
    if (BURST_SUPERS.includes(id)) { S.hoverY = this.pos.y + SUPER_HOVER.lift; this.onGround = false; }
  }

  /** Well of Radiance / Ward of Dawn, once the caster has slammed into the ground. */
  castSlamSuper(S) {
    S.slam = false;
    this.shake = 0.5;
    castFx('slam', { p: this.pos.clone().setY(this.pos.y + 0.3), el: this.cls.element, r: 4 });
    if (S.type === 'wardofdawn') {
      castFx('ward', { p: this.pos.clone(), r: SUPER_TUNE.ward.r, life: SUPER_TUNE.ward.life, wol: true });
      this.addOvershield(OVERSHIELD_MAX, 4);
    }
    if (S.type === 'well') {
      // plant the sword: a blast, then the well
      const p = this.pos.clone().setY(Math.max(0.6, this.pos.y + 0.6));
      explode(p, SUPER_TUNE.well.r, superDmg(SUPER_TUNE.well.blast), 'solar', { source: 'super' });
      castFx('well', { p: this.pos.clone(), r: SUPER_TUNE.well.r, life: SUPER_TUNE.well.life });
      this.throwFist(0.4, true);
    }
  }

  get guarding() { return this.superActive?.type === 'sentinel' && !!this.superActive.guard && !this.dead; }
  /** U9: enemy shots that reach the Sentinel Shield barrier stop there. */
  barrierBlocks(p) { return this.guarding && barrierStops(this.pos.x, this.pos.y, this.pos.z, this.yaw, p); }
  barrierBlocked(dmg) {
    if (this.exo.has('ursa')) this.superActive.blocked = (this.superActive.blocked || 0) + dmg; // Ursa Furiosa counts what the barrier stops
    this.guardHits++; this.body?.blockHit(); sfx.block();
  }
  /** Enemies that touch the barrier are blinded (they cannot attack for a few seconds). */
  barrierBlind() {
    const B = SENTINEL_BARRIER, fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    for (const e of G.enemies) {
      if (!e.alive || e.status.has('blind')) continue;
      const x = e.pos.x - this.pos.x, z = e.pos.z - this.pos.z, d = x * fx + z * fz, l = -x * fz + z * fx;
      if (d < -0.2 || d > B.z + e.radius + 0.3 || Math.abs(l) > B.w / 2 + e.radius) continue;
      e.status.apply('blind', { t: SENTINEL_GUARD.blind });
      if (e.remote) sendHit(e, 0, { source: 'super', element: 'void', blind: SENTINEL_GUARD.blind });
      sparks(e.headPos(new THREE.Vector3()), 0xe6d0ff, 6, 3, 0.06, 0.4);
    }
  }

  /** Chaos Reach ended early: keep some super energy for the time left. */
  endChaosReach() {
    const S = this.superActive;
    if (!S || S.ended) return;
    S.ended = true;
    this.superCharge = Math.min(100, Math.max(0, S.t / S.max) * SUPER_TUNE.chaos.refund);
    S.t = 0;
  }

  /** Movement owned by a super. Returns true when the normal jump handling should be skipped this frame. */
  updateSuperMove(dt, wx, wz, speed, jumpPressed) {
    const S = this.superActive;
    if (!S || this.dead) return false;
    if (S.slam) {
      // Well / Ward: dive straight down, then cast on landing (the super's timer waits)
      S.t = S.max;
      if (S.age < SUPER_HOVER.hopT) return true; // a short leap from the ground first
      if (!this.onGround && S.age < SUPER_HOVER.slamMax) { this.vel.set(0, -SUPER_HOVER.slamSpeed, 0); return true; }
      this.castSlamSuper(S);
      return true;
    }
    if (S.hoverY !== undefined) {
      // burst supers: rise to the hover height and hold there, drifting slowly
      this.vel.y = (S.hoverY - this.pos.y) * SUPER_HOVER.rise;
      this.vel.x = damp(this.vel.x, wx * speed * SUPER_HOVER.move, 6, dt);
      this.vel.z = damp(this.vel.z, wz * speed * SUPER_HOVER.move, 6, dt);
      this.onGround = false;
      return true;
    }
    if (S.type === 'thundercrash' && !S.crashed) {
      // up for a moment, then fly where you look
      if (S.age < 0.35) { this.vel.y = 15; return true; }
      S.dir.lerp(this.aimForward(_v), Math.min(1, dt * 4)).normalize();
      if (S.dir.y > 0.35) S.dir.y = 0.35;
      this.vel.copy(S.dir).setLength(SUPER_TUNE.thundercrash.speed);
      return true;
    }
    if (S.type === 'daybreak' && !this.onGround && this.vel.y < DAYBREAK_FALL) {
      // solar wings: once the jump peaks you hover, sinking much slower than a normal fall
      this.vel.y = DAYBREAK_FALL; // gravity already ran this frame, so the wings hold the sink speed
      this.vel.x = damp(this.vel.x, wx * speed * 1.2, 4, dt);
      this.vel.z = damp(this.vel.z, wz * speed * 1.2, 4, dt);
      if (Math.random() < 0.5) ember(this.pos.clone().setY(this.pos.y + 1.2), Math.random() < 0.5 ? 0xffb547 : 0xffffff, 0.05, 0.8, 0.5);
      return true;
    }
    if (S.type === 'daybreak' && jumpPressed && this.onGround) { this.vel.y = this.jumpV * DAYBREAK_JUMP; this.onGround = false; sfx.jump(); return true; }
    if (S.type === 'novawarp' && jumpPressed) {
      const md = this.moveDir;
      this.blink(md?.len > 0 ? md.x : 0, md?.len > 0 ? md.z : 0, SUPER_TUNE.novawarp.warp);
      this.warpSeekers();
      return true;
    }
    return false;
  }

  /** Nova Warp: each warp releases Void seekers that weaken the nearest enemies. */
  warpSeekers() {
    const W = SUPER_TUNE.novawarp, from = this.pos.clone().setY(this.pos.y + 1.2);
    const prey = enemiesNear(from, W.seekR, W.seekers);
    for (let i = 0; i < W.seekers; i++) {
      const target = prey.length ? prey[i % prey.length] : null;
      after(i * 0.06, () => this.seekerSwarm(from, target, ELEMENTS.void.hex, 0.09, (q) => explode(q, 1.8, superDmg(W.seekDmg), 'void', { source: 'super', small: true, debuffs: { weaken: W.weaken } })));
    }
  }

  /** Per-frame behavior of the Light Ascendant supers (the originals are in updateSuper). */
  updateAscendantSuper(S, dt, fwd, hand, flash) {
    const inp = G.input, T = SUPER_TUNE;
    const flat = fwd.clone().setY(0).normalize();
    if (S.type === 'maul') {
      // Burning Maul: swings, and a heavy slam that sends a solar tornado forward
      if (Math.random() < 0.5) ember(hand, Math.random() < 0.5 ? 0xff8b2b : 0xffd27a, 0.04, 0.4, 0.4);
      S.comboT -= dt;
      if (S.comboT <= 0) S.combo = 0;
      if (inp.mouse.right && S.cd <= 0) {
        S.cd = T.maul.slamCd;
        const p = this.pos.clone().addScaledVector(flat, 2).setY(0.6);
        explode(p, T.maul.slamR, superDmg(T.maul.slam), 'solar', { source: 'super' });
        castFx('slam', { p, el: 'solar', r: 6 });
        castFx('tornado', { p: p.clone().setY(0), d: flat.clone(), dmg: superDmg(T.maul.tornado) });
        this.throwFist(0.35, true); this.shake = 0.3; sfx.explosion(5);
      } else if (inp.mouse.leftPressed && S.cd <= 0) {
        S.cd = T.maul.swingCd; S.combo = (S.combo % 3) + 1; S.comboT = 1;
        const c = this.pos.clone().addScaledVector(flat, 2.2).setY(1);
        for (const e of enemiesNear(c, T.maul.swingR)) {
          dealDamage(e, superDmg(T.maul.swing), { element: 'solar', source: 'super', pos: e.center(new THREE.Vector3()), knock: flat.clone().multiplyScalar(8) });
          this.ignite(e, T.maul.burn, 2);
        }
        castFx('slam', { p: c, el: 'solar', r: 3.5 });
        this.throwFist(0.3, true); sfx.melee();
      }
    }
    if (S.type === 'thundercrash' && !S.crashed) {
      const hitEnemy = S.age > 0.35 && G.enemies.some((e) => e.alive && e.center(_v2).distanceTo(this.pos.clone().setY(this.pos.y + 0.9)) < e.radius + 1.4);
      const landed = S.age > 0.5 && (this.onGround || this.hitWall);
      if (hitEnemy || landed || (S.age > 0.5 && inp.mouse.leftPressed) || S.t <= 0.05) {
        // crash: the bigger the fall, the same blast (Destiny's Thundercrash is one big hit)
        S.crashed = true;
        const p = this.pos.clone().setY(this.pos.y + 0.5);
        explode(p, T.thundercrash.r, superDmg(T.thundercrash.dmg), 'arc', { source: 'super', debuffs: { jolt: 4 } });
        castFx('blast', { p, el: 'arc', r: T.thundercrash.r, big: true });
        castFx('slam', { p, el: 'arc', r: 8 });
        this.vel.set(0, 0, 0);
        this.shake = 0.8;
        S.t = Math.min(S.t, 0.3);
      } else if (Math.random() < 0.8) sparks(this.pos.clone().setY(this.pos.y + 1), ELEMENTS.arc.hex, 2, 4, 0.06, 0.3);
    }
    if (S.type === 'twilight' && inp.mouse.leftPressed && S.cd <= 0 && S.shots > 0) {
      // Twilight Arsenal: three void axes; each one stays where it lands for anyone to pick up
      S.cd = 0.45; S.shots--;
      this.throwAxe(fwd, superDmg(T.twilight.dmg), true);
      this.throwFist(0.3);
      if (S.shots <= 0) S.t = Math.min(S.t, 0.6);
    }
    if (S.type === 'bladebarrage' && !S.launched && S.age > 0.15) {
      // Blade Barrage: two volleys of seeking solar knives
      S.launched = true;
      const n = T.blades.n + (this.asp.has('knockemdown') ? T.blades.knock : 0);
      for (let v = 0; v < 2; v++) after(v * 0.25, () => {
        const f = this.aimForward(new THREE.Vector3());
        const right = new THREE.Vector3().crossVectors(f, UP).normalize();
        for (let i = 0; i < n; i++) {
          const spreadK = (i - (n - 1) / 2) / n;
          const dir = f.clone().addScaledVector(right, spreadK * 0.9).add(new THREE.Vector3(0, 0.1, 0)).normalize();
          spawnPlayerProjectile({
            kind: 'knife', pos: this.eye.clone().addScaledVector(dir, 0.8), vel: dir.multiplyScalar(42), gravity: 2, size: 0.1, color: ELEMENTS.solar.hex, life: 3, tracking: true,
            onHit: (p) => { explode(p, T.blades.r, superDmg(T.blades.dmg), 'solar', { source: 'super', debuffs: { burn: 2 } }); },
          });
        }
        this.throwFist(0.25); sfx.throw();
      });
    }
    if (S.type === 'spectral') {
      // Spectral Blades: void slashes; the third hit weakens; right-click leaps and slams
      S.comboT -= dt;
      if (S.comboT <= 0) S.combo = 0;
      if (Math.random() < 0.4) ember(this.pos.clone().setY(this.pos.y + 1), 0x2a1840, 0.08, 0.6, 0.5);
      if (inp.mouse.right && S.cd <= 0) {
        S.cd = T.spectral.leapCd;
        this.dashDir.copy(flat); this.dash = 0.22; this.dashSpeed = 24;
        after(0.22, () => {
          if (!this.superActive) return;
          const p = this.pos.clone().setY(0.6);
          explode(p, T.spectral.leapR, superDmg(T.spectral.leap), 'void', { source: 'super', debuffs: { weaken: 4 } });
          castFx('slam', { p, el: 'void', r: 5 });
        });
      } else if ((inp.mouse.leftPressed || inp.mouse.left) && S.cd <= 0) {
        S.cd = 0.3; S.combo = (S.combo % 3) + 1; S.comboT = 0.9;
        const fin = S.combo === 3;
        const c = this.pos.clone().addScaledVector(flat, 2).setY(1);
        for (const e of enemiesNear(c, fin ? 3.6 : 3)) dealDamage(e, superDmg(fin ? T.spectral.fin : T.spectral.hit), { element: 'void', source: 'super', pos: e.center(new THREE.Vector3()), weaken: fin ? 4 : 0 });
        castFx('chain', { pts: [hand.clone(), c.clone().add(new THREE.Vector3(-flat.z * 1.4, 0.3, flat.x * 1.4)), c.clone().add(new THREE.Vector3(flat.z * 1.4, -0.3, -flat.x * 1.4))], el: 'void', w: 0.07 });
        this.throwFist(0.22, true); sfx.melee();
      }
    }
    if (S.type === 'gathering' && !S.launched && S.age > 0.25) {
      // Gathering Storm: throw the staff; lightning strikes it a second later
      S.launched = true;
      spawnPlayerProjectile({
        kind: 'seeker', pos: this.eye.clone().addScaledVector(fwd, 0.8), vel: fwd.clone().multiplyScalar(38), gravity: 9, size: 0.14, color: ELEMENTS.arc.hex, life: 3,
        onHit: (p) => castFx('gatherstorm', { p: p.clone().setY(restHeight(p.x, p.z, p.y, G.colliders.filter((c) => !c.pass))), dmg: superDmg(T.gathering.dmg), tick: superDmg(T.gathering.tick) }),
      });
      this.throwFist(0.35); sfx.throw();
    }
    if (S.type === 'stormsedge' && inp.mouse.leftPressed && S.cd <= 0 && S.shots > 0) {
      // Storm's Edge: throw the dagger, teleport to it, slash around you
      S.cd = 0.75; S.shots--;
      const from = this.pos.clone();
      _ray.set(this.eye, fwd); _ray.far = T.stormsedge.range;
      const hit = _ray.intersectObjects(getHitTargets(), false).find((h) => h.distance > 0.5); // the dagger lands on whatever is under the crosshair
      const dist = hit ? Math.max(0, hit.distance - 1) : T.stormsedge.range;
      const steps = 16, step = flat.clone().multiplyScalar(dist / steps);
      for (let i = 0; i < steps; i++) moveBody(this.pos, _v2.copy(step).multiplyScalar(20), 0.05, this.radius, this.height);
      castFx('blink', { a: from.setY(from.y + 1), b: this.pos.clone().setY(this.pos.y + 1), el: 'arc' });
      const p = this.pos.clone().setY(this.pos.y + 0.8);
      explode(p, T.stormsedge.r, superDmg(T.stormsedge.dmg), 'arc', { source: 'super', debuffs: { jolt: 4 } });
      castFx('slam', { p, el: 'arc', r: T.stormsedge.r });
      this.throwFist(0.3, true); this.fovKick = Math.max(this.fovKick, 10);
      if (S.shots <= 0) S.t = Math.min(S.t, 0.5);
    }
    if (S.type === 'novawarp') {
      // Nova Warp: hold fire to charge, release to detonate around you
      if (Math.random() < 0.5) swirl(this.pos.clone().setY(this.pos.y + 1), 1.4, ELEMENTS.void.hex, 0.5, true, 0.05, 1);
      if (inp.mouse.left && S.cd <= 0) { S.charge = Math.min(1, S.charge + dt / T.novawarp.chargeT); if (Math.random() < 0.6) voidMote(this.pos.clone().setY(this.pos.y + 1.1), 1 + S.charge * 1.5, 0.3, 0.08); }
      else if (S.charge > 0 || (inp.mouse.leftPressed && S.cd <= 0)) {
        const k = S.charge, r = T.novawarp.r0 + (T.novawarp.r1 - T.novawarp.r0) * k;
        S.charge = 0; S.cd = 0.35;
        const p = this.pos.clone().setY(this.pos.y + 0.8);
        explode(p, r, superDmg(T.novawarp.dmg0 + (T.novawarp.dmg1 - T.novawarp.dmg0) * k), 'void', { source: 'super', debuffs: { weaken: 3 } });
        castFx('blast', { p, el: 'void', r, big: k > 0.9 });
        this.shake = 0.2 + 0.3 * k;
      }
    }
    if (S.type === 'chaosreach') {
      // Chaos Reach: a piercing arc beam from the moment it's cast until it runs out or F is pressed again
      if (!S.ended) {
        S.tick = (S.tick ?? 0) - dt;
        if (S.tick <= 0) {
          S.tick = 0.1;
          _ray.set(this.eye, fwd); _ray.far = T.chaos.range;
          let end = this.eye.clone().addScaledVector(fwd, T.chaos.range);
          const seen = new Set();
          for (const h of _ray.intersectObjects(getHitTargets(), false)) {
            const e = h.object.userData.enemy;
            if (!e) { end = h.point; break; }
            if (!e.alive || seen.has(e)) continue;
            seen.add(e);
            dealDamage(e, superDmg(T.chaos.dmg), { element: 'arc', source: 'super', pos: h.point.clone(), jolt: 2 });
          }
          castFx('chain', { pts: [hand.clone(), end], el: 'arc', beam: true, w: 0.22 });
          sfx.zap();
        }
      }
    }
    if (S.type === 'daybreak' && inp.mouse.leftPressed && S.cd <= 0) {
      // Daybreak: solar blades that explode and scorch
      S.cd = 0.45;
      spawnPlayerProjectile({
        kind: 'knife', pos: this.eye.clone().addScaledVector(fwd, 0.9), vel: fwd.clone().multiplyScalar(55), gravity: 0, size: 0.16, color: ELEMENTS.solar.hex, life: 3,
        onHit: (p) => {
          explode(p, T.daybreak.r, superDmg(T.daybreak.dmg), 'solar', { source: 'super', debuffs: { burn: 2 } });
          for (const e of enemiesNear(p, T.daybreak.r)) this.ignite(e, T.daybreak.burn, 2);
        },
      });
      this.throwFist(0.25); sfx.throw();
    }
  }

  /** A Twilight Arsenal axe: thrown by the caster during the super, or by anyone who picked one up. */
  throwAxe(fwd, dmg, leave) {
    const T = SUPER_TUNE.twilight;
    spawnPlayerProjectile({
      kind: 'axe', pos: this.eye.clone().addScaledVector(fwd, 0.8), vel: fwd.clone().multiplyScalar(34).add(new THREE.Vector3(0, 2, 0)), gravity: 8, size: 0.25, color: ELEMENTS.void.hex, life: 4,
      onHit: (p) => {
        explode(p, T.r, dmg, 'void', { source: 'super', debuffs: { weaken: 6 } });
        castFx('blast', { p, el: 'void', r: T.r });
        if (leave) castFx('voidaxe', { p: p.clone().setY(restHeight(p.x, p.z, p.y, G.colliders.filter((c) => !c.pass))), id: `${net.myId || 'solo'}-${++this.orbN}` });
      },
    });
    sfx.throw();
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

