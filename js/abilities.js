import * as THREE from 'three';
import { G } from './state.js';
import { ELEMENTS } from './data.js';
import { glowBurst, shockwave, pillar, flare, swirl, homingMote, afterimage, ringFx, lightning, beam, explosionFx, ember } from './effects.js';
import { dealDamage, enemiesNear, addTicker } from './game.js';
import { sendFx } from './coop.js';
import { STORM_GRENADE } from './combat.js';
import { sfx } from './audio.js';
import * as ui from './ui.js';

// Every ability effect lives here once. The caster runs it with local = true
// (visuals + damage); fireteam members replay the same effect from a network
// message with local = false (visuals, plus anything that affects THEIR
// player or the world: barricade walls, rift healing/empowering).

const V = (a) => (a instanceof THREE.Vector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));
const arr = (v) => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];
const hex = (el) => ELEMENTS[el]?.hex ?? 0xffffff;

/** Run an ability effect locally and tell the fireteam about it. */
export function castFx(kind, o) {
  const wire = {};
  for (const [k, v] of Object.entries(o)) wire[k] = v instanceof THREE.Vector3 ? arr(v) : Array.isArray(v) && v[0] instanceof THREE.Vector3 ? v.map(arr) : v;
  sendFx({ t: 'fx', k: 'ab', kind, o: wire });
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
      shockwave(p.clone().setY(0.05), R, col, 0.7);
      flare(p, 0xe6d0ff, 2.5, 0.3);
      let life = o.big ? 5.5 : 4, tick = 0;
      addTicker({
        update(dt) {
          life -= dt; tick -= dt;
          zone.rotation.y += dt * 4;
          zone.children[0].scale.setScalar(1 + Math.sin(G.time * 10) * 0.12);
          for (let i = 0; i < 4; i++) swirl(p, R, i % 2 ? col : 0xe6d0ff, 0.7, true, 0.09, 2.4);
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
      let delay = 0.5, life = 4.5, tick = 0;
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
      const p = V(o.p), col = 0xff8b2b, alongX = o.alongX;
      const len = o.small ? 2.6 : 5, h = o.small ? 1.3 : 2.2; // Rally Barricade is short and low
      const w = alongX ? len : 0.6, d = alongX ? 0.6 : len;
      const geo = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, emissive: 0xff6a10, emissiveIntensity: 0.7, transparent: true, opacity: 0.5, flatShading: true }));
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending })));
      mesh.position.set(p.x, 0, p.z);
      mesh.scale.y = 0.01;
      G.scene.add(mesh);
      // a real wall on every screen: blocks enemy shots and movement for the whole fireteam
      const box = { min: new THREE.Vector3(p.x - w / 2, 0, p.z - d / 2), max: new THREE.Vector3(p.x + w / 2, h, p.z + d / 2) };
      G.colliders.push(box);
      shockwave(p.clone().setY(0.05), 4, col, 0.5);
      for (let i = 0; i < 16; i++) glowBurst(p.clone().add(new THREE.Vector3(alongX ? (Math.random() - 0.5) * w : 0, 0.1, alongX ? 0 : (Math.random() - 0.5) * d)), i % 2 ? col : 0xffd27a, 1, 3, 0.1, 0.7, 4, 1);
      let life = o.small ? 7 : 12, age = 0;
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
      const col = empower ? hex('arc') : 0xb07cff, glow = empower ? 0xe0f6ff : 0xe6d0ff;
      const zone = zoneMesh(p, 4.5, col);
      shockwave(p.clone().setY(0.05), 5, col, 0.7);
      pillar(p, 4.3, 0.6, col, 10, 0.12);
      pillar(p, 0.5, 9, glow, 1.0, 0.5);
      let life = 10, pulse = 0, was = false;
      addTicker({
        update(dt) {
          life -= dt; pulse -= dt; zone.rotation.y += dt;
          for (let i = 0; i < 2; i++) swirl(p, 4.3, i ? col : glow, 1.4, false, 0.07, 3.5);
          if (pulse <= 0) { pulse = 1; ringFx(p, 4.5, col, 0.8); }
          const P = G.player;
          const inside = P && !P.dead && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < 4.7 && Math.abs(P.pos.y - p.y) < 3;
          if (inside) {
            if (empower) P.status.apply('empower', { t: 0.25 });
            else { P.status.apply('rift', { t: 0.2 }); P.heal(28 * dt); P.regenT = Math.min(P.regenT, 0.5); }
            if (!was) ui.feed(empower ? 'Empowered: +25% weapon damage' : 'Healing Rift', empower ? '#5fd3ff' : '#b07cff');
          }
          was = inside;
          return life > 0;
        },
        dispose() { G.scene?.remove(zone); },
      });
      sfx.heal();
      break;
    }
    case 'healburst': { // Healing Grenade: Restoration for every player caught in it (each applies it to themselves)
      const p = V(o.p), col = hex('solar');
      shockwave(p.clone().setY(0.05), o.r, col, 0.6);
      glowBurst(p, 0xffe0a0, 24, 7, 0.1, 0.7, 2, 0.4);
      pillar(p, 1.2, 6, col, 0.8, 0.4);
      const P = G.player;
      if (P && !P.dead && P.pos.distanceTo(p) < o.r) { P.heal(o.big ? 70 : 40); P.restore(o.big ? 9 : 6); ui.feed('Restoration', '#ffb547'); }
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
      let life = 8, pulse = 0;
      addTicker({
        ward: { p: new THREE.Vector3(p.x, 0, p.z), r2: r * r },
        update(dt) {
          life -= dt; pulse -= dt; wire.rotation.y += dt * 0.3;
          dome.material.opacity = 0.12 + 0.05 * Math.sin(G.time * 4);
          const P = G.player;
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
    case 'airburst': { // Burst Glide / Triple Jump
      const p = V(o.p), col = hex(o.el);
      shockwave(p, 1.8, col, 0.4);
      glowBurst(p, col, 12, 5, 0.08, 0.5, -2, -0.8);
      break;
    }

    case 'sunspot': { // Sol Invictus: whoever stands in it heals and recharges abilities faster (on their own screen)
      const p = V(o.p), col = hex('solar');
      const zone = zoneMesh(p, 2.5, col);
      pillar(p.clone().setY(0), 2.3, 1.2, col, 6, 0.15);
      let life = 6;
      addTicker({
        update(dt) {
          life -= dt; zone.rotation.y += dt * 1.5;
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
      const child = o.kind === 'child', col = hex(child ? 'void' : 'arc');
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
          // follows the caster on the caster's screen; replays hover where it was summoned
          const anchor = local && G.player && !G.player.dead ? G.player.pos : home;
          at.set(anchor.x + Math.cos(G.time * 1.3) * 1.1, anchor.y + 2.3 + Math.sin(G.time * 3) * 0.15, anchor.z + Math.sin(G.time * 1.3) * 1.1);
          orb.position.lerp(at, Math.min(1, dt * 5));
          halo.rotation.y += dt * 3; orb.rotation.x += dt;
          if (tick <= 0) {
            tick = child ? 0.5 : 0.4;
            const tgt = enemiesNear(orb.position, 14, 1)[0];
            if (tgt) {
              const c = tgt.center(new THREE.Vector3());
              if (child) beam(orb.position, c, col, 0.05, 0.2); else lightning(orb.position, c, col, 0.04);
              flare(c, col, 0.6, 0.15);
              if (local) {
                dealDamage(tgt, child ? 24 : 34, { element: child ? 'void' : 'arc', source: 'ability', pos: c, weaken: child ? 1 : 0 });
                if (child) G.player.heal(5);
              }
            }
          }
          return life > 0;
        },
        dispose() { G.scene?.remove(orb); explosionFx(orb.position.clone(), 1.2, col); },
      });
      break;
    }

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
      shockwave(g0, r * 1.3, col, 0.7);
      pillar(g0, r * 0.3, r * 1.6, col, 0.6, 0.4);
      flare(p, 0xffffff, r * 0.8, 0.4);
      glowBurst(p, col, Math.round(r * 5), r * 1.6, 0.16, 0.9, 2, 0.5);
      if (o.big) {
        let n = 2;
        addTicker({ t: 0.18, update(dt) { this.t -= dt; if (this.t <= 0) { this.t = 0.18; shockwave(g0, r + n * 4, n % 2 ? 0xffffff : col, 0.7); n--; } return n > 0; } });
        for (let i = 0; i < 20; i++) swirl(p, r, i % 2 ? col : 0xffffff, 0.9, true, 0.15, 3);
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
      shockwave(p.clone().setY(0.05), 8, col, 0.6);
      let life = 6, tick = 0, fx = 0;
      addTicker({
        update(dt) {
          life -= dt; tick -= dt; fx -= dt;
          anchor.rotation.y += dt * 3; anchor.rotation.x += dt * 2;
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
    default:
      console.warn('Unknown ability effect', kind);
  }
}
