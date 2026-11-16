// U23 "The Emperor's Shadow": the dungeon runtime. A mission-shaped shell (G.mission.dungeon), run as segments (boss encounters,
// encounters, traversals) with encounter checkpoints, no timer, restricted respawns (a solo death or a fireteam wipe restarts the
// encounter), DPS-window bosses and a chest after every boss. Separate from js/exotic-missions.js: The Whisper never runs this code.
//   dungeon-rules.js : registry and pure rules     dungeon-mech.js : plates, sigils, water, censers, chalices, gate
//   dungeon-loot.js  : the exclusive pool          dungeon-perks.js : the exclusive perks (Player)
// The host (or a solo player) runs the encounter, judges offerings and censer hits, and owns the boss. Members mirror the host's
// 'ds' snapshots, send offerings, censer hits and chalice pickups as 'dh', and hear results as 'dfx'. Favor is each player's own.
import * as THREE from 'three';
import { G } from './state.js';
import * as ui from './ui.js';
import { buildLevel } from './world.js';
import { buildNav, heightAt, nearestWalkable } from './nav.js';
import { Player } from './player.js';
import { initEffects, sparks, ringFx, flashLight } from './effects.js';
import { playMusic, stinger } from './music.js';
import { sfx } from './audio.js';
import { net, send, broadcast, sendTo } from './net.js';
import { cleanupMission, combatLight, spawnUnit, spawnChest, banner, reviveForCompletion, grantItem, gainXp, damagePlayer } from './game.js';
import { allPlayers, damageRemote, onMissionStart } from './coop.js';
import { lightMults, lightGap } from './light.js';
import { playerPower, writeSave } from './save.js';
import { XP } from './progression.js';
import { SHADERS } from './style.js';
import { IMPERIAL_SET } from './dungeon-perks.js';
import { makeDungeonDrop, DUNGEON_SHADER } from './dungeon-loot.js';
import {
  buildBaths, disposeDungeonMech, updateDungeonMech, drawOrder, flashOrder, setPlateSigils, flashPlate, setStrikeLabel, setPoolCorrupt,
  setCensers, setCenserHp, setGate, addChalice, removeChalice, plateAt, poolAt, sigilLabel, rebuildTargets,
} from './dungeon-mech.js';
import {
  dungeonDef, dungeonEnemyLight, offeringSteps, expandKit, newRound, offer, shuffled, SIGILS, DpsBossFsm, clearDrops, recordDungeonClear,
  dungeonRecord, leashStep, cappedHit, deathOutcome, wipeOutcome, inRegion, inVoid, trackSafe,
} from './dungeon-rules.js';

import { bindB, initSegB, disposeSegB, ownsB, resetSegB, onResetB, activateB, tickB, localB, objectiveB, snapB, onSnapB, onHostMsgB, onFxB, devB } from './dungeon-b.js';

export * from './dungeon-rules.js';

const LAYOUTS = { 'level-shadow': () => import('./level-shadow.js') };
const SNAP_EVERY = 0.25;
const BOSS_SPEED = 2.4;
const _v = new THREE.Vector3();

export const inDungeon = () => !!G.mission?.dungeon;

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
/** Launches a dungeon (solo, or the host of a fireteam; members start through the 'start' message). Async: it loads the layout first. */
export async function startDungeon(id) {
  const d = dungeonDef(id);
  const load = LAYOUTS[d.layout];
  if (!load) throw new Error(`No layout loader for dungeon "${id}" (${d.layout})`);
  const mod = await load();
  const loc = mod.SHADOW_LOC, layout = mod.SHADOW_LAYOUT;
  if (!loc || !layout) throw new Error(`${d.layout}.js must export SHADOW_LOC and SHADOW_LAYOUT`);
  for (const seg of layout.segments) if (!d.segments[seg.id]) throw new Error(`${d.layout}.js segment "${seg.id}" has no entry in DUNGEONS.${id}.segments`);
  buildDungeon(d, loc, layout, mod);
}

function buildDungeon(d, loc, layout, mod) {
  cleanupMission();
  const first = layout.segments.find((s) => s.kind === 'boss');
  const def = { id: d.id, name: d.name, power: 0, boss: { ...(first ? d.segments[first.id].boss : {}) }, mood: null };
  const level = buildLevel(loc, def);
  G.level = level; G.scene = level.scene; G.colliders = level.colliders; G.staticMeshes = level.staticMeshes;
  // U23 chunk B: inside a segment's `pit`, ground under 1 m has no floor (the Underbelly's footholds stand over the void)
  const pits = layout.segments.filter((s) => s.pit).map((s) => s.pit);
  if (pits.length && level.groundAt) {
    const base = level.voidAt, gy = level.groundAt;
    level.voidAt = (x, z) => !!base?.(x, z) || (pits.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) && gy(x, z) < 1);
  }
  G.nav = buildNav(G.colliders, level.bounds);
  G.hitDirty = true;
  G.scene.add(G.camera);
  initEffects(G.scene);
  G.enemies = []; G.projectiles = []; G.enemyShots = []; G.enemyGrenades = []; G.pickups = []; G.tickers = [];
  const pp = combatLight();
  const enemyLight = dungeonEnemyLight(pp, d);
  const L = lightMults(lightGap(pp, enemyLight));
  def.power = enemyLight;
  onMissionStart();
  const fireteam = net.count();
  const spawn = new THREE.Vector3(...layout.spawn);
  const D = {
    id: d.id, def: d, layout, loc, seg: 0, segs: [], bossDead: false, startT: performance.now(), snapT: 0, chestPrompt: false,
    safe: { x: spawn.x, y: spawn.y, z: spawn.z }, cupSeq: 0, clock: 0, mod, secrets: [],
  };
  D.zones = layout.segments.map((seg, i) => {
    const r = seg.region;
    return { enemies: [], idx: i, isBoss: seg.kind === 'boss', center: new THREE.Vector3((r.minX + r.maxX) / 2, seg.checkpoint[1], (r.minZ + r.maxZ) / 2), room: null };
  });
  D.resetSegment = () => resetSegment(D.seg);
  G.mission = {
    fireteam, coop: net.active, remote: net.isClient, dungeon: D,
    loc: { planetName: 'The Leviathan', ...loc }, def, li: -1, mi: -1, g: d.g, phase: 'dungeon', current: 0, revives: 0, lives: 0, tier: 'base', power: enemyLight, enemyLight, bossModel: def.boss.model,
    kills: 0, crits: 0, deaths: 0, loot: [], xp: 0, startTime: performance.now(), hpMult: 1 + d.g * 0.1, dmgMult: 1 + d.g * 0.07,
    playerDmgMult: L.playerDmgMult, incomingMult: L.incomingMult, lightImmune: L.immune,
    checkpoint: spawn.clone(), objective: '', waypoint: null, chest: null, failing: false, doneT: 0, zones: [],
  };
  G.time = 0;
  G.player = new Player(G.save);
  G.player.spawn(spawn);
  D.segs = layout.segments.map((seg) => newSegState(seg, mod));
  G.state = 'playing';
  playMusic('leviathan');
  stinger('start');
  ui.enterMission();
  ui.clearSubtitles();
  ui.centerMessage(d.name, `${loc.name}  ·  Enemies ◆ ${enemyLight} (+${d.enemyLightOver})  ·  Dungeon  ·  Respawns restricted`, 4);
  sfx.areaClear();
}

