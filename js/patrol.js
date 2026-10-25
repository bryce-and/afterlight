// U17a "Open Frontier": the patrol zone. A free-roam space on a destination (the map's `patrol` data: js/patrol-earth.js) with
// beacons that start small activities, public events with a heroic mechanic, ambient packs, and the Sparrow (js/sparrow.js).
// Like the Tower it runs as a mission-shaped shell (G.mission.patrol), so the player, HUD, camera and effects need no second code path.
// The host (or a solo player) runs beacons, events and camps; fireteam members follow through snapshots (coop.js).
import * as THREE from 'three';
import { G } from './state.js';
import * as ui from './ui.js';
import { LOCATIONS } from './data.js';
import { buildLevel } from './world.js';
import { buildNav } from './nav.js';
import { Player } from './player.js';
import { initEffects } from './effects.js';
import { playMusic, stinger } from './music.js';
import { sfx } from './audio.js';
import { cleanupMission, spawnUnit, findSpawn, banner, gainXp, dropEngram, livesFor } from './game.js';
import { playerPower, writeSave } from './save.js';
import { PATROL_TUNE, BEACON_TEXT, EVENT_SPECS, FACTION_KITS } from './patrol-data.js';
import { buildNpc, NPC_INFO } from './models-npc.js';
import { patrolMeetingsFor, metPatrolMeeting, offerPatrolQuests } from './quests.js';
import { PATROL_TALKS } from './story.js';
import { net } from './net.js';
import { onMissionStart, allPlayers, announcePatrolReward } from './coop.js';
import { clamp, rand } from './util.js';

export const inPatrol = () => !!G.mission?.patrol;

export { PATROL_TUNE };

// ---------------------------------------------------------------------------
// Start and leave
// ---------------------------------------------------------------------------
const patrolObjective = (def) => def.objective || 'Patrol the Cosmodrome';

export function startPatrol(li) {
  const loc = LOCATIONS[li], def = loc?.patrol;
  if (!def) throw new Error(`Destination ${loc?.id} has no patrol zone.`);
  cleanupMission();
  offerPatrolQuests(G.save, loc.id); // a destination's patrol quests are picked up the first time you roam it
  writeSave(G.save);
  const level = buildLevel(loc, def);
  G.level = level;
  G.scene = level.scene;
  G.colliders = level.colliders;
  G.staticMeshes = level.staticMeshes;
  G.nav = buildNav(G.colliders, level.bounds);
  G.hitDirty = true;
  G.scene.add(G.camera);
  initEffects(G.scene);
  G.enemies = []; G.projectiles = []; G.enemyShots = []; G.enemyGrenades = []; G.pickups = []; G.tickers = [];
  onMissionStart();
  const g = li * 3 + 1;
  const pp = playerPower(G.save), delta = clamp(pp - def.power, -40, 10);
  const fireteam = net.count();
  const hub = { center: level.spawn.clone(), name: loc.name, isBoss: false, idx: 0, state: 'active', waves: [], waveIdx: 0, enemies: [] };
  G.mission = {
    patrol: makePatrol(level, loc),
    loc, def, li, mi: -1, g, phase: 'patrol', current: 0, zones: [hub],
    fireteam, coop: net.active, remote: net.isClient, revives: 3, lives: net.active ? 99 : livesFor(fireteam), bossModel: def.boss.model, kills: 0, crits: 0, deaths: 0, loot: [],
    xp: 0, startTime: performance.now(), hpMult: 1 + g * 0.1, dmgMult: 1 + g * 0.07,
    playerDmgMult: Math.max(0.25, 1 + delta * 0.02), incomingMult: Math.max(0.6, 1 - delta * 0.025),
    checkpoint: level.spawn.clone(), objective: patrolObjective(def), waypoint: null, chest: null, failing: false, doneT: 0,
  };
  G.time = 0;
  G.player = new Player(G.save);
  G.player.spawn(level.spawn);
  G.player.yaw = Math.PI; // facing north, up the road
  G.state = 'playing';
  playMusic(loc.id);
  ui.enterMission();
  ensureUi();
  ui.centerMessage(def.name, `${loc.planetName}  ·  ${loc.name}`, 3.5);
  sfx.areaClear();
  ui.clearSubtitles();
  ui.feed('Tab: Ghost  ·  hold E to summon your Sparrow', '#7fe3ff');
}

