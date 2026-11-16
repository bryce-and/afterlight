// U25 Crucible: the match runtime (Control on Bannerfall) and the PvP damage hooks game.js calls behind `G.mission.pvp`.
// The rules are pure and live in js/pvp.js; this file wires them to the scene, the player and the AI Guardians (js/guardian-ai.js).
import * as THREE from 'three';
import { G, unlockPointer } from './state.js';
import { LOCATIONS } from './data.js';
import { buildLevel } from './world.js';
import { Player } from './player.js';
import { buildNav } from './nav.js';
import { initEffects, sparks } from './effects.js';
import { sfx } from './audio.js';
import * as ui from './ui.js';
import { playMusic } from './music.js';
import { playerPower, playerLevel, writeSave } from './save.js';
import { armorBand } from './campaign.js';
import { onMissionStart, launchCrucible } from './coop.js';
import { net, broadcast } from './net.js';
import { classKit } from './data.js';
import { decodeAppearance } from './style.js';
import {
  CONTROL, CRATES, CRUCIBLE_MODES, CRUCIBLE_REWARD, DUEL, GUARDIAN_AI, PVP_WEAPONS, modeOf, buildRoster, roundOnClock, pvpHurts, killPoints, zoneStep, zonesHeld, controlResult,
  startLoad, gamerTags, heavyCrateAmount, specialCrateAmount, abilityDamage, weaponDamage, killDamage,
} from './pvp.js';
import { BANNERFALL } from './level-bannerfall.js';
import { Guardian } from './guardian-ai.js';
import { crSendDeath, crRequestCrate } from './crucible-net.js';
import { showCrucibleHud, updateCrucibleHud, hideCrucibleHud, showCrucibleEnd } from './crucible-hud.js';
import { cleanupMission, abandonMission, gainXp, grantItem } from './game.js';
import { makeCrucibleDrop } from './crucible-loot.js';

const TEAM_HEX = { blue: 0x6ec8ff, red: 0xff6a5a };
const FOE = { blue: 'red', red: 'blue' };

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const meId = () => (net.active ? net.myId : 'me');
const spawnAt = (team, slot) => BANNERFALL.spawns[team][slot % BANNERFALL.spawns[team].length];
const faceYaw = (team) => (team === 'blue' ? -Math.PI / 2 : Math.PI / 2); // toward the middle of the map

/**
 * Launches a Crucible match. `opts`: { roster (a networked match: the host's roster), spectate (no human fights: an AI vs AI match, for the
 * headless check), time (seconds), scoreLimit }. Control is 6v6, Duel 1v1: humans take slots first, AI Guardians fill the rest. On the host
 * and in solo the AI Guardians run here; on a client they are bodies the host's snapshots drive (see js/crucible-net.js).
 */
