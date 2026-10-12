import * as THREE from 'three';
import { G } from './state.js';
import { ENEMY_TYPES, ELEMENTS } from './data.js';
import { mat } from './world.js';
import { rand, clamp } from './util.js';
import { hasLOS, pushOutCircle, pointInColliders } from './physics.js';
import { sparks, ringFx, basicMat, explosionFx, flashLight } from './effects.js';
import { sfx } from './audio.js';
import { damagePlayer, spawnBossAdds } from './game.js';
import * as ui from './ui.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const shotGeo = new THREE.IcosahedronGeometry(1, 0);
const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

function buildModel(e, C, faction) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: C.enemy, flatShading: true, roughness: 0.7, metalness: 0.15 });
  const dark = mat(C.enemy2);
  const accent = mat(C.eye, { emissive: C.eye, emissiveIntensity: 2.2 });
  const hit = [];
  const part = (geo, m, x, y, z, parent = g, crit = false) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.userData.enemy = e;
    mesh.userData.crit = crit;
    parent.add(mesh);
    hit.push(mesh);
    return mesh;
  };
  const t = e.typeId;
  const W = faction === 'legion' ? 1.3 : faction === 'hollow' ? 0.8 : 1.0;
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.16 * W, 0.92, 0);
    g.add(leg);
    part(new THREE.BoxGeometry(0.17 * W, 0.92, 0.2), dark, 0, -0.46, 0, leg);
    legs.push(leg);
  }
  const torso = new THREE.Group();
  torso.position.y = 0.92;
  g.add(torso);
  part(new THREE.CylinderGeometry(0.3 * W, 0.2 * W, 0.78, 6), bodyMat, 0, 0.39, 0, torso);
  let headGeo;
  if (faction === 'hollow') headGeo = new THREE.ConeGeometry(0.2, 0.44, 5);
  else if (faction === 'legion') headGeo = new THREE.BoxGeometry(0.36, 0.3, 0.36);
  else headGeo = new THREE.IcosahedronGeometry(0.21, 0);
  part(headGeo, faction === 'hollow' ? bodyMat : dark, 0, 0.98, 0, torso, true);
  part(new THREE.BoxGeometry(0.26, 0.06, 0.06), accent, 0, 0.99, faction === 'legion' ? 0.18 : 0.16, torso, true);
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.38 * W, 0.68, 0);
    torso.add(arm);
    part(new THREE.BoxGeometry(0.12 * W, 0.62, 0.12 * W), bodyMat, 0, -0.28, 0, arm);
    arm.rotation.x = t === 'rusher' ? -1.3 : -1.1;
    arms.push(arm);
  }
  if (faction === 'scrappers') {
    for (const s of [-1, 1]) {
      const a2 = new THREE.Group(); a2.position.set(s * 0.3, 0.38, 0.05); a2.rotation.x = -0.6; a2.rotation.z = s * 0.4; torso.add(a2);
      part(new THREE.BoxGeometry(0.08, 0.45, 0.08), dark, 0, -0.2, 0, a2);
    }
    part(new THREE.ConeGeometry(0.42, 1.0, 5, 1, true), dark, 0, 0.25, -0.1, torso);
  } else if (faction === 'hollow') {
    for (const s of [-1, 1]) {
      const sp = part(new THREE.ConeGeometry(0.07, 0.4, 4), dark, s * 0.3, 0.8, 0, torso);
      sp.rotation.z = -s * 0.5;
    }
  } else if (faction === 'legion') {
    for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.3, 0.16, 0.36), bodyMat, s * 0.42, 0.78, 0, torso);
    part(new THREE.BoxGeometry(0.46, 0.5, 0.22), dark, 0, 0.45, -0.3, torso);
    part(new THREE.BoxGeometry(0.3, 0.05, 0.04), accent, 0, 0.55, -0.42, torso);
  }
  const muzzle = new THREE.Object3D();
  if (t !== 'rusher') {
    const gun = new THREE.Group();
    gun.position.set(0.24 * W, 0.42, 0.32);
    torso.add(gun);
    const big = t === 'heavy' || t === 'boss';
    part(new THREE.BoxGeometry(big ? 0.22 : 0.09, big ? 0.22 : 0.12, big ? 0.9 : 0.6), dark, 0, 0, 0, gun);
    part(new THREE.BoxGeometry(0.05, 0.05, 0.2), accent, 0, big ? 0.13 : 0.08, 0.1, gun);
    muzzle.position.set(0, 0, big ? 0.5 : 0.33);
    gun.add(muzzle);
  } else {
    muzzle.position.set(0, 0.6, 0.3);
    torso.add(muzzle);
    torso.rotation.x = 0.35;
  }
  if (t === 'captain' || t === 'boss') {
    part(new THREE.ConeGeometry(0.12, 0.42, 4), accent, 0, 1.32, 0, torso);
    part(new THREE.BoxGeometry(0.55 * W, 0.95, 0.04), mat(C.eye), 0, 0.2, -0.24, torso);
  }
  if (t === 'boss') {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const c = part(new THREE.ConeGeometry(0.05, 0.3, 4), accent, Math.sin(a) * 0.2, 1.2, Math.cos(a) * 0.2, torso);
      c.rotation.set(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4);
    }
  }
  let shield = null;
  if (e.maxShield > 0) {
    shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: ELEMENTS[e.shieldEl].hex, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
    shield.scale.set(0.78, 1.15, 0.78);
    shield.position.y = 1.05;
    g.add(shield);
  }
  g.scale.setScalar(0.01);
  return { group: g, hit, legs, arms, torso, bodyMat, muzzle, shield };
}