/** Leaves the patrol for Orbit (the Ghost: hold O). */
export function leavePatrol() {
  ui.prompt(null);
  hideCard();
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
function makePatrol(level, loc) {
  const set = level.patrol;
  const mk = (kind, d, i) => ({ kind, def: d, zone: { center: new THREE.Vector3(d.x, level.groundAt ? level.groundAt(d.x, d.z) : 0, d.z), name: d.name || d.id || kind, isBoss: false, idx: i + 1, state: 'active', waves: [], waveIdx: 0, enemies: [] } });
  const beacons = set.beacons.map((b, i) => ({ ...mk('beacon', b, i), state: 'ready', t: 0, mesh: null, site: null, target: null }));
  const camps = set.camps.map((c, i) => ({ ...mk('camp', c, i), state: 'idle', t: 0 }));
  const events = { defs: set.events, cur: null, nextT: PATROL_TUNE.eventFirst, order: 0, done: 0 };
  const npcs = patrolMeetingsFor(G.save, loc.id).map((m) => ({ meeting: m, spot: set.npcs?.[m.npc], model: null, mark: null })).filter((n) => n.spot);
  return { set, loc, beacons, camps, events, npcs, buildT: 0 };
}

const countAlive = (z) => z.enemies.filter((e) => e.alive).length;
const nearestAlive = (z, p) => z.enemies.reduce((b, e) => (e.alive && (!b || e.pos.distanceTo(p) < b.pos.distanceTo(p)) ? e : b), null);
const playersNear = (x, z, r) => allPlayers().some((p) => !p.dead && Math.hypot(p.pos.x - x, p.pos.z - z) < r);
const engrams = (pos, n) => { for (let i = 0; i < n; i++) dropEngram(pos.clone().setY(pos.y + 1.2)); };
const xpFor = (kind, heroic) => Math.round((heroic ? PATROL_TUNE.xp.heroic : PATROL_TUNE.xp[kind]) * (1 + G.mission.g * 0.1));
/** Host: a reward for the whole fireteam; every machine rolls its own engrams (receivePatrolReward). */
function reward(pos, n, kind, heroic) {
  const xp = xpFor(kind, heroic);
  engrams(pos, n); gainXp(xp);
  announcePatrolReward(pos, n, xp);
}
export function receivePatrolReward(pos, n, xp) { engrams(pos, n); gainXp(xp); }

// ---- fireteam: the host's patrol state rides on the snapshot (coop.js), members only draw it ----
const BSTATE = { ready: 0, active: 1, done: 2 }, BNAME = ['ready', 'active', 'done'];
export function patrolSnapshot() {
  const Pt = G.mission.patrol, E = Pt.events.cur;
  return { b: Pt.beacons.map((b) => BSTATE[b.state]), ev: E && E.state !== 'done' ? [E.def.id, E.def.x, E.def.z, E.def.r, E.heroic ? 1 : 0] : 0 };
}
export function applyPatrolSnapshot(s) {
  const Pt = G.mission.patrol;
  s.b.forEach((v, i) => { if (Pt.beacons[i]) Pt.beacons[i].state = BNAME[v]; });
  const cur = Pt.remoteEvent;
  if (!s.ev) { if (cur) { removeEventMarker(cur); Pt.remoteEvent = null; } return; }
  if (cur && cur.def.id !== s.ev[0]) { removeEventMarker(cur); Pt.remoteEvent = null; }
  if (!Pt.remoteEvent) {
    const def = { id: s.ev[0], x: s.ev[1], z: s.ev[2], r: s.ev[3] };
    Pt.remoteEvent = { def, zone: { center: new THREE.Vector3(def.x, G.level.groundAt ? G.level.groundAt(def.x, def.z) : 0, def.z) } };
    eventMarker(Pt.remoteEvent);
  }
}
/** Pressed E for any player: the local one, or a member's key as the host heard it. */
const pressedE = (pl) => { if (pl === G.player) return G.input.pressed.KeyE; const v = pl.ihp; pl.ihp = false; return v; };

/** A pack of the destination's own units around (x, z): n units, a captain from 5 up, a heavy from 8. */
function spawnPack(zone, n, o = {}) {
  const M = G.mission, c = zone.center;
  const kinds = [];
  for (let i = 0; i < n; i++) kinds.push(i === 0 && n >= 5 ? 'captain' : i === 1 && n >= 8 ? 'heavy' : i % 3 === 2 ? 'rusher' : 'grunt');
  const kit = FACTION_KITS[o.f]; // U17b: a camp or beacon may name another faction (`f`), as on the Moon: Fallen in the colony, Hive in the caves
  const names = kit?.names ?? o.names;
  kinds.forEach((type) => {
    const pos = findSpawn(c, rand(0, Math.PI * 2), Math.PI, 2, o.spread ?? 9);
    spawnUnit(zone, type, pos, { faction: kit?.faction ?? o.faction, pal: kit?.pal, name: names?.[type], tier: o.tier });
  });
  G.hitDirty = true;
  return kinds.length;
}

// ---------------------------------------------------------------------------
// Per frame
// ---------------------------------------------------------------------------
export function updatePatrol(dt) {
  const M = G.mission, Pt = M.patrol, P = G.player;
  if (P.dead) { hideCard(); }
  buildVisualsOnce(Pt);
  if (M.remote) { updateBeaconVisuals(Pt, dt); updateCard(Pt); updateNpcs(Pt, dt); return; } // fireteam members follow the host
  updateCamps(Pt, dt);
  updateBeacons(Pt, dt);
  updateEvents(Pt, dt);
  updateBeaconVisuals(Pt, dt);
  updateCard(Pt);
  updateNpcs(Pt, dt);
  // what the HUD shows: an event first, then a beacon activity, then the default
  const E = Pt.events.cur;
  const act = Pt.beacons.find((b) => b.state === 'active');
  if (E && E.state !== 'done') { M.objective = E.objective; M.waypoint = E.waypoint; }
  else if (act) { M.objective = act.objective; M.waypoint = act.waypoint; }
  else {
    M.objective = Pt.events.nextT < PATROL_TUNE.eventWarn + 5 && Pt.events.cur == null ? 'A public event is about to begin' : patrolObjective(M.def);
    M.waypoint = null;
  }
}

// ---- ambient camps ----
function updateCamps(Pt, dt) {
  const P = G.player;
  for (const c of Pt.camps) {
    const d = Math.hypot(P.pos.x - c.def.x, P.pos.z - c.def.z);
    if (c.state === 'idle') {
      if (d < PATROL_TUNE.wake) { spawnPack(c.zone, c.def.n, { f: c.def.f }); c.state = 'live'; }
    } else if (c.state === 'live') {
      const alive = countAlive(c.zone);
      if (alive === 0) { c.state = 'cool'; c.t = PATROL_TUNE.campCooldown; c.zone.enemies = []; }
      else if (d > PATROL_TUNE.sleep && !playersNear(c.def.x, c.def.z, PATROL_TUNE.sleep) && c.zone.enemies.every((e) => !e.alive || e.pos.distanceTo(P.pos) > PATROL_TUNE.sleep * 0.8)) {
        for (const e of c.zone.enemies) if (e.alive) { e.alive = false; e.noDrops = true; e.dieT = 2; e.hp = 0; }
        c.zone.enemies = []; c.state = 'idle'; G.hitDirty = true;
      }
    } else if (c.state === 'cool') {
      c.t -= dt;
      if (c.t <= 0 && d > PATROL_TUNE.wake + 20) c.state = 'idle';
    }
  }
}

// ---- beacons ----
const BEACON_COLOR = { ready: 0x7fe3ff, active: 0xffa24a, done: 0x6b7480 };

function buildVisualsOnce(Pt) {
  if (Pt.visuals) return;
  Pt.visuals = true;
  for (const n of Pt.npcs) {
    n.model = buildNpc(n.meeting.npc);
    const y = G.level.groundAt ? G.level.groundAt(n.spot.x, n.spot.z) : 0;
    n.model.group.position.set(n.spot.x, y, n.spot.z);
    n.model.group.rotation.y = (n.spot.yaw || 0) + Math.PI; // the map's yaw 0 faces -z, the models face +z
    G.scene.add(n.model.group);
    n.mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xffd24d, fog: false }));
    n.mark.scale.y = 1.5;
    n.mark.position.set(n.spot.x, y + n.model.height + 0.6, n.spot.z);
    G.scene.add(n.mark);
  }
  for (const b of Pt.beacons) {
    const g = new THREE.Group();
    const col = BEACON_COLOR.ready;
    const mat = (o) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });
    // a waist-high pedestal: a base ring, a short post, a hovering gem and a faint column you can spot from a distance
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 6, 24), mat(0.9));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.72, 24), mat(0.22));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 6, 8, 1, true), mat(0.16));
    beam.position.y = 3.4;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), mat(0.95));
    gem.position.y = 1.2;
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), new THREE.MeshStandardMaterial({ color: 0x2d323c, flatShading: true }));
    pole.position.y = 0.43;
    g.add(ring, disc, beam, gem, pole);
    g.position.copy(b.zone.center);
    G.scene.add(g);
    b.mesh = { g, ring, disc, beam, gem };
  }
}