export function startCrucible(modeId = 'control', opts = {}) {
  const mode = modeOf(modeId);
  if (!mode) throw new Error(`Unknown Crucible mode ${modeId}`);
  cleanupMission();
  onMissionStart();
  const base = LOCATIONS[0]; // Earth supplies the light and sky; Bannerfall is a Crucible map, not a campaign mission
  const def = { id: mode.map, name: 'Bannerfall', mood: 'day', power: playerPower(G.save), boss: { name: '', element: 'arc' } };
  const level = buildLevel(base, def);
  G.level = level; G.scene = level.scene; G.colliders = level.colliders; G.staticMeshes = level.staticMeshes;
  G.nav = buildNav(G.colliders, level.bounds);
  G.hitDirty = true;
  G.scene.add(G.camera);
  initEffects(G.scene);
  G.enemies = []; G.projectiles = []; G.enemyShots = []; G.enemyGrenades = []; G.pickups = []; G.tickers = [];
  const myId = meId();
  const members = opts.spectate ? [] : net.active ? net.members : [{ id: 'me', name: G.save.settings.name || 'You', cls: G.save.classId, team: 'blue' }];
  const roster = opts.roster || buildRoster(members, modeId);
  const mine = opts.spectate ? null : roster.slots.find((x) => x.human && x.gid === myId) || null;
  const team = mine?.team || 'blue', duel = modeId === 'duel';
  const C = {
    mode, roster, me: { id: myId, team }, duel: duel ? { round: 1, phase: 'live', t: DUEL.roundTime } : null,
    score: { red: 0, blue: 0 }, timeLeft: opts.time ?? (duel ? DUEL.roundTime : CONTROL.time), scoreLimit: opts.scoreLimit ?? (duel ? DUEL.toWin : CONTROL.scoreLimit),
    zones: duel ? [] : BANNERFALL.zones.map((z) => ({ ...z, owner: null, prog: 0, red: 0, blue: 0 })), crates: [], feed: [], over: false, winner: null, spectate: !!opts.spectate,
    ringMeshes: [], zoneEvents: [], stats: { kills: 0, deaths: 0 }, fighters: new Map(), ident: new Map(), guardians: [],
  };
  const sp = spawnAt(team, mine?.slot ?? 0);
  G.mission = {
    pvp: true, team, crucible: C, spectate: !!opts.spectate, mode: modeId,
    loc: { ...base, name: 'The Last City', planetName: 'Earth' }, def: { ...def, name: `Bannerfall  ·  ${mode.name}` }, li: 0, mi: 0, g: 0, power: def.power,
    fireteam: 1, coop: false, remote: false, phase: 'combat', current: 0, revives: 0, lives: 0, kills: 0, crits: 0, deaths: 0, loot: [],
    hpMult: 1, dmgMult: 1, playerDmgMult: 1, incomingMult: 1, tier: 'base', lethal: false, blitz: null,
    startTime: performance.now(), objective: duel ? 'Win the round' : 'Take and hold zones', waypoint: null, chest: null, failing: false, doneT: 0, zones: [],
    checkpoint: new THREE.Vector3(sp[0], 0, sp[1]),
  };
  G.time = 0;
  G.player = new Player(G.save);
  const P = G.player;
  P.team = team;
  P.spawn(M().checkpoint);
  P.yaw = faceYaw(team);
  applyLoadout(P);
  G.state = 'playing';
  playMusic(base.id);
  ui.enterMission();
  buildZoneVisuals();
  buildCrates();
  buildFighters(roster, C, myId);
  if (opts.spectate) { P.pos.set(0, 0, 41); P.yaw = 0; P.pitch = -0.2; P.viewmodel.visible = false; } // an AI vs AI match: the human only watches
  showCrucibleHud(G.mission);
  ui.centerMessage(mode.name, duel ? `Bannerfall  ·  First to ${DUEL.toWin}` : 'Bannerfall  ·  Hold the zones', 3.2);
  sfx.areaClear();
}
const M = () => G.mission;

const register = (C, g) => { C.fighters.set(g.gid, g); C.guardians.push(g); };
/** The AI Guardians (a real AI on the host and in solo, a puppet on a client). A human's body is built when their first row arrives. */
function buildFighters(roster, C, myId) {
  for (const s of roster.slots) {
    if (s.human) continue;
    const [sx, sz] = spawnAt(s.team, s.slot);
    register(C, new Guardian({
      team: s.team, slot: s.slot, name: s.name, classId: s.cls, element: s.el, arch: s.arch, special: s.special, pos: new THREE.Vector3(sx, 0, sz),
      gid: s.gid, puppet: net.isClient,
    }));
  }
  void myId;
}
/** A human's body for the others' screens: made from the identity their client sends (class, subclass, look, weapon). */
export function ensurePuppet(id, ident) {
  const C = M()?.crucible;
  if (!C) return null;
  if (C.fighters.has(id)) return C.fighters.get(id);
  const s = C.roster.slots.find((x) => x.human && x.gid === id);
  if (!s) return null; // not in this match
  const cls = ident.c || s.cls, [arch] = (ident.w || '').split('|');
  const [sx, sz] = spawnAt(s.team, s.slot);
  const g = new Guardian({
    team: s.team, slot: s.slot, name: s.name, classId: cls, element: classKit(cls, ident.sc).element, arch: arch || 'auto', pos: new THREE.Vector3(sx, 0, sz),
    gid: id, humanId: id, puppet: true, look: decodeAppearance(ident.lk),
  });
  g.setGunKey(ident.w);
  register(C, g);
  return g;
}
/** A human left: drop their body. */
export function removeFighter(id) {
  const C = M()?.crucible, g = C?.fighters.get(id);
  if (!g) return;
  g.alive = false; g.group.visible = false; g.remove();
  const i = G.enemies.indexOf(g); if (i >= 0) G.enemies.splice(i, 1);
  C.guardians = C.guardians.filter((x) => x !== g); C.fighters.delete(id);
  G.hitDirty = true;
}