export class Enemy {
  constructor(typeId, pos, o) {
    const def = ENEMY_TYPES[typeId];
    if (!def) throw new Error(`Unknown enemy type ${typeId}`);
    const M = G.mission;
    this.typeId = typeId;
    this.def = def;
    this.isBoss = typeId === 'boss';
    this.name = o.name || M.loc.enemyNames[typeId];
    this.pos = pos.clone(); this.pos.y = 0;
    this.radius = 0.45 * def.scale;
    this.height = 2.05 * def.scale;
    this.maxHp = def.hp * o.hpMult; this.hp = this.maxHp;
    this.maxShield = def.shield ? def.shield * o.hpMult : 0; this.shield = this.maxShield;
    this.shieldEl = o.element || 'arc';
    this.dmgMult = o.dmgMult;
    this.zone = o.zone;
    this.alive = true; this.dieT = 0; this.spawnT = 0;
    this.fireT = rand(0.8, 2.0);
    this.burstLeft = 0; this.burstT = 0;
    this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = rand(1, 3);
    this.losT = Math.random() * 0.3; this.los = false;
    this.meleeT = 0.5; this.flash = 0; this.walk = Math.random() * 6; this.yaw = 0;
    this.knock = new THREE.Vector3();
    this.seed = Math.random() * 100;
    this.specialT = rand(4, 6);
    this.thresholds = this.isBoss ? [0.66, 0.33] : [];
    const faction = { earth: 'scrappers', moon: 'hollow', mars: 'legion' }[M.loc.id];
    this.model = buildModel(this, M.loc.colors, faction);
    this.hitMeshes = this.model.hit;
    this.model.group.position.copy(this.pos);
    G.scene.add(this.model.group);
    ringFx(this.pos, 2 * def.scale, M.loc.colors.eye, 0.6);
    sparks(_v.copy(this.pos).setY(1), M.loc.colors.eye, 8, 5, 0.1, 0.5);
  }

