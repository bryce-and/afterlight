// U21 "Exotic Missions": the runtime. A mission-shaped shell like the Tower (G.mission.exotic), run as five segments
// (encounter / traversal / boss), with checkpoints, a 20:00 timer, restricted respawns and a final chest.
//   exotic-rules.js : the registry and every pure rule      mechanics.js : conduits, eyes, phase blocks, blights, gates, glyph boards
// The host (or a solo player) runs the timer, the segment machine, the puzzles, the gate and the boss; fireteam members mirror them from
// 'xs' snapshots and send the eyes and blights they shoot to the host ('xh'). Attuned is each player's own (mechanics.js updateMech).
import * as THREE from 'three';
import { G } from './state.js';
import * as ui from './ui.js';
import { buildLevel } from './world.js';
import { buildNav, heightAt, nearestWalkable } from './nav.js';
import { Player } from './player.js';
import { fireEnemyShot } from './enemies.js';
import { initEffects, sparks, ringFx, flashLight } from './effects.js';
import { playMusic, stinger } from './music.js';
import { sfx } from './audio.js';
import { net, send, broadcast } from './net.js';
import { cleanupMission, combatLight, spawnUnit, spawnChest, banner, reviveForCompletion, abandonMission, grantItem, gainXp, damagePlayer } from './game.js';
import { allPlayers, damageRemote, onMissionStart } from './coop.js';
import { lightMults, lightGap } from './light.js';
import { makeExotic, rollItem } from './loot.js';
import { playerPower, writeSave } from './save.js';
import { XP } from './progression.js';
import { rarityIndex } from './data.js';
import {
  buildMechanics, disposeMechanics, updateMech, setPuzzle, refreshBoard, setEyeLit, setConduitLit, setGate, setBlightsOn, setBlightHp,
  setActiveSegment, rebuildTargets, flashBoard, setSecretEye, setSecretRevealed, resetSecret,
} from './mechanics.js';
import {
  exoticDef, validateLayout, inRegion, newTimer, stepTimer, freezeTimer, timeUsed, timerRed, deathOutcome, wipeOutcome, trackSafe, inVoid,
  makeGlyphPuzzle, glyphShoot, BossFsm, expandKit, rewardPlan, recordExoticClear, exoticEnemyLight,
} from './exotic-rules.js';

export * from './exotic-rules.js';

// The level modules load on demand, so a missing layout is a clear error at launch and never breaks the rest of the game.
const LAYOUTS = { whisper: () => import('./level-whisper.js') };
const SNAP_EVERY = 0.2;
const _v = new THREE.Vector3();

export const inExotic = () => !!G.mission?.exotic;

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
/** Launches an exotic mission (solo, or the host of a fireteam; members start through the 'start' message). Async: it loads the layout first. */
export async function startExotic(id) {
  const d = exoticDef(id);
  const load = LAYOUTS[d.layout.replace(/^level-/, '')];
  if (!load) throw new Error(`No layout loader for exotic mission "${id}" (${d.layout})`);
  const mod = await load();
  const loc = mod.WHISPER_LOC, layout = mod.WHISPER_LAYOUT;
  if (!loc || !layout) throw new Error(`${d.layout}.js must export WHISPER_LOC and WHISPER_LAYOUT`);
  const bad = validateLayout(layout, d);
  if (bad.length) throw new Error(`${d.layout}.js does not match the layout contract: ${bad.join('; ')}`);
  buildExotic(d, loc, layout);
}

function buildExotic(d, loc, layout) {
  cleanupMission();
  const def = { id: d.id, name: d.name, power: 0, boss: { ...d.boss }, mood: null };
  const level = buildLevel(loc, def);
  G.level = level; G.scene = level.scene; G.colliders = level.colliders; G.staticMeshes = level.staticMeshes;
  G.nav = buildNav(G.colliders, level.bounds);
  G.hitDirty = true;
  G.scene.add(G.camera);
  initEffects(G.scene);
  G.enemies = []; G.projectiles = []; G.enemyShots = []; G.enemyGrenades = []; G.pickups = []; G.tickers = [];
  const pp = combatLight();
  const enemyLight = exoticEnemyLight(pp, d);
  const L = lightMults(lightGap(pp, enemyLight));
  def.power = enemyLight;
  onMissionStart();
  const fireteam = net.count();
  const spawn = new THREE.Vector3(...layout.spawn);
  const X = {
    id: d.id, def: d, layout, loc, seg: 0, mech: null, timer: newTimer(d.timeLimit), bossDead: false, boss: null, fsm: null, safe: { x: spawn.x, y: spawn.y, z: spawn.z },
    state: layout.segments.map(() => ({ s: 'pending', waveIdx: 0, ambush: [] })), zones: [], snapT: 0, started: false, feedT: 0,
  };
  X.zones = layout.segments.map((seg, i) => {
    const r = seg.region;
    return { enemies: [], idx: i, isBoss: seg.kind === 'boss', center: new THREE.Vector3((r.minX + r.maxX) / 2, seg.checkpoint[1], (r.minZ + r.maxZ) / 2), room: null };
  });
  X.resetSegment = () => resetSegment(X.seg);
  G.mission = {
    fireteam, coop: net.active, remote: net.isClient, exotic: X,
    loc: { planetName: 'Io', ...loc }, def, li: -1, mi: -1, g: d.g, phase: 'exotic', current: 0, revives: 0, lives: 0, tier: 'base', power: enemyLight, enemyLight, bossModel: d.boss.model,
    kills: 0, crits: 0, deaths: 0, loot: [], xp: 0, startTime: performance.now(), hpMult: 1 + d.g * 0.1, dmgMult: 1 + d.g * 0.07,
    playerDmgMult: L.playerDmgMult, incomingMult: L.incomingMult, lightImmune: L.immune,
    checkpoint: spawn.clone(), objective: '', waypoint: null, chest: null, failing: false, doneT: 0, zones: [],
  };
  G.time = 0;
  G.player = new Player(G.save);
  G.player.spawn(spawn);
  X.mech = buildMechanics(layout, { blightRadius: d.blightRadius, blightHits: d.blightHits, conduitRadius: d.conduitRadius, attuneTime: d.attuneTime });
  X.mech.onShot = (kind, seg, i) => onShot(kind, seg, i);
  X.mech.onPush = onPistonHit;
  X.mech.onTrapped = (P) => { P.pos.set(X.safe.x, X.safe.y, X.safe.z); P.vel.set(0, 0, 0); ui.feed('Pulled clear of the piston', '#ff7a6b'); }; // never left inside a solid
  setActiveSegment(X.mech, 0);
  G.state = 'playing';
  playMusic('io');
  stinger('start');
  ui.enterMission();
  ui.clearSubtitles();
  ui.centerMessage(d.name, `${loc.name ?? d.name}  ·  Enemies ◆ ${enemyLight} (+${d.enemyLightOver})  ·  ${Math.round(d.timeLimit / 60)} minutes  ·  Respawns restricted`, 4);
  sfx.areaClear();
}

