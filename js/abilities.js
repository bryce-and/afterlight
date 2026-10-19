import * as THREE from 'three';
import { G } from './state.js';
import { ELEMENTS } from './data.js';
import { glowBurst, shockwave, pillar, flare, swirl, homingMote, afterimage, ringFx, lightning, beam, explosionFx, ember, voidBurst, voidRing, voidMote, VOID_FX } from './effects.js';
import { dealDamage, enemiesNear, addTicker, explode } from './game.js';
import { sendFx, remotes } from './coop.js';
import { net } from './net.js';
import { STORM_GRENADE, ARC_SOUL, NOVA_FIELD, SUPER_TUNE, CLASS_FX_LIFE, riftElement } from './combat.js';
import { ORB } from './armor.js';
import { SUNSPOT, HEAL_ORB, ASPECT_TUNE } from './subclass.js';
import { sfx } from './audio.js';
import { buildVoidAxe } from './models.js';
import * as ui from './ui.js';

// Every ability effect lives here once. The caster runs it with local = true
// (visuals + damage); fireteam members replay the same effect from a network
// message with local = false (visuals, plus anything that affects THEIR
// player or the world: barricade walls, rift healing/empowering).

const V = (a) => (a instanceof THREE.Vector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));
const arr = (v) => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];
const hex = (el) => ELEMENTS[el]?.hex ?? 0xffffff;
const orbs = new Map(); // live Orbs of Power (and Twilight Arsenal axes) by id, so a claim on one screen removes them everywhere

/** Run an ability effect locally and tell the fireteam about it. */
/** Hellion (U9): a burning bolt lobbed in an arc that bursts where it lands. Only the caster's screen deals the damage. */
function lobBolt(from, to, local, target) {
  const A = ASPECT_TUNE.hellion, col = hex('solar');
  const bolt = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  bolt.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })));
  const a = from.clone(), b = to.clone(), T = A.flight;
  bolt.position.copy(a);
  G.scene.add(bolt);
  let t = 0;
  addTicker({
    update(dt) {
      t += dt;
      const k = Math.min(1, t / T);
      bolt.position.lerpVectors(a, b, k).setY(a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * A.arc);
      if (Math.random() < 0.7) ember(bolt.position.clone(), Math.random() < 0.5 ? col : 0xffd27a, 0.06, 0.35, 0.3);
      if (k >= 1) {
        if (local) {
          // a direct hit on the target it was aimed at, then a small burning splash around it
          if (target?.alive && target.center(new THREE.Vector3()).distanceTo(b) < target.radius + 1.2) dealDamage(target, A.dmg, { element: 'solar', source: 'ability', pos: b.clone(), burn: A.burn, companion: true });
          explode(b, A.r, A.splash, 'solar', { source: 'ability', small: true, companion: true, debuffs: { burn: A.burn } });
        }
        return false;
      }
      return true;
    },
    dispose() { G.scene?.remove(bolt); },
  });
}

export function castFx(kind, o) {
  const wire = {};
  for (const [k, v] of Object.entries(o)) wire[k] = v instanceof THREE.Vector3 ? arr(v) : Array.isArray(v) && v[0] instanceof THREE.Vector3 ? v.map(arr) : v;
  sendFx({ t: 'fx', k: 'ab', kind, o: { ...wire, by: net.myId } }); // by: the caster, for effects that follow them
  return abilityFx(kind, o, true);
}

/** Replay from the network. */
export function replayFx(kind, o) { abilityFx(kind, o, false); }

function zoneMesh(pt, r, color, sphere = false) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const core = sphere ? new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.35, 1), m) : new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 24, 1, true), m);
  core.position.y = sphere ? 1 : 0.15;
  g.add(core);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.94, r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ring.position.y = 0.06;
  g.add(ring);
  g.position.set(pt.x, 0, pt.z);
  G.scene.add(g);
  return g;
}

function inXZ(e, p, r) { return Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < r + e.radius; }