/** The match loadout rule: every life starts with the start ammo (js/pvp.js); primaries keep a full magazine. */
export function applyLoadout(P) {
  for (const w of P.weapons) {
    const L = startLoad(w.A.id, w.item.slot, w.mag);
    w.ammo = L.ammo; w.reserve = L.reserve; if (w.reserve !== Infinity) w.maxReserve = Math.max(w.maxReserve, w.mag * 3);
    w.reloading = false; w.burstLeft = 0;
  }
}

// ---------------------------------------------------------------------------
// Zones and crates: scene objects
// ---------------------------------------------------------------------------
function buildZoneVisuals() {
  const C = M().crucible;
  for (const z of C.zones) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(CONTROL.radius - 0.45, CONTROL.radius, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.85, fog: false }));
    ring.position.set(z.x, 0.08, z.z);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(CONTROL.radius - 0.5, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.14, fog: false, depthWrite: false }));
    disc.position.set(z.x, 0.07, z.z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 22, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.35, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.set(z.x, 11, z.z);
    G.scene.add(ring, disc, beam);
    z.mesh = { ring, disc, beam };
  }
}
function paintZones() {
  for (const z of M().crucible.zones) {
    const col = z.owner ? TEAM_HEX[z.owner] : z.prog < 0 ? TEAM_HEX.red : z.prog > 0 ? TEAM_HEX.blue : 0xdddddd;
    const k = z.owner ? 1 : Math.abs(z.prog);
    const c = new THREE.Color(0xdddddd).lerp(new THREE.Color(col), 0.25 + 0.75 * k);
    z.mesh.ring.material.color.copy(c); z.mesh.disc.material.color.copy(c); z.mesh.beam.material.color.copy(c);
  }
}

const crateGeo = () => new THREE.BoxGeometry(1, 0.8, 1);
function buildCrates() {
  const C = M().crucible, mk = (type, x, z) => {
    const col = type === 'heavy' ? 0xb36cff : 0xf2d24a;
    const m = new THREE.Mesh(crateGeo(), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, flatShading: true }));
    m.scale.setScalar(type === 'heavy' ? 1.5 : 1.1); m.position.set(x, 0.9, z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.set(x, 3, z);
    G.scene.add(m, beam);
    const t0 = type === 'heavy' ? CRATES.heavyFirst : CRATES.specialFirst + C.crates.length * 3;
    C.crates.push({ type, x, z, ready: false, t: t0, t0, mesh: m, beam, reqT: 0 });
    m.visible = beam.visible = false;
  };
  mk('heavy', BANNERFALL.heavyCrate.x, BANNERFALL.heavyCrate.z);
  for (const c of BANNERFALL.specialCrates) mk('special', c.x, c.z);
}
/** A crate shows (ready) or hides (taken). On a client this follows the host's snapshot. */
export function crateReadyState(c, ready) {
  if (c.ready === ready) return;
  c.ready = ready; c.mesh.visible = c.beam.visible = ready;
  if (ready && c.type === 'heavy') feed('Heavy ammo is up at the Plaza', '#b36cff');
}
/** Host and solo: a crate was taken; it comes back after its timer. */
export function crateConsumed(c) { c.ready = false; c.mesh.visible = c.beam.visible = false; c.t = c.type === 'heavy' ? CRATES.heavyEvery : CRATES.specialEvery; }
/** A Duel round starts over: every crate goes back to its first timer. */
function resetCrates() { for (const c of M().crucible.crates) { c.ready = false; c.mesh.visible = c.beam.visible = false; c.t = c.t0; } }