/** Called by cleanupMission (game.js). */
export function cleanupExotic() {
  const X = G.mission?.exotic;
  if (!X) return;
  disposeMechanics(X.mech);
  dropSecretChest(X);
  ui.exoTimer(null);
}

// ---------------------------------------------------------------------------
// Silent removal and segment resets
// ---------------------------------------------------------------------------
/** Takes an enemy off the field with no kill, XP or drops (a segment reset). */
function silentRemove(e) {
  if (!e.alive) return;
  e.alive = false; e.hp = 0; e.dieT = 99; e.noBlast = true;
  e.model.group.visible = false;
}
export function removeAllEnemies() {
  for (const e of G.enemies) silentRemove(e);
  const X = G.mission?.exotic;
  if (X) for (const z of X.zones) z.enemies.length = 0;
  G.hitDirty = true;
}

/** Host or solo: put a segment back to how it was when first entered (enemies, gate, eyes, blights, boss and phase). */
function resetSegment(i) {
  const M = G.mission, X = M.exotic;
  if (M.remote) return;
  removeAllEnemies();
  const st = X.state[i], S = X.mech.segs[i];
  Object.assign(st, { s: 'pending', waveIdx: 0, ambush: [] });
  X.boss = null; X.fsm = null;
  S.puzzle = null;
  S.eyes.forEach((_, k) => setEyeLit(S, k, 0));
  S.blights.forEach((b, k) => { b.alive = true; setBlightHp(S, k, b.max); });
  setBlightsOn(S, false);
  S.conduits.forEach((_, k) => setConduitLit(S, k, true));
  if (S.gate) setGate(S, false);
  resetSecret(S); dropSecretChest(X); // the hidden eyes, the side path and the cache go back as they were
  S.done = false;
  setActiveSegment(X.mech, i);
  G.player?.status.remove('attuned');
  if (net.isHost) broadcast({ t: 'xrst' });
  ui.feed('Segment reset', '#ffb36b');
}
/** Member: the host reset the segment. */
export function onReset() {
  removeAllEnemies();
  G.player?.status.remove('attuned');
}

// ---------------------------------------------------------------------------
// Segment machine (host and solo)
// ---------------------------------------------------------------------------
const alivePlayers = () => allPlayers().filter((p) => p && !p.dead);
const cfgOf = (X, i) => X.def.segments[X.layout.segments[i].id];

/** U21b: a spawn on a standable nav cell at the spot's height. A jittered point that lands on a foothold's edge band or over the void
 *  (a unit spawned there falls) falls back to the spot itself, then to the nearest standable cell at that height. */
function standSpot(x, y, z, sp) {
  const nav = G.nav, ok = (px, pz) => !nav || Math.abs(heightAt(nav, px, pz) - y) <= 0.3;
  if (ok(x, z)) return new THREE.Vector3(x, y, z);
  if (ok(sp[0], sp[2])) return new THREE.Vector3(sp[0], y, sp[2]);
  const w = nearestWalkable(nav, sp[0], sp[2], 4);
  if (w && ok(w.x, w.z)) return new THREE.Vector3(w.x, y, w.z);
  console.warn(`Whisper spawn at ${sp.join(', ')} has no standable cell nearby`);
  return new THREE.Vector3(sp[0], y, sp[2]);
}
function spawnKit(X, zone, types, spots) {
  types.forEach((t, k) => {
    const sp = spots[k % spots.length];
    const pos = standSpot(sp[0] + (Math.random() - 0.5) * 1.4, sp[1], sp[2] + (Math.random() - 0.5) * 1.4, sp);
    const e = spawnUnit(zone, t, pos, {});
    e.pos.y = sp[1];
  });
  G.hitDirty = true;
}
const aliveIn = (zone) => zone.enemies.filter((e) => e.alive).length;

