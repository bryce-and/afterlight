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
import { rollItem } from './loot.js';
import { armorBand } from './campaign.js';
import { onMissionStart } from './coop.js';
import {
  CONTROL, CRATES, CRUCIBLE_MODES, CRUCIBLE_REWARD, GUARDIAN_AI, PVP_WEAPONS, pvpHurts, killPoints, zoneStep, zonesHeld, controlResult,
  startLoad, gamerTags, heavyCrateAmount, specialCrateAmount, abilityDamage, weaponDamage, killDamage,
} from './pvp.js';
import { BANNERFALL } from './level-bannerfall.js';
import { Guardian, AI_CLASSES, AI_ELEMENTS } from './guardian-ai.js';
import { showCrucibleHud, updateCrucibleHud, hideCrucibleHud, showCrucibleEnd } from './crucible-hud.js';
import { cleanupMission, abandonMission, gainXp, grantItem } from './game.js';

const TEAM_HEX = { blue: 0x6ec8ff, red: 0xff6a5a };
const FOE = { blue: 'red', red: 'blue' };

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
/**
 * Launches a Crucible match. `opts`: { spectate: no human fights (an AI vs AI match, for the headless check), time (seconds), scoreLimit }.
 * Control is 6v6: the human takes one blue slot, AI Guardians fill the rest.
 */
export function startCrucible(modeId = 'control', opts = {}) {
  const mode = CRUCIBLE_MODES.find((m) => m.id === modeId);
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
  const C = {
    mode, score: { red: 0, blue: 0 }, timeLeft: opts.time ?? CONTROL.time, scoreLimit: opts.scoreLimit ?? CONTROL.scoreLimit,
    zones: BANNERFALL.zones.map((z) => ({ ...z, owner: null, prog: 0, red: 0, blue: 0 })), crates: [], feed: [], over: false, winner: null, spectate: !!opts.spectate,
    ringMeshes: [], zoneEvents: [], stats: { kills: 0, deaths: 0 },
  };
  G.mission = {
    pvp: true, team: 'blue', crucible: C, spectate: !!opts.spectate, mode: modeId,
    loc: { ...base, name: 'The Last City', planetName: 'Earth' }, def: { ...def, name: 'Bannerfall  ·  Control' }, li: 0, mi: 0, g: 0, power: def.power,
    fireteam: 1, coop: false, remote: false, phase: 'combat', current: 0, revives: 0, lives: 0, kills: 0, crits: 0, deaths: 0, loot: [],
    hpMult: 1, dmgMult: 1, playerDmgMult: 1, incomingMult: 1, tier: 'base', lethal: false, blitz: null,
    startTime: performance.now(), objective: 'Take and hold zones', waypoint: null, chest: null, failing: false, doneT: 0, zones: [],
    checkpoint: new THREE.Vector3(...[BANNERFALL.spawns.blue[0][0], 0, BANNERFALL.spawns.blue[0][1]]),
  };
  G.time = 0;
  G.player = new Player(G.save);
  const P = G.player;
  P.team = 'blue';
  P.spawn(M().checkpoint);
  P.yaw = -Math.PI / 2; // facing east, toward the middle of the map
  applyLoadout(P);
  G.state = 'playing';
  playMusic(base.id);
  ui.enterMission();
  buildZoneVisuals();
  buildCrates();
  fillTeams(opts);
  if (opts.spectate) { P.pos.set(0, 0, 41); P.yaw = 0; P.pitch = -0.2; P.viewmodel.visible = false; } // an AI vs AI match: the human only watches
  showCrucibleHud(G.mission);
  ui.centerMessage('Control', 'Bannerfall  ·  Hold the zones', 3.2);
  sfx.areaClear();
}
const M = () => G.mission;