/** Tops up weapon `w` by `n` rounds: magazine first, then reserve up to its cap. Returns the rounds actually added. */
function topUp(w, n) {
  const room = w.mag - w.ammo, a = Math.min(room, n);
  w.ammo += a;
  let left = n - a, b = 0;
  if (w.reserve !== Infinity) { b = Math.min(left, Math.max(0, w.maxReserve - w.reserve)); w.reserve += b; }
  return a + b;
}
const crateWeapon = (crate, P) => P.weapons.find((x) => x.item.slot === (crate.type === 'heavy' ? 'heavy' : 'special'));
/** Would this crate give the local player anything (a weapon in its slot with room)? */
function crateUseful(crate, P) {
  const w = crateWeapon(crate, P);
  return !!w && (w.mag - w.ammo > 0 || (w.reserve !== Infinity && w.maxReserve - w.reserve > 0));
}
function crateTake(crate, who) {
  if (!who) return false;
  if (who === G.player) {
    const P = G.player, w = crateWeapon(crate, P);
    if (!w) return false;
    const n = crate.type === 'heavy' ? heavyCrateAmount(w.A.id, w.mag) : specialCrateAmount(w.brick || 1);
    if (!topUp(w, n)) return false;
    ui.feed(`${crate.type === 'heavy' ? 'Heavy' : 'Special'} ammo  ·  ${w.item.name}`, crate.type === 'heavy' ? '#b36cff' : '#f2d24a');
    sfx.engram?.(1);
    return true;
  }
  if (crate.type === 'heavy' || !who.special) return false; // AI Guardians carry no heavy weapon
  const w = who.special, cap = w.A.mag * 2;
  if (w.ammo + w.reserve >= cap) return false;
  w.reserve += specialCrateAmount(w.A.brick || 1);
  return true;
}
/** A client's crate request was granted by the host: top up here. */
export function takeCrateLocal(crate) { if (crate) crateTake(crate, G.player); }
function updateCrates(dt) {
  const C = M().crucible, P = G.player, auth = !net.isClient;
  for (const c of C.crates) {
    if (!c.ready) {
      if (auth) { c.t -= dt; if (c.t <= 0) crateReadyState(c, true); }
      continue;
    }
    c.mesh.rotation.y += dt * 1.5; c.mesh.position.y = 0.9 + Math.sin(G.time * 2 + c.x) * 0.15;
    const near = P && !P.dead && !C.spectate && Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < CRATES.pickupR;
    if (auth) {
      let took = false;
      if (near && crateTake(c, P)) took = true;
      else for (const g of C.guardians) if (!g.puppet && g.alive && Math.hypot(g.pos.x - c.x, g.pos.z - c.z) < CRATES.pickupR && crateTake(c, g)) { took = true; break; }
      if (took) { crateConsumed(c); if (net.isHost) { /* clients see it vanish in the next snapshot */ } }
    } else if (near && G.time > c.reqT && crateUseful(c, P)) { c.reqT = G.time + 0.6; crRequestCrate(C.crates.indexOf(c)); }
  }
}