function activateSegment(i) {
  const M = G.mission, X = M.exotic, spec = X.layout.segments[i], cfg = cfgOf(X, i), st = X.state[i], S = X.mech.segs[i], zone = X.zones[i];
  st.s = 'active';
  setActiveSegment(X.mech, i);
  const sub = spec.kind === 'encounter' ? 'Stand in the conduit light to attune, then find the eyes' : spec.kind === 'traversal' ? 'Phase blocks are solid only while you are Attuned' : X.def.boss.name;
  banner(spec.name, sub, 3, 'areaClear');
  if (spec.kind === 'encounter') {
    S.puzzle = makeGlyphPuzzle(Math.random, S.eyes.length, cfg.puzzle.need, cfg.puzzle.mode);
    setPuzzle(S, S.puzzle);
    if (spec.blights?.length) setBlightsOn(S, true);
    rebuildTargets(X.mech);
    if (cfg.waves?.[0]) { spawnKit(X, zone, expandKit(cfg.waves[0], M.fireteam), spec.spawns); st.waveIdx = 1; }
  } else if (spec.kind === 'traversal') {
    if (cfg.harass) spawnKit(X, zone, expandKit(cfg.harass, M.fireteam), spec.spawns);
  } else {
    spawnBoss(X, spec, cfg, S, zone);
  }
}

function solveSegment(i) {
  const M = G.mission, X = M.exotic, S = X.mech.segs[i], spec = X.layout.segments[i];
  X.state[i].s = 'solved';
  S.done = true;
  if (S.gate) setGate(S, true);
  setBlightsOn(S, false);
  rebuildTargets(X.mech);
  if (spec.kind === 'encounter') banner('Gate Open', 'The way forward is clear', 2.5, 'areaClear');
  else banner('Segment Complete', '', 2, 'areaClear');
  const nx = i + 1;
  if (nx < X.layout.segments.length) {
    X.seg = nx;
    M.checkpoint.set(...X.layout.segments[nx].checkpoint);
    setActiveSegment(X.mech, nx);
  }
}

/** A shot on an eye or blight reached the host (or the solo player). */
function handleShot(kind, seg, i) {
  const M = G.mission, X = M.exotic;
  if (seg !== X.seg || X.state[seg].s !== 'active') return;
  const S = X.mech.segs[seg], spec = X.layout.segments[seg];
  if (kind === 'seye') { handleSecretEye(X, seg, i); return; }
  if (kind === 'blight') {
    const b = S.blights[i];
    if (!b || !b.on || !b.alive) return;
    setBlightHp(S, i, b.hp - 1);
    sparks(b.p, 0xffffff, 6, 5, 0.08, 0.3);
    if (b.alive) sfx.blightHit();
    else { sfx.blightDown(); ui.feed('Blight destroyed', '#cfc8ff'); }
    return;
  }
  const eye = S.eyes[i];
  if (!eye) return;
  const puzzle = S.puzzle;
  if (!puzzle) return;
  const boss = spec.kind === 'boss';
  const r = boss ? X.fsm.shoot(i) : glyphShoot(puzzle, i);
  if (r === 'ignored') { // an eye that is already lit: a faint tick and a spark, so the shot is not silent
    if (G.time - (X.againT ?? -9) > 0.3) { X.againT = G.time; sfx.eyeAgain(); sparks(eye.group.getWorldPosition(_v), 0xcfeee8, 3, 3, 0.06, 0.25); }
    return;
  }
  sparks(eye.group.getWorldPosition(_v), r === 'wrong' ? 0xff3a2a : 0x3affd8, 10, 5, 0.09, 0.4);
  if (r === 'wrong') {
    S.eyes.forEach((_, k) => setEyeLit(S, k, 0));
    setEyeLit(S, i, 2);
    ui.feed('Wrong eye: the set resets', '#ff7a6b');
    sfx.glyphWrong();
    const cfg = cfgOf(X, seg);
    if (cfg.wrongWave?.length) spawnKit(X, X.zones[seg], expandKit(cfg.wrongWave, M.fireteam), spec.spawns);
  } else {
    setEyeLit(S, i, 1, true);
    sfx.glyphRight();
  }
  if (net.isHost && M.coop) broadcast({ t: 'xfx', sg: seg, i, r: r === 'wrong' ? 0 : 1 }); // members play the same flare and sound
  flashBoard(S, r === 'wrong' ? 'bad' : 'ok');
  refreshBoard(S);
  if (r === 'solved') {
    if (boss) openWindow(X);
    else solveSegment(seg);
  }
}
function onShot(kind, seg, i) {
  const M = G.mission;
  if (M.remote) { send({ t: 'xh', k: kind, s: seg, i }); return; }
  handleShot(kind, seg, i);
}
/** Host: a member shot an eye or blight. */
export function onRemoteShot(m) { if (G.mission?.exotic && !G.mission.remote) handleShot(m.k, m.s, m.i); }

