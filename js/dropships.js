// U32 "Dropships": enemies arrive by faction ship (Cabal, Fallen, Hive, Scorn) or step out of a gate (Vex, Taken) instead of appearing from nothing.
// Units are created hidden and outside G.enemies (spawnUnit `defer`), so they cannot be hit, targeted or act. They join the fight when they land.
// Pure planning (grouping, timeline, flight, sky check) lives in dropship-plan.js.
// U34 "Indoor Arrivals": where there is no open sky, Cabal drop in by pod, Fallen through a ceiling vent and Hive out of a floor crack (launchIndoor / stepIndoor).
import * as THREE from 'three';
import { buildShip, buildGate, disposeGate, buildIndoorProp, HALF } from './dropship-models.js';
import { G } from './state.js';
import { sfx } from './audio.js';
import { groundAt, pointInColliders } from './physics.js';
import { ringFx, sparks } from './effects.js';
import { registerEnemy, announceDrop } from './coop.js';
import { DROP, INDOOR_T, arrivalOf, groupDrops, skyClear, pickRoute, segDist, shipTimeline, shipPos, fallTime, dropshipsEnabled, DROPSHIP_KEY, indoorKindOf, indoorTimeline, headroom, bodyClear, pickArrivalPoint } from './dropship-plan.js';

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
  for (const u of d.units) { if (u.gate) { G.scene.remove(u.gate); disposeGate(u.gate); } if (u.prop) G.scene.remove(u.prop); discardUnit(u); }
}

/** Drop everything that is still in flight (mission end, level swap). Unlanded units are discarded with their models. */
export function resetDropships() {
  for (const d of drops) removeDrop(d);
  drops.length = 0;
}

// ---------------------------------------------------------------- launching
const blocked = (x, y, z) => !!pointInColliders(_v.set(x, y, z), 0.4);

// U34 H44: ceilings are often plain visual boxes with no collider, so a ship (or a pod) would fly through them. Raycast up through the visible scene as well.
const _ray = new THREE.Raycaster(); const _up = new THREE.Vector3(0, 1, 0), _o = new THREE.Vector3();
const ROOF_RANGE = 100; // m: a ship's whole flight (hover 12 m, in at about 40 m, out at about 70 m and more) must be under open sky
let roofSkip = null; // meshes that are never a roof: ships, props, enemy models (set per launch)
const ROOF_RING = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.sin(i * Math.PI / 4) * 14, Math.cos(i * Math.PI / 4) * 14])]; // the hull is up to 20 m wide: a skylight over the centre is not open sky, and the approach slopes in over the roof edge
/** Height of the lowest solid visible surface over (x, y, z) or its 14 m ring, or Infinity when the sky is open for ROOF_RANGE. */
function roofHeight(x, y, z) {
  let m = Infinity;
  for (const [ox, oz] of ROOF_RING) m = Math.min(m, roofRay(x + ox, y, z + oz));
  return m;
}
/** Distance up to the first solid visible surface above (x, y, z), or Infinity. */
function roofRay(x, y, z) {
  if (!G.scene) return Infinity;
  _ray.set(_o.set(x, y + 0.5, z), _up); _ray.far = ROOF_RANGE;
  for (const h of _ray.intersectObjects(G.scene.children, true)) {
    const o = h.object, m = o.material;
    if (!o.isMesh || !o.visible || (m && !Array.isArray(m) && (m.depthWrite === false || m.opacity < 0.15))) continue; // effects and glows do not count; glass does (a ship must not fly through a dome)
    let skip = false;
    for (let a = o; a && !skip; a = a.parent) skip = roofSkip?.has(a);
    if (!skip) return h.distance - 0.5;
  }
  return Infinity;
}

/**
 * Takes freshly spawned deferred enemies (spawnUnit `defer`) and plays their arrival. Anything that cannot play one (the setting is off, no open sky above
 * the spot, a boss, a faction with no arrival) lands at once with the old grow-in, so waves never stall on a missing animation.
 * `place(anchor)` returns a nearby ground spot for a unit riding with the first of its drop.
 */