function newSegState(seg, mod) {
  const S = { s: 'pending', mech: null, round: null, roundNo: 0, strikes: {}, fsm: null, boss: null, chest: null, chestOpened: false, tasterT: 4, bathT: 10, bathers: new Map(), waveIdx: 0, burnT: 0 };
  if (initSegB(S, seg, mod?.UB_FOOT || [])) return S; // U23 chunk B: the Underbelly and the Gardens (dungeon-b.js)
  if (seg.id === 'baths') {
    S.mech = buildBaths(seg);
    S.mech.onCenserShot = (i) => onCenserShot(i);
    setPlateSigils(S.mech, SIGILS);
    drawOrder(S.mech, null);
  }
  return S;
}

/** Called by cleanupMission (game.js). */
export function cleanupDungeon() {
  const D = G.mission?.dungeon;
  if (!D) return;
  D.segs.forEach((S, i) => { if (ownsB(D.layout.segments[i])) disposeSegB(S); else disposeDungeonMech(S.mech); if (S.chest) G.scene?.remove(S.chest.group); });
  for (const X of D.secrets || []) G.scene?.remove(X.c.group);
  if (D.chestPrompt) ui.prompt(null);
}

// ---------------------------------------------------------------------------
// Resets
// ---------------------------------------------------------------------------
function silentRemove(e) {
  if (!e.alive) return;
  e.alive = false; e.hp = 0; e.dieT = 99; e.noBlast = true;
  e.model.group.visible = false;
}
function removeAllEnemies() {
  for (const e of G.enemies) silentRemove(e);
  const D = G.mission?.dungeon;
  if (D) for (const z of D.zones) z.enemies.length = 0;
  G.hitDirty = true;
}
/** Host or solo: put the encounter back to how it was when first entered. */
function resetSegment(i) {
  const M = G.mission, D = M.dungeon;
  if (M.remote) return;
  removeAllEnemies();
  const S = D.segs[i], seg = D.layout.segments[i];
  if (S.s === 'solved') return; // a cleared encounter stays cleared
  Object.assign(S, { s: 'pending', round: null, roundNo: 0, strikes: {}, fsm: null, boss: null, tasterT: 4, bathT: 10, waveIdx: 0 });
  S.bathers.clear();
  if (ownsB(seg)) resetSegB(D, S, seg);
  else if (S.mech) {
    for (const c of S.mech.chalices.slice()) removeChalice(S.mech, c.id);
    S.mech.pools.forEach((_, k) => setPoolCorrupt(S.mech, k, false));
    S.mech.plates.forEach((_, k) => setStrikeLabel(S.mech, k, 0, D.def.strikes));
    setCensers(S.mech, false);
    setPlateSigils(S.mech, SIGILS);
    drawOrder(S.mech, null);
    if (seg.gate) setGate(S.mech, false);
  }
  G.player?.status.remove('favor');
  if (net.isHost) broadcast({ t: 'drst' });
  ui.feed('Encounter reset', '#ffb36b');
}
/** Member: the host reset the encounter. */
function onReset() {
  removeAllEnemies();
  const D = G.mission?.dungeon;
  if (D) D.segs.forEach((S, i) => { if (ownsB(D.layout.segments[i])) onResetB(S, D.layout.segments[i]); });
  if (D) for (const S of D.segs) if (S.mech?.plates) { S.mech.plates.forEach((_, k) => setStrikeLabel(S.mech, k, 0, D.def.strikes)); for (const c of S.mech.chalices.slice()) removeChalice(S.mech, c.id); }
  G.player?.status.remove('favor');
}