// ---------------------------------------------------------------------------
// The hidden eyes, the side path and the cache (a traversal's `secret`). Host or solo judges the eyes; everyone sees the result.
// ---------------------------------------------------------------------------
function handleSecretEye(X, seg, i) {
  const M = G.mission, S = X.mech.segs[seg], sec = S.secret, eye = sec?.eyes[i];
  if (!eye) return;
  if (sec.lit[i]) { // already lit: a faint tick, so the shot is not silent
    if (G.time - (X.againT ?? -9) > 0.3) { X.againT = G.time; sfx.eyeAgain(); }
    return;
  }
  setSecretEye(S, i, 1, true);
  const n = sec.lit.filter(Boolean).length;
  secretEyeFx(eye, n, sec.eyes.length);
  if (net.isHost && M.coop) broadcast({ t: 'xfx', sg: seg, i, r: 1, k: 's', n });
  if (n >= sec.eyes.length) revealSecret(X, seg, false);
}
/** The picture and sound of a hidden eye counting (host and members): a spark burst, a ring, a rising ping and the count in the feed. */
function secretEyeFx(eye, n, of) {
  const at = eye.group.getWorldPosition(_v);
  sparks(at, 0xffd27a, 14, 6, 0.1, 0.5);
  ringFx(at.clone(), 1.8, 0xffb347, 0.5);
  sfx.hiddenEye(n);
  ui.feed(`Hidden eye ${n} of ${of}`, '#ffd27a');
}
/** The side path appears and the cache with it. */
function revealSecret(X, seg, instant) {
  const S = X.mech.segs[seg];
  if (!S.secret || S.secret.revealed) return;
  setSecretRevealed(S, true, instant);
  showSecretChest(X, S);
  if (!instant) { banner('A Hidden Path Opens', 'Phase blocks lead to a Vex cache', 3.2, null); sfx.pathOpen(); }
}
function showSecretChest(X, S) {
  if (X.secretChest || !S.secret) return;
  const at = S.secret.chestAt, c = spawnChest(at.clone());
  c.group.position.copy(at); c.pos.copy(at);
  if (G.mission.secretLooted) { c.opened = true; c.beam.visible = false; c.lid.rotation.x = -1.9; }
  X.secretChest = c;
}
function dropSecretChest(X) {
  if (!X.secretChest) return;
  G.scene.remove(X.secretChest.group);
  X.secretChest = null;
  if (X.chestPrompt) { ui.prompt(null); X.chestPrompt = false; }
}
/** Each frame: the cache's lid, its prompt, and opening it. One legendary at your own Light, once per run (G.mission.secretLooted); no save change. */
function secretChestTick(X, P, dt) {
  const c = X.secretChest, M = G.mission;
  if (!c) return;
  if (c.opened) c.lid.rotation.x = Math.max(-1.9, c.lid.rotation.x - dt * 4);
  const near = !P.dead && !c.opened && P.pos.distanceTo(c.pos) < 3.2;
  if (near !== !!X.chestPrompt) { ui.prompt(near ? '[E]  Open Vex Cache' : null); X.chestPrompt = near; }
  if (!near || !G.input.pressed.KeyE) return;
  c.opened = true; c.beam.visible = false;
  X.chestPrompt = false; ui.prompt(null);
  sfx.chest();
  sparks(c.pos.clone().setY(c.pos.y + 1), 0xf4c542, 30, 8, 0.1, 0.8);
  if (M.secretLooted) { ui.feed('The cache is empty: you already took what it held', '#8aa'); return; }
  M.secretLooted = true;
  const s = G.save, it = rollItem(playerPower(s), rarityIndex('legendary'), null, M.loc.id ?? 'io', s.classId, s.exoticsFound);
  grantItem(it);
  ui.feed('Vex cache: a legendary', '#f4c542');
}
/** The local player was hit by a piston: the thud and the line. */
function onPistonHit() {
  sfx.pistonHit();
  const X = G.mission?.exotic;
  if (X && G.time - (X.pushT ?? -9) > 1.2) { X.pushT = G.time; ui.feed('A Vex piston knocks you back', '#ff7a6b'); }
}

// ---------------------------------------------------------------------------
// The boss: Aurix, Hollowed Mind
// ---------------------------------------------------------------------------
function spawnBoss(X, spec, cfg, S, zone) {
  const M = G.mission;
  const b = spawnUnit(zone, 'boss', new THREE.Vector3(...spec.boss), { name: X.def.boss.name, element: X.def.boss.element, model: X.def.boss.model, faction: 'taken' });
  const anchor = new THREE.Vector3(...spec.boss);
  b.thresholds = []; // phases are the glyphs' (mechanics rules), not health thirds
  b.maxShield = 1; b.shield = 0; if (b.model.shield) b.model.shield.visible = false;
  b.exoBoss = true; b.exoImm = true; b.hpFloor = b.maxHp;
  b.orbT = 3; b.pulseT = cfg.pulseEvery; b.pulseWind = 0;
  const upd = b.update.bind(b);
  b.update = (dt) => { // a Mind hangs where it is
    const r = upd(dt);
    if (b.alive) { b.pos.copy(anchor); b.model.group.position.copy(anchor).setY(anchor.y + 0.35 + 0.25 * Math.sin(G.time * 1.8)); }
    return r;
  };
  b.bossUpdate = (dt, dist) => bossAttacks(X, b, cfg, dt, dist);
  X.boss = b;
  X.fsm = new BossFsm(cfg, S.conduits.length);
  S.puzzle = X.fsm.puzzle;
  setPuzzle(S, S.puzzle);
  S.conduits.forEach((_, k) => setConduitLit(S, k, true));
  rebuildTargets(X.mech);
  banner(X.def.boss.name, 'Shoot the eyes in the order of its glyph', 3, 'bossIntro');
  stinger('boss');
}