function setBeaconColor(b, state) {
  const hex = BEACON_COLOR[state];
  for (const k of ['ring', 'disc', 'beam', 'gem']) b.mesh[k].material.color.setHex(hex);
  b.mesh.beam.material.opacity = state === 'done' ? 0.04 : 0.16;
}

function updateBeaconVisuals(Pt, dt) {
  if (!Pt.visuals) return;
  for (const b of Pt.beacons) {
    if (!b.mesh) continue;
    b.mesh.gem.rotation.y += dt * 1.8;
    b.mesh.gem.position.y = 1.2 + Math.sin(G.time * 2) * 0.06;
    b.mesh.ring.scale.setScalar(1 + Math.sin(G.time * 3 + b.zone.idx) * 0.05);
    if (b.shown !== b.state) { b.shown = b.state; setBeaconColor(b, b.state); }
  }
}

function updateBeacons(Pt, dt) {
  const M = G.mission, P = G.player;
  for (const b of Pt.beacons) {
    if (b.state === 'done') {
      b.t -= dt;
      if (b.t <= 0) b.state = 'ready';
    } else if (b.state === 'ready') {
      if (!Pt.beacons.some((x) => x.state === 'active') && allPlayers().some((pl) => !pl.dead && Math.hypot(pl.pos.x - b.def.x, pl.pos.z - b.def.z) < PATROL_TUNE.beaconUse && pressedE(pl) && !(pl === P ? P.mount || P.ghostBusy : pl.state?.gm))) startBeacon(Pt, b);
    } else if (b.state === 'active') {
      tickBeacon(Pt, b);
    }
  }
}