// ---------------------------------------------------------------------------
// The match
// ---------------------------------------------------------------------------
export function updateCrucible(dt) {
  const Mi = G.mission, C = Mi.crucible, P = G.player, auth = !net.isClient;
  if (C.over) return;
  if (C.duel) {
    const D = C.duel;
    D.t -= dt;
    if (auth) {
      C.timeLeft = D.phase === 'live' ? D.t : DUEL.roundTime;
      if (D.phase === 'between' && D.t <= 0) startRound();
      else if (D.phase === 'live' && D.t <= 0) duelRoundEnd(roundOnClock(teamPools()));
    }
  } else C.timeLeft = Math.max(0, C.timeLeft - dt); // a client's clock is re-synced by every snapshot
  if (auth) {
    // zones: who stands in each ring (puppets count: a human's body is where their client says)
    for (const z of C.zones) {
      z.red = 0; z.blue = 0;
      for (const g of C.guardians) if (g.alive && Math.hypot(g.pos.x - z.x, g.pos.z - z.z) < CONTROL.radius) z[g.team]++;
      if (P && !P.dead && !C.spectate && Math.hypot(P.pos.x - z.x, P.pos.z - z.z) < CONTROL.radius) z[Mi.team]++;
      const was = z.owner;
      zoneStep(z, z.red, z.blue, dt);
      if (z.owner !== was && z.owner) { feed(`${z.owner === Mi.team ? 'Your team' : 'The enemy'} captured ${z.name}`, z.owner === 'blue' ? '#6ec8ff' : '#ff6a5a'); sfx.areaClear?.(); }
      else if (z.owner !== was && !z.owner) feed(`${z.name} is neutral`, '#dddddd');
    }
    // AI respawns (a Duel brings everyone back together at the next round instead)
    if (!C.duel) for (const g of C.guardians) {
      if (g.alive || g.puppet) continue;
      g.respawnT -= dt;
      if (g.respawnT <= 0) { const [x, z] = pickSpawn(g.team, g); g.spawn(new THREE.Vector3(x, 0, z)); }
    }
  }
  paintZones();
  updateCrates(dt);
  // objective line
  if (C.duel) Mi.objective = `Round ${C.duel.round}  ·  ${C.score.blue} to ${C.score.red}  ·  first to ${DUEL.toWin}`;
  else { const held = zonesHeld(C.zones, Mi.team); Mi.objective = `Hold zones  ·  ${held} of ${CONTROL.zones} held  ·  kills +${killPoints(held)}`; }
  updateCrucibleHud(Mi);
  if (!auth) return; // the host announces the end ('pve')
  if (C.duel) { if (C.score.blue >= DUEL.toWin || C.score.red >= DUEL.toWin) endMatch(C.score.blue > C.score.red ? 'blue' : 'red'); return; }
  const r = controlResult(C.score, C.timeLeft, { ...CONTROL, scoreLimit: C.scoreLimit });
  if (r.over) endMatch(r.winner);
}

// ---------------------------------------------------------------------------
// Duel rounds (host and solo run them; a client follows the snapshot)
// ---------------------------------------------------------------------------
/** Each team's remaining health pool (for the clock rule). */
function teamPools() {
  const C = M().crucible, P = G.player, out = { blue: 0, red: 0 };
  for (const g of C.guardians) if (g.alive) out[g.team] += g.hp + g.shield;
  if (P && !P.dead && !C.spectate) out[M().team] += P.health + P.shield;
  return out;
}
export function roundBanner(winner, n) {
  const Mi = G.mission;
  if (Mi.spectate) return;
  ui.centerMessage(!winner ? `Round ${n}: draw` : winner === Mi.team ? `Round ${n}: won` : `Round ${n}: lost`, `${Mi.crucible.score.blue} to ${Mi.crucible.score.red}`, 2.4);
}
function duelRoundEnd(team) {
  const C = M().crucible, D = C.duel;
  if (!D || D.phase !== 'live' || C.over) return;
  D.phase = 'between'; D.t = DUEL.between;
  if (team) C.score[team]++;
  if (net.isHost) broadcast({ t: 'pvrd', w: team, n: D.round, sc: [C.score.blue, C.score.red] });
  roundBanner(team, D.round);
}
function startRound() {
  const C = M().crucible, D = C.duel;
  D.round++; D.phase = 'live'; D.t = DUEL.roundTime;
  resetCrates();
  for (const g of C.guardians) if (!g.puppet) { const [x, z] = spawnAt(g.team, 0); g.spawn(new THREE.Vector3(x, 0, z)); }
  resetLocalRound();
}
/** Every machine at a new Duel round: back at the base spawn with full health and the start ammo. */
export function resetLocalRound() {
  const Mi = G.mission, C = Mi?.crucible, P = G.player;
  if (!C || C.spectate || !P) return;
  const sp = spawnAt(Mi.team, 0);
  Mi.checkpoint.set(sp[0], 0, sp[1]);
  if (P.dead) P.respawn();
  else { P.health = P.maxHealth; P.shield = P.maxShield; P.pos.copy(Mi.checkpoint); P.vel.set(0, 0, 0); applyLoadout(P); }
  P.yaw = faceYaw(Mi.team);
  ui.hideDeath();
}