/** Host: every player is down. Everyone is back at the checkpoint and the encounter resets. */
export function dungeonWipe(deadFlags) {
  const M = G.mission, D = M?.dungeon;
  if (!D || M.remote || M.phase === 'loot' || M.phase === 'done') return;
  if (wipeOutcome(deadFlags).action !== 'wipe-reset' || G.time < (D.wipeAt ?? 0)) return;
  D.wipeAt = G.time + 3;
  resetSegment(D.seg);
  if (net.isHost) broadcast({ t: 'dwipe' });
  G.player.respawn(false);
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------
function standSpot(x, y, z, sp) {
  const nav = G.nav, ok = (px, pz) => !nav || Math.abs(heightAt(nav, px, pz) - y) <= 0.3;
  if (ok(x, z)) return new THREE.Vector3(x, y, z);
  if (ok(sp[0], sp[2])) return new THREE.Vector3(sp[0], y, sp[2]);
  const w = nearestWalkable(nav, sp[0], sp[2], 4);
  if (w && ok(w.x, w.z)) return new THREE.Vector3(w.x, y, w.z);
  console.warn(`Dungeon spawn at ${sp.join(', ')} has no standable cell nearby`);
  return new THREE.Vector3(sp[0], y, sp[2]);
}
function spawnAt(zone, type, sp, o = {}) {
  const pos = standSpot(sp[0] + (Math.random() - 0.5) * 1.4, sp[1], sp[2] + (Math.random() - 0.5) * 1.4, sp);
  const e = spawnUnit(zone, type, pos, { faction: G.mission.dungeon.def.faction, ...o });
  e.pos.y = sp[1];
  G.hitDirty = true;
  return e;
}
function spawnKit(zone, kit, spots) {
  const M = G.mission;
  for (const t of expandKit(kit, M.fireteam)) spawnAt(zone, t, spots[Math.floor(Math.random() * spots.length)]);
}
const alivePlayers = () => allPlayers().filter((p) => p && !p.dead);
const aliveIn = (zone) => zone.enemies.filter((e) => e.alive).length;

// ---------------------------------------------------------------------------
// The Imperial Baths (boss encounter): Favor, offerings, censers, Vhorrak's DPS windows
// ---------------------------------------------------------------------------
function activateBaths(D, i) {
  const M = G.mission, seg = D.layout.segments[i], cfg = D.def.segments[seg.id], S = D.segs[i], zone = D.zones[i];
  S.s = 'active';
  banner(seg.name, 'Kill a Royal Taster and take its chalice: Favor shows you the sigils', 3.2, 'areaClear');
  // Vhorrak: immune until the censers break
  const b = spawnUnit(zone, 'boss', new THREE.Vector3(...seg.boss), { name: cfg.boss.name, element: cfg.boss.element, model: cfg.boss.model, faction: 'legion' });
  b.thresholds = []; // no damage gates: DPS windows only
  b.maxShield = 1; b.shield = 0; if (b.model.shield) b.model.shield.visible = false;
  b.dgBoss = true; b.dgImm = true;
  if (cfg.boss.scale) { b.scale = cfg.boss.scale; b.radius = cfg.boss.radius ?? b.radius; b.height = b.model.height * b.scale; }
  if (cfg.boss.melee) { // his own copy of the stats: the melee lunge in place of the boss's guns (enemies.js def.melee); never fires a shot
    const pool = G.player.maxHealth + G.player.maxShield, inc = G.mission.incomingMult || 1;
    b.def = { ...b.def, melee: true, closeMelee: false, meleeDmg: cappedHit(cfg.boss.meleeDmg * b.dmgMult * inc, pool, cfg.boss.hitFrac.lunge) / (b.dmgMult * inc), speed: cfg.boss.speed ?? b.def.speed, range: 4, prefer: 1.5, fireCd: [1e9, 1e9], burst: 0 };
    b.fireT = 1e9;
  }
  b.cleaveT = cfg.cleaveEvery; b.slamT = cfg.slamEvery; b.slamWind = 0; b.cleaveWind = 0;
  b.bossUpdate = (dt, dist) => vhorrakAttacks(D, S, b, cfg, dt, dist);
  if (cfg.boss.leash) { // outside a DPS window he keeps to his end of the baths; in a window he chases (Bryce, 2026-11-15)
    const home = seg.boss, upd = b.update.bind(b);
    b.update = (dt) => {
      const out = upd(dt);
      if (b.alive) {
        const chasing = S.fsm?.mode === 'window';
        const prev = [b.pos.x, b.pos.z];
        // the base AI walks toward the player at his speed; outside a window, cancel any step past the leash and walk him back
        const [x, z] = leashStep(b.pos.x, b.pos.z, home, cfg.boss.leash, chasing, cfg.boss.returnSpeed + cfg.boss.speed, dt);
        if (x !== prev[0] || z !== prev[1]) { b.pos.x = x; b.pos.z = z; b.model.group.position.x = x; b.model.group.position.z = z; }
      }
      return out;
    };
  }
  S.boss = b;
  S.fsm = new DpsBossFsm(cfg);
  newOfferingRound(D, S, cfg, false);
  spawnKit(zone, cfg.waves[0], seg.spawns);
  S.waveIdx = 1;
  stinger('boss');
}

function newOfferingRound(D, S, cfg, shuffle) {
  const M = G.mission;
  S.roundNo++;
  S.round = newRound(offeringSteps(cfg, M.fireteam));
  S.strikes = {};
  if (shuffle) setPlateSigils(S.mech, shuffled(SIGILS));
  S.mech.plates.forEach((_, k) => setStrikeLabel(S.mech, k, 0, D.def.strikes));
  drawOrder(S.mech, S.round);
  setCensers(S.mech, false);
}

/** Host or solo: a Favored player offers at a plate. `who` is the player's net id (or 'me'). */
function judgeOffering(D, plate, who) {
  const M = G.mission, S = D.segs[D.seg], seg = D.layout.segments[D.seg], cfg = D.def.segments[seg.id];
  if (!S.round || S.round.solved || S.s !== 'active' || S.fsm?.mode !== 'immune') return;
  if (S.mech.pools[plate]?.corrupt) { tellOffering(who, { k: 'off', i: plate, r: 'corrupt' }); return; }
  const sigil = S.mech.plateSigils[plate];
  const r = offer(S.round, S.strikes, who, sigil, D.def.strikes);
  if (r === 'ignored') return;
  const n = S.strikes[who] || 0;
  offeringFx(D, plate, r, who === localId() ? n : -1);
  if (net.isHost && M.coop) broadcast({ t: 'dfx', k: 'off', i: plate, r, who, n });
  if (r === 'wrong' || r === 'lethal') spawnKit(D.zones[D.seg], cfg.wrongWave, seg.spawns);
  if (r === 'lethal') {
    if (who === localId()) G.player.die('death');
    else sendTo(who, { t: 'dfx', k: 'lethal' });
  }
  if (r === 'solved') {
    setCensers(S.mech, true, Math.max(1, Math.round(cfg.censerHits)));
    banner('The Censers Descend', 'Break all three to strip Vhorrak\'s ward', 2.6, 'alert');
  }
}
function tellOffering(who, msg) { if (who === localId()) onOfferFx(msg); else sendTo(who, { t: 'dfx', ...msg }); }
const localId = () => (net.active ? net.id : 'me');

/** Everyone: the flare, sound and strike count of an offering. `mine`: this player's strikes (or -1 when someone else offered). */
function offeringFx(D, plate, r, mine) {
  const S = D.segs[D.seg];
  if (!S?.mech) return;
  const P = S.mech.plates[plate];
  const at = P.p.clone().setY(P.p.y + 1);
  if (r === 'right' || r === 'solved') {
    flashPlate(S.mech, plate, 'ok'); flashOrder(S.mech, 'ok', S.round);
    sparks(at, 0xffd24d, 18, 6, 0.1, 0.5); ringFx(at.clone(), 2.4, 0xffc247, 0.5);
    sfx.glyphRight();
    if (mine >= 0) setStrikeLabel(S.mech, plate, 0, D.def.strikes);
    if (r === 'solved') { for (const Q of S.mech.plates) setStrikeLabel(S.mech, Q.i, 0, D.def.strikes); }
  } else {
    flashPlate(S.mech, plate, 'bad'); flashOrder(S.mech, 'bad', S.round);
    sparks(at, 0xff3a2a, 18, 6, 0.1, 0.5);
    sfx.glyphWrong();
    if (mine >= 0) {
      setStrikeLabel(S.mech, plate, r === 'lethal' ? 0 : mine, D.def.strikes);
      ui.feed(r === 'lethal' ? 'The Emperor does not forgive a third insult' : `Wrong offering: ${mine} of ${D.def.strikes}. The third is lethal`, '#ff7a6b');
    }
  }
}
/** Member: a result from the host. */
function onOfferFx(m) {
  const D = G.mission?.dungeon;
  if (!D) return;
  if (m.k === 'lethal') { G.player.die('death'); return; }
  if (m.k === 'off') {
    if (m.r === 'corrupt') { ui.feed('This pool is corrupted: kill the Bather in it first', '#ff7a6b'); sfx.denied?.(); return; }
    offeringFx(D, m.i, m.r, m.who === localId() ? m.n : -1);
  }
  if (m.k === 'favor' && m.who === localId()) giveFavor();
}

function onCenserShot(i) {
  const M = G.mission;
  if (M.remote) { send({ t: 'dh', k: 'cen', i }); return; }
  hitCenser(i);
}
function hitCenser(i) {
  const M = G.mission, D = M.dungeon, S = D.segs[D.seg];
  if (!S?.mech || !S.fsm || S.fsm.mode !== 'immune') return;
  const C = S.mech.censers[i];
  if (!C?.alive) return;
  setCenserHp(S.mech, i, C.hp - 1);
  sparks(C.group.position.clone(), 0xa060ff, 8, 5, 0.08, 0.3);
  if (C.alive) sfx.blightHit(); else { sfx.blightDown(); ui.feed('A censer shatters', '#ffd24d'); }
  if (S.mech.censers.every((c) => !c.alive)) openWindow(D, S);
}

function openWindow(D, S) {
  const seg = D.layout.segments[D.seg], cfg = D.def.segments[seg.id], b = S.boss;
  const ev = S.fsm.openWindow();
  if (!ev.length) return;
  if (b) b.dgImm = false;
  banner(`${cfg.boss.name} is exposed`, `Damage window: ${cfg.windowTime} seconds`, 2.2, 'alert');
  flashLight(b ? b.pos.clone().setY(b.pos.y + 2) : new THREE.Vector3(), 0xffc247, 40, 30, 0.3);
  if (cfg.windowAdds?.length) spawnKit(D.zones[D.seg], cfg.windowAdds, seg.spawns);
}

function vhorrakAttacks(D, S, b, cfg, dt, dist) {
  const P = b.tgt || G.player;
  if (!P || P.dead) return;
  // the cleave: a short wind-up, then a wide sweep in front of him
  if (b.cleaveWind > 0) {
    b.cleaveWind -= dt;
    if (b.cleaveWind <= 0) {
      sfx.explosion(4, b.pos);
      for (const p of allPlayers()) {
        if (!p || p.dead) continue;
        const dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z, dd = Math.hypot(dx, dz);
        if (dd > 6.5) continue;
        const face = Math.atan2(dx, dz) - b.cleaveYaw;
        if (Math.cos(face) < 0.2) continue; // behind him
        bossHit(p, b, 55, cfg.boss.hitFrac.cleave, 'melee');
      }
    }
  } else {
    b.cleaveT -= dt;
    if (b.cleaveT <= 0 && dist < 7) {
      b.cleaveT = cfg.cleaveEvery * (0.85 + Math.random() * 0.3);
      b.cleaveWind = 0.75;
      b.cleaveYaw = Math.atan2(P.pos.x - b.pos.x, P.pos.z - b.pos.z);
      ringFx(b.pos.clone().setY(b.pos.y + 0.2), 6.5, 0xff7a2a, 0.75);
    }
  }
  // the slam: a long telegraph ring, then a burst; jump it or be outside the ring
  if (b.slamWind > 0) {
    b.slamWind -= dt;
    if (b.slamWind <= 0) {
      ringFx(b.pos.clone().setY(b.pos.y + 0.2), cfg.slamRadius, 0xffffff, 0.6);
      flashLight(b.pos.clone().setY(b.pos.y + 1), 0xffc247, 40, 20, 0.2);
      sfx.explosion(8, b.pos);
      for (const p of allPlayers()) {
        if (!p || p.dead || Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) > cfg.slamRadius || p.pos.y > b.pos.y + 1.4) continue;
        bossHit(p, b, 40, cfg.boss.hitFrac.slam, 'splash');
      }
    }
  } else {
    b.slamT -= dt;
    if (b.slamT <= 0) { b.slamT = cfg.slamEvery; b.slamWind = 1.4; ringFx(b.pos.clone().setY(b.pos.y + 0.2), cfg.slamRadius, 0xffa83a, 1.4); }
  }
}