function startBeacon(Pt, b) {
  const M = G.mission, site = new THREE.Vector3(b.def.site.x, 0, b.def.site.z);
  site.y = G.level.groundAt ? G.level.groundAt(site.x, site.z) : 0;
  b.state = 'active';
  b.site = { center: site, name: b.def.name, isBoss: false, idx: 100 + b.zone.idx, state: 'active', waves: [], waveIdx: 0, enemies: [] };
  b.target = null;
  if (b.def.type === 'hunt') {
    spawnPack(b.site, 4, { spread: 7, f: b.def.f });
    const pos = findSpawn(site, rand(0, Math.PI * 2), Math.PI, 1, 4);
    b.target = spawnUnit(b.site, b.def.target.unit, pos, { tier: 'major', name: b.def.target.name, faction: FACTION_KITS[b.def.f]?.faction, pal: FACTION_KITS[b.def.f]?.pal });
    b.objective = `Hunt ${b.def.target.name}`;
    banner(b.def.name, `Marked: ${b.def.target.name}`, 2.6, 'alert');
  } else {
    spawnPack(b.site, 7, { spread: 9, f: b.def.f });
    b.objective = `Clear ${b.def.name}`;
    banner(b.def.name, 'Wipe out the camp', 2.6, 'alert');
  }
  stinger('start');
  sfx.alert();
}