/** Fills both teams with AI Guardians: the human takes one blue slot unless this is a spectated match. */
function fillTeams(opts) {
  const per = CONTROL.teamSize, C = M().crucible, tags = gamerTags(per * 2); // fresh random gamer tags every match
  for (const team of ['blue', 'red']) {
    const have = team === 'blue' && !opts.spectate ? 1 : 0;
    for (let i = 0; i < per - have; i++) {
      const slot = i + have, k = (team === 'blue' ? 0 : 7) + i;
      const [sx, sz] = BANNERFALL.spawns[team][slot % BANNERFALL.spawns[team].length];
      new Guardian({
        team, slot, name: tags[(team === 'blue' ? i : i + per)], classId: AI_CLASSES[k % 3], element: AI_ELEMENTS[(k + 1) % 3],
        arch: GUARDIAN_AI.loadouts[(k + (team === 'red' ? 2 : 0)) % GUARDIAN_AI.loadouts.length], special: GUARDIAN_AI.specials[k % GUARDIAN_AI.specials.length],
        pos: new THREE.Vector3(sx, 0, sz),
      });
    }
  }
  C.guardians = G.enemies.filter((e) => e.isGuardian);
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
    C.crates.push({ type, x, z, ready: false, t: type === 'heavy' ? CRATES.heavyFirst : CRATES.specialFirst + C.crates.length * 3, mesh: m, beam });
    m.visible = beam.visible = false;
  };
  mk('heavy', BANNERFALL.heavyCrate.x, BANNERFALL.heavyCrate.z);
  for (const c of BANNERFALL.specialCrates) mk('special', c.x, c.z);
}