  center(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z); }
  headPos(out) { return out.set(this.pos.x, this.pos.y + this.height * 0.95, this.pos.z); }

  breakShield(matched) {
    if (this.model.shield) this.model.shield.visible = false;
    sfx.shieldBreak();
    const c = this.center(_v);
    sparks(c, ELEMENTS[this.shieldEl].hex, 16, 7, 0.1, 0.5);
    if (matched) ui.feed(`${ELEMENTS[this.shieldEl].name} shield broken`, ELEMENTS[this.shieldEl].color);
  }

  onDeath() {
    this.fallDir = Math.random() < 0.5 ? 1 : -1;
    if (this.model.shield) this.model.shield.visible = false;
    sparks(this.center(_v), G.mission.loc.colors.eye, this.isBoss ? 40 : 10, this.isBoss ? 10 : 5, 0.1, 0.6);
  }

  remove() { G.scene.remove(this.model.group); this.model.bodyMat.dispose(); }

  update(dt) {
    const m = this.model;
    if (!this.alive) {
      this.dieT += dt;
      const k = Math.min(1, this.dieT * 2.2);
      m.group.rotation.x = -k * 1.4 * this.fallDir;
      m.group.position.y = -Math.max(0, this.dieT - 0.9) * 1.5;
      m.bodyMat.emissive.setRGB(0, 0, 0);
      if (this.dieT > 1.8) { this.remove(); return false; }
      return true;
    }
    if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt * 2.2);
      m.group.scale.setScalar(this.def.scale * Math.max(0.05, easeOutBack(this.spawnT)));
      m.group.position.copy(this.pos);
      return true;
    }
    const P = G.player;
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    const def = this.def;

    this.flash = Math.max(0, this.flash - dt);
    const f = Math.min(1, this.flash * 8);
    m.bodyMat.emissive.setRGB(f, f, f);
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
    let mx = 0, mz = 0;
    if (!P.dead) {
      if (def.melee) {
        if (dist > 1.5) {
          const zig = Math.sin(G.time * 3 + this.seed) * (dist > 6 ? 0.6 : 0);
          mx = nx - nz * zig; mz = nz + nx * zig;
        }
      } else {
        if (dist > def.prefer + 5 || (!this.los && dist > 6)) { mx = nx; mz = nz; }
        else if (dist < def.prefer - 6) { mx = -nx; mz = -nz; }
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = rand(1.2, 3); }
        mx += -nz * this.strafe * 0.7; mz += nx * this.strafe * 0.7;
      }
    }
    const ml = Math.hypot(mx, mz);
    const speed = def.speed * (this.burstLeft > 0 && !this.isBoss ? 0.4 : 1);
    if (ml > 0) { mx /= ml; mz /= ml; }
    this.pos.x += (mx * speed + this.knock.x) * dt;
    this.pos.z += (mz * speed + this.knock.z) * dt;
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
    pushOutCircle(this.pos, this.radius, this.height);
    const b = G.level.bounds;
    this.pos.x = clamp(this.pos.x, b.minX + 1, b.maxX - 1);
    this.pos.z = clamp(this.pos.z, b.minZ + 1, b.maxZ - 1);

    const targetYaw = Math.atan2(dx, dz);
    let dy = targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 8);

    this.walk += dt * speed * (ml > 0 ? 2.2 : 0);
    const sw = Math.sin(this.walk) * (ml > 0 ? 0.6 : 0);
    m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw;

    // ---- attacks ----
    if (!P.dead) {
      if (def.melee) {
        this.meleeT -= dt;
        const vdy = Math.abs(P.pos.y - this.pos.y);
        if (dist < 1.9 && vdy < 1.6 && this.meleeT <= 0) {
          this.meleeT = 1.1;
          damagePlayer(def.meleeDmg * this.dmgMult, this.pos);
          m.arms.forEach((a) => (a.rotation.x = -2.2));
          sfx.melee();
        }
        m.arms.forEach((a) => (a.rotation.x += (-1.3 - a.rotation.x) * Math.min(1, dt * 6)));
      } else {
        this.fireT -= dt;
        if (this.fireT <= 0 && this.los && dist < def.range) {
          this.burstLeft = def.burst; this.burstT = 0;
          this.fireT = rand(def.fireCd[0], def.fireCd[1]) + def.burst * def.burstGap;
        }
        if (this.burstLeft > 0) {
          this.burstT -= dt;
          if (this.burstT <= 0) { this.shoot(dist); this.burstLeft--; this.burstT = def.burstGap; }
        }
      }
      if (this.isBoss) this.bossUpdate(dt, dist);
    }

    m.group.position.copy(this.pos);
    m.group.rotation.y = this.yaw;
    return true;
  }

  shoot(dist, spreadMul = 1, dirOverride = null) {
    const P = G.player, def = this.def;
    this.model.group.updateMatrixWorld(true);
    const from = this.model.muzzle.getWorldPosition(new THREE.Vector3());
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
    fireEnemyShot(from, dir, def.projSpeed, def.dmg * this.dmgMult, G.mission.loc.colors.eye, def.shotSize, def.splash);
    flashLight(from, G.mission.loc.colors.eye, 6, 6, 0.06);
    sfx.enemyShot();
  }

  bossUpdate(dt, dist) {
    if (this.thresholds.length && this.hp / this.maxHp < this.thresholds[0]) {
      this.thresholds.shift();
      this.shield = this.maxShield * 0.6;
      if (this.model.shield) this.model.shield.visible = true;
      spawnBossAdds(this);
    }
    this.specialT -= dt;
    if (this.specialT > 0) return;
    this.specialT = rand(5, 8);
    if (dist < 10) {
      // ground slam
      ringFx(this.pos, 10, G.mission.loc.colors.eye, 0.6);
      explosionFx(_v.copy(this.pos).setY(0.5), 3, G.mission.loc.colors.eye);
      sfx.explosion(8);
      if (dist < 9 && G.player.pos.y < 1.5) {
        damagePlayer(32 * this.dmgMult, this.pos);
        const P = G.player;
        P.vel.x += (P.pos.x - this.pos.x) / dist * 12;
        P.vel.z += (P.pos.z - this.pos.z) / dist * 12;
        P.vel.y = 6;
      }
    } else if (this.los) {
      // fan volley
      const P = G.player;
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
// Enemy projectiles
// ---------------------------------------------------------------------------
export function fireEnemyShot(from, dir, speed, dmg, color, size, splash) {
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
      if (s.pos.y < 0.02) hit = 'ground';
      else if (pointInColliders(s.pos)) hit = 'wall';
      else if (!P.dead && distToPlayer(s.pos) < 0.5) hit = 'player';
    }
    if (hit) {
      if (hit === 'player') damagePlayer(s.dmg, s.origin);
      else if (s.splash && !P.dead) {
        const d = distToPlayer(s.pos);
        if (d < s.splash) damagePlayer(s.dmg * 0.6 * (1 - d / s.splash), s.pos);
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