function tickBeacon(Pt, b) {
  const M = G.mission, P = G.player;
  const alive = countAlive(b.site);
  const tgt = b.def.type === 'hunt' ? b.target : null;
  b.objective = tgt?.alive ? `Hunt ${b.def.target.name}  ·  ${alive} hostile${alive === 1 ? '' : 's'}` : `Clear ${b.def.name}  ·  ${alive} hostile${alive === 1 ? '' : 's'}`;
  const near = nearestAlive(b.site, P.pos);
  b.waypoint = tgt?.alive ? tgt.pos : (alive > 0 && (alive <= 3 || P.pos.distanceTo(b.site.center) > 60) ? (near?.pos ?? b.site.center) : (alive > 0 ? null : null));
  if (alive === 0 || (b.def.type === 'hunt' && tgt && !tgt.alive && alive <= 1)) completeBeacon(Pt, b);
}

function completeBeacon(Pt, b) {
  for (const e of b.site.enemies) if (e.alive) { e.alive = false; e.noDrops = true; e.dieT = 2; e.hp = 0; }
  G.hitDirty = true;
  const pos = (b.target?.pos ?? b.site.center).clone();
  reward(pos, 1 + (b.def.type === 'hunt' ? 1 : 0), 'beacon', false);
  banner('Beacon Complete', b.def.name, 2.6, 'areaClear');
  stinger('clear');
  b.state = 'done'; b.t = PATROL_TUNE.beaconCooldown; b.site = null; b.target = null;
}

