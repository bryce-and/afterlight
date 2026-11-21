// U32 "Dropships": enemies arrive by faction ship (Cabal, Fallen, Hive, Scorn) or step out of a gate (Vex, Taken) instead of appearing from nothing.
// Units are created hidden and outside G.enemies (spawnUnit `defer`), so they cannot be hit, targeted or act. They join the fight when they land.
// Pure planning (grouping, timeline, flight, sky check) lives in dropship-plan.js.
import * as THREE from 'three';
import { buildShip, buildGate, disposeGate, HALF } from './dropship-models.js';
import { G } from './state.js';
import { groundAt, pointInColliders } from './physics.js';
import { ringFx, sparks } from './effects.js';
import { registerEnemy, announceDrop } from './coop.js';
import { DROP, arrivalOf, groupDrops, skyClear, pickRoute, segDist, shipTimeline, shipPos, fallTime, dropshipsEnabled, DROPSHIP_KEY } from './dropship-plan.js';

const drops = [];
const _v = new THREE.Vector3();

export const dropshipsOn = () => dropshipsEnabled(typeof localStorage !== 'undefined' ? localStorage : null);
export function setDropshipsOn(on) { try { localStorage.setItem(DROPSHIP_KEY, on ? '1' : '0'); } catch { /* storage blocked: the choice lasts until reload */ } }

// ---------------------------------------------------------------- landing and teardown
/** A unit joins the fight: visible, targetable, announced to co-op. `instant` keeps the normal grow-in (used when no drop plays). */
function land(e, instant = false) {
  e.dropping = false;
  e.model.group.visible = true;
  e.model.group.position.copy(e.pos);
  if (!instant) { e.spawnT = 1; e.model.group.scale.setScalar(e.scale); }
  else { ringFx(e.pos, 2 * e.scale, e.shotColor, 0.6); sparks(_v.copy(e.pos).setY(1), e.shotColor, 8, 5, 0.1, 0.5); }
  G.enemies.push(e);
  registerEnemy(e);
  G.hitDirty = true;
}

function discardUnit(u) { if (!u.done) { u.done = true; if (u.e.model?.group.parent) u.e.remove(); } }

function removeDrop(d) {
  if (d.mesh) { G.scene.remove(d.mesh); }
  for (const u of d.units) { if (u.gate) { G.scene.remove(u.gate); disposeGate(u.gate); } discardUnit(u); }
}

/** Drop everything that is still in flight (mission end, level swap). Unlanded units are discarded with their models. */
export function resetDropships() {
  for (const d of drops) removeDrop(d);
  drops.length = 0;
}

// ---------------------------------------------------------------- launching
const blocked = (x, y, z) => !!pointInColliders(_v.set(x, y, z), 0.4);

/**
 * Takes freshly spawned deferred enemies (spawnUnit `defer`) and plays their arrival. Anything that cannot play one (the setting is off, no open sky above
 * the spot, a boss, a faction with no arrival) lands at once with the old grow-in, so waves never stall on a missing animation.
 * `place(anchor)` returns a nearby ground spot for a unit riding with the first of its drop.
 */