function openWindow(X) {
  const b = X.boss;
  banner(`${X.def.boss.name} is exposed`, `Damage window: ${X.def.segments.falls.windowTime} seconds`, 2, 'alert');
  if (b) { b.exoImm = false; b.hpFloor = X.fsm.floorHp(b.maxHp); }
}

function bossAttacks(X, b, cfg, dt, dist) {
  const P = b.tgt || G.player;
  if (!P || P.dead) return;
  b.orbT -= dt;
  if (b.orbT <= 0) { // slow void orbs
    b.orbT = cfg.orbEvery * (0.85 + Math.random() * 0.3);
    b.model.group.updateMatrixWorld(true);
    const from = b.model.muzzle.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3(P.pos.x, P.pos.y + 1, P.pos.z).sub(from).normalize();
    for (const a of [-0.22, 0, 0.22]) fireEnemyShot(from, dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a), 7, b.def.dmg * b.dmgMult * 0.9, 0xb07cff, 0.5, 2.5);
    sfx.alert();
  }
  b.pulseT -= dt;
  if (b.pulseWind > 0) { // the ground blight pulse: a telegraph ring, then the burst
    b.pulseWind -= dt;
    if (b.pulseWind <= 0) {
      ringFx(b.pos.clone().setY(b.pos.y + 0.2), 11, 0xffffff, 0.6);
      flashLight(b.pos.clone().setY(b.pos.y + 1), 0xb07cff, 40, 20, 0.2);
      sfx.explosion(8, b.pos);
      for (const p of allPlayers()) {
        if (!p || p.dead || Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) > 11 || p.pos.y > b.pos.y + 1.4) continue; // jump it
        if (p.remote) damageRemote(p, 30 * b.dmgMult, b.pos); else damagePlayer(30 * b.dmgMult, b.pos, 'splash');
      }
    }
  } else if (b.pulseT <= 0) {
    b.pulseT = cfg.pulseEvery; b.pulseWind = 1.2;
    ringFx(b.pos.clone().setY(b.pos.y + 0.2), 11, 0x8a66ff, 1.2);
  }
}

function bossTick(X, dt) {
  const M = G.mission, spec = X.layout.segments[X.seg], S = X.mech.segs[X.seg], cfg = cfgOf(X, X.seg), b = X.boss, f = X.fsm;
  if (!b || !f) return;
  if (!b.alive) {
    if (!X.bossDead) bossDefeated(X, spec);
    return;
  }
  const ev = f.tick(dt, b.hp, b.maxHp);
  b.exoImm = f.immune;
  if (f.mode === 'window') b.hpFloor = f.floorHp(b.maxHp);
  if (ev === 'lit-moved') S.conduits.forEach((_, k) => setConduitLit(S, k, f.lit < 0 || k === f.lit));
  if (ev === 'window-end') {
    setPuzzle(S, f.puzzle);
    S.eyes.forEach((_, k) => setEyeLit(S, k, 0));
    refreshBoard(S);
    S.conduits.forEach((_, k) => setConduitLit(S, k, f.lit < 0 || k === f.lit));
    const next = f.phase;
    banner(`${X.def.boss.name} recovers`, f.phase === 2 ? 'Only one conduit burns now, and it moves' : f.phase === 3 ? 'Blights spread and the Taken answer' : 'Read the glyph again', 2.5, 'alert');
    if (f.blightsOn) {
      setBlightsOn(S, true);
      rebuildTargets(X.mech);
      spawnKit(X, X.zones[X.seg], expandKit(cfg.addsKit, M.fireteam), spec.spawns);
    }
  }
}

function bossDefeated(X, spec) {
  const M = G.mission;
  X.bossDead = true;
  X.state[X.seg].s = 'solved';
  freezeTimer(X.timer);
  M.phase = 'loot';
  const at = new THREE.Vector3(...spec.chest);
  M.chest = spawnChest(at);
  M.chest.group.position.y = at.y; M.chest.pos.y = at.y;
  if (net.isHost) broadcast({ t: 'xc', x: at.x, y: at.y, z: at.z });
  reviveForCompletion();
  ui.centerMessage('Aurix Falls', 'Claim your reward', 3);
  sfx.missionComplete();
  stinger('complete');
  const P = G.player;
  P.health = P.maxHealth; P.shield = P.maxShield;
  removeLeftovers(X);
}
function removeLeftovers(X) { for (const e of G.enemies) if (e.alive && !e.isBoss) silentRemove(e); }

/** Member: the host's boss died. */
export function onChest(m) {
  const M = G.mission, X = M?.exotic;
  if (!X || M.phase === 'loot' || M.phase === 'done') return;
  X.bossDead = true;
  freezeTimer(X.timer);
  M.phase = 'loot';
  M.chest = spawnChest(new THREE.Vector3(m.x, m.y, m.z));
  M.chest.group.position.y = m.y; M.chest.pos.y = m.y;
  reviveForCompletion();
  G.player.health = G.player.maxHealth; G.player.shield = G.player.maxShield;
  ui.centerMessage('Aurix Falls', 'Claim your reward', 3);
  sfx.missionComplete();
  stinger('complete');
}