export function launchDrops(enemies, place) {
  const eligible = [], plain = [], indoor = [];
  G.scene?.updateMatrixWorld(); // the roof raycasts need current world matrices (a wave can launch before the first frame of a level is drawn)
  roofSkip = new Set([...G.enemies.map((e) => e.model?.group), ...enemies.map((e) => e.model?.group), ...drops.map((d) => d.mesh), ...drops.flatMap((d) => d.units.map((u) => u.prop || u.gate))].filter(Boolean));
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
        sfx.gateCharge(e.pos, e.faction);
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
    if (!skyClear(blocked, anchor.x, anchor.y, anchor.z) || roofHeight(anchor.x, anchor.y, anchor.z) < ROOF_RANGE) { indoor.push(...es); continue; } // no open sky here: U34 indoor arrival (falls back to the old spawn per unit)
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
    sfx.shipIn(from, grp.kind);
    const tl = shipTimeline(es.length);
    es.forEach((e) => { e.dropping = true; });
    announceDrop({ k: grp.kind, n: es.length, f: [r1(from.x), r1(from.y), r1(from.z)], h: [r1(hover.x), r1(hover.y), r1(hover.z)], o: [r1(to.x), r1(to.y), r1(to.z)], y: r1(base) });
    drops.push({ kind: grp.kind, t: 0, tl, from, hover, to, mesh, dust: 0, yaw: base, units: es.map((e, i) => ({ e, rel: tl.release[i], vy: 0, y: 0, state: 'wait', done: false })) });
  }
  for (const e of launchIndoor(indoor)) plain.push(e);
  for (const e of plain) land(e, true);
}

// ---------------------------------------------------------------- U34 indoor arrivals
const INDOOR_COL = { pod: 0xff6a3a, vent: 0x4ad0ff, crack: 0x7dff5a };
const solidAt = (x, y, z) => !!pointInColliders(_v.set(x, y, z), 0.2);

/**
 * Plays an indoor arrival for each unit that can take one: Cabal by pod, Fallen by vent, Hive by crack. A unit lands on an authored point
 * (`G.level.arrivalPoints`) when one is near, else on its own spawn spot. Returns the units that could not (no body room, no headroom,
 * a faction with no indoor arrival) so the caller lands them the old way.
 */
function launchIndoor(es) {
  const left = [];
  if (!es.length) return left;
  const tl = indoorTimeline(es.length), used = [], units = [];
  const free = (p) => bodyClear(solidAt, p.x, groundAt(p.x, p.z), p.z);
  for (const e of es) {
    const kind = indoorKindOf(e.faction);
    if (!kind || !e.alive) { left.push(e); continue; }
    const pt = pickArrivalPoint(G.level?.arrivalPoints, e.pos, free, used);
    const x = pt ? pt.x : e.pos.x, z = pt ? pt.z : e.pos.z, floor = groundAt(x, z);
    if (!pt && !bodyClear(solidAt, x, floor, z)) { left.push(e); continue; } // spawn spot inside geometry: never place a unit in a wall
    const h = Math.min(headroom(solidAt, x, floor, z, 18), roofRay(x, floor, z)); // the ceiling, solid or just visible
    if (kind !== 'crack' && h < INDOOR_T.minHeadroom) { left.push(e); continue; }
    used.push({ x, z });
    e.pos.set(x, floor, z);
    const prop = buildIndoorProp(kind);
    prop.position.set(x, floor, z);
    const sc = Math.max(0.8, e.scale || 1);
    prop.scale.setScalar(kind === 'vent' ? 1 : sc);
    G.scene.add(prop);
    e.dropping = true;
    const i = units.length;
    units.push({ e, kind, prop, floor, h, hu: Math.min(h - 1.8, INDOOR_T.fallMax), land: tl.land[i], sc, state: 'wait', done: false, fx: 0 });
  }
  indoorStats.played += units.length; indoorStats.fallback += left.length;
  for (const kind of new Set(units.map((u) => u.kind))) sfx.arrivalWarn(units.find((u) => u.kind === kind).e.pos, kind); // one telegraph sound per kind per wave
  if (units.length) drops.push({ kind: 'indoor', t: 0, end: tl.end, units });
  return left;
}