/** One of Vhorrak's hits on a player, capped to a share of their health plus shield (no one-hit kills from full). damagePlayer
 *  multiplies by the Light gap afterwards, so the cap is divided back out of the amount passed in. */
function bossHit(p, b, base, frac, kind) {
  const inc = G.mission.incomingMult || 1, me = G.player;
  // a teammate's record carries no health pool here; members share the leader's Light, so the host's own pool stands in
  const pool = p.remote ? (p.maxHealth ?? me.maxHealth) + (p.maxShield ?? me.maxShield) : p.maxHealth + p.maxShield;
  const amount = cappedHit(base * b.dmgMult * inc, pool, frac) / inc;
  if (p.remote) damageRemote(p, amount, b.pos); else damagePlayer(amount, b.pos, kind);
}
function bathsTick(D, S, seg, cfg, dt) {
  const M = G.mission, zone = D.zones[D.seg];
  const b = S.boss;
  // waves top up while the boss is immune
  if (S.waveIdx < cfg.waves.length && aliveIn(zone) <= 3) { spawnKit(zone, cfg.waves[S.waveIdx], seg.spawns); S.waveIdx++; }
  else if (S.waveIdx >= cfg.waves.length && aliveIn(zone) <= 2 && S.fsm.mode === 'immune') { S.waveIdx = 1; }
  // a Royal Taster when none is alive
  const tasters = zone.enemies.filter((e) => e.typeId === 'lg_taster' && e.alive);
  S.tasterT -= dt;
  if (!tasters.length && S.tasterT <= 0) {
    S.tasterT = cfg.tasterEvery;
    const sp = seg.spawns[Math.floor(Math.random() * seg.spawns.length)];
    const e = spawnAt(zone, 'lg_taster', sp);
    e.dgTaster = true;
    ui.feed('A Royal Taster enters the baths', '#ffc247');
  }
  // dead Tasters leave a chalice
  for (const e of zone.enemies) if (e.dgTaster && !e.alive && !e.cupDone) { e.cupDone = true; dropChalice(D, S, e.pos.clone()); }
  // Bathers wade into a pool; one left there too long corrupts it
  S.bathT -= dt;
  if (S.bathT <= 0) {
    S.bathT = cfg.bathEvery;
    const free = S.mech.pools.map((p, k) => k).filter((k) => ![...S.bathers.values()].some((x) => x.pool === k));
    if (free.length) {
      const k = free[Math.floor(Math.random() * free.length)], P = S.mech.pools[k];
      for (const t of expandKit(cfg.bathers, 1)) { const e = spawnAt(zone, t, [P.p.x + P.r * 0.6, 0, P.p.z]); S.bathers.set(e, { pool: k, t: 0 }); }
      ui.feed('A Ceremonial Bather wades into a pool', '#ffb36b');
    }
  }
  for (const [e, x] of S.bathers) {
    if (!e.alive) { S.bathers.delete(e); if (S.mech.pools[x.pool].corrupt && ![...S.bathers.values()].some((y) => y.pool === x.pool)) { setPoolCorrupt(S.mech, x.pool, false); ui.feed('The pool runs clear again', '#7fd8c8'); } continue; }
    const P = S.mech.pools[x.pool];
    if (Math.hypot(e.pos.x - P.p.x, e.pos.z - P.p.z) < P.r) x.t += dt;
    if (!P.corrupt && x.t >= cfg.corruptAfter) { setPoolCorrupt(S.mech, x.pool, true); banner('A Pool Is Corrupted', 'Kill the Bather to clear its plate', 2, 'alert'); }
  }
  // the boss
  if (!b) return;
  if (!b.alive) { if (!S.bossDone) bathsCleared(D, S, seg); return; }
  const ev = S.fsm.tick(dt, b.hp, b.maxHp);
  b.dgImm = S.fsm.immune;
  if (ev.includes('window-end')) {
    banner(`${cfg.boss.name} recovers`, S.roundNo + 1 >= cfg.shuffleFrom ? 'The plates have moved: hold Favor to read them' : 'Make the offerings again', 2.6, 'alert');
    newOfferingRound(D, S, cfg, S.roundNo + 1 >= cfg.shuffleFrom);
  }
}