export function launchDrops(enemies, place) {
  const eligible = [], plain = [];
  for (const e of enemies) (dropshipsOn() && !e.isBoss && arrivalOf(e.faction) && e.alive ? eligible : plain).push(e);
  for (const grp of groupDrops(eligible.map((e) => ({ faction: e.faction, e })))) {
    const es = grp.items.map((i) => i.e);
    if (grp.kind === 'teleport') {
      const t = { kind: 'teleport', t: 0, units: [] };
      es.forEach((e) => {
        if (!skyClear(blocked, e.pos.x, e.pos.y, e.pos.z, 6, 1.5)) { plain.push(e); return; }
        const gate = buildGate(e.faction);
        gate.position.copy(e.pos);
        gate.scale.set(0.01, 0.01, 0.01);
        G.scene.add(gate);
        t.units.push({ e, gate, at: DROP.tpCharge + t.units.length * DROP.tpGap, done: false, landed: false });
        e.dropping = true;
      });
      if (t.units.length) drops.push(t);
      continue;
    }
    const anchor = es[0].pos.clone();
    // U32 H31: ships never share the sky. Hover points stay DROP.hoverSep apart and every flight line keeps DROP.shipClear from the others.
    const flying = drops.filter((d) => d.mesh);
    const spotOk = (p) => flying.every((d) => Math.hypot(d.hover.x - p.x, d.hover.z - p.z) >= DROP.hoverSep
      && segDist(p, p, d.from, d.hover) >= DROP.shipClear && segDist(p, p, d.hover, d.to) >= DROP.shipClear); // clear of every hull and every flight line already in the air
    if (!spotOk(anchor)) { // look for a spot round the first pick that keeps its distance
      let found = null;
      for (const r of [DROP.hoverSep, DROP.hoverSep * 1.5, DROP.hoverSep * 2]) for (let k = 0; k < 6 && !found; k++) {
        const a = Math.random() * Math.PI * 2, p = place?.(new THREE.Vector3(anchor.x + Math.sin(a) * r, 0, anchor.z + Math.cos(a) * r));
        if (p && spotOk(p)) found = p;
      }
      if (!found) { plain.push(...es); continue; } // no room for another hull: the old spawn
      anchor.copy(found);
    }
    es[0].pos.copy(anchor); es[0].pos.y = groundAt(anchor.x, anchor.z); anchor.y = es[0].pos.y;
    if (!skyClear(blocked, anchor.x, anchor.y, anchor.z)) { plain.push(...es); continue; }
    for (let i = 1; i < es.length; i++) { // ride together: the rest of the load lands around the first
      const p = place?.(anchor);
      if (p) { es[i].pos.copy(p); es[i].pos.y = groundAt(p.x, p.z); }
    }
    const hover = { x: anchor.x, y: anchor.y + DROP.hoverHeight, z: anchor.z };
    const pl = G.player.pos;
    const route = pickRoute(hover, Math.atan2(anchor.x - pl.x, anchor.z - pl.z) + (Math.random() - 0.5) * 1.2, flying.flatMap((d) => [{ a: d.from, b: d.hover }, { a: d.hover, b: d.to }])); // in from beyond the enemy side, in view of the fight
    if (route.room < DROP.shipClear * 0.5) { plain.push(...es); continue; }
    const base = route.inH, lift = flying.length * 8; // each extra ship also flies a little higher
    const from = { x: route.from.x, y: hover.y + 28 + lift, z: route.from.z };
    const to = { x: route.to.x, y: hover.y + 55 + lift, z: route.to.z };
    const mesh = buildShip(grp.kind);
    mesh.position.set(from.x, from.y, from.z);
    G.scene.add(mesh);
    const tl = shipTimeline(es.length);
    es.forEach((e) => { e.dropping = true; });
    announceDrop({ k: grp.kind, n: es.length, f: [r1(from.x), r1(from.y), r1(from.z)], h: [r1(hover.x), r1(hover.y), r1(hover.z)], o: [r1(to.x), r1(to.y), r1(to.z)], y: r1(base) });
    drops.push({ kind: grp.kind, t: 0, tl, from, hover, to, mesh, dust: 0, yaw: base, units: es.map((e, i) => ({ e, rel: tl.release[i], vy: 0, y: 0, state: 'wait', done: false })) });
  }
  for (const e of plain) land(e, true);
}

const r1 = (v) => Math.round(v * 10) / 10;
/** Member side: the host's ship, drawn without a cargo (its units arrive through the normal spawn message when they land). */
export function showRemoteShip(m) {
  if (!BUILD_KINDS.includes(m.k) || !dropshipsOn() || !G.scene) return;
  const [f, h, o] = [m.f, m.h, m.o].map(([x, y, z]) => ({ x, y, z }));
  const mesh = buildShip(m.k);
  mesh.position.set(f.x, f.y, f.z);
  G.scene.add(mesh);
  drops.push({ kind: m.k, t: 0, tl: shipTimeline(m.n), from: f, hover: h, to: o, mesh, dust: 0, yaw: m.y, units: [] });
}
const BUILD_KINDS = ['cabal', 'fallen', 'hive'];