function feed(text, color) { if (!M().crucible.spectate) ui.feed(text, color); }

/** The spawn point farthest from foes among the team's points (so a respawn does not land on someone). */
function pickSpawn(team, who) {
  if (G.mission.crucible.duel) return spawnAt(team, 0); // a Duel always starts at the base
  const pts = BANNERFALL.spawns[team], foes = foesOf({ team });
  let best = pts[0], bd = -1;
  for (const p of pts) {
    let d = Infinity;
    for (const f of foes) d = Math.min(d, Math.hypot(f.pos.x - p[0], f.pos.z - p[1]));
    d += Math.random() * 3;
    if (d > bd) { bd = d; best = p; }
  }
  void who;
  return best;
}

/** Everyone on the other team than `g.team` who can be hurt right now. */
export function foesOf(g) {
  const out = [], C = G.mission?.crucible;
  if (!C) return out;
  for (const o of C.guardians) if (o.alive && o.team !== g.team) out.push(o);
  const P = G.player;
  if (P && !P.dead && !C.spectate && P.team !== g.team) out.push(P);
  return out;
}

/** Which zone an AI Guardian heads for: the ones its team does not hold first, spread over the team by slot, then the nearest. */
export function aiGoal(g) {
  const C = G.mission.crucible;
  if (C.duel) { const f = foesOf(g)[0]; return f ? { x: f.pos.x, z: f.pos.z, r: 8 } : { x: 0, z: 0, r: 6 }; } // a Duelist walks at the foe
  const pref = g.slot % CONTROL.zones;
  let best = null, bs = Infinity;
  C.zones.forEach((z, i) => {
    const owned = z.owner === g.team;
    const lean = ((i - pref + CONTROL.zones) % CONTROL.zones) * 1.6;
    const s = (owned ? 5 : 0) + lean + Math.hypot(z.x - g.pos.x, z.z - g.pos.z) / 35 + Math.random() * 1.2 + (z.owner === FOE[g.team] ? -1 : 0);
    if (s < bs) { bs = s; best = z; }
  });
  return best ? { x: best.x, z: best.z, r: 3.5 } : null;
}
/** The nearest ready special crate (an AI Guardian out of special ammo goes for one when it is close). */
export function crateGoal(g) {
  const C = G.mission.crucible;
  let best = null, bd = 38;
  for (const c of C.crates) if (c.type === 'special' && c.ready) { const d = Math.hypot(c.x - g.pos.x, c.z - g.pos.z); if (d < bd) { bd = d; best = c; } }
  return best ? { x: best.x, z: best.z, r: 1 } : null;
}