// ---------------------------------------------------------------------------
// The chest: rewards, records and the usual Mission End timer (game.js openChest delegates here)
// ---------------------------------------------------------------------------
export function openExoticChest(auto) {
  const M = G.mission, X = M.exotic, d = X.def, s = G.save;
  M.chest.opened = true;
  ui.endTimer(null);
  M.chest.beam.visible = false;
  sfx.chest();
  sparks(M.chest.pos.clone().setY(1), 0xf4c542, 30, 8, 0.1, 0.8);
  const plan = rewardPlan(s, d); // read before the clear is recorded
  const pp = playerPower(s); // rewards roll on this Guardian's own Light
  const rewards = [];
  if (plan.exotic) {
    const it = makeExotic(plan.exotic, pp);
    if (!it) throw new Error(`Exotic mission reward "${plan.exotic}" does not exist`);
    rewards.push(it);
  }
  for (let i = 0; i < plan.legendary; i++) rewards.push(rollItem(pp, rarityIndex('legendary'), null, M.loc.id ?? 'io', s.classId, s.exoticsFound));
  rewards.forEach((it, i) => setTimeout(() => { if (G.mission === M) grantItem(it, auto); }, 300 + i * 450));
  const rec = recordExoticClear(s, d.id, timeUsed(X.timer));
  const glimmer = 600;
  s.glimmer += glimmer;
  M.rewardGlimmer = glimmer;
  M.firstClear = rec.first;
  M.rewards = rewards;
  M.unlocks = null;
  gainXp(XP.mission + (rec.first ? XP.firstClear : 0));
  writeSave(s);
  M.phase = 'done';
  M.doneT = 3.8;
}

// ---------------------------------------------------------------------------
// Failing: the timer, and wipes
// ---------------------------------------------------------------------------
function timeOut() {
  if (net.isHost) broadcast({ t: 'xfail' });
  failOutOfTime();
}
export function failOutOfTime() {
  abandonMission(true);
  ui.orbitNotice('Mission failed: out of time');
  if (net.isHost) broadcast({ t: 'end' });
}

/** Host: every player is down. Everyone is back at the checkpoint and the segment resets (as in solo). */
export function exoticWipe(deadFlags) {
  const M = G.mission, X = M?.exotic;
  if (!X || M.remote || M.phase === 'loot' || M.phase === 'done') return;
  if (wipeOutcome(deadFlags).action !== 'wipe-reset' || G.time < (X.wipeAt ?? 0)) return;
  X.wipeAt = G.time + 3; // teammates' dead flags take a moment to clear after the respawn
  resetSegment(X.seg);
  if (net.isHost) broadcast({ t: 'xwipe' });
  G.player.respawn(false);
}
/** Member: the host wiped the fireteam back to the checkpoint. */
export function onWipe() { onReset(); G.player?.dead && G.player.respawn(false); }

// ---------------------------------------------------------------------------
// Per frame
// ---------------------------------------------------------------------------
function objectiveFor(X) {
  const M = G.mission, spec = X.layout.segments[X.seg], st = X.state[X.seg], S = X.mech.segs[X.seg];
  const wp = (p) => { M.waypoint = p ? new THREE.Vector3(...p) : null; };
  if (st.s === 'pending') { wp(spec.checkpoint); return `Proceed to ${spec.name}`; }
  const att = X.mech.attuned;
  if (spec.kind === 'encounter') {
    const p = S.puzzle;
    wp(!att && spec.conduits?.[0] ? spec.conduits[0] : null);
    if (!p) return spec.name;
    return att ? `Shoot ${p.mode === 'any' ? `${p.len} eyes` : 'the eyes in glyph order'}  ·  ${p.progress}/${p.len}` : 'Stand in a conduit to become Attuned';
  }
  if (spec.kind === 'traversal') { wp(spec.exit.p); return att ? `Cross ${spec.name}  ·  Attuned ${Math.ceil(X.mech.attuneLeft)}s` : `Cross ${spec.name}  ·  conduits keep you Attuned`; }
  const f = X.fsm;
  wp(null);
  if (!f) return `Defeat ${X.def.boss.name}`;
  if (f.mode === 'window') return `Damage ${X.def.boss.name}  ·  ${Math.ceil(f.windowLeft)}s`;
  return att ? `Shoot the eyes in glyph order  ·  ${f.puzzle.progress}/${f.puzzle.len}` : 'Stand in a lit conduit to become Attuned';
}