function dropChalice(D, S, pos) {
  const id = ++D.cupSeq;
  pos.y = Math.max(pos.y, 0);
  addChalice(S.mech, id, pos);
  if (net.isHost) broadcast({ t: 'dfx', k: 'cup', id, x: pos.x, y: pos.y, z: pos.z });
  ui.feed('A chalice falls: take it for Favor', '#ffc247');
}
/** The local player gains Favor (x50; the Imperial set makes it last longer). */
function giveFavor() {
  const P = G.player, D = G.mission.dungeon;
  P.status.apply('favor', { t: D.def.favorTime / (P.sets.has('imperial') ? IMPERIAL_SET.favorDrain : 1), set: true });
  P.imperialRefresh?.(); // Taster's Instinct
  sfx.engram(2);
  ui.feed('Favor: the sigils show themselves to you', '#ffc247');
}
/** Host: someone took chalice `id`. */
function takeChalice(D, id, who) {
  const S = D.segs[D.seg];
  if (!S?.mech?.chalices.some((c) => c.id === id)) return;
  removeChalice(S.mech, id);
  if (net.isHost) broadcast({ t: 'dfx', k: 'cupgone', id });
  if (who === localId()) giveFavor(); else sendTo(who, { t: 'dfx', k: 'favor', who });
}

function bathsCleared(D, S, seg) {
  S.bossDone = true;
  S.s = 'solved';
  removeLeftovers();
  S.mech.chalices.slice().forEach((c) => removeChalice(S.mech, c.id));
  setCensers(S.mech, false);
  reviveForCompletion();
  G.player.health = G.player.maxHealth; G.player.shield = G.player.maxShield;
  segmentCleared(D, D.seg, seg);
}
function removeLeftovers() { for (const e of G.enemies) if (e.alive && !e.isBoss) silentRemove(e); }