// ---------------------------------------------------------------------------
// Kills and score (the host and solo score; a client only mirrors, see js/crucible-net.js)
// ---------------------------------------------------------------------------
function score(team, pts) { M().crucible.score[team] += pts; }
function killLine(killer, victim, kteam, vteam, pts) {
  const C = M().crucible;
  C.feed.push({ t: G.time, killer, victim, kteam, vteam, pts });
  if (C.feed.length > 6) C.feed.shift();
}
/** Who someone is on the wire and in the feed: { id, name, team, human }. */
export const descOf = (g) => ({ id: g.gid, name: g.name, team: g.team, human: !!g.humanId });
export const localDesc = () => ({ id: M().crucible.me.id, name: G.save.settings.name || 'You', team: M().team, human: true });

/** The local player scored a kill. `fromNet`: a human was killed on the host's say-so, so the hit marker and sound come from here. */
export function localKill(fromNet = false) {
  const Mi = G.mission, C = Mi.crucible, P = G.player;
  Mi.kills++; C.stats.kills++;
  if (P && !P.superActive) P.superCharge = Math.min(100, P.superCharge + 4);
  if (fromNet) ui.hitmarker(false, true);
  sfx.kill?.();
}

/** Host and solo: `k` killed `v` ({ id, name, team }). Scores it, tells everyone, and ends a Duel round. */
export function recordKill(v, k) {
  const Mi = G.mission, C = Mi?.crucible;
  if (!C || C.over || net.isClient) return;
  if (C.duel && C.duel.phase !== 'live') return; // the break between rounds: nothing scores
  const pts = C.duel ? 1 : killPoints(zonesHeld(C.zones, k.team));
  if (!C.duel) score(k.team, pts);
  killLine(k.name, v.name, k.team, v.team, pts);
  if (net.isHost) broadcast({ t: 'pvk', k: k.name, v: v.name, kt: k.team, vt: v.team, pts, kid: k.id, vid: v.id });
  if (k.id && k.id === C.me.id && !C.spectate) localKill(!!v.human && v.id !== C.me.id);
  if (C.duel) duelRoundEnd(k.team);
}

/** An AI Guardian died (host and solo only: a puppet never dies here). `attacker`: the killing Guardian, a human's body, or null for the local player. */
export function onGuardianDeath(g, attacker) {
  const C = G.mission?.crucible;
  if (!C || C.over) return;
  if (attacker && !attacker.puppet) attacker.kills++;
  recordKill(descOf(g), attacker ? descOf(attacker) : localDesc());
}

/** The local player died to `attacker` (a Guardian or a human's body), or to the map. */
export function onPlayerDeath(attacker) {
  const Mi = G.mission, C = Mi.crucible;
  if (!C || C.over) return;
  C.stats.deaths++;
  if (net.isClient) crSendDeath(attacker ? attacker.gid : null); // the host scores it
  else {
    if (attacker && !attacker.puppet) attacker.kills++;
    recordKill(localDesc(), attacker ? descOf(attacker) : { id: null, name: 'The map', team: FOE[Mi.team] });
  }
  ui.showDeath('Eliminated', attacker ? `by ${attacker.name}` : '');
}

/** Called from Player.respawn in a PvP match: a team spawn away from foes, and the start ammo again. */
export function pvpRespawnPrep(P) {
  const Mi = G.mission, [x, z] = pickSpawn(Mi.team, null);
  Mi.checkpoint.set(x, 0, z);
  applyLoadout(P);
  P.over = 0;
}

export function endMatch(winner) {
  const Mi = G.mission, C = Mi.crucible;
  if (C.over) return;
  C.over = true; C.winner = winner; Mi.phase = 'done';
  if (net.isHost) broadcast({ t: 'pve', w: winner, sc: [C.score.blue, C.score.red] });
  const won = winner === Mi.team;
  let item = null;
  if (!C.spectate) {
    gainXp(won ? CRUCIBLE_REWARD.xpWin : CRUCIBLE_REWARD.xpLoss);
    item = makeCrucibleDrop(playerPower(G.save), G.save.classId, Math.random, armorBand(G.save)); // U25 chunk C: the Crucible pool; endMatch runs once (C.over)
    grantItem(item);
    writeSave(G.save);
  }
  G.state = 'complete';
  unlockPointer();
  ui.hideDeath();
  const again = net.isClient ? null : net.isHost ? () => launchCrucible(Mi.mode) : () => startCrucible(Mi.mode, { spectate: C.spectate });
  showCrucibleEnd(Mi, { won, winner, item, xp: won ? CRUCIBLE_REWARD.xpWin : CRUCIBLE_REWARD.xpLoss }, { again, orbit: () => abandonMission() });
}