// ---------------------------------------------------------------- per frame
function stepShip(d, dt) {
  d.t += dt;
  const p = shipPos(d.t, d.tl, d.from, d.hover, d.to);
  const prev = d.mesh.position;
  const dx = p.x - prev.x, dz = p.z - prev.z;
  if (dx * dx + dz * dz > 1e-4) { const want = Math.atan2(dx, dz); let da = want - d.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); d.yaw += da * Math.min(1, dt * 3); }
  d.mesh.position.set(p.x, p.y, p.z);
  d.mesh.rotation.y = d.yaw;
  const move = p.phase === 'hover' ? 0 : p.phase === 'in' ? 0.12 : -0.14;
  d.mesh.rotation.x = move; // nose down while arriving, up while leaving
  d.mesh.rotation.z = p.phase === 'hover' ? Math.sin(d.t * 1.7) * 0.03 : Math.sin(d.t * 1.1) * 0.05;
  const wob = 1 + Math.sin(d.t * 17) * 0.18;
  for (const m of d.mesh.userData.pulse) { m.userData.sy ??= m.scale.y; m.scale.y = m.userData.sy * wob; }
  d.mesh.visible = p.phase !== 'gone';
  if (p.phase === 'hover') { // downwash: dust rings on the ground under the hull
    d.dust -= dt;
    if (d.dust <= 0) { d.dust = 0.45; _v.set(p.x, groundAt(p.x, p.z), p.z); ringFx(_v, 6, 0xcfc6ac, 0.7); sparks(_v.setY(_v.y + 0.3), 0xcfc6ac, 4, 4, 0.12, 0.5); }
  }
  for (const u of d.units) {
    if (u.done) continue;
    const e = u.e;
    if (!e.alive) { discardUnit(u); continue; } // killed or cleaned up before landing
    if (u.state === 'wait' && d.t >= u.rel) { // out of the hatch
      u.state = 'fall'; u.y = p.y - 2.4; u.vy = 0;
      e.model.group.visible = true; e.model.group.scale.setScalar(e.scale);
      sparks(_v.set(e.pos.x, u.y, e.pos.z), e.shotColor, 5, 3, 0.1, 0.4);
    }
    if (u.state === 'fall') {
      u.vy -= DROP.gravity * dt; u.y += u.vy * dt;
      const floor = e.pos.y;
      if (u.y <= floor) { // touchdown
        u.state = 'landed'; u.done = true;
        ringFx(e.pos, 2.6 * e.scale, e.shotColor, 0.6);
        sparks(_v.copy(e.pos).setY(e.pos.y + 0.3), 0xd0c8b0, 9, 5, 0.12, 0.5);
        land(e);
      } else e.model.group.position.set(e.pos.x, u.y, e.pos.z);
    }
  }
  return p.phase !== 'gone' || d.units.some((u) => !u.done);
}

function stepGates(d, dt) {
  d.t += dt;
  let live = false;
  for (const u of d.units) {
    if (u.gone) continue;
    live = true;
    const e = u.e, k = d.t / u.at, g = u.gate, U = g.userData;
    if (!e.alive && !u.done) { discardUnit(u); u.landedAt = d.t; } // killed or cleaned up before the step-out: the gate just closes
    if (!u.landed && !u.done) { // charging: the column rises and the ring spins up
      const c = Math.min(1, k);
      g.scale.set(0.45 + c * 0.5, 0.2 + c * 1.1, 0.45 + c * 0.5);
      U.ring.rotation.set(HALF, 0, d.t * 9); U.ring.scale.setScalar(1.4 - c * 0.5);
      U.mat.opacity = (U.L.add ? 0.15 : 0.4) + c * 0.35;
      if (k >= 1) { u.landed = true; u.landedAt = d.t; ringFx(e.pos, 3 * e.scale, U.L.flash, 0.5); sparks(_v.copy(e.pos).setY(e.pos.y + 1), U.L.flash, 14, 7, 0.1, 0.5); sparks(_v.setY(e.pos.y + 0.6), U.L.col, 8, 4, 0.12, 0.5); land(e); u.done = true; }
    } else { // collapsing after the step-out (or after the unit died)
      const f = Math.min(1, (d.t - (u.landedAt ?? d.t)) / DROP.tpEnd);
      g.scale.set(0.95 * (1 - f) + 0.01, 1.3 * (1 + f * 0.5), 0.95 * (1 - f) + 0.01);
      U.mat.opacity = 0.5 * (1 - f); U.ringMat.opacity = 0.9 * (1 - f);
      if (f >= 1) { G.scene.remove(g); disposeGate(g); u.gone = true; }
    }
  }
  return live;
}

export function updateDropships(dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    const keep = d.kind === 'teleport' ? stepGates(d, dt) : stepShip(d, dt);
    if (!keep) { removeDrop(d); drops.splice(i, 1); }
  }
}

export const dropshipCount = () => drops.length;

/** Dev and tests: where each ship in the air is right now. */
export const dropshipPositions = () => drops.filter((d) => d.mesh && d.mesh.visible).map((d) => d.mesh.position.clone());