// ---- people: a meeting waits at a spot with a quest marker (quests.js PATROL_MEETINGS) ----
function updateNpcs(Pt, dt) {
  const P = G.player;
  let near = null;
  for (const n of Pt.npcs) {
    if (!n.model) continue;
    n.model.update(dt, G.time);
    const d = Math.hypot(P.pos.x - n.spot.x, P.pos.z - n.spot.z);
    const want = d < 10 ? Math.atan2(P.pos.x - n.spot.x, P.pos.z - n.spot.z) : (n.spot.yaw || 0) + Math.PI;
    const diff = ((want - n.model.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    n.model.group.rotation.y += diff * Math.min(1, dt * 3);
    n.mark.rotation.y += dt * 1.6;
    n.mark.position.y = n.model.group.position.y + n.model.height + 0.6 + Math.sin(G.time * 2.4) * 0.08;
    if (d < 3.4 && !P.dead && !P.mount && !P.ghostBusy) near = n;
  }
  if (near) {
    ui.prompt(`[E]  Talk to ${NPC_INFO[near.meeting.npc].name}`);
    if (G.input.pressed.KeyE) meet(Pt, near);
  } else if (Pt.npcPrompt) ui.prompt(null);
  Pt.npcPrompt = !!near;
}

function meet(Pt, n) {
  for (const [who, text] of PATROL_TALKS[n.meeting.id] || []) ui.say(who, text);
  if (metPatrolMeeting(G.save, n.meeting.id)) {
    writeSave(G.save);
    engrams(n.model.group.position.clone(), 1);
    gainXp(120);
    ui.centerMessage('Quest Complete', NPC_INFO[n.meeting.npc].name, 3);
    sfx.areaClear();
  }
  n.model.group.removeFromParent(); n.mark.removeFromParent();
  Pt.npcs = Pt.npcs.filter((x) => x !== n);
  ui.prompt(null);
}

// ---- the beacon card: a small box over the beacon when you are close ----
let card = null;
function ensureUi() {
  if (card && card.isConnected) return;
  card = document.createElement('div');
  card.id = 'beacon-card';
  card.className = 'hidden';
  card.innerHTML = '<div class="bc-type"></div><div class="bc-name"></div><div class="bc-blurb"></div><div class="bc-reward"></div><div class="bc-key"><kbd>E</kbd> Activate</div>';
  document.getElementById('hud').appendChild(card);
}
function hideCard() { if (card && !card.classList.contains('hidden')) card.classList.add('hidden'); }
const _p = new THREE.Vector3();
let cardFor = null;
function updateCard(Pt) {
  ensureUi();
  const P = G.player;
  if (P.dead || P.mount) { hideCard(); return; }
  let best = null, bd = PATROL_TUNE.beaconCard;
  for (const b of Pt.beacons) {
    const d = Math.hypot(P.pos.x - b.def.x, P.pos.z - b.def.z);
    if (d < bd && b.state !== 'done') { best = b; bd = d; }
  }
  if (!best) { hideCard(); return; }
  _p.set(best.def.x, best.zone.center.y + 1.9, best.def.z).project(G.camera);
  if (_p.z > 1 || _p.z < -1) { hideCard(); return; }
  const T = BEACON_TEXT[best.def.type];
  if (cardFor !== best.def.id || cardFor === null) {
    cardFor = best.def.id;
    card.querySelector('.bc-type').textContent = T.label;
    card.querySelector('.bc-name').textContent = best.def.name;
    card.querySelector('.bc-blurb').textContent = T.blurb;
    card.querySelector('.bc-reward').textContent = T.reward;
  }
  const act = best.state === 'active';
  card.classList.toggle('active', act);
  card.querySelector('.bc-key').innerHTML = act ? 'In progress' : bd < PATROL_TUNE.beaconUse ? '<kbd>E</kbd> Activate' : 'Move closer';
  card.style.left = `${(_p.x * 0.5 + 0.5) * 100}%`;
  card.style.top = `${(-_p.y * 0.5 + 0.5) * 100}%`;
  card.classList.remove('hidden');
}

// ---- public events ----
function updateEvents(Pt, dt) {
  const Ev = Pt.events, P = G.player, M = G.mission;
  if (!Ev.cur) {
    Ev.nextT -= dt;
    if (Ev.nextT <= 0) beginEvent(Pt);
    return;
  }
  const E = Ev.cur;
  E.t += dt;
  if (E.state === 'warn') {
    const left = Math.max(0, PATROL_TUNE.eventWarn - E.t);
    E.objective = `${E.spec.name} begins in ${Math.ceil(left)}s`;
    E.waypoint = E.zone.center;
    const inside = playersNear(E.def.x, E.def.z, E.def.r);
    if (left <= 0 || (inside && E.t > 4)) startEventAssault(Pt, E);
    return;
  }
  if (E.state === 'done') {
    E.fade -= dt;
    if (E.fade <= 0) { removeEventMarker(E); Ev.cur = null; Ev.nextT = PATROL_TUNE.eventGap; }
    return;
  }
  if (E.t > PATROL_TUNE.eventLimit + PATROL_TUNE.eventWarn) { failEvent(Pt, E); return; }
  tickEventAssault(Pt, E, dt);
}

function eventMarker(E) {
  const g = new THREE.Group();
  const mat = (o, hex) => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(E.def.r - 0.5, E.def.r, 56), mat(0.5, 0xffd35a));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(E.def.r, E.def.r, 7, 40, 1, true), mat(0.07, 0xffd35a));
  wall.position.y = 3.5;
  g.add(ring, wall);
  g.position.copy(E.zone.center);
  G.scene.add(g);
  E.marker = { g, ring, wall };
}
function removeEventMarker(E) { if (E.marker) { E.marker.g.removeFromParent(); E.marker = null; } }

function beginEvent(Pt) {
  const Ev = Pt.events, def = Ev.defs[Ev.order % Ev.defs.length];
  Ev.order++;
  const spec = EVENT_SPECS[def.id];
  const center = new THREE.Vector3(def.x, G.level.groundAt ? G.level.groundAt(def.x, def.z) : 0, def.z);
  const zone = { center, name: spec.name, isBoss: false, idx: 200 + Ev.order, state: 'active', waves: [], waveIdx: 0, enemies: [] };
  Ev.cur = { def, spec, zone, state: 'warn', t: 0, heroic: false, phase: 0, objective: '', waypoint: center, marked: [], markedT: 0, push: 0, finale: false, fade: 0, kills0: 0 };
  eventMarker(Ev.cur);
  banner(`Public Event: ${spec.name}`, spec.blurb, 3.2, 'alert');
  stinger('start');
}