export function abilityFx(kind, o, local) {
  if (!G.scene) return;
  switch (kind) {
    // ---------------- grenades ----------------
    case 'pulse': { // Solar Grenade / Pulse Grenade
      const p = V(o.p), col = hex(o.el), ground = p.clone().setY(0.05);
      explosionFx(p, 3.5, col);
      shockwave(ground, 4.5, col, 0.6);
      pillar(ground, 1.4, 7, col, 3.2, 0.25);
      const zone = zoneMesh(p, 4.5, col, true);
      let n = o.n || 6, t = 0.5;
      // Touch of Flame scorches, Spark of Shock jolts (upgrades are decided by the caster)
      const hitO = { element: o.el, source: 'ability', jolt: o.jolt || 0 };
      const scorch = (e) => { if (o.scorch && G.player?.ignite) G.player.ignite(e, 24, 2); };
      addTicker({
        update(dt) {
          t -= dt; zone.rotation.y += dt * 2;
          zone.children[0].scale.setScalar(1 + Math.sin(G.time * 14) * 0.12);
          if (Math.random() < 0.6) glowBurst(p, Math.random() < 0.5 ? col : 0xffffff, 1, 3, 0.1, 0.6, 4, 0.6);
          if (t <= 0) {
            t = 0.5; n--;
            shockwave(ground, 4.5, col, 0.45);
            glowBurst(p, col, 10, 5, 0.1, 0.5, 3, 0.6);
            sfx.explosion(2);
            if (local) for (const e of enemiesNear(p, 4.5)) { dealDamage(e, 45, hitO); scorch(e); }
          }
          return n > 0;
        },
        dispose() { G.scene?.remove(zone); },
      });
      if (local) for (const e of enemiesNear(p, 3.5)) { dealDamage(e, 60, hitO); scorch(e); }
      break;
    }
    case 'burst': { // Swarm Grenade / Axion Bolt detonation (seekers are synced as projectiles)
      const p = V(o.p), col = hex(o.el);
      explosionFx(p, 3, col);
      shockwave(p.clone().setY(0.05), 3.5, col, 0.5);
      glowBurst(p, 0xffffff, 16, 8, 0.1, 0.6, 1, 0.5);
      if (local) for (const e of enemiesNear(p, 3.5)) dealDamage(e, 80, { element: o.el, source: 'ability' });
      break;
    }
    case 'vortex': {
      const p = V(o.p), col = hex('void');
      const R = o.big ? 7.5 : 5.5; // Chaos Accelerant
      const zone = zoneMesh(p, R, col, true);
      voidRing(p.clone().setY(0.05), R, 0.7);
      flare(p, VOID_FX.hi, 2.5, 0.3);
      let life = (o.big ? 5.5 : 4) * (o.linger || 1), tick = 0; // Echo of Remnants: linger
      addTicker({
        update(dt) {
          life -= dt; tick -= dt;
          zone.rotation.y += dt * 4;
          zone.children[0].scale.setScalar(1 + Math.sin(G.time * 10) * 0.12);
          for (let i = 0; i < 4; i++) swirl(p, R, i % 2 ? col : VOID_FX.hi, 0.7, true, 0.09, 2.4);
          if (Math.random() < 0.5) voidMote(p.clone().setY(p.y + 0.8), R * 0.9, 0.6);
          if (local) {
            const c = new THREE.Vector3();
            for (const e of enemiesNear(p, R + 1)) if (!e.isBoss && !e.remote) { const d = c.copy(p).sub(e.pos).setY(0); if (d.length() > 0.5) e.knock.addScaledVector(d.normalize(), dt * 14); }
            if (tick <= 0) { tick = 0.25; for (const e of enemiesNear(p, R)) dealDamage(e, 22, { element: 'void', source: 'ability', slow: 0.3, weaken: o.weaken || 0 }); }
          }
          return life > 0;
        },
        dispose() { G.scene?.remove(zone); explosionFx(p, 4, col); if (local) for (const e of enemiesNear(p, 4)) dealDamage(e, 80, { element: 'void', source: 'ability', weaken: o.weaken || 0 }); },
      });
      sfx.ability();
      break;
    }
    case 'storm': { // Storm Grenade: a cloud that rains lightning
      const p = V(o.p), col = hex('arc');
      const cloud = new THREE.Group();
      const cm = new THREE.MeshBasicMaterial({ color: 0x3a4a6a, transparent: true, opacity: 0.55, depthWrite: false });
      for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + Math.random() * 0.8, 0), cm); b.position.set((Math.random() - 0.5) * 4, Math.random() * 0.8, (Math.random() - 0.5) * 4); cloud.add(b); }
      cloud.position.set(p.x, 6, p.z);
      G.scene.add(cloud);
      let life = o.life || 3, tick = 0;
      addTicker({
        update(dt) {
          life -= dt; tick -= dt; cloud.rotation.y += dt;
          if (tick <= 0) {
            // every enemy under the cloud is struck each tick
            tick = STORM_GRENADE.tick;
            const targets = enemiesNear(new THREE.Vector3(p.x, 1, p.z), STORM_GRENADE.r);
            const bolt = (to) => lightning(new THREE.Vector3(p.x + (Math.random() - 0.5) * 3, 6, p.z + (Math.random() - 0.5) * 3), to, col, 0.07);
            if (!targets.length) bolt(new THREE.Vector3(p.x + (Math.random() - 0.5) * 8, 0.1, p.z + (Math.random() - 0.5) * 8));
            for (const tgt of targets) {
              const to = tgt.center(new THREE.Vector3());
              bolt(to);
              if (local) dealDamage(tgt, STORM_GRENADE.dmg, { element: 'arc', source: 'ability', pos: to, jolt: o.jolt || 0 });
            }
            sfx.zap();
          }
          return life > 0;
        },
        dispose() { G.scene?.remove(cloud); cm.dispose(); },
      });
      break;
    }
    case 'snare': { // Snare Bomb: a cloud of void smoke that slows and weakens
      const p = V(o.p), col = hex('void');
      let delay = 0.5, life = 4.5 * (o.linger || 1), tick = 0; // Echo of Remnants: linger
      flare(p, col, 1, 0.2);
      addTicker({
        update(dt) {
          if (delay > 0) { delay -= dt; if (delay <= 0) { shockwave(p.clone().setY(0.05), 5, col, 0.5); glowBurst(p, 0x2a1840, 30, 5, 0.3, 1.4, 0.5, 0.3); sfx.explosion(3); } return true; }
          life -= dt; tick -= dt;
          if (Math.random() < 0.7) glowBurst(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6)), Math.random() < 0.5 ? col : 0x2a1840, 1, 0.6, 0.35, 1.2, 0.4, 0.4);
          if (local && tick <= 0) { tick = 0.5; for (const e of enemiesNear(p, 5)) dealDamage(e, 18, { element: 'void', source: 'ability', weaken: 1.2, slow: 1.2 }); }
          return life > 0;
        },
      });
      break;
    }

    // ---------------- melee impacts ----------------
    case 'slam': { // Hammer Strike, Shoulder Charge, Fists of Havoc
      const p = V(o.p), col = hex(o.el), r = o.r || 5;
      shockwave(p.clone().setY(0.05), r, col, 0.6);
      glowBurst(p, 0xffffff, 18, 9, 0.12, 0.6, 2, 0.8);
      glowBurst(p, col, 14, 7, 0.12, 0.7, 2, 0.8);
      pillar(p.clone().setY(0), r * 0.25, 5, col, 0.45, 0.4);
      if (o.el === 'arc') for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28; lightning(p, p.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)).setY(0.1), col, 0.05); }
      if (!local && Math.hypot(G.player.pos.x - p.x, G.player.pos.z - p.z) < r * 2) G.player.shake = Math.max(G.player.shake, 0.15);
      break;
    }
    case 'chain': { // Chain Lightning / Golden Gun / Stormtrance beams: a list of points
      const pts = o.pts.map(V), col = hex(o.el);
      for (let i = 1; i < pts.length; i++) {
        if (o.beam) beam(pts[i - 1], pts[i], col, o.w || 0.1, 0.35);
        else lightning(pts[i - 1], pts[i], col, o.w || 0.05);
        flare(pts[i], col, i === 1 ? 1.4 : 0.9, 0.2);
      }
      break;
    }
    case 'drain': { // Energy Drain
      const a = V(o.a), b = V(o.b), col = hex('void');
      beam(a, b, col, 0.07, 0.3);
      lightning(a, b, 0xe6d0ff, 0.03);
      flare(b, col, 1.2, 0.25);
      const to = local ? () => G.player.eye.clone().add(new THREE.Vector3(0, -0.3, 0)) : () => a;
      for (let i = 0; i < 14; i++) homingMote(b, to, i % 2 ? col : 0xe6d0ff, 0.9, 0.08);
      break;
    }

    // ---------------- class abilities ----------------
    case 'barricade': {
      const p = V(o.p), col = hex(o.el || 'solar'), alongX = o.alongX; // the caster's subclass color
      const len = o.small ? 4 : 5, h = o.small ? 1.3 : 2.2; // Rally Barricade is low
      const w = alongX ? len : 0.6, d = alongX ? 0.6 : len;
      const geo = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.7, transparent: true, opacity: 0.5, flatShading: true }));
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending })));
      mesh.position.set(p.x, 0, p.z);
      mesh.scale.y = 0.01;
      G.scene.add(mesh);
      // a wall on every screen for enemies and their shots; Guardians (and their shots) pass through
      const box = { min: new THREE.Vector3(p.x - w / 2, 0, p.z - d / 2), max: new THREE.Vector3(p.x + w / 2, h, p.z + d / 2), pass: true };
      G.colliders.push(box);
      shockwave(p.clone().setY(0.05), 4, col, 0.5);
      for (let i = 0; i < 16; i++) glowBurst(p.clone().add(new THREE.Vector3(alongX ? (Math.random() - 0.5) * w : 0, 0.1, alongX ? 0 : (Math.random() - 0.5) * d)), i % 2 ? col : 0xffffff, 1, 3, 0.1, 0.7, 4, 1);
      let life = o.small ? CLASS_FX_LIFE.rally : CLASS_FX_LIFE.barricade, age = 0;
      const scene = G.scene;
      addTicker({
        update(dt) {
          life -= dt; age += dt;
          mesh.scale.y = Math.min(1, age / 0.25) * (life < 1 ? life : 1);
          mesh.material.opacity = 0.35 + 0.15 * Math.sin(G.time * 4);
          return life > 0;
        },
        dispose() { scene.remove(mesh); mesh.material.dispose(); geo.dispose(); const i = G.colliders.indexOf(box); if (i >= 0) G.colliders.splice(i, 1); },
      });
      break;
    }
    case 'dodge': case 'vanish': {
      const p = V(o.p), col = hex(o.el);
      afterimage(p, col, 0.6);
      shockwave(p.clone().setY(0.05), 2, col, 0.35);
      if (kind === 'vanish') glowBurst(p.clone().setY(1), 0x2a1840, 26, 3, 0.35, 1.2, 0.3, 0.2);
      break;
    }
    case 'rift': { // Healing Rift / Empowering Rift: affects whoever stands inside, on their own screen
      const p = V(o.p), empower = o.kind === 'empower';
      // U9: the rift takes the caster's subclass color (Solar, Arc or Void); its particles are white
      const col = hex(riftElement(o.el, o.kind)), glow = 0xffffff;
      const zone = zoneMesh(p, 4.5, col);
      shockwave(p.clone().setY(0.05), 5, col, 0.7);
      pillar(p, 4.3, 0.6, col, 10, 0.12);
      pillar(p, 0.5, 9, glow, 1.0, 0.5);
      let life = CLASS_FX_LIFE.rift, pulse = 0, was = false;
      addTicker({
        update(dt) {
          life -= dt; pulse -= dt; zone.rotation.y += dt;
          if (Math.random() < 0.7) swirl(p, 4.3, glow, 1.4, false, 0.035, 3.5); // small white motes (U9), so standing inside stays readable
          if (pulse <= 0) { pulse = 1; ringFx(p, 4.5, col, 0.8); }
          const P = G.player;
          const inside = P && !P.dead && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < 4.7 && Math.abs(P.pos.y - p.y) < 3;
          if (inside) {
            if (empower) P.status.apply('empower', { t: 0.25 });
            else { P.status.apply('rift', { t: 0.2 }); P.healPct(0.28 * dt); P.regenT = Math.min(P.regenT, 0.5); }
            if (o.luna) P.status.apply('lunafaction', { t: 0.25 }); // the caster's Lunafaction Boots, for whoever stands inside
          }
          was = inside;
          return life > 0;
        },
        dispose() { G.scene?.remove(zone); },
      });
      sfx.heal();
      break;
    }
    case 'healburst': { // Healing Grenade: a white burst, then a white orb. Every Guardian can pick it up once on their own screen.
      const p = V(o.p);
      shockwave(p.clone().setY(0.05), o.r, 0xffffff, 0.6);
      glowBurst(p, 0xffffff, 28, 7, 0.1, 0.7, 2, 0.4);
      pillar(p, 1.2, 6, 0xfff4dd, 0.8, 0.4);
      const at = p.clone().setY(Math.max(0, p.y) + 1);
      const orb = new THREE.Group();
      orb.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshBasicMaterial({ color: 0xffffff })));
      orb.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshBasicMaterial({ color: 0xfff4dd, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));
      orb.position.copy(at);
      G.scene.add(orb);
      let life = HEAL_ORB.life;
      addTicker({
        update(dt) {
          life -= dt;
          orb.position.y = at.y + Math.sin(G.time * 3) * 0.12;
          orb.children[1].scale.setScalar(1 + Math.sin(G.time * 6) * 0.15);
          if (Math.random() < 0.25) ember(orb.position.clone(), 0xffffff, 0.05, 0.6, 0.5);
          const P = G.player;
          if (P && !P.dead && Math.hypot(P.pos.x - at.x, P.pos.z - at.z) < HEAL_ORB.r && Math.abs(P.pos.y + 1 - at.y) < 2) {
            P.healPct(o.big ? HEAL_ORB.healBig : HEAL_ORB.heal); P.restore(o.big ? HEAL_ORB.restoreBig : HEAL_ORB.restore);
            glowBurst(orb.position.clone(), 0xffffff, 14, 4, 0.08, 0.5, 2, 0.3);
            sfx.heal();
            return false;
          }
          return life > 0;
        },
        dispose() { G.scene?.remove(orb); },
      });
      sfx.heal();
      break;
    }
    case 'suppress': { // Suppressor Grenade
      const p = V(o.p), col = hex('void');
      shockwave(p.clone().setY(0.05), o.r, col, 0.6);
      shockwave(p.clone().setY(1), o.r * 0.7, 0xe6d0ff, 0.4);
      glowBurst(p, col, 26, 8, 0.1, 0.6, 0, 0.3);
      explosionFx(p, 2.5, col);
      break;
    }
    case 'phoenix': { // Phoenix Dive landing / ground cast
      const p = V(o.p), col = hex('solar');
      shockwave(p.clone().setY(0.05), o.r, col, 0.6);
      shockwave(p.clone().setY(0.05), o.r * 0.6, 0xffe0a0, 0.4);
      pillar(p, 1.4, 5, col, 0.8, 0.35);
      for (let i = 0; i < 3; i++) swirl(p, 2.5, i ? col : 0xffe0a0, 1.2, true, 0.08, 2);
      break;
    }
    case 'ward': { // Bastion Ward: a dome that destroys enemy shots and refreshes overshields inside
      const p = V(o.p), r = o.r, col = hex('void');
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const wire = new THREE.Mesh(new THREE.SphereGeometry(r * 1.01, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe6d0ff, wireframe: true, transparent: true, opacity: 0.25, depthWrite: false }));
      dome.position.set(p.x, 0, p.z); wire.position.copy(dome.position);
      G.scene.add(dome, wire);
      shockwave(p.clone().setY(0.05), r, col, 0.6);
      let life = o.life || 8, pulse = 0;
      addTicker({
        ward: { p: new THREE.Vector3(p.x, 0, p.z), r2: r * r },
        update(dt) {
          life -= dt; pulse -= dt; wire.rotation.y += dt * 0.3;
          dome.material.opacity = 0.12 + 0.05 * Math.sin(G.time * 4);
          const P = G.player;
          // Ward of Dawn: Weapons of Light for every Guardian inside (on their own screen)
          if (o.wol && P && !P.dead && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < r) P.status.apply('wol', { t: 0.3 });
          if (pulse <= 0) {
            pulse = 1;
            if (P && !P.dead && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < r) P.addOvershield(25, 3);
          }
          return life > 0;
        },
        dispose() { G.scene?.remove(dome, wire); },
      });
      sfx.ability();
      break;
    }
    case 'songflame': { // Song of Flame aura: empowers allies near the caster (on their own screens)
      const p = V(o.p);
      ringFx(p.clone().setY(0.1), 3, hex('solar'), 0.5);
      const P = G.player;
      if (!local && P && !P.dead && P.pos.distanceTo(p) < o.r) { P.status.apply('empower', { t: 2.2 }); P.restore(2.2); }
      break;
    }
    case 'blink': { // Blink, Nova Warp, Storm's Edge: a streak between the two points
      const a = V(o.a), b = V(o.b), col = hex(o.el);
      afterimage(a, col, 0.5);
      beam(a, b, col, 0.05, 0.25);
      glowBurst(b, col, 12, 4, 0.08, 0.4, 0, 0.5);
      break;
    }
    case 'tornado': { // Burning Maul: a solar tornado that rolls forward and burns what it touches
      const p = V(o.p), d = V(o.d), col = hex('solar');
      const tw = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.2, 10, 1, true).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      tw.position.copy(p).setY(1.6);
      G.scene.add(tw);
      let life = 2.4, tick = 0;
      addTicker({
        update(dt) {
          life -= dt; tick -= dt;
          tw.position.addScaledVector(d, dt * 5);
          tw.rotation.y += dt * 12;
          if (Math.random() < 0.8) ember(tw.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.5)), Math.random() < 0.5 ? col : 0xffd27a, 0.08, 1.2, 0.5);
          if (local && tick <= 0) { tick = 0.3; for (const e of enemiesNear(tw.position.clone().setY(1), 2.2)) dealDamage(e, o.dmg, { element: 'solar', source: 'super', burn: 1 }); }
          return life > 0;
        },
        dispose() { G.scene?.remove(tw); },
      });
      break;
    }
    case 'voidaxe': { // Twilight Arsenal: an axe that waits where it landed; the first Guardian to touch it can throw it (left-click)
      const p = V(o.p), col = hex('void');
      const axe = buildVoidAxe(1.15);
      axe.position.copy(p).setY(p.y + 0.6);
      G.scene.add(axe);
      const rec = { dead: false };
      orbs.set(o.id, rec);
      let life = SUPER_TUNE.twilight.life;
      addTicker({
        update(dt) {
          life -= dt; axe.rotation.y += dt * 2;
          if (Math.random() < 0.3) ember(axe.position.clone(), col, 0.06, 0.6, 0.5);
          const P = G.player;
          if (!rec.dead && P && !P.dead && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < 1.5 && Math.abs(P.pos.y - p.y) < 2.2) {
            rec.dead = true;
            P.status.apply('voidaxe', { set: true });
            sfx.pickupAmmo();
            castFx('orbc', { id: o.id });
          }
          return life > 0 && !rec.dead;
        },
        dispose() { G.scene?.remove(axe); orbs.delete(o.id); },
      });
      break;
    }
    case 'gatherstorm': { // Gathering Storm: the staff sticks, lightning strikes it, then it jolts enemies around it
      const p = V(o.p), col = hex('arc'), T = SUPER_TUNE.gathering;
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), new THREE.MeshBasicMaterial({ color: 0xe0f6ff }));
      staff.position.copy(p).setY(p.y + 1);
      G.scene.add(staff);
      let delay = 1, life = T.field, tick = 0, fx = 0;
      addTicker({
        update(dt) {
          if (delay > 0) {
            delay -= dt;
            if (Math.random() < 0.6) lightning(staff.position.clone().setY(p.y + 2), staff.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, -1, (Math.random() - 0.5) * 3)), col, 0.03);
            if (delay <= 0) {
              lightning(p.clone().setY(40), p.clone().setY(p.y + 1), 0xffffff, 0.25);
              lightning(p.clone().setY(40).add(new THREE.Vector3(1, 0, 0)), p.clone().setY(p.y + 1), col, 0.15);
              shockwave(p.clone().setY(p.y + 0.05), T.r, col, 0.8);
              pillar(p, 1.2, 30, 0xe0f6ff, 0.5, 0.4);
              if (local) explode(p.clone().setY(p.y + 1), T.r, o.dmg, 'arc', { source: 'super', debuffs: { jolt: 4 } });
              sfx.explosion(8);
            }
            return true;
          }
          life -= dt; tick -= dt; fx -= dt;
          if (fx <= 0) { fx = 0.2; for (const e of enemiesNear(staff.position, T.fieldR).slice(0, 4)) lightning(staff.position, e.center(new THREE.Vector3()), col, 0.04); }
          if (local && tick <= 0) { tick = 0.5; for (const e of enemiesNear(staff.position, T.fieldR)) dealDamage(e, o.tick, { element: 'arc', source: 'super', jolt: 2 }); }
          return life > 0;
        },
        dispose() { G.scene?.remove(staff); },
      });
      break;
    }
    case 'well': { // Well of Radiance: Guardians inside heal, take less damage and deal more weapon damage (on their own screens)
      const p = V(o.p), r = o.r, col = hex('solar');
      const zone = zoneMesh(p, r, col);
      const sword = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.04), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }));
      sword.position.copy(p).setY(p.y + 0.9);
      G.scene.add(sword);
      shockwave(p.clone().setY(0.05), r, col, 0.8);
      pillar(p, 0.4, 10, 0xffe0a0, 1.0, 0.5);
      const W = SUPER_TUNE.well;
      let life = o.life, pulse = 0, burnT = 0, inside = false;
      addTicker({
        update(dt) {
          life -= dt; pulse -= dt; zone.rotation.y += dt * 0.6;
          if (pulse <= 0) { pulse = 1; ringFx(p, r, col, 0.8); }
          if (Math.random() < 0.6) ember(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * r * 1.6, 0.2, (Math.random() - 0.5) * r * 1.6)), Math.random() < 0.5 ? col : 0xffffff, 0.06, 1.5, 1);
          // enemies inside burn (the caster's copy deals the damage)
          if (local && (burnT -= dt) <= 0) {
            burnT = 0.5;
            for (const e of enemiesNear(p, r + 0.5)) {
              if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) - e.radius > r || Math.abs(e.pos.y - p.y) > 3) continue;
              dealDamage(e, W.burn * 0.5, { element: 'solar', source: 'super', burn: 1.1, pos: e.center(new THREE.Vector3()) });
            }
          }
          const P = G.player;
          const now = !!(P && !P.dead && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < r && Math.abs(P.pos.y - p.y) < 3);
          if (now) {
            // the buff shows how long the well has left; a much stronger Restoration lingers briefly after leaving
            P.status.apply('well', { t: Math.max(0.1, life), set: true });
            P.healPct(W.heal * dt);
            P.restore(W.restore);
          } else if (inside) P?.status.remove('well');
          inside = now;
          if (life <= 0 && inside) P?.status.remove('well');
          return life > 0;
        },
        dispose() { G.scene?.remove(zone, sword); },
      });
      sfx.heal();
      break;
    }
    case 'airburst': { // Burst Glide / Triple Jump
      const p = V(o.p), col = hex(o.el);
      shockwave(p, 1.8, col, 0.4);
      glowBurst(p, col, 12, 5, 0.08, 0.5, -2, -0.8);
      break;
    }

    case 'sunspot': { // Sol Invictus / Hammer of Sol: whoever stands in it heals and recharges faster (on their own screen); enemies inside burn (caster's copy)
      const p = V(o.p), col = hex('solar');
      const zone = zoneMesh(p, 2.5, col);
      pillar(p.clone().setY(0), 2.3, 1.2, col, 6, 0.15);
      let life = SUNSPOT.life, tick = 0;
      addTicker({
        update(dt) {
          life -= dt; zone.rotation.y += dt * 1.5;
          if (local && (tick -= dt) <= 0) {
            tick = SUNSPOT.tick;
            for (const e of enemiesNear(p, SUNSPOT.r + 0.5)) {
              if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) - e.radius > SUNSPOT.r || Math.abs(e.pos.y - p.y) > 3) continue;
              dealDamage(e, SUNSPOT.dmg, { element: 'solar', source: 'ability', burn: 1.1, pos: e.center(new THREE.Vector3()) });
            }
          }
          if (Math.random() < 0.4) ember(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0.2, (Math.random() - 0.5) * 4)), 0xffb547, 0.05, 0.9, 1.2);
          const P = G.player;
          if (P && !P.dead && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < 2.7 && Math.abs(P.pos.y - p.y) < 3) { P.status.apply('sunspot', { t: 0.25 }); P.restore(0.3); }
          return life > 0;
        },
        dispose() { G.scene?.remove(zone); },
      });
      break;
    }
    case 'companion': { // Child of the Old Gods (drains + weakens, heals the caster) / Arc Soul (lightning)
      const child = o.kind === 'child', hell = o.kind === 'hellion', sentry = o.kind === 'sentry';
      const el = child ? 'void' : hell ? 'solar' : 'arc', col = hex(el);
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(child ? 0.32 : 0.24, 1), new THREE.MeshBasicMaterial({ color: col }));
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 20), new THREE.MeshBasicMaterial({ color: child ? 0xe6d0ff : 0xe0f6ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      orb.add(halo);
      const home = V(o.p);
      orb.position.copy(home).setY(home.y + 2.2);
      G.scene.add(orb);
      let life = o.life || 8, tick = 0.5;
      const at = new THREE.Vector3();
      addTicker({
        update(dt) {
          life -= dt; tick -= dt;
          // follows the caster on every screen (teammates track the caster's avatar); parks where it was summoned while they're down
          const caster = local ? G.player : remotes.get(o.by);
          const anchor = caster && !caster.dead && !o.fixed ? caster.pos : home; // Hellion and Ionic Sentry stay where they were summoned
          at.set(anchor.x + Math.cos(G.time * 1.3) * 1.1, anchor.y + 2.3 + Math.sin(G.time * 3) * 0.15, anchor.z + Math.sin(G.time * 1.3) * 1.1);
          orb.position.lerp(at, Math.min(1, dt * 5));
          halo.rotation.y += dt * 3; orb.rotation.x += dt;
          if (tick <= 0) {
            const A = hell ? ASPECT_TUNE.hellion : sentry ? ASPECT_TUNE.ionicsentry : null;
            tick = child ? 0.5 : A ? A.tick : ARC_SOUL.tick;
            for (const tgt of enemiesNear(orb.position, 14, sentry ? A.n : 1)) {
              const c = tgt.center(new THREE.Vector3());
              if (hell) { lobBolt(orb.position, c, local, tgt); continue; } // U9: Hellion lobs burning bolts
              if (child) beam(orb.position, c, col, 0.05, 0.2); else lightning(orb.position, c, col, 0.04);
              flare(c, col, 0.6, 0.15);
              if (local) {
                dealDamage(tgt, child ? 24 : A ? A.dmg : ARC_SOUL.dmg, { element: el, source: 'ability', pos: c, weaken: child ? 1 : 0, burn: hell ? 1.5 : 0, jolt: sentry ? 3 : 0, companion: true });
                if (child) G.player.healPct(0.05);
              }
            }
          }
          return life > 0;
        },
        dispose() { G.scene?.remove(orb); explosionFx(orb.position.clone(), 1.2, col); },
      });
      break;
    }

    case 'orb': { // Orb of Power: every Guardian sees it; the first to touch it takes it (the claim is replayed as 'orbc')
      const p = V(o.p), at = new THREE.Vector3(p.x, Math.max(p.y, 0) + 1, p.z);
      const col = 0xcdb6ff;
      const orb = new THREE.Group();
      orb.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshBasicMaterial({ color: 0xffffff })));
      orb.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })));
      orb.position.copy(at);
      G.scene.add(orb);
      glowBurst(at.clone(), col, 10, 3, 0.08, 0.45, 1, 0.3);
      const rec = { dead: false };
      orbs.set(o.id, rec);
      let life = ORB.life;
      addTicker({
        update(dt) {
          life -= dt;
          orb.position.y = at.y + Math.sin(G.time * 3 + at.x) * 0.1;
          orb.children[1].scale.setScalar(1 + Math.sin(G.time * 6) * 0.15);
          if (Math.random() < 0.2) ember(orb.position.clone(), col, 0.05, 0.6, 0.5);
          const P = G.player;
          if (!rec.dead && P && !P.dead && P.modsOn && Math.hypot(P.pos.x - at.x, P.pos.z - at.z) < ORB.r && Math.abs(P.pos.y + 1 - at.y) < 2.2) {
            rec.dead = true;
            P.pickupOrb();
            glowBurst(orb.position.clone(), col, 14, 4, 0.08, 0.5, 2, 0.3);
            castFx('orbc', { id: o.id });
          }
          return life > 0 && !rec.dead;
        },
        dispose() { G.scene?.remove(orb); orbs.delete(o.id); },
      });
      break;
    }
    case 'orbc': { const r = orbs.get(o.id); if (r) r.dead = true; break; } // another Guardian took it

    // ---------------- supers ----------------
    case 'superStart': {
      const p = V(o.p), col = hex(o.el), feet = p.clone().setY(0.05);
      shockwave(feet, 9, col, 0.8);
      shockwave(feet, 5, 0xffffff, 0.5);
      pillar(p, 1.6, 14, col, 0.9, 0.45);
      glowBurst(p.clone().setY(p.y + 1), col, 40, 12, 0.14, 0.9, 3, 0.6);
      if (!local) sfx.superStart();
      break;
    }
    case 'blast': { // Hammer of Sol / Nova Bomb impacts
      const p = V(o.p), col = hex(o.el), r = o.r || 5, g0 = p.clone().setY(0.05);
      if (o.el === 'void') { voidBurst(p, r * 0.8); voidRing(g0, r * 1.4, 0.8); } // U9: Void implodes first, with a dark core
      shockwave(g0, r * 1.3, col, 0.7);
      pillar(g0, r * 0.3, r * 1.6, col, 0.6, 0.4);
      flare(p, 0xffffff, r * 0.8, 0.4);
      glowBurst(p, col, Math.round(r * 5), r * 1.6, 0.16, 0.9, 2, 0.5);
      if (o.big) {
        let n = 2;
        addTicker({ t: 0.18, update(dt) { this.t -= dt; if (this.t <= 0) { this.t = 0.18; shockwave(g0, r + n * 4, n % 2 ? 0xffffff : col, 0.7); n--; } return n > 0; } });
        for (let i = 0; i < 20; i++) swirl(p, r, i % 2 ? col : o.el === 'void' ? VOID_FX.hi : 0xffffff, 0.9, true, 0.15, 3);
        if (o.el === 'void') for (let i = 0; i < 10; i++) voidMote(p, r, 0.6, 0.2);
        const d = G.player.pos.distanceTo(p);
        if (d < 40) { ui.screenFlash(ELEMENTS[o.el].color, 0.5 * (1 - d / 40)); G.player.shake = Math.max(G.player.shake, 0.6 * (1 - d / 40)); }
      }
      break;
    }
    case 'tether': { // Shadowshot anchor: pulls, slows, weakens, and burns enemies nearby
      const p = V(o.p), col = hex('void');
      const anchor = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: col }));
      anchor.position.copy(p).setY(Math.max(1.2, p.y));
      G.scene.add(anchor);
      voidRing(p.clone().setY(0.05), 8, 0.6);
      let life = 6, tick = 0, fx = 0;
      addTicker({
        update(dt) {
          life -= dt; tick -= dt; fx -= dt;
          anchor.rotation.y += dt * 3; anchor.rotation.x += dt * 2;
          if (Math.random() < 0.4) voidMote(anchor.position, 2.5, 0.4, 0.1);
          const near = enemiesNear(anchor.position, 8);
          if (fx <= 0) { fx = 0.25; for (const e of near.slice(0, 6)) lightning(anchor.position, e.center(new THREE.Vector3()), col, 0.03); }
          if (local) {
            for (const e of near) if (!e.isBoss && !e.remote) e.knock.addScaledVector(anchor.position.clone().sub(e.pos).setY(0).normalize(), dt * 6);
            if (tick <= 0) { tick = 0.25; for (const e of near) dealDamage(e, 12, { element: 'void', source: 'super', weaken: 0.6, slow: 0.6 }); }
          }
          return life > 0;
        },
        dispose() { G.scene?.remove(anchor); },
      });
      break;
    }
    case 'novafield': { // Nova Bomb's lingering void field: damages, weakens and suppresses enemies inside
      const p = V(o.p), col = hex('void'), F = NOVA_FIELD;
      const zone = zoneMesh(p, F.radius, col);
      voidRing(p.clone().setY(0.05), F.radius, 0.6);
      let life = F.life, tick = 0, pulse = 0;
      addTicker({
        update(dt) {
          life -= dt; tick -= dt; pulse -= dt; zone.rotation.y -= dt * 0.8;
          if (pulse <= 0) { pulse = 0.5; voidRing(p, F.radius, 0.6); }
          if (Math.random() < 0.6) swirl(p, F.radius * 0.9, Math.random() < 0.5 ? col : VOID_FX.hi, 1.2, false, 0.06, 2);
          if (Math.random() < 0.3) voidMote(p.clone().setY(p.y + 0.6), F.radius * 0.8, 0.8);
          if (local && tick <= 0) {
            tick = F.tick;
            for (const e of G.enemies) if (e.alive && inXZ(e, p, F.radius)) dealDamage(e, o.dmg, { element: 'void', source: 'super', weaken: F.weaken, suppress: F.suppress });
          }
          return life > 0;
        },
        dispose() { G.scene?.remove(zone); },
      });
      break;
    }
    default:
      console.warn('Unknown ability effect', kind);
  }
}