// ---------------------------------------------------------------------------
// Clears, chests and the final reward
// ---------------------------------------------------------------------------
/** Host or solo: an encounter is done. Its chest appears; the next segment's checkpoint takes over; the gate opens. */
function segmentCleared(D, i, seg) {
  const M = G.mission, last = i >= D.layout.segments.length - 1;
  const S = D.segs[i];
  if (seg.gate && S.mech) setGate(S.mech, true);
  if (seg.chest) placeChest(D, i, seg.chest);
  if (net.isHost) broadcast({ t: 'dfx', k: 'clear', sg: i });
  const name = D.def.segments[seg.id].boss?.name;
  if (seg.kind === 'traversal') { ui.centerMessage(`${seg.name} Crossed`, 'Press on', 2.6); sfx.areaClear(); }
  else {
    ui.centerMessage(name ? `${name.split(',')[0]} Falls` : `${seg.name} Cleared`, last ? 'Claim your reward' : 'Claim your reward, then press on', 3);
    sfx.missionComplete();
    stinger('complete');
  }
  if (!last) {
    D.seg = i + 1;
    M.checkpoint.set(...D.layout.segments[i + 1].checkpoint);
  }
}
function placeChest(D, i, at) {
  const S = D.segs[i];
  if (S.chest) return;
  const p = new THREE.Vector3(...at);
  const c = spawnChest(p);
  c.group.position.copy(p); c.pos.copy(p);
  S.chest = c;
}
/** Everyone: open your own copy of an encounter chest. Each player rolls their own drops (one from the pool, 5% exotic). */
function chestTick(D, P, dt) {
  let near = null;
  for (let i = 0; i < D.segs.length; i++) {
    const c = D.segs[i].chest;
    if (!c) continue;
    if (c.opened) c.lid.rotation.x = Math.max(-1.9, c.lid.rotation.x - dt * 4);
    else if (!P.dead && P.pos.distanceTo(c.pos) < 3.2) near = i;
  }
  let secret = null; // U23 chunk B: a hidden chest (the Underbelly's lever puzzle)
  for (const X of D.secrets) {
    if (X.c.opened) { X.c.lid.rotation.x = Math.max(-1.9, X.c.lid.rotation.x - dt * 4); continue; }
    if (!P.dead && P.pos.distanceTo(X.c.pos) < 3.2) secret = X;
  }
  const want = near !== null || !!secret;
  if (want !== D.chestPrompt) { ui.prompt(want ? (secret ? '[E]  Open the Hidden Chest' : '[E]  Open Imperial Chest') : null); D.chestPrompt = want; }
  if (!want || !G.input.pressed.KeyE) return;
  if (secret) openSecretChest(D, secret); else openEncounterChest(D, near);
}
/** Host and members alike: a hidden chest appears (each player opens their own copy). */
function placeSecret(D, i, at) {
  if (D.secrets.some((X) => X.i === i)) return;
  const p = new THREE.Vector3(...at), c = spawnChest(p);
  c.group.position.copy(p); c.pos.copy(p);
  D.secrets.push({ i, c, group: c.group });
}
/** A hidden chest: one guaranteed item from the dungeon's exclusive pool. */
function openSecretChest(D, X) {
  const M = G.mission, s = G.save, c = X.c;
  c.opened = true; c.beam.visible = false;
  D.chestPrompt = false; ui.prompt(null);
  sfx.chest();
  sparks(c.pos.clone().setY(c.pos.y + 1), 0xf4c542, 30, 8, 0.1, 0.8);
  const it = makeDungeonDrop(Math.random() < 0.5 ? 'weapon' : 'armor', playerPower(s), s.classId);
  setTimeout(() => { if (G.mission === M) grantItem(it); }, 300);
  writeSave(s);
}
function openEncounterChest(D, i) {
  const M = G.mission, S = D.segs[i], c = S.chest, s = G.save, last = i >= D.layout.segments.length - 1;
  c.opened = true; c.beam.visible = false;
  D.chestPrompt = false; ui.prompt(null);
  sfx.chest();
  sparks(c.pos.clone().setY(c.pos.y + 1), 0xf4c542, 30, 8, 0.1, 0.8);
  const pp = playerPower(s);
  const rec = dungeonRecord(s, D.id);
  const owns = (s.shaders?.owned || []).includes(DUNGEON_SHADER);
  const drops = clearDrops(D.def, { finalClear: last, firstClear: rec.clears === 0, ownsShader: owns });
  const items = drops.filter((x) => x.kind !== 'shader').map((x) => makeDungeonDrop(x.kind, pp, s.classId));
  items.forEach((it, k) => setTimeout(() => { if (G.mission === M) grantItem(it); }, 300 + k * 450));
  if (drops.some((x) => x.kind === 'shader')) { s.shaders.owned.push(DUNGEON_SHADER); setTimeout(() => ui.feed(`Shader acquired: ${SHADERS[DUNGEON_SHADER].name}`, '#e9d7ff'), 300); }
  if (items.some((it) => it.rarity === 'exotic')) setTimeout(() => ui.feed('An exotic answers the Emperor\'s call', '#f4c542'), 600);
  gainXp(XP.mission);
  if (last) finishDungeon(D);
  writeSave(s);
}
/** The final chest: records the clear and runs the usual Mission End return timer. */
function finishDungeon(D) {
  const M = G.mission, s = G.save;
  const secs = (performance.now() - D.startT) / 1000;
  const rec = recordDungeonClear(s, D.id, secs);
  const glimmer = 800;
  s.glimmer += glimmer;
  M.rewardGlimmer = glimmer;
  M.firstClear = rec.first;
  M.rewards = [];
  M.unlocks = null;
  if (rec.first) gainXp(XP.firstClear);
  M.phase = 'done';
  M.doneT = 3.8;
}

// ---------------------------------------------------------------------------
// Per frame
// ---------------------------------------------------------------------------
function objectiveFor(D) {
  const M = G.mission, seg = D.layout.segments[D.seg], S = D.segs[D.seg], cfg = D.def.segments[seg.id];
  const wp = (p) => { M.waypoint = p ? new THREE.Vector3(...p) : null; };
  if (S.s === 'pending') { wp(seg.checkpoint); return `Enter ${seg.name}`; }
  if (ownsB(seg) && !(S.s === 'solved' && seg.chest)) return objectiveB(D, S, seg);
  if (S.s === 'solved') { wp(seg.chest || null); return 'Open the Imperial Chest'; }
  wp(null);
  const f = S.fsm, fav = G.player.status.has('favor');
  if (!f) return seg.name;
  if (f.mode === 'window') return `Damage ${cfg.boss.name}  ·  ${Math.ceil(f.windowLeft)}s`;
  if (S.round?.solved) return `Break the censers  ·  ${S.mech.censers.filter((c) => !c.alive).length}/${S.mech.censers.length}`;
  if (!fav) return 'Kill a Royal Taster and take its chalice for Favor';
  return `Offer the sigils in the board's order  ·  ${S.round.progress}/${S.round.order.length}`;
}