/** Called by game.js cleanupMission. */
export function cleanupCrucible() {
  hideCrucibleHud();
}

// ---------------------------------------------------------------------------
// PvP damage hooks (game.js, behind G.mission.pvp)
// ---------------------------------------------------------------------------
/** Damage to the local player from a Guardian (or the environment). The numbers are already PvP numbers. */
export function pvpDamagePlayer(amount, o = {}) {
  const P = G.player, Mi = G.mission;
  if (!P || P.dead || Mi.spectate || Mi.phase === 'done' || Mi.crucible?.duel?.phase === 'between') return;
  const att = o.attacker || null;
  if (att && !pvpHurts(Mi, att.team, P.team)) return;
  P.lastAttacker = att;
  const d = o.oneHit ? killDamage(P.health + P.shield + P.over) : amount;
  P.takeDamage(d, o.from);
}

/** Every hit on a Guardian lands here (game.js dealDamage hands it over before any PvE number is applied). */
export function pvpDealDamage(e, amount, o = {}) {
  const Mi = G.mission;
  if (!e.alive || !Mi?.pvp) return { killed: false, dealt: 0 };
  const att = o.attacker || null, aTeam = att ? att.team : Mi.team;
  if (!pvpHurts(Mi, aTeam, e.team)) return { killed: false, dealt: 0 };
  let r;
  if (o.pvpFinal) r = { dmg: amount, oneHit: !!o.pvpOneHit };
  else if (o.weapon?.A && PVP_WEAPONS[o.weapon.A.id]) r = { dmg: PVP_WEAPONS[o.weapon.A.id].dmg * 0.3, oneHit: false }; // a rocket or grenade's direct hit; its blast comes through pvpExplodeHit
  else r = abilityDamage(o.source || 'ability', amount, { kind: o.kind, crit: o.crit });
  const res = e.takePvp(r.dmg, r.oneHit, att);
  if (!att) {
    ui.damageNumber(e, o.pos || e.headPos(new THREE.Vector3()), res.dealt, { crit: !!o.crit });
    ui.hitmarker(!!o.crit, res.killed);
    sfx.hit?.(!!o.crit);
  }
  return { killed: res.killed, dealt: res.dealt };
}

/** A weapon or ability explosion reaching a Guardian (game.js explode). `f` is the distance falloff (1 at the centre, 0.5 at the edge). */
export function pvpExplodeHit(e, dmg, f, at, o = {}) {
  let base;
  const w = o.weapon;
  if (w?.A && PVP_WEAPONS[w.A.id]) base = weaponDamage(w.A.id, { dist: 0 }).dmg; // a rocket or a grenade launcher: its PvP direct number as the blast
  else base = abilityDamage('explosion', dmg).dmg;
  return pvpDealDamage(e, base * f, { pvpFinal: true, source: 'explosion', pos: at, attacker: o.attacker });
}

/** An AI Guardian's ability: damages every foe inside `r` of `pos`, less toward the edge. */
export function damageFoesInRadius(pos, r, dmg, attacker) {
  for (const f of foesOf(attacker)) {
    const d = Math.hypot(f.pos.x - pos.x, f.pos.z - pos.z);
    if (d > r) continue;
    const dd = dmg * (1 - 0.5 * (d / r));
    if (f.isGuardian) f.takePvp(dd, false, attacker);
    else pvpDamagePlayer(dd, { attacker, from: pos });
  }
  sparks(pos, 0xffd27a, 10, 5, 0.08, 0.4);
}

export { CRUCIBLE_MODES };