function startEventAssault(Pt, E) {
  E.state = 'active'; E.t = 0; E.phase = 0;
  spawnEventPush(E, 0);
  // the marked targets: kill them all inside the window and the event turns Heroic
  const m = E.spec.marked;
  for (let i = 0; i < m.n; i++) {
    const a = (i / m.n) * Math.PI * 2 + rand(-0.4, 0.4), pos = findSpawn(E.zone.center, a, 0.2, E.def.r * 0.45, E.def.r * 0.8);
    E.marked.push(spawnUnit(E.zone, m.unit, pos, { tier: 'major', name: m.n > 1 ? `${m.name}` : m.name, faction: E.spec.faction ?? undefined, pal: E.spec.palette }));
  }
  E.markedT = m.time;
  banner(E.spec.name, `${m.text} within ${m.time}s for Heroic`, 3, 'alert');
  sfx.alert();
}

function spawnEventPush(E, i) {
  const push = E.spec.pushes[i];
  for (const [type, n] of push) for (let k = 0; k < n; k++) {
    const pos = findSpawn(E.zone.center, rand(0, Math.PI * 2), Math.PI, E.def.r * 0.4, E.def.r * 0.95);
    spawnUnit(E.zone, type, pos, { faction: E.spec.faction ?? undefined, name: E.spec.names?.[type], pal: E.spec.palette });
  }
  G.hitDirty = true;
}

function tickEventAssault(Pt, E, dt) {
  const P = G.player;
  const alive = countAlive(E.zone);
  const markedAlive = E.marked.filter((e) => e.alive).length;
  if (E.markedT > 0 && !E.heroic) {
    E.markedT -= dt;
    if (markedAlive === 0 && E.marked.length) {
      E.heroic = true; E.markedT = 0;
      banner('Heroic', `${E.spec.name} escalates`, 2.8, 'bossIntro');
      stinger('boss');
      spawnEventPush(E, Math.min(1, E.spec.pushes.length - 1));
    } else if (E.markedT <= 0) { E.markedT = -1; ui.feed('The window to turn this event Heroic has closed', '#9aa4b2'); }
  }
  let text = `${E.spec.name}${E.heroic ? '  ·  Heroic' : ''}  ·  ${alive} hostile${alive === 1 ? '' : 's'}`;
  if (E.markedT > 0 && !E.heroic) text = `${E.spec.marked.text}: ${markedAlive} left  ·  ${Math.ceil(E.markedT)}s  ·  ${alive} hostiles`;
  E.objective = text;
  const near = nearestAlive(E.zone, P.pos);
  const markedTarget = E.markedT > 0 && !E.heroic ? E.marked.find((e) => e.alive) : null;
  E.waypoint = markedTarget ? markedTarget.pos : (alive > 0 && alive <= 3 ? near.pos : E.zone.center);
  if (!E.finale && E.push === 0 && alive <= 2) { E.push = 1; spawnEventPush(E, 1); banner(E.spec.name, 'Reinforcements', 2, 'alert'); sfx.alert(); }
  else if (!E.finale && E.push === 1 && alive <= 2) {
    E.finale = true;
    const f = E.spec.finale, n = E.heroic ? f.heroicN : f.n;
    for (let i = 0; i < n; i++) spawnUnit(E.zone, f.unit, findSpawn(E.zone.center, rand(0, Math.PI * 2), Math.PI, 3, 9), { tier: 'major', name: f.name, faction: E.spec.faction ?? undefined, pal: E.spec.palette });
    banner(f.name, 'Finish the event', 2.6, 'bossIntro');
    stinger('boss');
  } else if (E.finale && alive === 0) completeEvent(Pt, E);
}

function completeEvent(Pt, E) {
  E.state = 'done'; E.fade = 6;
  const pos = E.zone.center.clone();
  reward(pos, E.heroic ? 4 : 2, 'event', E.heroic);
  Pt.events.done++;
  E.objective = `${E.spec.name} complete`; E.waypoint = null;
  banner(E.heroic ? 'Heroic Event Complete' : 'Event Complete', E.spec.name, 3, 'areaClear');
  stinger('complete');
}

function failEvent(Pt, E) {
  for (const e of E.zone.enemies) if (e.alive) { e.alive = false; e.noDrops = true; e.dieT = 2; e.hp = 0; }
  G.hitDirty = true;
  E.state = 'done'; E.fade = 2;
  banner('Event Failed', E.spec.name, 2.6, 'alert');
}