export function updateExotic(dt) {
  const M = G.mission, X = M.exotic, P = G.player, layout = X.layout;
  const auth = !M.remote;
  stepTimer(X.timer, dt);
  ui.exoTimer(X.timer.left, timerRed(X.timer), X.timer.frozen);
  X.mech.clock = timeUsed(X.timer); // one clock for the pistons: the host's timer, mirrored to members by the snapshots
  const ev = updateMech(X.mech, dt, P);
  if (ev === 'attuned') { ui.feed('Attuned: eyes and phase blocks answer to you', '#5ff2dc'); sfx.ui(); }
  else if (ev === 'faded') { // every way Attuned ends says so: time out (a falling chime) or a blight (a buzz)
    const c = X.mech.fadeCause;
    if (c === 'blight') { ui.feed('A blight drains your attunement', '#ff7a6b'); sfx.attuneDrain(); }
    else if (c === 'time') { ui.feed('Attunement fades: stand in a conduit to renew it', '#8aa'); sfx.attuneFade(); }
  }
  if (X.mech.smother && G.time - (X.smotherT ?? -9) > 3) { X.smotherT = G.time; ui.feed('A blight smothers this conduit: shoot it down first', '#ff7a6b'); sfx.attuneDrain(); }
  if (M.phase === 'loot' || M.phase === 'done') return;
  secretChestTick(X, P, dt);

  // the local player: the last safe spot and the void
  if (!P.dead) {
    const over = X.mech.segs.some((S) => S.blocks.some((b) => P.pos.x > b.box.min.x - 0.4 && P.pos.x < b.box.max.x + 0.4 && P.pos.z > b.box.min.z - 0.4 && P.pos.z < b.box.max.z + 0.4 && Math.abs(P.pos.y - b.box.max.y) < 0.4));
    X.safe = trackSafe(X.safe, P.pos, P.onGround, over);
    if (inVoid(P.pos.y, layout.voidY)) voidFall(X);
  }

  if (!auth) { // members: everything else comes from the host's snapshots
    return;
  }
  if (X.timer.expired) { timeOut(); return; }

  const seg = layout.segments[X.seg], st = X.state[X.seg];
  if (st.s === 'pending') {
    if (alivePlayers().some((p) => inRegion(p.pos, seg.region))) activateSegment(X.seg);
  } else if (st.s === 'active') {
    const zone = X.zones[X.seg], cfg = cfgOf(X, X.seg);
    if (seg.kind === 'encounter') {
      if (cfg.waves && st.waveIdx < cfg.waves.length && aliveIn(zone) <= 2) { spawnKit(X, zone, expandKit(cfg.waves[st.waveIdx], M.fireteam), seg.spawns); st.waveIdx++; ui.feed('Taken reinforcements', '#ffb36b'); sfx.alert(); }
    } else if (seg.kind === 'traversal') {
      seg.ambush?.forEach((a, k) => {
        if (st.ambush[k]) return;
        if (alivePlayers().some((p) => Math.hypot(p.pos.x - a.p[0], p.pos.z - a.p[2]) < a.r && Math.abs(p.pos.y - a.p[1]) < 8)) {
          st.ambush[k] = true;
          spawnKit(X, zone, expandKit(cfg.ambushKit, M.fireteam), a.spawns);
          banner('Ambush', 'The Taken are on the ledges', 2, 'alert');
        }
      });
      if (alivePlayers().some((p) => Math.hypot(p.pos.x - seg.exit.p[0], p.pos.z - seg.exit.p[2]) < seg.exit.r && Math.abs(p.pos.y - seg.exit.p[1]) < 3)) solveSegment(X.seg);
    } else bossTick(X, dt);
  }
  if (X.state[X.seg]?.s === 'solved' && X.seg >= layout.segments.length - 1) { /* the boss segment ends in bossDefeated */ }
  M.objective = objectiveFor(X);

  // fireteam: broadcast the state
  X.snapT -= dt;
  if (net.isHost && X.snapT <= 0) { X.snapT = SNAP_EVERY; broadcast(snapshot(X)); }
}

function voidFall(X) {
  const M = G.mission, P = G.player;
  const ft = M.coop ? Math.max(1, allPlayers().length) : 1;
  const o = deathOutcome({ fireteam: ft, cause: 'void' });
  if (o.action === 'downed-at-safe') { P.pos.set(X.safe.x, X.safe.y, X.safe.z); P.vel.set(0, 0, 0); }
  P.die('void');
}

// ---------------------------------------------------------------------------
// Co-op snapshots
// ---------------------------------------------------------------------------
function snapshot(X) {
  const S = X.mech.segs[X.seg], f = X.fsm;
  return {
    t: 'xs', sg: X.seg, tl: Math.round(X.timer.left * 10) / 10, fz: X.timer.frozen ? 1 : 0, st: X.state.map((s) => s.s[0]),
    gt: X.mech.segs.map((s) => (s.gate?.open ? 1 : 0)), dn: X.mech.segs.map((s) => (s.done ? 1 : 0)),
    ey: S.eyes.map((e) => e.lit), bl: S.blights.map((b) => b.hp), bo: S.blightsOn ? 1 : 0,
    sc: S.secret ? { l: S.secret.lit, r: S.secret.revealed ? 1 : 0 } : 0,
    pz: S.puzzle ? { m: S.puzzle.mode, o: S.puzzle.order, sy: S.puzzle.symbols, pr: S.puzzle.progress, li: S.puzzle.lit } : 0,
    fs: f ? { im: f.immune ? 1 : 0, wl: Math.round(f.windowLeft * 10) / 10, lit: f.lit, ph: f.phase } : 0,
    cp: G.mission.checkpoint.toArray().map((v) => Math.round(v * 100) / 100),
  };
}