/** Tops up weapon `w` by `n` rounds: magazine first, then reserve up to its cap. Returns the rounds actually added. */
function topUp(w, n) {
  const room = w.mag - w.ammo, a = Math.min(room, n);
  w.ammo += a;
  let left = n - a, b = 0;
  if (w.reserve !== Infinity) { b = Math.min(left, Math.max(0, w.maxReserve - w.reserve)); w.reserve += b; }
  return a + b;
}
function crateTake(crate, who) {
  if (!who) return false;
  if (who === G.player) {
    const P = G.player;
    const w = P.weapons.find((x) => x.item.slot === (crate.type === 'heavy' ? 'heavy' : 'special'));
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
function updateCrates(dt) {
  const C = M().crucible, P = G.player;
  for (const c of C.crates) {
    if (!c.ready) {
      c.t -= dt;
      if (c.t <= 0) { c.ready = true; c.mesh.visible = c.beam.visible = true; if (c.type === 'heavy') ui.feed('Heavy ammo is up at the Plaza', '#b36cff'); }
      continue;
    }
    c.mesh.rotation.y += dt * 1.5; c.mesh.position.y = 0.9 + Math.sin(G.time * 2 + c.x) * 0.15;
    let who = null;
    if (P && !P.dead && !C.spectate && Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < CRATES.pickupR && crateTake(c, P)) who = P;
    else for (const g of C.guardians) if (g.alive && Math.hypot(g.pos.x - c.x, g.pos.z - c.z) < CRATES.pickupR && crateTake(c, g)) { who = g; break; }
    if (who) { c.ready = false; c.mesh.visible = c.beam.visible = false; c.t = c.type === 'heavy' ? CRATES.heavyEvery : CRATES.specialEvery; }
  }
}

// ---------------------------------------------------------------------------
// The match
// ---------------------------------------------------------------------------
export function updateCrucible(dt) {
  const Mi = G.mission, C = Mi.crucible, P = G.player;
  if (C.over) return;
  C.timeLeft = Math.max(0, C.timeLeft - dt);
  // zones: who stands in each ring
  for (const z of C.zones) {
    z.red = 0; z.blue = 0;
    for (const g of C.guardians) if (g.alive && Math.hypot(g.pos.x - z.x, g.pos.z - z.z) < CONTROL.radius) z[g.team]++;
    if (P && !P.dead && !C.spectate && Math.hypot(P.pos.x - z.x, P.pos.z - z.z) < CONTROL.radius) z.blue++;
    const was = z.owner;
    zoneStep(z, z.red, z.blue, dt);
    if (z.owner !== was && z.owner) { feed(`${z.owner === 'blue' ? 'Your team' : 'The enemy'} captured ${z.name}`, z.owner === 'blue' ? '#6ec8ff' : '#ff6a5a'); sfx.areaClear?.(); }
    else if (z.owner !== was && !z.owner) feed(`${z.name} is neutral`, '#dddddd');
  }
  paintZones();
  // respawns
  for (const g of C.guardians) {
    if (g.alive) continue;
    g.respawnT -= dt;
    if (g.respawnT <= 0) { const [x, z] = pickSpawn(g.team, g); g.spawn(new THREE.Vector3(x, 0, z)); }
  }
  updateCrates(dt);
  // objective line
  const held = zonesHeld(C.zones, 'blue');
  Mi.objective = `Hold zones  ·  ${held} of ${CONTROL.zones} held  ·  kills +${killPoints(held)}`;
  const r = controlResult(C.score, C.timeLeft, { ...CONTROL, scoreLimit: C.scoreLimit });
  updateCrucibleHud(Mi);
  if (r.over) endMatch(r.winner);
}

function feed(text, color) { if (!M().crucible.spectate) ui.feed(text, color); }

/** The spawn point farthest from foes among the team's points (so a respawn does not land on someone). */
function pickSpawn(team, who) {
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
  const C = G.mission.crucible, pref = g.slot % CONTROL.zones;
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
// Kills and score
// ---------------------------------------------------------------------------
function score(team, pts) { M().crucible.score[team] += pts; }
function killLine(killer, victim, kteam, vteam, pts) {
  const C = M().crucible;
  C.feed.push({ t: G.time, killer, victim, kteam, vteam, pts });
  if (C.feed.length > 6) C.feed.shift();
}

/** An AI Guardian (or a remote player, in chunk B) died. `attacker`: the killing Guardian, or null for the local player. */
export function onGuardianDeath(g, attacker) {
  const Mi = G.mission, C = Mi.crucible;
  if (!C || C.over) return;
  const kteam = attacker ? attacker.team : Mi.team;
  const pts = killPoints(zonesHeld(C.zones, kteam));
  score(kteam, pts);
  if (attacker) attacker.kills++;
  else {
    Mi.kills++; C.stats.kills++;
    const P = G.player;
    if (P && !P.superActive) P.superCharge = Math.min(100, P.superCharge + 4);
    sfx.kill?.();
  }
  killLine(attacker ? attacker.name : 'You', g.name, kteam, g.team, pts);
}

/** The local player died to `attacker`. */
export function onPlayerDeath(attacker) {
  const Mi = G.mission, C = Mi.crucible;
  if (!C || C.over) return;
  const kteam = FOE[Mi.team];
  const pts = killPoints(zonesHeld(C.zones, kteam));
  score(kteam, pts);
  if (attacker) attacker.kills++;
  C.stats.deaths++;
  killLine(attacker ? attacker.name : 'The map', 'You', kteam, Mi.team, pts);
  ui.showDeath('Eliminated', attacker ? `by ${attacker.name}` : '');
}

/** Called from Player.respawn in a PvP match: a team spawn away from foes, and the start ammo again. */
export function pvpRespawnPrep(P) {
  const Mi = G.mission, [x, z] = pickSpawn(Mi.team, null);
  Mi.checkpoint.set(x, 0, z);
  applyLoadout(P);
  P.over = 0;
}

function endMatch(winner) {
  const Mi = G.mission, C = Mi.crucible;
  C.over = true; C.winner = winner; Mi.phase = 'done';
  const won = winner === Mi.team;
  let item = null;
  if (!C.spectate) {
    gainXp(won ? CRUCIBLE_REWARD.xpWin : CRUCIBLE_REWARD.xpLoss);
    item = rollItem(playerPower(G.save), CRUCIBLE_REWARD.rarity, null, 'earth', G.save.classId, G.save.exoticsFound, playerLevel(G.save), armorBand(G.save));
    grantItem(item);
    writeSave(G.save);
  }
  G.state = 'complete';
  unlockPointer();
  ui.hideDeath();
  showCrucibleEnd(Mi, { won, winner, item, xp: won ? CRUCIBLE_REWARD.xpWin : CRUCIBLE_REWARD.xpLoss }, { again: () => startCrucible(Mi.mode, { spectate: C.spectate }), orbit: () => abandonMission() });
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
  if (!P || P.dead || Mi.spectate || Mi.phase === 'done') return;
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