export function updateDungeon(dt) {
  const M = G.mission, D = M.dungeon, P = G.player, layout = D.layout;
  const auth = !M.remote;
  const S = D.segs[D.seg], seg = layout.segments[D.seg];
  const fav = P.status.has('favor');
  // U23 chunk B: a segment may carry its own fog (the Underbelly is dark); the location's fog everywhere else
  if (G.scene.fog) {
    D.fog0 ||= { c: G.scene.fog.color.clone(), n: G.scene.fog.near, f: G.scene.fog.far, bg: G.scene.background?.isColor ? G.scene.background.clone() : null };
    const fz = layout.segments.find((sg) => sg.fog && inRegion(P.pos, sg.region))?.fog;
    const want = fz ? { c: new THREE.Color(fz.color), n: fz.near, f: fz.far } : D.fog0, F = G.scene.fog, k = Math.min(1, dt * 2.5);
    F.color.lerp(want.c, k); F.near += (want.n - F.near) * k; F.far += (want.f - F.far) * k;
    if (D.fog0.bg && G.scene.background?.isColor) G.scene.background.lerp(fz ? want.c : D.fog0.bg, k);
  }
  D.clock += dt; // the shared clock (pistons, vents, sweeps); members follow the host's through the snapshot
  let bPrompt = null;
  D.segs.forEach((X, i) => {
    if (ownsB(layout.segments[i])) { const t = localB(D, i, P, dt); if (i === D.seg) bPrompt = t; }
    else if (X.mech) updateDungeonMech(X.mech, dt, fav, X.round);
  });
  chestTick(D, P, dt);
  if (M.phase === 'loot' || M.phase === 'done') return;

  // the local player: standing on a plate (Royal Guard), the bath water, chalices, offerings, the void
  if (!P.dead) {
    const B = seg?.id === 'baths' ? S?.mech : null;
    const plate = B ? plateAt(B, P.pos) : -1;
    const C = S?.mech; // chalices: any segment's Royal Tasters drop them
    if (C?.chalices && S.s === 'active' && !B) for (const c of C.chalices) if (P.pos.distanceTo(c.pos) < 1.8) { if (M.remote) { if (G.time - (D.cupAskT ?? -9) > 0.5) { D.cupAskT = G.time; send({ t: 'dh', k: 'cup', id: c.id }); } } else takeChalice(D, c.id, localId()); break; }
    if (!B && bPrompt !== D.plateText) { D.plateText = bPrompt; if (!D.chestPrompt) ui.prompt(bPrompt); }
    P.onPlate = plate >= 0 || (seg?.dais && Math.hypot(P.pos.x - seg.dais.p[0], P.pos.z - seg.dais.p[2]) < seg.dais.r && P.pos.y > seg.dais.p[1] - 0.3);
    if (B && S.s === 'active') {
      const pool = poolAt(B, P.pos);
      if (pool >= 0 && (!fav || B.pools[pool].corrupt)) { // the water burns without Favor (and always when corrupted)
        S.burnT -= dt;
        if (S.burnT <= 0) { S.burnT = 0.5; damagePlayer(D.def.segments[seg.id].burnDps * 0.5, P.pos.clone(), 'burn'); if (G.time - (D.burnMsgT ?? -9) > 4) { D.burnMsgT = G.time; ui.feed(B.pools[pool].corrupt ? 'Corrupted water: get out' : 'The anointing water burns without Favor', '#ff7a6b'); } }
      }
      for (const c of B.chalices) if (P.pos.distanceTo(c.pos) < 1.8) { if (M.remote) { if (G.time - (D.cupAskT ?? -9) > 0.5) { D.cupAskT = G.time; send({ t: 'dh', k: 'cup', id: c.id }); } } else takeChalice(D, c.id, localId()); break; }
      const canOffer = plate >= 0 && S.round && !S.round.solved && S.fsm?.mode === 'immune';
      const text = !canOffer ? null : fav ? `[E]  Offer the ${sigilLabel(B.plateSigils[plate])}` : 'Favor is needed to make an offering';
      if (text !== D.plateText) { D.plateText = text; if (!D.chestPrompt) ui.prompt(text); }
      if (canOffer && fav && G.input.pressed.KeyE) {
        if (M.remote) send({ t: 'dh', k: 'off', i: plate }); else judgeOffering(D, plate, localId());
      }
    } else if (B && D.plateText) { D.plateText = null; if (!D.chestPrompt) ui.prompt(null); }
    const overGrate = !!S?.mech?.grates?.some((g) => Math.abs(P.pos.y - g.col.max.y) < 0.12 && P.pos.x > g.col.min.x - 0.4 && P.pos.x < g.col.max.x + 0.4 && P.pos.z > g.col.min.z - 0.4 && P.pos.z < g.col.max.z + 0.4);
    D.safe = trackSafe(D.safe, P.pos, P.onGround, overGrate); // a grate is no safe spot: it fades with your Favor
    if (inVoid(P.pos.y, layout.voidY)) {
      const o = deathOutcome({ fireteam: M.coop ? Math.max(1, allPlayers().length) : 1, cause: 'void' });
      if (o.action === 'downed-at-safe') { P.pos.set(D.safe.x, D.safe.y, D.safe.z); P.vel.set(0, 0, 0); }
      P.die('void');
    }
  }

  if (!auth) return; // members: the rest comes from the host
  if (S.s === 'pending') {
    if (alivePlayers().some((p) => inRegion(p.pos, seg.region))) { if (seg.id === 'baths') activateBaths(D, D.seg); else if (ownsB(seg)) activateB(D, D.seg); }
  } else if (S.s === 'active') {
    if (seg.id === 'baths') bathsTick(D, S, seg, D.def.segments[seg.id], dt);
    else if (ownsB(seg)) tickB(D, S, seg, dt);
  }
  M.objective = objectiveFor(D);
  D.snapT -= dt;
  if (net.isHost && D.snapT <= 0) { D.snapT = SNAP_EVERY; broadcast(snapshot(D)); }
}

/** game.js: an extra damage gate. A dungeon boss is immune outside its DPS window (no damage gates inside one). */
export const dungeonImmune = (e) => !!(e.dgBoss && e.dgImm);