/** Member: the host judged an eye shot. Same flare and sound as the host; the snapshot only mirrors the steady state. */
export function onEyeFx(m) {
  const M = G.mission, X = M?.exotic;
  if (!X || !M.remote) return;
  const S = X.mech.segs[m.sg];
  if (m.k === 's') { const se = S?.secret?.eyes[m.i]; if (se) { setSecretEye(S, m.i, 1, true); secretEyeFx(se, m.n, S.secret.eyes.length); } return; }
  const eye = S?.eyes[m.i];
  if (!eye) return;
  sparks(eye.group.getWorldPosition(_v), m.r ? 0x3affd8 : 0xff3a2a, 10, 5, 0.09, 0.4);
  flashBoard(S, m.r ? 'ok' : 'bad');
  if (m.r) { setEyeLit(S, m.i, 1, true); sfx.glyphRight(); }
  else { S.eyes.forEach((_, k) => setEyeLit(S, k, 0)); setEyeLit(S, m.i, 2); ui.feed('Wrong eye: the set resets', '#ff7a6b'); sfx.glyphWrong(); }
}
// A dedicated message type: net.on keeps one handler per type, and js/coop.js owns the other exotic types.
net.on('xfx', (m) => { if (G.mission?.exotic) onEyeFx(m); });

/** Member: mirror the host's state. */
export function onSnapshot(m) {
  const M = G.mission, X = M?.exotic;
  if (!X || !M.remote) return;
  X.timer.left = m.tl; X.timer.frozen = !!m.fz;
  X.state.forEach((s, i) => { s.s = { p: 'pending', a: 'active', s: 'solved' }[m.st[i]] ?? s.s; });
  if (m.sg !== X.seg) { X.seg = m.sg; setActiveSegment(X.mech, m.sg); }
  M.checkpoint.set(m.cp[0], m.cp[1], m.cp[2]);
  X.mech.segs.forEach((S, i) => { setGate(S, !!m.gt[i]); S.done = !!m.dn[i]; });
  const S = X.mech.segs[m.sg];
  if (m.pz) {
    const key = JSON.stringify([m.pz.o, m.pz.sy]);
    if (S._pzKey !== key) { S._pzKey = key; setPuzzle(S, { mode: m.pz.m, eyes: S.eyes.length, len: m.pz.o.length, order: m.pz.o, symbols: m.pz.sy, progress: m.pz.pr, lit: m.pz.li, solved: false, wrongs: 0 }); }
    S.puzzle.progress = m.pz.pr; S.puzzle.lit = m.pz.li;
    refreshBoard(S);
  } else if (S.puzzle) { S.puzzle = null; S._pzKey = null; }
  m.ey.forEach((v, i) => { if (S.eyes[i].lit !== v) setEyeLit(S, i, v); });
  if (m.sc && S.secret) {
    m.sc.l.forEach((v, i) => { if (S.secret.lit[i] !== v) setSecretEye(S, i, v); });
    if (m.sc.r && !S.secret.revealed) revealSecret(X, m.sg, false);
    else if (!m.sc.r && S.secret.revealed) { setSecretRevealed(S, false); dropSecretChest(X); }
  }
  m.bl.forEach((hp, i) => { if (S.blights[i].hp !== hp) setBlightHp(S, i, hp); });
  if (S.blightsOn !== !!m.bo) { setBlightsOn(S, !!m.bo); rebuildTargets(X.mech); }
  X.fs = m.fs;
  if (m.fs) {
    S.conduits.forEach((_, k) => { const lit = m.fs.lit < 0 || k === m.fs.lit; if (S.conduits[k].lit !== lit) setConduitLit(S, k, lit); });
    const b = G.enemies.find((e) => e.isBoss);
    if (b) { b.exoBoss = true; b.exoImm = !!m.fs.im; b.maxShield = 1; b.shield = 0; }
  }
}

// ---------------------------------------------------------------------------
// Dev tools (browser console): jump a running Whisper to a segment, and the route and symbol checks.
// ---------------------------------------------------------------------------
/** Dev: puts a running Whisper at a segment's checkpoint with every earlier segment solved (gates open). Use after startExotic('whisper'). */
export function devJumpToSegment(id) {
  const M = G.mission, X = M?.exotic;
  if (!X) throw new Error('Start The Whisper first (/whispermission)');
  const i = X.layout.segments.findIndex((s) => s.id === id);
  if (i < 0) throw new Error(`No segment "${id}": ${X.layout.segments.map((s) => s.id).join(', ')}`);
  removeAllEnemies();
  X.layout.segments.forEach((spec, k) => {
    const S = X.mech.segs[k];
    X.state[k] = { s: k < i ? 'solved' : 'pending', waveIdx: 0, ambush: [] };
    S.done = k < i;
    if (S.gate) setGate(S, k < i, true);
  });
  X.seg = i;
  M.checkpoint.set(...X.layout.segments[i].checkpoint);
  setActiveSegment(X.mech, i);
  G.player.status.remove('attuned');
  G.player.spawn(new THREE.Vector3(...X.layout.segments[i].checkpoint));
  return `At ${X.layout.segments[i].name}`;
}
/** Dev: starts The Whisper and jumps to a segment. */
export async function devStartWhisperAt(id = 'descent') { await startExotic('whisper'); return devJumpToSegment(id); }
if (typeof window !== 'undefined') {
  window.whisperTo = (id) => devJumpToSegment(id);
  window.checkWhisperSymbols = async () => { const r = (await import('./level-whisper.js')).checkWhisperSymbols(); console.log(r.rows.join('\n')); console.log(r.problems.length ? `PROBLEMS:\n${r.problems.join('\n')}` : 'No symbol problems'); return r; };
  window.checkWhisperRoute = async () => { const r = (await import('./level-whisper.js')).checkWhisperRoute(); console.log(r.rows.join('\n')); console.log(r.problems.length ? `PROBLEMS:\n${r.problems.join('\n')}` : 'No route problems'); return r; };
}