function stepIndoor(d, dt) {
  d.t += dt;
  let live = d.t < d.end;
  for (const u of d.units) {
    const e = u.e, p = u.prop, t = d.t, col = INDOOR_COL[u.kind];
    if (u.state === 'gone') continue;
    if (!e.alive && !u.done) { discardUnit(u); u.state = 'out'; u.outAt = t; } // killed or cleaned up before landing: the prop just closes
    if (u.state === 'wait') { // the telegraph: glow, shake, seep
      const k = Math.min(1, t / u.land);
      for (const m of p.userData.glow) m.visible = Math.sin(t * 22) > -0.6;
      u.fx -= dt;
      if (u.fx <= 0) { u.fx = 0.5; _v.set(e.pos.x, u.floor + 0.1, e.pos.z); ringFx(_v, 1.6 + 1.2 * k, col, 0.6); sparks(_v, col, 4, 3, 0.08, 0.5); }
      if (u.kind === 'pod') {
        const drop = Math.max(0, Math.min(u.h - 2.3, INDOOR_T.fallMax)), top = u.floor + drop, fallT = Math.max(0.45, Math.min(1.2, fallTime(drop))), f = Math.max(0, (t - (u.land - fallT)) / fallT);
        p.position.y = top + (u.floor - top) * f * f; // hangs at the ceiling, then drops in the last second
        p.position.x = e.pos.x + (f <= 0 ? Math.sin(t * 40) * 0.03 : 0);
      } else if (u.kind === 'vent') {
        const fallT = fallTime(u.hu), t0 = u.land - fallT;
        if (t < t0) { p.position.set(e.pos.x + Math.sin(t * 38) * 0.04, u.floor + u.hu + 1.7, e.pos.z); } // rattles in its frame
        else { // the grate drops and the unit follows it down
          const s = t - t0;
          p.position.y = Math.max(u.floor + 0.05, u.floor + u.hu + 1.7 - 0.5 * DROP.gravity * s * s); p.rotation.z = Math.min(s * 3, 1.2) ;
          const uy = Math.max(u.floor, u.floor + u.hu - 0.5 * DROP.gravity * s * s);
          if (!e.model.group.visible) { e.model.group.visible = true; e.model.group.scale.setScalar(e.scale); }
          e.model.group.position.set(e.pos.x, uy, e.pos.z);
        }
      } else { // crack: the fissure opens, then the unit rises out of it
        p.scale.setScalar(u.sc * (0.2 + 0.8 * k));
        const riseT = 0.6, r = Math.max(0, (t - (u.land - riseT)) / riseT);
        if (r > 0) {
          if (!e.model.group.visible) { e.model.group.visible = true; e.model.group.scale.setScalar(e.scale); }
          e.model.group.position.set(e.pos.x, u.floor - 2.4 * e.scale * (1 - r * r), e.pos.z);
        }
      }
      if (t >= u.land) { // out and into the fight
        u.state = 'out'; u.outAt = t; u.done = true;
        for (const m of p.userData.glow) m.visible = true;
        _v.set(e.pos.x, u.floor + 0.2, e.pos.z);
        ringFx(_v, 2.8 * e.scale, col, 0.6); sparks(_v, col, 10, 6, 0.1, 0.5); sparks(_v.setY(u.floor + 0.3), 0xd0c8b0, 6, 4, 0.12, 0.5);
        p.position.y = u.kind === 'vent' ? u.floor + 0.05 : p.position.y;
        sfx.arrivalOut(e.pos, u.kind);
        land(e);
      }
    } else if (u.state === 'out') { // the prop closes: shrinks away over 0.6 s
      const f = Math.min(1, (t - u.outAt) / 0.6);
      if (u.kind !== 'vent') p.scale.setScalar(Math.max(0.01, u.sc * (1 - f)));
      p.visible = f < 1;
      if (f >= 1) { G.scene.remove(p); u.state = 'gone'; }
    }
    if (u.state !== 'gone') live = true;
  }
  return live;
}

const r1 = (v) => Math.round(v * 10) / 10;
/** Member side: the host's ship, drawn without a cargo (its units arrive through the normal spawn message when they land). */
export function showRemoteShip(m) {
  if (!BUILD_KINDS.includes(m.k) || !dropshipsOn() || !G.scene) return;
  const [f, h, o] = [m.f, m.h, m.o].map(([x, y, z]) => ({ x, y, z }));
  const mesh = buildShip(m.k);
  mesh.position.set(f.x, f.y, f.z);
  G.scene.add(mesh);
  sfx.shipIn(f, m.k);
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
  if (p.phase !== d.phase) { // U34 sound: the hover rumble and the climb-out roar play once each, at the ship
    d.phase = p.phase;
    if (p.phase === 'hover') sfx.shipHover(p, d.kind, d.tl.leaveStart - d.tl.arrive);
    else if (p.phase === 'out') sfx.shipOut(p, d.kind);
  }
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
        sfx.dropLand(e.pos);
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
      if (k >= 1) { u.landed = true; u.landedAt = d.t; ringFx(e.pos, 3 * e.scale, U.L.flash, 0.5); sparks(_v.copy(e.pos).setY(e.pos.y + 1), U.L.flash, 14, 7, 0.1, 0.5); sparks(_v.setY(e.pos.y + 0.6), U.L.col, 8, 4, 0.12, 0.5); land(e); u.done = true; sfx.gateOpen(e.pos, e.faction); }
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
    const keep = d.kind === 'teleport' ? stepGates(d, dt) : d.kind === 'indoor' ? stepIndoor(d, dt) : stepShip(d, dt);
    if (!keep) { removeDrop(d); drops.splice(i, 1); }
  }
}

export const dropshipCount = () => drops.length;
/** Dev and play-check: how many units took an indoor arrival, and how many fell back to the old spawn, since the page loaded. */
export const indoorStats = { played: 0, fallback: 0 };

/** Dev and tests: where each ship in the air is right now. */
export const dropshipPositions = () => drops.filter((d) => d.mesh && d.mesh.visible).map((d) => d.mesh.position.clone());