// ---------------------------------------------------------------------------
// Co-op
// ---------------------------------------------------------------------------
function snapshot(D) {
  const S = D.segs[D.seg], seg = D.layout.segments[D.seg];
  if (seg.id !== 'baths') return { t: 'ds', sg: D.seg, st: D.segs.map((x) => x.s[0]), ck: Math.round(D.clock * 100) / 100, gt: D.segs.map((x) => (x.mech?.gate?.open ? 1 : 0)), cp: G.mission.checkpoint.toArray().map((v) => Math.round(v * 100) / 100), ...snapB(D, S, seg) };
  return {
    t: 'ds', sg: D.seg, st: D.segs.map((x) => x.s[0]), ck: Math.round(D.clock * 100) / 100,
    rd: S.round ? { o: S.round.order, p: S.round.progress, s: S.round.solved ? 1 : 0 } : 0, rn: S.roundNo,
    ps: S.mech ? S.mech.plateSigils : 0, pc: S.mech ? S.mech.pools.map((p) => (p.corrupt ? 1 : 0)) : 0,
    ce: S.mech ? S.mech.censers.map((c) => (c.lowered ? (c.alive ? c.hp : 0) : -1)) : 0,
    fs: S.fsm ? { m: S.fsm.mode, wl: Math.round(S.fsm.windowLeft * 10) / 10 } : 0,
    gt: D.segs.map((x) => (x.mech?.gate?.open ? 1 : 0)),
    cp: G.mission.checkpoint.toArray().map((v) => Math.round(v * 100) / 100),
  };
}
function onSnapshot(m) {
  const M = G.mission, D = M?.dungeon;
  if (!D || !M.remote) return;
  D.seg = m.sg;
  D.segs.forEach((x, i) => { x.s = { p: 'pending', a: 'active', s: 'solved' }[m.st[i]] ?? x.s; });
  M.checkpoint.set(m.cp[0], m.cp[1], m.cp[2]);
  if (m.ck != null && Math.abs(m.ck - D.clock) > 0.08) D.clock = m.ck; // follow the host's clock (pistons, vents)
  const S = D.segs[m.sg], seg = D.layout.segments[m.sg];
  D.segs.forEach((x, i) => { if (x.mech) setGate(x.mech, !!m.gt[i]); });
  if (ownsB(seg)) {
    onSnapB(D, S, seg, m);
    const b = G.enemies.find((e) => e.isBoss);
    if (b && S.fsm) { b.dgBoss = true; b.dgImm = S.fsm.mode !== 'window'; }
    M.objective = objectiveFor(D);
    return;
  }
  if (!S.mech) return;
  if (m.rd) {
    const key = m.rd.o.join() + '|' + m.rn;
    if (S._rk !== key) { S._rk = key; S.round = { order: m.rd.o, progress: m.rd.p, solved: !!m.rd.s }; S.roundNo = m.rn; }
    S.round.progress = m.rd.p; S.round.solved = !!m.rd.s;
    drawOrder(S.mech, S.round);
  } else if (S.round) { S.round = null; drawOrder(S.mech, null); }
  if (m.ps && m.ps.join() !== S.mech.plateSigils.join()) setPlateSigils(S.mech, m.ps);
  if (m.pc) m.pc.forEach((c, k) => { if (S.mech.pools[k].corrupt !== !!c) setPoolCorrupt(S.mech, k, !!c); });
  if (m.ce) {
    const low = m.ce.some((h) => h >= 0);
    if (low !== S.mech.censers[0].lowered) setCensers(S.mech, low, 1);
    m.ce.forEach((h, k) => { const C = S.mech.censers[k]; if (low) { C.alive = h > 0; C.hp = Math.max(0, h); C.fire.visible = h > 0; } });
    rebuildTargets(S.mech);
  }
  S.fsm = m.fs ? { mode: m.fs.m, windowLeft: m.fs.wl } : null;
  const b = G.enemies.find((e) => e.isBoss);
  if (b) { b.dgBoss = true; b.dgImm = !m.fs || m.fs.m === 'immune'; }
  M.objective = objectiveFor(D);
}
// One handler per message type (net.on keeps one), all dungeon-only, so js/coop.js keeps its exotic types untouched.
const inMission = () => G.mission?.dungeon && ['playing', 'paused'].includes(G.state);
net.on('ds', (m) => { if (inMission()) onSnapshot(m); });
net.on('dh', (m, from) => {
  if (!inMission() || !net.isHost) return;
  const D = G.mission.dungeon;
  if (onHostMsgB(D, m, from)) return;
  if (m.k === 'off') judgeOffering(D, m.i, from);
  else if (m.k === 'cen') hitCenser(m.i);
  else if (m.k === 'cup') takeChalice(D, m.id, from);
});
net.on('dfx', (m) => {
  if (!inMission()) return;
  const D = G.mission.dungeon, S = D.segs[D.seg];
  if (m.k === 'cup') { if (S?.mech && !S.mech.chalices.some((c) => c.id === m.id)) addChalice(S.mech, m.id, new THREE.Vector3(m.x, m.y, m.z)); return; }
  if (m.k === 'cupgone') { if (S?.mech) removeChalice(S.mech, m.id); return; }
  if (onFxB(D, m)) return;
  if (m.k === 'clear') { const seg = D.layout.segments[m.sg]; D.segs[m.sg].s = 'solved'; if (seg.chest) placeChest(D, m.sg, seg.chest); reviveForCompletion(); ui.centerMessage(`${seg.name} Cleared`, 'Claim your reward', 3); sfx.missionComplete(); return; }
  onOfferFx(m);
});
net.on('drst', () => { if (inMission()) onReset(); });
net.on('dwipe', () => { if (inMission()) { onReset(); G.player?.dead && G.player.respawn(false); } });

// ---------------------------------------------------------------------------
// Dev (browser console): start the dungeon; open the current boss's DPS window; skip the round.
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.shadowStart = () => startDungeon('shadow');
  window.shadowWindow = () => { const D = G.mission?.dungeon, S = D?.segs[D.seg]; if (!S?.fsm) return 'No boss yet'; S.mech.censers.forEach((c) => { c.alive = false; }); openWindow(D, S); return 'Window open'; };
  window.shadowFavor = () => { giveFavor(); return 'Favored'; };
  // U23 chunk B: jump to a segment (the ones before it count as cleared), light every flower, read the lever order, check the route
  window.shadowGo = (id) => {
    const D = G.mission?.dungeon; if (!D) return 'Start the dungeon first: shadowStart()';
    const i = D.layout.segments.findIndex((s) => s.id === id); if (i < 0) return `No segment "${id}"`;
    removeAllEnemies();
    for (let k = 0; k < i; k++) { D.segs[k].s = 'solved'; if (D.segs[k].mech?.gate) setGate(D.segs[k].mech, true); }
    D.seg = i; G.mission.checkpoint.set(...D.layout.segments[i].checkpoint); G.player.pos.copy(G.mission.checkpoint); G.player.vel.set(0, 0, 0);
    return `At ${D.layout.segments[i].name}`;
  };
  window.shadowBloom = () => devB(G.mission.dungeon).bloomAll();
  window.shadowLevers = () => devB(G.mission.dungeon).levers();
  window.checkShadowRoute = async () => { const r = (await import('./shadow-route.js')).checkShadowRoute(); console.log(r.rows.join('\n')); console.log(r.problems.length ? `PROBLEMS:\n${r.problems.join('\n')}` : 'No route problems'); return r; };
  window.shadowCheckSigils = async () => { const R = await import('./dungeon-rules.js'); const rows = []; for (const a of R.SIGILS) for (const b of R.SIGILS) if (a < b) rows.push(`${a}/${b}: ${R.sigilOverlap(a, b).toFixed(2)}`); console.log(rows.join('\n')); return rows; };
}

// U23 chunk B: what dungeon-b.js shares with this shell
bindB({
  spawnAt, spawnKit, dropChalice, segmentCleared, bossHit, removeLeftovers, placeSecret, localId,
  alivePlayers: () => alivePlayers(), expand: (kit) => expandKit(kit, 1),
  reviveAll: () => { reviveForCompletion(); G.player.health = G.player.maxHealth; G.player.shield = G.player.maxShield; },
});
